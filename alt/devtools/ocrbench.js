// ============================================================
// StudentOS ALT — เครื่องมือวัดผล OCR (เครื่องมือนักพัฒนา)
//
// **ไฟล์นี้ไม่ถูกโหลดโดยแอป** — ไม่ได้อยู่ใน index.html และไม่ได้อยู่ใน SHELL ของ sw.js
// ผู้ใช้จริงจึงไม่ต้องแบกน้ำหนักไฟล์นี้เลย
//
// วิธีใช้: เปิดแอปแล้ววางไฟล์นี้ลง console (หรือ inject ด้วย script tag) จากนั้น
//   await benchSkew()            → วัดเฉพาะตัวแก้ภาพเอียง เร็ว ไม่ต้องโหลด Tesseract
//   await benchOcr()             → วัดทั้งสายจริง เทียบเปิด/ปิดตัวแก้เอียง (ช้า ต้องมีเน็ต)
//   await benchOcr(REAL_CASES)   → วัดกับรูปจริง เมื่อมีชุดรูปแล้ว
//
// ชุดรูปจริง: วางไฟล์ที่ alt/devtools/samples/ แล้วเขียนเฉลยใน REAL_CASES ข้างล่าง
// รูปแบบเฉลยใช้ชื่อช่องเดียวกับที่ parseAssignment คืนมา
// ============================================================

// ---------- 1) สร้างใบงานปลอมที่รู้คำตอบอยู่แล้ว ----------
// ใช้พิสูจน์ตัวแก้เอียงได้โดยไม่ต้องรอชุดรูปจริง เพราะเรารู้มุมที่ใส่เข้าไปเป๊ะ ๆ
const BENCH_SHEETS = [
  {
    id: 'physics',
    lines: [
      'ใบงานที่ 4  วิชา ฟิสิกส์',
      'ครูสมชาย  ม.5/2',
      'ทำโจทย์บทที่ 4 ข้อ 1-10',
      'กำหนดส่ง 12 ส.ค. 2569',
      'คะแนน 15 คะแนน',
    ],
    expect: { subject: 'ฟิสิกส์', teacher: 'ครูสมชาย', scorePct: 15 },
  },
  {
    id: 'english',
    lines: [
      'วิชา ภาษาอังกฤษ',
      'ครูวิภา',
      'อ่านสอบ quiz บทที่ 2',
      'สอบวันศุกร์',
      'คะแนน 20 คะแนน',
    ],
    expect: { subject: 'ภาษาอังกฤษ', teacher: 'ครูวิภา', scorePct: 20, isExam: true },
  },
  {
    id: 'math',
    lines: [
      'คณิตศาสตร์  แบบฝึกหัด 2.3',
      'ครูอนันต์',
      'ส่งพรุ่งนี้',
      'ใช้เวลาประมาณ 30 นาที',
    ],
    expect: { subject: 'คณิตศาสตร์', teacher: 'ครูอนันต์', estMin: 30 },
  },
];

// วาดใบงานลง canvas แล้วเอียงตามมุมที่สั่ง + ใส่สัญญาณรบกวนนิดหน่อยให้เหมือนรูปถ่าย
function benchRender(sheet, deg, opts = {}) {
  const W = opts.w || 1000, H = opts.h || 700;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#f4f2ee';                 // กระดาษไม่ขาวสนิท เหมือนของจริง
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(deg * Math.PI / 180);
  ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.textBaseline = 'top';
  const size = opts.size || 34;
  sheet.lines.forEach((ln, i) => {
    ctx.font = (i === 0 ? '700 ' : '400 ') + size + "px 'Sarabun', sans-serif";
    ctx.fillText(ln, 90, 110 + i * (size * 1.9));
  });
  ctx.restore();

  if (opts.noise !== 0) {
    const amt = opts.noise == null ? 10 : opts.noise;
    const id = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < id.data.length; i += 4) {
      const n = (Math.random() - 0.5) * amt * 2;
      id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n;
    }
    ctx.putImageData(id, 0, 0);
  }
  return c;
}

// ---------- 2) วัดเฉพาะตัวแก้ภาพเอียง ----------
// เร็ว ไม่ต้องโหลด Tesseract — ตอบคำถามเดียว: หามุมได้แม่นแค่ไหน
async function benchSkew(angles) {
  const list = angles || [-7, -5, -3.5, -2, -1, 0, 1, 2, 3.5, 5, 7];
  const rows = [];
  for (const sheet of BENCH_SHEETS) {
    for (const a of list) {
      const canvas = benchRender(sheet, a);
      const t0 = performance.now();
      const gray = ocrToGray(canvas);
      const found = ocrFindSkew(ocrBinarize(gray));
      rows.push({
        sheet: sheet.id,
        เอียงจริง: a,
        หาได้: found,
        คลาด: +Math.abs(found - a).toFixed(2),
        ms: Math.round(performance.now() - t0),
      });
    }
  }
  const errs = rows.map(r => r.คลาด);
  const within = (n) => (errs.filter(e => e <= n).length / errs.length * 100).toFixed(0) + '%';
  const summary = {
    จำนวนที่ทดสอบ: rows.length,
    คลาดเฉลี่ย: +(errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(2) + '°',
    คลาดมากสุด: +Math.max(...errs).toFixed(2) + '°',
    'อยู่ใน 0.5°': within(0.5),
    'อยู่ใน 1.0°': within(1),
    เวลาเฉลี่ย: Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length) + 'ms',
  };
  console.table(rows);
  console.table([summary]);
  return { rows, summary };
}

