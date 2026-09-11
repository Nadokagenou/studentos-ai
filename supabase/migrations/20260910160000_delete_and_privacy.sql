-- ============================================================
-- 26 · ลบของตัวเองได้ + รูปส่วนตัวต้องไม่เป็นสาธารณะ
-- ------------------------------------------------------------
-- ผู้ใช้ทักมาเอง (10 ก.ย. 2569): "มันอันตรายมากเลยนะ แบบนี้ลบสิ่งที่โพสไม่ได้
-- และไม่มี ai วิเคราะห์รูปหรือข้อความที่เราจะส่ง กลัวเรื่องกฎหมายและความปลอดภัยของเด็กมากๆ"
--
-- ตรวจแล้วเขาพูดถูกทั้งสองข้อ และมีข้อที่สามที่หนักกว่าที่เขาเห็น:
--
--   1) ทั้งฐานข้อมูลไม่มีคำสั่งลบของตัวเองเลยสักตัว · policy บน posts มีแค่ insert
--      แปลว่าต่อให้ใส่ปุ่มลบในแอป มันก็ลบไม่ได้อยู่ดี
--   2) bucket 'posts' ตั้งไว้ public = true และ policy select เปิดให้ role 'public'
--      **รูปทุกใบเปิดดูได้ด้วย URL ตรง ๆ โดยไม่ต้องล็อกอิน** รวมรูปที่ตั้งใจส่งในแชทส่วนตัว
--      สำหรับแอปที่ผู้ใช้เป็นเด็ก นี่คือข้อที่อันตรายที่สุดในระบบทั้งหมด
--   3) ปุ่มส่งรูปในแชทที่เพิ่งปล่อยไป ใช้จริงไม่ได้ตั้งแต่แรก — policy บังคับให้โฟลเดอร์แรก
--      เป็น uid ของคนอัปโหลด แต่โค้ดส่ง path เป็น 'dm/<uid>/...' โฟลเดอร์แรกจึงเป็น 'dm'
--      ทุกครั้งที่กดส่งรูปจะโดนปฏิเสธเงียบ ๆ (ข้อนี้เป็นความผิดพลาดของรุ่น 1B72 เอง)
--
-- **ข้อที่ต้องคิดก่อนใส่ปุ่มลบ:** ถ้าลบได้อย่างเดียวโดยไม่ทำอะไรเพิ่ม ปุ่มลบจะกลายเป็น
-- เครื่องมือของคนกวน — ส่งข้อความคุกคาม รอให้อีกฝ่ายอ่าน แล้วลบทิ้งก่อนใครจะตรวจได้
-- คนที่โดนจะไม่เหลืออะไรไปยืนยัน และคำร้องเรียนที่ยื่นไปแล้วจะชี้ไปที่แถวที่หายไป
-- จึงต้องเก็บสำเนาไว้ **ตอนที่ถูกรายงาน** ก่อนเสมอ แล้วค่อยให้ลบได้อย่างอิสระ
-- สำเนาเก็บเฉพาะของที่มีคนร้องเรียนแล้วเท่านั้น ไม่ได้เก็บทุกอย่างที่ทุกคนลบ
-- ============================================================

-- ============================================================
-- ก) หลักฐานต้องถูกเก็บตอนรายงาน ไม่ใช่ตอนมีคนมาตรวจ
-- ------------------------------------------------------------
-- ใช้ trigger แทนการแก้ report_content เพราะฟังก์ชันนั้นถูกเขียนทับมาแล้วสองรอบ
-- (migration 13 แล้ว 22) การแตะมันอีกครั้งแปลว่าต้องคัดลอกเนื้อในทั้งก้อนมาไว้ที่นี่
-- ซึ่งวันหลังจะกลายเป็นสองสำเนาที่ค่อย ๆ ต่างกันโดยไม่มีใครรู้
-- ============================================================
alter table public.reports add column if not exists snapshot jsonb;

create or replace function public.snap_report()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare
  v jsonb;
