-- ============================================================
-- 04 · line_chat — ความจำสั้น ๆ ของน้องไซในกลุ่ม LINE
-- ------------------------------------------------------------
-- ย้ายมาจาก supabase/schema-chat.sql ตอนรวม migration (23 ส.ค. 2569)
-- ข้ามได้ถ้าไม่อยากให้บอทจำบทสนทนา — webhook เขียนไว้ให้ข้ามเงียบ ๆ ถ้าหาตารางไม่เจอ
-- ============================================================
-- เก็บเฉพาะบทสนทนาที่คุยกับน้องไซ ไม่ใช่ทุกข้อความในกลุ่ม
-- ข้อความที่คนในห้องคุยกันเองไม่เคยถูกบันทึกไว้ที่ไหนทั้งนั้น
create table if not exists public.line_chat (
  id         bigint generated always as identity primary key,
  room_id    text not null,
  role       text not null check (role in ('user', 'bot')),
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists line_chat_room
  on public.line_chat (room_id, created_at desc);

-- ---------- ความปลอดภัย ----------
-- เปิด RLS แล้วไม่ประกาศ policy ใด ๆ = ฝั่งเบราว์เซอร์อ่านไม่ได้เลยแม้แต่แถวเดียว
-- มีแต่ Edge Function ที่ใช้ service role key เท่านั้นที่เข้าถึงได้ (ตามที่ตั้งใจ)
alter table public.line_chat enable row level security;

-- ---------- เก็บกวาด ----------
-- ความจำสั้นพอให้บทสนทนาต่อเนื่องก็พอ ไม่ต้องเก็บย้อนหลังเป็นเดือน
-- ยิ่งเก็บนาน ยิ่งเป็นข้อมูลที่ไม่มีใครได้ประโยชน์แต่ต้องคอยรับผิดชอบ
create or replace function public.cleanup_chat() returns void language sql as $$
  delete from public.line_chat where created_at < now() - interval '7 days';
$$;
