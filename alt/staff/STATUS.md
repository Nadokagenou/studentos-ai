# สถานะ Control Room — 15 ตุลาคม 2569

## อัปเดตการเข้าถึง Supabase

ผู้ใช้อนุมัติ “เอาเลย” หลังตรวจชุดติดตั้งแล้ว ติดตั้ง migration `studentos_staff_control_room` ในโปรเจกต์ `yunbytxtgghizrdqftvj` สำเร็จ `staff-console` รุ่น 1 และ `staff-notify` รุ่น 2 ACTIVE GitHub Provider เปิดและล็อกอินจริงผ่านแล้ว cron `studentos-staff-notify` เปิดรันทุกนาทีแล้ว

## ผลตรวจระบบจริงล่าสุด

- ผู้ใช้สร้าง GitHub OAuth App และกรอก Client ID/Secret ใน Supabase ด้วยตนเอง ครั้งแรก Auth logs แจ้ง incorrect_client_credentials; หลังผู้ใช้แก้ Secret ล็อกอินสำเร็จ
- เพิ่ม redirect URL แบบตรงตัว `https://nadokagenou.github.io/studentos-ai/alt/staff/` และคง Site URL เดิม
- ผู้ใช้อนุญาตหน้าขอสิทธิ์ OAuth แล้ว ตรวจ GitHub write permission ผ่าน บัญชี @tanapat1604-cmd เข้า Control Room จริงได้
- ภาพรวมแสดงบัญชีที่เคยซิงก์ 20 บัญชี ซิงก์ใน 24 ชั่วโมง 6 บัญชี และรายงานที่ยังไม่ปิด 2 รายการ ณ เวลาตรวจ ไม่ใช่จำนวนออนไลน์
- ระหว่างตรวจพบ SQL alias `n` ชนกับตัวแปรใน users/notices; เพิ่มกรณีทดสอบให้เห็นข้อผิดพลาดก่อนแก้ แล้วติดตั้ง `fix_staff_user_pagination` และ `fix_staff_notice_list_alias` สำเร็จ
- หลังแก้ users คืน 20 รายการ, notices 0, issues 2, audit 0; หน้า users โหลดจริงได้ 20 แถวโดยไม่มีข้อความผิดพลาด ชุดทดสอบรวมผ่าน 29/29
- เพิ่มข้อความเมื่อ OAuth กลับมาพร้อม error และล้าง error ออกจาก URL โดยไม่สะท้อนข้อความดิบจาก provider
- ผู้ใช้เพิ่ม Vault `studentos_service_role_key` ภายใน Supabase ด้วยตนเองแล้ว ไม่เปิดดูหรือคัดลอกกุญแจเข้าแชท ตรวจเฉพาะ role/project/expiry และ HTTP สิทธิ์เข้าถึงตารางแบบ 0 แถว พบว่าเป็น service_role ของโปรเจกต์นี้และใช้ได้จริง
- ติดตั้ง migration `schedule_studentos_staff_notifications` เปิด cron ทุกนาที รุ่นแรกเทียบค่า key ใน runtime ตรงตัวแล้วปฏิเสธ dashboard service JWT ที่ใช้งานได้ จึงพัก cron ระหว่างแก้
- `staff-notify` รุ่น 2 ยอมรับ runtime key เดิม หรือให้ Supabase ตรวจ caller Authorization ผ่าน HEAD staff_audit แบบไม่อ่านข้อมูล ซึ่งอนุญาต SELECT เฉพาะ service_role ไม่เชื่อ role claim ที่ decode เอง และไม่เปิด client grants เพิ่ม
- ตรวจ HTTP จริงของ worker รุ่น 2: ไม่ส่ง token / token ปลอม / signed anon JWT ได้ 401 ทั้งหมด; service_role จาก Vault ได้ 200 `processed:0, accepted:0, retry_or_failed:0` (net request 4164) คิวว่างและไม่มีการส่ง Push จริง จากนั้นเปิด cron active=true แล้ว
- ตรวจการรันอัตโนมัติหลังเปิด cron: job_run_details สถานะ succeeded และ HTTP responses 4165/4166 ได้ 200 พร้อม processed=0 accepted=0 retry_or_failed=0
- รุ่น 2 ผ่าน Node syntax check และทดสอบจริงบน Supabase; Deno check รุ่น 1 ผ่านก่อนหน้านี้ แต่ครั้งล่าสุดตัวเรียก Deno ในเครื่องไม่พบ executable จึงไม่อ้างว่า type-check รุ่น 2 สำเร็จ

- ตารางใหม่ทั้ง 5 เปิด RLS และ anon/authenticated ไม่มีสิทธิ์ SELECT
- RPC จัดการ/แจกโทเคน/claim push และ trigger function ให้ EXECUTE เฉพาะ service_role; public notices RPC เปิดอ่านเฉพาะข่าวเผยแพร่แล้วตามที่ออกแบบ
- ตรวจ HTTP จริง: ไม่ล็อกอิน/เซสชันปลอม 401, origin นอก allowlist 403, worker ไม่มีสิทธิ์ 401, ตาราง audit 401, public notices 200 และเป็นรายการว่าง
- trigger `staff_reconcile_tokens` ติดตั้งแล้ว ตารางหลังบ้านทั้ง 5 ยังว่าง ไม่มีการแจกโทเคน/ประกาศ/Push จริงระหว่างตรวจ
- Security Advisor มีรายการเพิ่มตามการออกแบบ: RLS ไม่มี policy บนตาราง server-only 5 ตาราง และ public notices SECURITY DEFINER RPC สำหรับ anon/authenticated อย่างละ 1; คำเตือนเดิมยังอยู่ ไม่ได้อ้างว่าทั้งโปรเจกต์ปลอดช่องโหว่
- Vault และ staff cron พร้อมแล้ว ดูผลตรวจ worker รุ่น 2 ด้านบน

