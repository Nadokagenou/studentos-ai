-- Run once in the same transaction as the reviewed board update, after the services are verified and immediately before publishing the protected clients.
-- Existing user saves are copied, never deleted; future browser reward fields are ignored.
lock table public.user_state,public.staff_token_grants,public.staff_token_debits in share row exclusive mode;
insert into public.studentos_economy_baselines(user_id,data,at,staff_minted,staff_debited)
select s.id,s.data||jsonb_build_object('vault',v.value||jsonb_build_object('tokens',t.value||jsonb_build_object(
 'bal',greatest(0,balance.value+coalesce(g.n,0)-least(seen.m,coalesce(g.n,0))-coalesce(d.n,0)+least(seen.d,coalesce(d.n,0))),
 'staffMinted',coalesce(g.n,0),'staffDebited',coalesce(d.n,0)))),
 (extract(epoch from clock_timestamp())*1000)::bigint,coalesce(g.n,0),coalesce(d.n,0) from public.user_state s
left join (select target,sum(amount) n from public.staff_token_grants group by target) g on g.target=s.id
left join (select target,sum(amount) n from public.staff_token_debits group by target) d on d.target=s.id
cross join lateral(select case when jsonb_typeof(s.data->'vault')='object' then s.data->'vault' else '{}'::jsonb end as value)v
cross join lateral(select case when jsonb_typeof(v.value->'tokens')='object' then v.value->'tokens' else '{}'::jsonb end as value)t
cross join lateral(select case when coalesce(t.value->>'staffMinted','')~'^[0-9]{1,14}$' then (t.value->>'staffMinted')::bigint else 0 end as m,
 case when coalesce(t.value->>'staffDebited','')~'^[0-9]{1,14}$' then (t.value->>'staffDebited')::bigint else 0 end as d)seen
cross join lateral(select case when coalesce(t.value->>'bal','')~'^[0-9]{1,12}([.][0-9]{1,6})?$' then (t.value->>'bal')::numeric else 0 end as value)balance
where not exists(select 1 from public.studentos_economy_release where id and active)
on conflict(user_id) do nothing;
insert into public.studentos_economy_completions(user_id,task_id,completed_at,task_key,legacy)
select b.user_id,x->>'id',bs.done_at,coalesce(x->>'subject','')||'|'||public._board_key(coalesce(x->>'detail',x->>'title',x->>'name')),true
from public.studentos_economy_baselines b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.data->'tasks')='array' then b.data->'tasks' else '[]'::jsonb end) x
join public.board_seen bs on bs.uid=b.user_id and bs.task_id=x->>'id'
where x->'done'='true'::jsonb and not coalesce(x->'deleted'='true'::jsonb,false) and bs.done_at is not null and bs.done_at-bs.first_at>=interval '5 minutes' and public._board_key(coalesce(x->>'detail',x->>'title',x->>'name')) is not null
on conflict do nothing;
update public.studentos_economy_release set active=true,activated_at=clock_timestamp() where id and not active;
