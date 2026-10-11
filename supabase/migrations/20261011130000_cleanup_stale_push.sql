-- ============================================================
-- cleanup_stale_push() — ลบแถว push ของเครื่องที่เลิกใช้แล้ว (วันละครั้ง)
-- ------------------------------------------------------------
-- 11 ต.ค. 69 · บัญชีเจ้าของมี 5 แถว ใช้ได้จริงแถวเดียว (iPhone ที่เพิ่งลงทะเบียน)
-- อีกสี่แถวเป็นแอปที่ลบไปแล้ว / เบราว์เซอร์เก่า — Apple/Google ยังรับการ์ดที่ส่งไปโดยไม่ปฏิเสธ
-- send-reminders เลยไม่เคยลบมันเอง (ลบเฉพาะตอนเจอ 403/404/410) และยิงไปเปล่า ๆ ทุกรอบตลอดกาล
-- ที่แย่กว่านั้นคือแถวพวกนี้ทำให้ "ดูเหมือนมีเครื่องรับ" ทั้งที่ไม่มี (ดู admin_push_health)
--
-- กฎ: ลบแถวที่ไม่รายงานตัวเกิน 10 วัน **เฉพาะเมื่อเจ้าของคนเดียวกันมีเครื่องอื่นรายงานตัวใน 3 วัน**
--   · ตั้งแต่รุ่น ensurePush ทุกเครื่องรายงานตัวทุกครั้งที่กลับเข้าแอป — เครื่องที่ใช้อยู่จริงไม่มีทางเงียบ 10 วัน
--   · คนที่หายไปจากแอปทั้งคน (ไม่มีเครื่องไหนรายงานตัว) ไม่ถูกแตะ — แถวเก่าของเขาอาจเป็นทางเดียว
--     ที่การทักให้กลับมา (nudge) ยังไปถึง · ลบไปแล้วเขาจะไม่ได้รับอะไรอีกเลย
-- ============================================================
create or replace function public.cleanup_stale_push() returns int
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.push_subscriptions s
     where s.updated_at < now() - interval '10 days'
       and exists (select 1 from public.push_subscriptions f
                    where f.user_id = s.user_id
                      and f.endpoint <> s.endpoint
                      and f.updated_at >= now() - interval '3 days')
    returning 1
  )
  select count(*)::int from gone;
$$;
revoke all on function public.cleanup_stale_push() from public;
revoke execute on function public.cleanup_stale_push() from anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'studentos-cleanup-push') then
    perform cron.unschedule('studentos-cleanup-push');
  end if;
end $$;

select cron.schedule(
  'studentos-cleanup-push',
  '23 20 * * *',   -- 03:23 เวลาไทย · ไม่ชนรอบ send-reminders (:00 / :30)
  $$ select public.cleanup_stale_push(); $$
);
