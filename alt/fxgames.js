// ============================================================
// เอฟเฟกต์ตอนงานเสร็จ · เกม canvas 7 แบบ
// ------------------------------------------------------------
// เจ้าของขอเพิ่ม (7 ต.ค. 2569): "บอล เบสบอล กอฟ หั่นผลไม้ ปาระเบิดใส่ ขยำงาน ปาแก้ว"
//
//   goal    ยิงประตู     ปัดลูกขึ้น · ผู้รักษาประตูเดินไปมา เล็งช่องว่าง
//   bat     ตีโฮมรัน     แตะจอให้ตรงจังหวะตอนลูกเข้ากรอบ
//   golf    พัตต์ลงหลุม  ดึงถอยแล้วปล่อย · กะแรงให้ลูกช้าพอจะตกหลุม
//   slice   หั่นผลไม้    งานลอยขึ้นมาเป็นผลไม้ · ปาดนิ้วผ่า
//   bomb    ปาระเบิดใส่  ดึงถอยแล้วปล่อยระเบิดเป็นวิถีโค้งใส่กองงาน
//   crumple ขยำงาน       ถูนิ้วบนกระดาษจนเป็นก้อน แล้วปัดลงถัง
//   glass   ปาแก้ว       ปัดแก้วใส่กำแพงแรง ๆ ให้แตก
//
// กติกาเดียวกับโยนลงห่วงทุกข้อ (ดูหัว hoop.js): งานเสร็จก่อนจอเปิด · ข้ามได้ตลอด ·
// พลาดได้ไม่จำกัด · พลาดครบ 3 ครั้งเกมง่ายลงเอง · เสียงสังเคราะห์สด ไม่มีไฟล์
//
// ไฟล์นี้โหลดก่อน hoop.js แต่เรียกของใน hoop.js (fxShell · say · HSFX · fxRun · closeFx)
// ตอนเล่นเท่านั้น — ห้ามเรียกของพวกนั้นตอนโหลดไฟล์ (ตัวแปร const ของไฟล์หลังยังไม่เกิด)
// ============================================================

const FX_ICONS = {
  goal: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18v9" fill="none" stroke="#8A8F9C" stroke-width="1.5"/><path d="M3 9v9M6 9v9M9 9v9M12 9v9M15 9v9M18 9v9M3 12h18M3 15h18" stroke="#8A8F9C" stroke-width=".6" opacity=".7"/><circle cx="16" cy="18" r="4" fill="#fff" stroke="#1F2430" stroke-width="1"/><path d="M16 16.4l1.4 1-.5 1.7h-1.8l-.5-1.7z" fill="#1F2430"/></svg>`,
  bat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l11.5-11.5a3 3 0 0 1 4.2 4.2L8.2 24" fill="none" stroke="#C8955A" stroke-width="3" stroke-linecap="round"/><circle cx="7" cy="7" r="3.6" fill="#fff" stroke="#8A8F9C" stroke-width=".8"/><path d="M5 5.2c1 .9 1 2.7 0 3.6M9 5.2c-1 .9-1 2.7 0 3.6" stroke="#E03A2F" stroke-width=".8" fill="none"/></svg>`,
  golf: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="19" rx="8" ry="3" fill="#7CC36A"/><ellipse cx="13" cy="19" rx="2.2" ry=".9" fill="#1F2430"/><path d="M13 19V4" stroke="#8A8F9C" stroke-width="1.2"/><path d="M13 4l6 2.5-6 2.5z" fill="#E03A2F"/><circle cx="7" cy="18.4" r="1.6" fill="#fff" stroke="#8A8F9C" stroke-width=".6"/></svg>`,
  slice: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9a9 9 0 0 0 18 0z" fill="#2E8B3A"/><path d="M4.6 9a7.4 7.4 0 0 0 14.8 0z" fill="#F0435A"/><circle cx="9" cy="12" r=".9" fill="#1F2430"/><circle cx="12" cy="14" r=".9" fill="#1F2430"/><circle cx="15" cy="12" r=".9" fill="#1F2430"/><path d="M2 5l20 3" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/></svg>`,
  bomb: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="14" r="7" fill="#2B2F3A"/><circle cx="7.6" cy="11.6" r="1.6" fill="#fff" opacity=".35"/><rect x="12.5" y="5.5" width="4" height="3.4" rx=".8" transform="rotate(40 14.5 7.2)" fill="#5A6070"/><path d="M16 5c1-2 3-2 4-1" stroke="#C8955A" stroke-width="1.2" fill="none"/><circle cx="20.4" cy="3.6" r="1.6" fill="#FFB020"/></svg>`,
  crumple: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15h12l-1.4 7H7.4z" fill="#9AA1AE"/><ellipse cx="12" cy="15" rx="6" ry="1.6" fill="#5A6070"/><path d="M9 4l3-1 3 1.4 1 2.6-1.4 2.4-3 .8-2.6-1-1-2.4z" fill="#fff" stroke="#8A8F9C" stroke-width=".8"/><path d="M10 5.5l2 1.2 1.8-1.6M11 8.6l1-1.9" stroke="#B9BEC8" stroke-width=".6" fill="none"/></svg>`,
  glass: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l-.8 6a4.3 4.3 0 0 1-8.4 0z" fill="#CFE6FF" stroke="#8A8F9C" stroke-width="1"/><path d="M12 13v6M8.5 21h7" stroke="#8A8F9C" stroke-width="1.2" stroke-linecap="round"/><path d="M18 14l3-1.5M18.6 17l3 .4M17 11.4l2.4-2.6" stroke="#8A8F9C" stroke-width="1" stroke-linecap="round"/></svg>`,
};

const FX_GAMES = {};

// ============================================================
// เครื่องมือร่วม
// ============================================================
const fxClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fxLerp = (a, b, t) => a + (b - a) * t;
const fxRand = (a, b) => a + Math.random() * (b - a);

// ชื่องานสั้น ๆ สำหรับเขียนบนวัตถุ (ป้ายบนผลไม้ · กระดาษ · กองงาน)
function fxLabel(title) {
  const s = String(title || '').trim();
  return s.length > 14 ? s.slice(0, 13) + '…' : s;
}

function openFxGame(id, title, onClose, preview) {
  const G = FX_GAMES[id];
  const run = fxShell(title, onClose, preview, G.aria, G.hint);
  if (!run) return;
  Object.assign(run, { id, G, label: fxLabel(title), parts: [], decals: [], shake: 0, t: 0 });
  const cv = document.createElement('canvas');
  cv.className = 'fx-cv';
  run.ov.classList.add('fxg');
  run.court.insertBefore(cv, run.court.firstChild);
  run.cv = cv;
  requestAnimationFrame(() => {
    if (fxRun !== run) return;
    fxFit(run);
    G.init(run);
    fxBindPointer(run);
    fxLoop(run);
    run.rs = () => { if (fxRun === run) { fxFit(run); if (G.layout && !run.done) G.layout(run); } };
    window.addEventListener('resize', run.rs);
  });
}

function fxFit(run) {
  const c = run.court.getBoundingClientRect();
  const d = Math.min(2, window.devicePixelRatio || 1);
  run.W = c.width; run.H = c.height;
  run.cv.width = Math.round(c.width * d); run.cv.height = Math.round(c.height * d);
  run.cv.style.width = c.width + 'px'; run.cv.style.height = c.height + 'px';
  run.g = run.cv.getContext('2d');
  run.g.setTransform(d, 0, 0, d, 0, 0);
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  run.col = { ink: v('--ink') || '#1F2430', muted: v('--muted') || '#6A6F7E', card: v('--card') || '#fff' };
  run.font = getComputedStyle(document.body).fontFamily;
}

function fxLoop(run) {
  let last = performance.now();
  const tick = now => {
    if (fxRun !== run) return;
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    run.t += dt;
    run.G.step(run, dt);
    fxStepParts(run, dt);
    run.shake = Math.max(0, run.shake - dt * 40);
    const g = run.g;
    g.save();
    g.clearRect(0, 0, run.W, run.H);
    if (run.shake > 0) g.translate(fxRand(-1, 1) * run.shake, fxRand(-1, 1) * run.shake);
    run.G.draw(run, g);
    fxDrawParts(run, g);
    g.restore();
    run.raf = requestAnimationFrame(tick);
  };
  run.raf = requestAnimationFrame(tick);
}

