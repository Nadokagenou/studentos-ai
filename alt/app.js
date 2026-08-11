// ============================================================
// StudentOS AI — App (UI + state)  ·  *** เวอร์ชัน ALT (SANDBOX) ***
// ข้อมูลจริง เก็บใน localStorage · ทุกจอ render จาก state
// ------------------------------------------------------------
// ALT = รุ่นทดลองฟีเจอร์ แยกขาดจากตัวจริง:
//   - localStorage ใช้ prefix 'studentos.alt.*' → เล่นยังไงก็ไม่แตะข้อมูลตัวจริง
//   - service worker ใช้ cache คนละชื่อ
// ============================================================

const APP_VERSION = '1A7V';                // สายเลข ALT ของตัวเอง ไม่ผูกกับ v35 ของตัวจริงแล้ว
const APP_CODENAME = 'Modern';             // ชื่อรุ่นของอัปเดตนี้
const APP_CHANNEL = 'ALT';                  // ป้ายกำกับรุ่น — โชว์ทั้งบนแอปและในหน้า "ฉัน"
const STORE_KEY = 'studentos.alt.v1';      // ALT: แยกที่เก็บข้อมูลจากตัวจริง ('studentos.v1')
const APP_T0 = performance.now(); // ใช้คุมเวลาโชว์ splash ขั้นต่ำ

let state = { tasks: [], settings: { name: '', freeHours: 2 } };
let editingId = null; // null = เพิ่มใหม่, ไม่ null = แก้ไขงานเดิม

// ---------- storage ----------
function load() {
  let hadNewData = false;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    hadNewData = !!raw;
    if (raw) state = Object.assign({ tasks: [], settings: { name: '', freeHours: 2 } }, JSON.parse(raw));
  } catch (e) { /* ข้อมูลเสีย → เริ่มใหม่ */ }
  migrateLegacyStore(hadNewData);
}

// ลิงก์หลักตัวเก่าเก็บข้อมูลไว้ที่คีย์ 'studentos.v1' — ตอนนี้แอปอ่านคีย์ใหม่
// ('studentos.alt.v1') แทน ใครที่เคยใช้ลิงก์หลักตัวเก่า (ไม่เคยเปิด /alt/ เลย)
// จะเปิดมาแล้วเห็นงานหายหมด ทั้งที่ข้อมูลยังอยู่ในเครื่องจริง ๆ ฟังก์ชันนี้ดึงกลับมาให้
// รันครั้งเดียวพอ (มีธงกันย้ายซ้ำ) และไม่ลบข้อมูลเก่าทิ้ง เผื่อมีอะไรผิดพลาดยังย้อนดูได้
//
// hadNewData = คีย์ใหม่มีข้อมูลอยู่ก่อนแล้วไหม (แยกจาก state ที่เป็นค่า default เปล่า ๆ เสมอ)
//   true  → เครื่องนี้เคยใช้ ALT จริง ๆ → ของเครื่องนี้เป็นหลัก เติมเฉพาะช่องที่ขาด
//   false → เครื่องนี้ไม่เคยมีข้อมูล ALT เลย (แค่ผู้ใช้ลิงก์หลักเก่า) → เอาของเก่ามาทั้งชุด
function migrateLegacyStore(hadNewData) {
  const LEGACY_KEY = 'studentos.v1';
  const MIGRATED_FLAG = 'studentos.legacyMigrated';
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    localStorage.setItem(MIGRATED_FLAG, '1'); // ตั้งก่อนเช็ค กันรันซ้ำแม้ไม่มีอะไรให้ย้าย
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return;
    const legacy = JSON.parse(legacyRaw);
    if (!legacy || !Array.isArray(legacy.tasks) || !legacy.tasks.length) return;

    if (hadNewData) {
      // งานรวมกันตาม id — งานฝั่งเครื่องนี้ (ALT) ชนะถ้ามี id ซ้ำ เพราะเป็นรุ่นที่พัฒนาต่อมาไกลกว่า
      const byId = {};
      for (const t of legacy.tasks) byId[t.id] = t;
      for (const t of (state.tasks || [])) byId[t.id] = t;
      state.tasks = Object.values(byId);
      // ตั้งค่าเอาของเครื่องนี้เป็นหลัก เติมเฉพาะช่องที่ยังไม่เคยตั้ง
      state.settings = Object.assign({}, legacy.settings, state.settings);
    } else {
      // ไม่เคยมีข้อมูล ALT มาก่อนเลย — state ตอนนี้เป็นแค่ค่า default ว่าง ๆ
      // เอาของเก่ามาทั้งชุดตรง ๆ ไม่ต้องผสม
      state.tasks = legacy.tasks;
      state.settings = Object.assign({}, legacy.settings);
    }

    save();
  } catch (e) { /* ข้อมูลเก่าอ่านไม่ออก ข้ามไปเฉย ๆ ไม่กระทบข้อมูลปัจจุบัน */ }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  pushToCloud(); // ซิงก์ขึ้น cloud อัตโนมัติ (ถ้าล็อกอินอยู่)
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// งานที่ยังอยู่จริง — ของในถังขยะไม่นับในทุกจอ ทุกการนับ และการเตือน
function liveTasks() { return state.tasks.filter(t => !t.deleted); }
function pendingTasks() { return state.tasks.filter(t => !t.done && !t.deleted); }

// ---------- ธีมสี ----------
// เก็บแยกจาก state เพราะเป็นค่าประจำ "เครื่องนี้" ไม่ใช่ของบัญชี —
// มือถือกับคอมของคนเดียวกันอาจอยากได้ธีมต่างกัน จึงไม่ซิงก์ข้ามเครื่อง
const THEME_KEY = 'studentos.alt.theme';   // ALT: แยกจากตัวจริง (ต้องตรงกับสคริปต์ใน <head>)
// สีแถบสถานะของแต่ละโทน (ต้องตรงกับ --scr ใน style.css/alt.css และตารางในสคริปต์ <head>)
const THEME_BAR = {
  light: '#F7FAFF', dark: '#0D1220', warm: '#FFF6FA', space: '#0A0E24',
  earth: '#F1F6F1', ocean: '#E9F4FB', magic: '#150E26', galaxy: '#0B0618',
  deepocean: '#04121F', earth2: '#EFF7EE', sweet: '#FDF0F8', genesis: '#8E9BE8',
  meta: '#050A16', glitch: '#04060A',
};
const THEME_NAME = {
  system: 'ตามระบบ', light: 'สว่าง', dark: 'มืด', warm: 'ชมพู', space: 'อวกาศ',
  earth: 'โลก', ocean: 'มหาสมุทร', magic: 'เวทมนตร์', galaxy: 'กาแล็กซี',
  deepocean: 'ทะเลลึก', earth2: 'ต้นไม้โลก', sweet: 'จักรวาลหวานแหว', genesis: 'Crystal',
  meta: 'Metaverse', glitch: 'Glitch',
};
// ---------- ALT 1A6M3: อีสเตอร์เอกก์ ธีมลับ ----------
// กดปุ่มธีมเดิมซ้ำ 5 ครั้งรวด = ปลดล็อกธีมลับของโทนนั้น
// ทุกครั้งที่กดซ้ำมีเอฟเฟกต์กระเด็น + เครื่องสั่น เป็นการบอกว่า "มีอะไรอยู่ตรงนี้"
const SECRETS = {
  ocean: {
    store: 'studentos.alt.deepUnlocked', flag: 'deep', theme: 'deepocean', fx: 'egg-bub', taps: 5,
    title: 'ปลดล็อกธีมทะเลลึก 🦈', body: 'ดำลงไปอีกชั้น — มีฉลามกับหมึกยักษ์ว่ายอยู่ข้างหลัง',
  },
  earth: {
    store: 'studentos.alt.earth2Unlocked', flag: 'earth2', theme: 'earth2', fx: 'egg-leaf', taps: 5,
    title: 'ปลดล็อกธีมต้นไม้โลก 🌳', body: 'มีลม มีนกบินผ่าน มีต้นไม้ใหญ่กลางจอ และหญ้าไหวอยู่ก้นจอ',
  },
  // ย้ายมาจากปุ่มชมพู (เดิมต้องกด 22 ครั้ง) — กาแล็กซีเป็นธีมอวกาศอยู่แล้ว
  // ของที่ซ่อนอยู่ข้างหลังจึงเป็นจักรวาลอีกใบ เข้ากันกว่าและนับ 5 ครั้งเท่าอันอื่น
  // ที่เก็บ (store) ยังเป็นคีย์เดิม คนที่ปลดล็อกไปแล้วจึงไม่หลุด
  galaxy: {
    store: 'studentos.alt.sweetUnlocked', flag: 'sweet', theme: 'sweet', fx: 'egg-star', taps: 5,
    title: 'ปลดล็อกธีมจักรวาลหวานแหว 🌈', body: 'ก้อนเมฆพาสเทล สายรุ้ง และดาวเคราะห์มีวงแหวน',
  },
};
let tapTheme = '', tapCount = 0, tapAt = 0;

function secretUnlocked(id) {
  const s = SECRETS[id];
  try { return !!s && localStorage.getItem(s.store) === '1'; } catch (_) { return false; }
}
function applySecrets() {
  for (const [id, s] of Object.entries(SECRETS)) {
    if (secretUnlocked(id)) document.documentElement.dataset[s.flag] = 'on';
    else delete document.documentElement.dataset[s.flag];
  }
}
// เก็บชื่อเดิมไว้ให้โค้ดส่วนอื่นเรียกได้เหมือนเดิม
function deepUnlocked() { return secretUnlocked('ocean'); }
function applyDeepUnlock() { applySecrets(); }

// ---------- ALT 1A6M3: GENESIS ----------
// ธีมปลายทาง — ปลดล็อกเมื่อได้เหรียญครบทุกอันในแอป (ซึ่งแปลว่าต้องผ่านทุกอย่างมาแล้ว)
const GENESIS_KEY = 'studentos.alt.genesisUnlocked';
const GENESIS_CYCLE = 99_000;  // ทุก 99 วิ
const GENESIS_EVENT = 20_000;  // อีเวนต์ยาว 20 วิ
let genesisTimer = null, genesisEndTimer = null;

function genesisUnlocked() {
  try { return localStorage.getItem(GENESIS_KEY) === '1'; } catch (_) { return false; }
}

// เรียกทุกครั้งที่เหรียญเปลี่ยน — ครบทุกเหรียญเมื่อไหร่ปลดล็อกทันที
function checkGenesisUnlock() {
  if (genesisUnlocked()) return false;
  // นับเฉพาะเหรียญอื่น — เหรียญ GENESIS เองผูกกับการปลดล็อกนี้ ถ้านับรวมจะวนกันเอง
  // ไม่นับเหรียญ Crystal เอง และไม่นับเหรียญธีมลับที่มาทีหลัง — กติกาปลดล็อก Crystal ต้องเท่าเดิม
  const others = BADGES.filter(b => !b.genesis && !b.postGenesis);
  if (others.some(b => !badgeEarned(b))) return false;
  try { localStorage.setItem(GENESIS_KEY, '1'); } catch (_) {}
  document.documentElement.dataset.genesis = 'on';
  haptic('done');
  splashBurst(24, 'egg-star');
  setTheme('genesis');
  showToast({ title: 'Crystal', body: 'ครบทุกเหรียญแล้ว — ธีมสุดท้ายเปิดให้แล้ว' });
  return true;
}

// ---------- ALT 1A7V: ลูกเล่นของธีม Glitch ----------
// ธีมนี้แกล้งทำเป็นว่าแอปกำลังรวน — จอสั่น ตัวหนังสือเพี้ยน ระบบสะดุด และมีป้ายแจ้งข้อผิดพลาด
// **ทุกอย่างเป็นของปลอมทั้งหมด ไม่มีอะไรแตะข้อมูลจริงสักตัว** ตัวหนังสือที่เพี้ยนถูกเก็บต้นฉบับไว้
// แล้วคืนค่าเป๊ะ ๆ ทุกครั้ง · สลับธีมออกเมื่อไหร่ทุกอย่างกลับเป็นปกติทันที ไม่ต้องรีเฟรช
let glitchTimer = null, glitchErrTimer = null, glitchTxtTimer = null;
let glitchHeld = [];   // ตัวหนังสือที่กำลังถูกทำให้เพี้ยนอยู่ พร้อมต้นฉบับ

// ป้ายแจ้งข้อผิดพลาด — เป็นภาษาไทยและพูดถึงระบบของแอปเอง
// เขียนให้ดูเหมือนระบบภายในกำลังรวน ไม่ใช่ข้อความสุ่มที่อ่านไม่รู้เรื่อง
const GL_ERRORS = [
  'ตัวจัดลำดับงานตอบสนองช้ากว่าปกติ · กำลังลองใหม่',
  'อ่านรายการงานไม่สำเร็จ — ข้อมูลบางส่วนอาจไม่ตรง',
  'การเชื่อมต่อกับตัวช่วย AI ขาดช่วง',
  'คำนวณความสำคัญของงานไม่สมบูรณ์ · ข้ามไปก่อน',
  'นาฬิกาของเครื่องกับเซิร์ฟเวอร์ไม่ตรงกัน',
  'เขียนข้อมูลลงเครื่องช้าผิดปกติ',
  'ตารางเส้นทางโหลดไม่ครบ · แสดงเท่าที่มี',
  'ระบบแจ้งเตือนไม่ตอบสนอง',
];
function glMessage() { return GL_ERRORS[Math.floor(Math.random() * GL_ERRORS.length)]; }

function glitchError() {
  const phone = document.querySelector('.phone');
  if (!phone || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div');
  el.className = 'gl-err';
  el.setAttribute('aria-hidden', 'true');   // ไม่ให้โปรแกรมอ่านหน้าจออ่านออกมา มันไม่ใช่ข้อผิดพลาดจริง
  el.innerHTML = '<i>⚠</i><div class="b"><div class="h">&lt;&lt; SERVER INFO &gt;&gt;</div>'
    + '<div class="m">' + esc(glMessage()) + '</div></div>';
  phone.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

// ---------- ตัวหนังสือเพี้ยนเป็นช่วง ๆ ----------
const GL_CHARS = '▓▒░#@%&*<>/\\|_—=+เอกขคงจฉ0123456789';
function glScramble(s) {
  return [...s].map(c => (c === ' ' || Math.random() > 0.42) ? c
    : GL_CHARS[Math.floor(Math.random() * GL_CHARS.length)]).join('');
}
// เลือกเฉพาะตัวหนังสือที่อยู่บนจอที่เปิดอยู่ตอนนี้ และเป็นข้อความสั้น ๆ
const GL_TEXT_SEL = '.screen.on .page-title, .screen.on .mt-lb, .screen.on .rc-title,'
  + '.screen.on .at, .screen.on .sh-title, .screen.on .pe-tx b, .screen.on .mt-sub,'
  + '.screen.on .wg-title, .screen.on .bg-nm, .screen.on .tk-bal';

function glitchTextBurst() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = [...document.querySelectorAll(GL_TEXT_SEL)]
    .filter(e => e.children.length === 0 && e.textContent.trim().length > 1 && !e.dataset.glx);
  if (!els.length) return;
  // จับทีละ 2–4 ชิ้น ไม่ทำทั้งจอพร้อมกัน จะได้ดูเหมือนรวนเป็นจุด ไม่ใช่จอพัง
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n && els.length; i++) {
    const el = els.splice(Math.floor(Math.random() * els.length), 1)[0];
    const original = el.textContent;
    el.dataset.glx = '1';
    el.textContent = glScramble(original);
    glitchHeld.push({ el, original, shown: el.textContent });
  }
  // สลับไปมา 2 รอบก่อนคืนค่า ให้รู้สึกว่ากำลังพยายามซ่อมตัวเอง
  setTimeout(() => glitchHeld.forEach(h => {
    if (h.el.dataset.glx === '1' && h.el.textContent === h.shown) {
      h.el.textContent = glScramble(h.original);
      h.shown = h.el.textContent;
    }
  }), 150);
  setTimeout(glitchTextRestore, 480);
}

// คืนตัวหนังสือทุกชิ้นที่ค้างอยู่ — เช็คก่อนว่ายังเป็นข้อความที่เราเขียนไว้จริง
// ถ้าแอปวาดจอใหม่ระหว่างนั้น ข้อความจะไม่ใช่ของเราแล้ว ต้องไม่ไปเขียนของเก่าทับ
function glitchTextRestore() {
  glitchHeld.forEach(h => {
    if (h.el.dataset.glx !== '1') return;
    if (h.el.textContent === h.shown) h.el.textContent = h.original;
    delete h.el.dataset.glx;
  });
  glitchHeld = [];
}

// ---------- ระบบสะดุด ----------
// หน่วงภาพทั้งจอสั้น ๆ ให้เหมือนเครื่องค้าง แล้วปล่อย — ไม่ได้หยุดโค้ดจริง
// ใช้ CSS ล้วน ๆ จึงไม่มีทางไปค้างการทำงานของแอปหรือทำให้กดอะไรไม่ได้จริง
function glitchStutter() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.dataset.gstut = 'on';
  setTimeout(() => root.removeAttribute('data-gstut'), 260 + Math.random() * 220);
}

function glitchShake(strong) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  root.dataset.gfx = strong ? 'hard' : 'on';
  if (navigator.vibrate) { try { navigator.vibrate(strong ? [18, 40, 14, 30, 10] : [12, 40, 8]); } catch (_) {} }
  setTimeout(() => root.removeAttribute('data-gfx'), strong ? 620 : 400);
}

function glitchLoop(on) {
  [glitchTimer, glitchErrTimer, glitchTxtTimer].forEach(clearInterval);
  glitchTimer = glitchErrTimer = glitchTxtTimer = null;
  // คืนทุกอย่างให้เป็นปกติ — ธงบนราก ป้ายที่ค้าง และตัวหนังสือที่ยังเพี้ยนอยู่
  document.documentElement.removeAttribute('data-gfx');
  document.documentElement.removeAttribute('data-gstut');
  document.querySelectorAll('.gl-err').forEach(el => el.remove());
  glitchTextRestore();
  if (!on) return;

  // สั่นถี่ขึ้นกว่าเดิม และมีจังหวะแรงสลับมาเป็นครั้งคราว
  glitchTimer = setInterval(() => glitchShake(Math.random() < 0.35), 6500);
  // ตัวหนังสือเพี้ยนบ่อยที่สุด เพราะเป็นอาการที่เห็นชัดที่สุดบน UI จริง
  glitchTxtTimer = setInterval(() => {
    glitchTextBurst();
    if (Math.random() < 0.5) setTimeout(glitchStutter, 200);
  }, 4200);
  glitchErrTimer = setInterval(glitchError, 13_000);
  setTimeout(() => { glitchShake(true); glitchTextBurst(); }, 900);
  setTimeout(glitchError, 2600);
}

function applyGenesisUnlock() {
  if (genesisUnlocked()) document.documentElement.dataset.genesis = 'on';
  else delete document.documentElement.dataset.genesis;
}

// อีเวนต์ของธีม GENESIS: เดินเฉพาะตอนใช้ธีมนี้อยู่ ไม่งั้นปล่อย timer ทิ้งไว้กินแรงเปล่า
function genesisLoop(on) {
  clearInterval(genesisTimer); clearTimeout(genesisEndTimer);
  genesisTimer = null;
  document.documentElement.removeAttribute('data-gevent');
  if (!on) return;
  const fire = () => {
    document.documentElement.dataset.gevent = 'on';
    if (navigator.vibrate) { try { navigator.vibrate([18, 60, 26]); } catch (_) {} }
    genesisEndTimer = setTimeout(() => document.documentElement.removeAttribute('data-gevent'), GENESIS_EVENT);
  };
  genesisTimer = setInterval(fire, GENESIS_CYCLE);
}

function unlockSecret(id) {
  const s = SECRETS[id];
  if (!s) return;
  try { localStorage.setItem(s.store, '1'); } catch (_) {}
  applySecrets();
  tapCount = 0; tapTheme = '';
  haptic('done');
  splashBurst(18, s.fx);
  setTheme(s.theme);
  showToast({ title: s.title, body: s.body });
  setTimeout(checkBadges, 6500); // ธีมลับมีเหรียญของตัวเอง ตามมาทีหลังไม่ให้ทับ toast แรก
}

// เอฟเฟกต์กระเด็นตอนกดซ้ำ — ฟองน้ำ (ทะเล) หรือใบไม้ (โลก)
function splashBurst(n = 8, cls = 'egg-bub') {
  const phone = document.querySelector('.phone');
  if (!phone || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < n; i++) {
    const b = document.createElement('i');
    b.className = cls;
    const size = 6 + Math.random() * 16;
    b.style.width = b.style.height = size + 'px';
    b.style.left = (6 + Math.random() * 88) + '%';
    b.style.animationDuration = (1 + Math.random() * 0.9) + 's';
    b.style.animationDelay = (Math.random() * 0.25) + 's';
    phone.appendChild(b);
    setTimeout(() => b.remove(), 2600);
  }
}
function bubbleBurst(n = 8) { splashBurst(n, 'egg-bub'); }
const THEMES = Object.keys(THEME_NAME);

function themePref() {
  let v = null;
  try { v = localStorage.getItem(THEME_KEY); } catch (_) {}
  if (v === 'library') v = 'ocean'; // 1A6M3: ธีมห้องสมุดถูกแทนที่ — คนที่เคยเลือกไว้ไม่ต้องมาตั้งใหม่
  return THEMES.includes(v) ? v : 'system';
}
function systemDark() { return matchMedia('(prefers-color-scheme: dark)').matches; }

function applyTheme() {
  const pref = themePref();
  // "ตามระบบ" = สลับระหว่างโทนสว่างกับโทนมืดตามเครื่อง (อีก 2 โทนต้องเลือกเอง)
  const theme = pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = THEME_BAR[theme];
  document.querySelectorAll('#themePick button').forEach(b =>
    b.classList.toggle('active', b.dataset.th === pref));
  genesisLoop(theme === 'genesis'); // อีเวนต์ 99 วิ เดินเฉพาะตอนอยู่ในธีมนี้
  glitchLoop(theme === 'glitch');   // จอสั่น + ป้ายแดง เดินเฉพาะตอนอยู่ในธีม Glitch
  // ปุ่มธีมที่ยังไม่ได้เป็นเจ้าของต้องไม่โผล่ — เรียกทุกครั้งที่ธีมเปลี่ยน
  // เพราะ "ธีมที่ใช้อยู่" คือหนึ่งในเงื่อนไขที่ทำให้ปุ่มยังโผล่ได้
  if (typeof applyThemeLocks === 'function') applyThemeLocks();
  const now = document.getElementById('themeNow');
  if (now) now.textContent = pref === 'system' ? `ตามระบบ · ตอนนี้โทน${THEME_NAME[theme]}` : '';
}

function setTheme(pref) {
  // กันเลือกธีมที่ยังไม่ได้เป็นเจ้าของ (เช่นกดจากที่อื่นหรือค่าค้างใน localStorage)
  // ธีมที่ใช้อยู่ตอนนี้ผ่านได้เสมอ — ไม่ยึดของที่เขาใช้อยู่คืน
  if (typeof themeVisible === 'function' && pref !== 'system' && !themeVisible(pref)) {
    haptic('snooze');
    showToast({ title: 'ยังไม่มีธีมนี้', body: THEME_SHOP[pref] ? 'ซื้อได้ที่ร้านค้า' : 'ได้จากการสุ่มสกินในร้านค้า' });
    return;
  }
  // นับการกดซ้ำที่ปุ่มธีมที่มีของลับ — กดรัว ๆ ครบ 5 ครั้งแล้วปลดล็อก
  const secret = SECRETS[pref];
  if (secret) {
    const t = performance.now();
    tapCount = (tapTheme === pref && t - tapAt < 2500) ? tapCount + 1 : 1;
    tapTheme = pref; tapAt = t;
    if (!secretUnlocked(pref) && tapCount >= (secret.taps || 5)) { unlockSecret(pref); return; }
    // เอฟเฟกต์เล่นทุกครั้งที่กดซ้ำ ไม่ว่าจะปลดล็อกไปแล้วหรือยัง
    // (ปลดล็อกแล้วยังกดเล่นได้ ไม่งั้นพอปลดล็อกเสร็จปุ่มก็กลายเป็นปุ่มธรรมดาทันที)
    if (tapCount > 1) { haptic('arm'); splashBurst(3 + Math.min(tapCount, 6) * 3, secret.fx); }
  } else {
    tapCount = 0; tapTheme = '';
  }
  try { localStorage.setItem(THEME_KEY, THEMES.includes(pref) ? pref : 'system'); } catch (_) {}
  applyTheme();
}

// ผู้ใช้เลือก "ตามระบบ" แล้วเครื่องสลับธีมกลางทาง → เปลี่ยนตามทันที ไม่ต้องรีเปิดแอป
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (themePref() === 'system') applyTheme();
});

// ---------- ALT: ขนาดตัวอักษร ----------
// ดีไซน์เดิมกำหนดขนาดเป็น px ทุกจุด การขยับ font-size ที่ราก html จึงไม่มีผล
// ใช้ zoom กับกล่องเนื้อหาแทน — ตัวหนังสือ ไอคอน และระยะห่างขยายพร้อมกันทั้งชุด
// สัดส่วนจึงไม่เพี้ยน (แถบล่างกับกรอบเครื่องไม่โดน จะได้ไม่ล้นจอ)
const FONT_KEY = 'studentos.alt.fontScale';
const FONT_STEPS = { s: 0.92, m: 1, l: 1.12, xl: 1.26 };
const FONT_NAME = { s: 'เล็ก', m: 'ปกติ', l: 'ใหญ่', xl: 'ใหญ่มาก' };

function fontPref() {
  let v = null;
  try { v = localStorage.getItem(FONT_KEY); } catch (_) {}
  return FONT_STEPS[v] ? v : 'm';
}

function applyFontScale() {
  const key = fontPref();
  document.documentElement.style.setProperty('--fs', FONT_STEPS[key]);
  document.documentElement.dataset.fs = key;
}

function setFontScale(key) {
  try { localStorage.setItem(FONT_KEY, FONT_STEPS[key] ? key : 'm'); } catch (_) {}
  applyFontScale();
  renderAppearance();
}

// ---------- ALT: ตำแหน่งแถบเมนู (รองรับ iPad / แท็บเล็ต / PC) ----------
// จอกว้างแล้ววางแถบไว้ล่างสุดคือเสียพื้นที่แนวตั้งฟรี ๆ และนิ้ว/เมาส์ต้องวิ่งไกล
// จอกว้าง = ย้ายไปเป็นแถบตั้งด้านซ้าย · จอมือถือ = อยู่ด้านล่างเหมือนเดิม
// ผู้ใช้บังคับเองได้ในแท็บ "ฉัน" ถ้าไม่ชอบที่ระบบเลือกให้
const NAV_KEY = 'studentos.alt.nav';
const NAV_NAME = { auto: 'อัตโนมัติ', bottom: 'ด้านล่าง', side: 'ด้านซ้าย' };
// 760px ครอบไอแพดแนวตั้ง (768) ด้วย — ขนาดนั้นวางแถบไว้ล่างแล้วเหลือที่ว่างเยอะเกินไป
const NAV_WIDE = '(min-width: 760px)';

function navPref() {
  let v = null;
  try { v = localStorage.getItem(NAV_KEY); } catch (_) {}
  return NAV_NAME[v] ? v : 'auto';
}

function navMode() {
  const p = navPref();
  return p === 'auto' ? (matchMedia(NAV_WIDE).matches ? 'side' : 'bottom') : p;
}

function applyNav() {
  document.documentElement.dataset.nav = navMode();
  syncJourneyNow(); // ความกว้างจอเปลี่ยน → หมุดบนเส้นทางต้องคำนวณใหม่
}

function setNav(p) {
  try { localStorage.setItem(NAV_KEY, NAV_NAME[p] ? p : 'auto'); } catch (_) {}
  applyNav();
  renderAppearance();
}

// จอเปลี่ยนขนาด (หมุนไอแพด / ย่อหน้าต่าง) → สลับให้เองถ้าตั้งเป็นอัตโนมัติ
// ดักทั้ง matchMedia และ resize: บางกรณีหน้าต่างถูกปรับตอนแท็บไม่ได้แสดงผล
// แล้ว event ของ matchMedia ไม่ยิง ทำให้ค้างอยู่โหมดเดิมทั้งที่จอกว้างแล้ว
let navTimer = null;
const navRecheck = () => {
  if (navPref() !== 'auto') return;
  if (document.documentElement.dataset.nav !== navMode()) applyNav();
};
matchMedia(NAV_WIDE).addEventListener('change', navRecheck);
addEventListener('resize', () => { clearTimeout(navTimer); navTimer = setTimeout(navRecheck, 150); });
addEventListener('orientationchange', () => setTimeout(navRecheck, 250));
// กลับมาที่แอป / ถูกกู้จาก bfcache → เช็คซ้ำ
// จำเป็นจริง ๆ: ถ้าจอเปลี่ยนขนาดตอนแอปอยู่เบื้องหลัง event ทั้ง resize และ matchMedia จะไม่ยิงเลย
// เคยเจอกับตัว — ย่อหน้าต่างเหลือขนาดมือถือแล้วแถบซ้ายค้างอยู่ ทั้งที่ควรกลับไปอยู่ด้านล่าง
document.addEventListener('visibilitychange', () => { if (!document.hidden) navRecheck(); });
addEventListener('pageshow', navRecheck);

// ---------- ALT: พื้นหลังภาพของผู้ใช้เอง ----------
// เก็บเป็น data URL ใน localStorage — ย่อก่อนเสมอ (กว้างสุด 1280px, JPEG คุณภาพ .72)
// รูปจากกล้องมือถือดิบ ๆ ใหญ่เกินโควตา localStorage (~5MB) แน่นอน
const BG_KEY = 'studentos.alt.bg';
const BG_DIM_KEY = 'studentos.alt.bgDim';
const BG_MAX_W = 1280;

function bgDim() {
  const v = parseInt(localStorage.getItem(BG_DIM_KEY) || '55', 10);
  return isNaN(v) ? 55 : Math.max(0, Math.min(85, v));
}

function applyUserBg() {
  const el = document.getElementById('userBg');
  if (!el) return;
  let data = null;
  try { data = localStorage.getItem(BG_KEY); } catch (_) {}
  if (data) {
    el.style.backgroundImage = `url("${data}")`;
    document.documentElement.dataset.bg = 'on'; // การ์ดจะกลายเป็นกึ่งโปร่งให้เห็นภาพลอด
  } else {
    el.style.backgroundImage = '';
    delete document.documentElement.dataset.bg;
  }
  document.documentElement.style.setProperty('--bg-veil', bgDim() / 100);
}

function setBgDim(v) {
  try { localStorage.setItem(BG_DIM_KEY, String(v)); } catch (_) {}
  const lb = document.getElementById('bgDimVal');
  if (lb) lb.textContent = v + '%';
  document.documentElement.style.setProperty('--bg-veil', Math.max(0, Math.min(85, +v)) / 100);
}

