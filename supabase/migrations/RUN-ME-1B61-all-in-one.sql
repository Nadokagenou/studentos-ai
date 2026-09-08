-- ============================================================
-- StudentOS AI · 1B61 — รวมทุก migration ไว้ในไฟล์เดียว
-- ============================================================
-- วิธีใช้: ก๊อปทั้งไฟล์นี้ไปวางใน Supabase Dashboard → SQL Editor → กด Run
-- รันซ้ำได้ปลอดภัย ทุกคำสั่งเขียนเป็น if not exists / or replace ไว้แล้ว
--
-- ไฟล์นี้ **ไม่มี** 20260908090300_topic_cron.sql อยู่ในนี้โดยตั้งใจ
-- เพราะตัวนั้นตั้งนาฬิกาให้ยิงหา Edge Function `sai-topic` ทุก 5 นาที
-- ถ้ารันก่อน deploy ฟังก์ชัน มันจะยิงไปที่ 404 ทุก 5 นาทีตลอดไป
-- ค่อยรันไฟล์นั้นแยกทีหลัง วันที่ deploy Edge Function เสร็จแล้ว
-- ============================================================



-- ############################################################
-- # 18 · ชั้นทั่วประเทศ   (20260908090000_country_scope.sql)
-- ############################################################

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


-- ############################################################
-- # 19 · เปิดการทัก   (20260908090100_open_dm.sql)
-- ############################################################

-- ============================================================
-- 19 · เปิดการทัก — ทักกันได้ทุกคน แบบเดียวกับ IG
-- ------------------------------------------------------------
-- ผู้ใช้เคาะเองเมื่อ 8 ก.ย. 2569: "ได้เหมือนแอปทั่ว ๆ ไปเลย เหมือน ig facebook"
--
-- ของเดิมใน migration 10 มีบรรทัดเดียวที่กั้นทั้งหมดไว้ ใน open_dm():
--     if not shares_room(p_other) then raise 'ทักได้เฉพาะคนที่อยู่ห้องเดียวกัน'
-- พร้อมคอมเมนต์ว่า "นี่คือเส้นที่กันคนแปลกหน้าออกไปทั้งหมด" — เส้นนั้นถูก **แทนที่**
-- ไม่ใช่แค่ถอดออก เพราะถอดเฉย ๆ แปลว่าคนแปลกหน้าทั้งโลกส่งข้อความหาเด็กได้ทันที
-- โดยไม่มีอะไรขวางเลยสักชั้น ซึ่งเป็นของที่ทำให้แอปแบบนี้โดนถอดจากสโตร์จริง ๆ
--
-- สิ่งที่มาแทนคือกลไกที่ IG ใช้และได้ผลจริง — **กล่องคำขอทัก**:
--   ทักได้ทุกคน แต่ข้อความแรกจากคนที่ไม่ใช่เพื่อนและไม่ได้อยู่ห้องเดียวกัน
--   ไปนั่งอยู่ในกล่องคำขอ · ไม่เด้งเตือน · ส่งได้ข้อความเดียวจนกว่าปลายทางจะตอบ
--   ปลายทางตอบเมื่อไหร่ = ห้องเปิด และหลังจากนั้นคุยได้ปกติ
--
-- กติกาทั้งหมดยังอยู่ในฟังก์ชันเดียวเหมือนเดิม (open_dm + dm_say) ตามคอมเมนต์เดิม
-- ของ migration 10 ที่เขียนไว้ถูกแล้วว่า "ถ้ากระจายไปอยู่ใน policy หลายที่
-- วันที่แก้กติกาจะแก้ไม่ครบ แล้วช่องที่ลืมแก้คือช่องที่คนทักหากันได้ทั้งที่ไม่ควรทักได้"
-- ============================================================

-- ---------- สถานะของห้อง ----------
-- แถวเก่าทั้งหมดได้ 'open' ตามค่าเริ่มต้น ซึ่งถูกต้อง — ห้องที่มีอยู่ก่อนหน้านี้
-- ล้วนเกิดจากคนที่อยู่ห้องเรียนเดียวกัน จึงผ่านด่านเดิมมาแล้วทั้งหมด
alter table public.dm_threads add column if not exists state text not null default 'open'
  check (state in ('pending', 'open'));
alter table public.dm_threads add column if not exists opener uuid references auth.users(id) on delete set null;
alter table public.dm_threads add column if not exists req_at timestamptz;

create index if not exists dm_threads_pending_idx on public.dm_threads (state, last_at desc);

-- ---------- ใครทักฉันได้ ----------
-- 'auto'  = ตามช่วงอายุ (ค่าเริ่มต้น · อธิบายที่ dm_gate ข้างล่าง)
-- 'all'   = ใครก็ได้ · ผู้ใช้ต้องเลือกเอง ไม่ใช่ค่าเริ่มต้น
-- 'known' = เฉพาะเพื่อนกับคนห้องเดียวกัน · คือพฤติกรรมเดิมก่อน migration นี้
alter table public.profiles add column if not exists dm_open text not null default 'auto'
  check (dm_open in ('auto', 'all', 'known'));

-- ---------- ประวัติการโดนปฏิเสธ ----------
-- มาตรการที่ได้ผลที่สุดต่อบรรทัดโค้ดที่เขียน ไม่ใช่การไล่แบนทีละบัญชี:
-- คนที่ยิงคำขอไปทั่วแล้วโดนปฏิเสธบ่อย ๆ จะทักออกได้น้อยลงเอง โดยไม่ต้องมีใครตัดสิน
-- แต้มหายเองเมื่อเงียบครบ 7 วัน — ไม่งั้นบัญชีที่เคยพลาดครั้งเดียวจะโดนกดตลอดชีวิต
alter table public.profiles add column if not exists dm_strikes int not null default 0;
alter table public.profiles add column if not exists dm_strike_at timestamptz;

-- ============================================================
-- ด่านเดียว — ตอบว่าทักคนนี้ได้ไหม และเพราะอะไรถึงไม่ได้
-- ------------------------------------------------------------
-- คืนเป็นข้อความไทยที่เอาไปโชว์ได้ตรง ๆ · คืน 'ok' หรือ 'known' แปลว่าผ่าน
--   'ok'    = ผ่านแบบต้องเข้ากล่องคำขอ
--   'known' = ผ่านแบบเปิดห้องได้เลย (เพื่อนกัน หรืออยู่ห้องเรียนเดียวกัน)
-- ============================================================
create or replace function public.dm_gate(p_other uuid)
returns text
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_me      uuid := auth.uid();
  v_known   boolean;
  v_policy  text;
  v_their   text;   -- ช่วงอายุปลายทาง
  v_mine    text;   -- ช่วงอายุเรา
  v_quota   int;
  v_used    int;
  v_strikes int;
begin
  if v_me is null then return 'ต้องล็อกอินก่อน'; end if;
  if p_other = v_me then return 'ทักตัวเองไม่ได้'; end if;
  -- ฝั่งที่ถูกบล็อกต้องไม่รู้ว่าถูกบล็อก ข้อความจึงกลาง ๆ เหมือนของเดิม
  if public.is_blocked(v_me, p_other) then return 'ทักคนนี้ไม่ได้'; end if;

  v_known := exists (
    select 1 from public.friendships
     where a = least(v_me, p_other) and b = greatest(v_me, p_other) and status = 'accepted'
  ) or public.shares_room(p_other);

  if v_known then return 'known'; end if;

  select coalesce(dm_open, 'auto'), age_band into v_policy, v_their
    from public.profiles where id = p_other;
  if v_policy is null then v_policy := 'auto'; end if;
  if v_policy = 'known' then return 'คนนี้รับข้อความเฉพาะจากเพื่อนกับคนห้องเดียวกัน'; end if;

  -- ---------- ช่วงอายุ ----------
  -- บัญชีที่บอกว่าต่ำกว่า 15 รับคำขอจากคนรุ่นเดียวกันเท่านั้นเป็นค่าเริ่มต้น
  -- เปลี่ยนได้ แต่ต้องเป็นเจ้าตัวที่ไปเลือก 'all' เอง — ค่าเริ่มต้นที่ปลอดภัยกว่า
  -- คือค่าเริ่มต้นที่ถูก เพราะคนส่วนใหญ่ไม่เคยเปิดหน้าตั้งค่าเลยสักครั้ง
  if v_policy = 'auto' and v_their = 'under' then
    select age_band into v_mine from public.profiles where id = v_me;
    if v_mine is distinct from 'under' then
      return 'บัญชีนี้รับข้อความจากคนรุ่นเดียวกันเท่านั้น';
    end if;
  end if;

  -- ---------- เพดานการทักออกต่อวัน ----------
  select coalesce(age_band, ''), coalesce(dm_strikes, 0) into v_mine, v_strikes
    from public.profiles where id = v_me;
  -- แต้มที่เก่ากว่า 7 วันไม่นับ (ตัวเลขจริงถูกล้างตอนคนคนนั้นทักครั้งถัดไป ที่ open_dm)
  if (select dm_strike_at from public.profiles where id = v_me) < now() - interval '7 days' then
    v_strikes := 0;
  end if;
  v_quota := case when v_mine = 'under' then 5 else 12 end - v_strikes;
  if v_quota < 1 then v_quota := 1; end if;

  select count(*) into v_used
    from public.dm_threads
   where opener = v_me and state = 'pending' and req_at > now() - interval '24 hours';

  if v_used >= v_quota then
    return 'วันนี้ทักคนใหม่ครบโควตาแล้ว — รอพรุ่งนี้ หรือรอให้คนที่ทักไว้ตอบกลับก่อน';
  end if;

  return 'ok';
