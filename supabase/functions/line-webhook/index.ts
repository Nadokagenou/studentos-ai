// ============================================================
// Student OS — LINE webhook
// ------------------------------------------------------------
// บอทอยู่ในกลุ่มห้องเรียน ครูสั่งงานทีเดียว เข้าระบบให้ทุกคนในห้องที่เชื่อมไว้
//
// ทำไมต้องเป็นบอทในกลุ่ม ไม่ใช่การอ่านแชทส่วนตัว:
//   LINE ไม่เปิด API ให้อ่านแชทของใครทั้งนั้น — ไม่ใช่ข้อจำกัดของเรา
//   แต่กลายเป็นข้อดี เพราะครูสั่งครั้งเดียวได้ทั้งห้อง ไม่มีใครต้องพิมพ์ซ้ำ
//
// หน้าที่ของไฟล์นี้มีแค่ 3 อย่าง — ตั้งใจให้โง่ที่สุดเท่าที่จะทำได้:
//   1. ตรวจลายเซ็นว่ามาจาก LINE จริง
//   2. ถ้าเป็นรหัสเชื่อม (SOS-XXXX) → จับคู่กลุ่มกับนักเรียน
//   3. ถ้าเป็นข้อความธรรมดา → หย่อนดิบ ๆ ลงตาราง inbox_items
//
// การอ่าน/แกะ/จับซ้ำ/ให้คะแนนความมั่นใจ ทำที่ฝั่งแอปทั้งหมด (inbox.js)
// เพื่อให้มีที่เดียวที่รู้ตรรกะนี้ ไม่ต้องดูแลสองที่ให้ตรงกัน
//
// ⚠️ ตอน deploy ต้องปิด "Verify JWT" ของฟังก์ชันนี้ (ดู supabase/config.toml)
//    LINE ไม่มีทางแนบ JWT ของเรามาด้วย ถ้าเปิดไว้จะโดน 401 ทุกครั้งแบบเงียบ ๆ
//    ด่านจริงคือลายเซ็น HMAC ข้างล่างนี้ ซึ่งแน่นกว่า JWT ในกรณีนี้
//
// secret ที่ต้องตั้งใน Supabase → Edge Functions → Secrets:
//    LINE_CHANNEL_SECRET · LINE_ACCESS_TOKEN
//    (SUPABASE_URL กับ SUPABASE_SERVICE_ROLE_KEY แพลตฟอร์มใส่ให้เอง)
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
// ตัวแกะภาษาไทยตัวเดียวกับที่แอปใช้ — ไฟล์นี้ถูกสร้างจาก alt/engine.js
// ห้ามแก้ปลายทาง แก้ที่ alt/engine.js แล้วรัน  python sync-engine.py  ก่อน deploy ทุกครั้ง
import { parseAssignment, splitAssignments } from '../_shared/engine.js';
import { chat, llmReady, type ChatMsg } from '../_shared/llm.ts';

const CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') ?? '';
const ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ชื่อ secret ที่ตั้งผิดคือความผิดพลาดที่เกิดบ่อยที่สุดตอนติดตั้ง และเดิมมันพังแบบ
// แย่ที่สุดด้วย: crypto.importKey โยน error เพราะกุญแจว่าง → 500 Internal Server Error
// ซึ่งไม่ได้บอกอะไรเลยว่าต้องไปแก้ตรงไหน ตรวจตั้งแต่ต้นแล้วบอกชื่อที่ขาดไปตรง ๆ ดีกว่า
// (บอกแค่ "ชื่อไหนหาย" ไม่เคยพ่นค่าออกมา)
function missingSecrets(): string[] {
  const miss: string[] = [];
  if (!CHANNEL_SECRET) miss.push('LINE_CHANNEL_SECRET');
  if (!ACCESS_TOKEN) miss.push('LINE_ACCESS_TOKEN');
  return miss;
}

