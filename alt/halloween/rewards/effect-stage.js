/* Presentation only. No task, ownership, currency or event-state writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HalloweenEffectStage=api;})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const SOUND_KEY='studentos.alt.doneFxSound';
 const finaleTime=(rarity,reduced)=>reduced?650:rarity==='Legendary'?2800:1900;
 function throwHits(p,v,r){
  if(![p.x,p.y,v.x,v.y,r.left,r.right,r.top,r.bottom].every(Number.isFinite))return false;
  if(p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom)return true;
  const speed=Math.hypot(v.x,v.y);if(v.y>=-.15||speed<.4)return false;
  const reach=Math.min(170,speed*140),end={x:p.x+v.x/speed*reach,y:p.y+v.y/speed*reach};
  let lo=0,hi=1;for(const axis of ['x','y']){const d=end[axis]-p[axis],min=axis==='x'?r.left:r.top,max=axis==='x'?r.right:r.bottom;if(!d){if(p[axis]<min||p[axis]>max)return false;continue;}const a=(min-p[axis])/d,b=(max-p[axis])/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return false;}return true;
 }
 function sound({AudioContext,storage}={}){
  let enabled=true,ctx=null,disposed=false;const voices=new Set();
  try{enabled=storage?.getItem(SOUND_KEY)!=='0';}catch{}
  function stop(){for(const {osc,gain} of voices){try{osc.stop();osc.disconnect();gain.disconnect();}catch{}}voices.clear();if(ctx){try{ctx.close()?.catch(()=>{});}catch{}ctx=null;}}
  function play(effect,win=false){
   if(!enabled||disposed||!AudioContext)return;
   try{if(!ctx){try{if(typeof navigator!=='undefined'&&navigator.audioSession)navigator.audioSession.type='ambient';}catch{}ctx=new AudioContext();}if(ctx.state==='suspended')ctx.resume()?.catch(()=>{});
    const notes=({wake:[196,294,392],arrival:[147,220,294,440],sparks:[220,330,440],verdict:[110,165,330,660],bats:[196,233,349],eclipse:[146.83,220,293.66,440],bloom:[261.63,329.63,392],gate:[130.81,196,261.63,392]})[effect]||[220,330];
    const chosen=win?notes:notes.slice(0,2);chosen.forEach((freq,i)=>{if(voices.size>=12)return;const osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+i*(win?.085:.025),end=at+(win?.6:.17),voice={osc,gain};voices.add(voice);osc.type=effect==='verdict'?'triangle':'sine';osc.frequency.setValueAtTime(freq,at);osc.frequency.exponentialRampToValueAtTime(freq*(win?1.002:.78),end);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(win?.055:.035,at+.018);gain.gain.exponentialRampToValueAtTime(.0001,end);osc.connect(gain);gain.connect(ctx.destination);osc.onended=()=>{voices.delete(voice);osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(end+.02);});
   }catch{/* Unsupported audio must never interrupt a completed task. */}
  }
  return {get enabled(){return enabled;},play,toggle(){if(disposed)return false;enabled=!enabled;try{storage?.setItem(SOUND_KEY,enabled?'1':'0');}catch{}if(!enabled)stop();return enabled;},dispose(){disposed=true;stop();}};
 }
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const bat=(x,y,s=1)=>'<g transform="translate('+x+' '+y+') scale('+s+')"><path class="hws-wing" d="M0 0Q-26-39-64-22L-47 5-26-3-13 14 0 8 13 14 26-3 47 5 64-22Q26-39 0 0" fill="#b8a3ce" stroke="#e2c9e8" stroke-width="1.3"/><path d="m-5-8 5 5 5-5 4 17-9 14-9-14z" fill="#251b35"/></g>';
 function pumpkin(x,y,s,node){return '<g transform="translate('+x+' '+y+') scale('+s+')"><g class="hws-node" data-scene-node="'+node+'"><ellipse cx="0" cy="0" rx="58" ry="48" fill="#6d3b30" stroke="#c57745" stroke-width="2"/><ellipse rx="32" ry="48" fill="#8f4d32" stroke="#ba7041"/><path d="m-3-45 8-24 12 5-9 21" fill="#82704a"/><path class="hws-eyes" d="m-34-9 20-10 2 19zm68 0-20-10-2 19zM-33 19l16 6 8-7 10 11 10-11 8 7 14-6-9 18H-24z" fill="#e1b66a"/></g></g>';}
 function art(effect,ship,prefix){
  if(!['wake','sparks','bats','bloom','arrival','verdict','eclipse','gate'].includes(effect))return '';
  const p=escape(prefix),glow='url(#'+p+'-glow)',dark='#100f20';let content='';
  const moon='<circle cx="300" cy="138" r="91" fill="'+glow+'"/><circle cx="300" cy="138" r="56" fill="#c0d9d2" opacity=".65"/><circle cx="280" cy="123" r="8" fill="#71878c" opacity=".25"/>';
  const stars=Array.from({length:18},(_,i)=>'<circle cx="'+(28+i*107%550)+'" cy="'+(24+i*47%205)+'" r="'+(i%3===0?1.8:1)+'" fill="currentColor" opacity=".4"/>').join('');
  if(effect==='wake'||effect==='arrival'){
   content=stars+moon+'<path d="M0 288Q100 255 200 287T400 285 600 280V460H0Z" fill="#0d2630"/><g class="hws-tide" fill="none" stroke="#81b9b1" stroke-width="2" opacity=".4"><path d="M-80 306q60-16 120 0t120 0 120 0 120 0 120 0 120 0M-80 337q80-12 160 0t160 0 160 0 160 0M-80 390q50-8 100 0t100 0 100 0 100 0 100 0 100 0"/></g><g class="hws-voyage"><g class="hws-boat"><image href="'+escape(ship)+'" x="185" y="74" width="230" height="235"/></g></g>';
   if(effect==='wake')content+='<path d="M55 412 545 412 410 330H190Z" fill="#241e25" stroke="#86705d" stroke-width="2"/><path d="M130 382h340M165 358h270M230 331l-20 81m160-81 20 81" stroke="#493c3c"/>'+[0,1,2].map(i=>'<g transform="translate('+(155+i*145)+' '+(360+(i===1?-25:0))+')"><g class="hws-node" data-scene-node="'+i+'"><circle r="33" fill="'+glow+'" class="hws-lamp-glow"/><path d="M-12-24h24l7 9v35h-38v-35z" fill="#2b3536" stroke="#9b9274"/><rect class="hws-eyes" x="-11" y="-12" width="22" height="24" rx="2" fill="#f7d392"/><path d="M-12-24v-8q12-13 24 0v8" fill="none" stroke="#b0a17a"/></g></g>').join('');
  }
  if(effect==='sparks'||effect==='verdict'){
   content=stars+'<circle cx="455" cy="95" r="58" fill="#d29a62" opacity=".38"/><path d="M0 293 40 278V187l20-30 20 30v88l60 7V225l30-50 30 50v46l62 14 42-43 38 34 64-18v-80l30-33 30 33v86l90 26V460H0Z" fill="#1c1921"/><path d="M0 358q170-77 300-17t300-23v142H0" fill="#2e2426"/>';
   if(effect==='sparks')content+=pumpkin(150,315,.85,0)+pumpkin(300,291,1.14,1)+pumpkin(452,315,.85,2);
   else content+='<ellipse cx="300" cy="371" rx="193" ry="45" fill="none" stroke="#c58b51" stroke-dasharray="5 14"/><g class="hws-verdict-blade"><path d="m205 354 131-249" stroke="#977d58" stroke-width="11"/><path d="m205 354 131-249" stroke="#edcfa0" stroke-width="3"/><path d="M318 132Q429 57 491 157Q424 125 343 162L329 191 306 184Z" fill="#a3b6b6" stroke="#edddbe" stroke-width="3"/><path d="M334 134q86-47 136 8" fill="none" stroke="#f7e2b4" stroke-width="3"/></g>'+pumpkin(151,335,.65,0)+pumpkin(465,335,.65,1)+'<g class="hws-scars" stroke="#ffdba5" stroke-width="3"><path data-scene-node="0" d="m170 195 250 110"/><path data-scene-node="1" d="m440 202-271 119"/><path data-scene-node="2" d="m245 170 100 181"/></g>';
  }
  if(effect==='bats'||effect==='eclipse'){
   content='<path d="M50 460V110L92 50l43 60v350m330 0V110l43-60 42 60v350" fill="#231c2b" stroke="#574055" stroke-width="3"/><path d="M163 368V172Q300-90 437 172v196" fill="#171625" stroke="#836172" stroke-width="4"/><path d="M184 367V178Q300-54 416 178v189" fill="none" stroke="#3d2b42" stroke-width="2"/>'+stars;
   if(effect==='bats')content+='<circle cx="300" cy="150" r="71" fill="'+glow+'"/><circle cx="300" cy="150" r="45" fill="#c6bbc8" opacity=".75"/><g class="hws-flock">'+bat(300,210,1.1)+bat(175,265,.55)+bat(435,275,.55)+bat(235,120,.35)+bat(395,140,.38)+'</g>';
   else content+='<g class="hws-eclipse-rings" fill="none" stroke="#cd8caa"><circle cx="300" cy="220" r="126" opacity=".3"/><circle cx="300" cy="220" r="112" stroke-dasharray="2 14" stroke-width="4" opacity=".55"/></g><circle cx="300" cy="220" r="99" fill="'+glow+'"/><circle cx="300" cy="220" r="80" fill="#cc869d"/><circle class="hws-shadow" cx="300" cy="220" r="78" fill="'+dark+'"/><circle class="hws-corona" cx="300" cy="220" r="83" fill="none" stroke="#f0c5cf" stroke-width="3"/>'+bat(163,325,.35)+bat(434,330,.35);
   content+='<path d="M55 427h490l-42-28H97Zm42-29h406l-38-29H135Z" fill="#382634" stroke="#805469" stroke-width="1"/>';
  }
  if(effect==='bloom'||effect==='gate'){
   content=stars+'<circle cx="430" cy="92" r="48" fill="#bbb5db" opacity=".38"/><path d="M0 329q150-48 300-7t300-9V460H0" fill="#242233"/>'+[70,140,460,530].map((x,i)=>'<g transform="translate('+x+' '+(285+i%2*28)+') rotate('+(i%2?-9:7)+')"><path d="M-17 54V0q17-28 34 0v54" fill="#3a374c" stroke="#6c617c"/><path d="M0-2v30m-9-20H9" stroke="#8a7e96" stroke-width="2"/></g>').join('');
   if(effect==='gate')content+='<g class="hws-portal"><path d="M194 365V180Q300-3 406 180v185" fill="#201a32" stroke="#8c7d9f" stroke-width="16"/><path class="hws-portal-light" d="M210 365V181Q300 30 390 181v184" fill="'+glow+'" stroke="#c1aee0" stroke-width="3"/><g class="hws-vortex" fill="none" stroke="#c7b2e4" opacity=".4"><ellipse cx="300" cy="245" rx="63" ry="100"/><ellipse cx="300" cy="245" rx="40" ry="78"/><ellipse cx="300" cy="245" rx="18" ry="51"/></g></g><path d="M150 396h300l-44-31H194Z" fill="#4d425c" stroke="#a58bbd"/><g class="hws-guardian" fill="#1c1827" stroke="#7a658a"><path d="M99 347V187q35-107 70 0v160Z"/><path d="M431 347V187q35-107 70 0v160Z"/><path d="m118 192 16-32 16 32-16 22zm330 0 18-32 17 32-17 22" fill="#b2a3bb"/><path d="M105 208 81 144m10 9q-20-21-41-5 33-3 40 24" stroke-width="4"/></g>';
   else content+='<path d="M120 355q180-50 360 0" fill="none" stroke="#6f5c83"/>'+[0,1,2,3].map(i=>'<g transform="translate('+(145+i*104)+' '+(350-(i%2*18))+')"><path d="M0 7v49m0-22q-23-21-30-8 8 17 30 15m0-22q23-20 30-8-8 18-30 15" fill="#527e72" stroke="#7bb4a0"/><g class="hws-node hws-flower" data-scene-node="'+i+'">'+Array.from({length:6},(_,j)=>'<ellipse cx="0" cy="-18" rx="10" ry="22" transform="rotate('+(j*60)+')" fill="#b9a4d7" stroke="#e3d5ef"/>').join('')+'<circle r="9" fill="#e4d49f"/></g></g>').join('');
  }
  return '<svg viewBox="0 0 600 460" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient id="'+p+'-glow"><stop stop-color="currentColor" stop-opacity=".58"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs>'+content+'</svg>';
 }
 let serial=0;
 function mount(layer,item,{asset,reduced=false}={}){
  const field=layer.querySelector('.hw-game-field'),scene=document.createElement('div');scene.className='hw-effect-scene';scene.setAttribute('aria-hidden','true');scene.innerHTML=art(item.effect,asset({id:'ghostship-vessel'}),'hws-'+(++serial));field.prepend(scene);layer.classList.add('hw-game-cinematic');
  let storage;try{storage=localStorage;}catch{}const audio=sound({AudioContext:window.AudioContext||window.webkitAudioContext,storage}),particles=new Set(),timers=new Set();let disposed=false,lastTrail=0;
  function later(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;}
  function clearParticles(){for(const el of particles)el.remove();particles.clear();for(const id of timers)clearTimeout(id);timers.clear();}
  function burst(p,win=false,trail=false){
   if(disposed||reduced)return;const rect=field.getBoundingClientRect(),x=p?p.x-rect.left:rect.width*.5,y=p?p.y-rect.top:rect.height*.32;
   for(let i=0;i<(trail?2:win?30:14)&&particles.size<64;i++){const el=document.createElement('i'),angle=i*2.39996,reach=trail?12:(win?100:48)*(0.55+i%5*.12);el.className='hw-effect-scene-particle'+(trail?' trail':'');el.style.cssText='left:'+x+'px;top:'+y+'px;--px:'+Math.cos(angle)*reach+'px;--py:'+(Math.sin(angle)*reach-(win?45:15))+'px;--pr:'+(i*43)+'deg;--pd:'+(trail?360:750+i%4*90)+'ms';field.append(el);particles.add(el);later(()=>{el.remove();particles.delete(el);},1200);}
  }
  const soundButton=document.createElement('button');soundButton.type='button';soundButton.className='hw-game-sound';
  function syncSound(){soundButton.textContent=audio.enabled?'เสียง: เปิด':'เสียง: ปิด';soundButton.setAttribute('aria-pressed',String(audio.enabled));soundButton.setAttribute('aria-label',audio.enabled?'ปิดเสียงเอฟเฟกต์':'เปิดเสียงเอฟเฟกต์');}
  soundButton.addEventListener('click',()=>{audio.toggle();syncSound();if(audio.enabled)audio.play(item.effect);});syncSound();layer.append(soundButton);
  return {hit(index,p,win){if(disposed)return;scene.querySelectorAll('[data-scene-node="'+index+'"]').forEach(el=>el.classList.add('awake'));burst(p,win);audio.play(item.effect,win);},trail(p){const now=performance.now();if(now-lastTrail<45)return;lastTrail=now;burst(p,false,true);},setMotion(still){reduced=still;if(still)clearParticles();},dispose(){if(disposed)return;disposed=true;clearParticles();audio.dispose();scene.remove();soundButton.remove();}};
 }
 return Object.freeze({throwHits,finaleTime,sound,art,mount});
});
