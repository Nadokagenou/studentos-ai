-- ============================================================
-- 23 · หน้าโปรไฟล์ — เปิดให้คนนอกห้องดูได้ และมีตัวเลขให้ดู
-- ------------------------------------------------------------
-- ผู้ใช้ขอให้หน้าโปรไฟล์เป็นทรงเดียวกับ Instagram (9 ก.ย. 2569)
-- แต่ก่อนจะไปถึงเรื่องหน้าตา มีสองอย่างที่ฝั่งข้อมูลต้องแก้ก่อน
--
-- **1) ด่านที่ตกยุคไปแล้ว** — user_card เดิมปิดท้ายด้วย
--        and (p.id = auth.uid() or public.shares_room(p.id))
--    ตอนเขียน (migration 12) ถูกต้อง เพราะตอนนั้นเห็นกันได้เฉพาะคนห้องเดียวกัน
--    แต่ตั้งแต่ migration 17 (เพิ่มเพื่อนข้ามห้อง) · 19 (ทักกันได้ทุกคน) · 20 (หัวข้อทั่วโลก)
--    ผู้ใช้เจอกันได้จากสามทางที่ไม่ผ่านห้องเรียนเลย แล้วพอกดชื่อเขาจะได้หน้าว่าง
--    เขียนว่า "เห็นโปรไฟล์ได้เฉพาะคนที่อยู่ห้องเรียนเดียวกัน" ซึ่งอ่านเหมือนแอปพัง
--    **นี่คือด่านที่ลืมปลดตอนขยายขอบเขต ไม่ใช่ด่านที่ตั้งใจให้อยู่**
--    ของที่ยังกันอยู่จริงคือการบล็อก ซึ่งเป็นเส้นที่ถูกกว่าสำหรับแอปที่ค้นหาคนได้ทั้งระบบ
--
-- **2) ตัวเลขสามช่องแบบ IG** — โพสต์ · เพื่อน · ช่วยแล้ว
--    "ช่วยแล้ว" คือจำนวนคำตอบที่เขาเคยเขียนให้คนอื่น (ใต้โพสต์ + ในเธรดหัวข้อ)
--    เลือกตัวนี้แทน "ผู้ติดตาม" โดยตั้งใจ เพราะแอปนี้ไม่มีการติดตาม และเพราะ
--    บทเรียนเดิมที่ผู้ใช้เคยปฏิเสธไปแล้ว: "นักเรียนไม่ได้อยากอวดว่าทำงานเสร็จกี่ชิ้น"
--    ตัวเลขที่ควรอวดจึงต้องเป็นสิ่งที่เขาทำให้ **คนอื่น** ไม่ใช่สิ่งที่เขาทำให้ตัวเอง
--
-- **โรงเรียนไม่โผล่ให้คนต่างประเทศเห็น** — เส้นเดียวกับที่วางไว้ในเอกสารบันไดสโคป
-- คนนอกประเทศเห็นแค่ @ชื่อผู้ใช้ · ประเทศ · วิชาที่ถนัด สามอย่างนี้พอสำหรับการช่วยกันเรียน
-- และเป็นส่วนที่ทำให้ตามตัวเด็กในชีวิตจริงไม่ได้
-- ============================================================

-- ต้อง drop ก่อน — create or replace เปลี่ยนชุดคอลัมน์ที่คืนออกไปไม่ได้
drop function if exists public.user_card(uuid);

create or replace function public.user_card(p_user uuid)
returns table (
  id           uuid,
  display_name text,
  handle       text,
  avatar       text,
  bio          text,
  grade        text,
  country      text,
  school       text,
  strong       text[],
  weak         text[],
  mine         boolean,
  post_count   integer,
  friend_count integer,
  help_count   integer,
  rel          text,       -- friends | sent | incoming | none
  match        text[],     -- เขาเก่ง และเราจม
  give         text[]      -- เราเก่ง และเขาจม
)
language sql stable security definer set search_path = public
as $fn$
  with me as (
    select
      coalesce((select strong from public.profiles where id = auth.uid()), '{}'::text[]) as strong,
      coalesce((select weak   from public.profiles where id = auth.uid()), '{}'::text[]) as weak,
      coalesce((select country from public.profiles where id = auth.uid()), 'TH')        as country
  )
  select p.id, p.display_name, p.handle, p.avatar, p.bio,
         p.grade, p.country,
         case when p.country = me.country then p.school else null end,
         p.strong, p.weak,
         p.id = auth.uid(),
         -- โพสต์ที่เรามองเห็นได้จริงเท่านั้น · ใช้ can_see_post ตัวห้าพารามิเตอร์
         -- ไม่งั้นโพสต์สโคป "ทั่วประเทศ" จะไม่ถูกนับ แล้วตัวเลขบนหน้าโปรไฟล์
         -- จะน้อยกว่าจำนวนใบที่โผล่อยู่ข้างล่างในหน้าเดียวกัน ซึ่งอ่านเหมือนแอปนับผิด
         (select count(*)::int from public.posts o
           where o.author = p.id and not o.anon and not o.hidden
             and (o.author = auth.uid()
                  or public.can_see_post(o.scope, o.room_id, o.school, o.country, o.grade))),
         (select count(*)::int from public.friendships f
           where f.status = 'accepted' and (f.a = p.id or f.b = p.id)),
         -- คำตอบที่เขาเขียนให้คนอื่น — ใต้โพสต์ กับ ในเธรดหัวข้อ
         -- ไม่นับของที่ถูกซ่อน และไม่นับคำตอบในเธรดของตัวเอง (นั่นคือคุยต่อ ไม่ใช่ช่วยใคร)
         (
           (select count(*)::int from public.post_replies r
             join public.posts o on o.id = r.post
            where r.author = p.id and not r.hidden and o.author <> p.id)
           +
           (select count(*)::int from public.topic_msgs m
             join public.topic_threads th on th.id = m.thread
            where m.author = p.id and not m.hidden and th.author <> p.id)
         ),
         case
           when p.id = auth.uid() then 'me'
           when f.status = 'accepted' then 'friends'
           when f.status = 'pending' and f.asked_by = auth.uid() then 'sent'
           when f.status = 'pending' then 'incoming'
           else 'none'
         end,
         array(select unnest(p.strong) intersect select unnest(me.weak)),
         array(select unnest(me.strong) intersect select unnest(p.weak))
    from public.profiles p
    cross join me
    left join public.friendships f
      on f.a = least(auth.uid(), p.id) and f.b = greatest(auth.uid(), p.id)
   where p.id = p_user
     and auth.uid() is not null
     -- ด่านที่เหลืออยู่จริงคือการบล็อก · ดูเหตุผลที่หัวไฟล์ข้อ 1
     and (p.id = auth.uid() or not public.is_blocked(auth.uid(), p.id));
