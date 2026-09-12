-- ============================================================
-- app_config — ค่าตั้งของแอปทั้งก้อน เก็บที่เดียว อ่านตอนรัน
-- ------------------------------------------------------------
-- ทำไมต้องมี: ทุกวันนี้การเปลี่ยนน้ำหนักลำดับงาน · ลำดับบล็อกหน้าแรก · สีธีม
-- หรือพรอมป์ของน้องไซ ต้องแก้ไฟล์แล้ว push ขึ้น GitHub Pages ซึ่งแปลว่า
-- เจ้าของระบบขยับอะไรไม่ได้เลยถ้าไม่มีเครื่องที่ลง git ไว้
--
-- ที่นี่เก็บเป็น jsonb ก้อนเดียวต่อหนึ่ง "ช่อง" (live / preview) โดยตั้งใจ —
-- ไม่แตกเป็นคอลัมน์ เพราะรูปร่างของค่าตั้งจะเปลี่ยนทุกครั้งที่เพิ่มฟีเจอร์
-- และการเพิ่มฟีเจอร์ไม่ควรต้องมี migration ตามทุกครั้ง
--
-- เวอร์ชันเก็บแยกตาราง ไม่ทับของเดิม — ย้อนกลับได้เมื่อปรับแล้วแอปพัง
-- ซึ่งเป็นความเสี่ยงที่เพิ่มขึ้นจริงเมื่อเปิดให้แก้ค่าตั้งจากหน้าเว็บ
-- ============================================================

-- ---------- ใครเป็นแอดมิน ----------
-- ตารางนี้ไม่มี policy ให้เขียนจากฝั่ง client เลย โดยตั้งใจ
-- การเพิ่มแอดมินต้องทำใน SQL Editor ของ Supabase เท่านั้น
-- ถ้าเปิดให้เพิ่มจาก client เมื่อไหร่ ใครก็ตามที่มี anon key (= ทุกคน
-- เพราะมันอยู่ในโค้ดฝั่งเบราว์เซอร์) จะเลื่อนตัวเองเป็นแอดมินได้
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

-- อ่านได้เฉพาะแถวของตัวเอง — Control Center ใช้ถามว่า "ฉันเป็นแอดมินไหม"
-- อ่านทั้งตารางไม่ได้ เพราะรายชื่อแอดมินไม่ใช่ข้อมูลสาธารณะ
drop policy if exists app_admins_read_self on public.app_admins;
create policy app_admins_read_self on public.app_admins
  for select to authenticated
  using (user_id = auth.uid());

-- security definer เพราะ policy ของตารางอื่นต้องเช็คสิทธิ์ข้ามแถวที่ตัวเองอ่านไม่ได้
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- ---------- ค่าตั้งที่แอปอ่าน ----------
-- channel: 'live' = ของจริงที่ทุกเครื่องอ่าน · 'preview' = ไว้ลองก่อนเผยแพร่
create table if not exists public.app_config (
  channel    text primary key,
  data       jsonb not null default '{}'::jsonb,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.app_config enable row level security;

-- อ่านได้ทุกคน รวมถึงคนที่ยังไม่ล็อกอิน — แอปต้องโหลดค่าตั้งได้ตั้งแต่จอแรก
-- ก่อนที่จะรู้ด้วยซ้ำว่าเครื่องนี้มีบัญชีหรือเปล่า
drop policy if exists app_config_read_all on public.app_config;
create policy app_config_read_all on public.app_config
  for select to anon, authenticated
  using (true);

drop policy if exists app_config_write_admin on public.app_config;
create policy app_config_write_admin on public.app_config
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- ---------- ประวัติเวอร์ชัน ----------
-- เก็บ "ก้อนเต็ม" ทุกครั้งที่เผยแพร่ ไม่ได้เก็บ diff
-- ก้อนค่าตั้งเล็กมาก (ไม่กี่ KB) และ diff ที่ย้อนกลับไม่ได้จริงคือประวัติที่ไม่มีประโยชน์
create table if not exists public.app_config_versions (
  id         bigserial primary key,
  channel    text not null,
  data       jsonb not null,
  version    integer not null,
  label      text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
alter table public.app_config_versions enable row level security;
create index if not exists app_config_versions_idx
  on public.app_config_versions (channel, version desc);

-- ประวัติไม่ใช่ของสาธารณะ — มันมีพรอมป์และค่าตั้งภายในที่ไม่ได้เผยแพร่
drop policy if exists app_config_versions_admin on public.app_config_versions;
create policy app_config_versions_admin on public.app_config_versions
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- เขียนประวัติให้เองทุกครั้งที่ค่าตั้งเปลี่ยน — ไม่ฝากความหวังไว้กับฝั่ง client
-- ที่อาจลืมเรียก หรือเรียกแล้วเน็ตหลุดกลางทาง
create or replace function public.app_config_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.version := coalesce(old.version, 0) + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  insert into public.app_config_versions (channel, data, version, label, created_by)
  values (new.channel, new.data, new.version,
          nullif(new.data->>'__label', ''), auth.uid());
  return new;
end;
$$;

drop trigger if exists app_config_snapshot_trg on public.app_config;
create trigger app_config_snapshot_trg
  before insert or update on public.app_config
  for each row execute function public.app_config_snapshot();

-- ---------- แถวตั้งต้น ----------
-- ว่างไว้โดยตั้งใจ: remote-config.js มีค่าเริ่มต้นครบอยู่แล้วและถือเป็นแหล่งความจริง
-- ของ "หน้าตาเริ่มต้นของแอป" · แถวนี้เก็บเฉพาะสิ่งที่เจ้าของระบบ "ตั้งใจเปลี่ยน"
-- ซึ่งแปลว่าฟีเจอร์ใหม่ที่เพิ่มทีหลังจะได้ค่าเริ่มต้นของมันเองทันที ไม่ต้องมาเติมในนี้
insert into public.app_config (channel, data)
values ('live', '{}'::jsonb)
on conflict (channel) do nothing;

-- ---------- ตัวเลขสำหรับหน้า Analytics ----------
-- ตารางข้อมูลผู้ใช้ทุกตารางเป็น "อ่านได้เฉพาะแถวของตัวเอง" ตาม RLS ซึ่งถูกแล้ว
-- แปลว่าแอดมินนับจำนวนผู้ใช้จากฝั่ง client ไม่ได้ และไม่ควรได้ด้วย
--
-- ฟังก์ชันนี้จึงคืนเฉพาะ "ตัวเลขรวม" ไม่มีแถวของใครหลุดออกมาสักแถว
-- ไม่ใช่แอดมิน → คืน null · ไม่ได้โยน error เพราะหน้าเว็บจะได้บอกว่า "ดูไม่ได้"
-- แทนที่จะขึ้นหน้าพัง
create or replace function public.admin_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_app_admin() then json_build_object(
    'users',     (select count(*) from public.user_state),
    'push',      (select count(*) from public.push_subscriptions),
    'profiles',  (select count(*) from public.profiles),
    'hw_rooms',  (select count(*) from public.hw_rooms),
    'posts',     (select count(*) from public.posts),
    'inbox',     (select count(*) from public.inbox_items),
    'versions',  (select count(*) from public.app_config_versions where channel = 'live')
  ) end;
$$;
revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

-- ============================================================
-- ตั้งแอดมินคนแรก — ต้องรันมือใน SQL Editor เท่านั้น
-- (หา user id ได้ที่ Authentication → Users)
--
--   insert into public.app_admins (user_id, note)
--   values ('<UUID ของคุณ>', 'เจ้าของระบบ');
-- ============================================================
