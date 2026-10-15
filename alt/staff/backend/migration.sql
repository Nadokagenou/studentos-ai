-- Student OS Control Room. Run with the database owner's SQL Editor.
-- Client roles cannot administer these tables. staff-console verifies GitHub
-- repository write access on every request before calling the service-only RPC.
begin;

create table if not exists public.staff_audit (
  id uuid primary key,
  actor uuid not null,
  actor_login text not null,
  action text not null,
  detail text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists staff_audit_recent on public.staff_audit(created_at desc);
create table if not exists public.staff_token_grants (
  id uuid primary key references public.staff_audit(id),
  target uuid not null references auth.users(id) on delete cascade,
  amount integer not null check(amount between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists staff_token_grants_target on public.staff_token_grants(target);
create table if not exists public.staff_notices (
  id uuid primary key,
  title text not null check(length(title) between 4 and 60),
  body text not null check(length(body) between 1 and 280),
  status text not null default 'draft' check(status in ('draft','published','withdrawn')),
  actor uuid references auth.users(id) on delete set null,
  until_at timestamptz,
  published_at timestamptz,
  push_requested boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.staff_report_triage (
  report_id bigint primary key references public.reports(id) on delete cascade,
  status text not null check(status in ('open','reviewing','closed')),
  note text not null default '' check(length(note)<=300),
  actor uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.staff_push_jobs (
  notice_id uuid not null references public.staff_notices(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','accepted','failed','cancelled')),
  attempts integer not null default 0,
  not_before timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  primary key(notice_id,user_id)
);
create index if not exists staff_push_pending on public.staff_push_jobs(status,not_before);

alter table public.staff_audit enable row level security;
alter table public.staff_token_grants enable row level security;
alter table public.staff_notices enable row level security;
alter table public.staff_report_triage enable row level security;
alter table public.staff_push_jobs enable row level security;
revoke all on public.staff_audit, public.staff_token_grants, public.staff_notices,
  public.staff_report_triage, public.staff_push_jobs from public,anon,authenticated;
revoke all on public.staff_audit, public.staff_token_grants, public.staff_notices,
  public.staff_report_triage, public.staff_push_jobs from service_role;
grant select on public.staff_audit,public.staff_notices,public.staff_push_jobs to service_role;
grant update on public.staff_push_jobs to service_role;

-- Add the cumulative server grant once to a snapshot that has not received it.
-- Existing task/settings fields are left intact. Old devices may overwrite a
-- snapshot, so reconcile against the private ledger on every cloud write.
-- This preserves admin credits; it does NOT turn the legacy client wallet into
-- an authoritative anti-cheat economy. Other earnings/spending remain client data.
create or replace function public.staff_reconcile_tokens()
returns trigger language plpgsql security definer set search_path='' as $$
declare total bigint; seen bigint:=0; balance numeric:=0; v jsonb; t jsonb; stamp bigint;
begin
  -- Let the existing user_state RLS reject foreign-row writes without first
  -- revealing private ledger validation errors to that caller.
  if auth.role() in ('anon','authenticated') and auth.uid() is distinct from new.id then return new; end if;
  select coalesce(sum(amount),0) into total from public.staff_token_grants where target=new.id;
  if total=0 then return new; end if;
  v:=case when jsonb_typeof(new.data->'vault')='object' then new.data->'vault' else '{}'::jsonb end;
  t:=case when jsonb_typeof(v->'tokens')='object' then v->'tokens' else '{}'::jsonb end;
  if coalesce(t->>'staffMinted','') ~ '^\d{1,12}$' then seen:=(t->>'staffMinted')::bigint; end if;
  if seen>total then raise exception 'Invalid server credit marker'; end if;
  if seen=total then return new; end if;
  if coalesce(t->>'bal','') ~ '^\d{1,12}(\.\d{1,6})?$' then balance:=(t->>'bal')::numeric; end if;
  stamp:=(extract(epoch from clock_timestamp())*1000)::bigint;
  if coalesce(v->>'at','') ~ '^\d{1,16}$' then stamp:=greatest(stamp,(v->>'at')::bigint+1); end if;
  t:=t||jsonb_build_object('bal',balance+total-seen,'staffMinted',total);
  new.data:=new.data||jsonb_build_object('vault',v||jsonb_build_object('tokens',t,'at',stamp));
  return new;
end $$;
revoke all on function public.staff_reconcile_tokens() from public,anon,authenticated;
drop trigger if exists staff_reconcile_tokens on public.user_state;
create trigger staff_reconcile_tokens before insert or update of data on public.user_state
  for each row execute function public.staff_reconcile_tokens();

create or replace function public.staff_command(p_actor uuid,p_login text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; req uuid; prior public.staff_audit; target_id uuid; amount_n integer;
  reason_s text; n public.staff_notices; report_n bigint; status_s text; q text; off_n integer;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'Unknown actor'; end if;
  if p_login is null or length(p_login)>100 then raise exception 'Invalid actor'; end if;
  if p_action='overview' then
    return jsonb_build_object(
      'users',(select count(*) from public.user_state),
      'synced_24h',(select count(*) from public.user_state where updated_at>now()-interval '24 hours'),
      'open_reports',(select count(*) from public.reports r left join public.staff_report_triage t on t.report_id=r.id where coalesce(t.status,'open')<>'closed'),
      'tokens_today',(select coalesce(sum(g.amount),0) from public.staff_token_grants g where (g.created_at at time zone 'Asia/Bangkok')::date=(now() at time zone 'Asia/Bangkok')::date),
      'issues',coalesce((select jsonb_agg(x) from (select r.id,r.kind,r.reason,r.note,r.created_at,coalesce(t.status,'open') status from public.reports r left join public.staff_report_triage t on t.report_id=r.id where coalesce(t.status,'open')<>'closed' order by r.created_at desc limit 3)x),'[]'::jsonb),
      'audit',coalesce((select jsonb_agg(x) from (select action,detail,actor_login,created_at from public.staff_audit order by created_at desc limit 4)x),'[]'::jsonb));
  elsif p_action='users' then
    q:=left(coalesce(p_payload->>'query',''),100);off_n:=greatest(0,least(coalesce((p_payload->>'offset')::integer,0),100000));
    select jsonb_build_object('items',coalesce(jsonb_agg(x),'[]'::jsonb),'has_more',count(*)>20) into result from (
      select s.id,p.display_name,p.handle,s.updated_at last_sync,
        case when coalesce(s.data#>>'{vault,tokens,bal}','') ~ '^\d{1,12}(\.\d{1,6})?$' then (s.data#>>'{vault,tokens,bal}')::numeric else 0 end balance
      from public.user_state s left join public.profiles p on p.id=s.id
      where q='' or s.id::text ilike '%'||q||'%' or coalesce(p.handle,'') ilike '%'||ltrim(q,'@')||'%' or coalesce(p.display_name,'') ilike '%'||q||'%'
      order by s.updated_at desc,s.id limit 21 offset off_n)x;
    return result||jsonb_build_object('items',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(result->'items') with ordinality x(value,n) where n<=20),'[]'::jsonb));
  elsif p_action='audit' then
    return jsonb_build_object('items',coalesce((select jsonb_agg(x) from (select action,detail,actor_login,created_at from public.staff_audit order by created_at desc limit 100)x),'[]'::jsonb));
  elsif p_action='issues' then
    return jsonb_build_object('items',coalesce((select jsonb_agg(x) from (select r.id,r.kind,r.reason,r.note,r.created_at,coalesce(t.status,'open') status,coalesce(t.note,'') staff_note from public.reports r left join public.staff_report_triage t on t.report_id=r.id order by (coalesce(t.status,'open')='closed'),r.created_at desc limit 100)x),'[]'::jsonb));
  elsif p_action='notices' then
    return jsonb_build_object('items',coalesce((select jsonb_agg(x) from (select n.*,
      case when n.push_requested then (select count(*) filter(where j.status='accepted')::text||' ตอบรับ / '||count(*)::text||' บัญชีในคิว' from public.staff_push_jobs j where j.notice_id=n.id) else 'ไม่ส่ง Push' end push_status
      from public.staff_notices n order by n.created_at desc limit 100)x),'[]'::jsonb));
  end if;
  -- Serialise mutations per operator, including daily limits and retry keys.
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
  req:=(p_payload->>'request_id')::uuid;
  if req is null then raise exception 'Request ID required'; end if;
  select * into prior from public.staff_audit where id=req;
  if found then
    if prior.actor<>p_actor or prior.action<>p_action or prior.payload<>p_payload then raise exception 'Request ID payload mismatch'; end if;
    return jsonb_build_object('id',req,'duplicate',true);
  end if;
  if p_action='grant' then
    target_id:=(p_payload->>'target')::uuid;amount_n:=(p_payload->>'amount')::integer;reason_s:=btrim(coalesce(p_payload->>'reason',''));
    if amount_n is null or amount_n<1 or amount_n>10000 or length(reason_s)<5 or length(reason_s)>300 then raise exception 'Invalid grant'; end if;
    perform 1 from public.user_state where id=target_id for update;
    if not found then raise exception 'Recipient has not synced an account'; end if;
    if (select coalesce(sum(g.amount),0) from public.staff_token_grants g join public.staff_audit a on a.id=g.id where a.actor=p_actor and (g.created_at at time zone 'Asia/Bangkok')::date=(now() at time zone 'Asia/Bangkok')::date)+amount_n>100000 then raise exception 'Daily grant limit reached'; end if;
    insert into public.staff_audit values(req,p_actor,p_login,p_action,target_id::text||' +'||amount_n||' · '||reason_s,p_payload,now());
    insert into public.staff_token_grants(id,target,amount) values(req,target_id,amount_n);
    update public.user_state set data=data,updated_at=now() where id=target_id;
    return jsonb_build_object('id',req,'target',target_id,'amount',amount_n);
  elsif p_action='draft' then
    if length(btrim(coalesce(p_payload->>'title','')))<4 or length(p_payload->>'title')>60 or length(btrim(coalesce(p_payload->>'body','')))<1 or length(p_payload->>'body')>280 then raise exception 'Invalid notice'; end if;
    if nullif(p_payload->>'until','')::timestamptz<=now() then raise exception 'Expiry must be in the future'; end if;
    insert into public.staff_notices(id,title,body,actor,until_at) values(req,btrim(p_payload->>'title'),btrim(p_payload->>'body'),p_actor,nullif(p_payload->>'until','')::timestamptz);
    reason_s:=p_payload->>'title';
  elsif p_action in ('publish','withdraw') then
    select * into n from public.staff_notices where id=(p_payload->>'id')::uuid for update;
    if not found then raise exception 'Notice not found'; end if;
    if p_action='publish' then
      if n.status<>'draft' then raise exception 'Only drafts can be published'; end if;
      if n.until_at<=now() then raise exception 'Notice has expired'; end if;
      update public.staff_notices set status='published',published_at=now(),push_requested=coalesce((p_payload->>'push')::boolean,false) where id=n.id;
      if coalesce((p_payload->>'push')::boolean,false) then
        insert into public.staff_push_jobs(notice_id,user_id)
          select n.id,p.user_id from public.push_subscriptions p join public.user_state s on s.id=p.user_id
          where coalesce(s.data#>>'{settings,notif}','true')<>'false'
          group by p.user_id on conflict do nothing;
      end if;
    else
      update public.staff_notices set status='withdrawn' where id=n.id;
      update public.staff_push_jobs set status='cancelled' where notice_id=n.id and status='pending';
    end if;
    reason_s:=n.title;
  elsif p_action='triage' then
    report_n:=(p_payload->>'id')::bigint;status_s:=p_payload->>'status';
    if status_s is null or status_s not in ('open','reviewing','closed') then raise exception 'Invalid report status'; end if;
    insert into public.staff_report_triage(report_id,status,actor,note) values(report_n,status_s,p_actor,coalesce(p_payload->>'note',''))
      on conflict(report_id) do update set status=excluded.status,actor=excluded.actor,note=excluded.note,updated_at=now();
    reason_s:='รายงาน #'||report_n||' → '||status_s;
  else raise exception 'Unknown command'; end if;
  insert into public.staff_audit values(req,p_actor,p_login,p_action,reason_s,p_payload,now());
  return jsonb_build_object('id',req,'ok',true);
end $$;
revoke all on function public.staff_command(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.staff_command(uuid,text,text,jsonb) to service_role;

-- Public announcements contain only the approved published copy, never drafts.
create or replace function public.staff_public_notices()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(x),'[]'::jsonb) from (select id,title,body,published_at,until_at from public.staff_notices
    where status='published' and published_at<=now() and (until_at is null or until_at>now()) order by published_at desc limit 50)x;
$$;
revoke all on function public.staff_public_notices() from public;
grant execute on function public.staff_public_notices() to anon,authenticated;

create or replace function public.staff_claim_push_jobs(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if extract(hour from now() at time zone 'Asia/Bangkok')>=22 or extract(hour from now() at time zone 'Asia/Bangkok')<7 then return '[]'::jsonb; end if;
  with ready as (select j.notice_id,j.user_id from public.staff_push_jobs j join public.staff_notices n on n.id=j.notice_id
    where (j.status='pending' or (j.status='sending' and j.claimed_at<now()-interval '10 minutes')) and j.attempts<4 and j.not_before<=now()
      and n.status='published' and (n.until_at is null or n.until_at>now()) order by j.not_before limit greatest(1,least(p_limit,50)) for update of j skip locked),
  claimed as (update public.staff_push_jobs j set status='sending',claimed_at=now(),attempts=j.attempts+1 from ready r
    where j.notice_id=r.notice_id and j.user_id=r.user_id returning j.*)
  select coalesce(jsonb_agg(jsonb_build_object('notice_id',c.notice_id,'user_id',c.user_id,'attempts',c.attempts,'title',n.title,'body',n.body)),'[]'::jsonb)
    into result from claimed c join public.staff_notices n on n.id=c.notice_id;
  return result;
end $$;
revoke all on function public.staff_claim_push_jobs(integer) from public,anon,authenticated;
grant execute on function public.staff_claim_push_jobs(integer) to service_role;
commit;
