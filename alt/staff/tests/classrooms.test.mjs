import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createBugDB,reporter as owner,other as member,staff as outsider,asUser,rpc} from './bug-reports-fixture.mjs';
const db=await createBugDB();after(()=>db.close());
await db.exec(`create function public.staff_account_allowed() returns boolean language sql as $$select coalesce(auth.uid()::text<>nullif(current_setting('test.banned_user',true),''),true)$$;
 insert into user_state values('${member}','{"tasks":[{"id":"keep-private"}],"settings":{"theme":"keep"},"vault":{"tokens":{"bal":8}}}',now());
 insert into profiles values('${owner}','Owner','owner'),('${member}','Member','member');`);
await db.exec(await readFile(new URL('../backend/supabase/migrations/20261017071524_studentos_classroom_chat.sql',import.meta.url),'utf8'));
const cmd=(who,action,p={})=>asUser(db,who,()=>rpc(db,'classroom_command',[action,JSON.stringify({expected_user:who,...p})]));
let room,code,msg;
const task={subject:'คณิตศาสตร์',detail:'ทำแบบฝึกหัดข้อ 1–5',due:'2026-10-20T16:59:00Z',estMin:30,privateField:'must not copy'};
test('create and invitation join persist; room directory and invite codes stay private',async()=>{
 const p={name:'ห้องเรียนทดสอบ',kind:'classroom',request_id:randomUUID()};
 room=(await cmd(owner,'create',p)).id;assert.equal((await cmd(owner,'create',p)).duplicate,true);
 assert.deepEqual((await cmd(outsider,'list')).items,[]);
 await assert.rejects(()=>cmd(outsider,'room',{room}));
 const r=await cmd(owner,'room',{room});code=r.room.invite_code;assert.equal(code.length,12);
 assert.equal((await cmd(member,'join',{code})).id,room);
 const mine=await cmd(member,'room',{room});assert.equal(mine.room.invite_code,null);assert.equal(mine.members.length,2);
 assert.equal((await cmd(member,'list')).items[0].id,room);
});
test('messages and task cards are checked, persistent, paginated and idempotent',async()=>{
 const p={room,request_id:randomUUID(),kind:'task',body:'งานประจำสัปดาห์',task};
 msg=(await cmd(owner,'post',p)).id;assert.equal((await cmd(owner,'post',p)).duplicate,true);
 await assert.rejects(()=>cmd(owner,'post',{...p,body:'changed'}));
 const r=await cmd(member,'room',{room});assert.equal(r.messages.length,1);assert.equal(r.messages[0].id,msg);
 assert.equal(r.messages[0].task.privateField,undefined);
 assert.deepEqual((await cmd(member,'room',{room,after:msg})).messages,[]);
 await assert.rejects(()=>cmd(outsider,'post',{...p,request_id:randomUUID()}));
 await assert.rejects(()=>cmd(owner,'post',{...p,request_id:randomUUID(),task:{...task,estMin:0}}));
});
test('accept writes one task only to the accepting user; preserves private work and token state',async()=>{
 const a=await cmd(member,'accept',{room,message:msg});assert.equal(a.present,true);
 const twice=await cmd(member,'accept',{room,message:msg});assert.equal(twice.already,true);assert.equal(twice.task_id,a.task_id);
 const state=(await db.query('select data from user_state where id=$1',[member])).rows[0].data;
 assert.equal(state.tasks.length,2);assert.equal(state.tasks[0].id,'keep-private');assert.equal(state.vault.tokens.bal,8);assert.equal(state.settings.theme,'keep');
 const added=state.tasks[1];assert.equal(added.subject,task.subject);assert.equal(added.detail,task.detail);assert.equal(added.sourceId,'classroom');assert.equal(added.done,false);
 assert.equal(added.privateField,undefined);
 assert.equal((await db.query('select jsonb_array_length(data->\'tasks\') n from user_state where id=$1',[owner])).rows[0].n,1);
 await assert.rejects(()=>cmd(outsider,'accept',{room,message:msg}));
});
test('revision polling notices new messages and deletions without resending unchanged history',async()=>{
 const initial=await cmd(member,'room',{room});
 assert.equal((await cmd(member,'room',{room,revision:initial.room.revision})).unchanged,true);
 const sent=await cmd(owner,'post',{room,request_id:randomUUID(),kind:'text',body:'new message'});
 const next=await cmd(member,'room',{room,revision:initial.room.revision});
 assert.notEqual(next.room.revision,initial.room.revision);assert.equal(next.messages.at(-1).body,'new message');
 await cmd(owner,'delete_message',{room,message:sent.id});
 const deleted=await cmd(member,'room',{room,revision:next.room.revision});
 assert.equal(deleted.messages.at(-1).deleted,true);assert.equal(deleted.messages.at(-1).body,'');
});
test('client account mismatch and banned user cannot read or mutate a room',async()=>{
 await assert.rejects(()=>cmd(member,'room',{room,expected_user:owner}),/CLASS_AUTH/);
 await db.query("select set_config('test.banned_user',$1,false)",[member]);
 await assert.rejects(()=>cmd(member,'room',{room}),/CLASS_BANNED/);
 await db.query("select set_config('test.banned_user','',false)");
});
test('removed members lose room access and cannot use a retained invitation',async()=>{
 await assert.rejects(()=>cmd(member,'remove_member',{room,target:owner}));
 await cmd(owner,'remove_member',{room,target:member});
 await assert.rejects(()=>cmd(member,'room',{room}));assert.equal((await cmd(member,'join',{code})).error,'CLASS_REMOVED');
 await cmd(owner,'restore_member',{room,target:member});assert.equal((await cmd(member,'room',{room})).room.id,room);
 await cmd(owner,'rotate',{room});assert.equal((await cmd(outsider,'join',{code})).error,'CLASS_INVALID_CODE');
});
test('deleted cards disappear without deleting accepted tasks; members cannot delete others messages',async()=>{
 await assert.rejects(()=>cmd(member,'delete_message',{room,message:msg}));
 await cmd(owner,'delete_message',{room,message:msg});
 const r=await cmd(member,'room',{room});assert.equal(r.messages[0].deleted,true);assert.equal(r.messages[0].task,null);
 await assert.rejects(()=>cmd(member,'accept',{room,message:msg}));
 assert.equal((await db.query('select jsonb_array_length(data->\'tasks\') n from user_state where id=$1',[member])).rows[0].n,2);
});
test('anonymous and normal users have no direct table access',async()=>{
 for(const role of ['anon','authenticated']) await asUser(db,outsider,async()=>{
  await assert.rejects(()=>db.query('select * from studentos_classrooms.messages'));
  if(role==='anon')await assert.rejects(()=>rpc(db,'classroom_command',['list','{}']));
 },role);
});
test('joining is rate limited even for invalid codes and closure stops new messages',async()=>{
 for(let i=0;i<11;i++)await cmd(outsider,'join',{code:'BADCODE'});
 assert.equal((await cmd(outsider,'join',{code:'BADCODE'})).error,'CLASS_RATE_LIMIT');
 await assert.rejects(()=>cmd(owner,'leave',{room}),/CLASS_OWNER_CANNOT_LEAVE/);
 await cmd(owner,'close',{room});assert.equal((await cmd(member,'room',{room})).room.closed,true);
 await assert.rejects(()=>cmd(member,'post',{room,request_id:randomUUID(),kind:'text',body:'late'}),/CLASS_CLOSED/);
 await cmd(member,'leave',{room});assert.deepEqual((await cmd(member,'list')).items,[]);
});
