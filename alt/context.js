// ============================================================
// context — "ผู้ใช้คนนี้มีเวลาว่างจริง ๆ ตอนไหน"  ·  *** ALT ***
// ------------------------------------------------------------
// ก่อนหน้านี้แอปรู้เรื่องเวลาของผู้ใช้อยู่ค่าเดียว: settings.freeHours = 2
// ซึ่งเป็นตัวเลขลอย ๆ ที่ไม่ได้บอกว่า "ว่างตอนไหน" ตัวจัดตารางเดิมจึงต้องเดา
// ว่าทุกคนเริ่มทำการบ้าน 19:00 เหมือนกันหมด — คนที่ซ้อมบอลถึงสองทุ่มได้แผนที่ผิดทุกวัน
//
// ไฟล์นี้เก็บสามอย่างเท่านั้น แล้วคำนวณที่เหลือเอาเอง:
//   prefs     — ตื่น/นอน/ห้ามวางงานหลังกี่โมง/ความยาวคาบที่รับได้
//   classes   — ตารางเรียนรายสัปดาห์
//   routines  — กิจวัตรกับกิจกรรม (กินข้าว เดินทาง ซ้อมบอล เรียนพิเศษ)
//
// สิ่งที่ **ไม่เก็บ** คือ availability — มันคือผลลบของวันด้วยสามอย่างข้างบน
// ถ้าเก็บไว้ด้วยจะมีความจริงสองชุดที่ขัดกันได้ทันทีที่แก้ตารางเรียนแล้วลืมอัปเดตอีกที่
// จึงคำนวณสดทุกครั้งด้วย freeSlots() — ช้ากว่าไม่ถึงมิลลิวินาที แต่ผิดไม่ได้เลย
//
// ความเป็นส่วนตัว: ข้อมูลชุดนี้อยู่คนละคีย์กับงาน (`studentos.alt.ctx`)
// ลบทิ้งได้ทั้งชุดโดยไม่แตะงานสักใบ และการคำนวณทั้งไฟล์นี้ทำในเครื่องล้วน
// ไม่มีการเรียกเน็ตแม้แต่ครั้งเดียว
// ============================================================

const CTX_KEY = 'studentos.alt.ctx';

// ค่าเริ่มต้นของเด็กมัธยมไทยทั่วไป — ตั้งไว้ให้ใช้ได้ทันทีโดยไม่ต้องกรอกอะไรเลย
// ผู้ใช้ที่ไม่เคยเปิดจอตั้งค่าก็ยังได้ตารางที่สมเหตุสมผล ไม่ใช่จอว่าง
const CTX_DEFAULT = {
  prefs: {
    wake: '06:00',
    sleep: '22:30',
    // เส้นที่งานห้ามข้าม — คนละเรื่องกับเวลานอน เพราะช่วงก่อนนอนคือเวลาของเขา
    // ไม่ใช่เวลาที่เหลือให้แอปเอาไปใช้ ถ้าไม่กันไว้ ตัวจัดตารางจะยัดงานจนถึงหัวนอนทุกคืน
    noWorkAfter: '21:30',
    breakMin: 10,      // พักคั่นระหว่างงาน
    maxRunMin: 50,     // ทำติดกันได้นานสุดก่อนต้องพัก
    minBlockMin: 20,   // ช่องว่างสั้นกว่านี้ไม่นับเป็นที่ทำงาน — นั่งลงยังไม่ทันเข้าที่ก็หมดเวลาแล้ว
  },
  classes: [],
  routines: [],
};

// ---------- เวลาในหนึ่งวันเก็บเป็น "นาทีจากเที่ยงคืน" ----------
// เก็บเป็นสตริง 'HH:MM' ตอนบันทึก (อ่านง่ายเวลาเปิดดูข้อมูลดิบ)
// แต่คำนวณเป็นตัวเลขเสมอ — เทียบสตริงเวลาแล้วพลาดเรื่อง '9:00' กับ '09:00' มาแล้วนับไม่ถ้วน
function hm2min(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}
function min2hm(v) {
  const x = Math.max(0, Math.min(24 * 60, Math.round(v)));
  return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
}

// ---------- อ่าน/เขียน ----------
let ctxCache = null;

