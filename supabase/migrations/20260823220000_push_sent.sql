-- ============================================================
-- 06 · push_sent — จำว่าเตือนงานไหนไปแล้ว
-- ------------------------------------------------------------
-- เดิม send-reminders จำด้วยการ "เขียน pushedAt กลับเข้าไปในงานของผู้ใช้"
-- ซึ่งพังสองชั้นพร้อมกัน:
--
--   1) มันต้องอ่าน user_state.data ทั้งก้อนมาก่อน แล้วเขียนกลับทั้งก้อน
--      ก้อนนั้นมีรูปโปรไฟล์ ตารางเรียน ประวัติจับเวลา รวมกันหลายสิบ KB ต่อคน
--      ทั้งที่จะแก้แค่ฟิลด์เดียว — ที่ 600 คนคือดึงลงมาหลายสิบ MB ทุกครึ่งชั่วโมง
--
--   2) ร้ายกว่านั้นคือ lost update: มันอ่าน data ตอนต้นรอบ แล้วเขียนทับตอนท้ายรอบ
--      ถ้าผู้ใช้เพิ่มงานระหว่างนั้น งานที่เพิ่งเพิ่มจะหายไปเงียบ ๆ
--      ยิ่งคนใช้เยอะ รอบยิ่งกินเวลานาน ช่องให้ชนยิ่งกว้าง
--
-- ฝั่งแอปไม่เคยอ่าน pushedAt เลยสักบรรทัด มันเป็นหมุดของเซิร์ฟเวอร์ล้วน ๆ
-- ที่ไปฝังผิดที่ ย้ายมาอยู่ตารางของตัวเองแล้วทั้งสองปัญหาหายพร้อมกัน
-- ============================================================
create table if not exists public.push_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

-- ใช้ตอนเก็บกวาดของเก่าทิ้ง
create index if not exists push_sent_age on public.push_sent (sent_at);

-- เปิด RLS แล้วไม่ประกาศ policy = ฝั่งเบราว์เซอร์แตะไม่ได้เลยแม้แต่แถวเดียว
-- มีแต่ Edge Function ที่ถือ service role key เท่านั้นที่เข้าถึงได้ (ตามที่ตั้งใจ)
-- ตารางนี้ไม่มีอะไรที่ผู้ใช้ต้องเห็น และไม่มีอะไรที่ผู้ใช้ควรแก้ได้
alter table public.push_sent enable row level security;

-- ---------- เก็บกวาด ----------
-- เตือนไปแล้วเกิน 30 วันไม่ต้องจำต่อ งานนั้นถึงกำหนดไปนานแล้ว
create or replace function public.cleanup_push_sent() returns void language sql as $$
  delete from public.push_sent where sent_at < now() - interval '30 days';
$$;
