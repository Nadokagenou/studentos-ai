// ============================================================
// ตัวเชื่อม · Google Classroom — งานที่ครูมอบหมาย อ่านผ่าน API ทางการ
// ------------------------------------------------------------
// ข้อมูลจาก Classroom มีโครงครบอยู่แล้ว (ชื่องาน · คำสั่ง · กำหนดส่ง · คอร์ส · สถานะส่ง)
// **ไฟล์นี้จึงไม่เรียก AI สักบรรทัด** และต้องไม่เรียกตลอดไป — เอา AI มาเดาสิ่งที่ API
// บอกตรง ๆ อยู่แล้วคือการเพิ่มโอกาสผิดให้กับข้อมูลที่ถูกอยู่แล้ว แถมเสียเงินด้วย
//
// ---------- ด่านที่ต้องผ่านก่อนตัวนี้ทำงานได้จริง (ไม่ใช่เรื่องของโค้ด) ----------
//   1. Google Cloud project + เปิด Classroom API
//   2. OAuth consent screen + Client ID/Secret ตั้งเป็น secret สองตัวข้างล่าง
//   3. scope ที่ใช้ทั้งหมดเป็นชนิด **restricted** ของ Google แปลว่า:
//        · โหมด Testing ใช้ได้เลย แต่จำกัด 100 บัญชี — พอสำหรับห้องนำร่อง
//        · เกินกว่านั้นต้องผ่าน CASA security assessment และต้องต่ออายุทุกปี
//   4. แอดมิน Google Workspace ของโรงเรียนมีสิทธิ์ปิดกั้นแอปนอกทั้งโดเมน
//        ปิดเมื่อไหร่ นักเรียนในโดเมนนั้นเชื่อมไม่ได้เลย และนั่นเป็นสิทธิ์ของโรงเรียนจริง ๆ
//        ไม่ใช่บั๊ก — ต้องขึ้นข้อความบอกผู้ใช้ตรง ๆ ไม่ใช่ปล่อยให้เห็นแค่ "เชื่อมไม่สำเร็จ"
// ============================================================

import { clip } from './integrations.ts';
import type { StandardTask } from './integrations.ts';

export const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

export function classroomReady(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

// ---------- สิทธิ์ที่ขอ — น้อยที่สุดเท่าที่ฟีเจอร์ต้องใช้จริง ----------
// ทุกตัวเป็น readonly และทุกตัวเป็นของ "ฉัน" (.me) ไม่ใช่ของทั้งห้อง
// ไม่ขอ rosters · ไม่ขอ profile.emails ของเพื่อนร่วมห้อง · ไม่ขอคะแนน
// (student-submissions.me ให้คะแนนของตัวเองมาด้วย แต่เราอ่านเฉพาะช่องสถานะ ไม่แตะคะแนน)
//
// userinfo.email มีอยู่ด้วยเหตุผลเดียว และไม่ใช่เหตุผลทางการตลาด: ต้องโชว์ให้ได้ว่า
// "เชื่อมด้วยบัญชีไหน" · เด็กที่มีบัญชีโรงเรียนกับบัญชีส่วนตัวแล้วเผลอกดบัญชีผิด
// จะเห็นแค่ "เชื่อมแล้ว" ที่ไม่มีงานเข้าเลยสักใบ โดยไม่มีอะไรบนจอบอกว่าพลาดตรงไหน
// และมันยังเป็นกุญแจที่ทำให้การกดเชื่อมซ้ำทับของเดิมแทนที่จะสร้างแถวใหม่ทุกครั้ง
const IDENTITY_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

export const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  IDENTITY_SCOPE,
];

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  IDENTITY_SCOPE,
];

/** อีเมลของบัญชีที่เพิ่งอนุญาต · คืนค่าว่างเมื่อถามไม่ได้ ไม่โยน error
 *  เพราะการเชื่อมที่สำเร็จแล้วต้องไม่ล้มเพราะเรื่องป้ายชื่อ */
export async function googleEmail(token: string): Promise<string> {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return '';
    const j = await r.json();
    return typeof j?.email === 'string' ? j.email : '';
  } catch { return ''; }
}

const TIMEOUT_MS = 20_000;

