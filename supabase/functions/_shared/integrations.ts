// ============================================================
// integrations — ชั้นกลางที่ทุกตัวเชื่อมใช้ร่วมกัน
// ------------------------------------------------------------
// ไฟล์นี้ตอบสามเรื่อง และตั้งใจไม่ตอบเรื่องที่สี่:
//   1. เก็บกุญแจยังไงให้สำเนาฐานข้อมูลที่หลุดออกไปเปิดไม่ออก
//   2. "งานหนึ่งชิ้น" ในสายตา StudentOS หน้าตาเป็นยังไง (StandardTask)
//   3. ต้นทางแก้ของจริงหรือแค่ขยับ timestamp เฉย ๆ (fingerprint)
//
// เรื่องที่สี่ที่ไม่อยู่ในนี้คือ "คุยกับ API ของแต่ละเจ้ายังไง" — อยู่ในไฟล์ของ
// ตัวเชื่อมแต่ละตัว (ics.ts · classroom.ts) เพื่อให้เพิ่มเจ้าใหม่ = เขียนไฟล์ใหม่
// ไฟล์เดียว โดยไม่ต้องแตะไฟล์นี้หรือไฟล์ของเจ้าอื่นเลยสักบรรทัด
// ============================================================

// ---------- งานหนึ่งชิ้นในรูปแบบของ StudentOS ----------
// ทุกตัวเชื่อมต้องแปลงของจากต้นทางให้เป็นรูปนี้ แล้วชั้นที่เหลือไม่ต้องรู้จักต้นทางอีกเลย
//
// ตั้งใจให้ "แบน" และมีเฉพาะสิ่งที่ API ของต้นทางบอกได้จริง — ไม่มีช่อง priority
// เพราะไม่มี API เจ้าไหนบอกว่างานไหนสำคัญกว่ากันสำหรับเด็กคนนี้ · ความสำคัญเป็น
// สิ่งที่ engine.js คิดเองจากกำหนดส่ง/คะแนน/นิสัยของเจ้าของเครื่อง ไม่ใช่ของที่ import เข้ามา
export type StandardTask = {
  sourceId: string;        // id จากต้นทาง ที่รับประกันว่านิ่งเมื่อเนื้อหาถูกแก้
  title: string;           // ชื่องาน — สิ่งที่นักเรียนอ่านแล้วรู้ว่าต้องทำอะไร
  detail?: string;         // รายละเอียดจากต้นทาง (ตัดให้สั้นแล้ว)
  subject?: string;        // ชื่อวิชา/ชื่อคอร์ส ตามที่ต้นทางเรียก
  due?: string | null;     // ISO 8601 · null = ต้นทางไม่ได้กำหนดส่ง
  url?: string;            // ลิงก์กลับไปที่งานต้นทาง — "ไปดูของจริง" ต้องกดได้เสมอ
  type?: 'homework' | 'exam' | 'event';
  cancelled?: boolean;     // ต้นทางยกเลิก/ลบงานนี้แล้ว
};

// ---------- กุญแจ ----------
// AES-GCM 256 · กุญแจมาจาก Supabase Secrets ไม่ได้อยู่ในฐานข้อมูล
// จึงต้องขโมยสองที่พร้อมกันถึงจะอ่าน refresh token ของใครได้สักเส้น
const KEY_B64 = Deno.env.get('INTEGRATION_KEY') ?? '';

export function cryptoReady(): boolean { return KEY_B64.length >= 32; }

let keyCache: CryptoKey | null = null;
async function aesKey(): Promise<CryptoKey> {
  if (keyCache) return keyCache;
  if (!cryptoReady()) throw new Error('INTEGRATION_KEY ยังไม่ได้ตั้ง');
  const raw = Uint8Array.from(atob(KEY_B64), c => c.charCodeAt(0));
  // 32 ไบต์เป๊ะเท่านั้น — กุญแจสั้นกว่านี้ importKey จะโยน error ที่อ่านไม่รู้เรื่อง
  // ("Invalid key length") ซึ่งไม่ได้บอกเลยว่าต้องไปแก้ที่ค่า secret ไม่ใช่ที่โค้ด
  if (raw.length !== 32) throw new Error('INTEGRATION_KEY ต้องเป็น 32 ไบต์ (openssl rand -base64 32)');
  keyCache = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return keyCache;
}

const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/** เข้ารหัสก่อนเก็บลงคอลัมน์ secret · รูปแบบ v1.<iv>.<ciphertext> */
export async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, await aesKey(), new TextEncoder().encode(plain));
  return `v1.${b64(iv)}.${b64(buf)}`;
}

/** ถอดรหัส · คืน null เมื่อถอดไม่ออก (กุญแจถูกเปลี่ยน · ข้อมูลเสีย) ไม่โยน error
 *  เพราะผู้เรียกทุกรายมีทางเดินต่อที่ถูกต้องอยู่แล้ว: ตั้งสถานะเป็น needs_reauth
 *  แล้วให้ผู้ใช้กดเชื่อมใหม่ — ดีกว่าให้ทั้งรอบ sync ล้มเพราะการเชื่อมเสียเส้นเดียว */
export async function unseal(sealed: string | null): Promise<string | null> {
  if (!sealed) return null;
  const parts = sealed.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  try {
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(parts[1]) }, await aesKey(), unb64(parts[2]));
    return new TextDecoder().decode(buf);
  } catch { return null; }
}

