// Generated from the tested shared engine. Run node alt/halloween/server/build.cjs.
const factories={
"event/core.js":function(module,exports,require){
/* Shared rules. The trusted service enables authoritative mode; preview tools remain preview-only. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require("rewards/ownership.js"),require("event/combat.js"),require("event/missions.js"),require("death-quests.js"));
  else root.HalloweenEventCore = factory(root.HalloweenOwnership,root.HalloweenCombat,root.HalloweenStudentMissions,root.HalloweenDeathQuests);
})(typeof globalThis === 'undefined' ? this : globalThis, (Ownership,Combat,Missions,Death) => {
  'use strict';
  const BIOMES = ['dutchmans-soul', 'jacks-hollow', 'vampire-mansion', 'eternal-graveyard'];
  const SHORT = ['dutchman', 'jack', 'vampire', 'graveyard'];
  const DAY = 86400000, HOUR = 3600000;
  const clone = x => JSON.parse(JSON.stringify(x));
  const fail = message => { throw Error(message); };
  const positive = x => Number.isSafeInteger(x) && x > 0;
  function definitions(materials) {
    const map = {};
    for (const biome of materials.biomes) for (const item of biome.items) map[item.id] = {...item, biome: biome.id};
    for (const item of materials.newEventDefinitions || []) map[item.id] = {...item};
    map['spectral-lantern'] = {id:'spectral-lantern', name:'Spectral Lantern', kind:'tool'};
    return map;
  }
  function build({materials, chains, catalog, proposals, preview = false, authoritative = false, season = {}}) {
    const quests = chains.flatMap(chain => chain.quests.map(q => ({...clone(q), biome: chain.biome, npc: chain.npc})));
    const items = definitions(materials), rewards = Object.fromEntries(catalog.items.map(x => [x.id, x]));
    if(preview||authoritative)items['random-biome-potion']={id:'random-biome-potion',name:'น้ำยาหลงไบโอม',kind:'consumable'};
    if (preview||authoritative) for (const crop of Object.values(proposals.crops || {})) {
      items[crop.seed] ||= {id:crop.seed,name:'เมล็ด' + crop.name,kind:'seed'};
      items[crop.harvest] ||= {id:crop.harvest,name:crop.name,kind:'crop'};
    }
    for (const quest of quests) for (const reward of quest.rewards) if (!rewards[reward.id] && !items[reward.id] && reward.id !== 'candy') items[reward.id] = {id:reward.id,name:reward.name,kind:'quest-progress'};
    items['nameless-crown']={id:'nameless-crown',name:'มงกุฎเงาไร้นาม',kind:'trophy',rarity:'Secret',source:'secret-boss'};
    return {materials, quests, items, rewards, proposals: (preview||authoritative) ? clone(proposals) : null, preview, authoritative, season: {id:'halloween-2026', startAt:null, endAt:null, timezone:null, claimingEnabled:false, ...season}};
  }
  function initial(config, owner, now, seed = 246813579) {
    const document = Ownership.create(owner, config.season.id);
    document.event = {candy:0, inventory:{}, grown:{}, ledger:[], houses:{}, quests:{}, proofs:{}, games:{}, purchases:[], crafts:[], garden:{plantedAt:null, watered:false}, totem:null, closed:false, timeOffset:0, clock:now, rng:seed >>> 0, repairs:0, taskClaims:{}, taskEarned:[], visitors:{}, visits:{hub:false,biomes:{},stories:{}}, location:{kind:'gate'}};
    document.event.shopSeed=seed>>>0;
    return document;
  }
  function random(event) {
    let x = event.rng || 1; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    event.rng = x >>> 0; return event.rng / 4294967296;
  }
  function shuffled(event,values){const rows=[...values];for(let i=rows.length-1;i>0;i--){const j=Math.floor(random(event)*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}return rows;}
  function requireRules(config) { if (!(config.preview||config.authoritative) || !config.proposals) fail('ส่วนนี้ยังรอกติกายืนยัน เปิดทดลองได้เฉพาะห้องลอง'); }
  function ensureOpen(document, config, now) {
    if (document.event.closed) fail('อีเวนต์ปิดแล้ว รางวัลที่ได้รับยังอยู่ในคลัง');
    if (config.preview) return;
    const season = config.season;
    if (!season.claimingEnabled || !season.startAt || !season.endAt || !season.timezone) fail('ยังไม่เปิดรับรางวัลจริง');
    if (now < Date.parse(season.startAt) || now >= Date.parse(season.endAt)) fail('อยู่นอกช่วงกิจกรรม');
    // การเปิดรับของจริงต้องมีตัวตัดสินธุรกรรมบนบริการที่ไว้ใจได้ ไม่ใช้ตัวสุ่มในห้องลอง
    if(!config.authoritative)fail('ระบบรับของจริงยังไม่ได้เชื่อมผู้ตัดสินธุรกรรม');
  }
  function moment(document, now) { return now + document.event.timeOffset; }
  // Pure hourly projection: opening/reloading does not reroll stock or advance house RNG.
  function shopStock(document,config,now) {
    requireRules(config);
    const rule=config.proposals.shopStock;
    if(rule?.intervalMs!==HOUR||!positive(rule.lots))fail('กติกาสต็อกร้านยังไม่พร้อม');
    const epoch=Math.floor(moment(document,now)/rule.intervalMs),saved=document.event.shopStock;
    if(saved?.epoch===epoch)return {...clone(saved),nextAt:(epoch+1)*rule.intervalMs};
    let hash=2166136261;
    for(const c of document.owner+document.season+':'+(document.event.shopSeed??'legacy')+':'+epoch){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619)>>>0;}
    const rng={rng:hash||1},remaining=Object.fromEntries(Object.keys(config.proposals.shop).map(id=>[id,0]));
    const tiers=Object.entries(rule.rarityWeightsPercent);
    if(tiers.reduce((n,[,w])=>n+w,0)!==100)fail('น้ำหนักสต็อกร้านไม่ครบ');
    for(let i=0;i<rule.lots;i++){
      const roll=random(rng)*100;let acc=0,tier;
      for(const [rarity,weight] of tiers){acc+=weight;if(roll<acc){tier=rarity;break;}}
      const pool=Object.keys(remaining).filter(id=>config.rewards[id]?.rarity===tier&&['room','effect'].includes(config.rewards[id].kind));
      if(!pool.length)fail('ระดับของสต็อกร้านไม่มีสินค้า');
      remaining[pool[Math.floor(random(rng)*pool.length)]]++;
    }
    return {epoch,remaining,nextAt:(epoch+1)*rule.intervalMs};
  }
  function biomeAt(document, config, now) {
    const at = moment(document, now), event = document.event;
    if (config.preview||config.authoritative) {
      const cycle = Math.floor((at + 7 * HOUR) / DAY);
      const personal=event.totem&&at<event.totem.until;
      // Daily Bangkok rotation: four six-hour windows. Personal routes never advance the daily quest cycle.
      const hour = new Date(at + 7 * HOUR).getUTCHours();
      const featured=personal?event.totem.biome:BIOMES[Math.floor(hour/6)];
      const selected=config.preview&&event.previewBiome?event.previewBiome:event.selectedBiome;
      return {id:config.proposals.journey?.freeTravel&&BIOMES.includes(selected)?selected:featured,cycle,override:!!personal,bonusBiome:featured};
    }
    return {id:null, cycle:null, override:false};
  }
  function addCandy(event, amount, source, at, tx) {
    if (!Number.isSafeInteger(amount) || event.candy + amount < 0) fail('Candy ไม่พอ');
    event.candy += amount;
    if (amount) event.ledger.push({id:tx, source, amount, at});
  }
  function portalStatus(document, config, id, now) {
    if (!BIOMES.includes(id)) return {open:false,reason:'unknown-biome'};
    if (document.event.closed) return {open:false,reason:'event-closed'};
    const active = biomeAt(document,config,now);
    const open=config.proposals?.journey?.freeTravel||active.id===id;
    return {open:!!open,reason:open?'open':'waiting-cycle',personal:active.override===true,activeBiome:active.id,featured:(active.bonusBiome||active.id)===id};
  }
  function addItem(event, id, amount) {
    if (!Number.isSafeInteger(amount) || (event.inventory[id] || 0) + amount < 0) fail('วัตถุดิบไม่พอ');
    event.inventory[id] = (event.inventory[id] || 0) + amount;
  }
  function questStatus(document, config, quest) {
    const progress = document.event.quests[quest.id];
    return {phase:progress?.phase || 0, complete:progress?.complete === true, unlocked:!quest.prerequisite || document.event.quests[quest.prerequisite]?.complete === true};
  }
  function questWait(document,config,quest,now){
    if(!quest.availability?.mustWaitForNextOccurrence)return {waiting:false,nextAt:null};
    const previous=document.event.quests[quest.prerequisite];
    if(!previous?.complete)return {waiting:false,nextAt:null};
    if(config.proposals.journey?.dechWaitMs){const nextAt=(previous.completedAt??0)+config.proposals.journey.dechWaitMs;return {waiting:moment(document,now)<nextAt,nextAt};}
    const current=biomeAt(document,config,now),waiting=current.cycle<=previous.completedCycle;
    return {waiting,nextAt:waiting?(previous.completedCycle+1)*DAY-7*HOUR+BIOMES.indexOf(quest.biome)*6*HOUR:null};
  }
  function biomeProgress(document,config,biome){
    const chain=config.quests.filter(q=>q.biome===biome),event=document.event;
    const phases=chain.reduce((n,q)=>n+q.phases.length,0),finished=chain.reduce((n,q)=>{const p=event.quests[q.id];return n+(p?.complete?q.phases.length:Math.max(0,Math.min(q.phases.length-1,Math.floor(p?.phase||0))));},0);
    const boss=Object.entries(config.proposals?.bosses||{}).find(([,b])=>b.biome===biome),won=!!boss&&!!event.bossWins?.[boss[0]],total=phases+(boss?1:0),value=finished+(won&&finished===phases?1:0);
    return {biome,value,total,phases,finished,boss:boss?.[0]||null,bossWon:won,percent:total?Math.floor(value/total*100):0,complete:total>0&&value===total};
  }
  function gardenUnlocked(document){return document.event.quests['jack-clear-garden']?.complete===true;}
  function weaponStatus(document,config,id){
    const weapon=config.proposals?.weapons?.[id],owned=document.rewards[id];
    return {weapon,owned:!!owned,usable:!!weapon&&!!owned&&!owned.restriction,reason:owned?.restriction?'ต้องปลดพันธนาการกับ Win Q5 ก่อน':!owned?'ยังไม่ได้รับอาวุธจากเควส':''};
  }
  function bossStatus(document,config,id,now=document.event.clock-document.event.timeOffset){
    const rule=config.proposals?.bosses?.[id],event=document.event;
    if(!rule)return {unlocked:false,reason:'ไม่พบบอส'};
    const won=event.bossWins?.[id];
    let reason='';
    if(rule.quest&&!event.quests[rule.quest]?.complete)reason='ทำเควสสุดท้ายของ NPC ในไบโอมนี้ก่อน';
    else if(rule.requiresThemes&&!Object.entries(config.proposals.bosses).filter(([,b])=>b.theme).every(([id,b])=>event.bossWins?.[id]&&document.rewards[b.theme]))reason='ชนะผู้พิทักษ์ทั้งสี่ไบโอมและรับธีมก่อน';
    else if(rule.requiresBoss&&!event.bossWins?.[rule.requiresBoss])reason='โค่นราชันเที่ยงคืนก่อน';
    else if(rule.requiresTheme&&!document.rewards[rule.requiresTheme])reason='ทำพิธีรับธีม Midnight Academy ก่อน';
    else if(rule.biome&&biomeAt(document,config,now).id!==rule.biome)reason='บอสอยู่ในไบโอมอื่น';
    return {unlocked:!reason,reason,won:!!won,rule};
  }
  function resolveRequirements(config, quest, requirements, branch) {
    let req = requirements;
    if (requirements.anyOf) {
      req = requirements.anyOf.find(x => x.id === branch);
      if (!req) fail('เลือกวิธีส่งเควสก่อน');
    }
    req = clone(req);
    for (const item of req.items || []) {
      if (item.consume === false && item.mustPossess) continue;
      if (item.quantity == null) {
        const n = (config.preview || config.authoritative) && config.proposals.questQuantities[quest.id];
        if (!positive(n)) fail('จำนวนวัตถุดิบเควสนี้ยังไม่กำหนด');
        item.quantity = n;
      }
      if (item.id === 'jacks-hollow-shovel') {
        if (!(config.preview || config.authoritative) || typeof config.proposals.garden.consumeShovel !== 'boolean') fail('ยังรอกติกาการใช้ Shovel');
        item.consume = config.proposals.garden.consumeShovel;
      }
    }
    return req;
  }
  function checkRequirements(document, requirements) {
    const event = document.event;
    if (requirements.candy != null && (!Number.isSafeInteger(requirements.candy) || requirements.candy < 0)) fail('สูตร Candy ไม่ถูกต้อง');
    if (event.candy < (requirements.candy || 0)) fail('Candy ไม่พอ');
    const totals = {}, grown = {};
    for (const item of requirements.items || []) {
      const amount = item.consume === false && item.mustPossess ? 1 : item.quantity;
      if (!positive(amount)) fail('จำนวนวัตถุดิบยังไม่กำหนด');
      totals[item.id] = (totals[item.id] || 0) + amount;
      if (item.mustBePlayerGrown) grown[item.id] = (grown[item.id] || 0) + amount;
    }
    for (const [id, amount] of Object.entries(totals)) if ((event.inventory[id] || 0) < amount) fail('ยังขาดวัตถุดิบที่ขอ');
    for (const [id, amount] of Object.entries(grown)) if ((event.grown[id] || 0) < amount) fail('Pumpkin ต้องมาจากสวนที่ปลูกเอง');
    if (requirements.objective && !event.proofs[requirements.objective.id]?.complete) fail('ยังไม่ได้เคลียร์เถาวัลย์');
    const mini = requirements.minigame;
    if (mini) {
      const id = mini.id || 'ghost-ship-hunt', proof = event.proofs[id];
      if (mini.mustClear && !proof?.clear) fail('ยังไม่ผ่านมินิเกมที่ขอ');
      if (mini.mustComplete && !proof?.complete) fail('ยังเล่นมินิเกมไม่จบ');
    }
    return true;
  }
  function consume(document, requirements, now, tx) {
    checkRequirements(document, requirements);
    addCandy(document.event, -(requirements.candy || 0), 'spend', now, tx);
    for (const item of requirements.items || []) if (item.consume !== false) {
      addItem(document.event, item.id, -item.quantity);
      if (item.mustBePlayerGrown) document.event.grown[item.id] -= item.quantity;
    }
  }
  function give(document, config, reward, now, tx) {
    const event = document.event, item = config.rewards[reward.id];
    if (reward.kind === 'currency' || reward.id === 'candy') { addCandy(event, reward.quantity, 'quest', now, tx); return null; }
    if (reward.kind === 'upgrade-existing') {
      const existing = document.rewards[reward.id];
      if (!existing || existing.restriction?.status !== 'Restricted') fail('ยังไม่มีเคียวที่รอปลดผนึก');
      existing.restriction = null; existing.upgradedAt = now; existing.upgradeReceipt = tx;
      if(config.proposals?.weapons?.[reward.id])event.equipment=reward.id;
      return reward.id;
    }
    if (item) {
      if (!positive(reward.quantity)) fail('จำนวนรางวัลไม่ถูกต้อง');
      Ownership.grant(document, {id:reward.id, restriction:reward.restriction}, tx, now);
      if (reward.inventoryId) addItem(event, reward.inventoryId, reward.quantity);
      if(config.proposals?.weapons?.[reward.id]&&!reward.restriction)event.equipment=reward.id;
      return reward.id;
    }
    if (!positive(reward.quantity)) fail('จำนวนรางวัลไม่ถูกต้อง');
    addItem(event, reward.id, reward.quantity); return null;
  }
  // เควสที่ผู้เล่นต้องทำต่อในไบโอมนี้ และของที่ยังขาด — อ่านอย่างเดียว ให้แถบภารกิจและหัวหมู่บ้านบนจอใช้ ไม่เปลี่ยนกติกา
  function questNeeds(document, config, biome, now = document.event.clock - document.event.timeOffset) {
    const event = document.event, chain = config.quests.filter(q => q.biome === biome);
    const quest = chain.find(q => !event.quests[q.id]?.complete);
    if (!quest) return null;
    const status = questStatus(document, config, quest), phase = quest.phases[Math.min(status.phase, quest.phases.length - 1)];
    const branches = phase.requirements.anyOf ? phase.requirements.anyOf.map(x => x.id) : [null];
    let best = null;
    for (const branch of branches) {
      let requirements;
      try { requirements = resolveRequirements(config, quest, phase.requirements, branch); } catch (error) { if (!best) best = {branch, requirements:null, missing:[], error:error.message}; continue; }
      const missing = [];
      if ((requirements.candy || 0) > event.candy) missing.push({kind:'candy', id:'candy', have:event.candy, need:requirements.candy});
      for (const item of requirements.items || []) {
        const need = item.consume === false && item.mustPossess ? 1 : item.quantity;
        const have = item.mustBePlayerGrown ? Math.min(event.grown[item.id] || 0, event.inventory[item.id] || 0) : event.inventory[item.id] || 0;
        if (have < need) missing.push({kind:'item', id:item.id, have, need, grown:!!item.mustBePlayerGrown});
      }
      if (requirements.objective && !event.proofs[requirements.objective.id]?.complete) missing.push({kind:'game', id:requirements.objective.id, have:0, need:1});
      const mini = requirements.minigame;
      if (mini) {
        const id = mini.id || 'ghost-ship-hunt', proof = event.proofs[id];
        if ((mini.mustClear && !proof?.clear) || (mini.mustComplete && !proof?.complete)) missing.push({kind:'game', id, have:0, need:1});
      }
      const row = {branch, requirements, missing, error:null};
      if (!best || best.error || missing.length < best.missing.length) best = row;
      if (!missing.length) break;
    }
    const waitCycle = questWait(document, config, quest, now).waiting;
    return {quest, status, phase:status.phase, phases:quest.phases.length, ...best, ready:!best.error && !best.missing.length && !waitCycle, waitCycle};
  }
  function houseAvailability(document, config, id, now) {
    const event = document.event, at = moment(document, now), biome = biomeAt(document, config, now).id;
    const next = event.houses[biome + ':' + id] || 0;
    const receipts=event.ledger.filter(x => x.source === 'house' && x.amount > 0 && x.at > at - DAY && x.at <= at);
    const earned=receipts.reduce((n,x)=>n+x.amount,0),capNextAt=receipts.length?Math.min(...receipts.map(x=>x.at))+DAY:0;
    return {nextAt:next, capNextAt, availableAt:Math.max(next,earned>=300?capNextAt:0), remaining:Math.max(0, 300 - earned), ready:at >= next && earned < 300};
  }
  function questAidStatus(document,config,biome) {
    const target=config.proposals?.questAid?.visits;
    if(!positive(target))return null;
    const home=new Map((config.materials.biomes.find(b=>b.id===biome)?.items||[]).filter(i=>i.source==='house-item-pool'&&i.rarity!=='Mystical').map(i=>[i.id,i])),missing=new Map();
    for(const quest of config.quests){
      const state=questStatus(document,config,quest);
      if(!state.unlocked||state.complete)continue;
      const requirements=quest.phases[state.phase]?.requirements;
      if(!requirements)continue;
      for(const branch of requirements.anyOf||[requirements]){
        const req=resolveRequirements(config,quest,requirements,branch.id),totals={};
        for(const item of req.items||[])if(home.has(item.id)&&!item.mustBePlayerGrown){
          const amount=item.consume===false&&item.mustPossess?1:item.quantity;
          if(positive(amount))totals[item.id]=(totals[item.id]||0)+amount;
        }
        for(const [id,amount] of Object.entries(totals))if((document.event.inventory[id]||0)<amount)missing.set(id,home.get(id));
      }
    }
    const weights=config.materials.houseItems.rarityWeightsPercent;
    const candidates=[...missing.values()].sort((a,b)=>(weights[a.rarity]??Infinity)-(weights[b.rarity]??Infinity)||a.id.localeCompare(b.id));
    return {target,visits:Math.min(target,Math.max(0,document.event.questAid?.[biome]?.visits||0)),missing:candidates};
  }
  function awardQuestAid(document,config,biome,at,tx) {
    const status=questAidStatus(document,config,biome);
    if(!status)return null;
    const counters=document.event.questAid||=( {} ),counter=counters[biome]||={visits:0,grants:0};
    counter.visits=Math.min(status.target,status.visits+1);
    let gift=null;
    if(counter.visits===status.target&&status.missing.length){
      const item=status.missing[0];gift={id:item.id,quantity:1,rarity:item.rarity,biome};
      addItem(document.event,item.id,1);counter.visits=0;counter.grants=(counter.grants||0)+1;counter.lastGift={id:item.id,at,tx};
    }
    return {visits:counter.visits,target:status.target,item:gift};
  }
  function gameDefinition(id, config) {
    const g = config.proposals?.games;
    if (!g) fail('กติกามินิเกมยังไม่ครบ');
    const defs = {
      'ghost-ship-hunt': {biome:BIOMES[0], duration:0},
      'clear-jacks-garden-vines': {biome:BIOMES[1], total:g.vines, duration:0},
      'dech-house-spot-difference': {biome:BIOMES[2], total:g.differences, duration:g.differenceSeconds * 1000},
      'grave-digging': {biome:BIOMES[3], total:g.digSteps, duration:0},
      'catch-all-ghosts': {biome:BIOMES[3], total:g.ghostCount, duration:30000}
    };
    return defs[id] || fail('ไม่พบมินิเกม');
  }
  function finishGame(event, game, clear, now) {
    game.finished = true; game.clear = clear; game.endedAt = now;
    const prior = event.proofs[game.id] || {};
    event.proofs[game.id] = {complete:true, clear:prior.clear || clear, at:now, session:game.session};
  }
  function dispatch(document, config, action, {now, tx, studentOS,studentOwner='',studentFocus}) {
    if (!tx || !Number.isFinite(now)) fail('ธุรกรรมไม่มีเวลาอ้างอิง');
    if (!document.event || document.season !== config.season.id) fail('ไม่พบข้อมูลฤดูกาล');
    const event = document.event, at = moment(document, now);
    if (at < event.clock) fail('เวลาเครื่องย้อนหลัง กรุณาตรวจเวลาแล้วลองใหม่');
    const result = {at, type:action.type, rewards:[]};
    if (action.type.startsWith('preview-')) {
      if(!config.preview)fail('เครื่องมือนี้ใช้เฉพาะห้องลอง');
      requireRules(config);
      if (action.type === 'preview-supplies') {
        addCandy(event, 1200, 'preview-supplies', at, tx);
        for (const item of Object.values(config.items)) if (!['Mystical'].includes(item.rarity) && !['event-feature','tool','trophy'].includes(item.kind) && item.id !== 'jacks-hollow-pumpkin' && item.id !== 'jacks-hollow-shovel') addItem(event, item.id, 15);
      } else if (action.type === 'preview-biome') {
        if (!BIOMES.includes(action.biome)) fail('ไม่พบไบโอม');
        event.previewBiome = action.biome; event.totem = null;
      } else if (action.type === 'preview-time') {
        if (!positive(action.ms) || action.ms > 2 * DAY) fail('เวลาทดลองไม่ถูกต้อง');
        event.timeOffset += action.ms;
      } else if (action.type === 'preview-close') event.closed = !event.closed;
      else fail('ไม่พบเครื่องมือทดลอง');
      event.clock = moment(document, now); result.at = event.clock; return result;
    }
    ensureOpen(document, config, at);
    const current = biomeAt(document, config, now);
    if (action.type === 'enter-hub') {
      event.visits ||= {hub:false,biomes:{},stories:{}};
      event.visits.hub = true; event.location = {kind:'hub'};
    } else if (action.type === 'enter-room') {
      if (!['shop','cauldron','ritual','garden'].includes(action.room)) fail('ไม่พบห้องนี้');
      event.location={kind:'room',room:action.room};
    } else if (action.type === 'enter-biome') {
      if (!portalStatus(document,config,action.biome,now).open) fail('ประตูไบโอมนี้ยังไม่เปิด ลองกลับมาในรอบของมันหรือใช้ Totem');
      event.visits ||= {hub:false,biomes:{},stories:{}};
      event.selectedBiome=action.biome;delete event.previewBiome;
      event.visits.biomes[action.biome] = true; event.location = {kind:'biome',biome:action.biome};
      result.firstStory = !event.visits.stories[action.biome]; result.biome = action.biome;
    } else if (action.type === 'story-seen') {
      if (!BIOMES.includes(action.biome) || !event.visits?.biomes[action.biome]) fail('เข้าไบโอมก่อนอ่านเรื่องราว');
      event.visits.stories[action.biome] = true;
    } else if (action.type === 'house') {
      requireRules(config);
      if (!Number.isInteger(action.house) || action.house < 1 || action.house > 5 || !['treat','trick'].includes(action.choice)) fail('เลือกบ้านและ Trick/Treat ก่อน');
      const rules = config.proposals.houses;
      if (rules.cooldownScope !== 'house-per-biome' || rules.capWindow !== 'rolling-24h' || rules.capPayout !== 'clamp-positive-only') fail('กติกาบ้านยังไม่พร้อม');
      const available = houseAvailability(document, config, action.house, now);
      if (at < available.nextAt) fail('บ้านนี้ยังอยู่ในคูลดาวน์');
      if (!available.remaining) fail('Candy จากบ้านครบ 300 ใน 24 ชั่วโมงแล้ว');
      const rolled = action.choice === 'treat' ? 10 : (random(event) < .5 ? 20 : 0);
      const featured=config.proposals.journey?.freeTravel&&current.id===current.bonusBiome;
      const candy = Math.min(featured?Math.floor(rolled*config.proposals.journey.bonusCandyMultiplier):rolled, available.remaining);
      addCandy(event, candy, 'house', at, tx);
      event.houses[current.id + ':' + action.house] = at + config.materials.houseCandy.initialCooldownHours * HOUR;
      result.candy = candy; result.item = null;result.featured=!!featured;
      if (candy > 0 && random(event) < config.materials.houseItems.dropChanceGivenCandy) {
        const roll = random(event) * 100; let acc = 0, rarity;
        for (const [tier, weight] of Object.entries(config.materials.houseItems.rarityWeightsPercent)) { acc += weight; if (roll < acc) { rarity = tier; break; } }
        const breakthroughRoll=random(event)<config.materials.houseItems.breakthrough.triggerChance;
        const destination = breakthroughRoll ? BIOMES[Math.floor(random(event) * BIOMES.length)] : current.id;
        const pool = config.materials.biomes.find(x => x.id === destination).items.filter(x => x.source==='house-item-pool'&&x.rarity === rarity && x.rarity !== 'Mystical').map(x => x.id);
        if (pool.length) {
          const id = pool[Math.floor(random(event) * pool.length)]; addItem(event, id, rules.itemQuantity);
          result.item = {id, quantity:rules.itemQuantity, rarity, biome:destination, breakthrough:destination !== current.id,breakthroughRoll};
        }
      }
      result.questAid=awardQuestAid(document,config,current.id,at,tx);
    } else if(action.type==='claim-welcome'){
      requireRules(config);
      if(!config.proposals.journey?.freeTravel||event.welcomeClaimed||event.quests['dutchman-light-in-darkness']?.complete)fail('รับชุดเริ่มต้นแล้ว');
      const candy=Math.max(0,50-event.candy);addCandy(event,candy,'welcome',at,tx);
      for(const id of ['dutchmans-soul-abyssal-rock','dutchmans-soul-dutchman-s-lantern'])if(!(event.inventory[id]>0))addItem(event,id,1);
      event.welcomeClaimed={at,tx};event.selectedBiome=BIOMES[0];delete event.previewBiome;
      event.visits.biomes[BIOMES[0]]=true;event.location={kind:'biome',biome:BIOMES[0]};result.candy=candy;
    } else if (action.type === 'quest') {
      const quest = config.quests.find(x => x.id === action.quest) || fail('ไม่พบเควส');
      const status = questStatus(document, config, quest);
      if (status.complete) fail('รับรางวัลเควสนี้แล้ว');
      if (!status.unlocked) fail('ต้องทำเควสก่อนหน้าให้ครบ');
      if (quest.biome !== current.id) fail('NPC อยู่ในไบโอมอื่น');
      const progress = event.quests[quest.id] || {phase:0, complete:false};
      if (quest.availability?.mustWaitForNextOccurrence) {
        const previous = event.quests[quest.prerequisite];
        if (questWait(document,config,quest,now).waiting) fail(config.proposals.journey?.dechWaitMs?'รอเตรียมจดหมาย 20 นาทีหลังเควสก่อนหน้า':'ต้องรอไบโอมกลับมาในวัฏจักรถัดไป');
        if (current.override && !config.preview && !config.authoritative) fail('ยังไม่กำหนดผลของ Totem ต่อวัฏจักร');
      }
      const phase = quest.phases[status.phase];
      const existingLantern = quest.preserveExistingCraft && (event.inventory['spectral-lantern'] || 0) > 0;
      if (!existingLantern) consume(document, resolveRequirements(config, quest, phase.requirements, action.branch), at, tx);
      progress.phase++;
      result.dialogue = phase.completeDialogue; result.npc = quest.npc;
      if (progress.phase >= quest.phases.length) {
        progress.complete = true; progress.completedAt = at; progress.completedCycle = current.cycle;
        const crop = config.proposals?.crops?.[quest.biome];
        if (crop) { addItem(event,crop.seed,crop.questSeeds); result.seeds = {id:crop.seed,quantity:crop.questSeeds}; }
        for (const reward of quest.rewards) {
          if(reward.afterBoss){result.boss=reward.afterBoss;continue;}
          if (existingLantern && reward.id === 'spectral-lantern') continue;
          const id = give(document, config, reward, at, tx); if (id) result.rewards.push(id);
        }
      }
      event.quests[quest.id] = progress;
    } else if (action.type === 'buy') {
      requireRules(config);
      const price = config.proposals.shop[action.item];
      if (!positive(price) || !config.rewards[action.item]) fail('ของชิ้นนี้ไม่ได้ขายในร้าน');
      if (document.rewards[action.item] || event.purchases.includes(action.item)) fail('มีของชิ้นนี้แล้ว');
      if(event.location?.kind!=='room'||event.location.room!=='shop')fail('ไปชั่งสินค้าที่ร้านก่อน');
      const stock=shopStock(document,config,now);
      if(action.stockEpoch!==stock.epoch)fail('สต็อกเปลี่ยนรอบแล้ว กรุณาหยิบสินค้าใหม่');
      if(!positive(stock.remaining[action.item]))fail('สินค้าชิ้นนี้หมดแล้ว รอร้านเติมรอบถัดไป');
      addCandy(event, -price, 'shop', at, tx);
      stock.remaining[action.item]--;event.shopStock={epoch:stock.epoch,remaining:stock.remaining};
      Ownership.grant(document, {id:action.item}, tx, at); event.purchases.push(action.item); result.rewards.push(action.item);
      if (Object.keys(config.proposals.shop).every(id => event.purchases.includes(id))) {
        Ownership.grant(document, {id:'crown-of-midnight'}, tx, at); result.rewards.push('crown-of-midnight');
      }
    } else if (action.type === 'craft') {
      requireRules(config);
      const recipe = config.proposals.recipes.find(x => x.id === action.recipe) || fail('ยังไม่มีสูตรนี้');
      if(recipe.retired)fail('ธีมคู่นี้รับพร้อมตราเมื่อชนะราชันเที่ยงคืน ไม่ต้องทำพิธีเพิ่ม');
      if (document.rewards[recipe.reward]) fail('มีรางวัลชิ้นนี้แล้ว');
      if (recipe.requiresAllMainQuests && !config.quests.filter(x => x.finalMainQuest).every(x => event.quests[x.id]?.complete)) fail('พิธีทดลองนี้ต้องผ่าน Main Quest ทั้งสี่คน');
      if(recipe.requiresBoss&&!event.bossWins?.[recipe.requiresBoss])fail('ต้องชนะราชันเที่ยงคืนก่อนทำพิธีรับธีม');
      const requirements = {candy:recipe.candy, items:recipe.items.map(([id,quantity]) => ({id,quantity}))};
      consume(document, requirements, at, tx);
      Ownership.grant(document, {id:recipe.reward}, tx, at); event.crafts.push(recipe.id); result.rewards.push(recipe.reward);
    } else if (action.type === 'seed-quest') {
      requireRules(config);
      const crop = config.proposals.crops?.[action.biome];
      if (!crop || action.biome !== current.id) fail('ไปหา NPC ในไบโอมนี้ก่อน');
      if (!config.quests.some(q => q.biome===action.biome && event.quests[q.id]?.complete)) fail('ทำเควสแรกของ NPC ให้สำเร็จก่อน');
      addItem(event,crop.request,-2); addItem(event,crop.seed,2);
      result.seeds = {id:crop.seed,quantity:2};
    } else if (action.type === 'plant' || action.type === 'water' || action.type === 'harvest' || action.type === 'sell-crop') {
      requireRules(config);
      const biome = action.biome || BIOMES[1], crop = config.proposals.crops?.[biome];
      if (!crop) fail('ไม่พบพืชชนิดนี้');
      if(action.type!=='sell-crop'&&!gardenUnlocked(document))fail('สวนทุกแปลงเปิดหลังส่ง Rotten Pumpkin เคลียร์เถาวัลย์ และจบ Jack Q1 เท่านั้น');
      const requiredRoom=action.type==='sell-crop'?'shop':'garden';
      if(event.location?.kind!=='room'||event.location.room!==requiredRoom) fail(requiredRoom==='shop'?'นำผลผลิตไปขายกับพ่อค้าในร้าน':'ไปปลูกและดูแลพืชที่สวนรัตติกาลก่อน');
      event.gardens ||= {};
      const garden = biome===BIOMES[1] ? event.garden : (event.gardens[biome] ||= {plantedAt:null,watered:false});
      const save = value => { if (biome===BIOMES[1]) event.garden=value; else event.gardens[biome]=value; };
      const rules = config.proposals.garden;
      if (action.type==='sell-crop') {
        const quantity = action.quantity;
        if((action.expectedGrown!=null&&action.expectedGrown!==(event.grown[crop.harvest]||0))||(action.expectedInventory!=null&&action.expectedInventory!==(event.inventory[crop.harvest]||0)))fail('จำนวนผลผลิตเปลี่ยนแล้ว กรุณาชั่งใหม่');
        if (!positive(quantity) || quantity>(event.grown[crop.harvest]||0) || quantity>(event.inventory[crop.harvest]||0)) fail('ขายได้เฉพาะผลผลิตที่ปลูกจนโตและเก็บแล้ว');
        addItem(event,crop.harvest,-quantity); event.grown[crop.harvest]-=quantity;
        addCandy(event,quantity*crop.sellCandy,'crop-sale',at,tx); result.candy=quantity*crop.sellCandy;
      } else if (action.type==='plant') {
        if (garden.plantedAt!=null) fail('แปลงนี้กำลังปลูกอยู่');
        addItem(event,crop.seed,-rules.seedCost); save({plantedAt:at,watered:false});
      } else if (action.type==='water') {
        if (garden.plantedAt==null) fail('ปลูกเมล็ดก่อน'); garden.watered=true;
      } else {
        if (garden.plantedAt==null || at<garden.plantedAt+rules.growthMs || (rules.waterRequired&&!garden.watered)) fail('พืชยังโตไม่เต็มที่หรือยังไม่ได้รดน้ำ');
        addItem(event,crop.harvest,rules.yield); event.grown[crop.harvest]=(event.grown[crop.harvest]||0)+rules.yield;
        save({plantedAt:null,watered:false}); result.harvest=rules.yield;
      }
    } else if(action.type==='equip-weapon'){
      requireRules(config);
      if(event.battle&&!event.battle.finished)fail('เปลี่ยนอาวุธได้เมื่อออกจากการต่อสู้');
      const status=weaponStatus(document,config,action.weapon);
      if(!status.usable)fail(status.reason||'อาวุธนี้ยังถือไม่ได้');
      event.equipment=action.weapon;result.weapon=action.weapon;
    } else if(action.type==='start-boss'){
      requireRules(config);
      const status=bossStatus(document,config,action.boss,now);
      if(!status.unlocked)fail(status.reason);
      if(status.won)fail('รับรางวัลจากบอสตัวนี้แล้ว');
      if(event.battle&&!event.battle.finished)fail('จบหรือถอยจากการต่อสู้เดิมก่อน');
      if(status.rule.biome&&(event.location?.kind!=='biome'||event.location.biome!==status.rule.biome))fail('เดินทางเข้าฉากไบโอมของบอสก่อน');
      if(!status.rule.biome&&(event.location?.kind!=='room'||event.location.room!=='ritual'))fail('ไปวงเวทในโถงกลางก่อนเข้าบัลลังก์');
      const equipment=weaponStatus(document,config,event.equipment);
      if(!equipment.usable)fail('ถืออาวุธที่ได้รับจากเควสและปลดผนึกแล้วก่อนสู้บอส');
      event.battle=Combat.start({...status.rule,id:action.boss},event.equipment,tx,at,()=>random(event));
      result.battle=clone(event.battle);
    } else if(action.type==='battle-move'){
      requireRules(config);
      const battle=event.battle;
      if(!battle||battle.session!==action.session||battle.finished)fail('การต่อสู้รอบนี้จบแล้ว');
      const rule=config.proposals.bosses[battle.id],weapon=weaponStatus(document,config,battle.weapon);
      if(!weapon.usable)fail('อาวุธนี้ยังใช้ไม่ได้');
      if(rule.biome&&rule.biome!==current.id&&action.move!=='retreat'&&!config.proposals.journey?.freeTravel)fail('ไบโอมเปลี่ยนแล้ว ถอยกลับก่อนเริ่มใหม่');
      Combat.move(battle,rule,weapon.weapon,action.move,at,()=>random(event));
      if(battle.finished&&battle.clear){
        event.bossWins||={};if(event.bossWins[battle.id])fail('รับรางวัลบอสแล้ว');
        event.bossWins[battle.id]={at,tx,turns:battle.turn,weapon:battle.weapon};
        for(const id of rule.rewards||(rule.theme?[rule.theme]:[]))if(!document.rewards[id]){Ownership.grant(document,{id},tx,at);result.rewards.push(id);}
        if(battle.id==='nameless-afterlight'){addItem(event,'nameless-crown',1);event.secretEnding=true;}
      }
      result.battle=clone(battle);
    } else if(action.type==='training-start'){
      requireRules(config);if(event.trainingBattle&&!event.trainingBattle.finished)fail('ฝึกรอบปัจจุบันให้จบหรือถอยก่อน');
      event.trainingBattle=Combat.start({id:'training',hp:1000,damage:12},'greater-spear',tx,at,()=>random(event));
      event.trainingBattle.lesson=0;event.trainingBattle.intent={kind:'sweep',danger:[1],phase:1,damage:12};result.battle=clone(event.trainingBattle);
    } else if(action.type==='training-move'){
      requireRules(config);const b=event.trainingBattle;if(!b||b.finished||b.session!==action.session)fail('ไม่พบรอบฝึก');
      const valid=action.move==='retreat'||(b.lesson===0&&['dodge-0','dodge-2'].includes(action.move))||(b.lesson===1&&action.move==='guard')||(b.lesson===2&&action.move==='skill');
      if(!valid)fail(['หลบไปซ้ายหรือขวาที่ว่างอยู่','ตั้งรับเพื่อกันคำสาปและฟื้นเวท','ใช้ยึดสมอด้วยเวทที่สะสม'][b.lesson]);
      Combat.move(b,{hp:1000,damage:12},config.proposals.weapons['greater-spear'],action.move,at,()=>random(event));
      if(action.move!=='retreat'){b.lesson++;if(b.lesson===3){b.finished=true;b.clear=true;event.battleTraining={complete:true,at};}else b.intent={kind:b.lesson===1?'hex':'crush',danger:b.lesson===1?[0,1,2]:[1],phase:1,damage:12};}
      result.battle=clone(b);
    } else if(action.type==='claim-final-theme-set'){
      requireRules(config);if(!event.bossWins?.['midnight-sovereign'])fail('ต้องชนะราชันเที่ยงคืนก่อน');
      for(const id of config.proposals.bosses['midnight-sovereign'].rewards)if(!document.rewards[id]){Ownership.grant(document,{id},tx,at);result.rewards.push(id);}
    } else if(action.type==='buy-biome-potion'){
      requireRules(config);
      if(event.location?.room!=='cauldron')fail('ซื้อน้ำยากับมอราในห้องเตาผสมก่อน');
      const rule=config.proposals.randomBiomePotion;
      if(!positive(rule?.price)||!positive(rule.durationMs))fail('กติกาน้ำยายังไม่พร้อม');
      addCandy(event,-rule.price,'potion-purchase',at,tx);addItem(event,'random-biome-potion',1);
      result.quantity=1;
    } else if(action.type==='drink-biome-potion'){
      requireRules(config);
      const rule=config.proposals.randomBiomePotion;
      if(!positive(rule?.durationMs)||rule.excludeCurrent!==true)fail('กติกาน้ำยายังไม่พร้อม');
      addItem(event,'random-biome-potion',-1);
      const pool=BIOMES.filter(id=>id!==current.id),biome=pool[Math.floor(random(event)*pool.length)];
      event.totem={biome,until:at+rule.durationMs,source:'potion'};event.selectedBiome=biome;delete event.previewBiome;
      event.visits ||= {hub:false,biomes:{},stories:{}};
      event.visits.biomes[biome]=true;event.location={kind:'biome',biome};
      result.biome=biome;result.previousBiome=current.id;result.firstStory=!event.visits.stories[biome];result.until=event.totem.until;
    } else if (action.type === 'totem') {
      requireRules(config);
      if (!BIOMES.includes(action.biome)) fail('เลือกไบโอมก่อน');
      addCandy(event, -config.proposals.totem.price, 'totem', at, tx);
      event.totem = {biome:action.biome, until:at + config.proposals.totem.durationMs};
      if(config.proposals.journey?.freeTravel){event.selectedBiome=action.biome;delete event.previewBiome;}
    } else if (action.type === 'visitor') {
      requireRules(config);
      const index = action.index, rule = config.proposals.anonymousNpc, slot = Math.floor(at / rule.lifetimeMs);
      if (!Number.isInteger(index) || index < 0 || index >= rule.count) fail('ไม่พบนักเดินทาง');
      const key = slot + ':' + index;
      if (event.visitors[key]) fail('ส่งของให้นักเดินทางคนนี้แล้ว');
      const pool = config.materials.biomes.find(x => x.id === current.id).items.filter(x => x.rarity === 'Common');
      const id = pool[index % pool.length]?.id || (index ? 'pending-human-skull' : 'pending-human-bone');
      addItem(event, id, -rule.quantity); addCandy(event, rule.candy, 'visitor', at, tx); event.visitors[key] = true;
    } else if(action.type==='death-quest-enroll'){
      requireRules(config);event.deathQuests||={};const key=Death.day(now),today=event.deathQuests[key];
      const active=Object.values(event.deathQuests).find(q=>!event.taskClaims['death:'+q.taskId]&&now-q.issuedAt<DAY);
      const existing=today||active;
      if(existing){if(existing.owner!==studentOwner)fail('เควสที่ค้างอยู่ผูกกับผู้ใช้เดิมบนเครื่อง');result.deathQuest=clone(existing);}
      else{const q=Death.create(now,tx,studentOwner);event.deathQuests[key]=q;result.deathQuest=clone(q);}
    } else if(action.type==='death-quest-claim'){
      requireRules(config);const q=Object.values(event.deathQuests||{}).find(q=>q.id===action.quest);
      if(!q||now-q.issuedAt>DAY)fail('เควสนี้หมดเวลาแล้ว รับเควสใหม่ได้');
      const key='death:'+q.taskId;if(event.taskClaims[key])fail('เควสนี้รับ Candy แล้ว');
      const status=Death.status(q,studentOS,studentFocus?.[q.taskId],studentOwner,now);
      if(!status.ready)fail(status.reason);
      const earned=event.taskEarned.filter(x=>x.at>at-DAY).reduce((sum,x)=>sum+x.amount,0),amount=Math.min(config.proposals.taskCandy,config.proposals.taskDailyCap-earned);
      if(amount<=0)fail('Candy จากภารกิจครบเพดาน 24 ชั่วโมงแล้ว');
      addCandy(event,amount,'death-quest',at,tx);event.taskClaims[key]=true;event.taskEarned.push({at,amount});result.candy=amount;
    } else if (action.type === 'studentos-mission'||action.type==='task') {
      requireRules(config);fail('เปลี่ยนเป็นเควสมรณะแล้ว รับเควสและทำงานที่ผูกไว้ก่อน');
    } else if (action.type === 'start-game') {
      requireRules(config);
      const rule = gameDefinition(action.game, config);
      if (rule.biome !== current.id) fail('เกมนี้อยู่ในไบโอมอื่น');
      const game = {id:action.game, session:tx, startAt:at, deadline:rule.duration ? at+rule.duration : null, total:rule.total, found:[], steps:0, mistakes:0, finished:false};
      game.variant=Math.floor(random(event)*3);
      if(rule.total)game.board=shuffled(event,Array.from({length:rule.total},(_,i)=>i));
      if(action.game==='dech-house-spot-difference')game.differences=shuffled(event,[0,1,2,3,4,5,6,7]).slice(0,rule.total);
      if(action.game==='catch-all-ghosts')game.spawnSlots=shuffled(event,[0,1,2,3,4,5,6,7,8]).slice(0,rule.total);
      if(config.proposals.journey?.freeTravel&&action.game==='clear-jacks-garden-vines'){game.mode='memory';game.sequence=shuffled(event,Array.from({length:rule.total},(_,i)=>i));game.revealUntil=at+4500;}
      if(config.proposals.journey?.freeTravel&&action.game==='grave-digging'){game.mode='pairs';game.tiles=shuffled(event,Array.from({length:rule.total},(_,i)=>Math.floor(i/2)));game.open=[];}
      if (action.game === 'ghost-ship-hunt') {
        if (!(event.inventory['spectral-lantern'] > 0)) fail('คราฟต์ Spectral Lantern กับ Tang ก่อน');
        if (event.repairs) fail('ซ่อมเรือก่อนออกเดินทาง');
        game.target = Math.floor(random(event)*3); game.deadline = at+15000;
      }
      if (action.game === 'clear-jacks-garden-vines' && event.quests['jack-clear-garden']?.phase !== 1 && !event.quests['jack-clear-garden']?.complete) fail('ส่ง Rotten Pumpkin ให้ Jack ก่อน');
      if (['grave-digging','catch-all-ghosts'].includes(action.game) && !event.quests['win-death-fragments']?.complete) fail('รับ Shovel จาก Win Q1 ก่อน');
      if (action.game === 'catch-all-ghosts' && !event.proofs['grave-digging']?.complete) fail('ขุดหลุมศพให้จบก่อน');
      const previous = event.games[action.game];
      if (previous && !previous.finished) fail('เล่นรอบปัจจุบันให้จบหรือออกจากเกมก่อน');
      event.games[action.game] = game; result.game = clone(game);
    } else if (action.type === 'game-move') {
      requireRules(config);
      const game = event.games[action.game];
      if (!game || game.session !== action.session || game.finished) fail('รอบเกมนี้จบแล้ว');
      if (action.move === 'abandon') { game.finished = true; game.abandoned = true; }
      else if (game.id === 'ghost-ship-hunt') {
        if (at >= game.deadline || action.move !== game.target) game.mistakes++;
        else game.steps++;
        if (game.mistakes >= 3) {
          finishGame(event, game, false, at); event.repairs = config.proposals.games.shipRepairCandy[Math.min(5,game.steps)];
        } else if (game.steps >= 6) {
          const paid=event.ledger.some(x=>x.source==='ship-chest'&&x.amount>0);
          finishGame(event, game, true, at);result.candy=paid?0:config.proposals.games.shipChestCandy;game.candy=result.candy;
          if(result.candy)addCandy(event,result.candy,'ship-chest',at,tx);
          addItem(event, 'dutchmans-soul-soul-anchor', 1);
        } else { game.target = Math.floor(random(event)*3); game.deadline = at + config.proposals.games.shipStepSeconds[game.steps]*1000; }
      } else if(game.mode==='memory'&&action.move==='hint'){game.revealUntil=at+4500;}
      else if (game.deadline && at >= game.deadline) finishGame(event, game, false, at);
      else {
        if (!Number.isInteger(action.move) || action.move < 0 || action.move >= game.total) fail('เป้าหมายเกมไม่ถูกต้อง');
        if(game.mode==='memory'){
          if(at<game.revealUntil)fail('จดจำลำดับก่อน แล้วค่อยแตะเถาวัลย์');
          if(action.move===game.sequence[game.found.length])game.found.push(action.move);else{game.found=[];game.mistakes++;}
        }else if(game.mode==='pairs'){
          if(game.open.length===2){if(at<game.flipAt+700)fail('ดูสัญลักษณ์ก่อนเปิดแผ่นถัดไป');game.open=[];}
          if(game.found.includes(action.move)||game.open.includes(action.move))fail('เลือกแผ่นหินที่ยังปิดอยู่');
          game.open.push(action.move);game.flipAt=at;
          if(game.open.length===2&&game.tiles[game.open[0]]===game.tiles[game.open[1]]){game.found.push(...game.open);game.open=[];}
        }else{
          if (['clear-jacks-garden-vines','grave-digging'].includes(game.id) && !game.found.includes(action.move) && action.move !== game.found.length) fail('ตามลำดับสัญญาณที่แสดงก่อน');
          if (!game.found.includes(action.move)) game.found.push(action.move);
        }
        if (game.found.length === game.total) finishGame(event, game, true, at);
      }
      result.game = clone(game);
    } else if (action.type === 'repair') {
      requireRules(config);
      if (!event.repairs) fail('เรือพร้อมอยู่แล้ว');
      addCandy(event, -event.repairs, 'ship-repair', at, tx); event.repairs = 0;
    } else fail('ไม่พบการกระทำ');
    event.clock = at;
    return result;
  }
  return Object.freeze({BIOMES, SHORT, DAY, HOUR, build, initial, definitions, moment, shopStock, biomeAt, portalStatus, questStatus,questWait,biomeProgress, gardenUnlocked,weaponStatus,bossStatus,resolveRequirements, checkRequirements, questNeeds, houseAvailability,questAidStatus, gameDefinition, dispatch});
});

},
"rewards/ownership.js":function(module,exports,require){
/* สิทธิ์รางวัลอยู่ต่อได้เมื่อถอด event/; ไม่อ่านไฟล์หรือสูตรของฤดูกาล */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HalloweenOwnership = factory();
})(typeof globalThis === 'undefined' ? this : globalThis, () => {
  'use strict';
  const VERSION = 1;
  function create(owner, season) {
    if (!owner || !season) throw Error('ต้องระบุเจ้าของและฤดูกาล');
    return {version: VERSION, owner, season, revision: 0, event: null, rewards: {}, receipts: {}, updatedAt: null};
  }
  function validate(value, owner, season) {
    if (!value || value.version !== VERSION || value.owner !== owner || value.season !== season || !Number.isSafeInteger(value.revision) || value.revision < 0 || !value.rewards || !value.receipts) throw Error('ข้อมูลห้องลองไม่ตรงเจ้าของหรือรุ่น กรุณาใช้ชุดทดสอบใหม่');
    return value;
  }
  function grant(document, item, receipt, at) {
    if (!item?.id || !receipt) throw Error('ไม่มีหลักฐานรับรางวัล');
    if (!document.rewards[item.id]) document.rewards[item.id] = {id: item.id, receivedAt: at, receipt, permanent: true, restriction: item.restriction || null};
    return document.rewards[item.id];
  }
  function list(document) { return Object.values(document?.rewards || {}).map(x => ({...x})); }
  function createStore({storage, key, owner, season, initial, locks}) {
    if (!storage || !key || !owner || !season) throw Error('ที่เก็บข้อมูลยังไม่พร้อม');
    const read = () => {
      const raw = storage.getItem(key);
      return raw == null ? initial() : validate(JSON.parse(raw), owner, season);
    };
    let queue = Promise.resolve();
    function transact(requestId, update) {
      // คิวเครื่องนี้ + Web Lock ข้ามแท็บ; การเขียนชุดเดียวทำให้สิทธิ์กับยอดไม่แยกกัน
      const run = () => {
        const current = read();
        if (Object.hasOwn(current.receipts, requestId)) return {document: current, result: current.receipts[requestId], replay: true};
        const next = JSON.parse(JSON.stringify(current));
        const result = update(next);
        next.receipts[requestId] = result;
        next.revision = current.revision + 1;
        next.updatedAt = result.at;
        validate(next, owner, season);
        storage.setItem(key, JSON.stringify(next));
        return {document: next, result, replay: false};
      };
      const job = () => locks?.request ? locks.request('studentos-halloween:' + key, run) : run();
      const pending = queue.then(job);
      queue = pending.catch(() => {});
      return pending;
    }
    return Object.freeze({read, transact});
  }
  return Object.freeze({VERSION, create, validate, grant, list, createStore});
});

},
"event/combat.js":function(module,exports,require){
/* Turn-based battles: the server-like core resolves moves, never accepts a win flag. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenCombat=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const lanes=['ซ้าย','กลาง','ขวา'];
  const skills={
    spear:{name:'ยึดสมอ',description:'แทง 1.2 เท่า ลดการโจมตีที่กำลังมา 75% และลดอีก 50% ในเทิร์นถัดไป'},
    axe:{name:'ฟันสะเทือน',description:'ฟัน 1.5 เท่า ทำให้บอสเสียจังหวะและหยุดการโจมตีที่ประกาศไว้ในเทิร์นนี้'},
    quill:{name:'สัญญาโลหิต',description:'แทง 1.1 เท่า ฝากเลือดไหล 3 เทิร์น แต่ละเทิร์นดูดเลือดกลับ 6 หน่วย'},
    scythe:{name:'เก็บเกี่ยววิญญาณ',description:'ฟัน 1 เท่าและฟื้นชีวิต 16 ถ้าหลังฟันบอสเหลือไม่เกิน 25% จะปิดฉากทันที'}
  };
  const skillInfo=weapon=>skills[weapon.type]||{name:'ปล่อยพลัง',description:'โจมตี 2.1 เท่า'};
  function intent(rule,turn,hp,random){
    const patterns={admiral:['sweep','crush','sweep','hex'],pumpkin:['sweep','hex','crush','sweep'],vampire:['sweep','hex','sweep','crush'],reaper:['sweep','crush','hex','sweep'],sovereign:['sweep','crush','sweep','hex'],shadow:['sweep','hex','crush','hex']};
    const phase=hp<=rule.hp/2?2:1,kind=(patterns[rule.shape]||patterns.admiral)[turn%4];
    const lane=Math.floor(random()*3),danger=kind==='hex'?[0,1,2]:kind==='sweep'&&phase===2&&rule.hp>=200?[lane,(lane+1)%3]:[lane];
    return {kind,danger,phase,damage:rule.damage+(phase===2?5:0)};
  }
  function start(rule,weapon,session,at,random){
    return {id:rule.id,session,weapon,turn:0,hp:120,maxHp:120,bossHp:rule.hp,maxBossHp:rule.hp,mana:2,heals:2,effects:{anchor:0,bleed:0},finished:false,clear:false,startAt:at,intent:intent(rule,0,rule.hp,random),log:'อ่านสัญญาณโจมตี แล้วเลือกตอบโต้'};
  }
  function move(b,rule,weapon,action,at,random){
    if(b.finished)throw Error('การต่อสู้นี้จบแล้ว');
    if(action==='retreat'){b.finished=true;b.clear=false;b.endedAt=at;b.log='ถอยกลับมาตั้งหลัก อาวุธและของทั้งหมดอยู่ครบ';return;}
    if(!['strike','skill','guard','heal','dodge-0','dodge-1','dodge-2'].includes(action))throw Error('ไม่พบท่าต่อสู้');
    if(action==='skill'&&b.mana<2)throw Error('พลังเวทไม่พอ ตั้งรับหรือหลบเพื่อฟื้นพลัง');
    if(action==='heal'&&!b.heals)throw Error('ใช้ยาฟื้นพลังหมดแล้ว');
    const incoming=b.intent,power=weapon.power+(rule.weapon===b.weapon?5:0),before=b.hp;
    const effects=b.effects||=( {anchor:0,bleed:0} );
    let hit=0,damage=incoming.kind==='crush'?Math.ceil(incoming.damage*1.25):incoming.damage,description='';
    if(effects.anchor>0){damage=Math.ceil(damage*.5);effects.anchor--;}
    if(action==='strike'){hit=power;description='ฟันโจมตี';}
    if(action==='skill'){
      b.mana-=2;description=skillInfo(weapon).name;
      if(weapon.type==='spear'){hit=Math.round(power*1.2);damage=Math.ceil(damage*.25);effects.anchor=1;}
      else if(weapon.type==='axe'){hit=Math.round(power*1.5);damage=0;description+=' · หยุดท่าบอสแล้ว';}
      else if(weapon.type==='quill'){hit=Math.round(power*1.1);effects.bleed=3;}
      else if(weapon.type==='scythe'){hit=power;b.hp=Math.min(b.maxHp,b.hp+16);if(b.bossHp-hit<=b.maxBossHp*.25){hit=b.bossHp;description+=' · ปิดฉากวิญญาณ';}}
      else hit=Math.round(power*2.1);
    }
    if(action==='guard'){hit=Math.ceil(power*.3);damage=incoming.kind==='crush'?damage:Math.ceil(damage*.18);b.mana=Math.min(4,b.mana+1);description='ตั้งรับและฟื้นเวท';}
    if(action.startsWith('dodge-')){
      const lane=Number(action.at(-1)),safe=!incoming.danger.includes(lane);
      damage=safe?0:incoming.kind==='hex'?Math.ceil(damage*1.25):damage;
      hit=safe?Math.ceil(power*.65):0;b.mana=Math.min(4,b.mana+1);description=safe?'หลบสำเร็จและสวนกลับ':'หลบเข้าจุดโจมตี';
    }
    if(action==='heal'){b.hp=Math.min(b.maxHp,b.hp+48);b.heals--;description='ดื่มยาฟื้นพลัง';}
    if(effects.bleed>0){const drain=Math.ceil(power*.3);hit+=drain;effects.bleed--;b.hp=Math.min(b.maxHp,b.hp+6);description+=' · เลือดไหล '+drain+' / ดูดคืน 6';}
    b.bossHp=Math.max(0,b.bossHp-hit);
    // A finishing blow lands before the announced enemy move.
    if(b.bossHp===0){b.finished=true;b.clear=true;b.endedAt=at;damage=0;}
    b.hp=Math.max(0,b.hp-damage);b.turn++;
    b.log=description+' · ทำ '+hit+' ดาเมจ · รับ '+damage+' ดาเมจ'+(b.hp>before?' · ฟื้นพลังแล้ว':'');
    if(b.hp===0){b.finished=true;b.clear=false;b.endedAt=at;}
    if(!b.finished)b.intent=intent(rule,b.turn,b.bossHp,random);
    return {hit,damage};
  }
  function forecast(b,rule,weapon,action){const copy=JSON.parse(JSON.stringify(b));const outcome=move(copy,rule,weapon,action,b.startAt+copy.turn+1,()=>0);return {...outcome,hp:copy.hp,bossHp:copy.bossHp};}
  function hint(i){
    return i.kind==='hex'?'คำสาปครอบคลุมทุกช่อง · ตั้งรับเพื่อลดความเสียหาย':(i.kind==='crush'?'ทุบทะลุการตั้งรับ':'กวาดโจมตี')+'ทาง'+i.danger.map(n=>lanes[n]).join('และ')+' · หลบไปช่องที่ว่าง';
  }
  return {start,move,hint,lanes,skillInfo,forecast};
});

},
"event/missions.js":function(module,exports,require){
/* Preview-only progress from existing StudentOS records. Never writes to the main application. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HalloweenStudentMissions=factory();
})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const STORE_KEY='studentos.alt.v1',DAY=86400000,THAI_OFFSET=7*3600000;
  const definitions=[
    {id:'add-task',title:'เขียนคำสัญญาของวันนี้',text:'เพิ่มงานใน StudentOS ให้ตัวเองอย่างน้อย 1 งาน',target:1,unit:'งาน',symbol:'✎',href:'../../?go=quick',action:'ไปเพิ่มงาน'},
    {id:'focus-15',title:'จุดโคมด้วยเวลาของเธอ',text:'จับเวลาทำงานสะสม 15 นาที แล้วกดพักหรือทำเสร็จเพื่อบันทึก',target:15,unit:'นาที',symbol:'◷',href:'../../?go=today',action:'ไปเริ่มโฟกัส'},
    {id:'finish-task',title:'ปิดงานก่อนคืนจะผ่าน',text:'ทำงานใน StudentOS เสร็จอย่างน้อย 1 งานในวันนี้',target:1,unit:'งาน',symbol:'✓',href:'../../?go=tasks',action:'ไปดูงานของฉัน'}
  ];
  const stamp=v=>typeof v==='number'?v:typeof v==='string'?Date.parse(v):NaN;
  function dayKey(at){return new Date(at+THAI_OFFSET).toISOString().slice(0,10);}
  function read(storage){try{const value=storage.getItem(STORE_KEY);return value?JSON.parse(value):null;}catch{return null;}}
  function assess(state,at){
    const available=!!state&&typeof state==='object'&&Array.isArray(state.tasks),day=dayKey(at);
    const start=Math.floor((at+THAI_OFFSET)/DAY)*DAY-THAI_OFFSET;
    const today=v=>{const t=stamp(v);return Number.isFinite(t)&&t>=start&&t<=at;};
    const tasks=new Map();
    if(available)for(const t of state.tasks){
      if(!t||typeof t.id!=='string'||!t.id||t.deleted||t.draft||t.sample||t.demo||tasks.has(t.id))continue;
      const created=stamp(t.createdAt);if(Number.isFinite(created)&&created>at)continue;
      tasks.set(t.id,t);
    }
    const intervals=[],seen=new Set();
    for(const s of available&&Array.isArray(state.sessions)?state.sessions:[]){
      if(!s||typeof s.id!=='string'||seen.has(s.id)||!tasks.has(s.taskId))continue;
      seen.add(s.id);const begin=stamp(s.start),end=stamp(s.end),minutes=Number(s.min);
      if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin||end>at||end-begin>4*3600000||!Number.isFinite(minutes)||minutes<1)continue;
      const a=Math.max(start,begin),b=Math.min(end,begin+minutes*60000);
      if(b>a)intervals.push([a,b]);
    }
    intervals.sort((a,b)=>a[0]-b[0]);let ms=0,left=null,right=null;
    for(const [a,b]of intervals){if(left===null){left=a;right=b;}else if(a<=right)right=Math.max(right,b);else{ms+=right-left;left=a;right=b;}}
    if(left!==null)ms+=right-left;
    const values={'add-task':[...tasks.values()].filter(t=>today(t.createdAt)).length,'finish-task':[...tasks.values()].filter(t=>t.done===true&&today(t.doneAt)&&(!Number.isFinite(stamp(t.createdAt))||stamp(t.doneAt)>=stamp(t.createdAt))).length,'focus-15':Math.floor(ms/60000)};
    return {available,day,rows:definitions.map(d=>({...d,value:values[d.id],complete:available&&values[d.id]>=d.target}))};
  }
  const claimKey=(day,id)=>'studentos:'+day+':'+id;
  return {STORE_KEY,definitions,dayKey,read,assess,claimKey};
});

},
"death-quests.js":function(module,exports,require){
/* Local preview quest contract. This module has no network, account writes or DOM dependency. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HalloweenDeathQuests=factory();})(typeof globalThis==='undefined'?this:globalThis,()=>{
  'use strict';
  const REQUEST_KEY='studentos.alt.halloween.taskRequests.v1',FOCUS_KEY='studentos.alt.halloween.questFocus.v1',OWNER_KEY='studentos.alt.owner',MINUTES=20,SEASON='halloween-2026';
  const RESET_KEY='studentos.alt.halloween.previewReset.v1';
  const day=at=>new Date(at+7*3600000).toISOString().slice(0,10);
  const get=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key)||'null')||fallback;}catch{return fallback;}};
  const owner=storage=>{try{return storage.getItem(OWNER_KEY)||'';}catch{return '';}};
  function create(at,nonce,uid){return {id:'death-'+day(at),day:day(at),taskId:'hw-death-'+day(at)+'-'+nonce,nonce,issuedAt:at,minutes:MINUTES,owner:uid||'',season:SEASON};}
  function valid(q){return !!q&&q.season===SEASON&&q.minutes===MINUTES&&typeof q.owner==='string'&&typeof q.nonce==='string'&&q.nonce.length>=4&&Number.isSafeInteger(q.issuedAt)&&q.issuedAt>0&&q.issuedAt<8640000000000000-7*3600000&&q.id==='death-'+day(q.issuedAt)&&q.day===day(q.issuedAt)&&q.taskId==='hw-death-'+q.day+'-'+q.nonce;}
  function task(q){if(!valid(q))throw Error('เควสไม่ถูกต้อง');return {id:q.taskId,subject:'เควสมรณะ',detail:'เควสมรณะ · ลงมืออ่านหรือทำงานที่เลือก 20 นาที',type:'homework',teacher:'',scorePct:null,estMin:MINUTES,due:null,done:false,progress:0,createdAt:new Date(q.issuedAt).toISOString(),halloweenDeathQuest:{...q,localOnly:true}};}
  const isLocal=t=>!!t&&!!t.halloweenDeathQuest?.localOnly&&valid(t.halloweenDeathQuest)&&t.id===t.halloweenDeathQuest.taskId;
  function split(tasks=[],sessions=[]){tasks=Array.isArray(tasks)?tasks:[];sessions=Array.isArray(sessions)?sessions:[];const localTasks=tasks.filter(t=>t?.halloweenDeathQuest?.localOnly===true),ids=new Set(localTasks.map(t=>t.id));return {tasks:tasks.filter(t=>!ids.has(t.id)),sessions:sessions.filter(s=>!ids.has(s.taskId)),localTasks,localSessions:sessions.filter(s=>ids.has(s.taskId)),ids};}
  function publish(storage,q,restore=false){if(!valid(q))throw Error('ไม่พบเควสที่จะส่ง');const queue=get(storage,REQUEST_KEY,[]).filter(x=>valid(x)&&x.taskId!==q.taskId&&x.owner===q.owner).slice(-2);queue.push({...q,restore:!!restore});storage.setItem(REQUEST_KEY,JSON.stringify(queue));}
  function receive(state,requests,uid,at){
    const remaining=[],added=[];if(!state||!Array.isArray(state.tasks))return {added,remaining:requests};
    for(const q of requests){if(!valid(q)||q.owner!==uid||q.issuedAt>at||at-q.issuedAt>2*86400000)continue;const found=state.tasks.find(t=>t.id===q.taskId);
      if(found){if(isLocal(found)&&found.halloweenDeathQuest.nonce===q.nonce&&q.restore&&found.deleted){found.deleted=false;delete found.deletedAt;added.push(found.id);}continue;}
      state.tasks.push(task(q));added.push(q.taskId);
    }
    return {added,remaining};
  }
  function resetLocal(state,signal,uid){
    if(!state||!Array.isArray(state.tasks)||!signal||signal.owner!==uid||!Number.isSafeInteger(signal.at))return false;
    const ids=new Set(state.tasks.filter(t=>t?.halloweenDeathQuest?.localOnly===true&&t.halloweenDeathQuest.issuedAt<=signal.at).map(t=>t.id));if(!ids.size)return false;
    state.tasks=state.tasks.filter(t=>!ids.has(t.id));state.sessions=(state.sessions||[]).filter(s=>!ids.has(s.taskId));if(ids.has(state.running?.taskId))state.running=null;return true;
  }
  // Merge non-overlapping, short monotonic samples. A hidden tab, paused timer or clock jump earns no time.
  function credit(previous,q,{wall,monoDelta,wallDelta,eligible}){
    const p=previous&&previous.nonce===q.nonce?{...previous}:{nonce:q.nonce,activeMs:0,lastCoveredAt:q.issuedAt,updatedAt:q.issuedAt,owner:q.owner};
    if(!valid(q)||!eligible||!Number.isFinite(monoDelta)||monoDelta<0||monoDelta>6500||!Number.isFinite(wallDelta)||Math.abs(wallDelta-monoDelta)>1500||wall<p.updatedAt||wall<q.issuedAt)return p;
    const from=Math.max(q.issuedAt,p.lastCoveredAt,wall-monoDelta),delta=Math.max(0,wall-from);
    p.activeMs=Math.min(wall-q.issuedAt,p.activeMs+delta);p.lastCoveredAt=wall;p.updatedAt=wall;return p;
  }
  function status(q,state,proof,uid,at){
    const invalid={exists:false,minutes:0,ready:false,reason:'รับเควสก่อน แล้วเปิด StudentOS เพื่อให้เควสปรากฏในรายการงาน'};
    if(!valid(q)||q.owner!==uid)return {...invalid,reason:'เควสนี้ผูกกับผู้ใช้เดิมบนเครื่อง'};
    const t=(Array.isArray(state?.tasks)?state.tasks:[]).find(t=>t.id===q.taskId),meta=t?.halloweenDeathQuest;
    if(!t||t.deleted)return invalid;
    if(!isLocal(t)||meta.nonce!==q.nonce||meta.issuedAt!==q.issuedAt||meta.owner!==q.owner||Date.parse(t.createdAt)!==q.issuedAt)return {...invalid,reason:'ข้อมูลเควสไม่ตรงกับตอนรับ'};
    const p=proof&&proof.nonce===q.nonce&&proof.owner===uid&&Number.isFinite(proof.activeMs)&&proof.activeMs>=0&&proof.activeMs<=at-q.issuedAt&&proof.updatedAt<=at?proof:null;
    const active=p?.activeMs||0,doneAt=Date.parse(t.doneAt),needed=q.minutes*60000;
    const intervals=[];for(const s of Array.isArray(state.sessions)?state.sessions:[]){const a=Date.parse(s.start),b=Date.parse(s.end);if(s.taskId===q.taskId&&Number.isFinite(a)&&Number.isFinite(b)&&a>=q.issuedAt&&b>a&&b<=at&&b-a<=4*3600000&&Number.isFinite(s.min)&&s.min>=1)intervals.push([a,Math.min(b,a+s.min*60000)]);}
    intervals.sort((a,b)=>a[0]-b[0]);let recorded=0,end=q.issuedAt;for(const [a,b]of intervals){recorded+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
    const minutes=Math.floor(Math.min(active,at-q.issuedAt)/60000),ready=active>=needed&&recorded>=needed&&t.done===true&&Number.isFinite(doneAt)&&doneAt>=q.issuedAt+needed&&doneAt>=p.updatedAt&&doneAt<=at;
    return {exists:true,minutes:Math.min(q.minutes,minutes),ready,reason:ready?'ครบเงื่อนไขแล้ว กลับไปรับ Candy ห้องลองได้':minutes<q.minutes?'เปิดหน้าจอโฟกัสของงานเควสนี้ให้ครบ 20 นาที แล้วกดทำเสร็จ':'ครบเวลาแล้ว กดทำเสร็จใน StudentOS ก่อนกลับมารับ'};
  }
  return {REQUEST_KEY,FOCUS_KEY,RESET_KEY,OWNER_KEY,MINUTES,day,get,owner,create,valid,task,isLocal,split,publish,receive,resetLocal,credit,status};
});

},
"rewards/catalog.js":function(module,exports,require){
/* Permanent Halloween reward definitions; no currency, grants or random draws. */
(function(root,factory){const catalog=factory();if(typeof module==='object'&&module.exports)module.exports=catalog;else root.StudentOSHalloweenRewards=catalog;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const biomes={dutchman:{name:"Dutchman's Soul",npc:'Tang The Sailor',color:'#87d9c1',dark:'#102c31'},jack:{name:"Jack’s Hollow",npc:"Jack’o Tigger",color:'#e6b37c',dark:'#352024'},vampire:{name:'Vampire Mansion',npc:'Mr. Dech',color:'#dc9bb4',dark:'#30182d'},graveyard:{name:'Eternal Graveyard',npc:'Win, the Soul Reaper',color:'#b9abe9',dark:'#211d3d'},all:{name:'Midnight Academy',color:'#e5b4d0',dark:'#261c36'}};
 const tiers={Common:{order:1,color:'#b4c1c4',design:'ชิ้นเล็ก เส้นสะอาด รายละเอียดชัดเมื่อวางในห้อง'},Uncommon:{order:2,color:'#91c7a6',design:'เพิ่มแสงประจำไบโอมและรายละเอียดเฉพาะชิ้น'},Rare:{order:3,color:'#8fb9eb',design:'ชุดเต็มตัว ออกแบบตัวละครและเครื่องแต่งกาย'},Epic:{order:4,color:'#c5a3e1',design:'ฉากและบรรยากาศเฉพาะไบโอม พร้อมองค์ประกอบแอป'},Legendary:{order:5,color:'#e7bd79',design:'การแสดงหลายชั้น มีจุดเปิด จุดพีคและจุดจบ'},Secret:{order:6,color:'#e5a1ba',design:'ธีมหลักเปลี่ยนทุกส่วน มีฉากเคลื่อนไหวและเพลง'},Mystical:{order:7,color:'#83d6cf',design:'วัตถุ Main Quest ลายแกะ วงอักขระและแสงเฉพาะตัว'},Collector:{order:8,color:'#ead99d',design:'เหรียญเฉพาะผู้สะสมครบ ไม่ใช่ผลสุ่ม'}};
 const items=[];
 const add=(id,name,kind,rarity,biome,art,description,features,extra={})=>items.push(Object.freeze({id,name,kind,rarity,biome,art,description,features,permanent:true,...extra}));
 add('harbor-lantern','โคมไฟท่าเรือ','room','Common','dutchman','lantern','โคมทองเหลืองเก่าจากท่าเรือ แสงอุ่นเล็ก ๆ สำหรับคืนที่หมอกลง',['ทองเหลืองขัดเก่า','เหมาะกับมุมโต๊ะ'],{slot:'desk'});
 add('laughing-pumpkin','ฟักทองหัวเราะ','room','Common','jack','pumpkin','ฟักทองแกะหน้าขี้เล่นของ Jack เปลี่ยนโต๊ะอ่านหนังสือเป็นมุมฮาโลวีน',['เปลวเทียนสีอำพัน','ชิ้นเริ่มต้นของคอลเลกชัน'],{slot:'desk'});
 add('crimson-candle','เชิงเทียนกุหลาบเลือด','room','Common','vampire','candle','เชิงเทียนสีเงินกับกุหลาบแดงหนึ่งดอก จากโถงทางเดินคฤหาสน์',['เงาโลหะสีเงิน','แสงเทียนแดงหม่น'],{slot:'shelf'});
 add('quiet-gravestone','ป้ายหลุมศพจิ๋ว','room','Common','graveyard','grave','ป้ายหินชื่อจาง ๆ กับดอกไม้สีม่วง ทำให้มุมห้องสงบอย่างประหลาด',['หินสลักรูปพระจันทร์','ดอกไม้วิญญาณ'],{slot:'shelf'});
 add('bottled-dutchman','เรือผีในขวด','room','Uncommon','dutchman','bottle','เรือ Dutchman จิ๋วลอยอยู่ในขวดแก้ว หมอกเขียวขังอยู่ภายใน',['ขวดแก้วสะท้อนแสง','เรือพร้อมใบและเสากระโดง'],{slot:'shelf'});
 add('jacks-portrait','ภาพเหมือน Jack','room','Uncommon','jack','portrait','ภาพวาด Jack ในกรอบไม้เถาวัลย์ ดวงตาเหมือนจะหันมาตามเรา',['กรอบไม้แกะ','ลายเถาวัลย์และหัวฟักทอง'],{slot:'poster'});
 add('velvet-bat','ม่านค้างคาวกำมะหยี่','room','Uncommon','vampire','banner','ผ้ากำมะหยี่ไวน์แดง ปักค้างคาวเงินและตราประจำคฤหาสน์',['ผ้าพับซ้อนหลายชั้น','ตราค้างคาวเงิน'],{slot:'hanging'});
 add('little-wisp','วิญญาณเฝ้าห้อง','room','Uncommon','graveyard','wisp','วิญญาณตัวน้อยผู้ชอบนั่งเฝ้าตอนอ่านหนังสือ เก็บแสงจันทร์ไว้ในอ้อมแขน',['ฐานพรมรูปวงจันทร์','วิญญาณโปร่งแสง'],{slot:'pet'});
 add('sai-witch','น้องไซ · แม่มดรัตติกาล','costume','Rare','jack','witch','หมวกแม่มด ชุดพิธีสีดำ และเครื่องประดับเวทมนตร์ เรียกน้องไซผ่านวงอัญเชิญ',['ชุดเต็มตัวของน้องไซ','ฉากอัญเชิญก่อนเผยชุด','ใช้กับตัวช่วยในแอป'],{mascot:'sai',source:'ritual',asset:'theme-assets/sai-witch.webp'});
 add('hook-mummy','น้องฮูก · มัมมี่ต้องคำสาป','costume','Rare','graveyard','mummy','ผ้าพันมัมมี่เก่า ดวงตาเรืองแสง และตราผนึกที่ขาดออกเมื่ออัญเชิญ',['ชุดเต็มตัวของน้องฮูก','ฉากอัญเชิญก่อนเผยชุด','ใช้กับตัวช่วยในแอป'],{mascot:'hook',source:'ritual',asset:'theme-assets/hook-mummy.webp'});
 add('theme-ghostship','ธีม Dutchman · เรือในม่านหมอก','theme','Epic','dutchman','ship','เดินทางบนดาดฟ้าเรือผีใต้แสงเขียว คลื่น หมอก และโคมวิญญาณล้อมพื้นที่ทำงาน',['ฉากเรือและทะเลหลายชั้น','การ์ดและปุ่มในโทนทองเหลือง','หมอกทะเลเคลื่อนไหว'],{theme:'hw-ghostship',source:'main-quest',questId:'dutchman-ghost-commander'});
 add('theme-jackhollow','ธีม Jack’o Lantern · ป่าเทียนฟักทอง','theme','Epic','jack','hollow','ป่าร้างสีอำพันที่มีฟักทองและแสงเทียนตามทาง งานแต่ละใบเหมือนจดหมายในป่า',['ป่าและทางเดินไฟฟักทอง','การ์ดสีเปลือกไม้','ประกายถ่านไฟช้า ๆ'],{theme:'hw-jackhollow',source:'main-quest',questId:'jack-sweet-surprise'});
 add('theme-vampire','Vampire Mansion · คฤหาสน์จันทราเลือด','theme','Epic','vampire','mansion','หน้าต่างโค้ง กำมะหยี่ และจันทร์แดงเหนือคฤหาสน์ บรรยากาศหรูแต่เย็นเยียบ',['คฤหาสน์และจันทร์แดง','เส้นกรอบเงินและสีไวน์','เงาค้างคาวเคลื่อนผ่าน'],{theme:'hw-vampire',source:'main-quest',questId:'dech-wrong-letter'});
 add('theme-graveyard','Eternal Graveyard · สวนวิญญาณ','theme','Epic','graveyard','cemetery','สุสานใต้แสงจันทร์ม่วงกับดอกไม้เรืองแสง จังหวะสงบสำหรับคืนอ่านหนังสือ',['สุสานและดอกไม้จันทร์','การ์ดสีหินและลาเวนเดอร์','วิญญาณลอยผ่านเบา ๆ'],{theme:'hw-graveyard',source:'main-quest',questId:'win-unbind-scythe'});
 add('fx-soulwake','รอยคลื่นวิญญาณ','effect','Epic','dutchman','wake','แสงวิญญาณพางานที่ทำเสร็จออกไปพร้อมระลอกคลื่น',['จุดโคมนำทางตามลำดับ 3 ดวง','รอยคลื่นและละอองวิญญาณ','เล่นหรือข้ามได้'],{effect:'wake'});
 add('fx-pumpkin-sparks','ประกายฟักทอง','effect','Epic','jack','sparks','ฟักทองเปล่งแสงแล้วปล่อยสะเก็ดไฟสีอำพันแทนกระดาษฉลอง',['แตะจุดฟักทองทั้ง 3 ลูก','ประกายไฟล้อมใบงาน','เล่นหรือข้ามได้'],{effect:'sparks'});
 add('fx-velvet-flight','ปีกกำมะหยี่','effect','Epic','vampire','bats','ฝูงค้างคาวสีเงินกางปีกผ่านแสงไวน์แดง',['ลากใบงานไปให้ค้างคาว','ค้างคาวพางานบินออกไป','เล่นหรือข้ามได้'],{effect:'bats'});
 add('fx-soul-bloom','ดอกไม้วิญญาณ','effect','Epic','graveyard','bloom','ดอกไม้แสงจันทร์บานรอบเครื่องหมายงานเสร็จ',['แตะปลุกดอกไม้ทั้ง 4 ดอก','ดอกไม้แสงจันทร์ล้อมใบงาน','เล่นหรือข้ามได้'],{effect:'bloom'});
 add('fx-dutchman-arrival','The Dutchman Arrives','effect','Legendary','dutchman','ship','หมอกเปิดเป็นทาง เรือผีแล่นผ่านหน้าจอก่อนสลายเป็นดาวทะเล',['ลากใบงานขึ้นเรือ Dutchman','เรือผีพางานลับเข้าไปในหมอก','เล่นหรือข้ามได้'],{effect:'arrival'});
 add('fx-jacks-verdict','Jack’s Final Verdict','effect','Legendary','jack','scythe','ลากเคียวพิธีของ Jack ฟันใบงานจนฉีกขาดกระจาย แล้วปล่อยเปลวไฟฟักทองปิดฉาก',['ลากเคียวฟันใบงาน 3 ครั้ง','เศษใบงานกระจายตามรอยฟัน','เปลวไฟฟักทองปิดฉาก'],{effect:'verdict'});
 add('fx-crimson-eclipse','Crimson Eclipse','effect','Legendary','vampire','moon','จันทร์แดงถูกเงาบัง ก่อนระเบิดแสงทับทิมและฝูงค้างคาวออกมาพร้อมกัน',['แตะจัดเงาจันทร์ให้ซ้อนกัน 3 ชั้น','วงรัศมีทับทิมและจันทราคราส','เล่นหรือข้ามได้'],{effect:'eclipse'});
 add('fx-reaper-gate','Reaper’s Gate','effect','Legendary','graveyard','gate','ประตูสุสานเปิด เคียววิญญาณลากเส้นจันทร์ แล้วปล่อยงานหายไปในประตู',['ลากใบงานเข้าสู่ประตูสุสาน','ประตูและผนึกงานวิญญาณ','เล่นหรือข้ามได้'],{effect:'gate'});
 add('theme-midnight-academy','Halloween · Midnight Academy','theme','Secret','all','academy','ธีมหลักของคืนฮาโลวีน เปลี่ยนทั้งโรงเรียน การ์ด ปุ่ม ไอคอน ตัวช่วย เสียงและจังหวะของแอป',['ธีมรางวัลที่หายากที่สุด','โรงเรียน สุสาน ผีเดิน หมอกและเทียน','การ์ดและปุ่มตกแต่งครบ','เพลง Midnight Waltz และเสียงประกอบ'],{theme:'halloween',source:'final-boss'});
 add('greater-spear','Greater Spear of Dutchman','relic','Mystical','dutchman','spear','หอกของผู้ผ่าน Main Quest แห่ง Dutchman’s Soul โลหะทะเลลึกครอบผลึกวิญญาณ',['รางวัล Main Quest ของ Tang The Sailor','หอกแกะลายสมอและผลึก','ตรวจชมวัตถุได้ใกล้ ๆ'],{source:'main-quest'});
 add('jacks-axe','Axe of Jack’o Lantern','relic','Mystical','jack','axe','ขวานประจำตัว Jack ใบคมสีอำพันกับด้ามเถาวัลย์ที่ยังมีไฟอยู่ภายใน',['รางวัล Main Quest ของ Jack’o Tigger','ใบขวานสลักตาฟักทอง','วงอักขระไฟและเถาวัลย์'],{source:'main-quest'});
 add('cruor-quill','Cruor Quill','relic','Mystical','vampire','quill','ปากกาขนนกสีเลือดของ Mr. Dech ปลายเงินเขียนแสงแดงลงบนอากาศ',['รางวัล Quest 1 ของ Mr. Dech','ขนนกโลหะซ้อนละเอียด','หยดทับทิมและตราคฤหาสน์'],{source:'main-quest',questId:'dech-intruder-punishment'});
 add('dullahan-scythe','Scythe of Dullahan','relic','Mystical','graveyard','scythe','เคียวที่เกี่ยวแสงจันทร์แทนชีวิต ด้ามสีดำและคมแก้ววิญญาณของ Soul Reaper',['รางวัล Main Quest ของ Win, the Soul Reaper','เคียวทรงจันทร์เสี้ยว','โซ่ ผนึกและประกายวิญญาณ'],{source:'main-quest',questId:'win-unbind-scythe'});
 add('crown-of-midnight','เหรียญผู้สะสมแห่งรัตติกาล','badge','Collector','all','medal','เครื่องหมายของผู้ซื้อของครบตามรายการร้านอีเวนต์ รวมตราของทั้งสี่ไบโอมไว้ในเหรียญเดียว',['เงื่อนไขซื้อครบทุกอย่างในร้านอีเวนต์','กรอบทองดำและตราทั้งสี่ไบโอม','เก็บเป็นเหรียญถาวร'],{source:'complete-shop'});
 add('theme-moon-candle','Moon & Candle','theme','Secret','all','academy','ธีม Moon & Candle ในรูปแบบเดิม รับคู่กับธีม Halloween เมื่อพิชิตราชันเที่ยงคืน',['รางวัลพร้อม Halloween เมื่อชนะราชันเที่ยงคืน','สลับมืดและสว่างได้จากโทนสี','คงฉาก สี และรายละเอียดดั้งเดิมของ Moon & Candle'],{theme:'moonlight',source:'final-boss'});
 add('midnight-conqueror','ตราผู้พิชิตราชันเที่ยงคืน','badge','Secret','all','medal','ตราชัยชนะของผู้ผ่านสี่ไบโอมและพิชิตราชันเที่ยงคืน',['รับพร้อมธีม Halloween และ Moon & Candle','เก็บเป็นตราถาวร','แยกจากเหรียญผู้สะสมของร้าน'],{source:'final-boss'});
 const themeBars={'halloween':'#100D1B','moonlight':'#170B36','hw-ghostship':'#101b24','hw-jackhollow':'#21151c','hw-vampire':'#1b1425','hw-graveyard':'#171728'};
 const themeNames={'halloween':'Halloween','moonlight':'Moon & Candle','hw-ghostship':'Dutchman','hw-jackhollow':"Jack’o Lantern",'hw-vampire':'Vampire Mansion','hw-graveyard':'Eternal Graveyard'};
 return Object.freeze({items:Object.freeze(items),biomes:Object.freeze(biomes),tiers:Object.freeze(tiers),themeBars:Object.freeze(themeBars),themeNames:Object.freeze(themeNames),find:id=>items.find(item=>item.id===id)});
});

},
"event/season.js":function(module,exports,require){
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HalloweenSeason=factory();})(globalThis,()=>{
 'use strict';
 const START='2026-10-28T00:00:00+07:00',END='2026-12-01T00:00:00+07:00';
 function state(at=Date.now()){return at<Date.parse(START)?'upcoming':at<Date.parse(END)?'active':'ended';}
 return Object.freeze({id:'halloween-2026',startAt:START,endAt:END,timezone:'Asia/Bangkok',state,label:'28 ตุลาคม – 30 พฤศจิกายน 2569'});
});

},
"server/authority.cjs":function(module,exports,require){
/* Runs only on the trusted service. Browser state, clocks and reward lists are never input. */
'use strict';
function create({Core,Death,Season,config,randomSeed}) {
 const allowed=new Set(['claim-welcome','training-start','training-move','enter-hub','enter-room','enter-biome','story-seen','house','quest','buy','craft','seed-quest','plant','water','harvest','sell-crop','equip-weapon','start-boss','battle-move','claim-final-theme-set','buy-biome-potion','drink-biome-potion','totem','visitor','death-quest-enroll','death-quest-claim','start-game','game-move','repair','focus-pulse','focus-finish']);
 const keys=['type','room','biome','house','choice','quest','branch','item','stockEpoch','recipe','quantity','expectedGrown','expectedInventory','weapon','boss','session','move','index','game','taskId','active'];
 const copy=x=>JSON.parse(JSON.stringify(x));
 function clean(input){
  if(!input||typeof input!=='object'||!allowed.has(input.type))throw Error('ไม่รองรับคำสั่งนี้ในกิจกรรมจริง');
  const a={};for(const key of keys){const v=input[key];if(v!==undefined){if(!['string','number','boolean'].includes(typeof v)||typeof v==='string'&&v.length>180||typeof v==='number'&&!Number.isSafeInteger(v))throw Error('รูปแบบคำสั่งไม่ถูกต้อง');a[key]=v;}}
  return a;
 }
 function publicDocument(document){const d=copy(document);delete d.event.rng;delete d.event._lastActionAt;d.receipts={};return d;}
 function initial(uid,at){const d=Core.initial(config,uid,at,randomSeed());d.event.authoritative=true;return d;}
 function apply(document,input,{uid,at,tx}){
  const action=clean(input);
  if(document.owner!==uid||document.season!==Season.id)throw Error('เซฟไม่ตรงกับบัญชีนี้');
  if(Season.state(at)!=='active')throw Error(Season.state(at)==='upcoming'?'กิจกรรมเปิดวันที่ 28 ตุลาคม':'กิจกรรมจบแล้ว รางวัลที่ได้รับยังอยู่ในบัญชี');
  const d=copy(document),e=d.event;e.timeOffset=0;delete e.previewBiome;
  // Unpredictable entropy is supplied by the server for every transaction.
  e.rng=randomSeed();
  if(['house','game-move','battle-move','training-move'].includes(action.type)&&at<(e._lastActionAt||0)+120)throw Error('รอสักครู่ก่อนทำรายการถัดไป');
  let result;
  if(action.type==='focus-pulse'||action.type==='focus-finish'){
   const q=Object.values(e.deathQuests||{}).find(q=>q.taskId===action.taskId&&q.owner===uid);
   if(!q||at-q.issuedAt>Core.DAY||e.taskClaims['death:'+q.taskId])throw Error('ไม่พบเควสที่กำลังทำ');
   e.focusProofs||={};const p=e.focusProofs[q.taskId]||{activeMs:0,lastAt:0,session:null,doneAt:null};
   if(action.type==='focus-finish'){
    if(p.activeMs<q.minutes*60000)throw Error('เวลาโฟกัสที่เซิร์ฟเวอร์ยืนยันยังไม่ครบ');
    p.doneAt=at;p.lastAt=0;p.session=null;
   }else{
    if(typeof action.session!=='string'||action.session.length<16)throw Error('รอบโฟกัสไม่ถูกต้อง');
    if(action.active===true){
     const elapsed=at-p.lastAt;
     if(p.session===action.session&&elapsed>0&&elapsed<=16000)p.activeMs=Math.min(q.minutes*60000,p.activeMs+elapsed);
     // A second tab cannot steal an active lease or count the same seconds again.
     if(!p.session||p.session===action.session||elapsed>16000){p.session=action.session;p.lastAt=at;}
    }else if(p.session===action.session){p.lastAt=0;p.session=null;}
   }
   e.focusProofs[q.taskId]=p;result={at,type:action.type,rewards:[],minutes:Math.floor(p.activeMs/60000)};
  }else{
   const context={now:at,tx,studentOwner:uid};
   if(action.type==='death-quest-claim'){
    const q=Object.values(e.deathQuests||{}).find(q=>q.id===action.quest),p=q&&e.focusProofs?.[q.taskId];
    if(!q||!p?.doneAt||p.activeMs<q.minutes*60000)throw Error('ทำเควสและโฟกัสให้ครบก่อนรับ Candy');
    const task=Death.task(q);task.done=true;task.doneAt=new Date(p.doneAt).toISOString();
    context.studentOS={tasks:[task],sessions:[{taskId:q.taskId,start:new Date(q.issuedAt).toISOString(),end:new Date(p.doneAt).toISOString(),min:q.minutes}]};
    context.studentFocus={[q.taskId]:{nonce:q.nonce,owner:uid,activeMs:p.activeMs,updatedAt:p.doneAt}};
   }
   result=Core.dispatch(d,config,action,context);
   if(result.deathQuest){result.deathQuest.authoritative=true;e.deathQuests[result.deathQuest.day].authoritative=true;}
  }
  e._lastActionAt=at;d.revision=document.revision+1;d.updatedAt=at;
  return {document:d,result};
 }
 return Object.freeze({clean,publicDocument,initial,apply});
}
module.exports={create};

},
"server/handler.cjs":function(module,exports,require){
'use strict';
function create({authority,db,authenticate,clock=Date.now,season}){
 const origins=new Set(['https://nadokagenou.github.io','http://127.0.0.1:4201','http://127.0.0.1:4202']);
 return async function handler(request){
  const origin=request.headers.get('origin'),headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return reply({error:'ต้นทางนี้ไม่ได้รับอนุญาต'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'ใช้ POST เพื่ออ่านหรือทำรายการ'},405);
  try{
   const uid=await authenticate(request.headers.get('authorization')||'');
   if(!uid)return reply({error:'เข้าสู่ระบบ StudentOS ก่อนเล่นกิจกรรม'},401);
   const raw=await request.text();if(raw.length>6000)return reply({error:'คำสั่งยาวเกินไป'},413);
   let body;try{body=JSON.parse(raw);}catch{return reply({error:'รูปแบบคำสั่งไม่ถูกต้อง'},400);}
   const snapshot=async()=>{const row=await db.read(uid,season.id);return row?.document||authority.initial(uid,clock());};
   if(body.action?.type==='read')return reply({document:authority.publicDocument(await snapshot()),serverNow:clock(),phase:season.state(clock())});
   if(typeof body.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId))return reply({error:'ไม่มีรหัสธุรกรรมที่ถูกต้อง'},400);
   const action=authority.clean(body.action),tx=body.requestId;
   const previous=await db.receipt(uid,season.id,tx);
   if(previous){if(JSON.stringify(Object.entries(previous.action).sort())!==JSON.stringify(Object.entries(action).sort()))return reply({error:'รหัสธุรกรรมนี้ถูกใช้กับรายการอื่นแล้ว'},409);return reply({result:previous.result,document:authority.publicDocument(await snapshot()),serverNow:clock(),replay:true});}
   for(let attempt=0;attempt<4;attempt++){
    const current=await snapshot(),next=authority.apply(current,action,{uid,at:clock(),tx});
    const saved=await db.commit({uid,season:season.id,expected:current.revision,tx,action,...next});
    if(saved.committed)return reply({result:saved.result,document:authority.publicDocument(await snapshot()),serverNow:clock(),replay:saved.replay});
   }
   return reply({error:'เซฟเปลี่ยนจากอีกเครื่อง กรุณาลองรายการนี้อีกครั้ง'},409);
  }catch(error){return reply({error:error.publicMessage||error.message||'เชื่อมกิจกรรมไม่สำเร็จ ยังไม่ได้ยืนยันรายการ'},error.status||400);}
 };
}
module.exports={create};

}
};
const cache={};
function load(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;factories[id](m,m.exports,load);return m.exports;}
export const Core=load("event/core.js"),Catalog=load("rewards/catalog.js"),Death=load("death-quests.js"),Season=load("event/season.js"),Authority=load("server/authority.cjs"),Handler=load("server/handler.cjs");
