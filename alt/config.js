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

  // ช่องทางล็อกอินแบบ OAuth ที่จะโผล่เป็นปุ่มบนจอบัญชี
  // เพิ่มชื่อลงในลิสต์นี้ได้ "หลังจาก" เปิดใช้เจ้านั้นใน Supabase Dashboard →
  // Authentication → Providers (ใส่ Client ID / Secret) แล้วเท่านั้น
  // ปุ่มที่กดแล้วขึ้น "provider is not enabled" แย่กว่าปุ่มที่ไม่มี
  // รองรับ: 'google' · 'apple' · 'facebook' · 'azure' (Microsoft)
  providers: ['google'],

  // ล็อกอินด้วยอีเมล (รหัส 6 หลัก) เปิดอยู่เสมอ ไม่ต้องตั้งค่าผู้ให้บริการ
  // แต่ต้องตั้ง SMTP ของตัวเองใน Dashboard → Authentication → Emails ก่อนใช้จริง
  // เพราะ SMTP ที่แถมมาส่งได้แค่ไม่กี่ฉบับต่อชั่วโมงและจำกัดปลายทาง
};

// กุญแจสาธารณะสำหรับ Web Push (VAPID) — ใส่ในโค้ดฝั่งเบราว์เซอร์ได้ ไม่ใช่ความลับ
// คู่กุญแจส่วนตัวเก็บเป็น secret ใน Supabase Edge Function เท่านั้น
window.VAPID_PUBLIC_KEY = 'BHrP-CpWVD4hOHxZoMZsBT7mmlpjH4tOXp-QozzHlCQft_rATWQMI5OpyRsFjN7zju2TdaTuEzmo_0SJQwtPZNQ';
