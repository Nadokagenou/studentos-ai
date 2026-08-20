// StudentOS AI — Planning Engine
// ============================================================
// ไฟล์นี้คือชั้นที่ตอบคำถามเดียวของโปรดักต์: "ตอนนี้ควรทำอะไร"
//
// ทำไมต้องแยกออกมาเป็นไฟล์: ก่อนหน้านี้คำตอบถูกประกอบขึ้นใหม่ในทุกจอที่ต้องใช้มัน —
// หน้าแรกเรียง sortByPriority เอง หน้าแผนเรียก buildDayPlan เอง เส้นเวลานับ workload เอง
// สามจอจึงตอบคำถามเดียวกันคนละแบบได้ และเคยตอบคนละแบบจริง ๆ
// (การ์ด "ควรทำก่อน" ชี้ไปที่สอบ ขณะที่หน้าแผนเอาเวลาไปให้การบ้าน)
// แอปที่เถียงกันเองคือแอปที่ไม่มีใครเชื่อ — ตั้งแต่นี้ทุกจออ่านคำตอบจาก studyPlan() ก้อนเดียว
//
// สิ่งที่ไฟล์นี้ทำ และ engine.js ไม่ได้ทำ:
//   1. จำแผนที่ให้ไปแล้ว   → รู้ได้ว่าผู้ใช้ "พลาด" ช่วงไหน (engine คิดใหม่ทุกครั้ง จึงไม่มีอะไรให้พลาด)
//   2. จัดแผนใหม่เอง       → พลาดแล้วไม่ต้องมานั่งจัดเอง
//   3. แตกงานใหญ่เป็นขั้น  → "เริ่มตรงไหน" เป็นคำถามที่ทำให้คนไม่เริ่ม
//   4. เรียนรู้เวลาจริง     → ประเมิน 30 นาที แต่ทำจริง 48 นาทีทุกครั้ง = ประเมินผิดทุกครั้ง
//   5. มองข้ามวันนี้       → พรุ่งนี้รับไหวไหม ต้องรู้ตั้งแต่วันนี้ ตอนที่ยังเลือกได้
//
// ทุกอย่างในไฟล์นี้เป็นการคำนวณล้วน ไม่มีการเรียกโมเดลภาษา ไม่มีเน็ต ทดสอบซ้ำได้ทุกครั้ง
// (โมเดลภาษาอยู่ที่การ "อ่านใบงาน" กับ "คุยกับน้องไซ" เท่านั้น — การจัดตารางต้องอธิบายได้)
// ============================================================

const PLAN_KEY = 'studentos.alt.plan';

// เวลาที่กันไว้เผื่อชีวิต — ตารางที่จัดเต็ม 100% คือตารางที่พังตั้งแต่เรื่องแรกที่ไม่คาดคิด
// (เพื่อนโทรมา · เน็ตหลุด · หาไฟล์ไม่เจอ) แล้วพอพังก็เลิกเชื่อทั้งตาราง
// กันไว้ 15% ของเวลาว่าง แต่ไม่เกินครึ่งชั่วโมง — และห้ามกินเวลาของงานที่วันนี้เป็นวันสุดท้าย
const BUFFER_PCT = 0.15;
const BUFFER_MAX = 30;

// ต่ำกว่านี้ไม่นับว่า "พลาด" — ลุกไปเข้าห้องน้ำก็เกินสิบนาทีแล้ว
const MISS_MIN = 10;

// ---------- 1) แผนที่ให้ไปแล้ว ----------
// เก็บแยกจาก studentos.alt.v1 โดยตั้งใจ: แผนเป็นของที่หมดอายุทุกวัน
// ลบทิ้งได้โดยงานไม่หาย และพังได้โดยไม่ลากข้อมูลผู้ใช้ไปด้วย

function planDayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

function loadCommitted() {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && p.blocks ? p : null;
  } catch (e) { return null; }
}

function saveCommitted(p) {
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); } catch (e) {}
}

