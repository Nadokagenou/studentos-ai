-- ============================================================
-- 15 · ห้องการบ้าน — ห้องที่เกิดจากงานหนึ่งชิ้น แล้วปิดตัวเองตอนถึงกำหนดส่ง
-- ------------------------------------------------------------
-- ชั้นสังคมที่ทำมาก่อนหน้านี้ (โปรไฟล์ · เพิ่มเพื่อน · ฟีด · แชท) มีรูปทรงเดียวกับ
-- ทุกแอปที่นักเรียนมีอยู่แล้ว จึงไม่มีเหตุผลให้ย้ายมา · ของที่แอปนี้มีอยู่คนเดียวคือ
-- "กำหนดส่ง" — เรารู้ว่างานชิ้นไหน ส่งกี่โมง และใครยังไม่เสร็จ ซึ่ง LINE ไม่มีวันรู้
--
-- ตารางชุดนี้จึงเปลี่ยนกำหนดส่งให้กลายเป็นห้อง และแก้ปัญหาที่ดีไซน์แก้ไม่ได้:
--   · ไม่ต้องมีเพื่อนก่อน — ขอแค่มีการบ้านชิ้นเดียวกัน ซึ่งทั้งห้องมีตั้งแต่วันแรก
--   · ไม่ต้องคิดว่าจะพิมพ์อะไร — หัวข้อถูกกำหนดมาแล้วว่า "ข้อ 9"
--   · ไม่มีใครต้องยอมรับว่าตัวเองไม่เข้าใจ — เข้าห้องนี้แปลว่ายังไม่เสร็จเหมือนกันทุกคน
--   · ห้องตายเองตามกำหนด — แอปแบบนี้ตายเพราะกลุ่มแชทร้างค้างเต็มจอ ไม่ใช่เพราะฟีเจอร์น้อย
--
-- กุญแจของห้อง = ห้องเรียน + วิชา + วันที่ส่ง (ไม่รวมชื่องาน)
-- ชื่องานที่แต่ละคนพิมพ์เองไม่มีวันตรงกัน ("ใบงานตรีโกณ" / "การบ้านเลข ข้อ 1-12")
-- ถ้าเอาชื่อมาเป็นกุญแจ ห้องเดียวจะแตกเป็นห้าห้องที่มีคนละคน ซึ่งแย่กว่าไม่มีห้องเลย
-- ในห้องเรียนหนึ่ง วันหนึ่ง วิชาหนึ่ง แทบไม่เคยมีงานส่งเกินหนึ่งชิ้น — กุญแจนี้จึงหยาบพอดี
--
-- เส้นความเป็นส่วนตัว: สิ่งที่ออกจากเครื่องคือ "ฉันมีงานวิชานี้ ส่งวันนี้ ยังไม่เสร็จ"
-- เท่านั้น · ไม่ใช่เนื้องาน ไม่ใช่คะแนน ไม่ใช่รายการงานทั้งหมด · และเห็นได้เฉพาะคน
-- ที่อยู่ห้องเรียนเดียวกันเท่านั้น (ฝั่งแอปยังกั้นอีกชั้นด้วยการถามก่อนใช้ครั้งแรก)
-- ============================================================

-- ---------- ห้อง ----------
create table if not exists public.hw_rooms (
  key        text primary key,          -- md5(room_id | วิชา | วันที่ส่ง) — ดูหมายเหตุหัวไฟล์
  room_id    text not null,             -- ห้องเรียนจาก line_links
  subject    text not null,
  due        date not null,
  title      text not null default '',  -- ชื่อที่คนแรกที่เปิดห้องพิมพ์ไว้ · ใช้โชว์อย่างเดียว
  created_at timestamptz not null default now()
);

-- ---------- ใครมีงานชิ้นนี้อยู่ในมือ ----------
-- นี่คือแถวที่ทำให้ตัวเลข "อีก 4 คนยังไม่เสร็จ" เป็นของจริง ไม่ใช่ของประดับ
create table if not exists public.hw_members (
  key       text not null references public.hw_rooms(key) on delete cascade,
  member    uuid not null references auth.users(id) on delete cascade,
  done      boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (key, member)
);
create index if not exists hw_members_member_idx on public.hw_members (member);

