// เทสต์ของ sync-integrations — เน้นชั้นแจ้งเตือน "มีของใหม่เข้ามา"
// รันบน Node ธรรมดา ไม่ต้องมี Deno ไม่ต้องมี Supabase ไม่ยิง push จริง ไม่ยิงเน็ตจริง
// วิธีรัน: ดู README.md ในโฟลเดอร์นี้

// กุญแจ 32 ไบต์ของจริง (สุ่มไว้ตายตัวสำหรับเทสต์เท่านั้น ไม่ใช่กุญแจที่ใช้งานจริง)
const TEST_KEY = Buffer.from(new Uint8Array(32).fill(7)).toString('base64');

let handler = null;
const ENV = {
  SUPABASE_URL: 'http://x',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
  VAPID_PUBLIC_KEY: 'pub',
  VAPID_PRIVATE_KEY: 'priv',
  INTEGRATION_KEY: TEST_KEY,
  GOOGLE_CLIENT_ID: 'cid',
  GOOGLE_CLIENT_SECRET: 'csecret',
};
globalThis.Deno = { env: { get: k => ENV[k] }, serve: h => { handler = h; } };

// ปฏิทินที่ "ต้นทาง" จะตอบกลับมา — เปลี่ยนได้รายเทสต์
let FEED = '';
// ห้องเรียนที่ Classroom API จะตอบกลับมา — คอร์สเดียว งานเปลี่ยนได้รายเทสต์
let CLASSROOM_WORK = [];
// บัญชี Google หลายบัญชีพร้อมกัน — เลือกชุดข้อมูลจาก refresh token ที่ถอดรหัสได้
// (refresh token → access token "at:<rt>" → header Authorization ของทุกคำขอ Classroom)
// null = ใช้ของชุดเดียวข้างบนเหมือนเดิม · ใช้พิสูจน์ว่างานของบัญชีหนึ่งไม่ไหลไปอีกบัญชี
//   { [refreshToken]: { email, courses: [...], teacherCourses: [...],
//                       work: { courseId: [...] }, subs: { courseId: [...] }, tokenError } }
let GOOGLE = null;
// Google ช้า (มิลลิวินาที) รายบัญชี + จำนวนคำขอที่ค้างพร้อมกันสูงสุด — ใช้พิสูจน์ว่าซิงก์หลายบัญชีขนานกัน
let GOOGLE_DELAY = {};
let inFlight = 0, maxInFlight = 0;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (GOOGLE) {
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const rt = new URLSearchParams(String(init?.body ?? '')).get('refresh_token');
      const a = GOOGLE[rt];
      if (!a || a.tokenError) return json({ error: a?.tokenError || 'invalid_grant' }, 400);
      return json({ access_token: 'at:' + rt });
    }
    const auth = String(init?.headers?.Authorization ?? '');
    const rtKey = auth.replace(/^Bearer at:/, '');
    const a = GOOGLE[rtKey];
    if (!a) return json({ error: { message: 'no such token' } }, 401);
    if (GOOGLE_DELAY[rtKey]) {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, GOOGLE_DELAY[rtKey]));
      inFlight--;
    }
    const u = new URL(url);
    if (url.includes('userinfo')) return json({ email: a.email });
    const course = (url.match(/courses\/([^/]+)\//) || [])[1];
    if (url.includes('/studentSubmissions')) return json({ studentSubmissions: (a.subs || {})[course] || [] });
    if (url.includes('/courseWork')) return json({ courseWork: (a.work || {})[course] || [] });
    if (url.includes('classroom.googleapis.com/v1/courses')) {
      return json({ courses: u.searchParams.get('teacherId') === 'me' ? (a.teacherCourses || []) : (a.courses || []) });
    }
  }
  if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'at' });
  if (url.includes('googleapis.com/oauth2') || url.includes('userinfo')) return json({ email: 'student@example.com' });
  // studentSubmissions ต้องมาก่อน courseWork เพราะ URL ของมันมีคำว่า courseWork อยู่ด้วย
  if (url.includes('/studentSubmissions')) return json({ studentSubmissions: [] });
  if (url.includes('/courseWork')) return json({ courseWork: CLASSROOM_WORK });
  if (url.includes('classroom.googleapis.com/v1/courses')) return json({ courses: [{ id: 'c1', name: 'คณิตศาสตร์' }] });
  return new Response(FEED, { status: 200, headers: { 'content-type': 'text/calendar' } });
};

const sb = await import('./sb.mjs');
const wp = await import('./wp.mjs');
const crypto32 = await import('./crypto.mjs');   // seal() ตัวเดียวกับที่ฟังก์ชันใช้
await import('./fn.mjs');

const DAY = 86400000;
// ผู้เรียกที่เชื่อได้ (cron · ฟังก์ชัน integrations) ถือกุญแจ service — ค่าเดียวกับ ENV ข้างบน
const SERVICE = { Authorization: 'Bearer ' + ENV.SUPABASE_SERVICE_ROLE_KEY };
const iso = ms => new Date(ms).toISOString();
// ⚠️ นาฬิกาสองเรือนในเทสต์นี้ และมันเคยทำให้เทสต์ตกทั้งชุดโดยที่โค้ดไม่ผิดเลย:
// เราหยุด Date.now() ไว้เพื่อคุมชั่วโมงไทย แต่ `new Date()` (ไม่มีอาร์กิวเมนต์)
// ไม่ได้เรียก Date.now() มันอ่านนาฬิกาเครื่องตรง ๆ · ตัวฟังก์ชันใช้ `new Date()`
// ตอนกรอง next_sync_at แถวที่ตั้งเวลาไว้ด้วยเวลาที่ถูกหยุดจึงอาจอยู่ "อนาคต" เมื่อเทียบ
// กับเวลาจริง แล้วไม่ถูกเลือกมาซิงก์เลยสักแถว
// คอลัมน์ที่เกี่ยวกับ "ถึงคิวหรือยัง" จึงต้องใช้เวลาจริงเสมอ ไม่ใช่เวลาที่ถูกหยุด
const REAL = Date.now;
const SEALED = await crypto32.seal('https://school.example.edu/feed.ics');

/** สร้างไฟล์ ICS จากรายการงาน */
function feed(items) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const body = items.map((it, i) => [
    'BEGIN:VEVENT',
    'UID:uid-' + (it.uid ?? i),
    'DTSTART:' + stamp(it.due),
    'SUMMARY:' + it.summary,
    'END:VEVENT',
  ].join('\r\n')).join('\r\n');
  return ['BEGIN:VCALENDAR', 'X-WR-CALNAME:ปฏิทินโรงเรียน', body, 'END:VCALENDAR'].join('\r\n');
}

function base(over = {}) {
  return {
    integrations: [{
      id: 'i1', user_id: 'u1', provider: 'ics', account: 'ปฏิทินโรงเรียน',
      secret: SEALED, meta: { tz: 'Asia/Bangkok' }, fail_count: 0,
      status: 'active',
      next_sync_at: iso(REAL() - 7 * DAY),
      // เคยซิงก์มาแล้ว = ไม่ใช่รอบแรก (รอบแรกตั้งใจไม่แจ้งเตือน)
      last_sync_at: iso(REAL() - 7 * DAY),
    }],
    integration_items: [],
    inbox_items: [],
    push_subscriptions: [{ endpoint: 'ep1', user_id: 'u1', p256dh: 'p', auth: 'a' }],
    push_sent: [],
    user_state: [{ id: 'u1', data: { settings: {} } }],
    ...over,
  };
}

async function run(tables) {
  sb.__setTables(tables);
  wp.__sent.length = 0;
  const res = await handler(new Request('http://x', { method: 'POST', body: '{}', headers: SERVICE }));
  const body = await res.json();
  return { body, tables, sent: wp.__sent.map(s => ({ title: s.title, body: s.body, tag: s.tag })) };
}

const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

// เวลากลางวันคงที่สำหรับเทสต์ที่ไม่ได้ทดสอบเรื่องกลางคืน (14:00 ไทย = 07:00 UTC)
// หยุดเวลาไว้ที่ "ชั่วโมงไทยที่ต้องการ ของวันจริงวันนี้" — ต้องเป็นวันจริง ไม่ใช่วันสมมติ
// ด้วยเหตุผลเรื่องนาฬิกาสองเรือนข้างบน
function freezeThaiHour(h) {
  const d = new Date(REAL());
  d.setUTCHours((h - 7 + 24) % 24, 0, 0, 0);
  Date.now = () => d.getTime();
}
function unfreeze() { Date.now = REAL; }