// บันทึกแผนของวันนี้ไว้เทียบทีหลัง — เก็บเป็น "นาทีจากเที่ยงคืน" ไม่ใช่ ISO
// เพราะสิ่งที่ต้องเทียบคือช่วงเวลาของวัน ไม่ใช่จุดเวลาสัมบูรณ์ และอ่านตอน debug ง่ายกว่ามาก
function commitPlan(plan, st, now = new Date()) {
  const prev = loadCommitted();
  const key = planDayKey(now);

  // ขึ้นบัญชี "สิ่งที่พลาดไป" ก่อนจะทับแผนเก่าเสมอ
  //
  // ไม่ทำตรงนี้ แถบ "จัดแผนใหม่ให้แล้ว" จะขึ้นแวบเดียวแล้วหายทันทีที่ผู้ใช้แตะอะไรสักอย่าง —
  // เพราะบล็อกที่พลาดถูกถอดออกไปพร้อมแผนเก่า แล้วไม่เหลืออะไรให้นับในรอบถัดไป
  const fresh = planMisses(st, now);
  const sameDay = prev && prev.date === key;
  const log = (sameDay && prev.log) || { lostMin: 0, taskIds: [], since: null };
  if (fresh.lostMin > 0) {
    log.lostMin += fresh.lostMin;
    for (const t of fresh.tasks) if (!log.taskIds.includes(t.id)) log.taskIds.push(t.id);
    if (log.since == null) log.since = fresh.since;
  }

  const blocks = plan.slots.filter(s => !s.break).map(s => ({
    taskId: s.task.id,
    from: s.start.getHours() * 60 + s.start.getMinutes(),
    to: s.end.getHours() * 60 + s.end.getMinutes(),
    min: s.min,
  }));
  saveCommitted({
    date: key, blocks, log,
    madeAt: now.toISOString(),
    // บอกไปแล้วตอนที่พลาดกี่นาที — กันไม่ให้แถบขึ้นซ้ำเรื่องเดิมทั้งวัน
    // แต่ยังขึ้นใหม่ได้ถ้าพลาดเพิ่มอีกช่วง (ดู markReplanTold)
    told: sameDay ? (prev.told || null) : null,
  });
}

// สิ่งที่พลาดไปทั้งวัน = ที่สะสมไว้ในบัญชี + ที่เพิ่งตรวจเจอจากแผนชุดปัจจุบัน
// งานที่ทำเสร็จไปแล้วหลังจากนั้นถูกตัดออก — ตามไปทำจนเสร็จแล้วไม่ใช่การพลาด
function dayMisses(st, now = new Date()) {
  const p = loadCommitted();
  const fresh = planMisses(st, now);
  const log = (p && p.date === planDayKey(now) && p.log) || { lostMin: 0, taskIds: [], since: null };
  const tasks = log.taskIds
    .map(id => (st.tasks || []).find(t => t.id === id))
    .filter(t => t && !t.done && !t.deleted);
  for (const t of fresh.tasks) if (!tasks.includes(t)) tasks.push(t);
  const sinceList = [log.since, fresh.since].filter(v => v != null);
  return {
    lostMin: tasks.length ? log.lostMin + fresh.lostMin : 0,
    tasks,
    since: sinceList.length ? Math.min(...sinceList) : null,
    told: (p && p.told) || null,
  };
}

// "รับทราบแล้ว" — เก็บไว้ด้วยว่าตอนที่รับทราบ พลาดไปแล้วกี่นาที
//
// เก็บแค่เวลาที่กดไม่พอ: ผู้ใช้กดรับทราบตอนพลาดไป 40 นาที แล้วหายไปอีกชั่วโมงครึ่ง
// กลับมาเจอตารางที่เปลี่ยนอีกรอบโดยไม่มีอะไรบอก — ซึ่งเป็นอาการเดียวกับที่ตั้งใจจะแก้
// เทียบจากจำนวนนาทีจึงประกาศซ้ำได้เมื่อพลาดเพิ่ม แต่ไม่ตื๊อซ้ำเรื่องเดิมทั้งวัน
function markReplanTold(now = new Date(), lostMin = 0) {
  const p = loadCommitted();
  if (!p) return;
  p.told = { at: now.toISOString(), lostMin };
  saveCommitted(p);
}

// ---------- 2) พลาดไปกี่นาที ----------
// "พลาด" = เคยบอกไว้ว่าช่วงนี้ทำงานใบนี้ ช่วงนั้นผ่านไปแล้ว งานยังไม่เสร็จ
// และไม่มีร่องรอยว่าได้นั่งทำจริง (ไม่มีรอบจับเวลาที่ทับช่วงนั้น)
//
// เช็คกับ sessions ไม่ใช่กับความรู้สึก — คนที่ทำงานไปจริงแต่ไม่ได้กดจับเวลา
// จะถูกนับว่าพลาด ซึ่งยอมรับได้ เพราะผลลัพธ์คือ "จัดเวลาที่เหลือใหม่ให้" ไม่ใช่การตำหนิ
function planMisses(state, now = new Date()) {
  const p = loadCommitted();
  const empty = { blocks: [], lostMin: 0, tasks: [], since: null };
  if (!p || p.date !== planDayKey(now)) return empty;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sess = (state.sessions || []);
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);

  const missed = [];
  for (const b of p.blocks) {
    if (b.to > nowMin) continue;                       // ยังไม่ถึงเวลา หรือกำลังอยู่ในช่วงนั้น
    const t = (state.tasks || []).find(x => x.id === b.taskId);
    if (!t || t.done || t.deleted) continue;           // ทำเสร็จแล้ว = ไม่ได้พลาด
    // มีรอบจับเวลาทับช่วงนี้ไหม
    const worked = sess.some(s => {
      if (s.taskId !== b.taskId) return false;
      const s0 = (new Date(s.start) - midnight) / 60000;
      const s1 = (new Date(s.end) - midnight) / 60000;
      return s1 > b.from && s0 < b.to;
    });
    if (!worked) missed.push({ block: b, task: t });
  }

  const lostMin = missed.reduce((a, m) => a + m.block.min, 0);
  // งานซ้ำใบเดียวถูกหั่นหลายช่วงได้ — นับเป็นงานเดียว
  const tasks = [];
  for (const m of missed) if (!tasks.includes(m.task)) tasks.push(m.task);
  return {
    blocks: missed, lostMin, tasks,
    since: missed.length ? Math.min(...missed.map(m => m.block.from)) : null,
    told: p.told || null,
  };
}

