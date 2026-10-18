# บริบทรายวัน + ปิดเทอม — แผนลงมือ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้แผนของแอปรู้ว่าวันนี้ปิดเทอม/อยู่บ้าน/ออกไปข้างนอก แล้วให้ AI อ่านข้อความเล่าเรื่องวันนี้ จดเป็นช่วงเวลาพร้อมข้อสังเกต (ผู้ใช้กดยืนยันก่อน)

**Architecture:** เพิ่ม `breaks` กับ `days` ลงก้อนบริบทเดิม (`studentos.alt.ctx`) แล้วให้ `busyBlocks(date)` ใน context.js อ่านสองช่องนี้ ซึ่งเป็นจุดเดียวที่ทุกจอและ `studyPlan()` ใช้ · ฝั่ง AI เป็น Edge Function ใหม่ `read-day` โครงเดียวกับ `read-timetable` · ฝั่งจอเพิ่มบล็อกหน้าแรก `dayCtx` · แผ่น "วันนี้ไปไหน" · การ์ด `dayoffer` ในแชท · แถวปิดเทอมในจอบริบท

**Tech Stack:** Vanilla JS (ไม่มี build) · Supabase Edge Function (Deno + Gemini ผ่าน `_shared/gemini.ts`) · เทสต์ด้วย node ตรง ๆ (`node:vm`, `node:test`)

**Spec:** `alt/docs/superpowers/specs/2026-10-18-daily-context-design.md`

## Global Constraints

- แก้ที่ `alt/` กับ `supabase/` เท่านั้น · ห้ามแตะ root build · ห้ามแก้ `style.css`
- ห้ามเปลี่ยนคีย์ `studentos.alt.ctx` · เพิ่มคีย์ localStorage ใหม่ได้หนึ่งตัวคือ `studentos.alt.breakAskOff`
- ทุกจอที่พูดเรื่อง "ควรทำอะไร" อ่านจาก `studyPlan()` (ผ่าน `focusPlan()`/`todayPlan()`) · ห้ามเรียก `buildDayPlan()` เพิ่ม
- เขียนบริบทรายวันได้ต่อเมื่อผู้ใช้กดยืนยันเท่านั้น
- ทุกครั้งที่บริบทรายวัน/ปิดเทอมเปลี่ยน ต้องล้าง `_planCache = null` ก่อน `renderAll()` (แผนแคชไว้นาทีละครั้ง และ `stateRev` ไม่ขยับเมื่อบริบทเปลี่ยน)
- หน้าแรก `scr-menu` ต้องไม่ต้องเลื่อนที่ 375×812
- `alt/app.js` เป็น CRLF — แก้ด้วยเครื่องมือ Edit แล้วเช็ค `git diff alt/app.js | grep -c $'\r'` ว่าบรรทัดใหม่มี `\r` เหมือนบรรทัดเดิม (ถ้าไม่ตรง แปลงด้วย `unix2dos` ไม่ได้ เพราะไม่มี · ใช้ node: `s.replace(/\r?\n/g,'\r\n')`)
- CSS ห้ามใช้ `font:` shorthand · flex item ที่เป็น `<span>` ใน alt/ กว้าง 0 → ใช้ grid · หัวข้อไทยห้ามใส่ letter-spacing บวก · สีใช้โทเคน `--card --card2 --line --ink --muted --fill` ที่มีครบทุกธีมเท่านั้น
- ภาษาในจอเป็นไทย · ข้อความ commit ภาษาอังกฤษเป็นย่อหน้าเล่าเหตุผล ลงท้าย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- ห้าม push · ห้าม deploy `read-day` จนกว่าเจ้าของสั่ง · ห้ามตั้งชื่อเวอร์ชัน

---

### Task 1: ชั้นข้อมูลใน context.js + `busyBlocks` รู้จักวันที่

**Files:**
- Modify: `alt/context.js` (CTX_DEFAULT · ctxLoad · ctxClear · busyBlocks · ctxDayBar · ctxImport · module.exports + ฟังก์ชันใหม่ต่อท้ายส่วน "อ่าน/เขียน")
- Create: `alt/devtools/ctx-day-check.cjs`

**Interfaces:**
- Produces (global functions):
  - `ctxDayKey(date: Date) → 'YYYY-MM-DD'` · `ctxAddDays(key: string, n: number) → string`
  - `ctxThaiDate(key: string) → '2 พ.ย.'`
  - `ctxBreaks() → Break[]` · `ctxBreakOn(date) → Break|null` (Break = `{id, from, to, title}`)
  - `ctxDay(date) → DayRec|null` · `ctxSchoolOn(date) → boolean`
  - `ctxCleanDay(raw) → DayRec` (DayRec = `{school: boolean|null, away: boolean, blocks: {start,end,title}[], note, advice, src, at}`)
  - `ctxSetDay(date, patch) → DayRec` · `ctxClearDay(date)`
  - `ctxSetBreak(fromKey, toKey) → Break|null` · `ctxEndBreak(date = new Date())`
  - `ctxWithDay(date, rec, fn) → ผลของ fn` (ใส่บันทึกชั่วคราว ไม่เขียนลงที่เก็บ คืนของเดิมเสมอ)
  - `ctxDayLines(date) → string[]` (บรรทัดไทยสำหรับ aiContext และ summary ของ read-day)
  - `busyBlocks(date, opts = {})` — `opts.typical === true` = พฤติกรรมเดิม · ก้อนใหม่มี `kind: 'day'`
  - `ctxDayBar(weekday, opts = {})` — `opts.real === true` = ใช้วันจริง (บริบทรายวัน + ปิดเทอม)

- [ ] **Step 1: เขียนเทสต์ที่ต้องตก**

สร้าง `alt/devtools/ctx-day-check.cjs`:

```js
// บริบทรายวัน + ปิดเทอม · รัน: node alt/devtools/ctx-day-check.cjs
// โหลด context.js ตัวจริงเข้า vm พร้อม localStorage จำลอง แล้วไล่เคสที่สเปกสัญญาไว้
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');

const data = new Map();
const localStorage = {
  getItem: k => (data.has(k) ? data.get(k) : null),
  setItem: (k, v) => data.set(k, String(v)),
  removeItem: k => data.delete(k),
};
const ctx = vm.createContext({ localStorage, console, Date, Math, JSON });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'context.js'), 'utf8'), ctx);
const run = s => vm.runInContext(s, ctx);

let n = 0;
function check(label, fn) { run('ctxClear()'); fn(); n++; console.log('PASS ' + label); }

// วันจันทร์ถัดไป (ไม่ใช่วันนี้) — ให้ทุกเคสไม่ขึ้นกับว่ารันวันไหน และไม่ชนเส้นตัดของเก่า 14 วัน
run(`var MON = new Date(); MON.setHours(0,0,0,0);
  MON.setDate(MON.getDate() + ((8 - MON.getDay()) % 7 || 7));
  function setup() {
    ctxUpsert('class', { subject: 'คณิต', start: '08:00', end: '15:00', weekday: 1 });
    ctxUpsert('routine', { kind: 'travel', title: 'เดินทางไปโรงเรียน', start: '07:00', end: '08:00', weekday: [1,2,3,4,5] });
    ctxUpsert('routine', { kind: 'meal', title: 'กินข้าวเย็น', start: '18:00', end: '19:00' });
  }
  function kinds(d, o) { return busyBlocks(d, o).map(b => b.kind).join(','); }`);

check('วันเรียนปกติมีคาบกับเดินทาง', () => {
  run('setup()');
  assert.equal(run('kinds(MON)'), 'travel,class,meal');
});
check('ปิดเทอมตัดคาบกับเดินทาง เหลือกิจวัตรอื่น', () => {
  run('setup(); ctxSetBreak(ctxAddDays(ctxDayKey(MON), -3), ctxAddDays(ctxDayKey(MON), 10))');
  assert.equal(run('kinds(MON)'), 'meal');
});
check('typical ไม่สนปิดเทอม (แท่งวันธรรมดาในจอตั้งค่า)', () => {
  run('setup(); ctxSetBreak(ctxDayKey(MON), ctxDayKey(MON))');
  assert.equal(run('kinds(MON, { typical: true })'), 'travel,class,meal');
});
check('บอกว่าอยู่บ้าน = ไม่มีคาบแม้ไม่ได้ปิดเทอม', () => {
  run('setup(); ctxSetDay(MON, { school: false })');
  assert.equal(run('kinds(MON)'), 'meal');
});
check('บอกว่าไปโรงเรียนช่วงปิดเทอม = คาบกลับมา', () => {
  run('setup(); ctxSetBreak(ctxDayKey(MON), ctxDayKey(MON)); ctxSetDay(MON, { school: true })');
  assert.equal(run('kinds(MON)'), 'travel,class,meal');
});
check('ช่วงที่ไม่อยู่เป็นก้อน day และกินเวลาว่าง', () => {
  run(`setup(); ctxSetDay(MON, { school: false, blocks: [{ start: '13:00', end: '17:00', title: 'ไปห้าง' }] })`);
  assert.equal(run('kinds(MON)'), 'day,meal');
  const free = run('JSON.stringify(freeSlots(MON).map(s => s.fromHm + "-" + s.toHm))');
  assert.equal(free, JSON.stringify(['06:00-13:00', '17:00-18:00', '19:00-21:30']));
});
check('ไม่อยู่ทั้งวัน = ไม่มีช่องว่างให้วางงาน', () => {
  run('setup(); ctxSetDay(MON, { away: true })');
  assert.equal(run('freeSlots(MON).length'), 0);
});
check('ตัวทำความสะอาดทิ้งเวลาเสีย และจำกัด 6 ก้อน', () => {
  const rec = run(`ctxCleanDay({ school: 'x', blocks: [
    { start: '25:00', end: '26:00', title: 'a' }, { start: '10:00', end: '09:00', title: 'b' },
    ...Array.from({ length: 8 }, (_, i) => ({ start: String(8 + i).padStart(2,'0') + ':00', end: String(8 + i).padStart(2,'0') + ':30', title: 'ช่วง' + i })) ] })`);
  assert.equal(rec.school, null);
  assert.equal(rec.blocks.length, 6);
  assert.equal(rec.blocks[0].start, '08:00');
});
check('บันทึกเก่ากว่า 14 วันถูกตัดตอนเขียน', () => {
  run(`setup(); var OLD = new Date(); OLD.setDate(OLD.getDate() - 20);
       ctxLoad().days[ctxDayKey(OLD)] = ctxCleanDay({ school: false }); ctxSetDay(MON, { school: false })`);
  assert.equal(run('ctxDay(OLD)'), null);
  assert.notEqual(run('ctxDay(MON)'), null);
});
check('ลงที่เก็บ · import กลับมาครบ · clear ล้าง', () => {
  run(`setup(); ctxSetDay(MON, { school: false }); ctxSetBreak(ctxDayKey(MON), ctxDayKey(MON))`);
  const saved = JSON.parse(data.get('studentos.alt.ctx'));
  assert.equal(Object.keys(saved.days).length, 1);
  assert.equal(saved.breaks.length, 1);
  run(`ctxClear(); ctxImport(${JSON.stringify(saved)})`);
  assert.equal(run('ctxDay(MON).school'), false);
  assert.notEqual(run('ctxBreakOn(MON)'), null);
  run('ctxClear()');
  assert.equal(run('ctxBreaks().length'), 0);
});
check('ctxWithDay ไม่เขียนลงที่เก็บ และคืนของเดิม', () => {
  run('setup(); ctxSetDay(MON, { school: true })');
  const before = data.get('studentos.alt.ctx');
  const inside = run(`ctxWithDay(MON, { away: true }, () => freeSlots(MON).length)`);
  assert.equal(inside, 0);
  assert.equal(run('ctxDay(MON).school'), true);
  assert.equal(data.get('studentos.alt.ctx'), before);
});
check('ตั้งปิดเทอมใหม่แทนอันที่ยังไม่จบ · จบปิดเทอมวันนี้ = ถึงเมื่อวาน', () => {
  run(`var T = new Date(); T.setHours(0,0,0,0); var TK = ctxDayKey(T);
       ctxSetBreak(TK, ctxAddDays(TK, 10)); ctxSetBreak(TK, ctxAddDays(TK, 20))`);
  assert.equal(run('ctxBreaks().length'), 1);
  assert.equal(run('ctxBreaks()[0].to'), run('ctxAddDays(TK, 20)'));
  run('ctxEndBreak(T)');
  assert.equal(run('ctxBreakOn(T)'), null);
});
check('ctxDayBar: วันธรรมดายังเห็นคาบ · วันนี้จริงช่วงปิดเทอมไม่เห็น', () => {
  run(`var T2 = new Date(); T2.setHours(0,0,0,0);
       ctxUpsert('class', { subject: 'ไทย', start: '08:00', end: '15:00', weekday: T2.getDay() });
       ctxSetBreak(ctxDayKey(T2), ctxAddDays(ctxDayKey(T2), 5))`);
  const has = o => run(`ctxDayBar(T2.getDay(), ${JSON.stringify(o)}).blocks.some(b => b.of === 'class')`);
  assert.equal(has({}), true);
  assert.equal(has({ real: true }), false);
});
check('ctxDayLines บอกปิดเทอมและวันเปิดเทอม', () => {
  // วันที่สัมพัทธ์กับ MON ทั้งหมด — วันตายตัวอย่าง '2026-11-01' จะทำให้เทสต์พังเองเมื่อเวลาผ่านไป
  run(`setup(); var BTO = ctxAddDays(ctxDayKey(MON), 13); ctxSetBreak(ctxAddDays(ctxDayKey(MON), -1), BTO)`);
  const lines = run('ctxDayLines(MON).join(" | ")');
  assert.match(lines, /ปิดเทอม/);
  assert.ok(lines.includes(run('ctxThaiDate(ctxAddDays(BTO, 1))')), lines);
});
console.log(`ctx-day: ${n}/${n}`);
```

