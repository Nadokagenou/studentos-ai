-- ============================================================
-- Student OS Clear · ส่งงานจาก LINE / ปุ่มลัด / Classroom มาที่ Clear (16 พ.ย. 69)
-- ------------------------------------------------------------
-- ของที่ไหลเข้าเอง (LINE · แตะหลังเครื่อง · ตัวเชื่อม Classroom/ปฏิทิน) ลงตาราง inbox_items ตัวเดียว
-- แล้วแอปไหนเปิดก่อนก็ดึงไป — ใช้ทั้งแอปหลักและ Clear = งานไปโผล่แอปที่ผู้ใช้ไม่ได้ดู
--
-- ทางแก้ที่ไม่ต้องแตะแอปหลักและ Edge Function สักบรรทัด:
--   inbox_route        ผู้ใช้เลือกเองว่าของที่ไหลเข้า "ไปแอปไหน" (main เป็นค่าเริ่มต้น = เหมือนเดิมทุกอย่าง)
--   inbox_items_clear  ทรงเดียวกับ inbox_items · Clear ดึงจากที่นี่
--   trigger            ก่อนเขียนลง inbox_items: บัญชีที่เลือก clear → ย้ายไปลง inbox_items_clear แทน
--                      แอปหลักจึงไม่เห็นเลย (ไม่ต้องกรอง) · Edge Function ไม่ได้อ่านแถวที่เพิ่ง insert กลับ จึงไม่พัง
--
-- ข้อแลกที่รู้อยู่:
--   - quick-add นับโควตา 30 ครั้ง/ชม. จาก inbox_items → บัญชีที่เลือก clear โควตานี้ไม่นับ
--   - sync-integrations แจ้งเตือน "งานใหม่ที่พักไว้ช่วงกลางคืน" อ่านจาก inbox_items → บัญชีที่เลือก clear ไม่ได้แจ้งรอบเช้า
--   ทั้งคู่แก้ได้ภายหลังด้วยการให้ฟังก์ชันอ่านทั้งสองตาราง
--
-- รันซ้ำได้ปลอดภัย · ย้อนกลับอยู่ท้ายไฟล์
-- ============================================================

create table if not exists public.inbox_route (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  app        text not null default 'main' check (app in ('main', 'clear')),
  updated_at timestamptz not null default now()
);
alter table public.inbox_route enable row level security;
drop policy if exists "own route" on public.inbox_route;
create policy "own route" on public.inbox_route
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.inbox_route from anon;
grant select, insert, update, delete on public.inbox_route to authenticated;

create table if not exists public.inbox_items_clear (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null,
  raw        text not null,
  meta       jsonb,
  consumed   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists inbox_items_clear_pending
  on public.inbox_items_clear (user_id, consumed, created_at desc);
alter table public.inbox_items_clear enable row level security;
drop policy if exists "own clear inbox" on public.inbox_items_clear;
create policy "own clear inbox" on public.inbox_items_clear
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.inbox_items_clear from anon;
grant select, insert, update, delete on public.inbox_items_clear to authenticated;

-- security definer: Edge Function เขียนด้วย service role อยู่แล้ว แต่ผู้ใช้เองก็ insert inbox_items ได้ (RLS "own inbox")
-- ตัวย้ายต้องเขียนตาราง clear ได้ไม่ว่าใครเป็นคนเขียน · ย้ายเฉพาะแถวของ user_id เดิม ไม่ข้ามบัญชี
create or replace function public.route_inbox_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.inbox_route r where r.user_id = new.user_id and r.app = 'clear') then
    insert into public.inbox_items_clear (user_id, source, raw, meta, consumed, created_at)
    values (new.user_id, new.source, new.raw, new.meta, new.consumed, new.created_at);
    return null;   -- ไม่ลง inbox_items · แอปหลักไม่เห็น
  end if;
  return new;
end $$;
revoke all on function public.route_inbox_item() from public, anon, authenticated;

drop trigger if exists inbox_items_route on public.inbox_items;
create trigger inbox_items_route
  before insert on public.inbox_items
  for each row execute function public.route_inbox_item();

-- Clear ที่เปิดค้างอยู่รับงานทันทีแบบเดียวกับ inbox_items (20261016150000_sync_every_minute.sql)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inbox_items_clear') then
    alter publication supabase_realtime add table public.inbox_items_clear;
  end if;
end $$;

-- ---------- ย้อนกลับ (รันมือเมื่อจำเป็น) ----------
-- drop trigger if exists inbox_items_route on public.inbox_items;
-- drop function if exists public.route_inbox_item();
-- (ของที่ค้างใน inbox_items_clear ย้ายกลับก่อนถ้าต้องการ แล้วค่อย drop table inbox_items_clear, inbox_route)
