// ============================================================
// เอฟเฟกต์ตอนงานเสร็จ · "โยนลงห่วง"
// ------------------------------------------------------------
// ของในร้านค้าชิ้นแรกที่ไม่ใช่ธีมสี — ติ๊กงานเสร็จแล้วได้ "โยน" งานใบนั้นลงห่วงบาสเอง
// เจ้าของเอามาจากคลิปที่โยนไฟล์ลงห่วงแทนการลากวาง (7 ต.ค. 2569)
//
// กติกาที่ตั้งใจ (อย่าแก้โดยไม่รู้เหตุผล):
//   • งานถูกบันทึกว่า "เสร็จ" ก่อนจอนี้เปิด — เกมเป็นแค่ฉลอง ไม่ใช่ด่านที่ต้องผ่าน
//     ปิดแอปกลางทาง/โยนไม่ลง งานก็เสร็จอยู่แล้ว ข้อมูลไม่ขึ้นกับฝีมือโยน
//   • ไม่ลง = ลองใหม่ได้ไม่จำกัด แต่มีปุ่ม "ข้าม" ตลอดเวลา
//     แอปนี้มีไว้ลดภาระการตัดสินใจ — ห้ามมีจอไหนขังคนไว้จนกว่าจะเล่นเกมผ่าน
//   • พลาดครบ 3 ครั้ง เส้นจุดทำนายวิถียาวขึ้นจนถึงห่วง (ใบ้) — คนรีบไม่ควรติดอยู่ตรงนี้
//   • มุมมองหน้าตรงแบบเกมบาสในแชท: ขาขึ้นลูกอยู่ "หน้า" ห่วง (ไม่ชนขอบ)
//     ขาลงลูกอยู่ "หลัง" ขอบหน้า — ชนขอบได้ และลงห่วงได้เฉพาะขาลงเท่านั้น
//   • ลดการเคลื่อนไหว (prefers-reduced-motion) = ไม่เปิดจอนี้ ใช้เศษกระดาษแบบเดิม
//
// ที่เก็บ: ของที่ซื้อแล้ว = tokenState().fx (ซิงก์ขึ้น cloud ไปกับโทเคน · รวมแบบ "เคยได้ = ได้")
//          ตัวที่เลือกใช้ = localStorage[DONEFX_KEY] (ของเครื่อง เหมือนธีม)
// ============================================================

const DONEFX_KEY = 'studentos.alt.doneFx';
const FX_SHOP = {
  hoop: { cost: 10, name: 'โยนลงห่วง', desc: 'โยนงานที่เสร็จลงห่วงบาส' },
};

// ห่วงจิ๋วสำหรับช่องตัวอย่างในร้านค้า/หน้าธีม
const HOOP_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2.5" width="14" height="9" rx="2" fill="none" stroke="#8A8F9C" stroke-width="1.4"/><path d="M7.5 15.5 9 22M16.5 15.5 15 22M10 15.5 11 22M14 15.5 13 22" stroke="#8A8F9C" stroke-width="1.1" stroke-linecap="round"/><rect x="6" y="13" width="12" height="2.6" rx="1.3" fill="#F2661B"/></svg>`;

function fxOwned(id) { return (tokenState().fx || []).includes(id); }
function doneFxPref() {
  let v = 'confetti';
  try { v = localStorage.getItem(DONEFX_KEY) || 'confetti'; } catch (_) {}
  return (v === 'confetti' || fxOwned(v)) ? v : 'confetti';
}
// เปิดจอโยนห่วงไหมตอนนี้ — เรียกจาก toggleDone / finishFocus
function hoopActive() {
  if (doneFxPref() !== 'hoop') return false;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return !!document.querySelector('.phone');
}

function setDoneFx(id) {
  if (id !== 'confetti' && !fxOwned(id)) return;
  try { localStorage.setItem(DONEFX_KEY, id); } catch (_) {}
  renderFxPick();
  if (id === 'hoop') previewHoop();
}

