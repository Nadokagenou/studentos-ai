import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),Guide=require('../event/guide.js'),Objective=require('../event/objective.js'),Catalog=require('../rewards/catalog.js');
const load=x=>JSON.parse(fs.readFileSync(new URL('../event/data/'+x+'.json',import.meta.url),'utf8'));
const config=Core.build({materials:load('materials'),chains:['dutchman','jack','vampire','graveyard'].map(x=>load('quests.'+x)),catalog:Catalog,proposals:load('preview-rules'),preview:true});
// 20:00 เวลาไทย = ช่วงประตูสุสาน (18–24)
const at=Date.parse('2026-10-24T20:00:00+07:00');
const fresh=(seed=1)=>{const doc=Core.initial(config,'test',at,seed);return doc;};
const next=(doc,route,now=at)=>Objective.next({Core,Guide,config,doc,now,route});

test('the graveyard is the open gate at 20:00 Bangkok time and closes at midnight',()=>{
  const doc=fresh();
  assert.equal(Core.biomeAt(doc,config,at).id,'eternal-graveyard');
  assert.equal(Objective.windowOf(Core,doc,config,at).closesAt,Date.parse('2026-10-25T00:00:00+07:00'));
  assert.equal(Objective.nextOpen(Core,doc,at,'dutchmans-soul'),Date.parse('2026-10-25T00:00:00+07:00'));
  assert.equal(Objective.nextOpen(Core,doc,at,'eternal-graveyard'),at);
  assert.equal(Objective.nextOpen(Core,doc,at,'eternal-graveyard',true),Date.parse('2026-10-25T18:00:00+07:00'));
});

test('a new player is walked gate → portal → Win → houses → hand-in, one step at a time',()=>{
  const doc=fresh();
  assert.equal(next(doc,'gate').action.kind,'enter-hub');
  const hub=next(doc,'hub');
  assert.equal(hub.action.kind,'enter-biome');assert.equal(hub.action.biome,'eternal-graveyard');assert.equal(hub.target,'portal');
  assert.deepEqual(hub.steps.map(s=>s.state),['now','todo','todo','todo']);
  const talk=next(doc,'biome');assert.equal(talk.target,'npc');assert.equal(talk.action.quest,'win-death-fragments');
  doc.event.visits.stories['eternal-graveyard']=true;
  const gather=next(doc,'biome');
  assert.equal(gather.action.kind,'village');assert.equal(gather.target,'village');
  assert.deepEqual(gather.need.map(n=>n.id),['pending-human-bone','pending-human-skull']);
  assert.deepEqual(gather.need.map(n=>n.icon),['🦴','💀']);
  assert.deepEqual(gather.steps.map(s=>s.state),['done','done','now','todo']);
  doc.event.inventory['pending-human-bone']=1;
  assert.deepEqual(next(doc,'biome').need.map(n=>n.id),['pending-human-skull']);
  doc.event.inventory['pending-human-skull']=1;
  const ready=next(doc,'biome');assert.equal(ready.ready,true);assert.equal(ready.action.kind,'quest');assert.equal(ready.target,'npc');
});

test('after the shovel the objective points at the dig game, then the ghosts, never at a locked game',()=>{
  const doc=fresh();doc.event.visits.stories['eternal-graveyard']=true;doc.event.quests['win-death-fragments']={phase:1,complete:true};
  let o=next(doc,'biome');assert.equal(o.action.kind,'game');assert.equal(o.action.game,'grave-digging');assert.equal(o.target,'game:grave-digging');
  doc.event.proofs['grave-digging']={complete:true,clear:true};doc.event.quests['win-gravekeeper-trial']={phase:1,complete:false};
  o=next(doc,'biome');assert.equal(o.action.game,'catch-all-ghosts');
});