function readUserBg(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const scale = Math.min(1, BG_MAX_W / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.72);
    try {
      localStorage.setItem(BG_KEY, data);
    } catch (_) {
      showToast({ title: 'ภาพใหญ่เกินไป 😅', body: 'ที่เก็บในเครื่องเต็ม — ลองเลือกภาพที่เล็กลงอีกหน่อย' });
      return;
    }
    applyUserBg();
    renderAppearance();
    haptic('done');
    showToast({ title: 'เปลี่ยนพื้นหลังแล้ว 🖼', body: 'ปรับ “ความจางของภาพ” ได้ถ้าตัวหนังสืออ่านยาก' });
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    showToast({ title: 'เปิดภาพนี้ไม่ได้', body: 'ลองเลือกไฟล์ภาพอื่น (JPG หรือ PNG)' });
  };
  img.src = url;
}

function clearUserBg() {
  try { localStorage.removeItem(BG_KEY); } catch (_) {}
  applyUserBg();
  renderAppearance();
  showToast({ title: 'เอาพื้นหลังออกแล้ว', body: 'กลับไปใช้พื้นหลังของธีมตามเดิม' });
}

// ปุ่ม/ป้ายในแท็บ "ฉัน" ที่เกี่ยวกับหน้าตา — เรียกหลังเปลี่ยนค่าใด ๆ
function renderAppearance() {
  // วิดเจ็ตหน้าแรก
  const wg = widgetPref();
  document.querySelectorAll('#wgPick button').forEach(b =>
    b.classList.toggle('active', b.dataset.wg === wg));
  const wgnow = document.getElementById('wgNow');
  if (wgnow) wgnow.textContent = WG_NAME[wg];
  const noteWrap = document.getElementById('wgNoteWrap');
  if (noteWrap) noteWrap.hidden = wg !== 'note';
  const noteIn = document.getElementById('wgNoteInput');
  if (noteIn && document.activeElement !== noteIn) noteIn.value = widgetNote();
  const photoWrap = document.getElementById('wgPhotoWrap');
  if (photoWrap) photoWrap.hidden = wg !== 'photo';
  const hasPhoto = !!widgetPhoto();
  const pdel = document.getElementById('wgPhotoDel');
  if (pdel) pdel.hidden = !hasPhoto;
  const plabel = document.getElementById('wgPhotoLabel');
  if (plabel) plabel.textContent = hasPhoto ? 'เปลี่ยนภาพ' : 'เลือกภาพ';

  const nav = navPref();
  document.querySelectorAll('#navPick button').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === nav));
  const nnow = document.getElementById('navNow');
  if (nnow) nnow.textContent = nav === 'auto'
    ? 'อัตโนมัติ · ตอนนี้อยู่' + NAV_NAME[navMode()] : NAV_NAME[nav];

  const fs = fontPref();
  document.querySelectorAll('#fontPick button').forEach(b =>
    b.classList.toggle('active', b.dataset.fs === fs));
  const fnow = document.getElementById('fontNow');
  if (fnow) fnow.textContent = FONT_NAME[fs] + (fs === 'm' ? '' : ' · ' + Math.round(FONT_STEPS[fs] * 100) + '%');

  const has = !!localStorage.getItem(BG_KEY);
  const bnow = document.getElementById('bgNow');
  if (bnow) bnow.textContent = has ? 'ใช้ภาพของคุณอยู่' : 'ยังไม่ได้ตั้ง';
  const del = document.getElementById('bgDel');
  if (del) del.hidden = !has;
  const dimWrap = document.getElementById('bgDimWrap');
  if (dimWrap) dimWrap.hidden = !has;
  const pickLabel = document.getElementById('bgPickLabel');
  if (pickLabel) pickLabel.textContent = has ? 'เปลี่ยนภาพ' : 'เลือกภาพ';
  const dim = document.getElementById('bgDim');
  if (dim) { dim.value = bgDim(); const l = document.getElementById('bgDimVal'); if (l) l.textContent = bgDim() + '%'; }
}

// ---------- navigation ----------
// ---------- ALT: ทิศทางของอนิเมชันเปลี่ยนจอ ----------
// จอระดับบนสุด = จอที่มีปุ่มของตัวเองอยู่บนแถบเมนู สลับกันไปมาได้อิสระ
// สลับระหว่างจอพวกนี้ = "แนวนอน" (จางสลับ) ไม่ใช่การเข้าไปข้างในหรือถอยออกมา
// เข้าไปจอที่ไม่มีบนแถบเมนู = "เข้า" (เลื่อนมาจากขวา) · กลับออกมา = "ถอย" (เลื่อนมาจากซ้าย)
// ทิศทางที่ตรงกับสิ่งที่เพิ่งกด ทำให้รู้ว่าตัวเองอยู่ตรงไหนของแอปโดยไม่ต้องอ่านหัวจอ
const TOP_SCREENS = ['scr-menu', 'scr-home', 'scr-tasks', 'scr-timeline', 'scr-profile'];
let curScreen = '';

function navDirection(from, to) {
  if (!from || from === to) return 'lat';
  const fromTop = TOP_SCREENS.includes(from), toTop = TOP_SCREENS.includes(to);
  if (fromTop && toTop) return 'lat';
  return toTop ? 'back' : 'fwd';
}

let enterTimer = null;

function go2(id){ return go(id); }
function go(id) {
  const dir = navDirection(curScreen, id);
  // ออกจากจอสุ่มเมื่อไหร่ ทิ้งผลรอบเดิม กลับเข้ามาจะได้เริ่มใหม่สะอาด ๆ
  if (id !== 'scr-wheel') { drawResults = []; drawOpen = []; }
  curScreen = id;
  document.body.dataset.godir = dir;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on', 'just-in'));
  const scr = document.getElementById(id);
  scr.classList.add('on');
  // เนื้อหาไล่ขึ้นทีละชิ้นเฉพาะตอน "เพิ่งเข้าจอ" เท่านั้น
  // renderAll() ถูกเรียกทุกครั้งที่ข้อมูลเปลี่ยน (ติ๊กงานเสร็จ ปัดการ์ด ซิงก์จาก cloud)
  // ถ้าไม่กันไว้ การ์ดทั้งจอจะไล่ขึ้นใหม่ทุกครั้งที่แตะอะไรสักอย่าง กระตุกและกวนสายตา
  clearTimeout(enterTimer);
  scr.classList.add('just-in');
  enterTimer = setTimeout(() => scr.classList.remove('just-in'), 520);
  // ซ่อนแถบล่างในจอที่ยังไม่ได้เข้าแอปจริง (บัญชี / ทำความรู้จัก)
  document.body.classList.toggle('login-mode', id === 'scr-login' || id === 'scr-onboard');
  document.querySelectorAll('.tab[data-scr]').forEach(b =>
    b.classList.toggle('active', b.dataset.scr === id));
  renderAll();
}

// ---------- cloud: Supabase auth + sync ----------
let sb = null, currentUser = null, syncTimer = null, lastSync = null;

function cloudConfigured() {
  const c = window.SUPABASE_CONFIG || {};
  return !!(c.url && c.anonKey) && typeof supabase !== 'undefined';
}

async function initCloud() {
  if (!cloudConfigured()) return;
  sb = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session ? session.user : null;
  sb.auth.onAuthStateChange((event, sess) => {
    const wasLoggedIn = !!currentUser;
    currentUser = sess ? sess.user : null;
    if (currentUser && !wasLoggedIn) {
      // เพิ่งล็อกอินเสร็จ (รวมถึงกลับมาจากหน้า Google)
      if ('Notification' in window && Notification.permission === 'granted') {
        subscribePush().catch(() => {}); // ผูก push กับบัญชีที่เพิ่งล็อกอิน
      }
      syncFromCloud().then(() => routeAfterLogin());
    } else {
      renderAll();
    }
  });
  if (currentUser) await syncFromCloud();
}

// ดึงข้อมูลจาก cloud มารวมกับในเครื่อง (รวมงานตาม id — ฝั่ง cloud ชนะเมื่อซ้ำ)
async function syncFromCloud() {
  if (!sb || !currentUser) return;
  try {
    const { data, error } = await sb.from('user_state')
      .select('data').eq('id', currentUser.id).maybeSingle();
    if (error) throw error;
    if (data && data.data) {
      const remote = data.data;
      const byId = {};
      for (const t of (state.tasks || [])) byId[t.id] = t;
      for (const t of (remote.tasks || [])) byId[t.id] = t;
      state.tasks = Object.values(byId);
      state.settings = Object.assign({}, state.settings, remote.settings || {});
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    }
    await pushToCloud(true);
    // ของที่บอท LINE หย่อนไว้ตอนแอปปิดอยู่ — ดึงมาทีเดียวตอนเปิด
    await loadLineLinks();
    await pullInbox();
    renderAll();
  } catch (e) { console.warn('[sync] pull failed:', e.message); }
}

// ส่งข้อมูลขึ้น cloud (debounce 1.5 วิ กันยิงถี่)
function pushToCloud(immediate) {
  if (!sb || !currentUser) return;
  const doPush = async () => {
    try {
      const { error } = await sb.from('user_state').upsert({
        id: currentUser.id,
        data: { tasks: state.tasks, settings: state.settings },
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      lastSync = new Date();
      renderProfile();
    } catch (e) { console.warn('[sync] push failed:', e.message); }
  };
  if (immediate) return doPush();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(doPush, 1500);
}

function loginGoogle() {
  if (!sb) { alert('ระบบบัญชียังไม่เปิดใช้งาน — ใช้แบบไม่ล็อกอินไปก่อนได้เลย'); return; }
  sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
}

function skipLogin() {
  localStorage.setItem('studentos.alt.skipLogin', '1');
  routeAfterLogin(); // ALT: ยังไม่รู้จักชื่อ → แวะหน้าทำความรู้จักก่อน
}

async function logout() {
  if (sb) await sb.auth.signOut();
  currentUser = null; lastSync = null;
  localStorage.removeItem('studentos.alt.skipLogin');
  go('scr-login');
}

// ---------- render ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// หัวเรื่องการ์ด: ไม่โชว์ "อื่น ๆ ·" ซ้ำซ้อนเวลาไม่ได้ระบุวิชา
function taskTitle(t) {
  const subj = t.subject && t.subject !== 'อื่น ๆ' ? esc(t.subject) + ' · ' : '';
  return subj + esc(t.detail);
}
// ไอคอน Lucide — เรียกใช้ซ้ำได้จาก <defs> ใน index.html
function icon(name, cls) {
  return `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#lu-${name}"/></svg>`;
}

// ---------- ALT: สั่นตอบมือ ----------
// จังหวะสั้น ๆ ให้รู้สึกว่า "เช็คสำเร็จ" จริง ไม่ใช่แค่ภาพเปลี่ยน
// done เป็นจังหวะคู่ (ติ๊ก—ตึง) เพราะเป็นการกระทำที่ควรได้ความรู้สึกดีคืนมามากที่สุด
const HAPTIC = { arm: 8, snooze: [10, 30, 10], done: [14, 38, 24] };
function haptic(kind) {
  if (!navigator.vibrate) return;
  try { navigator.vibrate(HAPTIC[kind] || 10); } catch (_) {}
}

// ป้าย "เลื่อน" — โผล่ข้างป้ายความสำคัญ บอกว่างานนี้ถูกปัดเลื่อนไว้ ไม่ได้หายไปไหน
// เลื่อนซ้ำหลายรอบจะมีตัวเลขต่อท้าย (สัญญาณว่ากำลังผัดวันประกันพรุ่งกับงานนี้)
function snoozeBadge(t) {
  if (!t.snoozedAt || t.done) return '';
  const n = t.snoozeCount || 1;
  return `<span class="tag snoozed">${icon('clock')}เลื่อน${n > 1 ? ' ×' + n : ''}</span>`;
}
// ---------- ALT: หน้าแรก = เมนูหลัก ----------
// รวมทางเข้าฟีเจอร์หลักไว้ที่เดียว กดแล้วเด้งไปเลย
// ตัวเลขบนไทล์เป็นข้อมูลจริงจาก state ไม่ใช่คำอธิบาย — หน้านี้ตั้งใจให้ไม่มีข้อความอธิบายเลย
function menuTile(cls, ic, label, sub, count, target) {
  return `<button class="mtile ${cls}" onclick="go('${target}')">
    <span class="mt-ic">${icon(ic)}</span>
    <span class="mt-tx"><span class="mt-lb">${label}</span><span class="mt-sub">${sub}</span></span>
    ${count != null ? `<span class="mt-ct">${count}</span>` : ''}
  </button>`;
}

// ---------- ALT 1A6M3: วิดเจ็ตบนหน้าแรก ----------
// ช่องบนสุดของหน้าแรกที่ผู้ใช้เลือกเองว่าจะให้แสดงอะไร
const WG_KEY = 'studentos.alt.widget';
const WG_NOTE_KEY = 'studentos.alt.widgetNote';
const WG_PHOTO_KEY = 'studentos.alt.widgetPhoto';
const WG_NAME = { urgent: 'งานด่วนที่สุด', note: 'โน้ตของฉัน', clock: 'เวลา', photo: 'ภาพของฉัน' };

function widgetPref() {
  let v = null;
  try { v = localStorage.getItem(WG_KEY); } catch (_) {}
  return WG_NAME[v] ? v : 'urgent';
}
function widgetNote() {
  try { return localStorage.getItem(WG_NOTE_KEY) || ''; } catch (_) { return ''; }
}
function widgetPhoto() {
  try { return localStorage.getItem(WG_PHOTO_KEY) || ''; } catch (_) { return ''; }
}

function setWidget(kind) {
  try { localStorage.setItem(WG_KEY, WG_NAME[kind] ? kind : 'urgent'); } catch (_) {}
  renderMenu();
  renderAppearance();
}

function saveWidgetNote() {
  const el = document.getElementById('wgNoteInput');
  if (!el) return;
  try { localStorage.setItem(WG_NOTE_KEY, el.value.slice(0, 240)); } catch (_) {}
  renderMenu();
}

// โน้ตแก้ได้จากตัววิดเจ็ตเลย ไม่ต้องเข้าไปที่ตั้งค่า
function saveWidgetNoteInline(el) {
  try { localStorage.setItem(WG_NOTE_KEY, el.value.slice(0, 240)); } catch (_) {}
  const s = document.getElementById('wgNoteInput');
  if (s) s.value = el.value;
}

function clearWidgetPhoto() {
  try { localStorage.removeItem(WG_PHOTO_KEY); } catch (_) {}
  renderMenu();
  renderAppearance();
  showToast({ title: 'เอาภาพออกแล้ว', body: 'เลือกภาพใหม่ได้ทุกเมื่อ' });
}

function widgetHtml(now) {
  const kind = widgetPref();

  if (kind === 'note') {
    return `<section class="wg wg-note">
      <div class="wg-head">${icon('pencil')}<span>โน้ตของฉัน</span></div>
      <textarea class="wg-note-in" maxlength="240" placeholder="แตะเพื่อจด…"
        oninput="saveWidgetNoteInline(this)">${esc(widgetNote())}</textarea>
    </section>`;
  }

  if (kind === 'clock') {
    const pending = sortByPriority(pendingTasks(), now);
    const next = pending.find(t => t.due && new Date(t.due) > now);
    return `<section class="wg wg-clock">
      <div class="wg-time mono" id="wgClock">${fmtClock(now)}</div>
      <div class="wg-date">${esc(fmtThaiDate(now))}</div>
      ${next ? `<div class="wg-next" id="wgNext">${esc(taskTitle(next))} · <b>${esc(humanLeft(new Date(next.due) - now))}</b></div>`
        : `<div class="wg-next" id="wgNext">ไม่มีกำหนดส่งที่ใกล้เข้ามา</div>`}
    </section>`;
  }

  if (kind === 'photo') {
    const src = widgetPhoto();
    if (!src) {
      return `<section class="wg wg-photo empty">
        <label class="wg-pick" for="wgPhotoInput2">${icon('image')}เลือกภาพของคุณ</label>
        <input type="file" id="wgPhotoInput2" accept="image/*" hidden>
      </section>`;
    }
    return `<section class="wg wg-photo" style="background-image:url('${src}')">
      <span class="wg-shade"></span>
      <div class="wg-photo-tx">${esc(who() ? 'สู้ ๆ นะ ' + who() : 'สู้ ๆ นะ')}</div>
    </section>`;
  }

  // urgent (ค่าเริ่มต้น)
  const pending = sortByPriority(pendingTasks(), now);
  const top = pending[0];
  if (!top) {
    return `<section class="wg wg-urgent clear">
      <div class="wg-head">${icon('check-circle')}<span>ไม่มีงานด่วน</span></div>
      <div class="wg-title">เคลียร์หมดแล้ว</div>
      <button class="wg-cta" onclick="go('scr-scan')">${icon('camera')}เพิ่มงานใหม่</button>
    </section>`;
  }
  const info = priorityInfo(top, now);
  const why = (info.reasons[0] || '').replace(/^★ /, '');
  const bits = [fmtDue(top.due, now, top), '~' + top.estMin + ' นาที',
    top.scorePct != null ? 'คะแนน ' + top.scorePct + '%' : null].filter(Boolean);
  return `<section class="wg wg-urgent ${priorityTone(info.stars)}">
    <div class="wg-head">${icon('flag')}<span>ควรทำก่อน</span>
      <span class="wg-pill">${esc(priorityLabel(info.stars))}</span></div>
    <div class="wg-title">${taskTitle(top)}</div>
    <div class="wg-meta">${esc(bits.join(' · '))} · ${esc(why)}</div>
    <button class="wg-cta" onclick="openForm('${top.id}')">${icon('chevron')}เปิดงานนี้</button>
  </section>`;
}

// ไทล์กล่องเข้า — วางกว้างเต็มแถวใต้ปุ่มเพิ่มงาน เพราะเป็นจอเดียวที่บอกว่า
// "มีของเข้ามาเองระหว่างที่คุณไม่ได้เปิดแอป" ตัวเลขค้างจึงต้องสะดุดตากว่าตัวเลขอื่น
function inboxTile() {
  const wait = typeof inboxPending === 'function' ? inboxPending().length : 0;
  return `<button class="mtile wide" onclick="go('scr-inbox')">
    <span class="mt-ic">${icon('chat')}</span>
    <span class="mt-tx"><span class="mt-lb">กล่องเข้า</span>
      <span class="mt-sub">ข้อความจาก LINE ที่รอตรวจ</span></span>
    <span class="mt-ct${wait ? ' hot' : ''}">${wait}</span>
  </button>`;
}

function renderMenu() {
  const body = document.getElementById('menuBody');
  if (!body) return;
  const now = new Date();
  const pending = pendingTasks();
  const live = liveTasks();
  const dated = pending.filter(t => t.due).length;
  const h = now.getHours();
  const greet = h < 11 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนค่ำ';

  const doneWeek = liveTasks().filter(t => t.done && t.doneAt &&
    (now - new Date(t.doneAt)) < 7 * 8.64e7).length;

  body.innerHTML = `<div class="menu-head">
      <div class="eyebrow mono">${esc(fmtThaiDate(now))}</div>
      <h1 class="page-title">${greet}${who() ? ', ' + esc(who()) : ''}</h1>
    </div>
    ${widgetHtml(now)}
    <div class="menu-grid">
      ${menuTile('hero', 'camera', 'เพิ่มงานใหม่', 'ถ่ายรูป · พูด · แปะข้อความ', null, 'scr-scan')}
      ${inboxTile()}
      ${menuTile('', 'calendar', 'ตารางงาน', 'ลำดับที่ AI แนะนำ', pending.length, 'scr-home')}
      ${menuTile('', 'check-circle', 'งานทั้งหมด', 'ค้าง · เสร็จ · ถังขยะ', live.length, 'scr-tasks')}
      ${menuTile('', 'pin', 'เส้นทาง', 'ไทม์ไลน์ถึงกำหนดส่ง', dated, 'scr-timeline')}
      ${menuTile('', 'user', 'ฉัน', 'ผลของฉัน · ธีม · ตั้งค่า', doneWeek ? doneWeek : null, 'scr-profile')}
    </div>`;
}

// ---------- ตารางงาน (เดิมคือหน้าแรก) ----------
// โครง: หัวข้อ → การ์ดสรุปของ AI → งาน 3 อันดับแรก → ทางไปงานที่เหลือ
// การ์ดสรุปคือที่เดียวที่ AI "พูด" ยาว ๆ ได้ การ์ดงานจึงเหลือแต่ข้อมูลดิบล้วน
function briefCard(pending, now) {
  const top = pending[0];
  const raw = aiGreeting(pending, state.settings, now);
  // เน้นชื่อวิชากับจำนวนชั่วโมง เพราะเป็นสองคำที่สายตาต้องจับให้ได้ก่อน
  let msg = esc(raw).replace(/~([\d.]+) ชม\./g, '<b>~$1 ชม.</b>');
  if (top && top.subject) msg = msg.replace(esc(top.subject), '<b>' + esc(top.subject) + '</b>');
  return `<div class="brief">
    <div class="brief-head"><span class="brief-mark">${icon('brand')}</span><b>STUDENTOS AI</b></div>
    <p class="brief-body">${msg}</p>
    <button class="brief-cta" onclick="go('scr-plan')">${icon('calendar')}ให้ AI วางแผนเวลาวันนี้</button>
  </div>`;
}

// การ์ดงานพร้อมเลขลำดับ — สีของเลขและป้ายมาจากระดับความสำคัญชุดเดียวกัน
function rankCard(t, n, now) {
  const info = priorityInfo(t, now);
  const tone = priorityTone(info.stars);
  const hot = info.urgency === 'over' || info.urgency === 'hot';
  const ti = TASK_TYPES[taskType(t)];
  const prog = Math.max(0, Math.min(100, t.progress || 0));
  // กำหนดส่งคือตัวตัดสินใจหลัก + อีกอย่างเดียวเท่านั้น ให้อยู่บรรทัดเดียวจบ
  const second = prog > 0 ? `ทำไป ${prog}%`
    : ti.schedulable ? `~${t.estMin} นาที`
    : t.scorePct != null ? `คะแนน ${t.scorePct}%` : '';
  const bits = [
    `<span class="mono ${hot ? 'hot' : ''}">${esc(fmtDue(t.due, now, t))}</span>`,
    second ? `<span>${esc(second)}</span>` : '',
  ].filter(Boolean);
  // ALT: การ์ดถูกห่อด้วย .swipe — ชั้นล่างคือปุ่มที่จะโผล่ตอนปัด (ดู initHomeSwipe)
  return `<div class="swipe">
    <div class="sw-act done" aria-hidden="true"><span class="sw-ic">${icon('check')}</span>ทำเสร็จแล้ว</div>
    <div class="sw-act snooze" aria-hidden="true">เลื่อนไปพรุ่งนี้<span class="sw-ic">${icon('clock')}</span></div>
    <div class="rank-card sw-card" data-id="${t.id}" onclick="openForm('${t.id}')">
      <span class="rank ${tone}">${n}</span>
      <div class="rc-body">
        <div class="rc-tags"><span class="tag ${tone}">${esc(priorityLabel(info.stars))}</span>${snoozeBadge(t)}</div>
        <div class="rc-title">${taskTitle(t)}</div>
        <div class="rc-meta">${bits.join('<i class="msep"></i>')}</div>
      </div>
      <button class="rc-check" onclick="event.stopPropagation();toggleDone('${t.id}',this)"
        aria-label="ทำเสร็จ">${icon('check')}</button>
    </div>
  </div>`;
}

function renderHome() {
  const body = document.getElementById('homeBody');
  if (!body) return;
  const now = new Date();
  const pending = sortByPriority(pendingTasks(), now);
  const doneCount = liveTasks().filter(t => t.done).length;
  const h = now.getHours();
  const greet = h < 11 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนค่ำ';
  const name = state.settings.name || 'นักเรียน';

  const head = `<div class="page-head">
    <div class="eyebrow mono">${esc(fmtThaiDate(now))}</div>
    <h1 class="page-title">ตารางงาน</h1>
    <p class="page-sub">งานค้าง <b>${pending.length}</b> · เสร็จแล้ว ${doneCount}
      · เวลาว่างวันนี้ ~${state.settings.freeHours || 2} ชม.</p>
  </div>`;

  if (!pending.length) { body.innerHTML = head + emptyDay(doneCount, now); return; }

  // ALT: การ์ดที่โชว์ = 3 อันดับแรกของ AI + งานที่ถูกปัดเลื่อนไว้ (สูงสุด 3)
  // งานที่เพิ่งเลื่อนลำดับจะตกลงไปท้ายแถวทันที ถ้าตัดที่ 3 เฉย ๆ คนปัดจะรู้สึกว่า "งานหายไป"
  // จึงดึงกลับขึ้นมาแสดงเสมอ พร้อมเลขลำดับจริงของมัน — ยังอยู่ แค่ถูกเลื่อน
  const top = pending.slice(0, 3);
  const snoozed = pending.slice(3).filter(t => t.snoozedAt).slice(0, 3);
  const rest = pending.length - top.length - snoozed.length;

  body.innerHTML = head + briefCard(pending, now)
    + `<div class="sec-label">ลำดับที่ AI แนะนำ</div>`
    + `<div class="sw-hint"><span class="l">ทำเสร็จ${icon('chevron')}</span>
        <span class="r">${icon('chevron')}เลื่อนพรุ่งนี้</span></div>`
    + top.map((t, i) => rankCard(t, i + 1, now)).join('')
    + (snoozed.length ? `<div class="sec-label soft">${icon('clock')}เลื่อนไว้ — ยังอยู่ในแผน</div>`
        + snoozed.map(t => rankCard(t, pending.indexOf(t) + 1, now)).join('') : '')
    + (rest > 0 ? `<button class="ghost-wide" onclick="go('scr-tasks')">
        ดูงานที่เหลืออีก ${rest} งาน${icon('chevron')}</button>` : '');
}

// ---------- ALT: วันที่ไม่มีงานค้าง ----------
// จอนี้เจอตอนที่ผู้ใช้ "ทำสำเร็จ" พอดี — เป็นโอกาสให้เขารู้สึกดีกับตัวเอง
// จึงไม่ปล่อยให้เป็นจอว่าง แต่พูดกับเขาตรง ๆ ว่าที่ว่างเพราะเคลียร์หมดแล้ว
// nm = ชื่อที่ผู้ใช้บอกไว้ตอนทำความรู้จัก (ว่างได้ ถ้ากดข้าม)
const CLEARED_COPY = nm => [
  { h: nm ? `เคลียร์หมดแล้ว ${nm} 🎉` : 'เคลียร์หมดแล้ว 🎉',
    p: `ไม่เหลืองานค้างสักงาน — เวลาที่เหลือของวันนี้เป็นของ${nm || 'คุณ'}ล้วน ๆ` },
  { h: 'ว่างจริง ไม่ได้ลืม',
    p: `ตรวจทุกงานให้แล้ว ไม่มีอะไรค้าง ${nm ? nm + ' ' : ''}พักได้แบบไม่ต้องแอบรู้สึกผิด` },
  { h: nm ? `เก่งมากวันนี้ ${nm} 💙` : 'เก่งมากวันนี้ 💙',
    p: 'งานหมดเกลี้ยง — จำความรู้สึกนี้ไว้ แล้วพรุ่งนี้ทำอีกรอบ' },
  { h: 'สบายใจได้เลย',
    p: `ทุกอย่างที่ต้องส่งถูกเคลียร์หมดแล้ว ${nm ? nm + ' ' : ''}เหลือแค่ไปพักให้เต็มที่` },
];
const FRESH_COPY = nm => [
  { h: nm ? `เริ่มวันแบบสบาย ๆ นะ ${nm}` : 'เริ่มวันแบบสบาย ๆ',
    p: 'ยังไม่มีงานในระบบ — ครูสั่งอะไรมา แปะข้อความหรือถ่ายรูปใบงานมาได้เลย' },
  { h: 'พร้อมรับงานแรกแล้ว',
    p: `เพิ่มงานเข้ามาสักงาน เดี๋ยว AI จัดลำดับให้${nm || 'คุณ'}เองว่าควรทำอะไรก่อน` },
];

function emptyDay(doneCount, now) {
  const cleared = doneCount > 0;
  const list = (cleared ? CLEARED_COPY : FRESH_COPY)(who());
  // สุ่มแบบคงที่ต่อวัน — เปิดแอปกี่รอบในวันเดียวกันก็เจอข้อความเดิม ไม่กระพริบไปมา
  const c = list[(now.getFullYear() + now.getMonth() * 31 + now.getDate() + doneCount) % list.length];
  const today = liveTasks().filter(t =>
    t.done && t.doneAt && new Date(t.doneAt).toDateString() === now.toDateString()).length;

  return `<section class="empty-wrap">
    <div class="empty-ring">${icon(cleared ? 'check-circle' : 'camera')}</div>
    <h3 class="empty-h">${c.h}</h3>
    <p class="empty-p">${c.p}</p>
    ${today ? `<div class="empty-stat">${icon('check-circle')}วันนี้ติ๊กไปแล้ว <b>${today}</b> งาน</div>` : ''}
    <button class="empty-cta" onclick="go('scr-scan')">${icon('camera')}เพิ่มงานใหม่</button>
    ${cleared ? `<button class="empty-2nd" onclick="setFilter('done');go('scr-tasks')">
      ดูงานที่ทำเสร็จแล้ว ${doneCount} งาน${icon('chevron')}</button>` : ''}
  </section>`;
}

// ---------- ALT: ปัดการ์ดงานในหน้าแรก ----------
// ปัดขวา = ทำเสร็จ · ปัดซ้าย = เลื่อนไปพรุ่งนี้
// เหตุผลที่ทำ: สองอย่างนี้คือสิ่งที่นักเรียนกดบ่อยที่สุด แต่เดิมต้องเปิดฟอร์มก่อน
// ทำด้วย Pointer Events ตัวเดียว → ใช้ได้ทั้งนิ้วบนมือถือและเมาส์บนคอม
// ตัวฟังเกาะที่ #homeBody (ไม่ใช่ที่การ์ด) เพราะ renderHome เขียนทับ innerHTML ทุกครั้ง
const SW_TRIGGER = 76;  // ปัดเกินนี้แล้วปล่อย = ทำจริง
const SW_SLOP = 8;      // ต้องขยับข้างเกินนี้ก่อน ถึงจะนับว่าตั้งใจปัด (กันชนกับการเลื่อนจอ)
const SW_FOLLOW = 140;  // เลยระยะนี้ให้การ์ดหนืดลง จะได้รู้สึกว่ามีขอบ
let swDrag = null;
// ปัดจบแล้วต้องกันไม่ให้ click เด้งเปิดฟอร์มตามมา — เก็บเป็น "เวลาที่เพิ่งปัดจบ" ไม่ใช่ธง
// เพราะบนมือถือการปัดมักไม่มี click ตามมาเลย ถ้าใช้ธงค้างไว้ มันจะไปกินการแตะครั้งถัดไปแทน
let swDoneAt = 0;
const SW_CLICK_GUARD = 400; // ms

function swEase(dx) {
  const m = Math.abs(dx);
  return Math.sign(dx) * (m <= SW_FOLLOW ? m : SW_FOLLOW + (m - SW_FOLLOW) * .35);
}

function swPaint(d) {
  const p = Math.min(1, Math.abs(d.dx) / SW_TRIGGER);
  // การ์ดอยู่ในกล่องที่ถูก zoom ตามขนาดตัวอักษร — หารกลับ ไม่งั้นการ์ดวิ่งเร็วกว่านิ้ว
  const z = FONT_STEPS[fontPref()] || 1;
  d.card.style.transform = `translateX(${swEase(d.dx) / z}px)`;
  d.wrap.querySelector('.sw-act.done').style.opacity = d.dx > 0 ? p : 0;
  d.wrap.querySelector('.sw-act.snooze').style.opacity = d.dx < 0 ? p : 0;
  const armed = p >= 1 ? Math.sign(d.dx) : 0;
  if (armed !== d.armed) {
    d.armed = armed;
    d.wrap.classList.toggle('armed', armed !== 0);
    // สั่นสั้น ๆ ตอนถึงระยะ = บอกว่า "ปล่อยได้แล้ว" โดยไม่ต้องละสายตาจากการ์ด
    if (armed) haptic('arm');
  }
}

function swReset(d) {
  d.card.style.transform = '';
  d.wrap.classList.remove('armed');
  d.wrap.querySelectorAll('.sw-act').forEach(a => { a.style.opacity = 0; });
}

// ปล่อยการ์ดให้ไหลออกนอกจอไปทางที่ปัด แล้วค่อยให้ renderAll วาดรายการใหม่
function swFlyOut(d, dir) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  d.wrap.classList.add('sw-out');
  d.card.style.transform = `translateX(${dir * (d.wrap.offsetWidth + 48)}px)`;
}

function swDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const card = e.target.closest && e.target.closest('.sw-card');
  if (!card || e.target.closest('.rc-check')) return; // ปุ่มติ๊กเสร็จยังกดได้ตามปกติ
  swDrag = { card, wrap: card.parentElement, id: card.dataset.id, pid: e.pointerId,
    x0: e.clientX, y0: e.clientY, dx: 0, on: false, armed: 0 };
  card.style.transition = 'none';
}

