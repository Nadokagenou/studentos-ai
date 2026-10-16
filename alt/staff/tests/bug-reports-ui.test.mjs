import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const source = await readFile(new URL('../../bug-reports.js', import.meta.url), 'utf8');
function fixture(rpc) {
  const elements = new Map(); let resets = 0;
  const get = id => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, disabled: false, textContent: '', innerHTML: '', classList: { toggle() {} }, replaceChildren() { this.innerHTML = ''; this.textContent = ''; }, reset() { resets++; for (const el of elements.values()) { el.value = ''; el.checked = false; } }, reportValidity: () => true });
    return elements.get(id);
  };
  const context = vm.createContext({ document: { getElementById: get }, currentUser: { id: 'account-a' }, sb: { rpc }, curScreen: 'scr-menu', APP_VERSION: '1C59', crypto: { randomUUID }, matchMedia: () => ({ matches: false }), Date });
  vm.runInContext(source, context);
  const run = (s, ...args) => vm.runInContext(s, context)(...args);
  run('bugAccountChanged');
  return { context, get, run, resets: () => resets };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('changing accounts clears report text and diagnostics immediately and discards a late response', async () => {
  let resolve;
  const f = fixture(() => new Promise(r => { resolve = r; }));
  f.get('bugList').innerHTML = 'private report'; f.get('bugDiagnostics').checked = true;
  const loading = f.run('loadBugReports');
  f.context.currentUser = { id: 'account-b' }; f.run('bugAccountChanged');
  assert.equal(f.get('bugList').innerHTML, '');
  assert.equal(f.get('bugDiagnostics').checked, false);
  resolve({ data: { items: [{ summary: 'secret report' }] } }); await loading;
  assert.equal(f.get('bugList').innerHTML, '');
  assert.equal(f.resets(), 2);
});
test('newer list request wins when network responses arrive out of order', async () => {
  const requests = [];
  const f = fixture(() => new Promise(r => requests.push(r)));
  const a = f.run('loadBugReports'), b = f.run('loadBugReports');
  requests[1]({ data: { items: [], has_more: false } }); await b;
  const html = f.get('bugList').innerHTML;
  requests[0]({ error: { message: 'old failure' } }); await a;
  assert.equal(f.get('bugList').innerHTML, html);
});
test('retry after ambiguous failure uses same request id and does not send diagnostics without consent', async () => {
  const calls = [];
  const f = fixture(async (name, payload) => { calls.push({ name, payload }); return { error: { message: 'network lost' } }; });
  for (const [id, value] of Object.entries({ bugCategory: 'tasks', bugPage: 'หน้าแรก', bugSummary: 'button issue', bugDetail: 'the page remains blank', bugSteps: 'open and click' })) f.get(id).value = value;
  await f.run('submitBugReport', { preventDefault() {} });
  await f.run('submitBugReport', { preventDefault() {} });
  assert.equal(calls.length, 2); assert.equal(calls[0].payload.p_request_id, calls[1].payload.p_request_id);
  assert.equal(calls[0].payload.p_payload.diagnostics, null);
  assert.match(f.get('bugMessage').textContent, /ข้อความยังอยู่/);
  f.get('bugDiagnostics').checked = true;
  const data = f.run('bugPayload');
  assert.deepEqual(JSON.parse(JSON.stringify(data.diagnostics)), { version: '1C59', display_mode: 'browser' });
  assert.deepEqual(Object.keys(data).sort(), ['category', 'detail', 'diagnostics', 'expected', 'page', 'steps', 'summary']);
});
test('an old successful submission cannot reset the next account form', async () => {
  let resolve;
  const f = fixture(() => new Promise(r => { resolve = r; }));
  const promise = f.run('submitBugReport', { preventDefault() {} });
  f.context.currentUser = { id: 'account-b' }; f.run('bugAccountChanged');
  const resets = f.resets(); resolve({ data: { id: 'old-report' } }); await promise; await tick();
  assert.equal(f.resets(), resets); assert.equal(f.get('bugMessage').textContent, '');
});
test('all report and team text renders escaped; latest question is visible without opening history', () => {
  const f = fixture(async () => ({ data: { items: [] } }));
  const html = f.run('bugReportHTML', { id: randomUUID(), summary: '<script>oops</script>', detail: '<img onerror=oops>', steps: 'open', page: 'หน้าแรก', category: 'tasks', status: 'needs_info', created_at: new Date().toISOString(), events: [{ author_kind: 'staff', status: 'needs_info', reply: '<b>question</b>', created_at: new Date().toISOString() }] });
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img onerror'));
  assert.ok(html.includes('&lt;b&gt;question&lt;/b&gt;'));
  assert.ok(html.indexOf('ข้อความล่าสุดจากทีม') < html.indexOf('<details>'));
});
