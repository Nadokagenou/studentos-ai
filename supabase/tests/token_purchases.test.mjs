// ============================================================
// เทสต์ของการเติมโทเคนด้วยเงินจริง (migration 20261030120000_token_purchases.sql)
// ------------------------------------------------------------
// รันกับ Postgres จริง (PGlite) โดยใช้ตัวฟังก์ชันคลังโทเคนจาก migration เดิมของ repo
// วิธีรัน (เหมือน invites.test.mjs):
//   npm install --prefix <โฟลเดอร์ชั่วคราว> @electric-sql/pglite@0.2.17
//   node supabase/tests/token_purchases.test.mjs <โฟลเดอร์ชั่วคราว>/node_modules/@electric-sql/pglite/dist/index.js
//
// ที่ต้องพิสูจน์: ก่อน migration คลังไม่รู้จักโทเคนที่ซื้อ (commit ปฏิเสธ) · หลัง migration ทั้งสามที่
// ที่อ่านยอดจากนอกเกมได้เลขเดียวกัน = แจก + ซื้อ · ผู้ใช้อ่านได้แค่ใบเสร็จตัวเอง เขียนเองไม่ได้
// · ใบเสร็จเลขเดิมเข้าซ้ำไม่ได้ · รัน migration ซ้ำได้โดยไม่พัง
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mig = f => fs.readFileSync(path.join(here, '..', 'migrations', f), 'utf8');
const lib = process.argv[2];
if (!lib) { console.error('ต้องส่ง path ของ pglite/dist/index.js มาด้วย (ดูหัวไฟล์)'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(lib).href);
const db = new PGlite();

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } };
const rejects = async (fn, name) => { try { await fn(); ok(false, name); } catch (_) { ok(true, name); } };

// ตัดบล็อกจาก migration เดิม: ส่วนสร้างตาราง (บรรทัด 1–16) กับฟังก์ชันสามตัวที่อ่านยอด
const old = mig('20261026140834_prepare_secure_account_economy.sql').split(/\r?\n/);
const block = (startRe, endRe) => {
  const a = old.findIndex(l => startRe.test(l));
  const b = old.findIndex((l, i) => i >= a && endRe.test(l));
  if (a < 0 || b < 0) throw Error('หาบล็อกไม่เจอ: ' + startRe);
  return old.slice(a, b + 1).join('\n');
};
const tables = old.slice(0, 16).join('\n');
const staffFn = block(/^create function public\.studentos_economy_staff/, /^\$\$;/);
const guardFn = block(/^create function studentos_economy_private\.protect_economy/, /^end \$\$;/);
const commitFn = block(/^create function public\.studentos_economy_commit/, /^end \$\$;/);

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  create table public.user_state (id uuid primary key, data jsonb not null default '{}');
  create table public.staff_token_grants (id uuid primary key default gen_random_uuid(), target uuid not null, amount integer not null);
  create table public.staff_token_debits (id uuid primary key default gen_random_uuid(), target uuid not null, amount integer not null);
  create function public._board_key(t text) returns text language sql immutable as $$ select t $$;
`);
await db.exec(tables);
await db.exec('set check_function_bodies = off;\n' + staffFn + '\n' + guardFn + '\n' + commitFn + '\nset check_function_bodies = on;');

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
await db.exec(`
  insert into auth.users values ('${A}'), ('${B}');
  insert into public.user_state(id) values ('${A}'), ('${B}');
  update public.studentos_economy_release set active = true;
  insert into public.staff_token_grants(target, amount) values ('${A}', 30);
`);

// commit หนึ่งครั้งที่บอกว่า "โทเคนจากนอกเกม" ของ A มี minted ก้อน
let rev = 0;
async function commit(minted) {
  const doc = { owner: A, version: 1, revision: rev + 1, vault: { tokens: { staffMinted: minted, staffDebited: 0 } } };
  await db.exec(`set request.jwt.claim.role = 'service_role'`);
  const r = await db.query(
    `select public.studentos_economy_commit($1, $2, gen_random_uuid(), '{"type":"read"}', $3, '{}') as x`,
    [A, rev, JSON.stringify(doc)]);
  await db.exec(`reset request.jwt.claim.role`);
  const x = r.rows[0].x;
  if (x.committed) rev++;
  return x.committed;
}
const staffOf = async u => (await db.query(`select public.studentos_economy_staff($1) as x`, [u])).rows[0].x;

console.log('ก่อน migration');
ok(await commit(30), 'commit ผ่านเมื่อยอดตรงกับของที่ทีมงานแจก');
ok(Number((await staffOf(A)).minted) === 30, 'อ่านยอด = 30');

console.log('ใส่ migration');
await db.exec(mig('20261030120000_token_purchases.sql'));
ok(true, 'migration รันผ่าน');

for (const fn of ['public.studentos_economy_staff(uuid)', 'studentos_economy_private.protect_economy()',
  'public.studentos_economy_commit(uuid,bigint,uuid,jsonb,jsonb,jsonb)']) {
  const d = (await db.query(`select pg_get_functiondef($1::regprocedure) as d`, [fn])).rows[0].d;
  ok(d.includes('studentos_economy_minted') && !d.includes('staff_token_grants'), fn + ' อ่านยอดผ่านตัวกลางตัวเดียว');
}

console.log('ซื้อ 100 โทเคน');
await db.exec(`insert into public.token_purchases(id, target, pack, tokens, amount_satang, currency)
  values ('cs_test_aaaaaaaa', '${A}', 'p19', 100, 1900, 'thb')`);
ok(Number((await staffOf(A)).minted) === 130, 'อ่านยอด = แจก 30 + ซื้อ 100');
ok(Number((await staffOf(B)).minted) === 0, 'บัญชีอื่นไม่ได้ด้วย');
ok(!(await commit(30)), 'commit ที่ยังไม่นับของที่ซื้อ ถูกปฏิเสธ');
ok(await commit(130), 'commit ที่นับของที่ซื้อแล้ว ผ่าน');
await rejects(() => db.exec(`insert into public.token_purchases(id, target, pack, tokens, amount_satang, currency)
  values ('cs_test_aaaaaaaa', '${A}', 'p19', 100, 1900, 'thb')`), 'ใบเสร็จเลขเดิมเข้าซ้ำไม่ได้');

console.log('สิทธิ์ของผู้ใช้');
await db.exec(`set role authenticated; set request.jwt.claim.sub = '${B}'`);
ok((await db.query(`select * from public.token_purchases`)).rows.length === 0, 'B มองไม่เห็นใบเสร็จของ A');
await db.exec(`set request.jwt.claim.sub = '${A}'`);
ok((await db.query(`select * from public.token_purchases`)).rows.length === 1, 'A เห็นใบเสร็จตัวเอง');
await rejects(() => db.exec(`insert into public.token_purchases(id, target, pack, tokens, amount_satang, currency)
  values ('cs_test_forged01', '${A}', 'p19', 99999, 1, 'thb')`), 'A เขียนใบเสร็จเองไม่ได้');
await rejects(() => db.query(`select public.studentos_economy_minted($1)`, [A]), 'A เรียกตัวนับยอดตรง ๆ ไม่ได้');
await db.exec(`reset role; reset request.jwt.claim.sub`);

console.log('รันซ้ำ');
await db.exec(mig('20261030120000_token_purchases.sql'));
ok(Number((await staffOf(A)).minted) === 130, 'รัน migration ซ้ำแล้วยอดยังเท่าเดิม');

console.log(`\n${pass}/${pass + fail} ผ่าน`);
process.exit(fail ? 1 : 0);
