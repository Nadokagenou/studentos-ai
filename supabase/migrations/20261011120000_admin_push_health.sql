-- ============================================================
-- admin_push_health() — "แจ้งเตือนนอกแอปส่งถึงคนจริงไหม" สำหรับ Control Center
-- ------------------------------------------------------------
-- 11 ต.ค. 69 · แจ้งเตือนตายเงียบ ๆ อยู่ 4–7 วันโดยไม่มีใครรู้ จนเจ้าของเจอเอง
-- ไทล์เดิม "เปิดแจ้งเตือน" นับแถวใน push_subscriptions — แถวที่ค้างจากเครื่องเก่าก็นับ
-- ตัวเลขจึงดูปกติตลอดเวลาที่ระบบพัง (send-reminders ก็ตอบ ok ทุกรอบ เพราะ Apple/Google
-- รับการ์ดที่ส่งไปปลายทางเก่าโดยไม่ปฏิเสธ)
--
-- ตัวที่บอกความจริงคือ: คนที่ใช้แอปอยู่ มีเครื่องที่ "รายงานตัว" เร็ว ๆ นี้ไหม
-- ตั้งแต่รุ่นนี้ทุกเครื่องรายงานตัวทุกครั้งที่กลับเข้าแอป (ensurePush ใน app.js → upsert updated_at)
-- คนที่ใช้แอปใน 3 วันแต่ไม่มีเครื่องไหนรายงานตัวใน 3 วัน = การ์ดของเขาไปไม่ถึงจอแน่ ๆ
--
-- ความเป็นส่วนตัว: คืนเฉพาะตัวเลข + รหัสย่อ 8 ตัว + สถานะเครื่อง (pushDiag ไม่มีชื่อ/อีเมล/endpoint เต็ม)
-- ไม่ใช่แอดมิน = คืน null (เหมือน admin_stats)
-- ============================================================
create or replace function public.admin_push_health()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_app_admin() then return null; end if;

  with
  u as (
    select s.id,
           greatest(s.updated_at,
                    (public._sos_day(s.data->'funnel'->>'lastDay'))::timestamptz) as seen_at,
           case when jsonb_typeof(s.data->'pushDiag') = 'object' then s.data->'pushDiag' end as diag
    from public.user_state s
  ),
  p as (
    select user_id, max(updated_at) as checkin, count(*) as rows
    from public.push_subscriptions group by user_id
  ),
  a as (
    select u.id, u.seen_at, u.diag, p.checkin, coalesce(p.rows, 0) as rows,
           case
             when p.checkin >= now() - interval '3 days' then 'ok'
             when p.checkin is null then 'none'
             else 'stale'
           end as health
    from u left join p on p.user_id = u.id
    where u.seen_at >= now() - interval '3 days'
  )
  select json_build_object(
    'generated_at', now(),
    'active',     (select count(*) from a),
    'ok',         (select count(*) from a where health = 'ok'),
    'stale',      (select count(*) from a where health = 'stale'),
    'none',       (select count(*) from a where health = 'none'),
    'last_checkin', (select max(updated_at) from public.push_subscriptions),
    'users', coalesce((select json_agg(json_build_object(
                'id', left(a.id::text, 8),
                'health', a.health,
                'checkin', a.checkin,
                'rows', a.rows,
                'diag', a.diag
              ) order by (a.health = 'ok'), a.seen_at desc) from a), '[]'::json)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_push_health() from public;
-- Supabase ให้ anon รันฟังก์ชันใหม่ใน public ได้เองโดยตรง (ไม่ผ่าน public) — ถอนแยก
revoke execute on function public.admin_push_health() from anon;
grant execute on function public.admin_push_health() to authenticated;
