# ส่งเควสไม่ได้แม้ของครบ · 28 ตุลาคม 2569

ผู้ใช้รายงานว่าทุกคนติด ส่งเควสไม่ได้ และรอช้า จึงตรวจบริการ production จริงแทนการอาศัย preview

สาเหตุที่ยืนยัน: experience.js ส่ง action.branch=null สำหรับเควสทั่วไป แต่ Authority.clean ในบริการ halloween-event v5 รับเฉพาะ string/number/boolean เมื่อค่ามิใช่ undefined จึงคืน HTTP400 รูปแบบคำสั่งไม่ถูกต้อง ก่อนตรวจเงื่อนไขเควส Preview ไม่ผ่าน validator นี้ ชุดตรวจเดิมจึงพลาด ประวัติ requests วันนี้ไม่มี quest ที่บันทึกสำเร็จ ณเวลาตรวจ

1. ข้ามเฉพาะ optional branch:null ให้มีความหมายเหมือนไม่ระบุ branch รักษาการตรวจคำสั่งอื่นไว้ทั้งหมด และหน้า main ใหม่ไม่ส่ง branch เมื่อว่าง
2. regression วิ่งผ่าน HTTP handler -> validator -> engine -> commit จำลอง: ผู้เล่นใหม่รับชุดเริ่มต้นแล้วส่ง Tang ด้วย branch:null ได้ หัก50Candy/ส่วนผสม ได้ตะเกียงหนึ่งชิ้น ส่งซ้ำ receiptเดิมไม่แจกซ้ำ เทสต์แดงก่อนแก้และผ่านหลังแก้
3. ส่ง backend v6 ACTIVE/JWT แล้ว ดาวน์โหลดกลับมาตรวจ index.ts/engine.mjs/rules.json ตรงกับแพตช์ที่ส่ง มีเพียงหนึ่งบรรทัด validator เปลี่ยน ไม่แก้สูตร/ราคา/เซฟ/สิทธิ์

4. บริการ v7 ACTIVE/JWT ลดเส้นทางบันทึกปกติจาก receipt→read→commit→read เป็น receipt/read ขนานกัน→commit แล้วคืนเอกสารที่เพิ่ง commit ลดฐานข้อมูลจาก4เป็น3คำขอและช่วงรอต่อกันจาก4เหลือ2 ส่งซ้ำ/แข่งกันยังอ่าน snapshot ใหม่ ไม่ลดการตรวจบัญชี/receipt/CAS
5. เพิ่มการตรวจครบ18เฟสเควสผ่าน HTTP validator และ authoritative engine โดยเตรียม inventory/เงื่อนไขใน fixture ไม่ใช่เล่นจริงจากศูนย์; ตรวจ fresh Tang จากชุดเริ่มต้น/ส่งซ้ำ/คำขอพร้อมกัน/stale snapshot ของ replay ผ่าน รวม12เคสบริการ
6. ชุดรวม364ผ่าน ดาวน์โหลดบริการ v7 กลับมาตรงกับไฟล์ที่ส่งทั้ง3ไฟล์ แล้วรัน12เคสเดิมกับ bundle ที่ดาวน์โหลดกลับจริงผ่านอีกครั้ง
7. main account-store รวมคำขอ refresh ที่ซ้อนกันไว้เป็นการอ่านครั้งเดียว ไม่ต่อคิวอ่าน3ครั้งก่อนให้ผู้เล่นทำรายการ เทสต์แสดง read/read/read/action ก่อนแก้ และ read/action หลังแก้ รักษา timeout/receipt/สลับบัญชีไว้

## ทดสอบบริการจริงหลังผู้ใช้อนุญาตบัญชี QA ชั่วคราว

- บัญชี QA ใหม่ผ่าน Auth จริง รับชุดเริ่มต้น50Candy+ส่วนผสม ส่ง Tang ด้วย branch:null สำเร็จ ได้ตะเกียง1 หักCandyเหลือ0 ส่งreceiptเดิมซ้ำได้replay/revision3เท่าเดิม ตะเกียงยัง1 ตรวจฐานข้อมูลยืนยันก่อนลบ
- รอบแรก v7 auto Singapore: read3333ms / enter-hub2172 / welcome3456 / quest4158 / replay1762 เป็นเวลาจากเครื่องที่ทดสอบ ไม่ใช่มือถือทุกเครื่อง
- ตรวจlogยืนยัน executionในบริการใช้เวลาใกล้ทั้งหมด ไม่ใช่เพียงการวาดหน้าจอ บริการ autoอยู่ ap-southeast-1 แต่ฐานข้อมูลอยู่ ap-southeast-2
- รอบเทียบคำขอบันทึก enter-hub แบบเดียวกันสลับภูมิภาค: Singapore2752/2002ms, Sydney1374/1238ms รอบส่ง Tang ที่Sydney543ms (เป็นผลครั้งนั้น ไม่รับรองทุกครั้ง)
- main ส่งเฉพาะการบันทึกไปภูมิภาคฐานข้อมูลผ่าน forceFunctionRegion ตาม [Supabase regional invocations](https://supabase.com/docs/guides/functions/regional-invocation) การอ่านยังauto ถ้ารายการตอบหายหรือเครือข่ายล้มเหลวใช้เส้นทางautoสำรองและreceiptเดิม ไม่เพิ่มหัวCORSหรือเปลี่ยนJWT
- บัญชีQAทั้งสองชุด signoutและลบทันทีหลังจบการตรวจแต่ละชุด ตรวจ users/identities/sessions/event state/event receipts/profile/user_state/economy/baseline เป็น0ครบ ไฟล์credentialsถูกลบ ไม่มีการใช้บัญชีหรือรางวัลผู้เล่นจริง
