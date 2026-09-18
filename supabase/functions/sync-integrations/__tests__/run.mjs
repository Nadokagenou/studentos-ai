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
};
globalThis.Deno = { env: { get: k => ENV[k] }, serve: h => { handler = h; } };

// ปฏิทินที่ "ต้นทาง" จะตอบกลับมา — เปลี่ยนได้รายเทสต์
let FEED = '';
globalThis.fetch = async () => new Response(FEED, { status: 200, headers: { 'content-type': 'text/calendar' } });

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

unfreeze();

// ============================================================
const pass = results.filter(r => r.pass).length;
for (const r of results) {
  console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
}
console.log(`\n${pass}/${results.length} ผ่าน`);
process.exit(pass === results.length ? 0 : 1);
