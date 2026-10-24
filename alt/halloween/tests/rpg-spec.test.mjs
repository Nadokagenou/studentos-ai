import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),Combat=require('../event/combat.js'),Guide=require('../event/guide.js'),World=require('../event/world.js'),Catalog=require('../rewards/catalog.js'),Ownership=require('../rewards/ownership.js');
const load=n=>JSON.parse(fs.readFileSync(new URL('../event/data/'+n+'.json',import.meta.url),'utf8'));
const config=Core.build({materials:load('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>load('quests.'+n)),catalog:Catalog,proposals:load('preview-rules'),preview:true});
const at=Date.parse('2026-10-23T10:00:00+07:00');
function harness(prepare=()=>{}){
  let n=0;const memory=new Map(),store=Ownership.createStore({key:'rpg',storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},owner:'rpg',season:config.season.id,initial:()=>{const d=Core.initial(config,'rpg',at,345678);prepare(d);return d;}});
  const apply=(a,tx='rpg-'+(++n))=>store.transact(tx,d=>Core.dispatch(d,config,a,{now:at,tx}));return{store,apply};
}
function ready(d,id){const b=config.proposals.bosses[id];d.event.previewBiome=b.biome||Core.BIOMES[0];if(b.biome)d.event.location={kind:'biome',biome:b.biome};if(b.quest)d.event.quests[b.quest]={phase:9,complete:true};for(const w of Object.keys(config.proposals.weapons))d.rewards[w]={id:w,receipt:'earned-'+w,receivedAt:at,permanent:true};d.event.equipment=b.weapon||'dullahan-scythe';}
async function defeat(h,id){await h.apply({type:'start-boss',boss:id});for(let n=0;n<100;n++){const b=h.store.read().event.battle;if(b.finished){assert.equal(b.clear,true);return;}await h.apply({type:'battle-move',session:b.session,move:b.intent.kind==='hex'?'guard':'dodge-'+[0,1,2].find(i=>!b.intent.danger.includes(i))});}assert.fail('no ending');}

test('all four exact owner pools cover every rarity; Mystical and retired items never enter house pools',()=>{
  const expected=[
    [['Abyssal rock','Seaweed'],['Fabric Scraps','Soul Anchor'],["Dutchman's Lantern"],["Captain's log"],["Dutchman's Skull"],['Mini Flying Dutchman']],
    [["Jack'o Wood",'Rotten Pumpkin'],["Jack'o Fire",'Candle'],['Pumpkin Seed','Pumpkin carved'],['Pumpkin soup','Vine'],['Charcoal'],['His head']],
    [['Vampire teeth','Bat teeth'],['Bat wing','Broken Crossbow'],['Mystic Mirror','Magic nail'],['Vampire Skull'],['Pure Blood Skull'],['Garlic']],
    [['Human Bone','Human Skull'],['Shovel','Monster Bone'],['Zombie Arms','Rotten Stick'],['Soul Stick','Scrap Iron'],['Soul Vessel'],['Grim Scythe']]
  ];
  config.materials.biomes.forEach((biome,i)=>Object.keys(config.materials.houseItems.rarityWeightsPercent).forEach((rarity,j)=>assert.deepEqual(Guide.housePool(config,biome.id,rarity).map(id=>config.items[id].name),expected[i][j])));
  for(const id of ['dutchmans-soul-dutchman-s-soul','jacks-hollow-will-o-the-wisp','vampire-mansion-cruor-quill','eternal-graveyard-scythe-of-dullahan','dutchmans-soul-old-hook'])assert.equal(Guide.sources(config,id).some(s=>s.kind==='house'),false);
  for(const q of config.quests.filter(q=>q.finalMainQuest))for(const r of q.rewards.filter(r=>r.id.startsWith('theme-'))){assert.equal(r.afterBoss,q.bossId);assert.ok(Guide.sources(config,r.id).some(s=>s.kind==='boss'&&s.boss===q.bossId));}
});

test('100,000 independent house draws follow 60%, tier weights, 10% breakthrough and 1/4 destination',()=>{
  const counts={items:0,breakthrough:0,destination:{},tiers:{}};let seed=99887766;
  for(let n=0;n<100000;n++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const d=Core.initial(config,'rpg',at,seed);d.event.previewBiome=Core.BIOMES[0];
    const r=Core.dispatch(d,config,{type:'house',house:1,choice:'treat'},{now:at,tx:'draw'});
    if(r.item){const item=r.item;counts.items++;counts.tiers[item.rarity]=(counts.tiers[item.rarity]||0)+1;if(item.breakthroughRoll){counts.breakthrough++;counts.destination[item.biome]=(counts.destination[item.biome]||0)+1;}}
  }
  assert.ok(Math.abs(counts.items/100000-.6)<.006);
  assert.ok(Math.abs(counts.breakthrough/counts.items-.1)<.008);
  for(const biome of Core.BIOMES)assert.ok(Math.abs(counts.destination[biome]/counts.breakthrough-.25)<.022);
  for(const [tier,weight]of Object.entries(config.materials.houseItems.rarityWeightsPercent))assert.ok(Math.abs(counts.tiers[tier]/counts.items-weight/100)<.008,tier);
});

test('no crop can bypass Jack Q1 with a seed, plot item or another NPC quest; no existing save is reset',async()=>{
  const h=harness(d=>{d.event.quests['win-death-fragments']={complete:true};d.event.inventory['jacks-hollow-plot']=1;for(const c of Object.values(config.proposals.crops))d.event.inventory[c.seed]=3;});
  await h.apply({type:'enter-room',room:'garden'});
  for(const biome of Core.BIOMES){await assert.rejects(h.apply({type:'plant',biome}),/Jack Q1/);assert.equal(World.cropState({Core,config,doc:h.store.read(),now:at},biome).unlocked,false);}
  assert.equal(h.store.read().event.inventory[config.proposals.crops[Core.BIOMES[0]].seed],3);
});

test('the new final quantities and forbidden restricted scythe match the owner specification',async()=>{
  const q=id=>config.quests.find(q=>q.id===id);assert.equal(q('dutchman-ghost-commander').phases[1].requirements.items[0].quantity,15);
  assert.deepEqual(q('jack-sweet-surprise').phases[0].requirements.anyOf[1].items.map(x=>x.quantity),[5,3,1]);
  const h=harness(d=>{ready(d,'headless-warden');d.rewards['dullahan-scythe'].restriction={status:'Restricted',allowedBiomes:['eternal-graveyard']};});
  await assert.rejects(h.apply({type:'equip-weapon',weapon:'dullahan-scythe'}),/ปลดพันธนาการ/);await assert.rejects(h.apply({type:'start-boss',boss:'headless-warden'}),/ถืออาวุธ/);
});

test('guardian victory grants its theme once, actions require the real session, and weapons survive defeat',async()=>{
  for(const [id,b]of Object.entries(config.proposals.bosses).filter(([,b])=>b.theme)){
    const h=harness(d=>ready(d,id));assert.equal(h.store.read().rewards[b.theme],undefined);
    await h.apply({type:'start-boss',boss:id});const session=h.store.read().event.battle.session;
    await assert.rejects(h.apply({type:'battle-move',session:'forged',move:'strike'}),/จบแล้ว/);
    await assert.rejects(h.apply({type:'equip-weapon',weapon:'greater-spear'}),/ออกจากการต่อสู้/);
    const before=JSON.stringify(h.store.read().rewards);await h.apply({type:'battle-move',session,move:'retreat'});assert.equal(JSON.stringify(h.store.read().rewards),before);
    await h.apply({type:'start-boss',boss:id});
    for(let n=0;n<30;n++){const b=h.store.read().event.battle;if(b.finished)break;await h.apply({type:'battle-move',session:b.session,move:'dodge-'+b.intent.danger[0]});}
    assert.equal(h.store.read().event.battle.clear,false);assert.equal(h.store.read().event.battle.hp,0);assert.equal(JSON.stringify(h.store.read().rewards),before);
    await defeat(h,id);assert.ok(h.store.read().rewards[b.theme]);const receipt=h.store.read().rewards[b.theme].receipt;
    await assert.rejects(h.apply({type:'start-boss',boss:id}),/รับรางวัล/);assert.equal(h.store.read().rewards[b.theme].receipt,receipt);
  }
});

test('final and secret battles cannot be skipped by crafting, old theme ownership or forged win flags',async()=>{
  const h=harness(d=>{ready(d,'midnight-sovereign');d.event.candy=1000;for(const q of config.quests)d.event.quests[q.id]={complete:true};for(const b of Object.values(config.proposals.bosses))if(b.theme)d.rewards[b.theme]={id:b.theme};});
  await h.apply({type:'enter-room',room:'ritual'});await assert.rejects(h.apply({type:'start-boss',boss:'midnight-sovereign'}),/ผู้พิทักษ์/);
  await assert.rejects(h.apply({type:'craft',recipe:'midnight'}),/ราชัน/);
  await assert.rejects(h.apply({type:'start-boss',boss:'nameless-afterlight'}),/ราชัน/);
  await assert.rejects(h.apply({type:'battle-move',session:'fake',move:'win',clear:true}),/จบแล้ว/);
});

test('all six combat encounters support victory and failure; a blind attack is not a win flag',()=>{
  for(const [id,rule]of Object.entries(config.proposals.bosses))for(const [wid,weapon]of Object.entries(config.proposals.weapons)){
    let seed=1,random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const b=Combat.start({...rule,id},wid,'battle',at,random);
    for(let n=0;n<100&&!b.finished;n++)Combat.move(b,rule,weapon,b.intent.kind==='hex'?'guard':'dodge-'+[0,1,2].find(i=>!b.intent.danger.includes(i)),at+n,random);
    assert.equal(b.clear,true,id+' '+wid);assert.ok(b.hp>0);
    const lost=Combat.start({...rule,id},wid,'lost',at,random);for(let n=0;n<100&&!lost.finished;n++)Combat.move(lost,rule,weapon,'dodge-'+lost.intent.danger[0],at+n,random);
    assert.equal(lost.clear,false);assert.equal(lost.hp,0);
  }
});


test('each weapon skill changes the battle rules, not just its damage multiplier',()=>{
  const rule={id:'test',hp:400,damage:30},random=()=>0;
  const make=type=>{const b=Combat.start(rule,type,'s',at,random);b.hp=60;b.intent={kind:'hex',danger:[0,1,2],phase:1,damage:30};return b;};
  const spear=make('spear');Combat.move(spear,rule,{type:'spear',power:20},'skill',at,random);assert.equal(spear.hp,52);assert.equal(spear.effects.anchor,1);spear.intent={kind:'hex',danger:[0,1,2],phase:1,damage:30};Combat.move(spear,rule,{type:'spear',power:20},'strike',at+1,random);assert.equal(spear.hp,37);assert.equal(spear.effects.anchor,0);
  const axe=make('axe');Combat.move(axe,rule,{type:'axe',power:20},'skill',at,random);assert.equal(axe.hp,60);assert.equal(axe.bossHp,370);assert.equal(axe.turn,1);
  const quill=make('quill');Combat.move(quill,rule,{type:'quill',power:20},'skill',at,random);assert.equal(quill.effects.bleed,2);const after=quill.bossHp;quill.intent={kind:'sweep',danger:[0],phase:1,damage:30};Combat.move(quill,rule,{type:'quill',power:20},'dodge-1',at+1,random);assert.equal(quill.bossHp,after-13-6);assert.equal(quill.hp,42);
  const scythe=make('scythe');scythe.bossHp=115;Combat.move(scythe,rule,{type:'scythe',power:20},'skill',at,random);assert.equal(scythe.clear,true);assert.equal(scythe.hp,76);assert.ok(scythe.log.includes('ปิดฉาก'));
});
test('an old active battle without effect fields resumes, and insufficient mana cannot trigger weapon effects',()=>{
  const rule={id:'test',hp:400,damage:30},b=Combat.start(rule,'spear','s',at,()=>0);delete b.effects;b.mana=0;const before=JSON.stringify(b);assert.throws(()=>Combat.move(b,rule,{type:'spear',power:20},'skill',at,()=>0));assert.equal(JSON.stringify(b),before);Combat.move(b,rule,{type:'spear',power:20},'guard',at,()=>0);assert.ok(b.effects);assert.equal(b.turn,1);
});
test('biome progress counts completed phases and the actual guardian win; rewards alone cannot fill the tube',()=>{
  const doc=Core.initial(config,'review',at),biome=Core.BIOMES[0],chain=config.quests.filter(q=>q.biome===biome),boss=Object.entries(config.proposals.bosses).find(([,b])=>b.biome===biome)[0],initial=JSON.stringify(doc);
  assert.equal(Core.biomeProgress(doc,config,biome).value,0);assert.equal(JSON.stringify(doc),initial);doc.event.quests[chain[0].id]={phase:1};assert.equal(Core.biomeProgress(doc,config,biome).value,Math.min(1,chain[0].phases.length-1));for(const q of chain)doc.event.quests[q.id]={complete:true};let p=Core.biomeProgress(doc,config,biome);assert.equal(p.complete,false);assert.equal(p.value,p.total-1);doc.event.bossWins={[boss]:{at}};p=Core.biomeProgress(doc,config,biome);assert.equal(p.complete,true);assert.equal(p.percent,100);
});
