/* Permanent reward presentation. Acquisition belongs to the removable event. */
(() => {
 'use strict';
 const C=window.StudentOSHalloweenRewards;if(!C)return;
 const root=document.documentElement,base=new URL('.',document.currentScript.src),asset=item=>new URL(item.asset||'assets/'+item.id+'.svg',base).href;
 let current=null,scene,fxTimer=0,lastRequest=null,queued=false,effectSession=null;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const themes=C.items.filter(x=>x.kind==='theme');
 function syncScene(){const item=themes.find(x=>x.theme===root.dataset.theme&&!['halloween','moonlight'].includes(x.theme));if(!scene){scene=document.createElement('div');scene.className='hw-biome-scene';scene.setAttribute('aria-hidden','true');scene.innerHTML='<i class="hw-biome-view"></i><i class="hw-biome-fog"></i><i class="hw-biome-glints"></i><div class="hw-sea-voyage"><span class="hw-sea-wave back"></span><div class="hw-ship-course"><span class="hw-ship-wake"></span><div class="hw-ship-bob"><img src="'+new URL('assets/ghostship-vessel.svg',base).href+'" alt=""></div></div><span class="hw-sea-wave front"></span></div>';document.querySelector('.phone')?.prepend(scene);}scene.hidden=!item;if(item){scene.style.setProperty('--biome-art','url("'+(item.theme==='hw-ghostship'?new URL('assets/ghostship-sea.svg',base).href:item.theme==='hw-vampire'?new URL('assets/vampire-distance.svg',base).href:asset(item))+'")');scene.style.setProperty('--biome-glow',C.biomes[item.biome].color);}}
 function clearPresentation(){finishEffect();clearTimeout(fxTimer);document.querySelectorAll('.hw-reward-fx,.hw-relic-inspect,.hw-room-item').forEach(x=>x.remove());}
 function inspect(item){const layer=document.createElement('div');layer.className='hw-relic-inspect';layer.dataset.tier=item.rarity;layer.setAttribute('role','dialog');layer.setAttribute('aria-label',item.name);layer.setAttribute('aria-modal','true');layer.innerHTML='<button class="hw-reward-close" aria-label="ปิดตัวอย่าง">×</button><span class="hw-reward-eyebrow">'+escape(item.rarity+' · '+C.biomes[item.biome].name)+'</span><div class="hw-relic-ring"><img src="'+asset(item)+'" alt="'+escape(item.name)+'"></div><h2>'+escape(item.name)+'</h2><p>'+escape(item.kind==='badge'?(item.source==='final-boss'?'ตราชัยชนะ · พิชิตราชันเที่ยงคืน':'ตัวอย่างเหรียญ · ซื้อของครบตามรายการร้านอีเวนต์'):'Main Quest · '+C.biomes[item.biome].npc)+'</p>';layer.querySelector('button').addEventListener('click',()=>layer.remove());document.querySelector('.phone').append(layer);layer.querySelector('button').focus({preventScroll:true});}
 function finishEffect(){
  window.HalloweenEffectGames?.close();
  const session=effectSession;if(!session)return;effectSession=null;clearTimeout(fxTimer);session.layer.remove();
  document.removeEventListener('keydown',session.key,true);window.removeEventListener('popstate',session.close);document.removeEventListener('visibilitychange',session.visibility);
  if(typeof session.done==='function')session.done();
 }
 function effect(item,onClose,title){
  if(window.HalloweenEffectGames){clearPresentation();return window.HalloweenEffectGames.open(item,{asset,title,onClose});}
  clearPresentation();const phone=document.querySelector('.phone');if(!phone){if(typeof onClose==='function')onClose();return;}
  const reduced=(matchMedia('(prefers-reduced-motion: reduce)').matches&&root.dataset.hwMotion!=='full')||root.dataset.hwMotion==='still'||root.dataset.lite==='1';
  const layer=document.createElement('div');layer.className='hw-reward-fx fx-'+item.effect+(item.rarity==='Legendary'?' legendary':'')+(reduced?' still':'');layer.setAttribute('role','dialog');layer.setAttribute('aria-label','ฉลองงานเสร็จ · '+item.name);layer.setAttribute('aria-modal','true');layer.style.setProperty('--reward-color',C.biomes[item.biome].color);
  layer.innerHTML='<button class="hw-reward-close">ข้าม</button><div class="hw-fx-aura"></div><div class="hw-fx-ring"></div><img class="hw-fx-object" src="'+asset(item)+'" alt=""><div class="hw-fx-particles">'+Array.from({length:item.rarity==='Legendary'?24:12},(_,i)=>'<i style="--i:'+i+';--angle:'+i*137.5+'deg;--travel:'+(50+i%5*23)+'px"></i>').join('')+'</div><div class="hw-fx-caption"><small>'+escape(item.rarity)+'</small><h2>'+escape(item.name)+'</h2><span>'+escape(title||'เสร็จอีกหนึ่งงานแล้ว')+'</span></div>';
  const close=()=>finishEffect(),key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}},visibility=()=>{if(document.hidden)close();};
  effectSession={layer,done:onClose,key,close,visibility};layer.querySelector('button').addEventListener('click',close);document.addEventListener('keydown',key,true);window.addEventListener('popstate',close);document.addEventListener('visibilitychange',visibility);phone.append(layer);layer.querySelector('button').focus({preventScroll:true});
  fxTimer=setTimeout(close,reduced?2200:item.rarity==='Legendary'?6200:4200);
 }
 function paintCostume(){if(!current||current.kind!=='costume')return;const prefix=current.mascot==='sai'?'sai':'hook';document.querySelectorAll('img').forEach(img=>{const src=img.getAttribute('src')||'';if((prefix==='sai'?/(?:^|\/)sai-(?:face-[\w-]+|chibi)\.webp$|(?:^|\/)sai-avatar\.png$/:/(?:^|\/)hook-(?:body|face)\.webp$|(?:^|\/)hook-avatar\.png$/).test(src)&&img.src!==asset(current)){img.src=asset(current);img.dataset.hwCostumePreview=current.id;}});}
 function paintRoom(){if(!current||current.kind!=='room')return;const svg=document.querySelector('#roomBody .rm-scene');if(!svg||svg.querySelector('.hw-room-item')||svg.querySelector('[data-hw-room]'))return;const slots={desk:[89,113,100,92],shelf:[199,68,53,53],poster:[104,25,55,60],hanging:[162,0,100,95],pet:[208,156,91,80]},[x,y,w,h]=slots[current.slot];const image=document.createElementNS('http://www.w3.org/2000/svg','image');image.setAttribute('class','hw-room-item');for(const [key,value]of Object.entries({x,y,width:w,height:h,href:asset(current)}))image.setAttribute(key,value);svg.append(image);}
 function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;paintCostume();paintRoom();});}
 function preview(id){if(!window.__HW_SHOWROOM__)return false;const item=C.find(id);if(!item)return false;clearPresentation();current=item;
  if(item.kind==='theme'){setTheme(item.theme);go('scr-menu');syncScene();}
  else if(item.kind==='costume'){setTheme('dark');if(typeof setMascot==='function')setMascot(item.mascot);go('scr-ai');queue();}
  else if(item.kind==='room'){setTheme('dark');go('scr-room');if(window.HalloweenCosmetics?.available(item.id)&&typeof roomPick==='function')roomPick(item.slot==='hanging'?'ceiling':item.slot,'hw-'+item.id);else queue();}
  else if(item.kind==='effect'){setTheme('halloween');go('scr-menu');effect(item);}
  else{setTheme('dark');go(item.kind==='badge'?'scr-badges':'scr-room');inspect(item);}
  return true;
 }
 function init(){
  syncScene();new MutationObserver(syncScene).observe(root,{attributes:true,attributeFilter:['data-theme']});
  if(window.__HW_SHOWROOM__)new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  // The event switch is fetched separately. Removing event/ hides its entry.
  // 24 Oct: the entry moved from a card under the profile header to the event slot on the home screen (eventSlot in app.js), as the owner chose.
  if(!window.__HW_SHOWROOM__)fetch(new URL('../event/config.json',base),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(config=>{
   const end=config?.endsAt?Date.parse(config.endsAt):NaN,preview=config?.claimingEnabled!==true;
   // 24 Oct: index.html turns on the Halloween boot/login skin (:root.hw-season) before this file loads.
   // Turning the event off in config.json, or passing endsAt, takes the skin off as well.
   if(!config?.enabled||(Number.isFinite(end)&&end<=Date.now()))root.classList.remove('hw-season');
   if(!config?.enabled)return;
   const destination=new URL('../event/index.html',base);if(preview)destination.searchParams.set('preview','1');destination.searchParams.set('rev','red-dots-20261023');
   const eventDir=new URL('../event/',base),card=config.card||{};
   window.HalloweenEventEntry=Object.freeze({name:config.name||'Halloween',tagline:config.tagline||'',blurb:config.blurb||'',href:destination.href,preview,
    // Home event card art, resolved against event/ so removing event/ takes the art with it
    art:card.art?new URL(card.art,eventDir).href:'',cast:Array.isArray(card.cast)?card.cast.map(x=>new URL(x,eventDir).href):[],names:Array.isArray(card.names)?card.names.map(String):[],fullNames:Array.isArray(card.fullNames)?card.fullNames.map(String):[],
    // null = the event has ended and the button hides itself · '' = no endsAt, so no countdown
    countdown(now=Date.now()){if(!Number.isFinite(end))return'';const left=end-now;if(left<=0)return null;const hours=Math.ceil(left/36e5);return hours<24?'เหลือ '+hours+' ชม.':'เหลือ '+Math.ceil(left/864e5)+' วัน';},
    // Preview Candy lives on this device (KEY in event/experience.js). Real claiming has no store to read yet, so it shows nothing.
    candy(){if(!preview)return null;try{const doc=JSON.parse(localStorage.getItem('studentos.alt.halloween.preview.v1')||'null');return Number.isSafeInteger(doc?.event?.candy)?doc.event.candy:0;}catch{return null;}}});
   try{if(typeof renderMenu==='function')renderMenu();}catch{}
  }).catch(()=>{});
  if(window.__HW_SHOWROOM__){
   const originalHaptic=window.haptic;
   if(typeof originalHaptic==='function')window.haptic=function(kind){const result=originalHaptic.apply(this,arguments);if(kind==='done'&&current?.kind==='effect')setTimeout(()=>effect(current),80);return result;};
   const picker=document.getElementById('themePick');themes.forEach(item=>{if(picker?.querySelector('[data-th="'+item.theme+'"]'))return;const b=document.createElement('button');b.type='button';b.dataset.th=item.theme;b.innerHTML='<span class="sw sw-'+item.theme+'"></span><span class="nm">'+escape(item.name.split(' · ')[0])+'</span>';b.addEventListener('click',()=>setTheme(item.theme));picker?.append(b);});
   window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||parent===window||e.data?.type!=='studentos-halloween-reward-preview'||typeof e.data.id!=='string')return;const request=e.data.id+':'+e.data.request;if(request===lastRequest)return;lastRequest=request;preview(e.data.id);});
   parent.postMessage({type:'studentos-halloween-reward-ready'},location.origin);
  }
  window.HalloweenRewards=Object.freeze({preview,playEffect(id,onClose,title){const item=C.find(id);if(item?.kind!=='effect')return false;effect(item,onClose,title);return true;},closeEffect:finishEffect});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
