-- ============================================================
-- 09 · งานระดับห้อง — ตอบได้โดยไม่ต้องมีใครมีบัญชี
-- ------------------------------------------------------------
-- ทุกกลุ่มห้องเรียนมีข้อความนี้ทุกสัปดาห์: "สัปดาห์นี้มีส่งอะไรบ้างวะ"
-- ตอนนี้มีคนต้องเลื่อนหาย้อนหลังแล้วพิมพ์ตอบเอง
--
-- ตารางนี้ทำให้บอทตอบแทนได้ และตอบได้กับ "ทุกคนในห้อง" ไม่ใช่เฉพาะคนที่ติดตั้งแอป
-- เพราะมันเก็บงานระดับ "ห้อง" ไม่ใช่ระดับ "คน" — ไม่ต้องรู้ว่าใครเป็นใคร
--
-- เส้นแบ่งที่ข้ามไม่ได้ และตารางนี้อยู่ฝั่งซ้ายของเส้นโดยตั้งใจ:
--   "ห้องนี้มีงานอะไร"  → ไม่ต้องมีบัญชี · ตารางนี้
--   "เธอควรทำอะไรก่อน"  → ต้องรู้ว่าใครเป็นใคร · ต้องมีบัญชี · อยู่ในแอป
-- ============================================================

create table if not exists public.room_tasks (
  -- คีย์เป็น id ข้อความของ LINE — LINE ยิง webhook ซ้ำได้เมื่อไม่ได้ 200 กลับไปทันเวลา
  -- ถ้าคีย์เป็นอย่างอื่น งานเดียวจะโผล่ในรายการสองสามรอบโดยไม่มีใครเข้าใจว่าทำไม
  msg_id     text primary key,
  room_id    text not null,
  subject    text not null,
  detail     text not null default '',
  due        timestamptz,
  kind       text not null default 'homework',
  created_at timestamptz not null default now()
);

create index if not exists room_tasks_room_due on public.room_tasks (room_id, due);

-- เปิด RLS แล้วไม่ประกาศ policy = ฝั่งเบราว์เซอร์แตะไม่ได้เลย
-- มีแต่ Edge Function (service role) ที่เขียนและอ่าน ซึ่งเป็นทางเดียวที่ควรมี
-- ถ้าเปิดให้อ่านได้ ใครที่เดา room_id ถูกก็ไล่ดูการบ้านของห้องอื่นได้ทั้งโรงเรียน
alter table public.room_tasks enable row level security;

-- เวลาที่เคยแปะลิงก์ชวนไว้ท้ายรายการล่าสุด — จำกัดวันละครั้งต่อห้อง
-- ชวนทุกครั้งที่มีคนถามงาน = บอทที่ขายของทุกประโยค ซึ่งโดนเตะออกเร็วกว่าบอทที่เงียบ
alter table public.line_rooms add column if not exists hint_at timestamptz;

-- ---------- เก็บกวาด ----------
-- งานที่เลยกำหนดไปนานแล้วไม่มีใครถามถึงอีก · เก็บไว้ 60 วันเผื่อย้อนดู
create or replace function public.cleanup_line() returns void language sql as $$
  delete from public.line_codes  where created_at < now() - interval '1 hour';
  delete from public.inbox_items where consumed and created_at < now() - interval '30 days';
  delete from public.room_tasks  where created_at < now() - interval '60 days';
$$;
