-- ============================================================
-- board() — กระดานอันดับ "ใครทำงานเสร็จมากที่สุด"
-- ------------------------------------------------------------
-- เจ้าของสั่ง (9 ต.ค. 69): "ทำเหมือนในเกม" + ภาพอ้างอิงที่มีแท่นสามอันดับ · กระดานหลัก/กระดานเพื่อน
-- · ซีซันละสามเดือน · นับถอยหลัง · รางวัลท้ายซีซัน
--
-- ไม่สร้างตารางใหม่ — งานที่ติ๊กเสร็จอยู่ใน user_state.data->'tasks' ครบแล้ว (ดู admin_analytics)
-- ตัวเลขจึงย้อนหลังได้ทันทีตั้งแต่ต้นซีซัน และไม่มีทางที่สองตัวเลขจะเพี้ยนจากกัน
--
-- นับอะไร: งานที่ done = true · ไม่อยู่ในถังขยะ · doneAt อยู่ในซีซัน (เวลาไทย)
-- กันโกงสองชั้น:
--   1) งานที่สร้างแล้วติ๊กเสร็จภายใน 5 นาทีไม่นับ — ไม่งั้นพิมพ์ "ก" แล้วติ๊กห้าสิบรอบก็ได้ที่หนึ่ง
--      งานที่ไม่มี createdAt (มาจากกล่องเข้า/ซิงก์) นับได้ เพราะต้องมีต้นทางจริงถึงจะเข้ามาได้
--   2) วันละไม่เกิน 20 ใบ — คนที่ทำจริงไม่ถึง ส่วนคนที่ถึงคือคนที่กำลังปั๊มตัวเลข
--
-- ใครอยู่ในกระดาน — **ต้องกดเข้าร่วมเองเท่านั้น** (settings.boardJoin = true):
--   จอยินยอมก่อนเข้าชั้นเพื่อน (safety.js) สัญญาไว้ว่า "เพื่อนไม่เห็นงาน สถิติ คะแนนของคุณ"
--   และ "ไม่มีคนแปลกหน้าค้นเจอคุณได้" — กระดานที่ดึงทุกคนขึ้นเองจะผิดสัญญาทั้งสองข้อทันที
--   'all'     เข้าร่วมแล้ว · ผ่านจอยินยอมแล้ว (agreed_at) · อายุ 15 ขึ้นไป · ไม่ได้บล็อกกันกับเรา
--             (ต่ำกว่า 15 ถูกจำกัดให้อยู่ในห้องตัวเองอยู่แล้ว — กระดานทั้งแอปจึงไม่ใช่ที่ของเขา)
--   'friends' เพื่อนที่ตอบรับกันแล้ว และเข้าร่วมกระดานแล้ว (ทุกช่วงอายุ)
--   ตัวเราเองอยู่เสมอ แม้ยังไม่เข้าร่วม — เห็นได้ว่าถ้าเข้าร่วมจะอยู่ตรงไหน แต่คนอื่นไม่เห็นเรา
--
-- ความเป็นส่วนตัว (ผู้ใช้ส่วนใหญ่อายุไม่ถึง 18):
--   คืนเฉพาะชื่อที่ตั้งเอง · @ชื่อผู้ใช้ · รูปโปรไฟล์ที่ตั้งให้คนอื่นเห็นอยู่แล้ว · จำนวนงาน · วันติดกัน
--   ไม่มีชื่องาน วิชา หรือรายละเอียดอะไรของงานออกไปเลย
--   เข้าร่วม/ออกได้ทุกเมื่อที่ปุ่มบนจอกระดาน
--
-- ราคา: ไล่งานของทุกคนในแอปทุกครั้งที่เปิดกระดานหลัก — ตอนนี้คนยังหลักร้อย ไม่มีปัญหา
-- ถ้าวันหนึ่งช้า ให้ทำตารางสรุปรายวันด้วย cron แทน ไม่ใช่ตัดเกณฑ์กันโกงออก
-- ============================================================

