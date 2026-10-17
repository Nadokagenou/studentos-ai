// กันการปล่อย ALT ไปล้างแคชเว็บหลัก และกันออฟไลน์ย้อนอ่านไฟล์ชุดเก่า
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(base, 'sw.js'), 'utf8');
// โหลด sw.js ใหม่ทุกครั้งในบริบทแยก — แต่ละเคสได้แคช/registration ของตัวเอง ไม่ปนกัน
function loadWorker(registration) {
  const w = { handlers: {}, removed: [], matches: [], shell: [], selectedCache: '' };
  const caches = {
    async keys() { return ['studentos-1c57', 'studentos-alt-previous', w.selectedCache, 'other-app']; },
    async delete(k) { w.removed.push(k); return true; },
    async open(k) {
      w.selectedCache = k;
      return {
        async addAll(paths) { w.shell = paths; },
        async match(request, opts) { w.matches.push({ cache: k, request, opts }); return 'current-alt-response'; },
      };
    },
    match() { throw new Error('ต้องไม่อ่านไฟล์จากแคชรวมที่อาจเก่า'); },
  };
  const ctx = vm.createContext({ URL, location: { origin: 'https://example.test' }, caches,
    fetch: async () => { throw new Error('offline'); },
    self: { addEventListener: (event, fn) => { w.handlers[event] = fn; },
      skipWaiting: async () => {}, clients: { claim: async () => {} }, registration },
  });
  vm.runInContext(source, ctx);
  // activate เรียก waitUntil สองครั้ง (ล้างแคช + ถอน push) — ต้องรอให้ครบทุกอัน
  w.lifeCycle = async event => {
    const work = []; w.handlers[event]({ waitUntil(p) { work.push(p); } }); await Promise.all(work);
  };
  return w;
}
(async () => {
  const unsubscribed = [];
  const sw = loadWorker({ pushManager: { async getSubscription() {
    return { async unsubscribe() { unsubscribed.push(true); return true; } };
  } } });
  await sw.lifeCycle('install');
  for (const f of sw.shell) assert.ok(fs.existsSync(path.join(base, f)), 'SHELL ไม่มีไฟล์: ' + f);
  console.log('PASS ไฟล์ในแคชติดตั้งมีอยู่ครบ');
  await sw.lifeCycle('activate');
  assert.deepEqual(sw.removed, ['studentos-alt-previous']);
  console.log('PASS อัปเดต ALT เก็บแคชเว็บหลักและแอปอื่นไว้');
  assert.equal(unsubscribed.length, 1);
  console.log('PASS activate ถอนการรับ push ของ ALT ออก (ไม่เตือนซ้ำกับแอปหลัก)');
  // เบราว์เซอร์ที่ไม่มี Push API (เช่น iPhone ที่ยังไม่ได้ติดตั้งเป็นแอป) — activate ต้องไม่ล้ม
  const noPush = loadWorker({});
  await noPush.lifeCycle('install');
  await noPush.lifeCycle('activate');
  assert.deepEqual(noPush.removed, ['studentos-alt-previous']);
  console.log('PASS activate ไม่ล้มเมื่อเบราว์เซอร์ไม่มี pushManager');
  let response;
  sw.handlers.fetch({ request: { method: 'GET', url: 'https://example.test/alt/app.js?check=1' },
    respondWith(p) { response = p; } });
  assert.equal(await response, 'current-alt-response');
  assert.equal(sw.matches.length, 1);
  assert.equal(sw.matches[0].cache, sw.selectedCache);
  assert.equal(sw.matches[0].opts.ignoreSearch, true);
  console.log('PASS ออฟไลน์ใช้ไฟล์จากแคช ALT ปัจจุบัน');
  console.log('ALT service worker: 5/5');
})().catch(e => { console.error(e); process.exitCode = 1; });
