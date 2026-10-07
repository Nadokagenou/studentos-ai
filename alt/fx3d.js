// ============================================================
// เอฟเฟกต์ตอนงานเสร็จ · โหมด 3D (Three.js)
// ------------------------------------------------------------
// เจ้าของ (7 ต.ค. 2569): "เกมทุกอันเพิ่มระบบ 3D มาด้วย แยกไว้ ได้มาจากการสุ่มสกิล rate 0.1%
// ถ้าสุ่มได้แต่ไม่มีเอฟเฟคนั้นก็ยังไม่สามารถใช้งานได้ · เปลี่ยน 2D เป็น 3D ได้"
//
// ทำไม Three.js (และทำไมวางไว้ในแอป ไม่ดึงจาก CDN):
//   • ฟิสิกส์ 3D จริง แสง เงา วัสดุ — เขียนเองบน canvas 2D ได้แค่ "ดูคล้าย 3D"
//   • vendor/three.module.min.js (MIT · 676KB · gzip ~170KB) **โหลดตอนเปิดเกม 3D ครั้งแรกเท่านั้น**
//     คนที่ไม่มี 3D ไม่เคยโหลดไฟล์นี้ · ไม่อยู่ใน SHELL ของ sw.js (ไม่บังคับทุกเครื่องเก็บ)
//     แต่ sw.js เก็บทุกไฟล์ในโดเมนเดียวกันที่โหลดผ่านลงแคชเอง → ครั้งต่อไปเล่นออฟไลน์ได้
//   • โหลดไม่ได้ (ออฟไลน์ครั้งแรก) หรือเครื่องไม่มี WebGL = **เล่นแบบ 2D แทนเงียบ ๆ** ไม่มีจอพัง
//
// กติกาเดียวกับ 2D ทุกข้อ (หัว hoop.js · fxgames.js) · ใช้จอกลาง fxShell · fxWin · fxMiss · เสียง FXS/HSFX
// หน่วยในโลก 3D = เมตร · แกน y ขึ้น · ผู้เล่นมองไปทาง −z
// ปิดจอ = คืน WebGL context ทุกครั้ง (เบราว์เซอร์ให้มีพร้อมกันได้จำกัด เปิดค้างไว้ = จอดำในรอบหลัง ๆ)
// ============================================================

const FX3D_GAMES = {};
let FX3D_T = null;

function fx3dLoad() {
  if (FX3D_T) return Promise.resolve(FX3D_T);
  return import('./vendor/three.module.min.js').then(m => (FX3D_T = m));
}
function fx3dSupported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (_) { return false; }
}
function fx3dFallback(id, title, onClose, preview, why) {
  if (id === 'hoop') openHoop(title, onClose, preview); else openFxGame(id, title, onClose, preview);
  if (why && fxRun) say(fxRun, why);
}

async function open3D(id, title, onClose, preview) {
  const G = FX3D_GAMES[id];
  if (!G || !fx3dSupported()) return fx3dFallback(id, title, onClose, preview, G ? 'เครื่องนี้เปิด 3D ไม่ได้ — เล่นแบบ 2D' : '');
  const run = fxShell(title, onClose, preview, G.aria + ' แบบ 3D', G.hint);
  if (!run) return;
  Object.assign(run, { id, G, label: fxLabel(title), parts: [], bodies: [], sprites: [], shake: 0, t: 0, is3d: true });
  run.ov.classList.add('fxg', 'fx3');
  const cv = document.createElement('canvas'); cv.className = 'fx-cv';
  const c2 = document.createElement('canvas'); c2.className = 'fx-cv2';
  run.court.insertBefore(c2, run.court.firstChild);
  run.court.insertBefore(cv, c2);
  run.cv = cv; run.c2 = c2;
  say(run, 'กำลังโหลด 3D…');
  clearTimeout(run.msgT);
  let T;
  try { T = await fx3dLoad(); }
  catch (_) {
    if (fxRun === run) { closeFx(true); fx3dFallback(id, title, onClose, preview, 'โหลด 3D ไม่ได้ — เล่นแบบ 2D แทน'); }
    return;
  }
  if (fxRun !== run) return;
  run.msg.className = 'hp-msg';
  run.T = T;
  try { fx3dSetup(run, T); G.init(run, T); }
  catch (e) {
    console.warn('fx3d', e);
    if (fxRun === run) { closeFx(true); fx3dFallback(id, title, onClose, preview, 'เปิด 3D ไม่สำเร็จ — เล่นแบบ 2D'); }
    return;
  }
  fxBindPointer(run);
  fx3dLoop(run);
  run.cleanup = () => fx3dDispose(run);
  run.rs = () => { if (fxRun === run) fx3dResize(run); };
  window.addEventListener('resize', run.rs);
}

function fx3dSetup(run, T) {
  const R = new T.WebGLRenderer({ canvas: run.cv, antialias: true, powerPreference: 'low-power' });
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  R.shadowMap.enabled = true;
  R.shadowMap.type = T.PCFSoftShadowMap;
  R.toneMapping = T.ACESFilmicToneMapping;
  R.toneMappingExposure = 0.92;
  R.outputColorSpace = T.SRGBColorSpace;
  const S = new T.Scene();
  const C = new T.PerspectiveCamera(55, 1, 0.05, 300);
  const hemi = new T.HemisphereLight(0xffffff, 0x50586a, 1.1);
  const sun = new T.DirectionalLight(0xffffff, 2.4);
  sun.position.set(4, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
  S.add(hemi, sun, sun.target);
  Object.assign(run, { R, S, C, sun, hemi, ray: new T.Raycaster(), v3: new T.Vector3(), camBase: new T.Vector3() });
  run.g2 = run.c2.getContext('2d');
  fx3dResize(run);
  const cs = getComputedStyle(document.documentElement);
  run.col = { ink: cs.getPropertyValue('--ink').trim() || '#1F2430' };
  run.font = getComputedStyle(document.body).fontFamily;
  run.dot = fx3dDotTex(T);
}

function fx3dResize(run) {
  const r = run.court.getBoundingClientRect();
  run.W = r.width; run.H = r.height;
  run.R.setSize(r.width, r.height, false);
  run.C.aspect = r.width / r.height;
  run.C.updateProjectionMatrix();
  const d = Math.min(2, window.devicePixelRatio || 1);
  run.c2.width = Math.round(r.width * d); run.c2.height = Math.round(r.height * d);
  run.g2.setTransform(d, 0, 0, d, 0, 0);
  if (run.G && run.G.layout) run.G.layout(run);
}

function fx3dLoop(run) {
  let last = performance.now();
  const tick = now => {
    if (fxRun !== run) return;
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    run.t += dt;
    run.G.step(run, dt);
    fx3dStepBodies(run, dt);
    fx3dStepSprites(run, dt);
    const C = run.C;
    if (run.shake > 0) {
      run.shake = Math.max(0, run.shake - dt * 2.5);
      C.position.set(run.camBase.x + fxRand(-1, 1) * run.shake * 0.08, run.camBase.y + fxRand(-1, 1) * run.shake * 0.08, run.camBase.z);
    } else C.position.copy(run.camBase);
    run.R.render(run.S, C);
    const g = run.g2;
    g.clearRect(0, 0, run.W, run.H);
    if (run.G.draw2d) run.G.draw2d(run, g);
    run.raf = requestAnimationFrame(tick);
  };
  run.raf = requestAnimationFrame(tick);
}

function fx3dDispose(run) {
  try { FXS.hissOff(); } catch (_) {}
  const S = run.S;
  if (S) S.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach(m => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); });
  });
  if (run.R) { run.R.dispose(); try { run.R.forceContextLoss(); } catch (_) {} }
}

// ---------- พิกัด ----------
function fx3dToScreen(run, v) {
  const p = run.v3.copy(v).project(run.C);
  return { x: (p.x + 1) / 2 * run.W, y: (1 - p.y) / 2 * run.H, z: p.z };
}
function fx3dRayPlane(run, px, py, plane) {
  const T = run.T;
  run.ray.setFromCamera(new T.Vector2(px / run.W * 2 - 1, -(py / run.H) * 2 + 1), run.C);
  const out = new T.Vector3();
  return run.ray.ray.intersectPlane(plane, out) ? out : null;
}
// ทิศที่ปัดบนจอ → ตำแหน่ง x ในโลกที่ความลึก z (และความสูง y) ของเป้า
// เอาเส้นที่ปัดไปต่อจนถึงระดับเป้าบนจอ แล้วยิงรังสีจากจุดนั้นเข้าไปหาระนาบ z ของเป้า
// (รุ่นแรกคูณอัตราส่วนบนจอตรง ๆ — ภาพมีระยะไกลใกล้ ปัดตรงถังลูกไปตกห่าง ~60 ซม.)
function fx3dAimX(run, from, v, z, y) {
  const T = run.T;
  const a = fx3dToScreen(run, from), b = fx3dToScreen(run, new T.Vector3(from.x, y, z));
  const sx = a.x + (v.x / -v.y) * (a.y - b.y);
  const hit = fx3dRayPlane(run, sx, b.y, new T.Plane(new T.Vector3(0, 0, 1), -z));
  return hit ? hit.x : from.x;
}
function fx3dLook(run, pos, at) {
  run.camBase.set(pos[0], pos[1], pos[2]);
  run.C.position.copy(run.camBase);
  run.C.lookAt(at[0], at[1], at[2]);
}

