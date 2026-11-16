-- ============================================================
-- Student OS Clear · แถว cloud ของตัวเอง (16 พ.ย. 69)
-- ------------------------------------------------------------
-- เวอร์ชัน clear (/clear/) แยกเดินจากแอปหลัก และจะเปลี่ยนรูปแบบข้อมูลไปเรื่อย ๆ
-- ถ้าเขียนลง user_state แถวเดียวกับแอปหลัก งานในแอปหลักอาจเสียได้ → ตารางนี้แยกออกมา
--
-- ทรงเดียวกับ user_state ที่แอปใช้จริง: id · data · avatar · rev · updated_at
-- ไม่มี trigger ของระบบโทเคน/กระดานอันดับ (clear ไม่มีสองระบบนั้น)
-- ลบบัญชี = แถวหายตาม (on delete cascade กับ auth.users)
--
-- ยังไม่ได้รันตารางนี้ = แอป clear ปิดซิงก์เองแล้วใช้ในเครื่องอย่างเดียว (ไม่ถอยไปเขียน user_state)
-- รันซ้ำได้ปลอดภัย
-- ============================================================

create table if not exists public.user_state_clear (
  id         uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  avatar     text,
  rev        bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ไม่มี RLS = ใครถือ publishable key (อยู่ในโค้ดหน้าเว็บ) อ่านงานของทุกคนได้
alter table public.user_state_clear enable row level security;

drop policy if exists "own clear state" on public.user_state_clear;
create policy "own clear state" on public.user_state_clear
  for all using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.user_state_clear from anon;
grant select, insert, update, delete on public.user_state_clear to authenticated;

-- ตัวนับ rev เดินเองทุกครั้งที่แถวถูกเขียน (ฟังก์ชันเดียวกับ user_state · 20260824000000_split_avatar.sql)
create or replace function public.bump_rev() returns trigger language plpgsql as $$
begin
  new.rev := coalesce(old.rev, 0) + 1;
  return new;
end $$;

drop trigger if exists user_state_clear_bump_rev on public.user_state_clear;
create trigger user_state_clear_bump_rev
  before update on public.user_state_clear
  for each row execute function public.bump_rev();