end;
$fn$;

revoke all on function public.dm_gate(uuid) from public, anon;
grant execute on function public.dm_gate(uuid) to authenticated;

-- ============================================================
-- เปิดห้องคุย — ประตูเดียวที่สร้าง thread ได้ (เหมือนเดิม กติกาเปลี่ยน)
-- ============================================================
create or replace function public.open_dm(p_other uuid, p_subject text default null)
returns uuid
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me   uuid := auth.uid();
  v_a    uuid;
  v_b    uuid;
  v_id   uuid;
  v_gate text;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);

  -- ห้องที่มีอยู่แล้วเปิดซ้ำได้เสมอ ไม่ต้องผ่านด่านใหม่ —
  -- ไม่งั้นคนที่คุยกันค้างไว้จะเปิดห้องเดิมไม่ได้ในวันที่โควตาเต็ม
  select id into v_id from public.dm_threads where a = v_a and b = v_b;
  if v_id is not null then
    update public.dm_threads set last_at = now() where id = v_id;
    return v_id;
  end if;

  v_gate := public.dm_gate(p_other);
  if v_gate not in ('ok', 'known') then raise exception '%', v_gate; end if;

  -- ล้างแต้มที่หมดอายุแล้วจริง ๆ ตรงนี้ ที่เดียว (dm_gate เป็น stable เขียนไม่ได้)
  update public.profiles set dm_strikes = 0
   where id = v_me and dm_strike_at < now() - interval '7 days';

  insert into public.dm_threads (a, b, subject, state, opener, req_at)
  values (v_a, v_b, p_subject,
          case when v_gate = 'known' then 'open' else 'pending' end,
          v_me,
          case when v_gate = 'known' then null else now() end)
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function public.open_dm(uuid, text) from public, anon;
grant execute on function public.open_dm(uuid, text) to authenticated;

-- ============================================================
-- ส่งข้อความ — ประตูเดียวเช่นกัน
-- ------------------------------------------------------------
-- policy ของ dm_messages ถูกบีบให้รับเฉพาะห้องที่ state = 'open' แล้ว
-- ห้องที่ยังเป็นคำขอจึงเข้ามาได้ทางนี้ทางเดียว ซึ่งเป็นที่ที่บังคับกติกาสองข้อ:
--   1) คนขอส่งได้ข้อความเดียวจนกว่าปลายทางจะตอบ — กันการรัวข้อความใส่คนที่ยังไม่ตอบรับ
--   2) ปลายทางตอบเมื่อไหร่ = ห้องเปิดทันที ไม่ต้องมีปุ่ม "ยอมรับ" ให้กดอีกที
--      (ปุ่มยอมรับยังมีอยู่ที่ dm_accept สำหรับคนที่อยากเปิดไว้ก่อนโดยยังไม่พิมพ์)
-- ============================================================
create or replace function public.dm_say(p_thread uuid, p_body text)
returns table (id bigint, created_at timestamptz)
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_t  public.dm_threads%rowtype;
  v_n  int;
  v_id bigint;
  v_at timestamptz;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'ยังไม่ได้พิมพ์อะไร'; end if;
  if length(p_body) > 2000 then raise exception 'ข้อความยาวเกินไป'; end if;

  select * into v_t from public.dm_threads where id = p_thread;
  if v_t.id is null then raise exception 'ไม่พบห้องนี้'; end if;
  if v_me not in (v_t.a, v_t.b) then raise exception 'ไม่ได้อยู่ในห้องนี้'; end if;
  if public.is_blocked(v_t.a, v_t.b) then raise exception 'ส่งข้อความไม่ได้'; end if;

  if v_t.state = 'pending' then
    if v_t.opener = v_me then
      select count(*) into v_n from public.dm_messages where thread = p_thread and sender = v_me;
      if v_n >= 1 then
        raise exception 'ส่งได้ข้อความเดียวจนกว่าอีกฝ่ายจะตอบ';
      end if;
    else
      -- ปลายทางพิมพ์ = ตอบรับ
      update public.dm_threads set state = 'open', req_at = null where id = p_thread;
    end if;
  end if;

  -- ตัวแปรต้องชื่อไม่ซ้ำกับคอลัมน์ ไม่งั้น plpgsql ตีความ RETURNING ไม่ออก
  -- (ambiguous column reference — ซึ่งพังตอนรันจริง ไม่ใช่ตอน apply migration)
  insert into public.dm_messages (thread, sender, body)
  values (p_thread, v_me, btrim(p_body))
  returning dm_messages.id, dm_messages.created_at into v_id, v_at;

  return query select v_id, v_at;
end;
$fn$;

revoke all on function public.dm_say(uuid, text) from public, anon;
grant execute on function public.dm_say(uuid, text) to authenticated;

-- policy เดิมยอมให้ insert ในห้องไหนก็ได้ที่ตัวเองอยู่ · บีบให้เหลือเฉพาะห้องที่เปิดแล้ว
drop policy if exists "send own dm" on public.dm_messages;
create policy "send own dm" on public.dm_messages
  for insert to authenticated
  with check (
    sender = auth.uid()
    and exists (
      select 1 from public.dm_threads t
       where t.id = thread
         and t.state = 'open'
         and (t.a = auth.uid() or t.b = auth.uid())
         and not public.is_blocked(t.a, t.b)
    )
  );

-- ============================================================
-- รับ / ปฏิเสธคำขอ
-- ============================================================
create or replace function public.dm_accept(p_thread uuid)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_me uuid := auth.uid(); v_t public.dm_threads%rowtype;
begin
  select * into v_t from public.dm_threads where id = p_thread;
  if v_t.id is null or v_me not in (v_t.a, v_t.b) then raise exception 'ไม่พบห้องนี้'; end if;
  if v_t.opener = v_me then raise exception 'คำขอนี้เป็นของคุณเอง'; end if;
  update public.dm_threads set state = 'open', req_at = null where id = p_thread;
end;
$fn$;

-- ปฏิเสธ = ลบห้องทิ้งทั้งใบ ไม่ใช่แค่ซ่อน
-- ถ้าแค่ซ่อน คนขอจะยังส่งข้อความเข้ามาได้เรื่อย ๆ ในห้องที่ปลายทางมองไม่เห็น
-- ซึ่งอ่านเหมือน "เขาไม่ตอบ" ทั้งที่จริงคือ "เขาไม่เห็น" — และเป็นช่องที่แย่ที่สุดช่องหนึ่ง
create or replace function public.dm_decline(p_thread uuid, p_block boolean default false)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_me uuid := auth.uid(); v_t public.dm_threads%rowtype; v_other uuid;
begin
  select * into v_t from public.dm_threads where id = p_thread;
  if v_t.id is null or v_me not in (v_t.a, v_t.b) then raise exception 'ไม่พบห้องนี้'; end if;
  if v_t.opener = v_me then raise exception 'คำขอนี้เป็นของคุณเอง'; end if;
  v_other := case when v_t.a = v_me then v_t.b else v_t.a end;

  -- แต้มของคนที่ถูกปฏิเสธ · ไม่แจ้งเขา และไม่มีอะไรบอกว่าเกิดอะไรขึ้น
  -- (บอกไปคือการสอนวิธีเลี่ยง ซึ่งเป็นสิ่งเดียวที่คนยิงสแปมอยากรู้)
  update public.profiles
     set dm_strikes = case when dm_strike_at < now() - interval '7 days' then 1
                           else least(coalesce(dm_strikes, 0) + 1, 10) end,
         dm_strike_at = now()
   where id = v_other;

  if p_block then
    insert into public.blocks (blocker, blocked) values (v_me, v_other)
    on conflict do nothing;
  end if;

  delete from public.dm_threads where id = p_thread;
end;
$fn$;

revoke all on function public.dm_accept(uuid) from public, anon;
revoke all on function public.dm_decline(uuid, boolean) from public, anon;
grant execute on function public.dm_accept(uuid) to authenticated;
grant execute on function public.dm_decline(uuid, boolean) to authenticated;

-- ============================================================
-- กล่องข้อความ — ห้องที่เปิดแล้ว กับ คำขอ ในคำสั่งเดียว
-- ------------------------------------------------------------
-- คืนมาก้อนเดียวแล้วให้ฝั่งแอปแยกเอง ดีกว่ายิงสองคำสั่ง เพราะสองคำสั่งแปลว่า
-- สองสถานะที่มาถึงคนละเวลา แล้วจอจะกระพริบระหว่างรออันที่สอง
-- ============================================================
create or replace function public.dm_inbox()
returns table (
  id uuid, other uuid, display_name text, handle text, avatar text,
  subject text, state text, is_request boolean, mine_last boolean,
  last_body text, last_at timestamptz
)
language sql stable security definer set search_path = public
as $fn$
  select t.id,
         case when t.a = auth.uid() then t.b else t.a end,
         p.display_name, p.handle, p.avatar,
         t.subject, t.state,
         (t.state = 'pending' and t.opener is distinct from auth.uid()),
         (m.sender = auth.uid()),
         m.body, t.last_at
    from public.dm_threads t
    join public.profiles p
      on p.id = case when t.a = auth.uid() then t.b else t.a end
    left join lateral (
      select body, sender from public.dm_messages
       where thread = t.id order by created_at desc limit 1
    ) m on true
   where (t.a = auth.uid() or t.b = auth.uid())
     and not public.is_blocked(t.a, t.b)
     -- คำขอที่ตัวเองเป็นคนส่งและยังไม่มีใครตอบ ไม่ต้องโผล่ในกล่องของตัวเอง
     -- มันคือของที่รออยู่ ไม่ใช่บทสนทนา · เห็นแล้วมีแต่จะกดซ้ำ
     and not (t.state = 'pending' and t.opener = auth.uid())
   order by (t.state = 'pending') desc, t.last_at desc
   limit 100;
