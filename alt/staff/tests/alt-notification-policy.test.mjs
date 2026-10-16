import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { retireAltSubscription } from '../../notification-policy.mjs';
const mainScope = 'https://example.test/studentos-ai/';
const altScope = mainScope + 'alt/';

test('only the exact ALT registration is retired; main registration fallback is untouched', async () => {
  let touched = 0;
  for (const registration of [undefined, { scope: mainScope, pushManager: { getSubscription() { touched++; } } }]) {
    await retireAltSubscription({ serviceWorker: { async getRegistration(url) { assert.equal(url, altScope); return registration; } }, scope: altScope, removeEndpoint: () => touched++ });
  }
  assert.equal(touched, 0);
});

test('retirement invalidates ALT endpoint and removes only that endpoint from cloud', async () => {
  const calls = [];
  const sub = { endpoint: 'https://push.example/alt-device', async unsubscribe() { calls.push('unsubscribe'); return true; } };
  await retireAltSubscription({ scope: altScope,
    serviceWorker: { getRegistration: async () => ({ scope: altScope, pushManager: { getSubscription: async () => sub } }) },
    removeEndpoint: async endpoint => calls.push(endpoint),
  });
  assert.deepEqual(calls, ['unsubscribe', sub.endpoint]);
});

test('offline cloud cleanup cannot reactivate an unsubscribed endpoint', async () => {
  let active = true;
  const sub = { endpoint: 'alt-endpoint', async unsubscribe() { active = false; return true; } };
  await retireAltSubscription({ scope: altScope,
    serviceWorker: { getRegistration: async () => ({ scope: altScope, pushManager: { getSubscription: async () => sub } }) },
    removeEndpoint: async () => { throw Error('offline'); },
  });
  assert.equal(active, false);
});

test('an active subscription that refuses unsubscribe is reported as a failure', async () => {
  const sub = { unsubscribe: async () => false };
  await assert.rejects(retireAltSubscription({ scope: altScope,
    serviceWorker: { getRegistration: async () => ({ scope: altScope, pushManager: { getSubscription: async () => sub } }) },
  }), /still active/);
});

const source = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
function appFunction(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  const firstLine = source.slice(start, source.indexOf('\n', start));
  if (firstLine.trimEnd().endsWith('}')) return firstLine;
  return source.slice(start, source.indexOf('\n}', start) + 2);
}

test('ALT never asks permission, resubscribes or sends local/server test notifications, and preserves synced preferences', async () => {
  const preferences = { notifOff: false, notifDue: true }; let effects = 0, cleanup = 0;
  const ctx = vm.createContext({ ALT_SYSTEM_NOTIFICATIONS: false, state: { settings: preferences },
    Notification: { permission: 'granted', requestPermission() { effects++; } },
    window: { Notification: {} }, navigator: { serviceWorker: { ready: Promise.resolve({ showNotification() { effects++; } }) } },
    sb: { functions: { invoke() { effects++; } } }, currentUser: { id: 'fake' },
    showToast() {}, save() { effects++; }, renderProfile() {}, dropPush: async () => { cleanup++; },
  });
  for (const name of ['notifOn', 'autoAskReady', 'subscribePush', 'enableNotif', 'toggleNotifAll', 'testServerPush', 'testNotify', 'notify']) vm.runInContext(appFunction(name), ctx);
  assert.equal(vm.runInContext('notifOn()', ctx), false);
  assert.equal(vm.runInContext('autoAskReady()', ctx), false);
  for (const action of ['subscribePush()', 'enableNotif()', 'toggleNotifAll()', 'testServerPush()', 'testNotify()', "notify('title', 'body')"]) await vm.runInContext(action, ctx);
  assert.equal(effects, 0); assert.equal(cleanup, 1);
  assert.deepEqual(preferences, { notifOff: false, notifDue: true });
});

test('automatic reconnect retires ALT instead of registering it again', async () => {
  let retired = 0, registered = 0;
  const ctx = vm.createContext({ ALT_SYSTEM_NOTIFICATIONS: false, state: { settings: {} },
    pushSupported: () => true, pushGranted: async () => true, dropPush: async () => retired++,
    subscribePush: async () => registered++, refreshPushState: async () => {}, recordPushDiag() {}, renderProfile() {}, askPushFix() {},
  });
  vm.runInContext('let _ensuring = null;\n' + appFunction('notifOn') + '\n' + appFunction('ensurePush'), ctx);
  await vm.runInContext('ensurePush()', ctx);
  assert.equal(retired, 1); assert.equal(registered, 0);
});

test('ALT worker update unsubscribes its own push without enumerating main registrations', async () => {
  const handlers = {}, tasks = []; let retired = 0, claimed = 0;
  const worker = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(worker, { self: { registration: { pushManager: { getSubscription: async () => ({ unsubscribe: async () => retired++ }) } },
    clients: { claim: async () => claimed++ }, addEventListener: (event, handler) => handlers[event] = handler },
    caches: { keys: async () => [] },
  });
  handlers.activate({ waitUntil: task => tasks.push(task) });
  await Promise.all(tasks);
  assert.equal(retired, 1); assert.equal(claimed, 1);
});
