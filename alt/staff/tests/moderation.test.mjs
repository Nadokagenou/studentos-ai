import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createBugDB, reporter, other, staff, asUser, rpc } from './bug-reports-fixture.mjs';
import { validate } from '../backend/functions/staff-console/core.mjs';
import { createNotifyKick } from '../backend/functions/staff-console/notify-kick.mjs';
const db = await createBugDB();
await db.exec(`create role authenticator; alter table auth.users add column banned_until timestamptz;
  alter table user_state enable row level security;
  create policy owner on user_state to authenticated using (id=auth.uid()) with check (id=auth.uid());
  grant select,update on user_state to authenticated;
  insert into user_state values('${other}','{"vault":{"tokens":{"bal":8}}}',now());`);
await db.exec(await readFile(new URL('../backend/supabase/migrations/20261016121927_studentos_account_moderation.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../backend/supabase/migrations/20261016123111_allow_public_account_precheck.sql',import.meta.url),'utf8'));
const req = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const cmd = (action, payload) => rpc(db,'staff_moderation_command',[staff,'developer',action,JSON.stringify(payload)]);
const payload = (n, extra={}) => ({request_id:req(n),target:reporter,reason:'ทดสอบในฐานข้อมูลจำลอง',...extra});
const balance = async () => Number((await db.query(`select data#>>'{vault,tokens,bal}' n from user_state where id='${reporter}'`)).rows[0].n);
const rejects = async (fn, match) => { await db.exec('savepoint rejected'); try { await assert.rejects(fn,match); } finally { await db.exec('rollback to rejected; release rejected'); } };
const rollback = async fn => { await db.exec('begin'); try {await fn();} finally {await db.exec('rollback');} };

test('validation rejects invalid amounts, targets and unapproved ban lengths', () => {
  for (const action of ['ban','unban','deduct']) assert.throws(()=>validate({action,...payload(1,{target:'invalid',amount:1,duration:'1d'})}));
  for (const amount of [0,-1,1.2,10001,'1']) assert.throws(()=>validate({action:'deduct',...payload(1,{amount})}));
  for (const duration of ['10s','3d',null]) assert.throws(()=>validate({action:'ban',...payload(1,{duration})}));
  assert.equal(validate({action:'ban',...payload(1,{duration:'2d'})}).payload.duration,'2d');
});

test('deduction is atomic, retries once, preserves homework and queues one private notice', async () => rollback(async()=>{
  const p=payload(1,{amount:1}); const r=await cmd('deduct',p);
  assert.equal(r.balance,19); assert.equal(r.push_queued,false);
  assert.equal((await cmd('deduct',p)).duplicate,true); assert.equal(await balance(),19);
  await rejects(()=>cmd('deduct',{...p,amount:2}));
  const row=(await db.query(`select data from user_state where id='${reporter}'`)).rows[0].data;
  assert.equal(row.tasks[0].id,'keep'); assert.equal(row.vault.tokens.staffDebited,1);
  const notices=await asUser(db,reporter,()=>rpc(db,'staff_personal_notices',[]));
  assert.equal(notices.length,1); assert.match(notices[0].title,/หัก 1/);
  assert.deepEqual(await asUser(db,other,()=>rpc(db,'staff_personal_notices',[])),[]);
  assert.deepEqual(await rpc(db,'staff_public_notices',[]),[]);
}));