-- ---------- สิ่งที่พูดกันในห้อง ----------
create table if not exists public.hw_msgs (
  id         bigint generated always as identity primary key,
  key        text not null references public.hw_rooms(key) on delete cascade,
  author     uuid references auth.users(id) on delete cascade,   -- null = น้องไซ
  body       text not null check (length(body) between 1 and 1000),
  is_ai      boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists hw_msgs_key_idx on public.hw_msgs (key, created_at);

alter table public.hw_rooms   enable row level security;
alter table public.hw_members enable row level security;
alter table public.hw_msgs    enable row level security;

-- ---------- อยู่ในห้องการบ้านนี้ไหม ----------
-- security definer เพราะต้องอ่าน hw_members ข้ามแถวของคนอื่น ซึ่ง RLS ข้างล่างปิดไว้
create or replace function public.hw_mine(p_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hw_members
    where key = p_key and member = auth.uid()
  );
$$;

-- อ่านได้เฉพาะห้องที่ตัวเองอยู่ · เขียนทุกอย่างผ่านฟังก์ชันข้างล่างเท่านั้น
-- (ไม่มี policy สำหรับ insert/update/delete = ฝั่งเบราว์เซอร์เขียนตรงไม่ได้เลย
--  ซึ่งเป็นที่เดียวที่บังคับกติกา "ต้องอยู่ห้องเรียนเดียวกัน" กับ "หมดเวลาแล้วพิมพ์ไม่ได้")
drop policy if exists "read my hw rooms" on public.hw_rooms;
create policy "read my hw rooms" on public.hw_rooms
  for select to authenticated using (public.hw_mine(key));

drop policy if exists "read my hw members" on public.hw_members;
create policy "read my hw members" on public.hw_members
  for select to authenticated using (public.hw_mine(key));

drop policy if exists "read my hw msgs" on public.hw_msgs;
create policy "read my hw msgs" on public.hw_msgs
  for select to authenticated using (public.hw_mine(key));

-- ============================================================
-- 1 · ลงชื่อว่ามีงานชิ้นไหนบ้าง แล้วรับตัวเลขกลับไปในรอบเดียว
-- ------------------------------------------------------------
-- ฝั่งแอปส่งงานของตัวเองขึ้นมาเป็นก้อน [{subject, due, title, done}]
-- เซิร์ฟเวอร์สร้างห้องที่ยังไม่มี ลงชื่อเจ้าตัว แล้วคืนจำนวน "คนอื่นที่ยังไม่เสร็จ"
--
-- ทำเป็นคำสั่งเดียวเพราะหน้าแรกมีงานพร้อมกันได้สิบใบ · ยิงทีละใบ = สิบรอบเน็ตทุกครั้ง
-- ที่วาดจอใหม่ ซึ่งบนมือถือแปลว่าตัวเลขโผล่ไม่พร้อมกันและกระพริบทีละบรรทัด
--
-- งานที่ไม่มีวิชาหรือไม่มีกำหนดส่งถูกข้ามเงียบ ๆ — จับคู่กับใครไม่ได้อยู่แล้ว
create or replace function public.hw_sync(p_tasks jsonb)
-- ชื่อคอลัมน์ที่คืนออกไปขึ้นต้นด้วย r_ ทุกตัวโดยตั้งใจ — ใน plpgsql ชื่อ OUT ที่ตรงกับ
-- ชื่อคอลัมน์จริง (key/subject/due) จะไปชนกันในประโยคอย่าง on conflict (key)
-- ซึ่งเป็นบั๊กที่อ่านไม่ออกจากข้อความ error เลยว่ามาจากตรงไหน
returns table (r_key text, r_subject text, r_due date, r_others integer, r_talking integer)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_room text;
  v_me   uuid := auth.uid();
  r      jsonb;
  v_key  text;
  v_subj text;
  v_due  date;
begin
  if v_me is null then return; end if;

  -- ห้องเรียนแรกที่ผูกไว้ · ยังไม่ได้ผูกห้อง = ยังไม่มีใครให้จับคู่ด้วย จบตรงนี้
  select l.room_id into v_room from public.line_links l
   where l.user_id = v_me order by l.created_at limit 1;
  if v_room is null then return; end if;

  for r in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) loop
    v_subj := nullif(btrim(coalesce(r->>'subject', '')), '');
    begin
      v_due := (r->>'due')::date;
    exception when others then v_due := null;
    end;

    -- ข้ามงานที่จับคู่ไม่ได้ · และงานที่เลยกำหนดมาแล้ว — ห้องที่เกิดมาตายแล้วไม่มีประโยชน์
    if v_subj is null or v_due is null or v_subj = 'อื่น ๆ' or v_due < current_date then
      continue;
    end if;

    v_key := md5(v_room || '|' || lower(v_subj) || '|' || v_due::text);

    insert into public.hw_rooms (key, room_id, subject, due, title)
    values (v_key, v_room, v_subj, v_due, coalesce(btrim(r->>'title'), ''))
    on conflict (key) do update
      -- ชื่อว่างอยู่แล้วค่อยเติม — คนที่เปิดทีหลังไม่ควรทับชื่อที่คนแรกตั้งไว้
      -- อ้างถึงตารางเป้าหมายด้วยชื่อเปล่า ไม่ใช่ public.hw_rooms — ใน on conflict do update
      -- Postgres รู้จักเฉพาะชื่อที่เขียนไว้ใน insert into เท่านั้น ใส่สคีมานำหน้าแล้วพัง
      set title = case when hw_rooms.title = '' then excluded.title
                       else hw_rooms.title end;

    insert into public.hw_members (key, member, done)
    values (v_key, v_me, coalesce((r->>'done')::boolean, false))
    on conflict (key, member) do update set done = excluded.done;
  end loop;

  return query
    select m.key, h.subject, h.due,
           (select count(*)::integer from public.hw_members o
             where o.key = m.key and o.member <> v_me and not o.done),
           (select count(distinct s.author)::integer from public.hw_msgs s
             where s.key = m.key and s.author is not null and s.author <> v_me)
      from public.hw_members m
      join public.hw_rooms h on h.key = m.key
     where m.member = v_me and h.due >= current_date;
