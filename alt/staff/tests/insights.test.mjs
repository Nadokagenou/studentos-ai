import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBugDB, reporter, other, staff, asUser, rpc } from './bug-reports-fixture.mjs';
import { validate } from '../backend/functions/staff-console/core.mjs';

const quiet = '44444444-4444-4444-8444-444444444444';
const DAY = 86400000;
const bkkToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const day = n => new Date(Date.parse(bkkToday + 'T00:00:00Z') - n * DAY).toISOString().slice(0, 10);
// A Thai wall-clock time n days ago, as the UTC ISO string the app stores.
const at = (n, hhmm) => new Date(Date.parse(day(n) + 'T' + hhmm + ':00+07:00')).toISOString();
const task = (extra) => ({ id: Math.random().toString(36).slice(2), title: 'SECRET-TITLE', detail: 'SECRET-DETAIL', ...extra });

const db = await createBugDB();
after(() => db.close());
await db.exec(`create role authenticator; alter table auth.users add column banned_until timestamptz;
  alter table auth.users add column email text;
  insert into auth.users(id,email) values('${quiet}','student@example.com');
  insert into profiles values('${reporter}','นักเรียน เอ','student_a'),('${other}','นักเรียน บี','student_b'),('${quiet}','นักเรียน ซี','student_c');`);
await db.exec(await readFile(new URL('../backend/supabase/migrations/20261016121927_studentos_account_moderation.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../backend/supabase/migrations/20261029120000_staff_insights.sql', import.meta.url), 'utf8'));

const A = {
  settings: { grade: 'ม.4', hearFrom: 'friend', name: 'SECRET-NAME' },
  funnel: { dayLog: [day(10), day(9), day(1), day(0)], ver: '1C61', screens: { 'scr-menu': day(0), 'scr-scan': day(1) }, tasksEver: 9, doneEver: 3 },
  pushDiag: { old: { dev: 'android', path: 'root', day: day(9) }, now: { dev: 'ios', path: 'alt', day: day(0) } },
  sessions: [{ start: at(0, '20:05'), min: 25 }],
  vault: { tokens: { bal: 120.5 } },
  tasks: [
    task({ subject: 'คณิตศาสตร์', createdAt: at(0, '20:30'), doneAt: at(0, '21:10'), done: true, due: at(-1, '08:00'), snoozeCount: 2 }),
    task({ subject: 'คณิตศาสตร์', createdAt: at(1, '19:00'), doneAt: at(0, '07:00'), done: true, due: at(1, '23:59') }),
    task({ subject: 'คณิตศาสตร์', createdAt: at(9, '12:00'), due: at(2, '23:59'), snoozeCount: 5 }),
    task({ subject: 'ชมรมลับเฉพาะตัว', createdAt: at(9, '12:10') }), task({ subject: 'ชมรมลับเฉพาะตัว', createdAt: at(9, '12:11') }),
    task({ subject: 'ชมรมลับเฉพาะตัว', createdAt: at(9, '12:12') }),
    task({ subject: 'ปฏิทิน', srcKey: 'gcal:1', createdAt: at(0, '03:00') }),
    task({ subject: 'สอบ', isExam: true, createdAt: at(5, '10:00'), due: at(1, '09:00'), done: true, doneAt: at(2, '20:00') }),
    'not-a-task',
  ],
};
const B = {
  settings: { grade: 'ม.5' },
  funnel: { dayLog: [day(6), day(5)], ver: '1C58' },
  tasks: [1, 2, 3].map(i => task({ subject: 'คณิตศาสตร์', createdAt: at(6, '10:0' + i), fromScan: true })),
};
const C = { settings: {}, tasks: [], funnel: { ver: '1C61' } };
await db.query(`update user_state set data=$1, updated_at=now() where id='${reporter}'`, [A]);
await db.query(`insert into user_state values('${other}',$1,$2),('${quiet}',$3,now())`, [B, at(5, '12:00'), C]);
await db.exec(`insert into push_subscriptions values('${reporter}','https://push.example/secret-endpoint');`);

const call = (action, payload = {}) => rpc(db, 'staff_insights', [staff, 'developer', action, JSON.stringify(payload)]);
const rejects = (fn, match) => assert.rejects(fn, match);

test('insights count Thai days, compare periods and leave calendar imports out of activity', async () => {
  const r = await call('insights', { days: 7 });
  assert.equal(r.days, 7);
  assert.equal(r.users, 3);
  assert.deepEqual(r.today_vs, { today: 2, yesterday: 1, last_week: 0 });
  // A and C this week; B's last day (5 days ago) is also inside the 7-day window.
  assert.equal(r.kpi.cur.active, 3);
  // created this week: A's two recent tasks + exam; the gcal import is excluded; B's scans were 6 days ago.
  assert.equal(r.kpi.cur.created, 3 + 3);
  assert.equal(r.kpi.cur.done, 3);
  assert.equal(r.kpi.cur.on_time, 2);
  assert.equal(r.kpi.cur.focus, 25);
  assert.equal(r.series.length, 14);
  assert.equal(r.series.at(-1).day, bkkToday);
  assert.equal(r.series.at(-1).active, 2);
  assert.equal(r.latest, '1C61');
  assert.equal(r.old_count, 1);
  assert.equal(r.stuck_count, 1);
  assert.equal(r.gone_count, 1);
  assert.equal(r.gone[0].handle, 'student_b');
});

test('heat map places events at their Thai hour and ignores imports', async () => {
  const r = await call('insights', { days: 30 });
  assert.equal(r.heat.length, 168);
  const dow = (new Date(bkkToday + 'T12:00:00Z').getUTCDay() + 6) % 7; // Monday = 0
  assert.equal(r.heat[dow * 24 + 20], 2, 'task created 20:30 + timer started 20:05');
  assert.equal(r.heat[dow * 24 + 3], 0, 'calendar import at 03:00 is not a usage moment');
  assert.equal(r.heat.reduce((a, b) => a + b, 0), r.heat_events);
});

