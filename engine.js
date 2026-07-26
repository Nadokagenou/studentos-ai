// ============================================================
// StudentOS AI — Engine
// 1) parseAssignment: แกะ วิชา/ครู/deadline/คะแนน/รายละเอียด จากข้อความไทย
// 2) priorityInfo:   คำนวณลำดับความสำคัญ + สร้าง "เหตุผล" ภาษาไทย
// 3) aiGreeting:     ประโยคแนะนำของ AI บน Dashboard (1–2 ประโยคเสมอ)
// ============================================================

const SUBJECTS = [
  { name: 'ฟิสิกส์',        keys: ['ฟิสิกส์', 'physics'] },
  { name: 'เคมี',           keys: ['เคมี', 'chem'] },
  { name: 'ชีววิทยา',       keys: ['ชีววิทยา', 'ชีวะ', 'bio'] },
  { name: 'คณิตศาสตร์',     keys: ['คณิตศาสตร์', 'คณิต', 'เลข', 'math'] },
  { name: 'ภาษาอังกฤษ',     keys: ['อังกฤษ', 'english', 'essay'] },
  { name: 'ภาษาไทย',        keys: ['ภาษาไทย', 'วรรณคดี', 'เรียงความ'] },
  { name: 'สังคมศึกษา',     keys: ['สังคม', 'ประวัติศาสตร์', 'ภูมิศาสตร์', 'พระพุทธ'] },
  { name: 'วิทยาการคำนวณ',  keys: ['วิทยาการคำนวณ', 'คอมพิวเตอร์', 'เขียนโปรแกรม', 'coding'] },
  { name: 'ศิลปะ',          keys: ['ศิลปะ', 'วาดภาพ', 'ดนตรี'] },
  { name: 'สุขศึกษา/พลศึกษา', keys: ['พละ', 'สุขศึกษา', 'กีฬา'] },
  { name: 'อื่น ๆ',          keys: [] },
];

const THAI_MONTHS = {
  'ม.ค.': 0, 'มกราคม': 0, 'ก.พ.': 1, 'กุมภาพันธ์': 1, 'มี.ค.': 2, 'มีนาคม': 2,
  'เม.ย.': 3, 'เมษายน': 3, 'พ.ค.': 4, 'พฤษภาคม': 4, 'มิ.ย.': 5, 'มิถุนายน': 5,
  'ก.ค.': 6, 'กรกฎาคม': 6, 'ส.ค.': 7, 'สิงหาคม': 7, 'ก.ย.': 8, 'กันยายน': 8,
  'ต.ค.': 9, 'ตุลาคม': 9, 'พ.ย.': 10, 'พฤศจิกายน': 10, 'ธ.ค.': 11, 'ธันวาคม': 11,
};

const WEEKDAYS = { 'อาทิตย์': 0, 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'พฤหัส': 4, 'ศุกร์': 5, 'เสาร์': 6 };
const WEEKDAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// ---------- helpers ----------
function atTime(d, h, m) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// ---------- ประเภทของสิ่งที่ต้องทำ ----------
// แต่ละประเภทมีธรรมชาติต่างกัน จึงต้องให้ AI คิดคนละแบบ:
//   schedulable = ต้องเจียดเวลานั่งทำ (AI Planner จัดลงตารางให้)
//   prepHours   = ต้องเตรียมตัวล่วงหน้ากี่ชั่วโมง (สอบต้องอ่านก่อน ไม่ใช่เตือนวันสอบ)
const TASK_TYPES = {
  homework: { name: 'การบ้าน', icon: '📝', schedulable: true,  prepHours: 0,  dateLabel: 'ส่งวันที่', verb: 'ส่ง' },
  exam:     { name: 'สอบ',     icon: '📖', schedulable: true,  prepHours: 48, dateLabel: 'วันสอบ',   verb: 'สอบ' },
  activity: { name: 'กิจกรรม', icon: '🎯', schedulable: false, prepHours: 0,  dateLabel: 'วันที่จัด', verb: 'เริ่ม' },
  reminder: { name: 'อื่น ๆ',  icon: '📌', schedulable: false, prepHours: 0,  dateLabel: 'วันที่',    verb: 'ถึงกำหนด' },
};