// ---------- 3) เวลาที่ใช้จริง ≠ เวลาที่ประเมินไว้ ----------
// ประเมินไว้ 30 แต่ทำจริง 48 ทุกครั้ง = แผนทั้งวันสั้นกว่าความจริงหนึ่งในสาม
// เรียนรู้เป็นรายวิชา เพราะความคลาดเคลื่อนไม่ได้กระจายเท่ากัน
// (งานเขียนบานเสมอ · แบบฝึกหัดเลขมักตรง)
//
// ต้องมีอย่างน้อย 3 ใบที่ทำเสร็จแล้วถึงจะเชื่อ — สองใบแรกคือความบังเอิญ
// และคูณได้ไม่เกิน 2 เท่า ไม่งั้นวันที่ไถลไปวันเดียวจะทำให้แผนสัปดาห์หน้าเพี้ยนทั้งสัปดาห์
const LEARN_MIN_SAMPLES = 3;

function durationStats(state) {
  const bySubject = {};
  const sess = state.sessions || [];
  for (const t of (state.tasks || [])) {
    if (!t.done || t.deleted || !t.estMin) continue;
    const worked = sess.filter(s => s.taskId === t.id).reduce((a, s) => a + s.min, 0);
    if (worked < 5) continue;                          // ไม่ได้จับเวลาไว้ = ไม่มีข้อมูล
    const k = t.subject || 'อื่น ๆ';
    (bySubject[k] || (bySubject[k] = [])).push(worked / t.estMin);
  }
  const out = {};
  for (const [k, list] of Object.entries(bySubject)) {
    if (list.length < LEARN_MIN_SAMPLES) continue;
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    out[k] = { factor: Math.max(0.6, Math.min(2, Math.round(avg * 100) / 100)), n: list.length };
  }
  return out;
}

// นาทีที่ควรกันไว้จริง ๆ ให้งานใบนี้ — ตัวเลขที่ตัวจัดแผนใช้ ไม่ใช่ตัวเลขที่โชว์บนการ์ด
// (บนการ์ดยังโชว์ estMin ที่ผู้ใช้กรอก เพราะนั่นคือสิ่งที่เขาบอกไว้ การไปแก้ตัวเลขของเขาเงียบ ๆ
//  คือการทำให้เขาไม่เข้าใจว่าทำไมแผนถึงยาวกว่าที่ตัวเองพิมพ์)
function plannedMin(task, stats) {
  const base = remainingMin(task);
  const s = stats && stats[task.subject || 'อื่น ๆ'];
  if (!s || s.factor <= 1.1) return base;              // เร็วกว่าที่ประเมิน = ไม่ต้องไปยืดให้
  return Math.round(base * s.factor);
}

// งานหนึ่งใบควรได้เวลาของ "วันนี้" เท่าไหร่
//
// ปัญหาที่ทำให้ต้องมีฟังก์ชันนี้: งานอ่านสอบสองชั่วโมงที่สอบอีกเจ็ดวัน ถูกวางเป็นก้อนเดียว
// ยาวสองชั่วโมงเต็มในเย็นวันนี้ กินเวลาว่างทั้งเย็นไปคนเดียว แล้วการบ้านที่ส่งพรุ่งนี้
// กับรายงานที่ส่งวันอาทิตย์ไม่เหลือที่เลยสักนาที
//
// การอ่านสอบรวดเดียวสองชั่วโมงหนึ่งครั้งยังแพ้การอ่านสี่รอบรอบละครึ่งชั่วโมงคนละวันอยู่แล้ว
// (เว้นระยะแล้วกลับมาทวน คือสิ่งเดียวที่งานวิจัยเรื่องความจำเห็นตรงกัน)
// การแบ่งจึงไม่ใช่การประนีประนอมเรื่องเวลา แต่เป็นวิธีอ่านที่ถูกกว่าอยู่แล้ว
//
// ข้อยกเว้น: เหลือไม่ถึงวันเดียว หรือวันนี้เป็นโอกาสสุดท้าย → ไม่มีวันพรุ่งนี้ให้แบ่ง เอาไปทั้งก้อน
const SHARE_FLOOR = 40;   // ต่ำกว่านี้ยังไม่ทันเข้าที่ก็หมดรอบแล้ว
const SHARE_DAYS_MAX = 5; // แบ่งเกินห้าวันแล้วแต่ละรอบสั้นจนไม่ได้อะไร

