// ============================================================
// brain — ตัวที่เรียนรู้ว่า "อะไรคืองาน" จากคนใช้จริง  ·  *** ALT ***
// ------------------------------------------------------------
// กฎคำที่เขียนตายตัวใน inbox.js เก่งได้ระดับหนึ่ง แต่ไม่มีวันรู้ว่า
// ห้องนี้ ครูคนนี้ กลุ่มนี้ พิมพ์แบบไหน — คนที่รู้คือเจ้าของเครื่องเอง
// ทุกครั้งที่กด "ไม่ใช่งาน" หรือ "เพิ่มเข้าแผน" คือการสอนหนึ่งครั้ง
//
// กติกาที่ยึดไว้ 4 ข้อ:
//
//   1. เรียนจากคนเท่านั้น — ห้ามเรียนจากผลที่ตัวเองตัดสิน
//      ถ้าเอาคำตอบตัวเองมาสอนตัวเอง ความเชื่อผิดจะถูกตอกย้ำจนเพี้ยนหนักขึ้นเรื่อย ๆ
//
//   2. เงียบจนกว่าจะรู้จริง — สอนไม่ถึงเกณฑ์ ไม่ออกความเห็นเลย
//      แอปที่เดาสุ่มตั้งแต่วันแรกน่ารำคาญกว่าแอปที่ยังไม่ฉลาด
//
//   3. ค้านกฎได้ แต่ต้องมั่นใจมากเท่านั้น
//      ของที่พูดถึงคะแนนชัด ๆ ห้ามพลิกทิ้งเด็ดขาด แพงเกินกว่าจะเสี่ยง
//
//   4. ทุกอย่างอยู่ในเครื่อง ไม่มีข้อความไหนถูกส่งไปให้ใครวิเคราะห์
//
// วิธี: Naive Bayes บนตัวอักษร 3 ตัวติดกัน (character trigram)
// ภาษาไทยไม่เว้นวรรคระหว่างคำ การตัดคำจึงต้องใช้พจนานุกรมและพลาดบ่อย
// แต่ trigram ไม่ต้องรู้จักคำเลย — "การบ้าน" ให้ กา/ารบ/รบ้/บ้า/้าน ซึ่งพอ
// เจอซ้ำหลายครั้งก็แยกออกเองว่าชุดไหนมากับงาน ชุดไหนมากับการคุยเล่น
// ============================================================

// เก็บใน settings เพราะอันนี้เป็นของ "บัญชี" ไม่ใช่ของ "เครื่อง" —
// เปลี่ยนมือถือแล้วความฉลาดที่สอนไว้ต้องตามไปด้วย (settings ซิงก์ขึ้น cloud อยู่แล้ว)
function brain() {
  state.settings = state.settings || {};
  if (!state.settings.brain) state.settings.brain = { pos: {}, neg: {}, nPos: 0, nNeg: 0 };
  return state.settings.brain;
}

// ต้องมีตัวอย่างครบ "ทั้งสองฝั่ง" ถึงจะเริ่มออกความเห็น ไม่ใช่นับรวมกัน
// โมเดลที่เห็นแต่ของที่ถูกลบ จะสรุปว่าทุกอย่างคือขยะ — ทดสอบแล้วเจอจริง:
// สอนด้วยข้อความขยะที่มีคำว่า "ส่ง" หกครั้ง มันเริ่มเชื่อว่า "ส่ง" แปลว่าขยะ
// ทั้งที่เป็นคำหลักของการสั่งงาน แล้ว "ส่งการบ้านคณิตพรุ่งนี้" ก็เกือบโดนทิ้ง
const BRAIN_MIN_SIDE = 3;       // ต้องมีอย่างน้อยฝั่งละเท่านี้
const BRAIN_MIN_EXAMPLES = 6;   // และรวมกันต้องถึงเท่านี้
const BRAIN_MIN_SEEN = 2;       // ตัวอักษรชุดที่เพิ่งเห็นครั้งเดียว ยังเชื่อไม่ได้
const BRAIN_FLIP = 0.45;        // ต้องมั่นใจถึงระดับนี้ถึงจะค้านกฎได้
const BRAIN_MAX_GRAMS = 700;    // กันไม่ให้บวมจนซิงก์ขึ้น cloud ช้า

function brainGrams(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' ';
  // ใช้เป็นชุด (มี/ไม่มี) ไม่นับจำนวนซ้ำ — ไม่งั้นข้อความยาว ๆ จะกลบข้อความสั้นหมด
  const set = new Set();
  for (let i = 0; i + 3 <= t.length; i++) set.add(t.slice(i, i + 3));
  return [...set];
}

function brainExamples() { const b = brain(); return b.nPos + b.nNeg; }
function brainReady() {
  const b = brain();
  return b.nPos >= BRAIN_MIN_SIDE && b.nNeg >= BRAIN_MIN_SIDE
    && brainExamples() >= BRAIN_MIN_EXAMPLES;
}

// ยังขาดฝั่งไหนอีกกี่ตัวอย่าง — เอาไปบอกผู้ใช้ตรง ๆ ว่ารออะไรอยู่
function brainNeeds() {
  const b = brain();
  return {
    pos: Math.max(0, BRAIN_MIN_SIDE - b.nPos),
    neg: Math.max(0, BRAIN_MIN_SIDE - b.nNeg),
  };
}

