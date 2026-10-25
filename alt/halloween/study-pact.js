/* Real-work contracts. No task titles leave the main app; preview evidence stays local. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else{root.HalloweenStudyPact=factory();try{const mode=new URLSearchParams(location.search).get('halloweenStudyPreview');if(mode!==null)sessionStorage.setItem('studentos.alt.halloween.studyPreviewMode',mode==='1'?'1':'0');root.HalloweenStudyPreview=sessionStorage.getItem('studentos.alt.halloween.studyPreviewMode')==='1';}catch{root.HalloweenStudyPreview=false;}}})(globalThis,()=>{
 'use strict';const DAY=86400000,KEY='studentos.alt.halloween.studyPreview.v1',minutes=[5,8,10],npcs=['tang','jack','dech','win'];
 const stories={
  tang:[['แผนที่ใต้หมอก','Tang คลี่แผนที่เปียกบนโต๊ะ เส้นทางที่เคยขาดปรากฏขึ้นอีกเส้น หลังเจ้าลงมือกับงานของตัวเอง'],['ระฆังที่ไร้ลม','เสียงระฆังดังครั้งเดียวจากเรือว่างเปล่า Tang ยิ้ม “บางครั้งการเริ่มก็ก้องไปไกลกว่าที่คิด”'],['บันทึกกัปตัน','เขาฝากหน้าบันทึกไว้ให้ “พักได้ แต่อย่าลืมว่ากำลังเดินทางไปไหน”'],['ท่าเรือก่อนรุ่งสาง','หมอกเปิดให้เห็นฝั่งอีกด้าน Tang ยกหมวกให้เจ้า เส้นทางวันนี้เป็นของเจ้าแล้ว']],
  jack:[['เมล็ดใต้ฟักทอง','Jack พบเมล็ดสีเงินในฟักทองที่เงียบที่สุด เขาแบ่งให้เจ้าเก็บไว้ในบันทึก'],['รั้วไม้หัวเราะ','รั้วไม้ส่งเสียงเอี๊ยดเหมือนหัวเราะ Jack วางฟักทองเล็กไว้ข้างงานที่เจ้าลงมือทำ'],['แสงในโรงนา','ตะเกียงในโรงนาติดทีละดวง “ไม่ต้องทำทุกอย่างรวดเดียวหรอก” Jack กระซิบ'],['ฟักทองลูกสุดท้าย','Jack ไม่กินฟักทองลูกสุดท้าย เขาแกะเป็นโคมให้เส้นทางกลับของเจ้า']],
  dech:[['จดหมายไร้นาม','Dech เลื่อนจดหมายครั่งแดงมาให้ “เจ้ารักษาคำพูด ข้าจึงรักษาสัญญา”'],['นาฬิกาไม่เดิน','นาฬิกาในปราสาทหยุดเดิน แต่หน้ากระดาษของเจ้าคืบหน้าไปแล้ว Dech ยกแก้วอย่างพอใจ'],['หมึกใต้แสงจันทร์','ปลายปากกาของ Dech จุ่มหมึกสีเข้ม เขาเขียนชื่อเจ้าลงในรายชื่อแขกที่ไว้ใจ'],['หน้าต่างก่อนรุ่งอรุณ','ม่านกำมะหยี่แง้มออก “กลับไปพักเถอะ งานที่ทำวันนี้จะยังอยู่เมื่อเจ้ากลับมา”']],
  win:[['เสียงใต้ศิลา','Win วางนิ้วบนศิลา เสียงกระซิบสงบลงเมื่อเจ้ารักษาสัญญาที่ให้ตัวเอง'],['ดอกไม้ไร้เงา','ดอกไม้สีซีดบานระหว่างหลุมศพ Win เก็บภาพมันไว้ในสมุดให้เจ้า'],['ทางเดินเงียบ','เขาพาเจ้าเดินผ่านทางที่เคยหลง “ค่อย ๆ ไปทีละช่วง ก็ยังเป็นการไปข้างหน้า”'],['ผู้เฝ้าคืนสุดท้าย','วิญญาณยกมือให้เจ้าจากอีกฝั่ง Win พยักหน้า คืนนี้เจ้ากลับบ้านได้อย่างสบายใจ']]
 };
 const day=at=>new Date(at+7*3600000).toISOString().slice(0,10),copy=x=>JSON.parse(JSON.stringify(x));
 function eligible(t){return !!t&&typeof t.id==='string'&&t.id.length>0&&t.id.length<=180&&!t.done&&!t.deleted&&!t.draft&&!t.sample&&!t.demo&&!t.halloweenDeathQuest&&!['event','activity','reminder','exam'].includes(t.type);}
 function state(event){return event.studyPacts||=( {days:{},album:[],active:null} );}
 function valid(q,owner,at){return !!q&&q.owner===owner&&typeof q.id==='string'&&typeof q.taskId==='string'&&minutes[q.index]===q.minutes&&npcs.includes(q.npc)&&Number.isSafeInteger(q.issuedAt)&&q.issuedAt<=at&&at-q.issuedAt<DAY&&q.day===day(q.issuedAt);}
 function enroll(event,task,owner,at,tx){if(!eligible(task))throw Error('เลือกงานจริงที่ยังทำไม่เสร็จใน StudentOS ก่อน');const s=state(event),old=s.active;
  if(valid(old,owner,at)&&!old.claimed){if(old.taskId!==task.id){old.taskId=task.id;old.proof={activeMs:0,lastAt:0,session:null};}return old;}
  const key=day(at),index=s.days[key]||0;if(index>=3)throw Error('ครบสามพันธสัญญาของวันนี้แล้ว พรุ่งนี้มีเรื่องเล่าต่อ');let hash=0;for(const c of owner+key)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  const q={id:'study-'+tx,owner,taskId:task.id,issuedAt:at,day:key,index,minutes:minutes[index],npc:npcs[(hash+index)%4],proof:{activeMs:0,lastAt:0,session:null},claimed:false};s.days[key]=index+1;s.active=q;return q;
 }
 function pulse(q,session,active,at){if(typeof session!=='string'||session.length<16)throw Error('รอบโฟกัสไม่ถูกต้อง');const p=q.proof,elapsed=at-p.lastAt;if(p.doneAt)return p;
  if(active){if(p.session===session&&elapsed>0&&elapsed<=16000)p.activeMs=Math.min(q.minutes*60000,p.activeMs+elapsed);if(!p.session||p.session===session||elapsed>16000){p.session=session;p.lastAt=at;}}
  else if(p.session===session){p.lastAt=0;p.session=null;}return p;
 }
 function finish(q,at){if(q.proof.activeMs<q.minutes*60000||at-q.issuedAt<q.minutes*60000)throw Error('เวลาโฟกัสที่ยืนยันยังไม่ครบ');q.proof.doneAt=at;q.proof.session=null;q.proof.lastAt=0;return q;}
 function ready(q,owner,at){return valid(q,owner,at)&&!q.claimed&&q.proof?.activeMs>=q.minutes*60000&&q.proof.activeMs<=at-q.issuedAt&&Number.isSafeInteger(q.proof.doneAt)&&q.proof.doneAt>=q.issuedAt+q.minutes*60000&&q.proof.doneAt<=at;}
 function chapter(event,q,at){const s=state(event),index=stories[q.npc].findIndex((_,i)=>!s.album.some(x=>x.id===q.npc+':'+i));if(index<0)return null;const item={id:q.npc+':'+index,npc:q.npc,index,at};s.album.push(item);return item;}
 function read(storage,owner){try{const saved=JSON.parse(storage.getItem(KEY)||'null');return saved?.owner===owner?saved:{owner,event:{}};}catch{return {owner,event:{}};}}
 function write(storage,value){storage.setItem(KEY,JSON.stringify(value));}
 return Object.freeze({DAY,KEY,minutes,npcs,stories,day,copy,eligible,state,valid,enroll,pulse,finish,ready,chapter,read,write});
});
