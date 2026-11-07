# สถาปัตยกรรมแอปหลัก StudentOS (ราก repo)

อัปเดต 7 พ.ย. 69 · ครอบคลุมเฉพาะ **แอปหลักที่ราก** (เว็บจริง) — สาย `alt/` แยกเดินคนละทาง ห้ามรวมกันโดยเจ้าของไม่สั่ง

---

## 0. เพิ่งเข้าทีม อ่านแค่ส่วนนี้ก่อน (5 นาที)

1. **ไม่มี build step** — แก้ไฟล์แล้วเปิดเบราว์เซอร์ได้เลย ทุกไฟล์เป็น `<script>` คลาสสิกที่แชร์ global ร่วมกัน (ไม่มี import/export)
2. **ลำดับ `<script>` ใน `index.html` คือสัญญา** — ไฟล์ที่โหลดก่อนห้ามเรียกชื่อของไฟล์ที่โหลดทีหลัง *ตอนโหลด* (เรียกในฟังก์ชันที่รันทีหลังได้)
   ลำดับที่ห้ามสลับ: `supabase → config.js → remote-config.js → engine.js → context.js → planner.js → brain.js → inbox.js → linelink.js → app.js`
3. **ข้อมูลผู้ใช้อยู่ใน `localStorage['studentos.alt.v1']`** และคีย์ `studentos.alt.*` อีกราว 75 คีย์ — ห้ามเปลี่ยนชื่อคีย์ (เปลี่ยน = ทุกเครื่องเป็นแอปเปล่า)
4. **จะแก้ไฟล์ไหน รันก่อน:** `node devtools/architecture-map.mjs <ไฟล์>` — บอกว่าใครใช้ชื่อจากไฟล์นั้นบ้าง
5. **จะแก้อะไรเรื่อง "ควรทำอะไรตอนนี้"** ต้องอ่านจาก `studyPlan()` (planner.js) ก้อนเดียว ห้ามเรียก `buildDayPlan()` เอง
6. **ห้าม push เอง** — push = ขึ้นเว็บจริงทันที · เจ้าของตั้งชื่อเวอร์ชันเอง
7. เทสต์ที่ต้องรันตามไฟล์ที่แตะ: ตารางใน `AGENTS.md` › Superpowers · ชุดรวมของราก: `node --test devtools/*.test.mjs`

---

## 1. ภาพรวม

```
index.html (2,700 บรรทัด · HTML ของทุกจอ + สคริปต์บูต)
 ├─ CSS 42 ไฟล์ (2.2 MB) ─ style.css (โทเคนพื้นฐาน) → alt.css (1.3 MB · ธีม/จอส่วนใหญ่) → ไฟล์ต่อฟีเจอร์ → halloween/* → glass/contrast/mobile-stability
 ├─ JS 60 ไฟล์โหลดทันที (3.4 MB · ก่อน 7 พ.ย. 3.56 MB) + 1 ไฟล์โหลดตอนใช้ (fx3d.js 165 KB)
 │   ├─ Core      config · remote-config · engine · context · planner · app.js (21,000 บรรทัด)
 │   ├─ Decision  facts · profile · simulate · calibrate · loss · decide
 │   ├─ Features  inbox/linelink/integrations (LINE) · room · social · feed · hw · topic · safety · classrooms
 │   │            sai (น้องไซ) · fxgames/hoop/gacha-fx (เอฟเฟกต์งานเสร็จ) · quickadd · board · news · staff-news · bug-reports
 │   ├─ Halloween halloween/{rewards,season,invite-friend}/* · death-quest · study-pact · events.js
 │   ├─ Economy   economy/client.js · economy/focus-checkpoints.js (ยอดโทเคน/สิทธิ์ อ่านจากเซิร์ฟเวอร์)
 │   └─ Lazy      src/core/feature-registry.js → fx3d.js (ตอนเปิดเกม 3D) → vendor/three (ตอนเปิดเกม 3D)
 ├─ sw.js        network-first + แคชสำรอง (SHELL ~200 ไฟล์) · ภาพอีเวนต์แคชตอนใช้
 └─ supabase/    Edge Functions + migrations (แก้ฝั่งนี้ต้องให้เจ้าของสั่ง)
```

ของที่โหลดตอนใช้อยู่แล้วก่อนรอบนี้ (ใช้เป็นแบบอย่าง): Tesseract OCR (`loadTesseract` ใน app.js) · desktop.js (`desktop-entry.js`) ·
Three.js (`fx3dLoad`) · qrcode-generator (invite-friend.js) · หน้า Halloween event (`halloween/event/index.html` เป็นหน้าแยก)