$fn$;

revoke all on function public.dm_inbox() from public, anon;
grant execute on function public.dm_inbox() to authenticated;

-- ============================================================
-- ค้นหาคน — ปิดบัญชีเด็กจากสายตาคนนอกรุ่น
-- ------------------------------------------------------------
-- ชุดคอลัมน์เดิมทุกตัว ฝั่งแอปจึงไม่ต้องแก้ตาม · เพิ่มเงื่อนไขเดียว
-- ต้อง drop ก่อนเพราะ create or replace เปลี่ยน body ของ sql function ที่มี table เดิมได้
-- แต่เราไม่ได้เปลี่ยนคอลัมน์ จึง replace ตรง ๆ ได้
-- ============================================================
create or replace function public.find_people(p_q text)
returns table (id uuid, display_name text, handle text, avatar text, rel text)
language sql stable security definer set search_path = public as $fn$
  with q as (
    select lower(regexp_replace(btrim(coalesce(p_q, '')), '^@', '')) as t
  ),
  me as (
    select age_band from public.profiles where id = auth.uid()
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
     -- บัญชีที่บอกว่าต่ำกว่า 15 ไม่โผล่ในผลค้นหาของคนนอกรุ่น
     -- เว้นแต่เป็นเพื่อนกันอยู่แล้ว (คนที่รู้จักกันแล้วต้องหากันเจอเสมอ)
     and (p.age_band is distinct from 'under'
          or p.dm_open = 'all'
          or (select age_band from me) = 'under'
          or f.status = 'accepted')
   order by (lower(p.handle) = q.t) desc, (lower(p.handle) like q.t || '%') desc,
            p.display_name
   limit 12;
$fn$;

revoke all on function public.find_people(text) from public, anon;
grant execute on function public.find_people(text) to authenticated;

-- ---------- ตั้งค่าว่าใครทักฉันได้ ----------
create or replace function public.set_dm_open(p_mode text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if auth.uid() is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if p_mode not in ('auto', 'all', 'known') then raise exception 'ค่าไม่ถูกต้อง'; end if;
  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
  update public.profiles set dm_open = p_mode, updated_at = now() where id = auth.uid();
end;
$fn$;

revoke all on function public.set_dm_open(text) from public, anon;
grant execute on function public.set_dm_open(text) to authenticated;


-- ############################################################
-- # 20 · หัวข้อทั่วโลก   (20260908090200_topics.sql)
-- ############################################################

-- ============================================================
-- 20 · ชั้นที่ห้า — หัวข้อทั่วโลก
-- ------------------------------------------------------------
-- กุญแจของห้องเปลี่ยนจาก "ใครนั่งข้างคุณ" เป็น "คุณติดอะไร"
--
-- ทำไมต้องเป็นหัวข้อ ไม่ใช่ชื่องาน: ด้วยเหตุผลเดียวกับที่ห้องการบ้าน (migration 17)
-- ใช้ ห้องเรียน+วิชา+วันส่ง เป็นกุญแจแทนชื่องาน — ชื่อที่แต่ละคนพิมพ์ไม่มีวันตรงกัน
-- ห้องเดียวจะแตกเป็นห้าห้องที่มีคนละคน · แต่ "ผังงานแบบมีเงื่อนไข" ตรงกันเสมอ
-- ทั้งข้ามโรงเรียน ข้ามปีการศึกษา และข้ามประเทศ
--
-- ทำไมมันแก้ปัญหาที่ห้องเรียนแก้ไม่ได้: ห้องเรียนคือกลุ่มคนที่ติดพร้อมกัน
-- คนที่ตอบได้คือคนที่ผ่านมันไปแล้ว **และปฏิทินเขาไม่ตรงกับคุณ** — ซึ่งมีอยู่เสมอถ้าขอบเขตคือโลก
--
-- ---------- เส้นสามเส้นที่ห้ามขยับ ----------
-- 1) universal = false → หัวข้อนั้นไปได้ไกลสุดแค่ระดับประเทศ
--    วรรณคดีไทย ประวัติศาสตร์ไทย สังคมศึกษา ไม่มีทางไปโลกได้ ฝืนดันขึ้นไปแปลว่า
--    ผู้ใช้เปิดเจอห้องว่าง ซึ่งแย่กว่าไม่มีปุ่มนั้นตั้งแต่แรก
-- 2) ไม่มีรายการหัวข้อให้ไล่ดูทั้งหมด — ทางเข้ามีสองทางคือ "จากการ์ดงาน" กับ "จากรูปที่เพิ่งถ่าย"
--    รายการให้ไถดูเรื่อย ๆ คือสิ่งที่ทำให้มันกลายเป็นแอปโซเชียลอีกตัว ซึ่งนักเรียนมีอยู่แล้วสามตัว
-- 3) เธรดเก็บ **วิธี** ไม่เก็บ **เฉลยของงานชิ้นใดชิ้นหนึ่ง** — ข้อนี้ไม่ต้องบังคับด้วยกฎ
--    มันเป็นผลจากการเลือกกุญแจ เพราะกุญแจคือแนวคิด ไม่ใช่ใบงาน คำตอบที่ลอกได้ตรง ๆ
--    จึงไม่มีที่อยู่ในโครงสร้างตั้งแต่แรก · นี่คือสิ่งที่กันไม่ให้แอปกลายเป็นเว็บลอกการบ้าน
-- ============================================================

-- ============================================================
-- 1 · กราฟหัวข้อ
-- ------------------------------------------------------------
-- id เขียนด้วยมือเป็นภาษาอังกฤษแบบมีลำดับชั้น (math.quad.formula) โดยตั้งใจ —
-- ไม่ใช้ uuid เพราะ id ของหัวข้อต้องอ่านออกด้วยตาเวลา debug และต้องเหมือนกัน
-- ทุกที่ที่พูดถึงมัน (ในโค้ด · ในคำสั่งที่ส่งให้ AI · ในลิงก์)
-- ============================================================
create table if not exists public.topics (
  id        text primary key check (id ~ '^[a-z][a-z0-9.]{2,63}$'),
  subject   text not null,            -- ชื่อวิชาแบบที่แอปใช้ ต้องตรงกับ knownSubjects()
  name      text not null,            -- ชื่อหัวข้อภาษาไทย
  name_en   text,                     -- ใช้ตอนคุยกับคนต่างประเทศและตอนส่งให้ AI จับคู่
  blurb     text,                     -- หนึ่งบรรทัดว่าหัวข้อนี้คืออะไร — กันหน้าเปล่าในวันแรก
  -- universal = แนวคิดนี้มีอยู่ในหลักสูตรทั่วโลก · false = ไปได้ไกลสุดแค่ในประเทศ
  universal boolean not null default true,
  grades    text[] not null default '{}',   -- ระดับชั้นที่มักเจอ · ว่าง = ทุกชั้น
  aliases   text[] not null default '{}',   -- คำที่คนพิมพ์จริงเวลาค้น (ทั้งไทยและอังกฤษ)
  sort      int not null default 100
);

create index if not exists topics_subject_idx on public.topics (subject, sort);
create index if not exists topics_alias_idx   on public.topics using gin (aliases);

alter table public.topics enable row level security;

drop policy if exists "read topics" on public.topics;
create policy "read topics" on public.topics for select to authenticated using (true);
-- เขียนได้เฉพาะ service role (ไม่มี policy สำหรับ insert/update = ปิดสนิทฝั่งเบราว์เซอร์)

-- ============================================================
-- 2 · เธรดใต้หัวข้อ
-- ------------------------------------------------------------
-- lang เก็บภาษาต้นฉบับเสมอ และ **ไม่เคยเก็บทับด้วยคำแปล** — คำแปลอยู่ใน topic_tr
-- ถ้าเก็บทับ วันที่โมเดลแปลผิดจะไม่มีทางกู้ข้อความจริงกลับมาได้เลย
-- ============================================================
create table if not exists public.topic_threads (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null references public.topics(id) on delete cascade,
  author      uuid not null references auth.users(id) on delete cascade,
  body        text not null check (length(body) between 1 and 1000),
  lang        text not null default 'th' check (lang ~ '^[a-z][a-z]$'),
  country     text not null default 'TH',
  image       text,                    -- path ใน bucket 'posts' · ใช้ bucket เดิม ไม่ตั้งใหม่
  anon        boolean not null default false,
  solved      boolean not null default false,
  hidden      boolean not null default false,
  reply_count integer not null default 0,
  created_at  timestamptz not null default now(),
  last_at     timestamptz not null default now()
);

create index if not exists topic_threads_topic_idx on public.topic_threads (topic, last_at desc);
create index if not exists topic_threads_quiet_idx on public.topic_threads (reply_count, created_at);

alter table public.topic_threads enable row level security;

