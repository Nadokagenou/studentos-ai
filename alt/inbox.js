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
function findDuplicate(parsed) {
  const key = normText(parsed.detail);
  if (!key) return null;
  const due = parsed.due ? new Date(parsed.due) : null;
  return liveTasks().find(t => {
    if (t.subject !== parsed.subject) return false;
    const a = normText(t.detail);
    if (!a || !key) return false;
    const same = a === key || a.includes(key) || key.includes(a);
    if (!same) return false;
    if (!due || !t.due) return true;
    return Math.abs(new Date(t.due) - due) < 12 * 3.6e6; // กำหนดส่งห่างกันไม่เกินครึ่งวัน = งานเดียวกัน
  }) || null;
}

// ---------- ประตูเข้าหลัก ----------
// ทุกแหล่งเรียกฟังก์ชันนี้ฟังก์ชันเดียว ส่งข้อความดิบมาให้
// คืนค่าเป็นรายการที่เกิดขึ้นจริง เพื่อให้ตัวเรียกรู้ว่าควรพาไปหน้าไหนต่อ
function inboxAdd(rawText, sourceId = 'text', meta = {}) {
  const text = String(rawText || '').trim();
  if (!text) return { status: 'empty' };

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
    item.taskId = dup.id;
    state.inbox.unshift(item);
    save();
    return { status: 'duplicate', item, task: dup };
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

  const sub = document.getElementById('inboxSub');
  if (sub) {
    const auto = all.filter(i => i.status === 'accepted').length;
    sub.textContent = wait.length
      ? `รอตรวจ ${wait.length} · เข้าแผนเองแล้ว ${auto}`
      : `เข้าแผนเองแล้ว ${auto} รายการ`;
  }

  const head = `<div class="page-head">
    <div class="eyebrow">ของที่ไหลเข้ามาเอง</div>
    <h1 class="page-title">กล่องเข้า</h1>
    <p class="page-sub">AI อ่านทุกอย่างที่เข้ามาก่อน แล้วถามเฉพาะตอนที่ไม่มั่นใจ
      — ที่เหลือเข้าแผนให้เองโดยไม่ต้องกด</p>
  </div>`;

  const card = it => {
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
      ? `<div class="sec-title">รอคุณตัดสินใจ ${wait.length} รายการ</div>` + wait.map(card).join('')
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
        <span class="src-need">${icon('flame')}${esc(s.needs)}</span>
        ${s.note ? `<span class="src-note">${esc(s.note)}</span>` : ''}</span>
    </div>`).join('')}

    <p class="src-foot">ที่ยังต่อไม่ได้ ติดที่การเปิดบัญชีนักพัฒนา ไม่ได้ติดที่โค้ด —
      เปิดได้เมื่อไหร่ เสียบเข้ากล่องเข้าได้ทันทีโดยไม่ต้องแก้ส่วนอื่นของแอป</p>`;
}
