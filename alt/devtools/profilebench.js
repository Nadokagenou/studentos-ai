(function () {
if (typeof window !== 'undefined' && window.__profilebench) { console.log('[profilebench] โหลดไว้อยู่แล้ว'); return; }
// ============================================================
// StudentOS ALT — เครื่องมือวัดผล profile.js / calibrate.js (เครื่องมือนักพัฒนา)
//
// **ไฟล์นี้ไม่ถูกโหลดโดยแอป** — ไม่อยู่ใน index.html และไม่อยู่ใน SHELL ของ sw.js
//
// ทำไมต้องมี: สองไฟล์นี้ตัดสินว่าแอป "เชื่ออะไรเกี่ยวกับผู้ใช้" ซึ่งไหลไปทุกตัวเลขบนจอ
// เชื่อผิดเมื่อไหร่ ทั้งแอปผิดพร้อมกันหมดโดยไม่มีอะไรบนจอบอกว่าผิด
//
// วิธีใช้:  benchProfile()
// ============================================================

const NOW = new Date(2026, 8, 11, 19, 0, 0);      // ศุกร์ 19:00
const AT = (d, h, m = 0) => { const x = new Date(NOW); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x; };

// รอบจับเวลาเมื่อ d วันก่อน เวลา h:00 ยาว min นาที
const SESS = (d, h, min) => {
  const st = AT(-d, h);
  return { id: 's' + d + '-' + h, taskId: 't1', start: st.toISOString(),
    end: new Date(st.getTime() + min * 60000).toISOString(), min };
};
const CALIB = (i, p, o) => ({ k: 'k' + i, id: 'k' + i, at: NOW.toISOString(),
  due: AT(-1, 8).toISOString(), p, need: 60, o });

function benchProfile() {
  if (typeof studyProfile !== 'function' || typeof calibSummary !== 'function') {
    console.error('[profilebench] ยังไม่ได้โหลด profile.js / calibrate.js'); return null;
  }
  const rows = [], fails = [];
  const check = (g, name, fn) => {
    let bad = [], note = '';
    try { note = fn(m => bad.push(m)) || ''; } catch (e) { bad.push('ระเบิด: ' + e.message); }
    const row = { กลุ่ม: g, เคส: name, ผล: bad.length ? '✗' : '✓', ได้: note };
    rows.push(row);
    if (bad.length) fails.push({ ...row, ที่ผิด: bad.join(' · ') });
  };

  // ---- profile ----
  check('เงียบไว้ก่อน', 'ไม่มีรอบจับเวลาเลย ต้องถอยไปค่ากลาง ห้ามประกาศว่าเรียนรู้แล้ว', bad => {
    const p = studyProfile({ sessions: [] }, NOW);
    if (p.learned) bad('learned = true ทั้งที่ไม่มีข้อมูล');
    if (Math.abs(p.rate - FOLLOW_RATE_PRIOR) > 1e-9) bad('rate ไม่ใช่ค่ากลาง: ' + p.rate);
    if (profileText(p) !== null) bad('พูดทั้งที่ยังไม่รู้จริง');
    return 'rate ' + p.rate;
  });

  check('เงียบไว้ก่อน', 'มีรอบจับเวลาน้อยกว่าเกณฑ์ ก็ยังต้องเงียบ', bad => {
    const s = [SESS(1, 19, 60), SESS(2, 19, 60), SESS(3, 19, 60)];
    const p = studyProfile({ sessions: s }, NOW);
    if (p.learned) bad('เชื่อเร็วเกินไป (' + p.days + ' วัน)');
    return p.days + ' วัน';
  });

  check('ห้ามเดาแทนความเงียบ', 'วันที่ไม่กดจับเวลา ห้ามนับเป็น "วันที่ไม่ได้ทำงาน"', bad => {
    // ทำจริงทุกวันแต่กดจับเวลาแค่ 6 วัน — อัตราต้องไม่ร่วงเพราะอีก 15 วันเงียบ
    // (บั๊กจริงที่เจอตอนทำ 1B78: ไม่เคยกดเลยสักครั้ง แล้วได้ rate 0.16 + learned:true)
    const s = [];
    for (let d = 1; d <= 6; d++) s.push(SESS(d, 19, 180));   // เต็มช่วงค่ำ
    const p = studyProfile({ sessions: s }, NOW);
    if (!p.learned) bad('ควรเรียนรู้ได้แล้วจาก 6 วัน');
    if (p.days !== 6) bad('นับวันผิด: ' + p.days + ' (ควรนับเฉพาะวันที่มีหลักฐาน)');
    if (p.rate < 0.6) bad('อัตราร่วงเพราะวันที่เงียบ: ' + p.rate.toFixed(2));
    return p.days + ' วัน · rate ' + p.rate.toFixed(2);
  });

  check('พื้นกับเพดาน', 'อัตราต้องไม่หลุดพื้น แม้ข้อมูลจะชี้ต่ำมาก', bad => {
    const s = [];
    for (let d = 1; d <= 14; d++) s.push(SESS(d, 19, 6));    // กดแค่หกนาทีต่อวัน
    const p = studyProfile({ sessions: s }, NOW);
    if (p.rate < RATE_FLOOR - 1e-9) bad('หลุดพื้น: ' + p.rate.toFixed(2));
    if (p.rate > 0.6) bad('ไม่ได้ลดลงเลยทั้งที่ข้อมูลชี้ต่ำ: ' + p.rate.toFixed(2));
    return 'rate ' + p.rate.toFixed(2);
  });

  check('ไหลเข้าเอนจิน', 'อัตราที่เรียนมาต้องเปลี่ยนคำตอบของ riskReport จริง', bad => {
    const tasks = [{ id: 't1', subject: 'ฟิสิกส์', detail: 'รายงาน', estMin: 200, progress: 0,
      type: 'homework', scorePct: 20, due: AT(2, 8).toISOString(), done: false, deleted: false }];
    const s = [];
    for (let d = 1; d <= 14; d++) s.push(SESS(d, 19, 40));
    const a = riskReport(tasks, NOW, { state: { sessions: [], tasks } })[0];
    const b = riskReport(tasks, NOW, { state: { sessions: s, tasks } })[0];
    if (Math.abs(a.rate - FOLLOW_RATE_PRIOR) > 1e-9) bad('ฝั่งไม่มีประวัติไม่ได้ใช้ค่ากลาง');
    if (b.rate >= a.rate) bad('ประวัติที่ชี้ว่าทำน้อย กลับไม่ทำให้อัตราลดลง');
    if (b.odds >= a.odds) bad('โอกาสไม่ได้ลดตามอัตราที่เรียนมา');
    return Math.round(a.odds * 100) + '% → ' + Math.round(b.odds * 100) + '%';
  });

  // ---- calibrate ----
  check('สอบเทียบ', 'หลักฐานไม่พอ ต้องไม่พูดเป็นตัวเลข', bad => {
    const st = { tasks: [], sessions: [], settings: {} };
    calibStore(st).log.push(CALIB(0, 0.8, 1));
    if (calibSummary(st).ready) bad('ประกาศทั้งที่มีใบเดียว');
    if (calibText(st) !== null) bad('พูดทั้งที่ยังไม่พอ');
    return 'เงียบ';
  });

  check('สอบเทียบ', 'ทำนายแม่น ต้องได้ Brier ต่ำ', bad => {
    const st = { tasks: [], sessions: [], settings: {} };
    const log = calibStore(st).log;
    for (let i = 0; i < 6; i++) log.push(CALIB('a' + i, 0.85, i < 5 ? 1 : 0));
    for (let i = 0; i < 6; i++) log.push(CALIB('b' + i, 0.25, i < 5 ? 0 : 1));
    const s = calibSummary(st);
    if (!s.ready) bad('ยังไม่ยอมประกาศทั้งที่มี 12 ใบ');
    if (s.brier > 0.2) bad('Brier สูงเกินไป: ' + s.brier.toFixed(3));
    return 'Brier ' + s.brier.toFixed(3) + ' · ' + calibGrade(s.brier);
  });

  check('สอบเทียบ', 'มั่นใจเกินจริง ต้องถูกจับได้ว่าแย่กว่าการเดา', bad => {
    const st = { tasks: [], sessions: [], settings: {} };
    const log = calibStore(st).log;
    for (let i = 0; i < 12; i++) log.push(CALIB('c' + i, 0.97, i < 6 ? 1 : 0));
    const s = calibSummary(st);
    if (s.brier <= 0.25) bad('ปล่อยผ่านคนที่บอก 97% แล้วถูกครึ่งเดียว: ' + s.brier.toFixed(3));
    if (calibGrade(s.brier) !== 'แย่กว่าการเดา') bad('ป้ายไม่ตรง: ' + calibGrade(s.brier));
    return 'Brier ' + s.brier.toFixed(3);
  });

  check('สอบเทียบ', 'บันทึกซ้ำวันเดียวกันต้องไม่นับสองครั้ง', bad => {
    const st = { tasks: [], sessions: [], settings: {} };
    const rec = { task: { id: 'z', due: AT(2, 8).toISOString(), done: false },
      odds: 0.6, needMin: 60, overdue: false };
    const a = calibLog(st, rec, NOW), b = calibLog(st, rec, NOW);
    if (!a) bad('ครั้งแรกไม่ยอมบันทึก');
    if (b) bad('บันทึกซ้ำในวันเดียวกัน');
    if (calibStore(st).log.length !== 1) bad('จำนวนรายการผิด: ' + calibStore(st).log.length);
    return '1 รายการ';
  });

  check('สอบเทียบ', 'งานที่เลยกำหนดแล้วยังไม่เสร็จ ต้องถูกบันทึกว่าพลาด', bad => {
    const t = { id: 'p1', due: AT(-1, 8).toISOString(), done: false, deleted: false };
    const st = { tasks: [t], sessions: [], settings: {} };
    calibStore(st).log.push({ k: 'p1|x', id: 'p1', at: NOW.toISOString(),
      due: t.due, p: 0.7, need: 60, o: null });
    calibResolve(st, NOW);
    if (calibStore(st).log[0].o !== 0) bad('ผลจริงไม่ใช่ 0: ' + calibStore(st).log[0].o);
    return 'พลาด';
  });

  check('สอบเทียบ', 'งานที่ถูกลบ ต้องไม่ถูกนับทั้งสองทาง', bad => {
    const t = { id: 'p2', due: AT(-1, 8).toISOString(), done: false, deleted: true };
    const st = { tasks: [t], sessions: [], settings: {} };
    calibStore(st).log.push({ k: 'p2|x', id: 'p2', at: NOW.toISOString(),
      due: t.due, p: 0.7, need: 60, o: null });
    calibResolve(st, NOW);
    const o = calibStore(st).log[0].o;
    if (o === 0 || o === 1) bad('นับงานที่ถูกลบเป็นผลจริง');
    return 'ไม่นับ';
  });

  const pass = rows.filter(r => r.ผล === '✓').length;
  console.table(fails.length ? fails : rows);
  console.log(`[profilebench] ผ่าน ${pass}/${rows.length}`);
  return { rows, fails, pass, total: rows.length };
}

if (typeof window !== 'undefined') {
  Object.assign(window, { NOW_PROFILE: NOW, benchProfile });
  window.__profilebench = true;
  console.log('[profilebench] พร้อมแล้ว — benchProfile()');
}
})();
