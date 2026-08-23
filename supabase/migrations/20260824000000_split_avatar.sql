-- ============================================================
-- 07 · แยกรูปโปรไฟล์ออกจากก้อนหลัก + ตัวนับรุ่นของข้อมูล
-- ------------------------------------------------------------
-- ปัญหา: user_state.data เป็น JSON ก้อนเดียว แอปจึงส่งทั้งก้อนขึ้นทุกครั้งที่มีอะไรเปลี่ยน
-- ในก้อนนั้นมีรูปโปรไฟล์ base64 ~25KB ซึ่งแทบไม่เคยเปลี่ยนเลย แต่เดินทางไปด้วย
-- ทุกครั้งที่ผู้ใช้ติ๊กงานเสร็จ — วันละหลายสิบรอบ
--
-- วัดจริง: ก้อน 26KB (ไม่มีรูป) เทียบ 51KB (มีรูป) = โควตา bandwidth ของแพ็กเกจ Free
-- รับคนได้ 610 คน เทียบ 310 คน · รูปเดียวกินเพดานไปครึ่งหนึ่ง
--
-- แยกออกมาเป็นคอลัมน์ของตัวเอง แล้วส่งเฉพาะตอนที่รูปเปลี่ยนจริง
-- ยังอยู่บน cloud เหมือนเดิม (ลบแอปแล้วติดตั้งใหม่ก็ยังได้รูปคืน) แค่ไม่ต้องเดินทางฟรี
--
-- rev = ตัวนับรุ่น ให้แอปถามได้ว่า "ของบน cloud ใหม่กว่าที่ฉันมีไหม" ด้วยการอ่าน
-- ตัวเลขตัวเดียว แทนที่จะดาวน์โหลดทั้งก้อนมาเทียบเองทุกครั้งที่เปิดแอป
-- ============================================================
alter table public.user_state add column if not exists avatar text;
alter table public.user_state add column if not exists rev bigint not null default 0;

-- ย้ายรูปของคนที่มีอยู่แล้วออกมาจากก้อน แล้วเอาออกจาก data ไม่ให้ซ้ำสองที่
-- ทำครั้งเดียวจบ รันซ้ำก็ไม่มีอะไรให้ย้ายแล้ว (where กันไว้)
update public.user_state
   set avatar = data->'vault'->>'avatar',
       data   = jsonb_set(data, '{vault,avatar}', 'null'::jsonb)
 where data->'vault'->>'avatar' is not null;

-- ทุกครั้งที่แถวถูกเขียน ตัวนับเดินหน้าเอง — แอปไม่ต้องจำว่าต้องบวกเลขเอง
-- และเครื่องที่ลืมบวกก็ทำให้ตัวเลขเพี้ยนไม่ได้
create or replace function public.bump_rev() returns trigger language plpgsql as $$
begin
  new.rev := coalesce(old.rev, 0) + 1;
  return new;
end $$;

drop trigger if exists user_state_bump_rev on public.user_state;
create trigger user_state_bump_rev
  before update on public.user_state
  for each row execute function public.bump_rev();
