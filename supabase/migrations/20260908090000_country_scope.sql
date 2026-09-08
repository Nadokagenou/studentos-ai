-- ============================================================
-- 18 · ชั้นที่สี่ของบันไดสโคป — ระดับชั้น + วิชา ทั้งประเทศ
-- ------------------------------------------------------------
-- เหตุผลอยู่ในเอกสารออกแบบ "บันไดสโคป" (8 ก.ย. 2569) สรุปสั้นที่นี่เพราะ
-- คนที่มาอ่านไฟล์นี้ทีหลังจะไม่มีเอกสารนั้นอยู่ในมือ:
--
-- เพดานของ "ส่งการบ้านให้เพื่อนในห้อง" ไม่ใช่ขนาดของห้อง แต่คือห้องเรียนเป็นกลุ่มคน
-- ที่ **ติดพร้อมกัน** — ได้ใบงานเดียวกัน ส่งวันเดียวกัน คืนก่อนส่งจึงไม่มีใครรู้คำตอบเลย
-- ชั้นนี้เป็นก้าวแรกที่ออกจากกับดักนั้น: คนระดับชั้นเดียวกันทั้งประเทศเรียนหลักสูตรเดียวกัน
-- และสอบสนามเดียวกัน (TCAS · O-NET) แต่ปฏิทินโรงเรียนไม่ตรงกันเป๊ะ — บางคนจึงว่างเสมอ
--
-- ทำไมชั้นนี้มาก่อนชั้นโลก: มันแทบไม่ต้องสร้างอะไรใหม่เลย ใช้โครงฟีดเดิมทั้งหมด
-- และมันคือที่ทดสอบว่า "ฟีดที่คนไม่รู้จักกัน" หน้าตาเป็นยังไง ก่อนจะไปเจอเรื่องภาษาอีกชั้น
--
-- เส้นที่ไม่ขยับ: scope 'country' **ไม่ใช่** การกระจายเสียงหาทุกคนในแอป
-- มันแคบกว่านั้นเสมอ เพราะต้องตรงทั้งประเทศและระดับชั้น — คนที่เห็นคือคนที่เรียนเรื่องเดียวกันอยู่
-- ============================================================

-- ---------- ระดับชั้น · แผนการเรียน · ประเทศ ----------
-- ถามแค่ระดับชั้น ไม่ถามวันเกิด (กติกาเดิมจาก migration 13 · age_band)
-- ระดับชั้นบอกช่วงอายุพอสำหรับตั้งค่าเริ่มต้นด้านความปลอดภัย และเป็นสิ่งที่นักเรียนตอบตรงอยู่แล้ว
--
-- country เก็บเป็นรหัส ISO สองตัว ค่าเริ่มต้น TH — วันที่เปิดประเทศที่สอง
-- แถวเก่าทั้งหมดจะยังถูกต้องโดยไม่ต้องไล่แก้ย้อนหลัง
alter table public.profiles add column if not exists country text not null default 'TH'
  check (country ~ '^[A-Z][A-Z]$');
-- ---------- ทำไมเป็นช่วงชั้น ไม่ใช่ ม.1 ถึง ม.6 ----------
-- ผู้ใช้เคาะเองเมื่อ 8 ก.ย. 2569: เก็บแค่ ม.ต้น / ม.ปลาย / มหาลัย
-- และมันถูกกว่าที่คิด เพราะช่องนี้ทำงานสองอย่างพร้อมกัน:
--   1) เป็นกุญแจของสโคป 'country' — ผู้ชมต้องกว้างพอที่จะมีคนว่างตอบเสมอ
--      ม.4 อย่างเดียวคือหนึ่งในสามของ ม.ปลาย ซึ่งแคบเกินไปในวันที่ยังมีคนใช้ไม่เยอะ
--   2) เป็นตัวบอกช่วงอายุแบบหยาบ ๆ สำหรับค่าเริ่มต้นด้านความปลอดภัย
--      โดยไม่ต้องถามวันเกิด (กติกาเดิมจาก migration 13 · age_band)
-- ที่สำคัญกว่านั้น: มันเป็นสิ่งที่นักเรียนตอบตรงอยู่แล้ว ไม่มีใครโกหกว่าตัวเองอยู่ ม.ต้น
alter table public.profiles add column if not exists grade text
  check (grade is null or grade in ('ม.ต้น','ม.ปลาย','มหาลัย','อื่น ๆ'));
