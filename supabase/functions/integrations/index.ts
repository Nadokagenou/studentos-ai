// ============================================================
// integrations — ประตูเดียวที่ฝั่งแอปใช้คุยเรื่องการเชื่อมทั้งหมด
// ------------------------------------------------------------
// ทำไมต้องเป็นฟังก์ชัน ไม่ใช่ให้แอปยิง PostgREST ตรง ๆ เหมือนตารางอื่น:
//   ตาราง integrations มีคอลัมน์ secret อยู่ในแถวเดียวกับข้อมูลที่โชว์ได้
//   และ RLS คุมได้แค่ "แถวไหน" ไม่ได้คุม "คอลัมน์ไหน" — เปิดให้อ่านแถวตัวเองเมื่อไหร่
//   ก็เท่ากับส่งกุญแจที่เข้ารหัสไว้ลงไปอยู่ในหน่วยความจำของเบราว์เซอร์ทุกครั้งที่เปิดหน้าตั้งค่า
//
//   และการตัดการเชื่อมต้องไปถอนสิทธิ์ที่ฝั่งผู้ให้บริการด้วย ไม่ใช่แค่ลบแถวทิ้ง —
//   ลบแถวอย่างเดียวคือ "เราลืม" แต่สิทธิ์ยังค้างอยู่ในบัญชี Google ของผู้ใช้ตลอดไป
//
// คำสั่งที่รับ: list · connect_ics · connect_google · disconnect · sync_now · set_paused
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cryptoReady, seal, signState, unseal } from '../_shared/integrations.ts';
import { fetchIcs, normalizeIcsUrl } from '../_shared/ics.ts';
import {
  authorizeUrl, CALENDAR_SCOPES, classroomReady, CLASSROOM_SCOPES, revokeToken,
} from '../_shared/classroom.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });

