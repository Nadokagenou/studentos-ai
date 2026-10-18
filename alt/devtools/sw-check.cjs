// กันการปล่อย ALT ไปล้างแคชเว็บหลัก และกันออฟไลน์ย้อนอ่านไฟล์ชุดเก่า
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const handlers = {};
const removed = [], matches = [];
let shell = [], selectedCache = '';
const caches = {
  async keys() { return ['studentos-1c57', 'studentos-alt-previous', selectedCache, 'other-app']; },
  async delete(k) { removed.push(k); return true; },
  async open(k) {
    selectedCache = k;
    return {
      async addAll(paths) { shell = paths; },
      async match(request, opts) { matches.push({ cache: k, request, opts }); return 'current-alt-response'; },
    };
  },
  match() { throw new Error('ต้องไม่อ่านไฟล์จากแคชรวมที่อาจเก่า'); },
};
const ctx = vm.createContext({ URL, location: { origin: 'https://example.test' }, caches,
  fetch: async () => { throw new Error('offline'); },
  self: { addEventListener: (event, fn) => { handlers[event] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
    // 17 ต.ค. 69 · sw.js ตอน activate อ่าน self.registration.pushManager (ถอด push ของ ALT — 16 ต.ค. "รับแจ้งเตือนจากแอปหลักเท่านั้น")
    // ตัวจำลองเดิมไม่มี registration เทสต์จึงพังตั้งแต่ activate ก่อนได้ตรวจอะไร · ไม่มี pushManager = เครื่องที่ไม่รองรับ push
    registration: { pushManager: null } },
});
vm.runInContext(fs.readFileSync(path.join(base, 'sw.js'), 'utf8'), ctx);
async function lifeCycle(event) {
  let work; handlers[event]({ waitUntil(p) { work = p; } }); await work;
}
(async () => {
  await lifeCycle('install');
  for (const f of shell) assert.ok(fs.existsSync(path.join(base, f)), 'SHELL ไม่มีไฟล์: ' + f);
  console.log('PASS ไฟล์ในแคชติดตั้งมีอยู่ครบ');
  await lifeCycle('activate');
  assert.deepEqual(removed, ['studentos-alt-previous']);
  console.log('PASS อัปเดต ALT เก็บแคชเว็บหลักและแอปอื่นไว้');
  let response;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.test/alt/app.js?check=1' },
    respondWith(p) { response = p; } });
  assert.equal(await response, 'current-alt-response');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].cache, selectedCache);
  assert.equal(matches[0].opts.ignoreSearch, true);
  console.log('PASS ออฟไลน์ใช้ไฟล์จากแคช ALT ปัจจุบัน');
  console.log('ALT service worker: 3/3');
})().catch(e => { console.error(e); process.exitCode = 1; });
