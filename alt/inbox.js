// ============================================================
// inbox — ชั้นกลางระหว่าง "แหล่งข้อมูล" กับ "Decision Engine"  ·  *** ALT ***
// ------------------------------------------------------------
// ทุกอย่างที่ไหลเข้าแอป ไม่ว่ามาจากไหน ลงที่นี่ที่เดียวก่อนเสมอ:
//   Classroom · LINE · รูป/OCR · เสียงพูด · แปะข้อความ · พิมพ์เอง
//
// หน้าที่ของชั้นนี้มี 4 อย่าง แล้วค่อยส่งต่อให้ engine:
//   1. อ่าน      — ใช้ parseAssignment เดิม แกะ วิชา/กำหนดส่ง/คะแนน
//   2. ให้คะแนนมั่นใจ — เจอครบแค่ไหน ยิ่งครบยิ่งมั่นใจ
//   3. จับซ้ำ     — ครูสั่งซ้ำในหลายที่ / สแกนซ้ำ ต้องไม่กลายเป็นสองงาน
//   4. ตัดสินใจ   — มั่นใจสูงพอ เข้าแผนเองเลย · ไม่พอ ค่อยถามแค่แตะเดียว
//
// ข้อ 4 คือหัวใจของ "ไม่ต้องกรอกข้อมูล" — เราไม่ได้เลิกให้นักเรียนตรวจ
// เราแค่เลิกถามในเรื่องที่ไม่ต้องถาม
// ============================================================

// ---------- ทะเบียนแหล่งข้อมูล ----------
// เพิ่มแหล่งใหม่ = เติมอีก 1 บรรทัด แล้วเขียนฟังก์ชัน pull ให้มัน
//   live      = เชื่อมได้จริงแล้วหรือยัง
//   viaInbox  = ไหลผ่านกล่องเข้าไหม (ถ้าไม่ = เข้าฟอร์มตรง ๆ ตัวเลขนับจึงไม่ต้องโชว์)
//   needs     = สิ่งที่ต้องมีก่อนถึงจะเปิดใช้ได้ (เขียนไว้ให้ผู้ใช้เห็นตรง ๆ)
const SOURCES = [
  { id: 'scan',      name: 'สแกน/ถ่ายรูป',    icon: 'camera', live: true,
    desc: 'ใบงาน ตารางเรียนที่จด ประกาศหน้าห้อง' },
  { id: 'voice',     name: 'พูดใส่ไมค์',       icon: 'mic',    live: true,
    desc: 'พูด 5 วินาที ได้งานหนึ่งชิ้น' },
  { id: 'text',      name: 'แปะข้อความ',       icon: 'type',   live: true,
    desc: 'ก๊อปจากกลุ่ม LINE มาแปะ' },
  { id: 'line',      name: 'LINE (บอทในกลุ่มห้อง)', icon: 'chat', live: true, link: 'line', viaInbox: true,
    desc: 'ครูสั่งงานในกลุ่มครั้งเดียว เข้าระบบให้ทุกคนที่เชื่อมไว้พร้อมกัน',
    note: 'LINE ไม่เปิดให้อ่านแชทส่วนตัวของใครทั้งนั้น — บอทเห็นเฉพาะข้อความในกลุ่มที่ถูกเชิญเข้าไปเท่านั้น' },
  { id: 'classroom', name: 'Google Classroom', icon: 'book',   live: false,
    desc: 'ดึงงานที่ครูมอบหมายและกำหนดส่งมาเอง',
    needs: 'ต้องมี Google Cloud project + OAuth consent screen (โหมด test user ใช้ได้เลย)' },
];
const sourceById = id => SOURCES.find(s => s.id === id) || SOURCES[0];

// ---------- ความมั่นใจ ----------
// คิดจาก "เจอข้อมูลที่จำเป็นครบแค่ไหน" ไม่ใช่ตัวเลขลอย ๆ
// กำหนดส่งมีน้ำหนักมากที่สุด เพราะไม่มีกำหนดส่ง engine จัดลำดับไม่ได้เลย
function inboxConfidence(parsed) {
  const d = (parsed && parsed.detected) || {};
  let c = 0.15;
  if (d.due) c += 0.45;
  if (d.subject) c += 0.2;
  if (parsed && parsed.detail && parsed.detail.trim().length >= 6) c += 0.12;
  if (d.score) c += 0.05;
  if (d.est) c += 0.03;
  return Math.min(1, Math.round(c * 100) / 100);
}

// เกณฑ์ที่ยอมให้เข้าแผนเองโดยไม่ถาม — ตั้งไว้สูงโดยตั้งใจ
// ถ้าเผลอปล่อยงานผิดเข้าแผน ความเชื่อใจพังทันที ซึ่งแพงกว่าการถามเกินไปหนึ่งครั้ง
const AUTO_ACCEPT = 0.8;

