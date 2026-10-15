// ตรวจพฤติกรรมที่เคยทำโทเคนหาย โดยใช้ฟังก์ชันจริงจากแอปในหน่วยความจำจำลอง
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
const quiet = { log() {}, table() {}, warn() {} };
const parser = vm.createContext({ console: quiet, performance, window: {} });
vm.runInContext(fs.readFileSync(path.join(base, 'engine.js'), 'utf8'), parser);
vm.runInContext(fs.readFileSync(path.join(base, 'inbox.js'), 'utf8'), parser);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'parsebench.js'), 'utf8'), parser);
const parsed = vm.runInContext('window.benchParse()', parser);
console.log(`Parser: ${parsed.pass}/${parsed.total}`);
for (const fail of parsed.fails) console.log(JSON.stringify(fail));
if (process.argv.includes('--parser-only')) process.exit(parsed.fails.length ? 1 : 0);

function section(from, to) {
  const a = app.indexOf(from), b = app.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `ไม่พบส่วน ${from}`);
  return app.slice(a, b);
}
const data = new Map();
let blocked = false;
const storage = {
  getItem: k => data.get(k) ?? null,
  setItem(k, v) { if (blocked) throw new Error('storage full'); data.set(k, String(v)); },
};
const game = vm.createContext({ localStorage: storage, console, showToast() {}, fmtTok: String, uid: () => 'round-' + Math.random() });
vm.runInContext(`const TOKEN_KEY = 'tokens', VAULT_AT_KEY = 'at';
let tokenAdmin = false, drawResults = [], drawOpen = [];
const SPIN_COST_1 = 2, SPIN_COST_10 = 10;
const DUP_REFUND = { rare: 1.5, legendary: 2.5, mythic: 10 };
${section('function rawTokenState()', 'function tokenBalance()')}
${section('function grantPrize(r)', '// เวลาไทยตอนนี้')}
${section('function restorePendingDraw()', '// ---------- 1C40')}
${section('function drawBusy()', 'function applyDrawLock()')}`, game);
const run = s => vm.runInContext(s, game);
const state = () => JSON.parse(data.get('tokens'));
const token = { id: 'tk1', kind: 'token', rarity: 'common', amount: 0.4 };
const skin = { id: 'earth', kind: 'skin', rarity: 'rare', label: 'โลก' };
let checks = 0;
function check(label, fn) { fn(); checks++; console.log('PASS ' + label); }
function seed(value) { data.clear(); data.set('tokens', JSON.stringify(value)); run('drawResults=[];drawOpen=[]'); }
function pay(n, results) { game.input = results; return run(`paySpin(${n}, input)`); }

