import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),Catalog=require('../rewards/catalog.js');
const json=n=>JSON.parse(fs.readFileSync(new URL('../event/data/'+n+'.json',import.meta.url),'utf8'));
const config=Core.build({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>json('quests.'+n)),catalog:Catalog,proposals:json('preview-rules'),preview:true}),at=Date.parse('2026-10-28T01:00:00+07:00');
const ids=['ghost-ship-hunt','clear-jacks-garden-vines','dech-house-spot-difference','grave-digging','catch-all-ghosts'];
function start(id,seed){const d=Core.initial(config,'test',at,seed);d.event.previewBiome=Core.gameDefinition(id,config).biome;d.event.inventory['spectral-lantern']=1;d.event.quests['jack-clear-garden']={phase:1};d.event.quests['win-death-fragments']={complete:true};d.event.proofs['grave-digging']={complete:true};Core.dispatch(d,config,{type:'start-game',game:id},{now:at,tx:'round-'+seed});return d;}
test('five games randomize their scene and boards once per round, retaining valid targets and old completion rules',()=>{
 for(const id of ids){const variants=new Set(),boards=new Set();for(let seed=1;seed<=160;seed++){const d=start(id,Math.imul(seed,295075153)),g=d.event.games[id];assert.ok([0,1,2].includes(g.variant),id);variants.add(g.variant);assert.equal(JSON.stringify(JSON.parse(JSON.stringify(d)).event.games[id]),JSON.stringify(g));if(id!=='ghost-ship-hunt'){assert.equal(new Set(g.board).size,g.total);assert.ok(g.board.every(n=>n>=0&&n<g.total));boards.add(g.board.join(','));}if(id==='catch-all-ghosts'){assert.equal(new Set(g.spawnSlots).size,g.total);assert.ok(g.spawnSlots.every(n=>n>=0&&n<9));}if(id==='dech-house-spot-difference'){assert.equal(new Set(g.differences).size,5);assert.ok(g.differences.every(n=>n>=0&&n<8));boards.add(g.differences.join(','));}}
 assert.equal(variants.size,3,id);if(id!=='ghost-ship-hunt')assert.ok(boards.size>20,id);
 }
});
test('Dech Q3 exposes the actual next appointment and releases the gate on the next Bangkok day',()=>{
 const d=Core.initial(config,'test',at,42),q=config.quests.find(q=>q.id==='dech-wrong-letter');d.event.previewBiome=q.biome;
 const completedAt=Date.parse('2026-10-28T16:00:00+07:00'),cycle=Math.floor((completedAt+7*Core.HOUR)/Core.DAY);
 d.event.quests[q.prerequisite]={complete:true,completedAt,completedCycle:cycle};
 const wait=Core.questWait(d,config,q,completedAt);assert.equal(wait.waiting,true);assert.equal(wait.nextAt,Date.parse('2026-10-29T12:00:00+07:00'));
 assert.equal(Core.questWait(d,config,q,Date.parse('2026-10-28T23:59:59+07:00')).waiting,true);
 assert.equal(Core.questWait(d,config,q,Date.parse('2026-10-29T00:00:00+07:00')).waiting,false);
});