- [ ] **Step 2: รันให้เห็นว่าตก**

Run: `node alt/devtools/ctx-day-check.cjs`
Expected: ตกที่เคสที่สองด้วย `ctxAddDays is not defined` (เคสแรกผ่านเพราะเป็นพฤติกรรมเดิม)

- [ ] **Step 3: แก้ข้อมูลตั้งต้นและตัวโหลด**

ใน `CTX_DEFAULT` เพิ่มต่อจาก `routines: [],`:

```js
  // 18 ต.ค. 69 · ช่วงปิดเทอม กับบันทึก "วันนี้เป็นยังไง" รายวัน — ดูหัวข้อ "บริบทรายวัน" ข้างล่าง
  breaks: [],
  days: {},
```

`ctxLoad()` · `ctxImport()` · `ctxClear()` ทั้งสามที่ต้องสร้าง `ctxCache` ด้วยสองช่องนี้ด้วย — เพิ่มฟังก์ชันกลางไว้เหนือ `ctxLoad`:

```js
// ก้อนบริบทจากที่เก็บ/คลาวด์ → รูปที่โค้ดทั้งไฟล์เชื่อได้ · ช่องที่เสียหรือไม่มี = ค่าว่าง
// ต้องผ่านที่นี่ทุกทาง (โหลด · นำเข้า · ล้าง) ไม่งั้นช่องใหม่จะหายเงียบ ๆ ทางใดทางหนึ่ง
function ctxShape(data) {
  const days = data && data.days && typeof data.days === 'object' && !Array.isArray(data.days) ? data.days : {};
  return {
    prefs: Object.assign({}, CTX_DEFAULT.prefs, (data && data.prefs) || {}),
    classes: Array.isArray(data && data.classes) ? data.classes : [],
    routines: Array.isArray(data && data.routines) ? data.routines : [],
    breaks: Array.isArray(data && data.breaks) ? data.breaks : [],
    days,
  };
}
```

แล้วแทน: ใน `ctxLoad` → `ctxCache = ctxShape(data);` · ใน `ctxClear` → `ctxCache = ctxShape(null);` · ใน `ctxImport` → `ctxCache = ctxShape(data);`

- [ ] **Step 4: เพิ่มชุดฟังก์ชันบริบทรายวัน**

วางต่อจาก `ctxClear()` (ก่อนหัวข้อ "ช่วงเวลาที่ถูกจองไว้ในวันหนึ่ง"):

```js
// ============================================================
// บริบทรายวัน + ปิดเทอม (18 ต.ค. 69)
// ------------------------------------------------------------
// ตารางเรียนกับกิจวัตรซ้ำทุกสัปดาห์ แต่ชีวิตจริงไม่ซ้ำ: ปิดเทอม · วันที่ไม่ได้ไปโรงเรียน
// · บ่ายนี้ไปห้าง · ทั้งวันไปต่างจังหวัด · ก่อนหน้านี้แอปไม่มีที่ให้บอกเรื่องพวกนี้เลย
// ผลคือปิดเทอมไปแล้วสองสัปดาห์ แผนยังวางคาบเรียนให้ทุกวันจันทร์–ศุกร์
//
// สองช่องในก้อนบริบทเดิม (คีย์เดิม ไม่ได้เปลี่ยน):
//   breaks  ช่วงปิดเทอม {from, to} — to คือวันหยุดวันสุดท้าย (วันก่อนเปิดเทอม)
//   days    บันทึกรายวันตามวันที่ — school/away/blocks ที่ผู้ใช้กดยืนยันแล้ว
//
// ทั้งสองถูกอ่านที่ busyBlocks() ที่เดียว แผน · ไทม์ไลน์ · ปฏิทิน · เวลาว่างจึงเปลี่ยนตามเอง
// ============================================================
const CTX_DAYS_KEEP = 14;     // บันทึกรายวันเก่ากว่านี้ไม่มีใครย้อนดู
const CTX_BREAK_KEEP = 30;    // ปิดเทอมที่จบไปแล้วเกินนี้ทิ้งได้
const CTX_YMD = /^\d{4}-\d{2}-\d{2}$/;
const CTX_TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function ctxDayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}
function ctxKeyDate(k) { return new Date(k + 'T00:00:00'); }
function ctxAddDays(k, n) {
  const d = ctxKeyDate(k);
  d.setDate(d.getDate() + n);
  return ctxDayKey(d);
}
function ctxThaiDate(k) {
  const d = ctxKeyDate(k);
  return isNaN(d) ? k : d.getDate() + ' ' + CTX_TH_MONTH[d.getMonth()];
}

function ctxBreaks() { return ctxLoad().breaks; }
function ctxBreakOn(date) {
  const k = ctxDayKey(date);
  return ctxBreaks().find(b => b && b.from <= k && k <= b.to) || null;
}
function ctxDay(date) { return ctxLoad().days[ctxDayKey(date)] || null; }

// ไปโรงเรียนไหม: คำตอบของวันนั้นชนะเสมอ (ปิดเทอมแต่ถูกเรียกไปซ่อมเสริมก็มี)
// ไม่ได้บอก = ตามปฏิทิน · ปิดเทอม = ไม่ไป
function ctxSchoolOn(date) {
  const d = ctxDay(date);
  if (d && typeof d.school === 'boolean') return d.school;
  return !ctxBreakOn(date);
}

// ของที่มาจาก AI หรือจากคลาวด์ต้องผ่านที่นี่ก่อนเสมอ — "25:70" ยังเป็นสตริงที่ถูกชนิดอยู่ดี
function ctxCleanDay(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const blocks = [];
  for (const b of Array.isArray(r.blocks) ? r.blocks : []) {
    if (blocks.length >= 6) break;
    const a = hm2min(b && b.start), e = hm2min(b && b.end);
    if (a == null || e == null || e <= a) continue;
    blocks.push({ start: min2hm(a), end: min2hm(e),
      title: String((b && b.title) || 'ไม่อยู่').trim().slice(0, 30) || 'ไม่อยู่' });
  }
  blocks.sort((x, y) => hm2min(x.start) - hm2min(y.start));
  return {
    school: typeof r.school === 'boolean' ? r.school : null,
    away: r.away === true,
    blocks,
    note: String(r.note || '').trim().slice(0, 120),
    advice: String(r.advice || '').trim().slice(0, 160),
    src: ['tap', 'ai', 'manual'].includes(r.src) ? r.src : 'manual',
    at: +r.at || Date.now(),
  };
}

function ctxPrune(c, now = new Date()) {
  const dayCut = ctxAddDays(ctxDayKey(now), -CTX_DAYS_KEEP);
  for (const k of Object.keys(c.days)) if (!CTX_YMD.test(k) || k < dayCut) delete c.days[k];
  const brkCut = ctxAddDays(ctxDayKey(now), -CTX_BREAK_KEEP);
  c.breaks = c.breaks.filter(b => b && CTX_YMD.test(b.from) && CTX_YMD.test(b.to) && b.to >= brkCut);
}

function ctxSetDay(date, patch) {
  const c = ctxLoad();
  const k = ctxDayKey(date);
  c.days[k] = ctxCleanDay(Object.assign({}, c.days[k] || {}, patch || {}, { at: Date.now() }));
  ctxPrune(c);
  ctxSave();
  return c.days[k];
}
function ctxClearDay(date) {
  const c = ctxLoad();
  delete c.days[ctxDayKey(date)];
  ctxSave();
}

// ปิดเทอมที่ยังไม่จบมีได้ช่วงเดียว — ตั้งใหม่ = แทนของเดิม (คนแก้วันเปิดเทอมเพราะโรงเรียนเลื่อน)
function ctxSetBreak(fromKey, toKey) {
  if (!CTX_YMD.test(fromKey) || !CTX_YMD.test(toKey) || toKey < fromKey) return null;
  const c = ctxLoad();
  c.breaks = c.breaks.filter(b => b && b.to < fromKey);
  const rec = { id: ctxUid(), from: fromKey, to: toKey, title: 'ปิดเทอม' };
  c.breaks.push(rec);
  ctxPrune(c);
  ctxSave();
  return rec;
}
// เปิดเทอมเร็วกว่าที่ตั้งไว้ — ตัดช่วงให้จบเมื่อวาน · ถ้าเพิ่งเริ่มวันนี้ก็ลบทิ้งทั้งช่วง
function ctxEndBreak(date = new Date()) {
  const c = ctxLoad();
  const k = ctxDayKey(date), y = ctxAddDays(k, -1);
  c.breaks = c.breaks
    .map(b => (b.from <= k && k <= b.to ? Object.assign({}, b, { to: y }) : b))
    .filter(b => b.to >= b.from);
  ctxSave();
}

// ลองใส่บันทึกของวันชั่วคราวเพื่อดูว่าแผนจะเปลี่ยนเป็นอะไร (การ์ดยืนยันของ AI)
// ไม่เรียก ctxSave — ห้ามมีอะไรลงที่เก็บหรือขึ้นคลาวด์ก่อนผู้ใช้กดยืนยัน
function ctxWithDay(date, rec, fn) {
  const c = ctxLoad();
  const k = ctxDayKey(date);
  const had = Object.prototype.hasOwnProperty.call(c.days, k);
  const old = c.days[k];
  c.days[k] = ctxCleanDay(rec);
  try { return fn(); }
  finally { if (had) c.days[k] = old; else delete c.days[k]; }
}

// บรรทัดภาษาไทยที่บอก "วันนั้นเป็นยังไง" — ใช้ทั้งในบริบทของน้องไซ และ summary ที่ส่งให้ read-day
function ctxDayLines(date) {
  const out = [];
  const brk = ctxBreakOn(date);
  const d = ctxDay(date);
  if (brk) out.push('ปิดเทอมอยู่ · เปิดเทอม ' + ctxThaiDate(ctxAddDays(brk.to, 1)));
  if (d && d.away) out.push('ไม่อยู่ทั้งวัน');
  else if (d && d.school === true) out.push('ไปโรงเรียน');
  else if (d && d.school === false) out.push('ไม่ไปโรงเรียน');
  else if (!brk) out.push('ตามตารางปกติ (ยังไม่ได้บอกเพิ่ม)');
  for (const b of (d && d.blocks) || []) out.push('ไม่ว่าง ' + b.start + '–' + b.end + ' ' + b.title);
  if (d && d.note) out.push('ผู้ใช้เล่าว่า: ' + d.note);
  return out;
}
```