function buyFx(id) {
  const f = FX_SHOP[id];
  if (!f || fxOwned(id)) return;
  const s = tokenState();
  if ((s.bal || 0) < f.cost) {
    haptic('snooze');
    showToast({ title: 'โทเคนไม่พอ', body: 'เอฟเฟกต์' + f.name + ' ราคา ' + f.cost + ' โทเคน — ยังขาดอีก ' + fmtTok(f.cost - (s.bal || 0)) });
    return;
  }
  s.bal = Math.round((s.bal - f.cost) * 10) / 10;
  s.fx = (s.fx || []).concat(id);
  saveTokenState(s);
  // ซื้อมาเพื่อใช้ — เปิดให้เลยทันที ไม่ต้องไปตามหาสวิตช์อีกรอบ
  try { localStorage.setItem(DONEFX_KEY, id); } catch (_) {}
  haptic('done');
  splashBurst(18, 'egg-star');
  renderAll();
  showToast({ title: 'ได้เอฟเฟกต์' + f.name + 'แล้ว 🏀', body: 'เปิดใช้ให้แล้ว · เปลี่ยนได้ที่ตั้งค่า › ธีมสี · เหลือ ' + fmtTok(s.bal) + ' โทเคน' });
}

// ส่วน "เอฟเฟกต์ตอนงานเสร็จ" ในหน้าธีมสี — โผล่เมื่อมีเอฟเฟกต์อย่างน้อยหนึ่งชิ้นเท่านั้น
function renderFxPick() {
  const sec = document.getElementById('fxSec');
  if (!sec) return;
  const any = Object.keys(FX_SHOP).some(fxOwned);
  sec.hidden = !any;
  if (!any) return;
  const cur = doneFxPref();
  sec.querySelectorAll('#fxPick button[data-fx]').forEach(b => {
    const id = b.dataset.fx;
    b.hidden = id !== 'confetti' && !fxOwned(id);
    b.classList.toggle('active', id === cur);
  });
  const now = document.getElementById('fxNow');
  if (now) now.textContent = cur === 'hoop' ? 'โยนลงห่วง' : 'เศษกระดาษ (ปกติ)';
}

// ---------- ตัวเกม ----------
const HOOP = {
  G: 2300,          // แรงโน้มถ่วง px/s²
  MAX_PULL: 140,
  // ดึงสุดแขน = ลูกขึ้นสูงกว่าขอบห่วงเท่านี้ (px) — ตัวคูณแรงคิดใหม่ตามความสูงจอทุกครั้ง
  // จอสูงจอเตี้ยจึงต้องดึงยาวเท่ากัน (~75–95% ของสุดแขน) ไม่ใช่จอเตี้ยลงง่ายกว่า
  OVERSHOOT: 300,
  OVER: 220,        // จุดสูงสุดเกินขอบห่วงเกินนี้ = แรงไป ลูกข้ามกระดานไปข้างหลัง
  SHIFT: 60,        // ห่วงเลื่อนซ้าย/ขวาสุ่มได้ไม่เกินนี้ — ดึงตรง ๆ แล้วลงทุกครั้งไม่ใช่เกม
  MIN_PULL: 18,     // ดึงสั้นกว่านี้ = แตะเฉย ๆ ไม่นับเป็นการโยน
  R: 25,            // รัศมีลูก (ตอนอยู่ใกล้สุด)
  DEPTH: 0.24,      // ลูกเล็กลงสูงสุดเท่านี้ตอนลอยไปถึงห่วง
  RIM_W: 96,
  RIM_PIN: 4,       // รัศมีปลายขอบห่วง (จุดที่ชนได้)
  BOUNCE: 0.55,
  HINT_AFTER: 3,
};

let hoopRun = null;

