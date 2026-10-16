import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createStaffSessionStorage, STAFF_AUTH_KEY } from '../staff-auth.mjs';
import { renderIssues, renderBugs } from '../report-ui.mjs';
const providerKey = 'studentos.staff.github';
const account = (id = 'account-a', token = 'fake-github-a') => ({ user: { id }, access_token: 'fake-access-' + id, refresh_token: 'fake-refresh-' + id, ...(token ? { provider_token: token } : {}) });
function storage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}
const saved = session => ({ [STAFF_AUTH_KEY]: JSON.stringify(session) });

test('closing a tab and reopening retains the staff session and provider after Supabase refresh', () => {
  const persistent = storage(saved(account()));
  createStaffSessionStorage({ persistent, tab: storage() });
  const refreshed = account('account-a', null);
  persistent.setItem(STAFF_AUTH_KEY, JSON.stringify(refreshed));
  const reopened = createStaffSessionStorage({ persistent, tab: storage() });
  assert.equal(reopened.persistentAvailable, true);
  assert.equal(reopened.providerToken(refreshed), 'fake-github-a');
});

test('legacy tab-only authentication and PKCE verifier migrate without signing in again', () => {
  const session = account('account-a', null), persistent = storage();
  const tab = storage({ ...saved(session), [providerKey]: 'fake-github-a', [STAFF_AUTH_KEY + '-code-verifier']: 'fake-verifier' });
  const auth = createStaffSessionStorage({ persistent, tab });
  assert.equal(auth.providerToken(session), 'fake-github-a');
  assert.deepEqual(JSON.parse(persistent.getItem(STAFF_AUTH_KEY)), session);
  assert.equal(persistent.getItem(STAFF_AUTH_KEY + '-code-verifier'), 'fake-verifier');
  assert.equal(tab.getItem(STAFF_AUTH_KEY), null); assert.equal(tab.getItem(providerKey), null);
});

test('legacy authentication cannot overwrite another persistent account or a newer provider token', () => {
  const a = account(), b = account('account-b', 'fake-github-b');
  const persistent = storage(saved(a)), tab = storage({ ...saved(b), [providerKey]: 'fake-github-b' });
  const auth = createStaffSessionStorage({ persistent, tab });
  assert.equal(JSON.parse(persistent.getItem(STAFF_AUTH_KEY)).user.id, 'account-a');
  assert.equal(auth.providerToken(b), 'fake-github-b');
  assert.equal(auth.providerToken(account('account-a', null)), null);
  const newer = storage({ ...saved(account('account-a', null)), [providerKey]: JSON.stringify({ user_id: 'account-a', token: 'newer' }) });
  const upgraded = createStaffSessionStorage({ persistent: newer, tab: storage({ ...saved(account('account-a', null)), [providerKey]: 'old-token' }) });
  assert.equal(upgraded.providerToken(account('account-a', null)), 'newer');
});

test('a provider token is never paired with a different refreshed account', () => {
  const auth = createStaffSessionStorage({ persistent: storage(saved(account())), tab: storage() });
  assert.equal(auth.providerToken(account('account-b', null)), null);
  assert.equal(auth.providerToken(null), null);
});

test('sign-out removes all staff authentication copies and preserves learner data and login', () => {
  const values = { ...saved(account()), [providerKey]: 'legacy', [STAFF_AUTH_KEY + '-code-verifier']: 'fake-verifier', 'studentos.alt.v1': 'keep-tasks', 'sb-learner-auth-token': 'keep-learner-login' };
  const persistent = storage(values), tab = storage(values);
  createStaffSessionStorage({ persistent, tab }).clear();
  for (const target of [persistent, tab]) {
    for (const key of [STAFF_AUTH_KEY, providerKey, STAFF_AUTH_KEY + '-code-verifier']) assert.equal(target.getItem(key), null);
    assert.equal(target.getItem('studentos.alt.v1'), 'keep-tasks');
    assert.equal(target.getItem('sb-learner-auth-token'), 'keep-learner-login');
  }
});

test('blocked persistent storage falls back to the current tab without crashing or claiming persistence', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  const auth = createStaffSessionStorage({ persistent: blocked, tab: storage(saved(account())) });
  assert.equal(auth.persistentAvailable, false);
  assert.equal(auth.providerToken(account('account-a', null)), 'fake-github-a');
  const memory = createStaffSessionStorage({ persistent: blocked, tab: blocked });
  assert.equal(memory.providerToken(account()), 'fake-github-a');
  assert.equal(memory.providerToken(account('account-a', null)), 'fake-github-a');
});

