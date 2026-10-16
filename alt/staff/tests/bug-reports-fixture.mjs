import { PGlite } from '../backend/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
export const reporter = '11111111-1111-4111-8111-111111111111';
export const other = '22222222-2222-4222-8222-222222222222';
export const staff = '33333333-3333-4333-8333-333333333333';
export const bugMigration = new URL('../backend/supabase/migrations/20261016030041_studentos_bug_reports.sql', import.meta.url);
export async function createBugDB() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated,service_role;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
    create table public.user_state(id uuid primary key references auth.users on delete cascade,data jsonb not null,updated_at timestamptz default now());
    create table public.profiles(id uuid primary key,display_name text,handle text);
    create table public.reports(id bigint primary key,kind text,reason text,note text,created_at timestamptz default now());
    create table public.push_subscriptions(user_id uuid,endpoint text);
    insert into auth.users values('${reporter}'),('${other}'),('${staff}');
    insert into user_state values('${reporter}','{"tasks":[{"id":"keep"}],"vault":{"tokens":{"bal":20}}}',now());
    insert into reports values(1,'user','spam','existing content report',now());`);
  await db.exec(await readFile(new URL('../backend/migration.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(bugMigration, 'utf8'));
  return db;
}
export async function asUser(db, uid, callback, role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid || '']);
  await db.exec('set role ' + role);
  try { return await callback(); }
  finally { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
export async function rpc(db, name, args) {
  const placeholders = args.map((_, i) => '$' + (i + 1)).join(',');
  return (await db.query(`select public.${name}(${placeholders}) r`, args)).rows[0].r;
}
export const sample = {
  category: 'tasks', page: 'งานของฉัน', summary: 'กดงานแล้วหน้าจอว่าง',
  detail: 'แตะการ์ดงานแล้วไม่มีรายละเอียดขึ้นมา', steps: 'เปิดงานของฉัน แล้วแตะการ์ดงาน', expected: 'เปิดรายละเอียดของงาน', diagnostics: null,
};
