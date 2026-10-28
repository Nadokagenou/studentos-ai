import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(r=>setImmediate(r));
function fixture(){
 let nodes=[];const attrs={},classes=new Set();
 const dialog={open:false,dataset:{},attrs,classList:{add:n=>classes.add(n),remove:n=>classes.delete(n)},setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];},showModal(){this.open=true;},close(){this.open=false;},querySelectorAll(s){return nodes.filter(n=>s.split(',').some(q=>{const m=q.match(/\[([^=\]]+)(?:="([^"]*)")?\]/);if(m)return m[1] in n.attrs&&(m[2]===undefined||n.attrs[m[1]]===m[2])&&(!q.includes(':not(:disabled)')||!n.disabled);return q.startsWith('.')&&n.attrs.class?.split(' ').includes(q.slice(1));}));},querySelector(s){return this.querySelectorAll(s)[0]||null;}};
 Object.defineProperty(dialog,'innerHTML',{get(){return this.markup||'';},set(value){this.markup=value;nodes=[...value.matchAll(/<(button|p)\b([^>]*)>/g)].map(m=>{const a=Object.fromEntries([...m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(x=>[x[1],x[2]??''])),listeners={};return {attrs:a,dataset:Object.fromEntries(Object.entries(a).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),disabled:'disabled'in a,textContent:'',addEventListener(k,f){listeners[k]=f;},click(){return (this.onclick||listeners.click)?.({currentTarget:this});},focus(){}};});}});
 const context={window:{HalloweenBrainGames:{names:{memory:'รูนในหมอก'}}},document:{getElementById:()=>dialog,activeElement:null},setInterval:f=>{context.tick=f;return 1;},clearInterval(){}};
 return {dialog,context};
}
const brain=()=>({session:'saved',kind:'memory',round:0,total:3,finished:false,q:{sequence:[0,1,2],board:[0,1,2,3,4,5],found:[],revealUntil:0}});
test('brain view accepts one tap, stays busy across clock ticks, and closes before a slow answer',async()=>{
 const {dialog,context}=fixture(),wait=deferred();let calls=0,closed=0,g=brain();
 vm.runInNewContext(read('halloween/event/brain-ui.js'),context);
 const options={read:()=>({event:{brainGame:g}}),now:()=>100,perform:()=>{calls++;return wait.promise;},onClose:()=>closed++};
 await context.window.HalloweenBrainUI.open(options);
 const button=dialog.querySelector('[data-brain-move]'),job=button.click();await flush();context.tick();
 assert.equal(dialog.attrs['aria-busy'],'true');assert.equal(button.disabled,true);button.click();assert.equal(calls,1);
 dialog.querySelector('[data-brain-close]').click();assert.equal(dialog.open,false);assert.equal(closed,1);const closedHTML=dialog.innerHTML;
 wait.resolve({});await job;assert.equal(dialog.innerHTML,closedHTML);assert.equal(dialog.open,false);assert.equal(g.finished,false);
});
test('brain opens a closable loading view once, including before the first server round exists',async()=>{
 const {dialog,context}=fixture(),wait=deferred();let calls=0,g=null;
 vm.runInNewContext(read('halloween/event/brain-ui.js'),context);
 const options={read:()=>({event:{brainGame:g}}),now:()=>100,perform:()=>{calls++;return wait.promise;},onClose(){}};
 const first=context.window.HalloweenBrainUI.open(options);await flush();assert.equal(dialog.open,true);assert.match(dialog.innerHTML,/กำลังเปิด/);
 await context.window.HalloweenBrainUI.open(options);assert.equal(calls,1);
 dialog.querySelector('[data-brain-close]').click();const old=dialog.innerHTML;g=brain();wait.resolve({brainGame:g});await first;assert.equal(dialog.open,false);assert.equal(dialog.innerHTML,old);
});
test('brain failure restores controls and explains retry without pretending an answer was wrong',async()=>{
 const {dialog,context}=fixture();vm.runInNewContext(read('halloween/event/brain-ui.js'),context);
 await context.window.HalloweenBrainUI.open({read:()=>({event:{brainGame:brain()}}),now:()=>100,perform:async()=>null,onClose(){}});
 await dialog.querySelector('[data-brain-move]').click();assert.equal(dialog.attrs['aria-busy'],'false');assert.equal(dialog.querySelector('[data-brain-move]').disabled,false);assert.match(dialog.innerHTML,/ตรวจการเชื่อมต่อ/);
});