test('retention, funnel and outcome numbers come from the same people', async () => {
  const r = await call('insights', { days: 30 });
  assert.equal(r.retention.d1_base, 2, 'C started today so is not counted yet');
  assert.equal(r.retention.d1, 2, 'A came back on day 2 (day 9), B came back on day 2 (day 5)');
  assert.equal(r.funnel.made_task, 2);
  assert.equal(r.funnel.push, 1);
  assert.deepEqual(r.snooze, { none: 9, once: 0, few: 1, many: 1 });
  assert.equal(r.via.sync, 1);
  assert.equal(r.via.scan, 3);
  assert.equal(r.devices.ios, 1, 'newest pushDiag entry wins');
  assert.equal(r.pace.exams, 1);
  assert.equal(r.pace.exams_ready, 1);
  assert.equal(r.economy.circulating, 121);
  assert.equal(r.economy.completions, null, 'missing optional table reads as no data, not an error');
});

test('nothing personal leaves the function and rare subjects stay hidden', async () => {
  const r = await call('insights', { days: 90 });
  assert.deepEqual(r.subjects, [{ name: 'คณิตศาสตร์', tasks: 6 }]);
  const all = JSON.stringify([r, await call('people'), await call('person', { id: reporter })]);
  for (const secret of ['SECRET-TITLE', 'SECRET-DETAIL', 'SECRET-NAME', 'student@example.com', 'secret-endpoint', 'ชมรมลับ'])
    assert.ok(!all.includes(secret), secret);
});

test('people list filters, counts and searches', async () => {
  const all = await call('people');
  assert.deepEqual(all.counts, { all: 3, today: 2, gone: 1, new: 2, stuck: 1, nopush: 2, old: 1, banned: 0 });
  assert.equal(all.items[0].act.length, 14);
  assert.equal(all.items.find(x => x.handle === 'student_a').act.slice(-2), '11');
  assert.deepEqual((await call('people', { filter: 'gone' })).items.map(x => x.handle), ['student_b']);
  assert.deepEqual((await call('people', { filter: 'stuck' })).items.map(x => x.handle), ['student_c']);
  assert.deepEqual((await call('people', { query: '@STUDENT_A' })).items.map(x => x.handle), ['student_a']);
  assert.equal((await call('people', { query: "%' or 1=1 --" })).items.length, 0);
  await rejects(() => call('people', { filter: 'everyone' }), /Unknown people filter/);
});

test('person detail reads one account and rejects bad ids', async () => {
  const p = await call('person', { id: reporter });
  assert.equal(p.handle, 'student_a');
  assert.equal(p.act.length, 30);
  assert.equal(p.push_devices, 1);
  assert.equal(p.granted, 0);
  assert.equal(p.ever_banned, false);
  assert.equal(p.bug_reports, 0);
  await rejects(() => call('person', { id: 'nope' }), /Invalid person/);
  await rejects(() => call('person', { id: '99999999-9999-4999-8999-999999999999' }), /Person not found/);
});

test('only the staff service may read insights', async () => {
  for (const role of ['anon', 'authenticated']) {
    await asUser(db, reporter, () => rejects(() => call('insights')), role);
    await asUser(db, reporter, () => rejects(() => db.query('select * from public.staff_x_people()')), role);
  }
  await rejects(() => rpc(db, 'staff_insights', ['99999999-9999-4999-8999-999999999999', 'x', 'insights', '{}']), /Invalid staff request/);
  await rejects(() => call('drop'), /Unknown insights action/);
});

test('staff-console accepts only clean insight requests', () => {
  assert.deepEqual(validate({ action: 'insights', days: 30 }).payload, { days: 30 });
  assert.deepEqual(validate({ action: 'insights', days: 5 }).payload, { days: 7 });
  assert.deepEqual(validate({ action: 'people', filter: 'gone', query: '@a', offset: 50 }).payload, { filter: 'gone', query: '@a', offset: 50 });
  assert.throws(() => validate({ action: 'people', filter: 'everyone' }));
  assert.deepEqual(validate({ action: 'person', id: reporter.toUpperCase() }).payload, { id: reporter });
  assert.throws(() => validate({ action: 'person', id: 'x' }));
});

test('insight pages escape names, survive empty data and never use inline styles (CSP)', async () => {
  const ui = await import('../insights-ui.mjs');
  const demo = await import('../insights-demo.mjs');
  const evil = { id: reporter, display_name: '<img src=x onerror=alert(1)>', handle: '"><script>', act: '0101', made: 1, done: 1, rated: 1, on_time: 1 };
  const html = [ui.peopleRowsHTML([evil], bkkToday), ui.personHTML(evil, bkkToday), ui.overviewHTML({ gone: [evil], gone_count: 1, today: bkkToday })].join('');
  assert.ok(!html.includes('<img') && !html.includes('<script'));
  assert.match(html, /&lt;img/);
  for (const page of ['overviewHTML', 'usageHTML', 'outcomesHTML']) {
    assert.doesNotThrow(() => ui[page]({}), page);
    for (const days of [1, 7, 30, 90]) assert.ok(!/style=/.test(ui[page](demo.demoInsights('insights', { days }))), page + ' ' + days);
  }
  const people = demo.demoInsights('people', {});
  assert.ok(!/style=/.test(ui.peopleRowsHTML(people.items, people.today) + ui.personHTML(demo.demoInsights('person', { id: people.items[0].id }), people.today)));
  assert.equal(ui.streak('0011101'), 1);
  assert.equal(ui.streak('0011110'), 4, 'today not used yet does not break the streak');
});
