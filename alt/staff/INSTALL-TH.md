# Student OS · Control Room

สถานะ 16 ต.ค. 2569: **ติดตั้งฐานข้อมูล/Edge Functions เผยแพร่หน้าเว็บ ล็อกอิน GitHub เข้าแอดมิน และเปิด cron ส่งแจ้งเตือนแล้ว** เพิ่มการเชื่อมเว็บหลัก ข่าวในกระดิ่ง และแจ้งเตือนเครดิตเฉพาะผู้รับแล้ว ผลทดสอบจริงล่าสุดดูใน [STATUS.md](STATUS.md)

หน้าแรกและสำรวจแอปที่เจ้าของอนุมัติ เผยแพร่ ALT แล้วด้วย commit `4b65292` การเปลี่ยนแปลงหลังบ้านชุดนี้แยกจากชุดนั้น

## สิ่งที่ทำได้เมื่อเจ้าของติดตั้งครบ

- แสดงบัญชีที่เคยซิงก์ ค้นหาชื่อ/ชื่อผู้ใช้/รหัสบัญชี และเวลาซิงก์ล่าสุด ไม่อ่านการบ้านหรืออีเมลของผู้ใช้มาโชว์
- เพิ่มโทเคน 1–10,000 ต่อรายการ พร้อมเหตุผล ประวัติ และรหัสกันคำขอซ้ำ ยอดรวมต่อผู้จัดการไม่เกิน 100,000 ต่อวันไทย
- บันทึกประกาศเป็นร่าง ตรวจข้อความก่อนเผยแพร่ ตั้งเวลาหมดอายุ ถอนประกาศ และเลือกส่ง Push ได้
- คิว Push พัก 22:00–07:00 น. ลองส่งใหม่เมื่อชั่วคราวล้มเหลว แสดงยอดที่บริการ Push ตอบรับ ซึ่งไม่ใช่ยอดคนเปิดอ่าน
- ดูรายงานเนื้อหา/บัญชีที่มีอยู่แล้ว รับเรื่อง ปิดเรื่อง หรือเปิดตรวจใหม่ พร้อมบันทึกประวัติ

## สิทธิ์ที่เจ้าของเลือก

ผู้ร่วมพัฒนาที่ **มีสิทธิ์ push ใน `Nadokagenou/studentos-ai`** เข้าได้ทุกคน ไม่รวมคนที่เพียงเปิดอ่านรีโปสาธารณะ

ทุกคำขอตรวจ JWT กับ Supabase Auth จากนั้นตรวจว่า GitHub token เป็นของ identity เดียวกัน และถาม GitHub ว่ายังมีสิทธิ์ push ในรีโปนี้หรือไม่ ไม่เชื่อ `user_metadata.admin` อีเมล ชื่อผู้ใช้ที่ client ส่งมา หรือการซ่อนปุ่ม

หน้าเว็บไม่ได้ใช้ service-role key กุญแจนั้นอยู่เฉพาะ Edge Functions เท่านั้น หน้า Login อาจถูกเปิด URL ได้ แต่ข้อมูลและคำสั่งหลังบ้านจะถูกปฏิเสธถ้าไม่มีสิทธิ์

## ขั้นตอนติดตั้งและส่วนที่ยังต้องทำ

โปรเจกต์เดิม: `yunbytxtgghizrdqftvj` ต้องใช้บัญชีที่มีสิทธิ์จัดการโปรเจกต์นี้ การเป็น collaborator บน GitHub ไม่ได้ให้สิทธิ์ Supabase โดยอัตโนมัติ