- [ ] **Step 5: ให้ `busyBlocks` อ่านบริบทรายวัน**

แทนทั้งฟังก์ชัน `busyBlocks(date)` ด้วย:

```js
// opts.typical = "สัปดาห์ปกติของเขา" ไม่สนปิดเทอมหรือบันทึกรายวัน
// ใช้กับแท่ง "วันธรรมดาของคุณ" ในจอตั้งค่า กับ ctxLearn ซึ่งถามถึงนิสัย ไม่ใช่วันจริง
function busyBlocks(date, opts = {}) {
  const c = ctxLoad();
  const wd = date.getDay();
  const out = [];
  const typical = opts.typical === true;
  const day = typical ? null : ctxDay(date);
  const school = typical ? true : ctxSchoolOn(date);

  // ไม่อยู่ทั้งวัน = ก้อนเดียวตั้งแต่ตื่นถึงนอน · ไม่ต้องไล่อย่างอื่น
  if (day && day.away) {
    const p = c.prefs;
    const a = hm2min(p.wake) ?? 6 * 60;
    const b = Math.max(a + 5, hm2min(p.sleep) ?? 22 * 60 + 30);
    return [{ from: a, to: b, kind: 'day', title: 'ไม่อยู่ทั้งวัน', id: 'day-away' }];
  }

  if (school) {
    for (const k of c.classes) {
      const a = hm2min(k.start), b = hm2min(k.end);
      if (a == null || b == null || b <= a || !onDay(k, wd, date)) continue;
      out.push({ from: a, to: b, kind: 'class', title: k.subject || 'เรียน', id: k.id });
    }
  }
  for (const r of c.routines) {
    // ไม่ไปโรงเรียน = ไม่มีการเดินทางไปโรงเรียน · กิจวัตรอื่น (กินข้าว ซ้อม) ยังอยู่
    if (!school && r.kind === 'travel') continue;
    const a = hm2min(r.start), b = hm2min(r.end);
    if (a == null || b == null || b <= a || !onDay(r, wd)) continue;
    out.push({ from: a, to: b, kind: r.kind || 'routine', title: r.title || 'กิจวัตร', id: r.id });
  }
  ((day && day.blocks) || []).forEach((x, i) => {
    const a = hm2min(x.start), b = hm2min(x.end);
    if (a == null || b == null || b <= a) return;
    out.push({ from: a, to: b, kind: 'day', title: x.title, id: 'day-' + i });
  });
  return out.sort((x, y) => x.from - y.from || x.to - y.to);
}
```

- [ ] **Step 6: `ctxDayBar` เลือกได้ว่าวันจริงหรือวันปกติ**

เปลี่ยนหัวฟังก์ชันเป็น `function ctxDayBar(weekday, opts = {}) {` และบรรทัด `const raw = busyBlocks(ref)` เป็น:

```js
  const raw = busyBlocks(ref, { typical: opts.real !== true })
```

- [ ] **Step 7: export ฟังก์ชันใหม่ให้ node**

ใน `module.exports` เพิ่มต่อท้าย:
`ctxDayKey, ctxAddDays, ctxThaiDate, ctxBreaks, ctxBreakOn, ctxDay, ctxSchoolOn, ctxCleanDay, ctxSetDay, ctxClearDay, ctxSetBreak, ctxEndBreak, ctxWithDay, ctxDayLines, ctxImport,`

- [ ] **Step 8: รันให้ผ่าน แล้วถอดโค้ดดูว่าตกจริง**

Run: `node alt/devtools/ctx-day-check.cjs` → Expected: `ctx-day: 14/14`
แล้วลองแก้ `const school = typical ? true : ctxSchoolOn(date);` เป็น `const school = true;` ชั่วคราว → Expected: ตกที่ "ปิดเทอมตัดคาบกับเดินทาง" · คืนโค้ดแล้วรันให้ผ่านอีกรอบ
Run: `node --check alt/context.js` → ไม่มี output

- [ ] **Step 9: ผู้เรียกที่ถามถึง "สัปดาห์ปกติ" ใน app.js**

- `ctxLearn()`: `busyBlocks(ref).filter(` → `busyBlocks(ref, { typical: true }).filter(`
- `ctxHeroHtml(weekday, now, todayLeft)`: บรรทัดแรก `const bar = ctxDayBar(weekday);` → `const bar = ctxDayBar(weekday, { real: weekday === now.getDay() });`
- ผู้เรียก `ctxDayBar(d)` ในแท่งสัปดาห์ (`[1, 2, 3, 4, 5, 6, 0].map(d => ({ d, min: ctxDayBar(d).freeMin }))`) ปล่อยไว้ = typical (ถูกแล้ว: เป็นภาพสัปดาห์ปกติ)
- ผู้เรียก `busyBlocks(d)` ที่เหลือ (ไทม์ไลน์ ปฏิทิน แผน) ปล่อยไว้ = วันจริง

Run: `node --check alt/app.js`

- [ ] **Step 10: Commit**

```bash
git add alt/context.js alt/app.js alt/devtools/ctx-day-check.cjs
git commit -m "Teach busyBlocks about term breaks and per-day context ..."
```

---

### Task 2: ตัวกรองผลของ `read-day` (ทดสอบได้ด้วย node ตรง ๆ)

**Files:**
- Create: `supabase/functions/read-day/clean.ts`
- Create: `supabase/functions/read-day/__tests__/clean.test.mjs`

**Interfaces:**
- Produces:
  - `addDays(key: string, n: number): string`
  - `cleanInput(body: unknown): { text: string; today: string; now: string; summary: string } | null`
  - `cleanDay(raw: unknown, today: string): DayRead`
  - `type DayRead = { date: string; school: boolean | null; away: boolean; blocks: { start: string; end: string; title: string }[]; breakUntil: string | null; advice: string; note: string }`

- [ ] **Step 1: เขียนเทสต์**

`supabase/functions/read-day/__tests__/clean.test.mjs`:

```js
// รัน: node --test supabase/functions/read-day/__tests__/clean.test.mjs
// (Node 24 ตัด type ของ .ts เองได้ · clean.ts ไม่มี import จึงโหลดตรงได้)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, cleanDay, cleanInput } from '../clean.ts';

const T = '2026-10-18';

test('addDays ข้ามเดือนได้', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
});

test('ช่วงเวลาที่ดีผ่าน · เสียถูกทิ้ง · เรียงตามเวลา · สูงสุด 6', () => {
  const r = cleanDay({ date: T, school: false, blocks: [
    { start: '17:30', end: '19:00', title: 'เรียนพิเศษ' },
    { start: '13:00', end: '17:00', title: 'ไปห้าง' },
    { start: '25:00', end: '26:00', title: 'x' },
    { start: '10:00', end: '09:00', title: 'y' },
  ] }, T);
  assert.deepEqual(r.blocks.map(b => b.start), ['13:00', '17:30']);
  assert.equal(r.school, false);
});

test('วันที่นอกช่วง วันนี้ถึง +7 → ใช้วันนี้', () => {
  assert.equal(cleanDay({ date: '2026-12-25' }, T).date, T);
  assert.equal(cleanDay({ date: '2026-10-19' }, T).date, '2026-10-19');
  assert.equal(cleanDay({ date: 'พรุ่งนี้' }, T).date, T);
});

test('breakUntil ต้องเป็นอนาคตไม่เกิน 200 วัน', () => {
  assert.equal(cleanDay({ breakUntil: '2026-11-02' }, T).breakUntil, '2026-11-02');
  assert.equal(cleanDay({ breakUntil: '2026-10-01' }, T).breakUntil, null);
  assert.equal(cleanDay({ breakUntil: '2028-01-01' }, T).breakUntil, null);
});

test('school ที่ไม่ใช่ boolean = null · ข้อความถูกตัดความยาว', () => {
  const r = cleanDay({ school: 'yes', advice: 'ก'.repeat(500), note: 'ข'.repeat(500) }, T);
  assert.equal(r.school, null);
  assert.equal(r.advice.length, 160);
  assert.equal(r.note.length, 200);
});

test('cleanInput ต้องมีข้อความกับวันที่ถูกรูปแบบ', () => {
  assert.equal(cleanInput({ text: '', today: T }), null);
  assert.equal(cleanInput({ text: 'ไปห้าง', today: '18/10' }), null);
  const ok = cleanInput({ text: 'ไปห้าง'.repeat(100), today: T, now: '9:05', summary: 's'.repeat(5000) });
  assert.equal(ok.text.length, 300);
  assert.equal(ok.summary.length, 2000);
  assert.equal(ok.now, '');   // '9:05' ไม่ใช่ HH:MM สองหลัก — ไม่เดา
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

Run: `node --test supabase/functions/read-day/__tests__/clean.test.mjs`
Expected: FAIL — `Cannot find module '.../clean.ts'`

- [ ] **Step 3: เขียน `clean.ts`**

```ts
// ตัวกรองผลของ read-day — แยกไฟล์และไม่มี import เพื่อให้ node ทดสอบได้ตรง ๆ
// โมเดลทำตาม schema เรื่องชนิดข้อมูลได้ แต่ไม่รับประกันว่าค่าสมเหตุสมผล
// ของเสียต้องไม่ออกจากเซิร์ฟเวอร์ (ฝั่งแอปกรองซ้ำอีกชั้นใน ctxCleanDay)

