// ============================================================
// appconfig — ค่าตั้งที่เจ้าของระบบแก้จาก Control Center
// ------------------------------------------------------------
// ฝั่งแอปอ่านตารางนี้ผ่าน alt/remote-config.js อยู่แล้ว · ไฟล์นี้คือฝั่งเซิร์ฟเวอร์
// ของเรื่องเดียวกัน เพื่อให้พรอมป์ · เวลาแจ้งเตือน · ค่า OCR แก้ได้โดยไม่ต้อง deploy
//
// กติกาสามข้อ เหมือนฝั่งเบราว์เซอร์ทุกข้อ และสำคัญกว่าด้วยซ้ำ เพราะฟังก์ชันที่ล้ม
// เพราะอ่านค่าตั้งไม่ได้ = ฟีเจอร์ทั้งฟีเจอร์ดับ ไม่ใช่แค่หน้าตาเพี้ยน:
//
//   1. อ่านไม่ได้ = คืน {} เงียบ ๆ · ผู้เรียกต้องมีค่าเริ่มต้นของตัวเองเสมอ
//      **ห้ามมีที่ไหนเขียนว่า cfg.ai.prompt โดยไม่มี ?? DEFAULT ต่อท้าย**
//   2. ไม่บล็อกนานเกิน 3 วินาที · ค่าตั้งไม่คุ้มกับการทำให้คำตอบช้าลง
//   3. แคชในหน่วยความจำ 60 วินาที · instance ถูกใช้ซ้ำหลายคำขอ
//      ยิงทุกคำขอ = เพิ่ม round-trip ให้ทุกคำถามเพื่ออ่านค่าที่เปลี่ยนเดือนละครั้ง
//
// 60 วินาทีแปลว่า "กดเผยแพร่แล้วรอไม่เกินหนึ่งนาที" ซึ่งพอสำหรับงานแอดมิน
// และสั้นพอที่จะไม่ต้องมีปุ่มล้างแคชให้ลืมกด
// ============================================================

export type AppConfig = {
  ai?: {
    prompt?: string; rules?: string;
    provider?: string; temp?: number; maxTokens?: number; dailyCap?: number;
  };
  noti?: {
    flags?: Record<string, boolean>;
    times?: string[];
    examDays?: number;
    quietAfter?: string;
    templates?: Record<string, string>;
    rules?: unknown[];
  };
  ocr?: {
    provider?: string; confidence?: number; retries?: number; timeout?: number;
    autoRetry?: boolean; autoFile?: boolean; keepImg?: boolean;
  };
  features?: Record<string, boolean>;
  exp?: { on?: boolean; id?: string; a?: string; b?: string; split?: number };
};

const TTL_MS = 60_000;
const TIMEOUT_MS = 3_000;

let cache: AppConfig = {};
let cachedAt = 0;
let inflight: Promise<AppConfig> | null = null;

async function fetchConfig(): Promise<AppConfig> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  // อ่านด้วย anon key พอ — policy ของ app_config เปิดให้ทุกคนอ่านอยู่แล้ว
  // (ต้องเปิด เพราะแอปต้องโหลดค่าตั้งได้ตั้งแต่ก่อนรู้ว่าเครื่องนี้มีบัญชีไหม)
  // ใช้ service role ตรงนี้จึงไม่ได้เพิ่มสิทธิ์อะไร มีแต่เพิ่มความเสียหายถ้าหลุด
  const key = Deno.env.get('SUPABASE_ANON_KEY')
    ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return {};

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(
      `${url.replace(/\/+$/, '')}/rest/v1/app_config?select=data&channel=eq.live`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: ctl.signal,
      },
    );
    if (!r.ok) return {};
    const rows = await r.json();
    const data = Array.isArray(rows) && rows[0] ? rows[0].data : null;
    return (data && typeof data === 'object') ? data as AppConfig : {};
  } catch {
    // ตารางยังไม่ได้สร้าง (404) · เน็ตสะดุด · หมดเวลา — ทั้งหมดจบที่เดียวกัน
    // คือ "ใช้ค่าเริ่มต้นของผู้เรียก" ซึ่งเป็นพฤติกรรมที่ถูกต้องของทุกกรณี
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/** อ่านค่าตั้ง · ไม่เคยโยน error · ไม่เคยรอเกิน 3 วินาที */
export async function appConfig(): Promise<AppConfig> {
  const now = Date.now();
  if (now - cachedAt < TTL_MS) return cache;
  // คำขอหลายสายพร้อมกันตอนแคชหมดอายุ ต้องยิงครั้งเดียว ไม่ใช่ยิงพร้อมกันทุกสาย
  if (!inflight) {
    inflight = fetchConfig().then(c => {
      cache = c;
      cachedAt = Date.now();
      inflight = null;
      return c;
    });
  }
  return await inflight;
}

/** ตัวเลขที่อยู่ในช่วงที่ยอมรับได้เท่านั้น · นอกช่วง/ไม่ใช่ตัวเลข → คืนค่าเริ่มต้น */
export function num(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!isFinite(n) || n < min || n > max) return def;
  return n;
}

/** ข้อความที่มีเนื้อจริงเท่านั้น · ว่าง/ช่องว่างล้วน → คืนค่าเริ่มต้น */
export function str(v: unknown, def: string): string {
  return (typeof v === 'string' && v.trim()) ? v.trim() : def;
}

/** เติมค่าลงแม่แบบ {{ชื่อ}} · ชื่อที่ไม่มีข้อมูลถูกลบทิ้ง ไม่ปล่อยให้ {{task}} โผล่บนจอ */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return (v === undefined || v === null) ? '' : String(v);
  }).replace(/\s{2,}/g, ' ').trim();
}
