-- ============================================================
-- 10 · ตัวตน · เพื่อน · ช่องคุย
-- ------------------------------------------------------------
-- เหตุผลที่ชั้นนี้มีอยู่ เขียนไว้ให้ชัดเพราะมันไม่ใช่ "โซเชียลอีกอัน":
--
-- แอปแบบ Fastwork เดินได้เพราะมีคนสองแบบที่ต้องการกัน — คนจ้างกับคนรับงาน
-- แอปนักเรียนดูเหมือนมีฝั่งเดียว ทุกคนเป็น "นักเรียน" เหมือนกันหมด
-- แต่จริง ๆ ไม่ใช่: **คนหนึ่งคนเป็นทั้งสองฝั่งพร้อมกัน แยกตามวิชา**
-- คนที่รอดเคมีแต่จมเลข คือคนขายของสายเคมี และคนซื้อของสายเลข ในคนเดียวกัน
--
-- และเรารู้ว่าใครจมวิชาไหน ซึ่ง Discord/IG/LINE ไม่มีทางรู้ เพราะข้อมูลนั้น
-- อยู่ในงานที่ค้าง ในเวลาที่จับไว้ และในสถิติส่งทันกำหนดที่แอปเก็บมาตลอด
-- นั่นทำให้แอปเป็นคนแนะนำได้ว่า "คนนี้ช่วยเธอเรื่องนี้ได้" —
-- ซึ่งแก้ปัญหาที่ฆ่าโซเชียลใหม่ทุกตัว: วันแรกไม่มีเพื่อนและไม่มีอะไรจะพิมพ์
--
-- เส้นที่ตารางพวกนี้ยืนอยู่:
--   ข้อมูลงานจริง (user_state)  → ห้ามให้ใครอื่นอ่าน ตลอดกาล
--   สรุปว่ารอด/จมวิชาไหน        → ฝั่งแอปคิดเองแล้วเขียนลง profiles ตารางนี้
-- แปลว่าเพื่อนเห็นได้แค่ "เคมีรอด เลขไม่รอด" ไม่เคยเห็นว่ามีงานอะไรค้างอยู่บ้าง
-- ============================================================

-- ============================================================
-- 1 · โปรไฟล์
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'นักเรียน',
  avatar        text,                       -- รูปย่อแล้วเป็น data URL · null = ใช้ตัวอักษรแรกของชื่อ
  bio           text,
  -- วิชาที่รอด / วิชาที่จม — ฝั่งแอปคิดจากข้อมูลของตัวเองแล้วส่งขึ้นมา
  -- ไม่ได้คิดที่นี่ เพราะการคิดต้องใช้ข้อมูลงานดิบซึ่งอยู่หลัง RLS ของเจ้าของ
  strong        text[] not null default '{}',
  weak          text[] not null default '{}',
  -- ปิดตัวเองจากหน้าค้นหาของเพื่อนร่วมห้องได้ โดยไม่ต้องออกจากห้อง
  open_to_help  boolean not null default true,
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------- อยู่ห้องเดียวกันไหม ----------
-- security definer เพราะ line_links ปิดด้วย RLS "own links" (เห็นได้เฉพาะแถวตัวเอง)
-- ถ้าไม่มีฟังก์ชันนี้ ฝั่งแอปจะไม่มีทางรู้เลยว่าใครเรียนห้องเดียวกับตัวเอง
-- ฟังก์ชันตอบแค่ "ใช่/ไม่ใช่" ทีละคน ไม่เคยคืนรายชื่อห้องหรือรายชื่อสมาชิกออกไป
create or replace function public.shares_room(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.line_links me
      join public.line_links them on them.room_id = me.room_id
     where me.user_id = auth.uid()
       and them.user_id = p_user
  );
$$;

revoke all on function public.shares_room(uuid) from public, anon;
grant execute on function public.shares_room(uuid) to authenticated;

-- คีย์หลักของ line_links คือ (user_id, room_id) — เรียงแบบนั้นแปลว่าการหา
-- "ใครอยู่ห้องนี้บ้าง" (ค้นด้วย room_id ตัวเดียว) ใช้ index นั้นไม่ได้เลย ต้องไล่ทั้งตาราง
-- ซึ่ง shares_room() ทำทุกแถวของทุกครั้งที่เปิดหน้ารายชื่อเพื่อน
create index if not exists line_links_room_idx on public.line_links (room_id);

-- ---------- ใครอ่านโปรไฟล์ใครได้ ----------
-- ตัวเองเสมอ · คนที่อยู่ห้องเดียวกันเท่านั้น · คนนอกไม่เห็นอะไรเลยสักแถว
-- ไม่มี policy สำหรับ anon แปลว่ายังไม่ได้ล็อกอิน = อ่านไม่ได้เลย
drop policy if exists "read own or roommates" on public.profiles;
create policy "read own or roommates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_room(id));

drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================
-- 2 · บล็อก
-- ------------------------------------------------------------
-- ต้องมาก่อนตารางแชท ไม่ใช่ตามมาทีหลัง เพราะ policy ของแชทอ้างถึงมัน
-- บล็อกแล้วเงียบทั้งสองทาง: ทักไม่ได้ · ไม่โผล่ในรายการแนะนำ · ไม่เห็นโปรไฟล์กัน
-- ============================================================
create table if not exists public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  made_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

alter table public.blocks enable row level security;

drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks
  for all to authenticated
  using (blocker = auth.uid()) with check (blocker = auth.uid());

-- อ่านสองทาง — ฝั่งที่ถูกบล็อกต้องไม่รู้ว่าถูกบล็อก จึงเช็คในฟังก์ชันที่ปิดอยู่
create or replace function public.is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
     where (blocker = p_a and blocked = p_b)
        or (blocker = p_b and blocked = p_a)
  );
$$;

revoke all on function public.is_blocked(uuid, uuid) from public, anon;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- ============================================================
-- 3 · ช่องคุยตัวต่อตัว
-- ------------------------------------------------------------
-- คู่สนทนาเก็บเรียง a < b เสมอ · คู่เดิมจึงได้ห้องเดิมทุกครั้ง ไม่มีทางเกิดสองห้อง
-- ซึ่งเป็นบั๊กที่หาสาเหตุยากมากเวลาเจอ (ข้อความหายไปครึ่งหนึ่งโดยไม่มีใครเข้าใจ)
--
-- subject = วิชาที่เป็นเหตุให้ทัก · เก็บไว้เพราะข้อความแรกยากที่สุดเสมอ
-- รู้ว่าคุยกันเรื่องเลข แอปก็ร่างประโยคแรกให้ได้ ไม่ต้องมานั่งคิดเองว่าจะเปิดยังไง
-- ============================================================
create table if not exists public.dm_threads (
  id         uuid primary key default gen_random_uuid(),
  a          uuid not null references auth.users(id) on delete cascade,
  b          uuid not null references auth.users(id) on delete cascade,
  subject    text,
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  constraint dm_pair_ordered check (a < b),
  constraint dm_pair_unique unique (a, b)
);

create index if not exists dm_threads_a_idx on public.dm_threads (a, last_at desc);
create index if not exists dm_threads_b_idx on public.dm_threads (b, last_at desc);

alter table public.dm_threads enable row level security;

drop policy if exists "own threads" on public.dm_threads;
create policy "own threads" on public.dm_threads
  for select to authenticated
  using (a = auth.uid() or b = auth.uid());

-- ห้ามสร้างห้องตรง ๆ จากฝั่งเบราว์เซอร์ — ต้องผ่าน open_dm() ข้างล่าง
-- ซึ่งเป็นที่เดียวที่บังคับกติกา "ต้องอยู่ห้องเดียวกัน และต้องไม่ถูกบล็อก"

