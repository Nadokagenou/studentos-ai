import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),C=require('../rewards/catalog.js'),Death=require('../death-quests.js'),Season=require('../event/season.js'),A=require('../server/authority.cjs'),H=require('../server/handler.cjs');
const json=n=>JSON.parse(fs.readFileSync(new URL('../event/data/'+n+'.json',import.meta.url),'utf8'));
const config=Core.build({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>json('quests.'+n)),catalog:C,proposals:json('preview-rules'),authoritative:true,season:{startAt:Season.startAt,endAt:Season.endAt,timezone:Season.timezone,claimingEnabled:true}});
const at=Date.parse('2026-10-28T01:00:00+07:00'),uid='00000000-0000-4000-8000-000000000001';
const authority=A.create({Core,Death,Season,config,randomSeed:()=>19483922});
const apply=(d,a,t=at,tx=crypto.randomUUID())=>authority.apply(d,a,{uid,at:t,tx});
test('Bangkok opening and closing boundaries cover all of November 30',()=>{assert.equal(Season.state(Date.parse(Season.startAt)-1),'upcoming');assert.equal(Season.state(Date.parse(Season.startAt)),'active');assert.equal(Season.state(Date.parse(Season.endAt)-1),'active');assert.equal(Season.state(Date.parse(Season.endAt)),'ended');});
test('server rejects every preview escape and ignores forged clocks, owners, seeds and reward flags',()=>{
 const d=authority.initial(uid,at);
 for(const type of ['preview-time','preview-supplies','preview-close','preview-biome','task','studentos-mission','win','grant','reset'])assert.throws(()=>apply(d,{type}));
 const x=apply(d,{type:'enter-hub',now:at+999999999,owner:'another',rewards:['theme-midnight-academy'],candy:9999});assert.equal(x.document.event.candy,0);assert.deepEqual(x.document.rewards,{});assert.equal(x.document.owner,uid);assert.equal(x.document.event.timeOffset,0);
 assert.throws(()=>apply({...d,owner:'another'},{type:'enter-hub'}));
 assert.throws(()=>apply(d,{type:'house',house:1,choice:'treat'},Date.parse(Season.startAt)-1));
 assert.throws(()=>apply(d,{type:'house',house:1,choice:'treat'},Date.parse(Season.endAt)));
 assert.equal(d.revision,0);
});
test('server alone grants Candy once and enforces the house cooldown',()=>{let d=authority.initial(uid,at);d=apply(d,{type:'enter-biome',biome:Core.BIOMES[0]}).document;const x=apply(d,{type:'house',house:1,choice:'treat'},at+1000);assert.equal(x.document.event.candy,10);assert.equal(d.event.candy,0);assert.throws(()=>apply(x.document,{type:'house',house:1,choice:'treat'},at+2000));assert.equal(x.document.revision,2);const p=authority.publicDocument(x.document);assert.equal(p.event.rng,undefined);assert.deepEqual(p.receipts,{});});
test('a real server quest cannot be completed with client focus counters or accelerated / overlapping heartbeats',()=>{
 let d=apply(authority.initial(uid,at),{type:'death-quest-enroll'}).document;const q=Object.values(d.event.deathQuests)[0];assert.equal(q.owner,uid);assert.equal(q.authoritative,true);
 assert.throws(()=>apply(d,{type:'death-quest-claim',quest:q.id,activeMs:1200000},at+1200001));
 const pulse=(session,t,active=true)=>{d=apply(d,{type:'focus-pulse',taskId:q.taskId,session,active},t).document;};
 pulse('session-a-long-enough',at+1000);pulse('session-b-long-enough',at+6000);pulse('session-a-long-enough',at+11000);assert.equal(d.event.focusProofs[q.taskId].activeMs,10000);
 pulse('session-a-long-enough',at+11100);assert.equal(d.event.focusProofs[q.taskId].activeMs,10100);
 pulse('session-a-long-enough',at+60000);assert.equal(d.event.focusProofs[q.taskId].activeMs,10100);
 assert.throws(()=>apply(d,{type:'focus-finish',taskId:q.taskId},at+61000));
 for(let t=70000;t<=1260000;t+=10000)pulse('session-a-long-enough',at+t);
 assert.equal(d.event.focusProofs[q.taskId].activeMs,1200000);d=apply(d,{type:'focus-finish',taskId:q.taskId},at+1270000).document;
 const result=apply(d,{type:'death-quest-claim',quest:q.id},at+1280000);assert.equal(result.document.event.candy,10);assert.throws(()=>apply(result.document,{type:'death-quest-claim',quest:q.id},at+1290000));
});
function harness(){let doc=null,time=at;const receipts=new Map();const db={async read(){return doc&&{document:structuredClone(doc)};},async receipt(u,s,tx){return receipts.get(tx);},async commit(x){if((doc?.revision||0)!==x.expected)return {committed:false};if(receipts.has(x.tx))return {committed:true,replay:true,result:receipts.get(x.tx).result};doc=structuredClone(x.document);receipts.set(x.tx,{action:x.action,result:x.result});return {committed:true,replay:false,result:x.result};}};const handler=H.create({authority,db,authenticate:async token=>token==='Bearer valid'?uid:null,clock:()=>time+=1000,season:Season});return {handler,db,receipts,read:()=>doc};}
const request=(action,requestId=crypto.randomUUID(),token='Bearer valid')=>new Request('https://example.test/halloween-event',{method:'POST',headers:{authorization:token,'content-type':'application/json'},body:JSON.stringify({action,requestId})});
test('HTTP boundary authenticates first, never accepts client documents and safely replays a lost response',async()=>{
 const h=harness();assert.equal((await h.handler(request({type:'read'},undefined,''))).status,401);
 const tx=crypto.randomUUID(),r=await h.handler(request({type:'enter-hub'},tx));assert.equal(r.status,200);const a=await r.json();assert.equal(a.document.owner,uid);
 const replay=await (await h.handler(request({type:'enter-hub'},tx))).json();assert.equal(replay.replay,true);assert.equal(h.read().revision,1);assert.equal(h.receipts.size,1);
 assert.equal((await h.handler(request({type:'house',house:1,choice:'treat'},tx))).status,409);
 assert.equal((await h.handler(request({type:'preview-supplies'}))).status,400);
 assert.equal((await h.handler(new Request('https://example.test',{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);
});
test('two simultaneous account requests preserve both committed changes across a CAS retry',async()=>{const h=harness();const responses=await Promise.all([h.handler(request({type:'enter-hub'})),h.handler(request({type:'enter-room',room:'garden'}))]);assert.ok(responses.every(x=>x.status===200));assert.equal(h.read().revision,2);assert.equal(h.receipts.size,2);});

test('real shop, crafting and Totem use server inventory and balance; clients cannot supply their own result',()=>{
 let d=authority.initial(uid,at);d.event.candy=500;d.event.location={kind:'room',room:'shop'};
 const stock=Core.shopStock(d,config,at),item=Object.keys(stock.remaining).find(id=>stock.remaining[id]>0),price=config.proposals.shop[item];
 const purchase=apply(d,{type:'buy',item,stockEpoch:stock.epoch,candy:999999,rewards:['theme-midnight-academy']},at+1000);
 assert.equal(purchase.document.event.candy,500-price);assert.ok(purchase.document.rewards[item]);assert.equal(purchase.document.rewards['theme-midnight-academy'],undefined);
 d=authority.initial(uid,at);d.event.candy=500;d.event.location={kind:'room',room:'cauldron'};
 const recipe=config.proposals.recipes.find(x=>x.id==='brew-ship');for(const [id,n] of recipe.items)d.event.inventory[id]=n;
 const craft=apply(d,{type:'craft',recipe:'brew-ship'},at+1000);assert.equal(craft.document.event.candy,500-recipe.candy);assert.ok(craft.document.rewards['fx-dutchman-arrival']);
 const totem=apply(craft.document,{type:'totem',biome:Core.BIOMES[2]},at+2000);assert.equal(totem.document.event.candy,craft.document.event.candy-config.proposals.totem.price);assert.equal(totem.document.event.totem.biome,Core.BIOMES[2]);
 assert.equal(Core.portalStatus(totem.document,config,Core.BIOMES[2],at+3000).open,true);
});

test('the live engine is not preview and independently rejects tools even without the HTTP whitelist',()=>{
 const live=Core.build({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>json('quests.'+n)),catalog:C,proposals:json('preview-rules'),authoritative:true,season:{startAt:Season.startAt,endAt:Season.endAt,timezone:Season.timezone,claimingEnabled:true}});
 assert.equal(live.preview,false);const d=Core.initial(live,uid,at,42);
 for(const type of ['preview-supplies','preview-time','preview-biome','preview-close'])assert.throws(()=>Core.dispatch(d,live,{type,ms:3600000,biome:Core.BIOMES[1]},{now:at,tx:'no-tool'}));
 Core.dispatch(d,live,{type:'enter-biome',biome:Core.BIOMES[0]},{now:at,tx:'enter'});const result=Core.dispatch(d,live,{type:'house',house:1,choice:'treat'},{now:at+1000,tx:'house'});assert.equal(result.candy,10);
 assert.throws(()=>Core.dispatch(d,live,{type:'enter-hub'},{now:Date.parse(Season.endAt),tx:'ended'}));
});
