# ปุ่มลัด Student OS สำหรับ Android

ชุดนี้เปิด **เว็บหลัก** `https://nadokagenou.github.io/studentos-ai/` ตามคำสั่งเจ้าของ ตั้งค่าได้จาก **＋ → ปุ่มลัด Android** ไม่มีหน้าตัวอย่างแยกแล้ว ลิงก์เก่าจะส่งกลับไปแผงตั้งค่าในแอปเดิม

- Quick Settings: TileService “เพิ่มงาน Student OS” เปิดปุ่ม ＋ ในเว็บหลักโดยตรง ไม่มีแผงร่างกลางทาง ปลดล็อกก่อน ใช้ PendingIntent สำหรับ Android 14 ขึ้นไป; Android 13 ขึ้นไปมีคำขอเพิ่ม tile จากปุ่มตั้งค่า รุ่นเก่าเพิ่มจากเมนูแก้ไขแผงเอง
- ผู้ช่วย: Activity รับ ACTION_ASSIST แสดงแผงด้านล่าง ขอเลือกบทบาทผ่าน RoleManager เมื่อผู้ใช้กดเท่านั้น ไม่อ่าน AssistStructure/ภาพหน้าจอ ไม่ทำ accessibility service ไม่ขอ overlay ไม่มี hotword ไม่มีไมค์เบื้องหลัง
- กดไอคอนค้าง: static shortcuts 4 รายการ ส่วน PWA manifest มี 4 รายการตรงกัน
- ไอคอนแอปเสริมเปิดเว็บหลักทันที หน้าตั้งค่าของ Android เข้าจากปุ่มในเว็บผ่าน `studentos://setup` ไม่ขอเปลี่ยนผู้ช่วยหรือเพิ่ม tile อัตโนมัติ
- เสียง: เปิด RecognizerIntent ของเครื่องเฉพาะเมื่อกด อาจใช้บริการออนไลน์ของผู้ให้บริการเสียง ไม่มีการขอ RECORD_AUDIO หรือ INTERNET ในแอปนี้
- ข้อความส่งผ่าน URL fragment ไปเว็บก่อนถูกล้าง เก็บร่าง sessionStorage ชั่วคราวไม่เกิน 10 นาที ไม่ส่งอัตโนมัติ ไม่บันทึกงานหรือหักโทเคนเอง จำกัดงาน 500/คำถาม 2,000 ตัวอักษร และยังผ่าน login/onboarding เดิม
- เปิดเบราว์เซอร์ภายนอก ไม่ใช้ WebView จึงใช้บัญชีของเบราว์เซอร์นั้น บางเครื่องอาจเปิด PWA ที่ติดตั้งแล้วโดย Android ถ้าเลือกเบราว์เซอร์อื่นต้องล็อกอินอีกครั้ง

## สร้างไฟล์

มีโปรเจกต์ Gradle สำหรับ Android Studio (JDK 17, SDK 35, AGP 8.9.2) และ `build-preview.ps1` สำหรับเครื่องมือ SDK ทางการที่ติดตั้งไว้แล้ว:

```powershell
./build-preview.ps1 -AndroidJar '<SDK>/platforms/android-35/android.jar' -BuildTools '<SDK>/build-tools/35.0.0' -Jdk '<JDK17>'
```

APK นี้เป็น **debug preview** สำหรับทดลองด้วยตนเอง ไม่ใช่ release ที่ลง Play Store กุญแจ debug สร้างใน `build/preview.jks` ไม่ลง git (รหัส debug มาตรฐาน android ไม่ใช้เป็นกุญแจ production) เก็บไฟล์กุญแจไว้ในเครื่องเดิมถ้าจะอัปเดต APK ทับตัวเดิม การสร้าง APK ด้วยกุญแจอื่นต้องถอนตัวเดิมก่อน ไม่มีฐานข้อมูลแอปให้สูญหาย แต่ต้องเลือกผู้ช่วย/เพิ่ม tile ใหม่

## ตรวจแล้ว / ยังต้องทดสอบ

สร้าง Java → DEX → APK ด้วย SDK 35 และตรวจ APK Signature v2/v3 ผ่าน ไม่มีสิทธิ์อ่านข้อมูล/ไมค์/overlay ใน manifest; ทดสอบร่างและตัวรับลิงก์บนเว็บด้วย Node และเบราว์เซอร์

**ยังไม่ได้ติดตั้งหรือทดลองบน Android จริงหรือ emulator** ต้องตรวจบนเครื่องผู้ใช้: ขอเพิ่ม tile/ยกเลิก, กดจากหน้าล็อก, เรียกผู้ช่วย/ยกเลิกเลือกบทบาท/คืนค่า Gemini, เสียง/ไม่มีแอปรู้จำเสียง, คีย์บอร์ดและหมุนจอ, เลือกเบราว์เซอร์, เข้าเว็บครั้งแรกก่อนล็อกอิน และเมนู launcher แต่ละยี่ห้อ

คู่มือหลัก: https://developer.android.com/develop/ui/views/quicksettings-tiles · https://developer.android.com/reference/android/app/role/RoleManager · https://developer.android.com/develop/ui/views/launch/shortcuts/creating-shortcuts
