// Student OS — ส่งการเตือนแบบ Web Push (ทำงานแม้ผู้ใช้ปิดแอป)
// เรียกโดย pg_cron ทุก 30 นาที: หางานที่ใกล้ถึงกำหนดส่งแล้วส่ง push ให้เจ้าของงาน
//
// ============================================================
// เพดานคนใช้ — ตัวเลขที่วัดมาจริง ไม่ได้กะเอา (23 ส.ค. 2569)
// ------------------------------------------------------------
// รุ่นแรกของไฟล์นี้พังที่ราว 650 คน และพังแบบเงียบ ๆ ทั้งสามทาง:
//
//   1) .in('id', userIds) เอา uuid ทุกตัวไปต่อใน query string
//      ยิงจริงแล้ววัดได้: 600 ตัว = ผ่าน · 700 ตัว = HTTP 400 ทันที
//      นี่คือกำแพงด่านแรก และ error ที่ได้ไม่ได้บอกเลยว่าเพราะ URL ยาวเกิน
//
//   2) select('id, data') ดึง JSON ทั้งก้อนของทุกคนมาไว้ในหน่วยความจำ
//      ในก้อนนั้นมีรูปโปรไฟล์ (base64 สูงสุด 60KB/คน) ตารางเรียน ประวัติจับเวลา
//      ทั้งที่ต้องใช้แค่ tasks — 600 คนคือลากของไม่ได้ใช้มาหลายสิบ MB ทุกครึ่งชั่วโมง
//
//   3) select('*') บน push_subscriptions ไม่มี range ไม่มี limit
//      PostgREST มีเพดานแถวของมันเอง เกินแล้วตัดทิ้งเงียบ ๆ ไม่ error
//      คนที่ถูกตัดคือคนที่ไม่ได้รับการเตือน โดยไม่มีอะไรบนหน้าจอบอกว่าเขาถูกตัด
//
// แก้ครบสามข้อแล้ว: แบ่งหน้าอ่าน · ดึงเฉพาะ data->tasks · หั่น .in() เป็นชุดละ 200
// เพดานใหม่จึงเป็นเวลาที่รันได้ ไม่ใช่จำนวนคน — ดู PUSH_CONCURRENCY ข้างล่าง
// ============================================================
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { appConfig, num, str, fill } from '../_shared/appconfig.ts';

// ---------- เพดานที่ตั้งไว้ตั้งใจ ----------
const PAGE = 500;               // อ่าน subscription ทีละหน้า
const ID_CHUNK = 200;           // uuid ต่อหนึ่ง .in() — วัดแล้วพังที่ 700 ตั้งไว้ต่ำกว่าสามเท่า
const PUSH_CONCURRENCY = 20;    // ส่ง push พร้อมกันกี่สาย
const QUIET_HOURS = 4;          // เตือนคนเดิมไม่เกิน 1 ครั้งต่อกี่ชั่วโมง
// ---------- เรื่องสังคม (คำขอเพื่อน · ข้อความใหม่) ----------
// ช่องว่างสั้นกว่าเรื่องงานมาก เพราะคนละธรรมชาติกัน: งานที่ส่งพรุ่งนี้รอสี่ชั่วโมงได้
// ข้อความที่เพื่อนเพิ่งพิมพ์มาแล้วเงียบไปสี่ชั่วโมง คือการแจ้งเตือนที่มาช้าจนไม่มีความหมาย
// แต่ต้องมีช่องว่าง ไม่งั้นห้องที่คุยกันรัว ๆ จะกลายเป็นเครื่องยิงแจ้งเตือน
const SOCIAL_QUIET_MIN = 25;     // เรื่องสังคมของคนเดิม ห่างกันอย่างน้อยกี่นาที
const SOCIAL_MAX_DAY = 6;        // เพดานต่อคนต่อวัน — เกินนี้คือสแปม ไม่ใช่การแจ้งเตือน
const SOCIAL_LOOKBACK_MIN = 180; // มองย้อนหลังกี่นาที (เผื่อรอบที่ข้ามไปเพราะกลางคืน)
const DEADLINE_MS = 100_000;    // หยุดเองก่อนโดน platform ตัด แล้วรายงานว่าค้างเท่าไหร่

let inited = false;
let initErr: string | null = null;
let db: ReturnType<typeof createClient>;

function ensureInit() {
  if (inited || initErr) return;
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:studentos@example.com';

    const missing = [
      !SUPABASE_URL && 'SUPABASE_URL',
      !SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
      !VAPID_PUBLIC && 'VAPID_PUBLIC_KEY',
      !VAPID_PRIVATE && 'VAPID_PRIVATE_KEY',
    ].filter(Boolean);
    if (missing.length) throw new Error('secret ขาด: ' + missing.join(', '));

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);
    db = createClient(SUPABASE_URL!, SERVICE_KEY!);
    inited = true;
  } catch (e: any) {
    initErr = (e && e.message) || String(e);
  }
}

// ============================================================
// เวลาไทย — ทุกการตัดสินใจเรื่อง "ตอนนี้ควรส่งไหม" ต้องผ่านตรงนี้
// ------------------------------------------------------------
// Edge Function รันบนโซนเวลา UTC · ถ้าถามเวลาตรง ๆ จะได้เวลาที่ไม่ตรงกับชีวิตใคร
// ประเทศไทยมีโซนเวลาเดียว บวก 7 คงที่จึงพอ ไม่ต้องเก็บโซนเวลารายคน
// ============================================================
const TH_OFFSET = 7 * 3.6e6;
const TH_DAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];