// ============================================================
freezeThaiHour(14);

// ---- 1) มีงานใหม่หลายใบ → ต้องได้ดอกเดียว ไม่ใช่ดอกต่อใบ ----
{
  FEED = feed([
    { summary: 'ใบงานเคมี บทที่ 4', due: Date.now() + 3 * DAY },
    { summary: 'รายงานชีววิทยา', due: Date.now() + 5 * DAY },
  ]);
  const r = await run(base());
  check('งานใหม่ 2 ใบ → push ดอกเดียว', r.sent.length === 1, JSON.stringify(r.sent));
  check('บอกจำนวนในหัวข้อ', /2 ชิ้น/.test(r.sent[0]?.title || ''), r.sent[0]?.title);
  check('ของยังลงกล่องเข้าครบ', r.tables.inbox_items.length === 2, r.tables.inbox_items.length);
  check('ปักหมุดกันซ้ำครบทุกใบ', r.tables.push_sent.length === 2, JSON.stringify(r.tables.push_sent));
}

// ---- 2) ของเยอะมาก (เชื่อมปฏิทินที่มีงานทั้งเทอม) → ยังต้องดอกเดียว ----
{
  FEED = feed(Array.from({ length: 80 }, (_, i) =>
    ({ uid: 'many' + i, summary: 'งานที่ ' + i, due: Date.now() + (i + 1) * DAY })));
  const r = await run(base());
  check('งานใหม่ 80 ใบ → ยังดอกเดียว', r.sent.length === 1, r.sent.length);
  check('80 ใบลงกล่องเข้าครบ', r.tables.inbox_items.length === 80, r.tables.inbox_items.length);
}

// ---- 3) ซิงก์รอบแรก (เพิ่งกดเชื่อม) → ไม่แจ้ง เพราะแอปขึ้น toast ให้แล้ว ----
{
  FEED = feed([{ summary: 'ใบงานเคมี', due: Date.now() + 3 * DAY }]);
  const t = base();
  t.integrations[0].last_sync_at = null;
  const r = await run(t);
  check('รอบแรก → ไม่ push', r.sent.length === 0, JSON.stringify(r.sent));
  check('รอบแรก → ของยังเข้ากล่องเข้า', r.tables.inbox_items.length === 1, r.tables.inbox_items.length);
}

// ---- 4) กันซ้ำ: เคยแจ้งงานใบนี้ไปแล้ว ----
{
  FEED = feed([{ uid: 'dup1', summary: 'ใบงานเคมี', due: Date.now() + 3 * DAY }]);
  const t = base();
  t.push_sent.push({ user_id: 'u1', task_id: 'sync-new::ics::uid-dup1', sent_at: iso(Date.now() - DAY) });
  const r = await run(t);
  check('เคยแจ้งไปแล้ว → ไม่ push ซ้ำ', r.sent.length === 0, JSON.stringify(r.sent));
}

// ---- 5) ผู้ใช้ปิดสวิตช์เตือนเรื่องงาน ----
{
  FEED = feed([{ summary: 'ใบงานเคมี', due: Date.now() + 3 * DAY }]);
  const t = base();
  t.user_state[0].data.settings = { notifDue: false };
  const r = await run(t);
  check('ปิดสวิตช์ → ไม่ push', r.sent.length === 0, JSON.stringify(r.sent));
  check('ปิดสวิตช์ → ของยังเข้ากล่องเข้า', r.tables.inbox_items.length === 1, r.tables.inbox_items.length);
}

// ---- 6) ไม่มีเครื่องที่เปิดแจ้งเตือนไว้เลย ----
{
  FEED = feed([{ summary: 'ใบงานเคมี', due: Date.now() + 3 * DAY }]);
  const t = base();
  t.push_subscriptions.length = 0;
  const r = await run(t);
  check('ไม่มีเครื่องรับ → ไม่พัง', r.body.ok === true, JSON.stringify(r.body));
  check('ไม่มีเครื่องรับ → ยังปักหมุดกันซ้ำ', r.tables.push_sent.length === 1, r.tables.push_sent.length);
}

// ---- 7) งานใบเดียว → บอกชื่อกับกำหนดส่งไปเลย ----
{
  FEED = feed([{ summary: 'ใบงานเคมี บทที่ 4', due: Date.now() + 1 * DAY }]);
  const r = await run(base());
  check('ใบเดียว → หัวข้อว่ามีงานใหม่', /มีงานใหม่เข้ามา/.test(r.sent[0]?.title || ''), r.sent[0]?.title);
  check('ใบเดียว → เนื้อความมีชื่องานจริง', /ใบงานเคมี/.test(r.sent[0]?.body || ''), r.sent[0]?.body);
  check('ใบเดียว → บอกกำหนดส่งเป็นภาษาคน', /พรุ่งนี้/.test(r.sent[0]?.body || ''), r.sent[0]?.body);
}

// ---- 8) การสอบต้องพูดว่า "สอบ" ไม่ใช่ "งาน" ----
{
  FEED = feed([{ summary: 'สอบกลางภาคฟิสิกส์', due: Date.now() + 4 * DAY }]);
  const r = await run(base());
  check('สอบ → หัวข้อบอกว่าสอบ', /สอบ/.test(r.sent[0]?.title || ''), r.sent[0]?.title);
}

// ---- 9) กลางดึกห้ามส่ง ----
{
  freezeThaiHour(2);
  FEED = feed([{ uid: 'night1', summary: 'ใบงานเคมี', due: Date.now() + 3 * DAY }]);
  const r = await run(base());
  check('ตีสอง → ไม่ push', r.sent.length === 0, JSON.stringify(r.sent));
  check('ตีสอง → ของยังเข้ากล่องเข้า', r.tables.inbox_items.length === 1, r.tables.inbox_items.length);
  freezeThaiHour(14);
}

// ---- 10) งานที่เลยกำหนดไปแล้ว ไม่ส่งเข้ากล่องเข้าและไม่แจ้ง ----
{
  FEED = feed([{ uid: 'old1', summary: 'งานเทอมที่แล้ว', due: Date.now() - 30 * DAY }]);
  const r = await run(base());
  check('ของเก่า → ไม่เข้ากล่องเข้า', r.tables.inbox_items.length === 0, r.tables.inbox_items.length);
  check('ของเก่า → ไม่ push', r.sent.length === 0, JSON.stringify(r.sent));
}

// ---- 11) subscription หมดอายุ (410) ต้องถูกลบทิ้ง ----
{
  FEED = feed([{ uid: 'gone1', summary: 'ใบงานเคมี', due: Date.now() + 3 * DAY }]);
  wp.__setFail(() => Object.assign(new Error('gone'), { statusCode: 410 }));
  const t = base();
  const r = await run(t);
  wp.__setFail(null);
  check('410 → ลบ subscription ทิ้ง', r.tables.push_subscriptions.length === 0, r.tables.push_subscriptions.length);
  check('410 → รอบ sync ยังสำเร็จ', r.body.ok === true, JSON.stringify(r.body));
}

// ---- 12) Classroom: งานที่ไม่มีกำหนดส่งและโพสต์ไว้นานแล้ว ไม่ส่งเข้ากล่องเข้า ----
// เจอกับบัญชีจริง (7 ต.ค. 2569): งาน Classroom ไม่มีกำหนดส่ง 72 ใบค้างเป็นงานในแผน
// เพราะด่าน "เก่าเกิน" ดูแค่กำหนดส่ง งานที่ไม่มีกำหนดส่งจึงไม่เคยเก่าเลย ทั้งเทอมไหลเข้ามาหมด
{
  CLASSROOM_WORK = [
    { id: 'w-old', title: 'ใบงานต้นเทอม', state: 'PUBLISHED', creationTime: iso(Date.now() - 40 * DAY) },
    { id: 'w-new', title: 'ใบงานเมื่อวาน', state: 'PUBLISHED', creationTime: iso(Date.now() - 1 * DAY) },
    { id: 'w-due', title: 'การบ้านมีกำหนด', state: 'PUBLISHED', creationTime: iso(Date.now() - 40 * DAY),
      dueDate: (d => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }))(new Date(Date.now() + 3 * DAY)) },
  ];
  const t = base();
  Object.assign(t.integrations[0], { provider: 'google_classroom', account: 'student@example.com',
    secret: await crypto32.seal('refresh-token'), meta: {} });
  const r = await run(t);
  const titles = r.tables.inbox_items.map(x => JSON.stringify(x)).join(' ');
  check('Classroom ไม่มีกำหนด + เก่า → ไม่เข้ากล่องเข้า', !/ใบงานต้นเทอม/.test(titles), titles);
  check('Classroom ไม่มีกำหนด + ใหม่ → ยังเข้า', /ใบงานเมื่อวาน/.test(titles), titles);
  check('Classroom มีกำหนดในอนาคต → ยังเข้า แม้โพสต์ไว้นาน', /การบ้านมีกำหนด/.test(titles), titles);
  check('Classroom → ทะเบียนจำครบทั้ง 3 ใบ', r.tables.integration_items.length === 3, r.tables.integration_items.length);
  CLASSROOM_WORK = [];
}