// รองรับข้อมูลเก่าที่ยังไม่มีฟิลด์ type (เคยใช้ isExam)
function taskType(t) {
  if (t && TASK_TYPES[t.type]) return t.type;
  if (t && t.isExam) return 'exam';
  return 'homework';
}
function typeInfo(t) { return TASK_TYPES[taskType(t)]; }

// ---------- 0) เตรียมข้อความจากเสียงพูด ----------
// เสียงพูดมักได้เลขเป็นคำอ่าน ("ข้อหนึ่งถึงสิบ") ตัวแกะข้อความอ่านไม่ออก
// แปลงเฉพาะตำแหน่งที่มีคำนำหน้าชัดเจน เพื่อไม่ให้ไปโดนคำปกติ (เช่น "สี่แยก")
const THAI_DIGIT = { 'ศูนย์': 0, 'หนึ่ง': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5, 'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9 };
const THAI_D_PAT = Object.keys(THAI_DIGIT).join('|');
const THAI_NUM_PAT = `(?:(?:ยี่|${THAI_D_PAT})?สิบ(?:เอ็ด|${THAI_D_PAT})?|${THAI_D_PAT})`;

function thaiWordToNumber(w) {
  if (!w.includes('สิบ')) return THAI_DIGIT[w];
  const [tensPart, onesPart] = w.split('สิบ');
  let v = tensPart ? (tensPart === 'ยี่' ? 2 : THAI_DIGIT[tensPart]) * 10 : 10;
  if (onesPart) v += onesPart === 'เอ็ด' ? 1 : (THAI_DIGIT[onesPart] || 0);
  return v;
}

function normalizeSpokenText(text) {
  let t = String(text || '');
  // คำนำหน้า + เลขคำอ่าน  เช่น "ข้อหนึ่ง" "บทที่สี่" "ถึงสิบ" "วันที่ยี่สิบห้า"
  const lead = '(ข้อที่|ข้อ|บทที่|บท|หน้าที่|หน้า|ชุดที่|ถึง|วันที่|ที่)';
  t = t.replace(new RegExp(lead + '\\s*' + THAI_NUM_PAT, 'g'), (m, pre) => {
    const num = thaiWordToNumber(m.slice(pre.length).trim());
    return num == null || isNaN(num) ? m : pre + ' ' + num + ' ';
  });
  // เลขคำอ่าน + หน่วยต่อท้าย  เช่น "ยี่สิบเปอร์เซ็นต์" "สี่สิบนาที" "สองชั่วโมง"
  const unit = '(เปอร์เซ็นต์|%|นาที|ชั่วโมง|ชม\\.?|โมง|ทุ่ม|คะแนน|วัน)';
  t = t.replace(new RegExp(THAI_NUM_PAT + '\\s*' + unit, 'g'), (m, u) => {
    const num = thaiWordToNumber(m.slice(0, m.length - u.length).trim());
    return num == null || isNaN(num) ? m : ' ' + num + ' ' + u;
  });
  return t.replace(/\s+/g, ' ').trim();
}

// ---------- 0.5) เตรียมข้อความจาก OCR ----------
// โมเดลภาษาไทยของ Tesseract คืนค่ามาแบบเว้นวรรคทีละตัวอักษร ("ก า ร บ ้ า น เค ม ี")
// ถ้าส่งเข้าตัวแกะข้อความตรง ๆ จะหาคำว่า "เคมี" หรือ "พรุ่งนี้" ไม่เจอเลย —
// ยุบช่องว่างที่คั่นกลางอักษรไทยก่อน (ไทยไม่เว้นวรรคในคำ จึงยุบได้ไม่เสียความหมาย)
function normalizeOcrText(text) {
  return String(text || '')
    .replace(/[|¦]/g, ' ')                       // เส้นตารางในใบงานที่ OCR อ่านเป็นขีด
    .replace(/([฀-๿])[ \t]+(?=[฀-๿])/g, '$1')    // ยุบช่องว่างที่คั่นกลางอักษรไทย
    .replace(/ํา/g, 'ำ')          // ยุบแล้วค่อยแก้ "ํ+า" ให้เป็น "ำ" ตัวเดียว
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ---------- 1) แกะข้อความ ----------
function parseAssignment(text, now = new Date()) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const detected = {};

  // วิชา
  let subject = 'อื่น ๆ';
  const low = t.toLowerCase();
  outer:
  for (const s of SUBJECTS) {
    for (const k of s.keys) {
      if (low.includes(k.toLowerCase())) { subject = s.name; detected.subject = true; break outer; }
    }
  }

  // ครู (เอาเฉพาะชื่อ — หยุดที่ช่องว่างหรือคำที่ขึ้นความใหม่ ไม่ลากประโยคทั้งท่อนมา
  // สำคัญกับข้อความจาก OCR ที่ไม่มีช่องว่างคั่นคำเลย เช่น "ครูมาลีทำแบบฝึกหัด")
  let teacher = '';
  const nameEnd = 'ทำ|อ่าน|เขียน|สรุป|ท่อง|เตรียม|วาด|ส่ง|สอบ|แบบฝึกหัด|แบบ|บทที่|บท|ข้อ|หน้า|ใบงาน|คะแนน|ภายใน|เวลา|วันที่|วันนี้|พรุ่งนี้|มะรืน|สัปดาห์';
  const mT = t.match(new RegExp('(?:ครู|อาจารย์|อ\\.)\\s?([ก-๙A-Za-z]{2,20}?)(?=\\s|' + nameEnd + '|$)'));
  if (mT) { teacher = 'ครู' + mT[1].replace(/^ครู/, ''); detected.teacher = true; }

  // คะแนน
  let scorePct = null;
  const mS = t.match(/(\d{1,3})\s*(?:%|เปอร์เซ็นต์)/) || t.match(/คะแนน(?:เก็บ)?\s*(\d{1,3})/);
  if (mS) { scorePct = Math.min(100, parseInt(mS[1], 10)); detected.score = true; }

  // เวลา (16:00 / 16.00 น. / เที่ยง)
  let hh = 23, mm = 59, hasTime = false;
  const mTime = t.match(/(\d{1,2})[:.](\d{2})\s*(?:น\.?)?/);
  if (mTime && +mTime[1] <= 23 && +mTime[2] <= 59) { hh = +mTime[1]; mm = +mTime[2]; hasTime = true; }
  else if (/เที่ยง/.test(t)) { hh = 12; mm = 0; hasTime = true; }

  // วันส่ง
  let due = null;
  if (/วันนี้/.test(t)) due = atTime(now, hh, mm);
  else if (/พรุ่งนี้/.test(t)) due = atTime(addDays(now, 1), hh, mm);
  else if (/มะรืน/.test(t)) due = atTime(addDays(now, 2), hh, mm);
  else {
    // "วันศุกร์" / "ศุกร์หน้า"
    for (const [name, dow] of Object.entries(WEEKDAYS)) {
      const re = new RegExp('(?:วัน)?' + name + '(หน้า)?');
      const m = t.match(re);
      if (m) {
        let diff = (dow - now.getDay() + 7) % 7;
        if (diff === 0) diff = 7;              // "วันศุกร์" ในวันศุกร์ = ศุกร์ถัดไป
        if (m[1]) diff += 7;                    // "หน้า"
        due = atTime(addDays(now, diff), hh, mm);
        break;
      }
    }
  }
  if (!due) {
    // "25 ก.ค." / "วันที่ 25 กรกฎาคม"
    for (const [mon, idx] of Object.entries(THAI_MONTHS)) {
      const re = new RegExp('(?:วันที่\\s*)?(\\d{1,2})\\s*' + mon.replace('.', '\\.'));
      const m = t.match(re);
      if (m) {
        let d = new Date(now.getFullYear(), idx, +m[1], hh, mm);
        if (d < now) d = new Date(now.getFullYear() + 1, idx, +m[1], hh, mm);
        due = d;
        break;
      }
    }
  }
  if (!due) {
    const mIn = t.match(/ภายใน\s*(\d{1,2})\s*วัน/);
    if (mIn) due = atTime(addDays(now, +mIn[1]), hh, mm);
    else if (/สัปดาห์หน้า/.test(t)) due = atTime(addDays(now, 7), hh, mm);
  }
  // ทางสำรองสำหรับข้อความจากรูป: OCR มักทำวรรณยุกต์/สระหาย ("พรุ่งน่" แทน "พรุ่งนี้")
  // จับแบบตัดวรรณยุกต์กับสระบน-ล่างทิ้งทั้งสองฝ่าย — ใช้เฉพาะเมื่อจับตรงตัวไม่ได้
  // และเฉพาะคำบอกวันที่ยาวพอจะไม่ชนคำอื่น (ไม่รวมชื่อวันในสัปดาห์ที่สั้นเกินไป)
  if (!due) {
    // ตัดสระบน/ล่าง + วรรณยุกต์ (ไม่แตะ า ำ ที่เป็นสระเต็มตัว)
    const bare = s => s.replace(/[ัิ-ฺ็-๎]/g, '');
    const lt = bare(t);
    if (lt.includes(bare('วันนี้')))         due = atTime(now, hh, mm);
    else if (lt.includes(bare('พรุ่งนี้')))  due = atTime(addDays(now, 1), hh, mm);
    else if (lt.includes(bare('มะรืน')))     due = atTime(addDays(now, 2), hh, mm);
  }
  if (due) detected.due = true;

  // เวลาที่ใช้ทำ (นาที)
  let estMin = null;
  const mMin = t.match(/(\d{1,3})\s*นาที/);
  const mHr = t.match(/(\d{1,2}(?:\.\d)?)\s*(?:ชม\.?|ชั่วโมง)/);
  const mRange = t.match(/ข้อ\s*(\d{1,3})\s*[-–ถึง]+\s*(\d{1,3})/);
  if (mMin) estMin = +mMin[1];
  else if (mHr) estMin = Math.round(+mHr[1] * 60);
  else if (mRange) estMin = Math.max(10, (+mRange[2] - +mRange[1] + 1) * 4);
  if (estMin) detected.est = true;

  // ประเภท: เดาจากคำที่นักเรียนใช้จริง (ตรวจสอบก่อน เพราะกิจกรรมบางอย่างมีคำว่า "สอบ" ปนไม่ได้)
  let type = 'homework';
  if (/สอบ(?!ถาม)|quiz|test|มิดเทอม|ไฟนอล|กลางภาค|ปลายภาค/i.test(t)) type = 'exam';
  else if (/กิจกรรม|ประชุม|ซ้อม|แข่ง|เข้าค่าย|ค่าย|ทัศนศึกษา|ตักบาตร|เข้าแถว|พิธี|งานวัด|ชมรม|บำเพ็ญ|จิตอาสา|อบรม|สัมมนา|ไปงาน|นัด/i.test(t)) type = 'activity';
  else if (/เตือน|อย่าลืม|จำไว้|ติดต่อ|จ่ายเงิน|จ่ายค่า|ส่งเงิน/i.test(t) && !/การบ้าน|ทำ|เขียน|อ่าน/.test(t)) type = 'reminder';
  if (type !== 'homework') detected.type = true;
  const isExam = type === 'exam'; // เก็บไว้เพื่อความเข้ากันได้กับข้อมูลเก่า

  // รายละเอียด: ประโยคที่มี verb งาน — ตัดจบก่อนคำบอกกำหนดส่ง/คะแนน
  let detail = '';
  const mD = t.match(/((?:ทำ|อ่าน|สรุป|ท่อง|เตรียม|เขียน|วาด|สอบ|ประชุม|ซ้อม|แข่ง|อัด).{3,80}?)(?=\s*(?:ส่ง|ภายใน|คะแนน|ครู|เวลา|พรุ่งนี้|วันนี้|มะรืน|วันที่|$))/);
  if (mD) { detail = mD[1].trim(); detected.detail = true; }
  else detail = t.replace(/\s*(?:ส่ง|ภายใน|คะแนน)[^]*$/, '').trim().slice(0, 80) || t.slice(0, 80);
  // ตัดคำบอกเวลาท้ายประโยคออกจากชื่อเรื่อง (มันไปอยู่ในช่องวันที่แล้ว)
  detail = detail.replace(/\s*(?:เริ่ม)?(?:วันที่|วัน(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)|พรุ่งนี้|วันนี้|มะรืน|สัปดาห์หน้า)[^]*$/, '').trim();
  detail = detail.replace(/[\s(\-–—]+$/, ''); // ตัดวงเล็บ/ขีดค้างท้ายประโยค

  return {
    subject, teacher, scorePct,
    due: due ? due.toISOString() : null,
    estMin: estMin || (type === 'activity' || type === 'reminder' ? 15 : 30),
    type, isExam, detail, detected, raw: text,
  };
}

// ---------- 2) ลำดับความสำคัญ + เหตุผล ----------
function priorityInfo(task, now = new Date()) {
  const reasons = [];
  let score = 0;

  const due = task.due ? new Date(task.due) : null;
  const hoursLeft = due ? (due - now) / 3.6e6 : null;
  const type = taskType(task);
  const ti = TASK_TYPES[type];

  // สอบต้องเริ่มอ่านล่วงหน้า จึงนับ "เวลาที่เหลือจริง" ให้เร็วขึ้นตาม prepHours
  const effHours = hoursLeft == null ? null : hoursLeft - ti.prepHours;

  if (due) {
    if (type === 'activity' || type === 'reminder') {
      // เหตุการณ์ตามเวลา: ไม่ต้องเจียดเวลาทำล่วงหน้า ความด่วนพุ่งเฉพาะตอนใกล้ถึงเวลา
      if (hoursLeft < 0)        { score += 30; reasons.push('⚠ เลยเวลาแล้ว'); }
      else if (hoursLeft <= 3)  { score += 55; reasons.push('อีก ' + Math.max(1, Math.round(hoursLeft)) + ' ชม. ถึงเวลา'); }
      else if (hoursLeft <= 14) { score += 38; reasons.push('ถึงเวลาวันนี้'); }
      else if (hoursLeft <= 30) { score += 24; reasons.push('ถึงเวลาพรุ่งนี้'); }
      else                      { score += 6;  reasons.push('ยังอีกหลายวัน'); }
    } else if (effHours < 0 && hoursLeft >= 0) {
      // ถึงเวลาที่ควรเริ่มเตรียมตัวแล้ว (ใช้กับสอบเป็นหลัก)
      score += 46;
      reasons.push(type === 'exam' ? 'สอบใน ' + Math.max(1, Math.round(hoursLeft / 24)) + ' วัน — ควรเริ่มอ่านแล้ว' : 'ควรเริ่มได้แล้ว');
    } else if (hoursLeft < 0)        { score += 60; reasons.push('⚠ เลยกำหนดแล้ว'); }
    else if (effHours <= 6)  { score += 50; reasons.push(ti.verb + 'ภายใน ' + Math.max(1, Math.round(hoursLeft)) + ' ชม.'); }
    else if (effHours <= 30) { score += 40; reasons.push('ใกล้กำหนด' + (type === 'exam' ? 'สอบ' : 'ส่ง')); }
    else if (effHours <= 54) { score += 28; reasons.push(ti.verb + 'ใน 2 วัน'); }
    else if (effHours <= 24 * 7) { score += 14; reasons.push(ti.verb + 'ภายในสัปดาห์นี้'); }
    else                      { score += 5;  reasons.push('ยังพอมีเวลา'); }
  } else { score += 10; reasons.push('ยังไม่ระบุกำหนด'); }

  if (task.scorePct != null) {
    score += Math.min(30, task.scorePct);
    reasons.push('คะแนน ' + task.scorePct + '%');
  }
  if (type === 'exam') { score += 12; reasons.push('เป็นการสอบ'); }

  // เวลาที่ใช้ทำมีความหมายเฉพาะงานที่ต้องนั่งทำ — กิจกรรมไม่ต้องเจียดเวลา
  if (ti.schedulable) {
    if (task.estMin >= 90)      { score += 15; reasons.push((type === 'exam' ? 'อ่าน' : 'งานใหญ่') + ' ~' + Math.round(task.estMin / 60 * 10) / 10 + ' ชม. — ควรเริ่มก่อน'); }
    else if (task.estMin >= 45) { score += 9;  reasons.push('ใช้เวลา ~' + task.estMin + ' นาที'); }
    else                        { score += 4;  reasons.push('~' + task.estMin + ' นาที'); }
  }

  let stars = score >= 70 ? 5 : score >= 55 ? 4 : score >= 40 ? 3 : score >= 25 ? 2 : 1;

  // ผู้ใช้กำหนดความสำคัญเอง → เคารพการตัดสินใจของเขา (override AI)
  // ลำดับภายในดาวเท่ากัน: ใกล้ deadline กว่ามาก่อน
  if (task.userStars >= 1) {
    stars = task.userStars;
    score = task.userStars * 20
      + (hoursLeft != null ? Math.max(0, 15 - Math.max(0, hoursLeft) / 12) : 0);
    reasons.unshift('★ กำหนดความสำคัญเอง');
  }
  const urgency = (hoursLeft != null && hoursLeft < 0) ? 'over'
    : (hoursLeft != null && hoursLeft <= 30) ? 'hot'
    : (hoursLeft != null && hoursLeft <= 54) ? 'mid' : 'norm';

  return { score, stars, reasons, hoursLeft, urgency, type, typeInfo: ti };
}

function sortByPriority(tasks, now = new Date()) {
  return [...tasks].sort((a, b) => priorityInfo(b, now).score - priorityInfo(a, now).score);
}

// ---------- 3) ประโยคของ AI ----------
function aiGreeting(pending, settings, now = new Date()) {
  if (!pending.length) return 'ตอนนี้ไม่มีงานค้างเลย 🎉 ถ้าครูสั่งงานใหม่ กด Scan เพิ่มได้ทันที';

  const sorted = sortByPriority(pending, now);
  const top = sorted[0];
  const info = priorityInfo(top, now);
  const totalMin = pending.reduce((s, t) => s + (t.estMin || 30), 0);
  const totalH = Math.round(totalMin / 60 * 10) / 10;
  const freeH = settings.freeHours || 2;

  // สั้นเสมอ: 1 ประโยคบอกว่าทำอะไรก่อน + 1 วลีบอกว่าเวลาพอไหม
  if (info.urgency === 'over') return top.subject + 'เลยกำหนดแล้ว รีบเคลียร์ก่อนเลย';
  const why = (info.reasons[0] || '').replace(/^★ /, '');
  const fit = totalH > freeH
    ? 'งานรวม ~' + totalH + ' ชม. เกินเวลาว่าง เลือกทำเฉพาะงานด่วน'
    : 'งานรวม ~' + totalH + ' ชม. เวลาว่างพอสบาย';
  return 'เริ่มที่' + top.subject + 'ก่อน — ' + why + ' · ' + fit;
}

function timelineInsight(pending, now = new Date()) {
  const byDay = {};
  for (const t of pending) {
    if (!t.due) continue;
    const d = new Date(t.due);
    const diff = Math.floor((atTime(d, 0, 0) - atTime(now, 0, 0)) / 8.64e7);
    if (diff < 0 || diff > 7) continue;
    (byDay[diff] = byDay[diff] || []).push(t);
  }
  for (const [diff, list] of Object.entries(byDay).sort((a, b) => a[0] - b[0])) {
    if (list.length >= 2) {
      const d = addDays(now, +diff);
      const dayName = +diff === 0 ? 'วันนี้' : +diff === 1 ? 'พรุ่งนี้' : 'วัน' + THAI_DAY[d.getDay()];
      const biggest = list.reduce((a, b) => (a.estMin > b.estMin ? a : b));
      return dayName + 'มีงานชน ' + list.length + ' งาน — แนะนำเริ่ม ' + biggest.subject + ' (งานใหญ่สุด) ล่วงหน้าตั้งแต่วันนี้';
    }
  }
  return null;
}

// ---------- 4) AI Planner: จัดงานลงช่วงเวลาว่างของวันนี้ ----------
// หลัก: เรียงตาม priority → หั่นลงเวลาว่าง (จาก settings.freeHours)
// งานใหญ่เกิน 50 นาทีแทรกพัก 10 นาที · เวลาไม่พอ → บอกตรง ๆ ว่างานไหนต้องย้ายวัน
function buildDayPlan(pending, settings, now = new Date()) {
  // กิจกรรม/เตือนความจำ = เหตุการณ์ตามเวลา ไม่ต้องเจียดเวลานั่งทำ
  // แยกออกมาแสดงเป็นหมุดเวลาแทน ไม่เอาไปกินเวลาอ่านหนังสือ
  const schedulable = pending.filter(t => TASK_TYPES[taskType(t)].schedulable);
  const events = pending
    .filter(t => !TASK_TYPES[taskType(t)].schedulable && t.due)
    .filter(t => { const h = (new Date(t.due) - now) / 3.6e6; return h > -2 && h <= 24; })
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  const sorted = sortByPriority(schedulable, now);
  const freeMin = Math.round((settings.freeHours || 2) * 60);

  // เริ่มแผน: ถ้ายังไม่ถึงเวลาทำการบ้านปกติ (19:00) ให้เริ่ม 19:00, ถ้าเลยแล้วเริ่มตอนนี้
  let cursor = new Date(now);
  const evening = atTime(now, 19, 0);
  if (cursor < evening) cursor = evening;
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / 5) * 5, 0, 0);

  const slots = [], overflow = [];
  let remaining = freeMin, sinceBreak = 0;

  for (const t of sorted) {
    // เหลืองานจริงเท่าไหร่ตาม progress ที่ทำไปแล้ว
    const need = Math.max(10, Math.round((t.estMin || 30) * (1 - (t.progress || 0) / 100)));
    if (remaining < 10) { overflow.push({ task: t, need }); continue; }

    const use = Math.min(need, remaining);
    const start = new Date(cursor);
    cursor = new Date(cursor.getTime() + use * 60000);
    slots.push({
      task: t, start, end: new Date(cursor), min: use,
      partial: use < need,
      note: use < need ? 'ทำบางส่วน (' + use + '/' + need + ' นาที) ที่เหลือย้ายพรุ่งนี้'
        : (t.progress ? 'ต่อจากที่ทำไว้ ' + t.progress + '%' : null),
    });
    remaining -= use;
    sinceBreak += use;

    if (sinceBreak >= 50 && remaining >= 15) {
      const bs = new Date(cursor);
      cursor = new Date(cursor.getTime() + 10 * 60000);
      slots.push({ break: true, start: bs, end: new Date(cursor), min: 10 });
      sinceBreak = 0;
    }
  }
  return { slots, overflow, events, freeMin, usedMin: freeMin - remaining };
}

