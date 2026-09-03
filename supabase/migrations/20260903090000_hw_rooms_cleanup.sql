-- ============================================================
-- 16 · เก็บกวาดห้องการบ้าน — ตั้งนาฬิกาให้ cleanup_hw แล้วปิดประตูที่เปิดค้างไว้
-- ------------------------------------------------------------
-- ไฟล์ 20260902090000_homework_rooms.sql เขียน cleanup_hw() ไว้ครบแล้ว
-- แต่ไม่มีใครเรียกมันเลย — ฟังก์ชันที่ไม่มีนาฬิกาคือฟังก์ชันที่ไม่ทำงาน
-- (เคสเดียวกับ send-reminders ที่เคย deploy แล้วเงียบอยู่หลายสัปดาห์)
--
-- ห้องเก่าไม่โผล่บนจออยู่แล้วเพราะทุก query กรอง due >= current_date
-- แต่แถวยังอยู่ และ hw_msgs โตตามจำนวนห้องคูณจำนวนคน — ของที่ไม่มีใครอ่านอีกแล้ว
-- ไม่ควรค้างอยู่ในฐานข้อมูลของนักเรียนคนอื่นไปเรื่อย ๆ
-- ============================================================

-- ---------- ปิดประตูที่เปิดค้าง ----------
-- migration ก่อนหน้า grant execute ให้ authenticated ครบ 5 ฟังก์ชัน แต่ลืม cleanup_hw
-- Postgres จึงใช้ค่าปริยาย = PUBLIC เรียกได้ ซึ่งแปลว่าใครถือ anon key ก็สั่งลบได้
-- (ยิงจริงด้วย anon key ได้ 204 กลับมา — ไม่ใช่ทฤษฎี)
--
-- ความเสียหายจำกัดอยู่แค่ห้องที่เลยกำหนดเกิน 7 วัน จึงไม่ใช่เรื่องด่วน
-- แต่ security definer + PUBLIC คือคู่ที่ไม่ควรอยู่ด้วยกันโดยไม่ได้ตั้งใจ
-- ตัวนี้ไม่มีใครนอกจาก cron ต้องเรียก และ cron รันในสิทธิ์ของ postgres อยู่แล้ว
revoke execute on function public.cleanup_hw() from public;
revoke execute on function public.cleanup_hw() from anon;
revoke execute on function public.cleanup_hw() from authenticated;

-- hw_mine ก็เป็น security definer เหมือนกัน แต่ปล่อยไว้ได้ —
-- มันอ่านค่าจาก auth.uid() ซึ่งของ anon เป็น null จึงคืน false เสมอ ไม่รั่วอะไรออกไป
-- (ถ้าจะ revoke ต้องระวัง: policy ที่เรียกมันรันในสิทธิ์ของผู้เรียก ไม่ใช่ของเจ้าของตาราง)

-- ---------- ตั้งนาฬิกา ----------
create extension if not exists pg_cron;

-- cron.schedule ชื่อซ้ำจะ error ไม่ใช่ทับของเดิม และ unschedule ชื่อที่ไม่มีก็ error
-- จึงต้องเช็คก่อน เพื่อให้ไฟล์นี้รันซ้ำได้โดยไม่พัง
do $$
begin
  if exists (select 1 from cron.job where jobname = 'studentos-cleanup-hw') then
    perform cron.unschedule('studentos-cleanup-hw');
  end if;
end $$;

-- วันละครั้งตอนตีสี่สิบเจ็ดนาที (UTC 21:47 = ~04:47 ไทย) — ช่วงที่ไม่มีใครใช้แอป
-- ไม่ต้องผ่าน net.http_post เหมือน send-reminders เพราะตัวนี้เป็น SQL ล้วน
-- ไม่ใช่ Edge Function จึงไม่มีเรื่องกุญแจหรือ 401 ให้พลาด
select cron.schedule(
  'studentos-cleanup-hw',
  '47 21 * * *',
  $$ select public.cleanup_hw(); $$
);

-- ============================================================
-- ตรวจว่ามันยิงจริง — "ตั้งแล้ว" ไม่เท่ากับ "ทำงาน"
-- ------------------------------------------------------------
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'studentos-cleanup-hw')
--    order by start_time desc limit 5;
-- ============================================================
