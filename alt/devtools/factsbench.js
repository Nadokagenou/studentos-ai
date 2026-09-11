(function () {
if (typeof window !== 'undefined' && window.__factsbench) { console.log('[factsbench] โหลดไว้อยู่แล้ว'); return; }
// ============================================================
// StudentOS ALT — เครื่องมือวัดผล facts.js + ความสามารถใหม่ของ decide.js (1B80)
//
// **ไฟล์นี้ไม่ถูกโหลดโดยแอป** — ไม่อยู่ใน index.html และไม่อยู่ใน SHELL ของ sw.js
//
// ครอบห้าเรื่องที่เพิ่มเข้ามาในชั้น L0 และผลของมันที่ไหลไปทั้งเอนจิน:
//   งานที่ต้องทำก่อน (W5) · นโยบายส่งช้า · ดาวของผู้ใช้เป็นหลักฐาน (W10) ·
//   ยอมทิ้งใบไหน (triage) · ซ้อมรับมือ (pre-mortem)
//
// วิธีใช้:  benchFacts()
// ============================================================

const NOW = new Date(2026, 8, 8, 19, 10, 0);      // อังคาร 19:10
const AT = (d, h = 8) => { const x = new Date(NOW); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x; };
const SLOT = (d, h1, m1, h2, m2) => {
  const start = AT(d, 0), end = AT(d, 0);
  start.setHours(h1, m1, 0, 0); end.setHours(h2, m2, 0, 0);
  return { start, end, min: Math.round((end - start) / 60000), used: 0 };
};
const TL = () => [
  SLOT(0, 19, 10, 21, 30), SLOT(1, 17, 30, 21, 30), SLOT(2, 17, 30, 21, 30),
  SLOT(3, 17, 30, 21, 30), SLOT(4, 14, 0, 21, 30), SLOT(5, 14, 0, 21, 30),
  SLOT(6, 17, 30, 21, 30), SLOT(7, 17, 30, 21, 30),
];
const T = o => Object.assign({
  id: o.id || o.name, subject: o.name, detail: o.detail || o.name, type: 'homework',
  estMin: 60, progress: 0, scorePct: null, snoozeCount: 0, done: false, deleted: false,
}, o, { due: AT(o.dd).toISOString() });

const OPT = () => ({ timeline: TL(), riskTimeline: TL() });
const ST = tasks => ({ tasks, sessions: [], settings: {} });

function benchFacts() {
  if (typeof taskFacts !== 'function' || typeof decide !== 'function') {
    console.error('[factsbench] ยังไม่ได้โหลด facts.js / decide.js'); return null;
  }
  const rows = [], fails = [];
  const check = (g, name, fn) => {
    const bad = []; let note = '';
    try { note = fn(m => bad.push(m)) || ''; } catch (e) { bad.push('ระเบิด: ' + e.message); }
    const row = { กลุ่ม: g, เคส: name, ผล: bad.length ? '✗' : '✓', ได้: note };
    rows.push(row);
    if (bad.length) fails.push({ ...row, ที่ผิด: bad.join(' · ') });
  };

  // ---------- L0: เดาธรรมชาติของงานจากสิ่งที่รู้อยู่แล้ว ----------
  check('เดาให้ถูก', 'โจทย์เลข = ต้องต่อความคิด · ระบายสี = ทำเพลิน ๆ ได้', bad => {
    const a = taskFacts(T({ name: 'คณิตศาสตร์', detail: 'ทำโจทย์บทที่ 4', dd: 2 }));
    const b = taskFacts(T({ name: 'ศิลปะ', detail: 'ระบายสีโปสเตอร์', dd: 3 }));
    if (a.cognitiveLoad !== 'deep') bad('โจทย์เลขได้ ' + a.cognitiveLoad);
    if (b.cognitiveLoad !== 'shallow') bad('ระบายสีได้ ' + b.cognitiveLoad);
    return a.cognitiveLoad + ' / ' + b.cognitiveLoad;
  });

  check('เดาให้ถูก', 'คำว่า "กลุ่ม" ในเนื้องาน = ติดคนอื่น', bad => {
    const f = taskFacts(T({ name: 'วิทยาศาสตร์', detail: 'รายงานกลุ่ม เรื่องพลังงาน', dd: 4 }));
    if (!f.partnerDependent) bad('ไม่จับว่าเป็นงานกลุ่ม');
    return 'จับได้';
  });

  check('เดาให้ถูก', 'สอบไม่มีรอบสองเสมอ ไม่ว่าครูจะใจดีแค่ไหน', bad => {
    const f = taskFacts(Object.assign(T({ name: 'ฟิสิกส์', detail: 'สอบกลางภาค', dd: 3 }), { type: 'exam' }));
    if (f.latePolicy !== 'zero') bad('สอบได้ latePolicy=' + f.latePolicy);
    const g = taskFacts(T({ name: 'สังคมศึกษา', detail: 'ใบงาน · ครูบอกว่าส่งช้าไม่รับ', dd: 2 }));
    if (g.latePolicy !== 'zero') bad('"ส่งช้าไม่รับ" ได้ ' + g.latePolicy);
    const h = taskFacts(T({ name: 'สังคมศึกษา', detail: 'ใบงานธรรมดา', dd: 2 }));
    if (h.latePolicy !== 'penalty') bad('การบ้านทั่วไปควรเป็น penalty แต่ได้ ' + h.latePolicy);
    return 'zero / zero / penalty';
  });

  check('เดาให้ถูก', 'ค่าที่ผู้ใช้ระบุเอง ต้องชนะค่าที่เดาเสมอ', bad => {
    const f = taskFacts(Object.assign(
      T({ name: 'คณิตศาสตร์', detail: 'ทำโจทย์บทที่ 4', dd: 2 }),
      { cognitiveLoad: 'shallow', latePolicy: 'ok', partnerDependent: true }));
    if (f.cognitiveLoad !== 'shallow' || f.latePolicy !== 'ok' || !f.partnerDependent) {
      bad('ค่าที่ระบุเองถูกทับ');
    }
    return 'ชนะครบ';
  });

  // ---------- W5: งานที่ต้องทำก่อน ----------
  check('W5 ลำดับก่อนหลัง', 'ห้ามเสนองานที่ยังเริ่มไม่ได้', bad => {
    const read = T({ id: 'read', name: 'ฟิสิกส์', detail: 'อ่านบทที่ 4', estMin: 60, dd: 3, scorePct: 0 });
    const ex = Object.assign(T({ id: 'ex', name: 'ฟิสิกส์', detail: 'แบบฝึกหัดบทที่ 4',
      estMin: 60, dd: 3, scorePct: 20 }), { blockedBy: ['read'] });
    const d = decide(ST([ex, read]), NOW, OPT());
    if (d.best.task.id !== 'read') bad('เสนอ ' + d.best.task.detail + ' ทั้งที่ยังเริ่มไม่ได้');
    if (d.scenarios.some(x => x.task.id === 'ex')) bad('งานที่ติดอยู่ยังหลุดเข้ามาเป็นตัวเลือก');
    return d.best.task.detail;
  });

  check('W5 ลำดับก่อนหลัง', 'วงกลม (A รอ B, B รอ A) ต้องไม่ทำให้ทุกอย่างค้าง', bad => {
    const a = Object.assign(T({ id: 'a', name: 'เคมี', detail: 'ใบ A', dd: 3 }), { blockedBy: ['b'] });
    const b = Object.assign(T({ id: 'b', name: 'เคมี', detail: 'ใบ B', dd: 3 }), { blockedBy: ['a'] });
    const d = decide(ST([a, b]), NOW, OPT());
    if (!d || !d.best) bad('ตอบไม่ได้เลยเมื่อเจอวงกลม');
    return d && d.best ? d.best.task.detail : '—';
  });

  // ---------- นโยบายส่งช้า ----------
  check('ส่งช้า', 'ครูรับงานสาย ต้องถูกกว่าครูที่ไม่รับ อย่างมีนัยสำคัญ', bad => {
    const mk = extra => decide(ST([Object.assign(
      T({ name: 'ภาษาไทย', detail: 'เรียงความ', estMin: 400, dd: 1, scorePct: 20 }), extra)]),
      NOW, OPT());
    const soft = mk({}).best.sum.total;
    const hard = mk({ latePolicy: 'zero' }).best.sum.total;
    if (!(soft < hard * 0.8)) bad('ต่างกันน้อยเกินไป: ' + soft.toFixed(2) + ' vs ' + hard.toFixed(2));
    return soft.toFixed(1) + ' vs ' + hard.toFixed(1);
  });

  // ---------- W10: ดาวเป็นหลักฐาน ----------
  check('W10 ดาวผู้ใช้', 'ตั้งห้าดาวให้งาน 3% ต้องทำให้มันแพงขึ้นจริง', bad => {
    const mk = stars => decide(ST([Object.assign(
      T({ name: 'การงานอาชีพ', detail: 'ใบงาน', estMin: 300, dd: 1, scorePct: 3 }),
      stars ? { userStars: stars } : {})]), NOW, OPT());
    const plain = mk(0).best.sum.total;
    const starred = mk(5).best.sum.total;
    if (!(starred > plain * 1.2)) bad('ดาวไม่ได้เปลี่ยนอะไร: ' + plain.toFixed(2) + ' → ' + starred.toFixed(2));
    return plain.toFixed(1) + ' → ' + starred.toFixed(1);
  });

  // ---------- ยอมทิ้งใบไหน ----------
  check('ยอมทิ้ง', 'เวลาไม่พอจริง ต้องกล้าบอกว่าปล่อยใบไหน', bad => {
    const d = decide(ST([
      T({ name: 'เคมี', detail: 'ใบงานเคมี', estMin: 400, dd: 1, scorePct: 4 }),
      Object.assign(T({ name: 'คณิตศาสตร์', detail: 'สอบกลางภาค', estMin: 300, dd: 2, scorePct: 35 }), { type: 'exam' }),
    ]), NOW, OPT());
    if (!d.sacrifice) bad('ไม่แนะนำให้ทิ้งอะไรเลยทั้งที่เวลาไม่พอ');
    else if (d.sacrifice.task.scorePct >= 35) bad('แนะนำให้ทิ้งใบที่แพงที่สุด');
    return d.sacrifice ? 'ทิ้ง ' + d.sacrifice.task.detail : '—';
  });

  check('ยอมทิ้ง', 'เวลาพอสบาย ห้ามแนะนำให้ทิ้งอะไร', bad => {
    const d = decide(ST([
      T({ name: 'ศิลปะ', detail: 'วาดรูป', estMin: 40, dd: 6, scorePct: 5 }),
      T({ name: 'แนะแนว', detail: 'ใบงาน', estMin: 30, dd: 7, scorePct: 3 }),
    ]), NOW, OPT());
    if (d.sacrifice) bad('เสนอให้ทิ้ง ' + d.sacrifice.task.detail + ' ทั้งที่ยังทันสบาย');
    return 'ไม่เสนอ';
  });

  // ---------- ซ้อมรับมือ ----------
  check('ซ้อมรับมือ', 'ป่วยสองวันต้องทำให้แพงขึ้น ไม่ใช่เท่าเดิม', bad => {
    const d = decide(ST([
      T({ name: 'วิทยาศาสตร์', detail: 'รายงานกลุ่ม', estMin: 240, dd: 4, scorePct: 20 }),
      Object.assign(T({ name: 'ชีววิทยา', detail: 'สอบย่อย', estMin: 180, dd: 3, scorePct: 15 }), { type: 'exam' }),
    ]), NOW, OPT());
    if (!d.fragile || !d.fragile.sick) bad('ไม่ได้ซ้อมรับมือเลย');
    else if (d.fragile.sick.extra <= 0) bad('ป่วยแล้วไม่แพงขึ้น: ' + d.fragile.sick.extra.toFixed(2));
    if (!d.fragile.partner) bad('มีงานกลุ่มแต่ไม่ได้ซ้อมกรณีเพื่อนส่งช้า');
    return '+' + d.fragile.sick.extra.toFixed(1) + ' / +' +
      (d.fragile.partner ? d.fragile.partner.extra.toFixed(1) : '—');
  });

  check('ซ้อมรับมือ', 'ไม่มีงานกลุ่ม ต้องไม่ซ้อมกรณีเพื่อนส่งช้า (เสียเวลาเปล่า)', bad => {
    const d = decide(ST([T({ name: 'เคมี', detail: 'ใบงาน', estMin: 60, dd: 3, scorePct: 10 })]), NOW, OPT());
    if (d.fragile.partner) bad('ซ้อมกรณีที่เป็นไปไม่ได้');
    return 'ข้ามถูก';
  });

  check('ซ้อมรับมือ', 'แผนที่ทนได้ ต้องเงียบ ไม่ต้องเตือน', bad => {
    const d = decide(ST([T({ name: 'ศิลปะ', detail: 'วาดรูป', estMin: 30, dd: 8, scorePct: 5 })]), NOW, OPT());
    if (typeof fragileText === 'function' && fragileText(d)) bad('เตือนทั้งที่แผนทนได้: ' + fragileText(d));
    return 'เงียบ';
  });

  const pass = rows.filter(r => r.ผล === '✓').length;
  console.table(fails.length ? fails : rows);
  console.log(`[factsbench] ผ่าน ${pass}/${rows.length}`);
  return { rows, fails, pass, total: rows.length };
}

if (typeof window !== 'undefined') {
  Object.assign(window, { NOW_FACTS: NOW, benchFacts });
  window.__factsbench = true;
  console.log('[factsbench] พร้อมแล้ว — benchFacts()');
}
})();
