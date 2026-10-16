-- All administrative writes remain service-only behind staff-console GitHub authorization.
begin;
create table public.staff_token_debits (
  id uuid primary key references public.staff_audit(id),
  target uuid not null references auth.users(id) on delete cascade,
  amount integer not null check(amount between 1 and 10000),
  created_at timestamptz not null default now()
);
create index staff_token_debits_target on public.staff_token_debits(target);
create table public.staff_account_bans (
  target uuid primary key references auth.users(id) on delete cascade,
  reason text not null check(length(reason) between 5 and 300),
  expires_at timestamptz,
  revoked_at timestamptz,
  audit_id uuid not null references public.staff_audit(id),
  updated_at timestamptz not null default now()
);
alter table public.staff_token_debits enable row level security;
alter table public.staff_account_bans enable row level security;
revoke all on public.staff_token_debits,public.staff_account_bans from public,anon,authenticated,service_role;

-- Only the signed-in user's status is exposed; administrators use the service RPC.
create function public.staff_account_status()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce((select jsonb_build_object('banned',true,'reason',reason,'expires_at',expires_at)
    from public.staff_account_bans where target=(select auth.uid()) and revoked_at is null
      and (expires_at is null or expires_at>now())),jsonb_build_object('banned',false));
$$;
revoke all on function public.staff_account_status() from public,anon;
grant execute on function public.staff_account_status() to authenticated,service_role;

-- Existing JWTs must not bypass a ban while waiting for Auth refresh.
create function public.staff_check_account_request()
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role()='authenticated'
    and coalesce(current_setting('request.path',true),'') not in
      ('/rpc/staff_account_status','/rpc/staff_personal_notices','rpc/staff_account_status','rpc/staff_personal_notices')
    and exists(select 1 from public.staff_account_bans where target=(select auth.uid())
      and revoked_at is null and (expires_at is null or expires_at>now())) then
    raise sqlstate 'PT403' using message='บัญชีถูกระงับการใช้งานออนไลน์ กรุณาดูเหตุผลในการแจ้งเตือน';
  end if;
end $$;
revoke all on function public.staff_check_account_request() from public,anon;
grant execute on function public.staff_check_account_request() to authenticated,service_role;

create function public.staff_account_allowed()
returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from public.staff_account_bans where target=(select auth.uid())
    and revoked_at is null and (expires_at is null or expires_at>now()));