function ctxLoad() {
  if (ctxCache) return ctxCache;
  let raw = null;
  try { raw = localStorage.getItem(CTX_KEY); } catch (_) {}
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = null; }
  ctxCache = {
    prefs: Object.assign({}, CTX_DEFAULT.prefs, (data && data.prefs) || {}),
    classes: Array.isArray(data && data.classes) ? data.classes : [],
    routines: Array.isArray(data && data.routines) ? data.routines : [],
  };
  return ctxCache;
}

function ctxSave() {
  if (!ctxCache) return;
  try { localStorage.setItem(CTX_KEY, JSON.stringify(ctxCache)); } catch (_) {}
  // ซิงก์ขึ้นคลาวด์ใช้ทางเดียวกับงาน — ฟังก์ชันนี้กันตัวเองอยู่แล้วเมื่อยังไม่ได้ล็อกอิน
  if (typeof pushToCloud === 'function') pushToCloud();
}

function ctxPrefs() { return ctxLoad().prefs; }
function ctxClasses() { return ctxLoad().classes; }
function ctxRoutines() { return ctxLoad().routines; }

function ctxSetPrefs(patch) {
  const c = ctxLoad();
  c.prefs = Object.assign({}, c.prefs, patch || {});
  ctxSave();
}

function ctxUid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// เพิ่ม/แก้/ลบ — คืนตัวที่เพิ่งเขียนกลับไป เผื่อฝั่ง UI อยากใช้ id ต่อทันที
function ctxUpsert(kind, item) {
  const c = ctxLoad();
  const list = kind === 'class' ? c.classes : c.routines;
  const rec = Object.assign({}, item);
  if (!rec.id) rec.id = ctxUid();
  const i = list.findIndex(x => x.id === rec.id);
  if (i >= 0) list[i] = Object.assign({}, list[i], rec); else list.push(rec);
  ctxSave();
  return rec;
}
function ctxRemove(kind, id) {
  const c = ctxLoad();
  const key = kind === 'class' ? 'classes' : 'routines';
  c[key] = c[key].filter(x => x.id !== id);
  ctxSave();
}
// ลบบริบททั้งชุดโดยไม่แตะงานสักใบ — ปุ่มนี้ต้องมีอยู่จริงในจอตั้งค่า
function ctxClear() {
  ctxCache = { prefs: Object.assign({}, CTX_DEFAULT.prefs), classes: [], routines: [] };
  try { localStorage.removeItem(CTX_KEY); } catch (_) {}
  if (typeof pushToCloud === 'function') pushToCloud();
}

// ---------- ช่วงเวลาที่ถูกจองไว้ในวันหนึ่ง ----------
// weekday ใช้เลขเดียวกับ Date.getDay() : 0 = อาทิตย์ … 6 = เสาร์
// รายการที่ไม่มี weekday (หรือ weekday = null) ถือว่าเกิดทุกวัน — กินข้าวกับนอนเป็นแบบนั้น
function onDay(item, weekday) {
  if (item.weekday == null) return true;
  if (Array.isArray(item.weekday)) return item.weekday.includes(weekday);
  return +item.weekday === weekday;
}

// คืนช่วงที่ทำงานไม่ได้ เรียงตามเวลา และ **รวมช่วงที่ซ้อนกันแล้ว**
// การรวมสำคัญมาก: เรียน 08:00–16:00 กับ เดินทาง 15:30–16:30 ซ้อนกันอยู่ 30 นาที
// ถ้าไม่รวมก่อน ตัวลบจะเจอช่องว่างปลอมยาว −30 นาที แล้วคำนวณเวลาว่างเกินจริง
function busyBlocks(date) {
  const c = ctxLoad();
  const wd = date.getDay();
  const out = [];

  for (const k of c.classes) {
    const a = hm2min(k.start), b = hm2min(k.end);
    if (a == null || b == null || b <= a || !onDay(k, wd)) continue;
    out.push({ from: a, to: b, kind: 'class', title: k.subject || 'เรียน', id: k.id });
  }
  for (const r of c.routines) {
    const a = hm2min(r.start), b = hm2min(r.end);
    if (a == null || b == null || b <= a || !onDay(r, wd)) continue;
    out.push({ from: a, to: b, kind: r.kind || 'routine', title: r.title || 'กิจวัตร', id: r.id });
  }
  return out.sort((x, y) => x.from - y.from || x.to - y.to);
}

