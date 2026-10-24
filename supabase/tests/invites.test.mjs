// ============================================================
// เทสต์ของรหัสเชิญเพื่อน (my_invite · redeem_invite) — ภารกิจปลดธีม Halloween ข้อ 1
// ------------------------------------------------------------
// รันกับ Postgres จริง (PGlite) ด้วย migration ตัวจริงของ repo · บทบาท anon/authenticated แบบ Supabase
// วิธีรัน (เหมือน push_claim.test.mjs):
//   npm install --prefix <โฟลเดอร์ชั่วคราว> @electric-sql/pglite@0.2.17
//   node supabase/tests/invites.test.mjs <โฟลเดอร์ชั่วคราว>/node_modules/@electric-sql/pglite/dist/index.js
//
// ที่ต้องพิสูจน์: จำนวน "เพื่อนที่ชวนมาได้" ปลอมไม่ได้จากเบราว์เซอร์ · บัญชีหนึ่งนับได้ครั้งเดียว
// · ใช้รหัสตัวเอง/บัญชีเก่า/คนที่บล็อกกันไม่ได้ · รหัสเต็มแล้วรับเพิ่มไม่ได้
// · คนที่เคยใช้แอปมาก่อนสมัคร (funnel.firstOpen เก่ากว่าวันสมัคร) ไม่นับ — ต้องเป็นคนที่ไม่เคยใช้
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

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, created_at timestamptz not null default now());
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
// ตารางที่ redeem_invite แตะ: profiles + blocks (+ is_blocked) จาก migration social, friendships จาก friends
// social ทั้งไฟล์ลากตาราง LINE มาด้วย จึงตัดเอาเฉพาะช่วง profiles..is_blocked
{
  const s = mig('20260829120000_social.sql');
  const from = s.indexOf('create table if not exists public.profiles');
  const to = s.indexOf('grant execute on function public.is_blocked(uuid, uuid) to authenticated;');
  await db.exec(`create table public.line_links (user_id uuid, room_id text, primary key (user_id, room_id));`);
  await db.exec(s.slice(from, to) + 'grant execute on function public.is_blocked(uuid, uuid) to authenticated;');
}
await db.exec(mig('20260823120000_user_state.sql'));
await db.exec(mig('20260830170000_friends.sql'));
await db.exec(mig('20260903120000_friend_handles.sql').split('-- ============================================================\n-- ค้นหาคน')[0]);
await db.exec(mig('20261023150000_invites.sql'));
// สิทธิ์ตารางแบบ Supabase (grant all ให้ทุกบทบาท) — RLS ต้องเป็นด่านเดียวที่กัน
await db.exec(`grant all on all tables in schema public to anon, authenticated;`);

const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const [A, B, C, D, E, F, G, H, OLD, BAD, X] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(U);
await db.exec(`insert into auth.users (id) values ${[A, B, C, D, E, F, G, H, BAD, X].map(u => `('${u}')`).join(',')};
               insert into auth.users (id, created_at) values ('${OLD}', now() - interval '30 days');
               insert into public.profiles (id, display_name, handle) values ('${B}', 'บีม', 'beam');`);