export type DayBlock = { start: string; end: string; title: string };
export type DayRead = {
  date: string; school: boolean | null; away: boolean; blocks: DayBlock[];
  breakUntil: string | null; advice: string; note: string;
};

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function toMin(s: unknown): number | null {
  const m = HHMM.exec(String(s ?? '').trim());
  return m ? +m[1] * 60 + +m[2] : null;
}
function pad(v: number): string {
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function cleanInput(body: unknown) {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = String(o.text ?? '').trim().slice(0, 300);
  const today = String(o.today ?? '');
  if (!text || !YMD.test(today)) return null;
  const now = HHMM.test(String(o.now ?? '')) ? String(o.now) : '';
  const summary = String(o.summary ?? '').slice(0, 2000);
  return { text, today, now, summary };
}

export function cleanDay(raw: unknown, today: string): DayRead {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const dateIn = String(o.date ?? '');
  const date = YMD.test(dateIn) && dateIn >= today && dateIn <= addDays(today, 7) ? dateIn : today;

  const blocks: DayBlock[] = [];
  for (const b of Array.isArray(o.blocks) ? o.blocks : []) {
    const r = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    const a = toMin(r.start), e = toMin(r.end);
    if (a == null || e == null || e <= a) continue;
    blocks.push({ start: pad(a), end: pad(e),
      title: String(r.title ?? '').trim().slice(0, 30) || 'ไม่อยู่' });
  }
  blocks.sort((x, y) => toMin(x.start)! - toMin(y.start)!);

  const bu = String(o.breakUntil ?? '');
  const breakUntil = YMD.test(bu) && bu > today && bu <= addDays(today, 200) ? bu : null;

  return {
    date,
    school: typeof o.school === 'boolean' ? o.school : null,
    away: o.away === true,
    blocks: blocks.slice(0, 6),
    breakUntil,
    advice: String(o.advice ?? '').trim().slice(0, 160),
    note: String(o.note ?? '').trim().slice(0, 200),
  };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `node --test supabase/functions/read-day/__tests__/clean.test.mjs` → Expected: `pass 6` `fail 0`
ถ้า Node บ่นเรื่อง type stripping ให้รันด้วย `node --experimental-strip-types --test ...` แล้วจดไว้ในหัวไฟล์เทสต์

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/read-day/clean.ts supabase/functions/read-day/__tests__/clean.test.mjs
git commit -m "Add the read-day result filter with node tests ..."
```

---

### Task 3: Edge Function `read-day` (ยังไม่ deploy)

**Files:**
- Create: `supabase/functions/read-day/index.ts`
- Modify: `supabase/config.toml` (เพิ่มบล็อกต่อจาก `[functions.ask-sai]`)

**Interfaces:**
- Consumes: `cleanInput`, `cleanDay` (Task 2) · `geminiGenerate`, `geminiTrailLine`, `GeminiError` จาก `../_shared/gemini.ts` (ใช้แบบเดียวกับ read-timetable)
- Produces: `POST /functions/v1/read-day` body `{ text, today, now, summary }` → `200 { ok: true, ...DayRead }` · error → `{ ok: false, message }` สถานะ 400/500/502

- [ ] **Step 1: เขียน `index.ts`**

```ts
// ============================================================
// Student OS — read-day
// ------------------------------------------------------------
// รับข้อความที่ผู้ใช้เล่าเรื่องวันนี้ ("ไปห้างบ่ายโมงถึงห้าโมง แล้วเย็นเรียนพิเศษ")
// คืนเป็นช่วงเวลา + ไปโรงเรียนไหม + ข้อสังเกตสั้น ๆ หนึ่งบรรทัด
//
// แอปไม่บันทึกอะไรจากที่นี่เอง — ผลนี้ไปขึ้นการ์ด "จดแบบนี้ ถูกไหม" ก่อนเสมอ
// และ "งานไหนก่อน" ยังมาจากเอนจินในเครื่อง (studyPlan) · ที่นี่พูดได้แค่เรื่องเวลา
//
// กุญแจ Gemini อยู่ที่นี่เท่านั้น · verify_jwt = true (config.toml) ห้ามปิด
// ไม่เก็บข้อความไว้ที่ไหน ไม่เขียนฐานข้อมูลสักแถว
// ============================================================

import { geminiGenerate, geminiTrailLine, type GeminiError } from '../_shared/gemini.ts';
import { cleanDay, cleanInput } from './clean.ts';

const API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function prompt(i: { text: string; today: string; now: string; summary: string }) {
  return `คุณช่วยนักเรียนมัธยมไทยจดว่า "วันนั้นเป็นยังไง" จากข้อความที่เขาพิมพ์ แล้วคืน JSON ตาม schema

วันนี้: ${i.today}${i.now ? ' เวลา ' + i.now : ''}
ข้อมูลที่แอปรู้อยู่แล้ว:
${i.summary || '(ไม่มี)'}

ข้อความของผู้ใช้:
"""${i.text}"""

กติกา:
- date: วันที่ข้อความพูดถึง YYYY-MM-DD (ไม่ระบุ = วันนี้) · ไม่เกิน 7 วันข้างหน้า
- school: true ถ้าบอกว่าไปโรงเรียน · false ถ้าบอกว่าไม่ไป/อยู่บ้าน/ปิดเทอม/ไปเที่ยวทั้งวันในวันเรียน · ไม่ได้พูดถึง = null
- away: true เฉพาะเมื่อไม่อยู่ทั้งวันจริง ๆ (ไปต่างจังหวัด เข้าค่าย) ไม่มีเวลาทำงานเลย
- blocks: ช่วงที่ไม่ว่าง start/end แบบ HH:MM 24 ชม. · "บ่ายโมง"=13:00 "ห้าโมงเย็น"=17:00 "สองทุ่ม"=20:00 "เที่ยง"=12:00
  ถ้าบอกเวลาเริ่มแต่ไม่บอกจบ ให้ประเมินจากกิจกรรมแบบสมเหตุสมผล แล้วเขียนใน note ว่าเดาเวลาจบ
  ถ้าไม่มีเวลาเลย ห้ามแต่งเวลาขึ้นมา — blocks ว่าง แล้วบอกใน note
- title: ชื่อสั้น ๆ ไม่เกิน 30 ตัวอักษร เช่น "ไปห้าง" "เรียนพิเศษ"
- breakUntil: ถ้าพูดถึงวันเปิดเทอม ให้ใส่วันเปิดเทอม YYYY-MM-DD · ไม่พูดถึง = null
- advice: ภาษาไทย ไม่เกิน 160 ตัวอักษร พูดกับผู้ใช้ตรง ๆ เรื่องเวลา: หลังหักช่วงที่ไม่อยู่ เหลือว่างช่วงไหน และงานที่ใกล้ส่งจะทันไหม
  ห้ามเสนอให้ทำงานอื่นก่อน "งานแรกตอนนี้" ที่แอปบอกไว้ · ห้ามให้กำลังใจลอย ๆ · ไม่มีอะไรน่าห่วงก็บอกสั้น ๆ ว่าทันสบาย
- note: เหตุผลสั้น ๆ เมื่ออ่านไม่ออกหรือต้องเดา · ปกติให้ว่าง`;
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING' },
    school: { type: 'BOOLEAN', nullable: true },
    away: { type: 'BOOLEAN' },
    blocks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { start: { type: 'STRING' }, end: { type: 'STRING' }, title: { type: 'STRING' } },
        required: ['start', 'end', 'title'],
      },
    },
    breakUntil: { type: 'STRING', nullable: true },
    advice: { type: 'STRING' },
    note: { type: 'STRING' },
  },
  required: ['date', 'away', 'blocks', 'advice'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, message: 'ต้องเรียกด้วย POST' }, 405);
  if (!API_KEY) return json({ ok: false, message: 'ยังไม่ได้ตั้ง secret ชื่อ GEMINI_API_KEY' }, 500);

  let input: ReturnType<typeof cleanInput> = null;
  try { input = cleanInput(await req.json()); } catch { input = null; }
  if (!input) return json({ ok: false, message: 'ไม่มีข้อความ หรือวันที่ไม่ถูกรูปแบบ' }, 400);

  let parsed: unknown = {};
  try {
    const r = await geminiGenerate({
      parts: [{ text: prompt(input) }],
      temperature: 0.2,
      think: 'off',
      json: true,
      responseSchema: SCHEMA,
      maxOutputTokens: 1024,
      budgetMs: 25_000,
    });
    parsed = JSON.parse(r.text);
  } catch (e) {
    const err = e as GeminiError;
    console.warn('[read-day] gemini', err.status ?? 0, err.message, geminiTrailLine(err.trail));
    if (err.status === 429) return json({ ok: false, message: 'AI คนแน่นชั่วคราว ลองใหม่อีกสักครู่ หรือเลือกเวลาเอง' }, 502);
    return json({ ok: false, message: 'AI อ่านไม่สำเร็จ ลองเลือกเวลาเองแทนได้' }, 502);
  }

  return json({ ok: true, ...cleanDay(parsed, input.today) });
});
```

- [ ] **Step 2: ตรวจลายเซ็น `geminiGenerate` ให้ตรงของจริง**

Run: `grep -n "export async function geminiGenerate\|export function geminiTrailLine\|export type GeminiError\|export interface GeminiError" supabase/functions/_shared/gemini.ts`
แล้วอ่านช่องตัวเลือกของ `geminiGenerate` — ถ้าชื่อช่องต่างจากที่ read-timetable ใช้ (`parts temperature think json responseSchema maxOutputTokens budgetMs`) ให้แก้ index.ts ตามของจริง · ถ้า schema ของรุ่นนี้ไม่รองรับ `nullable` ให้ถอด `nullable` ออกแล้วอธิบายใน prompt ว่าไม่รู้ให้ส่ง `null` (ฝั่ง cleanDay รับได้ทั้งคู่)

- [ ] **Step 3: config.toml**

เพิ่มต่อจากบล็อก `[functions.ask-sai]`:

```toml
# ตัวอ่าน "วันนี้ไปไหน" ถือกุญแจ Gemini เหมือนสามตัวข้างบน — กฎเดียวกัน ห้ามปิด
[functions.read-day]
verify_jwt = true
```

- [ ] **Step 4: เช็คว่า bundle ได้ (ไม่ deploy)**

Run (จาก root ของ worktree): `npx --yes esbuild@0.23.1 --bundle --format=esm "--external:npm:*" "--external:jsr:*" --outfile=$TEMP/read-day.mjs supabase/functions/read-day/index.ts`
Expected: สร้างไฟล์ได้ ไม่มี error · ลบ `$TEMP/read-day.mjs` ทิ้ง
(npx ดาวน์โหลด esbuild — เป็นวิธีเดียวกับที่ README ของ `notify-dm/__tests__` ใช้อยู่)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/read-day/index.ts supabase/config.toml
git commit -m "Add the read-day edge function (not deployed) ..."
```

---

### Task 4: บริบทที่ส่งให้น้องไซรู้จักวันนี้

**Files:**
- Modify: `alt/app.js` — `aiContext()` (หัวข้อ "เวลาประจำวัน" กับ "ตารางเรียน")
- Modify: `alt/devtools/review-check.cjs` — `contextFor` รับของเสริม + เคสใหม่

**Interfaces:**
- Consumes: `ctxDayLines(date)`, `ctxBreakOn(date)`, `ctxDay(date)`, `ctxThaiDate`, `ctxAddDays` (Task 1)

- [ ] **Step 1: เพิ่มเคสที่ต้องตกใน review-check**

เปลี่ยน `function contextFor(plan) {` เป็น `function contextFor(plan, extra = {}) {` และใน `vm.createContext({ ... })` ต่อท้ายด้วย `...extra,`
แล้วเพิ่มเคสใหม่ต่อจาก `checkAI` ตัวสุดท้าย:

```js
checkAI('ช่วงปิดเทอม บริบท AI บอกวันนี้และไม่ลิสต์คาบเรียน', () => {
  const s = contextFor(canonical, {
    ctxClasses: () => [{ weekday: 1, start: '08:00', end: '15:00', subject: 'ฟิสิกส์' }],
    ctxBreakOn: () => ({ from: '2026-10-01', to: '2026-11-01' }),
    ctxDay: () => null,
    ctxDayLines: () => ['ปิดเทอมอยู่ · เปิดเทอม 2 พ.ย.'],
    ctxThaiDate: () => '2 พ.ย.', ctxAddDays: () => '2026-11-02',
    WEEKDAY_SHORT: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
  });
  assert.match(s, /## บริบทวันนี้/);
  assert.match(s, /ปิดเทอม/);
  assert.doesNotMatch(s, /ฟิสิกส์/);
});
```

Run: `node alt/devtools/review-check.cjs` → Expected: FAIL ที่เคสใหม่ (`## บริบทวันนี้` ไม่มี)

- [ ] **Step 2: แก้ `aiContext`**

ต่อจากบรรทัด `L.push('- เวลาว่างที่เหลือวันนี้: ' + humanMin(freeMinutes(now, now)));` และ `}` ที่ปิด if นั้น ใส่:

```js
  // 18 ต.ค. 69 · วันนี้ต่างจากสัปดาห์ปกติยังไง — ปิดเทอม · ไม่ไปโรงเรียน · ช่วงที่ไม่อยู่
  // ไม่มีหัวข้อนี้ น้องไซเห็นแต่ตารางเรียนแล้วจัดวันให้เหมือนเปิดเทอมทุกวัน
  if (typeof ctxDayLines === 'function') {
    L.push('## บริบทวันนี้');
    for (const ln of ctxDayLines(now)) L.push('- ' + ln);
  }
  const brkNow = typeof ctxBreakOn === 'function' ? ctxBreakOn(now) : null;
  const dayNow = typeof ctxDay === 'function' ? ctxDay(now) : null;
  const onBreak = !!brkNow && !(dayNow && dayNow.school === true);
```

