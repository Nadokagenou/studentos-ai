import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
for(const path of ['../../app.js']){
 const source=(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
 const extract=name=>{const start=source.indexOf(`async function ${name}()`);return source.slice(start,source.indexOf('\n}\n',start)+2);};
 test(`${path}: a previous account's late cloud read cannot change the current account`,async()=>{
  let release;const queried=[];let count=0;
  const c=vm.createContext({currentUser:{id:'A'},lastSeenRev:0,state:{tasks:[{id:'B-private'}]},
   sb:{from:()=>({select(){return this;},eq(_k,v){queried.push(v);return this;},maybeSingle(){count++;return count===1?Promise.resolve({data:{rev:1}}):new Promise(r=>release=r);}})}});
  vm.runInContext(extract('cloudPull'),c);const reading=vm.runInContext('cloudPull()',c);
  await new Promise(r=>setImmediate(r));c.currentUser={id:'B'};release({data:{rev:1,data:{tasks:[{id:'A-private'}]}}});
  assert.equal(await reading,false);assert.equal(c.state.tasks[0].id,'B-private');assert.deepEqual(queried,['A','A']);assert.equal(c.lastSeenRev,0);
 });
 test(`${path}: an account change during pull prevents an old snapshot from being sent`,async()=>{
  let release,writes=0;
  const c=vm.createContext({currentUser:{id:'A'},sb:{from(){writes++;throw Error('must not send');}},cloudWritableFor:()=>true,localOwner:()=> 'A',pushSnapshot:()=>({hash:'changed',body:{tasks:['private-A']}}),lastPushedHash:'old',cloudPull:()=>new Promise(r=>release=r)});
  vm.runInContext(extract('pushRound'),c);const writing=vm.runInContext('pushRound()',c);
  c.currentUser={id:'B'};release(false);await writing;assert.equal(writes,0);
 });
}
