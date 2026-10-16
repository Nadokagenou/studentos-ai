-- Safer public wrapper: anonymous callers execute only as themselves, never
-- as the database owner. The privileged self-only check remains authenticated.
create or replace function public.staff_check_account_request()
returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.role() is distinct from 'authenticated' then return; end if;
  if coalesce(current_setting('request.path',true),'') in
    ('/rpc/staff_account_status','/rpc/staff_personal_notices','rpc/staff_account_status','rpc/staff_personal_notices') then return; end if;
  if not public.staff_account_allowed() then
    raise sqlstate 'PT403' using message='บัญชีถูกระงับการใช้งานออนไลน์ กรุณาดูเหตุผลในการแจ้งเตือน';
  end if;
end $$;
grant execute on function public.staff_check_account_request() to anon;
notify pgrst,'reload schema';