## 2. จัดกลุ่ม 5 ประเภท (ตามคำสั่งงาน)

| กลุ่ม | ไฟล์ตอนนี้ | หมายเหตุ |
|---|---|---|
| **A. Core** | `app.js` (บูต · `go(id)` นำทางจอ · `state` · `save()` · ซิงก์) · `config.js` · `remote-config.js` · `engine.js` · `context.js` · `planner.js` · `src/core/feature-registry.js` | app.js ทำทุกอย่าง — fan-in 49 ไฟล์ |
| **B. Features** | ตามรายการในข้อ 1 · Halloween อยู่ในโฟลเดอร์ของตัวเองแล้ว | ส่วนใหญ่ 1 ไฟล์ JS + 1 ไฟล์ CSS ต่อฟีเจอร์ |
| **C. Components** | `showToast()` · `haptic()` · `esc()` · ชีตล่าง (`openAddSheet`/`openDaySheet`/...) — **อยู่ใน app.js ทั้งหมด** | ไม่มีโฟลเดอร์ component · ดูหนี้เทคนิคข้อ 7 |
| **D. Services** | Supabase client (`sb` ใน app.js) · `economy/client.js` · `halloween/rewards/account-store.js` · `remote-config.js` · localStorage (กระจายทั่ว app.js 175 จุด) | |
| **E. Styles & Assets** | `style.css` (โทเคน `--pri-*` · ทอง) · `alt.css` (ธีมทั้งหมด) · CSS ต่อฟีเจอร์ · ภาพ/ฟอนต์ที่ราก · `vendor/` | ห้ามแก้ `style.css` (ดู AGENTS.md) |

## 3. แผนที่การพึ่งพา (สรุป · ตัวเต็มรัน `node devtools/architecture-map.mjs`)

นับจากชื่อระดับบนสุดที่ไฟล์อื่นอ้าง (เดาแบบข้อความ ใช้ดูภาพรวม):

| ไฟล์ | ไฟล์อื่นที่พึ่งมัน | อ่านว่า |
|---|---|---|
| app.js | 49 | ศูนย์กลางของทุกอย่าง — แก้ชื่อฟังก์ชันใน app.js ต้องค้นทั้ง repo |
| engine.js | 15 | parser + คะแนนความสำคัญ |
| hoop.js | 12 | เอฟเฟกต์งานเสร็จ (`FX_SHOP` · `openDoneFx`) — ธีม Halloween ลงทะเบียนเอฟเฟกต์ที่นี่ |
| feed.js · sai.js | 10 | |
| inbox.js · social.js · halloween/rewards/runtime.js | 9 | |

ข้อสังเกต:
- **เกือบทุกไฟล์ "late-bound" กับ app.js** (อ้างชื่อใน app.js ที่โหลดทีหลัง) — ใช้ได้เพราะเรียกตอนผู้ใช้กด ไม่ใช่ตอนโหลด · ไฟล์ใหม่ต้องรักษากติกานี้
- **social.js ↔ feed.js ↔ topic.js ↔ safety.js** อ้างกันไปมาเป็นวง — ย้ายแยกต้องย้ายพร้อมกันทั้งกลุ่ม
- **Halloween → app.js ทางเดียวเป็นส่วนใหญ่** และแยกโฟลเดอร์อยู่แล้ว (rewards/season/invite-friend) · จุดที่ผูกกลับคือ `FX_SHOP` (hoop.js) และ `StudentOSEconomy`

## 4. Data flow

```
ผู้ใช้กด → ฟังก์ชันใน app.js แก้ state → save()/persistState() → localStorage['studentos.alt.v1']
                                                       └→ ซิงก์ขึ้น Supabase (ถ้าล็อกอิน · syncFromCloud/merge)
studyPlan() (planner.js) ← state.tasks + context.js (ตารางเรียน) + engine.js (คะแนน) → หน้าแรก/น้องไซ/โฟกัส
ยอดโทเคน/ธีม/รางวัล ← economy/client.js ← เซิร์ฟเวอร์เท่านั้น (เครื่องเก็บสำเนาไว้โชว์ตอนเซิร์ฟเวอร์ล่ม)
```

## 5. Feature registry · ย้ายฟีเจอร์ไปโหลดตอนใช้

`src/core/feature-registry.js` (โหลดก่อน hoop.js) สร้างฟังก์ชันตัวแทนชื่อเดียวกับของจริง เรียกครั้งแรกค่อยโหลดไฟล์จริง

