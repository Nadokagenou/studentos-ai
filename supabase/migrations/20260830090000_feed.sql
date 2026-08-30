-- ============================================================
-- 11 · ฟีด — โพสต์ · ตอบเป็นเธรด · สามขอบเขต
-- ------------------------------------------------------------
-- ทำไมต้องเป็นฟีด ไม่ใช่รายชื่อ: รายชื่อเป็นของนิ่ง เปิดวันนี้กับพรุ่งนี้เห็นเหมือนกันเป๊ะ
-- จึงไม่มีเหตุผลให้เปิดซ้ำ · ฟีดเปลี่ยนทุกครั้งที่เปิด นั่นคือสิ่งที่ทำให้คนกลับมา
--
-- แล้วต่างจาก IG ตรงไหน: IG เรียงฟีดตามความนิยม เราเรียงตาม "ใครช่วยใครได้"
-- โพสต์ถามเลขจะถูกดันขึ้นบนให้คนที่เก่งเลขเห็นก่อน (ดู feed() ข้างล่าง)
-- ตัวจับคู่ที่ทำไว้ใน migration 10 จึงกลายเป็น "อัลกอริทึมจัดฟีด" ไม่ใช่หน้าจอหนึ่งหน้า
--
-- ปัญหาใหญ่ที่สุดของฟีดห้องเรียน: ห้องมี 30 คน แต่ติดตั้งแอปจริงอาจมี 5
-- โพสต์ใหม่สัปดาห์ละใบ = ฟีดตาย ต่อให้ดีไซน์สวยแค่ไหน
-- จึงมีสามขอบเขต และแท็บ "ทั้งหมด" เป็นซูเปอร์เซ็ตเสมอ — ไม่มีวันว่างกว่าแท็บอื่น
-- ============================================================

-- โรงเรียน — ไม่บังคับกรอก · ใช้เป็นขอบเขตกลางระหว่างห้องกับทั้งแอป
-- ไม่ได้เอาไปโชว์บนโปรไฟล์สาธารณะ มันมีหน้าที่เดียวคือกรองฟีด
alter table public.profiles add column if not exists school text;

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null references auth.users(id) on delete cascade,

  -- ใครเห็นได้ — คนโพสต์เลือกเองตอนโพสต์ ไม่ใช่ระบบเดา
  scope       text not null default 'room' check (scope in ('room', 'school', 'all')),
  room_id     text,          -- ใช้เมื่อ scope='room' · มาจาก line_links
  school      text,          -- ถ่ายสำเนาไว้ตอนโพสต์ เมื่อ scope='school'
                             -- ถ่ายสำเนาโดยตั้งใจ: ย้ายโรงเรียนแล้วโพสต์เก่าต้องอยู่ที่เดิม
                             -- ไม่ใช่หายไปจากฟีดโรงเรียนเดิมทั้งก้อน

  kind        text not null default 'help' check (kind in ('help', 'note', 'chat')),
  subject     text,          -- วิชา — ตัวที่ทำให้ฟีดจัดลำดับได้
  body        text not null check (length(body) between 1 and 1000),
  image       text,          -- path ใน storage bucket 'posts' · null = โพสต์ข้อความล้วน

  -- ไม่ระบุชื่อรายโพสต์ · "ข้อ 7 ทำไม่เป็น" คือการยอมรับว่าตัวเองไม่รอด
  -- บังคับติดชื่อทุกโพสต์ = ไม่มีใครกล้าถาม ซึ่งฆ่าโพสต์ชนิดที่สำคัญที่สุดในแอปนี้
  anon        boolean not null default false,

  created_at  timestamptz not null default now(),
  reply_count integer not null default 0
);

create index if not exists posts_scope_idx  on public.posts (scope, created_at desc);
create index if not exists posts_room_idx   on public.posts (room_id, created_at desc);
create index if not exists posts_school_idx on public.posts (school, created_at desc);
create index if not exists posts_author_idx on public.posts (author, created_at desc);

alter table public.posts enable row level security;

-- ---------- โรงเรียนของฉัน ----------
create or replace function public.my_school()
returns text
language sql
stable
security definer
set search_path = public
as $$ select school from public.profiles where id = auth.uid() $$;

revoke all on function public.my_school() from public, anon;
grant execute on function public.my_school() to authenticated;

-- ---------- อยู่ห้องนี้ไหม ----------
create or replace function public.in_room(p_room text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.line_links
     where user_id = auth.uid() and room_id = p_room
  );
$$;

revoke all on function public.in_room(text) from public, anon;
grant execute on function public.in_room(text) to authenticated;

