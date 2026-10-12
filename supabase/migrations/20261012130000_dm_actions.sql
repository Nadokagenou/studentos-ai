-- ============================================================
-- dm_actions — ตอบกลับ · แก้ไข · ปักหมุด · ปฏิกิริยา ในแชทตัวต่อตัว
-- ------------------------------------------------------------
-- 12 ต.ค. 69 · เจ้าของส่งภาพเมนูข้อความของ IG (แถบ อิโมจิ / ตอบกลับ / ⋮ และเมนู
-- Edit · Forward · Copy · Translate · Pin · Unsend) แล้วบอกว่า "ใช้ระบบนี้ด้วย"
--
-- สี่อย่างในนี้ต้องมีที่เก็บฝั่งเซิร์ฟเวอร์ — ทำแค่ในเครื่องเดียว = อีกฝ่ายไม่เห็น = โกหก
-- (Forward · Copy · Translate · Unsend ใช้ของที่มีอยู่แล้ว ไม่ต้องรอไฟล์นี้)
--
-- ฝั่งแอป (alt/social.js · chatV2) ลองอ่านคอลัมน์ใหม่ตอนเปิดห้อง — ยังไม่ได้รันไฟล์นี้ = อ่านไม่ผ่าน
-- แล้วแอปซ่อน แก้ไข / ปักหมุด / ตอบกลับ / ปฏิกิริยา ไว้เอง แชทเดิมไม่พังระหว่างรอ
--
--   1 · คอลัมน์ใหม่ใน dm_messages: reply_to · edited_at · pinned_at
--   2 · dm_say รวมเหลือตัวเดียว รับ p_reply เพิ่ม
--   3 · dm_edit — แก้ได้เฉพาะของตัวเอง ภายใน 15 นาที เฉพาะข้อความตัวหนังสือ (แบบ IG)
--   4 · dm_pin — ใครในห้องก็ปัก/เลิกปักได้ (แบบ IG)
--   5 · dm_reactions + dm_react — คนละหนึ่งปฏิกิริยาต่อข้อความ
--
-- ยังไม่ได้รันกับฐานข้อมูลจริง (เขียนตามแบบ migration เดิมของ dm_say / dm_unsend)
-- ============================================================

-- ------------------------------------------------------------
-- 1 · คอลัมน์ใหม่
-- ------------------------------------------------------------
-- reply_to ชี้ข้อความในห้องเดียวกัน · ข้อความต้นทางถูกลบ = เหลือ null (ฝั่งแอปเขียนว่า "ข้อความถูกลบแล้ว")
alter table public.dm_messages add column if not exists reply_to bigint
  references public.dm_messages(id) on delete set null;
alter table public.dm_messages add column if not exists edited_at timestamptz;
alter table public.dm_messages add column if not exists pinned_at timestamptz;

create index if not exists dm_messages_pinned_idx on public.dm_messages (thread, pinned_at)
  where pinned_at is not null;

-- ------------------------------------------------------------
-- 2 · dm_say ตัวเดียว
-- ------------------------------------------------------------
-- ตอนนี้มีสองตัวซ้อนกันอยู่: dm_say(uuid, text) จาก migration 19/24 กับ dm_say(uuid, text, text default null)
-- จาก dm_images · เพิ่ม p_reply เป็นตัวที่สามจะยิ่งกำกวม (เรียกด้วยชื่อพารามิเตอร์ชุดเดียวกันได้หลายตัว
-- แล้ว PostgREST เลือกไม่ได้) จึงทิ้งทั้งคู่แล้วสร้างตัวเดียวที่มีค่าปริยายครบ
-- แอปรุ่นเก่าที่เรียกด้วยสองหรือสามพารามิเตอร์ยังทำงานได้เหมือนเดิม
drop function if exists public.dm_say(uuid, text);
drop function if exists public.dm_say(uuid, text, text);

create or replace function public.dm_say(p_thread uuid, p_body text,
                                         p_image text default null, p_reply bigint default null)
returns table (id bigint, created_at timestamptz)
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me    uuid := auth.uid();
  v_t     public.dm_threads%rowtype;
  v_n     int;
  v_id    bigint;
  v_at    timestamptz;
  v_body  text := btrim(coalesce(p_body, ''));
  v_reply bigint := p_reply;
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

  -- ตอบกลับได้เฉพาะข้อความในห้องเดียวกัน · ต้นทางถูกลบไประหว่างพิมพ์ = ส่งเป็นข้อความธรรมดา ไม่ล้ม
  if v_reply is not null and not exists (
       select 1 from public.dm_messages m where m.id = v_reply and m.thread = p_thread) then
    v_reply := null;
  end if;

  insert into public.dm_messages (thread, sender, body, image, reply_to)
  values (p_thread, v_me, v_body, p_image, v_reply)
  returning dm_messages.id, dm_messages.created_at into v_id, v_at;

  return query select v_id, v_at;
end;
$fn$;

revoke all on function public.dm_say(uuid, text, text, bigint) from public, anon;
grant execute on function public.dm_say(uuid, text, text, bigint) to authenticated;