// ---------- กุญแจรอบใหม่จาก refresh token ----------
// access token อายุ 1 ชั่วโมง · refresh token คือของที่เราเก็บไว้จริง (เข้ารหัสแล้ว)
// invalid_grant = ผู้ใช้ถอนสิทธิ์เอง หรือแอดมินโดเมนตัดการเชื่อม — ต้องให้คนกดเชื่อมใหม่
// ลองใหม่เองอีกกี่รอบก็ไม่มีวันหาย จึงต้องแยกออกจาก error ชั่วคราวให้ชัดตั้งแต่ตรงนี้
export async function accessToken(refreshToken: string): Promise<string> {
  if (!classroomReady()) throw new Error('ยังไม่ได้ตั้ง GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = String(j.error || '');
    const err = new Error(code === 'invalid_grant'
      ? 'บัญชี Google ถอนสิทธิ์แล้ว ต้องเชื่อมใหม่'
      : `ขอกุญแจใหม่จาก Google ไม่สำเร็จ (${code || r.status})`);
    if (code === 'invalid_grant') Object.assign(err, { reauth: true });
    throw err;
  }
  return j.access_token as string;
}

/** แลก code จากหน้า consent เป็น refresh token · ทำครั้งเดียวตอนกดเชื่อม */
export async function exchangeCode(code: string, redirectUri: string): Promise<{
  refreshToken: string; accessToken: string; scopes: string[];
}> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code, redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`แลกรหัสกับ Google ไม่สำเร็จ (${j.error || r.status})`);
  // ไม่มี refresh_token กลับมา = ผู้ใช้เคยอนุญาตแอปนี้ไปแล้วรอบก่อน Google เลยไม่ออกใบใหม่
  // ทางแก้คือส่ง prompt=consent ไปตอนเปิดหน้า consent ซึ่ง oauth-start ทำอยู่แล้ว
  if (!j.refresh_token) throw new Error('Google ไม่ได้คืน refresh token — ลองเชื่อมใหม่อีกครั้ง');
  return {
    refreshToken: j.refresh_token as string,
    accessToken: j.access_token as string,
    scopes: String(j.scope || '').split(' ').filter(Boolean),
  };
}

/** ถอนสิทธิ์ที่ฝั่ง Google จริง ๆ ตอนผู้ใช้กดตัดการเชื่อม
 *  ลบแถวในฐานข้อมูลอย่างเดียวไม่พอ — นั่นแค่ทำให้ "เราลืม" แต่สิทธิ์ยังค้างอยู่ในบัญชีเขา */
export async function revokeToken(refreshToken: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch { /* ถอนไม่สำเร็จไม่ควรกันไม่ให้ผู้ใช้ตัดการเชื่อมฝั่งเรา */ }
}