// ============================================================
// เสียง — สังเคราะห์สดด้วย Web Audio ไม่มีไฟล์เสียงสักไฟล์
// ------------------------------------------------------------
// • ไม่ต้องโหลดอะไร ใช้ออฟไลน์ได้ ไม่เพิ่มของในแคช sw.js
// • AudioContext สร้างตอนนิ้วแตะลูกครั้งแรกเท่านั้น — iPhone ไม่ยอมให้เสียงดัง
//   ถ้าไม่ได้เริ่มจากการแตะของผู้ใช้ (และไม่ควรมีเสียงก่อนผู้ใช้ลงมือเองอยู่แล้ว)
// • audioSession = 'ambient' (Safari 17+) — เคารพสวิตช์ปิดเสียงข้างเครื่อง
//   และไม่ไปหยุดเพลงที่ฟังอยู่ · นักเรียนติ๊กงานในห้องเรียนได้โดยไม่ต้องกลัวเสียงลั่น
// • ปิดเสียงได้ที่ปุ่มลำโพงบนจอโยน · จำไว้ในเครื่อง (DONEFX_SOUND_KEY)
// ============================================================
const DONEFX_SOUND_KEY = 'studentos.alt.doneFxSound';
function hoopSoundOn() {
  try { return localStorage.getItem(DONEFX_SOUND_KEY) !== '0'; } catch (_) { return true; }
}
const HSFX = {
  ac: null, out: null, noiseBuf: null, str: null,
  ctx() {
    if (!hoopSoundOn()) return null;
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (_) {}
      try { this.ac = new AC(); } catch (_) { return null; }
      this.out = this.ac.createGain();
      this.out.gain.value = 0.55;
      this.out.connect(this.ac.destination);
      // เสียงซ่า 1 วินาที ใช้ซ้ำทุกเสียงลม/ตาข่าย
      const n = this.ac.sampleRate, buf = this.ac.createBuffer(1, n, n), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ac.state === 'suspended') this.ac.resume();
    return this.ac;
  },
  // ซองเสียง: ขึ้นเร็ว ลงแบบเอ็กซ์โพเนนเชียล
  env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  },
  // lp = กรองเสียงแหลมออก (ใช้กับคลื่นฟันเลื่อย ไม่งั้นแสบหู)
  tone(type, f0, f1, peak, a, d, delay = 0, lp = 0) {
    const ac = this.ctx(); if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    this.env(g, t, peak, a, d);
    let n = o;
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; n = o.connect(f); }
    n.connect(g).connect(this.out);
    o.start(t); o.stop(t + a + d + 0.05);
  },
  noise(type, f0, f1, q, peak, a, d, delay = 0) {
    const ac = this.ctx(); if (!ac) return;
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = this.noiseBuf;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    this.env(g, t, peak, a, d);
    src.connect(f).connect(g).connect(this.out);
    // เริ่มจากจุดสุ่มในก้อนซ่า — เม็ดเสียงสั้น ๆ ที่ยิงถี่ (เสียงไม้ลั่น) จะได้ไม่ซ้ำกันเป๊ะจนฟังเป็นหุ่นยนต์
    src.start(t, Math.random() * 0.8); src.stop(t + a + d + 0.05);
  },

  // ---------- ธนู ----------
  // เจ้าของฟังเสียงยางยืดรุ่นแรก (ฟันเลื่อยเล่นค้าง) แล้วบอกว่า "แปลก ๆ ทำให้เหมือนดึงธนู"
  // เสียงน้าวคันธนูจริงไม่ใช่โทนค้าง — มันคือ "ไม้ลั่นเอี๊ยด" เป็นเม็ด ๆ ถี่ขึ้นและแหลมขึ้นตามแรงตึง
  // ปล่อยแล้วเป็น "ตึ๊ง" ของสายที่สั่นค้าง + ลูกศร "ฟิ้ว"

  // แตะลูก = พาดลูกศรเข้าสาย — "ก๊อก" ไม้เบา ๆ
  grab() {
    this.tone('sine', 240, 170, 0.16, 0.002, 0.07);
    this.noise('bandpass', 1400, 1100, 4, 0.18, 0.002, 0.035);
    this.draw = { last: 0, acc: 0, full: false };
  },
  // ดึง — ไม้ลั่นเป็นเม็ดตามระยะที่นิ้วขยับ ไม่ใช่ตามเวลา: ดึงนิ่ง = เงียบ ดึงต่อ = ลั่นต่อ
  stretch(ratio) {
    if (!this.ctx()) return;
    const dr = this.draw || (this.draw = { last: 0, acc: 0, full: false });
    const r = Math.max(0, Math.min(1, ratio));
    const d = r - dr.last;
    dr.last = r;
    dr.acc += Math.abs(d) * (d < 0 ? 0.5 : 1);      // ผ่อนสายกลับลั่นเบากว่าน้าว
    let n = 0;
    while (dr.acc >= 0.045 && n < 3) {
      dr.acc -= 0.045; n++;
      const f = 650 + r * 1100 + Math.random() * 180;
      this.noise('bandpass', f, f * 0.9, 8, 0.45 + r * 0.6, 0.002, 0.03 + Math.random() * 0.02, n * 0.012);
      this.tone('sine', f / 2, f / 2.1, 0.04 + r * 0.07, 0.002, 0.04, n * 0.012);
    }
    // น้าวสุด — คันธนูครางต่ำหนึ่งที บอกว่า "แรงสุดแล้ว ดึงต่อไม่ได้แรงเพิ่ม"
    if (r >= 0.97 && !dr.full) {
      dr.full = true;
      this.tone('sawtooth', 96, 90, 0.07, 0.03, 0.22, 0, 500);
      this.noise('bandpass', 900, 700, 10, 0.12, 0.003, 0.05, 0.02);
    }
    if (r < 0.9) dr.full = false;
  },
  release() { this.draw = null; },
  // ปล่อย — สายธนูดีด "ตึ๊ง" (สองเสียงเพี้ยนกันนิดเดียว = สายสั่นค้าง) + ลูกศร "ฟิ้ว"
  whoosh(power) {
    const f = 118 + power * 46;
    this.tone('triangle', f, f * 0.93, 0.26, 0.002, 0.5);
    this.tone('triangle', f * 1.012, f * 0.94, 0.16, 0.002, 0.42);
    this.tone('sine', f * 2.01, f * 1.9, 0.08, 0.002, 0.22);
    this.noise('lowpass', 1200, 500, 1, 0.3, 0.001, 0.05);              // "แปะ" สายตบข้อมือ
    this.noise('bandpass', 3800, 700, 2.5, 0.16 + power * 0.2, 0.012, 0.26 + power * 0.12, 0.025);
  },
  // ชนขอบ — เหล็กดัง "แกร๊ง" (โอเวอร์โทนไม่ลงตัวกัน = เสียงโลหะ)
  rim(hard) {
    const v = 0.08 + Math.min(1, hard) * 0.16;
    [[523, 1], [1287, 0.55], [2093, 0.35], [3271, 0.18]].forEach(([f, k]) =>
      this.tone('sine', f, f * 0.995, v * k, 0.002, 0.35 + k * 0.4));
    this.noise('highpass', 3000, 2500, 0.7, v * 0.6, 0.002, 0.04);
  },
  // ชนขอบจอ — ตุ้บเบา ๆ
  thud() { this.tone('sine', 150, 70, 0.18, 0.003, 0.12); },
  // ลงห่วง — ตาข่ายสะบัด "ฟึ่บ" แล้วตามด้วยโน้ตขึ้น · สวิช (ไม่โดนขอบ) ได้โน้ตเพิ่มอีกตัว
  swish(clean) {
    this.noise('highpass', 5200, 2400, 0.8, 0.32, 0.01, 0.26);
    this.noise('bandpass', 1500, 900, 0.9, 0.12, 0.02, 0.2);
    const notes = clean ? [784, 988, 1175, 1568] : [784, 988, 1175];
    notes.forEach((f, i) => {
      this.tone('triangle', f, f, 0.16, 0.006, 0.42, 0.14 + i * 0.085);
      this.tone('sine', f * 2, f * 2, 0.04, 0.006, 0.25, 0.14 + i * 0.085);
    });
  },
  // ไม่ลง — ลูกตกพื้น "ตุ้บ ตุ้บ" แล้ว "แป่ว แป๊ว" สองโน้ตลง
  // รุ่นแรกเป็น "ปู๊ว" เบา ๆ จนเจ้าของไม่ได้ยิน — ต้องชัดพอให้รู้ว่าพลาด
  // แต่ยังเป็นเสียงขำ ๆ ไม่ใช่ออดตำหนิ เพราะงานเสร็จไปแล้วจริง ไม่มีอะไรเสีย
  miss() {
    this.tone('sine', 140, 62, 0.4, 0.003, 0.14);
    this.tone('sine', 120, 60, 0.22, 0.003, 0.1, 0.15);
    this.tone('sawtooth', 392, 375, 0.32, 0.015, 0.2, 0.26, 1600);
    this.tone('sawtooth', 311, 262, 0.34, 0.015, 0.48, 0.48, 1300);
  },
  // ลูกกลับมาที่จุดโยน — ป๊อป
  pop() { this.tone('sine', 380, 760, 0.12, 0.004, 0.08); },
  stop() { this.release(); },
};