function todayShare(task, now, stats) {
  const need = plannedMin(task, stats);
  if (!task.due) return need;
  const hrs = (new Date(task.due) - now) / 3.6e6;
  if (hrs <= 24 || isLastChanceToday(task, now)) return need;
  const days = Math.max(1, Math.min(SHARE_DAYS_MAX, Math.ceil(hrs / 24)));
  return Math.min(need, Math.max(SHARE_FLOOR, Math.ceil(need / days / 5) * 5));
}

// ---------- 4) แตกงานใหญ่เป็นขั้นตอน ----------
// "ทำรายงานวิทยาศาสตร์ 2 ชั่วโมง" ไม่ใช่สิ่งที่คนเริ่มทำได้ มันคือสิ่งที่คนเลื่อน
// "หาข้อมูล 3 แหล่ง 20 นาที" คือสิ่งที่เริ่มได้ — ความต่างอยู่ที่รู้ว่าจะขยับอะไรก่อน
//
// ขั้นตอนถูกสร้างจากรูปแบบของงาน ไม่ได้ถามโมเดลภาษา เพราะมันต้องได้คำตอบเดิมทุกครั้ง
// และต้องใช้ได้ตอนไม่มีเน็ต · น้ำหนักของแต่ละขั้นรวมกันได้ 100 เสมอ
const STEP_TEMPLATES = [
  { test: /รายงาน|โครงงาน|report|project|นำเสนอ|present|สไลด์|slide|โปสเตอร์/i, steps: [
    ['หาข้อมูล — อย่างน้อย 3 แหล่ง', 18],
    ['อ่านแล้วจดประเด็นที่จะใช้', 20],
    ['เขียนบทนำ', 14],
    ['เขียนเนื้อหาหลัก', 30],
    ['เขียนสรุป', 10],
    ['ตรวจทาน จัดหน้า ส่ง', 8],
  ] },
  { test: /เรียงความ|essay|เขียนบทความ|บันทึก|เล่าเรื่อง|จดหมาย/i, steps: [
    ['ร่างโครง — จะพูดอะไรบ้าง', 15],
    ['เขียนย่อหน้าเปิด', 15],
    ['เขียนเนื้อหา', 45],
    ['เขียนย่อหน้าปิด', 12],
    ['อ่านทวนแก้คำผิด', 13],
  ] },
  { test: /แบบฝึกหัด|โจทย์|ข้อ\s*\d|ใบงาน|worksheet|คำนวณ/i, steps: [
    ['ทำข้อต้น ๆ ให้ติดเครื่องก่อน', 30],
    ['ทำข้อกลาง', 40],
    ['เก็บข้อที่ข้ามไว้ + ตรวจคำตอบ', 30],
  ] },
  { test: /อ่าน|ท่อง|สรุป|ทบทวน|summary/i, steps: [
    ['อ่านรอบแรก — ไม่ต้องจด', 35],
    ['อ่านรอบสอง แล้วจดสรุปย่อ', 40],
    ['ปิดหนังสือแล้วลองเล่าเอง', 25],
  ] },
  { test: /วาด|ระบายสี|ออกแบบ|ตัดต่อ|วิดีโอ|คลิป/i, steps: [
    ['หาแบบ/ไอเดียอ้างอิง', 20],
    ['ร่างโครง', 25],
    ['ลงรายละเอียด', 40],
    ['เก็บงาน + ส่ง', 15],
  ] },
];

// งานสอบมีจังหวะของมันเอง — อ่านทีเดียวจบไม่เคยได้ผล
// เว้นระยะแล้วกลับมาทวนคือสิ่งเดียวที่งานวิจัยเรื่องความจำเห็นตรงกัน
const EXAM_STEPS = [
  ['อ่านรอบแรก — กวาดให้ครบทุกหัวข้อ', 30],
  ['จดสรุปย่อด้วยคำของตัวเอง', 25],
  ['ทำโจทย์/ข้อสอบเก่า', 25],
  ['กลับมาทวนเฉพาะจุดที่ยังไม่แน่น', 20],
];

// ต่ำกว่านี้ไม่ต้องแตก — งาน 30 นาทีที่ถูกหั่นเป็นสามขั้นคือการเพิ่มงานเอกสาร ไม่ใช่การช่วย
const STEP_MIN_TOTAL = 45;