-- แผนการเรียนเก็บไว้เพื่อ "จัดลำดับ" ไม่ใช่เพื่อ "กรอง" — เหตุผลอยู่ที่ can_see_post ข้างล่าง
alter table public.profiles add column if not exists track text
  check (track is null or length(track) <= 40);

create index if not exists profiles_cohort_idx on public.profiles (country, grade);

-- ---------- โพสต์ถ่ายสำเนาประเทศ+ระดับชั้นไว้ตอนโพสต์ ----------
-- ถ่ายสำเนาด้วยเหตุผลเดียวกับ school ใน migration 11 เป๊ะ ๆ:
-- ขึ้น ม.5 แล้วโพสต์เก่าต้องอยู่ในฟีดของ ม.4 ต่อไป ไม่ใช่ย้ายตามเจ้าของขึ้นไปทั้งก้อน
-- (ถ้าไม่ถ่ายสำเนา ฟีด ม.4 จะโล่งขึ้นทุกเดือนพฤษภาคมโดยไม่มีใครหาสาเหตุเจอ)
alter table public.posts add column if not exists country text;
alter table public.posts add column if not exists grade text;

create index if not exists posts_cohort_idx on public.posts (country, grade, created_at desc);

-- ขยาย check ของ scope · ต้อง drop ก่อนเพราะ add constraint ที่ชื่อซ้ำจะล้ม
alter table public.posts drop constraint if exists posts_scope_check;
alter table public.posts add constraint posts_scope_check
  check (scope in ('room', 'school', 'country', 'all'));

-- ---------- ระดับชั้นของฉัน ----------
create or replace function public.my_cohort()
returns table (country text, grade text)
language sql stable security definer set search_path = public
as $fn$ select country, grade from public.profiles where id = auth.uid() $fn$;

revoke all on function public.my_cohort() from public, anon;
grant execute on function public.my_cohort() to authenticated;

-- ============================================================
-- กติกาการมองเห็น — ยังเป็นฟังก์ชันเดียว เขียนที่เดียว
-- ------------------------------------------------------------
-- เพิ่มพารามิเตอร์เป็นห้าตัว แล้วไล่เปลี่ยนผู้เรียกให้ครบทุกที่ในไฟล์นี้
-- ตัวเก่าสามพารามิเตอร์ยังอยู่และส่งต่อให้ตัวใหม่ เพื่อไม่ให้ของที่ยังเรียกตัวเก่าอยู่พังเงียบ ๆ
--
-- **ทำไม track ไม่อยู่ในเงื่อนไขการมองเห็น**: ถ้ากรองด้วยแผนการเรียนด้วย
-- ผู้ชมจะถูกหั่นเป็นสี่ห้าส่วนทันที และคนจำนวนมากไม่ได้กรอกช่องนี้ —
-- คนที่ไม่กรอกจะกลายเป็นคนที่ไม่เห็นอะไรเลยและไม่มีใครเห็นเขา ซึ่งแย่กว่าฟีดที่กว้างไปหน่อย
-- track ใช้ตอนจัดลำดับใน feed() แทน — เห็นทุกคน แต่คนที่เรียนแผนเดียวกันขึ้นก่อน
-- ============================================================
create or replace function public.can_see_post(
  p_scope text, p_room text, p_school text, p_country text, p_grade text)
returns boolean
language sql stable security definer set search_path = public
as $fn$
  select case p_scope
    when 'all'     then true
    when 'school'  then p_school is not null and p_school = public.my_school()
    when 'room'    then p_room is not null and public.in_room(p_room)
    when 'country' then p_country is not null and p_grade is not null
                    and exists (select 1 from public.profiles
                                 where id = auth.uid()
                                   and country = p_country
                                   and grade = p_grade)
    else false
  end;
$fn$;

create or replace function public.can_see_post(p_scope text, p_room text, p_school text)
returns boolean
language sql stable security definer set search_path = public
as $fn$ select public.can_see_post(p_scope, p_room, p_school, null, null) $fn$;

revoke all on function public.can_see_post(text, text, text, text, text) from public, anon;
grant execute on function public.can_see_post(text, text, text, text, text) to authenticated;

-- ---------- นโยบายอ่าน/เขียนโพสต์ ----------
drop policy if exists "read visible posts" on public.posts;
create policy "read visible posts" on public.posts
  for select to authenticated
  using (author = auth.uid()
         or public.can_see_post(scope, room_id, school, country, grade));

