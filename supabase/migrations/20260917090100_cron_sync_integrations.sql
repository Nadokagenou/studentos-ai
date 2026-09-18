-- ============================================================
-- 31 · ตั้งนาฬิกาให้ sync-integrations — "สวิตช์" ของตัวเชื่อมทั้งชั้น
-- ------------------------------------------------------------
-- ⚠️ ต้อง deploy ฟังก์ชันก่อนรันไฟล์นี้ ไม่งั้น cron จะยิงไปที่ 404 ทุก 30 นาที
--       supabase functions deploy sync-integrations
--       supabase functions deploy integrations
--       supabase functions deploy oauth-callback
--
-- เหมือน send-reminders ทุกประการ: ตัวฟังก์ชันไม่ได้ทำงานเอง มันรอให้มีคนเรียก
-- deploy อย่างเดียวจึงเท่ากับตารางที่เก็บการเชื่อมไว้เฉย ๆ โดยไม่มีใครมาอ่าน
--
-- ทุก 30 นาทีเพราะกำหนดส่งเป็นของที่ช้าได้ครึ่งชั่วโมงโดยไม่มีใครเดือดร้อน
-- (ครูสั่งงานส่งพรุ่งนี้ ไม่ต่างกันเลยระหว่างรู้ 13:00 กับ 13:29)
-- ส่วนตัวที่ต้องรู้เดี๋ยวนั้นจริง ๆ มีทางของมันอยู่แล้ว: ปุ่ม "ซิงก์เดี๋ยวนี้" ในแอป
--
-- ตัวฟังก์ชันหยิบไปแค่ 10 เส้นต่อรอบ และเลือกจาก next_sync_at ที่ถึงกำหนดแล้ว
-- จำนวนผู้ใช้จึงไม่ได้ทำให้รอบหนึ่งนานขึ้น แต่ทำให้ "รอบหนึ่งกินคิวไม่หมด" แทน —
-- วันไหนคิวยาวกว่า 10 × 48 รอบต่อวัน ค่อยขยับ BATCH หรือถี่ขึ้น ไม่ใช่ตอนนี้
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'studentos-sync-integrations') then
    perform cron.unschedule('studentos-sync-integrations');
  end if;
end $$;

select cron.schedule(
  'studentos-sync-integrations',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://yunbytxtgghizrdqftvj.supabase.co/functions/v1/sync-integrations',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_GCXZU_uLAlv3yuGxu5cOrw_YU4UCWXY"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- เก็บกวาดทะเบียนงานที่ต้นทางยกเลิกไปนานแล้ว · สัปดาห์ละครั้งพอ
do $$
begin
  if exists (select 1 from cron.job where jobname = 'studentos-cleanup-integrations') then
    perform cron.unschedule('studentos-cleanup-integrations');
  end if;
end $$;

select cron.schedule(
  'studentos-cleanup-integrations',
  '17 3 * * 0',
  $$ select public.cleanup_integrations(); $$
);

-- ============================================================
-- ตรวจว่ามันยิงจริง — อย่าเชื่อว่า "ตั้งแล้ว = ทำงาน"
-- ------------------------------------------------------------
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 5;
--
-- ⚠️ กับดักเดียวกับ send-reminders: cron รายงาน "succeeded" เมื่อ http_post
--    ยิงออกไปสำเร็จ ไม่ได้แปลว่าฟังก์ชันทำงาน · ถ้าได้ 401 ใน return_message
--    แปลว่า Supabase ไม่ยอมรับ publishable key เป็น JWT — ให้เก็บ service role key
--    ลง Vault แล้วอ้างถึงแทน (วิธีอยู่ท้ายไฟล์ 20260823120400_cron_send_reminders.sql)
--    **ห้ามวาง service role key ตรง ๆ ในไฟล์นี้** รีโปนี้เป็นสาธารณะ
--
-- อีกที่ที่ต้องดูเมื่อ "เชื่อมแล้วแต่ไม่มีงานเข้า":
--   select provider, status, error_msg, last_sync_at, next_sync_at from public.integrations;
-- ============================================================