function swMove(e) {
  const d = swDrag;
  if (!d || e.pointerId !== d.pid) return;
  const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
  if (!d.on) {
    // ยังไม่ชี้ขาดว่าปัดข้างหรือเลื่อนจอ — รอจนกว่าแนวนอนจะชนะชัด ๆ
    if (Math.abs(dx) < SW_SLOP || Math.abs(dx) <= Math.abs(dy)) return;
    d.on = true;
    d.wrap.classList.add('sw-live');
    try { d.card.setPointerCapture(e.pointerId); } catch (_) {}
  }
  d.dx = dx;
  swPaint(d);
}

function swUp() {
  const d = swDrag;
  swDrag = null;
  if (!d) return;
  d.card.style.transition = '';
  d.wrap.classList.remove('sw-live');
  if (!d.on) return;              // แตะเฉย ๆ ไม่ได้ปัด → ปล่อยให้ onclick เปิดฟอร์มไปตามเดิม
  swDoneAt = performance.now();
  if (Math.abs(d.dx) < SW_TRIGGER) { swReset(d); return; }  // ปัดไม่ถึง = ดีดกลับ
  if (d.dx > 0) {
    swFlyOut(d, 1);
    toggleDone(d.id, d.card.querySelector('.rc-check')); // มีฉลอง + toast + วาดใหม่ให้แล้ว
  } else {
    swFlyOut(d, -1);
    snoozeToTomorrow(d.id);
  }
}

function swCancel() {
  const d = swDrag;
  swDrag = null;
  if (!d) return;
  d.card.style.transition = '';
  d.wrap.classList.remove('sw-live');
  if (d.on) swReset(d);
}

function initHomeSwipe() {
  const root = document.getElementById('homeBody');
  if (!root || !window.PointerEvent) return;
  root.addEventListener('pointerdown', swDown);
  root.addEventListener('pointermove', swMove, { passive: true });
  root.addEventListener('pointerup', swUp);
  root.addEventListener('pointercancel', swCancel);
  // เมาส์จะยิง click ตามหลังการปัดเสมอ — กินทิ้งเฉพาะที่เกิดขึ้นติด ๆ กับการปัดที่เพิ่งจบ
  root.addEventListener('click', e => {
    if (performance.now() - swDoneAt > SW_CLICK_GUARD) return;
    swDoneAt = 0;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}

// เลื่อนกำหนดส่งไปพรุ่งนี้ (คงเวลาเดิมของวัน)
// งานที่กำหนดส่งเลยพรุ่งนี้ไปแล้ว การตั้งเป็น "พรุ่งนี้" จะกลายเป็นเร่งให้เร็วขึ้น
// จึงเลื่อนออกไปอีก 1 วันจากกำหนดเดิมแทน — ปัดซ้ายจึงแปลว่า "ขอเวลาอีกวัน" เสมอ
function snoozeToTomorrow(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const prev = { due: t.due, snoozedAt: t.snoozedAt, snoozeCount: t.snoozeCount };
  const base = t.due ? new Date(t.due) : null;
  const tmr = new Date();
  tmr.setDate(tmr.getDate() + 1);
  if (base) tmr.setHours(base.getHours(), base.getMinutes(), 0, 0);
  else tmr.setHours(23, 59, 0, 0);
  const next = (base && base > tmr) ? new Date(base.getTime() + 864e5) : tmr;
  t.due = next.toISOString();
  t.remindedAt = null; t.remindedStage = null;  // กำหนดใหม่แล้ว ต้องเตือนใหม่ได้อีกครั้ง
  t.snoozedAt = new Date().toISOString();
  t.snoozeCount = (t.snoozeCount || 0) + 1;
  save();
  haptic('snooze');

  setTimeout(() => {
    renderAll();
    showToast({
      title: 'เลื่อนให้แล้ว — ยังอยู่ในแผน 🕓',
      body: (t.subject && t.subject !== 'อื่น ๆ' ? t.subject + ' — ' : '') +
        'กำหนดใหม่ ' + fmtDue(t.due, new Date(), t),
      undo: () => { Object.assign(t, prev); save(); renderAll(); },
    });
  }, 200);
}

// ---------- หน้างาน ----------
// 3 แท็บเท่านั้น: ค้างอยู่ · เสร็จแล้ว · ทั้งหมด
// ของที่ลบไม่หายทันที แต่ไปนอนในถังขยะที่ซ่อนไว้ท้ายหน้า กดเปิดเองได้
let taskFilter = 'pending'; // pending | done | all | bin
function setFilter(f) {
  taskFilter = f;
  renderTasks();
  const s = document.getElementById('scr-tasks');
  if (s) s.scrollTop = 0;
}

function taskRow(t, now) {
  const info = priorityInfo(t, now);
  const tone = priorityTone(info.stars);
  const hot = info.urgency === 'over' || info.urgency === 'hot';
  return `<div class="arow ${t.done ? 'done' : ''}">
    <button class="chk ${t.done ? 'on' : ''}" onclick="toggleDone('${t.id}',this)"
      aria-label="${t.done ? 'ทำเสร็จแล้ว' : 'ทำเสร็จ'}">${icon('check')}</button>
    <div class="ab" onclick="openForm('${t.id}')">
      <div class="at">${taskTitle(t)}</div>
      <div class="am">${t.done
        ? '<span>เสร็จแล้ว</span>'
        : `<span class="tag ${tone}">${esc(priorityLabel(info.stars))}</span>${snoozeBadge(t)}
           <span class="mono ${hot ? 'hot' : ''}">${esc(fmtDue(t.due, now, t))}</span>`}</div>
    </div>
  </div>`;
}

function renderTasks() {
  const el = document.getElementById('taskList');
  if (!el) return;
  const now = new Date();
  const live = liveTasks();
  const pending = sortByPriority(live.filter(t => !t.done), now);
  // งานที่เสร็จ: อันที่เพิ่งเสร็จอยู่บนสุด (ไม่มีเวลาเสร็จก็เรียงตามกำหนดส่ง)
  const done = live.filter(t => t.done)
    .sort((a, b) => (b.doneAt || b.due || '').localeCompare(a.doneAt || a.due || ''));
  const bin = state.tasks.filter(t => t.deleted);

  if (taskFilter === 'bin') { el.innerHTML = binView(bin); return; }

  const tab = (key, label, n) =>
    `<button class="${taskFilter === key ? 'active' : ''}" onclick="setFilter('${key}')">
      ${label}<span class="ct">${n}</span></button>`;
  const head = `<div class="page-head">
      <div class="eyebrow">รายการงาน</div>
      <h1 class="page-title">งานทั้งหมด</h1>
    </div>
    <div class="seg3">
      ${tab('pending', 'ค้างอยู่', pending.length)}
      ${tab('done', 'เสร็จแล้ว', done.length)}
      ${tab('all', 'ทั้งหมด', live.length)}
    </div>`;

  const rows = taskFilter === 'done' ? done
    : taskFilter === 'all' ? pending.concat(done) : pending;
  const empty = taskFilter === 'done' ? 'ยังไม่มีงานที่ทำเสร็จ'
    : taskFilter === 'all' ? 'ยังไม่มีงาน — กดปุ่มกลางแถบล่างเพื่อเพิ่ม'
    : 'ไม่มีงานค้างเลย — เคลียร์หมดแล้ว';

  el.innerHTML = head
    + (rows.length ? rows.map(t => taskRow(t, now)).join('') : `<div class="card empty">${empty}</div>`)
    + (bin.length ? `<button class="bin-btn" onclick="setFilter('bin')">
        ${icon('trash')}ถังขยะ · ${bin.length} รายการ</button>` : '');
}

// ---------- ถังขยะ ----------
function binView(bin) {
  const head = `<div class="bin-head">
      <button class="back" onclick="setFilter('pending')" aria-label="กลับ">${icon('chevron')}</button>
      <div style="flex:1;min-width:0">
        <div class="eyebrow">ที่เก็บของที่ลบ</div>
        <div class="page-title" style="font-size:21px;margin-top:2px">ถังขยะ</div>
      </div>
      ${bin.length ? `<div class="bin-act"><button class="del" onclick="emptyBin()">ล้างทั้งหมด</button></div>` : ''}
    </div>`;
  if (!bin.length) return head + `<div class="card empty">ถังขยะว่าง</div>`;
  const rows = bin
    .slice()
    .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''))
    .map(t => `<div class="arow done">
      <div class="ab" style="cursor:default">
        <div class="at">${taskTitle(t)}</div>
        <div class="am"><span>${esc(binWhen(t))}</span></div>
      </div>
      <div class="bin-act">
        <button onclick="restoreTask('${t.id}')">กู้คืน</button>
        <button class="del" onclick="purgeTask('${t.id}')" aria-label="ลบถาวร">${icon('trash')}</button>
      </div>
    </div>`).join('');
  return head + rows + `<p class="bin-note">ของในถังขยะจะถูกลบถาวรเองหลังครบ 30 วัน</p>`;
}

function binWhen(t) {
  if (!t.deletedAt) return 'ลบแล้ว';
  const d = new Date(t.deletedAt);
  const days = Math.floor((Date.now() - d) / 8.64e7);
  return days <= 0 ? 'ลบวันนี้' : days === 1 ? 'ลบเมื่อวาน' : `ลบเมื่อ ${days} วันก่อน`;
}

function restoreTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  delete t.deleted; delete t.deletedAt;
  save(); renderAll();
  showToast({ title: 'กู้คืนแล้ว ↩', body: taskTitle(t).replace(/<[^>]*>/g, '') });
}
function purgeTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  if (!confirm('ลบถาวร กู้คืนไม่ได้อีก แน่ใจนะ?')) return;
  state.tasks = state.tasks.filter(x => x.id !== id);
  save(); renderAll();
}
function emptyBin() {
  const n = state.tasks.filter(t => t.deleted).length;
  if (!n || !confirm(`ลบถาวรทั้ง ${n} รายการ กู้คืนไม่ได้อีก แน่ใจนะ?`)) return;
  state.tasks = liveTasks();
  save();
  setFilter('pending');
  renderAll();
}
// ล้างของที่นอนในถังขยะเกิน 30 วันทิ้งอัตโนมัติ (เรียกตอนเปิดแอป)
function purgeOldTrash() {
  const cut = Date.now() - 30 * 8.64e7;
  const before = state.tasks.length;
  state.tasks = state.tasks.filter(t => !(t.deleted && t.deletedAt && new Date(t.deletedAt) < cut));
  if (state.tasks.length !== before) save();
}

// ---------- เส้นเวลา ----------
// จัดกลุ่มตามวันจริง เรียงตามเวลาในวัน และบอกเวลาส่งไว้ริมเส้น
// ---------- ALT: เส้นเวลาแบบ "การเดินทาง" (แนวนอน) ----------
// อ่านเป็นเส้นทางที่กำลังเดินอยู่จริง: ถนนพาดซ้าย→ขวาตามเวลา · ป้ายจอด = งานที่ตั้งไว้
// หมุด "ตอนนี้" ซิงก์กับเวลาจริง ขยับเองทุก 30 วินาทีพร้อมนาฬิกาบนแถบสถานะ
// เลือกแนวนอนเพราะเวลาเป็นเส้นตรง — ระยะห่างระหว่างป้ายบอก "ว่างกี่วัน" ได้ในตาเดียว
const JR_DAY_W = 132;      // ความกว้างของ 1 วันบนถนน (px)
const JR_MAX_DAYS = 21;    // ไกลกว่านี้ไม่วาด ยาวเกินจนเลื่อนหาไม่เจอ
const JR_GAP = 78;         // ป้ายในเลนเดียวกันต้องห่างกันอย่างน้อยเท่านี้

const JR_PIN_ICON = { homework: 'type', exam: 'book', activity: 'calendar', reminder: 'clock' };

function humanLeft(ms) {
  if (ms < 0) return 'เลยมาแล้ว';
  const min = Math.round(ms / 60000);
  if (min < 60) return 'อีก ' + Math.max(1, min) + ' นาที';
  const h = Math.floor(min / 60);
  if (h < 24) return 'อีก ' + h + ' ชม.' + (min % 60 ? ' ' + (min % 60) + ' นาที' : '');
  return 'อีก ' + Math.round(h / 24) + ' วัน';
}

function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el) return;
  const now = new Date();
  const pending = pendingTasks();
  const dated = pending.filter(t => t.due).sort((a, b) => new Date(a.due) - new Date(b.due));
  const undated = pending.filter(t => !t.due);

  const head = `<div class="page-head">
      <div class="eyebrow mono">${esc(fmtThaiDate(now))}</div>
      <h1 class="page-title">เส้นทาง${who() ? 'ของ' + esc(who()) : 'ของวันนี้'}</h1>
      <p class="page-sub">ป้ายจอด <b>${dated.length}</b> งาน</p>
    </div>`;

  if (!dated.length) {
    el.innerHTML = head + `<section class="empty-wrap">
      <div class="empty-ring">${icon('flag')}</div>
      <h3 class="empty-h">เส้นทางยังโล่ง</h3>
      <p class="empty-p">${undated.length
        ? 'มีงานอยู่ ' + undated.length + ' งานแต่ยังไม่ได้ใส่วัน — ใส่กำหนดส่งแล้วจะขึ้นมาเป็นป้ายบนเส้นทางทันที'
        : 'ยังไม่มีงานที่มีกำหนดส่ง เพิ่มงานแล้วจะเห็นเป็นป้ายจอดเรียงตามเวลา'}</p>
      <button class="empty-cta" onclick="go('scr-scan')">${icon('camera')}เพิ่มงานใหม่</button>
    </section>`;
    return;
  }

  // ---- ขอบเขตของถนน ----
  const dayStart = atTime(now, 0, 0);
  let start = dayStart;
  let end = addDays(dayStart, 7);
  const firstDue = new Date(dated[0].due);
  if (firstDue < start) start = atTime(firstDue, 0, 0);       // มีงานเลยกำหนด → ถอยจุดเริ่มไปหามัน
  const lastDue = new Date(dated[dated.length - 1].due);
  if (atTime(lastDue, 0, 0) >= end) end = addDays(atTime(lastDue, 0, 0), 1);
  const hardEnd = addDays(start, JR_MAX_DAYS);
  let beyond = [];
  if (end > hardEnd) { end = hardEnd; beyond = dated.filter(t => new Date(t.due) >= end); }

  const span = end - start;
  const days = Math.max(1, Math.round(span / 8.64e7));
  const width = days * JR_DAY_W;
  const xOf = d => ((d - start) / span) * width;
  const meX = Math.max(0, Math.min(width, xOf(now)));

  // ---- หลักวัน ----
  let ticks = '';
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const diff = Math.round((atTime(d, 0, 0) - dayStart) / 8.64e7);
    const label = diff === 0 ? 'วันนี้' : diff === 1 ? 'พรุ่งนี้' : diff === -1 ? 'เมื่อวาน'
      : WEEKDAY_SHORT[d.getDay()] + ' ' + d.getDate();
    ticks += `<div class="jr-day${diff === 0 ? ' today' : ''}${diff < 0 ? ' past' : ''}"
      style="left:${xOf(d)}px"><i></i><span>${esc(label)}</span></div>`;
  }

  // ---- ป้ายจอด: สลับ 4 เลน (บน/ล่าง) กันป้ายทับกันเวลางานอยู่ใกล้กัน ----
  const laneX = [-9e9, -9e9, -9e9, -9e9];
  let stops = '';
  for (const t of dated) {
    const due = new Date(t.due);
    if (due >= end) continue;
    const x = xOf(due);
    let lane = laneX.findIndex(lx => x - lx > JR_GAP);
    if (lane < 0) lane = laneX.indexOf(Math.min(...laneX));
    laneX[lane] = x;
    const info = priorityInfo(t, now);
    const tone = priorityTone(info.stars);
    const type = taskType(t);
    const name = t.subject && t.subject !== 'อื่น ๆ' ? t.subject : t.detail;
    stops += `<button class="jr-stop lane${lane} ${tone}${due < now ? ' over' : ''}"
      data-x="${Math.round(x)}" style="left:${x}px" onclick="openForm('${t.id}')"
      aria-label="${esc(taskTitle(t))} ${esc(fmtDue(t.due, now, t))}">
      <span class="jr-bub"><b>${esc(name)}</b><i class="mono">${esc(dueClock(t))}</i></span>
      <span class="jr-leg"></span>
      <span class="jr-pin">${icon(JR_PIN_ICON[type] || 'pin')}</span>
    </button>`;
  }

  // ---- การ์ดบอกว่าป้ายถัดไปคืออะไร ----
  const late = dated.filter(t => new Date(t.due) < now);
  const next = dated.find(t => new Date(t.due) >= now);
  const nextCard = `<div class="jr-next${late.length ? ' late' : ''}">
    <span class="tile">${icon(late.length ? 'clock' : 'pin')}</span>
    <div class="bd">
      <div class="lb">${late.length ? 'เลยป้ายมาแล้ว ' + late.length + ' งาน' : 'ป้ายถัดไป'}</div>
      <div class="tx">${next
        ? esc(taskTitle(next)) + ' · <b>' + esc(humanLeft(new Date(next.due) - now)) + '</b>'
        : 'ผ่านป้ายสุดท้ายของช่วงนี้แล้ว'}</div>
    </div>
    ${next ? `<button class="go" onclick="openForm('${next.id}')" aria-label="เปิดงานนี้">${icon('chevron')}</button>` : ''}
  </div>`;

  const legend = `<div class="jr-legend">
    <span><i class="d red"></i>ด่วนมาก</span>
    <span><i class="d yellow"></i>สำคัญ–ปานกลาง</span>
    <span><i class="d green"></i>รอได้</span>
    <span><i class="d me"></i>ตำแหน่งตอนนี้</span>
  </div>`;

  const extras = (undated.length ? `<div class="jr-un">
      <div class="lb">ยังไม่ได้ใส่วัน — ยังไม่ขึ้นเส้นทาง</div>
      <div class="chips">${undated.map(t =>
        `<button onclick="openForm('${t.id}')">${esc(taskTitle(t))}</button>`).join('')}</div>
    </div>` : '')
    + (beyond.length ? `<p class="jr-far">อีก ${beyond.length} งานอยู่ไกลกว่า ${JR_MAX_DAYS} วัน — ดูได้ในแท็บ “งาน”</p>` : '');

  const insight = timelineInsight(pending, now);
  const note = insight ? `<div class="tl-note">
    <span class="tile">${icon('brand')}</span>
    <div style="flex:1;min-width:0">
      <div class="lb">วันงานชน</div>
      <div class="tx">${esc(insight)}</div>
    </div>
  </div>` : '';

  el.innerHTML = head + nextCard + legend + `
    <div class="jr" id="jrScroll">
      <div class="jr-track" id="jrTrack" data-start="${+start}" data-span="${span}" data-w="${width}"
        style="width:${width}px">
        <div class="jr-road"></div>
        <div class="jr-road done" id="jrDone" style="width:${meX}px"></div>
        ${ticks}
        <div class="jr-finish" style="left:${width}px">${icon('flag')}</div>
        ${stops}
        <div class="jr-me" id="jrMe" style="left:${meX}px">
          <span class="me-dot"></span><span class="me-lb mono">ตอนนี้ ${fmtClock(now)}</span>
        </div>
      </div>
    </div>`
    + extras + note;

  syncJourneyNow();
  // เลื่อนให้เห็นตำแหน่งปัจจุบันก่อนเสมอ (ไม่ใช่ต้นเส้นทางที่อาจเลยไปแล้ว)
  const sc = document.getElementById('jrScroll');
  if (sc) setTimeout(() => { sc.scrollLeft = Math.max(0, meX - sc.clientWidth * 0.34); }, 0);
}

// ขยับหมุด "ตอนนี้" ตามเวลาจริง โดยไม่ต้องวาดเส้นทางใหม่ทั้งเส้น
function syncJourneyNow() {
  const track = document.getElementById('jrTrack');
  if (!track) return;
  const start = +track.dataset.start, span = +track.dataset.span, w = +track.dataset.w;
  if (!span) return;
  const x = Math.max(0, Math.min(1, (Date.now() - start) / span)) * w;
  const me = document.getElementById('jrMe');
  if (me) {
    me.style.left = x + 'px';
    const lb = me.querySelector('.me-lb');
    if (lb) lb.textContent = 'ตอนนี้ ' + fmtClock(new Date());
  }
  const done = document.getElementById('jrDone');
  if (done) done.style.width = x + 'px';
  track.querySelectorAll('.jr-stop').forEach(s => s.classList.toggle('passed', +s.dataset.x <= x));
}

// เวลาส่งสำหรับริมเส้น — 23:59 คือ "ไม่ได้ระบุเวลา" จึงเขียนว่าทั้งวัน
function dueClock(t) {
  if (!t.due) return '—';
  const d = new Date(t.due);
  return (d.getHours() === 23 && d.getMinutes() === 59) ? 'ทั้งวัน' : fmtClock(d);
}

// ---------- แผนวันนี้ (โครง Refined: เวลาซ้าย · การ์ดขวา · พักเป็นบล็อกจาง) ----------
function renderPlan() {
  const list = document.getElementById('planList');
  const sub = document.getElementById('planSub');
  if (!list) return;
  const now = new Date();
  const pending = pendingTasks();
  if (!pending.length) {
    sub.textContent = '';
    list.innerHTML = `<div class="card empty">ไม่มีงานค้าง — วันนี้พักได้เต็มที่ 🎉</div>`;
    return;
  }
  const plan = buildDayPlan(pending, state.settings, now);
  sub.textContent = `เวลาว่าง ${state.settings.freeHours || 2} ชม. · ใช้จริง ${Math.round(plan.usedMin / 6) / 10} ชม.`;

  let html = '';
  for (const e of plan.events) {
    html += `<div class="pslot">
      <div class="ptime"><span class="s">${fmtClock(new Date(e.due))}</span></div>
      <div class="brk">${icon('calendar')}${esc(taskTitle(e))}</div>
    </div>`;
  }
  for (const s of plan.slots) {
    if (s.break) {
      html += `<div class="pslot">
        <div class="ptime"><span class="s">${fmtClock(s.start)}</span></div>
        <div class="brk">${icon('clock')}พัก ${s.min} นาที</div>
      </div>`;
    } else {
      const info = priorityInfo(s.task, now);
      const lv = info.stars >= 5 ? 'lv5' : info.stars >= 4 ? 'lv4' : '';
      html += `<div class="pslot">
        <div class="ptime"><span class="s">${fmtClock(s.start)}</span><span class="e">${fmtClock(s.end)}</span></div>
        <div class="work ${lv}">
          <div class="tm">
            <span class="nbadge ${lv}">${esc(priorityLabel(info.stars))}</span>
            <span class="ndue">${s.min} นาที</span>
          </div>
          <div class="tt">${taskTitle(s.task)}</div>
          ${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}
        </div>
      </div>`;
    }
  }
  if (plan.overflow.length) {
    html += `<div class="povf">
      <div class="povf-head">${icon('clock')}<span>เวลาวันนี้ไม่พอ — ย้ายไปพรุ่งนี้</span></div>
      ${plan.overflow.map(o => `<div class="it">
        <div class="tt">${taskTitle(o.task)}</div>
        <div class="ln">ต้องใช้ ~${o.need} นาที · ${fmtDue(o.task.due, now, o.task)}</div>
      </div>`).join('')}
    </div>`;
  }
  if (!plan.slots.length && !plan.events.length) {
    html += `<div class="card empty">วันนี้ไม่มีอะไรต้องนั่งทำ — พักได้เต็มที่ 🎉</div>`;
  }
  list.innerHTML = html;
}

function renderProfile() {
  const now = new Date();
  const pending = pendingTasks();
  const done = liveTasks().filter(t => t.done).length;
  const name = state.settings.name || (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || 'นักเรียน';
  const pic = currentUser && currentUser.user_metadata && (currentUser.user_metadata.avatar_url || currentUser.user_metadata.picture);

  // รูปที่ตั้งเองมาก่อนรูปจากบัญชี Google — ผู้ใช้เลือกเองย่อมตั้งใจกว่า
  const mine = userAvatar();
  const av = document.getElementById('pfAv');
  if (av) {
    av.innerHTML = (mine || pic)
      ? `<img src="${esc(mine || pic)}" alt="">`
      : esc(name.trim().charAt(0).toUpperCase() || 'N');
    av.classList.toggle('has-img', !!(mine || pic));
  }
  // ปุ่มเอารูปออก โผล่เฉพาะคนที่ตั้งรูปเองไว้ (รูปจากบัญชี Google เอาออกที่นี่ไม่ได้)
  const avDel = document.getElementById('avDel');
  if (avDel) avDel.hidden = !mine;
  const avLabel = document.getElementById('avPickLabel');
  if (avLabel) avLabel.textContent = mine ? 'เปลี่ยนรูป' : 'เลือกรูป';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('pfNm', name);
  set('pfSb', currentUser ? (currentUser.email || 'ซิงก์ข้ามเครื่องอยู่') : 'ยังไม่ล็อกอิน — ข้อมูลอยู่ในเครื่องนี้');
  set('pfDone', done);
  set('pfFree', (state.settings.freeHours || 2) + ' ชม.');
  set('pfPending', pending.length);

  // บัญชี
  const acc = document.getElementById('accountCard');
  if (acc) {
    if (!cloudConfigured()) {
      acc.innerHTML = '';
    } else if (currentUser) {
      acc.innerHTML = `<button class="pf-quiet" onclick="logout()">${icon('chevron')}ออกจากระบบ</button>`;
    } else {
      acc.innerHTML = `<button class="btn google" onclick="loginGoogle()"><span class="g-badge">G</span>เข้าสู่ระบบเพื่อซิงก์ข้ามเครื่อง</button>`;
    }
  }

  applyTheme(); // ให้ปุ่มธีมที่เลือกไว้สว่างตรงกับที่ใช้จริงเสมอ
  renderAppearance(); // ALT: ขนาดตัวอักษร + พื้นหลังภาพของผู้ใช้
  // ปุ่มล็อกธีมลับกลับ โผล่เฉพาะคนที่ปลดล็อกไปแล้วอย่างน้อยหนึ่งอัน
  // (นับ GENESIS กับเหรียญที่เปิดด้วยโค้ดด้วย ไม่งั้นเปิดครบแล้วกลับไม่มีปุ่มให้ล็อกคืน)
  const rel = document.getElementById('relockBtn');
  if (rel) rel.hidden = !(Object.keys(SECRETS).some(id => secretUnlocked(id))
    || genesisUnlocked() || allBadgesGranted());
  // ช่องใส่โค้ด — มีเฉพาะรุ่นที่ผูกไว้ใน CODE_VERSION
  const codeRow = document.getElementById('codeRow');
  if (codeRow) codeRow.hidden = !codesLive();
  // ตัวเลขบนปุ่มทางเข้าใหญ่ 3 ปุ่ม
  const pb = document.getElementById('peBadgeCt');
  if (pb) pb.textContent = badgesEarned().length + ' จาก ' + BADGES.length + ' เหรียญ';
  const pf2 = document.getElementById('peFriendCt');
  if (pf2) pf2.textContent = friends().length ? friends().length + ' คนในรายการ' : 'ยังไม่มีใครในรายการ';
  const ps = document.getElementById('peShopCt');
  if (ps) {
    const st = loginStreak();
    ps.textContent = tokenBalance() + ' โทเคน'
      + (st > 1 ? ' · เปิดติดกัน ' + st + ' วัน' : '');
  }
  const ver = document.getElementById('appVer');
  if (ver) ver.textContent = 'StudentOS ' + APP_CHANNEL + ' Version ' + APP_VERSION
    + ' “' + APP_CODENAME + '” · รุ่นทดลองฟีเจอร์';
  const pn = document.getElementById('pName'); if (pn) pn.value = state.settings.name || '';
  const pf = document.getElementById('pFree'); if (pf) pf.value = state.settings.freeHours || 2;

  // การแจ้งเตือน
  const st = document.getElementById('notifStatus');
  const nb = document.getElementById('notifBtn');
  const ntest = document.getElementById('notifTest');
  // ปุ่มทดสอบโผล่เฉพาะตอนอนุญาตแล้ว — ให้กดพิสูจน์ได้ว่าเด้งจริงบนเครื่องนี้
  if (ntest) ntest.style.display =
    ('Notification' in window && Notification.permission === 'granted') ? 'block' : 'none';
  if (!st) return;
  if (!('Notification' in window)) {
    if (isIOS() && !isStandalone()) {
      st.textContent = 'ต้องติดตั้งเป็นแอปก่อน';
      if (nb) { nb.style.display = 'block'; nb.textContent = 'วิธีติดตั้ง'; }
    } else {
      st.textContent = 'เบราว์เซอร์นี้ไม่รองรับ';
      if (nb) nb.style.display = 'none';
    }
  } else if (Notification.permission === 'granted') {
    if (pushState === 'on' && currentUser) st.textContent = 'เตือนก่อนถึงกำหนด แม้ปิดแอป';
    else if (pushState === 'on') st.textContent = 'เตือนตอนเปิดแอป · ล็อกอินเพื่อเตือนแม้ปิดแอป';
    else st.textContent = 'เตือนตอนเปิดแอป';
    if (nb) nb.style.display = (pushState === 'on' || pushState === 'unsupported') ? 'none' : 'block';
  } else if (Notification.permission === 'denied') {
    st.textContent = 'ถูกปิดไว้ในเบราว์เซอร์';
    if (nb) nb.style.display = 'none';
  } else {
    st.textContent = 'ยังไม่ได้เปิด';
    if (nb) { nb.style.display = 'block'; nb.textContent = 'เปิด'; }
  }
}

// ---------- ALT 1A6M3: ระบบเพื่อน (เฟสแรก) ----------
// ยังไม่มีตารางฝั่งเซิร์ฟเวอร์สำหรับเพื่อน จึงทำให้ใช้งานได้จริงวันนี้ด้วยการ
// "แลกรหัสสถานะ" กันตรง ๆ — ก๊อปรหัสของตัวเองส่งให้เพื่อน แล้ววางรหัสของเพื่อนกลับมา
// ไม่ต้องรอ backend และไม่มีข้อมูลใครถูกส่งไปไหนโดยที่เจ้าตัวไม่ได้กดเอง
function friends() {
  state.settings = state.settings || {};
  if (!Array.isArray(state.settings.friends)) state.settings.friends = [];
  return state.settings.friends;
}

// สถานะของเราแบบย่อ — เอาไปทำเป็นรหัสให้เพื่อน
function myStatus() {
  const now = new Date();
  const live = liveTasks();
  const done = live.filter(t => t.done);
  return {
    n: who() || 'เพื่อน',
    p: live.filter(t => !t.done).length,
    d7: done.filter(t => t.doneAt && (now - new Date(t.doneAt)) < 7 * 8.64e7).length,
    d: done.length,
    u: now.toISOString(),
  };
}

function myShareCode() {
  try {
    const json = JSON.stringify(myStatus());
    return 'SOS1.' + btoa(unescape(encodeURIComponent(json)));
  } catch (_) { return ''; }
}

function parseShareCode(code) {
  const raw = String(code || '').trim();
  if (!raw.startsWith('SOS1.')) return null;
  try {
    const json = decodeURIComponent(escape(atob(raw.slice(5))));
    const o = JSON.parse(json);
    if (!o || typeof o.n !== 'string') return null;
    return o;
  } catch (_) { return null; }
}

async function copyMyCode() {
  const code = myShareCode();
  try {
    await navigator.clipboard.writeText(code);
    haptic('arm');
    showToast({ title: 'ก๊อปรหัสแล้ว 📋', body: 'ส่งให้เพื่อนวางในหน้า “เพื่อน” ของเขาได้เลย' });
  } catch (_) {
    // เบราว์เซอร์ไม่ให้ก๊อปอัตโนมัติ → โชว์ให้เลือกเอง
    const box = document.getElementById('frMyCode');
    if (box) { box.hidden = false; box.value = code; box.select(); }
  }
}

function addFriendCode() {
  const el = document.getElementById('frInput');
  const o = parseShareCode(el && el.value);
  if (!o) {
    showToast({ title: 'รหัสไม่ถูกต้อง', body: 'ต้องเป็นรหัสที่ขึ้นต้นด้วย SOS1. ที่เพื่อนก๊อปมาให้' });
    return;
  }
  const list = friends();
  const i = list.findIndex(f => f.n === o.n);
  if (i >= 0) list[i] = o; else list.push(o);
  save();
  if (el) el.value = '';
  haptic('done');
  renderFriends(); renderTabBadges();
  showToast({ title: (i >= 0 ? 'อัปเดตสถานะของ ' : 'เพิ่มเพื่อนแล้ว: ') + o.n, body: 'เห็นงานค้างและผลของเขาในหน้าเพื่อนแล้ว' });
}

function removeFriend(name) {
  state.settings.friends = friends().filter(f => f.n !== name);
  save();
  renderFriends();
}

function friendAgo(iso) {
  if (!iso) return 'ไม่รู้เวลา';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 2) return 'เมื่อครู่';
  if (m < 60) return m + ' นาทีที่แล้ว';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' ชม.ที่แล้ว';
  return Math.round(h / 24) + ' วันที่แล้ว';
}

