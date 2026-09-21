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
      ${dot ? '<span class="saih-dot"></span>' : ''}
      <img class="saih-face" src="${synFace(mood)}" alt="น้องไซ" width="76" height="76">
    </span>
  </button>`;
}
// ============================================================
// แผนวันนี้ — ห้องของน้องไซ
// ------------------------------------------------------------
// ประวัติของจอนี้สั้นแต่สอนเยอะ เก็บไว้ทั้งสามรอบเพราะรอบถัดไปจะได้ไม่วนกลับ:
//
//   1C18  สไลด์ทีละข้อแบบ Duolingo
//         → ตีกลับ: "อยากให้เป็นเหมือนหน้าจอปกติ" + "ย้อนกลับไม่ได้ด้วย"
//   1C19  จอเลื่อนได้ เส้นเวลาตั้งแต่ตื่นจนนอน
//         → ตีกลับ: "ก็ยังดูธรรมดา ๆ อะ ถึงแม้จะมีแผนแต่ไม่ต่างอะไร
//                    หรือไม่มีคุณค่าอื่น มันก็ไร้ค่า"
//   1C20  จอนี้
//
// คำตีกลับรอบสองคือโจทย์จริง และมันถูก: **ปฏิทินก็ทำได้**
// รายการเวลาที่เรียงจากเช้าถึงเย็นคือของที่ Google Calendar ให้ฟรีมาสิบปีแล้ว
// แอปนี้ไม่ได้มีเอนจินตัดสินใจไว้เพื่อวาดตารางให้สวยกว่าเดิม
//
// สิ่งที่ปฏิทินตอบไม่ได้ และจอนี้ต้องตอบ มีสามข้อ:
//   1. ทำตามแผนนี้แล้ว "ได้อะไร" — ส่งทันกี่ใบ
//   2. ไม่ทำแล้ว "เสียอะไร" — พรุ่งนี้ต้องทำรวดกี่ชั่วโมง
//   3. หลังทำงานครบแล้ว "เหลือเวลาเป็นของตัวเองเท่าไหร่"
// ทั้งสามข้อคำนวณจาก state จริงทั้งหมด ไม่มีข้อไหนเป็นคำพูดให้กำลังใจ
// ถ้าวันไหนตัวเลขออกมาไม่สวย มันก็ต้องขึ้นตามนั้น — ตัวเลขที่สวยเสมอคือตัวเลขที่ไม่มีใครเชื่อ
//
// และเส้นเวลาถูกทำให้ "สูงตามเวลาจริง" — เรียนแปดชั่วโมงต้องกินที่มากกว่าพักสิบนาที
// สิบเท่า ไม่ใช่เท่ากันเพราะบรรทัดละหนึ่งแถว · นี่คือความต่างระหว่างการอ่านตาราง
// กับการ "เห็น" ว่าวันหนึ่งหมดไปกับอะไร
// ============================================================

function openSaiPlan() {
  saiTour = -1;             // ออกจากโหมดเล่าทีละข้อเสมอตอนเข้าจอใหม่
  go('scr-sai');
  renderSaiPlan();
}

// ============================================================
// สามตัวเลขที่ปฏิทินให้ไม่ได้
// ------------------------------------------------------------
// นิยามที่ใช้ และเหตุผลที่เลือกนิยามนี้:
//
//   soon     งานที่ถึงกำหนดภายใน 36 ชม. — ครอบ "พรุ่งนี้ 23:59" ซึ่งเป็นกำหนดส่ง
//            ของงานส่วนใหญ่ในโรงเรียนไทย (บทเรียนเดียวกับ LOOKAHEAD ใน send-reminders)
//   covered  งานใน soon ที่แผนวันนี้จัดเวลาให้ครบตามที่ประเมินไว้
//            "ครบ" = นาทีที่จัดให้ ≥ นาทีที่เหลือ (est หักความคืบหน้าแล้ว)
//   pileup   นาทีของงานใน soon ที่ยังไม่ถูกจัด = ของที่ตกไปอยู่บนบ่าพรุ่งนี้
//   mine     เวลาว่างที่เหลือหลังหักงานทั้งหมดออก = เวลาที่เป็นของเขาจริง ๆ
//
// ⚠️ ห้ามนับงานที่ไม่มีกำหนดส่งเข้า soon — เราไม่รู้ว่ามันด่วนไหม
// การเดาแล้วขึ้นว่า "เสี่ยงไม่ทัน" คือการสร้างความกดดันจากข้อมูลที่ไม่มีอยู่จริง
// ============================================================
const SAI_SOON_H = 36;

function saiPayoff(sp, now) {
  const plan = (sp && sp.plan) || {};
  const slots = plan.slots || [];
  const budget = (plan.windows && plan.windows.budgetMin) || 0;

  // นาทีที่แผนจัดให้แต่ละงานวันนี้
  const given = new Map();
  let plannedMin = 0;
  for (const s of slots) {
    if (s.break || !s.task) continue;
    given.set(s.task.id, (given.get(s.task.id) || 0) + (s.min || 0));
    plannedMin += s.min || 0;
  }

  const pend = typeof pendingTasks === 'function' ? pendingTasks() : [];
  const soon = pend.filter(t => {
    if (!t.due) return false;
    const h = (new Date(t.due) - now) / 3.6e6;
    return h > -24 && h <= SAI_SOON_H;
  });

  let covered = 0, pileup = 0;
  const shortTasks = [];
  for (const t of soon) {
    const need = Math.max(0, Math.round((t.estMin || 30) * (1 - (t.progress || 0) / 100)));
    const got = given.get(t.id) || 0;
    if (got >= need) covered++;
    else { pileup += need - got; shortTasks.push(t); }
  }

  return {
    soon: soon.length, covered, pileup, plannedMin,
    mine: Math.max(0, budget - plannedMin),
    short: shortTasks,
  };
}

// ---------- ประกอบแถวของทั้งวัน ----------
// ที่มาของข้อมูลมีสามทางและไม่ทับกันเลย:
//   busyBlocks()  คาบเรียน + กิจวัตร — ของที่ถูกกำหนดมาแล้ว แก้ที่หน้าบริบท
//   freeSlots()   ช่องที่เหลือหลังหักของข้างบน — ของที่เป็นของเราจริง
//   plan.slots    งานที่เอนจินวางลงในช่องว่างพวกนั้น — ของที่ AI ตัดสินใจ
// งานจึงถูกซ้อนไว้ใต้ช่องว่างที่มันนั่งอยู่ ไม่ใช่วางเรียงปนกันเป็นแถวเดียว
function saiDayRows(now) {
  const p = typeof ctxPrefs === 'function' ? ctxPrefs() : {};
  const wake = (typeof hm2min === 'function' ? hm2min(p.wake) : null) || 6 * 60;
  const sleep = (typeof hm2min === 'function' ? hm2min(p.sleep) : null) || 22 * 60;
  const busy = typeof busyBlocks === 'function' ? busyBlocks(now) : [];
  const free = typeof freeSlots === 'function' ? freeSlots(now) : [];
  const sp = typeof focusPlan === 'function' ? focusPlan(now) : null;
  const slots = (sp && sp.plan && sp.plan.slots) || [];
  const hm = m => (typeof humanMin === 'function' ? humanMin(m) : m + ' นาที');

  const rows = [{ at: wake, to: wake, kind: 'wake', title: 'ตื่นนอน', sub: '' }];

  for (const b of busy) {
    rows.push({
      at: b.from, to: b.to, kind: b.kind === 'class' ? 'class' : 'rt',
      title: b.title, sub: min2hm(b.from) + '–' + min2hm(b.to) + ' · ' + hm(b.to - b.from),
    });
  }

  for (const f of free) {
    const kids = slots
      .filter(s => {
        const m = s.start.getHours() * 60 + s.start.getMinutes();
        return m >= f.from && m < f.to;
      })
      .map(s => ({
        at: s.start.getHours() * 60 + s.start.getMinutes(),
        min: s.min || 0,
        brk: !!s.break,
        // ชื่อวิชาไม่เอามาไว้ในหัวเรื่อง — taskTitleText() ใส่ "วิชา · งาน" ให้
        // แล้วบรรทัดล่างก็บอกวิชาซ้ำอีกที ผลคือชื่อยาวจนถูกตัดด้วย … ทุกใบ
        // วิชาอยู่บรรทัดล่างที่เดียวพอ หัวเรื่องเหลือแต่ "ทำอะไร" ซึ่งอ่านจบในบรรทัดเดียว
        title: s.break ? 'พัก' : ((s.task.detail || '').trim()
          || (typeof typeInfo === 'function' ? typeInfo(s.task).name : 'งาน')),
        subject: !s.break && s.task.subject && s.task.subject !== 'อื่น ๆ' ? s.task.subject : '',
        id: s.break ? null : s.task.id,
      }));
    const used = kids.reduce((a, k) => a + (k.brk ? 0 : k.min), 0);
    rows.push({
      at: f.from, to: f.to, kind: 'free',
      title: 'ว่าง ' + hm(f.min),
      sub: min2hm(f.from) + '–' + min2hm(f.to)
        + (used ? ' · จัดงานไว้ ' + hm(used) : ' · ยังไม่ได้จัดอะไร'),
      kids,
    });
  }

  for (const e of (sp && sp.plan && sp.plan.events) || []) {
    const d = new Date(e.due);
    if (isNaN(d)) continue;
    rows.push({
      at: d.getHours() * 60 + d.getMinutes(), kind: 'ev',
      title: typeof taskTitleText === 'function' ? taskTitleText(e) : 'กิจกรรม',
      sub: 'ต้องไปให้ทัน', id: e.id,
    });
  }

  rows.push({ at: sleep, to: sleep, kind: 'sleep', title: 'เข้านอน', sub: '' });
  rows.sort((a, b) => a.at - b.at || (a.to || a.at) - (b.to || b.at));
  return rows;
}

// ---------- ความสูงของบล็อก ----------
// เชิงเส้นตรง ๆ แล้วคาบเรียนแปดชั่วโมงจะสูง 480 หน่วย ต้องเลื่อนจอสามรอบกว่าจะพ้น
// ปิดเพดานไว้ที่ 128 และพื้นที่ 34 — ยังเห็นชัดว่าอะไรกินเวลามากกว่าอะไรหลายเท่า
// โดยที่ทั้งวันยังอยู่ในจอเดียวครึ่ง ซึ่งเป็นจุดที่ "เห็นทั้งวัน" ยังเป็นจริง
const SAI_PXMIN = 0.24, SAI_HMIN = 34, SAI_HMAX = 128;
function saiBlockH(min) {
  return Math.round(Math.max(SAI_HMIN, Math.min(SAI_HMAX, (min || 0) * SAI_PXMIN)));
}

function renderSaiPlan() {
  const el = document.getElementById('saiBody');
  if (!el) return;
  if (saiTour >= 0) { renderSaiTour(); return; }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sp = typeof focusPlan === 'function' ? focusPlan(now) : null;
  const mood = saiMood(sp, now);
  const name = (typeof who === 'function' && who()) ? who() : '';
  const pay = saiPayoff(sp, now);
  const hm = m => (typeof humanMin === 'function' ? humanMin(m) : m + ' นาที');

  const sub = document.getElementById('saiSub');
  if (sub) {
    sub.textContent = (typeof fmtThaiDate === 'function' ? fmtThaiDate(now) : '')
      + ' · จัดไว้ ' + hm(pay.plannedMin);
  }

  // ---- การ์ดพระเอก: ทำตามนี้แล้วได้อะไร ----
  // ใบนี้คือเหตุผลที่จอนี้มีอยู่ · ถ้าวันไหนมันพูดอะไรไม่ได้ มันจะไม่ขึ้นเลย
  // ดีกว่าขึ้นการ์ดเปล่าที่เขียนว่า "วันนี้ไม่มีข้อมูล" ซึ่งกินที่ของพระเอกไปเฉย ๆ
  // ⚠️ ทุกคำในใบนี้ต้องอธิบายได้ว่าอยู่เพื่ออะไร (เจ้าของ: "ข้อความไม่จำเป็นเยอะไป")
  // ที่ถูกตัดออกรอบนี้: "งานที่ถึงกำหนดภายในพรุ่งนี้" — ตัวเลขข้างบนพูดไปแล้ว
  // และ "ทำครบแล้วเหลือเป็นของเรา" ยาวเกินกว่าจะเป็นป้ายกำกับตัวเลข
  // เหลือสามชิ้น: พูดว่าอะไร · ตัวเลขใหญ่ · สองผลที่ตามมา
  let hero = '';
  if (pay.soon > 0) {
    // เขียวต่อเมื่อทันครบทุกใบเท่านั้น — ทัน 1 จาก 2 ยังเป็นข่าวไม่ดี
    // การ์ดเขียวที่ขึ้นตอนยังมีใบที่ไม่ทัน คือการ์ดที่สอนให้เลิกเชื่อสีของมันเอง
    const win = pay.pileup === 0;
    hero = '<section class="sp-hero ' + (win ? 'ok' : 'warn') + '">'
      + '<span class="sp-h-lb">ทำตามแผนนี้</span>'
      + '<b class="sp-h-big">ส่งทัน <em>' + pay.covered + '</em> จาก ' + pay.soon + ' ใบ</b>'
      + '<div class="sp-h-row">'
      +   '<span class="sp-h-cell"><i>ไม่ทำคืนนี้</i><b>'
      +     (pay.pileup > 0 ? 'พรุ่งนี้ +' + hm(pay.pileup) : 'ยังทัน') + '</b></span>'
      +   '<span class="sp-h-cell"><i>เหลือของเรา</i><b>'
      +     (pay.mine > 0 ? hm(pay.mine) : 'ไม่เหลือ') + '</b></span>'
      + '</div></section>';
  } else if (pay.plannedMin > 0) {
    hero = '<section class="sp-hero calm">'
      + '<span class="sp-h-lb">ไม่มีอะไรถึงกำหนด</span>'
      + '<b class="sp-h-big">ทำล่วงหน้า <em>' + hm(pay.plannedMin) + '</em></b>'
      + '</section>';
  }

  // ---- น้องไซพูดหนึ่งบรรทัด ----
  // ต้องเป็นบรรทัดที่การ์ดพระเอกกับเส้นเวลาพูดแทนไม่ได้ = "เริ่มจากใบไหน"
  let say;
  if (sp && sp.now) {
    const when = sp.now.slot && typeof fmtClock === 'function' ? fmtClock(sp.now.slot.start) : '';
    say = 'เริ่มจาก ' + (typeof taskTitleText === 'function' ? taskTitleText(sp.now.task) : 'ใบแรก')
      + (when ? ' ตอน ' + when : '') + ' นะ';
  } else if (pay.mine > 0) {
    say = 'วันนี้ไม่มีงานที่ต้องนั่งทำ' + (name ? ' ' + name : '') + ' — เวลาที่เหลือเป็นของเราล้วน ๆ';
  } else {
    say = 'วันนี้เต็มไปหมดแล้ว พรุ่งนี้เริ่มใหม่ได้เต็มวันนะ';
  }

  // ---- เส้นเวลาทั้งวัน สูงตามเวลาจริง ----
  const rows = saiDayRows(now);
  let markedNow = false;
  const list = rows.map(r => {
    let pre = '';
    if (!markedNow && r.at > nowMin) {
      markedNow = true;
      pre = '<div class="sd-now"><span>' + esc(min2hm(nowMin))
        + '</span><i></i></div>';
    }
    const past = (r.to != null ? r.to : r.at) <= nowMin;
    const span = (r.to != null ? r.to : r.at) - r.at;
    const h = r.kind === 'wake' || r.kind === 'sleep' || r.kind === 'ev'
      ? 0 : saiBlockH(span);

    const kids = (r.kids || []).map(k => {
      const tag = k.id ? 'button' : 'div';
      const on = k.id ? ' onclick="openForm(\'' + k.id + '\')"' : '';
      const meta = k.subject ? k.subject + ' · ' + hm(k.min) : hm(k.min);
      return '<' + tag + ' class="sd-job' + (k.brk ? ' brk' : '') + '"' + on + '>'
        + '<span class="sd-jt mono">' + esc(min2hm(k.at)) + '</span>'
        + '<span class="sd-jx"><b>' + esc(k.title) + '</b><i>' + esc(meta) + '</i></span>'
        + (k.id ? icon('chevron') : '')
        + '</' + tag + '>';
    }).join('');

    // ⚠️ ราง <i> ถูกถอดออกใน 1C21 · เจ้าของ: "เวลาต้องเด่นสุด ... แล้วสีด้วยองค์ประกอบ"
    // ของเดิมเวลาเป็นตัวเทาขนาด 12px อยู่ข้างเส้นราง แล้วทุกแถวหน้าตาเหมือนกันหมด
    // ตอนนี้เวลาเป็นตัวหนา 17px คอลัมน์ซ้าย และก้อนขวามีพื้นสีตามหมวด
    // ราง 2px กลายเป็นของที่ไม่ได้บอกอะไรเพิ่ม เพราะคอลัมน์เวลาเรียงเป็นเส้นให้อยู่แล้ว
    return pre + '<div class="sd-r sd-' + r.kind + (past ? ' past' : '') + '">'
      + '<span class="sd-t">' + esc(min2hm(r.at)) + '</span>'
      + '<span class="sd-x"' + (h ? ' style="min-height:' + h + 'px"' : '') + '>'
      + '<b>' + esc(r.title) + '</b>'
      + (r.sub ? '<i>' + esc(r.sub) + '</i>' : '')
      + (kids ? '<span class="sd-jobs">' + kids + '</span>' : '')
      + '</span></div>';
  }).join('');

  el.innerHTML = ''
    + '<section class="sai-hi">'
    + '  <div class="saip-stage">'
    + '    <img class="saip-chibi' + (mood === 'sleepy' ? ' dim' : '') + '" src="' + SYN_CHIBI
    + '" alt="น้องไซ" width="92" height="159">'
    + '  </div>'
    + '  <p class="sai-say">' + esc(say) + '</p>'
    + '</section>'
    + hero
    + '<div class="sec-label">ทั้งวันของคุณ</div>'
    + '<div class="sd-list">' + list + '</div>'
    + (sp && sp.now
      ? '<button class="sai-cta" onclick="startFocus(\'' + sp.now.task.id + '\')">'
        + icon('play') + 'เริ่มทำเลย</button>'
      : '')
    + '<button class="sai-tour" onclick="saiTourStart()">'
      + icon('sparkles') + 'ให้น้องไซเล่าให้ฟังทีละข้อ</button>'
    + '<p class="sai-note">คาบเรียนกับกิจวัตรมาจากบริบทของคุณ · แก้ได้ที่แท็บ "ฉัน" '
    + 'แล้วแผนนี้จะขยับตามเอง</p>';

  saiStart();
}

// ============================================================
// โหมดเล่าทีละข้อ — ของที่เจ้าของบอกว่า "จริง ๆ ผมชอบอันเก่านะ"
// ------------------------------------------------------------
// มันกลับมาแล้ว แต่กลับมาในที่ที่ถูก: เป็นปุ่มท้ายจอแผน ไม่ใช่ประตูหน้า
// ความต่างจาก 1C18 สองข้อ และทั้งสองข้อคือสิ่งที่ถูกตีกลับพอดี:
//   1. ย้อนกลับได้ — มีปุ่ม "ก่อนหน้า" จริง ๆ ไม่ใช่เดินหน้าอย่างเดียว
//   2. ไม่ใช่ทางเข้าบังคับ — ใครไม่อยากฟังก็อ่านจอแผนเอาเองได้ครบอยู่แล้ว
// ============================================================
let saiTour = -1;
let saiTourSteps = [];

function saiTourStart() {
  saiTourSteps = saiTourBuild(new Date());
  saiTour = 0;
  renderSaiPlan();
}
function saiTourEnd() { saiTour = -1; renderSaiPlan(); }
function saiTourGo(d) {
  const n = saiTour + d;
  if (n < 0) { saiTourEnd(); return; }
  if (n >= saiTourSteps.length) { saiTourEnd(); return; }
  saiTour = n;
  renderSaiTour();
}

function saiTourBuild(now) {
  const sp = typeof focusPlan === 'function' ? focusPlan(now) : null;
  const pay = saiPayoff(sp, now);
  const name = (typeof who === 'function' && who()) ? who() : '';
  const hi = now.getHours();
  const greet = hi < 12 ? 'สวัสดีตอนเช้า' : hi < 17 ? 'สวัสดีตอนบ่าย'
    : hi < 22 ? 'สวัสดีตอนเย็น' : 'ดึกแล้วนะ';
  const hm = m => (typeof humanMin === 'function' ? humanMin(m) : m + ' นาที');
  const budget = (sp && sp.plan && sp.plan.windows && sp.plan.windows.budgetMin) || 0;
  const steps = [];

  steps.push({
    face: hi >= 22 || hi < 5 ? 'sleepy' : 'happy',
    head: greet + (name ? ' ' + name : ''),
    body: budget > 0
      ? 'วันนี้หักเวลาเรียนกับกิจวัตรออกแล้ว เหลือเวลาทำงานได้จริง ' + hm(budget)
      : 'วันนี้ไม่เหลือช่องที่ยาวพอจะทำงานแล้ว',
  });

  if (sp && sp.now) {
    const t = sp.now.task, info = sp.now.info || {};
    const late = t.due && new Date(t.due) < now;
    const why = late && typeof overdueFor === 'function'
      ? 'เลยกำหนดมา ' + overdueFor(now - new Date(t.due))
      : (typeof topReason === 'function' ? topReason(info) : '');
    steps.push({
      face: late || (info.stars || 0) >= 4 ? 'serious' : 'normal',
      head: typeof taskTitleText === 'function' ? taskTitleText(t) : 'งานแรก',
      body: 'เราเลือกใบนี้ขึ้นมาก่อน' + (why ? ' เพราะ' + why : ''),
    });
  }

  if (pay.soon > 0) {
    steps.push({
      face: pay.pileup > 0 ? 'serious' : 'wow',
      head: 'ส่งทัน ' + pay.covered + ' จาก ' + pay.soon + ' ใบ',
      body: pay.pileup > 0
        ? 'ถ้าคืนนี้ไม่แตะเลย พรุ่งนี้ต้องทำรวด ' + hm(pay.pileup) + ' ซึ่งไม่สนุกแน่'
        : 'ทำตามที่จัดไว้แล้วทันหมดทุกใบ ไม่ต้องอดนอน',
    });
  }

  steps.push({
    face: pay.mine > 0 ? 'happy' : 'sulk',
    head: pay.mine > 0 ? 'เหลือเป็นของเรา ' + hm(pay.mine) : 'วันนี้ไม่เหลือเวลาว่างแล้ว',
    body: pay.mine > 0
      ? 'ทำงานครบตามแผนแล้วยังเหลือเท่านี้ เอาไปทำอะไรก็ได้ ไม่ต้องรู้สึกผิด'
      : 'พรุ่งนี้ลองขยับเวลานอนหรือตัดกิจวัตรบางอย่างออกดูนะ',
  });

  if (sp && sp.now) {
    steps.push({
      face: 'wow', head: 'เริ่มเลยไหม',
      body: 'กดแล้วเข้าโหมดโฟกัสให้เลย จับเวลาให้ด้วย ไม่ต้องตั้งเอง',
      taskId: sp.now.task.id, cta: 'เริ่มทำเลย', ctaIc: 'play',
    });
  }
  return steps;
}

function renderSaiTour() {
  const el = document.getElementById('saiBody');
  if (!el) return;
  if (!saiTourSteps.length) saiTourSteps = saiTourBuild(new Date());
  const i = Math.min(saiTour, saiTourSteps.length - 1);
  const s = saiTourSteps[i] || {};
  const last = i >= saiTourSteps.length - 1;

  const sub = document.getElementById('saiSub');
  if (sub) sub.textContent = 'น้องไซเล่าให้ฟัง · ข้อ ' + (i + 1) + ' จาก ' + saiTourSteps.length;

  el.innerHTML = ''
    + '<div class="st-dots">'
    + saiTourSteps.map((_, n) => '<i class="' + (n <= i ? 'on' : '') + '"></i>').join('')
    + '</div>'
    + '<div class="st-mid">'
    + '  <div class="saip-stage st-stage">'
    + '    <img class="saip-chibi" src="' + SYN_CHIBI + '" alt="น้องไซ" width="130" height="224">'
    + '  </div>'
    + '  <div class="st-say saip-in">'
    + '    <h3>' + esc(s.head || '') + '</h3>'
    + (s.body ? '<p>' + esc(s.body) + '</p>' : '')
    + '  </div>'
    + '</div>'
    + '<div class="st-act">'
    + (s.taskId
      ? '<button class="sai-cta" onclick="startFocus(\'' + s.taskId + '\')">'
        + icon(s.ctaIc || 'play') + esc(s.cta || 'เริ่มทำเลย') + '</button>'
      : '')
    + '  <div class="st-nav">'
    + '    <button class="st-back" onclick="saiTourGo(-1)">' + icon('chevron')
    +        (i === 0 ? 'ออก' : 'ก่อนหน้า') + '</button>'
    + '    <button class="st-next" onclick="' + (last ? 'saiTourEnd()' : 'saiTourGo(1)') + '">'
    +        (last ? 'ดูแผนทั้งวัน' : 'ต่อไป') + icon('chevron') + '</button>'
    + '  </div>'
    + '</div>';

  saiStart();
}
