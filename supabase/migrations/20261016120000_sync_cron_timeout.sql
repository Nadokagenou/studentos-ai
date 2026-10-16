-- ============================================================
-- 16 ต.ค. 69 · ให้ cron รอคำตอบของ sync-integrations จนจบรอบ
-- ------------------------------------------------------------
-- ข้อมูลจริง (net._http_response ย้อนหลัง 6 ชม. · 12 รอบ): ทุกรอบของ sync-integrations
-- จบด้วย "Timeout of 5000 ms reached" — ค่าปริยายของ net.http_post คือรอ 5 วินาที
-- แต่รอบหนึ่งใช้ ~38 วินาที (บัญชีที่มี 23 ห้องเรียนคนเดียวใช้ 20 วินาที)
--
-- ฟังก์ชันยังทำงานจนจบ (last_sync_at ขยับครบทุกบัญชี) — แต่คำตอบของมัน
-- (ซิงก์กี่เส้น · ส่งกี่ใบ · push ถึงกี่เครื่อง) ถูกทิ้งทุกรอบ ไม่มีที่ไหนเก็บไว้เลย
-- ตอนนี้ฟังก์ชันเขียนสรุปลง integrations.meta.last_run เองแล้ว · ไฟล์นี้ทำให้คำตอบ
-- ทั้งรอบเก็บใน net._http_response ด้วย จะได้เทียบสองที่ได้
--
-- แก้ด้วย cron.alter_job บนคำสั่งเดิม ไม่ unschedule/schedule ใหม่ — คำสั่งบนเซิร์ฟเวอร์
-- มี header Authorization ของมันอยู่แล้ว เขียนใหม่ทั้งก้อนเสี่ยงทับกุญแจที่ไม่ตรงกับในไฟล์
-- รันซ้ำได้: ถ้ามี timeout_milliseconds อยู่แล้วจะไม่แตะ
-- ============================================================

do $$
declare
  j record;
begin
  select jobid, command into j from cron.job where jobname = 'studentos-sync-integrations';
  if j.jobid is null then
    raise notice 'ไม่มี job studentos-sync-integrations — ข้าม';
    return;
  end if;
  if j.command like '%timeout_milliseconds%' then
    return;
  end if;
  -- 120 วิ: เผื่อจาก ~38 วิ ตอนนี้ · ยังต่ำกว่าเพดานเวลาของ Edge Function (150 วิ)
  perform cron.alter_job(
    j.jobid,
    command := regexp_replace(j.command, '\)\s*;\s*$', ', timeout_milliseconds := 120000);')
  );
end $$;

-- ทะเบียนมีสถานะใหม่ 'done' (งานที่นักเรียนกดส่งใน Classroom แล้ว) — ล้างตามกติกาเดียวกับ cancelled
-- ไม่ล้าง = แถวของงานที่ส่งไปแล้วสะสมไปตลอดอายุการเชื่อม
create or replace function public.cleanup_integrations() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.integration_items
   where state in ('cancelled', 'done')
     and updated_at < now() - interval '90 days';
$$;