// คืนค่า -1 (มั่นใจว่าไม่ใช่งาน) ถึง +1 (มั่นใจว่าเป็นงาน) · 0 = ไม่ออกความเห็น
//
// วัดเป็น "สัดส่วนภายในฝั่งตัวเอง" ไม่ใช่จำนวนดิบ — จุดนี้สำคัญมาก
// ถ้านับดิบ ฝั่งที่ถูกสอนบ่อยกว่าจะดูดตัวอักษรไทยที่ใช้กันทุกประโยคไปหมด
// แล้วทุกข้อความจะได้คะแนนเอียงไปทางนั้นเท่ากันหมดโดยไม่สนเนื้อหาเลย
// (ทดสอบแล้วเจอจริง: สอนลบ 6 บวก 3 → ทุกประโยคได้ -0.68 เท่ากันหมด)
//
// rp/rn = ชุดตัวอักษรนี้โผล่ในกี่ % ของตัวอย่างฝั่งนั้น
// w = (rp-rn)/(rp+rn) → ชุดที่โผล่พอ ๆ กันทั้งสองฝั่งได้ 0 (ไม่มีความหมาย)
//     ชุดที่โผล่ฝั่งเดียวล้วนได้ ±1 · และไม่ขึ้นกับว่าฝั่งไหนถูกสอนมากกว่ากัน
function brainScore(text) {
  const b = brain();
  if (!brainReady()) return 0;

  let sum = 0, used = 0;
  for (const g of brainGrams(text)) {
    const p = b.pos[g] || 0, n = b.neg[g] || 0;
    if (p + n < BRAIN_MIN_SEEN) continue;
    const rp = p / Math.max(1, b.nPos);
    const rn = n / Math.max(1, b.nNeg);
    if (rp + rn === 0) continue;
    sum += (rp - rn) / (rp + rn);
    used++;
  }
  if (used < 3) return 0;   // หลักฐานน้อยเกินกว่าจะสรุปอะไร
  return Math.tanh((sum / used) * 2.2);
}

// สอนหนึ่งครั้ง — เรียกจากปุ่มที่คนกดเท่านั้น (ดูกติกาข้อ 1)
// ไม่เรียก save() เอง ปล่อยให้ตัวที่เรียกเป็นคนบันทึกทีเดียว จะได้ไม่ซิงก์ซ้ำซ้อน
function brainLearn(text, isTask) {
  const b = brain();
  const bag = isTask ? b.pos : b.neg;
  for (const g of brainGrams(text)) bag[g] = (bag[g] || 0) + 1;
  if (isTask) b.nPos++; else b.nNeg++;
  brainPrune();
}

// ตัดชุดตัวอักษรที่เจอครั้งเดียวทิ้งเมื่อเริ่มบวม — พวกนี้ไม่เคยมีน้ำหนักพอ
// จะโหวตอยู่แล้ว (ติด BRAIN_MIN_SEEN) เก็บไว้ก็เปลืองที่เปล่า ๆ
function brainPrune() {
  const b = brain();
  for (const bag of [b.pos, b.neg]) {
    const keys = Object.keys(bag);
    if (keys.length <= BRAIN_MAX_GRAMS) continue;
    for (const k of keys) if (bag[k] < 2) delete bag[k];
    // ยังเกินอยู่ = ตัดตัวที่นับได้น้อยสุดออกจนพอดี
    const left = Object.keys(bag);
    if (left.length > BRAIN_MAX_GRAMS) {
      left.sort((a, c) => bag[a] - bag[c])
        .slice(0, left.length - BRAIN_MAX_GRAMS)
        .forEach(k => delete bag[k]);
    }
  }
}

function brainReset() {
  state.settings.brain = { pos: {}, neg: {}, nPos: 0, nNeg: 0 };
  save(); renderAll();
  showToast({ title: 'ล้างสิ่งที่เรียนรู้แล้ว',
    body: 'กลับไปใช้กฎพื้นฐานอย่างเดียว แล้วเริ่มเรียนใหม่จากศูนย์' });
}

// ---------- การ์ดบอกสถานะ ----------
// ต้องมองเห็นได้ว่ามันเรียนอะไรไปแล้วบ้าง ไม่งั้นเวลามันคัดผิด
// ผู้ใช้จะรู้สึกว่าแอปมีใจของตัวเองและควบคุมไม่ได้
function brainCard() {
  const b = brain();
  const n = brainExamples();
  if (!n) return '';

  const need = brainNeeds();
  const waiting = [
    need.neg ? `กด “ไม่ใช่งาน” อีก ${need.neg}` : '',
    need.pos ? `กด “เพิ่มเข้าแผน” อีก ${need.pos}` : '',
  ].filter(Boolean).join(' · ');

  const state_ = brainReady()
    ? `ช่วยตัดสินอยู่แล้ว — สอนมา ${n} ครั้ง (เป็นงาน ${b.nPos} · ไม่ใช่งาน ${b.nNeg})`
    : `ยังไม่ออกความเห็น — ${waiting || `อีก ${BRAIN_MIN_EXAMPLES - n} ครั้ง`}`;

  return `<div class="brain">
    <div class="brain-hd">${icon('sparkles')}<span>เรียนรู้จากคุณ</span></div>
    <p class="brain-p">${esc(state_)}</p>
    <p class="brain-sub">ทุกครั้งที่กด “ไม่ใช่งาน” หรือ “เพิ่มเข้าแผน” คือการสอนหนึ่งครั้ง
      · ข้อความทั้งหมดอยู่ในเครื่องคุณ ไม่ได้ส่งไปให้ใครวิเคราะห์</p>
    <button class="brain-rs" onclick="brainReset()">ล้างแล้วเริ่มใหม่</button>
  </div>`;
}
