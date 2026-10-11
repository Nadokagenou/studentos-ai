-- ============================================================
-- board() รอบสาม — กันปั่นงานด้วยนาฬิกาของเซิร์ฟเวอร์
-- ------------------------------------------------------------
-- เจ้าของ (11 ต.ค. 69): "ป้องกันการโกงคนที่ปั่นงานแบบสร้างแล้ว spam มันต้องมีข้อจำกัดอะไรบางอย่าง"
--
-- รูรั่วของรอบสอง: เวลาทุกตัวที่ใช้กันโกง (createdAt · doneAt) เครื่องผู้ใช้เขียนเองใน user_state
--   · แก้ createdAt ย้อนไปเมื่อวานใน localStorage = ผ่านกฎ 5 นาทีทุกใบ
--   · สร้าง "ก" ยี่สิบใบ รอห้านาที ติ๊กรวด = ได้ 20 คะแนนทุกวัน (เพดานเดิม)
--   · ลบใบที่ติ๊กไปแล้วสร้างใหม่ชื่อเดิม = นับซ้ำได้เรื่อย ๆ
--
-- รอบนี้เพิ่มสี่ชั้น (การนับเฉพาะงานที่ "ยังอยู่ · ติ๊กเสร็จ · ไม่อยู่ในถังขยะ" เหมือนเดิม):
--   1) board_seen — สมุดบันทึกฝั่งเซิร์ฟเวอร์ ว่าเห็นงานแต่ละใบครั้งแรกเมื่อไหร่ และเห็นมันเสร็จครั้งแรกเมื่อไหร่
--      เขียนโดย trigger ตอน user_state ถูกเขียน ใช้ now() ของเซิร์ฟเวอร์ — เครื่องผู้ใช้ปลอมไม่ได้
--      กฎ 5 นาที · วันที่นับ · ซีซัน · วันติด ใช้เวลาชุดนี้ทั้งหมด
--      ติ๊กออกแล้วติ๊กใหม่ = ยังเป็นเวลาเสร็จครั้งแรก (ย้ายวันไปหาวันที่ยังไม่เต็มเพดานไม่ได้)
--   2) ชื่องานต้องเป็นชื่อ — ตัดช่องว่าง/เครื่องหมาย/ตัวเลขออกแล้วต้องเหลือตัวอักษรอย่างน้อย 2 ตัว
--      และไม่ใช่ตัวเดียวกันซ้ำทั้งชื่อ ("ก" · "1" · "..." · "กกกก" ไม่นับ)
--   3) วันเดียวกัน วิชาเดียวกัน ชื่อเดียวกัน (ไม่สนตัวเลข) = นับครั้งเดียว
--      "งาน1" ถึง "งาน20" คือใบเดียว · ลบแล้วสร้างใหม่ชื่อเดิมก็คือใบเดิม
--      ราคาที่ยอมจ่าย: "แบบฝึกหัด 3.1" กับ "3.2" วิชาเดียวกันเสร็จวันเดียวกันได้ 1 — ไม่ใช่ 2
--   4) เพดานวันละ 10 ใบ (เดิม 20) — นักเรียนที่ทำจริงหนัก ๆ วันละ 4–6 ใบ
--
-- สิ่งที่ยังกันไม่ได้ (บอกตรง ๆ): คนที่ตั้งใจพิมพ์ชื่องานไม่ซ้ำวันละ 10 ชื่อ รอห้านาทีแล้วติ๊ก
-- ได้เท่าคนที่ทำงานจริงหนักที่สุด แต่ไม่มีทางแซงไปไกลกว่านั้นได้แล้ว
--
-- trigger ห่อด้วย exception ทั้งก้อน — บันทึกพลาดได้ แต่การซิงก์งานของผู้ใช้ต้องไม่พังเพราะกระดาน
-- ============================================================

-- ---------- สมุดบันทึก ----------
-- เก็บแค่รหัสงานกับเวลา ไม่มีชื่องาน วิชา หรือเนื้อหาอะไรเลย
create table if not exists public.board_seen (
  uid      uuid not null references auth.users(id) on delete cascade,
  task_id  text not null,
  first_at timestamptz not null default now(),   -- เซิร์ฟเวอร์เห็นใบนี้ครั้งแรก
  done_at  timestamptz,                           -- เซิร์ฟเวอร์เห็นใบนี้ "เสร็จ" ครั้งแรก
  primary key (uid, task_id)
);
-- ไม่มี policy เลย = client อ่าน/เขียนไม่ได้ · เขียนผ่าน trigger · อ่านผ่าน board() เท่านั้น
alter table public.board_seen enable row level security;
revoke all on public.board_seen from public, anon, authenticated;

