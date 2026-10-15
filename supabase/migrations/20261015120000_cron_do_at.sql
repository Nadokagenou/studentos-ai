-- ============================================================
-- 15 ต.ค. 69 · นาฬิกาตัวที่สองของ send-reminders — เตือนตาม "ทำตอน" ที่นักเรียนตั้งเอง
-- ------------------------------------------------------------
-- ⚠️ ต้อง deploy send-reminders รุ่นที่รู้จัก { only: 'doAt' } ก่อนรันไฟล์นี้
--    ไม่งั้นทุกห้านาทีฟังก์ชันรุ่นเก่าจะรันรอบเต็ม (รอบเย็น/เช้าถูกประเมินถี่ขึ้นหกเท่า)
--       supabase functions deploy send-reminders
--
-- ตัวหลัก (studentos-send-reminders) ยังยิงทุก 30 นาทีเท่าเดิม และมันก็ส่งนัดด้วยทุกรอบ
-- ตัวนี้มาอุดช่องระหว่างนั้น: นาที 5,10,15,20,25 และ 35,…,55 ยิงเฉพาะรอบนัด (runDoAt)
-- นัด 20:00 จึงช้าไม่เกินห้านาที แทนที่จะช้าได้ถึงครึ่งชั่วโมง
-- รอบนัดเบามาก: อ่าน tasks ของคนที่มีเครื่องรับ push แล้วเลือกเฉพาะงานที่ถึงเวลาในรอบนั้น
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'studentos-do-at') then
    perform cron.unschedule('studentos-do-at');
  end if;
end $$;

select cron.schedule(
  'studentos-do-at',
  '5-25/5,35-55/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://yunbytxtgghizrdqftvj.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_GCXZU_uLAlv3yuGxu5cOrw_YU4UCWXY"}'::jsonb,
    body    := '{"only":"doAt"}'::jsonb
  );
  $$
);

-- ตรวจว่ายิงจริง (อย่าเชื่อว่าตั้งแล้ว = ทำงาน):
--   select jobname, schedule, active from cron.job where jobname = 'studentos-do-at';
--   select status_code, left(content, 200), created from net._http_response
--     order by created desc limit 5;
-- คำตอบของรอบนี้ต้องมี "doAt":{"sent":…,"due":…} และไม่มี "scanned" — มี scanned = ฟังก์ชันยังเป็นรุ่นเก่า
-- (cron.job_run_details บอกแค่ว่า http_post ยิงออกไปได้ ไม่ได้บอกว่าฟังก์ชันตอบอะไร)
