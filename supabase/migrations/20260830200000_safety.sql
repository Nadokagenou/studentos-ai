-- ============================================================
-- 14 · ชุดความปลอดภัย
-- ------------------------------------------------------------
-- ผู้ใช้ของแอปนี้เป็นผู้เยาว์ทั้งหมด สิ่งที่ทำให้แอปแบบนี้อันตรายไม่ใช่
-- "การมีเด็กใช้" แต่คือ "การที่คนแปลกหน้าเข้าถึงเด็กได้"
-- ทุกอย่างในไฟล์นี้ตั้งอยู่บนเส้นนั้นเส้นเดียว
--
-- สี่อย่างที่เพิ่ม:
--   1) รายงานเนื้อหา + ซ่อนอัตโนมัติเมื่อถูกรายงานถึงเกณฑ์
--   2) ลบบัญชีและข้อมูลทั้งหมดได้ด้วยตัวเอง
--   3) ช่องอายุ — ต่ำกว่าเกณฑ์โพสต์ได้เฉพาะในห้องเรียน
--   4) ตัดขอบเขต "ทุกคนในแอป" ออกจากการโพสต์
--      (แท็บ "ทั้งหมด" ยังอยู่ มันคือมุมมองรวมของสิ่งที่เราเห็นได้ ไม่ใช่การกระจายเสียง)
-- ============================================================

-- ---------- ธงซ่อน ----------
alter table public.posts        add column if not exists hidden boolean not null default false;
alter table public.post_replies add column if not exists hidden boolean not null default false;

-- ---------- อายุ ----------
-- เก็บเป็นช่วง ไม่เก็บวันเกิด — เราต้องการรู้แค่ "ถึงเกณฑ์ไหม" ไม่ได้ต้องการรู้วันเกิด
-- เก็บน้อยที่สุดเท่าที่ตอบคำถามได้ คือหลักการที่ทำให้ข้อมูลรั่วแล้วเสียหายน้อยที่สุด
alter table public.profiles add column if not exists age_band text
  check (age_band in ('under', 'ok'));
alter table public.profiles add column if not exists agreed_at timestamptz;

-- ============================================================
-- 1 · รายงานเนื้อหา
-- ------------------------------------------------------------
-- ปุ่มรายงานไม่ใช่แค่มารยาท — การมีระบบรับแจ้งและจัดการจริง คือสิ่งที่แสดงว่า
-- ผู้ให้บริการดูแลแพลตฟอร์ม ไม่ได้ปล่อยปละ · หนึ่งคนรายงานได้ครั้งเดียวต่อหนึ่งชิ้น
-- ไม่งั้นคนเดียวกดรัว ๆ ก็ปิดปากคนอื่นได้
-- ============================================================
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  reporter    uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('post', 'reply')),
  target      text not null,          -- id ของโพสต์ (uuid) หรือคำตอบ (bigint) เก็บเป็นข้อความ
  reason      text not null check (reason in ('bully', 'sexual', 'violence', 'spam', 'other')),
  note        text check (note is null or length(note) <= 300),
  created_at  timestamptz not null default now(),
  unique (reporter, kind, target)
);

create index if not exists reports_target_idx on public.reports (kind, target);

alter table public.reports enable row level security;

-- เขียนได้อย่างเดียว อ่านไม่ได้แม้แต่ของตัวเอง — รายการคำร้องเรียนไม่ใช่ของสาธารณะ
-- และการให้อ่านได้ = คนดูออกว่าใครรายงานใคร ซึ่งย้อนกลับมาเป็นการกลั่นแกล้งรอบสอง
drop policy if exists "report only" on public.reports;
create policy "report only" on public.reports
  for insert to authenticated with check (reporter = auth.uid());

-- ---------- ซ่อนเมื่อถูกรายงานถึงเกณฑ์ ----------
-- สามคนที่ต่างกัน ไม่ใช่สามครั้ง · ซ่อนก่อนแล้วค่อยให้คนตรวจ ดีกว่าปล่อยไว้จนมีคนตรวจ
-- เพราะเวลาที่เนื้อหาแย่ค้างอยู่บนจอ คือเวลาที่มันทำร้ายคนได้จริง
create or replace function public.apply_report_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  select count(distinct reporter) into n
    from public.reports where kind = new.kind and target = new.target;

  if n >= 3 then
    if new.kind = 'post' then
      update public.posts set hidden = true where id = new.target::uuid;
    else
      update public.post_replies set hidden = true where id = new.target::bigint;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_threshold on public.reports;
create trigger reports_threshold after insert on public.reports
  for each row execute function public.apply_report_threshold();

