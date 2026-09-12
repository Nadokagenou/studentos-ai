(function () {
if (typeof window !== 'undefined' && window.__decidebench) { console.log('[decidebench] โหลดไว้อยู่แล้ว'); return; }
// ============================================================
// StudentOS ALT — เครื่องมือวัดผล decide.js / loss.js (เครื่องมือนักพัฒนา)
//
// **ไฟล์นี้ไม่ถูกโหลดโดยแอป** — ไม่อยู่ใน index.html และไม่อยู่ใน SHELL ของ sw.js
//
// ทำไมต้องมี: เฟส 2 ตัดสินใจแทนคนด้วยเลขที่มีหน่วยจริง (คะแนนของทั้งเทอม)
// ถ้าหน่วยนั้นเพี้ยน คำแนะนำจะผิดแบบมั่นใจ ซึ่งแย่กว่าผิดแบบลังเล
// และเป็นของที่ตรวจได้เป๊ะ เพราะทั้ง loss.js กับ simRollout เป็นฟังก์ชันบริสุทธิ์
//
// **ตารางเวลาถูกยัดเข้าไปเอง** ผลจึงไม่ขึ้นกับตารางเรียนของเครื่องที่รัน
//
// วิธีใช้:  benchDecide()  ·  benchDecide(true) เพื่อดูรายละเอียดทุกเคส
// ============================================================

const NOW = new Date(2026, 8, 8, 19, 10, 0);      // อังคาร 19:10
const AT = (d, h, m = 0) => { const x = new Date(NOW); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x; };
const SLOT = (d, h1, m1, h2, m2) => {
  const start = AT(d, h1, m1), end = AT(d, h2, m2);
  return { start, end, min: Math.round((end - start) / 60000), used: 0 };
};

// เย็นวันธรรมดาว่าง 17:30–21:30 · คืนนี้เหลือจาก 19:10 · เสาร์อาทิตย์ว่างทั้งบ่าย
const TL = () => [
  SLOT(0, 19, 10, 21, 30), SLOT(1, 17, 30, 21, 30), SLOT(2, 17, 30, 21, 30),
  SLOT(3, 17, 30, 21, 30), SLOT(4, 14, 0, 21, 30), SLOT(5, 14, 0, 21, 30),
  SLOT(6, 17, 30, 21, 30), SLOT(7, 17, 30, 21, 30),
];

const TASK = (o) => Object.assign({
  id: o.name, subject: o.name, detail: o.name, type: 'homework',
  estMin: 60, progress: 0, scorePct: null, snoozeCount: 0, done: false, deleted: false,
}, o, { due: AT(o.dueDay, o.dueH == null ? 8 : o.dueH).toISOString() });

const CASES = [
  {
    g: 'เดิมพัน',
    name: 'ใบงาน 3% ส่งพรุ่งนี้ vs สอบ 30% อีกสี่วัน — ต้องได้เทียบกันจริง',
    tasks: [
      TASK({ name: 'การงานอาชีพ', estMin: 40, scorePct: 3, dueDay: 1 }),
      TASK({ name: 'ฟิสิกส์', estMin: 180, scorePct: 30, type: 'exam', dueDay: 4 }),
    ],
    // ถ้าไม่มีทางเลือก "ใบที่เดิมพันสูงที่สุด" สอบจะไม่เคยถูกเอามาเทียบเลย (เคยพลาดมาแล้ว)
    want: { candidates: ['การงานอาชีพ', 'ฟิสิกส์'], best: 'การงานอาชีพ' },
  },
  {
    g: 'ปิดให้จบ',
    name: 'รายงาน 20% ทำไป 80% เหลือ 30 นาที vs ใบงาน 5% ที่ยังไม่แตะ',
    tasks: [
      TASK({ name: 'ภาษาไทย', estMin: 150, progress: 80, scorePct: 20, dueDay: 2 }),
      TASK({ name: 'ศิลปะ', estMin: 90, scorePct: 5, dueDay: 3 }),
    ],
    want: { best: 'ภาษาไทย' },
  },
  {
    g: 'ห้ามโม้',
    name: 'งานที่ยังไงก็เสี่ยงหลุด — ห้ามเขียนว่า "กันไม่ให้หลุด"',
    tasks: [
      TASK({ name: 'คณิตศาสตร์', estMin: 600, scorePct: 30, type: 'exam', dueDay: 2 }),
      TASK({ name: 'สังคมศึกษา', estMin: 60, scorePct: 5, dueDay: 5 }),
    ],
    want: { avoidedNot: 'ไม่ให้หลุด' },
  },
  {
    g: 'ห้ามขัดกันเอง',
    name: 'เลื่อนแล้วไม่ต่าง — ห้ามเขียน "ขึ้นเป็น X (จาก X)"',
    tasks: [
      TASK({ name: 'ศิลปะ', estMin: 40, scorePct: 5, dueDay: 6 }),
      TASK({ name: 'แนะแนว', estMin: 30, scorePct: 3, dueDay: 7 }),
    ],
    want: { delayedSaneNumbers: true },
  },
  {
    g: 'ไม่ผัดวัน',
    name: 'ทุกอย่างยังไกล — เอนจินต้องไม่บอกให้ "ไม่ต้องทำอะไรคืนนี้"',
    // ตอนที่ StressCost ใช้ load/cap เคสนี้ตอบว่าพักดีกว่าทุกครั้ง เพราะการใช้ช่วงสั้นให้เต็ม
    // ถูกคิดราคาเท่ากับการอัดทั้งวัน — ซึ่งเป็นกับดักที่แอปนี้ตั้งใจจะแก้ ไม่ใช่ตั้งใจจะสอน
    tasks: [
      TASK({ name: 'สังคมศึกษา', estMin: 120, scorePct: 10, dueDay: 6 }),
      TASK({ name: 'ศิลปะ', estMin: 60, scorePct: 5, dueDay: 8 }),
    ],
    want: { restWins: false },
  },
  {
    // จอ "AI คิดยังไง" เปิดมาจากบรรทัด "ทำไมถึงเป็นใบนี้" บนการ์ดหน้าแรก
    // การ์ด A จึงต้องเป็นใบนั้นเสมอ ไม่ใช่ใบที่ decide() เลือกเอง
    // (เจอจริงตอนทำ 1B77: หน้าแรกบอก "ใบงานบทที่ 3" จอนี้บอก "เริ่มฟิสิกส์")
    g: 'สองจอห้ามเถียงกัน',
    name: 'ส่ง focusId มา — การ์ด A ต้องเป็นใบนั้น ไม่ใช่ใบที่ argmin เลือก',
    tasks: [
      TASK({ name: 'ศิลปะ', estMin: 40, scorePct: 5, dueDay: 1 }),
      TASK({ name: 'ฟิสิกส์', estMin: 240, scorePct: 30, type: 'exam', dueDay: 3 }),
    ],
    focusName: 'ศิลปะ',
    want: { cardAIs: 'ศิลปะ' },
  },
  {
    g: 'ซ้ำได้',
    name: 'เรียกสองครั้งด้วยข้อมูลเดิม ต้องได้ตัวเลขเดิมเป๊ะ',
    tasks: [
      TASK({ name: 'เคมี', estMin: 90, scorePct: 15, dueDay: 2 }),
      TASK({ name: 'ชีววิทยา', estMin: 120, scorePct: 20, dueDay: 3 }),
    ],
    want: { deterministic: true },
  },
];

function benchDecide(showAll) {
  if (typeof decide !== 'function') { console.error('[decidebench] ยังไม่ได้โหลด decide.js'); return null; }
  const rows = [], fails = [];
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  for (const c of CASES) {
    const st = { tasks: c.tasks, settings: {}, sessions: [] };
    const focusId = c.focusName ? c.tasks.find(t => t.subject === c.focusName).id : null;
    const d = decide(st, NOW, { timeline: TL(), riskTimeline: TL(), focusId });
    const bad = [];

    if (!d) bad.push('ไม่มีคำตอบ');
    else {
      const w = c.want;
      const names = d.scenarios.map(s => s.task.subject);
      if (w.candidates) {
        for (const n of w.candidates) if (!names.includes(n)) bad.push(`ไม่ได้เอา ${n} มาเทียบ`);
      }
      if (w.best && d.best.task.subject !== w.best) bad.push(`เลือก ${d.best.task.subject} (หวัง ${w.best})`);
      if (w.avoidedNot && d.why.avoided.includes(w.avoidedNot)) {
        bad.push(`โม้: "${w.avoidedNot}" ทั้งที่โอกาสพลาดยังสูง`);
      }
      if (w.restWins != null && d.rest.wins !== w.restWins) {
        bad.push(`rest.wins=${d.rest.wins} (หวัง ${w.restWins})`);
      }
      // ประโยค "ขึ้นเป็น A (จาก B)" ที่ A กับ B เท่ากัน คือประโยคที่อ่านแล้วเหมือนแอปพัง
      if (w.delayedSaneNumbers) {
        const m = /ขึ้นเป็น ([\d.]+) คะแนน \(จาก ([\d.]+)\)/.exec(d.why.delayed);
        if (m && m[1] === m[2]) bad.push(`ประโยคเลื่อนบอกเลขเท่ากันสองข้าง: ${m[1]}`);
      }
      if (w.deterministic) {
        const d2 = decide(st, NOW, { timeline: TL(), riskTimeline: TL(), focusId });
        if (d2.best.sum.total !== d.best.sum.total || d2.delay.sum.total !== d.delay.sum.total) {
          bad.push('เรียกสองครั้งได้คนละเลข');
        }
      }
      // กฎที่ใช้กับทุกเคส: หน่วยต้องไม่ติดลบ และการ์ดต้องมีอย่างน้อย A กับ B
      if (d.best.sum.total < 0) bad.push('ความเสียหายติดลบ');
      // มีงานสองใบขึ้นไป ต้องมีทางให้เทียบอย่างน้อยสองทางเสมอ
      // ไม่งั้นการ์ด "ถ้าเลือกอีกใบ" ไม่มีอะไรจะพูด ทั้งที่บนจอมีงานให้เลือกอยู่จริง
      if (c.tasks.length >= 2 && d.scenarios.length < 2) bad.push('เทียบได้ทางเดียวทั้งที่มีงานหลายใบ');
      if (typeof scenarioCards === 'function' && scenarioCards(d).length < 2) bad.push('การ์ดไม่ครบ');
      if (w.cardAIs && typeof scenarioCards === 'function') {
        const a0 = scenarioCards(d)[0];
        if (!a0.act.includes(w.cardAIs)) bad.push(`การ์ด A เป็น "${a0.act}" (ต้องเป็น ${w.cardAIs})`);
      }
    }

    const row = {
      กลุ่ม: c.g, เคส: c.name,
      ผล: bad.length ? '✗' : '✓',
      เลือก: d ? d.best.task.subject : '—',
      'E[Loss]': d ? Math.round(d.best.sum.total * 10) / 10 : '—',
      เทียบกี่ทาง: d ? d.scenarios.length : 0,
      พัก: d ? (d.rest.wins ? 'ชนะ' : '—') : '—',
    };
    rows.push(row);
    if (bad.length) fails.push({ ...row, ที่ผิด: bad.join(' · ') });
    if (showAll && d) {
      console.log('\n— ' + c.name);
      for (const k of ['task', 'now', 'delayed', 'avoided', 'opened', 'instead']) {
        console.log('   ' + k.padEnd(9) + ': ' + d.why[k]);
      }
    }
  }

  const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  const pass = rows.filter(r => r.ผล === '✓').length;
  console.table(fails.length ? fails : rows);
  console.log(`[decidebench] ผ่าน ${pass}/${rows.length} · ${ms}ms รวมทุกเคส`);
  return { rows, fails, pass, total: rows.length, ms };
}

if (typeof window !== 'undefined') {
  Object.assign(window, { NOW_DECIDE: NOW, DECIDE_CASES: CASES, benchDecide, DECIDE_TL: TL });
  window.__decidebench = true;
  console.log('[decidebench] พร้อมแล้ว — benchDecide() · benchDecide(true)');
}
})();
