-- Optional: run AFTER migration/functions/VAPID setup.
-- Owner creates the Vault secret "studentos_service_role_key" using the project's
-- existing service_role key directly in Supabase. Never put its value in this file.
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='studentos_service_role_key') then
    raise exception 'Create the studentos_service_role_key Vault secret first';
  end if;
end $$;
-- Run once. If updating an existing job, unschedule that job by its name first.
select cron.schedule('studentos-staff-notify','* * * * *',$job$
  select net.http_post(
    url:='https://yunbytxtgghizrdqftvj.supabase.co/functions/v1/staff-notify',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
      (select decrypted_secret from vault.decrypted_secrets where name='studentos_service_role_key' limit 1)),
    body:='{}'::jsonb,
    timeout_milliseconds:=60000
  );
$job$);