-- ---------- ประตูรายงานของฝั่งแอป ----------
create or replace function public.report_content(p_kind text, p_target text, p_reason text, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  insert into public.reports (reporter, kind, target, reason, note)
  values (auth.uid(), p_kind, p_target, p_reason, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (reporter, kind, target) do nothing;
  return 'ok';
end;
$$;

revoke all on function public.report_content(text, text, text, text) from public, anon;
grant execute on function public.report_content(text, text, text, text) to authenticated;

-- ============================================================
-- 2 · ลบบัญชีและข้อมูลทั้งหมด
-- ------------------------------------------------------------
-- PDPA ให้สิทธิ์เจ้าของข้อมูลขอลบ · และในทางปฏิบัติ ปุ่มนี้คือสิ่งที่ทำให้คน
-- กล้าลองใช้ตั้งแต่แรก เพราะเขารู้ว่าถอนตัวได้จริงเมื่อไหร่ก็ได้
--
-- ลบแถวใน auth.users แล้ว foreign key ทุกเส้นที่ตั้ง on delete cascade ไว้
-- จะลากของที่เหลือไปเองทั้งหมด — เขียนลบทีละตารางแปลว่าวันที่เพิ่มตารางใหม่
-- แล้วลืมมาแก้ตรงนี้ ข้อมูลก้อนนั้นจะค้างอยู่ตลอดไปโดยไม่มีใครรู้
-- ============================================================
create or replace function public.delete_account()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;

  -- ตารางที่ไม่ได้ผูก cascade กับ auth.users ต้องเก็บกวาดเอง
  delete from public.reports where reporter = v_me;

  -- ที่เหลือไหลตาม cascade: user_state · profiles · posts · post_replies ·
  -- friendships · dm_threads · dm_messages · blocks · line_links · push_subscriptions
  delete from auth.users where id = v_me;
  return 'deleted';
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ============================================================
-- 3 · ขอบเขตการโพสต์ผูกกับอายุ
-- ------------------------------------------------------------
-- ต่ำกว่าเกณฑ์ = โพสต์ได้เฉพาะในห้องเรียนที่รู้จักกันตัวจริงเท่านั้น
-- และตัด 'all' ออกจากการโพสต์ของทุกคน — ไม่มีใครกระจายเสียงหาคนทั้งแอปได้อีก
-- ของเดิมที่โพสต์ไว้แล้วไม่ถูกแตะ มันยังอ่านได้เหมือนเดิม แค่โพสต์ใหม่แบบนั้นไม่ได้
-- ============================================================
drop policy if exists "write own posts" on public.posts;
create policy "write own posts" on public.posts
  for insert to authenticated
  with check (
    author = auth.uid()
    and case scope
      when 'room'   then room_id is not null and public.in_room(room_id)
      when 'school' then school is not null and school = public.my_school()
                         and coalesce((select age_band from public.profiles
                                        where id = auth.uid()), 'under') = 'ok'
      else false            -- 'all' ปิดแล้ว
    end
  );

-- ============================================================
-- 4 · ของที่ถูกซ่อนต้องหายจากทุกทางที่อ่านได้
-- ------------------------------------------------------------
-- ซ่อนแล้วแต่ยังโผล่ในหน้าโปรไฟล์ = ไม่ได้ซ่อน · จึงต้องแก้ทั้งสามฟังก์ชันพร้อมกัน
-- ============================================================
create or replace function public.feed(
  p_scope  text default 'all',
  p_before timestamptz default null,
  p_limit  int default 20
)
returns table (
  id uuid, scope text, kind text, subject text, body text, image text,
  anon boolean, created_at timestamptz, reply_count integer,
  author uuid, display_name text, avatar text, mine boolean, for_me boolean
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select coalesce((select strong from public.profiles where id = auth.uid()), '{}'::text[]) as strong
  )
  select
    p.id, p.scope, p.kind, p.subject, p.body, p.image, p.anon, p.created_at, p.reply_count,
    case when p.anon and p.author <> auth.uid() then null else p.author end,
    case when p.anon and p.author <> auth.uid() then null else pr.display_name end,
    case when p.anon and p.author <> auth.uid() then null else pr.avatar end,
    p.author = auth.uid(),
    (p.kind = 'help' and p.subject is not null and p.subject = any(me.strong)
     and p.author <> auth.uid())
  from public.posts p
  left join public.profiles pr on pr.id = p.author
  cross join me
  where not p.hidden
    and (p_scope = 'all' or p.scope = p_scope)
    and (p.author = auth.uid() or public.can_see_post(p.scope, p.room_id, p.school))
    and (p_before is null or p.created_at < p_before)
  order by (p.kind = 'help' and p.reply_count = 0
            and p.subject = any(me.strong) and p.author <> auth.uid()) desc,
           p.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.feed(text, timestamptz, int) from public, anon;
grant execute on function public.feed(text, timestamptz, int) to authenticated;

create or replace function public.post_thread(p_post uuid)
returns table (
  id bigint, body text, anon boolean, created_at timestamptz,
  author uuid, display_name text, avatar text, mine boolean
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.body, r.anon, r.created_at,
    case when r.anon and r.author <> auth.uid() then null else r.author end,
    case when r.anon and r.author <> auth.uid() then null else pr.display_name end,
    case when r.anon and r.author <> auth.uid() then null else pr.avatar end,
    r.author = auth.uid()
  from public.post_replies r
  left join public.profiles pr on pr.id = r.author
  join public.posts p on p.id = r.post
  where r.post = p_post and not r.hidden and not p.hidden
    and (p.author = auth.uid() or public.can_see_post(p.scope, p.room_id, p.school))
  order by r.created_at
  limit 200;
$$;

revoke all on function public.post_thread(uuid) from public, anon;
grant execute on function public.post_thread(uuid) to authenticated;

create or replace function public.user_posts(p_user uuid, p_limit int default 20)
returns table (
  id uuid, scope text, kind text, subject text, body text, image text,
  anon boolean, created_at timestamptz, reply_count integer, mine boolean
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.scope, p.kind, p.subject, p.body, p.image, p.anon,
         p.created_at, p.reply_count, p.author = auth.uid()
    from public.posts p
   where p.author = p_user
     and not p.hidden
     and (p.author = auth.uid() or not p.anon)
     and (p.author = auth.uid() or public.can_see_post(p.scope, p.room_id, p.school))
     and (p_user = auth.uid() or public.shares_room(p_user))
   order by p.created_at desc
   limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.user_posts(uuid, int) from public, anon;
grant execute on function public.user_posts(uuid, int) to authenticated;
