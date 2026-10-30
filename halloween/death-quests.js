/* Local preview quest contract. This module has no network, account writes or DOM dependency. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HalloweenDeathQuests=factory();})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const REQUEST_KEY='studentos.alt.halloween.taskRequests.v1',FOCUS_KEY='studentos.alt.halloween.questFocus.v1',OWNER_KEY='studentos.alt.owner',MINUTES=20,SEASON='halloween-2026';
  const RESET_KEY='studentos.alt.halloween.previewReset.v1';
  const day=at=>new Date(at+7*3600000).toISOString().slice(0,10);
  const get=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key)||'null')||fallback;}catch{return fallback;}};
  const owner=storage=>{try{return storage.getItem(OWNER_KEY)||'';}catch{return '';}};
  function create(at,nonce,uid){return {id:'death-'+day(at),day:day(at),taskId:'hw-death-'+day(at)+'-'+nonce,nonce,issuedAt:at,minutes:MINUTES,owner:uid||'',season:SEASON};}
  function valid(q){return !!q&&q.season===SEASON&&q.minutes===MINUTES&&typeof q.owner==='string'&&typeof q.nonce==='string'&&q.nonce.length>=4&&Number.isSafeInteger(q.issuedAt)&&q.issuedAt>0&&q.issuedAt<8640000000000000-7*3600000&&q.id==='death-'+day(q.issuedAt)&&q.day===day(q.issuedAt)&&q.taskId==='hw-death-'+q.day+'-'+q.nonce;}
  function task(q){if(!valid(q))throw Error('เควสไม่ถูกต้อง');return {id:q.taskId,subject:'เควสมรณะ',detail:'เควสมรณะ · ลงมืออ่านหรือทำงานที่เลือก 20 นาที',type:'homework',teacher:'',scorePct:null,estMin:MINUTES,due:null,done:false,progress:0,createdAt:new Date(q.issuedAt).toISOString(),halloweenDeathQuest:{...q,localOnly:true}};}
  const isLocal=t=>!!t&&!!t.halloweenDeathQuest?.localOnly&&valid(t.halloweenDeathQuest)&&t.id===t.halloweenDeathQuest.taskId;
  function split(tasks=[],sessions=[]){tasks=Array.isArray(tasks)?tasks:[];sessions=Array.isArray(sessions)?sessions:[];const localTasks=tasks.filter(t=>t?.halloweenDeathQuest?.localOnly===true),ids=new Set(localTasks.map(t=>t.id));return {tasks:tasks.filter(t=>!ids.has(t.id)),sessions:sessions.filter(s=>!ids.has(s.taskId)),localTasks,localSessions:sessions.filter(s=>ids.has(s.taskId)),ids};}
  function publish(storage,q,restore=false){if(!valid(q))throw Error('ไม่พบเควสที่จะส่ง');const queue=get(storage,REQUEST_KEY,[]).filter(x=>valid(x)&&x.taskId!==q.taskId&&x.owner===q.owner).slice(-2);queue.push({...q,restore:!!restore});storage.setItem(REQUEST_KEY,JSON.stringify(queue));}
  function receive(state,requests,uid,at){
    const remaining=[],added=[];if(!state||!Array.isArray(state.tasks))return {added,remaining:requests};
    for(const q of requests){if(!valid(q)||q.owner!==uid||q.issuedAt>at||at-q.issuedAt>2*86400000)continue;const found=state.tasks.find(t=>t.id===q.taskId);
      if(found){if(isLocal(found)&&found.halloweenDeathQuest.nonce===q.nonce&&q.restore&&found.deleted){found.deleted=false;delete found.deletedAt;added.push(found.id);}continue;}
      state.tasks.push(task(q));added.push(q.taskId);
    }
    return {added,remaining};
  }
  function resetLocal(state,signal,uid){
    if(!state||!Array.isArray(state.tasks)||!signal||signal.owner!==uid||!Number.isSafeInteger(signal.at))return false;
    const ids=new Set(state.tasks.filter(t=>t?.halloweenDeathQuest?.localOnly===true&&t.halloweenDeathQuest.issuedAt<=signal.at).map(t=>t.id));if(!ids.size)return false;
    state.tasks=state.tasks.filter(t=>!ids.has(t.id));state.sessions=(state.sessions||[]).filter(s=>!ids.has(s.taskId));if(ids.has(state.running?.taskId))state.running=null;return true;
  }
  // Merge non-overlapping, short monotonic samples. A hidden tab, paused timer or clock jump earns no time.
  function credit(previous,q,{wall,monoDelta,wallDelta,eligible}){
    const p=previous&&previous.nonce===q.nonce?{...previous}:{nonce:q.nonce,activeMs:0,lastCoveredAt:q.issuedAt,updatedAt:q.issuedAt,owner:q.owner};
    if(!valid(q)||!eligible||!Number.isFinite(monoDelta)||monoDelta<0||monoDelta>6500||!Number.isFinite(wallDelta)||Math.abs(wallDelta-monoDelta)>1500||wall<p.updatedAt||wall<q.issuedAt)return p;
    const from=Math.max(q.issuedAt,p.lastCoveredAt,wall-monoDelta),delta=Math.max(0,wall-from);
    p.activeMs=Math.min(wall-q.issuedAt,p.activeMs+delta);p.lastCoveredAt=wall;p.updatedAt=wall;return p;
  }
  function status(q,state,proof,uid,at){
    const invalid={exists:false,minutes:0,ready:false,reason:'รับเควสก่อน แล้วเปิด StudentOS เพื่อให้เควสปรากฏในรายการงาน'};
    if(!valid(q)||q.owner!==uid)return {...invalid,reason:'เควสนี้ผูกกับผู้ใช้เดิมบนเครื่อง'};
    const t=(Array.isArray(state?.tasks)?state.tasks:[]).find(t=>t.id===q.taskId),meta=t?.halloweenDeathQuest;
    if(!t||t.deleted)return invalid;
    if(!isLocal(t)||meta.nonce!==q.nonce||meta.issuedAt!==q.issuedAt||meta.owner!==q.owner||Date.parse(t.createdAt)!==q.issuedAt)return {...invalid,reason:'ข้อมูลเควสไม่ตรงกับตอนรับ'};
    const p=proof&&proof.nonce===q.nonce&&proof.owner===uid&&Number.isFinite(proof.activeMs)&&proof.activeMs>=0&&proof.activeMs<=at-q.issuedAt&&proof.updatedAt<=at?proof:null;
    const active=p?.activeMs||0,doneAt=Date.parse(t.doneAt),needed=q.minutes*60000;
    const intervals=[];for(const s of Array.isArray(state.sessions)?state.sessions:[]){const a=Date.parse(s.start),b=Date.parse(s.end);if(s.taskId===q.taskId&&Number.isFinite(a)&&Number.isFinite(b)&&a>=q.issuedAt&&b>a&&b<=at&&b-a<=4*3600000&&Number.isFinite(s.min)&&s.min>=1)intervals.push([a,Math.min(b,a+s.min*60000)]);}
    intervals.sort((a,b)=>a[0]-b[0]);let recorded=0,end=q.issuedAt;for(const [a,b]of intervals){recorded+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
    const minutes=Math.floor(Math.min(active,at-q.issuedAt)/60000),ready=active>=needed&&recorded>=needed&&t.done===true&&Number.isFinite(doneAt)&&doneAt>=q.issuedAt+needed&&doneAt>=p.updatedAt&&doneAt<=at;
    return {exists:true,minutes:Math.min(q.minutes,minutes),ready,reason:ready?'ครบเงื่อนไขแล้ว กลับไปรับ Candy ห้องลองได้':minutes<q.minutes?'เปิดหน้าจอโฟกัสของงานเควสนี้ให้ครบ 20 นาที แล้วกดทำเสร็จ':'ครบเวลาแล้ว กดทำเสร็จใน StudentOS ก่อนกลับมารับ'};
  }
  return {REQUEST_KEY,FOCUS_KEY,RESET_KEY,OWNER_KEY,MINUTES,day,get,owner,create,valid,task,isLocal,split,publish,receive,resetLocal,credit,status};
});