test('insufficient funds roll back all receipts, notices and audit', async()=>rollback(async()=>{
  await rejects(()=>cmd('deduct',payload(2,{amount:21})));
  assert.equal(await balance(),20);
  assert.equal((await db.query('select count(*)::int n from staff_token_debits')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from staff_audit')).rows[0].n,0);
}));

test('multiple operators cannot deduct more than the remaining balance', async()=>rollback(async()=>{
  await cmd('deduct',payload(3,{amount:15}));
  await rejects(()=>rpc(db,'staff_moderation_command',[other,'second','deduct',JSON.stringify(payload(4,{amount:6}))]));
  assert.equal(await balance(),5);
}));

test('old snapshots receive cumulative debit once and cannot make a negative balance', async()=>rollback(async()=>{
  await cmd('deduct',payload(5,{amount:7}));
  const stale={tasks:[{id:'keep'}],vault:{tokens:{bal:18.5}}};
  await db.query('update user_state set data=$1 where id=$2',[JSON.stringify(stale),reporter]);
  assert.equal(await balance(),11.5);
  await db.query('update user_state set data=data where id=$1',[reporter]); assert.equal(await balance(),11.5);
  stale.vault.tokens.bal=2;
  await db.query('update user_state set data=$1 where id=$2',[JSON.stringify(stale),reporter]); assert.equal(await balance(),0);
  await rejects(()=>db.query('update user_state set data=$1 where id=$2',[JSON.stringify({vault:{tokens:{bal:10,staffDebited:100}}}),reporter]));
}));

test('ban durations, canonical Auth state, private status and unban agree',async()=>{
  for (const [i,duration,hours] of [[10,'1d',24],[11,'2d',48],[12,'permanent',null]]) await rollback(async()=>{
    await cmd('ban',payload(i,{duration}));
    const row=(await db.query('select b.expires_at,u.banned_until,extract(epoch from (b.expires_at-now()))/3600 hours from staff_account_bans b join auth.users u on u.id=b.target')).rows[0];
    if(hours) assert.equal(Number(row.hours),hours); else assert.equal(row.expires_at,null);
    assert.ok(row.banned_until);
    assert.equal((await asUser(db,reporter,()=>rpc(db,'staff_account_status',[]))).banned,true);
    assert.equal((await asUser(db,other,()=>rpc(db,'staff_account_status',[]))).banned,false);
    await cmd('unban',payload(i+100));
    assert.equal((await asUser(db,reporter,()=>rpc(db,'staff_account_status',[]))).banned,false);
    assert.equal((await db.query('select banned_until from auth.users where id=$1',[reporter])).rows[0].banned_until,null);
  });
});

test('expired bans allow access automatically; cannot ban the active operator',async()=>rollback(async()=>{
  await rejects(()=>cmd('ban',payload(20,{duration:'permanent',target:staff})));
  await cmd('ban',payload(21,{duration:'1d'}));
  await db.exec("update staff_account_bans set expires_at=now()-interval '1 second'");
  assert.equal((await asUser(db,reporter,()=>rpc(db,'staff_account_status',[]))).banned,false);
}));

test('account search preserves pagination, exact balances and ban state',async()=>rollback(async()=>{
  await cmd('ban',payload(23,{duration:'permanent'}));
  const result=await cmd('users',{query:reporter,offset:0});
  assert.equal(result.items.length,1); assert.equal(result.has_more,false);
  assert.equal(result.items[0].balance,20); assert.equal(result.items[0].banned,true);
  assert.equal(result.items[0].ban_until,null);
}));

test('old JWT cannot use Data API or RLS while banned but can read own reason',async()=>rollback(async()=>{
  await cmd('ban',payload(25,{duration:'1d'}));
  await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
  await db.query("select set_config('request.path','/rpc/send_message',false)");
  await asUser(db,reporter,async()=>{
    await rejects(()=>rpc(db,'staff_check_account_request',[]),/ระงับ/);
    assert.deepEqual((await db.query('select id from user_state')).rows,[]);
    await db.query("select set_config('request.path','/rpc/staff_account_status',false)");
    await rpc(db,'staff_check_account_request',[]);
    assert.equal((await rpc(db,'staff_account_status',[])).banned,true);
  });
  await db.query("select set_config('request.jwt.claim.role','',false)");
}));

test('normal roles cannot administer bans or debit records',async()=>rollback(async()=>{
  for(const role of ['anon','authenticated']) await asUser(db,other,async()=>{
    await rejects(()=>cmd('ban',payload(30,{duration:'1d'})));
    await rejects(()=>db.query('select * from staff_account_bans'));
    await rejects(()=>db.query('select * from staff_token_debits'));
  },role);
}));

test('anonymous public reads run an unprivileged no-op and reveal no ban state',async()=>{
  await db.query("select set_config('request.jwt.claim.role','anon',false)");
  await asUser(db,null,()=>rpc(db,'staff_check_account_request',[]),'anon');
  assert.equal((await db.query("select prosecdef from pg_proc where proname='staff_check_account_request'")).rows[0].prosecdef,false);
  assert.equal((await db.query("select has_function_privilege('anon','staff_account_status()','execute') allowed")).rows[0].allowed,false);
  await db.query("select set_config('request.jwt.claim.role','',false)");
});

test('private notifications deduplicate per account even with multiple devices',async()=>rollback(async()=>{
  await db.query('insert into push_subscriptions values($1,$2),($1,$3)',[reporter,'https://push.invalid/a','https://push.invalid/b']);
  const p=payload(40,{amount:1}); assert.equal((await cmd('deduct',p)).push_queued,true);
  await cmd('deduct',p);
  assert.equal((await db.query('select count(*)::int n from staff_push_jobs where notice_id=$1',[req(40)])).rows[0].n,1);
}));

test('new actions wake the existing worker only after a nonduplicate commit',async()=>{
  for(const action of ['deduct','ban','unban']) {
    const tasks=[]; let count=0;
    const kick=createNotifyKick({url:'https://example.test',key:'test',fetcher:async()=>{count++;return {ok:true,text:async()=>''};},waitUntil:p=>tasks.push(p)});
    kick(action,{},{}); kick(action,{}, {duplicate:true}); await Promise.all(tasks);
    assert.equal(count,1);
  }
});

for(const sourcePath of ['../../staff-news.js','../../../staff-news.js']) test(`wallet debit receipts handle retries and stale responses (${sourcePath})`,async()=>{
  let wallet={bal:12.5,staffMinted:10,staffDebited:0,skins:{keep:1}};
  const c=vm.createContext({URLSearchParams,location:{search:''},sessionStorage:{getItem:()=>null},localStorage:{getItem:()=>null,setItem(){}},VAULT_AT_KEY:'at',rawTokenState:()=>({...wallet}),saveTokenState:s=>{wallet=s;return true;}});
  vm.runInContext(await readFile(new URL(sourcePath,import.meta.url),'utf8'),c);
  const apply=remote=>{c.remote=remote;return vm.runInContext('staffApplyCredits(remote)',c);};
  apply({tokens:{staffMinted:10,staffDebited:1}}); assert.equal(wallet.bal,11.5);
  apply({tokens:{staffMinted:10,staffDebited:1}}); assert.equal(wallet.bal,11.5);
  apply({tokens:{staffMinted:10}}); assert.equal(wallet.bal,11.5);
  apply({tokens:{staffMinted:12,staffDebited:2}}); assert.equal(wallet.bal,12.5);
  assert.equal(wallet.skins.keep,1);
});
