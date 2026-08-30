-- ============================================================
-- 12 · หน้าของคนคนหนึ่ง
-- ------------------------------------------------------------
-- ฟีดมีโพสต์ แต่ไม่มี "คน" — แตะที่รูปใครแล้วไม่มีอะไรเกิดขึ้น
-- ซึ่งเป็นสิ่งที่คนเปิด IG มาทำครึ่งหนึ่งของเวลาทั้งหมด คือไปส่องคน ไม่ใช่อ่านฟีด
-- และเป็นคำขอตั้งต้นของทั้งฟีเจอร์นี้: "นักเรียนต้องการพื้นที่แสดงตัวตน"
--
-- หน้านี้จึงเป็นที่ที่ทุกอย่างมารวมกัน: เขาเป็นใคร · เก่งอะไร · จมอะไร ·
-- ตอนนี้กำลังทำอะไรอยู่ · เคยโพสต์อะไรไว้ · และปุ่มทักหาเขา
-- ============================================================

-- ---------- การ์ดของคนคนหนึ่ง ----------
-- คืนได้เฉพาะคนที่อยู่ห้องเดียวกัน (หรือตัวเอง) — กติกาเดียวกับ profiles
-- นับโพสต์เฉพาะที่ "เราเห็นได้" ไม่ใช่ทั้งหมดที่เขาเคยโพสต์
-- ไม่งั้นตัวเลขจะฟ้องว่าเขาโพสต์ในห้องอื่นกี่ใบ ซึ่งเราไม่ควรรู้
create or replace function public.user_card(p_user uuid)
returns table (
  id           uuid,
  display_name text,
  avatar       text,
  bio          text,
  strong       text[],
  weak         text[],
  mine         boolean,
  post_count   integer,
  match        text[],     -- เขาเก่ง และเราจม
  give         text[]      -- เราเก่ง และเขาจม
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      coalesce((select strong from public.profiles where id = auth.uid()), '{}'::text[]) as strong,
      coalesce((select weak   from public.profiles where id = auth.uid()), '{}'::text[]) as weak
  )
  select p.id, p.display_name, p.avatar, p.bio, p.strong, p.weak,
         p.id = auth.uid(),
         (select count(*)::int from public.posts o
           where o.author = p.id and not o.anon
             and (o.author = auth.uid()
                  or public.can_see_post(o.scope, o.room_id, o.school))),
         array(select unnest(p.strong) intersect select unnest(me.weak)),
         array(select unnest(me.strong) intersect select unnest(p.weak))
    from public.profiles p, me
   where p.id = p_user
     and (p.id = auth.uid() or public.shares_room(p.id));
$$;

revoke all on function public.user_card(uuid) from public, anon;
grant execute on function public.user_card(uuid) to authenticated;

-- ---------- โพสต์ของคนคนหนึ่ง ----------
-- โพสต์ที่เขาเลือก "ไม่ระบุชื่อ" ไม่โผล่บนหน้าของเขา แม้แต่ใบที่เราเห็นในฟีด
-- ไม่งั้นการไม่ระบุชื่อจะไร้ความหมายทันที — ใครก็ไล่เทียบเวลาแล้วรู้ว่าใครถาม
-- ยกเว้นเจ้าของหน้าเองที่เข้ามาดูหน้าตัวเอง ซึ่งต้องเห็นของตัวเองครบ
create or replace function public.user_posts(p_user uuid, p_limit int default 20)
returns table (
  id          uuid,
  scope       text,
  kind        text,
  subject     text,
  body        text,
  image       text,
  anon        boolean,
  created_at  timestamptz,
  reply_count integer,
  mine        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.scope, p.kind, p.subject, p.body, p.image, p.anon,
         p.created_at, p.reply_count, p.author = auth.uid()
    from public.posts p
   where p.author = p_user
     and (p.author = auth.uid() or not p.anon)
     and (p.author = auth.uid() or public.can_see_post(p.scope, p.room_id, p.school))
     and (p_user = auth.uid() or public.shares_room(p_user))
   order by p.created_at desc
   limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.user_posts(uuid, int) from public, anon;
grant execute on function public.user_posts(uuid, int) to authenticated;