function toggleHoopSound() {
  const on = !hoopSoundOn();
  try { localStorage.setItem(DONEFX_SOUND_KEY, on ? '1' : '0'); } catch (_) {}
  if (!on) HSFX.stop();
  syncHoopSoundBtn();
  if (on) HSFX.pop();
}
function syncHoopSoundBtn() {
  const b = hoopRun && hoopRun.ov.querySelector('.hp-snd');
  if (!b) return;
  const on = hoopSoundOn();
  b.classList.toggle('off', !on);
  b.setAttribute('aria-label', on ? 'ปิดเสียง' : 'เปิดเสียง');
  b.setAttribute('aria-pressed', on ? 'false' : 'true');
}

function previewHoop() { openHoop('ตัวอย่าง · โยนเล่นได้เลย', null, true); }

// title = ชื่องานที่เพิ่งเสร็จ · onClose เรียกครั้งเดียวตอนจอปิด (ลง/ข้าม)
function openHoop(title, onClose, preview) {
  const phone = document.querySelector('.phone');
  if (!phone) { if (onClose) onClose(); return; }
  closeHoop(true);

  const ov = document.createElement('div');
  ov.className = 'hoop-ov';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-label', 'โยนงานที่เสร็จลงห่วง');
  ov.innerHTML = `
    <div class="hp-head">
      <div class="hp-tx">
        <span class="hp-eb">${preview ? 'ลองเอฟเฟกต์' : 'งานเสร็จแล้ว'}</span>
        <b class="hp-t">${esc(title)}</b>
      </div>
      <button type="button" class="hp-snd" aria-label="ปิดเสียง">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>
      </button>
      <button type="button" class="hp-skip">ข้าม</button>
    </div>
    <div class="hp-court">
      <div class="hp-board"><i></i></div>
      <div class="hp-ball" aria-hidden="true">
        <span class="hp-page"><i></i><i></i><i></i></span>
        <span class="hp-ok">${icon('check')}</span>
      </div>
      <svg class="hp-net" viewBox="0 0 96 64" aria-hidden="true">
        <path d="M2 2 L18 62 M20 2 L30 62 M38 2 L42 62 M58 2 L54 62 M76 2 L66 62 M94 2 L78 62
                 M2 2 L30 62 M20 2 L42 62 M38 2 L54 62 M58 2 L66 62 M76 2 L78 62
                 M94 2 L66 62 M76 2 L54 62 M58 2 L42 62 M38 2 L30 62 M20 2 L18 62
                 M10 32 L86 32 M16 50 L80 50 M18 62 L78 62"/>
      </svg>
      <div class="hp-rim"></div>
      <svg class="hp-dots" aria-hidden="true"></svg>
      <div class="hp-msg" aria-live="polite"></div>
    </div>
    <div class="hp-foot">
      <span class="hp-hint">ดึงลงแล้วปล่อย เพื่อโยนลงห่วง</span>
      <span class="hp-try mono"></span>
    </div>`;
  phone.appendChild(ov);

  const $ = s => ov.querySelector(s);
  const run = hoopRun = {
    ov, onClose, preview, tries: 0, done: false, raf: 0,
    ball: $('.hp-ball'), rim: $('.hp-rim'), net: $('.hp-net'), dots: $('.hp-dots'),
    msg: $('.hp-msg'), tryEl: $('.hp-try'), hint: $('.hp-hint'), court: $('.hp-court'),
  };
  $('.hp-skip').onclick = () => closeHoop();
  $('.hp-snd').onclick = toggleHoopSound;
  syncHoopSoundBtn();
  run.key = e => { if (e.key === 'Escape') closeHoop(); };
  document.addEventListener('keydown', run.key);

  // วัดสนามหลังวางลง DOM แล้วเท่านั้น — ขนาด .phone ต่างกันทุกเครื่อง
  requestAnimationFrame(() => {
    if (hoopRun !== run) return;
    layoutHoop(run);
    resetBall(run, true);
    bindPull(run);
  });
}

