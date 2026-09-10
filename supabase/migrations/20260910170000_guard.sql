-- ============================================================
-- 27 · ด่านอายุที่ทำงานจริง + ที่ให้ตัวกรองเนื้อหาเขียนผลลง
-- ------------------------------------------------------------
-- ต่อจาก migration 26 · ผู้ใช้เคาะสองข้อ (10 ก.ย. 2569):
--   ตัวกรอง : รูปกันก่อนส่ง · ข้อความปล่อยขึ้นก่อนแล้วสแกนตามหลัง
--   ด่านอายุ: เดาจากช่วงชั้นที่เขาเลือกอยู่แล้ว ไม่ถามวันเกิดเพิ่ม
--
-- **ทำไมรูปกับข้อความถึงคนละกติกา** — ไม่ใช่เพราะข้อความไม่สำคัญ แต่เพราะ
-- ต้นทุนของการช้าไม่เท่ากัน: ข้อความที่ค้าง 2 วินาทีทุกครั้งทำให้คนเลิกคุยกันในแอปนี้
-- แล้วย้ายไปคุยกันที่อื่นแทน ซึ่งแปลว่าไม่มีใครกรองอะไรได้อีกเลย
-- ส่วนรูปคนรอได้อยู่แล้วเพราะมันมีขั้นตอนอัปโหลดที่เห็น ๆ กันอยู่
-- และรูปที่หลุดออกไปแม้แค่สิบวินาที ก็ถูกจับภาพหน้าจอส่งต่อได้แล้ว
-- ============================================================

-- ============================================================
-- ก) ด่านอายุ — เดาจากช่วงชั้น
-- ------------------------------------------------------------
-- age_band มีอยู่ตั้งแต่ migration 13 และมีด่านที่อ่านมันอยู่สามที่
-- (โพสต์ระดับโรงเรียน · open_dm · find_people) แต่**ไม่มีจอไหนเคยเขียนค่าลงไปเลย**
-- ค่าจึงเป็น null ทุกคน แปลว่าด่านทั้งสามที่เขียนไว้ไม่เคยทำงานสักครั้งเดียว
--
-- คงไว้สองค่าเหมือนเดิม ไม่เพิ่มค่าที่สาม เพราะโค้ดที่มีอยู่เทียบแบบ = 'ok' ตรง ๆ
-- ค่าที่สามจะกลายเป็น "ไม่ใช่ ok" แล้วไปปิดสิทธิ์ของ ม.ปลาย โดยไม่มีใครตั้งใจ
--   ม.ต้น              -> under  (ยังไม่เปิดให้คนนอกทักหรือค้นเจอ)
--   ม.ปลาย / มหาลัย    -> ok
--   ไม่ได้เลือก          -> under  โดยปริยาย — ตั้งใจให้เข้มไว้ก่อน
-- ============================================================
create or replace function public.band_of(p_grade text)
returns text
language sql immutable
as $fn$
  select case btrim(coalesce(p_grade, ''))
           when 'ม.ปลาย'  then 'ok'
           when 'มหาลัย'  then 'ok'
           else 'under'
         end;
$fn$;

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
         age_band = public.band_of(p_grade),
         updated_at = now()
   where id = v_me;
end;
$fn$;

revoke all on function public.set_cohort(text, text, text) from public, anon;
grant execute on function public.set_cohort(text, text, text) to authenticated;

-- คนที่ตั้งช่วงชั้นไว้ก่อนหน้านี้แล้วต้องได้ค่าย้อนหลังด้วย
-- ไม่งั้นด่านจะทำงานเฉพาะกับคนที่มาตั้งใหม่หลังวันนี้เท่านั้น
update public.profiles set age_band = public.band_of(grade)
 where age_band is null;

-- ============================================================
-- ข) ที่ให้ตัวกรองเขียนผลลง
-- ------------------------------------------------------------
-- แชทตัวต่อตัวเป็นที่เดียวที่ยังไม่มีคอลัมน์ hidden — อีกสี่ที่มีแล้วตั้งแต่
-- migration 13 กับ 20 เพราะระบบรายงานต้องใช้
-- ============================================================
alter table public.dm_messages add column if not exists hidden boolean not null default false;

-- คนส่งยังเห็นข้อความตัวเอง คนรับไม่เห็น
-- ซ่อนจากคนส่งด้วยจะกลายเป็นข้อความหายไปเฉย ๆ โดยไม่มีอะไรบอก
-- แล้วเขาจะพิมพ์ใหม่อีกรอบ ซึ่งไม่ได้ทำให้ใครปลอดภัยขึ้นเลย
drop policy if exists "read own dm" on public.dm_messages;
create policy "read own dm" on public.dm_messages
  for select to authenticated
  using (
    (not hidden or sender = auth.uid())
    and exists (
      select 1 from public.dm_threads t
       where t.id = dm_messages.thread
         and (t.a = auth.uid() or t.b = auth.uid())
         and not public.is_blocked(t.a, t.b)
    )
  );