// ---------- พื้นผิวจาก canvas ----------
function fx3dTex(T, w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function fx3dDotTex(T) {
  return fx3dTex(T, 64, 64, (g, w) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
// ป้ายชื่องาน (สติกเกอร์บนวัตถุ)
function fx3dLabel(run, T, text, o = {}) {
  const w = o.w || 512, h = o.h || 128;
  return fx3dTex(T, w, h, (g) => {
    g.fillStyle = o.bg || '#FFFFFF';
    const r = h * 0.28;
    g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
    g.fillStyle = o.fg || '#1F2430';
    g.font = `700 ${Math.round(h * 0.42)}px ${run.font}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 30);
  });
}
function fx3dStd(T, color, o = {}) { return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0 }, o)); }

// ---------- อนุภาค (สไปรต์) ----------
// kind: add (เรืองแสง · ไฟ · ประกาย) · alpha (ควัน · น้ำ)
function fx3dSprite(run, o) {
  const T = run.T;
  const m = new T.SpriteMaterial({ map: run.dot, color: o.color || 0xffffff, transparent: true, depthWrite: false,
    blending: o.add ? T.AdditiveBlending : T.NormalBlending, opacity: o.alpha == null ? 1 : o.alpha });
  const s = new T.Sprite(m);
  s.position.copy(o.pos);
  s.scale.setScalar(o.size || 0.1);
  run.S.add(s);
  run.sprites.push({ s, v: (o.vel || new T.Vector3()).clone(), g: o.g || 0, drag: o.drag || 0, life: o.life || 1, t: 0,
    size: o.size || 0.1, grow: o.grow || 0, a0: o.alpha == null ? 1 : o.alpha, floor: o.floor });
}
function fx3dStepSprites(run, dt) {
  const keep = [];
  for (const p of run.sprites) {
    p.t += dt;
    p.v.y -= p.g * dt;
    if (p.drag) p.v.multiplyScalar(Math.exp(-p.drag * dt));
    p.s.position.addScaledVector(p.v, dt);
    if (p.floor != null && p.s.position.y < p.floor) { p.s.position.y = p.floor; p.v.set(p.v.x * 0.3, 0, p.v.z * 0.3); }
    p.size += p.grow * dt;
    p.s.scale.setScalar(Math.max(0.001, p.size));
    p.s.material.opacity = p.a0 * Math.max(0, 1 - p.t / p.life);
    if (p.t < p.life) keep.push(p);
    else { run.S.remove(p.s); p.s.material.dispose(); }
  }
  run.sprites = keep;
}

// ---------- ชิ้นส่วนที่มีฟิสิกส์ (เศษแก้ว · กระดาษ · ดิน) ----------
function fx3dBody(run, mesh, o) {
  run.S.add(mesh);
  run.bodies.push(Object.assign({ mesh, v: new run.T.Vector3(), w: new run.T.Vector3(), g: 9.8, floor: 0, bounce: 0.3, life: 3, t: 0, drag: 0 }, o));
}
function fx3dStepBodies(run, dt) {
  const keep = [];
  for (const b of run.bodies) {
    b.t += dt;
    b.v.y -= b.g * dt;
    if (b.drag) b.v.multiplyScalar(Math.exp(-b.drag * dt));
    b.mesh.position.addScaledVector(b.v, dt);
    b.mesh.rotation.x += b.w.x * dt; b.mesh.rotation.y += b.w.y * dt; b.mesh.rotation.z += b.w.z * dt;
    if (b.mesh.position.y < b.floor) {
      b.mesh.position.y = b.floor;
      if (Math.abs(b.v.y) > 0.8) { b.v.y *= -b.bounce; b.v.x *= 0.6; b.v.z *= 0.6; b.w.multiplyScalar(0.5); if (b.onLand) { b.onLand(b); b.onLand = null; } }
      else { b.v.set(b.v.x * 0.8, 0, b.v.z * 0.8); b.w.multiplyScalar(0.8); b.g = 0; }
    }
    if (b.t > b.life - 0.4 && b.mesh.material && b.mesh.material.transparent) b.mesh.material.opacity = Math.max(0, (b.life - b.t) / 0.4) * (b.op0 || 1);
    if (b.t < b.life) keep.push(b);
    else { run.S.remove(b.mesh); if (b.mesh.geometry) b.mesh.geometry.dispose(); }
  }
  run.bodies = keep;
}

// ---------- ชนะ / พลาด (ส่งพิกัดโลก) ----------
function fx3dWin(run, text, pos, opt) {
  const p = fx3dToScreen(run, pos);
  fxWin(run, text, p.x, p.y, opt);
}
// จุดทำนายวิถีบนชั้น 2D — ฉายจากตำแหน่ง 3D ตามเวลา
function fx3dDots(run, g, p0, v, grav, n, dt, color) {
  g.save(); g.fillStyle = color || 'rgba(255,255,255,.9)';
  const T = run.T, q = new T.Vector3();
  for (let i = 1; i <= n; i++) {
    const t = i * dt;
    q.set(p0.x + v.x * t, p0.y + v.y * t - grav * t * t / 2, p0.z + v.z * t);
    if (q.y < 0) break;
    const s = fx3dToScreen(run, q);
    g.globalAlpha = (1 - i / (n + 1)) * 0.95;
    g.beginPath(); g.arc(s.x, s.y, 3.4 - i / n * 1.6, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
// ป้ายชื่องานบนชั้น 2D ใต้ตำแหน่งโลก
function fx3dChip(run, g, pos, dy = 28) {
  const s = fx3dToScreen(run, pos);
  fxChip(run, g, s.x, s.y + dy);
}

// ============================================================
// 🏀 โยนลงห่วง 3D
// ------------------------------------------------------------
// ยิมในร่ม · ห่วงจริง 3.05 ม. ห่าง 4.6 ม. · ดึงลงแล้วปล่อยเหมือน 2D (แรง = ระยะดึง · ซ้ายขวา = ทิศดึง)
// ขอบห่วงเป็นวงแหวนที่ชนได้จริงรอบวง · ชนแป้นได้ · ลงห่วงได้เฉพาะขาลง
// ============================================================
FX3D_GAMES.hoop = {
  aria: 'โยนงานที่เสร็จลงห่วง', hint: 'ดึงลงแล้วปล่อย เพื่อโยนลงห่วง', easy: 'ใบ้ให้แล้ว — ดูเส้นจุดตอนดึง',
  RIM_Y: 3.05, RIM_R: 0.23, BALL_R: 0.12, HZ: -4.6, MAXP: 140,
  init(run, T) {
    const S = run.S;
    S.background = new T.Color(0x1A2238);
    S.fog = new T.Fog(0x1A2238, 9, 22);
    run.hx = fxRand(-0.55, 0.55);
    // พื้นไม้
    const wood = fx3dTex(T, 512, 512, (g, w, h) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = ['#C98B4E', '#BF8045', '#D19458', '#C4874B'][i % 4];
        g.fillRect(0, i * h / 8, w, h / 8);
        g.fillStyle = 'rgba(80,40,10,.25)'; g.fillRect(0, i * h / 8, w, 2);
        for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(80,40,10,.18)'; g.fillRect(((i * 97 + k * 173) % w), i * h / 8, 2, h / 8); }
      }
    }, [6, 6]);
    const floor = new T.Mesh(new T.PlaneGeometry(30, 30), fx3dStd(T, 0xffffff, { map: wood, roughness: 0.45 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    const key = new T.Mesh(new T.PlaneGeometry(4.9, 5.8), fx3dStd(T, 0x2A64D8, { roughness: 0.5, transparent: true, opacity: 0.55 }));
    key.rotation.x = -Math.PI / 2; key.position.set(0, 0.005, -2.0); key.receiveShadow = true; S.add(key);
    const wall = new T.Mesh(new T.PlaneGeometry(30, 12), fx3dStd(T, 0x24304F, { roughness: 0.9 }));
    wall.position.set(0, 6, -7.5); S.add(wall);
    // เสา + แป้น + ห่วง + ตาข่าย
    const hz = this.HZ, ry = this.RIM_Y, hx = run.hx;
    const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 3.6, 16), fx3dStd(T, 0x3A4252, { metalness: 0.6, roughness: 0.4 }));
    pole.position.set(hx, 1.8, hz - 1.2); pole.castShadow = true; S.add(pole);
    const arm = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.9), pole.material);
    arm.position.set(hx, 3.35, hz - 0.8); S.add(arm);
    const boardTex = fx3dTex(T, 256, 150, (g, w, h) => {
      g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#E03A2F'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
      g.lineWidth = 7; g.strokeRect(w / 2 - 38, h - 70, 76, 58);
    });
    run.boardZ = hz - 0.38;
    const board = new T.Mesh(new T.BoxGeometry(1.8, 1.05, 0.04), [0, 0, 0, 0, 0, 0].map((_, i) =>
      i === 4 ? fx3dStd(T, 0xffffff, { map: boardTex, roughness: 0.2 }) : fx3dStd(T, 0xe8ecf2)));
    board.position.set(hx, ry + 0.42, run.boardZ - 0.02); board.castShadow = true; S.add(board);
    const rim = new T.Mesh(new T.TorusGeometry(this.RIM_R, 0.018, 12, 40), fx3dStd(T, 0xF2661B, { metalness: 0.5, roughness: 0.35 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(hx, ry, hz); rim.castShadow = true; S.add(rim);
    const net = new T.Mesh(new T.CylinderGeometry(this.RIM_R, this.RIM_R * 0.6, 0.42, 16, 4, true),
      new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.85 }));
    net.position.set(hx, ry - 0.21, hz); S.add(net);
    Object.assign(run, { rim, net });
    // ลูก — ลายบาส + ป้ายชื่องาน
    const bt = fx3dTex(T, 512, 256, (g, w, h) => {
      g.fillStyle = '#E8742A'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(120,50,10,.18)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.strokeStyle = '#2A1608'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      [w * 0.25, w * 0.75].forEach(x => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); });
      [0, w / 2].forEach(x => { g.beginPath(); g.ellipse(x, h / 2, w * 0.13, h * 0.5, 0, 0, Math.PI * 2); g.stroke(); });
      g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(w * 0.35, h * 0.38, w * 0.3, h * 0.24);
      g.fillStyle = '#1F2430'; g.font = `700 ${h * 0.13}px ${run.font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(run.label, w / 2, h / 2 + 1, w * 0.28);
    });
    const ball = new T.Mesh(new T.SphereGeometry(this.BALL_R, 32, 24), fx3dStd(T, 0xffffff, { map: bt, roughness: 0.7 }));
    ball.castShadow = true; S.add(ball);
    run.ball = ball;
    run.sun.position.set(hx + 3, 9, hz + 5); run.sun.target.position.set(hx, 0, hz + 2);
    this.layout(run);
    this.reset(run);
  },
  layout(run) {
    const T = run.T;
    fx3dLook(run, [0, 1.66, 1.45], [run.hx * 0.45, 2.3, this.HZ]);
    run.C.updateMatrixWorld();
    // วางลูกจาก "จุดบนจอ" ไม่ใช่จุดในโลก — ต้องมีที่ใต้ลูกให้ดึงสุดแขนทุกขนาดจอ
    // (บทเรียนจากห่วง 2D รุ่นแรก: ลูกชิดล่าง = ดึงได้ไม่พอ = โยนยังไงก็ไม่ถึง)
    const floor = fxFloor(run);
    const sy = Math.min(run.H * 0.8, floor - this.MAXP - 6);
    run.p0 = fx3dRayPlane(run, run.W / 2, sy, new T.Plane(new T.Vector3(0, 0, 1), 0.7)) || new T.Vector3(0, 1.2, -0.7);
    run.maxP = Math.max(70, Math.min(this.MAXP, floor - sy));
    if (run.ball && !run.fly) run.ball.position.copy(run.p0);
  },
  reset(run) {
    run.ball.position.copy(run.p0);
    run.v = new run.T.Vector3();
    Object.assign(run, { fly: false, pull: null, scored: false, touched: false, board: false, apex: 0, ft: 0, desc: false });
  },
  down(run, p) {
    if (run.fly || run.missing) return;
    const s = fx3dToScreen(run, run.ball.position);
    if (Math.hypot(p.x - s.x, p.y - s.y) > 80) return;
    run.pull = { x0: p.x, y0: p.y, dx: 0, dy: 0 };
    HSFX.grab();
  },
  move(run, p) {
    if (!run.pull) return;
    let dx = p.x - run.pull.x0, dy = p.y - run.pull.y0;
    const l = Math.hypot(dx, dy);
    if (l > run.maxP) { dx *= run.maxP / l; dy *= run.maxP / l; }
    run.pull.dx = dx; run.pull.dy = dy;
    HSFX.stretch(dy > 0 ? Math.min(1, l / run.maxP) : 0);
  },
  // แรง + ทิศจากระยะดึง — **มีตัวช่วยเล็งแบบเกมบาสในมือถือ**
  // 3D จริงไม่ให้อภัย: ระยะลึกต้องตรง ±11 ซม. จาก 4.6 ม. (จำลอง: ลงเฉพาะดึง 70% เป๊ะ ๆ) · ซ้ายขวาพลาดได้แค่ ~5px
  // จึงคิดความเร็วที่ "ลงพอดี" ไว้ก่อน แล้วให้ช่วงดึง 60–85% บีบเข้าหาค่านั้น (นอกช่วงยังเบา/แรงไปจริง)
  // และทิศที่เล็งใกล้ห่วง (±35 ซม.) ถูกดูดเข้าหาห่วง 60% — เบี้ยวมากยังออกข้างเหมือนเดิม
  launchV(run, pl) {
    const T = run.T, p0 = run.p0;
    const s = Math.hypot(pl.dx, pl.dy) / run.maxP;
    const el = 62 * Math.PI / 180, cs = Math.cos(el), tn = Math.tan(el);   // 52° ลูกแบนเกิน ชนขอบหน้าแม้แรงเป๊ะ
    const dz = p0.z - this.HZ, dy = this.RIM_Y + 0.04 - p0.y;
    const vI = Math.sqrt(9.8 * dz * dz / (2 * cs * cs * Math.max(0.2, dz * tn - dy)));
    const f = s < 0.6 ? 0.988 - (0.6 - s) * 0.9 : s > 0.85 ? 1.013 + (s - 0.85) * 0.9 : 1 + (s - 0.725) * 0.1;
    const sp = vI * f;
    let ax = (-pl.dx / run.maxP) * 1.4;
    const off = ax - run.hx;
    if (Math.abs(off) < 0.35) ax = run.hx + off * 0.4;
    const vz = sp * cs, t = dz / vz;
    return new T.Vector3((ax - p0.x) / t, sp * Math.sin(el), -vz);
  },
  up(run) {
    const pl = run.pull; run.pull = null; HSFX.release();
    if (!pl) return;
    if (Math.hypot(pl.dx, pl.dy) < 18 || pl.dy <= 4) { if (Math.hypot(pl.dx, pl.dy) >= 18) say(run, 'ดึง<b>ลง</b>แล้วปล่อย ลูกจะพุ่งขึ้น'); return; }
    HSFX.whoosh(Math.hypot(pl.dx, pl.dy) / run.maxP);
    run.v = this.launchV(run, pl);
    run.fly = true; run.ft = 0; run.apex = run.ball.position.y;
    haptic('arm');
  },
  cancel(run) { run.pull = null; HSFX.release(); },
  step(run, dt) {
    if (run.netT != null) {
      run.netT += dt;
      const k = Math.max(0, 1 - run.netT * 1.6);
      run.net.scale.set(1 - 0.18 * k * Math.sin(run.netT * 18), 1 + 0.35 * k, 1 - 0.18 * k * Math.sin(run.netT * 18));
    }
    if (!run.fly) return;
    for (let i = 0; i < 4; i++) this.sub(run, dt / 4);
  },
  sub(run, dt) {
    const b = run.ball.position, v = run.v, r = this.BALL_R, ry = this.RIM_Y, R = this.RIM_R;
    const prevY = b.y;
    run.ft += dt;
    v.y -= 9.8 * dt;
    b.addScaledVector(v, dt);
    run.ball.rotation.x -= dt * 8;
    run.apex = Math.max(run.apex, b.y);
    if (v.y < 0) run.desc = true;
    if (!run.scored) {
      // ขอบห่วง: จุดบนวงที่ใกล้ลูกที่สุด
      const dx = b.x - run.hx, dz = b.z - this.HZ, hd = Math.hypot(dx, dz) || 1e-4;
      const px = run.hx + dx / hd * R, pz = this.HZ + dz / hd * R;
      const nx = b.x - px, ny = b.y - ry, nz = b.z - pz, d = Math.hypot(nx, ny, nz);
      if (d < r + 0.018 && d > 1e-4) {
        const ux = nx / d, uy = ny / d, uz = nz / d, vn = v.x * ux + v.y * uy + v.z * uz;
        b.set(px + ux * (r + 0.018), ry + uy * (r + 0.018), pz + uz * (r + 0.018));
        if (vn < 0) {
          v.x -= 1.55 * vn * ux; v.y -= 1.55 * vn * uy; v.z -= 1.55 * vn * uz;
          if (-vn > 0.6) HSFX.rim(Math.min(1, -vn / 6));
          if (!run.touched) haptic('arm');
          run.touched = true;
        }
      }
      // แป้น
      if (b.z - r < run.boardZ && v.z < 0 && Math.abs(b.x - run.hx) < 0.9 && b.y > ry - 0.12 && b.y < ry + 0.95) {
        b.z = run.boardZ + r; v.z = -v.z * 0.6; v.x *= 0.8;
        run.board = true; FXS.glove();
      }
      // ลงห่วง: ผ่านระดับขอบลงมา ในวงขอบ
      if (prevY >= ry && b.y < ry && v.y < 0 && Math.hypot(b.x - run.hx, b.z - this.HZ) < R - r * 0.35) {
        run.scored = true; run.netT = 0;
        v.x *= 0.2; v.z *= 0.2; v.y = Math.max(v.y, -2.5);
        HSFX.swish(!run.touched);
        haptic('done');
        fx3dWin(run, run.touched ? 'ลงห่วง!' : 'สวิช! ไม่โดนขอบเลย', new run.T.Vector3(run.hx, ry, this.HZ), { clean: !run.touched });
        run.done = true;   // fxWin ตั้งแล้ว — กันพลาดซ้อน
      }
    } else {
      // ในตาข่าย: ดึงเข้ากลางห่วง
      b.x += (run.hx - b.x) * 6 * dt; b.z += (this.HZ - b.z) * 6 * dt;
    }
    if (b.y < r) {
      b.y = r; v.y = -v.y * 0.55; v.x *= 0.8; v.z *= 0.8;
      if (Math.abs(v.y) > 1) FXS.paperLand();
      if (!run.scored && run.desc) this.miss(run);
    }
    if (run.ft > 4 && !run.scored) this.miss(run);
  },
  miss(run) {
    if (run.missing || run.done) return;
    const short = run.apex < this.RIM_Y + 0.05;
    fxMiss(run, run.touched ? 'โดนขอบ! เกือบแล้ว' : run.board ? 'ชนแป้น — เบาลงนิด' : short ? 'แรงไม่ถึง — ดึงยาวอีกนิด' : 'ออกข้าง — ลองเล็งใหม่',
      () => this.reset(run), { delay: 1100 });
    setTimeout(() => { if (fxRun === run) run.fly = false; }, 1000);
  },
  draw2d(run, g) {
    if (run.pull && Math.hypot(run.pull.dx, run.pull.dy) >= 18 && run.pull.dy > 0) {
      const long = run.tries >= 3;
      fx3dDots(run, g, run.ball.position, this.launchV(run, run.pull), 9.8, long ? 34 : 8, long ? 0.035 : 0.04);
    }
    if (!run.fly && !run.done && !run.missing) fx3dChip(run, g, run.ball.position, 30);
  },
};

// ============================================================
// ⚽ ยิงประตู 3D
// ------------------------------------------------------------
// จุดโทษจริง 11 ม. · ประตู 7.32 × 2.44 ม. · ปัดลูกขึ้น (ทิศ = ซ้ายขวา · ความเร็ว = แรง + ความสูง)
// ผู้รักษาประตูเดินไปมา แล้ว "พุ่งตามลูก" หลังเตะ 0.18 วิ ด้วยความเร็วจำกัด — มุมไกลยังเอาชนะได้
// ============================================================
FX3D_GAMES.goal = {
  aria: 'เตะงานที่เสร็จเข้าประตู', hint: 'ปัดลูกขึ้นไปทางประตู · หลบผู้รักษาประตู', easy: 'ผู้รักษาประตูเหนื่อยแล้ว — ช้าลงนะ',
  GZ: -11, GW: 7.32, GH: 2.44, BR: 0.2,
  init(run, T) {
    const S = run.S;
    S.background = new T.Color(0x7FB8EE);
    S.fog = new T.Fog(0x9CCBF2, 30, 80);
    const grass = fx3dTex(T, 256, 256, (g, w, h) => {
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#3E9C4B' : '#47B055'; g.fillRect(0, i * h / 4, w, h / 4); }
      for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(20,70,20,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); }
    }, [10, 14]);
    const field = new T.Mesh(new T.PlaneGeometry(60, 80), fx3dStd(T, 0xffffff, { map: grass, roughness: 0.95 }));
    field.rotation.x = -Math.PI / 2; field.position.z = -15; field.receiveShadow = true; S.add(field);
    // เส้นสนาม
    const lineM = new T.MeshBasicMaterial({ color: 0xffffff });
    const line = (w, d, x, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), lineM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z); S.add(m); };
    const gz = this.GZ;
    line(60, 0.12, 0, gz);
    line(18.32, 0.12, 0, gz + 5.5); line(0.12, 5.5, -9.16, gz + 2.75); line(0.12, 5.5, 9.16, gz + 2.75);
    line(40.3, 0.12, 0, gz + 16.5); line(0.12, 16.5, -20.15, gz + 8.25); line(0.12, 16.5, 20.15, gz + 8.25);
    const spot = new T.Mesh(new T.CircleGeometry(0.15, 20), lineM); spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.011, 0); S.add(spot);
    // อัฒจันทร์
    const crowd = fx3dTex(T, 512, 128, (g, w, h) => {
      g.fillStyle = '#2E3A5C'; g.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 7) for (let x = (y % 14) / 2; x < w; x += 7) {
        g.fillStyle = ['#F2C14E', '#E86A5B', '#FFFFFF', '#6FB3F2', '#9AD48A', '#2E3A5C'][(x * 7 + y * 3) % 6 | 0]; g.fillRect(x, y, 4, 4);
      }
    }, [4, 1]);
    const stand = new T.Mesh(new T.BoxGeometry(70, 9, 2), fx3dStd(T, 0xffffff, { map: crowd, roughness: 1 }));
    stand.position.set(0, 4.5, gz - 9); stand.rotation.x = -0.25; S.add(stand);
    const board = new T.Mesh(new T.BoxGeometry(60, 0.9, 0.2), fx3dStd(T, 0x1E3A8A, { roughness: 0.4 }));
    board.position.set(0, 0.45, gz - 4); S.add(board);
    // ประตู
    const postM = fx3dStd(T, 0xffffff, { roughness: 0.3 });
    const W = this.GW, H = this.GH;
    const post = x => { const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, H, 16), postM); p.position.set(x, H / 2, gz); p.castShadow = true; S.add(p); };
    post(-W / 2); post(W / 2);
    const bar = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, W + 0.12, 16), postM);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, H, gz); bar.castShadow = true; S.add(bar);
    const netTex = fx3dTex(T, 128, 128, (g, w, h) => {
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke(); }
    }, [10, 4]);
    const netM = new T.MeshBasicMaterial({ map: netTex, transparent: true, side: T.DoubleSide, depthWrite: false });
    const back = new T.Mesh(new T.PlaneGeometry(W, H, 24, 8), netM);
    back.position.set(0, H / 2, gz - 1.8); S.add(back);
    const top = new T.Mesh(new T.PlaneGeometry(W, 1.8), netM); top.rotation.x = Math.PI / 2; top.position.set(0, H, gz - 0.9); S.add(top);
    [-1, 1].forEach(sg => { const sd = new T.Mesh(new T.PlaneGeometry(1.8, H), netM); sd.rotation.y = Math.PI / 2; sd.position.set(sg * W / 2, H / 2, gz - 0.9); S.add(sd); });
    run.netBack = back;
    run.netBase = back.geometry.attributes.position.array.slice();
    // ผู้รักษาประตู
    const K = new T.Group();
    const jersey = fx3dStd(T, 0xFF7A1A, { roughness: 0.7 });
    const torso = new T.Mesh(new T.CapsuleGeometry(0.26, 0.55, 6, 12), jersey); torso.position.y = 1.15; torso.castShadow = true;
    const head = new T.Mesh(new T.SphereGeometry(0.15, 20, 16), fx3dStd(T, 0xF1C27D)); head.position.y = 1.75; head.castShadow = true;
    const legM = fx3dStd(T, 0x20242E);
    const lg1 = new T.Mesh(new T.CapsuleGeometry(0.09, 0.6, 4, 8), legM); lg1.position.set(-0.13, 0.4, 0); lg1.castShadow = true;
    const lg2 = lg1.clone(); lg2.position.x = 0.13;
    const armG = new T.CapsuleGeometry(0.07, 0.6, 4, 8);
    const a1 = new T.Mesh(armG, jersey); a1.position.set(-0.5, 1.45, 0); a1.rotation.z = -1.0; a1.castShadow = true;
    const a2 = new T.Mesh(armG, jersey); a2.position.set(0.5, 1.45, 0); a2.rotation.z = 1.0; a2.castShadow = true;
    const gloveM = fx3dStd(T, 0xffffff);
    const g1 = new T.Mesh(new T.SphereGeometry(0.1, 12, 10), gloveM); g1.position.set(-0.78, 1.7, 0);
    const g2 = g1.clone(); g2.position.x = 0.78;
    K.add(torso, head, lg1, lg2, a1, a2, g1, g2);
    K.position.set(0, 0, gz + 0.3);
    S.add(K);
    run.K = K; run.kph = fxRand(0, 6); run.kx = 0;
    // ลูก
    const bt = fx3dTex(T, 512, 256, (g, w, h) => {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1F2430';
      for (let i = 0; i < 12; i++) { const x = (i % 6) * w / 6 + (i < 6 ? 0 : w / 12), y = i < 6 ? h * 0.3 : h * 0.72; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); } g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(w * 0.36, h * 0.43, w * 0.28, h * 0.15);
      g.fillStyle = '#1F2430'; g.font = `700 ${h * 0.1}px ${run.font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(run.label, w / 2, h * 0.505, w * 0.26);
    });
    run.ball = new T.Mesh(new T.SphereGeometry(this.BR, 32, 24), fx3dStd(T, 0xffffff, { map: bt, roughness: 0.5 }));
    run.ball.castShadow = true; S.add(run.ball);
    run.sun.position.set(6, 14, 4); run.sun.target.position.set(0, 0, -6);
    Object.assign(run.sun.shadow.camera, { left: -12, right: 12, top: 14, bottom: -6, far: 50 });
    run.sun.shadow.camera.updateProjectionMatrix();
    this.layout(run); this.reset(run);
  },
  layout(run) { fx3dLook(run, [0, 1.35, 3.2], [0, 1.0, this.GZ]); },
  reset(run) {
    run.ball.position.set(0, this.BR, 0);
    Object.assign(run, { v: new run.T.Vector3(), fly: false, held: false, saved: false, after: false, kTarget: null, ft: 0, scored: false, kdive: 0 });
    run.K.rotation.z = 0; run.K.position.y = 0;
  },
  down(run, p) {
    const s = fx3dToScreen(run, run.ball.position);
    run.held = !run.fly && !run.missing && Math.hypot(p.x - s.x, p.y - s.y) < 90;
  },
  up(run, p, v) {
    if (!run.held || run.fly) return;
    run.held = false;
    if (v.y > -300) { say(run, 'ปัด<b>ขึ้น</b>ไปทางประตู'); return; }
    const s = Math.hypot(v.x, v.y);
    if (s < 500) { say(run, 'เบาไป — ปัดแรงกว่านี้'); return; }
    const vf = fxClamp(14 + (s - 800) / 120, 12, 30);
    const vy = fxClamp((s - 500) / 1900, 0, 1.35) * 8.5;
    run.v.set(vf * (v.x / -v.y) * 0.9, vy, -vf);
    run.fly = true; run.ft = 0;
    FXS.kick(fxClamp((s - 600) / 1500, 0, 1));
    haptic('arm');
  },
  step(run, dt) {
    const K = run.K, reach = this.GW / 2 - 0.6;
    if (run.kTarget == null) {
      run.kph += dt * (run.tries >= 3 ? 1.1 : 1.8);
      run.kx = Math.sin(run.kph) * reach;
    } else if (run.ft > 0.18) {
      // พุ่งตามลูก — ความเร็วจำกัด มุมไกลเอาชนะได้
      const maxV = run.tries >= 3 ? 4 : 6.5;
      const d = run.kTarget - run.kx;
      run.kx += Math.sign(d) * Math.min(Math.abs(d), maxV * dt);
      run.kdive = Math.min(1, run.kdive + dt * 4);
      K.rotation.z = -Math.sign(d || 1) * run.kdive * 0.9 * Math.min(1, Math.abs(run.kTarget) / 2);
    }
    K.position.x = run.kx;
    if (run.netT != null) {
      run.netT += dt;
      const pos = run.netBack.geometry.attributes.position, a = pos.array, base = run.netBase;
      const k = Math.max(0, 1 - run.netT * 1.2);
      for (let i = 0; i < a.length; i += 3) {
        const dx = base[i] - run.netHit.x, dy = base[i + 1] - (run.netHit.y - this.GH / 2);
        a[i + 2] = base[i + 2] - Math.exp(-(dx * dx + dy * dy) / 0.8) * 0.9 * k;
      }
      pos.needsUpdate = true;
    }
    if (!run.fly) return;
    for (let i = 0; i < 3; i++) this.sub(run, dt / 3);
  },
  sub(run, dt) {
    const b = run.ball.position, v = run.v, r = this.BR, gz = this.GZ, W = this.GW, H = this.GH;
    const pz = b.z;
    run.ft += dt;
    if (run.kTarget == null && run.ft > 0) {
      // ทำนายจุดที่ลูกถึงเส้นประตู
      const t = (b.z - gz) / -v.z;
      run.kTarget = fxClamp(b.x + v.x * t, -W / 2 + 0.4, W / 2 - 0.4);
    }
    v.y -= 9.8 * dt;
    if (run.scored) v.multiplyScalar(Math.exp(-6 * dt));
    b.addScaledVector(v, dt);
    run.ball.rotation.x -= dt * 14;
    if (b.y < r) { b.y = r; v.y = Math.abs(v.y) * 0.5; v.x *= 0.9; v.z *= 0.9; }
    if (run.after) return;
    // ผ่านแนวประตู
    if (pz > gz && b.z <= gz) {
      const ax = Math.abs(b.x);
      const postHit = Math.abs(ax - W / 2) < r + 0.06 && b.y < H + r;
      const barHit = Math.abs(b.y - H) < r + 0.06 && ax < W / 2 + r;
      const kHit = Math.abs(b.x - run.kx) < (run.kdive > 0.5 ? 0.95 : 0.6) && b.y < (run.kdive > 0.5 ? 1.9 : 2.0);
      const reset = () => this.reset(run);
      if (postHit || barHit) {
        HSFX.rim(1); v.z = -v.z * 0.5; v.x *= -0.6; run.after = true;
        return fxMiss(run, postHit ? 'ชนเสา! เกือบแล้ว' : 'ชนคาน!', reset, { delay: 1200 });
      }
      if (ax > W / 2) { run.after = true; return fxMiss(run, 'ออกข้าง — เล็งเข้ากรอบ', reset, { delay: 1100 }); }
      if (b.y > H) { run.after = true; return fxMiss(run, 'ข้ามคาน — ปัดเบาลงนิด', reset, { delay: 1100 }); }
      if (kHit) {
        FXS.glove(); v.z = Math.abs(v.z) * 0.35; v.x = (b.x - run.kx) * 6; v.y = 2.5; run.after = true;
        return fxMiss(run, 'โดนเซฟ! เล็งหนีผู้รักษาประตู', reset, { delay: 1200 });
      }
      run.scored = true; run.netT = 0; run.netHit = { x: b.x, y: b.y };
      FXS.cheer();
      const far = Math.abs(b.x - run.kx) > 1.6;
      fx3dWin(run, far ? 'โกลสวย ๆ!' : 'โกล!!', b.clone(), { clean: far });
    }
    if (run.scored && b.z < gz - 1.7) { b.z = gz - 1.7; v.z = 0; }
    if (b.z < gz - 3 || run.ft > 3) {
      if (!run.scored && !run.after) { run.after = true; fxMiss(run, 'ไม่เข้า — ลองใหม่', () => this.reset(run)); }
    }
  },
  draw2d(run, g) { if (!run.fly && !run.done && !run.missing) fx3dChip(run, g, run.ball.position, 26); },
};

// ============================================================
// ⚾ ตีโฮมรัน 3D
// ------------------------------------------------------------
// ยืนที่โฮมเพลต มองไปที่พิทเชอร์ (18.4 ม.) · ลูกพุ่งเข้าหาตาจริง ใหญ่ขึ้นตามระยะ
// แตะตรงไหนก็ได้ = เหวี่ยงไม้ · โดนเมื่อแตะตอนลูกเข้ากรอบสไตรค์
// ============================================================
FX3D_GAMES.bat = {
  aria: 'ตีงานที่เสร็จกระเด็นออกสนาม', hint: 'แตะจอตอนลูกเข้ากรอบ เพื่อเหวี่ยงไม้', easy: 'ลูกช้าลงแล้ว ใจเย็น ๆ',
  PZ: -18.4,
  init(run, T) {
    const S = run.S;
    S.background = new T.Color(0x6DB4F2);
    S.fog = new T.Fog(0xA9D3F7, 60, 160);
    const grass = fx3dTex(T, 256, 256, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3E9A4C' : '#47AA55'; g.fillRect(0, i * h / 8, w, h / 8); }
    }, [16, 16]);
    const field = new T.Mesh(new T.PlaneGeometry(260, 260), fx3dStd(T, 0xffffff, { map: grass, roughness: 1 }));
    field.rotation.x = -Math.PI / 2; field.position.z = -60; field.receiveShadow = true; S.add(field);
    const dirt = fx3dStd(T, 0xC98B5A, { roughness: 1 });
    const inf = new T.Mesh(new T.PlaneGeometry(29, 29), dirt);
    inf.rotation.x = -Math.PI / 2; inf.rotation.z = Math.PI / 4; inf.position.set(0, 0.004, -19.4); inf.receiveShadow = true; S.add(inf);
    const ig = new T.Mesh(new T.PlaneGeometry(22, 22), fx3dStd(T, 0x47AA55, { roughness: 1 }));
    ig.rotation.x = -Math.PI / 2; ig.rotation.z = Math.PI / 4; ig.position.set(0, 0.006, -19.4); ig.receiveShadow = true; S.add(ig);
    const mound = new T.Mesh(new T.CylinderGeometry(2.7, 2.9, 0.25, 32), dirt); mound.position.set(0, 0.12, this.PZ); mound.receiveShadow = true; S.add(mound);
    const baseM = fx3dStd(T, 0xffffff);
    [[0, 0.3], [19.4, -19.4], [0, -38.8], [-19.4, -19.4]].forEach(([x, z], i) => {
      const b = new T.Mesh(i ? new T.BoxGeometry(0.38, 0.06, 0.38) : new T.CylinderGeometry(0.3, 0.3, 0.04, 5), baseM);
      b.position.set(x, 0.03, z); if (i) b.rotation.y = Math.PI / 4; S.add(b);
    });
    // รั้วนอกสนาม + อัฒจันทร์
    const fence = new T.Mesh(new T.CylinderGeometry(110, 110, 4, 64, 1, true, Math.PI * 0.75, Math.PI * 0.5), fx3dStd(T, 0x25603A, { side: T.DoubleSide }));
    fence.position.set(0, 2, 0); S.add(fence);
    const crowd = fx3dTex(T, 1024, 128, (g, w, h) => {
      g.fillStyle = '#2E3A5C'; g.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 7) for (let x = (y % 14) / 2; x < w; x += 7) {
        g.fillStyle = ['#F2C14E', '#E86A5B', '#FFFFFF', '#6FB3F2', '#9AD48A', '#2E3A5C'][(x * 7 + y * 3) % 6 | 0]; g.fillRect(x, y, 4, 4);
      }
    }, [6, 1]);
    const stands = new T.Mesh(new T.CylinderGeometry(135, 118, 26, 64, 1, true, Math.PI * 0.75, Math.PI * 0.5), fx3dStd(T, 0xffffff, { map: crowd, side: T.DoubleSide, roughness: 1 }));
    stands.position.set(0, 15, 0); S.add(stands);
    // พิทเชอร์
    const P = new T.Group();
    const uni = fx3dStd(T, 0xffffff, { roughness: 0.7 });
    const body = new T.Mesh(new T.CapsuleGeometry(0.28, 0.6, 6, 12), uni); body.position.y = 1.15; body.castShadow = true;
    const head = new T.Mesh(new T.SphereGeometry(0.16, 16, 12), fx3dStd(T, 0xF1C27D)); head.position.y = 1.78;
    const cap = new T.Mesh(new T.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), fx3dStd(T, 0x2A64D8)); cap.position.y = 1.8;
    const legs = new T.Mesh(new T.BoxGeometry(0.4, 0.75, 0.22), fx3dStd(T, 0x20242E)); legs.position.y = 0.42; legs.castShadow = true;
    const arm = new T.Group(); arm.position.set(0.3, 1.45, 0);
    const armM = new T.Mesh(new T.CapsuleGeometry(0.07, 0.55, 4, 8), uni); armM.position.y = 0.32; arm.add(armM);
    P.add(body, head, cap, legs, arm);
    P.position.set(0, 0.25, this.PZ); P.rotation.y = Math.PI; S.add(P);
    run.P = P; run.parm = arm;
    // กรอบสไตรค์
    const zone = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(0.5, 0.62)), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    zone.position.set(0, 0.85, 0.2); S.add(zone);
    // ไม้ตี — หมุนรอบมือ (ซ้ายของเพลต) · สองชั้น: หันซ้ายขวา (yaw) แล้วยกขึ้นลง (lift)
    // เงื้อ: ชี้ไปข้างหลัง (ทางคนรับลูก) และยกสูง → กวาดผ่านเพลตระดับเอว (ชี้ไปทางขวา = จังหวะโดน) → ตามแรงไปข้างหน้า
    // (รุ่นแรกหมุนแกนเดียว ไม้ยื่นขวางจอชี้ไปหาพิทเชอร์ตลอดเวลาที่รอ)
    const bat = new T.Group();
    const wood = fx3dStd(T, 0xC8955A, { roughness: 0.45 });
    const barrel = new T.Mesh(new T.CylinderGeometry(0.06, 0.03, 0.9, 16), wood);
    barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.5; barrel.castShadow = true;
    const tape = new T.Mesh(new T.CylinderGeometry(0.031, 0.031, 0.22, 12), fx3dStd(T, 0x20242E));
    tape.rotation.z = Math.PI / 2; tape.position.x = 0.1;
    bat.add(barrel, tape);
    const yaw = new T.Group(); yaw.add(bat);
    yaw.position.set(-0.55, 0.95, 0.55);
    S.add(yaw);
    run.bat = bat; run.batYaw = yaw;
    // ลูก
    const bt = fx3dTex(T, 256, 128, (g, w, h) => {
      g.fillStyle = '#F7F5EF'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#E03A2F'; g.lineWidth = 4;
      for (const off of [0, w / 2]) { g.beginPath(); for (let x = 0; x <= w / 2; x += 4) g.lineTo(off + x, h / 2 + Math.sin(x / (w / 2) * Math.PI * 2) * h * 0.28); g.stroke(); }
    });
    run.ball = new T.Mesh(new T.SphereGeometry(0.1, 24, 16), fx3dStd(T, 0xffffff, { map: bt, roughness: 0.6 }));
    run.ball.castShadow = true; S.add(run.ball);
    run.sun.position.set(-8, 20, 6); run.sun.target.position.set(0, 0, -10);
    Object.assign(run.sun.shadow.camera, { left: -15, right: 15, top: 25, bottom: -5, far: 60 });
    run.sun.shadow.camera.updateProjectionMatrix();
    this.layout(run); this.reset(run);
  },
  layout(run) { fx3dLook(run, [0.15, 1.3, 2.1], [0, 1.0, this.PZ]); },
  reset(run) {
    // เวลาขว้าง = run.PT (ห้ามใช้ run.T — นั่นคือตัว Three.js ทั้งก้อน)
    Object.assign(run, { st: 'wind', wt: 0, p: 0, swung: false, swT: -1, hit: null, early: false,
      PT: fxRand(0.95, 1.15) * (run.tries >= 3 ? 1.35 : 1), ex: fxRand(-0.16, 0.16), ey: fxRand(0.65, 1.05), curve: fxRand(-0.35, 0.35) });
    run.ball.visible = false;
    run.parm.rotation.x = 0;
  },
  ballAt(run, p) {
    const s = new run.T.Vector3(0.25, 1.85, this.PZ + 0.8), e = new run.T.Vector3(run.ex, run.ey, 0.3);
    const q = s.clone().lerp(e, p);
    q.y += Math.sin(Math.PI * Math.min(1, p)) * 0.35;
    q.x += Math.sin(Math.PI * Math.min(1, p)) * run.curve;
    if (p > 1) q.set(e.x, e.y - (p - 1) * 2, e.z + (p - 1) * 18);
    return q;
  },
  down(run) {
    if (run.swung || run.hit || run.missing) return;
    run.swung = true; run.swT = 0;
    FXS.whiff();
    const w0 = run.tries >= 3 ? 0.8 : 0.86, w1 = run.tries >= 3 ? 1.04 : 1.0;
    if (run.st === 'pitch' && run.p >= w0 && run.p <= w1) {
      const q = fxClamp(1 - Math.abs(run.p - 0.93) / 0.09, 0, 1);
      FXS.crack(q); haptic('arm');
      run.st = 'gone';
      const hr = q > 0.3;
      run.hit = { v: new run.T.Vector3(fxRand(-6, 6) + (run.p - 0.93) * 60, 14 + 12 * q, -(28 + 18 * q)), t: 0 };
      if (hr) { FXS.cheer(); setTimeout(() => this.fireworks(run), 700); }
      fx3dWin(run, hr ? 'โฮมรัน!!' : 'ตีโดน! ไปไกลเลย', run.ball.position.clone(), { clean: q > 0.75, hold: 2000 });
    } else run.early = run.st === 'wind' || run.p < w0;
  },
  fireworks(run) {
    if (fxRun !== run) return;
    for (let k = 0; k < 3; k++) {
      const c = new run.T.Vector3(fxRand(-25, 25), fxRand(28, 40), fxRand(-110, -80));
      const col = [0xFFD15A, 0xFF5C8A, 0x5CC8FF][k];
      setTimeout(() => {
        if (fxRun !== run) return;
        for (let i = 0; i < 40; i++) {
          const v = new run.T.Vector3(fxRand(-1, 1), fxRand(-1, 1), fxRand(-1, 1)).normalize().multiplyScalar(fxRand(10, 16));
          fx3dSprite(run, { pos: c, vel: v, g: 4, drag: 1, life: 1.4, size: 1.6, color: col, add: true });
        }
        HSFX.noise('lowpass', 900, 200, 1, 0.12, 0.002, 0.4);
      }, k * 260);
    }
  },
  step(run, dt) {
    // ไม้: เงื้อ → กวาดผ่านกรอบใน 0.14 วิ → ค้าง → กลับ
    const Y0 = -1.65, Y1 = 0.95, L0 = 1.15, L1 = 0.12;
    let k = 0;
    if (run.swT >= 0) {
      run.swT += dt;
      k = run.swT < 0.14 ? run.swT / 0.14 : run.swT < 0.7 ? 1 : 1 - Math.min(1, (run.swT - 0.7) / 0.3);
    }
    const e = k * k * (3 - 2 * k);
    run.batYaw.rotation.y = fxLerp(Y0, Y1, e);
    run.bat.rotation.z = fxLerp(L0, L1, Math.min(1, e * 1.6));
    if (run.st === 'wind') {
      run.wt += dt;
      run.parm.rotation.x = -Math.min(1, run.wt / 0.9) * 2.6;
      if (run.wt > 0.9) { run.st = 'pitch'; run.p = 0; run.ball.visible = true; FXS.pitch(); run.parm.rotation.x = 0.6; }
    } else if (run.st === 'pitch') {
      run.p += dt / run.PT;
      run.ball.position.copy(this.ballAt(run, run.p));
      run.ball.rotation.x += dt * 30;
      if (run.p > 1.12) {
        run.st = 'caught';
        FXS.glove();
        fxMiss(run, !run.swung ? 'สไตรค์! แตะจอตอนลูกเข้ากรอบ' : run.early ? 'เร็วไป — รอให้ลูกถึงกรอบก่อน' : 'ช้าไป — แตะเร็วขึ้นนิด', () => this.reset(run), { delay: 1100 });
      }
    }
    if (run.hit) {
      const h = run.hit;
      h.t += dt; h.v.y -= 9.8 * dt;
      run.ball.position.addScaledVector(h.v, dt);
      if (Math.random() < 0.6) fx3dSprite(run, { pos: run.ball.position, size: 0.25, life: 0.5, color: 0xffffff, alpha: 0.6 });
    }
  },
  draw2d(run, g) {
    if (run.st === 'wind' && run.tries === 0 && !run.done) fx3dChip(run, g, new run.T.Vector3(0, 0.5, 0.2), 10);
  },
};

// ============================================================
// ⛳ พัตต์ลงหลุม 3D
// ------------------------------------------------------------
// กรีนมีความลาดเอียงสุ่ม (ลูกเลี้ยวตามลาด) — บอกทิศลาดด้วยลูกศรบนจอ · พลาดครบ 3 ครั้งเห็นเส้นทางจริง
// ตกหลุมได้เฉพาะตอนลูก "ช้าพอ" · แรงไปลูกกระโดดข้ามหลุม
// ============================================================
FX3D_GAMES.golf = {
  aria: 'พัตต์งานที่เสร็จลงหลุม', hint: 'ดึงลูกถอยหลังแล้วปล่อย · ดูทางลาดด้วย', easy: 'หลุมใหญ่ขึ้น + เห็นเส้นทางจริงแล้ว',
  BR: 0.06, FR: 0.9, MAXP: 120,
  init(run, T) {
    const S = run.S;
    S.background = new T.Color(0x8CC8F2);
    S.fog = new T.Fog(0xBFE0FA, 18, 45);
    const green = fx3dTex(T, 256, 256, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#6DBF5E' : '#78C968'; g.fillRect(0, i * h / 8, w, h / 8); }
      for (let i = 0; i < 2500; i++) { g.fillStyle = 'rgba(30,80,30,.08)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 2); }
    }, [3, 4]);
    const rough = new T.Mesh(new T.PlaneGeometry(80, 80), fx3dStd(T, 0x3E8B3E, { roughness: 1 }));
    rough.rotation.x = -Math.PI / 2; rough.position.y = -0.01; rough.receiveShadow = true; S.add(rough);
    const gm = new T.Mesh(new T.CircleGeometry(6.5, 48), fx3dStd(T, 0xffffff, { map: green, roughness: 0.85 }));
    gm.rotation.x = -Math.PI / 2; gm.scale.set(1, 1.35, 1); gm.position.set(0, 0, -3.2); gm.receiveShadow = true; S.add(gm);
    for (let i = 0; i < 9; i++) {
      const tr = new T.Group();
      const trunk = new T.Mesh(new T.CylinderGeometry(0.15, 0.2, 1.4, 8), fx3dStd(T, 0x6B4A2E)); trunk.position.y = 0.7;
      const top = new T.Mesh(new T.ConeGeometry(1.1, 2.6, 10), fx3dStd(T, 0x2F6B35)); top.position.y = 2.6;
      trunk.castShadow = top.castShadow = true;
      tr.add(trunk, top);
      const a = -Math.PI * 0.15 - i * 0.09 * Math.PI;
      tr.position.set(Math.cos(a) * 14 * (i % 2 ? 1.2 : 1), 0, -6 + Math.sin(a) * 14);
      S.add(tr);
    }
    run.hx = fxRand(-1, 1); run.hz = -5.6;
    run.slope = fxRand(0.08, 0.15) * (Math.random() < 0.5 ? -1 : 1);    // m/s² ทางแกน x
    const cupR = run.tries >= 3 ? 0.17 : 0.13;
    const cup = new T.Mesh(new T.CircleGeometry(cupR, 32), new T.MeshBasicMaterial({ color: 0x0E1A10 }));
    cup.rotation.x = -Math.PI / 2; cup.position.set(run.hx, 0.004, run.hz); S.add(cup);
    const lip = new T.Mesh(new T.RingGeometry(cupR, cupR + 0.02, 32), new T.MeshBasicMaterial({ color: 0xffffff }));
    lip.rotation.x = -Math.PI / 2; lip.position.set(run.hx, 0.005, run.hz); S.add(lip);
    const pole = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1.9, 8), fx3dStd(T, 0xEEEEEE)); pole.position.set(run.hx, 0.95, run.hz); pole.castShadow = true; S.add(pole);
    const flagG = new T.PlaneGeometry(0.5, 0.32, 10, 2);
    flagG.translate(0.25, 0, 0);
    const flag = new T.Mesh(flagG, fx3dStd(T, 0xE03A2F, { side: T.DoubleSide, roughness: 0.8 }));
    flag.position.set(run.hx, 1.72, run.hz); flag.castShadow = true; S.add(flag);
    run.flag = flag; run.flagBase = flagG.attributes.position.array.slice();
    run.cupR = cupR;
    const bt = fx3dTex(T, 128, 64, (g, w, h) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2, 0, 7); g.fill(); } });
    run.ball = new T.Mesh(new T.SphereGeometry(this.BR, 24, 16), fx3dStd(T, 0xffffff, { map: bt, roughness: 0.35 }));
    run.ball.castShadow = true; S.add(run.ball);
    run.sun.position.set(5, 10, 6); run.sun.target.position.set(0, 0, -3);
    this.layout(run); this.reset(run);
  },
  layout(run) {
    const T = run.T;
    fx3dLook(run, [0, 1.45, 2.6], [run.hx * 0.4, 0, -3.4]);
    run.C.updateMatrixWorld();
    const floor = fxFloor(run), sy = Math.min(run.H * 0.82, floor - this.MAXP - 6);
    run.p0 = fx3dRayPlane(run, run.W / 2, sy, new T.Plane(new T.Vector3(0, 1, 0), -this.BR)) || new T.Vector3(0, this.BR, 0.6);
    run.maxP = Math.max(70, Math.min(this.MAXP, floor - sy));
    const D = Math.hypot(run.hx - run.p0.x, run.hz - run.p0.z);
    run.vmax = Math.sqrt(2 * this.FR * 1.7 * D);
    if (run.ball && !run.roll && !run.sunk) run.ball.position.copy(run.p0);
  },
  reset(run) {
    run.ball.position.copy(run.p0); run.ball.scale.setScalar(1);
    Object.assign(run, { v: new run.T.Vector3(), roll: false, sunk: 0, pull: null, near: 1e9, fastNear: false });
  },
  down(run, p) {
    if (run.roll || run.sunk || run.missing) return;
    const s = fx3dToScreen(run, run.ball.position);
    if (Math.hypot(p.x - s.x, p.y - s.y) > 80) return;
    run.pull = { x0: p.x, y0: p.y, dx: 0, dy: 0 };
  },
  move(run, p) {
    if (!run.pull) return;
    let dx = p.x - run.pull.x0, dy = p.y - run.pull.y0;
    const l = Math.hypot(dx, dy);
    if (l > run.maxP) { dx *= run.maxP / l; dy *= run.maxP / l; }
    run.pull.dx = dx; run.pull.dy = dy;
  },
  // ทิศ: ดึงตรง ๆ = เล็งหลุมพอดี · ดึงเบี่ยงซ้ายขวา = เผื่อทางลาด (ละเอียด 0.3°/px)
  // แรง: ช่วงกลาง (55–85%) ถูกบีบเข้าหาแรงที่ไปถึงหลุมด้วยความเร็ว ~1 ม./วิ (ตกได้)
  // รุ่นแรกเป็นเส้นตรงทั้งสองอย่าง — จำลองแล้วลงได้ 5 จาก 1,039 แบบที่ดึงได้ (ขยับ 3px มุมเปลี่ยนเกือบ 2°)
  shotV(run, pl) {
    const T = run.T, l = Math.hypot(pl.dx, pl.dy) || 1, s = l / run.maxP;
    const D = Math.hypot(run.hx - run.p0.x, run.hz - run.p0.z);
    const vI = Math.sqrt(2 * this.FR * D + 1);
    const f = s < 0.55 ? 0.97 - (0.55 - s) * 1.2 : s > 0.85 ? 1.03 + (s - 0.85) * 1.2 : 1 + (s - 0.7) * 0.2;
    const base = Math.atan2(run.hx - run.p0.x, -(run.hz - run.p0.z));
    const a = base + (-pl.dx / run.maxP) * 0.6;
    const sp = vI * f;
    return new T.Vector3(Math.sin(a) * sp, 0, -Math.cos(a) * sp);
  },
  up(run) {
    const pl = run.pull; run.pull = null;
    if (!pl || Math.hypot(pl.dx, pl.dy) < 14 || pl.dy <= 0) return;
    run.v = this.shotV(run, pl); run.roll = true;
    FXS.putt(Math.hypot(pl.dx, pl.dy) / run.maxP);
  },
  cancel(run) { run.pull = null; },
  simStep(run, b, v, dt) {
    const s = Math.hypot(v.x, v.z);
    v.x += run.slope * dt;
    const dec = this.FR * dt;
    if (s <= dec) { v.x = v.z = 0; } else { v.x -= v.x / s * dec; v.z -= v.z / s * dec; }
    b.x += v.x * dt; b.z += v.z * dt;
  },
  step(run, dt) {
    const fl = run.flag.geometry.attributes.position, a = fl.array, base = run.flagBase;
    for (let i = 0; i < a.length; i += 3) a[i + 2] = base[i + 2] + Math.sin(run.t * 6 + base[i] * 12) * 0.04 * (base[i] / 0.5);
    fl.needsUpdate = true;
    if (run.sunk) {
      run.sunk += dt;
      const k = Math.min(1, run.sunk / 0.3), b = run.ball.position;
      b.x += (run.hx - b.x) * 0.3; b.z += (run.hz - b.z) * 0.3; b.y = this.BR - k * 0.2;
      return;
    }
    if (!run.roll) return;
    for (let i = 0; i < 4; i++) this.sub(run, dt / 4);
  },
  sub(run, dt) {
    const b = run.ball.position, v = run.v;
    this.simStep(run, b, v, dt);
    run.ball.rotation.x -= v.z * dt / this.BR; run.ball.rotation.z += v.x * dt / this.BR;
    const d = Math.hypot(b.x - run.hx, b.z - run.hz), sp = Math.hypot(v.x, v.z);
    run.near = Math.min(run.near, d);
    if (d < run.cupR + 0.03) {               // ลูกเกยขอบหลุมเกินครึ่งก็ตก
      const sink = run.tries >= 3 ? 1.9 : 1.5;
      if (sp < sink) {
        run.sunk = 0.001; run.roll = false; FXS.cup();
        fx3dWin(run, run.tries === 0 ? 'ลงหลุมครั้งเดียว!' : 'ลงหลุม!', new run.T.Vector3(run.hx, 0.05, run.hz), { clean: run.tries === 0 });
        return;
      }
      run.fastNear = true; v.x += fxRand(-0.3, 0.3);
    }
    if (sp < 0.02 || Math.abs(b.x) > 7 || b.z < -12 || b.z > 4) {
      run.roll = false;
      const past = b.z < run.hz - 0.1;
      fxMiss(run, run.fastNear ? 'แรงไป — ลูกข้ามหลุม' : past ? 'แรงไปนิด เลยหลุม' : run.near < 0.4 ? 'เกือบแล้ว! อีกนิดเดียว'
        : b.z > run.hz + 0.6 ? 'สั้นไป — ดึงยาวขึ้น' : 'เลี้ยวตามลาด — เล็งเผื่อด้วย', () => this.reset(run));
    }
  },
  draw2d(run, g) {
    // ทิศลาด — ลูกศรมุมบน
    g.save();
    const x = run.W - 64, y = 26, dir = Math.sign(run.slope);
    fxRoundRect(g, x - 44, y - 14, 96, 28, 14); g.fillStyle = 'rgba(15,20,30,.55)'; g.fill();
    g.fillStyle = '#fff'; g.font = `600 12px ${run.font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ลาด ' + (dir > 0 ? '→' : '←'), x + 4, y + 1);
    g.restore();
    if (run.pull && Math.hypot(run.pull.dx, run.pull.dy) >= 14 && run.pull.dy > 0) {
      const v = this.shotV(run, run.pull), b = run.ball.position.clone();
      const k = Math.hypot(run.pull.dx, run.pull.dy) / run.maxP;
      g.save(); g.strokeStyle = k < 0.6 ? '#FFFFFF' : k < 0.85 ? '#FFE07A' : '#FF8A6A'; g.lineWidth = 3; g.setLineDash([7, 6]); g.lineCap = 'round';
      const s0 = fx3dToScreen(run, b);
      g.beginPath(); g.moveTo(s0.x, s0.y);
      if (run.tries >= 3) {
        const q = b.clone(), vv = v.clone();
        for (let i = 0; i < 400; i++) { this.simStep(run, q, vv, 1 / 60); if (i % 6 === 0) { const s = fx3dToScreen(run, q); g.lineTo(s.x, s.y); } if (Math.hypot(vv.x, vv.z) < 0.02) break; }
      } else {
        const e = b.clone().add(v.clone().multiplyScalar(0.45)); const s = fx3dToScreen(run, e); g.lineTo(s.x, s.y);
      }
      g.stroke(); g.restore();
    }
    if (!run.roll && !run.sunk && !run.pull && !run.done && !run.missing) fx3dChip(run, g, run.ball.position, 16);
  },
};

