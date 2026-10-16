import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createBugDB, asUser, rpc, reporter, other, staff, sample } from './bug-reports-fixture.mjs';
import { validate, createHandler } from '../backend/functions/staff-console/core.mjs';
const db = await createBugDB();
after(() => db.close());
const id = randomUUID();
const submit = (user, request = id, payload = sample) => asUser(db, user, () => rpc(db, 'submit_bug_report', [request, JSON.stringify(payload)]));
const mine = user => asUser(db, user, () => rpc(db, 'my_bug_reports', [0]));
const command = (action, payload) => asUser(db, staff, () => rpc(db, 'staff_bug_command', [staff, 'developer', action, JSON.stringify(payload)]), 'service_role');

test('submission is atomic and repeated request does not create another report/event', async () => {
  await submit(reporter);
  assert.equal((await submit(reporter)).duplicate, true);
  const r = (await mine(reporter)).items[0];
  assert.equal(r.id, id); assert.equal(r.events.length, 1); assert.equal(r.diagnostics, null);
  assert.equal(r.status, 'open'); assert.equal(r.summary, sample.summary);
  await assert.rejects(submit(reporter, id, { ...sample, detail: 'different description' }), /BUG_INVALID_RETRY/);
  await assert.rejects(submit(other), /BUG_INVALID_RETRY/);
});
test('RLS hides reports and history across accounts, including direct table queries', async () => {
  assert.deepEqual((await mine(other)).items, []);
  await asUser(db, other, async () => {
    assert.deepEqual((await db.query('select * from bug_reports')).rows, []);
    assert.deepEqual((await db.query('select * from bug_report_events')).rows, []);
  });
  assert.equal((await mine(reporter)).items[0].events.length, 1);
});
test('guests and unauthenticated calls cannot submit or read reports', async () => {
  for (const name of ['submit_bug_report', 'my_bug_reports', 'reply_bug_report']) {
    const args = name === 'submit_bug_report' ? [randomUUID(), JSON.stringify(sample)] : name === 'my_bug_reports' ? [0] : [randomUUID(), id, 'more info'];
    await assert.rejects(asUser(db, null, () => rpc(db, name, args), 'anon'));
  }
  await assert.rejects(submit(null, randomUUID()), /BUG_AUTH/);
});
test('ordinary accounts cannot write tables, spoof ownership, edit state or invoke staff commands', async () => {
  for (const role of ['authenticated', 'anon']) await asUser(db, reporter, async () => {
    for (const sql of [
      `update bug_reports set status='resolved' where id='${id}'`,
      `delete from bug_reports where id='${id}'`,
      `insert into bug_report_events values('${randomUUID()}','${id}','resolved','staff','forged',now())`,
      `update bug_report_events set reply='forged'`,
      `select staff_bug_command('${staff}','developer','bugs','{}')`,
      `select studentos_private.staff_bug_command('${staff}','developer','bugs','{}')`,
    ]) await assert.rejects(db.query(sql));
  }, role);
  await assert.rejects(submit(reporter, randomUUID(), { ...sample, user_id: other }), /BUG_INVALID/);
});
test('validation rejects malformed fields, arbitrary diagnostics and copied credentials', async () => {
  for (const payload of [null, [], { ...sample, summary: '' }, { ...sample, detail: 'short' }, { ...sample, steps: '' }, { ...sample, summary: 'x'.repeat(121) }, { ...sample, page: 'https://example.test/?token=private' }, { ...sample, category: 'fake' }, { ...sample, diagnostics: { access_token: 'never accept this' } }, { ...sample, diagnostics: { version: '1C59', display_mode: 'browser', tasks: [] } }, { ...sample, detail: {} }]) {
    await assert.rejects(submit(reporter, randomUUID(), payload));
  }
  const request = randomUUID();
  await submit(other, request, { ...sample, diagnostics: { version: '1C59', display_mode: 'browser' } });
  assert.deepEqual((await mine(other)).items[0].diagnostics, { version: '1C59', display_mode: 'browser' });
});
test('report rate cap is per account; retry remains valid at the cap', async () => {
  const added = [];
  try {
    for (let i = 0; i < 4; i++) { const key = randomUUID(); added.push(key); await submit(reporter, key); }
    await assert.rejects(submit(reporter, randomUUID()), /BUG_RATE_LIMIT/);
    assert.equal((await submit(reporter)).duplicate, true);
    const key = randomUUID(); added.push(key); await submit(other, key);
  } finally { await db.query('delete from bug_reports where id=any($1::uuid[])', [added]); }
});
test('staff requests information, only the reporter replies, retry does not repeat history', async () => {
  const req = randomUUID(), replyId = randomUUID();
  const payload = { id, request_id: req, status: 'needs_info', reply: 'กดเปิดจากหน้ารายการหรือจากแผนครับ' };
  await command('bug_triage', payload);
  assert.equal((await command('bug_triage', payload)).duplicate, true);
  const reply = user => asUser(db, user, () => rpc(db, 'reply_bug_report', [replyId, id, 'เปิดจากหน้ารายการงานครับ']));
  await assert.rejects(reply(other), /BUG_NOT_FOUND/);
  await reply(reporter);
  assert.equal((await reply(reporter)).duplicate, true);
  const r = (await mine(reporter)).items[0];
  assert.equal(r.status, 'reviewing'); assert.equal(r.events.length, 3);
  assert.deepEqual(r.events.map(e => e.author_kind).sort(), ['reporter', 'reporter', 'staff']);
  await assert.rejects(asUser(db, reporter, () => rpc(db, 'reply_bug_report', [randomUUID(), id, 'another reply'])), /BUG_NOT_AWAITING_REPLY/);
});
test('resolved state requires explanation, records immutable audit and does not send Push or credits', async () => {
  await assert.rejects(command('bug_triage', { id, request_id: randomUUID(), status: 'resolved', reply: '' }), /BUG_INVALID/);
  const request_id = randomUUID();
  await command('bug_triage', { id, request_id, status: 'resolved', reply: 'แก้ปุ่มเปิดรายละเอียดแล้วครับ' });
  assert.equal((await mine(reporter)).items[0].status, 'resolved');
  const result = await command('bugs', {});
  assert.ok(result.items.find(r => r.id === id)); assert.equal(result.open_count, 1);
  for (const table of ['staff_notices', 'staff_push_jobs', 'staff_token_grants']) assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int n from staff_audit where id=$1', [request_id])).rows[0].n, 1);
  assert.deepEqual((await db.query('select data from user_state')).rows[0].data, { tasks: [{ id: 'keep' }], vault: { tokens: { bal: 20 } } });
  assert.equal((await db.query('select count(*)::int n from reports')).rows[0].n, 1);
});
test('staff lists paginate and user lists never include foreign reports', async () => {
  await db.exec('begin');
  try {
    await db.query(`insert into bug_reports(id,user_id,category,page,summary,detail,steps,request_fingerprint) select md5(i::text)::uuid,$1,'tasks','หน้าแรก','another issue','description of the issue','open the app','fixture' from generate_series(1,22)i`, [reporter]);
    const a = await command('bugs', { offset: 0 }), b = await command('bugs', { offset: 20 });
    assert.equal(a.items.length, 20); assert.equal(a.has_more, true); assert.equal(b.has_more, false);
    assert.equal(new Set([...a.items, ...b.items].map(x => x.id)).size, 24);
    const own = await mine(reporter); assert.equal(own.items.length, 20); assert.equal(own.has_more, true);
    assert.equal((await mine(other)).items.length, 1);
  } finally { await db.exec('rollback'); }
});
test('Edge validator accepts only supported bug transitions and safe IDs', () => {
  const base = { action: 'bug_triage', id, request_id: randomUUID(), status: 'needs_info', reply: 'please give details' };
  assert.equal(validate(base).payload.id, id);
  for (const change of [{ id: 1 }, { status: 'published' }, { reply: '' }, { reply: 'x'.repeat(1501) }, { request_id: '' }]) assert.throws(() => validate({ ...base, ...change }));
  assert.equal(validate({ action: 'bugs', offset: -20 }).payload.offset, 0);
});
test('new bug actions still require GitHub write access before database execution', async () => {
  let calls = 0;
  const handler = createHandler({ getUser: async () => ({ id: reporter, identities: [{ provider: 'github', identity_data: { sub: '1' } }] }), github: async path => path === '/user' ? { id: 1 } : { full_name: 'Nadokagenou/studentos-ai', permissions: { push: false } }, command: async () => { calls++; }, allowedOrigins: [] });
  for (const body of [{ action: 'bugs' }, { action: 'bug_triage', id, request_id: randomUUID(), status: 'reviewing', reply: '' }]) {
    const r = await handler(new Request('https://local.test', { method: 'POST', headers: { authorization: 'Bearer dummy', 'x-github-token': 'dummy' }, body: JSON.stringify(body) }));
    assert.equal(r.status, 403);
  }
  assert.equal(calls, 0);
});