1. **เสร็จแล้ว**: ติดตั้ง [backend/migration.sql](backend/migration.sql) ผ่านตัวเชื่อมด้วยชื่อ `studentos_staff_control_room` ชุดนี้เพิ่มตารางใหม่และ trigger รักษาเครดิตแอดมิน ไม่เปลี่ยนคีย์ข้อมูลเดิม และไม่ย้ายงานผู้ใช้ไปตารางใหม่
2. สร้าง GitHub OAuth App สำหรับ Student OS Control Room ที่ [GitHub Developer settings](https://github.com/settings/developers)
   - Homepage: `https://nadokagenou.github.io/studentos-ai/alt/staff/`
   - Callback: `https://yunbytxtgghizrdqftvj.supabase.co/auth/v1/callback`
   - ไม่ต้องเปิด Device Flow
3. Supabase → Authentication → Sign In / Providers → GitHub: ใส่ Client ID/Secret จาก OAuth App แล้วเปิดใช้ Secret ต้องกรอกใน Supabase โดยตรง **ห้ามใส่ใน repo หรือส่งในแชท**
4. Authentication → URL Configuration เพิ่ม Redirect URL ของเว็บแอดมิน `https://nadokagenou.github.io/studentos-ai/alt/staff/` โดยไม่เปลี่ยน Site URL ของแอปนักเรียน ถ้าจะทดสอบในเครื่อง เพิ่ม URL localhost ที่ใช้จริงแยกเป็นรายการ แล้วเอาออกเมื่อเลิกใช้
5. **เสร็จแล้ว**: deploy ผ่านตัวเชื่อมทั้งสองฟังก์ชันเป็นรุ่น 1 ACTIVE คำสั่งต่อไปนี้เก็บไว้สำหรับอัปเดตภายหลังด้วย Supabase CLI:

   ```sh
   supabase login
   supabase --workdir alt/staff/backend functions deploy staff-console --project-ref yunbytxtgghizrdqftvj --no-verify-jwt
   supabase --workdir alt/staff/backend functions deploy staff-notify --project-ref yunbytxtgghizrdqftvj --no-verify-jwt
   ```

   Gateway JWT ถูกปิดเพราะ handler ตรวจเอง: `staff-console` เรียก Auth.getUser และ GitHub ทุกครั้ง ส่วน `staff-notify` รับ runtime service key หรือให้ Supabase ตรวจ bearer ของผู้เรียกผ่าน HEAD แบบ 0 แถวบน staff_audit ซึ่งให้ SELECT เฉพาะ service_role การตรวจนี้ห้ามถอดหรือเปิด SELECT ตารางนี้ให้ anon/authenticated
6. ตรวจ Secrets เดิมว่ามี `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` ตรงกับแอปเดิม ไม่ต้องสร้างกุญแจ VAPID ชุดใหม่ เพราะเครื่องผู้ใช้ลงทะเบียนกับชุดเดิมแล้ว
   - `STAFF_ALLOWED_ORIGINS` ค่าเริ่มต้น `https://nadokagenou.github.io` รองรับหลาย origin คั่นด้วย comma
   - จะทดสอบหน้าจอในเครื่องกับระบบจริง ต้องใส่ origin localhost ที่ใช้จริงเป็นรายการอนุญาตด้วย ไม่ใช้ `*`
7. **เสร็จแล้ว**: ผู้ใช้เก็บ service-role key ลง Vault ด้วยตนเอง และเปิด worker ทุกนาทีตาม [backend/schedule.sql](backend/schedule.sql) ไม่ใส่ key จริงลงไฟล์ SQL ใน repo ถ้าปรับกุญแจในอนาคตต้องอัปเดต Vault ให้ตรงและทดสอบ worker อีกครั้ง
8. **เผยแพร่แล้วและ collaborator เข้าได้จริงแล้ว** ที่ `/alt/staff/` การทดสอบบัญชีไม่มีสิทธิ์ผ่านชุดจำลอง แต่ยังไม่ได้สลับล็อกอินบัญชีอื่นจริง

## ทดสอบยอมรับก่อนเปิดใช้งานจริง

- collaborator เข้าได้ คนอ่าน repo อย่างเดียวเข้าไม่ได้ ถอดสิทธิ์บน GitHub แล้วคำขอถัดไปต้องถูกปฏิเสธ
- เลือกบัญชีทดสอบที่เคยซิงก์ เพิ่มยอดเล็ก ๆ หนึ่งรายการ รีเฟรชคำขอเดิมต้องไม่เพิ่มซ้ำ แล้วให้ผู้รับซิงก์ตรวจยอด
- ตรวจว่าชื่องาน การบ้าน และของสะสมของผู้รับยังอยู่ครบ
- ทดสอบประกาศบนเว็บหลักและ ALT ต้องเห็นร่างเฉพาะแอดมิน ประกาศเผยแพร่จึงปรากฏในข่าวสารและกระดิ่ง ถอนแล้วหายเมื่อดึงข่าวใหม่
- ทดสอบ Push กับบัญชี/เครื่องของทีมที่อนุญาตไว้จริง ตรวจคิวและ quiet hours ก่อนส่งข้อความถึงผู้ใช้ทั้งหมด
- ตัวอย่าง preview ใช้ข้อมูลปลอม ส่วนรายการทดสอบจริงที่เจ้าของอนุญาตให้ดูผลใน STATUS.md

## ข้อจำกัดที่ควรรู้

- รายชื่อและจำนวนใช้ข้อมูลบัญชีที่เคยซิงก์ ไม่ได้นับ guest และเวลาซิงก์ล่าสุดไม่เท่ากับกำลังออนไลน์
- ข่าวจากหลังบ้านเชื่อมกับเว็บหลักและ ALT แล้ว แจ้งเตือนเครดิตอ่านได้เฉพาะผู้รับผ่าน auth.uid(); ข่าวสาธารณะไม่คืนรายการส่วนตัว
- โทเคนเดิมเป็นยอดใน client ที่ซิงก์แบบ snapshot ตัว ledger/trigger ชุดนี้กันการแจกคำขอเดิมซ้ำ และรักษาเครดิตแอดมินเมื่อเครื่องเก่าส่ง snapshot กลับมา แต่ **ไม่ได้ย้ายทั้งกระเป๋าโทเคนเป็นบัญชีฝั่งเซิร์ฟเวอร์ที่กันโกงหรือ double-spend ข้ามอุปกรณ์ทั้งหมด** ควรทำ server wallet เป็นงานถัดไปถ้าโทเคนมีมูลค่าหรือมีการแข่งขันจริง
- ผู้จัดการทุกคนที่มีสิทธิ์แก้ repo ทำรายการทั้งสามอย่างได้ ตามที่เจ้าของเลือก ยังไม่ได้แยกบทบาท support/editor/owner
- รายงานที่เห็นคือรายงานเนื้อหา/บัญชีเดิม ยังไม่ได้เพิ่มฟอร์มรายงานบั๊กแอปแยกต่างหาก
- การถอนประกาศยกเลิกเฉพาะคิวที่ยังไม่เริ่มส่ง การแจ้งเตือนที่บริการรับไปแล้วเรียกคืนไม่ได้

## ตรวจในเครื่อง

ตัวอย่าง: `http://127.0.0.1:8792/alt/staff/preview.html` ใช้ข้อมูลปลอมและไม่เรียก API จัดการข้อมูลจริง ข้อมูลตัวอย่างหายเมื่อโหลดหน้าใหม่

```sh
pnpm --dir alt/staff/backend install --frozen-lockfile --ignore-scripts
node --test --test-isolation=none alt/staff/tests/security.test.mjs alt/staff/tests/database.test.mjs
cd alt/staff/backend
deno check --node-modules-dir=auto functions/staff-console/index.ts functions/staff-notify/index.ts
```

ฐานข้อมูลทดสอบเป็น PostgreSQL จำลองด้วย PGlite ไม่ใช่ฐานข้อมูลจริง ไม่ได้ทดสอบ load หรือคำขอพร้อมกันหลายเครื่องจริง

อ้างอิงการตั้งค่า: [GitHub sign-in ของ Supabase](https://supabase.com/docs/guides/auth/social-login/auth-github), [Database Functions](https://supabase.com/docs/guides/database/functions), [สิทธิ์ RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