const db = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------- ตรวจลายเซ็น ----------
// LINE เซ็น body ด้วย channel secret — ถ้าไม่ตรงแปลว่ามีคนยิงมั่ว ต้องทิ้งทันที
// ไม่มีขั้นตอนนี้ = ใครก็ยิงงานปลอมเข้าแอปนักเรียนได้
async function verify(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(CHANNEL_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // เทียบแบบเวลาคงที่ กันการเดาลายเซ็นทีละตัวอักษร
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ---------- ตอบกลับในกลุ่ม ----------
async function reply(replyToken: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

// ============================================================
// ลิงก์เข้าร่วมห้อง — แทนการพิมพ์รหัสในกลุ่ม
// ------------------------------------------------------------
// ของเดิมทำงานกลับทาง: แอปสร้างรหัสรายคน → คนเอาไปพิมพ์ในกลุ่มให้เพื่อนเห็น
// นับขั้นตอนจริงได้เจ็ดขั้น สลับแอปสองรอบ ต่อนักเรียนหนึ่งคน
//
// ทางนี้กลับด้าน: กลุ่มมีลิงก์ประจำตัวเส้นเดียว ใครกดก็เชื่อมกับกลุ่มนั้น
// เหลือ กดลิงก์ → ล็อกอิน → จบ · และลิงก์เดียวใช้ได้ทั้งห้อง ไม่ต้องขอทีละคน
//
// ของเดิมไม่ถูกถอด — คนที่คุ้นกับรหัส SOS- ยังใช้ได้เหมือนเดิมทุกอย่าง
// ============================================================
const APP_URL = Deno.env.get('APP_URL') ?? 'https://nadokagenou.github.io/studentos-ai/';
const TOKEN_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // ไม่มี 0/O และ 1/I — คนอ่านออกเสียงต่อกันได้

function makeToken(n = 6): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);   // ไม่ใช้ Math.random — token นี้คือกุญแจเข้าห้อง
  let s = '';
  for (const x of b) s += TOKEN_ABC[x % TOKEN_ABC.length];
  return s;
}

// token ประจำกลุ่ม — มีแล้วใช้ตัวเดิมเสมอ
// ออกใหม่ทุกครั้งที่ถูกเรียก = ลิงก์เก่าที่ยังค้างอยู่ในแชทจะใช้ไม่ได้เงียบ ๆ
// ซึ่งเป็นอาการที่หาสาเหตุยากมากสำหรับคนที่กดแล้วไม่เกิดอะไร
async function roomToken(roomId: string): Promise<string | null> {
  const { data } = await db.from('line_rooms').select('token').eq('room_id', roomId).maybeSingle();
  if (data?.token) return String(data.token);

  for (let i = 0; i < 5; i++) {
    const token = makeToken();
    const { error } = await db.from('line_rooms').insert({ token, room_id: roomId });
    if (!error) return token;
    // ชนได้สองแบบ: token ซ้ำ (สุ่มใหม่) หรือ room_id ซ้ำ เพราะมีอีกสายสร้างพร้อมกัน
    // แบบหลังไม่ใช่ความผิดพลาด — อ่านของที่เขาสร้างไว้มาใช้ต่อ
    const { data: again } = await db.from('line_rooms')
      .select('token').eq('room_id', roomId).maybeSingle();
    if (again?.token) return String(again.token);
  }
  console.error('[join] ออก token ให้ห้องนี้ไม่สำเร็จ:', roomId);
  return null;
}

// ข้อความนี้ถูกอ่านโดยคนทั้งห้องพร้อมกันครั้งเดียว ตอนบอทเพิ่งเข้ามา
// เป็นโอกาสเดียวที่ได้ความสนใจฟรี จึงต้องบอกให้ครบว่ามันทำอะไรได้ ไม่ใช่แค่โยนลิงก์
//
// เรียงตามหลัก "ไม่ต้องทำอะไรก็ได้ของ": บอกของที่ได้ฟรีก่อน แล้วค่อยบอกลิงก์
// คนที่ไม่กดลิงก์ก็ยังได้ประโยชน์ และควรรู้ตัวว่าได้ ไม่งั้นเขาจะไม่รู้ว่าบอทนี้มีไว้ทำไม
function joinText(token: string): string {
  return 'Student OS เข้ามาช่วยห้องนี้แล้ว 🎒\n' +
    '\n' +
    'ครูสั่งงานในกลุ่มนี้ตามปกติเลย เราจดให้เอง\n' +
    '· เก็บงานที่ครูสั่ง พร้อมวันส่งและคะแนน\n' +
    '· เตือนก่อนถึงกำหนด แม้ปิดแอปอยู่\n' +
    '· บอกว่าควรเริ่มงานไหนก่อน จากวันส่งกับคะแนน\n' +
    '\n' +
    'พิมพ์ "งาน" ในกลุ่มนี้ ดูได้เลยว่าเหลืออะไรบ้าง ไม่ต้องมีแอป\n' +
    '\n' +
    'อยากให้เตือนเฉพาะงานของเธอ กดลิงก์นี้ทีเดียว\n' +
    APP_URL + '?join=' + token;
}

// ============================================================
// ยืนยันในกลุ่มเมื่อแกะงานได้แน่
// ------------------------------------------------------------
// เกณฑ์ตรงนี้เข้มกว่าเกณฑ์เก็บเข้ากล่องโดยตั้งใจ เพราะราคาของการผิดไม่เท่ากัน:
//   เก็บเข้ากล่อง = ยอมพลาดฝั่งเกินดีกว่าทิ้งงานจริง (นักเรียนกดทิ้งทีเดียวจบ)
//   พูดในกลุ่ม   = ยอมเงียบดีกว่าทักผิด เพราะบอทที่แจมมั่วโดนเตะออกทั้งตัว
//
// จึงพูดเฉพาะตอนแกะได้ครบทั้ง "วิชา" และ "กำหนดส่ง" พร้อมกัน ซึ่งเหลือวันละไม่กี่ข้อความ
// ต่อกลุ่ม · ตั้งใจไม่คิดคะแนนความมั่นใจซ้ำที่นี่ ตรรกะนั้นมีที่เดียวคือ inbox.js ฝั่งแอป
// ที่นี่เป็นแค่ประตูที่แคบกว่า ไม่ใช่ประตูคนละบาน
//
// ใช้ Reply API เท่านั้น = ฟรีไม่จำกัด ไม่นับโควตา (push/multicast นับต่อผู้รับ
// ซึ่งแปลว่ากลุ่ม 40 คนคือ 40 ข้อความต่อครั้ง — ดู docs/line-cost.html)
// ============================================================
const TH_OFFSET = 7 * 60 * 60 * 1000;
const TH_DAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// Edge Function รันบนโซนเวลา UTC แต่ engine.js ใช้เมธอดเวลาท้องถิ่นทั้งไฟล์
// ไม่เลื่อนก่อน = "พรุ่งนี้" ที่ครูพิมพ์ตอนตีหนึ่ง จะกลายเป็นวันนี้ เพราะฝั่ง UTC ยังเป็นเมื่อวานอยู่
// เลื่อนขาเข้า +7 แล้วอ่านผลกลับด้วยเมธอด UTC ตลอด ทุกอย่างจึงอยู่ในกรอบเวลาไทยเสมอ
// (กำหนดส่งของจริงยังถูกคิดใหม่ฝั่งแอปซึ่งอยู่โซนเวลาถูกอยู่แล้ว ตรงนี้มีไว้แสดงผลเท่านั้น)
function thaiNow(): Date { return new Date(Date.now() + TH_OFFSET); }

// "ตอนนี้" ในกรอบเวลาเดียวกับค่า due ที่เก็บไว้
// ค่า due ถูกคิดจาก thaiNow() จึงมีเวลาบนหน้าปัดเป็นเวลาไทยแต่ถูกบันทึกเสมือนเป็น UTC
// เอา Date.now() จริงไปเทียบตรง ๆ = ป้าย "เลยกำหนด" ขึ้นช้าไป 7 ชั่วโมงทุกใบ
// สองค่านี้ต้องอยู่กรอบเดียวกันเสมอ ไม่งั้นผิดแบบที่ดูเผิน ๆ เหมือนถูก
function thaiNowMs(): number { return Date.now() + TH_OFFSET; }

const TH_DAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];