function layoutHoop(run) {
  const c = run.court.getBoundingClientRect();
  run.W = c.width; run.H = c.height;
  // ห่วงสุ่มตำแหน่งครั้งเดียวต่อการเปิดจอ — พลาดแล้วลองใหม่ ห่วงยังอยู่ที่เดิม เล็งแก้ได้
  if (run.shift == null) run.shift = Math.round((Math.random() * 2 - 1) * HOOP.SHIFT);
  run.cx = run.W / 2 + run.shift;
  run.rimY = Math.round(run.H * 0.30);
  run.rimL = run.cx - HOOP.RIM_W / 2;
  run.rimR = run.cx + HOOP.RIM_W / 2;
  run.x0 = run.W / 2;
  run.y0 = run.H - 92;
  run.K = Math.sqrt(2 * HOOP.G * (run.y0 - run.rimY + HOOP.OVERSHOOT)) / HOOP.MAX_PULL;
  const board = run.ov.querySelector('.hp-board');
  board.style.left = (run.cx - 82) + 'px';
  board.style.top = (run.rimY - 104) + 'px';
  run.rim.style.left = (run.rimL - HOOP.RIM_PIN) + 'px';
  run.rim.style.top = (run.rimY - 4) + 'px';
  run.rim.style.width = (HOOP.RIM_W + HOOP.RIM_PIN * 2) + 'px';
  run.net.style.left = run.rimL + 'px';
  run.net.style.top = (run.rimY + 1) + 'px';
  run.dots.setAttribute('width', run.W);
  run.dots.setAttribute('height', run.H);
}

