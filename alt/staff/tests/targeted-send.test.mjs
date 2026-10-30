import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBugDB, reporter, other, staff, asUser, rpc } from './bug-reports-fixture.mjs';
import { validate } from '../backend/functions/staff-console/core.mjs';
import { createNotifyKick } from '../backend/functions/staff-console/notify-kick.mjs';

const quiet = '44444444-4444-4444-8444-444444444444';
const DAY = 86400000;
const bkkToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const day = n => new Date(Date.parse(bkkToday + 'T00:00:00Z') - n * DAY).toISOString().slice(0, 10);
const req = n => `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, '0')}`;

const db = await createBugDB();
after(() => db.close());
await db.exec(`create role authenticator; alter table auth.users add column banned_until timestamptz;
  insert into auth.users(id) values('${quiet}');
  insert into profiles values('${reporter}','เอ','student_a'),('${other}','บี','student_b'),('${quiet}','ซี','student_c');`);
for (const f of ['20261016121927_studentos_account_moderation.sql', '20261029120000_staff_insights.sql', '20261029150000_staff_targeted_send.sql'])
  await db.exec(await readFile(new URL('../backend/supabase/migrations/' + f, import.meta.url), 'utf8'));
// A uses the app today and has a phone subscribed; B left 6 days ago, subscribed; C is today, opted out of notifications.
await db.query(`update user_state set data=$1, updated_at=now() where id='${reporter}'`, [{ settings: { grade: 'ม.4' }, funnel: { dayLog: [day(0)], ver: '1C61' }, tasks: [{ id: 't', createdAt: new Date().toISOString() }] }]);
await db.query(`insert into user_state values('${other}',$1,$2),('${quiet}',$3,now())`,
  [{ settings: { grade: 'ม.5' }, funnel: { dayLog: [day(6)], ver: '1C58' } }, new Date(Date.now() - 6 * DAY).toISOString(), { settings: { notif: false, grade: 'ม.4' }, funnel: { ver: '1C61' } }]);
await db.exec(`insert into push_subscriptions values('${reporter}','https://push.example/a'),('${other}','https://push.example/b'),('${quiet}','https://push.example/c');`);

const cmd = (action, payload = {}) => rpc(db, 'staff_send_command', [staff, 'developer', action, JSON.stringify(payload)]);
const send = (n, extra) => cmd('send', { request_id: req(n), title: 'ข่าวทดสอบกลุ่ม', body: 'ข้อความทดสอบ', push: true, ...extra });
const personal = uid => asUser(db, uid, () => rpc(db, 'staff_personal_notices', []));
const publicNews = () => rpc(db, 'staff_public_notices', []);
const jobs = async batch => (await db.query(`select j.user_id, j.status from staff_push_jobs j join staff_notices n on n.id=j.notice_id where n.batch_id=$1 order by 1`, [batch])).rows;

test('audience counts follow the same day rules as the people page and respect notification opt-out', async () => {
  assert.deepEqual(await cmd('audience', { audience: { kind: 'all' } }), { recipients: 3, push_ready: 2 });
  assert.deepEqual(await cmd('audience', { audience: { kind: 'gone' } }), { recipients: 1, push_ready: 1 });
  assert.deepEqual(await cmd('audience', { audience: { kind: 'old' } }), { recipients: 1, push_ready: 1 });
  assert.deepEqual(await cmd('audience', { audience: { kind: 'grade', grade: 'ม.4' } }), { recipients: 2, push_ready: 1 });
  assert.deepEqual(await cmd('audience', { audience: { kind: 'pick', ids: [quiet.toUpperCase()] } }), { recipients: 1, push_ready: 0 });
  await assert.rejects(() => cmd('audience', { audience: { kind: 'everyone' } }), /Unknown audience/);
});

test('a group send reaches only its members, privately, with pushes queued for them', async () => {
  const r = await send(1, { audience: { kind: 'gone' }, label: 'หายไปเกิน 3 วัน' });
  assert.equal(r.recipients, 1);
  assert.equal(r.push_queued, 1);
  assert.deepEqual(await jobs(req(1)), [{ user_id: other, status: 'pending' }]);
  const mine = await personal(other);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].kind, 'news');
  assert.equal((await personal(reporter)).length, 0);
  assert.ok(!(await publicNews()).some(x => x.title === 'ข่าวทดสอบกลุ่ม'), 'group news never becomes public');
  assert.deepEqual(await send(1, { audience: { kind: 'gone' }, label: 'หายไปเกิน 3 วัน' }), { id: req(1), duplicate: true });
  assert.equal((await db.query(`select count(*)::int n from staff_notices where batch_id=$1`, [req(1)])).rows[0].n, 1);
});

test('an everyone send is one public notice and skips people who turned notifications off', async () => {
  const r = await send(2, { audience: { kind: 'all' }, push: true });
  assert.equal(r.recipients, 3);
  assert.deepEqual((await jobs(req(2))).map(x => x.user_id).sort(), [reporter, other].sort());
  assert.ok((await publicNews()).some(x => x.id === req(2)));
});

test('a scheduled send waits, then the minute worker releases it and queues its pushes', async () => {
  const at = new Date(Date.now() + 3600000).toISOString();
  const r = await send(3, { audience: { kind: 'all' }, at });
  assert.equal(r.push_queued, 0);
  assert.ok(!(await publicNews()).some(x => x.id === req(3)), 'not visible before its time');
  await db.query(`update staff_notices set scheduled_at=now()-interval '1 second' where id=$1`, [req(3)]);
  await rpc(db, 'staff_claim_push_jobs', [0]);
  await db.exec("update staff_push_jobs set status='pending', attempts=0, claimed_at=null where status='sending'"); // no worker in this test
  assert.ok((await publicNews()).some(x => x.id === req(3)), 'visible after release');
  assert.equal((await jobs(req(3))).length, 2);
  assert.equal(await rpc(db, 'staff_release_scheduled', []), 0, 'release is idempotent');
});