-- ---------- เติมของเก่า (ครั้งเดียว) ----------
-- งานที่มีอยู่ก่อนวันนี้ไม่มีใครเห็นตอนเกิด — ใช้เวลาจากเครื่องแทน และคงกฎของรอบสองไว้:
-- ไม่มี createdAt (มาจากกล่องเข้า/ซิงก์) = นับได้ จึงตั้งเวลาเกิดย้อนไว้ก่อนเวลาเสร็จพอดีห้านาที
-- ใบที่ติ๊กเสร็จแต่ไม่มี doneAt หรือ doneAt อยู่ในอนาคตเกินสิบนาที — กฎเดิมไม่เคยนับ จึงต้องไม่นับต่อ
-- ตั้งเวลาเสร็จ = เวลาเกิด (ห่างกัน 0 นาที ไม่ผ่านกฎ 5 นาที) ไม่ใช่ "ตอนนี้"
-- ไม่งั้นงานที่สร้างตั้งแต่ ก.ค. กลายเป็นเสร็จวันที่รัน migration (เจอจริงตอนลองรันแบบยกเลิกทิ้ง: สองบัญชีคะแนนเพิ่มเอง)
-- ต้องไม่ปล่อยเป็น null ด้วย — trigger จะเติม now() ให้ตอนซิงก์รอบหน้าแล้วได้ผลเดียวกัน
insert into public.board_seen (uid, task_id, first_at, done_at)
select uid, tid,
       least(coalesce(c_at, d_at - interval '5 minutes', now()), now()),
       case when done then
         case when d_at is not null and d_at <= now() + interval '10 minutes' then least(d_at, now())
              else least(coalesce(c_at, d_at - interval '5 minutes', now()), now()) end
       end
  from (
    select distinct on (s.id, x->>'id')
           s.id as uid, x->>'id' as tid,
           public._sos_ts(x->>'createdAt') as c_at,
           public._sos_ts(x->>'doneAt') as d_at,
           x->'done' = 'true'::jsonb as done
      from public.user_state s,
           jsonb_array_elements(case when jsonb_typeof(s.data->'tasks') = 'array'
                                     then s.data->'tasks' else '[]'::jsonb end) x
     where jsonb_typeof(x) = 'object'
       and coalesce(x->>'id', '') <> '' and length(x->>'id') <= 80
     order by s.id, x->>'id', (x->'done' = 'true'::jsonb) desc
  ) old
on conflict (uid, task_id) do nothing;

-- ---------- บันทึกทุกครั้งที่ซิงก์ ----------
create or replace function public.board_seen_track()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.board_seen as b (uid, task_id, first_at, done_at)
    -- distinct on: ก้อนเดียวมีรหัสซ้ำได้ (ข้อมูลเก่า/ซิงก์ชนกัน) แล้ว on conflict จะพังทั้งคำสั่ง
    select distinct on (x->>'id')
           new.id, x->>'id', now(),
           case when x->'done' = 'true'::jsonb then now() end
      from jsonb_array_elements(case when jsonb_typeof(new.data->'tasks') = 'array'
                                     then new.data->'tasks' else '[]'::jsonb end) x
     where jsonb_typeof(x) = 'object'
       and coalesce(x->>'id', '') <> '' and length(x->>'id') <= 80
     order by x->>'id', (x->'done' = 'true'::jsonb) desc
    on conflict (uid, task_id) do update set done_at = excluded.done_at
     where b.done_at is null and excluded.done_at is not null;
  exception when others then
    raise warning '[board_seen_track] %', sqlerrm;
  end;
  return null;
end;
$$;
revoke all on function public.board_seen_track() from public, anon, authenticated;

drop trigger if exists user_state_board_seen on public.user_state;
create trigger user_state_board_seen
  after insert or update of data on public.user_state
  for each row execute function public.board_seen_track();

-- ---------- ชื่องานเป็นกุญแจเทียบซ้ำ ----------
-- ตัวพิมพ์เล็ก · ตัดทุกอย่างที่ไม่ใช่ตัวอักษรไทย/อังกฤษ (ช่องว่าง เครื่องหมาย ตัวเลข สระลอย วรรณยุกต์ไม่ตัด)
-- คืน null = ไม่ใช่ชื่อ (สั้นกว่า 2 ตัว หรือเป็นตัวเดียวกันซ้ำทั้งชื่อ)
create or replace function public._board_key(p_title text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(k, '[^ก-ฮa-z]', '', 'g')) < 2 then null
    when k ~ '^(.)\1*$' then null
    else k
  end
  from (select regexp_replace(lower(coalesce(p_title, '')), '[^ก-๎a-z]', '', 'g') as k) z;
$$;

-- ---------- กระดาน ----------
create or replace function public.board(p_scope text default 'all', p_season text default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz      constant text := 'Asia/Bangkok';
  day_cap constant int  := 10;
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
  -- งานที่ยังอยู่และติ๊กเสร็จ (จากก้อนปัจจุบัน) × เวลาที่เซิร์ฟเวอร์จดไว้
  -- ใบที่ยังไม่มีในสมุด = ยังไม่เคยซิงก์ผ่าน trigger → ยังไม่นับ (ซิงก์รอบหน้าก็มี)
  valid as (
    select pool.id as uid,
           bs.done_at,
           (bs.done_at at time zone tz)::date as day,
           coalesce(x->>'subject', '') || '|' ||
             public._board_key(coalesce(x->>'detail', x->>'title', x->>'name')) as k
      from pool
     cross join lateral jsonb_array_elements(case when jsonb_typeof(pool.data->'tasks') = 'array'
                                                  then pool.data->'tasks' else '[]'::jsonb end) x
      join public.board_seen bs on bs.uid = pool.id and bs.task_id = x->>'id'
     where jsonb_typeof(x) = 'object'
       and x->'done' = 'true'::jsonb
       and not coalesce(x->'deleted' = 'true'::jsonb, false)
       and bs.done_at is not null
       and bs.done_at - bs.first_at >= interval '5 minutes'
       and public._board_key(coalesce(x->>'detail', x->>'title', x->>'name')) is not null
  ),
  perday as (
    select uid, day, least(count(distinct k), day_cap) as n
      from valid
     where done_at >= v_t0 and done_at < v_t1
     group by uid, day
  ),
  score as (select uid, sum(n)::int as n from perday group by uid),
  -- วันติดกันที่มีงานเสร็จ (ที่นับได้) จบที่วันนี้หรือเมื่อวาน (วันนี้ยังไม่ได้ทำ ไม่ถือว่าขาด)
  days as (select distinct uid, day as d from valid),
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