create table if not exists public.dm_messages (
  id         bigint generated always as identity primary key,
  thread     uuid not null references public.dm_threads(id) on delete cascade,
  sender     uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_idx on public.dm_messages (thread, created_at);

alter table public.dm_messages enable row level security;

-- อ่านได้เฉพาะข้อความในห้องที่ตัวเองอยู่
drop policy if exists "read own dm" on public.dm_messages;
create policy "read own dm" on public.dm_messages
  for select to authenticated
  using (exists (
    select 1 from public.dm_threads t
     where t.id = thread and (t.a = auth.uid() or t.b = auth.uid())
  ));

-- ส่งได้เฉพาะในนามตัวเอง ในห้องที่ตัวเองอยู่ และคู่สนทนายังไม่ได้บล็อกกัน
drop policy if exists "send own dm" on public.dm_messages;
create policy "send own dm" on public.dm_messages
  for insert to authenticated
  with check (
    sender = auth.uid()
    and exists (
      select 1 from public.dm_threads t
       where t.id = thread
         and (t.a = auth.uid() or t.b = auth.uid())
         and not public.is_blocked(t.a, t.b)
    )
  );

-- แก้ข้อความย้อนหลังไม่ได้ · ลบได้เฉพาะของตัวเอง
drop policy if exists "delete own dm" on public.dm_messages;
create policy "delete own dm" on public.dm_messages
  for delete to authenticated
  using (sender = auth.uid());

-- ---------- เปิดห้องคุย ----------
-- ประตูเดียวที่สร้าง thread ได้ · กติกาทั้งหมดอยู่ในนี้ที่เดียว
-- ถ้ากระจายไปอยู่ใน policy หลายที่ วันที่แก้กติกาจะแก้ไม่ครบ
-- แล้วช่องที่ลืมแก้คือช่องที่คนทักหากันได้ทั้งที่ไม่ควรทักได้
create or replace function public.open_dm(p_other uuid, p_subject text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a  uuid;
  v_b  uuid;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'ต้องล็อกอินก่อน';
  end if;
  if p_other = v_me then
    raise exception 'ทักตัวเองไม่ได้';
  end if;
  -- ต้องเรียนห้องเดียวกัน — นี่คือเส้นที่กันคนแปลกหน้าออกไปทั้งหมด
  if not public.shares_room(p_other) then
    raise exception 'ทักได้เฉพาะคนที่อยู่ห้องเดียวกัน';
  end if;
  if public.is_blocked(v_me, p_other) then
    raise exception 'ทักคนนี้ไม่ได้';
  end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);

  insert into public.dm_threads (a, b, subject)
  values (v_a, v_b, p_subject)
  on conflict (a, b) do update set last_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.open_dm(uuid, text) from public, anon;
grant execute on function public.open_dm(uuid, text) to authenticated;

-- ---------- ดันเวลาล่าสุดของห้องทุกครั้งที่มีข้อความใหม่ ----------
-- ไม่ให้ฝั่งแอปเป็นคนเขียน เพราะถ้าแอปลืมเขียน (หรือเน็ตหลุดกลางทาง)
-- รายการแชทจะเรียงผิดโดยไม่มีอะไรบอก และไม่มีใครหาสาเหตุเจอ
create or replace function public.touch_dm_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_threads set last_at = new.created_at where id = new.thread;
  return new;
end;
$$;

drop trigger if exists dm_touch on public.dm_messages;
create trigger dm_touch after insert on public.dm_messages
  for each row execute function public.touch_dm_thread();

-- ---------- ให้ข้อความใหม่เด้งเข้าเครื่องเอง ----------
-- ไม่ใส่บรรทัดนี้ = ฝั่งแอป subscribe ได้โดยไม่ error แต่ไม่มีอะไรวิ่งมาสักครั้ง
-- ซึ่งอ่านเหมือน "เน็ตช้า" มากกว่า "ลืมเปิด" และหาสาเหตุยากมาก
-- RLS ยังคุมอยู่เหมือนเดิม: คนที่ไม่ได้อยู่ในห้องนั้นไม่ได้รับอะไรเลย
do $$
begin
  alter publication supabase_realtime add table public.dm_messages;
exception
  when duplicate_object then null;   -- เคยเพิ่มไปแล้ว ไม่ต้องทำอะไร
end $$;

-- ============================================================
-- 4 · หัวใจของทั้งชั้นนี้ — "ใครช่วยเธอได้"
-- ------------------------------------------------------------
-- คืนเพื่อนร่วมห้อง เรียงตามว่าเขาเก่งในวิชาที่เราจมกี่วิชา
-- ฝั่งแอปไม่ต้องดึงรายชื่อทั้งห้องมาแล้วมานั่งจับคู่เอง (ซึ่งแปลว่าต้องดาวน์โหลด
-- โปรไฟล์ทุกคนมาไว้ในเครื่องก่อน) — ถามคำถามเดียว ได้คำตอบที่เรียงมาแล้ว
--
-- match = วิชาที่ "เขารอด และเราจม" · คือเหตุผลที่จะยื่นให้ผู้ใช้อ่านตรง ๆ
-- give  = วิชาที่ "เรารอด และเขาจม" · คือเหตุผลที่เขาจะยินดีตอบกลับ
-- สองทางเสมอ ไม่ใช่การไปขอเขาอย่างเดียว
-- ============================================================
create or replace function public.study_matches(p_limit int default 20)
returns table (
  id           uuid,
  display_name text,
  avatar       text,
  bio          text,
  strong       text[],
  weak         text[],
  match        text[],
  give         text[]
)
language sql
stable
security definer
set search_path = public
as $$
  -- เขียนเป็น scalar subquery สองตัวแทนการ select จาก profiles ตรง ๆ โดยตั้งใจ:
  -- ถ้าเขียนแบบ "select strong, weak from profiles where id = auth.uid()" แล้วคนที่เพิ่ง
  -- ล็อกอินยังไม่มีแถวโปรไฟล์ CTE จะไม่มีแถวเลย · cross join กับของว่างได้ของว่าง
  -- ผลคือคนใหม่เปิดหน้ามาแล้วเห็นว่า "ไม่มีใครในห้อง" ทั้งที่ห้องมีคนอยู่ 30 คน
  -- แบบนี้การันตีว่าได้หนึ่งแถวเสมอ แค่ match/give ว่างจนกว่าจะกรอกวิชา
  with me as (
    select
      coalesce((select strong from public.profiles where id = auth.uid()), '{}'::text[]) as strong,
      coalesce((select weak   from public.profiles where id = auth.uid()), '{}'::text[]) as weak
  )
  select p.id, p.display_name, p.avatar, p.bio, p.strong, p.weak,
         array(select unnest(p.strong) intersect select unnest(me.weak))   as match,
         array(select unnest(me.strong) intersect select unnest(p.weak))   as give
    from public.profiles p, me
   where p.id <> auth.uid()
     and p.open_to_help
     and public.shares_room(p.id)
     and not public.is_blocked(auth.uid(), p.id)
   order by cardinality(array(select unnest(p.strong) intersect select unnest(me.weak))) desc,
            cardinality(array(select unnest(me.strong) intersect select unnest(p.weak))) desc,
            p.updated_at desc
   limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.study_matches(int) from public, anon;
grant execute on function public.study_matches(int) to authenticated;
