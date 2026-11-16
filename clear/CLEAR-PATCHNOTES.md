# Student OS Clear — แพตช์โน้ต (รุ่นใหม่อยู่บนสุด)

ลิงก์: https://nadokagenou.github.io/studentos-ai/clear/

## 16 พฤศจิกายน 2569 · Student OS Clear 0A0 “Flimsy” · เริ่มเวอร์ชัน clear (โค้ดจากแอปหลัก 1C62)

- ตั้งเลขรุ่น `0A0` ชื่อรุ่น “Flimsy” (`APP_VERSION` · `APP_CODENAME` ใน app.js · `CACHE` ใน sw.js) · ป้ายรุ่นในแอปขึ้นว่า "Student OS Clear 0A0 “Flimsy”"

- คัดลอกแอปหลักทั้งชุดจาก main (`aaf6d9d` · รวม PR #102) มาไว้ที่ `clear/`
- **ข้อมูลในเครื่องแยกจากแอปหลัก**: คีย์ `studentos.alt.*` → `studentos.clear.*` (รวม legacy/shortcutDraft/desktop sidebar) · เปิดครั้งแรก = แอปเปล่า งานในแอปหลักไม่ถูกแตะ
- **service worker แยก**: scope `/clear/` · แคช `studentos-clear-*` · ตัวหลักไม่ดักคำขอใต้ `/clear/` และไม่ลบแคชกันเอง
- โค้ดลับ "ล้างทุกอย่าง" ถอนเฉพาะ service worker และแคชของ clear
- ชื่อแอป "Student OS Clear" (ติดตั้งแยกจากแอปหลักได้) · `noindex`
- **ยังใช้ร่วมกับแอปหลัก**: บัญชี Supabase · ข้อมูลบน cloud แถวเดียวกัน (`user_state`) · การล็อกอิน (ออกจากระบบที่ไหน ออกทั้งสองที่) · แคชรูปอีเวนต์
- ทดสอบในเบราว์เซอร์: clear เปิดเปล่า · งานแอปหลักยังอยู่ · SW สองตัวแยก scope · ไม่มี JS error · ยังไม่ได้ลองล็อกอินจริง/มือถือจริง
