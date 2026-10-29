-- ============================================================
-- 29 ต.ค. 69 · do_at_due — คัด "นัดที่ตั้งเอง" (t.doAt) ในฐานข้อมูล แทนการลากรายการงานทั้งก้อน
-- ------------------------------------------------------------
-- ข้อมูลจริง: Egress ของ Supabase ทั้งองค์กรเกินแผนฟรี 363% · cron studentos-do-at ยิงราว 300 รอบ/วัน
-- แต่ละรอบ send-reminders ลาก tasks + settings ทั้งก้อนของทุกคนที่เปิดแจ้งเตือน (~271 KB · 7 คน)
-- มาคัดเองในฟังก์ชัน ทั้งที่งานที่มีนัดจริงรวมกันแค่ ~1 KB · ราว 80 MB/วันที่ส่งออกมาแล้วทิ้ง
--
-- ฟังก์ชันนี้คืนเฉพาะ "งานที่ doAt อยู่ในช่วง" ทั้งใบ + settings.notifOff ของคนที่มีนัดในช่วงเท่านั้น
-- ส่วนการตัดสินจริง (done · deleted · doAtShown · ช่วงเวลาเป๊ะ) ยังอยู่ใน send-reminders เหมือนเดิม
-- ผู้เรียกส่งช่วงที่กว้างกว่าที่ใช้จริงมาเผื่อ · ที่นี่เป็นแค่ตะแกรงหยาบ ไม่ใช่ตัวตัดสิน
--
-- ⚠️ security definer = อ่าน user_state ของทุกคนข้าม RLS · ห้ามให้ anon/authenticated เรียก
--    (ไม่งั้นใครก็ส่ง uuid ของคนอื่นมาอ่านชื่องานได้) · เรียกได้เฉพาะ service_role (send-reminders)
--
-- ⚠️ ต้องรันไฟล์นี้ "ก่อน" deploy send-reminders รุ่นที่เรียก rpc('do_at_due')
--    ถ้าลืม ฟังก์ชันยังทำงานได้ (ถอยกลับไปลากทั้งก้อนแบบเดิม) แต่ประหยัดไม่ได้สักไบต์
--
-- ย้อนกลับ: drop function public.do_at_due(uuid[], timestamptz, timestamptz);
--           drop function public.studentos_try_ts(text);
-- ============================================================

-- doAt เป็นข้อความที่แอปเขียน (toISOString) แต่ข้อมูลผู้ใช้เก่า/เพี้ยนมีได้เสมอ
-- cast ตรง ๆ แล้วเจอค่าเดียวที่แปลงไม่ได้ = ทั้งคิวรีล้ม = นัดของทุกคนไม่ดังทั้งรอบ
create or replace function public.studentos_try_ts(v text) returns timestamptz
language plpgsql immutable
set search_path = public
as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}' then return null; end if;
  return v::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.do_at_due(p_ids uuid[], p_from timestamptz, p_to timestamptz)
returns table (id uuid, tasks jsonb, settings jsonb)
language sql stable
security definer
set search_path = public
as $$
  select u.id,
         d.tasks,
         jsonb_build_object('notifOff', u.data -> 'settings' -> 'notifOff') as settings
    from public.user_state u
    cross join lateral (
      select jsonb_agg(t) as tasks
        from jsonb_array_elements(
               case when jsonb_typeof(u.data -> 'tasks') = 'array' then u.data -> 'tasks' else '[]'::jsonb end
             ) t
       where jsonb_typeof(t) = 'object'
         and jsonb_typeof(t -> 'doAt') = 'string'
         and public.studentos_try_ts(t ->> 'doAt') between p_from and p_to
    ) d
   where u.id = any(p_ids)
     and d.tasks is not null;
$$;

revoke all on function public.do_at_due(uuid[], timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.do_at_due(uuid[], timestamptz, timestamptz) to service_role;
revoke all on function public.studentos_try_ts(text) from public, anon, authenticated;
grant execute on function public.studentos_try_ts(text) to service_role;
