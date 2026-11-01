-- ============================================================
-- คลังงาน (Task Vault) · รูปโจทย์ / งานที่ทำเสร็จ / โน้ต / พอร์ต ของแต่ละคน
-- ------------------------------------------------------------
-- สเปก: alt/docs/superpowers/specs/2026-10-31-task-vault-design.md (ข้อ 3.2)
-- **เจ้าของต้องรันไฟล์นี้เองใน Supabase SQL Editor** — ก่อนรัน แอปเก็บรูปไว้ในเครื่องและรอส่ง (ไม่ล้ม)
--
-- bucket ปิด (public = false) เพราะเป็นของส่วนตัว — ใบงาน ลายมือ เกียรติบัตรที่มีชื่อจริง
-- อ่านผ่าน signed URL ที่หมดอายุเท่านั้น (แบบเดียวกับ bucket 'dm' ใน 20260910160000_delete_and_privacy.sql)
-- path = '<uid>/<fileId>.jpg' · ทุก policy ผูกกับโฟลเดอร์แรก = uid ของคนที่ล็อกอิน · เพื่อนก็อ่านไม่ได้
-- ไม่มี policy update ตั้งใจ: รูปแก้ไม่ได้ ลบแล้วเพิ่มใหม่ (แอปย่อรูปเป็น JPEG ก่อนส่งเสมอ จึงรับแค่ jpeg · ต่อรูปไม่เกิน 1MB)
-- รันซ้ำได้ (on conflict / drop policy if exists)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-files', 'task-files', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "task files own upload" on storage.objects;
create policy "task files own upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "task files own read" on storage.objects;
create policy "task files own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "task files own delete" on storage.objects;
create policy "task files own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text);
