-- ============================================================
-- board() รอบสอง — ทุกคนที่ตั้งโปรไฟล์แล้วขึ้นกระดานเอง (ซ่อนตัวได้)
-- ------------------------------------------------------------
-- รอบแรก (20261009120000_board.sql) ให้ "กดเข้าร่วมเอง" เพราะจอยินยอมของชั้นเพื่อนสัญญาว่า
-- เพื่อนไม่เห็นสถิติ · ปล่อยจริงแล้วเจ้าของเปิดดูเจอแต่ตัวเองที่อันดับ 1 คนเดียว ("ไม่เห็นคนอื่นเลย")
-- เจ้าของเลือก (9 ต.ค. 69): "โชว์ทุกคนพร้อมชื่อเลย" · ขอบเขต "คนที่ตั้งโปรไฟล์แล้ว"
-- (ตอนนั้นมีข้อมูลงาน 20 คน · มีโปรไฟล์ 15 · ผ่านจอยินยอม 7)
--
-- เปลี่ยนสามอย่าง:
--   1) ไม่ต้องกดเข้าร่วม — ขึ้นเองทุกคน · ออกได้ด้วย settings.boardHide = true (ปุ่มท้ายจอกระดาน)
--      ซ่อนแล้วหายจากทั้งกระดานหลักและกระดานเพื่อน
--   2) กระดานหลักไม่ต้องผ่านจอยินยอมแล้ว — แค่มีแถวใน profiles (ตั้งชื่อแล้ว)
--      คนที่ไม่เคยตั้งชื่อไม่ขึ้น ไม่งั้นกระดานเต็มไปด้วยแถว "ไม่มีชื่อ"
--   3) อายุต่ำกว่า 15 ยังไม่ขึ้นกระดานหลักเหมือนเดิม (กฎเดิมจำกัดเขาไว้ในห้องตัวเอง)
--      ส่วนคนที่ไม่เคยตอบอายุ (age_band ว่าง) ขึ้นได้
--
-- จอยินยอม (safety.js) กับหน้านโยบาย (privacy.html) แก้ข้อความตามในรุ่นเดียวกัน
-- คืน 'hidden' แทน 'joined' · การกันโกงและการคิดคะแนนเหมือนเดิมทุกตัว
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
        or (coalesce(s.data->'settings'->>'boardHide', '') <> 'true'
            and not public.is_blocked(v_me, s.id)
            and (
              (v_scope = 'friends' and exists (
                 select 1 from public.friendships f
                  where f.status = 'accepted'
                    and f.a = least(v_me, s.id) and f.b = greatest(v_me, s.id)))
              or (v_scope = 'all' and exists (
                 select 1 from public.profiles p
                  where p.id = s.id
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
    'hidden', (select coalesce(data->'settings'->>'boardHide', '') = 'true' from pool where id = v_me),
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