// ============================================================
// 🍉 หั่นผลไม้ 3D
// ------------------------------------------------------------
// ผลไม้ 3D (แตงโม · ส้ม · แอปเปิล) หมุนลอยขึ้นมา ติดสติกเกอร์ชื่องาน · ปาดนิ้วผ่า
// ผ่าแล้วได้สองซีกจริง (ครึ่งทรงกลม + หน้าตัดเนื้อผล) แยกตามทิศที่ปาด · น้ำกระเด็นติดผนัง
// ============================================================
FX3D_GAMES.slice = {
  aria: 'หั่นงานที่เสร็จ', hint: 'ปาดนิ้วผ่าผลไม้ที่ลอยขึ้นมา', easy: 'ผลไม้ลอยช้าลงและใหญ่ขึ้นแล้ว',
  KINDS: [
    { out: 0x2E8B3A, stripe: '#1E5E27', base: '#2E8B3A', flesh: '#F0435A', rind: '#BFE3A0', seed: '#2B2F3A', juice: 0xFF5A70, r: 0.3, sx: 1.15 },
    { out: 0xF7931E, stripe: null, base: '#F7931E', flesh: '#FFB347', rind: '#FFE2B0', seed: null, juice: 0xFFB020, r: 0.22, sx: 1 },
    { out: 0xD9343A, stripe: null, base: '#D9343A', flesh: '#FFF1CF', rind: '#FFF6E0', seed: '#5A3A1E', juice: 0xFFE9A8, r: 0.22, sx: 1 },
  ],
  init(run, T) {
    const S = run.S;
    S.background = new T.Color(0x3A2617);
    const wood = fx3dTex(T, 512, 512, (g, w, h) => {
      for (let i = 0; i < 6; i++) { g.fillStyle = ['#B07A45', '#A56F3C', '#BA8450'][i % 3]; g.fillRect(i * w / 6, 0, w / 6, h); g.fillStyle = 'rgba(60,30,10,.35)'; g.fillRect(i * w / 6, 0, 3, h); }
      g.strokeStyle = 'rgba(60,30,10,.15)';
      for (let i = 0; i < 40; i++) { const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 20, h * 0.3, x - 15, h * 0.6, x + 10, h); g.stroke(); }
    }, [2, 2]);
    const wall = new T.Mesh(new T.PlaneGeometry(12, 9), fx3dStd(T, 0xffffff, { map: wood, roughness: 0.8 }));
    wall.position.set(0, 2.5, -1.6); wall.receiveShadow = true; S.add(wall);
    run.wall = wall;
    run.sun.position.set(2, 5, 6); run.sun.target.position.set(0, 1.2, -1);
    this.layout(run);
    this.reset(run);
  },
  layout(run) { fx3dLook(run, [0, 1.35, 3.4], [0, 1.3, 0]); },
  fruitTex(run, T, k) {
    return fx3dTex(T, 512, 256, (g, w, h) => {
      g.fillStyle = k.base; g.fillRect(0, 0, w, h);
      if (k.stripe) { g.strokeStyle = k.stripe; g.lineWidth = 16; for (let x = 0; x < w; x += 46) { g.beginPath(); for (let y = 0; y <= h; y += 8) g.lineTo(x + Math.sin(y / 20) * 8, y); g.stroke(); } }
      else for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(0,0,0,.07)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1.6, 0, 7); g.fill(); }
      // สติกเกอร์ชื่องาน
      g.fillStyle = 'rgba(255,255,255,.96)'; g.fillRect(w * 0.37, h * 0.4, w * 0.26, h * 0.2);
      g.fillStyle = '#1F2430'; g.font = `700 ${h * 0.09}px ${run.font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(run.label, w / 2, h / 2 + 1, w * 0.24);
    });
  },
  reset(run) {
    const T = run.T;
    if (run.fruit) { run.S.remove(run.fruit); run.fruit.geometry.dispose(); run.fruit.material.map.dispose(); run.fruit.material.dispose(); }
    const easy = run.tries >= 3;
    const k = this.KINDS[Math.floor(Math.random() * this.KINDS.length)];
    const r = k.r * (easy ? 1.25 : 1);
    const m = new T.Mesh(new T.SphereGeometry(r, 36, 24), fx3dStd(T, 0xffffff, { map: this.fruitTex(run, T, k), roughness: 0.45 }));
    m.scale.set(k.sx, 1, 1); m.castShadow = true;
    m.position.set(fxRand(-0.7, 0.7), -0.6, 0.2);
    m.rotation.y = -Math.PI / 2;           // สติกเกอร์หันมาทางกล้องตอนเริ่ม
    run.S.add(m);
    const g = easy ? 6.2 : 9.8;
    run.fruit = m;
    Object.assign(run, { kind: k, fr: r, grav: g, fv: new T.Vector3(-m.position.x * 0.6 + fxRand(-0.2, 0.2), Math.sqrt(2 * g * (2.05 - m.position.y)), 0.15),
      fw: new T.Vector3(fxRand(-1, 1), fxRand(-1.5, 1.5), fxRand(-1, 1)), wait: 0.45, tossed: false, cut: false, trail: [] });
    m.visible = false;
  },
  down(run, p) { run.trail = [{ x: p.x, y: p.y, t: run.t }]; },
  move(run, p, v) {
    const tr = run.trail, prev = tr[tr.length - 1];
    tr.push({ x: p.x, y: p.y, t: run.t });
    const sp = Math.hypot(v.x, v.y);
    if (sp > 900 && (!run.lastBlade || run.t - run.lastBlade > 0.16)) { FXS.blade(); run.lastBlade = run.t; }
    if (!prev || !run.tossed || run.cut || sp < 350) return;
    const c = fx3dToScreen(run, run.fruit.position);
    const edge = fx3dToScreen(run, run.fruit.position.clone().add(new run.T.Vector3(run.fr * run.kind.sx, 0, 0)));
    const R = Math.abs(edge.x - c.x);
    const dx = p.x - prev.x, dy = p.y - prev.y, L2 = dx * dx + dy * dy || 1;
    const t = fxClamp(((c.x - prev.x) * dx + (c.y - prev.y) * dy) / L2, 0, 1);
    const d = Math.hypot(prev.x + dx * t - c.x, prev.y + dy * t - c.y);
    if (d < R) this.cut(run, dx, dy, d / R);
  },
  half(run, T, k, r, flip) {
    const grp = new T.Group();
    const skin = new T.Mesh(new T.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), run.fruit.material.clone());
    skin.material.side = T.DoubleSide;
    const face = fx3dTex(T, 256, 256, (g, w, h) => {
      g.fillStyle = k.rind; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
      g.fillStyle = k.flesh; g.beginPath(); g.arc(w / 2, h / 2, w * 0.43, 0, 7); g.fill();
      if (k.seed) { g.fillStyle = k.seed; for (let i = 0; i < 14; i++) { const a = i / 14 * 7, rr = w * (0.18 + (i % 3) * 0.06); g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr, 5, 9, a, 0, 7); g.fill(); } }
      else { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * w * 0.42, h / 2 + Math.sin(a) * w * 0.42); g.stroke(); } }
    });
    const cap = new T.Mesh(new T.CircleGeometry(r, 32), fx3dStd(T, 0xffffff, { map: face, roughness: 0.3 }));
    cap.rotation.x = Math.PI / 2;
    grp.add(skin, cap);
    if (flip) grp.rotation.x = Math.PI;
    const outer = new T.Group(); outer.add(grp);
    outer.scale.copy(run.fruit.scale);
    return outer;
  },
  cut(run, sdx, sdy, off) {
    const T = run.T;
    run.cut = true;
    const f = run.fruit, k = run.kind;
    // ทิศปาดบนจอ → ระนาบตัดในโลก (ตั้งฉากกับทิศปาด · อยู่ในระนาบหน้ากล้อง)
    const right = new T.Vector3().setFromMatrixColumn(run.C.matrixWorld, 0);
    const up = new T.Vector3().setFromMatrixColumn(run.C.matrixWorld, 1);
    const dir = right.clone().multiplyScalar(sdx).add(up.clone().multiplyScalar(-sdy)).normalize();
    const n = new T.Vector3().crossVectors(dir, new T.Vector3().setFromMatrixColumn(run.C.matrixWorld, 2)).normalize();
    [1, -1].forEach(sg => {
      const h = this.half(run, T, k, run.fr, sg < 0);
      h.position.copy(f.position);
      h.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n.clone().multiplyScalar(sg));
      // บิดให้หน้าตัด (เนื้อผล) หันเข้ากล้อง — ไม่งั้นมันหันข้าง เห็นแต่เปลือกกลวง ๆ
      h.rotateOnWorldAxis(dir, sg * 0.9);
      fx3dBody(run, h, { v: run.fv.clone().multiplyScalar(0.3).add(n.clone().multiplyScalar(sg * 1.8)).add(new T.Vector3(0, 1.2, 0)),
        w: dir.clone().multiplyScalar(sg * 1.2), g: run.grav, floor: -3, life: 1.8 });
    });
    f.visible = false;
    for (let i = 0; i < 40; i++) {
      const v = new T.Vector3(fxRand(-1, 1), fxRand(-0.6, 1.2), fxRand(-0.4, 1)).normalize().multiplyScalar(fxRand(1, 4));
      fx3dSprite(run, { pos: f.position, vel: v, g: 9, size: fxRand(0.04, 0.09), life: fxRand(0.5, 0.9), color: k.juice });
    }
    // คราบน้ำบนผนัง
    for (let i = 0; i < 7; i++) {
      const m = new T.Mesh(new T.CircleGeometry(fxRand(0.06, 0.2), 16), new T.MeshBasicMaterial({ color: k.juice, transparent: true, opacity: 0.4, depthWrite: false }));
      m.position.set(f.position.x + fxRand(-0.6, 0.6), f.position.y + fxRand(-0.4, 0.5), -1.59); run.S.add(m);
    }
    FXS.squish();
    const clean = off < 0.28;
    fx3dWin(run, clean ? 'ผ่ากลางเป๊ะ!' : 'ฉึบ!', f.position.clone(), { clean });
  },
  step(run, dt) {
    const f = run.fruit;
    if (!run.cut && f) {
      if (run.wait > 0) { run.wait -= dt; if (run.wait <= 0) { run.tossed = true; f.visible = true; FXS.toss(); } }
      else {
        run.fv.y -= run.grav * dt;
        f.position.addScaledVector(run.fv, dt);
        f.rotation.x += run.fw.x * dt; f.rotation.y += run.fw.y * dt * 0.4; f.rotation.z += run.fw.z * dt;
        if (run.fv.y < 0 && f.position.y < -0.9 && !run.missing) fxMiss(run, 'หลุดมือ! ปาดให้โดนผล', () => this.reset(run), { delay: 700 });
      }
    }
    run.trail = run.trail.filter(p => run.t - p.t < 0.14);
  },
  draw2d(run, g) {
    if (!run.tossed && !run.done) fxChip(run, g, run.W / 2, run.H * 0.45);
    const tr = run.trail;
    if (tr.length > 1) {
      g.save(); g.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) { const k = i / tr.length; g.strokeStyle = `rgba(255,255,255,${0.95 * k})`; g.lineWidth = 1 + 7 * k; g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke(); }
      g.restore();
    }
  },
};

// ============================================================
// 💣 ปาระเบิดใส่ 3D
// ------------------------------------------------------------
// ทุ่งหญ้า · กองงาน (กล่องกระดาษซ้อน) ห่าง ~9 ม. · ดึงถอยแล้วปล่อยเป็นวิถีโค้ง (มีเส้นจุด)
// ระเบิด = ลูกไฟขยาย + แสงวาบ + ควัน + ประกาย + คลื่นกระแทกบนพื้น + จอสั่น
// ============================================================
FX3D_GAMES.bomb = {
  aria: 'ปาระเบิดใส่งานที่เสร็จ', hint: 'ดึงระเบิดถอยหลังแล้วปล่อย ให้ตกใส่กองงาน', easy: 'ระเบิดลูกใหญ่ขึ้น + เส้นจุดยาวถึงพื้นแล้ว',
  MAXP: 130, G: 9.8,
  init(run, T) {
    const S = run.S;
    S.background = new T.Color(0x86BFF0);
    S.fog = new T.Fog(0xC2E1FA, 25, 70);
    const gt = fx3dTex(T, 256, 256, (g, w, h) => {
      g.fillStyle = '#5FA24F'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(30,80,20,.15)' : 'rgba(160,210,110,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); }
    }, [20, 20]);
    const ground = new T.Mesh(new T.PlaneGeometry(120, 120), fx3dStd(T, 0xffffff, { map: gt, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
    for (let i = 0; i < 6; i++) {
      const hill = new T.Mesh(new T.SphereGeometry(fxRand(6, 11), 24, 12), fx3dStd(T, [0x7FB76A, 0x6FAE5E, 0x8CC478][i % 3], { roughness: 1 }));
      hill.scale.y = 0.35; hill.position.set(fxRand(-35, 35), -1, fxRand(-60, -35)); S.add(hill);
    }
    run.tx = fxRand(-1.6, 1.6); run.tz = -9 + fxRand(-1, 1);
    const pile = new T.Group();
    const paper = fx3dTex(T, 256, 128, (g, w, h) => {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#C9D4E6'; for (let i = 0; i < 5; i++) g.fillRect(20, 30 + i * 18, w - 40, 3);
    });
    const front = fx3dLabel(run, T, run.label, { w: 512, h: 128 });
    for (let i = 0; i < 5; i++) {
      const box = new T.Mesh(new T.BoxGeometry(1.1, 0.22, 0.8), [0, 1, 2, 3, 4, 5].map(f => fx3dStd(T, 0xffffff, { map: f === 4 && i === 4 ? front : paper, roughness: 0.9 })));
      box.position.set(fxRand(-0.05, 0.05), 0.11 + i * 0.22, fxRand(-0.05, 0.05)); box.rotation.y = fxRand(-0.15, 0.15);
      box.castShadow = box.receiveShadow = true; pile.add(box);
    }
    pile.position.set(run.tx, 0, run.tz); S.add(pile);
    run.pile = pile;
    const bomb = new T.Group();
    const shell = new T.Mesh(new T.SphereGeometry(0.22, 28, 20), fx3dStd(T, 0x22262F, { metalness: 0.6, roughness: 0.35 }));
    shell.castShadow = true;
    const neck = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.1, 12), fx3dStd(T, 0x5A6070, { metalness: 0.7, roughness: 0.3 }));
    neck.position.y = 0.23;
    const fuse = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.14, 6), fx3dStd(T, 0xC8955A));
    fuse.position.set(0.03, 0.33, 0); fuse.rotation.z = -0.4;
    bomb.add(shell, neck, fuse);
    S.add(bomb);
    run.bomb = bomb;
    run.flash = new T.PointLight(0xFFB050, 0, 18, 2); S.add(run.flash);
    run.sun.position.set(-6, 12, 6); run.sun.target.position.set(0, 0, -6);
    Object.assign(run.sun.shadow.camera, { left: -10, right: 10, top: 6, bottom: -14, far: 50 });
    run.sun.shadow.camera.updateProjectionMatrix();
    this.layout(run); this.reset(run);
  },
  layout(run) {
    const T = run.T;
    fx3dLook(run, [0, 2.4, 3.6], [run.tx * 0.3, 0.4, -7]);
    run.C.updateMatrixWorld();
    const floor = fxFloor(run), sy = Math.min(run.H * 0.8, floor - this.MAXP - 6);
    run.p0 = fx3dRayPlane(run, run.W / 2, sy, new T.Plane(new T.Vector3(0, 0, 1), -0.6)) || new T.Vector3(0, 1, 0.6);
    run.maxP = Math.max(70, Math.min(this.MAXP, floor - sy));
    const D = Math.hypot(run.tx - run.p0.x, run.tz - run.p0.z);
    run.vI = Math.sqrt(D * this.G);     // 45° ถึงพอดี (ไม่นับความสูงต่าง)
    if (run.bomb && !run.fly) run.bomb.position.copy(run.p0);
  },
  reset(run) {
    run.bomb.position.copy(run.p0); run.bomb.visible = true; run.bomb.rotation.set(0, 0, 0);
    Object.assign(run, { v: new run.T.Vector3(), fly: false, pull: null, boomed: false });
  },
  blastR(run) { return run.tries >= 3 ? 2.6 : 1.7; },
  down(run, p) {
    if (run.fly || run.boomed || run.missing) return;
    const s = fx3dToScreen(run, run.bomb.position);
    if (Math.hypot(p.x - s.x, p.y - s.y) > 85) return;
    run.pull = { x0: p.x, y0: p.y, dx: 0, dy: 0 };
    FXS.hissOn();
  },
  move(run, p) {
    if (!run.pull) return;
    let dx = p.x - run.pull.x0, dy = p.y - run.pull.y0;
    const l = Math.hypot(dx, dy);
    if (l > run.maxP) { dx *= run.maxP / l; dy *= run.maxP / l; }
    run.pull.dx = dx; run.pull.dy = dy;
    HSFX.stretch(dy > 0 ? Math.min(1, l / run.maxP) : 0);
  },
  launchV(run, pl) {
    const s = Math.hypot(pl.dx, pl.dy) / run.maxP;
    const sp = run.vI * (0.55 + 0.75 * s);            // ~60% ของระยะดึงสุด = ถึงพอดี
    const c = Math.SQRT1_2;
    const dirx = (run.tx - run.p0.x) / Math.abs(run.tz - run.p0.z) + (-pl.dx / run.maxP) * 0.9;
    const h = new run.T.Vector3(dirx, 0, -1).normalize();
    return new run.T.Vector3(h.x * sp * c, sp * c, h.z * sp * c);
  },
  up(run) {
    const pl = run.pull; run.pull = null; HSFX.release(); FXS.hissOff();
    if (!pl || Math.hypot(pl.dx, pl.dy) < 16 || pl.dy <= 4) return;
    run.v = this.launchV(run, pl); run.fly = true;
    FXS.throwS(); haptic('arm');
  },
  cancel(run) { run.pull = null; FXS.hissOff(); HSFX.release(); },
  step(run, dt) {
    if (run.flash.intensity > 0) run.flash.intensity = Math.max(0, run.flash.intensity - dt * 120);
    if (run.ring) {
      run.ring.t += dt;
      const k = run.ring.t / 0.6;
      run.ring.m.scale.setScalar(1 + k * 14); run.ring.m.material.opacity = Math.max(0, 0.8 * (1 - k));
      if (k >= 1) { run.S.remove(run.ring.m); run.ring = null; }
    }
    if (run.ball) {
      run.ball.t += dt;
      const k = run.ball.t / 0.55;
      run.ball.m.scale.setScalar(0.3 + k * run.ball.size); run.ball.m.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { run.S.remove(run.ball.m); run.ball = null; }
    }
    // ประกายที่ปลายชนวน
    if (!run.boomed && run.bomb.visible) {
      const tip = new run.T.Vector3(0.06, 0.4, 0).applyMatrix4(run.bomb.matrixWorld);
      if (Math.random() < 0.8) fx3dSprite(run, { pos: tip, vel: new run.T.Vector3(fxRand(-0.4, 0.4), fxRand(0.2, 0.8), fxRand(-0.4, 0.4)), size: 0.05, life: 0.25, color: 0xFFD15A, add: true });
    }
    if (!run.fly) return;
    const b = run.bomb.position, v = run.v;
    v.y -= this.G * dt; b.addScaledVector(v, dt);
    run.bomb.rotation.x -= dt * 5;
    if (Math.random() < 0.6) fx3dSprite(run, { pos: b, size: 0.18, grow: 0.6, life: 0.6, color: 0x9A9AA0, alpha: 0.35 });
    const lp = run.pile.position;
    const direct = Math.abs(b.x - lp.x) < 0.7 && Math.abs(b.z - lp.z) < 0.6 && b.y < 1.25;
    if (direct || b.y < 0.2) this.explode(run, direct);
    else if (Math.abs(b.x) > 14 || b.z < -30) { run.fly = false; run.bomb.visible = false; fxMiss(run, 'ปาเลยไปไกล — ดึงเบาลง', () => this.reset(run)); }
  },
  explode(run, direct) {
    const T = run.T;
    run.fly = false; run.boomed = true; run.bomb.visible = false;
    const c = run.bomb.position.clone(); c.y = Math.max(0.3, c.y);
    const lp = run.pile.position;
    const hit = direct || Math.hypot(c.x - lp.x, c.z - lp.z) < this.blastR(run);
    const big = hit ? 1 : 0.7;
    run.shake = 1.4 * big;
    FXS.boom(hit);
    run.flash.position.copy(c).add(new T.Vector3(0, 1, 0)); run.flash.intensity = 60 * big;
    const fb = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshBasicMaterial({ color: 0xFFB347, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    fb.position.copy(c); run.S.add(fb); run.ball = { m: fb, t: 0, size: 2.2 * big };
    const ring = new T.Mesh(new T.RingGeometry(0.2, 0.32, 40), new T.MeshBasicMaterial({ color: 0xFFF2C0, transparent: true, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, 0.05, c.z); run.S.add(ring); run.ring = { m: ring, t: 0 };
    for (let i = 0; i < 30; i++) {
      const v = new T.Vector3(fxRand(-1, 1), fxRand(0.1, 1.2), fxRand(-1, 1)).normalize().multiplyScalar(fxRand(2, 7) * big);
      fx3dSprite(run, { pos: c, vel: v, drag: 2.5, size: fxRand(0.4, 0.9) * big, grow: 1.5, life: fxRand(0.35, 0.65), color: [0xFFD15A, 0xFF9A2E, 0xFF5A2E][i % 3], add: true });
    }
    for (let i = 0; i < 18; i++) {
      const v = new T.Vector3(fxRand(-1, 1), fxRand(0.6, 1.6), fxRand(-1, 1)).multiplyScalar(fxRand(0.6, 1.6));
      fx3dSprite(run, { pos: c, vel: v, drag: 1, size: fxRand(0.6, 1.1) * big, grow: 1.2, life: fxRand(1.2, 2), color: 0x6E7078, alpha: 0.5 });
    }
    for (let i = 0; i < 24; i++) {
      const v = new T.Vector3(fxRand(-1, 1), fxRand(0.3, 1.3), fxRand(-1, 1)).normalize().multiplyScalar(fxRand(8, 15));
      fx3dSprite(run, { pos: c, vel: v, g: 9, size: 0.08, life: fxRand(0.4, 0.8), color: 0xFFE08A, add: true });
    }
    const dirtM = fx3dStd(T, 0x6E4B2E);
    for (let i = 0; i < 12; i++) {
      const d = new T.Mesh(new T.BoxGeometry(0.1, 0.08, 0.1), dirtM); d.position.copy(c); d.castShadow = true;
      fx3dBody(run, d, { v: new T.Vector3(fxRand(-4, 4), fxRand(4, 8), fxRand(-4, 4)), w: new T.Vector3(fxRand(-9, 9), fxRand(-9, 9), 0), floor: 0.04, life: 2.5 });
    }
    const crater = new T.Mesh(new T.CircleGeometry(0.9 * big, 24), new T.MeshBasicMaterial({ color: 0x2A1E12, transparent: true, opacity: 0.75, depthWrite: false }));
    crater.rotation.x = -Math.PI / 2; crater.position.set(c.x, 0.02, c.z); run.S.add(crater);
    if (hit) {
      run.pile.visible = false;
      const paperM = fx3dStd(T, 0xffffff, { side: T.DoubleSide, roughness: 0.9 });
      for (let i = 0; i < 30; i++) {
        const sh = new T.Mesh(new T.PlaneGeometry(0.26, 0.34), paperM);
        sh.position.set(lp.x + fxRand(-0.4, 0.4), fxRand(0.3, 1.1), lp.z + fxRand(-0.3, 0.3)); sh.castShadow = true;
        fx3dBody(run, sh, { v: new T.Vector3(fxRand(-4, 4), fxRand(6, 11), fxRand(-4, 3)), w: new T.Vector3(fxRand(-8, 8), fxRand(-8, 8), fxRand(-8, 8)), g: 4, drag: 1.1, floor: 0.02, life: 3 });
      }
      fx3dWin(run, direct ? 'ตูม!! ตรงเป้า' : 'ตูม!!', lp.clone().add(new T.Vector3(0, 0.8, 0)), { clean: direct, burstDelay: 200, hold: 2000 });
    } else {
      const far = (c.z < lp.z);
      fxMiss(run, 'พลาดเป้า — ' + (far ? 'เลยไป ดึงเบาลง' : Math.abs(c.x - lp.x) > 1.5 ? 'เบี้ยวไป เล็งใหม่' : 'ไม่ถึง ดึงแรงขึ้น'), () => this.reset(run), { delay: 1400, quiet: true });
      setTimeout(() => { if (fxRun === run && !run.done) HSFX.miss(); }, 350);
    }
  },
  draw2d(run, g) {
    if (run.pull && Math.hypot(run.pull.dx, run.pull.dy) >= 16 && run.pull.dy > 4) {
      const long = run.tries >= 3;
      fx3dDots(run, g, run.bomb.position, this.launchV(run, run.pull), this.G, long ? 40 : 9, long ? 0.05 : 0.06, 'rgba(255,255,255,.95)');
    }
    if (!run.fly && !run.boomed && !run.done && !run.missing) fx3dChip(run, g, run.pile.position.clone().add(new run.T.Vector3(0, 1.3, 0)), -48);
  },
};

// ============================================================
// 🗑️ ขยำงาน 3D
// ------------------------------------------------------------
// แผ่นกระดาษ 3D บนโต๊ะ · ถูนิ้ว = จุดยอดของแผ่นยุบเข้าหาก้อนกลมทีละนิด (แสงเงาตามรอยยับจริง)
// ขยำเสร็จ → ปัดก้อนกระดาษลงถังขยะหลังโต๊ะ (มีตัวช่วยเล็งเหมือนห่วง 3D)
// ============================================================
FX3D_GAMES.crumple = {
  aria: 'ขยำงานที่เสร็จแล้วปาลงถัง', hint: 'ถูนิ้วไปมาบนกระดาษเพื่อขยำ', easy: 'ถังใบใหญ่ขึ้นแล้ว',
  RUB: 1400, BIN_R: 0.26, BIN_H: 0.62,
  init(run, T) {
    const S = run.S;
    S.background = new T.Color(0xE9E2D6);
    const floorT = fx3dTex(T, 256, 256, (g, w, h) => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#D9CFC0' : '#CFC4B3'; g.fillRect(i * w / 4, j * h / 4, w / 4, h / 4); }
    }, [8, 8]);
    const floor = new T.Mesh(new T.PlaneGeometry(30, 30), fx3dStd(T, 0xffffff, { map: floorT, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    const wall = new T.Mesh(new T.PlaneGeometry(30, 10), fx3dStd(T, 0xEFE9DF, { roughness: 1 }));
    wall.position.set(0, 5, -5.5); S.add(wall);
    const woodT = fx3dTex(T, 256, 256, (g, w, h) => { g.fillStyle = '#A8743F'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,30,10,.2)'; for (let i = 0; i < 30; i++) { const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 8, w * 0.6, y - 8, w, y + 4); g.stroke(); } });
    const desk = new T.Mesh(new T.BoxGeometry(2.6, 0.06, 1.3), fx3dStd(T, 0xffffff, { map: woodT, roughness: 0.6 }));
    desk.position.set(0, 0.75, 0.15); desk.receiveShadow = true; desk.castShadow = true; S.add(desk);
    [[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.7], [1.2, 0.7]].forEach(([x, z]) => {
      const lg = new T.Mesh(new T.BoxGeometry(0.06, 0.75, 0.06), fx3dStd(T, 0x6B4A2E)); lg.position.set(x, 0.375, z); S.add(lg);
    });
    // กระดาษ
    const pt = fx3dTex(T, 512, 666, (g, w, h) => {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1F2430'; g.font = `700 40px ${run.font}`; g.textAlign = 'center'; g.fillText(run.label, w / 2, 80, w - 60);
      g.fillStyle = '#C9D4E6'; for (let i = 0; i < 14; i++) g.fillRect(40, 130 + i * 36, (w - 80) * (i === 13 ? 0.5 : 1), 4);
    });
    const geo = new T.PlaneGeometry(0.62, 0.8, 22, 28);
    geo.rotateX(-Math.PI / 2);
    const paper = new T.Mesh(geo, fx3dStd(T, 0xffffff, { map: pt, side: T.DoubleSide, roughness: 0.85, flatShading: true }));
    paper.position.set(0, 0.785, 0.2); paper.castShadow = true; paper.receiveShadow = true; S.add(paper);
    run.paper = paper;
    const pos = geo.attributes.position;
    run.base = pos.array.slice();
    // ปลายทางของจุดยอด: "ห่อ" แผ่นสี่เหลี่ยมรอบทรงกลมแบบต่อเนื่อง (จุดข้างกันไปอยู่ข้างกัน)
    // + รอยพับเป็นคลื่น (ไซน์หลายความถี่ เฟสสุ่มต่อรอบ) — รุ่นแรกสุ่มแยกทีละจุด ได้ก้อนหนามแหลม ไม่ใช่กระดาษขยำ
    run.tgt = []; run.nz = [];
    const ph = Array.from({ length: 6 }, () => fxRand(0, 6.28));
    const wav = (u, v, k) => Math.sin(u * 7 + v * 3 + ph[k]) * 0.5 + Math.sin(u * 13 - v * 9 + ph[k + 1]) * 0.3 + Math.sin(v * 17 + u * 5 + ph[(k + 2) % 6]) * 0.2;
    for (let i = 0; i < pos.count; i++) {
      const u = run.base[i * 3] / 0.31, v = run.base[i * 3 + 2] / 0.4;      // −1…1
      const th = u * Math.PI * 0.95, fi = v * Math.PI * 0.47;
      const rr = 0.13 * (1 + 0.16 * wav(u, v, 0));
      run.tgt.push([Math.cos(fi) * Math.sin(th) * rr, Math.sin(fi) * rr + 0.13, Math.cos(fi) * Math.cos(th) * rr]);
      run.nz.push([wav(u, v, 1), Math.abs(wav(u, v, 2)), wav(u, v, 3)]);
    }
    // ถัง
    run.binX = fxRand(-0.55, 0.55); run.binZ = -2.6;
    const bin = new T.Group();
    const binM = fx3dStd(T, 0x9AA1AE, { metalness: 0.7, roughness: 0.35, side: T.DoubleSide });
    const bw = this.binR(run);
    const body = new T.Mesh(new T.CylinderGeometry(bw, bw * 0.8, this.BIN_H, 32, 1, true), binM); body.position.y = this.BIN_H / 2; body.castShadow = true;
    const bottom = new T.Mesh(new T.CircleGeometry(bw * 0.8, 32), fx3dStd(T, 0x3A3F4A)); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.01;
    const rim = new T.Mesh(new T.TorusGeometry(bw, 0.015, 8, 40), fx3dStd(T, 0xC5CBD5, { metalness: 0.8, roughness: 0.25 })); rim.rotation.x = Math.PI / 2; rim.position.y = this.BIN_H;
    bin.add(body, bottom, rim);
    bin.position.set(run.binX, 0, run.binZ); S.add(bin);
    run.bin = bin; run.bin.visible = false;
    run.sun.position.set(2, 6, 4); run.sun.target.position.set(0, 0.5, -1);
    Object.assign(run, { stage: 'paper', c: 0, rub: 0 });
    this.layout(run);
  },
  binR(run) { return run.tries >= 3 ? this.BIN_R * 1.35 : this.BIN_R; },
  layout(run) {
    const T = run.T;
    fx3dLook(run, [0, 1.75, 1.75], [0, 0.55, -1.3]);
    run.C.updateMatrixWorld();
    run.p0 = new T.Vector3(0, 0.95, 0.55);
  },
  deform(run) {
    const pos = run.paper.geometry.attributes.position, a = pos.array, b = run.base, c = run.c;
    const e = c * c * (3 - 2 * c), w = Math.sin(Math.PI * c) * 0.05;
    for (let i = 0; i < pos.count; i++) {
      const t = run.tgt[i], n = run.nz[i];
      a[i * 3] = fxLerp(b[i * 3], t[0], e) + n[0] * w;
      a[i * 3 + 1] = fxLerp(b[i * 3 + 1], t[1], e) + Math.abs(n[1]) * w * 1.5;
      a[i * 3 + 2] = fxLerp(b[i * 3 + 2], t[2], e) + n[2] * w;
    }
    pos.needsUpdate = true;
    run.paper.geometry.computeVertexNormals();
  },
  down(run, p) {
    run.last = p;
    if (run.stage === 'ball' && !run.fly && !run.missing) {
      const s = fx3dToScreen(run, run.paper.position.clone().add(new run.T.Vector3(0, 0.13, 0)));
      run.held = Math.hypot(p.x - s.x, p.y - s.y) < 90;
    }
  },
  move(run, p) {
    if (run.stage !== 'paper' || !run.last) return;
    const d = Math.hypot(p.x - run.last.x, p.y - run.last.y);
    run.last = p;
    run.rub += d;
    run.c = Math.min(1, run.rub / this.RUB);
    this.deform(run);
    run.paper.rotation.y = Math.sin(run.t * 30) * 0.03 * (1 - run.c);
    run.acc = (run.acc || 0) + d;
    while (run.acc > 16) { run.acc -= 16; FXS.crunch(run.c); }
    if (run.c >= 1) {
      run.stage = 'toBall'; run.tb = 0;
      FXS.balled(); haptic('arm');
      say(run, 'ขยำแล้ว! ปัดลงถังเลย');
      run.hint.textContent = 'ปัดก้อนกระดาษขึ้นไปลงถัง';
      run.hint.classList.remove('off');
      run.bin.visible = true;
      run.from = run.paper.position.clone();
    }
  },
  up(run, p, v) {
    run.last = null;
    if (run.stage !== 'ball' || !run.held || run.fly) return;
    run.held = false;
    if (v.y > -280) { say(run, 'ปัด<b>ขึ้น</b>ไปทางถัง'); return; }
    const T = run.T, s = Math.hypot(v.x, v.y);
    // ตัวช่วยเล็ง (แบบห่วง 3D): ช่วงความเร็วกลางถูกบีบเข้าหาแรงที่ "ลงพอดี"
    const k = s < 1000 ? 0.86 - (1000 - s) / 2500 : s > 1900 ? 1.06 + (s - 1900) / 3000 : 1 + (s - 1450) / 15000;
    const ball = run.paper.position.clone().add(new T.Vector3(0, 0.13, 0));
    const top = new T.Vector3(run.binX, this.BIN_H + 0.05, run.binZ);
    const el = 55 * Math.PI / 180, cs = Math.cos(el), tn = Math.tan(el);
    const dz = ball.z - top.z, dy = top.y - ball.y;
    const vI = Math.sqrt(9.8 * dz * dz / (2 * cs * cs * Math.max(0.2, dz * tn - dy)));
    let ax = fx3dAimX(run, ball, v, run.binZ, top.y);
    const off = ax - run.binX;
    if (Math.abs(off) < 0.4) ax = run.binX + off * 0.4;
    const sp = vI * k, vz = sp * cs, t = dz / vz;
    run.vb = new T.Vector3((ax - ball.x) / t, sp * Math.sin(el), -vz);
    run.fly = true; run.ft = 0; run.desc = false; run.touched = false;
    run.ballPos = ball;
    FXS.throwS();
    run.hint.classList.add('off');
  },
  step(run, dt) {
    if (run.stage === 'toBall') {
      run.tb += dt / 0.45;
      const k = Math.min(1, run.tb);
      run.paper.position.lerpVectors(run.from, run.p0, k);
      if (k >= 1) run.stage = 'ball';
    }
    if (run.wob) { run.wob = Math.max(0, run.wob - dt * 3); run.bin.rotation.z = Math.sin(run.t * 30) * 0.06 * run.wob; }
    if (!run.fly) return;
    for (let i = 0; i < 3; i++) this.sub(run, dt / 3);
  },
  sub(run, dt) {
    const b = run.ballPos, v = run.vb, R = 0.13, bw = this.binR(run), H = this.BIN_H;
    const prevY = b.y;
    run.ft += dt;
    v.y -= 9.8 * dt; b.addScaledVector(v, dt);
    if (v.y < 0) run.desc = true;
    run.paper.position.copy(b).add(new run.T.Vector3(0, -0.13, 0));
    run.paper.rotation.x -= dt * 6;
    const hd = Math.hypot(b.x - run.binX, b.z - run.binZ);
    if (run.inBin) { if (b.y < 0.2) { b.y = 0.2; v.set(0, 0, 0); run.fly = false; } return; }
    // ขอบถัง
    if (Math.abs(b.y - H) < R && Math.abs(hd - bw) < R * 0.9 && v.y < 0 && !run.touched) {
      run.touched = true; FXS.clank(); run.wob = 0.7;
      const ux = (b.x - run.binX) / (hd || 1), uz = (b.z - run.binZ) / (hd || 1);
      if (hd > bw) { v.x = ux * 1.6; v.z = uz * 1.6; v.y = 1.2; }
    }
    if (prevY >= H && b.y < H && hd < bw - R * 0.4) {
      run.inBin = true; v.x *= 0.1; v.z *= 0.1; run.wob = 1; FXS.clank();
      fx3dWin(run, hd < bw * 0.4 ? 'ลงถังกลาง ๆ!' : 'ลงถัง!', new run.T.Vector3(run.binX, H, run.binZ), { clean: hd < bw * 0.4 });
      return;
    }
    if (b.y < R) {
      b.y = R; v.y = -v.y * 0.3; v.x *= 0.6; v.z *= 0.6;
      if (!run.missing && !run.done) {
        FXS.paperLand();
        const short = b.z > run.binZ + bw, long = b.z < run.binZ - bw;
        fxMiss(run, run.touched ? 'โดนขอบถัง! เกือบแล้ว' : short ? 'ไม่ลง — แรงไม่ถึง' : long ? 'ไม่ลง — แรงไป' : 'ไม่ลง — เบี้ยวไป', () => {
          run.fly = false; run.paper.position.copy(run.p0); run.paper.rotation.set(0, 0, 0);
        }, { delay: 1100 });
      }
    }
  },
  draw2d(run, g) {
    if (run.stage === 'paper' && run.c > 0) {
      g.fillStyle = 'rgba(0,0,0,.15)'; fxRoundRect(g, run.W * 0.25, run.H - 26, run.W * 0.5, 6, 3); g.fill();
      g.fillStyle = '#F2661B'; fxRoundRect(g, run.W * 0.25, run.H - 26, run.W * 0.5 * run.c, 6, 3); g.fill();
    }
  },
};

// ============================================================
// 🥂 ปาแก้ว 3D
// ------------------------------------------------------------
// แก้วไวน์ทรงกลึง (มีไวน์ข้างใน) · กำแพงอิฐมีเป้า · ปัดขึ้นแรง ๆ ให้ชนกำแพง
// แตกเป็นเศษแก้ว 3D ร่วงกระทบพื้นแล้วเด้ง (มีเสียงกริ๊งตอนกระทบ) · ไวน์สาด · รอยแตกบนกำแพง
// ============================================================
FX3D_GAMES.glass = {
  aria: 'ปาแก้วใส่กำแพง', hint: 'ปัดแก้วขึ้นไปแรง ๆ ให้ชนกำแพง', easy: 'กำแพงใกล้เข้ามาแล้ว ปาเบา ๆ ก็ถึง',
  WZ: -4.2,
  init(run, T) {
    const S = run.S;
    S.background = new T.Color(0x2B2F38);
    const brick = fx3dTex(T, 512, 512, (g, w, h) => {
      g.fillStyle = '#7A3A2A'; g.fillRect(0, 0, w, h);
      const bh = 32, bw = 96;
      for (let r = 0, y = 0; y < h; r++, y += bh) for (let x = (r % 2) * -bw / 2; x < w; x += bw) {
        g.fillStyle = ['#B5573E', '#A9503A', '#BD6248', '#AE5940'][(r * 3 + Math.round(x / bw)) & 3];
        g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      }
    }, [3, 2]);
    const wall = new T.Mesh(new T.PlaneGeometry(10, 6), fx3dStd(T, 0xffffff, { map: brick, roughness: 0.95 }));
    wall.position.set(0, 3, this.WZ); wall.receiveShadow = true; S.add(wall);
    run.tgx = fxRand(-0.7, 0.7); run.tgy = fxRand(1.8, 2.5);
    [[0.42, 0xffffff], [0.32, 0xE03A2F], [0.22, 0xffffff], [0.12, 0xE03A2F]].forEach(([r, c], i) => {
      const m = new T.Mesh(new T.CircleGeometry(r, 40), fx3dStd(T, c, { roughness: 0.9 }));
      m.position.set(run.tgx, run.tgy, this.WZ + 0.005 + i * 0.002); S.add(m);
    });
    const floor = new T.Mesh(new T.PlaneGeometry(14, 14), fx3dStd(T, 0x6E717A, { roughness: 0.8, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    const stand = new T.Mesh(new T.CylinderGeometry(0.25, 0.3, 0.9, 24), fx3dStd(T, 0x3A3F4A, { roughness: 0.5 }));
    stand.position.set(0, 0.45, 0.6); stand.receiveShadow = true; S.add(stand);
    // แก้วทรงกลึง
    const prof = [[0.001, 0], [0.13, 0.005], [0.13, 0.02], [0.02, 0.03], [0.014, 0.05], [0.014, 0.24], [0.04, 0.27], [0.11, 0.33], [0.135, 0.42], [0.13, 0.5], [0.125, 0.52]]
      .map(([x, y]) => new T.Vector2(x, y));
    const glassM = new T.MeshPhysicalMaterial({ color: 0xDDEEFF, transparent: true, opacity: 0.38, roughness: 0.04, metalness: 0, clearcoat: 1, side: T.DoubleSide, depthWrite: false });
    run.glassM = glassM;
    const gl = new T.Mesh(new T.LatheGeometry(prof, 40), glassM);
    const wine = new T.Mesh(new T.LatheGeometry([[0.001, 0.3], [0.08, 0.32], [0.118, 0.38], [0.126, 0.44]].map(([x, y]) => new T.Vector2(x, y)), 32),
      fx3dStd(T, 0x8E1B3A, { transparent: true, opacity: 0.88, roughness: 0.15 }));
    const top = new T.Mesh(new T.CircleGeometry(0.126, 32), fx3dStd(T, 0xA02848, { transparent: true, opacity: 0.9, roughness: 0.1 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.44;
    const tag = new T.Mesh(new T.PlaneGeometry(0.22, 0.055), new T.MeshBasicMaterial({ map: fx3dLabel(run, T, run.label, { w: 512, h: 128 }), transparent: true }));
    tag.position.set(0, 0.36, 0.14);
    const G = new T.Group(); G.add(gl, wine, top, tag);
    gl.castShadow = true;
    S.add(G);
    run.glass = G;
    run.sun.position.set(3, 7, 5); run.sun.target.position.set(0, 1, -2);
    run.hemi.intensity = 1.3;
    this.layout(run); this.reset(run);
  },
  layout(run) { fx3dLook(run, [0, 1.55, 2.3], [run.tgx * 0.3, 1.6, this.WZ]); },
  reset(run) {
    run.glass.position.set(0, 0.9, 0.6); run.glass.rotation.set(0, 0, 0); run.glass.visible = true;
    Object.assign(run, { fly: null, held: false, broken: false });
  },
  down(run, p) {
    const s = fx3dToScreen(run, run.glass.position.clone().add(new run.T.Vector3(0, 0.25, 0)));
    run.held = !run.fly && !run.broken && !run.missing && Math.hypot(p.x - s.x, p.y - s.y) < 95;
  },
  up(run, p, v) {
    if (!run.held || run.fly) return;
    run.held = false;
    if (v.y > -280) { say(run, 'ปัด<b>ขึ้น</b>ไปทางกำแพง'); return; }
    const T = run.T, s = Math.hypot(v.x, v.y), need = run.tries >= 3 ? 520 : 820;
    const from = run.glass.position.clone();
    const weak = s < need;
    let to;
    if (weak) {
      const d = (s / need) * 3.2;
      to = new T.Vector3(from.x + (v.x / -v.y) * d * 0.8, 0.02, from.z - d);
    } else {
      const y = fxClamp(0.6 + (s - need) / 1500 * 3.6, 0.5, 4.6);
      to = new T.Vector3(fxClamp(fx3dAimX(run, from, v, this.WZ, y), -4.6, 4.6), y, this.WZ + 0.12);
    }
    run.fly = { t: 0, T: weak ? 0.6 : 0.45, from, to, weak, arc: weak ? 0.9 : 0.5 };
    FXS.throwS();
  },
  step(run, dt) {
    if (!run.fly) return;
    const f = run.fly;
    f.t += dt;
    const p = Math.min(1, f.t / f.T);
    run.glass.position.lerpVectors(f.from, f.to, p);
    run.glass.position.y += Math.sin(Math.PI * p) * f.arc;
    run.glass.rotation.x -= dt * (f.weak ? 6 : 14); run.glass.rotation.z += dt * 3;
    if (p >= 1) { run.fly = null; f.weak ? this.drop(run) : this.smash(run, f.to); }
  },
  drop(run) {
    run.glass.rotation.set(Math.PI / 2, 0, fxRand(-1, 1));
    run.glass.position.y = 0.14;
    FXS.clink();
    fxMiss(run, 'เบาไป แก้วไม่แตก — ปาแรงกว่านี้', () => this.reset(run), { delay: 1150 });
  },
  smash(run, at) {
    const T = run.T;
    run.broken = true; run.glass.visible = false; run.shake = 0.5;
    FXS.shatter();
    for (let i = 0; i < 34; i++) {
      const g = new T.BufferGeometry();
      const pts = [];
      for (let k = 0; k < 3; k++) pts.push(fxRand(-0.06, 0.06), fxRand(-0.06, 0.06), fxRand(-0.01, 0.01));
      g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); g.computeVertexNormals();
      const m = new T.Mesh(g, new T.MeshPhysicalMaterial({ color: 0xE6F3FF, transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, side: T.DoubleSide, depthWrite: false }));
      m.position.copy(at);
      const dir = new T.Vector3(fxRand(-1, 1), fxRand(-0.4, 1), fxRand(0.3, 1.4)).normalize();
      fx3dBody(run, m, { v: dir.multiplyScalar(fxRand(1.5, 4.5)), w: new T.Vector3(fxRand(-14, 14), fxRand(-14, 14), fxRand(-14, 14)), floor: 0.01, bounce: 0.35, life: 2.6, op0: 0.6,
        onLand: () => { if (Math.random() < 0.45) FXS.tink(); } });
    }
    for (let i = 0; i < 20; i++) fx3dSprite(run, { pos: at, vel: new T.Vector3(fxRand(-2, 2), fxRand(-1, 2.5), fxRand(0, 2)), g: 7, size: fxRand(0.04, 0.08), life: fxRand(0.5, 0.9), color: 0x9E1C3C });
    for (let i = 0; i < 16; i++) fx3dSprite(run, { pos: at, vel: new T.Vector3(fxRand(-3, 3), fxRand(-3, 3), fxRand(0, 2)), size: 0.06, life: 0.35, color: 0xffffff, add: true });
    const crack = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), new T.MeshBasicMaterial({ map: fx3dTex(T, 256, 256, (g, w) => {
      g.strokeStyle = 'rgba(30,15,8,.75)'; g.lineWidth = 3;
      for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2 + Math.random() * 0.3; g.beginPath(); g.moveTo(w / 2, w / 2); let x = w / 2, y = w / 2; for (let k = 0; k < 4; k++) { x += Math.cos(a + fxRand(-0.4, 0.4)) * w * 0.12; y += Math.sin(a + fxRand(-0.4, 0.4)) * w * 0.12; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = 'rgba(158,28,60,.55)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(w / 2 + fxRand(-40, 40), w / 2 + fxRand(-20, 60), fxRand(6, 18), 0, 7); g.fill(); }
    }), transparent: true, depthWrite: false }));
    crack.position.set(at.x, at.y, this.WZ + 0.02); run.S.add(crack);
    const d = Math.hypot(at.x - run.tgx, at.y - run.tgy);
    fx3dWin(run, d < 0.17 ? 'เป้ากลาง! เพล้ง!!' : d < 0.42 ? 'เข้าเป้า! เพล้ง!' : 'เพล้ง!', at, { clean: d < 0.17, hold: 1900 });
  },
  // ไม่มีป้ายชื่องานบนชั้น 2D — แก้วติดป้ายชื่องานของมันเองอยู่แล้ว (สองป้ายซ้อนกันอ่านเป็นของพัง)
};
