let handler = null;
globalThis.Deno = {
  env: { get: k => ({ SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k',
                      VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' })[k] },
  serve: h => { handler = h; },
};
globalThis.fetch = async () => { throw new Error('no config table in test'); };

const sb = await import('./sb.mjs');
const wp = await import('./wp.mjs');
await import('./fn.mjs');

const HOUR = 3.6e6;
const iso = ms => new Date(ms).toISOString();

function base(over = {}) {
  return {
    push_subscriptions: [{ endpoint: 'ep1', user_id: 'u1', p256dh: 'p', auth: 'a', last_sent_at: null }],
    user_state: [{ id: 'u1', data: { tasks: [], funnel: { lastOpen: iso(Date.now()) }, settings: {} } }],
    push_sent: [],
    friendships: [],
    dm_threads: [],
    dm_messages: [],
    profiles: [{ id: 'u2', display_name: 'MIND' }, { id: 'u3', display_name: 'BOSS' }],
    ...over,
  };
}

async function run(tables) {
  sb.__setTables(tables);
  wp.__sent.length = 0;
  const res = await handler(new Request('http://x'));
  const body = await res.json();
  return { body, sent: wp.__sent.map(s => ({ title: s.title, body: s.body, tag: s.tag })) };
}

const results = [];
const check = (name, cond, detail) => { results.push({ name, pass: !!cond, detail }); };

// ---- การ์ดเตือนงาน: หัว = ชื่องาน · เนื้อ = เวลาบรรทัดเดียว · ไม่มีชื่อแอปซ้ำ ----
{
  const due = new Date(Date.now() + 2 * 3600e3).toISOString();
  const t = base({ user_state: [{ id: 'u1', data: { tasks: [
    { id: 'k1', subject: 'อื่น ๆ', detail: 'ทดสอบแจ้งเตือน', due, done: false } ],
    funnel: { lastOpen: new Date().toISOString() }, settings: {} } }] });
  const r = await run(t);
  const c = r.sent[0] || {};
  check('task card title is the task name', c.title === 'ทดสอบแจ้งเตือน', JSON.stringify(c));
  check('task card body is short', c.body && c.body.length <= 40 && /เหลือ 2 ชม\./.test(c.body), JSON.stringify(c));
  check('no app name in title', !/Student OS/.test(String(c.title)), c.title);
}

{
  const t = base();
  t.friendships.push({ a: 'u1', b: 'u2', asked_by: 'u2', status: 'pending', created_at: iso(Date.now() - 5 * 60000) });
  const r = await run(t);
  check('friend request -> push', r.sent.length === 1 && r.sent[0].tag === 'friend', JSON.stringify(r.sent));
  check('friend push names the asker', /MIND/.test(r.sent[0] ? r.sent[0].title : ''), r.sent[0] && r.sent[0].title);
  // ความด่วนต่ำ = Android พักไว้ตอนเครื่องหลับ แล้วไปเด้งตอนเปิดแอปแทน
  const o = wp.__sent[0] && wp.__sent[0].opts;
  check('push sent high-urgency with short TTL', o && o.urgency === 'high' && o.TTL === 3 * 3600, JSON.stringify(o));
  const r2 = await run(t);
  check('friend request not repeated', r2.sent.length === 0, JSON.stringify(r2.sent));
}

{
  const t = base();
  t.friendships.push({ a: 'u1', b: 'u2', asked_by: 'u1', status: 'pending', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  check('own outgoing request -> silent', r.sent.length === 0, JSON.stringify(r.sent));
}

{
  const t = base();
  t.dm_threads.push({ id: 'th1', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 1, thread: 'th1', sender: 'u3', body: 'SECRETTEXT', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  check('new DM -> push', r.sent.length === 1 && r.sent[0].tag === 'dm', JSON.stringify(r.sent));
  check('DM push names sender', /BOSS/.test(r.sent[0] ? r.sent[0].title : ''), r.sent[0] && r.sent[0].title);
  check('DM push carries no message text', !/SECRETTEXT/.test(JSON.stringify(r.sent[0] || {})), JSON.stringify(r.sent[0]));
  const r2 = await run(t);
  check('DM not repeated', r2.sent.length === 0, JSON.stringify(r2.sent));
}

{
  const t = base();
  t.dm_threads.push({ id: 'th1', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 1, thread: 'th1', sender: 'u1', body: 'mine', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  check('own outgoing DM -> silent', r.sent.length === 0, JSON.stringify(r.sent));
}

{
  const t = base();
  t.dm_threads.push({ id: 'th1', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  for (let i = 0; i < 5; i++)
    t.dm_messages.push({ id: i + 1, thread: 'th1', sender: 'u3', body: 'x' + i, created_at: iso(Date.now() - (5 - i) * 60000) });
  const r = await run(t);
  check('5 messages -> 1 push', r.sent.length === 1, JSON.stringify(r.sent));
  check('push counts all 5', /5/.test(String(r.sent[0] && r.sent[0].title) + String(r.sent[0] && r.sent[0].body)), JSON.stringify(r.sent[0]));
  const marks = t.push_sent.filter(x => String(x.task_id).indexOf('dm::') === 0).length;
  check('all 5 events marked', marks === 5, 'marks=' + marks);
  const r2 = await run(t);
  check('burst not repeated', r2.sent.length === 0, JSON.stringify(r2.sent));
}

{
  const t = base();
  t.push_sent.push({ user_id: 'u1', task_id: 'dm::old::x', sent_at: iso(Date.now() - 5 * 60000) });
  t.dm_threads.push({ id: 'th2', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 9, thread: 'th2', sender: 'u3', body: 'y', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  check('within 25min gap -> silent', r.sent.length === 0, JSON.stringify(r.sent));
  t.push_sent[0].sent_at = iso(Date.now() - 40 * 60000);
  const r2 = await run(t);
  check('after 25min gap -> sends', r2.sent.length === 1, JSON.stringify(r2.sent));
}

{
  const t = base();
  for (let i = 0; i < 6; i++)
    t.push_sent.push({ user_id: 'u1', task_id: 'dm::cap' + i + '::x', sent_at: iso(Date.now() - (60 + i) * 60000) });
  t.dm_threads.push({ id: 'th3', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 20, thread: 'th3', sender: 'u3', body: 'z', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  check('daily cap holds', r.sent.length === 0, JSON.stringify(r.sent));
}

{
  const t = base();
  t.user_state[0].data.settings = { notifSocial: false };
  t.dm_threads.push({ id: 'th4', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 30, thread: 'th4', sender: 'u3', body: 'q', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  check('notifSocial=false -> silent', r.sent.length === 0, JSON.stringify(r.sent));
}

{
  const t = base();
  t.user_state[0].data.tasks = [{ id: 't1', subject: 'PHYS', detail: 'ex 1-10', due: iso(Date.now() + 2 * HOUR), done: false }];
  t.dm_threads.push({ id: 'th5', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 40, thread: 'th5', sender: 'u3', body: 'w', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  check('task beats social', r.sent.length === 1 && String(r.sent[0].tag).indexOf('task-') === 0, JSON.stringify(r.sent));
}

{
  const t = base();
  t.dm_threads.push({ id: 'th6', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 50, thread: 'th6', sender: 'u3', body: 'e', created_at: iso(Date.now() - 60000) });
  await run(t);
  check('social push leaves last_sent_at alone', t.push_subscriptions[0].last_sent_at === null, String(t.push_subscriptions[0].last_sent_at));
}

{
  const t = base();
  t.push_subscriptions[0].last_sent_at = iso(Date.now() - 30 * 60000);
  t.dm_threads.push({ id: 'th7', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 60, thread: 'th7', sender: 'u3', body: 'r', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  check('task quiet window does not block DM', r.sent.length === 1 && r.sent[0].tag === 'dm', JSON.stringify(r.sent));
}

{
  const t = base();
  t.user_state[0].data.tasks = [{ id: 't9', subject: 'CHEM', detail: 'ch4', due: iso(Date.now() + 2 * HOUR), done: false }];
  delete t.dm_messages;
  Object.defineProperty(t, 'dm_messages', { get() { throw new Error('boom'); } });
  const r = await run(t);
  check('social failure does not break task reminders', r.sent.length === 1 && String(r.sent[0].tag).indexOf('task-') === 0,
    JSON.stringify(r.sent) + ' errs=' + JSON.stringify(r.body.errors));
}


// (เทสต์รอบประจำวันของ 1C37 ย้ายไปอยู่ชุด 1C38 ข้างล่าง — พฤติกรรมเปลี่ยนโดยตั้งใจ ดู PATCHNOTES)

// ---- กลางคืนต้องเงียบสนิท แม้แต่ข้อความใหม่ ----
// เส้นความปลอดภัยเด็กของโปรเจกต์: เด็กที่โดนปลุกตอนเที่ยงคืนจะปิดการแจ้งเตือน แล้วปิดถาวร
{
  const realNow = Date.now;
  const d = new Date(); d.setUTCHours(17, 0, 0, 0);   // 17:00 UTC = เที่ยงคืนไทย
  Date.now = () => d.getTime();
  const t = base();
  t.dm_threads.push({ id: 'th8', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 70, thread: 'th8', sender: 'u3', body: 'n', created_at: iso(Date.now() - 60000) });
  const r = await run(t);
  Date.now = realNow;
  check('midnight -> no social push', r.sent.length === 0 && r.body.skipped === 'night',
    JSON.stringify(r.sent) + ' ' + JSON.stringify(r.body));
}

// ---- subscription หมดอายุ ต้องถูกลบ ไม่ใช่ยิงพลาดซ้ำทุกรอบ ----
{
  const t = base();
  t.dm_threads.push({ id: 'th9', a: 'u1', b: 'u3', last_at: iso(Date.now()) });
  t.dm_messages.push({ id: 80, thread: 'th9', sender: 'u3', body: 'g', created_at: iso(Date.now() - 60000) });
  wp.__setFail(() => Object.assign(new Error('gone'), { statusCode: 410 }));
  await run(t);
  wp.__setFail(null);
  check('410 subscription deleted', t.push_subscriptions.length === 0, 'left=' + t.push_subscriptions.length);
}

// ============================================================
// 1C38 · รอบประจำวันแบบปรับตามคน — ทุกเทสต์ข้างล่างตรึงนาฬิกาไว้ที่เวลาไทยที่ระบุ
// เทสต์ข้างบนวิ่งตามนาฬิกาจริง (ผลเปลี่ยนตามเวลาที่รัน) · ข้างล่างต้องได้ผลเดิมทุกครั้ง
// ============================================================
// 6 ต.ค. 2569 = วันอังคาร · 10 ต.ค. = วันเสาร์
const TH = (day, hh, mm = 0) => Date.UTC(2026, 9, day, hh - 7, mm);
const thDay = (day) => '2026-10-' + String(day).padStart(2, '0');
async function at(ms, tables) {
  const real = Date.now;
  Date.now = () => ms;
  try { return await run(tables); } finally { Date.now = real; }
}
function rhythm(over = {}) {
  const { tasks = [], push = {}, settings = {}, sub = {} } = over;
  return base({
    push_subscriptions: [{ endpoint: 'ep1', user_id: 'u1', p256dh: 'p', auth: 'a', last_sent_at: null,
      updated_at: '2026-09-01T00:00:00Z', ...sub }],
    user_state: [{ id: 'u1', data: { tasks, settings, push } }],
  });
}
const hw = (id, dueMs, extra = {}) => ({ id, subject: 'ฟิสิกส์', detail: 'บทที่ ' + id, due: iso(dueMs), done: false, ...extra });

// ---- รอบเย็น: งานที่แอปเลือก ตรงเวลาที่เรียนรู้มา ----
{
  const now = TH(6, 19, 0);
  const t = rhythm({
    tasks: [hw('p1', TH(8, 23, 59)), hw('p2', TH(7, 23, 59))],
    push: { v: 1, seen: thDay(6), wd: 1110, plans: [{ day: thDay(6), m: 1110, id: 'p1', min: 40, start: '19:00' }] },
  });
  const r = await at(now, t);
  const c = r.sent[0] || {};
  check('plan: fires at learned time', r.sent.length === 1 && c.tag === 'plan', JSON.stringify(r.sent));
  check('plan: names the task studyPlan picked (not soonest)', /p1/.test(c.title), c.title);
  check('plan: says how long', /40 นาที/.test(c.body), c.body);
  check('plan: mentions tomorrow\'s other task in same card', /พรุ่งนี้ส่งอีก 1 งาน/.test(c.body), c.body);
  check('plan: short TTL', wp.__sent[0] && wp.__sent[0].opts.TTL === 2 * 3600, JSON.stringify(wp.__sent[0] && wp.__sent[0].opts));
  const r2 = await at(TH(6, 19, 30), t);
  check('plan: once per day', r2.sent.length === 0, JSON.stringify(r2.sent));
  check('plan: covered tomorrow task, no extra evening card', t.push_sent.some(x => x.task_id === 'p2::plan'), JSON.stringify(t.push_sent));
}

{
  const t = rhythm({
    tasks: [hw('p1', TH(8, 23, 59))],
    push: { seen: thDay(6), plans: [{ day: thDay(6), m: 1110, id: 'p1', min: 40, start: '19:00' }] },
  });
  const r = await at(TH(6, 18, 0), t);
  check('plan: silent before its time', r.sent.length === 0, JSON.stringify(r.sent));
  const r2 = await at(TH(6, 20, 0), t);
  check('plan: silent after its 90-min window', r2.sent.length === 0, JSON.stringify(r2.sent));
}

{
  const now = TH(6, 19, 0);
  const t = rhythm({
    tasks: [hw('p1', TH(8, 23, 59))],
    push: { seen: thDay(6), plans: [{ day: thDay(6), m: 1110, id: 'p1', min: 40, start: '19:00' }] },
    sub: { updated_at: iso(now - 10 * 60000) },
  });
  const r = await at(now, t);
  check('plan: skipped when app was just open', r.sent.length === 0, JSON.stringify(r.sent));
}

{
  const now = TH(6, 19, 0);
  const t = rhythm({
    tasks: [hw('p1', TH(8, 23, 59))],
    push: { seen: thDay(6), workAt: iso(now - HOUR), plans: [{ day: thDay(6), m: 1110, id: 'p1', min: 40 }] },
  });
  const r = await at(now, t);
  check('plan: skipped while already working', r.sent.length === 0, JSON.stringify(r.sent));
}

{
  const t = rhythm({
    tasks: [hw('p1', TH(8, 23, 59))],
    push: { seen: thDay(6), plans: [{ day: thDay(6), m: 1110, id: 'p1', min: 40 }] },
    settings: { notifPlan: false },
  });
  const r = await at(TH(6, 19, 0), t);
  check('plan: notifPlan=false -> no plan card', !r.sent.some(s => s.tag === 'plan'), JSON.stringify(r.sent));
}

{
  // ใบที่แอปเลือกถูกติ๊กเสร็จไปแล้ว — ห้ามชวนทำงานที่เสร็จแล้ว ถอยไปพูดข้อเท็จจริง
  const t = rhythm({
    tasks: [hw('gone', TH(7, 23, 59), { done: true }), hw('p3', TH(9, 23, 59))],
    push: { seen: thDay(5), wd: 1110, plans: [{ day: thDay(6), m: 1110, id: 'gone', min: 30 }] },
  });
  const r = await at(TH(6, 18, 30), t);
  const c = r.sent[0] || {};
  check('plan: stale pick -> falls back to soonest, honestly worded', r.sent.length === 1 && /p3/.test(c.title) && /ใกล้สุด/.test(c.body), JSON.stringify(r.sent));
}

{
  // ไม่มีแผนของวันนี้ (เปิดแอปล่าสุดเมื่อวาน) — ใช้เวลานิสัยของวันธรรมดา
  const t = rhythm({
    tasks: [hw('p4', TH(9, 23, 59))],
    push: { seen: thDay(5), wd: 19 * 60 + 30 },
  });
  const r1 = await at(TH(6, 19, 0), t);
  const r2 = await at(TH(6, 19, 30), t);
  check('plan: uses learned weekday habit when no plan for today', r1.sent.length === 0 && r2.sent.length === 1 && r2.sent[0].tag === 'plan',
    JSON.stringify([r1.sent, r2.sent]));
}

{
  // วันเสาร์ ไม่มีข้อมูลนิสัย = 10:00
  const t = rhythm({ tasks: [hw('p5', TH(12, 23, 59))], push: { seen: thDay(10) } });
  const r = await at(TH(10, 10, 0), t);
  check('plan: weekend default 10:00', r.sent.length === 1 && r.sent[0].tag === 'plan', JSON.stringify(r.sent));
}

// ---- หายไป: รอบเย็นหยุดเอง · คำทักออกจริง (ก่อน 1C38 ไม่เคยออก) · หายนานเกินเลิกทัก ----
{
  const t = rhythm({ tasks: [hw('p6', TH(12, 23, 59))], push: { seen: thDay(3), wd: 1110 } });
  const r = await at(TH(6, 19, 0), t);
  check('away 3 days: plan stops, weekly nudge fires', r.sent.length === 1 && r.sent[0].tag === 'nudge', JSON.stringify(r.sent));
}
{
  const t = rhythm({ tasks: [], push: { seen: '2026-08-01' } });
  const r = await at(TH(6, 19, 0), t);
  check('away 66 days: no more nudges', r.sent.length === 0, JSON.stringify(r.sent));
}
{
  // แอปรุ่นเก่า (ไม่มี push · ไม่มี funnel) — ไม่รู้ว่าหายไปจริงไหม ต้องเงียบ
  const t = rhythm({ tasks: [] });
  t.user_state[0].data = { tasks: [], settings: {} };
  const r = await at(TH(6, 19, 0), t);
  check('unknown last-open: no nudge guess', r.sent.length === 0, JSON.stringify(r.sent));
}

// ---- รอบเช้า ----
{
  const t = rhythm({
    tasks: [hw('m1', TH(6, 16, 0)), hw('m2', TH(6, 23, 59), { subject: 'เคมี' }), hw('m3', TH(8, 23, 59))],
    push: { seen: thDay(5) },
  });
  const r = await at(TH(6, 7, 0), t);
  const c = r.sent[0] || {};
  check('morning: one digest for today\'s items', r.sent.length === 1 && c.tag === 'digest' && /วันนี้ส่ง 2 งาน/.test(c.title), JSON.stringify(r.sent));
  check('morning: lists subjects, not tomorrow\'s', /ฟิสิกส์/.test(c.body) && /เคมี/.test(c.body), c.body);
  const r2 = await at(TH(6, 10, 0), t);
  check('morning: no repeat, nothing nagging during class', r2.sent.length === 0, JSON.stringify(r2.sent));
  // บ่ายโมง: m1 เหลือ 3 ชม. → เสียงสุดท้ายออกได้แม้อยู่ในเวลาเรียน
  const r3 = await at(TH(6, 13, 0), t);
  check('last call fires during school when due soon', r3.sent.length === 1 && r3.sent[0].tag === 'task-m1' && /เหลือ 3 ชม\./.test(r3.sent[0].body),
    JSON.stringify(r3.sent));
}
{
  const t = rhythm({ tasks: [hw('m4', TH(8, 23, 59))], push: { seen: thDay(5) } });
  const r = await at(TH(6, 7, 0), t);
  check('morning: nothing due today -> silent', r.sent.length === 0, JSON.stringify(r.sent));
}

// ---- เพดานวันละ 3 · เสียงสุดท้ายไม่โดนเพดาน ----
{
  const now = TH(6, 19, 0);
  const t = rhythm({
    tasks: [hw('c1', TH(8, 23, 59))],
    push: { seen: thDay(6), plans: [{ day: thDay(6), m: 1110, id: 'c1', min: 40 }] },
    sub: { last_sent_at: iso(now - 3 * HOUR) },
  });
  for (let i = 0; i < 3; i++) t.push_sent.push({ user_id: 'u1', task_id: 'x' + i + '::soon', sent_at: iso(now - (4 + i) * HOUR) });
  const r = await at(now, t);
  check('cap: 3 task pushes today -> plan held', r.sent.length === 0, JSON.stringify(r.sent));
}
{
  const now = TH(6, 21, 0);
  const t = rhythm({
    tasks: [hw('c2', TH(6, 23, 59))],
    push: { seen: thDay(6) },
    sub: { last_sent_at: iso(now - 90 * 60000) },
  });
  for (let i = 0; i < 3; i++) t.push_sent.push({ user_id: 'u1', task_id: 'y' + i + '::soon', sent_at: iso(now - (2 + i) * HOUR) });
  const r = await at(now, t);
  check('cap: last call still goes through', r.sent.length === 1 && r.sent[0].tag === 'task-c2', JSON.stringify(r.sent));
}
{
  const now = TH(6, 21, 0);
  const t = rhythm({ tasks: [hw('c3', TH(6, 23, 59))], push: { seen: thDay(6) }, sub: { last_sent_at: iso(now - 30 * 60000) } });
  const r = await at(now, t);
  check('last call waits 60 min after previous push', r.sent.length === 0, JSON.stringify(r.sent));
}

// ---- เลยกำหนด: ครั้งเดียว · ไม่เด้งตอนนั่งเรียน ----
{
  const t = rhythm({ tasks: [hw('o1', TH(5, 23, 59))], push: { seen: thDay(5) } });
  t.push_sent.push({ user_id: 'u1', task_id: 'o1::soon', sent_at: iso(TH(5, 12, 0)) });
  const r1 = await at(TH(6, 10, 0), t);
  check('overdue: held during class', r1.sent.length === 0, JSON.stringify(r1.sent));
  const r2 = await at(TH(6, 16, 0), t);
  check('overdue: told once after school even though "soon" was sent',
    r2.sent.length === 1 && /เลยกำหนด/.test(r2.sent[0].body), JSON.stringify(r2.sent));
  const r3 = await at(TH(6, 19, 0), t);
  check('overdue: not repeated', !r3.sent.some(s => s.tag === 'task-o1'), JSON.stringify(r3.sent));
}

// ---- คนที่ไม่มีรอบเย็น (แอปเก่า) ยังได้จังหวะเดิม ----
{
  const t = rhythm({ tasks: [hw('l1', TH(7, 23, 59))] });
  t.user_state[0].data = { tasks: t.user_state[0].data.tasks, settings: {}, funnel: { lastOpen: iso(TH(6, 8, 0)) } };
  const r = await at(TH(6, 19, 0), t);
  check('legacy: evening-before reminder still works', r.sent.length === 1 && r.sent[0].tag === 'task-l1', JSON.stringify(r.sent));
}

// ---- รอบเช้าวันที่ไม่มีของส่งวันนี้ · รอบค่ำตามต่อ · ทั้งวัน ----
{
  const t = rhythm({ tasks: [hw('a1', TH(7, 23, 59))], push: { seen: thDay(6) } });
  const r = await at(TH(6, 7, 15), t);
  check('morning: heads-up for a task due within 2 days', r.sent.length === 1 && r.sent[0].tag === 'digest' && /ส่งพรุ่งนี้/.test(r.sent[0].body),
    JSON.stringify(r.sent));
  const r2 = await at(TH(6, 7, 45), t);
  check('morning: same round not repeated', r2.sent.length === 0, JSON.stringify(r2.sent));
}
{
  const t = rhythm({ tasks: [hw('a2', TH(9, 23, 59))], push: { seen: thDay(6) } });
  const r = await at(TH(6, 7, 15), t);
  check('morning: no nag for a task due in 3+ days', r.sent.length === 0, JSON.stringify(r.sent));
  const r2 = await at(TH(6, 12, 0), t);
  check('no round at noon', r2.sent.length === 0, JSON.stringify(r2.sent));
}
{
  // 1C37 ยิงรอบเช้าไปแล้ววันนี้ (คีย์รูปเดิม) — วันที่ขึ้นรุ่นต้องไม่ได้รอบเช้าซ้ำ
  const t = rhythm({ tasks: [hw('a3', TH(7, 23, 59))], push: { seen: thDay(6) } });
  t.push_sent.push({ user_id: 'u1', task_id: 'digest::2026-10-6::am', sent_at: iso(TH(6, 7, 0)) });
  const r = await at(TH(6, 7, 30), t);
  check('round keys compatible with 1C37', r.sent.length === 0, JSON.stringify(r.sent));
}
{
  const t = rhythm({
    tasks: [hw('e1', TH(9, 23, 59))],
    push: { seen: thDay(6), plans: [{ day: thDay(6), m: 1110, id: 'e1', min: 40, step: 'อ่านโจทย์' }] },
  });
  const r = await at(TH(6, 20, 30), t);
  check('late: follow-up when nothing done today', r.sent.length === 1 && r.sent[0].tag === 'plan' && /e1/.test(r.sent[0].title),
    JSON.stringify(r.sent));
  check('late: asks for a small start (<=25 min or first step)', /(1\d|2[0-5]) นาที|ขั้นแรก/.test(r.sent[0] ? r.sent[0].body : ''), r.sent[0] && r.sent[0].body);
}
{
  const t = rhythm({
    tasks: [hw('e2', TH(9, 23, 59))],
    push: { seen: thDay(6), workAt: iso(TH(6, 16, 0)), plans: [{ day: thDay(6), m: 1110, id: 'e2', min: 40 }] },
  });
  const r = await at(TH(6, 20, 30), t);
  check('late: silent if already worked today', r.sent.length === 0, JSON.stringify(r.sent));
}
{
  // มีงานส่งคืนนี้ → เสียงสุดท้ายจะพูดเอง รอบค่ำหลบให้
  const t = rhythm({ tasks: [hw('e3', TH(6, 23, 59)), hw('e4', TH(9, 23, 59))], push: { seen: thDay(6) } });
  const r = await at(TH(6, 20, 30), t);
  check('late: yields to tonight\'s last call', !r.sent.some(s => s.tag === 'plan'), JSON.stringify(r.sent));
}
async function wholeDay(t, day = 6) {
  const out = [];
  for (let m = 7 * 60; m <= 21 * 60 + 30; m += 30) {
    const r = await at(TH(day, 0) + m * 60000, t);
    for (const s of r.sent) out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') + ' ' + s.tag);
  }
  return out;
}
{
  // ส่งพรุ่งนี้ ยังไม่ได้แตะงานทั้งวัน → เช้า · เย็นตามนิสัย · ค่ำ = 3 ดอกพอดี
  const t = rhythm({
    tasks: [hw('w1', TH(7, 23, 59))],
    push: { seen: thDay(6), wd: 1110, plans: [{ day: thDay(6), m: 1110, id: 'w1', min: 40, start: '19:00' }] },
  });
  const got = await wholeDay(t);
  check('whole day (untouched, due tomorrow): exactly 3 rounds', got.length === 3 && /^07:00/.test(got[0]) && /^18:30 plan/.test(got[1]) && /^20:30 plan/.test(got[2]),
    JSON.stringify(got));
}
{
  // ส่งอีกสี่วัน · เริ่มทำไปตอน 17:00 → ไม่มีรอบเช้า (ยังไกล) · เย็นข้าม (กำลังทำ) · ค่ำข้าม (ทำแล้ววันนี้)
  const t = rhythm({
    tasks: [hw('w2', TH(10, 23, 59))],
    push: { seen: thDay(6), workAt: iso(TH(6, 17, 0)), plans: [{ day: thDay(6), m: 1110, id: 'w2', min: 40 }] },
  });
  const got = await wholeDay(t);
  check('whole day (already working): no nagging', got.length === 0, JSON.stringify(got));
}
{
  // วันหนัก: ส่งเช้านี้ 1 · ส่งคืนนี้ 1 · ส่งพรุ่งนี้ 1 · ไม่แตะงาน
  const t = rhythm({
    tasks: [hw('h1', TH(6, 9, 0)), hw('h2', TH(6, 23, 59)), hw('h3', TH(7, 23, 59))],
    push: { seen: thDay(6), plans: [{ day: thDay(6), m: 1110, id: 'h2', min: 60, start: '18:30' }] },
  });
  const got = await wholeDay(t);
  const nonLast = got.filter(x => !/task-/.test(x)).length;
  check('heavy day: rounds stay within cap, last calls on top', nonLast <= 3 && got.length <= 4 && got.some(x => /task-h2/.test(x)),
    JSON.stringify(got));
}

for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   >> ' + r.detail));
const failed = results.filter(r => !r.pass);
console.log('');
console.log((results.length - failed.length) + '/' + results.length + ' passed');
if (failed.length) process.exit(1);