แล้วในหัวข้อตารางเรียน เปลี่ยน:

```js
  L.push('## ตารางเรียน (' + cls.length + ' คาบ)');
  if (!cls.length) L.push('- ยังไม่ได้บอกตารางเรียน เวลาว่างข้างบนเป็นค่าเดา ไม่ใช่ของจริง');
  for (const c of cls) {
```

เป็น:

```js
  L.push('## ตารางเรียน (' + cls.length + ' คาบ)');
  if (onBreak) {
    L.push('- ปิดเทอมอยู่ถึงก่อนวันที่ ' + ctxThaiDate(ctxAddDays(brkNow.to, 1))
      + ' ช่วงนี้ไม่มีคาบเรียน อย่าจัดเวลาให้ไปโรงเรียน');
  } else if (!cls.length) L.push('- ยังไม่ได้บอกตารางเรียน เวลาว่างข้างบนเป็นค่าเดา ไม่ใช่ของจริง');
  for (const c of onBreak ? [] : cls) {
```

- [ ] **Step 3: รัน**

Run: `node alt/devtools/review-check.cjs` → Expected: เคสเดิมผ่านครบ + `PASS ช่วงปิดเทอม บริบท AI บอกวันนี้และไม่ลิสต์คาบเรียน`
Run: `node --check alt/app.js`

- [ ] **Step 4: Commit**

```bash
git add alt/app.js alt/devtools/review-check.cjs
git commit -m "Tell the assistant what today actually looks like ..."
```

---

### Task 5: ตัวเรียก `read-day` + การบันทึกผลฝั่งแอป

**Files:**
- Modify: `alt/app.js` — เพิ่มชุดฟังก์ชันใหม่ต่อท้าย `askSaiStream` (ก่อนหัวข้อถัดไป)

**Interfaces:**
- Consumes: Task 1 (`ctxSetDay`, `ctxWithDay`, `ctxSetBreak`, `ctxAddDays`, `ctxDayKey`, `ctxDayLines`), `freeSlots`, `studyPlan`, `pendingTasks`, `taskTitleText`, `fmtDue`, `withTimeout`, `sb`, `currentUser`, `ymdLocal`
- Produces:
  - `dayCtxSummary(now) → string`
  - `readDay(text) → Promise<{ ok: true, read: DayRead } | { ok: false, message: string }>`
  - `dayTrialFirst(read) → string` (ชื่องานแรกถ้าใส่บันทึกนี้ · '' ถ้าไม่ใช่วันนี้หรือไม่มีงาน)
  - `dayApply(read, text, opts = { setBreak: true })` (บันทึก + ตั้งปิดเทอมถ้ามี + ล้างแคช + วาดใหม่)
  - `dayChanged()` (ล้าง `_planCache` แล้ว `renderAll()`)

- [ ] **Step 1: เขียนโค้ด**

```js
// ============================================================
// 18 ต.ค. 69 · บริบทรายวัน — ฝั่งแอปของ read-day
// ------------------------------------------------------------
// AI อ่านข้อความ คืนช่วงเวลา + ข้อสังเกต → แอปโชว์การ์ดยืนยัน → ผู้ใช้กด → ค่อยบันทึก
// งานแรกบนการ์ดคิดจาก studyPlan ในเครื่องหลัง "ลองใส่" ช่วงใหม่ (ctxWithDay ไม่เขียนอะไรลงที่เก็บ)
// AI จึงพูดเรื่องเวลาได้ แต่คนตัดสินว่างานไหนก่อนยังเป็นเอนจินตัวเดียวกับหน้าแรก
// ============================================================

// แผนแคชไว้นาทีละครั้งตาม stateRev ซึ่งไม่ขยับเมื่อบริบทเปลี่ยน — ต้องล้างเองทุกครั้ง
function dayChanged() {
  _planCache = null;
  renderAll();
}

function dayCtxSummary(now = new Date()) {
  const L = [];
  if (typeof ctxDayLines === 'function') for (const ln of ctxDayLines(now)) L.push('- ' + ln);
  const slots = typeof freeSlots === 'function' ? freeSlots(now, now) : [];
  L.push('- ช่วงว่างที่เหลือวันนี้: ' + (slots.length ? slots.map(s => s.fromHm + '–' + s.toHm).join(', ') : 'ไม่มี'));
  const sp = focusPlan(now);
  L.push('- งานแรกตอนนี้ (แอปเลือกแล้ว): ' + (sp.now ? taskTitleText(sp.now.task) : 'ไม่มี'));
  const top = pendingTasks().slice(0, 5);
  for (const t of top) {
    L.push('- งานค้าง: ' + taskTitleText(t) + ' · ส่ง ' + (t.due ? fmtDue(t.due, now, t).replace(/^⚠\s*/, '') : 'ไม่ระบุ')
      + ' · ประเมิน ' + (t.estMin || '—') + ' นาที');
  }
  return L.join('\n');
}

async function readDay(text) {
  const t = String(text || '').trim();
  if (!t) return { ok: false, message: 'พิมพ์ก่อนว่าวันนี้ไปไหน' };
  if (!sb || !currentUser) return { ok: false, message: 'ต้องเข้าสู่ระบบก่อนถึงจะให้น้องไซอ่านได้ · เลือกเวลาเองได้เลย' };
  const now = new Date();
  try {
    const { data, error } = await withTimeout(sb.functions.invoke('read-day', {
      body: { text: t, today: ymdLocal(now), now: fmtClock(now), summary: dayCtxSummary(now) },
    }), 30_000, 'อ่านวันนี้');
    let payload = data;
    if (error) { try { payload = await error.context.json(); } catch (_) { payload = null; } }
    if (!payload || payload.ok !== true) {
      return { ok: false, message: (payload && payload.message) || 'น้องไซอ่านไม่สำเร็จ ลองเลือกเวลาเองแทนได้' };
    }
    return { ok: true, read: payload };
  } catch (e) {
    return { ok: false, message: (e && e.message) || 'ต่อไม่ติด ลองเลือกเวลาเองแทนได้' };
  }
}

function dayRecOf(read, text, src) {
  return { school: read.school, away: !!read.away, blocks: read.blocks || [],
    note: String(text || '').slice(0, 120), advice: read.advice || '', src };
}

function dayTrialFirst(read) {
  const now = new Date();
  if (!read || read.date !== ymdLocal(now) || typeof ctxWithDay !== 'function') return '';
  const sp = ctxWithDay(now, dayRecOf(read, '', 'ai'), () => studyPlan(state, now));
  return sp && sp.now ? taskTitleText(sp.now.task) : '';
}

function dayApply(read, text, opts = {}) {
  const date = new Date(read.date + 'T00:00:00');
  ctxSetDay(date, dayRecOf(read, text, opts.src || 'ai'));
  if (read.breakUntil && opts.setBreak !== false) {
    const today = ctxDayKey(new Date());
    ctxSetBreak(today, ctxAddDays(read.breakUntil, -1));
  }
  dayChanged();
  if (typeof haptic === 'function') haptic('done');
  showToast({ title: 'จดแล้ว', body: 'แผนวันนี้คิดใหม่ให้แล้ว' });
}
```

- [ ] **Step 2: ตรวจชื่อที่อ้างถึงมีอยู่จริง**

Run: `grep -n "^function fmtClock\|^function fmtDue\|^function taskTitleText\|^function pendingTasks\|^let currentUser\|^let sb\b\|^var sb\b\|haptic('done')\|showToast({ title" alt/app.js | head`
ถ้า `haptic('done')` ไม่มีชนิดนี้ ให้ใช้ชนิดที่มีอยู่ (`'tap'`) · ถ้า showToast ไม่รับ `body` ให้ส่งแค่ `title`

Run: `node --check alt/app.js`

- [ ] **Step 3: Commit**

```bash
git add alt/app.js
git commit -m "Call read-day from the app and apply results only on confirm ..."
```

---

### Task 6: บล็อกหน้าแรก `dayCtx` + แผ่น "วันนี้ไปไหน"

**Files:**
- Modify: `alt/app.js` — `HOME_BLOCKS` · `HOME_ORDER` · ฟังก์ชันใหม่ (ต่อจากชุดของ Task 5)
- Modify: `alt/remote-config.js:35` — เพิ่ม `{ id: 'dayCtx', on: true },` ต่อจาก todayHead
- Modify: `alt/index.html` — ใส่ `<div class="add-sheet" id="daySheet" hidden></div>` ต่อจาก `#addSheet`
- Modify: `alt/alt.css` — คลาส `.dc-*` (ต่อท้ายไฟล์)

**Interfaces:**
- Consumes: Task 1 + Task 5
- Produces: `dayCtxBlock(now) → string` · `dayTap(school: boolean)` · `openDaySheet()` · `closeDaySheet()` · `daySheetRead()` · `daySheetAccept()` · `daySheetManual()` · `daySheetAddBlock()` · `daySheetSaveManual()` · `daySheetReset()` · `dayCtxLabel(day, brk) → string` · ตัวแปร `daySheet` (สถานะแผ่น)

- [ ] **Step 1: ลงทะเบียนบล็อก**

ใน `HOME_BLOCKS` เพิ่มหลัง `todayHead: ...`:

```js
  // 18 ต.ค. 69 · "วันนี้อยู่ไหน" — ปิดเทอม/อยู่บ้าน/ออกไปข้างนอก เปลี่ยนเวลาว่างของทั้งวัน
  // อยู่เหนือการ์ด "ตอนนี้" เพราะคำตอบของมันเปลี่ยนสิ่งที่การ์ดนั้นพูด
  dayCtx:     ctx => dayCtxBlock(ctx.now),
```

`HOME_ORDER` → `['todayHead', 'dayCtx', 'nowCard', 'dayRail', 'askBar', 'discover']`
`remote-config.js` → เพิ่ม `{ id: 'dayCtx',     on: true },   // 18 ต.ค. 69 · วันนี้อยู่ไหน` ต่อจาก todayHead

- [ ] **Step 2: บล็อกกับแผ่น**

