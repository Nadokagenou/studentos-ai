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
// ---------- ภาพหลังเรนเดอร์ (แสงฟุ้ง + เกรดสี) ----------
// เจ้าของ: "ถ้าสวยเหมือน GTA 5 จะโหดจัด ๆ" — ทำแบบ GTA ไม่ได้ (ทีมหลายร้อยคน · ภาพถ่ายจริงเป็นพื้นผิว)
// แต่หยิบเทคนิคหลักที่ทำให้มันดู "ภาพยนตร์" มาได้: แสงฟุ้งรอบของสว่าง (bloom) + เกรดสี + ขอบภาพมืด
// ไฟล์ vendor/pp/* (MIT) แก้ import ให้ชี้ไฟล์ three ตัวเดียวกันในเครื่องแล้ว
// เปิดเฉพาะเครื่องที่แรงพอ — มือถือรุ่นเล็กได้ภาพปกติ ลื่นกว่าสวย · โหลดไม่ได้ = ไม่มีเฉย ๆ ไม่พัง
let FX3D_PP = null;
function fx3dLoadPP() {
  if (FX3D_PP) return Promise.resolve(FX3D_PP);
  const b = './vendor/pp/';
  return Promise.all(['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass', 'ShaderPass'].map(n => import(b + n + '.js')))
    .then(ms => (FX3D_PP = Object.assign({}, ...ms)));
}
// addon อื่นที่ต้องใช้บางเกม (ตัวโหลดโมเดลคน · พื้นจากภาพถ่าย) — โหลดเมื่อเกมนั้นขอเท่านั้น
const FX3D_ADD = {};
function fx3dAddon(name) {
  return FX3D_ADD[name] || (FX3D_ADD[name] = import('./vendor/pp/' + name + '.js'));
}
function fx3dStrong() {
  // โหมดเครื่องเบา (liteProbe ใน app.js วัดแล้วว่าจอธรรมดายังวาดไม่ทัน) = ไม่มีทางไหวกับแสงฟุ้ง · ข้ามการเดาจากสเปก
  if (document.documentElement.dataset.lite) return false;
  const c = navigator.hardwareConcurrency || 4, m = navigator.deviceMemory || 4;
  return c >= 6 && m >= 4;
}
const FX3D_GRADE = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: 1.08 }, uCon: { value: 1.06 }, uTint: { value: [1, 1, 1] } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uSat, uCon; uniform vec3 uTint; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.5) * uCon + 0.5;
      c.rgb *= uTint;
      vec2 d = vUv - 0.5; c.rgb *= 1.0 - uVig * dot(d, d) * 2.2;
      gl_FragColor = c;
    }`,
};
function fx3dPost(run) {
  const T = run.T, PP = FX3D_PP;
  if (!PP || !fx3dStrong()) return;
  const P = run.pal || fxPal();
  const comp = new PP.EffectComposer(run.R);
  comp.addPass(new PP.RenderPass(run.S, run.C));
  // กลางวันแสงฟุ้งเฉพาะจุดที่จ้าจริง (ดวงอาทิตย์ สะท้อนแสง) · กลางคืนฟุ้งรอบไฟสนาม/นีออนชัด
  // ภาพถ่ายจริงสว่างอยู่แล้ว — ฟุ้งแบบกลางคืนจะทำหอประชุมขาวโพลนทั้งจอ
  const glowN = P.night && !run.photo;
  const bloom = new PP.UnrealBloomPass(new T.Vector2(run.W / 2, run.H / 2), glowN ? 0.8 : 0.16, 0.5, glowN ? 0.6 : 0.94);
  comp.addPass(bloom);
  const grade = new PP.ShaderPass(FX3D_GRADE);
  const tint = { sunset: [1.06, 0.98, 0.94], golden: [1.05, 1.0, 0.92], night: [0.94, 0.98, 1.06], nebula: [1.0, 0.96, 1.06],
    neon: [0.95, 1.02, 1.06], twilight: [0.95, 0.99, 1.06], pastel: [1.03, 0.99, 1.03] }[P.mood] || [1, 1, 1];
  grade.uniforms.uTint.value = tint;
  comp.addPass(grade);
  comp.addPass(new PP.OutputPass());
  comp.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  comp.setSize(run.W, run.H);
  run.comp = comp; run.bloom = bloom;
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
  if (!G || !fx3dSupported()) return fx3dFallback(id, title, onClose, preview, G ? 'เครื่องนี้เปิด 3D ไม่ได้ เล่นแบบ 2D' : '');
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
  try { T = await fx3dLoad(); await fx3dLoadPP().catch(() => null); }
  catch (_) {
    if (fxRun === run) { closeFx(true); fx3dFallback(id, title, onClose, preview, 'โหลด 3D ไม่ได้ เล่นแบบ 2D แทน'); }
    return;
  }
  if (fxRun !== run) return;
  run.msg.className = 'hp-msg';
  run.T = T;
  // ผูก cleanup ทันทีที่มี renderer — ไม่ใช่รอจนฉากโหลดเสร็จ
  // เดิมผูกท้ายฟังก์ชัน หลังรอภาพถ่าย/โมเดลได้ถึง 4 วิ · ปิดจอตอน "กำลังโหลดฉาก…" (เน็ตมือถือช้า = บ่อย)
  // closeFx() เลยไม่มีอะไรให้เรียก → WebGL context + เงา + PMREM ค้างอยู่ในการ์ดจอ สะสมทุกครั้งที่เปิดแล้วปิด
  // จนเครื่องค้าง (ทดสอบ 8 ต.ค. 69: หน่วงภาพ 3 วิ ปิดที่ 1.2 วิ → isContextLost() = false)
  run.cleanup = () => fx3dDispose(run);
  try { fx3dSetup(run, T); G.init(run, T); try { fx3dPost(run); } catch (_) { run.comp = null; } }
  catch (e) {
    console.warn('fx3d', e);
    if (fxRun === run) { closeFx(true); fx3dFallback(id, title, onClose, preview, 'เปิด 3D ไม่สำเร็จ เล่นแบบ 2D'); }
    return;
  }
  // ภาพถ่ายพื้นหลัง / โมเดลคน — รอได้ไม่เกิน 4 วิ ช้ากว่านั้นเริ่มเล่นด้วยฉากที่สร้างเองไปก่อน (ภาพมาแทนทีหลังเอง)
  if (G.load) {
    say(run, 'กำลังโหลดฉาก…'); clearTimeout(run.msgT);
    try { await Promise.race([G.load(run, T), new Promise(r => setTimeout(r, 4000))]); } catch (_) {}
    if (fxRun !== run) return;
    run.msg.className = 'hp-msg';
  }
  fxBindPointer(run);
  fx3dLoop(run);
  run.rs =() => { if (fxRun === run) fx3dResize(run); };
  window.addEventListener('resize', run.rs);
}

function fx3dSetup(run, T) {
  const R = new T.WebGLRenderer({ canvas: run.cv, antialias: true, powerPreference: 'low-power' });
  // เครื่องแรง: คมเต็มจอ + เงาละเอียด · เครื่องเล็ก: ลดความคม/เงาลงให้ลื่น (ลื่นสำคัญกว่าสวยในเกมจับจังหวะ)
  const strong = fx3dStrong();
  const lite = !!document.documentElement.dataset.lite;
  R.setPixelRatio(Math.min(strong ? 2 : lite ? 1 : 1.5, window.devicePixelRatio || 1));
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
  sun.shadow.mapSize.set(strong ? 2048 : 1024, strong ? 2048 : 1024);
  sun.shadow.normalBias = 0.02;
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
  if (run.comp) run.comp.setSize(r.width, r.height);
  if (run.G && run.G.layout) run.G.layout(run);
}

// ---------- ลดคุณภาพเองเมื่อเครื่องวาดไม่ทัน ----------
// fx3dStrong() เดาจากจำนวนคอร์กับแรม — มือถือราคาห้าพันส่วนใหญ่มี 8 คอร์ 4GB จึงถูกนับเป็น "เครื่องแรง"
// ได้แสงฟุ้ง (bloom หลายรอบเต็มจอ) + ความคม 2 เท่า ทั้งที่การ์ดจอเป็นรุ่นเล็ก → เฟรมละ 50–100ms เครื่องค้าง
// การเดาจากสเปกแก้ไม่จบ (ชิปเดียวกันแรงไม่เท่ากันตามความร้อน) · วัดเวลาวาดจริงแทน:
// ข้าม 20 เฟรมแรก (คอมไพล์ shader) แล้วดูค่าเฉลี่ยทีละ 40 เฟรม ช้ากว่า ~38fps = ลดหนึ่งขั้น
//   ขั้น 1: ถอดแสงฟุ้ง/เกรดสี + ความคมเหลือ 1.25 · ขั้น 2: ความคม 1 · เกินนั้นไม่ลดต่อ (เงายังอยู่)
// ลดแล้วไม่เพิ่มกลับ — ภาพที่สลับไปมาระหว่างเล่นแย่กว่าภาพที่เรียบตลอด
function fx3dGovern(run, ms) {
  const q = run.q || (run.q = { n: 0, sum: 0, lvl: 0 });
  if (q.lvl >= 2) return;
  // เฟรมที่ห่างเกิน 250ms = แอปถูกพับ/สลับแอป หรือภาพถ่ายเพิ่งโหลดเสร็จกลางเกม (สะดุดครั้งเดียว) ไม่ใช่เครื่องช้า
  if (ms > 250) return;
  if (++q.n <= 20) return;
  q.sum += ms;
  if (q.n < 60) return;
  const avg = q.sum / 40;
  q.n = 20; q.sum = 0;
  if (avg < 26) return;
  q.lvl++;
  const dpr = window.devicePixelRatio || 1;
  if (q.lvl === 1) {
    if (run.comp) { try { run.comp.passes.forEach(p => p.dispose && p.dispose()); run.comp.dispose && run.comp.dispose(); } catch (_) {} }
    run.comp = null; run.bloom = null;
    run.R.setPixelRatio(Math.min(1.25, dpr));
  } else run.R.setPixelRatio(1);
  fx3dResize(run);
}

function fx3dLoop(run) {
  let last = performance.now();
  const tick = now => {
    if (fxRun !== run) return;
    fx3dGovern(run, now - last);
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
    if (run.comp) run.comp.render(); else run.R.render(run.S, C);
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
  if (run.envRT) run.envRT.dispose();
  if (run.comp) { run.comp.passes.forEach(p => p.dispose && p.dispose()); run.comp.dispose && run.comp.dispose(); }
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

// ---------- ท้องฟ้า + แสง + แสงสะท้อนรอบฉาก ตามธีม ----------
// outdoor: โดมฟ้าไล่สี · ดวงอาทิตย์/ดวงจันทร์ · เมฆ (กลางวัน) · ดาว + เนบิวลาสีธีม (กลางคืน)
// indoor:  ห้องสีผนังตามธีม + แผงไฟเพดาน (ใช้ทำแสงสะท้อนอย่างเดียว ไม่วาด)
// ทั้งสองแบบสร้าง environment map (PMREM) — โลหะ แก้ว ลูกบอล มีเงาสะท้อนจริง ไม่ใช่สีเรียบ ๆ
function fx3dEnv(run, T, o = {}) {
  const P = run.pal = fxPal();
  const S = run.S;
  const hor = new T.Color(P.hor), top = new T.Color(P.top);
  run.hemi.color.set(P.hemiS); run.hemi.groundColor.set(P.hemiG); run.hemi.intensity = P.hemiI * (o.indoor ? 0.8 : 1);
  run.sun.color.set(o.indoor ? '#FFF6EA' : P.sun);
  run.sun.intensity = o.indoor ? 1.45 : P.sunI;
  const el = (o.indoor ? 60 : P.elev) * Math.PI / 180, az = (o.az == null ? 35 : o.az) * Math.PI / 180;
  const dir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const tgt = o.target || new T.Vector3(0, 0, -4);
  run.sun.position.copy(tgt).addScaledVector(dir, 20); run.sun.target.position.copy(tgt);
  const skyTex = fx3dTex(T, 8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    // สีฟ้าลงมาถึงมุมเงยต่ำ ๆ (กล้องเกมส่วนใหญ่มองต่ำ เห็นแต่ฟ้าแถบล่าง) — สีขอบฟ้าอยู่แค่แถบบาง ๆ
    const mid = '#' + top.clone().lerp(hor, 0.4).getHexString();
    gr.addColorStop(0, P.top); gr.addColorStop(0.36, mid); gr.addColorStop(0.485, P.hor); gr.addColorStop(0.52, P.hor);
    gr.addColorStop(1, o.indoor ? P.hor : '#' + hor.clone().multiplyScalar(0.55).getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const env = new T.Scene();
  const domeG = new T.SphereGeometry(170, 32, 16);
  if (!o.indoor) {
    const dome = new T.Mesh(domeG, new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10; S.add(dome); fx3dProc(run, dome);
    env.add(new T.Mesh(domeG, new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide })));
    S.background = null;
    S.fog = new T.Fog(P.hor, o.fogNear || 30, o.fogFar || 120);
    // ดวงอาทิตย์ / ดวงจันทร์
    const disc = new T.Sprite(new T.SpriteMaterial({ map: run.dot, color: P.night ? '#E8EEFF' : P.sun, fog: false, depthWrite: false,
      blending: T.AdditiveBlending, transparent: true }));
    disc.position.copy(dir).multiplyScalar(160); disc.scale.setScalar(P.night ? 9 : P.elev < 20 ? 34 : 22); S.add(disc); fx3dProc(run, disc);
    const sunE = disc.clone(); sunE.material = disc.material.clone(); env.add(sunE);
    if (!P.night) {
      const cloudTex = fx3dTex(T, 256, 128, (g, w, h) => {
        for (let i = 0; i < 14; i++) {
          const x = w * (0.15 + Math.random() * 0.7), y = h * (0.45 + Math.random() * 0.25), r = h * (0.18 + Math.random() * 0.22);
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.fillRect(0, 0, w, h);
        }
      });
      // เมฆก้อนเล็กกระจายสูง — รุ่นแรกก้อนใหญ่อยู่ต่ำ ทับกันจนฟ้าทั้งผืนเป็นหมอกขาว (ไม่ใช่ฟ้ากลางวันใส ๆ)
      for (let i = 0; i < 6; i++) {
        const c = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, color: P.mood === 'sunset' ? '#FFD2C2' : '#FFFFFF', fog: false, depthWrite: false, transparent: true, opacity: 0.7 }));
        const a = -Math.PI / 2 + (i - 2.5) * 0.42 + Math.random() * 0.2;
        c.position.set(Math.cos(a) * 155, 38 + Math.random() * 30, Math.sin(a) * 155); c.scale.set(30 + Math.random() * 22, 10 + Math.random() * 6, 1);
        S.add(c); fx3dProc(run, c);
      }
    }
    if (P.stars) {
      const n = 900, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new T.Vector3(Math.random() * 2 - 1, Math.random() * 0.95 + 0.05, Math.random() * 2 - 1).normalize().multiplyScalar(165);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
      S.add(fx3dProc(run, new T.Points(g, new T.PointsMaterial({ color: '#FFFFFF', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: P.stars, depthWrite: false }))));
    }
    if (P.glow) {
      const neb = new T.Sprite(new T.SpriteMaterial({ map: run.dot, color: P.accent, fog: false, depthWrite: false, blending: T.AdditiveBlending, transparent: true, opacity: 0.55 }));
      neb.position.set(40, 40, -150); neb.scale.set(190, 110, 1); S.add(neb); fx3dProc(run, neb);
      const neb2 = neb.clone(); neb2.material = neb.material.clone(); neb2.material.opacity = 0.35; neb2.position.set(-70, 25, -140); neb2.scale.set(140, 90, 1); S.add(neb2); fx3dProc(run, neb2);
    }
  } else {
    // ห้อง: ผนังสีธีมอ่อน ๆ + แผงไฟเพดาน — เอาไว้ทำแสงสะท้อน
    const wall = new T.Color(o.wall || P.accent).lerp(new T.Color('#FFFFFF'), 0.55);
    env.add(new T.Mesh(new T.BoxGeometry(20, 8, 20), new T.MeshBasicMaterial({ color: wall, side: T.BackSide })));
    for (let i = 0; i < 4; i++) {
      const pnl = new T.Mesh(new T.PlaneGeometry(4, 1.2), new T.MeshBasicMaterial({ color: '#FFFFFF' }));
      pnl.position.set((i % 2 ? 4 : -4), 3.9, i < 2 ? -4 : 4); pnl.rotation.x = Math.PI / 2; env.add(pnl);
    }
    S.background = new T.Color(o.bg || P.hor);
  }
  const pm = new T.PMREMGenerator(run.R);
  const rt = pm.fromScene(env, 0.04);
  S.environment = rt.texture;
  S.environmentIntensity = o.indoor ? 0.5 : (P.night ? 0.35 : 0.8);
  run.envRT = rt; pm.dispose();
  // ไฟสนามตอนกลางคืน — จุดไฟสว่างบนเสาไกล ๆ + แสงส่องลงสนาม
  if (P.lights && o.stadium) {
    for (const [x, z] of o.stadium) {
      const sl = new T.SpotLight('#FFF4E0', 380, 90, 0.55, 0.6, 1.6);
      sl.position.set(x, 26, z); sl.target.position.set(o.target ? o.target.x : 0, 0, o.target ? o.target.z : -6);
      S.add(sl, sl.target); fx3dProc(run, sl);
      const bulb = new T.Sprite(new T.SpriteMaterial({ map: run.dot, color: '#FFF8E8', blending: T.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
      bulb.position.set(x, 26, z); bulb.scale.setScalar(5); S.add(bulb); fx3dProc(run, bulb);
    }
    run.hemi.intensity += 0.25;
  }
  // กลางคืนที่ไม่มีไฟสนาม (ทุ่งหญ้า กรีนกอล์ฟ): แสงจันทร์ฟ้าอ่อนจากหลังผู้เล่น + เปิดรับแสงเพิ่ม
  // รุ่นแรกพื้นดำสนิทจนมองไม่เห็นระเบิดกับกองงาน — คืนจริงยังเห็นของ แค่สีหม่นลง
  if (P.night && !o.stadium && !o.indoor) {
    const moon = new T.DirectionalLight('#A9BCFF', 1.6);
    moon.position.set(-4, 10, 12); moon.target.position.copy(tgt); S.add(moon, moon.target);
    run.hemi.intensity = Math.max(run.hemi.intensity, 1.15);
    run.R.toneMappingExposure = 1.2;
  }
  return P;
}

// ลูกฟุตบอล: สีต่อจุดยอด — ดำเมื่ออยู่ในห้าเหลี่ยมรอบจุดยอดไอโคซาฮีดรอน 12 จุด
// (ลายห้าเหลี่ยม/หกเหลี่ยมของลูกบอลจริงคือไอโคซาฮีดรอนตัดมุม) · มีเส้นตะเข็บจาง ๆ รอบห้าเหลี่ยม
function fx3dSoccerGeo(T, r) {
  const g = new T.SphereGeometry(r, 96, 64);
  const f = (1 + Math.sqrt(5)) / 2;
  const V = [[0, 1, f], [0, -1, f], [0, 1, -f], [0, -1, -f], [1, f, 0], [-1, f, 0], [1, -f, 0], [-1, -f, 0], [f, 0, 1], [-f, 0, 1], [f, 0, -1], [-f, 0, -1]]
    .map(a => new T.Vector3(...a).normalize());
  const basis = V.map(v => {
    let n = null, best = -2;
    for (const u of V) { const d = u.dot(v); if (d < 0.999 && d > best) { best = d; n = u; } }
    const e1 = n.clone().addScaledVector(v, -v.dot(n)).normalize();
    return [e1, new T.Vector3().crossVectors(v, e1)];
  });
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), p = new T.Vector3();
  const apo = 0.27, step = Math.PI * 2 / 5;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    let k = 0, best = -2;
    for (let j = 0; j < 12; j++) { const d = V[j].dot(p); if (d > best) { best = d; k = j; } }
    const th = Math.acos(Math.min(1, best));
    const phi = Math.atan2(p.dot(basis[k][1]), p.dot(basis[k][0])) + Math.PI / 5;
    const lim = apo / Math.cos(((phi % step) + step) % step - step / 2);
    let c = th < lim ? 0.06 : 0.95;
    if (Math.abs(th - lim) < 0.018 || Math.abs(th - lim * 1.95) < 0.012) c = Math.min(c, 0.55);   // ตะเข็บ
    col.set([c, c, c * 1.01], i * 3);
  }
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  return g;
}

// ต้นไม้ใบกว้าง: พุ่มหลายก้อนผิวขรุขระ (ดันจุดยอดด้วยคลื่นจากตำแหน่ง → ไม่มีรอยแยก) + สีใบไม่เท่ากัน
// รุ่นแรกเป็นกรวยเหลี่ยม — ดูเป็นเกมยุคเก่า ไม่ใช่สนามกอล์ฟ
function fx3dTree(T, seed = 1) {
  const tr = new T.Group();
  const bark = fx3dStd(T, 0x5B4330, { roughness: 1 });
  const trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.22, 2.2, 10), bark); trunk.position.y = 1.1; trunk.castShadow = true; tr.add(trunk);
  const greens = [0x2F5E2A, 0x3A6D30, 0x2A5325, 0x467A36];
  for (let i = 0; i < 6; i++) {
    const g = new T.SphereGeometry(1, 14, 10), pos = g.attributes.position, v = new T.Vector3();
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      const n = Math.sin(v.x * 5.1 + seed) * Math.cos(v.y * 4.3 + i) * Math.sin(v.z * 6.7 + seed * 2);
      v.multiplyScalar(1 + n * 0.16); pos.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const m = new T.Mesh(g, fx3dStd(T, greens[(i + seed) % 4], { roughness: 0.95 }));
    const a = i / 6 * Math.PI * 2 + seed;
    const rr = i === 0 ? 0 : 0.7;
    m.position.set(Math.cos(a) * rr, 2.6 + (i === 0 ? 0.6 : Math.sin(i * 1.7 + seed) * 0.4), Math.sin(a) * rr);
    m.scale.setScalar(i === 0 ? 1.15 : 0.85 + ((i * 37 + seed * 11) % 10) / 40);
    m.castShadow = true; tr.add(m);
  }
  return tr;
}
// ฝูงคนบนอัฒจันทร์: หัวสีผิว + เสื้อหลากสี (ราว 1/3 ใส่สีทีม = สีธีม) บนเก้าอี้สีเข้ม
function fx3dCrowd(T, P, w = 1024, h = 256) {
  return fx3dTex(T, w, h, (g, W, H) => {
    g.fillStyle = '#20252F'; g.fillRect(0, 0, W, H);
    const skins = ['#F1C9A5', '#E0AC83', '#C68B5F', '#A0694A', '#7A4E36', '#F5D9C0'];
    const shirts = ['#F4F4F4', '#1E2430', '#D23A3A', '#2E62C9', '#E8C14A', '#3F8F4E', '#8A8F9C', P.accent, P.accent, P.accent];
    for (let y = 8, r = 0; y < H; y += 11, r++) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + 6, W, 2);
      for (let x = (r % 2) * 4; x < W; x += 8 + ((x * 7 + r) % 3)) {
        if (((x * 13 + r * 7) % 17) === 0) continue;             // ที่นั่งว่าง
        g.fillStyle = shirts[(x * 3 + r * 5 + (x >> 4)) % shirts.length];
        g.fillRect(x - 3, y + 1, 7, 6);
        g.fillStyle = skins[(x + r * 3) % skins.length];
        g.beginPath(); g.arc(x + 0.5, y - 1, 2.6, 0, 7); g.fill();
      }
    }
  });
}

// ---------- พื้นหลังภาพถ่ายจริง (Poly Haven · CC0) ----------
// เจ้าของ: "พื้นหลังบางอันแปลก ๆ … ลองไปหาดูใน google เยอะ ๆ" — ฉากที่วาดเองด้วยโค้ด (ผนังเรียบ เนินเขาปลอม
// อัฒจันทร์ลายตาราง) ขัดตาเมื่ออยู่ข้างวัตถุสมจริง · ภาพพาโนรามา 360° ของสถานที่จริงแก้ได้ทั้งฉากหลังและแสง
// ภาพย่อเหลือ 2048×1024 (~0.3–0.75MB) อยู่ใน vendor/hdri · โหลดเฉพาะภาพของเกมที่เปิด
// ธีม → ช่วงเวลา: เลือกภาพกลางวัน / เย็น / กลางคืน ตามบรรยากาศ · ไม่มีภาพของช่วงไหน = ใช้ฉากที่สร้างเองแบบเดิม
// ground: ฉายพื้นของภาพลงเป็นพื้นจริง (GroundedSkybox) ใช้กับห้อง — โต๊ะ/เสาตั้งบนพื้นของภาพได้ ไม่ลอย
function fx3dPhotoName(run, photos) {
  const m = run.pal.mood;
  const b = (m === 'night' || m === 'nebula' || m === 'neon' || m === 'twilight') ? 'night'
    : (m === 'sunset' || m === 'golden') ? 'sunset' : 'day';
  return photos[b] || null;
}
function fx3dPhoto(run, T, photos, o = {}) {
  const name = fx3dPhotoName(run, photos);
  if (!name) return Promise.resolve(false);
  const ldr = new T.TextureLoader();
  const wait = new Promise(res => ldr.load('./vendor/hdri/' + name + '.jpg', res, undefined, () => res(null)));
  const ground = o.ground ? fx3dAddon('GroundedSkybox').catch(() => null) : Promise.resolve(null);
  return Promise.all([wait, ground]).then(([tex, GS]) => {
    if (!tex || fxRun !== run) return false;
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.colorSpace = T.SRGBColorSpace;
    const S = run.S;
    const pm = new T.PMREMGenerator(run.R);
    const rt = pm.fromEquirectangular(tex);
    pm.dispose();
    if (run.envRT) run.envRT.dispose();
    run.envRT = rt;
    S.environment = rt.texture;
    S.environmentIntensity = o.envI || 1;
    const rotY = (typeof o.rot === 'object' ? (o.rot[name] || 0) : (o.rot || 0)) * Math.PI / 180;   // หมุนแยกต่อภาพได้
    if (o.ground && GS) {
      const sky = new GS.GroundedSkybox(tex, o.height || 1.6, o.radius || 14);
      sky.position.y = (o.height || 1.6) - 0.004;
      sky.rotation.y = rotY;
      S.add(sky); run.skyMesh = sky;
      // ห้องกลางคืน: ใช้ห้องเดิมแต่หรี่ไฟ (ภาพห้องกลางคืนที่มีอยู่เป็นมุมแคบ ผนังลายหินชิดหน้า ดูไม่ออกว่าเป็นห้อง)
      if (o.nightTint && run.pal.night) { sky.material.color.set(o.nightTint); S.environmentIntensity *= 0.7; }
      S.background = null;
    } else {
      S.background = tex;
      S.backgroundRotation.set(0, rotY, 0);
      S.backgroundIntensity = o.bgI || 1;
    }
    S.environmentRotation.set(0, rotY, 0);
    S.fog = o.fog ? new T.Fog(o.fog, 30, 160) : null;
    run.hemi.intensity *= 0.45;                 // แสงรอบตัวมาจากภาพถ่ายแล้ว
    (run.proc || []).forEach(m => { m.visible = false; });
    run.photo = name;
    if (run.bloom) { run.bloom.strength = 0.16; run.bloom.threshold = 0.94; }
    return true;
  });
}
// ---------- ผู้รักษาประตูเป็นหุ่นคนสัดส่วนจริง ----------
// Quaternius Universal Animation Library (CC0) — ตัดเหลือ 6 ท่า (vendor/models/keeper.glb · 1.5MB)
// เจ้าของ: "พวกที่มันมีคนอยู่ … แปลก" — หุ่นแคปซูลต่อกันอ่านเป็นตุ๊กตา · หุ่นนี้มีกระดูกและท่าทางจริง
// โหลดไม่ได้ = ใช้หุ่นแคปซูลเดิมต่อ (ไม่ทำให้เกมพัง)
function fx3dKeeper(run, T) {
  return fx3dAddon('GLTFLoader')
    .then(M => new Promise(res => new M.GLTFLoader().load('./vendor/models/keeper.glb', res, undefined, () => res(null))))
    .then(g => {
      if (!g || fxRun !== run) return false;
      const model = g.scene;
      model.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(model);
      model.scale.setScalar(1.88 / (box.max.y - box.min.y));          // ผู้รักษาประตูสูง ~1.88 ม.
      model.updateMatrixWorld(true);
      model.position.y -= new T.Box3().setFromObject(model).min.y;
      // ชุดผู้รักษาประตูสีเขียวสะท้อนแสง (กติกา: ต้องต่างจากทุกคนในสนาม) · ข้อต่อสีดำเหมือนถุงมือ/สนับ
      const kit = fx3dStd(T, 0xB8E83A, { roughness: 0.72 }), dark = fx3dStd(T, 0x1A1F2B, { roughness: 0.55 });
      model.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.frustumCulled = false;
        o.material = /joint/i.test(o.material.name || '') ? dark : kit;
      });
      run.K.children.slice().forEach(c => run.K.remove(c));
      run.K.add(model);
      run.mixer = new T.AnimationMixer(model);
      run.acts = {};
      g.animations.forEach(a => { run.acts[a.name] = run.mixer.clipAction(a); });
      fx3dKeeperPose(run, 'Crouch_Idle_Loop');
      return true;
    }).catch(() => false);
}
function fx3dKeeperPose(run, name, once) {
  const a = run.acts && run.acts[name];
  if (!a || run.kPose === name) return;
  const prev = run.kPose && run.acts[run.kPose];
  a.reset(); a.setLoop(once ? run.T.LoopOnce : run.T.LoopRepeat); a.clampWhenFinished = !!once;
  a.play();
  if (prev) prev.crossFadeTo(a, 0.18, false);
  run.kPose = name;
}

// ขอบพื้นจาง: พื้นที่สร้างเอง (ลานเล่น) ค่อย ๆ หายเข้าไปในพื้นของภาพถ่าย — ไม่ตัดเป็นเส้นแข็ง
// (รุ่นแรกหญ้าที่วาดชนภาพเป็นเส้นตรง ดูออกทันทีว่าเป็นของสองอย่างแปะกัน)
function fx3dFade(T, inner = 0.18, outer = 0.45) {
  const t = fx3dTex(T, 256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, w * inner, w / 2, h / 2, w * outer);
    gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#000000');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  t.colorSpace = T.NoColorSpace;
  return t;
}

// ของที่สร้างเองซึ่งภาพถ่ายมาแทน (ฟ้า เมฆ อัฒจันทร์ ต้นไม้ เนิน ผนัง) — ซ่อนเมื่อโหลดภาพสำเร็จ
function fx3dProc(run, ...objs) { (run.proc || (run.proc = [])).push(...objs); return objs[0]; }

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
  aria: 'โยนงานที่เสร็จลงห่วง', hint: 'ดึงลงแล้วปล่อย เพื่อโยนลงห่วง', easy: 'ใบ้ให้แล้ว ดูเส้นจุดตอนดึง',
  // หอประชุมโรงเรียนพื้นไม้ (ภาพจริง) — ทุกช่วงเวลา (ในร่มเปิดไฟ) · สีธีมอยู่ที่สีในสนามกับเบาะเสา
  load(run, T) { return fx3dPhoto(run, T, { day: 'school_hall', sunset: 'school_hall', night: 'school_hall' }, { ground: true, height: 1.7, radius: 18, rot: 180, envI: 0.9 }); },
  RIM_Y: 3.05, RIM_R: 0.23, BALL_R: 0.12, HZ: -4.6, MAXP: 140,
  init(run, T) {
    const S = run.S;
    run.hx = fxRand(-0.55, 0.55);
    const hz = this.HZ, ry = this.RIM_Y, hx = run.hx;
    const P = fx3dEnv(run, T, { indoor: true, target: new T.Vector3(hx, 0, hz + 2) });
    // ---------- ยิม ----------
    // พื้นไม้เมเปิล: ไม้หน้ากว้าง ~5.7 ซม. ต่อแผ่นยาวสลับ · เคลือบเงา (roughness ต่ำ สะท้อนไฟเพดาน)
    // รุ่นแรกแผ่นละ ~60 ซม. — ดูเป็นพื้นห้องนั่งเล่น ไม่ใช่สนามบาส
    const wood = fx3dTex(T, 1024, 1024, (g, w, h) => {
      const n = 32, ph = h / n;
      for (let i = 0; i < n; i++) {
        let x = -((i * 211) % 300);
        while (x < w) {
          const L = 260 + ((i * 97 + x) % 220);
          const k = (i * 13 + Math.floor(x / 7)) % 5;
          g.fillStyle = ['#D9A86C', '#D2A064', '#DDAE74', '#CF9C5E', '#D6A56A'][k];
          g.fillRect(x, i * ph, L, ph);
          g.fillStyle = 'rgba(90,50,15,.06)';
          for (let q = 0; q < 6; q++) g.fillRect(x, i * ph + q * ph / 6 + (q * 7 % 3), L, 1);
          g.fillStyle = 'rgba(70,35,8,.35)'; g.fillRect(x, i * ph, 2, ph);
          x += L;
        }
        g.fillStyle = 'rgba(70,35,8,.3)'; g.fillRect(0, i * ph, w, 1.5);
      }
    }, [16, 16]);
    wood.rotation = Math.PI / 2;
    const floor = new T.Mesh(new T.PlaneGeometry(30, 30), fx3dStd(T, 0xffffff, { map: wood, roughness: 0.32, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    // เขตสามวินาที (4.9 × 5.8 ม.) ทาสีทีม = สีธีม — สนามจริงก็ทาสีทีมตรงนี้
    const key = new T.Mesh(new T.PlaneGeometry(4.9, 5.8), fx3dStd(T, P.accent, { roughness: 0.38 }));
    key.rotation.x = -Math.PI / 2; key.position.set(0, 0.003, hz + 2.9 - 1.2); key.receiveShadow = true; S.add(key);
    const lineM = new T.MeshBasicMaterial({ color: '#FFFFFF' });
    const ln = (w, d, x, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), lineM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.005, z); S.add(m); };
    ln(4.9, 0.05, 0, hz - 1.2 + 5.8); ln(0.05, 5.8, -2.45, hz + 1.7); ln(0.05, 5.8, 2.45, hz + 1.7); ln(30, 0.05, 0, hz - 1.2);
    const ftc = new T.Mesh(new T.RingGeometry(1.775, 1.825, 64, 1, 0, Math.PI), lineM);
    ftc.rotation.x = -Math.PI / 2; ftc.position.set(0, 0.005, hz - 1.2 + 5.8); S.add(ftc);
    // ผนังทาสีทีม + แถบป้าย + ไฟเพดาน
    // ผนังยิม: ธีมกลางวัน = สีทีมอ่อน (ยิมเปิดไฟสว่าง) · ธีมกลางคืน = สีทีมเข้ม (อารีน่าปิดไฟอัฒจันทร์)
    const wallC = P.night ? new T.Color(P.deep).lerp(new T.Color('#141A28'), 0.6) : new T.Color(P.accent).lerp(new T.Color('#E4E7EC'), 0.6);
    const wall = new T.Mesh(new T.PlaneGeometry(30, 12), fx3dStd(T, wallC, { roughness: 0.9 }));
    wall.position.set(0, 6, -7.5); S.add(wall); fx3dProc(run, wall);
    const banner = fx3dTex(T, 1024, 96, (g, w, h) => {
      g.fillStyle = P.accent; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.92)'; g.font = `800 ${h * 0.5}px ${run.font}`; g.textBaseline = 'middle';
      for (let x = 20; x < w; x += 360) g.fillText('STUDENT OS', x, h / 2);
    });
    const bn = new T.Mesh(new T.BoxGeometry(30, 0.55, 0.12), fx3dStd(T, 0xffffff, { map: banner, roughness: 0.6 }));
    bn.position.set(0, 0.28, -7.2); S.add(bn); fx3dProc(run, bn);   // ป้ายข้างสนาม — ซ่อนเมื่อใช้ภาพหอประชุมจริง (ลอยกลางห้อง)
    for (let i = 0; i < 6; i++) {
      const lamp = new T.Mesh(new T.BoxGeometry(1.6, 0.06, 0.5), new T.MeshBasicMaterial({ color: '#FFF8EC' }));
      lamp.position.set((i % 3 - 1) * 4.5, 9, -5 + Math.floor(i / 3) * 5); S.add(lamp); fx3dProc(run, lamp);
    }
    // ---------- แป้น ห่วง ตาข่าย (ขนาดจริงตามกติกา FIBA) ----------
    const steel = fx3dStd(T, 0x2C323D, { metalness: 0.85, roughness: 0.35 });
    const pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.1, 3.6, 24), steel);
    pole.position.set(hx, 1.8, hz - 1.6); pole.castShadow = true; S.add(pole);
    const pad = new T.Mesh(new T.BoxGeometry(0.34, 1.8, 0.34), fx3dStd(T, P.accent, { roughness: 0.8 }));
    pad.position.set(hx, 0.9, hz - 1.6); pad.castShadow = true; S.add(pad);
    const arm = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 1.2), steel);
    arm.position.set(hx, 3.4, hz - 1.0); S.add(arm);
    run.boardZ = hz - 0.38;
    // แป้นกระจกใส (แป้นแข่งจริง) + เส้นขาว: กรอบนอก + สี่เหลี่ยมใน 59 × 45 ซม.
    const boardLines = fx3dTex(T, 512, 300, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#FFFFFF'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
      const iw = w * 0.59 / 1.8, ih = h * 0.45 / 1.05;
      g.lineWidth = 12; g.strokeRect(w / 2 - iw / 2, h - h * 0.15 / 1.05 - ih, iw, ih);
    });
    const glass = new T.MeshPhysicalMaterial({ color: 0xDDEAF5, transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0, clearcoat: 1, depthWrite: false });
    const board = new T.Mesh(new T.BoxGeometry(1.8, 1.05, 0.03), glass);
    board.position.set(hx, ry + 0.45, run.boardZ - 0.015); S.add(board);
    const bl = new T.Mesh(new T.PlaneGeometry(1.8, 1.05), fx3dStd(T, 0xffffff, { map: boardLines, transparent: true, depthWrite: false, roughness: 0.4 }));   // สีทา ไม่ใช่ไฟ
    bl.position.set(hx, ry + 0.45, run.boardZ + 0.001); S.add(bl);
    const frame = new T.Mesh(new T.BoxGeometry(1.84, 0.05, 0.06), steel); frame.position.set(hx, ry + 0.45 - 0.545, run.boardZ - 0.02); S.add(frame);
    const rimM = fx3dStd(T, 0xE8531A, { metalness: 0.55, roughness: 0.32 });
    const rim = new T.Mesh(new T.TorusGeometry(this.RIM_R, 0.01, 12, 64), rimM);
    rim.rotation.x = Math.PI / 2; rim.position.set(hx, ry, hz); rim.castShadow = true; S.add(rim);
    const brk = new T.Mesh(new T.BoxGeometry(0.16, 0.04, 0.16), rimM); brk.position.set(hx, ry - 0.01, run.boardZ + 0.07); S.add(brk);
    // ตาข่ายถักลายข้าวหลามตัด 12 ห่วง (เส้นจริง ไม่ใช่ทรงกระบอกโปร่ง)
    const net = new T.Group();
    const pts = [], N = 12, rows = 4, H = 0.42;
    const ring = (row, k) => { const t = row / rows, r = fxLerp(this.RIM_R, this.RIM_R * 0.58, t), a = (k + (row % 2) * 0.5) / N * Math.PI * 2; return new T.Vector3(Math.cos(a) * r, -t * H, Math.sin(a) * r); };
    for (let row = 0; row < rows; row++) for (let k = 0; k < N; k++) {
      const a = ring(row, k), b1 = ring(row + 1, k), b2 = ring(row + 1, (k + (row % 2 ? 1 : N - 1)) % N);
      pts.push(a, b1, a, b2);
    }
    const netG = new T.BufferGeometry().setFromPoints(pts);
    net.add(new T.LineSegments(netG, new T.LineBasicMaterial({ color: '#F4F4F4' })));
    net.position.set(hx, ry, hz); S.add(net);
    Object.assign(run, { rim, net });
    // ลูกบาส: ส้มอิฐ ผิวเม็ด (bump) + ร่อง 8 ช่อง + ป้ายชื่องาน
    const bt = fx3dTex(T, 1024, 512, (g, w, h) => {
      g.fillStyle = '#C8642A'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(90,35,8,.22)' : 'rgba(255,170,110,.12)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1.6, 0, 7); g.fill(); }
      g.strokeStyle = '#1C0E06'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      [w * 0.25, w * 0.75].forEach(x => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); });
      [0, w / 2, w].forEach(x => { g.beginPath(); g.ellipse(x, h / 2, w * 0.12, h * 0.5, 0, 0, Math.PI * 2); g.stroke(); });
      g.fillStyle = 'rgba(20,10,4,.85)'; g.font = `800 ${h * 0.07}px ${run.font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(run.label, w * 0.62, h * 0.38, w * 0.2);
    });
    const bump = fx3dTex(T, 512, 256, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12000; i++) { g.fillStyle = '#B0B0B0'; g.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4); } });
    const ball = new T.Mesh(new T.SphereGeometry(this.BALL_R, 48, 32), fx3dStd(T, 0xffffff, { map: bt, bumpMap: bump, bumpScale: 0.6, roughness: 0.62 }));
    ball.castShadow = true; S.add(ball);
    run.ball = ball;
    Object.assign(run.sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); run.sun.shadow.camera.updateProjectionMatrix();
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
    fxMiss(run, run.touched ? 'โดนขอบ! เกือบแล้ว' : run.board ? 'ชนแป้น เบาลงนิด' : short ? 'แรงไม่ถึง ดึงยาวอีกนิด' : 'ออกข้าง ลองเล็งใหม่',
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
  aria: 'เตะงานที่เสร็จเข้าประตู', hint: 'ปัดลูกขึ้นไปทางประตู · หลบผู้รักษาประตู', easy: 'ผู้รักษาประตูเหนื่อยแล้ว ช้าลงนะ',
  // สนามฟุตบอลจริง (ภาพถ่าย) ตอนกลางวัน · เย็น/กลางคืนใช้สนามที่สร้างเอง (ไม่มีภาพสนามตอนกลางคืนที่เป็น CC0)
  // + ผู้รักษาประตูเป็นหุ่นคนสัดส่วนจริงมีท่าทาง (Quaternius · CC0) แทนหุ่นแคปซูล
  load(run, T) { return Promise.all([fx3dPhoto(run, T, { day: 'stadium_01' }, { rot: 90, envI: 0.9 }), fx3dKeeper(run, T)]); },
  GZ: -11, GW: 7.32, GH: 2.44, BR: 0.11,
  init(run, T) {
    const S = run.S;
    const gz = this.GZ;
    const P = fx3dEnv(run, T, { target: new T.Vector3(0, 0, -6), stadium: [[-28, -30], [28, -30], [-30, 8], [30, 8]], fogNear: 40, fogFar: 150 });
    // หญ้า: แถบตัดหญ้ากว้าง ~5.5 ม. ขนานเส้นประตู (แบบที่เห็นในถ่ายทอดสด) + ใบหญ้าละเอียด
    const grass = fx3dTex(T, 512, 512, (g, w, h) => {
      for (let i = 0; i < 2; i++) { g.fillStyle = i ? '#3D8B3F' : '#479A47'; g.fillRect(0, i * h / 2, w, h / 2); }
      for (let i = 0; i < 26000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(20,60,15,.16)' : 'rgba(150,200,110,.10)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 2); }
    }, [6, 7]);
    const field = new T.Mesh(new T.PlaneGeometry(70, 78), fx3dStd(T, 0xffffff, { map: grass, roughness: 0.95 }));
    field.rotation.x = -Math.PI / 2; field.position.z = -15; field.receiveShadow = true; S.add(field);
    const lineM = fx3dStd(T, 0xF4F4F4, { roughness: 0.9 });
    const line = (w, d, x, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, d), lineM); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z); m.receiveShadow = true; S.add(m); };
    line(70, 0.12, 0, gz);
    line(18.32, 0.12, 0, gz + 5.5); line(0.12, 5.5, -9.16, gz + 2.75); line(0.12, 5.5, 9.16, gz + 2.75);
    line(40.3, 0.12, 0, gz + 16.5); line(0.12, 16.5, -20.15, gz + 8.25); line(0.12, 16.5, 20.15, gz + 8.25);
    // "D" หน้าเขตโทษ: วงรัศมี 9.15 ม. จากจุดโทษ ส่วนที่อยู่นอกกรอบ
    const arcA = Math.acos(5.5 / 9.15);
    const dArc = new T.Mesh(new T.RingGeometry(9.09, 9.21, 64, 1, Math.PI / 2 + arcA - Math.PI, 2 * (Math.PI / 2 - arcA)), lineM);
    dArc.rotation.x = -Math.PI / 2; dArc.position.set(0, 0.01, 0); S.add(dArc);
    const spot = new T.Mesh(new T.CircleGeometry(0.075, 20), lineM); spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.011, 0); S.add(spot);
    // อัฒจันทร์ + ป้ายโฆษณาข้างสนาม (สีธีม — ป้ายโฆษณาจริงก็เปลี่ยนสีได้)
    // อัฒจันทร์ลาดหลังประตู ห่างเส้นประตู ~22 ม. — เห็นฟ้าเหนือหลังคา (รุ่นแรกชิดจนบังฟ้าหมด และคนดูเป็นแถบสี)
    const crowd = fx3dCrowd(T, P);
    crowd.wrapS = crowd.wrapT = T.RepeatWrapping; crowd.repeat.set(6, 3);
    const stand = new T.Mesh(new T.PlaneGeometry(110, 22), fx3dStd(T, 0xffffff, { map: crowd, roughness: 1 }));
    stand.position.set(0, 7.5, gz - 24); stand.rotation.x = -0.62; S.add(stand);
    const wallS = new T.Mesh(new T.BoxGeometry(110, 1.2, 0.4), fx3dStd(T, 0x2A3140)); wallS.position.set(0, 0.6, gz - 15.5); S.add(wallS);
    const roof = new T.Mesh(new T.BoxGeometry(110, 0.5, 12), fx3dStd(T, 0x2A3140, { metalness: 0.5, roughness: 0.5 }));
    roof.position.set(0, 18, gz - 33); roof.rotation.x = 0.08; S.add(roof);
    fx3dProc(run, stand, wallS, roof);
    const ad = fx3dTex(T, 1024, 64, (g, w, h) => {
      g.fillStyle = P.accent; g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFFFFF'; g.font = `800 ${h * 0.6}px ${run.font}`; g.textBaseline = 'middle';
      for (let x = 10; x < w; x += 300) g.fillText('STUDENT OS', x, h / 2 + 2);
    }, [3, 1]);
    const board = new T.Mesh(new T.BoxGeometry(70, 0.9, 0.15), [0, 1, 2, 3, 4, 5].map(i => i === 4 ? new T.MeshBasicMaterial({ map: ad }) : fx3dStd(T, 0x1A1F2B)));
    board.position.set(0, 0.45, gz - 4.5); board.castShadow = true; S.add(board);
    // ประตู 7.32 × 2.44 ม. เสากลม 12 ซม. + คานหลัง + ตาข่ายลึก 2 ม. (บนลาดลง)
    const postM = fx3dStd(T, 0xFAFAFA, { roughness: 0.25, metalness: 0.1 });
    const W = this.GW, H = this.GH;
    const post = x => { const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, H, 20), postM); p.position.set(x, H / 2, gz); p.castShadow = true; S.add(p); };
    post(-W / 2); post(W / 2);
    const bar = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, W + 0.12, 20), postM);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, H, gz); bar.castShadow = true; S.add(bar);
    const stayM = fx3dStd(T, 0xBFC5CF, { metalness: 0.6, roughness: 0.4 });
    [-1, 1].forEach(sg => {
      const st = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 2.4, 8), stayM);
      st.position.set(sg * W / 2, H * 0.55, gz - 1.0); st.rotation.x = 0.85; S.add(st);
    });
    const netTex = fx3dTex(T, 128, 128, (g, w, h) => {
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.2;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * w / 8, 0); g.lineTo(i * w / 8, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke(); }
    }, [14, 5]);
    const netM = new T.MeshStandardMaterial({ map: netTex, transparent: true, side: T.DoubleSide, depthWrite: false, roughness: 1 });
    const back = new T.Mesh(new T.PlaneGeometry(W, H * 0.8, 30, 10), netM);
    back.position.set(0, H * 0.4, gz - 2.0); S.add(back);
    const top = new T.Mesh(new T.PlaneGeometry(W, 2.1), netM); top.rotation.x = Math.PI / 2 - 0.1; top.position.set(0, H * 0.9, gz - 1.0); S.add(top);
    [-1, 1].forEach(sg => { const sd = new T.Mesh(new T.PlaneGeometry(2.0, H), netM); sd.rotation.y = Math.PI / 2; sd.position.set(sg * W / 2, H / 2, gz - 1.0); S.add(sd); });
    run.netBack = back;
    run.netBase = back.geometry.attributes.position.array.slice();
    // ผู้รักษาประตู ~1.88 ม. · เสื้อสีสะท้อนแสง (กติกา: ต่างจากทุกคนในสนาม) · ถุงมือ
    const K = new T.Group();
    const jersey = fx3dStd(T, 0xC8F03C, { roughness: 0.75 });
    const skin = fx3dStd(T, 0xD9A57A, { roughness: 0.7 });
    const torso = new T.Mesh(new T.CapsuleGeometry(0.22, 0.52, 8, 16), jersey); torso.position.y = 1.2; torso.castShadow = true;
    const head = new T.Mesh(new T.SphereGeometry(0.115, 24, 16), skin); head.position.y = 1.76; head.castShadow = true;
    const hair = new T.Mesh(new T.SphereGeometry(0.12, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), fx3dStd(T, 0x2A1C14, { roughness: 0.9 })); hair.position.y = 1.78;
    const shortsM = fx3dStd(T, 0x1A1F2B);
    const shorts = new T.Mesh(new T.CylinderGeometry(0.22, 0.24, 0.24, 16), shortsM); shorts.position.y = 0.82;
    const lg1 = new T.Mesh(new T.CapsuleGeometry(0.075, 0.62, 4, 10), skin); lg1.position.set(-0.11, 0.4, 0); lg1.castShadow = true;
    const lg2 = lg1.clone(); lg2.position.x = 0.11;
    const sock = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.3, 10), jersey); sock.position.set(-0.11, 0.2, 0);
    const sock2 = sock.clone(); sock2.position.x = 0.11;
    const armG = new T.CapsuleGeometry(0.058, 0.56, 4, 10);
    const a1 = new T.Mesh(armG, jersey); a1.position.set(-0.46, 1.48, 0); a1.rotation.z = -1.05; a1.castShadow = true;
    const a2 = new T.Mesh(armG, jersey); a2.position.set(0.46, 1.48, 0); a2.rotation.z = 1.05; a2.castShadow = true;
    const gloveM = fx3dStd(T, 0xF2F2F2, { roughness: 0.6 });
    const g1 = new T.Mesh(new T.BoxGeometry(0.13, 0.17, 0.06), gloveM); g1.position.set(-0.74, 1.73, 0);
    const g2 = g1.clone(); g2.position.x = 0.74;
    K.add(torso, head, hair, shorts, lg1, lg2, sock, sock2, a1, a2, g1, g2);
    K.position.set(0, 0, gz + 0.3);
    S.add(K);
    run.K = K; run.kph = fxRand(0, 6); run.kx = 0;
    // ลูกฟุตบอลขนาดจริง (เบอร์ 5 · Ø 22 ซม.) — ลายห้าเหลี่ยมดำ 12 จุด ตามรูปทรงไอโคซาฮีดรอนตัดมุมจริง
    run.ball = new T.Mesh(fx3dSoccerGeo(T, this.BR), new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 }));
    run.ball.castShadow = true; S.add(run.ball);
    Object.assign(run.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -8, far: 60 });
    run.sun.shadow.camera.updateProjectionMatrix();
    this.layout(run); this.reset(run);
  },
  // กล้องหลังลูกแบบมุมถ่ายทอดจุดโทษ: ลูกอยู่ช่วงล่างหนึ่งในสามของจอ (รุ่นแรกลูกจมขอบล่าง)
  layout(run) { fx3dLook(run, [0, 1.3, 2.7], [0, 0.55, this.GZ]); },
  reset(run) {
    run.ball.position.set(0, this.BR, 0);
    Object.assign(run, { v: new run.T.Vector3(), fly: false, held: false, saved: false, after: false, kTarget: null, ft: 0, scored: false, kdive: 0 });
    run.K.rotation.z = 0; run.K.position.y = 0;
    fx3dKeeperPose(run, 'Crouch_Idle_Loop');
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
    if (s < 500) { say(run, 'เบาไป ปัดแรงกว่านี้'); return; }
    const vf = fxClamp(14 + (s - 800) / 120, 12, 30);
    const vy = fxClamp((s - 500) / 1900, 0, 1.35) * 8.5;
    // ทิศซ้ายขวา: ยิงรังสีจากจอไปหาเส้นประตูจริง (มุมมองไกลใกล้) — ไม่คูณอัตราส่วนบนจอตรง ๆ
    const b0 = run.ball.position, ax = fx3dAimX(run, b0, v, this.GZ, 1.0), t = (b0.z - this.GZ) / vf;
    run.v.set((ax - b0.x) / t, vy, -vf);
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
      if (!run.kdive) fx3dKeeperPose(run, 'Jump_Loop');          // พุ่งตัว: ท่าลอยกลางอากาศ + เอียงทั้งตัว
      run.kdive = Math.min(1, run.kdive + dt * 4);
      if (run.mixer) K.position.y = Math.sin(run.kdive * Math.PI) * 0.35;
      K.rotation.z = -Math.sign(d || 1) * run.kdive * 0.9 * Math.min(1, Math.abs(run.kTarget) / 2);
    }
    K.position.x = run.kx;
    if (run.mixer) run.mixer.update(dt);
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
    // พื้นหญ้า: กระทบแรง = เด้ง + เสียความเร็ว · แตะเบา ๆ = กลิ้งไปกับพื้น หน่วงช้า ๆ
    // บั๊กรุ่นแรก: ลด 10% "ทุกเฟรมย่อยที่แตะพื้น" ลูกเลียดพื้นเลยเบรกตัวเองหยุดที่ 4 ม. ไม่ถึงประตู 11 ม.
    if (b.y < r) {
      b.y = r;
      if (v.y < -0.8) { v.y = -v.y * 0.45; v.x *= 0.85; v.z *= 0.85; }
      else { v.y = 0; const k = Math.exp(-0.35 * dt); v.x *= k; v.z *= k; }
    }
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
      if (ax > W / 2) { run.after = true; return fxMiss(run, 'ออกข้าง เล็งเข้ากรอบ', reset, { delay: 1100 }); }
      if (b.y > H) { run.after = true; return fxMiss(run, 'ข้ามคาน ปัดเบาลงนิด', reset, { delay: 1100 }); }
      if (kHit) {
        FXS.glove(); v.z = Math.abs(v.z) * 0.35; v.x = (b.x - run.kx) * 6; v.y = 2.5; run.after = true;
        fx3dKeeperPose(run, 'Jump_Land', true);
        return fxMiss(run, 'โดนเซฟ! เล็งหนีผู้รักษาประตู', reset, { delay: 1200 });
      }
      run.scored = true; run.netT = 0; run.netHit = { x: b.x, y: b.y };
      FXS.cheer();
      fx3dKeeperPose(run, 'Hit_Chest', true);       // ผู้รักษาประตูเสียใจ
      const far = Math.abs(b.x - run.kx) > 1.6;
      fx3dWin(run, far ? 'โกลสวย ๆ!' : 'โกล!!', b.clone(), { clean: far });
    }
    if (run.scored && b.z < gz - 1.7) { b.z = gz - 1.7; v.z = 0; }
    if (b.z < gz - 3 || run.ft > 3) {
      if (!run.scored && !run.after) { run.after = true; fxMiss(run, 'เบาไป ลูกกลิ้งไม่ถึงประตู', () => this.reset(run)); }
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
  load(run, T) { return fx3dPhoto(run, T, { day: 'stadium_01' }, { rot: 90, envI: 0.9 }); },   // มุมที่เห็นป้ายคะแนน
  PZ: -18.4,
  init(run, T) {
    const S = run.S;
    const P = fx3dEnv(run, T, { target: new T.Vector3(0, 0, -12), stadium: [[-45, -60], [45, -60], [-60, -10], [60, -10]], fogNear: 80, fogFar: 200, az: -30 });
    // หญ้าตัดลายตาราง (สนามเบสบอลจริงตัดเป็นลายหมากรุก)
    const grass = fx3dTex(T, 512, 512, (g, w, h) => {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#3D8E45' : '#47A04F'; g.fillRect(i * w / 2, j * h / 2, w / 2, h / 2); }
      for (let i = 0; i < 22000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(20,60,15,.15)' : 'rgba(150,200,110,.1)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 2.5); }
    }, [26, 26]);
    const field = new T.Mesh(new T.PlaneGeometry(260, 260), fx3dStd(T, 0xffffff, { map: grass, roughness: 1 }));
    field.rotation.x = -Math.PI / 2; field.position.z = -60; field.receiveShadow = true; S.add(field);
    const dirtT = fx3dTex(T, 256, 256, (g, w, h) => { g.fillStyle = '#B97B4C'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(80,45,20,.2)' : 'rgba(230,180,130,.15)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, [8, 8]);
    const dirt = fx3dStd(T, 0xffffff, { map: dirtT, roughness: 1 });
    const inf = new T.Mesh(new T.PlaneGeometry(29, 29), dirt);
    inf.rotation.x = -Math.PI / 2; inf.rotation.z = Math.PI / 4; inf.position.set(0, 0.004, -19.4); inf.receiveShadow = true; S.add(inf);
    const ig = new T.Mesh(new T.PlaneGeometry(22, 22), fx3dStd(T, 0xffffff, { map: grass, roughness: 1 }));
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
    const crowd2 = fx3dCrowd(T, P); crowd2.wrapS = crowd2.wrapT = T.RepeatWrapping; crowd2.repeat.set(10, 4);
    const stands = new T.Mesh(new T.CylinderGeometry(135, 118, 26, 64, 1, true, Math.PI * 0.75, Math.PI * 0.5), fx3dStd(T, 0xffffff, { map: crowd2, side: T.DoubleSide, roughness: 1 }));
    stands.position.set(0, 15, 0); S.add(stands); fx3dProc(run, stands);
    // ป้ายบนรั้วนอกสนาม (สีธีม)
    const ad = fx3dTex(T, 1024, 64, (g, w, h) => { g.fillStyle = P.accent; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `800 ${h * 0.6}px ${run.font}`; g.textBaseline = 'middle'; for (let x = 10; x < w; x += 260) g.fillText('STUDENT OS', x, h / 2 + 2); }, [8, 1]);
    const adR = new T.Mesh(new T.CylinderGeometry(109.8, 109.8, 1.2, 64, 1, true, Math.PI * 0.75, Math.PI * 0.5), new T.MeshBasicMaterial({ map: ad, side: T.DoubleSide }));
    adR.position.set(0, 3.2, 0); S.add(adR); fx3dProc(run, adR, fence);
    // เครื่องยิงลูกแบบ 2 ล้อ (ใช้ซ้อมตีจริง) บนขาตั้งสามขา + ตาข่ายกันลูกรูปตัว L ข้างหน้า
    // เจ้าของ: "พวกที่มันมีคนอยู่ … แปลก" — คนจากแคปซูลอ่านเป็นตุ๊กตา · การซ้อมตีจริงก็ใช้เครื่องแบบนี้
    const steel = fx3dStd(T, 0x2C323D, { metalness: 0.75, roughness: 0.38 });
    const rubber = fx3dStd(T, 0x15171C, { roughness: 0.9 });
    const Mch = new T.Group();
    [0, 2.1, 4.2].forEach(a => {
      const l = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 1.15, 8), steel);
      l.position.set(Math.cos(a) * 0.28, 0.52, Math.sin(a) * 0.28); l.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); l.castShadow = true; Mch.add(l);
    });
    const post = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.4, 10), steel); post.position.y = 1.05; Mch.add(post);
    const housing = new T.Mesh(new T.BoxGeometry(0.16, 0.62, 0.3), fx3dStd(T, P.accent, { metalness: 0.35, roughness: 0.45 }));
    housing.position.set(-0.17, 1.42, 0); housing.castShadow = true; Mch.add(housing);
    const wheels = [];
    [1.27, 1.57].forEach(y => {
      const w = new T.Group();
      const tire = new T.Mesh(new T.TorusGeometry(0.15, 0.045, 12, 32), rubber);
      const hub = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.05, 24), fx3dStd(T, 0xBFC5CF, { metalness: 0.9, roughness: 0.25 }));
      hub.rotation.x = Math.PI / 2;
      w.add(tire, hub); w.position.set(0, y, 0.02); w.rotation.y = Math.PI / 2; w.castShadow = true;
      Mch.add(w); wheels.push(w);
    });
    const chute = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.5, 12, 1, true), fx3dStd(T, 0xD8DCE2, { metalness: 0.6, roughness: 0.3, side: T.DoubleSide }));
    chute.position.set(0, 1.42, -0.32); chute.rotation.x = 1.2; Mch.add(chute);
    const bucket = new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.36, 20, 1, true), fx3dStd(T, 0xF2F2F2, { roughness: 0.6, side: T.DoubleSide }));
    bucket.position.set(0.55, 0.18, -0.2); bucket.castShadow = true; Mch.add(bucket);
    for (let i = 0; i < 7; i++) { const bb = new T.Mesh(new T.SphereGeometry(0.037, 12, 8), fx3dStd(T, 0xF7F5EF)); bb.position.set(0.55 + fxRand(-0.08, 0.08), 0.34 + (i % 2) * 0.03, -0.2 + fxRand(-0.08, 0.08)); Mch.add(bb); }
    const lamp = new T.Mesh(new T.SphereGeometry(0.02, 10, 8), new T.MeshBasicMaterial({ color: 0x2BD46A }));
    lamp.position.set(-0.17, 1.76, 0.12); Mch.add(lamp);
    Mch.position.set(0, 0.25, this.PZ);
    Mch.rotation.y = Math.PI;
    S.add(Mch);
    // ตาข่ายกันลูกรูปตัว L (ช่องว่างตรงที่ลูกออก)
    const netT = fx3dTex(T, 128, 128, (g, w, h) => { g.strokeStyle = 'rgba(40,40,40,.55)'; g.lineWidth = 1.5; for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(i * w / 10, 0); g.lineTo(i * w / 10, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 10); g.lineTo(w, i * h / 10); g.stroke(); } }, [6, 6]);
    const netM = new T.MeshStandardMaterial({ map: netT, transparent: true, side: T.DoubleSide, depthWrite: false, roughness: 1 });
    const scr = new T.Group();
    const low = new T.Mesh(new T.PlaneGeometry(2.0, 1.05), netM); low.position.set(0, 0.52, 0);
    const side = new T.Mesh(new T.PlaneGeometry(0.75, 1.05), netM); side.position.set(-0.62, 1.57, 0);
    const pipeM = fx3dStd(T, 0xA9B0BA, { metalness: 0.8, roughness: 0.35 });      // ท่ออะลูมิเนียมบาง (ของจริง)
    const pipe = (w, h, x, y, rz) => { const m = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, w, 8), pipeM); m.position.set(x, y, 0); m.rotation.z = rz; m.castShadow = true; scr.add(m); };
    pipe(2.1, 0, -1.0, 1.05, 0); pipe(1.05, 0, 1.0, 0.52, 0); pipe(2.0, 0, 0, 0.02, Math.PI / 2); pipe(2.0, 0, 0, 1.05, Math.PI / 2); pipe(0.75, 0, -0.62, 2.1, Math.PI / 2); pipe(1.05, 0, -0.25, 1.57, 0);
    scr.add(low, side);
    scr.position.set(0.15, 0.25, this.PZ + 1.3);
    S.add(scr);
    run.machine = Mch; run.wheels = wheels; run.lamp = lamp;
    // กรอบสไตรค์
    // กรอบสไตรค์ขนาดจริง: กว้างเท่าเพลต 43 ซม. · สูงเข่า (~0.5 ม.) ถึงกลางอก (~1.1 ม.)
    const zone = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(0.43, 0.6)), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    zone.position.set(0, 0.8, 0.2); S.add(zone);
    // ไม้ตี — หมุนรอบมือ (ซ้ายของเพลต) · สองชั้น: หันซ้ายขวา (yaw) แล้วยกขึ้นลง (lift)
    // เงื้อ: ชี้ไปข้างหลัง (ทางคนรับลูก) และยกสูง → กวาดผ่านเพลตระดับเอว (ชี้ไปทางขวา = จังหวะโดน) → ตามแรงไปข้างหน้า
    // (รุ่นแรกหมุนแกนเดียว ไม้ยื่นขวางจอชี้ไปหาพิทเชอร์ตลอดเวลาที่รอ)
    const bat = new T.Group();
    // ไม้แอชขนาดจริง: ยาว 84 ซม. · ปลาย Ø 6.6 ซม. · ด้าม Ø 2.5 ซม. · ปุ่มท้าย · เทปพันด้าม
    const grain = fx3dTex(T, 512, 64, (g, w, h) => { g.fillStyle = '#D7B07A'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(120,80,40,${0.08 + Math.random() * 0.12})`; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); g.stroke(); } });
    const wood = new T.MeshPhysicalMaterial({ map: grain, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    const prof = [[0.0001, 0], [0.022, 0], [0.024, 0.012], [0.013, 0.03], [0.0125, 0.32], [0.022, 0.52], [0.033, 0.7], [0.033, 0.83], [0.028, 0.84], [0.0001, 0.84]].map(([x, y]) => new T.Vector2(x, y));
    const barrel = new T.Mesh(new T.LatheGeometry(prof, 24), wood);
    barrel.rotation.z = -Math.PI / 2; barrel.castShadow = true;
    const tape = new T.Mesh(new T.CylinderGeometry(0.0135, 0.0135, 0.2, 12), fx3dStd(T, 0x1A1D24, { roughness: 0.9 }));
    tape.rotation.z = Math.PI / 2; tape.position.x = 0.13;
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
    // ลูกเบสบอล: ขนาดจริง Ø 7.3 ซม. ที่ระยะ 9 ม. เหลือ ~3px บนจอ — เกมจับจังหวะที่มองไม่เห็นลูกคือเกมที่เล่นไม่ได้
    // จึงขยาย 1.5 เท่า (ตาแทบแยกไม่ออก) + ทางลมขาว · ตรงนี้เลือกเล่นได้ก่อนสมจริงโดยตั้งใจ
    run.ball = new T.Mesh(new T.SphereGeometry(0.055, 24, 16), fx3dStd(T, 0xffffff, { map: bt, roughness: 0.6, emissive: 0x222222 }));
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
    if (run.lamp) run.lamp.material.color.set(0x2BD46A);
  },
  ballAt(run, p) {
    const s = new run.T.Vector3(0, 1.67, this.PZ + 0.3), e = new run.T.Vector3(run.ex, run.ey, 0.3);   // ลูกออกจากช่องระหว่างล้อ
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
    if (run.wheels) run.wheels.forEach((w, i) => { w.rotation.z += dt * (i ? -38 : 38); });   // ล้อเครื่องหมุนตลอด
    run.bat.rotation.z = fxLerp(L0, L1, Math.min(1, e * 1.6));
    if (run.st === 'wind') {
      run.wt += dt;
      // ไฟเครื่องกะพริบเหลืองก่อนยิง (สัญญาณจริงของเครื่องยิงลูก) · ยิงแล้วมีเสียง "ป๊อก" จากล้อ
      if (run.lamp) run.lamp.material.color.set(run.wt > 0.45 && Math.sin(run.wt * 30) > 0 ? 0xFFC23D : 0x2BD46A);
      if (run.wt > 0.9) { run.st = 'pitch'; run.p = 0; run.ball.visible = true; FXS.pitch(); HSFX.tone('sine', 120, 70, 0.3, 0.002, 0.1); }
    } else if (run.st === 'pitch') {
      run.p += dt / run.PT;
      run.ball.position.copy(this.ballAt(run, run.p));
      run.ball.rotation.x += dt * 30;
      fx3dSprite(run, { pos: run.ball.position, size: 0.1, life: 0.16, color: 0xffffff, alpha: 0.6 });   // ทางลมช่วยให้ตาตามลูกทัน
      if (run.p > 1.12) {
        run.st = 'caught';
        FXS.glove();
        fxMiss(run, !run.swung ? 'สไตรค์! แตะจอตอนลูกเข้ากรอบ' : run.early ? 'เร็วไป รอให้ลูกถึงกรอบก่อน' : 'ช้าไป แตะเร็วขึ้นนิด', () => this.reset(run), { delay: 1100 });
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
  // สนามกอล์ฟจริง 3 ช่วงเวลา: กลางวัน (ลิมโปโป) · พระอาทิตย์ตก (แฟร์เวย์) · กลางคืนแสงจันทร์
  load(run, T) {
    return fx3dPhoto(run, T, { day: 'limpopo_golf_course', sunset: 'sunset_fairway', night: 'moonlit_golf' }, { ground: true, height: 1.7, radius: 70, rot: 0 })
      .then(ok => { if (ok && run.rough) { const a = fx3dFade(T, 0.1, 0.2); a.repeat.set(1 / 80, 1 / 80); a.offset.set(0.5, 0.5); run.rough.material.alphaMap = a; run.rough.material.transparent = true; run.rough.material.depthWrite = false; run.rough.material.needsUpdate = true; } return ok; });
  },
  BR: 0.02135, FR: 0.65, MAXP: 120,     // ลูกจริง · ความหน่วงกรีนแข่ง (stimp ~10)
  init(run, T) {
    const S = run.S;
    run.hx = fxRand(-0.8, 0.8); run.hz = -4.6;
    const P = fx3dEnv(run, T, { target: new T.Vector3(0, 0, -3), fogNear: 25, fogFar: 90, az: 40 });
    run.slope = fxRand(0.06, 0.12) * (Math.random() < 0.5 ? -1 : 1);    // m/s² ทางแกน x
    const cupR = run.tries >= 3 ? 0.075 : 0.054;                        // หลุมจริง Ø 10.8 ซม.
    run.cupR = cupR;
    const grassTex = (a, b, rep, n) => fx3dTex(T, 512, 512, (g, w, h) => {
      for (let i = 0; i < 2; i++) { g.fillStyle = i ? a : b; g.fillRect(0, i * h / 2, w, h / 2); }
      for (let i = 0; i < n; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(20,60,15,.1)' : 'rgba(170,220,130,.08)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 1.5); }
    }, rep);
    // กรีนกับรัฟต่างเป็นแผ่นที่ "เจาะรู" ตรงหลุมจริง (ShapeGeometry + hole) — มองลงไปเห็นถ้วยข้างใน
    const holePath = () => { const h = new T.Path(); h.absarc(run.hx, -run.hz, cupR, 0, Math.PI * 2, true); return h; };
    const rough = new T.Shape(); rough.moveTo(-40, -40); rough.lineTo(40, -40); rough.lineTo(40, 40); rough.lineTo(-40, 40); rough.lineTo(-40, -40);
    const gs = new T.Shape(); gs.absellipse(0, 3.0, 5.2, 6.8, 0, Math.PI * 2, false);
    rough.holes.push(gs);
    const roughM = new T.Mesh(new T.ShapeGeometry(rough, 48), fx3dStd(T, 0xffffff, { map: grassTex('#3F7F3A', '#468A40', [40, 40], 30000), roughness: 1 }));
    roughM.rotation.x = -Math.PI / 2; roughM.receiveShadow = true; S.add(roughM); run.rough = roughM;
    const fringe = new T.Shape(); fringe.absellipse(0, 3.0, 5.2, 6.8, 0, Math.PI * 2, false);
    const inner = new T.Path(); inner.absellipse(0, 3.0, 4.6, 6.2, 0, Math.PI * 2, true); fringe.holes.push(inner);
    const fr = new T.Mesh(new T.ShapeGeometry(fringe, 64), fx3dStd(T, 0xffffff, { map: grassTex('#559B48', '#5CA24E', [10, 10], 20000), roughness: 0.95 }));
    fr.rotation.x = -Math.PI / 2; fr.position.y = 0.001; fr.receiveShadow = true; S.add(fr);
    const green = new T.Shape(); green.absellipse(0, 3.0, 4.6, 6.2, 0, Math.PI * 2, false); green.holes.push(holePath());
    const gr = new T.Mesh(new T.ShapeGeometry(green, 96), fx3dStd(T, 0xffffff, { map: grassTex('#6CBF5A', '#76C963', [3, 3], 40000), roughness: 0.75 }));
    gr.rotation.x = -Math.PI / 2; gr.position.y = 0.002; gr.receiveShadow = true; S.add(gr);
    // ถ้วยในหลุม: ผนังดิน → ขอบถ้วยพลาสติกขาว 2.5 ซม. ใต้ผิว → ก้นมืด
    const soil = new T.Mesh(new T.CylinderGeometry(cupR, cupR, 0.025, 32, 1, true), fx3dStd(T, 0x4A3520, { side: T.BackSide, roughness: 1 }));
    soil.position.set(run.hx, -0.0105, run.hz); S.add(soil);
    const liner = new T.Mesh(new T.CylinderGeometry(cupR * 0.97, cupR * 0.97, 0.08, 32, 1, true), fx3dStd(T, 0xEDEDED, { side: T.BackSide, roughness: 0.5 }));
    liner.position.set(run.hx, -0.063, run.hz); S.add(liner);
    const bottom = new T.Mesh(new T.CircleGeometry(cupR, 32), new T.MeshBasicMaterial({ color: 0x101010 }));
    bottom.rotation.x = -Math.PI / 2; bottom.position.set(run.hx, -0.1, run.hz); S.add(bottom);
    // ต้นไม้รอบ ๆ (เงาจริง)
    for (let i = 0; i < 11; i++) {
      const tr = fx3dTree(T, i + 1);
      const a = -Math.PI * 0.12 - i * 0.07 * Math.PI;
      const d = 13 + (i % 3) * 4;
      tr.position.set(Math.cos(a) * d, 0, -5 + Math.sin(a) * d); tr.scale.setScalar(0.9 + (i % 4) * 0.15);
      S.add(tr); fx3dProc(run, tr);
    }
    // ธง: ก้านไฟเบอร์ลายขาวสลับสี สูง 2.13 ม. · ผืน 50 × 36 ซม. สีธีม · ปักกลางหลุม
    const stripes = fx3dTex(T, 16, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#FFFFFF' : P.accent; g.fillRect(0, i * h / 8, w, h / 8); } });
    const pole = new T.Mesh(new T.CylinderGeometry(0.0065, 0.0065, 2.13, 10), fx3dStd(T, 0xffffff, { map: stripes, roughness: 0.4 }));
    pole.position.set(run.hx, 2.13 / 2 - 0.08, run.hz); pole.castShadow = true; S.add(pole);
    const flagG = new T.PlaneGeometry(0.5, 0.36, 12, 3);
    flagG.translate(0.25, 0, 0);
    const flag = new T.Mesh(flagG, fx3dStd(T, P.accent, { side: T.DoubleSide, roughness: 0.85 }));
    flag.position.set(run.hx, 1.85, run.hz); flag.castShadow = true; S.add(flag);
    run.flag = flag; run.flagBase = flagG.attributes.position.array.slice();
    // ลูกกอล์ฟขนาดจริง Ø 4.27 ซม. · รอยลักยิ้ม (bump) · ยูรีเทนเงา
    const dimple = fx3dTex(T, 512, 256, (g, w, h) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 12) for (let x = (y % 24) / 2; x < w; x += 12) { g.fillStyle = '#9A9A9A'; g.beginPath(); g.arc(x, y, 4.3, 0, 7); g.fill(); } });
    run.ball = new T.Mesh(new T.SphereGeometry(this.BR, 40, 28), new T.MeshPhysicalMaterial({ color: 0xffffff, bumpMap: dimple, bumpScale: 0.35, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.25 }));
    run.ball.castShadow = true; S.add(run.ball);
    Object.assign(run.sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, far: 50 }); run.sun.shadow.camera.updateProjectionMatrix();
    this.layout(run); this.reset(run);
  },
  layout(run) {
    const T = run.T;
    // สายตานักกอล์ฟตอนอ่านไลน์: ยืนหลังลูก ~1.4 ม. ตาสูง ~1 ม.
    fx3dLook(run, [0, 1.05, 1.5], [run.hx * 0.45, 0, -3.0]);
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
  // ทิศ: ดึงตรง ๆ = เล็งหลุมพอดี · ดึงเบี่ยงซ้ายขวา = เผื่อทางลาด
  // แรง: ช่วงกลาง (55–85%) ถูกบีบเข้าหาแรงที่ไปถึงหลุมด้วยความเร็ว ~1 ม./วิ (ตกได้)
  // รุ่นแรกเป็นเส้นตรงทั้งสองอย่าง — จำลองแล้วลงได้ 5 จาก 1,039 แบบที่ดึงได้ (ขยับ 3px มุมเปลี่ยนเกือบ 2°)
  shotV(run, pl) {
    const T = run.T, l = Math.hypot(pl.dx, pl.dy) || 1, s = l / run.maxP;
    const D = Math.hypot(run.hx - run.p0.x, run.hz - run.p0.z);
    const vI = Math.sqrt(2 * this.FR * D + 1);
    const f = s < 0.55 ? 0.97 - (0.55 - s) * 1.2 : s > 0.85 ? 1.03 + (s - 0.85) * 1.2 : 1 + (s - 0.7) * 0.2;
    const base = Math.atan2(run.hx - run.p0.x, -(run.hz - run.p0.z));
    const a = base + (-pl.dx / run.maxP) * 0.4;     // 0.19°/px — หลุมจริงต้องเล็งละเอียด
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
      b.x += (run.hx - b.x) * 0.3; b.z += (run.hz - b.z) * 0.3; b.y = this.BR - k * 0.09;
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
    if (d < run.cupR + this.BR * 0.8) {      // ลูกเกยขอบหลุมเกือบทั้งลูกก็ยังตก (ขอบหลุมจริงลาดลง)
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
      fxMiss(run, run.fastNear ? 'แรงไป ลูกข้ามหลุม' : past ? 'แรงไปนิด เลยหลุม' : run.near < 0.4 ? 'เกือบแล้ว! อีกนิดเดียว'
        : b.z > run.hz + 0.6 ? 'สั้นไป ดึงยาวขึ้น' : 'เลี้ยวตามลาด เล็งเผื่อด้วย', () => this.reset(run));
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
  // ขนาดใกล้ของจริง (แตงโมลูกเล็ก · ส้มสายน้ำผึ้งลูกโต · แอปเปิลลูกโต) — กล้องอยู่ใกล้ขึ้นแทนการขยายผลไม้
  KINDS: [
    { id: 'melon', juice: 0xE8344E, r: 0.13, sx: 1.22 },
    { id: 'orange', juice: 0xFFA21F, r: 0.06, sx: 1 },
    { id: 'apple', juice: 0xFFF0C8, r: 0.055, sx: 1 },
  ],
  init(run, T) {
    const S = run.S;
    const P = fx3dEnv(run, T, { indoor: true, target: new T.Vector3(0, 1, -0.4), bg: '#1C1A18' });
    // ผนังกระเบื้องครัว (subway tile) สีธีมอ่อน + ยาแนว · เคาน์เตอร์ไม้ด้านล่าง
    const tileC = new T.Color(P.accent).lerp(new T.Color('#FFFFFF'), 0.72);
    const tiles = fx3dTex(T, 512, 512, (g, w, h) => {
      g.fillStyle = '#D8D4CC'; g.fillRect(0, 0, w, h);
      const tw = 128, th = 64;
      for (let r = 0, y = 0; y < h; r++, y += th) for (let x = (r % 2) * -tw / 2; x < w; x += tw) {
        const k = 0.94 + ((r * 7 + x) % 5) * 0.015;
        g.fillStyle = '#' + tileC.clone().multiplyScalar(k).getHexString();
        g.fillRect(x + 3, y + 3, tw - 6, th - 6);
        const gr = g.createLinearGradient(0, y, 0, y + th); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x + 3, y + 3, tw - 6, th - 6);
      }
    }, [6, 9]);
    const wall = new T.Mesh(new T.PlaneGeometry(4, 3), fx3dStd(T, 0xffffff, { map: tiles, roughness: 0.25 }));
    wall.position.set(0, 1.6, -0.75); wall.receiveShadow = true; S.add(wall);
    const woodT = fx3dTex(T, 1024, 256, (g, w, h) => {
      g.fillStyle = '#8A5A33'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${40 + Math.random() * 30},20,5,${0.1 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random() * 2; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 10, w * 0.6, y - 10, w, y + 5); g.stroke(); }
    });
    const counter = new T.Mesh(new T.BoxGeometry(4, 0.06, 0.9), fx3dStd(T, 0xffffff, { map: woodT, roughness: 0.45 }));
    counter.position.set(0, 0.5, -0.3); counter.receiveShadow = true; S.add(counter);
    run.wall = wall;
    Object.assign(run.sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1 }); run.sun.shadow.camera.updateProjectionMatrix();
    run.sun.position.set(1.2, 4, 3); run.sun.target.position.set(0, 1.1, -0.5);
    this.layout(run);
    this.reset(run);
  },
  layout(run) { fx3dLook(run, [0, 1.25, 1.25], [0, 1.2, 0]); },
  skinTex(run, T, k) {
    return fx3dTex(T, 1024, 512, (g, w, h) => {
      if (k.id === 'melon') {
        g.fillStyle = '#2F7A2E'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#123F15';
        for (let x = 0; x < w; x += 64) { g.beginPath(); for (let y = 0; y <= h; y += 6) g.lineTo(x + Math.sin(y / 9 + x) * 7 + (Math.random() - 0.5) * 6, y); for (let y = h; y >= 0; y -= 6) g.lineTo(x + 22 + Math.sin(y / 11 + x) * 6 + (Math.random() - 0.5) * 6, y); g.fill(); }
        for (let i = 0; i < 4000; i++) { g.fillStyle = 'rgba(170,210,120,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      } else if (k.id === 'orange') {
        g.fillStyle = '#F2861A'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 16000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(170,70,0,.18)' : 'rgba(255,200,90,.18)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1.8, 0, 7); g.fill(); }
      } else {
        g.fillStyle = '#B5161E'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(255,${180 + Math.random() * 60},80,${0.1 + Math.random() * 0.2})`; g.lineWidth = 2 + Math.random() * 4; const x = Math.random() * w; g.beginPath(); g.moveTo(x, h * 0.2); g.lineTo(x + (Math.random() - 0.5) * 30, h * 0.8); g.stroke(); }
        for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(255,230,180,.35)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      }
      // สติกเกอร์ผลไม้ (แบบสติกเกอร์ยี่ห้อบนผลไม้จริง) = ชื่องาน
      const sw = k.id === 'melon' ? w * 0.16 : w * 0.24, sh = sw * 0.42;
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(w / 2, h / 2, sw / 2, sh / 2, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#1F2430'; g.font = `700 ${sh * 0.36}px ${run.font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(run.label, w / 2, h / 2 + 1, sw * 0.8);
    });
  },
  faceTex(T, k) {
    return fx3dTex(T, 512, 512, (g, w, h) => {
      const c = w / 2, R = w / 2;
      if (k.id === 'melon') {
        g.fillStyle = '#2F7A2E'; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
        g.fillStyle = '#E8F2C9'; g.beginPath(); g.arc(c, c, R * 0.93, 0, 7); g.fill();
        const gr = g.createRadialGradient(c, c, 0, c, c, R * 0.86);
        gr.addColorStop(0, '#F2324A'); gr.addColorStop(0.75, '#F04760'); gr.addColorStop(1, '#F8A2A0');
        g.fillStyle = gr; g.beginPath(); g.arc(c, c, R * 0.86, 0, 7); g.fill();
        for (let i = 0; i < 2600; i++) { const a = Math.random() * 7, rr = Math.random() * R * 0.84; g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 2, 2); }
        g.fillStyle = '#16120F';
        for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + (i % 2) * 0.1, rr = R * (0.5 + (i % 3) * 0.06); g.save(); g.translate(c + Math.cos(a) * rr, c + Math.sin(a) * rr); g.rotate(a + Math.PI / 2); g.beginPath(); g.ellipse(0, 0, 5, 10, 0, 0, 7); g.fill(); g.restore(); }
      } else if (k.id === 'orange') {
        g.fillStyle = '#F2861A'; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
        g.fillStyle = '#FFF2DC'; g.beginPath(); g.arc(c, c, R * 0.9, 0, 7); g.fill();
        for (let i = 0; i < 10; i++) {
          const a0 = i / 10 * Math.PI * 2 + 0.03, a1 = (i + 1) / 10 * Math.PI * 2 - 0.03;
          const gr = g.createRadialGradient(c, c, R * 0.08, c, c, R * 0.84);
          gr.addColorStop(0, '#FFC25A'); gr.addColorStop(1, '#FF9A1C');
          g.fillStyle = gr; g.beginPath(); g.moveTo(c + Math.cos((a0 + a1) / 2) * R * 0.08, c + Math.sin((a0 + a1) / 2) * R * 0.08); g.arc(c, c, R * 0.84, a0, a1); g.closePath(); g.fill();
        }
        for (let i = 0; i < 1800; i++) { const a = Math.random() * 7, rr = R * (0.15 + Math.random() * 0.68); g.fillStyle = 'rgba(255,240,190,.35)'; g.beginPath(); g.ellipse(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 1.5, 4, a, 0, 7); g.fill(); }
        g.fillStyle = '#FFF2DC'; g.beginPath(); g.arc(c, c, R * 0.07, 0, 7); g.fill();
      } else {
        g.fillStyle = '#9E1018'; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
        const gr = g.createRadialGradient(c, c, 0, c, c, R * 0.96);
        gr.addColorStop(0, '#FFF6DE'); gr.addColorStop(0.85, '#FBEFC8'); gr.addColorStop(1, '#F0E6B0');
        g.fillStyle = gr; g.beginPath(); g.arc(c, c, R * 0.96, 0, 7); g.fill();
        g.strokeStyle = 'rgba(160,140,80,.5)'; g.lineWidth = 3;
        g.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? R * 0.12 : R * 0.3; g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } g.stroke();
        g.fillStyle = '#4A2A14';
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(c + Math.cos(a) * R * 0.2, c + Math.sin(a) * R * 0.2); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, 7); g.fill(); g.restore(); }
      }
    });
  },
  reset(run) {
    const T = run.T;
    if (run.fruit) { run.S.remove(run.fruit); run.fruit.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    const easy = run.tries >= 3;
    const k = this.KINDS[Math.floor(Math.random() * this.KINDS.length)];
    const r = k.r * (easy ? 1.3 : 1);
    const skinM = new T.MeshPhysicalMaterial({ map: this.skinTex(run, T, k), roughness: k.id === 'apple' ? 0.32 : k.id === 'orange' ? 0.55 : 0.4, clearcoat: k.id === 'apple' ? 0.6 : 0.2 });
    const body = new T.Mesh(new T.SphereGeometry(r, 48, 32), skinM);
    body.scale.set(k.sx, 1, 1); body.castShadow = true;
    const m = new T.Group(); m.add(body);
    if (k.id === 'apple') {
      const stem = new T.Mesh(new T.CylinderGeometry(0.003, 0.004, 0.03, 6), fx3dStd(T, 0x5A3A1E)); stem.position.y = r + 0.01; stem.rotation.z = 0.2; m.add(stem);
      const leaf = new T.Mesh(new T.SphereGeometry(0.014, 10, 6), fx3dStd(T, 0x4E8A2C)); leaf.scale.set(1.6, 0.25, 0.8); leaf.position.set(0.012, r + 0.015, 0); m.add(leaf);
    }
    if (k.id === 'melon') { const st = new T.Mesh(new T.CylinderGeometry(0.006, 0.008, 0.03, 6), fx3dStd(T, 0x6B5A2A)); st.rotation.z = Math.PI / 2; st.position.x = r * k.sx; m.add(st); }
    m.position.set(fxRand(-0.32, 0.32), 0.35, 0.05);
    m.rotation.y = -Math.PI / 2;           // สติกเกอร์หันมาทางกล้องตอนเริ่ม
    run.S.add(m);
    const g = easy ? 4.5 : 6.5;            // ลอยช้ากว่าแรงโน้มถ่วงจริงเล็กน้อย (แบบเกมผ่าผลไม้) ให้ทันปาด
    run.fruit = m;
    Object.assign(run, { kind: k, fr: r, grav: g, fv: new T.Vector3(-m.position.x * 0.7 + fxRand(-0.12, 0.12), Math.sqrt(2 * g * (1.62 - m.position.y)), 0.06),
      fw: new T.Vector3(fxRand(-2, 2), fxRand(-3, 3), fxRand(-2, 2)), wait: 0.45, tossed: false, cut: false, trail: [] });
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
    const R = Math.max(26, Math.abs(edge.x - c.x) * 1.15);     // ผลเล็กจริง → ระยะโดนขั้นต่ำ 26px (ปลายนิ้วกว้างกว่าใบมีด)
    const dx = p.x - prev.x, dy = p.y - prev.y, L2 = dx * dx + dy * dy || 1;
    const t = fxClamp(((c.x - prev.x) * dx + (c.y - prev.y) * dy) / L2, 0, 1);
    const d = Math.hypot(prev.x + dx * t - c.x, prev.y + dy * t - c.y);
    if (d < R) this.cut(run, dx, dy, d / R);
  },
  half(run, T, k, r, flip) {
    const grp = new T.Group();
    const skin = new T.Mesh(new T.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), run.fruit.children[0].material.clone());
    skin.material.side = T.DoubleSide;
    // หน้าตัดเนื้อผล: ฉ่ำ (clearcoat) · แตงโมไล่แดง→ชมพู→ขาว เมล็ดหยดน้ำ · ส้มเป็นกลีบมีเยื่อ · แอปเปิลมีแกนดาว
    const cap = new T.Mesh(new T.CircleGeometry(r, 48), new T.MeshPhysicalMaterial({ map: this.faceTex(T, k), roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
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
      fx3dBody(run, h, { v: run.fv.clone().multiplyScalar(0.3).add(n.clone().multiplyScalar(sg * 0.9)).add(new T.Vector3(0, 0.6, 0)),
        w: dir.clone().multiplyScalar(sg * 1.2), g: run.grav, floor: 0.53 + run.fr * 0.5, bounce: 0.25, life: 2.2 });
    });
    f.visible = false;
    for (let i = 0; i < 46; i++) {
      const v = new T.Vector3(fxRand(-1, 1), fxRand(-0.4, 1.2), fxRand(-0.6, 0.8)).normalize().multiplyScalar(fxRand(0.6, 2.4));
      fx3dSprite(run, { pos: f.position, vel: v, g: 9.8, size: fxRand(0.008, 0.022), life: fxRand(0.5, 0.9), color: k.juice, floor: 0.53 });
    }
    // หยดน้ำบนกระเบื้อง — ขนาดเท่าหยดจริง กระจายรอบจุดผ่า
    for (let i = 0; i < 14; i++) {
      const m = new T.Mesh(new T.CircleGeometry(fxRand(0.006, 0.03), 14), new T.MeshPhysicalMaterial({ color: k.juice, transparent: true, opacity: 0.55, roughness: 0.1, clearcoat: 1, depthWrite: false }));
      m.position.set(f.position.x + fxRand(-0.35, 0.35), f.position.y + fxRand(-0.25, 0.3), -0.745); run.S.add(m);
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
        if (run.fv.y < 0 && f.position.y < 0.2 && !run.missing) fxMiss(run, 'หลุดมือ! ปาดให้โดนผล', () => this.reset(run), { delay: 700 });
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
  load(run, T) {
    return fx3dPhoto(run, T, { day: 'meadow', sunset: 'sunset_meadow_path', night: 'moonlit_golf' }, { ground: true, height: 1.7, radius: 60, rot: 0 })
      .then(ok => { if (ok && run.ground) { const m = run.ground.material; m.alphaMap = fx3dFade(T, 0.08, 0.2); m.transparent = true; m.depthWrite = false; m.needsUpdate = true; } return ok; });
  },
  MAXP: 130, G: 9.8,
  init(run, T) {
    const S = run.S;
    run.tx = fxRand(-1.2, 1.2); run.tz = -6.5 + fxRand(-0.8, 0.8);
    const P = fx3dEnv(run, T, { target: new T.Vector3(0, 0, -5), fogNear: 30, fogFar: 110, az: -40 });
    // ทุ่งหญ้า: หญ้าไม่ตัด สีไม่เรียบ (ด่างตามดิน) + ใบหญ้าละเอียด
    const gt = fx3dTex(T, 512, 512, (g, w, h) => {
      g.fillStyle = '#5A9A48'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 30000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(25,70,15,.18)' : 'rgba(170,215,120,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3); }
    }, [30, 30]);
    const ground = new T.Mesh(new T.PlaneGeometry(120, 120), fx3dStd(T, 0xffffff, { map: gt, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.003; ground.receiveShadow = true; S.add(ground); run.ground = ground;
    for (let i = 0; i < 6; i++) {
      const hill = new T.Mesh(new T.SphereGeometry(fxRand(6, 11), 24, 12), fx3dStd(T, [0x7FB76A, 0x6FAE5E, 0x8CC478][i % 3], { roughness: 1 }));
      hill.scale.y = 0.35; hill.position.set(fxRand(-35, 35), -1, fxRand(-60, -35)); S.add(hill); fx3dProc(run, hill);
    }
    // กองงานขนาดจริง: รีมกระดาษ A4 (21 × 29.7 × 5 ซม.) สลับแฟ้มสีธีม ซ้อนเบี้ยว ๆ บนโต๊ะพับ
    const pile = new T.Group();
    const ream = fx3dTex(T, 256, 64, (g, w, h) => { g.fillStyle = '#F4F4F2'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.04})`; g.fillRect(0, y, w, 1); } });
    const top = fx3dTex(T, 256, 360, (g, w, h) => { g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h); g.fillStyle = '#1F2430'; g.font = `700 22px ${run.font}`; g.textAlign = 'center'; g.fillText(run.label, w / 2, 46, w - 30); g.fillStyle = '#C9D4E6'; for (let i = 0; i < 12; i++) g.fillRect(24, 76 + i * 22, (w - 48) * (i === 11 ? 0.5 : 1), 3); });
    const paperM = fx3dStd(T, 0xffffff, { map: ream, roughness: 0.9 });
    const binderM = fx3dStd(T, P.accent, { roughness: 0.55 });
    const legM = fx3dStd(T, 0x9AA1AE, { metalness: 0.7, roughness: 0.4 });
    const table = new T.Mesh(new T.BoxGeometry(0.9, 0.03, 0.6), fx3dStd(T, 0xC9A273, { roughness: 0.6 })); table.position.y = 0.72; table.castShadow = table.receiveShadow = true; pile.add(table);
    [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]].forEach(([x, z]) => { const l = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.72, 8), legM); l.position.set(x, 0.36, z); l.castShadow = true; pile.add(l); });
    let y = 0.735;
    for (let i = 0; i < 9; i++) {
      const binder = i % 3 === 1;
      const hgt = binder ? 0.06 : 0.05;
      const mats = binder ? binderM : [paperM, paperM, i === 8 ? fx3dStd(T, 0xffffff, { map: top, roughness: 0.9 }) : paperM, paperM, paperM, paperM];
      const b = new T.Mesh(new T.BoxGeometry(binder ? 0.25 : 0.21, hgt, binder ? 0.32 : 0.297), mats);
      b.position.set(fxRand(-0.03, 0.03), y + hgt / 2, fxRand(-0.03, 0.03)); b.rotation.y = fxRand(-0.25, 0.25);
      b.castShadow = b.receiveShadow = true; pile.add(b);
      y += hgt;
    }
    pile.position.set(run.tx, 0, run.tz); S.add(pile);
    run.pile = pile; run.pileTop = y;
    for (let i = 0; i < 7; i++) { const t = fx3dTree(T, i + 3); t.position.set(-16 + i * 5.3 + fxRand(-1, 1), 0, -22 - fxRand(0, 8)); t.scale.setScalar(fxRand(1.1, 1.6)); S.add(t); fx3dProc(run, t); }
    // ระเบิดลูกกลมเหล็กหล่อ Ø 24 ซม. (ทรงการ์ตูนคลาสสิก แต่วัสดุจริง: ผิวหล่อขรุขระ · ปากเกลียวทองเหลือง · ชนวนเชือก)
    const castBump = fx3dTex(T, 256, 128, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { g.fillStyle = Math.random() < 0.5 ? '#6A6A6A' : '#979797'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, 7); g.fill(); } });
    const bomb = new T.Group();
    const shell = new T.Mesh(new T.SphereGeometry(0.12, 40, 28), fx3dStd(T, 0x1C1F26, { metalness: 0.75, roughness: 0.48, bumpMap: castBump, bumpScale: 0.8 }));
    // เงาเปิดตอนลอยเท่านั้น — ตอนถืออยู่ในมือ (มุมบุคคลที่หนึ่ง) เงาตกห่างลงพื้นดูเหมือนระเบิดลอยค้าง
    const neck = new T.Mesh(new T.CylinderGeometry(0.035, 0.04, 0.05, 16), fx3dStd(T, 0xB08D3A, { metalness: 0.9, roughness: 0.3 }));
    neck.position.y = 0.125;
    const fuse = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.09, 6), fx3dStd(T, 0xC8A070, { roughness: 1 }));
    fuse.position.set(0.015, 0.18, 0); fuse.rotation.z = -0.4;
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
    fx3dLook(run, [0, 1.75, 2.6], [run.tx * 0.3, 0.55, -5.5]);
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
    run.bomb.children[0].castShadow = false;
    Object.assign(run, { v: new run.T.Vector3(), fly: false, pull: null, boomed: false });
  },
  blastR(run) { return run.tries >= 3 ? 2.0 : 1.35; },
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
    run.bomb.children[0].castShadow = true;
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
      const tip = new run.T.Vector3(0.035, 0.22, 0).applyMatrix4(run.bomb.matrixWorld);
      if (Math.random() < 0.8) fx3dSprite(run, { pos: tip, vel: new run.T.Vector3(fxRand(-0.3, 0.3), fxRand(0.1, 0.6), fxRand(-0.3, 0.3)), g: 2, size: 0.025, life: 0.3, color: 0xFFD15A, add: true });
    }
    if (!run.fly) return;
    const b = run.bomb.position, v = run.v;
    v.y -= this.G * dt; b.addScaledVector(v, dt);
    run.bomb.rotation.x -= dt * 5;
    if (Math.random() < 0.6) fx3dSprite(run, { pos: b, size: 0.18, grow: 0.6, life: 0.6, color: 0x9A9AA0, alpha: 0.35 });
    const lp = run.pile.position;
    const direct = Math.abs(b.x - lp.x) < 0.48 && Math.abs(b.z - lp.z) < 0.34 && b.y < run.pileTop + 0.1;
    if (direct || b.y < 0.12) this.explode(run, direct);
    else if (Math.abs(b.x) > 14 || b.z < -30) { run.fly = false; run.bomb.visible = false; fxMiss(run, 'ปาเลยไปไกล ดึงเบาลง', () => this.reset(run)); }
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
    // ฝุ่นฟุ้งเป็นวงตามพื้น (ground dust ring) + ลูกไฟร่วง
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2;
      fx3dSprite(run, { pos: new T.Vector3(c.x, 0.15, c.z), vel: new T.Vector3(Math.cos(a) * 4.5, fxRand(0.2, 0.8), Math.sin(a) * 4.5), drag: 2.2, size: 0.5 * big, grow: 1.6, life: fxRand(1.1, 1.7), color: 0x9C8B70, alpha: 0.45 });
    }
    for (let i = 0; i < 14; i++) fx3dSprite(run, { pos: c, vel: new T.Vector3(fxRand(-3, 3), fxRand(3, 7), fxRand(-3, 3)), g: 9.8, size: 0.06, life: fxRand(0.8, 1.3), color: 0xFF8A2E, add: true, floor: 0.02 });
    const crater = new T.Mesh(new T.CircleGeometry(0.75 * big, 24), new T.MeshBasicMaterial({ color: 0x241A10, transparent: true, opacity: 0.8, depthWrite: false }));
    crater.rotation.x = -Math.PI / 2; crater.position.set(c.x, 0.02, c.z); run.S.add(crater);
    if (hit) {
      run.pile.visible = false;
      const paperM = fx3dStd(T, 0xffffff, { side: T.DoubleSide, roughness: 0.9 });
      run.pile.traverse(o => { if (o.isMesh && o.position.y > 0.7) {
        const piece = o.clone(); piece.position.add(lp); run.S.add(piece);
        fx3dBody(run, piece, { v: new T.Vector3(fxRand(-3, 3), fxRand(3, 7), fxRand(-3, 2)), w: new T.Vector3(fxRand(-9, 9), fxRand(-9, 9), fxRand(-9, 9)), floor: 0.03, bounce: 0.3, life: 3 });
      } });
      // แผ่น A4 จริงปลิวว่อน — ร่วงช้าแบบกระดาษ (แรงต้านอากาศสูง)
      for (let i = 0; i < 40; i++) {
        const sh = new T.Mesh(new T.PlaneGeometry(0.21, 0.297), paperM);
        sh.position.set(lp.x + fxRand(-0.3, 0.3), fxRand(0.8, 1.3), lp.z + fxRand(-0.25, 0.25)); sh.castShadow = true;
        fx3dBody(run, sh, { v: new T.Vector3(fxRand(-4, 4), fxRand(5, 10), fxRand(-4, 3)), w: new T.Vector3(fxRand(-8, 8), fxRand(-8, 8), fxRand(-8, 8)), g: 3.5, drag: 1.3, floor: 0.02, life: 3.2 });
      }
      fx3dWin(run, direct ? 'ตูม!! ตรงเป้า' : 'ตูม!!', lp.clone().add(new T.Vector3(0, 0.8, 0)), { clean: direct, burstDelay: 200, hold: 2000 });
    } else {
      const far = (c.z < lp.z);
      fxMiss(run, 'พลาดเป้า ' + (far ? 'เลยไป ดึงเบาลง' : Math.abs(c.x - lp.x) > 1.5 ? 'เบี้ยวไป เล็งใหม่' : 'ไม่ถึง ดึงแรงขึ้น'), () => this.reset(run), { delay: 1400, quiet: true });
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
  // ห้องจริง (ภาพถ่าย) ฉายพื้นลงมา — โต๊ะกับถังตั้งบนพื้นห้องจริง · กลางคืนเป็นห้องเปิดไฟ
  load(run, T) { return fx3dPhoto(run, T, { day: 'small_empty_room_1', sunset: 'small_empty_room_1', night: 'small_empty_room_1' }, { ground: true, height: 1.5, radius: 5, rot: 90, envI: 0.8, nightTint: '#8A93AA' }); },
  RUB: 1400, BIN_R: 0.14, BIN_H: 0.36, PB: 0.035,   // ถังพลาสติก Ø 28 × 36 ซม. · ก้อนกระดาษ A4 ขยำ Ø ~7 ซม.
  init(run, T) {
    const S = run.S;
    const P = fx3dEnv(run, T, { indoor: true, target: new T.Vector3(0, 0.5, -0.6), bg: '#2A2622' });
    const floorT = fx3dTex(T, 256, 256, (g, w, h) => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#D9CFC0' : '#CFC4B3'; g.fillRect(i * w / 4, j * h / 4, w / 4, h / 4); }
    }, [8, 8]);
    const floor = new T.Mesh(new T.PlaneGeometry(30, 30), fx3dStd(T, 0xffffff, { map: floorT, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor); fx3dProc(run, floor);
    // ผนังทาสีธีมอ่อน (สีห้องจริง ไม่ใช่สีจัด) + บัวพื้น
    const wallC = new T.Color(P.accent).lerp(new T.Color('#F3EFE8'), 0.78);
    const wall = new T.Mesh(new T.PlaneGeometry(30, 10), fx3dStd(T, wallC, { roughness: 0.95 }));
    wall.position.set(0, 5, -3.2); S.add(wall);
    const skirt = new T.Mesh(new T.BoxGeometry(30, 0.1, 0.02), fx3dStd(T, 0xF4F1EC, { roughness: 0.6 })); skirt.position.set(0, 0.05, -3.19); S.add(skirt);
    fx3dProc(run, wall, skirt);
    const woodT = fx3dTex(T, 1024, 512, (g, w, h) => { g.fillStyle = '#9C6A3A'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${50 + Math.random() * 40},25,8,${0.08 + Math.random() * 0.16})`; g.lineWidth = 1 + Math.random() * 2; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 14, w * 0.6, y - 14, w, y + 6); g.stroke(); } });
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
    const geo = new T.PlaneGeometry(0.21, 0.297, 22, 30);    // A4 จริง
    geo.rotateX(-Math.PI / 2);
    const paper = new T.Mesh(geo, fx3dStd(T, 0xEDEDE9, { map: pt, side: T.DoubleSide, roughness: 0.9, flatShading: true }));   // กระดาษจริงขาวไม่สุด (ไม่งั้นจ้าจนฟุ้ง)
    paper.position.set(0, 0.781, 0.12); paper.castShadow = true; paper.receiveShadow = true; S.add(paper);
    run.paper = paper;
    const pos = geo.attributes.position;
    run.base = pos.array.slice();
    // ปลายทางของจุดยอด: "ห่อ" แผ่นสี่เหลี่ยมรอบทรงกลมแบบต่อเนื่อง (จุดข้างกันไปอยู่ข้างกัน)
    // + รอยพับเป็นคลื่น (ไซน์หลายความถี่ เฟสสุ่มต่อรอบ) — รุ่นแรกสุ่มแยกทีละจุด ได้ก้อนหนามแหลม ไม่ใช่กระดาษขยำ
    run.tgt = []; run.nz = [];
    const ph = Array.from({ length: 6 }, () => fxRand(0, 6.28));
    const wav = (u, v, k) => Math.sin(u * 7 + v * 3 + ph[k]) * 0.5 + Math.sin(u * 13 - v * 9 + ph[k + 1]) * 0.3 + Math.sin(v * 17 + u * 5 + ph[(k + 2) % 6]) * 0.2;
    for (let i = 0; i < pos.count; i++) {
      const u = run.base[i * 3] / 0.105, v = run.base[i * 3 + 2] / 0.1485;  // −1…1
      const th = u * Math.PI * 0.95, fi = v * Math.PI * 0.47;
      const rr = this.PB * (1 + 0.16 * wav(u, v, 0));
      run.tgt.push([Math.cos(fi) * Math.sin(th) * rr, Math.sin(fi) * rr + this.PB, Math.cos(fi) * Math.cos(th) * rr]);
      run.nz.push([wav(u, v, 1), Math.abs(wav(u, v, 2)), wav(u, v, 3)]);
    }
    // ถัง
    run.binX = fxRand(-0.35, 0.35); run.binZ = -1.7;
    const bin = new T.Group();
    const binM = fx3dStd(T, P.accent, { roughness: 0.4, side: T.DoubleSide });      // ถังพลาสติกสีธีม
    const bw = this.binR(run);
    const body = new T.Mesh(new T.CylinderGeometry(bw, bw * 0.8, this.BIN_H, 32, 1, true), binM); body.position.y = this.BIN_H / 2; body.castShadow = true;
    const bottom = new T.Mesh(new T.CircleGeometry(bw * 0.8, 32), fx3dStd(T, 0x3A3F4A)); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.01;
    const rim = new T.Mesh(new T.TorusGeometry(bw, 0.008, 8, 48), binM); rim.rotation.x = Math.PI / 2; rim.position.y = this.BIN_H;
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
    // นั่งที่โต๊ะ ตาสูง ~1.2 ม. มองกระดาษบนโต๊ะ เห็นถังขยะที่พื้นข้างหน้า
    fx3dLook(run, [0, 1.36, 0.92], [0, 0.42, -1.3]);
    run.C.updateMatrixWorld();
    run.p0 = new T.Vector3(0, 0.86, 0.22);
  },
  deform(run) {
    const pos = run.paper.geometry.attributes.position, a = pos.array, b = run.base, c = run.c;
    const e = c * c * (3 - 2 * c), w = Math.sin(Math.PI * c) * 0.014;   // รอยยับกลางทางสูง ~1.4 ซม. (สเกล A4)
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
      const s = fx3dToScreen(run, run.paper.position.clone().add(new run.T.Vector3(0, this.PB, 0)));
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
    const ball = run.paper.position.clone().add(new T.Vector3(0, this.PB, 0));
    const top = new T.Vector3(run.binX, this.BIN_H + 0.05, run.binZ);
    const el = 55 * Math.PI / 180, cs = Math.cos(el), tn = Math.tan(el);
    const dz = ball.z - top.z, dy = top.y - ball.y;
    const vI = Math.sqrt(9.8 * dz * dz / (2 * cs * cs * Math.max(0.2, dz * tn - dy)));
    let ax = fx3dAimX(run, ball, v, run.binZ, top.y);
    const off = ax - run.binX;
    if (Math.abs(off) < 0.25) ax = run.binX + off * 0.5;    // ดูดเข้าหาถัง (ถังจริง Ø 28 ซม. เล็กกว่ารุ่นแรก)
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
    const b = run.ballPos, v = run.vb, R = this.PB, bw = this.binR(run), H = this.BIN_H;
    const prevY = b.y;
    run.ft += dt;
    v.y -= 9.8 * dt; b.addScaledVector(v, dt);
    if (v.y < 0) run.desc = true;
    run.paper.position.copy(b).add(new run.T.Vector3(0, -this.PB, 0));
    run.paper.rotation.x -= dt * 6;
    const hd = Math.hypot(b.x - run.binX, b.z - run.binZ);
    if (run.inBin) { if (b.y < 0.06) { b.y = 0.06; v.set(0, 0, 0); run.fly = false; } return; }
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
        fxMiss(run, run.touched ? 'โดนขอบถัง! เกือบแล้ว' : short ? 'ไม่ลง แรงไม่ถึง' : long ? 'ไม่ลง แรงไป' : 'ไม่ลง เบี้ยวไป', () => {
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
    run.tgx = fxRand(-0.6, 0.6); run.tgy = fxRand(1.5, 2.1);
    const P = fx3dEnv(run, T, { indoor: true, wall: '#B5573E', target: new T.Vector3(0, 1, -2), bg: '#141210' });
    // อิฐมอญขนาดจริง 21.5 × 7.5 ซม. + ร่องปูน 1 ซม. (bump: ปูนลึกกว่าอิฐ) — รุ่นแรกก้อนละ ~60 ซม.
    const bw = 86, bh = 30, mort = 4;
    const drawBricks = (g, w, h, bump) => {
      g.fillStyle = bump ? '#3A3A3A' : '#8F8A80'; g.fillRect(0, 0, w, h);
      for (let r = 0, y = 0; y < h; r++, y += bh) for (let x = (r % 2) * -bw / 2; x < w; x += bw) {
        if (bump) { g.fillStyle = `rgb(${150 + (r * 13 + x) % 40},${150 + (r * 13 + x) % 40},${150 + (r * 13 + x) % 40})`; }
        else { const k = (r * 7 + Math.round(x / bw) * 3) % 6; g.fillStyle = ['#A84F37', '#9C4632', '#B65A3F', '#A3533A', '#8E4130', '#B2583D'][k]; }
        g.fillRect(x + mort / 2, y + mort / 2, bw - mort, bh - mort);
        if (!bump) for (let i = 0; i < 40; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(60,20,10,.18)' : 'rgba(230,170,130,.12)'; g.fillRect(x + Math.random() * bw, y + Math.random() * bh, 2, 2); }
      }
    };
    const brick = fx3dTex(T, 512, 512, (g, w, h) => drawBricks(g, w, h, false), [8.3, 5]);
    const brickB = fx3dTex(T, 512, 512, (g, w, h) => drawBricks(g, w, h, true), [8.3, 5]);
    const wall = new T.Mesh(new T.PlaneGeometry(10, 6), fx3dStd(T, 0xffffff, { map: brick, bumpMap: brickB, bumpScale: 2.2, roughness: 0.92 }));
    wall.position.set(0, 3, this.WZ); wall.receiveShadow = true; S.add(wall);
    // เป้าพ่นสีบนกำแพง
    [[0.42, 0xF2F2F2], [0.32, 0xD8342B], [0.22, 0xF2F2F2], [0.12, 0xD8342B]].forEach(([r, c], i) => {
      const m = new T.Mesh(new T.CircleGeometry(r, 48), fx3dStd(T, c, { roughness: 0.85, transparent: true, opacity: 0.92 }));
      m.position.set(run.tgx, run.tgy, this.WZ + 0.004 + i * 0.002); S.add(m);
    });
    // ป้ายไฟนีออนสีธีมบนอิฐ (เรืองจริง + แสงลงอิฐรอบ ๆ)
    const neonTex = fx3dTex(T, 1024, 192, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = `800 ${h * 0.55}px ${run.font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = P.accent; g.shadowBlur = 30; g.strokeStyle = '#FFFFFF'; g.lineWidth = 6;
      g.strokeText('STUDENT OS', w / 2, h / 2); g.fillStyle = P.accent; g.fillText('STUDENT OS', w / 2, h / 2);
    });
    const neon = new T.Mesh(new T.PlaneGeometry(2.2, 0.41), new T.MeshBasicMaterial({ map: neonTex, transparent: true, depthWrite: false, toneMapped: false }));
    neon.position.set(-run.tgx * 1.2, 3.35, this.WZ + 0.03); S.add(neon);
    const neonL = new T.PointLight(P.accent, 6, 4, 2); neonL.position.set(neon.position.x, 3.3, this.WZ + 0.5); S.add(neonL);
    // พื้นปูนขัด มีคราบ
    const conc = fx3dTex(T, 512, 512, (g, w, h) => {
      g.fillStyle = '#7B7D82'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,40,45' : '160,160,165'},.08)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 70, 0, 7); g.fill(); }
      for (let i = 0; i < 20000; i++) { g.fillStyle = 'rgba(30,30,35,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    }, [4, 4]);
    const floor = new T.Mesh(new T.PlaneGeometry(14, 14), fx3dStd(T, 0xffffff, { map: conc, roughness: 0.7, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    // สตูลไม้ (ที่วางแก้ว)
    const woodM = fx3dStd(T, 0x8A5A33, { roughness: 0.5 });
    const seat = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.035, 32), woodM); seat.position.set(0, 0.74, 0.45); seat.castShadow = seat.receiveShadow = true; S.add(seat);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const lg = new T.Mesh(new T.CylinderGeometry(0.015, 0.02, 0.74, 8), woodM); lg.position.set(Math.cos(a) * 0.12, 0.37, 0.45 + Math.sin(a) * 0.12); lg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); lg.castShadow = true; S.add(lg); }
    // แก้วไวน์สัดส่วนจริง: สูง 21 ซม. · ปากกว้าง 9 ซม. · ก้าน Ø 9 มม. · ฐาน Ø 7 ซม. — แก้วหักเหแสงจริง (transmission)
    const prof = [[0.0001, 0], [0.036, 0.001], [0.037, 0.004], [0.008, 0.008], [0.0045, 0.015], [0.0045, 0.09], [0.012, 0.1], [0.035, 0.12], [0.045, 0.15], [0.043, 0.185], [0.0385, 0.21]]
      .map(([x, y]) => new T.Vector2(x, y));
    const glassM = new T.MeshPhysicalMaterial({ color: 0xFFFFFF, transmission: 1, thickness: 0.004, ior: 1.5, roughness: 0.02, metalness: 0, clearcoat: 1, side: T.DoubleSide, transparent: true, opacity: 1 });
    run.glassM = glassM;
    const gl = new T.Mesh(new T.LatheGeometry(prof, 48), glassM);
    const wine = new T.Mesh(new T.LatheGeometry([[0.0001, 0.098], [0.022, 0.104], [0.038, 0.122], [0.0435, 0.145]].map(([x, y]) => new T.Vector2(x, y)), 40),
      new T.MeshPhysicalMaterial({ color: 0x6E0F28, roughness: 0.08, transmission: 0.35, thickness: 0.05, transparent: true }));
    const top = new T.Mesh(new T.CircleGeometry(0.0435, 40), new T.MeshPhysicalMaterial({ color: 0x7A1430, roughness: 0.05, clearcoat: 1 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.145;
    // ป้ายชื่องานแขวนที่ก้านแก้ว (ป้ายกระดาษผูกเชือก)
    const tag = new T.Mesh(new T.PlaneGeometry(0.075, 0.022), new T.MeshBasicMaterial({ map: fx3dLabel(run, T, run.label, { w: 512, h: 150 }), transparent: true }));
    tag.position.set(0.02, 0.055, 0.012); tag.rotation.y = -0.3;
    const G = new T.Group(); G.add(gl, wine, top, tag);
    gl.castShadow = true;
    S.add(G);
    run.glass = G;
    Object.assign(run.sun.shadow.camera, { left: -4, right: 4, top: 5, bottom: -2 }); run.sun.shadow.camera.updateProjectionMatrix();
    this.layout(run); this.reset(run);
  },
  layout(run) { fx3dLook(run, [0, 1.18, 1.32], [run.tgx * 0.3, 1.15, this.WZ]); },
  reset(run) {
    run.glass.position.set(0, 0.758, 0.45); run.glass.rotation.set(0, 0, 0); run.glass.visible = true;
    Object.assign(run, { fly: null, held: false, broken: false });
  },
  down(run, p) {
    const s = fx3dToScreen(run, run.glass.position.clone().add(new run.T.Vector3(0, 0.12, 0)));
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
    run.glass.position.y = 0.045;
    FXS.clink();
    fxMiss(run, 'เบาไป แก้วไม่แตก ปาแรงกว่านี้', () => this.reset(run), { delay: 1150 });
  },
  smash(run, at) {
    const T = run.T;
    run.broken = true; run.glass.visible = false; run.shake = 0.5;
    FXS.shatter();
    for (let i = 0; i < 46; i++) {
      const g = new T.BufferGeometry();
      const pts = [];
      for (let k = 0; k < 3; k++) pts.push(fxRand(-0.022, 0.022), fxRand(-0.022, 0.022), fxRand(-0.003, 0.003));   // เศษแก้วจริง 1–4 ซม.
      g.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); g.computeVertexNormals();
      const m = new T.Mesh(g, new T.MeshPhysicalMaterial({ color: 0xE6F3FF, transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, side: T.DoubleSide, depthWrite: false }));
      m.position.copy(at);
      const dir = new T.Vector3(fxRand(-1, 1), fxRand(-0.4, 1), fxRand(0.3, 1.4)).normalize();
      fx3dBody(run, m, { v: dir.multiplyScalar(fxRand(1.5, 4.5)), w: new T.Vector3(fxRand(-14, 14), fxRand(-14, 14), fxRand(-14, 14)), floor: 0.01, bounce: 0.35, life: 2.6, op0: 0.6,
        onLand: () => { if (Math.random() < 0.45) FXS.tink(); } });
    }
    for (let i = 0; i < 20; i++) fx3dSprite(run, { pos: at, vel: new T.Vector3(fxRand(-2, 2), fxRand(-1, 2.5), fxRand(0, 2)), g: 7, size: fxRand(0.04, 0.08), life: fxRand(0.5, 0.9), color: 0x9E1C3C });
    for (let i = 0; i < 16; i++) fx3dSprite(run, { pos: at, vel: new T.Vector3(fxRand(-3, 3), fxRand(-3, 3), fxRand(0, 2)), size: 0.06, life: 0.35, color: 0xffffff, add: true });
    const crack = new T.Mesh(new T.PlaneGeometry(0.6, 0.6), new T.MeshBasicMaterial({ map: fx3dTex(T, 256, 256, (g, w) => {
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