// ---------- ตั๋วสำหรับเดินทางไปหน้า consent แล้วกลับมา ----------
// ปัญหา: Google ส่งผู้ใช้กลับมาที่ oauth-callback ด้วยการเปิด URL ในเบราว์เซอร์
// ซึ่งไม่มีทางแนบ JWT ของเรามาด้วย · ฟังก์ชันนั้นจึงต้องเปิดให้เรียกได้โดยไม่ต้องล็อกอิน
//
// ด่านจริงคือตั๋วใบนี้: เซ็นด้วยกุญแจที่อยู่ในเซิร์ฟเวอร์เท่านั้น บอกว่า "คนที่กดเชื่อม
// คือผู้ใช้คนนี้" และหมดอายุใน 10 นาที · ไม่มีตั๋วนี้ = ใครก็ยิง callback มั่วเพื่อผูก
// บัญชี Google ของตัวเองเข้ากับบัญชี StudentOS ของคนอื่นได้
const STATE_TTL_MS = 10 * 60_000;

async function hmacKey(): Promise<CryptoKey> {
  if (!cryptoReady()) throw new Error('INTEGRATION_KEY ยังไม่ได้ตั้ง');
  const raw = Uint8Array.from(atob(KEY_B64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey('raw', raw,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) =>
  atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));

export async function signState(payload: Record<string, unknown>): Promise<string> {
  const body = b64url(JSON.stringify({ ...payload, x: Date.now() + STATE_TTL_MS }));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(body));
  return `${body}.${b64(sig).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

/** คืน null เมื่อตั๋วปลอม เพี้ยน หรือหมดอายุ — ผู้เรียกต้องหยุดทันทีเมื่อได้ null */
export async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  const dot = String(state || '').lastIndexOf('.');
  if (dot < 1) return null;
  const body = state.slice(0, dot);
  try {
    const sig = Uint8Array.from(unb64url(state.slice(dot + 1)), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), sig,
      new TextEncoder().encode(body));
    if (!ok) return null;
    const payload = JSON.parse(unb64url(body));
    if (typeof payload?.x !== 'number' || Date.now() > payload.x) return null;
    return payload;
  } catch { return null; }
}

// ---------- ลายนิ้วมือของงาน ----------
// คิดจาก "สิ่งที่นักเรียนจะเห็น" เท่านั้น ไม่ใช่จาก payload ดิบ และไม่ใช่จาก updateTime
//
// เหตุผลอยู่ในหัวไฟล์ migration: Classroom ขยับ updateTime ทุกครั้งที่ครูแตะอะไรก็ตาม
// รวมถึงเรื่องที่ไม่เกี่ยวกับนักเรียนเลย · ถ้าเชื่อ updateTime เราจะเด้งแจ้งเตือน
// "งานถูกแก้" ให้เด็กทั้งห้องโดยที่บนจอไม่มีอะไรเปลี่ยนสักตัวอักษร แล้วเขาจะเลิกเชื่อการแจ้งเตือน
export async function fingerprint(t: StandardTask): Promise<string> {
  const face = [t.title, t.detail ?? '', t.subject ?? '', t.due ?? '', t.url ?? '',
    t.type ?? '', t.cancelled ? 'x' : ''].join(' ');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(face));
  return Array.from(new Uint8Array(buf).slice(0, 12))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- ตัวช่วยเล็ก ๆ ที่ทุกตัวเชื่อมต้องใช้เหมือนกัน ----------

/** ตัดข้อความยาวให้พอดีการ์ด · ครูบางคนวางใบงานทั้งใบลงช่องรายละเอียด */
export function clip(s: unknown, max = 400): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** เวลาที่ใช้ได้จริงเท่านั้น — ค่าที่แปลงไม่ได้ต้องกลายเป็น null ไม่ใช่ Invalid Date
 *  ที่เดินทางต่อไปจนถึงหน้าจอแล้วกลายเป็น "NaN" ใต้การ์ดงาน */
export function isoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------- เวลาแบบมีเขตเวลา ----------
// ICS ส่งเวลามาสามแบบ และสองในสามไม่ใช่ UTC:
//   20260917T160000Z              → UTC ตรง ๆ
//   TZID=Asia/Bangkok:...T160000  → เวลาท้องถิ่นของเขตนั้น
//   20260917T160000               → "ลอย" ไม่มีเขตเวลา = เวลาท้องถิ่นของคนอ่าน
//
// แปลงผิดหนึ่งชั่วโมงแล้วงานที่ส่ง 16:00 จะขึ้นว่า 23:00 ซึ่งแย่กว่าไม่มีเวลาเลย
// Deno มี ICU เต็มมาให้ จึงถามออฟเซ็ตจริงของวันนั้นได้ ไม่ต้องเดา ±7 ชั่วโมงตายตัว
// (สำคัญกับประเทศที่มี DST · ไทยไม่มี แต่ตัวเชื่อมนี้ไม่ได้ใช้แค่ในไทย)
export function zonedToUtc(
  y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off = tzOffsetMs(guess, tz);
  // ถามซ้ำรอบสองด้วยเวลาที่ปรับแล้ว — กันกรณีที่จุดนั้นคร่อมเส้นเปลี่ยน DST พอดี
  return new Date(guess - tzOffsetMs(guess - off, tz));
}

function tzOffsetMs(utcMs: number, tz: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p: Record<string, number> = {};
    for (const { type, value } of dtf.formatToParts(new Date(utcMs))) {
      if (type !== 'literal') p[type] = Number(value);
    }
    // 'hour' คืน 24 ได้เมื่อ hour12:false ในบางรันไทม์ — 24:00 ของวันนี้คือ 00:00 ของวันเดียวกัน
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
    return asUtc - utcMs;
  } catch {
    // ชื่อเขตเวลาที่ ICU ไม่รู้จัก (ไฟล์ ICS เก่า ๆ ใช้ชื่อของ Outlook เช่น
    // "SE Asia Standard Time") — ถือว่าเป็น UTC ดีกว่าโยน error ทิ้งทั้งปฏิทิน
    return 0;
  }
}
