# รายงานปัญหาแอป — ตัวอย่างในเครื่อง 16 ตุลาคม 2569

สถานะ 16 ตุลาคม 2569: เจ้าของสั่งเปิดชุดนี้ให้ลองเฉพาะ ALT แล้ว ติดตั้ง migration `studentos_bug_reports` และ staff-console รุ่น 3 ACTIVE ในโปรเจกต์เดิม คงรุ่นแอป 1C59 และไม่ย้ายฟีเจอร์ขึ้น root

## สิ่งที่ทำ

- ทางเข้าในแอป ALT: ฉัน → ข่าวสารและช่วยเหลือ → รายงานปัญหาแอป (หรือสำรวจแอปแล้วค้นหารายงาน)
- ฟอร์มหมวด/หน้าที่พบ/สรุปอาการ/รายละเอียด/ขั้นตอนทำซ้ำ/ผลที่คาดหวัง
- ไม่แนบข้อมูลโดยอัตโนมัติ ผู้ใช้เลือกยินยอมแนบเฉพาะรุ่นแอปและโหมดเบราว์เซอร์หรือ PWA ได้ ค่าเริ่มต้นไม่เลือก
- รายการเรื่องของฉันและประวัติสถานะ ใหม่/กำลังตรวจ/ต้องการข้อมูลเพิ่ม/แก้แล้ว พร้อมข้อความล่าสุดจากทีม
- ทีมจัดการใน Control Room หน้า “รายงานที่รอตรวจ” เดิม แยกส่วนปัญหาแอปจากรายงานเนื้อหา/บัญชี
- ถ้าขอข้อมูลเพิ่ม นักเรียนตอบในเรื่องเดิมได้ แล้วสถานะกลับเป็นกำลังตรวจ
- สถานะและคำตอบแจ้งในเรื่องของผู้รายงานเมื่อเปิดหรือกดอัปเดต ไม่มี Push ประกาศหรือโทเคนจากเส้นนี้
- แบ่งหน้าครั้งละ 20 เรื่อง ประวัติที่แสดงเป็น 100 เหตุการณ์ล่าสุด

## ลองตัวอย่าง

ส่วนนี้เป็นตัวอย่างก่อนเผยแพร่ ไฟล์ devtools สำหรับเซิร์ฟเวอร์และบัญชีจำลองทั้งสามไฟล์เก็บเฉพาะเครื่องทำงาน ไม่รวม release นี้ ดึง repo อย่างเดียวจึงไม่มีเซิร์ฟเวอร์ตัวอย่าง เว็บ ALT จริงใช้บัญชีและฐานข้อมูลจริง

```powershell
node alt/devtools/bug-preview-server.mjs
```

- นักเรียน: http://127.0.0.1:8795/alt/devtools/bug-report-preview.html
- ทีม: http://127.0.0.1:8795/alt/staff/preview.html

ต้องมี PGlite dependency เดิมของ alt/staff/backend ก่อนเริ่ม ตัวอย่างใช้ SQL และสิทธิ์จริงของ PostgreSQL ใน PGlite พร้อมบัญชีปลอม A/B/ทีม ฐานข้อมูลอยู่ในหน่วยความจำและเริ่มใหม่เมื่อหยุดเซิร์ฟเวอร์ ไม่มี production credentials และไม่เรียก Supabase จริง ตัวอย่างหลังบ้านสร้างจาก index.html เดิมโดยเซิร์ฟเวอร์ จึงไม่ต้องดูแล dashboard สำเนา

พอร์ตฟังเฉพาะ 127.0.0.1; ตั้งพอร์ตอื่นได้ด้วย STUDENTOS_BUG_PREVIEW_PORT หากชนกับงานอื่น อย่าเปิดตัวอย่างทดสอบผ่านเว็บที่เผยแพร่

## การเก็บข้อมูลและสิทธิ์

- แยก bug_reports และ bug_report_events จาก reports เดิม เปิด RLS และให้ authenticated อ่านได้เฉพาะเรื่อง/ประวัติของตัวเอง
- ไม่อนุญาต client insert/update/delete โดยตรง การส่งและตอบผ่าน RPC ที่ตรวจ auth.uid() และเจ้าของเรื่องฝั่งฐานข้อมูล
- เส้นเขียนที่ต้องมีสิทธิ์สูงอยู่ใน studentos_private; public wrappers ใช้ SECURITY INVOKER พร้อมกำหนดสิทธิ์ EXECUTE ชัดเจน
- ทีมใช้ staff-console เดิม ตรวจ Supabase JWT + immutable GitHub identity + สิทธิ์ push ของรีโปทุกครั้งก่อนเรียก staff_bug_command ที่ให้เฉพาะ service_role
- ส่งรายงานไม่เกิน 5 เรื่องต่อ 24 ชั่วโมง/บัญชี และตอบข้อมูลเพิ่มไม่เกิน 10 ครั้งต่อ 24 ชั่วโมง ใช้ล็อกต่อบัญชีกันคำขอพร้อมกัน
- request_id กันส่ง/ตอบ/อัปเดตซ้ำเมื่อ retry; client เก็บร่างและรหัส retry ในหน่วยความจำเท่านั้น ไม่เก็บรายงานลง localStorage
- สลับบัญชีแล้วล้างร่างและรายการทันที พร้อมทิ้งคำตอบเครือข่ายที่กลับมาช้า ไม่ให้บัญชีใหม่เห็นของเดิม
- ข้อความถึงผู้รายงานเป็นข้อความที่เจ้าตัวอ่านได้ ไม่มีช่องหมายเหตุภายในทีมในระบบบั๊กชุดนี้ ประวัติ staff_audit ยังจำกัดสิทธิ์เหมือนเดิม
- เมื่อลบบัญชี รายงานและเหตุการณ์ถูกลบตาม foreign key; ไม่บันทึกการบ้าน แชต user agent URL เต็ม session หรือ credential ใน diagnostics