function resetBall(run, first) {
  Object.assign(run, { x: run.x0, y: run.y0, vx: 0, vy: 0, sc: 1, rot: 0,
    flying: false, rising: true, behind: false, over: false, scored: false, touched: false, t: 0, apexY: run.y0 });
  run.ball.classList.remove('front', 'behind', 'over');
  run.ball.classList.toggle('pop', !first);
  if (!first) HSFX.pop();
  if (!first) setTimeout(() => run.ball.classList.remove('pop'), 320);
  drawBall(run);
  run.tryEl.textContent = run.tries ? 'ครั้งที่ ' + (run.tries + 1) : '';
}

function drawBall(run) {
  const s = run.sc;
  run.ball.style.transform =
    `translate(${run.x - HOOP.R}px, ${run.y - HOOP.R}px) scale(${s}) rotate(${run.rot}deg)`;
}

function bindPull(run) {
  const b = run.ball;
  let start = null;
  const pull = e => {
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    const len = Math.hypot(dx, dy);
    const k = len > HOOP.MAX_PULL ? HOOP.MAX_PULL / len : 1;
    return { dx: dx * k, dy: dy * k, len: Math.min(len, HOOP.MAX_PULL) };
  };
  b.addEventListener('pointerdown', e => {
    if (run.flying || run.done) return;
    e.preventDefault();
    start = { x: e.clientX, y: e.clientY };
    try { b.setPointerCapture(e.pointerId); } catch (_) {}
    run.hint.classList.add('off');
    b.classList.add('held');
    HSFX.grab();
  });
  b.addEventListener('pointermove', e => {
    if (!start) return;
    const p = pull(e);
    // ลูกขยับตามนิ้วแค่ครึ่งหนึ่ง (ยางยืด) — เห็นว่ากำลังดึง แต่ไม่หลุดไปทั้งลูก
    run.x = run.x0 + p.dx * 0.45; run.y = run.y0 + p.dy * 0.45;
    drawBall(run);
    drawDots(run, p.len >= HOOP.MIN_PULL ? -p.dx * run.K : null, -p.dy * run.K);
    HSFX.stretch(p.dy > 0 ? p.len / HOOP.MAX_PULL : 0);
  });
  const up = e => {
    if (!start) return;
    const p = pull(e);
    start = null;
    b.classList.remove('held');
    drawDots(run, null);
    HSFX.release();
    if (p.len < HOOP.MIN_PULL || p.dy <= 4) {    // ดึงขึ้น/ดึงนิดเดียว = ไม่โยน กลับที่เดิม
      run.x = run.x0; run.y = run.y0; drawBall(run);
      if (p.len >= HOOP.MIN_PULL) say(run, 'ดึง<b>ลง</b>แล้วปล่อย ลูกจะพุ่งขึ้น');
      return;
    }
    HSFX.whoosh(p.len / HOOP.MAX_PULL);
    launch(run, -p.dx * run.K, -p.dy * run.K);
  };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', () => { HSFX.release(); start = null; b.classList.remove('held'); drawDots(run, null); resetBall(run, true); });
}

