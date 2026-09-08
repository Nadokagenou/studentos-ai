-- ============================================================
-- 22 · ปุ่มรายงานต้องอยู่ในทุกจอที่มีคนแปลกหน้า
-- ------------------------------------------------------------
-- migration 13 สร้างระบบรายงานตอนที่แอปมีแค่สองที่ให้รายงาน — โพสต์กับคำตอบใต้โพสต์
-- และตอนนั้นทุกคนที่เห็นกันอยู่ห้องเรียนเดียวกัน จึงพอ
--
-- ตอนนี้ไม่พอแล้ว หลัง migration 19 (ทักกันได้ทุกคน) และ 20 (หัวข้อทั่วโลก)
-- มีอีกสามที่ที่คนที่ไม่รู้จักกันเจอกันได้ และทั้งสามที่ยังไม่มีทางร้องเรียน:
--   ห้องแชทตัวต่อตัว · เธรดในหัวข้อ · คำตอบในเธรด
--
-- **จอที่ลืมใส่ปุ่มรายงาน คือจอที่คนโดนกวนแล้วไม่มีอะไรทำได้นอกจากปิดแอปทิ้ง**
-- และเราจะไม่มีวันรู้ว่าเสียเขาไปเพราะอะไร
-- ============================================================

alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind in ('post', 'reply', 'user', 'topic', 'tmsg'));

-- ============================================================
-- เกณฑ์ซ่อนอัตโนมัติ — ขยายให้ครอบคลุมของใหม่
-- ------------------------------------------------------------
-- กติกาเดิมยังเหมือนเดิมทุกข้อ: สามคน **ที่ต่างกัน** ไม่ใช่สามครั้ง
-- ซ่อนก่อนแล้วค่อยให้คนตรวจ ดีกว่าปล่อยไว้จนกว่าจะมีคนว่างมาตรวจ
-- เพราะเวลาที่เนื้อหาแย่ค้างอยู่บนจอ คือเวลาที่มันทำร้ายคนได้จริง
--
-- **'user' ไม่มีการซ่อนอัตโนมัติ** โดยตั้งใจ — การรายงานคนไม่ใช่การรายงานข้อความ
-- ระงับบัญชีอัตโนมัติจากคำร้องสามใบคือเครื่องมือกลั่นแกล้งที่สมบูรณ์แบบ
-- (นัดกันสามคนก็ปิดปากใครก็ได้) คำร้องประเภทนี้ต้องมีคนอ่านเสมอ
-- คนที่ถูกกวนมีเครื่องมือที่ได้ผลทันทีอยู่แล้วคือปุ่มบล็อก ซึ่งไม่ต้องรอใคร
-- ============================================================
create or replace function public.apply_report_threshold()
returns trigger
language plpgsql security definer set search_path = public
as $fn$
declare
  n int;
begin
  select count(distinct reporter) into n
    from public.reports where kind = new.kind and target = new.target;

  if n >= 3 then
    if new.kind = 'post' then
      update public.posts set hidden = true where id = new.target::uuid;
    elsif new.kind = 'reply' then
      update public.post_replies set hidden = true where id = new.target::bigint;
    elsif new.kind = 'topic' then
      update public.topic_threads set hidden = true where id = new.target::uuid;
    elsif new.kind = 'tmsg' then
      update public.topic_msgs set hidden = true where id = new.target::bigint;
    end if;
    -- 'user' ตกมาถึงตรงนี้แล้วไม่ทำอะไร · ตั้งใจ ดูเหตุผลข้างบน
  end if;
  return new;
end;
$fn$;

drop trigger if exists reports_threshold on public.reports;
create trigger reports_threshold after insert on public.reports
  for each row execute function public.apply_report_threshold();

-- ============================================================
-- ซ่อนแล้วต้องหายจากทุกทางที่อ่านได้
-- ------------------------------------------------------------
-- บทเรียนเดิมจาก migration 13 ที่ต้องใช้ซ้ำกับตารางใหม่:
-- ซ่อนแล้วแต่ยังโผล่อยู่ทางใดทางหนึ่ง = ไม่ได้ซ่อน
--
-- topic_threads / topic_msgs กรอง hidden ไว้แล้วทั้งใน policy และใน
-- topic_open / topic_thread ตั้งแต่ migration 20 · เหลือ topic_quiet ตัวเดียว
-- ที่ต้องกันไม่ให้น้องไซเดินเข้าไปตอบเธรดที่เพิ่งถูกซ่อน — ซึ่งจะกลายเป็น
-- คำตอบของ AI ค้างอยู่ใต้เนื้อหาที่ถูกรายงาน และไม่มีใครเห็นว่าเกิดขึ้น
-- (ตัวเดิมกรอง not th.hidden อยู่แล้ว เขียนซ้ำที่นี่เพื่อยืนยันว่าตรวจแล้ว
--  ไม่ใช่เพราะของเดิมผิด — ถ้าวันหลังมีใครแก้ ให้เห็นเหตุผลตรงนี้ด้วย)
-- ============================================================
create or replace function public.topic_quiet(p_minutes int default 10, p_limit int default 5)
returns table (id uuid, topic text, topic_name text, body text, lang text)
language sql stable security definer set search_path = public
as $fn$
  select th.id, th.topic, t.name, th.body, th.lang
    from public.topic_threads th
    join public.topics t on t.id = th.topic
   where th.reply_count = 0
     and not th.hidden
     and th.created_at < now() - make_interval(mins => greatest(1, p_minutes))
     and th.created_at > now() - interval '2 days'
     -- คนที่ถูกบล็อกโดยเจ้าของเธรดไม่เกี่ยวตรงนี้ (น้องไซไม่ใช่ผู้ใช้)
     -- แต่บัญชีที่โดนรายงานหนักจนเธรดถูกซ่อน ต้องไม่ได้รับความสนใจเพิ่ม
   order by th.created_at
   limit greatest(1, least(p_limit, 20));
$fn$;

revoke all on function public.topic_quiet(int, int) from public, anon, authenticated;
