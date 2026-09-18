// ============================================================
// ตัวเชื่อม · Google Calendar — วันสอบกับกิจกรรมที่โรงเรียนลงปฏิทินไว้
// ------------------------------------------------------------
// ต่างจาก Classroom ตรงที่ของในปฏิทินไม่ใช่ "งานที่ต้องนั่งทำ" แต่เป็น "เรื่องที่ต้องไป"
// จึงลงเป็นชนิด activity ไม่ใช่ homework — ชนิดต่างกันแปลว่า AI Planner ปฏิบัติต่างกัน
// (homework ถูกเจียดเวลาให้นั่งทำ · activity แค่เตือนว่าถึงเวลา ดู TASK_TYPES ใน engine.js)
// ยกเว้นของที่อ่านออกชัด ๆ ว่าเป็นการสอบ ซึ่งต้องเตรียมตัวล่วงหน้าจริง
//
// **ข้ามเหตุการณ์ที่เกิดซ้ำทั้งหมด** ด้วยเหตุผลเดียวกับตัวแกะ ICS เป๊ะ ๆ:
// ปฏิทินของนักเรียนเต็มไปด้วยคาบเรียนประจำสัปดาห์ ซึ่ง StudentOS มีตารางเรียนของตัวเองอยู่แล้ว
// เอาเข้ามาก็ได้งานชื่อ "คณิตศาสตร์" 52 ใบต่อเทอม · การสอบกับกิจกรรมไม่เคยเป็นรายการซ้ำ
// ============================================================

import { clip } from './integrations.ts';
import type { StandardTask } from './integrations.ts';
import { accessToken } from './classroom.ts';

const TIMEOUT_MS = 20_000;

// มองไปข้างหน้า 120 วัน — ครอบคลุมทั้งเทอมโดยไม่ลากปฏิทินทั้งปีลงมา
// และถอยหลัง 1 วันให้พอดีกับกติกา "เลยกำหนดเกิน 24 ชม. ไม่ต้องส่ง" ที่ตัวซิงก์ใช้
const AHEAD_DAYS = 120;
const BEHIND_HOURS = 24;

const EXAM_RE = /\b(exam|midterm|final|quiz|test)\b|สอบ|ควิซ/i;

/** ดึงกิจกรรมจากปฏิทินหลักของผู้ใช้ แล้วแปลงเป็นรูปแบบของ StudentOS */
export async function fetchCalendar(refreshToken: string): Promise<{
  tasks: StandardTask[];
}> {
  const token = await accessToken(refreshToken);

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', new Date(Date.now() - BEHIND_HOURS * 3600_000).toISOString());
  url.searchParams.set('timeMax', new Date(Date.now() + AHEAD_DAYS * 864e5).toISOString());
  // singleEvents = true ให้ API คลี่รายการซ้ำเป็นครั้ง ๆ ให้เอง ซึ่งจำเป็นเพราะเราต้องรู้
  // recurringEventId ของแต่ละครั้งเพื่อ "คัดออก" — ไม่ใช่เพื่อเอาเข้า
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '250');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let j: Record<string, any>;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal });
    if (r.status === 401 || r.status === 403) {
      const b = await r.json().catch(() => ({}));
      throw Object.assign(new Error(b?.error?.message || 'ไม่มีสิทธิ์อ่านปฏิทิน'), { reauth: true });
    }
    if (!r.ok) throw new Error(`Google Calendar ตอบ ${r.status}`);
    j = await r.json();
  } finally { clearTimeout(timer); }

  const tasks: StandardTask[] = [];
  for (const e of (j.items || [])) {
    if (e.recurringEventId) continue;          // คาบเรียนประจำ ไม่ใช่สิ่งที่ต้องเข้าแผน
    if (e.status === 'cancelled' && !e.summary) continue;   // ครั้งที่ถูกลบออกจากชุด
    const title = clip(e.summary, 140);
    if (!title) continue;

    // ปฏิเสธคำเชิญไปแล้ว = ไม่ต้องเอาเข้าแผน · ของที่ยังไม่ตอบถือว่ายังเกี่ยวข้องอยู่
    const me = (e.attendees || []).find((a: Record<string, unknown>) => a.self);
    if (me && me.responseStatus === 'declined') continue;

    // งานทั้งวันมาเป็น date เปล่า ๆ — ถือว่าครบกำหนดสิ้นวันตามเขตเวลาของเหตุการณ์
    // เหตุผลเดียวกับในตัวแกะ ICS: ตั้งเป็นเที่ยงคืนแล้วมันจะขึ้นว่าเลยกำหนดตั้งแต่เช้า
    const due = e.start?.dateTime
      ? new Date(e.start.dateTime).toISOString()
      : (e.start?.date ? new Date(e.start.date + 'T23:59:00' + tzSuffix(e.start.timeZone)).toISOString() : null);

    tasks.push({
      sourceId: String(e.id),
      title,
      detail: clip(e.description, 400),
      subject: '',                              // ปฏิทินไม่มีช่องวิชา อย่าเดาจากชื่อกิจกรรม
      due: due && !isNaN(Date.parse(due)) ? due : null,
      url: typeof e.htmlLink === 'string' ? e.htmlLink : undefined,
      type: EXAM_RE.test(title) ? 'exam' : 'event',
      cancelled: e.status === 'cancelled',
    });
  }
  return { tasks };
}

/** ออฟเซ็ตแบบข้อความสำหรับงานทั้งวัน · ไม่รู้เขตเวลา = ถือว่า UTC ดีกว่าโยนทิ้งทั้งรายการ */
function tzSuffix(tz: string | undefined): string {
  if (!tz) return 'Z';
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const part = fmt.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
    const m = /GMT([+-]\d{2}:\d{2})/.exec(part);
    return m ? m[1] : 'Z';
  } catch { return 'Z'; }
}
