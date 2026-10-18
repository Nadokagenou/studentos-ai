// บริบทรายวัน + ปิดเทอม · รัน: node alt/devtools/ctx-day-check.cjs
// โหลด context.js ตัวจริงเข้า vm พร้อม localStorage จำลอง แล้วไล่เคสที่สเปกสัญญาไว้
// (สเปก: alt/docs/superpowers/specs/2026-10-18-daily-context-design.md)
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');

const data = new Map();
const localStorage = {
  getItem: k => (data.has(k) ? data.get(k) : null),
  setItem: (k, v) => data.set(k, String(v)),
  removeItem: k => data.delete(k),
};
const ctx = vm.createContext({ localStorage, console, Date, Math, JSON });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'context.js'), 'utf8'), ctx);
const run = s => vm.runInContext(s, ctx);

let n = 0;
function check(label, fn) { run('ctxClear()'); fn(); n++; console.log('PASS ' + label); }

// วันจันทร์ถัดไป (ไม่ใช่วันนี้) — ให้ทุกเคสไม่ขึ้นกับว่ารันวันไหน และไม่ชนเส้นตัดของเก่า 14 วัน
run(`var MON = new Date(); MON.setHours(0,0,0,0);
  MON.setDate(MON.getDate() + ((8 - MON.getDay()) % 7 || 7));
  function setup() {
    ctxUpsert('class', { subject: 'คณิต', start: '08:00', end: '15:00', weekday: 1 });
    ctxUpsert('routine', { kind: 'travel', title: 'เดินทางไปโรงเรียน', start: '07:00', end: '08:00', weekday: [1,2,3,4,5] });
    ctxUpsert('routine', { kind: 'meal', title: 'กินข้าวเย็น', start: '18:00', end: '19:00' });
  }
  function kinds(d, o) { return busyBlocks(d, o).map(b => b.kind).join(','); }`);