Lifecycle ที่มี (ใช้เท่าที่จำเป็น — ไม่บังคับ init/mount/destroy):
`idle` → (เรียกครั้งแรก) `loading` → `ready` · โหลดไม่ได้ → `failed` + เรียก `fallback` → ครั้งหน้าลองใหม่

```js
StudentOSFeatures.status('fx3d')   // 'idle' | 'loading' | 'ready' | 'failed'
StudentOSFeatures.load('fx3d')     // โหลดล่วงหน้าเองได้ (คืน Promise)
StudentOSFeatures.list()           // ['fx3d']
```

**เช็คลิสต์ก่อนย้ายฟีเจอร์ไปโหลดตอนใช้** (ทุกข้อต้องผ่าน):
1. ไฟล์จริงไม่ทำอะไรตอนโหลดนอกจากประกาศ — รันใน vm เปล่าแล้วไม่ error (`node -e` ดูตัวอย่างในเทสต์)
2. ไฟล์อื่นเรียกแค่ **ฟังก์ชัน** ของมัน ตอนผู้ใช้กด — ไม่อ่านค่าคงที่ของมันตอนโหลด/ตอนวาดจอแรก (`node devtools/architecture-map.mjs <ไฟล์>` › "ถูกใช้โดย")
3. ผลตอบกลับของฟังก์ชันเป็น Promise อยู่แล้ว หรือคนเรียกไม่ใช้ค่าที่คืน
4. มีทางสำรองเมื่อโหลดไม่ได้ และ `onClose`/callback ของคนเรียกยังถูกเรียก
5. **ไม่ใช่** ระบบรางวัล โทเคน ล็อกอิน หรือที่เขียนข้อมูลผู้ใช้
6. ไฟล์จริงยังอยู่ใน `SHELL` ของ sw.js (ออฟไลน์ต้องเล่นได้) · เปลี่ยนชื่อ `CACHE`
7. เพิ่มเคสใน `devtools/feature-registry.test.mjs` แล้วเปิดในพรีวิวจริงว่าไม่มีไฟล์นั้นใน network ตอนเปิดแอป

**ถอยกลับ:** เปลี่ยน `<script src="src/core/feature-registry.js...">` ใน index.html กลับเป็น `<script src="fx3d.js"></script>` — ตัวลงทะเบียนเห็นของจริงแล้วจะไม่สร้างตัวแทน (มีเทสต์ "an already loaded export is left alone")

### 10 อันดับไฟล์ที่ควรพิจารณาโหลดตอนใช้ (วัด 7 พ.ย. 69 · Phase 2)

"เวลาบูต" = ช่วงที่สคริปต์นั้นบล็อก main thread ตอนเปิดแอป (performance.mark ก่อน/หลังแท็ก · เดสก์ท็อป · ค่ากลางหลายรอบ)
ไฟล์ส่วนใหญ่ใช้ < 2 ms เพราะเบราว์เซอร์คอมไพล์แบบขี้เกียจ — **ประโยชน์หลักของการโหลดตอนใช้คือไบต์ที่ไม่ต้องดึงทุกครั้งที่เปิดแอป**
(sw.js ดึงทุกไฟล์ใหม่จากเน็ตแบบ `no-store` ทุกครั้งที่ออนไลน์) ไม่ใช่เวลาประมวลผล