// ---------- ประตูแรก: นี่คืองาน หรือแค่คนในกลุ่มคุยกัน ----------
// กลุ่มห้องเรียนมีข้อความวันละเป็นร้อย แต่เป็นงานจริงไม่กี่ข้อความ
// ถ้าปล่อยเข้ามาหมดแล้วให้นักเรียนมานั่งกดทิ้งทีละอัน มันแย่กว่าการพิมพ์เองอีก
//
// เกณฑ์ผ่านมีสามทาง — ทางใดทางหนึ่งก็พอ:
//   1. พูดถึงคะแนน = เป็นงานแทบแน่นอน ไม่มีใครคุยเล่นเรื่องคะแนนเก็บ
//   2. มีคำที่บอกว่ากำลังสั่งงาน/สั่งให้เตรียมของ
//   3. มีทั้งกำหนดส่งและชื่อวิชาพร้อมกัน
//
// ข้อ 3 ต้องมีครบทั้งคู่ ห้ามใช้กำหนดส่งอย่างเดียว — เพราะ "วันนี้/พรุ่งนี้"
// โผล่ในบทสนทนาปกติตลอดเวลา ("วันนี้ร้อนมากเลย" ก็มีกำหนดส่งในสายตา parser)
//
// ตั้งใจให้ "ยอมปล่อยผ่านมาถามดีกว่าเผลอทิ้งงานจริง" — ของที่หลุดมาผิด
// นักเรียนกดทิ้งทีเดียวจบ แต่ของที่ถูกทิ้งไปเงียบ ๆ ไม่มีใครรู้ว่าเคยมี
// คำที่แทบไม่มีทางโผล่ในบทสนทนาทั่วไป — เจอแล้วเป็นงานเกือบแน่นอน
const STRONG_HINTS = new RegExp([
  'การบ้าน', 'แบบฝึกหัด', 'ใบงาน', 'ชีท', 'รายงาน', 'ชิ้นงาน', 'โครงงาน', 'ผังงาน',
  'พรีเซ', 'นำเสนอ', 'สอบ', 'ควิซ', 'quiz', 'แล็บ', 'ปฏิบัติการ', 'assignment', 'homework',
  'กำหนดส่ง', 'เดดไลน์', 'deadline', 'คะแนน', 'เก็บคะแนน',
  'ทำข้อ', 'ทำโจทย์', 'ทำแบบ', 'บทที่',
].join('|'), 'i');

// คำที่ "อาจจะ" เป็นงาน แต่ใช้คุยเรื่องอื่นได้พอ ๆ กัน
// "ส่ง" เป็นตัวอย่างที่ชัดที่สุด — ส่งการบ้าน ส่งรูป ส่งไลน์ ส่งสติกเกอร์
const WEAK_HINTS = new RegExp([
  'ส่ง', 'เตรียม', 'อย่าลืม', 'เอามา', 'นำมา', 'พกมา', 'ใส่มา', 'ท่อง', 'สรุป',
].join('|'), 'i');

// หลักฐานที่มี แบ่งเป็น 3 ระดับ เพราะสิทธิ์ของโมเดลขึ้นกับระดับนี้
function taskEvidence(text, parsed) {
  const d = (parsed && parsed.detected) || {};
  if (d.score) return 'strong';           // ไม่มีใครคุยเล่นเรื่องคะแนนเก็บ
  if (STRONG_HINTS.test(text)) return 'strong';
  if (d.due && d.subject) return 'strong'; // มีทั้งกำหนดส่งและวิชา
  if (WEAK_HINTS.test(text)) return 'weak';
  return 'none';
}

function looksLikeTask(text, parsed) { return taskEvidence(text, parsed) !== 'none'; }

// ประตูจริง = กฎคำ + สิ่งที่เรียนรู้จากผู้ใช้ (brain.js)
//
// จุดสำคัญ: โมเดลไม่ได้มีสิทธิ์เท่ากันทั้งสองทาง เพราะราคาของการผิดไม่เท่ากัน
//   ค้านให้ "ผ่านเพิ่ม"  ผิดแล้วเสียแค่หนึ่งแตะ                → ให้สิทธิ์เต็ม
//   ค้านให้ "ทิ้ง"       ผิดแล้วการบ้านจริงหายเงียบ ๆ ถึงวันส่ง  → ให้เฉพาะเคสก้ำกึ่ง
//
// เคยเขียนให้ค้านได้ทุกกรณี แล้วทดสอบเจอว่า "ส่งรายงานวิทยาศาสตร์ภายในวันศุกร์"
// โดนทิ้ง เพราะสอนมันด้วยข้อความขยะที่ขึ้นต้นด้วย "ส่ง" หลายอัน — มันเลยเหมาว่า
// อะไรที่มีคำว่าส่งคือขยะ ทั้งที่คำว่า "รายงาน" ในประโยคเดียวกันบอกชัดว่าเป็นงาน
function taskGate(text, parsed) {
  const ev = taskEvidence(text, parsed);
  if (ev === 'strong') return { pass: true, why: 'rule' };  // ห้ามพลิกทิ้ง

  const learned = brainScore(text);   // 0 ตลอด จนกว่าจะถูกสอนครบทั้งสองฝั่ง

  if (ev === 'weak') {
    // ก้ำกึ่ง — ตรงนี้แหละที่สิ่งที่เรียนรู้จากห้องนี้มีค่าที่สุด
    return learned <= -BRAIN_FLIP ? { pass: false, why: 'learned' } : { pass: true, why: 'rule' };
  }
  return learned >= BRAIN_FLIP ? { pass: true, why: 'learned' } : { pass: false, why: 'rule' };
}

// ---------- ก้อนนี้คือ "ใบสั่งงาน" หรือ "คนคุยกัน" ----------
// ตัดสินจากทั้งก้อน ไม่ใช่ทีละบรรทัด แล้วเอาคำตอบไปใช้สองที่:
//   1. ตัดสินว่าข้อความหลายบรรทัดที่ไม่มีขีดนำหน้า ควรถูกตัดเป็นหลายงานไหม
//   2. ตัดสินว่าบรรทัดที่ดูจืดในรายการ ควรถูกคัดทิ้งเป็นขยะไหม (ไม่ควร ถ้าเพื่อนบ้านเป็นงานหมด)
// ต้องเป็นเกณฑ์เดียวกันทั้งสองที่ ไม่งั้นแอปจะตัดข้อความเป็นรายการแล้วทิ้งครึ่งรายการทันที
const TASK_LIST_MIN_STRONG = 2;
function isTaskListByEvidence(strongN, total) {
  return strongN >= TASK_LIST_MIN_STRONG && strongN * 2 >= total;
}
function looksLikeTaskList(segments) {
  let n = 0;
  for (const s of segments) if (taskEvidence(s, parseAssignment(s)) === 'strong') n++;
  return isTaskListByEvidence(n, segments.length);
}

