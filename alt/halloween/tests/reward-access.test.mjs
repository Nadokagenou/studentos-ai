import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),C=require('../rewards/catalog.js'),N=require('../rewards/integration.js');
const Access=require('../rewards/entitlements.js');
const app=fs.readFileSync(new URL('../../app.js',import.meta.url),'utf8');
const extract=(source,name)=>{const a=source.indexOf('function '+name+'(');assert.ok(a>=0,name);return source.slice(a,source.indexOf('\n}',a)+2);};
test('all six event themes reject an empty account even if the local inventory or preference says otherwise',()=>{
 const box={window:{StudentOSHalloweenRewards:C,HalloweenRewardAccess:{owns:()=>false}},THEME_GACHA:[],THEME_SHOP:{},THEME_CODE:{},inviteThemeId:()=>false,tokenState:()=>({bought:C.items.map(x=>x.theme),skins:{halloween:9}}),codeThemeOwned:()=>true};
 const helper=app.includes('function eventThemeOwned(')?extract(app,'eventThemeOwned'):'';
 vm.runInNewContext(helper+'\n'+app.split('\n').find(x=>x.startsWith('function themeLocked('))+'\n'+extract(app,'themeOwned'),box);
 for(const item of C.items.filter(x=>x.kind==='theme'))assert.equal(box.themeOwned(item.theme),false,item.id);
});
test('a forged native effect inventory cannot unlock any of the eight event effects',()=>{
 const source=fs.readFileSync(new URL('../../hoop.js',import.meta.url),'utf8'),line=source.split('\n').find(x=>x.startsWith('function fxOwned('));
 const box={window:{HalloweenCosmetics:{isEffect:N.isEffect,owns:()=>false}},FX_SHOP:{},tokenState:()=>({fx:C.items.filter(x=>x.kind==='effect').map(x=>x.id)})};vm.runInNewContext(line,box);
 for(const item of C.items.filter(x=>x.kind==='effect'))assert.equal(box.fxOwned(item.id),false,item.id);
});
test('a costume cannot be equipped from its old local preference without account rights',()=>{
 let written=false;const storage={getItem:()=>null,setItem(){written=true;}};
 assert.equal(N.saveCostume(storage,'sai-witch'),false);assert.equal(written,false);
});
test('zero-price room cosmetics do not bypass event ownership',()=>{
 const source=fs.readFileSync(new URL('../../room.js',import.meta.url),'utf8'),box={window:{HalloweenCosmetics:{owns:()=>false}},roomFind:()=>({id:'hw-velvet-bat',cost:0}),roomState:()=>({owned:['ceiling:hw-velvet-bat']})};vm.runInNewContext(extract(source,'roomOwns'),box);assert.equal(box.roomOwns('ceiling','hw-velvet-bat'),false);
});
test('only a matching owner, season and permanent server receipt unlocks a cosmetic',()=>{
 const id='theme-midnight-academy',doc={owner:'a',season:'halloween-2026',rewards:{[id]:{id,permanent:true,receipt:'confirmed'}}};assert.equal(Access.receipt(doc,'a',id),true);
 for(const bad of [{...doc,owner:'b'},{...doc,season:'test'},{...doc,rewards:{[id]:{id,permanent:true}}},{...doc,rewards:{[id]:{id:'other',permanent:true,receipt:'x'}}}])assert.equal(Access.receipt(bad,'a',id),false);
});
test('switching accounts during a pending read never paints or retains the previous rights',async()=>{
 let owner='a',release;const reader=Access.create({owner:()=>owner,createAccount:()=>({refresh:()=>new Promise(r=>release=r),read:()=>({owner:'a',season:'halloween-2026',rewards:{'sai-witch':{id:'sai-witch',permanent:true,receipt:'r'}}}),dispose(){}})});const p=reader.refresh();await Promise.resolve();owner='b';assert.equal(reader.owns('sai-witch'),false);release();await p;assert.equal(reader.owns('sai-witch'),false);assert.equal(reader.view().owner,'b');
});
test('an unavailable account or signed-out state cannot fall back to local unlock flags',async()=>{
 let owner='a',fail=false,reads=0;const id='sai-witch',reader=Access.create({owner:()=>owner,createAccount:()=>({async refresh(){reads++;if(fail)throw Error('offline');},read:()=>({owner,season:'halloween-2026',rewards:{[id]:{id,permanent:true,receipt:'r'}}}),dispose(){}})});await reader.refresh();assert.equal(reader.owns(id),true);fail=true;await reader.refresh(true);assert.equal(reader.owns(id),false);owner=null;await reader.refresh(true);assert.equal(reader.view().status,'login');assert.equal(reads,2);
});
