// สลับบัญชีบนเครื่องเดียวกันต้องไม่คัดลอกงานของบัญชีเก่าเข้าบัญชีใหม่
// รัน: node alt/devtools/account-switch-check.cjs
//
// ข้อมูลจริง (16 ต.ค. 69 · อ่านอย่างเดียว): บัญชี cba92754 มีงาน 195 ใบ ซึ่ง 194 ใบมี id ตรงกับงานของ
// บัญชี d824e935 (Classroom 73 ใบตรงกับทะเบียนของ d824e935 ทุกใบ) · อีกสองบัญชีมี id ตรงกัน 10 ใบ
// id งานสุ่มตอนสร้าง — ตรงกันข้ามบัญชี = ถูกคัดลอก · ต้นเหตุ: logout() ไม่ล้างงานในเครื่อง แล้ว
// syncFromCloud() ของบัญชีใหม่รวมงานในเครื่องทุกใบเข้าไปแล้วส่งขึ้น cloud ของบัญชีใหม่
//
// ดึงฟังก์ชันจริงออกจาก alt/app.js มารันใน vm — ไม่ได้เขียนสำเนาขึ้นใหม่
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8');
const grab = name => {
  const i = src.search(new RegExp(`\\n(async )?function ${name}\\(`));
  return i < 0 ? null : src.slice(i + 1, src.indexOf('\n}', i + 1) + 2);
};
const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

const names = ['localOwner', 'setLocalOwner', 'adoptAccountIfNeeded', 'cloudWritableFor'];
const parts = names.map(grab);
names.forEach((n, i) => check(`alt/app.js มี ${n}`, !!parts[i], 'ไม่เจอฟังก์ชัน'));

function sandbox(store, stateIn, ctx = { kind: 'timetable-A' }) {
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const box = {
    localStorage: ls, console: { warn() {} }, JSON, Date,
    state: stateIn, persisted: 0, ctxCleared: 0,
    persistState() { box.persisted++; store['studentos.alt.v1'] = JSON.stringify(box.state); return true; },
    ctxExport: () => ctx, ctxClear() { box.ctxCleared++; },
  };
  const c = vm.createContext(box);
  const consts = (src.match(/^const (OWNER_KEY|OTHER_ACCOUNT_BACKUP_KEY) = .*$/gm) || []).join('\n');
  vm.runInContext(`${consts}\n${parts.filter(Boolean).join('\n')}\nvar __state = () => state;`, c);
  return c;
}
const A = 'user-a', B = 'user-b';
const stateA = () => ({ tasks: [{ id: 't1', detail: 'งานของ A' }], settings: { name: 'เอ', freeHours: 3 }, sessions: [{ id: 's1' }], marks: [{ id: 'm1' }], inbox: [{ id: 'i1' }] });