// ---------- หน้าต่างเวลาที่ยอมให้ส่ง ----------
// ⚠️ บั๊กที่แก้ในรุ่นนี้ และมันเป็นบั๊กที่แพงที่สุดเท่าที่ระบบเตือนจะมีได้:
//
//   งานที่ครูสั่ง "ส่งพรุ่งนี้" ได้กำหนดส่ง 23:59 ของพรุ่งนี้ (ค่าปริยายของ "ภายในวันนั้น")
//   เงื่อนไขเดิมคือ "เหลือ ≤ 24 ชม." ซึ่งเป็นจริงครั้งแรกตอน 23:59 ของคืนนี้พอดี
//   cron ยิงทุกครึ่งชั่วโมง → การเตือนจึงออกระหว่าง 23:59–00:29 แทบทุกใบ
//
//   และ 23:59 ไม่ใช่เคสมุม มันคือกำหนดส่งของงานส่วนใหญ่ในโรงเรียนไทย
//   เด็กโดนปลุกตอนเที่ยงคืนสองสามรอบแล้วจะปิดการแจ้งเตือน — ปิดแล้วปิดเลย
//   เบราว์เซอร์ไม่ถามซ้ำอีก และการเตือนคือกลไกเดียวที่ดึงคนกลับ เสียแล้วเสียถาวร
const NIGHT_FROM = 22;         // สองทุ่มสี่สิบ… ไม่ใช่ · สี่ทุ่มเป็นต้นไป ห้ามส่ง
const NIGHT_TO = 7;            // ปลดล็อกตอนเจ็ดโมงเช้า
const EVE_FROM = 17;           // กลับถึงบ้านแล้ว และยังมีเวลาทำจริง
const EVE_TO = 22;
const SAME_DAY_HOURS = 12;     // ใกล้ขนาดนี้ส่งได้ทั้งวัน ไม่ต้องรอเย็น
const LOOKAHEAD_HOURS = 30;    // มองไกลพอที่จะเตือนงาน "พรุ่งนี้ 23:59" ได้ตั้งแต่เย็นนี้
const LAPSED_DAYS = 3;         // หายไปกี่วันถึงจะทัก

// ---------- ค่าที่ Control Center ทับได้ ----------
// ค่าเริ่มต้นทุกตัวคือค่าคงที่ที่อยู่ข้างบนนี้เป๊ะ ๆ — ตารางยังไม่มี/เน็ตหลุด = เหมือนเดิม
// **ยกเว้นข้อเดียวที่ตั้งใจให้ต่าง:** examHours (ดูหมายเหตุที่ตัวแปรนั้น)
let cfgNightFrom = NIGHT_FROM;
let cfgExamHours = LOOKAHEAD_HOURS;
let cfgFlags: Record<string, boolean> = {};
let cfgTimes: string[] = [];
let cfgTemplates: Record<string, string> = {};

async function loadNotiConfig() {
  const c = await appConfig();
  // "ห้ามเตือนหลังเวลา" — รับได้เฉพาะรูป HH:MM · อย่างอื่นใช้ของเดิม
  const q = str(c.noti?.quietAfter, '');
  const m = /^(\d{1,2}):(\d{2})$/.exec(q);
  cfgNightFrom = m ? num(m[1], NIGHT_FROM, 12, 23) : NIGHT_FROM;

  // ---------- จุดเดียวที่ค่าเริ่มต้นเปลี่ยนพฤติกรรมเดิม ----------
  // เดิมทุกงานมองไปข้างหน้า 30 ชม. เท่ากันหมด แปลว่า "สอบอีกสามวัน" ไม่เคยได้ push เลย
  // จนกว่าจะเหลือ 30 ชม. ซึ่งขัดกับตัวแอปเองที่คิด prepHours ให้การสอบมาตั้งแต่ต้น
  // (engine.js ให้เวลาของการสอบ "เดินเร็วกว่าจริง" เพราะสอบต้องเริ่มอ่านล่วงหน้า)
  // เจ้าของระบบสั่งให้มีช่อง "เตือนก่อนสอบ 3 วัน" จึงทำตามนั้น และนับเป็นการเปลี่ยน
  // พฤติกรรมที่ตั้งใจ — ปิดได้ด้วยสวิตช์ "เตือนก่อนสอบ" ใน Notification Center
  cfgExamHours = Math.round(num(c.noti?.examDays, 3, 0, 14) * 24);

  cfgFlags = (c.noti?.flags ?? {}) as Record<string, boolean>;
  cfgTimes = Array.isArray(c.noti?.times) ? c.noti!.times!.filter(t => /^\d{1,2}:\d{2}$/.test(t)) : [];
  cfgTemplates = (c.noti?.templates ?? {}) as Record<string, string>;
}

/** สวิตช์ใน Notification Center · ไม่รู้จัก = เปิด (ฟีเจอร์ใหม่ต้องทำงานทันที) */
function notiOn(id: string): boolean { return cfgFlags[id] !== false; }

/** ตั้งเวลาส่งไว้ = ส่งเฉพาะในหน้าต่าง ±15 นาทีของเวลานั้น · ไม่ได้ตั้ง = ตามจังหวะของงาน */
function inSendWindow(ms: number): boolean {
  if (!cfgTimes.length) return true;
  const d = thDate(ms);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return cfgTimes.some(t => {
    const [h, mm] = t.split(':').map(Number);
    return Math.abs(mins - (h * 60 + mm)) <= 15;
  });
}

function thDate(ms: number): Date { return new Date(ms + TH_OFFSET); }
function thHour(ms: number): number { return thDate(ms).getUTCHours(); }
function isNight(ms: number): boolean { const h = thHour(ms); return h >= cfgNightFrom || h < NIGHT_TO; }
function isEvening(ms: number): boolean { const h = thHour(ms); return h >= EVE_FROM && h < EVE_TO; }

/** งานใบนี้เป็นการสอบไหม — ฝั่งเซิร์ฟเวอร์ไม่มี taskType() ของ engine.js ให้เรียก */
function isExam(t: any): boolean {
  const ty = String(t?.type || '').toLowerCase();
  if (ty) return ty === 'exam';
  return /สอบ|ควิซ|quiz|midterm|final/i.test(String(t?.detail || '') + ' ' + String(t?.subject || ''));
}