// นิ้ว/เมาส์ — ส่งตำแหน่งในพิกัดสนาม + ความเร็วจากช่วง ~90ms สุดท้าย (ใช้กับการปัด)
function fxBindPointer(run) {
  const cv = run.cv;
  let samples = [], down = false;
  const pt = e => {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  const vel = () => {
    const now = performance.now();
    const s = samples.filter(p => now - p.t < 90);
    if (s.length < 2) return { x: 0, y: 0 };
    const a = s[0], b = s[s.length - 1], dt = Math.max(0.008, (b.t - a.t) / 1000);
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  };
  cv.addEventListener('pointerdown', e => {
    if (run.done) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    down = true;
    const p = pt(e);
    samples = [p];
    run.hint.classList.add('off');
    if (run.G.down) run.G.down(run, p);
  });
  cv.addEventListener('pointermove', e => {
    if (!down) return;
    const p = pt(e);
    samples.push(p);
    if (samples.length > 40) samples.shift();
    if (run.G.move) run.G.move(run, p, vel());
  });
  const up = e => {
    if (!down) return;
    down = false;
    const p = pt(e);
    samples.push(p);
    if (run.G.up && !run.done) run.G.up(run, p, vel());
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', () => { down = false; if (run.G.cancel) run.G.cancel(run); });
}

// ชนะ — ข้อความ · เสียงโน้ตไล่ขึ้น · เศษกระดาษของแอปพุ่งจากจุด (x, y) · ปิดเอง
function fxWin(run, text, x, y, opt = {}) {
  if (run.done) return;
  run.done = true;
  haptic('done');
  FXS.chime(!!opt.clean);
  say(run, text, 'win');
  const dot = document.createElement('i');
  dot.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:1px;height:1px;pointer-events:none`;
  run.court.appendChild(dot);
  setTimeout(() => { if (fxRun === run) celebrate(dot); dot.remove(); }, opt.burstDelay || 120);
  clearTimeout(run.msgT);   // ข้อความชนะค้างไว้จนจอปิด
  setTimeout(() => { if (fxRun === run) closeFx(); }, opt.hold || 1600);
}

// พลาด — นับครั้ง · บอกเหตุผล · รอเสียงจบแล้วค่อยเริ่มรอบใหม่
function fxMiss(run, text, reset, opt = {}) {
  if (run.done || run.missing) return;
  run.missing = true;
  run.tries += 1;
  haptic('snooze');
  if (!opt.quiet) HSFX.miss();
  say(run, text);
  if (run.tries === 3) setTimeout(() => {
    if (fxRun === run && !run.done) say(run, run.G.easy || 'ง่ายลงแล้ว ลองอีกที');
  }, 1500);
  setTimeout(() => {
    if (fxRun !== run || run.done) return;
    run.missing = false;
    reset();
    run.tryEl.textContent = 'ครั้งที่ ' + (run.tries + 1);
    HSFX.pop();
  }, opt.delay || 1000);
}

// ---------- อนุภาค ----------
// kind: dot · rect · shard · smoke · spark · fire · paper · flash
function fxPart(run, o) {
  run.parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 1, t: 0,
    size: 4, color: '#fff', kind: 'dot', rot: 0, vr: 0, grow: 0, floor: null, alpha: 1 }, o));
}
function fxStepParts(run, dt) {
  for (const p of run.parts) {
    p.t += dt;
    p.vy += p.g * dt;
    if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.size += p.grow * dt;
    if (p.floor != null && p.y > p.floor) {
      p.y = p.floor;
      if (Math.abs(p.vy) > 60) {
        p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5;
        if (p.onLand) { p.onLand(p); p.onLand = null; }
      } else { p.vy = 0; p.vx *= 0.85; p.vr *= 0.8; p.g = 0; }
    }
  }
  run.parts = run.parts.filter(p => p.t < p.life);
}
function fxDrawParts(run, g) {
  for (const p of run.parts) {
    const k = 1 - p.t / p.life;
    g.save();
    g.globalAlpha = p.alpha * (p.kind === 'shard' || p.kind === 'paper' ? Math.min(1, k * 3) : k);
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    if (p.kind === 'flash') {
      const r = p.size;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.4, 'rgba(255,214,120,.8)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    } else if (p.kind === 'smoke' || p.kind === 'fire') {
      g.fillStyle = p.color; g.beginPath(); g.arc(0, 0, Math.max(0.5, p.size), 0, Math.PI * 2); g.fill();
    } else if (p.kind === 'spark') {
      g.strokeStyle = p.color; g.lineWidth = 2; g.lineCap = 'round';
      const sp = Math.hypot(p.vx, p.vy), l = Math.min(18, sp * 0.03);
      g.rotate(Math.atan2(p.vy, p.vx) - p.rot);
      g.beginPath(); g.moveTo(-l, 0); g.lineTo(0, 0); g.stroke();
    } else if (p.kind === 'rect') {
      g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
    } else if (p.kind === 'paper') {
      g.fillStyle = '#FFFFFF'; g.fillRect(-p.size / 2, -p.size * 0.65, p.size, p.size * 1.3);
      g.fillStyle = '#C9D4E6';
      for (let i = 0; i < 3; i++) g.fillRect(-p.size * 0.35, -p.size * 0.4 + i * p.size * 0.35, p.size * 0.7, 1);
    } else if (p.kind === 'shard') {
      g.beginPath();
      p.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      g.closePath();
      g.fillStyle = 'rgba(205,232,255,.55)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 1; g.stroke();
    } else {
      g.fillStyle = p.color; g.beginPath(); g.arc(0, 0, p.size, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}

function fxRoundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// ป้ายชื่องานใต้วัตถุ — บอกว่า "นี่คืองานที่เพิ่งเสร็จ" ทุกเกม
function fxChip(run, g, x, y, alpha = 1) {
  if (!run.label) return;
  g.save();
  g.globalAlpha = alpha;
  g.font = `600 12px ${run.font}`;
  const w = Math.min(run.W - 40, g.measureText(run.label).width + 20);
  fxRoundRect(g, x - w / 2, y, w, 22, 11);
  g.fillStyle = 'rgba(15,20,30,.55)'; g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(run.label, x, y + 11.5, w - 12);
  g.restore();
}
// เส้นจุดทำนายวิถีโค้ง (ระเบิด) · n จุด ห่างกัน dt วินาที
function fxDots(g, x, y, vx, vy, grav, n, dt, color) {
  g.save(); g.fillStyle = color;
  for (let i = 1; i <= n; i++) {
    const t = i * dt;
    g.globalAlpha = (1 - i / (n + 1)) * 0.9;
    g.beginPath(); g.arc(x + vx * t, y + vy * t + grav * t * t / 2, 3.2 - i / n * 1.4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// ============================================================
// เสียงของเกมใหม่ — ใช้ตัวสังเคราะห์ของ HSFX (hoop.js) ทั้งหมด
// ============================================================
const FXS = {
  chime(clean) {
    const notes = clean ? [784, 988, 1175, 1568] : [784, 988, 1175];
    notes.forEach((f, i) => {
      HSFX.tone('triangle', f, f, 0.16, 0.006, 0.42, 0.06 + i * 0.085);
      HSFX.tone('sine', f * 2, f * 2, 0.04, 0.006, 0.25, 0.06 + i * 0.085);
    });
  },
  cheer() {
    HSFX.noise('bandpass', 900, 1100, 0.6, 0.22, 0.25, 1.1);
    HSFX.noise('bandpass', 2400, 2000, 0.8, 0.1, 0.3, 0.9);
    for (let i = 0; i < 14; i++) HSFX.noise('bandpass', fxRand(1200, 2600), 1000, 1.5, fxRand(0.08, 0.16), 0.002, 0.04, fxRand(0.05, 1.0));
  },
  kick(p) {
    HSFX.tone('sine', 140, 55, 0.42, 0.002, 0.2);
    HSFX.noise('lowpass', 1100, 200, 1, 0.3 + p * 0.2, 0.002, 0.12);
    HSFX.noise('bandpass', 700 + p * 900, 300, 1.2, 0.08 + p * 0.1, 0.03, 0.3, 0.03);
  },
  glove() { HSFX.tone('sine', 190, 85, 0.34, 0.002, 0.12); HSFX.noise('lowpass', 900, 300, 1, 0.3, 0.002, 0.07); },
  whiff() { HSFX.noise('bandpass', 500, 2600, 1.6, 0.5, 0.05, 0.16); },
  crack(q) {
    HSFX.noise('highpass', 1800, 900, 0.8, 0.5 + q * 0.2, 0.001, 0.07);
    HSFX.tone('triangle', 1900, 900, 0.22, 0.001, 0.05);
    HSFX.tone('sine', 220, 80, 0.3, 0.002, 0.12);
  },
  pitch() { HSFX.noise('bandpass', 1400, 600, 1.4, 0.22, 0.15, 0.25); },
  putt(p) { HSFX.tone('sine', 1300, 1150, 0.18 + p * 0.1, 0.001, 0.05); HSFX.noise('bandpass', 3200, 2600, 3, 0.16, 0.001, 0.025); },
  cup() {
    [0, 0.07, 0.12, 0.155].forEach((d, i) => HSFX.tone('square', 1700 - i * 120, 1600 - i * 120, 0.12, 0.001, 0.015, d));
    HSFX.tone('sine', 320, 120, 0.3, 0.003, 0.14, 0.18);
  },
  toss() { HSFX.noise('bandpass', 450, 1500, 1.2, 0.12, 0.08, 0.2); },
  blade() { HSFX.noise('bandpass', 2400, 6200, 2, 0.45, 0.02, 0.1); },
  squish() {
    HSFX.noise('lowpass', 2000, 400, 1, 0.42, 0.002, 0.2);
    HSFX.noise('bandpass', 900, 600, 2, 0.2, 0.002, 0.15, 0.02);
    HSFX.tone('sine', 320, 120, 0.2, 0.002, 0.14);
    HSFX.tone('sine', 3300, 3000, 0.05, 0.002, 0.18);
  },
  boom(big) {
    const k = big ? 1 : 0.6;
    HSFX.tone('sine', 95, 28, 0.6 * k, 0.004, 1.0 * k);
    HSFX.noise('lowpass', 1600, 70, 0.8, 0.55 * k, 0.004, 1.2 * k);
    HSFX.noise('highpass', 3000, 1500, 0.7, 0.2 * k, 0.002, 0.25);
    for (let i = 0; i < 6; i++) HSFX.noise('bandpass', fxRand(800, 2500), 500, 2, 0.06 * k, 0.002, 0.05, fxRand(0.1, 0.6));
  },
  throwS() { HSFX.noise('bandpass', 700, 2200, 1.4, 0.16, 0.03, 0.22); },
  crunch(c) {
    const f = fxRand(1800, 6000);
    HSFX.noise('bandpass', f, f * 0.7, 2.2, 0.4 + c * 0.3, 0.001, fxRand(0.015, 0.035));
    if (Math.random() < 0.3) HSFX.noise('lowpass', 900, 400, 1, 0.25 + c * 0.2, 0.002, 0.05);
  },
  balled() {
    for (let i = 0; i < 6; i++) HSFX.noise('bandpass', fxRand(1500, 5000), 1200, 2, 0.45, 0.001, 0.03, i * 0.025);
    HSFX.noise('lowpass', 800, 300, 1, 0.4, 0.003, 0.1, 0.1);
  },
  clank() {
    HSFX.tone('sine', 196, 190, 0.26, 0.002, 0.6);
    HSFX.tone('sine', 523, 515, 0.13, 0.002, 0.4);
    HSFX.tone('sine', 1046, 1030, 0.06, 0.002, 0.25);
    HSFX.noise('lowpass', 700, 300, 1, 0.22, 0.002, 0.1);
  },
  paperLand() { HSFX.noise('lowpass', 700, 300, 1, 0.4, 0.002, 0.08); HSFX.tone('sine', 170, 90, 0.22, 0.002, 0.08); },
  shatter() {
    HSFX.noise('highpass', 4200, 2400, 0.8, 0.5, 0.001, 0.35);
    HSFX.tone('sine', 230, 80, 0.32, 0.002, 0.1);
    for (let i = 0; i < 16; i++) {
      const f = fxRand(2500, 7500);
      HSFX.tone('sine', f, f * 0.98, fxRand(0.04, 0.11), 0.001, fxRand(0.06, 0.22), fxRand(0, 0.28));
    }
  },
  tink() { const f = fxRand(3000, 6500); HSFX.tone('sine', f, f, 0.05, 0.001, 0.06); },
  clink() {
    HSFX.tone('sine', 1900, 1890, 0.2, 0.001, 0.5);
    HSFX.tone('sine', 2870, 2860, 0.1, 0.001, 0.35);
    HSFX.tone('sine', 4400, 4390, 0.05, 0.001, 0.2);
  },
  // เสียงชนวนระเบิด "ฟู่ ๆ" ค้างตลอดที่เล็งอยู่
  hissOn() {
    const ac = HSFX.ctx(); if (!ac || this.hiss) return;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = HSFX.noiseBuf; src.loop = true;
    f.type = 'highpass'; f.frequency.value = 5200;
    g.gain.value = 0.0001; g.gain.setTargetAtTime(0.07, ac.currentTime, 0.05);
    src.connect(f).connect(g).connect(HSFX.out);
    src.start();
    this.hiss = { src, g };
  },
  hissOff() {
    if (!this.hiss || !HSFX.ac) return;
    const { src, g } = this.hiss, t = HSFX.ac.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.03);
    src.stop(t + 0.2);
    this.hiss = null;
  },
};

// ============================================================
// ⚽ ยิงประตู
// ------------------------------------------------------------
// มองจากหลังจุดโทษ · ปัดลูกขึ้น — ทิศปัด = ตำแหน่งที่ลูกไปถึงประตู
// ความเร็วปัด = ความสูงของลูกตอนถึงเส้นประตู (เบาไป = กลิ้งไม่ถึง · แรงไป = ข้ามคาน)
// ผู้รักษาประตูเดินไปมาเป็นจังหวะ — ลูกไปถึงตรงที่เขายืน = โดนเซฟ
// ============================================================
FX_GAMES.goal = {
  aria: 'เตะงานที่เสร็จเข้าประตู',
  hint: 'ปัดลูกขึ้นไปทางประตู · หลบผู้รักษาประตู',
  easy: 'ผู้รักษาประตูเหนื่อยแล้ว — ช้าลงนะ',
  init(r) { r.kph = fxRand(0, 6); this.layout(r); this.reset(r); },
  layout(r) {
    r.gw = Math.min(r.W * 0.74, 280); r.gh = r.gw * 0.36;
    r.gx = r.W / 2; r.gy = Math.round(r.H * 0.36);
    r.bx0 = r.W / 2; r.by0 = Math.round(r.H * 0.8);
  },
  reset(r) {
    Object.assign(r, { bx: r.bx0, by: r.by0, bh: 0, bs: 1, rot: 0, fly: null, after: null, net: null, kdive: 0, held: false });
  },
  down(r, p) { r.held = !r.fly && Math.hypot(p.x - r.bx0, p.y - r.by0) < 90; },
  up(r, p, v) {
    if (!r.held || r.fly) return;
    r.held = false;
    if (v.y > -300) { say(r, 'ปัด<b>ขึ้น</b>ไปทางประตู'); return; }
    const s = Math.hypot(v.x, v.y);
    const aimX = r.bx0 + (v.x / -v.y) * (r.by0 - r.gy);
    // ความเร็วปัดนิ้วจริงบนมือถืออยู่ราว 1,000–2,500 px/วินาที — ช่วงนั้นต้องเข้ากรอบได้
    // (รุ่นแรกเกิน ~1,770 ข้ามคานหมด = ปัดธรรมดาก็ข้ามคาน)
    const weak = s < 500;
    const h = Math.max(0, (s - 500) / 1900) * r.gh;
    r.fly = { t: 0, T: fxClamp(0.95 - (s - 600) / 3200, 0.45, 0.9), x0: r.bx0, y0: r.by0,
      tx: weak ? fxLerp(r.bx0, aimX, 0.55) : aimX, ty: weak ? fxLerp(r.by0, r.gy, 0.55) : r.gy - 2, h, weak, s };
    FXS.kick(fxClamp((s - 600) / 1500, 0, 1));
    haptic('arm');
  },
  step(r, dt) {
    // ผู้รักษาประตูเดินไปมา · พลาดครบ 3 ครั้งช้าลง
    if (!r.kdive) r.kph += dt * (r.tries >= 3 ? 1.15 : 1.9);
    const reach = r.gw / 2 - 24;
    if (!r.kdive) r.kx = r.gx + Math.sin(r.kph) * reach;
    if (r.fly) {
      const f = r.fly;
      f.t += dt;
      const p = Math.min(1, f.t / f.T);
      r.bx = fxLerp(f.x0, f.tx, p);
      r.by = fxLerp(f.y0, f.ty, p);
      r.bs = fxLerp(1, f.weak ? 0.7 : 0.46, p);
      r.bh = (f.h * p + Math.sin(Math.PI * p) * Math.min(36, f.h * 0.4 + 8)) * r.bs;
      r.rot += dt * (8 + f.s / 300);
      if (p >= 1) { r.fly = null; this.resolve(r, f); }
    }
    if (r.after) {
      const a = r.after;
      a.t += dt;
      a.vh += -900 * dt * (a.g ? 1 : 0);
      r.bx += a.vx * dt; r.by += a.vy * dt; r.bh = Math.max(0, r.bh + a.vh * dt);
      r.bs = Math.max(0.2, r.bs + a.vs * dt);
      r.rot += dt * 4;
      if (a.t > 0.7) r.after = null;
    }
    if (r.net) r.net.t += dt;
  },
  resolve(r, f) {
    const half = r.gw / 2, dx = f.tx - r.gx, rr = 22 * 0.46;
    const reset = () => this.reset(r);
    if (f.weak) {
      r.after = { t: 0, vx: 0, vy: 0, vh: 0, vs: 0 };
      return fxMiss(r, 'เบาไป — ปัดแรงกว่านี้', reset);
    }
    if (Math.abs(Math.abs(dx) - half) < rr + 3 && f.h < r.gh) {
      HSFX.rim(0.9);
      r.after = { t: 0, vx: Math.sign(dx) * 160, vy: 260, vh: 0, vs: 0.5 };
      return fxMiss(r, 'ชนเสา! เกือบแล้ว', reset, { delay: 1100 });
    }
    if (Math.abs(dx) > half) {
      r.after = { t: 0, vx: Math.sign(dx) * 200, vy: -60, vh: 0, vs: -0.3 };
      return fxMiss(r, 'ออกข้าง — เล็งเข้ากรอบ', reset);
    }
    if (f.h > r.gh - rr) {
      if (f.h < r.gh + rr) HSFX.rim(0.7);
      r.after = { t: 0, vx: dx * 0.2, vy: -40, vh: 260, vs: -0.4 };
      return fxMiss(r, f.h < r.gh + rr ? 'ชนคาน!' : 'ข้ามคาน — ปัดเบาลงนิด', reset);
    }
    const kReach = r.tries >= 3 ? 20 : 30;
    if (Math.abs(f.tx - r.kx) < kReach + rr && f.h < r.gh * 0.78) {
      r.kdive = Math.sign(f.tx - r.kx) || 1;
      FXS.glove();
      r.after = { t: 0, vx: (f.tx - r.kx) * 3 + fxRand(-60, 60), vy: 300, vh: 120, vs: 0.6 };
      return fxMiss(r, 'โดนเซฟ! เล็งหนีผู้รักษาประตู', reset, { delay: 1150 });
    }
    // เข้า!
    r.net = { t: 0, x: f.tx, y: r.gy - f.h * 0.46 };
    FXS.cheer();
    const far = Math.abs(f.tx - r.kx) > 70;
    fxWin(r, far ? 'โกลสวย ๆ!' : 'โกล!!', r.bx, r.by - r.bh, { clean: far });
  },
  draw(r, g) {
    const W = r.W, H = r.H;
    // ท้องฟ้า + อัฒจันทร์
    let gr = g.createLinearGradient(0, 0, 0, r.gy);
    gr.addColorStop(0, '#5BA3E6'); gr.addColorStop(1, '#BFE0FF');
    g.fillStyle = gr; g.fillRect(0, 0, W, r.gy);
    const standY = r.gy - r.gh - 36;
    g.fillStyle = '#3A4A6B'; g.fillRect(0, standY, W, r.gh + 40);
    for (let y = standY + 6; y < r.gy - 4; y += 7) for (let x = (y % 14) / 2; x < W; x += 9) {
      g.fillStyle = ['#F2C14E', '#E86A5B', '#FFFFFF', '#6FB3F2', '#9AD48A'][(x * 7 + y * 3) % 5 | 0];
      g.globalAlpha = 0.7; g.fillRect(x, y, 3, 3);
    }
    g.globalAlpha = 1;
    // หญ้า — แถบสลับสีที่กว้างขึ้นตามระยะ (ให้รู้สึกลึก)
    let y = r.gy - 6, band = 10, i = 0;
    while (y < H) {
      g.fillStyle = i++ % 2 ? '#3FA34D' : '#47B556';
      g.fillRect(0, y, W, band + 1);
      y += band; band *= 1.28;
    }
    // เส้นกรอบเขตโทษแบบเปอร์สเปกทีฟ
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
    const bxW = r.gw * 0.85, depth = (r.by0 - r.gy) * 0.42;
    g.beginPath();
    g.moveTo(r.gx - bxW, r.gy); g.lineTo(r.gx - bxW * 1.35, r.gy + depth);
    g.lineTo(r.gx + bxW * 1.35, r.gy + depth); g.lineTo(r.gx + bxW, r.gy);
    g.moveTo(0, r.gy); g.lineTo(W, r.gy);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath(); g.ellipse(r.bx0, r.by0 + 4, 5, 2, 0, 0, Math.PI * 2); g.fill();

    // ตาข่าย + เสา
    const L = r.gx - r.gw / 2, T = r.gy - r.gh;
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(L, T, r.gw, r.gh);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
    const bulge = r.net ? Math.max(0, 1 - r.net.t * 1.5) : 0;
    for (let x = L + 10; x < L + r.gw; x += 11) {
      g.beginPath(); g.moveTo(x, T);
      const d = r.net ? Math.exp(-((x - r.net.x) ** 2) / 900) * 10 * bulge : 0;
      g.quadraticCurveTo(x, T + r.gh / 2 - d, x, r.gy); g.stroke();
    }
    for (let yy = T + 9; yy < r.gy; yy += 10) { g.beginPath(); g.moveTo(L, yy); g.lineTo(L + r.gw, yy); g.stroke(); }
    if (r.net) {
      g.fillStyle = `rgba(255,255,255,${0.35 * bulge})`;
      g.beginPath(); g.arc(r.net.x, r.net.y, 18 + r.net.t * 30, 0, Math.PI * 2); g.fill();
    }
    // ลูกที่อยู่ "หลัง" ผู้รักษาประตู (ลอยไปถึงเส้นประตูแล้ว) วาดก่อนตัวเขา
    const deep = r.bs < 0.6;
    if (deep) this.ball(r, g);
    this.keeper(r, g);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 5; g.lineCap = 'round';
    g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 4;
    g.beginPath(); g.moveTo(L, r.gy); g.lineTo(L, T); g.lineTo(L + r.gw, T); g.lineTo(L + r.gw, r.gy); g.stroke();
    g.shadowBlur = 0;
    if (!deep) this.ball(r, g);
    if (!r.fly && !r.after && !r.done && !r.net) fxChip(r, g, r.bx0, r.by0 + 30);
  },
  keeper(r, g) {
    const s = r.gh / 100, x = r.kx, y = r.gy;
    g.save();
    g.translate(x, y);
    if (r.kdive) g.rotate(r.kdive * 0.9);
    g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#20242E'; g.fillRect(-12, -30, 9, 30); g.fillRect(3, -30, 9, 30);         // ขา
    g.fillStyle = '#FF7A1A'; fxRoundRect(g, -16, -66, 32, 40, 8); g.fill();                    // เสื้อ
    g.strokeStyle = '#FF7A1A'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-14, -58); g.lineTo(-34, -70); g.moveTo(14, -58); g.lineTo(34, -70); g.stroke();
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.arc(-36, -72, 6, 0, Math.PI * 2); g.arc(36, -72, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#F1C27D'; g.beginPath(); g.arc(0, -76, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3B2A1E'; g.beginPath(); g.arc(0, -80, 11, Math.PI, 0); g.fill();
    g.restore();
  },
  ball(r, g) {
    const rad = 22 * r.bs, x = r.bx, y = r.by - r.bh;
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.beginPath(); g.ellipse(r.bx, r.by + rad * 0.2, rad * 0.9, rad * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.save();
    g.translate(x, y); g.rotate(r.rot);
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill();
    g.clip();
    g.fillStyle = '#1F2430';
    const pent = (cx, cy, rr) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    pent(0, 0, rad * 0.36);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; pent(Math.cos(a) * rad * 0.95, Math.sin(a) * rad * 0.95, rad * 0.3); }
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.stroke();
  },
};

// ============================================================
// ⚾ ตีโฮมรัน
// ------------------------------------------------------------
// มองจากหลังโฮมเพลต · พิทเชอร์ขว้างลูก (= งาน) เข้ามาหาเรา
// แตะตรงไหนก็ได้บนจอเพื่อเหวี่ยงไม้ — โดนเมื่อแตะตอนลูกอยู่ในกรอบสไตรค์
// ============================================================
FX_GAMES.bat = {
  aria: 'ตีงานที่เสร็จกระเด็นออกสนาม',
  hint: 'แตะจอตอนลูกเข้ากรอบ เพื่อเหวี่ยงไม้',
  easy: 'ลูกช้าลงแล้ว ใจเย็น ๆ',
  init(r) { this.layout(r); this.reset(r); },
  layout(r) {
    r.zx = r.W / 2; r.zy = Math.round(r.H * 0.72);
    r.mx = r.W / 2; r.my = Math.round(r.H * 0.38);
    r.px = r.W * 0.2; r.py = r.H * 0.94;               // จุดหมุนไม้ (มือคนตี)
  },
  reset(r) {
    Object.assign(r, { st: 'wind', wt: 0, p: 0, swung: false, swT: -1, hitBall: null,
      T: fxRand(0.85, 1.1) * (r.tries >= 3 ? 1.35 : 1), curve: fxRand(-26, 26), ex: r.zx + fxRand(-14, 14) });
  },
  down(r) {
    if (r.swung || r.hitBall || r.st === 'gone') return;
    r.swung = true; r.swT = 0;
    FXS.whiff();
    const w0 = r.tries >= 3 ? 0.76 : 0.82, w1 = r.tries >= 3 ? 1.04 : 1.0;
    if (r.st === 'pitch' && r.p >= w0 && r.p <= w1) {
      const q = fxClamp(1 - Math.abs(r.p - 0.92) / 0.1, 0, 1);
      FXS.crack(q);
      haptic('arm');
      r.st = 'gone';
      const bp = this.ballPos(r);
      r.hitBall = { x: bp.x, y: bp.y, s: bp.s, vx: fxRand(-160, 160) + (r.p - 0.92) * -1600, vy: -fxLerp(900, 1400, q), t: 0 };
      const hr = q > 0.3;
      if (hr) FXS.cheer();
      fxWin(r, hr ? 'โฮมรัน!!' : 'ตีโดน! ไปไกลเลย', bp.x, bp.y, { clean: q > 0.75 });
    } else {
      r.early = r.st === 'wind' || r.p < w0;
    }
  },
  ballPos(r) {
    const p = r.p;
    const e = Math.pow(Math.min(p, 1.4), 1.5);
    return { x: fxLerp(r.mx, r.ex, Math.min(1, e)) + Math.sin(Math.PI * Math.min(p, 1)) * r.curve + Math.max(0, p - 1) * 40,
      y: fxLerp(r.my - 20, r.zy, e), s: 0.25 + 0.95 * Math.pow(Math.min(p, 1.3), 1.8) };
  },
  step(r, dt) {
    if (r.swT >= 0) r.swT += dt;
    if (r.st === 'wind') {
      r.wt += dt;
      if (r.wt > 0.85) { r.st = 'pitch'; r.p = 0; FXS.pitch(); }
    } else if (r.st === 'pitch') {
      r.p += dt / r.T;
      if (r.p > 1.18) {
        r.st = 'caught';
        FXS.glove();
        const reset = () => this.reset(r);
        fxMiss(r, !r.swung ? 'สไตรค์! แตะจอตอนลูกเข้ากรอบ' : r.early ? 'เร็วไป — รอให้ลูกถึงกรอบก่อน' : 'ช้าไป — แตะเร็วขึ้นนิด', reset, { delay: 1100 });
      }
    }
    if (r.hitBall) {
      const b = r.hitBall;
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 420 * dt; b.s *= Math.exp(-dt * 1.9);
      if (Math.random() < 0.5) fxPart(r, { x: b.x, y: b.y, size: 2.5 * b.s + 1, color: 'rgba(255,255,255,.8)', life: 0.35 });
    }
  },
  draw(r, g) {
    const W = r.W, H = r.H;
    let gr = g.createLinearGradient(0, 0, 0, H * 0.2);
    gr.addColorStop(0, '#6DB4F2'); gr.addColorStop(1, '#CDE8FF');
    g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.2);
    g.fillStyle = '#25603A'; g.fillRect(0, H * 0.17, W, H * 0.04);          // รั้วนอกสนาม
    g.fillStyle = '#F2C14E'; g.fillRect(0, H * 0.17, W, 2);
    let y = H * 0.21, band = 8, i = 0;
    while (y < H) { g.fillStyle = i++ % 2 ? '#3E9A4C' : '#47AA55'; g.fillRect(0, y, W, band + 1); y += band; band *= 1.25; }
    // ดินในสนาม (ข้าวหลามตัด)
    g.fillStyle = '#C98B5A';
    g.beginPath(); g.moveTo(W / 2, H * 0.27); g.lineTo(W * 1.02, H * 0.62); g.lineTo(W / 2, H * 1.05); g.lineTo(-W * 0.02, H * 0.62); g.closePath(); g.fill();
    g.fillStyle = '#47AA55';
    g.beginPath(); g.moveTo(W / 2, H * 0.34); g.lineTo(W * 0.84, H * 0.6); g.lineTo(W / 2, H * 0.86); g.lineTo(W * 0.16, H * 0.6); g.closePath(); g.fill();
    g.fillStyle = '#C98B5A'; g.beginPath(); g.ellipse(r.mx, r.my + 6, 34, 10, 0, 0, Math.PI * 2); g.fill();
    // พิทเชอร์
    this.pitcher(r, g);
    // กรอบสไตรค์ + โฮมเพลต
    g.save();
    g.setLineDash([6, 5]); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
    const zw = 86, zh = 92;
    g.strokeRect(r.zx - zw / 2, r.zy - zh / 2, zw, zh);
    g.restore();
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.moveTo(r.zx - 26, H * 0.9); g.lineTo(r.zx + 26, H * 0.9); g.lineTo(r.zx + 26, H * 0.92); g.lineTo(r.zx, H * 0.95); g.lineTo(r.zx - 26, H * 0.92); g.closePath(); g.fill();
    // ลูก
    if (r.st === 'pitch' || r.st === 'caught') {
      const b = this.ballPos(r);
      if (r.st === 'pitch') this.ball(g, b.x, b.y, 15 * b.s, r.t * 14);
    }
    if (r.hitBall) this.ball(g, r.hitBall.x, r.hitBall.y, 15 * r.hitBall.s, r.t * 20);
    // ไม้
    this.bat(r, g);
    if (r.st === 'wind' && !r.done && r.tries === 0 && r.wt < 0.8) fxChip(r, g, r.zx, r.zy + 56, Math.min(1, r.wt * 3));
  },
  pitcher(r, g) {
    const x = r.mx, y = r.my, k = r.st === 'wind' ? Math.min(1, r.wt / 0.85) : 1;
    g.save(); g.translate(x, y); g.scale(0.55, 0.55);
    g.fillStyle = '#20242E'; g.fillRect(-9, -28, 7, 28); g.fillRect(2, -28, 7, 28);
    g.fillStyle = '#FFFFFF'; fxRoundRect(g, -13, -60, 26, 34, 7); g.fill();
    g.strokeStyle = '#2A64D8'; g.lineWidth = 2; g.strokeRect(-13, -60, 26, 34);
    const a = -Math.PI / 2 - k * 2.4;
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(10, -54); g.lineTo(10 + Math.cos(a) * 24, -54 + Math.sin(a) * 24); g.stroke();
    g.fillStyle = '#F1C27D'; g.beginPath(); g.arc(0, -70, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2A64D8'; g.beginPath(); g.arc(0, -73, 10, Math.PI, 0); g.fill(); g.fillRect(-2, -74, 16, 3);
    g.restore();
  },
  ball(g, x, y, rad, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = '#E03A2F'; g.lineWidth = Math.max(1, rad * 0.1);
    g.beginPath(); g.arc(-rad * 1.25, 0, rad * 0.85, -0.75, 0.75); g.stroke();
    g.beginPath(); g.arc(rad * 1.25, 0, rad * 0.85, Math.PI - 0.75, Math.PI + 0.75); g.stroke();
    g.restore();
  },
  bat(r, g) {
    // มุมไม้: เงื้อไว้ทางซ้ายบน → กวาดผ่านกรอบไปทางขวา ใน 0.14 วินาที
    const idle = -1.95, end = 0.15;
    let a = idle;
    if (r.swT >= 0) a = r.swT < 0.14 ? fxLerp(idle, end, r.swT / 0.14) : r.swT < 0.6 ? end : fxLerp(end, idle, Math.min(1, (r.swT - 0.6) / 0.3));
    g.save(); g.translate(r.px, r.py); g.rotate(a);
    g.fillStyle = 'rgba(0,0,0,.15)'; fxRoundRect(g, 4, -6, 168, 16, 8); g.fill();
    const gr = g.createLinearGradient(0, 0, 170, 0);
    gr.addColorStop(0, '#8A5A2B'); gr.addColorStop(0.3, '#C8955A'); gr.addColorStop(1, '#E2B47E');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -4); g.lineTo(60, -5); g.quadraticCurveTo(150, -11, 168, -9);
    g.arc(168, 0, 9, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(150, 11, 60, 5); g.lineTo(0, 4); g.closePath(); g.fill();
    g.fillStyle = '#20242E'; g.fillRect(0, -4.5, 30, 9);
    g.restore();
  },
};

// ============================================================
// ⛳ พัตต์ลงหลุม
// ------------------------------------------------------------
// มองจากบน · ดึงลูกถอยหลังแล้วปล่อย (เหมือนห่วง) · ลูกกลิ้งแล้วหยุดเพราะแรงเสียดทาน
// ตกหลุมได้เฉพาะตอนลูก "ช้าพอ" — แรงไปลูกกระโดดข้ามหลุม (เลยหลุม) เหมือนกอล์ฟจริง
// ============================================================
FX_GAMES.golf = {
  aria: 'พัตต์งานที่เสร็จลงหลุม',
  hint: 'ดึงลูกถอยหลังแล้วปล่อย · กะแรงให้พอดีหลุม',
  easy: 'หลุมใหญ่ขึ้นแล้ว',
  FR: 300, SINK: 340, MAXP: 120,
  init(r) {
    r.hx = r.W / 2 + fxRand(-1, 1) * r.W * 0.2;
    this.layout(r); this.reset(r);
  },
  layout(r) {
    r.hy = Math.round(r.H * 0.2);
    const floor = fxFloor(r);
    r.bx0 = r.W / 2;
    r.by0 = Math.max(r.hy + 200, Math.min(r.H * 0.84, floor - this.MAXP));
    r.maxP = Math.max(70, Math.min(this.MAXP, floor - r.by0));
    const D = Math.hypot(r.hx - r.bx0, r.hy - r.by0);
    r.K = Math.sqrt(2 * this.FR * 1.7 * D) / r.maxP;
    // หลุมทราย — วางข้างเส้นตรงระหว่างลูกกับหลุม ให้ต้องคิดนิดหน่อยแต่ไม่บังทาง
    if (!r.sand) {
      const side = Math.random() < 0.5 ? -1 : 1;
      r.sand = { x: fxLerp(r.bx0, r.hx, 0.5) + side * fxRand(62, 90), y: fxLerp(r.by0, r.hy, 0.5), rx: 46, ry: 26 };
    }
  },
  reset(r) { Object.assign(r, { bx: r.bx0, by: r.by0, vx: 0, vy: 0, roll: false, sunk: 0, pull: null, near: 1e9, fastNear: false }); },
  holeR(r) { return r.tries >= 3 ? 15 : 11; },
  down(r, p) {
    if (r.roll || r.sunk) return;
    if (Math.hypot(p.x - r.bx, p.y - r.by) > 70) return;
    r.pull = { x0: p.x, y0: p.y, dx: 0, dy: 0 };
  },
  move(r, p) {
    if (!r.pull) return;
    let dx = p.x - r.pull.x0, dy = p.y - r.pull.y0;
    const l = Math.hypot(dx, dy);
    if (l > r.maxP) { dx *= r.maxP / l; dy *= r.maxP / l; }
    r.pull.dx = dx; r.pull.dy = dy;
  },
  up(r) {
    const pl = r.pull; r.pull = null;
    if (!pl) return;
    const l = Math.hypot(pl.dx, pl.dy);
    if (l < 14) return;
    r.bx += pl.dx * 0.25; r.by += pl.dy * 0.25;    // ปล่อยจากจุดที่เห็นบนจอ
    r.vx = -pl.dx * r.K; r.vy = -pl.dy * r.K; r.roll = true;
    FXS.putt(l / r.maxP);
  },
  cancel(r) { r.pull = null; },
  step(r, dt) {
    if (r.sunk) { r.sunk += dt; return; }
    if (!r.roll) return;
    for (let k = 0; k < 3; k++) this.sub(r, dt / 3);
  },
  sub(r, dt) {
    const s = Math.hypot(r.vx, r.vy);
    const sd = r.sand, inSand = ((r.bx - sd.x) / sd.rx) ** 2 + ((r.by - sd.y) / sd.ry) ** 2 < 1;
    const dec = (inSand ? this.FR * 5 : this.FR) * dt;
    if (s <= dec) { r.vx = r.vy = 0; }
    else { r.vx -= r.vx / s * dec; r.vy -= r.vy / s * dec; }
    r.bx += r.vx * dt; r.by += r.vy * dt;
    // ขอบกรีน
    const m = 22, br = 9;
    if (r.bx < m + br) { r.bx = m + br; r.vx = Math.abs(r.vx) * 0.6; FXS.putt(0.1); }
    if (r.bx > r.W - m - br) { r.bx = r.W - m - br; r.vx = -Math.abs(r.vx) * 0.6; FXS.putt(0.1); }
    if (r.by < m + br) { r.by = m + br; r.vy = Math.abs(r.vy) * 0.6; FXS.putt(0.1); }
    if (r.by > r.H - 8 - br) { r.by = r.H - 8 - br; r.vy = -Math.abs(r.vy) * 0.6; }
    const d = Math.hypot(r.bx - r.hx, r.by - r.hy), sp = Math.hypot(r.vx, r.vy);
    const hr = this.holeR(r), sink = r.tries >= 3 ? this.SINK * 1.35 : this.SINK;
    r.near = Math.min(r.near, d);
    if (d < hr) {
      if (sp < sink) {
        r.sunk = 0.001; r.roll = false;
        FXS.cup();
        fxWin(r, r.tries === 0 ? 'ลงหลุมครั้งเดียว!' : 'ลงหลุม!', r.hx, r.hy, { clean: r.tries === 0 });
        return;
      }
      r.fastNear = true;
      // แรงไป: ลูกเด้งขอบหลุม เบี่ยงนิดหน่อยแล้ววิ่งต่อ
      r.vx += fxRand(-40, 40); r.vy *= 0.9;
    }
    if (sp < 4) {
      r.roll = false;
      const reset = () => this.reset(r);
      const past = r.by < r.hy - 6;
      fxMiss(r, r.fastNear ? 'แรงไป — ลูกข้ามหลุม' : past ? 'แรงไปนิด เลยหลุม' : r.near < 40 ? 'เกือบแล้ว! สั้นไปนิดเดียว' : r.by > r.hy + 30 ? 'สั้นไป — ดึงยาวขึ้น' : 'เบี้ยวไป — เล็งตรงหลุม', reset);
    }
  },
  draw(r, g) {
    const W = r.W, H = r.H;
    g.fillStyle = '#2F7A3A'; g.fillRect(0, 0, W, H);
    fxRoundRect(g, 12, 6, W - 24, H - 10, 30);
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#79C66A'); gr.addColorStop(1, '#5FAE52');
    g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    g.globalAlpha = 0.12; g.fillStyle = '#FFFFFF';
    for (let x = -H; x < W + H; x += 36) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 18, 0); g.lineTo(x + 18 + H * 0.6, H); g.lineTo(x + H * 0.6, H); g.fill(); }
    g.restore(); g.globalAlpha = 1;
    // หลุมทราย
    const sd = r.sand;
    g.fillStyle = '#E8D29B'; g.beginPath(); g.ellipse(sd.x, sd.y, sd.rx, sd.ry, 0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 3; g.stroke();
    // หลุม + ธง
    const hr = this.holeR(r);
    g.fillStyle = '#1B2A1E'; g.beginPath(); g.ellipse(r.hx, r.hy, hr, hr * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5; g.stroke();
    const wave = Math.sin(r.t * 5) * 3;
    g.strokeStyle = '#E8E8E8'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(r.hx, r.hy); g.lineTo(r.hx, r.hy - 64); g.stroke();
    g.fillStyle = '#E03A2F';
    g.beginPath(); g.moveTo(r.hx, r.hy - 64); g.quadraticCurveTo(r.hx + 16, r.hy - 60 + wave, r.hx + 30, r.hy - 55 + wave); g.lineTo(r.hx, r.hy - 46); g.closePath(); g.fill();
    // ลูกศรเล็ง
    if (r.pull) {
      const l = Math.hypot(r.pull.dx, r.pull.dy), k = l / r.maxP;
      const ux = -r.pull.dx / (l || 1), uy = -r.pull.dy / (l || 1), len = 30 + l * 1.4;
      g.save();
      g.strokeStyle = k < 0.6 ? '#FFFFFF' : k < 0.85 ? '#FFE07A' : '#FF8A6A';
      g.lineWidth = 3; g.setLineDash([7, 6]); g.lineCap = 'round';
      g.beginPath(); g.moveTo(r.bx, r.by); g.lineTo(r.bx + ux * len, r.by + uy * len); g.stroke();
      g.setLineDash([]);
      g.beginPath(); g.moveTo(r.bx + ux * (len + 10), r.by + uy * (len + 10));
      g.lineTo(r.bx + ux * len - uy * 7, r.by + uy * len + ux * 7); g.lineTo(r.bx + ux * len + uy * 7, r.by + uy * len - ux * 7);
      g.closePath(); g.fillStyle = g.strokeStyle; g.fill();
      g.restore();
    }
    // ลูก
    let bx = r.bx, by = r.by, br = 9;
    if (r.sunk) { const k = Math.min(1, r.sunk / 0.25); bx = fxLerp(r.bx, r.hx, k); by = fxLerp(r.by, r.hy, k); br = 9 * (1 - k * 0.7); }
    if (r.pull) { bx += r.pull.dx * 0.25; by += r.pull.dy * 0.25; }
    if (!(r.sunk > 0.3)) {
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(bx + 2, by + 3, br, br * 0.7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,.12)';
      for (const [ox, oy] of [[-3, -2], [2, -3], [3, 2], [-2, 3], [0, 0]]) { g.beginPath(); g.arc(bx + ox, by + oy, 1, 0, Math.PI * 2); g.fill(); }
    }
    if (!r.roll && !r.sunk && !r.pull && !r.done) fxChip(r, g, r.bx0, r.by0 + 18);
  },
};

// ============================================================
// 🍉 หั่นผลไม้
// ------------------------------------------------------------
// งานลอยขึ้นมาเป็นผลไม้ (ติดสติกเกอร์ชื่องาน) · ปาดนิ้วผ่าให้ทันก่อนตกจอ
// ต้องปาดเร็วพอ (ไม่ใช่แตะเฉย ๆ) และเส้นต้องตัดผ่านผล
// ============================================================
FX_GAMES.slice = {
  aria: 'หั่นงานที่เสร็จ',
  hint: 'ปาดนิ้วผ่าผลไม้ที่ลอยขึ้นมา',
  easy: 'ผลไม้ลอยช้าลงและใหญ่ขึ้นแล้ว',
  KINDS: [
    { out: '#2E8B3A', stripe: '#1E5E27', rind: '#BFE3A0', in: '#F0435A', seed: '#2B2F3A', juice: '#FF5A70' },
    { out: '#F7931E', stripe: null, rind: '#FFE2B0', in: '#FFB347', seed: null, juice: '#FFB020' },
    { out: '#D9343A', stripe: null, rind: '#FFF6E0', in: '#FFF1CF', seed: '#5A3A1E', juice: '#FFE9A8' },
  ],
  init(r) { r.trail = []; this.reset(r); },
  reset(r) {
    const easy = r.tries >= 3;
    r.grav = easy ? 760 : 1200;
    r.R = easy ? 50 : 40;
    const kind = this.KINDS[Math.floor(Math.random() * this.KINDS.length)];
    const x = fxRand(0.3, 0.7) * r.W;
    const vy = -Math.sqrt(2 * r.grav * (r.H + r.R - r.H * 0.26));
    r.f = { x, y: r.H + r.R, vx: (r.W / 2 - x) * 0.55 + fxRand(-40, 40), vy, rot: 0, vr: fxRand(-2, 2), kind, wait: 0.45, tossed: false };
    r.halves = null;
  },
  move(r, p, v) {
    const tr = r.trail;
    const prev = tr[tr.length - 1];
    tr.push({ x: p.x, y: p.y, t: r.t });
    const sp = Math.hypot(v.x, v.y);
    if (sp > 900 && (!r.lastBlade || r.t - r.lastBlade > 0.16)) { FXS.blade(); r.lastBlade = r.t; }
    if (!prev || !r.f || r.halves || !r.f.tossed || sp < 350) return;
    // ระยะจากจุดกลางผลถึงเส้นที่ปาด
    const f = r.f, ax = prev.x, ay = prev.y, bx = p.x, by = p.y;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const t = fxClamp(((f.x - ax) * dx + (f.y - ay) * dy) / L2, 0, 1);
    const d = Math.hypot(ax + dx * t - f.x, ay + dy * t - f.y);
    if (d < r.R) this.cut(r, Math.atan2(dy, dx), d);
  },
  down(r, p) { r.trail = [{ x: p.x, y: p.y, t: r.t }]; },
  cut(r, ang, d) {
    const f = r.f, nx = -Math.sin(ang), ny = Math.cos(ang);
    r.halves = [1, -1].map(s => ({ x: f.x, y: f.y, vx: f.vx + nx * 170 * s, vy: f.vy * 0.4 + ny * 170 * s - 120, rot: ang, vr: s * 3.2, side: s }));
    for (let i = 0; i < 34; i++) {
      const a = fxRand(0, Math.PI * 2), sp = fxRand(80, 420);
      fxPart(r, { x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 900, size: fxRand(2, 5), color: f.kind.juice, life: fxRand(0.5, 0.9) });
    }
    for (let i = 0; i < 7; i++) r.decals.push({ x: f.x + fxRand(-1, 1) * r.R * 1.4, y: f.y + fxRand(-1, 1) * r.R * 1.2, rr: fxRand(6, 20), c: f.kind.juice });
    FXS.squish();
    const clean = d < r.R * 0.28;
    fxWin(r, clean ? 'ผ่ากลางเป๊ะ!' : 'ฉึบ!', f.x, f.y, { clean });
  },
  step(r, dt) {
    const f = r.f;
    if (f && !r.halves) {
      if (f.wait > 0) { f.wait -= dt; if (f.wait <= 0) { f.tossed = true; FXS.toss(); } }
      else {
        f.vy += r.grav * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        if (f.vy > 0 && f.y > r.H + r.R + 6) { r.f = null; fxMiss(r, 'หลุดมือ! ปาดให้โดนผล', () => this.reset(r), { delay: 700 }); }
      }
    }
    if (r.halves) for (const h of r.halves) { h.vy += r.grav * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; }
    r.trail = r.trail.filter(p => r.t - p.t < 0.14);
  },
  draw(r, g) {
    const W = r.W, H = r.H;
    // เขียงไม้
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#C48A4E'); gr.addColorStop(1, '#9E6A36');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(70,40,15,.35)'; g.lineWidth = 2;
    for (let x = W / 5; x < W; x += W / 5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    g.strokeStyle = 'rgba(70,40,15,.12)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const x = (i * 53) % W; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 14, H * 0.3, x - 10, H * 0.6, x + 8, H); g.stroke(); }
    for (const d of r.decals) { g.globalAlpha = 0.32; g.fillStyle = d.c; g.beginPath(); g.arc(d.x, d.y, d.rr, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    if (r.f && !r.halves && r.f.tossed) this.fruit(r, g, r.f);
    if (r.halves) for (const h of r.halves) this.half(r, g, h);
    if (r.f && !r.f.tossed && !r.done) fxChip(r, g, W / 2, H * 0.5, 0.9);
    // รอยใบมีด
    const tr = r.trail;
    if (tr.length > 1) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 1; i < tr.length; i++) {
        const k = i / tr.length;
        g.strokeStyle = `rgba(255,255,255,${0.9 * k})`; g.lineWidth = 1 + 6 * k;
        g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke();
      }
      g.restore();
    }
  },
  fruit(r, g, f) {
    const R = r.R, k = f.kind;
    g.save(); g.translate(f.x, f.y); g.rotate(f.rot);
    g.fillStyle = k.out; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    if (k.stripe) {
      g.save(); g.clip(); g.strokeStyle = k.stripe; g.lineWidth = R * 0.16;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * R * 0.32, -R); g.quadraticCurveTo(i * R * 0.42, 0, i * R * 0.32, R); g.stroke(); }
      g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(-R * 0.35, -R * 0.4, R * 0.28, R * 0.16, -0.6, 0, Math.PI * 2); g.fill();
    // สติกเกอร์ชื่องาน
    g.font = `700 11px ${r.font}`;
    const w = Math.min(R * 1.7, g.measureText(r.label).width + 12);
    fxRoundRect(g, -w / 2, -9, w, 18, 6); g.fillStyle = 'rgba(255,255,255,.94)'; g.fill();
    g.fillStyle = '#1F2430'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(r.label, 0, 0.5, w - 6);
    g.restore();
  },
  half(r, g, h) {
    const R = r.R, k = r.f.kind;
    g.save(); g.translate(h.x, h.y); g.rotate(h.rot + (h.side < 0 ? Math.PI : 0));
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI); g.closePath();
    g.fillStyle = k.out; g.fill();
    g.beginPath(); g.arc(0, 0, R * 0.9, 0, Math.PI); g.closePath(); g.fillStyle = k.rind; g.fill();
    g.beginPath(); g.arc(0, 0, R * 0.8, 0, Math.PI); g.closePath(); g.fillStyle = k.in; g.fill();
    if (k.seed) { g.fillStyle = k.seed; for (const [x, y] of [[-R * 0.4, R * 0.25], [0, R * 0.45], [R * 0.4, R * 0.25], [-R * 0.15, R * 0.18], [R * 0.18, R * 0.2]]) { g.beginPath(); g.ellipse(x, y, 2.2, 3.4, 0, 0, Math.PI * 2); g.fill(); } }
    else { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.2; for (let i = 1; i < 6; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78); g.stroke(); } }
    g.restore();
  },
};

// ============================================================
// 💣 ปาระเบิดใส่
// ------------------------------------------------------------
// มองด้านข้าง · กองงานตั้งอยู่บนพื้นฝั่งขวา · ดึงระเบิดถอยไปทางซ้ายล่างแล้วปล่อย
// ตกใกล้กองงานพอ (อยู่ในรัศมีระเบิด) = กระจุย · พลาดครบ 3 ครั้งรัศมีใหญ่ขึ้น
// ============================================================
FX_GAMES.bomb = {
  aria: 'ปาระเบิดใส่งานที่เสร็จ',
  hint: 'ดึงระเบิดถอยหลังแล้วปล่อย ให้ตกใส่กองงาน',
  easy: 'ระเบิดลูกใหญ่ขึ้นแล้ว',
  GR: 1500, MAXP: 120,
  init(r) {
    r.tx = fxRand(0.6, 0.84) * r.W;
    this.layout(r); this.reset(r);
  },
  layout(r) {
    r.gy = Math.round(r.H * 0.8);
    const floor = fxFloor(r);
    r.bx0 = Math.round(r.W * 0.2);
    r.by0 = Math.min(r.gy - 34, floor - this.MAXP);
    r.maxP = Math.max(70, Math.min(this.MAXP, floor - r.by0));
    const D = Math.max(120, r.tx - r.bx0);
    r.K = Math.sqrt(1.6 * D * this.GR) / (r.maxP * 0.8);
  },
  reset(r) { Object.assign(r, { bx: r.bx0, by: r.by0, vx: 0, vy: 0, fly: false, pull: null, boomed: false, gone: false, rot: 0 }); },
  blastR(r) { return r.tries >= 3 ? 105 : 72; },
  down(r, p) {
    if (r.fly || r.boomed) return;
    if (Math.hypot(p.x - r.bx, p.y - r.by) > 80) return;
    r.pull = { x0: p.x, y0: p.y, dx: 0, dy: 0 };
    FXS.hissOn();
  },
  move(r, p) {
    if (!r.pull) return;
    let dx = p.x - r.pull.x0, dy = p.y - r.pull.y0;
    const l = Math.hypot(dx, dy);
    if (l > r.maxP) { dx *= r.maxP / l; dy *= r.maxP / l; }
    r.pull.dx = dx; r.pull.dy = dy;
    HSFX.stretch(Math.min(1, l / r.maxP));
  },
  up(r) {
    const pl = r.pull; r.pull = null; HSFX.release();
    if (!pl) return;
    if (Math.hypot(pl.dx, pl.dy) < 16) { FXS.hissOff(); return; }
    r.bx += pl.dx * 0.4; r.by += pl.dy * 0.4;      // ปล่อยจากจุดที่เห็นบนจอ (ตรงกับเส้นจุด)
    r.vx = -pl.dx * r.K; r.vy = -pl.dy * r.K; r.fly = true;
    FXS.hissOff();
    FXS.throwS();
    haptic('arm');
  },
  cancel(r) { r.pull = null; FXS.hissOff(); HSFX.release(); },
  step(r, dt) {
    if (!r.fly) return;
    r.vy += this.GR * dt; r.bx += r.vx * dt; r.by += r.vy * dt; r.rot += dt * 6;
    if (Math.random() < 0.7) fxPart(r, { x: r.bx + 9, y: r.by - 13, vx: fxRand(-30, 30), vy: fxRand(-60, -10), size: 1.6, color: '#FFD15A', kind: 'dot', life: 0.25 });
    const T = { x: r.tx - 32, y: r.gy - 70, w: 64, h: 70 };
    const direct = r.bx > T.x - 12 && r.bx < T.x + T.w + 12 && r.by > T.y - 12;
    if (direct || r.by >= r.gy - 12) return this.explode(r, direct);
    if (r.bx > r.W + 40 || r.bx < -40) {
      r.fly = false; r.gone = true;
      fxMiss(r, 'ปาเลยจอไป — ดึงเบาลง', () => this.reset(r));
    }
  },
  explode(r, direct) {
    r.fly = false; r.boomed = true;
    const x = r.bx, y = Math.min(r.by, r.gy - 6);
    const tcx = r.tx, tcy = r.gy - 35;
    const hit = direct || Math.hypot(x - tcx, y - tcy) < this.blastR(r);
    const big = hit ? 1 : 0.7;
    r.shake = 14 * big;
    FXS.boom(hit);
    fxPart(r, { kind: 'flash', x, y, size: 40 * big, grow: 260, life: 0.28 });
    for (let i = 0; i < 22; i++) { const a = fxRand(0, Math.PI * 2), s = fxRand(60, 260) * big; fxPart(r, { kind: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, drag: 3, size: fxRand(6, 14) * big, grow: 18, color: ['#FFD15A', '#FF9A2E', '#FF5A2E'][i % 3], life: fxRand(0.35, 0.6) }); }
    for (let i = 0; i < 14; i++) fxPart(r, { kind: 'smoke', x: x + fxRand(-20, 20), y: y + fxRand(-10, 6), vx: fxRand(-30, 30), vy: fxRand(-90, -30), drag: 1.2, size: fxRand(10, 18) * big, grow: 26, color: 'rgba(90,95,105,.45)', life: fxRand(0.9, 1.5) });
    for (let i = 0; i < 18; i++) { const a = fxRand(-Math.PI, 0), s = fxRand(300, 650); fxPart(r, { kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, color: '#FFE08A', life: fxRand(0.3, 0.6) }); }
    for (let i = 0; i < 10; i++) fxPart(r, { kind: 'rect', x, y, vx: fxRand(-220, 220), vy: fxRand(-420, -160), g: 1300, size: fxRand(4, 8), color: '#7A5634', vr: fxRand(-8, 8), floor: r.gy, life: 1.6 });
    r.decals.push({ x, y: r.gy });
    if (hit) {
      r.gone = true;
      for (let i = 0; i < 26; i++) fxPart(r, { kind: 'paper', x: tcx + fxRand(-26, 26), y: tcy + fxRand(-30, 30), vx: fxRand(-260, 260), vy: fxRand(-620, -260), g: 520, drag: 0.9, size: fxRand(8, 14), vr: fxRand(-9, 9), life: 2.4 });
      fxWin(r, direct ? 'ตูม!! ตรงเป้า' : 'ตูม!!', tcx, tcy, { clean: direct, burstDelay: 200, hold: 1900 });
    } else {
      fxMiss(r, 'พลาดเป้า — ' + (x < tcx ? 'ไม่ถึง ดึงแรงขึ้น' : 'เลยไป ดึงเบาลง'), () => this.reset(r), { delay: 1300, quiet: true });
      setTimeout(() => { if (fxRun === r && !r.done) HSFX.miss(); }, 350);
    }
  },
  draw(r, g) {
    const W = r.W, H = r.H;
    const gr = g.createLinearGradient(0, 0, 0, r.gy);
    gr.addColorStop(0, '#7FB8EE'); gr.addColorStop(1, '#DCEEFF');
    g.fillStyle = gr; g.fillRect(0, 0, W, r.gy);
    g.fillStyle = '#9CC98E';
    g.beginPath(); g.moveTo(0, r.gy); g.quadraticCurveTo(W * 0.25, r.gy - 70, W * 0.5, r.gy - 20); g.quadraticCurveTo(W * 0.78, r.gy - 80, W, r.gy - 30); g.lineTo(W, r.gy); g.fill();
    g.fillStyle = '#6E4B2E'; g.fillRect(0, r.gy, W, H - r.gy);
    g.fillStyle = '#4CA154'; g.fillRect(0, r.gy - 4, W, 10);
    for (const d of r.decals) { g.fillStyle = 'rgba(30,20,10,.55)'; g.beginPath(); g.ellipse(d.x, d.y + 3, 26, 6, 0, 0, Math.PI * 2); g.fill(); }
    // กองงาน
    if (!r.gone || !r.done) this.pile(r, g);
    // ระเบิด + เส้นเล็ง
    if (!r.boomed && !r.gone) {
      let x = r.bx, y = r.by;
      if (r.pull) {
        x += r.pull.dx * 0.4; y += r.pull.dy * 0.4;
        const long = r.tries >= 3;
        fxDots(g, x, y, -r.pull.dx * r.K, -r.pull.dy * r.K, this.GR, long ? 24 : 8, long ? 0.05 : 0.045, 'rgba(40,40,50,.6)');
      }
      this.bombAt(r, g, x, y);
    }
    if (!r.fly && !r.boomed && !r.pull && !r.done) fxChip(r, g, r.tx, r.gy + 12);
  },
  pile(r, g) {
    if (r.gone) return;
    const x = r.tx, y = r.gy;
    g.save(); g.translate(x, y);
    for (let i = 0; i < 4; i++) {
      g.save(); g.translate(0, -i * 15 - 10); g.rotate([0.04, -0.06, 0.08, -0.03][i]);
      g.fillStyle = ['#FFFFFF', '#F4F6FA', '#FFFFFF', '#EEF2F8'][i];
      g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 3;
      g.fillRect(-32, -9, 64, 18); g.shadowBlur = 0;
      g.fillStyle = '#C9D4E6'; g.fillRect(-24, -2, 40, 1.5);
      g.restore();
    }
    g.restore();
  },
  bombAt(r, g, x, y) {
    g.save(); g.translate(x, y); g.rotate(r.fly ? r.rot : -0.2);
    g.fillStyle = '#2B2F3A'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(-5, -5, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5A6070'; g.save(); g.rotate(0.7); g.fillRect(-4, -19, 8, 6); g.restore();
    g.strokeStyle = '#C8955A'; g.lineWidth = 2; g.beginPath(); g.moveTo(9, -14); g.quadraticCurveTo(14, -22, 9 + Math.sin(r.t * 20), -24); g.stroke();
    const fl = 3 + Math.sin(r.t * 40) * 1.5;
    g.fillStyle = '#FFB020'; g.beginPath(); g.arc(9, -25, fl, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFF2B0'; g.beginPath(); g.arc(9, -25, fl * 0.45, 0, Math.PI * 2); g.fill();
    g.restore();
  },
};

// ============================================================
// 🗑️ ขยำงาน
// ------------------------------------------------------------
// ขั้นแรก: ถูนิ้วไปมาบนกระดาษงาน — ยิ่งถูยิ่งยับ จนกลายเป็นก้อนกลม
// ขั้นสอง: ปัดก้อนกระดาษขึ้นไปลงถังขยะ · ไม่ลงก็ปาใหม่ได้ (ไม่ต้องขยำใหม่)
// ============================================================
FX_GAMES.crumple = {
  aria: 'ขยำงานที่เสร็จแล้วปาลงถัง',
  hint: 'ถูนิ้วไปมาบนกระดาษเพื่อขยำ',
  easy: 'ถังใบใหญ่ขึ้นแล้ว',
  RUB: 1400,          // ระยะถูรวม (px) จนเป็นก้อน — ราว 8–10 รอบถูไปมา ไม่จบเร็วจนไม่ทันรู้สึก
  init(r) {
    r.stage = 'paper'; r.c = 0; r.rub = 0;
    r.vtx = [];
    const N = 28;
    for (let i = 0; i < N; i++) r.vtx.push({ j: fxRand(-1, 1), k: fxRand(0.7, 1.15), a: fxRand(-0.3, 0.3) });
    r.creases = Array.from({ length: 9 }, () => [fxRand(-1, 1), fxRand(-1, 1), fxRand(-1, 1), fxRand(-1, 1)]);
    r.binX = r.W / 2 + fxRand(-1, 1) * r.W * 0.2;
    this.layout(r);
  },
  layout(r) {
    r.pw = Math.min(r.W * 0.62, 230); r.ph = r.pw * 1.28;
    r.pcx = r.W / 2; r.pcy = Math.round(r.H * 0.46);
    r.binY = Math.round(r.H * 0.25);
    r.bx0 = r.W / 2; r.by0 = Math.round(r.H * 0.8);
    if (r.stage !== 'paper' && !r.fly) { r.bx = r.bx0; r.by = r.by0; }
  },
  binW(r) { return r.tries >= 3 ? 116 : 88; },
  // จุดขอบกระดาษ i: เลื่อนจากสี่เหลี่ยม → วงกลมยับ ตามความยับ c
  poly(r, cx, cy, scale) {
    const N = r.vtx.length, c = r.c, e = c * c * (3 - 2 * c);
    const out = [];
    for (let i = 0; i < N; i++) {
      const t = i / N, per = 2 * (r.pw + r.ph), d = t * per;
      let x, y;
      if (d < r.pw) { x = -r.pw / 2 + d; y = -r.ph / 2; }
      else if (d < r.pw + r.ph) { x = r.pw / 2; y = -r.ph / 2 + (d - r.pw); }
      else if (d < 2 * r.pw + r.ph) { x = r.pw / 2 - (d - r.pw - r.ph); y = r.ph / 2; }
      else { x = -r.pw / 2; y = r.ph / 2 - (d - 2 * r.pw - r.ph); }
      const v = r.vtx[i], a = Math.atan2(y, x) + v.a * c, rr = 34 * v.k;
      const bx = Math.cos(a) * rr, by = Math.sin(a) * rr;
      const wob = Math.sin(Math.PI * c) * 18 * v.j;
      out.push([cx + (fxLerp(x, bx, e) + wob * Math.cos(a)) * scale, cy + (fxLerp(y, by, e) + wob * Math.sin(a)) * scale]);
    }
    return out;
  },
  down(r, p) { r.last = p; r.held = r.stage === 'ball' && !r.fly && Math.hypot(p.x - r.bx, p.y - r.by) < 90; },
  move(r, p) {
    if (r.stage !== 'paper' || !r.last) return;
    const d = Math.hypot(p.x - r.last.x, p.y - r.last.y);
    r.last = p;
    r.rub += d;
    r.c = Math.min(1, r.rub / this.RUB);
    r.jx = fxRand(-2, 2); r.jy = fxRand(-2, 2);
    r.acc = (r.acc || 0) + d;
    while (r.acc > 16) { r.acc -= 16; FXS.crunch(r.c); }
    if (r.c >= 1) {
      r.stage = 'toBall'; r.tb = 0;
      FXS.balled(); haptic('arm');
      say(r, 'ขยำแล้ว! ปัดลงถังเลย');
      r.hint.textContent = 'ปัดก้อนกระดาษขึ้นไปลงถัง';
      r.hint.classList.remove('off');
    }
  },
  up(r, p, v) {
    r.last = null;
    if (r.stage !== 'ball' || !r.held || r.fly) return;
    r.held = false;
    if (v.y > -280) { say(r, 'ปัด<b>ขึ้น</b>ไปทางถัง'); return; }
    const s = Math.hypot(v.x, v.y);
    // ปัด ~1,400 px/วิ = ถึงถังพอดี · ลาดชันต่ำ ช่วงที่ลงจึงกว้าง ~1,000–1,800 (ไม่ต้องแม่นระดับร้อย)
    const travel = 1 + (s - 1400) / 2600;
    const ly = r.by0 - travel * (r.by0 - r.binY);
    const lx = r.bx0 + (v.x / -v.y) * (r.by0 - ly);
    r.fly = { t: 0, T: 0.7, x0: r.bx0, y0: r.by0, lx, ly };
    FXS.throwS();
    r.hint.classList.add('off');
  },
  step(r, dt) {
    if (r.stage === 'toBall') {
      r.tb += dt / 0.4;
      if (r.tb >= 1) { r.stage = 'ball'; r.bx = r.bx0; r.by = r.by0; r.bs = 1; }
    }
    if (r.fly) {
      const f = r.fly;
      f.t += dt;
      const p = Math.min(1, f.t / f.T);
      r.bx = fxLerp(f.x0, f.lx, p);
      r.by = fxLerp(f.y0, f.ly, p) - Math.sin(Math.PI * p) * r.H * 0.2;
      r.bs = fxLerp(1, 0.62, p);
      r.spin = (r.spin || 0) + dt * 7;
      if (p >= 1) { r.fly = null; this.land(r, f); }
    }
    if (r.into) { r.into.t += dt; }
    if (r.wob) r.wob = Math.max(0, r.wob - dt * 3);
  },
  land(r, f) {
    const half = this.binW(r) / 2, dx = f.lx - r.binX, dy = f.ly - r.binY;
    const depthOK = Math.abs(dy) < (r.tries >= 3 ? 90 : 60);
    const reset = () => { r.bx = r.bx0; r.by = r.by0; r.bs = 1; r.held = false; };
    if (depthOK && Math.abs(dx) < half - 6) {
      r.into = { t: 0 }; r.wob = 1;
      FXS.clank();
      return fxWin(r, Math.abs(dx) < half * 0.35 ? 'ลงถังกลาง ๆ!' : 'ลงถัง!', r.binX, r.binY, { clean: Math.abs(dx) < half * 0.35 });
    }
    if (depthOK && Math.abs(dx) < half + 14) {
      r.wob = 0.6; FXS.clank();
      r.bx += Math.sign(dx) * 30; r.by += 40;
      return fxMiss(r, 'โดนขอบถัง! เกือบแล้ว', reset);
    }
    FXS.paperLand();
    fxMiss(r, 'ไม่ลง — ' + (dy > 0 ? 'แรงไม่ถึง' : dy < 0 && !depthOK ? 'แรงไป' : 'เบี้ยวไป'), reset);
  },
  draw(r, g) {
    const W = r.W, H = r.H;
    // พื้นโต๊ะ/พื้นห้อง
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#E9E4DA'); gr.addColorStop(1, '#CFC6B6');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 1;
    for (let y = H * 0.15; y < H; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    if (r.stage !== 'paper') this.bin(r, g, r.stage === 'toBall' ? r.tb : 1);
    if (r.stage === 'paper' || r.stage === 'toBall') {
      let cx = r.pcx + (r.jx || 0), cy = r.pcy + (r.jy || 0), sc = 1;
      if (r.stage === 'toBall') { const k = r.tb; cx = fxLerp(r.pcx, r.bx0, k); cy = fxLerp(r.pcy, r.by0, k); }
      this.paper(r, g, cx, cy, sc);
      if (r.stage === 'paper' && r.c > 0) {
        g.fillStyle = 'rgba(0,0,0,.12)'; fxRoundRect(g, W * 0.25, H * 0.88, W * 0.5, 6, 3); g.fill();
        g.fillStyle = '#F2661B'; fxRoundRect(g, W * 0.25, H * 0.88, W * 0.5 * r.c, 6, 3); g.fill();
      }
    } else {
      const inside = r.into && r.into.t > 0.08;
      if (!inside) this.paper(r, g, r.bx, r.by, r.bs || 1);
      if (!r.fly && !r.done && !r.missing) fxChip(r, g, r.bx0, r.by0 + 42);
    }
  },
  paper(r, g, cx, cy, sc) {
    const pts = this.poly(r, cx, cy, sc);
    g.save();
    if (r.fly || r.stage === 'ball') { g.translate(cx, cy); g.rotate(r.spin || 0); g.translate(-cx, -cy); }
    g.shadowColor = 'rgba(0,0,0,.2)'; g.shadowBlur = 10; g.shadowOffsetY = 4;
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    const gr = g.createLinearGradient(cx - 40, cy - 40, cx + 40, cy + 40);
    gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, r.c > 0.5 ? '#DADDE3' : '#F4F5F8');
    g.fillStyle = gr; g.fill();
    g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.save(); g.clip();
    // ตัวหนังสือบนกระดาษ — จางลงตามความยับ
    const ta = Math.max(0, 1 - r.c * 1.4);
    if (ta > 0) {
      g.save();
      g.globalAlpha = ta;
      const s = 1 - r.c * 0.7;
      g.translate(cx, cy); g.scale(s * sc, s * sc);
      g.fillStyle = '#1F2430'; g.font = `700 16px ${r.font}`; g.textAlign = 'center';
      g.fillText(r.label, 0, -r.ph / 2 + 40, r.pw - 30);
      g.fillStyle = '#C9D4E6';
      for (let i = 0; i < 7; i++) g.fillRect(-r.pw / 2 + 22, -r.ph / 2 + 64 + i * 22, (r.pw - 44) * (i === 6 ? 0.55 : 1), 2);
      g.restore();
    }
    // รอยยับ
    g.globalAlpha = Math.min(1, r.c * 1.5) * 0.45;
    g.strokeStyle = '#9EA4AF'; g.lineWidth = 1;
    const span = fxLerp(r.pw / 2, 34, r.c) * sc;
    for (const [a, b, c2, d] of r.creases) { g.beginPath(); g.moveTo(cx + a * span, cy + b * span); g.lineTo(cx + c2 * span, cy + d * span); g.stroke(); }
    g.restore();
    g.restore();
  },
  bin(r, g, alpha) {
    const w = this.binW(r), x = r.binX, y = r.binY, h = 96;
    const wob = (r.wob || 0) * Math.sin(r.t * 30) * 0.05;
    g.save(); g.globalAlpha = alpha;
    g.translate(x, y + h); g.rotate(wob); g.translate(-x, -(y + h));
    g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(x, y + h + 2, w * 0.42, 7, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, '#7F8796'); gr.addColorStop(0.45, '#C5CBD5'); gr.addColorStop(1, '#6E7685');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.37, y + h); g.lineTo(x - w * 0.37, y + h); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x + i * w * 0.12, y + 8); g.lineTo(x + i * w * 0.09, y + h - 6); g.stroke(); }
    g.fillStyle = '#2B2F3A'; g.beginPath(); g.ellipse(x, y, w / 2 - 3, 9, 0, 0, Math.PI * 2); g.fill();
    // ก้อนกระดาษตกลงไปในถัง — เห็นแวบเดียวที่ปากถัง
    if (r.into && r.into.t < 0.12) { g.fillStyle = '#EEF0F3'; g.beginPath(); g.arc(x + (r.fly ? 0 : 0), y - 4 + r.into.t * 60, 16, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#A9B0BC'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y, w / 2, 10, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  },
};

// ============================================================
// 🥂 ปาแก้ว
// ------------------------------------------------------------
// กำแพงอิฐข้างหน้า มีเป้าวาดไว้ · ปัดแก้ว (= งาน) ขึ้นไปแรง ๆ ให้ชนกำแพงแตก
// เบาไปแก้วตกพื้น "ตึ๋ง" ไม่แตก → ปาใหม่ · เข้าเป้ากลางได้โบนัส
// ============================================================
FX_GAMES.glass = {
  aria: 'ปาแก้วใส่กำแพง',
  hint: 'ปัดแก้วขึ้นไปแรง ๆ ให้ชนกำแพง',
  easy: 'กำแพงใกล้เข้ามาแล้ว ปาเบา ๆ ก็ถึง',
  init(r) {
    r.tgx = r.W / 2 + fxRand(-1, 1) * r.W * 0.18;
    this.layout(r); this.reset(r);
  },
  layout(r) {
    r.wb = Math.round(r.H * 0.5);
    r.tgy = Math.round(r.H * 0.24);
    r.bx0 = r.W / 2; r.by0 = Math.round(r.H * 0.8);
  },
  reset(r) { Object.assign(r, { gx: r.bx0, gy: r.by0, gs: 1, grot: 0, fly: null, broken: false, held: false, lay: false }); },
  down(r, p) { r.held = !r.fly && !r.broken && Math.hypot(p.x - r.gx, p.y - r.gy) < 90; },
  up(r, p, v) {
    if (!r.held || r.fly) return;
    r.held = false;
    if (v.y > -280) { say(r, 'ปัด<b>ขึ้น</b>ไปทางกำแพง'); return; }
    const s = Math.hypot(v.x, v.y), need = r.tries >= 3 ? 520 : 820;
    const weak = s < need;
    let ty, tx;
    if (weak) {
      ty = r.by0 - (r.by0 - r.wb) * (s / need) * 0.85;
      tx = r.bx0 + (v.x / -v.y) * (r.by0 - ty);
    } else {
      ty = fxClamp(r.wb - 14 - (s - need) / 1600 * (r.wb - 30), 24, r.wb - 14);
      tx = fxClamp(r.bx0 + (v.x / -v.y) * (r.by0 - ty), 16, r.W - 16);
    }
    r.fly = { t: 0, T: weak ? 0.55 : 0.42, x0: r.bx0, y0: r.by0, tx, ty, weak };
    FXS.throwS();
  },
  step(r, dt) {
    if (!r.fly) return;
    const f = r.fly;
    f.t += dt;
    const p = Math.min(1, f.t / f.T);
    r.gx = fxLerp(f.x0, f.tx, p);
    r.gy = fxLerp(f.y0, f.ty, p) - (f.weak ? Math.sin(Math.PI * p) * 60 : 0);
    r.gs = fxLerp(1, f.weak ? 0.75 : 0.55, p);
    r.grot += dt * (f.weak ? 6 : 12);
    if (p >= 1) { r.fly = null; f.weak ? this.drop(r) : this.smash(r, f); }
  },
  drop(r) {
    r.lay = true; r.grot = Math.PI / 2;
    FXS.clink();
    fxMiss(r, 'เบาไป แก้วไม่แตก — ปาแรงกว่านี้', () => this.reset(r), { delay: 1150 });
  },
  smash(r, f) {
    r.broken = true; r.shake = 6;
    FXS.shatter();
    const x = f.tx, y = f.ty;
    for (let i = 0; i < 24; i++) {
      const a = fxRand(0, Math.PI * 2), sp = fxRand(120, 460);
      const pts = Array.from({ length: 3 + (i % 2) }, () => [fxRand(-9, 9), fxRand(-9, 9)]);
      fxPart(r, { kind: 'shard', pts, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 60, g: 1300, vr: fxRand(-12, 12),
        floor: r.wb + fxRand(8, r.H * 0.3), life: 2.2, onLand: () => { if (Math.random() < 0.5) FXS.tink(); } });
    }
    for (let i = 0; i < 14; i++) { const a = fxRand(0, Math.PI * 2), sp = fxRand(80, 300); fxPart(r, { kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 400, color: '#FFFFFF', life: fxRand(0.2, 0.45) }); }
    r.decals.push({ x, y });
    const bull = Math.hypot(x - r.tgx, y - r.tgy) < 22, onTarget = Math.hypot(x - r.tgx, y - r.tgy) < 40;
    fxWin(r, bull ? 'เป้ากลาง! เพล้ง!!' : onTarget ? 'เข้าเป้า! เพล้ง!' : 'เพล้ง!', x, y, { clean: bull });
  },
  draw(r, g) {
    const W = r.W, H = r.H;
    // กำแพงอิฐ
    g.fillStyle = '#9C4A35'; g.fillRect(0, 0, W, r.wb);
    const bh = 20, bw = 46;
    for (let row = 0, y = 0; y < r.wb; row++, y += bh) {
      for (let x = (row % 2) * -bw / 2; x < W; x += bw) {
        g.fillStyle = ['#B5573E', '#A9503A', '#BD6248', '#AE5940'][(row * 3 + Math.round(x / bw)) & 3];
        g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
    // เป้า
    for (const [rad, c] of [[40, '#FFFFFF'], [31, '#E03A2F'], [22, '#FFFFFF'], [12, '#E03A2F']]) {
      g.globalAlpha = 0.88; g.fillStyle = c; g.beginPath(); g.arc(r.tgx, r.tgy, rad, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // รอยแตกบนกำแพง
    for (const d of r.decals) {
      g.strokeStyle = 'rgba(40,20,10,.45)'; g.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.3; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + Math.cos(a) * 20, d.y + Math.sin(a) * 20); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(d.x, d.y, 9, 0, Math.PI * 2); g.fill();
    }
    // พื้น
    const fg = g.createLinearGradient(0, r.wb, 0, H);
    fg.addColorStop(0, '#8E8E8E'); fg.addColorStop(1, '#5E6168');
    g.fillStyle = fg; g.fillRect(0, r.wb, W, H - r.wb);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, r.wb, W, 4);
    if (!r.broken) this.glass(r, g, r.gx, r.gy, r.gs, r.lay ? Math.PI / 2 : r.fly ? r.grot : 0);
    if (!r.fly && !r.broken && !r.done && !r.lay) fxChip(r, g, r.bx0, r.by0 + 40);
  },
  glass(r, g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    if (!r.fly) { g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 34, 20, 4, 0, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.moveTo(-22, -38); g.lineTo(22, -38); g.bezierCurveTo(22, -10, 14, 4, 0, 6); g.bezierCurveTo(-14, 4, -22, -10, -22, -38); g.closePath();
    g.fillStyle = 'rgba(200,228,255,.45)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(160,40,70,.75)';                     // น้ำในแก้ว
    g.beginPath(); g.moveTo(-19, -22); g.lineTo(19, -22); g.bezierCurveTo(19, -6, 12, 3, 0, 4); g.bezierCurveTo(-12, 3, -19, -6, -19, -22); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-14, -32); g.quadraticCurveTo(-15, -16, -9, -6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 6); g.lineTo(0, 30); g.stroke();
    g.beginPath(); g.ellipse(0, 31, 14, 3.5, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(220,236,255,.8)'; g.fill(); g.stroke();
    g.restore();
  },
};
