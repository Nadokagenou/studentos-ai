import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Core=require('../event/core.js'),Combat=require('../event/combat.js'),Catalog=require('../rewards/catalog.js'),Death=require('../death-quests.js'),Season=require('../event/season.js'),Authority=require('../server/authority.cjs');
const json=n=>JSON.parse(fs.readFileSync(new URL('../event/data/'+n+'.json',import.meta.url),'utf8'));
const config=Core.build({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(n=>json('quests.'+n)),catalog:Catalog,proposals:json('preview-rules'),authoritative:true,season:{startAt:Season.startAt,endAt:Season.endAt,timezone:Season.timezone,claimingEnabled:true}});
const at=Date.parse('2026-10-28T01:00:00+07:00'),uid='00000000-0000-4000-8000-000000000001';
const authority=Authority.create({Core,Death,Season,config,randomSeed:()=>239573});
function harness(){let d=authority.initial(uid,at),clock=at;return {get doc(){return d;},tick(ms){clock+=ms;},visit(biome){d.event.totem={biome,until:clock+Core.DAY};return this.act({type:'enter-biome',biome});},act(a){const r=authority.apply(d,a,{uid,at:clock+=1000,tx:crypto.randomUUID()});d=r.document;return r.result;}};}
function winShip(h){h.visit(Core.BIOMES[0]);h.act({type:'start-game',game:'ghost-ship-hunt'});let g=h.doc.event.games['ghost-ship-hunt'];while(!g.finished){h.act({type:'game-move',game:g.id,session:g.session,move:g.target});g=h.doc.event.games[g.id];}return g;}
test('welcome opens the first playable chapter without random drops; repeated claims and ship wins cannot farm Candy',()=>{
 const h=harness();h.act({type:'claim-welcome'});assert.equal(h.doc.event.candy,50);assert.equal(Object.keys(h.doc.rewards).length,0);
 assert.throws(()=>h.act({type:'claim-welcome'}));
 h.act({type:'quest',quest:'dutchman-light-in-darkness'});assert.equal(h.doc.event.inventory['spectral-lantern'],1);
 const before=h.doc.event.candy;assert.equal(winShip(h).candy,35);assert.equal(winShip(h).candy,0);assert.equal(winShip(h).candy,0);
 assert.equal(h.doc.event.candy,before+35);assert.equal(h.doc.event.inventory['dutchmans-soul-soul-anchor'],3);
 assert.equal(h.doc.event.ledger.filter(x=>x.source==='ship-chest').length,1);
});
test('welcome only tops up missing resources and never replaces an existing balance or completed chapter',()=>{
 const h=harness();h.doc.event.candy=80;h.doc.event.inventory['dutchmans-soul-abyssal-rock']=9;
 h.act({type:'claim-welcome'});assert.equal(h.doc.event.candy,80);assert.equal(h.doc.event.inventory['dutchmans-soul-abyssal-rock'],9);
 const old=harness();old.doc.event.quests['dutchman-light-in-darkness']={complete:true};assert.throws(()=>old.act({type:'claim-welcome'}));
 const paid=harness();paid.doc.event.inventory['spectral-lantern']=1;paid.doc.event.ledger.push({source:'ship-chest',amount:35,at,id:'old'});assert.equal(winShip(paid).candy,0);
});
test('only the scheduled hourly door opens; selectedBiome cannot bypass it, and houses retain their cap and cooldown',()=>{
 let d=authority.initial(uid,at);const natural=Core.BIOMES[Core.Rotations.window(at).index],locked=Core.BIOMES.find(id=>id!==natural);
 assert.equal(Core.BIOMES.filter(id=>Core.portalStatus(d,config,id,at).open).length,1);
 d.event.selectedBiome=locked;assert.equal(Core.biomeAt(d,config,at).id,natural);assert.throws(()=>authority.apply(d,{type:'enter-biome',biome:locked},{uid,at,tx:crypto.randomUUID()}));
 const act=(action,t)=>{const r=authority.apply(d,action,{uid,at:t,tx:crypto.randomUUID()});d=r.document;return r.result;};
 act({type:'enter-biome',biome:natural},at+1000);assert.equal(act({type:'house',house:1,choice:'treat'},at+2000).candy,10);
 assert.throws(()=>act({type:'house',house:1,choice:'treat'},at+3000));d.event.ledger.push({at,amount:287,source:'house',id:'cap-fixture'});assert.equal(act({type:'house',house:2,choice:'treat'},at+4000).candy,3);
 const next=Core.Rotations.window(at).endAt;assert.notEqual(Core.biomeAt(d,config,next).id,natural);
});
test('training enforces three real combat actions but grants no weapons, Candy or boss rewards',()=>{
 const h=harness(),before=structuredClone(h.doc.rewards);h.act({type:'training-start'});const session=h.doc.event.trainingBattle.session;
 assert.throws(()=>h.act({type:'training-move',session,move:'strike'}));assert.throws(()=>h.act({type:'training-move',session:'forged',move:'dodge-0'}));
 for(const move of ['dodge-0','guard','skill'])h.act({type:'training-move',session,move});
 assert.equal(h.doc.event.trainingBattle.lesson,3);assert.equal(h.doc.event.trainingBattle.clear,true);assert.equal(h.doc.event.battleTraining.complete,true);
 assert.equal(h.doc.event.candy,0);assert.deepEqual(h.doc.rewards,before);assert.equal(h.doc.event.bossWins,undefined);
 assert.throws(()=>h.act({type:'training-move',session,move:'skill'}));
 h.act({type:'training-start'});h.act({type:'training-move',session:h.doc.event.trainingBattle.session,move:'retreat'});assert.equal(h.doc.event.trainingBattle.clear,false);
});
test('damage forecasts leave the save untouched and match the actual move for every weapon and attack',()=>{
 for(const weapon of Object.values(config.proposals.weapons))for(const kind of ['sweep','crush','hex'])for(const move of ['strike','skill','guard','heal','dodge-0','dodge-1','dodge-2']){
  const rule=config.proposals.bosses['midnight-sovereign'],b=Combat.start({...rule,id:'midnight-sovereign'},weapon.id||Object.entries(config.proposals.weapons).find(([,w])=>w===weapon)[0],'fixture',at,()=>.5);
  b.hp=60;b.intent={kind,danger:kind==='hex'?[0,1,2]:[1],phase:1,damage:rule.damage};const before=JSON.stringify(b),f=Combat.forecast(b,rule,weapon,move);assert.equal(JSON.stringify(b),before);
  const actual=Combat.move(b,rule,weapon,move,at+1,()=>.5);assert.equal(f.hp,b.hp);assert.equal(f.bossHp,b.bossHp);assert.equal(f.hit,actual.hit);assert.equal(f.damage,actual.damage);
 }
});
test('vines reveal a remembered sequence; hints and mistakes cannot issue rewards',()=>{
 const h=harness(),id='clear-jacks-garden-vines';h.doc.event.quests['jack-clear-garden']={phase:1};h.visit(Core.BIOMES[1]);h.act({type:'start-game',game:id});const g=h.doc.event.games[id],session=g.session;
 assert.equal(g.mode,'memory');assert.equal(new Set(g.sequence).size,6);assert.throws(()=>h.act({type:'game-move',game:id,session,move:g.sequence[0]}));
 h.tick(4500);h.act({type:'game-move',game:id,session,move:(g.sequence[0]+1)%6});assert.equal(h.doc.event.games[id].found.length,0);
 h.act({type:'game-move',game:id,session,move:'hint'});assert.throws(()=>h.act({type:'game-move',game:id,session,move:g.sequence[0]}));h.tick(4500);
 for(const move of g.sequence)h.act({type:'game-move',game:id,session,move});assert.equal(h.doc.event.games[id].clear,true);assert.equal(h.doc.event.candy,0);assert.deepEqual(h.doc.rewards,{});
});
test('grave stones hide four pairs, reject duplicate flips and finish only when all pairs match',()=>{
 const h=harness(),id='grave-digging';h.doc.event.quests['win-death-fragments']={complete:true};h.visit(Core.BIOMES[3]);h.act({type:'start-game',game:id});const g=h.doc.event.games[id],session=g.session;
 assert.equal(g.mode,'pairs');for(let v=0;v<4;v++)assert.equal(g.tiles.filter(x=>x===v).length,2);
  const flip=move=>h.act({type:'game-move',game:id,session,move});flip(0);assert.throws(()=>flip(0));const wrong=g.tiles.findIndex(v=>v!==g.tiles[0]);flip(wrong);assert.equal(h.doc.event.games[id].found.length,0);
 for(let v=0;v<4;v++)for(const [i,tile]of g.tiles.entries())if(tile===v)flip(i);assert.equal(h.doc.event.games[id].clear,true);assert.equal(h.doc.event.candy,0);
});

