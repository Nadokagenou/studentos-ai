// ============================================================
// เทสต์ของ do_at_due — ตัวคัด "นัดที่ตั้งเอง" (t.doAt) ในฐานข้อมูล แทนการลากรายการงานทั้งก้อน
// ------------------------------------------------------------
// รันกับ Postgres จริง (PGlite) ด้วย migration ตัวจริงของ repo · บทบาท anon/authenticated แบบ Supabase
// วิธีรัน (เหมือน push_claim.test.mjs):
//   npm install --prefix <โฟลเดอร์ชั่วคราว> @electric-sql/pglite@0.2.17
//   node supabase/tests/do_at_due.test.mjs <โฟลเดอร์ชั่วคราว>/node_modules/@electric-sql/pglite/dist/index.js
//
// ที่ต้องพิสูจน์: คืนเฉพาะงานที่ doAt อยู่ในช่วง · ค่า doAt แปลก ๆ (null · ข้อความเพี้ยน · ตัวเลข)
// ไม่ทำให้ทั้งคิวรีล้ม · คนที่ไม่มีนัดในช่วงไม่ได้แถวกลับมาเลย · เบราว์เซอร์เรียกไม่ได้
// (ฟังก์ชันอ่าน user_state ของทุกคนข้าม RLS — ถ้าเรียกจาก anon/authenticated ได้ คืองานของคนอื่นรั่ว)
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mig = f => fs.readFileSync(path.join(here, '..', 'migrations', f), 'utf8');
const DUE = '20261029120000_do_at_due.sql';

const lib = process.argv[2];
if (!lib) { console.error('ต้องส่ง path ของ pglite/dist/index.js มาด้วย (ดูหัวไฟล์)'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(lib).href);
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
`);
await db.exec(mig('20260823120000_user_state.sql'));
await db.exec(`grant all on public.user_state to anon, authenticated, service_role;`);
await db.exec(mig(DUE));

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${C}');`);

const NOW = Date.parse('2026-10-29T13:00:00.000Z');   // 20:00 ไทย
const iso = ms => new Date(ms).toISOString();
const MIN = 60_000;
const put = (id, data) => db.query('insert into public.user_state (id, data) values ($1, $2)', [id, JSON.stringify(data)]);

const big = 'ก'.repeat(3000);   // งานทั่วไปที่มีรายละเอียดยาว — ตัวที่ทำให้การลากทั้งก้อนแพง
await put(A, {
  settings: { notifOff: false, theme: 'halloween', other: big },
  tasks: [
    { id: 'now', title: 'ทำการบ้าน', doAt: iso(NOW) },
    { id: 'soon', title: 'อ่านหนังสือ', doAt: iso(NOW + 30 * MIN) },
    { id: 'later', title: 'พรุ่งนี้', doAt: iso(NOW + 24 * 60 * MIN) },
    { id: 'old', title: 'เมื่อวาน', doAt: iso(NOW - 24 * 60 * MIN) },
    { id: 'plain', title: 'งานไม่มีนัด', detail: big },
    { id: 'nullat', title: 'ล้างนัดแล้ว', doAt: null },
    { id: 'junk', title: 'ค่าเพี้ยน', doAt: 'พรุ่งนี้เช้า' },
    { id: 'num', title: 'ตัวเลข', doAt: 12345 },
    { id: 'baddate', title: 'วันที่ไม่มีจริง', doAt: '2026-13-45T99:00:00.000Z' },
    'ไม่ใช่ออบเจ็กต์',
  ],
});
await put(B, { settings: { notifOff: true }, tasks: [{ id: 'b1', title: 'ของ B', doAt: iso(NOW) }] });
await put(C, { settings: {}, tasks: [{ id: 'c1', title: 'ไม่มีนัดในช่วง', doAt: iso(NOW + 5 * 24 * 60 * MIN) }] });

const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

async function as(role, sql, params = []) {
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); }
  catch (e) { return { error: e.message, code: e.code }; }
  finally { await db.exec('reset role'); }
}
const call = (role, ids, from, to) => as(role,
  'select id, tasks, settings from public.do_at_due($1::uuid[], $2::timestamptz, $3::timestamptz) order by id',
  [`{${ids.join(',')}}`, iso(from), iso(to)]);

