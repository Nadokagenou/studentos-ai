-- ============================================================
-- 01 · user_state — ก้อนข้อมูลหลักของผู้ใช้หนึ่งคน
-- ------------------------------------------------------------
-- ทั้งแอปเก็บของลงแถวเดียวต่อผู้ใช้หนึ่งคน โดยยัดทุกอย่างเป็น JSON ในคอลัมน์ data
-- (งาน · ตั้งค่า · รอบจับเวลา · หมุดปฏิทิน · ตารางเรียน · ของสะสม)
--
-- ทำไมไม่แตกเป็นตาราง: ทุกอย่างในนั้นถูกอ่านพร้อมกันเสมอตอนเปิดแอป และถูกเขียน
-- พร้อมกันเสมอตอน sync — แตกเป็นตารางแล้วได้ join เพิ่มมาโดยไม่ได้อะไรกลับมา
-- วันไหนต้องรายงานข้ามผู้ใช้บ่อย ๆ ค่อยแตกออก แล้วค่อยคุยกันเรื่อง index
-- ============================================================
create table if not exists public.user_state (
  id         uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- ความปลอดภัย ----------
-- ไม่มี RLS = ใครถือ anon key (ซึ่งอยู่ในโค้ดหน้าเว็บ เปิดดูได้) อ่านงานของทุกคนได้
alter table public.user_state enable row level security;

drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state
  for all using (auth.uid() = id) with check (auth.uid() = id);