```js
function dayCtxLabel(d, brk) {
  if (d && d.away) return 'วันนี้: ไม่อยู่ทั้งวัน';
  if (d && d.blocks && d.blocks.length) {
    const b = d.blocks[0];
    return 'วันนี้: ' + b.title + ' ' + b.start + '–' + b.end + (d.blocks.length > 1 ? ' +' + (d.blocks.length - 1) : '');
  }
  if (d && d.school === false) return brk ? 'ปิดเทอม · อยู่บ้าน' : 'วันนี้: อยู่บ้าน';
  if (d && d.school === true) return 'วันนี้: ไปโรงเรียน';
  if (brk) return 'ปิดเทอม · เปิด ' + ctxThaiDate(ctxAddDays(brk.to, 1));
  return '';
}

function dayCtxBlock(now) {
  if (typeof ctxDay !== 'function') return '';
  if (typeof breakAskDue === 'function' && breakAskDue(now)) return breakAskHtml();
  const d = ctxDay(now), brk = ctxBreakOn(now);
  const label = dayCtxLabel(d, brk);
  if (label) {
    return `<button type="button" class="dc-line" onclick="openDaySheet()">
      ${icon('pin')}<span>${esc(label)}</span><i>แก้</i></button>`;
  }
  return `<section class="dc-ask" aria-label="วันนี้อยู่ไหน">
    <b>${icon('pin')}วันนี้อยู่ไหน</b>
    <div class="dc-chips">
      <button type="button" onclick="dayTap(true)">ไปโรงเรียน</button>
      <button type="button" onclick="dayTap(false)">อยู่บ้าน</button>
      <button type="button" onclick="openDaySheet()">ออกไปข้างนอก…</button>
    </div></section>`;
}

function dayTap(school) {
  ctxSetDay(new Date(), { school, src: 'tap' });
  closeDaySheet();
  dayChanged();
  if (typeof haptic === 'function') haptic('tap');
}

// phase: 'edit' พิมพ์/เลือก · 'busy' รอ AI · 'confirm' การ์ดยืนยัน · 'manual' เลือกเวลาเอง
let daySheet = null;

function openDaySheet() {
  const d = ctxDay(new Date());
  daySheet = { phase: 'edit', text: (d && d.note) || '', read: null, err: '', trial: '', setBreak: true,
    manual: { school: d ? d.school : null, away: !!(d && d.away), blocks: d ? d.blocks.slice() : [] } };
  const el = document.getElementById('daySheet');
  if (!el) return;
  el.innerHTML = `<div class="as-scrim" onclick="closeDaySheet()"></div>
    <div class="as-card" role="dialog" aria-label="วันนี้ไปไหน"></div>`;
  el.hidden = false;
  renderDaySheet();
  setTimeout(() => el.classList.add('on'), 16);   // setTimeout ไม่ใช่ rAF — เหตุผลเดียวกับ openAddSheet
}

function closeDaySheet() {
  const el = document.getElementById('daySheet');
  daySheet = null;
  if (!el || el.hidden) return;
  el.classList.remove('on');
  setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, 260);
}

function renderDaySheet() {
  const card = document.querySelector('#daySheet .as-card');
  if (!card || !daySheet) return;
  const s = daySheet;
  const has = !!ctxDay(new Date());
  const head = `<div class="as-grip"></div><h3 class="dc-h">วันนี้ไปไหน</h3>`;
  const chips = `<div class="dc-chips">
      <button type="button" onclick="dayTap(true)">ไปโรงเรียน</button>
      <button type="button" onclick="dayTap(false)">อยู่บ้าน</button>
      <button type="button" onclick="daySheetAway()">ไม่อยู่ทั้งวัน</button></div>`;
  const reset = has ? `<button type="button" class="dc-link" onclick="daySheetReset()">กลับเป็นปกติ</button>` : '';

  if (s.phase === 'confirm' && s.read) {
    const r = s.read;
    const rows = [];
    if (r.away) rows.push('ไม่อยู่ทั้งวัน');
    for (const b of r.blocks) rows.push(b.start + '–' + b.end + ' ' + b.title);
    if (!r.away && r.school === false) rows.push('ไม่ไปโรงเรียน');
    if (!r.away && r.school === true) rows.push('ไปโรงเรียน');
    const forDay = r.date !== ymdLocal(new Date()) ? `<p class="dc-sub">จดไว้สำหรับ ${esc(ctxThaiDate(r.date))}</p>` : '';
    card.innerHTML = head + `<div class="dc-conf">
      <b>${esc(mName())}จดแบบนี้ ถูกไหม</b>${forDay}
      ${rows.length ? `<ul>${rows.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="dc-sub">${esc(r.note || 'ไม่เจอเวลาในข้อความ')}</p>`}
      ${r.advice ? `<p class="dc-adv">${icon('sparkles')}${esc(r.advice)}</p>` : ''}
      ${s.trial ? `<p class="dc-sub">งานแรกตอนนี้จะเป็น: <b>${esc(s.trial)}</b></p>` : ''}
      ${r.breakUntil ? `<label class="dc-chk"><input type="checkbox" ${s.setBreak ? 'checked' : ''}
          onchange="daySheet.setBreak=this.checked">ตั้งปิดเทอมถึงก่อน ${esc(ctxThaiDate(r.breakUntil))} ด้วย</label>` : ''}
      <div class="dc-row">
        <button type="button" class="dc-yes" onclick="daySheetAccept()">${icon('check')}ใช่ จดเลย</button>
        <button type="button" class="dc-no" onclick="daySheetManual()">แก้เอง</button>
      </div></div>`;
    return;
  }

  if (s.phase === 'manual') {
    const m = s.manual;
    card.innerHTML = head + `<div class="dc-man">
      <label class="dc-chk"><input type="checkbox" ${m.school === false ? 'checked' : ''}
        onchange="daySheet.manual.school=this.checked?false:null">วันนี้ไม่ไปโรงเรียน</label>
      <ul>${m.blocks.map((b, i) => `<li>${esc(b.start + '–' + b.end + ' ' + b.title)}
        <button type="button" aria-label="ลบช่วงนี้" onclick="daySheet.manual.blocks.splice(${i},1);renderDaySheet()">${icon('x')}</button></li>`).join('')}</ul>
      <div class="dc-add">
        <input type="time" id="dcFrom" aria-label="เริ่ม"><input type="time" id="dcTo" aria-label="จบ">
        <input type="text" id="dcTitle" maxlength="30" placeholder="ไปไหน" aria-label="ชื่อ">
        <button type="button" onclick="daySheetAddBlock()">${icon('plus')}เพิ่ม</button>
      </div>
      <p class="dc-err" id="dcErr" ${s.err ? '' : 'hidden'}>${esc(s.err)}</p>
      <div class="dc-row">
        <button type="button" class="dc-yes" onclick="daySheetSaveManual()">${icon('check')}บันทึก</button>
        ${reset}
      </div></div>`;
    return;
  }

  const busy = s.phase === 'busy';
  card.innerHTML = head + chips + `<div class="dc-ai">
      <textarea id="dcText" rows="2" maxlength="300" placeholder="เช่น ไปห้างกับเพื่อนบ่ายโมงถึงห้าโมง"
        oninput="daySheet.text=this.value">${esc(s.text)}</textarea>
      ${s.err ? `<p class="dc-err">${esc(s.err)}</p>` : ''}
      <div class="dc-row">
        <button type="button" class="dc-yes" onclick="daySheetRead()" ${busy ? 'disabled' : ''}>
          ${icon('sparkles')}${busy ? 'กำลังอ่าน…' : 'ให้' + esc(mName()) + 'อ่าน'}</button>
        <button type="button" class="dc-no" onclick="daySheetManual()">เลือกเวลาเอง</button>
      </div>${reset}</div>`;
}

async function daySheetRead() {
  if (!daySheet || daySheet.phase === 'busy') return;
  const text = (daySheet.text || '').trim();
  if (!text) { daySheet.err = 'พิมพ์ก่อนว่าวันนี้ไปไหน'; renderDaySheet(); return; }
  daySheet.phase = 'busy'; daySheet.err = ''; renderDaySheet();
  const r = await readDay(text);
  if (!daySheet) return;                       // ปิดแผ่นไประหว่างรอ
  if (!r.ok) { daySheet.phase = 'edit'; daySheet.err = r.message; renderDaySheet(); return; }
  daySheet.read = r.read;
  daySheet.trial = dayTrialFirst(r.read);
  daySheet.phase = 'confirm';
  renderDaySheet();
}

function daySheetAccept() {
  if (!daySheet || !daySheet.read) return;
  const { read, text, setBreak } = daySheet;
  closeDaySheet();
  dayApply(read, text, { setBreak });
}

function daySheetManual() {
  if (!daySheet) return;
  if (daySheet.read) {
    daySheet.manual = { school: daySheet.read.school, away: false, blocks: daySheet.read.blocks.slice() };
  }
  daySheet.phase = 'manual'; daySheet.err = '';
  renderDaySheet();
}

function daySheetAddBlock() {
  const a = document.getElementById('dcFrom'), b = document.getElementById('dcTo'), t = document.getElementById('dcTitle');
  const from = a && a.value, to = b && b.value;
  if (hm2min(from) == null || hm2min(to) == null || hm2min(to) <= hm2min(from)) {
    daySheet.err = 'เวลาจบต้องหลังเวลาเริ่ม'; renderDaySheet(); return;
  }
  daySheet.err = '';
  daySheet.manual.blocks.push({ start: from, end: to, title: (t && t.value.trim()) || 'ไม่อยู่' });
  renderDaySheet();
}

function daySheetSaveManual() {
  if (!daySheet) return;
  const m = daySheet.manual;
  ctxSetDay(new Date(), { school: m.school, away: false, blocks: m.blocks, src: 'manual' });
  closeDaySheet();
  dayChanged();
}

function daySheetAway() {
  ctxSetDay(new Date(), { away: true, school: false, src: 'tap' });
  closeDaySheet();
  dayChanged();
}

function daySheetReset() {
  ctxClearDay(new Date());
  closeDaySheet();
  dayChanged();
}
```

- [ ] **Step 3: index.html**

ต่อจาก `<div class="add-sheet" id="addSheet" hidden></div>`:

```html
    <!-- 18 ต.ค. 69 · แผ่น "วันนี้ไปไหน" — ใช้โครงเดียวกับแผ่นเพิ่มงาน (.as-scrim/.as-card) · วาดจาก renderDaySheet() -->
    <div class="add-sheet" id="daySheet" hidden></div>
```

- [ ] **Step 4: CSS (ต่อท้าย alt.css)**

ก่อนเขียน อ่านกฎ `.add-sheet` / `.as-card` / `.as-scrim` ใน alt.css (`grep -n "\.add-sheet\|\.as-card\|\.as-scrim" alt/alt.css`) ว่าแผ่นที่ใช้ id อื่นจะได้กฎเดียวกันไหม · ถ้ากฎผูกกับ `#addSheet` ให้เพิ่ม `#daySheet` เข้าไปในตัวเลือกเดียวกันแทนการก๊อปกฎ แล้วต่อท้ายด้วย:

```css
/* ---------- 18 ต.ค. 69 · วันนี้อยู่ไหน (บล็อกหน้าแรก + แผ่น) ---------- */
.dc-ask {
  display: grid; gap: 8px; margin: 0 0 10px; padding: 10px 12px;
  border: 1px solid var(--line); border-radius: 18px; background: var(--card);
}
.dc-ask b { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px;
  font-size: 13.5px; font-weight: 700; color: var(--ink); }
.dc-ask b svg, .dc-line svg { width: 16px; height: 16px; color: var(--fill); }
.dc-chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.dc-chips button {
  min-height: 36px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--card2); color: var(--ink); font-family: inherit; font-size: 12.5px; font-weight: 600;
  cursor: pointer;
}
.dc-chips button:active { transform: scale(.97); }
.dc-line {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; width: 100%;
  margin: 0 0 10px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 14px;
  background: var(--card); color: var(--ink); font-family: inherit; font-size: 13px; text-align: left; cursor: pointer;
}
.dc-line span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dc-line i { font-style: normal; font-weight: 700; color: var(--fill); }
.dc-h { margin: 4px 0 10px; font-size: 17px; font-weight: 800; color: var(--ink); }
.dc-ai, .dc-conf, .dc-man { display: grid; gap: 10px; margin-top: 10px; }
.dc-ai textarea {
  width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--line); border-radius: 14px;
  background: var(--card2); color: var(--ink); font-family: inherit; font-size: 15px; line-height: 1.5; resize: none;
}
.dc-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.dc-yes, .dc-no, .dc-link, .dc-add button {
  min-height: 42px; padding: 8px 14px; border-radius: 14px; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
}
.dc-yes { display: grid; grid-template-columns: auto auto; justify-content: center; align-items: center; gap: 6px;
  border: 0; background: var(--fill); color: var(--card); }
.dc-yes svg { width: 16px; height: 16px; }
.dc-yes:disabled { opacity: .6; }
.dc-no, .dc-link, .dc-add button { border: 1px solid var(--line); background: var(--card); color: var(--ink); }
.dc-link { justify-self: start; min-height: 36px; border: 0; padding-left: 0; color: var(--muted); }
.dc-conf b { font-size: 14.5px; color: var(--ink); }
.dc-conf ul, .dc-man ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.dc-conf li, .dc-man li { font-size: 14px; color: var(--ink); }
.dc-man li { display: grid; grid-template-columns: 1fr auto; align-items: center; }
.dc-man li button { border: 0; background: none; color: var(--muted); padding: 6px; }
.dc-man li svg { width: 16px; height: 16px; }
.dc-adv { display: grid; grid-template-columns: auto 1fr; gap: 6px; margin: 0; padding: 8px 10px;
  border-radius: 12px; background: var(--card2); font-size: 13px; line-height: 1.55; color: var(--ink); }
.dc-adv svg { width: 15px; height: 15px; color: var(--fill); margin-top: 2px; }
.dc-sub { margin: 0; font-size: 12.5px; color: var(--muted); }
.dc-err { margin: 0; font-size: 12.5px; color: #C2410C; }
.dc-chk { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; font-size: 13.5px; color: var(--ink); }
.dc-add { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.dc-add input { min-height: 40px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 12px;
  background: var(--card2); color: var(--ink); font-family: inherit; font-size: 14px; }
.dc-add input[type="text"] { grid-column: 1 / -1; }
.dc-add button { grid-column: 1 / -1; }
```

