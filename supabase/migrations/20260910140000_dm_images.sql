-- ============================================================
-- 25 · ส่งรูปในแชทได้
-- ------------------------------------------------------------
-- ผู้ใช้ขอเอง (10 ก.ย. 2569): "สามารถส่งไฟล์ รูป หรืออิโมจิได้"
-- อิโมจิไม่ต้องแก้อะไรฝั่งนี้ (มันคือตัวอักษรธรรมดา) เหลือแค่รูป
--
-- ใช้ bucket 'posts' เดิม ไม่ตั้งใหม่ — path แยกด้วยโฟลเดอร์ dm/<uid>/
-- ตั้ง bucket ใหม่แปลว่าต้องตั้ง policy ใหม่ทั้งชุด และมีที่ให้ลืมเพิ่มอีกที่หนึ่ง
--
-- **ทำไมข้อความยังต้องมีความยาวได้ถึง 0:** ส่งรูปเปล่า ๆ โดยไม่พิมพ์อะไรเป็นเรื่องปกติมาก
-- แต่ของเดิม check บังคับ length(body) between 1 and 2000 ซึ่งจะปฏิเสธทันที
-- จึงเปลี่ยนเป็น "ต้องมีอย่างน้อยหนึ่งอย่าง: ข้อความ หรือ รูป"
-- แถวที่ไม่มีทั้งสองอย่างคือแถวที่ไม่มีความหมาย และเป็นช่องให้ยิงแถวเปล่าใส่ห้องคนอื่น
-- ============================================================

alter table public.dm_messages add column if not exists image text;

alter table public.dm_messages drop constraint if exists dm_messages_body_check;
alter table public.dm_messages add constraint dm_messages_body_check
  check (length(body) <= 2000 and (length(btrim(body)) > 0 or image is not null));

-- ---------- ประตูเดิม รับรูปเพิ่มหนึ่งช่อง ----------
-- ค่าปริยายของ p_image เป็น null ทำให้โค้ดเก่าที่เรียกด้วยสองพารามิเตอร์ยังทำงานได้
-- ระหว่างที่หน้าเว็บกับฐานข้อมูลยังปล่อยไม่พร้อมกัน (บทเรียนจาก 1B61a)
create or replace function public.dm_say(p_thread uuid, p_body text, p_image text default null)
returns table (id bigint, created_at timestamptz)
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_t  public.dm_threads%rowtype;
  v_n  int;
  v_id bigint;
  v_at timestamptz;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if length(v_body) = 0 and p_image is null then raise exception 'ยังไม่ได้พิมพ์อะไร'; end if;
  if length(v_body) > 2000 then raise exception 'ข้อความยาวเกินไป'; end if;

  -- ชื่อคอลัมน์ต้องมีชื่อตารางนำหน้าเสมอในฟังก์ชันที่ returns table (id ...)
  -- ไม่งั้น id เปล่า ๆ จะกำกวมกับตัวแปร OUT แล้วล้มตอนรัน (บทเรียนจาก migration 24)
  select * into v_t from public.dm_threads t where t.id = p_thread;
  if v_t.id is null then raise exception 'ไม่พบห้องนี้'; end if;
  if v_me not in (v_t.a, v_t.b) then raise exception 'ไม่ได้อยู่ในห้องนี้'; end if;
  if public.is_blocked(v_t.a, v_t.b) then raise exception 'ส่งข้อความไม่ได้'; end if;

  if v_t.state = 'pending' then
    if v_t.opener = v_me then
      select count(*) into v_n from public.dm_messages m
       where m.thread = p_thread and m.sender = v_me;
      if v_n >= 1 then
        raise exception 'ส่งได้ข้อความเดียวจนกว่าอีกฝ่ายจะตอบ';
      end if;
    else
      update public.dm_threads t set state = 'open', req_at = null where t.id = p_thread;
    end if;
  end if;

  insert into public.dm_messages (thread, sender, body, image)
  values (p_thread, v_me, v_body, p_image)
  returning dm_messages.id, dm_messages.created_at into v_id, v_at;

  return query select v_id, v_at;
end;
$fn$;

revoke all on function public.dm_say(uuid, text, text) from public, anon;
grant execute on function public.dm_say(uuid, text, text) to authenticated;

-- ---------- กล่องข้อความอ่านออกว่ามีรูป ----------
-- แถวที่ส่งรูปเปล่า ๆ จะขึ้นว่า "ยังไม่มีข้อความ" ถ้าไม่แก้ตรงนี้
-- ซึ่งอ่านเหมือนห้องว่างทั้งที่เพิ่งมีคนส่งรูปมา
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
         case when coalesce(btrim(m.body), '') <> '' then m.body
              when m.image is not null then 'ส่งรูปมา'
              else null end,
         t.last_at
    from public.dm_threads t
    join public.profiles p
      on p.id = case when t.a = auth.uid() then t.b else t.a end
    left join lateral (
      select body, sender, image from public.dm_messages
       where thread = t.id order by created_at desc limit 1
    ) m on true
   where (t.a = auth.uid() or t.b = auth.uid())
     and not public.is_blocked(t.a, t.b)
     and not (t.state = 'pending' and t.opener = auth.uid())
   order by (t.state = 'pending') desc, t.last_at desc
   limit 100;
$fn$;

revoke all on function public.dm_inbox() from public, anon;
grant execute on function public.dm_inbox() to authenticated;
