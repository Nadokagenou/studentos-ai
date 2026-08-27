// StudentOS AI — ส่งการเตือนแบบ Web Push (ทำงานแม้ผู้ใช้ปิดแอป)
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

// ---------- เพดานที่ตั้งไว้ตั้งใจ ----------
const PAGE = 500;               // อ่าน subscription ทีละหน้า
const ID_CHUNK = 200;           // uuid ต่อหนึ่ง .in() — วัดแล้วพังที่ 700 ตั้งไว้ต่ำกว่าสามเท่า
const PUSH_CONCURRENCY = 20;    // ส่ง push พร้อมกันกี่สาย
const QUIET_HOURS = 4;          // เตือนคนเดิมไม่เกิน 1 ครั้งต่อกี่ชั่วโมง
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

function thDate(ms: number): Date { return new Date(ms + TH_OFFSET); }
function thHour(ms: number): number { return thDate(ms).getUTCHours(); }
function isNight(ms: number): boolean { const h = thHour(ms); return h >= NIGHT_FROM || h < NIGHT_TO; }
function isEvening(ms: number): boolean { const h = thHour(ms); return h >= EVE_FROM && h < EVE_TO; }

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

function reminderCopy(t: any, hoursLeft: number, nowMs: number) {
  const name = taskName(t);
  const hr = Math.max(1, Math.round(hoursLeft));
  const when = t?.due ? dueLabel(t.due, nowMs) : '';

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

  // กลางดึกไม่ส่งอะไรทั้งนั้น — ออกตั้งแต่ยังไม่แตะฐานข้อมูล
  // ของที่ถึงคิวตอนดึกไม่ได้หายไปไหน เพราะ push_sent ยังไม่ถูกปัก
  // รอบเช้าจะเจอมันอีกครั้งแล้วส่งตอนที่คนตื่นอยู่และทำอะไรได้จริง
  if (isNight(now)) {
    return new Response(JSON.stringify({
      ok: true, sent: 0, scanned: 0, skipped: 'night',
      thaiHour: thHour(now), ms: Date.now() - startedAt,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const quietBefore = new Date(now - QUIET_HOURS * 3.6e6).toISOString();

    for (let page = 0; ; page++) {
      if (Date.now() - startedAt > DEADLINE_MS) { truncated = true; break; }

      // 1) อ่าน subscription ทีละหน้า — เอาเฉพาะคนที่พ้นช่วงเงียบแล้ว
      //    กรองที่ฐานข้อมูลไม่ใช่ในโค้ด คนที่เพิ่งได้รับเตือนไปจะได้ไม่ถูกลากขึ้นมาด้วย
      const from = page * PAGE;
      const { data: subs, error: subErr } = await db
        .from('push_subscriptions')
        .select('endpoint, user_id, p256dh, auth')
        .or(`last_sent_at.is.null,last_sent_at.lt.${quietBefore}`)
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
      for (const ids of chunk(userIds, ID_CHUNK)) {
        const { data: rows } = await db
          .from('push_sent').select('user_id, task_id').in('user_id', ids);
        for (const r of rows ?? []) sentKeys.add(`${(r as any).user_id}::${(r as any).task_id}`);
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

        // ---- กลุ่มที่ 1: มีงานใกล้กำหนด ----
        // สองจังหวะต่องาน ไม่ใช่จังหวะเดียว:
        //   plan — เย็นก่อนวันส่ง ไว้ "วางแผน" ตอนที่ยังมีเวลาทำจริง
        //   soon — วันที่ต้องส่ง ไว้ "ลงมือ"
        // จังหวะเดียวไม่พอสำหรับเป้าหมายว่าห้ามลืม เตือนล่วงหน้าอย่างเดียวแล้วเงียบ
        // ในวันจริง คือการฝากความจำไว้กับคนที่เรารู้อยู่แล้วว่าเขาลืม
        const candidates = (wantDue ? pending : [])
          .filter((t: any) => t.due)
          .map((t: any) => {
            const h = (Date.parse(t.due) - now) / 3.6e6;
            return { t, h, stage: h > SAME_DAY_HOURS ? 'plan' : 'soon' };
          })
          .filter((x: any) => x.h <= LOOKAHEAD_HOURS && x.h > -24)
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
            sub, key: `${t.id}::${stage}`, tag: 'task-' + t.id,
            copy: reminderCopy(t, h, now),
          });
          continue;   // คนหนึ่งได้อย่างเดียวต่อรอบ งานด่วนสำคัญกว่าคำทัก
        }

        // ---- กลุ่มที่ 2: หายไปนานแล้ว ----
        // ทักได้แค่ช่วงเย็น และไม่เกินสัปดาห์ละครั้ง — ไม่ด่วน จึงไม่มีสิทธิ์รบกวนเท่างานจริง
        if (!wantNudge || !evening || sentKeys.has(`${sub.user_id}::${weekKey}`)) continue;

        const f = funnelByUser.get(sub.user_id);
        // ไม่มี funnel = ยังไม่ได้อัปเดตแอป เราไม่รู้ว่าเขาหายไปจริงไหม → เงียบไว้
        // เดาแล้วทักผิดคือการสอนให้เขาปิดการแจ้งเตือน ซึ่งแพงกว่าการไม่ทัก
        if (!f?.lastOpen) continue;
        const daysAway = (now - Date.parse(f.lastOpen)) / 86400000;
        if (!(daysAway >= LAPSED_DAYS)) continue;

        jobs.push({
          sub, key: weekKey, tag: 'nudge',
          copy: lapsedCopy(pending, Math.floor(daysAway), now),
        });
      }

      await pool(jobs, PUSH_CONCURRENCY, async ({ sub, key, tag, copy }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ ...copy, tag, url: './' }),
          );
          sent++;
          // ปักหมุดสองที่: เรื่องนี้ส่งแล้ว (กันซ้ำถาวร) + เครื่องนี้เพิ่งได้รับ (กันถี่)
          await db.from('push_sent')
            .upsert({ user_id: sub.user_id, task_id: key, sent_at: new Date().toISOString() });
          await db.from('push_subscriptions')
            .update({ last_sent_at: new Date().toISOString() }).eq('endpoint', sub.endpoint);
        } catch (e: any) {
          errors.push(`${sub.user_id}: ${e?.statusCode ?? ''} ${e?.message ?? e}`);
          // 404/410 = subscription หมดอายุ (ถอนแอป/ล้างข้อมูล) → ลบทิ้ง
          if (e?.statusCode === 404 || e?.statusCode === 410) {
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