async function as(uid, sql, params = []) {
  await db.exec(uid ? `set role authenticated` : `set role anon`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
  try { return await db.query(sql, params); }
  catch (e) { return { error: e.message, code: e.code }; }
  finally { await db.exec('reset role'); }
}
const myInvite = async uid => (await as(uid, 'select * from public.my_invite()')).rows?.[0];
const redeem = async (uid, code) => {
  const r = await as(uid, 'select public.redeem_invite($1) as r', [code]);
  return r.error ? 'ERROR ' + r.error : r.rows[0].r;
};

const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

// ---- 1) รหัสของฉัน ----
const a = await myInvite(A);
check('my_invite สร้างรหัสสามคำ', /^[A-Z]+-[A-Z]+-[A-Z]+$/.test(a?.code || ''), JSON.stringify(a));
check('ใช้ได้ 6 คน · ยังไม่มีใครใช้', a?.max_uses === 6 && a?.used === 0, JSON.stringify(a));
check('เรียกซ้ำได้รหัสเดิม', (await myInvite(A))?.code === a?.code);
check('anon เรียก my_invite ไม่ได้', !!(await as(null, 'select * from public.my_invite()')).error);
const code = a.code;

// ---- 2) ใช้รหัส ----
check('ใช้รหัสตัวเอง → self', (await redeem(A, code)) === 'self');
check('รหัสไม่มีอยู่ → not_found', (await redeem(B, 'NOPE-NOPE-NOPE')) === 'not_found');
check('ช่องว่าง → not_found', (await redeem(B, '')) === 'not_found');
check('ตัวเล็ก/ไม่มีขีด/เว้นวรรคก็ใช้ได้ → ok', (await redeem(B, ' ' + code.toLowerCase().replace(/-/g, ' ') + ' ')) === 'ok');
check('บัญชีเดิมใช้ซ้ำ → already', (await redeem(B, code)) === 'already');
const b = await myInvite(B);
check('ถูกชวนแล้วไปใช้รหัสคนอื่นต่อ → already', (await redeem(B, (await myInvite(C)).code)) === 'already');
check('บัญชีเก่าเกิน 7 วัน → not_new', (await redeem(OLD, code)) === 'not_new');
await db.exec(`insert into public.blocks (blocker, blocked) values ('${A}', '${BAD}')`);
check('บล็อกกันอยู่ → blocked', (await redeem(BAD, code)) === 'blocked');
check('anon ใช้รหัสไม่ได้', !!(await as(null, 'select public.redeem_invite($1)', [code])).error);

// ---- 2b) ไม่เคยใช้มาก่อน = ดูวันแรกที่เปิดแอป (funnel.firstOpen ใน user_state) ----
{
  const [P, Q, R, S, W] = [21, 22, 23, 24, 25].map(U);
  await db.exec(`insert into auth.users (id) values ('${P}'), ('${Q}'), ('${R}'), ('${S}'), ('${W}');
    insert into public.user_state (id, data) values
      ('${P}', jsonb_build_object('funnel', jsonb_build_object('firstOpen', to_char((now() - interval '20 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))),
      ('${Q}', jsonb_build_object('funnel', jsonb_build_object('firstOpen', to_char((now() - interval '3 hours') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))),
      ('${R}', '{"funnel":{"firstOpen":"ไม่ใช่วันที่"}}'::jsonb);`);
  const code2 = (await myInvite(W)).code;
  check('บัญชีใหม่แต่เปิดแอปมา 20 วันก่อนสมัคร (เคยใช้แล้ว) → not_new', (await redeem(P, code2)) === 'not_new');
  check('เปิดแอปครั้งแรก 3 ชม.ก่อนสมัคร (กดลิงก์แล้วลองก่อน) → ok', (await redeem(Q, code2)) === 'ok');
  check('firstOpen อ่านไม่ออก → ไม่ล้ม · ok', (await redeem(R, code2)) === 'ok');
  check('ยังไม่มี user_state เลย (เพิ่งสมัคร) → ok', (await redeem(S, code2)) === 'ok');
}

// ---- 3) เป็นเพื่อนกันทันที ----
{
  const r = await as(B, 'select public.friend_state($1) as s', [A]);
  check('ใช้รหัสแล้วเป็นเพื่อนกันทันที', r.rows?.[0]?.s === 'friends', JSON.stringify(r));
  check('my_invite ของ B บอกว่าใครชวนมา', b?.invited_by && 'name' in b.invited_by, JSON.stringify(b));
}
{
  // มีคำขอค้างอยู่ก่อนแล้ว → ใช้รหัสแล้วกลายเป็นเพื่อน ไม่ชนคีย์
  await db.exec(`insert into public.friendships (a, b, asked_by) values (least('${A}'::uuid, '${C}'::uuid), greatest('${A}'::uuid, '${C}'::uuid), '${C}')`);
  check('มีคำขอค้าง → ok', (await redeem(C, code)) === 'ok');
  const r = await as(C, 'select public.friend_state($1) as s', [A]);
  check('คำขอค้างกลายเป็นเพื่อน', r.rows?.[0]?.s === 'friends', JSON.stringify(r));
}

// ---- 4) นับ + เต็ม ----
for (const u of [D, E, F, G]) await redeem(u, code);
const full = await myInvite(A);
check('ใช้ไป 6 คน (B C D E F G)', full?.used === 6, JSON.stringify(full));
check('รายชื่อเพื่อนที่ชวนมาครบ 6 · ชื่อของ B มา', full?.friends?.length === 6 && full.friends[0].name === 'บีม', JSON.stringify(full?.friends));
check('คนที่ 7 → full', (await redeem(H, code)) === 'full');

// ---- 5) ปลอมจากเบราว์เซอร์ไม่ได้ ----
{
  const r1 = await as(X, `insert into public.invite_redemptions (invitee, inviter) values ($1, $2)`, [X, A]);
  check('เขียน invite_redemptions ตรง → ถูกปฏิเสธ', !!r1.error, JSON.stringify(r1));
  const r2 = await as(A, `update public.invite_codes set max_uses = 50 where owner = $1`, [A]);
  check('แก้ max_uses ตรง → ไม่มีแถวเปลี่ยน', (await myInvite(A)).max_uses === 6, JSON.stringify(r2));
  const r3 = await as(X, `select * from public.invite_codes`);
  check('อ่านรหัสของคนอื่นไม่ได้ (เห็นแค่ของตัวเอง)', r3.rows?.every(x => x.owner === X), JSON.stringify(r3));
  const r4 = await as(X, `select * from public.invite_redemptions`);
  check('อ่านรายการชวนของคนอื่นไม่ได้', r4.rows?.length === 0, JSON.stringify(r4));
}

// ---- 6) รหัสไม่ชนกัน (สุ่มหลายร้อยบัญชี) ----
{
  const ids = Array.from({ length: 300 }, (_, i) => U(1000 + i));
  await db.exec(`insert into auth.users (id) values ${ids.map(u => `('${u}')`).join(',')}`);
  const codes = [];
  for (const u of ids) codes.push((await myInvite(u)).code);
  check('300 บัญชีได้รหัสไม่ซ้ำกัน', new Set(codes.map(c => c.replace(/-/g, ''))).size === 300);
}

const pass = results.filter(r => r.pass).length;
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
console.log(`\n${pass}/${results.length} ผ่าน`);
process.exit(pass === results.length ? 0 : 1);
