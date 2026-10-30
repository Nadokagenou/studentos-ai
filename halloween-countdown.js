/* Main URL announcement only. Gameplay and rewards remain in the account event. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.StudentOSHalloweenCountdown=api;api.install();}})(globalThis,()=>{
 'use strict';const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function snapshot(cfg,at=Date.now()){
  const start=Date.parse(cfg?.startsAt),end=Date.parse(cfg?.endsAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!Number.isFinite(at))return null;
  const phase=cfg.enabled!==true?'disabled':at>=end?'ended':at<start?'upcoming':cfg.claimingEnabled===true?'active':'paused',target=phase==='upcoming'?start:end,seconds=['disabled','ended','paused'].includes(phase)?0:Math.max(0,Math.ceil((target-at)/1000));
  const pad=n=>String(n).padStart(2,'0'),days=Math.floor(seconds/86400),hours=Math.floor(seconds/3600)%24,minutes=Math.floor(seconds/60)%60;
  return {phase,start,end,seconds,clock:phase==='paused'?'รอประกาศ':pad(days)+' วัน '+pad(hours)+':'+pad(minutes)+':'+pad(seconds%60)};
 }
 function destination(base){const u=new URL('halloween/event/',base);u.searchParams.set('entry','main');return u.href;}
 function date(at,withTime=false){const day=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}).format(at);return day+(withTime?' · '+new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at)+' น.':'');}
 function card(cfg,at=Date.now(),base='https://nadokagenou.github.io/studentos-ai/'){
  const s=snapshot(cfg,at);if(!s||['disabled','ended'].includes(s.phase))return '';
  const active=s.phase==='active',tag=active?'a':'button',action=active?'เข้าอีเวนต์':'ดูอีเวนต์',caption=s.phase==='upcoming'?'เปิด '+date(s.start,true):s.phase==='paused'?'กำลังเตรียมเปิด':'ถึง '+date(s.end-1),label='Halloween · '+caption+' · '+action;
  return '<'+tag+' class="main-hw-card" '+(active?'href="'+esc(destination(base))+'"':'type="button" data-mhc-open')+' aria-label="'+esc(label)+'"><span class="mhc-moon" aria-hidden="true">☾</span><span class="mhc-copy"><b>Halloween</b><small>'+esc(caption)+'</small></span><span class="mhc-right"><span class="mhc-clock" data-mhc-clock aria-live="off">'+s.clock+'</span><small>'+action+' <span aria-hidden="true">→</span></small></span></'+tag+'>';
 }
 function createClock({visible,paint,now=Date.now,schedule=setTimeout,cancel=clearTimeout}){
  let timer=null;const stop=()=>{if(timer!==null)cancel(timer);timer=null;};
  function refresh(){stop();if(!visible())return;paint(now());if(visible()&&timer===null)timer=schedule(()=>{timer=null;refresh();},1000-now()%1000);}
  return Object.freeze({refresh,stop});
 }
 let instance=null;
 function install(){
  if(typeof document==='undefined'||instance)return;
  const base=new URL('.',document.currentScript.src);let config=null,phase=null,dialog=null,fetchAt=-Infinity,pending=false;
  const show=()=>card(config,Date.now(),base.href);
  function paint(at){const s=snapshot(config,at);if(!s)return;if(phase!==s.phase){phase=s.phase;if(typeof window.renderMenu==='function')window.renderMenu();paintDialog();}document.querySelectorAll('[data-mhc-clock]').forEach(e=>{if(e.textContent!==s.clock)e.textContent=s.clock;});}
  const clock=createClock({visible:()=>!document.hidden&&!!(document.querySelector('#scr-menu.on .main-hw-card')||dialog?.open),paint});
  async function load(){if(pending||Date.now()-fetchAt<60000)return;pending=true;fetchAt=Date.now();try{const r=await fetch(new URL('halloween/event/config.json',base),{cache:'no-store'});config=r.ok?await r.json():null;const s=snapshot(config);phase=s?.phase||null;if(typeof window.renderMenu==='function')window.renderMenu();paintDialog();}catch{}finally{pending=false;clock.refresh();}}
  function paintDialog(){
   if(!dialog?.open)return;const s=snapshot(config),status=dialog.querySelector('[data-mhc-status]'),join=dialog.querySelector('[data-mhc-join]');
   const upcoming=s?.phase==='upcoming',active=s?.phase==='active';status.textContent=upcoming?'ประตูเปิดใน':active?'อีเวนต์เปิดแล้ว · เหลือเวลา':s?.phase==='paused'?'กำลังเตรียมเปิดกิจกรรม':'อีเวนต์สิ้นสุดแล้ว';
   dialog.querySelector('[data-mhc-clock]').hidden=!upcoming&&!active;join.hidden=!active;if(active)join.href=destination(base.href);
  }
  function open(){
   if(dialog?.open)return;const s=snapshot(config);if(!s)return;dialog=document.createElement('dialog');dialog.className='main-hw-dialog';dialog.setAttribute('aria-labelledby','mainHwTitle');
   const root=base.href,art=new URL('halloween/event/assets/home-card-bg.webp',root).href;
   dialog.innerHTML='<button type="button" class="mhc-close" aria-label="ปิดรายละเอียดอีเวนต์">×</button><div class="mhc-scene" aria-hidden="true"><img class="mhc-scene-bg" src="'+art+'" alt=""><div class="mhc-cast">'+[0,1,2,3].map(n=>'<img src="'+new URL('halloween/event/assets/home-card-npc-'+n+'.webp',root).href+'" alt="">').join('')+'</div></div><div class="mhc-detail"><small>STUDENT OS · HALLOWEEN</small><h2 id="mainHwTitle">ประตูรัตติกาล</h2><p>สำรวจ 4 ไบโอม ทำเควส และรับรางวัลอีเวนต์</p><p class="mhc-dates">'+esc(date(s.start,true))+' – '+esc(date(s.end-1))+' 2569<br>ตามเวลาไทย · เล่นได้ถึงหมดวันที่ '+esc(date(s.end-1))+'</p><div class="mhc-status" data-mhc-status></div><div class="mhc-bigclock" data-mhc-clock role="timer" aria-live="off">'+s.clock+'</div><a class="mhc-join" data-mhc-join hidden>เข้าอีเวนต์ →</a></div>';
   const current=dialog;dialog.addEventListener('close',()=>{current.remove();if(dialog===current)dialog=null;document.querySelector('[data-mhc-open]')?.focus({preventScroll:true});clock.refresh();},{once:true});dialog.querySelector('.mhc-close').addEventListener('click',()=>dialog.close());(document.querySelector('.phone')||document.body).append(dialog);dialog.showModal();paintDialog();refresh();
  }
  function refresh(){clock.refresh();if(!document.hidden)load();}
  document.addEventListener('click',e=>{if(e.target.closest('[data-mhc-open]')){e.preventDefault();open();}});
  document.addEventListener('visibilitychange',refresh);window.addEventListener('pageshow',refresh);
  function ready(){const go=window.go;if(typeof go==='function')window.go=function(...args){const result=go.apply(this,args);refresh();return result;};refresh();}
  instance={html:show,refresh};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
 }
 return Object.freeze({snapshot,card,destination,createClock,install,html:()=>instance?.html()||'',refresh:()=>instance?.refresh()});
});
