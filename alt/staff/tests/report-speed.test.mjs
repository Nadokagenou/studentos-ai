import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { authorize, createHandler, validate } from '../backend/functions/staff-console/core.mjs';
import { renderBugs, renderIssues } from '../report-ui.mjs';
const uid = '11111111-1111-4111-8111-111111111111';
const user = { id: uid, identities: [{ provider: 'github', identity_data: { sub: '42' } }] };
const profile = { id: 42, login: 'developer' };
const repo = { full_name: 'Nadokagenou/studentos-ai', permissions: { push: true } };
const context = { bucket: 'resolved', bug_offset: 20, issue_offset: 0 };
const payload = { id: uid, status: 'resolved', reply: 'แก้ไขเรียบร้อยครับ', request_id: randomUUID() };
const request = input => new Request('https://local.test', { method: 'POST', headers: { authorization: 'Bearer test', 'x-github-token': 'fake' }, body: JSON.stringify(input) });
const empty = { items: [], has_more: false, counts: { resolved: 0, pending: 0, trash: 0 } };

test('independent GitHub checks start together and both must succeed, without caching', async () => {
  let releaseProfile, releaseRepo, userCalls = 0;
  const paths = [];
  const opts = { authorization: 'Bearer test', githubToken: 'fake', repository: repo.full_name,
    getUser: async () => { userCalls++; return user; },
    github: path => { paths.push(path); return new Promise(resolve => { if (path === '/user') releaseProfile = resolve; else releaseRepo = resolve; }); },
  };
  const first = authorize(opts);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(paths, ['/user', '/repos/' + repo.full_name]);
  releaseRepo(repo); releaseProfile(profile);
  assert.deepEqual(await first, { id: uid, login: 'developer' });
  const second = authorize(opts);
  await new Promise(resolve => setImmediate(resolve));
  releaseProfile(profile); releaseRepo({ ...repo, permissions: { push: false } });
  await assert.rejects(second, { status: 403 });
  assert.equal(userCalls, 2); assert.equal(paths.length, 4);
});

test('Auth and GitHub reads overlap, but no authorization succeeds before Auth validates', async () => {
  let resolveUser, done=false;
  const calls=[];
  const pending=authorize({ authorization:'Bearer test', githubToken:'fake', repository:repo.full_name,
    getUser:()=>new Promise(resolve=>{calls.push('auth');resolveUser=resolve;}),
    github:async path=>{calls.push(path);return path==='/user'?profile:repo;},
  });
  pending.then(()=>{done=true;},()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['auth','/user','/repos/'+repo.full_name]);
  assert.equal(done,false);
  resolveUser(null); await assert.rejects(pending,{status:401});
});