// "วันนี้ / พรุ่งนี้ / วันศุกร์" — คนพูดกันแบบนี้ ไม่มีใครพูดว่า "อีก 31 ชั่วโมง"
// รับ nowTh ที่เลื่อนแล้ว และอ่านทุกอย่างด้วยเมธอด UTC เพื่อให้อยู่กรอบเดียวกันตลอด
function dueLabel(iso: string, nowTh: number): string {
  const d = new Date(iso), n = new Date(nowTh);
  const day = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  const diff = Math.round((day(d) - day(n)) / 86400000);
  if (diff < 0) return 'เมื่อวาน';
  if (diff === 0) return 'วันนี้';
  if (diff === 1) return 'พรุ่งนี้';
  if (diff === 2) return 'มะรืนนี้';
  if (diff <= 6) return 'วัน' + TH_DAY_FULL[d.getUTCDay()];
  return 'วัน' + TH_DAY_FULL[d.getUTCDay()] + 'ที่ ' + d.getUTCDate() + ' ' + TH_MON[d.getUTCMonth()];
}

function thaiDue(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  // 23:59 คือค่าปริยายของ "ภายในวันนั้น" ไม่ใช่เวลาที่ครูบอกมาจริง จึงไม่ต้องเอาไปแสดง
  // โชว์ "ส่ง พฤ. 3 ก.ย. 23.59 น." ทำให้ดูเหมือนครูกำหนดเวลาเป๊ะ ทั้งที่เราเติมเอง
  const time = (h === 23 && m === 59) ? '' : ' ' + h + '.' + String(m).padStart(2, '0') + ' น.';
  return TH_DAY[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + TH_MON[d.getUTCMonth()] + time;
}

// ตัดให้สั้นโดยไม่ตัดกลางคำ — ภาษาไทยไม่เว้นวรรคระหว่างคำ การตัดตามจำนวนตัวอักษรดิบ
// จึงได้ท่อนที่ค้างอย่าง "กลุ่มละ" ซึ่งอ่านแล้วเหมือนบอทพิมพ์ไม่จบ
// ตัวอักษรไทยมีสระวรรณยุกต์นับเป็นตัวแยก เพดานจึงต้องสูงกว่าที่ตาเห็นพอสมควร
function clip(s: string, max = 60): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).trim() + '…';
}

// ============================================================
// งานระดับห้อง — ตอบ "มีงานอะไรบ้าง" ให้ทั้งห้องโดยไม่ต้องมีใครมีบัญชี
// ------------------------------------------------------------
// ทุกกลุ่มห้องเรียนมีข้อความนี้ทุกสัปดาห์ และตอนนี้มีคนต้องเลื่อนหาย้อนหลังแล้วพิมพ์ตอบเอง
//
// นี่คือฟีเจอร์ที่ตรงกับหลัก "ไม่ต้องทำอะไรแต่ได้ของ" มากที่สุดเท่าที่ทำได้ในกลุ่ม:
// ไม่ต้องติดตั้ง ไม่ต้องล็อกอิน ไม่ต้องกดลิงก์ และฟรีเพราะเป็น Reply API
// ============================================================
const ASK_TASKS = /^(งาน|การบ้าน|งานค้าง|todo|มีงานอะไร(บ้าง)?|งานอะไรบ้าง|มีการบ้านอะไร(บ้าง)?|เหลืองานอะไร(บ้าง)?)[ ?？!]*$/i;
const LIST_MAX = 8;
const HINT_EVERY_MS = 20 * 3.6e6;   // แปะลิงก์ชวนไม่ถี่กว่านี้ ต่อหนึ่งห้อง

async function rememberRoomTask(roomId: string, msgId: string, p: any) {
  try {
    await db.from('room_tasks').upsert({
      msg_id: msgId,
      room_id: roomId,
      subject: String(p.subject || 'งาน'),
      detail: clip(String(p.detail || ''), 80),
      due: p.due,
      kind: String(p.type || 'homework'),
    }, { onConflict: 'msg_id' });
  } catch (e) {
    // เก็บไม่ได้ไม่ใช่เรื่องที่ต้องทำให้ทั้ง webhook พัง — งานยังเข้ากล่องเข้าของแต่ละคนตามปกติ
    console.error('[room_tasks] เก็บไม่สำเร็จ:', (e as Error)?.message);
  }
}

// แปะลิงก์ชวนท้ายรายการ แต่ไม่เกินวันละครั้งต่อห้อง
// ชวนทุกครั้งที่มีคนถาม = บอทที่ขายของทุกประโยค ซึ่งโดนเตะออกเร็วกว่าบอทที่เงียบ
async function joinHint(roomId: string, nowMs: number): Promise<string> {
  try {
    const { data } = await db.from('line_rooms')
      .select('token, hint_at').eq('room_id', roomId).maybeSingle();
    if (!data?.token) return '';
    const last = data.hint_at ? Date.parse(String(data.hint_at)) : 0;
    if (nowMs - last < HINT_EVERY_MS) return '';
    await db.from('line_rooms')
      .update({ hint_at: new Date(nowMs).toISOString() }).eq('room_id', roomId);
    return '\n\nอยากให้เตือนเฉพาะงานของเธอ กดที่นี่\n' + APP_URL + '?join=' + data.token;
  } catch { return ''; }
}