-- ---------- บันทึกของตัวกรอง ----------
-- เก็บทุกครั้งที่ตัวกรองตัดสิน ไม่ใช่เฉพาะครั้งที่บล็อก
-- เพราะสิ่งที่ต้องรู้ให้ได้คือ "มันบล็อกของที่ไม่ควรบล็อกบ่อยแค่ไหน"
-- ซึ่งดูจากบันทึกที่มีแต่ครั้งที่บล็อกไม่ได้เลย
create table if not exists public.mod_log (
  id         bigint generated always as identity primary key,
  kind       text not null,          -- post · reply · dm · tthread · tmsg · image
  target     text,                   -- null ได้ เพราะรูปถูกตัดสินก่อนจะมีแถวให้ชี้
  author     uuid references auth.users(id) on delete set null,
  verdict    text not null check (verdict in ('ok', 'block', 'review')),
  reason     text,
  score      jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mod_log_author_idx on public.mod_log (author, created_at desc);
create index if not exists mod_log_verdict_idx on public.mod_log (verdict, created_at desc);

alter table public.mod_log enable row level security;
-- ไม่มี policy สักข้อ = ไม่มีใครอ่านหรือเขียนได้ผ่าน anon/authenticated key
-- เข้าถึงได้เฉพาะ service_role ซึ่งข้าม RLS อยู่แล้ว และอยู่แต่ใน Edge Function
-- บันทึกว่าใครถูกกรองเพราะอะไร เป็นข้อมูลที่หลุดออกจากเซิร์ฟเวอร์ไม่ได้เลย

-- ---------- ปุ่มที่ตัวกรองใช้ซ่อนของ ----------
-- ให้ service_role เรียกเท่านั้น · ไม่ grant ให้ authenticated เด็ดขาด
-- ไม่งั้นใครก็ซ่อนโพสต์ใครก็ได้ด้วยการเรียก RPC ตรง ๆ จากหน้าเว็บ
create or replace function public.mod_hide(p_kind text, p_target text,
                                           p_reason text default null,
                                           p_score jsonb default null)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_author uuid;
begin
  if p_kind = 'post' then
    update public.posts set hidden = true where id = p_target::uuid
      returning author into v_author;
  elsif p_kind = 'reply' then
    update public.post_replies set hidden = true where id = p_target::bigint
      returning author into v_author;
  elsif p_kind = 'dm' then
    update public.dm_messages set hidden = true where id = p_target::bigint
      returning sender into v_author;
  elsif p_kind = 'tthread' then
    update public.topic_threads set hidden = true where id = p_target::uuid
      returning author into v_author;
  elsif p_kind = 'tmsg' then
    update public.topic_msgs set hidden = true where id = p_target::bigint
      returning author into v_author;
  else
    raise exception 'ไม่รู้จักชนิด %', p_kind;
  end if;

  insert into public.mod_log (kind, target, author, verdict, reason, score)
  values (p_kind, p_target, v_author, 'block', p_reason, p_score);
end;
$fn$;

-- revoke จาก public ดึงสิทธิ์ออกจาก **ทุกคนที่ไม่มี grant ตรง ๆ** ซึ่งรวม service_role ด้วย
-- (สิทธิ์ execute โดยปริยายของฟังก์ชันใหม่ ให้ไว้กับ public เท่านั้น ไม่ได้ให้ service_role แยก)
-- ลืมบรรทัด grant ข้างล่าง = Edge Function เรียกแล้วได้ permission denied ทุกครั้ง
-- ซึ่งจะอ่านเหมือนตัวกรองไม่ทำงาน มากกว่าจะอ่านเหมือนตั้งสิทธิ์ผิด
revoke all on function public.mod_hide(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mod_hide(text, text, text, jsonb) to service_role;

create or replace function public.mod_note(p_kind text, p_target text, p_author uuid,
                                           p_verdict text, p_reason text default null,
                                           p_score jsonb default null)
returns void
language sql security definer set search_path = public
as $fn$
  insert into public.mod_log (kind, target, author, verdict, reason, score)
  values (p_kind, p_target, p_author, p_verdict, p_reason, p_score);
$fn$;

revoke all on function public.mod_note(text, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mod_note(text, text, uuid, text, text, jsonb) to service_role;
