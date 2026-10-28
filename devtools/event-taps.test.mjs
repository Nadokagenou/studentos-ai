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
function battleFixture(){const f=fixture();f.context.window.HalloweenCombat={skillInfo:()=>({name:'สกิล',description:''}),forecast:()=>({hit:10,damage:0,hp:120}),lanes:['ซ้าย','กลาง','ขวา'],hint:()=>''};f.context.window.HalloweenWorld={hero:()=>''};f.context.window.HalloweenEventCore={BIOMES:[]};return f;}
const battle=()=>({id:'test',session:'fight',weapon:'test',hp:120,maxHp:120,bossHp:100,maxBossHp:100,mana:4,heals:2,turn:0,finished:false,intent:{phase:1,danger:[0]},effects:{},log:'พร้อม'});
const bossConfig={proposals:{bosses:{test:{id:'test',name:'บอสทดสอบ',shape:'vampire',color:'#fff',level:'ยาก'}},weapons:{test:{type:'quill',name:'ขนนก'}}}};
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
test('boss pending move stays single, closes immediately, and retreats only after that move settles',async()=>{
 const {dialog,context}=battleFixture(),wait=deferred();let b=battle(),calls=[],closes=0;
 vm.runInNewContext(read('halloween/event/battle-ui.js'),context);
 const options={read:()=>({event:{battle:b}}),config:bossConfig,context:()=>({}),onRewards(){},onClose:()=>closes++,perform:async action=>{calls.push(action);if(action.move==='retreat'){b.finished=true;return {rewards:[]};}return wait.promise;}};
 await context.window.HalloweenBattleUI.open('test',options);const button=dialog.querySelector('[data-battle-move]'),job=button.click();await flush();
 assert.equal(dialog.attrs['aria-busy'],'true');assert.equal(button.disabled,true);button.click();assert.equal(calls.length,1);
 dialog.querySelector('[data-battle-close]').click();assert.equal(dialog.open,false);assert.equal(closes,1);assert.equal(calls.length,1);const html=dialog.innerHTML;
 wait.resolve({rewards:[]});await job;await flush();assert.equal(dialog.innerHTML,html);assert.equal(dialog.open,false);assert.equal(calls.length,2);assert.equal(calls[1].move,'retreat');assert.equal(b.finished,true);
});
test('boss start immediately opens a closable loading view without duplicating a round',async()=>{
 const {dialog,context}=battleFixture(),wait=deferred();let b=null,calls=0;
 vm.runInNewContext(read('halloween/event/battle-ui.js'),context);
 const options={read:()=>({event:{battle:b}}),config:bossConfig,context:()=>({}),onRewards(){},onClose(){},perform:()=>{calls++;return wait.promise;}};
 const first=context.window.HalloweenBattleUI.open('test',options);await flush();assert.equal(dialog.open,true);assert.match(dialog.innerHTML,/กำลังเปิด/);
 await context.window.HalloweenBattleUI.open('test',options);assert.equal(calls,1);b={...battle(),finished:true};dialog.querySelector('[data-battle-close]').click();wait.resolve({battle:b,rewards:[]});await first;await flush();assert.equal(dialog.open,false);
});
test('boss failed move restores the actions and presents a connection retry',async()=>{
 const {dialog,context}=battleFixture();vm.runInNewContext(read('halloween/event/battle-ui.js'),context);
 await context.window.HalloweenBattleUI.open('test',{read:()=>({event:{battle:battle()}}),config:bossConfig,context:()=>({}),onRewards(){},onClose(){},perform:async()=>null});
 await dialog.querySelector('[data-battle-move]').click();assert.equal(dialog.attrs['aria-busy'],'false');assert.equal(dialog.querySelector('[data-battle-move]').disabled,false);assert.match(dialog.innerHTML,/ตรวจการเชื่อมต่อ/);
});
