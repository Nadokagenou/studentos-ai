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
    // ---------- 1B45 · F7 ตารางสลับสัปดาห์ ----------
    // โรงเรียนจำนวนไม่น้อยใช้ตารางที่ไม่ซ้ำทุกสัปดาห์ (สัปดาห์ A / สัปดาห์ B)
    // ก่อนหน้านี้แอปนี้ใช้กับโรงเรียนพวกนั้นไม่ได้เลย — ไม่ใช่ใช้ได้แบบไม่สะดวก
    // แต่ตารางจะผิดครึ่งหนึ่งของทุกเทอม ซึ่งแปลว่าเวลาว่างที่คำนวณมาก็ผิดตามไปด้วย
    //
    // เก็บเป็นสองค่า ไม่ใช่ค่าเดียว:
    //   weekMode   'single' = ตารางซ้ำทุกสัปดาห์ (ค่าเดิม ของเก่าทุกเครื่องได้ค่านี้)
    //              'ab'     = สลับสองสัปดาห์
    //   weekAnchor วันที่ที่ผู้ใช้ยืนยันว่า "สัปดาห์นั้นคือ A" · เก็บเป็น YYYY-MM-DD
    //              คำนวณจากจุดยึดเสมอ ไม่ใช่นับจากต้นปี เพราะสัปดาห์แรกของเทอม
    //              ไม่ได้ตรงกับสัปดาห์แรกของปฏิทินสากล และแต่ละโรงเรียนก็ไม่ตรงกันเอง
    weekMode: 'single',
    weekAnchor: null,
  },
  classes: [],
  routines: [],
  // 18 ต.ค. 69 · ช่วงปิดเทอม กับบันทึก "วันนี้เป็นยังไง" รายวัน — ดูหัวข้อ "บริบทรายวัน" ข้างล่าง
  breaks: [],
  days: {},
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

// ก้อนบริบทจากที่เก็บ/คลาวด์ → รูปที่โค้ดทั้งไฟล์เชื่อได้ · ช่องที่เสียหรือไม่มี = ค่าว่าง
// ต้องผ่านที่นี่ทุกทาง (โหลด · นำเข้า · ล้าง) ไม่งั้นช่องใหม่จะหายเงียบ ๆ ทางใดทางหนึ่ง
// (ก่อน 18 ต.ค. 69 ทั้งสามทางสร้างก้อนเองคนละที่ และทิ้งทุกช่องที่ไม่รู้จัก)
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

function ctxLoad() {
  if (ctxCache) return ctxCache;
  let raw = null;
  try { raw = localStorage.getItem(CTX_KEY); } catch (_) {}
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = null; }
  ctxCache = ctxShape(data);
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
  ctxCache = ctxShape(null);
  try { localStorage.removeItem(CTX_KEY); } catch (_) {}
  if (typeof pushToCloud === 'function') pushToCloud();
}

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

