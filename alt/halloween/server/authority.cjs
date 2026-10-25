/* Runs only on the trusted service. Browser state, clocks and reward lists are never input. */
'use strict';
const Pact=require('../study-pact.js');
function create({Core,Death,Season,config,randomSeed}) {
 const allowed=new Set(['study-enroll','study-pulse','study-finish','study-claim','brain-start','brain-move','claim-welcome','training-start','training-move','enter-hub','enter-room','enter-biome','story-seen','house','quest','buy','craft','seed-quest','plant','water','harvest','sell-crop','equip-weapon','start-boss','battle-move','claim-final-theme-set','buy-biome-potion','drink-biome-potion','totem','visitor','death-quest-enroll','death-quest-claim','start-game','game-move','repair','focus-pulse','focus-finish']);
 const keys=['type','room','biome','house','choice','quest','branch','item','stockEpoch','recipe','quantity','expectedGrown','expectedInventory','weapon','boss','session','move','index','game','taskId','active','pact'];
 const copy=x=>JSON.parse(JSON.stringify(x));
 function clean(input){
  if(!input||typeof input!=='object'||!allowed.has(input.type))throw Error('ไม่รองรับคำสั่งนี้ในกิจกรรมจริง');
  const a={};for(const key of keys){const v=input[key];if(v!==undefined){if(!['string','number','boolean'].includes(typeof v)||typeof v==='string'&&v.length>180||typeof v==='number'&&!Number.isSafeInteger(v))throw Error('รูปแบบคำสั่งไม่ถูกต้อง');a[key]=v;}}
  return a;
 }
 function publicDocument(document){const d=copy(document);delete d.event.rng;delete d.event._lastActionAt;d.receipts={};return d;}
 function initial(uid,at){const d=Core.initial(config,uid,at,randomSeed());d.event.authoritative=true;return d;}
 function apply(document,input,{uid,at,tx,studyTask}){
  const action=clean(input);
  if(document.owner!==uid||document.season!==Season.id)throw Error('เซฟไม่ตรงกับบัญชีนี้');
  if(Season.state(at)!=='active')throw Error(Season.state(at)==='upcoming'?'กิจกรรมเปิดวันที่ 28 ตุลาคม':'กิจกรรมจบแล้ว รางวัลที่ได้รับยังอยู่ในบัญชี');
  const d=copy(document),e=d.event;e.timeOffset=0;delete e.previewBiome;
  // Unpredictable entropy is supplied by the server for every transaction.
  e.rng=randomSeed();
  if(['house','game-move','brain-move','battle-move','training-move'].includes(action.type)&&at<(e._lastActionAt||0)+120)throw Error('รอสักครู่ก่อนทำรายการถัดไป');
  let result;
  if(action.type==='study-enroll'){
   if(!Pact.eligible(studyTask)||studyTask.id!==action.taskId)throw Error('ยังไม่พบงานนี้ในบัญชี บันทึกงานขึ้นบัญชีก่อนแล้วลองอีกครั้ง');
   const q=Pact.enroll(e,studyTask,uid,at,tx);result={at,type:action.type,rewards:[],studyPact:copy(q)};
  }else if(action.type==='study-pulse'||action.type==='study-finish'){
   const q=e.studyPacts?.active;if(!Pact.valid(q,uid,at)||q.claimed||q.id!==action.pact)throw Error('ไม่พบพันธสัญญางานจริงที่กำลังทำ');
   if(action.type==='study-finish')Pact.finish(q,at);
   else if(!action.active||!Object.values(e.focusProofs||{}).some(p=>p.session&&at-p.lastAt<=16000))Pact.pulse(q,action.session,action.active===true,at);
   result={at,type:action.type,rewards:[],studyPact:copy(q)};
  }else if(action.type==='focus-pulse'||action.type==='focus-finish'){
   const q=Object.values(e.deathQuests||{}).find(q=>q.taskId===action.taskId&&q.owner===uid);
   if(!q||at-q.issuedAt>Core.DAY||e.taskClaims['death:'+q.taskId])throw Error('ไม่พบเควสที่กำลังทำ');
   e.focusProofs||={};const p=e.focusProofs[q.taskId]||{activeMs:0,lastAt:0,session:null,doneAt:null};
   if(action.type==='focus-finish'){
    if(p.activeMs<q.minutes*60000)throw Error('เวลาโฟกัสที่เซิร์ฟเวอร์ยืนยันยังไม่ครบ');
    p.doneAt=at;p.lastAt=0;p.session=null;
   }else{
    if(typeof action.session!=='string'||action.session.length<16)throw Error('รอบโฟกัสไม่ถูกต้อง');
    if(action.active===true&&!(e.studyPacts?.active?.proof?.session&&at-e.studyPacts.active.proof.lastAt<=16000)){
     const elapsed=at-p.lastAt;
     if(p.session===action.session&&elapsed>0&&elapsed<=16000)p.activeMs=Math.min(q.minutes*60000,p.activeMs+elapsed);
     // A second tab cannot steal an active lease or count the same seconds again.
     if(!p.session||p.session===action.session||elapsed>16000){p.session=action.session;p.lastAt=at;}
    }else if(p.session===action.session){p.lastAt=0;p.session=null;}
   }
   e.focusProofs[q.taskId]=p;result={at,type:action.type,rewards:[],minutes:Math.floor(p.activeMs/60000)};
  }else{
   const context={now:at,tx,studentOwner:uid};
   if(action.type==='death-quest-claim'){
    const q=Object.values(e.deathQuests||{}).find(q=>q.id===action.quest),p=q&&e.focusProofs?.[q.taskId];
    if(!q||!p?.doneAt||p.activeMs<q.minutes*60000)throw Error('ทำเควสและโฟกัสให้ครบก่อนรับ Candy');
    const task=Death.task(q);task.done=true;task.doneAt=new Date(p.doneAt).toISOString();
    context.studentOS={tasks:[task],sessions:[{taskId:q.taskId,start:new Date(q.issuedAt).toISOString(),end:new Date(p.doneAt).toISOString(),min:q.minutes}]};
    context.studentFocus={[q.taskId]:{nonce:q.nonce,owner:uid,activeMs:p.activeMs,updatedAt:p.doneAt}};
   }
   result=Core.dispatch(d,config,action,context);
   if(result.deathQuest){result.deathQuest.authoritative=true;e.deathQuests[result.deathQuest.day].authoritative=true;}
  }
  e._lastActionAt=at;d.revision=document.revision+1;d.updatedAt=at;
  return {document:d,result};
 }
 return Object.freeze({clean,publicDocument,initial,apply});
}
module.exports={create};
