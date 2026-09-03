-- ============================================================
-- 17 · ชื่อผู้ใช้ + ค้นหาคน — ทางเข้าเดียวของ "เพิ่มเพื่อน"
-- ------------------------------------------------------------
-- ปัญหาที่ไฟล์นี้แก้ มีสองชั้นซ้อนกัน:
--
-- ชั้นที่ 1 — ask_friend() เดิมบังคับ shares_room() ซึ่งอ่านจาก line_links
--   แปลว่า "เพิ่มเพื่อนไม่ได้เลย ถ้ายังไม่มีใครเอาบอท LINE เข้ากลุ่มห้องเรียน"
--   ด่านนั้นหนักเกินไปสำหรับนักเรียนคนเดียวที่เพิ่งโหลดแอปมา และที่แย่กว่าคือ
--   เขาจะไม่มีทางรู้ว่าตัวเองติดอยู่ตรงไหน — ปุ่มมันไม่ขึ้นมาให้กดตั้งแต่แรก
--
-- ชั้นที่ 2 — ฝั่งแอปมี "รหัสเพื่อน" อยู่แล้ว แต่มันเป็นภาพนิ่ง base64 ที่ก๊อปวางกันเอง
--   เก็บลงเครื่องตัวเอง ไม่เคยแตะเซิร์ฟเวอร์ จึงไม่อัปเดตอีกเลยหลังวางครั้งแรก
--   (ถูกถอดออกในคอมมิตเดียวกับไฟล์นี้)
--
-- ทางแก้: ให้ทุกคนมี "ชื่อผู้ใช้" ที่พิมพ์หากันได้ตรง ๆ — ไม่ใช่รหัสสุ่มที่ต้องก๊อป
-- เพราะรหัสสุ่มแปลว่าต้องมีช่องทางส่งรหัสอยู่ก่อนแล้ว ซึ่งถ้ามีช่องทางนั้นก็คุยกันได้อยู่แล้ว
--
-- เส้นความปลอดภัยที่ยังอยู่เหมือนเดิม:
--   · ค้นเจอ ≠ เป็นเพื่อน — ยังต้องกดรับก่อนเสมอ (friendships.status = 'pending')
--   · blocks ยังถูกเคารพทั้งสองทาง ทั้งตอนค้นและตอนขอ
--   · ปิดตัวเองจากการค้นหาได้ด้วย open_to_help = false ที่มีอยู่แล้ว
-- ============================================================

-- ---------- ชื่อผู้ใช้ ----------
alter table public.profiles add column if not exists handle text;

-- unique แบบไม่สนตัวพิมพ์ — "Beam" กับ "beam" ต้องเป็นคนเดียวกัน ไม่ใช่สองบัญชี
create unique index if not exists profiles_handle_key
  on public.profiles (lower(handle)) where handle is not null;

-- ---------- ตรวจรูปแบบ ----------
-- อนุญาตไทยด้วยโดยตั้งใจ — กลุ่มผู้ใช้เป็นนักเรียนไทย การบังคับให้ตั้งชื่อเป็นอังกฤษ
-- คือด่านเล็ก ๆ อีกด่านที่ไม่มีเหตุผลรองรับ · ภาษาไทยไม่มีตัวพิมพ์ใหญ่เล็ก จึงไม่ชนกับ lower()
-- ห้ามเว้นวรรคและอักขระพิเศษ เพราะชื่อนี้ต้องพิมพ์ตามกันได้โดยไม่ต้องเดาว่ามีช่องว่างกี่ช่อง
create or replace function public.handle_ok(p text)
returns boolean
language sql immutable as $fn$
  select p ~ '^[a-z0-9ก-๙_]{3,15}$';
$fn$;

-- ---------- ตั้ง / เปลี่ยนชื่อผู้ใช้ ----------
-- คืนชื่อที่ตั้งสำเร็จกลับไป · ชนกับคนอื่นแล้ว raise ให้ฝั่งแอปเอาไปโชว์ตรง ๆ
create or replace function public.set_handle(p_handle text)
returns text
language plpgsql volatile security definer set search_path = public as $fn$
declare v_me uuid := auth.uid(); v_h text;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  v_h := lower(btrim(coalesce(p_handle, '')));
  v_h := regexp_replace(v_h, '^@', '');          -- คนพิมพ์ @ นำหน้าติดมาเป็นเรื่องปกติ
  if not public.handle_ok(v_h) then
    raise exception 'ชื่อผู้ใช้ต้องยาว 3-15 ตัว ใช้ได้เฉพาะ ก-๙ a-z 0-9 และ _';
  end if;
  if exists (select 1 from public.profiles
              where lower(handle) = v_h and id <> v_me) then
    raise exception 'ชื่อนี้มีคนใช้แล้ว';
  end if;
  -- โปรไฟล์อาจยังไม่ถูกสร้าง ถ้าผู้ใช้ยังไม่เคยกด "เผยแพร่โปรไฟล์"
  insert into public.profiles (id, handle) values (v_me, v_h)
    on conflict (id) do update set handle = v_h, updated_at = now();
  return v_h;
