-- Control Room report buckets and reversible removal. No source report,
-- post, account, student-visible bug history, notification or wallet is deleted.
begin;
create table public.staff_report_archive (
  kind text not null check(kind in ('bug','content')),
  report_key text not null,
  deleted_at timestamptz,
  actor uuid references auth.users(id) on delete set null,
  primary key(kind,report_key)
);
alter table public.staff_report_archive enable row level security;
revoke all on public.staff_report_archive from public,anon,authenticated,service_role;
create policy staff_archive_service on public.staff_report_archive for select to service_role using(true);
create index staff_report_audit_lookup on public.staff_audit((payload->>'id'),action,created_at desc)
  where action in ('triage','report_trash','report_restore');

create function studentos_private.staff_report_list(p_kind text,p_bucket text,p_offset integer)
returns jsonb language sql stable security invoker set search_path='' as $$
  with source as (
    select br.id::text report_key,br.status,br.created_at,to_jsonb(br)-'user_id'-'request_fingerprint' data
    from public.bug_reports br where p_kind='bug'
    union all
    select r.id::text,coalesce(t.status,'open'),r.created_at,
      jsonb_build_object('id',r.id,'kind',r.kind,'reason',r.reason,'note',r.note,'created_at',r.created_at,'status',coalesce(t.status,'open'),'staff_note',coalesce(t.note,''))
    from public.reports r left join public.staff_report_triage t on t.report_id=r.id where p_kind='content'
  ), classified as (
    select s.*,a.deleted_at,case when a.deleted_at is not null then 'trash' when s.status in ('resolved','closed') then 'resolved' else 'pending' end bucket
    from source s left join public.staff_report_archive a on a.kind=p_kind and a.report_key=s.report_key
  ), page as (
    select * from classified where bucket=p_bucket order by created_at desc,report_key limit 21 offset greatest(0,least(coalesce(p_offset,0),100000))
  ) select jsonb_build_object(
    'items',coalesce((select jsonb_agg(item order by created_at desc,report_key) from (
      select p.created_at,p.report_key,p.data||jsonb_build_object('deleted_at',p.deleted_at)||
        case when p_kind='bug' then jsonb_build_object('events',coalesce((select jsonb_agg(e order by e.created_at,e.id) from (
          select ev.id,ev.status,ev.author_kind,ev.reply,ev.created_at from public.bug_report_events ev
          where ev.report_id=p.report_key::uuid order by ev.created_at desc,ev.id desc limit 100)e),'[]'::jsonb)) else '{}'::jsonb end ||
        jsonb_build_object('staff_events',coalesce((select jsonb_agg(e order by e.created_at,e.id) from (
          select a.id,a.action,a.payload->>'status' status,a.payload->>'note' note,a.actor_login,a.created_at from public.staff_audit a
          where a.payload->>'id'=p.report_key and (
            (p_kind='content' and a.action='triage') or
            (a.action in ('report_trash','report_restore') and a.payload->>'kind'=p_kind)
          ) order by a.created_at desc,a.id desc limit 100)e),'[]'::jsonb)) item
      from page p order by p.created_at desc,p.report_key limit 20)x),'[]'::jsonb),
    'has_more',(select count(*)>20 from page),
    'open_count',(select count(*) from classified where bucket='pending'),
    'counts',jsonb_build_object('pending',(select count(*) from classified where bucket='pending'),'resolved',(select count(*) from classified where bucket='resolved'),'trash',(select count(*) from classified where bucket='trash'))
  );
$$;
revoke all on function studentos_private.staff_report_list(text,text,integer) from public,anon,authenticated,service_role;

create function studentos_private.staff_report_command(p_actor uuid,p_login text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bucket_s text:=coalesce(p_payload->>'bucket','pending'); kind_s text; key_s text; state_s text; req uuid; prior public.staff_audit; deleted timestamptz; result jsonb;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) or p_login is null or length(p_login)>100 then raise exception 'Invalid actor'; end if;
  if p_action in ('bugs','issues') then
    if bucket_s not in ('pending','resolved','trash') then raise exception 'Invalid report bucket'; end if;
    return studentos_private.staff_report_list(case when p_action='bugs' then 'bug' else 'content' end,bucket_s,(p_payload->>'offset')::integer);
  end if;
  if p_action not in ('triage','bug_triage','report_trash','report_restore') then raise exception 'Unknown report command'; end if;
  req:=(p_payload->>'request_id')::uuid;
  if req is null then raise exception 'Request ID required'; end if;
  kind_s:=case when p_action='triage' then 'content' when p_action='bug_triage' then 'bug' else p_payload->>'kind' end;
  key_s:=p_payload->>'id';
  if kind_s is null or kind_s not in ('bug','content') or key_s is null then raise exception 'Invalid report'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
  select * into prior from public.staff_audit where id=req;
  if found then
    if prior.actor<>p_actor or prior.action<>p_action or prior.payload<>p_payload then raise exception 'Request ID payload mismatch'; end if;
    return jsonb_build_object('id',req,'duplicate',true);
  end if;
  if kind_s='bug' then
    -- Canonical UUID strings also prevent case variants from bypassing archive state.
    key_s:=(key_s::uuid)::text;
    select status into state_s from public.bug_reports where id=key_s::uuid for update;
    if not found then raise exception 'Report not found'; end if;
  else
    key_s:=(key_s::bigint)::text;
    perform 1 from public.reports where id=key_s::bigint for update;
    if not found then raise exception 'Report not found'; end if;
    select coalesce((select status from public.staff_report_triage where report_id=key_s::bigint),'open') into state_s;
  end if;
  select deleted_at into deleted from public.staff_report_archive where kind=kind_s and report_key=key_s;
  if p_action in ('triage','bug_triage') then
    if deleted is not null then raise exception 'Report is in trash; restore it first'; end if;
    if p_action='triage' then return public.staff_command(p_actor,p_login,p_action,p_payload);
    else return public.staff_bug_command(p_actor,p_login,p_action,p_payload); end if;
  elsif p_action='report_trash' then
    if state_s not in ('closed','resolved') then raise exception 'Only completed reports can be removed'; end if;
    if deleted is not null then raise exception 'Report is already in trash'; end if;
    insert into public.staff_report_archive(kind,report_key,deleted_at,actor) values(kind_s,key_s,now(),p_actor)
      on conflict(kind,report_key) do update set deleted_at=excluded.deleted_at,actor=excluded.actor;
  else
    if deleted is null then raise exception 'Report is not in trash'; end if;
    update public.staff_report_archive set deleted_at=null,actor=p_actor where kind=kind_s and report_key=key_s;
  end if;
  insert into public.staff_audit(id,actor,actor_login,action,detail,payload)
    values(req,p_actor,p_login,p_action,(case when p_action='report_trash' then 'ย้ายเข้าถังขยะ: ' else 'กู้คืน: ' end)||kind_s||' #'||left(key_s,16),p_payload);
  return jsonb_build_object('id',req,'ok',true);
end $$;
revoke all on function studentos_private.staff_report_command(uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function studentos_private.staff_report_command(uuid,text,text,jsonb) to service_role;
create function public.staff_report_command(p_actor uuid,p_login text,p_action text,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$select studentos_private.staff_report_command(p_actor,p_login,p_action,p_payload)$$;
revoke all on function public.staff_report_command(uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.staff_report_command(uuid,text,text,jsonb) to service_role;
commit;
