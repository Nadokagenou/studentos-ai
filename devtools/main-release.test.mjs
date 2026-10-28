import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Access=require('../halloween/rewards/entitlements.js');
const Account=require('../halloween/rewards/account-store.js');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
const receipt=owner=>({owner,season:'halloween-2026',rewards:{'theme-ghostship':{id:'theme-ghostship',permanent:true,receipt:'verified-test'}}});

test('same-account refresh retains verified themes until an authoritative answer arrives',async()=>{
 let release,slow=false,fail=false,owner='a';
 const reader=Access.create({owner:()=>owner,createAccount:()=>({refresh:()=>slow?new Promise((r,j)=>release=()=>fail?j(Error('offline')):r()):Promise.resolve(),read:()=>receipt(owner),dispose(){}})});
 await reader.refresh();assert.equal(reader.owns('theme-ghostship'),true);
 slow=true;const job=reader.refresh(true);assert.equal(reader.owns('theme-ghostship'),true);await Promise.resolve();release();await job;
 fail=true;const failure=reader.refresh(true);await Promise.resolve();release();await failure;assert.equal(reader.owns('theme-ghostship'),false);
 fail=false;slow=false;await reader.refresh(true);slow=true;const old=reader.refresh(true);await Promise.resolve();owner='b';assert.equal(reader.owns('theme-ghostship'),false);release();await old;assert.equal(reader.owns('theme-ghostship'),false);
});

test('a stalled request retries its receipt within a bounded wait and ignores its late reply',async()=>{
 let calls=0,late;const bodies=[],doc={owner:'a',event:{candy:10},rewards:{}};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'a'},access_token:'test'}}})},functions:{invoke:async(_,o)=>{bodies.push(o.body);if(++calls===1)return new Promise(r=>late=r);return {data:{document:doc,result:{ok:true},serverNow:1000}};}}};
 const api=Account.create({client,clock:()=>1000,timeoutMs:15});
 const result=await Promise.race([api.dispatch({type:'house'},'same-receipt'),new Promise((_,r)=>setTimeout(()=>r(Error('request did not recover')),100))]);
 assert.equal(result.document.event.candy,10);assert.equal(calls,2);assert.equal(bodies[0].requestId,bodies[1].requestId);
 late({data:{document:{...doc,event:{candy:999}},serverNow:1000}});await new Promise(r=>setImmediate(r));assert.equal(api.read().event.candy,10);
});

test('minigame marks pending taps, closes immediately, and never repaints after a late reply',async()=>{
 const elements=new Map(),dialog={innerHTML:'',dataset:{},open:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},showModal(){this.open=true;},close(){this.open=false;},querySelector(s){if(s===':focus')return null;if(!elements.has(s))elements.set(s,{dataset:{},disabled:false,textContent:'',addEventListener(name,fn){this[name]=fn;},focus(){}});return elements.get(s);},querySelectorAll(s){return s.includes('data-game-move')?[this.querySelector('[data-game-move]')]:s.includes('data-game-close')?[this.querySelector('[data-game-close]')]:[];}};
 let release,calls=0;const game={session:'saved-round',target:0,steps:0,mistakes:0,finished:false,deadline:15000};
 const box={window:{},document:{getElementById:()=>dialog},setInterval:()=>1,clearInterval(){}};
 vm.runInNewContext(process.env.STUDENTOS_RELEASE_GAMES_BASELINE?fs.readFileSync(process.env.STUDENTOS_RELEASE_GAMES_BASELINE,'utf8'):read('halloween/event/games.js'),box);
 const api=box.window.HalloweenEventGames,opts={perform:()=>{calls++;return new Promise(r=>release=r);},read:()=>({event:{games:{'ghost-ship-hunt':game}}}),now:()=>0,reduced:()=>true,onClose(){}};
 await api.open('ghost-ship-hunt',opts);const move=dialog.querySelector('[data-game-move]').click();await Promise.resolve();
 assert.equal(dialog.attrs['aria-busy'],'true');assert.equal(dialog.querySelector('[data-game-move]').disabled,true);
 api.close();assert.equal(dialog.open,false);const closedMarkup=dialog.innerHTML;release(null);await move;assert.equal(dialog.innerHTML,closedMarkup);assert.equal(calls,1);
 await api.open('ghost-ship-hunt',{...opts,perform:async()=>null});await dialog.querySelector('[data-game-move]').click();assert.match(dialog.innerHTML,/ตรวจการเชื่อมต่อ/);assert.doesNotMatch(dialog.innerHTML,/ยังไม่ใช่จุดนั้น/);
 api.close();
});