function renderFriends() {
  const body = document.getElementById('friendsBody');
  if (!body) return;
  const me = myStatus();
  const list = friends().slice().sort((a, b) => (b.d7 || 0) - (a.d7 || 0));
  const board = [{ ...me, me: true }, ...list].sort((a, b) => (b.d7 || 0) - (a.d7 || 0));
  const peak = Math.max(1, ...board.map(f => f.d7 || 0));

  body.innerHTML = `<div class="page-head">
      <div class="eyebrow mono">${esc(fmtThaiDate(new Date()))}</div>
      <h1 class="page-title">เพื่อน</h1>
      <p class="page-sub">แลกรหัสสถานะกัน แล้วดูว่าใครเคลียร์งานไปถึงไหน</p>
    </div>

    <div class="fr-me">
      <div class="fr-me-h">${icon('user')}รหัสสถานะของฉัน</div>
      <p class="fr-me-p">ก๊อปส่งให้เพื่อน — ในรหัสมีแค่ชื่อเล่น จำนวนงานค้าง และจำนวนงานที่เสร็จ</p>
      <button class="fr-copy" onclick="copyMyCode()">${icon('check')}ก๊อปรหัสของฉัน</button>
      <textarea class="fr-code" id="frMyCode" rows="2" readonly hidden></textarea>
    </div>

    <div class="fr-add">
      <label for="frInput">วางรหัสของเพื่อน</label>
      <textarea id="frInput" rows="2" placeholder="SOS1.…"></textarea>
      <button class="fr-add-btn" onclick="addFriendCode()">${icon('users')}เพิ่ม / อัปเดตเพื่อน</button>
    </div>

    <div class="sec-label">กระดานเทียบผล 7 วัน</div>
    ${board.map(f => `<div class="fr-card${f.me ? ' me' : ''}">
      <div class="fr-av">${esc((f.n || '?').slice(0, 1))}</div>
      <div class="fr-bd">
        <div class="fr-nm">${esc(f.n)}${f.me ? '<span class="fr-tag">คุณ</span>' : ''}</div>
        <div class="fr-st">งานค้าง <b>${f.p ?? '—'}</b> · เสร็จ 7 วัน <b>${f.d7 ?? '—'}</b> · รวม ${f.d ?? '—'}</div>
        <div class="fr-bar"><i style="width:${Math.round((f.d7 || 0) / peak * 100)}%"></i></div>
        <div class="fr-ago">${f.me ? 'อัปเดตสด' : 'ข้อมูล ' + esc(friendAgo(f.u))}</div>
      </div>
      ${f.me ? '' : `<button class="fr-del" onclick="removeFriend('${esc(f.n).replace(/'/g, "\\'")}')"
        aria-label="เอาออก">${icon('trash')}</button>`}
    </div>`).join('')}

    ${list.length ? '' : `<p class="fr-note">ยังไม่มีเพื่อนในรายการ — ส่งรหัสของคุณให้เพื่อนก่อน
      แล้วขอรหัสของเขามาวางตรงช่องด้านบน · สถานะเป็นภาพนิ่ง ณ เวลาที่แลกรหัสกัน ไม่ได้อัปเดตเอง</p>`}`;
}

// ---------- ALT 1A6M3: เหรียญตรา ----------
// เงื่อนไขคำนวณสด ๆ จาก state — ไม่ต้องเก็บสถานะ "ได้แล้ว" ให้หลุดกันเอง
// เก็บแค่ว่า "เคยเห็นแล้วหรือยัง" ไว้เด้งฉลองครั้งแรกครั้งเดียว
// คำบรรยายเป็นคำเปรย ๆ ไม่บอกวิธีได้มา โดยเฉพาะเหรียญพิเศษ 3 อันท้าย
const BADGES = [
  { id: 'hello', tone: 'b1', mark: 'I', name: 'โอ้..สวัดดี!',
    desc: 'ก้าวแรกที่นับได้จริง', goal: 1 },
  { id: 'try', tone: 'b2', mark: 'C', name: 'ฉันพึ่งลองใช้ StudentOS',
    desc: 'เริ่มจับจังหวะของตัวเองได้แล้ว', goal: 10 },
  { id: 'hard', tone: 'b3', mark: 'M', name: 'การบ้านนี่มันลำบากจริง ๆ',
    desc: 'ผ่านมาหลายคืนกว่าจะถึงตรงนี้', goal: 25 },
  { id: 'nah', tone: 'b4', mark: 'V', name: 'คุณจะเลิกทำการบ้านไหม? Nah I\'d ทำการบ้าน',
    desc: 'ยืนยันคำตอบเดิมทุกครั้งที่ถูกถาม', goal: 75 },
  { id: 'unstoppable', tone: 'b5', mark: 'X', name: 'หยุดไม่ได้แล้ว!',
    desc: 'กลายเป็นนิสัยไปแล้วเรียบร้อย', goal: 100 },
  { id: 'deep', tone: 'sea', mark: '≡', name: 'Challenger Deep',
    desc: 'ลงไปได้ลึกกว่าที่ควรจะเป็น', secret: 'ocean' },
  { id: 'tree', tone: 'tree', mark: '✦', name: 'World Tree',
    desc: 'ยังมีลมพัดอยู่ตรงนั้นเสมอ', secret: 'earth' },
  { id: 'sophyra', tone: 'sweet', mark: '✧', name: 'Sophyra',
    desc: 'บางอย่างสวยเกินกว่าจะเป็นเรื่องบังเอิญ', secret: 'galaxy' },
  // เหรียญปลายทาง — ผูกกับการปลดล็อกธีม Crystal (ซึ่งต้องได้เหรียญอื่นครบก่อน)
  { id: 'genesis', tone: 'genesis', mark: '◆', name: 'Crystal',
    desc: 'จุดที่ทุกอย่างเริ่มต้นใหม่อีกครั้ง', genesis: true },
  // เหรียญของธีมระดับลับ — ชื่อโผล่ให้ทุกคนเห็น แต่คำบรรยายขึ้น "— — —" จนกว่าจะได้
  // ติด postGenesis ไว้เพื่อ **ไม่ให้ไปนับรวมในเงื่อนไขปลดล็อก Crystal**
  // ไม่งั้น Crystal จะกลายเป็นของที่ต้องรอสุ่มระดับลับก่อน ซึ่งไม่ใช่กติกาเดิม
  { id: 'metaworld', tone: 'meta', mark: '◇', name: 'MetaWorld!',
    desc: 'โลกทั้งใบถูกสร้างขึ้นมา ไม่มีอะไรจริงสักอย่าง แต่ก็ยืนอยู่บนนั้นได้',
    skin: 'meta', postGenesis: true },
  { id: 'err404', tone: 'glitch', mark: '!', name: 'Erorr 404',
    desc: 'ไม่พบสิ่งที่ตามหา — แต่ไปเจออย่างอื่นเข้าแทน',
    skin: 'glitch', postGenesis: true },
];

function doneCount() { return liveTasks().filter(t => t.done).length; }

// โค้ดในหน้าตั้งค่าเปิดเหรียญได้ทั้งแผงรวดเดียว — เก็บเป็นธงใบเดียว
// ไม่ไปปลอมจำนวนงานที่ทำเสร็จ ตัวเลข "ผลของฉัน" จึงยังเป็นของจริงอยู่
const ALLBADGE_KEY = 'studentos.alt.allBadges';
function allBadgesGranted() {
  try { return localStorage.getItem(ALLBADGE_KEY) === '1'; } catch (_) { return false; }
}

function badgeEarned(b) {
  if (b.skin) return themeOwned(b.skin);   // เหรียญธีมลับ — ต้องได้ธีมนั้นมาจริง ๆ เท่านั้น
  if (allBadgesGranted()) return true;
  if (b.genesis) return genesisUnlocked();
  if (b.secret) return secretUnlocked(b.secret);
  return doneCount() >= b.goal;
}
function badgesEarned() { return BADGES.filter(badgeEarned); }

// เด้งฉลามเหรียญใหม่ครั้งเดียวต่อเหรียญ
function checkBadges() {
  state.settings = state.settings || {};
  const seen = Array.isArray(state.settings.badgesSeen) ? state.settings.badgesSeen : [];
  const fresh = badgesEarned().filter(b => !seen.includes(b.id));
  if (!fresh.length) return;
  state.settings.badgesSeen = seen.concat(fresh.map(b => b.id));
  save();
  const b = fresh[fresh.length - 1];
  haptic('done');
  celebrate(document.querySelector('.tabbar'));
  showToast({ title: 'ได้เหรียญใหม่ · ' + b.name, body: b.desc });
  // ครบทุกเหรียญ → GENESIS (ตามหลัง toast เหรียญไม่ให้ทับกัน)
  setTimeout(checkGenesisUnlock, 6500);
}

function renderBadges() {
  const box = document.getElementById('badgesBody');
  if (!box) return;
  const done = doneCount();
  const got = badgesEarned().length;

  box.innerHTML = `<div class="page-head">
      <div class="eyebrow mono">${got} / ${BADGES.length}</div>
      <h1 class="page-title">เหรียญตรา</h1>
    </div>
    ${BADGES.map(b => {
      const on = badgeEarned(b);
      const prog = !on && b.goal ? Math.min(done, b.goal) + ' / ' + b.goal : '';
      return `<div class="bg-row${on ? ' on' : ''} ${b.tone}">
        <div class="bg-mark"><span>${b.mark}</span></div>
        <div class="bg-bd">
          <div class="bg-nm${b.secret || b.genesis || b.skin ? ' fancy' : ''}">${esc(b.name)}</div>
          <div class="bg-ds">${on ? esc(b.desc) : (b.secret || b.genesis || b.skin ? '— — —' : esc(b.desc))}</div>
          ${prog ? `<div class="bg-pg"><i style="width:${Math.round(done / b.goal * 100)}%"></i></div>
            <div class="bg-ct mono">${prog}</div>` : ''}
        </div>
        ${on ? `<span class="bg-ok">${icon('check')}</span>` : ''}
      </div>`;
    }).join('')}`;
}

// ---------- ALT 1A7: โทเคน · เช็คอินรายวัน · สุ่มสกิน ----------
// "วันของรางวัล" เริ่ม 6 โมงเช้าเวลาไทย ไม่ใช่เที่ยงคืน
// เหตุผล: นักเรียนที่นั่งทำการบ้านถึงตีสอง ยังควรนับเป็นวันเดิมอยู่
// ถ้าตัดที่เที่ยงคืน คนกลุ่มนี้จะเผลอกินสิทธิ์ของวันถัดไปทั้งที่ยังไม่ได้นอน
const TOKEN_KEY = 'studentos.alt.tokens';
const REWARD_HOUR = 6;          // เวลาไทยที่วันของรางวัลเปลี่ยน
const THAI_OFFSET_MIN = 7 * 60; // ไทย = UTC+7 คงที่ ไม่มี DST

// ตารางรอบ 7 วัน: วันแรก 9 · ทุกวันที่หาร 3 ลงตัวได้ 3 · วันอื่น 1 · วันที่ 7 ได้สุ่มฟรี
const DAILY_PLAN = [9, 1, 3, 1, 1, 3, 'spin'];

// ---------- ราคาและอัตราของการสุ่ม ----------
const SPIN_COST_1 = 2;    // สุ่ม 1 ใบ
const SPIN_COST_10 = 10;  // สุ่ม 10 ใบ (ถูกกว่าสุ่มทีละใบครึ่งหนึ่ง)

// ---------- ธีมที่ต้องได้มาก่อนถึงจะใช้ได้ ----------
// ธีมพวกนี้เคยเปิดให้ใช้ฟรีทุกคน ตอนนี้ย้ายไปอยู่หลังระบบสุ่มกับร้านค้า
// **ธีมที่ผู้ใช้เลือกใช้อยู่ตอนนี้จะไม่ถูกยึดคืน** — ปุ่มยังโผล่และยังกดได้เหมือนเดิม
// (ดู themeVisible) การเปลี่ยนกติกากลางทางไม่ควรไปเอาของที่เขาใช้อยู่แล้วออกจากมือ
const THEME_GACHA = ['earth', 'ocean', 'magic', 'galaxy', 'meta', 'glitch'];  // ได้จากการสุ่มเท่านั้น
// ระดับลับ — **แอปไม่บอกว่ามีระดับนี้อยู่** ไม่โผล่ในตารางอัตรา ไม่โผล่ในตู้สะสม
// จนกว่าจะได้จริง · โค้ดปลดล็อกทั่วไปก็ไม่แจกให้ ต้องโค้ดอีกใบเท่านั้น
const THEME_SECRET = ['meta', 'glitch'];
const THEME_SHOP = {                                          // ซื้อด้วยโทเคน
  warm:  { cost: 30, name: 'ชมพู' },
  space: { cost: 30, name: 'อวกาศ' },
};

// ---------- คราฟธีมลับจากธีมต้นแบบ ----------
// ต้องมีธีมต้นแบบอยู่ในมือก่อน แล้วจ่ายโทเคนแปลงร่างเป็นธีมลับของสายนั้น
// เป็นทางที่สองนอกจากอีสเตอร์เอกก์ (กดปุ่มธีมต้นแบบซ้ำ 5 ครั้ง) — ของเดิมยังใช้ได้เหมือนเดิม
// ต้นไม้โลกถูกกว่าเพื่อน เพราะสายโลกเป็นสายที่หาต้นแบบได้ง่ายที่สุด
const THEME_CRAFT = {
  deepocean: { base: 'ocean',  secret: 'ocean',  cost: 120, name: 'ทะเลลึก' },
  sweet:     { base: 'galaxy', secret: 'galaxy', cost: 120, name: 'จักรวาลหวานแหว' },
  earth2:    { base: 'earth',  secret: 'earth',  cost: 60,  name: 'ต้นไม้โลก' },
};

function craftTheme(id) {
  const c = THEME_CRAFT[id];
  if (!c || secretUnlocked(c.secret)) return;
  if (!themeOwned(c.base)) {
    haptic('snooze');
    showToast({ title: 'ยังคราฟไม่ได้', body: 'ต้องมีธีม' + THEME_NAME[c.base] + 'ก่อน' });
    return;
  }
  const s = tokenState();
  if ((s.bal || 0) < c.cost) {
    haptic('snooze');
    showToast({ title: 'โทเคนไม่พอ', body: 'คราฟธีม' + c.name + 'ใช้ ' + c.cost + ' โทเคน — ยังขาดอีก ' + fmtTok(c.cost - (s.bal || 0)) });
    return;
  }
  s.bal = Math.round((s.bal - c.cost) * 10) / 10;
  saveTokenState(s);
  try { localStorage.setItem(SECRETS[c.secret].store, '1'); } catch (_) {}
  applySecrets();
  applyThemeLocks();
  haptic('done');
  splashBurst(20, SECRETS[c.secret].fx);
  renderAll();
  setTimeout(checkBadges, 600);   // ธีมลับพวกนี้มีเหรียญของตัวเอง
  showToast({ title: 'คราฟธีม' + c.name + 'สำเร็จ ✦', body: 'เลือกใช้ได้ที่จอตั้งค่า · เหลือ ' + fmtTok(s.bal) + ' โทเคน' });
}

function themeLocked(id) { return THEME_GACHA.includes(id) || !!THEME_SHOP[id]; }
function themeOwned(id) {
  if (!themeLocked(id)) return true;
  const s = tokenState();
  if (THEME_GACHA.includes(id)) return ((s.skins || {})[id] || 0) > 0;
  return (s.bought || []).includes(id);
}
function themeVisible(id) { return themeOwned(id) || themePref() === id; }

// ซ่อน/โชว์ปุ่มธีมตามสิทธิ์ — เรียกทุกครั้งที่สิทธิ์เปลี่ยน
function applyThemeLocks() {
  document.querySelectorAll('#themePick button[data-th]').forEach(b => {
    const id = b.dataset.th;
    if (!themeLocked(id)) return;                 // ธีมฟรี ไม่ต้องยุ่ง
    b.hidden = !themeVisible(id);
    // ธีมที่ยังใช้อยู่แต่ยังไม่ได้เป็นเจ้าของ ติดป้ายบอกว่าใช้ต่อได้แต่เปลี่ยนออกแล้วจะหาย
    b.classList.toggle('th-grace', themeVisible(id) && !themeOwned(id));
  });
}

function buyTheme(id) {
  const t = THEME_SHOP[id];
  if (!t || themeOwned(id)) return;
  const s = tokenState();
  if ((s.bal || 0) < t.cost) {
    haptic('snooze');
    showToast({ title: 'โทเคนไม่พอ', body: 'ธีม' + t.name + ' ราคา ' + t.cost + ' โทเคน — ยังขาดอีก ' + fmtTok(t.cost - (s.bal || 0)) });
    return;
  }
  s.bal -= t.cost;
  s.bought = (s.bought || []).concat(id);
  saveTokenState(s);
  haptic('done');
  splashBurst(18, 'egg-star');
  applyThemeLocks();
  renderAll();
  showToast({ title: 'ได้ธีม' + t.name + 'แล้ว 🎨', body: 'เลือกใช้ได้ที่จอตั้งค่า · เหลือ ' + fmtTok(s.bal) + ' โทเคน' });
}

// ---------- ตารางรางวัลของการสุ่ม ----------
// Common 83 · Rare 16 · Legendary 1 (ธีมออกยากขึ้นกว่าเดิมมาก)
// น้ำหนักรวม 100 พอดี — ระดับลับกินไป 0.4 โดยหักออกจาก Common
const SPIN_TABLE = [
  { id: 'tk1', rarity: 'common', kind: 'token', label: 'โทเคน', weight: 82.6 },
  { id: 'earth', rarity: 'rare', kind: 'skin', theme: 'earth', label: 'โลก', weight: 8 },
  { id: 'magic', rarity: 'rare', kind: 'skin', theme: 'magic', label: 'เวทมนตร์', weight: 8 },
  { id: 'ocean', rarity: 'legendary', kind: 'skin', theme: 'ocean', label: 'มหาสมุทร', weight: 0.5 },
  { id: 'galaxy', rarity: 'legendary', kind: 'skin', theme: 'galaxy', label: 'กาแล็กซี', weight: 0.5 },
  { id: 'meta', rarity: 'secret', kind: 'skin', theme: 'meta', label: 'METAVERSE', weight: 0.2 },
  { id: 'glitch', rarity: 'secret', kind: 'skin', theme: 'glitch', label: 'GL!TCH', weight: 0.2 },
];
const RARITY_NAME = { common: 'Common', rare: 'Rare', legendary: 'Legendary', secret: '???' };
const DUP_REFUND = { rare: 1.5, legendary: 2.5, secret: 5 };

// โทเคนมีทศนิยมได้แล้ว (Common จ่าย 0–0.5) — แสดงผลให้พอดี ไม่โชว์ .0 ลอย ๆ
function fmtTok(n) {
  const v = Math.round((n || 0) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// ---------- โชคเพิ่ม ----------
// เปิดด้วยโค้ด ปิดด้วยอีกโค้ดหนึ่ง · คูณน้ำหนักของทุกอย่างที่ไม่ใช่ Common ขึ้น 10 เท่า
// (= บวกโชค 1000%) ส่วน Common ปล่อยไว้เท่าเดิม สัดส่วนจึงเอียงไปทางของดีทั้งแผง
const LUCK_KEY = 'studentos.alt.luck';
const LUCK_MULT = 10;
function luckOn() {
  try { return localStorage.getItem(LUCK_KEY) === '1'; } catch (_) { return false; }
}
function spinWeight(p) {
  return (luckOn() && p.rarity !== 'common') ? p.weight * LUCK_MULT : p.weight;
}
// อัตราจริงตอนนี้ แยกตามระดับ — ใช้ทั้งตอนสุ่มและตอนวาดตารางบนจอ
function currentOdds() {
  const total = SPIN_TABLE.reduce((n, p) => n + spinWeight(p), 0);
  const by = {};
  SPIN_TABLE.forEach(p => { by[p.rarity] = (by[p.rarity] || 0) + spinWeight(p) / total * 100; });
  return by;
}

// สุ่มผล **โดยยังไม่แตะยอดใด ๆ** — ผลถูกล็อกตั้งแต่ตอนกดปุ่ม แต่ของยังไม่เข้ากระเป๋า
// จนกว่าจะหงายการ์ดใบนั้น ไม่งั้นยอดบนจอจะขยับก่อนผู้ใช้เปิด = สปอยล์ผลตัวเอง
function rollPrize() {
  const total = SPIN_TABLE.reduce((n, p) => n + spinWeight(p), 0);
  let r = Math.random() * total;
  const p = SPIN_TABLE.find(x => (r -= spinWeight(x)) < 0) || SPIN_TABLE[0];
  const out = { id: p.id, rarity: p.rarity, kind: p.kind, label: p.label, theme: p.theme };
  // Common จ่าย 0–0.5 โทเคน (ทีละ 0.1)
  if (p.kind === 'token') out.amount = Math.round(Math.random() * 5) / 10;
  return out;
}

// ให้ของจริงตอนหงายการ์ด — เช็ค "ซ้ำ" ณ ตอนนี้ ใบที่สองของรอบเดียวกันจึงนับเป็นซ้ำถูกต้อง
function grantPrize(r) {
  if (r.granted) return r;
  const s = tokenState();
  if (r.kind === 'token') {
    s.bal = Math.round(((s.bal || 0) + r.amount) * 10) / 10;
  } else {
    s.skins = s.skins || {};
    const had = s.skins[r.id] || 0;
    s.skins[r.id] = had + 1;
    r.duplicate = had > 0;
    if (r.duplicate) {
      r.amount = DUP_REFUND[r.rarity] || 1;
      s.bal = Math.round(((s.bal || 0) + r.amount) * 10) / 10;
    }
  }
  saveTokenState(s);
  r.granted = true;
  return r;
}

// n = จำนวนใบ · คิดเงินก่อนสุ่ม ถ้าไม่พอไม่สุ่มเลยสักใบ (ไม่หักครึ่ง ๆ กลาง ๆ)
function paySpin(n) {
  const s = tokenState();
  if (n === 1 && (s.freeSpins || 0) > 0) {
    s.freeSpins -= 1;
    saveTokenState(s);
    return { ok: true, free: true, cost: 0 };
  }
  const cost = n === 10 ? SPIN_COST_10 : SPIN_COST_1 * n;
  if ((s.bal || 0) < cost) return { ok: false, cost, short: Math.round((cost - (s.bal || 0)) * 10) / 10 };
  s.bal = Math.round((s.bal - cost) * 10) / 10;
  saveTokenState(s);
  return { ok: true, free: false, cost };
}

// เวลาไทยตอนนี้ ในรูป Date ที่อ่านฟิลด์ local ได้เป็นเวลาไทยตรง ๆ
function thaiNow(now = new Date()) {
  return new Date(now.getTime() + (now.getTimezoneOffset() + THAI_OFFSET_MIN) * 60000);
}
// รหัสวันของรางวัล — ถอย 6 ชั่วโมงก่อนตัดวัน เส้นแบ่งจึงอยู่ที่ 6 โมงเช้าไทย
function rewardDayKey(now = new Date()) {
  const t = thaiNow(now);
  t.setHours(t.getHours() - REWARD_HOUR);
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0')
    + '-' + String(t.getDate()).padStart(2, '0');
}
function prevDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(y, m - 1, d - 1);
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0')
    + '-' + String(t.getDate()).padStart(2, '0');
}
// ชื่อเดิมที่โค้ดส่วนอื่นเรียกอยู่
function dayKey(d = new Date()) { return rewardDayKey(d); }

function tokenState() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) || {}; } catch (_) { return {}; }
}
function saveTokenState(s) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); } catch (_) {}
}
function tokenBalance() { return tokenState().bal || 0; }
function loginStreak() { return tokenState().streak || 0; }
function skinsOwned() { return tokenState().skins || {}; }
function addTokens(n) {
  const s = tokenState();
  s.bal = Math.max(0, (s.bal || 0) + n);
  saveTokenState(s);
  return s.bal;
}

// วันนี้ยังไม่ได้รับของรางวัลใช่ไหม
function dailyPending() { return tokenState().day !== rewardDayKey(); }
// อยู่วันที่เท่าไหร่ของรอบ (1–7) ถ้ายังไม่ได้รับของวันนี้
function pendingCycleDay() {
  const s = tokenState();
  if (!dailyPending()) return s.cycleDay || 1;
  const today = rewardDayKey();
  const carried = (s.day === prevDayKey(today)) ? (s.cycleDay || 0) : 0;  // ขาดวัน = เริ่มรอบใหม่
  return carried >= 7 ? 1 : carried + 1;
}

// รับของรางวัลของวันนี้ — วันละครั้ง ไม่ว่าจะเปิดแอปกี่รอบ
function claimDaily() {
  if (!dailyPending()) return null;
  const s = tokenState();
  const today = rewardDayKey();
  const day = pendingCycleDay();
  const prize = DAILY_PLAN[day - 1];

  s.streak = (s.day === prevDayKey(today)) ? (s.streak || 0) + 1 : 1;
  s.best = Math.max(s.best || 0, s.streak);
  s.days = (s.days || 0) + 1;
  s.cycleDay = day;
  s.day = today;
  if (prize === 'spin') {
    s.freeSpins = (s.freeSpins || 0) + 1;   // วันที่ 7 ได้สิทธิ์หมุนฟรี 1 ครั้ง
  } else {
    s.bal = (s.bal || 0) + prize;
  }
  saveTokenState(s);
  return { day, prize, bal: s.bal || 0, streak: s.streak, freeSpins: s.freeSpins || 0 };
}


// ---------- หน้าต่างเช็คอินรายวัน ----------
// เด้งเองเมื่อถึงวันใหม่ (6 โมงเช้าไทย) และยังไม่ได้กดรับ
function dailyGrid(activeDay, claimedUpTo) {
  return DAILY_PLAN.map((p, i) => {
    const d = i + 1;
    const done = d <= claimedUpTo;
    const now = d === activeDay;
    const face = p === 'spin'
      ? '<span class="ck-spin">' + icon('sparkles') + '</span>'
      : '<b class="mono">' + p + '</b>';
    return `<div class="ck-cell${done ? ' done' : ''}${now ? ' now' : ''}${p === 'spin' ? ' big' : ''}">
      <span class="ck-d">วันที่ ${d}</span>
      ${face}
      <span class="ck-u">${p === 'spin' ? 'หมุนฟรี' : 'โทเคน'}</span>
      ${done ? '<span class="ck-tick">' + icon('check') + '</span>' : ''}
    </div>`;
  }).join('');
}

function openDailyCheck(auto) {
  const wrap = document.getElementById('checkin');
  if (!wrap) return;
  if (auto && !dailyPending()) return;
  // ยังไม่ได้เข้าแอปจริง (จอบัญชี / จอทำความรู้จัก) ห้ามเด้ง —
  // ของรางวัลรายวันเป็นของคนที่เข้ามาใช้แอปแล้ว ไม่ใช่ของที่โผล่ทับหน้าล็อกอิน
  if (auto && document.body.classList.contains('login-mode')) return;
  const day = pendingCycleDay();
  const claimed = dailyPending() ? day - 1 : (tokenState().cycleDay || 0);
  const prize = DAILY_PLAN[day - 1];
  wrap.hidden = false;
  wrap.innerHTML = `<div class="ck-sheet">
      <div class="ck-head">
        <div class="ck-ttl">เช็คอินรายวัน</div>
        <div class="ck-sub">วันของรางวัลเปลี่ยนตอน 6 โมงเช้า</div>
      </div>
      <div class="ck-grid">${dailyGrid(day, claimed)}</div>
      ${dailyPending()
        ? `<button class="ck-cta" onclick="claimDailyFromSheet()">
             ${prize === 'spin' ? 'รับสิทธิ์สุ่มฟรี' : 'รับ ' + prize + ' โทเคน'}</button>`
        : `<p class="ck-done">รับของวันนี้ไปแล้ว — กลับมาใหม่พรุ่งนี้ 6 โมงเช้า</p>`}
      <button class="ck-close" onclick="closeDailyCheck()">ปิด</button>
    </div>`;
}
function closeDailyCheck() {
  const wrap = document.getElementById('checkin');
  if (wrap) { wrap.hidden = true; wrap.innerHTML = ''; }
}
function claimDailyFromSheet() {
  const got = claimDaily();
  if (!got) { closeDailyCheck(); return; }
  haptic('done');
  splashBurst(16, 'egg-star');
  renderAll();
  if (got.prize === 'spin') {
    closeDailyCheck();
    go('scr-wheel');
    showToast({ title: 'ครบ 7 วันแล้ว 🎡', body: 'ได้สิทธิ์สุ่มสกินฟรี 1 ใบ' });
  } else {
    openDailyCheck(false);   // วาดใหม่ให้ช่องวันนี้ติ๊กถูก
    showToast({ title: '+' + got.prize + ' โทเคน', body: 'เช็คอินต่อเนื่อง ' + got.streak + ' วัน · รวม ' + got.bal + ' โทเคน' });
  }
}