test('a missing low-tier item from another biome still routes to the houses, and the luck meter can deliver it',()=>{
  const morning=Date.parse('2026-10-24T08:00:00+07:00'),doc=fresh();
  doc.event.visits.stories['jacks-hollow']=true;doc.event.quests['jack-clear-garden']={phase:2,complete:true};
  doc.event.inventory['jacks-hollow-pumpkin']=3;doc.event.grown['jacks-hollow-pumpkin']=3;doc.event.inventory['jacks-hollow-jack-o-wood']=1;doc.event.inventory['dutchmans-soul-seaweed']=1;
  const o=next(doc,'biome',morning);
  assert.deepEqual(o.need.map(n=>n.id),['jacks-hollow-shovel']);
  assert.equal(o.action.kind,'village');
  assert.ok(Core.pityTargets(doc,config,'jacks-hollow',morning).wanted.some(x=>x.id==='jacks-hollow-shovel'));
});

test('a finished chain asks for the guardian, then points at the next gate with work left',()=>{
  const doc=fresh();for(const q of config.quests.filter(q=>q.biome==='eternal-graveyard'))doc.event.quests[q.id]={phase:q.phases.length,complete:true};
  let o=next(doc,'biome');assert.equal(o.action.kind,'boss');assert.equal(o.target,'boss');
  doc.event.bossWins={'headless-warden':{at}};
  o=next(doc,'biome');assert.equal(o.action.kind,'wait');assert.equal(o.wait.biome,'dutchmans-soul');
});

test('luck meter guarantees a missing quest item after the threshold and resets on a hit',()=>{
  // หาเมล็ดที่ Treat สุ่มไม่ได้ของสองครั้งติด เพื่อพิสูจน์ว่าครั้งที่สามการันตี (เควสแรก เกณฑ์ 1)
  let checked=0;
  for(let seed=1;seed<4000&&checked<40;seed++){
    const doc=fresh(seed);doc.event.previewBiome='eternal-graveyard';
    const r1=Core.dispatch(doc,config,{type:'house',house:1,choice:'treat'},{now:at,tx:'a'});
    if(r1.wanted)continue;
    assert.equal(doc.event.luck['win-death-fragments'],1);
    const r2=Core.dispatch(doc,config,{type:'house',house:2,choice:'treat'},{now:at,tx:'b'});
    assert.equal(r2.item.pity,true);assert.equal(r2.wanted,true);
    assert.ok(['pending-human-bone','pending-human-skull'].includes(r2.item.id));
    assert.equal(doc.event.luck['win-death-fragments'],0);
    checked++;
  }
  assert.ok(checked>=40);
});

test('luck meter never guarantees rare items and never fires on a Trick that paid nothing',()=>{
  const doc=fresh(7);doc.event.previewBiome='eternal-graveyard';
  for(const id of ['win-death-fragments','win-gravekeeper-trial'])doc.event.quests[id]={phase:9,complete:true};
  const p=Core.pityTargets(doc,config,'eternal-graveyard',at);
  assert.equal(p.quest,'win-forge-blade');
  assert.deepEqual(p.wanted,[],'Soul Vessel / Grim Scythe / Scrap Iron are Epic+ so no guarantee');
  const d2=fresh(3);d2.event.previewBiome='eternal-graveyard';d2.event.luck={'win-death-fragments':5};
  let zero=null;
  for(let h=1;h<=5&&!zero;h++){const r=Core.dispatch(d2,config,{type:'house',house:h,choice:'trick'},{now:at,tx:'t'+h});if(r.candy===0)zero=r;else break;}
  if(zero){assert.equal(zero.item,null);}
});

test('first Win quest finishes within the five houses of one visit thanks to the luck meter',()=>{
  for(let seed=1;seed<=500;seed++){
    const doc=fresh(seed);doc.event.previewBiome='eternal-graveyard';
    for(let h=1;h<=5;h++)Core.dispatch(doc,config,{type:'house',house:h,choice:'treat'},{now:at,tx:'k'+h});
    assert.ok(doc.event.inventory['pending-human-bone']>=1&&doc.event.inventory['pending-human-skull']>=1,'seed '+seed);
  }
});
