// ตัวกรองผลของ read-day — แยกไฟล์และไม่มี import เพื่อให้ node ทดสอบได้ตรง ๆ
// (node --test supabase/functions/read-day/__tests__/clean.test.mjs)
//
// โมเดลทำตาม schema เรื่องชนิดข้อมูลได้ แต่ไม่รับประกันว่าค่าสมเหตุสมผล
// ("25:70" ยังเป็น STRING ที่ถูกต้องอยู่ดี) · ของเสียต้องไม่ออกจากเซิร์ฟเวอร์
// ฝั่งแอปกรองซ้ำอีกชั้นใน ctxCleanDay (context.js) เพราะชั้นเดียวคือชั้นที่ลืมแก้ได้

export type DayBlock = { start: string; end: string; title: string };
export type DayRead = {
  date: string; school: boolean | null; away: boolean; blocks: DayBlock[];
  breakUntil: string | null; advice: string; note: string;
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function toMin(s: unknown): number | null {
  const m = HHMM.exec(String(s ?? '').trim());
  return m ? +m[1] * 60 + +m[2] : null;
}
function pad(v: number): string {
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
}

// คิดเป็น UTC ล้วน — วันที่ไม่มีเวลา ไม่ต้องสนเขตเวลาของเซิร์ฟเวอร์
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function cleanInput(body: unknown) {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = String(o.text ?? '').trim().slice(0, 300);
  const today = String(o.today ?? '');
  if (!text || !YMD.test(today)) return null;
  const now = HHMM.test(String(o.now ?? '')) ? String(o.now) : '';
  const summary = String(o.summary ?? '').slice(0, 2000);
  return { text, today, now, summary };
}

export function cleanDay(raw: unknown, today: string): DayRead {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // วันที่ต้องอยู่ในช่วงวันนี้ถึง +7 — "วันเสาร์นี้" ได้ แต่ปีหน้าคือโมเดลเดาผิด
  const dateIn = String(o.date ?? '');
  const date = YMD.test(dateIn) && dateIn >= today && dateIn <= addDays(today, 7) ? dateIn : today;

  const blocks: DayBlock[] = [];
  for (const b of Array.isArray(o.blocks) ? o.blocks : []) {
    const r = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    const a = toMin(r.start), e = toMin(r.end);
    if (a == null || e == null || e <= a) continue;      // ข้ามเที่ยงคืนไม่รับ — ไม่มีใครไปห้างถึงตีสอง
    blocks.push({ start: pad(a), end: pad(e),
      title: String(r.title ?? '').trim().slice(0, 30) || 'ไม่อยู่' });
  }
  blocks.sort((x, y) => (toMin(x.start) ?? 0) - (toMin(y.start) ?? 0));

  const bu = String(o.breakUntil ?? '');
  const breakUntil = YMD.test(bu) && bu > today && bu <= addDays(today, 200) ? bu : null;

  return {
    date,
    school: typeof o.school === 'boolean' ? o.school : null,
    away: o.away === true,
    blocks: blocks.slice(0, 6),
    breakUntil,
    advice: String(o.advice ?? '').trim().slice(0, 160),
    note: String(o.note ?? '').trim().slice(0, 200),
  };
}
