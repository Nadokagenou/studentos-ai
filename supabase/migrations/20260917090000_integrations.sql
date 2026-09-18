-- ============================================================
-- 30 · integrations — งานจากแพลตฟอร์มอื่นไหลเข้ามาเอง ผ่าน API ทางการเท่านั้น
-- ------------------------------------------------------------
-- เส้นทางของงานหนึ่งชิ้นจากต้นทางถึงหน้าจอนักเรียน:
--
--   ต้นทาง (Classroom / ปฏิทิน ICS)
--     → integrations       ใครเชื่อมอะไรไว้ + กุญแจที่เข้ารหัสแล้ว
--     → integration_items  ทะเบียนว่าเคยเห็นงานชิ้นไหนมาแล้ว  ← ที่จับซ้ำอยู่ตรงนี้
--     → inbox_items        ท่อเดิมที่บอท LINE ใช้อยู่แล้ว ไม่ได้สร้างใหม่
--     → pullInbox() ฝั่งแอป → งานในแผน
--
-- ⚠️ ข้อห้ามข้อเดียวที่สำคัญที่สุดของไฟล์นี้:
--    **ห้ามให้ฝั่งเซิร์ฟเวอร์เขียนงานลง user_state.data ตรง ๆ เด็ดขาด**
--    ข้อมูลผู้ใช้ทั้งคนเป็น JSON ก้อนเดียว และแอปเป็นคน push ทับทั้งก้อนทุกครั้ง
--    ที่มีอะไรเปลี่ยน (app.js · pushToCloud) — เขียนแทรกจากฝั่งนี้เมื่อไหร่
--    งานที่เพิ่งใส่จะหายเงียบ ๆ ภายใน 1.5 วินาทีที่แอปซึ่งเปิดค้างอยู่บันทึกอะไรสักอย่าง
--    โดยไม่มี error ให้ใครเห็นสักตัว · ท่อ inbox_items เป็นตารางแยกจึงไม่มีปัญหานี้
--
-- ทำไมต้องมีตารางทะเบียน (integration_items) ทั้งที่ inbox มีตัวจับซ้ำอยู่แล้ว:
--   ตัวจับซ้ำฝั่งแอป (inbox.js · sameAssignment) เทียบจาก "ข้อความ" ซึ่งพอสำหรับ
--   ข้อความครูใน LINE แต่ใช้กับ API ไม่ได้ — API ให้ id ที่นิ่งมาด้วย และครูแก้งาน
--   ย้อนหลังได้ (เลื่อนกำหนดส่ง · แก้ชื่อ · ลบทิ้ง) ถ้าเทียบด้วยข้อความอย่างเดียว
--   การเลื่อนกำหนดส่งจะกลายเป็น "งานใหม่อีกใบ" ทุกครั้ง
-- ============================================================