function mergeRanges(list) {
  const sorted = [...list].sort((a, b) => a.from - b.from);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to) last.to = Math.max(last.to, r.to);
    else out.push({ from: r.from, to: r.to });
  }
  return out;
}

// ---------- ช่องว่างที่ทำงานได้จริง ----------
// หน้าต่างของวัน = ตั้งแต่ตื่น จนถึงเส้น "ห้ามวางงานหลัง" (ไม่ใช่จนถึงเวลานอน)
// ถ้าวันนี้เลยเวลาตื่นมาแล้ว ให้เริ่มนับจากตอนนี้ — ช่องว่างที่ผ่านไปแล้วไม่ใช่เวลาว่าง
//
// ปัดขึ้นเป็นช่วง 5 นาทีให้ตรงกับที่คนอ่านนาฬิกาจริง ("เริ่ม 19:23" ไม่มีใครทำตาม)
function freeSlots(date = new Date(), now = null) {
  const p = ctxPrefs();
  const wake = hm2min(p.wake) ?? 6 * 60;
  const hardEnd = hm2min(p.noWorkAfter) ?? hm2min(p.sleep) ?? 22 * 60;
  const minBlock = Math.max(5, +p.minBlockMin || 20);

  let start = wake;
  const sameDay = now && now.toDateString() === date.toDateString();
  if (sameDay) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    start = Math.max(start, Math.ceil(nowMin / 5) * 5);
  }
  if (start >= hardEnd) return [];

  const busy = mergeRanges(busyBlocks(date));
  const slots = [];
  let cursor = start;

  for (const b of busy) {
    if (b.to <= cursor) continue;          // ผ่านไปแล้วทั้งก้อน
    if (b.from >= hardEnd) break;          // เลยหน้าต่างของวันไปแล้ว
    if (b.from > cursor) slots.push({ from: cursor, to: Math.min(b.from, hardEnd) });
    cursor = Math.max(cursor, b.to);
    if (cursor >= hardEnd) break;
  }
  if (cursor < hardEnd) slots.push({ from: cursor, to: hardEnd });

  return slots
    .map(s => ({ from: s.from, to: s.to, min: s.to - s.from,
      fromHm: min2hm(s.from), toHm: min2hm(s.to) }))
    .filter(s => s.min >= minBlock);
}

// เวลาว่างรวมของวัน (นาที) — ตัวเลขนี้แทน settings.freeHours ที่ผู้ใช้เดาเอง
function freeMinutes(date = new Date(), now = null) {
  return freeSlots(date, now).reduce((s, x) => s + x.min, 0);
}

// ผู้ใช้กรอกบริบทไปแล้วหรือยัง — ใช้ตัดสินว่าจะโชว์จอชวนตั้งค่าไหม
function ctxIsEmpty() {
  const c = ctxLoad();
  return !c.classes.length && !c.routines.length;
}

// ---------- ให้ตัวซิงก์คลาวด์เรียกใช้ ----------
// เก็บใน user_state ก้อนเดียวกับงานไปก่อน (คีย์ `ctx`) จนกว่าตาราง Supabase จะพร้อม
// พอแตกตารางแล้วให้แก้แค่สองฟังก์ชันนี้ ที่เหลือทั้งไฟล์ไม่ต้องแตะ
function ctxExport() { return ctxLoad(); }
function ctxImport(data) {
  if (!data) return;
  ctxCache = {
    prefs: Object.assign({}, CTX_DEFAULT.prefs, data.prefs || {}),
    classes: Array.isArray(data.classes) ? data.classes : [],
    routines: Array.isArray(data.routines) ? data.routines : [],
  };
  try { localStorage.setItem(CTX_KEY, JSON.stringify(ctxCache)); } catch (_) {}
}

// เปิดให้ node เรียกไปทดสอบได้ โดยไม่กระทบการโหลดในเบราว์เซอร์
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { hm2min, min2hm, busyBlocks, mergeRanges, freeSlots, freeMinutes,
    ctxLoad, ctxUpsert, ctxSetPrefs, ctxClear, CTX_DEFAULT };
}
