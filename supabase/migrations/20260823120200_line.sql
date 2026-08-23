-- ============================================================
-- 03 · ตารางฝั่ง LINE — รหัสเชื่อม · คู่ที่จับได้ · กล่องเข้า
-- ------------------------------------------------------------
-- ย้ายมาจาก supabase/schema-line.sql ตอนรวม migration (23 ส.ค. 2569)
-- เนื้อ SQL เหมือนเดิมทุกบรรทัด เปลี่ยนแค่ที่อยู่และลำดับการรัน
-- ============================================================

-- รหัสเชื่อมชั่วคราว: แอปสร้างให้ นักเรียนเอาไปพิมพ์ในกลุ่ม แล้วรหัสหายไป
create table if not exists public.line_codes (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- คู่ที่จับได้แล้ว: กลุ่ม LINE นี้ ส่งงานเข้าให้นักเรียนคนไหนบ้าง
-- นักเรียนคนเดียวเชื่อมได้หลายกลุ่ม (ห้องเรียน · ชมรม · กลุ่มติว)
create table if not exists public.line_links (
  user_id    uuid not null references auth.users(id) on delete cascade,
  room_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

-- ของดิบที่ไหลเข้ามา ยังไม่ได้แกะ — ฝั่งแอปเป็นคนอ่านแล้วมาร์คว่าใช้แล้ว
create table if not exists public.inbox_items (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null,
  raw        text not null,
  meta       jsonb,
  consumed   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists inbox_items_pending
  on public.inbox_items (user_id, consumed, created_at desc);

-- ---------- ความปลอดภัย ----------
-- ทุกตารางเปิด RLS แล้วให้เห็นเฉพาะของตัวเอง
-- Edge Function ใช้ service role key จึงเขียนข้ามได้ (ตามที่ตั้งใจ)
alter table public.line_codes  enable row level security;
alter table public.line_links  enable row level security;
alter table public.inbox_items enable row level security;

drop policy if exists "own codes" on public.line_codes;
create policy "own codes" on public.line_codes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own links" on public.line_links;
create policy "own links" on public.line_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own inbox" on public.inbox_items;
create policy "own inbox" on public.inbox_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- เก็บกวาดอัตโนมัติ ----------
-- รหัสที่ไม่มีใครใช้ภายใน 1 ชม. ถือว่าตกหล่น ลบทิ้ง
-- ของในกล่องเข้าที่ใช้แล้วเกิน 30 วัน ไม่ต้องเก็บไว้ให้เปลืองที่
create or replace function public.cleanup_line() returns void language sql as $$
  delete from public.line_codes  where created_at < now() - interval '1 hour';
  delete from public.inbox_items where consumed and created_at < now() - interval '30 days';
$$;
