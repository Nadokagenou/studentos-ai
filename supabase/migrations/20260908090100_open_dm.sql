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