// ---------- เปิดการ์ดสุ่มสกิน (3D) ----------
// ผลถูกล็อกตั้งแต่ตอนกดปุ่ม แต่ **ของเข้ากระเป๋าตอนหงายการ์ดใบนั้นเท่านั้น**
// ถ้าให้ทั้งก้อนตอนกด ยอดโทเคนบนหัวจอจะขยับก่อนผู้ใช้เปิด = สปอยล์ผลตัวเอง
let drawResults = [];
let drawOpen = [];
let drawing = false;

// การ์ดเอียงตามตำแหน่งจริงในแถบเลื่อน — ใบกลางตั้งตรง ใบข้าง ๆ หันหนีออกไป
// อ่านจาก scrollLeft ทุกครั้งที่เลื่อน มันจึงขยับตามนิ้วจริง ไม่ใช่อนิเมชันที่เล่นเองรอบเดียว
function tiltCards() {
  const strip = document.getElementById('gcStrip');
  if (!strip) return;
  const mid = strip.scrollLeft + strip.clientWidth / 2;
  strip.querySelectorAll('.gc').forEach(c => {
    const d = Math.max(-1, Math.min(1, ((c.offsetLeft + c.offsetWidth / 2) - mid) / (strip.clientWidth / 2)));
    c.style.setProperty('--ry', (d * -30).toFixed(2) + 'deg');
    c.style.setProperty('--tz', (-Math.abs(d) * 110).toFixed(1) + 'px');
    c.style.setProperty('--sc', (1 - Math.abs(d) * 0.14).toFixed(3));
    c.style.setProperty('--dim', (1 - Math.abs(d) * 0.4).toFixed(2));
  });
}

// ยังเปิดไม่ครบ = ห้ามออกจากจอ ต้องดูให้จบก่อน
function drawBusy() { return drawResults.length > 0 && drawOpen.some(v => !v); }
function applyDrawLock() {
  document.body.classList.toggle('draw-lock', drawBusy());
}

function cardFace(r) {
  const body = r.kind === 'token'
    ? `<b class="mono">+${fmtTok(r.amount)}</b><span>โทเคน</span>`
    : `<b>${esc(r.label)}</b><span>${r.duplicate ? 'ซ้ำ · คืน ' + fmtTok(r.amount) + ' โทเคน' : 'ธีมใหม่!'}</span>`;
  return `<span class="gc-rar">${RARITY_NAME[r.rarity]}</span>${body}`;
}

function drawCardsHtml() {
  return `<div class="gc-stage"></div>
    <div class="gc-strip" id="gcStrip" onscroll="tiltCards()">
      ${drawResults.map((r, i) => `
        <button class="gc" data-i="${i}" onclick="flipCard(${i})"
          aria-label="แตะเพื่อเปิดการ์ด">
          <span class="gc-in">
            <span class="gc-back"><i class="gc-mark">${icon('sparkles')}</i><i class="gc-shine"></i></span>
            <span class="gc-face r-${r.rarity}${r.rarity === 'secret' ? ' p-' + r.id : ''}"></span>
          </span>
        </button>`).join('')}
    </div>`;
}

function drawSummary() {
  const tok = drawResults.reduce((n, r) => n + (r.amount || 0), 0);
  const fresh = drawResults.filter(r => r.kind === 'skin' && !r.duplicate).length;
  const best = drawResults.reduce((a, b) => RANK[b.rarity] > RANK[a.rarity] ? b : a, drawResults[0]);
  return `รอบนี้ได้ <b>${fmtTok(tok)}</b> โทเคน${fresh ? ' · ธีมใหม่ ' + fresh + ' อัน' : ''}
    · ดีที่สุด <b class="r-${best.rarity}">${RARITY_NAME[best.rarity]}</b>`;
}
const RANK = { common: 0, rare: 1, legendary: 2, secret: 3 };

function flipCard(i) {
  if (drawOpen[i]) return;
  drawOpen[i] = true;
  const r = grantPrize(drawResults[i]);     // ของเข้ากระเป๋าตอนนี้ ไม่ใช่ตอนกดปุ่ม
  const el = document.querySelector('.gc[data-i="' + i + '"]');
  if (el) {
    el.querySelector('.gc-face').innerHTML = cardFace(r);   // เติมหน้าการ์ดตอนจะพลิกเท่านั้น
    el.classList.add('open', 'lit-' + r.rarity);
  }
  haptic(r.rarity === 'common' ? 'arm' : 'done');
  // ของหายากเด้งเอฟเฟกต์ตอนการ์ดพลิกไปครึ่งทาง ไม่ใช่ตอนแตะ
  if (r.rarity !== 'common') {
    setTimeout(() => {
      splashBurst(r.rarity === 'legendary' ? 28 : 13, 'egg-star');
      const stage = document.querySelector('.gc-stage');
      if (stage) {
        stage.classList.remove('burst-rare', 'burst-legendary');
        void stage.offsetWidth;
        stage.classList.add('burst-' + r.rarity);
      }
    }, 340);
  }
  if (r.rarity === 'legendary') {
    setTimeout(() => showToast({
      title: 'LEGENDARY ✦ ' + r.label,
      body: r.duplicate ? 'ซ้ำ — คืน ' + fmtTok(r.amount) + ' โทเคน' : 'ปลดล็อกธีม' + r.label + 'แล้ว',
    }), 620);
  } else if (r.kind === 'skin' && !r.duplicate) {
    setTimeout(() => showToast({ title: 'ได้ธีมใหม่ · ' + r.label, body: 'เลือกใช้ได้ที่จอตั้งค่า' }), 620);
  }
  refreshDrawHead();
  applyThemeLocks();
  if (!drawBusy()) setTimeout(() => { applyDrawLock(); refreshDrawFooter(); renderAll(); }, 760);
  else refreshDrawFooter();
}

function flipAllCards() {
  drawResults.forEach((_, i) => {
    if (!drawOpen[i]) setTimeout(() => flipCard(i), i * 130);   // ไล่ทีละใบ ไม่พลิกพร้อมกันทั้งแถว
  });
}

function refreshDrawFooter() {
  const foot = document.getElementById('gcFoot');
  if (!foot) return;
  const left = drawOpen.filter(v => !v).length;
  foot.innerHTML = left
    ? `<button class="gc-all" onclick="flipAllCards()">หงายที่เหลือทั้งหมด (${left})</button>`
    : (drawResults.length ? `<div class="gc-sum">${drawSummary()}</div>` : '');
}

// ตัวเลขบนตารางอัตรา — **ระดับลับถูกยุบเข้าไปใน Common เสมอ**
// ผลรวมจึงได้ 100% พอดีทุกกรณี ไม่มีช่องว่างให้สังเกตว่ามีอะไรซ่อนอยู่
function oddsText(rarity) {
  const od = currentOdds();
  const v = rarity === 'common' ? (od.common || 0) + (od.secret || 0) : (od[rarity] || 0);
  return (v >= 10 ? Math.round(v) : +v.toFixed(1)) + '%';
}

function renderWheel() {
  const box = document.getElementById('wheelBody');
  if (!box) return;
  if (drawResults.length && curScreen === 'scr-wheel') return;  // กำลังโชว์การ์ดอยู่ ห้ามวาดทับ
  const s = tokenState();
  const free = s.freeSpins || 0;
  box.innerHTML = `<div class="page-head">
      <div class="eyebrow mono" id="gcBal">${fmtTok(s.bal)} โทเคน${free ? ' · เปิดฟรี ' + free : ''}</div>
      <h1 class="page-title gc-title">สุ่มสกิน</h1>
      <p class="page-sub">แตะการ์ดเพื่อหงายทีละใบ · ลากซ้ายขวาเพื่อดูใบอื่น</p>
    </div>
    <div class="gc-odds${luckOn() ? ' lucky' : ''}">
      <span class="r-legendary">Legendary ${oddsText('legendary')}</span>
      <span class="r-rare">Rare ${oddsText('rare')}</span>
      <span class="r-common">Common ${oddsText('common')}</span>
      ${luckOn() ? '<span class="gc-luck">โชค ×' + LUCK_MULT + '</span>' : ''}
    </div>
    <div id="gcArea" class="gc-empty">
      <div class="gc-stage idle"></div>
      <div class="gc-ph"><i>${icon('sparkles')}</i><p>กดปุ่มด้านล่างเพื่อสุ่ม</p></div>
    </div>
    <div id="gcFoot"></div>
    <div class="gc-btns">
      <button class="gc-go" id="gcGo1" onclick="doSpin(1)">
        <b>สุ่ม 1 ใบ</b><i>${free ? 'ใช้สิทธิ์ฟรี' : SPIN_COST_1 + ' โทเคน'}</i></button>
      <button class="gc-go alt" id="gcGo10" onclick="doSpin(10)">
        <b>สุ่ม 10 ใบ</b><i>${SPIN_COST_10} โทเคน</i></button>
    </div>`;
}

function refreshDrawHead() {
  const s = tokenState();
  const bal = document.getElementById('gcBal');
  if (bal) bal.textContent = fmtTok(s.bal) + ' โทเคน' + ((s.freeSpins || 0) ? ' · เปิดฟรี ' + s.freeSpins : '');
  const b1 = document.querySelector('#gcGo1 i');
  if (b1) b1.textContent = (s.freeSpins || 0) ? 'ใช้สิทธิ์ฟรี' : SPIN_COST_1 + ' โทเคน';
}

async function doSpin(n) {
  if (drawing || drawBusy()) return;
  const pay = paySpin(n);
  if (!pay.ok) {
    haptic('snooze');
    showToast({ title: 'โทเคนไม่พอ', body: 'ต้องใช้ ' + pay.cost + ' โทเคน — ยังขาดอีก ' + fmtTok(pay.short) });
    return;
  }
  drawing = true;
  document.getElementById('gcGo1').disabled = true;
  document.getElementById('gcGo10').disabled = true;

  // ล็อกผลไว้ตั้งแต่ตอนนี้ (ยุติธรรม — หงายช้าเร็วไม่เปลี่ยนของ) แต่ยังไม่ให้ของ
  drawResults = Array.from({ length: n }, () => rollPrize());
  drawOpen = drawResults.map(() => false);
  applyDrawLock();

  const area = document.getElementById('gcArea');
  area.className = '';
  area.innerHTML = drawCardsHtml();
  refreshDrawFooter();
  refreshDrawHead();          // ยอดลดลงตามค่าสุ่มแล้ว แต่ยังไม่มีรางวัลเข้า

  const cards = [...area.querySelectorAll('.gc')];
  cards.forEach((c, i) => { c.style.animationDelay = (i * 60) + 'ms'; });
  tiltCards();
  requestAnimationFrame(tiltCards);
  await new Promise(r => setTimeout(r, 260 + cards.length * 60));

  document.getElementById('gcGo1').disabled = false;
  document.getElementById('gcGo10').disabled = false;
  drawing = false;
}

// ---------- ร้านค้า ----------
function renderShop() {
  const box = document.getElementById('shopBody');
  if (!box) return;
  const s = tokenState();
  const skins = s.skins || {};
  const day = pendingCycleDay();
  // ตู้สะสม: ระดับลับไม่โผล่จนกว่าจะได้จริง — เห็นช่องว่างรออยู่ก็เท่ากับบอกว่ามีอยู่
  const gacha = SPIN_TABLE.filter(p => p.kind === 'skin'
    && (p.rarity !== 'secret' || (skins[p.id] || 0) > 0));
  box.innerHTML = `<div class="page-head">
      <div class="eyebrow mono">เช็คอินต่อเนื่อง ${s.streak || 0} วัน</div>
      <h1 class="page-title">ร้านค้า</h1>
    </div>
    <div class="tk-hero">
      <div class="tk-coin">${icon('medal')}</div>
      <div class="tk-bd">
        <div class="tk-bal mono">${fmtTok(s.bal)}</div>
        <div class="tk-unit">โทเคน${(s.freeSpins || 0) ? ' · เปิดฟรี ' + s.freeSpins + ' ใบ' : ''}</div>
      </div>
    </div>
    <button class="tk-cta" onclick="go('scr-wheel')">
      <span class="tile">${icon('sparkles')}</span>
      <span class="bd"><b>สุ่มสกิน</b><i>สุ่ม 1 ใบ ${SPIN_COST_1} โทเคน · 10 ใบ ${SPIN_COST_10} โทเคน</i></span>
      ${icon('chevron')}
    </button>
    <button class="tk-cta ghost" onclick="openDailyCheck(false)">
      <span class="tile">${icon('calendar')}</span>
      <span class="bd"><b>เช็คอินรายวัน</b><i>${dailyPending()
        ? 'วันที่ ' + day + ' ของรอบ — ยังไม่ได้รับ'
        : 'รับของวันนี้แล้ว · พรุ่งนี้ 6 โมงเช้า'}</i></span>
      ${icon('chevron')}
    </button>

    <div class="sec-label">ธีมที่ซื้อได้</div>
    <div class="tk-buy">
      ${Object.entries(THEME_SHOP).map(([id, t]) => {
        const own = themeOwned(id);
        return `<div class="tb-row${own ? ' own' : ''}">
          <span class="tb-sw sw-${id}"></span>
          <span class="tb-bd"><b>${esc(t.name)}</b><i>${own ? 'มีแล้ว' : t.cost + ' โทเคน'}</i></span>
          ${own ? `<span class="tb-ok">${icon('check')}</span>`
                : `<button class="tb-go${(s.bal || 0) < t.cost ? ' poor' : ''}" onclick="buyTheme('${id}')">ซื้อ</button>`}
        </div>`;
      }).join('')}
    </div>

    <div class="sec-label">คราฟธีม</div>
    <div class="tk-buy">
      ${Object.entries(THEME_CRAFT).map(([id, c]) => {
        const done = secretUnlocked(c.secret);
        const hasBase = themeOwned(c.base);
        const poor = (s.bal || 0) < c.cost;
        return `<div class="tb-row${done ? ' own' : ''}">
          <span class="tb-sw sw-${id}"></span>
          <span class="tb-bd"><b>${esc(c.name)}</b><i>${done ? 'คราฟแล้ว'
            : (hasBase ? 'ใช้ธีม' + esc(THEME_NAME[c.base]) + ' + ' + c.cost + ' โทเคน'
                       : 'ต้องมีธีม' + esc(THEME_NAME[c.base]) + 'ก่อน')}</i></span>
          ${done ? `<span class="tb-ok">${icon('check')}</span>`
                 : `<button class="tb-go${(!hasBase || poor) ? ' poor' : ''}" onclick="craftTheme('${id}')">คราฟ</button>`}
        </div>`;
      }).join('')}
    </div>

    <div class="sec-label">ธีมจากการสุ่มเท่านั้น</div>
    <div class="tk-skins">
      ${gacha.map(p => {
        const n = skins[p.id] || 0;
        return `<div class="tk-skin r-${p.rarity}${n ? ' got' : ''}">
          <div class="ts-rar">${RARITY_NAME[p.rarity]}</div>
          <div class="ts-nm">${esc(p.label)}</div>
          <div class="ts-ct mono">${n ? '×' + n : '— — —'}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="tk-stats">
      <div><div class="v mono">${s.best || 0}</div><div class="k">สถิติต่อเนื่อง</div></div>
      <div><div class="v mono">${s.days || 0}</div><div class="k">เช็คอินรวม</div></div>
      <div><div class="v mono">${Object.values(skins).reduce((a, b) => a + b, 0)}</div><div class="k">ธีมที่สุ่มได้</div></div>
    </div>
    <div class="tk-soon">
      <div class="lb">ของอื่นในร้านยังไม่เปิด</div>
      <p>ตอนนี้มีธีมกับการสุ่มก่อน — โทเคนที่สะสมไว้จะยังอยู่ครบเมื่อของอื่นเปิด</p>
    </div>`;
}
// ---------- ALT 1A6M3: ป้ายเตือนบนแถบเมนู ----------
// งานที่ AI จัดว่า "ด่วนมาก" และยังไม่เสร็จ ต้องเห็นได้โดยไม่ต้องเข้าไปดู
function renderTabBadges() {
  const el = document.getElementById('badgeHome');
  if (!el) return;
  const now = new Date();
  const urgent = pendingTasks().filter(t => priorityInfo(t, now).stars >= 5).length;
  el.hidden = !urgent;
  el.textContent = urgent > 9 ? '9+' : urgent;
  el.setAttribute('aria-label', urgent ? 'งานด่วนมาก ' + urgent + ' งาน' : '');

  // ปุ่มเพื่อนมุมขวาบน — ขึ้นจำนวนเพื่อนที่มีในรายการ
  const fb = document.getElementById('friendsBadge');
  if (fb) {
    const n = friends().length;
    fb.hidden = !n;
    fb.textContent = n > 9 ? '9+' : n;
  }
  const fsub = document.getElementById('friendsSub');
  if (fsub) {
    const n = friends().length;
    fsub.textContent = n ? n + ' คนในรายการ · ดูสถานะและผลของเพื่อน' : 'ดูสถานะและผลของเพื่อน';
  }
}

// ---------- ALT 1A6M3: ผลของฉัน ----------
// ใช้เฉพาะข้อมูลที่แอปมีจริง — จำนวนงานที่เสร็จ เวลาที่ "ประเมินไว้" และการส่งทันกำหนด
// ไม่มีการจับเวลานั่งทำจริง จึงไม่เขียนว่าเป็นเวลาที่นั่งทำ (จะกลายเป็นตัวเลขที่แต่งขึ้น)
function renderStats() {
  const box = document.getElementById('statsBox');
  if (!box) return;
  const now = new Date();
  const live = liveTasks();
  const done = live.filter(t => t.done);
  const week = done.filter(t => t.doneAt && (now - new Date(t.doneAt)) < 7 * 8.64e7);
  const estH = Math.round(done.reduce((s, t) => s + (t.estMin || 0), 0) / 6) / 10;
  const onTime = done.filter(t => t.doneAt && t.due && new Date(t.doneAt) <= new Date(t.due)).length;
  const rated = done.filter(t => t.doneAt && t.due).length;
  const onTimePct = rated ? Math.round(onTime / rated * 100) : null;
  const snoozes = live.reduce((s, t) => s + (t.snoozeCount || 0), 0);

  // กราฟ 7 วัน: นับงานที่ติ๊กเสร็จในแต่ละวัน
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(now, -i);
    const n = done.filter(t => t.doneAt &&
      new Date(t.doneAt).toDateString() === d.toDateString()).length;
    days.push({ n, label: WEEKDAY_SHORT[d.getDay()], today: i === 0 });
  }
  const peak = Math.max(1, ...days.map(d => d.n));

  // แยกตามวิชา (เฉพาะที่ทำเสร็จแล้ว)
  const bySubject = {};
  for (const t of done) {
    const k = t.subject || 'อื่น ๆ';
    bySubject[k] = bySubject[k] || { n: 0, min: 0 };
    bySubject[k].n++;
    bySubject[k].min += t.estMin || 0;
  }
  const subjRows = Object.entries(bySubject).sort((a, b) => b[1].n - a[1].n).slice(0, 5);

  box.innerHTML = `<div class="sec-label">ผลของฉัน</div>
    <div class="st-hero">
      <div><div class="v">${done.length}</div><div class="k">งานที่เสร็จ</div></div>
      <div class="sep"></div>
      <div><div class="v">${week.length}</div><div class="k">เสร็จใน 7 วัน</div></div>
      <div class="sep"></div>
      <div><div class="v">${estH}<span class="u">ชม.</span></div><div class="k">เวลาที่ประเมินไว้</div></div>
    </div>

    <div class="st-card">
      <div class="st-h">งานที่ติ๊กเสร็จ 7 วันล่าสุด</div>
      <div class="st-bars">
        ${days.map(d => `<div class="st-bar${d.today ? ' now' : ''}">
          <span class="bar" style="height:${Math.round(d.n / peak * 100)}%"></span>
          <span class="n mono">${d.n || ''}</span>
          <span class="d">${d.label}</span>
        </div>`).join('')}
      </div>
    </div>

    ${onTimePct != null ? `<div class="st-card">
      <div class="st-h">ส่งทันกำหนด</div>
      <div class="st-line"><b>${onTimePct}%</b> ของงานที่มีกำหนดส่ง (${onTime}/${rated} งาน)</div>
      <div class="st-track"><i style="width:${onTimePct}%"></i></div>
    </div>` : ''}

    ${snoozes ? `<div class="st-card soft">
      <div class="st-line">${icon('clock')}เลื่อนงานไปแล้วรวม <b>${snoozes}</b> ครั้ง</div>
    </div>` : ''}

    ${subjRows.length ? `<div class="st-card">
      <div class="st-h">แยกตามวิชา</div>
      ${subjRows.map(([name, v]) => `<div class="st-row">
        <span class="nm">${esc(name)}</span>
        <span class="ct mono">${v.n} งาน · ${Math.round(v.min / 6) / 10} ชม.</span>
      </div>`).join('')}
    </div>` : ''}`;
}

function renderAll() {
  renderMenu(); renderHome(); renderTasks(); renderTimeline();
  renderProfile(); renderStats(); renderPlan(); renderFriends(); renderBadges();
  renderShop(); renderWheel(); renderInstallCard(); renderTabBadges();
  // ระบบ LINE ของอีกสาย — เรียกเมื่อไฟล์ถูกโหลดจริงเท่านั้น
  // (กันแอปพังทั้งจอถ้าไฟล์ inbox.js/linelink.js โหลดไม่ขึ้น)
  if (typeof renderInbox === 'function') renderInbox();
  if (typeof renderSources === 'function') renderSources();
}

// ---------- task actions ----------
// el = ปุ่มที่กด (ถ้ามี) ใช้เป็นจุดกำเนิดของเอฟเฟกต์ฉลอง
function toggleDone(id, el) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const wasDone = t.done;
  t.done = !t.done;
  t.progress = t.done ? 100 : (t.progress === 100 ? 0 : t.progress);
  t.doneAt = t.done ? new Date().toISOString() : null;
  save();

  if (!wasDone && t.done) {
    // ให้เห็นจังหวะฉลองก่อน แล้วค่อยวาดรายการใหม่ (ไม่งั้นปุ่มหายไปก่อนดูจบ)
    if (el) { el.classList.add('on', 'pop'); }
    celebrate(el);
    haptic('done'); // ALT: จังหวะคู่ ให้รู้สึกว่า "เช็คสำเร็จ" ไม่ใช่แค่ภาพเปลี่ยน
    const cleared = pendingTasks().length === 0;
    setTimeout(() => {
      renderAll();
      showToast(celebrateCopy(cleared));
      // เหรียญใหม่ (ถ้ามี) เด้งตามหลังคำชม ไม่ให้ทับกัน
      setTimeout(checkBadges, 2600);
    }, 430);
  } else {
    renderAll();
  }
}

// ลบ = ย้ายไปถังขยะ ไม่ใช่หายจริง — กดพลาดกู้คืนได้ จึงไม่ต้องถามยืนยัน
function removeTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.deleted = true;
  t.deletedAt = new Date().toISOString();
  save(); renderAll();
  showToast({ title: 'ย้ายไปถังขยะแล้ว 🗑', body: 'กู้คืนได้ที่ปุ่มถังขยะท้ายหน้า “งาน”' });
}

// ---------- เอฟเฟกต์ฉลองตอนเช็คงานเสร็จ ----------
// เศษกระดาษพุ่งออกจากปุ่มที่กด ตกตามแรงโน้มถ่วง แล้วจางหาย
// วางไว้ในกรอบ .phone เพื่อให้ไม่ทะลุออกนอกจอแอป
function celebrate(el) {
  const phone = document.querySelector('.phone');
  if (!phone || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const pr = phone.getBoundingClientRect();
  const r = el ? el.getBoundingClientRect() : null;
  const x0 = r ? r.left - pr.left + r.width / 2 : pr.width / 2;
  const y0 = r ? r.top - pr.top + r.height / 2 : pr.height / 2;

  const cs = getComputedStyle(document.documentElement);
  const colors = ['--pri-green', '--pri-yellow', '--pri-red', '--blue']
    .map(v => cs.getPropertyValue(v).trim()).filter(Boolean).concat('#FFFFFF');

  for (let i = 0; i < 20; i++) {
    const p = document.createElement('i');
    p.className = 'particle';
    const size = 4 + Math.random() * 6;
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.width = p.style.height = size + 'px';
    p.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    p.style.left = x0 + 'px';
    p.style.top = y0 + 'px';
    phone.appendChild(p);

    const ang = Math.random() * Math.PI * 2;
    const vel = 2.5 + Math.random() * 5.5;
    let vx = Math.cos(ang) * vel, vy = Math.sin(ang) * vel - 1.5;
    let x = x0, y = y0, op = 1, rot = 0;
    const spin = (Math.random() - .5) * 16;
    const step = () => {
      x += vx; y += vy; vy += .17; vx *= .985;
      op -= .017; rot += spin;
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.opacity = op;
      p.style.transform = `scale(${Math.max(0, op)}) rotate(${rot}deg)`;
      if (op > 0) requestAnimationFrame(step); else p.remove();
    };
    requestAnimationFrame(step);
  }
}

// ---------- form (เพิ่ม/แก้/ยืนยันผล AI) ----------
let formUserStars = 0; // 0 = ให้ AI จัดให้
let formType = 'homework';

// เลือกประเภท → ฟอร์มปรับหน้าตาตามธรรมชาติของสิ่งนั้น
// (กิจกรรมไม่มีคะแนน/ครูผู้สั่ง · สอบเรียกว่า "วันสอบ" ไม่ใช่ "ส่งวันที่")
function setTypePick(type) {
  formType = TASK_TYPES[type] ? type : 'homework';
  const ti = TASK_TYPES[formType];
  document.querySelectorAll('#typePick .tp').forEach(b =>
    b.classList.toggle('active', b.dataset.type === formType));

  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  const isWork = ti.schedulable;                    // การบ้าน/สอบ = ต้องนั่งทำ
  const isHomework = formType === 'homework';

  document.getElementById('fDateLabel').textContent = ti.dateLabel;
  document.getElementById('fDetailLabel').textContent =
    formType === 'exam' ? 'สอบเรื่องอะไร' : formType === 'activity' ? 'กิจกรรมอะไร' : formType === 'reminder' ? 'เรื่องอะไร' : 'งานที่ต้องทำ';
  document.getElementById('fEstLabel').textContent = formType === 'exam' ? 'ใช้เวลาอ่าน' : 'ใช้เวลา';
  document.getElementById('fDetail').placeholder =
    formType === 'exam' ? 'เช่น สอบกลางภาค บทที่ 1–5' :
    formType === 'activity' ? 'เช่น ตักบาตร คาบ 8–9' :
    formType === 'reminder' ? 'เช่น จ่ายค่าชุดพละ' : 'เช่น ทำโจทย์บทที่ 4 ข้อ 1–10';

  show('fSubjectWrap', formType !== 'reminder');
  show('fScoreWrap', isHomework || formType === 'exam');
  show('fEstWrap', isWork);
  show('fTeacherWrap', isHomework || formType === 'exam');
  show('fProgressWrap', isWork);
}

function setStarPick(n) {
  formUserStars = n;
  document.querySelectorAll('#starPick .sp').forEach(b =>
    b.classList.toggle('active', +b.dataset.lv === n));
}

function fillSubjectSelect() {
  document.getElementById('fSubject').innerHTML =
    SUBJECTS.map(s => `<option>${s.name}</option>`).join('');
}

// จอที่ควรกลับไปหลังบันทึก/ยกเลิก — แก้งานจากรายการไหน ก็เด้งกลับรายการนั้น
let formReturn = 'scr-home';

function openForm(id, parsed) {
  editingId = id;
  const from = document.querySelector('.screen.on');
  formReturn = (from && !['scr-form', 'scr-parsing', 'scr-scan', 'scr-login'].includes(from.id))
    ? from.id : 'scr-home';
  fillSubjectSelect();
  const f = {
    subject: document.getElementById('fSubject'), detail: document.getElementById('fDetail'),
    date: document.getElementById('fDate'), time: document.getElementById('fTime'),
    score: document.getElementById('fScore'), est: document.getElementById('fEst'),
    teacher: document.getElementById('fTeacher'),
  };
  const chips = document.getElementById('detectedChips');
  const title = document.getElementById('formTitle');

  let t = null;
  if (id) t = state.tasks.find(x => x.id === id);

  const okBadge = document.getElementById('fmOk');
  if (parsed) {
    title.textContent = 'ตรวจก่อนบันทึก';
    const d = parsed.detected;
    // วิชาที่ได้จากการเดา (รูปเบลอจน AI ต้องประมาณ) ต้องบอกให้รู้ว่าเป็นการเดา
    const fields = [[d.type,'ประเภท'],[d.subject, d.subjectFuzzy ? 'วิชา (เดา)' : 'วิชา'],
      [d.teacher,'ครูผู้สั่ง'],[d.due,'กำหนดส่ง'],[d.score,'คะแนน'],[d.est,'เวลาที่ใช้']];
    const got = fields.filter(f => f[0]);
    const miss = fields.filter(f => !f[0]);
    chips.innerHTML = got.map(f => `<span class="chip new">${icon('check')}${esc(f[1])}</span>`).join('')
      + (miss.length ? `<span class="chip">อีก ${miss.length} ช่องเติมเอง</span>` : '');
    if (okBadge) {
      // ALT: ถ้ามาจากรูปแล้ว OCR ไม่ค่อยมั่นใจ ให้ป้ายเปลี่ยนโทนเป็นเตือน แทนที่จะบอกว่าสำเร็จเฉย ๆ
      const shaky = lastOcrConfidence != null && lastOcrConfidence < OCR_CONF_OK;
      okBadge.className = 'fm-ok show' + (shaky ? ' shaky' : '');
      okBadge.innerHTML = shaky
        ? `${icon('image')}อ่านจากรูปได้ ${got.length} จาก ${fields.length} ช่อง · มั่นใจ ${lastOcrConfidence}% — ตรวจให้ดีก่อนบันทึก`
        : `${icon('check-circle')}AI อ่านได้ ${got.length} จาก ${fields.length} ช่อง`;
    }
    lastOcrConfidence = null; // ใช้ครั้งเดียวต่อการสแกน ไม่ให้ค้างไปเตือนงานที่พิมพ์เอง
    t = parsed;
  } else if (t) {
    title.textContent = 'แก้ไขงาน';
    chips.innerHTML = '';
    if (okBadge) okBadge.className = 'fm-ok';
  } else {
    title.textContent = 'เพิ่มงานใหม่';
    chips.innerHTML = '';
    if (okBadge) okBadge.className = 'fm-ok';
  }

  // ปุ่มลบมีความหมายเฉพาะกับงานที่บันทึกไว้แล้ว
  const del = document.getElementById('fmDel');
  if (del) del.hidden = !(id && state.tasks.some(x => x.id === id));

  // ALT: ช่องที่ค่ามาจากคำที่ OCR ไม่มั่นใจ ตีกรอบเตือนไว้ให้ตรวจก่อนบันทึก
  document.querySelectorAll('#scr-form .fld.unsure').forEach(el => el.classList.remove('unsure'));
  const unsureIds = { subject: 'fSubject', teacher: 'fTeacher', detail: 'fDetail' };
  for (const key of (parsed && parsed._low) || []) {
    const el = document.getElementById(unsureIds[key]);
    const fld = el && el.closest('.fld');
    if (fld) fld.classList.add('unsure');
  }

  setTypePick(t ? taskType(t) : 'homework');
  setStarPick(t?.userStars || 0);
  f.subject.value = t?.subject || 'อื่น ๆ';
  f.detail.value = t?.detail || '';
  f.teacher.value = t?.teacher || '';
  f.score.value = t?.scorePct ?? '';
  f.est.value = t?.estMin || 30;
  const ev=document.getElementById('fEstVal'); if(ev) ev.textContent=(t?.estMin||30)+' นาที';
  const prog = t?.progress || 0;
  document.getElementById('fProgress').value = prog;
  document.getElementById('fProgressVal').textContent = prog + '%';

  const due = t?.due ? new Date(t.due) : new Date(Date.now() + 8.64e7); // default พรุ่งนี้
  f.date.value = due.getFullYear() + '-' + String(due.getMonth() + 1).padStart(2, '0') + '-' + String(due.getDate()).padStart(2, '0');
  f.time.value = String(due.getHours()).padStart(2, '0') + ':' + String(due.getMinutes()).padStart(2, '0');

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById('scr-form').classList.add('on');
}

function saveForm() {
  const detail = document.getElementById('fDetail').value.trim();
  if (!detail) { alert('ใส่ชื่องานก่อนนะ'); return; }
  const dateV = document.getElementById('fDate').value;
  const timeV = document.getElementById('fTime').value || '23:59';
  const due = dateV ? new Date(dateV + 'T' + timeV) : null;
  const scoreV = document.getElementById('fScore').value;

  const ti = TASK_TYPES[formType];
  const data = {
    type: formType,
    subject: formType === 'reminder' ? 'อื่น ๆ' : document.getElementById('fSubject').value,
    detail,
    teacher: document.getElementById('fTeacher').value.trim(),
    scorePct: scoreV === '' ? null : Math.min(100, +scoreV),
    estMin: Math.max(5, +document.getElementById('fEst').value || 30),
    isExam: formType === 'exam', // เก็บไว้เพื่อความเข้ากันได้กับข้อมูลเก่า
    userStars: formUserStars || null,
    progress: ti.schedulable ? (+document.getElementById('fProgress').value || 0) : 0,
    due: due ? due.toISOString() : null,
  };
  if (ti.schedulable && data.progress >= 100) data.done = true;

  const target = editingId ? state.tasks.find(x => x.id === editingId) : null;
  if (target) {
    // ตั้งกำหนดส่งใหม่เองในฟอร์ม = ตัดสินใจใหม่แล้ว ป้าย "เลื่อน" จึงหมดหน้าที่
    if (target.due !== data.due) {
      data.snoozedAt = null; data.snoozeCount = 0;
      data.remindedAt = null; data.remindedStage = null; // กำหนดใหม่ = ต้องเตือนใหม่ได้
    }
    Object.assign(target, data);
  } else {
    state.tasks.push(Object.assign({ id: uid(), done: false, createdAt: new Date().toISOString(), fromScan: !!data._scan }, data));
  }
  const back = formReturn;
  editingId = null;
  save();
  go(back);
}

// ยกเลิก = ทิ้งการแก้ทั้งหมด แล้วกลับจอที่มาจาก (ไม่ใช่เด้งไปหน้าแรกเสมอ)
function cancelForm() {
  const back = formReturn;
  editingId = null;
  go(back);
}

// ลบจากหน้าแก้ไขงาน — แถวในรายการจึงไม่ต้องมีปุ่มถังขยะให้รกตา
function deleteFromForm() {
  if (!editingId) return;
  const id = editingId, back = formReturn;
  editingId = null;
  removeTask(id);
  go(back);
}


// ---------- สถานะ "AI กำลังอ่าน" ----------
// ให้ผู้ใช้เห็นว่าระบบกำลังทำงานอยู่ แทนที่จะกระโดดเข้าฟอร์มทันที
let parsedPending = null;
function runParsing(text, source) {
  // เฉพาะข้อความจากรูปเท่านั้นที่ให้ parser เดาคำที่เพี้ยน — ที่พิมพ์เองถือว่าถูกอยู่แล้ว
  parsedPending = parseAssignment(text, new Date(), { fuzzy: source === 'ocr' });
  if (source !== 'ocr') lastOcrLowWords = [];
  parsedPending._low = source === 'ocr' ? fieldsToDoubleCheck(parsedPending) : [];
  const p = parsedPending.detected || {};
  const steps = [
    { on: true,  label: `อ่านตัวหนังสือครบ ${text.trim().length} ตัวอักษร` },
    { on: !!(p.subject || p.teacher || p.score),
      label: [p.subject && 'วิชา', p.teacher && 'ครูผู้สั่ง', p.score && 'คะแนนเก็บ'].filter(Boolean).join(' · ') || 'ยังไม่เจอวิชา/ครู' },
    { on: !!(p.due || p.est), label: 'กำลังตีความกำหนดส่งและเวลาที่ต้องใช้' },
  ];
  const box = document.getElementById('parseSteps');
  const fill = document.getElementById('parseFill');
  const go = document.getElementById('parseGo');
  if (go) go.style.display = 'none';
  if (box) box.innerHTML = '';
  go2('scr-parsing');

  steps.forEach((st, i) => setTimeout(() => {
    if (box) box.insertAdjacentHTML('beforeend',
      `<div class="pr-step ${st.on ? 'on' : ''}">
         <span class="dot">${icon('check')}</span>${esc(st.label)}</div>`);
    if (fill) fill.style.width = Math.round((i + 1) / steps.length * 100) + '%';
  }, 380 * (i + 1)));

  setTimeout(() => { if (go) go.style.display = 'block'; showParsedResult(); }, 380 * steps.length + 520);
}
function showParsedResult() {
  if (!parsedPending) return;
  const p = parsedPending; parsedPending = null;
  openForm(null, p);
}

// ---------- scan: เสียงพูด (Web Speech API) ----------
let recog = null, recogActive = false;

function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function setVoiceUI({ recording, text, dim }) {
  const btn = document.getElementById('voiceBtn');
  const label = document.getElementById('voiceLabel');
  const sub = document.getElementById('voiceSub');
  const box = document.getElementById('voiceBox');
  const txt = document.getElementById('voiceText');
  if (btn) btn.classList.toggle('rec', !!recording);
  if (label) label.textContent = recording ? 'กำลังฟัง…' : 'พูดใส่ไมค์';
  if (sub) sub.textContent = recording ? 'แตะอีกครั้งเพื่อหยุด' : 'เร็วที่สุด — 5 วินาทีเสร็จ';
  if (box) box.classList.toggle('idle', !recording);
  if (text != null && box && txt) {
    box.hidden = false;
    txt.textContent = text;
    txt.classList.toggle('dim', !!dim);
  }
}

function toggleVoice() {
  if (recogActive) { try { recog.stop(); } catch (_) {} return; }
  if (!speechSupported()) {
    setVoiceUI({ recording: false, dim: true,
      text: 'เบราว์เซอร์นี้ยังไม่รองรับการพูด — ลองใช้ Chrome (Android) หรือ Safari (iPhone) · ระหว่างนี้แปะข้อความแทนได้เลย' });
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recog = new SR();
  recog.lang = 'th-TH';
  recog.interimResults = true;
  recog.continuous = false;
  recog.maxAlternatives = 1;

  let finalText = '';
  recog.onstart = () => {
    recogActive = true;
    setVoiceUI({ recording: true, dim: true,
      text: 'พูดได้เลย เช่น “การบ้านเลข ข้อ 1 ถึง 10 ส่งพรุ่งนี้ คะแนน 20 เปอร์เซ็นต์”' });
  };
  recog.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    const shown = (finalText + interim).trim();
    if (shown) setVoiceUI({ recording: true, text: shown, dim: false });
  };
  recog.onerror = e => {
    recogActive = false;
    const msg = {
      'not-allowed': 'ยังไม่ได้อนุญาตให้ใช้ไมค์ — เปิดสิทธิ์ไมโครโฟนให้เว็บนี้ก่อนนะ',
      'service-not-allowed': 'ยังไม่ได้อนุญาตให้ใช้ไมค์ — เปิดสิทธิ์ไมโครโฟนให้เว็บนี้ก่อนนะ',
      'no-speech': 'ไม่ได้ยินเสียงเลย ลองพูดใหม่อีกครั้ง',
      'audio-capture': 'หาไมโครโฟนไม่เจอ',
      'network': 'ต้องต่อเน็ตเพื่อแปลงเสียงเป็นข้อความ',
    }[e.error] || ('เกิดข้อผิดพลาด: ' + e.error);
    setVoiceUI({ recording: false, text: msg, dim: true });
  };
  recog.onend = () => {
    recogActive = false;
    const raw = finalText.trim();
    if (!raw) { setVoiceUI({ recording: false }); return; }
    const text = normalizeSpokenText(raw); // แปลงเลขคำอ่านไทยเป็นตัวเลขก่อนแกะ
    if (text.length < 3) {
      setVoiceUI({ recording: false, text: 'ได้ยินไม่ชัด ลองพูดใหม่อีกครั้ง', dim: true });
      return;
    }
    setVoiceUI({ recording: false, text: text, dim: false });
    document.getElementById('voiceBox').hidden = true;
    runParsing(text, 'voice');
  };

  try { recog.start(); }
  catch (_) { setVoiceUI({ recording: false, text: 'เริ่มฟังไม่สำเร็จ ลองอีกครั้ง', dim: true }); }
}

// ---------- scan: ข้อความ ----------
function scanFromText() {
  const text = document.getElementById('pasteText').value.trim();
  if (!text) { alert('แปะข้อความก่อนนะ'); return; }
  document.getElementById('pasteText').value = '';
  runParsing(text, 'paste');
}

// ---------- scan: รูป (OCR ด้วย Tesseract.js) ----------
// ปักเวอร์ชันตายตัว (ไม่ใช่ @5 ลอย ๆ) กัน CDN resolve เวอร์ชันไม่ตรงกันระหว่าง
// ตัวไลบรารีกับ core/worker/lang ที่โหลดตามมา ซึ่งเป็นสาเหตุ OCR ค้าง/พังเงียบบนมือถือ
const TESSERACT_VER = '5.1.1';
const TESSERACT_BASE = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VER}/dist/`;
// โมเดลภาษามี 3 ระดับ: _fast (เล็ก/เร็ว) · 4.0.0 (มาตรฐาน) · _best (float LSTM แม่นสุด/ไฟล์ใหญ่สุด)
// ALT ตั้งเป็น _best เพราะภาษาไทยต่างกันชัด — โหลดครั้งแรกนานขึ้น แล้วเบราว์เซอร์แคชไว้
// สลับกลับเป็น '.../4.0.0' ได้ทันทีถ้าวัดแล้วไม่คุ้มกับเวลาที่เสียไป
const TESSERACT_LANG = 'https://tessdata.projectnaptha.com/4.0.0_best';
let tesseractReady = null;
function loadTesseract() {
  if (tesseractReady) return tesseractReady;
  tesseractReady = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = TESSERACT_BASE + 'tesseract.min.js';
    s.onload = res;
    s.onerror = () => { tesseractReady = null; rej(new Error('โหลดไลบรารี OCR ไม่ได้ — เช็คอินเทอร์เน็ตแล้วลองใหม่')); };
    document.head.appendChild(s);
  });
  return tesseractReady;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' ใช้เวลานานเกินไป — เน็ตอาจช้าหรือหลุด')), ms)),
  ]);
}

