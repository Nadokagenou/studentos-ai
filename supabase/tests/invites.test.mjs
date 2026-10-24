// ============================================================
// ลิงก์เชิญเพื่อน (claim_invite · my_invite_count) — ภารกิจปลดล็อกธีม Halloween ข้อ 1 · 24 ต.ค. 69
// ------------------------------------------------------------
// ยอดชวนต้องปลอมไม่ได้: นับเฉพาะบัญชีใหม่จริง · บัญชีหนึ่งนับครั้งเดียว · ชวนตัวเองไม่ได้ · อ่านตารางตรงไม่ได้
// วิธีรัน: เหมือน push_claim.test.mjs
//   npm install --prefix <โฟลเดอร์ชั่วคราว> @electric-sql/pglite@0.2.17
//   node supabase/tests/invites.test.mjs <โฟลเดอร์ชั่วคราว>/node_modules/@electric-sql/pglite/dist/index.js
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = process.argv[2];
if (!lib) { console.error('ต้องส่ง path ของ pglite/dist/index.js มาด้วย (ดูหัวไฟล์)'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(lib).href);
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, created_at timestamptz not null default now());
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);
await db.exec(fs.readFileSync(path.join(here, '..', 'migrations', '20261024120000_invites.sql'), 'utf8'));

const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const INV = id(1), OLD = id(2);
await db.exec(`insert into auth.users (id, created_at) values
  ('${INV}', '2026-09-01'), ('${OLD}', '2026-09-01');
  insert into auth.users (id) select ('00000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid from generate_series(10, 15) g;`);

async function as(uid, sql, params = []) {
  await db.exec(uid ? `set role authenticated` : `set role anon`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
  try { return await db.query(sql, params); }
  catch (e) { return { error: e.message, code: e.code }; }
  finally { await db.exec('reset role'); }
}
const claim = async (uid, code) => (await as(uid, 'select public.claim_invite($1) as r', [code])).rows?.[0]?.r;
const count = async uid => (await as(uid, 'select public.my_invite_count() as n')).rows?.[0]?.n;

const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

check('ยังไม่มีใครสมัคร → ยอด 0', await count(INV) === 0);
check('เพื่อนใหม่กดลิงก์ → ok', await claim(id(10), INV) === 'ok');
check('ยอดคนชวน = 1', await count(INV) === 1);
check('กดซ้ำ → already (ไม่นับซ้ำ)', await claim(id(10), INV) === 'already');
check('เปลี่ยนไปกดลิงก์อีกคน → already (คนแรกได้ไป)', await claim(id(10), OLD) === 'already');
check('ยอดยังเป็น 1', await count(INV) === 1);
check('ชวนตัวเอง → self', await claim(INV, INV) === 'self');
check('บัญชีเก่า (สมัครก่อนเปิดภารกิจ) → old', await claim(OLD, INV) === 'old');
await db.exec(`update auth.users set created_at = now() - interval '8 days' where id = '${id(11)}'`);
check('บัญชีสมัครเกิน 7 วัน → old', await claim(id(11), INV) === 'old');
check('รหัสไม่ใช่ uuid → bad', await claim(id(12), "x'; drop table invites; --") === 'bad');
check('uuid ที่ไม่มีบัญชี → bad', await claim(id(12), id(999)) === 'bad');
check('ยังไม่ล็อกอิน → เรียกไม่ได้', !!(await as(null, 'select public.claim_invite($1)', [INV])).error);
check('ยังไม่ล็อกอิน → ถามยอดไม่ได้', !!(await as(null, 'select public.my_invite_count()')).error);
await claim(id(12), INV); await claim(id(13), INV);
check('ครบ 3 คน → ยอด 3', await count(INV) === 3);
check('คนอื่นอ่านตาราง invites ตรงไม่ได้', !!(await as(id(14), 'select * from public.invites')).error);
check('เขียนตาราง invites ตรงไม่ได้', !!(await as(id(14), `insert into public.invites values ('${id(14)}', '${OLD}')`)).error);
check('ยอดของบัญชีอื่นไม่ปนกัน', await count(OLD) === 0);

let pass = 0;
for (const r of results) { console.log((r.pass ? 'ผ่าน ' : 'ตก   ') + r.name + (r.pass || !r.detail ? '' : ' · ' + r.detail)); if (r.pass) pass++; }
console.log(`\n${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