create table if not exists public.topic_msgs (
  id         bigint generated always as identity primary key,
  thread     uuid not null references public.topic_threads(id) on delete cascade,
  author     uuid references auth.users(id) on delete cascade,   -- null = น้องไซ
  body       text not null check (length(body) between 1 and 2000),
  lang       text not null default 'th' check (lang ~ '^[a-z][a-z]$'),
  is_ai      boolean not null default false,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists topic_msgs_thread_idx on public.topic_msgs (thread, created_at);

alter table public.topic_msgs enable row level security;

-- ---------- เห็นเธรดนี้ได้ไหม ----------
-- กติกาเดียว เขียนที่เดียว เหมือน can_see_post
create or replace function public.can_see_topic(p_topic text, p_country text)
returns boolean
language sql stable security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.topics t
     where t.id = p_topic
       and (t.universal
            or p_country = coalesce((select country from public.profiles where id = auth.uid()), 'TH'))
  );
$fn$;

revoke all on function public.can_see_topic(text, text) from public, anon;
grant execute on function public.can_see_topic(text, text) to authenticated;

drop policy if exists "read topic threads" on public.topic_threads;
create policy "read topic threads" on public.topic_threads
  for select to authenticated
  using (not hidden and public.can_see_topic(topic, country));

drop policy if exists "read topic msgs" on public.topic_msgs;
create policy "read topic msgs" on public.topic_msgs
  for select to authenticated
  using (not hidden and exists (
    select 1 from public.topic_threads th
     where th.id = thread and not th.hidden and public.can_see_topic(th.topic, th.country)
  ));

-- เขียนผ่าน RPC เท่านั้น · ไม่มี insert policy = ฝั่งเบราว์เซอร์เขียนตรงไม่ได้เลย
-- (บทเรียนเดิม: กติกากระจายไปหลาย policy = วันที่แก้จะแก้ไม่ครบ)

-- ============================================================
-- 3 · แคชคำแปล
-- ------------------------------------------------------------
-- คีย์คือ md5 ของข้อความต้นฉบับ + ภาษาปลายทาง · แปลครั้งเดียวใช้ได้ทั้งประเทศนั้น
-- ตารางนี้ไม่มี policy เลย = อ่าน/เขียนได้เฉพาะ service role (Edge Function)
-- ฝั่งแอปไม่เคยแตะโดยตรง มันขอคำแปลจาก Edge Function แล้วได้ข้อความกลับมาอย่างเดียว
-- ============================================================
create table if not exists public.topic_tr (
  src_hash text not null,
  lang     text not null check (lang ~ '^[a-z][a-z]$'),
  body     text not null,
  made_at  timestamptz not null default now(),
  primary key (src_hash, lang)
);

alter table public.topic_tr enable row level security;

-- ============================================================
-- 4 · หาหัวข้อ
-- ------------------------------------------------------------
-- topic_pick คือทางสำรองที่ทำงานโดยไม่ต้องมี AI เลย — จับคำจาก aliases ตรง ๆ
-- มีไว้เพราะ Edge Function อาจยังไม่ได้ตั้ง secret และฟีเจอร์ที่เงียบสนิท
-- คือฟีเจอร์ที่ไม่มีอยู่ (บทเรียนเดียวกับ hwNoRoom ใน hw.js)
-- ============================================================
create or replace function public.topic_find(p_q text, p_limit int default 12)
returns table (id text, subject text, name text, name_en text, blurb text,
               universal boolean, threads bigint)
language sql stable security definer set search_path = public
as $fn$
  with q as (select lower(btrim(coalesce(p_q, ''))) as t)
  select t.id, t.subject, t.name, t.name_en, t.blurb, t.universal,
         (select count(*) from public.topic_threads th
           where th.topic = t.id and not th.hidden)
    from public.topics t cross join q
   where auth.uid() is not null
     and length(q.t) >= 2
     and (lower(t.name) like '%' || q.t || '%'
          or lower(coalesce(t.name_en, '')) like '%' || q.t || '%'
          or exists (select 1 from unnest(t.aliases) a where lower(a) like '%' || q.t || '%'))
   order by (lower(t.name) = q.t) desc, t.sort, t.name
   limit greatest(1, least(p_limit, 30));
$fn$;

create or replace function public.topic_pick(p_subject text, p_title text default null,
                                             p_limit int default 6)
returns table (id text, subject text, name text, blurb text, universal boolean, hits int)
language sql stable security definer set search_path = public
as $fn$
  with src as (
    select lower(coalesce(p_title, '') || ' ' || coalesce(p_subject, '')) as t,
           lower(btrim(coalesce(p_subject, ''))) as s
  )
  select t.id, t.subject, t.name, t.blurb, t.universal,
         (select count(*)::int from unnest(t.aliases) a
           where length(a) >= 3 and position(lower(a) in src.t) > 0)
    from public.topics t cross join src
   where auth.uid() is not null
     and (src.s = '' or lower(t.subject) = src.s)
   order by (select count(*) from unnest(t.aliases) a
              where length(a) >= 3 and position(lower(a) in src.t) > 0) desc,
            t.sort, t.name
   limit greatest(1, least(p_limit, 20));
$fn$;

revoke all on function public.topic_find(text, int)        from public, anon;
revoke all on function public.topic_pick(text, text, int)  from public, anon;
grant execute on function public.topic_find(text, int)       to authenticated;
grant execute on function public.topic_pick(text, text, int) to authenticated;

-- ============================================================
-- 5 · หน้าหัวข้อ — หัวข้อ + เธรดล่าสุด ในคำสั่งเดียว
-- ------------------------------------------------------------
-- คืนเป็น jsonb ก้อนเดียวด้วยเหตุผลเดียวกับ hw_open: สองคำสั่งแปลว่าสองสถานะ
-- ที่มาถึงคนละเวลา แล้วจอจะกระพริบระหว่างรออันที่สอง
--
-- **การจัดลำดับคือหัวใจของชั้นนี้** ฟีดเรียงตามเวลา แต่หน้าหัวข้อเรียงตาม
-- "อันไหนช่วยได้จริง" — เธรดที่มีคำตอบแล้วขึ้นก่อนเธรดที่ยังไม่มีใครตอบ
-- เพราะคนที่เพิ่งเปิดหัวข้อนี้มาคือคนที่ยังไม่เข้าใจ เขาต้องการคำตอบ ไม่ใช่คำถามของคนอื่น
-- (ยกเว้นเธรดของตัวเองซึ่งขึ้นบนสุดเสมอ · คนต้องเห็นของที่ตัวเองเพิ่งถามไป)
--
-- ---------- คนประเทศเดียวกันขึ้นก่อน ----------
-- ผู้ใช้สั่งเองเมื่อ 8 ก.ย. 2569: "ต้องเอาคนประเทศเดียวกันรู้จักกันสิ"
-- ซึ่งถูก และเป็นข้อที่ฟอรัมระดับโลกส่วนใหญ่ทำพลาด — พอเปิดกว้างแล้วปล่อยให้เรียงตามเวลา
-- คนไทยจะจมอยู่ในทะเลคนต่างชาติ แล้วชั้นโลกก็ไม่ได้ทำให้คนในประเทศรู้จักกันเพิ่มขึ้นเลย
-- ทั้งที่คนที่นั่งห่างกันสิบกิโลเมตรช่วยกันได้ง่ายกว่าคนคนละทวีปเสมอ
--
-- ลำดับจึงเป็น: ของฉัน → คนประเทศเดียวกัน → มีคำตอบแล้ว → ล่าสุด
-- โลกยังอยู่ครบ ไม่มีใครถูกกันออก แค่คนใกล้ตัวได้เจอกันก่อน
-- ============================================================
create or replace function public.topic_open(p_topic text, p_limit int default 30)
returns jsonb
language sql stable security definer set search_path = public
as $fn$
  select case when t.id is null then null else jsonb_build_object(
    'id', t.id, 'subject', t.subject, 'name', t.name, 'name_en', t.name_en,
    'blurb', t.blurb, 'universal', t.universal,
    'threads', coalesce((
      select jsonb_agg(x order by x->>'mine' desc, x->>'near' desc,
                                 (x->>'answers')::int > 0 desc,
                                 x->>'last_at' desc)
        from (
          select jsonb_build_object(
            'id', th.id,
            'body', th.body,
            'lang', th.lang,
            'country', th.country,
            -- ประเทศเดียวกับเราหรือเปล่า · ฝั่งแอปใช้ติดป้าย "ในไทย" ด้วย
            'near', th.country = coalesce(
              (select country from public.profiles where id = auth.uid()), 'TH'),
            'image', th.image,
            'answers', th.reply_count,
            'solved', th.solved,
            'mine', th.author = auth.uid(),
            'name', case when th.anon then null else pr.display_name end,
            'avatar', case when th.anon then null else pr.avatar end,
            'at', th.created_at,
            'last_at', th.last_at
          ) as x
            from public.topic_threads th
            left join public.profiles pr on pr.id = th.author
           -- ใช้ p_topic ไม่ใช่ t.id โดยตั้งใจ — สอง select ซ้อนที่มีตารางย่อยใน from
           -- อ้างคอลัมน์ของ query ชั้นนอกไม่ได้ถ้าไม่ประกาศ lateral · พารามิเตอร์ของฟังก์ชัน
           -- อ้างได้เสมอทุกชั้น และค่ามันเท่ากับ t.id อยู่แล้วเพราะ where ข้างล่างบังคับไว้
           where th.topic = p_topic and not th.hidden
             and public.can_see_topic(th.topic, th.country)
           order by th.last_at desc
           limit greatest(1, least(p_limit, 60))
        ) s
    ), '[]'::jsonb)
  ) end
  from public.topics t
  where t.id = p_topic and auth.uid() is not null;
