-- ============================================================
-- 24 · บั๊ก — ส่งข้อความไม่ได้ "column reference id is ambiguous"
-- ------------------------------------------------------------
-- ผู้ใช้เจอจริงเมื่อ 10 ก.ย. 2569: พิมพ์ในห้องแชทแล้วขึ้น "ส่งไม่สำเร็จ"
--
-- ต้นเหตุ: ทั้ง dm_say และ topic_say ประกาศว่า
--     returns table (id bigint, created_at timestamptz)
-- ซึ่งใน plpgsql เท่ากับสร้าง **ตัวแปร OUT ชื่อ id** ขึ้นมาในขอบเขตของฟังก์ชัน
-- หลังจากนั้น คำว่า `id` เปล่า ๆ ทุกที่ในตัวฟังก์ชันจะกำกวมทันที ระหว่าง
-- คอลัมน์ของตาราง กับ ตัวแปรตัวนั้น · ค่าปริยายของ plpgsql.variable_conflict
-- คือ error จึงล้มตั้งแต่คำสั่งแรกที่แตะคำว่า id
--
-- ตอนเขียน migration 19 ผมกันจุดนี้ไว้แล้วที่ `insert ... returning` (qualify เป็น
-- dm_messages.id) แต่ **ลืมว่า select กับ update บรรทัดก่อนหน้าก็ชนแบบเดียวกัน**
-- ซึ่งเป็นจุดที่ล้มก่อนด้วยซ้ำ — บทเรียนคือ qualify ที่เดียวไม่พอ
-- ต้อง qualify **ทุกที่** เมื่อชื่อคอลัมน์ไปตรงกับชื่อที่ประกาศใน returns table
--
-- ทำไมไม่แก้ด้วยการเปลี่ยนชื่อคอลัมน์ที่คืนออกไป (เช่น msg_id): เพราะฝั่งแอปอ่าน
-- row.id กับ row.created_at อยู่ ถ้าเปลี่ยนชื่อต้องปล่อยเว็บใหม่พร้อมกันเป๊ะ
-- ไม่งั้นช่วงกลางระหว่างสองอย่างจะพังอีกแบบหนึ่ง · qualify ปลอดภัยกว่าและแก้ที่เดียวจบ
--
-- ทำไมไม่ใช้ #variable_conflict use_column: มันแก้ทั้งฟังก์ชันแบบเงียบ ๆ
-- วันหลังใครเพิ่มตัวแปรที่ชื่อชนคอลัมน์จะได้พฤติกรรมผิดโดยไม่มี error บอก
-- การเขียนชื่อตารางนำหน้าให้ครบอ่านออกด้วยตาว่าหมายถึงอะไร
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

  -- dm_threads.id ไม่ใช่ id เปล่า ๆ — ดูเหตุผลที่หัวไฟล์
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
      -- ปลายทางพิมพ์ = ตอบรับ
      update public.dm_threads t set state = 'open', req_at = null where t.id = p_thread;
    end if;
  end if;

  insert into public.dm_messages (thread, sender, body)
  values (p_thread, v_me, btrim(p_body))
  returning dm_messages.id, dm_messages.created_at into v_id, v_at;

  return query select v_id, v_at;
end;
$fn$;

revoke all on function public.dm_say(uuid, text) from public, anon;
grant execute on function public.dm_say(uuid, text) to authenticated;

-- ---------- ทรงเดียวกันเป๊ะ ----------
-- ถ้าไม่แก้พร้อมกัน การตอบในเธรดหัวข้อจะพังด้วยข้อความ error เดียวกัน
-- และจะไม่มีใครเจอจนกว่าจะมีคนแรกลองตอบ ซึ่งอาจเป็นอีกหลายวัน
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

  select * into v_th from public.topic_threads th
   where th.id = p_thread and not th.hidden;
  if v_th.id is null then raise exception 'ไม่พบเธรดนี้'; end if;
  if not public.can_see_topic(v_th.topic, v_th.country) then
    raise exception 'หัวข้อนี้ไม่ได้เปิดให้ประเทศของคุณ';
  end if;

  insert into public.topic_msgs (thread, author, body, lang)
  values (p_thread, v_me, btrim(p_body), coalesce(nullif(lower(p_lang), ''), 'th'))
  returning topic_msgs.id, topic_msgs.created_at into v_id, v_at;

  update public.topic_threads th
     set reply_count = th.reply_count + 1, last_at = now()
   where th.id = p_thread;

  return query select v_id, v_at;
end;
$fn$;

revoke all on function public.topic_say(uuid, text, text) from public, anon;
grant execute on function public.topic_say(uuid, text, text) to authenticated;
