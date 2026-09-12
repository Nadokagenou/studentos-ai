-- ============================================================
-- 28 · ไล่เก็บเนื้อหาที่หลุดการตรวจไป
-- ------------------------------------------------------------
-- migration 27 ต่อสายตัวกรองไว้ฝั่งแอป ซึ่งแปลว่ามันดีได้เท่าที่แอปยังเปิดอยู่เท่านั้น
-- มีสองทางที่เนื้อหาหลุดการตรวจไปได้ และทั้งสองทางไม่ใช่เรื่องหายาก:
--
--   1) **ปิดแท็บทันทีหลังกดส่ง** — การสแกนข้อความเป็นแบบยิงแล้วไม่รอผล
--      ตามกติกาที่ตกลงกันไว้ (ข้อความต้องขึ้นทันที ไม่งั้นคนย้ายไปคุยที่อื่น)
--      แต่ "ไม่รอผล" แปลว่าถ้าหน้าเว็บตายก่อน คำขอนั้นก็ตายไปด้วย
--      และคนที่ตั้งใจส่งของแย่ ๆ คือคนที่มีแรงจูงใจจะปิดแท็บที่สุด
--
--   2) **ตัวกรองล่มตอนนั้นพอดี** — ตอนนี้มันบันทึกเป็น verdict='review'
--      แล้ว**ไม่มีใครกลับมาดูอีกเลย** ซึ่งเท่ากับไม่ได้ตรวจ แต่ดูเหมือนตรวจแล้ว
--      ในบันทึก ซึ่งแย่กว่าไม่มีบันทึกเพราะมันหลอกคนอ่านรายงาน
--
-- ฟังก์ชันนี้คือรายการ "ของที่ยังไม่มีใครตัดสิน" ให้ guard-sweep มาหยิบไปทำ
-- service_role เท่านั้นที่เรียกได้ เพราะมันอ่านเนื้อหาข้ามห้องข้ามคนทั้งระบบ
-- ============================================================

create or replace function public.mod_pending(p_minutes int default 120,
                                              p_limit int default 40)
returns table (kind text, target text, author uuid, body text, made_at timestamptz)
language sql security definer set search_path = public
as $fn$
  -- **ชื่อคอลัมน์ทุกตัวในนี้ต้องไม่ชนกับชื่อ OUT ของฟังก์ชัน** (kind target author body)
  -- ฟังก์ชันที่ returns table สร้างตัวแปร OUT ตามชื่อคอลัมน์ที่ประกาศไว้
  -- แล้วชื่อเปล่า ๆ ในตัวคิวรีจะกำกวมจนล้มตอนรัน — pglast ตรวจไม่เจอเพราะเป็นปัญหาตอนรัน
  -- (บทเรียนจาก migration 24) จึงใช้ k / tg / au / bd / at ทั้งหมด
  with cutoff as (
    select now() - make_interval(mins => greatest(p_minutes, 1)) as ts
  ),
  seen as (
    -- ตัดสินแล้วจริง ๆ นับเฉพาะ ok กับ block
    -- review แปลว่า "ตรวจไม่สำเร็จ" ซึ่งคือยังไม่ได้ตรวจ ต้องกลับมาเก็บ
    select l.kind as k, l.target as tg
      from public.mod_log l
     where l.verdict in ('ok', 'block') and l.target is not null
  ),
  rows_all as (
    select 'post'::text as k, p.id::text as tg, p.author as au,
           p.body as bd, p.created_at as at
      from public.posts p
     where p.created_at > (select ts from cutoff) and not p.hidden
    union all
    select 'reply', r.id::text, r.author, r.body, r.created_at
      from public.post_replies r
     where r.created_at > (select ts from cutoff) and not r.hidden
    union all
    select 'dm', dm.id::text, dm.sender, dm.body, dm.created_at
      from public.dm_messages dm
     where dm.created_at > (select ts from cutoff) and not dm.hidden
    union all
    select 'tthread', tt.id::text, tt.author, tt.body, tt.created_at
      from public.topic_threads tt
     where tt.created_at > (select ts from cutoff) and not tt.hidden
    union all
    select 'tmsg', tm.id::text, tm.author, tm.body, tm.created_at
      from public.topic_msgs tm
     where tm.created_at > (select ts from cutoff)
       and not tm.hidden
       and not tm.is_ai          -- ของน้องไซไม่ต้องตรวจ เราเป็นคนเขียนกติกาให้มันเอง
  )
  select a.k, a.tg, a.au, a.bd, a.at
    from rows_all a
   where btrim(coalesce(a.bd, '')) <> ''
     and not exists (select 1 from seen s where s.k = a.k and s.tg = a.tg)
   order by a.at
   limit greatest(p_limit, 1);
