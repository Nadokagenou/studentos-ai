// Offline requirements: one short title, complete instructions, and all pages of one task.
const assert=require('node:assert/strict'),Scan=require('../task-scan.js');let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
check('short title stays separate from instructions',()=>{const r=Scan.fields('ใบงานเรื่องเซต','ทำข้อ 1–10 พร้อมวิธีทำ\nส่งเป็น PDF ใน Classroom','');assert.equal(r.title,'ใบงานเรื่องเซต');assert.match(r.note,/ข้อ 1–10/);assert.match(r.note,/Classroom/);});
check('legacy model output moves inline instructions into the note',()=>{const r=Scan.fields('ใบงานเรื่องเซต — ทำข้อ 1–10 พร้อมวิธีทำ','','ใบงานเรื่องเซต\nทำข้อ 1–10 พร้อมวิธีทำ\nเขียนชื่อทุกหน้า');assert.equal(r.title,'ใบงานเรื่องเซต');assert.match(r.note,/ข้อ 1–10/);assert.match(r.note,/เขียนชื่อทุกหน้า/);});
check('question ranges and submission instructions cannot fill the main title',()=>{const r=Scan.fields('ใบงานเรื่องเซต ข้อ 1–10 พร้อมแสดงวิธีทำ ส่งเป็น PDF');assert.equal(r.title,'ใบงานเรื่องเซต');assert.match(r.note,/ข้อ 1–10/);assert.match(r.note,/PDF/);});
check('a worksheet or chapter number remains part of its main heading',()=>assert.equal(Scan.fields('แบบฝึกหัดที่ 2.3 เรื่องเซต').title,'แบบฝึกหัดที่ 2.3 เรื่องเซต'));
check('a long headline is bounded while its remaining text is retained',()=>{const text='หัวข้อยาว'.repeat(20),r=Scan.fields(text,'คำสั่งครู','');assert.ok(Array.from(r.title).length<=60);assert.ok(r.note.includes(text));assert.match(r.note,/คำสั่งครู/);});
check('raw text preserves details omitted by a model summary',()=>{const r=Scan.fields('งานกลุ่ม','ทำรายงาน','งานกลุ่ม\nทำรายงาน\nแบ่งกลุ่ม 4 คน\nส่งไฟล์ PDF และวิดีโอ');assert.match(r.note,/แบ่งกลุ่ม 4 คน/);assert.match(r.note,/PDF และวิดีโอ/);});
check('duplicate full instruction blocks are not appended twice',()=>{const r=Scan.fields('หัวข้อ','ทำข้อ 1–10','หัวข้อ\nทำข้อ 1–10');assert.equal(r.note,'ทำข้อ 1–10');});
check('one batch keeps every page in selected order',()=>{let who='A';const b=Scan.batch(()=>who);b.add({id:'p1',source:'one'});b.add({id:'p2',source:'two'});const t=b.start();assert.deepEqual(t.pages.map(p=>p.source),['one','two']);assert.throws(()=>b.add({id:'p3'}),/กำลังอ่าน/);b.finish(t.id);assert.equal(b.list().length,2);});
check('photo capacity rejects an extra page without silently dropping an existing one',()=>{const b=Scan.batch(()=> 'A');for(let i=0;i<6;i++)b.add({id:String(i)});assert.throws(()=>b.add({id:'7'}),/6/);assert.equal(b.list().length,6);});
check('account changes cannot reuse a previous task batch',()=>{let who='A';const b=Scan.batch(()=>who);b.add({id:'a'});who='B';assert.throws(()=>b.start(),/บัญชี/);b.clear();b.add({id:'b'});assert.equal(b.start().owner,'B');});
check('removing and reordering pages changes only the draft',()=>{const b=Scan.batch(()=> 'A');b.add({id:'a'});b.add({id:'b'});b.move(1,-1);assert.deepEqual(b.list().map(p=>p.id),['b','a']);b.remove(1);assert.equal(b.list()[0].id,'b');});
(async()=>{
 const page='data:image/jpeg;base64,aGVsbG8=';
 let reads=0,closed=0;const results=await Scan.readPages([page,page],{decode:async()=>({close:()=>closed++}),read:async()=>({text:++reads===1?'ใบงานเรื่องเซต':'ส่ง PDF ใน Classroom',conf:90,fields:1,lowWords:[]})});
 assert.equal(reads,2);assert.equal(closed,2);assert.match(results.text,/ใบงานเรื่องเซต/);assert.match(results.text,/Classroom/);passed++;console.log('PASS every page is read and released in order');
 reads=0;await assert.rejects(Scan.readPages([page,page,page],{decode:async()=>({close(){}}),read:async()=>({text:++reads===2?'':'ข้อความจากใบแรก',conf:90})}),/รูปที่ 2/);assert.equal(reads,2);passed++;console.log('PASS an unreadable later page blocks a partial task');
 await assert.rejects(Scan.readPages(Array(7).fill(page),{read:async()=>{throw Error('must not run');}}),/1–6/);passed++;console.log('PASS oversized batches never begin OCR');
 console.log('Task scan requirements: '+passed+'/'+passed);
})().catch(e=>{console.error(e);process.exitCode=1;});
