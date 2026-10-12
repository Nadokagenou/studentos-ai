// ============================================================
// notify-dm — แชทเด้งทันทีที่เพื่อนส่งมา แม้ปิดแอปอยู่
// ------------------------------------------------------------
// เจ้าของ (12 ต.ค. 2569): "แชทก็ไม่แจ้งเตือนนอกแอปเลย ที่คุยกันกับเพื่อน"
//
// วัดจากฐานข้อมูลจริงแล้ว: แชทเคยอาศัยรอบ 30 นาทีของ send-reminders
// ข้อความ 15:08 ไปเด้ง 16:00 (รอบ 15:30 เลือกส่งเรื่องงานไปก่อน เพราะคนละดอกต่อรอบ)
// และ 22:00–07:00 ไม่ส่งเลย · แชทที่เด้งช้าเกือบชั่วโมงคือแชทที่ "ไม่เด้ง" ในสายตาคนใช้
//
// ทางใหม่: trigger บน dm_messages (migration 20261012120000_dm_push.sql) ยิง { id }
// มาที่นี่ทันทีที่ข้อความลงตาราง → ส่งเข้ามือถือผู้รับทุกเครื่อง
//   - ทุกเวลา รวมกลางคืน — เจ้าของเลือกเอง ("เด้งเลย") ทั้งที่รู้ว่ากฎเดิมเงียบกลางดึก
//   - การ์ดโชว์ข้อความที่เพื่อนพิมพ์ — เจ้าของสั่งเอง ("เอาข้อความที่พิมพ์ส่งไปเลย")
//     กลับกฎเดิมของ dmCopy ที่ไม่ใส่เนื้อแชทเพราะการ์ดขึ้นจอล็อก · ยกเว้นสองกรณีที่ยังซ่อน:
//     ข้อความที่ตัวกรอง (guard) ซ่อนแล้ว และคำขอคุยจากคนที่ยังไม่ได้รับ (คนแปลกหน้า)
//   - tag ต่อห้อง — คุยรัว ๆ แล้วการ์ดของห้องเดียวกันแทนที่กันเอง ไม่กองเต็มจอ
//   - คีย์กันซ้ำเป็นรูปเดียวกับ send-reminders (dm::ห้อง::เวลา) ทั้งสองทางจึงไม่ส่งซ้ำกัน
//     และถ้าทางนี้ล้ม รอบ 30 นาทียังเก็บตกให้เหมือนเดิม
//
// ใครเรียกได้: verify_jwt เปิดอยู่ · trigger แนบ publishable key (แบบเดียวกับ cron ทุกตัว)
// คนนอกที่ถือกุญแจนั้นทำได้อย่างเดียวคือ "ปลุกการเตือนของข้อความจริงที่เพิ่งส่ง"
// ซึ่งถูกกันซ้ำด้วยคีย์ข้างบนอยู่แล้ว · ข้อความเกิน 10 นาทีไม่ส่ง
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { pushReady, pushToUser } from '../_shared/notify.ts';

const FRESH_MS = 10 * 60000;       // ข้อความเก่ากว่านี้ไม่เด้งแล้ว (กันคนยิงซ้ำ id เก่า)
const COUNT_BACK_MS = 6 * 3.6e6;   // นับ "กี่ข้อความใหม่" ย้อนได้ไกลสุดเท่านี้
const TEXT_MAX = 150;              // ยาวกว่านี้ตัด — การ์ดโชว์ได้ไม่กี่บรรทัดอยู่แล้ว
// guard ตรวจข้อความ "หลังส่ง" (แอปเรียกหลัง dm_say สำเร็จ · Gemini ใช้ ~1–3 วิ)
// รอให้มันทันก่อนค่อยอ่าน hidden — ไม่งั้นข้อความที่กำลังจะโดนซ่อนขึ้นจอล็อกไปก่อนแล้ว
// เอาคืนไม่ได้ · แลกกับการ์ดช้าลงไม่กี่วินาที
const GUARD_WAIT_MS = Number(Deno.env.get('DM_GUARD_WAIT_MS') ?? 3000);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// deno-lint-ignore no-explicit-any
let db: any = null;
function client() {
  if (!db) db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  return db;
}

