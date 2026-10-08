-- ============================================================
-- admin_analytics() — หลังบ้านสำหรับหน้า Analytics ของ Control Center
-- ------------------------------------------------------------
-- ไม่สร้างตาราง event ใหม่ — ของที่ต้องใช้ตอบ "นักเรียนใช้แอปยังไง" อยู่ใน user_state.data แล้วทั้งหมด:
--   tasks     createdAt · doneAt · due · fromScan · sourceId · srcKey   → สร้าง/ทำเสร็จวันไหน มาจากทางไหน
--   sessions  start · min                                               → จับเวลาทำงานจริงกี่นาที
--   funnel    dayLog · screens · tasksEver · doneEver · ver             → เปิดแอปวันไหน เคยเปิดจอไหน
--             (⚠️ funnel เพิ่งเริ่มถูกส่งขึ้น cloud ตั้งแต่รุ่นที่มากับไฟล์นี้ — ก่อนหน้านั้นไม่มีบนเซิร์ฟเวอร์เลย)
-- ข้อดีคือตัวเลขย้อนหลังได้ทันทีตั้งแต่วันแรกที่มีคนล็อกอิน ไม่ต้องรอเก็บใหม่
--
-- ความเป็นส่วนตัว (ผู้ใช้เป็นนักเรียน ส่วนใหญ่อายุไม่ถึง 18):
--   · คืนเฉพาะ "ตัวเลข" — ไม่มีชื่องาน รายละเอียด ชื่อครู อีเมล หรือชื่อคน ออกจากฟังก์ชันนี้
--   · รายคนแสดงด้วยรหัสย่อ 8 ตัวแรกของ user id เท่านั้น
--   · ไม่ใช่แอดมิน = คืน null (เหมือน admin_stats)
--
-- วันทั้งหมดคิดตามเวลาไทย (Asia/Bangkok) — รูปเดียวกับ funnelDay() ฝั่งแอป
-- ============================================================

-- แปลงข้อความเป็นเวลาแบบไม่ล้ม — ข้อมูลใน jsonb มาจากเครื่องผู้ใช้ จะมีค่าเพี้ยนปนมาได้เสมอ
-- ตัวเดียวที่พังจะลากทั้งหน้า Analytics พังตาม ถ้าใช้ ::timestamptz ตรง ๆ
create or replace function public._sos_ts(s text)
returns timestamptz
language plpgsql
stable   -- ข้อความที่ไม่มีโซนเวลาขึ้นกับ TimeZone ของเซสชัน จึงเป็น immutable ไม่ได้
as $$
begin
  if s is null or s !~ '^\d{4}-\d{2}-\d{2}' then return null; end if;
  return s::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public._sos_day(s text)
returns date
language plpgsql
immutable
as $$
begin
  if s is null or s !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return s::date;
exception when others then
  return null;
end;
$$;

