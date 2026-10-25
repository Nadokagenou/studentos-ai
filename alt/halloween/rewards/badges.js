/* Permanent badge display. Server receipts are read, never granted here. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./catalog.js'));else{root.HalloweenBadges=factory(root.StudentOSHalloweenRewards);root.HalloweenBadges.install();}})(globalThis,C=>{
 'use strict';
 const ids=['midnight-conqueror','crown-of-midnight'];
 const condition=id=>id==='midnight-conqueror'?'พิชิตราชันเที่ยงคืน · รับพร้อมธีม Halloween และ Moon & Candle':'ซื้อของครบตามรายการร้านอีเวนต์';
 function entries({owner,document,preview=false}={}){
  return ids.map(id=>{const item=C.find(id),receipt=owner&&document?.owner===owner?document.rewards?.[id]:null;
   return {...item,condition:condition(id),owned:!!(!preview&&receipt?.id===id&&receipt.permanent===true&&typeof receipt.receipt==='string'&&receipt.receipt.length)};});
 }
 function createReader({owner,create,onChange=()=>{},clock=Date.now}){
  let uid=null,account=null,document=null,status='login',pending=null,generation=0,lastRead=0;
  function identity(){const next=owner()||null;if(next===uid)return;generation++;const old=account;uid=next;account=null;document=null;pending=null;lastRead=0;status=uid?'idle':'login';old?.dispose();}
  function view(){identity();return {status,entries:entries({owner:uid,document})};}
  function refresh(force=false){
   identity();if(!uid)return Promise.resolve(view());if(pending)return pending;if(!force&&status==='ready'&&clock()-lastRead<30000)return Promise.resolve(view());
   const epoch=generation,requestedOwner=uid;status='loading';onChange();
   pending=Promise.resolve().then(async()=>{
    if(epoch!==generation||requestedOwner!==owner())return view();
    try{if(!account)account=create(value=>{if(epoch!==generation||value!==null)return;document=null;status='idle';onChange();});const current=account;await current.refresh();
     if(epoch!==generation||requestedOwner!==owner())return view();const result=current.read();if(result.owner!==requestedOwner)throw Error('Account changed');document=result;lastRead=clock();status='ready';
    }catch{if(epoch===generation){document=null;status='error';}}
    finally{if(epoch===generation){pending=null;onChange();}}
    return view();
   });return pending;
  }
  return Object.freeze({view,refresh});
 }
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function install(){
  if(typeof document==='undefined'||!C||typeof renderBadges!=='function')return;
  const base=new URL('.',document.currentScript.src),asset=item=>new URL('assets/'+item.id+'.svg',base).href,preview=window.__HW_SHOWROOM__===true;
  const reader=preview?null:createReader({owner:()=>typeof currentUser==='undefined'?null:currentUser?.id,create:onChange=>{if(typeof sb==='undefined'||!sb||!window.HalloweenAccount)throw Error('Account unavailable');return window.HalloweenAccount.create({client:sb,onChange});},onChange:paint});
  function info(id){
   const row=(preview?entries({preview:true}):reader.view().entries).find(x=>x.id===id);if(!row)return;
   document.querySelector('.hw-badge-detail')?.remove();const dialog=document.createElement('dialog');dialog.className='hw-badge-detail';dialog.setAttribute('aria-labelledby','hwBadgeDetailTitle');
   dialog.innerHTML='<button type="button" class="hw-badge-close" aria-label="ปิดรายละเอียดตรา">×</button><small>'+esc(preview?'ตัวอย่างตรา':row.owned?'ได้รับแล้ว · รางวัลถาวร':reader.view().status==='ready'?'ตราที่ยังไม่ได้รับ':'รอตรวจรางวัลจากบัญชี')+'</small><img src="'+asset(row)+'" alt=""><h2 id="hwBadgeDetailTitle">'+esc(row.name)+'</h2><p>'+esc(row.description)+'</p><div class="hw-badge-condition">'+esc(row.condition)+'</div>';
   dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.querySelector('.phone').append(dialog);dialog.showModal();
  }
  function paint(){
   const body=document.getElementById('badgesBody'),head=body?.querySelector('.page-head');if(!head)return;
   let section=body.querySelector('.hw-badge-section');if(!section){section=document.createElement('section');section.className='hw-badge-section';section.setAttribute('aria-labelledby','hwBadgesTitle');section.innerHTML='<div class="hw-badge-heading"><div><small>HALLOWEEN · รางวัลถาวร</small><h2 id="hwBadgesTitle">ตราอีเวนต์</h2></div><span class="hw-badge-count"></span></div><p class="hw-badge-state" role="status" aria-live="polite"></p><div class="hw-badge-list"></div><button type="button" class="hw-badge-refresh">ตรวจรางวัลอีกครั้ง</button>';head.after(section);section.querySelector('.hw-badge-refresh').addEventListener('click',()=>reader?.refresh(true));section.querySelector('.hw-badge-list').addEventListener('click',e=>{const b=e.target.closest('[data-hw-badge]');if(b)info(b.dataset.hwBadge);});}
   const result=preview?{status:'preview',entries:entries({preview:true})}:reader.view(),owned=result.entries.filter(x=>x.owned).length;
   section.querySelector('.hw-badge-count').textContent=preview?'2 แบบ · ตัวอย่าง':result.status==='ready'?owned+' / 2':'— / 2';
   const state={preview:'ดูตัวอย่างตรา · ไม่นับว่าได้รับในบัญชีจริง',login:'เข้าสู่ระบบ StudentOS เพื่อตรวจตราที่ได้รับ',idle:'กำลังเตรียมตรวจรางวัลจากบัญชี',loading:'กำลังตรวจรางวัลจากบัญชี…',ready:'ได้รับแล้วจะเก็บไว้หลังจบอีเวนต์',error:'ยังตรวจรางวัลไม่ได้ ลองอีกครั้งเมื่อออนไลน์'};
   section.querySelector('.hw-badge-state').textContent=state[result.status];const refresh=section.querySelector('.hw-badge-refresh');refresh.hidden=preview||result.status==='login';refresh.disabled=result.status==='loading';
   section.querySelector('.hw-badge-list').innerHTML=result.entries.map(row=>'<button type="button" class="hw-badge-card'+(row.owned?' earned':'')+(preview?' preview':'')+'" data-hw-badge="'+row.id+'"><span class="hw-badge-art"><img src="'+asset(row)+'" alt="" loading="lazy"></span><span class="hw-badge-copy"><small>'+esc(row.rarity==='Collector'?'COLLECTOR':'SECRET')+' · '+(preview?'ตัวอย่าง':row.owned?'ได้รับแล้ว ✓':result.status==='ready'?'ยังไม่ได้รับ':'รอตรวจบัญชี')+'</small><strong>'+esc(row.name)+'</strong><span>'+esc(row.condition)+'</span><em>ดูรายละเอียดตรา →</em></span></button>').join('');
   const eyebrow=head.querySelector('.eyebrow');if(eyebrow&&!eyebrow.textContent.includes('เหรียญหลัก'))eyebrow.textContent+=' · เหรียญหลัก';
  }
  const original=window.renderBadges;window.renderBadges=function(...args){const result=original.apply(this,args);paint();if(!preview&&document.querySelector('#scr-badges.on'))reader.refresh();return result;};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.querySelector('#scr-badges.on')){paint();reader?.refresh(true);}});
  const originalGo=window.go;if(typeof originalGo==='function')window.go=function(id,...args){if(id!=='scr-badges')document.querySelector('.hw-badge-detail')?.close();return originalGo.call(this,id,...args);};
  paint();
 }
 return Object.freeze({entries,createReader,install});
});
