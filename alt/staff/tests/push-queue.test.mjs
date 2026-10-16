import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { mapConcurrent, drainQueue, nextDrain } from '../backend/functions/staff-notify/queue.mjs';
import { deliverJob } from '../backend/functions/staff-notify/delivery.mjs';
import { createNotifyKick } from '../backend/functions/staff-console/notify-kick.mjs';
import { createHandler } from '../backend/functions/staff-console/core.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
const gate = () => { let resolve; const promise = new Promise(r => {resolve=r;}); return {promise,resolve}; };
const job = {notice_id:'33333333-3333-4333-8333-333333333333',user_id:'recipient',attempts:1,title:'test',body:'body',audience_id:'recipient'};
function fakeDb({notice={status:'published',audience_id:'recipient'},notifications=true,subCount=1,lookupError=false}={}) {
  const updates=[],deletes=[],selections=[];
  return {updates,deletes,selections,
    from(table) {
      let write,remove=false,filters={};
      const resolve=()=>{
        if (write) {updates.push({table,write,filters}); return {error:null};}
        if (remove) {deletes.push(filters);return {error:null};}
        if (lookupError) return {data:null,error:Error('lookup')};
        if(table==='staff_notices')return {data:notice,error:null};
        if(table==='user_state')return {data:{notifications},error:null};
        return {data:Array.from({length:subCount},(_,i)=>({endpoint:`https://fcm.googleapis.com/fcm/send/${i}`,p256dh:'key',auth:'auth'})),error:null};
      };
      const chain={select(columns){selections.push({table,columns});return chain;},update(value){write=value;return chain;},
        delete(){remove=true;return chain;},eq(k,v){filters[k]=v;return chain;},
        single:async()=>resolve(),limit:async()=>resolve(),then:(ok,bad)=>Promise.resolve(resolve()).then(ok,bad)};
      return chain;
    }
  };
}

test('eight recipients start together; a stalled recipient does not hold the other seven',async()=>{
  const blocked=gate(),started=[];
  const task=drainQueue({claim:async()=>started.length?[]:Array.from({length:8},(_,id)=>({id})),
    deliver:async({id})=>{started.push(id);if(!id)await blocked.promise;return 'accepted';}});
  await tick(); assert.equal(started.length,8); blocked.resolve();
  assert.equal((await task).accepted,8);
});

test('new recipients fill freed slots while one earlier recipient is still stalled',async()=>{
  const blocked=gate(),started=[];let claimed=false;
  const task=drainQueue({claim:async()=>{if(claimed)return [];claimed=true;return Array.from({length:16},(_,id)=>id);},
    deliver:async id=>{started.push(id);if(!id)await blocked.promise;await tick();return 'accepted';}});
  for(let i=0;i<6;i++)await tick();
  assert.equal(started.length,16);blocked.resolve();assert.equal((await task).accepted,16);
});

test('a synthetic queue of 1000 recipients drains with bounded concurrency and one delivery each',async()=>{
  const pending=Array.from({length:1000},(_,id)=>id),seen=new Set(); let active=0,peak=0,claims=0;
  const result=await drainQueue({maxJobs:1100,claim:async limit=>{claims++;return pending.splice(0,limit);},
    deliver:async id=>{assert(!seen.has(id));seen.add(id);active++;peak=Math.max(peak,active);await tick();active--;return 'accepted';}});
  assert.equal(result.accepted,1000);assert.equal(seen.size,1000);assert.equal(peak,8);assert.equal(claims,63);assert.equal(result.more,false);
});

test('work and time budgets leave unclaimed jobs for a bounded continuation',async()=>{
  const pending=Array.from({length:100},(_,id)=>id);let time=0;
  const result=await drainQueue({maxJobs:96,budgetMs:20,now:()=>time,claim:async n=>pending.splice(0,n),
    deliver:async()=>{time+=3;return 'accepted';}});
  assert.equal(result.processed,16);assert.equal(pending.length,84);assert.equal(result.more,true);
  assert.deepEqual(nextDrain(result,0,false),{background:true,drain_depth:1});
  assert.equal(nextDrain(result,10,false),null);assert.equal(nextDrain(result,0,true),null);
});

test('every recipient has at most three device sends in flight and receives a private main-app link',async()=>{
  const db=fakeDb({subCount:10}),sent=[];let active=0,peak=0;
  const result=await deliverJob(job,{db,send:async(sub,payload,options)=>{
    active++;peak=Math.max(peak,active);sent.push({sub,payload:JSON.parse(payload),options});await tick();active--;
  }});
  assert.equal(result,'accepted');assert.equal(peak,3);assert.equal(sent.length,10);
  assert(sent.every(x=>x.options.urgency==='high'&&x.payload.url.endsWith('?go=staff-notif')));
  assert.equal(db.updates.at(-1).write.status,'accepted');
  assert.deepEqual(db.selections.find(x=>x.table==='user_state'),{table:'user_state',columns:'notifications:data->settings->notif'});
});

test('withdrawal, expiry, recipient mismatch and opt-out cancel delivery before any push',async()=>{
  for(const options of [{notice:{status:'withdrawn'}},{notice:{status:'published',until_at:'2000-01-01'}},
    {notice:{status:'published',audience_id:'someone-else'}},{notifications:false},{subCount:0}]){
    const db=fakeDb(options);let sent=0;
    assert.equal(await deliverJob(job,{db,send:async()=>{sent++;}}),'cancelled');assert.equal(sent,0);
  }
});

