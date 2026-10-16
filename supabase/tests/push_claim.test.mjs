// ============================================================
// เทสต์ของ claim_push_subscription — เครื่องที่สลับบัญชีต้องย้ายสิทธิ์รับแจ้งเตือนตามไปได้
// ------------------------------------------------------------
// รันกับ Postgres จริง (PGlite · WASM ในเครื่อง ไม่ต่อ Supabase) ไม่ใช่ตัวจำลอง
// เพราะบั๊กอยู่ที่ RLS ซึ่งตัวจำลองตอบไม่ได้ว่า Postgres จะยอมหรือไม่ยอม
//
// วิธีรัน (repo ไม่มี npm — ติดตั้ง PGlite ไว้นอก repo แล้วส่ง path เข้ามา):
//   npm install --prefix <โฟลเดอร์ชั่วคราว> @electric-sql/pglite@0.2.17
//   node supabase/tests/push_claim.test.mjs <โฟลเดอร์ชั่วคราว>/node_modules/@electric-sql/pglite/dist/index.js
//
// ข้อมูลจริงที่ทำให้ต้องมีไฟล์นี้ (16 ต.ค. 69): คอมเครื่องหนึ่งล็อกอินบัญชี nad*** อยู่
// แต่แถว subscription ของมันเป็นของบัญชี pon*** (สมัครไว้ตอนล็อกอินบัญชีนั้น 14 ต.ค.)
// แอปรายงาน "บันทึกขึ้นเซิร์ฟเวอร์ไม่ได้" — upsert ของบัญชีใหม่ชน RLS ของแถวบัญชีเก่า
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mig = f => fs.readFileSync(path.join(here, '..', 'migrations', f), 'utf8');
const CLAIM = '20261016130000_claim_push_subscription.sql';

const lib = process.argv[2];
if (!lib) { console.error('ต้องส่ง path ของ pglite/dist/index.js มาด้วย (ดูหัวไฟล์)'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(lib).href);
const db = new PGlite();

// ---------- โครงแบบ Supabase เท่าที่ตารางนี้ใช้ ----------
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
await db.exec(mig('20260823120100_push_subscriptions.sql'));
// สิทธิ์ตารางตรงกับ production (อ่านจาก information_schema 16 ต.ค. 69) — RLS เป็นด่านเดียว
await db.exec(`grant all on public.push_subscriptions to anon, authenticated;`);
const hasClaim = fs.existsSync(path.join(here, '..', 'migrations', CLAIM));
if (hasClaim) await db.exec(mig(CLAIM));

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);

/** รันในนามผู้ใช้หนึ่งคน (uid = null คือ anon) แล้วคืนผล หรือ { error } */
async function as(uid, sql, params = []) {
  await db.exec(uid ? `set role authenticated` : `set role anon`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
  try { return await db.query(sql, params); }
  catch (e) { return { error: e.message, code: e.code }; }
  finally { await db.exec('reset role'); }
}
const owner = async ep => (await db.query('select user_id, p256dh, auth, last_sent_at from push_subscriptions where endpoint = $1', [ep])).rows[0];
const claim = (uid, ep, p, a) => as(uid, 'select public.claim_push_subscription($1, $2, $3, 420) as r', [ep, p, a]);

const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });
const EP = 'https://fcm.googleapis.com/fcm/send/device-1';

// ---- 0) อาการจริง: upsert ของบัญชีใหม่บนแถวที่บัญชีเก่าถืออยู่ ชน RLS ----
// (เทสต์นี้บอกว่า "ทำไมต้องมีฟังก์ชัน" — ผ่านทั้งก่อนและหลังแก้ เพราะ RLS ต้องยังกันอยู่)
{
  await as(A, `insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ($1, $2, 'P1', 'S1')`, [EP, A]);
  const r = await as(B, `insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ($1, $2, 'P1', 'S1')
                         on conflict (endpoint) do update set user_id = excluded.user_id`, [EP, B]);
  check('upsert ตรงของบัญชีใหม่ → ถูก RLS ปฏิเสธ (อาการบน production)', !!r.error, JSON.stringify(r));
  check('แถวยังเป็นของบัญชีเก่า', (await owner(EP))?.user_id === A, JSON.stringify(await owner(EP)));
}

