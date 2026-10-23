(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./npcs.js'));
  else root.HalloweenWorld=factory(root.HalloweenNPCs);
})(typeof globalThis==='undefined'?this:globalThis,NPCs=>{
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shorts=['dutchman','jack','vampire','graveyard'];
  const thai=['ท่าเรือผี','สวนฟักทอง','คฤหาสน์แวมไพร์','สุสานนิรันดร์'];
  const hint=['ตามแสงโคม ล่าสมบัติบนเรือที่ไม่เคยกลับฝั่ง','ถางเถาวัลย์ ปลูกสวน และฟังคำขอของ Jack','เปิดประตูคฤหาสน์ มองหารายละเอียดที่เปลี่ยนไป','ขุดหลุมศพ แล้วนำวิญญาณกลับมาก่อนหมดเวลา'];
  const portraits={hub:['portrait-hub.png',0,0,1],dutchman:['portrait-biomes.png',0,0,2],jack:['portrait-biomes.png',1,0,2],vampire:['portrait-biomes.png',0,1,2],graveyard:['portrait-biomes.png',1,1,2],shop:['portrait-rooms.png',0,0,2],cauldron:['portrait-rooms.png',1,0,2],ritual:['portrait-rooms.png',0,1,2],garden:['portrait-rooms.png',1,1,2]};
  function spot(label,attrs,x,y,extra='',mobile=[x,y]){
    const activity=attrs.includes('data-game-info=');
    return '<button class="world-spot scene-point '+extra+(activity?' activity-point':'')+(x<20?' label-right':x>80?' label-left':'')+'" style="--x:'+x+'%;--y:'+y+'%;--px:'+mobile[0]+'%;--py:'+mobile[1]+'%" '+attrs+' aria-label="'+esc(label)+'"><span class="spot-dot" aria-hidden="true">'+(activity?'▶':'?')+'</span>'+(activity?'<span class="spot-kind" aria-hidden="true">มินิเกม</span>':'')+'<span class="spot-label">'+esc(label)+'</span></button>';
  }
  function scene(key,label,contents,extra=''){
    const p=portraits[key];
    return '<div class="scene-shell '+extra+'" style="--scene-art:url(assets/world-'+key+'.png)"><div class="world-scene '+extra+'" style="--portrait-size:'+p[3]*100+'%;--portrait-left:'+(-p[1]*100)+'%;--portrait-top:'+(-p[2]*100)+'%"><picture class="scene-picture"><source media="(orientation:portrait)" srcset="assets/'+p[0]+'"><img class="scene-background" src="assets/world-'+key+'.png" alt="'+esc(label)+'" fetchpriority="high"></picture><div class="scene-shade" aria-hidden="true"></div>'+contents+'<div class="scene-fog" aria-hidden="true"></div></div></div>';
  }
  function portrait(id){
    const npc=NPCs.characters[id];if(!npc)return '';
    return '<span class="npc-sprite" role="img" aria-label="'+esc(npc.name)+'" data-npc-sprite="'+id+'" style="--sprite-x:'+(npc.sprite%4*100/3)+'%;--sprite-y:'+(npc.sprite<4?0:100)+'%"></span>';
  }
  function weaponArt(type,color='#c7b3df'){
    const index={spear:0,axe:1,quill:2,scythe:3}[type]??0;
    return '<span class="weapon-sprite" aria-hidden="true" style="--weapon-x:'+index*100/3+'%"></span>';
  }
  function hero(c,weaponId=c.doc.event.equipment){
    const status=c.Core.weaponStatus(c.doc,c.config,weaponId),w=status.usable?status.weapon:null;
    return '<span class="hero-pixel" role="img" aria-label="นักผจญภัย'+(w?' ถือ '+esc(w.name):' ยังไม่มีอาวุธ')+'"><span class="rpg-sprite" aria-hidden="true" style="--atlas-x:'+(c.doc.event.secretEnding?100:0)+'%;--atlas-y:'+(c.doc.event.secretEnding?100:0)+'%"></span>'+(w?'<span class="hero-weapon" style="--weapon-color:'+w.color+'">'+weaponArt(w.type,w.color)+'</span>':'')+'</span>';
  }
  function player(c){return '<div class="world-player" aria-hidden="true">'+hero(c)+'</div>';}
  function npcSpot(id,attrs,x,y,mobile=[x,y]){
    const npc=NPCs.characters[id];
    return '<button class="world-spot npc-character npc-spot'+(x<25?' label-right':x>75?' label-left':'')+'" style="--x:'+x+'%;--y:'+y+'%;--px:'+mobile[0]+'%;--py:'+mobile[1]+'%" '+attrs+' aria-label="คุยกับ '+esc(npc.name)+'">'+portrait(id)+'<span class="spot-label">คุยกับ '+esc(npc.name)+'</span></button>';
  }
  function shouldArm({pointerType,detail,armed,labelVisible=false,markerVisible=false}){return detail!==0&&['touch','pen'].includes(pointerType)&&!armed&&!labelVisible&&!markerVisible;}
  function activity(c,id){
    const {doc,config}=c,event=doc.event;
    const games={
      'ghost-ship-hunt':{name:'ล่าสมบัติเรือผี',description:'ใช้แสงโคมนำเรือฝ่าหมอก เลือกหน้า ซ้าย หรือขวาตามสัญญาณให้ถูก 6 ครั้ง ผิดหรือหมดเวลารวม 3 ครั้งเรือจะล่ม',instructions:'แต่ละช่วงมีเวลา 15 → 5 วินาที ผ่านแล้วได้ Candy และ Soul Anchor ถ้าเรือล่มต้องซ่อมก่อนออกใหม่'},
      'clear-jacks-garden-vines':{name:'เคลียร์วัชพืชของ Jack',description:'ตัดเถาวัลย์ตามลำดับที่ส่องสัญญาณจนครบ '+config.proposals.games.vines+' จุด เพื่อคืนแปลงปลูกให้ Jack',instructions:'ผ่านแล้วกลับไปส่ง Jack Q1 เพื่อเปิดสวนทุกแปลง เล่นซ้ำได้ แต่ไม่รับ Plot หรือเมล็ดซ้ำจากการเล่นอย่างเดียว'},
      'dech-house-spot-difference':{name:'จับผิดภาพในคฤหาสน์',description:'เทียบภาพต้นฉบับกับภาพที่เปลี่ยนไป หาให้ครบ '+config.proposals.games.differences+' จุดภายใน '+config.proposals.games.differenceSeconds+' วินาที',instructions:'มือถือสลับภาพได้ ผลผ่านใช้ส่ง Dech Q2'},
      'grave-digging':{name:'ขุดหลุมศพ',description:'ขุดตามจุดที่มีสัญญาณจนครบ '+config.proposals.games.digSteps+' ชั้น เพื่อปลุกวิญญาณและผ่านบททดสอบแรกของ Win',instructions:'รับพลั่วจาก Win Q1 ก่อน ผลเกมใช้ส่งเควส ไม่ได้รับ Human Bone หรือ Human Skull จากเกมนี้ ของสองชิ้นนั้นสุ่มจากการเคาะบ้าน'},
      'catch-all-ghosts':{name:'จับผี',description:'จับวิญญาณให้ครบ '+config.proposals.games.ghostCount+' ดวงภายใน 30 วินาที เพื่อผ่านบททดสอบยามเฝ้าสุสาน',instructions:'ผ่านขุดหลุมศพก่อน แล้วจับทุกดวงให้ทันเวลา ผลผ่านใช้ส่ง Win Q2'}
    };
    if(!games[id])return null;
    const info={id,...games[id],complete:!!event.proofs[id]?.clear,locked:false};
    const lock=(reason,quest,game,repair=false)=>Object.assign(info,{locked:true,reason,quest,game,repair});
    if(id==='ghost-ship-hunt'){
      if(!event.inventory['spectral-lantern'])lock('รับ Spectral Lantern จาก Tang Q1 ก่อน','dutchman-light-in-darkness');
      else if(event.repairs)lock('ซ่อมเรือ '+event.repairs+' Candy ก่อนออกเดินทาง',null,null,true);
    }
    if(id==='clear-jacks-garden-vines'&&event.quests['jack-clear-garden']?.phase!==1&&!event.quests['jack-clear-garden']?.complete)lock('ส่ง Rotten Pumpkin 2 ชิ้นให้ Jack ในเฟสแรกก่อน','jack-clear-garden');
    if(['grave-digging','catch-all-ghosts'].includes(id)){
      if(!event.quests['win-death-fragments']?.complete)lock('จบ Win Q1 เพื่อรับพลั่วก่อน','win-death-fragments');
      else if(id==='catch-all-ghosts'&&!event.proofs['grave-digging']?.complete)lock('เล่นขุดหลุมศพให้จบก่อน แล้วกลับมาจับผี',null,'grave-digging');
    }
    return info;
  }
  function room(c,id){
    const meta=NPCs.rooms[id],npc=meta.npc;
    const positions={shop:[55,82],cauldron:[32,78],ritual:[79,76]};
    const p=positions[id],mobile={shop:[53,78],cauldron:[26,78],ritual:[79,79]}[id],props=id==='shop'?spot('คุยกับพ่อค้า · ขายผลผลิต','data-npc="morro" data-topic="garden"',20,46,'',[17,49])+spot('ตู้สินค้า','data-npc="morro"',87,51,'',[84,46]):id==='cauldron'?spot('เตาผสมของมอรา','data-npc="mora"',78,58,'',[79,56]):spot('วงเวทอัญเชิญ','data-npc="vesper"',48,65,'',[47,69]);
    return '<section class="world-page room-page"><div class="world-title"><small>THE MIDNIGHT ACADEMY</small><h1>'+meta.name+'</h1></div>'+scene(id,meta.name,npcSpot(npc,'data-npc="'+npc+'"',p[0],p[1],mobile)+props+player(c)+(id==='ritual'?spot('บัลลังก์เที่ยงคืน','data-boss-list',68,35,'boss-sign',[70,37]):''),'room-scene room-'+id)+'<p class="scene-help">ชี้หรือแตะบริเวณที่สนใจเพื่อดูชื่อ · คลิกตัวละครเพื่อคุย</p></section>';
  }
  function pixelCrop(index){
    const stem='<path d="M7 11h2v12H7zM3 16h4v2H3zM9 14h4v2H9z" fill="#547c67"/>';
    const forms=[
      '<path d="M4 23V9h2v14zm4 0V3h2v20zm4 0V7h2v16zM2 8h4v4H2zM8 2h4v4H8zM12 6h4v4h-4z" fill="#73b3a3"/><path d="M8 3h2v6H8zM4 10h2v6H4z" fill="#b4d2bf"/>',
      '<path d="M3 11h10v2h2v7h-2v2H3v-2H1v-7h2z" fill="#bd713e"/><path d="M6 10h4v13H6z" fill="#dc9652"/><path d="M7 7h2v4H7zM9 6h3v2H9z" fill="#718163"/>',
      stem+'<path d="M4 3h8v2h2v6h-2v2H4v-2H2V5h2z" fill="#923f54"/><path d="M5 4h6v2H7v3h4v2H5z" fill="#d57a83"/>',
      stem+'<path d="M6 1h4v4h4v4h-4v4H6V9H2V5h4z" fill="#a9a3ca"/><path d="M6 5h4v4H6z" fill="#dbd5a8"/>'
    ];
    return '<svg viewBox="0 0 16 24" shape-rendering="crispEdges" aria-hidden="true">'+forms[index]+'</svg>';
  }
  function gate(){
    return '<section class="world-page gate-page"><div class="world-title"><small>STUDENTOS · THE MIDNIGHT CHAPTER</small><h1>หลังประตูนี้… มีใครรออยู่</h1></div>'+scene('hub','ประตูรั้วหน้าโถงกลาง','<div class="iron-gate" aria-hidden="true"><i></i><i></i></div><button class="gate-enter" data-enter-hub><small>THE MIDNIGHT ACADEMY</small><b>เปิดประตู</b><span>คลิกเพื่อเข้าสู่โถงกลาง →</span></button>','entrance-scene')+'<p class="world-caption">เสียงบานพับเก่าดังขึ้นกลางหมอก คืนนี้เธอจะพบเรื่องราวอะไร</p></section>';
  }
  function hub(c){
    const {Core,Catalog,config,doc,now}=c, active=Core.biomeAt(doc,config,now).id;
    const portals=Core.BIOMES.map((id,i)=>{
      const open=Core.portalStatus(doc,config,id,now).open;
      return '<button class="world-portal '+(open?'portal-open':'portal-closed')+'" data-enter-biome="'+id+'" style="--left:'+(23+i*13.3)+'%;--px:'+(i%2?55:23)+'%;--py:'+(i<2?15:36)+'%;--pw:24%;--ph:'+(i<2?17:19)+'%;--portal-color:'+Catalog.biomes[shorts[i]].color+'" aria-label="'+thai[i]+' · '+(open?'เปิดเข้าได้':'ยังไม่เปิด')+'"><span class="portal-number" aria-hidden="true">'+(i+1)+'</span><span class="portal-label"><b>'+thai[i]+'</b><small>'+(open?'✦ เปิดเข้าได้':'◈ ยังไม่เปิด')+'</small></span></button>';
    }).join('');
    return '<section class="world-page"><div class="world-title"><small>THE MIDNIGHT ACADEMY</small><h1>โถงกลาง</h1></div>'+scene('hub','โถงกลางพิกเซล ร้านค้าซ้าย เตาผสมขวา และประตูสี่ไบโอมด้านหน้า',portals+spot('ร้านยามเที่ยงคืน','data-route="shop"',12,60,'',[16,68])+spot('เตาผสมเวทมนตร์','data-route="cauldron"',87,60,'',[84,68])+spot('วงเวทอัญเชิญ','data-route="ritual"',50,72,'',[50,76])+spot('สวนรัตติกาล','data-route="garden"',33,82,'',[22,80]))+'<div class="world-caption"><button class="quiet-button" data-route="totems">Totem · เปิดเส้นทางส่วนตัว</button></div><p class="scene-help">แตะหมุด ? เพื่อดูสถานที่ · หมุด ▶ คือมินิเกม</p></section>';
  }
  function biome(c){
    const {Core,Catalog,config,doc,now}=c, id=Core.biomeAt(doc,config,now).id, i=Core.BIOMES.indexOf(id), meta=Catalog.biomes[shorts[i]];
    const quests=config.quests.filter(q=>q.biome===id), q=quests.find(q=>!doc.event.quests[q.id]?.complete)||quests.at(-1);
    const npc=npcSpot(NPCs.biomeCharacters[i],'data-quest="'+q.id+'"',i===0?23:i===1?80:i===2?21:81,i===2?76:75,[[24,79],[76,79],[25,79],[78,79]][i]);
    const games=[['ล่าสมบัติเรือผี','ghost-ship-hunt',73,33],['เคลียร์วัชพืช','clear-jacks-garden-vines',23,63],['จับผิดภาพในคฤหาสน์','dech-house-spot-difference',71,39],['ขุดหลุมศพ','grave-digging',26,65]][i];
    const gameAttrs='data-game-info="'+games[1]+'"',gameLabel=games[0];
    const ghostAttrs='data-game-info="catch-all-ghosts"';
    const boss=Object.entries(config.proposals.bosses||{}).find(([,b])=>b.biome===id),bossReady=boss&&doc.event.quests[boss[1].quest]?.complete;
    const extra=(i===3?spot('จับผี',ghostAttrs,74,34,'',[70,35]):'')+spot('นักเดินทาง','data-visitors',28,84,'',[43,82])+spot('หาของ · เคาะบ้าน','data-route="village"',12,35,'village-sign',[15,30])+player(c)+(bossReady?spot((doc.event.bossWins?.[boss[0]]?'✓ พิชิตแล้ว · ':'ท้าบอส · ')+boss[1].name,'data-boss="'+boss[0]+'"',48,48,'boss-sign',[50,50]):'');
    return '<section class="world-page"><div class="world-title"><small>'+esc(meta.name)+'</small><h1>'+thai[i]+'</h1>'+(c.difficulty?.[id]?'<button class="biome-level" data-open-balance>ความยาก '+esc(c.difficulty[id])+' · ดูเกณฑ์</button>':'')+'</div>'+scene(shorts[i],thai[i],npc+spot(gameLabel,gameAttrs,games[2],games[3],'',[[72,42],[25,51],[70,41],[27,59]][i])+extra+spot('กลับไปปลูกที่สวนรัตติกาล','data-route="garden"',i===1?57:53,82,'',[82,82])+spot('อ่านเรื่องราวอีกครั้ง','data-story="'+id+'"',90,18,'',[88,35])+(i===0&&doc.event.repairs?spot('ซ่อมเรือ · '+doc.event.repairs+' Candy','data-action="repair"',62,57):''))+'</section>';
  }
  function cropState(c,id){
    const {Core,config,doc,now}=c,i=Core.BIOMES.indexOf(id),crop=config.proposals.crops[id];
    const g=(i===1?doc.event.garden:doc.event.gardens?.[id])||{plantedAt:null,watered:false};
    const planted=g.plantedAt!=null,until=planted?g.plantedAt+config.proposals.garden.growthMs:null;
    return {id,index:i,crop,g,planted,until,ready:planted&&g.watered&&Core.moment(doc,now)>=until,unlocked:Core.gardenUnlocked(doc),seeds:doc.event.inventory[crop.seed]||0,harvested:Math.min(doc.event.grown[crop.harvest]||0,doc.event.inventory[crop.harvest]||0)};
  }
  function garden(c){
    const {Core}=c;
    const beds=Core.BIOMES.map((id,i)=>{
      const s=cropState(c,id),state=!s.unlocked?'รอเปิดแปลง':!s.planted?'แปลงว่าง':s.ready?'เก็บเกี่ยวได้':!s.g.watered?'รอรดน้ำ':'กำลังเติบโต';
      return '<button class="garden-bed '+(s.ready?'crop-ready':s.planted?'crop-growing':'crop-empty')+'" data-plot-biome="'+id+'" data-until="'+(s.until||'')+'" style="--x:'+(i<2?(i%2?67:33):(i%2?73:28))+'%;--y:'+(i<2?54:73)+'%;--px:'+(i%2?72:28)+'%;--py:'+(i<2?45:66)+'%;--bed-width:'+(i<2?27:36)+'%;--bed-height:'+(i<2?13:17)+'%" aria-label="แปลง'+s.crop.name+' · '+state+'"><span class="bed-plants" aria-hidden="true">'+(s.planted?Array.from({length:3},()=>'<span>'+pixelCrop(i)+'</span>').join(''):'<i>✧</i>')+'</span><span class="spot-label">'+s.crop.name+'<small>'+state+'</small></span></button>';
    }).join('');
    return '<section class="world-page"><div class="world-title"><small>THE MIDNIGHT GARDEN</small><h1>สวนรัตติกาล</h1></div>'+scene('garden','สวนรัตติกาล แปลงปลูกสี่ชนิดแยกจากไบโอม',beds,'garden-zone')+'<p class="scene-help">ทำเควสรับเมล็ด → เลือกแปลงปลูก → เก็บผลผลิตไปขายกับมอร์โรในร้าน</p></section>';
  }
  function village(c){
    const {Core,config,doc,now,duration}=c,id=Core.biomeAt(doc,config,now).id;
    return '<p class="village-intro">หมู่บ้านใน'+thai[Core.BIOMES.indexOf(id)]+' · แหล่งวัตถุดิบส่งเควส</p><p class="subtle">แนะนำ Treat: รับ 10 Candy และมีสิทธิ์สุ่มของ 60% ส่วน Trick ลุ้น 20/0 Candy ถ้าได้ 0 จะไม่ได้วัตถุดิบ ของที่สุ่มอาจไม่ใช่ชิ้นที่ต้องการ</p><section class="village-lane">'+Array.from({length:5},(_,n)=>{
      const a=Core.houseAvailability(doc,config,n+1,now),at=Core.moment(doc,now),wait=a.availableAt;
      return '<button class="village-door" data-knock="'+(n+1)+'" '+(!a.ready||doc.event.closed?'disabled':'')+'><span aria-hidden="true">⌂</span><b>บ้าน '+(n+1)+'</b><small data-house-status="'+(n+1)+'">'+(a.ready?'เคาะประตู':(a.remaining===0?'เปิดได้เร็วสุดอีก ':'เปิดอีก ')+duration(wait-at))+'</small></button>';
    }).join('')+'</section><p class="tiny">บ้านที่เคาะแล้วพัก 4 ชั่วโมง แยกแต่ละหลังและไบโอม · เพดานนับย้อนหลัง 24 ชั่วโมง</p><p class="subtle" data-house-limit></p><button class="secondary" data-open-balance>ดูโอกาสได้ของและความยาก</button>';
  }
    return {gate,hub,biome,garden,room,portrait,hero,weaponArt,player,cropState,shouldArm,activity,village,thai,portraits};
});
