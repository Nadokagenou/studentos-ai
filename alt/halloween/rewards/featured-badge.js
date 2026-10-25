/* A single opt-in profile badge. Awards remain owned by the event service. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./catalog.js'));else{root.HalloweenFeaturedBadge=factory(root.StudentOSHalloweenRewards);root.HalloweenFeaturedBadge.install();}})(globalThis,C=>{
 'use strict';const ids=new Set(['midnight-conqueror','crown-of-midnight']);
 function selection(row,owner){if(row==null)return null;if(row.user_id!==owner||row.season!=='halloween-2026'||!ids.has(row.badge_id))throw Error('Selection does not match account');return {user_id:owner,season:row.season,badge_id:row.badge_id,earned_at:row.earned_at||null,selected_at:row.selected_at||null};}
 function createStore({owner,invoke,onChange=()=>{},clock=Date.now}){
  let uid=null,record=null,status='login',pending=null,epoch=0,readAt=0;
  function identity(){const next=owner()||null;if(next!==uid){uid=next;record=null;status=uid?'idle':'login';pending=null;readAt=0;epoch++;}}
  function view(){identity();return {owner:uid,record,status,busy:status==='loading'||status==='saving'};}
  function request(body){
   identity();if(!uid)return Promise.resolve(false);if(pending)return pending;
   const who=uid,generation=epoch;status=body.action==='equip'?'saving':'loading';onChange();
   pending=(async()=>{try{const {data,error}=await invoke(body);identity();if(who!==uid||generation!==epoch)return false;if(error||!data||!Object.hasOwn(data,'selection'))throw Error('Not confirmed');record=selection(data.selection,who);status='ready';readAt=clock();return true;}
    catch{identity();if(who===uid&&generation===epoch)status='error';return false;}
   })().finally(()=>{if(who===uid&&generation===epoch){pending=null;onChange();}});return pending;
  }
  return Object.freeze({view,refresh(force=false){identity();if(!force&&status==='ready'&&clock()-readAt<30000)return Promise.resolve(true);return request({action:'read'});},equip(id){if(id!==null&&!ids.has(id))return Promise.resolve(false);return request({action:'equip',badgeId:id});}});
 }
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let browser=null;
 function html(id,{mine=false,compact=false}={}){return '<span class="hw-featured-slot" data-feature-user="'+esc(id||'')+'" data-feature-own="'+(mine?'1':'0')+'" data-feature-compact="'+(compact?'1':'0')+'"></span>';}
 function install(){
  if(typeof document==='undefined'||!C||browser)return;
  const preview=window.__HW_SHOWROOM__===true,base=new URL('.',document.currentScript.src),asset=id=>new URL('assets/'+id+'.svg',base).href;
  const owner=()=>typeof currentUser==='undefined'?null:currentUser?.id;
  let demo=null,cacheOwner=null,cache=new Map(),loading=new Set(),picker=null;
  const store=createStore({owner,invoke:body=>{if(typeof sb==='undefined'||!sb)return Promise.resolve({error:true});return sb.functions.invoke('halloween-badge',{body});},onChange:()=>{paintSlots();paintPicker();}});
  browser={store};
  const state=()=>preview?{owner:'preview',record:demo,status:'preview',busy:false}:store.view();
  function date(value){const ms=Date.parse(value);return Number.isFinite(ms)?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(ms):'';}
  function currentRecord(id,mine){const s=state();if(cacheOwner!==s.owner){cacheOwner=s.owner;cache=new Map();loading=new Set();}return mine||id===s.owner?s.record:cache.get(id)?.record||null;}
  function paintSlots(){
   const s=state();for(const slot of document.querySelectorAll('.hw-featured-slot')){const mine=slot.dataset.featureOwn==='1',compact=slot.dataset.featureCompact==='1',id=slot.dataset.featureUser,r=currentRecord(id,mine),item=r&&C.find(r.badge_id);
    const content=item?'<button type="button" class="hw-featured-chip'+(compact?' compact':'')+'" '+(mine?'data-feature-choose':'data-feature-info="'+esc(id)+'"')+' aria-label="'+esc((mine?'เปลี่ยนตราโปรไฟล์ · ':'ตราโปรไฟล์ · ')+item.name)+'"><img src="'+asset(item.id)+'" alt=""><span>'+esc(item.name)+'</span>'+(mine?'<i aria-hidden="true">⌄</i>':'')+'</button>':mine?'<button type="button" class="hw-featured-empty" data-feature-choose>✧ เลือกตราโปรไฟล์</button>':'';
    if(slot.innerHTML!==content)slot.innerHTML=content;slot.classList.toggle('hw-featured-demo',preview);slot.setAttribute('data-feature-state',s.status);
   }
  }
  async function sync(){
   paintSlots();paintPicker();if(preview)return;const s=state();if(!s.owner)return;
   const slots=[...document.querySelectorAll('.screen.on .hw-featured-slot')];if(!slots.length)return;
   if(slots.some(e=>e.dataset.featureOwn==='1'||e.dataset.featureUser===s.owner))store.refresh();
   const at=Date.now(),wanted=[...new Set(slots.map(e=>e.dataset.featureUser))].filter(id=>/^[0-9a-f-]{36}$/i.test(id)&&id!==s.owner&&!loading.has(id)&&(!cache.has(id)||at-cache.get(id).at>30000)).slice(0,200);
   if(!wanted.length||typeof sb==='undefined'||!sb)return;const who=s.owner,requests=loading;wanted.forEach(id=>requests.add(id));
   try{const {data,error}=await sb.from('halloween_featured_badges').select('user_id,season,badge_id,earned_at,selected_at').in('user_id',wanted);if(who!==state().owner)return;
    for(const id of wanted){const row=!error&&data?.find(r=>r.user_id===id);let record=null;try{record=selection(row||null,id);}catch{}cache.set(id,{record,at:Date.now()});}
   }catch{if(who===state().owner)wanted.forEach(id=>cache.set(id,{record:null,at:Date.now()}));}
   finally{wanted.forEach(id=>requests.delete(id));if(who===state().owner)paintSlots();}
  }
  function paintPicker(){
   if(!picker?.open)return;const s=state(),awards=preview?{status:'preview',entries:C.items.filter(x=>ids.has(x.id))}:window.HalloweenBadges?.viewOwn();
   const ready=preview||awards?.status==='ready',canPick=preview||!!s.owner;
   picker.querySelector('.hw-featured-message').textContent=preview?'ห้องลอง · เลือกดูตัวอย่าง แยกจากบัญชีจริง':!s.owner?'เข้าสู่ระบบเพื่อเลือกตราที่บัญชีได้รับ':s.status==='error'?'ยังยืนยันไม่ได้ · กดตรวจอีกครั้งก่อนเลือกต่อ':s.busy?'กำลังยืนยันกับบัญชี…':awards?.status==='error'?'ยังตรวจตราที่ได้รับไม่ได้ · ลองอีกครั้งเมื่อออนไลน์':!ready?'กำลังตรวจตราที่ได้รับ…':'เลือกได้ 1 อัน · เพื่อนที่รับแล้วจะเห็นตรานี้';
   const list=picker.querySelector('.hw-featured-options');list.innerHTML=[...ids].map(id=>{const row=awards?.entries?.find(x=>x.id===id)||C.find(id),on=s.record?.badge_id===id,enabled=canPick&&ready&&(preview||row.owned)&&!s.busy&&s.status!=='error';return '<button type="button" class="hw-featured-choice'+(on?' chosen':'')+'" data-feature-equip="'+id+'" aria-pressed="'+on+'" '+(enabled?'':'disabled')+'><img src="'+asset(id)+'" alt=""><strong>'+esc(row.name)+'</strong><small>'+esc(on?'ติดอยู่บนโปรไฟล์':preview?'ลองติดตรานี้':row.owned?'ได้รับแล้ว · เลือกตรานี้':ready?'ยังไม่ได้รับตรานี้':'รอตรวจบัญชี')+'</small></button>';}).join('');
   const clear=picker.querySelector('[data-feature-clear]');clear.disabled=!s.record||s.busy||s.status==='error';const retry=picker.querySelector('[data-feature-reload]');retry.hidden=preview||!s.owner;retry.disabled=s.busy;
   picker.querySelector('[data-feature-login]').hidden=preview||!!s.owner;
  }
  async function openPicker(){
   if(picker?.open)return;picker=document.createElement('dialog');picker.className='hw-featured-picker';picker.setAttribute('aria-labelledby','hwFeaturedTitle');
   picker.innerHTML='<button type="button" class="hw-badge-close" data-feature-close aria-label="ปิดการเลือกตรา">×</button><small>HALLOWEEN · PROFILE BADGE</small><h2 id="hwFeaturedTitle">ตราบนโปรไฟล์</h2><p class="hw-featured-message" role="status" aria-live="polite"></p><div class="hw-featured-options"></div><div class="hw-featured-actions"><button type="button" data-feature-clear>ไม่แสดงตรา</button><button type="button" data-feature-reload>ตรวจอีกครั้ง</button><button type="button" data-feature-login>เข้าสู่ระบบ</button></div>';
   const current=picker;picker.addEventListener('close',()=>{current.remove();if(picker===current)picker=null;document.querySelector('.screen.on [data-feature-choose]')?.focus({preventScroll:true});},{once:true});document.querySelector('.phone').append(picker);picker.showModal();paintPicker();
   if(!preview&&owner()){await Promise.allSettled([store.refresh(true),window.HalloweenBadges?.refreshOwn()]);paintPicker();}
  }
  async function equip(id){
   if(preview){demo=id?{user_id:'preview',season:'halloween-2026',badge_id:id,earned_at:null,selected_at:null}:null;paintSlots();picker?.close();return;}
   const who=owner(),award=window.HalloweenBadges?.viewOwn()?.entries?.find(x=>x.id===id);if(id!==null&&!award?.owned)return;
   if(await store.equip(id)){if(owner()!==who)return;picker?.close();if(typeof showToast==='function')showToast({title:id?'ติดตราบนโปรไฟล์แล้ว':'เอาตราออกจากโปรไฟล์แล้ว',body:id?'เพื่อนที่รับแล้วจะเห็นตราที่เลือกไว้':''});}
  }
  function info(id){
   const row=currentRecord(id,false),item=row&&C.find(row.badge_id);if(!item)return;document.querySelector('.hw-featured-info')?.remove();const d=document.createElement('dialog');d.className='hw-badge-detail hw-featured-info';d.setAttribute('aria-label',item.name);
   d.innerHTML='<button type="button" class="hw-badge-close" aria-label="ปิดรายละเอียดตรา">×</button><small>ตราที่เลือกแสดงบนโปรไฟล์</small><img src="'+asset(item.id)+'" alt=""><h2>'+esc(item.name)+'</h2><p>'+esc(item.description)+'</p>'+(date(row.earned_at)?'<div class="hw-badge-condition">ได้รับเมื่อ '+esc(date(row.earned_at))+'</div>':'');
   d.querySelector('button').addEventListener('click',()=>d.close());d.addEventListener('close',()=>d.remove(),{once:true});document.querySelector('.phone').append(d);d.showModal();
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-feature-choose],[data-feature-info],[data-feature-equip],[data-feature-clear],[data-feature-reload],[data-feature-login],[data-feature-close]');if(!b||b.disabled)return;e.preventDefault();e.stopPropagation();
   if(b.hasAttribute('data-feature-choose'))openPicker();else if(b.hasAttribute('data-feature-info'))info(b.dataset.featureInfo);else if(b.hasAttribute('data-feature-equip'))equip(b.dataset.featureEquip);else if(b.hasAttribute('data-feature-clear'))equip(null);else if(b.hasAttribute('data-feature-close'))picker?.close();else if(b.hasAttribute('data-feature-login')){picker?.close();if(typeof setLoginView==='function')setLoginView('root');window.go('scr-login');}else if(b.hasAttribute('data-feature-reload'))Promise.allSettled([store.refresh(true),window.HalloweenBadges?.refreshOwn()]).then(paintPicker);
  },true);
  for(const name of ['renderProfileHead','renderUser','paintFriendParts']){const original=window[name];if(typeof original==='function')window[name]=function(...args){const result=original.apply(this,args);sync();return result;};}
  const go=window.go;if(typeof go==='function')window.go=function(...args){const result=go.apply(this,args);sync();return result;};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){cache=new Map();sync();}});
  if(typeof window.renderProfileHead==='function')window.renderProfileHead();sync();
 }
 return Object.freeze({selection,createStore,html,install});
});