// ---- 1) เครื่องเดิม สลับไปบัญชี B · ถือกุญแจชุดเดียวกัน → ย้ายเจ้าของ ----
{
  await db.query(`update push_subscriptions set last_sent_at = now() where endpoint = $1`, [EP]);
  const r = await claim(B, EP, 'P1', 'S1');
  check('สลับบัญชี → ฟังก์ชันตอบ moved', r.rows?.[0]?.r === 'moved', JSON.stringify(r));
  const o = await owner(EP);
  check('สลับบัญชี → แถวเป็นของบัญชีใหม่', o?.user_id === B, JSON.stringify(o));
  check('สลับบัญชี → ล้างนาฬิกาช่วงเงียบของบัญชีเก่า (last_sent_at)', o?.last_sent_at === null, JSON.stringify(o));
  const seenByA = await as(A, 'select count(*)::int n from push_subscriptions where endpoint = $1', [EP]);
  check('บัญชีเก่ามองไม่เห็นแถวนี้แล้ว (แจ้งเตือนของเขาไม่ไปเครื่องนี้อีก)', seenByA.rows?.[0]?.n === 0, JSON.stringify(seenByA));
}

// ---- 2) มีแค่ endpoint แต่ไม่มีกุญแจของเบราว์เซอร์ → ห้ามยึด ----
// endpoint ไม่ใช่ความลับที่แข็งพอ · p256dh + auth มีแต่เบราว์เซอร์ที่ถือ subscription จริงเท่านั้นที่รู้
{
  const r = await claim(A, EP, 'P1', 'WRONG');
  check('กุญแจไม่ตรง → ปฏิเสธ', !!r.error, JSON.stringify(r));
  check('กุญแจไม่ตรง → เจ้าของไม่เปลี่ยน', (await owner(EP))?.user_id === B, JSON.stringify(await owner(EP)));
}

// ---- 3) เครื่องใหม่ · เจ้าของเดิมต่ออายุ ----
{
  const EP2 = 'https://web.push.apple.com/device-2';
  const r1 = await claim(A, EP2, 'P2', 'S2');
  check('endpoint ใหม่ → created', r1.rows?.[0]?.r === 'created' && (await owner(EP2))?.user_id === A, JSON.stringify(r1));
  const r2 = await claim(A, EP2, 'P2b', 'S2b');
  const o = await owner(EP2);
  check('เจ้าของเดิมต่ออายุ → refreshed และอัปเดตกุญแจ', r2.rows?.[0]?.r === 'refreshed' && o?.p256dh === 'P2b' && o?.auth === 'S2b', JSON.stringify([r2, o]));
}

// ---- 4) ด่านที่ต้องไม่หลุด ----
{
  const r = await claim(null, 'https://fcm.googleapis.com/fcm/send/device-3', 'P', 'S');
  check('ไม่ได้ล็อกอิน → ปฏิเสธ', !!r.error, JSON.stringify(r));
  const r2 = await claim(A, 'http://evil.example/x', 'P', 'S');
  check('endpoint ไม่ใช่ https → ปฏิเสธ', !!r2.error, JSON.stringify(r2));
  const r3 = await claim(A, 'https://fcm.googleapis.com/fcm/send/device-4', '', '');
  check('กุญแจว่าง → ปฏิเสธ', !!r3.error, JSON.stringify(r3));
  const n = (await db.query(`select count(*)::int n from push_subscriptions where endpoint like '%device-3' or endpoint like '%device-4' or endpoint like 'http://%'`)).rows[0].n;
  check('ด่านที่ปฏิเสธ → ไม่มีแถวหลุดเข้าไป', n === 0, n);
}

// ---- 5) บัญชีใหม่ที่ได้แถวไปแล้ว ถอนได้เองด้วย RLS เดิม (ทางออกจากระบบ) ----
{
  const r = await as(B, 'delete from push_subscriptions where endpoint = $1 returning endpoint', [EP]);
  check('เจ้าของใหม่ลบแถวของเครื่องตัวเองได้', r.rows?.length === 1, JSON.stringify(r));
}

const pass = results.filter(r => r.pass).length;
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
console.log(`\n${pass}/${results.length} ผ่าน${hasClaim ? '' : '   (ยังไม่มีไฟล์ migration ' + CLAIM + ')'}`);
process.exit(pass === results.length ? 0 : 1);
