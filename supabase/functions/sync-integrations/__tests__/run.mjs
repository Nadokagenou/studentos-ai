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
    const a = GOOGLE[auth.replace(/^Bearer at:/, '')];
    if (!a) return json({ error: { message: 'no such token' } }, 401);
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
  const res = await handler(new Request('http://x', { method: 'POST', body: '{}' }));
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
  const res = await handler(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }));
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