// คีย์สัปดาห์แบบง่าย — ใช้กันการทักซ้ำ ไม่ได้ใช้แสดงผล จึงไม่ต้องตรงมาตรฐาน ISO
function thWeekKey(ms: number): string {
  return 'w' + Math.floor((ms + TH_OFFSET) / (7 * 86400000));
}

// "วันนี้ / พรุ่งนี้ / วันพฤหัส" — คนพูดกันแบบนี้ ไม่มีใครพูดว่า "อีก 31 ชั่วโมง"
function dueLabel(dueIso: string, nowMs: number): string {
  const d = thDate(Date.parse(dueIso)), n = thDate(nowMs);
  const day = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  const diff = Math.round((day(d) - day(n)) / 86400000);
  if (diff < 0) return 'เมื่อวาน';
  if (diff === 0) return 'วันนี้';
  if (diff === 1) return 'พรุ่งนี้';
  if (diff === 2) return 'มะรืนนี้';
  if (diff <= 6) return 'วัน' + TH_DAY_FULL[d.getUTCDay()];
  return 'วัน' + TH_DAY_FULL[d.getUTCDay()] + 'ที่ ' + d.getUTCDate();
}

function clip(s: string, max: number): string {
  s = String(s || '').trim();
  return s.length <= max ? s : s.slice(0, max).trim() + '…';
}

// ชื่องานที่คนอ่านแล้วรู้ทันทีว่าใบไหน — วิชาอย่างเดียวไม่พอถ้ามีสามใบในวิชาเดียว
function taskName(t: any): string {
  const s = String(t?.subject || 'งาน');
  const d = clip(t?.detail || '', 38);
  return d && !d.includes(s) ? s + ' ' + d : (d || s);
}

// ---------- ข้อความเตือน ----------
// สิ่งที่ทำให้การแจ้งเตือนน่าเปิด ไม่ใช่คำอุทานหรืออีโมจิ แต่คือ "ความเจาะจง"
// "มีงานรออยู่" ปัดทิ้งได้ทันที · "เคมี บทที่ 4 ส่งพรุ่งนี้" ปัดทิ้งไม่ลง
// ทุกข้อความข้างล่างจึงต้องมีชื่องานจริงกับเวลาจริงเสมอ ไม่มีอันไหนพูดลอย ๆ
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// ---------- แม่แบบที่เจ้าของระบบเขียนเองได้ ----------
// ตั้งไว้ = ใช้แทนข้อความในไฟล์นี้ · ไม่ได้ตั้ง = ใช้ของเดิม (ซึ่งสุ่มสองแบบเพื่อไม่ให้ซ้ำซาก)
//
// **แม่แบบไม่มีตัวเลือกให้สุ่ม** โดยตั้งใจ — คนเขียนข้อความเองย่อมอยากได้ข้อความนั้น
// ไม่ใช่ข้อความนั้นบ้างอย่างอื่นบ้าง · ราคาคือเห็นซ้ำบ่อยขึ้น ซึ่งเจ้าของเลือกเอง
//
// ชื่อที่ไม่มีข้อมูลถูกลบทิ้ง ไม่ปล่อยให้ {{days}} โผล่บนหน้าจอล็อกของเด็ก (ดู fill())
function tpl(id: string, vars: Record<string, string | number>): string | null {
  const t = str(cfgTemplates[id], '');
  return t ? fill(t, vars) : null;
}

function reminderCopy(t: any, hoursLeft: number, nowMs: number) {
  const name = taskName(t);
  const hr = Math.max(1, Math.round(hoursLeft));
  const when = t?.due ? dueLabel(t.due, nowMs) : '';
  const vars = {
    task: name,
    subject: String(t?.subject || ''),
    time: when,
    hours: hr,
    days: Math.max(0, Math.round(hoursLeft / 24)),
  };

  // สอบมีแม่แบบของตัวเอง และต้องมาก่อนสาขาอื่นทั้งหมด — ไม่งั้น "สอบอีกสามวัน"
  // จะไปตกสาขาสุดท้ายแล้วได้ข้อความว่า "มีส่ง" ซึ่งผิดประเภทงาน
  if (isExam(t) && hoursLeft > SAME_DAY_HOURS) {
    const custom = tpl('exam', vars);
    if (custom) return { title: `สอบ${when ? when : ''} 📖`.trim(), body: custom };
    return {
      title: `สอบ${when ? when : 'เร็ว ๆ นี้'} 📖`,
      body: `${name} — อีก ${vars.days} วัน เริ่มอ่านวันนี้จะทันแบบไม่ต้องอัด`,
    };
  }

  if (hoursLeft < 0) {
    const custom = tpl('overdue', vars);
    if (custom) return { title: 'เลยกำหนดไปแล้ว 😬', body: custom };
  } else if (hoursLeft <= SAME_DAY_HOURS) {
    const custom = tpl('urgent', vars);
    if (custom) return { title: `ส่ง${when || 'วันนี้'} 📚`, body: custom };
  } else {
    const custom = tpl('daily', vars);
    if (custom) return { title: `${when || 'พรุ่งนี้'}มีส่ง 📌`, body: custom };
  }

  if (hoursLeft < 0) return {
    title: 'เลยกำหนดไปแล้ว 😬',
    body: pick([
      `${name} เลยเวลาส่งแล้ว — ส่งช้ายังดีกว่าไม่ส่ง เคลียร์เลย`,
      `${name} ยังค้างอยู่ ยังไม่สายเกินไปถ้าเริ่มตอนนี้`,
    ]),
  };
  if (hoursLeft <= 3) return {
    title: `เหลือ ${hr} ชั่วโมง ⏰`,
    body: pick([
      `${name} — เริ่มตอนนี้ยังทัน`,
      `${name} ใกล้หมดเวลาแล้ว เอาให้จบคืนนี้`,
    ]),
  };
  if (hoursLeft <= SAME_DAY_HOURS) return {
    title: `ส่ง${when || 'วันนี้'} 📚`,
    body: pick([
      `${name} — เหลืออีก ${hr} ชม. ทำตอนนี้สบายกว่าตอนดึกเยอะ`,
      `${name} รออยู่ เริ่มเลยจะได้พักแบบไม่มีห่วง`,
    ]),
  };
  return {
    title: `${when || 'พรุ่งนี้'}มีส่ง 📌`,
    body: pick([
      `${name} — เย็นนี้เคลียร์ได้ ${when}จะได้ไม่ต้องรีบ`,
      `${name} — เริ่มคืนนี้สักหน่อย ${when}จะสบายขึ้นเยอะ`,
    ]),
  };
}

