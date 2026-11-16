/* ภารกิจตอนนี้: ตอบคำถามเดียวว่า "ตอนนี้ควรทำอะไร" จากเซฟผู้เล่น — ทุกจอ (แถบล่าง ไฟนำทาง คู่มือ) อ่านจากที่นี่ที่เดียว
   ไม่เปลี่ยนข้อมูลผู้เล่น · ไม่แตะ DOM · รันใน node ได้ */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenObjective=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const HOUR=3600000,SLOT=6*HOUR,BKK=7*HOUR;
  const THAI=['ท่าเรือผี','สวนฟักทอง','คฤหาสน์แวมไพร์','สุสานนิรันดร์'];
  const NPC=['Tang','Jack','Dech','Win'];
  const NPC_ID=['tang','jack','dech','win'];
  const GAME_NAMES={'ghost-ship-hunt':'ล่าสมบัติเรือผี','clear-jacks-garden-vines':'เคลียร์วัชพืช','dech-house-spot-difference':'จับผิดภาพ','grave-digging':'ขุดหลุมศพ','catch-all-ghosts':'จับผี'};
  const GAME_BIOME={'ghost-ship-hunt':0,'clear-jacks-garden-vines':1,'dech-house-spot-difference':2,'grave-digging':3,'catch-all-ghosts':3};
  // ชื่อไทยสั้น ๆ ของวัตถุดิบที่เจอบ่อย · ชื่อเดิมภาษาอังกฤษยังโชว์คู่กันในหน้าเควส
  const THAI_ITEM={'pending-human-bone':'กระดูกมนุษย์','pending-human-skull':'กะโหลกมนุษย์','jacks-hollow-rotten-pumpkin':'ฟักทองเน่า','jacks-hollow-candle':'เทียน','jacks-hollow-pumpkin':'ฟักทอง','jacks-hollow-shovel':'พลั่ว','jacks-hollow-jack-o-wood':"ไม้ Jack'o",'dutchmans-soul-seaweed':'สาหร่าย','dutchmans-soul-abyssal-rock':'หินก้นเหว',"dutchmans-soul-dutchman-s-lantern":'ตะเกียงเรือผี','dutchmans-soul-soul-anchor':'สมอวิญญาณ','pending-vampire-teeth':'เขี้ยวแวมไพร์','pending-bat-teeth':'ฟันค้างคาว','pending-bat-wing':'ปีกค้างคาว','pending-scrap-iron':'เศษเหล็ก','pending-soul-vessel':'ภาชนะวิญญาณ','pending-grim-scythe':'เคียวมรณะ','candy':'Candy'};
  const ICONS=[[/bone/,'🦴'],[/skull/,'💀'],[/pumpkin-seed|seed/,'🌱'],[/pumpkin/,'🎃'],[/candle/,'🕯️'],[/lantern/,'🏮'],[/rock/,'🪨'],[/wood|stick/,'🪵'],[/seaweed|kelp|vine/,'🌿'],[/teeth|tooth/,'🦷'],[/wing|bat/,'🦇'],[/mirror/,'🪞'],[/blood|rose/,'🩸'],[/iron|anchor/,'⚓'],[/scythe|blade/,'⚔️'],[/shovel/,'⛏️'],[/soul|wisp|vessel/,'👻'],[/log|letter|quill/,'📜'],[/head/,'🎃'],[/ship|dutchman/,'⛵'],[/candy/,'🍬'],[/soup/,'🍲'],[/arm/,'🧟']];
  function icon(id){const key=String(id).toLowerCase();for(const [re,emoji] of ICONS)if(re.test(key))return emoji;return '◈';}
  function itemName(config,id){return THAI_ITEM[id]||config.items?.[id]?.name||config.rewards?.[id]?.name||id;}
  // ช่วงเวลาประตู (ห้องลอง): 00–06 ท่าเรือผี · 06–12 สวนฟักทอง · 12–18 คฤหาสน์ · 18–24 สุสาน ตามเวลาไทย
  function windowOf(Core,doc,config,now){
    const at=Core.moment(doc,now),active=Core.biomeAt(doc,config,now),e=doc.event;
    if(config.proposals?.journey?.freeTravel)return {closesAt:null,personal:active.override,bonusBiome:active.bonusBiome};
    if(active.override)return {closesAt:e.totem&&at<e.totem.until?e.totem.until:null,personal:true};
    if(config.proposals?.journey?.hourly)return {closesAt:Core.Rotations.window(at).endAt,personal:false};
    return {closesAt:Math.floor((at+BKK)/SLOT)*SLOT-BKK+SLOT,personal:false};
  }
  // เวลาที่ประตูนี้เปิดครั้งถัดไป (เวลาในเกม) · later=true ข้ามรอบที่เปิดอยู่ตอนนี้ไปรอบหน้า
  function nextOpen(Core,doc,now,biome,later=false){return Core.Rotations.next(Core.moment(doc,now),Core.BIOMES.indexOf(biome),later);}
  // หาว่าของที่ขาดชิ้นนี้ไปเอาที่ไหนเร็วที่สุด
  function routeFor(ctx,need,activeIndex){
    const {Core,Guide,config,doc}=ctx;
    if(need.kind==='candy')return {kind:'village',label:'เคาะบ้านเก็บ Candy',target:'village'};
    if(need.kind==='game'){
      const id=need.id,biome=GAME_BIOME[id];
      if(biome!==activeIndex)return {kind:config.proposals?.journey?.freeTravel?'enter-biome':'wait',biome:Core.BIOMES[biome],label:'ไป'+THAI[biome]};
      if(id==='catch-all-ghosts'&&!doc.event.proofs['grave-digging']?.complete)return {kind:'game',game:'grave-digging',label:'เล่นขุดหลุมศพ',target:'game:grave-digging'};
      return {kind:'game',game:id,label:'เล่น'+GAME_NAMES[id],target:'game:'+id};
    }
    if(need.grown)return {kind:'garden',label:'ปลูกในสวนรัตติกาล',target:'garden'};
    const sources=Guide?Guide.sources(config,need.id):[];
    const homes=sources.filter(s=>s.kind==='house');
    if(homes.length){const home=homes.find(s=>s.biome===Core.BIOMES[activeIndex])||homes[0];if(home.biome!==Core.BIOMES[activeIndex])return {kind:config.proposals?.journey?.freeTravel?'enter-biome':'wait',biome:home.biome,label:'ไปหาของที่'+THAI[Core.BIOMES.indexOf(home.biome)]};return {kind:'village',label:'เคาะบ้านหาของ',target:'village'};}
    const game=sources.find(s=>s.kind==='game');
    if(game)return Core.BIOMES.indexOf(game.biome)===activeIndex?{kind:'game',game:game.game,label:'เล่น'+GAME_NAMES[game.game],target:'game:'+game.game}:{kind:config.proposals?.journey?.freeTravel?'enter-biome':'wait',biome:game.biome,label:'ไป'+THAI[Core.BIOMES.indexOf(game.biome)]};
    const quest=sources.find(s=>s.kind==='quest');
    if(quest){const i=Core.BIOMES.indexOf(quest.biome);return i===activeIndex?{kind:'quest',quest:quest.quest,label:'ทำเควส '+NPC[i],target:'npc'}:{kind:config.proposals?.journey?.freeTravel?'enter-biome':'wait',biome:quest.biome,label:'ไปหา '+NPC[i]+' ที่'+THAI[i]};}
    if(sources.some(s=>s.kind==='garden'))return {kind:'garden',label:'ปลูกในสวนรัตติกาล',target:'garden'};
    const room=sources.find(s=>['shop','cauldron','ritual','potion'].includes(s.kind));
    if(room){const r=room.kind==='potion'?'cauldron':room.kind;return {kind:'room',route:r,label:{shop:'ไปร้านมอร์โร',cauldron:'ไปเตาผสมของมอรา',ritual:'ไปวงเวท'}[r],target:r};}
    return {kind:'quest',label:'ดูรายละเอียดเควส',target:'npc'};
  }
  function next(ctx){
    const {Core,config,doc,now,route='hub'}=ctx,e=doc.event;
    if(!doc||e.closed)return null;
    const active=Core.biomeAt(doc,config,now).id;if(!active)return null;
    const i=Core.BIOMES.indexOf(active),win=windowOf(Core,doc,config,now),inBiome=route==='biome';
    const base={biome:active,biomeName:THAI[i],npc:NPC[i],npcId:NPC_ID[i],closesAt:win.closesAt,personal:win.personal,need:[],steps:null};
    if(route==='gate')return {...base,key:'gate',title:'เปิดประตูเข้าโถงกลาง',detail:'แตะประตูเหล็กเพื่อเริ่ม',action:{kind:'enter-hub',label:'เปิดประตู'},target:'gate'};
    if(config.proposals?.journey?.enabled&&!e.welcomeClaimed&&!e.quests['dutchman-light-in-darkness']?.complete&&route==='hub')return {...base,key:'welcome',title:'รับคำเชิญแล้วไปหา Tang',detail:'เติม Candy ให้ถึง 50 พร้อมของเควสแรก · เปิดทางหา Tang 15 นาที ครั้งเดียว',action:{kind:'welcome',label:'รับชุดเริ่มต้น'},target:'npc'};
    const goBiome={kind:'enter-biome',biome:active,label:'เข้าประตู'+THAI[i]};
    const needs=Core.questNeeds(doc,config,active,now);
    if(!needs){
      const boss=Object.entries(config.proposals?.bosses||{}).find(([,b])=>b.biome===active);
      if(boss&&!e.bossWins?.[boss[0]]){
        const action={kind:'boss',boss:boss[0],label:'ท้าผู้พิทักษ์ '+boss[1].name};
        return {...base,key:'boss:'+boss[0],title:'ท้า '+boss[1].name+' เพื่อรับธีม',detail:'ถืออาวุธจากเควสแล้วเข้าสู้ แพ้ลองใหม่ได้',action:inBiome?action:goBiome,target:inBiome?'boss':'portal'};
      }
      // ไบโอมนี้จบแล้ว ชี้ไปไบโอมถัดไปที่ยังมีงาน
      const pending=Core.BIOMES.map((b,k)=>({b,k,at:nextOpen(Core,doc,now,b)})).filter(x=>x.b!==active&&Core.questNeeds(doc,config,x.b,now)).sort((a,b)=>a.at-b.at)[0];
      if(pending&&config.proposals?.journey?.freeTravel)return {...base,key:'done:'+active,title:'จบงานใน'+THAI[i]+'แล้ว',detail:'ต่อไป: '+NPC[pending.k]+' ที่'+THAI[pending.k],action:{kind:'enter-biome',biome:pending.b,label:'ไปหา '+NPC[pending.k]},target:'portal'};
      if(pending)return {...base,key:'done:'+active,title:'จบงานใน'+THAI[i]+'แล้ว',detail:'ต่อไป: '+NPC[pending.k]+' ที่'+THAI[pending.k],action:{kind:'wait',biome:pending.b,at:pending.at,label:'ประตู'+THAI[pending.k]+'เปิด'},target:'garden',wait:{biome:pending.b,at:pending.at}};
      return {...base,key:'all-done',title:'พิชิตครบทุกไบโอมแล้ว',detail:'ไปวงเวทเพื่อท้าราชันเที่ยงคืน',action:{kind:'room',route:'ritual',label:'ไปวงเวท'},target:'ritual'};
    }
    const q=needs.quest,need=needs.missing.map(m=>({...m,name:m.kind==='game'?GAME_NAMES[m.id]||m.id:itemName(config,m.id),icon:m.kind==='game'?'🎮':icon(m.id)}));
    const metNpc=!!e.visits?.stories?.[active];
    const stage=!inBiome?0:!metNpc?1:needs.ready?3:2;
    const steps=['เข้าประตู','คุยกับ '+NPC[i],!need.length?'ครบแล้ว':need.every(n=>n.kind==='game')?'เล่นเกม':'หาของ','ส่งเควส'].map((label,k)=>({label,state:k<stage?'done':k===stage?'now':'todo'}));
    const quest={id:q.id,name:q.name,order:q.order,phase:needs.phase,phases:needs.phases};
    const common={...base,quest,need,steps};
    if(needs.waitCycle){const at=Core.questWait(doc,config,q,now).nextAt;return {...common,key:'cycle:'+q.id,title:NPC[i]+' กำลังเตรียมจดหมาย',detail:'รอเตรียมจดหมาย 20 นาทีหลังเควสก่อนหน้า · ระหว่างนี้ไปเล่นไบโอมอื่นได้',action:{kind:'wait',biome:active,at,label:'ดูเวลานัด'},target:null,wait:{biome:active,at}};}
    if(!inBiome)return {...common,key:'enter:'+q.id,title:'ไปหา '+NPC[i]+' ที่'+THAI[i],detail:'เดินทางไปได้ทันที',action:goBiome,target:'portal'};
    if(needs.ready)return {...common,key:'ready:'+q.id,title:'ของครบแล้ว! ส่งให้ '+NPC[i],detail:'แตะ '+NPC[i]+' แล้วกดส่งเควส',action:{kind:'quest',quest:q.id,label:'ส่งเควสให้ '+NPC[i]},target:'npc',ready:true};
    if(!metNpc||needs.error)return {...common,key:'talk:'+q.id,title:'คุยกับ '+NPC[i],detail:'ฟังว่าเขาอยากได้อะไร',action:{kind:'quest',quest:q.id,label:'คุยกับ '+NPC[i]},target:'npc'};
    const first=need[0],go=routeFor(ctx,first,i);
    const list=need.map(n=>n.icon+' '+n.name+(n.need>1||n.kind==='candy'?' '+n.have+'/'+n.need:'')).join(' · ');
    return {...common,key:'gather:'+q.id+':'+need.map(n=>n.id+n.have).join(','),title:go.kind==='game'?go.label:'หาของให้ '+NPC[i],detail:list,action:go,target:go.target||null,wait:go.kind==='wait'?{biome:go.biome,at:nextOpen(Core,doc,now,go.biome)}:null};
  }
  return {next,icon,itemName,windowOf,nextOpen,GAME_NAMES,THAI,NPC};
});
