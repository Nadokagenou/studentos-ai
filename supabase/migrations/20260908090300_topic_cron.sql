-- ============================================================
-- 21 · ตั้งนาฬิกาให้น้องไซเข้าไปตอบเธรดที่เงียบ
-- ------------------------------------------------------------
-- ⚠️ ต้อง deploy ฟังก์ชันก่อนรันไฟล์นี้ ไม่งั้น cron ยิงไปที่ 404 ทุก 5 นาที
--       supabase functions deploy sai-topic
--
-- ทำไมต้องมีไฟล์นี้ (เหตุผลเดียวกับ migration 05): Edge Function ไม่ทำงานเอง
-- มันรอให้มีคนเรียก · deploy อย่างเดียวแปลว่ามันเงียบเหมือนไม่ได้ deploy
-- และเราจะไม่รู้เลยจนกว่าจะมีคนถามว่า "ทำไมน้องไซไม่ตอบ"
--
-- ทุก 5 นาที เพราะเกณฑ์ในตัวฟังก์ชันคือ "เงียบครบ 10 นาที" —
-- ยิงถี่กว่าครึ่งของเกณฑ์ไม่ได้ช่วยอะไร ยิงห่างกว่านั้นทำให้ 10 นาทีกลายเป็น 20
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'studentos-sai-topic') then
    perform cron.unschedule('studentos-sai-topic');
  end if;
end $$;

select cron.schedule(
  'studentos-sai-topic',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://yunbytxtgghizrdqftvj.supabase.co/functions/v1/sai-topic',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_GCXZU_uLAlv3yuGxu5cOrw_YU4UCWXY"}'::jsonb
  );
  $$
);

-- ============================================================
-- ตรวจว่ามันยิงจริง — "ตั้งแล้ว" ไม่เท่ากับ "ทำงาน"
-- ------------------------------------------------------------
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 5;
--
-- ⚠️ กับดักเดิมจาก migration 05: cron รายงาน "succeeded" เพราะ http_post
--    ยิงออกไปสำเร็จ ไม่ได้แปลว่าฟังก์ชันทำงาน — ต้องอ่าน return_message เอง
--    ถ้าเจอ 401 ให้ย้ายกุญแจไป Vault ตามวิธีที่เขียนไว้ท้าย migration 05
--
-- ถ้าอยากปิดชั่วคราวโดยไม่ต้องลบ job:
--    update cron.job set active = false where jobname = 'studentos-sai-topic';
-- หรือถอด secret SAI_TOPIC ออก — ฟังก์ชันจะตอบ skipped ทันทีโดยไม่เผาโควตา
-- ============================================================