// เส้นจุดทำนายวิถี — ปกติสั้น ๆ พอเห็นทิศ (แบบในคลิป) · พลาดครบ 3 ครั้งยาวจนถึงห่วง
function drawDots(run, vx, vy) {
  if (vx == null) { run.dots.innerHTML = ''; return; }
  const long = run.tries >= HOOP.HINT_AFTER;
  const n = long ? 26 : 7, dt = long ? 0.045 : 0.05;
  let out = '';
  for (let i = 1; i <= n; i++) {
    const t = i * dt;
    const x = run.x + vx * t, y = run.y + vy * t + HOOP.G * t * t / 2;
    if (y > run.H) break;
    const op = (1 - i / (n + 1)) * 0.9;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3.2 - i / n * 1.4).toFixed(2)}" opacity="${op.toFixed(2)}"/>`;
  }
  run.dots.innerHTML = out;
}

function launch(run, vx, vy) {
  Object.assign(run, { vx, vy, flying: true, rising: true, t: 0 });
  run.ball.classList.add('front');
  haptic('arm');
  let last = performance.now();
  const step = now => {
    if (hoopRun !== run) return;
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    // แบ่งเฟรมย่อย 4 รอบ — ลูกเร็ว ~1500px/s ข้ามปลายขอบห่วงไปได้ในเฟรมเดียวถ้าไม่แบ่ง
    for (let i = 0; i < 4 && run.flying; i++) physics(run, dt / 4);
    drawBall(run);
    if (run.flying) run.raf = requestAnimationFrame(step);
  };
  run.raf = requestAnimationFrame(step);
}

function physics(run, dt) {
  const prevY = run.y;
  run.t += dt;
  run.vy += HOOP.G * dt;
  run.x += run.vx * dt;
  run.y += run.vy * dt;
  run.rot += run.vx * dt * 0.6;

  // ความลึก: ลูกเล็กลงตามระยะที่ลอยขึ้นไปทางห่วง และไม่โตกลับตอนขาลง
  const prog = Math.max(0, Math.min(1, (run.y0 - run.y) / (run.y0 - run.rimY)));
  if (run.rising) run.sc = Math.min(run.sc, 1 - HOOP.DEPTH * prog);
  const r = HOOP.R * run.sc;

  // จุดสูงสุด — ตัดสินว่าลูก "ข้ามไปหลังขอบหน้า" หรือยัง
  if (run.rising && run.vy > 0) {
    run.rising = false;
    run.apexY = run.y;
    // ไม่ถึงความสูงขอบ = ยังอยู่หน้าห่วงตลอด ตกลงมาหน้าห่วง
    run.behind = run.y < run.rimY - r * 0.6;
    // สูงเกินไป = ข้ามกระดานไปตกข้างหลัง ไม่ชนอะไรเลย
    run.over = run.y < run.rimY - HOOP.OVER;
    if (run.over) run.behind = false;
    run.ball.classList.toggle('front', !run.behind && !run.over);
    run.ball.classList.toggle('behind', run.behind);
    run.ball.classList.toggle('over', run.over);
  }

  // ผนังซ้ายขวาของจอ — เด้งกลับเข้าสนาม
  if (run.x < r) { if (run.vx < -60) HSFX.thud(); run.x = r; run.vx = Math.abs(run.vx) * 0.6; }
  if (run.x > run.W - r) { if (run.vx > 60) HSFX.thud(); run.x = run.W - r; run.vx = -Math.abs(run.vx) * 0.6; }

  if (run.behind && !run.scored) {
    // ปลายขอบห่วงสองข้าง = จุดกลมสองจุดที่ชนได้
    for (const px of [run.rimL, run.rimR]) {
      const dx = run.x - px, dy = run.y - run.rimY;
      const d = Math.hypot(dx, dy), min = r + HOOP.RIM_PIN;
      if (d < min && d > 0.01) {
        const nx = dx / d, ny = dy / d;
        run.x = px + nx * min; run.y = run.rimY + ny * min;
        const vn = run.vx * nx + run.vy * ny;
        if (vn < 0) {
          run.vx -= (1 + HOOP.BOUNCE) * vn * nx;
          run.vy -= (1 + HOOP.BOUNCE) * vn * ny;
          if (!run.touched) haptic('arm');
          // กลิ้งบนขอบ = ชนซ้ำถี่ ๆ ด้วยแรงน้อย — ไม่ดังทุกครั้ง ไม่งั้นกลายเป็นเสียงรัว
          if (-vn > 120) HSFX.rim(-vn / 900);
          run.touched = true;
          run.rim.classList.remove('hit'); void run.rim.offsetWidth; run.rim.classList.add('hit');
        }
      }
    }
    // ลงห่วง = จุดกลางลูกผ่านระดับขอบลงมา ระหว่างปลายขอบทั้งสอง ขณะกำลังตก
    if (prevY < run.rimY && run.y >= run.rimY && run.vy > 0
        && run.x > run.rimL && run.x < run.rimR) {
      run.scored = true;
      run.vx *= 0.25;
      scoreHoop(run);
    }
  }
  if (run.scored) {
    // ในตาข่าย: ลูกถูกบีบเข้ากลางห่วงและหน่วงลง
    run.vx += (run.cx - run.x) * 18 * dt;
    run.vy = Math.min(run.vy, 520);
  }

  if (run.y > run.H + HOOP.R * 2 || run.t > 4) {
    run.flying = false;
    if (!run.scored) missHoop(run);
  }
}

