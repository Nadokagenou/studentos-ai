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

  // ครู (เอาเฉพาะคำแรกหลังคำว่า "ครู" — กันดึงคำอื่นติดมา)
  let teacher = '';
  const mT = t.match(/(?:ครู|อาจารย์|อ\.)\s?([ก-๙A-Za-z]{2,})/);
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

  // สอบไหม
  const isExam = /สอบ|quiz|test/i.test(t);

  // รายละเอียด: ประโยคที่มี verb งาน — ตัดจบก่อนคำบอกกำหนดส่ง/คะแนน
  let detail = '';
  const mD = t.match(/((?:ทำ|อ่าน|สรุป|ท่อง|เตรียม|เขียน|วาด).{3,80}?)(?=\s*(?:ส่ง|ภายใน|คะแนน|ครู|เวลา|พรุ่งนี้|วันนี้|มะรืน|วันที่|$))/);
  if (mD) { detail = mD[1].trim(); detected.detail = true; }
  else detail = t.replace(/\s*(?:ส่ง|ภายใน|คะแนน)[^]*$/, '').trim().slice(0, 80) || t.slice(0, 80);
  detail = detail.replace(/[\s(\-–—]+$/, ''); // ตัดวงเล็บ/ขีดค้างท้ายประโยค

  return {
    subject, teacher, scorePct,
    due: due ? due.toISOString() : null,
    estMin: estMin || 30,
    isExam, detail, detected, raw: text,
  };
}

// ---------- 2) ลำดับความสำคัญ + เหตุผล ----------
function priorityInfo(task, now = new Date()) {
  const reasons = [];
  let score = 0;

  const due = task.due ? new Date(task.due) : null;
  const hoursLeft = due ? (due - now) / 3.6e6 : null;

  if (due) {
    if (hoursLeft < 0)        { score += 60; reasons.push('⚠ เลยกำหนดแล้ว'); }
    else if (hoursLeft <= 6)  { score += 50; reasons.push('ส่งภายใน ' + Math.max(1, Math.round(hoursLeft)) + ' ชม.'); }
    else if (hoursLeft <= 30) { score += 40; reasons.push('ใกล้กำหนดส่ง'); }
    else if (hoursLeft <= 54) { score += 28; reasons.push('ส่งใน 2 วัน'); }
    else if (hoursLeft <= 24 * 7) { score += 14; reasons.push('ส่งภายในสัปดาห์นี้'); }
    else                      { score += 5;  reasons.push('ยังพอมีเวลา'); }
  } else { score += 10; reasons.push('ยังไม่ระบุกำหนดส่ง'); }

  if (task.scorePct != null) {
    score += Math.min(30, task.scorePct);
    reasons.push('คะแนน ' + task.scorePct + '%');
  }
  if (task.isExam) { score += 15; reasons.push('เป็นการสอบ'); }

  if (task.estMin >= 90)      { score += 15; reasons.push('งานใหญ่ ~' + Math.round(task.estMin / 60 * 10) / 10 + ' ชม. — ควรเริ่มก่อน'); }
  else if (task.estMin >= 45) { score += 9;  reasons.push('ใช้เวลา ~' + task.estMin + ' นาที'); }
  else                        { score += 4;  reasons.push('~' + task.estMin + ' นาที'); }

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

  return { score, stars, reasons, hoursLeft, urgency };
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

  let msg = '';
  if (info.urgency === 'over') {
    msg = 'งาน' + top.subject + 'เลยกำหนดแล้ว — รีบจัดการก่อนเป็นอันดับแรก';
  } else {
    msg = 'ตอนนี้มีงานค้าง ' + pending.length + ' งาน แนะนำเริ่ม ' + top.subject + ' ก่อน — ' + info.reasons[0]
      + (top.scorePct != null ? ' และคะแนนสูง' : '');
  }
  msg += ' งานทั้งหมดใช้เวลารวม ~' + totalH + ' ชม. '
    + (totalH <= freeH ? 'เวลาว่างวันนี้ (' + freeH + ' ชม.) เพียงพอ' : 'มากกว่าเวลาว่างวันนี้ — ทำเฉพาะงานด่วนก่อน');
  return msg;
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
      const dayName = +diff === 0 ? 'วันนี้' : +diff === 1 ? 'พรุ่งนี้' : 'วัน' + ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'][d.getDay()];
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
  const sorted = sortByPriority(pending, now);
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
  return { slots, overflow, freeMin, usedMin: freeMin - remaining };
}

function fmtClock(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ---------- format ----------
function fmtDue(iso, now = new Date()) {
  if (!iso) return 'ยังไม่ระบุกำหนดส่ง';
  const d = new Date(iso);
  const diff = Math.floor((atTime(d, 0, 0) - atTime(now, 0, 0)) / 8.64e7);
  const time = (d.getHours() === 23 && d.getMinutes() === 59) ? '' :
    ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d < now) return '⚠ เลยกำหนด (' + WEEKDAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()] + ')';
  if (diff === 0) return 'ส่งวันนี้' + time;
  if (diff === 1) return 'ส่งพรุ่งนี้' + time;
  return 'ส่ง' + WEEKDAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()] + time;
}

function fmtThaiDate(d = new Date()) {
  return WEEKDAY_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
