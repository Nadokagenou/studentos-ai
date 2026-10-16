-- ALT app bug reports. Apply after the existing Control Room migration.
-- No notices, Push jobs, wallets, user_state, or content reports are written.
begin;
create schema if not exists studentos_private;
revoke all on schema studentos_private from public, anon, authenticated;
grant usage on schema studentos_private to authenticated, service_role;

create table public.bug_reports (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('tasks','scan','sync','notifications','display','other')),
  page text not null check (page in ('หน้าแรก','งานของฉัน','แผนวันนี้','สแกนและเพิ่มงาน','ตัวเชื่อม','แจ้งเตือน','ผู้ช่วย','เพื่อนและแชต','ร้านค้าและของฉัน','บัญชีและตั้งค่า','อื่น ๆ')),
  summary text not null check (length(btrim(summary)) between 5 and 120),
  detail text not null check (length(btrim(detail)) between 10 and 2000),
  steps text not null check (length(btrim(steps)) between 5 and 2000),
  expected text not null default '' check (length(expected)<=1000),
  diagnostics jsonb,
  request_fingerprint text not null,
  status text not null default 'open' check (status in ('open','reviewing','needs_info','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bug_reports_owner on public.bug_reports(user_id,created_at desc,id);
create index bug_reports_recent on public.bug_reports(created_at desc,id);
create table public.bug_report_events (
  id uuid primary key,
  report_id uuid not null references public.bug_reports(id) on delete cascade,
  status text not null check (status in ('open','reviewing','needs_info','resolved')),
  author_kind text not null check (author_kind in ('reporter','staff')),
  reply text not null default '' check (length(reply)<=1500),
  created_at timestamptz not null default now()
);
create index bug_report_events_report on public.bug_report_events(report_id,created_at,id);
alter table public.bug_reports enable row level security;
alter table public.bug_report_events enable row level security;
revoke all on public.bug_reports, public.bug_report_events from public,anon,authenticated,service_role;
grant select on public.bug_reports, public.bug_report_events to authenticated;
create policy bug_reports_own on public.bug_reports for select to authenticated using ((select auth.uid())=user_id);
create policy bug_events_own on public.bug_report_events for select to authenticated using (
  exists(select 1 from public.bug_reports r where r.id=report_id and r.user_id=(select auth.uid()))
);

-- Privileged writes live outside the exposed schema, with explicit caller checks.
create function studentos_private.submit_bug_report(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); prior public.bug_reports; diag jsonb:=p_payload->'diagnostics';
begin
  if uid is null or not exists(select 1 from auth.users where id=uid) then raise exception 'BUG_AUTH'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'BUG_INVALID'; end if;
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('category','page','summary','detail','steps','expected','diagnostics')) then raise exception 'BUG_INVALID'; end if;
  if exists(select 1 from jsonb_each(p_payload) x where x.key<>'diagnostics' and jsonb_typeof(x.value)<>'string') then raise exception 'BUG_INVALID'; end if;
  if coalesce(p_payload->>'category','') not in ('tasks','scan','sync','notifications','display','other')
    or coalesce(p_payload->>'page','') not in ('หน้าแรก','งานของฉัน','แผนวันนี้','สแกนและเพิ่มงาน','ตัวเชื่อม','แจ้งเตือน','ผู้ช่วย','เพื่อนและแชต','ร้านค้าและของฉัน','บัญชีและตั้งค่า','อื่น ๆ')
    or length(btrim(coalesce(p_payload->>'summary',''))) not between 5 and 120
    or length(btrim(coalesce(p_payload->>'detail',''))) not between 10 and 2000
    or length(btrim(coalesce(p_payload->>'steps',''))) not between 5 and 2000
    or length(coalesce(p_payload->>'expected',''))>1000 then raise exception 'BUG_INVALID'; end if;
  if diag is not null and diag<>'null'::jsonb then
    if jsonb_typeof(diag)<>'object' then raise exception 'BUG_INVALID'; end if;
    if exists(select 1 from jsonb_object_keys(diag) k where k not in ('version','display_mode'))
      or coalesce(diag->>'version','')!~'^[A-Za-z0-9._-]{1,24}$'
      or coalesce(diag->>'display_mode','') not in ('browser','standalone') then raise exception 'BUG_INVALID'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bug-user:'||uid::text,0));
  select * into prior from public.bug_reports where id=p_request_id;
  if found then
    if prior.user_id<>uid or prior.request_fingerprint<>md5(p_payload::text) then raise exception 'BUG_INVALID_RETRY'; end if;
    return jsonb_build_object('id',prior.id,'duplicate',true);
  end if;
  if (select count(*) from public.bug_reports where user_id=uid and created_at>now()-interval '24 hours')>=5 then raise exception 'BUG_RATE_LIMIT'; end if;
  insert into public.bug_reports(id,user_id,category,page,summary,detail,steps,expected,diagnostics,request_fingerprint)
    values(p_request_id,uid,p_payload->>'category',p_payload->>'page',btrim(p_payload->>'summary'),btrim(p_payload->>'detail'),btrim(p_payload->>'steps'),btrim(coalesce(p_payload->>'expected','')),nullif(diag,'null'::jsonb),md5(p_payload::text));
  insert into public.bug_report_events(id,report_id,status,author_kind) values(p_request_id,p_request_id,'open','reporter');
  return jsonb_build_object('id',p_request_id);
end $$;
revoke all on function studentos_private.submit_bug_report(uuid,jsonb) from public,anon,authenticated;
grant execute on function studentos_private.submit_bug_report(uuid,jsonb) to authenticated;
create function public.submit_bug_report(p_request_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$select studentos_private.submit_bug_report(p_request_id,p_payload)$$;
revoke all on function public.submit_bug_report(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_bug_report(uuid,jsonb) to authenticated;

create function public.my_bug_reports(p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
  with page as (
    select r.id,r.category,r.page,r.summary,r.detail,r.steps,r.expected,r.diagnostics,r.status,r.created_at,r.updated_at,
      coalesce((select jsonb_agg(e order by e.created_at,e.id) from (
        select ev.id,ev.status,ev.author_kind,ev.reply,ev.created_at from public.bug_report_events ev
        where ev.report_id=r.id order by ev.created_at desc,ev.id desc limit 100
      ) e),'[]'::jsonb) events
    from public.bug_reports r where r.user_id=(select auth.uid())
    order by r.created_at desc,r.id limit 21 offset greatest(0,least(coalesce(p_offset,0),100000))
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(x) from (select * from page limit 20)x),'[]'::jsonb),'has_more',(select count(*)>20 from page));
$$;
revoke all on function public.my_bug_reports(integer) from public,anon,authenticated;
grant execute on function public.my_bug_reports(integer) to authenticated;

create function studentos_private.reply_bug_report(p_request_id uuid,p_report_id uuid,p_reply text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.bug_reports; prior public.bug_report_events;
begin
  if uid is null then raise exception 'BUG_AUTH'; end if;
  if p_request_id is null or length(btrim(coalesce(p_reply,''))) not between 5 and 1500 then raise exception 'BUG_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bug-user:'||uid::text,0));
  select * into r from public.bug_reports where id=p_report_id and user_id=uid for update;
  if not found then raise exception 'BUG_NOT_FOUND'; end if;
  select * into prior from public.bug_report_events where id=p_request_id;
  if found then
    if prior.report_id<>r.id or prior.author_kind<>'reporter' or prior.reply<>btrim(p_reply) then raise exception 'BUG_INVALID_RETRY'; end if;
    return jsonb_build_object('id',prior.id,'duplicate',true);
  end if;
  if r.status<>'needs_info' then raise exception 'BUG_NOT_AWAITING_REPLY'; end if;
  if (select count(*) from public.bug_report_events ev join public.bug_reports br on br.id=ev.report_id where br.user_id=uid and ev.author_kind='reporter' and ev.reply<>'' and ev.created_at>now()-interval '24 hours')>=10 then raise exception 'BUG_RATE_LIMIT'; end if;
  insert into public.bug_report_events(id,report_id,status,author_kind,reply) values(p_request_id,r.id,'reviewing','reporter',btrim(p_reply));
  update public.bug_reports set status='reviewing',updated_at=now() where id=r.id;
  return jsonb_build_object('id',p_request_id);
end $$;
revoke all on function studentos_private.reply_bug_report(uuid,uuid,text) from public,anon,authenticated;
grant execute on function studentos_private.reply_bug_report(uuid,uuid,text) to authenticated;
create function public.reply_bug_report(p_request_id uuid,p_report_id uuid,p_reply text)
returns jsonb language sql security invoker set search_path='' as $$select studentos_private.reply_bug_report(p_request_id,p_report_id,p_reply)$$;
revoke all on function public.reply_bug_report(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reply_bug_report(uuid,uuid,text) to authenticated;

create function studentos_private.staff_bug_command(p_actor uuid,p_login text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid; prior public.staff_audit; r public.bug_reports; status_s text:=p_payload->>'status'; reply_s text:=btrim(coalesce(p_payload->>'reply',''));
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) or p_login is null or length(p_login)>100 then raise exception 'Invalid actor'; end if;
  if p_action='bugs' then
    return (with page as (
      select br.id,br.category,br.page,br.summary,br.detail,br.steps,br.expected,br.diagnostics,br.status,br.created_at,br.updated_at,
        coalesce((select jsonb_agg(e order by e.created_at,e.id) from (
          select ev.id,ev.status,ev.author_kind,ev.reply,ev.created_at from public.bug_report_events ev where ev.report_id=br.id order by ev.created_at desc,ev.id desc limit 100
        )e),'[]'::jsonb) events
      from public.bug_reports br order by (br.status='resolved'),br.created_at desc,br.id limit 21 offset greatest(0,least(coalesce((p_payload->>'offset')::integer,0),100000)))
      select jsonb_build_object('items',coalesce((select jsonb_agg(x) from (select * from page limit 20)x),'[]'::jsonb),'has_more',(select count(*)>20 from page),'open_count',(select count(*) from public.bug_reports where status<>'resolved')));
  end if;
  if p_action<>'bug_triage' then raise exception 'Unknown command'; end if;
  req:=(p_payload->>'request_id')::uuid;
  if req is null or status_s is null or status_s not in ('open','reviewing','needs_info','resolved') or length(reply_s)>1500
    or (status_s in ('needs_info','resolved') and length(reply_s)<5) then raise exception 'BUG_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
  select * into prior from public.staff_audit where id=req;
  if found then
    if prior.actor<>p_actor or prior.action<>p_action or prior.payload<>p_payload then raise exception 'BUG_INVALID_RETRY'; end if;
    return jsonb_build_object('id',req,'duplicate',true);
  end if;
  select * into r from public.bug_reports where id=(p_payload->>'id')::uuid for update;
  if not found then raise exception 'BUG_NOT_FOUND'; end if;
  update public.bug_reports set status=status_s,updated_at=now() where id=r.id;
  insert into public.bug_report_events(id,report_id,status,author_kind,reply) values(req,r.id,status_s,'staff',reply_s);
  insert into public.staff_audit(id,actor,actor_login,action,detail,payload) values(req,p_actor,p_login,p_action,'บั๊ก #'||left(r.id::text,8)||' → '||status_s,p_payload);
  return jsonb_build_object('id',req,'ok',true);
end $$;
revoke all on function studentos_private.staff_bug_command(uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function studentos_private.staff_bug_command(uuid,text,text,jsonb) to service_role;
create function public.staff_bug_command(p_actor uuid,p_login text,p_action text,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$select studentos_private.staff_bug_command(p_actor,p_login,p_action,p_payload)$$;
revoke all on function public.staff_bug_command(uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.staff_bug_command(uuid,text,text,jsonb) to service_role;
commit;