// ---------- ข้อความสำหรับคนที่หายไป ----------
// คนกลุ่มนี้ไม่เคยได้รับอะไรเลยในระบบเดิม เพราะการเตือนทุกแบบผูกกับกำหนดส่ง
// ไม่มีงาน = ไม่มีกำหนดส่ง = เงียบสนิทตลอดกาล ทั้งที่เป็นกลุ่มที่กำลังจะหายไปจริง ๆ
//
// ข้อความพวกนี้เขียนได้เพราะมีบอทในกลุ่มห้องแล้ว — งานยังไหลเข้ามาให้เขาทุกวัน
// แม้เขาจะไม่ได้เปิดแอป เราจึงมีของจริงจะบอก ไม่ใช่ "กลับมาใช้หน่อยสิ" ซึ่งไม่มีใครสน
function lapsedCopy(pending: any[], daysAway: number, nowMs: number) {
  // ไม่มีงานเลย — ปัญหาไม่ใช่ว่าเขาขี้เกียจ แต่คือแอปยังว่าง บอกทางที่ทำให้มันไม่ว่างไปเลย
  if (!pending.length) return {
    title: 'แอปยังว่างอยู่เลย',
    body: 'เชื่อมกลุ่ม LINE ห้องเธอไว้ แล้วงานที่ครูสั่งจะเข้ามาเอง ไม่ต้องพิมพ์สักตัว',
  };

  const withDue = pending.filter((t) => t.due).sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const soonest = withDue[0];
  const n = pending.length;

  // เข้ามาใหม่ตอนที่เขาไม่อยู่ — ตัวเลขนี้คือสิ่งที่ทำให้ข้อความน่าเปิดที่สุด
  const cutoff = nowMs - daysAway * 86400000;
  const fresh = pending.filter((t) => t.createdAt && Date.parse(t.createdAt) >= cutoff);

  if (fresh.length) {
    const subs = [...new Set(fresh.map((t: any) => String(t.subject || 'งาน')))].slice(0, 3);
    return {
      title: `มีงานใหม่ ${fresh.length} ชิ้นรออยู่ 📥`,
      body: subs.join(' · ') + (soonest ? ` — อันที่ใกล้สุดส่ง${dueLabel(soonest.due, nowMs)}` : ''),
    };
  }

  return {
    title: `ยังมีงานค้าง ${n} ชิ้น`,
    body: soonest
      ? `${taskName(soonest)} ส่ง${dueLabel(soonest.due, nowMs)} — เปิดดูสักนิดว่าควรเริ่มอันไหนก่อน`
      : 'เปิดดูสักนิดว่าควรเริ่มอันไหนก่อน',
  };
}

// ---------- ข้อความเรื่องสังคม ----------
// กฎเดียวกับข้อความเรื่องงาน: ต้องเจาะจงพอที่จะปัดทิ้งไม่ลง
// "มีคนขอเป็นเพื่อน" ปัดทิ้งได้ · "มายด์ขอเป็นเพื่อน" ปัดทิ้งไม่ลง เพราะมีคนอยู่ปลายทางจริง
//
// ⚠️ **ไม่ใส่เนื้อข้อความของ DM ลงในการ์ดแจ้งเตือน** — การ์ดขึ้นบนหน้าจอล็อก ซึ่งใครก็ตาม
// ที่หยิบเครื่องขึ้นมาก็เห็น · เด็กที่คุยเรื่องส่วนตัวกับเพื่อนไม่ได้ตกลงกับเราว่าจะให้
// ข้อความนั้นไปโผล่หน้าจอล็อกให้พ่อแม่หรือเพื่อนร่วมห้องอ่าน (เส้นความปลอดภัยเด็กของโปรเจกต์)
// ฝั่งแอปตอนเปิดอยู่แสดงเนื้อความได้ เพราะคนที่มองจออยู่คือเจ้าของเครื่องแน่นอนแล้ว
function friendCopy(names: string[], n: number) {
  if (n > 1) return {
    title: `มีคำขอเป็นเพื่อน ${n} คน 👋`,
    body: names.slice(0, 3).join(' · ') + (n > 3 ? ` และอีก ${n - 3} คน` : '') + ' — กดรับในแอป',
  };
  return {
    title: `${names[0] || 'มีคน'}ขอเป็นเพื่อน 👋`,
    body: 'กดรับแล้วเห็นผลและวิชาที่ช่วยกันได้ของกันและกัน',
  };
}

function dmCopy(names: string[], rooms: number, msgs: number) {
  if (rooms > 1) return {
    title: `ข้อความใหม่ ${msgs} ข้อความ 💬`,
    body: 'จาก ' + names.slice(0, 3).join(' · ') + (rooms > 3 ? ` และอีก ${rooms - 3} ห้อง` : ''),
  };
  return {
    title: `${names[0] || 'เพื่อน'}ส่งข้อความมา 💬`,
    body: msgs > 1 ? `${msgs} ข้อความใหม่ — เปิดอ่านในแอป` : 'เปิดอ่านในแอป',
  };
}

// หั่นรายการยาวเป็นชุดย่อย — ใช้กับ .in() ที่มีเพดาน URL
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ทำงานพร้อมกันแบบจำกัดสาย — ส่งรวดเดียวทั้งหมดคือวิธีโดนปลายทาง rate limit เร็วที่สุด
// ส่วนส่งทีละอันคือวิธีที่ทำให้ 600 คนใช้เวลาเกินเพดานเวลาของ Edge Function
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

