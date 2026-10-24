/* Applies explicit quest requests through the running StudentOS state; never overwrites it from another tab. */
(()=>{
  'use strict';const Q=window.HalloweenDeathQuests;if(!Q)return;let busy=false,lastWall=Date.now(),lastMono=performance.now(),lastEligibleTask=null;
  let cloud=null,cloudBusy=false,cloudLastAt=0;const cloudSession=crypto.randomUUID();
  async function syncCloudFocus(force=false){
    if(cloudBusy||!ready()||typeof sb==='undefined'||!sb||typeof currentUser==='undefined'||!currentUser||!window.HalloweenAccount)return;
    if((Date.now()<Date.parse('2026-10-28T00:00:00+07:00')||Date.now()>=Date.parse('2026-12-01T00:00:00+07:00'))&&!state.tasks.some(t=>Q.isLocal(t)&&t.halloweenDeathQuest.authoritative))return;
    cloudBusy=true;
    try{
      if(!cloud){cloud=window.HalloweenAccount.create({client:sb});await cloud.refresh();window.HalloweenAccountState=cloud;}
      if(!cloud.ready())await cloud.refresh();
      if(force||Date.now()-cloudLastAt>25000){await cloud.refresh();cloudLastAt=Date.now();const e=cloud.read().event;for(const q of Object.values(e.deathQuests||{}))if(q.authoritative&&q.owner===currentUser.id&&!e.taskClaims['death:'+q.taskId]&&Date.now()-q.issuedAt<86400000)Q.publish(localStorage,q);flush();}
      const t=state.tasks.find(t=>Q.isLocal(t)&&t.halloweenDeathQuest.authoritative&&t.halloweenDeathQuest.owner===currentUser.id&&!t.deleted&&Date.now()-t.halloweenDeathQuest.issuedAt<86400000);if(!t)return;
      const active=!t.done&&state.running?.taskId===t.id&&!document.hidden&&!document.getElementById('focusWrap')?.hidden&&document.body.classList.contains('focus-on');
      const proof=cloud.read().event.focusProofs?.[t.id];
      if(active||proof?.session===cloudSession)await cloud.dispatch({type:'focus-pulse',taskId:t.id,session:cloudSession,active});
      if(t.done&&proof?.activeMs>=1200000&&!proof.doneAt)await cloud.dispatch({type:'focus-finish',taskId:t.id});
    }catch(error){const note=document.querySelector('.hw-death-focus small');if(note)note.textContent='ยังยืนยันออนไลน์ไม่ได้ เปิดเน็ตแล้วรอสักครู่ เวลาและรางวัลให้เซิร์ฟเวอร์ตรวจ';}
    finally{cloudBusy=false;}
  }
  function ready(){return typeof state!=='undefined'&&Array.isArray(state.tasks)&&typeof curScreen!=='undefined'&&['scr-menu','scr-home','scr-tasks','scr-ai','scr-profile','scr-scan','scr-room'].includes(curScreen);}
  function renderQuestCard(){
    const existing=document.getElementById('hwDeathTaskCard');if(!ready()||curScreen!=='scr-tasks'){existing?.remove();return;}
    const t=state.tasks.find(t=>Q.isLocal(t)&&!t.done&&!t.deleted&&t.halloweenDeathQuest.owner===Q.owner(localStorage)&&Date.now()-t.halloweenDeathQuest.issuedAt<86400000);if(!t){existing?.remove();return;}if(existing?.dataset.taskId===t.id)return;existing?.remove();
    const list=document.getElementById('taskList');if(!list)return;const card=document.createElement('aside');card.id='hwDeathTaskCard';card.className='hw-death-task';
    card.dataset.taskId=t.id;card.innerHTML='<div><b>เควสมรณะ · พันธสัญญา 20 นาที</b><small>เลือกงานที่จะลงมือ แล้วรักษาแสงโฟกัสให้ครบก่อนกลับไปรับ Candy ทดลอง</small></div><button type="button">เริ่มโฟกัสเควส</button>';card.querySelector('button').addEventListener('click',()=>startFocus(t.id));list.prepend(card);
  }
  function flush(){
    if(busy||!ready())return;const requests=Q.get(localStorage,Q.REQUEST_KEY,[]);if(!Array.isArray(requests)||!requests.length)return;busy=true;
    try{const result=Q.receive(state,requests,Q.owner(localStorage),Date.now());if(result.added.length)stateRev++;if(!persistState())return;if(result.added.length){renderAll();if(typeof showToast==='function')showToast({title:'เควสมรณะปรากฏในรายการงานแล้ว',body:'เปิดงานเควส จับเวลาโฟกัสให้ครบ 20 นาที แล้วกดทำเสร็จ'});}localStorage.setItem(Q.REQUEST_KEY,JSON.stringify(result.remaining));renderQuestCard();}catch(e){console.warn('[local quest]',e.message);}finally{busy=false;}
  }
  function applyReset(){
    if(typeof state==='undefined'||!Array.isArray(state.tasks))return;const runningId=state.running?.taskId;
    if(Q.resetLocal(state,Q.get(localStorage,Q.RESET_KEY,null),Q.owner(localStorage))){stateRev++;lastEligibleTask=null;if(runningId&&!state.running&&document.body.classList.contains('focus-on'))closeFocus(true);persistState();renderAll();}
  }
  function sample(){
    const wall=Date.now(),mono=performance.now(),monoDelta=mono-lastMono,wallDelta=wall-lastWall;lastMono=mono;lastWall=wall;if(!ready())return;
    const id=state.running?.taskId,t=state.tasks.find(t=>t.id===id);if(!Q.isLocal(t)){lastEligibleTask=null;return;}const q=t.halloweenDeathQuest;
    const all=Q.get(localStorage,Q.FOCUS_KEY,{}),eligible=!document.hidden&&!document.getElementById('focusWrap')?.hidden&&document.body.classList.contains('focus-on')&&q.owner===Q.owner(localStorage);
    all[q.taskId]=Q.credit(all[q.taskId],q,{wall,monoDelta,wallDelta,eligible:eligible&&lastEligibleTask===q.taskId});lastEligibleTask=eligible?q.taskId:null;
    try{localStorage.setItem(Q.FOCUS_KEY,JSON.stringify(all));}catch{}
    const wrap=document.getElementById('focusWrap');if(!wrap||!eligible)return;let bar=wrap.querySelector('.hw-death-focus');if(!bar){bar=document.createElement('div');bar.className='hw-death-focus';bar.setAttribute('role','status');wrap.querySelector('.fc-act')?.before(bar);}
    const verified=q.authoritative?(cloud?.ready()?cloud.read().event.focusProofs?.[q.taskId]?.activeMs||0:0):all[q.taskId].activeMs;const min=Math.min(20,Math.floor(verified/60000));bar.innerHTML='<b>เควสมรณะ · แสงโฟกัส '+min+'/20 นาที</b><progress value="'+verified+'" max="1200000"></progress><small>นับเมื่อหน้านี้เปิดอยู่และจับเวลางานเควสนี้ พักหรือออกจากหน้านี้จะหยุดนับ</small>';
  }
  if(typeof go==='function'){const original=go;window.go=function(...args){const result=original.apply(this,args);flush();renderQuestCard();return result;};}
  if(typeof renderTasks==='function'){const original=renderTasks;window.renderTasks=function(...args){const result=original.apply(this,args);renderQuestCard();return result;};}
  if(typeof startFocus==='function'){const original=startFocus;window.startFocus=function(...args){const result=original.apply(this,args);sample();syncCloudFocus(true);return result;};}
  if(typeof stopWork==='function'){const original=stopWork;window.stopWork=function(...args){sample();const result=original.apply(this,args);lastEligibleTask=null;return result;};}
  if(typeof closeFocus==='function'){const original=closeFocus;window.closeFocus=function(...args){sample();const result=original.apply(this,args);lastEligibleTask=null;return result;};}
  if(typeof finishFocus==='function'){const original=finishFocus;window.finishFocus=function(...args){const t=state.tasks.find(t=>t.id===state.running?.taskId);if(!t?.halloweenDeathQuest?.authoritative)return original.apply(this,args);const self=this;return(async()=>{await syncCloudFocus(true);const proof=cloud?.ready()&&cloud.read().event.focusProofs?.[t.id];if(!proof||proof.activeMs<1200000){showToast({title:'แสงโฟกัสยังไม่ครบ 20 นาทีที่ยืนยันออนไลน์',body:'รอให้หลอดเควสครบก่อน หากเน็ตขาดให้เชื่อมต่อแล้วทำต่อได้'});return;}const result=original.apply(self,args);await syncCloudFocus(true);return result;})();};}
  setInterval(syncCloudFocus,5000);
  window.addEventListener('storage',e=>{if(e.key===Q.RESET_KEY)applyReset();if(e.key===Q.REQUEST_KEY)flush();});document.addEventListener('visibilitychange',()=>{sample();syncCloudFocus();if(!document.hidden){applyReset();flush();}});
  document.addEventListener('DOMContentLoaded',()=>{applyReset();flush();});setInterval(sample,5000);applyReset();flush();
  const taskList=document.getElementById('taskList');if(taskList)new MutationObserver(renderQuestCard).observe(taskList,{childList:true});
  renderQuestCard();
})();
