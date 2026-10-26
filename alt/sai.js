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

// ============================================================
// เลือกมาสคอต — น้องฮูก (Hook) หรือ น้องไซ
// ------------------------------------------------------------
// เจ้าของสั่ง (9 ต.ค. 2569): "สร้างมาสคอตตัวใหม่แทนน้องไซ อาจจะให้คนเลือกได้
// บางคนชอบไม่เหมือนกัน" · ค่าเริ่มต้นคือน้องฮูก · น้องไซยังเลือกกลับได้ที่ ตั้งค่า → ผู้ช่วย AI
//
// น้องฮูกมีภาพเดียว (ไม่มีชีตสีหน้าแบบน้องไซ) — สีหน้าทั้งหกแบบจึงมาจากท่าทาง CSS
// ที่เกาะ data-mood บนกรอบ (ดู sai.css · "น้องฮูก: ท่าแทนสีหน้า") ไม่ได้มาจากไฟล์ภาพ
// วันที่ได้ภาพสีหน้าครบ ใส่ faces ให้ hook เหมือน sai แล้วท่าทางยังซ้อนทับได้ตามเดิม
//
// เก็บแยกคีย์ของตัวเอง (แบบเดียวกับธีม) ไม่ได้เขียนลง state ก้อนหลัก — เป็นของ "หน้าตา"
// ของเครื่องนี้ ไม่ใช่ข้อมูลงานที่ต้องตามไปทุกเครื่อง
// ============================================================
const MASCOT_KEY = 'studentos.alt.mascot';
const MASCOTS = {
  hook: {
    name: 'น้องฮูก', en: 'Hook',
    // 24 ต.ค. 69 · เจ้าของ: ใช้น้องฮูกใส่หมวกแม่มดแทนตัวเดิมทุกธีม · จะกลับเป็นตัวเดิมให้ชี้กลับไป
    // hook-avatar.png / hook-body.webp / hook-face.webp (ยังอยู่ใน repo) และแก้ index.html land.html feedback.html sw.js ด้วย
    avatar: 'hook-hat-avatar.svg', body: 'hook-hat-body.svg',
    faces: null, face: 'hook-hat-face.svg',
  },
  sai: {
    name: 'น้องไซ', en: 'Synara',
    avatar: 'sai-avatar.png', body: 'sai-chibi.webp',
    faces: SYN_FACES, face: SYN_FACES.normal,
  },
};
const MASCOT_DEFAULT = 'hook';

function mascotId() {
  let v = null;
  try { v = localStorage.getItem(MASCOT_KEY); } catch (_) {}
  return MASCOTS[v] ? v : MASCOT_DEFAULT;
}
function mascot() {
  const id = mascotId(), original = MASCOTS[id];
  const outfit = window.HalloweenCosmetics?.costumeAsset(id);
  return outfit ? { ...original, avatar: outfit, body: outfit, face: outfit, faces: null } : original;
}
function mName() { return mascot().name; }

function synFace(key) {
  const m = mascot();
  return (m.faces && m.faces[key]) || m.face;
}
function synBody() { return mascot().body; }

