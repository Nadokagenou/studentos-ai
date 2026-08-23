-- ============================================================
-- 05 · ตั้งนาฬิกาให้ send-reminders — "สวิตช์" ของระบบการเตือนทั้งระบบ
-- ------------------------------------------------------------
-- ⚠️ ต้อง deploy ฟังก์ชันก่อนรันไฟล์นี้ ไม่งั้น cron จะยิงไปที่ 404 ทุก 30 นาที
--       supabase functions deploy send-reminders
--
-- ทำไมต้องมีไฟล์นี้: ตัว Edge Function ไม่ได้ทำงานเอง มันรอให้มีคนเรียก
-- deploy อย่างเดียวจึงยังเงียบเหมือนเดิม — สถานะที่แอปเป็นอยู่ก่อนหน้านี้คือ
-- ตาราง push_subscriptions เก็บเครื่องที่สมัครไว้เรื่อย ๆ โดยไม่มีใครมาอ่านเลย
--
-- ทุก 30 นาทีพอดีเพราะการเตือนที่ละเอียดกว่านี้ไม่ได้ช่วยอะไร งานส่งพรุ่งนี้ 16:00
-- ไม่ต่างกันเลยระหว่างเตือน 13:00 กับ 13:15 แต่ยิงถี่กว่านี้เปลืองโควตาฟรีจริง
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cron.schedule ชื่อซ้ำจะ error ไม่ใช่ทับของเดิม — ปลดของเก่าก่อนเพื่อให้รันซ้ำได้
-- (unschedule ชื่อที่ยังไม่มีก็ error เหมือนกัน จึงต้องเช็คก่อน)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'studentos-send-reminders') then
    perform cron.unschedule('studentos-send-reminders');
  end if;
end $$;

select cron.schedule(
  'studentos-send-reminders',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://yunbytxtgghizrdqftvj.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_GCXZU_uLAlv3yuGxu5cOrw_YU4UCWXY"}'::jsonb
  );
  $$
);

-- ============================================================
-- ตรวจว่ามันยิงจริง — อย่าเชื่อว่า "ตั้งแล้ว = ทำงาน"
-- ------------------------------------------------------------
-- รันสองบรรทัดนี้หลังผ่านไปครึ่งชั่วโมง:
--
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 5;
--
-- ⚠️ จุดที่มีโอกาสพลาดที่สุดคือกุญแจในหัวข้อความข้างบน:
--    send-reminders ตั้ง verify_jwt = true ไว้ใน config.toml ถ้า Supabase
--    ไม่ยอมรับ publishable key รูปแบบใหม่นี้เป็น JWT จะได้ 401 กลับมาทุกครั้ง
--    โดยที่ cron ยังรายงานว่า "succeeded" เพราะ http_post ยิงออกไปสำเร็จจริง —
--    ความสำเร็จของ cron ไม่ได้แปลว่าฟังก์ชันทำงาน ต้องอ่าน return_message เอง
--
--    ถ้าเจอ 401: เปลี่ยนเป็น service role key แต่ห้ามใส่ตรง ๆ ในไฟล์นี้
--    (ไฟล์นี้อยู่ในรีโปสาธารณะ) ให้เก็บใน Vault แล้วอ้างถึงแทน:
--
--      select vault.create_secret('<service-role-key>', 'reminders_key');
--      -- แล้วใน headers ใช้:
--      --   'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
--      --                 where name = 'reminders_key')
-- ============================================================
