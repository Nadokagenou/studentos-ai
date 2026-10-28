import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../halloween/event/core.js'),Catalog=require('../halloween/rewards/catalog.js'),Death=require('../halloween/death-quests.js'),Season=require('../halloween/event/season.js'),Authority=require('../alt/halloween/server/authority.cjs');
const json=n=>JSON.parse(fs.readFileSync(new URL('../halloween/event/data/'+n+'.json',import.meta.url),'utf8'));
const config=Core.build({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>json('quests.'+n)),catalog:Catalog,proposals:json('preview-rules'),authoritative:true,season:{startAt:Season.startAt,endAt:Season.endAt,timezone:Season.timezone,claimingEnabled:true}}),at=Date.parse('2026-10-28T01:00:00+07:00'),uid='00000000-0000-4000-8000-000000000001';
const authority=Authority.create({Core,Death,Season,config,randomSeed:()=>12345678});
const Playback=require('../halloween/event/game-playback.js');
function start(id){const d=authority.initial(uid,at),biome=Core.gameDefinition(id,config).biome;d.event.totem={biome,until:at+Core.HOUR};d.event.inventory['spectral-lantern']=1;d.event.quests['jack-clear-garden']={phase:1};d.event.quests['win-death-fragments']={complete:true};d.event.proofs['grave-digging']={complete:true};return authority.apply(d,{type:'start-game',game:id},{uid,at,tx:'start-session'}).document;}
const submit=(d,id,inputs,receivedAt=at+1000,processedAt=receivedAt)=>authority.apply(d,{type:'game-inputs',game:id,session:'start-session',inputs},{uid,at:processedAt,receivedAt,tx:'input-batch'});
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
for(const id of ['ghost-ship-hunt','clear-jacks-garden-vines','dech-house-spot-difference','grave-digging','catch-all-ghosts'])test(id+' keeps the entire verified save immutable during fast local playback',async()=>{
 let doc=freeze(authority.publicDocument(start(id))),time=at+5000,release;const before=JSON.stringify(doc),gate=new Promise(r=>release=r),c=Playback.create({id,Core,config,read:()=>doc,now:()=>time,perform:async action=>{await gate;const result=submit(doc,id,action.inputs,time+500);doc=result.document;return result.result;}});
 for(let i=0;i<40&&!c.state().game.finished;i++){
  const g=c.state().game;time=Math.max(time+10,g.revealUntil||0);let move;
  if(id==='ghost-ship-hunt')move=g.target;else if(g.mode==='memory')move=g.sequence[g.found.length];else if(g.mode==='pairs'){move=g.open.length?g.tiles.findIndex((n,i)=>i!==g.open[0]&&!g.found.includes(i)&&n===g.tiles[g.open[0]]):g.tiles.findIndex((_,i)=>!g.found.includes(i));}else move=Array.from({length:g.total},(_,i)=>i).find(i=>!g.found.includes(i));
  assert.equal(c.tap(move),true);
 }
 assert.equal(c.state().game.clear,true);assert.equal(JSON.stringify(doc),before);release();await c.flush();assert.equal(doc.event.games[id].clear,true);assert.equal(c.state().pending,false);
});
test('authenticated timed inputs use server arrival time rather than later database processing time',async()=>{
 const Handler=require('../alt/halloween/server/handler.cjs');let doc=start('catch-all-ghosts'),time=at+25000;
 const handler=Handler.create({authority,season:Season,clock:()=>time,authenticate:async()=>{time+=10000;return uid;},db:{read:async()=>({document:doc}),receipt:async()=>null,commit:async x=>{doc=x.document;return {committed:true,result:x.result};}}});
 const r=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({requestId:'00000000-0000-4000-8000-000000000002',action:{type:'game-inputs',game:'catch-all-ghosts',session:'start-session',inputs:Array.from({length:6},(_,i)=>[i,24900+i*10])}})}));assert.equal(r.status,200,await r.text());assert.equal(doc.event.games['catch-all-ghosts'].clear,true);
});
test('ship plays a server-issued cue stream and validates six rapid inputs in one save',()=>{
 const d=start('ghost-ship-hunt'),g=d.event.games['ghost-ship-hunt'];assert.equal(g.playback,2);assert.equal(g.cues.length,9);
 const result=submit(d,g.id,g.cues.slice(0,6).map((move,i)=>[move,100+i*100]),at+800,at+6000);
 assert.equal(result.document.event.games[g.id].clear,true);assert.equal(result.document.event.candy,35);assert.equal(result.document.event.inventory['dutchmans-soul-soul-anchor'],1);assert.equal(d.event.candy,0);assert.throws(()=>submit(result.document,g.id,[[0,900]],at+1000));
});
test('ghosts and differences accept rapid local tap sequences while the server checks each target',()=>{
 for(const id of ['catch-all-ghosts','dech-house-spot-difference']){const d=start(id),g=d.event.games[id],inputs=Array.from({length:g.total},(_,i)=>[i,100+i*10]);const result=submit(d,id,inputs);assert.equal(result.document.event.games[id].clear,true);assert.equal(result.document.event.proofs[id].clear,true);}
});
test('late, future and reordered traces cannot fabricate a timed win or partially save',()=>{
 const id='catch-all-ghosts',d=start(id),snapshot=JSON.stringify(d),inputs=Array.from({length:6},(_,i)=>[i,100+i*10]);
 assert.throws(()=>submit(d,id,inputs,at+30000));assert.throws(()=>submit(d,id,[[0,2000]],at+1000));assert.throws(()=>submit(d,id,[[0,200],[1,100]],at+1000));assert.equal(JSON.stringify(d),snapshot);
 for(const bad of [[],[[99,100]],[[0,-1]],[[0,1.5]],Array.from({length:97},()=>[0,1]),{clear:true}])assert.throws(()=>submit(d,id,bad));
});
test('memory reveal and pair mismatch delays remain checked from bounded input times',()=>{
 const memory=start('clear-jacks-garden-vines'),m=memory.event.games['clear-jacks-garden-vines'];assert.throws(()=>submit(memory,m.id,[[m.sequence[0],100]],at+500));
 assert.equal(submit(memory,m.id,m.sequence.map((n,i)=>[n,4600+i*100]),at+6000).document.event.games[m.id].clear,true);
 const pairs=start('grave-digging'),p=pairs.event.games['grave-digging'],a=0,b=p.tiles.findIndex(n=>n!==p.tiles[a]),c=p.tiles.findIndex((_,i)=>i!==a&&i!==b);
 assert.throws(()=>submit(pairs,p.id,[[a,100],[b,200],[c,300]],at+1000));assert.doesNotThrow(()=>submit(pairs,p.id,[[a,100],[b,200],[c,900]],at+1000));
});
test('an old unfinished ship round upgrades without resetting its score or deadline',()=>{
 const d=start('ghost-ship-hunt'),g=d.event.games['ghost-ship-hunt'];delete g.playback;delete g.cues;delete g.cueIndex;g.steps=2;const deadline=g.deadline;
 const next=authority.apply(d,{type:'game-ready',game:g.id,session:g.session},{uid,at:at+1000,tx:'ready'}).document.event.games[g.id];assert.equal(next.steps,2);assert.equal(next.deadline,deadline);assert.equal(next.cues[0],g.target);assert.equal(next.playback,2);
});
test('six ghost taps complete locally before any slow save and server proof stays unearned until acknowledgement',async()=>{
 let doc=start('catch-all-ghosts'),release,calls=0;const wait=new Promise(r=>release=r),preview={...config,preview:true},controller=Playback.create({id:'catch-all-ghosts',Core,config:preview,read:()=>doc,now:()=>at+500,perform:async action=>{calls++;await wait;const result=submit(doc,action.game,action.inputs,at+1000);doc=result.document;return result.result;}});
 for(let i=0;i<6;i++)assert.equal(controller.tap(i),true);
 assert.equal(controller.state().game.found.length,6);assert.equal(controller.state().game.clear,true);assert.equal(controller.state().pending,true);assert.equal(doc.event.proofs['catch-all-ghosts'],undefined);assert.equal(calls,1);
 release();await controller.flush();assert.equal(controller.state().pending,false);assert.equal(doc.event.proofs['catch-all-ghosts'].clear,true);
});
test('a closed game drains its captured inputs without drawing a late response, and retries the exact failed packet',async()=>{
 let doc=start('catch-all-ghosts'),fail=true,paints=0;const calls=[],controller=Playback.create({id:'catch-all-ghosts',Core,config:{...config,preview:true},read:()=>doc,now:()=>at+500,onChange:()=>paints++,perform:async action=>{calls.push(JSON.stringify(action));if(fail){fail=false;return null;}const result=submit(doc,action.game,action.inputs);doc=result.document;return result.result;}});
 controller.tap(0);await controller.flush();assert.match(controller.state().error,/ยืนยัน/);const count=paints;await controller.close();assert.equal(paints,count);assert.equal(calls.length,2);assert.equal(calls[0],calls[1]);assert.deepEqual(doc.event.games['catch-all-ghosts'].found,[0]);
});
