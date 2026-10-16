// ============================================================
// notify — ส่ง Web Push ให้ผู้ใช้คนเดียว จากฟังก์ชันไหนก็ได้
// ------------------------------------------------------------
// **ไฟล์นี้ไม่ได้มาแทน send-reminders และห้ามเอาไปแทน**
// send-reminders คือท่อ "กวาดทุกคนทุกครึ่งชั่วโมงแล้วดูว่าใครควรได้อะไร" ซึ่งมีตรรกะ
// เรื่องช่วงเงียบ · จังหวะเย็น · เพดานต่อวัน ที่พิสูจน์มาแล้วและไม่ควรมีใครไปแตะ
//
// ส่วนไฟล์นี้คือท่อ "เพิ่งเกิดเรื่องนี้ขึ้นเดี๋ยวนี้ บอกคนนี้คนเดียว" ซึ่งเป็นคนละคำถาม
// ใช้ตารางเดิมทั้งคู่ (push_subscriptions · push_sent) ไม่มีตารางใหม่ ไม่มี cron ใหม่
// ============================================================

import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:studentos@example.com';

let vapidSet = false;
export function pushReady(): boolean {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  if (!vapidSet) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidSet = true;
  }
  return true;
}

// ---------- เวลาไทย ----------
// Edge Function รันบนโซนเวลา UTC · ถามเวลาตรง ๆ จะได้เวลาที่ไม่ตรงกับชีวิตใคร
// ประเทศไทยมีโซนเวลาเดียว บวก 7 คงที่ ไม่มี DST จึงไม่ต้องเก็บโซนเวลารายคน
//
// ตัวเลขชุดนี้ตั้งให้ตรงกับ send-reminders โดยตั้งใจ (NIGHT_FROM 22 · NIGHT_TO 7)
// **แต่ไม่ได้ import จากที่นั่น** เพราะการดึงไฟล์นั้นเข้ามาแปลว่าลาก webpush · appconfig
// และตรรกะการกวาดทั้งก้อนติดมาด้วย · สองตัวเลขที่ต้องคอยดูให้ตรงกัน ถูกกว่าการผูกสองท่อ
// เข้าด้วยกันแล้ววันหนึ่งแก้ท่อหนึ่งไปทำอีกท่อพัง
const TH_OFFSET = 7 * 3.6e6;
const NIGHT_FROM = 22;
const NIGHT_TO = 7;

export function thHour(ms: number = Date.now()): number {
  return new Date(ms + TH_OFFSET).getUTCHours();
}

/** กลางดึกห้ามส่ง — เด็กที่โดนปลุกตอนตีสองจะปิดการแจ้งเตือน และปิดแล้วปิดเลย
 *  เบราว์เซอร์ไม่ถามซ้ำอีก ส่วนการเตือนคือกลไกเดียวที่ดึงคนกลับ เสียแล้วเสียถาวร */
export function isQuietHours(ms: number = Date.now()): boolean {
  const h = thHour(ms);
  return h >= NIGHT_FROM || h < NIGHT_TO;
}

export type PushPayload = { title: string; body: string; tag?: string; url?: string };
/** ความด่วนกับอายุของ push · ไม่ใส่ = ค่าปริยายของ web-push (normal · 4 สัปดาห์)
 *  ของที่ต้องเด้งตอนนี้ (แชท) ต้องใส่ urgency high ไม่งั้น Android ที่ประหยัดแบตพักไว้
 *  จนกว่าจะหยิบเครื่องขึ้นมา (เหตุผลเต็มอยู่ที่ pushOpts ใน send-reminders) */
export type PushOpts = { urgency?: 'very-low' | 'low' | 'normal' | 'high'; TTL?: number };

/** ส่งให้ทุกเครื่องของผู้ใช้คนนี้ · คืนจำนวนเครื่องที่ส่งสำเร็จ
 *  ไม่เคยโยน error — การแจ้งเตือนล้มต้องไม่ทำให้งานที่เรียกมันล้มตามไปด้วย */
export async function pushToUser(
  // deno-lint-ignore no-explicit-any
  db: any,
  userId: string,
  payload: PushPayload,
  opts?: PushOpts,
): Promise<number> {
  return (await pushToUserDetailed(db, userId, payload, opts)).ok;
}

