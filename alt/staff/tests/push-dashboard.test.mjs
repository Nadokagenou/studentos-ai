import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBugDB,reporter,other,staff,asUser,rpc} from './bug-reports-fixture.mjs';
import {pushStatusHTML} from '../push-status-ui.mjs';
import {validate} from '../backend/functions/staff-console/core.mjs';
const db=await createBugDB(); after(()=>db.close());
await db.exec(await readFile(new URL('../backend/supabase/migrations/20261017071522_staff_push_dashboard.sql',import.meta.url),'utf8'));
await db.exec(`insert into staff_notices(id,title,body,status,published_at,push_requested,audience_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Private <test>','private reason','published',now()-interval '10 seconds',true,'${reporter}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Public notice','body','published',now()-interval '20 seconds',true,null);
 insert into staff_push_jobs(notice_id,user_id,status,attempts,finished_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${reporter}','accepted',1,now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${reporter}','pending',0,null),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${other}','failed',4,now());`);
const load=p=>rpc(db,'staff_push_dashboard',[staff,'developer','push_status',JSON.stringify(p)]);
test('dashboard aggregates real queue states and returns no recipients or subscription secrets',async()=>{
 const result=await load({status:'all'});
 assert.equal(result.metrics.pending,1);assert.equal(result.metrics.failed,1);assert.equal(result.metrics.accepted_24h,1);
 assert.equal(result.items.length,2);assert.equal(result.items.find(x=>x.audience==='personal').delivery_seconds,10);
 const text=JSON.stringify(result);for(const hidden of [reporter,other,'private reason','endpoint','p256dh']) assert.ok(!text.includes(hidden));
 assert.equal((await db.query('select count(*)::int n from staff_push_jobs')).rows[0].n,3);
});
test('filters include matching announcements without losing the other delivery states',async()=>{
 const r=await load({status:'failed'});assert.equal(r.items.length,1);assert.equal(r.items[0].pending,1);assert.equal(r.items[0].failed,1);
 assert.equal((await load({status:'cancelled'})).items.length,0);
 assert.equal(validate({action:'push_status',status:'pending',offset:22}).payload.offset,22);
 assert.throws(()=>validate({action:'push_status',status:'resend'}));
});
test('only authorized staff service commands may read queue metadata',async()=>{
 for(const role of ['anon','authenticated'])await asUser(db,reporter,()=>assert.rejects(()=>load({status:'all'})),role);
});
test('UI escapes titles and distinguishes provider acceptance from device receipt',()=>{
 const r=pushStatusHTML({items:[{title:'<img onerror=bad>',total:1,accepted:1,pending:0,sending:0,failed:0,cancelled:0,attempts:1,delivery_seconds:2.3}],metrics:{accepted_24h:1},generated_at:new Date().toISOString()});
 assert.match(r.rows,/&lt;img/);assert.ok(!r.rows.includes('<img'));assert.match(r.metrics,/บริการตอบรับ/);assert.ok(!r.rows.includes('ส่งซ้ำ'));
});