## ขึ้นเว็บแล้ว

หน้าแรกฉบับเรียบ หน้า “ฉัน” แบบสี่หมวด และหน้าสำรวจฟีเจอร์: ALT commit `4b65292`
ตรวจไฟล์ app.js, index.html, alt.css, sw.js จากเว็บจริงตรงกับ commit นี้แล้ว เว็บหลักรากไม่ถูกแก้ใน release นี้

## เว็บแอดมินเผยแพร่แล้ว

เผยแพร่ชุดแรก commit `dba8dd0b3685ab1275ed03d36254306e4283558b` ขึ้น main หลังรวมงานล่าสุดจากเพื่อน (`d8d8895`) GitHub Pages run `38759526371` สำเร็จ เปิดได้ที่ https://nadokagenou.github.io/studentos-ai/alt/staff/ ตรวจ SHA-256 ของ index.html, staff.js, staff.css, staff-news.js, app.js และ sw.js บนเว็บจริงตรงกับ commit ทั้ง 6 ไฟล์ ณ ตอนเผยแพร่ ช่วงแรกยังปิด Provider แต่ตอนนี้เปิดและยืนยันเข้าใช้งานจริงแล้ว

- เว็บแยก Student OS Control Room และตัวอย่างข้อมูลจำลอง
- Edge Functions `staff-console`, `staff-notify` และ migration ฐานข้อมูลติดตั้งจริงแล้ว
- สะพานข่าวสาร/ยอดเครดิตสำหรับ ALT, เปิดหน้าข่าวจากการกด Push, แยกแคชหน้าแอดมินจากแอปนักเรียน
- GitHub Provider เปิดแล้ว; ไฟล์เว็บเผยแพร่แล้ว (preview.html ข้อมูลจำลองไม่ถูกเผยแพร่)
- ตรวจ Auth settings จริงแล้ว GitHub เป็น true; public notices RPC ตอบ 200
- ผู้ใช้ล็อกอิน Dashboard และกรอกกุญแจด้วยตัวเองหลังอนุญาตขั้นตอนเฉพาะแล้ว ไม่มีการข้าม automatic approval review

## ตรวจแล้ว

- Security/PostgreSQL/news/credit bridge: **29/29 ผ่าน** ใช้ฐานข้อมูลจำลอง ไม่มีข้อมูลนักเรียนจริง
- ติดตั้ง migration ซ้ำได้ในฐานข้อมูลจำลอง
- Deno check ผ่านทั้งสอง Edge Functions (Supabase JS 2.117.3 / web-push 3.6.7)
- แอปเดิม: parser 100/100, draw recovery 10/10, AI plan context 3/3 ผ่าน
- Service worker 3/3 และข่าวจากไฟล์ 6 ประกาศผ่านตัวตรวจ
- ลอง UI จำลอง: ค้นหาผู้ใช้แบบ @ชื่อ, เพิ่มโทเคน/บันทึกประวัติ, กด Escape ยกเลิกหลังเคยยืนยันแล้วไม่เพิ่มซ้ำ, บันทึก/เผยแพร่ร่าง, รับเรื่องและหมายเหตุทีม
- หน้าจริงเมื่อยังไม่เปิด GitHub แสดงหน้าล็อกอินพร้อมข้อความตั้งค่า และไม่เปิดข้อมูลหลังบ้าน
- เปิดแอปด้วย `?go=staff-news` แล้วเข้า scr-news ได้
- ไม่พบ console error ในแท็บตัวอย่างที่ตรวจ
- ตรวจ layout บนจอ desktop และจอแคบ 711px ไม่มีล้นแนวนอน; การบังคับ viewport 375px ของเครื่องมือไม่ยึดกับแท็บนี้ จึงยังไม่อ้างว่าผ่านขนาดมือถือ 375px หรืออุปกรณ์ Android จริง

## ยังต้องตรวจต่อ

เพิ่มโทเคนบัญชีทดสอบและซิงก์หลายอุปกรณ์จริง, ประกาศที่เผยแพร่จากฐานข้อมูลจริง, Push ถึงเครื่องจริง/cron และการถูกถอนสิทธิ์ GitHub ไม่แจกโทเคนหรือเผยแพร่ข่าวจริงระหว่างตรวจแบบอ่านอย่างเดียว

ข้อจำกัดสำคัญ: เครดิตแอดมินมี ledger และ receipt กันคำขอซ้ำ แต่ wallet เดิมของแอปยังรับยอดจาก client ไม่ใช่ระบบบัญชีโทเคนฝั่งเซิร์ฟเวอร์ที่กันโกงครบถ้วน ดู INSTALL-TH.md ก่อนเปิดใช้จริง
