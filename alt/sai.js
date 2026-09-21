// ============================================================
// น้องไซ (Synara) — มาสคอตที่ขยับตามนิ้ว + ห้องคุยแผน
// ------------------------------------------------------------
// เจ้าของสั่งเอง (21 ก.ย. 2569): "อยากให้มีน้องไซแบบเป็นโมเดลจริง ๆ
// เมาส์ขยับทางไหนหันตาม แล้วมันก็บอกว่า กดเข้ามาสิ เดี๋ยวจะบอกแผนวันนี้ให้
// แล้วก็พาไปห้องนึง" — สามอย่างนี้คือสเปคทั้งหมดของไฟล์นี้
//
// ⚠️ ของที่ไฟล์นี้ **ไม่ใช่**: โมเดล 3 มิติ
// รีโปมีแต่ character sheet ใบเดียว ไม่มี .vrm/.glb และการลาก three.js
// (~600KB) + โมเดล (2–5MB) เข้ามาแคชใน sw.js แปลว่าเด็กทุกคนจ่ายค่าเปิดแอป
// ครั้งแรกช้าลงหลายวินาที เพื่อของที่หันหัวได้ 30 องศา
//
// สิ่งที่ทำแทนคือของที่ให้ "ความรู้สึก" เดียวกันด้วยน้ำหนัก 116KB:
//   1. ภาพเลื่อนอยู่ในกรอบ (object-position) — เธอขยับในกรอบ ไม่ใช่กรอบลากภาพไป
//   2. กรอบเอียงตามนิ้ว (rotate) — ทิศทางที่ตาจับได้ก่อนรายละเอียด
//   3. ลอยขึ้นลงตลอดเวลา — ของนิ่งสนิทอ่านออกทันทีว่าเป็นรูป
//   4. สีหน้าเปลี่ยนตามสถานการณ์จริง 6 แบบ — อันนี้คือของที่ 3D ให้ไม่ได้ฟรี ๆ
// ข้อ 4 สำคัญที่สุด และเป็นเหตุผลที่ character sheet มีค่ากว่าโมเดล:
// มาสคอตที่หันหัวได้แต่หน้าเหมือนเดิมตลอด ไม่ได้รู้จักเราเลยสักนิด
// ============================================================

// ⚠️ ชื่อพวกนี้ขึ้นต้น SYN_ ไม่ใช่ SAI_ เพราะ app.js มี saiFace() ของตัวเองอยู่แล้ว
// (ตัวที่วาดรูปโปรไฟล์บนฟองแชท) และ app.js โหลดทีหลัง — ชื่อชนกันเมื่อไหร่
// ตัวของ app.js ทับทันที แล้ว src ของ <img> จะกลายเป็นก้อน HTML ทั้งก้อน
// อาการคือแท็กดิบโผล่มาเป็นตัวหนังสือกลางการ์ด ซึ่งอ่านไม่ออกเลยว่าสาเหตุคืออะไร
const SYN_FACES = {
  normal:  'sai-face-normal.webp',
  happy:   'sai-face-happy.webp',
  wow:     'sai-face-wow.webp',
  serious: 'sai-face-serious.webp',
  sleepy:  'sai-face-sleepy.webp',
  sulk:    'sai-face-sulk.webp',
};
const SYN_CHIBI = 'sai-chibi.webp';

function synFace(key) { return SYN_FACES[key] || SYN_FACES.normal; }

// ============================================================
// การหันตาม
// ------------------------------------------------------------
// เทียบกับกลางจอ ไม่ใช่กลางตัวเธอ — จงใจ
// ถ้าเทียบกับตัวเธอ ต้องอ่าน getBoundingClientRect() ทุกเฟรม ซึ่งบังคับให้
// เบราว์เซอร์คำนวณ layout ใหม่ 60 ครั้งต่อวินาที บนเครื่องที่เด็กใช้จริง
// (มือถือ Android ราคาห้าพัน) นั่นคือจอที่กระตุกตอนเลื่อน
// เทียบกับกลางจอให้ผลที่ตาแยกไม่ออก ด้วยราคาศูนย์
// ============================================================
let saiPX = 0, saiPY = 0;     // เป้า −1…1
let saiCX = 0, saiCY = 0;     // ค่าที่วาดจริง (ไล่ตามเป้าแบบหน่วง)
let saiLoop = false;
let saiTouched = false;       // เคยมีนิ้ว/เมาส์เข้ามาหรือยัง