end;
$fn$;

-- ---------- ชื่อผู้ใช้ของฉัน (สร้างให้อัตโนมัติถ้ายังไม่มี) ----------
-- ไม่บังคับให้ตั้งเองก่อนใช้งาน — หน้าจอที่เปิดมาแล้วเจอฟอร์มบังคับกรอกคือหน้าจอที่คนกดออก
-- ตั้งให้เป็นตัวเลขไว้ก่อน แล้วเปลี่ยนเป็นชื่อที่ชอบทีหลังได้
create or replace function public.my_handle()
returns text
language plpgsql volatile security definer set search_path = public as $fn$
declare v_me uuid := auth.uid(); v_h text; v_try text; i int := 0;
begin
  if v_me is null then return null; end if;
  select handle into v_h from public.profiles where id = v_me;
  if v_h is not null then return v_h; end if;

  -- ลองสูงสุด 20 ครั้ง · โอกาสชนกันของเลข 7 หลักน้อยมาก แต่ลูปที่ไม่มีทางออกแย่กว่าเสมอ
  loop
    i := i + 1;
    v_try := 'sos' || lpad((floor(random() * 10000000))::bigint::text, 7, '0');
    exit when not exists (select 1 from public.profiles where lower(handle) = v_try);
    if i > 20 then return null; end if;
  end loop;

  insert into public.profiles (id, handle) values (v_me, v_try)
    on conflict (id) do update set handle = coalesce(profiles.handle, v_try);
  select handle into v_h from public.profiles where id = v_me;
  return v_h;
end;
$fn$;

-- ============================================================
-- ค้นหาคน
-- ------------------------------------------------------------
-- ตรงกับชื่อผู้ใช้แบบขึ้นต้น หรือชื่อที่แสดงแบบมีคำนั้นอยู่ข้างใน
-- ต้องพิมพ์อย่างน้อย 2 ตัวถึงจะค้น — ตัวเดียวคือการไล่ดูรายชื่อทั้งระบบ ไม่ใช่การค้นหา
-- คืนสถานะความเป็นเพื่อนมาด้วยในรอบเดียว เพื่อให้ปุ่มบนแถวผลลัพธ์ถูกตั้งแต่วาดครั้งแรก
-- (ไม่งั้นต้องยิงถามทีละแถว แล้วปุ่มจะกระพริบจาก "เพิ่ม" เป็น "เพื่อนแล้ว" ทีหลัง)
create or replace function public.find_people(p_q text)
returns table (id uuid, display_name text, handle text, avatar text, rel text)
language sql stable security definer set search_path = public as $fn$
  with q as (
    select lower(regexp_replace(btrim(coalesce(p_q, '')), '^@', '')) as t
  )
  select p.id, p.display_name, p.handle, p.avatar,
         case
           when f.status = 'accepted' then 'friends'
           when f.status = 'pending' and f.asked_by = auth.uid() then 'sent'
           when f.status = 'pending' then 'incoming'
           else 'none'
         end as rel
    from public.profiles p
    cross join q
    left join public.friendships f
      on f.a = least(auth.uid(), p.id) and f.b = greatest(auth.uid(), p.id)
   where auth.uid() is not null
     and length(q.t) >= 2
     and p.id <> auth.uid()
     and p.open_to_help
     and (lower(p.handle) like q.t || '%' or lower(p.display_name) like '%' || q.t || '%')
     and not public.is_blocked(auth.uid(), p.id)
   -- ตรงกับชื่อผู้ใช้เป๊ะขึ้นก่อนเสมอ · คนที่พิมพ์ชื่อเต็มมาคือคนที่รู้อยู่แล้วว่าจะหาใคร
   order by (lower(p.handle) = q.t) desc, (lower(p.handle) like q.t || '%') desc,
            p.display_name
   limit 12;
$fn$;