if (parts.every(Boolean)) {
  // 1) เครื่องที่มีงานของ A อยู่ แล้วล็อกอิน B → ต้องเริ่มจากของเปล่า ไม่ใช่รวมงานของ A เข้าไป
  {
    const store = { 'studentos.alt.owner': A };
    const c = sandbox(store, stateA());
    const moved = c.adoptAccountIfNeeded(B);
    const s = c.__state();
    check('สลับจาก A ไป B → รายการงานในเครื่องว่าง (ไม่มีงานของ A ไปรวม)', moved === true && s.tasks.length === 0, JSON.stringify(s));
    check('สลับจาก A ไป B → ชื่อ/ตั้งค่าของ A ไม่ติดไป', s.settings.name === '', JSON.stringify(s.settings));
    check('สลับจาก A ไป B → รอบจับเวลา · หมุด · กล่องเข้าของ A ไม่ติดไป',
      !(s.sessions || []).length && !(s.marks || []).length && !(s.inbox || []).length, JSON.stringify(s));
    check('สลับจาก A ไป B → ล้างตารางเรียนของ A ออกจากเครื่อง', c.ctxCleared === 1, c.ctxCleared);
    const bk = JSON.parse(store['studentos.alt.otherAccountBackup'] || 'null');
    check('สลับจาก A ไป B → เก็บสำรองของ A ไว้ในเครื่อง (ไม่ลบทิ้ง)', bk && bk.owner === A && bk.state.tasks[0].id === 't1'
      && bk.ctx && bk.ctx.kind === 'timetable-A', JSON.stringify(bk));
    check('สลับจาก A ไป B → บันทึกลงเครื่องทันที', c.persisted >= 1, c.persisted);
    check('ก่อนซิงก์กับ cloud ของ B สำเร็จ → ห้ามส่งขึ้น cloud ของ B', c.cloudWritableFor(B) === false, 'อนุญาตให้ส่ง');
    c.setLocalOwner(B);
    check('หลังซิงก์สำเร็จ (ตั้งเจ้าของเป็น B) → ส่งขึ้น cloud ของ B ได้', c.cloudWritableFor(B) === true, 'ไม่อนุญาต');
  }
  // 2) บัญชีเดิมล็อกอินซ้ำ → ไม่แตะอะไร (รวมกับ cloud แบบเดิม)
  {
    const store = { 'studentos.alt.owner': A };
    const c = sandbox(store, stateA());
    const moved = c.adoptAccountIfNeeded(A);
    check('บัญชีเดิม → ไม่ล้างงานในเครื่อง', moved === false && c.__state().tasks.length === 1 && c.ctxCleared === 0, JSON.stringify(c.__state()));
    check('บัญชีเดิม → ส่งขึ้น cloud ได้', c.cloudWritableFor(A) === true, 'ไม่อนุญาต');
  }
  // 3) ใช้แบบไม่ล็อกอินมาก่อน (ยังไม่มีเจ้าของ) แล้วล็อกอินครั้งแรก → งานที่ทำไว้ต้องตามขึ้นบัญชีไป (พฤติกรรมเดิม)
  {
    const store = {};
    const c = sandbox(store, stateA());
    const moved = c.adoptAccountIfNeeded(B);
    check('ยังไม่มีเจ้าของ → ไม่ล้าง (งานที่ทำก่อนล็อกอินต้องไม่หาย)', moved === false && c.__state().tasks.length === 1, JSON.stringify(c.__state()));
    check('ยังไม่มีเจ้าของ → ห้ามส่งจนกว่าจะรวมกับ cloud เสร็จ', c.cloudWritableFor(B) === false, 'อนุญาตให้ส่ง');
  }
}

// 4) ตำแหน่งที่เรียกในโค้ดจริง
{
  const body = name => { const i = src.search(new RegExp(`\\n(async )?function ${name}\\(`)); return i < 0 ? '' : src.slice(i, src.indexOf('\n}', i + 1)); };
  // ตัดบรรทัดคอมเมนต์ออกก่อนค้น — คำว่า "await" ในคอมเมนต์ไม่ใช่ await จริง
  const sf = body('syncFromCloud').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const a = sf.indexOf('adoptAccountIfNeeded('), w = sf.indexOf('await ');
  check('syncFromCloud เรียก adoptAccountIfNeeded ก่อน await แรก', a > 0 && (w < 0 || a < w), `adopt@${a} await@${w}`);
  check('syncFromCloud ตั้งเจ้าของหลังรวมเสร็จ', sf.lastIndexOf('setLocalOwner(') > a, 'ไม่ตั้งเจ้าของ');
  const pc = body('pushToCloud');
  check('pushToCloud ไม่ส่งขึ้นบัญชีที่ยังไม่ได้รวมข้อมูล', pc.includes('cloudWritableFor('), 'ไม่มีด่าน');
  const ic = body('initCloud');
  check('initCloud จดเจ้าของให้เครื่องที่ล็อกอินค้างอยู่ก่อนรุ่นนี้', ic.includes('setLocalOwner('), 'ไม่จด');
}

const pass = results.filter(r => r.pass).length;
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
console.log(`\n${pass}/${results.length} ผ่าน`);
process.exit(pass === results.length ? 0 : 1);