create or replace function public.board(p_scope text default 'all', p_season text default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz      constant text := 'Asia/Bangkok';
  v_me    uuid := auth.uid();
  v_today date := (now() at time zone tz)::date;
  v_q0    date;
  v_q1    date;
  v_t0    timestamptz;
  v_t1    timestamptz;
  v_key   text;
  v_scope text := case when p_scope = 'friends' then 'friends' else 'all' end;
  result  json;
begin
  if v_me is null then return null; end if;

  -- ซีซัน = ไตรมาส (ม.ค.–มี.ค. · เม.ย.–มิ.ย. · ก.ค.–ก.ย. · ต.ค.–ธ.ค.) ตามเวลาไทย
  -- ส่งรหัสซีซันเก่ามาได้ ('2026-Q3') — แอปใช้ดูอันดับตอนจบซีซันเพื่อแจกรางวัล
  if p_season ~ '^\d{4}-Q[1-4]$' then
    v_q0 := make_date(substr(p_season, 1, 4)::int, (substr(p_season, 7, 1)::int - 1) * 3 + 1, 1);
  else
    v_q0 := date_trunc('quarter', v_today)::date;
  end if;
  v_q1  := (v_q0 + interval '3 months')::date;
  v_key := to_char(v_q0, 'YYYY') || '-Q' || to_char(v_q0, 'Q');
  v_t0  := v_q0::timestamp at time zone tz;
  v_t1  := v_q1::timestamp at time zone tz;

  with
  pool as (
    select s.id, s.data
      from public.user_state s
     where s.id = v_me
        or (coalesce(s.data->'settings'->>'boardJoin', '') = 'true'
            and not public.is_blocked(v_me, s.id)
            and (
              (v_scope = 'friends' and exists (
                 select 1 from public.friendships f
                  where f.status = 'accepted'
                    and f.a = least(v_me, s.id) and f.b = greatest(v_me, s.id)))
              or (v_scope = 'all' and exists (
                 select 1 from public.profiles p
                  where p.id = s.id and p.agreed_at is not null
                    and coalesce(p.age_band, '') <> 'under'))))
  ),
  t as (
    select pool.id as uid,
           public._sos_ts(x->>'doneAt') as done_at,
           public._sos_ts(x->>'createdAt') as created_at
      from pool,
           jsonb_array_elements(case when jsonb_typeof(pool.data->'tasks') = 'array'
                                     then pool.data->'tasks' else '[]'::jsonb end) x
     where jsonb_typeof(x) = 'object'
       and x->'done' = 'true'::jsonb
       and not coalesce(x->'deleted' = 'true'::jsonb, false)
  ),
  -- นาฬิกาเครื่องผู้ใช้เดินเร็วได้ — เผื่อสิบนาที แต่งานที่ "เสร็จในอนาคต" ไกลกว่านั้นไม่นับ
  fin as (
    select uid, done_at, created_at from t
     where done_at is not null and done_at <= now() + interval '10 minutes'
  ),
  perday as (
    select uid, (done_at at time zone tz)::date as day, least(count(*), 20) as n
      from fin
     where done_at >= v_t0 and done_at < v_t1
       and (created_at is null or done_at - created_at >= interval '5 minutes')
     group by uid, (done_at at time zone tz)::date
  ),
  score as (select uid, sum(n)::int as n from perday group by uid),
  -- วันติดกันที่มีงานเสร็จ จบที่วันนี้หรือเมื่อวาน (วันนี้ยังไม่ได้ทำ ไม่ถือว่าขาด)
  days as (select distinct uid, (done_at at time zone tz)::date as d from fin),
  isl as (select uid, d, d - (row_number() over (partition by uid order by d))::int as g from days),
  runs as (select uid, max(d) as last_d, count(*)::int as len from isl group by uid, g),
  streak as (select uid, max(len) as n from runs where last_d >= v_today - 1 group by uid),
  ranked as (
    select pool.id,
           coalesce(score.n, 0) as n,
           coalesce(streak.n, 0) as streak,
           rank() over (order by coalesce(score.n, 0) desc) as rk,
           row_number() over (order by coalesce(score.n, 0) desc, coalesce(streak.n, 0) desc, pool.id) as pos
      from pool
      left join score on score.uid = pool.id
      left join streak on streak.uid = pool.id
     where coalesce(score.n, 0) > 0 or pool.id = v_me
  ),
  mine as (select * from ranked where id = v_me),
  -- 30 อันดับแรก + สองคนเหนือและใต้เรา (ถ้าเราอยู่ต่ำกว่านั้น) — กระดานทั้งแอปไม่ต้องลากลงมาทั้งก้อน
  shown as (
    -- exists ไม่ใช่ join กับ mine — คนที่ยังไม่เคยซิงก์ไม่มีแถวของตัวเอง แล้ว join จะได้กระดานเปล่า
    select r.* from ranked r
     where r.pos <= 30 or exists (select 1 from mine m where abs(r.pos - m.pos) <= 2)
  )
  select json_build_object(
    'season', json_build_object('key', v_key, 'start', v_q0, 'end', v_q1),
    'scope', v_scope,
    'total', (select count(*) from ranked),
    'joined', (select coalesce(data->'settings'->>'boardJoin', '') = 'true' from pool where id = v_me),
    'me', (select json_build_object('rank', rk, 'pos', pos, 'n', n, 'streak', streak) from mine),
    'rows', coalesce((
      select json_agg(json_build_object(
               'rank', s.rk, 'pos', s.pos, 'id', s.id, 'me', s.id = v_me,
               'name', p.display_name, 'handle', p.handle, 'avatar', p.avatar,
               'n', s.n, 'streak', s.streak)
             order by s.pos)
        from shown s
        left join public.profiles p on p.id = s.id
    ), '[]'::json)
  ) into result;

  return result;
end;
$$;

revoke all on function public.board(text, text) from public, anon;
grant execute on function public.board(text, text) to authenticated;
