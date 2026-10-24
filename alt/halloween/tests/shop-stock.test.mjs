import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),Catalog=require('../rewards/catalog.js'),Ownership=require('../rewards/ownership.js');
const load=file=>JSON.parse(fs.readFileSync(new URL('../event/data/'+file,import.meta.url),'utf8'));
const config=Core.build({materials:load('materials.json'),chains:['dutchman','jack','vampire','graveyard'].map(n=>load('quests.'+n+'.json')),catalog:Catalog,proposals:load('preview-rules.json'),preview:true});
const time=Date.parse('2026-10-24T10:20:00+07:00');
function harness(storage){
 const map=new Map();storage ||= {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 const store=Ownership.createStore({storage,key:'test',owner:'review',season:config.season.id,initial:()=>{const d=Core.initial(config,'review',time,42);d.event.candy=2000;d.event.location={kind:'room',room:'shop'};return d;}});
 let n=0;return {store,apply:(a,id='s'+(++n),now=time)=>store.transact(id,d=>Core.dispatch(d,config,a,{now,tx:id}))};
}
test('hourly stock is stable, finite, read-only, and only contains shop cosmetics',()=>{
 const d=Core.initial(config,'review',time,42),before=JSON.stringify(d),a=Core.shopStock(d,config,time);
 assert.deepEqual(a,Core.shopStock(d,config,time+100));assert.equal(JSON.stringify(d),before);
 assert.equal(Object.values(a.remaining).reduce((s,n)=>s+n,0),6);
 for(const [id,n] of Object.entries(a.remaining)){assert.ok(n>=0&&Number.isSafeInteger(n));assert.ok(config.proposals.shop[id]);assert.ok(['Common','Uncommon','Epic'].includes(config.rewards[id].rarity));assert.ok(!['relic','theme','costume'].includes(config.rewards[id].kind));}
 assert.equal(a.nextAt,(a.epoch+1)*Core.HOUR);
});
test('stock rotates exactly at the hour, including old saves without stock metadata',()=>{
 const d=Core.initial(config,'review',time,42);delete d.event.shopSeed;
 const a=Core.shopStock(d,config,time),b=Core.shopStock(d,config,a.nextAt-1),c=Core.shopStock(d,config,a.nextAt);
 assert.deepEqual(a,b);assert.equal(c.epoch,a.epoch+1);assert.equal(Object.values(c.remaining).reduce((s,n)=>s+n,0),6);assert.deepEqual(Core.shopStock(d,config,time),a);
});
test('30,000 shop lots follow their own 60/30/10 tier rates without advancing the house RNG',()=>{
 const d=Core.initial(config,'review',time,42),rng=d.event.rng,counts={Common:0,Uncommon:0,Epic:0};
 for(let n=0;n<5000;n++){const s=Core.shopStock(d,config,time+n*Core.HOUR);for(const [id,count]of Object.entries(s.remaining))counts[config.rewards[id].rarity]+=count;}
 for(const [rarity,weight]of Object.entries(config.proposals.shopStock.rarityWeightsPercent))assert.ok(Math.abs(counts[rarity]/30000-weight/100)<.012,rarity+' distribution');
 assert.equal(d.event.rng,rng);assert.equal(config.materials.houseCandy.initialCooldownHours,4);
});
test('the next hour replenishes stock while preserving owned rewards and house cooldowns',async()=>{
 const h=harness(),s=Core.shopStock(h.store.read(),config,time),id=Object.keys(s.remaining).find(id=>s.remaining[id]>0);
 await h.apply({type:'buy',item:id,stockEpoch:s.epoch});const before=h.store.read();
 const next=Core.shopStock(before,config,s.nextAt);assert.equal(Object.values(next.remaining).reduce((n,v)=>n+v,0),6);assert.ok(before.rewards[id]);assert.deepEqual(h.store.read(),before);
});
test('purchase commits debit, stock, reward and receipt once; reload preserves all',async()=>{
 const h=harness(),s=Core.shopStock(h.store.read(),config,time),id=Object.keys(s.remaining).find(id=>s.remaining[id]>0),action={type:'buy',item:id,stockEpoch:s.epoch};
 const a=await h.apply(action,'same'),b=await h.apply(action,'same');assert.ok(b.replay);assert.deepEqual(a.result,b.result);
 const d=h.store.read();assert.equal(d.event.candy,2000-config.proposals.shop[id]);assert.equal(Core.shopStock(d,config,time).remaining[id],s.remaining[id]-1);assert.ok(d.rewards[id]);
 await assert.rejects(h.apply(action),/มีของ/);assert.equal(h.store.read().event.purchases.length,1);
});
test('out of stock, stale quote, missing quote, insufficient funds and wrong room never charge',async()=>{
 const h=harness(),s=Core.shopStock(h.store.read(),config,time),inStock=Object.keys(s.remaining).find(id=>s.remaining[id]>0),empty=Object.keys(s.remaining).find(id=>s.remaining[id]===0);
 assert.ok(empty);await assert.rejects(h.apply({type:'buy',item:empty,stockEpoch:s.epoch}),/หมด/);
 await assert.rejects(h.apply({type:'buy',item:inStock,stockEpoch:s.epoch-1}),/รอบ/);
 await assert.rejects(h.apply({type:'buy',item:inStock}),/รอบ/);
 assert.equal(h.store.read().event.candy,2000);
 await h.apply({type:'enter-hub'});await assert.rejects(h.apply({type:'buy',item:inStock,stockEpoch:s.epoch}),/ร้าน/);
 const poor=Core.initial(config,'review',time,42);poor.event.location={kind:'room',room:'shop'};
 const p=harness({getItem:()=>JSON.stringify(poor),setItem:()=>assert.fail('must not write')});await assert.rejects(p.apply({type:'buy',item:inStock,stockEpoch:s.epoch}),/Candy ไม่พอ/);
});
test('a quote that crosses the restock boundary is rejected without spending',async()=>{
 const h=harness(),s=Core.shopStock(h.store.read(),config,time),id=Object.keys(s.remaining).find(id=>s.remaining[id]>0);
 await assert.rejects(h.apply({type:'buy',item:id,stockEpoch:s.epoch},'late',s.nextAt),/รอบ/);assert.equal(h.store.read().event.candy,2000);
});
test('concurrent purchases and failed storage cannot split stock, balance and ownership',async()=>{
 const h=harness(),s=Core.shopStock(h.store.read(),config,time),id=Object.keys(s.remaining).find(id=>s.remaining[id]>0),a={type:'buy',item:id,stockEpoch:s.epoch};
 const results=await Promise.allSettled([h.apply(a),h.apply(a)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const q=harness({getItem:()=>null,setItem:()=>{throw Error('Quota');}});await assert.rejects(q.apply(a),/Quota/);assert.equal(q.store.read().event.candy,2000);assert.equal(Core.shopStock(q.store.read(),config,time).remaining[id],s.remaining[id]);
});
test('crop quote rejects stale inventory and never sells quest-only produce',async()=>{
 const d=Core.initial(config,'review',time,42),biome=Core.BIOMES[1],crop=config.proposals.crops[biome];d.event.location={kind:'room',room:'shop'};d.event.inventory[crop.harvest]=5;d.event.grown[crop.harvest]=3;
 assert.throws(()=>Core.dispatch(d,config,{type:'sell-crop',biome,quantity:1,expectedGrown:4,expectedInventory:5},{now:time,tx:'a'}),/เปลี่ยน/);assert.equal(d.event.candy,0);
 const map=new Map([['test',JSON.stringify(d)]]),h=harness({getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}),a={type:'sell-crop',biome,quantity:2,expectedGrown:3,expectedInventory:5};await h.apply(a,'sale');await h.apply(a,'sale');
 assert.equal(h.store.read().event.candy,20);await assert.rejects(h.apply(a),/เปลี่ยน/);assert.equal(h.store.read().event.inventory[crop.harvest],3);assert.equal(h.store.read().event.grown[crop.harvest],1);
});