| # | ไฟล์ | ขนาด | ใครเรียก | ตัดสิน |
|---|---|---|---|---|
| 1 | `fx3d.js` | 165 KB | hoop.js (`open3D`) ตอนกด | ✅ ย้ายแล้ว |
| 2 | `fxgames.js` | 83 KB | hoop.js อ่าน `FX_GAMES`/`FX_ICONS` ตอนวาดร้าน · fx3d ใช้ตัวช่วย 11 ตัว | แยกรายชื่อ/ไอคอนออกเป็นไฟล์เล็กก่อน แล้วย้ายตัวเกม |
| 3 | `halloween/season/cursed-ship.js` | 37 KB | hoop · app · runtime เรียกแบบรอคำตอบทันที (`canPlay` · `skinOn` · `scene()` · `playVariant` ของฉากรางวัลทุกแบบ) | ⛔ ยังไม่ปลอดภัย — ดูแผนข้างล่าง |
| 4 | `board.js` | 33 KB | app.js (`openBoard` · `paintBoardEntry` · `boardWarm`) | เช็คก่อนว่า `paintBoardEntry`/`boardWarm` ถูกเรียกตอนวาดหน้าแรกไหม |
| 5 | `classrooms.js` | 18 KB | app.js ตอนเข้าจอ (`classroomsEnter`) + hook บัญชีที่มี `typeof` กันอยู่แล้ว | ผู้สมัครดี · แต่ไฟล์ใช้ `document` ตอนโหลด ต้องดูก่อน |
| 6 | `gacha-fx.js` | 14 KB | app.js ตอนสุ่ม (`gcCardFace` คืน HTML ทันที) | ⛔ ติดระบบสุ่ม/รางวัล ไม่แตะ |
| 7 | `bug-reports.js` | 9 KB | ปุ่มในจอแจ้งบั๊ก (onclick 5 ตัวใน index.html) | ผู้สมัครดี · ต้องทำตัวแทนครบทั้ง 5 ชื่อ |
| 8 | `news.js` + `staff-news.js` | 27 KB | inbox.js อ่านข่าวปักหมุดตอนวาดกระดิ่ง | ไม่ใช่ — ใช้ตอนเปิดแอป |
| 9 | `halloween/invite-friend/invite-friend.js` | 43 KB | events.js เรียก 20+ ชื่อ · ผูกสิทธิ์ธีม | ⛔ ติดระบบรางวัล |
| 10 | CSS Halloween 14 ไฟล์ | 247 KB | ทุกจอเมื่อใส่ธีม Halloween | ต้องออกแบบโหลดตามธีม + กันจอกะพริบ ให้เจ้าของดูก่อน |

**จุดร้อนตอนบูตที่วัดได้ (ไม่ใช่เรื่องโหลดตอนใช้):** `app.js` 60–79 ms · `economy/client.js` 17–26 ms (เรียก `refresh()` ทันที + `setInterval` ทุก 5 วิสองตัว + ห่อ `go`) ·
`halloween/rewards/featured-badge.js` 16–17 ms (เรียก `renderProfileHead()` ตอนโหลด + ห่อ `go`/`renderUser`) — ทั้งสองไฟล์อยู่ในระบบรางวัล ต้องให้เจ้าของอนุญาตก่อนแตะ

**แผนแยก cursed-ship.js (ยังไม่ทำ):** แยกเป็น (ก) ส่วนลงทะเบียน ~3 KB ที่โหลดตอนเปิดแอป: `FX_SHOP` · ค่าตั้งการเคลื่อนไหว · `skinOn` · `canPlay` · `preload` ·
`active`/`skip` แบบไม่มีฉาก และ (ข) ตัวเล่นฉาก `playFx`/`playVariant`/`scene` โหลดผ่าน registry ตอนงานเสร็จ ·
ติดที่ `scene()` ซึ่งจอ "เสร็จแล้ว" ของโหมดโฟกัสเรียกแบบรอ HTML ทันที → ต้องโหลดล่วงหน้าเมื่อ `skinOn()` เป็นจริง · ต้องเทียบภาพฉากก่อน/หลังทุกแบบ

## 6. CSS

| ชั้น | อยู่ที่ | กติกา |
|---|---|---|
| Design tokens | `style.css` (`--pri-*` · ทอง) | ห้ามแก้ (ข้อยกเว้นเดียว: ทอง) |
| Theme variables | `alt.css` + `THEME_BAR`/`THEME_NAME` (app.js) + ตาราง `BAR` ใน `<head>` | เพิ่มธีมต้องแก้ 3 ที่ |
| Feature styles | `<ฟีเจอร์>.css` คู่กับ `<ฟีเจอร์>.js` | ขึ้นต้น selector ด้วย prefix ของฟีเจอร์ (`.hoop-` `.cs-` `.fx-`) |
| Halloween | `halloween/**.css` โหลดหลัง CSS หลัก | ทับของหลักได้ ห้ามให้ของหลักพึ่ง |
| Responsive/เครื่องเบา | `mobile-stability.css` · `[data-lite]` ใน alt.css · `desktop.css` (media query) | |

**ห้ามรวม CSS เป็นไฟล์เดียว** — ไม่มีหลักฐานว่าเร็วขึ้น (HTTP/2 + แคช SW) และ diff จะชนกันทุกคน

## 7. หนี้เทคนิค (เรียงตามความคุ้ม)