(`.dc-err` ใช้สีส้มเข้มตายตัวเพราะไม่มีโทเคนสีเตือนที่ครบทุกธีม — เช็คในธีมมืดว่ายังอ่านออก ถ้าไม่ออกให้หาโทเคนสีเตือนที่ alt.css ใช้กับข้อความ error อยู่แล้ว `grep -n "err" alt/alt.css | head`)

- [ ] **Step 5: ตรวจในพรีวิว**

ใช้คอนฟิกพรีวิว `ctx-day` (พอร์ต 5631 · `--directory alt`) ใน `.claude/launch.json`
1. ก่อนแตะอะไร: `javascript_tool` → `localStorage.getItem('studentos.alt.ctx')` เก็บค่านี้ไว้ในผลลัพธ์ (ไม่ใช่ใน window)
2. `resize_window` 375×812 · ไปหน้าแรก · วัดสามสถานะ (ยังไม่ตอบ · ตอบแล้วยุบ · การ์ดถามปิดเทอมจาก Task 8) ด้วย
   `(() => { const s = document.querySelector('#scr-menu .scr-body'); return [s.scrollHeight, s.clientHeight]; })()`
   ต้องได้ `scrollHeight <= clientHeight` ทุกสถานะ · ถ้าล้น: เปลี่ยน `dayCtxBlock` ให้คืน `.dc-line` "วันนี้อยู่ไหน · บอกแอป" บรรทัดเดียวเสมอ (ชิปอยู่ในแผ่นอยู่แล้ว) แล้ววัดใหม่
3. กด "อยู่บ้าน" → แถบยุบ · เปิดไทม์ไลน์วันนี้ ต้องไม่มีคาบเรียน
4. เปิดแผ่น → "เลือกเวลาเอง" → เพิ่ม 13:00–17:00 → บันทึก → ไทม์ไลน์มีช่วงนั้น
5. ธีมมืดด้วย `resize_window colorScheme: 'dark'` แล้วรอ 2 วินาทีก่อนถ่ายภาพ
6. คืนค่า `studentos.alt.ctx` เดิมจากข้อ 1 · เช็คว่าไม่มีบันทึกทดสอบค้าง

- [ ] **Step 6: Commit**

```bash
git add alt/app.js alt/index.html alt/alt.css alt/remote-config.js
git commit -m "Ask where the student is today from the home screen ..."
```

---

### Task 7: การ์ด `dayoffer` ในแชทน้องไซ

**Files:**
- Modify: `alt/app.js` — ต่อจาก `aiOfferAsk` · ใน `aiAsk` · ในตัววาดฟองแชท (ต่อจากบล็อก `if (m.role === 'offer') {...}`) · บรรทัดที่เช็ค `m.role === 'user' || m.role === 'offer'` (สามจุดราวบรรทัด 5082/5095/5104)

**Interfaces:**
- Consumes: `readDay`, `dayTrialFirst`, `dayApply` (Task 5)
- Produces: `aiDayOffer(text) → boolean` · `aiDayAccept(i)` · `aiDayAsk(i)` · role ใหม่ `'dayoffer'` ใน aiLog `{ role, text, busy, read, trial, err, done }`

- [ ] **Step 1: ตัวคัดกรอง + ปุ่ม**

ต่อจาก `function aiOfferAsk(i) {...}`:

```js
// ---------- 18 ต.ค. 69 · ข้อความที่เล่าเรื่องวันนี้ → การ์ดจดบริบทรายวัน ----------
// ด่านในเครื่องก่อน ไม่ยิง AI ทุกข้อความ: ต้องมีคำบอกวัน และคำบอกการไป/เวลา และไม่ใช่คำถาม
// เดาผิดว่าเป็นการเล่า → เสียหนึ่งแตะ ("ไม่ใช่ ถามต่อ") · เดาผิดว่าเป็นคำถาม → เหมือนเดิมทุกอย่าง
const DAY_WHEN = /วันนี้|พรุ่งนี้|มะรืน|เสาร์นี้|อาทิตย์นี้|ปิดเทอม|เปิดเทอม|ไม่ไปโรงเรียน|ไม่ไปเรียน/;
const DAY_WHAT = /ไป|ออก|อยู่บ้าน|ไม่อยู่|ธุระ|เที่ยว|ซ่อม|เรียนพิเศษ|ค่าย|ปิดเทอม|เปิดเทอม|\d{1,2}[:.]\d{2}|\d{1,2}\s*โมง|บ่าย|เที่ยง|ทุ่ม|ตี\s*\d/;
function aiDayOffer(text) {
  const t = String(text || '').trim();
  if (t.length < 6) return false;
  if (/[?？]\s*$|ยังไง|อย่างไร|ทำไม|เพราะอะไร|ช่วย|แนะนำ|ควร(?:จะ)?|ดีไหม|ไหมครับ|ไหมคะ/.test(t)) return false;
  return DAY_WHEN.test(t) && DAY_WHAT.test(t);
}

function aiDayAccept(i) {
  const log = aiLog();
  const m = log[i];
  if (!m || m.role !== 'dayoffer' || !m.read || m.done) return;
  m.done = true; aiLogSave(log);
  dayApply(m.read, m.text);
  renderAi();
}

function aiDayAsk(i) {
  const log = aiLog();
  const m = log[i];
  if (!m || m.role !== 'dayoffer') return;
  m.done = 'asked'; aiLogSave(log); renderAi();
  aiAsk(m.text, { force: true });
}
```

- [ ] **Step 2: เสียบใน `aiAsk`**

ต่อจากบล็อก `if (offer) { ... return; }` (ยังอยู่ใน `if (!(opts && opts.force) && !preset) {`):

```js
    if (currentUser && aiDayOffer(q)) {
      if (box) box.value = '';
      const entry = { role: 'dayoffer', text: q, busy: true };
      log.push(entry);
      aiLogSave(log);
      renderAi(); aiScrollDown();
      const idx = log.length - 1;
      readDay(q).then(r => {
        const l2 = aiLog();
        const m = l2[idx];
        if (!m || m.role !== 'dayoffer') return;
        m.busy = false;
        if (r.ok) { m.read = r.read; m.trial = dayTrialFirst(r.read); }
        else m.err = r.message;
        aiLogSave(l2); renderAi(); aiScrollDown();
      });
      return;
    }
```

ก่อนเขียน อ่าน `aiLog()`/`aiLogSave()` ว่าคืนอาร์เรย์ตัวเดิมหรือสำเนา (`grep -n "^function aiLog\|^function aiLogSave" alt/app.js`) · ถ้า `aiLog()` อ่านจาก localStorage ใหม่ทุกครั้ง โค้ดข้างบนถูกแล้ว (อ่านใหม่ใน then) · ถ้าผู้ใช้ล้างแชทระหว่างรอ `m` จะไม่ใช่ dayoffer แล้ว return เงียบ

- [ ] **Step 3: วาดการ์ด**

ในตัววาดฟอง ต่อจากบล็อก `if (m.role === 'offer') { ... }`:

```js
    // 18 ต.ค. 69 · การ์ดจดบริบทรายวัน — โครงเดียวกับการ์ดเสนองาน
    if (m.role === 'dayoffer') {
      const r = m.read;
      const rows = r ? [
        ...(r.away ? ['ไม่อยู่ทั้งวัน'] : []),
        ...r.blocks.map(b => b.start + '–' + b.end + ' ' + b.title),
        ...(!r.away && r.school === false ? ['ไม่ไปโรงเรียน'] : []),
        ...(r.breakUntil ? ['ปิดเทอมถึงก่อน ' + ctxThaiDate(r.breakUntil)] : []),
      ] : [];
      const head = m.busy ? 'กำลังอ่านว่าวันนี้ไปไหน…'
        : m.err ? 'อ่านไม่สำเร็จ'
        : m.done === 'asked' ? 'ได้ครับ ถามต่อเลย'
        : m.done ? 'จดแล้ว แผนคิดใหม่ให้แล้ว' : 'จดแบบนี้ ถูกไหม';
      return `<div class="ai-msg me"><div class="ai-bub">${esc(m.text)}</div></div>
        <div class="ai-msg sai">
          ${saiHead}
          <div class="ai-offer${m.done ? ' spent' : ''}">
            <b class="ao-h">${head}</b>
            ${m.err ? `<div class="ao-t">${esc(m.err)}</div>` : ''}
            ${rows.length ? `<div class="ao-chips">${rows.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
            ${r && r.advice ? `<div class="ao-t">${esc(r.advice)}</div>` : ''}
            ${m.trial ? `<div class="ao-t">งานแรกตอนนี้จะเป็น: ${esc(m.trial)}</div>` : ''}
            ${m.done || m.busy ? '' : `<div class="ao-row">
              ${r ? `<button class="ao-yes" onclick="aiDayAccept(${i})">${icon('check')}จดเลย</button>` : ''}
              <button class="ao-no" onclick="aiDayAsk(${i})">ไม่ใช่ ถามต่อ</button>
            </div>`}
          </div>
        </div>`;
    }
```

- [ ] **Step 4: ที่อื่นที่เช็ค role `'offer'`**

Run: `grep -n "m.role === 'user' || m.role === 'offer'" alt/app.js`
ทุกจุดเปลี่ยนเป็น `(m.role === 'user' || m.role === 'offer' || m.role === 'dayoffer')` (ชื่อบทสนทนา/การนับว่ามีข้อความ) · ตัวกรอง `hist` ที่เลือกแค่ `user`/`model` ไม่ต้องแก้ — การ์ดของแอปต้องไม่ไปถึงโมเดล

- [ ] **Step 5: ตรวจ**

Run: `node --check alt/app.js`
ตรวจตัวคัดกรองด้วย node สั้น ๆ (ตัดฟังก์ชันจริงจากไฟล์):

```bash
node -e "const s=require('fs').readFileSync('alt/app.js','utf8');const a=s.indexOf('const DAY_WHEN');const b=s.indexOf('function aiDayAccept');eval(s.slice(a,b));for(const [t,want] of [['วันนี้ไปห้างบ่ายโมงถึงห้าโมง',true],['พรุ่งนี้ไม่ไปโรงเรียน',true],['ปิดเทอมถึง 2 พ.ย.',true],['วันนี้ควรทำอะไรก่อน',false],['การบ้านคณิตส่งพรุ่งนี้',false],['สวัสดี',false]]){const got=aiDayOffer(t);console.log(got===want?'PASS':'FAIL',t,got)}"
```

Expected: PASS ทั้งหกบรรทัด · ถ้า "การบ้านคณิตส่งพรุ่งนี้" ได้ true ไม่เป็นไรในทางปฏิบัติเพราะ `aiTaskOffer` จับก่อน แต่ให้จดผลจริงไว้ในรายงาน ไม่ต้องดัดเทสต์ให้ผ่าน
(`eval` ตรงนี้รันใน node บนเครื่องเรา ไม่ใช่ในแอป — กฎ "ห้าม eval" ใน AGENTS.md หมายถึงการฉีดเข้าพรีวิว)

- [ ] **Step 6: Commit**

```bash
git add alt/app.js
git commit -m "Offer to record today from the assistant chat ..."
```

---

### Task 8: ปิดเทอม — แถวในจอบริบท + แอปถามเอง

**Files:**
- Modify: `alt/app.js` — `renderContext()` (เพิ่ม `<details>` ใน `.cx2-list`) · ฟังก์ชันใหม่ต่อจากชุด Task 6
- Modify: `alt/alt.css` — `.dc-brk` ต่อท้าย

**Interfaces:**
- Consumes: Task 1 · `dayChanged` (Task 5)
- Produces: `breakAskDue(now) → boolean` · `breakAskHtml() → string` · `breakAskYes()` · `breakAskNo()` · `ctxBreakStart()` · `ctxBreakStop()` · ค่าคงที่ `BREAK_ASK_OFF = 'studentos.alt.breakAskOff'`

- [ ] **Step 1: โค้ด**

```js
// ---------- 18 ต.ค. 69 · ปิดเทอม ----------
// ตั้งเองได้ในจอบริบท และแอปถามเองเมื่อเห็นสัญญาณ: ตอบ "อยู่บ้าน" ในวันที่มีเรียนสองวันติดกัน
// ไม่เดาเงียบ ๆ — เดาผิดแปลว่าคาบเรียนหายจากแผนทั้งสัปดาห์โดยที่เขาไม่รู้ตัว
const BREAK_ASK_OFF = 'studentos.alt.breakAskOff';

