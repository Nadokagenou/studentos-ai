/* Shared rules. The trusted service enables authoritative mode; preview tools remain preview-only. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../rewards/ownership.js'),require('./combat.js'),require('./missions.js'),require('../death-quests.js'),require('../study-pact.js'),require('./brain-games.js'),require('./rotations.js'));
  else root.HalloweenEventCore = factory(root.HalloweenOwnership,root.HalloweenCombat,root.HalloweenStudentMissions,root.HalloweenDeathQuests,root.HalloweenStudyPact,root.HalloweenBrainGames,root.HalloweenRotations);
})(typeof globalThis === 'undefined' ? this : globalThis, (Ownership,Combat,Missions,Death,Pact,Brain,Rotations) => {
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
      const featured=personal?event.totem.biome:config.proposals.journey?.hourly?BIOMES[Rotations.window(at).index]:BIOMES[Math.floor(hour/6)];
      if(config.preview&&event.previewBiome)return {id:event.previewBiome,cycle,override:true,bonusBiome:null};
      const selected=event.selectedBiome;
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
    if(config.proposals?.journey?.dechWaitMs){const nextAt=(previous.completedAt??0)+config.proposals.journey.dechWaitMs;return {waiting:moment(document,now)<nextAt,nextAt};}
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
  // The UI and objective must honor the same legacy-craft exception as dispatch.
  function questRequirements(document,config,quest,requirements,branch){
    if(quest.preserveExistingCraft&&(document.event.inventory['spectral-lantern']||0)>0)return {items:[{id:'spectral-lantern',name:'Spectral Lantern',quantity:1,consume:false,mustPossess:true}]};
    return resolveRequirements(config,quest,requirements,branch);
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
      try { requirements = questRequirements(document, config, quest, phase.requirements, branch); } catch (error) { if (!best) best = {branch, requirements:null, missing:[], error:error.message}; continue; }
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
  function preparePlayback(game,event,at) {
    if(game.playback===2)return;
    game.playback=2;game.lastInputAt=at;
    if(game.id==='ghost-ship-hunt'){game.cueIndex=0;game.cues=[game.target,...Array.from({length:8},()=>Math.floor(random(event)*3))];}
  }
  function playInputs(document,config,action,now,tx,receivedAt) {
    const source=document.event.games[action.game];
    if(!source||source.session!==action.session||source.finished||source.playback!==2)fail('ไม่พบรอบเกมที่กำลังเล่น');
    if(!Array.isArray(action.inputs)||!action.inputs.length||action.inputs.length>96)fail('ลำดับการเล่นไม่ถูกต้อง');
    const next=clone(document),arrival=moment(document,receivedAt),game=next.event.games[action.game];let candy=0;
    for(let i=0;i<action.inputs.length;i++){
      const row=action.inputs[i];
      if(!Array.isArray(row)||row.length!==2||!(Number.isSafeInteger(row[0])||['hint','timeout'].includes(row[0]))||!Number.isSafeInteger(row[1])||row[1]<0||row[1]>2*DAY)fail('ลำดับการเล่นไม่ถูกต้อง');
      const inputAt=game.startAt+row[1];
      if(inputAt<(game.lastInputAt??game.startAt)||inputAt>arrival)fail('เวลาการเล่นไม่ตรงกับรอบนี้');
      const deadline=game.deadline;
      next.event.clock=Math.min(next.event.clock,inputAt);
      const result=dispatch(next,config,{type:'game-move',game:action.game,session:action.session,move:row[0]},{now:inputAt-next.event.timeOffset,tx:tx+':'+i});
      if(game.finished&&game.clear&&deadline&&arrival>=deadline)fail('ผลเกมมาถึงหลังเวลาของรอบนี้หมดแล้ว');
      candy+=result.candy||0;game.lastInputAt=inputAt;
    }
    Object.assign(document.event,next.event);
    return {game:clone(game),...(candy?{candy}:{})};
  }
  function dispatch(document, config, action, {now, tx, studentOS,studentOwner='',studentFocus,studyPact,receivedAt=now}) {
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
      event.selectedBiome=action.biome;if(!config.preview)delete event.previewBiome;
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
      if(!config.proposals.journey?.enabled||event.welcomeClaimed||event.quests['dutchman-light-in-darkness']?.complete)fail('รับชุดเริ่มต้นแล้ว');
      const candy=Math.max(0,50-event.candy);addCandy(event,candy,'welcome',at,tx);
      for(const id of ['dutchmans-soul-abyssal-rock','dutchmans-soul-dutchman-s-lantern'])if(!(event.inventory[id]>0))addItem(event,id,1);
      event.welcomeClaimed={at,tx};event.selectedBiome=BIOMES[0];delete event.previewBiome;
      if(config.proposals.journey?.hourly)event.totem={biome:BIOMES[0],until:at+15*60000,source:'welcome'};
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
      if(rule.biome&&rule.biome!==current.id&&action.move!=='retreat'&&!config.proposals.journey?.finishActiveBattles)fail('ไบโอมเปลี่ยนแล้ว ถอยกลับก่อนเริ่มใหม่');
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
      if(config.proposals.journey?.freeTravel){event.selectedBiome=action.biome;if(!config.preview)delete event.previewBiome;}
    } else if (action.type === 'visitor') {
      requireRules(config);
      const index = action.index, rule = config.proposals.anonymousNpc, slot = Math.floor(at / rule.lifetimeMs);
      if (!Number.isInteger(index) || index < 0 || index >= rule.count) fail('ไม่พบนักเดินทาง');
      const key = slot + ':' + index;
      if (event.visitors[key]) fail('ส่งของให้นักเดินทางคนนี้แล้ว');
      const pool = config.materials.biomes.find(x => x.id === current.id).items.filter(x => x.rarity === 'Common');
      const id = pool[index % pool.length]?.id || (index ? 'pending-human-skull' : 'pending-human-bone');
      addItem(event, id, -rule.quantity); addCandy(event, rule.candy, 'visitor', at, tx); event.visitors[key] = true;
    } else if(action.type==='study-claim'){
      requireRules(config);const q=config.preview?studyPact:event.studyPacts?.active;
      const uid=config.preview?studentOwner:document.owner;if(!Pact.ready(q,uid,now)||q.id!==action.pact)fail('ทำพันธสัญญางานจริงให้ครบก่อนรับ');
      const key='study:'+q.day+':'+q.index;if(event.taskClaims[key])fail('รับพันธสัญญาช่วงนี้แล้ว');
      const earned=event.taskEarned.filter(x=>x.at>at-DAY).reduce((s,x)=>s+x.amount,0),amount=Math.max(0,Math.min(10,config.proposals.taskDailyCap-earned));
      addCandy(event,amount,'study-pact',at,tx);event.taskClaims[key]=true;if(amount)event.taskEarned.push({at,amount});
      result.chapter=Pact.chapter(event,q,at);if(!config.preview)event.studyPacts.active.claimed=true;
      result.candy=amount;result.pact=q.id;
    } else if(action.type==='brain-start'){
      requireRules(config);if(event.brainGame&&!event.brainGame.finished)fail('จบรอบปัจจุบันหรือพักก่อนเริ่มใหม่');result.brainGame=clone(Brain.start(event,tx,at,()=>random(event)));
    } else if(action.type==='brain-move'){
      requireRules(config);const g=event.brainGame;if(!g||g.session!==action.session)fail('ไม่พบเกมพักสมองรอบนี้');result.brainGame=clone(Brain.move(g,action.move,at,()=>random(event)));
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
    } else if(action.type==='game-ready') {
      requireRules(config);const game=event.games[action.game];
      if(!game||game.session!==action.session||game.finished)fail('ไม่พบรอบเกมที่กำลังเล่น');
      preparePlayback(game,event,at);result.game=clone(game);
    } else if(action.type==='game-inputs') {
      requireRules(config);Object.assign(result,playInputs(document,config,action,now,tx,receivedAt));
    } else if (action.type === 'start-game') {
      requireRules(config);
      const rule = gameDefinition(action.game, config);
      if (rule.biome !== current.id) fail('เกมนี้อยู่ในไบโอมอื่น');
      const game = {id:action.game, session:tx, startAt:at, deadline:rule.duration ? at+rule.duration : null, total:rule.total, found:[], steps:0, mistakes:0, finished:false};
      game.variant=Math.floor(random(event)*3);
      if(rule.total)game.board=shuffled(event,Array.from({length:rule.total},(_,i)=>i));
      if(action.game==='dech-house-spot-difference')game.differences=shuffled(event,[0,1,2,3,4,5,6,7]).slice(0,rule.total);
      if(action.game==='catch-all-ghosts')game.spawnSlots=shuffled(event,[0,1,2,3,4,5,6,7,8]).slice(0,rule.total);
      if(config.proposals.journey?.enabled&&action.game==='clear-jacks-garden-vines'){game.mode='memory';game.sequence=shuffled(event,Array.from({length:rule.total},(_,i)=>i));game.revealUntil=at+4500;}
      if(config.proposals.journey?.enabled&&action.game==='grave-digging'){game.mode='pairs';game.tiles=shuffled(event,Array.from({length:rule.total},(_,i)=>Math.floor(i/2)));game.open=[];}
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
      preparePlayback(game,event,at);event.games[action.game] = game; result.game = clone(game);
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
        } else { game.cueIndex=(game.cueIndex||0)+1;game.target=game.cues?.[game.cueIndex]??Math.floor(random(event)*3);game.deadline=at+config.proposals.games.shipStepSeconds[game.steps]*1000; }
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
      game.lastInputAt=at;result.game = clone(game);
    } else if (action.type === 'repair') {
      requireRules(config);
      if (!event.repairs) fail('เรือพร้อมอยู่แล้ว');
      addCandy(event, -event.repairs, 'ship-repair', at, tx); event.repairs = 0;
    } else fail('ไม่พบการกระทำ');
    event.clock = at;
    return result;
  }
  return Object.freeze({BIOMES, SHORT, DAY, HOUR,Rotations, build, initial, definitions, moment, shopStock, biomeAt, portalStatus, questStatus,questWait,biomeProgress, gardenUnlocked,weaponStatus,bossStatus,resolveRequirements, questRequirements, checkRequirements, questNeeds, houseAvailability,questAidStatus, gameDefinition, dispatch});
});