function stepTemplateFor(task) {
  if (taskType(task) === 'exam') return EXAM_STEPS;
  const text = [task.detail, task.subject].filter(Boolean).join(' ');
  for (const tpl of STEP_TEMPLATES) if (tpl.test.test(text)) return tpl.steps;
  return null;
}

// สร้างขั้นตอนแล้วเก็บติดตัวงานไว้ — ต้องเก็บ ไม่ใช่คิดใหม่ทุกครั้งที่วาดจอ
// เพราะผู้ใช้ติ๊กความคืบหน้าลงบนขั้นตอนพวกนี้ ถ้ามันเปลี่ยนหน้าตาเองได้ ความคืบหน้าก็หายไปด้วย
function ensureSteps(task) {
  if (task.steps && task.steps.length) return task.steps;
  const total = task.estMin || 30;
  if (total < STEP_MIN_TOTAL) return null;
  const tpl = stepTemplateFor(task);
  if (!tpl) return null;
  const sum = tpl.reduce((a, s) => a + s[1], 0);
  task.steps = tpl.map((s, i) => ({
    id: 's' + i,
    title: s[0],
    min: Math.max(5, Math.round(total * s[1] / sum)),
    done: false,
  }));
  return task.steps;
}

// ขั้นถัดไปที่ยังไม่ได้ทำ — คือคำตอบของ "เริ่มตรงไหน"
function nextStep(task) {
  const steps = task.steps;
  if (!steps || !steps.length) return null;
  return steps.find(s => !s.done) || null;
}

// ความคืบหน้าที่มาจากขั้นที่ติ๊กแล้วจริง ๆ ไม่ใช่ตัวเลขที่ผู้ใช้ลากแถบเอา
function stepProgress(task) {
  const steps = task.steps;
  if (!steps || !steps.length) return null;
  const total = steps.reduce((a, s) => a + s.min, 0);
  const done = steps.filter(s => s.done).reduce((a, s) => a + s.min, 0);
  return total ? Math.round(done / total * 100) : 0;
}

// ---------- 5) พรุ่งนี้รับไหวไหม ----------
// เวลาว่างสี่ชั่วโมงครึ่งเป็นข่าวดีหรือข่าวร้าย ขึ้นอยู่กับว่ามีงานรออยู่กี่ชั่วโมง —
// ตัวเลขเดียวโดด ๆ ตอบคำถามไม่ได้ ต้องเทียบกับภาระเสมอ
//
// วิธีคิด: เทียบ "เวลาสะสมที่มี" กับ "งานสะสมที่ต้องเสร็จ" ณ ปลายของแต่ละวัน
//
//   ถึงสิ้นวันศุกร์ ฉันจะมีเวลาว่างรวมกี่นาที  vs  งานที่ต้องส่งไม่เกินวันศุกร์รวมกี่นาที
//
// ต้องคิดแบบสะสมเท่านั้น เพราะงานทำล่วงหน้าได้ — งานที่ส่งวันอาทิตย์เอามาทำวันพฤหัสก็ได้
// นับแบบ "วันไหนส่งก็เป็นภาระของวันนั้น" จะได้คำเตือนผิดสองทางพร้อมกัน:
//   ปลอมขึ้น  — งานสามใบส่งพรุ่งนี้ ถูกนับเป็นภาระของพรุ่งนี้ทั้งก้อน ทั้งที่คืนนี้ก็ทำได้
//   ตกหล่นไป — ทุกวันดูสบาย แล้ววันสุดท้ายค่อยพบว่าต้องนั่งเจ็ดชั่วโมงรวด
//
// ตัวเลขที่ได้จึงตอบคำถามที่มีประโยชน์จริง: "ถึงวันนั้น เวลาจะขาดไปกี่นาที"
function workloadAhead(tasks, settings, now = new Date(), days = 7, stats = null) {
  const pending = tasks.filter(t => !t.done && !t.deleted &&
    TASK_TYPES[taskType(t)].schedulable);
  const capDay = Math.round(Math.max(0.5, +settings.freeHours || 2) * 60);
  const out = [];
  let capAcc = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date(now); date.setDate(date.getDate() + i); date.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);

    // วันนี้เหลือเท่าที่เหลือจริง ไม่ใช่ทั้งวัน — เวลาที่ผ่านไปแล้วเอากลับมาไม่ได้
    const free = typeof freeMinutes === 'function'
      ? freeMinutes(date, i === 0 ? now : null) : capDay;
    const cap = Math.min(free, capDay);
    capAcc += cap;

    const dueBy = pending.filter(t => t.due && new Date(t.due) <= end);
    const needAcc = dueBy.reduce((a, t) => a + plannedMin(t, stats), 0);
    const dueThisDay = dueBy.filter(t => new Date(t.due) > new Date(end.getTime() - 864e5));

    out.push({
      date, dayOffset: i,
      capMin: cap, capAcc, needMin: needAcc,
      tasks: dueThisDay,          // ใบที่เส้นตายตกวันนี้พอดี — ใช้เขียนคำแนะนำ
      allDue: dueBy,
      overMin: Math.max(0, needAcc - capAcc),
      ratio: capAcc ? needAcc / capAcc : (needAcc ? Infinity : 0),
    });
  }
  return out;
}