test('a save returns current lists with one authorization and unchanged ledger payload', async () => {
  const calls = []; let authCalls = 0, kicks = 0;
  const handler = createHandler({ getUser: async () => { authCalls++; return user; }, github: async path => path === '/user' ? profile : repo,
    afterCommand: () => { kicks++; },
    command: async (actor, action, p) => { calls.push({ action, p }); return action === 'bug_triage' ? { id: uid, status: 'resolved' } : empty; },
  });
  const response = await handler(request({ action: 'bug_triage', ...payload, report_view: context }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(authCalls, 1); assert.equal(kicks, 1);
  assert.deepEqual(calls, [{ action: 'bug_triage', p: payload }, { action: 'bugs', p: { bucket: 'resolved', offset: 20 } }, { action: 'issues', p: { bucket: 'resolved', offset: 0 } }]);
  assert.equal(result.status, 'resolved');
  assert.deepEqual(result.reports.bugs.value, empty);
  assert.deepEqual(result.reports.issues.value, empty);
});

test('a refresh failure preserves successful save and successful other section without leaking errors', async () => {
  const handler = createHandler({ getUser: async () => user, github: async path => path === '/user' ? profile : repo,
    command: async (actor, action) => { if (action === 'bugs') throw Error('private database detail'); return action === 'issues' ? empty : { saved: true }; },
  });
  const r = await handler(request({ action: 'bug_triage', ...payload, report_view: context }));
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.saved, true); assert.deepEqual(body.reports.bugs, { status: 'rejected' });
  assert.deepEqual(body.reports.issues.value, empty);
  assert.ok(!JSON.stringify(body).includes('private database'));
});

test('read batching is authorized and never dispatches a write or notification', async () => {
  const actions = []; let kicks = 0;
  const options = { getUser: async () => user, github: async path => path === '/user' ? profile : repo,
    command: async (actor, action) => { actions.push(action); return empty; }, afterCommand: () => kicks++,
  };
  const handler = createHandler(options);
  assert.equal((await handler(request({ action: 'reports', ...context }))).status, 200);
  assert.deepEqual(actions, ['bugs', 'issues']); assert.equal(kicks, 0);
  options.getUser = async () => null;
  assert.equal((await createHandler(options)(request({ action: 'reports', ...context }))).status, 401);
  assert.deepEqual(actions, ['bugs', 'issues']);
});

test('invalid refresh context is rejected before any mutation; old clients keep the same payload', async () => {
  let commands = 0;
  const handler = createHandler({ getUser: async () => user, github: async path => path === '/user' ? profile : repo, command: async () => { commands++; } });
  for (const report_view of [null, [], 'all', { bucket: 'all' }]) assert.equal((await handler(request({ action: 'bug_triage', ...payload, report_view }))).status, 400);
  assert.equal(commands, 0);
  assert.deepEqual(validate({ action: 'bug_triage', ...payload }), { action: 'bug_triage', payload });
  assert.deepEqual(validate({ action: 'reports', bug_offset: -20, issue_offset: 1e9 }).payload, { bucket: 'pending', bug_offset: 0, issue_offset: 100000 });
});

let source = await readFile(new URL('../staff.js', import.meta.url), 'utf8');
source = source.replace(/^import .*?;\r?\n/gm, '').replace(/start\(\)\.catch\([^\n]+\);\s*$/, '');
function ui(api) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '', disabled: false, value: '', attributes: {}, classList: { toggle() {} }, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener() {} });
    return elements.get(id);
  };
  const window = {}; window.top = window; window.self = window;
  const ctx = vm.createContext({ window, location: { pathname: '/alt/staff/' }, document: { getElementById: get, querySelectorAll: () => [], addEventListener() {} }, crypto: { randomUUID }, renderBugs, renderIssues });
  vm.runInContext(source, ctx); ctx.mockApi = api;
  vm.runInContext("api = mockApi; view = 'issues';", ctx);
  return { get, run: script => vm.runInContext(script, ctx) };
}
const reportResponse = bucket => ({ bucket, bug_offset: 0, issue_offset: 0, bugs: { status: 'fulfilled', value: empty }, issues: { status: 'fulfilled', value: empty } });

test('UI shows loading immediately, uses one read, and ignores an earlier bucket response', async () => {
  const calls = [];
  const f = ui((action, p) => new Promise(resolve => calls.push({ action, p, resolve })));
  const first = f.run('loadReports()');
  assert.match(f.get('bugIssueList').innerHTML, /กำลังโหลด/);
  assert.equal(f.get('staffBugsNext').disabled, true);
  f.run("reportBucket = 'resolved'"); const second = f.run('loadReports()');
  assert.deepEqual(calls.map(x => x.action), ['reports', 'reports']);
  calls[1].resolve(reportResponse('resolved')); await second;
  const html = f.get('bugIssueList').innerHTML;
  calls[0].resolve({}); await first;
  assert.equal(f.get('bugIssueList').innerHTML, html);
  assert.equal(f.get('reportSections').attributes['aria-busy'], 'false');
});

test('successful save paints attached latest lists without another request, overriding an older read', async () => {
  const calls = []; let oldRead;
  const f = ui(async (action, p) => { calls.push({ action, p }); if (action === 'reports') return new Promise(resolve => oldRead = resolve); return { saved: true, reports: reportResponse('pending') }; });
  const loading = f.run('loadReports()');
  await f.run("(async () => { const result = await mutate('bug_triage', { id: 'fake', status: 'resolved', reply: 'resolved' }, 'saved'); await refreshAfterReportSave(result); })()");
  const html = f.get('bugIssueList').innerHTML;
  oldRead({}); await loading;
  assert.equal(f.get('bugIssueList').innerHTML, html);
  assert.deepEqual(calls.map(x => x.action), ['reports', 'bug_triage']);
  assert.equal(calls[1].p.report_view.bucket, 'pending');
});

test('failed save keeps draft and retry id, indicates progress, and never refreshes', async () => {
  const calls = [];
  const f = ui(async (action, p) => { calls.push(p); assert.equal(f.get('message').textContent, 'กำลังบันทึก…'); throw Error('offline'); });
  f.get('bugIssueList').innerHTML = 'unsaved draft';
  for (let i = 0; i < 2; i++) await f.run("(async () => { const result = await mutate('bug_triage', { id: 'fake' }, 'saved'); await refreshAfterReportSave(result); })()");
  assert.equal(calls.length, 2); assert.equal(calls[0].request_id, calls[1].request_id);
  assert.equal(f.get('bugIssueList').innerHTML, 'unsaved draft');
  assert.equal(f.get('message').textContent, 'offline');
});
