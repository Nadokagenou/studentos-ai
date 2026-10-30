-- ============================================================
-- เติมโทเคนด้วยเงินจริง (30 ต.ค. 69)
-- ------------------------------------------------------------
-- ใบเสร็จหนึ่งแถว = การจ่ายเงินหนึ่งครั้งที่ผู้ให้บริการยืนยันแล้ว (Stripe checkout session)
-- เขียนได้จาก Edge Function token-webhook ด้วย service_role เท่านั้น · ผู้ใช้อ่านได้แค่ใบเสร็จของตัวเอง
-- id คือเลข session ของผู้ให้บริการ — webhook ยิงซ้ำกี่รอบก็ได้โทเคนครั้งเดียว
--
-- คลังโทเคนของบัญชี (studentos_economy_*) รู้จัก "โทเคนที่มาจากนอกเกม" อยู่แล้วหนึ่งทาง
-- คือยอดรวมของ staff_token_grants — ยอดนั้นถูกอ่านสามที่ (ฟังก์ชันอ่านยอด · ทริกเกอร์กันแก้ · commit)
-- และทั้งสามต้องได้เลขเดียวกันทุกครั้ง ไม่งั้น commit ปฏิเสธทุกรายการของบัญชีนั้น
-- ไฟล์นี้จึงไม่เพิ่มทางที่สี่ แต่ให้ทั้งสามที่อ่านผ่าน studentos_economy_minted() ตัวเดียว
-- = ของทีมงานแจก + ของที่ซื้อ
--
-- ไม่คัดลอกตัวฟังก์ชันจาก migration เก่ามาเขียนทับ — ตัวที่รันอยู่บนเซิร์ฟเวอร์อาจไม่ตรงกับไฟล์ใน repo
-- (ดูความจำ backend-deploy-drift) จึงอ่านนิยามจริงจากฐานข้อมูลแล้วแทนเฉพาะประโยคที่อ่านยอด
-- ถ้าหาประโยคนั้นไม่เจอพอดีหนึ่งครั้ง ให้ล้มทั้งไฟล์ ดีกว่าแก้ไปครึ่งทาง
-- ============================================================
begin;

create table if not exists public.token_purchases (
  id text primary key check (length(id) between 8 and 200),
  target uuid not null references auth.users(id) on delete cascade,
  pack text not null check (pack ~ '^[a-z0-9_-]{1,32}$'),
  tokens integer not null check (tokens between 1 and 100000),
  amount_satang integer not null check (amount_satang > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  provider text not null default 'stripe',
  livemode boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists token_purchases_target on public.token_purchases(target);

alter table public.token_purchases enable row level security;
revoke all on public.token_purchases from public, anon, authenticated;
grant select on public.token_purchases to authenticated;
grant select, insert on public.token_purchases to service_role;
drop policy if exists token_purchases_own on public.token_purchases;
create policy token_purchases_own on public.token_purchases
  for select to authenticated using (target = auth.uid());

-- ยอดโทเคนที่ "เข้ามาจากนอกเกม" ทั้งหมดของบัญชีหนึ่ง
create or replace function public.studentos_economy_minted(p_user uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(amount) from public.staff_token_grants where target = p_user), 0)
       + coalesce((select sum(tokens) from public.token_purchases where target = p_user), 0);
$$;
revoke all on function public.studentos_economy_minted(uuid) from public, anon, authenticated;
grant execute on function public.studentos_economy_minted(uuid) to service_role;

do $migrate$
declare
  jobs constant text[][] := array[
    array['public.studentos_economy_staff(uuid)',
          '(select sum(amount) from public.staff_token_grants where target=p_user)',
          '(select public.studentos_economy_minted(p_user))'],
    array['studentos_economy_private.protect_economy()',
          '(select sum(amount) from public.staff_token_grants where target=new.id)',
          '(select public.studentos_economy_minted(new.id))'],
    array['public.studentos_economy_commit(uuid,bigint,uuid,jsonb,jsonb,jsonb)',
          'select coalesce(sum(amount),0) into actual_m from public.staff_token_grants where target=p_user;',
          'actual_m:=public.studentos_economy_minted(p_user);']
  ];
  def text; hits int; i int;
begin
  for i in 1 .. array_length(jobs, 1) loop
    def := pg_get_functiondef(jobs[i][1]::regprocedure);
    if position('studentos_economy_minted' in def) > 0 then continue; end if;   -- รันซ้ำได้
    hits := (length(def) - length(replace(def, jobs[i][2], ''))) / length(jobs[i][2]);
    if hits <> 1 then
      raise exception 'token_purchases: % มีประโยคอ่านยอด % ครั้ง (ต้อง 1)', jobs[i][1], hits;
    end if;
    execute replace(def, jobs[i][2], jobs[i][3]);
  end loop;
end
$migrate$;

commit;
