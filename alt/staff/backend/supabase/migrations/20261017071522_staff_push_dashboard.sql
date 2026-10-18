begin;
create index if not exists staff_push_finished_recent on public.staff_push_jobs(finished_at desc) where status='accepted';
create function public.staff_push_dashboard(p_actor uuid,p_login text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; bucket text:=coalesce(p_payload->>'status','all'); off_n integer;
  local_now timestamp:=now() at time zone 'Asia/Bangkok'; quiet boolean; resume_at timestamptz;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) or nullif(p_login,'') is null or p_action<>'push_status' then raise exception 'Invalid staff request'; end if;
  if bucket not in ('all','pending','sending','accepted','failed','cancelled') then raise exception 'Invalid push status'; end if;
  off_n:=greatest(0,least(coalesce((p_payload->>'offset')::integer,0),100000));
  quiet:=extract(hour from local_now)<7 or extract(hour from local_now)>=22;
  if quiet then resume_at:=(date_trunc('day',local_now)+interval '7 hours'+case when extract(hour from local_now)>=22 then interval '1 day' else interval '0' end) at time zone 'Asia/Bangkok'; end if;
  select jsonb_build_object('items',coalesce(jsonb_agg(x),'[]'::jsonb),'has_more',count(*)>20) into result from (
    select n.id,n.title,n.published_at,case when n.audience_id is null then 'public' else 'personal' end audience,
      count(*)::integer total,count(*) filter(where j.status='pending')::integer pending,
      count(*) filter(where j.status='sending')::integer sending,count(*) filter(where j.status='accepted')::integer accepted,
      count(*) filter(where j.status='failed')::integer failed,count(*) filter(where j.status='cancelled')::integer cancelled,
      max(j.attempts) attempts,max(j.finished_at) finished_at,
      round(avg(extract(epoch from (j.finished_at-n.published_at))) filter(where j.status='accepted')::numeric,2) delivery_seconds
    from public.staff_notices n join public.staff_push_jobs j on j.notice_id=n.id
    where bucket='all' or exists(select 1 from public.staff_push_jobs f where f.notice_id=n.id and f.status=bucket)
    group by n.id order by n.published_at desc,n.id limit 21 offset off_n
  )x;
  return result||jsonb_build_object('items',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(result->'items') with ordinality x(value,n) where x.n<=20),'[]'::jsonb),
    'generated_at',clock_timestamp(),'quiet_hours',quiet,'resume_at',resume_at,
    'metrics',(select jsonb_build_object('pending',count(*) filter(where status='pending'),'sending',count(*) filter(where status='sending'),
      'accepted_24h',count(*) filter(where status='accepted' and finished_at>now()-interval '24 hours'),
      'failed',count(*) filter(where status='failed'),'cancelled_24h',count(*) filter(where status='cancelled' and coalesce(finished_at,claimed_at)>now()-interval '24 hours')) from public.staff_push_jobs),
    'oldest_pending_at',(select min(n.published_at) from public.staff_push_jobs j join public.staff_notices n on n.id=j.notice_id where j.status='pending'));
end $$;
revoke all on function public.staff_push_dashboard(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.staff_push_dashboard(uuid,text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
