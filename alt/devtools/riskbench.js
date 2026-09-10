// (ห่อด้วย IIFE เหมือน parsebench เพื่อให้ฉีดซ้ำได้โดยไม่พัง)
(function () {
if (typeof window !== 'undefined' && window.__riskbench) { console.log('[riskbench] โหลดไว้อยู่แล้ว'); return; }
// ============================================================
// StudentOS ALT — เครื่องมือวัดผล simulate.js (เครื่องมือนักพัฒนา)
//
// **ไฟล์นี้ไม่ถูกโหลดโดยแอป** — ไม่อยู่ใน index.html และไม่อยู่ใน SHELL ของ sw.js
//
// ทำไมต้องมี: นาฬิกา "เริ่มไม่ทันแล้ว" เป็นตัวเลขที่ผู้ใช้จะเอาไปตัดสินใจจริง
// ผิดเมื่อไหร่แปลว่าเราบอกเด็กว่ายังมีเวลาทั้งที่ไม่มี ซึ่งแย่กว่าไม่บอกอะไรเลย
// และมันเป็นเลขคณิตล้วน — ของที่ตรวจได้เป๊ะ ๆ ไม่มีเหตุผลให้ปล่อยไว้ไม่ตรวจ
//
// **ตารางเวลาถูกยัดเข้าไปเอง ไม่ได้อ่านจาก context.js** — ผลจึงไม่ขึ้นกับว่าเครื่องที่รัน
// ตั้งตารางเรียนไว้ยังไง รันที่ไหนเมื่อไหร่ก็ต้องได้เลขเดิมทุกตัว
//
// วิธีใช้ — ฉีดเป็น script tag แล้วเรียกจาก console:
//   benchRisk()        → รันทุกเคส สรุปผล
//   benchRisk(true)    → โชว์รายละเอียดของทุกเคสรวมที่ผ่าน
// ============================================================

// อังคาร 8 ก.ย. 2569 19:10 — หลังเลิกเรียน กินข้าวเสร็จ เปิดแอปครั้งแรกของเย็น
// เลือกวันอังคารเพราะมีทั้งวันธรรมดาข้างหน้าและเสาร์อาทิตย์ในขอบเขต 14 วัน
const NOW = new Date(2026, 8, 8, 19, 10, 0);

const AT = (days, h, m = 0) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d;
};

// ---------- ตารางเวลาที่ยัดเข้าไป ----------
// [วันที่ห่างจากวันนี้, ชั่วโมงเริ่ม, นาทีเริ่ม, ชั่วโมงจบ, นาทีจบ]
const SLOT = (d, h1, m1, h2, m2) => {
  const start = AT(d, h1, m1), end = AT(d, h2, m2);
  return { start, end, min: Math.round((end - start) / 60000), used: 0 };
};

// ปกติ: เย็นวันธรรมดาว่าง 17:30–21:30 · คืนนี้เหลือจาก 19:10
const TL_NORMAL = () => [
  SLOT(0, 19, 10, 21, 30),
  SLOT(1, 17, 30, 21, 30),
  SLOT(2, 17, 30, 21, 30),
  SLOT(3, 17, 30, 21, 30),
];

// พุธติดเรียนพิเศษ 17:30–20:00 → คืนพุธเหลือแค่ 90 นาที
// นี่คือรูปแบบที่พบบ่อยที่สุดในชีวิตจริง และเป็นรูปแบบที่ของเดิมมองไม่เห็นเลย
const TL_TUTOR_WED = () => [
  SLOT(0, 19, 10, 21, 30),
  SLOT(1, 20, 0, 21, 30),
  SLOT(2, 17, 30, 21, 30),
  SLOT(3, 17, 30, 21, 30),
];

const TASK = (name, need, dueDay, dueH, dueM = 0) => ({
  id: name, subject: name, detail: name, type: 'homework',
  estMin: need, progress: 0, due: AT(dueDay, dueH, dueM).toISOString(),
});

// ---------- ชุดทดสอบ ----------
// เฉลยเขียนเป็น "อีกกี่นาทีจากตอนนี้" ไม่ใช่เวลาสัมบูรณ์ — อ่านแล้วตรวจด้วยหัวได้ทันที
// ยอมคลาด ±2 นาที เพราะการปัดเศษของช่วงเวลา ไม่ใช่เพราะยอมให้ตรรกะคลาด
const CASES = [
  {
    g: 'ใบเดียว',
    name: 'งาน 60 นาที ส่งพรุ่งนี้เช้า — มีแต่คืนนี้ให้ทำ',
    tl: TL_NORMAL, tasks: [TASK('ใบงานเคมี', 60, 1, 8)],
    want: { 'ใบงานเคมี': { verdict: 'tight', pnrIn: 54 } },
  },
  {
    g: 'กับดักตาราง',
    name: 'งาน 120 นาที ส่งพฤหัสเช้า · พุธว่างเต็ม 4 ชม.',
    tl: TL_NORMAL, tasks: [TASK('รายงานฟิสิกส์', 120, 2, 8)],
    want: { 'รายงานฟิสิกส์': { verdict: 'safe', pnrIn: 1409 } },
  },
  {
    // เคสเดียวกันเป๊ะ ต่างกันแค่พุธติดเรียนพิเศษ — คำตอบต้องพลิกจาก "ค่อยทำพุธ" เป็น "เริ่มคืนนี้"
    // นี่คือเหตุผลทั้งหมดที่ไฟล์ simulate.js มีอยู่ ของเดิมให้คำตอบเดียวกันทั้งสองกรณี
    g: 'กับดักตาราง',
    name: 'งาน 120 นาที ส่งพฤหัสเช้า · พุธติดเรียนพิเศษ เหลือ 90 นาที',
    tl: TL_TUTOR_WED, tasks: [TASK('รายงานฟิสิกส์', 120, 2, 8)],
    want: { 'รายงานฟิสิกส์': { verdict: 'tight', pnrIn: 59 } },
  },
  {
    g: 'มองทั้งกอง',
    name: 'งาน 90 นาที ส่งพรุ่งนี้ — อยู่ใบเดียวโดด ๆ',
    tl: TL_NORMAL, tasks: [TASK('การบ้านเลข', 90, 1, 8)],
    want: { 'การบ้านเลข': { verdict: 'tight' } },
  },
  {
    // ใบเดิม เส้นตายเดิม แต่มีเพื่อนร่วมคืนอีกใบ → เปลี่ยนจาก "ตึงแต่ไหว" เป็น "ไม่มีทางทั้งคู่"
    // priorityInfo() ให้คะแนนทีละใบ จึงตอบเหมือนเดิมทั้งสองกรณี (W1 ในเอกสารสถาปัตยกรรม)
    g: 'มองทั้งกอง',
    name: 'ใบเดิม + ใบงาน 40 นาที ส่งพร้อมกัน — คืนเดียวมี 140 นาที',
    tl: TL_NORMAL,
    tasks: [TASK('การบ้านเลข', 90, 1, 8), TASK('ใบงานเคมี', 40, 1, 8)],
    want: { 'ใบงานเคมี': { verdict: 'safe' }, 'การบ้านเลข': { verdict: 'lost' } },
  },
  {
    // เวลาว่างดิบพอ (140) แต่พอคูณอัตราลงมือจริงแล้วไม่พอ (98 < 120)
    // ช่วงนี้ห้ามพูดว่า "เวลาไม่พอ" เด็ดขาด เพราะยังพอถ้าทำได้เต็มร้อย — และชิปโอกาสข้าง ๆ
    // ก็จะบอก 40% อยู่ดี · เคยพลาดตรงนี้มาแล้วใน 1B76 ตอนเขียน pnrChip แยกจาก pnrText
    g: 'ห้ามขัดกันเอง',
    name: 'เวลาว่างดิบพอ แต่อัตราลงมือจริงไม่พอ — ชิปห้ามบอกว่าเวลาไม่พอ',
    tl: TL_NORMAL, tasks: [TASK('เรียงความอังกฤษ', 120, 1, 8)],
    want: { 'เรียงความอังกฤษ': { verdict: 'critical', pnr: null, chipHas: 'ช้ากว่า', chipNot: 'ไม่พอ' } },
  },
  {
    g: 'ขอบ',
    name: 'เลยกำหนดไปแล้ว',
    tl: TL_NORMAL, tasks: [TASK('งานที่ลืม', 60, -1, 8)],
    want: { 'งานที่ลืม': { verdict: 'lost', overdue: true } },
  },
  {
    // เวลาว่างดิบ 140 นาที งาน 600 นาที — เป็นไปไม่ได้ด้วยเลขคณิต ห้ามตอบเป็นเปอร์เซ็นต์
    g: 'ขอบ',
    name: 'งานที่ไม่มีทางทันแม้ทำเต็มร้อยทุกนาที',
    tl: TL_NORMAL, tasks: [TASK('รายงานใหญ่', 600, 1, 8)],
    want: { 'รายงานใหญ่': { verdict: 'lost', pnr: null } },
  },
  {
    g: 'ขอบ',
    name: 'เวลาเหลือเฟือ — ห้ามขึ้นเตือนอะไรทั้งนั้น',
    tl: TL_NORMAL, tasks: [TASK('อ่านหนังสือ', 30, 3, 8)],
    want: { 'อ่านหนังสือ': { verdict: 'safe' } },
  },
];

function benchRisk(showPass) {
  if (typeof riskReport !== 'function') {
    console.error('[riskbench] ยังไม่ได้โหลด simulate.js');
    return null;
  }
  const rows = [], fails = [];

  for (const c of CASES) {
    const rep = riskReport(c.tasks, NOW, { timeline: c.tl() });
    for (const [name, want] of Object.entries(c.want)) {
      const r = rep.find(x => x.task.subject === name);
      const bad = [];
      if (!r) bad.push('ไม่มีผลลัพธ์');
      else {
        if (want.verdict && r.verdict !== want.verdict) bad.push(`verdict=${r.verdict} (หวัง ${want.verdict})`);
        if (want.overdue != null && !!r.overdue !== want.overdue) bad.push(`overdue=${r.overdue}`);
        if (want.pnr === null && r.pnr) bad.push('ควรไม่มีจุดเริ่มที่ทัน แต่มี');
        if (want.pnrIn != null) {
          const got = r.pnr ? Math.round((r.pnr - NOW) / 60000) : null;
          if (got == null || Math.abs(got - want.pnrIn) > 2) bad.push(`pnr อีก ${got} นาที (หวัง ${want.pnrIn})`);
        }
        // ข้อความบนชิปต้องไม่ขัดกับตัวเลขที่อยู่ข้าง ๆ มันบนการ์ดใบเดียวกัน
        if (want.chipHas || want.chipNot) {
          const chip = pnrChip(r, NOW) || '';
          if (want.chipHas && !chip.includes(want.chipHas)) bad.push(`ชิปควรมีคำว่า "${want.chipHas}" แต่ได้ "${chip}"`);
          if (want.chipNot && chip.includes(want.chipNot)) bad.push(`ชิปห้ามมีคำว่า "${want.chipNot}" แต่ได้ "${chip}"`);
        }
      }
      const row = {
        กลุ่ม: c.g, เคส: c.name, งาน: name,
        ผล: bad.length ? '✗' : '✓',
        verdict: r ? r.verdict : '—',
        โอกาส: r ? Math.round(r.odds * 100) + '%' : '—',
        เริ่มได้ถึง: r && r.pnr ? Math.round((r.pnr - NOW) / 60000) + ' นาที' : '—',
        ข้อความ: r ? pnrText(r, NOW) : '—',
      };
      rows.push(row);
      if (bad.length) fails.push({ ...row, ที่ผิด: bad.join(' · ') });
    }
  }

  const pass = rows.filter(r => r.ผล === '✓').length;
  console.table(showPass ? rows : (fails.length ? fails : rows));
  console.log(`[riskbench] ผ่าน ${pass}/${rows.length}`);
  return { rows, fails, pass, total: rows.length };
}

if (typeof window !== 'undefined') {
  Object.assign(window, { NOW_RISK: NOW, RISK_CASES: CASES, benchRisk });
  window.__riskbench = true;
  console.log('[riskbench] พร้อมแล้ว — benchRisk() · benchRisk(true)');
}
})();
