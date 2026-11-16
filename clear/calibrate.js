// ============================================================
// calibrate — "คำทำนายของแอปแม่นแค่ไหน"  ·  *** ALT ***
// ------------------------------------------------------------
// เฟส 4–5 ของการรื้อเอนจินตัดสินใจ · ชั้นที่ปิดวงจรทั้งหมด
//
// ทั้งโปรเจกต์นี้เริ่มจากข้อสังเกตข้อเดียว: `score` ของ priorityInfo() ไม่มีหน่วย
// จึงไม่มีทางผิด และของที่ผิดไม่ได้ก็เก่งขึ้นอย่างเป็นระบบไม่ได้
//
// ตั้งแต่เฟส 1 แอปเริ่มพูดสิ่งที่ **ผิดได้**: "โอกาสเสร็จทัน 68%"
// ไฟล์นี้คือที่ที่มันถูกจับผิด — บันทึกคำทำนายไว้ แล้วพอความจริงมาถึงก็ให้คะแนนตัวเอง
//
// ------------------------------------------------------------
// ทำไมต้องเป็น Brier score
//
// ทำนายว่า 70% แล้วเกิดขึ้นจริง ไม่ได้แปลว่าทำนายถูก และไม่เกิดก็ไม่ได้แปลว่าผิด
// คำทำนายความน่าจะเป็นวัดกันทีละครั้งไม่ได้ ต้องวัดทั้งชุด:
//
//     Brier = ค่าเฉลี่ยของ (p − ผลจริง)²        ต่ำ = ดี · 0.25 = เดาสุ่ม
//
// คนทำนายที่บอก 70% แล้วเกิดจริง 7 ใน 10 ครั้ง ได้คะแนนดีกว่าคนที่บอก 99% ทุกครั้ง
// ซึ่งตรงกับสิ่งที่เราอยากได้พอดี: **แอปที่รู้ตัวว่าไม่รู้**
//
// ------------------------------------------------------------
// กติกาสองข้อ
//   1. บันทึกวันละครั้งต่องานหนึ่งใบ — ไม่ใช่ทุกครั้งที่วาดจอ
//      ไม่งั้นงานใบเดียวจะถูกนับเป็นคำทำนายหลายร้อยครั้งแล้วกลบทุกอย่างที่เหลือ
//   2. ไม่โชว์ตัวเลขจนกว่าจะมีคำทำนายที่รู้ผลแล้วมากพอ (กติกาเดียวกับ brain.js)
// ============================================================

const CALIB_CAP = 80;          // เก็บไว้เท่านี้พอ · ซิงก์ขึ้น cloud ด้วย อย่าให้บวม
const CALIB_MIN_SCORED = 8;    // ต่ำกว่านี้ยังไม่พูดเป็นตัวเลข

function calibStore(state) {
  state.settings = state.settings || {};
  if (!state.settings.calib) state.settings.calib = { log: [] };
  if (!Array.isArray(state.settings.calib.log)) state.settings.calib.log = [];
  return state.settings.calib;
}

function calibDayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

// ---------- บันทึกคำทำนายหนึ่งครั้ง ----------
// เรียกจากที่เดียว: ตอนแอปคำนวณความเสี่ยงของทั้งกองเสร็จ (ดู riskFor ใน app.js)
// คืน true เมื่อบันทึกจริง — ผู้เรียกจะได้รู้ว่าต้อง save() ไหม
function calibLog(state, rec, now = new Date()) {
  if (!state || !rec || !rec.task || rec.overdue) return false;
  // งานที่จบไปแล้วหรือไม่มีกำหนด ไม่มีอะไรให้ทำนาย
  if (rec.task.done || !rec.task.due) return false;
  const c = calibStore(state);
  const key = rec.task.id + '|' + calibDayKey(now);
  if (c.log.some(e => e.k === key)) return false;

  c.log.push({
    k: key,
    id: rec.task.id,
    at: now.toISOString(),
    due: rec.task.due,
    p: rec.odds,                       // ทำนายว่าจะเสร็จทันด้วยความน่าจะเป็นเท่านี้
    need: rec.needMin,                 // และคิดว่าต้องใช้เวลาเท่านี้
    o: null,                           // ผลจริง · null = ยังไม่รู้
  });
  if (c.log.length > CALIB_CAP) c.log = c.log.slice(-CALIB_CAP);
  return true;
}

