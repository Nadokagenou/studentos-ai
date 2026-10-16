import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createBugDB, asUser, rpc, reporter, other, staff, sample } from './bug-reports-fixture.mjs';
import { validate, createHandler } from '../backend/functions/staff-console/core.mjs';
import { renderBugs, renderIssues } from '../report-ui.mjs';
const db = await createBugDB();
await db.exec(await readFile(new URL('../backend/supabase/migrations/20261016033841_studentos_report_lifecycle.sql',import.meta.url),'utf8'));
after(()=>db.close());
const bug = randomUUID();
await asUser(db,reporter,()=>rpc(db,'submit_bug_report',[bug,JSON.stringify(sample)]));
const cmd = (action,payload={})=>asUser(db,staff,()=>rpc(db,'staff_report_command',[staff,'developer',action,JSON.stringify(payload)]),'service_role');
const write = (action,payload,request_id=randomUUID())=>cmd(action,{...payload,request_id});
const list = (action,bucket)=>cmd(action,{bucket});

test('pending reports cannot be removed, even by a direct server request',async()=>{
  for(const [kind,id] of [['bug',bug],['content',1]]) await assert.rejects(write('report_trash',{kind,id}),/Only completed/);
  assert.equal((await list('bugs','pending')).items.length,1);
  assert.equal((await list('issues','pending')).items.length,1);
});
test('closing moves each kind out of pending and into completed with history intact',async()=>{
  await write('triage',{id:1,status:'reviewing',note:'กำลังตรวจสแปม'});
  await write('triage',{id:1,status:'closed',note:'ตรวจและจัดการเรียบร้อย'});
  await write('bug_triage',{id:bug,status:'resolved',reply:'แก้ปุ่มเปิดงานแล้วครับ'});
  assert.deepEqual((await list('bugs','pending')).items,[]);
  assert.deepEqual((await list('issues','pending')).items,[]);
  const bugs=await list('bugs','resolved'),issues=await list('issues','resolved');
  assert.equal(bugs.items[0].events.length,2); assert.equal(bugs.counts.resolved,1);
  assert.equal(issues.items[0].staff_events.length,2);
  assert.equal(issues.items[0].staff_events.at(-1).note,'ตรวจและจัดการเรียบร้อย');
});
test('removal is reversible, audited and idempotent; source reports remain present',async()=>{
  const request=randomUUID(),p={kind:'bug',id:bug};
  await write('report_trash',p,request);
  assert.equal((await write('report_trash',p,request)).duplicate,true);
  assert.deepEqual((await list('bugs','resolved')).items,[]);
  const trash=await list('bugs','trash');
  assert.equal(trash.items[0].id,bug); assert.equal(trash.items[0].events.length,2);
  assert.equal(trash.items[0].staff_events.length,1); assert.equal(trash.counts.trash,1);
  assert.equal((await db.query('select count(*)::int n from bug_reports where id=$1',[bug])).rows[0].n,1);
  const own=await asUser(db,reporter,()=>rpc(db,'my_bug_reports',[0]));
  assert.equal(own.items[0].status,'resolved'); assert.equal(own.items[0].events.length,2);
  await assert.rejects(write('bug_triage',{id:bug,status:'open',reply:''}),/in trash/);
  await assert.rejects(write('report_trash',p,request.replace(/^./,request[0]==='a'?'b':'a')),/already in trash/);
  const restore=randomUUID();
  await write('report_restore',p,restore); assert.equal((await write('report_restore',p,restore)).duplicate,true);
  assert.equal((await list('bugs','resolved')).items[0].id,bug);
  assert.equal((await write('report_trash',p,request)).duplicate,true);
  assert.deepEqual((await list('bugs','trash')).items,[]);
  await assert.rejects(write('report_restore',p),/not in trash/);
});
test('content reports have separate removal and retain their full audit history',async()=>{
  await write('report_trash',{kind:'content',id:1});
  assert.deepEqual((await list('issues','resolved')).items,[]);
  let item=(await list('issues','trash')).items[0];
  assert.equal(item.staff_events.length,3);
  await assert.rejects(write('triage',{id:1,status:'open',note:''}),/in trash/);
  await write('report_restore',{kind:'content',id:1});
  await write('triage',{id:1,status:'reviewing',note:'ตรวจเพิ่มเติมอีกครั้ง'});
  item=(await list('issues','pending')).items[0];
  assert.equal(item.staff_events.length,5); assert.equal(item.staff_events.at(-1).note,'ตรวจเพิ่มเติมอีกครั้ง');
  assert.equal((await db.query('select count(*)::int n from reports')).rows[0].n,1);
});
test('UUID casing cannot bypass removal; request IDs cannot change kind or action',async()=>{
  const request=randomUUID();
  await write('report_trash',{kind:'bug',id:bug.toUpperCase()},request);
  await assert.rejects(write('bug_triage',{id:bug,status:'open',reply:''}),/in trash/);
  await assert.rejects(write('report_restore',{kind:'bug',id:bug},request),/payload mismatch/);
  await write('report_restore',{kind:'bug',id:bug});
});
test('read buckets validate input and pages do not mix completed or trashed reports',async()=>{
  await assert.rejects(cmd('bugs',{bucket:'anything'}),/Invalid report bucket/);
  await db.exec('begin');
  try {
    await db.query(`insert into bug_reports(id,user_id,category,page,summary,detail,steps,request_fingerprint) select md5(('lifecycle'||i)::text)::uuid,$1,'tasks','หน้าแรก','test issue','description of issue','open the page','fixture' from generate_series(1,22)i`,[reporter]);
    const first=await cmd('bugs',{bucket:'pending',offset:0}),second=await cmd('bugs',{bucket:'pending',offset:20});
    assert.equal(first.items.length,20); assert.equal(first.has_more,true); assert.equal(second.items.length,2);
    assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,22);
    assert.equal(first.counts.resolved,1); assert.equal(first.counts.trash,0);
  } finally { await db.exec('rollback'); }
});
test('client roles cannot access archive state or invoke lifecycle RPCs',async()=>{
  for(const role of ['anon','authenticated']) await asUser(db,other,async()=>{
    for(const query of ['select * from staff_report_archive',`update staff_report_archive set deleted_at=null`,`delete from staff_report_archive`,`select staff_report_command('${staff}','developer','issues','{}')`,`select studentos_private.staff_report_command('${staff}','developer','issues','{}')`,`select studentos_private.staff_report_list('bug','pending',0)`]) await assert.rejects(db.query(query));
  },role);
});
test('lifecycle operations never create announcements, Push jobs or token grants',async()=>{
  for(const table of ['staff_notices','staff_push_jobs','staff_token_grants']) assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,0);
  assert.deepEqual((await db.query('select data from user_state')).rows[0].data,{tasks:[{id:'keep'}],vault:{tokens:{bal:20}}});
});
test('new lifecycle validation accepts only typed identities, supported buckets and request IDs',()=>{
  const base={action:'report_trash',kind:'bug',id:bug,request_id:randomUUID()};
  assert.equal(validate(base).payload.id,bug);
  assert.equal(validate({action:'issues',bucket:'resolved',offset:20}).payload.bucket,'resolved');
  for(const change of [{kind:'user'},{id:1},{id:''},{request_id:null}]) assert.throws(()=>validate({...base,...change}));
  assert.throws(()=>validate({...base,kind:'content',id:'1'}));
  assert.throws(()=>validate({action:'bugs',bucket:'all'}));
});
test('unauthorized users cannot reach lifecycle mutations at the Edge handler',async()=>{
  let calls=0;
  const handler=createHandler({getUser:async()=>null,github:async()=>null,command:async()=>{calls++;}});
  for(const action of ['report_trash','report_restore']) {
    const r=await handler(new Request('https://local.test',{method:'POST',headers:{authorization:'Bearer invalid','x-github-token':'invalid'},body:JSON.stringify({action,kind:'bug',id:bug,request_id:randomUUID()})}));
    assert.equal(r.status,401);
  }
  assert.equal(calls,0);
});
test('completed and trashed UI exposes correct actions without editable pending forms',()=>{
  const row={id:bug,summary:'แก้ปัญหาแล้ว',category:'tasks',page:'หน้าแรก',status:'resolved',created_at:new Date().toISOString(),events:[]};
  const done=renderBugs([row],'resolved');
  assert.ok(done.includes('ลบจากรายการ')); assert.ok(done.includes('เปิดตรวจใหม่')); assert.ok(!done.includes('data-bug-form'));
  const trash=renderBugs([row],'trash'); assert.ok(trash.includes('กู้คืนไปหมวดแก้เสร็จแล้ว')); assert.ok(!trash.includes('data-report-action="trash"'));
  const pending=renderBugs([{...row,status:'reviewing'}],'pending'); assert.ok(!pending.includes('ลบจากรายการ'));
});
test('content reports explain actual report kinds in Thai and safely render history',()=>{
  const html=renderIssues([{id:1,kind:'post',reason:'spam',status:'closed',note:'<script>unsafe</script>',staff_events:[{action:'triage',status:'closed',note:'<img onerror=x>',actor_login:'team',created_at:new Date().toISOString()}]}],{bucket:'resolved'});
  assert.ok(html.includes('รายงานโพสต์')); assert.ok(html.includes('สแปมหรือขายของ')); assert.ok(html.includes('ดูประวัติการจัดการ'));
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img onerror')); assert.ok(html.includes('&lt;img onerror=x&gt;'));
});
