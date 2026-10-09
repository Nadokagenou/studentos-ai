// Student OS — ปุ่มลัดเพิ่มงานจากตัวเครื่อง (ทางของ iPhone)
// ============================================================
// แตะหลังเครื่อง 2 ครั้ง → คำสั่งลัดเด้งช่องพิมพ์ → ยิงข้อความมาที่นี่ → หย่อนลง inbox_items
// แล้วแอปดึงไปแกะเองตอนเปิดครั้งถัดไป (linelink.js · pullInbox) — ทางเดียวกับงานจาก LINE
//
// ทำไมไม่ส่งเข้าแอปตรง ๆ: บน iPhone แอปที่เพิ่มลงจอโฮมเก็บข้อมูลแยกจาก Safari
// คำสั่งลัดเปิดลิงก์ได้แค่ใน Safari งานจึงไปตกผิดที่ · ทางเซิร์ฟเวอร์คือทางเดียวที่ถึงแอปจริง
//
// ไม่แกะข้อความที่นี่โดยตั้งใจ (เหตุผลเดียวกับ line-webhook): ตัวแกะ/จับซ้ำ/ความมั่นใจ
// ต้องมีที่เดียวคือในแอป · ที่นี่จดแค่ "พิมพ์เมื่อไหร่" (meta.sentAt) ให้แอปนับ "พรุ่งนี้" ถูกวัน
//
// ด่านความปลอดภัย (verify_jwt = false เพราะคำสั่งลัดไม่มี JWT — ดู config.toml):
//   กุญแจส่วนตัวที่แอปสร้าง · เทียบด้วยแฮชในตาราง quick_keys
//   กุญแจทำได้อย่างเดียวคือหย่อนข้อความลงกล่องเข้าของเจ้าของ ไม่มีทางอ่านอะไรกลับไปได้
//   จำกัด 30 ครั้งต่อชั่วโมงต่อบัญชี กันคำสั่งลัดวนลูปหรือกุญแจหลุดแล้วโดนยิงรัว
//
// สัญญา:
//   POST /functions/v1/quick-add?k=<กุญแจ>
//   body: JSON { "text": "..." } · หรือฟอร์ม text=... · หรือข้อความล้วน
//   (กุญแจส่งใน body { "key" } หรือหัว x-quick-key ก็ได้)
//   คืนข้อความล้วนภาษาไทยสั้น ๆ — คำสั่งลัดเอาไปโชว์ในแจ้งเตือนได้เลยโดยไม่ต้องแกะ JSON
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY);

const MAX_CHARS = 1000;       // งานหนึ่งชิ้นจากปุ่มลัดไม่ยาวกว่านี้ · ยาวกว่าคือมีอะไรผิดปกติ
const PER_HOUR = 30;
const KEY_RE = /^[A-Za-z0-9_-]{24,64}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-quick-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (msg: string, status = 200) =>
  new Response(msg, { status, headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8' } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// คำสั่งลัดส่ง body ได้หลายแบบ แล้วแต่คนตั้ง — รับทุกแบบที่ตั้งผิดได้ง่าย
async function readBody(req: Request): Promise<{ text: string; key: string }> {
  const type = req.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) {
      const o = await req.json();
      return { text: String(o?.text ?? o?.t ?? ''), key: String(o?.key ?? o?.k ?? '') };
    }
    if (type.includes('form')) {
      const f = await req.formData();
      return { text: String(f.get('text') ?? f.get('t') ?? ''), key: String(f.get('key') ?? f.get('k') ?? '') };
    }
    return { text: await req.text(), key: '' };
  } catch {
    return { text: '', key: '' };
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply('ใช้ POST', 405);

  const url = new URL(req.url);
  const body = await readBody(req);
  const key = (url.searchParams.get('k') || req.headers.get('x-quick-key') || body.key || '').trim();
  if (!KEY_RE.test(key)) return reply('ลิงก์ไม่ถูกต้อง — คัดลอกใหม่จากแอป', 401);

  const { data: row, error: keyErr } = await db.from('quick_keys')
    .select('user_id').eq('key_hash', await sha256(key)).maybeSingle();
  if (keyErr) return reply('เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง', 500);
  // กุญแจถูกสร้างใหม่ในแอปแล้ว (ดอกเดิมตาย) หรือบัญชีถูกลบ
  if (!row) return reply('ลิงก์นี้ใช้ไม่ได้แล้ว — คัดลอกใหม่จากแอป', 401);

  const text = body.text.replace(/\r\n?/g, '\n').trim().slice(0, MAX_CHARS);
  if (!text) return reply('ยังไม่ได้พิมพ์งาน', 400);

  const since = new Date(Date.now() - 3.6e6).toISOString();
  const { count } = await db.from('inbox_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', row.user_id).eq('source', 'quick').gte('created_at', since);
  if ((count ?? 0) >= PER_HOUR) return reply('เพิ่มเยอะเกินไปในชั่วโมงนี้ ลองใหม่ภายหลัง', 429);

  const { error } = await db.from('inbox_items').insert({
    user_id: row.user_id, source: 'quick', raw: text,
    meta: { via: 'shortcut', sentAt: new Date().toISOString() },
  });
  if (error) return reply('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', 500);

  // ไม่รอผล — แค่บอกว่ากุญแจยังมีคนใช้อยู่ ไม่ใช่เรื่องที่ควรทำให้การเพิ่มงานล้ม
  db.from('quick_keys').update({ last_used_at: new Date().toISOString() }).eq('user_id', row.user_id).then(() => {});

  return reply('เพิ่มแล้ว · ' + (text.length > 40 ? text.slice(0, 39) + '…' : text));
});