$fn$;

create or replace function public.topic_thread(p_thread uuid)
returns jsonb
language sql stable security definer set search_path = public
as $fn$
  select case when th.id is null then null else jsonb_build_object(
    'id', th.id, 'topic', th.topic, 'body', th.body, 'lang', th.lang,
    'country', th.country, 'image', th.image, 'solved', th.solved,
    'mine', th.author = auth.uid(),
    'name', case when th.anon then null else pr.display_name end,
    'avatar', case when th.anon then null else pr.avatar end,
    'at', th.created_at,
    'topic_name', (select name from public.topics where id = th.topic),
    'msgs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'body', m.body, 'lang', m.lang, 'ai', m.is_ai,
               'mine', m.author = auth.uid(),
               'name', case when m.is_ai then 'น้องไซ' else mp.display_name end,
               'avatar', case when m.is_ai then null else mp.avatar end,
               'at', m.created_at)
             order by m.created_at)
        from public.topic_msgs m
        left join public.profiles mp on mp.id = m.author
       where m.thread = th.id and not m.hidden
    ), '[]'::jsonb)
  ) end
  from public.topic_threads th
  left join public.profiles pr on pr.id = th.author
  where th.id = p_thread and not th.hidden
    and auth.uid() is not null
    and public.can_see_topic(th.topic, th.country);
$fn$;

revoke all on function public.topic_open(text, int)  from public, anon;
revoke all on function public.topic_thread(uuid)     from public, anon;
grant execute on function public.topic_open(text, int) to authenticated;
grant execute on function public.topic_thread(uuid)    to authenticated;

-- ============================================================
-- 6 · ถาม / ตอบ
-- ============================================================
create or replace function public.topic_ask(p_topic text, p_body text,
                                            p_lang text default 'th',
                                            p_image text default null,
                                            p_anon boolean default false)
returns uuid
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_c  text;
  v_id uuid;
  v_n  int;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if not exists (select 1 from public.topics where id = p_topic) then
    raise exception 'ไม่พบหัวข้อนี้';
  end if;
  if length(btrim(coalesce(p_body, ''))) < 2 then raise exception 'เขียนคำถามสักบรรทัดก่อน'; end if;

  -- เพดานกันสแปม — ถามได้ 20 เธรดต่อวัน · คนที่ถามจริงไม่มีทางถึงเพดานนี้
  select count(*) into v_n from public.topic_threads
   where author = v_me and created_at > now() - interval '24 hours';
  if v_n >= 20 then raise exception 'วันนี้ถามครบโควตาแล้ว ลองพรุ่งนี้'; end if;

  select coalesce(country, 'TH') into v_c from public.profiles where id = v_me;

  insert into public.topic_threads (topic, author, body, lang, country, image, anon)
  values (p_topic, v_me, btrim(p_body), coalesce(nullif(lower(p_lang), ''), 'th'),
          coalesce(v_c, 'TH'), p_image, coalesce(p_anon, false))
  returning id into v_id;

  return v_id;
end;
$fn$;

create or replace function public.topic_say(p_thread uuid, p_body text, p_lang text default 'th')
returns table (id bigint, created_at timestamptz)
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_th public.topic_threads%rowtype;
  v_id bigint;
  v_at timestamptz;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'ยังไม่ได้พิมพ์อะไร'; end if;

  select * into v_th from public.topic_threads where id = p_thread and not hidden;
  if v_th.id is null then raise exception 'ไม่พบเธรดนี้'; end if;
  if not public.can_see_topic(v_th.topic, v_th.country) then
    raise exception 'หัวข้อนี้ไม่ได้เปิดให้ประเทศของคุณ';
  end if;

  insert into public.topic_msgs (thread, author, body, lang)
  values (p_thread, v_me, btrim(p_body), coalesce(nullif(lower(p_lang), ''), 'th'))
  returning topic_msgs.id, topic_msgs.created_at into v_id, v_at;

  update public.topic_threads
     set reply_count = reply_count + 1, last_at = now()
   where id = p_thread;

  return query select v_id, v_at;
end;
$fn$;

-- เจ้าของเธรดกดว่า "อันนี้แหละที่ช่วยได้" — ตัวเดียวที่บอกได้ว่าคำตอบไหนใช้ได้จริง
create or replace function public.topic_solved(p_thread uuid, p_on boolean default true)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  update public.topic_threads set solved = coalesce(p_on, true)
   where id = p_thread and author = auth.uid();
  if not found then raise exception 'ทำได้เฉพาะเธรดของตัวเอง'; end if;
end;
$fn$;

revoke all on function public.topic_ask(text, text, text, text, boolean) from public, anon;
revoke all on function public.topic_say(uuid, text, text)                from public, anon;
revoke all on function public.topic_solved(uuid, boolean)                from public, anon;
grant execute on function public.topic_ask(text, text, text, text, boolean) to authenticated;
grant execute on function public.topic_say(uuid, text, text)                to authenticated;
grant execute on function public.topic_solved(uuid, boolean)                to authenticated;

-- ---------- ข้อความใหม่เด้งเข้าเครื่องเอง ----------
-- ไม่ใส่บรรทัดนี้ = ฝั่งแอป subscribe ได้โดยไม่ error แต่ไม่มีอะไรวิ่งมาสักครั้ง
-- ซึ่งอ่านเหมือน "เน็ตช้า" มากกว่า "ลืมเปิด" (บทเรียนเดียวกับ dm_messages)
do $$
begin
  alter publication supabase_realtime add table public.topic_msgs;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 7 · เธรดที่เงียบ — สำหรับให้น้องไซเข้าไปตอบ
-- ------------------------------------------------------------
-- ชั้นโลกก็ว่างเปล่าในวันแรกเหมือนกัน · การเปลี่ยนกุญแจไม่ได้เสกคนมาให้
-- ฟังก์ชันสองตัวนี้เรียกได้เฉพาะ service role (ไม่ grant ให้ authenticated)
-- คู่กับ Edge Function ที่รันด้วย cron ทุก 5 นาที
-- ============================================================
create or replace function public.topic_quiet(p_minutes int default 10, p_limit int default 5)
returns table (id uuid, topic text, topic_name text, body text, lang text)
language sql stable security definer set search_path = public
as $fn$
  select th.id, th.topic, t.name, th.body, th.lang
    from public.topic_threads th
    join public.topics t on t.id = th.topic
   where th.reply_count = 0
     and not th.hidden
     and th.created_at < now() - make_interval(mins => greatest(1, p_minutes))
     and th.created_at > now() - interval '2 days'
   order by th.created_at
   limit greatest(1, least(p_limit, 20));
$fn$;

create or replace function public.topic_say_ai(p_thread uuid, p_body text, p_lang text default 'th')
returns bigint
language plpgsql security definer set search_path = public
as $fn$
declare v_id bigint;
begin
  insert into public.topic_msgs (thread, author, body, lang, is_ai)
  values (p_thread, null, btrim(p_body), coalesce(nullif(lower(p_lang), ''), 'th'), true)
  returning id into v_id;
  update public.topic_threads set reply_count = reply_count + 1, last_at = now()
   where id = p_thread;
  return v_id;
end;
$fn$;

revoke all on function public.topic_quiet(int, int)         from public, anon, authenticated;
revoke all on function public.topic_say_ai(uuid, text, text) from public, anon, authenticated;

-- ============================================================
-- 7ก · "มีคนตอบคำถามที่คุณถามไว้"
-- ------------------------------------------------------------
-- ผู้ใช้บอกว่าสิ่งที่ครูอยากได้คือ "ช่วยให้นักเรียนไม่ลืม แล้วมีแจ้งเตือน แค่นั้นแหละ"
-- ข้อนั้นใช้กับชั้นนี้ตรง ๆ: คนถามตอนตีหนึ่ง แล้วคำตอบมาถึงตอนบ่ายสาม
-- ถ้าไม่มีอะไรบอก เขาไม่มีทางรู้ และคำตอบที่ดีที่สุดในแอปจะไม่เคยถูกอ่าน
--
-- เก็บเป็น "เวลาที่เปิดดูล่าสุด" ช่องเดียว ไม่ใช่ตารางสถานะอ่าน/ยังไม่อ่านรายข้อความ
-- เพราะตารางแบบนั้นโตเท่าจำนวนข้อความคูณจำนวนคน และตอบคำถามเดียวที่เราต้องการอยู่แล้ว
-- ได้ไม่ต่างกันเลย: "มีอะไรใหม่ในเธรดของฉันไหม"
alter table public.profiles add column if not exists topic_seen_at timestamptz;

create or replace function public.topic_news()
returns table (id uuid, topic text, topic_name text, body text, answers int, last_at timestamptz)
language sql stable security definer set search_path = public
as $fn$
  select th.id, th.topic, t.name, th.body, th.reply_count, th.last_at
    from public.topic_threads th
    join public.topics t on t.id = th.topic
   where th.author = auth.uid()
     and not th.hidden
     and th.reply_count > 0
     and th.last_at > coalesce(
           (select topic_seen_at from public.profiles where id = auth.uid()),
           now() - interval '30 days')
   order by th.last_at desc
   limit 20;
