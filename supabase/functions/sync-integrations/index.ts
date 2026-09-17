// ============================================================
// sync-integrations — ตัวที่ทำให้งานไหลเข้ามาเองตอนที่ไม่มีใครเปิดแอป
// ------------------------------------------------------------
// ยิงจาก cron ทุก 30 นาที (migration 20260917090100) และยิงตรงได้จากปุ่ม
// "ซิงก์เดี๋ยวนี้" ผ่านฟังก์ชัน integrations โดยส่ง integration_id มาด้วย
//
// หน้าที่มีสี่อย่าง และข้อ 3 คือข้อที่ยากจริง:
//   1. ถอดรหัสกุญแจ แล้วถามต้นทางว่ามีงานอะไรบ้าง
//   2. แปลงเป็น StandardTask (ตัวเชื่อมแต่ละตัวทำเอง ไฟล์นี้ไม่รู้จัก API ของใครเลย)
//   3. เทียบกับทะเบียนว่า **อะไรใหม่ · อะไรถูกแก้ · อะไรหายไปจากต้นทาง**
//   4. หย่อนเฉพาะส่วนที่เปลี่ยนลง inbox_items ท่อเดิม
//
// ⚠️ ห้ามเขียนลง user_state.data เด็ดขาด — เหตุผลอยู่ในหัว migration
//    งานที่เขียนแทรกเข้าไปตรง ๆ จะหายเงียบ ๆ ภายใน 1.5 วินาที
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cryptoReady, fingerprint, unseal } from '../_shared/integrations.ts';
import type { StandardTask } from '../_shared/integrations.ts';
import { fetchIcs } from '../_shared/ics.ts';
import { classroomReady, fetchClassroom } from '../_shared/classroom.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY);

// กี่เส้นต่อรอบ — ฟังก์ชันมีเพดานเวลาของมัน และการเชื่อมหนึ่งเส้นใช้เวลาไม่เท่ากันเลย
// (ICS หนึ่งคำขอจบ · Classroom ยิงต่อคอร์ส) · เหลือไว้รอบหน้าดีกว่าโดนตัดกลางคัน
const BATCH = 10;

// ถอยห่างเมื่อพัง — 30 นาที · 2 ชม. · 8 ชม. · 24 ชม. แล้วคาที่วันละครั้ง
// ต้นทางล่มแล้วเรายิงซ้ำทุก 30 นาทีไปเรื่อย ๆ คือการเติมภาระให้ระบบที่กำลังมีปัญหาอยู่แล้ว
const BACKOFF_MIN = [30, 120, 480, 1440];
const NORMAL_GAP_MIN = 30;

type Row = {
  id: string; user_id: string; provider: string; account: string;
  secret: string | null; meta: Record<string, unknown>; fail_count: number;
};

