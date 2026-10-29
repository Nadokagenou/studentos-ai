-- Control Room insights: read-only numbers for the overview, usage, outcome and people pages.
-- Everything is derived from data the app already syncs (user_state.data) plus staff tables;
-- no new tables and no writes. Only service_role (staff-console, after the GitHub check) may call it.
-- Privacy: users are mostly under 18. Nothing here returns task titles, task details, chat text,
-- email or notes. Subject names are returned only in aggregate and only when at least two
-- people use the same subject at least three times, so one student's subject list never leaks.
-- Days are Thai days (Asia/Bangkok), the same as funnelDay() in the app.
begin;

create or replace function public._staff_ts(s text) returns timestamptz
language plpgsql stable set search_path='' as $$
begin
  if s is null or s !~ '^\d{4}-\d{2}-\d{2}' then return null; end if;
  return s::timestamptz;
exception when others then return null;
end $$;

create or replace function public._staff_day(s text) returns date
language plpgsql immutable set search_path='' as $$
begin
  if s is null or s !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return s::date;
exception when others then return null;
end $$;

create or replace function public._staff_int(s text) returns integer
language sql immutable set search_path='' as $$
  select case when s ~ '^\d{1,9}$' then s::integer end
$$;

-- One row per task. via: sync = imported by a calendar integration (its createdAt is the
-- import time, not a moment the student used the app), otherwise the source the app recorded.
create or replace function public.staff_x_tasks()
returns table(uid uuid, deleted boolean, done boolean, created_at timestamptz, done_at timestamptz,
  due timestamptz, via text, snooze integer, subject text, is_exam boolean)
language sql stable security definer set search_path='' as $$
  select s.id,
    coalesce(x->'deleted' = 'true'::jsonb, false),
    coalesce(x->'done' = 'true'::jsonb, false),
    public._staff_ts(x->>'createdAt'), public._staff_ts(x->>'doneAt'), public._staff_ts(x->>'due'),
    case when coalesce(x->>'srcKey','') <> '' then 'sync'
         when coalesce(x->>'sourceId','') <> '' then left(x->>'sourceId', 20)
         when x->'fromInbox' = 'true'::jsonb then 'inbox'
         when x->'fromScan' = 'true'::jsonb then 'scan'
         else 'manual' end,
    coalesce(public._staff_int(x->>'snoozeCount'), 0),
    nullif(left(btrim(coalesce(x->>'subject','')), 40), ''),
    coalesce(x->'isExam' = 'true'::jsonb, false)
  from public.user_state s,
    jsonb_array_elements(case when jsonb_typeof(s.data->'tasks') = 'array' then s.data->'tasks' else '[]'::jsonb end) x
  where jsonb_typeof(x) = 'object'
$$;

create or replace function public.staff_x_sessions()
returns table(uid uuid, start_at timestamptz, mins numeric)
language sql stable security definer set search_path='' as $$
  select s.id, public._staff_ts(x->>'start'),
    greatest(0, least(coalesce(case when (x->>'min') ~ '^\d+(\.\d+)?$' then (x->>'min')::numeric end, 0), 600))
  from public.user_state s,
    jsonb_array_elements(case when jsonb_typeof(s.data->'sessions') = 'array' then s.data->'sessions' else '[]'::jsonb end) x
  where jsonb_typeof(x) = 'object'
$$;