test('an expired device is removed and a temporary provider failure remains queued',async()=>{
  const db=fakeDb({subCount:2});
  assert.equal(await deliverJob(job,{db,send:async s=>{throw {statusCode:s.endpoint.endsWith('/0')?410:429};}}),'retry');
  assert.equal(db.deletes.length,1);assert(db.deletes[0].endpoint.endsWith('/0'));
  assert.equal(db.updates.at(-1).write.status,'pending');
  const broken=fakeDb({lookupError:true});
  assert.equal(await deliverJob(job,{db:broken,send:()=>assert.fail('must not send')}),'retry');
  assert.equal(broken.updates.at(-1).write.status,'pending');
});

test('immediate dispatch is limited to successful new grants and push publications',async()=>{
  const calls=[],tasks=[];const kick=createNotifyKick({url:'https://project.test',key:'server-only',
    fetcher:async(url,init)=>{calls.push({url,init});return new Response('{}',{status:202});},waitUntil:p=>tasks.push(p)});
  for(const action of ['overview','users','draft','withdraw','triage'])kick(action,{},{});
  kick('publish',{push:false},{});kick('grant',{}, {duplicate:true});
  assert.equal(calls.length,0);
  kick('grant',{},{});kick('publish',{push:true},{});await Promise.all(tasks);
  assert.equal(calls.length,2);assert(calls.every(x=>JSON.parse(x.init.body).background===true));
});

test('authorization and failed commits never kick delivery; a wake-up failure cannot undo a committed grant',async()=>{
  const uid='11111111-1111-4111-8111-111111111111';let kicks=0;
  const config={getUser:async()=>({id:uid,identities:[{provider:'github',identity_data:{provider_id:'42'}}]}),
    github:async path=>path==='/user'?{id:42,login:'dev'}:{full_name:'Nadokagenou/studentos-ai',permissions:{push:true}},
    command:async()=>({ok:true}),afterCommand:()=>{kicks++;}};
  const request=()=>new Request('https://edge.test',{method:'POST',headers:{authorization:'Bearer valid','x-github-token':'valid'},
    body:JSON.stringify({action:'grant',target:uid,amount:1,reason:'test reason',request_id:uid})});
  assert.equal((await createHandler({...config,getUser:async()=>null})(request())).status,401);assert.equal(kicks,0);
  assert.equal((await createHandler({...config,command:async()=>{throw Error('commit');}})(request())).status,500);assert.equal(kicks,0);
  assert.equal((await createHandler({...config,afterCommand:()=>{throw Error('wake');}})(request())).status,200);
  const tasks=[],warnings=[];createNotifyKick({url:'https://project.test',key:'secret',fetcher:async()=>{throw Error('offline');},
    waitUntil:p=>tasks.push(p),warn:s=>warnings.push(s)})('grant',{},{});
  await Promise.all(tasks);assert.equal(warnings.length,1);assert(!warnings[0].includes('secret'));
});

const workerSource=stripTypeScriptTypes((await readFile(new URL('../backend/functions/staff-notify/index.ts',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,''));
function workerHarness(db,{fetcher=async()=>new Response('{}',{status:202})}={}) {
  let handle;const tasks=[];
  runInNewContext(workerSource,{createClient:()=>db,drainQueue,nextDrain,deliverJob,Response,AbortSignal,
    fetch:fetcher,webpush:{setVapidDetails(){},sendNotification:async()=>{}},
    Deno:{env:{get:key=>({SUPABASE_URL:'https://project.test',SUPABASE_SERVICE_ROLE_KEY:'server',VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private'}[key])},serve:fn=>{handle=fn;}},
    EdgeRuntime:{waitUntil:p=>tasks.push(p)},console:{log(){},warn(){}}});
  return {handle,tasks};
}
const workerRequest=(body={},key='server')=>new Request('https://project.test/functions/v1/staff-notify',
  {method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body)});

test('the real worker rejects untrusted background requests and returns 202 only after service authentication',async()=>{
  const db=fakeDb();db.rpc=async()=>({data:[],error:null});
  const w=workerHarness(db);
  assert.equal((await w.handle(new Request('https://project.test',{method:'POST',body:'{}'}))).status,401);
  assert.equal(w.tasks.length,0);
  assert.equal((await w.handle(workerRequest({drain_depth:11}))).status,400);
  assert.equal((await w.handle(workerRequest({background:true}))).status,202);
  await Promise.all(w.tasks);assert.equal(w.tasks.length,1);
});

test('the real worker drains more than the old ten-account limit and schedules one continuation at its cap',async()=>{
  const db=fakeDb(),calls=[];let next=0;
  db.rpc=async(_name,{p_limit})=>({data:Array.from({length:p_limit},()=>({...job,user_id:'recipient',index:next++})),error:null});
  const w=workerHarness(db,{fetcher:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return new Response('{}',{status:202});}});
  const response=await w.handle(workerRequest());const result=await response.json();
  await Promise.all(w.tasks);
  assert.equal(result.processed,96);assert.equal(result.accepted,96);assert.equal(result.more,true);
  assert.equal(calls.length,1);assert.deepEqual(calls[0].body,{background:true,drain_depth:1});
});
