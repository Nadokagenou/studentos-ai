(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory(require('./npcs.js'));
  else root.HalloweenWorld=factory(root.HalloweenNPCs);
})(typeof globalThis==='undefined'?this:globalThis,NPCs=>{
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shorts=['dutchman','jack','vampire','graveyard'];
  const thai=['ท่าเรือผี','สวนฟักทอง','คฤหาสน์แวมไพร์','สุสานนิรันดร์'];
  const hint=['ตามแสงโคม ล่าสมบัติบนเรือที่ไม่เคยกลับฝั่ง','ถางเถาวัลย์ ปลูกสวน และฟังคำขอของ Jack','เปิดประตูคฤหาสน์ มองหารายละเอียดที่เปลี่ยนไป','ขุดหลุมศพ แล้วนำวิญญาณกลับมาก่อนหมดเวลา'];
  const portraits={hub:['portrait-hub.webp',0,0,1],dutchman:['portrait-biomes.webp',0,0,2],jack:['portrait-biomes.webp',1,0,2],vampire:['portrait-biomes.webp',0,1,2],graveyard:['portrait-biomes.webp',1,1,2],shop:['portrait-rooms.webp',0,0,2],cauldron:['portrait-rooms.webp',1,0,2],ritual:['portrait-rooms.webp',0,1,2],garden:['portrait-rooms.webp',1,1,2]};
  function spot(label,attrs,x,y,extra='',mobile=[x,y]){
    const activity=attrs.includes('data-game-info=');
    return '<button class="world-spot scene-point '+extra+(activity?' activity-point':'')+(x<20?' label-right':x>80?' label-left':'')+'" style="--x:'+x+'%;--y:'+y+'%;--px:'+mobile[0]+'%;--py:'+mobile[1]+'%" '+attrs+' aria-label="'+esc(label)+'"><span class="spot-dot" aria-hidden="true"></span><span class="spot-label">'+esc(label)+'</span></button>';
  }
  function scene(key,label,contents,extra=''){
    const p=portraits[key];
    return '<div class="scene-shell '+extra+'" style="--scene-art:url(assets/world-'+key+'.webp)"><div class="world-scene '+extra+'" style="--portrait-size:'+p[3]*100+'%;--portrait-left:'+(-p[1]*100)+'%;--portrait-top:'+(-p[2]*100)+'%"><picture class="scene-picture"><source media="(orientation:portrait)" srcset="assets/'+p[0]+'"><img class="scene-background" src="assets/world-'+key+'.webp" alt="'+esc(label)+'" fetchpriority="high"></picture><div class="scene-shade" aria-hidden="true"></div>'+contents+'<div class="scene-fog" aria-hidden="true"></div></div></div>';
  }
  function portrait(id){
    const npc=NPCs.characters[id];if(!npc)return '';
    return '<span class="npc-sprite" role="img" aria-label="'+esc(npc.name)+'" data-npc-sprite="'+id+'" style="--sprite-x:'+(npc.sprite%4*100/3)+'%;--sprite-y:'+(npc.sprite<4?0:100)+'%"></span>';
  }
  function weaponArt(type,color='#c7b3df'){
    const index={spear:0,axe:1,quill:2,scythe:3}[type]??0;
    return '<span class="weapon-sprite" aria-hidden="true" style="--weapon-x:'+index*100/3+'%"></span>';
  }
  function hero(c,weaponId=c.doc.event.equipment,practice=false){
    const status=c.Core.weaponStatus(c.doc,c.config,weaponId),w=status.usable||practice?status.weapon:null;
    return '<span class="hero-pixel" role="img" aria-label="นักผจญภัย'+(w?' ถือ '+esc(w.name):' ยังไม่มีอาวุธ')+'"><span class="rpg-sprite" aria-hidden="true" style="--atlas-x:'+(c.doc.event.secretEnding?100:0)+'%;--atlas-y:'+(c.doc.event.secretEnding?100:0)+'%"></span>'+(w?'<span class="hero-weapon" style="--weapon-color:'+w.color+'">'+weaponArt(w.type,w.color)+'</span>':'')+'</span>';
  }
  function player(c){return '<div class="world-player" aria-hidden="true">'+hero(c)+'</div>';}
  function npcSpot(id,attrs,x,y,mobile=[x,y]){
    const npc=NPCs.characters[id],label=attrs.includes('data-tutor')?'เวสเปอร์ · สอนเล่น':'คุยกับ '+npc.name;
    return '<button class="world-spot npc-character npc-spot'+(x<25?' label-right':x>75?' label-left':'')+'" style="--x:'+x+'%;--y:'+y+'%;--px:'+mobile[0]+'%;--py:'+mobile[1]+'%" '+attrs+' aria-label="'+esc(label)+'">'+portrait(id)+'<span class="spot-label">'+esc(label)+'</span></button>';
  }
  function shouldArm(){return false;}
  function activity(c,id){
    const {doc,config}=c,event=doc.event;
    const games={
      'ghost-ship-hunt':{name:'ล่าสมบัติเรือผี',description:'ใช้แสงโคมนำเรือฝ่าหมอก เลือกหน้า ซ้าย หรือขวาตามสัญญาณให้ถูก 6 ครั้ง ผิดหรือหมดเวลารวม 3 ครั้งเรือจะล่ม',instructions:'ชนะครั้งแรกได้ 35 Candy · เล่นซ้ำได้ Soul Anchor แต่ไม่รับ Candy เพิ่ม · เรือล่มซ่อมก่อนออกใหม่'},
      'clear-jacks-garden-vines':{name:'เคลียร์วัชพืชของ Jack',description:'จดจำลำดับเถาวัลย์แล้วแตะให้ครบ '+config.proposals.games.vines+' จุด เพื่อคืนแปลงปลูกให้ Jack · ขอคำใบ้ซ้ำได้',instructions:'ผ่านแล้วกลับไปส่งเควสกับ Jack เพื่อเปิดสวนทุกแปลง เล่นซ้ำได้ แต่ไม่ได้แปลงหรือเมล็ดเพิ่มจากการเล่นอย่างเดียว'},
      'dech-house-spot-difference':{name:'จับผิดภาพในคฤหาสน์',description:'เทียบภาพต้นฉบับกับภาพที่เปลี่ยนไป หาให้ครบ '+config.proposals.games.differences+' จุดภายใน '+config.proposals.games.differenceSeconds+' วินาที',instructions:'มือถือสลับภาพได้ ผ่านแล้วใช้ส่งเควสที่ 2 ของ Dech'},
      'grave-digging':{name:'ขุดหลุมศพ',description:'จับคู่สัญลักษณ์ใต้แผ่นหิน '+config.proposals.games.digSteps+' แผ่น เพื่อปลุกวิญญาณและผ่านบททดสอบแรกของ Win',instructions:'มีพลั่วจาก Win แล้วเปิดแผ่นหินหาสัญลักษณ์เหมือนกัน 4 คู่ · ไม่จับเวลา'},
      'catch-all-ghosts':{name:'จับผี',description:'จับวิญญาณให้ครบ '+config.proposals.games.ghostCount+' ดวงภายใน 30 วินาที เพื่อผ่านบททดสอบยามเฝ้าสุสาน',instructions:'เล่นขุดหลุมจบก่อน แล้วจับให้ครบทันเวลา · ผ่านแล้วใช้ส่งเควสที่ 2 ของ Win'}
    };
    if(!games[id])return null;
    const info={id,...games[id],complete:!!event.proofs[id]?.clear,locked:false};
    const lock=(reason,quest,game,repair=false)=>Object.assign(info,{locked:true,reason,quest,game,repair});
    if(id==='ghost-ship-hunt'){
      if(!event.inventory['spectral-lantern'])lock('ต้องมีโคมวิญญาณ · ได้จากเควสแรกของ Tang','dutchman-light-in-darkness');
      else if(event.repairs)lock('ซ่อมเรือ '+event.repairs+' Candy ก่อนออกเดินทาง',null,null,true);
    }
    if(id==='clear-jacks-garden-vines'&&event.quests['jack-clear-garden']?.phase!==1&&!event.quests['jack-clear-garden']?.complete)lock('ส่งฟักทองเน่า 2 ลูกให้ Jack ก่อน','jack-clear-garden');
    if(['grave-digging','catch-all-ghosts'].includes(id)){
      if(!event.quests['win-death-fragments']?.complete)lock('ต้องมีพลั่ว · ได้จากเควสแรกของ Win','win-death-fragments');
      else if(id==='catch-all-ghosts'&&!event.proofs['grave-digging']?.complete)lock('เล่นขุดหลุมให้จบก่อน แล้วค่อยมาจับผี',null,'grave-digging');
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
    return '<section class="world-page gate-page"><div class="world-title"><small>STUDENTOS · THE MIDNIGHT CHAPTER</small><h1>หลังประตูนี้… มีใครรออยู่</h1></div>'+scene('hub','ประตูรั้วหน้าโถงกลาง','<div class="iron-gate" aria-hidden="true"><i></i><i></i></div><button class="gate-enter" data-enter-hub><small>THE MIDNIGHT ACADEMY</small><b>เปิดประตู</b><span>แตะเพื่อเข้าโถงกลาง →</span></button>','entrance-scene')+'<p class="world-caption">เสียงบานพับเก่าดังขึ้นกลางหมอก คืนนี้เธอจะพบเรื่องราวอะไร</p></section>';
  }
  // ช่องประตูในภาพโถง [x0,y0,x1,y1] เป็นสัดส่วนของภาพ (24 ต.ค. 69 · เจ้าของ: กรอบประตูไม่ตรงซุ้มในภาพ)
  // เดิมคิดเป็นสูตร 23+i×13.3% กว้าง 12.6% สูง 28% — กว้างกว่าช่องจริง 4% เยื้องซ้าย 3% และสูงเกินยอดโค้ง
  // วัดด้วย devtools/hotspot-measure.html · ยอดซุ้มเป็นครึ่งวงกลม: รัศมีแนวตั้ง = ครึ่งความกว้าง (px) ÷ ความสูง (px)
  const HUB_GATES_LAND=[[.258,.182,.346,.405],[.388,.182,.475,.405],[.520,.182,.609,.405],[.651,.182,.738,.405]];
  const HUB_GATES_PORT=[[.260,.158,.444,.319],[.551,.158,.737,.319],[.260,.381,.444,.542],[.551,.381,.737,.542]];
  function gateBox(i){
    const pc=v=>+(v*100).toFixed(2)+'%',L=HUB_GATES_LAND[i],P=HUB_GATES_PORT[i],arch=(b,w,h)=>pc((b[2]-b[0])*w/2/((b[3]-b[1])*h));
    return '--left:'+pc(L[0])+';--top:'+pc(L[1])+';--w:'+pc(L[2]-L[0])+';--h:'+pc(L[3]-L[1])+';--arch:'+arch(L,1536,1024)+
      ';--px:'+pc(P[0])+';--py:'+pc(P[1])+';--pw:'+pc(P[2]-P[0])+';--ph:'+pc(P[3]-P[1])+';--parch:'+arch(P,941,1672);
  }
  function hub(c){
    const {Core,Catalog,config,doc,now}=c, active=Core.biomeAt(doc,config,now).id;
    const portals=Core.BIOMES.map((id,i)=>{
      const status=Core.portalStatus(doc,config,id,now),open=status.open;
      const progress=Core.biomeProgress(doc,config,id);
      return '<button class="world-portal '+(open?'portal-open':'portal-closed')+'" data-enter-biome="'+id+'" style="'+gateBox(i)+';--portal-color:'+Catalog.biomes[shorts[i]].color+'" aria-label="'+thai[i]+' · '+(open?'เปิดอยู่':'เปิด '+new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}).format(Core.Rotations.next(Core.moment(doc,now),i)))+'"><span class="portal-number" aria-hidden="true">'+(i+1)+'</span><span class="portal-label"><b>'+thai[i]+'</b><small>'+(open?'✦ เปิดอยู่':'◈ รอรอบถัดไป')+'</small><small>เส้นทาง '+progress.percent+'% · '+progress.value+'/'+progress.total+'</small></span><span class="portal-progress" aria-hidden="true"><i style="width:'+progress.percent+'%"></i></span></button>';
    }).join('');
    return '<section class="world-page"><div class="world-title"><small>THE MIDNIGHT ACADEMY</small><h1>โถงกลาง</h1><p class="journey-note">ประตูสุ่มเปลี่ยนทุก 1 ชั่วโมง · ดูตารางในสมุด</p></div>'+scene('hub','โถงกลางพิกเซล ร้านค้าซ้าย เตาผสมขวา และประตูสี่ไบโอมด้านหน้า',portals+npcSpot('vesper','data-tutor',30,76,[33,80])+spot('ร้านยามเที่ยงคืน','data-route="shop"',12,60,'',[17,62])+spot('เตาผสมเวทมนตร์','data-route="cauldron"',87,60,'',[84,68])+spot('วงเวทอัญเชิญ','data-route="ritual"',50,72,'',[51,76])+spot('สวนรัตติกาล','data-route="garden"',33,82,'',[78,73]))+'<div class="world-caption"><button class="quiet-button" data-route="totems">Totem · เปิดทางส่วนตัว</button></div><p class="scene-help">แตะป้ายเพื่อเข้าไปดู · ป้ายทองคือจุดที่ควรไปตอนนี้</p></section>';
  }
  function biome(c){
    const {Core,Catalog,config,doc,now}=c, id=Core.biomeAt(doc,config,now).id, i=Core.BIOMES.indexOf(id), meta=Catalog.biomes[shorts[i]];
    const quests=config.quests.filter(q=>q.biome===id), q=quests.find(q=>!doc.event.quests[q.id]?.complete)||quests.at(-1);
    const npc=npcSpot(NPCs.biomeCharacters[i],'data-quest="'+q.id+'"',i===0?23:i===1?80:i===2?21:81,i===2?76:75,[[24,79],[76,79],[25,79],[78,79]][i]);
    const games=[['ล่าสมบัติเรือผี','ghost-ship-hunt',73,33],['เคลียร์วัชพืช','clear-jacks-garden-vines',23,63],['จับผิดภาพในคฤหาสน์','dech-house-spot-difference',71,39],['ขุดหลุมศพ','grave-digging',26,65]][i];
    const gameAttrs='data-game-info="'+games[1]+'"',gameLabel=games[0];
    const ghostAttrs='data-game-info="catch-all-ghosts"';
    const boss=Object.entries(config.proposals.bosses||{}).find(([,b])=>b.biome===id),bossReady=boss&&doc.event.quests[boss[1].quest]?.complete;
    const visitorX=i%2===0?84:18;
    const extra=(i===3?spot('จับผี',ghostAttrs,78,35,'',[79,31]):'')+spot('นักเดินทางนิรนาม · แลกของเป็น Candy','data-visitors',visitorX,84,'',[visitorX,78])+spot('หาของ · เคาะบ้าน','data-route="village"',12,35,'village-sign',[15,30])+player(c)+(bossReady?spot((doc.event.bossWins?.[boss[0]]?'✓ พิชิตแล้ว · ':'ท้าบอส · ')+boss[1].name,'data-boss="'+boss[0]+'"',48,48,'boss-sign',[50,50]):'');
    return '<section class="world-page"><div class="world-title"><small>'+esc(meta.name)+'</small><h1>'+thai[i]+'</h1>'+(c.difficulty?.[id]?'<button class="biome-level" data-open-balance>ความยาก '+esc(c.difficulty[id])+' · ดูเกณฑ์</button>':'')+'</div>'+scene(shorts[i],thai[i],npc+spot(gameLabel,gameAttrs,games[2],games[3],'',[[72,42],[25,51],[70,41],[27,59]][i])+extra+spot('กลับไปปลูกที่สวนรัตติกาล','data-route="garden"',i===1?57:53,82,'',[56,71])+spot('อ่านเรื่องราวอีกครั้ง','data-story="'+id+'"',90,18,'',[88,35])+(i===0&&doc.event.repairs?spot('ซ่อมเรือ · '+doc.event.repairs+' Candy','data-action="repair"',62,57):''))+'</section>';
  }
  function cropState(c,id){
    const {Core,config,doc,now}=c,i=Core.BIOMES.indexOf(id),crop=config.proposals.crops[id];
    const g=(i===1?doc.event.garden:doc.event.gardens?.[id])||{plantedAt:null,watered:false};
    const planted=g.plantedAt!=null,until=planted?g.plantedAt+config.proposals.garden.growthMs:null;
    return {id,index:i,crop,g,planted,until,ready:planted&&g.watered&&Core.moment(doc,now)>=until,unlocked:Core.gardenUnlocked(doc),seeds:doc.event.inventory[crop.seed]||0,harvested:Math.min(doc.event.grown[crop.harvest]||0,doc.event.inventory[crop.harvest]||0)};
  }
  // กรอบแปลงในสวน = กรอบไม้ในภาพจริง (24 ต.ค. 69 · เจ้าของ: "ให้มันตรงกรอบ แก้ทุกอัน")
  // เดิมกะเป็นเปอร์เซ็นต์ของจอ — แนวนอนเยื้อง · แนวตั้งใช้ขนาดตายตัว 37%×16% ไม่ผ่านการครอปของภาพแนวตั้ง จึงเยื้องหนัก
  // ตอนนี้วัดจากพิกเซลของภาพ [x0,y0,x1,y1] (สัดส่วน 0–1) · ภาพแนวนอนยืดเต็มฉาก และภาพแนวตั้ง (มุมขวาล่างของ portrait-rooms.webp
  // ขยาย 200% เลื่อน −100%) ก็เต็มฉากพอดี → สัดส่วนบนภาพ = สัดส่วนบนฉาก ใช้ตรง ๆ ได้ทั้งสองแบบ
  // แปลงเป็นสี่เหลี่ยมคางหมู: ขอบด้านทางเดินตั้งตรง ขอบด้านนอกเอียง ~20% → --tl/--tr ใช้ตัดแสงไฮไลต์ให้ตรงรูปแปลง
  const GARDEN_BEDS_LAND=[[.197,.485,.465,.600],[.521,.485,.795,.600],[.092,.636,.456,.808],[.537,.636,.903,.808]];
  const GARDEN_BEDS_PORT=[[.093,.461,.451,.556],[.513,.461,.878,.558],[.007,.586,.442,.722],[.524,.586,.996,.722]];
  function bedBox(i){
    const pc=v=>+(v*100).toFixed(2)+'%',L=GARDEN_BEDS_LAND[i],P=GARDEN_BEDS_PORT[i];
    return '--x:'+pc((L[0]+L[2])/2)+';--y:'+pc((L[1]+L[3])/2)+';--bed-width:'+pc(L[2]-L[0])+';--bed-height:'+pc(L[3]-L[1])+
      ';--px:'+pc((P[0]+P[2])/2)+';--py:'+pc((P[1]+P[3])/2)+';--pbw:'+pc(P[2]-P[0])+';--pbh:'+pc(P[3]-P[1])+(i%2?';--tr:20%':';--tl:20%');
  }
  function garden(c){
    const {Core}=c;
    const beds=Core.BIOMES.map((id,i)=>{
      const s=cropState(c,id),state=!s.unlocked?'รอเปิดแปลง':!s.planted?'แปลงว่าง':s.ready?'เก็บเกี่ยวได้':!s.g.watered?'รอรดน้ำ':'กำลังเติบโต';
      return '<button class="garden-bed '+(s.ready?'crop-ready':s.planted?'crop-growing':'crop-empty')+'" data-plot-biome="'+id+'" data-until="'+(s.until||'')+'" style="'+bedBox(i)+'" aria-label="แปลง'+s.crop.name+' · '+state+'"><span class="bed-plants" aria-hidden="true">'+(s.planted?Array.from({length:3},()=>'<span>'+pixelCrop(i)+'</span>').join(''):'<i>✧</i>')+'</span><span class="spot-label">'+s.crop.name+'<small>'+state+'</small></span></button>';
    }).join('');
    return '<section class="world-page"><div class="world-title"><small>THE MIDNIGHT GARDEN</small><h1>สวนรัตติกาล</h1></div>'+scene('garden','สวนรัตติกาล แปลงปลูกสี่ชนิดแยกจากไบโอม',beds,'garden-zone')+'<p class="scene-help">ทำเควสรับเมล็ด → เลือกแปลงปลูก → เก็บผลผลิตไปขายกับมอร์โรในร้าน</p></section>';
  }
  function village(c){
    const {Core,config,doc,now,duration}=c,id=Core.biomeAt(doc,config,now).id,k=c.knock||{},choice=k.choice==='trick'?'trick':'treat';
    const need=(k.need||[]).filter(n=>n.kind==='item');
    // หัวหมู่บ้าน: กำลังหาอะไรให้ใคร + ตัวนับของขวัญนักเดินทาง (ครบ 30 บ้านได้ของที่ขาด)
    const head='<div class="village-hunt">'+(need.length?'<div class="hunt-copy"><small>กำลังหาให้ '+esc(k.npc||'')+'</small><b>'+need.map(n=>esc(n.name)).join(' · ')+'</b></div><div class="obj-need">'+need.map(n=>'<span class="obj-slot'+(n.have>=n.need?' got':'')+'" data-need="'+esc(n.id)+'"><i>'+n.icon+'</i><small>'+n.have+'/'+n.need+'</small></span>').join('')+'</div>':'<div class="hunt-copy"><small>หมู่บ้านใน'+thai[Core.BIOMES.indexOf(id)]+'</small><b>เคาะบ้านรับ Candy และลุ้นวัตถุดิบ</b></div>')+'</div>'+
      (k.aid?'<div class="aid-meter"><span>🎁 ของขวัญนักเดินทาง</span><progress value="'+k.aid.visits+'" max="'+k.aid.target+'" aria-label="เคาะบ้านสะสมในไบโอมนี้"></progress><b>'+k.aid.visits+'/'+k.aid.target+'</b><small>เคาะครบ '+k.aid.target+' ครั้งในไบโอมนี้ รับของที่เควสยังขาด 1 ชิ้น</small></div>':'');
    const mode='<div class="knock-mode" role="radiogroup" aria-label="วิธีเคาะ"><button role="radio" aria-checked="'+(choice==='treat')+'" data-knock-choice="treat"><b>🍬 Treat</b><small>ได้ 10 ชัวร์ + ลุ้นของ</small></button><button role="radio" aria-checked="'+(choice==='trick')+'" data-knock-choice="trick"><b>🎲 Trick</b><small>เสี่ยง 20 หรือ 0</small></button></div>';
    return head+mode+'<p class="knock-tip">แตะบ้านเพื่อเคาะทันที</p><section class="village-lane">'+Array.from({length:5},(_,n)=>{
      const a=Core.houseAvailability(doc,config,n+1,now),at=Core.moment(doc,now),wait=a.availableAt;
      return '<button class="village-door" data-knock="'+(n+1)+'" '+(!a.ready||doc.event.closed?'disabled':'')+' aria-label="เคาะบ้าน '+(n+1)+'">'+houseArt(n)+'<b>บ้าน '+(n+1)+'</b><small data-house-status="'+(n+1)+'">'+(a.ready?'เคาะประตู':(a.remaining===0?'เปิดได้เร็วสุดอีก ':'เปิดอีก ')+duration(wait-at))+'</small></button>';
    }).join('')+'</section><p class="tiny">บ้านที่เคาะแล้วพัก 4 ชั่วโมง แยกแต่ละหลังและไบโอม · รับ Candy จากบ้านได้ 300 ต่อ 24 ชั่วโมง</p><p class="subtle" data-house-limit></p><button class="secondary" data-open-balance>ดูโอกาสได้ของและความยาก</button>';
  }
  function houseArt(index=0){
    const wall=['#4b5c67','#685844','#5a4d66','#4e665e','#6b4b50'][index%5];
    return '<svg class="village-house-art" viewBox="0 0 96 110" shape-rendering="crispEdges" aria-hidden="true"><path d="M12 40h72v64H12z" fill="'+wall+'"/><path d="M4 42v-8h8v-8h8v-8h8v-8h40v8h8v8h8v8h8v8z" fill="#242f44" stroke="#8294a1" stroke-width="2"/><path d="M68 4h10v25H68z" fill="#485565"/><path d="M20 50h17v24H20zm39 0h17v24H59z" fill="#d2ac68" stroke="#29333e" stroke-width="3"/><path d="M28 50v24m40-24v24M20 62h17m22 0h17" stroke="#4e493d" stroke-width="2"/><path class="house-door-leaf" d="M39 66h18v38H39z" fill="#302c2c" stroke="#a18b62" stroke-width="2"/><path d="M39 80h18m-9-14v38" stroke="#5c5041" stroke-width="2"/><path d="M52 84h3v3h-3z" fill="#d45452"/><path d="M8 104h80v5H8z" fill="#84939d"/></svg>';
  }
    return {gate,hub,biome,garden,room,portrait,hero,weaponArt,player,pixelCrop,houseArt,cropState,shouldArm,activity,village,thai,portraits};
});
