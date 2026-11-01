// ============================================================
// เทสต์ bucket "task-files" ของคลังงาน (migration 20261031120000_task_files.sql)
// ------------------------------------------------------------
// รันกับ Postgres จริง (PGlite) · ทำ schema storage ขั้นต่ำเอง (buckets · objects · foldername แบบเดียวกับ Supabase)
// วิธีรัน (เหมือน token_purchases.test.mjs):
//   npm install --prefix <โฟลเดอร์ชั่วคราว> @electric-sql/pglite@0.2.17
//   node supabase/tests/task_files.test.mjs <โฟลเดอร์ชั่วคราว>/node_modules/@electric-sql/pglite/dist/index.js
//
// ที่ต้องพิสูจน์: bucket ปิด · 1MB · jpeg เท่านั้น · เจ้าของอ่าน/เขียน/ลบได้เฉพาะโฟลเดอร์ <uid>/ ของตัวเอง
// · คนอื่นและคนที่ไม่ล็อกอินแตะไม่ได้เลย · แก้ไฟล์ไม่ได้ (ไม่มี policy update) · รัน migration ซ้ำได้
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIG = path.join(here, '..', 'migrations', '20261031120000_task_files.sql');
const lib = process.argv[2];
if (!lib) { console.error('ต้องส่ง path ของ pglite/dist/index.js มาด้วย (ดูหัวไฟล์)'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(lib).href);
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  -- เหมือนของ Supabase: ทุกท่อนของ path ยกเว้นชื่อไฟล์ท้ายสุด
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  grant select on storage.buckets to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
`);

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };
const U1 = '00000000-0000-0000-0000-0000000000a1';
const U2 = '00000000-0000-0000-0000-0000000000b2';
async function as(uid, sql, params = []) {
  await db.exec(uid ? 'set role authenticated' : 'set role anon');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
  try { return await db.query(sql, params); }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role'); }
}

if (!fs.existsSync(MIG)) { ok(false, 'มีไฟล์ migration 20261031120000_task_files.sql'); console.log(`\n${pass}/${pass + fail}`); process.exit(1); }
await db.exec(fs.readFileSync(MIG, 'utf8'));

const b = (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'task-files'`)).rows[0];
ok(b && b.public === false && Number(b.file_size_limit) === 1048576 && JSON.stringify(b.allowed_mime_types) === '["image/jpeg"]',
  'bucket ปิด · 1MB · jpeg เท่านั้น');

const ins = (uid, name) => as(uid, `insert into storage.objects (bucket_id, name, owner) values ('task-files', $1, auth.uid())`, [name]);
ok(!(await ins(U1, `${U1}/fa.jpg`)).error, 'เจ้าของอัปโหลดลงโฟลเดอร์ตัวเองได้');
ok(!!(await ins(U2, `${U1}/fx.jpg`)).error, 'อัปโหลดลงโฟลเดอร์คนอื่นไม่ได้');

const cnt = async uid => {
  const r = await as(uid, `select count(*)::int as n from storage.objects where bucket_id = 'task-files' and name like $1`, [`${U1}/%`]);
  return r.error ? -1 : r.rows[0].n;
};
ok(await cnt(U2) === 0 && await cnt(U1) === 1, 'คนอื่นอ่านไม่เห็น');
ok(await cnt(null) === 0, 'ไม่ล็อกอินอ่านไม่เห็น');

const del = async uid => { const r = await as(uid, `delete from storage.objects where bucket_id = 'task-files' and name = $1`, [`${U1}/fa.jpg`]); return r.error ? -1 : r.affectedRows; };
const upd = async uid => { await ins(U1, `${U1}/fb.jpg`); const r = await as(uid, `update storage.objects set name = $2 where bucket_id = 'task-files' and name = $1`, [`${U1}/fb.jpg`, `${U1}/fz.jpg`]); return r.error ? -1 : r.affectedRows; };
const d2 = await del(U2), d1 = await del(U1);
ok(d2 === 0 && d1 === 1, 'คนอื่นลบไม่ได้ · เจ้าของลบได้');
ok((await upd(U1)) <= 0, 'แก้ไฟล์ไม่ได้ (ไม่มี policy update)');

let again = null;
try { await db.exec(fs.readFileSync(MIG, 'utf8')); } catch (e) { again = e.message; }
ok(again === null, 'รัน migration ซ้ำได้');

console.log(`\nbucket task-files: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