// ---- 12b) 15 ต.ค. 69 · ของที่เข้ามากลางดึกต้องถูกแจ้งตอนเช้า ไม่ใช่หายเงียบ ----
// ข้อมูลจริง: งานโพสต์ ~21:30 น. · บัญชีที่ซิงก์รอบ 22:00 ไม่เคยได้ดอกแจ้งเตือนเลย
const again = (t) => { t.integrations[0].next_sync_at = iso(REAL() - DAY); return run(t); };
{
  freezeThaiHour(22);
  FEED = feed([{ uid: 'late1', summary: 'ใบงานฟิสิกส์', due: Date.now() + 3 * DAY }]);
  const t = base();
  const r1 = await run(t);
  check('22:00 → ไม่ push · ไม่ปักหมุด', r1.sent.length === 0 && t.push_sent.length === 0, JSON.stringify([r1.sent, t.push_sent]));
  freezeThaiHour(23);
  const r2 = await again(t);
  check('23:00 ไม่มีของใหม่ → ยังเงียบ', r2.sent.length === 0, JSON.stringify(r2.sent));
  // เช้าวันรุ่งขึ้น 07:00 · ไม่มีของใหม่ในรอบนั้นเลย
  const d = new Date(REAL()); d.setUTCHours(0, 0, 0, 0);   // 07:00 ไทย = 00:00 UTC
  Date.now = () => d.getTime() + DAY;
  t.inbox_items[0].created_at = iso(d.getTime() + DAY - 9 * 3.6e6);   // เข้ามาตอน 22:00 คืนก่อน
  const r3 = await again(t);
  check('07:00 → แจ้งของที่ค้างจากเมื่อคืน', r3.sent.length === 1 && /ใบงานฟิสิกส์/.test(r3.sent[0].body), JSON.stringify(r3.sent));
  check('07:00 → ปักหมุดแล้ว', t.push_sent.some(p => /late1/.test(p.task_id)), JSON.stringify(t.push_sent));
  const r4 = await again(t);
  check('รอบถัดไป → ไม่แจ้งซ้ำ', r4.sent.length === 0, JSON.stringify(r4.sent));
  freezeThaiHour(14);
}
{
  // เพิ่งกดเชื่อม: ไม่แจ้ง และรอบถัดไปต้องไม่กวาดทั้งปฏิทินมาแจ้งทีหลัง
  FEED = feed([{ uid: 'f1', summary: 'งานแรก', due: Date.now() + 3 * DAY }, { uid: 'f2', summary: 'งานสอง', due: Date.now() + 4 * DAY }]);
  const t = base();
  t.integrations[0].last_sync_at = null;
  const r1 = await run(t);
  check('รอบแรก → ไม่ push แต่ปักหมุดครบ', r1.sent.length === 0 && t.push_sent.length === 2, JSON.stringify(t.push_sent));
  const r2 = await again(t);
  check('รอบถัดจากรอบแรก → ไม่กวาดของรอบแรกมาแจ้ง', r2.sent.length === 0, JSON.stringify(r2.sent));
}
{
  // ของค้างจากเมื่อคืน + ของใหม่ตอนเช้า → ดอกเดียวรวมกัน
  freezeThaiHour(23);
  FEED = feed([{ uid: 'n1', summary: 'ใบงานคืนนี้', due: Date.now() + 3 * DAY }]);
  const t = base();
  await run(t);
  freezeThaiHour(14);
  t.inbox_items[0].created_at = iso(Date.now() - 6 * 3.6e6);
  FEED = feed([{ uid: 'n1', summary: 'ใบงานคืนนี้', due: Date.now() + 3 * DAY },
               { uid: 'm1', summary: 'ใบงานเช้านี้', due: Date.now() + 2 * DAY }]);
  const r = await again(t);
  check('ค้าง + ใหม่ → ดอกเดียว 2 ชิ้น', r.sent.length === 1 && /2 ชิ้น/.test(r.sent[0].title), JSON.stringify(r.sent));
}

// ============================================================
// หลายบัญชี (15 ต.ค. 69) — "บัญชีผมได้งาน แต่บัญชีนักเรียนคนอื่นไม่ได้"
// ============================================================
const dueIn = days => (d => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }))(new Date(Date.now() + days * DAY));
const posted = iso(Date.now() - DAY);
const gRow = async (id, user, rt, over = {}) => ({
  id, user_id: user, provider: 'google_classroom', account: rt.replace(/^rt-/, '') + '@gmail.com',
  secret: await crypto32.seal(rt), meta: {}, fail_count: 0, status: 'active',
  next_sync_at: iso(REAL() - DAY), last_sync_at: iso(REAL() - DAY),
  updated_at: '2026-10-14T13:50:00.000Z', ...over,
});
const gTables = async rows => base({
  integrations: rows,
  push_subscriptions: [...new Set(rows.map(r => r.user_id))].map(u => ({ endpoint: 'ep-' + u, user_id: u, p256dh: 'p', auth: 'a' })),
  user_state: [...new Set(rows.map(r => r.user_id))].map(u => ({ id: u, data: { settings: {} } })),
});
async function runBody(tables, body) {
  sb.__setTables(tables);
  wp.__sent.length = 0;
  const res = await handler(new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: SERVICE }));
  return { body: await res.json(), tables, sent: wp.__sent.map(s => ({ endpoint: s.endpoint, title: s.title, body: s.body, tag: s.tag })) };
}

