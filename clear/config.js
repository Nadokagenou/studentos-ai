// ============================================================
// StudentOS AI — Supabase config
// เว้นว่างไว้ = โหมดออฟไลน์ (ข้อมูลอยู่ใน localStorage อย่างเดียว)
// วิธีหา: Supabase Dashboard → Project Settings → API
// หมายเหตุ: anon key ออกแบบมาให้อยู่ในโค้ดฝั่ง browser ได้ (ไม่ใช่ความลับ
// เพราะสิทธิ์เข้าถึงข้อมูลถูกคุมด้วย Row Level Security ฝั่งเซิร์ฟเวอร์)
// ============================================================
window.SUPABASE_CONFIG = {
  url: 'https://yunbytxtgghizrdqftvj.supabase.co',
  anonKey: 'sb_publishable_GCXZU_uLAlv3yuGxu5cOrw_YU4UCWXY',
};

// กุญแจสาธารณะสำหรับ Web Push (VAPID) — ใส่ในโค้ดฝั่งเบราว์เซอร์ได้ ไม่ใช่ความลับ
// คู่กุญแจส่วนตัวเก็บเป็น secret ใน Supabase Edge Function เท่านั้น
window.VAPID_PUBLIC_KEY = 'BHrP-CpWVD4hOHxZoMZsBT7mmlpjH4tOXp-QozzHlCQft_rATWQMI5OpyRsFjN7zju2TdaTuEzmo_0SJQwtPZNQ';