// แหล่งที่ข้อมูลไหลเข้ามาเองโดยไม่มีใครสั่ง — พวกนี้ต้องผ่านประตูแรกก่อน
// ส่วนสแกน/พูด/แปะเอง ไม่ต้องกรอง เพราะนักเรียนตั้งใจส่งเข้ามาเองอยู่แล้ว
// ถ้าไปกรองของที่เขาตั้งใจส่ง จะกลายเป็นแอปที่เถียงกับผู้ใช้
const PASSIVE_SOURCES = ['line', 'classroom'];

// ---------- จับซ้ำ ----------
// ครูสั่งงานเดียวกันทั้งในกลุ่ม LINE และ Classroom เป็นเรื่องปกติ
// ถ้าไม่จับซ้ำ นักเรียนจะเห็นงานเดียวกันสองใบแล้วเลิกเชื่อแอปทันที
function normText(s) {
  return String(s || '').toLowerCase().replace(/[\s\-–—.,()"']/g, '');
}

// ข้อความสั้น ๆ ที่บังเอิญเป็นส่วนหนึ่งของกันและกัน ไม่ได้แปลว่าเป็นงานเดียวกัน
// "ทำชีท" อยู่ใน "ทำชีทคณิต" ก็จริง แต่ถ้าครูสั่งชีทสองใบในวิชาเดียวกันคนละสัปดาห์
// ใบที่สองจะถูกกลืนหายไปเงียบ ๆ — ซึ่งเป็นความผิดพลาดที่ไม่มีใครสังเกตจนถึงวันส่ง
// ตรงตัวเป๊ะยอมได้เสมอ · ส่วนแบบ "อยู่ในกันและกัน" ต้องยาวพอที่จะไม่ใช่ความบังเอิญ
const DUP_CONTAIN_MIN = 8;

// เทียบสองงานว่าเป็นใบเดียวกันไหม — ใช้ทั้งกับงานที่รับเข้าแผนแล้วและของที่ยังค้างในกล่อง
function sameAssignment(a, b) {
  if (!a || !b) return false;
  if ((a.subject || '') !== (b.subject || '')) return false;
  const x = normText(a.detail), y = normText(b.detail);
  if (!x || !y) return false;
  const same = x === y
    || (x.includes(y) && y.length >= DUP_CONTAIN_MIN)
    || (y.includes(x) && x.length >= DUP_CONTAIN_MIN);
  if (!same) return false;
  // ข้อความเหมือนกันแต่คนละกำหนดส่ง = ครูสั่งงานแบบเดิมรอบใหม่ ไม่ใช่ของซ้ำ
  if (!a.due || !b.due) return true;
  return Math.abs(new Date(a.due) - new Date(b.due)) < 12 * 3.6e6;
}

// หาว่างานนี้มีอยู่แล้วไหม — ดูสามที่ ไม่ใช่ที่เดียวเหมือนเดิม:
//   1. งานที่อยู่ในแผนแล้ว
//   2. ของที่ยังค้างรอตรวจอยู่ในกล่องเข้า  ← เดิมไม่ได้ดู ครูส่งซ้ำสองรอบก่อนกดรับ = ได้สองใบ
//   3. รายการอื่นในข้อความก้อนเดียวกัน (ส่งผ่าน extra) ← ครูมักเขียนงานเดิมซ้ำท้ายรายการ
//
// คืนค่าเป็น { kind, id, subject, detail, due } เพื่อให้ผู้เรียกบอกผู้ใช้ได้ว่าซ้ำกับ "อะไร"
// การบอกแค่ว่า "ซ้ำ" โดยไม่บอกว่าซ้ำกับใบไหน ทำให้คนไม่กล้าเชื่อว่ามันจับถูกจริง
function findDuplicate(parsed, extra = []) {
  if (!normText(parsed.detail)) return null;

  for (const t of liveTasks()) {
    if (sameAssignment(t, parsed)) return { kind: 'task', id: t.id, subject: t.subject, detail: t.detail, due: t.due };
  }
  for (const it of inboxPending()) {
    for (const c of inboxUnits(it)) {
      if (c.status === 'new' && sameAssignment(c.parsed, parsed)) {
        return { kind: 'inbox', id: it.id, subject: c.parsed.subject, detail: c.parsed.detail, due: c.parsed.due };
      }
    }
  }
  for (const p of extra) {
    if (sameAssignment(p, parsed)) return { kind: 'batch', id: null, subject: p.subject, detail: p.detail, due: p.due };
  }
  return null;
}

// รายการในกล่องเข้าหนึ่งชิ้น อาจเป็นงานเดียว หรือเป็นก้อนที่มีหลายงานอยู่ข้างใน
// ฟังก์ชันนี้ทำให้โค้ดที่เหลือไม่ต้องรู้ว่าเป็นแบบไหน — วนอ่านได้เหมือนกันทั้งสองแบบ
function inboxUnits(item) {
  return item && item.kind === 'batch' ? (item.children || []) : [item];
}

// ---------- ประตูเข้าหลัก ----------
// ทุกแหล่งเรียกฟังก์ชันนี้ฟังก์ชันเดียว ส่งข้อความดิบมาให้
// คืนค่าเป็นรายการที่เกิดขึ้นจริง เพื่อให้ตัวเรียกรู้ว่าควรพาไปหน้าไหนต่อ
function inboxAdd(rawText, sourceId = 'text', meta = {}) {
  const text = String(rawText || '').trim();
  if (!text) return { status: 'empty' };

  // ครูสั่งงานทั้งสัปดาห์ในข้อความเดียวเป็นเรื่องปกติ ไม่ใช่ข้อยกเว้น
  // ต้องตัดเป็นงาน ๆ ก่อนเสมอ ไม่งั้นได้งานเดียวที่มีทุกวิชาปนกันแล้วไม่มีกำหนดส่ง
  const cut = typeof splitAssignments === 'function'
    ? splitAssignments(text) : { multi: false, reason: 'single', segments: [text], header: '' };

  // ครูเขียนเป็นรายการโดยไม่ใส่ขีดและไม่มีหัวเรื่อง — ตัวตัดไม่กล้าตัดให้เอง
  // (ถูกแล้ว: บทสนทนาสามบรรทัดในกลุ่มก็หน้าตาแบบนี้เป๊ะ)
  // ชั้นนี้ตัดสินต่อได้ เพราะเรามี parseAssignment ที่ engine ไม่มีสิทธิ์เรียกในจังหวะนั้น:
  // ถ้าเกินครึ่งของบรรทัดเป็นงานชัด ๆ ในตัวเอง แปลว่ามันคือรายการงานจริง
  if (!cut.multi && cut.reason === 'lines' && cut.segments.length >= 2 && looksLikeTaskList(cut.segments)) {
    cut.multi = true;
  }
  if (cut.multi) return inboxAddBatch(text, cut, sourceId, meta);

  const parsed = parseAssignment(text);
  const conf = inboxConfidence(parsed);
  const dup = findDuplicate(parsed);

  const item = {
    id: uid(), source: sourceId, raw: text, at: new Date().toISOString(),
    parsed, confidence: conf, status: 'new', taskId: null, meta,
  };

  state.inbox = state.inbox || [];
  // ไม่ให้บันทึกโตไม่มีที่สิ้นสุด — กลุ่มที่คุยกันเยอะจะกิน localStorage จนแอปอืด
  if (state.inbox.length > 150) state.inbox.length = 150;

  if (PASSIVE_SOURCES.includes(sourceId)) {
    const gate = taskGate(text, parsed);
    item.why = gate.why;
    if (!gate.pass) {
      // ไม่ทิ้งหายไปเฉย ๆ — เก็บไว้ในบันทึกให้ตอบได้ว่า "ทำไมงานนี้ไม่ขึ้น"
      // แต่ไม่ไปโผล่เป็นคำถามให้ต้องกดทิ้ง
      item.status = 'noise';
      state.inbox.unshift(item);
      save();
      return { status: 'noise', item };
    }
  }

  if (dup) {
    // ไม่ทิ้งเงียบ ๆ — บันทึกไว้ว่าเจอซ้ำ เพื่อให้ตอบได้ว่า "ทำไมงานนี้ไม่ขึ้น"
    item.status = 'duplicate';
    item.taskId = dup.kind === 'task' ? dup.id : null;
    item.dupOf = dup;
    state.inbox.unshift(item);
    save();
    return { status: 'duplicate', item, dup };
  }

  if (conf >= AUTO_ACCEPT && state.settings.autoAccept !== false) {
    const t = inboxToTask(item);
    item.status = 'accepted';
    item.taskId = t.id;
    state.inbox.unshift(item);
    save();
    return { status: 'accepted', item, task: t };
  }

  state.inbox.unshift(item);
  save();
  return { status: 'pending', item };
}

// ---------- ข้อความเดียว หลายงาน ----------
// ทั้งก้อนอยู่รวมกันเป็นรายการเดียวในกล่องเข้า มีเช็คลิสต์อยู่ข้างใน
// เหตุผลที่ไม่แตกเป็น 11 การ์ด: ในสายตาผู้ใช้มันคือ "ข้อความจากครูหนึ่งข้อความ"
// การเห็นสิบเอ็ดการ์ดที่ไม่รู้ว่ามาจากที่เดียวกัน แล้วต้องกดสิบเอ็ดครั้ง
// คือการย้ายงานกรอกข้อมูลจากคีย์บอร์ดไปไว้ที่นิ้วโป้ง ไม่ได้แก้ปัญหาอะไรเลย
function inboxAddBatch(text, cut, sourceId, meta) {
  const parts = cut.segments.map(seg => ({ seg, parsed: parseAssignment(seg) }));

  // ---- บริบทของทั้งก้อนมาก่อนการตัดสินทีละบรรทัด ----
  // ประตูคัดขยะถูกออกแบบมาสำหรับข้อความเดี่ยว ๆ ที่ลอยมาในกลุ่ม จึงต้องการหลักฐานในตัวมันเอง
  // แต่บรรทัดที่อยู่ในรายการการบ้าน มีหลักฐานอยู่ที่ "เพื่อนบ้าน" ของมัน ไม่ใช่ในตัวมันเอง
  //
  // ของจริงที่วัดมา: ในรายการ 11 บรรทัดของครู มี 3 บรรทัดถูกคัดทิ้งเป็นขยะ —
  //   "ทำอินโฟของประวัติศาสตร์และหน้าที่" · "งานชิ้นที่ 6 Blockly ซ้ำ"
  //   "ทำพอร์ตหน้าประวัติการศึกษาให้เสร็จ"
  // ทั้งสามคือการบ้านจริง แค่เขียนสั้นจนไม่มีคำว่าส่ง ไม่มีวันที่ ไม่มีคะแนน
  // เมื่ออีกแปดบรรทัดรอบตัวมันเป็นงานชัด ๆ การเถียงว่าบรรทัดพวกนี้ไม่ใช่งานคือการดื้อกับบริบท
  //
  // เกณฑ์: เกินครึ่งของรายการเป็นงานชัด → ทั้งก้อนคือใบสั่งงาน ทุกบรรทัดผ่าน
  // (ยังปลดติ๊กรายบรรทัดได้ ของที่หลุดเข้ามาผิดจึงเสียแค่หนึ่งแตะ
  //  ส่วนของที่ถูกทิ้งไปเงียบ ๆ ไม่มีใครรู้ว่าเคยมี — ราคาไม่เท่ากัน)
  const strongN = parts.filter(p => taskEvidence(p.seg, p.parsed) === 'strong').length;
  const isTaskList = isTaskListByEvidence(strongN, parts.length);

  const seen = [];   // งานที่รับไปแล้วในก้อนนี้ — ใช้จับซ้ำกันเองภายในข้อความเดียว
  const children = parts.map(({ seg, parsed }) => {
    const c = {
      id: uid(), raw: seg, parsed,
      confidence: inboxConfidence(parsed),
      status: 'new', pick: true, taskId: null, dupOf: null,
    };

    // ประตูคัดขยะทำงานทีละบรรทัด ไม่ใช่ทั้งก้อน — บรรทัด "อย่าลืมเอาเงินมาจ่ายค่าเสื้อ"
    // ที่ปนอยู่กลางรายการงาน ต้องถูกคัดออกได้โดยไม่ทำให้ทั้งก้อนตกไปด้วย
    if (PASSIVE_SOURCES.includes(sourceId) && !isTaskList && !taskGate(seg, parsed).pass) {
      c.status = 'noise'; c.pick = false;
      return c;
    }
    if (isTaskList) c.why = 'list';
    const dup = findDuplicate(parsed, seen);
    if (dup) {
      c.status = 'duplicate'; c.pick = false; c.dupOf = dup;
      if (dup.kind === 'task') c.taskId = dup.id;
      return c;
    }
    seen.push(parsed);
    return c;
  });

  const fresh = children.filter(c => c.status === 'new');
  const item = {
    id: uid(), source: sourceId, kind: 'batch', raw: text, header: cut.header,
    at: new Date().toISOString(), children, meta,
    parsed: (fresh[0] || children[0]).parsed,   // ให้โค้ดเก่าที่อ่าน .parsed ยังทำงานได้
    confidence: fresh.length ? Math.min(...fresh.map(c => c.confidence)) : 0,
    status: 'new', taskId: null,
  };

  state.inbox = state.inbox || [];
  if (state.inbox.length > 150) state.inbox.length = 150;

  // ทั้งก้อนไม่เหลืออะไรใหม่เลย — ซ้ำหมดหรือไม่ใช่งานหมด ไม่ต้องไปกวนให้กดทิ้ง
  if (!fresh.length) {
    item.status = children.some(c => c.status === 'duplicate') ? 'duplicate' : 'noise';
    state.inbox.unshift(item);
    save();
    return { status: item.status, item };
  }

  // เข้าแผนเองได้ก็ต่อเมื่อ **ทุก** ใบในก้อนมั่นใจถึงเกณฑ์
  // ก้อนหนึ่งคือคำตอบเดียวที่ครอบสิบเอ็ดงาน — ปล่อยผ่านทั้งที่มีใบเดียวไม่แน่ใจ
  // คือการเดาแทนผู้ใช้สิบเอ็ดครั้งจากการตัดสินใจครั้งเดียว ราคาของการผิดจึงสูงกว่ากันมาก
  if (fresh.every(c => c.confidence >= AUTO_ACCEPT) && state.settings.autoAccept !== false) {
    for (const c of fresh) { c.taskId = inboxToTask(childShim(item, c)).id; c.status = 'accepted'; }
    item.status = 'accepted';
    state.inbox.unshift(item);
    save();
    return { status: 'accepted', item, count: fresh.length };
  }

  state.inbox.unshift(item);
  save();
  return { status: 'pending', item, count: fresh.length };
}

// ให้ลูกในก้อนหน้าตาเหมือนรายการเดี่ยว เพื่อใช้ inboxToTask ตัวเดิมได้โดยไม่ต้องแยกทาง
function childShim(item, c) {
  return { id: c.id, parsed: c.parsed, source: item.source, raw: c.raw };
}

// ติ๊กเลือก/ไม่เลือกทีละบรรทัด
function inboxPick(itemId, childId) {
  const item = (state.inbox || []).find(i => i.id === itemId);
  const c = item && (item.children || []).find(x => x.id === childId);
  if (!c || c.status === 'accepted') return;
  c.pick = !c.pick;
  // เคยถูกตัดออกเพราะคิดว่าซ้ำ/ไม่ใช่งาน แล้วผู้ใช้ติ๊กกลับ = เราคิดผิด ต้องยอมรับเข้ามา
  if (c.pick && c.status !== 'new') { c.status = 'new'; c.dupOf = null; c.taskId = null; }
  save(); renderInbox();
}

function inboxExpand(itemId) {
  const item = (state.inbox || []).find(i => i.id === itemId);
  if (!item) return;
  item.expanded = true;
  save(); renderInbox();
}

function inboxAcceptBatch(itemId) {
  const item = (state.inbox || []).find(i => i.id === itemId);
  if (!item || item.status !== 'new') return;
  const take = (item.children || []).filter(c => c.pick && c.status === 'new');
  for (const c of take) { c.taskId = inboxToTask(childShim(item, c)).id; c.status = 'accepted'; }
  item.status = 'accepted';
  // สอนจากบรรทัดที่ "คน" เลือกจริง ไม่ใช่จากทั้งก้อน — ก้อนเดียวมีทั้งงานจริงและของที่ไม่ใช่
  for (const c of item.children || []) {
    if (c.status === 'accepted') brainLearn(c.raw, true);
    else if (!c.pick && c.status === 'new') brainLearn(c.raw, false);
  }
  save(); renderAll();
  showToast({ title: `เพิ่มเข้าแผนแล้ว ${take.length} งาน`,
    body: take.length ? take.slice(0, 3).map(c => c.parsed.subject).join(' · ') + (take.length > 3 ? ' …' : '') : '' });
}

function inboxIgnoreBatch(itemId) {
  const item = (state.inbox || []).find(i => i.id === itemId);
  if (!item) return;
  item.status = 'ignored';
  for (const c of item.children || []) if (c.status === 'new') brainLearn(c.raw, false);
  save(); renderAll();
}

// แก้บรรทัดเดียวก่อนรับ — ที่เหลือในก้อนยังค้างรอต่อไป
function inboxEditChild(itemId, childId) {
  const item = (state.inbox || []).find(i => i.id === itemId);
  const c = item && (item.children || []).find(x => x.id === childId);
  if (!c) return;
  c.status = 'ignored'; c.pick = false;   // ฟอร์มจะสร้างงานใหม่ให้เอง
  brainLearn(c.raw, true);
  save();
  openForm(null, c.parsed);
}

// แปลงรายการในกล่องเข้าเป็นงานจริง
function inboxToTask(item) {
  const p = item.parsed;
  const t = {
    id: uid(),
    subject: p.subject, detail: p.detail, teacher: p.teacher || '',
    scorePct: p.scorePct != null ? p.scorePct : null,
    estMin: p.estMin || 30,
    type: p.type || 'homework',
    due: p.due || null,
    done: false, progress: 0,
    // จำไว้ว่างานนี้มาจากไหน — ใช้ตอบคำถาม "งานนี้โผล่มาจากไหน" และใช้กรองในชั้นหนังสือ
    sourceId: item.source, sourceText: item.raw, fromInbox: item.id,
  };
  state.tasks.push(t);
  // typeof กันไว้เพราะ inbox.js ถูกโหลดก่อน app.js — ตอนไฟล์นี้ถูกอ่านยังไม่มีฟังก์ชันนี้
  // (ตอนถูกเรียกจริงมีแล้ว แต่ลำดับโหลดห้ามสลับ จึงไม่พึ่งลำดับ)
  if (typeof funnelTask === 'function') funnelTask(item.source === 'line' ? 'line' : 'inbox');
  return t;
}

function inboxPending() { return (state.inbox || []).filter(i => i.status === 'new'); }

// สามฟังก์ชันข้างล่างนี้คือที่เดียวที่ brain เรียนรู้ — เพราะเป็นที่เดียวที่ "คน" ตัดสิน
function inboxAccept(id) {
  const item = (state.inbox || []).find(i => i.id === id);
  if (!item || item.status !== 'new') return;
  const t = inboxToTask(item);
  item.status = 'accepted'; item.taskId = t.id;
  brainLearn(item.raw, true);
  save(); renderAll();
  showToast({ title: 'เพิ่มเข้าแผนแล้ว', body: `${t.subject} — ${t.detail}` });
}

function inboxIgnore(id) {
  const item = (state.inbox || []).find(i => i.id === id);
  if (!item) return;
  item.status = 'ignored';
  brainLearn(item.raw, false);
  save(); renderAll();
  // บอกให้รู้ตัวว่าเพิ่งสอนไป ไม่งั้นมันดูเหมือนแค่ลบทิ้งเฉย ๆ
  // ครั้งแรก ๆ สำคัญที่สุด เพราะเป็นตอนที่ผู้ใช้ยังไม่รู้ว่าแอปจำได้
  if (brainExamples() <= BRAIN_MIN_EXAMPLES + 2) {
    const need = brainNeeds();
    showToast({ title: 'จำไว้แล้ว',
      body: brainReady() ? 'ข้อความแนวนี้จะถูกคัดออกให้เองตั้งแต่ต้นทาง'
        : need.pos ? `ขอตัวอย่างงานจริงอีก ${need.pos} ครั้งด้วย จะได้ไม่เหมาเอาว่าทุกอย่างคือขยะ`
        : `สอนอีก ${BRAIN_MIN_EXAMPLES - brainExamples()} ครั้ง จะเริ่มคัดให้เอง` });
  }
}

// แก้ก่อนรับ — ส่งเข้าฟอร์มเดิมที่มีอยู่ แล้วให้ฟอร์มเป็นคนบันทึก
function inboxEdit(id) {
  const item = (state.inbox || []).find(i => i.id === id);
  if (!item) return;
  item.status = 'ignored'; // ฟอร์มจะสร้างงานใหม่ให้เอง รายการในกล่องจึงถือว่าจบหน้าที่
  // แก้ก่อนรับ = ยอมรับว่าเป็นงาน แค่รายละเอียดเพี้ยน จึงนับเป็นตัวอย่างฝั่งบวก
  brainLearn(item.raw, true);
  save();
  openForm(null, item.parsed);
}

// ---------- จอ "กล่องเข้า" ----------
function renderInbox() {
  const body = document.getElementById('inboxBody');
  if (!body) return;
  const all = state.inbox || [];
  const wait = inboxPending();
  const recent = all.filter(i => i.status !== 'new').slice(0, 8);

  // นับเป็น "จำนวนงาน" ไม่ใช่ "จำนวนข้อความ" — ข้อความเดียวของครูมีสิบเอ็ดงานได้
  // ตัวเลขที่บอกว่ารอตรวจ 1 ทั้งที่ข้างในมีสิบเอ็ดใบ ทำให้คนไม่กดเข้าไปดู
  const countUnits = (list, ok) => list.reduce((n, i) => n + inboxUnits(i).filter(ok).length, 0);
  const waitN = countUnits(wait, c => c.status === 'new');

  const sub = document.getElementById('inboxSub');
  if (sub) {
    const auto = countUnits(all.filter(i => i.status === 'accepted'), c => c.status === 'accepted');
    sub.textContent = waitN
      ? `รอตรวจ ${waitN} · เข้าแผนเองแล้ว ${auto}`
      : `เข้าแผนเองแล้ว ${auto} รายการ`;
  }

  const head = `<div class="page-head">
    <div class="eyebrow">ของที่ไหลเข้ามาเอง</div>
    <h1 class="page-title">กล่องเข้า</h1>
    <p class="page-sub">AI อ่านทุกอย่างที่เข้ามาก่อน แล้วถามเฉพาะตอนที่ไม่มั่นใจ
      — ที่เหลือเข้าแผนให้เองโดยไม่ต้องกด</p>
  </div>`;

  // ---- การ์ดของก้อนที่มีหลายงาน ----
  // หน้าตาเป็นเช็คลิสต์ ไม่ใช่คำถาม — ของที่แกะได้ครบติ๊กมาให้แล้ว
  // สิ่งที่ผู้ใช้ต้องทำจึงเหลือแค่ "ปลดติ๊กอันที่ไม่เอา" ซึ่งส่วนใหญ่ไม่ต้องทำอะไรเลย
  const CHILD_PREVIEW = 6;
  const childRow = (it, c) => {
    const p = c.parsed;
    const why = c.status === 'duplicate'
      ? 'ซ้ำกับ' + (c.dupOf && c.dupOf.kind === 'inbox' ? 'ที่รออยู่ในกล่อง' : 'งานที่มีอยู่แล้ว')
      : c.status === 'noise' ? 'อ่านแล้วไม่เหมือนงานที่ครูสั่ง'
      : c.status === 'accepted' ? 'เข้าแผนแล้ว'
      : p.due ? fmtDue(p.due, new Date(), p) : 'ไม่เจอกำหนดส่ง';
    const subj = p.subject && p.subject !== 'อื่น ๆ' ? esc(p.subject) + ' · ' : '';
    return `<div class="ibr ${c.pick ? 'on' : 'off'} ${c.status}">
      <button class="ibr-ck" onclick="inboxPick('${it.id}','${c.id}')"
        aria-pressed="${c.pick}" aria-label="เลือกงานนี้">${c.pick ? icon('check') : ''}</button>
      <span class="ibr-bd" onclick="inboxPick('${it.id}','${c.id}')">
        <span class="t">${subj}${esc(p.detail || c.raw)}</span>
        <span class="s ${c.status !== 'new' ? 'flag' : (p.due ? '' : 'miss')}">${esc(why)}</span>
      </span>
      ${c.status === 'accepted' ? ''
        : `<button class="ibr-ed" onclick="inboxEditChild('${it.id}','${c.id}')"
             aria-label="แก้ก่อนรับ">${icon('pencil')}</button>`}
    </div>`;
  };

  const batchCard = it => {
    const s = sourceById(it.source);
    const kids = it.children || [];
    const picked = kids.filter(c => c.pick && c.status === 'new').length;
    const shown = it.expanded ? kids : kids.slice(0, CHILD_PREVIEW);
    const more = kids.length - shown.length;
    return `<article class="ib ib-batch">
      <div class="ib-top">
        <span class="ib-src">${icon(s.icon)}${esc(s.name)}</span>
        <span class="ib-batch-n">${icon('sparkles')}เจอ ${kids.length} งานในข้อความเดียว</span>
      </div>
      <div class="ib-title">${esc(it.header || it.raw.split('\n')[0].slice(0, 60))}</div>
      <div class="ib-rows">${shown.map(c => childRow(it, c)).join('')}</div>
      ${more > 0 ? `<button class="ib-more" onclick="inboxExpand('${it.id}')">${icon('chevron')}ดูอีก ${more} รายการ</button>` : ''}
      <div class="ib-act">
        <button class="ib-go" ${picked ? '' : 'disabled'} onclick="inboxAcceptBatch('${it.id}')">
          ${icon('check')}${picked ? `เพิ่มทั้งหมด ${picked} งาน` : 'ยังไม่ได้เลือกอะไร'}</button>
        <button class="warn" onclick="inboxIgnoreBatch('${it.id}')">ทิ้งทั้งก้อน</button>
      </div>
    </article>`;
  };

  const card = it => {
    if (it.kind === 'batch') return batchCard(it);
    const p = it.parsed, s = sourceById(it.source);
    const pct = Math.round(it.confidence * 100);
    return `<article class="ib">
      <div class="ib-top">
        <span class="ib-src">${icon(s.icon)}${esc(s.name)}</span>
        <span class="ib-conf ${it.confidence >= 0.6 ? 'ok' : 'low'}">มั่นใจ ${pct}%</span>
      </div>
      <div class="ib-title">${esc(p.subject || 'ไม่รู้วิชา')} · ${esc(p.detail || '—')}</div>
      <div class="ib-meta">
        ${p.due ? `<span>${esc(fmtDue(p.due, new Date(), p))}</span>`
          : '<span class="miss">ไม่เจอกำหนดส่ง</span>'}
        ${p.scorePct != null ? `<span>คะแนน ${p.scorePct}%</span>` : ''}
        <span>~${p.estMin || 30} นาที</span>
      </div>
      <div class="ib-raw">${esc(it.raw.slice(0, 140))}${it.raw.length > 140 ? '…' : ''}</div>
      <div class="ib-act">
        <button class="ib-go" onclick="inboxAccept('${it.id}')">${icon('check')}เพิ่มเข้าแผน</button>
        <button onclick="inboxEdit('${it.id}')">${icon('pencil')}แก้ก่อน</button>
        <button class="warn" onclick="inboxIgnore('${it.id}')">ไม่ใช่งาน</button>
      </div>
    </article>`;
  };

  const logRow = it => {
    const s = sourceById(it.source);
    const label = it.status === 'accepted' ? 'เข้าแผนเอง'
      : it.status === 'duplicate' ? 'ซ้ำกับที่มีอยู่ — ไม่เพิ่มให้'
      : it.status === 'noise' ? (it.why === 'learned'
          ? 'ไม่ใช่งาน — จำได้จากที่คุณเคยลบ' : 'ไม่ใช่งาน — ข้ามให้เอง')
      : 'ข้ามไป';

    // ก้อนที่จบไปแล้ว บอกเป็นตัวเลขว่าเข้าไปกี่ใบ ข้ามกี่ใบ
    // ("เข้าแผนเอง · การบ้านประจำสัปดาห์" ไม่ได้บอกอะไรเลยว่าเกิดอะไรขึ้นกับสิบเอ็ดบรรทัดนั้น)
    if (it.kind === 'batch') {
      const kids = it.children || [];
      const took = kids.filter(c => c.status === 'accepted').length;
      const dup = kids.filter(c => c.status === 'duplicate').length;
      const skip = kids.length - took - dup;
      const parts = [took ? `เข้าแผน ${took}` : '', dup ? `ซ้ำ ${dup}` : '', skip ? `ข้าม ${skip}` : ''];
      return `<div class="ib-log ${it.status}">
        <span class="ib-log-ic">${icon(s.icon)}</span>
        <span class="ib-log-bd">
          <span class="t">${esc(it.header || it.raw.split('\n')[0].slice(0, 40))} · ${kids.length} งาน</span>
          <span class="s">${esc(parts.filter(Boolean).join(' · '))} · ${esc(s.name)}</span>
        </span>
      </div>`;
    }
    return `<div class="ib-log ${it.status}">
      <span class="ib-log-ic">${icon(s.icon)}</span>
      <span class="ib-log-bd">
        <span class="t">${esc(it.parsed.subject || '')} · ${esc(it.parsed.detail || it.raw.slice(0, 40))}</span>
        <span class="s">${esc(label)} · ${esc(s.name)}</span>
      </span>
    </div>`;
  };

  body.innerHTML = head
    + (wait.length
      ? `<div class="sec-title">รอคุณตัดสินใจ ${waitN} รายการ</div>` + wait.map(card).join('')
      : `<div class="ib-empty">
          <div class="ib-empty-ic">${icon('check-circle')}</div>
          <div class="ib-empty-t">ไม่มีอะไรค้างให้ตรวจ</div>
          <p class="ib-empty-p">ของที่ AI มั่นใจพอ เข้าแผนไปเองหมดแล้ว</p>
        </div>`)
    + (recent.length ? `<div class="sec-title">ที่ผ่านมา</div>` + recent.map(logRow).join('') : '')
    + brainCard()
    + `<button class="ib-wide" onclick="go('scr-sources')">${icon('chevron')}จัดการแหล่งข้อมูล</button>`;
}

// ---------- จอ "แหล่งข้อมูล" ----------
// บอกตรง ๆ ว่าอันไหนต่อได้แล้ว อันไหนยัง และติดอะไรอยู่
// ไม่เขียนว่า "เร็ว ๆ นี้" ลอย ๆ เพราะมันไม่ได้บอกอะไรกับใครเลย
function renderSources() {
  const body = document.getElementById('srcBody');
  if (!body) return;
  const counts = {};
  for (const i of state.inbox || []) counts[i.source] = (counts[i.source] || 0) + 1;

  body.innerHTML = `<div class="page-head">
      <div class="eyebrow">ทางที่ข้อมูลไหลเข้า</div>
      <h1 class="page-title">แหล่งข้อมูล</h1>
      <p class="page-sub">ยิ่งเชื่อมได้มาก นักเรียนยิ่งไม่ต้องพิมพ์อะไรเลย</p>
    </div>
    <div class="sec-title">ใช้ได้แล้ว</div>
    ${SOURCES.filter(s => s.live).map(s => `<div class="src on">
      <span class="src-ic">${icon(s.icon)}</span>
      <span class="src-bd"><span class="t">${esc(s.name)}</span><span class="s">${esc(s.desc)}</span>
        ${s.note ? `<span class="src-note">${esc(s.note)}</span>` : ''}
        ${s.link === 'line' ? lineLinkPanel() : ''}</span>
      ${s.viaInbox ? `<span class="src-n">${counts[s.id] || 0}</span>` : ''}
    </div>`).join('')}

    <div class="sec-title">ยังต่อไม่ได้</div>
    ${SOURCES.filter(s => !s.live).map(s => `<div class="src">
      <span class="src-ic off">${icon(s.icon)}</span>
      <span class="src-bd"><span class="t">${esc(s.name)}</span><span class="s">${esc(s.desc)}</span>
        <span class="src-need">${icon('lock')}${esc(s.needs)}</span>
        ${s.note ? `<span class="src-note">${esc(s.note)}</span>` : ''}</span>
    </div>`).join('')}

    <p class="src-foot">ที่ยังต่อไม่ได้ ติดที่การเปิดบัญชีนักพัฒนา ไม่ได้ติดที่โค้ด —
      เปิดได้เมื่อไหร่ เสียบเข้ากล่องเข้าได้ทันทีโดยไม่ต้องแก้ส่วนอื่นของแอป</p>`;
}
