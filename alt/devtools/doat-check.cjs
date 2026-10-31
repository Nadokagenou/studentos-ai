// นัด "เตือนให้ทำตอน" ตอนเปิดแอปอยู่ · รัน: node alt/devtools/doat-check.cjs        (สาย ALT)
//                                      node alt/devtools/doat-check.cjs .      (แอปหลักที่ราก)
// ตัด doAtTick + doAtCopy ตัวจริงจาก app.js มารันใน vm — notify / showToast / ถาดแจ้งเตือนเป็นตัวจำลอง
// (31 ต.ค. 69 · เจ้าของ: "มันต้องอยู่เหนือแอปไปกว่านี้เหมือนแจ้งเตือนในโทรศัพท์เลย" → แจ้งเตือนของเครื่องจริง)
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');

const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8').split(/\r?\n/);

// ตัดฟังก์ชันตามชื่อ (มี async นำหน้าก็ได้) ถึง "}" ตัวแรกที่ชิดซ้าย
function cut(name) {
  const a = app.findIndex(l => l.startsWith('function ' + name + '(') || l.startsWith('async function ' + name + '('));
  assert.ok(a >= 0, 'ไม่เจอ function ' + name + ' ใน ' + path.join(dir, 'app.js'));
  let b = a; while (app[b] !== '}') b++;
  return app.slice(a, b + 1).join('\n');
}
const lateLine = app.find(l => l.startsWith('const DO_LATE_MS'));
assert.ok(lateLine, 'ไม่เจอ const DO_LATE_MS');

// สร้างโลกใหม่ทุกเคส: งานที่ถึงเวลาแล้ว · การ์ดที่ค้างในถาด · notify ได้/ไม่ได้ต่องาน
function world({ tasks, tray = [], canNotify = () => true, inView = true }) {
  const w = { notified: [], toasts: [], saves: 0 };
  const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Number, Promise, setTimeout,
    state: { tasks },
    pendingTasks: () => tasks.filter(t => !t.done && !t.deleted),
    appInView: () => inView,
    shownTags: async () => new Set(tray),
    taskTitleText: t => t.title,
    fmtClock: d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
    notify: async (title, body, tag, data) => { const ok = !!canNotify(tag); if (ok) w.notified.push({ title, body, tag, data }); return ok; },
    showToast: o => { w.toasts.push(o); },
    haptic: () => {},
    startFocus: () => {},
    save: () => { w.saves++; },
    pushState: 'on', AWAY_CONFIRM_MS: 0,
  });
  vm.runInContext('var doAwayTimer = null;\n' + lateLine + '\n' + cut('doAtCopy') + '\n' + cut('doAtTick'), ctx);
  w.tick = () => vm.runInContext('doAtTick()', ctx);
  return w;
}
const ago = min => new Date(Date.now() - min * 60e3).toISOString();
const task = (id, title, extra) => Object.assign({ id, title, doAt: ago(1), doAtShown: null, estMin: 30 }, extra);

let n = 0;
async function check(label, fn) { await fn(); n++; console.log('PASS ' + label); }

(async () => {
  await check('เปิดแอปอยู่ + อนุญาตแจ้งเตือน = เด้งเป็นแจ้งเตือนของเครื่อง ไม่มีการ์ดในแอปซ้อน', async () => {
    const t = task('a', 'ใบงานฟิสิกส์');
    const w = world({ tasks: [t] });
    await w.tick();
    assert.equal(w.notified.length, 1);
    assert.equal(w.notified[0].tag, 'do-a');
    assert.equal(w.notified[0].title, 'ใบงานฟิสิกส์');
    assert.match(w.notified[0].body, /^ถึงเวลาทำแล้ว · \d\d:\d\d · ~30 นาที$/);
    assert.equal(JSON.stringify(w.notified[0].data), '{"taskId":"a"}');   // แตะแล้ว sw.js รู้ว่าต้องเริ่มงานไหน
    assert.equal(w.toasts.length, 0);
    assert.equal(t.doAtShown, t.doAt);   // ปักไว้ให้ send-reminders ข้าม — ไม่งั้นได้ push ซ้ำอีกดอก
    assert.ok(w.saves > 0);
  });

  await check('ถึงเวลาพร้อมกันหลายงาน = แจ้งเตือนของเครื่องทีละงาน', async () => {
    const w = world({ tasks: [task('a', 'ฟิสิกส์'), task('b', 'เคมี'), task('c', 'ชีวะ')] });
    await w.tick();
    assert.deepEqual(w.notified.map(x => x.tag), ['do-a', 'do-b', 'do-c']);
    assert.equal(w.toasts.length, 0);
  });

  await check('ยังไม่อนุญาต / ปิดแจ้งเตือน = การ์ดในแอป + ปุ่มเริ่มเลยแบบเดิม (ทางสำรองห้ามถอด)', async () => {
    const t = task('a', 'ใบงานฟิสิกส์');
    const w = world({ tasks: [t], canNotify: () => false });
    await w.tick();
    assert.equal(w.notified.length, 0);
    assert.equal(w.toasts.length, 1);
    assert.equal(w.toasts[0].title, 'ถึงเวลาทำแล้ว');
    assert.equal(w.toasts[0].action.label, 'เริ่มเลย');
    assert.equal(t.doAtShown, t.doAt);
  });

  await check('เด้งได้บางงาน = การ์ดในแอปพูดถึงเฉพาะงานที่เด้งไม่ได้', async () => {
    const w = world({ tasks: [task('a', 'ฟิสิกส์'), task('b', 'เคมี')], canNotify: tag => tag === 'do-a' });
    await w.tick();
    assert.deepEqual(w.notified.map(x => x.tag), ['do-a']);
    assert.equal(w.toasts.length, 1);
    assert.equal(w.toasts[0].body, 'เคมี');
  });

  await check('เซิร์ฟเวอร์ส่งการ์ดงานนี้มาแล้ว (ยังค้างในถาด) = ไม่เด้งซ้ำ ปักเงียบ ๆ', async () => {
    const t = task('a', 'ฟิสิกส์');
    const w = world({ tasks: [t], tray: ['do-a'] });
    await w.tick();
    assert.equal(w.notified.length, 0);
    assert.equal(w.toasts.length, 0);
    assert.equal(t.doAtShown, t.doAt);
  });

  await check('ปักแล้ว = รอบถัดไป (15 วิ) ไม่เด้งซ้ำ', async () => {
    const w = world({ tasks: [task('a', 'ฟิสิกส์')] });
    await w.tick(); await w.tick();
    assert.equal(w.notified.length, 1);
  });

  await check('เลยเวลานัดเกิน 30 นาที = ไม่พูดแล้ว', async () => {
    const t = task('a', 'ฟิสิกส์', { doAt: ago(45) });
    const w = world({ tasks: [t] });
    await w.tick();
    assert.equal(w.notified.length + w.toasts.length, 0);
    assert.equal(t.doAtShown, t.doAt);
  });

  console.log(`doAt ตอนเปิดแอป (${path.basename(dir) === 'alt' ? 'ALT' : 'แอปหลัก'}): ${n}/${n}`);
})().catch(e => { console.error(e); process.exitCode = 1; });
