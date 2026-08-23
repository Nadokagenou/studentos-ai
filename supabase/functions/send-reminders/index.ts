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

// ---------- ข้อความเตือนสไตล์เพื่อน (ให้เหมือนในแอป) ----------
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function reminderCopy(subject: string, detail: string, hoursLeft: number) {
  const hr = Math.max(1, Math.round(hoursLeft));
  if (hoursLeft < 0) return {
    title: 'อุ๊ย เลยกำหนดแล้ว! 😬',
    body: pick([
      `${subject} เลยเวลาส่งไปแล้วน้า… แต่ยังไม่สายเกินไป รีบเคลียร์เลย!`,
      `${subject} ยังค้างอยู่นะ ครูกำลังมองอยู่ 👀 ส่งตอนนี้ยังพอทัน!`,
    ]),
  };
  if (hoursLeft <= 3) return {
    title: '⏰ เหลือเวลาไม่มากแล้ว!',
    body: pick([
      `${subject} เหลือแค่ ${hr} ชม.! ลุยเลยตอนนี้ เดี๋ยวไม่ทันน้า`,
      `นับถอยหลัง ${hr} ชม. สำหรับ ${subject} — สู้ ๆ คุณทำได้! 💪`,
    ]),
  };
  if (hoursLeft <= 12) return {
    title: 'อย่าเพิ่งลืมนะ 📚',
    body: pick([
      `${subject} รออยู่ เหลือ ${hr} ชม. ทำตอนนี้สบายกว่าตอนดึกเยอะ 😉`,
      `แอบเตือนเรื่อง ${subject} หน่อย~ เริ่มเลยดีกว่า จะได้พักแบบไม่มีห่วง`,
    ]),
  };
  return { title: 'มีงานรออยู่นะ ✨', body: `${subject} — ${detail} ใกล้ถึงกำหนดส่งแล้ว` };
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
      for (const ids of chunk(userIds, ID_CHUNK)) {
        const { data: rows, error: stErr } = await db
          .from('user_state').select('id, tasks:data->tasks').in('id', ids);
        if (stErr) throw new Error('user_state: ' + stErr.message);
        for (const r of rows ?? []) tasksByUser.set((r as any).id, (r as any).tasks ?? []);
      }

      // 3) หมุดว่าเคยเตือนงานไหนไปแล้ว — อยู่ตารางของตัวเอง ไม่ต้องแตะข้อมูลผู้ใช้
      const sentKeys = new Set<string>();
      for (const ids of chunk(userIds, ID_CHUNK)) {
        const { data: rows } = await db
          .from('push_sent').select('user_id, task_id').in('user_id', ids);
        for (const r of rows ?? []) sentKeys.add(`${(r as any).user_id}::${(r as any).task_id}`);
      }

      // 4) เลือกงานที่ควรเตือนของแต่ละเครื่อง แล้วส่งพร้อมกันแบบจำกัดสาย
      const jobs: any[] = [];
      for (const sub of subs) {
        const tasks = tasksByUser.get(sub.user_id) ?? [];
        const candidates = tasks
          .filter((t: any) => !t.done && t.due && !sentKeys.has(`${sub.user_id}::${t.id}`))
          .map((t: any) => ({ t, h: (new Date(t.due).getTime() - now) / 3.6e6 }))
          .filter((x: any) => x.h <= 24 && x.h > -24)
          .sort((a: any, b: any) => a.h - b.h);
        if (candidates.length) jobs.push({ sub, ...candidates[0] });
      }

      await pool(jobs, PUSH_CONCURRENCY, async ({ sub, t, h }) => {
        const copy = reminderCopy(t.subject ?? 'งาน', t.detail ?? '', h);
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ ...copy, tag: 'task-' + t.id, url: './' }),
          );
          sent++;
          // ปักหมุดสองที่: งานนี้เตือนแล้ว (กันซ้ำถาวร) + เครื่องนี้เพิ่งได้รับ (กันถี่)
          await db.from('push_sent')
            .upsert({ user_id: sub.user_id, task_id: String(t.id), sent_at: new Date().toISOString() });
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
