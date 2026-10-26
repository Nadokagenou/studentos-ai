-- Prepare with active=false. Freeze existing account data atomically only after both clients are ready.
create schema if not exists studentos_economy_private;
revoke all on schema studentos_economy_private from public,anon,authenticated;
create table public.studentos_economy_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.studentos_economy_admins enable row level security;
revoke all on public.studentos_economy_admins from public,anon,authenticated;
grant select,insert,update,delete on public.studentos_economy_admins to service_role;
create table public.studentos_economy_release(id boolean primary key default true check(id),active boolean not null default false,activated_at timestamptz);
insert into public.studentos_economy_release(id) values(true);
create table public.studentos_economy_baselines(user_id uuid primary key references auth.users(id) on delete cascade,data jsonb not null,at bigint not null,staff_minted bigint not null,staff_debited bigint not null);
create table public.studentos_economy_states(user_id uuid primary key references auth.users(id) on delete cascade,revision bigint not null check(revision>=0),document jsonb not null,updated_at timestamptz not null default now());
create table public.studentos_economy_requests(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,action jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id));
create index studentos_economy_request_rate on public.studentos_economy_requests(user_id,created_at desc);
create table public.studentos_economy_completions(user_id uuid not null references auth.users(id) on delete cascade,task_id text not null,completed_at timestamptz not null,task_key text not null,legacy boolean not null default false,primary key(user_id,task_id));
create index studentos_economy_completion_time on public.studentos_economy_completions(completed_at,user_id);
create table public.studentos_economy_room_catalog(id text primary key,cost numeric not null check(cost>=0));
insert into public.studentos_economy_room_catalog(id,cost) values
('wall:cream',0),
('wall:sky',0),
('wall:blush',15),
('wall:mint',15),
('wall:navy',25),
('wall:plum',25),
('wall:dots',35),
('wall:stripe',35),
('floor:wood',0),
('floor:dark',15),
('floor:tile',20),
('floor:carpet',20),
('light:warm',0),
('light:cool',0),
('light:pink',20),
('light:lime',20),
('window:day',0),
('window:night',15),
('window:rain',20),
('window:dusk',25),
('poster:none',0),
('poster:abstract',20),
('poster:cat',25),
('poster:mountain',25),
('poster:neon',40),
('shelf:none',0),
('shelf:books',0),
('shelf:plant',20),
('shelf:trophy',35),
('shelf:figure',35),
('shelf:crystal',60),
('desk:none',0),
('desk:laptop',0),
('desk:books',15),
('desk:coffee',20),
('desk:cactus',20),
('desk:vinyl',45),
('ceiling:none',0),
('ceiling:string',25),
('ceiling:moon',40),
('ceiling:stars',40),
('pet:none',0),
('pet:rug',0),
('pet:cat',30),
('pet:dog',30),
('pet:beanbag',25),
('pet:capybara',60);
alter table public.studentos_economy_release enable row level security;
alter table public.studentos_economy_baselines enable row level security;
alter table public.studentos_economy_states enable row level security;
alter table public.studentos_economy_requests enable row level security;
alter table public.studentos_economy_completions enable row level security;
alter table public.studentos_economy_room_catalog enable row level security;
revoke all on public.studentos_economy_release,public.studentos_economy_baselines,public.studentos_economy_states,public.studentos_economy_requests,public.studentos_economy_completions,public.studentos_economy_room_catalog from public,anon,authenticated;
grant select,insert,update,delete on public.studentos_economy_release,public.studentos_economy_baselines,public.studentos_economy_states,public.studentos_economy_requests,public.studentos_economy_completions,public.studentos_economy_room_catalog to service_role;
grant select on public.staff_token_grants,public.staff_token_debits to service_role;
create function public.studentos_economy_staff(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('minted',coalesce((select sum(amount) from public.staff_token_grants where target=p_user),0),'debited',coalesce((select sum(amount) from public.staff_token_debits where target=p_user),0));
$$;
revoke all on function public.studentos_economy_staff(uuid) from public,anon,authenticated;
grant execute on function public.studentos_economy_staff(uuid) to service_role;
create function studentos_economy_private.protect_economy() returns trigger language plpgsql security definer set search_path='' as $$
declare doc jsonb; base public.studentos_economy_baselines%rowtype; v jsonb; tok jsonb; incoming jsonb; owned jsonb; room jsonb; choices jsonb; r record; candidate text; allowed boolean; cost numeric; events jsonb; minted bigint; debited bigint; seen_m bigint; seen_d bigint; balance numeric;
begin
 if not coalesce((select active from public.studentos_economy_release where id),false) then return new; end if;
 if auth.role() in ('anon','authenticated') and auth.uid() is distinct from new.id then raise exception 'Account mismatch' using errcode='42501'; end if;
 if jsonb_typeof(new.data) is distinct from 'object' then raise exception 'Invalid account document'; end if;
 select document into doc from public.studentos_economy_states where user_id=new.id;
 if doc is null then
  select * into base from public.studentos_economy_baselines where user_id=new.id;
  doc:=jsonb_build_object('vault',coalesce(base.data->'vault','{}'::jsonb),'roomOwned',coalesce(base.data#>'{settings,room,owned}','[]'::jsonb));
 end if;
 v:=case when jsonb_typeof(doc->'vault')='object' then doc->'vault' else '{}'::jsonb end;
 tok:=case when jsonb_typeof(v->'tokens')='object' then v->'tokens' else '{}'::jsonb end;
 minted:=coalesce((select sum(amount) from public.staff_token_grants where target=new.id),0);debited:=coalesce((select sum(amount) from public.staff_token_debits where target=new.id),0);
 if base.user_id is not null then seen_m:=base.staff_minted;seen_d:=base.staff_debited;
 else seen_m:=case when coalesce(tok->>'staffMinted','')~'^[0-9]{1,14}$' then (tok->>'staffMinted')::bigint else 0 end;seen_d:=case when coalesce(tok->>'staffDebited','')~'^[0-9]{1,14}$' then (tok->>'staffDebited')::bigint else 0 end;end if;
 balance:=case when coalesce(tok->>'bal','')~'^[0-9]{1,12}([.][0-9]{1,6})?$' then (tok->>'bal')::numeric else 0 end;
 tok:=tok||jsonb_build_object('bal',greatest(0,balance+minted-seen_m-debited+seen_d),'staffMinted',minted,'staffDebited',debited);
 incoming:=case when jsonb_typeof(new.data->'vault')='object' then new.data->'vault' else '{}'::jsonb end;
 new.data:=new.data||jsonb_build_object('vault',incoming||jsonb_build_object('tokens',tok,'allBadges',coalesce(v->'allBadges','false'::jsonb),'genesis',coalesce(v->'genesis','false'::jsonb),'badgeSecrets',coalesce(v->'badgeSecrets','[]'::jsonb),'codeThemes',coalesce(v->'codeThemes','[]'::jsonb),'luck',coalesce(v->'luck','false'::jsonb),'at',coalesce(v->'at',to_jsonb(coalesce(base.at,(extract(epoch from clock_timestamp())*1000)::bigint)))));
 owned:=case when jsonb_typeof(doc->'roomOwned')='array' then doc->'roomOwned' else '[]'::jsonb end;
 room:=case when jsonb_typeof(new.data#>'{settings,room}')='object' then new.data#>'{settings,room}' else '{}'::jsonb end;
 room:=room||jsonb_build_object('owned',owned);choices:=case when jsonb_typeof(room->'on')='object' then room->'on' else '{}'::jsonb end;
 select document->'rewards' into events from public.halloween_states where user_id=new.id and season='halloween-2026';
 for r in select key,value from jsonb_each_text(choices) loop
  candidate:=r.value;allowed:=candidate='none';
  if candidate like 'hw-%' then allowed:=coalesce(events->substring(candidate from 4)->>'permanent','')='true' and coalesce(events->substring(candidate from 4)->>'receipt','')<>'';
  else select c.cost into cost from public.studentos_economy_room_catalog c where c.id=r.key||':'||candidate;allowed:=allowed or cost=0 or owned ? (r.key||':'||candidate);end if;
  if not coalesce(allowed,false) then choices:=jsonb_set(choices,array[r.key],to_jsonb('none'::text));end if;
 end loop;
 room:=room||jsonb_build_object('on',choices);
 for r in select * from (values('wall','cream'),('floor','wood'),('light','warm')) as x(slot,fallback) loop
  candidate:=room->>r.slot;select c.cost into cost from public.studentos_economy_room_catalog c where c.id=r.slot||':'||candidate;
  if not coalesce(cost=0 or owned ? (r.slot||':'||candidate),false) then room:=jsonb_set(room,array[r.slot],to_jsonb(r.fallback));end if;
 end loop;
 new.data:=jsonb_set(new.data,'{settings}',coalesce(new.data->'settings','{}'::jsonb)||jsonb_build_object('room',room));return new;
end $$;
revoke all on function studentos_economy_private.protect_economy() from public,anon,authenticated;
create trigger zz_studentos_economy_guard before insert or update of data on public.user_state for each row execute function studentos_economy_private.protect_economy();
create function public.studentos_economy_commit(p_user uuid,p_expected bigint,p_request uuid,p_action jsonb,p_document jsonb,p_result jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.studentos_economy_requests%rowtype; rev bigint; task jsonb; task_key text; actual_m bigint; actual_d bigint;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only' using errcode='42501';end if;
 if not coalesce((select active from public.studentos_economy_release where id),false) then raise exception 'Economy maintenance';end if;
 if p_document->>'owner' is distinct from p_user::text or (p_document->>'version')::int<>1 or (p_document->>'revision')::bigint<>p_expected+1 then raise exception 'Invalid wallet';end if;
 perform pg_advisory_xact_lock(hashtextextended('studentos-economy:'||p_user::text,0));
 select * into prior from public.studentos_economy_requests where user_id=p_user and request_id=p_request;
 if found then if prior.action<>p_action then raise exception 'Request identity conflict';end if;return jsonb_build_object('committed',true,'replay',true,'result',prior.result);end if;
 if (select count(*) from public.studentos_economy_requests where user_id=p_user and created_at>now()-interval '1 minute')>=240 then raise exception 'economy rate limit';end if;
 select revision into rev from public.studentos_economy_states where user_id=p_user for update;if not found then rev:=0;end if;
 if rev<>p_expected then return jsonb_build_object('committed',false);end if;
 select coalesce(sum(amount),0) into actual_m from public.staff_token_grants where target=p_user;
 select coalesce(sum(amount),0) into actual_d from public.staff_token_debits where target=p_user;
 if (p_document#>>'{vault,tokens,staffMinted}')::bigint is distinct from actual_m or (p_document#>>'{vault,tokens,staffDebited}')::bigint is distinct from actual_d then return jsonb_build_object('committed',false);end if;
 if p_result ? 'completedTaskId' then
  select x into task from public.user_state s cross join lateral jsonb_array_elements(case when jsonb_typeof(s.data->'tasks')='array' then s.data->'tasks' else '[]'::jsonb end) x where s.id=p_user and x->>'id'=p_result->>'completedTaskId' and x->'done'='true'::jsonb and not coalesce(x->'deleted'='true'::jsonb,false);
  if task is null or p_action->>'type'<>'focus-finish' or not (p_document->'completed' ? (p_result->>'completedTaskId')) then raise exception 'Completed task changed';end if;
  task_key:=coalesce(task->>'subject','')||'|'||public._board_key(coalesce(task->>'detail',task->>'title',task->>'name'));
  if task_key is not null then insert into public.studentos_economy_completions(user_id,task_id,completed_at,task_key) values(p_user,p_result->>'completedTaskId',clock_timestamp(),task_key) on conflict do nothing;end if;
 end if;
 insert into public.studentos_economy_states(user_id,revision,document) values(p_user,p_expected+1,p_document) on conflict(user_id) do update set revision=excluded.revision,document=excluded.document,updated_at=now();
 insert into public.studentos_economy_requests(user_id,request_id,action,result) values(p_user,p_request,p_action,p_result);
 update public.user_state set data=data||jsonb_build_object('vault',coalesce(data->'vault','{}'::jsonb)||(p_document->'vault')) where id=p_user;
 return jsonb_build_object('committed',true,'replay',false,'result',p_result);
end $$;
revoke all on function public.studentos_economy_commit(uuid,bigint,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.studentos_economy_commit(uuid,bigint,uuid,jsonb,jsonb,jsonb) to service_role;