$$;
revoke all on function public.staff_account_allowed() from public,anon;
grant execute on function public.staff_account_allowed() to authenticated,service_role;
-- Realtime and Storage do not run PostgREST's request hook. Restrictive policies
-- add the same check without granting any new table access or replacing old policies.
do $$ declare r record; begin
  for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and c.relrowsecurity
      and (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
      and c.relname not like 'staff_%'
  loop
    execute format('create policy staff_account_restriction on %I.%I as restrictive for all to authenticated using ((select public.staff_account_allowed())) with check ((select public.staff_account_allowed()))',r.nspname,r.relname);
  end loop;
end $$;

-- Separate monotonic receipts preserve compatibility with the existing grant counter.
-- This remains the legacy synced wallet, not a new authoritative spending service.
create or replace function public.staff_reconcile_tokens()
returns trigger language plpgsql security definer set search_path='' as $$
declare minted bigint; debited bigint; seen_m bigint:=0; seen_d bigint:=0;
  balance numeric:=0; v jsonb; t jsonb; stamp bigint;
begin
  if auth.role() in ('anon','authenticated') and auth.uid() is distinct from new.id then return new; end if;
  select coalesce(sum(amount),0) into minted from public.staff_token_grants where target=new.id;
  select coalesce(sum(amount),0) into debited from public.staff_token_debits where target=new.id;
  if minted=0 and debited=0 then return new; end if;
  v:=case when jsonb_typeof(new.data->'vault')='object' then new.data->'vault' else '{}'::jsonb end;
  t:=case when jsonb_typeof(v->'tokens')='object' then v->'tokens' else '{}'::jsonb end;
  if coalesce(t->>'staffMinted','') ~ '^[0-9]{1,12}$' then seen_m:=(t->>'staffMinted')::bigint; end if;
  if coalesce(t->>'staffDebited','') ~ '^[0-9]{1,12}$' then seen_d:=(t->>'staffDebited')::bigint; end if;
  if seen_m>minted or seen_d>debited then raise exception 'Invalid server token receipt'; end if;
  if seen_m=minted and seen_d=debited then return new; end if;
  if coalesce(t->>'bal','') ~ '^[0-9]{1,12}([.][0-9]{1,6})?$' then balance:=(t->>'bal')::numeric; end if;
  stamp:=(extract(epoch from clock_timestamp())*1000)::bigint;
  if coalesce(v->>'at','') ~ '^[0-9]{1,16}$' then stamp:=greatest(stamp,(v->>'at')::bigint+1); end if;
  t:=t||jsonb_build_object('bal',greatest(0,balance+minted-seen_m-debited+seen_d),'staffMinted',minted,'staffDebited',debited);
  new.data:=new.data||jsonb_build_object('vault',v||jsonb_build_object('tokens',t,'at',stamp));
  return new;
end $$;

create function public.staff_moderation_command(p_actor uuid,p_login text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid; prior public.staff_audit; target_id uuid; amount_n integer; reason_s text;
  duration_s text; expiry timestamptz; state_row public.user_state; balance_n numeric; result jsonb; more boolean;
begin
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) or p_login is null or length(p_login)>100 then raise exception 'Unknown actor'; end if;
  if p_action='users' then
    result:=public.staff_command(p_actor,p_login,p_action,p_payload);
    more:=coalesce((result->>'has_more')::boolean,false);
    select coalesce(jsonb_agg(x.value||jsonb_build_object(
      'balance',case when coalesce(s.data#>>'{vault,tokens,bal}','') ~ '^[0-9]{1,12}([.][0-9]{1,6})?$' then (s.data#>>'{vault,tokens,bal}')::numeric else 0 end,
      'banned',b.target is not null and b.revoked_at is null and (b.expires_at is null or b.expires_at>now()),
      'ban_until',b.expires_at,'ban_reason',b.reason) order by x.n),'[]'::jsonb) into result
      from jsonb_array_elements(result->'items') with ordinality x(value,n)
      join public.user_state s on s.id=(x.value->>'id')::uuid
      left join public.staff_account_bans b on b.target=s.id;
    return jsonb_build_object('items',result,'has_more',more);
  end if;
  if p_action not in ('deduct','ban','unban') then raise exception 'Unknown moderation action'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
  req:=(p_payload->>'request_id')::uuid; target_id:=(p_payload->>'target')::uuid;
  reason_s:=btrim(coalesce(p_payload->>'reason',''));
  if req is null or target_id is null or length(reason_s)<5 or length(reason_s)>300 then raise exception 'Invalid moderation request'; end if;
  select * into prior from public.staff_audit where id=req;
  if found then
    if prior.actor<>p_actor or prior.action<>p_action or prior.payload<>p_payload then raise exception 'Request ID payload mismatch'; end if;
    return jsonb_build_object('id',req,'duplicate',true);
  end if;
  -- All operators lock the same recipient row before changing balance or restrictions.
  select * into state_row from public.user_state where id=target_id for update;
  if not found then raise exception 'Recipient has not synced an account'; end if;
  if p_action='deduct' then
    if jsonb_typeof(p_payload->'amount')<>'number' or coalesce(p_payload->>'amount','') !~ '^[0-9]{1,5}$' then raise exception 'Invalid amount'; end if;
    amount_n:=(p_payload->>'amount')::integer;
    if amount_n<1 or amount_n>10000 then raise exception 'Invalid amount'; end if;
    -- Reconcile older snapshots first, then compare the current cloud balance.
    update public.user_state set data=data where id=target_id returning * into state_row;
    if coalesce(state_row.data#>>'{vault,tokens,bal}','') !~ '^[0-9]{1,12}([.][0-9]{1,6})?$' then raise exception 'Invalid cloud balance'; end if;
    balance_n:=(state_row.data#>>'{vault,tokens,bal}')::numeric;
    if balance_n<amount_n then raise exception 'Insufficient tokens'; end if;
    insert into public.staff_audit values(req,p_actor,p_login,p_action,target_id::text||' -'||amount_n||' · '||reason_s,p_payload,now());
    insert into public.staff_token_debits(id,target,amount) values(req,target_id,amount_n);
    update public.user_state set data=data,updated_at=now() where id=target_id;
    duration_s:='หัก '||amount_n||' โทเคน';
  else
    if target_id=p_actor then raise exception 'Cannot ban or unban your own operator account'; end if;
    if p_action='ban' then
      if exists(select 1 from auth.users where id=target_id and banned_until>now())
        and not exists(select 1 from public.staff_account_bans where target=target_id and revoked_at is null and (expires_at is null or expires_at>now())) then
        raise exception 'Account has an external Auth restriction';
      end if;
      duration_s:=p_payload->>'duration';
      if duration_s is null or duration_s not in ('1d','2d','permanent') then raise exception 'Invalid ban duration'; end if;
      expiry:=case duration_s when '1d' then now()+interval '1 day' when '2d' then now()+interval '2 days' else null end;
      duration_s:=case duration_s when '1d' then 'ระงับบัญชี 1 วัน' when '2d' then 'ระงับบัญชี 2 วัน' else 'ระงับบัญชีถาวร' end;
    else
      if not exists(select 1 from public.staff_account_bans where target=target_id and revoked_at is null and (expires_at is null or expires_at>now())) then raise exception 'Account is not banned'; end if;
      duration_s:='ปลดแบนบัญชีแล้ว';
    end if;
    insert into public.staff_audit values(req,p_actor,p_login,p_action,target_id::text||' · '||duration_s||' · '||reason_s,p_payload,now());
    insert into public.staff_account_bans(target,reason,expires_at,revoked_at,audit_id)
      values(target_id,reason_s,expiry,case when p_action='unban' then now() else null end,req)
      on conflict(target) do update set reason=excluded.reason,expires_at=excluded.expires_at,revoked_at=excluded.revoked_at,audit_id=excluded.audit_id,updated_at=now();
    -- Canonical Auth field: blocks new sign-in/refresh as well as Auth getUser.
    -- Done in the same transaction as the audit, private notice and Data API ban.
    update auth.users set banned_until=case when p_action='unban' then null else coalesce(expiry,'9999-12-31'::timestamptz) end where id=target_id;
  end if;
  insert into public.staff_notices(id,title,body,status,actor,published_at,push_requested,audience_id)
    values(req,(case when reason_s like 'ทดสอบ%' then 'ทดสอบ: ' else '' end)||duration_s,
      left('เหตุผล: '||reason_s||case when p_action='deduct' then ' · ยอดปรับหลังซิงก์ข้อมูล' else ' · งานในเครื่องยังอยู่' end,280),
      'published',p_actor,now(),true,target_id);
  insert into public.staff_push_jobs(notice_id,user_id)
    select req,target_id where coalesce(state_row.data#>>'{settings,notif}','true')<>'false'
      and exists(select 1 from public.push_subscriptions where user_id=target_id) on conflict do nothing;
  return jsonb_build_object('id',req,'target',target_id,'amount',amount_n,'ban_until',expiry,
    'balance',(select (data#>>'{vault,tokens,bal}')::numeric from public.user_state where id=target_id),
    'push_queued',exists(select 1 from public.staff_push_jobs where notice_id=req));
end $$;
revoke all on function public.staff_moderation_command(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.staff_moderation_command(uuid,text,text,jsonb) to service_role;

-- Preserve any pre-existing request hook; abort instead of replacing it silently.
do $$ declare existing text; begin
  select split_part(c,'=',2) into existing from pg_roles r cross join lateral unnest(r.rolconfig) c
    where r.rolname='authenticator' and c like 'pgrst.db_pre_request=%';
  if existing is not null and existing<>'public.staff_check_account_request' then raise exception 'Existing Data API pre-request hook requires integration'; end if;
end $$;
alter role authenticator set pgrst.db_pre_request='public.staff_check_account_request';
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