function hasClassTypical(d) {
  return busyBlocks(d, { typical: true }).some(b => b.kind === 'class');
}

function breakAskDue(now = new Date()) {
  if (typeof ctxBreakOn !== 'function' || ctxBreakOn(now)) return false;
  const today = ctxDay(now);
  if (!today || today.school !== false || !hasClassTypical(now)) return false;
  try {
    const off = +localStorage.getItem(BREAK_ASK_OFF) || 0;
    if (Date.now() - off < 7 * 864e5) return false;
  } catch (_) {}
  // วันเรียนก่อนหน้า (ย้อนได้ไม่เกิน 7 วัน) ต้องตอบ "อยู่บ้าน" ด้วย
  const d = new Date(now);
  for (let i = 0; i < 7; i++) {
    d.setDate(d.getDate() - 1);
    if (!hasClassTypical(d)) continue;
    const rec = ctxDay(d);
    return !!rec && rec.school === false;
  }
  return false;
}

function breakAskHtml() {
  const min = ctxAddDays(ctxDayKey(new Date()), 1);
  return `<section class="dc-ask dc-brk" aria-label="ปิดเทอมแล้วใช่ไหม">
    <b>${icon('calendar')}ปิดเทอมแล้วใช่ไหม</b>
    <p class="dc-sub">ตั้งวันเปิดเทอม แล้วช่วงนี้แอปจะไม่วางคาบเรียนกับเวลาเดินทางให้</p>
    <label class="dc-brk-d">เปิดเทอม<input type="date" id="brkAskDate" min="${min}"></label>
    <p class="dc-err" id="brkAskErr" hidden>ใส่วันเปิดเทอมก่อน</p>
    <div class="dc-row">
      <button type="button" class="dc-yes" onclick="breakAskYes()">${icon('check')}ใช่ ปิดเทอม</button>
      <button type="button" class="dc-no" onclick="breakAskNo()">ไม่ใช่</button>
    </div></section>`;
}

function breakSetFromOpenDate(openKey) {
  const today = ctxDayKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(openKey || '') || openKey <= today) return false;
  ctxSetBreak(today, ctxAddDays(openKey, -1));
  dayChanged();
  showToast({ title: 'ตั้งปิดเทอมแล้ว', body: 'เปิดเทอม ' + ctxThaiDate(openKey) + ' ตารางเรียนจะกลับมาเอง' });
  return true;
}

function breakAskYes() {
  const el = document.getElementById('brkAskDate');
  if (!breakSetFromOpenDate(el && el.value)) {
    const e = document.getElementById('brkAskErr');
    if (e) e.hidden = false;
  }
}

function breakAskNo() {
  try { localStorage.setItem(BREAK_ASK_OFF, String(Date.now())); } catch (_) {}
  dayChanged();
}

function ctxBreakStart() {
  const el = document.getElementById('brkOpen');
  if (!breakSetFromOpenDate(el && el.value)) showToast({ title: 'ใส่วันเปิดเทอมที่ยังไม่ถึงก่อน' });
}

function ctxBreakStop() {
  ctxEndBreak(new Date());
  dayChanged();
  showToast({ title: 'ยกเลิกปิดเทอมแล้ว', body: 'ตารางเรียนกลับมาตั้งแต่วันนี้' });
}
```

- [ ] **Step 2: แถวในจอบริบท**

ใน `renderContext()` ก่อน `body.innerHTML = \``` เพิ่ม:

```js
  const brk = ctxBreakOn(now);
  const brkMin = ctxAddDays(ctxDayKey(now), 1);
```

แล้วใน `.cx2-list` ต่อจาก `<details ... data-k="rt">...</details>`:

```html
      <details class="cx2-sec" data-k="brk"${openSec.has('brk') ? ' open' : ''}>
        <summary><span>ปิดเทอม</span><i>${brk ? 'เปิด ' + esc(ctxThaiDate(ctxAddDays(brk.to, 1))) : 'ไม่ได้ตั้ง'}</i>${icon('chevron')}</summary>
        <div class="cx2-sec-body dc-brk-body">${brk
          ? `<p class="dc-sub">ช่วงนี้แอปไม่วางคาบเรียนกับเวลาเดินทางไปโรงเรียน</p>
             <button type="button" class="dc-no" onclick="ctxBreakStop()">เปิดเทอมแล้ว · ยกเลิก</button>`
          : `<label class="dc-brk-d">วันเปิดเทอม<input type="date" id="brkOpen" min="${brkMin}"></label>
             <button type="button" class="dc-yes" onclick="ctxBreakStart()">${icon('check')}ตั้งปิดเทอม</button>`}
        </div>
      </details>
```

(ตัวแปร `brk` ชื่อนี้ต้องไม่ชนกับตัวแปรอื่นใน `renderContext` — `grep -n "const brk\|let brk" alt/app.js` ก่อน)

- [ ] **Step 3: CSS ต่อท้าย alt.css**

```css
.dc-brk { gap: 8px; }
.dc-brk-d { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px; font-size: 13.5px; color: var(--ink); }
.dc-brk-d input { min-height: 40px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 12px;
  background: var(--card2); color: var(--ink); font-family: inherit; font-size: 14px; }
.dc-brk-body { display: grid; gap: 10px; }
```

- [ ] **Step 4: เทสต์ `breakAskDue` ด้วย node**

เพิ่มท้าย `alt/devtools/ctx-day-check.cjs` (ก่อนบรรทัด `console.log(\`ctx-day: ...`) — โหลดฟังก์ชันจริงจาก app.js เข้า vm เดิม:

```js
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const a = app.indexOf('const BREAK_ASK_OFF'), b = app.indexOf('function breakAskHtml');
  assert.ok(a > 0 && b > a, 'ไม่พบ breakAskDue ใน app.js');
  vm.runInContext(app.slice(a, b).replace('const BREAK_ASK_OFF', 'var BREAK_ASK_OFF'), ctx);
}
check('ถามปิดเทอมเมื่ออยู่บ้านสองวันเรียนติด · ไม่ถามถ้าวันก่อนไปเรียน', () => {
  run(`var D0 = new Date(); D0.setHours(0,0,0,0);
       ctxUpsert('class', { subject: 'ทุกวัน', start: '08:00', end: '15:00' });
       var D1 = new Date(D0); D1.setDate(D1.getDate() - 1);
       ctxSetDay(D0, { school: false }); ctxSetDay(D1, { school: false })`);
  assert.equal(run('breakAskDue(D0)'), true);
  run('ctxSetDay(D1, { school: true })');
  assert.equal(run('breakAskDue(D0)'), false);
  run(`ctxSetDay(D1, { school: false }); localStorage.setItem(BREAK_ASK_OFF, String(Date.now()))`);
  assert.equal(run('breakAskDue(D0)'), false);
  data.delete('studentos.alt.breakAskOff');
});
```

Run: `node alt/devtools/ctx-day-check.cjs` → Expected: `ctx-day: 15/15`
ถอด `return !!rec && rec.school === false;` เป็น `return true;` ชั่วคราว → ต้องตกที่ข้อ "ไม่ถามถ้าวันก่อนไปเรียน" · คืนโค้ด

- [ ] **Step 5: พรีวิว**

จอบริบท → แถว "ปิดเทอม" → ตั้งวันเปิดเทอมเป็นสองสัปดาห์ข้างหน้า → หน้าแรกเห็น "ปิดเทอม · เปิด …" · ไทม์ไลน์ไม่มีคาบ · ยกเลิก → คาบกลับมา · วัดหน้าแรก 375×812 ตอนการ์ดถามปิดเทอมขึ้น (ฉีดสถานะด้วย `ctxSetDay` สองวันในพรีวิว แล้วคืนค่าตามขั้นตอนใน Task 6 Step 5)

- [ ] **Step 6: Commit**

```bash
git add alt/app.js alt/alt.css alt/devtools/ctx-day-check.cjs
git commit -m "Let students set a term break, and ask when it looks like one ..."
```

---

### Task 9: ตรวจรวม + เอกสาร

**Files:**
- Modify: `AGENTS.md` — ตาราง "เทสต์ที่รันได้ด้วย node ตรง ๆ" เพิ่มสองแถว
- Modify: `alt/PATCHNOTES.md` — ร่างหัวข้อ "ยังไม่ตั้งชื่อรุ่น (18 ต.ค. 69)" บนสุด

- [ ] **Step 1: รันทุกชุดที่เกี่ยว**

```bash
node alt/devtools/ctx-day-check.cjs
node --test supabase/functions/read-day/__tests__/clean.test.mjs
node alt/devtools/review-check.cjs
node alt/devtools/syncbench.cjs
node alt/devtools/account-switch-check.cjs
node --check alt/app.js
node --check alt/context.js
```

Expected: ผ่านทุกตัว · จดตัวเลขจริงลงรายงาน (syncbench 36/36 · account-switch 33/33 ตามค่าเดิม)

- [ ] **Step 2: เอนจินในพรีวิว**

ฉีด `<script src="devtools/decidebench.js">` แล้วเรียก `benchDecide()` · อ่านตัวเลข ไม่ใช่แค่ผ่าน/ไม่ผ่าน · เทียบกับรันบน main (`git stash` ห้ามใช้ — เปิดพรีวิวจากราก repo หลักแทน หรือจดตัวเลขก่อนเริ่ม Task 1)

- [ ] **Step 3: AGENTS.md**

เพิ่มแถวในตาราง node:

```
| บริบทรายวัน / ปิดเทอม (context.js) | `node alt/devtools/ctx-day-check.cjs` | 15/15 |
| ตัวกรองผล read-day | `node --test supabase/functions/read-day/__tests__/clean.test.mjs` | 6/6 |
```

(ใส่ตัวเลขจริงจาก Step 1 ไม่ใช่ตัวเลขในแผน)

- [ ] **Step 4: PATCHNOTES ร่าง**

บนสุดของ `alt/PATCHNOTES.md` หัวข้อ `## (รอเจ้าของตั้งชื่อรุ่น) · 18 ต.ค. 69` สามข้อสั้น ๆ: ปิดเทอม · วันนี้อยู่ไหน · น้องไซอ่านวันนี้ (บอกตรง ๆ ว่าส่วน AI ใช้ได้หลัง deploy `read-day`)

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md alt/PATCHNOTES.md
git commit -m "Document the daily context tests and draft patch notes ..."
```

- [ ] **Step 6: หยุดถามเจ้าของ** — deploy `read-day` · ชื่อรุ่น · push/PR · ซิงก์ขึ้นราก ทั้งหมดต้องให้เจ้าของสั่งทีละเรื่อง
