-- ============================================================
-- 16 ต.ค. 69 · งานจาก Classroom เข้าแอปภายในราว 1 นาที (เจ้าของ: "ขอส่งแล้วเข้าเลย")
-- ------------------------------------------------------------
-- ⚠️ ต้องรันไฟล์นี้ "ก่อน" deploy sync-integrations รุ่นที่จองแถว — ฟังก์ชันรุ่นนั้นเขียนคอลัมน์
--    sync_lease_until ทุกรอบ ถ้าคอลัมน์ยังไม่มี ทุกบัญชีจะซิงก์ไม่ได้เลยสักรอบ
--
-- สามเรื่องในไฟล์เดียว เพราะต้องไปด้วยกัน:
--   1. sync_lease_until — การจองแถวก่อนซิงก์ · cron ทุกนาทีทำให้รอบใหม่เริ่มก่อนรอบเก่าจบได้
--      (บัญชี 23 ห้องใช้ ~20 วิ) สองรอบซิงก์บัญชีเดียวกันพร้อมกัน = กล่องเข้าได้งานใบเดียวกันสองแถว
--   2. cron ของ sync-integrations จากทุก 30 นาที เป็นทุกนาที · ฟังก์ชันเลือกเองว่าใครถึงคิว:
--      Classroom ทุกนาที · ปฏิทิน (ICS/Calendar) ยังทุก 30 นาทีตาม next_sync_at
--   3. ใส่ inbox_items ใน publication ของ realtime — แอปที่เปิดอยู่รับงานทันทีที่แถวเข้า
--      realtime ใช้ RLS ของตาราง ("own inbox" + staff_account_restriction) ผู้ใช้ได้ยินเฉพาะแถวของตัวเอง
--
-- ย้อนกลับ: ดูท้ายไฟล์
-- ============================================================

alter table public.integrations add column if not exists sync_lease_until timestamptz;

do $$
declare j record;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  select jobid, schedule into j from cron.job where jobname = 'studentos-sync-integrations';
  if j.jobid is null or j.schedule = '* * * * *' then return; end if;
  perform cron.alter_job(j.jobid, schedule := '* * * * *');
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inbox_items') then
    alter publication supabase_realtime add table public.inbox_items;
  end if;
end $$;

-- ---------- ย้อนกลับ (รันมือเมื่อจำเป็น) ----------
-- alter publication supabase_realtime drop table public.inbox_items;
-- select cron.alter_job((select jobid from cron.job where jobname = 'studentos-sync-integrations'), schedule := '*/30 * * * *');
-- คอลัมน์ sync_lease_until ทิ้งไว้ได้ (ฟังก์ชันรุ่นเก่าไม่อ่านมัน) · ถ้าจะลบ ต้อง deploy ฟังก์ชันรุ่นเก่าก่อน:
-- alter table public.integrations drop column sync_lease_until;