// วันที่หนักเกินไปวันแรกที่เจอ + คำแนะนำที่ทำตามได้จริง
// "งานเยอะนะ" ไม่ใช่คำแนะนำ · "เลื่อนรายงานวิทย์ไปเสาร์" คือคำแนะนำ
// วันแรกที่เวลาสะสม "ไม่พอ" จริง ๆ + สิ่งที่ทำได้ตอนนี้
//
// คำเตือนที่ไม่มีทางออกให้ คือคำเตือนที่อ่านแล้วเครียดเปล่า ๆ — "งานเยอะนะ" ไม่ใช่คำแนะนำ
// จึงต้องจบด้วยประโยคที่ลงมือทำได้เสมอ ต่อให้ทางออกที่เหลือคือ "เริ่มตั้งแต่คืนนี้"
function overloadWarning(tasks, settings, now = new Date(), stats = null) {
  const days = workloadAhead(tasks, settings, now, 7, stats);
  const hit = days.find(d => d.overMin >= 20 && d.allDue.length);
  if (!hit) return null;

  // ใบที่ใหญ่ที่สุดในกองที่ต้องเสร็จภายในวันนั้น — เป็นทั้งใบที่ควรขยับ และใบที่ควรเริ่มก่อน
  const biggest = [...hit.allDue].sort((a, b) => remainingMin(b) - remainingMin(a))[0] || null;

  // ขยับได้จริงไหม: เส้นตายต้องอยู่หลังวันที่งานล้น ไม่งั้นการ "เลื่อน" คือการยอมส่งสาย
  const canMove = biggest && new Date(biggest.due) > new Date(hit.date.getTime() + 864e5);
  const move = canMove ? biggest : null;

  // ย้ายไปวันไหน: วันแรกหลังจากนั้นที่เวลาสะสมยังไม่ตึง และยังไม่เลยเส้นตายของงานใบนั้น
  let to = null;
  if (move) {
    to = days.find(d => d.dayOffset > hit.dayOffset && d.overMin === 0 &&
      d.date <= new Date(move.due)) || null;
  }
  return { day: hit, move, to, start: move ? null : biggest };
}

// ---------- 5.5) งานที่เลยกำหนดมานานเกินกว่าจะเดาแทน ----------
// สามวันคือเส้นที่เลือกจากพฤติกรรมจริง: เลยมาวันสองวันยังเป็น "รีบทำให้เสร็จ"
// เลยมาเป็นสัปดาห์มักแปลว่าเรื่องมันจบไปแล้วทางใดทางหนึ่ง และมีแต่ผู้ใช้ที่รู้ว่าทางไหน
//
// triagedAt = ผู้ใช้ตอบแล้วว่ายังต้องส่ง · ตอบครั้งเดียวพอ ไม่ต้องถามซ้ำทุกวัน
const STALE_DAYS = 3;

function staleOverdue(task, now = new Date()) {
  if (!task || !task.due || task.done || task.deleted) return false;
  if (task.triagedAt) return false;
  return (now - new Date(task.due)) > STALE_DAYS * 864e5;
}