// ---- 1) คัดตามช่วงเวลา ----
{
  const r = await call('service_role', [A, B, C], NOW - 30 * MIN, NOW + 60 * MIN);
  check('service_role เรียกได้', !r.error, JSON.stringify(r));
  const rows = r.rows || [];
  const a = rows.find(x => x.id === A);
  const ids = (a?.tasks || []).map(t => t.id).sort();
  check('คืนเฉพาะงานที่ doAt อยู่ในช่วง', JSON.stringify(ids) === JSON.stringify(['now', 'soon']), JSON.stringify(ids));
  check('ค่า doAt เพี้ยน (null · ข้อความ · ตัวเลข · วันที่ไม่มีจริง) ไม่ทำให้คิวรีล้ม และไม่ถูกคืน', !r.error && !ids.some(i => ['nullat', 'junk', 'num', 'baddate'].includes(i)), JSON.stringify(ids));
  check('งานที่คืนมาครบทั้งใบ (ตัวกรองในโค้ดยังต้องเห็น done/doAtShown/estMin)', a?.tasks?.find(t => t.id === 'now')?.title === 'ทำการบ้าน', JSON.stringify(a?.tasks));
  check('settings เหลือแค่ notifOff — ไม่ลากทั้งก้อน', a && JSON.stringify(a.settings) === '{"notifOff":false}', JSON.stringify(a?.settings));
  check('notifOff ส่งกลับมาให้โค้ดตัดสินเหมือนเดิม', rows.find(x => x.id === B)?.settings?.notifOff === true, JSON.stringify(rows.find(x => x.id === B)));
  check('คนที่ไม่มีนัดในช่วง → ไม่ได้แถวกลับมาเลย', !rows.some(x => x.id === C), JSON.stringify(rows.map(x => x.id)));
  const bytes = JSON.stringify(rows).length;
  const full = JSON.stringify((await db.query(`select data->'tasks' t, data->'settings' s from public.user_state`)).rows).length;
  check('ขนาดที่คืน เล็กกว่าการลากทั้งก้อนมาก', bytes * 10 < full, `${bytes} vs ${full}`);
}

// ---- 2) ส่ง id มาเท่าไหร่ ได้เท่านั้น ----
{
  const r = await call('service_role', [B], NOW - 30 * MIN, NOW + 60 * MIN);
  check('อ่านเฉพาะ id ที่ส่งมา', (r.rows || []).length === 1 && r.rows[0].id === B, JSON.stringify(r));
  const r2 = await call('service_role', [], NOW - 30 * MIN, NOW + 60 * MIN);
  check('ไม่ส่ง id มาเลย → ว่าง ไม่ใช่ทุกคน', !r2.error && r2.rows.length === 0, JSON.stringify(r2));
}

// ---- 3) แถวที่ tasks ไม่ใช่อาร์เรย์ ต้องไม่ทำให้รอบของคนอื่นล้ม ----
{
  const D = '00000000-0000-0000-0000-00000000000d';
  await db.exec(`insert into auth.users values ('${D}');`);
  await put(D, { tasks: { broken: true } });
  const r = await call('service_role', [A, D], NOW - 30 * MIN, NOW + 60 * MIN);
  check('tasks เพี้ยนในแถวหนึ่ง → แถวอื่นยังได้ผล', !r.error && r.rows.some(x => x.id === A), JSON.stringify(r));
}

// ---- 4) เบราว์เซอร์เรียกไม่ได้ ----
{
  const r1 = await call('anon', [A], NOW - 30 * MIN, NOW + 60 * MIN);
  check('anon เรียกไม่ได้', !!r1.error, JSON.stringify(r1));
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [B]);
  const r2 = await call('authenticated', [A], NOW - 30 * MIN, NOW + 60 * MIN);
  check('authenticated (ผู้ใช้คนอื่น) เรียกไม่ได้ — กันงานของ A รั่ว', !!r2.error, JSON.stringify(r2));
}

for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
const pass = results.filter(r => r.pass).length;
console.log(`\n${pass}/${results.length} ผ่าน`);
process.exit(pass === results.length ? 0 : 1);
