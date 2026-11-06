import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const block=source.slice(source.indexOf('\nconst OWNER_KEY'),source.indexOf('\n// ---- end account owner'));
function fn(name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);}
function device(){
 const store=new Map(),box={state:{tasks:[],settings:{name:'',freeHours:2}},stateRev:0,console:{warn(){}},
  localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){if(box.full)throw Error('Storage full');store.set(k,String(v));},removeItem:k=>store.delete(k)},
  persistState(){store.set('studentos.alt.v1',JSON.stringify(box.state));},ctxExport:()=>null,ctxClear(){},syncFp:JSON.stringify};
 vm.runInNewContext("const SYNC_BASE_KEY='studentos.alt.syncBase';\n"+block+'\n'+fn('syncMergeById')+'\n'+fn('syncMergeKeys'),box);
 return {box,store};
}
const savedState=()=>({tasks:[{id:'task-a',detail:'A'}],sessions:[{id:'session-a',taskId:'task-a',min:15}],marks:[{id:'mark-a',title:'Exam'}],settings:{name:'A',freeHours:3}});
function leave(d){d.box.state=savedState();d.box.setLocalOwner('a');d.store.set('studentos.alt.syncBase','saved-base-a');d.box.leaveAccount();}
const ids=list=>Array.from(list||[],x=>x.id).sort().join(',');

test('main logout and login restore sessions, calendar marks and account settings alongside tasks',()=>{
 const d=device();leave(d);d.box.adoptAccountIfNeeded('a');const s=d.box.state;
 assert.equal(ids(s.tasks),'task-a');assert.equal(ids(s.sessions),'session-a');assert.equal(ids(s.marks),'mark-a');
 assert.equal(s.settings.name,'A');assert.equal(s.settings.freeHours,3);assert.equal(d.store.get('studentos.alt.syncBase'),'saved-base-a');
 const persisted=JSON.parse(d.store.get('studentos.alt.v1'));assert.equal(ids(persisted.sessions),'session-a');assert.equal(ids(persisted.marks),'mark-a');
});
test('main restoration keeps guest additions and uses guest edits when record IDs overlap',()=>{
 const d=device();leave(d);d.box.state.tasks=[{id:'task-a',detail:'Guest edit'},{id:'task-guest'}];d.box.state.sessions=[{id:'session-guest'}];d.box.state.marks=[{id:'mark-a',title:'Guest edit'},{id:'mark-guest'}];
 d.box.adoptAccountIfNeeded('a');const s=d.box.state;
 assert.equal(ids(s.tasks),'task-a,task-guest');assert.equal(s.tasks.find(t=>t.id==='task-a').detail,'Guest edit');
 assert.equal(ids(s.sessions),'session-a,session-guest');assert.equal(ids(s.marks),'mark-a,mark-guest');assert.equal(s.marks.find(m=>m.id==='mark-a').title,'Guest edit');
});
test('restored main data is not misread as local deletion by the next three-way cloud merge',()=>{
 const d=device(),remote=savedState(),base={};
 for(const k of ['tasks','sessions','marks'])base[k]=Object.fromEntries(remote[k].map(x=>[x.id,JSON.stringify(x)]));
 base.settings=Object.fromEntries(Object.entries(remote.settings).map(([k,v])=>[k,JSON.stringify(v)]));
 leave(d);d.box.adoptAccountIfNeeded('a');const s=d.box.state;
 for(const k of ['tasks','sessions','marks'])assert.equal(ids(d.box.syncMergeById(s[k],remote[k],base[k])),ids(remote[k]),k);
 assert.equal(d.box.syncMergeKeys(s.settings,remote.settings,base.settings).name,'A');
});
test('logging in to another main account never restores the previous account backup',()=>{
 const d=device();leave(d);d.box.adoptAccountIfNeeded('b');assert.equal(d.box.state.tasks.length,0);assert.equal(ids(d.box.state.sessions),'');assert.equal(ids(d.box.state.marks),'');assert.equal(d.box.state.settings.name,'');assert.equal(d.store.has('studentos.alt.syncBase'),false);
});
test('switching main accounts retains a separate complete backup for each account',()=>{
 const d=device();d.box.state=savedState();d.box.setLocalOwner('a');assert.equal(d.box.adoptAccountIfNeeded('b'),'adopted');d.box.setLocalOwner('b');d.box.state.tasks.push({id:'task-b'});
 assert.equal(d.box.adoptAccountIfNeeded('a'),'adopted');assert.equal(ids(d.box.state.sessions),'session-a');assert.equal(ids(d.box.state.tasks),'task-a');
 assert.equal(ids(JSON.parse(d.store.get('studentos.alt.accountBackup.b')).state.tasks),'task-b');
});
test('a full device blocks main account switching without clearing the existing data',()=>{
 const d=device();d.box.state=savedState();d.box.setLocalOwner('a');d.box.full=true;
 assert.equal(d.box.adoptAccountIfNeeded('b'),'blocked');assert.equal(ids(d.box.state.sessions),'session-a');assert.equal(d.box.localOwner(),'a');
});
test('first main login without a backup keeps locally created tasks and timer sessions',()=>{
 const d=device();d.box.state=savedState();d.box.adoptAccountIfNeeded('a');assert.equal(ids(d.box.state.tasks),'task-a');assert.equal(ids(d.box.state.sessions),'session-a');
});
test('old main backups without sessions or marks keep the current guest records',()=>{
 const d=device();d.store.set('studentos.alt.accountBackup.a',JSON.stringify({owner:'a',state:{tasks:[{id:'old-task'}],settings:{name:'A'}}}));
 d.box.state.sessions=[{id:'new-session'}];d.box.state.marks=[{id:'new-mark'}];d.box.state.settings.guestOnly=true;d.box.adoptAccountIfNeeded('a');
 assert.equal(ids(d.box.state.sessions),'new-session');assert.equal(ids(d.box.state.marks),'new-mark');assert.equal(d.box.state.settings.guestOnly,true);assert.equal(d.box.state.settings.name,'A');
});