$fn$;

create or replace function public.topic_seen()
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if auth.uid() is null then return; end if;
  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
  update public.profiles set topic_seen_at = now() where id = auth.uid();
end;
$fn$;

revoke all on function public.topic_news() from public, anon;
revoke all on function public.topic_seen() from public, anon;
grant execute on function public.topic_news() to authenticated;
grant execute on function public.topic_seen() to authenticated;

-- ============================================================
-- 8 · เติมหัวข้อไว้ล่วงหน้า
-- ------------------------------------------------------------
-- ชุดตั้งต้นจากหลักสูตรแกนกลาง ม.ปลาย · **ต้องมีอยู่ก่อนเปิดให้ใครใช้**
-- ผู้ใช้คนแรกที่ถ่ายรูปเข้ามาต้องเจอหน้าที่มีชื่อและคำอธิบายอยู่แล้ว
-- ไม่ใช่หน้าที่เขียนว่า "ยังไม่มีใครถามเรื่องนี้" ซึ่งอ่านเหมือนแอปพัง
--
-- วิธีเพิ่มหัวข้อทีหลัง: insert เพิ่มในไฟล์ migration ใหม่ · อย่าให้ผู้ใช้สร้างหัวข้อเอง
-- เพราะหัวข้อที่ใครสร้างก็ได้จะแตกเป็นสิบชื่อของเรื่องเดียวกันภายในสัปดาห์เดียว
-- ซึ่งทำลายเหตุผลทั้งหมดของการมีกราฟหัวข้อตั้งแต่แรก
-- ============================================================
insert into public.topics (id, subject, name, name_en, blurb, universal, grades, aliases, sort) values
-- ---------- คณิตศาสตร์ ----------
('math.quad.solve','คณิตศาสตร์','สมการกำลังสอง','Quadratic equations','แก้ ax²+bx+c=0 ด้วยการแยกตัวประกอบ สูตร หรือกำลังสองสมบูรณ์',true,'{ม.ต้น,ม.ปลาย}','{กำลังสอง,ควอดราติก,quadratic,แยกตัวประกอบ,ดิสคริมิแนนต์,discriminant,พาราโบลา}',10),
('math.func.basic','คณิตศาสตร์','ฟังก์ชันและกราฟ','Functions and graphs','โดเมน เรนจ์ การเลื่อนกราฟ และฟังก์ชันผกผัน',true,'{ม.ปลาย}','{ฟังก์ชัน,โดเมน,เรนจ์,กราฟ,function,domain,range,อินเวอร์ส}',20),
('math.exp.log','คณิตศาสตร์','เลขยกกำลังและลอการิทึม','Exponents and logarithms','กฎเลขยกกำลัง การเปลี่ยนฐาน และสมการลอการิทึม',true,'{ม.ปลาย}','{ลอการิทึม,log,เลขยกกำลัง,exponent,logarithm,เปลี่ยนฐาน}',30),
('math.trig.ratio','คณิตศาสตร์','ตรีโกณมิติ','Trigonometry','sin cos tan วงกลมหนึ่งหน่วย เอกลักษณ์ และสมการตรีโกณ',true,'{ม.ปลาย}','{ตรีโกณ,sin,cos,tan,trigonometry,วงกลมหนึ่งหน่วย,เอกลักษณ์}',40),
('math.seq.series','คณิตศาสตร์','ลำดับและอนุกรม','Sequences and series','เลขคณิต เรขาคณิต ผลบวก n พจน์ และอนุกรมอนันต์',true,'{ม.ปลาย}','{ลำดับ,อนุกรม,เลขคณิต,เรขาคณิต,sequence,series,ผลบวก}',50),
('math.prob.count','คณิตศาสตร์','ความน่าจะเป็นและการนับ','Probability and counting','กฎการนับ เรียงสับเปลี่ยน จัดหมู่ และความน่าจะเป็น',true,'{ม.ปลาย}','{ความน่าจะเป็น,probability,เรียงสับเปลี่ยน,จัดหมู่,permutation,combination,การนับ}',60),
('math.calc.limit','คณิตศาสตร์','ลิมิตและความต่อเนื่อง','Limits and continuity','หาลิมิต รูปแบบไม่กำหนด และความต่อเนื่องของฟังก์ชัน',true,'{ม.ปลาย}','{ลิมิต,limit,ต่อเนื่อง,continuity,0/0}',70),
('math.calc.diff','คณิตศาสตร์','อนุพันธ์','Derivatives','กฎลูกโซ่ ผลคูณ ผลหาร และการหาค่าสูงสุดต่ำสุด',true,'{ม.ปลาย}','{อนุพันธ์,ดิฟ,derivative,กฎลูกโซ่,chain rule,สูงสุดต่ำสุด,maximum}',80),
('math.calc.int','คณิตศาสตร์','ปริพันธ์','Integrals','อินทิเกรตไม่จำกัดเขต จำกัดเขต และพื้นที่ใต้กราฟ',true,'{ม.ปลาย}','{ปริพันธ์,อินทิเกรต,integral,พื้นที่ใต้กราฟ,substitution}',90),
('math.vector.3d','คณิตศาสตร์','เวกเตอร์','Vectors','ผลคูณเชิงสเกลาร์ เชิงเวกเตอร์ และการใช้ในสามมิติ',true,'{ม.ปลาย}','{เวกเตอร์,vector,dot product,cross product,ผลคูณ}',100),
('math.matrix.basic','คณิตศาสตร์','เมทริกซ์','Matrices','การคูณเมทริกซ์ ดีเทอร์มิแนนต์ และการแก้ระบบสมการ',true,'{ม.ปลาย}','{เมทริกซ์,matrix,ดีเทอร์มิแนนต์,determinant,อินเวอร์ส}',110),
('math.stat.basic','คณิตศาสตร์','สถิติ','Statistics','ค่ากลาง การกระจาย และการแปลความหมายข้อมูล',true,'{ม.ปลาย}','{สถิติ,statistics,ค่าเฉลี่ย,มัธยฐาน,ฐานนิยม,ส่วนเบี่ยงเบน,mean,median}',120),
-- ---------- ฟิสิกส์ ----------
('phys.kinematics','ฟิสิกส์','การเคลื่อนที่แนวตรง','Kinematics','ความเร็ว ความเร่ง และสมการการเคลื่อนที่สี่สมการ',true,'{ม.ปลาย}','{การเคลื่อนที่,kinematics,ความเร่ง,ความเร็ว,ตกอิสระ,suvat}',10),
('phys.newton','ฟิสิกส์','กฎการเคลื่อนที่ของนิวตัน','Newton laws','แรงลัพธ์ แผนภาพวัตถุอิสระ และแรงเสียดทาน',true,'{ม.ปลาย}','{นิวตัน,newton,แรง,free body,แรงเสียดทาน,friction,f=ma}',20),
('phys.energy','ฟิสิกส์','งานและพลังงาน','Work and energy','งาน พลังงานจลน์ ศักย์ และการอนุรักษ์พลังงาน',true,'{ม.ปลาย}','{งาน,พลังงาน,energy,จลน์,ศักย์,อนุรักษ์พลังงาน,work}',30),
('phys.momentum','ฟิสิกส์','โมเมนตัมและการชน','Momentum and collisions','การชนแบบยืดหยุ่นและไม่ยืดหยุ่น การอนุรักษ์โมเมนตัม',true,'{ม.ปลาย}','{โมเมนตัม,momentum,การชน,collision,impulse,การดล}',40),
('phys.circular','ฟิสิกส์','การเคลื่อนที่แบบวงกลม','Circular motion','แรงสู่ศูนย์กลาง คาบ และการเคลื่อนที่บนทางโค้ง',true,'{ม.ปลาย}','{วงกลม,circular,สู่ศูนย์กลาง,centripetal,คาบ}',50),
('phys.wave','ฟิสิกส์','คลื่น','Waves','การสะท้อน หักเห แทรกสอด และเลี้ยวเบน',true,'{ม.ปลาย}','{คลื่น,wave,แทรกสอด,เลี้ยวเบน,หักเห,interference,diffraction}',60),
('phys.elec.circuit','ฟิสิกส์','ไฟฟ้ากระแส','Electric circuits','กฎของโอห์ม วงจรอนุกรมขนาน และกฎของเคอร์ชอฟฟ์',true,'{ม.ปลาย}','{ไฟฟ้า,วงจร,โอห์ม,ohm,circuit,อนุกรม,ขนาน,เคอร์ชอฟฟ์}',70),
('phys.elec.field','ฟิสิกส์','ไฟฟ้าสถิต','Electrostatics','กฎคูลอมบ์ สนามไฟฟ้า และศักย์ไฟฟ้า',true,'{ม.ปลาย}','{ไฟฟ้าสถิต,คูลอมบ์,coulomb,สนามไฟฟ้า,ศักย์ไฟฟ้า}',80),
('phys.modern','ฟิสิกส์','ฟิสิกส์อะตอมและนิวเคลียร์','Atomic and nuclear physics','แบบจำลองอะตอม โฟตอน และการสลายตัวกัมมันตรังสี',true,'{ม.ปลาย}','{อะตอม,นิวเคลียร์,กัมมันตรังสี,โฟตอน,photon,ครึ่งชีวิต}',90),
-- ---------- เคมี ----------
('chem.stoich','เคมี','ปริมาณสารสัมพันธ์','Stoichiometry','โมล มวลโมเลกุล และการดุลสมการเคมี',true,'{ม.ปลาย}','{ปริมาณสารสัมพันธ์,stoichiometry,โมล,mole,ดุลสมการ,มวลโมเลกุล}',10),
('chem.atom','เคมี','โครงสร้างอะตอม','Atomic structure','การจัดเรียงอิเล็กตรอน เลขควอนตัม และตารางธาตุ',true,'{ม.ปลาย}','{อะตอม,อิเล็กตรอน,ตารางธาตุ,ควอนตัม,orbital,การจัดเรียง}',20),
('chem.bond','เคมี','พันธะเคมี','Chemical bonding','พันธะไอออนิก โคเวเลนต์ โลหะ และรูปร่างโมเลกุล',true,'{ม.ปลาย}','{พันธะ,bond,ไอออนิก,โคเวเลนต์,รูปร่างโมเลกุล,vsepr}',30),
('chem.gas','เคมี','แก๊ส','Gases','กฎของแก๊สและสมการแก๊สอุดมคติ',true,'{ม.ปลาย}','{แก๊ส,gas,บอยล์,ชาร์ล,อุดมคติ,pv=nrt}',40),
('chem.rate','เคมี','อัตราการเกิดปฏิกิริยา','Reaction rates','ปัจจัยที่มีผลต่ออัตรา และพลังงานก่อกัมมันต์',true,'{ม.ปลาย}','{อัตราการเกิดปฏิกิริยา,rate,พลังงานก่อกัมมันต์,ตัวเร่ง,catalyst}',50),
('chem.equilib','เคมี','สมดุลเคมี','Chemical equilibrium','ค่าคงที่สมดุลและหลักของเลอชาเตอลิเอ',true,'{ม.ปลาย}','{สมดุล,equilibrium,เลอชาเตอลิเอ,le chatelier,ค่าคงที่สมดุล}',60),
('chem.acid','เคมี','กรด-เบส','Acids and bases','pH การไทเทรต และสารละลายบัฟเฟอร์',true,'{ม.ปลาย}','{กรด,เบส,ph,ไทเทรต,titration,บัฟเฟอร์,buffer}',70),
('chem.redox','เคมี','ไฟฟ้าเคมี','Electrochemistry','เลขออกซิเดชัน เซลล์กัลวานิก และการชุบโลหะ',true,'{ม.ปลาย}','{ไฟฟ้าเคมี,redox,ออกซิเดชัน,กัลวานิก,ชุบโลหะ}',80),
('chem.organic','เคมี','เคมีอินทรีย์','Organic chemistry','หมู่ฟังก์ชัน การเรียกชื่อ และปฏิกิริยาพื้นฐาน',true,'{ม.ปลาย}','{อินทรีย์,organic,หมู่ฟังก์ชัน,แอลเคน,เรียกชื่อ,iupac}',90),
-- ---------- ชีววิทยา ----------
('bio.cell','ชีววิทยา','เซลล์และการลำเลียง','Cells and transport','ออร์แกเนลล์ ออสโมซิส และการลำเลียงผ่านเยื่อ',true,'{ม.ปลาย}','{เซลล์,cell,ออร์แกเนลล์,ออสโมซิส,osmosis,ลำเลียง,เยื่อหุ้มเซลล์}',10),
('bio.division','ชีววิทยา','การแบ่งเซลล์','Cell division','ไมโทซิสและไมโอซิส ระยะและความต่าง',true,'{ม.ปลาย}','{แบ่งเซลล์,ไมโทซิส,ไมโอซิส,mitosis,meiosis,โครโมโซม}',20),
('bio.genetics','ชีววิทยา','พันธุศาสตร์','Genetics','กฎเมนเดล ตารางพันเนตต์ และการถ่ายทอดลักษณะ',true,'{ม.ปลาย}','{พันธุศาสตร์,เมนเดล,mendel,ยีน,gene,พันเนตต์,ลักษณะเด่น}',30),
('bio.dna','ชีววิทยา','ดีเอ็นเอและการสังเคราะห์โปรตีน','DNA and protein synthesis','การจำลอง ถอดรหัส และแปลรหัส',true,'{ม.ปลาย}','{dna,rna,ถอดรหัส,แปลรหัส,transcription,translation,โปรตีน}',40),
('bio.photo','ชีววิทยา','การสังเคราะห์ด้วยแสง','Photosynthesis','ปฏิกิริยาใช้แสงและวัฏจักรคัลวิน',true,'{ม.ปลาย}','{สังเคราะห์ด้วยแสง,photosynthesis,คัลวิน,calvin,คลอโรฟิลล์}',50),
('bio.resp','ชีววิทยา','การหายใจระดับเซลล์','Cellular respiration','ไกลโคลิซิส วัฏจักรเครบส์ และการถ่ายทอดอิเล็กตรอน',true,'{ม.ปลาย}','{หายใจระดับเซลล์,respiration,ไกลโคลิซิส,เครบส์,krebs,atp}',60),
('bio.ecology','ชีววิทยา','ระบบนิเวศ','Ecology','โซ่อาหาร การถ่ายทอดพลังงาน และวัฏจักรสาร',true,'{ม.ปลาย}','{ระบบนิเวศ,ecology,โซ่อาหาร,ห่วงโซ่,วัฏจักร,ประชากร}',70),
-- ---------- วิทยาการคำนวณ ----------
('cs.algo.flow','วิทยาการคำนวณ','ผังงานและรหัสลำลอง','Flowcharts and pseudocode','เขียนขั้นตอนวิธีเป็นผังงาน สัญลักษณ์ และการไล่ตามลำดับ',true,'{ม.ต้น,ม.ปลาย}','{ผังงาน,flowchart,รหัสลำลอง,pseudocode,อัลกอริทึม,algorithm,ชุดคำสั่ง,light bot,lightbot,ขั้นตอนวิธี}',10),
('cs.algo.loop','วิทยาการคำนวณ','การวนซ้ำและเงื่อนไข','Loops and conditionals','if else วนซ้ำแบบนับรอบและแบบมีเงื่อนไข',true,'{ม.ต้น,ม.ปลาย}','{วนซ้ำ,loop,เงื่อนไข,if,else,while,for,ทำซ้ำ}',20),
('cs.py.basic','วิทยาการคำนวณ','ไพทอนเบื้องต้น','Python basics','ตัวแปร ชนิดข้อมูล อินพุตเอาต์พุต และฟังก์ชัน',true,'{ม.ปลาย}','{python,ไพทอน,ตัวแปร,ฟังก์ชัน,input,print,list}',30),
('cs.data.struct','วิทยาการคำนวณ','โครงสร้างข้อมูล','Data structures','อาเรย์ สแตก คิว และการเลือกใช้ให้ถูกงาน',true,'{ม.ปลาย}','{โครงสร้างข้อมูล,array,stack,queue,คิว,สแตก,linked list}',40),
('cs.data.analysis','วิทยาการคำนวณ','การจัดการและวิเคราะห์ข้อมูล','Data handling','เก็บ ทำความสะอาด และนำเสนอข้อมูลด้วยกราฟ',true,'{ม.ปลาย}','{ข้อมูล,data,วิเคราะห์ข้อมูล,กราฟ,spreadsheet,ตาราง}',50),
('cs.net.safety','วิทยาการคำนวณ','การใช้เทคโนโลยีอย่างปลอดภัย','Digital safety','ความเป็นส่วนตัว รหัสผ่าน และการรู้เท่าทันข้อมูล',true,'{ม.ต้น}','{ปลอดภัย,privacy,รหัสผ่าน,ข่าวปลอม,รู้เท่าทัน,digital}',60),
-- ---------- ภาษาอังกฤษ ----------
('eng.tense','ภาษาอังกฤษ','Tense','English tenses','12 tense ใช้เมื่อไหร่ และสัญญาณคำบอกเวลา',true,'{ม.ต้น,ม.ปลาย}','{tense,เทนส์,present perfect,past simple,อดีต,ปัจจุบัน,continuous}',10),
('eng.conditional','ภาษาอังกฤษ','If-clause','Conditionals','เงื่อนไขสี่แบบและการใช้ wish',true,'{ม.ปลาย}','{if clause,conditional,เงื่อนไข,wish,unreal}',20),
('eng.passive','ภาษาอังกฤษ','Passive voice','Passive voice','เปลี่ยนประโยคกรรตุเป็นกรรม และเมื่อไหร่ควรใช้',true,'{ม.ปลาย}','{passive,กรรมวาจก,ถูกกระทำ,by}',30),
('eng.relative','ภาษาอังกฤษ','Relative clause','Relative clauses','who which that และการลดรูป',true,'{ม.ปลาย}','{relative clause,who,which,that,ลดรูป,adjective clause}',40),
('eng.writing','ภาษาอังกฤษ','การเขียนย่อหน้าและเรียงความ','Paragraph and essay writing','โครงย่อหน้า ประโยคใจความ และการเชื่อมความ',true,'{ม.ปลาย}','{essay,เรียงความ,ย่อหน้า,paragraph,topic sentence,linking}',50),
('eng.reading','ภาษาอังกฤษ','การอ่านจับใจความ','Reading comprehension','หาใจความสำคัญ เดาความหมายจากบริบท',true,'{ม.ต้น,ม.ปลาย}','{reading,จับใจความ,main idea,context clue,อ่าน}',60),
-- ---------- วิชาที่หยุดอยู่ในประเทศ ----------
-- universal = false · ตันที่ชั้นประเทศโดยตั้งใจ ดูเหตุผลที่หัวไฟล์ข้อ 1
('thai.lit.classic','ภาษาไทย','วรรณคดีไทย','Thai literature','เรื่องย่อ ตัวละคร และคุณค่าของวรรณคดีในหลักสูตร',false,'{ม.ปลาย}','{วรรณคดี,ลิลิต,อิเหนา,ขุนช้างขุนแผน,มัทนะพาธา,สามก๊ก,กาพย์,โคลง}',10),
('thai.gram.basic','ภาษาไทย','หลักภาษาไทย','Thai grammar','ชนิดของคำ ประโยค และการใช้คำให้ถูกต้อง',false,'{ม.ต้น,ม.ปลาย}','{หลักภาษา,ชนิดของคำ,ประโยค,คำราชาศัพท์,คำสมาส,สนธิ}',20),
('thai.write.essay','ภาษาไทย','การเขียนเรียงความและย่อความ','Thai composition','โครงเรื่อง การย่อความ และการเขียนเชิงอธิบาย',false,'{ม.ต้น,ม.ปลาย}','{เรียงความ,ย่อความ,เขียน,โครงเรื่อง,บทความ}',30),
('soc.hist.thai','สังคมศึกษา','ประวัติศาสตร์ไทย','Thai history','สุโขทัย อยุธยา ธนบุรี รัตนโกสินทร์ และการเปลี่ยนแปลง',false,'{ม.ต้น,ม.ปลาย}','{ประวัติศาสตร์,สุโขทัย,อยุธยา,ธนบุรี,รัตนโกสินทร์,2475}',10),
('soc.civic','สังคมศึกษา','หน้าที่พลเมืองและกฎหมาย','Civics and law','สิทธิ หน้าที่ และกฎหมายที่เกี่ยวกับชีวิตประจำวัน',false,'{ม.ปลาย}','{หน้าที่พลเมือง,กฎหมาย,สิทธิ,รัฐธรรมนูญ,ประชาธิปไตย}',20),
('soc.buddhism','สังคมศึกษา','พระพุทธศาสนา','Buddhism','หลักธรรม พุทธประวัติ และการนำไปใช้',false,'{ม.ต้น,ม.ปลาย}','{พระพุทธศาสนา,หลักธรรม,อริยสัจ,ไตรลักษณ์,พุทธประวัติ}',30),
('soc.econ','สังคมศึกษา','เศรษฐศาสตร์','Economics','อุปสงค์ อุปทาน และเศรษฐกิจพอเพียง',false,'{ม.ปลาย}','{เศรษฐศาสตร์,อุปสงค์,อุปทาน,demand,supply,เศรษฐกิจพอเพียง}',40),
('soc.geo','สังคมศึกษา','ภูมิศาสตร์','Geography','แผนที่ ภูมิประเทศ และปฏิสัมพันธ์กับสิ่งแวดล้อม',false,'{ม.ต้น,ม.ปลาย}','{ภูมิศาสตร์,แผนที่,ภูมิประเทศ,ภูมิอากาศ,สิ่งแวดล้อม}',50)
on conflict (id) do update set
  subject = excluded.subject, name = excluded.name, name_en = excluded.name_en,
  blurb = excluded.blurb, universal = excluded.universal,
  grades = excluded.grades, aliases = excluded.aliases, sort = excluded.sort;


