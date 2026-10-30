// วิชาที่เพิ่มเอง · รัน: node alt/devtools/subjects-check.cjs        (สาย ALT)
//                       node alt/devtools/subjects-check.cjs .      (แอปหลักที่ราก)
// โหลด engine.js ตัวจริง + ตัดฟังก์ชันชุด "วิชาที่เพิ่มเอง" จาก app.js มารันใน vm
// (31 ต.ค. 69 · เทสเตอร์ขอ "อยากเพิ่มวิชาได้เอง")
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');

const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8').split(/\r?\n/);

// ตัดฟังก์ชันตามชื่อ: ตั้งแต่บรรทัด "function ชื่อ(" ถึง "}" ตัวแรกที่ชิดซ้าย
function cut(name) {
  const a = app.findIndex(l => l.startsWith('function ' + name + '('));
  assert.ok(a >= 0, 'ไม่เจอ function ' + name + ' ใน ' + path.join(dir, 'app.js'));
  let b = a; while (app[b] !== '}') b++;
  return app.slice(a, b + 1).join('\n');
}
const maxLine = app.find(l => l.startsWith('const CUSTOM_SUBJECT_MAX'));
assert.ok(maxLine, 'ไม่เจอ const CUSTOM_SUBJECT_MAX');

let saves = 0;
const ctx = vm.createContext({ console, Date, Math, JSON, save: () => { saves++; } });
vm.runInContext(fs.readFileSync(path.join(dir, 'engine.js'), 'utf8'), ctx);
vm.runInContext('var state = { settings: {} };\n' + maxLine + '\n'
  + ['customSubjects', 'allSubjects', 'addCustomSubject', 'removeCustomSubject'].map(cut).join('\n'), ctx);
const run = s => vm.runInContext(s, ctx);
const subj = text => run(`parseAssignment(${JSON.stringify(text)}, new Date(), {}).subject`);

let n = 0;
function check(label, fn) { run('state = { settings: {} }'); saves = 0; fn(); n++; console.log('PASS ' + label); }

check('ไม่มีวิชาที่เพิ่มเอง = ตัวแกะทำงานเหมือนเดิม', () => {
  assert.equal(subj('ใบงานฟิสิกส์ ส่งพรุ่งนี้'), 'ฟิสิกส์');
  assert.equal(subj('ชุมนุมหุ่นยนต์ ส่งงานพรุ่งนี้'), 'อื่น ๆ');
});

check('ชื่อวิชาที่เพิ่มเองในข้อความ = จับเป็นวิชานั้น', () => {
  run(`state.settings.subjects = ['ชุมนุมหุ่นยนต์']`);
  assert.equal(subj('ชุมนุมหุ่นยนต์ ส่งงานพรุ่งนี้'), 'ชุมนุมหุ่นยนต์');
});

check('วิชาที่ตั้งเองเจาะจงกว่า มาก่อนวิชาในตัว ("ฟิสิกส์ประยุกต์" ไม่โดน "ฟิสิกส์" กิน)', () => {
  run(`state.settings.subjects = ['ฟิสิกส์ประยุกต์']`);
  assert.equal(subj('ฟิสิกส์ประยุกต์ ใบงาน 2 ส่งศุกร์'), 'ฟิสิกส์ประยุกต์');
  assert.equal(subj('การบ้านคณิต ส่งพรุ่งนี้'), 'คณิตศาสตร์');
});

check('เพิ่มวิชา: ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้อน แล้วบันทึก', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(run(`addCustomSubject('  ชุมนุม   หุ่นยนต์ ')`))), { name: 'ชุมนุม หุ่นยนต์' });
  assert.deepEqual([...run('state.settings.subjects')], ['ชุมนุม หุ่นยนต์']);
  assert.equal(saves, 1);
});

check('เพิ่มวิชา: ปฏิเสธชื่อว่าง · ยาวเกิน · "อื่น ๆ" · ซ้ำวิชาในตัว · ซ้ำของตัวเอง (ไม่สนตัวพิมพ์)', () => {
  for (const bad of ['', '   ', 'ก'.repeat(31), 'อื่น ๆ', 'อื่นๆ', 'คณิตศาสตร์', ' ภาษาไทย ']) {
    assert.ok(run(`addCustomSubject(${JSON.stringify(bad)})`).error, 'ต้องปฏิเสธ: ' + JSON.stringify(bad));
  }
  assert.equal(run(`addCustomSubject('Robotics')`).name, 'Robotics');
  assert.ok(run(`addCustomSubject('robotics')`).error);
  assert.equal(run(`addCustomSubject('ก'.repeat(30))`).name.length, 30);
  assert.equal(saves, 2);
});

check('รายชื่อทั้งหมด: วิชาในตัว → วิชาที่เพิ่มเอง → "อื่น ๆ" ปิดท้ายเสมอ', () => {
  const builtin = run('SUBJECTS.length');
  run(`addCustomSubject('ชุมนุมหุ่นยนต์'); addCustomSubject('ติวสอบเข้า')`);
  const names = [...run('allSubjects().map(s => s.name)')];
  assert.equal(names.length, builtin + 2);
  assert.deepEqual(names.slice(-3), ['ชุมนุมหุ่นยนต์', 'ติวสอบเข้า', 'อื่น ๆ']);
  assert.equal(run(`allSubjects().filter(s => s.custom).length`), 2);
});

check('ลบวิชาที่เพิ่มเอง · วิชาในตัวลบไม่ได้', () => {
  run(`addCustomSubject('ชุมนุมหุ่นยนต์'); addCustomSubject('ติวสอบเข้า')`);
  run(`removeCustomSubject('ชุมนุมหุ่นยนต์'); removeCustomSubject('คณิตศาสตร์')`);
  assert.deepEqual([...run('state.settings.subjects')], ['ติวสอบเข้า']);
  assert.ok(run(`allSubjects().some(s => s.name === 'คณิตศาสตร์')`));
});

check('ข้อมูลเพี้ยนจากเครื่องอื่น/รุ่นเก่า ไม่ทำให้พัง', () => {
  run(`state.settings.subjects = 'ไม่ใช่อาร์เรย์'`);
  assert.deepEqual([...run('customSubjects()')], []);
  run(`state.settings.subjects = [' ชุมนุม ', 42, null, '', 'คณิตศาสตร์']`);
  assert.deepEqual([...run('customSubjects()')], ['ชุมนุม', 'คณิตศาสตร์']);
  assert.equal(run(`allSubjects().filter(s => s.name === 'คณิตศาสตร์').length`), 1);
  run('state = {}');
  assert.deepEqual([...run('customSubjects()')], []);
});

console.log(`\nวิชาที่เพิ่มเอง: ${n}/${n} · ${path.relative(process.cwd(), dir) || '.'}`);