1. **app.js 21,000 บรรทัด fan-in 49** — แยกได้ทีละส่วนที่ fan-in ต่ำ เริ่มจากบล็อกที่มีหัวข้อ `// ====` ชัด (OCR · ซิงก์ · โหมดเครื่องเบา) · ทุกครั้งต้องรันชุดเทสต์ซิงก์/บัญชี
2. **ตัว escape HTML (`esc`) เขียนซ้ำ 14 ที่** ใน halloween/* (+ `bugEscape` ใน bug-reports.js) — แต่ละตัวทำกับ `null` ต่างกัน (`'null'` vs `''`) รวมกันต้องเช็คทีละจุด
3. **ชีต/โมดอล/ยืนยัน ไม่มีตัวกลาง** — มี `openAddSheet`/`openSoonSheet`/`openDaySheet`/`openPlanRowSheet` แยกกัน · ก่อนสร้าง component กลางให้ทำม็อกอัปให้เจ้าของดูก่อน (กฎ UI)
4. **`localStorage` ถูกเรียกตรง 175 จุดใน app.js** — ทำ wrapper ได้ แต่ต้องคงชื่อคีย์เดิมทุกตัว
5. CSS โหลดทันที 42 ไฟล์ รวม CSS ของ Halloween ทั้งหมด แม้ผู้ใช้ไม่ได้ใส่ธีม Halloween
6. ~~main-sync-check พัง · account-switch ตก 2/40~~ แก้แล้ว 7 พ.ย. (Phase 2) — เป็นปัญหาของชุดเทสต์: เคสพอร์ตผลงาน/คลังรูปเป็นฟีเจอร์ของ alt ที่รากไม่มี · ตัวรันของรากข้ามเฉพาะเคสที่ฟีเจอร์ไม่มีจริงและพิมพ์ SKIP
8. ออฟไลน์หลังอัปเดตแอปทุกครั้ง เกม 3D ถอยเป็น 2D จนกว่าจะเล่นออนไลน์หนึ่งรอบ — Three.js (`vendor/`) ถูกแคชตอนใช้ และแคชเก่าถูกลบตอนเปลี่ยนชื่อ `CACHE` (พฤติกรรมเดิม · ไม่พัง)
9. `go()` ถูกห่อซ้อนโดยหลายไฟล์ (economy/client · featured-badge · ฯลฯ) — ลำดับโหลดเปลี่ยนเมื่อไหร่ ลำดับการห่อเปลี่ยนตาม
7. `halloween-countdown.js/.css` อยู่ใน SHELL ของ sw.js แต่ index.html ไม่ได้โหลด — เช็คก่อนว่ายังมีหน้าอื่นใช้ไหม

## 8. ทำงานหลายคนพร้อมกัน

- แบ่งตามไฟล์ ไม่ใช่ตามฟีเจอร์ในหัว: ฟีเจอร์ที่ไฟล์อ้างกันเป็นวง (social/feed/topic/safety) ให้คนเดียวถือ
- **app.js · index.html · sw.js ชนกันบ่อยที่สุด** — แตะเฉพาะบรรทัดที่ต้องแตะ · ชื่อ `CACHE` ใน sw.js ให้คนที่ merge ทีหลังตั้งใหม่
- หนึ่งงาน = หนึ่ง branch/worktree · ห้าม merge ที่ยังไม่รันเทสต์ตามตารางใน AGENTS.md
- รายงานทุกครั้ง: ไฟล์ที่แก้ · ผลกระทบ (รัน `architecture-map.mjs <ไฟล์>`) · เทสต์ที่รันและผล

## 9. Supabase

- ห้ามแก้ schema/RLS/Auth/ข้อมูลผู้ใช้จริงโดยเจ้าของไม่สั่ง · ห้ามใส่ service role key ในฝั่งหน้าเว็บ (repo สาธารณะ)
- เทสต์ฐานข้อมูลใช้ PGlite (`supabase/tests/`) · Edge Function ใช้ bundle `fn.mjs` (`supabase/functions/*/__tests__/README.md`)
- เซิร์ฟเวอร์ล็อกอยู่ (402) ตั้งแต่ 30 ต.ค. 69 — แอปต้องเปิดได้โดยไม่มีเซิร์ฟเวอร์ · ทดสอบอะไรที่ต้องคุยกับเซิร์ฟเวอร์จริงตอนนี้ = **Blocked** ไม่ใช่ Passed

## 10. ถอยกลับ (rollback)

- ทุกขั้นเป็น commit แยก → `git revert <commit>` ทีละขั้นได้
- งานที่แตะ sw.js: revert แล้วต้องเปลี่ยนชื่อ `CACHE` ใหม่อีกครั้ง (ชื่อเดิมอาจถูกติดตั้งในเครื่องผู้ใช้ไปแล้ว)
