-- ============================================================
-- ลบระบบลิงก์เชิญรุ่นแรก (20261024120000_invites.sql) — ไม่ได้ใช้แล้ว
-- ------------------------------------------------------------
-- 24 ต.ค. 69 · เจ้าของให้ใช้ระบบชวนเพื่อนด้วยรหัส/QR ที่ทำไว้แล้ว (20261023150000_invites.sql:
-- invite_codes · invite_redemptions · my_invite · redeem_invite) แอปไม่เรียก claim_invite / my_invite_count อีก
-- รันหรือไม่รันก็ได้ ไม่กระทบแอป · ไม่แตะตารางของระบบ QR
-- ============================================================
drop function if exists public.claim_invite(text);
drop function if exists public.my_invite_count();
drop table if exists public.invites;
