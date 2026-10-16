-- ============================================================
-- 16 ต.ค. 69 · เครื่องที่สลับบัญชีต้องย้ายสิทธิ์รับแจ้งเตือนตามไปได้
-- ------------------------------------------------------------
-- ข้อมูลจริง (อ่านจาก production): คอมเครื่องหนึ่งล็อกอินบัญชี nad*** อยู่ แต่แถว
-- push_subscriptions ของมัน (endpoint …drM2fN) เป็นของบัญชี pon*** ที่เคยล็อกอินบนเครื่องนั้น
-- เมื่อ 14 ต.ค. · user_state.data.pushDiag ของเครื่องนั้นรายงานเอง: state 'local' ·
-- "บันทึกขึ้นเซิร์ฟเวอร์ไม่ได้"
--
-- ทำไม: endpoint เป็น primary key และ RLS "own subscriptions" ให้แตะได้เฉพาะแถวของตัวเอง
-- upsert ของบัญชีใหม่จึงชนแถวของบัญชีเก่าแล้วล้ม · ผลมีสองทาง
--   1. แจ้งเตือนของบัญชีใหม่ไม่ถึงเครื่องที่เขาใช้อยู่จริง
--   2. แจ้งเตือนของบัญชีเก่า (ชื่องาน · ชื่อเพื่อนที่ทักมา) ยังเด้งบนเครื่องที่คนอื่นล็อกอินอยู่
--      ซึ่งเป็นเรื่องความปลอดภัยของเด็ก ไม่ใช่แค่เรื่องเตือนไม่ถึง (เครื่องที่พี่น้องใช้ร่วมกัน)
--
-- ทางแก้: ฟังก์ชันเดียวที่แอปเรียกแทน upsert · ย้ายเจ้าของได้ก็ต่อเมื่อผู้เรียกส่งกุญแจของ
-- subscription (p256dh + auth) มาตรงกับที่เก็บไว้ — สองค่านี้มีแต่เบราว์เซอร์ที่ถือ subscription
-- นั้นจริงเท่านั้นที่รู้ (RLS ไม่ให้ใครอ่านแถวของคนอื่น) · รู้แค่ endpoint ยึดไม่ได้
-- ไม่แก้ RLS ของตาราง — ทางอื่นทุกทาง (อ่าน · ลบ · upsert ตรง) ยังเป็นของเจ้าของแถวเท่านั้นเหมือนเดิม
--
-- ย้ายแล้วล้าง last_sent_at — มันคือนาฬิกาช่วงเงียบ 4 ชม. ของ send-reminders ของบัญชีเก่า
-- ห้ามติดไปเลื่อนการเตือนของบัญชีใหม่
-- ============================================================

create or replace function public.claim_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_tz int default 420
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  cur record;
begin
  if me is null then
    raise exception 'ต้องล็อกอินก่อน' using errcode = '28000';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 2048
     or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = ''
     or length(p_p256dh) > 512 or length(p_auth) > 512 then
    raise exception 'subscription ไม่ถูกต้อง' using errcode = '22023';
  end if;

  insert into push_subscriptions (endpoint, user_id, p256dh, auth, tz_offset, updated_at)
  values (p_endpoint, me, p_p256dh, p_auth, coalesce(p_tz, 420), now())
  on conflict (endpoint) do nothing;
  if found then return 'created'; end if;

  select user_id, p256dh, auth into cur
    from push_subscriptions where endpoint = p_endpoint for update;

  if cur.user_id = me then
    update push_subscriptions
       set p256dh = p_p256dh, auth = p_auth, tz_offset = coalesce(p_tz, 420), updated_at = now()
     where endpoint = p_endpoint;
    return 'refreshed';
  end if;

  if cur.p256dh is distinct from p_p256dh or cur.auth is distinct from p_auth then
    raise exception 'กุญแจของ subscription ไม่ตรง' using errcode = '42501';
  end if;

  update push_subscriptions
     set user_id = me, tz_offset = coalesce(p_tz, 420), updated_at = now(), last_sent_at = null
   where endpoint = p_endpoint;
  return 'moved';
end;
$$;

revoke all on function public.claim_push_subscription(text, text, text, int) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text, int) to authenticated;
