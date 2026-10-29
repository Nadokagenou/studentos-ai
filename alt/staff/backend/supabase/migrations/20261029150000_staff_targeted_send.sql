-- Control Room: send news to a chosen group, now or at a set time.
-- "Everyone" stays one public notice (guests see it too). Any narrower group becomes one private
-- notice per recipient (audience_id), the path credit notices already use: the app shows it in the
-- recipient's bell, staff-notify already checks the recipient, and nobody else can read it.
-- All rows of one send share batch_id so the team can see and cancel the send as one item.
-- Scheduled rows wait with status 'scheduled'; staff_claim_push_jobs (run every minute by the
-- staff-notify cron) releases them first, so no new cron is needed.
begin;

alter table public.staff_notices add column if not exists batch_id uuid;
alter table public.staff_notices add column if not exists scheduled_at timestamptz;
alter table public.staff_notices add column if not exists audience_label text check (audience_label is null or length(audience_label) <= 80);
alter table public.staff_notices drop constraint if exists staff_notices_status_check;
alter table public.staff_notices add constraint staff_notices_status_check
  check (status in ('draft', 'scheduled', 'published', 'withdrawn'));
create index if not exists staff_notices_batch on public.staff_notices(batch_id, created_at desc) where batch_id is not null;
create index if not exists staff_notices_due on public.staff_notices(scheduled_at) where status = 'scheduled';