// ---------- เดาวันที่ยังไม่ได้บอก (แบบ ก ที่เจ้าของเลือก 18 ต.ค. 69: "เดาให้ แล้วแตะแก้") ----------
// แอปเรียกรถไม่ถามทุกครั้งว่าจะไปไหน มันเดาจากประวัติแล้วให้แตะแก้ · ที่นี่ทำแบบเดียวกัน
// ถามทุกเช้าด้วยปุ่มสามปุ่ม = เพิ่มการตัดสินใจให้นักเรียนทุกวัน ซึ่งสวนกับสิ่งที่แอปนี้ขาย
//
// kind ที่คืน:
//   'set'     ผู้ใช้บอกแล้ว (rec)
//   'break'   ช่วงปิดเทอม (brk)
//   'carry'   วันเรียนก่อนหน้า (ย้อนไม่เกิน 3 วัน — ศุกร์ถึงจันทร์ได้) ตอบว่าไม่ไปโรงเรียน → เดาว่าวันนี้ก็ไม่ไป
//   'class'   มีคาบตามตาราง ไม่มีอะไรบอกเป็นอย่างอื่น
//   'free'    วันนี้ไม่มีคาบในตาราง (เสาร์–อาทิตย์)
//   'unknown' ยังไม่มีตารางเรียนเลย
//
// เดาแค่ "ไปโรงเรียนไหม" เท่านั้น ไม่เดาช่วงเวลา ไม่ลาก "ไม่อยู่ทั้งวัน" ต่อ (ไปค่ายวันเดียวไม่ได้แปลว่าไปทั้งสัปดาห์)
// ต้นทางต้องเป็นคำตอบจริง ไม่ใช่คำเดาอีกที — เดาซ้อนเดาจะลากไปเรื่อย ๆ จนทั้งเทอมไม่มีคาบโดยไม่มีใครยืนยันสักวัน
// busyBlocks ที่เรียกในนี้เป็น typical เสมอ จึงไม่วนกลับมาที่ ctxSchoolOn
function ctxHasClassTypical(date) {
  return busyBlocks(date, { typical: true }).some(b => b.kind === 'class');
}
function ctxDayGuess(date) {
  const rec = ctxDay(date);
  if (rec) return { kind: 'set', rec };
  const brk = ctxBreakOn(date);
  if (brk) return { kind: 'break', brk };
  if (!ctxClasses().length) return { kind: 'unknown' };
  if (!ctxHasClassTypical(date)) return { kind: 'free' };
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (let i = 0; i < 3; i++) {
    d.setDate(d.getDate() - 1);
    if (!ctxHasClassTypical(d)) continue;          // ข้ามเสาร์–อาทิตย์
    const pr = ctxDay(d);
    if (pr && pr.school === false && !pr.away) return { kind: 'carry', school: false, fromKey: ctxDayKey(d) };
    break;                                          // เจอวันเรียนก่อนหน้าแล้ว — ดูแค่วันเดียว
  }
  return { kind: 'class' };
}

// ไปโรงเรียนไหม: คำตอบของวันนั้นชนะเสมอ (ปิดเทอมแต่ถูกเรียกไปซ่อมเสริมก็มี)
// ไม่ได้บอก = ปิดเทอมไม่ไป · เดาจากวันเรียนก่อนหน้า · ไม่งั้นตามตาราง
function ctxSchoolOn(date) {
  const d = ctxDay(date);
  if (d && typeof d.school === 'boolean') return d.school;
  if (ctxBreakOn(date)) return false;
  return ctxDayGuess(date).kind !== 'carry';
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
  else if (!brk && ctxDayGuess(date).kind === 'carry') out.push('ไม่ไปโรงเรียน (แอปเดาจากวันเรียนก่อนหน้า ผู้ใช้ยังไม่ได้ยืนยัน)');
  else if (!brk) out.push('ตามตารางปกติ (ยังไม่ได้บอกเพิ่ม)');
  for (const b of (d && d.blocks) || []) out.push('ไม่ว่าง ' + b.start + '–' + b.end + ' ' + b.title);
  if (d && d.note) out.push('ผู้ใช้เล่าว่า: ' + d.note);
  return out;
}