-- ---------- ใครเห็นโพสต์ไหนได้ ----------
-- กติกาเดียวใช้ทั้งอ่านโพสต์และอ่านคำตอบ — เขียนไว้ที่เดียว
-- ถ้ากระจายไปหลาย policy วันที่แก้กติกาจะแก้ไม่ครบ แล้วช่องที่ลืมคือช่องที่ข้อมูลรั่ว
create or replace function public.can_see_post(p_scope text, p_room text, p_school text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_scope
    when 'all'    then true
    when 'school' then p_school is not null and p_school = public.my_school()
    when 'room'   then p_room is not null and public.in_room(p_room)
    else false
  end;
$$;

revoke all on function public.can_see_post(text, text, text) from public, anon;
grant execute on function public.can_see_post(text, text, text) to authenticated;

drop policy if exists "read visible posts" on public.posts;
create policy "read visible posts" on public.posts
  for select to authenticated
  using (author = auth.uid() or public.can_see_post(scope, room_id, school));

-- เขียนได้ในนามตัวเองเท่านั้น และเฉพาะขอบเขตที่ตัวเองอยู่จริง
-- (โพสต์ลงห้องที่ตัวเองไม่ได้อยู่ไม่ได้ · โพสต์ลงโรงเรียนที่ไม่ใช่ของตัวเองไม่ได้)
drop policy if exists "write own posts" on public.posts;
create policy "write own posts" on public.posts
  for insert to authenticated
  with check (
    author = auth.uid()
    and case scope
      when 'all'    then true
      when 'school' then school is not null and school = public.my_school()
      when 'room'   then room_id is not null and public.in_room(room_id)
      else false
    end
  );

drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts" on public.posts
  for delete to authenticated using (author = auth.uid());

-- ============================================================
-- คำตอบใต้โพสต์ — เธรดแบบ X
-- ------------------------------------------------------------
-- ตอบใต้โพสต์ ไม่ใช่ทักส่วนตัว เพราะคำตอบมีประโยชน์กับคนที่เงียบ ๆ อ่านอยู่ด้วย
-- และคนตอบได้หน้าต่อหน้าทั้งห้อง ซึ่งเป็นค่าตอบแทนเดียวที่แอปนี้จ่ายได้
-- ============================================================
create table if not exists public.post_replies (
  id         bigint generated always as identity primary key,
  post       uuid not null references public.posts(id) on delete cascade,
  author     uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(body) between 1 and 1000),
  anon       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists post_replies_post_idx on public.post_replies (post, created_at);

alter table public.post_replies enable row level security;

drop policy if exists "read replies of visible posts" on public.post_replies;
create policy "read replies of visible posts" on public.post_replies
  for select to authenticated
  using (exists (
    select 1 from public.posts p
     where p.id = post
       and (p.author = auth.uid() or public.can_see_post(p.scope, p.room_id, p.school))
  ));

drop policy if exists "write own replies" on public.post_replies;
create policy "write own replies" on public.post_replies
  for insert to authenticated
  with check (
    author = auth.uid()
    and exists (
      select 1 from public.posts p
       where p.id = post
         and (p.author = auth.uid() or public.can_see_post(p.scope, p.room_id, p.school))
    )
  );

drop policy if exists "delete own replies" on public.post_replies;
create policy "delete own replies" on public.post_replies
  for delete to authenticated using (author = auth.uid());

-- นับคำตอบที่ฝั่งเซิร์ฟเวอร์ ไม่ให้แอปเป็นคนนับ
-- แอปที่เน็ตหลุดกลางทางจะนับพลาด แล้วเลขบนการ์ดจะเพี้ยนถาวรโดยไม่มีอะไรฟ้อง
create or replace function public.bump_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set reply_count = reply_count + 1 where id = new.post;
    return new;
  else
    update public.posts set reply_count = greatest(0, reply_count - 1) where id = old.post;
    return old;
  end if;
end;
$$;

drop trigger if exists replies_count on public.post_replies;
create trigger replies_count after insert or delete on public.post_replies
  for each row execute function public.bump_reply_count();

-- ============================================================
-- ฟีด — จุดที่ "ใครช่วยใครได้" กลายเป็นลำดับการเรียง
-- ------------------------------------------------------------
-- ชื่อคนโพสต์ถูกกลบที่นี่ ไม่ใช่ที่ฝั่งแอป
-- ถ้าปล่อยให้แอปเป็นคนซ่อน ใครเปิดแท็บ network ดูก็รู้ว่าใครโพสต์ —
-- "ไม่ระบุชื่อ" ที่เปิดดูได้ แย่กว่าไม่มีให้เลือกตั้งแต่แรก
-- ============================================================
create or replace function public.feed(
  p_scope  text default 'all',   -- 'room' | 'school' | 'all'
  p_before timestamptz default null,
  p_limit  int default 20
)
returns table (
  id           uuid,
  scope        text,
  kind         text,
  subject      text,
  body         text,
  image        text,
  anon         boolean,
  created_at   timestamptz,
  reply_count  integer,
  author       uuid,
  display_name text,
  avatar       text,
  mine         boolean,
  for_me       boolean          -- เขาถามวิชาที่ "เรา" เก่ง — ตัวที่ดันโพสต์ขึ้นบน
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select coalesce((select strong from public.profiles where id = auth.uid()), '{}'::text[]) as strong
  )
  select
    p.id, p.scope, p.kind, p.subject, p.body, p.image, p.anon, p.created_at, p.reply_count,
    -- โพสต์ไม่ระบุชื่อ: คืน null ทั้งสามช่อง ยกเว้นเจ้าของโพสต์เองที่ต้องเห็นว่าอันไหนของตัว
    case when p.anon and p.author <> auth.uid() then null else p.author end,
    case when p.anon and p.author <> auth.uid() then null else pr.display_name end,
    case when p.anon and p.author <> auth.uid() then null else pr.avatar end,
    p.author = auth.uid(),
    (p.kind = 'help' and p.subject is not null and p.subject = any(me.strong)
     and p.author <> auth.uid())
  from public.posts p
  left join public.profiles pr on pr.id = p.author
  cross join me
  where (p_scope = 'all' or p.scope = p_scope)
    and (p.author = auth.uid() or public.can_see_post(p.scope, p.room_id, p.school))
    and (p_before is null or p.created_at < p_before)
  -- โพสต์ที่ยังไม่มีใครตอบและเราช่วยได้ ขึ้นก่อนเสมอ — ของที่รอคนช่วยอยู่จริง
  -- ต้องอยู่บนสุด ไม่ใช่ไหลหายไปตามเวลาเหมือนโพสต์ที่ตอบไปแล้ว
  order by (p.kind = 'help' and p.reply_count = 0
            and p.subject = any(me.strong) and p.author <> auth.uid()) desc,
           p.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.feed(text, timestamptz, int) from public, anon;
grant execute on function public.feed(text, timestamptz, int) to authenticated;

-- อ่านคำตอบใต้โพสต์หนึ่งใบ — กลบชื่อด้วยกติกาเดียวกับฟีด
create or replace function public.post_thread(p_post uuid)
returns table (
  id           bigint,
  body         text,
  anon         boolean,
  created_at   timestamptz,
  author       uuid,
  display_name text,
  avatar       text,
  mine         boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.body, r.anon, r.created_at,
    case when r.anon and r.author <> auth.uid() then null else r.author end,
    case when r.anon and r.author <> auth.uid() then null else pr.display_name end,
    case when r.anon and r.author <> auth.uid() then null else pr.avatar end,
    r.author = auth.uid()
  from public.post_replies r
  left join public.profiles pr on pr.id = r.author
  join public.posts p on p.id = r.post
  where r.post = p_post
    and (p.author = auth.uid() or public.can_see_post(p.scope, p.room_id, p.school))
  order by r.created_at
  limit 200;
$$;

revoke all on function public.post_thread(uuid) from public, anon;
grant execute on function public.post_thread(uuid) to authenticated;

-- ---------- รูปโจทย์ ----------
-- เก็บใน storage ไม่ใช่ data URL ในตาราง — ฟีด 20 ใบที่มีรูปฝังมาด้วยคือหลายเมกะไบต์
-- ต่อการเปิดหนึ่งครั้ง ซึ่งบนเน็ตมือถือแปลว่าเปิดไม่ขึ้น
insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

drop policy if exists "post images readable" on storage.objects;
create policy "post images readable" on storage.objects
  for select to public using (bucket_id = 'posts');

-- อัปโหลดลงโฟลเดอร์ชื่อ uid ของตัวเองเท่านั้น — กันเขียนทับไฟล์ของคนอื่น
drop policy if exists "post images own upload" on storage.objects;
create policy "post images own upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post images own delete" on storage.objects;
create policy "post images own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- โพสต์ใหม่ต้องไหลเข้าฟีดเอง ----------
-- ไม่มีบรรทัดนี้ = subscribe ได้โดยไม่ error แต่ไม่มีอะไรวิ่งมาสักครั้ง
-- ซึ่งอ่านเหมือน "ไม่มีคนโพสต์" มากกว่า "ลืมเปิด" และหาสาเหตุยากมาก
do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.post_replies;
exception when duplicate_object then null;
end $$;
