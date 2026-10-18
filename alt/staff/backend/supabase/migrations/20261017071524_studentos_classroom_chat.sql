begin;
-- This schema is not exposed by the Data API. Only the checked command below
-- may read/write its tables; membership is checked on every command and poll.
create schema studentos_classrooms;
revoke all on schema studentos_classrooms from public,anon;
grant usage on schema studentos_classrooms to authenticated;
create table studentos_classrooms.rooms (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 2 and 80),kind text not null check(kind in ('classroom','group')),
 invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 request_id uuid not null,closed_at timestamptz,revision bigint not null default 0,created_at timestamptz not null default now(),unique(owner_id,request_id)
);
create table studentos_classrooms.members (
 room_id uuid references studentos_classrooms.rooms on delete cascade,user_id uuid references auth.users on delete cascade,
 status text not null default 'active' check(status in ('active','left','removed')),last_read_id bigint not null default 0,
 joined_at timestamptz not null default now(),primary key(room_id,user_id)
);
create index class_members_user on studentos_classrooms.members(user_id,status,room_id);
create table studentos_classrooms.messages (
 id bigint generated always as identity primary key,room_id uuid not null references studentos_classrooms.rooms on delete cascade,
 sender_id uuid references auth.users on delete set null,request_id uuid not null,kind text not null check(kind in ('text','task')),
 body text not null default '' check(length(body)<=2000),task jsonb,deleted_at timestamptz,
 created_at timestamptz not null default now(),unique(sender_id,request_id),
 check((kind='text' and task is null) or (kind='task' and jsonb_typeof(task)='object'))
);
create index class_messages_room on studentos_classrooms.messages(room_id,id desc);
create index class_messages_rate on studentos_classrooms.messages(sender_id,created_at desc);
create table studentos_classrooms.receipts (
 message_id bigint references studentos_classrooms.messages on delete cascade,user_id uuid references auth.users on delete cascade,
 task_id uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),primary key(message_id,user_id)
);
create table studentos_classrooms.join_attempts (user_id uuid primary key references auth.users on delete cascade,window_at timestamptz not null,attempts integer not null);
alter table studentos_classrooms.rooms enable row level security;
alter table studentos_classrooms.members enable row level security;
alter table studentos_classrooms.messages enable row level security;
alter table studentos_classrooms.receipts enable row level security;
alter table studentos_classrooms.join_attempts enable row level security;
revoke all on all tables in schema studentos_classrooms from public,anon,authenticated,service_role;
revoke all on all sequences in schema studentos_classrooms from public,anon,authenticated,service_role;

