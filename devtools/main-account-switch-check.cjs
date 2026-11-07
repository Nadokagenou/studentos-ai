// แยกข้อมูลรายบัญชี · ชุดเคสของ alt/devtools/account-switch-check.cjs รันกับ app.js ของราก — 7 พ.ย. 69
// รัน: node devtools/main-account-switch-check.cjs
//
// ทำไมมีไฟล์นี้: `account-switch-check.cjs app.js` ตก 2/40 มาตลอด ทั้งสองข้อทดสอบฟีเจอร์ที่มีแค่ใน alt
//   • "คลังงาน: ใช้แบบไม่ล็อกอินแล้วล็อกอิน = ย้ายเจ้าของรูป…" → ต้องมี vaultAdoptGuest (คลังรูปของ alt)
//   • "ออกแล้วล็อกอินกลับ → พอร์ตของบัญชีกลับมา"           → ต้องมี state.portfolio (พอร์ตผลงานของ alt)
// แอปหลักไม่มีทั้งสองฟีเจอร์ (ค้นใน app.js ของรากไม่เจอสักจุด) จึงเป็นปัญหาของชุดเทสต์ ไม่ใช่บั๊กของแอปหลัก
// ไฟล์นี้ไม่แก้ชุดเคสของ alt: รันตัวจริง แล้วเปลี่ยน FAIL → SKIP เฉพาะข้อที่ฟีเจอร์ไม่มีอยู่ใน app.js จริง
// วันไหนรากเพิ่มฟีเจอร์นั้น ข้อนั้นกลับมานับ PASS/FAIL เองทันที · ข้ออื่นตก = ไฟล์นี้ตก
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const altOnly = [
  {match: /^คลังงาน: ใช้แบบไม่ล็อกอินแล้วล็อกอิน/, has: /\bvaultAdoptGuest\b/, why: 'แอปหลักไม่มีคลังรูป (vaultAdoptGuest)'},
  {match: /พอร์ต/, has: /\bportfolio\b/, why: 'แอปหลักไม่มี state.portfolio'},
];
const run = spawnSync(process.execPath, [path.join(root, 'alt/devtools/account-switch-check.cjs'), path.join(root, 'app.js')], {encoding: 'utf8'});
if (run.error) throw run.error;
let pass = 0, fail = 0, skip = 0;
for (const line of run.stdout.split(/\r?\n/)) {
  const m = line.match(/^(PASS|FAIL)  (.*?)(?:   → .*)?$/);
  if (!m) continue;
  const rule = m[1] === 'FAIL' && altOnly.find(r => r.match.test(m[2]) && !r.has.test(app));
  if (rule) { skip++; console.log(`SKIP  ${m[2]}  — ${rule.why}`); continue; }
  console.log(line);
  m[1] === 'PASS' ? pass++ : fail++;
}
if (!pass && !fail) { process.stderr.write(run.stdout + run.stderr); throw Error('ไม่พบผลจากชุดเคสของ alt — รูปแบบผลลัพธ์เปลี่ยน?'); }
console.log(`\n${pass}/${pass + fail} ผ่าน · ข้าม ${skip} (ฟีเจอร์ของ alt) · app.js`);
process.exit(fail ? 1 : 0);
