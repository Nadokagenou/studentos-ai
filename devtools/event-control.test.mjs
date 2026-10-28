import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../halloween/event/experience.js',import.meta.url),'utf8');
function grab(name){const a=source.indexOf('function '+name+'(');assert.ok(a>=0,name);const h=source.slice(a).match(/\)\s*\{/);let depth=0,start=a+h.index+h[0].lastIndexOf('{');for(let i=start;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&!--depth)return source.slice(a,i+1);}throw Error(name);}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function navigation(){
 const wait=deferred(),calls=[],notices=[],panels=[];let paints=0,stories=0;
 const box={navigating:false,viewEpoch:0,main:{dataset:{},setAttribute(){},removeAttribute(){},focus(){}},PANEL_NAMES:{village:'หมู่บ้าน',shop:'ร้าน'},ROOM_ROUTES:{shop:'shop',garden:'garden'},detail:{open:false,close(){this.open=false;box.viewEpoch++;}},playable:true,store:{},read:()=>({event:{closed:false}}),currentBiome:()=> 'ship',Core:{portalStatus:()=>({open:true})},config:{},clockNow:()=>0,biomeName:()=> 'เรือ',perform:action=>{calls.push(action);return wait.promise;},history:{replaceState(){}},activeRoom:null,activePanel:null,detailAfterClose:null,route:'hub',toast:t=>notices.push(t),showPanel:id=>panels.push(id),showStory:()=>stories++,render:()=>paints++,window:{scrollTo(){}}};
 vm.runInNewContext('async '+grab('navigate'),box);return {box,wait,calls,notices,panels,stats:()=>({paints,stories})};
}
test('biome navigation responds immediately and queues one authoritative entry for repeated taps',async()=>{
 const f=navigation(),first=f.box.navigate('biome',{biome:'ship'});await f.box.navigate('biome',{biome:'ship'});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].type,'enter-biome');assert.match(f.box.main.dataset.opening,/กำลัง/);assert.equal(f.box.route,'hub');
 f.wait.resolve({firstStory:true});assert.equal(await first,true);assert.equal(f.box.route,'biome');assert.equal(f.stats().stories,1);assert.equal(f.box.navigating,false);assert.equal(f.box.main.dataset.opening,undefined);
});
test('dismissed navigation cannot replace a newer view after a late server response',async()=>{
 const f=navigation(),first=f.box.navigate('shop');f.box.viewEpoch++;f.wait.resolve({});assert.equal(await first,false);assert.equal(f.panels.length,0);assert.equal(f.box.navigating,false);
});
test('failed navigation restores waiting state and leaves the original scene intact',async()=>{
 const f=navigation(),first=f.box.navigate('biome',{biome:'ship'});f.wait.resolve(null);assert.equal(await first,false);assert.equal(f.box.route,'hub');assert.equal(f.stats().paints,0);assert.equal(f.box.main.dataset.opening,undefined);
});
test('opening a village waits for one biome entry before showing its houses',async()=>{
 const f=navigation(),first=f.box.navigate('village',{biome:'ship'});assert.equal(f.calls.length,1);assert.equal(f.panels.length,0);f.wait.resolve({});await first;assert.equal(f.box.route,'biome');assert.deepEqual(f.panels,['village']);assert.equal(f.calls.length,1);
});