test('mismatched pairs stay visible for 700 ms and can then reopen the same stone',()=>{
 const h=harness(),id='grave-digging';h.doc.event.quests['win-death-fragments']={complete:true};h.visit(Core.BIOMES[3]);h.act({type:'start-game',game:id});let d=h.doc;const g=d.event.games[id],session=g.session,t=d.updatedAt+1000,wrong=g.tiles.findIndex(v=>v!==g.tiles[0]);
 const apply=(doc,move,at)=>authority.apply(doc,{type:'game-move',game:id,session,move},{uid,at,tx:crypto.randomUUID()}).document;
 d=apply(d,0,t);d=apply(d,wrong,t+150);const before=JSON.stringify(d);
 assert.throws(()=>apply(d,0,t+849),/สัญลักษณ์/);assert.equal(JSON.stringify(d),before);
 d=apply(d,0,t+850);assert.deepEqual(d.event.games[id].open,[0]);
});
test('unfinished saves created before memory and pair modes still finish with their original moves',()=>{
 for(const [id,biome]of [['clear-jacks-garden-vines',1],['grave-digging',3]]){
  const h=harness();h.doc.event.quests['jack-clear-garden']={phase:1};h.doc.event.quests['win-death-fragments']={complete:true};h.visit(Core.BIOMES[biome]);h.act({type:'start-game',game:id});delete h.doc.event.games[id].mode;
  const g=h.doc.event.games[id];for(let move=0;move<g.total;move++)h.act({type:'game-move',game:id,session:g.session,move});assert.equal(h.doc.event.games[id].clear,true);
 }
});
