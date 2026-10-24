import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),Catalog=require('../rewards/catalog.js'),Death=require('../death-quests.js'),Season=require('../event/season.js'),Authority=require('../server/authority.cjs');
const json=n=>JSON.parse(fs.readFileSync(new URL('../event/data/'+n+'.json',import.meta.url),'utf8'));
const make=()=>Core.build({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>json('quests.'+n)),catalog:Catalog,proposals:json('preview-rules'),authoritative:true,season:{startAt:Season.startAt,endAt:Season.endAt,timezone:Season.timezone,claimingEnabled:true}});
const at=Date.parse('2026-10-28T01:00:00+07:00'),uid='00000000-0000-4000-8000-000000000001';
function setup(){const c=make();c.materials.houseItems.dropChanceGivenCandy=0;const pool=c.materials.biomes[0].items.filter(x=>x.source==='house-item-pool');const rare=pool.find(x=>x.rarity==='Secret'),common=pool.find(x=>x.rarity==='Common');c.quests=[{id:'aid-test',biome:Core.BIOMES[2],phases:[{requirements:{items:[{id:rare.id,quantity:1},{id:common.id,quantity:1}]}}]}];const a=Authority.create({Core,Death,Season,config:c,randomSeed:()=>42});return {c,a,rare,common,d:a.initial(uid,at)};}
test('only the 30th legitimate biome visit grants one missing quest material, rarest first, then starts a fresh counter',()=>{
 const {c,a,rare,common}=setup();let d=a.initial(uid,at),last;
 for(let n=0;n<30;n++){const t=at+Math.floor(n/5)*Core.DAY+(n%5)*3000;d=a.apply(d,{type:'enter-biome',biome:Core.BIOMES[0]},{uid,at:t,tx:crypto.randomUUID()}).document;last=a.apply(d,{type:'house',house:n%5+1,choice:'treat'},{uid,at:t+1000+n,tx:crypto.randomUUID()});d=last.document;if(n<29)assert.equal(d.event.inventory[rare.id]||0,0);}
 assert.equal(last.result.questAid.item.id,rare.id);assert.equal(d.event.inventory[rare.id],1);assert.equal(d.event.inventory[common.id]||0,0);assert.equal(d.event.questAid[Core.BIOMES[0]].visits,0);assert.equal(d.event.questAid[Core.BIOMES[0]].grants,1);
 assert.throws(()=>a.apply(d,{type:'house',house:5,choice:'treat'},{uid,at:at+5*Core.DAY+20000,tx:crypto.randomUUID()}));assert.equal(d.event.inventory[rare.id],1);
 assert.deepEqual(c.materials.houseItems.rarityWeightsPercent,make().materials.houseItems.rarityWeightsPercent);
});
test('aid banks a full counter if no active quest needs a home-pool material; locked, grown and other-biome items are excluded',()=>{
 const {c,a,rare}=setup();c.quests[0].prerequisite='locked';let d=a.initial(uid,at);d.event.questAid={[Core.BIOMES[0]]:{visits:29,grants:0}};d.event.location={kind:'biome',biome:Core.BIOMES[0]};
 let x=a.apply(d,{type:'house',house:1,choice:'treat'},{uid,at:at+1000,tx:crypto.randomUUID()});assert.equal(x.result.questAid.item,null);assert.equal(x.document.event.questAid[Core.BIOMES[0]].visits,30);
 c.quests[0].prerequisite=null;x=a.apply(x.document,{type:'house',house:2,choice:'treat'},{uid,at:at+2000,tx:crypto.randomUUID()});assert.equal(x.result.questAid.item.id,rare.id);
 const candidates=c.materials.biomes[1].items.filter(x=>x.source==='house-item-pool');c.quests[0].phases[0].requirements={items:[{id:candidates[0].id,quantity:1},{id:rare.id,quantity:2,mustBePlayerGrown:true}]};d=x.document;d.event.questAid[Core.BIOMES[0]].visits=29;
 x=a.apply(d,{type:'house',house:3,choice:'treat'},{uid,at:at+3000,tx:crypto.randomUUID()});assert.equal(x.result.questAid.item,null);assert.equal(x.document.event.questAid[Core.BIOMES[0]].visits,30);
});
test('confirmed Dech quantities and the reusable Shovel work in the real engine',()=>{
 const c=make();for(const q of c.quests)for(const p of q.phases)for(const branch of p.requirements.anyOf||[p.requirements]){const r=Core.resolveRequirements(c,q,p.requirements,branch.id);for(const i of r.items||[])assert.ok(i.quantity>0||i.consume===false&&i.mustPossess,q.id);}
 const q=c.quests.find(q=>q.phases.some(p=>JSON.stringify(p.requirements).includes('jacks-hollow-shovel')));assert.ok(q);const p=q.phases.find(p=>JSON.stringify(p.requirements).includes('jacks-hollow-shovel'));assert.equal(Core.resolveRequirements(c,q,p.requirements).items.find(i=>i.id==='jacks-hollow-shovel').consume,false);
});
