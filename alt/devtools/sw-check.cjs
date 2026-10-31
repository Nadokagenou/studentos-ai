// กันการปล่อย ALT ไปล้างแคชเว็บหลัก และกันออฟไลน์ย้อนอ่านไฟล์ชุดเก่า
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(base, 'sw.js'), 'utf8');
// โหลด sw.js ใหม่ทุกครั้งในบริบทแยก — แต่ละเคสได้แคช/registration ของตัวเอง ไม่ปนกัน
function loadWorker(registration, selfExtra = {}) {
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
    importScripts: file => vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx),
    fetch: async () => { throw new Error('offline'); },
    self: Object.assign({ addEventListener: (event, fn) => { w.handlers[event] = fn; },
      skipWaiting: async () => {}, clients: { claim: async () => {} }, registration }, selfExtra),
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
  for (const f of ['desktop.css', 'desktop-entry.js', 'desktop.js', 'desktop-navigation.mjs']) {
    assert.ok(sw.shell.includes(f), 'desktop offline shell missing: ' + f);
  }
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
  let eventIntercepted=false;
  sw.handlers.fetch({request:{method:'GET',url:'https://example.test/alt/halloween/event/config.json'},respondWith(p){eventIntercepted=true;Promise.resolve(p).catch(()=>{});}});
  assert.equal(eventIntercepted,false,'ปิดอีเวนต์แล้วต้องไม่คืน enabled:true จากแคช');
  console.log('PASS หน้าอีเวนต์และสวิตช์เปิดกิจกรรมไม่ย้อนอ่านจากแคช');
  // 31 ต.ค. 69 · แจ้งเตือนแบบแอปทั่วไป — ไอคอนแถบสถานะเป็นเงาบนพื้นใส (badge-96.png) · เลขบนไอคอนแอป = จำนวนการ์ดที่ค้างในถาด
  const shown = [], badges = [];
  let tray = [{}, {}];
  const pushSw = loadWorker({ async showNotification(t, o) { shown.push({ t, o }); }, async getNotifications() { return tray; } },
    { navigator: { async setAppBadge(n) { badges.push(n); }, async clearAppBadge() { badges.push(0); } } });
  const fire = async (ev, extra) => { const work = []; pushSw.handlers[ev](Object.assign({ waitUntil(p) { work.push(p); } }, extra)); await Promise.all(work); };
  await fire('push', { data: { json: () => ({ title: 'ใบงานฟิสิกส์', body: 'ส่งพรุ่งนี้', tag: 'task-1' }) } });
  assert.equal(shown[0].o.badge, 'badge-96.png');
  assert.equal(shown[0].o.icon, 'icon-192.png');
  assert.equal(shown[0].o.tag, 'task-1');
  assert.deepEqual(badges, [2]);
  assert.ok(sw.shell.includes('badge-96.png'), 'badge-96.png ต้องอยู่ในแคชออฟไลน์');
  console.log('PASS แจ้งเตือนใช้ไอคอนแถบสถานะแบบเงาใส · เลขบนไอคอนแอปเท่าจำนวนการ์ดในถาด');
  tray = [];
  await fire('notificationclose', { notification: {} });
  assert.deepEqual(badges, [2, 0]);
  console.log('PASS ปัดการ์ดใบสุดท้ายทิ้ง = ล้างเลขบนไอคอนแอป');
  const plain = loadWorker({ async showNotification(t, o) { shown.push({ t, o }); }, async getNotifications() { return [{}]; } });
  const work = [];
  plain.handlers.push({ waitUntil(p) { work.push(p); }, data: { json: () => ({ title: 'x' }) } });
  await Promise.all(work);
  assert.equal(shown.length, 2);
  console.log('PASS เบราว์เซอร์ที่ไม่มี Badging API ยังเด้งการ์ดได้ ไม่ล้ม');
  console.log('ALT service worker: 9/9');
})().catch(e => { console.error(e); process.exitCode = 1; });