function saiAim(x, y) {
  saiTouched = true;
  saiPX = Math.max(-1, Math.min(1, (x / window.innerWidth - 0.5) * 2.2));
  saiPY = Math.max(-1, Math.min(1, (y / window.innerHeight - 0.5) * 2.2));
}

function saiTick() {
  const els = document.querySelectorAll('.saih-stage, .saip-stage');
  // ไม่มีเวทีบนจอ = หยุดลูปทิ้ง · saiStart() จะปลุกใหม่เองตอนมีเวทีโผล่
  // ลูปที่เดินต่อไปเรื่อย ๆ ทั้งที่ไม่มีอะไรให้ขยับ คือแบตที่หายไปโดยไม่มีใครได้อะไร
  if (!els.length) { saiLoop = false; return; }

  // ไม่เคยมีนิ้วแตะเลย (เปิดแอปทิ้งไว้ · เครื่องที่ไม่มีเมาส์) — แกว่งเองช้า ๆ
  // มาสคอตที่นิ่งสนิทจนกว่าจะมีคนแตะ คือรูปติดผนัง ไม่ใช่ตัวละคร
  if (!saiTouched) {
    const t = Date.now() / 2600;
    saiPX = Math.sin(t) * 0.38;
    saiPY = Math.sin(t * 0.7) * 0.22;
  }

  saiCX += (saiPX - saiCX) * 0.09;
  saiCY += (saiPY - saiCY) * 0.09;
  const sx = saiCX.toFixed(3), sy = saiCY.toFixed(3);
  els.forEach(el => { el.style.setProperty('--sx', sx); el.style.setProperty('--sy', sy); });
  requestAnimationFrame(saiTick);
}

function saiStart() {
  if (saiLoop) return;
  saiLoop = true;
  requestAnimationFrame(saiTick);
}

