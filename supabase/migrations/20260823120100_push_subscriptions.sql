-- ============================================================
-- 02 · push_subscriptions — เครื่องที่ยอมรับการเตือนแล้ว
-- ------------------------------------------------------------
-- คนเดียวมีได้หลายแถว เพราะเปิดการเตือนแยกทีละเครื่อง (มือถือ · แท็บเล็ต · คอม)
-- คีย์หลักเป็น endpoint ไม่ใช่ user_id — endpoint คือที่อยู่ของ "เครื่องนั้น"
-- ที่เบราว์เซอร์ออกให้ และเปลี่ยนได้เองเมื่อไหร่ก็ได้
--
-- tz_offset เก็บเป็นนาที (ไทย = 420) เพื่อให้ send-reminders คิดได้ว่า
-- "อีก 3 ชั่วโมงถึงกำหนด" ของคนนี้ตรงกับกี่โมงบนนาฬิกาของเขา
-- ============================================================
create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  tz_offset    int default 420,
  last_sent_at timestamptz,
  updated_at   timestamptz not null default now()
);

create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
