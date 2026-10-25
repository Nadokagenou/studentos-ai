import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),G=require('../rewards/effect-games.js');
const S=require('../rewards/effect-stage.js');

test('a throw assists only an upward release that can actually reach the destination',()=>{
 const r={left:100,right:200,top:100,bottom:180};
 assert.equal(S.throwHits({x:150,y:175},{x:0,y:0},r),true);
 assert.equal(S.throwHits({x:150,y:260},{x:0,y:-1},r),true);
 assert.equal(S.throwHits({x:150,y:500},{x:0,y:-20},r),false);
 assert.equal(S.throwHits({x:150,y:260},{x:0,y:1},r),false);
 assert.equal(S.throwHits({x:330,y:260},{x:0,y:-1},r),false);
 assert.equal(S.throwHits({x:150,y:260},{x:NaN,y:-1},r),false);
});

test('all eight scenes differ, and Legendary finales remain short and skippable',()=>{
 const scenes=Object.keys(G.modes).map(id=>S.art(id,'ship.svg','test-'+id));
 assert.equal(new Set(scenes).size,8);for(const svg of scenes){assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<script|onload=/);}
 assert.ok(S.finaleTime('Legendary',false)>S.finaleTime('Epic',false));
 assert.ok(S.finaleTime('Legendary',false)<=3000);assert.equal(S.finaleTime('Legendary',true),650);
 assert.equal(S.art('unknown','ship.svg','x'),'');
});

test('sound starts only on interaction, uses the existing preference, and releases its own context',()=>{
 let created=0,closed=0,started=0,stopped=0;const writes=[];
 class Context {constructor(){created++;this.currentTime=0;this.destination={};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){started++;},stop(){stopped++;}};}close(){closed++;return Promise.resolve();}}
 const s=S.sound({AudioContext:Context,storage:{getItem(){return '1';},setItem(...args){writes.push(args);}}});
 assert.equal(created,0);s.play('arrival',false);assert.equal(created,1);assert.ok(started>0);
 s.toggle();assert.equal(s.enabled,false);assert.equal(closed,1);assert.deepEqual(writes.at(-1),['studentos.alt.doneFxSound','0']);
 const before=started;s.play('arrival',true);assert.equal(started,before);s.toggle();s.play('gate',true);s.dispose();assert.equal(closed,2);assert.ok(stopped>=started);s.play('gate',true);assert.equal(created,2);
});

test('unavailable or blocked audio never prevents the cosmetic interaction',()=>{
 const s=S.sound({AudioContext:class{constructor(){throw Error('blocked');}},storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}});
 assert.doesNotThrow(()=>{s.play('verdict',true);s.toggle();s.dispose();});
});

test('presentation bounds particles and cancels every scheduled cleanup on still mode or exit',()=>{
 const pending=new Map(),elements=[];let serial=0;
 class Element {constructor(){this.style={};this.classList={add(){}};this.children=[];this.removed=false;elements.push(this);}setAttribute(){}addEventListener(){}querySelectorAll(){return [];}append(el){this.children.push(el);}prepend(el){this.children.unshift(el);}remove(){this.removed=true;}getBoundingClientRect(){return {left:0,top:0,width:320,height:400};}}
 const field=new Element(),layer=new Element();layer.querySelector=()=>field;
 const ctx={module:{exports:{}},document:{createElement(){return new Element();}},window:{},performance:{now(){return 100;}},setTimeout(fn){pending.set(++serial,fn);return serial;},clearTimeout(id){pending.delete(id);}};
 vm.runInNewContext(fs.readFileSync(new URL('../rewards/effect-stage.js',import.meta.url),'utf8'),ctx);
 const stage=ctx.module.exports.mount(layer,{effect:'gate'},{asset:()=> 'asset.svg'});
 for(let i=0;i<100;i++)stage.hit(i,null,true);
 assert.equal(pending.size,64);const particles=elements.filter(e=>e.className?.includes('particle'));assert.equal(particles.length,64);
 stage.setMotion(true);assert.equal(pending.size,0);assert.ok(particles.every(e=>e.removed));stage.hit(0,null,true);assert.equal(pending.size,0);
 stage.setMotion(false);stage.hit(0,null,true);assert.equal(pending.size,30);stage.dispose();stage.dispose();assert.equal(pending.size,0);stage.hit(0,null,true);assert.equal(pending.size,0);
});
test('every Halloween effect has an interactive completion path',()=>{
 assert.equal(Object.keys(G.modes).length,8);assert.equal(G.controller('not-an-effect'),null);
 for(const id of Object.keys(G.modes)){const game=G.controller(id);assert.ok(!game.complete);for(let i=0;i<game.config.goal;i++)assert.ok(game.accept(i),id);assert.ok(game.complete,id);assert.equal(game.accept(0),false,id);}
});
test('the ship lights must be lit in order and duplicate flowers do not finish a game',()=>{
 const ship=G.controller('wake');assert.equal(ship.accept(2),false);assert.equal(ship.count,0);assert.ok(ship.accept(0));assert.equal(ship.accept(0),false);
 const garden=G.controller('bloom');assert.equal(garden.accept(5),false);assert.ok(garden.accept(2));assert.equal(garden.accept(2),false);assert.equal(garden.count,1);
});
test('a scythe swipe must cross the job and travel far enough; a tap or miss does not cut',()=>{
 const r={left:100,right:200,top:100,bottom:200};assert.ok(G.segmentHitsRect({x:50,y:150},{x:250,y:150},r));assert.ok(G.segmentHitsRect({x:150,y:50},{x:150,y:250},r));assert.ok(G.segmentHitsRect({x:50,y:50},{x:250,y:250},r));
 assert.equal(G.segmentHitsRect({x:50,y:40},{x:250,y:40},r),false);assert.equal(G.segmentHitsRect({x:150,y:150},{x:153,y:155},r),false);assert.equal(G.segmentHitsRect({x:150,y:150},{x:150,y:150},r),false);
 const jack=G.controller('verdict');assert.equal(jack.config.mode,'slash');assert.equal(jack.config.goal,3);
});