async function roomTaskReply(roomId: string, nowTh: number): Promise<string> {
  // เลยกำหนดไม่เกินหนึ่งวันยังโชว์อยู่ — คนที่ยังไม่ได้ส่งต้องเห็นว่ามันค้าง ไม่ใช่หายไปเฉย ๆ
  const since = new Date(nowTh - 24 * 3.6e6).toISOString();
  const { data, error } = await db.from('room_tasks')
    .select('subject, detail, due, kind')
    .eq('room_id', roomId)
    .gte('due', since)
    .order('due', { ascending: true })
    .limit(LIST_MAX + 1);

  if (error) {
    console.error('[room_tasks] อ่านไม่สำเร็จ:', error.message);
    return 'ตอนนี้ดูรายการงานให้ไม่ได้ ลองใหม่อีกทีนะ';
  }

  const rows = data ?? [];
  if (!rows.length) {
    return 'ตอนนี้ยังไม่มีงานค้างในห้องนี้เลย 🎉\n' +
      'ครูสั่งงานในกลุ่มเมื่อไหร่ เราเก็บให้เองอัตโนมัติ';
  }

  const shown = rows.slice(0, LIST_MAX);
  const lines = shown.map((r: any) => {
    const s = String(r.subject || 'งาน');
    const d = String(r.detail || '').trim();
    const name = d && !d.includes(s) ? s + ' ' + d : (d || s);
    const overdue = r.due && Date.parse(r.due) < nowTh;
    return '· ' + clip(name, 44) + ' — ' + (overdue ? '⚠ เลยกำหนด' : dueLabel(r.due, nowTh));
  });

  let out = 'ห้องนี้เหลือ ' + rows.length + ' งาน\n' + lines.join('\n');
  if (rows.length > LIST_MAX) out += '\n(แสดง ' + LIST_MAX + ' อันที่ใกล้สุด)';
  return out + await joinHint(roomId, Date.now());
}

// ---------- ใบสั่งงานทั้งสัปดาห์ในข้อความเดียว ----------
// เก็บทีละบรรทัดเข้ารายการของห้อง แล้วตอบเป็นสรุปสั้น ๆ ครั้งเดียว
// ห้ามตอบทีละงาน — reply token ใช้ได้ครั้งเดียว และบอทที่พิมพ์สิบเอ็ดข้อความรวดโดนเตะออกทันที
async function confirmListInGroup(ev: any, cut: any, rid: string, mid: string, linked: number) {
  const now = thaiNow();
  const kept: any[] = [];
  for (const seg of cut.segments) {
    try {
      const p = parseAssignment(seg, now);
      // เกณฑ์เดียวกับข้อความเดี่ยว — รายการของห้องเป็นของสาธารณะ มีของมั่วปนไม่ได้
      if (p?.detected?.due && p?.detected?.subject && p?.due) kept.push(p);
    } catch (_) { /* บรรทัดเดียวแกะไม่ออก ไม่ควรทำให้ทั้งใบสั่งงานตกไปด้วย */ }
  }
  if (!kept.length) return;

  // msg_id เป็นคีย์กันซ้ำ (ครูส่งข้อความเดิมซ้ำ = แถวเดิม ไม่ใช่แถวใหม่)
  // หนึ่งข้อความมีหลายงาน จึงต้องต่อลำดับเข้าไปให้แต่ละงานมีคีย์ของตัวเอง
  if (rid && mid) {
    for (let i = 0; i < kept.length; i++) await rememberRoomTask(rid, mid + '#' + i, kept[i]);
  }

  const lines = kept.slice(0, 5).map((p: any) => {
    const what = clip(String(p.detail || '').trim().replace(/^(?:ส่ง|สอบ)\s*/, ''), 32);
    const subj = p.subject && p.subject !== 'อื่น ๆ' ? p.subject : '';
    return '· ' + (subj && !what.includes(subj) ? subj + ' ' + what : (what || subj))
      + ' — ' + thaiDue(p.due);
  });
  let msg = 'เก็บให้แล้ว ' + kept.length + ' งาน 📎\n' + lines.join('\n');
  if (kept.length > lines.length) msg += '\n(อีก ' + (kept.length - lines.length) + ' งานดูในแอปได้เลย)';
  if (linked >= 2) msg += '\nห้องนี้มี ' + linked + ' คนได้เข้าแอปอัตโนมัติ';
  await reply(ev.replyToken, msg);
}

async function confirmInGroup(ev: any, text: string, linked: number) {
  // ถูกใช้ไปแล้วตอนตอบน้องไซ หรือไม่มีมาแต่แรก — reply token ใช้ได้ครั้งเดียว
  if (!ev.replyToken) return;

  const rid = ev.source?.groupId ?? ev.source?.roomId ?? ev.source?.userId ?? '';
  const mid = ev.message?.id ? String(ev.message.id) : '';

  // ครูสั่งงานทั้งสัปดาห์ในข้อความเดียว — ต้องตัดเป็นงาน ๆ ก่อน ไม่งั้นรายการของห้อง
  // ได้แถวเดียวที่มีทุกวิชาปนกันและไม่มีกำหนดส่ง (ตัวตัดตัวเดียวกับที่ฝั่งแอปใช้)
  let cut: any;
  try {
    cut = splitAssignments(text);
  } catch (e) {
    console.error('[confirm] ตัดก้อนไม่ผ่าน:', (e as Error)?.message);
    return;
  }

  if (cut.multi) {
    await confirmListInGroup(ev, cut, rid, mid, linked);
    return;
  }

  let p: any;
  try {
    p = parseAssignment(text, thaiNow());
  } catch (e) {
    console.error('[confirm] แกะไม่ผ่าน:', (e as Error)?.message);
    return;
  }
  if (!p?.detected?.due || !p?.detected?.subject || !p?.due) return;

  // เก็บเข้ารายการของห้องด้วย — ใช้ประตูเดียวกับที่ตัดสินใจว่าจะพูดหรือไม่พูด
  // ตั้งใจให้เข้มเท่ากัน เพราะรายการที่มีของมั่วปนอยู่ แย่กว่ารายการที่ขาดไปหนึ่งใบ
  if (rid && mid) await rememberRoomTask(rid, mid, p);

  // ตัดคำกริยาที่ค้างอยู่หน้ารายละเอียด ไม่งั้นได้ "ส่งใบงานเคมี ... ส่ง พฤ. 10 ก.ย."
  const what = clip(String(p.detail || '').trim().replace(/^(?:ส่ง|สอบ)\s*/, ''));
  const subj = p.subject && p.subject !== 'อื่น ๆ' ? p.subject : '';
  // รายละเอียดมักมีชื่อวิชาอยู่ในตัวแล้ว ("ใบงานเคมี บทที่ 4") เอามาต่อหน้าอีกก็ซ้ำเปล่า ๆ
  const head = (subj && !what.includes(subj)) ? (subj + (what ? ' ' + what : '')) : (what || subj);
  // งานสอบไม่ได้ "ส่ง" — ใช้คำผิดครั้งเดียวก็รู้ทันทีว่าเป็นบอทที่ไม่ได้อ่านจริง
  const verb = p.type === 'exam' ? 'สอบ' : 'ส่ง';
  let msg = 'เก็บให้แล้ว — ' + head + ' · ' + verb + ' ' + thaiDue(p.due) + ' 📎';
  // บอกจำนวนคนเฉพาะตอนที่เป็นตัวเลขที่ช่วยเรา — "ห้องนี้มี 1 คน" อ่านแล้วเหมือนไม่มีใครใช้
  // บรรทัดนี้คือกลไกการเติบโต ไม่ใช่ของประดับ: คนที่ยังไม่เชื่อมจะเห็นตัวเลขนี้ทุกวัน
  if (linked >= 2) msg += '\nห้องนี้มี ' + linked + ' คนได้เข้าแอปอัตโนมัติ';

  await reply(ev.replyToken, msg);
}