// ---- 13) สามบัญชีในรอบ cron เดียวกัน · แต่ละคนต้องได้งานของตัวเองครบ และไม่ได้ของคนอื่น ----
{
  GOOGLE = {
    // A: อยู่สองห้อง (ห้องร่วม + ห้องของตัวเอง)
    'rt-a': { email: 'a@gmail.com', courses: [{ id: 'c-shared', name: 'คณิต' }, { id: 'c-a', name: 'เคมี' }],
      work: { 'c-shared': [{ id: 'w1', title: 'แบบฝึกหัด 1', state: 'PUBLISHED', creationTime: posted, dueDate: dueIn(2) },
                           { id: 'w2', title: 'แบบฝึกหัด 2', state: 'PUBLISHED', creationTime: posted, dueDate: dueIn(3) }],
              'c-a': [{ id: 'wa', title: 'รายงานเคมีของ A', state: 'PUBLISHED', creationTime: posted, dueDate: dueIn(4) }] } },
    // B: ห้องร่วมห้องเดียว และส่ง w2 ไปแล้ว
    'rt-b': { email: 'b@gmail.com', courses: [{ id: 'c-shared', name: 'คณิต' }],
      work: { 'c-shared': [{ id: 'w1', title: 'แบบฝึกหัด 1', state: 'PUBLISHED', creationTime: posted, dueDate: dueIn(2) },
                           { id: 'w2', title: 'แบบฝึกหัด 2', state: 'PUBLISHED', creationTime: posted, dueDate: dueIn(3) }] },
      subs: { 'c-shared': [{ courseWorkId: 'w2', state: 'TURNED_IN' }] } },
    // C: เชื่อมผ่าน แต่บัญชีนี้ไม่ได้เป็นนักเรียนในห้องไหน (อาการของบัญชีที่ได้ศูนย์งานบน production)
    'rt-c': { email: 'c@gmail.com', courses: [], teacherCourses: [] },
  };
  const t = await gTables([await gRow('ia', 'ua', 'rt-a'), await gRow('ib', 'ub', 'rt-b'), await gRow('ic', 'uc', 'rt-c')]);
  const r = await runBody(t, {});
  const inboxOf = u => r.tables.inbox_items.filter(x => x.user_id === u).map(x => x.meta.task.title).sort();
  check('หลายบัญชี → ซิงก์ครบ 3 เส้น', r.body.ran === 3, JSON.stringify(r.body));
  check('A ได้งานของ A ครบ 3 ใบ', JSON.stringify(inboxOf('ua')) === JSON.stringify(['รายงานเคมีของ A', 'แบบฝึกหัด 1', 'แบบฝึกหัด 2']), inboxOf('ua'));
  check('B ได้ห้องร่วมเฉพาะที่ยังไม่ส่ง', JSON.stringify(inboxOf('ub')) === JSON.stringify(['แบบฝึกหัด 1']), inboxOf('ub'));
  check('ไม่รั่ว: งานห้อง c-a ไม่ไปถึงใครนอกจาก A',
    r.tables.inbox_items.filter(x => String(x.meta.sourceId).startsWith('c-a:')).every(x => x.user_id === 'ua'),
    JSON.stringify(r.tables.inbox_items.map(x => [x.user_id, x.meta.sourceId])));
  check('ไม่รั่ว: ทะเบียนทุกแถวเป็นของเจ้าของเส้นนั้น',
    r.tables.integration_items.every(x => x.user_id === t.integrations.find(i => i.id === x.integration_id).user_id),
    JSON.stringify(r.tables.integration_items.map(x => [x.integration_id, x.user_id])));
  check('ไม่รั่ว: แถว inbox บอกบัญชีต้นทางถูก',
    r.tables.inbox_items.every(x => x.meta.account === t.integrations.find(i => i.user_id === x.user_id).account),
    JSON.stringify(r.tables.inbox_items.map(x => [x.user_id, x.meta.account])));
  check('C ได้ศูนย์งาน', inboxOf('uc').length === 0, inboxOf('uc'));
  const dc = t.integrations.find(i => i.id === 'ic').meta.diag || {};
  check('C → diag บอกว่าไม่อยู่ในห้องไหน', dc.coursesStudent === 0 && dc.coursesTeacher === 0, JSON.stringify(dc));
  const db_ = t.integrations.find(i => i.id === 'ib').meta.diag || {};
  check('B → diag นับงาน 2 ส่งแล้ว 1', db_.coursesStudent === 1 && db_.work === 2 && db_.turnedIn === 1, JSON.stringify(db_));
  check('ไม่มีใครถูกตีว่าต้องเชื่อมใหม่', t.integrations.every(i => i.status === 'active'), t.integrations.map(i => i.status));
}

// ---- 14) บัญชีที่เป็น "ครู" ของห้อง → diag แยกออกจาก "ไม่อยู่ห้องไหน" ----
{
  GOOGLE = { 'rt-t': { email: 't@gmail.com', courses: [], teacherCourses: [{ id: 'c-shared' }] } };
  const t = await gTables([await gRow('it', 'ut', 'rt-t')]);
  await runBody(t, {});
  const d = t.integrations[0].meta.diag || {};
  check('ครู → coursesTeacher = 1', d.coursesStudent === 0 && d.coursesTeacher === 1, JSON.stringify(d));
}

// ---- 15) กุญแจหมดอายุ (invalid_grant) ตอนกลางวัน → ต้องเชื่อมใหม่ + แจ้งเจ้าตัวดอกเดียว ----
{
  GOOGLE = { 'rt-x': { email: 'x@gmail.com', tokenError: 'invalid_grant' } };
  const t = await gTables([await gRow('ix', 'ux', 'rt-x')]);
  const r = await runBody(t, {});
  check('invalid_grant → needs_reauth', t.integrations[0].status === 'needs_reauth', t.integrations[0].status);
  check('invalid_grant → แจ้งเจ้าตัว 1 ดอก', r.sent.length === 1 && r.sent[0].tag === 'integ-reauth', JSON.stringify(r.sent));
  check('แจ้งถึงเครื่องของเจ้าของเท่านั้น', r.sent.every(s => s.endpoint === 'ep-ux'), JSON.stringify(r.sent));
  // วันรุ่งขึ้นลองใหม่แล้วยังตาย (กุญแจชุดเดิม) → ต้องไม่ดังซ้ำ
  const r2 = await runBody(t, { integration_id: 'ix' });
  check('กุญแจชุดเดิมตายซ้ำ → ไม่ดังซ้ำ', r2.sent.length === 0, JSON.stringify(r2.sent));
  // กดเชื่อมใหม่ (updated_at ขยับ) แล้วกุญแจชุดใหม่ตายอีก → แจ้งได้อีกครั้ง
  t.integrations[0].updated_at = '2026-10-21T13:50:00.000Z';
  const r3 = await runBody(t, { integration_id: 'ix' });
  check('กุญแจชุดใหม่ตาย → แจ้งอีกครั้ง', r3.sent.length === 1, JSON.stringify(r3.sent));
}

// ---- 16) กุญแจหมดอายุตอนตีสอง → ไม่ปลุก และนัดลองใหม่ตอนเช้า (ไม่ใช่ +24 ชม. ที่ตกกลางดึกอีก) ----
{
  freezeThaiHour(2);
  GOOGLE = { 'rt-y': { email: 'y@gmail.com', tokenError: 'invalid_grant' } };
  const t = await gTables([await gRow('iy', 'uy', 'rt-y')]);
  const r = await runBody(t, {});
  const next = new Date(t.integrations[0].next_sync_at);
  const thHour = (next.getUTCHours() + 7) % 24;
  check('ตีสอง → ไม่ push', r.sent.length === 0, JSON.stringify(r.sent));
  check('ตีสอง → นัดลองใหม่ 07:xx น. ไทย', thHour === 7 && next.getTime() > REAL(), t.integrations[0].next_sync_at);
  freezeThaiHour(14);
}
// ---- 17) ครูกด "คืน" ทั้งที่นักเรียนไม่เคยส่ง → ยังเป็นงานค้าง ต้องเข้าแผน ----
// เดิมนับ RETURNED ว่าส่งแล้วทุกใบ — บัญชีจริง (15 ต.ค. 69) ขึ้น "ส่งแล้ว 20/20" ซึ่งแยกไม่ออกว่ามีแบบนี้ปนไหม
{
  const TI = { stateHistory: { state: 'TURNED_IN', stateTimestamp: posted } };
  const RT = { stateHistory: { state: 'RETURNED', stateTimestamp: posted } };
  const CR = { stateHistory: { state: 'CREATED', stateTimestamp: posted } };
  GOOGLE = { 'rt-r': { email: 'r@gmail.com', courses: [{ id: 'c-r', name: 'ฟิสิกส์' }],
    work: { 'c-r': ['w-ti', 'w-ret-sub', 'w-ret-nosub', 'w-ret-nohist', 'w-new'].map((id, i) =>
      ({ id, title: 'งาน ' + id, state: 'PUBLISHED', creationTime: posted, dueDate: dueIn(i + 1) })) },
    subs: { 'c-r': [
      { courseWorkId: 'w-ti', state: 'TURNED_IN', submissionHistory: [CR, TI] },
      { courseWorkId: 'w-ret-sub', state: 'RETURNED', submissionHistory: [CR, TI, RT] },
      { courseWorkId: 'w-ret-nosub', state: 'RETURNED', submissionHistory: [CR, RT] },
      { courseWorkId: 'w-ret-nohist', state: 'RETURNED' },
      { courseWorkId: 'w-new', state: 'CREATED', submissionHistory: [CR] },
    ] } } };
  const t = await gTables([await gRow('ir', 'ur', 'rt-r')]);
  const r = await runBody(t, {});
  const got = r.tables.inbox_items.map(x => x.meta.sourceId.split(':')[1]).sort();
  check('คืนโดยไม่เคยส่ง → เข้าแผน · ส่งแล้ว/คืนหลังส่ง → ไม่เข้า',
    JSON.stringify(got) === JSON.stringify(['w-new', 'w-ret-nosub']), JSON.stringify(got));
  const d = t.integrations[0].meta.diag || {};
  check('diag แยกสามแบบถูก', d.work === 5 && d.turnedIn === 1 && d.returned === 2
    && d.returnedUnsubmitted === 1 && d.done === 3 && d.returnedNoHistory === 1, JSON.stringify(d));
  check('ไม่มีประวัติ + ยังไม่เลยกำหนด → นับว่าอาจหายผิด 1 ใบ', d.returnedNoHistoryOpen === 1, JSON.stringify(d));
}