// ป้ายชื่อกับรูปที่อยู่ใน index.html ตรง ๆ (แถบล่าง · จอล็อกอิน · ปุ่ม "…เห็นอะไร")
// ไม่ได้ถูกวาดใหม่ทุกครั้งเหมือนจอที่สร้างจาก JS — ต้องมีคนไปเปลี่ยนให้
function applyMascot() {
  const id = mascotId(), m = mascot();
  document.documentElement.dataset.mascot = id;
  document.querySelectorAll('[data-mname]').forEach(el => { el.textContent = m.name; });
  document.querySelectorAll('img[data-mav]').forEach(el => { el.src = m.avatar; });
  document.querySelectorAll('#mascotPick button').forEach(b => {
    const on = b.dataset.mascot === id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function setMascot(id) {
  if (!MASCOTS[id]) return;
  try { localStorage.setItem(MASCOT_KEY, id); } catch (_) {}
  applyMascot();
  if (typeof haptic === 'function') haptic('arm');
  // จอที่เปิดอยู่ตอนนี้ต้องเปลี่ยนตามทันที ไม่งั้นกลับไปหน้าแรกแล้วยังเจอตัวเก่าค้าง
  if (typeof renderAll === 'function') { try { renderAll(); } catch (_) {} }
}

// sai.js อยู่ท้าย <body> — ป้ายใน index.html ถูกแกะครบแล้วตอนไฟล์นี้รัน เปลี่ยนเลยก่อนจอแรกจะวาด
// (รอ DOMContentLoaded = คนที่เลือกน้องไซเห็นชื่อน้องฮูกบนแถบล่างแวบหนึ่งทุกครั้งที่เปิดแอป)
applyMascot();

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
  saiStart();   // ลูปหยุดตอนนิ่ง (ดู saiTick) — แตะแล้วต้องปลุกให้หันตามนิ้ว
}

function saiTick() {
  // 9 ต.ค. 69 · นับเฉพาะเวทีบนจอที่เห็นอยู่ — หน้าแรกไม่เคยถูกลบออกจากหน้า (แค่ซ่อน) ลูปจึงเคยเดิน 60 ครั้ง/วิ
  // ตลอดทั้งรอบที่เปิดแอป แม้อยู่จออื่น · go() ปลุกใหม่ทุกครั้งที่เปลี่ยนจอ
  // 26 ต.ค. 69 · ค้นเฉพาะในจอที่เปิดอยู่ (ผลเท่าเดิม) — เดิมกวาดทั้งหน้าแล้วกรอง closest() ทุกเฟรม
  // โปรไฟล์ที่ CPU ช้า 8 เท่า: querySelectorAll ของบรรทัดนี้กินเวลา 680ms ใน 11 วิ มากสุดในแอป
  const scr = document.querySelector('.screen.on');
  const els = scr ? [...scr.querySelectorAll('.saih-stage, .saip-stage')] : [];
  // ไม่มีเวทีบนจอ = หยุดลูปทิ้ง · saiStart() จะปลุกใหม่เองตอนมีเวทีโผล่
  // ลูปที่เดินต่อไปเรื่อย ๆ ทั้งที่ไม่มีอะไรให้ขยับ คือแบตที่หายไปโดยไม่มีใครได้อะไร
  if (!els.length) { saiLoop = false; return; }
  // จอเอฟเฟกต์งานเสร็จ (กระจกฝ้าเต็มจอ) เปิดทับอยู่ — ขยับข้างหลัง = เบลอใหม่ทั้งจอ · รอจนปิดค่อยขยับต่อ
  if (typeof fxRun !== 'undefined' && fxRun) { requestAnimationFrame(saiTick); return; }

  // ไม่เคยมีนิ้วแตะเลย (เปิดแอปทิ้งไว้ · เครื่องที่ไม่มีเมาส์) — แกว่งเองช้า ๆ
  // มาสคอตที่นิ่งสนิทจนกว่าจะมีคนแตะ คือรูปติดผนัง ไม่ใช่ตัวละคร
  // โหมดเครื่องเบา: ไม่แกว่งเอง (ยังหันตามนิ้วอยู่ — เขียนเฉพาะตอนแตะ ไม่กินแรงตอนวางทิ้งไว้)
  if (!saiTouched && !document.documentElement.dataset.lite) {
    const t = Date.now() / 2600;
    saiPX = Math.sin(t) * 0.38;
    saiPY = Math.sin(t * 0.7) * 0.22;
  }

  // โหมดลื่น: หันตามนิ้วทันทีครั้งเดียว ไม่ไล่ตามแบบหน่วง (หน่วง = เขียนสไตล์ ~60 เฟรมต่อการแตะหนึ่งครั้ง
  // โปรไฟล์ lowspec เครื่อง low 26 ต.ค. 69: 2.7 วิใน 2 นาที) · เครื่องปกติยังไล่ตามนุ่ม ๆ เหมือนเดิม
  const k = document.documentElement.dataset.lite ? 1 : 0.09;
  saiCX += (saiPX - saiCX) * k;
  saiCY += (saiPY - saiCY) * k;
  // เขียนเฉพาะตอนค่าเปลี่ยนจริง — ทุกครั้งที่เขียน --sx/--sy เบราว์เซอร์คิดสไตล์ใหม่และวาดหน้าเธอใหม่
  // (object-position ขยับบน compositor ไม่ได้) · เดิมเขียนทุกเฟรม 60 ครั้ง/วิ ตลอดเวลาที่อยู่หน้าแรก
  // แม้ตอนหยุดนิ่งแล้ว · ทศนิยม 2 ตำแหน่ง = เอียง 0.06° ต่อขั้น ตาแยกไม่ออก
  // ตอนแกว่งเองค่าเปลี่ยนแค่ ~15 ครั้ง/วิ · แตะแล้วปล่อยจนนิ่ง = ไม่เขียนเลย
  const sx = saiCX.toFixed(2), sy = saiCY.toFixed(2);
  els.forEach(el => {
    if (el._sx === sx && el._sy === sy) return;
    el._sx = sx; el._sy = sy;
    el.style.setProperty('--sx', sx); el.style.setProperty('--sy', sy);
  });
  // 26 ต.ค. 69 · หยุดลูปเมื่อนิ่งแล้ว — ไม่แกว่งเอง (แตะแล้ว หรือโหมดลื่น) และไล่ถึงเป้าแล้ว
  // เดิมวนต่อทุกเฟรมตลอดที่หน้าแรกเปิดอยู่ ทั้งที่ค่าไม่เปลี่ยนแล้ว (โหมดลื่น 3 วินาทีนิ่ง ๆ = 361 รอบ)
  // ตื่นใหม่: saiAim (แตะ/ลากนิ้ว) · go() เปลี่ยนจอ — ทั้งคู่เรียก saiStart()
  const swaying = !saiTouched && !document.documentElement.dataset.lite;
  if (!swaying && Math.abs(saiPX - saiCX) < 0.004 && Math.abs(saiPY - saiCY) < 0.004) { saiLoop = false; return; }
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
    sub  = '';
  } else if (mood === 'serious') {
    line = 'วันนี้มีใบที่รอไม่ได้อยู่';
    sub  = '';
  } else if (mood === 'sulk') {
    line = 'ของค้างเริ่มเยอะแล้วนะ';
    sub  = '';
  } else if (mood === 'happy') {
    line = 'วันนี้โล่งมากเลย' + (name ? ' ' + name : '');
    sub  = '';
  } else {
    line = 'แผนวันนี้พร้อมแล้ว';
    sub  = '';
  }

  const dot = mood === 'serious' || mood === 'sulk';

  return `<button type="button" class="saih" onclick="openSaiPlan()">
    <span class="saih-bubble">
      <b>${esc(line)}</b>
      ${sub ? `<span>${esc(sub)}</span>` : ''}
      <span class="saih-go">เข้าห้อง${esc(mName())}</span>
    </span>
    <span class="saih-stage" data-mood="${mood}">
      ${dot ? '<span class="saih-dot"></span>' : ''}
      <img class="saih-face" src="${synFace(mood)}" alt="${esc(mName())}" width="76" height="76">
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

// เปิดดูช่วงที่ผ่านไปแล้วของวันนี้ (ปุ่มเหนือเส้นเวลา) — เข้าจอใหม่ = พับกลับเสมอ
var saiShowPast = false;

function openSaiPlan() {
  saiTour = -1;             // ออกจากโหมดเล่าทีละข้อเสมอตอนเข้าจอใหม่
  saiShowPast = false;
  go('scr-sai');
  renderSaiPlan();
}

// ============================================================
// แผ่นแตะแถวงาน (20 ต.ค. 69)
// ------------------------------------------------------------
// เจ้าของ: แตะงานในเส้นเวลาแล้วอยากทำอะไรกับมันได้เลย ไม่ใช่เด้งไปฟอร์มแก้ไข
// โครงแผ่นยืม #soonSheet/#daySheet (.add-sheet > .as-scrim + .as-card) · ลงทะเบียนใน OVERLAYS + watchOverlays ของ app.js
// เพื่อให้ Esc / ปุ่มย้อนของ Android ปิดได้ · แถวของรายการ "ไม่ใช่วันนี้" (งานถัดไป) เรียกตัวเดียวกันนี้
//
// รายการปุ่มสร้างที่เดียว (planRowActions) — จะเพิ่มปุ่มใหม่ = เพิ่มหนึ่งแถวในอาร์เรย์นั้น ไม่ต้องแตะที่วาด
// ทุกปุ่มทำงานผ่านฟังก์ชันเดิมของแอป (startFocus · toggleDone · snoozeToTomorrow · openForm)
// ติ๊กเสร็จใช้ toggleDone ตัวเดียวกับปุ่ม ✓ บนการ์ดหน้าแรก — สตรีค/ฉลอง/ลูกโซ่ "งานถัดไป" จึงเหมือนกันทุกทาง
let planRowSheetId = null;
let planRowSheetActs = [];   // รายการปุ่มที่วาดตอนเปิด — กดแล้วใช้ชุดนี้ ไม่คิดใหม่ (เวลาผ่านไประหว่างเปิดแผ่นอาจข้ามเส้น "โอกาสสุดท้าย" ทำให้ปุ่มที่เห็นหาไม่เจอ)

function planRowActions(t, now) {
  // เลื่อนไม่ได้เมื่อวันนี้คือโอกาสสุดท้าย — snoozeToTomorrow ปฏิเสธอยู่แล้ว ไม่โชว์ปุ่มที่กดแล้วโดนตีกลับ
  const canSnooze = !(typeof isLastChanceToday === 'function' && isLastChanceToday(t, now));
  return [
    { key: 'start', label: 'เริ่มทำ', ic: 'play', cls: 'primary', run: id => startFocus(id) },
    // จอแผนวาดใหม่เองใน renderAll() (ดู app.js) — toggleDone วาดหลังจังหวะฉลอง ส่วนเลื่อนวาดที่นี่ทันที ไม่ให้แถวค้าง 200ms
    { key: 'done', label: 'เสร็จแล้ว', ic: 'check', run: id => toggleDone(id) },
    canSnooze && { key: 'snooze', label: 'เลื่อนไปพรุ่งนี้', ic: 'clock', run: id => {
      snoozeToTomorrow(id);
      if (curScreen === 'scr-sai') renderSaiPlan();
    } },
    { key: 'edit', label: 'แก้ไขรายละเอียด', ic: 'pencil', cls: 'quiet', run: id => openForm(id) },
  ].filter(Boolean);
}

// min = นาทีของช่องที่แถวนั้นแสดงอยู่ (ถ้าไม่ส่งมาใช้เวลาที่เหลือของงาน)
function openPlanRowSheet(taskId, min) {
  const t = state.tasks.find(x => x.id === taskId);
  const el = document.getElementById('planRowSheet');
  if (!t || t.done) return;
  // index.html เก่าจากแคช service worker ไม่มีกล่องนี้ (sw.js ดึงทีละไฟล์) — ถอยไปเปิดฟอร์มแบบที่แถวนี้เคยทำ
  // ดีกว่าแตะแล้วเงียบ (แบบเดียวกับ startFocus ที่ถอยไป startWork)
  if (!el) { openForm(taskId); return; }
  const hm = m => (typeof humanMin === 'function' ? humanMin(m) : m + ' นาที');
  const title = (t.detail || '').trim() || (typeof typeInfo === 'function' ? typeInfo(t).name : 'งาน');
  const subj = t.subject && t.subject !== 'อื่น ๆ' ? t.subject : '';
  const mins = min > 0 ? min : (typeof remainingMin === 'function' ? remainingMin(t) : t.estMin || 0);
  const sub = [subj, mins ? hm(mins) : ''].filter(Boolean).join(' · ');
  planRowSheetId = taskId;
  // ยกเลิกการปิดที่ค้างอยู่ — ไม่งั้นตัวจับเวลาของรอบก่อนมาล้างแผ่นที่เพิ่งเปิด (เหตุผลเดียวกับ openSoonSheet)
  if (el._closeT) { clearTimeout(el._closeT); el._closeT = 0; }
  planRowSheetActs = planRowActions(t, new Date());
  const btns = planRowSheetActs.map(a =>
    '<button type="button" class="prs-b' + (a.cls ? ' ' + a.cls : '') + '" data-act="' + a.key + '" onclick="planRowAct(\'' + a.key + '\')">'
    + icon(a.ic) + '<span>' + esc(a.label) + '</span></button>').join('');
  el.innerHTML = '<div class="as-scrim" onclick="closePlanRowSheet()"></div>'
    + '<div class="as-card prs-card" role="dialog" aria-label="' + esc(title) + '">'
    + '<div class="as-grip"></div>'
    + '<div class="prs-h"><b>' + esc(title) + '</b>' + (sub ? '<i>' + esc(sub) + '</i>' : '') + '</div>'
    + '<div class="prs-list">' + btns + '</div>'
    + '</div>';
  el.hidden = false;
  setTimeout(() => el.classList.add('on'), 16);   // setTimeout ไม่ใช่ rAF — เหตุผลเดียวกับ openAddSheet
  if (typeof haptic === 'function') haptic('tap');
}

// instant = ปิดทันทีไม่รอแอนิเมชัน — ใช้ตอนกดปุ่มที่พาไปชั้นอื่น (โหมดโฟกัส/ฟอร์ม) จะได้ไม่มีแผ่นค้างครึ่งทางทับกัน
function closePlanRowSheet(instant) {
  const el = document.getElementById('planRowSheet');
  planRowSheetId = null;
  if (!el || el.hidden) return;
  el.classList.remove('on');
  clearTimeout(el._closeT);
  if (instant) { el._closeT = 0; el.hidden = true; el.innerHTML = ''; return; }
  el._closeT = setTimeout(() => { el._closeT = 0; el.hidden = true; el.innerHTML = ''; }, 200);
}

function planRowAct(key) {
  const id = planRowSheetId;
  const t = id && state.tasks.find(x => x.id === id);
  const a = planRowSheetActs.find(x => x.key === key);
  closePlanRowSheet(true);
  // งานเสร็จไประหว่างที่แผ่นเปิดอยู่ (ซิงก์ · ติ๊กจากที่อื่น) — กด "เสร็จแล้ว" ซ้ำ toggleDone จะยกเลิกการเสร็จ
  if (!t || t.done || !a) return;
  a.run(id);
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
      // เวลาเริ่มอยู่คอลัมน์ซ้ายของแถวแล้ว เขียนซ้ำในก้อนคือข้อความส่วนเกินตรง ๆ
      // ส่วนความยาวช่วงถูกบอกด้วย "ความสูงของก้อน" อยู่แล้ว ไม่ต้องมีตัวเลขอีกชุด
      title: b.title, sub: 'ถึง ' + min2hm(b.to),
    });
  }

  const atMin = s => s.start.getHours() * 60 + s.start.getMinutes();
  const toKid = s => ({
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
  });
  for (const f of free) {
    const kids = slots.filter(s => atMin(s) >= f.from && atMin(s) < f.to).map(toKid);
    const used = kids.reduce((a, k) => a + (k.brk ? 0 : k.min), 0);
    rows.push({
      at: f.from, to: f.to, kind: 'free',
      title: 'ว่าง ' + hm(f.min),
      // "จัดงานไว้ 1 ชม. 42 นาที" ถูกตัดด้วย — การ์ดงานที่ซ้อนอยู่ข้างล่างมีเวลาของตัวเอง
      // ทุกใบอยู่แล้ว ตัวเลขรวมจึงเป็นการนับซ้ำของที่ตาเห็นอยู่ตรงหน้า
      sub: 'ถึง ' + min2hm(f.to) + (used ? '' : ' · ยังไม่ได้จัดอะไร'),
      kids,
    });
  }

  // งานที่แผนวางไว้นอกช่องว่างทุกช่อง — เคยหายจากเส้นเวลาเงียบ ๆ (19 ต.ค. 69)
  // ช่องว่างหมดแล้ว (เช่นตั้งไว้ถึง 21:30 แต่ตอนนี้ 21:55) แผนยังเลือกงานให้ทำตอนนี้ได้
  // การ์ดบนจอบอก "ทำตอนนี้เลย · แบบฝึกหัด 2.3" แต่เส้นเวลาขึ้นแค่ "เข้านอน" — สองที่พูดไม่ตรงกัน
  // ตอนนี้ได้ก้อนของตัวเอง บอกตรง ๆ ว่าเลยเวลาว่างที่ตั้งไว้ (ไม่เรียกว่า "ว่าง" เพราะไม่ใช่)
  const orphan = slots.filter(s => !free.some(f => atMin(s) >= f.from && atMin(s) < f.to));
  if (orphan.length) {
    const kids = orphan.map(toKid);
    const last = kids[kids.length - 1];
    const to = Math.min(24 * 60 - 1, last.at + last.min);
    rows.push({
      at: kids[0].at, to, kind: 'free', over: true,
      title: 'เลยเวลาว่างที่ตั้งไว้', sub: 'ถึง ' + min2hm(to), kids,
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

// ความสูงของบล็อกตามเวลา (saiBlockH) ถูกถอดพร้อมเส้นเวลาแบบกล่องซ้อน (20 ต.ค. 69) — รายการแบบ ก ไม่ใช้ความสูงบอกความยาว

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
  // ⚠️ ประโยคเดียว ตัวเลขเดียว — เจ้าของเลือกแบบ A เอง (21 ก.ย. 2569)
  // ของเดิมมีห้าก้อนข้อความ: "ทำตามแผนนี้" · "ส่งทัน 0 จาก 1 ใบ" · สองป้าย · สองค่า
  // ซึ่งอ่านแล้วต้องประกอบเองว่าตกลงมันบอกอะไร · คำตอบที่คมที่สุดมีข้อเดียว
  // คือ "ไม่ทำแล้วเจออะไร" ที่เหลือเป็นของที่เส้นเวลาข้างล่างบอกครบอยู่แล้ว
  //
  // พื้นทึบสีเน้นของธีม + ตัวอักษร --on-fill · สูตรเดียวกับหัวตั๋วในหน้าวันนี้เป๊ะ
  // (เจ้าของสั่ง: "เข้มจัดเต็มแบบการ์ดฟ้าหน้าวันนี้")
  // ⚠️ ทุกตัวในนี้ต้องสืบสีจาก --on-fill ไม่ใช่ --ink ลืมตัวเดียวได้ตัวหนังสือเข้มบนพื้นเข้ม
  // 19 ต.ค. 69 · เจ้าของ: "ปรับหน้าแผนวันนี้ให้ดูเข้าใจง่าย ใช้งานง่าย"
  // ประโยคเดิมทุกคำ (แบบ A ที่เจ้าของเลือก) แต่เหลือแถบบรรทัดเดียว — การ์ดใหญ่เดิมกินครึ่งจอ
  // ดันงานที่ต้องทำกับปุ่มเริ่มตกไปท้ายจอ · ไอคอนบอกดี/ไม่ดีก่อนอ่าน
  const SP_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const SP_WARN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>';
  let hero = '';
  if (pay.pileup > 0) {
    hero = '<section class="sp-hero">' + SP_WARN
      + '<b>คืนนี้ไม่แตะ พรุ่งนี้ <em>+' + hm(pay.pileup) + '</em></b>'
      + '</section>';
  } else if (pay.soon > 0) {
    hero = '<section class="sp-hero ok">' + SP_OK
      + '<b>ทำตามนี้ <em>ทันหมดทุกใบ</em></b>'
      + '</section>';
  } else if (pay.plannedMin > 0) {
    hero = '<section class="sp-hero ok">' + SP_OK
      + '<b>ไม่มีอะไรถึงกำหนด · ทำล่วงหน้า <em>' + hm(pay.plannedMin) + '</em></b>'
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
    say = 'วันนี้ไม่มีงานที่ต้องนั่งทำ' + (name ? ' ' + name : '') + ' เวลาที่เหลือเป็นของเราล้วน ๆ';
  } else {
    say = 'วันนี้เต็มไปหมดแล้ว พรุ่งนี้เริ่มใหม่ได้เต็มวันนะ';
  }

  // ---- ตารางทั้งวัน: รายการเรียงเวลาแถวเดียว (แบบ ก · เจ้าของเลือก 20 ต.ค. 69) ----
  // เจ้าของ: "ลองแก้ข้างล่าง … ระบบอาจจะไม่ดี … มันคือแผนตารางเวลาทั้งวัน ต้องเป็นยังไง" → เลือกแบบ ก จากสามแบบ
  // ของเดิมเป็นกล่องซ้อนสองชั้น: ก้อน "ว่าง X ชม." แล้วงานซ้อนอยู่ข้างใน · ความสูงแปรตามเวลาแต่มีเพดาน
  // (เรียน 8 ชม. สูงพอ ๆ กับว่าง 2 ชม.) · ต้องอ่านสองระดับกว่าจะรู้ว่ากี่โมงทำอะไร
  // ตอนนี้ทุกอย่างเป็นแถวเดียวเรียงตามเวลา: เวลาซ้าย · การ์ดขวา
  //   งาน = การ์ดเต็ม (แตะเปิดได้) · งานที่การ์ดบนบอกให้ทำ = ไฮไลต์ "ทำก่อน"
  //   เรียน/กิจวัตร = การ์ดจาง · พัก/ตื่น/นอน = บรรทัดเล็กไม่มีการ์ด
  //   เวลาว่างที่ยังไม่ได้จัดอะไร = เส้นประบาง ๆ "ว่าง 20 นาที" คั่นระหว่างแถว (ไม่ใช่กล่อง)
  //   เส้นแดง "ตอนนี้" อยู่ตรงตำแหน่งเวลาจริง · ของที่จบไปแล้วพับไว้ใต้ปุ่ม (เหมือนเดิม)
  // ข้อมูลยังมาจาก saiDayRows() ชุดเดิม — เปลี่ยนแค่วิธีวาง
  const GAP_MIN = 10;   // ว่างน้อยกว่านี้ไม่ต้องขึ้นเส้น — เศษเวลาระหว่างงานไม่ใช่ข้อมูล
  const nowAt = sp && sp.now && sp.now.slot ? sp.now.slot.start.getHours() * 60 + sp.now.slot.start.getMinutes() : null;
  const nowId = sp && sp.now ? sp.now.task.id : null;
  const items = [];
  for (const r of saiDayRows(now)) {
    if (r.kind === 'free') {
      const from = saiShowPast ? r.at : Math.max(r.at, nowMin);
      let cur = from;
      for (const k of r.kids || []) {
        if (!r.over && k.at - cur >= GAP_MIN) items.push({ kind: 'gap', at: cur, to: k.at });
        items.push(k.brk
          ? { kind: 'brk', at: k.at, to: k.at + k.min, title: 'พัก ' + hm(k.min) }
          : { kind: 'job', at: k.at, to: k.at + k.min, title: k.title, id: k.id, sj: k.subject,
              sub: [k.subject, hm(k.min), r.over ? 'เลยเวลาว่าง' : ''].filter(Boolean).join(' · '),
              hot: k.id === nowId && k.at === nowAt });
        cur = Math.max(cur, k.at + k.min);
      }
      if (!r.over && r.to - cur >= GAP_MIN) items.push({ kind: 'gap', at: cur, to: r.to });
    } else if (r.kind === 'class' || r.kind === 'rt') {
      items.push({ kind: 'busy', at: r.at, to: r.to, title: r.title, sub: 'ถึง ' + min2hm(r.to) });
    } else {
      items.push({ kind: r.kind, at: r.at, to: r.to != null ? r.to : r.at, title: r.title, sub: r.sub, id: r.id });
    }
  }
  items.sort((a, b) => a.at - b.at || (a.kind === 'gap') - (b.kind === 'gap'));
  const endedBefore = it => it.to <= nowMin && it.at < nowMin;
  const pastN = items.filter(it => it.kind !== 'gap' && endedBefore(it)).length;
  const shown = saiShowPast ? items : items.filter(it => !endedBefore(it));
  const runNow = typeof runningWork === 'function' ? runningWork() : null;
  const runId = runNow ? runNow.taskId : null;
  let markedNow = false;
  const nowLine = '<div class="dt-now"><span><em></em>' + esc(min2hm(nowMin)) + '</span><i></i></div>';
  const list = shown.map((it, i) => {
    let pre = '';
    if (!markedNow && it.at >= nowMin) { markedNow = true; pre = nowLine; }
    const past = endedBefore(it) ? ' past' : '';
    const st = ' style="--n:' + (i + 1) + '"';
    if (it.kind === 'gap') return pre + '<div class="dt-gap' + past + '"' + st + '>ว่าง ' + esc(hm(it.to - it.at)) + '</div>';
    const time = '<span class="dt-t">' + esc(min2hm(it.at)) + '</span>';
    if (it.kind === 'job') {
      // 26 ต.ค. 69 · จุดสีวิชาหน้าบรรทัดรอง — ชุดสีเดียวกับการ์ดงาน (.sj-* ใน alt.css) ดูก็รู้ว่าวิชาไหน
      const sj = typeof subjClass === 'function' ? ' ' + subjClass(it.sj) : '';
      return pre + '<div class="dt-r dt-job' + sj + (it.hot ? ' hot' : '') + past + '"' + st + '>' + time
        // 20 ต.ค. 69 · แตะแถว = แผ่นล่างที่เริ่ม/เสร็จ/เลื่อนได้เลย (เดิมเปิดฟอร์มแก้ไข ไกลเกินสำหรับสิ่งที่ทำบ่อยสุด)
        + '<button class="dt-c" onclick="openPlanRowSheet(\'' + it.id + '\',' + (it.to - it.at) + ')">'
        + '<span class="dt-x"><b>' + esc(it.title) + '</b><i>' + (sj ? '<span class="sjdot"></span>' : '') + esc(it.sub) + '</i></span>'
        + (runId === it.id && typeof runTimerPill === 'function' ? runTimerPill('dt-timer')
          : it.hot ? '<em class="dt-tag">ทำก่อน</em>' : icon('chevron')) + '</button></div>';
    }
    if (it.kind === 'busy' || it.kind === 'ev') {
      return pre + '<div class="dt-r dt-' + it.kind + past + '"' + st + '>' + time
        + '<div class="dt-c"><span class="dt-x"><b>' + esc(it.title) + '</b>' + (it.sub ? '<i>' + esc(it.sub) + '</i>' : '') + '</span></div></div>';
    }
    // พัก · ตื่น · นอน — บรรทัดเล็ก ไม่มีการ์ด · 26 ต.ค. 69 เป็นแคปซูลจาง ๆ มีไอคอนบอกชนิด (เดิมตัวหนังสือเทาลอย ๆ)
    const ic = { wake: 'sun', sleep: 'moon', brk: 'coffee' }[it.kind];
    return pre + '<div class="dt-r dt-line dt-' + it.kind + past + '"' + st + '>' + time
      + '<span class="dt-l">' + (ic ? icon(ic) : '') + esc(it.title) + '</span></div>';
  }).join('') + (markedNow ? '' : nowLine);

  // ---- การ์ดบนสุด: งานถัดไป + ปุ่มเริ่ม ----
  // เดิมคำตอบ "ทำอะไรต่อ" อยู่ในฟองคำพูด (อ่านได้แต่กดไม่ได้) และปุ่มเริ่มอยู่ท้ายจอ ใต้ทั้งวัน
  // ตอนนี้ชื่องาน · เวลา · ปุ่มเริ่ม อยู่ในการ์ดเดียวกับมาสคอต ในจอแรกเลย
  // ชื่อเรื่องแบบเดียวกับแถวงานในเส้นเวลา: "ทำอะไร" อย่างเดียว · วิชาอยู่บรรทัดล่าง
  const stage = '<div class="saip-stage" data-mood="' + mood + '">'
    + '<img class="saip-chibi' + (mood === 'sleepy' ? ' dim' : '') + '" src="' + synBody()
    + '" alt="' + esc(mName()) + '" width="92" height="159"></div>';
  let top;
  if (sp && sp.now) {
    const t = sp.now.task, slot = sp.now.slot;
    const title = (t.detail || '').trim() || (typeof typeInfo === 'function' ? typeInfo(t).name : 'งาน');
    const subj = t.subject && t.subject !== 'อื่น ๆ' ? t.subject : '';
    const mins = (slot && slot.min) || t.estMin || 0;
    const when = slot && slot.start > now && typeof fmtClock === 'function' ? 'ต่อไป · ' + fmtClock(slot.start) : 'ทำตอนนี้เลย';
    // 20 ต.ค. 69 · กำลังจับเวลางานนี้อยู่ — เดิมจอแผนไม่บอกเลย · ป้ายกลายเป็นแคปซูลนาฬิกาที่เดินจริง (แบบ Timer ของ Cult UI)
    const run = typeof runningWork === 'function' ? runningWork() : null;
    const isRun = !!run && run.taskId === t.id;
    // 20 ต.ค. 69 · การ์ดสีเต็มของธีม (สูตรเดียวกับการ์ดงานหน้าแรกที่เจ้าของชอบ) · ปุ่มเริ่มเต็มความกว้าง
    // แถบผลลัพธ์ ("คืนนี้ไม่แตะ พรุ่งนี้ +…") ย้ายเข้ามาเป็นท้ายการ์ด — เดิมเป็นก้อนแยกอีกก้อน แย่งสายตากับการ์ด
    top = '<section class="sai-hi sai-next sn-hero">' + stage
      + '<div class="sn-body">'
      + (isRun && typeof runTimerPill === 'function' ? runTimerPill('sn-timer') : '<span class="sn-k">' + esc(when) + '</span>')
      + '<b class="sn-t">' + esc(title) + '</b>'
      + '<i class="sn-m">' + esc([subj, mins ? hm(mins) : ''].filter(Boolean).join(' · ')) + '</i>'
      + '</div>'
      + '<button class="sai-cta sn-go" onclick="startFocus(\'' + t.id + '\')">' + icon('play') + (isRun ? 'ทำต่อ' : 'เริ่มทำเลย') + '</button>'
      + hero
      + '</section>';
    hero = '';
  } else {
    // ไม่มีงานให้เริ่ม — คำพูดของมาสคอตกลับมาเป็นพระเอก (ฟองมีหางชี้หามาสคอต · 9 ต.ค. 69)
    top = '<section class="sai-hi">' + stage
      + '<p class="sai-say"><span>' + esc(say).replace(/ ๆ/g, '&nbsp;ๆ') + '</span></p>'
      + '</section>';
  }

  el.innerHTML = ''
    + top
    + hero
    // ปุ่มอยู่บรรทัดเดียวกับหัวหมวด — แยกบรรทัดแล้วได้ช่องห่างของคอลัมน์เพิ่มอีกหนึ่งช่องฟรี ๆ
    + '<div class="sec-label sd-head"><span>' + (saiShowPast ? 'ทั้งวันของคุณ' : 'ที่เหลือของวันนี้') + '</span>'
    + (pastN
      ? '<button class="sd-pastbtn" onclick="saiShowPast=!saiShowPast;renderSaiPlan()" aria-expanded="' + saiShowPast + '">'
        + (saiShowPast ? 'ซ่อนช่วงที่ผ่านไป' : 'ดูช่วงที่ผ่านไป (' + pastN + ')') + '</button>'
      : '')
    + '</div>'
    + '<div class="dt">' + list + '</div>'
    + '<button class="sai-tour" onclick="saiTourStart()">'
      // 9 ต.ค. 69 · ถอดดาวหน้าป้ายออก (เจ้าของวงแดง: "ลบดาวนี้ออก")
      + 'ให้' + esc(mName()) + 'เล่าให้ฟังทีละข้อ</button>';

  if (typeof paintRunTimers === 'function') paintRunTimers(runNow);
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
  saiTourDir = 0;
  renderSaiPlan();
}
function saiTourEnd() { saiTour = -1; renderSaiPlan(); }
// ทิศที่เพิ่งกด (1 = ต่อไป · -1 = ก่อนหน้า · 0 = เพิ่งเปิด) — renderSaiTour ใช้เลือกฝั่งที่ของในข้อใหม่เลื่อนเข้ามา
let saiTourDir = 0;
function saiTourGo(d) {
  const n = saiTour + d;
  if (n < 0) { saiTourEnd(); return; }
  if (n >= saiTourSteps.length) { saiTourEnd(); return; }
  saiTour = n;
  saiTourDir = d;
  renderSaiTour();
}

// ป้ายปุ่มแบบ HaloButton — ตัวอักษรไล่ขึ้นทีละตัว (ตัดพยางค์ไทยไม่ให้สระหลุดจากพยัญชนะ)
function saiHaloLabel(text) {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
  const g = seg ? Array.from(seg.segment(text), s => s.segment) : String(text).split('');
  return '<span class="hb-lb" aria-label="' + esc(text) + '">'
    + g.map((c, k) => '<span aria-hidden="true" style="--k:' + k + '">' + esc(c) + '</span>').join('') + '</span>';
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
      ? 'เหลือเวลาทำงานได้ ' + hm(budget)
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
        ? 'ถ้าคืนนี้ไม่แตะ พรุ่งนี้ต้องทำรวด ' + hm(pay.pileup)
        : 'ทำตามแผนแล้วทันทุกใบ',
    });
  }

  steps.push({
    face: pay.mine > 0 ? 'happy' : 'sulk',
    head: pay.mine > 0 ? 'เหลือเป็นของเรา ' + hm(pay.mine) : 'วันนี้ไม่เหลือเวลาว่างแล้ว',
    body: pay.mine > 0
      ? 'เอาไปทำอะไรก็ได้'
      : '',
  });

  if (sp && sp.now) {
    steps.push({
      face: 'wow', head: 'เริ่มเลยไหม',
      body: '',
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
  if (sub) sub.textContent = mName() + 'เล่าให้ฟัง · ข้อ ' + (i + 1) + ' จาก ' + saiTourSteps.length;

  el.innerHTML = ''
    + '<div class="st-dots">'
    + saiTourSteps.map((_, n) => '<i class="' + (n <= i ? 'on' : '') + '"></i>').join('')
    + '</div>'
    // 9 ต.ค. 69 · data-dir = ทิศที่เพิ่งกด → ของในข้อใหม่เลื่อนเข้าจากฝั่งนั้น (เจ้าของ: "ทำอนิเมชันเลื่อนให้หน่อย")
    + '<div class="st-mid" data-dir="' + saiTourDir + '">'
    + '  <div class="saip-stage st-stage" data-mood="' + (s.face || 'normal') + '">'
    + '    <img class="saip-chibi" src="' + synBody() + '" alt="' + esc(mName()) + '" width="130" height="224">'
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
    // ปุ่มแบบ HaloButton (เจ้าของส่งเดโมมา) — ต่อไป = ทึบมีรัศมีไล่สีวนรอบ · ออก/ก่อนหน้า = แบบโปร่ง (translucent) ขอบไล่สี
    + '    <button class="st-back hb hb-glass" onclick="saiTourGo(-1)">' + icon('chevron')
    +        saiHaloLabel(i === 0 ? 'ออก' : 'ก่อนหน้า') + '</button>'
    + '    <button class="st-next hb" onclick="' + (last ? 'saiTourEnd()' : 'saiTourGo(1)') + '">'
    +        saiHaloLabel(last ? 'ดูแผนทั้งวัน' : 'ต่อไป') + icon('chevron') + '</button>'
    + '  </div>'
    + '</div>';

  saiStart();
}