// ============================================================
// ALT: เตรียมภาพก่อนส่งเข้า OCR
// ------------------------------------------------------------
// เดิมส่งไฟล์จากกล้องเข้า Tesseract ตรง ๆ ซึ่งเป็นจุดที่เสียความแม่นมากที่สุด:
// รูปมือถือใหญ่ 4000px (ตัวอักษรใหญ่เกินจนโมเดลเสียรายละเอียด) แสงไม่เท่ากันทั้งแผ่น
// มีเงามือ และกระดาษไม่ขาวจริง — Tesseract ชอบตัวอักษรสูง ~30–40px บนพื้นขาวดำคม
//
// ท่อใหม่: หมุนตาม EXIF → ปรับขนาดให้พอดี → เทา → ยืด contrast → Sauvola (ไบนารีแบบดูเฉพาะถิ่น)
// Sauvola ดูค่าเฉลี่ยกับส่วนเบี่ยงเบนของ "หน้าต่างรอบจุดนั้น" ไม่ใช่ทั้งภาพ
// เงาหรือแสงเอียงจึงไม่ทำให้ครึ่งแผ่นดำทั้งแถบเหมือน threshold ค่าเดียวทั้งภาพ
// ============================================================
const OCR_MAX_LONG = 1800;  // ใหญ่กว่านี้ไม่ได้แม่นขึ้น มีแต่ช้าลง
const OCR_MIN_LONG = 1200;  // ภาพเล็ก (แคปหน้าจอ) ขยายขึ้นก่อน ตัวอักษรจะได้หนาพอให้โมเดลจับขอบได้

async function ocrLoadBitmap(file) {
  // from-image = หมุนตาม EXIF ให้เอง รูปแนวตั้งจากมือถือจะได้ไม่เข้ามาเป็นแนวนอน
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) {}
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('เปิดไฟล์ภาพไม่ได้'));
      img.src = url;
    });
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

// เทา + ยืด contrast ด้วยเปอร์เซ็นไทล์ (ตัดหัวท้าย 2% กันจุดสว่าง/จุดดำหลุด ๆ ลากค่าไปทั้งภาพ)
function ocrToGray(img) {
  const long = Math.max(img.width, img.height);
  const scale = long > OCR_MAX_LONG ? OCR_MAX_LONG / long
    : long < OCR_MIN_LONG ? OCR_MIN_LONG / long : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  const id = ctx.getImageData(0, 0, w, h);
  const px = id.data;
  const gray = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, g = 0; i < px.length; i += 4, g++) {
    const v = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    gray[g] = v;
    hist[v]++;
  }
  // เปอร์เซ็นไทล์ต้องเล็กพอ: ใบงานทั่วไปมีหมึกแค่ 1–3% ของพื้นที่
  // ถ้าตัดที่ 2% ขอบล่างจะไปตกอยู่ในกองพิกเซลสีขาว → lo กับ hi เท่ากัน → ยืดแล้วดำทั้งภาพ
  const total = w * h, cut = Math.max(1, total * 0.004);
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > cut) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > cut) { hi = v; break; } }
  // กันเหนียวอีกชั้น: ช่วงแคบผิดปกติ = เปอร์เซ็นไทล์ยุบ ไม่ต้องยืดเลยดีกว่ายืดผิด
  if (hi - lo < 24) { lo = 0; hi = 255; }
  const range = Math.max(1, hi - lo);
  for (let g = 0; g < gray.length; g++) {
    gray[g] = Math.max(0, Math.min(255, ((gray[g] - lo) * 255) / range));
  }
  return { canvas: c, ctx, id, gray, w, h };
}

function ocrGrayToCanvas(prep) {
  const { ctx, id, gray, w, h } = prep;
  for (let g = 0, i = 0; g < gray.length; g++, i += 4) {
    id.data[i] = id.data[i + 1] = id.data[i + 2] = gray[g];
    id.data[i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return prep.canvas;
}

// Sauvola: threshold ของแต่ละจุด = mean * (1 + k * (sd / 128 - 1))
// ใช้ integral image เพื่อคิด mean/sd ของหน้าต่างในเวลาคงที่ ไม่งั้นภาพ 1800px ค้างเป็นวินาที
function ocrBinarize(prep) {
  const { gray, w, h } = prep;
  const win = Math.max(15, ((Math.max(w, h) / 28) | 0) | 1); // เลขคี่เสมอ ~1/28 ของด้านยาว
  const r = win >> 1, k = 0.3, R = 128;

  const sum = new Float64Array((w + 1) * (h + 1));
  const sqs = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rs = 0, rq = 0;
    for (let x = 1; x <= w; x++) {
      const v = gray[(y - 1) * w + (x - 1)];
      rs += v; rq += v * v;
      sum[y * (w + 1) + x] = sum[(y - 1) * (w + 1) + x] + rs;
      sqs[y * (w + 1) + x] = sqs[(y - 1) * (w + 1) + x] + rq;
    }
  }
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const a = y0 * (w + 1) + x0, b = y0 * (w + 1) + (x1 + 1);
      const c2 = (y1 + 1) * (w + 1) + x0, d = (y1 + 1) * (w + 1) + (x1 + 1);
      const n = (x1 - x0 + 1) * (y1 - y0 + 1);
      const s = sum[d] - sum[b] - sum[c2] + sum[a];
      const q = sqs[d] - sqs[b] - sqs[c2] + sqs[a];
      const mean = s / n;
      const sd = Math.sqrt(Math.max(0, q / n - mean * mean));
      const th = mean * (1 + k * (sd / R - 1));
      out[y * w + x] = gray[y * w + x] > th ? 255 : 0;
    }
  }
  return { ...prep, gray: out };
}

// ---------- ALT 1A7V: แก้ภาพเอียงก่อนส่งเข้า OCR ----------
// ผู้ใช้ถ่ายใบงานวางบนโต๊ะ ภาพเอียง 3–8 องศาเป็นเรื่องปกติ
// LSTM ของ Tesseract ไวต่อความเอียงมาก เพราะตัวอักษรในบรรทัดเดียวกันตกคนละ baseline
//
// วิธีหามุม: ยิงเส้นแนวนอนแบบเฉียงตามมุมที่ลอง แล้วนับหมึกที่ตกในแต่ละแถว
// มุมที่ทำให้หมึก "กองรวมกันเป็นแถบ ๆ" มากที่สุด = มุมที่บรรทัดตรงที่สุด
// วัดด้วยผลรวมกำลังสองของโปรไฟล์ (ยิ่งกองรวม ยิ่งสูง)
//
// ไม่ต้องหมุนภาพจริงตอนลองมุม — เลื่อนแถวตาม tan(θ) เอา ซึ่งเป็นการวนรอบเดียวต่อมุม
// และลองบนภาพย่อ ~640px เท่านั้น หามุมเสร็จค่อยหมุนภาพเต็มครั้งเดียว
const DESKEW_MAX = 8;        // องศาสูงสุดที่ยอมแก้ให้ — เกินนี้คือถ่ายเอียงจนควรถ่ายใหม่
const DESKEW_STEP = 0.5;     // หยาบ ๆ ก่อน แล้วค่อยละเอียดรอบสอง
const DESKEW_MIN = 0.35;     // เอียงน้อยกว่านี้ไม่ต้องหมุน หมุนแล้วเสียรายละเอียดเปล่า
const DESKEW_WORK = 640;     // ขนาดภาพที่ใช้หามุม

// นับหมึกทีละแถวตามมุมที่ลอง แล้วคืนค่าความ "เป็นแถบ" ของโปรไฟล์
function skewScore(bin, w, h, tan) {
  const span = Math.ceil(Math.abs(tan) * w);
  const rows = new Float64Array(h + span * 2 + 2);
  for (let y = 0; y < h; y++) {
    const base = y + span;
    for (let x = 0; x < w; x++) {
      // ต้อง **ลบ** ไม่ใช่บวก: canvas หมุนบวก = ตามเข็ม (แกน y ชี้ลง)
      // บรรทัดที่เคยตรงจึงกลายเป็น y = y0 + x·tan(θ) การจะรีดให้กลับมาตรงต้องหักออก
      // ถ้าใส่เป็นบวก คะแนนจะไปพีคที่ -θ แล้วคืนมุมกลับด้าน — หมุนแก้ทีก็เอียงเป็นสองเท่า
      if (bin[y * w + x] === 0) rows[base - ((tan * x) | 0)]++;   // 0 = หมึก
    }
  }
  let s = 0;
  for (let i = 0; i < rows.length; i++) s += rows[i] * rows[i];
  return s;
}

// ย่อภาพไบนารีลงมาให้หามุมได้เร็ว
function skewShrink(bin, w, h, target) {
  const scale = Math.min(1, target / Math.max(w, h));
  if (scale >= 1) return { bin, w, h };
  const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
  const out = new Uint8ClampedArray(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy = (y / scale) | 0;
    for (let x = 0; x < nw; x++) {
      out[y * nw + x] = bin[sy * w + ((x / scale) | 0)];
    }
  }
  return { bin: out, w: nw, h: nh };
}

// คืนมุมเอียงเป็นองศา (บวก = ภาพเอียงตามเข็ม ต้องหมุนทวนเข็มเพื่อแก้)
function ocrFindSkew(binPrep) {
  const s = skewShrink(binPrep.gray, binPrep.w, binPrep.h, DESKEW_WORK);
  const scan = (from, to, step) => {
    let bestA = 0, bestS = -1;
    for (let a = from; a <= to + 1e-9; a += step) {
      const sc = skewScore(s.bin, s.w, s.h, Math.tan(a * Math.PI / 180));
      if (sc > bestS) { bestS = sc; bestA = a; }
    }
    return bestA;
  };
  const coarse = scan(-DESKEW_MAX, DESKEW_MAX, DESKEW_STEP);
  // รอบสองละเอียดขึ้นรอบ ๆ มุมที่ได้ — ได้ความละเอียด 0.1 องศาโดยไม่ต้องไล่ทั้งช่วง
  return +scan(coarse - DESKEW_STEP, coarse + DESKEW_STEP, 0.1).toFixed(2);
}

// หมุนภาพเทาตามมุมที่หาได้ แล้วคืนโครงเดียวกับ ocrToGray เพื่อเอาไปไบนารีใหม่
// **หมุนภาพเทา ไม่ใช่ภาพไบนารี** — หมุนภาพขาวดำแล้วขอบตัวอักษรจะแตกเป็นขั้นบันได
function ocrRotateGray(prep, deg) {
  const { gray, w, h } = prep;
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  const sid = sctx.createImageData(w, h);
  for (let g = 0, i = 0; g < gray.length; g++, i += 4) {
    sid.data[i] = sid.data[i + 1] = sid.data[i + 2] = gray[g];
    sid.data[i + 3] = 255;
  }
  sctx.putImageData(sid, 0, 0);

  const rad = -deg * Math.PI / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const nw = Math.ceil(w * cos + h * sin), nh = Math.ceil(w * sin + h * cos);
  const dst = document.createElement('canvas');
  dst.width = nw; dst.height = nh;
  const dctx = dst.getContext('2d', { willReadFrequently: true });
  dctx.fillStyle = '#fff';           // มุมที่ว่างหลังหมุนต้องเป็นขาว ไม่ใช่ดำ
  dctx.fillRect(0, 0, nw, nh);
  dctx.imageSmoothingQuality = 'high';
  dctx.translate(nw / 2, nh / 2);
  dctx.rotate(rad);
  dctx.drawImage(src, -w / 2, -h / 2);

  const id = dctx.getImageData(0, 0, nw, nh);
  const out = new Uint8ClampedArray(nw * nh);
  for (let g = 0, i = 0; g < out.length; g++, i += 4) out[g] = id.data[i];
  return { canvas: dst, ctx: dctx, id, gray: out, w: nw, h: nh };
}

// ทั้งชุด: หามุมจากภาพไบนารี → ถ้าเอียงพอ หมุนภาพเทาแล้วไบนารีใหม่
// คืน { gray, bin, deg } เพื่อให้ผู้เรียกใช้ต่อได้ทั้งสองแบบ
function ocrDeskew(grayPrep) {
  const bin0 = ocrBinarize(grayPrep);
  let deg = 0;
  try { deg = ocrFindSkew(bin0); } catch (_) { deg = 0; }
  if (!isFinite(deg) || Math.abs(deg) < DESKEW_MIN) return { gray: grayPrep, bin: bin0, deg: 0 };
  const rot = ocrRotateGray(grayPrep, deg);
  return { gray: rot, bin: ocrBinarize(rot), deg };
}

// ---------- worker ใช้ซ้ำ ----------
// เดิมสร้าง worker ใหม่แล้วทิ้งทุกครั้งที่สแกน — สแกนติดกันหลายใบเสียเวลา init ซ้ำทุกใบ
let ocrWorker = null, ocrProgress = null;

async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  await withTimeout(loadTesseract(), 30_000, 'โหลดไลบรารี OCR');
  const w = await withTimeout(
    Tesseract.createWorker('tha+eng', 1, {   // 1 = LSTM อย่างเดียว
      workerPath: TESSERACT_BASE + 'worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js',
      langPath: TESSERACT_LANG,
      logger: m => { if (ocrProgress) ocrProgress(m); },
    }),
    60_000, 'เตรียมเครื่องมือ OCR'
  );
  // PSM 6 = มองทั้งรูปเป็นบล็อกข้อความก้อนเดียว
  // ค่าเริ่มต้น (PSM 3) พยายามแบ่งคอลัมน์เอง เจอใบงานที่มีตาราง/หัวกระดาษแล้วแบ่งผิด อ่านสลับคอลัมน์
  await w.setParameters({
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
  });
  ocrWorker = w;
  return w;
}

// ค่าความมั่นใจที่ Tesseract คืนมา (0–100) — เก็บไว้ให้หน้า "ตรวจก่อนบันทึก" เตือนผู้ใช้
let lastOcrConfidence = null;
const OCR_CONF_OK = 70;    // สูงกว่านี้ = เชื่อได้ตามปกติ
const OCR_CONF_MIN = 45;   // ต่ำกว่านี้ = อ่านมั่ว บอกให้ถ่ายใหม่ดีกว่าปล่อยข้อความเพี้ยนเข้าฟอร์ม
const OCR_WORD_CUT = 62;   // คำที่ต่ำกว่านี้ = ไม่ควรเชื่อทั้งช่องที่มันไปโผล่
// ขอผลแบบมีบล็อก เพื่อเอา confidence ราย "คำ" มาชี้ว่าช่องไหนในฟอร์มควรถูกตรวจ
const OCR_OUTPUT = { text: true, blocks: true };
let lastOcrLowWords = [];

// คำที่ Tesseract อ่านมาแบบไม่มั่นใจ — ไล่จาก blocks → ย่อหน้า → บรรทัด → คำ
function collectLowWords(data) {
  const out = [];
  for (const b of (data.blocks || [])) {
    for (const p of (b.paragraphs || [])) {
      for (const l of (p.lines || [])) {
        for (const w of (l.words || [])) {
          const t = (w.text || '').trim();
          if (t.length >= 2 && (w.confidence ?? 100) < OCR_WORD_CUT) out.push(t);
        }
      }
    }
  }
  return out;
}

// ช่องไหนในฟอร์มที่ค่าของมันมาจากคำที่ OCR ไม่มั่นใจ
// หมายเหตุจากการวัดจริง: Tesseract ให้คะแนนความมั่นใจสูงเกินจริงบ่อย —
// อ่าน "ครูมาลี" เป็น "ครูบาลี" ยังได้ 93% ค่าราย "คำ" จึงจับผิดได้แค่ตอนภาพแย่จริง ๆ
// เลยใช้ 2 สัญญาณ: คำที่คะแนนต่ำ + คะแนนรวมทั้งรูปที่ต่ำกว่าเกณฑ์ (ตอนนั้นทุกช่องน่าสงสัยหมด)
function fieldsToDoubleCheck(p) {
  const low = lastOcrLowWords;
  if (lastOcrConfidence != null && lastOcrConfidence < OCR_CONF_OK) {
    return ['subject', 'teacher', 'detail'].filter(k =>
      k === 'detail' ? p.detail : k === 'teacher' ? p.teacher : p.detected.subject);
  }
  const out = [];
  const hit = v => {
    if (!v || !low.length) return false;
    const kv = ocrKey(v);
    return low.some(w => { const kw = ocrKey(w); return kw.length > 1 && (kv.includes(kw) || kw.includes(kv)); });
  };
  if (p.detected.subjectFuzzy || hit(p.subject)) out.push('subject');
  if (hit(p.teacher)) out.push('teacher');
  if (hit(p.detail)) out.push('detail');
  return out;
}

// ---------- ALT: ครอบกรอบก่อนอ่าน ----------
// กรอบเก็บเป็นสัดส่วน 0–1 ของภาพ เวทีแสดงผลตั้ง aspect-ratio ตามภาพ
// พิกัดบนจอกับพิกัดในภาพจึงเป็นสัดส่วนเดียวกันตรง ๆ ไม่ต้องแปลงไปมา
let cropState = null;
const CROP_MIN = 0.08;   // กรอบเล็กสุด 8% ของด้านนั้น กันลากพลาดจนเหลือจุดเดียว
const CROP_GRAB = 26;    // ระยะที่นับว่าจับมุมอยู่ (px บนจอ)

async function scanFromPhoto(file) { return openCropFor(file, 'ocr'); }
async function pickWidgetPhoto(file) { return openCropFor(file, 'widget'); }

// mode: 'ocr' = ครอบเพื่ออ่านตัวหนังสือ · 'widget' = ครอบเพื่อเอาไปเป็นภาพวิดเจ็ต
async function openCropFor(file, mode) {
  try {
    const bmp = await ocrLoadBitmap(file);
    // วิดเจ็ตเป็นช่องแนวนอน ตั้งกรอบเริ่มต้นให้ใกล้สัดส่วนนั้นไว้เลย
    const box = mode === 'widget'
      ? { x: .04, y: Math.max(0, .5 - (bmp.width * .92 / 2.1) / bmp.height / 2), w: .92,
          h: Math.min(.92, (bmp.width * .92 / 2.1) / bmp.height) }
      : { x: .06, y: .06, w: .88, h: .88 };
    cropState = { bmp, box, drag: null, mode };
    const h2 = document.querySelector('#scr-crop .scan-h');
    if (h2) h2.textContent = mode === 'widget' ? 'ครอบภาพสำหรับวิดเจ็ต' : 'ครอบเฉพาะส่วนที่เป็นโจทย์';
    const okBtn = document.querySelector('#scr-crop .fm-save');
    if (okBtn) okBtn.textContent = mode === 'widget' ? 'ใช้ภาพนี้' : 'อ่านเฉพาะกรอบนี้';
    const wholeBtn = document.querySelector('#scr-crop .crop-act .fm-cancel');
    if (wholeBtn) wholeBtn.textContent = mode === 'widget' ? 'ใช้ทั้งรูป' : 'อ่านทั้งรูป';
    const stage = document.getElementById('cropStage');
    const img = document.getElementById('cropImg');
    img.src = URL.createObjectURL(file);
    stage.style.aspectRatio = bmp.width + ' / ' + bmp.height;
    paintCrop();
    go('scr-crop');
  } catch (e) {
    console.error('[OCR]', e);
    alert('เปิดไฟล์ภาพนี้ไม่ได้ — ลองเลือกไฟล์อื่น (JPG หรือ PNG)');
  }
}