// ---- 17b) ไม่มีประวัติ แต่เลยกำหนดไปแล้ว → ไม่นับ (ต่อให้ค้างก็ไม่เข้าแผนอยู่ดี) ----
{
  GOOGLE = { 'rt-o': { email: 'o@gmail.com', courses: [{ id: 'c-o', name: 'ไทย' }],
    work: { 'c-o': [
      { id: 'w-old', title: 'งานเก่า', state: 'PUBLISHED', creationTime: iso(Date.now() - 30 * DAY), dueDate: dueIn(-10) },
      { id: 'w-old-nodue', title: 'งานเก่าไม่มีกำหนด', state: 'PUBLISHED', creationTime: iso(Date.now() - 30 * DAY) },
    ] },
    subs: { 'c-o': [{ courseWorkId: 'w-old', state: 'RETURNED' }, { courseWorkId: 'w-old-nodue', state: 'RETURNED' }] } } };
  const t = await gTables([await gRow('io', 'uo', 'rt-o')]);
  await runBody(t, {});
  const d = t.integrations[0].meta.diag || {};
  check('ไม่มีประวัติ + เลยกำหนดแล้ว → ไม่นับ', d.returnedNoHistory === 2 && d.returnedNoHistoryOpen === 0, JSON.stringify(d));
}
// ---- 18) รอบถัดไปต้องไม่ถูกข้าม: นัดต้องมาก่อนรอบ cron ถัดไปเสมอ ไม่ว่ารอบนี้จะเริ่มช้าหรือนานแค่ไหน ----
// 15 ต.ค. 69: นัด +30 นาทีจากตอนเสร็จ = ช้ากว่ารอบ cron ไปสิบวิ → ข้ามทุกรอบเว้นรอบ
// 16 ต.ค. 69: Classroom ซิงก์ทุก 1 นาที · นัดเทียบกับนาทีที่รอบนี้เริ่ม ลบ 1 วิ (ไม่ใช่เทียบกับตอนเสร็จ)
{
  const tick = Math.floor(Date.now() / 60_000) * 60_000;   // cron ยิงตรงต้นนาที
  Date.now = () => tick + 10_000;                           // เริ่ม/เสร็จช้าไปสิบวิ (cold start)
  GOOGLE = { 'rt-g': { email: 'g@gmail.com', courses: [] } };
  const t = await gTables([await gRow('ig', 'ug', 'rt-g')]);
  await runBody(t, {});
  const next = Date.parse(t.integrations[0].next_sync_at);
  check('Classroom: นัดรอบถัดไปไม่เลยรอบ cron +1 นาที', next <= tick + 60_000, new Date(next).toISOString());
  check('Classroom: และไม่ถี่เกินตั้งใจ (ไม่เร็วกว่า +50 วิ)', next >= tick + 50_000, new Date(next).toISOString());
  // ปฏิทินโรงเรียน (ICS) ยังเป็นทุก 30 นาที — ฟีดไม่ได้เปลี่ยนบ่อย และ ETag ทำให้รอบส่วนใหญ่ว่างเปล่า
  GOOGLE = null;
  FEED = feed([{ uid: 'cal1', summary: 'สอบ', due: Date.now() + 3 * DAY }]);
  const ti = base();
  await runBody(ti, {});
  const nextI = Date.parse(ti.integrations[0].next_sync_at);
  check('ICS: นัดรอบถัดไปไม่เลย +30 นาที', nextI <= tick + 30 * 60_000, new Date(nextI).toISOString());
  check('ICS: และไม่เร็วกว่า +29 นาที', nextI >= tick + 29 * 60_000, new Date(nextI).toISOString());
  Date.now = () => tick;
}

// ============================================================
// 16 ต.ค. 69 · ตรวจทั้งท่อ end-to-end — ข้อบกพร่องที่จำลองด้วยบันเดิลจริงแล้วเจอ
// ทุกเทสต์ข้างล่างตกกับโค้ดก่อนแก้ (ดูผลรันใน commit message) ไม่ใช่แค่ผ่านอยู่แล้ว
// ============================================================
// ถึงคิวทุกครั้ง — next_sync_at ถูกนัดด้วยนาฬิกาที่หยุดไว้ แต่ตัวกรองใช้นาฬิกาจริง (ดูหมายเหตุนาฬิกาสองเรือน)
const rerun = t => { for (const i of t.integrations) i.next_sync_at = iso(REAL() - DAY); return runBody(t, {}); };
const pWork = (id, days) => ({ id, title: 'งาน ' + id, state: 'PUBLISHED', creationTime: posted, dueDate: dueIn(days) });
const inboxFor = (t, wid) => t.inbox_items.filter(x => x.meta.sourceId === 'c-p:' + wid);
const ledgerOf = (t, wid) => t.integration_items.find(x => x.source_id === 'c-p:' + wid);

// ---- 19) งานที่ปิดทะเบียนไปแล้วกลับมาค้างอีก → ต้องส่งกลับเข้าแอป ----
// เดิม: ลายนิ้วมือเท่าเดิม + เคยส่งแล้ว → ข้ามตลอดไป ทะเบียนค้างเป็น cancelled ทั้งที่งานกลับมาแล้ว
// เกิดได้จริงเมื่อนักเรียนกด "ยกเลิกการส่ง" · ครูคืนงานให้แก้ · หรือ Classroom ตอบห้องหนึ่งหายไปชั่วคราว
{
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('w1', 3), pWork('w2', 4)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  await rerun(t);
  // รอบ 2: นักเรียนกดส่ง w1 · ครูลบ w2 ทิ้ง
  GOOGLE['rt-p'].subs['c-p'] = [{ courseWorkId: 'w1', state: 'TURNED_IN' }];
  GOOGLE['rt-p'].work['c-p'] = [pWork('w1', 3)];
  await rerun(t);
  check('กดส่งใน Classroom → ทะเบียนจดว่า done ไม่ใช่ cancelled', ledgerOf(t, 'w1')?.state === 'done', ledgerOf(t, 'w1')?.state);
  const c1 = inboxFor(t, 'w1').find(x => x.meta.op === 'cancel');
  check('กดส่งใน Classroom → แนบเหตุผล turned_in ไปกับแถวที่ส่งให้แอป', c1?.meta.reason === 'turned_in', JSON.stringify(c1?.meta));
  const c2 = inboxFor(t, 'w2').find(x => x.meta.op === 'cancel');
  check('ครูลบงาน → ยังเป็น cancel ธรรมดา ไม่มีเหตุผล turned_in', c2 && c2.meta.reason !== 'turned_in' && ledgerOf(t, 'w2')?.state === 'cancelled',
    JSON.stringify([c2?.meta, ledgerOf(t, 'w2')?.state]));
  // รอบ 3: นักเรียนกดยกเลิกการส่ง w1 · ครูเอา w2 กลับมา
  GOOGLE['rt-p'].subs['c-p'] = [{ courseWorkId: 'w1', state: 'RECLAIMED_BY_STUDENT' }];
  GOOGLE['rt-p'].work['c-p'] = [pWork('w1', 3), pWork('w2', 4)];
  const r3 = await rerun(t);
  const back1 = inboxFor(t, 'w1').at(-1), back2 = inboxFor(t, 'w2').at(-1);
  check('งานที่ส่งแล้วกลับมาค้าง → ส่งกลับเข้าแอป', back1?.meta.op === 'update', JSON.stringify(inboxFor(t, 'w1').map(x => x.meta.op)));
  check('งานที่ถูกลบกลับมา → ส่งกลับเข้าแอป', back2?.meta.op === 'update', JSON.stringify(inboxFor(t, 'w2').map(x => x.meta.op)));
  check('กลับมาแล้ว → ทะเบียนกลับเป็น active', ledgerOf(t, 'w1')?.state === 'active' && ledgerOf(t, 'w2')?.state === 'active',
    JSON.stringify([ledgerOf(t, 'w1')?.state, ledgerOf(t, 'w2')?.state]));
  check('งานที่กลับมา → ไม่ push (ไม่ใช่งานใหม่)', r3.sent.length === 0, JSON.stringify(r3.sent));
  const r4 = await rerun(t);
  check('รอบถัดไป → ไม่ส่งซ้ำ', t.inbox_items.length === inboxFor(t, 'w1').length + inboxFor(t, 'w2').length && r4.body.results[0].sent === 0,
    JSON.stringify(r4.body));
}

