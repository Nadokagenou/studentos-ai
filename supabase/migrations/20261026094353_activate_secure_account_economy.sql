insert into public.studentos_economy_admins(user_id) select id from auth.users where email_confirmed_at is not null and encode(extensions.digest(lower(trim(email)),'sha256'),'hex') in ('568431e398cceb7470cf0b7c2d825f26d6f269741a0aeb635443130f236829a6','0378159474d683e4cdab0a3fff7f4d6191c64dfb91905826cbe7ec377cbd7f42') on conflict do nothing;
-- Run once in the same transaction as the reviewed board update, after the services are verified and immediately before publishing the protected clients.
-- Existing user saves are copied, never deleted; future browser reward fields are ignored.
lock table public.user_state,public.staff_token_grants,public.staff_token_debits in share row exclusive mode;
insert into public.studentos_economy_baselines(user_id,data,at,staff_minted,staff_debited)
select s.id,s.data,(extract(epoch from clock_timestamp())*1000)::bigint,coalesce(g.n,0),coalesce(d.n,0) from public.user_state s
left join (select target,sum(amount) n from public.staff_token_grants group by target) g on g.target=s.id
left join (select target,sum(amount) n from public.staff_token_debits group by target) d on d.target=s.id
where not exists(select 1 from public.studentos_economy_release where id and active)
on conflict(user_id) do nothing;
insert into public.studentos_economy_completions(user_id,task_id,completed_at,task_key,legacy)
select b.user_id,x->>'id',bs.done_at,coalesce(x->>'subject','')||'|'||public._board_key(coalesce(x->>'detail',x->>'title',x->>'name')),true
from public.studentos_economy_baselines b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.data->'tasks')='array' then b.data->'tasks' else '[]'::jsonb end) x
join public.board_seen bs on bs.uid=b.user_id and bs.task_id=x->>'id'
where x->'done'='true'::jsonb and not coalesce(x->'deleted'='true'::jsonb,false) and bs.done_at is not null and bs.done_at-bs.first_at>=interval '5 minutes' and public._board_key(coalesce(x->>'detail',x->>'title',x->>'name')) is not null
on conflict do nothing;
update public.studentos_economy_release set active=true,activated_at=clock_timestamp() where id and not active;