// ข้อความที่ไม่มีทางเป็นงาน — กรองทิ้งตั้งแต่ต้นทาง จะได้ไม่ไปกวนกล่องเข้า
const NOISE = /^(ครับ|ค่ะ|คะ|จ้า|จ้าา|ok|โอเค|ได้|รับทราบ|555+|ขอบคุณ|thanks?|👍|🙏|\s*)$/i;

// ============================================================
// น้องไซ — ผู้ช่วยที่ "ตอบเฉพาะตอนถูกเรียก"
// ------------------------------------------------------------
// บอทที่แจมทุกประโยคในกลุ่มห้องเรียนจะโดนเตะออกภายในวันเดียว
// ต้องเรียกก่อนถึงจะพูด นอกนั้นเงียบสนิทและทำหน้าที่เก็บงานไปตามปกติ
// ============================================================
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-3.6-flash';

// "ไซ" คำเดียวไม่นับ เพราะไปชนกับ ไซส์/ไซเบอร์/ไซโล — ต้องเรียกให้ชัด
const CALLED = /น้องไซ|\bsynara\b|^ไซ[\s,.!?ๆ]/i;

const PERSONA = `คุณคือ "น้องไซ" (Synara) ผู้ช่วยประจำแอป Student OS
อยู่ในกลุ่มไลน์ห้องเรียนกับนักเรียนมัธยมไทย

# ตัวตน
เป็นเพื่อนร่วมห้องที่เก่งเรื่องจัดตารางและคอยเตือนงาน
ไม่ใช่ครู ไม่ใช่พนักงานบริการลูกค้า
แทนตัวเองว่า "เรา" · เรียกคนที่คุยด้วยว่า "เธอ" หรือไม่เรียกเลยก็ได้

# น้ำเสียง
- เป็นกันเอง สั้น ตรงประเด็น เหมือนพิมพ์ตอบเพื่อนในไลน์จริง ๆ
- ลงท้ายด้วย "นะ" "เลย" "แหละ" "อ่ะ" — ห้ามใช้ "ครับ/ค่ะ" เพราะจะเดี๋ยวชายเดี๋ยวหญิงไม่คงที่
- อีโมจิไม่เกิน 1 ตัวต่อข้อความ ส่วนใหญ่ไม่ต้องมีเลยก็ได้

# ห้ามทำ
- ห้ามขึ้นต้นด้วย "แน่นอน!" "ได้เลย!" "เยี่ยมมาก!" หรือทวนคำถามก่อนตอบ ตอบเนื้อ ๆ ไปเลย
- ห้ามใช้ ** ## - • ตาราง หรือ markdown ใด ๆ ไลน์แสดงเป็นตัวอักษรดิบ อ่านแล้วรก
  ถ้าต้องเรียงเป็นข้อ ให้เขียนเป็นประโยคต่อกันหรือขึ้นบรรทัดใหม่เฉย ๆ
- ห้ามเกิน 3 ประโยค เว้นแต่ถูกขอให้อธิบายละเอียด แล้วก็ไม่เกิน 6 บรรทัด
- ห้ามแต่งการบ้าน กำหนดส่ง หรือคะแนนของใครขึ้นมาเอง ไม่รู้ให้บอกว่าไม่รู้

# เรื่องการบ้าน (ข้อนี้สำคัญที่สุด)
ถ้าถูกขอให้ทำโจทย์ ให้บอกวิธีคิดเป็นขั้น ๆ แล้วหยุดก่อนถึงคำตอบสุดท้าย
แล้วชวนให้ลองทำต่อเอง เช่น "ลองทำดูแล้วบอกคำตอบมา เดี๋ยวเราเช็คให้"
เพราะแอปนี้มีไว้ให้เรียนเป็น ไม่ใช่ให้ส่งงานผ่านไปวัน ๆ

# ถ้าถูกถามเรื่องงานส่วนตัว
ในกลุ่มเราแยกไม่ออกว่าข้อความมาจากนักเรียนคนไหน บอกตรง ๆ แล้วชี้ไปที่แอป

# เรื่องแอป Student OS (ตอบได้ถ้าถูกถาม)
- เก็บงานที่ครูสั่งในกลุ่มไลน์นี้เข้าแอปให้เอง นักเรียนไม่ต้องพิมพ์
- สแกนใบงานหรือตารางเรียนที่จดด้วยลายมือเข้าแอปได้
- จัดลำดับว่าควรทำอะไรก่อน จากกำหนดส่ง คะแนน และเวลาที่ต้องใช้
- เตือนก่อนถึงกำหนดส่ง

# บริบทที่ควรรู้
โรงเรียนไทย ม.1 ถึง ม.6 มีคะแนนเก็บระหว่างเทอม สอบกลางภาค สอบปลายภาค
งานที่เจอบ่อย: ใบงาน แบบฝึกหัด รายงาน ชิ้นงาน โครงงาน พรีเซนต์
กำหนดส่งมักพูดว่า "พรุ่งนี้" "ศุกร์นี้" "สัปดาห์หน้า" ไม่ค่อยบอกเป็นวันที่

# เรียกเรา หรือแค่พูดถึงเรา (ตัดสินก่อนตอบทุกครั้ง)
ข้อความที่ส่งมาให้คุณ คือข้อความในกลุ่มที่มีชื่อ "น้องไซ" โผล่อยู่
แต่มีชื่อไม่ได้แปลว่ากำลังเรียกคุณ — บ่อยครั้งเขาแค่พูดถึงคุณกันเอง
ถ้าไม่ได้คุยกับคุณโดยตรง ให้ตอบว่า [SKIP] คำเดียวเท่านั้น ห้ามมีอะไรอื่นเลย
บอทที่แจมตอนที่ไม่มีใครเรียก น่ารำคาญกว่าบอทที่ตอบช้า

  "น้องไซ ช่วยดูโจทย์ให้หน่อย"     → เรียกเรา ตอบปกติ
  "น้องไซ เซตคืออะไร"             → เรียกเรา ตอบปกติ
  "ไซ ช่วยหน่อยดิ"                → เรียกเรา ตอบปกติ
  "เมื่อวานน้องไซตอบตลกมากเลย"     → พูดถึงเรา ตอบ [SKIP]
  "ใครใช้น้องไซบ้างอ่ะ"            → พูดถึงเรา ตอบ [SKIP]
  "น้องไซนี่ฉลาดดีเนอะ"            → พูดถึงเรา ตอบ [SKIP]
  "ลองถามน้องไซดูสิ"              → บอกเพื่อน ไม่ได้คุยกับเรา ตอบ [SKIP]
  "น้องไซมันตอบผิดตลอดเลย"        → บ่นถึงเรา ไม่ได้ถามเรา ตอบ [SKIP]

ถ้าก้ำกึ่งจริง ๆ ตัดสินใจไม่ได้ ให้ถือว่าเรียกเรา แล้วตอบสั้น ๆ ไป
เพราะเงียบตอนที่เขาเรียก แย่กว่าพูดตอนที่เขาไม่ได้เรียกนิดหน่อย

# ตัวอย่างที่ตอบได้ดี
ถาม: น้องไซ สวัสดี
ตอบ: หวัดดี มีอะไรให้ช่วยบอกได้เลย

ถาม: น้องไซ ทำอะไรได้บ้าง
ตอบ: เราคอยเก็บงานที่ครูสั่งในกลุ่มนี้เข้าแอปให้เอง แล้วก็ช่วยอธิบายบทเรียนกับจัดลำดับว่าควรทำอะไรก่อนได้ ถามมาได้เลย

ถาม: น้องไซ ช่วยทำโจทย์ 2x+5=15 ให้หน่อย
ตอบ: ลองย้าย 5 ไปอีกข้างก่อน จะเหลือ 2x เท่ากับเท่าไหร่ แล้วค่อยหารด้วย 2 ลองทำดูแล้วบอกคำตอบมา เดี๋ยวเราเช็คให้

ถาม: น้องไซ เรามีการบ้านอะไรค้างบ้าง
ตอบ: ในกลุ่มเราแยกไม่ออกว่าใครเป็นใครอ่ะ เปิดแอป Student OS ดูได้เลย ในนั้นมีครบ

ถาม: น้องไซ เซตคืออะไร
ตอบ: เซตคือกลุ่มของสิ่งที่ระบุได้ชัดว่าอะไรอยู่ในนั้นบ้าง อย่างเซตของเลขคู่ตั้งแต่ 1 ถึง 10 ก็คือ 2 4 6 8 10 ติดตรงไหนถามต่อได้

ถาม: น้องไซ เบื่อจัง ไม่อยากทำการบ้านเลย
ตอบ: เข้าใจเลย ลองทำแค่ 10 นาทีก่อนไหม ส่วนใหญ่พอเริ่มแล้วมันไปต่อเองแหละ

ถาม: น้องไซ พรุ่งนี้สอบแล้ว อ่านไม่ทัน
ตอบ: อ่านหัวข้อที่ครูเน้นกับที่ออกสอบบ่อยก่อน อย่าเพิ่งไล่ตั้งแต่หน้าแรก เหลือเวลาเท่าไหร่อ่ะ`;