create function studentos_classrooms.run(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare me uuid:=auth.uid(); room_id uuid; r studentos_classrooms.rooms; m studentos_classrooms.messages;
 member studentos_classrooms.members; receipt studentos_classrooms.receipts;
 req uuid; name_s text; kind_s text; body_s text; task_j jsonb; due_n timestamptz; minutes_n integer;
 rows_j jsonb; members_j jsonb; max_n bigint; min_n bigint; before_n bigint; after_n bigint; tries integer;
 state_j jsonb; tasks_j jsonb; task_id uuid; new_task jsonb; target_id uuid; present boolean; limit_n integer;
begin
 if me is null or me is distinct from (p_payload->>'expected_user')::uuid then raise exception 'CLASS_AUTH'; end if;
 if not public.staff_account_allowed() then raise exception 'CLASS_BANNED'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(x order by x.latest_at desc nulls last,x.created_at desc),'[]') into rows_j from (
   select r.id,r.name,r.kind,r.owner_id=me is_owner,r.closed_at,r.created_at,
    (select max(created_at) from studentos_classrooms.messages where room_id=r.id) latest_at,
    (select count(*) from studentos_classrooms.members where room_id=r.id and status='active') member_count,
    (select count(*) from studentos_classrooms.messages where room_id=r.id and id>m.last_read_id and sender_id is distinct from me and deleted_at is null) unread
   from studentos_classrooms.rooms r join studentos_classrooms.members m on m.room_id=r.id and m.user_id=me and m.status='active'
   order by r.created_at desc limit 30
  )x;
  return jsonb_build_object('items',rows_j);
 end if;
 if p_action not in ('room','create','join','post','accept','rotate','close','leave','remove_member','restore_member','delete_message') then raise exception 'CLASS_BAD_ACTION'; end if;
 if p_action<>'room' then perform pg_advisory_xact_lock(hashtextextended(me::text,72017)); end if;
 if p_action='create' then
  req:=(p_payload->>'request_id')::uuid; name_s:=btrim(coalesce(p_payload->>'name',''));kind_s:=p_payload->>'kind';
  if req is null or length(name_s)<2 or length(name_s)>80 or kind_s is null or kind_s not in ('classroom','group') then raise exception 'CLASS_BAD_INPUT'; end if;
  select * into r from studentos_classrooms.rooms where owner_id=me and request_id=req;
  if found then
   if r.name<>name_s or r.kind<>kind_s then raise exception 'CLASS_REQUEST_MISMATCH'; end if;
   return jsonb_build_object('id',r.id,'duplicate',true);
  end if;
  if (select count(*) from studentos_classrooms.rooms where owner_id=me and closed_at is null)>=10
    or (select count(*) from studentos_classrooms.members where user_id=me and status='active')>=30 then raise exception 'CLASS_ROOM_LIMIT'; end if;
  insert into studentos_classrooms.rooms(owner_id,name,kind,request_id) values(me,name_s,kind_s,req) returning * into r;
  insert into studentos_classrooms.members(room_id,user_id) values(r.id,me);
  return jsonb_build_object('id',r.id);
 end if;
 if p_action='join' then
  insert into studentos_classrooms.join_attempts values(me,date_trunc('minute',now()),1)
   on conflict(user_id) do update set window_at=excluded.window_at,
    attempts=case when studentos_classrooms.join_attempts.window_at=excluded.window_at then studentos_classrooms.join_attempts.attempts+1 else 1 end returning attempts into tries;
  if tries>10 then return jsonb_build_object('error','CLASS_RATE_LIMIT'); end if;
  select * into r from studentos_classrooms.rooms where invite_code=upper(regexp_replace(coalesce(p_payload->>'code',''),'[ -]','','g')) and closed_at is null for update;
  if not found then return jsonb_build_object('error','CLASS_INVALID_CODE'); end if;
  select * into member from studentos_classrooms.members where room_id=r.id and user_id=me;
  if found and member.status='removed' then return jsonb_build_object('error','CLASS_REMOVED'); end if;
  if found and member.status='active' then return jsonb_build_object('id',r.id,'duplicate',true); end if;
  if (select count(*) from studentos_classrooms.members where room_id=r.id and status='active')>=100
   or (select count(*) from studentos_classrooms.members where user_id=me and status='active')>=30 then return jsonb_build_object('error','CLASS_ROOM_LIMIT'); end if;
  insert into studentos_classrooms.members(room_id,user_id) values(r.id,me)
   on conflict(room_id,user_id) do update set status='active',joined_at=now();
  update studentos_classrooms.rooms set revision=revision+1 where id=r.id;
  return jsonb_build_object('id',r.id);
 end if;
 room_id:=(p_payload->>'room')::uuid;
 -- Reads do not lock the room; writes serialize membership, closure and posts.
 if p_action='room' then select * into r from studentos_classrooms.rooms where id=room_id;
 else select * into r from studentos_classrooms.rooms where id=room_id for update; end if;
 if not found then raise exception 'CLASS_NOT_MEMBER'; end if;
 select * into member from studentos_classrooms.members where room_id=r.id and user_id=me and status='active';
 if not found then raise exception 'CLASS_NOT_MEMBER'; end if;
 if p_action='room' then
  if p_payload->>'revision'=r.revision::text and nullif(p_payload->>'before','') is null then return jsonb_build_object('unchanged',true); end if;
  limit_n:=greatest(50,least(coalesce((p_payload->>'limit')::integer,50),200));
  before_n:=nullif(p_payload->>'before','')::bigint;after_n:=nullif(p_payload->>'after','')::bigint;
  if before_n is not null and after_n is not null then raise exception 'CLASS_BAD_INPUT'; end if;
  select coalesce(jsonb_agg(x.j order by x.id),'[]'),max(x.id),min(x.id) into rows_j,max_n,min_n from (
   select m.id,jsonb_build_object('id',m.id::text,'mine',m.sender_id=me,'sender',coalesce(p.display_name,p.handle,'สมาชิก'),
    'kind',m.kind,'body',case when m.deleted_at is null then m.body else '' end,
    'task',case when m.deleted_at is null then m.task else null end,'deleted',m.deleted_at is not null,
    'created_at',m.created_at,'can_delete',m.sender_id=me or r.owner_id=me,'accepted',a.task_id is not null,'task_id',a.task_id) j
   from studentos_classrooms.messages m left join public.profiles p on p.id=m.sender_id
    left join studentos_classrooms.receipts a on a.message_id=m.id and a.user_id=me
   where m.room_id=r.id and (before_n is null or m.id<before_n) and (after_n is null or m.id>after_n)
   order by case when after_n is not null then m.id end asc,m.id desc limit limit_n
  )x;
  if max_n is not null then update studentos_classrooms.members set last_read_id=greatest(last_read_id,max_n) where room_id=r.id and user_id=me and last_read_id<max_n; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.user_id,'name',coalesce(p.display_name,p.handle,'สมาชิก'),'owner',x.user_id=r.owner_id,'status',x.status) order by x.joined_at),'[]') into members_j
   from studentos_classrooms.members x left join public.profiles p on p.id=x.user_id where x.room_id=r.id and (x.status='active' or r.owner_id=me);
  return jsonb_build_object('room',jsonb_build_object('id',r.id,'name',r.name,'kind',r.kind,'is_owner',r.owner_id=me,'closed',r.closed_at is not null,
    'revision',r.revision::text,'invite_code',case when r.owner_id=me and r.closed_at is null then r.invite_code else null end),'members',members_j,'messages',rows_j,
    'has_older',exists(select 1 from studentos_classrooms.messages where room_id=r.id and id<min_n),
    'has_newer',exists(select 1 from studentos_classrooms.messages where room_id=r.id and id>max_n));
 end if;
 if p_action='leave' then
  if r.owner_id=me then raise exception 'CLASS_OWNER_CANNOT_LEAVE'; end if;
  update studentos_classrooms.members set status='left' where room_id=r.id and user_id=me;
  update studentos_classrooms.rooms set revision=revision+1 where id=r.id;
  return jsonb_build_object('ok',true);
 end if;
 if r.closed_at is not null then raise exception 'CLASS_CLOSED'; end if;
 if p_action in ('rotate','close','remove_member','restore_member') then
  if r.owner_id<>me then raise exception 'CLASS_NOT_OWNER'; end if;
  if p_action='rotate' then
   update studentos_classrooms.rooms set invite_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),revision=revision+1 where id=r.id returning invite_code into body_s;
   return jsonb_build_object('code',body_s);
  elsif p_action='close' then update studentos_classrooms.rooms set closed_at=now(),revision=revision+1 where id=r.id;
  else
   target_id:=(p_payload->>'target')::uuid;
   if target_id is null or target_id=r.owner_id then raise exception 'CLASS_BAD_INPUT'; end if;
   if p_action='restore_member' and ((select count(*) from studentos_classrooms.members where room_id=r.id and status='active')>=100
    or (select count(*) from studentos_classrooms.members where user_id=target_id and status='active')>=30) then raise exception 'CLASS_ROOM_LIMIT'; end if;
   update studentos_classrooms.members set status=case when p_action='remove_member' then 'removed' else 'active' end where room_id=r.id and user_id=target_id;
   if not found then raise exception 'CLASS_NOT_MEMBER'; end if;
   update studentos_classrooms.rooms set revision=revision+1 where id=r.id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='post' then
  req:=(p_payload->>'request_id')::uuid;kind_s:=p_payload->>'kind';body_s:=btrim(coalesce(p_payload->>'body',''));
  if req is null or kind_s is null or kind_s not in ('text','task') or length(body_s)>2000 or (kind_s='text' and length(body_s)<1) then raise exception 'CLASS_BAD_INPUT'; end if;
  if kind_s='task' then
   task_j:=p_payload->'task';
   if jsonb_typeof(task_j) is distinct from 'object' or length(btrim(coalesce(task_j->>'subject','')))<1 or length(task_j->>'subject')>60
    or length(btrim(coalesce(task_j->>'detail','')))<3 or length(task_j->>'detail')>2000 or coalesce(task_j->>'estMin','') !~ '^[0-9]{1,3}$' then raise exception 'CLASS_BAD_INPUT'; end if;
   minutes_n:=(task_j->>'estMin')::integer;
   if minutes_n<5 or minutes_n>480 then raise exception 'CLASS_BAD_INPUT'; end if;
   due_n:=nullif(task_j->>'due','')::timestamptz;
   if due_n is not null and not isfinite(due_n) then raise exception 'CLASS_BAD_INPUT'; end if;
   task_j:=jsonb_build_object('subject',btrim(task_j->>'subject'),'detail',btrim(task_j->>'detail'),'estMin',minutes_n,'due',due_n,'teacher','','type','homework','scorePct',null);
  else task_j:=null; end if;
  select * into m from studentos_classrooms.messages where sender_id=me and request_id=req;
  if found then
   if m.room_id<>r.id or m.kind<>kind_s or m.body<>body_s or m.task is distinct from task_j then raise exception 'CLASS_REQUEST_MISMATCH'; end if;
   return jsonb_build_object('id',m.id::text,'duplicate',true);
  end if;
  if (select count(*) from studentos_classrooms.messages where sender_id=me and created_at>now()-interval '1 minute')>=30 then raise exception 'CLASS_RATE_LIMIT'; end if;
  insert into studentos_classrooms.messages(room_id,sender_id,request_id,kind,body,task) values(r.id,me,req,kind_s,body_s,task_j) returning id into max_n;
  update studentos_classrooms.rooms set revision=revision+1 where id=r.id;
  return jsonb_build_object('id',max_n::text);
 end if;
 select * into m from studentos_classrooms.messages where id=(p_payload->>'message')::bigint and room_id=r.id for update;
 if not found then raise exception 'CLASS_BAD_INPUT'; end if;
 if p_action='delete_message' then
  if m.sender_id is distinct from me and r.owner_id<>me then raise exception 'CLASS_NOT_OWNER'; end if;
  update studentos_classrooms.messages set deleted_at=coalesce(deleted_at,now()) where id=m.id;
  update studentos_classrooms.rooms set revision=revision+1 where id=r.id;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='accept' then
  if m.kind<>'task' or m.deleted_at is not null then raise exception 'CLASS_BAD_INPUT'; end if;
  select data into state_j from public.user_state where id=me for update;
  if not found then raise exception 'CLASS_NEED_SYNC'; end if;
  tasks_j:=coalesce(state_j->'tasks','[]');
  if jsonb_typeof(tasks_j)<>'array' then raise exception 'CLASS_NEED_SYNC'; end if;
  select * into receipt from studentos_classrooms.receipts where message_id=m.id and user_id=me;
  if found then
   select exists(select 1 from jsonb_array_elements(tasks_j) t where t->>'id'=receipt.task_id::text) into present;
   return jsonb_build_object('task_id',receipt.task_id,'already',true,'present',present);
  end if;
  insert into studentos_classrooms.receipts(message_id,user_id) values(m.id,me) returning * into receipt;
  new_task:=m.task||jsonb_build_object('id',receipt.task_id,'done',false,'progress',0,'sourceId','classroom',
   'sourceText','งานจากห้อง '||r.name,'srcSubject',r.name,'srcKey','classroom:'||m.id);
  update public.user_state set data=state_j||jsonb_build_object('tasks',tasks_j||jsonb_build_array(new_task)),updated_at=now() where id=me;
  return jsonb_build_object('task_id',receipt.task_id,'present',true);
 end if;
 raise exception 'CLASS_BAD_ACTION';
end $$;
revoke all on function studentos_classrooms.run(text,jsonb) from public,anon;
grant execute on function studentos_classrooms.run(text,jsonb) to authenticated;
create function public.classroom_command(p_action text,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$select studentos_classrooms.run(p_action,p_payload);$$;
revoke all on function public.classroom_command(text,jsonb) from public,anon;
grant execute on function public.classroom_command(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
