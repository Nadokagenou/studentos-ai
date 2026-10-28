import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),C=require('../rewards/catalog.js'),Death=require('../death-quests.js'),Season=require('../event/season.js'),A=require('../server/authority.cjs'),H=require('../server/handler.cjs');
const json=n=>JSON.parse(fs.readFileSync(new URL('../event/data/'+n+'.json',import.meta.url),'utf8'));
const config=Core.build({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>json('quests.'+n)),catalog:C,proposals:json('preview-rules'),authoritative:true,season:{startAt:Season.startAt,endAt:Season.endAt,timezone:Season.timezone,claimingEnabled:true}});
const at=Core.Rotations.next(Date.parse('2026-10-28T01:00:00+07:00'),0),uid='00000000-0000-4000-8000-000000000001';
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
 for(let t=70000;t<=1500000&&d.event.focusProofs[q.taskId].activeMs<1200000;t+=10000){pulse('session-a-long-enough',at+t);const a=d.event.focusProofs[q.taskId].attention;if(a?.challenge)d=apply(d,{type:'focus-check',taskId:q.taskId,checkpoint:a.challenge.id,answer:a.expected},at+t+1).document;}
 assert.equal(d.event.focusProofs[q.taskId].activeMs,1200000);d=apply(d,{type:'focus-finish',taskId:q.taskId},at+1600000).document;
 const result=apply(d,{type:'death-quest-claim',quest:q.id},at+1610000);assert.equal(result.document.event.candy,30);assert.throws(()=>apply(result.document,{type:'death-quest-claim',quest:q.id},at+1620000));
});
function harness(){let doc=null,time=at;const receipts=new Map();const db={async read(){return doc&&{document:structuredClone(doc)};},async receipt(u,s,tx){return receipts.get(tx);},async commit(x){if((doc?.revision||0)!==x.expected)return {committed:false};if(receipts.has(x.tx))return {committed:true,replay:true,result:receipts.get(x.tx).result};doc=structuredClone(x.document);receipts.set(x.tx,{action:x.action,result:x.result});return {committed:true,replay:false,result:x.result};}};const handler=H.create({authority,db,authenticate:async token=>token==='Bearer valid'?uid:null,clock:()=>time+=1000,season:Season});return {handler,db,receipts,read:()=>doc};}
const request=(action,requestId=crypto.randomUUID(),token='Bearer valid')=>new Request('https://example.test/halloween-event',{method:'POST',headers:{authorization:token,'content-type':'application/json'},body:JSON.stringify({action,requestId})});
test('a new player can submit Tang through the real HTTP validator with a null optional branch',async()=>{
 const h=harness();for(const action of [{type:'enter-hub'},{type:'claim-welcome'}])assert.equal((await h.handler(request(action))).status,200);
 const tx=crypto.randomUUID(),response=await h.handler(request({type:'quest',quest:'dutchman-light-in-darkness',branch:null},tx)),body=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.document.event.quests['dutchman-light-in-darkness'].complete,true);assert.equal(body.document.event.candy,0);assert.equal(body.document.event.inventory['spectral-lantern'],1);
 const replay=await h.handler(request({type:'quest',quest:'dutchman-light-in-darkness',branch:null},tx));assert.equal(replay.status,200);assert.equal((await replay.json()).replay,true);assert.equal(h.receipts.size,3);
});
test('HTTP boundary authenticates first, never accepts client documents and safely replays a lost response',async()=>{
 const h=harness();assert.equal((await h.handler(request({type:'read'},undefined,''))).status,401);
 const tx=crypto.randomUUID(),r=await h.handler(request({type:'enter-hub'},tx));assert.equal(r.status,200);const a=await r.json();assert.equal(a.document.owner,uid);
 const replay=await (await h.handler(request({type:'enter-hub'},tx))).json();assert.equal(replay.replay,true);assert.equal(h.read().revision,1);assert.equal(h.receipts.size,1);
 assert.equal((await h.handler(request({type:'house',house:1,choice:'treat'},tx))).status,409);
 assert.equal((await h.handler(request({type:'preview-supplies'}))).status,400);
 assert.equal((await h.handler(new Request('https://example.test',{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);
});
test('two simultaneous account requests preserve both committed changes across a CAS retry',async()=>{const h=harness();const responses=await Promise.all([h.handler(request({type:'enter-hub'})),h.handler(request({type:'enter-room',room:'garden'}))]);assert.ok(responses.every(x=>x.status===200));assert.equal(h.read().revision,2);assert.equal(h.receipts.size,2);});
test('a successful event action returns its committed document without reading the same save again',async()=>{
 const h=harness();let reads=0;const original=h.db.read;h.db.read=async(...args)=>{reads++;return original(...args);};
 const response=await h.handler(request({type:'enter-hub'})),data=await response.json();assert.equal(response.status,200);assert.deepEqual(data.document,authority.publicDocument(h.read()));assert.equal(reads,1);
});
test('a replay re-reads the current save when its initial snapshot raced an earlier commit',async()=>{
 const h=harness(),tx=crypto.randomUUID(),action={type:'enter-hub'};await h.handler(request(action,tx));const old=structuredClone(h.read());await h.handler(request({type:'enter-room',room:'garden'}));
 let reads=0;h.db.read=async()=>({document:structuredClone(reads++===0?old:h.read())});const data=await(await h.handler(request(action,tx))).json();assert.equal(data.replay,true);assert.equal(data.document.revision,2);assert.equal(reads,2);
});
test('all 18 prepared quest phases pass the production HTTP validator and authoritative engine',async()=>{
 let checked=0;
 for(const q of config.quests)for(let phase=0;phase<q.phases.length;phase++){
  let doc=authority.initial(uid,at);doc.event.candy=10000;doc.event.totem={biome:q.biome,until:at+Core.HOUR};doc.event.location={kind:'biome',biome:q.biome};
  for(const item of Object.keys(config.items)){doc.event.inventory[item]=30;doc.event.grown[item]=30;}
  for(const other of config.quests){doc.event.quests[other.id]={phase:other.phases.length,complete:true,completedAt:at-21*60000,completedCycle:0};for(const step of other.phases){const r=step.requirements;if(r.objective)doc.event.proofs[r.objective.id]={complete:true};if(r.minigame)doc.event.proofs[r.minigame.id||'ghost-ship-hunt']={complete:true,clear:true};}}
  doc.event.quests[q.id]={phase,complete:false};if(q.rewards.some(r=>r.kind==='upgrade-existing'))doc.rewards['dullahan-scythe']={id:'dullahan-scythe',permanent:true,receipt:'fixture-earned',restriction:{status:'Restricted'}};
  const db={read:async()=>({document:structuredClone(doc)}),receipt:async()=>null,commit:async x=>{doc=x.document;return {committed:true,replay:false,result:x.result};}};
  const handler=H.create({authority,db,authenticate:async()=>uid,clock:()=>at,season:Season}),branch=q.phases[phase].requirements.anyOf?.[0]?.id??null,response=await handler(request({type:'quest',quest:q.id,branch})),data=await response.json();
  assert.equal(response.status,200,q.id+' phase '+phase+' '+JSON.stringify(data));assert.equal(data.document.event.quests[q.id].phase,phase+1);checked++;
 }
 assert.equal(checked,18);
});

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