end;
$$;

-- ============================================================
-- 2 · เปิดห้อง
-- ------------------------------------------------------------
-- คืนหัวห้อง + รายชื่อคนที่ยังไม่เสร็จ (ชื่อกับรูปเท่านั้น) + ข้อความล่าสุด
-- ไม่คืนว่าใครเสร็จไปแล้วบ้าง — ห้องนี้มีไว้ให้คนที่ยังทำอยู่ ไม่ใช่กระดานประกาศว่าใครช้า
create or replace function public.hw_open(p_key text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.hw_mine(p_key) then null else jsonb_build_object(
    'key',     h.key,
    'subject', h.subject,
    'due',     h.due,
    'title',   h.title,
    'closed',  h.due < current_date,
    'people',  coalesce((
       select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'avatar', p.avatar))
         from public.hw_members m join public.profiles p on p.id = m.member
        where m.key = h.key and not m.done and m.member <> auth.uid()), '[]'::jsonb),
    'msgs',    coalesce((
       select jsonb_agg(t.x order by t.at)
         from (select jsonb_build_object(
                 'id', s.id, 'author', s.author, 'ai', s.is_ai, 'body', s.body,
                 'at', s.created_at,
                 'name', coalesce(p.display_name, 'น้องไซ'),
                 'avatar', p.avatar) as x,
                 s.created_at as at
                 from public.hw_msgs s
                 left join public.profiles p on p.id = s.author
                where s.key = h.key order by s.created_at desc limit 200) t), '[]'::jsonb)
  ) end
  from public.hw_rooms h where h.key = p_key;
$$;

-- ============================================================
-- 3 · พูดในห้อง
-- ------------------------------------------------------------
-- ห้ามพิมพ์หลังหมดกำหนด — นี่คือที่เดียวที่บังคับ "ห้องปิดตัวเอง" ให้เป็นจริง
-- ถ้าปล่อยให้พิมพ์ต่อได้ มันจะกลายเป็นกลุ่มแชทถาวรอีกกลุ่มภายในสัปดาห์เดียว
-- ซึ่งเป็นสิ่งเดียวที่ฟีเจอร์นี้ตั้งใจไม่ให้เกิด
create or replace function public.hw_say(p_key text, p_body text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_due date; v_id bigint; v_at timestamptz;
begin
  if not public.hw_mine(p_key) then
    raise exception 'ไม่ได้อยู่ในห้องนี้';
  end if;
  select due into v_due from public.hw_rooms where key = p_key;
  if v_due < current_date then
    raise exception 'ห้องนี้ปิดแล้ว — งานชิ้นนี้เลยกำหนดส่งไปแล้ว';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'ข้อความว่าง';
  end if;
  insert into public.hw_msgs (key, author, body)
  values (p_key, auth.uid(), left(btrim(p_body), 1000))
  returning id, created_at into v_id, v_at;
  return jsonb_build_object('id', v_id, 'at', v_at);
end;
$$;

-- ---------- ติ๊กว่าเสร็จแล้ว ----------
-- เสร็จแล้วหลุดออกจากตัวนับ แต่ยังอยู่ในห้อง — คนที่เพิ่งทำเสร็จคือคนที่ตอบได้ดีที่สุด
create or replace function public.hw_done(p_key text, p_done boolean)
returns void
language sql volatile security definer set search_path = public as $$
  update public.hw_members set done = coalesce(p_done, true)
   where key = p_key and member = auth.uid();
$$;

-- ---------- ออกจากห้องทั้งหมด ----------
-- ปิดสวิตช์ในหน้าตั้งค่าแล้วต้องลบร่องรอยที่ส่งขึ้นมาจริง ๆ ไม่ใช่แค่ซ่อนหน้าจอ
create or replace function public.hw_leave_all()
returns void
language sql volatile security definer set search_path = public as $$
  delete from public.hw_members where member = auth.uid();
$$;

grant execute on function public.hw_sync(jsonb)         to authenticated;
grant execute on function public.hw_open(text)          to authenticated;
grant execute on function public.hw_say(text, text)     to authenticated;
grant execute on function public.hw_done(text, boolean) to authenticated;
grant execute on function public.hw_leave_all()         to authenticated;

-- ---------- เก็บกวาด ----------
-- ห้องที่เลยกำหนดมา 7 วันไม่มีใครเปิดอีกแล้ว · ลบห้องแล้วสมาชิกกับข้อความหายตาม (cascade)
create or replace function public.cleanup_hw() returns void
language sql volatile security definer set search_path = public as $$
  delete from public.hw_rooms where due < current_date - 7;
$$;
