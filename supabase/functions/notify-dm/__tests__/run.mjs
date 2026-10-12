// เทสต์ของ notify-dm — วิธีรันอยู่ที่ README.md ข้าง ๆ
let handler = null;
globalThis.Deno = {
  env: { get: k => ({ SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k',
                      VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' })[k] },
  serve: h => { handler = h; },
};
const sb = await import('./sb.mjs');
const wp = await import('./wp.mjs');
await import('./fn.mjs');

const iso = ms => new Date(ms).toISOString();
const ago = min => iso(Date.now() - min * 60000);

function base() {
  return {
    dm_threads: [{ id: 'th1', a: 'u1', b: 'u3', state: 'open', opener: 'u3' }],
    dm_messages: [{ id: 1, thread: 'th1', sender: 'u3', body: 'SECRETTEXT', image: null, created_at: ago(0.1) }],
    push_subscriptions: [{ endpoint: 'ep1', user_id: 'u1', p256dh: 'p', auth: 'a' },
                         { endpoint: 'ep2', user_id: 'u1', p256dh: 'p', auth: 'a' },
                         { endpoint: 'ep3', user_id: 'u3', p256dh: 'p', auth: 'a' }],
    user_state: [{ id: 'u1', data: { settings: {} } }],
    push_sent: [],
    profiles: [{ id: 'u3', display_name: 'BOSS' }],
  };
}

async function run(t, id = 1) {
  sb.__setTables(t);
  wp.__sent.length = 0;
  const res = await handler(new Request('http://x', { method: 'POST', body: JSON.stringify({ id }) }));
  return { status: res.status, body: await res.json(), sent: wp.__sent.slice() };
}

const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

{
  const t = base();
  const r = await run(t);
  check('new DM -> every device of the recipient', r.sent.length === 2 && r.sent.every(s => s.endpoint !== 'ep3'), JSON.stringify(r.sent));
  check('card names the sender', r.sent[0] && r.sent[0].title === 'BOSS', JSON.stringify(r.sent[0]));
  check('card carries no message text', !/SECRETTEXT/.test(JSON.stringify(r.sent)), JSON.stringify(r.sent[0]));
  check('tag is per chat room', r.sent[0] && r.sent[0].tag === 'dm-th1', r.sent[0] && r.sent[0].tag);
  check('urgency high (Android does not hold it)', r.sent[0] && r.sent[0].opts && r.sent[0].opts.urgency === 'high', JSON.stringify(r.sent[0] && r.sent[0].opts));
  const key = 'dm::th1::' + t.dm_messages[0].created_at;
  check('dedupe key same shape as send-reminders', t.push_sent.some(p => p.user_id === 'u1' && p.task_id === key), JSON.stringify(t.push_sent));
  const r2 = await run(t);
  check('same message twice -> one push', r2.sent.length === 0 && r2.body.skipped === 'dup', JSON.stringify(r2.body));
}

{
  // กลางดึก — เจ้าของเลือก "เด้งเลย"
  const realNow = Date.now;
  const d = new Date(); d.setUTCHours(17, 0, 0, 0);   // เที่ยงคืนไทย
  Date.now = () => d.getTime();
  const t = base(); t.dm_messages[0].created_at = iso(d.getTime() - 5000);
  const r = await run(t);
  Date.now = realNow;
  check('midnight -> still pushes', r.sent.length === 2, JSON.stringify(r.body));
}

{
  const t = base();
  t.dm_messages = [
    { id: 1, thread: 'th1', sender: 'u3', body: 'a', created_at: ago(30) },
    { id: 2, thread: 'th1', sender: 'u1', body: 'reply', created_at: ago(20) },
    { id: 3, thread: 'th1', sender: 'u3', body: 'b', created_at: ago(2) },
    { id: 4, thread: 'th1', sender: 'u3', body: 'c', created_at: ago(1) },
    { id: 5, thread: 'th1', sender: 'u3', body: 'd', created_at: ago(0.1) },
  ];
  const r = await run(t, 5);
  check('counts messages since the last reply', r.sent[0] && r.sent[0].body === '3 ข้อความใหม่', JSON.stringify(r.sent[0]));
}

{
  const t = base(); t.dm_messages[0].image = 'path.jpg'; t.dm_messages[0].body = '';
  const r = await run(t);
  check('image -> "ส่งรูปมา"', r.sent[0] && r.sent[0].body === 'ส่งรูปมา', JSON.stringify(r.sent[0]));
}

{
  const t = base(); t.dm_threads[0].state = 'pending';
  const r = await run(t);
  check('message request -> "ขอคุยกับคุณ"', r.sent[0] && r.sent[0].body === 'ขอคุยกับคุณ', JSON.stringify(r.sent[0]));
}

{
  const t = base(); t.user_state[0].data.settings = { notifOff: true };
  const r = await run(t);
  check('notifOff -> silent', r.sent.length === 0 && r.body.skipped === 'off', JSON.stringify(r.body));
  const t2 = base(); t2.user_state[0].data.settings = { notifSocial: false };
  const r2 = await run(t2);
  check('notifSocial=false -> silent', r2.sent.length === 0, JSON.stringify(r2.body));
}

{
  const t = base(); t.dm_messages[0].created_at = ago(30);
  const r = await run(t);
  check('old message (replayed id) -> silent', r.sent.length === 0 && r.body.skipped === 'stale', JSON.stringify(r.body));
}

{
  const t = base();
  const r = await run(t, 999);
  check('unknown id -> silent', r.sent.length === 0 && r.body.skipped === 'gone', JSON.stringify(r.body));
  sb.__setTables(base());
  const bad = await handler(new Request('http://x', { method: 'POST', body: '{}' }));
  check('missing id -> 400', bad.status === 400, bad.status);
}

{
  // ผู้รับไม่มีเครื่องลงทะเบียน → คืนคีย์ ให้รอบ 30 นาทีเก็บตกทีหลัง
  const t = base(); t.push_subscriptions = t.push_subscriptions.filter(s => s.user_id !== 'u1');
  const r = await run(t);
  check('no device -> key released for the 30-min sweep', r.body.sent === 0 && t.push_sent.length === 0, JSON.stringify(t.push_sent));
}

{
  const t = base();
  wp.__setFail(s => s.endpoint === 'ep1' ? Object.assign(new Error('gone'), { statusCode: 410 }) : null);
  const r = await run(t);
  wp.__setFail(null);
  check('dead device removed, live one still gets it', r.body.sent === 1 && !t.push_subscriptions.some(s => s.endpoint === 'ep1'), JSON.stringify(r.body));
}

let fail = 0;
for (const x of results) { console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.name + (x.pass ? '' : '  → ' + x.detail)); if (!x.pass) fail++; }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