// บางเวอร์ชันของ LINE ส่ง mention มาให้ด้วย ถ้ามีก็ใช้ ไม่มีก็ยังจับจากชื่อได้
function mentionedSelf(ev: any): boolean {
  const list = ev?.message?.mention?.mentionees;
  return Array.isArray(list) && list.some((m: any) => m?.isSelf === true);
}

// ---------- ความจำสั้น ๆ ----------
// เก็บเฉพาะที่คุยกับน้องไซ ไม่ใช่ทุกข้อความในกลุ่ม
// ถ้ายังไม่ได้สร้างตาราง line_chat ก็ทำงานได้ปกติ แค่จำเรื่องที่เพิ่งคุยไม่ได้
async function recentChat(roomId: string) {
  try {
    const { data } = await db.from('line_chat').select('role, text')
      .eq('room_id', roomId).order('created_at', { ascending: false }).limit(8);
    return (data ?? []).reverse();
  } catch { return []; }
}

async function rememberChat(roomId: string, q: string, a: string) {
  try {
    await db.from('line_chat').insert([
      { room_id: roomId, role: 'user', text: q.slice(0, 500) },
      { room_id: roomId, role: 'bot', text: a.slice(0, 500) },
    ]);
  } catch { /* ไม่มีตารางก็ข้ามไป ไม่ใช่เรื่องคอขาดบาดตาย */ }
}