-- A day counts as "used" when the app left a trace that day: opened (dayLog), created or
-- finished a task, started a focus timer, or synced. Same rule as admin_analytics().
create or replace function public.staff_x_activity()
returns table(uid uuid, day date)
language sql stable security definer set search_path='' as $$
  select distinct a.uid, a.day from (
    select s.id uid, public._staff_day(d) as day from public.user_state s,
      jsonb_array_elements_text(case when jsonb_typeof(s.data#>'{funnel,dayLog}') = 'array' then s.data#>'{funnel,dayLog}' else '[]'::jsonb end) d
    union all select t.uid, (t.created_at at time zone 'Asia/Bangkok')::date from public.staff_x_tasks() t where t.via <> 'sync'
    union all select t.uid, (t.done_at at time zone 'Asia/Bangkok')::date from public.staff_x_tasks() t
    union all select x.uid, (x.start_at at time zone 'Asia/Bangkok')::date from public.staff_x_sessions() x
    union all select s.id, (s.updated_at at time zone 'Asia/Bangkok')::date from public.user_state s
  ) a
  where a.day is not null and a.day <= (now() at time zone 'Asia/Bangkok')::date
$$;

-- Per-person numbers used by the people list, the person drawer and the overview.
create or replace function public.staff_x_people()
returns table(id uuid, display_name text, handle text, grade text, hear text, ver text, dev text, path text,
  notif text, push_devices integer, line_linked boolean, first_day date, last_day date, days_total integer,
  act text, made integer, done integer, pending integer, overdue integer, rated integer, on_time integer,
  focus_7 integer, screens integer, balance numeric, banned boolean, ban_until timestamptz, last_sync timestamptz)
language sql stable security definer set search_path='' as $$
  with today as (select (now() at time zone 'Asia/Bangkok')::date d),
  t as (select * from public.staff_x_tasks()),
  act as (select * from public.staff_x_activity()),
  tagg as (
    select t.uid, count(*) made_n, count(*) filter (where t.done) done_n,
      count(*) filter (where not t.done and not t.deleted) pending_n,
      count(*) filter (where not t.done and not t.deleted and t.due < now()) overdue_n,
      count(*) filter (where t.done and t.due is not null and t.done_at is not null) rated_n,
      count(*) filter (where t.done and t.due is not null and t.done_at <= t.due) on_time_n
    from t group by t.uid),
  sagg as (select x.uid, round(sum(x.mins) filter (where x.start_at >= now() - interval '7 days'))::integer m from public.staff_x_sessions() x group by x.uid),
  diag as (
    select s.id uid, d.value v from public.user_state s
    cross join lateral (
      select e.value from jsonb_each(case when jsonb_typeof(s.data->'pushDiag') = 'object' then s.data->'pushDiag' else '{}'::jsonb end) e
      where jsonb_typeof(e.value) = 'object' order by e.value->>'day' desc nulls last limit 1) d)
  select s.id, p.display_name, p.handle,
    nullif(left(s.data#>>'{settings,grade}', 12), ''), nullif(left(s.data#>>'{settings,hearFrom}', 20), ''),
    nullif(left(s.data#>>'{funnel,ver}', 12), ''),
    nullif(left(diag.v->>'dev', 12), ''), nullif(left(diag.v->>'path', 12), ''),
    nullif(left(s.data#>>'{funnel,notif}', 12), ''),
    (select count(*)::integer from public.push_subscriptions ps where ps.user_id = s.id),
    nullif(s.data#>>'{funnel,lineLinkedAt}', '') is not null,
    aagg.first_d, aagg.last_d, coalesce(aagg.n, 0)::integer,
    coalesce((select string_agg(case when exists (select 1 from act x where x.uid = s.id and x.day = g::date) then '1' else '0' end, '' order by g)
       from generate_series((select d from today) - 29, (select d from today), interval '1 day') g), repeat('0', 30)),
    greatest(coalesce(public._staff_int(s.data#>>'{funnel,tasksEver}'), 0), coalesce(tagg.made_n, 0))::integer,
    greatest(coalesce(public._staff_int(s.data#>>'{funnel,doneEver}'), 0), coalesce(tagg.done_n, 0))::integer,
    coalesce(tagg.pending_n, 0)::integer, coalesce(tagg.overdue_n, 0)::integer,
    coalesce(tagg.rated_n, 0)::integer, coalesce(tagg.on_time_n, 0)::integer,
    coalesce(sagg.m, 0),
    (select count(*)::integer from jsonb_object_keys(case when jsonb_typeof(s.data#>'{funnel,screens}') = 'object' then s.data#>'{funnel,screens}' else '{}'::jsonb end)),
    case when coalesce(s.data#>>'{vault,tokens,bal}', '') ~ '^\d{1,12}(\.\d{1,6})?$' then (s.data#>>'{vault,tokens,bal}')::numeric else 0 end,
    b.target is not null and b.revoked_at is null and (b.expires_at is null or b.expires_at > now()),
    case when b.revoked_at is null then b.expires_at end,
    s.updated_at
  from public.user_state s
  left join public.profiles p on p.id = s.id
  left join tagg on tagg.uid = s.id
  left join (select uid, min(day) first_d, max(day) last_d, count(*) n from act group by uid) aagg on aagg.uid = s.id
  left join sagg on sagg.uid = s.id
  left join diag on diag.uid = s.id
  left join public.staff_account_bans b on b.target = s.id
$$;

-- Counts from optional tables that live outside the staff migrations. A missing table reads as null
-- (shown as "ยังไม่มีข้อมูล") instead of failing the whole page.
create or replace function public._staff_optional_count(p_sql text) returns bigint
language plpgsql stable security definer set search_path='' as $$
declare n bigint;
begin
  execute p_sql into n;
  return n;
exception when undefined_table or undefined_column then return null;
end $$;

create or replace function public.staff_insights(p_actor uuid, p_login text, p_action text, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  tz constant text := 'Asia/Bangkok';
  today date := (now() at time zone 'Asia/Bangkok')::date;
  n_days integer; d0 date; p0 date; chart0 date; heat0 date;
  latest text; f text; q text; off_n integer; target uuid;
  result jsonb;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) or nullif(p_login, '') is null then
    raise exception 'Invalid staff request';
  end if;
  if p_action not in ('insights', 'people', 'person') then raise exception 'Unknown insights action'; end if;

  create temp table if not exists pg_temp._sx_people on commit drop as select * from public.staff_x_people() limit 0;
  truncate pg_temp._sx_people;
  insert into pg_temp._sx_people select * from public.staff_x_people();
  -- "Latest version" = newest build seen in the last 30 days, so a stale test build can't define it.
  select max(ver) into latest from pg_temp._sx_people where last_day >= today - 29 and ver is not null;

  if p_action = 'people' then
    f := coalesce(p_payload->>'filter', 'all');
    if f not in ('all', 'today', 'gone', 'new', 'stuck', 'nopush', 'old', 'banned') then raise exception 'Unknown people filter'; end if;
    q := lower(ltrim(left(btrim(coalesce(p_payload->>'query', '')), 100), '@'));
    off_n := greatest(0, least(coalesce(public._staff_int(p_payload->>'offset'), 0), 100000));
    with tagged as (
      select p.*,
        p.last_day = today as is_today,
        p.last_day < today - 3 as is_gone,
        p.first_day >= today - 6 as is_new,
        p.made = 0 as is_stuck,
        p.push_devices = 0 as is_nopush,
        latest is not null and p.ver is distinct from latest and p.last_day >= today - 29 as is_old
      from pg_temp._sx_people p),
    hit as (
      select * from tagged t
      where (f = 'all' or (f = 'today' and is_today) or (f = 'gone' and is_gone) or (f = 'new' and is_new)
          or (f = 'stuck' and is_stuck) or (f = 'nopush' and is_nopush) or (f = 'old' and is_old) or (f = 'banned' and banned))
        and (q = '' or lower(coalesce(t.handle, '')) like '%' || q || '%' or lower(coalesce(t.display_name, '')) like '%' || q || '%'
             or t.id::text like q || '%')
      order by t.last_day desc nulls last, t.id
      limit 51 offset off_n)
    select jsonb_build_object(
      'latest', latest, 'today', today,
      'counts', (select jsonb_build_object('all', count(*), 'today', count(*) filter (where is_today), 'gone', count(*) filter (where is_gone),
         'new', count(*) filter (where is_new), 'stuck', count(*) filter (where is_stuck), 'nopush', count(*) filter (where is_nopush),
         'old', count(*) filter (where is_old), 'banned', count(*) filter (where banned)) from tagged),
      'has_more', (select count(*) > 50 from hit),
      'items', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'display_name', h.display_name, 'handle', h.handle, 'grade', h.grade,
         'ver', h.ver, 'dev', h.dev, 'push_devices', h.push_devices, 'first_day', h.first_day, 'last_day', h.last_day, 'days_total', h.days_total,
         'act', right(h.act, 14), 'made', h.made, 'done', h.done, 'rated', h.rated, 'on_time', h.on_time, 'balance', h.balance,
         'banned', h.banned, 'old', h.is_old) order by h.last_day desc nulls last, h.id)
         from (select * from hit limit 50) h), '[]'::jsonb))
    into result;
    return result;
  end if;

  if p_action = 'person' then
    target := case when coalesce(p_payload->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_payload->>'id')::uuid end;
    if target is null then raise exception 'Invalid person'; end if;
    select to_jsonb(p) - 'last_sync' || jsonb_build_object(
        'last_sync', p.last_sync, 'latest', latest, 'today', today,
        'granted', (select coalesce(sum(g.amount), 0) from public.staff_token_grants g where g.target = p.id),
        'last_grant_at', (select max(g.created_at) from public.staff_token_grants g where g.target = p.id),
        'debited', (select coalesce(sum(d.amount), 0) from public.staff_token_debits d where d.target = p.id),
        'ban_reason', (select b.reason from public.staff_account_bans b where b.target = p.id and b.revoked_at is null and (b.expires_at is null or b.expires_at > now())),
        'ever_banned', exists (select 1 from public.staff_account_bans b where b.target = p.id),
        'bug_reports', public._staff_optional_count(format('select count(*) from public.bug_reports where user_id = %L', p.id)))
      into result
    from pg_temp._sx_people p where p.id = target;
    if result is null then raise exception 'Person not found'; end if;
    return result;
  end if;

  -- insights
  n_days := case when public._staff_int(p_payload->>'days') in (1, 7, 30, 90) then public._staff_int(p_payload->>'days') else 7 end;
  d0 := today - (n_days - 1);           -- this period
  p0 := d0 - n_days;                    -- the period before, same length
  chart0 := today - (greatest(n_days, 14) - 1);
  heat0 := today - (greatest(n_days, 30) - 1);

  create temp table if not exists pg_temp._sx_tasks on commit drop as select * from public.staff_x_tasks() limit 0;
  truncate pg_temp._sx_tasks; insert into pg_temp._sx_tasks select * from public.staff_x_tasks();
  create temp table if not exists pg_temp._sx_act on commit drop as select * from public.staff_x_activity() limit 0;
  truncate pg_temp._sx_act; insert into pg_temp._sx_act select * from public.staff_x_activity();
  create temp table if not exists pg_temp._sx_sess on commit drop as select * from public.staff_x_sessions() limit 0;
  truncate pg_temp._sx_sess; insert into pg_temp._sx_sess select * from public.staff_x_sessions();

  with
  win as (select d0 c0, today c1, p0 q0, d0 - 1 q1),
  period as (
    select k, a, b from (values ('cur', d0, today), ('prev', p0, d0 - 1)) v(k, a, b)),
  pk as (
    select per.k, jsonb_build_object(
      'active', (select count(distinct uid) from pg_temp._sx_act x where x.day between per.a and per.b),
      'new', (select count(*) from pg_temp._sx_people p where p.first_day between per.a and per.b),
      'created', (select count(*) from pg_temp._sx_tasks t where t.via <> 'sync' and (t.created_at at time zone tz)::date between per.a and per.b),
      'done', (select count(*) from pg_temp._sx_tasks t where t.done and (t.done_at at time zone tz)::date between per.a and per.b),
      'rated', (select count(*) from pg_temp._sx_tasks t where t.done and t.due is not null and (t.done_at at time zone tz)::date between per.a and per.b),
      'on_time', (select count(*) from pg_temp._sx_tasks t where t.done and t.due is not null and t.done_at <= t.due and (t.done_at at time zone tz)::date between per.a and per.b),
      'focus', (select coalesce(round(sum(mins)), 0) from pg_temp._sx_sess x where (x.start_at at time zone tz)::date between per.a and per.b)) v
    from period per),
  series as (
    select g::date as day,
      (select count(distinct uid) from pg_temp._sx_act x where x.day = g::date) active,
      (select count(*) from pg_temp._sx_tasks t where t.via <> 'sync' and (t.created_at at time zone tz)::date = g::date) created,
      (select count(*) from pg_temp._sx_tasks t where t.done and (t.done_at at time zone tz)::date = g::date) done
    from generate_series(chart0, today, interval '1 day') g),
  ev as (
    select created_at at time zone tz ts from pg_temp._sx_tasks where via <> 'sync' and created_at is not null
    union all select done_at at time zone tz from pg_temp._sx_tasks where done_at is not null
    union all select start_at at time zone tz from pg_temp._sx_sess where start_at is not null),
  heat as (
    select (extract(isodow from ts)::int - 1) * 24 + extract(hour from ts)::int cell, count(*) n
    from ev where ts::date between heat0 and today group by 1),
  cohort as (
    select p.id, p.first_day from pg_temp._sx_people p where p.first_day is not null)
  select jsonb_build_object(
    'generated_at', now(), 'today', today, 'days', n_days, 'latest', latest,
    'period', jsonb_build_object('from', d0, 'to', today, 'prev_from', p0, 'prev_to', d0 - 1),
    'kpi', (select jsonb_object_agg(k, v) from pk),
    'today_vs', jsonb_build_object(
      'today', (select count(distinct uid) from pg_temp._sx_act where day = today),
      'yesterday', (select count(distinct uid) from pg_temp._sx_act where day = today - 1),
      'last_week', (select count(distinct uid) from pg_temp._sx_act where day = today - 7)),
    'users', (select count(*) from pg_temp._sx_people),
    'retention', jsonb_build_object(
      'd1_base', (select count(*) from cohort where first_day <= today - 1),
      'd1', (select count(*) from cohort c where c.first_day <= today - 1 and exists (select 1 from pg_temp._sx_act a where a.uid = c.id and a.day = c.first_day + 1)),
      'w1_base', (select count(*) from cohort where first_day <= today - 7),
      'w1', (select count(*) from cohort c where c.first_day <= today - 7 and exists (select 1 from pg_temp._sx_act a where a.uid = c.id and a.day >= c.first_day + 7))),
    'funnel', jsonb_build_object(
      'signed_in', (select count(*) from pg_temp._sx_people),
      'made_task', (select count(*) from pg_temp._sx_people where made > 0),
      'did_task', (select count(*) from pg_temp._sx_people where done > 0),
      'days_2', (select count(*) from pg_temp._sx_people where days_total >= 2),
      'days_7', (select count(*) from pg_temp._sx_people where days_total >= 7),
      'push', (select count(*) from pg_temp._sx_people where push_devices > 0)),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'active', active, 'created', created, 'done', done) order by day), '[]'::jsonb) from series),
    'heat', (select jsonb_agg(coalesce(h.n, 0) order by g) from generate_series(0, 167) g left join heat h on h.cell = g),
    'heat_events', (select count(*) from ev where ts::date between heat0 and today),
    'heat_from', heat0,
    'weekday', (select jsonb_agg(coalesce(w.avg, 0) order by g) from generate_series(1, 7) g left join (
        select extract(isodow from s.day)::int dow, round(avg(s.active), 1) avg from series s group by 1) w on w.dow = g),
    'screens', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select k, count(*) n from public.user_state s,
          jsonb_object_keys(case when jsonb_typeof(s.data#>'{funnel,screens}') = 'object' then s.data#>'{funnel,screens}' else '{}'::jsonb end) k
        group by k) z),
    'screens_base', (select count(*) from public.user_state s where jsonb_typeof(s.data#>'{funnel,screens}') = 'object'),
    'via', (select coalesce(jsonb_object_agg(via, n), '{}'::jsonb) from (select via, count(*) n from pg_temp._sx_tasks group by via) z),
    'devices', (select coalesce(jsonb_object_agg(coalesce(dev, 'unknown'), n), '{}'::jsonb) from (select dev, count(*) n from pg_temp._sx_people group by dev) z),
    'paths', (select coalesce(jsonb_object_agg(coalesce(path, 'unknown'), n), '{}'::jsonb) from (select path, count(*) n from pg_temp._sx_people group by path) z),
    'grades', (select coalesce(jsonb_object_agg(coalesce(grade, 'unknown'), n), '{}'::jsonb) from (select grade, count(*) n from pg_temp._sx_people group by grade) z),
    'hear', (select coalesce(jsonb_object_agg(coalesce(hear, 'unknown'), n), '{}'::jsonb) from (select hear, count(*) n from pg_temp._sx_people group by hear) z),
    'versions', (select coalesce(jsonb_object_agg(coalesce(ver, 'unknown'), n), '{}'::jsonb) from (select ver, count(*) n from pg_temp._sx_people group by ver) z),
    'subjects', (select coalesce(jsonb_agg(jsonb_build_object('name', subject, 'tasks', n) order by n desc), '[]'::jsonb) from (
        select subject, count(*) n from pg_temp._sx_tasks where subject is not null and not deleted
        group by subject having count(*) >= 3 and count(distinct uid) >= 2 order by count(*) desc limit 8) z),
    'snooze', jsonb_build_object(
      'none', (select count(*) from pg_temp._sx_tasks where not deleted and snooze = 0),
      'once', (select count(*) from pg_temp._sx_tasks where not deleted and snooze = 1),
      'few', (select count(*) from pg_temp._sx_tasks where not deleted and snooze between 2 and 3),
      'many', (select count(*) from pg_temp._sx_tasks where not deleted and snooze > 3)),
    'pace', jsonb_build_object(
      'lead_days', (select round((percentile_cont(0.5) within group (order by extract(epoch from done_at - created_at) / 86400))::numeric, 1)
         from pg_temp._sx_tasks where done and via <> 'sync' and done_at > created_at and (done_at at time zone tz)::date between heat0 and today),
      'early_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from due - done_at) / 3600))::numeric, 0)
         from pg_temp._sx_tasks where done and due is not null and done_at <= due and (done_at at time zone tz)::date between heat0 and today),
      'exams', (select count(*) from pg_temp._sx_tasks where is_exam and not deleted and (due at time zone tz)::date between heat0 and today),
      'exams_ready', (select count(*) from pg_temp._sx_tasks where is_exam and not deleted and done and done_at <= due and (due at time zone tz)::date between heat0 and today)),
    'backlog', jsonb_build_object(
      'pending', (select coalesce(sum(pending), 0) from pg_temp._sx_people), 'overdue', (select coalesce(sum(overdue), 0) from pg_temp._sx_people)),
    'gone', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'display_name', display_name, 'handle', handle, 'last_day', last_day) order by last_day desc), '[]'::jsonb)
       from (select * from pg_temp._sx_people where last_day < today - 3 order by last_day desc limit 5) z),
    'gone_count', (select count(*) from pg_temp._sx_people where last_day < today - 3),
    'stuck_count', (select count(*) from pg_temp._sx_people where made = 0),
    'old_count', (select count(*) from pg_temp._sx_people where latest is not null and ver is distinct from latest and last_day >= today - 29),
    'economy', jsonb_build_object(
      'circulating', (select coalesce(round(sum(balance)), 0) from pg_temp._sx_people),
      'granted', (select coalesce(sum(amount), 0) from public.staff_token_grants where (created_at at time zone tz)::date between d0 and today),
      'debited', (select coalesce(sum(amount), 0) from public.staff_token_debits where (created_at at time zone tz)::date between d0 and today),
      'completions', public._staff_optional_count(format('select count(*) from public.studentos_economy_completions where (completed_at at time zone %L)::date between %L and %L', tz, d0, today)),
      'event_players', public._staff_optional_count('select count(distinct user_id) from public.halloween_states'),
      'invite_codes', public._staff_optional_count('select count(*) from public.invite_codes'),
      'invites_used', public._staff_optional_count('select count(*) from public.invite_redemptions')),
    'health', jsonb_build_object(
      'push_users', (select count(distinct user_id) from public.push_subscriptions),
      'push_accepted_7d', (select count(*) from public.staff_push_jobs where status = 'accepted' and finished_at > now() - interval '7 days'),
      'push_failed_7d', (select count(*) from public.staff_push_jobs where status = 'failed' and coalesce(finished_at, claimed_at) > now() - interval '7 days'),
      'push_pending', (select count(*) from public.staff_push_jobs where status = 'pending'),
      'reminders_7d', public._staff_optional_count('select count(*) from public.push_sent where sent_at > now() - interval ''7 days'''),
      'bugs_open', public._staff_optional_count('select count(*) from public.bug_reports where status <> ''resolved'''),
      'reports_open', (select count(*) from public.reports r left join public.staff_report_triage t on t.report_id = r.id where coalesce(t.status, 'open') <> 'closed'),
      'integration_errors', public._staff_optional_count('select count(*) from public.integrations where status = ''error'''),
      'bans_active', (select count(*) from public.staff_account_bans b where b.revoked_at is null and (b.expires_at is null or b.expires_at > now())))
  ) into result;
  return result;
end $$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'public._staff_ts(text)', 'public._staff_day(text)', 'public._staff_int(text)',
    'public.staff_x_tasks()', 'public.staff_x_sessions()', 'public.staff_x_activity()', 'public.staff_x_people()',
    'public._staff_optional_count(text)', 'public.staff_insights(uuid,text,text,jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
