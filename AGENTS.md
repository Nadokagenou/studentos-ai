# StudentOS-AI

AI Decision Assistant สำหรับนักเรียนมัธยม · Samsung Solve for Tomorrow 2026 · ทีม Masterpiece

---

## Read First

1. `alt/HANDOFF.md` — เขียนไว้ให้ AI ตัวถัดไปอ่านก่อนเริ่มงานโดยเฉพาะ
2. `alt/BUILD-SPEC.md` — เป้าหมาย · สเปก Priority Engine · บั๊ก §7 · Design System
3. `alt/PATCHNOTES.md` — ประวัติทุกรุ่น **รุ่นใหม่อยู่บนสุด** (อ่าน 120 บรรทัดแรกพอ)

เสริมเมื่อต้องใช้: `alt/README-ALT.md` · `alt/AUDIT-2026-08-15.md` · `docs/supabase-setup.md`
· **ร่างข่าวสารถึงผู้ใช้ (จอ "ข่าวสาร")** → `alt/news/README.md` — ทุกประโยคต้องมีหลักฐาน และต้องผ่าน `node alt/devtools/news.mjs check`

---

## Vision

StudentOS ตอบว่า:

> **"ตอนนี้ควรทำอะไร"**

ไม่ใช่

> "มีงานอะไร"

To-do list ทั่วไปแสดงรายการทั้งหมดแล้วโยนการตัดสินใจกลับให้ผู้ใช้ — StudentOS ต้องตัดสินใจแทน แล้วอธิบายว่าทำไม

ทุกฟีเจอร์ที่จะเพิ่ม ถามก่อนว่า: *อันนี้ช่วยลดการตัดสินใจของนักเรียน หรือเพิ่ม?*
ถ้าเพิ่ม — ไม่ต้องมี หรือเอาไปไว้หลังแท็บ "ฉัน"

**ลูกโซ่ที่ต้องปิดให้ครบ:**
```
ไม่รู้จะเริ่มอะไร → เลือกให้ (ถูก) → เริ่มทำ → ทำเสร็จ → บอกงานถัดไป
                    ✅ ทำได้แล้ว                      ✅ ทำได้แล้ว (QA 6 ต.ค. 69)
```

---

## Critical Rules

- **แก้ที่ `alt/` เท่านั้น** — root คือสายเก่าของอีกทีม ห้ามแตะถ้าไม่ได้สั่ง
- **ห้ามเปลี่ยนคีย์ `studentos.alt.*`** — คีย์คือที่อยู่ข้อมูลผู้ใช้ เปลี่ยนเมื่อไหร่ทุกเครื่องกลายเป็นแอปเปล่า กู้ไม่ได้
- **ทุกจอที่พูดเรื่อง "ควรทำอะไร" ต้องอ่านจาก `studyPlan()` ก้อนเดียว** — ห้ามเรียก `buildDayPlan()` เองในจอไหน (เคยเรียกเอง 3 จอ แล้วตอบคนละอย่างจริง)
- **ห้ามแก้ `style.css`** — ของ ALT ไปอยู่ใน `alt.css` เท่านั้น
  *(ข้อยกเว้นที่เกิดขึ้นแล้ว: 1A9e เพิ่มโทเคนสีทองลง `style.css` โดยตั้งใจ เพราะทองต้องอยู่กลุ่มเดียวกับ `--pri-*` ที่คงที่ทุกธีม)*
- **ลำดับโหลดสคริปต์ห้ามสลับ** — `context.js` ต้องมาก่อน `app.js`
  `supabase → config.js → remote-config.js → engine.js → context.js → planner.js → brain.js → inbox.js → linelink.js → app.js`
  *(`remote-config.js` ต้องมาก่อน `engine.js` — `priorityInfo()` เรียก `prioWeight()` ตอนคิดคะแนน)*