/** ข้อความบนการ์ด — หัว = ชื่อคนส่ง (+ จำนวนถ้าหลายข้อความ) · เนื้อ = สิ่งที่พิมพ์มา */
export function dmCard(
  name: string, n: number,
  opts: { image?: boolean; request?: boolean; text?: string } = {},
) {
  const who = name.trim() || 'เพื่อน';
  const title = n > 1 ? `${who} (${n})` : who;
  if (opts.request) return { title: who, body: 'ขอคุยกับคุณ' };
  const text = String(opts.text ?? '').replace(/\s+/g, ' ').trim();
  if (text) return { title, body: text.length > TEXT_MAX ? text.slice(0, TEXT_MAX - 1) + '…' : text };
  if (opts.image) return { title, body: 'ส่งรูปมา' };
  return { title, body: n > 1 ? `${n} ข้อความใหม่` : 'ส่งข้อความถึงคุณ' };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  let id = NaN;
  try { id = Number((await req.json())?.id); } catch (_) { /* ตกไปเช็คข้างล่าง */ }
  if (!Number.isFinite(id) || id <= 0) return json({ ok: false, error: 'bad id' }, 400);
  if (!pushReady()) return json({ ok: false, error: 'VAPID secret ขาด' }, 500);

  try {
    const db = client();
    const { data: m, error } = await db.from('dm_messages')
      .select('thread, sender, body, image, created_at, dm_threads!inner(a, b, state, opener)')
      .eq('id', id).maybeSingle();
    if (error) throw new Error('dm_messages: ' + error.message);
    if (!m) return json({ ok: true, skipped: 'gone' });

    const at = Date.parse(m.created_at);
    if (!(Date.now() - at < FRESH_MS)) return json({ ok: true, skipped: 'stale' });

    const th = m.dm_threads;
    const to = m.sender === th.a ? th.b : th.a;
    if (!to || to === m.sender) return json({ ok: true, skipped: 'self' });

    // สวิตช์ของผู้รับ — ปิดทั้งหมด หรือปิดเฉพาะเรื่องเพื่อน (ตัวเดียวกับที่ send-reminders อ่าน)
    const { data: st } = await db.from('user_state')
      .select('settings:data->settings').eq('id', to).maybeSingle();
    const prefs = st?.settings ?? {};
    if (prefs?.notifOff === true || prefs?.notifSocial === false) return json({ ok: true, skipped: 'off' });

    // จองคีย์ก่อนส่ง — trigger ยิงซ้ำ · รอบ 30 นาทีวิ่งชนพอดี · ใครยิง id เดิมมาอีก = ได้ดอกเดียว
    // insert ไม่ใช่ upsert: ชนแปลว่ามีคนส่งไปแล้ว ไม่ใช่ให้ทับ
    const key = `dm::${m.thread}::${m.created_at}`;
    const { error: claimErr } = await db.from('push_sent')
      .insert({ user_id: to, task_id: key, sent_at: new Date().toISOString() });
    if (claimErr && claimErr.code === '23505') return json({ ok: true, skipped: 'dup' });
    // error ชนิดอื่น = ส่งต่อ · ซ้ำหนึ่งดอกดีกว่าเงียบ

    // กี่ข้อความที่ยังไม่ได้ตอบ = ของคนส่งหลังจากที่ผู้รับพิมพ์ครั้งล่าสุด
    const back = new Date(at - COUNT_BACK_MS).toISOString();
    const { data: recent } = await db.from('dm_messages')
      .select('sender, created_at').eq('thread', m.thread).gte('created_at', back).limit(200);
    const rows = (recent ?? []) as { sender: string; created_at: string }[];
    const lastReply = rows.filter(r => r.sender === to)
      .reduce((mx, r) => Math.max(mx, Date.parse(r.created_at)), 0);
    const n = Math.max(1, rows.filter(r => r.sender === m.sender && Date.parse(r.created_at) > lastReply).length);

    const request = th.state === 'pending' && th.opener === m.sender;
    let text = request ? '' : String(m.body || '');
    if (text) {
      if (GUARD_WAIT_MS > 0) await new Promise(r => setTimeout(r, GUARD_WAIT_MS));
      const { data: h } = await db.from('dm_messages').select('hidden').eq('id', id).maybeSingle();
      if (!h || h.hidden) text = '';   // ถูกซ่อน/ถูกลบไปแล้ว = ไม่โชว์เนื้อ
    }

    const { data: pr } = await db.from('profiles').select('display_name').eq('id', m.sender).maybeSingle();
    const card = dmCard(String(pr?.display_name || ''), n, { image: !!m.image, request, text });

    // TTL 3 ชม. เท่ากับเรื่องสังคมใน send-reminders · ส่งไม่ถึงในเวลานั้น = ข้อความเก่าไปแล้ว
    const sent = await pushToUser(db, to, { ...card, tag: 'dm-' + m.thread, url: './' },
      { urgency: 'high', TTL: 3 * 3600 });

    // ไม่มีเครื่องไหนรับได้ = คืนคีย์ ให้รอบ 30 นาทีลองอีกทีหลังเครื่องลงทะเบียนใหม่
    if (!sent) await db.from('push_sent').delete().eq('user_id', to).eq('task_id', key);
    return json({ ok: true, sent });
  } catch (e) {
    return json({ ok: false, error: (e as Error)?.message || String(e) }, 500);
  }
});