function paintCrop() {
  if (!cropState) return;
  const b = cropState.box;
  const box = document.getElementById('cropBox');
  box.style.left = (b.x * 100) + '%';
  box.style.top = (b.y * 100) + '%';
  box.style.width = (b.w * 100) + '%';
  box.style.height = (b.h * 100) + '%';
  // ม่านมืดนอกกรอบ: เจาะรูด้วย clip-path ให้เห็นเฉพาะส่วนที่จะถูกอ่าน
  const x1 = (b.x * 100), y1 = (b.y * 100), x2 = ((b.x + b.w) * 100), y2 = ((b.y + b.h) * 100);
  document.getElementById('cropShade').style.clipPath =
    `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${y1}%, ${x1}% ${y1}%, ${x1}% ${y2}%, ${x2}% ${y2}%, ${x2}% ${y1}%, 0 ${y1}%)`;
  const px = Math.round(cropState.bmp.width * b.w) + '×' + Math.round(cropState.bmp.height * b.h);
  const hint = document.getElementById('cropHint');
  if (hint) hint.textContent = 'กรอบที่จะอ่าน ' + px + ' px · ลากในรูปเพื่อวาดกรอบใหม่ · ลากมุมเพื่อปรับขนาด';
}

function cropPos(e, rect) {
  return {
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
  };
}

function initCrop() {
  const stage = document.getElementById('cropStage');
  if (!stage) return;
  stage.addEventListener('pointerdown', e => {
    if (!cropState) return;
    const rect = stage.getBoundingClientRect();
    const p = cropPos(e, rect);
    const b = cropState.box;
    const near = (px, py) => Math.hypot((px - p.x) * rect.width, (py - p.y) * rect.height) < CROP_GRAB;
    // จับมุมไหนอยู่ไหม → ปรับขนาดจากมุมนั้น (ยึดมุมตรงข้ามไว้)
    const corners = [
      ['tl', b.x, b.y, b.x + b.w, b.y + b.h], ['tr', b.x + b.w, b.y, b.x, b.y + b.h],
      ['bl', b.x, b.y + b.h, b.x + b.w, b.y], ['br', b.x + b.w, b.y + b.h, b.x, b.y],
    ];
    const hit = corners.find(c => near(c[1], c[2]));
    if (hit) cropState.drag = { mode: 'corner', ax: hit[3], ay: hit[4] };
    else if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h)
      cropState.drag = { mode: 'move', dx: p.x - b.x, dy: p.y - b.y };
    else cropState.drag = { mode: 'corner', ax: p.x, ay: p.y }; // ลากพื้นที่ว่าง = วาดกรอบใหม่
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', e => {
    if (!cropState || !cropState.drag) return;
    const rect = stage.getBoundingClientRect();
    const p = cropPos(e, rect);
    const b = cropState.box, d = cropState.drag;
    if (d.mode === 'move') {
      b.x = Math.max(0, Math.min(1 - b.w, p.x - d.dx));
      b.y = Math.max(0, Math.min(1 - b.h, p.y - d.dy));
    } else {
      b.x = Math.min(d.ax, p.x); b.w = Math.max(CROP_MIN, Math.abs(p.x - d.ax));
      b.y = Math.min(d.ay, p.y); b.h = Math.max(CROP_MIN, Math.abs(p.y - d.ay));
      if (b.x + b.w > 1) b.w = 1 - b.x;
      if (b.y + b.h > 1) b.h = 1 - b.y;
    }
    paintCrop();
  });
  const end = () => { if (cropState) cropState.drag = null; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

function cancelCrop() {
  if (cropState && cropState.bmp.close) cropState.bmp.close();
  cropState = null;
  go('scr-scan');
}

async function confirmCrop(whole) {
  if (!cropState) { go('scr-scan'); return; }
  const { bmp, box, mode } = cropState;
  const b = whole ? { x: 0, y: 0, w: 1, h: 1 } : box;
  const sx = Math.round(bmp.width * b.x), sy = Math.round(bmp.height * b.y);
  const sw = Math.max(1, Math.round(bmp.width * b.w)), sh = Math.max(1, Math.round(bmp.height * b.h));
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  cropState = null;

  if (mode === 'widget') { saveWidgetPhoto(c); return; }
  go('scr-scan');
  await runOcrOn(c, whole ? 'ทั้งรูป' : 'ครอบกรอบ');
}

// ---------- ALT: รูปโปรไฟล์ของตัวเอง ----------
// เดิมรูปมาจากบัญชี Google เท่านั้น ใครไม่ล็อกอินก็ได้แค่ตัวอักษรตัวแรกของชื่อ
// เก็บในเครื่องเหมือนภาพพื้นหลังกับภาพวิดเจ็ต ไม่ต้องมีบัญชีก็ตั้งรูปได้
const AV_KEY = 'studentos.alt.avatar';

function userAvatar() {
  try { return localStorage.getItem(AV_KEY) || ''; } catch (_) { return ''; }
}

async function pickAvatar(file) {
  let bmp;
  try { bmp = await ocrLoadBitmap(file); }
  catch (_) { showToast({ title: 'เปิดไฟล์ภาพไม่ได้', body: 'ลองเลือกภาพอื่นดูอีกที' }); return; }
  // ครอบเป็นสี่เหลี่ยมจัตุรัสจากกลางภาพ — กรอบรูปโปรไฟล์เป็นจัตุรัส
  // ถ้าไม่ครอบก่อน ภาพแนวตั้งจะโดน object-fit ตัดหัวหรือตัดคางทีหลังอยู่ดี
  const side = Math.min(bmp.width, bmp.height);
  const sx = Math.round((bmp.width - side) / 2);
  const sy = Math.round((bmp.height - side) / 2);
  const out = document.createElement('canvas');
  out.width = out.height = 256;          // แสดงจริงแค่ 60px ที่ 2x-3x ก็ยังเหลือเฟือ
  out.getContext('2d').drawImage(bmp, sx, sy, side, side, 0, 0, 256, 256);
  const data = out.toDataURL('image/jpeg', 0.82);
  try { localStorage.setItem(AV_KEY, data); }
  catch (_) {
    showToast({ title: 'ที่เก็บในเครื่องเต็ม 😅', body: 'ลบภาพพื้นหลังหรือภาพวิดเจ็ตออกสักอันแล้วลองใหม่' });
    return;
  }
  haptic('done');
  renderProfile();
  showToast({ title: 'เปลี่ยนรูปโปรไฟล์แล้ว 🖼', body: 'เอาออกได้ที่จอตั้งค่า' });
}

function clearAvatar() {
  try { localStorage.removeItem(AV_KEY); } catch (_) {}
  renderProfile();
  showToast({ title: 'เอารูปโปรไฟล์ออกแล้ว', body: 'กลับไปใช้ตัวอักษรแรกของชื่อเหมือนเดิม' });
}

// ย่อก่อนเก็บเหมือนพื้นหลัง — วิดเจ็ตกว้างไม่เกิน ~1000px ก็เกินพอแล้ว
function saveWidgetPhoto(canvas) {
  const max = 1000;
  const scale = Math.min(1, max / canvas.width);
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
  const data = out.toDataURL('image/jpeg', 0.72);
  try {
    localStorage.setItem(WG_PHOTO_KEY, data);
  } catch (_) {
    showToast({ title: 'ภาพใหญ่เกินไป 😅', body: 'ที่เก็บในเครื่องเต็ม — ลองครอบให้แคบลงหรือเลือกภาพที่เล็กกว่านี้' });
    go('scr-profile');
    return;
  }
  try { localStorage.setItem(WG_KEY, 'photo'); } catch (_) {}
  renderMenu(); renderAppearance();
  haptic('done');
  go('scr-menu');
  showToast({ title: 'ตั้งภาพวิดเจ็ตแล้ว 🖼', body: 'เปลี่ยนหรือเอาออกได้ที่แท็บ “ฉัน”' });
}

async function runOcrOn(source, how) {
  const st = document.getElementById('ocrStatus');
  const barWrap = document.getElementById('ocrBarWrap');
  const bar = document.getElementById('ocrBar');
  const t0 = performance.now();
  try {
    barWrap.hidden = false; bar.style.width = '4%';
    st.textContent = '🖼 กำลังปรับภาพให้อ่านง่ายขึ้น…';
    startFunFacts(document.getElementById('scanFact')); // มีอะไรให้อ่านระหว่างรอ OCR
    // ปรับภาพก่อน แล้วค่อยโหลดโมเดล — ผู้ใช้จะได้เห็นความคืบหน้าตั้งแต่วินาทีแรก
    const gray0 = ocrToGray(source);
    // แก้ภาพเอียงก่อน แล้วค่อยใช้ผลที่ตรงแล้วไปทุก pass ที่เหลือ
    const sk = ocrDeskew(gray0);
    const gray = sk.gray;
    const binCanvas = ocrGrayToCanvas(sk.bin);
    bar.style.width = '12%';

    st.textContent = '⏳ กำลังเตรียมโมเดล OCR… (ครั้งแรกอาจรอนานหน่อย)';
    ocrProgress = m => {
      if (m.status === 'recognizing text') {
        const p = 15 + Math.round(m.progress * 80);
        bar.style.width = p + '%';
        st.textContent = '📖 AI กำลังอ่านใบงาน… ' + Math.round(m.progress * 100) + '%';
      } else if (m.status) {
        st.textContent = '⏳ ' + m.status + '…';
      }
    };
    const worker = await getOcrWorker();

    let { data } = await withTimeout(worker.recognize(binCanvas, {}, OCR_OUTPUT), 90_000, 'อ่านรูปภาพ');
    let pass = 'binarized';

    // รอบสำรอง 1: ไบนารีทำงานไม่ดีกับกระดาษสีหรือรูปที่ถ่ายจากจอ (เส้นตัวอักษรขาดเป็นจุด)
    // ถ้ารอบแรกได้คะแนนต่ำ ลองอ่านจากภาพเทาที่ยังไม่ไบนารี แล้วเก็บอันที่ดีกว่า
    if ((data.confidence || 0) < OCR_CONF_OK) {
      st.textContent = '🔁 ลองอ่านอีกแบบให้ชัดขึ้น…';
      const soft = await withTimeout(worker.recognize(ocrGrayToCanvas(gray), {}, OCR_OUTPUT), 90_000, 'อ่านรูปภาพ');
      if ((soft.data.confidence || 0) > (data.confidence || 0)) { data = soft.data; pass = 'grayscale'; }
    }
    // รอบสำรอง 2: ยังต่ำอยู่ → เปลี่ยนวิธีมองหน้ากระดาษเป็น PSM 4 (หลายย่อหน้าเรียงลงมา)
    // ใบงานที่มีบล็อกข้อความแยกกันหลายก้อน PSM 6 จะรวบเป็นก้อนเดียวแล้วอ่านสลับบรรทัด
    if ((data.confidence || 0) < OCR_CONF_OK) {
      st.textContent = '🔁 ลองมองหน้ากระดาษอีกแบบ…';
      await worker.setParameters({ tessedit_pageseg_mode: '4' });
      const alt = await withTimeout(worker.recognize(binCanvas, {}, OCR_OUTPUT), 90_000, 'อ่านรูปภาพ');
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      if ((alt.data.confidence || 0) > (data.confidence || 0)) { data = alt.data; pass = 'psm4'; }
    }

    ocrProgress = null;
    stopFunFacts(document.getElementById('scanFact'));
    st.textContent = ''; barWrap.hidden = true;

    const text = normalizeOcrText(data.text); // OCR ไทยเว้นวรรคทีละตัวอักษร ต้องยุบก่อนแกะ
    const conf = Math.round(data.confidence || 0);
    lastOcrConfidence = conf;
    lastOcrLowWords = collectLowWords(data);
    // บรรทัดเดียวก๊อปไปทำตารางวัดผลได้เลย (รอบวัดผลกับรูปจริง)
    console.debug(`[ALT OCR] conf=${conf}% pass=${pass} how=${how || '-'} chars=${text.length} `
      + `lowWords=${lastOcrLowWords.length} ms=${Math.round(performance.now() - t0)} size=${gray.w}×${gray.h} `
      + `skew=${sk.deg}°`);

    if (text.length < 5 || conf < OCR_CONF_MIN) {
      lastOcrConfidence = null;
      alert('อ่านตัวหนังสือจากรูปนี้ไม่ค่อยออก (ความมั่นใจ ' + conf + '%)\n\n'
        + 'ลองอีกที: ถ่ายให้เห็นเฉพาะส่วนที่เป็นโจทย์ · วางกล้องขนานกับกระดาษ · เลี่ยงเงามือทับตัวหนังสือ\n'
        + 'หรือใช้ "แปะข้อความ" แทน — เร็วกว่าและแม่นกว่า');
      return;
    }
    if (conf < OCR_CONF_OK) {
      showToast({ title: 'อ่านได้ แต่ไม่ค่อยมั่นใจ 🤔',
        body: 'ความมั่นใจ ' + conf + '% — ช่วยตรวจให้ดีก่อนกดบันทึกนะ' });
    }
    runParsing(text, 'ocr');
  } catch (e) {
    ocrProgress = null;
    lastOcrConfidence = null;
    stopFunFacts(document.getElementById('scanFact'));
    st.textContent = ''; barWrap.hidden = true;
    console.error('[OCR]', e);
    alert('อ่านรูปไม่สำเร็จ: ' + e.message + '\n\nใช้วิธี "แปะข้อความจาก LINE" แทนได้เลย — เร็วกว่าและแม่นกว่าด้วย');
  }
}

// ---------- profile ----------
function saveProfile() {
  state.settings.name = document.getElementById('pName').value.trim();
  state.settings.freeHours = Math.max(0.5, +document.getElementById('pFree').value || 2);
  save(); renderAll();
  alert('บันทึกแล้ว ✓');
}

// ---------- Web Push: สมัครรับการเตือนแม้ปิดแอป ----------
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const b64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

let pushState = 'unknown'; // unknown | on | off | unsupported | need-login

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && !!window.VAPID_PUBLIC_KEY;
}

async function refreshPushState() {
  if (!pushSupported()) { pushState = 'unsupported'; return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    pushState = sub ? 'on' : 'off';
  } catch (_) { pushState = 'off'; }
}

async function subscribePush() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(window.VAPID_PUBLIC_KEY),
    });
  }
  // เก็บ subscription ไว้บน cloud เพื่อให้เซิร์ฟเวอร์ส่ง push ได้ (ต้องล็อกอิน)
  if (sb && currentUser) {
    const j = sub.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert({
      user_id: currentUser.id,
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      tz_offset: -new Date().getTimezoneOffset(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) { console.warn('[push] save failed:', error.message); return false; }
  }
  pushState = 'on';
  return true;
}

async function enableNotif() {
  if (!('Notification' in window)) {
    if (isIOS() && !isStandalone()) { showInstallGuide(); return; } // สาเหตุคือยังไม่ได้ติดตั้ง แก้ตรงนี้ทันที
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { renderProfile(); return; }
  // ยิงของจริงทันทีหนึ่งดอก — ผู้ใช้จะได้เห็นกับตาว่ามันทำงาน ไม่ใช่แค่ปุ่มเปลี่ยนสี
  await notify('เปิดแจ้งเตือนแล้ว 🔔',
    (who() ? who() + ' ' : '') + 'จะเตือนก่อนถึงกำหนดส่ง — ลองกด "ทดสอบ" ได้ทุกเมื่อ', 'studentos-alt-on');
  try {
    const ok = await subscribePush();
    if (ok && !(sb && currentUser)) {
      showToast({ title: 'เปิดการเตือนแล้ว 🔔', body: 'ล็อกอินด้วย Google เพิ่ม เพื่อให้เตือนได้แม้ปิดแอป' });
    } else if (ok) {
      showToast({ title: 'เปิดการเตือนแล้ว 🔔', body: 'จะเตือนก่อนถึงกำหนดส่ง แม้ปิดแอปอยู่' });
    }
  } catch (e) {
    console.warn('[push] subscribe failed:', e.message);
    showToast({ title: 'เปิดการเตือนในแอปแล้ว', body: 'แต่ยังตั้งการเตือนนอกแอปไม่ได้ ลองใหม่อีกครั้งภายหลัง' });
  }
  renderProfile();
  checkReminders();
}

// ---------- ข้อความเตือนสไตล์เพื่อน (แนว Duolingo) ----------
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

// ALT: ทุกคำชม/คำเตือนเรียกชื่อที่ผู้ใช้บอกไว้ตอนทำความรู้จัก
// ยังไม่ได้บอกชื่อ (กดข้าม) → ตัดคำเรียกทิ้ง ประโยคยังอ่านรู้เรื่องเหมือนเดิม
function reminderCopy(t, now) {
  const h = t.due ? (new Date(t.due) - now) / 3.6e6 : null;
  const s = t.subject;
  const hr = h != null ? Math.max(1, Math.round(h)) : 0;
  const nm = who();
  const call = nm ? nm : 'คุณ';           // ใช้แทนคำเรียกกลางประโยค
  const hey = nm ? nm + ' ' : '';         // ใช้ขึ้นต้นประโยค
  if (h != null && h < 0) return { title: 'อุ๊ย เลยกำหนดแล้ว! 😬', body: pick([
    `${hey}${s} เลยเวลาส่งไปแล้วน้า… แต่ยังไม่สายเกินไป รีบเคลียร์เลย!`,
    `${s} ยังค้างอยู่นะ ครูกำลังมองอยู่ 👀 ส่งตอนนี้ยังพอทัน!`,
    `เฮ้ ${call}! ${s} หนีไม่พ้นหรอกน้า ทำให้จบวันนี้เถอะ 🙏`,
  ]) };
  if (h != null && h <= 3) return { title: '⏰ เหลือเวลาไม่มากแล้ว!', body: pick([
    `${hey}${s} เหลือแค่ ${hr} ชม.! ลุยเลยตอนนี้ เดี๋ยวไม่ทันน้า`,
    `นับถอยหลัง ${hr} ชม. สำหรับ ${s} — สู้ ๆ ${call}ทำได้! 💪`,
    `${s} กำลังจะหมดเวลาแล้ว ${hey}รีบอีกนิดเดียว ใกล้เสร็จแล้ว!`,
  ]) };
  if (h != null && h <= 12) return { title: 'อย่าเพิ่งลืมนะ 📚', body: pick([
    `${s} รออยู่ เหลือ ${hr} ชม. ทำตอนนี้สบายกว่าตอนดึกเยอะ 😉`,
    `${hey}แอบเตือนเรื่อง ${s} หน่อย~ เริ่มเลยดีกว่า จะได้พักแบบไม่มีห่วง`,
    `${s} ยังรอ${call}อยู่นะ เริ่มจากนิดเดียวก็ได้ เดี๋ยวก็เสร็จ!`,
  ]) };
  return { title: 'มีงานรออยู่นะ ✨', body: `${s} — ${t.detail} (${fmtDue(t.due, now, t)})` };
}

function celebrateCopy(allDone) {
  const nm = who();
  const hey = nm ? nm + ' ' : '';
  return allDone
    ? { title: nm ? `เคลียร์หมดแล้ว ${nm}! 🎉` : 'เคลียร์หมดแล้ว! 🎉', body: pick([
        `เก่งมาก${hey ? ' ' + nm : ''}! งานหมดเกลี้ยง วันนี้พักได้เต็มที่เลย`,
        `สุดยอด! ${hey}ไม่เหลืองานค้างสักงาน ภูมิใจในตัวเองได้เลย 💙`,
      ]) }
    : { title: 'เยี่ยม! เสร็จอีกงาน 💪', body: pick([
        `${hey}ทำได้ดีมาก ไปต่องานถัดไปกันเลย!`,
        `อีกนิดเดียว ${hey}ใกล้เคลียร์หมดแล้ว สู้ ๆ!`,
        `เก่งจัง${nm ? ' ' + nm : ''}! ทุกงานที่เสร็จคือก้าวเล็ก ๆ สู่เป้าหมาย ✨`,
      ]) };
}

// ---------- toast ในแอป ----------
let toastTimer = null;
function showToast(copy) {
  const phone = document.querySelector('.phone');
  if (!phone) return;
  let el = document.getElementById('appToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appToast'; el.className = 'toast';
    // ALT: มีปุ่ม "เลิกทำ" เพิ่มมา — ปัดพลาดแล้วต้องย้อนได้ในที่เดียวกับที่แจ้งผล
    el.innerHTML = `<img class="tav brand-light" src="logo-splash.png" alt=""><img class="tav brand-dark" src="logo-splash-light.png" alt=""><div class="tc"><div class="tt"></div><div class="tb"></div></div><button class="tu" type="button" hidden>เลิกทำ</button>`;
    el.onclick = e => { if (!e.target.closest('.tu')) el.classList.remove('show'); };
    phone.appendChild(el);
  }
  el.querySelector('.tt').textContent = copy.title;
  el.querySelector('.tb').textContent = copy.body;
  const undo = el.querySelector('.tu');
  undo.hidden = !copy.undo;
  undo.onclick = copy.undo ? () => { copy.undo(); el.classList.remove('show'); } : null;
  void el.offsetWidth; // บังคับ reflow ให้ transition ทำงาน
  setTimeout(() => el.classList.add('show'), 30);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 6000);
}

// ---------- ALT: ยิงแจ้งเตือนของจริง ----------
// เดิมใช้ new Notification() ตรง ๆ ซึ่ง "บน Chrome มือถือใช้ไม่ได้เลย" — มันโยน error ทิ้ง
// ทางที่ใช้ได้ทุกที่คือให้ service worker เป็นคนแสดงแทน (และแตะแล้วเปิดแอปกลับมาได้ด้วย)
async function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const opt = {
    body, tag: tag || 'studentos-alt',
    icon: 'icon-alt-192.png', badge: 'icon-alt-192.png',
    renotify: true, data: { url: location.pathname },
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opt);
      return true;
    }
  } catch (e) { console.warn('[notify] sw failed:', e.message); }
  try { new Notification(title, opt); return true; }   // เดสก์ท็อปที่ไม่มี SW
  catch (e) { console.warn('[notify] failed:', e.message); return false; }
}

// ปุ่ม "ทดสอบ" ในแท็บฉัน — พิสูจน์ว่ามันเด้งจริงบนเครื่องนี้ ไม่ต้องรอถึงกำหนดส่ง
async function testNotify() {
  if (Notification.permission !== 'granted') { enableNotif(); return; }
  const ok = await notify('ทดสอบแจ้งเตือน 🔔',
    (who() ? who() + ' ' : '') + 'ถ้าเห็นข้อความนี้แปลว่าแจ้งเตือนใช้งานได้แล้ว', 'studentos-alt-test');
  showToast(ok
    ? { title: 'ส่งแจ้งเตือนแล้ว', body: 'ถ้าไม่เห็น ลองเช็คการตั้งค่าแจ้งเตือนของเครื่อง/เบราว์เซอร์' }
    : { title: 'ยังส่งไม่ได้', body: 'เบราว์เซอร์นี้บล็อกการแจ้งเตือนอยู่' });
}

function checkReminders() {
  const now = new Date();
  const canNotify = ('Notification' in window) && Notification.permission === 'granted';
  let touched = false;
  for (const t of pendingTasks()) {
    if (!t.due) continue;
    const hLeft = (new Date(t.due) - now) / 3.6e6;
    // เตือน 2 จังหวะต่องาน: ตอนเหลือ < 24 ชม. และย้ำอีกทีตอนเหลือ < 3 ชม.
    const stage = hLeft <= 0 ? null : hLeft <= 3 ? 'soon' : hLeft <= 24 ? 'day' : null;
    if (!stage) continue;
    if (t.remindedStage === stage || (stage === 'day' && t.remindedAt)) continue;
    if (canNotify) {
      const c = reminderCopy(t, now);
      notify(c.title, c.body, 'studentos-alt-' + t.id);
    }
    t.remindedAt = now.toISOString();
    t.remindedStage = stage;
    touched = true;
  }
  if (touched) save();
}

// เตือนแบบ toast ตอนเปิดแอป (ครั้งเดียวต่อการเปิด) ถ้ามีงานด่วน
let openNudgeShown = false;
function openNudge() {
  if (openNudgeShown) return;
  const now = new Date();
  const soon = sortByPriority(pendingTasks(), now)
    .find(t => { const h = t.due ? (new Date(t.due) - now) / 3.6e6 : null; return h != null && h <= 24; });
  if (soon) { openNudgeShown = true; setTimeout(() => showToast(reminderCopy(soon, now)), 900); }
}

// ---------- sample / clear ----------
function loadSample() {
  const now = new Date();
  const mk = (h) => new Date(now.getTime() + h * 3.6e6).toISOString();
  state.tasks.push(
    { id: uid(), subject: 'ฟิสิกส์', detail: 'ทำโจทย์บทที่ 4 ข้อ 1–10', teacher: 'ครูสมชาย', scorePct: 20, estMin: 40, isExam: false, due: mk(5), done: false },
    { id: uid(), subject: 'ภาษาอังกฤษ', detail: 'เขียน Essay หัวข้อ My Dream', teacher: '', scorePct: 10, estMin: 90, isExam: false, due: mk(30), done: false },
    { id: uid(), subject: 'คณิตศาสตร์', detail: 'แบบฝึกหัด 2.3', teacher: '', scorePct: null, estMin: 30, isExam: false, due: mk(72), done: false },
    { id: uid(), subject: 'สังคมศึกษา', detail: 'อ่านสอบ quiz บทที่ 2', teacher: '', scorePct: 15, estMin: 45, isExam: true, due: mk(75), done: false },
  );
  save(); go('scr-home');
}

function clearAll() {
  if (confirm('ลบข้อมูลทุกอย่าง (งานทั้งหมด + การตั้งค่า) แน่ใจนะ?')) {
    localStorage.removeItem(STORE_KEY);
    // ธีมลับกลับไปล็อกด้วย — ล้างข้อมูลแล้วต้องได้แอปเหมือนเปิดครั้งแรกจริง ๆ
    for (const s of Object.values(SECRETS)) { try { localStorage.removeItem(s.store); } catch (_) {} }
    // รวมถึงธงที่โค้ดในตั้งค่าเปิดเหรียญไว้ ไม่งั้นล้างแล้วเหรียญยังครบอยู่
    try { localStorage.removeItem(ALLBADGE_KEY); } catch (_) {}
    try { localStorage.removeItem(GENESIS_KEY); } catch (_) {}
    applySecrets();
    applyGenesisUnlock();
    if (['deepocean', 'earth2', 'sweet', 'genesis'].includes(themePref())) setTheme('system');
    state = { tasks: [], settings: { name: '', freeHours: 2 } };
    renderAll();
  }
}

// ปุ่มลับในแท็บ "ฉัน" — ล็อกธีมลับกลับเหมือนยังไม่เคยปลดล็อก (ไว้ลองอีสเตอร์เอกก์ใหม่)
function relockSecrets() {
  for (const s of Object.values(SECRETS)) { try { localStorage.removeItem(s.store); } catch (_) {} }
  try { localStorage.removeItem(GENESIS_KEY); } catch (_) {}
  // เหรียญที่เปิดด้วยโค้ดก็ล็อกกลับพร้อมกัน — ปุ่มนี้ต้องพากลับไปจุดเริ่มต้นได้จริง
  try { localStorage.removeItem(ALLBADGE_KEY); } catch (_) {}
  applySecrets();
  applyGenesisUnlock();
  if (['deepocean', 'earth2', 'sweet', 'genesis'].includes(themePref())) setTheme('system');
  tapCount = 0; tapTheme = '';
  renderProfile();
  // ไม่บอกวิธีปลดล็อกซ้ำ — ของลับที่บอกวิธีไว้ข้าง ๆ ก็ไม่ใช่ของลับแล้ว
  showToast({ title: 'ล็อกธีมลับกลับแล้ว 🔒', body: 'ธีมลับหายไปจากรายการเรียบร้อย' });
}

// ---------- ALT 1A6M3: ช่องใส่โค้ดในหน้าตั้งค่า ----------
// โค้ดชุดนี้ผูกกับรุ่น 1A6M3 เท่านั้น: ถ้า APP_VERSION ขยับไปรุ่นอื่นเมื่อไหร่
// ช่องใส่โค้ดจะหายไปเองและโค้ดจะหมดอายุทันที ไม่ต้องไล่ลบทีละจุด
// จะให้รุ่นถัดไปใช้ได้ต้องตั้งใจแก้บรรทัดล่างนี้เอง
const CODE_VERSION = '1A7V';
function codesLive() { return APP_VERSION === CODE_VERSION; }

// เก็บเป็นลายนิ้วมือ SHA-256 ไม่ใช่ตัวโค้ด — เปิดซอร์สอ่านก็ยังไม่รู้ว่าต้องพิมพ์อะไร
// และย้อนจากค่าพวกนี้กลับไปเป็นโค้ดไม่ได้
const CODE_HASH = {
  eabeafccf40bb03ff2b1e4f02f6ab3531864c9ccc1472b8fa7eb6a1ff3a039b7: 'grant',
  '05f0e0d52558bdff80cda651d7c67461d5324b18776d44e183ecd8b89e418b2b': 'wipe',
  '62ed3ce6a794c046bec29578ffcd0741d67de59b5b017e35e8156f131e7efebd': 'tokens',
  '6f9d5fc713a77486673d90d9e5f9c71bdcd1c88308537b182fc0784beaf48226': 'grantAll',
  '2a5854678809fc5e5e632af6454ab997ef5a6a9cc0f433df499a4cc4b90e17cc': 'luckOn',
  '84d74768527898c47b601208e11b640b65388fe251deb2d1da036ae30f2316b7': 'luckOff',
};
const CODE_TOKEN_GRANT = 1000;

