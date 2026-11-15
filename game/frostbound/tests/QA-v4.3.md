# FROSTBOUND v4.3 · The Dying Kingdom

ชุดพัฒนาต่อยอดจาก `team-games` ที่ commit `ca349e213af0aff7691f2662d5a3f9b0eea3061d` เปรียบเทียบกับไฟล์เล่น v4.2 ที่เผยแพร่จาก commit `ace95ed1c6cc01416e4d9d6923aa3849bdbff7b7` โดยตรวจว่าต้นไม้ไฟล์เกมในสอง commit ตรงกันก่อนเริ่ม

## ภาพจากเกมจริง

จับภาพด้วย Chrome จาก Canvas เกมที่เปิดผ่าน URL ย่อย `/frostbound-game/` ใช้ seed 4212 ห้อง ตำแหน่งกล้อง และ viewport เดียวกันทั้งสองรุ่น เดสก์ท็อป 1440×900 และจอสัมผัสจำลอง 390×664 (iPhone 13 preset)

| ภูมิภาค | v4.2 เดสก์ท็อป | v4.3 เดสก์ท็อป | v4.2 มือถือจำลอง | v4.3 มือถือจำลอง |
|---|---|---|---|---|
| Forgotten Outpost · ป้อมเฝ้าการณ์ที่พังและเสบียงที่ถูกทิ้ง | [ก่อน](visual/before/desktop-outpost.jpg) | [หลัง](visual/after/desktop-outpost.jpg) | [ก่อน](visual/before/mobile-outpost.jpg) | [หลัง](visual/after/mobile-outpost.jpg) |
| Hollowpine Forest · แนวป่าสนกับศาลเจ้าร้าง | [ก่อน](visual/before/desktop-forest.jpg) | [หลัง](visual/after/desktop-forest.jpg) | [ก่อน](visual/before/mobile-forest.jpg) | [หลัง](visual/after/mobile-forest.jpg) |
| Crystal Depths · ซากสะพานใต้ดินและแสงผลึก | [ก่อน](visual/before/desktop-depths.jpg) | [หลัง](visual/after/desktop-depths.jpg) | [ก่อน](visual/before/mobile-depths.jpg) | [หลัง](visual/after/mobile-depths.jpg) |
| Silent Capital · ถนนเมืองและหอระฆัง | [ก่อน](visual/before/desktop-capital.jpg) | [หลัง](visual/after/desktop-capital.jpg) | [ก่อน](visual/before/mobile-capital.jpg) | [หลัง](visual/after/mobile-capital.jpg) |
| Frozen Throne · ตราราชวงศ์ พื้นพิธี และแสงตามเฟส | [ก่อน](visual/before/desktop-throne.jpg) | [หลัง](visual/after/desktop-throne.jpg) | [ก่อน](visual/before/mobile-throne.jpg) | [หลัง](visual/after/mobile-throne.jpg) |

| ฉากเพิ่มเติม | ก่อน | หลัง |
|---|---|---|
| Merchant | [v4.2](visual/before/desktop-merchant.jpg) | [v4.3](visual/after/desktop-merchant.jpg) |
| Rest | [v4.2](visual/before/desktop-rest.jpg) | [v4.3](visual/after/desktop-rest.jpg) |
| Elite | [v4.2](visual/before/desktop-elite.jpg) | [v4.3](visual/after/desktop-elite.jpg) |
| Secret | [v4.2](visual/before/desktop-secret.jpg) | [v4.3](visual/after/desktop-secret.jpg) |
| Boss Rush · Crystal Warden | [v4.2](visual/before/desktop-boss.jpg) | [v4.3](visual/after/desktop-boss.jpg) |
| Frozen King · Phase 2 | [v4.2](visual/before/desktop-throne-phase-2.jpg) | [v4.3](visual/after/desktop-throne-phase-2.jpg) |
| Frozen King · Phase 3 | [v4.2](visual/before/desktop-throne-phase-3.jpg) | [v4.3](visual/after/desktop-throne-phase-3.jpg) |
| Low · เดสก์ท็อป | [v4.2](visual/before/desktop-forest-low.jpg) | [v4.3](visual/after/desktop-forest-low.jpg) |
| Low · มือถือจำลอง | [v4.2](visual/before/mobile-forest-low.jpg) | [v4.3](visual/after/mobile-forest-low.jpg) |

เฟสในชุดภาพถูกกำหนดไว้ให้เทียบแสงได้ตรงจังหวะ ส่วนการเปลี่ยนเฟส 2 และ 3 ตามกติกาจริงตรวจแยกใน Story Run ของ Chrome

## การวาดและการทดสอบ

