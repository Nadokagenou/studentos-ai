// Run the existing synchronization scenarios against the main entry's actual code.
// 7 พ.ย. 69: ชุดเคสมาจาก alt/devtools/syncbench.cjs ซึ่งโตตามฟีเจอร์ของ alt
// เคส (s)(t) ทดสอบ state.portfolio (พอร์ตผลงาน) ที่แอปหลักยังไม่มี — เดิมพังกลางทางเป็น HARNESS ERROR
// ตอนนี้ข้ามเฉพาะเคสที่ฟีเจอร์ไม่มีอยู่จริงใน app.js ของราก และพิมพ์ SKIP ให้เห็น
// ถ้าวันหนึ่งรากมี portfolio แล้ว เคสจะกลับมารันเองโดยอัตโนมัติ
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../alt/devtools');
let source=fs.readFileSync(path.join(dir,'syncbench.cjs'),'utf8').replace(/\r\n/g,'\n');
const before="path.join(repo, 'alt/app.js')",after="path.join(repo, 'app.js')";
if(!source.includes(before))throw Error('Synchronization harness source selector changed');
source=source.replace(before,after);
const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const skipped=[];
if(!/\bportfolio\b/.test(app)){
  const s=source.indexOf('\n  // (s) '),u=source.indexOf('\n  // (u) ');
  if(s<0||u<s)throw Error('Synchronization harness scenario markers (s)/(u) changed');
  // เคส (u) ใช้ตัวช่วย pi/pids ที่ประกาศใน (s) — คงตัวช่วยไว้ ตัดแค่ตัวเคส
  const helpers="\n  const pi = (id, title) => ({ id, cat: 'project', title, date: '', role: '', desc: '', at: 1 });\n  const pids = arr => (arr || []).map(x => x.id).sort().join(',');";
  source=source.slice(0,s)+helpers+source.slice(u);
  // ข้อตรวจใน (u) ที่ชื่อมีคำว่า "พอร์ต" = ตรวจฟีเจอร์ที่รากไม่มี → SKIP · ข้อตรวจอื่นใน (u) (งาน · หมุด · รอบจับเวลา · ตั้งค่า) ยังรันจริง
  const mark="${ok ? 'PASS' : 'FAIL'}";
  if(!source.includes(mark))throw Error('Synchronization harness check() format changed');
  source=source.replace(mark,"${/พอร์ต/.test(name) ? 'SKIP' : ok ? 'PASS' : 'FAIL'}");
  skipped.push('s: พอร์ตผลงานรวมข้ามเครื่อง (ทั้งเคส)','t: แอปรุ่นเก่าไม่ทำให้พอร์ตหาย (ทั้งเคส)');
}
for(const n of skipped)console.log(`SKIP  ${n}  — แอปหลักยังไม่มี state.portfolio (ฟีเจอร์ของ alt)`);
new Function('require','__dirname','process',source)(require,dir,process);