// ---------- 6) แผนของวันนี้ (ตัวหลักที่ทุกจอเรียก) ----------
// คืนคำตอบชุดเดียวให้ทั้งแอป: ทำอะไรตอนนี้ · ต่อไปคืออะไร · ที่เหลือรอได้ · มีอะไรต้องรู้ไหม
function studyPlan(state, now = new Date()) {
  const tasks = (state.tasks || []).filter(t => !t.deleted);
  const pending = tasks.filter(t => !t.done);
  const settings = state.settings || {};
  const stats = durationStats(state);

  // สองปุ่มที่ผู้ใช้ใช้บอกว่า "ไม่ใช่ตอนนี้" — ทั้งคู่ห้ามแตะ due ซึ่งเป็นของครู
  //   notNowAt   = ยังไม่ไหวตอนนี้ · พักไว้ 3 ชม. แล้วกลับมาเสนอใหม่
  //   plannedFor = ปัดเลื่อนไปวันหลัง · หายไปจากแผนวันนี้
  //
  // งานที่ "วันนี้เป็นโอกาสสุดท้าย" เลื่อนออกจากแผนไม่ได้ — ยอมเมื่อไหร่ แผนก็พาไปพลาดส่ง
  // อย่างสุภาพ ซึ่งแย่กว่าไม่มีแผนเลย · แต่ก็แปลว่าปุ่ม "ยังไม่ไหวตอนนี้" กดแล้วไม่เกิดอะไรขึ้น
  // ทั้งที่ toast บอกว่าสลับงานให้แล้ว — ปุ่มที่โกหกแย่กว่าปุ่มที่ไม่มี
  //
  // ทางออก: แยก "หายไปจากแผน" ออกจาก "ไม่ขึ้นเป็นการ์ด NOW"
  // งานเลื่อนไม่ได้ที่ถูกกดพัก จึงยังกินที่ในแผนเหมือนเดิม (เวลาไม่ถูกแอบเอาไปให้งานอื่น)
  // แต่ไม่ขึ้นมาขวางหน้า และมีกล่องเตือนบอกตรง ๆ ว่ามันยังรออยู่และเลื่อนไม่ได้
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const paused = t => (t.notNowAt && (now - new Date(t.notNowAt)) < 3 * 3.6e6) ||
    (t.plannedFor && new Date(t.plannedFor) > endOfToday);
  const stuck = pending.filter(t => paused(t) && isLastChanceToday(t, now));

  // งานที่เลยกำหนดมานานแล้ว ต้องถามก่อน ไม่ใช่จัดลงแผนเงียบ ๆ
  //
  // เอนจินให้คะแนน "เลยกำหนดแล้ว" สูงสุด (65) ซึ่งถูกสำหรับงานที่เพิ่งเลยมาไม่กี่ชั่วโมง
  // แต่พอเลยมาหลายวัน ตรรกะเดียวกันกลับให้ผลที่ผิด: การบ้านที่เลยมาหกวันขึ้นเป็นงานอันดับหนึ่ง
  // เบียดงานที่พรุ่งนี้ต้องส่งและยังส่งทัน — ซึ่งเป็นการเอาความเสียหายที่เกิดไปแล้ว
  // มาทับความเสียหายที่ยังกันได้
  //
  // และเราไม่รู้จริง ๆ ว่ามันยังต้องส่งอยู่ไหม · ครูอาจปิดรับไปแล้ว หรืออาจให้ส่งช้าได้
  // คนที่รู้คือผู้ใช้ ถามหนึ่งครั้งแล้วจำคำตอบไว้ ดีกว่าเดาแล้วจัดตารางผิดทุกวัน
  const stale = pending.filter(t => staleOverdue(t, now));
  const live = pending.filter(t => !stale.includes(t) && (!paused(t) || stuck.includes(t)));

  const misses = dayMisses(state, now);
  const bufferOf = budget => Math.min(BUFFER_MAX, Math.round(budget * BUFFER_PCT));

  const plan = buildDayPlan(live, settings, now, {
    bufferOf,
    needFor: t => todayShare(t, now, stats),
  });

  // การ์ด NOW = ช่องแรกของแผนที่เป็นงานจริง ไม่ใช่งานที่คะแนนสูงสุดลอย ๆ
  // ต่างกันตรงที่แผนรู้ว่าเวลาที่เหลืออยู่ตอนนี้พอทำอะไรได้บ้าง ส่วนคะแนนไม่รู้
  // งานที่ผู้ใช้เพิ่งบอกว่าไม่ไหว ต้องไม่เด้งกลับมาเป็นการ์ดใบใหญ่ทันที — มันยังอยู่ในแผนก็พอ
  const offer = s => !s.break && !stuck.includes(s.task);
  const firstSlot = plan.slots.find(offer) || null;
  const nowTask = firstSlot ? firstSlot.task
    : (sortByPriority(live.filter(t => !stuck.includes(t)), now)[0] || null);
  const nextSlot = plan.slots.find(s => offer(s) && s.task !== nowTask) || null;

  // LATER = งานที่ "ไม่มีคิวในวันนี้เลย" ไม่ใช่แค่งานที่ไม่ใช่สองใบแรก
  //
  // ถ้านับแบบหลัง งานใบเดียวกันจะโผล่สองที่บนจอเดียว (อยู่ในแผนตอนสองทุ่ม
  // แล้วยังโผล่ในกล่อง "ยังไม่ต้องคิดตอนนี้" อีกรอบ) ซึ่งขัดกันเองต่อหน้าต่อตา
  const inPlan = new Set(plan.slots.filter(s => !s.break).map(s => s.task.id));
  const later = sortByPriority(live.filter(t => !inPlan.has(t.id)), now);

  // แตกขั้นตอนเฉพาะสองใบที่กำลังจะโดนทำจริง ไม่ต้องแตกทั้งกอง —
  // งานที่ยังอยู่ใน LATER ไม่มีใครต้องรู้ว่ามันมีกี่ขั้น และการแตกไว้ก่อนคือการเขียนลง state
  // ให้กับสิ่งที่ผู้ใช้อาจลบทิ้งพรุ่งนี้
  if (nowTask) ensureSteps(nowTask);
  if (nextSlot) ensureSteps(nextSlot.task);

  const warnings = [];
  const missedDue = plan.overflow.filter(o => o.missed);
  if (missedDue.length) {
    warnings.push({ kind: 'missed', tasks: missedDue.map(o => o.task), nextFree: plan.nextFree });
  }
  // งานที่ถูกกดพักไว้ทั้งที่เลื่อนไม่ได้ — ต้องพูดออกมา ไม่ใช่ปล่อยให้หายไปเงียบ ๆ
  if (stuck.length) warnings.push({ kind: 'stuck', tasks: stuck });

  // ถามทีละใบ — ถามพร้อมกันห้าใบคือแบบสอบถาม ไม่ใช่การช่วยตัดสินใจ
  if (stale.length) warnings.push({ kind: 'stale', task: stale[0], more: stale.length - 1 });

  const over = overloadWarning(live, settings, now, stats);
  if (over) warnings.push({ kind: 'overload', ...over });

  return {
    plan, stats, misses,
    now: nowTask ? { task: nowTask, info: priorityInfo(nowTask, now), slot: firstSlot,
                     step: nextStep(nowTask) } : null,
    next: nextSlot ? { task: nextSlot.task, slot: nextSlot, step: nextStep(nextSlot.task) } : null,
    later, warnings,
    // ประกาศเมื่อพลาดถึงเกณฑ์ และยังไม่เคยบอก หรือพลาดเพิ่มขึ้นอีกหนึ่งช่วงหลังจากที่บอกไปแล้ว
    hasReplan: misses.lostMin >= MISS_MIN &&
      (!misses.told || misses.lostMin - (misses.told.lostMin || 0) >= MISS_MIN),
  };
}

