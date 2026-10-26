-- Run after prepare but before activate in a transaction that MUST roll back.
do $$declare uid uuid:='00000000-0000-4000-8000-0000ec0a0003';begin
 if exists(select 1 from auth.users where id=uid) then raise exception 'Fixture already exists';end if;
 insert into auth.users(id,email,email_confirmed_at) values(uid,'board-qa@example.invalid',now());
 insert into public.user_state(id,data) values(uid,'{"tasks":[{"id":"legacy","subject":"QA","detail":"งานเก่าที่ทำเสร็จ","done":true}],"settings":{},"vault":{"tokens":{"bal":50}}}');
 update public.board_seen set first_at=now()-interval '10 minutes',done_at=now()-interval '2 minutes' where board_seen.uid='00000000-0000-4000-8000-0000ec0a0003'::uuid and task_id='legacy';
end $$;