-- ============================================================
-- ปลดล็อก ask_friend
-- ------------------------------------------------------------
-- เงื่อนไข "ต้องอยู่ห้องเดียวกัน" ถูกถอดออก · shares_room() ยังอยู่และยังถูกใช้ที่อื่น
-- (หน้าเพื่อนร่วมห้อง · study_matches) แค่ไม่ใช่ประตูของการเพิ่มเพื่อนอีกต่อไป
--
-- สิ่งที่กันคนแปลกหน้าไม่ใช่การห้ามส่งคำขอ แต่คือการที่ปลายทางต้องกดรับ —
-- คำขอที่ไม่มีใครกดรับก็เป็นแค่แถวหนึ่งแถวที่ไม่ทำให้ใครเห็นอะไรของอีกฝ่ายเลย
create or replace function public.ask_friend(p_other uuid)
returns text
language plpgsql security definer set search_path = public as $fn$
declare
  v_me uuid := auth.uid();
  v_a uuid; v_b uuid;
  v_row public.friendships%rowtype;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if p_other = v_me then raise exception 'เพิ่มตัวเองไม่ได้'; end if;
  if public.is_blocked(v_me, p_other) then raise exception 'เพิ่มคนนี้ไม่ได้'; end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);
  select * into v_row from public.friendships where a = v_a and b = v_b;

  if v_row.a is null then
    insert into public.friendships (a, b, asked_by) values (v_a, v_b, v_me);
    return 'sent';
  end if;
  if v_row.status = 'accepted' then return 'friends'; end if;
  -- มีคำขอค้างอยู่: ถ้าเป็นของอีกฝ่าย = การกดของเราคือ "ตอบรับ" ไม่ใช่ขอซ้ำ
  if v_row.asked_by <> v_me then
    update public.friendships set status = 'accepted', accepted_at = now()
     where a = v_a and b = v_b;
    return 'friends';
  end if;
  return 'sent';
end;
$fn$;

-- ============================================================
-- เติม handle ลงในรายชื่อเพื่อน / คำขอ
-- ------------------------------------------------------------
-- ต้อง drop ก่อน — create or replace เปลี่ยนชุดคอลัมน์ที่คืนออกไปไม่ได้
-- (ชื่อซ้ำกันเยอะมากในโรงเรียนเดียว "บีม" สามคนในหน้าเดียวคือเรื่องปกติ
--  ชื่อผู้ใช้จึงต้องโชว์คู่กันเสมอ ไม่ใช่ซ่อนไว้ในหน้าโปรไฟล์)
drop function if exists public.friend_list();
create or replace function public.friend_list()
returns table (id uuid, display_name text, handle text, avatar text,
               bio text, strong text[], weak text[], since timestamptz)
language sql stable security definer set search_path = public as $fn$
  select p.id, p.display_name, p.handle, p.avatar, p.bio, p.strong, p.weak, f.accepted_at
    from public.friendships f
    join public.profiles p
      on p.id = case when f.a = auth.uid() then f.b else f.a end
   where (f.a = auth.uid() or f.b = auth.uid())
     and f.status = 'accepted'
   order by f.accepted_at desc nulls last
   limit 200;
$fn$;

drop function if exists public.friend_inbox();
create or replace function public.friend_inbox()
returns table (id uuid, display_name text, handle text, avatar text,
               bio text, strong text[], asked_at timestamptz)
language sql stable security definer set search_path = public as $fn$
  select p.id, p.display_name, p.handle, p.avatar, p.bio, p.strong, f.created_at
    from public.friendships f
    join public.profiles p
      on p.id = case when f.a = auth.uid() then f.b else f.a end
   where (f.a = auth.uid() or f.b = auth.uid())
     and f.status = 'pending'
     and f.asked_by <> auth.uid()
   order by f.created_at desc
   limit 50;
$fn$;

-- ---------- สิทธิ์ ----------
revoke all on function public.set_handle(text)  from public, anon;
revoke all on function public.my_handle()       from public, anon;
revoke all on function public.find_people(text) from public, anon;
revoke all on function public.ask_friend(uuid)  from public, anon;
revoke all on function public.friend_list()     from public, anon;
revoke all on function public.friend_inbox()    from public, anon;

grant execute on function public.set_handle(text)  to authenticated;
grant execute on function public.my_handle()       to authenticated;
grant execute on function public.find_people(text) to authenticated;
grant execute on function public.ask_friend(uuid)  to authenticated;
grant execute on function public.friend_list()     to authenticated;
grant execute on function public.friend_inbox()    to authenticated;