$fn$;

revoke all on function public.mod_pending(int, int) from public, anon, authenticated;
grant execute on function public.mod_pending(int, int) to service_role;

-- ---------- ของที่รอตรวจนานเกินไปคือสัญญาณว่าอะไรพัง ----------
-- ตัวเลขชุดเดียวที่ตอบได้ว่าชั้นกรองยังมีชีวิตอยู่ไหม
-- pending ที่โตขึ้นเรื่อย ๆ หรือ oldest_wait_min ที่พุ่ง = sweep ไม่ทำงาน
-- หรือโควตาหมดจนตรวจอะไรไม่ได้เลย ซึ่งทั้งสองอย่างเงียบมากถ้าไม่มีตัวเลขนี้
create or replace function public.mod_health()
returns table (pending int, oldest_wait_min int, reviews_24h int, blocks_24h int)
language sql security definer set search_path = public
as $fn$
  with q as (select * from public.mod_pending(1440, 1000))
  select (select count(*)::int from q),
         coalesce((select (extract(epoch from (now() - min(q2.made_at))) / 60)::int
                     from q q2), 0),
         (select count(*)::int from public.mod_log l
           where l.verdict = 'review' and l.created_at > now() - interval '24 hours'),
         (select count(*)::int from public.mod_log l
           where l.verdict = 'block' and l.created_at > now() - interval '24 hours');
$fn$;

revoke all on function public.mod_health() from public, anon, authenticated;
grant execute on function public.mod_health() to service_role;

-- ============================================================
-- นาฬิกา
-- ------------------------------------------------------------
-- ⚠️ ต้อง deploy ฟังก์ชันก่อนรันไฟล์นี้ ไม่งั้น cron ยิงไปที่ 404 ทุก 10 นาที
--       supabase functions deploy guard-sweep
--
-- ทุก 10 นาที ไม่ถี่กว่านี้โดยตั้งใจ: ของที่ sweep ต้องเก็บคือของที่หลุดการตรวจสด
-- ซึ่งควรเป็นส่วนน้อย · ยิงถี่แปลว่าเผาโควตา Gemini ที่ตอนนี้ตึงอยู่แล้ว
-- ไปกับการถามซ้ำว่า "มีอะไรให้ทำไหม" มากกว่าการตรวจของจริง
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'studentos-guard-sweep') then
    perform cron.unschedule('studentos-guard-sweep');
  end if;
end $$;

select cron.schedule(
  'studentos-guard-sweep',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://yunbytxtgghizrdqftvj.supabase.co/functions/v1/guard-sweep',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_GCXZU_uLAlv3yuGxu5cOrw_YU4UCWXY"}'::jsonb
  );
  $$
);

-- ============================================================
-- ตรวจว่ามันยิงจริง — "ตั้งแล้ว" ไม่เท่ากับ "ทำงาน" (กับดักเดิมจาก migration 05/21)
--   select status, return_message, start_time
--     from cron.job_run_details where jobid =
--       (select jobid from cron.job where jobname = 'studentos-guard-sweep')
--     order by start_time desc limit 5;
--
-- และดูสุขภาพของชั้นกรองทั้งชั้นด้วย:
--   select * from public.mod_health();
-- pending ที่โตขึ้นเรื่อย ๆ = sweep ไม่ทำงาน หรือโควตาหมดจนตรวจอะไรไม่ได้
-- ============================================================
