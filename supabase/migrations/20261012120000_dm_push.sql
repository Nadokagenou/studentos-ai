-- ============================================================
-- dm_push — แชทเด้งทันที (ไม่รอรอบ 30 นาทีของ send-reminders)
-- ------------------------------------------------------------
-- ⚠️ ต้อง deploy ฟังก์ชันก่อนรันไฟล์นี้ ไม่งั้นทุกข้อความจะยิงไปที่ 404
--       supabase functions deploy notify-dm
--
-- ทุกข้อความใหม่ใน dm_messages → net.http_post { id } ไปที่ notify-dm
-- pg_net ยิงแบบไม่รอคำตอบ (คิวไว้แล้วส่งหลัง commit) — การกดส่งแชทไม่ช้าลงเลย
-- และถ้ายิงไม่ออก ข้อความต้องยังลงตารางตามปกติ จึงห่อ exception ไว้ทั้งก้อน
-- (รอบ 30 นาทีของ send-reminders ยังเก็บตกข้อความที่ไม่ได้เด้งให้อยู่)
--
-- กุญแจในหัวข้อความคือ publishable key — ตัวเดียวกับที่ cron ทุกตัวใช้ เป็นของสาธารณะอยู่แล้ว
-- (อยู่ใน config.js ฝั่งเบราว์เซอร์) · notify-dm ตั้ง verify_jwt = true
-- ============================================================
create extension if not exists pg_net;

create or replace function public._dm_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://yunbytxtgghizrdqftvj.supabase.co/functions/v1/notify-dm',
    body    := jsonb_build_object('id', new.id),
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_GCXZU_uLAlv3yuGxu5cOrw_YU4UCWXY"}'::jsonb,
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  -- การแจ้งเตือนล้มต้องไม่ทำให้ข้อความหาย
  return new;
end;
$$;

revoke all on function public._dm_push() from public, anon, authenticated;

drop trigger if exists dm_push on public.dm_messages;
create trigger dm_push after insert on public.dm_messages
  for each row execute function public._dm_push();

-- ============================================================
-- ตรวจว่ามันยิงจริง — ส่งแชทหนึ่งข้อความแล้วรัน:
--   select created, status_code, content from net._http_response
--    where content like '%"sent"%' or content like '%skipped%'
--    order by created desc limit 5;
-- {"ok":true,"sent":1} = ส่งถึงหนึ่งเครื่อง · "skipped":"off" = ผู้รับปิดแจ้งเตือนไว้
-- ============================================================
