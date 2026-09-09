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