// ---------- 7) สรุปประจำสัปดาห์ ----------
// ไม่ใช่หน้าสถิติ — เป็นสามประโยคที่บอกว่า "ระบบเห็นอะไรในตัวคุณ"
// ทุกบรรทัดต้องมาจากข้อมูลจริง ถ้าข้อมูลไม่พอก็ไม่ต้องพูด ดีกว่าพูดสิ่งที่เดาเอา
function weeklyReview(state, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 864e5);
  const tasks = (state.tasks || []).filter(t => !t.deleted);
  const doneWeek = tasks.filter(t => t.done && t.doneAt && new Date(t.doneAt) >= since);
  const sess = (state.sessions || []).filter(s => new Date(s.start) >= since);
  const workedMin = sess.reduce((a, s) => a + s.min, 0);
  const snoozed = tasks.filter(t => (t.snoozeCount || 0) > 0 && !t.done);

  const insights = [];
  const stats = durationStats(state);
  for (const [subj, s] of Object.entries(stats)) {
    // ทศนิยมตำแหน่งเดียวพอ — "1.54 เท่า" ให้ความแม่นยำที่เราไม่ได้มีจริงจากตัวอย่างสามใบ
    if (s.factor >= 1.25) insights.push('งาน' + subj + 'ใช้เวลามากกว่าที่คุณประเมินไว้ประมาณ ' + s.factor.toFixed(1) + ' เท่า');
    else if (s.factor <= 0.8) insights.push('งาน' + subj + 'คุณทำเร็วกว่าที่ประเมินไว้ — เผื่อเวลาน้อยลงได้');
  }

  // ช่วงเวลาที่ทำงานได้จริง — นับจากรอบจับเวลา ไม่ใช่จากความรู้สึก
  if (sess.length >= 5) {
    const byHour = {};
    for (const s of sess) {
      const h = new Date(s.start).getHours();
      byHour[h] = (byHour[h] || 0) + s.min;
    }
    const best = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 30) insights.push('คุณลงมือทำงานมากที่สุดช่วง ' + best[0] + ':00 น.');
  }

  // งานที่ถูกเลื่อนซ้ำ ๆ ไม่ใช่เรื่องวินัย — มันคือสัญญาณว่างานใบนั้นติดอะไรบางอย่าง
  const stuck = snoozed.sort((a, b) => (b.snoozeCount || 0) - (a.snoozeCount || 0))[0];
  if (stuck && (stuck.snoozeCount || 0) >= 3) {
    insights.push('"' + (stuck.detail || stuck.subject) + '" ถูกเลื่อนมา ' + stuck.snoozeCount + ' ครั้ง — ลองแตกเป็นขั้นเล็ก ๆ ดู');
  }

  return {
    doneCount: doneWeek.length,
    snoozeCount: snoozed.length,
    workedMin,
    sessionCount: sess.length,
    insights,
    enough: doneWeek.length >= 3 || sess.length >= 3,
  };
}