begin
  if new.kind = 'post' then
    select to_jsonb(p) - 'id' into v from public.posts p where p.id = new.target::uuid;
  elsif new.kind = 'reply' then
    select to_jsonb(r) - 'id' into v from public.post_replies r where r.id = new.target::bigint;
  elsif new.kind = 'dm' then
    select to_jsonb(m) - 'id' into v from public.dm_messages m where m.id = new.target::bigint;
  elsif new.kind = 'tthread' then
    select to_jsonb(t) - 'id' into v from public.topic_threads t where t.id = new.target::uuid;
  elsif new.kind = 'tmsg' then
    select to_jsonb(m) - 'id' into v from public.topic_msgs m where m.id = new.target::bigint;
  end if;
  new.snapshot := v;
  return new;
exception when others then
  -- สำเนาเก็บไม่ได้ ต้องไม่ทำให้คำร้องเรียนส่งไม่ได้ — คำร้องสำคัญกว่าสำเนา
  return new;
end;
$fn$;

drop trigger if exists snap_report_t on public.reports;
create trigger snap_report_t before insert on public.reports
  for each row execute function public.snap_report();

-- ============================================================
-- ข) ลบของตัวเอง
-- ------------------------------------------------------------
-- คืนค่าเป็น path ของรูป (หรือ null) เพื่อให้แอปเอาไปลบไฟล์ใน storage ต่อ
-- ลบจากฐานข้อมูลอย่างเดียวแล้วทิ้งไฟล์ไว้ = รูปยังเปิดได้อยู่ด้วย URL เดิม
-- ซึ่งไม่ใช่การลบ แต่เป็นการซ่อนจากหน้าจอเท่านั้น
--
-- ทุกตัวใช้ scalar return (returns text) ไม่ใช่ returns table เพื่อเลี่ยงกับดัก
-- ตัวแปร OUT ชื่อ id ที่ทำให้ id เปล่า ๆ ในตัวฟังก์ชันกำกวมตอนรัน (บทเรียน migration 24)
-- ============================================================

create or replace function public.post_delete(p_post uuid)
returns text
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me  uuid := auth.uid();
  v_img text;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  select p.image into v_img from public.posts p where p.id = p_post and p.author = v_me;
  if not found then raise exception 'ลบได้เฉพาะโพสต์ของตัวเอง'; end if;
  -- คำตอบใต้โพสต์หายตามด้วย on delete cascade ที่ตั้งไว้แล้วใน post_replies
  delete from public.posts p where p.id = p_post and p.author = v_me;
  return v_img;
end;
$fn$;

create or replace function public.reply_delete(p_reply bigint)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me   uuid := auth.uid();
  v_post uuid;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  select r.post into v_post from public.post_replies r
   where r.id = p_reply and r.author = v_me;
  if not found then raise exception 'ลบได้เฉพาะคำตอบของตัวเอง'; end if;
  delete from public.post_replies r where r.id = p_reply and r.author = v_me;
  update public.posts p set reply_count = greatest(0, p.reply_count - 1) where p.id = v_post;
end;
$fn$;

-- ---------- ข้อความในแชทตัวต่อตัว ----------
-- IG เรียกว่า unsend และลบให้ทั้งสองฝั่ง ไม่ใช่ลบแค่ฝั่งตัวเอง
-- ลบแค่ฝั่งตัวเองคือคำสัญญาที่ผิด: คนใช้กดเพราะอยากให้อีกฝ่ายไม่เห็น
create or replace function public.dm_unsend(p_msg bigint)
returns text
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me  uuid := auth.uid();
  v_img text;
  v_th  uuid;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  select m.image, m.thread into v_img, v_th from public.dm_messages m
   where m.id = p_msg and m.sender = v_me;
  if not found then raise exception 'ลบได้เฉพาะข้อความของตัวเอง'; end if;
  delete from public.dm_messages m where m.id = p_msg and m.sender = v_me;
  -- last_at ของห้องต้องถอยตามข้อความที่เหลือจริง ไม่งั้นห้องลอยอยู่บนสุดของกล่อง
  -- ทั้งที่ข้อความล่าสุดถูกลบไปแล้ว
  update public.dm_threads t
     set last_at = coalesce((select max(m.created_at) from public.dm_messages m
                              where m.thread = v_th), t.created_at)
   where t.id = v_th;
  return v_img;
