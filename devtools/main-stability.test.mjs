import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
test('repeated taps cannot queue the same server-backed navigation while it is opening',async()=>{
 let resolve,calls=0;const box={navigating:false,main:{setAttribute(){},removeAttribute(){},focus(){}},PANEL_NAMES:{},ROOM_ROUTES:{},detail:{open:false},playable:true,store:{},read:()=>({event:{closed:false}}),perform:()=>{calls++;return new Promise(r=>resolve=r);},history:{replaceState(){}},route:'gate',render(){},window:{scrollTo(){}}};
 vm.runInNewContext('async '+grab(event,'navigate'),box);const first=box.navigate('hub');await box.navigate('hub');assert.equal(calls,1);resolve({});await first;assert.equal(box.navigating,false);assert.equal(box.route,'hub');
});
test('audio or cosmetic failures cannot turn a committed quest into a failed save',async()=>{
 const result={rewards:[],npc:'Tang'},box={pending:false,crypto:{randomUUID:()=> 'request'},preview:false,account:{dispatch:async()=>({result})},audio:{play(){throw Error('phone audio failed');}},updateWallet(){},updateBanner(){},window:{HalloweenEventFeedback:{present(){throw Error('animation failed');}}},reduced:()=>false,render(){throw Error('scene paint failed');},console:{warn(){}},toast(){throw Error('must not report a failed save');}};
 vm.runInNewContext('async '+grab(event,'perform'),box);assert.equal(await box.perform({type:'quest'}),result);assert.equal(box.pending,false);
});
const root=path.resolve(import.meta.dirname,'..'),baseline=process.env.STUDENTOS_STABILITY_BASELINE?JSON.parse(fs.readFileSync(process.env.STUDENTOS_STABILITY_BASELINE,'utf8')):null,read=p=>(baseline?.[p]??fs.readFileSync(path.join(root,p),'utf8')).replaceAll('\r\n','\n');
const app=read('app.js'),event=read('halloween/event/experience.js');
function grab(s,name){const a=s.indexOf('function '+name+'(');assert.ok(a>=0,name);const h=s.slice(a).match(/\)\s*\{/);let depth=0,start=a+h.index+h[0].lastIndexOf('{');for(let i=start;i<s.length;i++){if(s[i]==='{')depth++;if(s[i]==='}'&&!--depth)return s.slice(a,i+1);}throw Error(name);}
test('main public assets and entry links do not depend on the retired ALT entry',()=>{
 const html=read('index.html').replace(/<!--[\s\S]*?-->/g,'');
 for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert.doesNotMatch(m[1],/^(?:\.\/)?alt\//);if(/^(https?:|#|data:)/.test(m[1]))continue;const p=m[1].split(/[?#]/)[0];assert.ok(fs.existsSync(path.join(root,p)),p);}
 assert.doesNotMatch(html,/fx-cinematic-link|cinematic-preview\.html/);
 const shell=JSON.parse(read('sw.js').match(/const SHELL = (\[[\s\S]*?\]);/)[1]);assert.ok(shell.includes('halloween/event/experience.js'));assert.ok(shell.includes('economy/client.js'));for(const p of shell){assert.ok(!p.startsWith('alt/'),p);assert.ok(fs.existsSync(path.join(root,p)),p);}
});
test('only owned themes are shown, including event themes outside the old locked list',()=>{
 const owned=new Set(['light','dark','system']),buttons=['light','dark','halloween','moonlight','thai-ghost','hw-ghostship','hw-vampire'].map(id=>({dataset:{th:id},hidden:false,classList:{remove(){},toggle(){}}}));
 const box={themeOwned:id=>owned.has(id),document:{querySelectorAll:()=>buttons}};vm.runInNewContext(grab(app,'themeVisible')+'\n'+grab(app,'applyThemeLocks'),box);box.applyThemeLocks();
 for(const b of buttons)assert.equal(b.hidden,!owned.has(b.dataset.th),b.dataset.th);owned.add('halloween');box.applyThemeLocks();assert.equal(buttons.find(x=>x.dataset.th==='halloween').hidden,false);
});
test('phone and pen map targets act on the first click without a hidden arming step',()=>{
 const box={};vm.runInNewContext(grab(read('halloween/event/world.js'),'shouldArm'),box);
 for(const pointerType of ['touch','pen','mouse'])assert.equal(box.shouldArm({pointerType,detail:1,armed:false,labelVisible:false,markerVisible:false}),false);
});
test('unearned crafted and Genesis themes cannot fall through as free themes',()=>{
 const box={window:{},eventThemeOwned:()=>null,genesisUnlocked:()=>false,SECRETS:{ocean:{theme:'deepocean'}},secretUnlocked:()=>false,themeLocked:()=>false};
 vm.runInNewContext(grab(app,'themeOwned'),box);assert.equal(box.themeOwned('deepocean'),false);assert.equal(box.themeOwned('genesis'),false);assert.equal(box.themeOwned('light'),true);
});
test('a suspended phone audio engine cannot delay a guide/menu tap',async()=>{
 const mark="document.addEventListener('click',async e => {",a=event.indexOf(mark),b=event.indexOf("\n  });\n  document.getElementById('preferencesButton')",a);assert.ok(a>=0&&b>a);const body=event.slice(a+mark.length,b);
 let opened=0;const button={dataset:{},matches:()=>false,hasAttribute:n=>n==='data-open-guide',classList:{contains:()=>false}};
 const doc={querySelectorAll:()=>[]};const box={prefs:{sound:true},audio:{setEnabled:()=>new Promise(()=>{})},document:doc,window:{},lastPointerType:'touch',showGuide:()=>opened++,detail:{close(){}},console};vm.runInNewContext('async function click(e){'+body+'\n}',box);
 const promise=box.click({target:{closest:s=>s==='[data-typing]'?null:button},detail:1,pointerType:'touch',preventDefault(){}});assert.equal(opened,1);await promise;
});
test('a rejected quest submission restores its captured button after the DOM event ends',async()=>{
 const mark="detail.querySelector('#submitQuest')?.addEventListener('click',async e => {",a=event.indexOf(mark),b=event.indexOf('\n    });',a);assert.ok(a>=0&&b>a);const body=event.slice(a+mark.length,b),button={disabled:false},e={currentTarget:button};
 const box={perform:async()=>null,id:'quest',branch:null};vm.runInNewContext('async function submit(e){'+body+'\n}',box);const p=box.submit(e);assert.equal(button.disabled,true);e.currentTarget=null;await p;assert.equal(button.disabled,false);
});
test('unchanged account reads and focus pulses do not rebuild all buttons under a finger',()=>{
 const box={cache:null,paintedWalletKey:undefined,paint:()=>{box.paints++;},paints:0};vm.runInNewContext(grab(read('economy/client.js'),'paintAccount'),box);
 const d={owner:'same-owner',admin:false,vault:{tokens:{bal:3}},roomOwned:[],focusProofs:{x:0}};box.paintAccount(d);box.paintAccount({...d,focusProofs:{x:5}});assert.equal(box.paints,1);assert.equal(box.cache.focusProofs.x,5);box.paintAccount({...d,vault:{tokens:{bal:4}}});assert.equal(box.paints,2);box.paintAccount(null);box.paintAccount(null);assert.equal(box.paints,3);
});