$fn$;

revoke all on function public.user_card(uuid) from public, anon;
grant execute on function public.user_card(uuid) to authenticated;

-- ---------- โพสต์บนหน้าโปรไฟล์ก็ติดด่านเดียวกัน ----------
-- user_posts ยังใช้ can_see_post ตัวสามพารามิเตอร์อยู่ (migration 18 แก้ไปแล้วรอบหนึ่ง
-- แต่ไฟล์นี้เป็นที่สุดท้ายที่ยืนยันว่าทั้งสองฟังก์ชันบนหน้าเดียวกันนับด้วยกติกาเดียวกัน)
-- ถ้าสองตัวนี้ใช้กติกาต่างกัน หัวข้อจะเขียนว่า "โพสต์ 5 ใบ" แล้วข้างล่างมี 3 ใบ
-- ซึ่งเป็นบั๊กที่ไม่มีใครแจ้ง เพราะมันดูเหมือนแค่ "แปลก ๆ"
create or replace function public.user_posts(p_user uuid, p_limit int default 20)
returns table (
  id uuid, scope text, kind text, subject text, body text, image text,
  anon boolean, created_at timestamptz, reply_count integer, mine boolean
)
language sql stable security definer set search_path = public
as $fn$
  select p.id, p.scope, p.kind, p.subject, p.body, p.image, p.anon,
         p.created_at, p.reply_count, p.author = auth.uid()
    from public.posts p
   where p.author = p_user
     and not p.hidden
     and (p.author = auth.uid() or not p.anon)
     and (p.author = auth.uid()
          or public.can_see_post(p.scope, p.room_id, p.school, p.country, p.grade))
   order by p.created_at desc
   limit greatest(1, least(p_limit, 50));
$fn$;

revoke all on function public.user_posts(uuid, int) from public, anon;
grant execute on function public.user_posts(uuid, int) to authenticated;

-- ---------- คำตอบที่เขาเคยเขียน ----------
-- แท็บที่สองบนหน้าโปรไฟล์ · เป็นของที่ทำให้ตัวเลข "ช่วยแล้ว" กดดูได้ ไม่ใช่แค่เลขลอย ๆ
-- ตัวเลขที่กดไม่ได้คือตัวเลขที่ไม่มีใครเชื่อ
create or replace function public.user_answers(p_user uuid, p_limit int default 20)
returns table (
  id text, kind text, body text, at timestamptz,
  topic text, subject text, ref uuid
)
language sql stable security definer set search_path = public
as $fn$
  (
    select 'r' || r.id, 'post', r.body, r.created_at,
           null::text, o.subject, o.id
      from public.post_replies r
      join public.posts o on o.id = r.post
     where r.author = p_user and not r.hidden and not r.anon and not o.hidden
       and o.author <> p_user
       and (o.author = auth.uid()
            or public.can_see_post(o.scope, o.room_id, o.school, o.country, o.grade))
  )
  union all
  (
    select 'm' || m.id, 'topic', m.body, m.created_at,
           t.name, t.subject, th.id
      from public.topic_msgs m
      join public.topic_threads th on th.id = m.thread
      join public.topics t on t.id = th.topic
     where m.author = p_user and not m.hidden and not th.hidden
       and th.author <> p_user
       and public.can_see_topic(th.topic, th.country)
  )
  order by 4 desc
  limit greatest(1, least(p_limit, 50));
$fn$;

revoke all on function public.user_answers(uuid, int) from public, anon;
grant execute on function public.user_answers(uuid, int) to authenticated;