// ---------- 3) วัดทั้งสายจริง เทียบเปิด/ปิดตัวแก้เอียง ----------
function benchCompare(got, expect) {
  const fields = Object.keys(expect);
  const hit = fields.filter(f => {
    const g = got[f], e = expect[f];
    if (typeof e === 'string') return String(g || '') === e;
    return g === e;
  });
  return { ได้: hit.length, จาก: fields.length, พลาด: fields.filter(f => !hit.includes(f)) };
}

// ยิงภาพเข้า Tesseract ตรง ๆ ตามสายจริง แต่เลือกได้ว่าจะแก้เอียงไหม
async function benchOnce(canvas, deskewOn) {
  const gray0 = ocrToGray(canvas);
  const sk = deskewOn ? ocrDeskew(gray0) : { gray: gray0, bin: ocrBinarize(gray0), deg: 0 };
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(ocrGrayToCanvas(sk.bin), {}, { text: true });
  const text = normalizeOcrText(data.text);
  return { text, conf: Math.round(data.confidence || 0), deg: sk.deg,
    parsed: parseAssignment(text, new Date(), { fuzzy: true }) };
}

async function benchOcr(cases, angles) {
  const list = angles || [0, 3, 6];
  const sheets = cases || BENCH_SHEETS;
  const rows = [];
  for (const sheet of sheets) {
    for (const a of list) {
      const canvas = sheet.canvas || benchRender(sheet, a);
      for (const on of [false, true]) {
        const t0 = performance.now();
        const r = await benchOnce(canvas, on);
        const cmp = benchCompare(r.parsed, sheet.expect);
        rows.push({
          sheet: sheet.id, เอียง: a, แก้เอียง: on ? 'เปิด' : 'ปิด',
          conf: r.conf, ช่องที่ได้: cmp.ได้ + '/' + cmp.จาก,
          พลาด: cmp.พลาด.join(',') || '-',
          ms: Math.round(performance.now() - t0),
        });
        console.log(`[bench] ${sheet.id} ${a}° deskew=${on} → ${cmp.ได้}/${cmp.จาก} conf=${r.conf}`);
      }
      if (sheet.canvas) break;   // รูปจริงมีมุมของมันเองอยู่แล้ว ไม่ต้องวนมุม
    }
  }
  const side = (on) => {
    const r = rows.filter(x => x.แก้เอียง === (on ? 'เปิด' : 'ปิด'));
    const got = r.reduce((a, x) => a + (+x.ช่องที่ได้.split('/')[0]), 0);
    const tot = r.reduce((a, x) => a + (+x.ช่องที่ได้.split('/')[1]), 0);
    return { ช่องที่ถูก: got + '/' + tot,
      คิดเป็น: (got / tot * 100).toFixed(1) + '%',
      confเฉลี่ย: Math.round(r.reduce((a, x) => a + x.conf, 0) / r.length) };
  };
  console.table(rows);
  const summary = { ปิดตัวแก้เอียง: side(false), เปิดตัวแก้เอียง: side(true) };
  console.table([{ ...summary.ปิดตัวแก้เอียง, แบบ: 'ปิด' }, { ...summary.เปิดตัวแก้เอียง, แบบ: 'เปิด' }]);
  return { rows, summary };
}

// ---------- 4) ช่องสำหรับรูปจริง ----------
// เมื่อมีรูปจริงแล้ว: วางไฟล์ที่ alt/devtools/samples/ แล้วเติมรายการนี้
// จากนั้นเรียก await benchOcr(await loadRealCases())
const REAL_CASES = [
  // { file: 'samples/01.jpg', id: '01', expect: { subject: 'ฟิสิกส์', teacher: 'ครูสมชาย' } },
];
async function loadRealCases() {
  const out = [];
  for (const c of REAL_CASES) {
    const bmp = await createImageBitmap(await (await fetch(c.file)).blob());
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    out.push({ id: c.id, canvas: cv, expect: c.expect });
  }
  return out;
}

console.log('[ocrbench] พร้อมแล้ว — ลอง: await benchSkew()  หรือ  await benchOcr()');