-- Who a send reaches. Same day rules and "latest version" as staff_insights().
create or replace function public.staff_audience(p_aud jsonb)
returns table(user_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare
  k text := coalesce(p_aud->>'kind', 'all');
  today date := (now() at time zone 'Asia/Bangkok')::date;
  latest text;
  g text := left(btrim(coalesce(p_aud->>'grade', '')), 12);
begin
  if k not in ('all', 'active', 'gone', 'new', 'old', 'stuck', 'grade', 'pick') then raise exception 'Unknown audience'; end if;
  if k = 'pick' then
    if jsonb_typeof(p_aud->'ids') is distinct from 'array' or jsonb_array_length(p_aud->'ids') not between 1 and 500 then
      raise exception 'Pick 1 to 500 people';
    end if;
    return query select s.id from public.user_state s
      where s.id::text in (select lower(x) from jsonb_array_elements_text(p_aud->'ids') x);
    return;
  end if;
  if k = 'grade' and g = '' then raise exception 'Grade required'; end if;
  select max(p.ver) into latest from public.staff_x_people() p where p.last_day >= today - 29 and p.ver is not null;
  return query select p.id from public.staff_x_people() p
    where case k
      when 'all' then true
      when 'active' then p.last_day >= today - 6
      when 'gone' then p.last_day < today - 3
      when 'new' then p.first_day >= today - 6
      when 'old' then latest is not null and p.ver is distinct from latest and p.last_day >= today - 29
      when 'stuck' then p.made = 0
      when 'grade' then p.grade = g
    end;
end $$;

-- Recipients who would actually get a phone notification (subscribed and not opted out).
create or replace function public._staff_push_ready(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.push_subscriptions ps where ps.user_id = p_user)
    and coalesce((select s.data#>>'{settings,notif}' from public.user_state s where s.id = p_user), 'true') <> 'false'
$$;

-- Publish every scheduled notice whose time has come and queue its pushes. Idempotent.
create or replace function public.staff_release_scheduled() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  with due as (
    update public.staff_notices set status = 'published', published_at = now()
    where status = 'scheduled' and scheduled_at <= now() and (until_at is null or until_at > now())
    returning id, audience_id, push_requested),
  pub_jobs as (
    insert into public.staff_push_jobs(notice_id, user_id)
    select d.id, ps.user_id from due d cross join (select distinct user_id from public.push_subscriptions) ps
    where d.push_requested and d.audience_id is null and public._staff_push_ready(ps.user_id)
    on conflict do nothing returning 1),
  own_jobs as (
    insert into public.staff_push_jobs(notice_id, user_id)
    select d.id, d.audience_id from due d
    where d.push_requested and d.audience_id is not null and public._staff_push_ready(d.audience_id)
    on conflict do nothing returning 1)
  select count(*) into n from due;
  -- Scheduled notices that expired before their time never go out.
  update public.staff_notices set status = 'withdrawn'
    where status = 'scheduled' and until_at is not null and until_at <= now();
  return n;
end $$;

create or replace function public.staff_send_command(p_actor uuid, p_login text, p_action text, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  req uuid; prior public.staff_audit; aud jsonb := coalesce(p_payload->'audience', '{"kind":"all"}'::jsonb);
  kind text := coalesce(aud->>'kind', 'all'); t text; b text; at_ts timestamptz; until_ts timestamptz;
  push boolean; label text; n_rec integer; n_push integer; batch uuid; result jsonb;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) or nullif(p_login, '') is null then
    raise exception 'Invalid staff request';
  end if;
  if p_action not in ('audience', 'sends', 'send', 'cancel_send') then raise exception 'Unknown send action'; end if;
  perform public.staff_release_scheduled();

  if p_action = 'audience' then
    select count(*), count(*) filter (where public._staff_push_ready(a.user_id)) into n_rec, n_push from public.staff_audience(aud) a;
    return jsonb_build_object('recipients', n_rec, 'push_ready', n_push);
  end if;

  if p_action = 'sends' then
    select coalesce(jsonb_agg(x order by x.sort_at desc), '[]'::jsonb) into result from (
      select n.batch_id id, min(n.title) title, min(n.body) body, min(n.audience_label) audience,
        bool_or(n.audience_id is null) public, count(*) filter (where n.audience_id is not null) recipients,
        case when bool_and(n.status = 'withdrawn') then 'withdrawn' when bool_or(n.status = 'scheduled') then 'scheduled' else 'published' end status,
        min(n.scheduled_at) scheduled_at, max(n.published_at) published_at, min(n.until_at) until_at, bool_or(n.push_requested) push,
        (select count(*) from public.staff_push_jobs j join public.staff_notices m on m.id = j.notice_id where m.batch_id = n.batch_id) push_total,
        (select count(*) from public.staff_push_jobs j join public.staff_notices m on m.id = j.notice_id where m.batch_id = n.batch_id and j.status = 'accepted') push_accepted,
        (select count(*) from public.staff_push_jobs j join public.staff_notices m on m.id = j.notice_id where m.batch_id = n.batch_id and j.status = 'failed') push_failed,
        coalesce(max(n.published_at), min(n.scheduled_at), min(n.created_at)) sort_at
      from public.staff_notices n where n.batch_id is not null group by n.batch_id
      order by coalesce(max(n.published_at), min(n.scheduled_at), min(n.created_at)) desc limit 50) x;
    return jsonb_build_object('items', result);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 0));
  req := (p_payload->>'request_id')::uuid;
  if req is null then raise exception 'Request ID required'; end if;
  select * into prior from public.staff_audit where id = req;
  if found then
    if prior.actor <> p_actor or prior.action <> p_action or prior.payload <> p_payload then raise exception 'Request ID payload mismatch'; end if;
    return jsonb_build_object('id', req, 'duplicate', true);
  end if;

  if p_action = 'cancel_send' then
    batch := (p_payload->>'batch_id')::uuid;
    select min(title) into t from public.staff_notices where batch_id = batch;
    if t is null then raise exception 'Send not found'; end if;
    update public.staff_notices set status = 'withdrawn' where batch_id = batch and status in ('scheduled', 'published');
    update public.staff_push_jobs j set status = 'cancelled' from public.staff_notices n
      where n.id = j.notice_id and n.batch_id = batch and j.status = 'pending';
    insert into public.staff_audit values (req, p_actor, p_login, p_action, 'ถอนข่าว · ' || t, p_payload, now());
    return jsonb_build_object('id', req, 'ok', true);
  end if;

  -- send
  t := btrim(coalesce(p_payload->>'title', '')); b := btrim(coalesce(p_payload->>'body', ''));
  if length(t) not between 4 and 60 or length(b) not between 1 and 280 then raise exception 'Invalid notice'; end if;
  at_ts := nullif(p_payload->>'at', '')::timestamptz;
  until_ts := nullif(p_payload->>'until', '')::timestamptz;
  if at_ts is not null and (at_ts <= now() + interval '1 minute' or at_ts > now() + interval '60 days') then raise exception 'Schedule must be 1 minute to 60 days ahead'; end if;
  if until_ts is not null and until_ts <= coalesce(at_ts, now()) then raise exception 'Expiry must be after sending'; end if;
  push := coalesce((p_payload->>'push')::boolean, false);
  label := left(btrim(coalesce(p_payload->>'label', '')), 80);
  if label = '' then label := case kind when 'all' then 'ทุกคน' else kind end; end if;

  insert into public.staff_audit values (req, p_actor, p_login, p_action,
    t || ' · ' || label || case when at_ts is null then '' else ' · ตั้งเวลา ' || to_char(at_ts at time zone 'Asia/Bangkok', 'DD/MM HH24:MI') end, p_payload, now());

  if kind = 'all' then
    insert into public.staff_notices(id, batch_id, title, body, status, actor, until_at, published_at, scheduled_at, push_requested, audience_label)
      values (req, req, t, b, case when at_ts is null then 'published' else 'scheduled' end, p_actor, until_ts,
        case when at_ts is null then now() end, at_ts, push, label);
    select count(*) into n_rec from public.user_state;
    if at_ts is null and push then
      insert into public.staff_push_jobs(notice_id, user_id)
        select req, ps.user_id from (select distinct user_id from public.push_subscriptions) ps
        where public._staff_push_ready(ps.user_id) on conflict do nothing;
    end if;
  else
    insert into public.staff_notices(id, batch_id, title, body, status, actor, until_at, published_at, scheduled_at, push_requested, audience_id, audience_label)
      select gen_random_uuid(), req, t, b, case when at_ts is null then 'published' else 'scheduled' end, p_actor, until_ts,
        case when at_ts is null then now() end, at_ts, push, a.user_id, label
      from public.staff_audience(aud) a;
    get diagnostics n_rec = row_count;
    if n_rec = 0 then raise exception 'Nobody is in this group'; end if;
    if at_ts is null and push then
      insert into public.staff_push_jobs(notice_id, user_id)
        select n.id, n.audience_id from public.staff_notices n
        where n.batch_id = req and public._staff_push_ready(n.audience_id) on conflict do nothing;
    end if;
  end if;
  select count(*) into n_push from public.staff_push_jobs j join public.staff_notices n on n.id = j.notice_id where n.batch_id = req;
  return jsonb_build_object('id', req, 'batch_id', req, 'recipients', n_rec, 'push_queued', n_push, 'scheduled_at', at_ts);
end $$;

-- Group news reaches the bell through the existing private channel; "kind" lets the app tell it
-- apart from a token credit (which opens the shop).
create or replace function public.staff_personal_notices()
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select id, title, body, published_at, until_at, case when batch_id is null then 'credit' else 'news' end kind
    from public.staff_notices
    where audience_id = (select auth.uid()) and status = 'published' and published_at <= now() and (until_at is null or until_at > now())
    order by published_at desc limit 50) x;