Deno.serve(async () => {
  ensureInit();
  if (initErr) {
    return new Response(JSON.stringify({ ok: false, error: 'init failed: ' + initErr }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const startedAt = Date.now();
  const now = startedAt;
  let sent = 0;
  let scanned = 0;
  const errors: string[] = [];
  let truncated = false;

  // ต้องอ่านค่าตั้งก่อนทุกการตัดสินใจ — เวลาห้ามส่งกับหน้าต่างเวลาส่งมาจากที่นี่
  // ล้มเหลว = ใช้ค่าคงที่ในไฟล์นี้ (ดู _shared/appconfig.ts) ไม่มีทางทำให้รอบนี้พัง
  await loadNotiConfig();

  // กลางดึกไม่ส่งอะไรทั้งนั้น — ออกตั้งแต่ยังไม่แตะฐานข้อมูล
  // ของที่ถึงคิวตอนดึกไม่ได้หายไปไหน เพราะ push_sent ยังไม่ถูกปัก
  // รอบเช้าจะเจอมันอีกครั้งแล้วส่งตอนที่คนตื่นอยู่และทำอะไรได้จริง
  if (isNight(now)) {
    return new Response(JSON.stringify({
      ok: true, sent: 0, scanned: 0, skipped: 'night',
      thaiHour: thHour(now), ms: Date.now() - startedAt,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // เจ้าของระบบตั้ง "เวลาส่ง" ไว้ = รอบที่ไม่ตรงหน้าต่างนั้นไม่ส่ง
  // ออกด้วยเหตุผลเดียวกับกลางดึก: ยังไม่ปัก push_sent ของจึงรอรอบถัดไปได้
  // ไม่ได้ตั้งไว้ = ส่งตามจังหวะของงานเหมือนเดิม (พฤติกรรมเริ่มต้น)
  if (!inSendWindow(now)) {
    return new Response(JSON.stringify({
      ok: true, sent: 0, scanned: 0, skipped: 'outside-window',
      thaiHour: thHour(now), windows: cfgTimes, ms: Date.now() - startedAt,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const quietBefore = new Date(now - QUIET_HOURS * 3.6e6).toISOString();
    // ⚠️ ด่านที่ SQL ใช้คัดคนออกต้องเป็น "ด่านที่กว้างที่สุดของทุกชนิดการเตือน" เสมอ
    // เดิมมันคือ 4 ชม. ของเรื่องงาน ซึ่งพอเพิ่มเรื่องสังคม (25 นาที) เข้ามาแล้วจะกลายเป็น
    // การตัดคนที่มีสิทธิ์ได้รับข้อความใหม่ทิ้งตั้งแต่ยังไม่ได้ดูว่าเขามีข้อความหรือเปล่า
    // คัดกว้างที่ SQL แล้วไปตัดสินจริงในโค้ดทีละชนิด — ราคาคือลากแถวขึ้นมามากขึ้นเท่านั้น
    const gateBefore = new Date(now - SOCIAL_QUIET_MIN * 60000).toISOString();
    const socialSince = new Date(now - SOCIAL_LOOKBACK_MIN * 60000).toISOString();
    const dayStart = (() => { const d = thDate(now);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - TH_OFFSET).toISOString(); })();

    for (let page = 0; ; page++) {
      if (Date.now() - startedAt > DEADLINE_MS) { truncated = true; break; }

      // 1) อ่าน subscription ทีละหน้า — เอาเฉพาะคนที่พ้นช่วงเงียบแล้ว
      //    กรองที่ฐานข้อมูลไม่ใช่ในโค้ด คนที่เพิ่งได้รับเตือนไปจะได้ไม่ถูกลากขึ้นมาด้วย
      const from = page * PAGE;
      const { data: subs, error: subErr } = await db
        .from('push_subscriptions')
        .select('endpoint, user_id, p256dh, auth, last_sent_at')
        .or(`last_sent_at.is.null,last_sent_at.lt.${gateBefore}`)
        .order('endpoint')
        .range(from, from + PAGE - 1);
      if (subErr) throw new Error('push_subscriptions: ' + subErr.message);
      if (!subs?.length) break;
      scanned += subs.length;

      const userIds = [...new Set(subs.map((s: any) => s.user_id))];

      // 2) ดึงเฉพาะ tasks ไม่ใช่ data ทั้งก้อน — รูปโปรไฟล์กับตารางเรียนไม่ต้องเดินทางมาด้วย
      //    และหั่น .in() เป็นชุดละ ID_CHUNK เพราะ query string มีเพดานความยาวจริง
      const tasksByUser = new Map<string, any[]>();
      // funnel เล็กมาก (ไม่กี่ร้อยไบต์) แต่บอกสิ่งที่ tasks บอกไม่ได้: เขายังเปิดแอปอยู่ไหม
      const funnelByUser = new Map<string, any>();
      // settings ก็เล็กเท่ากัน และเป็นที่เดียวที่บอกว่าเขาอยากได้การเตือนแบบไหน
      const prefsByUser = new Map<string, any>();
      for (const ids of chunk(userIds, ID_CHUNK)) {
        const { data: rows, error: stErr } = await db
          .from('user_state')
          .select('id, tasks:data->tasks, funnel:data->funnel, settings:data->settings')
          .in('id', ids);
        if (stErr) throw new Error('user_state: ' + stErr.message);
        for (const r of rows ?? []) {
          tasksByUser.set((r as any).id, (r as any).tasks ?? []);
          funnelByUser.set((r as any).id, (r as any).funnel ?? null);
          prefsByUser.set((r as any).id, (r as any).settings ?? null);
        }
      }

      // 3) หมุดว่าเคยเตือนงานไหนไปแล้ว — อยู่ตารางของตัวเอง ไม่ต้องแตะข้อมูลผู้ใช้
      const sentKeys = new Set<string>();
      // เรื่องสังคมต้องรู้ "เมื่อไหร่" ด้วย ไม่ใช่แค่ "เคยส่งหรือยัง" — มันมีทั้งช่องว่างขั้นต่ำ
      // และเพดานต่อวัน ซึ่งทั้งสองอย่างเป็นคำถามเรื่องเวลา ไม่ใช่คำถามเรื่องการมีอยู่
      const socialLastAt = new Map<string, number>();   // ส่งเรื่องสังคมครั้งล่าสุดเมื่อไหร่
      const socialToday = new Map<string, number>();    // วันนี้ส่งไปแล้วกี่ดอก
      for (const ids of chunk(userIds, ID_CHUNK)) {
        const { data: rows } = await db
          .from('push_sent').select('user_id, task_id, sent_at').in('user_id', ids);
        for (const r of rows ?? []) {
          const uid = (r as any).user_id, key = (r as any).task_id;
          sentKeys.add(`${uid}::${key}`);
          if (key.startsWith('fr::') || key.startsWith('dm::')) {
            const at = Date.parse((r as any).sent_at || '');
            if (!Number.isFinite(at)) continue;
            if (at > (socialLastAt.get(uid) ?? 0)) socialLastAt.set(uid, at);
            if ((r as any).sent_at >= dayStart) socialToday.set(uid, (socialToday.get(uid) ?? 0) + 1);
          }
        }
      }

      // ---------- ของที่เกิดขึ้นในโลกสังคมช่วงที่ผ่านมา ----------
      // ทั้งก้อนนี้ห่อ try ไว้ทั้งหมดโดยตั้งใจ: ถ้าตารางไหนยังไม่ได้ deploy หรือคิวรีพัง
      // การเตือนเรื่องงานต้องออกตามปกติ · ฟีเจอร์ใหม่ห้ามพาของเดิมล้มไปด้วย
      // (ที่เก็บของจริงกับที่เก็บใน repo ไม่เคยตรงกันเป๊ะ — เคยเจอมาแล้วสองฟังก์ชัน)
      const frByUser = new Map<string, string[]>();          // ผู้ใช้ -> ชื่อคนที่ขอมา
      const frKeyByUser = new Map<string, string[]>();       // ผู้ใช้ -> คีย์กันซ้ำ
      const dmByUser = new Map<string, { names: Set<string>; msgs: number; keys: string[] }>();
      try {
        const nameOf = new Map<string, string>();
        const need = new Set<string>();

        // คำขอเป็นเพื่อนที่ยังค้าง — ฝั่งที่ต้อง "ตอบ" คือคนที่ไม่ใช่ asked_by
        // คู่ถูกเก็บเรียง a < b เสมอ จึงต้องถามสองด้าน แล้วค่อยกรองว่าใครเป็นผู้รับ
        for (const ids of chunk(userIds, ID_CHUNK)) {
          for (const col of ['a', 'b']) {
            const { data: rows, error } = await db
              .from('friendships').select('a, b, asked_by, created_at')
              .eq('status', 'pending').gte('created_at', socialSince).in(col, ids);
            if (error) throw new Error('friendships: ' + error.message);
            for (const r of rows ?? []) {
              const me = (r as any)[col], asker = (r as any).asked_by;
              if (asker === me) continue;                    // เราเป็นฝ่ายขอเอง ไม่ต้องเตือน
              need.add(asker);
              (frByUser.get(me) ?? frByUser.set(me, []).get(me)!).push(asker);
              (frKeyByUser.get(me) ?? frKeyByUser.set(me, []).get(me)!)
                .push(`fr::${asker}::${(r as any).created_at}`);
            }
          }
        }

        // ข้อความใหม่ — อ่านจาก dm_messages ตรง ๆ ไม่ใช่จาก last_at ของห้อง
        // last_at ขยับตอนใครพิมพ์ก็ได้ รวมถึงตัวเจ้าของเครื่องเอง ซึ่งไม่ใช่ของที่ต้องเตือน
        const { data: msgs, error: msgErr } = await db
          .from('dm_messages')
          .select('thread, sender, created_at, dm_threads!inner(a, b)')
          .gte('created_at', socialSince)
          .order('created_at', { ascending: true })
          .limit(2000);
        if (msgErr) throw new Error('dm_messages: ' + msgErr.message);
        const inBatch = new Set(userIds);
        for (const m of msgs ?? []) {
          const th = (m as any).dm_threads;
          if (!th) continue;
          const to = (m as any).sender === th.a ? th.b : th.a;
          if ((m as any).sender === to || !inBatch.has(to)) continue;
          need.add((m as any).sender);
          const rec = dmByUser.get(to) ?? { names: new Set<string>(), msgs: 0, keys: [] };
          rec.msgs++;
          rec.names.add((m as any).sender);
          rec.keys.push(`dm::${(m as any).thread}::${(m as any).created_at}`);
          dmByUser.set(to, rec);
        }

        // ชื่อคน — ถามครั้งเดียวสำหรับทุกคนที่ต้องเอ่ยถึงในรอบนี้
        for (const ids of chunk([...need], ID_CHUNK)) {
          const { data: ps } = await db.from('profiles').select('id, display_name').in('id', ids);
          for (const pr of ps ?? []) nameOf.set((pr as any).id, (pr as any).display_name || '');
        }
        const named = (id: string) => (nameOf.get(id) || '').trim() || 'เพื่อน';
        for (const [uid, list] of frByUser) frByUser.set(uid, list.map(named));
        for (const [, rec] of dmByUser) {
          const ns = [...rec.names].map(named);
          rec.names.clear();
          for (const n of ns) rec.names.add(n);
        }
      } catch (e: any) {
        errors.push('social: ' + ((e && e.message) || String(e)));
        frByUser.clear(); frKeyByUser.clear(); dmByUser.clear();
      }

      // 4) เลือกว่าจะส่งอะไรให้ใคร — คนสองกลุ่ม เงื่อนไขคนละชุด
      const weekKey = 'nudge-' + thWeekKey(now);
      const evening = isEvening(now);
      const jobs: any[] = [];

      for (const sub of subs) {
        const tasks = tasksByUser.get(sub.user_id) ?? [];
        const pending = tasks.filter((t: any) => !t.done && !t.deleted);

        // ค่าเริ่มต้นคือเปิด — คนที่กดอนุญาตแจ้งเตือนไว้แปลว่าเขาอยากได้
        // เทียบกับ false ตรง ๆ ไม่ใช่เช็คว่ามีค่าไหม เพราะคนที่ยังไม่ได้อัปเดตแอป
        // จะไม่มีคีย์นี้เลย และเขาต้องได้รับการเตือนเหมือนเดิม ไม่ใช่เงียบไปเฉย ๆ
        const prefs = prefsByUser.get(sub.user_id) ?? {};
        const wantDue = prefs?.notifDue !== false;
        const wantNudge = prefs?.notifNudge !== false;
        const wantSocial = prefs?.notifSocial !== false;

        // ด่าน 4 ชม. ของเรื่องงาน ย้ายจาก SQL มาไว้ตรงนี้ (ดูหมายเหตุที่ gateBefore)
        // เครื่องที่ยังไม่พ้นช่วงเงียบของเรื่องงาน ยังมีสิทธิ์ได้รับเรื่องสังคมอยู่
        const taskReady = !sub.last_sent_at || Date.parse(sub.last_sent_at) <= now - QUIET_HOURS * 3.6e6;

        // ---- กลุ่มที่ 1: มีงานใกล้กำหนด ----
        // สองจังหวะต่องาน ไม่ใช่จังหวะเดียว:
        //   plan — เย็นก่อนวันส่ง ไว้ "วางแผน" ตอนที่ยังมีเวลาทำจริง
        //   soon — วันที่ต้องส่ง ไว้ "ลงมือ"
        // จังหวะเดียวไม่พอสำหรับเป้าหมายว่าห้ามลืม เตือนล่วงหน้าอย่างเดียวแล้วเงียบ
        // ในวันจริง คือการฝากความจำไว้กับคนที่เรารู้อยู่แล้วว่าเขาลืม
        const candidates = (wantDue && taskReady ? pending : [])
          .filter((t: any) => t.due)
          .map((t: any) => {
            const h = (Date.parse(t.due) - now) / 3.6e6;
            return { t, h, stage: h > SAME_DAY_HOURS ? 'plan' : 'soon' };
          })
          // การสอบมองไกลกว่างานส่ง — ตั้งได้ที่ Notification Center (ค่าเริ่มต้น 3 วัน)
          // ปิดสวิตช์ "เตือนก่อนสอบ" แล้วมันกลับไปใช้หน้าต่าง 30 ชม. เท่างานอื่นทันที
          .filter((x: any) => {
            const far = (isExam(x.t) && notiOn('exam'))
              ? Math.max(LOOKAHEAD_HOURS, cfgExamHours) : LOOKAHEAD_HOURS;
            return x.h <= far && x.h > -24;
          })
          // สวิตช์รายประเภท · เลยกำหนดต้องเช็คก่อน เพราะใบที่เลยกำหนดก็ติด stage 'soon'
          .filter((x: any) => x.h < 0 ? notiOn('overdue')
                            : x.stage === 'soon' ? notiOn('urgent') : true)
          // ของที่ยังไกล ส่งเฉพาะช่วงเย็น — เตือนงานพรุ่งนี้ตอนบ่ายสองไม่มีใครลุกไปทำ
          .filter((x: any) => x.stage === 'soon' || evening)
          // กันซ้ำ: คีย์ใหม่แยกตามจังหวะ · คีย์เก่าเป็น id เปล่า ๆ ต้องนับด้วย
          // ไม่งั้นตอนขึ้นรุ่นนี้ งานที่เคยเตือนไปแล้วจะถูกเตือนซ้ำอีกรอบให้ทุกคนพร้อมกัน
          .filter((x: any) => !sentKeys.has(`${sub.user_id}::${x.t.id}`)
                           && !sentKeys.has(`${sub.user_id}::${x.t.id}::${x.stage}`))
          .sort((a: any, b: any) => a.h - b.h);

        if (candidates.length) {
          const { t, h, stage } = candidates[0];
          jobs.push({
            sub, kind: 'task', key: `${t.id}::${stage}`, tag: 'task-' + t.id,
            copy: reminderCopy(t, h, now),
          });
          continue;   // คนหนึ่งได้อย่างเดียวต่อรอบ งานด่วนสำคัญกว่าคำทัก
        }

        // ---- กลุ่มที่ 1.5: มีคนทักหรือขอเป็นเพื่อน ----
        // มาหลังงาน เพราะแอปนี้เป็นแอปจัดการงานก่อนเป็นอย่างอื่น · แต่มาก่อนคำทัก
        // เพราะมีคนจริงรออยู่ปลายทาง ต่างจากคำทักที่เป็นเราพูดกับตัวเอง
        //
        // สามด่านกันสแปม ซ้อนกันคนละชั้น ไม่ใช่ด่านเดียว:
        //   1. คีย์กันซ้ำถาวรต่อเหตุการณ์ (คำขอใบนั้น · ข้อความข้อความนั้น) ใน push_sent
        //   2. ช่องว่างขั้นต่ำ 25 นาทีต่อคน — ห้องที่คุยรัว ๆ จึงได้ดอกเดียวแล้วเงียบ
        //   3. เพดานต่อวัน — กันกรณีที่สองด่านบนยังปล่อยผ่านได้ทั้งวัน
        // และทั้งหมดนี้ยังอยู่ใต้ด่านกลางคืนของทั้งฟังก์ชันอีกชั้น
        const socialGap = now - (socialLastAt.get(sub.user_id) ?? 0) >= SOCIAL_QUIET_MIN * 60000;
        const socialRoom = (socialToday.get(sub.user_id) ?? 0) < SOCIAL_MAX_DAY;
        if (wantSocial && socialGap && socialRoom && notiOn('social')) {
          const frKeys = (frKeyByUser.get(sub.user_id) ?? [])
            .filter((k) => !sentKeys.has(`${sub.user_id}::${k}`));
          const dm = dmByUser.get(sub.user_id);
          const dmKeys = (dm?.keys ?? []).filter((k) => !sentKeys.has(`${sub.user_id}::${k}`));

          // คำขอเพื่อนมาก่อนข้อความ — มันเป็นของที่ "ต้องตัดสินใจ" ส่วนข้อความเป็นของที่อ่าน
          if (frKeys.length) {
            jobs.push({
              sub, kind: 'social', key: frKeys, tag: 'friend',
              copy: friendCopy(frByUser.get(sub.user_id) ?? [], frKeys.length),
            });
            continue;
          }
          if (dmKeys.length && dm) {
            // นับ "ห้อง" จากคีย์ที่ยังไม่เคยส่ง ไม่ใช่จากทั้งหมดที่เจอ
            // ไม่งั้นข้อความที่เตือนไปแล้วรอบก่อนจะถูกนับซ้ำในเลขของรอบนี้
            const rooms = new Set(dmKeys.map((k) => k.split('::')[1])).size;
            jobs.push({
              sub, kind: 'social', key: dmKeys, tag: 'dm',
              copy: dmCopy([...dm.names], rooms, dmKeys.length),
            });
            continue;
          }
        }

        // ---- กลุ่มที่ 2: หายไปนานแล้ว ----
        // ทักได้แค่ช่วงเย็น และไม่เกินสัปดาห์ละครั้ง — ไม่ด่วน จึงไม่มีสิทธิ์รบกวนเท่างานจริง
        if (!wantNudge || !taskReady || !evening || sentKeys.has(`${sub.user_id}::${weekKey}`)) continue;

        const f = funnelByUser.get(sub.user_id);
        // ไม่มี funnel = ยังไม่ได้อัปเดตแอป เราไม่รู้ว่าเขาหายไปจริงไหม → เงียบไว้
        // เดาแล้วทักผิดคือการสอนให้เขาปิดการแจ้งเตือน ซึ่งแพงกว่าการไม่ทัก
        if (!f?.lastOpen) continue;
        const daysAway = (now - Date.parse(f.lastOpen)) / 86400000;
        if (!(daysAway >= LAPSED_DAYS)) continue;

        jobs.push({
          sub, kind: 'nudge', key: weekKey, tag: 'nudge',
          copy: lapsedCopy(pending, Math.floor(daysAway), now),
        });
      }

      await pool(jobs, PUSH_CONCURRENCY, async ({ sub, kind, key, tag, copy }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ ...copy, tag, url: './' }),
          );
          sent++;
          // ปักหมุดสองที่: เรื่องนี้ส่งแล้ว (กันซ้ำถาวร) + เครื่องนี้เพิ่งได้รับ (กันถี่)
          // เรื่องสังคมหนึ่งดอกครอบคลุมหลายเหตุการณ์ (สามข้อความ = ดอกเดียว) จึงต้องปัก
          // ให้ครบทุกคีย์ ไม่ใช่คีย์เดียว ไม่งั้นอีกสองข้อความจะถูกเตือนซ้ำในรอบถัดไป
          const at = new Date().toISOString();
          const keys: string[] = Array.isArray(key) ? key : [key];
          await db.from('push_sent')
            .upsert(keys.map((k) => ({ user_id: sub.user_id, task_id: k, sent_at: at })));
          // ⚠️ เรื่องสังคม **ห้ามขยับ last_sent_at** — คอลัมน์นั้นคือนาฬิกาของช่วงเงียบ
          // 4 ชม. ของเรื่องงาน · ถ้าข้อความตอนบ่ายสามไปขยับมัน การเตือนงานที่ควรออก
          // ตอนสี่โมงจะถูกเลื่อนไปทุ่มนึง ซึ่งคือการเอาฟีเจอร์ใหม่ไปทำลายฟีเจอร์เดิม
          // ช่วงเงียบของเรื่องสังคมมีนาฬิกาของตัวเองอยู่แล้ว (socialLastAt จาก push_sent)
          if (kind !== 'social') {
            await db.from('push_subscriptions')
              .update({ last_sent_at: at }).eq('endpoint', sub.endpoint);
          }
        } catch (e: any) {
          errors.push(`${sub.user_id}: ${e?.statusCode ?? ''} ${e?.message ?? e}`);
          // 404/410 = subscription หมดอายุ (ถอนแอป/ล้างข้อมูล) → ลบทิ้ง
          //
          // 403 = กุญแจ VAPID ไม่ตรง — subscription ถูกสร้างไว้ด้วยกุญแจคนละดอกกับที่
          // เซิร์ฟเวอร์ถืออยู่ตอนนี้ (เกิดตอนเปลี่ยน VAPID_PUBLIC_KEY เมื่อ 23 ส.ค.)
          // มันจะไม่มีวันหายเอง และเดิมไม่ถูกลบด้วย = ยิงพลาดซ้ำทุกครึ่งชั่วโมงตลอดกาล
          // โดยเจ้าตัวไม่ได้รับอะไรเลยและไม่มีอะไรบนจอบอกว่าเขาถูกตัดออกไปแล้ว
          // ลบทิ้งเพื่อให้ฝั่งแอปสมัครใหม่ด้วยกุญแจปัจจุบันตอนเปิดแอปครั้งถัดไป
          if (e?.statusCode === 403 || e?.statusCode === 404 || e?.statusCode === 410) {
            await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      });

      if (subs.length < PAGE) break;
    }

    return new Response(JSON.stringify({
      ok: true, sent, scanned, truncated,
      ms: Date.now() - startedAt,
      // ตัดรายการ error ก่อนตอบกลับ — cron เก็บ return_message ลงตาราง
      // ถ้าปล่อยให้ยาวตามจำนวนคน วันที่พังพร้อมกันหมดจะได้แถวขนาดหลาย MB
      errors: errors.slice(0, 20),
      errorCount: errors.length,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: (e && e.message) || String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
