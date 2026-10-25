/* ชั้นนำทางบนฉาก: แถบ "ภารกิจตอนนี้" + ไฟนำทางบนจุดที่ต้องกด + ป้ายสั้นบนทุกจุด
   อ่านผลจาก HalloweenObjective.next() อย่างเดียว ไม่ตัดสินเอง · เปลี่ยนแค่หน้าตา ไม่เปลี่ยนเซฟ */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenHUD=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clock=ms=>new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms))+' น.';
  // ป้ายสั้นของแต่ละจุด (ไอคอน + 1–2 คำ) แทนจุดแดงที่หน้าตาเหมือนกันหมด
  const CHIPS=[
    ['[data-route="village"]','🚪','เคาะบ้านหาของ'],
    ['[data-story]','📜','','minor'],
    ['[data-visitors]','🧳','แลกของ','minor'],
    ['[data-route="shop"]','🛒','ร้านค้า'],
    ['[data-route="cauldron"]','⚗️','เตาผสม'],
    ['[data-route="ritual"]','✦','วงเวท'],
    ['[data-route="garden"]','🌱','สวน'],
    ['[data-tutor]','🧙','ถามทาง'],
    ['[data-boss]','⚔️',null],
    ['[data-boss-list]','👑','บัลลังก์'],
    ['[data-action="repair"]','🔧','ซ่อมเรือ'],
    ['[data-game-info="ghost-ship-hunt"]','⛵','ล่าเรือผี'],
    ['[data-game-info="clear-jacks-garden-vines"]','🌿','ตัดวัชพืช'],
    ['[data-game-info="dech-house-spot-difference"]','🔍','จับผิดภาพ'],
    ['[data-game-info="grave-digging"]','⛏️','ขุดหลุม'],
    ['[data-game-info="catch-all-ghosts"]','👻','จับผี']
  ];
  function selector(target,o){
    if(!target)return null;
    if(target==='portal')return '.world-portal[data-enter-biome="'+o.biome+'"]';
    if(target==='village')return '[data-route="village"]';
    if(target==='npc')return '.npc-character[data-quest]';
    if(target==='boss')return '.world-spot[data-boss]';
    if(target==='gate')return '[data-enter-hub]';
    if(target.startsWith('game:'))return '[data-game-info="'+target.slice(5)+'"]';
    return '[data-route="'+target+'"]';
  }
  function chipHTML(icon,text,extra=''){return '<span class="spot-chip'+extra+'" aria-hidden="true"><i>'+icon+'</i>'+(text?'<b>'+esc(text)+'</b>':'')+'</span>';}
  // แต่งฉากหลังวาด: ป้าย ไอคอนล็อก ประตูที่ปิด (บอกเวลาเปิด) และไฟนำทาง
  function decorate(scene,{objective,activity,gardenUnlocked,openAt,npcName}){
    if(!scene)return;
    scene.classList.add('has-chips');
    for(const [sel,icon,text,minor] of CHIPS)scene.querySelectorAll('.world-spot'+sel).forEach(b=>{
      if(b.querySelector('.spot-chip'))return;
      let label=text!=null?text:b.getAttribute('aria-label').replace(/^(ท้าบอส|✓ พิชิตแล้ว) · /,'');
      let lock='';
      const game=b.dataset.gameInfo&&activity(b.dataset.gameInfo);
      if(game&&game.locked){lock=' is-locked';b.dataset.lockReason=game.reason;}
      if(b.dataset.route==='garden'&&!gardenUnlocked){lock=' is-locked';b.dataset.lockReason='สวนเปิดเมื่อจบเควสแรกของ Jack';}
      if(lock)b.classList.add('is-locked');
      b.insertAdjacentHTML('beforeend',chipHTML(lock?'🔒':icon,label,(minor?' minor':'')+lock));
    });
    scene.querySelectorAll('.npc-character').forEach(b=>{if(!b.querySelector('.spot-chip'))b.insertAdjacentHTML('beforeend',chipHTML('💬',b.hasAttribute('data-tutor')?'ถามทาง':npcName(b),' npc'));});
    scene.querySelectorAll('.world-portal.portal-closed').forEach(b=>{
      if(b.querySelector('.portal-lock'))return;
      b.insertAdjacentHTML('beforeend','<span class="portal-lock" aria-hidden="true"><i>🔒</i><b>'+esc(b.getAttribute('aria-label').split(' · ')[0])+'</b><small>เปิด '+clock(openAt(b.dataset.enterBiome))+'</small></span>');
    });
    scene.querySelectorAll('.is-next').forEach(b=>{b.classList.remove('is-next');b.querySelector('.next-flag')?.remove();});
    if(!objective)return;
    const target=scene.querySelector(selector(objective.target,objective));
    if(target){
      target.classList.add('is-next');
      target.insertAdjacentHTML('beforeend','<span class="next-flag" aria-hidden="true"><b>'+esc(flagText(objective))+'</b></span><span class="next-rings" aria-hidden="true"><i></i><i></i></span>');
    }
    if(objective.ready)scene.querySelector('.npc-character[data-quest]')?.classList.add('has-ready');
  }
  function flagText(o){
    if(o.target==='portal')return 'เริ่มที่นี่!';
    if(o.target==='village')return 'เคาะบ้านตรงนี้';
    if(o.target==='npc')return o.ready?'ส่งของ!':'คุยก่อน';
    if(o.target==='boss')return 'ท้าบอส!';
    if(o.target==='gate')return 'แตะเพื่อเข้า';
    if(String(o.target).startsWith('game:'))return 'เล่นตรงนี้';
    return 'ไปตรงนี้';
  }
  // แถบล่าง: บอกสิ่งเดียวที่ต้องทำ + ของที่ขาด + ปุ่มพาไป
  function bar(o,{duration,now}){
    if(!o||o.key==='gate')return '';
    const need=o.need.length?'<div class="obj-need">'+o.need.map(n=>'<span class="obj-slot'+(n.have>=n.need?' got':'')+'" data-need="'+esc(n.id)+'"><i>'+n.icon+'</i><small>'+(n.kind==='candy'?n.have+'/'+n.need:n.have+'/'+n.need)+'</small></span>').join('')+'</div>':'';
    const nowStep=o.steps?o.steps.findIndex(s=>s.state==='now'):-1;
    const wait=o.wait?' · เปิด '+clock(o.wait.at):'';
    const close=o.closesAt&&!o.wait?'<small class="obj-clock" data-closes-at="'+o.closesAt+'" title="ประตู'+esc(o.biomeName)+'ปิดใน">⏳ ปิดใน '+esc(duration(o.closesAt-now))+'</small>':'';
    const button=o.action.kind==='wait'?'<button class="obj-go wait" data-objective-go>'+esc(o.action.label)+wait+'</button>':'<button class="obj-go" data-objective-go>'+esc(o.action.label)+' ▶</button>';
    return '<section class="objective-bar'+(o.ready?' is-ready':'')+'" data-objective-key="'+esc(o.key)+'" aria-label="ภารกิจตอนนี้"><div class="obj-head"><span class="obj-eyebrow">ภารกิจตอนนี้'+(o.quest?' · '+esc(o.npc)+' เควส '+o.quest.order:'')+(nowStep>=0?' · ขั้น '+(nowStep+1)+'/'+o.steps.length:'')+'</span>'+close+'</div><div class="obj-main"><div class="obj-text"><h2>'+esc(o.title)+'</h2>'+(o.need.length?'':'<p>'+esc(o.detail)+'</p>')+'</div>'+need+'</div>'+button+'</section>';
  }
  return {decorate,bar,selector,flagText,clock};
});