Deno.serve(async (req) => {
  try {
    if (!cryptoReady()) {
      return json({ ok: false, error: 'ยังไม่ได้ตั้ง INTEGRATION_KEY' }, 500);
    }
    const body = await req.json().catch(() => ({}));
    const only = typeof body?.integration_id === 'string' ? body.integration_id : null;

    let q = db.from('integrations')
      .select('id, user_id, provider, account, secret, meta, fail_count');
    q = only
      ? q.eq('id', only)
      // paused = ผู้ใช้ปิดไว้เอง · needs_reauth = ลองใหม่เองอีกกี่รอบก็ไม่หาย ต้องรอคนมากด
      : q.in('status', ['active', 'error']).lte('next_sync_at', new Date().toISOString())
         .order('next_sync_at', { ascending: true }).limit(BATCH);

    const { data, error } = await q;
    if (error) throw error;

    const out = [];
    for (const row of (data || []) as Row[]) out.push(await syncOne(row));
    return json({ ok: true, ran: out.length, results: out });
  } catch (e) {
    console.error('[sync] รอบนี้ล้มทั้งรอบ:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

async function syncOne(row: Row) {
  try {
    const secret = await unseal(row.secret);
    if (!secret) {
      // ถอดรหัสไม่ออก = กุญแจถูกเปลี่ยน หรือข้อมูลเสีย · ลองใหม่เองไม่มีทางหาย
      await markReauth(row, 'กุญแจที่เก็บไว้ใช้ไม่ได้แล้ว ต้องเชื่อมใหม่');
      return { id: row.id, status: 'needs_reauth' };
    }

    const res = await pull(row, secret);
    if (res.unchanged) {
      await db.from('integrations').update({
        last_sync_at: new Date().toISOString(),
        next_sync_at: minutesFromNow(NORMAL_GAP_MIN),
        status: 'active', error_msg: null, fail_count: 0,
      }).eq('id', row.id);
      return { id: row.id, status: 'unchanged' };
    }

    const sent = await reconcile(row, res.tasks);

    await db.from('integrations').update({
      last_sync_at: new Date().toISOString(),
      next_sync_at: minutesFromNow(NORMAL_GAP_MIN),
      status: 'active', error_msg: null, fail_count: 0,
      meta: { ...row.meta, ...res.meta },
      ...(res.account ? { account: res.account } : {}),
    }).eq('id', row.id);

    return { id: row.id, status: 'ok', ...sent };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // reauth = ปัญหาที่ต้องให้คนมากด · ที่เหลือคือปัญหาชั่วคราวที่ถอยห่างแล้วลองใหม่เองได้
    if ((e as { reauth?: boolean })?.reauth) {
      await markReauth(row, msg);
      return { id: row.id, status: 'needs_reauth', error: msg };
    }
    const n = Math.min(row.fail_count + 1, BACKOFF_MIN.length);
    await db.from('integrations').update({
      status: 'error', error_msg: msg.slice(0, 300), fail_count: n,
      last_sync_at: new Date().toISOString(),
      next_sync_at: minutesFromNow(BACKOFF_MIN[n - 1]),
    }).eq('id', row.id);
    return { id: row.id, status: 'error', error: msg };
  }
}

async function markReauth(row: Row, msg: string) {
  await db.from('integrations').update({
    status: 'needs_reauth', error_msg: msg.slice(0, 300),
    last_sync_at: new Date().toISOString(),
    // ไม่ต้องยิงซ้ำอีกจนกว่าคนจะมากดเชื่อมใหม่ — ตั้งไว้ไกล ๆ แทนการปิดสวิตช์
    // เผื่อกรณีที่ต้นทางหายชั่วคราวแล้วกลับมาเอง จะได้ลองอีกครั้งในวันรุ่งขึ้น
    next_sync_at: minutesFromNow(1440),
  }).eq('id', row.id);
}

// ---------- ทะเบียนตัวเชื่อม ----------
// เพิ่มเจ้าใหม่ = เขียนไฟล์ใน _shared/ แล้วต่ออีกหนึ่ง case ตรงนี้ · ที่เหลือไม่ต้องแตะ
async function pull(row: Row, secret: string): Promise<{
  tasks: StandardTask[]; meta?: Record<string, unknown>; account?: string; unchanged?: boolean;
}> {
  if (row.provider === 'ics') {
    const tz = String(row.meta?.tz || 'Asia/Bangkok');
    const r = await fetchIcs(secret, tz, {
      etag: (row.meta?.etag as string) ?? null,
      lastModified: (row.meta?.last_modified as string) ?? null,
    });
    if (r.unchanged) return { tasks: [], unchanged: true };
    return {
      tasks: r.tasks,
      meta: { etag: r.etag ?? null, last_modified: r.lastModified ?? null, cal_name: r.calName },
      account: r.calName || undefined,
    };
  }

  if (row.provider === 'google_classroom') {
    if (!classroomReady()) throw new Error('ยังไม่ได้ตั้งกุญแจ Google ฝั่งเซิร์ฟเวอร์');
    const r = await fetchClassroom(secret);
    return { tasks: r.tasks, account: r.account || undefined };
  }

  throw new Error(`ไม่รู้จักตัวเชื่อม "${row.provider}"`);
}

// ---------- เทียบกับทะเบียน ----------
// หัวใจของการ "ไม่ส่งซ้ำ" และ "ตามการแก้ไขให้ทัน" อยู่ที่นี่ที่เดียว
async function reconcile(row: Row, tasks: StandardTask[]) {
  const { data: known, error } = await db.from('integration_items')
    .select('source_id, fingerprint, sent_fingerprint, state, title, due')
    .eq('integration_id', row.id);
  if (error) throw error;

  const byId = new Map((known || []).map(k => [k.source_id, k]));
  const now = new Date().toISOString();
  const deliver: { task: StandardTask; op: 'new' | 'update' | 'cancel'; fp: string }[] = [];
  const ledger: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const t of tasks) {
    if (!t.sourceId || !t.title) continue;
    seen.add(t.sourceId);
    const fp = await fingerprint(t);
    const old = byId.get(t.sourceId);

    // ไม่มีอะไรเปลี่ยน และเคยส่งไปแล้ว — ข้ามไปเลย ไม่ต้องเขียนอะไรทั้งนั้น
    if (old && old.fingerprint === fp && old.sent_fingerprint === fp) continue;

    const op: 'new' | 'update' | 'cancel' = t.cancelled ? 'cancel' : (old ? 'update' : 'new');
    deliver.push({ task: t, op, fp });
    ledger.push({
      integration_id: row.id, source_id: t.sourceId, user_id: row.user_id,
      fingerprint: fp, title: t.title.slice(0, 200), due: t.due ?? null, url: t.url ?? null,
      state: t.cancelled ? 'cancelled' : 'active',
      seen_at: now, updated_at: now,
    });
  }

  // ---------- ของที่หายไปเฉย ๆ ----------
  // ICS ไม่มีวิธีบอกว่า "ลบแล้ว" มันแค่ไม่ส่งมาอีก · Classroom ก็หยุดส่งงานที่ถูกลบ
  // เงียบ ๆ เหมือนกัน — การหายไปจึงเป็นสัญญาณเดียวที่มี และต้องแปลให้ถูก
  //
  // แต่ต้องแปลอย่างระวัง: ปฏิทินที่ตัดงานเก่าออกหลังผ่านไป 30 วัน จะทำให้งานที่
  // "ส่งไปแล้วเมื่อเดือนที่แล้ว" หายจากฟีดพร้อมกันทีเดียวสิบใบ — ถ้าตีความว่าครูยกเลิก
  // นักเรียนจะได้แจ้งเตือน "งานถูกยกเลิก" สิบดอกรวดเรื่องงานที่เขาทำส่งไปนานแล้ว
  // จึงบอกแอปเฉพาะงานที่ **ยังไม่ถึงกำหนด** เท่านั้น ที่เหลือแค่ปิดทะเบียนเงียบ ๆ
  const cutoff = Date.now();
  for (const k of (known || [])) {
    if (seen.has(k.source_id) || k.state === 'cancelled') continue;
    ledger.push({
      integration_id: row.id, source_id: k.source_id, user_id: row.user_id,
      fingerprint: k.fingerprint, title: k.title, due: k.due,
      state: 'cancelled', seen_at: now, updated_at: now,
    });
    // บอกแอปเฉพาะงานที่เคยส่งไปแล้วจริง และยังไม่ถึงกำหนด
    const pending = k.sent_fingerprint && k.due && new Date(k.due).getTime() > cutoff;
    if (!pending) continue;
    deliver.push({
      task: { sourceId: k.source_id, title: k.title || '', due: k.due, cancelled: true },
      op: 'cancel', fp: k.fingerprint,
    });
  }

  if (ledger.length) {
    const { error: upErr } = await db.from('integration_items')
      .upsert(ledger, { onConflict: 'integration_id,source_id' });
    if (upErr) throw upErr;
  }

  if (!deliver.length) return { sent: 0 };

  // ---------- หย่อนลงท่อเดิม ----------
  const rows = deliver.map(d => ({
    user_id: row.user_id,
    source: row.provider,
    raw: humanLine(d.task),
    meta: {
      v: 1,
      structured: true,          // ฝั่งแอปเห็นธงนี้แล้วข้ามตัวแกะข้อความทั้งหมด
      op: d.op,
      provider: row.provider,
      // กุญแจที่ฝั่งแอปใช้จับว่า "งานใบนี้คืองานใบเดิมที่เคยรับไปแล้ว"
      // ใช้ provider ไม่ใช่ integration_id เพราะถ้าผู้ใช้ตัดการเชื่อมแล้วเชื่อมใหม่
      // มันต้องจับได้ว่าเป็นงานเดิม ไม่ใช่งานใหม่ทั้งปฏิทิน
      srcKey: `${row.provider}:${d.task.sourceId}`,
      sourceId: d.task.sourceId,
      sourceUrl: d.task.url ?? null,
      account: row.account || null,
      task: {
        title: d.task.title,
        detail: d.task.detail ?? '',
        subject: d.task.subject ?? '',
        due: d.task.due ?? null,
        type: d.task.type ?? 'homework',
      },
    },
  }));

  const { error: inErr } = await db.from('inbox_items').insert(rows);
  if (inErr) throw inErr;

  // ทำเครื่องหมายว่าส่งแล้ว **หลัง** เขียน inbox สำเร็จเท่านั้น
  // สลับลำดับเมื่อไหร่ เน็ตหลุดกลางทางจะกลายเป็น "ทะเบียนบอกว่าส่งแล้ว แต่ไม่มีใครได้รับ"
  // ซึ่งเป็นความเงียบที่ไม่มีใครจับได้จนกว่าจะถึงวันส่งงาน
  for (const d of deliver) {
    await db.from('integration_items')
      .update({ sent_fingerprint: d.fp, sent_at: now })
      .eq('integration_id', row.id).eq('source_id', d.task.sourceId);
  }
  return { sent: deliver.length };
}

/** บรรทัดที่อ่านออกด้วยตา — inbox_items.raw ห้ามว่าง และมันคือสิ่งที่โผล่ในบันทึก
 *  ตอนผู้ใช้ถามว่า "งานนี้มาจากไหน" · ต้องอ่านรู้เรื่องโดยไม่ต้องเปิด meta ดู */
function humanLine(t: StandardTask): string {
  const bits = [t.subject, t.title].filter(Boolean).join(' · ');
  if (!t.due) return bits;
  const d = new Date(t.due);
  return isNaN(d.getTime()) ? bits : `${bits} (ส่ง ${d.toISOString().slice(0, 16).replace('T', ' ')})`;
}

function minutesFromNow(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