- `world-art.js` กำหนดธีม ชุดฉากและพื้น สุ่มภาพจาก seed กับรหัสห้อง วาดฉากนิ่งลง Canvas แคชหนึ่งแผ่น และวาดรอยเท้า หิมะ แสงตามเฟส และเฟดสั้นโดยใช้ข้อมูลจากเกม
- `render.js` เรียกฉากใหม่ก่อนวาดอันตราย ตัวละคร และสัญญาณการโจมตี ตำแหน่งเสา ประตู ศัตรู และเส้นทางใช้ข้อมูลเกมเดิม
- `main.js` ใช้ AudioContext และ Music gain เดิมสำหรับเสียงบรรยากาศเบา ๆ ตามภูมิภาค ส่วน `index.html` แสดงรุ่น v4.3 และโหลดสคริปต์ด้วย path สัมพัทธ์
- Regression ก่อนแก้ 74/74 และหลังแก้ 77/77 การตรวจเพิ่มเติมครอบคลุม 50 seed ต่อโหมด การเปลี่ยนห้อง 100 ครั้ง สลับคุณภาพ 100 ครั้ง ปรับความละเอียด 50 ครั้ง และ Reduced Motion
- Automated Simulation 50 รอบ รวม 499 การเปลี่ยนห้อง ผ่านโดยไม่พบข้อผิดพลาด Story ชนะ 20/20, Hardcore ชนะ 1/20 และ Boss Rush ชนะ 10/10 ผลแพ้ใน Hardcore เป็นผลการเล่นปกติ
- Chrome แบบเดินเกมอัตโนมัติผ่านเส้นทาง Story ทั้งห้าภูมิภาค รวมร้านค้า ห้องพัก รางวัล ห้องลับ และ Frozen King ผ่านทั้งสอง phase transitions จบ Boss Rush ครบสามบอส และตรวจเส้นทาง Danger, Records กับ No-Save ใน Hardcore
- คีย์บอร์ดตรวจการเดิน โจมตีเบา/หนักครบหกกลุ่มอาวุธ และ Perfect Parry จอสัมผัสจำลองตรวจจอย โจมตีเบา/หนัก Dash, Parry, Potion และ Active Skill

## ประสิทธิภาพใน Chrome

วัดที่ห้อง Hollowpine Forest จากเครื่องเดียวกัน รุ่นละประมาณ 100 เฟรมต่อระดับ ตัวเลข 60/30 FPS สะท้อนเพดานของการวัดและระดับ Low จึงใช้เปรียบเทียบความถดถอยในฉากนี้ได้

| สภาพทดสอบ | FPS ก่อน → หลัง | p95 / p99 ก่อน → หลัง (ms) | เวลา JS วาด p95 (ms) | Heap หลัง GC (MiB) |
|---|---:|---:|---:|---:|
| เดสก์ท็อป High | 59.91 → 59.90 | 16.9 / 16.9 → 16.9 / 16.9 | 0.4 → 0.4 | 2.90 → 2.96 |
| เดสก์ท็อป Low | 29.95 → 29.95 | 33.6 / 33.6 → 33.5 / 33.6 | 0.3 → 0.3 | 2.92 → 2.97 |
| มือถือจำลอง High | 59.91 → 59.90 | 16.9 / 17.0 → 16.8 / 17.0 | 0.4 → 0.4 | 2.94 → 2.94 |
| มือถือจำลอง Low | 29.95 → 29.95 | 33.5 / 33.6 → 33.5 / 33.6 | 0.3 → 0.3 | 2.98 → 2.98 |

Canvas แคชใช้ 2.14 MiB ทั้งสองรุ่น อนุภาคบรรยากาศ High 102 → 49 และ Low 18 → 12 ไม่พบ long tasks หรือ JavaScript errors ในช่วงเก็บตัวอย่าง ค่า median จากเหตุการณ์ input ถึงการรับ light attack ใน simulation จาก 8 ครั้งต่อจอ อยู่ที่ 8.8 → 10.1 ms สำหรับคีย์บอร์ด และ 15.2 → 15.5 ms สำหรับจอสัมผัสจำลอง ดู [ข้อมูล v4.2](visual/before/metrics.json) และ [ข้อมูล v4.3](visual/after/metrics.json)

## รันทดสอบซ้ำ

รันจาก `game/frostbound` บน Node.js 24 สำหรับคำสั่ง Chrome ให้ติดตั้ง Playwright และตั้ง `FROST_CHROME` เป็นตำแหน่ง Chrome หากต่างจากตำแหน่งมาตรฐานบน Windows

```powershell
node --test --test-isolation=none tests/*.cjs
node --expose-gc tests/stress/run.cjs
node tests/browser/visual.cjs . qa/after
node tests/browser/campaign.cjs . qa/campaign
node tests/browser/controls.cjs . qa/controls
```

## สถานะก่อนเผยแพร่

ชุดนี้พร้อมให้ทีมรีวิว ยังเหลือทดสอบบนโทรศัพท์จริงและฟังเสียงในช่วงต่อสู้บนอุปกรณ์จริง เกมสาธารณะเผยแพร่จากโฟลเดอร์ [`site/` ของ frostbound-game](https://github.com/tanapat1604-cmd/frostbound-game/tree/main/site) ผ่าน [Pages workflow](https://github.com/tanapat1604-cmd/frostbound-game/blob/main/.github/workflows/pages.yml) เมื่อนำรุ่นที่อนุมัติไปเผยแพร่ให้ส่งเฉพาะไฟล์เกมที่โหลดโดย `index.html` และ `assets/` ภาพและเครื่องมือใน `tests/` ใช้สำหรับรีวิว
