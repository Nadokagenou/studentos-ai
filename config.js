// ============================================================
// StudentOS AI — Supabase config
// เว้นว่างไว้ = โหมดออฟไลน์ (ข้อมูลอยู่ใน localStorage อย่างเดียว)
// วิธีหา: Supabase Dashboard → Project Settings → API
// หมายเหตุ: anon key ออกแบบมาให้อยู่ในโค้ดฝั่ง browser ได้ (ไม่ใช่ความลับ
// เพราะสิทธิ์เข้าถึงข้อมูลถูกคุมด้วย Row Level Security ฝั่งเซิร์ฟเวอร์)
// ============================================================
window.SUPABASE_CONFIG = {
  url: '',      // เช่น 'https://abcdefgh.supabase.co'
  anonKey: '',  // anon / public key
};