function say(run, html, cls) {
  run.msg.innerHTML = html;
  run.msg.className = 'hp-msg show' + (cls ? ' ' + cls : '');
  clearTimeout(run.msgT);
  run.msgT = setTimeout(() => { if (run.msg) run.msg.className = 'hp-msg'; }, 1500);
}

function missHoop(run) {
  run.tries += 1;
  haptic('snooze');
  HSFX.miss();
  const short = run.apexY > run.rimY - 6;
  say(run, run.touched ? 'โดนขอบ! เกือบแล้ว'
    : run.over ? 'แรงไป — ข้ามกระดานเลย'
    : short ? 'แรงไม่ถึง — ดึงยาวอีกนิด'
    : 'ออกข้าง — ลองเล็งใหม่');
  if (run.tries === HOOP.HINT_AFTER) setTimeout(() => {
    if (hoopRun === run && !run.done) say(run, 'ใบ้ให้แล้ว — ดูเส้นจุดตอนดึง');
  }, 1600);
  // 900ms: ให้ "แป่ว แป๊ว" จบก่อนลูกเด้งกลับ ไม่งั้นเสียงป๊อปทับโน้ตสุดท้าย
  setTimeout(() => { if (hoopRun === run && !run.done) resetBall(run, false); }, 900);
}

function scoreHoop(run) {
  run.done = true;
  run.net.classList.add('swish');
  haptic('done');
  const sw = !run.touched;
  HSFX.swish(sw);
  say(run, sw ? 'สวิช! ไม่โดนขอบเลย' : 'ลงห่วง!', 'win');
  run.ov.classList.add('won');
  // ลูกที่ร่วงทะลุตาข่ายจางหายไป ไม่ไหลลงไปทับคำว่า "ลงห่วง!" กลางจอ
  setTimeout(() => run.ball.classList.add('gone'), 260);
  // เศษกระดาษชุดเดิมของแอป แต่พุ่งจากห่วงแทนปุ่มติ๊ก
  setTimeout(() => { if (hoopRun === run) celebrate(run.rim); }, 160);
  setTimeout(() => { if (hoopRun === run) closeHoop(); }, 1500);
}

// silent = ปิดของค้างเพื่อเปิดอันใหม่ (ไม่เรียก onClose ซ้ำ)
function closeHoop(silent) {
  const run = hoopRun;
  if (!run) return;
  hoopRun = null;
  cancelAnimationFrame(run.raf);
  clearTimeout(run.msgT);
  document.removeEventListener('keydown', run.key);
  HSFX.stop();
  run.ov.classList.add('out');
  setTimeout(() => run.ov.remove(), 220);
  if (!silent && run.onClose) run.onClose();
}
