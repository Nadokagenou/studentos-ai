# FROSTBOUND v4.5.2 · Final Polish

## ฐานและขอบเขต

ซอร์สตั้งต้น `5f7a7b0762f164d0bf0160af8172849666ac238e` บน `feature/frostbound-v4.5.1-thai-localization` สาขาใหม่ `feature/frostbound-v4.5.2-final-polish` ขณะตรวจ PR #103–#106 เปิดอยู่และยังไม่มีอนุมัติ รุ่นเสถียรบนเว็บเล่นคือ v4.2 จุดย้อนกลับเฉพาะพรีวิวคือ v4.5.1 ที่ `d2f36d362c1a8545023ba788a13ab43c5e962327`

ซอร์สเกมที่แก้อยู่ใน `index.html`, `fonts.css`, `interface.css`, `landscape.css`, `localization/i18n.js`, `localization/th.js`, `main.js`, `playtest.html`, `render.js` และฟอนต์พร้อมใบอนุญาตใน `assets/fonts/` ผลวัดสมดุลก่อนและหลังตรงกันทุกไบต์

## ภาษาและตัวอักษร

- เกลาภาษาของผู้บรรยายให้สั้นลง ให้ Eldric พูดแบบพ่อค้าที่มีอารมณ์ขัน และให้ The Frozen King สื่อคำท้าด้วยประโยคสั้น ชื่อเฉพาะคงตาม Glossary และใช้ **ปัดป้องสมบูรณ์แบบ** สำหรับ Perfect Parry [ตารางเทียบอังกฤษและไทยทุกประโยคที่แก้](Thai-editorial-v4.5.2.md)
- Noto Sans Thai ใช้ในส่วนติดต่อทั้งไทยและอังกฤษ ส่วน Noto Serif Thai ใช้กับบทนำ บทสนทนา ซับ ข้อความเปิดด่านและเรื่องเล่าหน้าผลรอบ เก็บ WOFF2 ภาษาไทยและละตินของแต่ละตระกูลรวม **126,564 ไบต์** หน้าแรกใช้เฉพาะสองไฟล์ Sans รวม **57,672 ไบต์** โหลดจากเส้นทางของเกม พร้อมใบอนุญาต SIL OFL 1.1 [ต้นทาง Noto Sans Thai](https://github.com/google/fonts/tree/main/ofl/notosansthai) · [ต้นทาง Noto Serif Thai](https://github.com/google/fonts/tree/main/ofl/notoserifthai)
- Chrome ยืนยัน glyph ที่วาดจริง รุ่นเดิมใช้ Leelawadee UI และ Segoe UI รุ่นนี้ใช้ Noto Sans Thai และ Noto Serif Thai ตามตำแหน่ง เมื่อจำลองบล็อกไฟล์ฟอนต์ เกมยังเปิดเมนูและวาดอักษรไทยด้วย Leelawadee UI

## การจัดวาง

- บน 568×320 จัดซับ คำใบ้ และปุ่มโต้ตอบในช่องว่างระหว่างจอยกับปุ่มต่อสู้ ใช้ขอบจอปลอดภัยคำนวณพื้นที่ ป้ายประกาศเฟสและแถบเลือดบอสอยู่คนละแถว หัว HUD ให้ชื่อภูมิภาคและสถานะอันตรายขึ้นบรรทัดใหม่เป็นหน่วย
- ปุ่มสัมผัสหนัก พุ่ง ปัด โจมตี สกิล และยายังมีเป้ากดอย่างน้อย 44×44 พิกเซล ใช้คำเต็มในป้ายสำหรับโปรแกรมอ่านหน้าจอและบทฝึก
- การ์ดและเมนูจัดคำตามพื้นที่ แผงรายละเอียดอุปกรณ์เลื่อนภายในได้ ปุ่มซื้อและราคายังแสดง พร้อมปุ่มยืนยัน การแสดงข้อความ Canvas วัดกรอบ glyph แล้วจัดตำแหน่งให้ข้อความอยู่ในพื้นที่ที่มองเห็นแม้อยู่ขอบฉาก [ภาพตัวอย่างข้อความ Canvas บนจอแคบ](visual/v452/after/narrow-combat-feedback.jpg)
- การเปลี่ยนภาษาระหว่างเล่นใช้สถานะรอบเดิม ลดการคำนวณข้อความซ้ำเมื่อคีย์ ค่า และภาษาเหมือนเดิม

## ภาพจากเกมก่อนและหลัง

| มุมมอง | v4.5.1 | v4.5.2 |
|---|---|---|
| หน้าแรก TH | [ก่อน](visual/v452/before/desktop-thai.jpg) | [หลัง](visual/v452/after/desktop-thai.jpg) |
| หน้าแรก EN | [ก่อน](visual/v452/before/desktop-en.jpg) | [หลัง](visual/v452/after/desktop-en.jpg) |
| บทสนทนาเนื้อเรื่อง | [ก่อน](visual/v452/before/landscape-dialogue-thai.jpg) | [หลัง](visual/v452/after/landscape-dialogue-thai.jpg) |
| ร้านค้า | [ก่อน](visual/v452/before/landscape-merchant-thai.jpg) | [หลัง](visual/v452/after/landscape-merchant-thai.jpg) |
| กระเป๋าและรายละเอียดอุปกรณ์ | [ก่อน](visual/v452/before/landscape-inventory-thai.jpg) | [หลัง](visual/v452/after/landscape-inventory-thai.jpg) |
| เลือกรางวัล | [ก่อน](visual/v452/before/landscape-rewards-thai.jpg) | [หลัง](visual/v452/after/landscape-rewards-thai.jpg) |
| ตั้งค่า | [ก่อน](visual/v452/before/desktop-settings-thai.jpg) | [หลัง](visual/v452/after/desktop-settings-thai.jpg) |
| บทสนทนาก่อนสู้ The Frozen King | [ก่อน](visual/v452/before/landscape-boss-dialogue-thai.jpg) | [หลัง](visual/v452/after/landscape-boss-dialogue-thai.jpg) |
| ชัยชนะ | [ก่อน](visual/v452/before/landscape-victory-thai.jpg) | [หลัง](visual/v452/after/landscape-victory-thai.jpg) |
| พ่ายแพ้ | [ก่อน](visual/v452/before/landscape-defeat-thai.jpg) | [หลัง](visual/v452/after/landscape-defeat-thai.jpg) |
| ต่อสู้แนวนอน 844×390 | [ก่อน](visual/v452/before/landscape-story-thai.jpg) | [หลัง](visual/v452/after/landscape-story-thai.jpg) |
| ซับและป้ายเฟส 568×320 | [ก่อน](visual/v452/before/narrow-landscape.jpg) | [หลัง](visual/v452/after/narrow-landscape.jpg) |

## การทดสอบ

- Regression **85/85** ทั้งรุ่นฐานและรุ่นนี้ ผลสมดุลตรงกันทั้งสองไฟล์
- Chrome เล่น Story จบครบห้าภูมิภาคด้วย seed 4212 ตรวจเฟสบอสทั้งสาม เล่น Boss Rush จบ และตรวจ Hardcore การพ่ายแพ้ สถิติ และกฎ No-Save ทั้งไทยและอังกฤษ
- ตรวจข้อความ 54 จุดระหว่างรอบจริงและตรวจการจัดวางอีก 23 หน้าจอ รวมเงื่อนไขรอยบากจำลอง 18/32/38/16 px ทดสอบปุ่มสัมผัสทั้งหกร่วมกับการเคลื่อนที่ และหมุนจอ 58 ครั้ง ไม่พบข้อความอังกฤษทั่วไปหรือคีย์ที่ขาดในรอบภาษาไทย
- ทดสอบ 568×320, 740×360, 844×390, 932×430, 1024×768 และจอตั้ง 390×844 กับ Chrome emulation รวมทั้งเดสก์ท็อป ใช้เครื่องมือตรวจขอบกล่อง วัดข้อความ Canvas และอ่านฟอนต์ที่เบราว์เซอร์เลือก [ตำแหน่งและฟอนต์ก่อนแก้](visual/v452/layout-before.json) · [ตำแหน่งและฟอนต์หลังแก้](visual/v452/layout-after.json) · [ผลตรวจระหว่างรอบ](visual/v452/layout-campaign.json)
- Safari บน iPhone และ Chrome บน Android เครื่องจริงยังรอทีมทดสอบ

## ประสิทธิภาพ

Chrome บนเครื่องเดียวกัน สลับเก็บ v4.5.1 → v4.5.2 → v4.5.2 → v4.5.1 ใช้ seed 4212 และข้อความต่อสู้ Canvas สองข้อความในฉากเดียวกัน ตารางใช้ค่าเฉลี่ยของสองรอบ จอแนวนอนเป็นการจำลองบน Chrome

| หน้าจอ / กราฟิก | FPS | เฟรม p95 (ms) | เฟรม p99 (ms) | โค้ดวาด p95 (ms) | Heap หลัง GC (MiB) |
|---|---:|---:|---:|---:|---:|
| เดสก์ท็อป High | 59.91 → 59.91 | 16.80 → 16.80 | 16.80 → 16.80 | 0.45 → 0.50 | 3.057 → 3.073 |
| เดสก์ท็อป Low | 29.95 → 29.95 | 33.50 → 33.55 | 33.55 → 33.60 | 0.40 → 0.40 | 3.084 → 3.097 |
| มือถือแนวนอน High | 59.90 → 59.90 | 16.80 → 16.80 | 16.80 → 16.80 | 0.40 → 0.40 | 3.098 → 3.110 |
| มือถือแนวนอน Low | 29.95 → 29.95 | 33.50 → 33.50 | 33.55 → 33.60 | 0.40 → 0.40 | 3.126 → 3.138 |

- เวลาตอบสนองวัดจากกดถึงเกมรับคำสั่ง 24 ครั้งต่อรุ่นต่อหน้าจอ มัธยฐานเดสก์ท็อป 9.50 → 9.20 ms และสัมผัสจำลอง 15.50 → 15.20 ms ค่าสูงสุดเดสก์ท็อป 75.5 → 89.5 ms ในตัวอย่างชุดนี้
- เวลาเรียกใช้ชุดข้อความ HUD เฉพาะช่วงที่จับเวลาได้ p95 เดสก์ท็อป 0.20 → 0.20 ms และมือถือ 0.30 → 0.20 ms ช่วงวัดเฟรมไม่พบ long task ขนาดแคชฉากอยู่ที่ 2,242,560 ไบต์หลังสร้างซ้ำ 150 ครั้งทั้งสองรุ่น
- First Contentful Paint จากการเปิดหน้าใหม่ผ่านเส้นทางจำลองเดิมเฉลี่ยสองครั้ง เดสก์ท็อป 206 → 170 ms และมือถือแนวนอนจำลอง 148 → 178 ms ฟอนต์ไทย Sans ที่โหลดล่วงหน้ารับไฟล์จบ 46–57 ms หลังเริ่มหน้า ส่วนไฟล์ละตินรับจบ 151–172 ms เวลาจากการจำลองนี้ขึ้นกับเครื่องและการตอบสนองของเส้นทางไฟล์ [ผลเปิดหน้าแรกและโหลดฟอนต์](visual/v452/initial-paint.json)
- ข้อมูลการวัด [ฐานรอบ 1](visual/v452/profile-before-1.json) · [ฐานรอบ 2](visual/v452/profile-before-2.json) · [v4.5.2 รอบ 1](visual/v452/profile-after-1.json) · [v4.5.2 รอบ 2](visual/v452/profile-after-2.json)

## คำสั่งทดสอบ

ใช้ Node 24 และ Playwright ที่เปิด Chrome ได้ รันจากโฟลเดอร์เกม

```text
node --test --test-isolation=none tests/*.cjs
node tests/browser/landscape.cjs . <output-dir> --extended
node tests/browser/landscape.cjs <baseline-game-dir> <output-dir> --baseline
node tests/browser/campaign.cjs . <output-dir> --thai
node tests/browser/campaign.cjs . <output-dir>
node tests/browser/controls.cjs . <output-dir>
node tests/browser/faults.cjs .
node tests/browser/visual.cjs . <output-dir> --profile-only --landscape
node tests/stress/balance.cjs .
```