check('วันเรียนปกติมีคาบกับเดินทาง', () => {
  run('setup()');
  assert.equal(run('kinds(MON)'), 'travel,class,meal');
});
check('ปิดเทอมตัดคาบกับเดินทาง เหลือกิจวัตรอื่น', () => {
  run('setup(); ctxSetBreak(ctxAddDays(ctxDayKey(MON), -3), ctxAddDays(ctxDayKey(MON), 10))');
  assert.equal(run('kinds(MON)'), 'meal');
});
check('typical ไม่สนปิดเทอม (แท่งวันธรรมดาในจอตั้งค่า)', () => {
  run('setup(); ctxSetBreak(ctxDayKey(MON), ctxDayKey(MON))');
  assert.equal(run('kinds(MON, { typical: true })'), 'travel,class,meal');
});
check('บอกว่าอยู่บ้าน = ไม่มีคาบแม้ไม่ได้ปิดเทอม', () => {
  run('setup(); ctxSetDay(MON, { school: false })');
  assert.equal(run('kinds(MON)'), 'meal');
});
check('บอกว่าไปโรงเรียนช่วงปิดเทอม = คาบกลับมา', () => {
  run('setup(); ctxSetBreak(ctxDayKey(MON), ctxDayKey(MON)); ctxSetDay(MON, { school: true })');
  assert.equal(run('kinds(MON)'), 'travel,class,meal');
});
check('ช่วงที่ไม่อยู่เป็นก้อน day และกินเวลาว่าง', () => {
  run(`setup(); ctxSetDay(MON, { school: false, blocks: [{ start: '13:00', end: '17:00', title: 'ไปห้าง' }] })`);
  assert.equal(run('kinds(MON)'), 'day,meal');
  const free = run('JSON.stringify(freeSlots(MON).map(s => s.fromHm + "-" + s.toHm))');
  assert.equal(free, JSON.stringify(['06:00-13:00', '17:00-18:00', '19:00-21:30']));
});
check('ไม่อยู่ทั้งวัน = ไม่มีช่องว่างให้วางงาน', () => {
  run('setup(); ctxSetDay(MON, { away: true })');
  assert.equal(run('freeSlots(MON).length'), 0);
});
check('ตัวทำความสะอาดทิ้งเวลาเสีย และจำกัด 6 ก้อน', () => {
  const rec = run(`ctxCleanDay({ school: 'x', blocks: [
    { start: '25:00', end: '26:00', title: 'a' }, { start: '10:00', end: '09:00', title: 'b' },
    ...Array.from({ length: 8 }, (_, i) => ({ start: String(8 + i).padStart(2,'0') + ':00', end: String(8 + i).padStart(2,'0') + ':30', title: 'ช่วง' + i })) ] })`);
  assert.equal(rec.school, null);
  assert.equal(rec.blocks.length, 6);
  assert.equal(rec.blocks[0].start, '08:00');
});
check('บันทึกเก่ากว่า 14 วันถูกตัดตอนเขียน', () => {
  run(`setup(); var OLD = new Date(); OLD.setDate(OLD.getDate() - 20);
       ctxLoad().days[ctxDayKey(OLD)] = ctxCleanDay({ school: false }); ctxSetDay(MON, { school: false })`);
  assert.equal(run('ctxDay(OLD)'), null);
  assert.notEqual(run('ctxDay(MON)'), null);
});
check('ลงที่เก็บ · import กลับมาครบ · clear ล้าง', () => {
  run(`setup(); ctxSetDay(MON, { school: false }); ctxSetBreak(ctxDayKey(MON), ctxDayKey(MON))`);
  const saved = JSON.parse(data.get('studentos.alt.ctx'));
  assert.equal(Object.keys(saved.days).length, 1);
  assert.equal(saved.breaks.length, 1);
  run(`ctxClear(); ctxImport(${JSON.stringify(saved)})`);
  assert.equal(run('ctxDay(MON).school'), false);
  assert.notEqual(run('ctxBreakOn(MON)'), null);
  run('ctxClear()');
  assert.equal(run('ctxBreaks().length'), 0);
});
check('ctxWithDay ไม่เขียนลงที่เก็บ และคืนของเดิม', () => {
  run('setup(); ctxSetDay(MON, { school: true })');
  const before = data.get('studentos.alt.ctx');
  const inside = run(`ctxWithDay(MON, { away: true }, () => freeSlots(MON).length)`);
  assert.equal(inside, 0);
  assert.equal(run('ctxDay(MON).school'), true);
  assert.equal(data.get('studentos.alt.ctx'), before);
});
check('ตั้งปิดเทอมใหม่แทนอันที่ยังไม่จบ · จบปิดเทอมวันนี้ = ถึงเมื่อวาน', () => {
  run(`var T = new Date(); T.setHours(0,0,0,0); var TK = ctxDayKey(T);
       ctxSetBreak(TK, ctxAddDays(TK, 10)); ctxSetBreak(TK, ctxAddDays(TK, 20))`);
  assert.equal(run('ctxBreaks().length'), 1);
  assert.equal(run('ctxBreaks()[0].to'), run('ctxAddDays(TK, 20)'));
  run('ctxEndBreak(T)');
  assert.equal(run('ctxBreakOn(T)'), null);
});
check('ctxDayBar: วันธรรมดายังเห็นคาบ · วันนี้จริงช่วงปิดเทอมไม่เห็น', () => {
  run(`var T2 = new Date(); T2.setHours(0,0,0,0);
       ctxUpsert('class', { subject: 'ไทย', start: '08:00', end: '15:00', weekday: T2.getDay() });
       ctxSetBreak(ctxDayKey(T2), ctxAddDays(ctxDayKey(T2), 5))`);
  const has = o => run(`ctxDayBar(T2.getDay(), ${JSON.stringify(o)}).blocks.some(b => b.of === 'class')`);
  assert.equal(has({}), true);
  assert.equal(has({ real: true }), false);
});
check('ctxDayLines บอกปิดเทอมและวันเปิดเทอม', () => {
  // วันที่สัมพัทธ์กับ MON ทั้งหมด — วันตายตัวจะทำให้เทสต์พังเองเมื่อเวลาผ่านไป
  run(`setup(); var BTO = ctxAddDays(ctxDayKey(MON), 13); ctxSetBreak(ctxAddDays(ctxDayKey(MON), -1), BTO)`);
  const lines = run('ctxDayLines(MON).join(" | ")');
  assert.match(lines, /ปิดเทอม/);
  assert.ok(lines.includes(run('ctxThaiDate(ctxAddDays(BTO, 1))')), lines);
});
// พบในพรีวิว 18 ต.ค. 69: คนที่ยังไม่กรอกตารางเรียนเลย แผนเดา "ว่างตั้งแต่ 19:00" แล้ววางงาน
// ทับช่วง 18:30–21:00 ที่เพิ่งบอกว่าไปห้าง — ทางนี้ไม่ผ่าน freeSlots จึงไม่เห็นบันทึกรายวัน
check('ยังไม่มีตารางเรียน: แผนหักช่วงที่ไม่อยู่ออก', () => {
  run(`var N13 = new Date(MON); N13.setHours(13, 0, 0, 0);
       ctxSetDay(MON, { blocks: [{ start: '18:30', end: '21:00', title: 'ไปห้าง' }] })`);
  const w = run('JSON.stringify(planWindows({ freeHours: 2 }, N13).slots.map(s => s.fromHm + "-" + s.toHm))');
  assert.equal(w, JSON.stringify(['21:00-21:30']));
});
check('ยังไม่มีตารางเรียน + ไม่ไปโรงเรียน: ว่างตั้งแต่ตอนนี้ ไม่ต้องรอหัวค่ำ', () => {
  run(`ctxSetDay(MON, { school: false })`);
  const w = run('JSON.stringify(planWindows({ freeHours: 2 }, N13).slots.map(s => s.fromHm + "-" + s.toHm))');
  assert.equal(w, JSON.stringify(['13:00-21:30']));
});
check('ยังไม่มีตารางเรียน ไม่ได้บอกอะไร: เหมือนเดิมทุกอย่าง (เริ่ม 19:00)', () => {
  const w = run('JSON.stringify(planWindows({ freeHours: 2 }, N13))');
  const o = JSON.parse(w);
  assert.equal(o.mode, 'default');
  assert.deepEqual(o.slots.map(s => s.fromHm + '-' + s.toHm), ['19:00-21:30']);
});
// ---------- 18 ต.ค. 69 · เดาวันนี้ (แบบ ก ที่เจ้าของเลือก: เดาให้ แล้วแตะแก้) ----------
// TUE = อังคารถัดจาก MON · คาบเรียนจันทร์–ศุกร์ เพื่อให้ "วันเรียนก่อนหน้า" มีความหมาย
run(`var TUE = new Date(MON); TUE.setDate(TUE.getDate() + 1);
  var SAT = new Date(MON); SAT.setDate(SAT.getDate() + 5);
  var NMON = new Date(MON); NMON.setDate(NMON.getDate() + 7);
  var FRI = new Date(MON); FRI.setDate(FRI.getDate() + 4);
  function setupWeek() {
    ctxUpsert('class', { subject: 'เรียน', start: '08:00', end: '15:00', weekday: [1,2,3,4,5] });
    ctxUpsert('routine', { kind: 'travel', title: 'เดินทางไปโรงเรียน', start: '07:00', end: '08:00', weekday: [1,2,3,4,5] });
  }`);
