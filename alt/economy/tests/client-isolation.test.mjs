import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../client.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){const memory=new Map(),clients=[];let local='a';const window={document:{hidden:false,body:{classList:{contains:()=>false}},addEventListener(){},getElementById:()=>null},addEventListener(){},HalloweenAccount:{create(opts){const c={opts,refresh:async()=>{},dispose(){opts.onChange(null);},dispatch:async()=>{throw Error('offline');}};clients.push(c);return c;}}};const ctx=vm.createContext({window,currentUser:{id:'a'},localOwner:()=>local,sb:{},TOKEN_KEY:'tokens',DONEFX_KEY:'fx',state:{tasks:[]},crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},performance:{now:()=>100000},setInterval(){},setTimeout(){},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}});vm.runInContext(source,ctx);return {window,ctx,clients,memory,local:x=>{local=x;}};}
function doc(owner,bal){return {owner,vault:{tokens:{bal,skins:{},fx:[],fx3d:{},bought:[],freeSpins:0}},availableBadges:['hello'],roomOwned:['wall:navy'],completed:{},claims:{},admin:false};}
test('verified getters return copies, clear on an account switch, and reject a stale callback after returning to the same account',async()=>{
 const h=harness();await flush();const api=h.window.StudentOSEconomy,old=h.clients[0];old.opts.onChange(doc('a',20));assert.equal(api.tokens().bal,20);
 const copy=api.document();copy.vault.tokens.bal=9999;api.available().push('genesis');api.roomOwned().push('wall:plum');assert.equal(api.tokens().bal,20);assert.equal(api.ownsBadge('genesis'),false);assert.equal(api.roomOwned().length,1);
 h.ctx.currentUser={id:'b'};h.local('b');await api.refresh(true);assert.equal(api.ready(),false);assert.equal(api.tokens().bal,0);old.opts.onChange(doc('a',999));assert.equal(api.ready(),false);
 h.ctx.currentUser={id:'a'};h.local('a');await api.refresh(true);old.opts.onChange(doc('a',999));assert.equal(api.ready(),false);h.clients.at(-1).opts.onChange(doc('a',21));assert.equal(api.tokens().bal,21);
 h.local('b');assert.equal(api.ready(),false);assert.equal(api.tokens().bal,0);
});
test('a failed account refresh clears rights and leaves the previous local token backup recoverable',async()=>{
 const h=harness();h.memory.set('tokens','old-saved-data');await flush();const c=h.clients[0];c.opts.onChange(doc('a',20));assert.ok(h.memory.get('tokens.legacy-unverified.a').includes('old-saved-data'));c.refresh=async()=>{throw Error('offline');};await h.window.StudentOSEconomy.refresh(true);assert.equal(h.window.StudentOSEconomy.ready(),false);assert.equal(h.window.StudentOSEconomy.ownsBadge('hello'),false);assert.ok(h.memory.has('tokens.legacy-unverified.a'));
});
