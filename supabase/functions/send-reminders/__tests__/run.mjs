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

{
  const t = base();
  t.friendships.push({ a: 'u1', b: 'u2', asked_by: 'u2', status: 'pending', created_at: iso(Date.now() - 5 * 60000) });
  const r = await run(t);
  check('friend request -> push', r.sent.length === 1 && r.sent[0].tag === 'friend', JSON.stringify(r.sent));
  check('friend push names the asker', /MIND/.test(r.sent[0] ? r.sent[0].title : ''), r.sent[0] && r.sent[0].title);
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

for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   >> ' + r.detail));
const failed = results.filter(r => !r.pass);
console.log('');
console.log((results.length - failed.length) + '/' + results.length + ' passed');
if (failed.length) process.exit(1);
