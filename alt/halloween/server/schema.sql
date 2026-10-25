-- Event documents are private. Only the verified edge service commits their contents.
create table public.halloween_states (
 user_id uuid not null references auth.users(id) on delete cascade,
 season text not null check (season='halloween-2026'),
 revision bigint not null default 0 check (revision>=0),
 document jsonb not null check (jsonb_typeof(document)='object'),
 updated_at timestamptz not null default now(),
 primary key(user_id,season)
);
create table public.halloween_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 season text not null,
 request_id uuid not null,
 action jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,season,request_id)
);
create index halloween_request_rate on public.halloween_requests(user_id,created_at desc);
alter table public.halloween_states enable row level security;
alter table public.halloween_requests enable row level security;
revoke all on public.halloween_states, public.halloween_requests from anon,authenticated;
grant select,insert,update,delete on public.halloween_states, public.halloween_requests to service_role;
-- SECURITY INVOKER deliberately retains the caller's privilege checks.
create function public.halloween_commit(p_user uuid,p_season text,p_expected bigint,p_request uuid,p_action jsonb,p_document jsonb,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_rev bigint; prior_action jsonb; prior_result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service only' using errcode='42501'; end if;
 if p_season<>'halloween-2026' or p_document->>'owner' is distinct from p_user::text or p_document->>'season' is distinct from p_season or (p_document->>'revision')::bigint<>p_expected+1 then raise exception 'invalid event document'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_season,0));
 select action,result into prior_action,prior_result from public.halloween_requests where user_id=p_user and season=p_season and request_id=p_request;
 if found then
  if prior_action<>p_action then raise exception 'request identity conflict'; end if;
  return jsonb_build_object('committed',true,'replay',true,'result',prior_result);
 end if;
 if (select count(*) from public.halloween_requests where user_id=p_user and created_at>now()-interval '1 minute')>=240 then raise exception 'event rate limit'; end if;
 select revision into current_rev from public.halloween_states where user_id=p_user and season=p_season for update;
 if not found then current_rev:=0; end if;
 if current_rev<>p_expected then return jsonb_build_object('committed',false); end if;
 insert into public.halloween_states(user_id,season,revision,document) values(p_user,p_season,p_expected+1,p_document)
 on conflict(user_id,season) do update set revision=excluded.revision,document=excluded.document,updated_at=now();
 insert into public.halloween_requests(user_id,season,request_id,action,result) values(p_user,p_season,p_request,p_action,p_result);
 return jsonb_build_object('committed',true,'replay',false,'result',p_result);
end $$;
revoke all on function public.halloween_commit(uuid,text,bigint,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.halloween_commit(uuid,text,bigint,uuid,jsonb,jsonb,jsonb) to service_role;