async function codeFingerprint(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function redeemCode() {
  const input = document.getElementById('codeInput');
  const msg = document.getElementById('codeMsg');
  if (!input) return;
  const say = (t, bad) => {
    if (!msg) return;
    msg.textContent = t || '';
    msg.hidden = !t;
    msg.classList.toggle('bad', !!bad);
  };
  const raw = input.value.trim();
  if (!raw) { say('ยังไม่ได้พิมพ์อะไรเลย', true); return; }
  // crypto.subtle มีเฉพาะบน https กับ localhost — เปิดผ่าน IP วงแลนจะไม่มีให้ใช้
  if (!codesLive() || !(window.crypto && crypto.subtle)) { say('โค้ดนี้ใช้ไม่ได้', true); return; }

  let kind = '';
  try { kind = CODE_HASH[await codeFingerprint(raw)] || ''; } catch (_) { kind = ''; }
  if (!kind) {
    // บอกแค่ว่าไม่ผ่าน ไม่ใบ้ว่าใกล้เคียงแค่ไหนหรือมีโค้ดอะไรอยู่บ้าง
    say('โค้ดนี้ใช้ไม่ได้', true);
    haptic('snooze');
    input.select();
    return;
  }
  input.value = '';
  say('');
  if (kind === 'grant') codeGrantAll();
  else if (kind === 'wipe') codeWipeAll();
  else if (kind === 'tokens') codeGrantTokens();
  else if (kind === 'grantAll') codeGrantEverything();
  else if (kind === 'luckOn') codeSetLuck(true);
  else if (kind === 'luckOff') codeSetLuck(false);
}

// เปิด/ปิดโชคเพิ่ม — เก็บเป็นธงในเครื่อง ไม่ผูกกับยอดโทเคน
function codeSetLuck(on) {
  try { on ? localStorage.setItem(LUCK_KEY, '1') : localStorage.removeItem(LUCK_KEY); } catch (_) {}
  haptic('done');
  if (on) splashBurst(20, 'egg-star');
  renderAll();
  const od = currentOdds();
  showToast(on
    ? { title: 'โชคเพิ่มขึ้นแล้ว ✦', body: 'โอกาสได้ของหายากขึ้นเป็น 10 เท่า — ตอนนี้ Rare ' + od.rare.toFixed(1) + '%' }
    : { title: 'โชคกลับเป็นปกติ', body: 'อัตราการสุ่มกลับไปเท่าเดิมทุกระดับ' });
}

// แจกธีมที่ต้องสุ่ม/ซื้อ · withSecret = แจกระดับลับด้วยไหม
function grantThemes(withSecret) {
  const ts = tokenState();
  ts.skins = ts.skins || {};
  THEME_GACHA
    .filter(id => withSecret || !THEME_SECRET.includes(id))
    .forEach(id => { ts.skins[id] = Math.max(1, ts.skins[id] || 0); });
  ts.bought = Object.keys(THEME_SHOP);
  saveTokenState(ts);
  applyThemeLocks();
}

// โค้ดใบที่ให้ทุกอย่างจริง ๆ รวมถึงธีมระดับลับ
function codeGrantEverything() {
  codeGrantAll();
  grantThemes(true);
  renderAll();
  setTimeout(() => showToast({ title: 'ปลดล็อกครบทุกอย่างจริง ๆ ✦', body: 'รวมของที่ไม่ได้บอกว่ามีด้วย' }), 900);
}

// โค้ดโทเคน — เติมยอดให้ก้อนใหญ่ ไว้ลองสุ่มสกินโดยไม่ต้องรอเช็คอินหลายวัน
function codeGrantTokens() {
  const bal = addTokens(CODE_TOKEN_GRANT);
  haptic('done');
  splashBurst(22, 'egg-star');
  renderAll();
  showToast({ title: '+' + CODE_TOKEN_GRANT + ' โทเคน ✦', body: 'ตอนนี้มี ' + bal + ' โทเคน — ลองสุ่มสกินได้เลย' });
}

// โค้ดที่ 1 — เปิดทุกอย่างในแอปให้เลย: เหรียญครบทุกอัน + ธีมลับครบทุกโทน
function codeGrantAll() {
  try { localStorage.setItem(ALLBADGE_KEY, '1'); } catch (_) {}
  // ธีมที่ต้องสุ่ม/ซื้อ ก็เปิดให้ด้วย ไม่งั้น "ปลดล็อกทุกอย่าง" ก็ยังใช้ธีมไม่ได้ครึ่งหนึ่ง
  // **ยกเว้นระดับลับ** — โค้ดใบนี้ไม่แจกให้ ต้องอีกใบเท่านั้น
  grantThemes(false);
  for (const s of Object.values(SECRETS)) { try { localStorage.setItem(s.store, '1'); } catch (_) {} }
  try { localStorage.setItem(GENESIS_KEY, '1'); } catch (_) {}
  applySecrets();
  applyGenesisUnlock();
  // ทำเครื่องหมายว่าเห็นครบแล้ว ไม่งั้น checkBadges จะไล่เด้งฉลองซ้ำอีกรอบ
  state.settings = state.settings || {};
  state.settings.badgesSeen = BADGES.map(b => b.id);
  save();
  haptic('done');
  splashBurst(26, 'egg-star');
  setTheme('genesis');
  renderAll();
  showToast({ title: 'ปลดล็อกครบทุกอย่างแล้ว ✦', body: 'เหรียญตราครบทุกอัน และธีมลับเปิดให้หมดแล้ว' });
}

// โค้ดที่ 2 — ล้างทุกอย่างแล้วเด้งออก เปิดกลับมาได้แอปเปล่าเหมือนเพิ่งติดตั้ง
async function codeWipeAll() {
  // ล้างเฉพาะคีย์ prefix 'studentos.alt.' — ข้อมูลของบิลด์ตัวจริงไม่โดนแตะ
  // ไล่จากรายชื่อคีย์จริงในเครื่อง ไม่ใช่จากรายการที่เขียนไว้ จะได้ไม่มีตกหล่น
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('studentos.alt.')) keys.push(k);
    }
    keys.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  } catch (_) {}
  try { sessionStorage.clear(); } catch (_) {}

  // ต้องล้างแคชกับถอน service worker ด้วย ไม่งั้นเปิดใหม่ยังได้ไฟล์ชุดเดิมจากแคช
  // ซึ่งจะไม่นับว่า "เหมือนได้แอปใหม่" จริง ๆ
  try {
    if (window.caches) {
      const names = await caches.keys();
      await Promise.all(names.filter(n => n.includes('studentos-alt')).map(n => caches.delete(n)));
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (_) {}

  state = { tasks: [], settings: { name: '', freeHours: 2 } };
  wipeCurtain();
}

function wipeCurtain() {
  const c = document.createElement('div');
  c.className = 'wipe-curtain';
  c.innerHTML = '<div class="wipe-mark">◆</div><div class="wipe-tx">กำลังคืนค่าทุกอย่าง…</div>';
  document.body.appendChild(c);
  if (navigator.vibrate) { try { navigator.vibrate([30, 80, 30, 80, 140]); } catch (_) {} }
  setTimeout(() => {
    // ปิดหน้าต่างให้ถ้าปิดได้ (แท็บที่สคริปต์เปิดเอง) — เบราว์เซอร์ส่วนใหญ่ปิดไม่ได้
    // จึงต้องมีทางถอยเป็นโหลดใหม่ ซึ่งได้ผลเหมือนกันคือกลับไปจอเปิดแอปครั้งแรก
    try { window.close(); } catch (_) {}
    setTimeout(() => location.replace(location.pathname), 400);
  }, 1700);
}

// ---------- ติดตั้งเป็นแอป (PWA install) ----------
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e; // Android/Chrome: เก็บไว้เรียกตอนกดปุ่มเอง
  renderProfile();
});
window.addEventListener('appinstalled', () => { deferredInstallPrompt = null; renderProfile(); });

function showInstallGuide() {
  const el = document.getElementById('installGuide');
  el.hidden = false;
  void el.offsetWidth; // บังคับ reflow ก่อนใส่คลาส กัน transition ไม่ทำงาน
  setTimeout(() => el.classList.add('show'), 20);
}
function dismissInstallGuide(dontShowAgain) {
  document.getElementById('installGuide').classList.remove('show');
  document.getElementById('installGuide').hidden = true;
  if (dontShowAgain) localStorage.setItem('studentos.alt.installGuideDismissed', '1');
}

async function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    renderProfile();
  } else if (isIOS()) {
    showInstallGuide();
  }
}

function renderInstallCard() {
  const card = document.getElementById('installCard');
  const btn = document.getElementById('installBtn');
  const hint = document.getElementById('installHint');
  if (!card) return;
  if (isStandalone()) { card.hidden = true; return; } // ติดตั้งแล้ว ไม่ต้องโชว์
  if (deferredInstallPrompt) {
    card.hidden = false; btn.style.display = 'block'; btn.textContent = 'ติดตั้งเลย';
    hint.textContent = 'ติดตั้งแล้วเปิดเร็วขึ้น เต็มจอ และรับการแจ้งเตือนได้';
  } else if (isIOS()) {
    card.hidden = false; btn.style.display = 'block'; btn.textContent = 'ดูวิธีติดตั้ง';
    hint.textContent = 'บน iPhone ต้องติดตั้งก่อนถึงจะรับการแจ้งเตือนได้';
  } else {
    card.hidden = true; // เบราว์เซอร์อื่นที่ยังตรวจไม่ได้ว่าติดตั้งได้ไหม ไม่ต้องกวนใจ
  }
}

// ---------- ALT: เกร็ดความรู้ระหว่างรอ ----------
// จอโหลดกับจอ OCR เป็นช่วงที่ผู้ใช้ต้องนั่งรอเฉย ๆ — ใส่อะไรให้อ่านดีกว่าปล่อยว่าง
// 2 ข้อแรกเป็นเรื่องของผู้พัฒนาเอง ที่เหลือเป็นเกร็ดของโลก
const FUN_FACTS = [
  'ชื่อรุ่นของแอปได้แรงบันดาลใจมาจากรถถังซีรีส์ Leopard',
  'ผู้พัฒนาชอบกินเงาะ',
  'You Cannot Beat Us — We Are STUDENTOS',
  'น้ำผึ้งไม่เน่าเสีย — เคยมีคนเจอน้ำผึ้งในสุสานอียิปต์อายุกว่า 3,000 ปี ที่ยังกินได้',
  'หมึกยักษ์มีหัวใจ 3 ดวง และเลือดของมันเป็นสีฟ้า',
  'กล้วยนับเป็นผลเบอร์รีตามนิยามพฤกษศาสตร์ แต่สตรอว์เบอร์รีไม่ใช่',
  'ดาวศุกร์หมุนรอบตัวเองช้ามาก จน 1 วันของมันยาวกว่า 1 ปีของมันเอง',
  'เต่าทะเลใช้สนามแม่เหล็กโลกนำทางกลับมาวางไข่ที่ชายหาดที่มันเกิด',
  'แสงจากดวงอาทิตย์ใช้เวลาราว 8 นาที 20 วินาที กว่าจะเดินทางมาถึงโลก',
  'ไม้ไผ่บางชนิดโตได้เกือบ 1 เมตรภายในวันเดียว',
  'มดไม่มีปอด มันหายใจผ่านรูเล็ก ๆ ข้างลำตัวแทน',
  'ทะเลทรายซาฮาราเคยเป็นทุ่งหญ้าเขียวที่มีทะเลสาบ เมื่อราว 6,000 ปีก่อน',
  'พระอาทิตย์ตกบนดาวอังคารเป็นสีฟ้า — ตรงข้ามกับบนโลกพอดี',
];

// ---------- ALT: เกร็ดเฉพาะธีมลับ ----------
// ธีมลับแต่ละอันมีเกร็ดของตัวเองที่เข้ากับฉากในธีมนั้น — คนที่อุตส่าห์ปลดล็อกมาได้
// จะเจอเนื้อหาที่คนอื่นไม่เคยเห็น ไม่ใช่แค่เปลี่ยนสีจอเฉย ๆ
const THEME_FACTS = {
  deepocean: [
    'จุดที่ลึกที่สุดในมหาสมุทรชื่อ Challenger Deep ลึกราว 10,900 เมตร — เอายอดเขาเอเวอเรสต์หย่อนลงไปยังจมมิด',
    'ใต้ทะเลลึก 1,000 เมตรลงไปไม่มีแสงอาทิตย์เหลือแล้ว แสงเกือบทั้งหมดที่เห็นมาจากตัวสัตว์ที่เรืองแสงเอง',
    'ปลาหมึกยักษ์มีเซลล์ประสาทสองในสามอยู่ที่หนวด แต่ละหนวดจึงตัดสินใจเองได้โดยไม่ต้องรอสมอง',
    'แรงดันที่ก้นร่องลึกมาเรียนามากกว่าที่ผิวน้ำราว 1,000 เท่า',
    'ฉลามมีอยู่บนโลกมาก่อนต้นไม้ — ฉลามเก่าแก่กว่าต้นไม้ราว 50 ล้านปี',
  ],
  earth2: [
    'ต้นไม้ในป่าส่งอาหารและสัญญาณเตือนถึงกันผ่านเครือข่ายเชื้อราใต้ดิน',
    'ต้นไม้ที่เก่าแก่ที่สุดที่ยังมีชีวิตอยู่คือสนบริสเซิลโคน อายุกว่า 4,800 ปี — แก่กว่าพีระมิดบางแห่ง',
    'ป่าแอมะซอนสร้างฝนให้ตัวเอง ไอน้ำที่ต้นไม้คายออกมากลายเป็นเมฆแล้วตกกลับลงมา',
    'ใบไม้เปลี่ยนสีในฤดูใบไม้ร่วงเพราะคลอโรฟิลล์สลายไป สีเหลืองส้มอยู่ในใบมาตลอดแต่ถูกสีเขียวบังไว้',
    'รากของต้นไม้ใหญ่แผ่กว้างกว่าเรือนยอดของมันเอง แต่ส่วนใหญ่ลึกไม่ถึง 1 เมตร',
  ],
  sweet: [
    'สายรุ้งเป็นวงกลมเต็มวงเสมอ เราเห็นแค่ครึ่งเดียวเพราะพื้นดินบังอีกครึ่งไว้',
    'ดาวเสาร์มีความหนาแน่นน้อยกว่าน้ำ ถ้าหาอ่างที่ใหญ่พอได้ มันจะลอย',
    'วงแหวนของดาวเสาร์หนาเฉลี่ยไม่ถึง 1 กิโลเมตร ทั้งที่กว้างเป็นแสนกิโลเมตร',
    'สีชมพูไม่มีความยาวคลื่นเป็นของตัวเองในสเปกตรัม — สมองสร้างมันขึ้นมาจากแสงสีแดงกับม่วง',
    'มีดาวเคราะห์ที่ฝนตกเป็นแก้วและพัดในแนวนอนด้วยความเร็วกว่า 7,000 กม./ชม. ชื่อ HD 189733b',
  ],
  genesis: [
    'อะตอมทุกตัวในร่างกายเรา ยกเว้นไฮโดรเจน เกิดขึ้นในใจกลางของดาวฤกษ์ที่ตายไปแล้ว',
    'แสงจากกาแล็กซีที่ไกลที่สุดที่เรามองเห็น ออกเดินทางมาตั้งแต่ก่อนโลกจะถือกำเนิด',
    'เพชรก่อตัวลึกลงไปใต้ผิวโลกราว 150 กิโลเมตร ใช้เวลานับพันล้านปี',
    'อวกาศไม่ได้เงียบเพราะไม่มีเสียง แต่เพราะไม่มีอากาศให้เสียงเดินทาง',
    'จักรวาลยังขยายตัวอยู่ทุกวินาที และขยายเร็วขึ้นเรื่อย ๆ ไม่ได้ช้าลงอย่างที่เคยคิดกัน',
  ],
};

let factTimer = null, lastFact = '';

// ธีมลับมีโอกาสออกเกร็ดของตัวเองราวครึ่งหนึ่ง — บ่อยพอให้รู้สึกว่าธีมมีของจริง
// แต่ไม่ถึงกับกลบเกร็ดชุดกลางจนหายไปหมด
function factPool() {
  const extra = THEME_FACTS[document.documentElement.dataset.theme];
  if (!extra) return FUN_FACTS;
  return Math.random() < 0.5 ? extra : FUN_FACTS;
}

function pickFunFact() {
  const pool = factPool();
  let pick;
  let guard = 0;
  do { pick = pool[Math.floor(Math.random() * pool.length)]; }
  while (pick === lastFact && ++guard < 8);   // ไม่ซ้ำอันเดิมติดกัน
  lastFact = pick;
  return pick;
}

function startFunFacts(el, ms = 4500) {
  stopFunFacts();
  if (!el) return;
  el.hidden = false;
  const show = () => {
    el.textContent = pickFunFact();
    el.classList.remove('in');
    void el.offsetWidth;      // บังคับ reflow ให้อนิเมชันเล่นใหม่ทุกครั้ง
    el.classList.add('in');
  };
  show();
  factTimer = setInterval(show, ms);
}

function stopFunFacts(el) {
  clearInterval(factTimer);
  factTimer = null;
  if (el) { el.hidden = true; el.textContent = ''; }
}

// ---------- ALT: ฉากเปิดแอป + เปอร์เซ็นต์จริง ----------
// เปอร์เซ็นต์ที่โชว์ = min(งานที่เสร็จจริง, เวลาที่ผ่านไป/เวลาขั้นต่ำ)
//   - ไม่โกหกว่าเสร็จ ทั้งที่ยังโหลดไม่เสร็จ (ติดเพดานที่งานจริง)
//   - ไม่กระโดดถึง 100 ใน 0.2 วิ แล้วค้างเฉย ๆ (ติดเพดานที่เวลา)
// เน็ตช้า → ตัวเลขจะค้างรอจริง ๆ ตรงขั้นที่ช้า และป้ายด้านล่างบอกว่าติดอยู่ขั้นไหน
const SPLASH_MIN = 3600;
const SPLASH_STEPS = [
  ['boot',  'เตรียมหน้าจอ'],
  ['data',  'อ่านข้อมูลในเครื่อง'],
  ['theme', 'เตรียมธีมและฟอนต์'],
  ['cloud', 'เชื่อมบัญชี'],
  ['notif', 'ตรวจการแจ้งเตือน'],
  ['plan',  'จัดลำดับงาน'],
];
const splashDone = new Set();
let splashShown = 0; // ตัวเลขที่โชว์อยู่ — ห้ามเดินถอยหลัง

function splashStep(key) {
  splashDone.add(key);
  const s = SPLASH_STEPS.find(x => x[0] === key);
  const el = document.getElementById('spStep');
  if (el && s) el.textContent = s[1] + '…';
}

function splashPct() {
  const real = splashDone.size / SPLASH_STEPS.length;
  const time = (performance.now() - APP_T0) / SPLASH_MIN;
  return Math.floor(Math.max(0, Math.min(real, time, 1)) * 100);
}

let splashTimer = null, splashAfter = null, splashReady = false;

// เริ่มนับตั้งแต่บรรทัดแรกของ initApp — ไม่งั้นถ้าเน็ตช้า ผู้ใช้จะเห็น 0% ค้างอยู่เฉย ๆ
function startSplashMeter() {
  const splash = document.getElementById('splash');
  if (!splash || splashTimer) return;
  const pctEl = document.getElementById('spPct');
  const fill = document.getElementById('spFill');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tick = () => {
    splashShown = Math.max(splashShown, splashPct()); // ห้ามเดินถอยหลัง
    if (pctEl) pctEl.textContent = splashShown;
    if (fill) fill.style.width = splashShown + '%';
    if (splashShown < 100 || !splashReady) return;

    clearInterval(splashTimer);
    stopFunFacts();
    const step = document.getElementById('spStep');
    if (step) step.textContent = 'พร้อมแล้ว';
    // บิลด์ทดลอง: ทิ้งเวลาบูตไว้ใน console จะได้รู้ว่าเปอร์เซ็นต์ไปติดที่เวลาหรือที่งานจริง
    console.debug('[ALT] splash ' + Math.round(performance.now() - APP_T0) + 'ms · ขั้นที่เสร็จ '
      + splashDone.size + '/' + SPLASH_STEPS.length);
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.classList.add('gone'), 600);
      if (splashAfter) splashAfter();
    }, reduced ? 0 : 260);
  };
  splashTimer = setInterval(tick, 60);
  tick();
  startFunFacts(document.getElementById('spFact'));
}

// เรียกตอนงานเปิดแอปเสร็จครบ — ตัวนับจะปิดฉากให้เองเมื่อถึง 100
function endSplashWhenReady(after) {
  splashAfter = after;
  splashReady = true;
}

// ---------- ALT: ทำความรู้จักผู้ใช้ (ครั้งแรกที่เปิด) ----------
const ONBOARD_SKIP_KEY = 'studentos.alt.onboardSkipped';

// ชื่อที่ผู้ใช้อยากให้เรียก — ใช้ทั่วแอป ทั้งคำชม คำเตือน และหน้าไม่มีงาน
function who() { return (state.settings.name || '').trim(); }

function needsOnboard() {
  return !who() && !localStorage.getItem(ONBOARD_SKIP_KEY);
}

// ปุ่มลัดจากไอคอนแอป (manifest shortcuts) ส่ง ?go=... มา — ต้องพาไปจอนั้นจริง ไม่งั้นปุ่มลัดโกหก
const SHORTCUT_SCREENS = { scan: 'scr-scan', home: 'scr-home', tasks: 'scr-tasks', timeline: 'scr-timeline' };
function shortcutTarget() {
  try {
    const g = new URLSearchParams(location.search).get('go');
    if (!g || !SHORTCUT_SCREENS[g]) return null;
    // ล้าง query ทิ้ง กันค้างอยู่ใน URL แล้วรีเฟรชทีไรก็เด้งไปจอเดิมทุกที
    history.replaceState(null, '', location.pathname);
    return SHORTCUT_SCREENS[g];
  } catch (_) { return null; }
}

// เลือกจอแรกหลังเปิดแอป: บัญชี → ทำความรู้จัก → เข้าแอป
function routeStart() {
  if (cloudConfigured() && !currentUser && !localStorage.getItem('studentos.alt.skipLogin')) {
    go('scr-login'); // มีระบบบัญชี + ยังไม่เคยเลือก → ให้เลือกก่อน
  } else if (needsOnboard()) {
    openOnboard();
  } else {
    go(shortcutTarget() || 'scr-menu'); // ALT: เข้าแอปมาเจอเมนูหลักก่อนเสมอ (ยกเว้นมาจากปุ่มลัด)
  }
}

// ใช้หลังผ่านหน้าบัญชีแล้ว (ล็อกอินสำเร็จ หรือกดใช้แบบไม่ล็อกอิน)
function routeAfterLogin() {
  if (needsOnboard()) openOnboard();
  else go('scr-menu');
}

function openOnboard() {
  const n = document.getElementById('obName');
  const f = document.getElementById('obFree');
  if (n) n.value = state.settings.name || '';
  if (f) setObFree(state.settings.freeHours || 2, true);
  const w = document.getElementById('obWelcome');
  if (w) { w.hidden = true; w.classList.remove('on'); }
  go('scr-onboard');
}

function setObFree(v, moveSlider) {
  const f = document.getElementById('obFree');
  if (moveSlider && f) f.value = v;
  const val = +(f ? f.value : v);
  const lb = document.getElementById('obFreeVal');
  if (lb) lb.textContent = (Number.isInteger(val) ? val : val.toFixed(1)) + ' ชม.';
  document.querySelectorAll('#obQuick button').forEach(b =>
    b.classList.toggle('on', parseFloat(b.textContent) === val));
}

function finishOnboard() {
  const input = document.getElementById('obName');
  const name = (input.value || '').trim().slice(0, 24);
  const err = document.getElementById('obErr');
  if (!name) {
    // ชื่อคือสิ่งเดียวที่ข้ามไม่ได้ในหน้านี้ เพราะทั้งแอปเรียกชื่อนี้ต่อ
    err.hidden = false;
    input.classList.add('bad');
    input.focus();
    setTimeout(() => input.classList.remove('bad'), 500);
    return;
  }
  err.hidden = true;
  state.settings.name = name;
  state.settings.freeHours = Math.max(0.5, +document.getElementById('obFree').value || 2);
  save();
  localStorage.removeItem(ONBOARD_SKIP_KEY);
  haptic('done');
  showWelcome(name);
}

function skipOnboard() {
  localStorage.setItem(ONBOARD_SKIP_KEY, '1'); // ข้ามแล้วไม่ต้องถามซ้ำทุกครั้งที่เปิด
  go('scr-menu');
}

// ฉาก "ยินดีที่ได้รู้จัก ___" — จังหวะเดียวที่แอปได้ทักผู้ใช้ด้วยชื่อเขาเป็นครั้งแรก
function showWelcome(name) {
  const w = document.getElementById('obWelcome');
  document.getElementById('obwName').textContent = name;
  document.getElementById('obwSub').textContent =
    'จากนี้ ' + name + ' แค่บอกว่าครูสั่งอะไรมา เดี๋ยวจัดลำดับให้เองว่าต้องทำอะไรก่อน';
  w.hidden = false;
  setTimeout(() => w.classList.add('on'), 20);
  setTimeout(() => {
    w.classList.remove('on');
    go('scr-menu');
    setTimeout(() => { w.hidden = true; }, 300);
    showToast({
      title: 'ยินดีที่ได้รู้จัก ' + name + ' 👋',
      body: 'ตั้งค่าเรียบร้อย — เพิ่มงานแรกได้เลย เดี๋ยวช่วยจัดลำดับให้',
    });
  }, 2300);
}

// ---------- init ----------
function tickClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  syncJourneyNow(); // ALT: หมุดบนเส้นทางเดินตามเวลาจริงไปพร้อมนาฬิกา
  navRecheck();     // ALT: กันเลย์เอาต์ค้างผิดโหมด ถ้า event เรื่องขนาดจอพลาดไปสักตัว
  // วิดเจ็ตนาฬิกาบนหน้าแรกเดินตามไปด้วย (ไม่ต้องวาดหน้าใหม่ทั้งหน้า)
  const wc = document.getElementById('wgClock');
  if (wc) wc.textContent = fmtClock(n);
}

for (const id of ['cameraInput', 'galleryInput']) {
  document.getElementById(id).addEventListener('change', e => {
    if (e.target.files[0]) scanFromPhoto(e.target.files[0]);
    e.target.value = '';
  });
}

// ALT: เลือกภาพพื้นหลังของตัวเอง
document.getElementById('bgInput').addEventListener('change', e => {
  if (e.target.files[0]) readUserBg(e.target.files[0]);
  e.target.value = '';
});

// ALT 1A6M3: ภาพของวิดเจ็ต — ช่องเลือกมี 2 ที่ (ในตั้งค่า และบนตัววิดเจ็ตเอง
// ซึ่งถูกวาดใหม่ทุกครั้ง) จึงดักที่ document ทีเดียวจบ
document.addEventListener('change', e => {
  if (e.target && (e.target.id === 'wgPhotoInput' || e.target.id === 'wgPhotoInput2')) {
    if (e.target.files[0]) pickWidgetPhoto(e.target.files[0]);
    e.target.value = '';
  }
  // รูปโปรไฟล์ — ช่องเดียวใช้ร่วมกันทั้งปุ่มในตั้งค่าและการแตะที่รูปในหน้า "ฉัน"
  if (e.target && e.target.id === 'avInput') {
    if (e.target.files[0]) pickAvatar(e.target.files[0]);
    e.target.value = '';
  }
});

// PWA: ลงทะเบียน service worker (เฉพาะเมื่อเปิดผ่าน http/https)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // มีโค้ดรุ่นใหม่เข้าคุมเมื่อไหร่ รีโหลดเองครั้งเดียว (กันแอปที่ติดตั้งไว้ค้างรุ่นเก่า)
  let swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloaded) return;
    swReloaded = true;
    location.reload();
  });
}

(async function initApp() {
  startSplashMeter();
  splashStep('boot');
  load();
  purgeOldTrash(); // ของในถังขยะที่เกิน 30 วัน ทิ้งถาวรตอนเปิดแอป
  splashStep('data');

  // ป้ายมุมจอบอกเลขเวอร์ชัน — ดึงจาก APP_VERSION ที่เดียว ขึ้นรุ่นใหม่ไม่ต้องไล่แก้ HTML
  const badge = document.getElementById('altBadge');
  if (badge) badge.textContent = APP_VERSION;
  // ป้ายรุ่นบนฉากเปิดแอป — เคยพิมพ์เลขรุ่นไว้ตรง ๆ ใน HTML แล้วลืมแก้ตอนขึ้นรุ่น
  const spv = document.getElementById('spVer');
  if (spv) spv.textContent = APP_CHANNEL + ' · VERSION ' + APP_VERSION + ' “' + APP_CODENAME + '”';

  applyDeepUnlock();     // ALT: ปุ่มธีมลับจะโผล่เฉพาะคนที่ปลดล็อกแล้ว
  applyGenesisUnlock();
  applyTheme();
  applyFontScale();  // ALT: ต้องมาก่อนวาดจอแรก ไม่งั้นตัวอักษรกระโดดขนาดให้เห็น
  applyUserBg();
  applyNav();
  fillSubjectSelect();
  initHomeSwipe(); // ALT: ปัดการ์ดในหน้าแรก (เกาะที่ #homeBody ครั้งเดียว อยู่รอดทุกการ render)
  initCrop();      // ALT: ลากกรอบในหน้าครอบภาพ
  // ฟอนต์ไทยมาจาก CDN — รอให้พร้อมก่อน ไม่งั้นจอแรกกระตุกตอนฟอนต์สลับ
  // ถ้าเน็ตช้าหรือโหลดไม่ขึ้น ไม่รอเกิน 2.5 วิ แล้วไปต่อด้วยฟอนต์ระบบ
  if (document.fonts && document.fonts.ready) {
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  }
  splashStep('theme');

  tickClock();
  setInterval(tickClock, 30_000);
  // เช็คบ่อยขึ้น (นาทีละครั้ง) + เช็คทุกครั้งที่กลับมาที่แอป
  // เวลาที่มือถือพักหน้าจอ timer จะถูกหยุด การกลับมาแล้วเช็คทันทีคือสิ่งที่ทำให้เตือนไม่หลุด
  setInterval(checkReminders, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
  checkReminders();

  await initCloud();
  splashStep('cloud');
  await refreshPushState();
  // เคยกดอนุญาตไว้แล้ว + ล็อกอินอยู่ → ต่อ push ให้อัตโนมัติ (เผื่อ subscription หลุด)
  if ('Notification' in window && Notification.permission === 'granted' && currentUser) {
    subscribePush().then(() => renderProfile()).catch(() => {});
  }
  splashStep('notif');

  routeStart();
  splashStep('plan');

  // หน้าต่างเช็คอินเด้งเองเมื่อถึงวันใหม่ (6 โมงเช้าไทย) และยังไม่ได้กดรับ
  // รอให้ฉากเปิดแอปปิดไปก่อน ไม่งั้นจะไปเด้งซ้อนอยู่หลังจอโหลด
  // ไม่แจกให้เองโดยไม่ถาม — ให้ผู้ใช้เห็นตารางแล้วกดรับเอง จะได้รู้ว่าตัวเองอยู่วันที่เท่าไหร่ของรอบ
  setTimeout(() => openDailyCheck(true), 4200);

  // ถึง 6 โมงเช้าระหว่างที่แอปเปิดค้างอยู่ ก็เด้งให้เลย ไม่ต้องรอปิดเปิดใหม่
  setInterval(() => { if (dailyPending()) openDailyCheck(true); }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && dailyPending()) openDailyCheck(true);
  });

  // ปิดฉากเปิดแอปเมื่อเปอร์เซ็นต์ถึง 100 (= งานเสร็จจริง + ครบเวลาขั้นต่ำ)
  endSplashWhenReady(() => {
    // หลัง splash หาย ค่อยเด้ง toast เตือนงานด่วน (ถ้าอยู่ในแอปแล้ว ไม่ใช่หน้า login/ทำความรู้จัก)
    if (!document.getElementById('scr-login').classList.contains('on') &&
        !document.getElementById('scr-onboard').classList.contains('on')) openNudge();
    // iPhone + Safari (ยังไม่ติดตั้ง) → เด้งแนะนำวิธีติดตั้งอัตโนมัติครั้งเดียว กันลืม/กันงง
    if (isIOS() && !isStandalone() && !localStorage.getItem('studentos.alt.installGuideDismissed')) {
      setTimeout(showInstallGuide, 1400);
    }
  });
})();