// คอลัมน์ที่โชว์ให้ผู้ใช้เห็นได้ — secret ไม่อยู่ในนี้และต้องไม่อยู่ในนี้ตลอดไป
const SAFE = 'id, provider, account, scopes, status, error_msg, last_sync_at, created_at';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, message: 'ต้องเป็น POST' }, 405);

  if (!cryptoReady()) {
    return json({ ok: false, message: 'ระบบยังไม่พร้อม (ยังไม่ได้ตั้ง INTEGRATION_KEY)' }, 503);
  }

  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: who } = await asUser.auth.getUser();
  const uid = who?.user?.id ?? null;
  if (!uid) return json({ ok: false, message: 'ต้องล็อกอินก่อน' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, message: 'คำขอไม่ถูกต้อง' }, 400); }
  const action = String(body.action ?? '');

  try {
    if (action === 'list') {
      const { data, error } = await db.from('integrations')
        .select(SAFE).eq('user_id', uid).order('created_at', { ascending: true });
      if (error) throw error;
      return json({ ok: true, items: data ?? [], ready: { google: classroomReady() } });
    }

    // ---------- เชื่อมปฏิทิน ICS ----------
    if (action === 'connect_ics') {
      const url = normalizeIcsUrl(String(body.url ?? ''));
      const tz = String(body.tz || 'Asia/Bangkok');

      // ยิงจริงหนึ่งครั้งก่อนบันทึก — ลิงก์ที่ใช้ไม่ได้ต้องแจ้งตอนที่ผู้ใช้ยังอยู่ตรงหน้า
      // ไม่ใช่บันทึกไว้แล้วให้เขารอเก้อครึ่งชั่วโมงกว่าจะรู้ว่าไม่มีอะไรเข้ามาเลย
      const probe = await fetchIcs(url, tz);
      const account = probe.calName || hostOf(url);

      const { data, error } = await db.from('integrations').upsert({
        user_id: uid, provider: 'ics', account,
        secret: await seal(url),
        meta: { tz, cal_name: probe.calName },
        scopes: ['calendar:read'],
        status: 'active', error_msg: null, fail_count: 0,
        next_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider,account' }).select(SAFE).single();
      if (error) throw error;

      // ซิงก์รอบแรกทันที — "เชื่อมแล้วไม่มีอะไรเกิดขึ้น" คือจุดที่คนเลิกเชื่อว่ามันทำงาน
      await kick(String(data.id));

      // นับเฉพาะของที่จะเข้าแผนจริง ไม่ใช่จำนวนบรรทัดทั้งไฟล์ — ปฏิทินโรงเรียนใบหนึ่ง
      // มีงานย้อนหลังทั้งปีอยู่ในนั้น บอกว่า "เจอ 317 รายการ" แล้วขึ้นมาสิบใบ
      // คือตัวเลขที่ทำให้คนคิดว่าระบบกินของหายไป 307 ใบ
      const cut = Date.now() - 24 * 3600_000;
      const upcoming = probe.tasks.filter(t => !t.due || new Date(t.due).getTime() >= cut).length;
      return json({ ok: true, item: data, found: upcoming, total: probe.tasks.length });
    }

    // ---------- เชื่อมบัญชี Google ----------
    if (action === 'connect_google') {
      if (!classroomReady()) {
        return json({ ok: false, message: 'ฝั่งเซิร์ฟเวอร์ยังไม่ได้ตั้งกุญแจ Google' }, 503);
      }
      const provider = String(body.provider ?? 'google_classroom');
      if (provider !== 'google_classroom' && provider !== 'google_calendar') {
        return json({ ok: false, message: 'ไม่รู้จักตัวเชื่อมนี้' }, 400);
      }
      const scopes = provider === 'google_classroom' ? CLASSROOM_SCOPES : CALENDAR_SCOPES;
      const state = await signState({ u: uid, p: provider, back: String(body.back ?? '') });
      return json({
        ok: true,
        url: authorizeUrl({ redirectUri: callbackUrl(), state, scopes }),
      });
    }

    // ---------- ตัดการเชื่อม ----------
    if (action === 'disconnect') {
      const id = String(body.id ?? '');
      const { data: row, error } = await db.from('integrations')
        .select('id, provider, secret').eq('id', id).eq('user_id', uid).maybeSingle();
      if (error) throw error;
      if (!row) return json({ ok: false, message: 'ไม่พบการเชื่อมนี้' }, 404);

      // ถอนสิทธิ์ที่ต้นทางก่อน แล้วค่อยลบของเรา · ลำดับนี้สำคัญ:
      // ลบก่อนแล้วถอนพลาด = สิทธิ์ค้างอยู่ในบัญชีเขาโดยที่เราไม่เหลือกุญแจไปถอนอีกแล้ว
      if (row.provider.startsWith('google_')) {
        const token = await unseal(row.secret);
        if (token) await revokeToken(token);
      }
      // ทะเบียนงานหายตามด้วย on delete cascade — ตั้งใจให้หาย เพราะถ้าเชื่อมใหม่
      // ผู้ใช้ควรได้งานที่ยังค้างอยู่กลับมาครบ ไม่ใช่เงียบเพราะทะเบียนเก่ายังจำว่า "ส่งไปแล้ว"
      const { error: delErr } = await db.from('integrations')
        .delete().eq('id', id).eq('user_id', uid);
      if (delErr) throw delErr;
      return json({ ok: true });
    }

    // ---------- พักไว้ก่อน ไม่ได้ตัด ----------
    if (action === 'set_paused') {
      const id = String(body.id ?? '');
      const paused = body.paused === true;
      const { data, error } = await db.from('integrations').update({
        status: paused ? 'paused' : 'active',
        error_msg: null, fail_count: 0,
        next_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id).eq('user_id', uid).select(SAFE).maybeSingle();
      if (error) throw error;
      if (!data) return json({ ok: false, message: 'ไม่พบการเชื่อมนี้' }, 404);
      return json({ ok: true, item: data });
    }

    // ---------- ซิงก์เดี๋ยวนี้ ----------
    if (action === 'sync_now') {
      const id = String(body.id ?? '');
      const { data: row } = await db.from('integrations')
        .select('id').eq('id', id).eq('user_id', uid).maybeSingle();
      if (!row) return json({ ok: false, message: 'ไม่พบการเชื่อมนี้' }, 404);
      const r = await kick(id);
      return json({ ok: true, result: r });
    }

    return json({ ok: false, message: 'ไม่รู้จักคำสั่งนี้' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[integrations]', action, msg);
    return json({ ok: false, message: msg }, 400);
  }
});

/** เรียกตัว sync ให้ทำงานกับการเชื่อมเส้นเดียวทันที
 *  ยิงข้ามฟังก์ชันด้วย service role — ไม่ได้ import ตัว sync เข้ามาตรง ๆ เพราะ
 *  cron ต้องเรียกมันได้เองอยู่แล้ว การมีทางเข้าทางเดียวแปลว่าพฤติกรรมเหมือนกันทั้งสองทาง */
async function kick(integrationId: string) {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ integration_id: integrationId }),
    });
    return await r.json().catch(() => ({ ok: r.ok }));
  } catch (e) {
    // ซิงก์รอบแรกพลาดไม่ใช่เหตุผลที่จะบอกว่าการเชื่อมล้มเหลว — cron จะเก็บให้เองใน 30 นาที
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function callbackUrl(): string {
  return `${SUPABASE_URL}/functions/v1/oauth-callback`;
}

function hostOf(u: string): string {
  try { return new URL(u).hostname; } catch { return 'ปฏิทิน'; }
}