check('เดา: วันเรียนปกติที่ไม่มีข้อมูล = ไปเรียนตามตาราง', () => {
  run('setupWeek()');
  assert.equal(run('ctxDayGuess(TUE).kind'), 'class');
  assert.equal(run('ctxSchoolOn(TUE)'), true);
});
check('เดา: เมื่อวานตอบว่าอยู่บ้าน = วันนี้อยู่บ้านด้วย และแผนเชื่อคำเดา', () => {
  run('setupWeek(); ctxSetDay(MON, { school: false })');
  const g = run('ctxDayGuess(TUE)');
  assert.equal(g.kind, 'carry');
  assert.equal(g.fromKey, run('ctxDayKey(MON)'));
  assert.equal(run('ctxSchoolOn(TUE)'), false);
  assert.equal(run('kinds(TUE)'), '');
});
check('เดา: ไม่เดาซ้อนเดา (พุธไม่ตามคำเดาของอังคาร)', () => {
  run('setupWeek(); ctxSetDay(MON, { school: false }); var WED = new Date(MON); WED.setDate(WED.getDate() + 2)');
  assert.equal(run('ctxDayGuess(WED).kind'), 'class');
});
check('เดา: ข้ามสุดสัปดาห์ได้ (ศุกร์อยู่บ้าน → จันทร์อยู่บ้าน)', () => {
  run('setupWeek(); ctxSetDay(FRI, { school: false })');
  assert.equal(run('ctxDayGuess(NMON).kind'), 'carry');
});
check('เดา: ไม่ลากคำว่า "ไม่อยู่ทั้งวัน" ต่อ', () => {
  run('setupWeek(); ctxSetDay(MON, { away: true, school: false })');
  assert.equal(run('ctxDayGuess(TUE).kind'), 'class');
});
check('เดา: วันไม่มีคาบ = free · ไม่มีตารางเลย = unknown · ปิดเทอม = break · ตอบแล้ว = set', () => {
  run('setupWeek()');
  assert.equal(run('ctxDayGuess(SAT).kind'), 'free');
  run('ctxSetBreak(ctxDayKey(TUE), ctxDayKey(TUE))');
  assert.equal(run('ctxDayGuess(TUE).kind'), 'break');
  run('ctxSetDay(TUE, { school: true })');
  assert.equal(run('ctxDayGuess(TUE).kind'), 'set');
  run('ctxClear()');
  assert.equal(run('ctxDayGuess(TUE).kind'), 'unknown');
});
check('เดา: บริบทของน้องไซบอกว่าเป็นคำเดา', () => {
  run('setupWeek(); ctxSetDay(MON, { school: false })');
  assert.match(run('ctxDayLines(TUE).join(" | ")'), /ไม่ไปโรงเรียน.*เดา/);
});
console.log(`ctx-day: ${n}/${n}`);
