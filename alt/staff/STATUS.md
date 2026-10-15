# สถานะ Control Room — 15 ตุลาคม 2569

## อัปเดตการเข้าถึง Supabase

ผู้ใช้อนุมัติ “เอาเลย” หลังตรวจชุดติดตั้งแล้ว ติดตั้ง migration `studentos_staff_control_room` ในโปรเจกต์ `yunbytxtgghizrdqftvj` สำเร็จ และ deploy `staff-console` / `staff-notify` รุ่น 1 สถานะ ACTIVE ทั้งคู่แล้ว ยังไม่ถือว่าเปิดใช้งานครบ เพราะ GitHub Provider ยังปิดอยู่และยังไม่มี cron ของ staff-notify

- ตารางใหม่ทั้ง 5 เปิด RLS และ anon/authenticated ไม่มีสิทธิ์ SELECT
- RPC จัดการ/แจกโทเคน/claim push และ trigger function ให้ EXECUTE เฉพาะ service_role; public notices RPC เปิดอ่านเฉพาะข่าวเผยแพร่แล้วตามที่ออกแบบ
- ตรวจ HTTP จริง: ไม่ล็อกอิน/เซสชันปลอม 401, origin นอก allowlist 403, worker ไม่มีสิทธิ์ 401, ตาราง audit 401, public notices 200 และเป็นรายการว่าง
- trigger `staff_reconcile_tokens` ติดตั้งแล้ว ตารางหลังบ้านทั้ง 5 ยังว่าง ไม่มีการแจกโทเคน/ประกาศ/Push จริงระหว่างตรวจ
- Security Advisor มีรายการเพิ่มตามการออกแบบ: RLS ไม่มี policy บนตาราง server-only 5 ตาราง และ public notices SECURITY DEFINER RPC สำหรับ anon/authenticated อย่างละ 1; คำเตือนเดิมยังอยู่ ไม่ได้อ้างว่าทั้งโปรเจกต์ปลอดช่องโหว่
- Vault ไม่มี secret ชื่อ service/staff และยังไม่มี staff cron จึงยังไม่ได้เปิดตัวส่ง Push อัตโนมัติ

## ขึ้นเว็บแล้ว

หน้าแรกฉบับเรียบ หน้า “ฉัน” แบบสี่หมวด และหน้าสำรวจฟีเจอร์: ALT commit `4b65292`
ตรวจไฟล์ app.js, index.html, alt.css, sw.js จากเว็บจริงตรงกับ commit นี้แล้ว เว็บหลักรากไม่ถูกแก้ใน release นี้

## ส่วนเว็บยังอยู่ในเครื่อง

- เว็บแยก Student OS Control Room และตัวอย่างข้อมูลจำลอง
- Edge Functions `staff-console`, `staff-notify` และ migration ฐานข้อมูลติดตั้งจริงแล้ว
- สะพานข่าวสาร/ยอดเครดิตสำหรับ ALT, เปิดหน้าข่าวจากการกด Push, แยกแคชหน้าแอดมินจากแอปนักเรียน
- ยังไม่ได้เปิด GitHub Provider ตั้ง cron หรือเผยแพร่ไฟล์เว็บชุดหลังบ้านนี้
- ตรวจ Auth settings จริงแล้ว GitHub Provider ยังปิด; public notices RPC ตอบ 200
- Dashboard ในเบราว์เซอร์ยังต้องล็อกอิน การกด Continue with GitHub ถูก automatic approval review ปฏิเสธเพราะต้องมีการอนุญาต sign-in บัญชีนี้โดยเฉพาะ ไม่ได้ข้ามข้อจำกัดนี้ ตัวเชื่อม Supabase ใช้งานได้แยกจาก session ในเบราว์เซอร์

## ตรวจแล้ว

- Security/PostgreSQL/news/credit bridge: **28/28 ผ่าน** ใช้ฐานข้อมูลจำลอง ไม่มีข้อมูลนักเรียนจริง
- ติดตั้ง migration ซ้ำได้ในฐานข้อมูลจำลอง
- Deno check ผ่านทั้งสอง Edge Functions (Supabase JS 2.117.3 / web-push 3.6.7)
- แอปเดิม: parser 100/100, draw recovery 10/10, AI plan context 3/3 ผ่าน
- Service worker 3/3 และข่าวจากไฟล์ 6 ประกาศผ่านตัวตรวจ
- ลอง UI จำลอง: ค้นหาผู้ใช้แบบ @ชื่อ, เพิ่มโทเคน/บันทึกประวัติ, กด Escape ยกเลิกหลังเคยยืนยันแล้วไม่เพิ่มซ้ำ, บันทึก/เผยแพร่ร่าง, รับเรื่องและหมายเหตุทีม
- หน้าจริงเมื่อยังไม่เปิด GitHub แสดงหน้าล็อกอินพร้อมข้อความตั้งค่า และไม่เปิดข้อมูลหลังบ้าน
- เปิดแอปด้วย `?go=staff-news` แล้วเข้า scr-news ได้
- ไม่พบ console error ในแท็บตัวอย่างที่ตรวจ
- ตรวจ layout บนจอ desktop และจอแคบ 711px ไม่มีล้นแนวนอน; การบังคับ viewport 375px ของเครื่องมือไม่ยึดกับแท็บนี้ จึงยังไม่อ้างว่าผ่านขนาดมือถือ 375px หรืออุปกรณ์ Android จริง

## ยังต้องตรวจหลังเจ้าของติดตั้งจริง

OAuth GitHub/สิทธิ์ collaborator, เพิ่มโทเคนบัญชีทดสอบและซิงก์หลายอุปกรณ์จริง, ข่าวจากฐานข้อมูลจริง, Push ถึงเครื่องจริง/quiet hours/cron และการถูกถอนสิทธิ์ GitHub

ข้อจำกัดสำคัญ: เครดิตแอดมินมี ledger และ receipt กันคำขอซ้ำ แต่ wallet เดิมของแอปยังรับยอดจาก client ไม่ใช่ระบบบัญชีโทเคนฝั่งเซิร์ฟเวอร์ที่กันโกงครบถ้วน ดู INSTALL-TH.md ก่อนเปิดใช้จริง