- **ขึ้นเวอร์ชัน = แก้ 3 ที่ขึ้นไปให้ตรงกัน** — `APP_VERSION` (app.js) + `CACHE` (sw.js) + title/meta/manifest/README/PATCHNOTES
- **เพิ่มธีมใหม่ต้องแก้ 3 ที่** — `THEME_BAR`/`THEME_NAME` (app.js) + ตาราง `BAR` ใน `<head>` + โทเคนใน `alt.css`
- **หน้าแรก (`scr-menu`) ต้องไม่ต้องเลื่อน** — วัดที่ 375×812 ทุกครั้งที่เพิ่มของ
- **แจ้งเตือนต้องยิงผ่าน service worker** — `new Notification()` ใช้ไม่ได้บน Chrome มือถือ
- **`git push` ต้องให้ผู้ใช้สั่งก่อนทุกครั้ง** — push แล้วขึ้นเว็บจริงทันที
- **ห้ามเขียนโค้ดลับ / API key ลงไฟล์ไหนใน repo** — repo เป็นสาธารณะ

---

## Naming Traps

| สิ่งที่เห็น | ความจริง |
|---|---|
| `scr-menu` | **หน้าแรก** |
| `scr-home` | รายการงานเก่า (ไม่ใช่หน้าแรก — ชื่อสวนทางกันมาตั้งแต่ 1A8) |
| โฟลเดอร์ `alt/` | **ตัวหลัก** ตั้งแต่ 1A7V2 ไม่ใช่บิลด์ทดลองแล้ว |
| repo root | สายเก่า |

---

## Where Things Are

```
C:\Users\User\OneDrive\code\StudentOS-AI\     ← repo จริง (เครื่องนี้)
└── alt\                                       ← ตัวแอปทั้งหมด แก้ที่นี่
    ├── app.js       8,270 บรรทัด · UI · state · OCR
    ├── engine.js    parser ไทย · priorityInfo · buildDayPlan
    ├── planner.js   studyPlan() — ชั้นที่ตอบว่าควรทำอะไร
    ├── context.js   ตารางเรียน → ช่องว่างจริง
    └── inbox.js brain.js linelink.js   ← ของอีกทีม (ระบบ LINE)
```

**Live:** https://nadokagenou.github.io/studentos-ai/alt/

**Stack:** Vanilla JS ล้วน · ไม่มี build step ไม่มี npm ไม่มี framework · PWA + Supabase (CDN)
**Data:** `localStorage['studentos.alt.v1']`

---

## Current Priority

1. **Next Task Chain** — ✅ มีแล้ว (จอ "เสร็จแล้ว" ของโหมดโฟกัส + toast "เริ่มเลย" ตอนติ๊กจากหน้าแรก · ทั้งคู่อ่าน `focusPlan()`) · เหลือวัดกับผู้ใช้จริง
2. **OCR Round 3** — ลายมือไทย · โครง Edge Function `ocr-assist` พร้อมแล้ว เหลือเขียนอะแดปเตอร์ตัวเดียว + เลือกผู้ให้บริการ
3. **User Test** — นักเรียนจริง 5 คน 7 วัน วัด capture rate (ตัวเลขชี้เป็นชี้ตาย)

ถัดไป: ร้านค้าโทเคน · เพื่อนเฟส 2 · เส้นเวลา load vs capacity (`workloadAhead()` คำนวณครบแล้ว เหลือวาด)

---

## Before Touching OCR

อ่าน `alt/HANDOFF.md` §17 ให้จบก่อน — มีสมมติฐานที่ **ลองแล้วผิด 6 ข้อ** เขียนไว้ (PSM 7, เพิ่มความละเอียด, ขยายภาพเล็ก, อ่านทีละบล็อก ฯลฯ) ไม่อ่านจะเสียเวลาลองซ้ำ

เครื่องมือวัด (ไม่ถูกโหลดโดยแอป · ฉีดด้วย `<script>` เท่านั้น ห้ามใช้ `eval`):
- `alt/devtools/parsebench.js` → `benchParse()` — ตอนนี้ 49/49 · รันจบใน 4ms
- `alt/devtools/ocrbench.js` → `benchReal()` — ตอนนี้ 33/36 (92%)

**เจอข้อความที่แกะพลาดเมื่อไหร่ ให้เพิ่มเป็นเคสก่อนแก้โค้ดเสมอ**

---

## Superpowers (ปลั๊กอิน · ติดตั้งระดับผู้ใช้ 17 ต.ค. 69)

