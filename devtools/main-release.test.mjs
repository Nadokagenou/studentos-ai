import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Access=require('../halloween/rewards/entitlements.js');
const Account=require('../halloween/rewards/account-store.js');
const Core=require('../halloween/event/core.js'),Catalog=require('../halloween/rewards/catalog.js');
const json=n=>JSON.parse(read('halloween/event/data/'+n+'.json'));
const config=()=>Core.build({materials:json('materials'),chains:['dutchman','jack','vampire','graveyard'].map(x=>json('quests.'+x)),catalog:Catalog,proposals:json('preview-rules'),preview:true});
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
const receipt=owner=>({owner,season:'halloween-2026',event:{candy:37},rewards:{'theme-ghostship':{id:'theme-ghostship',permanent:true,receipt:'verified-test'}}});

test('same-account refresh retains verified themes until an authoritative answer arrives',async()=>{
 let release,slow=false,fail=false,owner='a';
 const reader=Access.create({owner:()=>owner,createAccount:()=>({refresh:()=>slow?new Promise((r,j)=>release=()=>fail?j(Error('offline')):r()):Promise.resolve(),read:()=>receipt(owner),dispose(){}})});
 await reader.refresh();assert.equal(reader.owns('theme-ghostship'),true);assert.equal(reader.view().candy,37);
 slow=true;const job=reader.refresh(true);assert.equal(reader.owns('theme-ghostship'),true);await Promise.resolve();release();await job;
 fail=true;const failure=reader.refresh(true);await Promise.resolve();release();await failure;assert.equal(reader.owns('theme-ghostship'),false);
 fail=false;slow=false;await reader.refresh(true);slow=true;const old=reader.refresh(true);await Promise.resolve();owner='b';assert.equal(reader.owns('theme-ghostship'),false);assert.equal(reader.view().candy,null);release();await old;assert.equal(reader.owns('theme-ghostship'),false);
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

test('Tang reuses an earned lantern in both the objective and submission requirements without charging twice',()=>{
 const c=config(),at=Date.now(),d=Core.initial(c,'test',at,42),q=c.quests.find(x=>x.preserveExistingCraft);d.event.previewBiome=q.biome;d.event.inventory['spectral-lantern']=1;
 const objective=Core.questNeeds(d,c,q.biome,at);assert.equal(objective.ready,true);
 const req=Core.questRequirements(d,c,q,q.phases[0].requirements);assert.equal(Core.checkRequirements(d,req),true);assert.equal(req.items[0].consume,false);
 Core.dispatch(d,c,{type:'quest',quest:q.id},{now:at,tx:'existing-lantern'});assert.equal(d.event.candy,0);assert.equal(d.event.inventory['spectral-lantern'],1);
 assert.match(read('halloween/event/experience.js'),/requirements = Core\.questRequirements\(doc,config,q,/);
});
test('Dech final letter awards Candy while its theme remains locked behind the boss',()=>{
 const c=config(),at=Date.now(),d=Core.initial(c,'test',at,42),q=c.quests.find(x=>x.id==='dech-wrong-letter');d.event.previewBiome=q.biome;
 d.event.quests[q.prerequisite]={complete:true,phase:1,completedAt:at-21*60000};for(const id of Object.keys(c.items))d.event.inventory[id]=30;
 const result=Core.dispatch(d,c,{type:'quest',quest:q.id},{now:at,tx:'dech-final-letter'});
 assert.equal(d.event.candy,100);assert.equal(d.rewards['theme-vampire'],undefined);assert.equal(result.boss,'blood-countess');assert.match(result.dialogue,/ชนะ.*บอส/);
 const box={};vm.runInNewContext(read('halloween/event/experience.js').match(/function questDialogue[\s\S]*?\n  }/)[0],box);assert.equal(box.questDialogue(q,{...result,dialogue:'ข้อความจากบริการรุ่นเก่า'}),q.phases.at(-1).completeDialogue);
});

test('opening the gate saves entry once and normal hub navigation still saves once',async()=>{
 const s=read('halloween/event/experience.js'),a=s.indexOf('  async function navigate('),b=s.indexOf('  function currentBiome',a),g=s.indexOf("    if(button.hasAttribute('data-enter-hub'))"),h=s.indexOf('    if(button.dataset.enterBiome)',g);
 let calls=0;const box={viewEpoch:0,currentBiome:()=>'ship',biomeName:()=>'เรือ',navigating:false,queueSceneRefresh(){},main:{dataset:{},setAttribute(){},removeAttribute(){},querySelector:()=>({classList:{add(){}}}),focus(){}},button:{hasAttribute:()=>true,disabled:false,classList:{add(){}}},PANEL_NAMES:{},ROOM_ROUTES:{},detail:{open:false},playable:true,store:{},read:()=>({event:{closed:false}}),perform:async()=>{calls++;return {};},history:{replaceState(){}},route:'gate',render(){},window:{scrollTo(){}},setTimeout:fn=>fn(),reduced:()=>true};
 vm.runInNewContext(s.slice(a,b)+'\nasync function enter(){'+s.slice(g,h)+'}\nthis.enterGate=enter;',box);await box.enterGate();await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 await box.navigate('hub');assert.equal(calls,2);
});

test('public reward pages have no retired lab entry and their redirects resolve locally',()=>{
 const html=read('halloween/event/rewards.html'),legacy=read('halloween/event/theme-preview.html');
 assert.doesNotMatch(html,/device-preview|preview=1|halloween-showroom|เปิด ALT|รอระบบอีเวนต์|แชร์ให้ทีม/);
 const redirect=legacy.match(/url=([^"\s>]+)/)?.[1];assert.ok(redirect);assert.ok(fs.existsSync(new URL('../halloween/event/'+redirect,import.meta.url)));
 const script=read('halloween/event/collection.js');assert.doesNotMatch(script,/localStorage|postMessage|halloween-showroom|รอระบบอีเวนต์/);
});

test('optimized scene files preserve sprite dimensions and avoid duplicate mobile backdrops',()=>{
 const base=new URL('../halloween/event/assets/',import.meta.url);let before=0,after=0;
 for(const file of fs.readdirSync(base).filter(x=>x.endsWith('.png'))){const png=fs.readFileSync(new URL(file,base)),webp=fs.readFileSync(new URL(file.replace('.png','.webp'),base));assert.equal(webp.toString('ascii',12,16),'VP8L');const bits=webp.readUInt32LE(21);assert.equal((bits&0x3fff)+1,png.readUInt32BE(16),file+' width');assert.equal(((bits>>>14)&0x3fff)+1,png.readUInt32BE(20),file+' height');before+=png.length;after+=webp.length;}
 assert.ok(after<before*.8);const world=read('halloween/event/world.js');assert.doesNotMatch(world,/portrait-[\w-]+\.png|world-'\+key\+'\.png/);assert.match(read('mobile-stability.css'),/\.scene-shell::before\{[^}]*background:linear-gradient[^}]*filter:none/);
});

test('event list distinguishes loading, failure, and a confirmed empty season',()=>{
 const s=read('events.js'),a=s.indexOf('function renderEvents()'),b=s.indexOf('\n}',a)+2,box={innerHTML:''};
 const context={window:{HalloweenEventStatus:'loading'},document:{getElementById:()=>box},eventsList:()=>[],eventsPick:null,icon:()=>'',evDeckMount(){},evFlowMount(){}};
 vm.runInNewContext(s.slice(a,b),context);context.renderEvents();assert.match(box.innerHTML,/กำลังโหลด/);assert.doesNotMatch(box.innerHTML,/ตอนนี้ยังไม่มีอีเวนต์/);
 context.window.HalloweenEventStatus='error';context.renderEvents();assert.match(box.innerHTML,/ลองอีกครั้ง/);assert.doesNotMatch(box.innerHTML,/ตอนนี้ยังไม่มีอีเวนต์/);
 context.window.HalloweenEventStatus='ready';context.renderEvents();assert.match(box.innerHTML,/ตอนนี้ยังไม่มีอีเวนต์/);
});

test('the event card reads Candy from verified reward access and refreshes the visible event list',async()=>{
 const element=()=>({dataset:{},style:{setProperty(){}},setAttribute(){},innerHTML:'',hidden:false}),root=element();root.classList={remove(){}};let paints=0;
 const w={StudentOSHalloweenRewards:Catalog,StudentOSMainEntry:true,HalloweenRewardAccess:{view:()=>({owner:'a',status:'ready',candy:37})},addEventListener(){}};
 const context={window:w,document:{documentElement:root,currentScript:{src:'https://example.test/halloween/rewards/runtime.js'},readyState:'complete',querySelector:s=>s==='#scr-events.on'?{}:null,createElement:element},URL,Date,AbortController,setTimeout,clearTimeout,MutationObserver:class{observe(){}},renderEvents:()=>paints++,fetch:async()=>({ok:true,status:200,json:async()=>({enabled:true,claimingEnabled:true,endsAt:'2026-12-01T00:00:00+07:00'})})};
 vm.runInNewContext(read('halloween/rewards/runtime.js'),context);await new Promise(r=>setImmediate(r));assert.equal(w.HalloweenEventEntry.candy(),37);assert.ok(paints>0);assert.equal(w.HalloweenEventStatus,'ready');
});
