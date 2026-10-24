-- ============================================================
-- ⚠️ 24 ต.ค. 69 · ไม่ได้ใช้แล้ว — แทนด้วยระบบรหัส/QR (20261023150000_invites.sql) · ลบด้วย 20261024130000_drop_invites_v1.sql
-- invites — ลิงก์เชิญเพื่อน (ภารกิจปลดล็อกธีม Halloween · 24 ต.ค. 69)
-- ------------------------------------------------------------
-- เจ้าของสั่ง: ปลดล็อกธีม Halloween ด้วยภารกิจ 2 อย่าง
--   1) เชิญเพื่อนมาใช้ StudentOS AI ให้ครบ 3 คน   ← ไฟล์นี้
--   2) ทำงานให้เสร็จอย่างน้อย 1 งานภายในแอป       ← นับในเครื่อง (events.js)
-- เจ้าของเลือกเอง: นับจาก "ลิงก์เชิญของฉัน" — เพื่อนกดลิงก์ที่มีรหัสเรา แล้วสมัครบัญชีใหม่ = นับ 1 คน
--
-- ทำไมต้องนับที่เซิร์ฟเวอร์: ทีมก่อนหน้าบันทึกไว้ (halloween/docs/STUDENTOS-MISSIONS-2026-10-24.md)
-- ว่ายอดชวนที่นับในเครื่องแก้เองได้ จึงห้ามนับจากการกดคัดลอกลิงก์หรือจากระบบเพื่อนเดิม
--
-- กติกาที่บังคับในฐานข้อมูล (ไม่ใช่ในแอป):
--   · หนึ่งบัญชีถูกนับได้ครั้งเดียวตลอดไป (invitee เป็น primary key) — คนแรกที่ชวนได้ไป
--   · ชวนตัวเองไม่ได้
--   · ต้องเป็นบัญชีใหม่จริง: สมัครหลังเปิดภารกิจ และไม่เกิน 7 วันก่อนกดรับ
--     ไม่งั้นเพื่อนที่ใช้แอปอยู่แล้วแค่กดลิงก์ของกันและกันก็ครบ 3 คน — ไม่ใช่ "ชวนมาใช้"
--   · ตารางนี้ไม่มี policy ให้อ่าน/เขียนตรง — เข้าได้ทางสองฟังก์ชันข้างล่างเท่านั้น
--     ไม่มีใครเห็นว่าใครชวนใคร เห็นแค่ยอดของตัวเอง
--
-- รหัสในลิงก์คือ id บัญชีของคนชวน (?inv=<uuid>) — ไม่ต้องมีตารางรหัสเพิ่ม และเปลี่ยนชื่อผู้ใช้แล้วลิงก์ไม่ตาย
-- ============================================================

create table if not exists public.invites (
  invitee    uuid primary key references auth.users(id) on delete cascade,
  inviter    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint invites_not_self check (inviter <> invitee)
);
create index if not exists invites_inviter_idx on public.invites (inviter);

alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;

-- เพื่อนใหม่เรียกหลังล็อกอินครั้งแรก (applyInviteCode ใน app.js) — เรียกซ้ำได้ ไม่นับซ้ำ
-- คืน: 'ok' นับแล้ว · 'already' บัญชีนี้ถูกนับไปแล้ว · 'self' ลิงก์ตัวเอง · 'old' บัญชีเก่า ไม่ใช่เพื่อนใหม่
--      'bad' รหัสผิด/ไม่มีบัญชีนี้ · null ยังไม่ล็อกอิน
create or replace function public.claim_invite(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me      uuid := auth.uid();
  v_inviter uuid;
  v_joined  timestamptz;
  v_open    constant timestamptz := '2026-10-24 00:00:00+07';
begin
  if v_me is null then return null; end if;
  if p_code is null or p_code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return 'bad'; end if;
  v_inviter := p_code::uuid;
  if v_inviter = v_me then return 'self'; end if;
  if not exists (select 1 from auth.users where id = v_inviter) then return 'bad'; end if;
  if exists (select 1 from public.invites where invitee = v_me) then return 'already'; end if;

  select created_at into v_joined from auth.users where id = v_me;
  if v_joined is null or v_joined < v_open or v_joined < now() - interval '7 days' then return 'old'; end if;

  insert into public.invites (invitee, inviter) values (v_me, v_inviter)
  on conflict (invitee) do nothing;
  return 'ok';
end $$;

-- ยอดเพื่อนที่เราชวนมาแล้ว — จออีเวนต์ถามทุกครั้งที่เปิดภารกิจ
create or replace function public.my_invite_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null
              else (select count(*)::int from public.invites where inviter = auth.uid()) end;
$$;

revoke all on function public.claim_invite(text) from public, anon;
revoke all on function public.my_invite_count() from public, anon;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.my_invite_count() to authenticated;