-- ############################################################
-- # 22 · ปุ่มรายงานครบทุกจอ   (20260908090400_report_surfaces.sql)
-- ############################################################

-- ============================================================
-- 22 · ปุ่มรายงานต้องอยู่ในทุกจอที่มีคนแปลกหน้า
-- ------------------------------------------------------------
-- migration 13 สร้างระบบรายงานตอนที่แอปมีแค่สองที่ให้รายงาน — โพสต์กับคำตอบใต้โพสต์
-- และตอนนั้นทุกคนที่เห็นกันอยู่ห้องเรียนเดียวกัน จึงพอ
--
-- ตอนนี้ไม่พอแล้ว หลัง migration 19 (ทักกันได้ทุกคน) และ 20 (หัวข้อทั่วโลก)
-- มีอีกสามที่ที่คนที่ไม่รู้จักกันเจอกันได้ และทั้งสามที่ยังไม่มีทางร้องเรียน:
--   ห้องแชทตัวต่อตัว · เธรดในหัวข้อ · คำตอบในเธรด
--
-- **จอที่ลืมใส่ปุ่มรายงาน คือจอที่คนโดนกวนแล้วไม่มีอะไรทำได้นอกจากปิดแอปทิ้ง**
-- และเราจะไม่มีวันรู้ว่าเสียเขาไปเพราะอะไร
-- ============================================================

alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind in ('post', 'reply', 'user', 'topic', 'tmsg'));

-- ============================================================
-- เกณฑ์ซ่อนอัตโนมัติ — ขยายให้ครอบคลุมของใหม่
-- ------------------------------------------------------------
-- กติกาเดิมยังเหมือนเดิมทุกข้อ: สามคน **ที่ต่างกัน** ไม่ใช่สามครั้ง
-- ซ่อนก่อนแล้วค่อยให้คนตรวจ ดีกว่าปล่อยไว้จนกว่าจะมีคนว่างมาตรวจ
-- เพราะเวลาที่เนื้อหาแย่ค้างอยู่บนจอ คือเวลาที่มันทำร้ายคนได้จริง
--
-- **'user' ไม่มีการซ่อนอัตโนมัติ** โดยตั้งใจ — การรายงานคนไม่ใช่การรายงานข้อความ
-- ระงับบัญชีอัตโนมัติจากคำร้องสามใบคือเครื่องมือกลั่นแกล้งที่สมบูรณ์แบบ
-- (นัดกันสามคนก็ปิดปากใครก็ได้) คำร้องประเภทนี้ต้องมีคนอ่านเสมอ
-- คนที่ถูกกวนมีเครื่องมือที่ได้ผลทันทีอยู่แล้วคือปุ่มบล็อก ซึ่งไม่ต้องรอใคร
-- ============================================================
create or replace function public.apply_report_threshold()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare
  n int;
begin
  select count(distinct reporter) into n
    from public.reports where kind = new.kind and target = new.target;

  if n >= 3 then
    if new.kind = 'post' then
      update public.posts set hidden = true where id = new.target::uuid;
    elsif new.kind = 'reply' then
      update public.post_replies set hidden = true where id = new.target::bigint;
    elsif new.kind = 'topic' then
      update public.topic_threads set hidden = true where id = new.target::uuid;
    elsif new.kind = 'tmsg' then
      update public.topic_msgs set hidden = true where id = new.target::bigint;
    end if;
    -- 'user' ตกมาถึงตรงนี้แล้วไม่ทำอะไร · ตั้งใจ ดูเหตุผลข้างบน
  end if;
  return new;
end;
$fn$;

drop trigger if exists reports_threshold on public.reports;
create trigger reports_threshold after insert on public.reports
  for each row execute function public.apply_report_threshold();

-- ============================================================
-- ซ่อนแล้วต้องหายจากทุกทางที่อ่านได้
-- ------------------------------------------------------------
-- บทเรียนเดิมจาก migration 13 ที่ต้องใช้ซ้ำกับตารางใหม่:
-- ซ่อนแล้วแต่ยังโผล่อยู่ทางใดทางหนึ่ง = ไม่ได้ซ่อน
--
-- topic_threads / topic_msgs กรอง hidden ไว้แล้วทั้งใน policy และใน
-- topic_open / topic_thread ตั้งแต่ migration 20 · เหลือ topic_quiet ตัวเดียว
-- ที่ต้องกันไม่ให้น้องไซเดินเข้าไปตอบเธรดที่เพิ่งถูกซ่อน — ซึ่งจะกลายเป็น
-- คำตอบของ AI ค้างอยู่ใต้เนื้อหาที่ถูกรายงาน และไม่มีใครเห็นว่าเกิดขึ้น
-- (ตัวเดิมกรอง not th.hidden อยู่แล้ว เขียนซ้ำที่นี่เพื่อยืนยันว่าตรวจแล้ว
--  ไม่ใช่เพราะของเดิมผิด — ถ้าวันหลังมีใครแก้ ให้เห็นเหตุผลตรงนี้ด้วย)
-- ============================================================
create or replace function public.topic_quiet(p_minutes int default 10, p_limit int default 5)
returns table (id uuid, topic text, topic_name text, body text, lang text)
language sql stable security definer set search_path = public
as $fn$
  select th.id, th.topic, t.name, th.body, th.lang
    from public.topic_threads th
    join public.topics t on t.id = th.topic
   where th.reply_count = 0
     and not th.hidden
     and th.created_at < now() - make_interval(mins => greatest(1, p_minutes))
     and th.created_at > now() - interval '2 days'
     -- คนที่ถูกบล็อกโดยเจ้าของเธรดไม่เกี่ยวตรงนี้ (น้องไซไม่ใช่ผู้ใช้)
     -- แต่บัญชีที่โดนรายงานหนักจนเธรดถูกซ่อน ต้องไม่ได้รับความสนใจเพิ่ม
   order by th.created_at
   limit greatest(1, least(p_limit, 20));
$fn$;

revoke all on function public.topic_quiet(int, int) from public, anon, authenticated;
