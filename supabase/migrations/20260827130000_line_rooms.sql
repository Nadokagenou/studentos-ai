-- ============================================================
-- 08 · ลิงก์เข้าร่วมห้อง — แทนการพิมพ์รหัสในกลุ่ม
-- ------------------------------------------------------------
-- ของเดิมทำงานกลับทาง: แอปสร้างรหัสให้คน → คนเอาไปพิมพ์ในกลุ่ม
-- นับขั้นตอนจริงของนักเรียนหนึ่งคนได้เจ็ดขั้น สลับแอปสองรอบ
-- และต้องพิมพ์รหัสกลางกลุ่มให้เพื่อนทั้งห้องเห็น
--
-- ตารางนี้กลับทางให้เป็น: กลุ่มมีลิงก์ประจำตัวหนึ่งเส้น ใครกดก็เชื่อมกับกลุ่มนั้น
-- เหลือ กดลิงก์ → ล็อกอิน → จบ · และลิงก์เดียวใช้ได้ทั้งห้อง ไม่ต้องขอทีละคน
--
-- ต่างจาก line_codes ตรงอายุ: รหัสเดิมเป็นของชั่วคราวรายคน หมดอายุใน 1 ชม.
-- ส่วน token นี้เป็นของถาวรรายกลุ่ม ตราบใดที่บอทยังอยู่ในกลุ่มนั้น
-- (ทั้งสองแบบอยู่ร่วมกันได้ ของเดิมไม่ถูกถอด — คนที่คุ้นกับรหัสยังใช้ได้เหมือนเดิม)
-- ============================================================

create table if not exists public.line_rooms (
  token      text primary key,
  room_id    text not null unique,
  created_at timestamptz not null default now()
);

-- เปิด RLS แล้วไม่ประกาศ policy = ฝั่งเบราว์เซอร์อ่านตารางนี้ตรง ๆ ไม่ได้เลยสักแถว
-- สำคัญ เพราะถ้าอ่านได้ ใครก็ไล่ดู token ของทุกห้องแล้วเข้าไปดูงานของห้องอื่นได้
-- ทางเดียวที่แตะได้คือผ่านฟังก์ชันข้างล่าง ซึ่งรับ token มาทีละอันและไม่เคยคืนรายการ
alter table public.line_rooms enable row level security;

-- ---------- ประตูเดียวที่ฝั่งแอปใช้ได้ ----------
-- security definer เพื่อให้ข้ามผ่าน RLS ของ line_rooms ได้ แต่ยังผูกกับ auth.uid()
-- ของคนที่เรียกเสมอ จึงเชื่อมได้เฉพาะบัญชีตัวเอง ปลอมเป็นคนอื่นไม่ได้
--
-- set search_path เขียนไว้โดยตั้งใจ: ฟังก์ชัน security definer ที่ไม่ตรึง search_path
-- คือช่องให้คนสร้างตารางชื่อซ้ำใน schema ของตัวเองมาดักการทำงานได้
create or replace function public.join_line_room(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room text;
begin
  if auth.uid() is null then
    raise exception 'ต้องล็อกอินก่อนถึงจะเข้าร่วมห้องได้';
  end if;

  select room_id into v_room from public.line_rooms where token = p_token;
  -- ไม่เจอ = ลิงก์ผิดหรือบอทถูกเตะออกจากกลุ่มไปแล้ว
  -- คืน null เฉย ๆ ไม่ raise เพราะฝั่งแอปต้องแยก "ลิงก์ใช้ไม่ได้" ออกจาก "ระบบพัง"
  if v_room is null then
    return null;
  end if;

  insert into public.line_links (user_id, room_id)
  values (auth.uid(), v_room)
  on conflict (user_id, room_id) do nothing;

  return v_room;
end;
$$;

-- ให้เฉพาะคนที่ล็อกอินแล้วเรียกได้ · anon เรียกไม่ได้เลย
revoke all on function public.join_line_room(text) from public;
revoke all on function public.join_line_room(text) from anon;
grant execute on function public.join_line_room(text) to authenticated;