ปลั๊กอิน `superpowers@claude-plugins-official` รุ่น 6.3.0 บังคับให้ AI ถามก่อนทำ · ซอยงานเป็นชิ้นแล้วตรวจทีละชิ้น · เขียนเทสต์ก่อนโค้ด
**กฎในไฟล์นี้ชนะ skill ทุกตัว** — skill เขียนมาสำหรับโปรเจกต์ npm ทั่วไป ที่นี่ไม่ใช่

**แปล skill ให้เข้ากับ repo นี้:**

| skill บอกว่า | ที่นี่ทำแบบนี้ |
|---|---|
| `npm test` / เขียนเทสต์ด้วย jest | ไม่มี npm ไม่มีชุดเทสต์รวม — เลือกชุดจากตารางข้างล่างตามไฟล์ที่แตะ · เทสต์ใหม่ = เพิ่มเคสลงชุดเดิม |
| "เห็นเทสต์ตกก่อน" (RED) | ทำจริง — ถอดโค้ดที่เพิ่งเขียนออกแล้วรันให้เห็นว่าตก ถึงจะนับว่าเทสต์ใช้ได้ |
| เก็บแผน/สเปกที่ `docs/superpowers/` | เก็บที่ `alt/docs/superpowers/` แทน (รากเป็นสายเก่า) · repo สาธารณะ ห้ามมีข้อมูลผู้ใช้หรือกุญแจ |
| brainstorming ถามทีละข้อ | ถามเป็นภาษาไทย · งานหน้าจอให้ม็อกอัปก่อนลงมือ · หน้า "Home" ของเจ้าของ = แท็บ "ฉัน" |
| finishing-a-development-branch: merge / push / PR | ห้าม push หรือเปิด PR จนกว่าเจ้าของสั่ง (push = ขึ้นเว็บจริง) · ชื่อเวอร์ชันเจ้าของตั้งเอง |
| using-git-worktrees | แอป Claude สร้าง worktree ให้อยู่แล้ว ใช้อันที่มี ไม่ต้องสร้างซ้อน |

**เทสต์ที่รันได้ด้วย `node` ตรง ๆ** (ตัดฟังก์ชันจริงจากไฟล์มารันใน vm · ทั้งชุดจบในไม่กี่วินาที):

| แตะอะไร | รัน | ผล 17 ต.ค. 69 |
|---|---|---|
| ซิงก์ / merge ข้ามเครื่อง (app.js) | `node alt/devtools/syncbench.cjs` | 36/36 |
| ล็อกอิน / สลับบัญชี (app.js) | `node alt/devtools/account-switch-check.cjs` | 33/33 |
| สมัครรับแจ้งเตือน (app.js) | `node alt/devtools/push-claim-check.cjs` | 12/12 |
| กล่องจดหมาย LINE (linelink.js) | `node alt/devtools/inbox-live-check.cjs` | 18/18 |
| บริบทที่ส่งให้ AI รีวิวแผน | `node alt/devtools/review-check.cjs` | 3/3 |
| ฉากพื้นหลังธีม (alt.css) | `node alt/devtools/scene-check.cjs` | ผ่าน |
| service worker (sw.js) | `node alt/devtools/sw-check.cjs` | **ล้ม** — ตัวจำลอง `self` ไม่มี `registration` แต่ sw.js บรรทัด 44 อ่าน `self.registration.pushManager` |
| ข่าวสาร (alt/news/) | `node alt/devtools/news.mjs check` | ผ่าน 6 ประกาศ |
| ทางลัด (devtools/ ที่ราก) | `node --test devtools/shortcuts.test.mjs` | 10/10 |

**เทสต์ที่ต้องฉีดเข้าแอปในพรีวิว** (`<script src>` เท่านั้น ห้าม `eval`) — parser · OCR · เอนจินตัดสินใจ:
`parsebench.js` → `benchParse()` · `ocrbench.js` → `benchReal()` · `riskbench.js` → `benchRisk()` ·
`decidebench.js` → `benchDecide()` · `profilebench.js` → `benchProfile()` · `factsbench.js` → `benchFacts()`
แตะเอนจินเมื่อไหร่ **อ่านตัวเลขที่ออกมาด้วย** ไม่ใช่ดูแค่ผ่าน/ไม่ผ่าน (บั๊กแพงสุดของเอนจินรันผ่านหมดทุกตัว)