// ---- 19b) ต้นทางส่งงานมาพร้อมธง "ยกเลิก" (ICS STATUS:CANCELLED) ทุกรอบ → แจ้งแอปครั้งเดียวพอ ----
// กันข้อ 19 ไม่ให้ตีความใบที่ยังถูกยกเลิกอยู่ว่า "กลับมาแล้ว" แล้วส่ง cancel ซ้ำทุก 30 นาทีไปตลอด
{
  const due = Date.now() + 3 * DAY;
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const cal = status => ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:uid-cx', 'DTSTART:' + stamp(due),
    'SUMMARY:ทัศนศึกษา', ...(status ? ['STATUS:' + status] : []), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  GOOGLE = null;   // ไม่งั้นตัวจำลองตอบ 401 ให้ลิงก์ปฏิทิน
  const t = base();
  FEED = cal('');
  await rerun(t);
  FEED = cal('CANCELLED');
  await rerun(t);
  await rerun(t);
  await rerun(t);
  const ops = t.inbox_items.map(x => x.meta.op);
  check('ยกเลิกค้างอยู่หลายรอบ → ส่ง cancel แค่ครั้งเดียว', JSON.stringify(ops) === JSON.stringify(['new', 'cancel']), JSON.stringify(ops));
}

// ---- 20) รอบที่ล้มหลังจดทะเบียนแต่ก่อนเขียนกล่องเข้า → รอบหน้าต้องส่งเป็น "ของใหม่" และแจ้งเตือน ----
// เดิม: ทะเบียนมีแถวแล้ว (ยังไม่เคยส่ง) → รอบหน้าส่งเป็น op 'update' → แอปยังสร้างงานให้ แต่ไม่มีดอกแจ้งเตือนเลย
{
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('w9', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  // 29 ต.ค. 69 · ล้มจริงแทนการแก้ตารางหลังรอบที่สำเร็จ — รอบที่สำเร็จจำลายนิ้วมือของรายการไว้แล้ว
  // (ดูหัวข้อ 25) การแก้ทะเบียนทีหลังจึงไม่ใช่สภาพที่รอบที่ล้มทิ้งไว้จริง
  // ทะเบียนจดแล้ว แต่เขียนกล่องเข้าไม่ได้ → รอบนั้น throw · หมุดกันซ้ำและ sent_fingerprint ไม่ถูกเขียน
  t.__fail = { 'insert inbox_items': true };
  const r0 = await rerun(t);
  delete t.__fail;
  check('ล้มกลางทาง → รอบนั้นจบด้วย error และทะเบียนยังไม่ถูกปักว่าส่งแล้ว',
    r0.body.results?.[0]?.status === 'error' && ledgerOf(t, 'w9') && !ledgerOf(t, 'w9').sent_fingerprint && t.inbox_items.length === 0,
    JSON.stringify([r0.body, ledgerOf(t, 'w9')]));
  const r = await rerun(t);
  check('ล้มกลางทาง → รอบหน้าส่งเป็นของใหม่', inboxFor(t, 'w9')[0]?.meta.op === 'new', JSON.stringify(inboxFor(t, 'w9').map(x => x.meta.op)));
  check('ล้มกลางทาง → รอบหน้าได้แจ้งเตือน', r.sent.length === 1 && /งาน w9/.test(r.sent[0].body), JSON.stringify(r.sent));
}

// ---- 21) push ล้มชั่วคราวทุกเครื่อง → ห้ามปักหมุดว่าแจ้งแล้ว และรอบหน้าต้องลองใหม่ ----
// เดิม: ปักหมุดเสมอแม้ส่งไม่ถึงสักเครื่อง → ดอกนั้นหายถาวร โดยไม่มีอะไรบันทึกไว้เลย
{
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('wf', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  wp.__setFail(() => Object.assign(new Error('fcm down'), { statusCode: 500 }));
  const r1 = await rerun(t);
  wp.__setFail(null);
  check('500 ทุกเครื่อง → ไม่ปักหมุด', !t.push_sent.some(p => /wf/.test(p.task_id)), JSON.stringify(t.push_sent));
  check('500 ทุกเครื่อง → subscription ยังอยู่', t.push_subscriptions.length === 1, t.push_subscriptions.length);
  const r2 = await rerun(t);
  check('รอบหน้า (FCM กลับมา) → ได้ดอกที่ค้าง', r2.sent.length === 1 && /งาน wf/.test(r2.sent[0].body), JSON.stringify(r2.sent));
  check('ส่งถึงแล้ว → ปักหมุด', t.push_sent.some(p => /wf/.test(p.task_id)), JSON.stringify(t.push_sent));
  const r3 = await rerun(t);
  check('รอบถัดไป → ไม่ดังซ้ำ', r3.sent.length === 0, JSON.stringify(r3.sent));
}
{
  // เครื่องหนึ่งถึง อีกเครื่องล้ม → ปักหมุด (ไม่งั้นเครื่องที่ได้แล้วโดนซ้ำ)
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('wh', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  t.push_subscriptions.push({ endpoint: 'ep-up-2', user_id: 'up', p256dh: 'p', auth: 'a' });
  wp.__setFail(s => s.endpoint === 'ep-up-2' ? Object.assign(new Error('x'), { statusCode: 503 }) : null);
  await rerun(t);
  wp.__setFail(null);
  check('ถึงบางเครื่อง → ปักหมุด', t.push_sent.some(p => /wh/.test(p.task_id)), JSON.stringify(t.push_sent));
}
{
  // ทุกเครื่องตายถาวร (410) → ลบเครื่อง + ปักหมุด ไม่วนลองทุกรอบตลอดไป
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('wg', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  wp.__setFail(() => Object.assign(new Error('gone'), { statusCode: 410 }));
  await rerun(t);
  wp.__setFail(null);
  check('410 ทุกเครื่อง → ปักหมุด (ไม่ใช่ล้มชั่วคราว)', t.push_sent.some(p => /wg/.test(p.task_id)), JSON.stringify(t.push_sent));
}

// ---- 22) บันทึกผลรอบซิงก์รายบัญชี — cron หมดเวลา 5 วิทุกรอบ ผลจึงไม่เคยถูกเก็บที่ไหนเลย ----
{
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('wl', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  t.push_subscriptions.push({ endpoint: 'ep-up-2', user_id: 'up', p256dh: 'p', auth: 'a' });
  wp.__setFail(s => s.endpoint === 'ep-up-2' ? Object.assign(new Error('x'), { statusCode: 503 }) : null);
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  await rerun(t);
  console.log = orig;
  wp.__setFail(null);
  const lr = t.integrations[0].meta.last_run || {};
  check('last_run ถูกเขียนลง meta', lr.status === 'ok' && typeof lr.at === 'string' && typeof lr.ms === 'number', JSON.stringify(lr));
  check('last_run นับงาน/ส่งเข้ากล่อง', lr.tasks === 1 && lr.delivered === 1, JSON.stringify(lr));
  check('last_run บอกผลส่ง push รายเครื่อง', lr.push?.devices === 2 && lr.push?.ok === 1 && lr.push?.failed === 1
    && (lr.push?.codes || []).includes(503), JSON.stringify(lr.push));
  check('log หนึ่งบรรทัดต่อบัญชี (อ่านได้จาก Function logs)', logs.some(l => l.startsWith('[sync-run]') && l.includes('"integration":"ip"')), JSON.stringify(logs));
  // รอบที่ล้ม → last_run บอกว่าล้มเพราะอะไร
  GOOGLE['rt-p'].tokenError = 'server_error';
  await rerun(t);
  const lr2 = t.integrations[0].meta.last_run || {};
  check('รอบที่ล้ม → last_run.status = error พร้อมข้อความ', lr2.status === 'error' && /server_error/.test(lr2.error || ''), JSON.stringify(lr2));
  check('รอบที่ล้ม → ไม่ลบ diag เดิมทิ้ง', !!t.integrations[0].meta.diag, JSON.stringify(t.integrations[0].meta));
}
// ---- 23) แยกรายบัญชีฝั่งเซิร์ฟเวอร์: คนที่ไม่ได้ถือกุญแจ service สั่งซิงก์ "บัญชีของคนอื่น" ไม่ได้ และไม่เห็นผลรายบัญชี ----
// กุญแจ publishable อยู่ใน repo สาธารณะ · เดิมใครก็ส่ง integration_id ของคนอื่นมาสั่งซิงก์ได้ และคำตอบมี id + ตัวเลขของทุกบัญชี
{
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }], work: { 'c-p': [pWork('wz', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  const call = async (body, headers) => { sb.__setTables(t); for (const i of t.integrations) i.next_sync_at = iso(REAL() - DAY);
    const res = await handler(new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers }));
    return { status: res.status, body: await res.json() }; };
  const r1 = await call({ integration_id: 'ip' }, { Authorization: 'Bearer sb_publishable_xxx' });
  check('integration_id จากผู้เรียกทั่วไป → ปฏิเสธ 403', r1.status === 403, JSON.stringify(r1));
  check('integration_id จากผู้เรียกทั่วไป → ไม่ได้ซิงก์', t.inbox_items.length === 0 && !t.integrations[0].last_run_seen, JSON.stringify(t.inbox_items));
  const r2 = await call({}, { Authorization: 'Bearer sb_publishable_xxx' });
  check('รอบ cron ด้วยกุญแจทั่วไป → ยังซิงก์ได้', r2.status === 200 && t.inbox_items.length === 1, JSON.stringify(r2));
  check('รอบ cron ด้วยกุญแจทั่วไป → คำตอบไม่มีรายบัญชี (ไม่มี id)', !('results' in r2.body) && !JSON.stringify(r2.body).includes('"ip"'), JSON.stringify(r2.body));
  check('รอบ cron ด้วยกุญแจทั่วไป → ยังมีตัวเลขรวมให้ตรวจ', r2.body.ran === 1 && r2.body.ok_count === 1 && r2.body.error_count === 0, JSON.stringify(r2.body));
  const r3 = await call({ integration_id: 'ip' }, SERVICE);
  check('integration_id จากกุญแจ service → ซิงก์ได้และเห็นผล', r3.status === 200 && Array.isArray(r3.body.results), JSON.stringify(r3.body));
}
// ---- 24) ซิงก์ทุก 1 นาที: รอบที่ซ้อนกันต้องไม่ทำงานซ้ำ ไม่ส่งซ้ำ ไม่แจ้งซ้ำ ----
// cron ทุกนาที + บัญชี 23 ห้องใช้ ~20 วิ = มีวันที่รอบใหม่เริ่มก่อนรอบเก่าจบ · สองรอบซิงก์บัญชีเดียวกันพร้อมกัน
// = ทั้งคู่เห็นงานใหม่ใบเดียวกัน → กล่องเข้าได้สองแถว และ push สองดอก · กันด้วยการจองแถว (sync_lease_until)
{
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }], work: { 'c-p': [pWork('wl1', 3)] }, subs: { 'c-p': [] } } };
  GOOGLE_DELAY = { 'rt-p': 40 };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  for (const i of t.integrations) i.next_sync_at = iso(REAL() - DAY);
  sb.__setTables(t); wp.__sent.length = 0;
  const call = () => handler(new Request('http://x', { method: 'POST', body: '{}', headers: SERVICE })).then(r => r.json());
  const [a, b] = await Promise.all([call(), call()]);
  GOOGLE_DELAY = {};
  check('สองรอบพร้อมกัน → ซิงก์บัญชีนี้รอบเดียว', a.ran + b.ran === 1, JSON.stringify([a, b]));
  check('สองรอบพร้อมกัน → กล่องเข้าได้แถวเดียว', inboxFor(t, 'wl1').length === 1, JSON.stringify(t.inbox_items.map(x => x.meta.sourceId)));
  check('สองรอบพร้อมกัน → push ดอกเดียว', wp.__sent.length === 1, JSON.stringify(wp.__sent.map(x => x.title)));
  check('จบรอบแล้วคืนการจอง', t.integrations[0].sync_lease_until == null, String(t.integrations[0].sync_lease_until));
}
{
  // "ซิงก์เดี๋ยวนี้" ระหว่างที่ cron กำลังซิงก์บัญชีเดียวกันอยู่ → ไม่ซ้อน (ตอบว่ากำลังซิงก์อยู่)
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }], work: { 'c-p': [pWork('wl2', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  t.integrations[0].sync_lease_until = iso(Date.now() + 60_000);   // รอบ cron จองไว้อยู่ (นาฬิกาเดียวกับฟังก์ชัน)
  const r = await runBody(t, { integration_id: 'ip' });
  check('ซิงก์เดี๋ยวนี้ระหว่างที่จองอยู่ → ไม่ซิงก์ซ้อน', r.body.ran === 0 && t.inbox_items.length === 0, JSON.stringify(r.body));
  t.integrations[0].sync_lease_until = iso(Date.now() - 1000);     // การจองที่ค้างจากรอบที่ตาย (หมดเวลาแล้ว)
  const r2 = await runBody(t, { integration_id: 'ip' });
  check('การจองที่หมดอายุแล้ว (รอบเก่าตายกลางทาง) → ซิงก์ต่อได้', r2.body.ran === 1 && inboxFor(t, 'wl2').length === 1, JSON.stringify(r2.body));
}
{
  // ล้มกลางรอบ → ต้องคืนการจองด้วย ไม่งั้นบัญชีนั้นหยุดซิงก์จนกว่าการจองจะหมดอายุ
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', tokenError: 'server_error' } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  await rerun(t);
  check('รอบที่ล้ม → คืนการจอง', t.integrations[0].sync_lease_until == null && t.integrations[0].status === 'error', JSON.stringify([t.integrations[0].sync_lease_until, t.integrations[0].status]));
}
{
  // หลายบัญชีต้องซิงก์ขนานกัน — บัญชีใหญ่ (ช้า) ไม่ถ่วงบัญชีอื่น
  GOOGLE = {};
  const rows = [];
  for (const k of ['a', 'b', 'c']) {
    GOOGLE['rt-' + k] = { email: k + '@gmail.com', courses: [{ id: 'c-' + k, name: 'วิชา' }], work: { ['c-' + k]: [pWork('w' + k, 3)] }, subs: {} };
    rows.push(await gRow('i' + k, 'u' + k, 'rt-' + k));
  }
  GOOGLE_DELAY = { 'rt-a': 30, 'rt-b': 30, 'rt-c': 30 };
  maxInFlight = 0;
  const t = await gTables(rows);
  await rerun(t);
  GOOGLE_DELAY = {};
  check('หลายบัญชี → ซิงก์ขนานกัน (คำขอ Google ค้างพร้อมกัน > 1)', maxInFlight > 1, 'maxInFlight=' + maxInFlight);
  check('หลายบัญชี → ทุกบัญชีได้งานของตัวเอง', ['a', 'b', 'c'].every(k => t.inbox_items.some(x => x.user_id === 'u' + k && x.meta.sourceId === 'c-' + k + ':w' + k)), JSON.stringify(t.inbox_items.map(x => [x.user_id, x.meta.sourceId])));
}
// ---- 25) 29 ต.ค. 69 · ไม่มีงานใหม่ = ไม่แตะฐานข้อมูล ----
// ข้อมูลจริง (log 24 ชม.): cron ทุกนาที × 4 บัญชี ลากทะเบียนทั้งบัญชีออกมาเทียบ ~5,600 ครั้ง/วัน
// และกวาด inbox_items หาของค้างอีก ~3,700 ครั้ง/วัน ทั้งที่เกือบทุกรอบไม่มีอะไรเปลี่ยน
// Egress ของ Supabase ทั้งองค์กรเกินแผนฟรี 363% · ถาม Google ทุกนาทีเหมือนเดิม (ข้อมูลขาเข้า)
// แต่ถ้ารายการที่ได้มาเหมือนรอบก่อนเป๊ะ จบรอบเลย — ไม่อ่านทะเบียน ไม่เขียน ไม่กวาด
const reads = (name) => sb.__log.filter(x => x === 'select ' + name).length;
const writes = () => sb.__log.filter(x => /^(insert|upsert|delete) /.test(x));
{
  freezeThaiHour(8);
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('wa', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  const r1 = await rerun(t);
  check('ไม่เปลี่ยน · รอบแรก → ส่งงานเข้ากล่องตามปกติ', inboxFor(t, 'wa').length === 1 && r1.sent.length === 1, JSON.stringify(r1.body));

  // 08:01 · Google ตอบเหมือนเดิมทุกอย่าง (ยังอยู่ในช่วงกวาดของค้าง 12 ชม. หลังมีงานใหม่)
  sb.__log.length = 0;
  const r2 = await rerun(t);
  check('ไม่เปลี่ยน → รอบจบด้วย unchanged', r2.body.results?.[0]?.status === 'unchanged', JSON.stringify(r2.body));
  check('ไม่เปลี่ยน → ไม่อ่านทะเบียน integration_items', reads('integration_items') === 0, JSON.stringify(sb.__log));
  check('ไม่เปลี่ยน → ไม่เขียนทะเบียน · ไม่เขียนกล่องเข้า', writes().length === 0, JSON.stringify(writes()));
  check('ไม่เปลี่ยน → ไม่ push ซ้ำ', r2.sent.length === 0, JSON.stringify(r2.sent));
  check('ไม่เปลี่ยน → ยังนัดรอบถัดไป + บันทึกผลรอบ',
    t.integrations[0].next_sync_at > iso(Date.now()) && t.integrations[0].meta?.last_run?.status === 'unchanged',
    JSON.stringify([t.integrations[0].next_sync_at, t.integrations[0].meta?.last_run]));

  // 21:00 · 13 ชม. หลังงานใหม่ล่าสุด — พ้นช่วงที่ heldTasks ย้อนดูได้ · ไม่ต้องกวาดกล่องเข้าเลย
  freezeThaiHour(21);
  sb.__log.length = 0;
  await rerun(t);
  check('ไม่เปลี่ยน + พ้นช่วงของค้าง → ไม่อ่าน inbox_items · ไม่อ่าน user_state',
    reads('inbox_items') === 0 && reads('user_state') === 0 && reads('integration_items') === 0, JSON.stringify(sb.__log));

  // ครูสั่งงานใหม่ → ต้องเห็นภายในรอบเดียว
  freezeThaiHour(14);
  GOOGLE['rt-p'].work['c-p'] = [pWork('wa', 3), pWork('wb', 5)];
  const r3 = await rerun(t);
  check('ครูสั่งงานใหม่ → เข้ากล่องในรอบนั้นเลย', inboxFor(t, 'wb')[0]?.meta.op === 'new', JSON.stringify(t.inbox_items.map(x => [x.meta.sourceId, x.meta.op])));
  check('ครูสั่งงานใหม่ → แจ้งเตือนดอกเดียว', r3.sent.length === 1 && /งาน wb/.test(r3.sent[0].body), JSON.stringify(r3.sent));

  // ครูเลื่อนกำหนดส่ง → เป็นการเปลี่ยนแปลง ต้องส่ง update
  GOOGLE['rt-p'].work['c-p'] = [pWork('wa', 3), pWork('wb', 6)];
  await rerun(t);
  check('ครูเลื่อนกำหนดส่ง → ส่ง update', inboxFor(t, 'wb').at(-1)?.meta.op === 'update', JSON.stringify(inboxFor(t, 'wb').map(x => x.meta.op)));

  // นักเรียนกดส่งใน Classroom → รายการเปลี่ยน (งานหาย + doneIds) ต้องปิดทะเบียนเป็น done
  GOOGLE['rt-p'].subs['c-p'] = [{ courseWorkId: 'wa', state: 'TURNED_IN' }];
  await rerun(t);
  check('กดส่งใน Classroom → ยังจับได้ · ทะเบียน done', ledgerOf(t, 'wa')?.state === 'done', ledgerOf(t, 'wa')?.state);

  // บัญชี Google เปลี่ยนอีเมลที่แสดง → ต้องเขียน account ใหม่ (ทางลัดห้ามกลืน)
  GOOGLE['rt-p'].email = 'p2@gmail.com';
  await rerun(t);
  check('อีเมลบัญชีเปลี่ยน → อัปเดต account', t.integrations[0].account === 'p2@gmail.com', t.integrations[0].account);

  // "ซิงก์เดี๋ยวนี้" = คนกดเพราะสงสัยว่ามีอะไรผิด → เทียบทะเบียนเต็มเสมอ
  sb.__log.length = 0;
  const r4 = await runBody(t, { integration_id: 'ip' });
  check('ซิงก์เดี๋ยวนี้ → เทียบทะเบียนเต็มแม้รายการไม่เปลี่ยน', reads('integration_items') > 0 && r4.body.results?.[0]?.status === 'ok', JSON.stringify([r4.body, sb.__log]));
}
{
  // ของที่เข้ามากลางดึก (Classroom) → รอบเช้าที่รายการไม่เปลี่ยนเลย ยังต้องแจ้ง
  freezeThaiHour(22);
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('wn', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  const r1 = await rerun(t);
  check('Classroom 22:00 → เข้ากล่องเงียบ ๆ', r1.sent.length === 0 && inboxFor(t, 'wn').length === 1, JSON.stringify(r1.sent));
  const d = new Date(REAL()); d.setUTCHours(0, 0, 0, 0);   // 07:00 ไทยของวันรุ่งขึ้น
  Date.now = () => d.getTime() + DAY;
  inboxFor(t, 'wn')[0].created_at = iso(d.getTime() + DAY - 9 * 3.6e6);
  const r2 = await rerun(t);
  check('Classroom 07:00 รายการเดิม → unchanged แต่แจ้งของค้าง', r2.body.results?.[0]?.status === 'unchanged' && r2.sent.length === 1 && /งาน wn/.test(r2.sent[0].body),
    JSON.stringify([r2.body, r2.sent]));
  const r3 = await rerun(t);
  check('Classroom รอบถัดไป → ไม่แจ้งซ้ำ', r3.sent.length === 0, JSON.stringify(r3.sent));
  freezeThaiHour(14);
}
{
  // deploy ตอนกลางดึก: ของค้างแจ้งเข้ามาก่อนมีโค้ดนี้ (ยังไม่มี held_until) · รอบแรกหลัง deploy เทียบเต็มแต่ไม่มีของใหม่
  // → รอบเช้าที่รายการเหมือนเดิมยังต้องกวาดของค้างไปแจ้ง ไม่ใช่ข้ามเงียบ
  freezeThaiHour(22);
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [pWork('wd', 3)] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  await rerun(t);
  delete t.integrations[0].meta.list_fp; delete t.integrations[0].meta.held_until;   // สภาพแถวก่อน deploy
  freezeThaiHour(23);
  await rerun(t);
  const d = new Date(REAL()); d.setUTCHours(0, 0, 0, 0);
  Date.now = () => d.getTime() + DAY;
  inboxFor(t, 'wd')[0].created_at = iso(d.getTime() + DAY - 9 * 3.6e6);
  const r = await rerun(t);
  check('deploy กลางดึก → เช้าแจ้งของค้างที่มาก่อน deploy', r.sent.length === 1 && /งาน wd/.test(r.sent[0].body), JSON.stringify([r.body, r.sent]));
  freezeThaiHour(14);
}
{
  // รอบที่ล้ม → ลืมลายนิ้วมือ · รอบหน้าเทียบทะเบียนเต็ม แม้รายการจะกลับไปเหมือนก่อนล้ม
  GOOGLE = { 'rt-p': { email: 'p@gmail.com', courses: [{ id: 'c-p', name: 'คณิต' }],
    work: { 'c-p': [] }, subs: { 'c-p': [] } } };
  const t = await gTables([await gRow('ip', 'up', 'rt-p')]);
  await rerun(t);
  GOOGLE['rt-p'].work['c-p'] = [pWork('wx', 3)];
  t.__fail = { 'insert inbox_items': true };
  await rerun(t);
  delete t.__fail;
  GOOGLE['rt-p'].work['c-p'] = [];   // ครูลบงานทิ้งก่อนรอบหน้า → รายการกลับไปเหมือนรอบที่สำเร็จล่าสุด
  sb.__log.length = 0;
  await rerun(t);
  check('หลังรอบที่ล้ม → เทียบทะเบียนเต็ม และปิดแถวที่ค้าง', reads('integration_items') > 0 && ledgerOf(t, 'wx')?.state === 'cancelled',
    JSON.stringify([sb.__log, ledgerOf(t, 'wx')?.state]));
}
GOOGLE = null;

unfreeze();

// ============================================================
const pass = results.filter(r => r.pass).length;
for (const r of results) {
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
}
console.log(`\n${pass}/${results.length} ผ่าน`);
process.exit(pass === results.length ? 0 : 1);