/** ผลส่งรายเครื่อง — devices = เครื่องที่มีตอนเริ่มส่ง · gone = ตายถาวร (403/404/410 ลบแถวแล้ว)
 *  failed = ล้มแบบที่อาจหายเอง (5xx · 429 · เน็ต) · codes = รหัสที่เจอ ไว้ตอบว่า "ทำไมไม่เด้ง" */
export type PushResult = { devices: number; ok: number; gone: number; failed: number; codes: number[] };

/** เหมือน pushToUser แต่บอกด้วยว่าเครื่องที่ไม่ได้รับ ไม่ได้รับเพราะอะไร
 *  16 ต.ค. 69 · ผู้เรียกที่ปักหมุดกันซ้ำต้องแยก "ล้มชั่วคราว" ออกจาก "ไม่มีเครื่องให้ส่ง"
 *  ไม่งั้น FCM ล่มห้านาทีเดียว = ดอกนั้นถูกจดว่าแจ้งแล้ว และหายไปตลอดกาล */
export async function pushToUserDetailed(
  // deno-lint-ignore no-explicit-any
  db: any,
  userId: string,
  payload: PushPayload,
  opts?: PushOpts,
): Promise<PushResult> {
  const res: PushResult = { devices: 0, ok: 0, gone: 0, failed: 0, codes: [] };
  if (!pushReady()) return res;

  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error) { res.failed = 1; return res; }   // อ่านรายชื่อเครื่องไม่ได้ = ยังไม่รู้ ไม่ใช่ "ไม่มีเครื่อง"
  if (!subs?.length) return res;
  res.devices = subs.length;

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ url: './', ...payload }),
        opts,
      );
      res.ok++;
    } catch (e) {
      // 404/410 = ถอนแอป/ล้างข้อมูล · 403 = กุญแจ VAPID คนละดอกกับที่เซิร์ฟเวอร์ถืออยู่
      // ทั้งสามอย่างไม่มีวันหายเอง ปล่อยไว้ = ยิงพลาดซ้ำตลอดกาลโดยเจ้าตัวไม่ได้รับอะไรเลย
      // ลบทิ้งเพื่อให้ฝั่งแอปสมัครใหม่ด้วยกุญแจปัจจุบันตอนเปิดครั้งถัดไป
      const code = (e as { statusCode?: number })?.statusCode;
      if (!res.codes.includes(code ?? 0)) res.codes.push(code ?? 0);   // 0 = ไม่มีรหัส (เน็ต/หมดเวลา)
      if (code === 403 || code === 404 || code === 410) {
        res.gone++;
        await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      } else {
        res.failed++;
      }
    }
  }
  // ⚠️ **ไม่แตะ push_subscriptions.last_sent_at** — คอลัมน์นั้นคือนาฬิกาช่วงเงียบ 4 ชม.
  // ของการเตือนงานใกล้กำหนดใน send-reminders · ขยับมันจากที่นี่ = เอาการแจ้งเตือน
  // เรื่องหนึ่งไปเลื่อนการเตือนอีกเรื่องหนึ่งออกไป ซึ่งเป็นบั๊กที่มองไม่เห็นจากฝั่งไหนเลย
  return res;
}

/** เคยแจ้งเรื่องพวกนี้ไปหรือยัง — คืนเฉพาะคีย์ที่ "ยังไม่เคยแจ้ง" */
// deno-lint-ignore no-explicit-any
export async function unsentKeys(db: any, userId: string, keys: string[]): Promise<string[]> {
  if (!keys.length) return [];
  const { data } = await db.from('push_sent')
    .select('task_id').eq('user_id', userId).in('task_id', keys);
  const seen = new Set((data ?? []).map((r: { task_id: string }) => r.task_id));
  return keys.filter(k => !seen.has(k));
}

/** ปักหมุดว่าแจ้งไปแล้ว · ปักทุกคีย์ ไม่ใช่คีย์เดียว เพราะหนึ่งการแจ้งเตือนครอบหลายเรื่อง */
// deno-lint-ignore no-explicit-any
export async function markSent(db: any, userId: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const at = new Date().toISOString();
  await db.from('push_sent')
    .upsert(keys.map(k => ({ user_id: userId, task_id: k, sent_at: at })));
}