**เทสต์ที่ต้องติดตั้งของก่อน** (ใช้ Postgres จำลอง PGlite · ไม่แตะ Supabase จริง):
- ระบบทีมงาน `alt/staff/tests/` — วิธีรันอยู่ใน `alt/staff/INSTALL-TH.md` (ใช้ pnpm ติดตั้งใน `alt/staff/backend`)
- RLS `supabase/tests/*.test.mjs` — วิธีรันเขียนไว้หัวไฟล์ (ติดตั้ง PGlite นอก repo แล้วส่ง path เข้าไป)
- Edge Function `supabase/functions/*/__tests__/` — อ่าน `README.md` ในโฟลเดอร์ · ต้อง bundle `fn.mjs` ใหม่ทุกครั้งที่แก้ `index.ts`

---

## Key Decisions (จำเหตุผล ไม่ใช่แค่ผล)

| ตัดสินใจ | เพราะ |
|---|---|
| สีทองใช้เฉพาะของที่ทำสำเร็จแล้วจริง | ถ้าทองโผล่บนของที่ยังไม่ได้ทำ มันเลิกแปลว่าสำเร็จทันที |
| ไม่มี XP ไม่มีเลเวล ไม่มี "ดีขึ้น 18%" ลอยๆ | จอสรุปผลโกหกง่ายที่สุด กราฟสวยทำให้ตัวเลขที่เดามาดูน่าเชื่อ |
| "เที่ยงคืน" = 23:59 ของวันเดียวกัน | คนพูดว่า "ส่งเที่ยงคืนวันนี้" หมายถึงปลายสุดของวันนี้ |
| ~~ปุ่มอ่านด้วย cloud ห้ามเป็นค่าเริ่มต้น~~ → **AI อ่านรูปเป็นหลัก** (เจ้าของเปลี่ยนเอง 8 ต.ค. 69) | Tesseract อ่านหน้ากระดาษไม่ "เข้าใจ" — ได้ภาษาเอเลี่ยนเต็มช่องงาน · ยังขอยินยอมครั้งแรก และออฟไลน์/ไม่ยินยอม/AI ล้ม ยังอ่านในเครื่องได้ (ทางสำรองห้ามถอด) |
| `AUTO_ACCEPT = 0.8` | เกณฑ์ auto-file ห้ามลด |

---

## Working Style

- ตอบภาษาไทย ใส่ "ครับ" ในประโยคสรุป/ถาม/เสนอทางเลือก — ไม่ต้องใส่ในตาราง หัวข้อ หรือรายการผลทดสอบ
- **บอกตรงๆ ว่าอะไรทำได้จริง อะไรยังไม่ได้ — ห้ามแต่งตัวเลขหรืออ้างว่าเทสต์แล้วทั้งที่ไม่ได้เทสต์**
- แพตช์โน้ตภาษาไทยทุกรุ่น · commit message ภาษาอังกฤษ เล่าเป็นย่อหน้าอธิบายเหตุผล
- **ชื่อเวอร์ชันผู้ใช้ตั้งเอง อย่าตั้งเอง** (`1A9` → `1A9d` → `1A9e`)
- ภาพหน้าจอที่วงปากกามา: เส้นที่วง = "ตรงนี้" ไม่ใช่สีที่ต้องการ

---

## Stale Docs — อย่าเชื่อ 3 จุดนี้

| เอกสาร | ที่เขียนไว้ | ความจริง |
|---|---|---|
| `HANDOFF.md` §2 | working dir อยู่ที่ `Downloads\StudentOS AI design system\` | ไม่มีอยู่แล้ว · ตัวจริงคือ `OneDrive\code\StudentOS-AI` |
| `README-ALT.md` | "เครื่องนี้ไม่มี node/python" | มีทั้งคู่ — Node v24 · Python 3.13 (ใช้ `node --check` ได้) |
| `BUILD-SPEC.md` §11 | git อยู่ที่ `4c34c2b` · branch `priority-engine-last-chance` | main อยู่ที่ `af4677c` แล้ว |
| `README.md` (root) | เว็บจริงคือ root URL | เว็บจริงคือ `/alt/` — ยึดตาม HANDOFF |