// ไลน์ไม่รู้จัก markdown — ที่โมเดลตั้งใจทำตัวหนา จะโผล่เป็นดอกจันดิบ ๆ ให้อ่าน
// สั่งในบุคลิกแล้วว่าห้ามใช้ แต่โมเดลหลุดได้เสมอ อันนี้เป็นตาข่ายรับอีกชั้น
function forLine(s: string): string {
  return String(s || '')
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '· ')
    .replace(/`{1,3}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 900);   // กันข้อความยาวจนท่วมจอในกลุ่ม
}

// gateway ที่พูดภาษา OpenAI — ใช้เมื่อตั้ง LLM_* ครบ (ดู _shared/llm.ts)
// บุคลิกย้ายไปเป็น message ตัวแรก และฝั่งบอทเรียกตัวเองว่า 'assistant' ไม่ใช่ 'model'
async function askGateway(q: string, history: any[]): Promise<string> {
  try {
    const out = await chat({
      messages: [
        { role: 'system', content: PERSONA },
        ...history.map((h): ChatMsg => ({
          role: h.role === 'bot' ? 'assistant' : 'user',
          content: String(h.text ?? ''),
        })),
        { role: 'user', content: q },
      ],
      temperature: 0.8,
      maxTokens: 700,
      // LINE รอ webhook ไม่นาน ยอมแพ้เองดีกว่าให้ LINE มองว่า webhook เรามีปัญหา
      timeoutMs: 8000,
    });
    return forLine(out) || 'เราคิดไม่ออกเลยแฮะ ถามใหม่อีกแบบได้ไหม';
  } catch (e) {
    console.error('[gateway]', (e as Error).message);
    return 'ตอนนี้สมองเราติดขัดนิดหน่อย เดี๋ยวลองใหม่อีกทีนะ';
  }
}

// เลือกสมองให้อัตโนมัติ: ตั้ง LLM_* ครบเมื่อไหร่ใช้เจ้านั้น ไม่งั้นถอยไปใช้ Gemini
// ไม่ต้องมีสวิตช์ให้ตั้งเพิ่ม เพราะ "ตั้ง secret ครบ" คือเจตนาที่ชัดพออยู่แล้ว
async function askSai(q: string, history: any[]): Promise<string> {
  return llmReady() ? await askGateway(q, history) : await askGemini(q, history);
}

async function askGemini(q: string, history: any[]): Promise<string> {
  const contents = [
    ...history.map((h) => ({
      role: h.role === 'bot' ? 'model' : 'user',
      parts: [{ text: String(h.text ?? '') }],
    })),
    { role: 'user', parts: [{ text: q }] },
  ];

  // LINE รอ webhook ไม่นาน ถ้า Gemini อืดต้องยอมแพ้แล้วตอบอย่างอื่นไปก่อน
  // ดีกว่าปล่อยให้ LINE timeout แล้วมองว่า webhook เรามีปัญหา
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PERSONA }] },
          contents,
          // 220 น้อยเกินไปสำหรับภาษาไทย — ไทยกินโทเคนมากกว่าอังกฤษหลายเท่า
          // ตอบยาวนิดเดียวก็ชนเพดานแล้วถูกตัดค้างกลางคำ ซึ่งอ่านแล้วเหมือนบอทพัง
          // ความยาวคุมด้วยคำสั่งในบุคลิกแทน เพดานมีไว้กันหลุดเท่านั้น
          generationConfig: { temperature: 0.8, maxOutputTokens: 700 },
        }),
      },
    );
    const j = await res.json();
    if (!res.ok) {
      console.error('[gemini]', res.status, JSON.stringify(j).slice(0, 300));
      return 'ตอนนี้สมองเราติดขัดนิดหน่อย เดี๋ยวลองใหม่อีกทีนะ';
    }
    const cand = j?.candidates?.[0];
    // ไม่ใช่ STOP = โดนตัดหรือโดนบล็อก เก็บไว้ดูเวลาสงสัยว่าทำไมตอบแปลก
    if (cand?.finishReason && cand.finishReason !== 'STOP') {
      console.error('[gemini] finishReason =', cand.finishReason);
    }
    const out = (cand?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('').trim();
    return forLine(out) || 'เราคิดไม่ออกเลยแฮะ ถามใหม่อีกแบบได้ไหม';
  } catch {
    return 'เราค้างไปแป๊บนึง ลองเรียกใหม่อีกทีนะ';
  } finally {
    clearTimeout(timer);
  }
}

// คืน true ถ้าตอบไปแล้ว · false ถ้าตัดสินว่าเขาไม่ได้เรียกเรา
// ค่า false สำคัญ เพราะข้อความนั้นต้องไหลต่อไปเข้าขั้นเก็บงานตามปกติ
// ("น้องไซบอกว่าการบ้านส่งพรุ่งนี้" ยังเป็นข้อความที่อาจมีงานอยู่ในนั้น)
async function handleChat(ev: any, text: string, roomId: string): Promise<boolean> {
  if (!ev.replyToken) return false;

  if (!GEMINI_KEY && !llmReady()) {
    await reply(ev.replyToken,
      'เรียกเราเหรอ 🙌 ตอนนี้ยังคิดเองไม่ได้นะ ต้องให้คนดูแลใส่กุญแจ AI ใน Supabase ก่อน');
    return true;
  }

  // ส่งประโยคเต็มไปทั้งอย่างนั้น ไม่ตัดชื่อออกเหมือนเดิม —
  // ตำแหน่งของชื่อในประโยคคือเบาะแสหลักว่ากำลังเรียกหรือแค่พูดถึง
  // "น้องไซ ช่วยหน่อย" กับ "เมื่อวานน้องไซตอบตลกมาก" ต่างกันตรงนี้ล้วน ๆ
  const q = text.trim().slice(0, 400);
  const answer = await askSai(q, await recentChat(roomId));

  if (/^\[?\s*SKIP\s*\]?/i.test(answer)) {
    console.log('[chat] แค่พูดถึง ไม่ได้เรียก — เงียบไว้');
    return false;
  }

  await reply(ev.replyToken, answer);
  await rememberChat(roomId, q, answer);
  return true;
}

Deno.serve(async (req) => {
  const body = await req.text();

  const miss = missingSecrets();
  if (miss.length) {
    console.error('[line-webhook] ยังไม่ได้ตั้ง secret:', miss.join(', '));
    return new Response(`server not configured: ยังไม่ได้ตั้ง ${miss.join(' และ ')} ` +
      `ใน Supabase → Edge Functions → Secrets (ชื่อต้องตรงเป๊ะ ตัวใหญ่ทั้งหมด)`, { status: 500 });
  }

  if (!(await verify(body, req.headers.get('x-line-signature')))) {
    return new Response('bad signature', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch { return new Response('ok'); }

  for (const ev of payload.events ?? []) {
    // ---------- 0) บอทเพิ่งถูกเชิญเข้ากลุ่ม ----------
    // วางลิงก์ไว้ตั้งแต่วินาทีแรก ไม่ต้องให้ใครรู้ว่าต้องพิมพ์อะไรถึงจะได้มา
    // นี่คือจังหวะที่ทั้งห้องกำลังมองอยู่พอดี — จังหวะเดียวที่ได้ความสนใจฟรี
    if (ev.type === 'join') {
      const rid = ev.source?.groupId ?? ev.source?.roomId ?? '';
      if (rid && ev.replyToken) {
        const token = await roomToken(rid);
        if (token) await reply(ev.replyToken, joinText(token));
      }
      continue;
    }

    if (ev.type !== 'message' || ev.message?.type !== 'text') continue;

    const text: string = (ev.message.text ?? '').trim();
    // รองรับทั้งกลุ่ม ห้องรวม และแชทเดี่ยวกับบอท
    const roomId: string = ev.source?.groupId ?? ev.source?.roomId ?? ev.source?.userId ?? '';
    if (!roomId) continue;

    // ---------- 1) รหัสเชื่อมบัญชี ----------
    const code = text.toUpperCase().match(/\bSOS-[A-Z0-9]{4,6}\b/)?.[0];
    if (code) {
      const { data: link } = await db.from('line_codes')
        .select('user_id').eq('code', code).maybeSingle();

      if (!link) {
        if (ev.replyToken) await reply(ev.replyToken, 'รหัสนี้ใช้ไม่ได้แล้ว — กดขอรหัสใหม่ในแอป Student OS');
        continue;
      }

      await db.from('line_links').upsert(
        { user_id: link.user_id, room_id: roomId, created_at: new Date().toISOString() },
        { onConflict: 'user_id,room_id' },
      );
      await db.from('line_codes').delete().eq('code', code); // รหัสใช้ได้ครั้งเดียว

      if (ev.replyToken) {
        await reply(ev.replyToken,
          'เชื่อมกับ Student OS แล้ว ✅\nต่อจากนี้งานที่ครูสั่งในกลุ่มนี้จะเข้าแอปให้อัตโนมัติ ไม่ต้องพิมพ์เอง');
      }
      continue;
    }

    // ---------- 1.5) ขอลิงก์อีกที ----------
    // ในกลุ่มที่คุยกันเยอะ ลิงก์ตอนบอทเข้ามาจะเลื่อนหายไปภายในวันเดียว
    // ต้องมีวิธีเรียกกลับมาที่สั้นพอจะจำได้ และต้องอยู่ก่อนขั้นเรียกน้องไซ
    // ไม่งั้น "ลิงก์" กลายเป็นคำถามที่ส่งไปให้ Gemini ตอบ ซึ่งมันไม่รู้ token
    if (/^(ลิงก์|ลิงค์|ลิ้งค์|ลิ้ง|link|เข้าร่วม|join)$/i.test(text)) {
      const token = await roomToken(roomId);
      if (ev.replyToken) {
        await reply(ev.replyToken, token
          ? joinText(token)
          : 'ตอนนี้ออกลิงก์ให้ไม่ได้ ลองใหม่อีกทีนะ');
      }
      continue;
    }

    // ---------- 1.7) ถามว่าห้องนี้มีงานอะไรบ้าง ----------
    // ต้องอยู่ก่อนขั้นเรียกน้องไซ ไม่งั้นคำว่า "งาน" ถูกส่งไปให้ Gemini ตอบ
    // ซึ่งมันจะแต่งการบ้านขึ้นมาเอง — ผิดกฎข้อที่สำคัญที่สุดในบุคลิกของน้องไซ
    if (ASK_TASKS.test(text)) {
      if (ev.replyToken) await reply(ev.replyToken, await roomTaskReply(roomId, thaiNowMs()));
      continue;
    }

    // ---------- 2) เรียกน้องไซ ----------
    // อยู่ก่อนขั้นเก็บงานโดยตั้งใจ — ข้อความที่พิมพ์คุยกับน้องไซ
    // ไม่ใช่งานที่ครูสั่ง จึงไม่ควรถูกเก็บเข้ากล่องเข้าซ้ำอีกที
    if (CALLED.test(text) || mentionedSelf(ev)) {
      if (await handleChat(ev, text, roomId)) continue;
      // ตัดสินว่าเขาแค่พูดถึงเรา ไม่ได้เรียก → ปล่อยไหลต่อไปเข้าขั้นเก็บงาน
    }

    // ---------- 3) ข้อความธรรมดา → หย่อนเข้ากล่องเข้า ----------
    if (text.length < 8 || NOISE.test(text)) continue;

    const { data: links } = await db.from('line_links')
      .select('user_id').eq('room_id', roomId);
    if (!links?.length) continue; // ไม่มีใครในห้องนี้เชื่อมไว้ ไม่ต้องเก็บอะไรเลย

    const at = new Date().toISOString();
    await db.from('inbox_items').insert(
      links.map((l) => ({
        user_id: l.user_id,
        source: 'line',
        raw: text.slice(0, 2000),
        meta: { roomId, lineMessageId: ev.message.id, senderId: ev.source?.userId ?? null },
        created_at: at,
      })),
    );

    // ---------- 4) ยืนยันในกลุ่ม (เฉพาะที่แกะได้แน่) ----------
    // try/catch ครอบไว้เพราะการเก็บงานสำเร็จไปแล้วข้างบน — ถ้าปล่อยให้ throw ขึ้นไป
    // จะได้ 500 กลับไปหา LINE แล้ว LINE จะยิงซ้ำทั้งก้อน ผลคืองานเดิมถูกเก็บซ้ำอีกรอบ
    // การตอบไม่สำเร็จเป็นเรื่องเล็ก การเก็บซ้ำเป็นเรื่องที่ผู้ใช้เห็นและรำคาญ
    try {
      await confirmInGroup(ev, text, links.length);
    } catch (e) {
      console.error('[confirm] ตอบในกลุ่มไม่สำเร็จ:', (e as Error)?.message);
    }
  }

  // LINE ต้องได้ 200 กลับเสมอ ไม่งั้นมันจะยิงซ้ำและปิด webhook ทิ้งในที่สุด
  return new Response('ok');
});