check('หักยอดและเก็บผลก่อนเปิดการ์ด', () => {
  seed({ bal: 20 }); assert.equal(pay(1, [token]).ok, true);
  assert.equal(state().bal, 18); assert.equal(state().pendingDraw.results.length, 1);
});
check('รีโหลดแล้วเปิดผลเดิมโดยไม่หักซ้ำ', () => {
  run('restorePendingDraw()'); assert.equal(run('drawResults[0].amount'), 0.4);
  assert.equal(run('grantPrize(drawResults[0]).granted'), true);
  assert.equal(state().bal, 18.4);
});
check('เปิดซ้ำหลังรีโหลดไม่แจกโทเคนซ้ำ', () => {
  run('drawResults=[];restorePendingDraw();grantPrize(drawResults[0])');
  assert.equal(state().bal, 18.4);
});
check('รอบสิบใบที่เปิดบางส่วนกู้ได้และของซ้ำคืนครั้งเดียว', () => {
  seed({ bal: 20 }); const prizes = [skin, skin, ...Array(8).fill(token)];
  assert.equal(pay(10, prizes).ok, true);
  run('restorePendingDraw();grantPrize(drawResults[0]);drawResults=[];restorePendingDraw()');
  assert.equal(run('drawOpen[0]'), true); assert.equal(run('drawOpen[1]'), false);
  run('drawResults.forEach(grantPrize)');
  assert.equal(state().skins.earth, 2); assert.equal(state().bal, 14.7);
  run('drawResults=[];restorePendingDraw();drawResults.forEach(grantPrize)');
  assert.equal(state().skins.earth, 2); assert.equal(state().bal, 14.7);
});
check('สิทธิ์ฟรีไม่ถูกกินซ้ำหลังรีโหลด', () => {
  seed({ bal: 3, freeSpins: 1 }); assert.equal(pay(1, [skin]).free, true);
  run('restorePendingDraw();grantPrize(drawResults[0])');
  assert.equal(state().freeSpins, 0); assert.equal(state().bal, 3);
});
check('โทเคนไม่พอไม่สร้างรอบหรือเปลี่ยนยอด', () => {
  seed({ bal: 1 }); assert.equal(pay(1, [skin]).ok, false);
  assert.deepEqual(state(), { bal: 1 });
});
check('ที่เก็บเต็มไม่หักยอด', () => {
  seed({ bal: 20 }); blocked = true;
  try { assert.equal(pay(1, [skin]).storage, true); } finally { blocked = false; }
  assert.deepEqual(state(), { bal: 20 });
});
check('บันทึกรางวัลไม่ได้ยังเปิดใหม่ได้ภายหลัง', () => {
  seed({ bal: 20 }); pay(1, [skin]); run('restorePendingDraw()'); blocked = true;
  try { assert.equal(run('grantPrize(drawResults[0])'), null); } finally { blocked = false; }
  assert.equal(state().pendingDraw.results[0].granted, undefined);
  run('drawResults=[];restorePendingDraw();grantPrize(drawResults[0])');
  assert.equal(state().skins.earth, 1);
});
check('รอบที่ค้างกันการสุ่มซ้ำ', () => {
  seed({ bal: 20 }); pay(1, [skin]); assert.equal(pay(1, [skin]).pending, true);
  assert.equal(state().bal, 18);
});
check('ออกจากจอตอนพื้นที่เต็มไม่แจ้งว่ารับครบ และรอบค้างยังกู้ได้', () => {
  seed({ bal: 20 }); pay(1, [skin]); run('restorePendingDraw()'); blocked = true;
  try { assert.equal(run('drawSettle()'), false); } finally { blocked = false; }
  assert.equal(state().pendingDraw.results[0].granted, undefined);
  run('drawResults=[];restorePendingDraw();drawSettle();clearCompletedDraw()');
  assert.equal(state().skins.earth, 1); assert.equal(state().pendingDraw, undefined);
});
console.log(`Draw recovery: ${checks}/${checks}`);
// เคสจริง: หน้าแรกเลือกอังกฤษ แต่บริบท AI เดิมเรียงคณิตที่เลยกำหนดไว้ก่อน
const english = { id: 'en', detail: 'เขียนเรียงความ', estMin: 30 };
const math = { id: 'math', detail: 'คณิตข้อ 1-5', estMin: 20 };
const future = { id: 'later', detail: 'อ่านสอบ', estMin: 60, scorePct: 25 };
function contextFor(plan) {
  const ctx = vm.createContext({
    focusPlan: () => plan, pendingTasks: () => [math, english, future], liveTasks: () => [],
    sortByPriority() { throw new Error('AI ห้ามจัดลำดับแข่งกับแผนกลาง'); },
    who: () => 'ผู้ทดสอบ', fmtThaiDate: () => '15 ต.ค.',
    fmtClock: d => d.toISOString().slice(11, 16), taskTitleText: t => t.detail,
    priorityInfo: () => ({ stars: 3 }), priorityLabel: () => 'สำคัญ',
    whyList: info => info.reasons, humanMin: String, calKey: () => '2026-10-15',
  });
  vm.runInContext(section('function aiContext(', '// ---------- เรียกน้องไซ'), ctx);
  return vm.runInContext('aiContext(new Date("2026-10-15T07:00:00Z"))', ctx);
}
const slot = { task: english, start: '2026-10-15T09:40:00Z', end: '2026-10-15T10:10:00Z' };
const canonical = { now: { task: english, info: { reasons: ['วันนี้เป็นโอกาสสุดท้าย'] }, slot },
  next: { task: math }, plan: { slots: [slot, { break: true }, { task: math }] }, later: [future] };
let aiChecks = 0;
function checkAI(label, fn) { fn(); aiChecks++; console.log('PASS ' + label); }
checkAI('บริบท AI ใช้งานแรกและเหตุผลเดียวกับหน้าแรกแม้คะแนนล้วนจัดอีกใบก่อน', () => {
  const s = contextFor(canonical);
  assert.ok(s.includes('- งานแรก: เขียนเรียงความ'));
  assert.ok(s.includes('- เหตุผลของแผน: วันนี้เป็นโอกาสสุดท้าย'));
  assert.ok(s.indexOf('1. เขียนเรียงความ') < s.indexOf('2. คณิตข้อ 1-5'));
  assert.equal((s.match(/1\. เขียนเรียงความ/g) || []).length, 1);
});
checkAI('งานนอกแผนยังอยู่ในบริบทพร้อมข้อมูลคะแนน', () => {
  const s = contextFor(canonical); assert.ok(s.includes('3. อ่านสอบ'));
  assert.ok(s.includes('คะแนนเก็บ 25%'));
});
checkAI('เมื่อแผนไม่มีงานแรก AI ไม่แต่งงานแรกจากคะแนนเอง', () => {
  const s = contextFor({ now: null, next: null, plan: { slots: [] }, later: [math, english, future] });
  assert.ok(s.includes('- งานแรก: ยังไม่มีงานที่แผนเสนอให้ทำตอนนี้'));
});
console.log(`AI plan context: ${aiChecks}/${aiChecks}`);
process.exitCode = parsed.fails.length ? 1 : 0;
