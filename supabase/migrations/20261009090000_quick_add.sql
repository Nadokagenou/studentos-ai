-- ============================================================
-- ปุ่มลัดเพิ่มงานจากตัวเครื่อง (iPhone: แตะหลังเครื่อง → แอปคำสั่งลัด → quick-add)
-- ------------------------------------------------------------
-- คำสั่งลัดของ iPhone ไม่มีทางล็อกอินเป็นผู้ใช้ได้ จึงพก "กุญแจส่วนตัว" ไปแทน
-- กุญแจหนึ่งดอกทำได้อย่างเดียว: หย่อนข้อความลงกล่องเข้าของเจ้าของ (inbox_items)
-- อ่านอะไรไม่ได้ แก้อะไรไม่ได้ — หลุดไปก็แค่มีคนส่งงานมาให้ ไม่ใช่บัญชีหลุด
--
-- เก็บแค่ค่าแฮช (sha256) ไม่เก็บตัวกุญแจ — ใครเปิดตารางนี้ได้ก็เอาไปใช้ไม่ได้
-- ตัวกุญแจจริงอยู่ในเครื่องผู้ใช้กับในคำสั่งลัดเท่านั้น
-- หนึ่งบัญชีมีหนึ่งดอก · สร้างใหม่ = ดอกเดิมตายทันที (upsert ทับแถวเดิม)
-- ============================================================

create table if not exists public.quick_keys (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  key_hash     text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.quick_keys enable row level security;

-- แอปสร้าง/เปลี่ยน/ลบกุญแจของตัวเองได้ · Edge Function ใช้ service role อ่านข้ามได้ (ตามที่ตั้งใจ)
drop policy if exists "own quick key" on public.quick_keys;
create policy "own quick key" on public.quick_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- นับโควตาต่อชั่วโมงใน quick-add ใช้ดัชนีเดิมของ inbox_items (user_id, consumed, created_at)
-- ไม่พอ เพราะต้องกรอง source ด้วย — ดัชนีเล็ก ๆ ตัวนี้ทำให้การนับไม่ต้องไล่ทั้งกล่อง
create index if not exists inbox_items_quick
  on public.inbox_items (user_id, created_at desc) where source = 'quick';
