import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../rewards/catalog.js');
const json=name=>JSON.parse(fs.readFileSync(new URL('../event/data/'+name,import.meta.url),'utf8'));
test('all 28 rewards have unique IDs and distributable art; outfits stay in rituals',()=>{
 assert.equal(C.items.length,28);assert.equal(new Set(C.items.map(x=>x.id)).size,28);
 const counts={};for(const item of C.items){counts[item.kind]=(counts[item.kind]||0)+1;assert.ok(C.biomes[item.biome]);assert.ok(item.permanent);assert.ok(fs.existsSync(new URL('../rewards/'+(item.asset||'assets/'+item.id+'.svg'),import.meta.url)),item.id);}
 assert.deepEqual(counts,{room:8,costume:2,theme:5,effect:8,relic:4,badge:1});
 for(const item of C.items.filter(x=>x.kind==='costume')){assert.equal(item.rarity,'Rare');assert.equal(item.source,'ritual');}
 assert.equal(C.find('crown-of-midnight').source,'complete-shop');
});
test('permanent offline files survive removal of event directory',()=>{
 const context={self:{}};vm.runInNewContext(fs.readFileSync(new URL('../cache-manifest.js',import.meta.url),'utf8'),context);
 for(const file of context.self.HALLOWEEN_SHELL){assert.ok(!file.includes('/event/'));assert.ok(fs.existsSync(new URL('../../'+file,import.meta.url)),file);}
 for(const item of C.items){const expected='halloween/rewards/'+(item.asset||'assets/'+item.id+'.svg');assert.ok(context.self.HALLOWEEN_SHELL.includes(expected),expected);}
});
test('Tang keeps revised recipe, existing craft and two-phase final rewards',()=>{
 const {quests:q}=json('quests.dutchman.json');assert.equal(q[0].phases[0].requirements.candy,50);assert.ok(q[0].preserveExistingCraft);
 assert.deepEqual(q[0].phases[0].requirements.items.map(x=>[x.name,x.quantity]),[['Abyssal rock',1],["Dutchman's Lantern",1]]);
 assert.ok(q[1].phases[0].requirements.minigame.mustClear);assert.equal(q[2].phases.length,2);assert.equal(q[2].phases[1].requirements.items[0].quantity,10);assert.ok(q[2].grantRewardsAfterFinalPhaseOnly);
 assert.deepEqual(q[2].rewards.map(x=>x.id),['greater-spear','theme-ghostship']);
});
test('Jack requires player-grown pumpkins, then one offer followed by surprise head',()=>{
 const {quests:q}=json('quests.jack.json');assert.equal(q[0].phases.length,2);assert.ok(q[0].grantRewardsAfterFinalPhaseOnly);
 const crop=q[1].phases[0].requirements.items.find(x=>x.name==='Pumpkin');assert.equal(crop.quantity,3);assert.ok(crop.mustBePlayerGrown);
 assert.equal(q[2].phases[0].requirements.anyOf.length,2);assert.equal(q[2].phases[0].requirements.anyOf[0].candy,200);
 assert.equal(q[2].phases[1].requirements.items[0].name,'His head');assert.ok(q[2].grantRewardsAfterFinalPhaseOnly);
 assert.deepEqual(q[2].rewards.map(x=>x.id),['jacks-axe','theme-jackhollow']);
 for(const quests of [q,json('quests.dutchman.json').quests])for(let i=1;i<quests.length;i++)assert.equal(quests[i].prerequisite,quests[i-1].id);
});
test('Dech awards the quill in Quest 1 and requires the next biome cycle for the finale',()=>{
 const spec=json('quests.vampire.json'),q=spec.quests;assert.equal(q[0].rewards[0].id,'cruor-quill');
 assert.deepEqual(q[0].phases[0].requirements.items.map(x=>x.quantity),[1,1,1]);
 assert.equal(spec.minigame.kind,'spot-the-difference');assert.equal(spec.minigame.location,'บ้านเดช');assert.equal(q[1].phases[0].requirements.minigame.clears,1);
 assert.ok(q[1].nextQuestGate.mustWaitForNextOccurrence);assert.ok(q[2].availability.mustWaitForNextOccurrence);
 assert.equal(q[2].phases[0].requirements.items.length,9);assert.ok(q[2].phases[0].requirements.items.every(x=>x.quantity===null));
 assert.equal(q[2].rewards[0].quantity,100);assert.equal(q[2].rewards[1].id,'theme-vampire');assert.equal(C.find('theme-vampire').questId,q[2].id);
});
test('fitting room uses memory and blocks account configuration; ordinary app is untouched',()=>{
 const source=fs.readFileSync(new URL('../rewards/preview-mode.js',import.meta.url),'utf8');
 function run(search){const original={getItem(){return 'REAL DATA';},setItem(){throw Error('real storage write');}},window={localStorage:original,sessionStorage:original,SUPABASE_CONFIG:{url:'real-account'}},document={documentElement:{dataset:{}}};vm.runInNewContext(source,{window,document,location:{search},URLSearchParams});return {window,document,original};}
 const regular=run('');assert.equal(regular.window.localStorage,regular.original);assert.equal(regular.window.SUPABASE_CONFIG.url,'real-account');
 const fitting=run('?halloween-showroom=1');assert.notEqual(fitting.window.localStorage,fitting.original);assert.ok(fitting.window.__HW_SHOWROOM__);fitting.window.SUPABASE_CONFIG={url:'must-not-connect'};assert.equal(fitting.window.SUPABASE_CONFIG.url,undefined);assert.ok(fitting.window.localStorage.getItem('studentos.alt.v1').includes('hw-sample-math'));
});
test('the collection parent keeps the fitting room isolated after query cleanup and worker reload',()=>{
 const source=fs.readFileSync(new URL('../rewards/preview-mode.js',import.meta.url),'utf8');
 for(const flag of [true,false,'true']){
  const real={getItem(){return 'REAL DATA';},setItem(){throw Error('real storage write');}},window={parent:{__STUDENTOS_HALLOWEEN_COLLECTION__:flag},localStorage:real,sessionStorage:real,SUPABASE_CONFIG:{url:'real-account'}},document={documentElement:{dataset:{}}};
  vm.runInNewContext(source,{window,document,location:{search:''},URLSearchParams});
  assert.equal(window.__HW_SHOWROOM__===true,flag===true);
  if(flag===true){assert.notEqual(window.localStorage,real);assert.equal(window.SUPABASE_CONFIG.url,undefined);}else assert.equal(window.localStorage,real);
 }
});