function fmtClock(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ป้ายระดับความสำคัญ (แทนดาว 5 ดวง) — ชื่อ + คลาสสีตามระดับ
const PRIORITY_LABELS = { 5: 'ด่วนมาก', 4: 'สำคัญ', 3: 'ปานกลาง', 2: 'ไม่เร่ง', 1: 'รอได้' };
function priorityLabel(stars) { return PRIORITY_LABELS[stars] || 'ปานกลาง'; }

// สีของระดับความสำคัญ — ใช้แค่ 3 สี (แดง/เหลือง/เขียว) เพราะสายตาแยกได้ทันทีว่า
// "ทำเลย / เร็ว ๆ นี้ / รอได้" ส่วนคำบนป้ายยังบอกละเอียด 5 ระดับเหมือนเดิม
// สีชุดนี้คงที่ทุกธีม เพื่อให้ความหมายไม่เปลี่ยนตามโทนสีที่ผู้ใช้เลือก
function priorityTone(stars) { return stars >= 5 ? 'red' : stars >= 3 ? 'yellow' : 'green'; }

// ---------- format ----------
// task ใส่มาด้วยได้ เพื่อเลือกคำนำหน้าให้ตรงประเภท (ส่ง / สอบ / ไม่มีคำนำหน้า)
function fmtDue(iso, now = new Date(), task) {
  if (!iso) return 'ยังไม่ระบุกำหนด';
  const type = task ? taskType(task) : 'homework';
  const pre = type === 'homework' ? 'ส่ง' : type === 'exam' ? 'สอบ' : '';
  const d = new Date(iso);
  const diff = Math.floor((atTime(d, 0, 0) - atTime(now, 0, 0)) / 8.64e7);
  const time = (d.getHours() === 23 && d.getMinutes() === 59) ? '' :
    ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d < now) return '⚠ เลยกำหนด (' + WEEKDAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()] + ')';
  if (diff === 0) return pre + 'วันนี้' + time;
  if (diff === 1) return pre + 'พรุ่งนี้' + time;
  // เว้นวรรคหลังคำนำหน้า ไม่งั้นได้ "สอบพ. 29 ก.ค." ที่อ่านสะดุด
  return (pre ? pre + ' ' : '') + WEEKDAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()] + time;
}

function fmtThaiDate(d = new Date()) {
  return WEEKDAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
