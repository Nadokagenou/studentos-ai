-- Run after prepare + fixture + activate, then ALWAYS roll back the complete transaction.
do $$declare fixture uuid:='00000000-0000-4000-8000-0000ec0a0003';board json;wallet jsonb;reply jsonb;begin
 if (select data#>>'{vault,tokens,bal}' from public.studentos_economy_baselines where user_id=fixture)<>'70' then raise exception 'Legacy balance or pending staff credit lost';end if;
 if (select count(*) from public.studentos_economy_completions where user_id=fixture)<>1 then raise exception 'Legacy leaderboard credit not retained';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',fixture)::text,true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claim.sub',fixture::text,true);
 execute 'set local role authenticated';board:=public.board('friends',null);if (board#>>'{me,n}')::int<>1 then raise exception 'Legacy leaderboard score mismatch: %',board#>>'{me,n}';end if;
 update public.user_state set data=jsonb_set(data,'{tasks}',data->'tasks'||'[{"id":"forged","subject":"QA","detail":"งานปลอมจากเครื่อง","done":true}]'::jsonb) where id=fixture;
 execute 'reset role';update public.board_seen set first_at=now()-interval '10 minutes',done_at=now() where uid=fixture and task_id='forged';
 execute 'set local role authenticated';board:=public.board('friends',null);if (board#>>'{me,n}')::int<>1 then raise exception 'Editable completion minted leaderboard credit';end if;execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',fixture)::text,true);perform set_config('request.jwt.claim.role','service_role',true);execute 'set local role service_role';
 wallet:=jsonb_build_object('version',1,'owner',fixture,'revision',1,'completed','{"legacy":1,"forged":2}'::jsonb,'claims','{}'::jsonb,'roomOwned','[]'::jsonb,'vault',jsonb_build_object('tokens',jsonb_build_object('bal',70,'skins','{}'::jsonb,'staffMinted',25,'staffDebited',5)));
 reply:=public.studentos_economy_commit(fixture,0,gen_random_uuid(),'{"type":"focus-finish","taskId":"forged"}',wallet,'{"completedTaskId":"forged"}');if reply->>'committed'<>'true' then raise exception 'Verified completion did not commit';end if;execute 'reset role';
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',fixture)::text,true);perform set_config('request.jwt.claim.role','authenticated',true);execute 'set local role authenticated';board:=public.board('friends',null);if (board#>>'{me,n}')::int<>2 then raise exception 'Verified completion absent from board';end if;
 update public.user_state set data=jsonb_set(data,'{tasks,1,detail}',to_jsonb('เปลี่ยนชื่องานหลังรับเครดิต'::text)) where id=fixture;board:=public.board('friends',null);if (board#>>'{me,n}')::int<>2 then raise exception 'Renaming changed verified task identity';end if;execute 'reset role';
end $$;