// ---------- เรียก API ----------
async function api(token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://classroom.googleapis.com/v1/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal });
    if (r.status === 401 || r.status === 403) {
      // 403 ของ Classroom ครอบสองเรื่องที่ต่างกันมากสำหรับผู้ใช้: สิทธิ์ถูกถอน
      // กับแอดมินโดเมนปิดกั้นแอปนอก · ข้อความจาก Google อ่านรู้เรื่องพอจะส่งต่อทั้งดุ้น
      const body = await r.json().catch(() => ({}));
      const msg = body?.error?.message || 'ไม่มีสิทธิ์เข้าถึง Classroom';
      throw Object.assign(new Error(msg), { reauth: true });
    }
    if (!r.ok) throw new Error(`Classroom ตอบ ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function pages(token: string, path: string, key: string, params: Record<string, string> = {}) {
  const out: Record<string, unknown>[] = [];
  let pageToken = '';
  // เพดาน 10 หน้า — ห้องเรียนที่มีงานเกิน 1,000 ใบแปลว่ามีอะไรผิดปกติ
  // และเราไม่ควรวนไม่รู้จบเพราะ API ตอบ nextPageToken เดิมซ้ำ ๆ
  for (let i = 0; i < 10; i++) {
    const j = await api(token, path, pageToken ? { ...params, pageToken } : params);
    for (const row of (j[key] || [])) out.push(row);
    pageToken = j.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

// ---------- กำหนดส่ง ----------
// Classroom แยก dueDate (ปี/เดือน/วัน) กับ dueTime (ชั่วโมง/นาที) และทั้งคู่เป็น UTC
// ตามสเปก · งานที่ครูตั้งแค่วันไม่ตั้งเวลาจะไม่มี dueTime มาเลย = ครบกำหนดสิ้นวัน
function dueOf(w: Record<string, any>): string | null {
  const d = w.dueDate;
  if (!d?.year) return null;
  const t = w.dueTime || {};
  const hasTime = t.hours != null || t.minutes != null;
  const dt = new Date(Date.UTC(d.year, (d.month || 1) - 1, d.day || 1,
    hasTime ? (t.hours || 0) : 23, hasTime ? (t.minutes || 0) : 59, 0));
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

/** ดึงงานทั้งหมดที่บัญชีนี้มีสิทธิ์เห็น แล้วแปลงเป็นรูปแบบของ StudentOS */
export async function fetchClassroom(refreshToken: string): Promise<{
  tasks: StandardTask[]; account: string;
}> {
  const token = await accessToken(refreshToken);

  const account = await googleEmail(token);

  const courses = await pages(token, 'courses', 'courses',
    { studentId: 'me', courseStates: 'ACTIVE' });

  const tasks: StandardTask[] = [];
  for (const c of courses) {
    const courseId = String(c.id);
    const subject = clip(c.name, 60);

    const work = await pages(token, `courses/${courseId}/courseWork`, 'courseWork',
      { courseWorkStates: 'PUBLISHED' });

    // สถานะส่งของ "ฉัน" ทั้งคอร์สในคำขอเดียว (courseWorkId = '-')
    // ไม่ดึงตรงนี้ = งานที่ส่งไปแล้วจะโผล่เป็นงานค้างในแผน ซึ่งทำลายความเชื่อถือทั้งระบบ
    const done = new Set<string>();
    try {
      const subs = await pages(token, `courses/${courseId}/courseWork/-/studentSubmissions`,
        'studentSubmissions', { userId: 'me' });
      for (const s of subs) {
        const st = String(s.state || '');
        if (st === 'TURNED_IN' || st === 'RETURNED') done.add(String(s.courseWorkId));
      }
    } catch { /* คอร์สที่อ่านสถานะไม่ได้ ยังดีกว่าไม่ได้งานเลย */ }

    for (const w of work) {
      const id = String(w.id);
      if (done.has(id)) continue;      // ส่งไปแล้ว ไม่ต้องเอาเข้าแผน
      const title = clip(w.title, 140);
      if (!title) continue;
      tasks.push({
        sourceId: `${courseId}:${id}`,
        title,
        detail: clip(w.description, 400),
        subject,
        due: dueOf(w),
        url: typeof w.alternateLink === 'string' ? w.alternateLink : undefined,
        // workType บอกชนิดของ "แบบฝึกหัด" ไม่ได้บอกว่าเป็นข้อสอบ — Classroom ไม่มีช่องนั้น
        // จึงไม่เดาให้ · ปล่อยเป็นการบ้านทั้งหมด แล้วให้เจ้าของเครื่องแก้ใบที่ไม่ใช่เอง
        type: 'homework',
        cancelled: String(w.state || '') === 'DELETED',
      });
      // maxPoints ของ Classroom คือ "เต็มกี่คะแนน" ไม่ใช่ "กี่เปอร์เซ็นต์ของเกรด"
      // ซึ่งเป็นคนละอย่างกับช่อง scorePct ของ StudentOS — แปลงมั่วแล้วเอนจินจะจัดลำดับผิด
      // จึงไม่ส่งมาเลย ดีกว่าส่งตัวเลขที่หน้าตาเหมือนใช่แต่ไม่ใช่
    }
  }
  return { tasks, account };
}

/** ค่าที่ oauth-start ใช้ประกอบ URL หน้าขออนุญาตของ Google */
export function authorizeUrl(opts: {
  redirectUri: string; state: string; scopes: string[]; loginHint?: string;
}): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', opts.scopes.join(' '));
  u.searchParams.set('state', opts.state);
  // offline + consent = บังคับให้ออก refresh token ใหม่ทุกครั้งที่กดเชื่อม
  // ไม่ใส่ prompt=consent แล้วคนที่เคยเชื่อมมาก่อนจะไม่ได้ refresh token กลับมาเลย
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  u.searchParams.set('include_granted_scopes', 'true');
  if (opts.loginHint) u.searchParams.set('login_hint', opts.loginHint);
  return u.toString();
}
