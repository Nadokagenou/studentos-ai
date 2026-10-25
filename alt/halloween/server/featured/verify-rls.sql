-- Run as the migration owner. All fictional actors and records are rolled back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid();
begin
 perform set_config('test.feature_a',a::text,true);perform set_config('test.feature_b',b::text,true);perform set_config('test.feature_c',c::text,true);perform set_config('test.feature_d',d::text,true);
 insert into auth.users(id) values(a),(b),(c),(d);
 insert into public.halloween_states(user_id,season,document) values(a,'halloween-2026',jsonb_build_object('owner',a,'season','halloween-2026','rewards','{}'::jsonb));
 insert into public.halloween_featured_badges(user_id,badge_id) values(a,'midnight-conqueror');
 insert into public.friendships(a,b,asked_by,status,accepted_at) values(least(a,b),greatest(a,b),a,'accepted',now());
 insert into public.friendships(a,b,asked_by,status) values(least(a,d),greatest(a,d),a,'pending');
 if has_table_privilege('authenticated','public.halloween_featured_badges','INSERT') or has_table_privilege('authenticated','public.halloween_featured_badges','UPDATE') or has_table_privilege('authenticated','public.halloween_featured_badges','DELETE') then raise exception 'Browser has badge write privileges';end if;
 if has_table_privilege('anon','public.halloween_featured_badges','SELECT') then raise exception 'Anonymous badge read allowed';end if;
 if has_table_privilege('authenticated','public.halloween_states','SELECT') then raise exception 'Private event document became readable';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.feature_a'),true);
set local role authenticated;
do $$ begin if (select count(*) from public.halloween_featured_badges where user_id=current_setting('test.feature_a')::uuid)<>1 then raise exception 'Owner cannot read chosen badge';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.feature_b'),true);
set local role authenticated;
do $$ begin if (select count(*) from public.halloween_featured_badges where user_id=current_setting('test.feature_a')::uuid)<>1 then raise exception 'Accepted friend cannot read badge';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.feature_c'),true);
set local role authenticated;
do $$ begin if exists(select 1 from public.halloween_featured_badges where user_id=current_setting('test.feature_a')::uuid) then raise exception 'Stranger can read badge';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.feature_d'),true);
set local role authenticated;
do $$ begin if exists(select 1 from public.halloween_featured_badges where user_id=current_setting('test.feature_a')::uuid) then raise exception 'Pending friend can read badge';end if;end $$;
reset role;
insert into public.blocks(blocker,blocked) values(current_setting('test.feature_a')::uuid,current_setting('test.feature_b')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.feature_b'),true);
set local role authenticated;
do $$ begin if exists(select 1 from public.halloween_featured_badges where user_id=current_setting('test.feature_a')::uuid) then raise exception 'Blocked friend can read badge';end if;end $$;
reset role;
select 'PASS: owner, accepted friend, stranger, pending friend, blocked friend, browser write denial, anonymous denial, private-document isolation' as checks;
rollback;