drop policy if exists "write own posts" on public.posts;
create policy "write own posts" on public.posts
  for insert to authenticated
  with check (
    author = auth.uid()
    and case scope
      when 'all'    then true
      when 'school' then school is not null and school = public.my_school()
      when 'room'   then room_id is not null and public.in_room(room_id)
      -- โพสต์ลงระดับชั้นที่ไม่ใช่ของตัวเองไม่ได้ · ต้องกรอกระดับชั้นก่อนถึงจะโพสต์ชั้นนี้ได้
      when 'country' then country is not null and grade is not null
                      and exists (select 1 from public.profiles pr
                                   where pr.id = auth.uid()
                                     and pr.country = posts.country
                                     and pr.grade = posts.grade)
      else false
    end
  );

-- ============================================================
-- ฟีด · เธรด · โพสต์ของคนคนหนึ่ง — ต้องแก้พร้อมกันทั้งสามตัว
-- ------------------------------------------------------------
-- บทเรียนเดิมจาก migration 13: ของที่ถูกซ่อนต้องหายจากทุกทางที่อ่านได้
-- กติกาการมองเห็นก็เหมือนกัน — เพิ่มชั้นใหม่แล้วลืมแก้ตัวใดตัวหนึ่ง
-- คือช่องที่โพสต์ของชั้นนั้นโผล่ผิดที่ หรือหายไปทั้งที่ควรเห็น
-- ชุดคอลัมน์ที่คืนออกไปเหมือนเดิมทุกตัว ฝั่งแอปจึงไม่ต้องแก้อะไรตาม
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
as $fn$
  with me as (
    select coalesce((select strong from public.profiles where id = auth.uid()), '{}'::text[]) as strong,
           (select track from public.profiles where id = auth.uid()) as track
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
    and (p.author = auth.uid()
         or public.can_see_post(p.scope, p.room_id, p.school, p.country, p.grade))
    and (p_before is null or p.created_at < p_before)
  order by (p.kind = 'help' and p.reply_count = 0
            and p.subject = any(me.strong) and p.author <> auth.uid()) desc,
           -- แผนการเรียนเดียวกันขึ้นก่อน แต่ไม่ได้กันคนอื่นออก (ดูเหตุผลที่ can_see_post)
           (me.track is not null and pr.track is not distinct from me.track) desc,
           p.created_at desc
  limit greatest(1, least(p_limit, 50));
$fn$;

revoke all on function public.feed(text, timestamptz, int) from public, anon;
grant execute on function public.feed(text, timestamptz, int) to authenticated;

create or replace function public.post_thread(p_post uuid)
returns table (
  id bigint, body text, anon boolean, created_at timestamptz,
  author uuid, display_name text, avatar text, mine boolean
)
language sql stable security definer set search_path = public
as $fn$
  select r.id, r.body, r.anon, r.created_at,
    case when r.anon and r.author <> auth.uid() then null else r.author end,
    case when r.anon and r.author <> auth.uid() then null else pr.display_name end,
    case when r.anon and r.author <> auth.uid() then null else pr.avatar end,
    r.author = auth.uid()
  from public.post_replies r
  left join public.profiles pr on pr.id = r.author
  join public.posts p on p.id = r.post
  where r.post = p_post and not r.hidden and not p.hidden
    and (p.author = auth.uid()
         or public.can_see_post(p.scope, p.room_id, p.school, p.country, p.grade))
  order by r.created_at
  limit 200;
$fn$;

revoke all on function public.post_thread(uuid) from public, anon;
grant execute on function public.post_thread(uuid) to authenticated;

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

-- ---------- ตั้งระดับชั้นของตัวเอง ----------
-- ผ่าน RPC ไม่ใช่ update ตรง เพราะประเทศกับระดับชั้นเป็นกุญแจของการมองเห็น
-- ของแบบนั้นควรมีประตูเดียวที่ตรวจค่าก่อนเขียน ไม่ใช่ปล่อยให้ฝั่งแอปเขียนอะไรก็ได้ลงไป
create or replace function public.set_cohort(p_grade text, p_track text default null,
                                             p_country text default null)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  insert into public.profiles (id) values (v_me) on conflict (id) do nothing;
  update public.profiles
     set grade   = nullif(btrim(coalesce(p_grade, '')), ''),
         track   = nullif(btrim(coalesce(p_track, '')), ''),
         country = coalesce(nullif(upper(btrim(coalesce(p_country, ''))), ''), country),
         updated_at = now()
   where id = v_me;
end;
$fn$;

revoke all on function public.set_cohort(text, text, text) from public, anon;
grant execute on function public.set_cohort(text, text, text) to authenticated;