$$;

-- Unchanged except the first statement: release scheduled notices before the quiet-hours check,
-- so news appears on time even at night while its pushes wait for 07:00.
create or replace function public.staff_claim_push_jobs(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.staff_release_scheduled();
  if extract(hour from now() at time zone 'Asia/Bangkok')>=22 or extract(hour from now() at time zone 'Asia/Bangkok')<7 then return '[]'::jsonb; end if;
  with ready as (select j.notice_id,j.user_id from public.staff_push_jobs j join public.staff_notices n on n.id=j.notice_id
    where (j.status='pending' or (j.status='sending' and j.claimed_at<now()-interval '10 minutes')) and j.attempts<4 and j.not_before<=now()
      and n.status='published' and (n.until_at is null or n.until_at>now()) order by j.not_before limit greatest(1,least(p_limit,50)) for update of j skip locked),
  claimed as (update public.staff_push_jobs j set status='sending',claimed_at=now(),attempts=j.attempts+1 from ready r
    where j.notice_id=r.notice_id and j.user_id=r.user_id returning j.*)
  select coalesce(jsonb_agg(jsonb_build_object('notice_id',c.notice_id,'user_id',c.user_id,'attempts',c.attempts,'title',n.title,'body',n.body,'audience_id',n.audience_id)),'[]'::jsonb)
    into result from claimed c join public.staff_notices n on n.id=c.notice_id;
  return result;
end $$;

revoke all on function public.staff_audience(jsonb) from public, anon, authenticated;
revoke all on function public._staff_push_ready(uuid) from public, anon, authenticated;
revoke all on function public.staff_release_scheduled() from public, anon, authenticated;
revoke all on function public.staff_send_command(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.staff_personal_notices() from public, anon, authenticated;
revoke all on function public.staff_claim_push_jobs(integer) from public, anon, authenticated;
grant execute on function public.staff_audience(jsonb) to service_role;
grant execute on function public._staff_push_ready(uuid) to service_role;
grant execute on function public.staff_release_scheduled() to service_role;
grant execute on function public.staff_send_command(uuid, text, text, jsonb) to service_role;
grant execute on function public.staff_personal_notices() to authenticated, service_role;
grant execute on function public.staff_claim_push_jobs(integer) to service_role;
notify pgrst, 'reload schema';
commit;
