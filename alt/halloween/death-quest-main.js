/* Applies explicit quest requests through the running StudentOS state; never overwrites it from another tab. */
(()=>{
  'use strict';const Q=window.HalloweenDeathQuests;if(!Q)return;let busy=false,lastWall=Date.now(),lastMono=performance.now(),lastEligibleTask=null;
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
    const min=Math.min(20,Math.floor(all[q.taskId].activeMs/60000));bar.innerHTML='<b>เควสมรณะ · แสงโฟกัส '+min+'/20 นาที</b><progress value="'+all[q.taskId].activeMs+'" max="1200000"></progress><small>นับเมื่อหน้านี้เปิดอยู่และจับเวลางานเควสนี้ พักหรือออกจากหน้านี้จะหยุดนับ</small>';
  }
  if(typeof go==='function'){const original=go;window.go=function(...args){const result=original.apply(this,args);flush();renderQuestCard();return result;};}
  if(typeof renderTasks==='function'){const original=renderTasks;window.renderTasks=function(...args){const result=original.apply(this,args);renderQuestCard();return result;};}
  if(typeof startFocus==='function'){const original=startFocus;window.startFocus=function(...args){const result=original.apply(this,args);sample();return result;};}
  if(typeof stopWork==='function'){const original=stopWork;window.stopWork=function(...args){sample();const result=original.apply(this,args);lastEligibleTask=null;return result;};}
  if(typeof closeFocus==='function'){const original=closeFocus;window.closeFocus=function(...args){sample();const result=original.apply(this,args);lastEligibleTask=null;return result;};}
  window.addEventListener('storage',e=>{if(e.key===Q.RESET_KEY)applyReset();if(e.key===Q.REQUEST_KEY)flush();});document.addEventListener('visibilitychange',()=>{sample();if(!document.hidden){applyReset();flush();}});
  document.addEventListener('DOMContentLoaded',()=>{applyReset();flush();});setInterval(sample,5000);applyReset();flush();
  const taskList=document.getElementById('taskList');if(taskList)new MutationObserver(renderQuestCard).observe(taskList,{childList:true});
  renderQuestCard();
})();