## ผลตรวจ

```powershell
node --test --test-isolation=none alt/staff/tests/bug-reports.test.mjs alt/staff/tests/bug-reports-ui.test.mjs alt/staff/tests/security.test.mjs alt/staff/tests/database.test.mjs alt/staff/tests/news-bridge.test.mjs alt/staff/tests/push-queue.test.mjs
git diff --check
```

- ชุดฐานข้อมูล/สิทธิ์/หลังบ้านเดิม 57/57 ผ่าน และชุด UI เพิ่ม 5/5 ผ่าน (รวม 62 ข้อ)
- ตรวจ SQL ทำงานจริงใน PGlite: กันอ่านข้ามบัญชี, กันแก้ตารางเอง/ปลอม staff, ตรวจ field/diagnostics, retry ไม่เพิ่มซ้ำ, rate cap, ขอข้อมูลและตอบกลับ, ประวัติและ pagination
- ตรวจว่าเส้นรายงานบั๊กไม่สร้าง staff_notices/staff_push_jobs/staff_token_grants และไม่แก้ user_state หรือรายงานเนื้อหาเดิม
- ทดสอบจากเบราว์เซอร์: ส่งเรื่องด้วยข้อมูลจำลอง, ทีมขอข้อมูล, นักเรียนตอบ, ทีมแก้แล้ว, ผู้รายงานเห็นข้อความ; สลับ A/B/guest แล้วข้อมูลไม่ค้างข้ามบัญชี
- ตรวจที่ 375×812: ฟอร์มในแอป ALT เปิดจากสำรวจหมวดช่วยเหลือได้ ไม่ล้นแนวนอน
- ยังไม่ได้ทดสอบมือถือจริง, offline ใน PWA หลังติดตั้งจริง, browser zoom 200%, การส่งเรื่องผ่าน backend จริง หรือโหลดพร้อมกันหลายคน ไม่อ้างผล PGlite แทน production
- ตอนเปิดใช้ ตรวจ schema/RLS/สิทธิ์จริงและ security advisors แล้ว รวมถึงตรวจ HTTP แบบอ่านอย่างเดียวผ่าน 4/4 ข้อ (schema ส่วนตัวไม่เปิด API, anon อ่านตาราง/RPC ไม่ได้, หลังบ้านยังต้องยืนยัน GitHub) ไม่พบ advisory ของตารางหรือฟังก์ชันรายงานบั๊กชุดใหม่
- ระบบอนุมัติอัตโนมัติปฏิเสธการทดสอบเขียนโดยเลือกบัญชีผู้ใช้จริง แม้เสนอให้ rollback จึงไม่รันสคริปต์นั้น ไม่สร้างรายงานทดสอบถาวร และไม่ใช้ช่องทางอื่นเลี่ยงข้อจำกัด ผลการส่ง/ตอบ/ปิดเรื่องเป็นผลทดสอบฐานข้อมูลและบัญชีจำลองในเครื่อง

## ขั้นตอนเปิดใช้ / ตรวจย้อนหลัง

1. fetch/status อีกครั้งและตรวจส่วนที่เพื่อนเปลี่ยน รักษางานร่างเดิมทั้งห้ารายการ ไม่รวม alt/manifest.json หรือ Android drafts ใน release
2. ตรวจว่า studentos_private ไม่เป็น exposed schema และนโยบาย auth.users/สิทธิ์พื้นฐานของโปรเจกต์ตรงกับสภาพทดสอบ
3. ติดตั้งเฉพาะ migration `backend/supabase/migrations/20261016030041_studentos_bug_reports.sql` ต่อจาก Control Room เดิม ในโปรเจกต์เดิม yunbytxtgghizrdqftvj แล้วตรวจ advisors และ query สิทธิ์เฉพาะชุดใหม่
4. deploy staff-console ที่เพิ่มเส้น bugs/bug_triage (คง custom auth และ verify_jwt เดิม) ไม่ต้อง deploy staff-notify หรือสร้าง OAuth/Vault ใหม่
5. เผยแพร่เฉพาะไฟล์ ALT ของชุดนี้ รวม bug-reports.js/css และรายการแคชใหม่ ไม่ยก ALT ทั้งก้อนไป root และไม่ตั้งเลขรุ่นใหม่เอง
6. ตรวจด้วยบัญชีทดสอบที่แยกจากผู้ใช้จริง ไม่ต้องส่งประกาศ แจกเครดิต หรือเรียก worker Push
7. หากต้องถอยงาน ให้ซ่อนทางเข้าชุดใหม่และคืน staff-console/ไฟล์ ALT เฉพาะชุดนี้ เก็บตารางและรายงานไว้ ไม่ DROP หรือลบข้อมูลที่คนส่งแล้ว

root, style.css, storage keys, อัตราสุ่ม, wallet, ลำดับสคริปต์เดิม และ studyPlan() ไม่ถูกเปลี่ยน งานร่าง manifest/REVIEW-PREVIEW/android-companion/devtools/preview.html/shortcut-draft.js คงเดิม

อ้างอิงหลักที่ตรวจตอนพัฒนา: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions), [Changelog](https://supabase.com/changelog)