let source = await readFile(new URL('../staff.js', import.meta.url), 'utf8');
source = source.replace(/^import .*?;\r?\n/gm, '').replace(/start\(\)\.catch\([^\n]+\);\s*$/, '');
function ui(persistent, { initial = account(), refresh = false, responder } = {}) {
  const elements = new Map(), calls = []; let listener, sdkStorage, current = initial, initialRead = true;
  const get = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, classList: { toggle() {} }, setAttribute() {}, addEventListener() {} });
    return elements.get(id);
  };
  const auth = {
    onAuthStateChange(fn) { listener = fn; },
    async getSession() {
      if (initialRead) { current = JSON.parse(sdkStorage.getItem(STAFF_AUTH_KEY) || 'null') || initial; initialRead = false; }
      if (refresh && current) { current = { ...current, access_token: 'fake-refreshed-access' }; delete current.provider_token; }
      if (current) sdkStorage.setItem(STAFF_AUTH_KEY, JSON.stringify(current));
      listener(current ? 'TOKEN_REFRESHED' : 'INITIAL_SESSION', current);
      return { data: { session: current }, error: null };
    },
    async signOut() { current = null; sdkStorage.removeItem(STAFF_AUTH_KEY); listener('SIGNED_OUT', null); },
  };
  const window = { localStorage: persistent, sessionStorage: storage(), SUPABASE_CONFIG: { url: 'https://project.test', anonKey: 'fake-public' },
    supabase: { createClient(url, key, options) { sdkStorage = options.auth.storage; return { auth }; } },
  };
  window.top = window; window.self = window;
  const ctx = vm.createContext({ window, location: { pathname: '/alt/staff/', href: 'https://site.test/alt/staff/' }, history: { replaceState() {} }, URL, URLSearchParams, AbortSignal,
    document: { getElementById: get, querySelectorAll: () => [], addEventListener() {} }, crypto: { randomUUID },
    createStaffSessionStorage, STAFF_AUTH_KEY, renderBugs, renderIssues,
    fetch: async (url, init) => {
      calls.push({ url, ...init });
      if (responder) return responder(url, init);
      const action = JSON.parse(init.body).action;
      return { ok: true, json: async () => action === 'session' ? { login: 'developer' } : {} };
    },
  });
  vm.runInContext(source, ctx);
  return { get, calls, run: script => vm.runInContext(script, ctx), emit: (event, session) => { current = session; listener(event, session); } };
}

test('a fresh Control Room tab opens with persisted refreshed credentials and no OAuth redirect', async () => {
  const persistent = storage(saved(account()));
  const first = ui(persistent, { refresh: true }); await first.run('start()');
  assert.equal(first.get('console').hidden, false);
  assert.equal(first.calls[0].headers.authorization, 'Bearer fake-refreshed-access');
  assert.equal(first.calls[0].headers['x-github-token'], 'fake-github-a');
  const second = ui(persistent, { initial: null }); await second.run('start()');
  assert.equal(second.get('console').hidden, false);
  assert.equal(second.calls[0].headers['x-github-token'], 'fake-github-a');
});

test('TOKEN_REFRESHED is handled before requests and SIGNED_OUT clears persistence and hides the console', async () => {
  const persistent = storage(saved(account())), f = ui(persistent);
  await f.run('start()');
  f.emit('TOKEN_REFRESHED', { ...account('account-a', null), access_token: 'fake-latest-access' });
  await f.run("api('reports')");
  assert.equal(f.calls.at(-1).headers.authorization, 'Bearer fake-latest-access');
  assert.equal(f.calls.at(-1).headers['x-github-token'], 'fake-github-a');
  await f.get('signOut').onclick();
  assert.equal(f.get('console').hidden, true);
  assert.equal(persistent.getItem(STAFF_AUTH_KEY), null); assert.equal(persistent.getItem(providerKey), null);
});

test('a response that arrives after sign-out cannot reopen the previous account', async () => {
  let release;
  const real = ui(storage(saved(account())), { responder: async (url, init) => {
    if (JSON.parse(init.body).action === 'reports') return new Promise(resolve => release = () => resolve({ ok: true, json: async () => ({ private: true }) }));
    return { ok: true, json: async () => ({ login: 'developer' }) };
  } });
  await real.run('start()');
  const request = real.run("api('reports')");
  await new Promise(resolve => setImmediate(resolve));
  real.emit('SIGNED_OUT', null); release();
  await assert.rejects(request, /บัญชีเปลี่ยน/);
  assert.equal(real.get('console').hidden, true);
});

test('switching accounts clears the previous workspace and cannot reuse its GitHub token', async () => {
  const f = ui(storage(saved(account())));
  await f.run('start()');
  f.get('bugIssueList').innerHTML = 'previous account report';
  f.get('noticeList').innerHTML = 'previous account notice';
  f.emit('SIGNED_IN', account('account-b', null));
  assert.equal(f.get('console').hidden, true);
  assert.equal(f.get('bugIssueList').innerHTML, '');
  assert.equal(f.get('noticeList').innerHTML, '');
  await assert.rejects(f.run("api('reports')"), /GitHub/);
});

test('a revoked provider token is not treated as successful persistent authorization', async () => {
  const persistent = storage(saved(account()));
  const f = ui(persistent, { refresh: true, responder: async () => ({ ok: false, status: 401, json: async () => ({ error: 'GitHub authorization expired' }) }) });
  await f.run('start()');
  assert.equal(f.get('console').hidden, true);
  assert.equal(f.get('gateMessage').textContent, 'GitHub authorization expired');
  assert.equal(persistent.getItem(providerKey), null);
});
