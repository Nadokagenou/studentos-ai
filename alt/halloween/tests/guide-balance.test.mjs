import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),Guide=require('../event/guide.js'),Balance=require('../event/balance.js'),Catalog=require('../rewards/catalog.js');
const load=x=>JSON.parse(fs.readFileSync(new URL('../event/data/'+x+'.json',import.meta.url),'utf8'));
const config=Core.build({materials:load('materials'),chains:['dutchman','jack','vampire','graveyard'].map(x=>load('quests.'+x)),catalog:Catalog,proposals:load('preview-rules'),preview:true});
const at=Date.parse('2026-10-23T10:00:00+07:00');
test('Human Bone and Skull odds include their two source biomes and the breakthrough mixture',()=>{
  assert.ok(Math.abs(Balance.chance(config,'pending-human-bone','vampire-mansion')-.077)<1e-12);
  assert.ok(Math.abs(Balance.chance(config,'pending-human-skull','vampire-mansion')-.07625)<1e-12);
  assert.ok(Math.abs(Balance.chance(config,'pending-human-bone','eternal-graveyard')-.113)<1e-12);
  assert.ok(Math.abs(Balance.chance(config,'pending-human-skull','eternal-graveyard')-.08525)<1e-12);
  assert.equal(Balance.chance(config,'pending-human-skull','vampire-mansion','trick'),.07625*.5);
  assert.ok(Math.abs(Balance.anyItemChance(config,'vampire-mansion')-.5943)<1e-12);
  assert.ok(Math.abs(Balance.anyItemChance(config,'dutchmans-soul')-.5997)<1e-12);
});
test('item-source instructions agree with actual house rolls and never promise quest-only relics from houses',()=>{
  let seed=987654321;
  for(const biome of Core.BIOMES){
    let bones=0,skulls=0;
    for(let i=0;i<6000;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const doc=Core.initial(config,'test',at,seed);doc.event.previewBiome=biome;
      const result=Core.dispatch(doc,config,{type:'house',house:1,choice:'treat'},{now:at,tx:'roll'});
      if(result.item){assert.ok(Guide.sources(config,result.item.id).some(x=>x.kind==='house'&&x.biome===result.item.biome&&x.rarity===result.item.rarity));}
      if(result.item?.id==='pending-human-bone')bones++;if(result.item?.id==='pending-human-skull')skulls++;
    }
    assert.ok(Math.abs(bones/6000-Balance.chance(config,'pending-human-bone',biome))<.014);
    assert.ok(Math.abs(skulls/6000-Balance.chance(config,'pending-human-skull',biome))<.014);
  }
  for(const id of ['cruor-quill','vampire-mansion-cruor-quill','greater-spear','dullahan-scythe'])assert.ok(!Guide.sources(config,id).some(x=>x.kind==='house'));
  assert.ok(Guide.sources(config,'dutchmans-soul-soul-anchor').some(x=>x.kind==='game'));
});
test('one-hour comparison cannot change house cooldowns or increase the shared daily Candy quota',()=>{
  const original=JSON.stringify(config),a=Balance.cooldownComparison(config,4),b=Balance.cooldownComparison(config,1);
  assert.equal(a.attempts,30);assert.equal(b.attempts,30);assert.equal(a.capHours,20);assert.equal(b.capHours,5);assert.equal(JSON.stringify(config),original);
  const doc=Core.initial(config,'test',at,1);doc.event.previewBiome=Core.BIOMES[0];Core.dispatch(doc,config,{type:'house',house:1,choice:'treat'},{now:at,tx:'house'});
  assert.equal(Core.houseAvailability(doc,config,1,at).nextAt,at+4*Core.HOUR);
});
test('rolling cap countdown points to the receipt expiry, independently of the house cooldown',()=>{
  const doc=Core.initial(config,'test',at);doc.event.previewBiome=Core.BIOMES[0];doc.event.houses[Core.BIOMES[0]+':1']=at+4*Core.HOUR;doc.event.ledger=[{source:'house',amount:300,at:at-Core.HOUR},{source:'task',amount:20,at}];
  const status=Core.houseAvailability(doc,config,1,at);assert.equal(status.remaining,0);assert.equal(status.nextAt,at+4*Core.HOUR);assert.equal(status.capNextAt,at+23*Core.HOUR);
  assert.equal(status.availableAt,at+23*Core.HOUR);
  doc.event.houses[Core.BIOMES[0]+':1']=at+25*Core.HOUR;assert.equal(Core.houseAvailability(doc,config,1,at).availableAt,at+25*Core.HOUR);doc.event.houses[Core.BIOMES[0]+':1']=at+4*Core.HOUR;
  assert.equal(Core.houseAvailability(doc,config,1,at+23*Core.HOUR).ready,true);
});
test('difficulty exposes material bottlenecks and the next-cycle gate without inventing elapsed completion times',()=>{
  for(const q of config.quests){const d=Balance.difficulty(config,q);assert.ok(d.level>=1&&d.level<=5);for(const item of d.items)assert.equal(item.expected,item.need/item.chance);}
  assert.equal(Balance.difficulty(config,config.quests.find(q=>q.id==='dech-wrong-letter')).nextCycle,true);
  assert.ok(Guide.summary(config,'crop-bloodrose').includes('ปลูก'));
  assert.ok(Guide.summary(config,'jacks-hollow-shovel').includes('Win'));
  const expected=1/.113+1/.08525-1/(.113+.08525);
  assert.ok(Math.abs(Balance.expectedCollection(config,[{id:'pending-human-bone',need:1},{id:'pending-human-skull',need:1}])-expected)<1e-9);
});
