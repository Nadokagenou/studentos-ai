/* ALT cosmetic access. Event inventory, currency and medals are never granted here. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./catalog.js'));
 else{const api=factory(root.StudentOSHalloweenRewards);root.HalloweenCosmetics=api;api.install();}
})(typeof window==='undefined'?globalThis:window,C=>{
 'use strict';
 const COSTUME_KEY='studentos.alt.halloween.costumes';
 const items=Object.freeze(C.items.filter(x=>['theme','costume','room','effect'].includes(x.kind)));
 const available=id=>items.some(x=>x.id===id),isEffect=id=>items.some(x=>x.id===id&&x.kind==='effect');
 const owns=id=>available(id)&&(globalThis.__HW_SHOWROOM__===true||globalThis.HalloweenRewardAccess?.owns(id)===true);
 const browserBase=typeof document==='undefined'?null:new URL('.',document.currentScript.src).href;
 const asset=item=>new URL(item.asset||'assets/'+item.id+'.svg',browserBase).href;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function readCostumes(storage){let saved;try{saved=JSON.parse(storage.getItem(COSTUME_KEY)||'{}');}catch{return {};}
  const out={};for(const mascot of ['sai','hook'])if(items.some(x=>x.kind==='costume'&&x.id===saved?.[mascot]&&x.mascot===mascot))out[mascot]=saved[mascot];return out;}
 function saveCostume(storage,id){const item=items.find(x=>x.id===id&&x.kind==='costume');if(!item||!owns(id))return false;
  try{storage.setItem(COSTUME_KEY,JSON.stringify({...readCostumes(storage),[item.mascot]:id}));return true;}catch{return false;}}
 function browserCostumes(){try{return readCostumes(localStorage);}catch{return {};}}
 function costumeAsset(mascot){const id=browserCostumes()[mascot],item=items.find(x=>x.id===id);return item&&owns(id)?asset(item):null;}
 function costumeForSource(src){const id=/(?:^|\/)sai-(?:face-[\w-]+|chibi)\.webp$|(?:^|\/)sai-avatar\.png$/.test(src)?'sai':/(?:^|\/)hook-(?:body|face)\.webp$|(?:^|\/)hook-avatar\.png$|(?:^|\/)hook-hat-(?:body|face|avatar)\.svg$/.test(src)?'hook':null;return id?costumeAsset(id):null;}
 function roomEntries(base){const positions={desk:[136,38,96,96],shelf:[170,12,76,76],poster:[92,9,80,80],hanging:[196,-27,86,86],pet:[2,138,104,104]};
  return items.filter(x=>x.kind==='room').map(item=>{const [x,y,w,h]=positions[item.slot],src=new URL(item.asset||'assets/'+item.id+'.svg',base).href;
   return {id:'hw-'+item.id,name:item.name+' · Halloween',slot:item.slot==='hanging'?'ceiling':item.slot,cost:0,svg:'<image class="hw-native-room-item" data-hw-room="'+item.id+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" href="'+src+'"/>'};});}
 function syncCostumes(){const selected=browserCostumes(),current=document.documentElement.dataset.mascot;/* 31 ต.ค. 69 · เจ้าของ (ภาพการ์ดสองใบขึ้น "ใช้อยู่" พร้อมกัน): "ให้มันเห็นเป็นเลือกทีละอัน" — ชุดจำแยกต่อมาสคอต แต่จอโชว์มาสคอตได้ทีละตัว · ป้าย "ใช้อยู่" จึงขึ้นเฉพาะชุดของมาสคอตที่อยู่บนจอตอนนี้ (อีกตัวยังจำไว้ สลับมาสคอตแล้วกลับมา) */document.querySelectorAll('button[data-hw-costume]').forEach(b=>{const item=C.find(b.dataset.hwCostume),on=selected[item.mascot]===item.id&&(!current||item.mascot===current);b.disabled=!owns(item.id);b.title=globalThis.__HW_SHOWROOM__===true?'ตัวอย่างในห้องลอง':owns(item.id)?'ได้รับจากบัญชีแล้ว':'รับจากอีเวนต์ก่อนเลือกใช้';b.setAttribute('aria-pressed',String(on));b.classList.toggle('active',on);});/* 31 ต.ค. 69 · ปุ่ม "ใช้ชุดตามธีม" บอกด้วยว่ากำลังใช้อยู่ (ยังไม่ได้เลือกชุดไหน) — เดิมดูไม่ออกว่าตอนนี้ใช้ชุดอะไร */const reset=document.querySelector('.hw-costume-reset');if(reset){const none=current?!selected[current]:!Object.values(selected).some(Boolean);reset.classList.toggle('active',none);reset.setAttribute('aria-pressed',String(none));}}
 function chooseCostume(id){const item=items.find(x=>x.id===id&&x.kind==='costume');if(!item)return;try{if(!saveCostume(localStorage,id))return;}catch{return;}
  if(typeof setMascot==='function')setMascot(item.mascot);syncCostumes();}
 function resetCostumes(){try{localStorage.removeItem(COSTUME_KEY);}catch{return;}if(typeof applyMascot==='function')applyMascot();if(typeof renderAll==='function')renderAll();syncCostumes();}
 let installed=false;
 function install(){
  if(installed)return;installed=true;
  const picker=document.getElementById('themePick');items.filter(x=>x.kind==='theme').forEach(item=>{
   if(!picker||picker.querySelector('[data-th="'+item.theme+'"]'))return;const b=document.createElement('button');b.type='button';b.dataset.th=item.theme;
   b.innerHTML='<span class="sw sw-'+item.theme+'"></span><span class="nm">'+esc(C.themeNames[item.theme])+'</span>';b.addEventListener('click',()=>setTheme(item.theme));picker.append(b);});
  if(typeof ROOM_ITEMS!=='undefined')for(const entry of roomEntries(browserBase))if(!ROOM_ITEMS.some(x=>x.id===entry.id))ROOM_ITEMS.push(entry);
  if(typeof FX_SHOP!=='undefined')for(const item of items.filter(x=>x.kind==='effect'))FX_SHOP[item.id]={cost:0,name:item.name,desc:item.description,emoji:'✧',halloween:true};
  const mascotPicker=document.getElementById('mascotPick');if(mascotPicker&&!document.getElementById('hwCostumePick')){
   const section=document.createElement('section');section.id='hwCostumePick';section.className='hw-costume-picker';section.setAttribute('aria-label','ชุดมาสคอต Halloween');
   section.innerHTML='<h3>ชุดมาสคอต Halloween</h3><div>'+items.filter(x=>x.kind==='costume').map(item=>'<button type="button" data-hw-costume="'+item.id+'" aria-pressed="false"><img src="'+asset(item)+'" alt="" loading="lazy"><span>'+esc(item.name)+'</span></button>').join('')+'</div><button type="button" class="hw-costume-reset">ใช้ชุดตามธีม</button>';
   section.addEventListener('click',e=>{const b=e.target.closest('button[data-hw-costume]');if(b)chooseCostume(b.dataset.hwCostume);else if(e.target.closest('.hw-costume-reset'))resetCostumes();});mascotPicker.after(section);}
  syncCostumes();new MutationObserver(syncCostumes).observe(document.documentElement,{attributes:true,attributeFilter:['data-mascot']});
  if(typeof applyMascot==='function')applyMascot();if(typeof renderFxPick==='function')renderFxPick();
  if(Object.keys(browserCostumes()).length&&typeof renderAll==='function')renderAll();
  if(typeof applyTheme==='function')applyTheme();
  if(document.querySelector('#scr-room.on')&&typeof renderRoom==='function')renderRoom();
 }
 return Object.freeze({items,available,isEffect,owns,syncCostumes,COSTUME_KEY,readCostumes,saveCostume,roomEntries,costumeAsset,costumeForSource,chooseCostume,resetCostumes,install,
  effectIcon:id=>isEffect(id)?'<img class="hw-effect-icon" src="'+asset(C.find(id))+'" alt="">':'',
  playEffect:(id,onClose,title,preview)=>isEffect(id)&&window.HalloweenRewards?.playEffect(id,onClose,title,preview)});
});