test('a scheduled group send can be cancelled before it goes out, and a sent one can be withdrawn', async () => {
  await send(4, { audience: { kind: 'grade', grade: 'ม.4' }, at: new Date(Date.now() + 7200000).toISOString(), label: 'ม.4' });
  const list = (await cmd('sends')).items;
  const s4 = list.find(x => x.id === req(4));
  assert.equal(s4.status, 'scheduled');
  assert.equal(s4.recipients, 2);
  await cmd('cancel_send', { request_id: req(5), batch_id: req(4) });
  await db.query(`update staff_notices set scheduled_at=now()-interval '1 second' where batch_id=$1`, [req(4)]);
  await rpc(db, 'staff_release_scheduled', []);
  assert.equal((await personal(reporter)).length, 0, 'cancelled scheduled news never appears');
  await cmd('cancel_send', { request_id: req(6), batch_id: req(1) });
  assert.equal((await personal(other)).length, 0);
  assert.deepEqual(await jobs(req(1)), [{ user_id: other, status: 'cancelled' }]);
  assert.equal((await cmd('sends')).items.find(x => x.id === req(1)).status, 'withdrawn');
});

test('bad sends are refused and only the staff service can call any of it', async () => {
  await assert.rejects(() => send(7, { audience: { kind: 'pick', ids: ['99999999-9999-4999-8999-999999999999'] } }), /Nobody is in this group/);
  await assert.rejects(() => send(8, { audience: { kind: 'all' }, at: new Date(Date.now() - 60000).toISOString() }), /Schedule/);
  await assert.rejects(() => send(9, { audience: { kind: 'all' }, title: 'abc' }), /Invalid notice/);
  await assert.rejects(() => send(10, { audience: { kind: 'all' }, until: new Date(Date.now() - 1000).toISOString() }), /Expiry/);
  for (const role of ['anon', 'authenticated']) {
    await asUser(db, reporter, () => assert.rejects(() => cmd('audience', { audience: { kind: 'all' } })), role);
    await asUser(db, reporter, () => assert.rejects(() => db.query(`select * from public.staff_audience('{"kind":"all"}')`)), role);
    await asUser(db, reporter, () => assert.rejects(() => rpc(db, 'staff_release_scheduled', [])), role);
  }
  await asUser(db, reporter, () => assert.rejects(() => rpc(db, 'staff_personal_notices', [])), 'anon');
});

test('staff-console validates send requests and wakes the push worker only for immediate pushes', () => {
  const base = { action: 'send', request_id: req(20), title: 'ข่าวทดสอบกลุ่ม', body: 'ข้อความ', push: true, audience: { kind: 'gone' } };
  assert.deepEqual(validate(base).payload.audience, { kind: 'gone' });
  assert.throws(() => validate({ ...base, audience: { kind: 'pick', ids: ['x'] } }));
  assert.throws(() => validate({ ...base, at: new Date(Date.now() + 1000).toISOString() }));
  assert.throws(() => validate({ ...base, push: 'yes' }));
  assert.throws(() => validate({ ...base, body: 'x'.repeat(281) }));
  assert.equal(validate({ ...base, audience: { kind: 'pick', ids: [reporter, reporter.toUpperCase()] } }).payload.audience.ids.length, 1);
  assert.deepEqual(validate({ action: 'cancel_send', request_id: req(21), batch_id: req(1) }).payload, { request_id: req(21), batch_id: req(1) });
  const kicks = [];
  const kick = createNotifyKick({ url: 'https://x', key: 'k', fetcher: async () => ({ ok: true, text: async () => '' }), waitUntil: t => kicks.push(t), warn() {} });
  kick('send', { push: true, at: null }, {});
  kick('send', { push: true, at: new Date().toISOString() }, {});
  kick('send', { push: false, at: null }, {});
  assert.equal(kicks.length, 1);
});

test('send list and confirmation text escape user text and say who gets what', async () => {
  const ui = await import('../send-ui.mjs');
  const html = ui.sendsHTML([{ id: req(1), title: '<img src=x>', body: '"><script>', audience: '<b>', public: false, recipients: 3, status: 'scheduled', scheduled_at: new Date().toISOString(), push: true, push_total: 0, push_accepted: 0 }]);
  assert.ok(!html.includes('<img') && !html.includes('<script') && !html.includes('<b>'));
  assert.ok(!/style=/.test(html));
  assert.match(html, /ยกเลิกการตั้งเวลา/);
  assert.match(ui.sendsHTML([{ id: req(2), title: 'x', body: 'y', public: true, status: 'withdrawn' }]), /ถอนแล้ว/);
  const text = ui.sendSummary({ title: 'หัวข้อ', body: 'ข้อความ', aud: { kind: 'gone' }, label: 'หายไปเกิน 3 วัน', recipients: 5, pushReady: 2, at: null, push: true });
  assert.match(text, /5 คน/);
  assert.match(text, /กระดิ่งของคนในกลุ่มเท่านั้น/);
  assert.equal(ui.audienceLabel({ kind: 'pick' }, [{ name: 'เอ' }]), 'เอ');
  assert.equal(ui.audienceLabel({ kind: 'grade', grade: 'ม.4' }), 'ชั้น ม.4');
});