create or replace function public.admin_analytics(p_days int default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz    constant text := 'Asia/Bangkok';
  today date := (now() at time zone tz)::date;
  d0    date;
  result json;
begin
  if not public.is_app_admin() then return null; end if;
  p_days := greatest(7, least(coalesce(p_days, 30), 120));
  d0 := today - (p_days - 1);

  with
  u as (
    select s.id, s.updated_at,
           case when jsonb_typeof(s.data->'funnel') = 'object' then s.data->'funnel' else '{}'::jsonb end as f,
           case when jsonb_typeof(s.data->'tasks') = 'array' then s.data->'tasks' else '[]'::jsonb end as tasks,
           case when jsonb_typeof(s.data->'sessions') = 'array' then s.data->'sessions' else '[]'::jsonb end as sess
    from public.user_state s
  ),
  -- งานหนึ่งแถวต่อหนึ่งใบ · รวมใบที่อยู่ในถังขยะด้วยตอนนับ "สร้าง" (สร้างแล้วลบก็คือเคยสร้าง)
  t as (
    select u.id as uid,
           -- coalesce จำเป็น: งานรุ่นเก่าไม่มีคีย์ deleted เลย → null → "not deleted" ก็เป็น null
           -- แล้วถูกตัดทิ้งเงียบ ๆ ทุกใบ (รอบแรกที่รันจริง งานค้างทั้งระบบขึ้น 0)
           coalesce(x->'deleted' = 'true'::jsonb, false) as deleted,
           coalesce(x->'done' = 'true'::jsonb, false) as done,
           public._sos_ts(x->>'createdAt') as created_at,
           public._sos_ts(x->>'doneAt') as done_at,
           public._sos_ts(x->>'due') as due,
           case
             when coalesce(x->>'srcKey', '') <> '' then 'sync'
             when coalesce(x->>'sourceId', '') <> '' then x->>'sourceId'
             when x->'fromScan' = 'true'::jsonb then 'scan'
             else 'manual'
           end as via
    from u, jsonb_array_elements(u.tasks) x
    where jsonb_typeof(x) = 'object'
  ),
  se as (
    select u.id as uid,
           public._sos_ts(x->>'start') as start_at,
           greatest(0, least(coalesce(case when (x->>'min') ~ '^\d+(\.\d+)?$' then (x->>'min')::numeric end, 0), 600)) as mins
    from u, jsonb_array_elements(u.sess) x
    where jsonb_typeof(x) = 'object'
  ),
  -- "วันที่ใช้งาน" = วันที่มีร่องรอยว่าเปิดแอปจริง: เปิดแอป (dayLog) · สร้างงาน · ติ๊กเสร็จ · จับเวลา · ซิงก์ล่าสุด
  -- เอาหลายแหล่งมารวมเพราะ dayLog เพิ่งเริ่มเก็บ — คนที่ใช้มาก่อนจะยังมีวันจากงาน/รอบจับเวลาให้นับ
  act as (
    select distinct uid, day from (
      select u.id as uid, public._sos_day(d) as day
        from u, jsonb_array_elements_text(case when jsonb_typeof(u.f->'dayLog') = 'array' then u.f->'dayLog' else '[]'::jsonb end) d
      union all select uid, (created_at at time zone tz)::date from t where created_at is not null
      union all select uid, (done_at at time zone tz)::date from t where done_at is not null
      union all select uid, (start_at at time zone tz)::date from se where start_at is not null
      union all select id, (updated_at at time zone tz)::date from u
    ) a
    where day is not null and day <= today
  ),
  -- รวมรายคนด้วย group by ทีเดียวต่อแหล่ง (ไม่ใช่ subquery ต่อคน — นั่นคือ ผู้ใช้ × งาน × สิบกว่ารอบ)
  tagg as (
    select uid,
           count(*) as created_total,
           count(*) filter (where not deleted) as live,
           count(*) filter (where done) as done_total,
           count(*) filter (where not done and not deleted) as pending,
           count(*) filter (where not done and not deleted and due < now()) as overdue,
           count(*) filter (where created_at >= now() - interval '7 days') as created_7,
           count(*) filter (where done_at >= now() - interval '7 days') as done_7,
           count(*) filter (where done and due is not null and done_at is not null) as rated,
           count(*) filter (where done and due is not null and done_at <= due) as on_time
    from t group by uid
  ),
  vagg as (
    select uid, json_object_agg(via, n) as via
    from (select uid, via, count(*) n from t group by uid, via) x
    group by uid
  ),
  sagg as (
    select uid, round(coalesce(sum(mins) filter (where start_at >= now() - interval '7 days'), 0)) as focus_7
    from se group by uid
  ),
  aagg as (
    select uid, min(day) as first_day, count(*) as days_total,
           count(*) filter (where day >= today - 6) as days_7
    from act group by uid
  ),
  per as (
    select u.id,
           left(u.id::text, 8) as short_id,
           (u.id = auth.uid()) as is_me,
           u.updated_at as last_sync,
           nullif(u.f->>'ver', '') as ver,
           aagg.first_day,
           coalesce(aagg.days_total, 0) as days_total,
           coalesce(aagg.days_7, 0) as days_7,
           coalesce(tagg.live, 0) as live,
           coalesce(tagg.pending, 0) as pending,
           coalesce(tagg.overdue, 0) as overdue,
           coalesce(tagg.created_7, 0) as created_7,
           coalesce(tagg.done_7, 0) as done_7,
           coalesce(sagg.focus_7, 0) as focus_7,
           coalesce(tagg.rated, 0) as rated,
           coalesce(tagg.on_time, 0) as on_time,
           -- ตัวนับสะสมในเครื่อง (ไม่ลดเมื่อลบงาน) กับที่นับได้จากงานที่เหลือ — เอาค่าที่มากกว่า
           greatest(coalesce(case when (u.f->>'tasksEver') ~ '^\d{1,9}$' then (u.f->>'tasksEver')::int end, 0),
                    coalesce(tagg.created_total, 0)::int) as tasks_ever,
           greatest(coalesce(case when (u.f->>'doneEver') ~ '^\d{1,9}$' then (u.f->>'doneEver')::int end, 0),
                    coalesce(tagg.done_total, 0)::int) as done_ever,
           coalesce(vagg.via, '{}'::json) as via
    from u
    left join tagg on tagg.uid = u.id
    left join vagg on vagg.uid = u.id
    left join sagg on sagg.uid = u.id
    left join aagg on aagg.uid = u.id
  ),
  days as (
    select g::date as day from generate_series(d0, today, interval '1 day') g
  ),
  series as (
    select d.day,
           coalesce(a.n, 0) as active, coalesce(c.n, 0) as created,
           coalesce(f.n, 0) as done, coalesce(m.n, 0) as focus_min
    from days d
    left join (select day, count(distinct uid) n from act where day >= d0 group by day) a on a.day = d.day
    left join (select (created_at at time zone tz)::date as day, count(*) n from t
                where created_at >= d0::timestamp at time zone tz group by 1) c on c.day = d.day
    left join (select (done_at at time zone tz)::date as day, count(*) n from t
                where done_at >= d0::timestamp at time zone tz group by 1) f on f.day = d.day
    left join (select (start_at at time zone tz)::date as day, round(sum(mins)) n from se
                where start_at >= d0::timestamp at time zone tz group by 1) m on m.day = d.day
  )
  select json_build_object(
    'generated_at', now(),
    'today', today,
    'days', p_days,
    'kpi', json_build_object(
      'users',        (select count(*) from u),
      'active_today', (select count(distinct uid) from act where day = today),
      'active_7',     (select count(distinct uid) from act where day >= today - 6),
      'active_30',    (select count(distinct uid) from act where day >= today - 29),
      'new_7',        (select count(*) from per where first_day >= today - 6),
      'tasks_live',   (select count(*) from t where not deleted),
      'pending',      (select count(*) from t where not done and not deleted),
      'overdue',      (select count(*) from t where not done and not deleted and due < now()),
      'created_7',    (select count(*) from t where created_at >= now() - interval '7 days'),
      'done_7',       (select count(*) from t where done_at >= now() - interval '7 days'),
      'focus_7',      (select coalesce(round(sum(mins)), 0) from se where start_at >= now() - interval '7 days'),
      'rated',        (select count(*) from t where done and due is not null and done_at is not null),
      'on_time',      (select count(*) from t where done and due is not null and done_at <= due),
      'push',         (select count(distinct user_id) from public.push_subscriptions),
      'with_funnel',  (select count(*) from u where u.f ? 'firstOpen')
    ),
    -- กรวย: แต่ละขั้นนับจาก "คนที่ล็อกอินแล้ว" ทั้งหมด ไม่ใช่จากขั้นก่อนหน้า
    'funnel', json_build_object(
      'signed_in',  (select count(*) from per),
      'made_task',  (select count(*) from per where tasks_ever > 0),
      'did_task',   (select count(*) from per where done_ever > 0),
      'days_2',     (select count(*) from per where days_total >= 2),
      'days_7',     (select count(*) from per where days_total >= 7)
    ),
    'via', (select coalesce(json_object_agg(via, n), '{}'::json)
              from (select via, count(*) n from t group by via order by n desc) v),
    'screens', (select coalesce(json_object_agg(k, n), '{}'::json)
                  from (select k, count(*) n
                          from u, jsonb_object_keys(case when jsonb_typeof(u.f->'screens') = 'object' then u.f->'screens' else '{}'::jsonb end) k
                         group by k order by n desc) s),
    'versions', (select coalesce(json_object_agg(coalesce(ver, '?'), n), '{}'::json)
                   from (select ver, count(*) n from per group by ver order by n desc) v),
    'series', (select coalesce(json_agg(json_build_object(
                  'day', day, 'active', active, 'created', created, 'done', done, 'focus', focus_min) order by day), '[]'::json)
                 from series),
    'users', (select coalesce(json_agg(json_build_object(
                 'id', short_id, 'me', is_me, 'ver', ver,
                 'first', first_day, 'last', last_sync,
                 'days', days_total, 'days7', days_7,
                 'made', tasks_ever, 'done', done_ever, 'live', live,
                 'pending', pending, 'overdue', overdue,
                 'made7', created_7, 'done7', done_7, 'focus7', focus_7,
                 'rated', rated, 'onTime', on_time, 'via', via
               ) order by last_sync desc), '[]'::json)
                from (select * from per order by last_sync desc limit 500) p)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_analytics(int) from public;
grant execute on function public.admin_analytics(int) to authenticated;
revoke all on function public._sos_ts(text) from public;
revoke all on function public._sos_day(text) from public;