-- ---------- การเชื่อมหนึ่งเส้น ----------
create table if not exists public.integrations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,

  -- 'google_classroom' · 'google_calendar' · 'ics' — ชื่อเดียวกับที่ฝั่งแอปใช้ใน SOURCES
  provider   text not null,

  -- ชื่อที่เอาไปโชว์ให้ผู้ใช้รู้ว่าเชื่อมบัญชีไหนไว้ (อีเมล · ชื่อปฏิทิน)
  -- เป็นส่วนหนึ่งของกุญแจกันซ้ำด้วย: เชื่อมสองบัญชีของเจ้าเดียวกันได้ แต่บัญชีเดิมซ้ำไม่ได้
  account    text not null default '',

  -- ขอสิทธิ์อะไรไปบ้าง — เก็บไว้เพื่อตอบผู้ใช้ได้ว่า "แอปนี้อ่านอะไรของฉันได้บ้าง"
  -- และเพื่อรู้ว่าต้องพาไปขอเพิ่มเมื่อไหร่ ตอนที่ฟีเจอร์ใหม่ต้องการ scope ที่ยังไม่มี
  scopes     text[] not null default '{}',

  -- กุญแจ (refresh token / URL ปฏิทินลับ) — **เข้ารหัสมาจาก Edge Function แล้ว**
  -- ด้วย INTEGRATION_KEY ที่อยู่ใน Supabase Secrets ไม่ได้อยู่ในฐานข้อมูล
  -- ตั้งใจให้สำเนาฐานข้อมูลที่หลุดออกไปเปิดอ่านกุญแจของใครไม่ได้เลยสักเส้น
  secret     text,

  -- ของจิปาถะที่แต่ละเจ้าไม่เหมือนกัน: sync token ของ Google · ETag ของ ICS ·
  -- รายชื่อวิชาที่ผู้ใช้เลือกรับ — ไม่แตกเป็นคอลัมน์เพราะรูปร่างต่างกันทุกเจ้า
  meta       jsonb not null default '{}'::jsonb,

  -- active       ทำงานปกติ
  -- needs_reauth ต้นทางปฏิเสธกุญแจแล้ว (ผู้ใช้ถอนสิทธิ์ · รหัสผ่านเปลี่ยน) ต้องให้คนกดเชื่อมใหม่
  -- error        ต้นทางล่มหรือคืนของแปลก ๆ — ลองใหม่เองได้ ไม่ต้องรบกวนคน
  -- paused       ผู้ใช้ปิดไว้เอง ยังไม่ตัดการเชื่อม
  status     text not null default 'active',
  error_msg  text,
  fail_count integer not null default 0,

  last_sync_at timestamptz,
  -- ตัวคุมจังหวะจริง ๆ ของ cron — ถอยห่างเองเมื่อพัง (ดู sync-integrations)
  -- เพื่อไม่ให้การเชื่อมที่เสียหนึ่งเส้นถูกยิงซ้ำทุก 30 นาทีไปตลอดกาล
  next_sync_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, provider, account)
);

create index if not exists integrations_due
  on public.integrations (next_sync_at) where status in ('active', 'error');
create index if not exists integrations_user
  on public.integrations (user_id);

-- ---------- ความปลอดภัย ----------
-- เปิด RLS แล้ว **ไม่ประกาศ policy สักข้อ** = ฝั่งเบราว์เซอร์แตะตารางนี้ไม่ได้เลย
-- แม้แต่แถวของตัวเอง — จงใจ เพราะคอลัมน์ secret อยู่ในแถวเดียวกัน และ RLS
-- คุมได้แค่ "แถวไหน" ไม่ได้คุม "คอลัมน์ไหน" · เปิดให้อ่านแถวตัวเองเมื่อไหร่
-- ก็เท่ากับแจกกุญแจที่เข้ารหัสไว้ให้ทุกสคริปต์ที่รันในหน้านั้นไปด้วย
--
-- ทางเข้าของแอปมีประตูเดียวคือ Edge Function `integrations` (verify_jwt = true)
-- ซึ่งคืนเฉพาะคอลัมน์ที่โชว์ได้ และเป็นที่เดียวที่ถอดรหัสกุญแจได้
alter table public.integrations enable row level security;