// ---------- ช่วงเวลาที่ถูกจองไว้ในวันหนึ่ง ----------
// ---------- 1B45 · F7 · วันนี้เป็นสัปดาห์ไหน ----------
// คืน 'A' · 'B' · หรือ null เมื่อยังไม่ได้เปิดโหมดสลับสัปดาห์
// นับเป็น "จำนวนสัปดาห์เต็มจากจุดยึด" โดยตัดทั้งสองวันลงไปที่วันอาทิตย์ก่อนเสมอ
// ถ้าไม่ตัด วันพุธเทียบกับจุดยึดวันศุกร์จะได้ผลต่างไม่ถึง 7 วัน แล้วสัปดาห์เดียวกัน
// จะถูกนับเป็นคนละสัปดาห์กันตรงกลางสัปดาห์พอดี
function ctxWeekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function ctxWeekOf(date = new Date()) {
  const p = ctxPrefs();
  if (p.weekMode !== 'ab' || !p.weekAnchor) return null;
  const anchor = new Date(p.weekAnchor + 'T00:00:00');
  if (isNaN(anchor)) return null;
  const diff = ctxWeekStart(date) - ctxWeekStart(anchor);
  const n = Math.round(diff / (7 * 864e5));
  // ตัวหารลบต้องได้ผลบวก — สัปดาห์ก่อนจุดยึดก็ต้องบอกได้ว่าเป็น A หรือ B
  return ((n % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

// weekday ใช้เลขเดียวกับ Date.getDay() : 0 = อาทิตย์ … 6 = เสาร์
// รายการที่ไม่มี weekday (หรือ weekday = null) ถือว่าเกิดทุกวัน — กินข้าวกับนอนเป็นแบบนั้น
//
// 1B45 · เพิ่มด่านที่สอง: สัปดาห์ · รายการที่ไม่ได้ระบุ week ถือว่าเกิดทุกสัปดาห์
// ซึ่งทำให้ตารางเดิมของทุกคนทำงานเหมือนเดิมเป๊ะโดยไม่ต้องแก้อะไรสักคาบ
// date เป็นอาร์กิวเมนต์ที่ใส่หรือไม่ใส่ก็ได้ — ผู้เรียกเก่าที่ส่งมาสองตัวยังถูกต้องอยู่
// เพราะเมื่อไม่มี date ก็ไม่มีทางรู้สัปดาห์ จึงต้องปล่อยผ่าน ไม่ใช่ตัดทิ้ง
function onDay(item, weekday, date) {
  if (item.week && date) {
    const w = ctxWeekOf(date);
    if (w && item.week !== w) return false;
  }
  if (item.weekday == null) return true;
  if (Array.isArray(item.weekday)) return item.weekday.includes(weekday);
  return +item.weekday === weekday;
}

// คืนช่วงที่ทำงานไม่ได้ เรียงตามเวลา และ **รวมช่วงที่ซ้อนกันแล้ว**
// การรวมสำคัญมาก: เรียน 08:00–16:00 กับ เดินทาง 15:30–16:30 ซ้อนกันอยู่ 30 นาที
// ถ้าไม่รวมก่อน ตัวลบจะเจอช่องว่างปลอมยาว −30 นาที แล้วคำนวณเวลาว่างเกินจริง
//
// 18 ต.ค. 69 · อ่านช่วงปิดเทอมกับบันทึกรายวันด้วย (ดูหัวข้อ "บริบทรายวัน")
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
//
// opts เอาไว้ให้ผู้เรียกขยับเส้นได้ในกรณีพิเศษ (ดู planWindows) โดยไม่ต้องไปแก้ prefs ของผู้ใช้:
//   hardEnd  — เส้นท้ายวันเป็นนาที (แทน noWorkAfter)
//   minBlock — ช่องสั้นสุดที่ยังนับว่าทำงานได้
function freeSlots(date = new Date(), now = null, opts = {}) {
  const p = ctxPrefs();
  const wake = hm2min(p.wake) ?? 6 * 60;
  const hardEnd = opts.hardEnd ?? hm2min(p.noWorkAfter) ?? hm2min(p.sleep) ?? 22 * 60;
  const minBlock = Math.max(5, +(opts.minBlock ?? p.minBlockMin) || 20);

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

// ---------- หน้าต่างที่ตัวจัดแผนวางงานลงได้จริง ----------
// นี่คือจุดเดียวในแอปที่ตอบคำถาม "วันนี้เหลือเวลาตรงไหนบ้าง และวางได้เท่าไหร่"
// ทั้งประโยคของ AI · หัวจอตารางงาน · แผนรายชั่วโมง ต้องอ่านจากที่เดียวกันนี้
// ไม่งั้นสามจอจะพูดเลขคนละตัวกับผู้ใช้คนเดียวกัน ซึ่งเคยเป็นแบบนั้นมาก่อน
//
// freeSlots บอกช่องว่างดิบ แต่ตัวจัดแผนต้องการมากกว่านั้นสองอย่าง:
//
//   1) ยังไม่รู้จักตารางของเขาเลย → ห้ามเดาว่าเขาว่างตั้งแต่ตอนนี้ยันหัวค่ำ
//      เด็กที่ยังนั่งอยู่ในคาบตอนบ่ายสองจะได้แผนที่เริ่มบ่ายสอง ซึ่งทำตามไม่ได้สักบรรทัด
//      กรณีนี้ถอยไปใช้ธรรมเนียม "การบ้านเริ่มหลังมื้อเย็น" ก่อน แล้วค่อยชวนเขามาบอกตารางจริง
//
//   2) เลยเส้นห้ามวางงานแล้วแต่ยังไม่ถึงเวลานอน → ห้ามตอบว่า "หมดเวลาแล้ว"
//      คนที่เปิดแอปสี่ทุ่มเพราะพรุ่งนี้ต้องส่ง ต้องการแผน ไม่ใช่คำเทศนาเรื่องเวลานอน
//      แต่ต้องบอกตรง ๆ ว่านี่คือเวลาที่ยืมมาจากการนอน (mode = 'late')
//
// budgetMin ≠ windowMin โดยตั้งใจ: ช่องว่างคือ "เวลาที่มี" ส่วน freeHours คือ "แรงที่ไหว"
// ว่าง 6 ชั่วโมงไม่ได้แปลว่านั่งทำได้ 6 ชั่วโมง แผนที่ยัดเต็มช่องว่างคือแผนที่ไม่มีใครทำตาม
const EVENING_START = 19 * 60;   // ใช้เฉพาะตอนยังไม่รู้จักตารางเขาเท่านั้น

function fmtSlot(from, to) {
  return { from, to, min: to - from, fromHm: min2hm(from), toHm: min2hm(to) };
}

function planWindows(settings = {}, now = new Date()) {
  const p = ctxPrefs();
  const capMin = Math.round(Math.max(0.5, +settings.freeHours || 2) * 60);
  const nowMin = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5;
  const hardEnd = hm2min(p.noWorkAfter) ?? 21 * 60 + 30;
  // เข้านอนเที่ยงคืนถูกเก็บเป็น '00:00' = 0 นาที ซึ่งถ้าใช้ตรง ๆ จะแปลว่า "ปลายวันอยู่ก่อนตอนนี้เสมอ"
  // แล้วคนที่นอนเที่ยงคืนจะไม่เคยได้ช่วงยืมเวลาก่อนนอนเลยสักครั้ง — นับเป็นปลายวันแทน
  const sleepRaw = hm2min(p.sleep);
  const sleep = (sleepRaw == null || sleepRaw === 0) ? 24 * 60 : sleepRaw;

  let mode = 'context';
  let slots;

  // 18 ต.ค. 69 · ยังไม่มีตารางเรียน แต่เขาบอกเรื่องวันนี้แล้ว (หรือปิดเทอมอยู่) = รู้มากกว่าการเดา
  // ของเดิมเดา "ว่างตั้งแต่ 19:00" ทื่อ ๆ แล้ววางงานทับช่วง 18:30–21:00 ที่เพิ่งบอกว่าไปห้าง
  // (เจอในพรีวิว · ทางนี้ไม่ผ่าน freeSlots จึงไม่เห็นบันทึกรายวันเลย)
  // ไม่ไปโรงเรียน = ข้ออ้างของการรอหัวค่ำ ("ยังนั่งอยู่ในคาบ") หายไป จึงนับตั้งแต่ตอนนี้
  const dayKnown = !!(ctxDay(now) || ctxBreakOn(now)) || ctxDayGuess(now).kind === 'carry';

  if (ctxIsEmpty()) {
    mode = 'default';
    if (dayKnown) {
      const from = ctxSchoolOn(now) ? Math.max(nowMin, EVENING_START) : nowMin;
      slots = freeSlots(now, now, { minBlock: 10 })
        .map(s => fmtSlot(Math.max(s.from, from), s.to))
        .filter(s => s.min >= 10);
    } else {
      const from = Math.max(nowMin, EVENING_START);
      slots = from + 10 <= hardEnd ? [fmtSlot(from, hardEnd)] : [];
    }
  } else {
    slots = freeSlots(now, now);
  }

  // ไม่เหลือช่องในกรอบปกติแล้ว — ยืมเวลาก่อนนอนมาให้ พร้อมป้ายบอกว่ายืมมา
  if (!slots.length && nowMin + 10 <= sleep) {
    mode = 'late';
    slots = ctxIsEmpty() && !dayKnown
      ? [fmtSlot(nowMin, sleep)]
      : freeSlots(now, now, { hardEnd: sleep, minBlock: 10 });
    if (!slots.length) mode = 'none';
  } else if (!slots.length) {
    mode = 'none';
  }

  const windowMin = slots.reduce((s, x) => s + x.min, 0);
  return {
    slots, mode, windowMin, capMin,
    budgetMin: Math.min(windowMin, capMin),
    capped: windowMin > capMin,        // เวลามีเหลือ แต่แรงหมดก่อน
    breakMin: Math.max(0, +p.breakMin || 10),
    maxRunMin: Math.max(20, +p.maxRunMin || 50),
  };
}

// ---------- โอกาสสุดท้าย: ยังเหลือเวลาทำก่อนเส้นตายไหม ----------
// จุดที่แผนเคยพลาดหนักที่สุด: มันรู้ว่า "วันนี้เวลาไม่พอ" แล้วตอบว่า "ย้ายไปพรุ่งนี้"
// โดยไม่เคยถามว่าพรุ่งนี้เริ่มว่างกี่โมง — งานที่ส่ง 08:00 ถูกย้ายไปวางไว้ 16:30
// ซึ่งเป็นเวลาที่เส้นตายผ่านไปแล้วแปดชั่วโมงครึ่ง
//
// สามฟังก์ชันข้างล่างตอบคำถามเดียว: "ก่อนถึงเวลานี้ เขายังมีเวลานั่งทำอีกกี่นาที"
// แยกออกมาจาก freeSlots เพราะ freeSlots ตอบแค่ "วันนี้ว่างตรงไหน" ไม่รู้จักเส้นตาย

// ช่องว่างของวัน `date` ที่ยังปิดก่อนเวลา `due` — ช่วงที่คร่อมเส้นตายจะถูกตัดให้จบตรงเส้น
function slotsBefore(due, date = new Date(), now = null, opts = {}) {
  const d = due instanceof Date ? due : new Date(due);
  if (isNaN(d)) return [];
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  if (dayStart >= d) return [];                       // ทั้งวันอยู่หลังเส้นตายแล้ว
  const minBlock = Math.max(5, +(opts.minBlock ?? ctxPrefs().minBlockMin) || 20);
  // เส้นตายอยู่คนละวัน = ทั้งวันใช้ได้ · อยู่วันเดียวกัน = ใช้ได้ถึงนาทีนั้น
  const cut = d.toDateString() === date.toDateString()
    ? d.getHours() * 60 + d.getMinutes() : 24 * 60;

  const out = [];
  for (const s of freeSlots(date, now, opts)) {
    if (s.from >= cut) break;
    out.push(s.to <= cut ? s : fmtSlot(s.from, cut));
  }
  // ตัดแล้วเหลือเศษสั้นกว่าที่นั่งทำไหว ก็ไม่นับว่าเป็นเวลาทำงาน
  return out.filter(s => s.min >= minBlock);
}

// เวลาว่างรวมที่ยังใช้ได้ก่อนถึง `due` (นาที)
//   skipToday — ไม่นับวันนี้ ใช้ตอบว่า "ถ้าไม่ทำวันนี้ ยังทันไหม"
//   stopAt    — พอรวมได้ถึงเท่านี้ก็หยุดไล่ ไม่ต้องนับให้ครบ (ผู้เรียกแค่อยากรู้ว่าพอไหม)
function freeMinutesBefore(due, now = new Date(), opts = {}) {
  const d = due instanceof Date ? due : new Date(due);
  if (isNaN(d) || d <= now) return 0;
  const maxDays = opts.maxDays ?? 14;
  let total = 0;
  for (let i = (opts.skipToday ? 1 : 0); i <= maxDays; i++) {
    const day = new Date(now); day.setDate(day.getDate() + i);
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    if (dayStart >= d) break;                         // ไล่พ้นเส้นตายไปแล้ว
    total += slotsBefore(d, day, i === 0 ? now : null, opts)
      .reduce((a, s) => a + s.min, 0);
    if (opts.stopAt != null && total >= opts.stopAt) break;
  }
  return total;
}

// ช่องว่างก้อนแรกที่ไม่ใช่ของวันนี้ — ไว้บอกตรง ๆ ว่า "พรุ่งนี้กว่าจะว่างก็ 16:30 แล้ว"
function nextFreeSlotAfterToday(now = new Date(), maxDays = 7) {
  for (let i = 1; i <= maxDays; i++) {
    const day = new Date(now); day.setDate(day.getDate() + i);
    const s = freeSlots(day)[0];
    if (s) return { dayOffset: i, date: day, fromHm: s.fromHm, toHm: s.toHm, min: s.min };
  }
  return null;
}

// ---------- แอปรู้จักเจ้าของเครื่องแค่ไหนแล้ว ----------
// คำนวณจากข้อมูลจริงทุกครั้ง ไม่เก็บธง "ตอบแล้ว" ไว้ที่ไหน
// ธงที่เก็บแยกจะเพี้ยนทันทีที่ผู้ใช้ลบข้อมูลทิ้ง แล้วแถบจะรายงานว่า "รู้แล้ว 80%"
// ทั้งที่ในเครื่องไม่เหลืออะไรเลย — ตัวเลขที่โกหกได้คือตัวเลขที่ไม่ควรมี
//
// แต่ละช่องต้องผ่านสองด่าน: มีข้อมูลจริงไหม (done) และรู้แล้วเอาไปทำอะไร (why)
// ช่องที่ตอบ why ไม่ได้ แปลว่าเราถามเพราะอยากรู้ ไม่ใช่เพราะจำเป็น — ตัดทิ้ง
const CTX_SCHOOL_NAMES = ['เรียนที่โรงเรียน', 'เรียน'];

// คาบเรียนก้อนหยาบที่หน้าทำความรู้จักใส่ให้ตอนสมัคร ไม่นับว่า "รู้ตารางเรียน"
// มันคือค่าเริ่มต้นที่แอปเดาเอง ไม่ใช่สิ่งที่ผู้ใช้บอก
function ctxHasRealTimetable() {
  return ctxClasses().some(c => c.subject && !CTX_SCHOOL_NAMES.includes(c.subject.trim()));
}

// ขอบเขตเวลาเรียนของวันธรรมดา — ใช้เป็นหลักหมุดในการเดากิจวัตรรอบ ๆ
// คืน null เมื่อยังไม่มีคาบเรียนเลย เพราะเดาจากอากาศแล้วจะได้กิจวัตรที่ไม่เกี่ยวกับใครเลย
function ctxSchoolSpan() {
  const list = ctxClasses().filter(c => onDay(c, 1) || onDay(c, 2) || onDay(c, 3));
  let from = null, to = null;
  for (const c of list) {
    const a = hm2min(c.start), b = hm2min(c.end);
    if (a == null || b == null || b <= a) continue;
    from = from == null ? a : Math.min(from, a);
    to = to == null ? b : Math.max(to, b);
  }
  return from == null ? null : { from, to, fromHm: min2hm(from), toHm: min2hm(to) };
}

function ctxRoutineOfKind(kind) { return ctxRoutines().filter(r => r.kind === kind); }

// ช่องที่แอปอยากรู้ เรียงตามผลที่ได้ต่อการตอบหนึ่งครั้ง
// ที่ไม่มีในรายการนี้คือของที่ตอบไปแล้วแผนไม่เปลี่ยนสักบรรทัด
function ctxGaps() {
  const span = ctxSchoolSpan();
  const rs = ctxRoutines();
  const after = span ? rs.filter(r => (hm2min(r.start) ?? 0) >= span.to) : [];
  const before = span ? rs.filter(r => (hm2min(r.end) ?? 0) <= span.from) : [];
  return [
    { key: 'timetable', label: 'ตารางเรียนรายวิชา',
      why: 'จะได้ไม่วางงานทับคาบเรียน และรู้ว่าวันไหนเลิกดึก',
      done: ctxHasRealTimetable() },
    { key: 'travel', label: 'เวลาเดินทางไป–กลับ',
      why: 'เวลาที่หายไปจริงทุกวัน แต่แทบไม่มีใครนึกถึงตอนวางแผน',
      done: ctxRoutineOfKind('travel').length > 0 },
    { key: 'meal', label: 'เวลากินข้าว อาบน้ำ',
      why: 'กันไม่ให้งานไปลงทับช่วงที่ลุกจากโต๊ะอยู่แล้ว',
      done: ctxRoutineOfKind('meal').length > 0 },
    { key: 'after', label: 'หลังเลิกเรียนทำอะไรต่อ',
      why: 'ช่วงบ่ายแก่ถึงค่ำคือที่ที่งานจะไปลง ต้องรู้ว่าว่างจริงแค่ไหน',
      done: after.length > 0 },
    { key: 'morning', label: 'ตอนเช้าก่อนไปเรียน',
      why: 'บางคนอ่านหนังสือได้ตอนเช้า บางคนแทบไม่ทันไปโรงเรียน',
      done: before.length > 0 },
  ];
}

function ctxKnow() {
  const g = ctxGaps();
  return Math.round(g.filter(x => x.done).length / g.length * 100);
}

// ---------- เดากิจวัตรจากตารางเรียนของเขาเอง ----------
// เดาจากเวลาเข้า–เลิกเรียนจริง ไม่ใช่ค่าคงที่ของ "เด็กไทยทั่วไป"
// คนเลิกบ่ายสามกับคนเลิกห้าโมงมีเย็นคนละแบบสิ้นเชิง ชุดเดียวกันใช้กับสองคนนี้ไม่ได้
//
// ทุกก้อนที่คืนไปคือ "ข้อเสนอ" ยังไม่ได้เขียนลงบริบท — ผู้ใช้ต้องกดยืนยันก่อนเสมอ
// เดาแล้วเขียนเงียบ ๆ คือการใส่ตารางชีวิตปลอมให้คนอื่นโดยเขาไม่รู้ตัว
//
// รับ span จากผู้เรียกได้ เพราะตัวช่วยต้องเดาจากคำตอบที่เขาเพิ่งกดในจอก่อนหน้า
// ซึ่งยังไม่ได้เขียนลงบริบท — คนที่เพิ่งลงแอปไม่มีคาบเรียนสักคาบ ถ้าอ่านจากบริบทอย่างเดียว
// จอ "วันธรรมดาของคุณประมาณนี้ไหม" จะว่างเปล่าสำหรับคนที่ต้องการมันที่สุด
function ctxGuessRoutines(spanIn) {
  const span = spanIn || ctxSchoolSpan();
  if (!span || span.from == null || span.to == null || span.to <= span.from) return [];
  const p = ctxPrefs();
  const wake = hm2min(p.wake) ?? 6 * 60;
  const WD = [1, 2, 3, 4, 5];
  const out = [];

  // เช้า: ตื่นถึงเข้าเรียน หักครึ่งชั่วโมงสุดท้ายไว้เป็นเวลาเดินทาง
  const trip = Math.min(60, Math.max(20, Math.round((span.from - wake) / 3 / 5) * 5));
  if (span.from - wake > trip + 10) {
    out.push({ key: 'wake', kind: 'other', title: 'ตื่น อาบน้ำ กินข้าวเช้า',
      start: min2hm(wake), end: min2hm(span.from - trip), weekday: WD });
  }
  if (span.from - wake > 10) {
    out.push({ key: 'go', kind: 'travel', title: 'เดินทางไปโรงเรียน',
      start: min2hm(Math.max(wake, span.from - trip)), end: min2hm(span.from), weekday: WD });
  }
  // เย็น: เลิกเรียน → เดินทางกลับ → กินข้าวอาบน้ำ
  out.push({ key: 'back', kind: 'travel', title: 'เดินทางกลับบ้าน',
    start: min2hm(span.to), end: min2hm(span.to + trip), weekday: WD });
  const dinner = span.to + trip + 30;
  out.push({ key: 'dinner', kind: 'meal', title: 'อาบน้ำ กินข้าวเย็น',
    start: min2hm(dinner), end: min2hm(dinner + 60), weekday: WD });
  return out;
}

// ---------- วันหนึ่งเป็นแท่งเดียว ----------
// คืนทุกช่วงของวันเรียงต่อกันตั้งแต่ตื่นถึงเส้นห้ามวางงาน ไม่มีรู
// ช่องที่ไม่มีอะไรจองคือช่องว่าง — แต่ช่องว่างที่สั้นกว่า minBlockMin ไม่นับเป็นที่ทำงาน
// จึงติดป้ายแยก (kind 'gap') ไม่ใช่ 'free' ไม่งั้นแท่งจะสัญญาเวลาที่วางงานจริงไม่ได้
// opts.real = ใช้วันจริง (ปิดเทอม + บันทึกรายวัน) · ไม่ใส่ = วันปกติของสัปดาห์ (18 ต.ค. 69)
function ctxDayBar(weekday, opts = {}) {
  const p = ctxPrefs();
  const from = hm2min(p.wake) ?? 6 * 60;
  const to = hm2min(p.noWorkAfter) ?? hm2min(p.sleep) ?? 22 * 60;
  if (to <= from) return { from, to: from, blocks: [], freeMin: 0 };

  const minBlock = Math.max(5, +p.minBlockMin || 20);
  const ref = new Date();
  ref.setDate(ref.getDate() + ((weekday - ref.getDay()) + 7) % 7);

  // ไม่รวมก้อนที่ติดกันเข้าด้วยกันเหมือน freeSlots — ที่นั่นสนใจแค่ "ว่างหรือไม่ว่าง"
  // แต่แท่งนี้ต้องตอบว่า "วันนึงหน้าตายังไง" · เรียน–ซ้อม–เดินทาง–กินข้าวที่ต่อกันสนิท
  // ถ้ารวมเป็นก้อนเดียวจะได้แท่งเทายาวสิบสี่ชั่วโมงชื่อ "เรียนที่โรงเรียน" ซึ่งไม่บอกอะไรเลย
  //
  // ช่วงที่ซ้อนกันตัดให้ตัวที่มาก่อนถือครอง (คนเราทำสองอย่างพร้อมกันได้ แต่แท่งวาดซ้อนไม่ได้)
  // ตัวที่ถูกกลืนจนไม่เหลือเวลาก็ไม่ต้องขึ้นแท่ง — ก้อนกว้างศูนย์ไม่มีอะไรให้ดู
  const raw = busyBlocks(ref, { typical: opts.real !== true })
    .filter(b => b.to > from && b.from < to)
    .map(b => ({ from: Math.max(b.from, from), to: Math.min(b.to, to), title: b.title, of: b.kind }));

  const blocks = [];
  let cur = from, freeMin = 0;
  for (const b of raw) {
    const start = Math.max(b.from, cur);
    if (b.to <= start) continue;                     // ถูกก้อนก่อนหน้ากลืนไปหมดแล้ว
    if (start > cur) {
      const min = start - cur;
      blocks.push({ from: cur, to: start, min, kind: min >= minBlock ? 'free' : 'gap' });
      if (min >= minBlock) freeMin += min;
    }
    blocks.push({ from: start, to: b.to, min: b.to - start, kind: 'busy', title: b.title, of: b.of });
    cur = b.to;
  }
  if (cur < to) {
    const min = to - cur;
    blocks.push({ from: cur, to, min, kind: min >= minBlock ? 'free' : 'gap' });
    if (min >= minBlock) freeMin += min;
  }
  return { from, to, blocks, freeMin };
}

// ---------- ให้ตัวซิงก์คลาวด์เรียกใช้ ----------
// เก็บใน user_state ก้อนเดียวกับงานไปก่อน (คีย์ `ctx`) จนกว่าตาราง Supabase จะพร้อม
// พอแตกตารางแล้วให้แก้แค่สองฟังก์ชันนี้ ที่เหลือทั้งไฟล์ไม่ต้องแตะ
function ctxExport() { return ctxLoad(); }
function ctxImport(data) {
  if (!data) return;
  ctxCache = ctxShape(data);
  try { localStorage.setItem(CTX_KEY, JSON.stringify(ctxCache)); } catch (_) {}
}

// เปิดให้ node เรียกไปทดสอบได้ โดยไม่กระทบการโหลดในเบราว์เซอร์
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { hm2min, min2hm, busyBlocks, mergeRanges, freeSlots, freeMinutes,
    slotsBefore, freeMinutesBefore, nextFreeSlotAfterToday,
    ctxGaps, ctxKnow, ctxSchoolSpan, ctxGuessRoutines, ctxDayBar, ctxHasRealTimetable,
    ctxLoad, ctxUpsert, ctxSetPrefs, ctxClear, CTX_DEFAULT,
    ctxDayKey, ctxAddDays, ctxThaiDate, ctxBreaks, ctxBreakOn, ctxDay, ctxSchoolOn, ctxCleanDay,
    ctxDayGuess, ctxHasClassTypical,
    ctxSetDay, ctxClearDay, ctxSetBreak, ctxEndBreak, ctxWithDay, ctxDayLines, ctxImport };
}
