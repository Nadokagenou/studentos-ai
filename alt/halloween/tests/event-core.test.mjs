import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const Core = require('../event/core.js');
const Ownership = require('../rewards/ownership.js');
const Acquisition = require('../rewards/acquisition.js');
const World = require('../event/world.js');
const NPCs = require('../event/npcs.js');
const Catalog = require('../rewards/catalog.js');
const load = file => JSON.parse(fs.readFileSync(new URL('../event/data/'+file,import.meta.url),'utf8'));
const materials = load('materials.json'), proposals = load('preview-rules.json');
const chains = ['dutchman','jack','vampire','graveyard'].map(n => load('quests.'+n+'.json'));
const time = Date.parse('2026-10-23T10:00:00+07:00');
function harness({preview=true,seed=12345,prepare=()=>{},storage:provided}={}) {
  const config = Core.build({materials,chains,catalog:Catalog,proposals,preview});
  const data = new Map(), storage = provided || {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const initial = () => {const doc=Core.initial(config,'review',time,seed);prepare(doc);return doc;};
  const store = Ownership.createStore({storage,key:'test',owner:'review',season:config.season.id,initial});
  let n=0;
  const apply = (action,id='tx-'+(++n)) => store.transact(id,doc=>Core.dispatch(doc,config,action.type==='buy'&&preview?{...action,stockEpoch:Core.shopStock(doc,config,time).epoch}:action,{now:time,tx:id}));
  const biome = id => apply({type:'preview-biome',biome:id});
  return {config,store,apply,biome,storage};
}
const stock = doc => {
  doc.event.candy=20000;
  // Ownership fixtures stock all cosmetics; shop-stock.test covers random hourly inventory.
  doc.event.location={kind:'room',room:'shop'};
  doc.event.shopStock={epoch:Math.floor(time/Core.HOUR),remaining:Object.fromEntries(Object.keys(proposals.shop).map(id=>[id,1]))};
  for (const item of Object.values(Core.definitions(materials))) if (item.rarity!=='Mystical' && !['event-feature','tool'].includes(item.kind) && !['jacks-hollow-shovel','jacks-hollow-pumpkin'].includes(item.id)) doc.event.inventory[item.id]=40;
};
const quest = (h,id,branch) => h.apply({type:'quest',quest:id,branch});
const unlockGarden=doc=>{doc.event.quests['jack-clear-garden']={complete:true,phase:2};doc.event.inventory['jacks-hollow-plot']=1;};
async function winBoss(h,id){
  const biome=h.config.proposals.bosses[id].biome;if(biome)await h.apply({type:'enter-biome',biome});
  await h.apply({type:'start-boss',boss:id});
  for(let n=0;n<100;n++){
    const b=h.store.read().event.battle;if(b.finished){assert.equal(b.clear,true);return;}
    const move=b.intent.kind==='hex'?'guard':'dodge-'+[0,1,2].find(i=>!b.intent.danger.includes(i));
    await h.apply({type:'battle-move',session:b.session,move});
  }
  assert.fail('boss never finished');
}

test('only the active portal opens, and story acknowledgement persists across re-entry',async()=>{
  const h=harness();await h.biome(Core.BIOMES[0]);
  assert.equal(Core.BIOMES.filter(id=>Core.portalStatus(h.store.read(),h.config,id,time).open).length,1);
  await assert.rejects(h.apply({type:'enter-biome',biome:Core.BIOMES[1]}),/ยังไม่เปิด/);
  const first=await h.apply({type:'enter-biome',biome:Core.BIOMES[0]});assert.equal(first.result.firstStory,true);
  await h.apply({type:'story-seen',biome:Core.BIOMES[0]});
  const again=await h.apply({type:'enter-biome',biome:Core.BIOMES[0]});assert.equal(again.result.firstStory,false);
  await h.apply({type:'preview-close'});
  assert.equal(Core.portalStatus(h.store.read(),h.config,Core.BIOMES[0],time).open,false);
});
test('quest completion awards biome seeds once without charging Candy for seeds',async()=>{
  const h=harness({prepare:stock});await h.biome(Core.BIOMES[0]);
  const crop=proposals.crops[Core.BIOMES[0]],before=h.store.read().event.inventory[crop.seed]||0;
  const r=await quest(h,'dutchman-light-in-darkness');
  assert.equal(r.result.seeds.quantity,3);
  assert.equal(h.store.read().event.inventory[crop.seed],before+3);
  await assert.rejects(quest(h,'dutchman-light-in-darkness'),/รับรางวัล/);
  assert.equal(h.store.read().event.inventory[crop.seed],before+3);
});
test('all four crops require seeds, water and growth before harvest and sale',async()=>{
  for(const biome of Core.BIOMES){
    const crop=proposals.crops[biome],h=harness({prepare:doc=>{doc.event.inventory[crop.seed]=1;unlockGarden(doc);}});
    await h.biome(Core.BIOMES[(Core.BIOMES.indexOf(biome)+1)%4]);
    await h.apply({type:'enter-room',room:'shop'});
    await assert.rejects(h.apply({type:'sell-crop',biome,quantity:1}),/เก็บแล้ว/);
    await h.apply({type:'enter-room',room:'garden'});
    await h.apply({type:'plant',biome});
    await assert.rejects(h.apply({type:'harvest',biome}),/โตไม่เต็มที่/);
    await h.apply({type:'water',biome});
    await assert.rejects(h.apply({type:'harvest',biome}),/โตไม่เต็มที่/);
    await h.apply({type:'preview-time',ms:60000});await h.apply({type:'harvest',biome});
    assert.equal(h.store.read().event.grown[crop.harvest],3);
    await assert.rejects(h.apply({type:'sell-crop',biome,quantity:3}),/พ่อค้าในร้าน/);
    await h.apply({type:'enter-room',room:'shop'});
    const sale=await h.apply({type:'sell-crop',biome,quantity:3});assert.equal(sale.result.candy,3*crop.sellCandy);
    assert.equal(h.store.read().event.inventory[crop.harvest],0);
    await assert.rejects(h.apply({type:'sell-crop',biome,quantity:1}),/เก็บแล้ว/);
  }
});
test('unharvested or foreign inventory cannot be sold as homegrown crops',async()=>{
  const biome=Core.BIOMES[2],crop=proposals.crops[biome],h=harness({prepare:doc=>{doc.event.inventory[crop.harvest]=10;unlockGarden(doc);}});
  await h.biome(biome);await h.apply({type:'enter-room',room:'shop'});await assert.rejects(h.apply({type:'sell-crop',biome,quantity:1}),/เก็บแล้ว/);
  await h.biome(Core.BIOMES[0]);await h.apply({type:'enter-room',room:'garden'});await assert.rejects(h.apply({type:'plant',biome}),/วัตถุดิบไม่พอ/);
});
test('repeat seed request unlocks after a main quest and consumes the requested materials',async()=>{
  const h=harness({prepare:stock}),biome=Core.BIOMES[0],crop=proposals.crops[biome];await h.biome(biome);
  await assert.rejects(h.apply({type:'seed-quest',biome}),/เควสแรก/);
  await quest(h,'dutchman-light-in-darkness');const before=h.store.read();
  await h.apply({type:'seed-quest',biome});const after=h.store.read();
  assert.equal(after.event.inventory[crop.request],before.event.inventory[crop.request]-2);
  assert.equal(after.event.inventory[crop.seed],before.event.inventory[crop.seed]+2);
  assert.equal(after.event.candy,before.event.candy);
});
test('world scenes expose click destinations and one open portal without movement controls',()=>{
  const h=harness(),doc=h.store.read();doc.event.previewBiome=Core.BIOMES[0];
  const html=World.hub({Core,Catalog,config:h.config,doc,now:time});
  assert.equal((html.match(/portal-open/g)||[]).length,1);
  assert.equal((html.match(/class="world-portal /g)||[]).length,4);
  assert.match(html,/data-route="shop"/);assert.match(html,/data-route="cauldron"/);
  assert.doesNotMatch(html,/data-move=/);
});
test('the separate garden contains all four plots, and selling is offered by the merchant',()=>{
  const h=harness(),c={Core,Catalog,config:h.config,doc:h.store.read(),now:time};
  const garden=World.garden(c);assert.equal((garden.match(/data-plot-biome=/g)||[]).length,4);assert.match(garden,/world-garden.png/);assert.doesNotMatch(garden,/data-sell-crop|data-confirm-crop/);
  for(const room of ['shop','cauldron','ritual']){const html=World.room(c,room);assert.match(html,new RegExp('world-'+room+'.png'));assert.match(html,new RegExp('data-npc="'+NPCs.rooms[room].npc+'"'));}
  assert.equal(new Set(Object.values(NPCs.characters).map(n=>n.sprite)).size,7);
  assert.ok(NPCs.characters.morro.actions.some(a=>a.action==='sell'));
});
test('every biome keeps its minigame pins visible before and after quest gates, with honest prerequisites',()=>{
  const h=harness(),doc=h.store.read(),c={Core,Catalog,config:h.config,doc,now:time};
  const games=['ghost-ship-hunt','clear-jacks-garden-vines','dech-house-spot-difference','grave-digging'];
  for(let i=0;i<4;i++){
    doc.event.previewBiome=Core.BIOMES[i];const before=World.biome(c);
    assert.ok(before.includes('data-game-info="'+games[i]+'"'));
    assert.match(before,/scene-point.*activity-point/);
    for(const q of h.config.quests.filter(q=>q.biome===Core.BIOMES[i]))doc.event.quests[q.id]={complete:true,phase:q.phases.length};
    const after=World.biome(c);assert.ok(after.includes('data-game-info="'+games[i]+'"'));
  }
  assert.equal(World.activity(c,'ghost-ship-hunt').quest,'dutchman-light-in-darkness');
  doc.event.inventory['spectral-lantern']=1;assert.equal(World.activity(c,'ghost-ship-hunt').locked,false);
  assert.equal(World.activity(c,'clear-jacks-garden-vines').locked,false);
  assert.equal(World.activity(c,'catch-all-ghosts').game,'grave-digging');
  doc.event.proofs['grave-digging']={complete:true,clear:true};assert.equal(World.activity(c,'catch-all-ghosts').locked,false);
});
test('Jack vines can be replayed after Q1 without granting another plot or seeds',async()=>{
  const h=harness({prepare:doc=>{unlockGarden(doc);doc.event.inventory['jacks-hollow-pumpkin-seed']=3;}});await h.biome(Core.BIOMES[1]);
  await winGame(h,'clear-jacks-garden-vines');const doc=h.store.read();
  assert.equal(doc.event.inventory['jacks-hollow-plot'],1);assert.equal(doc.event.inventory['jacks-hollow-pumpkin-seed'],3);
  assert.equal(doc.event.proofs['clear-jacks-garden-vines'].clear,true);
});
test('touch first reveals a target and the second tap activates; mouse and keyboard act immediately',()=>{
  assert.equal(World.shouldArm({pointerType:'touch',detail:1,armed:false}),true);
  assert.equal(World.shouldArm({pointerType:'touch',detail:1,armed:true}),false);
  assert.equal(World.shouldArm({pointerType:'pen',detail:1,armed:false}),true);
  assert.equal(World.shouldArm({pointerType:'mouse',detail:1,armed:false}),false);
  assert.equal(World.shouldArm({pointerType:'touch',detail:0,armed:false}),false);
  assert.equal(World.shouldArm({pointerType:'touch',detail:1,armed:false,labelVisible:true}),false);
  assert.equal(World.shouldArm({pointerType:'touch',detail:1,armed:false,markerVisible:true}),false);
});
test('only the garden allows planting and only the shop accepts crop sales, including other biome crops',async()=>{
  const crop=proposals.crops[Core.BIOMES[0]],h=harness({prepare:doc=>{doc.event.inventory[crop.seed]=1;doc.event.inventory[crop.harvest]=4;doc.event.grown[crop.harvest]=4;unlockGarden(doc);}});
  await assert.rejects(h.apply({type:'enter-room',room:'missing'}),/ไม่พบห้อง/);
  await assert.rejects(h.apply({type:'plant',biome:Core.BIOMES[0]}),/สวนรัตติกาล/);
  await h.apply({type:'enter-room',room:'garden'});await h.apply({type:'plant',biome:Core.BIOMES[0]});
  await assert.rejects(h.apply({type:'sell-crop',biome:Core.BIOMES[0],quantity:1}),/พ่อค้าในร้าน/);
  await h.apply({type:'enter-room',room:'shop'});await h.apply({type:'sell-crop',biome:Core.BIOMES[0],quantity:1});
  assert.equal(h.store.read().event.grown[crop.harvest],3);
  await h.apply({type:'enter-hub'});await assert.rejects(h.apply({type:'sell-crop',biome:Core.BIOMES[0],quantity:1}),/พ่อค้าในร้าน/);
});
test('Mora sells a stored potion once per receipt and other rooms cannot sell it',async()=>{
  const h=harness({prepare:stock});await h.apply({type:'enter-room',room:'shop'});
  await assert.rejects(h.apply({type:'buy-biome-potion'}),/มอรา/);
  await h.apply({type:'enter-room',room:'cauldron'});
  await h.apply({type:'buy-biome-potion'},'potion-order');await h.apply({type:'buy-biome-potion'},'potion-order');
  assert.equal(h.store.read().event.inventory['random-biome-potion'],1);
  assert.equal(h.store.read().event.candy,20000-proposals.randomBiomePotion.price);
});
test('drinking a potion changes to another biome and consumes exactly one bottle',async()=>{
  const h=harness({prepare:doc=>{doc.event.inventory['random-biome-potion']=1;}});await h.biome(Core.BIOMES[0]);
  const r=await h.apply({type:'drink-biome-potion'},'potion-drink');
  assert.notEqual(r.result.biome,Core.BIOMES[0]);assert.equal(r.result.firstStory,true);
  assert.equal(h.store.read().event.inventory['random-biome-potion'],0);
  assert.deepEqual(h.store.read().event.location,{kind:'biome',biome:r.result.biome});
  await h.apply({type:'drink-biome-potion'},'potion-drink');
  await assert.rejects(h.apply({type:'drink-biome-potion'}),/วัตถุดิบไม่พอ/);
});
test('a potion preserves house cooldowns, quest cycles and returns after its duration',async()=>{
  const h=harness({prepare:doc=>{stock(doc);doc.event.inventory['random-biome-potion']=1;doc.event.quests['dech-rare-materials']={complete:true,completedCycle:10};}});await h.biome(Core.BIOMES[0]);
  await h.apply({type:'house',house:1,choice:'treat'});const before=h.store.read(),cycle=Core.biomeAt(before,h.config,time).cycle;
  await h.apply({type:'drink-biome-potion'});assert.deepEqual(h.store.read().event.houses,before.event.houses);assert.deepEqual(h.store.read().event.quests,before.event.quests);
  assert.equal(Core.biomeAt(h.store.read(),h.config,time).cycle,cycle);
  await h.apply({type:'preview-time',ms:proposals.randomBiomePotion.durationMs});
  assert.equal(Core.biomeAt(h.store.read(),h.config,time).id,Core.BIOMES[0]);assert.equal(Core.houseAvailability(h.store.read(),h.config,1,time).ready,false);
});
test('all three other biomes are reachable by potion, without adding cosmetics',async()=>{
  const seen=new Set();for(let n=1;n<=24;n++){
    const h=harness({seed:(n*2654435761)>>>0,prepare:doc=>{doc.event.inventory['random-biome-potion']=1;}});await h.biome(Core.BIOMES[0]);
    const r=await h.apply({type:'drink-biome-potion'});seen.add(r.result.biome);assert.equal(Object.keys(h.store.read().rewards).length,0);
  }assert.deepEqual([...seen].sort(),Core.BIOMES.slice(1).sort());
});
async function winGame(h,id) {
  await h.apply({type:'start-game',game:id});
  let game=h.store.read().event.games[id];
  while(!game.finished) {
    await h.apply({type:'game-move',game:id,session:game.session,move:id==='ghost-ship-hunt'?game.target:game.found.length});
    game=h.store.read().event.games[id];
  }
  assert.equal(game.clear,true);
}

test('production never reads preview proposals or grants through a preview command',async()=>{
  const h=harness({preview:false});assert.equal(h.config.proposals,null);
  await assert.rejects(h.apply({type:'preview-supplies'}),/เฉพาะห้องลอง/);
  await assert.rejects(h.apply({type:'buy',item:'harbor-lantern'}),/ยังไม่เปิดรับ/);
  assert.equal(Object.keys(h.store.read().rewards).length,0);
});
test('a request replay returns the original purchase without spending twice',async()=>{
  const h=harness({prepare:stock});
  const first=await h.apply({type:'buy',item:'harbor-lantern'},'same-purchase');
  const second=await h.apply({type:'buy',item:'harbor-lantern'},'same-purchase');
  assert.equal(second.replay,true);assert.deepEqual(second.result,first.result);
  assert.equal(h.store.read().event.candy,19960);assert.equal(h.store.read().event.purchases.length,1);
});
test('concurrent purchases serialize and cannot buy an already owned reward',async()=>{
  const h=harness({prepare:stock});
  const result=await Promise.allSettled([h.apply({type:'buy',item:'harbor-lantern'}),h.apply({type:'buy',item:'harbor-lantern'})]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(h.store.read().event.candy,19960);
});
test('a storage failure does not leave a debit or grant in memory',async()=>{
  let raw=null;
  const h=harness({prepare:stock,storage:{getItem:()=>raw,setItem:()=>{throw Error('Quota exceeded');}}});
  await assert.rejects(h.apply({type:'buy',item:'harbor-lantern'}),/Quota/);
  assert.equal(h.store.read().event.candy,20000);assert.equal(h.store.read().rewards['harbor-lantern'],undefined);
});
test('a document belonging to another account is rejected rather than merged',()=>{
  const config=Core.build({materials,chains,catalog:Catalog,proposals,preview:true});
  const wrong=Core.initial(config,'someone-else',time);
  const h=harness({storage:{getItem:()=>JSON.stringify(wrong),setItem(){throw Error('must not overwrite');}}});
  assert.throws(()=>h.store.read(),/ไม่ตรงเจ้าของ/);
});
test('Treat pays 10, starts the four-hour cooldown, and a biome round trip keeps it',async()=>{
  const h=harness();await h.biome(Core.BIOMES[0]);
  const r=await h.apply({type:'house',house:1,choice:'treat'});assert.equal(r.result.candy,10);
  await assert.rejects(h.apply({type:'house',house:1,choice:'treat'}),/คูลดาวน์/);
  await h.biome(Core.BIOMES[1]);await h.biome(Core.BIOMES[0]);
  await assert.rejects(h.apply({type:'house',house:1,choice:'treat'}),/คูลดาวน์/);
  await h.apply({type:'preview-time',ms:4*Core.HOUR});
  assert.equal((await h.apply({type:'house',house:1,choice:'treat'})).result.candy,10);
});
test('the house cap only counts house earnings and clamps the last payout',async()=>{
  const h=harness({prepare:doc=>{doc.event.candy=1295;doc.event.ledger=[{source:'house',amount:295,at:time},{source:'quest',amount:1000,at:time}];}});
  await h.biome(Core.BIOMES[0]);
  const r=await h.apply({type:'house',house:1,choice:'treat'});assert.equal(r.result.candy,5);
  await assert.rejects(h.apply({type:'house',house:2,choice:'treat'}),/ครบ 300/);
  await h.apply({type:'preview-time',ms:Core.DAY});
  assert.equal((await h.apply({type:'house',house:2,choice:'treat'})).result.candy,10);
});
test('a failed Trick pays zero and cannot draw an item',async()=>{
  const h=harness({seed:8192});await h.biome(Core.BIOMES[0]);
  const r=await h.apply({type:'house',house:1,choice:'trick'});
  assert.equal(r.result.candy,0);assert.equal(r.result.item,null);assert.equal(Object.keys(h.store.read().event.inventory).length,0);
});
test('the revised lantern recipe charges only its two materials and 50 Candy',async()=>{
  const h=harness({prepare:stock});await h.biome(Core.BIOMES[0]);
  await quest(h,'dutchman-light-in-darkness');const doc=h.store.read();
  assert.equal(doc.event.candy,19950);assert.equal(doc.event.inventory['spectral-lantern'],1);
  assert.equal(doc.event.inventory['dutchmans-soul-abyssal-rock'],39);
  assert.equal(doc.event.inventory['dutchmans-soul-dutchman-s-lantern'],39);
  assert.equal(doc.event.inventory['jacks-hollow-rotten-pumpkin'],40);
  await assert.rejects(quest(h,'dutchman-light-in-darkness'),/รับรางวัล/);
});
test('an existing lantern completes Q1 without another debit or duplicate lantern',async()=>{
  const h=harness({prepare:doc=>{stock(doc);doc.event.inventory['spectral-lantern']=1;}});await h.biome(Core.BIOMES[0]);
  await quest(h,'dutchman-light-in-darkness');assert.equal(h.store.read().event.candy,20000);assert.equal(h.store.read().event.inventory['spectral-lantern'],1);
});
test('pending Dech quantities cannot silently become one in the real rules',()=>{
  const h=harness({preview:false}),q=h.config.quests.find(x=>x.id==='dech-rare-materials');
  assert.throws(()=>Core.resolveRequirements(h.config,q,q.phases[0].requirements),/ยังไม่กำหนด/);
  assert.equal(q.phases[0].requirements.items[0].quantity,null);
});
test('Jack accepts one offer and withholds the final reward until His head',async()=>{
  const h=harness({prepare:doc=>{stock(doc);doc.event.quests['jack-harvest-wisp']={complete:true,phase:1};}});await h.biome(Core.BIOMES[1]);
  await quest(h,'jack-sweet-surprise','candy-offer');let doc=h.store.read();
  assert.equal(doc.event.candy,19800);assert.equal(doc.event.inventory['jacks-hollow-pumpkin-seed'],40);assert.equal(doc.rewards['jacks-axe'],undefined);
  await quest(h,'jack-sweet-surprise');doc=h.store.read();assert.ok(doc.rewards['jacks-axe']);assert.equal(doc.rewards['theme-jackhollow'],undefined);assert.equal(doc.event.inventory['jacks-hollow-his-head'],39);
  await winBoss(h,'hollow-king');assert.ok(h.store.read().rewards['theme-jackhollow']);
});
test('Jack rejects a forged stock of pumpkins without player-grown provenance',async()=>{
  const h=harness({prepare:doc=>{stock(doc);doc.event.quests['jack-clear-garden']={complete:true,phase:2};doc.event.inventory['jacks-hollow-pumpkin']=3;doc.event.inventory['jacks-hollow-shovel']=1;}});await h.biome(Core.BIOMES[1]);
  await assert.rejects(quest(h,'jack-harvest-wisp'),/ต้องมาจากสวน/);assert.equal(h.store.read().event.inventory['jacks-hollow-pumpkin'],3);
});
test('a harvest needs the unlocked plot, seed, watering and elapsed growth time',async()=>{
  const h=harness({prepare:stock});
  await h.apply({type:'enter-room',room:'garden'});
  await assert.rejects(h.apply({type:'plant'}),/Jack Q1/);
  const h2=harness({prepare:doc=>{stock(doc);unlockGarden(doc);}});
  await h2.apply({type:'enter-room',room:'garden'});
  await h2.apply({type:'plant'});await h2.apply({type:'preview-time',ms:60000});
  await assert.rejects(h2.apply({type:'harvest'}),/รดน้ำ/);
  await h2.apply({type:'water'});await h2.apply({type:'harvest'});
  assert.equal(h2.store.read().event.inventory['jacks-hollow-pumpkin'],3);assert.equal(h2.store.read().event.grown['jacks-hollow-pumpkin'],3);
  await assert.rejects(h2.apply({type:'harvest'}),/ยังโต/);
});
test('wrong ship directions and timeouts combine to exactly three failures',async()=>{
  const h=harness({prepare:doc=>{stock(doc);doc.event.inventory['spectral-lantern']=1;}});await h.biome(Core.BIOMES[0]);
  await h.apply({type:'start-game',game:'ghost-ship-hunt'});let g=h.store.read().event.games['ghost-ship-hunt'];
  await h.apply({type:'game-move',game:g.id,session:g.session,move:(g.target+1)%3});
  await h.apply({type:'preview-time',ms:16000});g=h.store.read().event.games[g.id];await h.apply({type:'game-move',game:g.id,session:g.session,move:'timeout'});
  g=h.store.read().event.games[g.id];assert.equal(g.finished,false);assert.equal(g.mistakes,2);
  await h.apply({type:'game-move',game:g.id,session:g.session,move:(g.target+1)%3});g=h.store.read().event.games[g.id];
  assert.equal(g.finished,true);assert.equal(g.mistakes,3);assert.equal(g.clear,false);assert.equal(h.store.read().event.repairs,25);
  await assert.rejects(h.apply({type:'start-game',game:g.id}),/ซ่อมเรือ/);
  await h.apply({type:'repair'});assert.equal(h.store.read().event.repairs,0);
});
test('a game session cannot be forged, replayed after finishing or advanced by duplicate targets',async()=>{
  const h=harness({prepare:doc=>{stock(doc);doc.event.quests['win-death-fragments']={complete:true,phase:1};doc.event.proofs['grave-digging']={complete:true};}});await h.biome(Core.BIOMES[3]);
  await h.apply({type:'start-game',game:'catch-all-ghosts'});const g=h.store.read().event.games['catch-all-ghosts'];
  await assert.rejects(h.apply({type:'game-move',game:g.id,session:'wrong',move:0}),/จบแล้ว/);
  await h.apply({type:'game-move',game:g.id,session:g.session,move:0});await h.apply({type:'game-move',game:g.id,session:g.session,move:0});
  assert.equal(h.store.read().event.games[g.id].found.length,1);
  await h.apply({type:'preview-time',ms:30000});await h.apply({type:'game-move',game:g.id,session:g.session,move:1});
  assert.equal(h.store.read().event.games[g.id].clear,false);
  await assert.rejects(h.apply({type:'game-move',game:g.id,session:g.session,move:2}),/จบแล้ว/);
});
test('Win Q5 shows the Soul without consuming it and upgrades the existing scythe',async()=>{
  const h=harness({prepare:doc=>{stock(doc);doc.event.quests['win-restricted-scythe']={complete:true,phase:1};doc.event.inventory['dutchmans-soul-dutchman-s-soul']=1;doc.rewards['dullahan-scythe']={id:'dullahan-scythe',receivedAt:time-1000,receipt:'original',permanent:true,restriction:{status:'Restricted',allowedBiomes:[Core.BIOMES[3]]}};doc.event.inventory['eternal-graveyard-scythe-of-dullahan']=1;}});await h.biome(Core.BIOMES[3]);
  await quest(h,'win-unbind-scythe');const doc=h.store.read();
  assert.equal(doc.event.candy,19950);assert.equal(doc.event.inventory['dutchmans-soul-dutchman-s-soul'],1);assert.equal(doc.event.inventory['eternal-graveyard-scythe-of-dullahan'],1);
  assert.equal(doc.rewards['dullahan-scythe'].receipt,'original');assert.equal(doc.rewards['dullahan-scythe'].restriction,null);assert.equal(doc.rewards['theme-graveyard'],undefined);
  await winBoss(h,'headless-warden');assert.ok(h.store.read().rewards['theme-graveyard']);
});
test('a failing upgrade rolls the Candy debit back with the transaction',async()=>{
  const h=harness({prepare:doc=>{stock(doc);doc.event.inventory['dutchmans-soul-dutchman-s-soul']=1;doc.event.quests['win-restricted-scythe']={complete:true,phase:1};}});await h.biome(Core.BIOMES[3]);
  await assert.rejects(quest(h,'win-unbind-scythe'),/ยังไม่มีเคียว/);assert.equal(h.store.read().event.candy,20000);
});
test('the collector medal requires purchases of the defined shop list, not other grants',async()=>{
  const h=harness({prepare:stock});
  for(const recipe of proposals.recipes.filter(r=>r.channel==='cauldron')) await h.apply({type:'craft',recipe:recipe.id});
  assert.equal(h.store.read().rewards['crown-of-midnight'],undefined);
  const ids=Object.keys(proposals.shop);
  for(const id of ids.slice(0,-1)) await h.apply({type:'buy',item:id});
  assert.equal(h.store.read().rewards['crown-of-midnight'],undefined);
  await h.apply({type:'buy',item:ids.at(-1)});assert.ok(h.store.read().rewards['crown-of-midnight']);
});
test('Rare outfits are not purchasable and remain in ritual recipes',async()=>{
  const h=harness({prepare:stock});
  await assert.rejects(h.apply({type:'buy',item:'sai-witch'}),/ไม่ได้ขาย/);
  await h.apply({type:'craft',recipe:'summon-sai'});assert.ok(h.store.read().rewards['sai-witch']);
});
test('closing the season blocks acquisition while the independent reward reader keeps all rewards',async()=>{
  const h=harness({prepare:stock});await h.apply({type:'buy',item:'harbor-lantern'});await h.apply({type:'preview-close'});
  await assert.rejects(h.apply({type:'buy',item:'laughing-pumpkin'}),/อีเวนต์ปิดแล้ว/);
  const doc=h.store.read();doc.event=null;
  assert.deepEqual(Ownership.list(doc).map(x=>x.id),['harbor-lantern']);
});
test('work rewards are claimed once per work item and never from a cosmetic effect',async()=>{
  const h=harness();await h.apply({type:'task',task:'review-task-1'});
  await assert.rejects(h.apply({type:'task',task:'review-task-1'}),/รับ Candy แล้ว/);
  await assert.rejects(h.apply({type:'task',task:'fx-jacks-verdict'}),/ไม่พบงาน/);assert.equal(h.store.read().event.candy,10);
});
test('the totem cannot reset a house cooldown or advance a quest cycle',async()=>{
  const h=harness({prepare:stock});await h.biome(Core.BIOMES[0]);await h.apply({type:'house',house:1,choice:'treat'});
  const cycle=Core.biomeAt(h.store.read(),h.config,time).cycle;
  await h.apply({type:'totem',biome:Core.BIOMES[1]});await h.apply({type:'totem',biome:Core.BIOMES[0]});
  assert.equal(Core.biomeAt(h.store.read(),h.config,time).cycle,cycle);
  await assert.rejects(h.apply({type:'house',house:1,choice:'treat'}),/คูลดาวน์/);
});
test('the complete four-NPC journey, games, garden, shop and rituals yields exactly 28 review rewards',async()=>{
  const h=harness({prepare:stock});
  await h.biome(Core.BIOMES[0]);await quest(h,'dutchman-light-in-darkness');await winGame(h,'ghost-ship-hunt');await quest(h,'dutchman-repair-and-prove');await quest(h,'dutchman-ghost-commander');
  assert.equal(h.store.read().rewards['greater-spear'],undefined);await quest(h,'dutchman-ghost-commander');await winBoss(h,'drowned-admiral');
  await h.biome(Core.BIOMES[3]);await quest(h,'win-death-fragments');
  await h.biome(Core.BIOMES[1]);await quest(h,'jack-clear-garden');await winGame(h,'clear-jacks-garden-vines');await quest(h,'jack-clear-garden');
  await h.apply({type:'enter-room',room:'garden'});
  await h.apply({type:'plant'});await h.apply({type:'water'});await h.apply({type:'preview-time',ms:60000});await h.apply({type:'harvest'});
  await quest(h,'jack-harvest-wisp');assert.equal(h.store.read().event.inventory['jacks-hollow-shovel'],1);
  await quest(h,'jack-sweet-surprise','harvest-offer');await quest(h,'jack-sweet-surprise');await winBoss(h,'hollow-king');
  await h.biome(Core.BIOMES[3]);await winGame(h,'grave-digging');await quest(h,'win-gravekeeper-trial');await winGame(h,'catch-all-ghosts');await quest(h,'win-gravekeeper-trial');
  await quest(h,'win-forge-blade');await quest(h,'win-restricted-scythe');await quest(h,'win-unbind-scythe');await winBoss(h,'headless-warden');
  await h.biome(Core.BIOMES[2]);await quest(h,'dech-intruder-punishment');assert.ok(h.store.read().rewards['cruor-quill']);
  await winGame(h,'dech-house-spot-difference');await quest(h,'dech-rare-materials');
  await assert.rejects(quest(h,'dech-wrong-letter'),/วัฏจักรถัดไป/);
  await h.apply({type:'preview-time',ms:Core.DAY});await quest(h,'dech-wrong-letter');await winBoss(h,'blood-countess');
  await h.apply({type:'enter-room',room:'shop'});
  for(const item of Object.keys(proposals.shop)) {
    for(let tries=0;Core.shopStock(h.store.read(),h.config,time).remaining[item]===0;tries++){
      assert.ok(tries<100,'cosmetic should recur in hourly shop');
      await h.apply({type:'preview-time',ms:Core.HOUR});
    }
    await h.apply({type:'buy',item});
  }
  await h.apply({type:'enter-room',room:'ritual'});await winBoss(h,'midnight-sovereign');
  for(const recipe of proposals.recipes) await h.apply({type:'craft',recipe:recipe.id});
  await winBoss(h,'nameless-afterlight');assert.equal(h.store.read().event.inventory['nameless-crown'],1);
  const doc=h.store.read();assert.equal(Object.keys(doc.rewards).length,28);assert.equal(configCompleted(h),14);
  const before=JSON.stringify(doc.rewards);await h.apply({type:'preview-close'});assert.equal(JSON.stringify(h.store.read().rewards),before);
});
function configCompleted(h){return h.config.quests.filter(q=>h.store.read().event.quests[q.id]?.complete).length;}
test('acquisition tier choreography increases through rarity and never owns currency',()=>{
  const tiers=['Common','Uncommon','Rare','Epic','Legendary','Secret'];
  for(let i=1;i<tiers.length;i++){assert.ok(Acquisition.profile(tiers[i]).duration>Acquisition.profile(tiers[i-1]).duration);assert.ok(Acquisition.profile(tiers[i]).particles>Acquisition.profile(tiers[i-1]).particles);}
  assert.equal(typeof Acquisition.dispatch,'undefined');assert.equal(typeof Acquisition.grant,'undefined');
});
test('motion follows the system initially but an explicit player choice can enable or pause it',()=>{
  assert.equal(Acquisition.motionReduced({motion:'full',motionChosen:false},true),true);
  assert.equal(Acquisition.motionReduced({motion:'full',motionChosen:true},true),false);
  assert.equal(Acquisition.motionReduced({motion:'still',motionChosen:true},false),true);
  assert.equal(Acquisition.motionReduced({motion:'full',motionChosen:false},false),false);
});
test('the permanent vault and its required resources have no dependency on the removable event directory',()=>{
  const html=fs.readFileSync(new URL('../rewards/vault.html',import.meta.url),'utf8');
  for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(!ref.includes('/event/'),ref);
    if(ref==='../../')continue;
    assert.ok(fs.existsSync(new URL('../rewards/'+ref,import.meta.url)),ref);
  }
  const source=fs.readFileSync(new URL('../rewards/vault.js',import.meta.url),'utf8');
  assert.ok(!/fetch\s*\(|require\s*\(|import\s*\(/.test(source));
});
