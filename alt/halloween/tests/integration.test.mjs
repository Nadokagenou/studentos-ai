import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),C=require('../rewards/catalog.js'),N=require('../rewards/integration.js');
test('ALT enables precisely 23 cosmetics and never enables relics or badges',()=>{
 assert.equal(N.items.length,23);for(const item of C.items)assert.equal(N.available(item.id),!['relic','badge'].includes(item.kind));
 assert.equal(N.available('unknown'),false);assert.equal(N.isEffect('cruor-quill'),false);
});
test('room items fit existing native slots and are selectable without buying',()=>{
 const items=N.roomEntries('https://example.test/alt/halloween/rewards/');assert.equal(items.length,8);
 assert.ok(items.every(x=>['desk','shelf','poster','ceiling','pet'].includes(x.slot)&&x.cost===0));
 assert.equal(items.find(x=>x.id==='hw-velvet-bat').slot,'ceiling');assert.ok(items.every(x=>x.svg.includes('https://example.test/alt/halloween/rewards/')));
});
test('costume preference validates its mascot and cannot grant an event item',()=>{
 const map=new Map([['studentos.alt.v1','KEEP TASKS']]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 assert.ok(N.saveCostume(storage,'sai-witch'));assert.equal(N.readCostumes(storage).sai,'sai-witch');assert.equal(map.get('studentos.alt.v1'),'KEEP TASKS');
 assert.equal(N.saveCostume(storage,'crown-of-midnight'),false);assert.equal(N.saveCostume(storage,'cruor-quill'),false);
 map.set(N.COSTUME_KEY,JSON.stringify({sai:'hook-mummy',hook:'cruor-quill'}));assert.deepEqual(N.readCostumes(storage),{});
});
test('Win retains the restricted scythe stage, non-consuming proof and permanent final theme',()=>{
 const spec=JSON.parse(fs.readFileSync(new URL('../event/data/quests.graveyard.json',import.meta.url),'utf8')),q=spec.quests;assert.equal(q.length,5);
 for(let i=1;i<q.length;i++)assert.equal(q[i].prerequisite,q[i-1].id);
 assert.equal(q[0].rewards[0].name,'Shovel');assert.equal(q[1].phases[1].requirements.minigame.timeLimitSeconds,30);assert.ok(q[1].grantRewardsAfterFinalPhaseOnly);
 assert.equal(q[3].rewards[0].restriction.status,'Restricted');assert.deepEqual(q[3].rewards[0].restriction.allowedBiomes,[]);
 assert.equal(q[4].phases[0].requirements.candy,50);assert.equal(q[4].phases[0].requirements.items[0].consume,false);assert.equal(q[4].rewards[0].kind,'upgrade-existing');assert.ok(q[4].rewards[0].removeRestriction);assert.equal(q[4].rewards[1].id,'theme-graveyard');
});
test('native completion selection accepts Halloween without changing regular ownership',()=>{
 let source=fs.readFileSync(new URL('../../hoop.js',import.meta.url),'utf8');
 if(process.env.HW_NATIVE_REGRESSION)source=source.replace("!!window.HalloweenCosmetics?.isEffect(id) || ",'').replace("  if (window.HalloweenCosmetics?.isEffect(id)) return !!document.querySelector('.phone');",'');
 const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const storage=new Map([['studentos.alt.doneFx','fx-soulwake']]),context={window:{HalloweenCosmetics:N},localStorage:{getItem:k=>storage.get(k)},DONEFX_KEY:'studentos.alt.doneFx',tokenState:()=>({fx:['goal']}),FX_GAMES:{goal:{}},document:{querySelector:()=>({})},matchMedia:()=>({matches:false})};
 vm.runInNewContext(extract('function fxOwned(', '// ---------- โหมด 3D')+extract('function doneFxPref(', '// เปิดเอฟเฟกต์ที่เลือกไว้'),context);
 assert.equal(context.fxOwned('fx-soulwake'),true);assert.equal(context.fxOwned('goal'),true);assert.equal(context.fxOwned('hoop'),false);assert.equal(context.fxOwned('dullahan-scythe'),false);assert.equal(context.doneFxPref(),'fx-soulwake');assert.equal(context.doneFxActive(),true);
});