CREATE OR REPLACE FUNCTION public.board(p_scope text DEFAULT 'all'::text, p_season text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  tz      constant text := 'Asia/Bangkok';
  day_cap constant int  := 10;
  v_me    uuid := auth.uid();
  v_today date := (now() at time zone tz)::date;
  v_q0    date;
  v_q1    date;
  v_t0    timestamptz;
  v_t1    timestamptz;
  v_key   text;
  v_scope text := case when p_scope = 'friends' then 'friends' else 'all' end;
  result  json;
begin
  if v_me is null then return null; end if;

  -- ซีซัน = ไตรมาส (ม.ค.–มี.ค. · เม.ย.–มิ.ย. · ก.ค.–ก.ย. · ต.ค.–ธ.ค.) ตามเวลาไทย
  -- ส่งรหัสซีซันเก่ามาได้ ('2026-Q3') — แอปใช้ดูอันดับตอนจบซีซันเพื่อแจกรางวัล
  if p_season ~ '^\d{4}-Q[1-4]$' then
    v_q0 := make_date(substr(p_season, 1, 4)::int, (substr(p_season, 7, 1)::int - 1) * 3 + 1, 1);
  else
    v_q0 := date_trunc('quarter', v_today)::date;
  end if;
  v_q1  := (v_q0 + interval '3 months')::date;
  v_key := to_char(v_q0, 'YYYY') || '-Q' || to_char(v_q0, 'Q');
  v_t0  := v_q0::timestamp at time zone tz;
  v_t1  := v_q1::timestamp at time zone tz;

  with
  pool as (
    select s.id, s.data
      from public.user_state s
     where s.id = v_me
        or (coalesce(s.data->'settings'->>'boardHide', '') <> 'true'
            and not public.is_blocked(v_me, s.id)
            and (
              (v_scope = 'friends' and exists (
                 select 1 from public.friendships f
                  where f.status = 'accepted'
                    and f.a = least(v_me, s.id) and f.b = greatest(v_me, s.id)))
              or (v_scope = 'all' and exists (
                 select 1 from public.profiles p
                  where p.id = s.id
                    and coalesce(p.age_band, '') <> 'under'))))
  ),
  -- งานที่ยังอยู่และติ๊กเสร็จ (จากก้อนปัจจุบัน) × เวลาที่เซิร์ฟเวอร์จดไว้
  -- ใบที่ยังไม่มีในสมุด = ยังไม่เคยซิงก์ผ่าน trigger → ยังไม่นับ (ซิงก์รอบหน้าก็มี)
  valid as (
    select pool.id as uid,
           ec.completed_at as done_at,
           (ec.completed_at at time zone tz)::date as day,
           ec.task_key as k
      from pool
     cross join lateral jsonb_array_elements(case when jsonb_typeof(pool.data->'tasks') = 'array'
                                                  then pool.data->'tasks' else '[]'::jsonb end) x
      join public.studentos_economy_completions ec on ec.user_id = pool.id and ec.task_id = x->>'id'
     where jsonb_typeof(x) = 'object'
       and x->'done' = 'true'::jsonb
       and not coalesce(x->'deleted' = 'true'::jsonb, false)
       and ec.completed_at is not null
       and ec.task_key is not null
  ),
  perday as (
    select uid, day, least(count(distinct k), day_cap) as n
      from valid
     where done_at >= v_t0 and done_at < v_t1
     group by uid, day
  ),
  score as (select uid, sum(n)::int as n from perday group by uid),
  -- วันติดกันที่มีงานเสร็จ (ที่นับได้) จบที่วันนี้หรือเมื่อวาน (วันนี้ยังไม่ได้ทำ ไม่ถือว่าขาด)
  days as (select distinct uid, day as d from valid),
  isl as (select uid, d, d - (row_number() over (partition by uid order by d))::int as g from days),
  runs as (select uid, max(d) as last_d, count(*)::int as len from isl group by uid, g),
  streak as (select uid, max(len) as n from runs where last_d >= v_today - 1 group by uid),
  ranked as (
    select pool.id,
           coalesce(score.n, 0) as n,
           coalesce(streak.n, 0) as streak,
           rank() over (order by coalesce(score.n, 0) desc) as rk,
           row_number() over (order by coalesce(score.n, 0) desc, coalesce(streak.n, 0) desc, pool.id) as pos
      from pool
      left join score on score.uid = pool.id
      left join streak on streak.uid = pool.id
     where coalesce(score.n, 0) > 0 or pool.id = v_me
  ),
  mine as (select * from ranked where id = v_me),
  -- 30 อันดับแรก + สองคนเหนือและใต้เรา (ถ้าเราอยู่ต่ำกว่านั้น) — กระดานทั้งแอปไม่ต้องลากลงมาทั้งก้อน
  shown as (
    -- exists ไม่ใช่ join กับ mine — คนที่ยังไม่เคยซิงก์ไม่มีแถวของตัวเอง แล้ว join จะได้กระดานเปล่า
    select r.* from ranked r
     where r.pos <= 30 or exists (select 1 from mine m where abs(r.pos - m.pos) <= 2)
  )
  select json_build_object(
    'season', json_build_object('key', v_key, 'start', v_q0, 'end', v_q1),
    'scope', v_scope,
    'total', (select count(*) from ranked),
    'hidden', (select coalesce(data->'settings'->>'boardHide', '') = 'true' from pool where id = v_me),
    'me', (select json_build_object('rank', rk, 'pos', pos, 'n', n, 'streak', streak) from mine),
    'rows', coalesce((
      select json_agg(json_build_object(
               'rank', s.rk, 'pos', s.pos, 'id', s.id, 'me', s.id = v_me,
               'name', p.display_name, 'handle', p.handle, 'avatar', p.avatar,
               'n', s.n, 'streak', s.streak)
             order by s.pos)
        from shown s
        left join public.profiles p on p.id = s.id
    ), '[]'::json)
  ) into result;

  return result;
end;
$function$;