window.addEventListener('mousemove', e => saiAim(e.clientX, e.clientY), { passive: true });
window.addEventListener('touchmove', e => {
  if (e.touches && e.touches[0]) saiAim(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
// แตะครั้งเดียวแล้วปล่อย (ไม่ได้ลาก) ก็ยังเป็นทิศทาง — touchmove อย่างเดียวจะพลาดเคสนี้ทั้งหมด
window.addEventListener('touchstart', e => {
  if (e.touches && e.touches[0]) saiAim(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

// ============================================================
// อารมณ์ — มาจากสถานะจริงของวันนี้ ไม่ใช่สุ่ม
// ------------------------------------------------------------
// ทุกเส้นตรงนี้ต้องอธิบายได้ว่า "ทำไมเธอทำหน้านี้" ถ้าตอบไม่ได้แปลว่าเป็นของตกแต่ง
// และมาสคอตที่ทำหน้าสุ่มคือมาสคอตที่สีหน้าไม่มีความหมาย ซึ่งแย่กว่าหน้าเดียวตลอด
// ============================================================
function saiMood(sp, now) {
  const h = now.getHours();
  const pend = typeof pendingTasks === 'function' ? pendingTasks().length : 0;

  // ดึกแล้ว — ง่วงก่อนเรื่องอื่นทั้งหมด เพราะมันคือสิ่งที่จริงที่สุดตอนนั้น
  if (h >= 22 || h < 5) return 'sleepy';

  // มีงานที่ด่วนจริง (เอนจินให้ 4 ดาวขึ้นไป หรือเลยกำหนดไปแล้ว)
  if (sp && sp.now) {
    const t = sp.now.task;
    const stars = (sp.now.info && sp.now.info.stars) || 0;
    if (stars >= 4 || (t.due && new Date(t.due) < now)) return 'serious';
    return 'normal';
  }

  // ไม่มีอะไรต้องนั่งทำ แต่ของค้างกองอยู่ = ไม่ใช่ข่าวดี
  if (pend >= 8) return 'sulk';
  return 'happy';
}

// ============================================================
// ใบเล็กบนหน้าวันนี้
// ------------------------------------------------------------
// ตำแหน่ง: ใต้ช่องถามน้องไซ เหนือการ์ด "ตอนนี้" (เจ้าของวงไว้ในภาพ)
// ทั้งใบเป็นปุ่มเดียว ไม่มีปุ่มซ้อนปุ่ม — เป้าแตะ 76px บนมือถือคือของที่กดพลาดไม่ได้
// ============================================================
function saiHero(ctx) {
  const now = (ctx && ctx.now) || new Date();
  const sp = (ctx && ctx.sp) || null;
  const mood = saiMood(sp, now);
  const name = (typeof who === 'function' && who()) ? who() : '';

  // ประโยคต้องเปลี่ยนตามของจริง ไม่งั้นอ่านรอบที่สามก็เลิกอ่าน
  // และต้องไม่ทับสิ่งที่การ์ดข้างล่างพูด — การ์ด "ตอนนี้" บอกว่าทำอะไร
  // ใบนี้บอกแค่ว่า "มีเรื่องจะเล่า" ซึ่งเป็นคนละข้อมูล
  let line, sub;
  if (mood === 'sleepy') {
    line = 'ดึกแล้วนะ' + (name ? ' ' + name : '');
    sub  = 'กดมาคุยกัน เดี๋ยวสรุปให้สั้น ๆ แล้วไปนอน';
  } else if (mood === 'serious') {
    line = 'วันนี้มีใบที่รอไม่ได้อยู่';
    sub  = 'กดมาหาเรา เดี๋ยวเล่าแผนวันนี้ให้ทีละข้อ';
  } else if (mood === 'sulk') {
    line = 'ของค้างเริ่มเยอะแล้วนะ';
    sub  = 'กดมาคุยกัน เดี๋ยวช่วยเลือกให้ว่าเริ่มจากใบไหน';
  } else if (mood === 'happy') {
    line = 'วันนี้โล่งมากเลย' + (name ? ' ' + name : '');
    sub  = 'กดมาหาเรา เดี๋ยวเล่าให้ฟังว่าเหลืออะไรบ้าง';
  } else {
    line = 'แผนวันนี้พร้อมแล้ว';
    sub  = 'กดเข้ามาในตัวเรา เดี๋ยวบอกแผนวันนี้ให้';
  }

  const dot = mood === 'serious' || mood === 'sulk';

  return `<button type="button" class="saih" onclick="openSaiPlan()">
    <span class="saih-bubble">
      <b>${esc(line)}</b>
      <span>${esc(sub)}</span>
      <span class="saih-go">${icon('sparkles')}เข้าห้องน้องไซ</span>
    </span>
    <span class="saih-stage">
      <span class="saih-ring"></span>
      ${dot ? '<span class="saih-dot"></span>' : ''}
      <img class="saih-face" src="${synFace(mood)}" alt="น้องไซ" width="76" height="76">
    </span>
  </button>`;
}

// ============================================================
// ห้องคุยแผน
// ------------------------------------------------------------
// หนึ่งจอ = หนึ่งเรื่อง · กดต่อไปเรื่อย ๆ จนจบแล้วเริ่มทำ
//
// ทำไมไม่โชว์ทั้งแผนทีเดียว: หน้าวันนี้โชว์ทั้งแผนไปแล้ว และมันคือจอที่เจ้าของ
// บอกเองว่าอ่านแล้วเหนื่อย · ห้องนี้ขายของคนละอย่างคือ "มีคนเล่าให้ฟัง"
// ซึ่งพังทันทีที่โชว์หกข้อพร้อมกัน เพราะนั่นกลับไปเป็นลิสต์อีกใบ
// ============================================================
let saiSteps = [];
let saiAt = 0;

function openSaiPlan() {
  saiAt = 0;
  saiSteps = saiBuild(new Date());
  go('scr-sai');
  renderSaiPlan();
}

function saiClose() { go('scr-menu'); }

function saiNext() {
  if (saiAt >= saiSteps.length - 1) {
    const s = saiSteps[saiAt];
    // ปุ่มสุดท้ายต้องพาไปลงมือจริง ไม่ใช่แค่ปิดจอ
    // ห้องที่เล่าแผนจบแล้วโยนกลับหน้าเดิม คือห้องที่ไม่ได้เปลี่ยนอะไรเลย
    if (s && s.taskId && typeof startFocus === 'function') { startFocus(s.taskId); return; }
    saiClose();
    return;
  }
  saiAt++;
  renderSaiPlan();
}

// ---------- ประกอบบทพูดจากแผนจริง ----------
// ทุกข้อต้องมาจาก state ไม่มีข้อไหนเป็นคำให้กำลังใจลอย ๆ
// ("สู้ ๆ นะ" ไม่ได้บอกว่าทำไมใบนี้มาก่อนใบอื่น — เป็นบทเรียนเดียวกับการ์ด NOW)
function saiBuild(now) {
  const sp = typeof focusPlan === 'function' ? focusPlan(now) : null;
  const name = (typeof who === 'function' && who()) ? who() : '';
  const hi = now.getHours();
  const greet = hi < 12 ? 'สวัสดีตอนเช้า' : hi < 17 ? 'สวัสดีตอนบ่าย' : hi < 22 ? 'สวัสดีตอนเย็น' : 'ดึกแล้วนะ';
  const steps = [];

  const budget = (sp && sp.plan && sp.plan.windows && sp.plan.windows.budgetMin) || 0;
  const slots = (sp && sp.plan && sp.plan.slots) || [];
  const work = slots.filter(s => !s.break);
  const pend = typeof pendingTasks === 'function' ? pendingTasks().length : 0;

  // ---- 1) ทักทาย + เวลาที่มีจริง ----
  steps.push({
    face: hi >= 22 || hi < 5 ? 'sleepy' : 'happy',
    head: greet + (name ? ' ' + name : ''),
    body: budget > 0
      ? 'นับจากตอนนี้ไป หักเวลาเรียนกับกิจวัตรออกแล้ว เหลือเวลาทำงานได้จริงเท่านี้'
      : 'วันนี้ไม่เหลือช่องว่างที่ยาวพอจะทำงานแล้ว เดี๋ยวเล่าให้ฟังว่าเหลืออะไรบ้าง',
    chips: budget > 0
      ? [{ ic: 'clock', tx: ctxHours(budget) }]
      : [],
  });

  // ---- 2) เริ่มจากใบไหน + ทำไมใบนั้น ----
  if (sp && sp.now) {
    const t = sp.now.task, info = sp.now.info || {};
    const late = t.due && new Date(t.due) < now;
    const stars = info.stars || 0;
    const subj = t.subject && t.subject !== 'อื่น ๆ' ? t.subject : '';
    const why = late && typeof overdueFor === 'function'
      ? 'เลยกำหนดมา ' + overdueFor(now - new Date(t.due))
      : (typeof topReason === 'function' ? topReason(info) : '');
    const chips = [];
    if (subj) chips.push({ ic: 'target', tx: subj });
    if (sp.now.slot && typeof fmtClock === 'function') {
      chips.push({ ic: 'clock', tx: 'เริ่ม ' + fmtClock(sp.now.slot.start) });
    }
    if (why) chips.push({ ic: late ? 'flame' : 'calendar', tx: why, hot: late || stars >= 4 });

    steps.push({
      face: late || stars >= 4 ? 'serious' : 'normal',
      head: t.detail || t.title || (typeof typeInfo === 'function' ? typeInfo(t).name : 'งานแรก'),
      body: 'เราเลือกใบนี้ขึ้นมาก่อน เพราะแบบนี้',
      chips,
    });
  }

  // ---- 3) ช่วงเวลาที่วางไว้ ----
  // โชว์ไม่เกินสามช่อง · ช่องที่สี่เป็นต้นไปอยู่บนรางในหน้าวันนี้อยู่แล้ว
  // และคนที่ฟังอยู่จำเกินสามช่องไม่ได้ในรอบเดียว
  if (work.length > 1 && typeof fmtClock === 'function') {
    steps.push({
      face: 'normal',
      head: 'แล้วเรียงต่อกันแบบนี้',
      body: work.length > 3
        ? 'สามช่องแรกก่อน ที่เหลืออีก ' + (work.length - 3) + ' ช่องอยู่บนรางในหน้าวันนี้'
        : 'กะเวลาไว้ให้แล้ว ไม่ต้องคิดเองว่าจะเริ่มตอนไหน',
      chips: work.slice(0, 3).map(s => ({
        ic: 'clock',
        tx: fmtClock(s.start) + ' · ' + (s.task && (s.task.subject && s.task.subject !== 'อื่น ๆ'
          ? s.task.subject : (s.task.detail || 'งาน'))),
      })),
    });
  }

  // ---- 4) ของที่ยังค้าง ----
  if (pend > 0) {
    steps.push({
      face: pend >= 8 ? 'sulk' : 'normal',
      head: 'ยังค้างอยู่ ' + pend + ' งาน',
      body: pend >= 8
        ? 'เยอะอยู่นะ แต่ไม่ต้องทำวันนี้ทั้งหมด วันนี้เอาที่วางไว้ให้จบก่อนพอ'
        : 'ทั้งหมดยังอยู่ในแท็บงาน ไม่ต้องกลัวว่าจะลืมใบไหน',
      chips: [],
    });
  }

  // ---- 5) ปิดท้าย: ลงมือ ----
  if (sp && sp.now) {
    steps.push({
      face: 'wow',
      head: 'เริ่มเลยไหม',
      body: 'กดแล้วเข้าโหมดโฟกัสให้เลย จับเวลาให้ด้วย ไม่ต้องตั้งเอง',
      chips: [],
      taskId: sp.now.task.id,
      cta: 'เริ่มทำเลย',
      ctaIc: 'play',
    });
  } else {
    steps.push({
      face: 'happy',
      head: pend > 0 ? 'วันนี้เท่านี้ก่อน' : 'วันนี้ไม่มีงานค้างเลย',
      body: pend > 0
        ? 'ไม่เหลือช่องที่ยาวพอแล้ว พรุ่งนี้เริ่มใหม่ได้เต็มวัน'
        : 'ครูสั่งอะไรมาใหม่ก็โยนเข้ามาได้เลย เดี๋ยวจัดให้',
      chips: [],
      cta: 'กลับหน้าวันนี้',
      ctaIc: 'check',
    });
  }

  return steps;
}

function renderSaiPlan() {
  const el = document.getElementById('saiBody');
  if (!el) return;
  if (!saiSteps.length) saiSteps = saiBuild(new Date());
  const s = saiSteps[Math.min(saiAt, saiSteps.length - 1)] || {};
  const last = saiAt >= saiSteps.length - 1;

  const chips = (s.chips || []).map(c =>
    `<span class="saip-chip${c.hot ? ' hot' : ''}">${icon(c.ic || 'clock')}${esc(c.tx)}</span>`
  ).join('');

  // ชิบิใช้เฉพาะข้อแรกกับข้อสุดท้าย (ทักทาย/ปิดท้าย) ที่เหลือใช้ใบหน้า
  // เพราะข้อกลาง ๆ พูดเรื่องงาน แล้วตัวเต็มกินที่เกินครึ่งจอจนตัวหนังสือถูกดันลงไป
  const useChibi = saiAt === 0;

  el.innerHTML = `
    <div class="saip-top">
      <div class="saip-dots">${saiSteps.map((_, i) =>
        `<i class="${i <= saiAt ? 'on' : ''}"></i>`).join('')}</div>
      <button class="saip-x" onclick="saiClose()" aria-label="ปิด">
        <svg viewBox="0 0 24 24"><use href="#lu-x"/></svg></button>
    </div>

    <div class="saip-mid">
    <div class="saip-stage">
      <span class="saip-glow"></span>
      ${useChibi
        ? `<img class="saip-chibi" src="${SYN_CHIBI}" alt="น้องไซ">`
        : `<img class="saip-face" src="${synFace(s.face)}" alt="น้องไซ">`}
    </div>

    <div class="saip-say saip-in">
      <h3>${esc(s.head || '')}</h3>
      ${s.body ? `<p>${esc(s.body)}</p>` : ''}
      ${chips}
    </div>

    </div>

    <div class="saip-act">
      <button class="saip-next" onclick="saiNext()">
        ${icon(last ? (s.ctaIc || 'check') : 'chevron')}${esc(last ? (s.cta || 'จบแล้ว') : 'ต่อไป')}
      </button>
      ${last ? '' : '<button class="saip-skip" onclick="saiClose()">ข้ามไปก่อน</button>'}
    </div>`;

  saiStart();
}
