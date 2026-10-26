-- Append after schema.sql in a BEGIN transaction; always ROLLBACK afterwards.
do $$
declare uid uuid:='00000000-0000-4000-8000-0000ec0a0001'; rid uuid:='00000000-0000-4000-8000-0000ec0a0002'; wallet jsonb; reply jsonb; x record; saved jsonb;
begin
 if exists(select 1 from auth.users where id=uid) then raise exception 'Fixture identity already exists';end if;
 insert into auth.users(id,email,email_confirmed_at) values(uid,'wallet-qa@example.invalid',now());
 insert into public.user_state(id,data) values(uid,jsonb_build_object('tasks',jsonb_build_array(jsonb_build_object('id','work','detail','งานเดิม','done',false)),'settings','{}'::jsonb,'vault',jsonb_build_object('tokens',jsonb_build_object('bal',50,'skins','{}'::jsonb),'allBadges',false))) on conflict(id) do update set data=excluded.data;
 insert into public.studentos_economy_baselines(user_id,data,at,staff_minted,staff_debited) select id,data,(extract(epoch from now())*1000)::bigint,0,0 from public.user_state where id=uid;
 update public.studentos_economy_release set active=true where id;
 for x in select c.oid,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('studentos_economy_release','studentos_economy_admins','studentos_economy_baselines','studentos_economy_states','studentos_economy_requests','studentos_economy_completions','studentos_economy_room_catalog') loop
  if not x.relrowsecurity or has_table_privilege('anon',x.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',x.oid,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Wallet privilege failure: %',x.relname;end if;
 end loop;
 if has_function_privilege('anon','public.studentos_economy_commit(uuid,bigint,uuid,jsonb,jsonb,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.studentos_economy_commit(uuid,bigint,uuid,jsonb,jsonb,jsonb)','EXECUTE') then raise exception 'Browser can execute commit';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',uid)::text,true);perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claim.sub',uid::text,true);
 execute 'set local role service_role';
 wallet:=jsonb_build_object('version',1,'owner',uid,'revision',1,'completed','{}'::jsonb,'claims','{}'::jsonb,'roomOwned','[]'::jsonb,'vault',jsonb_build_object('tokens',jsonb_build_object('bal',20,'skins','{}'::jsonb,'bought',jsonb_build_array('warm'),'staffMinted',0,'staffDebited',0),'allBadges',false,'genesis',false,'badgeSecrets','[]'::jsonb,'codeThemes','[]'::jsonb,'luck',false,'at',(extract(epoch from now())*1000)::bigint));
 reply:=public.studentos_economy_commit(uid,0,rid,'{"type":"theme-buy","item":"warm"}',wallet,'{"type":"theme-buy"}');
 if reply->>'committed'<>'true' then raise exception 'Initial commit failed';end if;
 reply:=public.studentos_economy_commit(uid,0,rid,'{"type":"theme-buy","item":"warm"}',wallet,'{"type":"theme-buy"}');if reply->>'replay'<>'true' then raise exception 'Receipt replay failed';end if;
 reply:=public.studentos_economy_commit(uid,0,gen_random_uuid(),'{"type":"theme-buy","item":"space"}',wallet,'{}');if reply->>'committed'<>'false' then raise exception 'Stale revision overwrote wallet';end if;
 begin perform public.studentos_economy_commit(uid,0,rid,'{"type":"daily"}',wallet,'{}');raise exception 'Changed receipt action accepted';exception when raise_exception then if sqlerrm='Changed receipt action accepted' then raise;end if;end;
 execute 'reset role';
 if (select count(*) from public.studentos_economy_requests where user_id=uid)<>1 then raise exception 'Duplicate request was saved';end if;
 if (select document#>>'{vault,tokens,bal}' from public.studentos_economy_states where user_id=uid)<>'20' then raise exception 'Balance changed twice';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',uid)::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 execute 'set local role authenticated';
 begin perform 1 from public.studentos_economy_states;raise exception 'Browser could read private wallets';exception when insufficient_privilege then null;end;
 begin insert into public.studentos_economy_requests(user_id,request_id,action,result) values(uid,gen_random_uuid(),'{}','{}');raise exception 'Browser could forge receipts';exception when insufficient_privilege then null;end;
 begin perform public.studentos_economy_commit(uid,0,rid,'{}',wallet,'{}');raise exception 'Browser could call commit';exception when insufficient_privilege then null;end;
 update public.user_state set data=jsonb_set(data,'{tasks,0,detail}',to_jsonb('งานยังบันทึกได้'::text))||jsonb_build_object('vault',jsonb_build_object('tokens',jsonb_build_object('bal',999999,'skins',jsonb_build_object('glitch',99),'staffMinted',777),'allBadges',true,'genesis',true,'badgeSecrets',jsonb_build_array('ocean','earth','galaxy'),'codeThemes',jsonb_build_array('astral')),'settings',jsonb_build_object('room',jsonb_build_object('owned',jsonb_build_array('wall:navy'),'wall','navy','on',jsonb_build_object('ceiling','hw-velvet-bat')))) where id=uid;
 execute 'reset role';
 select data into saved from public.user_state where id=uid;
 if saved#>>'{tasks,0,detail}'<>'งานยังบันทึกได้' then raise exception 'Ordinary work was blocked';end if;
 if saved#>>'{vault,tokens,bal}'<>'20' or coalesce(saved#>>'{vault,tokens,skins,glitch}','0')<>'0' or saved#>>'{vault,allBadges}'<>'false' or saved#>>'{vault,genesis}'<>'false' or saved#>'{vault,codeThemes}'<>'[]'::jsonb then raise exception 'Browser reward fields escaped guard';end if;
 if saved#>'{settings,room,owned}'<>'[]'::jsonb or saved#>>'{settings,room,wall}'<>'cream' or saved#>>'{settings,room,on,ceiling}'<>'none' then raise exception 'Forged room escaped guard';end if;
 if (select document#>>'{vault,tokens,bal}' from public.studentos_economy_states where user_id=uid)<>'20' then raise exception 'Browser changed authoritative wallet';end if;
end $$;
