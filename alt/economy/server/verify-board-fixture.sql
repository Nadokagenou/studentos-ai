-- Run after prepare but before activate in a transaction that MUST roll back.
do $$declare uid uuid:='00000000-0000-4000-8000-0000ec0a0003';grant_id uuid:=gen_random_uuid();debit_id uuid:=gen_random_uuid();begin
 if exists(select 1 from auth.users where id=uid) then raise exception 'Fixture already exists';end if;
 insert into auth.users(id,email,email_confirmed_at) values(uid,'board-qa@example.invalid',now());
 insert into public.user_state(id,data) values(uid,'{"tasks":[{"id":"legacy","subject":"QA","detail":"งานเก่าที่ทำเสร็จ","done":true}],"settings":{},"vault":{"tokens":{"bal":50}}}');
 update public.board_seen set first_at=now()-interval '10 minutes',done_at=now()-interval '2 minutes' where board_seen.uid='00000000-0000-4000-8000-0000ec0a0003'::uuid and task_id='legacy';
 insert into public.staff_audit(id,actor,actor_login,action,detail) values(grant_id,uid,'board-qa@example.invalid','qa-grant','Rollback fixture'),(debit_id,uid,'board-qa@example.invalid','qa-debit','Rollback fixture');
 insert into public.staff_token_grants(id,target,amount) values(grant_id,uid,25);
 insert into public.staff_token_debits(id,target,amount) values(debit_id,uid,5);
 if (select data#>>'{vault,tokens,bal}' from public.user_state where id=uid)<>'50' then raise exception 'Fixture must exercise unreconciled staff credit';end if;
end $$;
