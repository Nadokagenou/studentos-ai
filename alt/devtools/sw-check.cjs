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
  // 31 ต.ค. 69 · Chrome ปฏิเสธ addAll ทั้งก้อนถ้ามีชื่อซ้ำ (InvalidStateError: duplicate requests) = SW ติดตั้งไม่ขึ้นเลย
  // เคยหลุดขึ้นเว็บจริง: เรือผี 8 ไฟล์อยู่ทั้งในรายการนี้และใน halloween/cache-manifest.js
  const dupShell = sw.shell.filter((f, i) => sw.shell.indexOf(f) !== i);
  assert.equal(dupShell.length, 0, 'SHELL มีชื่อซ้ำ — Chrome ปฏิเสธ addAll ทั้งก้อน: ' + dupShell.join(', '));
  console.log('PASS แคชติดตั้งไม่มีชื่อซ้ำ (ซ้ำ = Chrome ไม่ยอมติดตั้ง SW)');
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
  // 31 ต.ค. 69 · "ถึงเวลาทำ" เด้งเป็นแจ้งเตือนของเครื่องแม้เปิดแอปอยู่ — แตะแล้วต้องเริ่มงานนั้นในหน้าที่เปิดอยู่ ไม่โหลดหน้าใหม่ทิ้งงานที่กรอกค้าง
  const clickRun = (taskId) => {
    const log = [];
    const win = { url: 'https://example.test/studentos-ai/alt/', postMessage(m) { log.push(['msg', m]); },
      async focus() { log.push(['focus']); return win; }, async navigate(u) { log.push(['nav', u]); return win; } };
    const w = loadWorker({ scope: 'https://example.test/studentos-ai/alt/', async getNotifications() { return []; } },
      { clients: { claim: async () => {}, async matchAll() { return [win]; }, async openWindow(u) { log.push(['open', u]); } } });
    const work = [];
    w.handlers.notificationclick({ waitUntil(p) { work.push(p); },
      notification: { close() {}, data: Object.assign({ url: '/studentos-ai/alt/' }, taskId ? { taskId } : {}) } });
    return Promise.all(work).then(() => JSON.parse(JSON.stringify(log)));   // วัตถุจาก vm คนละ realm — เทียบแค่ข้อมูล
  };
  const withTask = await clickRun('t-42');
  assert.deepEqual(withTask, [['msg', { type: 'start-task', id: 't-42' }], ['focus']]);
  console.log('PASS แตะแจ้งเตือนที่มีงานติดมา = ส่ง start-task ให้หน้าที่เปิดอยู่ ไม่โหลดหน้าใหม่');
  const plainClick = await clickRun(null);
  assert.equal(plainClick[0][0], 'nav');
  console.log('PASS แจ้งเตือนทั่วไป (ไม่มีงานติดมา) ยังพาไปหน้าตาม url เหมือนเดิม');
  // 31 ต.ค. 69 · นัด "ถึงเวลาทำ" จากเซิร์ฟเวอร์ (tag do-<id>) ได้ปุ่มเริ่มเลย + ค้างบนคอม + รู้ว่างานไหน — โดยไม่ต้อง deploy send-reminders
  const doShown = [];
  const doSw = loadWorker({ async showNotification(t, o) { doShown.push(JSON.parse(JSON.stringify(o))); }, async getNotifications() { return []; } });
  const fireDo = async payload => { const work = []; doSw.handlers.push({ waitUntil(p) { work.push(p); }, data: { json: () => payload } }); await Promise.all(work); };
  await fireDo({ title: 'ฟิสิกส์ · บทที่ 4', body: 'ถึงเวลาทำแล้ว', tag: 'do-t9', url: './' });
  await fireDo({ title: 'ฟิสิกส์ · บทที่ 4', body: 'ส่งพรุ่งนี้', tag: 'task-1', url: './' });
  assert.deepEqual(doShown[0].actions, [{ action: 'start', title: 'เริ่มเลย' }]);
  assert.equal(doShown[0].requireInteraction, true);
  assert.equal(doShown[0].data.taskId, 't9');
  assert.deepEqual(doShown[1].actions, []);
  assert.equal(doShown[1].requireInteraction, false);
  assert.equal(doShown[1].data.taskId, undefined);
  console.log('PASS push นัด "ถึงเวลาทำ" ได้ปุ่มเริ่มเลย + ค้างบนคอม · การเตือนแบบอื่นเหมือนเดิม');
  const opened = [];
  const closedSw = loadWorker({ scope: 'https://example.test/studentos-ai/alt/', async getNotifications() { return []; } },
    { clients: { claim: async () => {}, async matchAll() { return []; }, async openWindow(u) { opened.push(u); } } });
  const work2 = [];
  closedSw.handlers.notificationclick({ waitUntil(p) { work2.push(p); }, action: 'start',
    notification: { close() {}, data: { url: '/studentos-ai/alt/', taskId: 't-42' } } });
  await Promise.all(work2);
  assert.equal(opened[0], 'https://example.test/studentos-ai/alt/?do=t-42');
  console.log('PASS แตะ "เริ่มเลย" ตอนแอปปิดอยู่ = เปิดแอปด้วย ?do=<งาน> ให้แอปเข้าโหมดโฟกัสเอง');
  console.log('ALT service worker: 14/14');
})().catch(e => { console.error(e); process.exitCode = 1; });