// ---------- เก็บผลจริงของคำทำนายที่ถึงกำหนดแล้ว ----------
// "ทัน" = ทำเสร็จก่อนหรือตรงกำหนด · ไม่เสร็จแล้วเลยกำหนด = ไม่ทัน
// งานที่ถูกลบทิ้งไม่นับทั้งสองทาง — ลบไม่ใช่การพลาด และไม่ใช่การทำเสร็จ
function calibResolve(state, now = new Date()) {
  const c = calibStore(state);
  const byId = {};
  for (const t of (state.tasks || [])) byId[t.id] = t;
  let changed = false;

  for (const e of c.log) {
    if (e.o != null) continue;
    const t = byId[e.id];
    if (!t || t.deleted) { e.o = -1; changed = true; continue; }   // -1 = ไม่นับ
    const due = new Date(e.due);
    if (t.done) {
      const at = t.doneAt ? new Date(t.doneAt) : now;
      e.o = at <= due ? 1 : 0;
      changed = true;
    } else if (due < now) {
      e.o = 0;
      changed = true;
    }
  }
  return changed;
}

// ---------- สรุปว่าแม่นแค่ไหน ----------
// คืน null เมื่อหลักฐานยังไม่พอ — ตัวเลขความแม่นที่คำนวณจากสามครั้งคือตัวเลขที่หลอกตัวเอง
function calibSummary(state) {
  const c = calibStore(state);
  const done = c.log.filter(e => e.o === 0 || e.o === 1);
  if (done.length < CALIB_MIN_SCORED) {
    return { ready: false, scored: done.length, need: CALIB_MIN_SCORED - done.length };
  }
  const brier = done.reduce((a, e) => a + (e.p - e.o) * (e.p - e.o), 0) / done.length;

  // ---- การสอบเทียบแบบที่คนอ่านรู้เรื่อง ----
  // "ตอนแอปบอกว่าน่าจะทัน มันทันจริงกี่ครั้ง" ตรงไปตรงมากว่า Brier มาก
  // และเป็นคำถามที่ผู้ใช้ถามเองอยู่แล้วตอนตัดสินใจว่าจะเชื่อตัวเลขบนจอไหม
  const hi = done.filter(e => e.p >= 0.7);
  const lo = done.filter(e => e.p < 0.5);
  const hiHit = hi.filter(e => e.o === 1).length;
  const loMiss = lo.filter(e => e.o === 0).length;

  // ครึ่งแรกเทียบครึ่งหลัง — แม่นขึ้นหรือแย่ลง · ต้องมีข้อมูลพอทั้งสองครึ่ง
  let trend = null;
  if (done.length >= 2 * CALIB_MIN_SCORED) {
    const half = Math.floor(done.length / 2);
    const b = list => list.reduce((a, e) => a + (e.p - e.o) * (e.p - e.o), 0) / list.length;
    trend = { before: b(done.slice(0, half)), after: b(done.slice(half)) };
  }

  return {
    ready: true, scored: done.length, brier,
    hi: hi.length, hiHit, lo: lo.length, loMiss, trend,
  };
}

// ---------- ประโยคเดียวที่เอาไปโชว์ได้ ----------
// ไม่แปลง Brier เป็น "แม่น XX%" เพราะมันไม่ใช่เปอร์เซ็นต์ความแม่น และการแปลงแบบนั้น
// คือการทำตัวเลขให้ดูดีกว่าที่มันเป็น ซึ่งเป็นสิ่งเดียวที่ไฟล์นี้มีไว้เพื่อไม่ทำ
function calibText(state) {
  const s = calibSummary(state);
  if (!s.ready) return null;
  const bits = [];
  if (s.hi >= 3) bits.push('ตอนแอปบอกว่าน่าจะทัน ทันจริง ' + s.hiHit + ' ใน ' + s.hi + ' ครั้ง');
  if (s.lo >= 3) bits.push('ตอนบอกว่าเสี่ยง พลาดจริง ' + s.loMiss + ' ใน ' + s.lo + ' ครั้ง');
  if (!bits.length) return null;
  let tx = bits.join(' · ');
  if (s.trend && s.trend.after < s.trend.before - 0.02) tx += ' · เดือนนี้แม่นขึ้นกว่าเดิม';
  else if (s.trend && s.trend.after > s.trend.before + 0.02) tx += ' · ช่วงนี้ยังทำนายพลาดอยู่บ้าง';
  return tx;
}

// ป้ายคุณภาพสั้น ๆ — ใช้กำกับตัวเลขบนจอ ไม่ใช่ใช้แทนประโยค
// 0.25 คือคะแนนของการเดาสุ่ม ทุกอย่างต้องเทียบกับเส้นนั้น
function calibGrade(brier) {
  if (brier <= 0.10) return 'แม่นมาก';
  if (brier <= 0.18) return 'ใช้ได้';
  if (brier <= 0.25) return 'ยังไม่ดีกว่าการเดา';
  return 'แย่กว่าการเดา';
}
