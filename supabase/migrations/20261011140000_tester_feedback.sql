-- ============================================================
-- tester_feedback — คำตอบแบบสอบถามเทสเตอร์ (feedback.html)
-- ------------------------------------------------------------
-- 11 ต.ค. 69 · User test 7 วัน · ฟอร์มอยู่บนเว็บแอปเอง เทสเตอร์ใช้บัญชีที่ล็อกอินในแอปอยู่แล้ว
-- (ไม่ใช้ Google Form เพราะต้องรู้ว่าคำตอบไหนเป็นของบัญชีไหน ถึงจะเทียบกับการใช้งานจริงได้)
--
-- kind = 'main'  แบบสอบถามหลัก คนละหนึ่งแถว (ส่งซ้ำ = แก้คำตอบเดิม) · day = ''
-- kind = 'daily' เช็คอินทุกเย็น วันละหนึ่งแถว · day = 'YYYY-MM-DD' ตามเครื่อง (เวลาไทย)
-- answers = { "<รหัสข้อ>": ค่า } · รหัสข้อและชนิดคำตอบอยู่ใน alt/feedback-questions.js
--
-- อ่านได้: เจ้าของแถว + แอดมิน (Control Center) · เขียนได้: เจ้าของแถวเท่านั้น · ไม่มีใครลบผ่าน API
-- ============================================================
create table if not exists public.tester_feedback (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('main', 'daily')),
  day        text not null default '' check (day = '' or day ~ '^\d{4}-\d{2}-\d{2}$'),
  answers    jsonb not null default '{}'::jsonb check (pg_column_size(answers) < 32000),
  dev        text check (dev is null or length(dev) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);
alter table public.tester_feedback enable row level security;

drop policy if exists tester_feedback_read on public.tester_feedback;
create policy tester_feedback_read on public.tester_feedback
  for select using (auth.uid() = user_id or public.is_app_admin());
drop policy if exists tester_feedback_insert on public.tester_feedback;
create policy tester_feedback_insert on public.tester_feedback
  for insert with check (auth.uid() = user_id);
drop policy if exists tester_feedback_update on public.tester_feedback;
create policy tester_feedback_update on public.tester_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.tester_feedback from anon;
grant select, insert, update on public.tester_feedback to authenticated;