end;
$fn$;

create or replace function public.tthread_delete(p_thread uuid)
returns text
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me  uuid := auth.uid();
  v_img text;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  select t.image into v_img from public.topic_threads t
   where t.id = p_thread and t.author = v_me;
  if not found then raise exception 'ลบได้เฉพาะของตัวเอง'; end if;
  delete from public.topic_threads t where t.id = p_thread and t.author = v_me;
  return v_img;
end;
$fn$;

create or replace function public.tmsg_delete(p_msg bigint)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_me uuid := auth.uid();
  v_th uuid;
begin
  if v_me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  select m.thread into v_th from public.topic_msgs m
   where m.id = p_msg and m.author = v_me;
  if not found then raise exception 'ลบได้เฉพาะข้อความของตัวเอง'; end if;
  delete from public.topic_msgs m where m.id = p_msg and m.author = v_me;
  update public.topic_threads t set reply_count = greatest(0, t.reply_count - 1)
   where t.id = v_th;
end;
$fn$;

revoke all on function public.post_delete(uuid)     from public, anon;
revoke all on function public.reply_delete(bigint)  from public, anon;
revoke all on function public.dm_unsend(bigint)     from public, anon;
revoke all on function public.tthread_delete(uuid)  from public, anon;
revoke all on function public.tmsg_delete(bigint)   from public, anon;

grant execute on function public.post_delete(uuid)    to authenticated;
grant execute on function public.reply_delete(bigint) to authenticated;
grant execute on function public.dm_unsend(bigint)    to authenticated;
grant execute on function public.tthread_delete(uuid) to authenticated;
grant execute on function public.tmsg_delete(bigint)  to authenticated;

-- ============================================================
-- ค) รูปในแชทส่วนตัวย้ายไป bucket ปิด
-- ------------------------------------------------------------
-- bucket 'posts' ยังเปิดสาธารณะต่อไปตามเดิม เพราะรูปโจทย์ในฟีดตั้งใจให้คนอื่นเห็นอยู่แล้ว
-- (ถึงอย่างนั้นก็ยังไม่ถูกทั้งหมด — โพสต์ scope 'room' ควรเห็นเฉพาะคนในห้อง
--  แต่ URL ของรูปเปิดได้หมด · แยกเป็นงานถัดไป เพราะต้องแก้ทุกที่ที่เรียก getPublicUrl)
--
-- ส่วนแชทตัวต่อตัวไม่มีข้ออ้างเลย มันคือของสองคน · bucket ใหม่ public = false
-- แล้วอ่านผ่าน signed URL ที่หมดอายุ ซึ่งบังคับให้ผ่าน policy ข้างล่างทุกครั้ง
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm', 'dm', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- อัปโหลดได้เฉพาะลงโฟลเดอร์ชื่อ uid ของตัวเอง — path จึงเป็น '<uid>/<เวลา>.jpg'
-- ไม่ใช่ 'dm/<uid>/...' แบบเดิมที่ทำให้โฟลเดอร์แรกไม่ใช่ uid แล้วโดนปฏิเสธทุกครั้ง
drop policy if exists "dm image upload" on storage.objects;
create policy "dm image upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dm' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "dm image own delete" on storage.objects;
create policy "dm image own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dm' and (storage.foldername(name))[1] = auth.uid()::text);

-- อ่านได้เฉพาะคนที่อยู่ในห้องที่รูปนั้นถูกส่งเข้าไปจริง ๆ
-- คนส่งอ่านของตัวเองได้เสมอ เผื่อช่วงที่อัปโหลดเสร็จแล้วแต่ยังไม่ได้บันทึกลงตาราง
drop policy if exists "dm image to members" on storage.objects;
create policy "dm image to members" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dm'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
          from public.dm_messages m
          join public.dm_threads t on t.id = m.thread
         where m.image = storage.objects.name
           and (t.a = auth.uid() or t.b = auth.uid())
           and not public.is_blocked(t.a, t.b)
      )
    )
  );
