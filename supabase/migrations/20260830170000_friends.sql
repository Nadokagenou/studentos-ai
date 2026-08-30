-- ============================================================
-- 13 · เพิ่มเพื่อน
-- ------------------------------------------------------------
-- ที่ผ่านมาแอปมี "เพื่อนร่วมห้อง" (ใครก็ตามที่อยู่ห้องเดียวกัน) แต่ไม่มี "เพื่อน"
-- สองอย่างนี้ไม่เหมือนกัน และการไม่มีอย่างหลังทำให้แอปอ่านแปลก ๆ:
-- เห็นคนทั้งห้อง ทักได้ทุกคน แต่ไม่มีใครเป็นใครของใครเลย ไม่มีความสัมพันธ์สักเส้น
--
-- คู่เก็บเรียง a < b เสมอ — คู่เดิมได้แถวเดิมทุกครั้ง ไม่มีทางเกิดสองแถวสวนทางกัน
-- (ถ้าเก็บเป็น from/to ตรง ๆ จะเกิดกรณี A ขอ B พร้อมกับ B ขอ A แล้วค้างทั้งคู่)
-- asked_by บอกว่าใครเป็นฝ่ายขอ ซึ่งเป็นตัวแยกว่า "รอเขาตอบ" กับ "รอเราตอบ"
-- ============================================================

create table if not exists public.friendships (
  a           uuid not null references auth.users(id) on delete cascade,
  b           uuid not null references auth.users(id) on delete cascade,
  asked_by    uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (a, b),
  constraint friend_pair_ordered check (a < b)
);

create index if not exists friendships_b_idx on public.friendships (b, status);

alter table public.friendships enable row level security;

-- เห็นได้เฉพาะเส้นที่ตัวเองอยู่ในนั้น
drop policy if exists "own friendships" on public.friendships;
create policy "own friendships" on public.friendships
  for select to authenticated
  using (a = auth.uid() or b = auth.uid());

-- ห้ามเขียนตรงจากเบราว์เซอร์ — ต้องผ่านฟังก์ชันข้างล่าง
-- ซึ่งเป็นที่เดียวที่บังคับกติกา "ต้องอยู่ห้องเดียวกัน" กับ "ตอบรับได้เฉพาะฝ่ายที่ถูกขอ"
drop policy if exists "drop own friendships" on public.friendships;
create policy "drop own friendships" on public.friendships
  for delete to authenticated
  using (a = auth.uid() or b = auth.uid());

-- ---------- สถานะระหว่างเรากับเขา ----------
-- คืนคำเดียวที่ฝั่งแอปเอาไปตัดสินหน้าตาปุ่มได้เลย ไม่ต้องคิดเองสี่กรณี
--   none     ยังไม่มีอะไรกัน            → ปุ่ม "เพิ่มเพื่อน"
--   sent     เราขอไปแล้ว รอเขาตอบ       → ปุ่ม "ส่งคำขอแล้ว" (กดยกเลิกได้)
--   incoming เขาขอมา รอเราตอบ           → ปุ่ม "ตอบรับ"
--   friends  เป็นเพื่อนกันแล้ว          → ปุ่ม "เพื่อนกันแล้ว"
create or replace function public.friend_state(p_other uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when f.status = 'accepted' then 'friends'
      when f.asked_by = auth.uid() then 'sent'
      else 'incoming'
    end
    from public.friendships f
    where f.a = least(auth.uid(), p_other)
      and f.b = greatest(auth.uid(), p_other)
  ), 'none');
$$;

revoke all on function public.friend_state(uuid) from public, anon;
grant execute on function public.friend_state(uuid) to authenticated;

-- ---------- ขอเป็นเพื่อน ----------
-- ถ้าอีกฝ่ายขอมาก่อนแล้ว การกด "เพิ่มเพื่อน" ของเราคือการตอบรับ ไม่ใช่ขอซ้ำ
-- (คนไม่ได้แยกสองอย่างนี้ในหัว เขาแค่กดปุ่มที่แปลว่า "เอาด้วย")
create or replace function public.ask_friend(p_other uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid; v_b uuid;
  v_row public.friendships%rowtype;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if p_other = v_me then raise exception 'เพิ่มตัวเองไม่ได้'; end if;
  if not public.shares_room(p_other) then
    raise exception 'เพิ่มได้เฉพาะคนที่อยู่ห้องเดียวกัน';
  end if;
  if public.is_blocked(v_me, p_other) then raise exception 'เพิ่มคนนี้ไม่ได้'; end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);

  select * into v_row from public.friendships where a = v_a and b = v_b;

  if v_row.a is null then
    insert into public.friendships (a, b, asked_by) values (v_a, v_b, v_me);
    return 'sent';
  end if;

  if v_row.status = 'accepted' then return 'friends'; end if;

  -- มีคำขอค้างอยู่แล้ว: ถ้าเป็นของอีกฝ่าย = ตอบรับ · ถ้าของเราเอง = ยังรออยู่เหมือนเดิม
  if v_row.asked_by <> v_me then
    update public.friendships set status = 'accepted', accepted_at = now()
     where a = v_a and b = v_b;
    return 'friends';
  end if;
  return 'sent';
end;
$$;

revoke all on function public.ask_friend(uuid) from public, anon;
grant execute on function public.ask_friend(uuid) to authenticated;

-- ---------- ยกเลิก / ปฏิเสธ / เลิกเป็นเพื่อน ----------
-- สามอย่างนี้เป็นการกระทำเดียวกันในฐานข้อมูล (ลบแถวทิ้ง) ต่างกันแค่คำที่ผู้ใช้เห็น
create or replace function public.drop_friend(p_other uuid)
returns text
language sql
security definer
set search_path = public
as $$
  delete from public.friendships
   where a = least(auth.uid(), p_other)
     and b = greatest(auth.uid(), p_other)
     and (a = auth.uid() or b = auth.uid());
  select 'none'::text;
$$;

revoke all on function public.drop_friend(uuid) from public, anon;
grant execute on function public.drop_friend(uuid) to authenticated;

-- ---------- คำขอที่รอเราตอบ ----------
create or replace function public.friend_inbox()
returns table (
  id           uuid,
  display_name text,
  avatar       text,
  bio          text,
  strong       text[],
  asked_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar, p.bio, p.strong, f.created_at
    from public.friendships f
    join public.profiles p
      on p.id = case when f.a = auth.uid() then f.b else f.a end
   where (f.a = auth.uid() or f.b = auth.uid())
     and f.status = 'pending'
     and f.asked_by <> auth.uid()
   order by f.created_at desc
   limit 50;
$$;

revoke all on function public.friend_inbox() from public, anon;
grant execute on function public.friend_inbox() to authenticated;

-- ---------- รายชื่อเพื่อน ----------
create or replace function public.friend_list()
returns table (
  id           uuid,
  display_name text,
  avatar       text,
  bio          text,
  strong       text[],
  weak         text[],
  since        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar, p.bio, p.strong, p.weak, f.accepted_at
    from public.friendships f
    join public.profiles p
      on p.id = case when f.a = auth.uid() then f.b else f.a end
   where (f.a = auth.uid() or f.b = auth.uid())
     and f.status = 'accepted'
   order by f.accepted_at desc nulls last
   limit 200;
$$;

revoke all on function public.friend_list() from public, anon;
grant execute on function public.friend_list() to authenticated;
