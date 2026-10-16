// ============================================================
// แยกรายบัญชีฝั่งฐานข้อมูล — บัญชีหนึ่งอ่าน/เขียน/ลบของอีกบัญชีไม่ได้ ไม่ว่า client จะส่ง id อะไรมา
// ------------------------------------------------------------
// รันกับ Postgres จริง (PGlite) ด้วย migration ตัวจริงของ repo · บทบาท anon/authenticated แบบ Supabase
// วิธีรัน: เหมือน push_claim.test.mjs (ส่ง path ของ pglite/dist/index.js เป็นอาร์กิวเมนต์)
//
// ตารางที่เก็บข้อมูลของคน: user_state (งาน · แผน · ตั้งค่า · ของสะสม) · inbox_items (งานจาก Classroom/LINE)
// · integrations / integration_items (กุญแจ + ทะเบียนตัวเชื่อม — แตะได้เฉพาะ service role)
// · push_subscriptions (+ claim_push_subscription) · push_sent
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mig = f => fs.readFileSync(path.join(here, '..', 'migrations', f), 'utf8');
const lib = process.argv[2];
if (!lib) { console.error('ต้องส่ง path ของ pglite/dist/index.js มาด้วย'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(lib).href);
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create publication supabase_realtime;
`);
for (const f of ['20260823120000_user_state.sql', '20260823120100_push_subscriptions.sql',
  '20260823220000_push_sent.sql', '20260823120200_line.sql', '20260917090000_integrations.sql',
  '20261016120000_sync_cron_timeout.sql'.replace(/.*/, '__cleanup__'),
  '20261016130000_claim_push_subscription.sql']) {
  if (f === '__cleanup__') {
    // migration cron ต้องมี pg_cron · เอาเฉพาะส่วนที่เปลี่ยน cleanup_integrations (ส่วนท้ายของไฟล์)
    const s = mig('20261016120000_sync_cron_timeout.sql');
    await db.exec(s.slice(s.indexOf('create or replace function public.cleanup_integrations')));
    continue;
  }
  await db.exec(mig(f));
}
const EVERYMIN = '20261016150000_sync_every_minute.sql';
const hasEveryMin = fs.existsSync(path.join(here, '..', 'migrations', EVERYMIN));
if (hasEveryMin) { await db.exec(mig(EVERYMIN)); await db.exec(mig(EVERYMIN)); }   // รันซ้ำได้
const HARDEN = '20261016140000_account_isolation_hardening.sql';
const hasHarden = fs.existsSync(path.join(here, '..', 'migrations', HARDEN));
if (hasHarden) await db.exec(mig(HARDEN));
// สิทธิ์ตารางแบบ Supabase (ทุกตารางใน public ให้ anon/authenticated ทั้งหมด — RLS คือด่านเดียว)
await db.exec(`grant all on all tables in schema public to anon, authenticated;
               grant usage, select on all sequences in schema public to anon, authenticated;`);

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
await db.exec(`insert into auth.users values ('${A}'), ('${B}');
  insert into user_state (id, data) values ('${A}', '{"tasks":[{"id":"t1","detail":"งานของ A"}]}');
  insert into inbox_items (user_id, source, raw, meta) values ('${A}', 'google_classroom', 'งานของ A', '{}');
  insert into integrations (id, user_id, provider, account, secret) values ('11111111-1111-1111-1111-111111111111', '${A}', 'google_classroom', 'a@x', 'v1.x.y');
  insert into integration_items (integration_id, source_id, user_id, fingerprint, title) values ('11111111-1111-1111-1111-111111111111', 'c:w', '${A}', 'fp', 'งานของ A');
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://fcm.googleapis.com/a', '${A}', 'P', 'S');
  insert into push_sent (user_id, task_id) values ('${A}', 'sync-new::x');`);

async function as(uid, sql, params = []) {
  await db.exec(uid ? 'set role authenticated' : 'set role anon');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
  try { return await db.query(sql, params); }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
}
const n = r => (r.rows ? r.rows.length : -1);
const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });
const still = async (sql) => (await db.query(sql)).rows[0];

// ---- user_state ----
check('B อ่าน user_state ของ A ไม่เห็น', n(await as(B, `select * from user_state where id = $1`, [A])) === 0);
await as(B, `update user_state set data = '{"tasks":[]}' where id = $1`, [A]);
check('B แก้ user_state ของ A ไม่ได้', (await still(`select data->'tasks'->0->>'detail' d from user_state where id = '${A}'`)).d === 'งานของ A');
const upB = await as(B, `insert into user_state (id, data) values ($1, '{}') on conflict (id) do update set data = excluded.data`, [A]);
check('B เขียนทับ user_state ของ A ด้วย upsert (ส่ง id ของ A มา) ไม่ได้', !!upB.error, JSON.stringify(upB));
await as(B, `delete from user_state where id = $1`, [A]);
check('B ลบ user_state ของ A ไม่ได้', (await still(`select count(*)::int c from user_state where id = '${A}'`)).c === 1);
check('A อ่าน user_state ของตัวเองได้', n(await as(A, `select * from user_state where id = $1`, [A])) === 1);
check('anon อ่าน user_state ไม่ได้', n(await as(null, `select * from user_state`)) === 0);

// ---- inbox_items (งาน Classroom/LINE ที่รอเข้าแอป) ----
check('B อ่านกล่องเข้าของ A ไม่เห็น', n(await as(B, `select * from inbox_items`)) === 0);
const insB = await as(B, `insert into inbox_items (user_id, source, raw, meta) values ($1, 'google_classroom', 'ยัดงานให้ A', '{}')`, [A]);
check('B ยัดงานเข้ากล่องเข้าของ A ไม่ได้', !!insB.error, JSON.stringify(insB));
await as(B, `update inbox_items set consumed = true where user_id = $1`, [A]);
check('B มาร์คงานของ A ว่ารับแล้วไม่ได้ (งานจะไม่หายจาก A)', (await still(`select bool_or(consumed) c from inbox_items where user_id = '${A}'`)).c === false);

// ---- integrations / integration_items / push_sent: เฉพาะ service role ----
for (const t of ['integrations', 'integration_items', 'push_sent']) {
  check(`B อ่าน ${t} ไม่เห็นอะไรเลย`, n(await as(B, `select * from ${t}`)) === 0);
  check(`A ก็อ่าน ${t} ตรงไม่ได้ (ผ่านฟังก์ชันเท่านั้น)`, n(await as(A, `select * from ${t}`)) === 0);
}
check('B อ่านกุญแจ (secret) ของการเชื่อมของ A ไม่ได้', n(await as(B, `select secret from integrations`)) === 0);
const insI = await as(B, `insert into integrations (user_id, provider, account) values ($1, 'ics', 'x')`, [A]);
check('B สร้างการเชื่อมในนาม A ไม่ได้', !!insI.error, JSON.stringify(insI));

// ---- push_subscriptions ----
check('B อ่าน subscription ของ A ไม่เห็น', n(await as(B, `select * from push_subscriptions`)) === 0);
const cl = await as(B, `select public.claim_push_subscription($1, 'P', 'WRONG', 420)`, ['https://fcm.googleapis.com/a']);
check('B ยึด subscription ของ A ด้วยกุญแจที่เดาไม่ได้', !!cl.error && (await still(`select user_id u from push_subscriptions`)).u === A, JSON.stringify(cl));

// ---- ฟังก์ชันที่ใครก็เรียกได้ ----
const c1 = await as(null, `select public.cleanup_integrations()`);
check('anon เรียก cleanup_integrations ไม่ได้', !!c1.error, JSON.stringify(c1));
const c2 = await as(B, `select public.cleanup_integrations()`);
check('ผู้ใช้ทั่วไปเรียก cleanup_integrations ไม่ได้', !!c2.error, JSON.stringify(c2));
const c3 = await db.query(`select public.cleanup_integrations()`).then(() => ({ ok: true }), e => ({ error: e.message }));
check('เจ้าของฟังก์ชัน (pg_cron = postgres) ยังเรียกได้', c3.ok === true, JSON.stringify(c3));

// ---- ซิงก์ทุกนาที + realtime ----
const col = (await db.query("select count(*)::int c from information_schema.columns where table_name='integrations' and column_name='sync_lease_until'")).rows[0].c;
check('integrations มีคอลัมน์ sync_lease_until (ต้องมีก่อน deploy ฟังก์ชันที่จองแถว)', col === 1, col);
const pub = (await db.query("select count(*)::int c from pg_publication_tables where pubname='supabase_realtime' and tablename='inbox_items'")).rows[0].c;
check('inbox_items อยู่ใน publication ของ realtime ครั้งเดียว (รัน migration ซ้ำแล้ว)', pub === 1, pub);
const leaseB = await as(B, "update integrations set sync_lease_until = now() returning id");
check('B จองแถวการเชื่อมของ A ไม่ได้', n(leaseB) === 0 || !!leaseB.error, JSON.stringify(leaseB));

const pass = results.filter(r => r.pass).length;
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + (r.detail || '')));
console.log(`\n${pass}/${results.length} ผ่าน${hasHarden ? '' : '   (ยังไม่มี ' + HARDEN + ')'}`);
process.exit(pass === results.length ? 0 : 1);