-- ---------- ทะเบียนงานที่เคยเห็นแล้ว ----------
-- กุญแจกันซ้ำตามที่ตั้งใจ: "source + source_id + user_id"
-- (integration_id รู้อยู่แล้วว่าเป็นของใครและของเจ้าไหน จึงไม่ต้องเก็บซ้ำในกุญแจ)
create table if not exists public.integration_items (
  integration_id uuid not null references public.integrations(id) on delete cascade,

  -- id จากต้นทาง — courseWork.id ของ Classroom · UID ของ ICS
  -- ทั้งคู่เป็นค่าที่ต้นทางรับประกันว่านิ่ง ไม่เปลี่ยนเมื่อเนื้อหาถูกแก้
  source_id  text not null,

  user_id    uuid not null references auth.users(id) on delete cascade,

  -- ลายนิ้วมือของเนื้อหา "หลังแปลงเป็นงานของเราแล้ว" ไม่ใช่ของ payload ดิบ
  -- ต่างกันมาก: Classroom ขยับ updateTime ทุกครั้งที่ครูแตะอะไรก็ตาม รวมถึงเรื่องที่
  -- ไม่เกี่ยวกับนักเรียนเลย (แก้คำอธิบายของตัวเอง · สลับลำดับหัวข้อ) — ถ้าดูจาก
  -- updateTime เราจะส่งแจ้งเตือน "งานถูกแก้" ให้เด็กทั้งห้องโดยที่ไม่มีอะไรเปลี่ยนจริง
  fingerprint text not null,

  -- สำเนาที่อ่านออกด้วยตา ไว้ตอบคำถาม "ทำไมงานนี้โผล่/ไม่โผล่" โดยไม่ต้องยิงถามต้นทางใหม่
  title      text not null default '',
  due        timestamptz,
  url        text,

  -- active    ต้นทางยังมีงานนี้อยู่
  -- cancelled ต้นทางลบหรือยกเลิกแล้ว (Classroom: state = DELETED · ICS: STATUS:CANCELLED)
  state      text not null default 'active',

  -- รอบล่าสุดที่ต้นทางยังยืนยันว่ามีงานนี้อยู่ — ใช้จับ "หายไปเฉย ๆ โดยไม่บอก"
  -- ซึ่งเป็นวิธีที่ ICS ใช้ลบงาน (มันไม่มีทางบอกว่า 'ลบแล้ว' มันแค่ไม่ส่งมาอีก)
  seen_at    timestamptz not null default now(),

  -- ส่งเข้ากล่องเข้าของแอปไปแล้วหรือยัง (และรอบล่าสุดส่งไปด้วยลายนิ้วมืออะไร)
  -- แยกจาก fingerprint เพราะ "รู้แล้ว" กับ "บอกแอปไปแล้ว" คนละเรื่องกัน:
  -- เน็ตหลุดตอนเขียน inbox_items ต้องได้ส่งใหม่รอบหน้า ไม่ใช่เงียบไปตลอดกาล
  sent_fingerprint text,
  sent_at    timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (integration_id, source_id)
);

create index if not exists integration_items_user
  on public.integration_items (user_id, state);
create index if not exists integration_items_pending
  on public.integration_items (integration_id)
  where sent_fingerprint is distinct from fingerprint;

-- เหตุผลเดียวกับตารางบน: ฝั่งเบราว์เซอร์ไม่ต้องอ่านตารางนี้เลย
-- ของที่แอปต้องรู้เดินทางมาทาง inbox_items อยู่แล้ว
alter table public.integration_items enable row level security;

-- ---------- เก็บกวาด ----------
-- งานที่ต้นทางยกเลิกไปแล้วและแอปรับทราบไปแล้ว ไม่ต้องเก็บทะเบียนไว้ตลอดกาล
-- 90 วันเผื่อกรณีครูลบแล้วเอากลับมาใหม่ในเทอมเดียวกัน — เกินกว่านั้นถือว่าเป็นงานใหม่จริง
create or replace function public.cleanup_integrations() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.integration_items
   where state = 'cancelled'
     and updated_at < now() - interval '90 days';
$$;

-- ============================================================
-- หลัง deploy ต้องตั้งกุญแจเข้ารหัสก่อนใช้งานจริง
-- ------------------------------------------------------------
-- Supabase → Edge Functions → Secrets:
--
--   INTEGRATION_KEY   = ผลของ  openssl rand -base64 32
--
-- ⚠️ กุญแจนี้หายเมื่อไหร่ = การเชื่อมทุกเส้นของทุกคนใช้ไม่ได้อีกเลย (ถอดรหัสไม่ออก)
--    ไม่ใช่หายนะ เพราะทางแก้คือให้ผู้ใช้กดเชื่อมใหม่ — แต่ต้องรู้ไว้ก่อนว่ามันแปลว่าอย่างนั้น
--    และ **ห้ามเปลี่ยนกุญแจทิ้งของเก่า** โดยไม่ได้ตั้งใจให้ทุกคนต้องเชื่อมใหม่พร้อมกัน
-- ============================================================