-- ------------------------------------------------------------
-- 3 · แก้ไขข้อความ
-- ------------------------------------------------------------
-- ของตัวเองเท่านั้น · ภายใน 15 นาทีหลังส่ง (เท่า IG) · เฉพาะข้อความตัวหนังสือล้วน
-- แก้ได้นานไม่จำกัด = เปลี่ยนสิ่งที่อีกฝ่ายตอบไปแล้วย้อนหลังได้ ซึ่งเป็นช่องที่ใช้กลั่นแกล้งกันได้
-- edited_at โชว์เป็น "แก้ไขแล้ว" ใต้ฟอง — อีกฝ่ายต้องรู้เสมอว่าข้อความเคยถูกเปลี่ยน
create or replace function public.dm_edit(p_msg bigint, p_body text)
returns timestamptz
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me   uuid := auth.uid();
  v_m    public.dm_messages%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
  v_at   timestamptz := now();
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if length(v_body) = 0 then raise exception 'ยังไม่ได้พิมพ์อะไร'; end if;
  if length(v_body) > 2000 then raise exception 'ข้อความยาวเกินไป'; end if;
  select * into v_m from public.dm_messages m where m.id = p_msg and m.sender = v_me;
  if v_m.id is null then raise exception 'แก้ได้เฉพาะข้อความของตัวเอง'; end if;
  if v_m.image is not null then raise exception 'ข้อความที่มีรูปแก้ไม่ได้'; end if;
  if v_m.created_at < now() - interval '15 minutes' then
    raise exception 'แก้ได้ภายใน 15 นาทีหลังส่ง';
  end if;
  update public.dm_messages m set body = v_body, edited_at = v_at where m.id = p_msg;
  return v_at;
end;
$fn$;

revoke all on function public.dm_edit(bigint, text) from public, anon;
grant execute on function public.dm_edit(bigint, text) to authenticated;

-- ------------------------------------------------------------
-- 4 · ปักหมุด
-- ------------------------------------------------------------
-- ใครในห้องก็ปัก/เลิกปักได้ (แบบ IG) · ห้องที่บล็อกกันแล้วแตะไม่ได้
create or replace function public.dm_pin(p_msg bigint, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_t  public.dm_threads%rowtype;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  select t.* into v_t from public.dm_threads t
    join public.dm_messages m on m.thread = t.id
   where m.id = p_msg;
  if v_t.id is null then raise exception 'ไม่พบข้อความนี้'; end if;
  if v_me not in (v_t.a, v_t.b) then raise exception 'ไม่ได้อยู่ในห้องนี้'; end if;
  if public.is_blocked(v_t.a, v_t.b) then raise exception 'ทำไม่ได้'; end if;
  update public.dm_messages m
     set pinned_at = case when p_on then now() else null end
   where m.id = p_msg;
end;
$fn$;

revoke all on function public.dm_pin(bigint, boolean) from public, anon;
grant execute on function public.dm_pin(bigint, boolean) to authenticated;

-- ------------------------------------------------------------
-- 5 · ปฏิกิริยา
-- ------------------------------------------------------------
-- คนละหนึ่งปฏิกิริยาต่อข้อความ (เลือกใหม่ = แทนอันเดิม แบบ IG)
-- เอาออก = เขียน emoji เป็นค่าว่าง ไม่ลบแถว — realtime กรองเหตุการณ์ลบตามห้องไม่ได้
-- (แถวที่ถูกลบเหลือแค่คีย์หลัก) ฝั่งแอปจึงฟังแค่ เพิ่ม/แก้ แล้วข้ามแถวที่ว่าง
-- thread เก็บซ้ำไว้ในตารางเพื่อให้ช่องสดกรองตามห้องได้ และ policy อ่านไม่ต้อง join ข้อความ
create table if not exists public.dm_reactions (
  msg    bigint not null references public.dm_messages(id) on delete cascade,
  thread uuid   not null references public.dm_threads(id) on delete cascade,
  uid    uuid   not null references auth.users(id) on delete cascade,
  emoji  text   not null default '' check (char_length(emoji) <= 16),
  at     timestamptz not null default now(),
  primary key (msg, uid)
);
create index if not exists dm_reactions_thread_idx on public.dm_reactions (thread);
alter table public.dm_reactions enable row level security;

drop policy if exists "read own dm reactions" on public.dm_reactions;
create policy "read own dm reactions" on public.dm_reactions
  for select to authenticated
  using (exists (
    select 1 from public.dm_threads t
     where t.id = thread and (t.a = auth.uid() or t.b = auth.uid())
  ));
-- ไม่มี policy เขียน — เขียนได้ทางเดียวคือ dm_react ข้างล่าง ซึ่งเป็นที่ที่เช็คห้องกับการบล็อก
revoke all on public.dm_reactions from anon;
grant select on public.dm_reactions to authenticated;

create or replace function public.dm_react(p_msg bigint, p_emoji text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_t  public.dm_threads%rowtype;
  v_e  text := btrim(coalesce(p_emoji, ''));
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if char_length(v_e) > 16 then raise exception 'อิโมจิไม่ถูกต้อง'; end if;
  select t.* into v_t from public.dm_threads t
    join public.dm_messages m on m.thread = t.id
   where m.id = p_msg;
  if v_t.id is null then raise exception 'ไม่พบข้อความนี้'; end if;
  if v_me not in (v_t.a, v_t.b) then raise exception 'ไม่ได้อยู่ในห้องนี้'; end if;
  if public.is_blocked(v_t.a, v_t.b) then raise exception 'ทำไม่ได้'; end if;
  insert into public.dm_reactions as r (msg, thread, uid, emoji, at)
  values (p_msg, v_t.id, v_me, v_e, now())
  on conflict (msg, uid) do update set emoji = excluded.emoji, at = excluded.at;
end;
$fn$;

revoke all on function public.dm_react(bigint, text) from public, anon;
grant execute on function public.dm_react(bigint, text) to authenticated;

-- ช่องสด: ปฏิกิริยาเด้งเข้าอีกฝั่งทันที · dm_messages อยู่ใน publication แล้วตั้งแต่ migration แรก
-- (แก้ไข/ปักหมุดเป็น UPDATE ของตารางเดิม ฝั่งแอปฟัง UPDATE เพิ่มเอง)
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public'
                    and tablename = 'dm_reactions') then
    alter publication supabase_realtime add table public.dm_reactions;
  end if;
end $$;
