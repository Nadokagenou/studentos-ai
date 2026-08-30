// ============================================================
// StudentOS AI — App (UI + state)
// ข้อมูลจริง เก็บใน localStorage · ทุกจอ render จาก state
// ------------------------------------------------------------
// สายนี้เคยเป็นบิลด์ทดลอง (ALT) และถูกยกขึ้นเป็นตัวหลักตั้งแต่รุ่น 1A7V2
//
// **คีย์ใน localStorage ยังใช้ prefix 'studentos.alt.*' ต่อไป — ห้ามเปลี่ยน**
// ไม่ใช่เพราะลืมแก้ แต่เพราะคีย์คือที่อยู่ของข้อมูลที่ผู้ใช้มีอยู่แล้ว:
// งานทั้งหมด · ธีม · โทเคน · สกินที่สะสมไว้ · ธีมลับที่ปลดล็อกแล้ว
// เปลี่ยนชื่อคีย์เมื่อไหร่ = ทุกเครื่องที่ใช้อยู่กลายเป็นแอปเปล่าทันที โดยไม่มีทางกู้กลับ
// ชื่อคีย์เป็นเรื่องภายใน ผู้ใช้ไม่เคยเห็น — ไม่คุ้มที่จะแลกกับข้อมูลของคนที่ใช้อยู่
// ============================================================

const APP_VERSION = '1B9';                 // สายเลขของแอป
const APP_CODENAME = 'Klasse';          // ชื่อรุ่นของอัปเดตนี้
const STORE_KEY = 'studentos.alt.v1';       // ที่เก็บข้อมูลหลัก — ดูหมายเหตุเรื่องชื่อคีย์ข้างบน

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
// นับว่าข้อมูลถูกแก้ไปแล้วกี่ครั้ง — แผนของวันถูกคิดใหม่เมื่อเลขนี้ขยับหรือเมื่อข้ามนาที
// (renderAll วาดสิบกว่าจอต่อหนึ่งการกด · ให้ทุกจอไปคิดแผนเองซ้ำคือการคิดเรื่องเดิมสิบรอบ
//  และเสี่ยงที่จอสองจอจะคิดคนละนาทีแล้วแสดงคนละคำตอบ)
let stateRev = 0;

// เขียนก้อนหลักลงเครื่อง — แยกออกมาเพราะมันล้มเหลวได้จริง และล้มแบบเงียบที่สุด
//
// ทุกที่ในแอปที่เก็บ "รูป" (พื้นหลัง · รูปโปรไฟล์ · รูปวิดเจ็ต) ห่อ try/catch
// พร้อมป้ายบอกว่าที่เก็บเต็มไว้หมดแล้ว แต่ save() ซึ่งถูกเรียกจาก 31 ที่ และเป็น
// ทางเดียวที่การบ้านของผู้ใช้ถูกบันทึก กลับไม่มีอะไรกันไว้เลย
//
// ผลตอนที่เครื่องเต็มจริง (ตั้งพื้นหลังเป็นรูปถ่าย 2MB ก็ถึงแล้ว) คือ setItem โยน
// QuotaExceededError → บรรทัด pushToCloud() ข้างล่างไม่ได้ทำงาน → งานที่เพิ่งเพิ่ม
// ไม่ได้ลงเครื่อง และไม่ได้ขึ้น cloud ด้วย มันอยู่แค่ในหน่วยความจำ เห็นบนจอปกติทุกอย่าง
// แล้วหายไปตอนรีเฟรช โดยไม่มีอะไรบอกสักตัวว่าเกิดอะไรขึ้น
let quotaWarned = false;

function persistState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch (_) {
    // เต็มแล้ว ตัดของที่หายได้ก่อน: ประวัติจับเวลาเป็นของชิ้นเดียวในก้อนนี้ที่หายแล้ว
    // ไม่กระทบงานที่ต้องส่ง — tasks ห้ามแตะไม่ว่ากรณีใดทั้งสิ้น
    try {
      if ((state.sessions || []).length > 50) {
        state.sessions = state.sessions.slice(-50);
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        return true;
      }
    } catch (_) { /* ตัดแล้วยังไม่พอ ตกไปที่ป้ายเตือนข้างล่าง */ }

    // เตือนครั้งเดียวพอ — save() ถูกเรียกทุกการกด ป้ายเด้งทุกครั้งคือแอปใช้ไม่ได้เลย
    // typeof กันไว้เพราะ save() ถูกเรียกได้ตั้งแต่ตอนย้ายข้อมูลรุ่นเก่า ซึ่งเกิดก่อนที่
    // ส่วนแสดงป้ายจะพร้อม — ตรงนั้นเงียบไปดีกว่าพังทั้งการบูต
    if (!quotaWarned && typeof showToast === 'function') {
      quotaWarned = true;
      showToast({
        title: 'ที่เก็บในเครื่องเต็ม 😅',
        body: 'งานยังขึ้น cloud ให้อยู่ถ้าล็อกอินไว้ — ลบภาพพื้นหลังหรือภาพวิดเจ็ตออกสักอันแล้วจะเก็บในเครื่องได้อีก',
      });
    }
    return false;
  }
}

function save() {
  stateRev++;
  persistState();
  // ต้องยิงเสมอแม้ในเครื่องเขียนไม่ลง — ตอนที่เครื่องเต็ม cloud คือที่เดียวที่งานจะรอด
  pushToCloud(); // ซิงก์ขึ้น cloud อัตโนมัติ (ถ้าล็อกอินอยู่)
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ---------- ตัวนับกรวย ----------
// ก้อนนี้มีไว้ตอบคำถามเดียว: คนที่ล็อกอินแล้วไม่ได้ใช้ต่อ เขาหยุดตรงไหน
//
// เก็บใน state ก้อนเดิมโดยตั้งใจ — มันจึงขึ้น cloud ตามไปเองผ่าน pushToCloud()
// แล้วอ่านรวมทุกคนได้ด้วย SQL ที่ user_state.data->'funnel' โดยไม่ต้องมีบริการวัดผลข้างนอก
// (ไม่มี Analytics ไม่มี Posthog — ข้อมูลนักเรียนไม่ควรออกจากระบบเรา และเราขายเรื่องนี้กับโรงเรียนด้วย)
//
// กติกาสองข้อ:
//   1. เขียนให้น้อยครั้งที่สุด เพราะทุกการเขียนผ่าน save() ลาก pushToCloud() ตามไปด้วย
//   2. ตัวนับสะสมห้ามลดลง — ลบงานทิ้งแล้วเลข "เคยสร้างงาน" ต้องไม่หายตาม
//      ไม่งั้นเราแยกไม่ออกระหว่าง "ไม่เคยสร้างงานเลย" กับ "สร้างแล้วลบทิ้ง"
//      ซึ่งเป็นคนละอาการและแก้คนละทาง
function funnel() {
  if (!state.funnel) state.funnel = {};
  return state.funnel;
}

// วันแบบเวลาท้องถิ่น — ห้ามใช้ toISOString() ตรง ๆ เพราะไทยเป็น UTC+7
// วันของ UTC จะเปลี่ยนตอนเจ็ดโมงเช้าบ้านเรา คนที่เปิดแอปตอนตีหนึ่งกับสิบโมงจะถูกนับคนละวัน
function funnelDay(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// เขียนครั้งแรกครั้งเดียวตลอดชีพของบัญชี · คืน true ถ้าเพิ่งเขียนจริง
function funnelMark(key, val) {
  const f = funnel();
  if (f[key] != null) return false;
  f[key] = val === undefined ? new Date().toISOString() : val;
  return true;
}

function funnelBump(key, n = 1) {
  const f = funnel();
  f[key] = (f[key] || 0) + n;
}

// งานที่ "เคยสร้าง" แยกตามทางที่มันเข้ามา — ตัวเลขนี้ตอบว่าทางไหนใช้ได้จริง
// (พิมพ์เอง · กล่องเข้าจาก LINE · สแกน) และควรลงแรงต่อตรงไหน
function funnelTask(via) {
  const f = funnel();
  funnelMark('firstTask');
  funnelBump('tasksEver');
  f.via = f.via || {};
  f.via[via] = (f.via[via] || 0) + 1;
}

function funnelDone() {
  funnelMark('firstDone');
  funnelBump('doneEver');
}

// จอที่ "เคยเปิด" — เขียนครั้งเดียวต่อจอ จึงถูกพอที่จะเรียกจากทุกการเปลี่ยนจอได้
// ใช้แยก "ไม่เคยหาเจอ" ออกจาก "เจอแล้วไม่ใช้" ซึ่งเป็นคนละปัญหาและแก้คนละแบบ
function funnelScreen(id) {
  const f = funnel();
  f.screens = f.screens || {};
  if (f.screens[id]) return;
  f.screens[id] = funnelDay();
  persistState();   // ไม่เรียก save() — ไม่ต้องลาก cloud ทุกครั้งที่เจอจอใหม่
}

// เรียกครั้งเดียวตอนบูต
// เติมย้อนหลังให้คนที่ใช้แอปมาก่อนรุ่นนี้ — ทำครั้งเดียวตอนเจอก้อน funnel เปล่า
//
// ไม่ทำ = คนที่มีงานอยู่แล้ว 30 ชิ้นจะขึ้น tasksEver = 0 แล้วตารางสรุปจะบอกว่า
// "ไม่มีใครเคยสร้างงานเลย" ทั้งที่ไม่จริง · เครื่องวัดที่โกหกแย่กว่าไม่มีเครื่องวัด
//
// ปัก backfilled ไว้ด้วยเพราะตัวเลขชุดนี้เป็นการ "นับของที่เหลืออยู่" ไม่ใช่ "ที่สังเกตเห็นจริง"
// งานที่เคยสร้างแล้วลบทิ้งไปก่อนอัปเดตนับไม่ได้ ตัวเลขจึงต่ำกว่าความจริงเสมอ
// ใครอ่านตารางต้องแยกสองอย่างนี้ออก ไม่งั้นเอาไปเทียบกับคนใหม่แล้วสรุปผิด
function funnelBackfill(f) {
  const tasks = (state.tasks || []).filter(t => !t.deleted);
  if (!tasks.length) return;

  const iso = t => t && typeof t === 'string' ? t : null;
  const earliest = (list, key) => list
    .map(t => iso(t[key])).filter(Boolean).sort()[0] || null;

  f.backfilled = new Date().toISOString();
  f.tasksEver = tasks.length;
  f.doneEver = tasks.filter(t => t.done).length;
  f.via = { ก่อนวัด: tasks.length };
  const ft = earliest(tasks, 'createdAt');
  if (ft) f.firstTask = ft;
  const fd = earliest(tasks.filter(t => t.done), 'doneAt');
  if (fd) f.firstDone = fd;
}

function funnelOpen() {
  const f = funnel();
  const now = new Date();
  const day = funnelDay(now);
  // ต้องเช็คก่อน funnelMark('firstOpen') — หลังจากนั้นแยกไม่ออกแล้วว่าเป็นคนเก่าหรือคนใหม่
  if (f.firstOpen == null) funnelBackfill(f);
  funnelMark('firstOpen');
  funnelMark('firstVer', APP_VERSION);
  funnelBump('opens');
  // นับ "จำนวนวันที่เปิด" ไม่ใช่ "จำนวนครั้ง" — สลับแอปไปมาสิบรอบใน 5 นาทีไม่ใช่สิบวัน
  // ตัวเลขที่เราต้องตอบให้ได้คือ "มีกี่คนเปิดแอป 7 วันติด" ซึ่งต้องนับเป็นวันเท่านั้น
  if (f.lastDay !== day) { funnelBump('days'); f.lastDay = day; }
  f.lastOpen = now.toISOString();
  f.ver = APP_VERSION;
  save();
}

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
  vaultTouch();
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
  if (typeof syncSetVals === 'function') syncSetVals();
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
// 1A9l · ต้องเป็น 769 ไม่ใช่ 760 — CSS ตัดที่ max-width:768px
// เลข 760 เดิมทำให้ช่วง 760–768px เป็นเขตที่ CSS บอก "มือถือ" แต่ JS บอก "จอกว้าง"
// พร้อมกัน แถบล่างจึงได้กฎสองชุดที่ขัดกันเอง · ตัดที่เลขเดียวกัน เขตนั้นก็หายไป
const NAV_WIDE = '(min-width: 769px)';

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
  syncTimelineNow(); // ความกว้างจอเปลี่ยน → หมุด "ตอนนี้" ต้องคำนวณใหม่
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


// ---------- ตั้งค่า: หน้าย่อยที่ใช้ซ้ำจอเดียว ----------
// ตัวเลือกทั้งห้าชุดเคยกางอยู่ในจอตั้งค่าพร้อมกัน — ธีม 16 อันเรียงเป็นตาราง
// บวกวิดเจ็ต ตัวอักษร แถบเมนู พื้นหลัง จอเลื่อนยาวจนหาของที่ตั้งใจมาแก้ไม่เจอ
//
// บล็อกพวกนี้ถูก "ย้าย" ไปมาระหว่างที่พัก (#setStashList) กับหน้าย่อย ไม่ได้ถูกคัดลอก
// ถ้าคัดลอกจะมี id ซ้ำสองชุดในหน้าเดียว แล้ว renderAppearance() กับ applyTheme()
// จะไปเขียนใส่ตัวที่ไม่ได้อยู่บนจอ — ค่าบนจอจึงค้างอยู่ที่เดิมโดยไม่มี error ให้เห็น
const SETOPT = {
  theme:  { title: 'ธีมสี', blk: 'setBlkTheme' },
  widget: { title: 'วิดเจ็ตหน้าแรก', blk: 'setBlkWidget' },
  font:   { title: 'ขนาดตัวอักษร', blk: 'setBlkFont' },
  nav:    { title: 'ตำแหน่งแถบเมนู', blk: 'setBlkNav' },
  bg:     { title: 'พื้นหลังภาพ', blk: 'setBlkBg' },
};

function openSetOpt(key) {
  const item = SETOPT[key];
  if (!item) return;
  stashSetOpt();                       // เผื่อยังมีของค้างจากรอบก่อน
  const body = document.getElementById('setoptBody');
  const blk = document.getElementById(item.blk);
  if (!body || !blk) return;
  body.appendChild(blk);
  const t = document.getElementById('setoptTitle');
  if (t) t.textContent = item.title;
  go('scr-setopt');
}

function stashSetOpt() {
  const body = document.getElementById('setoptBody');
  const stash = document.getElementById('setStashList');
  if (!body || !stash) return;
  while (body.firstChild) stash.appendChild(body.firstChild);
}

// ค่าปัจจุบันที่โชว์ท้ายแถวในจอตั้งค่า — จอหลักบอกได้ว่าตอนนี้ตั้งอะไรไว้
// โดยไม่ต้องกดเข้าไปดูทีละหัวข้อ
function syncSetVals() {
  const put = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const th = themePref();
  put('setValTheme', th === 'system'
    ? 'ตามระบบ · ' + THEME_NAME[systemDark() ? 'dark' : 'light']
    : (THEME_NAME[th] || ''));
  put('setValWidget', WG_NAME[widgetPref()] || '');
  put('setValFont', FONT_NAME[fontPref()] || '');
  const nav = navPref();
  put('setValNav', nav === 'auto' ? 'อัตโนมัติ · ' + NAV_NAME[navMode()] : (NAV_NAME[nav] || ''));
  put('setValBg', localStorage.getItem(BG_KEY) ? 'ใช้ภาพของคุณ' : 'ยังไม่ได้ตั้ง');
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
  syncSetVals();
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

// จอทั้งห้าที่มีปุ่มของตัวเองอยู่บนแถบล่าง — ที่เหลือถือเป็นจอชั้นใน
// แถบล่างเหลือ 4 แท็บ + ปุ่มเพิ่ม: วันนี้ · ปฏิทิน · + · งาน · ฉัน
// scr-ai ออกจากแถบล่างแล้ว (มีปุ่มย้อนกลับของตัวเองใน renderAi) และ scr-scan
// เข้าจากแผ่นปุ่ม + แทน — ทั้งคู่ยังนับเป็นจอในแอป จึงยังไม่ต้องซ่อนปุ่มเพื่อนบนหัวจอ
const TABBED_SCREENS = ['scr-menu', 'scr-ai', 'scr-tasks', 'scr-scan', 'scr-timeline', 'scr-profile', 'scr-mates'];

// จอที่ไม่มีปุ่มของตัวเองบนแถบล่าง แต่เป็นส่วนหนึ่งของแท็บอื่น
// รายการงานย้ายเข้าไปเป็นโหมดที่สามของแท็บ "ตาราง" — ปุ่มแท็บนั้นจึงต้องติดไฟด้วย
// ไม่งั้นผู้ใช้อยู่ในแอปแต่ไม่มีแท็บไหนสว่างเลย ซึ่งอ่านว่า "หลงอยู่ที่ไหนไม่รู้"
// 1A9: "น้องไซ" มีปุ่มของตัวเองบนแถบล่างแล้ว จึงไม่ต้องยืมไฟจากแท็บ "ฉัน" อีก
// ส่วน "ปฏิทิน" เสียปุ่มไป — มันเป็นมุมมองที่สองของแท็บ "งาน" อยู่แล้ว (ดู tlModeTabs)
// ถ้าไม่ยกให้แท็บนั้นติดไฟ ผู้ใช้จะอยู่ในปฏิทินโดยไม่มีแท็บไหนสว่างเลย = "หลงอยู่ที่ไหนไม่รู้"
const TAB_OWNER = { 'scr-timeline': 'scr-tasks',
  'scr-settings': 'scr-profile', 'scr-setopt': 'scr-profile', 'scr-stats': 'scr-profile',
  // จอแชทซ่อนแถบล่างอยู่แล้ว แต่ต้องผูกเจ้าของไว้ด้วย — ไม่งั้นตอนกดย้อนกลับ
  // ออกมา จะไม่มีแท็บไหนติดไฟสักอัน ซึ่งอ่านว่า "หลงอยู่ที่ไหนไม่รู้"
  'scr-chat': 'scr-mates', 'scr-people': 'scr-mates',
  'scr-compose': 'scr-mates', 'scr-post': 'scr-mates', 'scr-user': 'scr-mates' };

// ---------- 1A7V2: ออกจากแอปแล้วกลับเข้ามา ต้องอยู่ที่เดิม ----------
// บนมือถือ การสลับไปแอปอื่นแล้วกลับมามักทำให้ระบบโหลดหน้าใหม่ทั้งหน้า
// ห้ามไม่ได้ แต่ทำให้ "ไม่รู้สึกว่าโดนรีเซ็ต" ได้ ด้วยการจำจอที่ค้างไว้แล้วกลับไปที่เดิม
//
// จอที่ห้ามจำ — เพราะสถานะของมันอยู่ในหน่วยความจำ ไม่ได้อยู่ใน localStorage
// กลับมาแล้วจะเจอจอเปล่า ๆ ที่กดอะไรไม่ได้ ซึ่งแย่กว่าการเด้งกลับเมนูเสียอีก:
//   scr-crop     — รูปที่กำลังครอบอยู่หายไปกับการโหลดใหม่
//   scr-parsing  — จอรอระหว่าง AI อ่าน ไม่มีอะไรให้กลับไปดู
//   scr-form     — สิ่งที่พิมพ์ค้างไว้หายไป กลับมาเจอฟอร์มเปล่าน่าสับสนกว่า
//   scr-login / scr-onboard — มีด่านของตัวเองตัดสินอยู่แล้ว
const NO_RESUME = ['scr-crop', 'scr-parsing', 'scr-form', 'scr-login', 'scr-onboard', 'scr-setopt', 'scr-ctxwiz'];
const LAST_SCR_KEY = 'studentos.alt.lastScreen';
// เกิน 30 นาทีถือว่าเป็นการเปิดใหม่ ไม่ใช่การกลับเข้ามาต่อ — เริ่มที่เมนูตามปกติ
// (กลับมาวันรุ่งขึ้นแล้วเจอจอสุ่มสกินค้างอยู่ ไม่ใช่สิ่งที่ใครคาดหวัง)
const RESUME_WINDOW = 30 * 60 * 1000;

function rememberScreen(id) {
  if (NO_RESUME.includes(id)) return;
  try { localStorage.setItem(LAST_SCR_KEY, JSON.stringify({ id, t: Date.now() })); } catch (_) {}
}

function resumeScreen() {
  try {
    const s = JSON.parse(localStorage.getItem(LAST_SCR_KEY) || 'null');
    if (!s || !s.id || Date.now() - s.t > RESUME_WINDOW) return null;
    // จอต้องมีอยู่จริงในหน้านี้ — กันกรณีอัปเดตแล้วจอเดิมถูกเอาออกไป
    return document.getElementById(s.id) ? s.id : null;
  } catch (_) { return null; }
}

function go2(id){ return go(id); }
// scr-home กับ scr-tasks เป็นรายการงานสองจอที่ตอบคำถามเดียวกัน
// แท็บ "ตารางงาน" ชี้มาที่ scr-tasks แล้ว — ทางเข้าเก่าที่ยังเรียก scr-home อยู่
// (จอที่ค้างไว้ตอนสลับแอป · ปุ่มลัดของระบบ · ปุ่มเก่าที่ยังหลงเหลือ) ต้องมาที่เดียวกัน
// ไม่งั้นผู้ใช้จะเจอรายการงานคนละหน้าตาสองแบบแล้วแต่ว่าเข้ามาทางไหน
function go(id) {
  if (id === 'scr-home') id = 'scr-tasks';
  // ออกจากจอแชทเมื่อไหร่ ปิดช่องรับข้อความสดทันที — ช่องที่เปิดค้างกินโควตา realtime
  // ซึ่งนับจำนวนช่องที่เปิดพร้อมกัน ไม่ใช่จำนวนข้อความ · เปิดค้างสิบห้องแล้วเงียบไปเลย
  if (curScreen === 'scr-chat' && id !== 'scr-chat' && typeof closeChat === 'function') closeChat();
  // คืนบล็อกตัวเลือกกลับที่พักก่อนออกจากหน้าย่อยของตั้งค่า — ทางออกมีหลายทาง
  // (ปุ่มกลับ · แท็บล่าง · ปุ่มย้อนของเครื่อง) ตกทางใดทางหนึ่งแล้วบล็อกหาย
  if (curScreen === 'scr-setopt' && id !== 'scr-setopt') stashSetOpt();
  const dir = navDirection(curScreen, id);
  // ออกจากจอสุ่มเมื่อไหร่ ทิ้งผลรอบเดิม กลับเข้ามาจะได้เริ่มใหม่สะอาด ๆ
  if (id !== 'scr-wheel') { drawResults = []; drawOpen = []; }
  curScreen = id;
  funnelScreen(id);   // จอนี้เคยถูกเปิดหรือยัง — เขียนครั้งเดียวต่อจอ
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
  // จอแชทซ่อนแถบล่างเหมือนจอล็อกอิน — ช่องพิมพ์ต้องติดก้นจอจริง ๆ
  // ไม่ใช่ลอยอยู่หลังแถบล่างจนกดไม่โดน · ออกจากจอนี้ได้ทางปุ่มย้อนกลับในหัวจอ
  document.body.classList.toggle('chat-mode', id === 'scr-chat');
  document.body.classList.toggle('compose-mode',
    id === 'scr-compose' || id === 'scr-post' || id === 'scr-user');
  // ออกจากฟีดเมื่อไหร่ ปิดช่องรับโพสต์สดกับ presence — ทั้งคู่กินโควตา realtime
  // ซึ่งนับจำนวนช่องที่เปิดพร้อมกัน · จอลูกของฟีดยังนับว่าอยู่ในฟีด ไม่ต้องปิด
  if (!['scr-mates', 'scr-post', 'scr-compose', 'scr-people', 'scr-user'].includes(id)) {
    if (typeof unwatchFeed === 'function') unwatchFeed();
    if (typeof unwatchPresence === 'function') unwatchPresence();
  }
  // จอที่ไม่ได้อยู่บนแถบล่าง (แผนวันนี้ · ร้าน · สุ่มสกิน ฯลฯ) มีปุ่มย้อนกลับของตัวเอง
  // อยู่มุมขวาบนตรงตำแหน่งเดียวกับปุ่มเพื่อนพอดี สองปุ่มจึงทับกันจนกดผิดตัวได้
  // จอพวกนี้เข้ามาจากทางอื่นอยู่แล้ว ปุ่มเพื่อนจึงหลบให้ปุ่มย้อนกลับไปก่อน
  document.body.classList.toggle('deep-scr', !TABBED_SCREENS.includes(id));
  // ปุ่มเพื่อนลอยมุมขวาบนต้องหลบหน้า "วันนี้" — มันนั่งทับกระดิ่งกล่องเข้าพอดี
  // และเพื่อนไม่ใช่คำตอบของ "ตอนนี้ควรทำอะไร" · ทางเข้ายังอยู่ครบสองที่ในแท็บ "ฉัน"
  document.body.classList.toggle('home-scr', id === 'scr-menu');
  document.body.classList.toggle('ai-scr', id === 'scr-ai');
  // ฟีดมีปุ่มของตัวเองบนหัวจอแล้ว — ปุ่มเพื่อนลอยมุมขวาบนของแอปจึงต้องหลบ
  // ไม่งั้นสองปุ่มนั่งทับกันพอดี แล้วกดโดนตัวที่ไม่ได้ตั้งใจ
  document.body.classList.toggle('mates-scr', id === 'scr-mates');
  // หน้า "ฉัน" สลับปุ่มมุมขวาบนจาก "เพื่อน" เป็น "ตั้งค่า" — เพื่อนมีแถวของตัวเองในลิสต์
  // ข้างล่างอยู่แล้ว ส่วนตั้งค่าไม่มีแล้ว (ถอดออกใน 1A9d) มุมขวาบนคือทางเข้าเดียวของมัน
  document.body.classList.toggle('me-scr', id === 'scr-profile');
  const tabId = TAB_OWNER[id] || id;
  document.querySelectorAll('.tab[data-scr]').forEach(b =>
    b.classList.toggle('active', b.dataset.scr === tabId));
  rememberScreen(id);   // ไว้กลับมาที่เดิมถ้าระบบโหลดหน้าใหม่ตอนสลับแอป
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
  // ไม่เคยมี try/catch หรือลิมิตเวลาตรงนี้ — เน็ตหลุดหรือ Supabase ตอบช้าตอนบูต
  // แปลว่า initApp โยน error ทิ้งค้างไว้โดยไม่มีใครจับ แล้วแอปค้างที่ฉากเปิดถาวร
  // ล้มแบบเงียบแล้วเข้าแอปในสถานะยังไม่ล็อกอิน ดีกว่าค้างจนใช้อะไรไม่ได้เลย
  let session = null;
  try {
    ({ data: { session } } = await withTimeout(sb.auth.getSession(), 6000, 'เชื่อมบัญชี'));
  } catch (e) { console.warn('[cloud] getSession failed:', e.message); }
  currentUser = session ? session.user : null;
  sb.auth.onAuthStateChange((event, sess) => {
    const wasLoggedIn = !!currentUser;
    currentUser = sess ? sess.user : null;
    if (currentUser && !wasLoggedIn) {
      // เพิ่งล็อกอินเสร็จ (รวมถึงกลับมาจากหน้า Google)
      if ('Notification' in window && Notification.permission === 'granted') {
        subscribePush().catch(() => {}); // ผูก push กับบัญชีที่เพิ่งล็อกอิน
      }
      // token จากลิงก์กลุ่มถูกเก็บไว้ตั้งแต่ก่อนล็อกอิน — จังหวะนี้คือจังหวะที่ใช้ได้แล้ว
      // (ทางกลับจาก Google เป็นการโหลดหน้าใหม่ ตัว initApp ก็เรียกให้อีกทาง เรียกซ้ำได้ปลอดภัย)
      syncFromCloud().then(() => { routeAfterLogin(); return applyJoinToken(); });
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
    // ถาม rev ก่อนว่าของบน cloud ใหม่กว่าที่เครื่องนี้เห็นล่าสุดไหม — ตัวเลขตัวเดียว
    // ไม่กี่ไบต์ ถูกกว่าลากก้อน 26KB ลงมาเทียบเองทุกครั้งที่เปิดแอปหลายสิบเท่า
    // (เปิดแอปส่วนใหญ่ไม่มีอะไรเปลี่ยนบน cloud เพราะเครื่องนี้เองเป็นคนเขียนล่าสุด)
    const { data: head, error: headErr } = await sb.from('user_state')
      .select('rev').eq('id', currentUser.id).maybeSingle();
    if (headErr) throw headErr;
    const remoteRev = head ? head.rev : null;
    const skipPull = head && remoteRev === lastSeenRev;

    const { data, error } = skipPull ? { data: null } : await sb.from('user_state')
      .select('data, avatar, rev').eq('id', currentUser.id).maybeSingle();
    if (error) throw error;
    if (data && data.data) {
      const remote = data.data;
      lastSeenRev = data.rev;
      // รูปโปรไฟล์ย้ายมาอยู่คอลัมน์ของตัวเองแล้ว — ประกอบกลับเข้า vault ให้ vaultImport
      // ทำงานเหมือนเดิม ตัวมันไม่ต้องรู้ว่าข้างล่างเก็บแยกกันแล้ว
      if (remote.vault && data.avatar) remote.vault.avatar = data.avatar;
      const byId = {};
      for (const t of (state.tasks || [])) byId[t.id] = t;
      for (const t of (remote.tasks || [])) byId[t.id] = t;
      state.tasks = Object.values(byId);
      state.settings = Object.assign({}, state.settings, remote.settings || {});
      // รอบจับเวลารวมตาม id เหมือนงาน — แต่ละรอบเกิดบนเครื่องเดียวและไม่เคยถูกแก้ทีหลัง
      // เครื่องไหนบันทึกไว้ก็ของจริงทั้งคู่ เอามารวมกันแล้วเรียงตามเวลาเริ่ม
      const sById = {};
      for (const s of (state.sessions || [])) sById[s.id] = s;
      for (const s of (remote.sessions || [])) sById[s.id] = s;
      state.sessions = Object.values(sById)
        .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
        .slice(-SESSION_CAP);
      // หมุดปฏิทินรวมตาม id เหมือนงาน — ปักจากเครื่องไหนก็เป็นของจริงทั้งคู่
      const mById = {};
      for (const m of (state.marks || [])) mById[m.id] = m;
      for (const m of (remote.marks || [])) mById[m.id] = m;
      state.marks = Object.values(mById);
      // ใช้ตัวเดียวกับ save() — ถ้าเครื่องเต็มตรงนี้แล้วปล่อยให้ throw จะร้ายกว่าที่อื่น
      // เพราะบรรทัดที่เหลือของ syncFromCloud (บริบท · ของสะสม · กล่องเข้า LINE · renderAll)
      // จะไม่ได้ทำงานเลยสักบรรทัด แปลว่าดึงของจาก cloud มาแล้วแต่หน้าจอไม่รู้เรื่องด้วย
      persistState();
      // บริบท (ตารางเรียน/กิจวัตร) ยังอยู่ใน user_state ก้อนเดียวกันไปก่อน
      // ฝั่ง cloud ชนะทั้งก้อน ไม่ merge รายตัว เพราะมันคือ "ตารางของสัปดาห์นี้"
      // ที่ต้องสอดคล้องกันทั้งชุด ไม่ใช่รายการงานที่เพิ่มทีละใบจากหลายเครื่อง
      if (remote.ctx && typeof ctxImport === 'function') ctxImport(remote.ctx);
      // ของสะสมรวมทีหลัง ctx เพราะมันไม่เกี่ยวกัน แต่ต้องมาก่อน renderAll() ข้างล่าง
      // ไม่งั้นหน้าจอวาดยอดโทเคนเก่าไปแล้วค่อยเปลี่ยนเลขต่อหน้าต่อตา
      if (typeof vaultImport === 'function') vaultImport(remote.vault);
    }
    await pushToCloud(true);
    // ของที่บอท LINE หย่อนไว้ตอนแอปปิดอยู่ — ดึงมาทีเดียวตอนเปิด
    await loadLineLinks();
    await pullInbox();
    renderAll();
  } catch (e) { console.warn('[sync] pull failed:', e.message); }
}

// ============================================================
// ส่งข้อมูลขึ้น cloud (debounce 1.5 วิ กันยิงถี่)
// ------------------------------------------------------------
// เพดานคนใช้ของแอปนี้ไม่ได้ติดที่ CPU หรือจำนวนแถว แต่ติดที่ค่า bandwidth ของ Supabase
// เพราะทุกครั้งที่มีอะไรเปลี่ยน แอปส่ง "ทั้งก้อน" ขึ้นไปใหม่ ไม่ได้ส่งเฉพาะส่วนที่แก้
// วัดจริง: ก้อน 51KB × ติ๊กงานวันละ 5 ครั้ง × เปิดแอปวันละ 3 รอบ = 16 MB/คน/เดือน
// แพ็กเกจ Free ให้ 5 GB/เดือน จึงรับได้ราว 310 คนเท่านั้น
//
// สามอย่างที่ทำให้ตัวเลขนั้นดีขึ้นโดยไม่ต้องรื้อโครงข้อมูล:
//   1) รูปโปรไฟล์แยกไปคอลัมน์ของตัวเอง ส่งเฉพาะตอนที่รูปเปลี่ยนจริง
//      (รูป 25KB เคยเดินทางไปด้วยทุกครั้งที่ติ๊กงานเสร็จ ทั้งที่ไม่ได้เปลี่ยน)
//   2) ไม่ส่งซ้ำถ้าก้อนเหมือนเดิมเป๊ะ — save() ถูกเรียกจากหลายที่ในการกดครั้งเดียว
//   3) ตอนเปิดแอปถาม rev ก่อน ถ้า cloud ไม่ได้ใหม่กว่าก็ไม่ต้องโหลดก้อนลงมา
// ============================================================
let lastPushedHash = '';   // ก้อนล่าสุดที่ส่งขึ้นไปสำเร็จ (ไว้เทียบว่าซ้ำไหม)
let lastPushedAvatar = null;
let lastSeenRev = -1;      // rev ของ cloud ที่เครื่องนี้เห็นล่าสุด

// ลายนิ้วมือสั้น ๆ ของสตริง — ใช้แค่ตอบว่า "เหมือนเดิมไหม" ไม่ได้ใช้ด้านความปลอดภัย
// จึงไม่ต้องพึ่ง crypto.subtle ที่เป็น async และทำให้ทั้งเส้นทางนี้ต้องรอโดยไม่จำเป็น
function cheapHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + ':' + s.length;
}

function pushToCloud(immediate) {
  if (!sb || !currentUser) return;
  const doPush = async () => {
    try {
      const vault = typeof vaultExport === 'function' ? vaultExport() : undefined;
      // รูปไม่ไปกับก้อนหลักอีกแล้ว — ดึงออกก่อนคิดลายนิ้วมือ
      const avatar = (vault && vault.avatar) || null;
      if (vault) delete vault.avatar;

      const body = { tasks: state.tasks, settings: state.settings,
        sessions: state.sessions || [],
        marks: state.marks || [],
        ctx: typeof ctxExport === 'function' ? ctxExport() : undefined,
        vault };
      const json = JSON.stringify(body);
      const hash = cheapHash(json);
      const avatarChanged = avatar !== lastPushedAvatar;

      // ไม่มีอะไรเปลี่ยนเลยก็ไม่ต้องเสีย bandwidth — แต่ต้องเคยส่งสำเร็จมาก่อน
      // ('' แปลว่ายังไม่เคยส่งรอบนี้ ต้องส่งเสมอ ไม่งั้นเครื่องใหม่จะไม่ push อะไรเลย)
      if (lastPushedHash && hash === lastPushedHash && !avatarChanged) return;

      const row = { id: currentUser.id, data: body, updated_at: new Date().toISOString() };
      // ส่งคอลัมน์รูปเฉพาะตอนที่รูปเปลี่ยน — ไม่ใส่ = ค่าเดิมบน cloud ไม่ถูกแตะ
      if (avatarChanged) row.avatar = avatar;

      // ขอ rev ใหม่กลับมาด้วยเลย (ไม่กี่ไบต์) — ถ้าปล่อยให้ค่าที่จำไว้เป็นโมฆะ
      // การเปิดแอปครั้งถัดไปจะต้องลากทั้งก้อนลงมาเทียบใหม่ทั้งที่เครื่องนี้เองเป็นคนเขียน
      const { data: back, error } = await sb.from('user_state')
        .upsert(row).select('rev').maybeSingle();
      if (error) throw error;
      lastPushedHash = hash;
      lastPushedAvatar = avatar;
      if (back && typeof back.rev === 'number') lastSeenRev = back.rev;
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
// ชื่อเดียวกันแบบข้อความล้วน — สำหรับที่ที่เขียนด้วย textContent (toast, การแจ้งเตือนของระบบ)
// เอา taskTitle ไปใส่ตรงนั้นตรง ๆ ไม่ได้ เพราะ &amp; จะโผล่ให้ผู้ใช้เห็นดิบ ๆ
function taskTitleText(t) {
  const subj = t.subject && t.subject !== 'อื่น ๆ' ? t.subject + ' · ' : '';
  return subj + (t.detail || '');
}
// ---------- สีประจำวิชา ----------
// วิชาเดียวกันต้องได้สีเดิมทุกจอและทุกเครื่อง จึงคำนวณจากชื่อ ไม่ใช่จากลำดับที่เจอ
// (เรียงตามลำดับที่เจอแล้ว สีจะสลับกันทันทีที่ลบวิชาใดวิชาหนึ่งทิ้ง)
//
// สีชุดนี้เป็น "ป้ายชื่อ" ไม่ใช่ "ระดับความด่วน" — สีความหมาย (แดง/ส้ม/เขียว) ยังสงวนไว้
// ให้ชิปสถานะเหมือนเดิม ห้ามเอาสองระบบนี้มาปนกันในองค์ประกอบเดียว ไม่งั้นผู้ใช้
// จะอ่านสีแดงของวิชา "คณิตศาสตร์" เป็น "ด่วนมาก"
const MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

// แจกสีจาก "รายชื่อวิชาที่ผู้ใช้มีจริง" ไม่ใช่จากการแฮชชื่อ
//
// ลองแฮชมาแล้วสองรุ่น ทั้งคู่แพ้ด้วยเหตุผลเดียวกัน: แฮชรับประกันได้แค่ว่าชื่อเดิมได้สีเดิม
// รับประกันไม่ได้ว่าวิชาที่อยู่ในวันเดียวกันจะไม่ซ้ำสี — วันจันทร์ 7 คาบลง 12 สี
// ยังไงก็ชนตามหลักวันเกิด และการชนในจอเดียวคือสิ่งเดียวที่ผู้ใช้มองเห็น
//
// เรียงตามชื่อแล้วไล่แจกจึงตรงกับสิ่งที่ต้องการจริง: ถ้ามีไม่เกิน 12 วิชา ไม่มีทางซ้ำเลย
// แลกกับการที่เพิ่ม/ลบวิชาแล้วสีของวิชาอื่นขยับได้ ซึ่งรับได้เพราะตารางเรียนกรอกครั้งเดียว
// (สแกนรูปทีเดียวได้ทั้งสัปดาห์) ไม่ใช่ของที่แก้ทุกวัน
const SUBJ_COLORS = 12;
let subjMap = null, subjMapKey = '';

function subjIndex() {
  // วันที่แต่ละวิชาไปโผล่ — สองวิชาที่อยู่วันเดียวกันคือคู่ที่ห้ามสีซ้ำ
  const days = {};
  const names = new Set();
  if (typeof ctxClasses === 'function') {
    for (const c of ctxClasses()) {
      const s = (c.subject || '').trim();
      if (!s) continue;
      names.add(s);
      const wd = c.weekday == null ? [0, 1, 2, 3, 4, 5, 6]
        : (Array.isArray(c.weekday) ? c.weekday : [c.weekday]);
      days[s] = days[s] || new Set();
      for (const d of wd) days[s].add(d);
    }
  }
  // ตัดช่องว่างหัวท้ายตอนสร้างสารบัญด้วย — subjColor() ค้นด้วยชื่อที่ trim แล้ว
  // วิชาที่ถูกพิมพ์มาพร้อมช่องว่างท้ายชื่อ (พิมพ์เองก็ได้ OCR อ่านมาก็ได้) จึงหาไม่เจอ
  // แล้วตกไปเป็นสี 0 = เทา ทั้งที่มันมีชื่อวิชาชัดเจน จุดบนปฏิทินของวิชานั้นจึงเทาอยู่ดวงเดียว
  for (const t of (state.tasks || [])) if (t.subject && t.subject.trim()) names.add(t.subject.trim());

  const list = [...names].map(s => s.trim())
    .filter(s => s && s !== 'อื่น ๆ').sort((a, b) => a.localeCompare(b, 'th'));
  const key = list.map(s => s + ':' + [...(days[s] || [])].sort().join('')).join('|');
  if (subjMap && subjMapKey === key) return subjMap;   // วาดจอหนึ่งครั้งเรียกหลายสิบรอบ

  // ระบายสีแบบละโมบบนกราฟ "อยู่วันเดียวกัน" — วิชาหนึ่งชนกับวิชาอื่นในวันได้มากสุด ~7 ตัว
  // มี 12 สีจึงหาสีว่างเจอเสมอ ผลคือวันจันทร์ 7 คาบได้ 7 สีคนละสีจริง ๆ
  // (เรียงตามชื่อก่อน เพื่อให้ผลลัพธ์เหมือนเดิมทุกครั้งที่ชุดวิชาเท่าเดิม)
  subjMap = {};
  const used = new Array(SUBJ_COLORS + 1).fill(0);
  for (const s of list) {
    const mine = days[s];
    const taken = new Set();
    if (mine) {
      for (const other of list) {
        if (other === s || subjMap[other] == null) continue;
        const od = days[other];
        if (od && [...mine].some(d => od.has(d))) taken.add(subjMap[other]);
      }
    }
    // เลือกสีที่ยังไม่ชน และในบรรดานั้นเอาสีที่ถูกใช้ไปน้อยที่สุด — สีจะได้กระจาย
    let pick = 1, best = Infinity;
    for (let c = 1; c <= SUBJ_COLORS; c++) {
      if (taken.has(c)) continue;
      if (used[c] < best) { best = used[c]; pick = c; }
    }
    subjMap[s] = pick;
    used[pick]++;
  }
  subjMapKey = key;
  return subjMap;
}

function subjColor(name) {
  const s = String(name || '').trim();
  if (!s || s === 'อื่น ๆ') return 0;      // 0 = เทากลาง สำหรับของที่ไม่มีวิชา
  return subjIndex()[s] || 0;
}
function subjClass(name) { return 'sj-' + subjColor(name); }

// ไอคอน Lucide — เรียกใช้ซ้ำได้จาก <defs> ใน index.html
function icon(name, cls) {
  return `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#lu-${name}"/></svg>`;
}

// ---------- หน้าน้องไซ ----------
// มาสคอตมีตัวตนจริง (Synara) — ฟองแชทที่ขึ้นด้วยไอคอนประกายเฉย ๆ ทำให้มันกลับไปเป็น
// "กล่องข้อความของระบบ" ทั้งที่ทั้งแอปพยายามทำให้มันเป็นใครสักคนที่นักเรียนคุยด้วย
//
// วาดทั้งรูปและไอคอนสำรองซ้อนกันไว้ แล้วให้ onerror เป็นคนตัดสิน —
// เช็คด้วย JS ก่อนวาดไม่ได้ เพราะรูปยังโหลดไม่เสร็จตอนวาดจอครั้งแรก
// และถ้ารอให้โหลดเสร็จก่อนค่อยวาด ฟองแชทจะกระพริบทุกครั้งที่พิมพ์
const SAI_FACE = 'sai-avatar.png';
function saiFace(cls) {
  return `<span class="ai-av${cls ? ' ' + cls : ''}">
    <img src="${SAI_FACE}" alt="น้องไซ" loading="lazy" decoding="async"
      onerror="this.parentNode.classList.add('no-face');this.remove()">
    <i class="ai-av-fb">${icon('sparkles')}</i>
  </span>`;
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
// ลูกศรมุมล่างขวาไม่ใช่ของประดับ — ไทล์พวกนี้หน้าตาเหมือนการ์ดข้อมูล
// ถ้าไม่มีอะไรบอกว่า "กดแล้วไปต่อ" คนจะอ่านมันเป็นป้ายสรุปแล้วไม่กดเลย
function menuTile(cls, ic, label, sub, count, target) {
  return `<button class="mtile ${cls}" onclick="go('${target}')">
    <span class="mt-ic">${icon(ic)}</span>
    <span class="mt-tx"><span class="mt-lb">${label}</span><span class="mt-sub">${sub}</span></span>
    ${count != null ? `<span class="mt-ct">${count}</span>` : ''}
    <span class="mt-go">${icon('chevron')}</span>
  </button>`;
}

// ---------- ALT 1A6M3: วิดเจ็ตบนหน้าแรก ----------
// ช่องบนสุดของหน้าแรกที่ผู้ใช้เลือกเองว่าจะให้แสดงอะไร
const WG_KEY = 'studentos.alt.widget';
const WG_NOTE_KEY = 'studentos.alt.widgetNote';
const WG_PHOTO_KEY = 'studentos.alt.widgetPhoto';
// 'urgent' ไม่ใช่ลิสต์งานอีกแล้ว — ลิสต์ขึ้นเสมอ (ดู urgentCard) ค่านี้จึงแปลว่า "ไม่ใช้ช่องนี้"
// ชื่อคีย์ยังเป็น 'urgent' เหมือนเดิม เพราะมันคือค่าที่อยู่ในเครื่องคนที่ใช้อยู่แล้ว
const WG_NAME = { urgent: 'ไม่ใช้ช่องนี้', note: 'โน้ตของฉัน', clock: 'เวลา', photo: 'ภาพของฉัน' };

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

// ช่องที่ผู้ใช้เลือกเอง — รูป/โน้ต/นาฬิกา
//
// ตั้งแต่ 1A8 ย้ายลงไปอยู่ **ท้ายหน้าแรก** ไม่ใช่บนสุด
// ไม่ได้ลดความสำคัญของมัน แต่ของบนสุดของจอนี้ถูกจองไว้ให้คำตอบของคำถามเดียวที่แอปนี้สัญญาไว้
// รูปแมวสวย ๆ ที่บังคำว่า "ทำสิ่งนี้ก่อน" คือรูปที่ทำให้แอปเสียหน้าที่ของตัวเองไป
// ค่าตั้งต้น 'urgent' คืนค่าว่างอยู่แล้ว คนที่ไม่เคยตั้งอะไรจึงไม่เห็นความต่าง
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

  return '';
}

// ---------- ลิสต์ "ควรทำก่อน" (ถอดออกแล้วใน 1A8) ----------
// การ์ดสามใบที่หน้าตาเท่ากันหมด ถูกแทนด้วย nowCard() ที่ให้คำตอบใบเดียวพร้อมเหตุผล
//
// เหตุผลที่ถอด: สามตัวเลือกที่ดูเท่ากัน = ยังต้องตัดสินใจเองอยู่ดี ซึ่งเป็นสิ่งเดียวที่แอปนี้
// รับปากว่าจะทำแทน · ลิสต์แบบเดิมยังอยู่ครบในแท็บ "ตาราง" → มุมมอง "รายการงาน"
// (`wgTick` / `wgDueTone` / `wgDueText` ข้างล่างไม่มีใครเรียกแล้วตั้งแต่ 1A9 —
//  กล่อง LATER ที่เคยเรียกสองตัวหลังถูกยุบเป็นบรรทัด "ยังเหลืออีก N งาน"
//  ยังไม่ลบทิ้งเพราะเป็นตัวช่วยเล็ก ๆ ที่ลิสต์งานแบบอื่นหยิบไปใช้ได้ทันที)

// วงกลมติ๊กเสร็จ — ทุกใบในลิสต์มี เพราะ "เห็นแล้วทำอะไรได้เลย" คือเหตุผลที่ลิสต์นี้มีอยู่
// stopPropagation กันไม่ให้การกดติ๊กกลายเป็นการเปิดหน้าแก้ไขงานไปด้วย
function wgTick(t) {
  return `<button class="wg-tick" onclick="event.stopPropagation();toggleDone('${t.id}',this)"
    aria-label="ทำเสร็จ: ${esc(taskTitleText(t))}">${icon('check')}</button>`;
}

// สีของกำหนดส่ง — ตัวเดียวในลิสต์ที่บอกความเร่ง เพราะทุกแถวขนาดเท่ากันหมด
// ใช้ dueTone() ตัวเดียวกับหน้ารายการงาน (hot/warm) ไม่ตั้งเกณฑ์ใหม่ของตัวเอง —
// สองจอนี้พูดถึงงานใบเดียวกัน ถ้าเกณฑ์ต่างกัน ใบเดียวจะแดงจอหนึ่งเหลืองอีกจอหนึ่ง
// ที่เพิ่มคือ 'far' แทนค่าว่าง เพื่อให้ "ยังมีเวลา" เป็นสีเขียวได้ ไม่ใช่เทากลืนกับข้อความอื่น
// งานที่ยังไม่ได้ตั้งกำหนดต้องไม่ได้สีเขียว — เขียวแปลว่า "ยังมีเวลา" ซึ่งเป็นคำตอบ
// ที่เราไม่มีสิทธิ์ให้ ในเมื่อไม่รู้ว่าส่งวันไหน มันจึงเป็นสีกลางเหมือนข้อความอื่นในบรรทัด
function wgDueTone(t, now) { return t.due ? (dueTone(t, now) || 'far') : ''; }

// ข้อความกำหนดส่งของแถว — ขึ้นทุกแถวเสมอ ต่อให้ยังไม่ได้ตั้งกำหนด
// เดิมแถวที่ไม่มีกำหนดจะไม่มีบรรทัดนี้เลย เหลือชื่องานลอยกลางกล่องที่สูงเท่าแถวอื่น
// สองแถวติดกันจึงสูงเท่ากันแต่มีเนื้อไม่เท่ากัน ซึ่งอ่านออกมาเป็น "แถวนี้เสีย" ไม่ใช่ "แถวนี้ไม่มีกำหนด"
// fmtDue ตอบ 'ยังไม่ระบุกำหนด' ให้อยู่แล้วเมื่อไม่มีวันที่ — แค่ต้องเรียกมันทุกครั้ง
//
// ตัด ⚠ ที่ fmtDue แปะมาหน้าคำว่า "เลยกำหนด" ออกเฉพาะที่นี่
// ตัวหนังสือทั้งบรรทัดเป็นสีแดงอยู่แล้ว สัญลักษณ์เตือนจึงพูดซ้ำสิ่งที่สีพูดไปแล้ว
// และมันเป็นอิโมจิตัวเดียวในจอที่เหลือใช้ไอคอนเส้นล้วน — จออื่นยังได้ ⚠ เหมือนเดิม
function wgDueText(t, now) {
  return fmtDue(t.due, now, t).replace(/^⚠\s*/, '');
}

// ชิปสถานะของงานหนึ่งใบ — กำหนดส่งมาก่อนเสมอเพราะเป็นข้อมูลที่ตัดสินใจแทนได้จริง
// ที่เหลือ (เวลาที่ใช้ · คะแนนเก็บ) เป็นสีกลาง เพราะมันไม่ใช่ข่าวร้ายในตัวเอง
//
// เดิมบรรทัดนี้เอา fmtDue มาต่อกับ info.reasons[0] ซึ่งพอเลยกำหนดแล้วทั้งสองตัว
// พูดเรื่องเดียวกัน ได้ข้อความว่า "⚠ เลยกำหนด (พ. 12 ส.ค.) · ~90 นาที · คะแนน 10% ·
// ⚠ เลยกำหน…" คือซ้ำแล้วยังยาวจนโดนตัด — เหตุผลจึงถูกตัดทิ้ง ไม่เอามาแสดงซ้ำอีก
function dueChips(t, now) {
  const chips = [];
  if (t.due) {
    const due = new Date(t.due);
    const late = due < now;
    const soon = !late && (due - now) <= 24 * 3.6e6;
    chips.push(`<span class="wg-chip ${late ? 'late' : soon ? 'soon' : ''}">${icon(late ? 'flame' : 'calendar')}${
      esc(late ? 'เลยกำหนด ' + overdueFor(now - due) : fmtDue(t.due, now, t))}</span>`);
  }
  if (t.estMin) chips.push(`<span class="wg-chip">${icon('clock')}~${t.estMin} นาที</span>`);
  if (t.scorePct != null) chips.push(`<span class="wg-chip">${icon('medal')}คะแนน ${t.scorePct}%</span>`);
  return `<div class="wg-chips">${chips.join('')}</div>`;
}

// "เลยกำหนดมานานแค่ไหน" — ตอบเป็นระยะเวลา ไม่ใช่วันที่
// วันที่ในวงเล็บ (พ. 12 ส.ค.) บังคับให้ผู้ใช้คำนวณเองว่ามันคือกี่วันที่แล้ว
function overdueFor(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return Math.max(1, min) + ' นาที';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' ชม.';
  return Math.round(h / 24) + ' วัน';
}

// ไทล์กล่องเข้า — วางกว้างเต็มแถวใต้ปุ่มเพิ่มงาน เพราะเป็นจอเดียวที่บอกว่า
// "มีของเข้ามาเองระหว่างที่คุณไม่ได้เปิดแอป" ตัวเลขค้างจึงต้องสะดุดตากว่าตัวเลขอื่น
function inboxTile() {
  const wait = typeof inboxPending === 'function' ? inboxPending().length : 0;
  return `<button class="mtile wide tone-inbox" onclick="go('scr-inbox')">
    <span class="mt-ic">${icon('chat')}</span>
    <span class="mt-tx"><span class="mt-lb">กล่องเข้า</span>
      <span class="mt-sub">ข้อความจาก LINE ที่รอตรวจ</span></span>
    <span class="mt-ct${wait ? ' hot' : ''}">${wait}</span>
    <span class="mt-go">${icon('chevron')}</span>
  </button>`;
}

// ============================================================
// หน้าแรก = "วันนี้" · จอเดียวที่ตอบคำถามเดียวของโปรดักต์
// ============================================================
// เดิมหน้าแรกเป็นตารางทางลัด 5 ใบ + ลิสต์งาน 3 บรรทัด ซึ่งอ่านออกมาว่า
// "เลือกเองสิว่าจะไปหน้าไหน แล้วเลือกเองว่าจะทำงานไหน" — คือการโยนการตัดสินใจกลับสองรอบซ้อน
// ทั้งที่คำถามที่พาผู้ใช้มาเปิดแอปมีข้อเดียว: ตอนนี้ควรทำอะไร
//
// โครงใหม่ตอบเป็นลำดับเดียวจากบนลงล่าง ไม่มีทางแยก:
//   เวลาที่มีจริง → NOW หนึ่งใบ + ทำไมถึงใบนี้ → ถัดไปคืออะไร → แผนทั้งวัน → ที่เหลือพับไว้
//
// สิ่งที่หายไปโดยตั้งใจ: ตารางทางลัด (แถบล่างทำหน้าที่นั้นอยู่แล้ว)
// และการ์ด "ควรทำก่อน" ที่แสดงสามใบเท่า ๆ กัน — สามตัวเลือกที่ดูเท่ากันคือการไม่ตัดสินใจ

let _planCache = null;

// แผนของวันนี้ที่ทุกจอใช้ร่วมกัน — คิดใหม่เมื่อข้ามนาทีหรือข้อมูลเปลี่ยนเท่านั้น
function todayPlan(now = new Date()) {
  const key = Math.floor(now.getTime() / 60000) + ':' + stateRev;
  if (_planCache && _planCache.key === key) return _planCache.val;
  const val = studyPlan(state, now);
  _planCache = { key, val };
  return val;
}

// แผนเดียวกัน แต่ตัด now ที่ "ลงมือทำไม่ได้" ออก — ทุกจอที่วาดการ์ดโฟกัสต้องเรียกตัวนี้
//
// ตอนไม่มีช่องว่างเหลือในวันนี้ studyPlan เลือก now จากคะแนนล้วน ซึ่งหยิบกิจกรรมอย่าง
// "ประชุมชมรม" ขึ้นมาเป็นการ์ดใบใหญ่พร้อมปุ่ม "เริ่มทำเลย" ได้ — ปุ่มที่กดแล้วเข้าโหมด
// จับเวลาการประชุมของคนอื่น · ของพวกนี้ตัดสินใจอะไรไม่ได้ มันมีที่ของตัวเองคือกอง
// "เตือนความจำ" บนหน้าแรก
//
// เคยแก้ไว้ในหน้าแรกที่เดียว แล้วบั๊กเดิมโผล่ซ้ำทันทีที่จอน้องไซวาดการ์ดโฟกัสของตัวเอง —
// กฎที่เขียนไว้ในจอเดียวคือกฎที่จอถัดไปไม่รู้ว่ามีอยู่ · จึงต้องเป็นฟังก์ชันกลาง
// ไม่ไปแก้ planner.js เพราะจออื่น (เส้นเวลา · แผนวันนี้) ยังต้องเห็นของครบทุกใบ
// (สำเนาตื้น ๆ ไม่แตะ _planCache ที่จออื่นถืออยู่)
function focusPlan(now = new Date()) {
  const raw = todayPlan(now);
  return raw.now && isRemindKind(raw.now.task) ? Object.assign({}, raw, { now: null }) : raw;
}

// เหตุผลบนการ์ด NOW มาจาก priorityInfo().reasons ที่เอนจินคำนวณไว้อยู่แล้ว
// ห้ามเขียนข้อความให้กำลังใจแทน — "สู้ ๆ นะ" ไม่ได้บอกว่าทำไมงานใบนี้ถึงมาก่อนใบอื่น
// ไอคอนเลือกจากเนื้อของเหตุผลเอง เพื่อให้กวาดตาแล้วแยกออกว่าอันไหนคือเรื่องเวลา อันไหนคือคะแนน
// เหตุผลข้อเดียวที่จะเอาไปแปะข้างชื่องาน — ต้องเป็นข้อที่บอกอะไรจริง ๆ
// reasons[0] เป็นข้อความเรื่องเวลาเสมอ ซึ่งบางทีเป็นคำเติมอย่าง "ยังพอมีเวลา"
// แล้วได้บรรทัดที่ขัดกันเอง: "งานถัดไป: อ่านสอบ · ยังพอมีเวลา" — ถ้ายังพอมีเวลาแล้วจะทำทำไม
const REASON_FILLER = /ยังพอมีเวลา|ยังอีกหลายวัน|ยังไม่ระบุกำหนด/;

function topReason(info) {
  return info.reasons.find(r => !REASON_FILLER.test(r)) || info.reasons[0] || '';
}

// สามข้อที่จะขึ้นใต้หัวข้อ "ทำไมต้องเป็นงานนี้?"
//
// คำเติมอย่าง "ยังพอมีเวลา" ต้องไม่โผล่ตรงนี้เด็ดขาด — มันเถียงกับหัวการ์ดที่เขียนว่า
// "ทำสิ่งนี้ก่อน" อยู่สองบรรทัดข้างบนพอดี · งานที่ยังไกลแต่ขึ้นมาเป็นอันดับหนึ่ง
// มักขึ้นมาด้วยเหตุผลอื่น (งานใหญ่ · คะแนนเยอะ) ซึ่งอยู่ในรายการอยู่แล้ว
// เหลือศูนย์ข้อเมื่อไหร่ค่อยถอยไปใช้ของเดิม — ไม่มีเหตุผลเลยแย่กว่ามีเหตุผลที่อ่อน
function whyList(info) {
  const strong = info.reasons.filter(r => !REASON_FILLER.test(r));
  return (strong.length ? strong : info.reasons).slice(0, 3);
}

function reasonIcon(text) {
  if (/โอกาสสุดท้าย|เลยกำหนด|เลยเวลา/.test(text)) return '🔴';
  if (/คะแนน/.test(text)) return '💯';
  if (/ควรเริ่มอ่าน|สอบใน/.test(text)) return '📖';
  if (/นาที|ชม\.|งานใหญ่/.test(text)) return '⏱';
  if (/ส่ง|ใกล้กำหนด|ถึงเวลา|วัน|สัปดาห์|เวลา/.test(text)) return '⏰';
  if (/★/.test(text)) return '★';
  return '📌';
}

// แถบ "จัดแผนใหม่ให้แล้ว" — จังหวะที่ทำให้แอปนี้ไม่ใช่ to-do list
//
// buildDayPlan คิดใหม่ทุกครั้งที่วาดจออยู่แล้ว สิ่งที่ขาดมาตลอดคือการบอกผู้ใช้ว่ามันคิดใหม่แล้ว
// ผู้ใช้ที่หายไปสองชั่วโมงแล้วกลับมาเจอตารางที่เปลี่ยนไปเงียบ ๆ จะไม่รู้ว่าแอปรู้เรื่องเขา
// ประโยคต้องไม่ตำหนิ — พลาดแล้วโดนบ่นคือเหตุผลอันดับหนึ่งที่คนเลิกใช้แอปวางแผน
function replanBanner(sp, now) {
  if (!sp.hasReplan) return '';
  const m = sp.misses;
  const hm = v => String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  const names = m.tasks.slice(0, 2).map(t => taskTitleText(t)).join(' · ');
  const still = sp.plan.slots.some(s => !s.break && m.tasks.includes(s.task));
  return `<section class="td-replan">
    <div class="tr-head">${icon('clock')}<b>จัดแผนที่เหลือใหม่ให้แล้ว</b></div>
    <p class="tr-body">ช่วง ${hm(m.since)} ที่วางไว้ผ่านไปแล้ว ${humanMin(m.lostMin)}
      — ${esc(names)}${m.tasks.length > 2 ? ' และอีก ' + (m.tasks.length - 2) + ' งาน' : ''}
      ${still ? 'ถูกย้ายลงเวลาที่เหลือของวันนี้แล้ว' : 'ไม่มีเวลาเหลือในวันนี้แล้ว — ดูตรงกล่องสีแดงข้างล่าง'}</p>
    <button class="tr-ok" onclick="dismissReplan(${m.lostMin})">เข้าใจแล้ว</button>
  </section>`;
}

function dismissReplan(lostMin) {
  markReplanTold(new Date(), lostMin || 0);
  _planCache = null;
  renderAll();
}

// การ์ด NOW — ของชิ้นเดียวที่ใหญ่ที่สุดบนจอ อ่านออกจากระยะแขน// ============================================================
// จอ "วันนี้" — ลำดับสายตาเป็นเส้นเดียว ไม่มีของขนาดเท่ากันสองชิ้น
// ============================================================
// การ์ดขนาดเท่ากันเรียงลงมาคือ dashboard · dashboard แปลว่า "อ่านเองนะว่าอันไหนสำคัญ"
// ซึ่งเป็นงานที่แอปนี้รับปากว่าจะทำแทน · ขนาดตัวอักษรจึงต้องต่างกันจริง ไม่ใช่ต่างกันเล็กน้อย
//
//   NOW      ชื่องาน 26px   — ของชิ้นเดียวที่อ่านออกจากระยะแขน
//   NEXT     ชื่องาน 15px   — รู้ว่ามีอะไรรออยู่ก็พอ
//   LATER    ชื่องาน 13px   — เป็นบันทึก ไม่ใช่สิ่งที่ต้องตัดสินใจตอนนี้
//   แผน/AI   12px           — ของประกอบ ไม่ใช่คำตอบ
//
// ทุกอย่างที่ไม่ได้ตอบห้าคำถามนี้ ถูกย้ายออกไปแท็บอื่นแล้ว:
//   ตอนนี้ทำอะไร · ทำไมอันนี้ · นานแค่ไหน · แล้วอะไรต่อ · วันนี้ทันไหม

// ---------- หัวจอ: ทักทาย + ตัวเลขสามตัวที่ตอบว่า "วันนี้หนักไหม" ----------
function todayHead(sp, now) {
  const h = now.getHours();
  const greet = h < 11 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const win = sp.plan.windows;
  const pend = pendingTasks();
  const name = who();
  // กระดิ่งชี้ไปกล่องเข้า ไม่ใช่ศูนย์แจ้งเตือนใบใหม่ — ของที่ "เข้ามาเองระหว่างที่ไม่ได้เปิดแอป"
  // มีที่เดียวคือกล่องเข้า · สร้างที่เก็บแจ้งเตือนอีกที่คือสร้างของค้างชุดที่สองให้ต้องเคลียร์
  const wait = typeof inboxPending === 'function' ? inboxPending().length : 0;

  // บรรทัดรองต้องเป็นตัวเลขที่เปลี่ยนพฤติกรรมได้ ไม่ใช่คำทักทายรอบสอง
  // "เหลือเวลาว่างเท่าไหร่" คือข้อมูลที่ทำให้การ์ดข้างล่างมีความหมาย — 40 นาทีในสามชั่วโมง
  // กับ 40 นาทีในห้าสิบนาที เป็นคนละสถานการณ์กันคนละเรื่อง
  const sub = sp.now
    ? `เหลือเวลาว่าง ${esc(humanMin(win.budgetMin))} · ${pend.length} งานค้าง`
    : pend.length ? `${pend.length} รายการรออยู่ — ไม่มีงานที่ต้องเจียดเวลา`
    : 'ไม่มีอะไรค้าง — วันนี้พักได้';

  return `<header class="td-head">
    <button class="th-me" onclick="go('scr-profile')" aria-label="หน้าของฉัน">${
      name ? esc(name.trim().charAt(0).toUpperCase()) : icon('user')}</button>
    <div class="th-tx">
      <h1 class="th-greet">${greet}${name ? ' ' + esc(name) : ''}</h1>
      <p class="th-sub">${sub}</p>
    </div>
    <button class="th-bell" onclick="go('scr-inbox')"
      aria-label="${wait ? 'กล่องเข้า — รอตรวจ ' + wait + ' รายการ' : 'กล่องเข้า'}">
      ${icon('bell')}${wait ? '<span class="th-dot"></span>' : ''}
    </button>
  </header>`;
}

// ---------- กล่องข้อสังเกตของ AI — ถอดออกแล้วใน 1A9 ----------
// เคยอยู่เหนือการ์ดโฟกัส คอยพูดเรื่องงานล้น · พลาดส่ง · จัดแผนใหม่ · งานที่พักไว้แต่เลื่อนไม่ได้
//
// ปัญหาไม่ใช่ว่ามันพูดผิด — ทุกบรรทัดมาจากตัวเลขจริง · ปัญหาคือ **ตำแหน่ง**
// มันเป็นย่อหน้าสี่บรรทัดที่ยืนขวางระหว่างคำทักทายกับคำตอบ ผู้ใช้ต้องอ่านคำอธิบายจนจบ
// ก่อนถึงสิ่งที่เปิดแอปมาหา ทั้งที่ประโยคยาวที่สุดในกล่อง ("ขาด 40 นาที · เลื่อนอะไรไม่ได้แล้ว
// เริ่ม X ตั้งแต่คืนนี้จะได้ไม่ไปกองวันสุดท้าย") จบลงด้วยการบอกให้ทำงานที่การ์ดข้างล่างชี้อยู่แล้ว
//
// สัญญาว่า "เปิดแอป → รู้ว่าต้องทำอะไร → ลงมือ ภายใน 3 วินาที" กับย่อหน้าที่ต้องอ่านก่อน
// อยู่ด้วยกันไม่ได้ · กล่องนี้จึงหายไปทั้งก้อน ไม่ได้ย้ายไปไหน
//
// ของที่หายไปกับมัน — ถ้าจะเอากลับ ต้องหาที่อยู่ใหม่ที่ไม่ขวางคำตอบ:
//   • คำเตือน missed (เวลาว่างก่อนกำหนดส่งไม่พอแล้ว) — อันเดียวที่เป็นข่าวร้ายจริง
//   • คำเตือน stuck + ปุ่ม unpause() — ทางกลับของงานที่กด "ยังไม่ไหว" แล้วเลื่อนไม่ได้
//   • คำเตือน overload (วันไหนงานล้น) — ซ้ำกับมุมมอง 7 วันในแท็บ "งาน"
//   • แถบ "จัดแผนใหม่ให้แล้ว" + dismissReplan()
// สามอย่างแรกยังมีฟังก์ชันรออยู่ในไฟล์นี้ ตัวคำนวณอยู่ใน planner.js (studyPlan().warnings) ครบ

// ---------- NOW ----------
// ของชิ้นเดียวบนจอที่มีสิทธิ์ใหญ่ · ถ้ามีอย่างอื่นใหญ่เท่านี้ แปลว่ายังไม่ได้ตัดสินใจแทนผู้ใช้
//
// 1A9 ยกมันขึ้นเป็นการ์ดพื้นสีอ่อนใบเดียวในจอ (ที่เหลือเป็นแถวไม่มีพื้น) เพราะ "ตัวใหญ่กว่า"
// อย่างเดียวยังแพ้การกวาดตาเร็ว ๆ — พื้นที่ต่างจากพื้นจอ คือสิ่งที่สายตาจับได้ก่อนขนาดตัวอักษร
function nowCard(sp, now) {
  const n = sp.now;
  if (!n) return '';
  const t = n.task, info = n.info;
  const slot = n.slot;
  const run = runningWork();
  const running = run && run.taskId === t.id;
  const prog = Math.max(0, Math.min(100, t.progress || 0));
  const subj = t.subject && t.subject !== 'อื่น ๆ' ? t.subject : '';

  // งานที่ยังไม่มีกำหนดส่งต้องไม่ถูกแต่งให้ดูด่วน — เราไม่รู้ว่ามันด่วนไหม และการเดาแทน
  // คือการสร้างข้อมูลขึ้นมาเอง · พูดตรง ๆ ว่าไม่รู้ แล้วขอข้อมูลที่ขาดไป มีประโยชน์กว่า
  const noDue = !t.due;
  const tone = noDue ? 'green' : priorityTone(info.stars);

  // ---- แถวบน: ไอคอนซ้าย · คำตัดสินขวา ----
  // เดิมไอคอนเป้าเป็นก้อน 40px ยืนเดี่ยวอยู่มุมซ้ายบน = ของที่หนักที่สุดในตำแหน่งที่ตาแวะก่อน
  // แต่ไม่ได้บอกอะไรเลย · จับมันมานั่งแถวเดียวกับป้ายคำตัดสิน แถวบนเลยกลายเป็นข้อมูลทั้งแถว
  // และมุมขวาที่เคยว่างเปล่าได้ทำงาน
  const pillIc = tone === 'red' ? 'flame' : tone === 'yellow' ? 'clock' : '';
  const pillTx = noDue ? 'ยังไม่รู้กำหนด' : priorityLabel(info.stars);

  // ---- บรรทัดเดียวใต้ชื่องาน: ทำไมใบนี้ + คะแนนเก็บ ----
  // เดิมเป็นสองบรรทัด (เหตุผล แล้วก็รายการข้อเท็จจริง) ซึ่งพูดคำว่า "เลยกำหนด" ซ้ำกันเอง
  // เพราะ topReason() กับ fmtDue() ต่างคนต่างรายงานเรื่องเส้นตายอันเดียวกัน
  // ตอนนี้เส้นตายถูกพูดที่นี่ที่เดียว และพูดเป็นระยะเวลาเมื่อเลยมาแล้ว ("เลยกำหนดมา 4 วัน")
  // เพราะวันที่ในวงเล็บบังคับให้ผู้ใช้คำนวณเองว่ามันคือกี่วันที่แล้ว
  const late = t.due && new Date(t.due) < now;
  const why = noDue ? 'ยังไม่รู้กำหนดส่ง — เลือกให้จากงานที่ค้างนานที่สุด'
    : late ? 'เลยกำหนดมา ' + overdueFor(now - new Date(t.due))
    : topReason(info);
  const whyBits = [why];
  // เหตุผลอันดับหนึ่งของงานที่ยังไม่ด่วนมักเป็น "คะแนน 30%" อยู่แล้ว — ต่อท้ายอีกรอบ
  // ได้บรรทัดว่า "คะแนน 30% · คะแนน 30%" · เช็คก่อนต่อ ไม่ใช่ต่อแล้วค่อยหวังว่าจะไม่ชน
  if (t.scorePct != null && !why.includes('คะแนน')) whyBits.push('คะแนน ' + t.scorePct + '%');

  // ---- สองช่องข้อมูล: เริ่มเมื่อไหร่ · ใช้เวลาเท่าไหร่ ----
  // สองคำถามที่เหลืออยู่หลังรู้แล้วว่าจะทำอะไร · ตอบด้วยตัวเลขล้วน ไม่มีประโยค
  const goalMin = t.estMin || 30;
  const startTx = slot ? fmtClock(slot.start) : 'ยังไม่มีคิว';

  // ---- วงแหวนความคืบหน้า ----
  // ขึ้นเฉพาะตอนมีความคืบหน้าจริง · งานที่ยังไม่เริ่มไม่ควรได้วงแหวน 0% เพราะวงกลมเปล่า
  // กินที่เท่ากับวงกลมที่มีข้อมูล แล้วบอกสิ่งที่ปุ่ม "เริ่มทำเลย" ข้างบนบอกไปแล้ว
  const CIRC = 113.1; // 2πr เมื่อ r = 18 ในกรอบ 44×44
  const hasProg = prog > 0 && prog < 100;
  const ring = !hasProg ? '' : `<div class="tn-prog">
      <span class="tp-ring">
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle class="tr-bg" cx="22" cy="22" r="18"></circle>
          <circle class="tr-fg" cx="22" cy="22" r="18"
            stroke-dasharray="${CIRC}" stroke-dashoffset="${(CIRC * (1 - prog / 100)).toFixed(1)}"></circle>
        </svg><b>${prog}%</b>
      </span>
      <span class="tp-tx"><i>ความคืบหน้า</i><b>${Math.round(goalMin * prog / 100)} / ${goalMin} นาที</b></span>
    </div>`;

  return `<section class="td-now ${tone}${running ? ' running' : ''}">
    <div class="tn-top">
      <span class="tn-mark">${icon('target')}</span>
      <span class="tn-pill ${tone}">${pillIc ? icon(pillIc) : ''}${esc(pillTx)}</span>
    </div>

    <div class="tn-eyebrow">โฟกัสวันนี้${subj ? ' · ' + esc(subj) : ''}</div>
    <h2 class="tn-title">${esc(t.detail || 'งานนี้')}</h2>
    <div class="tn-why ${tone}">${esc(whyBits.join(' · '))}</div>

    <div class="tn-stats">
      <div class="tn-stat">
        <span class="ts-ic">${icon('clock')}</span>
        <span class="ts-tx"><i>เวลาเริ่ม</i><b>${esc(startTx)}</b></span>
      </div>
      <div class="tn-stat">
        <span class="ts-ic">${icon('target')}</span>
        <span class="ts-tx"><i>เป้าหมาย</i><b>${goalMin} นาที</b></span>
      </div>
    </div>

    <button class="tn-cta" onclick="startFocus('${t.id}')">
      <span class="tc-main">${icon(running ? 'clock' : 'play')}${
        running ? 'กลับเข้าโหมดโฟกัส' : (n.step ? 'เริ่ม ' + n.step.min + ' นาทีแรก' : 'เริ่มทำเลย')}</span>
      ${n.step && !running ? `<span class="tc-sub">${esc(n.step.title)}</span>` : ''}
    </button>

    <div class="tn-foot${hasProg ? '' : ' noprog'}">
      ${ring}
      <div class="tn-acts">
        <button class="ta-done" onclick="toggleDone('${t.id}',this)">${icon('check')}เสร็จแล้ว</button>
        <button onclick="notNow('${t.id}')">ยังไม่ไหว</button>
      </div>
    </div>

    ${noDue ? `<button class="tn-ask" onclick="openForm('${t.id}')">
      ${icon('calendar')}ครูสั่งส่งวันไหน? บอกแล้วผมจัดแผนได้แม่นขึ้น${icon('chevron')}
    </button>` : ''}
  </section>`;
}

// ---------- แยกของที่เหลือออกเป็นสองกอง ----------
// "กิจกรรม" กับ "อื่น ๆ" ไม่ต้องเจียดเวลาให้ (schedulable: false) มันจึงไม่เคยได้ช่องในแผน
// แล้วตกลงมากอง later ทุกใบ ปนกับงานที่แค่ยังไม่ถึงคิววันนี้ — ซึ่งเป็นคนละเรื่องกันสิ้นเชิง
//
//   งานที่ยังไม่ถึงคิว   = "ไว้ค่อยทำ" · ตัดสินใจได้ว่าจะทำวันไหน
//   กิจกรรม/เตือนความจำ = "ถึงเวลาแล้วต้องไป" · ตัดสินใจอะไรไม่ได้ ต้องจำอย่างเดียว
//
// ของที่จำอย่างเดียวไม่ควรอยู่ลิสต์เดียวกับของที่ต้องตัดสินใจ — มันทำให้ลิสต์ยาวขึ้น
// โดยไม่ได้เพิ่มทางเลือกให้เลย · จึงแยกออกเป็นกอง "เตือนความจำ" ของตัวเอง
const REMIND_WINDOW_H = 48;

function isRemindKind(t) { return !TASK_TYPES[taskType(t)].schedulable; }

function homeSplit(sp, now) {
  const rem = [], rest = [];
  // การ์ดโฟกัสไม่ได้อยู่ในแผนเสมอไป — ตอนไม่มีช่องว่างเหลือ ตัวจัดแผนเลือกจากคะแนนล้วน
  // แล้วงานใบนั้นยังค้างอยู่ใน later ด้วย · ปล่อยไว้คือใบเดียวกันโผล่สองที่บนจอเดียว
  const shown = sp.now ? sp.now.task : null;
  for (const t of sp.later) {
    if (t === shown) continue;
    // เลยกำหนดแล้วก็เข้าเงื่อนไข (ผลลบย่อมน้อยกว่า 48) ซึ่งถูก — กิจกรรมที่เลยเวลาแล้ว
    // ต้องขึ้นให้เห็นมากกว่าอันที่ยังไม่ถึง ไม่ใช่หายไปเงียบ ๆ
    const near = t.due && (new Date(t.due) - now) / 3.6e6 <= REMIND_WINDOW_H;
    if (isRemindKind(t) && near) rem.push(t); else rest.push(t);
  }
  rem.sort((a, b) => new Date(a.due) - new Date(b.due));
  // เกินสามใบล้นกลับไปกอง "ที่เหลือ" — สามคือจำนวนที่กวาดตาจบโดยไม่ต้องอ่านทีละบรรทัด
  return { reminders: rem.slice(0, 3), rest: rest.concat(rem.slice(3)) };
}

// ---------- NEXT ----------
// ตอบคำถามเดียว: "แล้วอะไรต่อ" — ใบเดียวพอ
//
// ของเดิมมีกอง "ไว้ทีหลัง" อีกสองแถวต่อท้าย ซึ่งเป็นการเอางานอันดับ 3 กับ 4 มาวางไว้ใต้จมูก
// ทั้งที่จอนี้เพิ่งบอกไปสองบรรทัดข้างบนว่าให้ทำอันดับ 1 · รายการเต็มอยู่ในแท็บ "งาน" อยู่แล้ว
// บรรทัดเดียวว่า "ยังเหลืออีก N งาน" ให้ข้อมูลเท่ากันในหนึ่งในสิบของพื้นที่
//
// เคยต่อท้ายว่า "— ยังไม่ถึงคิววันนี้" ซึ่งเป็นคำอธิบายที่ไม่มีใครต้องการ:
// จอนี้ทั้งจอพูดเรื่องคิวของวันนี้อยู่แล้ว ของที่ไม่ได้อยู่ในนั้นก็คือของที่ไม่ได้อยู่ในนั้น
function upNext(sp, split, now) {
  const rest = split.rest.length;
  if (!sp.next && !rest) return '';
  if (!sp.next) {
    return `<button class="tu-more solo" onclick="go('scr-tasks')">
      ยังเหลืออีก ${rest} งาน${icon('chevron')}</button>`;
  }

  const t = sp.next.task, slot = sp.next.slot;
  const end = new Date(slot.start.getTime() + slot.min * 60000);
  const meta = [t.subject && t.subject !== 'อื่น ๆ' ? t.subject : '',
    slot.min + ' นาที'].filter(Boolean).join(' · ');

  return `<section class="td-up">
    <div class="tu-lb">ถัดไป</div>
    <button class="tu-row ${subjClass(t.subject)}" onclick="startFocus('${t.id}')">
      <span class="tu-ic">${icon('calendar')}</span>
      <span class="tu-tx">
        <span class="tu-when">${fmtClock(slot.start)} – ${fmtClock(end)}</span>
        <b>${esc(t.detail || t.subject || 'งานถัดไป')}</b>
        <span class="tu-meta">${esc(meta)}</span>
      </span>
      <span class="tu-go">${icon('chevron')}</span>
    </button>
    ${rest ? `<button class="tu-more" onclick="go('scr-tasks')">
      ยังเหลืออีก ${rest} งาน${icon('chevron')}</button>` : ''}
  </section>`;
}

// ---------- เตือนความจำ ----------
// สองบรรทัดต่อใบ ไม่มีปุ่มลงมือ เพราะไม่มีอะไรให้ลงมือ — มันคือของที่ต้องไปให้ทันเวลาเท่านั้น
// สีมาจากเวลาอย่างเดียว (เลยแล้ว / ภายใน 12 ชม. / ที่เหลือ) ไม่ใช่จากคะแนนความสำคัญ
// ความสำคัญเป็นเรื่องของการจัดคิว และของพวกนี้ไม่ได้เข้าคิว
function remindersBlock(list, now) {
  if (!list.length) return '';
  return `<section class="td-rem">
    <div class="tu-lb">เตือนความจำ</div>
    ${list.map(t => {
      const due = new Date(t.due);
      const late = due < now;
      const soon = !late && (due - now) <= 12 * 3.6e6;
      const tone = late ? 'late' : soon ? 'soon' : '';
      return `<button class="tm-row" onclick="openForm('${t.id}')">
        <span class="tm-ic ${tone}">${icon(taskType(t) === 'activity' ? 'flag' : 'pin')}</span>
        <span class="tm-tx">
          <b>${esc(t.detail || t.subject || typeInfo(t).name)}</b>
          <span class="${tone}">${esc(late ? 'เลยกำหนดมา ' + overdueFor(now - due)
            : fmtDue(t.due, now, t))}</span>
        </span>
        <span class="tm-go">${icon('chevron')}</span>
      </button>`;
    }).join('')}
  </section>`;
}

// ---------- แผนวันนี้ (ของประกอบ ไม่ใช่คำตอบ — จึงพับไว้) ----------
// รางเวลาเคยกางอยู่ตลอด แล้วดันหน้าแรกยาวเกินหนึ่งจอทันทีที่มีสามงานขึ้นไป
// ซึ่งแลกไม่คุ้ม: สองบรรทัดแรกของรางพูดเรื่องเดียวกับการ์ด NOW กับแถว "ถัดไป" ที่อ่านไปแล้ว
// สิ่งที่รางมีของตัวเองจริง ๆ คือ "รูปร่างของทั้งเย็น" ซึ่งเป็นของที่คนอยากดูตอนวางแผน
// ไม่ใช่ตอนเปิดแอปมาถามว่าทำอะไรก่อน — หัวข้อที่กดกางจึงตรงกับจังหวะที่คนอยากได้มันจริง ๆ
//
// สถานะกาง/พับอยู่ในตัวแปรธรรมดา ไม่ได้เขียนลง localStorage โดยตั้งใจ:
// มันเป็นความสนใจของ "รอบนี้" ไม่ใช่การตั้งค่า · เปิดแอปใหม่ควรกลับมาที่คำตอบสั้นที่สุดเสมอ
let planOpen = false;

function togglePlan() {
  planOpen = !planOpen;
  haptic('tap');
  renderMenu();
}

function planStrip(sp, now) {
  const p = sp.plan;
  if (!p.slots.length) return '';
  const nowTask = sp.now && sp.now.task;
  const nextTask = sp.next && sp.next.task;
  let markedNow = false, markedNext = false;
  const work = p.slots.filter(s => !s.break).length;

  const rail = !planOpen ? '' : `<div class="tp-rail">
      ${p.slots.map(s => {
        if (s.break) return `<div class="tp-row brk"><span class="mono">${fmtClock(s.start)}</span>
          <span class="tp-tx">พัก ${s.min} นาที</span></div>`;
        // ติดป้ายเฉพาะช่องแรกของงานนั้น — งานที่ถูกหั่นสองช่วงไม่ควรได้ป้าย "ตอนนี้" สองอัน
        let pill = '';
        if (nowTask && s.task === nowTask && !markedNow) { pill = 'now'; markedNow = true; }
        else if (nextTask && s.task === nextTask && !markedNext) { pill = 'next'; markedNext = true; }
        return `<div class="tp-row ${subjClass(s.task.subject)}${pill === 'now' ? ' cur' : ''}"
            onclick="startFocus('${s.task.id}')">
          <span class="mono">${fmtClock(s.start)}</span>
          <span class="tp-tx">
            <b>${esc(s.task.detail || s.task.subject)}</b>
            <span>${s.min} นาที${s.partial ? ' · จาก ' + remainingMin(s.task) + ' นาที' : ''}</span>
          </span>
          ${pill ? `<span class="tp-pill ${pill}">${pill === 'now' ? 'ตอนนี้' : 'ถัดไป'}</span>` : ''}
          <span class="tp-go">${icon('chevron')}</span>
        </div>`;
      }).join('')}
    </div>
    <button class="tp-all" onclick="go('scr-timeline')">ดูตารางทั้งวัน${icon('chevron')}</button>`;

  return `<section class="td-plan${planOpen ? ' open' : ''}">
    <button class="tp-fold" onclick="togglePlan()" aria-expanded="${planOpen}">
      <span class="tp-fic">${icon('calendar')}</span>
      <span class="tp-ftx"><b>แผนวันนี้</b><span>${work} ช่วง · ${esc(humanMin(p.usedMin))}${
        p.bufferMin ? ' · เผื่อไว้ ' + p.bufferMin + ' นาที' : ''}</span></span>
      <span class="tp-fgo">${icon('chevron')}</span>
    </button>
    ${rail}
  </section>`;
}

// ---------- ช่องถามน้องไซ ----------
// อยู่ท้ายเนื้อหา ไม่ใช่บนหัวจอ — ตำแหน่งนี้คือคำสารภาพว่าจอข้างบนตอบไม่ครบทุกกรณี
// คนที่อ่านลงมาถึงตรงนี้แล้วยังไม่ได้คำตอบ คือคนที่มีคำถามจริงที่แผนตอบให้ไม่ได้
// ("พรุ่งนี้สอบฟิสิกส์ ช่วยจัดเวลาให้หน่อย") ส่วนคนที่ได้คำตอบแล้วกดปุ่มเริ่มไปตั้งแต่ครึ่งจอบน
//
// ช่องนี้ไม่ใช่แชทซ้อน — พิมพ์แล้วส่งจะพาไปที่จอน้องไซพร้อมคำถามนั้น
// ให้บทสนทนามีที่อยู่ที่เดียว ไม่ใช่สองที่ที่จำคนละเรื่อง
function askBar() {
  return `<section class="td-ask">
    <span class="tk-ic">${icon('sparkles')}</span>
    <input id="hmAsk" class="tk-in" type="text" maxlength="500" enterkeyhint="send"
      placeholder="ถามน้องไซ…"
      onkeydown="if(event.key==='Enter'){event.preventDefault();homeAsk();}">
    <button class="tk-go" onclick="homeAsk()" aria-label="ส่งคำถาม">${icon('chevron')}</button>
  </section>`;
}

function homeAsk() {
  const box = document.getElementById('hmAsk');
  const q = (box ? box.value : '').trim();
  // ล้างช่องก่อนเปลี่ยนจอ — go() เรียก renderAll() ซึ่งวาดหน้าแรกใหม่ทั้งก้อน
  // ถ้าไม่ล้าง ตัวคืนค่าใน renderMenu จะเอาคำถามที่ส่งไปแล้วกลับมาแปะไว้ในช่องอีกรอบ
  if (box) box.value = '';
  go('scr-ai');
  if (q) { aiAsk(q); return; }
  const t = document.getElementById('aiInput');
  if (t) t.focus();
}

// ---------- ยังไม่มีงาน ----------
// จอว่างมีสองแบบ และต้องพูดคนละอย่าง
//   เคลียร์หมดแล้ว = ข่าวดี ต้องฉลองสั้น ๆ แล้วปล่อยเขาไป
//   ยังไม่เคยมีงาน  = ยังไม่รู้ว่าแอปนี้ทำอะไรได้ ต้องชี้ทางแรกให้ชัด (ถ่ายรูปคือทางที่เร็วที่สุด)
// hasRem = ยังมีกิจกรรม/เตือนความจำรออยู่ข้างล่าง — ถ้าไม่บอกให้ตรง จอจะเขียนว่า
// "ไม่มีงานค้าง" แล้วมีลิสต์ของที่ค้างอยู่ต่อท้ายทันที ซึ่งอ่านออกมาว่าแอปนับของตัวเองไม่ถูก
function todayEmpty(now, hasRem) {
  const doneToday = liveTasks().filter(t => t.done && t.doneAt &&
    new Date(t.doneAt).toDateString() === now.toDateString()).length;
  const everHad = liveTasks().length > 0;
  return `<section class="td-clear">
    <span class="tc-ic">${icon('check-circle')}</span>
    <b>${doneToday ? 'เคลียร์หมดแล้ววันนี้'
      : hasRem ? 'ไม่มีงานที่ต้องนั่งทำ' : everHad ? 'ไม่มีงานค้าง' : 'วันนี้ยังไม่มีงาน'}</b>
    <p>${doneToday ? 'ทำเสร็จไป ' + doneToday + ' งาน — วันนี้พักได้เต็มที่'
      : hasRem ? 'เหลือแต่ของที่ถึงเวลาแล้วต้องไป — อยู่ข้างล่างนี้'
      : everHad ? 'ครูสั่งอะไรมาใหม่ก็โยนเข้ามาได้เลย'
      : 'ถ่ายรูปใบงานที่ครูสั่ง แล้วจะได้แผนแรกภายในไม่กี่วินาที'}</p>
    <button class="tc-cta" onclick="openAddSheet()">${icon('camera')}${
      everHad ? 'เพิ่มงาน' : 'สแกนใบงานแรก'}</button>
  </section>`;
}

// มีงานค้างอยู่ แต่วันนี้ไม่เหลือเวลาให้จัดแล้ว — ต้องบอกว่าติดตรงไหน ไม่ใช่โชว์รางเวลาเปล่า
// "AI จัดแผนไม่ได้" โดยไม่บอกเหตุผล คือคำตอบที่ทำให้ผู้ใช้เดาว่าแอปพัง
function noTimeLeft(sp, now) {
  const win = sp.plan.windows;
  const nf = typeof nextFreeSlotAfterToday === 'function' ? nextFreeSlotAfterToday(now) : null;
  return `<section class="td-note">
    <b>${icon('clock')}วันนี้หมดเวลาแล้ว</b>
    <p>เลย ${esc(ctxPrefs().noWorkAfter)} น. ซึ่งเป็นเวลาที่คุณตั้งไว้ว่าจะหยุดทำงาน${
      nf ? ` — ว่างอีกทีตอน ${esc(nf.fromHm)} ${nf.dayOffset === 1 ? 'พรุ่งนี้' : 'อีก ' + nf.dayOffset + ' วัน'}` : ''}</p>
    <button class="tn-ask" onclick="go('scr-context')">${icon('clock')}อยากยืดเวลาทำงานคืนนี้? แก้ได้ที่ตารางชีวิต${icon('chevron')}</button>
  </section>`;
}

// ---------- แผนต้องเดินตามเวลาจริง ----------
// บั๊กที่ทำให้ทั้งแอปเสียความน่าเชื่อถือ: เปิดแอปทิ้งไว้ตอนหกโมงเย็น กลับมาดูสองทุ่มครึ่ง
// แล้วหน้าแรกยังบอกให้ "เริ่มตอน 18:45" ซึ่งผ่านไปแล้วเกือบสองชั่วโมง
//
// ตัวจัดแผนไม่เคยผิด — มันคิดจาก now ใหม่ทุกครั้งที่ถูกเรียก และ freeSlots() ตัดเวลาที่ผ่านไปแล้วทิ้งเสมอ
// สิ่งที่ไม่มีคือคนเรียกมันซ้ำ · tickClock เดินทุก 30 วินาทีแต่แตะแค่ตัวเลขนาฬิกากับหมุดบนเส้นเวลา
// หน้าแรกจึงค้างอยู่ที่ภาพตอนที่วาดครั้งแรกจนกว่าผู้ใช้จะไปกดจออื่นแล้วกดกลับมา
//
// ตารางที่บอกเวลาที่ผ่านไปแล้ว แย่กว่าไม่มีตาราง เพราะมันสอนให้ผู้ใช้เลิกเชื่อทุกตัวเลขในแอป
let lastTickMin = -1;

function minuteTick() {
  if (document.hidden) return;
  const m = Math.floor(Date.now() / 60000);
  if (m === lastTickMin) return;
  lastTickMin = m;
  // โหมดโฟกัสมีนาฬิกาของตัวเองและกำลังถูกใช้อยู่ — วาดทับใต้นิ้วผู้ใช้ไม่ได้
  if (focusId) return;
  // แผ่นเพิ่มงานเปิดค้างอยู่ = ผู้ใช้กำลังจะกดอะไรสักอย่าง อย่าเพิ่งขยับพื้นหลัง
  const sheet = document.getElementById('addSheet');
  if (sheet && !sheet.hidden) return;
  // กำลังพิมพ์คำถามค้างอยู่ — renderMenu คืนค่าในช่องให้ก็จริง แต่การ focus() ใหม่บนมือถือ
  // ทำให้คีย์บอร์ดยุบแล้วเด้งขึ้นใหม่ · หน้าจอที่กระตุกเองตอนพิมพ์แย่กว่านาฬิกาช้าไปหนึ่งนาที
  const ask = document.getElementById('hmAsk');
  if (ask && document.activeElement === ask) return;
  // วาดใหม่เฉพาะจอที่พูดเรื่องเวลา — จออื่นวาดใหม่ก็เปลืองเปล่า
  if (!['scr-menu', 'scr-plan', 'scr-timeline'].includes(curScreen)) return;
  _planCache = null;
  renderMenu(); renderPlan(); renderTimeline();
}

// ลำดับบนจอเป็นเส้นเดียวจากบนลงล่าง ไม่มีทางแยก:
//   ทักทาย + เวลาที่มีจริง → โฟกัสหนึ่งใบ + ทำไมใบนี้ → ถัดไปคืออะไร
//   → เตือนความจำ → แผนทั้งวัน (พับ) → ถามน้องไซ
function renderMenu() {
  const body = document.getElementById('menuBody');
  if (!body) return;
  const now = new Date();
  const sp = focusPlan(now);   // การ์ดโฟกัสต้องเป็นงานที่ลงมือทำได้จริง — ดู focusPlan()
  const split = homeSplit(sp, now);

  // สิ่งที่พิมพ์ค้างไว้ในช่องถามน้องไซต้องรอดจากการวาดใหม่
  // renderMenu ถูกเรียกทุกนาที (minuteTick) และทุกครั้งที่ข้อมูลเปลี่ยน (ติ๊กเสร็จ · ซิงก์ cloud)
  // ถ้าไม่คืนค่ากลับ ประโยคที่พิมพ์ค้างจะหายไปกลางคันโดยที่ผู้ใช้ไม่ได้แตะอะไรเลย
  const askBox = document.getElementById('hmAsk');
  const askKeep = askBox ? askBox.value : '';
  const askFocus = !!askBox && document.activeElement === askBox;

  // มีงานแต่ไม่มีเวลา ≠ ไม่มีงาน — สองอย่างนี้ต้องพูดคนละแบบ
  const outOfTime = sp.now && !sp.plan.slots.length;
  body.innerHTML = todayHead(sp, now)
    + (sp.now ? nowCard(sp, now) + upNext(sp, split, now)
                + remindersBlock(split.reminders, now)
                + (outOfTime ? noTimeLeft(sp, now) : planStrip(sp, now))
              : todayEmpty(now, split.reminders.length > 0) + remindersBlock(split.reminders, now))
    + askBar()
    + ctxNudge(sp.plan.windows);

  if (askKeep || askFocus) {
    const b2 = document.getElementById('hmAsk');
    if (b2) {
      b2.value = askKeep;
      if (askFocus) { b2.focus(); b2.setSelectionRange(askKeep.length, askKeep.length); }
    }
  }

  // จำแผนที่เพิ่งแสดงไป เพื่อให้รอบหน้ารู้ว่าผู้ใช้พลาดช่วงไหน
  // ต้องบันทึกหลังวาด ไม่ใช่ก่อน — ไม่งั้นแผนที่ยังไม่มีใครเห็นจะถูกนับว่า "เคยบอกไปแล้ว"
  if (sp.plan.slots.length) commitPlan(sp.plan, state, now);
}

// ยังไม่รู้จักตารางเรียนของเขา = ทุกตัวเลขบนจอนี้ตั้งอยู่บนการเดา ต้องบอกให้รู้ตัว
// แต่บอกด้วยบรรทัดเดียวท้ายจอ ไม่ใช่การ์ดเต็มใบที่แย่งที่กับคำตอบ
function ctxNudge(win) {
  if (win.mode !== 'default') return '';
  return `<button class="td-nudge" onclick="go('scr-context')">
    ${icon('clock')}เวลาว่างข้างบนมาจากการเดา — บอกตารางเรียนสักครั้งให้แผนตรงกับชีวิตจริง${icon('chevron')}
  </button>`;
}

// ---------- ปุ่ม + : ทางเข้าที่เร็วที่สุดของการเพิ่มงาน ----------
// เพิ่มงานคือสิ่งที่ทำบ่อยที่สุดรองจากการดูว่าต้องทำอะไร มันจึงต้องอยู่ห่างจากนิ้วหนึ่งครั้งกด
// แต่ต้องไม่แย่งสายตาจากคำตอบ — จึงเป็นปุ่มบนแถบล่าง ไม่ใช่การ์ดบนหน้าแรก
const ADD_ACTIONS = [
  ['camera', 'ถ่ายรูปใบงาน', 'AI อ่านให้ทั้งใบ', "go('scr-scan');setTimeout(()=>document.getElementById('fileInput')&&document.getElementById('fileInput').click(),150)"],
  ['mic', 'พูดเพิ่มงาน', 'เร็วที่สุด — 5 วินาที', "go('scr-scan');setTimeout(()=>typeof startVoice==='function'&&startVoice(),150)"],
  ['type', 'แปะข้อความจากครู', 'วางแล้วให้ AI แกะ', "go('scr-scan')"],
  ['pencil', 'พิมพ์เองทีละช่อง', 'งานที่ไม่มีข้อความต้นทาง', "openForm(null)"],
  ['book', 'เพิ่มวันสอบ', 'แล้วผมแบ่งรอบอ่านให้', "openForm(null);setTimeout(()=>typeof setFormType==='function'&&setFormType('exam'),60)"],
];

// เมนู + มีสองหน้า: หน้าหลัก กับ หน้าตัวเชื่อม
// สลับในแผ่นเดิม ไม่ปิดแล้วเปิดใหม่ — ปิดแล้วเปิดใหม่ผู้ใช้จะรู้สึกว่าโดนพาไปที่อื่น
// ทั้งที่ยังอยู่ในเมนูเดิม แล้วจะไม่กล้ากดกลับ
let addSheetView = 'root';

function addSheetHTML() {
  if (addSheetView === 'connectors') {
    const c = typeof connectorCount === 'function' ? connectorCount() : { on: 0, all: 0 };
    return `<div class="as-grip"></div>
      <div class="as-h as-back" onclick="openAddSheet('root')">
        <span class="as-bk">${icon('chevron')}</span>ตัวเชื่อม
        <span class="as-cnt">เปิดอยู่ ${c.on}/${c.all}</span>
      </div>
      <p class="as-sub">เปิดไว้แล้วงานไหลเข้าเอง ไม่ต้องพิมพ์ ไม่ต้องกดอะไรอีก</p>
      ${typeof connectorMenuRows === 'function' ? connectorMenuRows() : ''}
      <button class="as-row as-more" onclick="closeAddSheet();go('scr-sources')">
        <span class="as-ic dim">${icon('cog')}</span>
        <span class="as-tx"><b>ดูตัวเชื่อมทั้งหมด</b><span>Classroom · ปฏิทิน · โน้ต · วิธีเชื่อม</span></span>
        <span class="as-go">${icon('chevron')}</span>
      </button>`;
  }
  const c = typeof connectorCount === 'function' ? connectorCount() : null;
  return `<div class="as-grip"></div>
    <div class="as-h">เพิ่มอะไร?</div>
    ${ADD_ACTIONS.map(a => `<button class="as-row" onclick="closeAddSheet();${a[3]}">
      <span class="as-ic">${icon(a[0])}</span>
      <span class="as-tx"><b>${esc(a[1])}</b><span>${esc(a[2])}</span></span>
      <span class="as-go">${icon('chevron')}</span>
    </button>`).join('')}
    <button class="as-row as-conn" onclick="openAddSheet('connectors')">
      <span class="as-ic">${icon('share')}</span>
      <span class="as-tx"><b>ตัวเชื่อม</b><span>ให้แอปอื่นส่งงานเข้ามาเอง — ไม่ต้องเพิ่มทีละอัน</span></span>
      ${c && c.all ? `<span class="as-cnt sm">${c.on}/${c.all}</span>` : ''}
      <span class="as-go">${icon('chevron')}</span>
    </button>`;
}

// วาดใหม่โดยไม่แตะแอนิเมชัน — ใช้ตอนกดสวิตช์ในเมนู ให้สวิตช์ขยับทันทีโดยแผ่นไม่กระพริบ
function refreshAddSheet() {
  const el = document.getElementById('addSheet');
  if (!el || el.hidden) return;
  const card = el.querySelector('.as-card');
  if (card) card.innerHTML = addSheetHTML();
}

function openAddSheet(view) {
  const el = document.getElementById('addSheet');
  if (!el) { go('scr-scan'); return; }
  addSheetView = view === 'connectors' ? 'connectors' : 'root';

  // เปิดอยู่แล้ว = แค่สลับหน้าในแผ่นเดิม ห้ามวาดใหม่ทั้งก้อน ไม่งั้นแผ่นเลื่อนลงแล้วขึ้นใหม่
  if (!el.hidden) {
    refreshAddSheet();
    haptic('tap');
    return;
  }

  el.innerHTML = `<div class="as-scrim" onclick="closeAddSheet()"></div>
    <div class="as-card" role="dialog" aria-label="เพิ่มงานใหม่">${addSheetHTML()}</div>`;
  el.hidden = false;
  // ใช้ setTimeout ไม่ใช่ requestAnimationFrame
  //
  // rAF ไม่ทำงานเลยถ้าหน้าไม่ได้ถูกวาดจริง (แท็บพื้นหลัง · เบราว์เซอร์ในเครื่องมือทดสอบ ·
  // เครื่องที่ประหยัดแบตแล้วหยุดวาด) แล้วคลาส on จะไม่เคยถูกใส่ —
  // แผ่นค้างอยู่ใต้จอแบบถาวร กดปุ่ม + แล้วไม่มีอะไรขึ้น โดยไม่มี error อะไรเลย
  // ตัวจับเวลาทำงานเสมอ · และถ้า transition ไม่เล่น อย่างแย่ที่สุดคือแผ่นเด้งขึ้นมาทันที
  // ซึ่งยังใช้งานได้ ต่างจากแผ่นที่ไม่โผล่เลย
  setTimeout(() => el.classList.add('on'), 16);
  haptic('tap');
}

function closeAddSheet() {
  const el = document.getElementById('addSheet');
  if (!el) return;
  el.classList.remove('on');
  addSheetView = 'root';   // เปิดครั้งหน้าต้องเริ่มที่หน้าหลักเสมอ ไม่ใช่ค้างอยู่หน้าตัวเชื่อม
  setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, 200);
}

// ---------- ตารางงาน (เดิมคือหน้าแรก) ----------
// โครง: หัวข้อ → การ์ดสรุปของ AI → งาน 3 อันดับแรก → ทางไปงานที่เหลือ
// การ์ดสรุปคือที่เดียวที่ AI "พูด" ยาว ๆ ได้ การ์ดงานจึงเหลือแต่ข้อมูลดิบล้วน
function briefCard(pending, now) {
  const top = pending[0];
  const raw = aiGreeting(pending, state.settings, now);
  // เน้นสามอย่างที่สายตาต้องจับให้ได้ก่อน: ทำอะไร · เริ่มกี่โมง · กี่ชั่วโมง
  let msg = esc(raw).replace(/~([\d.]+) ชม\./g, '<b>~$1 ชม.</b>')
    .replace(/(\d{2}:\d{2}–\d{2}:\d{2})/g, '<b>$1</b>');
  // ชื่อที่ AI ใช้เรียกงานอาจเป็นชื่อวิชาหรือชื่องาน แล้วแต่ว่าใบนั้นมีวิชาไหม
  const label = typeof taskLabel === 'function' && top ? taskLabel(top) : (top && top.subject);
  if (label) msg = msg.replace(esc(label), '<b>' + esc(label) + '</b>');
  return `<div class="brief">
    <div class="brief-head"><span class="brief-mark">${icon('sparkles')}</span><b>STUDENTOS AI</b></div>
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
      <span class="rank ${tone}${n === 1 ? ' first' : ''}">${n}</span>
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

  // "เวลาว่างวันนี้" ต้องเป็นเวลาที่ยังเหลือจริงนับจากนาทีนี้ ไม่ใช่ตัวเลขที่กรอกไว้ตอนสมัคร
  // ตัวเลขที่ไม่ลดลงตามเวลาที่ผ่านไปคือตัวเลขที่ผู้ใช้เลิกอ่านภายในสองวัน
  const win = dayWindows(state.settings, now);
  const leftH = Math.round(win.budgetMin / 60 * 10) / 10;
  const freeTx = win.mode === 'none' ? 'วันนี้หมดเวลาแล้ว'
    : win.mode === 'late' ? `เหลือก่อนนอน ~${leftH} ชม.`
    : `ว่างอีก ~${leftH} ชม.`;

  const head = `<div class="page-head">
    <div class="eyebrow mono">${esc(fmtThaiDate(now))}</div>
    <h1 class="page-title">ตารางงาน</h1>
    <p class="page-sub">งานค้าง <b>${pending.length}</b> · เสร็จแล้ว ${doneCount}
      · ${esc(freeTx)}</p>
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
  // ปุ่มติ๊กเสร็จยังกดได้ตามปกติ (หน้าแรกใช้ .rc-check · ตารางงานใช้ .tk-tick)
  if (!card || e.target.closest('.rc-check, .tk-tick')) return;
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
    toggleDone(d.id, d.card.querySelector('.rc-check, .tk-tick')); // มีฉลอง + toast + วาดใหม่ให้แล้ว
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
  if (!window.PointerEvent) return;
  // เกาะที่กล่องนอกของทั้งสองจอ ไม่ใช่ที่การ์ด เพราะทั้งคู่เขียนทับ innerHTML ทุกครั้งที่วาดใหม่
  for (const id of ['homeBody', 'taskList']) {
    const root = document.getElementById(id);
    if (!root) continue;
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
}

// เลื่อนกำหนดส่งไปพรุ่งนี้ (คงเวลาเดิมของวัน)
// งานที่กำหนดส่งเลยพรุ่งนี้ไปแล้ว การตั้งเป็น "พรุ่งนี้" จะกลายเป็นเร่งให้เร็วขึ้น
// จึงเลื่อนออกไปอีก 1 วันจากกำหนดเดิมแทน — ปัดซ้ายจึงแปลว่า "ขอเวลาอีกวัน" เสมอ
// "เลื่อนไปพรุ่งนี้" = เลื่อนแผนของฉัน ไม่ใช่เลื่อนเส้นตายของครู
//
// ของเดิมเขียนทับ t.due ตรง ๆ ซึ่งพังสองชั้นพร้อมกัน:
//   1. due คือความจริงข้อเดียวที่เอนจินทั้งตัวยืนอยู่บนนั้น ปัดทีเดียวก็หายไป
//   2. หน้า "ฉัน" ยังรายงาน "ส่งทันกำหนด 100%" ต่อ เพราะเส้นตายถูกขยับตามไปแล้ว
//      แอปที่ปลอบใจตัวเองแบบนี้คือแอปที่พาไปส่งงานสาย
//
// ตอนนี้เลื่อนได้เฉพาะ plannedFor ซึ่งเป็นของผู้ใช้ · due ยังเป็นของครูเหมือนเดิม
// และงานที่ "วันนี้เป็นโอกาสสุดท้าย" จะถูกดึงกลับเข้าแผนเองใน planner.js
// เพราะการยอมให้เลื่อนงานที่เลื่อนไม่ได้ คือการช่วยให้พลาดส่งอย่างสุภาพ
function snoozeToTomorrow(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const prev = { plannedFor: t.plannedFor, snoozedAt: t.snoozedAt, snoozeCount: t.snoozeCount };
  const tmr = new Date();
  tmr.setDate(tmr.getDate() + 1);
  tmr.setHours(0, 0, 0, 0);
  t.plannedFor = tmr.toISOString();
  t.snoozedAt = new Date().toISOString();
  t.snoozeCount = (t.snoozeCount || 0) + 1;
  save();
  haptic('snooze');

  const locked = typeof isLastChanceToday === 'function' && isLastChanceToday(t, new Date());
  setTimeout(() => {
    renderAll();
    showToast({
      title: locked ? 'เลื่อนไม่ได้ — วันนี้เป็นวันสุดท้าย ⚠' : 'ย้ายไปแผนพรุ่งนี้แล้ว 🕓',
      body: (t.subject && t.subject !== 'อื่น ๆ' ? t.subject + ' — ' : '') +
        (locked
          ? 'ถ้าไม่ทำวันนี้จะไม่มีเวลาว่างพอก่อน' + fmtDue(t.due, new Date(), t) + ' อีกแล้ว'
          : 'กำหนดส่งยังเป็น ' + fmtDue(t.due, new Date(), t) + ' เหมือนเดิม'),
      undo: () => { Object.assign(t, prev); save(); renderAll(); },
    });
  }, 200);
}

// "ยังไม่ไหวตอนนี้" — เขี่ยงานนี้ออกจากการ์ด NOW สามชั่วโมง แล้วเลื่อนอันดับสองขึ้นมาแทน
// ไม่ใช่การเลื่อนเส้นตาย ไม่ใช่การลบ และไม่ต้องอธิบายเหตุผลกับใคร
// ปุ่มนี้มีไว้เพื่อให้คำตอบของแอปยัง "ทำตามได้" ในวันที่คำตอบที่ถูกที่สุดทำไม่ไหวจริง ๆ
// ยกเลิกการพัก — ทางกลับต้องมีเสมอ ไม่งั้น "ยังไม่ไหวตอนนี้" กลายเป็นปุ่มที่กดแล้วย้อนไม่ได้
// จนกว่าจะครบสามชั่วโมง ซึ่งไม่ใช่สิ่งที่คนเข้าใจตอนกด
function unpause(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.notNowAt = null;
  t.plannedFor = null;
  save();
  renderAll();
  haptic('tap');
}

function notNow(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const prev = { notNowAt: t.notNowAt };
  t.notNowAt = new Date().toISOString();
  save();
  haptic('snooze');
  renderAll();
  const sp = todayPlan(new Date());
  showToast({
    title: 'พักงานนี้ไว้ก่อน 3 ชม.',
    body: sp.now ? 'เลื่อน "' + taskTitleText(sp.now.task) + '" ขึ้นมาแทนแล้ว'
      : 'กำหนดส่งยังเป็นเหมือนเดิม — เจอกันอีกทีตอนเย็น',
    undo: () => { Object.assign(t, prev); save(); renderAll(); },
  });
}

function dueTone(t, now) {
  if (t.done) return 'ok';
  if (!t.due) return '';
  const h = (new Date(t.due) - now) / 3.6e6;
  if (h <= 12) return 'hot';      // เลยกำหนด หรือเหลือไม่ถึงครึ่งวัน
  if (h <= 48) return 'warm';     // ภายในสองวัน
  return '';
}

function tkChip(text, tone) {
  return `<span class="tk-chip${tone ? ' ' + tone : ''}">${esc(text)}</span>`;
}

// การ์ดงาน — ลำดับการอ่านจากบนลงล่างทางเดียว ไม่มีเลขลอยชิดขวาให้ตาวิ่งไปมา
//   วิชา (ป้ายเล็ก) → สิ่งที่ต้องทำ (ตัวใหญ่สุด) → สถานะ + เวลาที่ใช้
// ของเดิมเอาชื่อวิชาเป็นตัวใหญ่สุด ทั้งที่นักเรียนรู้อยู่แล้วว่าฟิสิกส์คืออะไร
// สิ่งที่เขาไม่รู้คือ "ต้องทำอะไร" ซึ่งเคยถูกลดชั้นเป็นตัวเทาเล็ก
function taskCard(t, now, focus) {
  const subj = (t.subject || '').trim();
  const tone = dueTone(t, now);
  const ti = TASK_TYPES[taskType(t)];

  if (t.done) {
    return `<div class="tk tk-done" onclick="openForm('${t.id}')">
      <button class="tk-tick on" onclick="event.stopPropagation();toggleDone('${t.id}',this)"
        aria-label="เอาออกจากที่เสร็จแล้ว">${icon('check')}</button>
      <div class="tk-bd">
        ${subj && subj !== 'อื่น ๆ' ? `<div class="tk-sub">${esc(subj)}</div>` : ''}
        <div class="tk-ttl">${esc(t.detail || '')}</div>
      </div>
      ${icon('chevron', 'tk-go')}
    </div>`;
  }

  const chips = [
    t.due ? tkChip(fmtDue(t.due, now, t), tone) : tkChip('ยังไม่ระบุกำหนด', ''),
    t.scorePct != null ? tkChip('คะแนน ' + t.scorePct + '%', '') : '',
    snoozeBadge(t) ? tkChip('เลื่อนมา ' + (t.snoozeCount || 1) + ' ครั้ง', '') : '',
  ].filter(Boolean).join('');

  // ปัดขวา = เสร็จ · ปัดซ้าย = เลื่อนไปพรุ่งนี้ — โครงเดียวกับการ์ดหน้าแรกทุกประการ
  // สองท่านี้เคยมีเฉพาะหน้าแรก แต่แท็บที่คนเปิดมาจัดการงานจริง ๆ คือแท็บนี้
  // พอมันหายไปเฉพาะที่นี่ ผู้ใช้จึงรายงานว่า "ปุ่มเลื่อน/ติ๊กเสร็จหายไป" — มันไม่เคยมาถึงตรงนี้ต่างหาก
  return `<div class="swipe">
    <div class="sw-act done" aria-hidden="true"><span class="sw-ic">${icon('check')}</span>ทำเสร็จแล้ว</div>
    <div class="sw-act snooze" aria-hidden="true">เลื่อนไปพรุ่งนี้<span class="sw-ic">${icon('clock')}</span></div>
    <div class="tk sw-card${focus ? ' tk-focus' : ''}" data-id="${t.id}" onclick="openForm('${t.id}')">
      <button class="tk-tick" onclick="event.stopPropagation();toggleDone('${t.id}',this)"
        aria-label="ทำเสร็จ">${icon('check')}</button>
      ${subj && subj !== 'อื่น ๆ' ? `<div class="tk-sub">${esc(subj)}</div>` : ''}
      <div class="tk-ttl">${esc(t.detail || '')}</div>
      <div class="tk-meta">${chips}<span class="tk-sp"></span>
        ${ti.schedulable ? `<span class="tk-min">~${remainingMin(t)} นาที</span>` : ''}</div>
    </div>
  </div>`;
}

// ---------- หน้างาน ----------
// 3 แท็บเท่านั้น: ค้างอยู่ · เสร็จแล้ว · ทั้งหมด
// ของที่ลบไม่หายทันที แต่ไปนอนในถังขยะที่ซ่อนไว้ท้ายหน้า กดเปิดเองได้
let taskFilter = 'pending'; // pending | done | all | bin
let taskDay = null;         // null = ทุกวัน · 'YYYY-M-D' = เฉพาะวันนั้น
function setFilter(f) {
  taskFilter = f;
  renderTasks();
  const s = document.getElementById('scr-tasks');
  if (s) s.scrollTop = 0;
}
function setTaskDay(k) {
  taskDay = (taskDay === k) ? null : k;   // กดวันเดิมซ้ำ = เลิกกรอง
  renderTasks();
}

// ---------- บริบทที่น้องไซได้เห็น ----------
// ประกอบเป็นข้อความล้วนแทน JSON เพราะโมเดลอ่านรายการที่มีหัวข้อไทยได้ตรงกว่า
// และเวลาต้องไปนั่งดูว่า "ทำไมมันตอบอย่างนี้" เราอ่าน log ออกด้วยตาเปล่าได้เลย
//
// **ข้อมูลที่ตั้งใจไม่ส่ง แม้ผู้ใช้จะสั่งว่า "ให้รู้ทุกอย่าง":**
//   รายชื่อเพื่อนกับรหัสเพื่อน — นั่นคือข้อมูลของนักเรียนคนอื่นที่ไม่ได้อยู่ในห้องสนทนานี้
//   เจ้าของแอปยินยอมให้ส่งข้อมูลของตัวเองได้ แต่ยินยอมแทนเพื่อนไม่ได้
//   รูปวิดเจ็ตก็ไม่ส่ง — เป็นไฟล์ภาพ ไม่ได้ช่วยให้ตอบเรื่องการบ้านได้ดีขึ้นเลย
function aiContext(now = new Date()) {
  const L = [];
  const p = typeof ctxPrefs === 'function' ? ctxPrefs() : {};
  const pend = sortByPriority(pendingTasks(), now);
  const live = liveTasks();

  L.push('## ตัวผู้ใช้');
  L.push('- ชื่อที่ใช้เรียก: ' + (who() || 'ยังไม่ได้บอกชื่อ'));
  L.push('- วันนี้: ' + fmtThaiDate(now) + ' เวลา ' + fmtClock(now));

  L.push('## เวลาประจำวัน');
  L.push('- ตื่น ' + (p.wake || '—') + ' · เข้านอน ' + (p.sleep || '—')
    + ' · ไม่วางงานหลัง ' + (p.noWorkAfter || '—'));
  L.push('- ทำติดกันได้ ' + (p.maxRunMin || '—') + ' นาที แล้วพัก ' + (p.breakMin || '—') + ' นาที');
  if (typeof freeMinutes === 'function') {
    L.push('- เวลาว่างที่เหลือวันนี้: ' + humanMin(freeMinutes(now, now)));
  }

  const cls = typeof ctxClasses === 'function' ? ctxClasses() : [];
  L.push('## ตารางเรียน (' + cls.length + ' คาบ)');
  if (!cls.length) L.push('- ยังไม่ได้บอกตารางเรียน — เวลาว่างข้างบนเป็นค่าเดา ไม่ใช่ของจริง');
  for (const c of cls) {
    const wd = c.weekday == null ? 'ทุกวัน'
      : (Array.isArray(c.weekday) ? c.weekday : [c.weekday]).map(d => WEEKDAY_SHORT[d]).join(',');
    L.push('- ' + wd + ' ' + c.start + '–' + c.end + ' ' + (c.subject || 'เรียน'));
  }

  const rt = typeof ctxRoutines === 'function' ? ctxRoutines() : [];
  if (rt.length) {
    L.push('## กิจวัตร (' + rt.length + ')');
    for (const r of rt) {
      const wd = r.weekday == null ? 'ทุกวัน'
        : (Array.isArray(r.weekday) ? r.weekday : [r.weekday]).map(d => WEEKDAY_SHORT[d]).join(',');
      L.push('- ' + wd + ' ' + r.start + '–' + r.end + ' ' + (r.subject || r.title || 'กิจวัตร'));
    }
  }

  L.push('## งานที่ยังไม่เสร็จ (' + pend.length + ' ใบ · เรียงตามที่ควรทำก่อน)');
  if (!pend.length) L.push('- ไม่มีงานค้าง');
  pend.forEach((t, i) => {
    const info = priorityInfo(t, now);
    const bits = [
      (i + 1) + '. ' + taskTitleText(t),
      'กำหนด: ' + (t.due ? fmtDue(t.due, now, t).replace(/^⚠\s*/, '') : 'ยังไม่ระบุ'),
      'ประเมิน ' + (t.estMin || '—') + ' นาที',
    ];
    if (t.scorePct != null) bits.push('คะแนนเก็บ ' + t.scorePct + '%');
    if (t.teacher) bits.push('ครู ' + t.teacher);
    if (t.progress) bits.push('ทำไปแล้ว ' + t.progress + '%');
    const worked = typeof workedMin === 'function' ? workedMin(t.id) : 0;
    if (worked) bits.push('จับเวลาไปแล้ว ' + worked + ' นาที');
    bits.push('ระดับที่ระบบจัด: ' + priorityLabel(info.stars));
    if (t.snoozeCount) bits.push('เลื่อนมาแล้ว ' + t.snoozeCount + ' ครั้ง');
    L.push('- ' + bits.join(' · '));
  });

  // งานที่เสร็จแล้วมีประโยชน์สองอย่าง: รู้ว่าเขาถนัดวิชาไหน และรู้ว่าเขาประเมินเวลาแม่นแค่ไหน
  const doneRecent = live.filter(t => t.done && t.doneAt &&
    (now - new Date(t.doneAt)) < 14 * 8.64e7);
  L.push('## งานที่ทำเสร็จใน 14 วัน (' + doneRecent.length + ' ใบ)');
  for (const t of doneRecent.slice(0, 20)) {
    const worked = typeof workedMin === 'function' ? workedMin(t.id) : 0;
    L.push('- ' + taskTitleText(t)
      + (t.estMin ? ' · ประเมิน ' + t.estMin + ' นาที' : '')
      + (worked ? ' · ใช้จริง ' + worked + ' นาที' : ''));
  }

  const ss = typeof sessions === 'function' ? sessions() : [];
  const week = ss.filter(s => (now - new Date(s.end || s.start)) < 7 * 8.64e7);
  L.push('## สถิติการทำงาน');
  L.push('- 7 วันนี้: จับเวลา ' + week.length + ' รอบ รวม '
    + humanMin(week.reduce((a, s) => a + (s.min || 0), 0)));

  const mk = typeof marks === 'function' ? marks() : [];
  const future = mk.filter(m => m.date >= calKey(now));
  if (future.length) {
    L.push('## หมุดที่ผู้ใช้ปักไว้ในปฏิทิน');
    for (const m of future.slice(0, 20)) {
      L.push('- ' + m.date + ' ' + m.title + (m.big ? ' (ทำเครื่องหมายว่าสำคัญมาก)' : ''));
    }
  }

  const note = typeof widgetNote === 'function' ? widgetNote() : '';
  if (note.trim()) {
    L.push('## โน้ตที่ผู้ใช้จดไว้เอง');
    L.push('- ' + note.trim().replace(/\n/g, ' / '));
  }

  return L.join('\n');
}

// ---------- เรียกน้องไซ ----------
// คืน { ok, answer } หรือ { ok: false, message } — ข้อความเป็นไทยพร้อมโชว์
// ทุก error path ต้องได้ message ที่ผู้ใช้อ่านรู้เรื่อง เพราะจอนี้ไม่มีทางอื่นให้เขาเดาเอง
async function askSai(question, history) {
  if (!sb) return { ok: false, message: 'ยังต่อเซิร์ฟเวอร์ไม่ได้ — เช็คอินเทอร์เน็ตแล้วลองใหม่' };
  try {
    const { data, error } = await withTimeout(
      sb.functions.invoke('ask-sai', {
        body: { question, context: aiContext(), history: history || [] },
      }),
      45_000, 'ถามน้องไซ');

    // supabase-js คืน error สำหรับทุกสถานะที่ไม่ใช่ 2xx โดยเนื้อความจริงอยู่ใน context
    // ไม่แกะออกมา ผู้ใช้จะเห็นแค่ "Edge Function returned a non-2xx status code"
    let payload = data;
    if (error) {
      try { payload = await error.context.json(); } catch (_) { payload = null; }
    }
    if (!payload || payload.ok !== true) {
      return { ok: false, message: payload?.message || 'น้องไซตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง' };
    }
    return { ok: true, answer: String(payload.answer || '').trim() };
  } catch (e) {
    return { ok: false, message: (e && e.message) || 'ต่อไม่ติด ลองใหม่อีกครั้ง' };
  }
}

// ---------- เรียกน้องไซแบบไหลทีละคำ ----------
// ทำไมไม่ใช้ sb.functions.invoke: มันอ่าน response จนจบก่อนถึงจะคืนค่า
// ซึ่งลบข้อดีทั้งหมดของการสตรีมทิ้ง — ต้องใช้ fetch เองเพื่อแตะ body.getReader()
//
// เซิร์ฟเวอร์คืน NDJSON บรรทัดละหนึ่งเหตุการณ์: {"t":...} ชิ้นข้อความ ·
// {"done":true} จบ · {"error":...} พังกลางทาง (มาในสตรีมเพราะสถานะ HTTP ส่งไปแล้ว)
//
// onChunk ถูกเรียกทุกครั้งที่มีข้อความเพิ่ม — ฝั่งจอเอาไปต่อท้ายฟองแชทได้เลย
async function askSaiStream(question, history, onChunk) {
  if (!sb) return { ok: false, message: 'ยังต่อเซิร์ฟเวอร์ไม่ได้ — เช็คอินเทอร์เน็ตแล้วลองใหม่' };

  const cfg = window.SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.anonKey) return await askSai(question, history);

  // ผู้ใช้ที่ล็อกอินแล้วต้องส่ง JWT ของตัวเอง ไม่ใช่กุญแจสาธารณะเฉย ๆ
  // (verify_jwt เปิดอยู่ที่ฟังก์ชันนี้ — ดู supabase/config.toml)
  let token = cfg.anonKey;
  try {
    const { data } = await sb.auth.getSession();
    if (data?.session?.access_token) token = data.session.access_token;
  } catch (_) {}

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45_000);

  try {
    const res = await fetch(cfg.url + '/functions/v1/ask-sai', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': cfg.anonKey,
        'authorization': 'Bearer ' + token,
      },
      signal: ctl.signal,
      body: JSON.stringify({
        question, context: aiContext(), history: history || [], stream: true,
      }),
    });

    // ยังไม่เริ่มสตรีม = ยังเปลี่ยนไปใช้ทางเดิมได้ทัน · เซิร์ฟเวอร์รุ่นเก่าที่ยังไม่รู้จัก
    // stream:true จะตอบเป็น JSON ก้อนเดียวตามปกติ ซึ่งทางเดิมอ่านได้อยู่แล้ว
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok || !res.body || !ctype.includes('ndjson')) {
      clearTimeout(timer);
      return await askSai(question, history);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '', failed = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const ln of lines) {
        if (!ln.trim()) continue;
        let ev;
        try { ev = JSON.parse(ln); } catch (_) { continue; }
        if (ev.error) { failed = ev.error; continue; }
        if (typeof ev.t === 'string' && ev.t) {
          text += ev.t;
          if (onChunk) onChunk(text);
        }
      }
    }

    if (failed) return { ok: false, message: failed };
    if (!text.trim()) return { ok: false, message: 'น้องไซตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง' };
    return { ok: true, answer: text.trim() };
  } catch (e) {
    // ยกเลิกเพราะหมดเวลา กับเน็ตหลุด ผู้ใช้ทำอย่างเดียวกันคือลองใหม่ ข้อความจึงก้อนเดียวพอ
    return { ok: false, message: 'ต่อไม่ติด ลองใหม่อีกครั้ง' };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- ประวัติแชท ----------
// เก็บในเครื่องเหมือนทุกอย่างในแอปนี้ — คนที่ถามเรื่องเดิมต่อพรุ่งนี้ต้องไม่ต้องเล่าใหม่
// ตัดที่ 40 ข้อความ เพราะที่เก็บใน localStorage มีเพดาน และเกินนั้นก็ไม่มีใครเลื่อนขึ้นไปอ่าน
const AI_LOG_KEY = 'studentos.alt.aiLog';
const AI_LOG_CAP = 40;
let aiBusy = false;
// คำตอบที่กำลังไหลเข้ามาอยู่ — เก็บนอก log เพราะยังไม่จบ ยังไม่ควรถูกบันทึก
// ถ้าเน็ตหลุดกลางคัน ประวัติต้องไม่มีคำตอบครึ่งใบค้างไว้ให้อ่านวันหลัง
let aiPartial = '';

function aiLog() {
  try { return JSON.parse(localStorage.getItem(AI_LOG_KEY) || '[]'); } catch (_) { return []; }
}
function aiLogSave(list) {
  try { localStorage.setItem(AI_LOG_KEY, JSON.stringify(list.slice(-AI_LOG_CAP))); } catch (_) {}
}
function aiClear() {
  if (!confirm('ล้างประวัติการคุยกับน้องไซ?')) return;
  try { localStorage.removeItem(AI_LOG_KEY); } catch (_) {}
  renderAi();
}

function aiAsk(preset) {
  const box = document.getElementById('aiInput');
  const q = (preset || (box ? box.value : '') || '').trim();
  if (!q || aiBusy) return;
  const log = aiLog();
  log.push({ role: 'user', text: q });
  aiLogSave(log);
  if (box) box.value = '';
  aiBusy = true;
  renderAi();
  aiScrollDown();

  // ประวัติที่ส่งไปคือทุกอย่าง "ก่อน" คำถามล่าสุด — ฝั่งเซิร์ฟเวอร์ต่อคำถามเองเป็นข้อความสุดท้าย
  const hist = log.slice(0, -1).map(m => ({ role: m.role, text: m.text }));
  // วาดใหม่ทุกชิ้นที่ไหลเข้ามาจะกระตุกและทำให้คนกำลังอ่านเสียตำแหน่ง —
  // ต่อข้อความลงฟองที่มีอยู่แล้วโดยตรง แล้วค่อย renderAi() ทีเดียวตอนจบ
  aiPartial = '';
  askSaiStream(q, hist, (sofar) => {
    aiPartial = sofar;
    const bub = document.querySelector('.ai-bub.ai-live');
    if (!bub) { renderAi(); return; }
    // ชิ้นแรกมาถึง = เลิกเป็นจุดสามจุด กลายเป็นฟองข้อความจริง
    bub.classList.remove('ai-typing');
    bub.textContent = sofar;
    aiScrollDown();
  }).then(r => {
    const l2 = aiLog();
    l2.push(r.ok ? { role: 'model', text: r.answer }
      : { role: 'model', text: r.message, err: true });
    aiLogSave(l2);
    aiBusy = false;
    aiPartial = '';
    renderAi();
    aiScrollDown();
  });
}

// เปิดให้ดูว่าส่งอะไรไปจริง ๆ — ไม่ใช่คำอธิบายว่า "เราเก็บข้อมูลเท่าที่จำเป็น"
// แต่เป็นตัวข้อความก้อนเดียวกันกับที่ถูกส่ง คนอ่านแล้วตรวจได้เองว่าตรงกับที่บอกไหม
function aiShowContext() {
  alert('นี่คือข้อความที่ถูกส่งไปพร้อมคำถามของคุณ:\n\n' + aiContext());
}

// ---------- ปุ่มทางลัด 4 ปุ่ม ----------
// คำถามที่ส่งจริงยาวกว่าป้ายบนปุ่ม เพราะป้ายมีหน้าที่ให้กวาดตาเจอ ส่วนคำถามมีหน้าที่ให้ AI ตอบตรง
// ป้ายว่า "สรุปเนื้อหา" อ่านง่ายกว่า "ช่วยสรุปเนื้อหาที่ต้องอ่านสำหรับสอบให้หน่อย"
// แต่ถ้าส่งคำสั้นไปจริง ๆ จะได้คำตอบกว้าง ๆ ที่ไม่รู้ว่าพูดถึงวิชาไหน
const AI_QUICK = [
  ['sparkles', 'ช่วยวางแผนวันนี้', 'วันนี้ควรทำอะไรก่อน แล้วเรียงลำดับยังไงดี'],
  ['book',     'อธิบายการบ้าน',    'อธิบายการบ้านที่ค้างอยู่ให้เข้าใจหน่อย ผมยังไม่รู้จะเริ่มตรงไหน'],
  ['type',     'สรุปเนื้อหา',      'ช่วยสรุปเนื้อหาที่ต้องอ่านสำหรับสอบให้หน่อย'],
  ['clock',    'จัดเวลาให้ฉัน',    'ช่วยแบ่งเวลาอ่านหนังสือให้ทันสอบหน่อย'],
];

// ---------- ประโยคเปิดของน้องไซ ----------
// ไม่ได้เก็บลงประวัติ และไม่ได้ยิงไปเซิร์ฟเวอร์ — มันคือ "จอว่าง" ที่พูดได้
// ทุกคำมาจาก studyPlan() ก้อนเดียวกับหน้าแรก ห้ามเป็นข้อความสำเร็จรูปที่ทักทายอย่างเดียว
// เพราะประโยคแรกคือที่ที่ผู้ช่วยพิสูจน์ว่ามันรู้จักวันของเราจริงหรือแค่ทักทายเป็น
function aiOpener(sp) {
  const name = who();
  const hi = 'สวัสดี' + (name ? ' ' + name : '') + ' 👋';
  if (!sp.now) {
    return hi + ' ตอนนี้ไม่มีงานค้างที่ต้องเจียดเวลาให้ — ติดเรื่องเรียนอะไรถามได้เลย';
  }
  const t = sp.now.task;
  const why = topReason(sp.now.info);
  // ใช้ชื่องานล้วน ไม่ใช่ taskTitleText() ที่เอาชื่อวิชามาต่อหน้าให้ —
  // ในเครื่องหมายคำพูด "ภาษาอังกฤษ · Essay" อ่านเหมือนชื่องานมีจุดกลางอยู่จริง
  return hi + ' วันนี้ผมแนะนำให้เริ่ม "' + (t.detail || t.subject || 'งานที่ค้างอยู่') + '" ก่อน'
    + (why ? ' เพราะ' + why.replace(/^⚠\s*/, '') : '');
}

function renderAi() {
  const el = document.getElementById('aiBody');
  if (!el) return;
  const now = new Date();
  const log = aiLog();
  const sp = focusPlan(now);   // การ์ด "งานที่ควรทำก่อน" ต้องไม่หยิบกิจกรรมมาแปะปุ่มเริ่มทำ
  const pend = pendingTasks();
  const nCls = typeof ctxClasses === 'function' ? ctxClasses().length : 0;
  const subj = [...new Set(pend.map(t => t.subject).filter(s => s && s !== 'อื่น ๆ'))];
  const fresh = !log.length;   // ยังไม่เคยคุย = จอนี้ต้องอธิบายตัวเองให้ครบ

  // ---- 1 · หัวจอ ----
  const name = who();
  const head = `<header class="sai-head">
    ${saiFace('big')}
    <div class="sh-id">
      <h1 class="sh-name">น้องไซ<span class="sh-badge">AI</span></h1>
      <p class="sh-role">${fresh ? 'ผู้ช่วยของคุณ' : esc(
        (pend.length ? 'เห็นงาน ' + pend.length + ' ใบ' : 'ยังไม่เห็นงานค้าง')
        + (nCls ? ' · ตาราง ' + nCls + ' คาบ' : ''))}</p>
    </div>
    ${log.length ? `<button class="sh-wipe" onclick="aiClear()" aria-label="ล้างประวัติการคุย">${
      icon('trash')}</button>` : ''}
    <button class="sh-me" onclick="go('scr-profile')" aria-label="หน้าของฉัน">${
      name ? esc(name.trim().charAt(0).toUpperCase()) : icon('user')}</button>
  </header>`;

  // ---- 2 + 3 · ภาพรวมวันนี้ + งานที่ควรทำก่อน ----
  // สองอย่างนี้อยู่ในการ์ดใบเดียวกัน เพราะ "วันนี้มีเท่าไหร่" กับ "แล้วเริ่มใบไหน"
  // เป็นคำถามเดียวที่ถูกถามต่อกันเสมอ · แยกเป็นสองการ์ดคือบังคับให้สายตาเชื่อมเอง
  const planTasks = new Set(sp.plan.slots.filter(s => !s.break).map(s => s.task.id));
  const sum = sp.plan.slots.length
    ? planTasks.size + ' งาน · ' + humanMin(sp.plan.usedMin)
    : pend.length ? pend.length + ' งานค้าง · ยังไม่มีคิววันนี้' : 'ไม่มีงานค้าง';

  let taskBox;
  if (sp.now) {
    const t = sp.now.task, info = sp.now.info;
    const tone = t.due ? priorityTone(info.stars) : 'green';
    const prog = Math.max(0, Math.min(100, t.progress || 0));
    const left = typeof remainingMin === 'function' ? remainingMin(t) : (t.estMin || 30);
    const CIRC = 113.1; // 2πr เมื่อ r = 18 ในกรอบ 44×44
    taskBox = `<div class="sd-task">
      <div class="st-lb ${tone}">${icon(tone === 'red' ? 'flame' : 'target')}งานที่ควรทำก่อน</div>
      <div class="st-mid">
        <span class="st-tx">
          <b>${esc(t.detail || t.subject || 'งานนี้')}</b>
          <span>${esc(fmtDue(t.due, now, t).replace(/^⚠\s*/, ''))} · เหลือ ${left} นาที</span>
        </span>
        ${prog > 0 && prog < 100 ? `<span class="tp-ring">
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle class="tr-bg" cx="22" cy="22" r="18"></circle>
            <circle class="tr-fg" cx="22" cy="22" r="18"
              stroke-dasharray="${CIRC}" stroke-dashoffset="${(CIRC * (1 - prog / 100)).toFixed(1)}"></circle>
          </svg><b>${prog}%</b></span>` : ''}
      </div>
      <button class="st-go" onclick="startFocus('${t.id}')">${icon('play')}เริ่มทำ</button>
    </div>`;
  } else {
    // บรรทัดบนของการ์ดพูดว่า "ไม่มีงานค้าง" ไปแล้ว — ช่องนี้จึงต้องไม่พูดซ้ำ
    // แต่ต้องเสนอสิ่งที่ทำต่อได้ · ไม่มีงานเลยกับมีแต่กิจกรรมเป็นคนละสถานการณ์กัน
    taskBox = pend.length
      ? `<div class="sd-task empty">${icon('pin')}
          <b>เหลือแต่ของที่ถึงเวลาแล้วต้องไป</b></div>`
      : `<button class="sd-task empty tap" onclick="openAddSheet()">${icon('camera')}
          <b>เพิ่มงานแรก</b>${icon('chevron')}</button>`;
  }

  const dayCard = `<section class="sai-day">
    <div class="sd-head">
      <span class="sd-tx"><b>ภาพรวมวันนี้</b><span>${esc(sum)}</span></span>
      <button class="sd-all" onclick="go('scr-menu')">ดูทั้งหมด${icon('chevron')}</button>
    </div>
    ${taskBox}
  </section>`;

  // ---- แถบความโปร่งใส ----
  // ไม่ใช่คำอธิบายว่า "เราเก็บข้อมูลเท่าที่จำเป็น" แต่เป็นปุ่มที่เปิดดูข้อความก้อนจริงที่ถูกส่งไป
  // นี่คือจุดที่แอปตอบคำถาม "AI เห็นอะไรของฉันบ้าง" ด้วยของจริง ไม่ใช่ด้วยคำสัญญา
  const priv = `<button class="ai-priv" onclick="aiShowContext()">
    <span class="ai-priv-ic">${icon('lock')}</span>
    <span class="ai-priv-tx">น้องไซเห็นงาน ${pend.length} ใบ${
      nCls ? ' · ตารางเรียน ' + nCls + ' คาบ' : ''} · เวลาว่างของคุณ</span>
    <span class="ai-priv-go">ดูว่าเห็นอะไร</span>
  </button>`;

  // ---- 4 · พื้นที่สนทนา ----
  const bubbles = log.map(m => m.role === 'user'
    ? `<div class="ai-msg me"><div class="ai-bub">${esc(m.text)}</div></div>`
    : `<div class="ai-msg sai">
         ${saiFace()}
         <div class="ai-bub${m.err ? ' err' : ''}">${esc(m.text)}</div>
       </div>`).join('');

  const typing = aiBusy ? `<div class="ai-msg sai">
      ${saiFace()}
      ${aiPartial
        ? `<div class="ai-bub ai-live">${esc(aiPartial)}</div>`
        : `<div class="ai-bub ai-live ai-typing"><i></i><i></i><i></i></div>`}
    </div>` : '';

  const opener = fresh ? `<div class="ai-msg sai">
      ${saiFace()}
      <div class="ai-bub">${esc(aiOpener(sp))}</div>
    </div>` : '';

  // กล่องในต้องมีจริง — ดัน .at-in ด้วย margin-top:auto แทน justify-content:flex-end
  // เพราะ flex-end บนกล่องที่ scroll ได้ ทำให้เนื้อหาส่วนบนเลื่อนไปหาไม่เจอเมื่อล้น
  const thread = `<div class="ai-thread"><div class="at-in">${opener}${bubbles}${typing}</div></div>`;

  // ---- 5 · ปุ่มทางลัด ----
  // อยู่เหนือช่องพิมพ์เสมอ ไม่ใช่เฉพาะตอนจอว่าง — จอเปล่ากับช่องพิมพ์เปล่า
  // คือจุดที่คนส่วนใหญ่ปิดทิ้งเพราะไม่รู้ว่าถามอะไรได้ และความไม่รู้นั้นไม่ได้หายไปหลังถามครั้งแรก
  const quick = `<div class="sai-qa">
    ${fresh ? '' : `<button class="qa-priv" onclick="aiShowContext()">${
      icon('lock')}น้องไซเห็นอะไร</button>`}
    ${AI_QUICK.map(q => `<button onclick="aiAsk('${esc(q[2]).replace(/'/g, "\\'")}')"${
      aiBusy ? ' disabled' : ''}>${icon(q[0])}${esc(q[1])}</button>`).join('')}
  </div>`;

  // ---- 6 · ช่องพิมพ์ ----
  const bar = `<div class="sai-bar">
    <textarea id="aiInput" class="ai-in" rows="1" maxlength="2000"
      placeholder="ถามน้องไซ…" ${aiBusy ? 'disabled' : ''}
      oninput="autoGrow(this)"
      onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();aiAsk();}"></textarea>
    <button class="sb-mic${aiVoiceOn ? ' rec' : ''}" onclick="aiVoice()" ${aiBusy ? 'disabled' : ''}
      aria-label="${aiVoiceOn ? 'หยุดฟัง' : 'พูดแทนพิมพ์'}">${icon('mic')}</button>
    <button class="sb-send" onclick="aiAsk()" ${aiBusy ? 'disabled' : ''}
      aria-label="ส่งคำถาม">${icon('chevron')}</button>
  </div>`;

  // ---- ท้ายจอเคยมีอะไรอยู่ ----
  // รายการ "น้องไซจะทำอะไรให้ / สิ่งที่น้องไซจะไม่ทำ" กับย่อหน้าความเป็นส่วนตัว
  // ถูกถอดออกใน 1A9c — จอนี้เป็นห้องสนทนา ไม่ใช่หน้าแนะนำผลิตภัณฑ์
  // ของที่ต้องอ่านครั้งเดียวไม่ควรกินความสูงถาวรในจอที่ต้องเลื่อนทุกครั้งที่คุย
  //
  // ขอบเขต ("ไม่เฉลยให้ลอก") ไม่ได้หายไปจากตัวระบบ — มันอยู่ใน system prompt ฝั่ง Edge Function
  // ซึ่งเป็นที่ที่บังคับใช้ได้จริง ต่างจากข้อความบนจอที่เป็นแค่คำประกาศ
  // ส่วนความโปร่งใสยังอยู่ที่ปุ่ม "ดูว่าเห็นอะไร" เหนือบทสนทนา ซึ่งเปิดดูของจริงได้

  el.innerHTML = head + (fresh ? dayCard + priv : '') + thread + quick + bar;
}

// เลื่อนลงล่างสุดหลังส่งคำถาม — บทสนทนาที่ตอบแล้วแต่ต้องเลื่อนหาเอง อ่านเหมือนไม่ได้ตอบ
function aiScrollDown() {
  const th = document.querySelector('#aiBody .ai-thread');
  if (th) th.scrollTop = th.scrollHeight;
}

// ---------- พูดแทนพิมพ์ในช่องแชท ----------
// ตัวจับเสียงของหน้าสแกน (toggleVoice) ผูกกับ #voiceBtn/#voiceBox แล้วจบด้วย runParsing()
// ซึ่งเป็นคนละงานกันคนละเรื่อง — ตรงนี้ต้องการแค่ข้อความลงช่องพิมพ์ จึงมีตัวของตัวเอง
// ไม่แปลงเลขคำอ่านไทย (normalizeSpokenText) ด้วย เพราะนั่นมีไว้ให้ตัวแกะงานอ่าน ไม่ใช่ให้คนอ่าน
let aiRecog = null, aiVoiceOn = false;

function aiVoice() {
  if (aiVoiceOn) { try { aiRecog.stop(); } catch (_) {} return; }
  if (!speechSupported()) {
    showToast({ title: 'เบราว์เซอร์นี้ยังพูดใส่ไม่ได้',
      body: 'ลองใช้ Chrome (Android) หรือ Safari (iPhone) · ระหว่างนี้พิมพ์เอาได้เลย' });
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  aiRecog = new SR();
  aiRecog.lang = 'th-TH';
  aiRecog.interimResults = true;
  aiRecog.continuous = false;

  const box = () => document.getElementById('aiInput');
  const before = (box() ? box().value : '').trim();
  let finalText = '';

  aiRecog.onstart = () => {
    aiVoiceOn = true;
    const b = document.querySelector('.sb-mic');
    if (b) b.classList.add('rec');
    haptic('arm');
  };
  aiRecog.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
    }
    const b = box();
    if (b) { b.value = (before + ' ' + finalText + interim).trim(); autoGrow(b); }
  };
  aiRecog.onerror = e => {
    aiVoiceOn = false;
    const msg = {
      'not-allowed': 'ยังไม่ได้อนุญาตให้ใช้ไมค์ — เปิดสิทธิ์ไมโครโฟนให้เว็บนี้ก่อนนะ',
      'service-not-allowed': 'ยังไม่ได้อนุญาตให้ใช้ไมค์ — เปิดสิทธิ์ไมโครโฟนให้เว็บนี้ก่อนนะ',
      'no-speech': 'ไม่ได้ยินเสียงเลย ลองพูดใหม่อีกครั้ง',
      'audio-capture': 'หาไมโครโฟนไม่เจอ',
      'network': 'ต้องต่อเน็ตเพื่อแปลงเสียงเป็นข้อความ',
    }[e.error] || ('เกิดข้อผิดพลาด: ' + e.error);
    showToast({ title: 'พูดไม่สำเร็จ', body: msg });
  };
  // วาดใหม่ทั้งจอตอนจบไม่ได้ — มันจะล้างสิ่งที่เพิ่งถอดเสียงมาในช่องพิมพ์ทิ้ง
  // เอาแค่คลาส rec ออกจากปุ่มพอ
  aiRecog.onend = () => {
    aiVoiceOn = false;
    const b = document.querySelector('.sb-mic');
    if (b) b.classList.remove('rec');
    const t = box();
    if (t) t.focus();
  };
  try { aiRecog.start(); } catch (_) { aiVoiceOn = false; }
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

  // งานที่เสร็จแล้วกับงานที่ลบไปเป็น "ของที่เก็บไว้ดูย้อนหลัง" เหมือนกัน
  // ทั้งคู่จึงอยู่หลังปุ่มท้ายหน้า ไม่ใช่แท็บบนหัวจอที่ยืนแข่งกับรายการงานจริง
  // รายการหลักเหลืองานค้างอย่างเดียว — จอนี้มีหน้าที่บอกว่า "ยังเหลืออะไร" ไม่ใช่ "เคยทำอะไรไปบ้าง"
  if (taskFilter === 'bin') { el.innerHTML = binView(bin); return; }
  if (taskFilter === 'done') { el.innerHTML = doneView(done); return; }

  const rows0 = pending;

  // แถบเลือกวัน — ตอบคำถาม "วันนี้อะไรสำคัญ แล้ววันอื่นต่อ" โดยไม่ต้องเปิดอีกจอ
  // ค่าเริ่มต้นคือ "ทุกวัน" เพื่อให้จอนี้ยังเป็นรายการงานทั้งหมดเหมือนเดิม
  // จุดใต้เลขวันคือจำนวนงาน สีของจุดคือใบที่ด่วนที่สุดของวันนั้น
  const dayKey = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, i);
    const k = dayKey(d);
    const on = rows0.filter(t => t.due && dayKey(new Date(t.due)) === k);
    const tone = on.reduce((a, t) => a === 'hot' ? a : (dueTone(t, now) || a), '');
    // WEEKDAY_SHORT มีจุดต่อท้าย ('จ.') — ในช่องแคบ ๆ จุดกินที่โดยไม่ได้บอกอะไร
    return { d, k, n: on.length, tone,
      label: i === 0 ? 'วันนี้' : WEEKDAY_SHORT[d.getDay()].replace('.', '') };
  });

  const rows = taskDay
    ? rows0.filter(t => t.due && dayKey(new Date(t.due)) === taskDay)
    : rows0;

  const pageHead = `<div class="page-head">
      <div class="eyebrow">รายการงาน</div>
      <h1 class="page-title">ตารางงาน</h1>
      <p class="page-sub">ค้างอยู่ <b>${pending.length}</b>${
        done.length ? ' · เสร็จแล้ว ' + done.length : ''}</p>
    </div>`;

  const head = pageHead + `${tlModeTabs()}
    <div class="daystrip">
      ${days.map(x => `<button class="ds${taskDay === x.k ? ' on' : ''}" onclick="setTaskDay('${x.k}')">
        <i class="ds-d">${esc(x.label)}</i><b class="ds-n">${x.d.getDate()}</b>
        ${x.n ? `<u class="ds-dot${x.tone ? ' ' + x.tone : ''}"></u>` : '<u class="ds-dot off"></u>'}
      </button>`).join('')}
    </div>
    ${taskDay && days.some(x => x.k === taskDay) ? `<button class="dayclear" onclick="setTaskDay(null)">
      ${icon('calendar')}เฉพาะ${esc(fmtThaiDate(days.find(x => x.k === taskDay).d))}
      <span>ดูทุกวัน</span></button>` : ''}`;

  const empty = taskDay ? 'วันนี้ไม่มีงานที่ถึงกำหนด'
    : 'ไม่มีงานค้างเลย — เคลียร์หมดแล้ว';

  // ใบแรกของรายการที่ยังไม่เสร็จได้แถบฟ้า = "ใบนี้คือใบที่ควรลงมือ"
  // ให้ทุกใบมีแถบก็เท่ากับไม่มีใบไหนมีแถบ
  const firstPending = rows.find(t => !t.done);

  el.innerHTML = head
    + (rows.length
        ? rows.map(t => taskCard(t, now, t === firstPending)).join('')
        : `<div class="card empty">${empty}</div>`)
    + (done.length ? `<button class="bin-btn" onclick="setFilter('done')">
        ${icon('check-circle')}เสร็จแล้ว · ${done.length} งาน</button>` : '')
    + (bin.length ? `<button class="bin-btn" onclick="setFilter('bin')">
        ${icon('trash')}ถังขยะ · ${bin.length} รายการ</button>` : '');
}

// ---------- ที่เก็บงานที่ทำเสร็จ ----------
// โครงเดียวกับถังขยะ เพราะเป็นของประเภทเดียวกัน — ของที่เก็บไว้ดูย้อนหลัง
// ต่างกันที่ถังขยะมีวันหมดอายุ ส่วนงานที่เสร็จอยู่ถาวร (สถิติกับเหรียญนับจากตรงนี้)
function doneView(done) {
  const head = `<div class="bin-head">
      <button class="back" onclick="setFilter('pending')" aria-label="กลับ">${icon('chevron')}</button>
      <div style="flex:1;min-width:0">
        <div class="eyebrow">ที่เก็บงานที่ทำเสร็จ</div>
        <div class="page-title" style="font-size:21px;margin-top:2px">เสร็จแล้ว</div>
      </div>
    </div>`;
  if (!done.length) return head + `<div class="card empty">ยังไม่มีงานที่ทำเสร็จ</div>`;

  const now = new Date();
  // จัดกลุ่มตามวันที่ทำเสร็จ — "เสร็จไปแล้วกี่ใบ" อ่านง่ายกว่าตอนเห็นเป็นวัน ๆ ไป
  const groups = {};
  for (const t of done) {
    const k = t.doneAt ? fmtThaiDate(new Date(t.doneAt)) : 'ไม่รู้วันที่';
    (groups[k] = groups[k] || []).push(t);
  }
  const body = Object.entries(groups).map(([k, list]) =>
    `<div class="sec-label soft">${icon('check')}${esc(k)} · ${list.length} งาน</div>`
    + list.map(t => taskCard(t, now, false)).join('')).join('');

  return head + body
    + `<p class="bin-note">งานที่เสร็จไม่หายไปไหน — สถิติกับเหรียญตรานับจากรายการนี้
        · แตะใบไหนเพื่อเอากลับมาเป็นงานค้าง</p>`;
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

// ---------- เส้นเวลา (แกนตั้ง) ----------
// เดิมเป็นถนนแนวนอนที่ต้องเลื่อนซ้าย-ขวา ซึ่งบนมือถืออ่านยากกว่าที่คิด:
// นิ้วเลื่อนแนวตั้งเป็นสัญชาตญาณ พอต้องเลื่อนแนวนอนคนจึงไม่รู้ว่ายังมีของอยู่ทางขวา
// แกนตั้งไหลลงเหมือนอ่านหนังสือ เห็นครบ 7 วันด้วยการเลื่อนแบบเดียวกับทั้งแอป
//
// ที่สำคัญกว่ารูปทรงคือสิ่งที่เอามาซ้อน: เดิมเส้นเวลารู้แค่ "งานส่งวันไหน"
// ซึ่งตอบไม่ได้เลยว่าจะทำทันไหม — คำถามจริงของนักเรียนคือ "ก่อนถึงวันนั้นฉันมีเวลาเท่าไหร่"
// ตอนนี้แต่ละวันวาดจาก context: แถบรูปร่างของวัน (เรียน/กิจวัตร/ช่องว่าง) + เวลาว่างรวม
// แล้วเทียบกับงานที่ต้องส่งวันนั้น สะสมมาตั้งแต่วันนี้ วันไหนเวลาไม่พอจะติดป้ายเตือน
const TL_DAYS = 7;
const TL_PIN_ICON = { homework: 'type', exam: 'book', activity: 'calendar', reminder: 'clock' };

function humanLeft(ms) {
  if (ms < 0) return 'เลยมาแล้ว';
  const min = Math.round(ms / 60000);
  if (min < 60) return 'อีก ' + Math.max(1, min) + ' นาที';
  const h = Math.floor(min / 60);
  if (h < 24) return 'อีก ' + h + ' ชม.' + (min % 60 ? ' ' + (min % 60) + ' นาที' : '');
  return 'อีก ' + Math.round(h / 24) + ' วัน';
}

function tlHours(min) {
  if (min <= 0) return '0';
  return String(Math.round(min / 6) / 10);
}

// นาทีจากเที่ยงคืนของเวลาที่กำหนดส่ง — 23:59 คือ "ไม่ได้ระบุเวลา" (ทั้งวัน)
function tlDueMin(t) {
  const d = new Date(t.due);
  return d.getHours() * 60 + d.getMinutes();
}
function tlAllDay(t) {
  const d = new Date(t.due);
  return d.getHours() === 23 && d.getMinutes() === 59;
}

// เก็บข้อมูลของแต่ละวันไว้ก้อนเดียว แล้วค่อยเอาไปวาด — ตรรกะกับ markup แยกกันชัด
//
// "เวลาว่างที่ใช้ได้จริงก่อนกำหนดส่ง" ไม่ใช่เวลาว่างทั้งวัน:
// งานที่ส่ง 08:00 ใช้ช่องว่างตอนเย็นของวันเดียวกันไม่ได้ ต้องนับเฉพาะช่องที่จบก่อนเวลาส่ง
// ถ้านับรวมทั้งวันจะได้คำตอบที่ดูดีแต่ผิด แล้วคนเชื่อจนพลาดส่งจริง
function tlBuildDays(dated, now) {
  const out = [];
  let capAcc = 0, needAcc = 0;
  // เพดานเดียวกับที่ตัวจัดแผนใช้ — วันอาทิตย์ที่ไม่มีคาบเรียนมีช่องว่าง 15 ชั่วโมงก็จริง
  // แต่ไม่มีนักเรียนคนไหนนั่งทำการบ้าน 15 ชั่วโมง ตัวเลขนั้นเลยทั้งไม่จริงและไม่มีประโยชน์
  // และถ้าเส้นเวลาบอก 15 ชม. ขณะที่หน้าแผนบอก 2 ชม. สองจอก็โกหกคนคนเดียวกันคนละแบบ
  const capMin = Math.round(Math.max(0.5, +state.settings.freeHours || 2) * 60);

  for (let i = 0; i < TL_DAYS; i++) {
    const day = addDays(now, i);
    const isToday = i === 0;
    const slots = typeof freeSlots === 'function' ? freeSlots(day, isToday ? now : null) : [];
    const busy = (typeof busyBlocks === 'function' && typeof mergeRanges === 'function')
      ? mergeRanges(busyBlocks(day)) : [];
    const freeMin = slots.reduce((a, s) => a + s.min, 0);

    const due = dated.filter(t => new Date(t.due).toDateString() === day.toDateString())
      .sort((a, b) => new Date(a.due) - new Date(b.due));
    const needMin = due.reduce((a, t) => {
      if (!TASK_TYPES[taskType(t)].schedulable) return a;   // กิจกรรมไม่กินเวลานั่งทำ
      const left = Math.max(0, Math.round((t.estMin || 30) * (1 - (t.progress || 0) / 100)));
      return a + left;
    }, 0);

    // ช่องว่างของวันนี้ที่ยังทันงานที่ส่งเช้าวันนี้ = ช่องที่จบก่อนเวลาส่งที่เร็วที่สุด
    const firstDue = due.length ? Math.min(...due.map(tlDueMin)) : 24 * 60;
    const rawUsable = slots.reduce((a, s) => a + Math.max(0, Math.min(s.to, firstDue) - s.from), 0);

    // เวลาที่ "ทำได้จริง" ของวันนั้น = ช่องว่างที่มี แต่ไม่เกินเพดานต่อวัน
    const budget = Math.min(freeMin, capMin);
    const usable = Math.min(rawUsable, budget);

    capAcc += usable;
    needAcc += needMin;
    const tight = needMin > 0 && needAcc > capAcc;
    capAcc += budget - usable;   // ที่เหลือของวันตกไปเป็นทุนของวันถัดไป

    out.push({ day, isToday, slots, busy, freeMin, budget, due, needMin, tight,
      capped: freeMin > capMin, shortMin: Math.max(0, needAcc - capAcc) });
  }

  // หนี้เวลาไหลต่อไปข้างหน้าเรื่อย ๆ พอวันหนึ่งไม่พอ วันถัด ๆ ไปก็ไม่พอตามไปด้วยทั้งแถว
  // ติดป้ายเตือนเต็มทุกใบจะได้ข้อความเดียวกันสามสี่รอบ ซึ่งอ่านแล้วเลิกอ่าน
  // วันที่ทำอะไรได้จริงคือวันแรกที่เริ่มไม่พอ — วันที่เหลือแค่บอกว่ายังตามไม่ทัน
  const first = out.findIndex(d => d.tight);
  if (first >= 0) {
    for (let i = first + 1; i < out.length; i++) {
      if (out[i].tight) { out[i].tight = false; out[i].carry = true; }
    }
  }
  return out;
}

// หน้าต่างของแถบ — ใช้ค่าเดียวกันทุกวัน ไม่งั้นแถบแต่ละวันเทียบกันด้วยสายตาไม่ได้
function tlWindow(days) {
  const p = typeof ctxPrefs === 'function' ? ctxPrefs() : {};
  let from = Math.min(6 * 60, hm2min(p.wake) ?? 6 * 60);
  let to = Math.max(22 * 60, hm2min(p.sleep) || 22 * 60);
  for (const d of days) {
    for (const b of d.busy) { from = Math.min(from, b.from); to = Math.max(to, b.to); }
  }
  return { from, to: Math.max(to, from + 60) };
}

// นาทีที่อ่านแล้วเห็นภาพทันที — "0.4 ชม." ไม่มีใครแปลงในหัวได้ทัน แต่ "25 นาที" เห็นเลย
// ทุกจอที่พูดถึงเวลาต้องใช้ตัวนี้ตัวเดียว ไม่งั้นสองบรรทัดในจอเดียวกันใช้คนละหน่วย
function humanMin(m) {
  m = Math.max(0, Math.round(m));
  if (m < 60) return m + ' นาที';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + ' ชม. ' + r + ' นาที' : h + ' ชม.';
}

// รุ่นสั้นสำหรับที่ที่ต้องอยู่บรรทัดเดียวกับของอื่น — "6ช 35น" แทน "6 ชม. 35 นาที"
// ใช้เฉพาะในจอภาพรวมที่ตัวเลขเป็นของประกอบ ไม่ใช่ของที่ต้องอ่านละเอียด
function shortMin(m) {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return r + 'น';
  return h + 'ช' + (r ? ' ' + r + 'น' : '');
}

// ---------- เส้นเวลา: ตื่นจนหลับ ----------
// จอนี้เคยเป็นรายการ 7 วันที่บอกแค่ "วันไหนส่งอะไร" กับ "วันนั้นว่างกี่ชั่วโมง"
// ซึ่งเป็นครึ่งเดียวของคำถาม — ว่าง 8 ชั่วโมงเป็นข่าวดีหรือร้าย ขึ้นกับว่ามีงานรออยู่เท่าไหร่
// และมันไม่เคยบอกว่า "แล้วกี่โมงต้องทำอะไร" ทั้งที่แอปคำนวณไว้หมดแล้ว
//
// ตอนนี้เป็นเส้นเดียวตั้งแต่ตื่นถึงนอน ถักจากทุกส่วนที่แอปรู้:
//   context.js  ตื่น · นอน · ห้ามวางงานหลัง        → หัวและท้ายเส้น
//   context.js  busyBlocks() คาบเรียน + กิจวัตร     → บล็อกสีกลาง
//   engine.js   buildDayPlan() งานที่จัดลง + เวลาพัก → บล็อกงาน (วันนี้เท่านั้น)
//   งานที่ถึงกำหนดวันนั้น                            → หมุดเส้นตาย
let tlDayOffset = 0;   // 0 = วันนี้ · 1..6 = วันถัดไป
let tlMode = 'day';    // 'day' = ไล่ทีละชั่วโมงของวันเดียว · 'cal' = ปฏิทินเดือน

function setTlDay(i) {
  tlDayOffset = i; tlMode = 'day';
  renderTimeline(); const s = document.getElementById('scr-timeline'); if (s) s.scrollTop = 0;
}
function setTlMode(m) {
  tlMode = m;
  renderTimeline(); const s = document.getElementById('scr-timeline'); if (s) s.scrollTop = 0;
}

// วันเรียนหนึ่งวันมี 7–8 คาบต่อกันแทบไม่ขาด ถ้าขึ้นเป็นคนละแถวหมด เส้นเวลาของวันธรรมดา
// กลายเป็นแถวเทาหน้าตาเหมือนกันแปดแถวรวด แล้วของที่ต้องตัดสินใจจริง ๆ — งานที่จัดลง
// กับหมุดเส้นตาย — จมหายไปกลางกอง ผู้ทดสอบเรียกจอนี้ว่า "ยาวเป็นหางว่าว"
//
// ความจริงของวันนั้นคือเรื่องเดียว: "เช้าถึงบ่ายติดเรียน" ไม่ใช่แปดเรื่อง
// จึงยุบคาบที่ต่อกันเป็นก้อนเดียว แล้วเก็บรายคาบไว้ในแผ่นรายละเอียด — ย่อ ไม่ใช่ตัดทิ้ง
const TL_CLASS_GAP = 30;   // พักคาบ 10–20 นาทียังอยู่ที่โรงเรียน ไม่ใช่ช่องว่างของวัน

function tlMergeClasses(busy) {
  const out = [];
  for (const b of busy) {
    const last = out[out.length - 1];
    if (b.kind === 'class' && last && last.kind === 'class' && b.from - last.to <= TL_CLASS_GAP) {
      last.to = Math.max(last.to, b.to);
      last.parts.push(b);
      continue;
    }
    out.push(b.kind === 'class' ? Object.assign({}, b, { parts: [b] }) : Object.assign({}, b));
  }
  return out;
}

// รายการทุกอย่างที่เกิดขึ้นในวันนั้น เรียงตามนาทีของวัน
function tlDayItems(day, isToday, now) {
  const p = typeof ctxPrefs === 'function' ? ctxPrefs() : {};
  const out = [];
  const wake = hm2min(p.wake), sleep = hm2min(p.sleep), stop = hm2min(p.noWorkAfter);

  // คาบเรียนกับกิจวัตรของวันนั้น — busyBlocks คืนชื่อมาด้วย จึงบอกได้ว่าติดอะไรอยู่
  const busy = tlMergeClasses(typeof busyBlocks === 'function' ? busyBlocks(day) : []);

  // คนส่วนใหญ่มีกิจวัตร "ตื่น เตรียมตัว" ที่เริ่มพร้อมเวลาตื่นพอดี
  // ขึ้นสองแถวเวลาเดียวกันคือการบอกเรื่องเดียวกันสองรอบ — ให้กิจวัตรพูดแทน เพราะมีชื่อของมันเอง
  if (wake != null && !busy.some(b => Math.abs(b.from - wake) <= 5)) {
    out.push({ min: wake, kind: 'wake', label: 'ตื่นนอน' });
  }
  for (const b of busy) {
    out.push(b.parts && b.parts.length > 1
      ? { min: b.from, kind: 'classes', label: 'เรียน ' + b.parts.length + ' คาบ',
          from: b.from, to: b.to, parts: b.parts }
      : { min: b.from, kind: 'busy', label: b.title, from: b.from, to: b.to, ck: b.kind, id: b.id });
  }

  // แผนของวันนี้เท่านั้น — buildDayPlan วางงานลงช่องว่างที่เหลือ "นับจากตอนนี้"
  // วันอื่นจึงยังไม่มีแผน มีแต่เส้นตายกับตารางชีวิต ซึ่งเป็นความจริงที่ควรบอกตรง ๆ
  let plan = null;
  if (isToday) {
    plan = buildDayPlan(pendingTasks(), state.settings, now);
    for (const s of plan.slots) {
      const m = s.start.getHours() * 60 + s.start.getMinutes();
      if (s.break) out.push({ min: m, kind: 'break', label: 'พัก ' + s.min + ' นาที', mins: s.min });
      else out.push({ min: m, kind: 'work', task: s.task, mins: s.min, note: s.note, end: s.end,
        label: taskTitle(s.task) });
    }
  }

  // หมุดเส้นตายของวันนั้น — งานที่ครบกำหนดวันนี้ ไม่ว่าจะมีที่ให้ทำหรือไม่
  for (const t of pendingTasks()) {
    if (!t.due) continue;
    const d = new Date(t.due);
    if (d.toDateString() !== day.toDateString()) continue;
    out.push({ min: tlDueMin(t), kind: 'due', task: t, label: taskTitle(t) });
  }

  if (stop != null) out.push({ min: stop, kind: 'stop', label: 'หยุดทำงาน' });
  if (sleep != null) out.push({ min: sleep, kind: 'sleep', label: 'เข้านอน' });

  // คนที่นอนหลังเที่ยงคืนเก็บเวลานอนเป็น '01:00' = 60 นาที ซึ่งน้อยกว่าเวลาตื่น
  // เรียงตรง ๆ แล้ว "เข้านอน" จะไปโผล่บนสุดของวัน ก่อนตื่นด้วยซ้ำ
  // ปลายวันที่ตกก่อนเวลาตื่น = ของคืนถัดไป ให้บวก 24 ชม. เฉพาะตอนเรียง ส่วนที่แสดงยังเป็นเวลาจริง
  for (const it of out) {
    it.sort = (it.min < wake && (it.kind === 'sleep' || it.kind === 'stop'))
      ? it.min + 24 * 60 : it.min;
  }

  out.sort((a, b) => a.sort - b.sort || (a.kind === 'work' ? -1 : 1));
  return { items: out, plan };
}

// สวิตช์ตัวเดียวกันโผล่ทั้งสองจอ เพราะสามโหมดนี้เป็นของแท็บ "ตาราง" เดียวกัน
// รายวันกับปฏิทินอยู่ในจอเส้นเวลา ส่วนรายการงานเป็นอีกจอ (มีฟิลเตอร์/ถังขยะของตัวเอง)
// ผู้ใช้ไม่ต้องรู้ว่ามันคนละจอ — เห็นแค่สวิตช์ที่อยู่ที่เดิมและทำงานเหมือนกัน
function tlModeTabs() {
  const onList = curScreen === 'scr-tasks';
  return `<div class="tlmode">
    <button class="tlm${!onList && tlMode === 'day' ? ' on' : ''}" onclick="goTlMode('day')">รายวัน</button>
    <button class="tlm${!onList && tlMode === 'cal' ? ' on' : ''}" onclick="goTlMode('cal')">ปฏิทิน</button>
    <button class="tlm${onList ? ' on' : ''}" onclick="goTlMode('list')">รายการงาน</button>
  </div>`;
}

function goTlMode(m) {
  if (m === 'list') { go('scr-tasks'); return; }
  tlMode = m;
  if (curScreen === 'scr-timeline') { renderTimeline(); const s = document.getElementById('scr-timeline'); if (s) s.scrollTop = 0; }
  else go('scr-timeline');
}

// ---------- ปฏิทิน ----------
// โหมดที่สองของเส้นเวลาผ่านมาสองรอบแล้ว: กริดชั่วโมงที่ต้องปัดห้ารอบต่อวัน
// แล้วเป็นแถบวันละเส้นซึ่งสั้นลงจริงแต่ยังเห็นแค่เจ็ดวัน
//
// สิ่งที่นักเรียนวางแผนจริง ๆ ไม่ได้จบใน 7 วัน — สอบกลางภาคอยู่อีกสามสัปดาห์
// งานกลุ่มส่งสิ้นเดือน ปฏิทินเดือนจึงเป็นภาชนะที่ถูกกับคำถาม "เดือนนี้มีอะไรรออยู่"
// และมันใช้งานได้ตั้งแต่ยังไม่กรอกตารางเรียน เพราะเส้นตายมาจากงานที่สแกนเข้ามาอยู่แล้ว
let calMonth = 0;    // 0 = เดือนนี้ · -1/+1 = ถอย/เดิน
let calPick = null;  // 'YYYY-M-D' ของวันที่เลือกอยู่ · null = วันนี้

function calShift(n) { calMonth += n; calPick = null; calEdit = null; renderTimeline(); }
function calSelect(k) { calPick = k; calEdit = null; renderTimeline(); }
function calKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

// ---------- หมุดปฏิทิน ----------
// ปฏิทินเดิมอ่านอย่างเดียว — มันบอกได้แค่สิ่งที่ระบบรู้ (เส้นตายกับคาบเรียน)
// แต่เรื่องที่ต้องวางแผนล่วงหน้าจริง ๆ มักเป็นเรื่องที่ยังไม่มีใบงาน:
// สอบกลางภาคอีกสามสัปดาห์ · วันกีฬาสี · ปิดเทอม · วันส่งใบสมัคร
//
// หมุดจึงไม่ใช่ "งาน" — ไม่มีเวลาที่ต้องใช้ ไม่มีสถานะเสร็จ ไม่เข้าไปในแผนรายชั่วโมง
// มันคือหลักไมล์ที่เอาไว้เล็งว่า "เหลืออีกกี่วัน" ซึ่งเป็นคนละคำถามกับ "วันนี้ทำอะไรก่อน"
// ถ้ายัดมันเป็นงาน ตัวจัดอันดับจะพยายามเจียดเวลาให้ "ปิดเทอม" ซึ่งไม่มีความหมาย
function marks() {
  if (!Array.isArray(state.marks)) state.marks = [];
  return state.marks;
}
function marksOn(k) { return marks().filter(m => m.date === k); }

let calEdit = null;   // { id, date, title, color, big } · null = ฟอร์มปิดอยู่

function calAddMark(k) {
  // เลือกวันไปด้วยเสมอ — ฟอร์มขึ้นเฉพาะในแผ่นของวันที่เลือกอยู่
  // ปกติปุ่มอยู่ในแผ่นนั้นพอดี แต่ถ้าเรียกจากที่อื่นแล้วไม่เลือกให้ ฟอร์มจะไม่โผล่เลย
  calPick = k;
  calEdit = { id: null, date: k, title: '', color: 1, big: false };
  renderTimeline();
  const el = document.getElementById('calMarkName');
  if (el) el.focus();
}
function calEditMark(id) {
  const m = marks().find(x => x.id === id);
  if (!m) return;
  calPick = m.date;
  calEdit = { id: m.id, date: m.date, title: m.title, color: m.color, big: !!m.big };
  renderTimeline();
}
function calCancelMark() { calEdit = null; renderTimeline(); }
function calSetColor(c) { if (calEdit) { calEdit.color = c; renderTimeline(); } }
function calToggleBig() { if (calEdit) { calEdit.big = !calEdit.big; renderTimeline(); } }

function calSaveMark() {
  if (!calEdit) return;
  const name = (calEdit.title || '').trim();
  const err = document.getElementById('calMarkErr');
  if (!name) { if (err) { err.textContent = 'ยังไม่ได้ใส่ชื่อ'; err.hidden = false; } return; }
  if (calEdit.id) {
    const m = marks().find(x => x.id === calEdit.id);
    if (m) Object.assign(m, { title: name, color: calEdit.color, big: calEdit.big });
  } else {
    marks().push({ id: uid(), date: calEdit.date, title: name,
      color: calEdit.color, big: calEdit.big, createdAt: new Date().toISOString() });
  }
  calEdit = null;
  save();
  renderAll();
}

function calDeleteMark(id) {
  state.marks = marks().filter(m => m.id !== id);
  calEdit = null;
  save();
  renderAll();
}

// "อีกกี่วัน" คือเหตุผลทั้งหมดที่หมุดมีอยู่ — ถ้าไม่บอก มันก็เป็นแค่ข้อความติดปฏิทิน
function calCountdown(k, now) {
  const n = calOffset(k);
  if (n === 0) return 'วันนี้';
  if (n === 1) return 'พรุ่งนี้';
  if (n > 0) return 'อีก ' + n + ' วัน';
  return 'ผ่านมาแล้ว ' + (-n) + ' วัน';
}

// จำนวนวันจากวันนี้ — ลบ = อดีต
function calOffset(k) {
  const [y, m, dd] = k.split('-').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, dd) - today) / 864e5);
}

// เส้นเวลารายวันมีข้อมูลจริงเฉพาะ 7 วันข้างหน้า วันที่ไกลกว่านั้นจึงไม่มีปุ่มให้กด
// (แผ่นข้างล่างแสดงงานของวันนั้นครบอยู่แล้ว — ปุ่มที่พาไปเจอจอเปล่าแย่กว่าไม่มีปุ่ม)
function calOpen(k) {
  const off = calOffset(k);
  if (off >= 0 && off <= 6) setTlDay(off);
}

function calHtml(now) {
  const base = new Date(now.getFullYear(), now.getMonth() + calMonth, 1);
  const y = base.getFullYear(), m = base.getMonth();
  const first = new Date(y, m, 1).getDay();          // 0 = อาทิตย์
  const len = new Date(y, m + 1, 0).getDate();
  const todayK = calKey(now);
  const pick = calPick || todayK;

  // จัดงานลงวันของมันครั้งเดียว แล้วค่อยวาด — กรองซ้ำ 35 รอบต่อการวาดหนึ่งครั้งไม่คุ้ม
  const byDay = {};
  for (const t of pendingTasks()) {
    if (!t.due) continue;
    const k = calKey(new Date(t.due));
    (byDay[k] = byDay[k] || []).push(t);
  }

  let cells = '';
  for (let i = 0; i < first; i++) cells += '<span class="cal-c off"></span>';
  for (let dd = 1; dd <= len; dd++) {
    const d = new Date(y, m, dd);
    const k = calKey(d);
    const list = (byDay[k] || []).sort((a, b) => new Date(a.due) - new Date(b.due));
    const hot = list.some(t => dueTone(t, now) === 'hot');
    const nCls = typeof busyBlocks === 'function'
      ? busyBlocks(d).filter(b => b.kind === 'class').length : 0;
    // จุดสามจุดพอ — เกินนั้นตาอ่านไม่ทันอยู่ดี ที่เหลือบอกเป็นเลขในแผ่นข้างล่าง
    const dots = list.slice(0, 3).map(t =>
      `<i class="sjdot ${subjClass(t.subject)}"></i>`).join('');
    // หมุดของผู้ใช้อยู่เหนือเลขวัน เป็นแถบสีเต็มความกว้างช่อง — ต่างจากจุดเส้นตายชัดเจน
    // อันที่ติดธง "สำคัญมาก" ระบายทั้งช่อง เพราะจุดประสงค์ของมันคือถูกเห็นตั้งแต่ยังไม่ตั้งใจมอง
    const md = marksOn(k);
    const bigOne = md.find(m => m.big);
    cells += `<button class="cal-c${k === todayK ? ' today' : ''}${k === pick ? ' on' : ''}${
      hot ? ' hot' : ''}${bigOne ? ' big sj-' + bigOne.color : ''}" onclick="calSelect('${k}')">
      ${md.length ? `<span class="cal-marks">${md.slice(0, 2).map(m =>
        `<i class="sj-${m.color}"></i>`).join('')}</span>` : ''}
      <b>${dd}</b>
      <span class="cal-dots">${dots}${list.length > 3 ? '<i class="cal-more">+</i>' : ''}</span>
      ${nCls ? '<span class="cal-sch"></span>' : ''}
    </button>`;
  }
  const rows = Math.ceil((first + len) / 7) * 7;
  for (let i = first + len; i < rows; i++) cells += '<span class="cal-c off"></span>';

  // แผ่นรายละเอียดของวันที่เลือก — ปฏิทินที่กดวันแล้วไม่มีอะไรขึ้นคือปฏิทินที่อ่านอย่างเดียว
  const [py, pm, pd] = pick.split('-').map(Number);
  const pDate = new Date(py, pm - 1, pd);
  const pList = (byDay[pick] || []).sort((a, b) => new Date(a.due) - new Date(b.due));
  const pBusy = tlMergeClasses(typeof busyBlocks === 'function' ? busyBlocks(pDate) : []);
  const pCls = pBusy.filter(b => b.kind === 'class');
  const nCls = pCls.reduce((a, b) => a + (b.parts ? b.parts.length : 1), 0);
  const isPast = pDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const pFree = !isPast && typeof freeMinutes === 'function'
    ? freeMinutes(pDate, pick === todayK ? now : null) : null;

  const pMarks = marksOn(pick);
  const markHtml = pMarks.map(m => `<button class="cal-m sj-${m.color}${m.big ? ' big' : ''}"
      onclick="calEditMark('${m.id}')">
      <span class="cal-m-bar"></span>
      <span class="cal-m-b"><b>${esc(m.title)}</b>
        <i>${esc(calCountdown(pick, now))}${m.big ? ' · สำคัญมาก' : ''}</i></span>
      ${icon('pencil')}
    </button>`).join('');

  const form = calEdit && calEdit.date === pick ? `<div class="cal-form">
      <input type="text" id="calMarkName" placeholder="เช่น สอบกลางภาค · วันกีฬาสี"
        value="${esc(calEdit.title)}" oninput="calEdit.title=this.value">
      <div class="cal-sw">${Array.from({ length: SUBJ_COLORS }, (_, i) => i + 1).map(c =>
        `<button type="button" class="sj-${c}${calEdit.color === c ? ' on' : ''}"
          onclick="calSetColor(${c})" aria-label="สี ${c}"></button>`).join('')}</div>
      <button type="button" class="cal-big${calEdit.big ? ' on' : ''}" onclick="calToggleBig()">
        ${icon('flag')}<span>สำคัญมาก — ระบายทั้งช่องในปฏิทิน</span>
        <i class="cal-big-x">${calEdit.big ? icon('check') : ''}</i></button>
      <p class="ctx-err" id="calMarkErr" hidden></p>
      <div class="cal-form-a">
        ${calEdit.id ? `<button class="btn ghost sm" onclick="calDeleteMark('${calEdit.id}')">ลบ</button>` : ''}
        <span style="flex:1"></span>
        <button class="btn ghost sm" onclick="calCancelMark()">ยกเลิก</button>
        <button class="btn sm" onclick="calSaveMark()">${calEdit.id ? 'บันทึก' : 'ปัก'}</button>
      </div>
    </div>` : `<button class="cal-add" onclick="calAddMark('${pick}')">+ ปักหมุดวันนี้</button>`;

  const detail = `<div class="cal-day">
      <div class="cal-day-h">
        <b>${pick === todayK ? 'วันนี้' : 'วัน' + THAI_DAY[pDate.getDay()]}</b>
        <i class="mono">${pDate.getDate()} ${MONTH_SHORT[pDate.getMonth()]}</i>
        ${pFree != null ? `<u>ว่าง ${esc(shortMin(pFree))}</u>` : ''}
      </div>
      ${markHtml}${form}
      ${nCls ? `<div class="cal-day-cls">${icon('calendar')}เรียน ${
        min2hm(Math.min(...pCls.map(b => b.from)))}–${min2hm(Math.max(...pCls.map(b => b.to)))
        } · ${nCls} คาบ</div>` : ''}
      ${pList.length ? pList.map(t => `<button class="cal-t" onclick="openForm('${t.id}')">
          <span class="sjbar ${subjClass(t.subject)}"></span>
          <span class="cal-t-b"><b>${taskTitle(t)}</b>
            <i>${esc(dueClock(t))} · ${esc(TASK_TYPES[taskType(t)].name)}</i></span>
          ${tkChip(fmtDue(t.due, now, t), dueTone(t, now))}
        </button>`).join('')
        : `<p class="cal-day-0">${isPast ? 'วันนี้ผ่านไปแล้ว'
          : nCls ? 'ไม่มีงานถึงกำหนดวันนี้' : 'ว่าง ไม่มีอะไรถึงกำหนด'}</p>`}
      ${calOffset(pick) >= 0 && calOffset(pick) <= 6
        ? `<button class="cal-go" onclick="calOpen('${pick}')">${icon('clock')}ดูรายชั่วโมง</button>` : ''}
    </div>`;

  const hint = (typeof ctxIsEmpty === 'function' && ctxIsEmpty())
    ? `<button class="tl-hint" onclick="go('scr-context')">
        ${icon('clock')}<span>ยังไม่รู้ตารางเรียน — เวลาว่างเป็นค่าเริ่มต้น</span>
        <b>บอกตาราง</b>${icon('chevron')}
      </button>` : '';

  return `<div class="page-head tight">
      <h1 class="page-title">ปฏิทิน</h1>
    </div>
    ${tlModeTabs()}${hint}
    <div class="calbar">
      <button onclick="calShift(-1)" aria-label="เดือนก่อน">${icon('chevron')}</button>
      <b>${MONTH_FULL[m]} ${y + 543}</b>
      <button onclick="calShift(1)" aria-label="เดือนถัดไป">${icon('chevron')}</button>
    </div>
    <div class="calwd">${['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
      .map(x => `<span>${x}</span>`).join('')}</div>
    <div class="calgrid">${cells}</div>
    ${detail}`;
}

function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el) return;
  const now = new Date();
  if (tlMode === 'cal') { tlItems = []; el.innerHTML = calHtml(now); return; }
  const day = addDays(now, tlDayOffset);
  const isToday = tlDayOffset === 0;
  const { items, plan } = tlDayItems(day, isToday, now);
  const run = runningWork();

  // แถบเลือกวัน — จุดใต้เลขคือจำนวนงานที่ถึงกำหนดวันนั้น สีตามใบที่ด่วนที่สุด
  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, i);
    const due = pendingTasks().filter(t => t.due && new Date(t.due).toDateString() === d.toDateString());
    const tone = due.reduce((a, t) => a === 'hot' ? a : (dueTone(t, now) || a), '');
    const lb = i === 0 ? 'วันนี้' : WEEKDAY_SHORT[d.getDay()].replace('.', '');
    return `<button class="ds${i === tlDayOffset ? ' on' : ''}" onclick="setTlDay(${i})">
      <i class="ds-d">${esc(lb)}</i><b class="ds-n">${d.getDate()}</b>
      ${due.length ? `<u class="ds-dot${tone ? ' ' + tone : ''}"></u>` : '<u class="ds-dot off"></u>'}
    </button>`;
  }).join('');

  // คำตัดสินบนสุด — สามสถานะ และสีเน้นเก็บไว้ให้เฉพาะตอนไม่ทันจริง
  let verdict = '';
  if (isToday && plan) {
    // งานที่ล้นออกจากวันนี้ไปเลย
    const missed = plan.overflow.filter(o => o.missed).map(o => o.task);
    // งานที่ "มีที่ในแผน" แต่ช่องที่ได้อยู่หลังเวลาส่งของตัวเอง — พลาดเหมือนกัน
    // เห็นได้เฉพาะตอนวางงานลงนาฬิกาจริง ซึ่งจอเก่าไม่เคยทำ เลยไม่เคยจับเคสนี้ได้
    for (const s of plan.slots) {
      if (s.break || !s.task.due) continue;
      if (s.end > new Date(s.task.due) && !missed.includes(s.task)) missed.push(s.task);
    }
    const left = plan.freeMin - plan.usedMin;
    if (missed.length) {
      const nf = plan.nextFree;
      // หัวบรรทัดบอก "กี่ใบ" ส่วนชื่องานเป็นรายละเอียดที่ตัดท้ายได้ — ของเดิมเอาชื่อทุกใบ
      // มาต่อกันเป็นย่อหน้า การ์ดเลยสูงจนดันเส้นเวลาตกจอไปทั้งเส้น ทั้งที่เส้นเวลาคือของหลักของจอนี้
      verdict = `<div class="dayvd bad">
        <div class="dayvd-h">${tkChip('ไม่ทัน', 'hot')}<b>${missed.length} งานเสี่ยงเลยกำหนดวันนี้</b></div>
        <p>${esc(missed.map(t => taskTitleText(t)).join(' · '))}${nf
          ? ' — ช่องว่างถัดไปคือ' + (nf.dayOffset === 1 ? 'พรุ่งนี้ ' : 'วัน' + THAI_DAY[nf.date.getDay()] + ' ') + nf.fromHm
          : ''}</p></div>`;
    } else if (plan.overflow.length || left < 30) {
      verdict = `<div class="dayvd warn">
        <div class="dayvd-h">${tkChip('แน่น', 'warm')}<b>ทันหมด แต่ไม่มีที่ให้พลาด</b></div>
        <p>เหลือช่องว่าง ${humanMin(Math.max(0, left))} ทั้งวัน${plan.overflow.length
          ? ' · อีก ' + plan.overflow.length + ' งานย้ายไปวันหลัง' : ''}</p></div>`;
    } else {
      verdict = `<div class="dayvd ok">
        <div class="dayvd-h">${tkChip('สบาย', 'ok')}<b>วันนี้ทันสบาย</b></div>
        <p>จัดงานลงครบแล้ว เหลือช่องว่างอีก ${humanMin(Math.max(0, left))}</p></div>`;
    }
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const rows = items.map((it, i) => {
    // ช่วงที่ยังไม่จบยังไม่ใช่อดีต — ถ้าวัดจากเวลาเริ่มอย่างเดียว ก้อนคาบเรียนทั้งวัน
    // จะจางทั้งก้อนตั้งแต่ 08:35 ทั้งที่ยังนั่งเรียนอยู่อีกหกชั่วโมง
    const past = isToday && (it.to != null ? it.to : it.min) < nowMin - 5;
    const hm = min2hm(it.min);

    if (it.kind === 'classes') {
      const names = [...new Set(it.parts.map(p => p.title))];
      return `<div class="dayrow${past ? ' past' : ''}" data-i="${i}" onclick="tlOpen(${i})">
        <span class="dayrow-t mono">${hm}</span>
        <span class="dayrow-dot"></span>
        <div class="dayblk">
          <div class="dayblk-h"><b>${esc(it.label)}</b>
            <span class="mono">ถึง ${min2hm(it.to)}</span></div>
          <p class="dayblk-p">${names.map(s =>
            `<span class="ctx-chip ${subjClass(s)}">${esc(s)}</span>`).join('')}</p>
        </div></div>`;
    }

    if (it.kind === 'work') {
      const mine = run && run.taskId === it.task.id;
      const focus = !past && !document.tlFocusUsed;
      if (focus) document.tlFocusUsed = 1;
      return `<div class="dayrow${past ? ' past' : ''}" data-i="${i}" onclick="tlOpen(${i})">
        <span class="dayrow-t mono">${hm}</span>
        <span class="dayrow-dot${focus ? ' on' : ''}"></span>
        <div class="tk${focus ? ' tk-focus' : ''} dayrow-card">
          ${it.task.subject && it.task.subject !== 'อื่น ๆ' ? `<div class="tk-sub">${esc(it.task.subject)}</div>` : ''}
          <div class="tk-ttl">${esc(it.task.detail || '')}</div>
          <div class="tk-meta">${tkChip(humanMin(it.mins), '')}
            ${it.note ? tkChip(it.note.replace(/^⚠ /, ''), 'hot') : ''}
            <span class="tk-sp"></span></div>
          ${focus ? `<button class="dayrow-go" onclick="event.stopPropagation();${mine
            ? 'stopWork()' : `startWork('${it.task.id}')`}">${icon('clock')}${
            mine ? 'หยุดจับเวลา' : 'เริ่มจับเวลา'}</button>` : ''}
        </div></div>`;
    }

    if (it.kind === 'due') {
      return `<div class="dayrow${past ? ' past' : ''}" data-i="${i}" onclick="tlOpen(${i})">
        <span class="dayrow-t mono">${hm}</span>
        <span class="dayrow-dot flag"></span>
        <span class="dayrow-due">${icon('flag')}ถึงกำหนด · ${esc(taskTitleText(it.task))}</span></div>`;
    }

    // เวลาเริ่มอยู่ในคอลัมน์ซ้ายแล้ว เขียนซ้ำในป้ายอีกรอบ ("18:00 กินข้าวเย็น 18:00–18:45")
    // คือตัวเลขสี่ก้อนในบรรทัดเดียวที่บอกเรื่องเดียว — เหลือไว้แค่ "แล้วเลิกกี่โมง"
    //
    // และของสองชนิดในเส้นนี้ไม่เท่ากัน: ธุระที่กินเวลาจริง (เรียน กิน เดินทาง) กับ
    // หมุดบอกช่วงวัน (ตื่น หยุดทำงาน เข้านอน) — ให้อย่างแรกเข้มกว่า ตาจะได้เกาะอะไรได้
    const solid = it.kind === 'busy';
    const extra = solid ? 'ถึง ' + min2hm(it.to) : '';
    return `<div class="dayrow${past ? ' past' : ''}" data-i="${i}" onclick="tlOpen(${i})">
      <span class="dayrow-t mono">${hm}</span>
      <span class="dayrow-dot"></span>
      <span class="dayrow-l${solid ? ' solid' : ''}">${esc(it.label)}${extra ? `<i>${extra}</i>` : ''}</span></div>`;
  }).join('');
  document.tlFocusUsed = 0;

  tlItems = items;

  const head = `<div class="page-head">
      <div class="eyebrow mono">${esc(fmtThaiDate(day))}</div>
      <h1 class="page-title">${isToday ? 'วันนี้' : 'วัน' + THAI_DAY[day.getDay()]}</h1>
      <p class="page-sub">${items.length ? esc(tlDaySub(day, isToday, now, plan)) : ''}</p>
    </div>
    ${tlModeTabs()}
    <div class="daystrip">${strip}</div>`;

  // คำชวนให้กรอกตารางเป็นข้อมูลประกอบ ไม่ใช่สิ่งที่ต้องทำตอนนี้ — เดิมเป็นการ์ดกรอบฟ้าสามบรรทัด
  // ยืนแข่งกับคำตัดสินของวันอยู่เหนือเส้นเวลา สองก้อนรวมกันกินจอจนไม่เหลือที่ให้เส้นเวลาเลย
  // ย่อเป็นบรรทัดเดียวใต้คำตัดสิน: ยังกดได้ ยังบอกครบ แต่ไม่แย่งสายตา
  const ctxNudge = (typeof ctxIsEmpty === 'function' && ctxIsEmpty())
    ? `<button class="tl-hint" onclick="go('scr-context')">
        ${icon('clock')}<span>ยังไม่รู้ตารางเรียน — เวลานี้ยังเป็นการเดา</span>
        <b>บอกตาราง</b>${icon('chevron')}
      </button>` : '';

  const future = !isToday
    ? `<p class="tl-far">แผนรายชั่วโมงมีเฉพาะวันนี้ — วันอื่นแสดงตารางเรียนกับกำหนดส่งไว้ก่อน</p>` : '';

  // หมุดของวันนั้นอยู่เหนือเส้น ไม่ใช่ในเส้น เพราะมันไม่มีเวลาของตัวเอง
  // ยัดลงเส้นต้องสมมติเวลาให้มัน ซึ่งเป็นการโกหกว่า "สอบกลางภาค 08:00"
  const dayMarks = marksOn(calKey(day)).map(m => `<div class="tl-mark sj-${m.color}${m.big ? ' big' : ''}">
      <span class="cal-m-bar"></span><b>${esc(m.title)}</b>
      <i>${esc(calCountdown(calKey(day), now))}</i></div>`).join('');

  el.innerHTML = head + dayMarks + verdict + ctxNudge
    + (items.length ? `<div class="dayrail">${rows}</div>` : `<div class="card empty">วันนี้ยังไม่มีอะไรในตาราง</div>`)
    + future;
}

function tlDaySub(day, isToday, now, plan) {
  const p = typeof ctxPrefs === 'function' ? ctxPrefs() : {};
  const free = typeof freeMinutes === 'function' ? freeMinutes(day, isToday ? now : null) : 0;
  const bits = ['ตื่น ' + (p.wake || '—'), 'นอน ' + (p.sleep || '—')];
  bits.push(isToday ? 'ว่างอีก ' + humanMin(free) : 'ว่าง ' + humanMin(free));
  return bits.join(' · ');
}

// ---------- แผ่นรายละเอียด ----------
let tlItems = [];
function tlClose() { const s = document.getElementById('tlSheet'); if (s) { s.hidden = true; s.innerHTML = ''; } }

function tlOpen(i) {
  const it = tlItems[i];
  const wrap = document.getElementById('tlSheet');
  if (!it || !wrap) return;
  const now = new Date();
  let tag = '', h = '', chips = [], why = '', cta = '';

  if (it.kind === 'work' || it.kind === 'due') {
    const t = it.task, info = priorityInfo(t, now);
    tag = (t.subject && t.subject !== 'อื่น ๆ' ? t.subject : TASK_TYPES[taskType(t)].name)
      + (t.teacher ? ' · ' + t.teacher : '');
    h = t.detail || '';
    chips = [[fmtDue(t.due, now, t), dueTone(t, now)],
      [humanMin(remainingMin(t)), ''],
      t.scorePct != null ? ['คะแนน ' + t.scorePct + '%', ''] : null].filter(Boolean);
    why = info.reasons.length ? ['ทำไมอันดับนี้', info.reasons.slice(0, 3).join(' · ')] : '';
    cta = `<button class="daysheet-go" onclick="tlClose();openForm('${t.id}')">${icon('pencil')}เปิดงานนี้</button>`;
  } else if (it.kind === 'busy') {
    tag = it.ck === 'class' ? 'ตารางเรียน' : 'กิจวัตร';
    h = it.label;
    chips = [[min2hm(it.from) + '–' + min2hm(it.to), ''], [humanMin(it.to - it.from), '']];
    // งานที่เกิดจากวิชานี้ — โยงคาบเรียนกลับไปหางานที่ครูสั่งในคาบนั้น
    const rel = pendingTasks().filter(t => t.subject && it.label && t.subject === it.label);
    why = rel.length
      ? ['งานจากวิชานี้', rel.map(t => taskTitleText(t) + ' · ' + fmtDue(t.due, now, t)).join('\n')]
      : ['ทำไมไม่มีงานตรงนี้', 'ช่วงนี้ถูกกันไว้เป็นเวลาที่ทำงานไม่ได้ ระบบจะไม่วางงานทับ'];
    cta = `<button class="daysheet-go" onclick="tlClose();go('scr-context')">${icon('clock')}แก้ตารางนี้</button>`;
  } else if (it.kind === 'classes') {
    // ก้อนนี้ย่อคาบเรียนทั้งวันไว้แถวเดียว รายคาบจึงต้องกางครบตรงนี้ ไม่งั้นคือการซ่อน
    tag = 'ตารางเรียน';
    h = it.label;
    chips = [[min2hm(it.from) + '–' + min2hm(it.to), ''], [humanMin(it.to - it.from), '']];
    why = ['คาบในช่วงนี้',
      it.parts.map(b => min2hm(b.from) + '–' + min2hm(b.to) + '  ' + b.title).join('\n')];
    cta = `<button class="daysheet-go" onclick="tlClose();go('scr-context')">${icon('clock')}แก้ตารางนี้</button>`;
  } else if (it.kind === 'break') {
    tag = 'พักอัตโนมัติ'; h = it.label;
    chips = [[humanMin(it.mins), '']];
    why = ['ทำไมมีช่วงนี้', 'ทำติดกันเกิน ' + (ctxPrefs().maxRunMin || 50) + ' นาที ระบบแทรกพักให้เอง'];
  } else {
    const p = ctxPrefs();
    tag = 'เวลาประจำวัน'; h = it.label;
    chips = [[min2hm(it.min), '']];
    why = it.kind === 'stop'
      ? ['ทำไมต้องหยุด', 'ชั่วโมงก่อนนอนถูกกันไว้เป็นเวลาของคุณ ระบบจะไม่วางงานทับ']
      : ['ตั้งค่าที่ไหน', 'แก้เวลาตื่นกับเวลานอนได้ในแท็บ “ฉัน” → ตารางเรียนและเวลาว่าง'];
    cta = `<button class="daysheet-go" onclick="tlClose();go('scr-context')">${icon('clock')}แก้เวลา</button>`;
  }

  wrap.innerHTML = `<div class="daysheet-back" onclick="tlClose()"></div>
    <div class="daysheet">
      <span class="daysheet-grip"></span>
      <div class="daysheet-tag">${esc(tag)}</div>
      <div class="daysheet-h">${esc(h)}</div>
      <div class="daysheet-chips">${chips.map(c => tkChip(c[0], c[1])).join('')}</div>
      ${why ? `<div class="daysheet-why"><b>${esc(why[0])}</b><p>${esc(why[1])}</p></div>` : ''}
      <div class="daysheet-act">${cta}
        <button class="daysheet-go ghost" onclick="tlClose()">ปิด</button></div>
    </div>`;
  wrap.hidden = false;
}

// ขยับหมุด "ตอนนี้" ตามเวลาจริง โดยไม่ต้องวาดทั้งจอใหม่
// (เรียกจาก tickClock ทุก 30 วินาที)
function syncTimelineNow() {
  const mark = document.getElementById('tlNow');
  if (!mark) return;
  const bar = mark.parentElement;
  const gone = bar && bar.querySelector('.gone');
  const win = tlWindow([]);
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  const p = Math.max(0, Math.min(100, ((m - win.from) / (win.to - win.from)) * 100));
  mark.style.left = p + '%';
  if (gone) gone.style.width = p + '%';
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
  // อ่านแผนก้อนเดียวกับหน้าแรก — ห้ามเรียก buildDayPlan เองที่นี่
  // สองจอนี้พูดถึงเย็นวันเดียวกัน ถ้าคิดคนละรอบก็มีสิทธิ์ได้คนละคำตอบ (เผื่อเวลา · โควตาต่อวัน
  // · งานที่ถูกพักไว้ ล้วนอยู่ในชั้น planner ไม่ใช่ใน buildDayPlan)
  const plan = todayPlan(now).plan;
  const win = plan.windows;
  // หน่วยต้องเป็นนาทีเมื่อต่ำกว่าหนึ่งชั่วโมง — "ว่างอีก 0.3 ชม." ไม่มีใครแปลงในหัวทัน
  // และ 1.8 ชม. ก็ไม่ได้ช่วยกว่า "1 ชม. 48 นาที" สักเท่าไหร่ (humanMin ทำให้แล้วทั้งสองแบบ)
  sub.textContent = win.mode === 'none'
    ? 'วันนี้หมดเวลาแล้ว — แผนนี้กันไว้ให้พรุ่งนี้เช้า'
    : `ว่างอีก ${humanMin(win.windowMin)}` +
      (win.capped ? ` · ตั้งเพดานไว้ ${humanMin(win.capMin)}` : '') +
      ` · จัดให้แล้ว ${humanMin(plan.usedMin)}`;

  let html = '';

  // ยังไม่รู้จักตารางของเขา = แผนทุกใบข้างล่างนี้ตั้งอยู่บนการเดา ต้องบอกให้รู้ตัว
  // และบอกตรงจุดที่เขากำลังมองแผนอยู่พอดี ไม่ใช่ซ่อนไว้ในหน้าตั้งค่าที่ไม่มีใครเปิด
  if (win.mode === 'default') {
    html += `<button class="pctx-nudge" onclick="go('scr-context')">
      <span class="pn-ic">${icon('clock')}</span>
      <span class="pn-tx">
        <b>ตอนนี้ AI เดาว่าคุณเริ่มทำการบ้าน 19:00</b>
        <span>บอกตารางเรียนกับกิจวัตรสักครั้ง แล้วแผนจะวางลงช่องว่างจริงของคุณ — ว่างบ่ายก็ได้เริ่มบ่าย</span>
      </span>
      <span class="pn-go">${icon('chevron')}</span>
    </button>`;
  } else if (win.mode === 'late') {
    html += `<div class="pctx-note">${icon('clock')}เลย ${esc(ctxPrefs().noWorkAfter)} น. มาแล้ว —
      นี่คือเวลาที่ยืมมาจากการนอน ทำเท่าที่จำเป็นพอ</div>`;
  }

  for (const e of plan.events) {
    html += `<div class="pslot">
      <div class="ptime"><span class="s">${fmtClock(new Date(e.due))}</span></div>
      <div class="brk">${icon('calendar')}${esc(taskTitle(e))}</div>
    </div>`;
  }
  // หัวช่วง: บอกว่าก้อนงานข้างล่างนี้อยู่ในช่องว่างไหนของวัน
  // มีมากกว่าหนึ่งช่วงเมื่อไหร่ ผู้ใช้ต้องเห็นทันทีว่าอะไรทำก่อนเลิกเรียน อะไรทำหลังกินข้าว
  const multi = win.slots.length > 1;
  let wi = -1;
  for (const s of plan.slots) {
    if (multi) {
      const inWin = win.slots.findIndex(w =>
        s.start.getHours() * 60 + s.start.getMinutes() >= w.from &&
        s.start.getHours() * 60 + s.start.getMinutes() < w.to);
      if (inWin !== -1 && inWin !== wi) {
        wi = inWin;
        const w = win.slots[inWin];
        html += `<div class="pwin"><span class="mono">${w.fromHm}–${w.toHm}</span>
          <i></i><span class="pw-min">ว่าง ${w.min} นาที</span></div>`;
      }
    }
    if (s.break) {
      html += `<div class="pslot">
        <div class="ptime"><span class="s">${fmtClock(s.start)}</span></div>
        <div class="brk">${icon('clock')}พัก ${s.min} นาที</div>
      </div>`;
    } else {
      const info = priorityInfo(s.task, now);
      const lv = info.stars >= 5 ? 'lv5' : info.stars >= 4 ? 'lv4' : '';
      // แผนบอกว่า "ควรใช้กี่นาที" — บรรทัดนี้บอกว่า "ใช้ไปจริงแล้วกี่นาที"
      // สองตัวเลขอยู่ติดกันคือทั้งหมดที่ต้องมี ไม่ต้องอธิบายอะไรเพิ่ม
      const did = workedMin(s.task.id);
      const run = runningWork();
      const mine = run && run.taskId === s.task.id;
      const busy = run && !mine;
      html += `<div class="pslot">
        <div class="ptime"><span class="s">${fmtClock(s.start)}</span><span class="e">${fmtClock(s.end)}</span></div>
        <div class="work ${lv}${mine ? ' running' : ''}">
          <div class="tm">
            <span class="nbadge ${lv}">${esc(priorityLabel(info.stars))}</span>
            <span class="ndue">${s.min} นาที${did ? ` · ทำไปแล้ว ${did}` : ''}</span>
          </div>
          <div class="tt">${taskTitle(s.task)}</div>
          ${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}
          <button class="wk-go${mine ? ' on' : ''}" ${busy ? 'disabled' : ''}
            onclick="${mine ? 'stopWork()' : `startWork('${s.task.id}')`}">
            ${icon(mine ? 'check' : 'clock')}${mine ? 'หยุดจับเวลา' : busy ? 'จับเวลางานอื่นอยู่' : 'เริ่มจับเวลา'}
          </button>
        </div>
      </div>`;
    }
  }
  // "วางไม่ลงวันนี้" มีสองความหมายที่ต่างกันคนละเรื่อง และเคยถูกเขียนรวมเป็นก้อนเดียว
  //   ย้ายได้จริง  — พรุ่งนี้ยังมีเวลาพอ ไม่ต้องตกใจ
  //   ย้ายไม่ได้   — ไม่มีช่องว่างวันไหนเหลือก่อนกำหนดส่งแล้ว นี่คือการพลาดส่ง ต้องตะโกน
  // เขียนรวมกันคือการบอกข่าวร้ายด้วยน้ำเสียงของข่าวธรรมดา
  const missed = plan.overflow.filter(o => o.missed);
  const movable = plan.overflow.filter(o => !o.missed);

  if (missed.length) {
    const nf = plan.nextFree;
    // เขียนให้เป็นข้อเท็จจริงเรียบ ๆ ว่าช่องว่างถัดไปอยู่ตรงไหน แล้วปล่อยให้ตัวเลขพูดเอง
    // ช่องว่างถัดไปอาจเป็นหกโมงเช้าหรือสี่โมงเย็นก็ได้ สำนวนที่แปลว่า "สายไปแล้ว" จึงใช้ไม่ได้ทุกกรณี
    const when = nf
      ? 'ช่องว่างถัดไปคือ' +
        (nf.dayOffset === 1 ? 'พรุ่งนี้ ' : 'วัน' + THAI_DAY[nf.date.getDay()] + ' ') + nf.fromHm
      : 'ไม่เหลือช่องว่างก่อนกำหนดส่งอีกแล้ว';
    html += `<div class="povf danger">
      <div class="povf-head">${icon('clock')}<span>ทำไม่ทันถ้าไม่ทำวันนี้</span></div>
      <div class="povf-why">${esc(when)} — ${missed.length > 1 ? 'งานพวกนี้' : 'งานนี้'}เลยกำหนดส่งไปก่อนถึงตอนนั้น</div>
      ${missed.map(o => `<div class="it">
        <div class="tt">${taskTitle(o.task)}</div>
        <div class="ln">ยังต้องใช้ ~${o.need} นาที · ${esc(fmtDue(o.task.due, now, o.task))}</div>
      </div>`).join('')}
      <div class="povf-tip">ทำเท่าที่ทำได้คืนนี้ · ขยับเวลานอนในแท็บ “ฉัน” · หรือบอกครูตั้งแต่ตอนนี้</div>
    </div>`;
  }
  if (movable.length) {
    html += `<div class="povf">
      <div class="povf-head">${icon('clock')}<span>เวลาวันนี้ไม่พอ — ย้ายไปวันหลังได้</span></div>
      ${movable.map(o => `<div class="it">
        <div class="tt">${taskTitle(o.task)}</div>
        <div class="ln">ต้องใช้ ~${o.need} นาที · ${esc(fmtDue(o.task.due, now, o.task))}</div>
      </div>`).join('')}
    </div>`;
  }
  if (!plan.slots.length && !plan.events.length) {
    // มีงานค้างอยู่แต่วางไม่ลง ≠ ไม่มีอะไรต้องทำ — สองอย่างนี้พูดสลับกันไม่ได้เด็ดขาด
    html += missed.length
      ? `<div class="card empty">วันนี้ไม่เหลือช่องว่างให้วางงานแล้ว —
           แต่งานข้างบนรอถึงพรุ่งนี้ไม่ได้ ดูว่าพอยืมเวลาจากตรงไหนได้บ้าง</div>`
      : plan.overflow.length
        ? `<div class="card empty">วันนี้ไม่เหลือช่องว่างให้วางงานแล้ว —
             งานข้างบนถูกกันไว้ให้พรุ่งนี้เช้าเรียบร้อย</div>`
        : `<div class="card empty">วันนี้ไม่มีอะไรต้องนั่งทำ — พักได้เต็มที่ 🎉</div>`;
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
  const sub = currentUser ? (currentUser.email || 'ซิงก์ข้ามเครื่องอยู่') : 'ยังไม่ล็อกอิน — ข้อมูลอยู่ในเครื่องนี้';
  set('pfNm', name);
  set('pfSb', sub);
  // การ์ดตัวตนบนหัวจอตั้งค่า — ข้อมูลชุดเดียวกับหน้า "ฉัน" ต้องไม่มีทางขัดกันเอง
  set('setNm', name);
  set('setSb', sub);
  const sav = document.getElementById('setAv');
  if (sav) sav.innerHTML = (mine || pic)
    ? `<img src="${esc(mine || pic)}" alt="">`
    : esc(name.trim().charAt(0).toUpperCase() || 'N');
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
  // ห้องของฉัน — บอกว่ามีของวางอยู่กี่ชิ้นแล้ว ห้องเปล่ากับห้องที่แต่งแล้วต้องอ่านต่างกัน
  const pr = document.getElementById('peRoomCt');
  if (pr && typeof roomState === 'function') {
    const rs = roomState();
    const put = Object.keys(rs.on).filter(k => rs.on[k] && rs.on[k] !== 'none').length;
    pr.textContent = rs.name || (put ? 'วางของไว้ ' + put + ' ชิ้น' : 'ยังไม่ได้แต่งเลย');
  }
  const ps = document.getElementById('peShopCt');
  if (ps) {
    const st = loginStreak();
    ps.textContent = tokenBalance() + ' โทเคน'
      + (st > 1 ? ' · เปิดติดกัน ' + st + ' วัน' : '');
  }
  const ver = document.getElementById('appVer');
  if (ver) ver.textContent = 'StudentOS Version ' + APP_VERSION + ' “' + APP_CODENAME + '”';
  const pn = document.getElementById('pName'); if (pn) pn.value = state.settings.name || '';
  const pf = document.getElementById('pFree'); if (pf) pf.value = state.settings.freeHours || 2;

  // การแจ้งเตือน
  const st = document.getElementById('notifStatus');
  const nb = document.getElementById('notifBtn');
  const ntest = document.getElementById('notifTest');
  // ปุ่มทดสอบโผล่เฉพาะตอนอนุญาตแล้ว — ให้กดพิสูจน์ได้ว่าเด้งจริงบนเครื่องนี้
  if (ntest) ntest.style.display =
    ('Notification' in window && Notification.permission === 'granted') ? 'block' : 'none';
  renderNotifPrefs();
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

// ---------- บริบทของฉัน (ตารางเรียน · กิจวัตร · เวลานอน) ----------
// จอนี้มีหน้าที่เดียว: ทำให้ "ว่างวันละ 2 ชม." ที่ผู้ใช้เคยเดาเอง กลายเป็นช่วงเวลาจริง
// การ์ดบนสุดจึงเป็นผลลัพธ์ ไม่ใช่ฟอร์ม — แก้อะไรก็เห็นผลเลื่อนทันทีในการ์ดนั้น
// ถ้าไม่โชว์ผล ผู้ใช้จะไม่มีทางรู้ว่ากรอกไปแล้วแอปเอาไปทำอะไร แล้วก็จะไม่กรอก

const WD_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const CTX_KINDS = {
  meal:     { name: 'กินข้าว',   icon: 'clock' },
  travel:   { name: 'เดินทาง',   icon: 'pin' },
  activity: { name: 'กิจกรรม',   icon: 'flag' },
  study:    { name: 'เรียนพิเศษ', icon: 'book' },
  other:    { name: 'อื่น ๆ',    icon: 'clock' },
};

// วันที่กำลังแก้อยู่ในฟอร์มเพิ่มรายการ — null = ฟอร์มปิดอยู่
let ctxEditing = null;

function ctxDayLabel(item) {
  if (item.weekday == null) return 'ทุกวัน';
  const list = Array.isArray(item.weekday) ? item.weekday : [item.weekday];
  if (list.length === 7) return 'ทุกวัน';
  if (list.length === 5 && [1,2,3,4,5].every(d => list.includes(d))) return 'จ–ศ';
  if (list.length === 2 && list.includes(0) && list.includes(6)) return 'ส–อา';
  return list.slice().sort().map(d => WD_SHORT[d]).join(' ');
}

function ctxHours(min) {
  if (min <= 0) return '0 นาที';
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? h + ' ชม.' : '') + (h && m ? ' ' : '') + (m ? m + ' นาที' : '');
}

function renderContext() {
  const body = document.getElementById('ctxBody');
  if (!body || typeof freeSlots !== 'function') return;
  const now = new Date();
  const p = ctxPrefs();
  const slots = freeSlots(now, now);
  const total = slots.reduce((s, x) => s + x.min, 0);

  // ทางเข้าบริบทในหน้าโปรไฟล์ — มีสองหน้าตา ตามว่ากรอกไปหรือยัง (1A9g)
  //
  // กรอกแล้ว  → แถวแรกของรายการ พร้อมป้ายว่ากรอกอะไรไปบ้าง
  // ยังไม่กรอก → ซ่อนแถวนั้น แล้วขึ้นคำชวนหนึ่งบรรทัดเหนือบล็อกผลของฉัน
  //
  // ใช้ .tl-hint ตัวเดียวกับที่เส้นเวลาใช้ — ไม่มีกรอบ ไม่มีพื้นสี สูงแค่บรรทัดเดียว
  // ของหลักในจอนี้คือกราฟกับตัวเลข คำชวนที่ดังกว่าของหลัก คือคำชวนที่แย่งที่ของเขา
  // เกณฑ์คือ "รู้จักครบหรือยัง" ไม่ใช่ "ว่างเปล่าไหม" (1A9h)
  // หน้าทำความรู้จักตอนสมัครใส่วันหยาบ ๆ ให้อยู่แล้ว ctxIsEmpty() จึงเป็นเท็จตั้งแต่วันแรก
  // ใช้เกณฑ์เดิมคำชวนก็แทบไม่เคยขึ้น ทั้งที่แอปยังไม่รู้อะไรเกี่ยวกับเขาเลย
  const know = ctxKnow();
  const hero = document.getElementById('ctxHero');
  const row  = document.getElementById('peCtx');
  const ct   = document.getElementById('peCtxCt');

  if (ct) {
    ct.textContent = know >= 100
      ? ctxClasses().length + ' คาบเรียน · ' + ctxRoutines().length + ' กิจวัตร'
      : 'รู้จักคุณแล้ว ' + know + '% — ตอบเพิ่มได้';
  }
  if (row) row.hidden = false;
  if (hero) {
    hero.innerHTML = know >= 100 ? '' : `<button class="tl-hint pf-hint" onclick="wizOpen()">
      ${icon('clock')}<span>${know ? 'รู้จักคุณแล้ว ' + know + '%' : 'ยังไม่รู้ตารางชีวิต'} — AI เดาเวลาว่างอยู่</span>
      <b>${know ? 'ตอบต่อ' : 'ตั้งเลย'}</b>${icon('chevron')}
    </button>`;
  }

  const gaps = ctxGaps();
  const missing = gaps.filter(g => !g.done);

  body.innerHTML = `
    <!-- ผลลัพธ์มาก่อนฟอร์มเสมอ — และผลลัพธ์ที่อ่านง่ายที่สุดคือรูปวันของเขาเอง (1A9h)
         ตัวเลข "ว่าง 2 ชม." ตอบไม่ได้ว่าสองชั่วโมงนั้นอยู่ก่อนหรือหลังข้าวเย็น -->
    ${ctxBarHtml(ctxBarDay)}

    <!-- แถบรู้จัก — จอนี้เคยเปิดมาเจอฟอร์มเปล่าที่ไม่บอกว่าต้องกรอกอะไรถึงจะพอ
         ตอนนี้บอกตรง ๆ ว่ายังไม่รู้อะไร และรู้แล้วจะเอาไปทำอะไร -->
    <section class="ctx-know">
      <div class="ck-h"><span>รู้จักคุณแล้ว ${ctxKnow()}%</span>
        <b class="mono">${gaps.length - missing.length}/${gaps.length}</b></div>
      <div class="ck-bar"><span style="width:${ctxKnow()}%"></span></div>
      ${missing.length ? `<div class="ck-list">${missing.map(g => `<div class="ck-gap">
        <span class="ck-dot"></span>
        <span class="ck-tx"><b>${esc(g.label)}</b><i>${esc(g.why)}</i></span>
      </div>`).join('')}</div>
      <button class="btn sm ck-go" onclick="wizOpen()">${icon('sparkles')}ตอบให้ครบใน 1 นาที</button>`
      : `<p class="ck-done">${icon('check')}ครบแล้ว — ตารางที่ AI วางให้อ้างจากวันจริงของคุณทั้งหมด</p>`}
    </section>

    ${ctxLearnHtml()}

    <div class="ctx-sum">
      <div class="ctx-sum-h">${icon('clock')}<span>เหลือเวลาว่างวันนี้</span></div>
      <div class="ctx-sum-v">${esc(ctxHours(total))}</div>
      <div class="ctx-slots">
        ${slots.length
          ? slots.map(s => `<span class="ctx-slot mono">${s.fromHm}–${s.toHm}</span>`).join('')
          : `<span class="ctx-none">วันนี้ไม่เหลือช่องว่างแล้ว — พรุ่งนี้เริ่มใหม่</span>`}
      </div>
      <p class="ctx-sum-p">นับจากตอนนี้ถึง ${esc(p.noWorkAfter)} น. หักเวลาเรียนกับกิจวัตรออกแล้ว
        ช่องที่สั้นกว่า ${p.minBlockMin} นาทีไม่ถูกนับ</p>
    </div>

    <!-- กรอกตารางเรียนทีละคาบคือการพิมพ์ 30–40 ครั้ง ซึ่งเกือบไม่มีใครทำจนจบ
         ทางลัดจึงต้องอยู่เหนือฟอร์ม ไม่ใช่ซ่อนไว้ท้ายจอหลังของที่มันมาแทน -->
    <button class="ctx-scan" onclick="openTtScan()">
      <span class="cs-ic">${icon('camera')}</span>
      <span class="cs-tx"><b>ถ่ายรูปตารางเรียน แล้วให้ AI กรอกให้</b>
        <span>อ่านทั้งสัปดาห์ในทีเดียว — ตรวจแก้ได้ก่อนบันทึกทุกคาบ</span></span>
      <span class="cs-go">${icon('chevron')}</span>
    </button>

    <div class="sec-label">เวลาประจำวัน</div>
    <div class="pf-list">
      <div class="pf-row">
        <span class="tile">${icon('clock')}</span>
        <span class="bd"><span class="lb">ตื่น</span></span>
        <input type="time" value="${esc(p.wake)}" onchange="ctxSavePref('wake', this.value)">
      </div>
      <div class="pf-row">
        <span class="tile">${icon('clock')}</span>
        <span class="bd"><span class="lb">เข้านอน</span></span>
        <input type="time" value="${esc(p.sleep)}" onchange="ctxSavePref('sleep', this.value)">
      </div>
      <div class="pf-row">
        <span class="tile">${icon('lock')}</span>
        <span class="bd"><span class="lb">ห้ามวางงานหลัง</span>
          <span class="sb">ช่วงก่อนนอนเป็นเวลาของคุณ ไม่ใช่เวลาที่เหลือให้แอปใช้</span></span>
        <input type="time" value="${esc(p.noWorkAfter)}" onchange="ctxSavePref('noWorkAfter', this.value)">
      </div>
    </div>

    <div class="sec-label">ตารางเรียน</div>
    ${ctxWeekHtml()}

    <div class="sec-label">กิจวัตรและกิจกรรม</div>
    ${ctxListHtml('routine')}

    <button class="ctx-wipe" onclick="ctxWipe()">${icon('trash')}ลบบริบททั้งหมด</button>
    <p class="ctx-note">ข้อมูลชุดนี้อยู่คนละที่กับงานของคุณ ลบทิ้งได้โดยงานไม่หายสักใบ ·
      การจัดตารางคำนวณในเครื่อง ไม่มีการส่งตารางชีวิตของคุณออกไปไหน</p>`;
}

// ---------- แท่ง "วันของคุณ" ----------
// ตัวเลข "ว่าง 2 ชม. 10 นาที" ไม่บอกว่าสองชั่วโมงนั้นอยู่ตรงไหนของวัน
// คนที่เห็นแค่ตัวเลขจึงยังวางแผนไม่ได้ ต้องเห็นว่ามันอยู่ก่อนหรือหลังข้าวเย็น
//
// นี่คือของที่เขาได้กลับไปจากการกรอก — ไม่ใช่คำว่า "บันทึกแล้ว"
// จอที่ขอข้อมูลแล้วไม่คืนอะไรให้ดู คือจอที่คนกรอกครั้งเดียวแล้วไม่กลับมาอีก
const WD_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];

function ctxBarHtml(weekday, opts = {}) {
  const bar = ctxDayBar(weekday);
  const span = Math.max(1, bar.to - bar.from);
  if (!bar.blocks.length) return '';

  // ก้อนที่แคบกว่า ~9% ของแท่งใส่ตัวหนังสือไม่ลง — ปล่อยว่างดีกว่าโชว์ตัวอักษรครึ่งตัว
  const seg = bar.blocks.map(b => {
    const pct = b.min / span * 100;
    const txt = pct >= 9 ? (b.kind === 'busy' ? esc(b.title) : ctxHours(b.min)) : '';
    // ก้อนส่วนใหญ่แคบเกินกว่าจะใส่ตัวหนังสือ สีจึงต้องเป็นตัวบอกแทนว่าอะไรอยู่ตรงไหน
    // ไม่งั้นแท่งจะเป็นแถวสี่เหลี่ยมเทาเปล่า ๆ ที่ไม่ได้บอกอะไรมากกว่าตัวเลขบรรทัดล่าง
    const of = b.kind === 'busy' ? ` cb-of-${b.of === 'class' ? 'class' : (CTX_KINDS[b.of] ? b.of : 'other')}` : '';
    return `<i class="cb-${b.kind}${of}" style="flex:${b.min}"
      title="${esc(min2hm(b.from))}–${esc(min2hm(b.to))} ${esc(b.title || '')}">${txt}</i>`;
  }).join('');

  const first = bar.blocks.find(b => b.kind === 'free');
  return `<section class="ctx-bar">
    <div class="cb-h">${icon('clock')}<span>วัน${WD_FULL[weekday]}ของคุณ</span>
      ${opts.pick === false ? '' : `<select class="cb-pick" onchange="ctxPickDay(this.value)">
        ${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}"${d === weekday ? ' selected' : ''}>วัน${WD_FULL[d]}</option>`).join('')}
      </select>`}
    </div>
    <div class="cb-bar">${seg}</div>
    <div class="cb-axis mono"><span>${esc(min2hm(bar.from))}</span><span>${esc(min2hm(bar.to))}</span></div>
    <p class="cb-p">${bar.freeMin
      ? `เหลือ <b>${esc(ctxHours(bar.freeMin))}</b> ที่วางงานได้จริง${first
          ? ` · เริ่มได้ตั้งแต่ ${esc(min2hm(first.from))}` : ''}`
      : 'วันนี้เต็มทั้งวัน — งานจะถูกย้ายไปวันอื่นให้'}</p>
  </section>`;
}

// วันที่แท่งกำลังโชว์อยู่ — เริ่มที่วันนี้ เพราะคนเปิดมาถามถึงวันนี้ก่อนเสมอ
let ctxBarDay = new Date().getDay();
function ctxPickDay(d) { ctxBarDay = +d; renderContext(); }

// ---------- ตัวช่วยทำความรู้จักวันของเขา ----------
// ห้าขั้น แต่ละขั้นตอบด้วยการแตะ ไม่ต้องพิมพ์สักตัวจนถึงขั้นสุดท้าย
// การพิมพ์บนมือถือคือจุดที่คนเลิกกลางคัน — ทุกอย่างที่เดาแทนได้ต้องเดาไปก่อน
const WIZ_LAST = 5;
const WIZ_OUT = ['15:00', '15:30', '16:00', '16:30', '17:00', '18:00'];
// ของที่พบบ่อยพอจะขึ้นเป็นชิป — ที่เหลือผู้ใช้พิมพ์เองได้ในจอบริบท
// เดาเวลาให้ทุกอันแล้ว เพราะชิปที่เลือกแล้วต้องกรอกเวลาต่อ คือชิปที่ไม่ได้ช่วยอะไร
// slot บอกว่ากิจกรรมนั้นเกาะอยู่กับหมุดไหนของวัน — ซ้อมกีฬาต่อท้ายคาบเรียนเลย
// ส่วนดูซีรีส์อยู่หลังข้าวเย็น สองอย่างนี้วางที่เดียวกันไม่ได้
const WIZ_CHIPS = [
  { key: 'sport', title: 'ซ้อมกีฬา',        kind: 'activity', slot: 'school',  min: 90 },
  { key: 'tutor', title: 'เรียนพิเศษ',      kind: 'study',    slot: 'school',  min: 90 },
  { key: 'family', title: 'ช่วยงานบ้าน ดูแลน้อง', kind: 'other', slot: 'evening', min: 45 },
  { key: 'friend', title: 'ติวกับเพื่อน',    kind: 'study',    slot: 'evening', min: 60 },
  { key: 'music', title: 'ดนตรี',           kind: 'activity', slot: 'evening', min: 60 },
  { key: 'gym',   title: 'ออกกำลังกาย',     kind: 'activity', slot: 'evening', min: 45 },
  { key: 'work',  title: 'ทำงานพิเศษ',      kind: 'activity', slot: 'evening', min: 120 },
  { key: 'screen', title: 'ดูซีรีส์ เล่นเกม', kind: 'other',    slot: 'evening', min: 60 },
];

let wiz = null;

function wizOpen() {
  const span = ctxSchoolSpan();
  wiz = {
    step: 1,
    // ถ้ามีตารางเรียนอยู่แล้ว เอาเวลาจริงมาตั้งต้น ไม่ต้องให้เขาตอบซ้ำของที่บอกไปแล้ว
    inHm: span ? span.fromHm : '08:00',
    outHm: span ? span.toHm : '16:00',
    drop: {},        // กิจวัตรที่เดามาแล้วเขาบอกว่าไม่ใช่
    edit: {},        // เวลาที่เขาแก้จากที่เดาไว้
    picks: {},       // ชิปที่เลือกเพิ่ม → { start, end, days }
  };
  go('scr-ctxwiz');
  renderCtxWiz();
}

function wizClose() { wiz = null; go('scr-context'); }

function wizGo(n) {
  if (!wiz) return;
  // ข้ามขั้น "เวลาของที่เลือกเพิ่ม" ถ้าไม่ได้เลือกอะไรเลย — จอเปล่าที่ต้องกดผ่านคือจอที่ไม่ควรมี
  if (n === 4 && !Object.keys(wiz.picks).length) n = wiz.step < 4 ? 5 : 3;
  wiz.step = Math.max(1, Math.min(WIZ_LAST, n));
  if (wiz.step === WIZ_LAST) wizApply();
  renderCtxWiz();
  const b = document.getElementById('wizBody');
  if (b && b.scrollTo) b.scrollTo({ top: 0, behavior: 'smooth' });
  haptic('tap');
}

function wizSetOut(v) { if (wiz) { wiz.outHm = v; renderCtxWiz(); haptic('tap'); } }
function wizSetIn(v) { if (wiz) { wiz.inHm = v; renderCtxWiz(); } }
function wizDrop(key) {
  if (!wiz) return;
  wiz.drop[key] = !wiz.drop[key];
  renderCtxWiz();
  haptic('tap');
}
function wizEditTime(key, which, v) {
  if (!wiz) return;
  wiz.edit[key] = Object.assign({}, wiz.edit[key], { [which]: v });
  renderCtxWiz();
}

// ช่วงที่มีของจองไว้แล้วในวันธรรมดา ณ ตอนนี้ — กิจวัตรที่เดาไว้และยังไม่ถูกปัดทิ้ง
// บวกกับชิปที่เพิ่งเลือกไปก่อนหน้า ตัวหลังสำคัญไม่แพ้ตัวแรก:
// เลือกสามอย่างติดกันแล้วทั้งสามลงเวลาเดียวกัน คือสิ่งที่ผู้ใช้ต้องมานั่งแก้เองทั้งหมด
function wizTaken() {
  const out = [];
  const span = wizSpan();
  if (span) out.push({ from: span.from, to: span.to });
  for (const g of wizGuess()) {
    if (wiz.drop[g.key]) continue;
    const e = wiz.edit[g.key] || {};
    out.push({ from: hm2min(e.start || g.start), to: hm2min(e.end || g.end) });
  }
  for (const v of Object.values(wiz.picks)) out.push({ from: hm2min(v.start), to: hm2min(v.end) });
  return out.filter(r => r.from != null && r.to != null).sort((a, b) => a.from - b.from);
}

// เลื่อนลงไปเรื่อย ๆ จนเจอช่องที่ยาวพอ — ถ้าชนขอบเส้นห้ามวางงานก็ยอมวางทับ
// แล้วให้ขั้นถัดไปเตือน ดีกว่าวางเงียบ ๆ ตอนตีสองซึ่งไม่มีทางเป็นของจริง
function wizFreeAt(pref, min) {
  const taken = wizTaken();
  const last = (hm2min(ctxPrefs().sleep) || 22 * 60);
  let at = pref;
  for (let i = 0; i < 24; i++) {
    const hit = taken.find(r => r.from < at + min && r.to > at);
    if (!hit) break;
    at = hit.to;
    if (at + min > last) return pref;
  }
  return at;
}

function wizChip(key) {
  if (!wiz) return;
  if (wiz.picks[key]) delete wiz.picks[key];
  else {
    const c = WIZ_CHIPS.find(x => x.key === key);
    const span = wizSpan();
    const out = span ? span.to : (hm2min(wiz.outHm) || 16 * 60);
    let at;
    if (c.slot === 'school') {
      // ซ้อมกีฬา/เรียนพิเศษ เกิดที่โรงเรียนต่อจากคาบสุดท้าย ไม่ใช่หลังข้าวเย็น
      // มันทับ "เดินทางกลับบ้าน" ที่เดาไว้แน่นอน — แต่นั่นคือความจริงของวันที่มีซ้อม
      // (กลับบ้านช้าลงจริง) ปล่อยให้ทับแล้วให้ขั้นถัดไปเตือน ดีกว่าดันไปโผล่ตอนหกโมงเย็น
      const sameSlot = Object.keys(wiz.picks)
        .filter(k => (WIZ_CHIPS.find(x => x.key === k) || {}).slot === 'school')
        .map(k => hm2min(wiz.picks[k].end) || 0);
      at = Math.max(out, ...sameSlot);
    } else {
      // ที่เหลือเริ่มหลังของที่เดาไว้ทั้งหมดจบแล้ว (ปกติคือหลังข้าวเย็น)
      const evening = Math.max(...[out, ...wizGuess()
        .filter(g => !wiz.drop[g.key]).map(g => hm2min(g.end) || 0)]);
      at = wizFreeAt(evening, c.min);
    }
    wiz.picks[key] = { start: min2hm(at), end: min2hm(at + c.min), days: [1, 2, 3, 4, 5] };
  }
  renderCtxWiz();
  haptic('tap');
}
function wizPickTime(key, which, v) {
  if (wiz && wiz.picks[key]) { wiz.picks[key][which] = v; renderCtxWiz(); }
}
function wizPickDay(key, d) {
  if (!wiz || !wiz.picks[key]) return;
  const days = wiz.picks[key].days;
  const at = days.indexOf(d);
  if (at >= 0) days.splice(at, 1); else days.push(d);
  renderCtxWiz();
  haptic('tap');
}

// เขียนคำตอบทั้งหมดลงบริบทจริง — เรียกตอนเข้าขั้นสุดท้าย เพื่อให้แท่งวันในขั้นนั้นเป็นของจริง
// ไม่ใช่ภาพจำลอง: ถ้าแท่งที่เขาเห็นตอนจบไม่ตรงกับที่บันทึก เขาจะเจอวันคนละแบบตอนกลับเข้าแอป
function wizApply() {
  if (!wiz) return;
  const WD = [1, 2, 3, 4, 5];
  const span = ctxSchoolSpan();

  // เวลาเรียน: มีคาบจริงอยู่แล้วไม่แตะ — ตารางที่เขาสแกนมาละเอียดกว่าคำตอบหยาบจากจอนี้
  if (!ctxHasRealTimetable()) {
    for (const c of ctxClasses()) ctxRemove('class', c.id);
    ctxUpsert('class', { subject: 'เรียนที่โรงเรียน', start: wiz.inHm, end: wiz.outHm, weekday: WD });
  } else if (span && span.toHm !== wiz.outHm) {
    // มีตารางจริงแล้วแต่เขาแก้เวลาเลิก — ต่อคาบสุดท้ายให้ยาวถึงเวลาใหม่ ไม่ลบตารางเขาทิ้ง
    const last = ctxClasses().filter(c => hm2min(c.end) === span.to);
    for (const c of last) ctxUpsert('class', Object.assign({}, c, { end: wiz.outHm }));
  }

  for (const g of wizGuess()) {
    if (wiz.drop[g.key]) continue;
    const e = wiz.edit[g.key] || {};
    ctxUpsert('routine', { title: g.title, kind: g.kind, weekday: g.weekday,
      start: e.start || g.start, end: e.end || g.end });
  }
  for (const [key, v] of Object.entries(wiz.picks)) {
    const c = WIZ_CHIPS.find(x => x.key === key);
    if (!c || hm2min(v.end) <= hm2min(v.start)) continue;
    ctxUpsert('routine', { title: c.title, kind: c.kind, start: v.start, end: v.end,
      weekday: v.days.length && v.days.length < 7 ? v.days.slice().sort() : null });
  }
  ctxBarDay = 1;
  renderAll();
}

// ชิปนี้ทับกับอะไร — คืนชื่อของก้อนแรกที่ทับ หรือ '' ถ้าไม่ทับใคร
function wizClashOf(key) {
  if (!wiz || !wiz.picks[key]) return '';
  const v = wiz.picks[key];
  const a = hm2min(v.start), b = hm2min(v.end);
  if (a == null || b == null) return '';
  const span = wizSpan();
  if (span && span.from < b && span.to > a) return 'เวลาเรียน';
  for (const g of wizGuess()) {
    if (wiz.drop[g.key]) continue;
    const e = wiz.edit[g.key] || {};
    if ((hm2min(e.start || g.start) ?? 0) < b && (hm2min(e.end || g.end) ?? 0) > a) return g.title;
  }
  for (const [k2, v2] of Object.entries(wiz.picks)) {
    if (k2 === key) continue;
    if ((hm2min(v2.start) ?? 0) < b && (hm2min(v2.end) ?? 0) > a) {
      return (WIZ_CHIPS.find(x => x.key === k2) || {}).title || '';
    }
  }
  return '';
}

// ช่วงเวลาเรียนที่ตัวช่วยกำลังทำงานอยู่ด้วย — มาจากคำตอบในขั้นแรก ไม่ใช่จากบริบท
// ผู้ใช้แก้เวลาเลิกเรียนแล้วกิจวัตรที่เดาไว้ต้องขยับตามทันที ไม่ใช่รอไปเห็นตอนกดเสร็จ
function wizSpan() {
  const a = hm2min(wiz.inHm), b = hm2min(wiz.outHm);
  return a != null && b != null && b > a ? { from: a, to: b } : null;
}

function wizGuess() { return wiz ? ctxGuessRoutines(wizSpan()) : []; }

function wizDayChips(key, days) {
  return `<div class="wz-days">${WD_SHORT.map((lb, i) => `<button type="button"
    class="wz-day${days.includes(i) ? ' on' : ''}" onclick="wizPickDay('${key}', ${i})">${lb}</button>`).join('')}</div>`;
}

function renderCtxWiz() {
  const b = document.getElementById('wizBody');
  if (!b || !wiz) return;
  const head = `<div class="wz-top">
    <button class="set-back" onclick="wizClose()" aria-label="ปิด">${icon('x')}</button>
    <div class="wz-dots">${Array.from({ length: WIZ_LAST }, (_, i) =>
      `<span class="${i + 1 === wiz.step ? 'on' : (i + 1 < wiz.step ? 'past' : '')}"></span>`).join('')}</div>
  </div>`;

  const step = wiz.step;
  let body = '';

  if (step === 1) {
    const real = ctxHasRealTimetable();
    body = `<h2 class="wz-q">เลิกเรียนกี่โมง</h2>
      <p class="wz-sb">${real
        ? 'อ่านจากตารางเรียนที่คุณใส่ไว้ — ไม่ตรงก็แก้ได้'
        : 'ทุกอย่างหลังจากนี้เดาจากเวลานี้ ตอบให้ใกล้ของจริงที่สุด'}</p>
      <div class="wz-chips">${WIZ_OUT.map(v => `<button type="button"
        class="wz-chip${wiz.outHm === v ? ' on' : ''}" onclick="wizSetOut('${v}')">${v}</button>`).join('')}</div>
      <div class="wz-row">
        <span class="wz-lb">เข้าเรียน</span>
        <input type="time" value="${esc(wiz.inHm)}" onchange="wizSetIn(this.value)"${real ? ' disabled' : ''}>
      </div>
      ${real ? `<p class="wz-note">${icon('check')}มีตารางเรียนรายวิชาอยู่แล้ว เวลาเข้าเรียนจึงอ่านจากตารางนั้น</p>` : ''}`;
  }

  if (step === 2) {
    const guess = wizGuess();
    body = `<h2 class="wz-q">วันธรรมดาของคุณประมาณนี้ไหม</h2>
      <p class="wz-sb">เดาจากเวลาเรียนของคุณ — อันไหนไม่ใช่ แตะกากบาททิ้งได้ เวลาแก้ได้ตรงนั้น</p>
      <div class="wz-list">${guess.map(g => {
        const e = wiz.edit[g.key] || {};
        const off = !!wiz.drop[g.key];
        // ชื่อกับเวลาอยู่คนละบรรทัด — เรียงแถวเดียวแล้วช่องเวลาสองช่องกับปุ่มกิน
        // ความกว้างจนชื่อกิจวัตรเหลือศูนย์พิกเซลบนจอ 375 ซึ่งเป็นจอที่คนใช้จริง
        return `<div class="wz-rt${off ? ' off' : ''}">
          <div class="wz-rt-h">
            <span class="wz-ic">${icon((CTX_KINDS[g.kind] || CTX_KINDS.other).icon)}</span>
            <span class="wz-tx">${esc(g.title)}</span>
            <button class="wz-x" onclick="wizDrop('${g.key}')" aria-label="${off ? 'เอากลับมา' : 'ไม่ใช่'}">
              ${icon(off ? 'check' : 'x')}</button>
          </div>
          <div class="wz-times">
            <input type="time" value="${esc(e.start || g.start)}" ${off ? 'disabled' : ''}
              onchange="wizEditTime('${g.key}','start',this.value)">
            <span>ถึง</span>
            <input type="time" value="${esc(e.end || g.end)}" ${off ? 'disabled' : ''}
              onchange="wizEditTime('${g.key}','end',this.value)">
          </div>
        </div>`;
      }).join('')}</div>
      ${guess.length ? '' : '<p class="wz-note">ยังเดาไม่ได้ — ย้อนกลับไปใส่เวลาเรียนก่อน</p>'}`;
  }

  if (step === 3) {
    body = `<h2 class="wz-q">มีอะไรที่ทำประจำอีกไหม</h2>
      <p class="wz-sb">แตะเลือกได้หลายอัน — เวลาเดาให้แล้ว ไปแก้ในหน้าถัดไป</p>
      <div class="wz-chips wrap">${WIZ_CHIPS.map(c => `<button type="button"
        class="wz-chip${wiz.picks[c.key] ? ' on' : ''}" onclick="wizChip('${c.key}')">${esc(c.title)}</button>`).join('')}</div>
      <p class="wz-note">${icon('clock')}ไม่มีก็ข้ามได้ — เพิ่มทีหลังในหน้าบริบทได้ตลอด</p>`;
  }

  if (step === 4) {
    const keys = Object.keys(wiz.picks);
    body = `<h2 class="wz-q">อันละกี่โมง</h2>
      <p class="wz-sb">เดาไว้ว่าอยู่ช่วงหลังกลับบ้าน จ–ศ — แก้วันกับเวลาได้ตามจริง</p>
      <div class="wz-list">${keys.map(k => {
        const c = WIZ_CHIPS.find(x => x.key === k), v = wiz.picks[k];
        const bad = hm2min(v.end) <= hm2min(v.start);
        // ทับของอื่นไม่ใช่ความผิด — คนเราทำสองอย่างพร้อมกันได้จริง (กินข้าวไปดูซีรีส์ไป)
        // แต่ต้องบอกให้เห็น เพราะเวลาที่ถูกจองซ้อนกันจะถูกนับเป็นช่วงว่างน้อยลงกว่าที่เขาคิด
        const clash = !bad && wizClashOf(k);
        return `<div class="wz-slot">
          <div class="wz-slot-h"><b>${esc(c.title)}</b>
            <button class="wz-x" onclick="wizChip('${k}')" aria-label="เอาออก">${icon('x')}</button></div>
          ${wizDayChips(k, v.days)}
          <div class="wz-times">
            <input type="time" value="${esc(v.start)}" onchange="wizPickTime('${k}','start',this.value)">
            <span>ถึง</span>
            <input type="time" value="${esc(v.end)}" onchange="wizPickTime('${k}','end',this.value)">
          </div>
          ${bad ? '<p class="wz-bad">เวลาจบต้องอยู่หลังเวลาเริ่ม — อันนี้จะยังไม่ถูกบันทึก</p>' : ''}
          ${clash ? `<p class="wz-warn">${icon('clock')}ทับกับ "${esc(clash)}" อยู่ — ตั้งใจแบบนี้ก็ได้ ไม่ได้ก็ขยับเวลา</p>` : ''}
        </div>`;
      }).join('')}</div>`;
  }

  if (step === WIZ_LAST) {
    body = `<h2 class="wz-q">นี่คือวันจันทร์ของคุณ</h2>
      <p class="wz-sb">บันทึกให้แล้ว — แก้ได้ตลอดในหน้าบริบท</p>
      ${ctxBarHtml(1, { pick: false })}
      <p class="wz-note">${icon('sparkles')}จากนี้ AI จะวางงานลงเฉพาะช่องสีทอง
        ไม่ใช่ "ว่างวันละ 2 ชั่วโมง" ที่เดาเอาเองอีกต่อไป</p>`;
  }

  const back = step > 1 && step < WIZ_LAST
    ? `<button class="btn ghost" onclick="wizGo(${step - 1})">ย้อนกลับ</button>` : '';
  const next = step === WIZ_LAST
    ? `<button class="btn" onclick="wizClose()">เสร็จแล้ว</button>`
    : `<button class="btn" onclick="wizGo(${step + 1})">ถัดไป</button>`;

  b.innerHTML = `${head}<div class="wz-main">${body}</div>
    <div class="wz-act">${back}${next}</div>`;
}

// ---------- แอปเดาจากพฤติกรรมจริง แล้วขอยืนยัน ----------
// กิจวัตรที่กรอกไว้ตอนแรกคือ "วันที่เขาคิดว่าตัวเองใช้ชีวิต" ซึ่งมักไม่ตรงกับวันจริง
// เวลาที่ติ๊กงานเสร็จคือหลักฐานว่าจริง ๆ แล้วเขานั่งทำงานตอนไหน
//
// สองกฎที่คุมส่วนนี้:
//   1. เสนอเมื่อมีหลักฐานพอเท่านั้น — ต่ำกว่า 6 งานคือเสียงรบกวน ไม่ใช่รูปแบบ
//   2. ไม่แก้อะไรเองสักอย่าง ทุกข้อเสนอต้องผ่านปุ่มยืนยันของเขาก่อน
const CTX_LEARN_MIN = 6;
const CTX_LEARN_DISMISS = 'studentos.alt.ctxLearnOff';

function ctxLearn() {
  const now = new Date();
  const done = (typeof liveTasks === 'function' ? liveTasks() : []).filter(t =>
    t.done && t.doneAt && (now - new Date(t.doneAt)) < 28 * 8.64e7);
  if (done.length < CTX_LEARN_MIN) return null;

  // นับเป็นช่วงชั่วโมง แล้วหาชั่วโมงที่ติ๊กเสร็จเยอะสุด
  const byHour = {};
  for (const t of done) {
    const h = new Date(t.doneAt).getHours();
    byHour[h] = (byHour[h] || 0) + 1;
  }
  const [topH, topN] = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  const hour = +topH;
  // ชั่วโมงที่ชนะแบบเฉียดฉิวไม่ใช่รูปแบบ — ต้องกินสัดส่วนจริงถึงจะพูดได้
  if (topN < Math.max(3, done.length * 0.3)) return null;

  // เทียบกับตารางของ "วันที่เขาทำงานจริง" ไม่ใช่ของวันนี้
  // ใช้วันนี้แล้วผลจะเปลี่ยนไปมาตามว่าเปิดจอตอนวันไหน — วันเสาร์ไม่มีคาบเรียน
  // ข้อสังเกตเดียวกันจึงหายไปทุกสุดสัปดาห์ แล้วโผล่กลับมาวันจันทร์ ซึ่งอธิบายไม่ได้
  const byDay = {};
  for (const t of done) {
    const d = new Date(t.doneAt);
    if (d.getHours() !== hour) continue;
    byDay[d.getDay()] = (byDay[d.getDay()] || 0) + 1;
  }
  const topDay = +Object.entries(byDay).sort((a, b) => b[1] - a[1])[0][0];
  const ref = new Date();
  ref.setDate(ref.getDate() + ((topDay - ref.getDay()) + 7) % 7);

  const from = hour * 60, to = from + 60;
  const busy = busyBlocks(ref).filter(b => b.from < to && b.to > from && b.kind !== 'class');
  if (busy.length) {
    return { type: 'clash', hour, n: topN, block: busy[0],
      msg: `คุณติ๊กงานเสร็จช่วง ${min2hm(from)}–${min2hm(to)} อยู่บ่อย (${topN} จาก ${done.length} งาน)
            แต่บริบทบอกว่าช่วงนั้นคือ "${busy[0].title}"` };
  }
  const p = ctxPrefs();
  const stop = hm2min(p.noWorkAfter) ?? 21 * 60;
  if (from >= stop) {
    return { type: 'late', hour, n: topN,
      msg: `คุณติ๊กงานเสร็จหลัง ${p.noWorkAfter} น. อยู่บ่อย (${topN} จาก ${done.length} งาน)
            แต่ตอนนี้แอปไม่วางงานหลังเวลานั้นให้เลย` };
  }
  return null;
}

function ctxLearnHtml() {
  let hit = null;
  try { hit = ctxLearn(); } catch (_) { hit = null; }
  if (!hit) return '';
  try { if (localStorage.getItem(CTX_LEARN_DISMISS) === hit.type + hit.hour) return ''; } catch (_) {}
  const act = hit.type === 'clash'
    ? `<button class="btn sm" onclick="ctxLearnApply()">ขยับ${esc(hit.block.title)}ให้</button>`
    : `<button class="btn sm" onclick="ctxLearnApply()">ขยายถึง ${esc(min2hm((hit.hour + 1) * 60))}</button>`;
  return `<section class="ctx-learn">
    <div class="cl-h">${icon('sparkles')}<span>แอปสังเกตเห็นอย่างหนึ่ง</span></div>
    <p class="cl-p">${esc(hit.msg)}</p>
    <div class="cl-act">${act}
      <button class="btn ghost sm" onclick="ctxLearnNo()">ไม่ต้อง</button></div>
  </section>`;
}

function ctxLearnApply() {
  const hit = ctxLearn();
  if (!hit) return;
  // ปิดข้อสังเกตของชั่วโมงนี้ไว้หลังลงมือแล้ว — ขยับกิจวัตรหนึ่งอันมักเปิดโปงอันถัดไปทันที
  // ถ้าไม่ปิด การ์ดใบใหม่จะเด้งขึ้นมาแทนที่ใบเดิมในวินาทีเดียวกัน กลายเป็นเกมตีตัวตุ่น
  // ที่เหลือรอรอบหน้าค่อยว่ากัน — เขาเพิ่งตอบไปหนึ่งคำถาม ไม่ได้ขอให้จัดตารางใหม่ทั้งเย็น
  try { localStorage.setItem(CTX_LEARN_DISMISS, hit.type + hit.hour); } catch (_) {}
  if (hit.type === 'clash') {
    // ขยับกิจวัตรที่ทับให้เริ่มหลังชั่วโมงที่เขาทำงานจริง โดยรักษาความยาวเดิมไว้
    const r = ctxRoutines().find(x => x.id === hit.block.id);
    if (r) {
      const len = (hm2min(r.end) || 0) - (hm2min(r.start) || 0);
      const start = (hit.hour + 1) * 60;
      ctxUpsert('routine', Object.assign({}, r, {
        start: min2hm(start), end: min2hm(Math.min(24 * 60 - 1, start + len)) }));
    }
  } else {
    ctxSetPrefs({ noWorkAfter: min2hm((hit.hour + 1) * 60) });
  }
  haptic('done');
  renderAll();
}

function ctxLearnNo() {
  const hit = ctxLearn();
  if (hit) { try { localStorage.setItem(CTX_LEARN_DISMISS, hit.type + hit.hour); } catch (_) {} }
  renderContext();
}

// วันที่กางอยู่ในตารางเรียน — null = พับหมด (ค่าเริ่มต้น เพราะภาพรวมมาก่อนรายละเอียด)
let ctxOpenDay = null;
function ctxToggleWeekDay(d) { ctxOpenDay = ctxOpenDay === d ? null : d; renderContext(); }

function ctxDayCount(x) {
  if (x.weekday == null) return 7;
  return Array.isArray(x.weekday) ? x.weekday.length : 1;
}

// ตารางเรียนทั้งสัปดาห์เคยเป็นรายการเดียวเรียงตามเวลา แปลว่า 08:30 ของวันจันทร์
// ไปนอนติดกับ 08:30 ของวันศุกร์ ต่างกันแค่ตัวอักษรเล็ก ๆ ข้างเวลา — สามสิบห้าแถวแบบนั้น
// ตอบไม่ได้ว่า "วันจันทร์เรียนอะไรบ้าง" ซึ่งเป็นคำถามเดียวที่คนเปิดตารางเรียนมาถาม
//
// จึงพับเป็นวันละแถว: สภาพพับอยู่คือภาพรวมทั้งสัปดาห์ในจอเดียว
// กดวันไหนถึงกางคาบของวันนั้นออกมาให้แก้ — ย่อ ไม่ใช่ตัดทิ้ง
function ctxWeekHtml() {
  const all = ctxClasses();
  const open = ctxEditing && ctxEditing.kind === 'class';
  const form = open ? ctxFormHtml('class')
    : `<button class="ctx-add" onclick="ctxOpenForm('class')">+ เพิ่มคาบเรียน</button>`;

  if (!all.length) {
    return `<div class="ctx-list">
      <p class="ctx-empty">ยังไม่ได้ใส่ตารางเรียน — ใส่แล้ว AI จะเลิกวางงานทับเวลาเรียน</p>
      ${form}</div>`;
  }

  // เริ่มที่วันจันทร์เพราะสัปดาห์ของโรงเรียนเริ่มตรงนั้น เสาร์อาทิตย์ไปต่อท้าย
  // วันที่ไม่มีคาบไม่ขึ้นเลย — แถวว่างของเสาร์อาทิตย์ไม่ได้บอกอะไรที่คนยังไม่รู้
  const days = [1, 2, 3, 4, 5, 6, 0]
    .map(d => ({ d, list: all.filter(x => onDay(x, d))
      .sort((a, b) => (hm2min(a.start) || 0) - (hm2min(b.start) || 0)) }))
    .filter(x => x.list.length);

  const blocks = days.map(({ d, list }) => {
    const on = ctxOpenDay === d;
    const to = list.reduce((m, x) => Math.max(m, hm2min(x.end) || 0), 0);
    const body = on
      ? `<div class="ctx-pers">${list.map((x, n) => {
          const name = x.subject || 'เรียน';
          return `<div class="ctx-per ${subjClass(name)}">
            <span class="ctx-per-n">${n + 1}</span>
            <i class="mono">${esc(x.start)}–${esc(x.end)}</i>
            <b>${esc(name)}</b>
            ${ctxDayCount(x) > 1 ? `<u>${esc(ctxDayLabel(x))}</u>` : ''}
            <button class="ctx-del" onclick="ctxDelete('class','${x.id}')"
              aria-label="ลบ ${esc(name)}">${icon('trash')}</button>
          </div>`;
        }).join('')}</div>`
      : `<p class="ctx-daysum">${[...new Set(list.map(x => x.subject || 'เรียน'))]
          .map(s => `<span class="ctx-chip ${subjClass(s)}">${esc(s)}</span>`).join('')}</p>`;

    return `<div class="ctx-dayblk${on ? ' on' : ''}">
      <button class="ctx-dayh" onclick="ctxToggleWeekDay(${d})" aria-expanded="${on}">
        <b>วัน${THAI_DAY[d]}</b>
        <i class="mono">${esc(list[0].start)}–${esc(min2hm(to))}</i>
        <u>${list.length} คาบ</u>
        <span class="ctx-dayx">${icon('chevron')}</span>
      </button>
      ${body}
    </div>`;
  }).join('');

  // คาบซ้ำ ๆ ที่กระจายอยู่หลายวันนับหัวยาก บอกยอดรวมไว้ให้เห็นว่าใส่ครบหรือยัง
  const total = all.reduce((s, x) => s + ctxDayCount(x), 0);
  return `<div class="ctx-week">
    <p class="ctx-weeksum">${days.length} วันเรียน · ${total} คาบต่อสัปดาห์ — แตะวันเพื่อดูรายคาบ</p>
    ${blocks}${form}</div>`;
}

function ctxListHtml(kind) {
  const list = kind === 'class' ? ctxClasses() : ctxRoutines();
  const sorted = [...list].sort((a, b) => (hm2min(a.start) || 0) - (hm2min(b.start) || 0));
  const open = ctxEditing && ctxEditing.kind === kind;
  return `<div class="ctx-list">
    ${sorted.map(x => `<div class="ctx-item">
      <span class="ctx-ic">${icon(kind === 'class' ? 'calendar' : (CTX_KINDS[x.kind] || CTX_KINDS.other).icon)}</span>
      <span class="ctx-bd">
        <b>${esc(kind === 'class' ? (x.subject || 'เรียน') : (x.title || 'กิจวัตร'))}</b>
        <i class="mono">${esc(ctxDayLabel(x))} · ${esc(x.start)}–${esc(x.end)}</i>
      </span>
      <button class="ctx-del" onclick="ctxDelete('${kind}','${x.id}')" aria-label="ลบ">${icon('trash')}</button>
    </div>`).join('')}
    ${sorted.length ? '' : `<p class="ctx-empty">${kind === 'class'
      ? 'ยังไม่ได้ใส่ตารางเรียน — ใส่แล้ว AI จะเลิกวางงานทับเวลาเรียน'
      : 'ยังไม่ได้ใส่กิจวัตร — กินข้าว เดินทาง ซ้อมกีฬา เรียนพิเศษ ใส่ตรงนี้'}</p>`}
    ${open ? ctxFormHtml(kind) : `<button class="ctx-add" onclick="ctxOpenForm('${kind}')">
      + เพิ่ม${kind === 'class' ? 'คาบเรียน' : 'กิจวัตร'}</button>`}
  </div>`;
}

// ฟอร์มเพิ่มรายการ — อยู่ในหน้าเดียวกัน ไม่เด้งจอใหม่
// เพิ่มตารางเรียนหนึ่งสัปดาห์คือการกรอกซ้ำ ๆ หลายรอบ เด้งจอทุกรอบแล้วเลิกกรอกกลางคัน
function ctxFormHtml(kind) {
  const d = ctxEditing.draft;
  return `<div class="ctx-form">
    <input type="text" id="ctxName" placeholder="${kind === 'class' ? 'ชื่อวิชา เช่น คณิตศาสตร์' : 'เช่น ซ้อมฟุตบอล'}"
      value="${esc(d.name)}" oninput="ctxEditing.draft.name=this.value">
    ${kind === 'routine' ? `<div class="ctx-kinds">
      ${Object.entries(CTX_KINDS).map(([k, v]) => `<button type="button"
        class="ctx-kind${d.kind === k ? ' on' : ''}" onclick="ctxSetKind('${k}')">${esc(v.name)}</button>`).join('')}
    </div>` : ''}
    <div class="ctx-days">
      ${WD_SHORT.map((lb, i) => `<button type="button" class="ctx-day${d.days.includes(i) ? ' on' : ''}"
        onclick="ctxToggleDay(${i})">${lb}</button>`).join('')}
    </div>
    <div class="ctx-times">
      <input type="time" value="${esc(d.start)}" onchange="ctxEditing.draft.start=this.value">
      <span>ถึง</span>
      <input type="time" value="${esc(d.end)}" onchange="ctxEditing.draft.end=this.value">
    </div>
    <div class="ctx-form-act">
      <button class="btn ghost sm" onclick="ctxCloseForm()">ยกเลิก</button>
      <button class="btn sm" onclick="ctxSubmit()">เพิ่ม</button>
    </div>
    <p class="ctx-err" id="ctxErr" hidden></p>
  </div>`;
}

function ctxOpenForm(kind) {
  ctxEditing = { kind, draft: {
    name: '', kind: 'other',
    days: kind === 'class' ? [1, 2, 3, 4, 5] : [],  // คาบเรียนส่วนใหญ่เป็นวันธรรมดา เดาให้ก่อน
    start: kind === 'class' ? '08:00' : '18:00',
    end: kind === 'class' ? '09:00' : '19:00',
  } };
  renderContext();
  const el = document.getElementById('ctxName');
  if (el) el.focus();
  // เลื่อนทั้งฟอร์มเข้ามาให้เห็น ไม่ใช่แค่ช่องที่โฟกัส — ไม่งั้นปุ่ม "เพิ่ม" ที่อยู่ท้ายฟอร์ม
  // ไปนอนอยู่ใต้แถบเมนูล่าง แล้วผู้ใช้กรอกเสร็จก็ไม่เห็นปุ่มที่ต้องกดต่อ
  const form = document.querySelector('.ctx-form');
  if (form && form.scrollIntoView) form.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function ctxCloseForm() { ctxEditing = null; renderContext(); }
function ctxSetKind(k) { if (ctxEditing) { ctxEditing.draft.kind = k; renderContext(); } }
function ctxToggleDay(i) {
  if (!ctxEditing) return;
  const d = ctxEditing.draft.days;
  const at = d.indexOf(i);
  if (at >= 0) d.splice(at, 1); else d.push(i);
  renderContext();
}

function ctxSubmit() {
  if (!ctxEditing) return;
  const { kind, draft } = ctxEditing;
  const err = document.getElementById('ctxErr');
  const fail = msg => { if (err) { err.textContent = msg; err.hidden = false; } };

  const a = hm2min(draft.start), b = hm2min(draft.end);
  if (!draft.name.trim()) return fail('ยังไม่ได้ใส่ชื่อ');
  if (a == null || b == null) return fail('เวลาไม่ถูกต้อง');
  // ข้ามเที่ยงคืนยังไม่รองรับ — บอกตรง ๆ ดีกว่าเก็บข้อมูลที่คำนวณไม่ได้แล้วเงียบ
  if (b <= a) return fail('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม (ยังไม่รองรับกิจกรรมข้ามเที่ยงคืน)');

  const days = draft.days.slice().sort();
  const rec = {
    weekday: days.length === 0 || days.length === 7 ? null : days,
    start: draft.start, end: draft.end,
  };
  if (kind === 'class') rec.subject = draft.name.trim();
  else { rec.title = draft.name.trim(); rec.kind = draft.kind; }

  ctxUpsert(kind, rec);
  ctxEditing = null;
  renderAll();     // การ์ดสรุปด้านบนต้องขยับทันที ไม่งั้นไม่รู้ว่ากรอกแล้วได้อะไร
}

function ctxDelete(kind, id) {
  ctxRemove(kind, id);
  renderAll();
}

function ctxSavePref(key, val) {
  if (hm2min(val) == null) return;
  ctxSetPrefs({ [key]: val });
  renderAll();
}

function ctxWipe() {
  if (!confirm('ลบตารางเรียน กิจวัตร และเวลาประจำวันทั้งหมด? (งานของคุณไม่หาย)')) return;
  ctxClear();
  ctxEditing = null;
  renderAll();
  showToast({ title: 'ลบบริบทแล้ว', body: 'AI กลับไปใช้เวลาว่างแบบเดาเหมือนเดิม' });
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

// ============================================================
// ของสะสม — ซิงก์ขึ้น cloud (1A9t)
// ------------------------------------------------------------
// ของพวกนี้เคยอยู่ใน localStorage อย่างเดียว แปลว่าลบแอปแล้วติดตั้งใหม่ = หายหมด
// ซึ่งเป็นเรื่องใหญ่กว่าที่เห็น เพราะ "ลบแล้วติดตั้งใหม่" คือวิธีมาตรฐานของโปรเจกต์นี้
// เวลาเปลี่ยนไอคอนแอป (iOS แช่ไอคอนไว้ตั้งแต่ตอนติดตั้ง แก้ทางอื่นไม่ได้)
//
// ไม่ทำตารางใหม่ — user_state.data เป็น JSON อยู่แล้ว เพิ่มคีย์เข้าไปพอ
//
// สิ่งที่ "ไม่" ซิงก์และเป็นการตัดสินใจ ไม่ใช่การลืม:
//   ภาพพื้นหลัง · ภาพวิดเจ็ต   เป็น JPEG เต็มจอ ใหญ่ได้เป็นหลายร้อย KB
//                              ยัดลงก้อน sync = ทุกครั้งที่ติ๊กงานเสร็จต้องอัปโหลดใหม่ทั้งก้อน
//   ธีม · ขนาดฟอนต์ · แถบล่าง   ตั้งใหม่ใช้เวลาสิบวินาที และควรต่างกันได้ตามเครื่อง
//                              (จอคอมกับจอมือถือไม่จำเป็นต้องใช้ขนาดฟอนต์เดียวกัน)
//   ประวัติถามน้องไซ            เป็นบันทึกของเครื่อง ไม่ใช่ของที่ได้มา
// ============================================================
const VAULT_AT_KEY = 'studentos.alt.vaultAt';   // ของสะสมชุดนี้ถูกแก้ครั้งล่าสุดเมื่อไหร่

// เรียกทุกครั้งที่ของสะสมเปลี่ยนโดยไม่ผ่าน saveTokenState (ธงปลดล็อก · รูปโปรไฟล์)
// ลืมเรียกที่ไหน ของตรงนั้นจะไม่ขึ้น cloud โดยไม่มีอะไรฟ้อง — เป็นบั๊กที่เห็นตอนย้ายเครื่องเท่านั้น
function vaultTouch() {
  try { localStorage.setItem(VAULT_AT_KEY, String(Date.now())); } catch (_) {}
  if (typeof pushToCloud === 'function') pushToCloud();
}

function vaultExport() {
  const av = typeof userAvatar === 'function' ? userAvatar() : '';
  return {
    at: +(localStorage.getItem(VAULT_AT_KEY) || 0),
    tokens: tokenState(),
    allBadges: localStorage.getItem(ALLBADGE_KEY) === '1',
    luck: localStorage.getItem(LUCK_KEY) === '1',
    genesis: localStorage.getItem(GENESIS_KEY) === '1',
    // รูปโปรไฟล์ย่อเป็นจัตุรัส 256px คุณภาพ .82 มาแล้ว ราว 20KB — เล็กพอจะพกไปด้วย
    avatar: av || undefined,
  };
}

// รวมของจาก cloud เข้ากับของในเครื่อง — สองแบบ ไม่ใช่แบบเดียว
function vaultImport(r) {
  if (!r) return;
  const localAt = +(localStorage.getItem(VAULT_AT_KEY) || 0);
  const remoteAt = +r.at || 0;
  const remoteNewer = remoteAt > localAt;

  // ธงปลดล็อก: ปลดแล้วปลดเลย ไม่มีทางย้อนกลับ จึงรวมแบบ "เครื่องไหนเคยได้ ถือว่าได้"
  try {
    if (r.allBadges) localStorage.setItem(ALLBADGE_KEY, '1');
    if (r.luck) localStorage.setItem(LUCK_KEY, '1');
    if (r.genesis) localStorage.setItem(GENESIS_KEY, '1');
  } catch (_) {}

  const local = tokenState();
  const remote = r.tokens || {};
  // สกินที่เคยได้เป็น "เซ็ต" ของที่ได้มาแล้วไม่เคยหาย รวมกันเสมอ ไม่มีทางเสียของ
  const skins = Object.assign({}, remote.skins || {}, local.skins || {});
  // ยอดโทเคนกับสตรีคเป็นตัวเลขที่ "ใช้แล้วลด" เอามากที่สุดไม่ได้ —
  // ใช้จนเหลือ 20 ที่เครื่องหนึ่ง แล้วเปิดอีกเครื่องที่ยังค้าง 100 ก็จะได้ 100 คืนทุกครั้ง
  // ซึ่งกลายเป็นวิธีปั๊มโทเคนแบบไม่จำกัด จึงตัดสินด้วยเวลาแทน: ฝั่งที่แก้ทีหลังชนะ
  saveTokenState(Object.assign({}, remoteNewer ? remote : local, { skins }), true);

  if (remoteNewer) {
    if (r.avatar) { try { localStorage.setItem(AV_KEY, r.avatar); } catch (_) {} }
    try { localStorage.setItem(VAULT_AT_KEY, String(remoteAt)); } catch (_) {}
  }
}

function tokenState() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) || {}; } catch (_) { return {}; }
}
function saveTokenState(s, quiet) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(s)); } catch (_) {}
  // quiet = กำลังเขียนของที่เพิ่งดึงลงมาจาก cloud ห้ามประทับเวลาใหม่
  // ไม่งั้นเครื่องที่แค่ "รับ" ของมา จะกลายเป็นเครื่องที่มีของใหม่ที่สุดทันที
  if (!quiet) { try { localStorage.setItem(VAULT_AT_KEY, String(Date.now())); } catch (_) {} }
  if (!quiet && typeof pushToCloud === 'function') pushToCloud();
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

// กันเช็คอินเด้งทับฉากต้อนรับ — ตั้งเป็นเวลาที่ "ห้ามเด้งจนกว่าจะถึง"
let checkinHoldUntil = 0;

function openDailyCheck(auto) {
  const wrap = document.getElementById('checkin');
  if (!wrap) return;
  if (auto && !dailyPending()) return;
  // ยังไม่ได้เข้าแอปจริง (จอบัญชี / จอทำความรู้จัก) ห้ามเด้ง —
  // ของรางวัลรายวันเป็นของคนที่เข้ามาใช้แอปแล้ว ไม่ใช่ของที่โผล่ทับหน้าล็อกอิน
  if (auto && document.body.classList.contains('login-mode')) return;
  // เพิ่งผ่านฉาก "ยินดีที่ได้รู้จัก" มาหมาด ๆ — วินาทีแรกของคนใช้ครั้งแรก
  // ถ้าปล่อยให้เช็คอินเด้งตรงนี้ เขาจะเจอ toast ต้อนรับ + แผ่นของรางวัล + จอที่ยังว่างเปล่า
  // พร้อมกันสามชั้น ทั้งที่ยังไม่ทันได้เห็นว่าแอปนี้ทำอะไรได้เลยสักอย่าง
  if (auto && Date.now() < checkinHoldUntil) return;
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

// ---------- แผนราคา (ยังไม่เปิดขาย) ----------
// จอนี้ไม่รับเงิน ไม่มีช่องกรอก ไม่เก็บอะไรลงเครื่องนอกจากธงว่า "อยากให้เตือนตอนเปิด"
//
// ของที่อยู่ในแผนถูกเลือกจาก "อะไรมีค่าใช้จ่ายจริงต่อการใช้หนึ่งครั้ง" ไม่ใช่สุ่มเอาของดี ๆ
// ไปขังไว้: น้องไซกับการอ่านรูป/ตารางเรียนเรียก Gemini ทุกครั้ง ส่วนการจัดลำดับงาน
// คำนวณในเครื่อง ต้นทุนเป็นศูนย์ — ของฟรีที่ต้นทุนศูนย์ก็ควรฟรีต่อไป
//
// **ป้าย "ยังไม่เปิดขาย" อยู่ทั้งบนปุ่มทางเข้าและบนหัวจอ** และบรรทัดล่างบอกตรง ๆ ว่า
// ตอนนี้ทุกอย่างยังใช้ได้ฟรีหมด — หน้าราคาที่ทำให้คนคิดว่าของถูกล็อกอยู่แล้วทั้งที่ยังไม่ล็อก
// คือการโกหกที่เนียนที่สุดแบบหนึ่ง และเป็นจุดที่กรรมการถามได้ตรง ๆ ว่าขายอะไรอยู่
const PRO_NOTIFY_KEY = 'studentos.alt.proNotify';
const PRO_PLANS = [
  {
    id: 'pro', name: 'Pro', price: 49, tag: '',
    line: 'พอสำหรับคนที่ถามน้องไซทุกวัน',
    feats: ['ถามน้องไซได้ 100 คำถาม/เดือน', 'สแกนใบงานด้วย AI ไม่จำกัด', 'ธีมในร้านค้าทั้งหมด'],
  },
  {
    id: 'max', name: 'Pro Max', price: 67, tag: 'แนะนำ',
    line: 'ไม่ต้องนับว่าเหลือกี่คำถาม',
    feats: ['ถามน้องไซไม่จำกัด', 'อ่านตารางเรียนจากรูปด้วย AI', 'สำรองข้อมูลข้ามเครื่อง',
      'ธีมลับทั้งหมด ไม่ต้องสุ่ม'],
  },
];
let proPick = 'max';

function proSelect(id) { proPick = id; renderPro(); }

function proNotify() {
  try { localStorage.setItem(PRO_NOTIFY_KEY, '1'); } catch (_) {}
  haptic('done');
  renderPro();
  showToast({ title: 'จดไว้แล้ว', body: 'เปิดขายเมื่อไหร่จะบอกก่อน — ตอนนี้ใช้ฟรีได้ทุกอย่างเหมือนเดิม' });
}

function renderPro() {
  const box = document.getElementById('proBody');
  if (!box) return;
  let want = false;
  try { want = localStorage.getItem(PRO_NOTIFY_KEY) === '1'; } catch (_) {}

  box.innerHTML = `<div class="page-head">
      <div class="eyebrow">แผนราคา <span class="pe-wip">ยังไม่เปิดขาย</span></div>
      <h1 class="page-title">StudentOS Pro</h1>
      <p class="page-sub">ถ้าวันหนึ่งมีของขาย จะขายแค่ของที่มีค่าใช้จ่ายจริงต่อการใช้ —
        การจัดลำดับงานคำนวณในเครื่อง ต้นทุนเป็นศูนย์ อันนั้นฟรีตลอดไป</p>
    </div>

    <div class="pro-grid">
      ${PRO_PLANS.map(p => `<button class="pro-card${proPick === p.id ? ' on' : ''}"
        onclick="proSelect('${p.id}')" aria-pressed="${proPick === p.id}">
        <span class="pro-top">
          <span class="pro-name">${p.name}</span>
          ${p.tag ? `<span class="pro-tag">${p.tag}</span>` : ''}
        </span>
        <span class="pro-price"><b>฿${p.price}</b><i>/ เดือน</i></span>
        <span class="pro-line">${p.line}</span>
      </button>`).join('')}
    </div>

    <div class="pro-feats">
      ${(PRO_PLANS.find(p => p.id === proPick) || PRO_PLANS[0]).feats
        .map(f => `<div class="pro-f">${icon('check')}<span>${f}</span></div>`).join('')}
    </div>

    <button class="pro-cta${want ? ' done' : ''}" onclick="proNotify()" ${want ? 'disabled' : ''}>
      ${icon(want ? 'check' : 'sparkles')}${want ? 'จะบอกเมื่อเปิดขาย' : 'บอกฉันเมื่อเปิดขาย'}
    </button>

    <p class="pro-note">ตอนนี้ยังไม่เปิดขาย และ<b>ทุกฟีเจอร์ในแอปใช้ได้ฟรีทั้งหมด</b> —
      ไม่มีอะไรถูกล็อกอยู่จริงในรุ่นนี้ จอนี้มีไว้บอกแผนล่วงหน้าเท่านั้น
      ไม่มีการเก็บเงิน ไม่มีการขอเลขบัตร และไม่มีการต่ออายุอัตโนมัติ</p>`;
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
  // นับเฉพาะงานที่ "ต้องลงมือเดี๋ยวนี้" — เลยกำหนดไปแล้ว หรือวันนี้เป็นวันสุดท้ายที่ยังทัน
  //
  // เดิมนับทุกใบที่ได้ ★5 ซึ่งกลายเป็นเลขที่ติดค้างเกือบตลอดเวลาในสัปดาห์ที่งานเยอะ
  // แล้วเลขที่ขึ้นตลอดเวลาก็เท่ากับเลขที่ไม่มีใครมอง · หน้าแรกบอกความด่วนไว้ครบอยู่แล้ว
  // แบดจ์จึงเหลือไว้เตือนเฉพาะเรื่องที่ปล่อยไว้แล้วเสียหายจริง
  const urgent = pendingTasks().filter(t => {
    if (!t.due) return false;
    return new Date(t.due) < now || isLastChanceToday(t, now);
  }).length;
  el.hidden = !urgent;
  el.textContent = urgent > 9 ? '9+' : urgent;
  el.setAttribute('aria-label', urgent ? 'ต้องทำวันนี้ ' + urgent + ' งาน' : '');

  // จุดแดงบนแท็บ "ฉัน" — ของรางวัลรายวันที่ยังไม่ได้กดรับ
  // ไม่มีตัวเลข เพราะมันคือของชิ้นเดียวต่อวัน ตัวเลขจะกลายเป็นการบอกว่า "1" ซึ่งไม่ได้บอกอะไรเพิ่ม
  const dot = document.getElementById('dotMe');
  if (dot) {
    const waiting = typeof dailyPending === 'function' && dailyPending();
    dot.hidden = !waiting;
    dot.setAttribute('aria-label', waiting ? 'มีของรางวัลรายวันรอรับ' : '');
  }

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
// สรุปประจำสัปดาห์ — "ระบบเห็นอะไรในตัวคุณ" ไม่ใช่หน้าสถิติอีกหน้า
//
// ทุกบรรทัดต้องมาจากข้อมูลจริง (รอบจับเวลา · เวลาที่ประเมินเทียบกับที่ใช้จริง · จำนวนครั้งที่เลื่อน)
// ข้อมูลยังไม่พอเมื่อไหร่ก็ไม่ต้องขึ้นการ์ดเลย — การเดาแล้วพูดให้ดูฉลาดคือวิธีที่เร็วที่สุด
// ที่จะทำให้ผู้ใช้เลิกเชื่อทุกตัวเลขที่เหลือในแอป
//
// และข้อสังเกตพวกนี้ไม่ได้จบที่การอ่าน — durationStats ตัวเดียวกันนี้ถูกป้อนกลับเข้าตัวจัดแผน
// ผ่าน plannedMin() แปลว่า "ใช้เวลามากกว่าที่ประเมินไว้ 1.4 เท่า" ทำให้แผนสัปดาห์หน้ากันเวลาให้จริง
// ถูกแทนด้วยกล่อง "น้องไซวิเคราะห์" (.an-ai) ในจอวิเคราะห์ตั้งแต่ 1A9e
// ทั้งสองอันอ่าน weeklyReview().insights ชุดเดียวกัน ต่างกันแค่หน้าตา — เก็บอันที่ใหม่กว่าไว้
// ตัวเลขสามตัวที่การ์ดนี้เคยพก (งานเสร็จ · ที่จับเวลาไว้ · งานถูกเลื่อน)
// อยู่ในไทล์บนสุด กราฟ 7 วัน และการ์ด "เลื่อนงาน" ของจอนั้นครบแล้ว
// ยังไม่ลบทิ้งเพราะเป็นก้อนที่พร้อมใช้ ถ้าจะเอา "สรุปสัปดาห์" กลับมาเป็นการ์ดของตัวเอง
function weekReviewCard(now) {
  if (typeof weeklyReview !== 'function') return '';
  const r = weeklyReview(state, now);
  if (!r.enough) return '';
  return `<div class="st-card wk">
    <div class="st-h">${icon('sparkles')}สัปดาห์นี้</div>
    <div class="wk-nums">
      <span><b>${r.doneCount}</b> งานเสร็จ</span>
      <span><b>${humanMin(r.workedMin)}</b> ที่จับเวลาไว้</span>
      ${r.snoozeCount ? `<span><b>${r.snoozeCount}</b> งานถูกเลื่อน</span>` : ''}
    </div>
    ${r.insights.length ? `<div class="wk-lb">สิ่งที่ระบบเรียนรู้เกี่ยวกับคุณ</div>
      <ul class="wk-list">${r.insights.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <p class="wk-note">ข้อสังเกตพวกนี้ถูกใช้กันเวลาในแผนของสัปดาห์หน้าให้เองแล้ว</p>`
      : `<p class="wk-note">จับเวลาอีกสัก 2–3 งาน แล้วระบบจะเริ่มบอกได้ว่าคุณใช้เวลาจริงต่างจากที่ประเมินไว้แค่ไหน</p>`}
  </div>`;
}

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

  // ---- หน้า "ฉัน" เหลือแค่ตัวเลขสรุป + กราฟ ----
  // ที่เหลือ (ส่งทันกำหนด · เลื่อนงาน · แยกตามวิชา · ช่วงที่ทำงานได้ดี) ย้ายไป scr-stats
  //
  // สามก้อนนั้นเป็นของที่ต้อง "อ่าน" ไม่ใช่ของที่กวาดตาแล้วได้อะไรกลับมา
  // มันเลยดันทางเข้าอื่น (ร้านค้า · เหรียญตรา · บริบทของฉัน) ตกลงไปใต้จอ
  // ทั้งที่คนเข้าหน้านี้มาเพื่อกดเข้าไปที่ใดที่หนึ่ง ไม่ได้มาอ่านสถิติ
  //
  // 1A9g: ทางเข้า scr-stats เหลือปุ่ม "ดูทั้งหมด" ข้างบนอย่างเดียว
  // แถวท้ายบล็อกเคยพาไปจอเดียวกัน — สองปุ่มต่อจอเดียวคือความสับสน ไม่ใช่ทางเลือก
  box.innerHTML = `<button class="st-open" onclick="go('scr-stats')">
      <span class="sec-label">ผลของฉัน</span>
      <span class="st-open-go">ดูทั้งหมด${icon('chevron')}</span>
    </button>
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
        ${days.map(d => `<div class="st-bar${d.today ? ' now' : ''}${d.n ? ' has' : ''}">
          <span class="bar" style="height:${Math.round(d.n / peak * 100)}%"></span>
          <span class="n mono">${d.n || ''}</span>
          <span class="d">${d.label}</span>
        </div>`).join('')}
      </div>
    </div>`;

  renderStatFull(now, { onTimePct, onTime, rated, snoozes, subjRows });
}

// ---------- ผลของฉัน ฉบับเต็ม — จอวิเคราะห์ ----------
// รับตัวเลขที่ renderStats คำนวณไว้แล้วมาใช้ต่อ ไม่คำนวณซ้ำ —
// สองจอที่นับงานเดียวกันคนละรอบ คือสองจอที่มีโอกาสตอบไม่ตรงกัน
//
// กฎเดียวที่คุมทั้งจอนี้: **ทุกตัวเลขต้องมีที่มาจริง**
// จอสรุปผลคือจอที่โกหกง่ายที่สุด เพราะกราฟสวย ๆ ทำให้ตัวเลขที่เดามาดูน่าเชื่อ
// อะไรที่แอปยังไม่มีข้อมูลพอ ก็ไม่ต้องขึ้นการ์ดนั้นเลย ดีกว่าขึ้นแล้วใส่เลขปลอม
// (จึงไม่มีระบบ XP / เลเวล / "ดีขึ้น 18%" ลอย ๆ — พวกนั้นต้องมีฐานข้อมูลที่เรายังไม่ได้เก็บ)
//
// สีทองใช้ได้เฉพาะของที่ "ทำสำเร็จแล้ว" เท่านั้น (สถิติต่อเนื่อง · เหรียญที่ได้)
// ถ้าทองไปโผล่บนของที่ยังไม่ได้ทำ มันก็เลิกแปลว่าสำเร็จทันที
function renderStatFull(now, d) {
  const box = document.getElementById('statFull');
  if (!box) return;

  const live = liveTasks();
  const done = live.filter(t => t.done);
  const DAY = 8.64e7;
  const streak = typeof loginStreak === 'function' ? loginStreak() : 0;

  // ---- เทียบกับสัปดาห์ก่อน ----
  // ไม่มีสัปดาห์ก่อนให้เทียบ = ไม่มีเปอร์เซ็นต์ · "ดีขึ้น 100%" จากศูนย์เป็นหนึ่งไม่ได้แปลว่าอะไร
  const inRange = (t, a, b) => t.doneAt && (now - new Date(t.doneAt)) >= a && (now - new Date(t.doneAt)) < b;
  const thisWk = done.filter(t => inRange(t, 0, 7 * DAY)).length;
  const prevWk = done.filter(t => inRange(t, 7 * DAY, 14 * DAY)).length;
  // ฐานเล็กทำให้เปอร์เซ็นต์ไร้ความหมาย — จาก 1 ใบเป็น 3 ใบ ได้ "+200%" ซึ่งฟังดูใหญ่มาก
  // ทั้งที่แปลว่าทำเพิ่มสองใบ · ต่ำกว่า 3 ใบจึงรายงานเป็นจำนวนใบตรง ๆ ไม่ใช่เปอร์เซ็นต์
  const delta = prevWk >= 3 ? Math.round((thisWk - prevWk) / prevWk * 100) : null;
  const deltaAbs = (delta == null && thisWk !== prevWk) ? thisWk - prevWk : null;

  // ---- สามตัวเลขบนสุด ----
  const tiles = [];
  if (streak > 0) tiles.push({ gold: true, ic: 'flame', v: streak, u: 'วัน',
    k: 'เปิดแอปต่อเนื่อง' });
  if (d.onTimePct != null) tiles.push({ ic: 'check-circle', v: d.onTimePct, u: '%',
    k: 'ส่งทันกำหนด · ' + d.onTime + '/' + d.rated + ' งาน' });
  if (delta != null) tiles.push({ ic: delta >= 0 ? 'medal' : 'clock',
    v: (delta >= 0 ? '+' : '') + delta, u: '%', k: 'เทียบสัปดาห์ก่อน',
    tone: delta >= 0 ? 'up' : 'down' });
  else if (deltaAbs != null) tiles.push({ ic: deltaAbs > 0 ? 'medal' : 'clock',
    v: (deltaAbs > 0 ? '+' : '') + deltaAbs, u: 'งาน', k: 'เทียบสัปดาห์ก่อน',
    tone: deltaAbs > 0 ? 'up' : 'down' });

  // ---- ชั่วโมงที่จับเวลาไว้ 7 วัน ----
  // คนละกราฟกับ "งานที่ติ๊กเสร็จ" ในหน้า "ฉัน" โดยตั้งใจ — อันนั้นนับใบ อันนี้นับนาทีที่นั่งจริง
  // ติ๊กเสร็จสิบใบใน 20 นาที กับนั่งสองชั่วโมงได้ใบเดียว เป็นคนละเรื่องที่ต้องเห็นแยกกัน
  const sess7 = sessions().filter(s => (now - new Date(s.start)) < 7 * DAY);
  const hourDays = [];
  for (let i = 6; i >= 0; i--) {
    const dd = addDays(now, -i);
    const min = sess7.filter(s => new Date(s.start).toDateString() === dd.toDateString())
      .reduce((a, s) => a + s.min, 0);
    hourDays.push({ min, label: WEEKDAY_SHORT[dd.getDay()], today: i === 0 });
  }
  const totalMin7 = hourDays.reduce((a, x) => a + x.min, 0);
  const peakMin = Math.max(1, ...hourDays.map(x => x.min));

  // ---- แยกตามวิชา ----
  // ใช้เวลาที่จับไว้จริงถ้ามีมากพอ · ไม่พอก็ใช้เวลาที่ประเมินไว้ แล้ว**บอกให้รู้ว่าอันไหน**
  // สองอย่างนี้ต่างกันมาก และการเอามาปนกันโดยไม่บอก คือการรายงานเลขที่ไม่มีใครตรวจได้
  const realBySubj = {};
  for (const s of sessions()) {
    const t = state.tasks.find(x => x.id === s.taskId);
    const k = (t && t.subject) || 'อื่น ๆ';
    realBySubj[k] = (realBySubj[k] || 0) + s.min;
  }
  const realTotal = Object.values(realBySubj).reduce((a, b) => a + b, 0);
  const useReal = realTotal >= 30;   // ต่ำกว่าครึ่งชั่วโมงยังเรียกว่าสัดส่วนไม่ได้
  const subjRows = useReal
    ? Object.entries(realBySubj).map(([k, v]) => [k, v]).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : d.subjRows.map(([k, v]) => [k, v.min]).filter(r => r[1] > 0);
  const subjTotal = subjRows.reduce((a, r) => a + r[1], 0);

  // โดนัท — เส้นรอบวงของ r=38 คือ 238.8 · แต่ละชิ้นกินความยาวตามสัดส่วนของตัวเอง
  const CIRC = 238.8;
  let acc = 0;
  const arcs = subjRows.map(([name, min]) => {
    const len = subjTotal ? min / subjTotal * CIRC : 0;
    const a = `<circle class="${subjClass(name)}" cx="48" cy="48" r="38"
      stroke-dasharray="${len.toFixed(1)} ${(CIRC - len).toFixed(1)}"
      stroke-dashoffset="${(-acc).toFixed(1)}"></circle>`;
    acc += len;
    return a;
  }).join('');

  // ---- น้องไซวิเคราะห์ ----
  const wr = typeof weeklyReview === 'function' ? weeklyReview(state, now) : { insights: [] };

  // ---- เหรียญ ----
  // เรียงเหรียญที่ได้แล้วขึ้นก่อน แล้วต่อด้วยใบถัดไปที่ยังไม่ได้ ให้เห็นว่าเป้าต่อไปคืออะไร
  const earned = BADGES.filter(badgeEarned);
  const nextUp = BADGES.filter(b => !badgeEarned(b)).slice(0, Math.max(0, 4 - earned.length));
  const badgeCells = earned.slice(-4).concat(nextUp);

  box.innerHTML = `
    ${tiles.length ? `<div class="an-tiles">
      ${tiles.map(t => `<div class="an-tile${t.gold ? ' gold' : ''}${t.tone ? ' ' + t.tone : ''}">
        <span class="at-ic">${icon(t.ic)}</span>
        <span class="at-v">${t.v}<i>${t.u}</i></span>
        <span class="at-k">${esc(t.k)}</span>
      </div>`).join('')}
    </div>` : ''}

    ${totalMin7 ? `<div class="st-card">
      <div class="st-h">เวลาที่จับไว้ 7 วันล่าสุด<span class="st-h-v">${esc(humanMin(totalMin7))}</span></div>
      <div class="st-bars">
        ${hourDays.map(x => `<div class="st-bar${x.today ? ' now' : ''}${x.min ? ' has' : ''}">
          <span class="bar" style="height:${Math.round(x.min / peakMin * 100)}%"></span>
          <span class="n mono">${x.min ? (Math.round(x.min / 6) / 10) : ''}</span>
          <span class="d">${x.label}</span>
        </div>`).join('')}
      </div>
      <p class="st-foot">ชั่วโมงที่กดจับเวลาไว้จริง ไม่ใช่เวลาที่ประเมิน</p>
    </div>` : ''}

    ${subjRows.length ? `<div class="st-card">
      <div class="st-h">${useReal ? 'เวลาที่จับไว้จริง' : 'เวลาที่ประเมินไว้'} แยกตามวิชา</div>
      <p class="st-foot" style="margin:0 0 10px">${useReal ? 'จากทุกรอบที่จับเวลาไว้ ไม่ใช่แค่ 7 วันล่าสุด'
        : 'ยังจับเวลาไม่พอจะแยกตามวิชาได้ — นี่คือเวลาที่กรอกไว้ตอนเพิ่มงาน'}</p>
      <div class="an-split">
        <div class="an-legend">
          ${subjRows.map(([name, min]) => {
            const pct = subjTotal ? Math.round(min / subjTotal * 100) : 0;
            return `<div class="an-lg ${subjClass(name)}">
              <span class="lg-dot"></span>
              <span class="lg-nm">${esc(name)}</span>
              <span class="lg-bar"><i style="width:${pct}%"></i></span>
              <span class="lg-pct mono">${pct}%</span>
            </div>`;
          }).join('')}
        </div>
        <div class="an-donut">
          <svg viewBox="0 0 96 96" aria-hidden="true">
            <circle class="dn-bg" cx="48" cy="48" r="38"></circle>${arcs}
          </svg>
          <span class="dn-mid"><i>รวม</i><b>${Math.round(subjTotal / 6) / 10}</b><i>ชม.</i></span>
        </div>
      </div>
    </div>` : ''}

    ${d.snoozes ? `<div class="st-card soft">
      <div class="st-line">${icon('clock')}เลื่อนงานไปแล้วรวม <b>${d.snoozes}</b> ครั้ง</div>
    </div>` : ''}

    ${wr.insights.length ? `<div class="an-ai">
      <div class="an-ai-h">${icon('sparkles')}น้องไซวิเคราะห์</div>
      <ul>${wr.insights.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <p class="an-ai-note">ข้อสังเกตพวกนี้ถูกใช้กันเวลาในแผนของสัปดาห์หน้าให้เองแล้ว</p>
    </div>` : ''}

    ${workStatsHtml(now)}

    ${badgeCells.length ? `<div class="an-grp">ความสำเร็จ<button onclick="go('scr-badges')">ดูทั้งหมด${icon('chevron')}</button></div>
    <div class="an-badges">
      ${badgeCells.map(b => { const got = badgeEarned(b);
        return `<div class="an-bd${got ? ' got' : ''}">
          <span class="ab-mark">${got ? esc(b.mark) : icon('lock')}</span>
          <span class="ab-nm">${esc(b.name)}</span>
          <span class="ab-ds">${got ? 'ได้แล้ว' : 'ทำให้ครบ ' + b.goal + ' งาน'}</span>
        </div>`;
      }).join('')}
    </div>` : ''}

    ${d.onTimePct == null && !subjRows.length && !totalMin7 ? `<div class="st-card soft">
      <div class="st-line">${icon('check-circle')}ยังไม่มีอะไรให้วิเคราะห์ —
        ติ๊กงานให้เสร็จสักสองสามใบ แล้วกดจับเวลาตอนนั่งทำ หน้านี้จะเริ่มมีของ</div>
    </div>` : ''}`;
}

// ---------- ประสิทธิภาพ: อ่านจากรอบจับเวลาจริงเท่านั้น ----------
// ทุกตัวเลขในบล็อกนี้มาจากที่เขากดเริ่ม–หยุดเอง ไม่มีอันไหนเดา
// และไม่โผล่มาก่อนจะมีข้อมูลพอ — สถิติจากสามรอบแรกคือการเดาที่ใส่กราฟให้ดูน่าเชื่อ
const WORK_MIN_SESSIONS = 5;
const HOUR_BANDS = [
  { from: 5,  to: 12, name: 'ช่วงเช้า' },
  { from: 12, to: 17, name: 'ช่วงบ่าย' },
  { from: 17, to: 21, name: 'ช่วงหัวค่ำ' },
  { from: 21, to: 29, name: 'ช่วงดึก' },   // 29 = ตี 5 ของวันถัดไป
];

function bandOf(hour) {
  const h = hour < 5 ? hour + 24 : hour;
  return HOUR_BANDS.find(b => h >= b.from && h < b.to) || HOUR_BANDS[3];
}

function workStatsHtml(now) {
  const all = sessions();
  if (all.length < WORK_MIN_SESSIONS) {
    return `<div class="st-card soft">
      <div class="st-line">${icon('clock')}กดเริ่มจับเวลาในหน้าแผนอีก
        <b>${WORK_MIN_SESSIONS - all.length}</b> รอบ แล้วจะเริ่มบอกได้ว่าคุณทำงานได้ดีที่สุดช่วงไหน</div>
    </div>`;
  }

  const week = all.filter(s => (now - new Date(s.start)) < 7 * 8.64e7);
  const weekH = Math.round(week.reduce((a, s) => a + s.min, 0) / 6) / 10;

  // ช่วงที่ทำได้เยอะสุด — วัดด้วยนาทีรวม ไม่ใช่จำนวนรอบ
  // นับเป็นรอบจะทำให้การกดเริ่ม–หยุดถี่ ๆ ตอนใจลอยชนะการนั่งยาวหนึ่งรอบ
  const byBand = {};
  for (const s of all) {
    const b = bandOf(new Date(s.start).getHours()).name;
    byBand[b] = (byBand[b] || 0) + s.min;
  }
  const bands = Object.entries(byBand).sort((a, b) => b[1] - a[1]);
  const topBand = bands[0];
  const bandTotal = bands.reduce((a, b) => a + b[1], 0);

  // ความแม่นของการประเมินเวลา — เทียบเฉพาะงานที่ทำเสร็จแล้วและมีทั้งสองตัวเลข
  // งานที่ยังทำค้างอยู่เอามาเทียบไม่ได้ เพราะเวลาที่ลงไปยังไม่ใช่เวลาทั้งหมดของมัน
  const rows = [];
  for (const t of liveTasks()) {
    if (!t.done || !t.estMin) continue;
    const did = workedMin(t.id);
    if (did >= 1) rows.push({ est: t.estMin, did });
  }
  // งานเดียวบอกอะไรไม่ได้ — วันที่ไม่มีสมาธิวันเดียวก็ทำให้ตัวเลขเพี้ยนไป 80% ได้แล้ว
  // พูดว่า "คุณประเมินพลาด 83%" จากตัวอย่างเดียวคือการโกหกที่ใส่เปอร์เซ็นต์ให้ดูน่าเชื่อ
  const estSum = rows.reduce((a, r) => a + r.est, 0);
  const didSum = rows.reduce((a, r) => a + r.did, 0);
  const ratio = (rows.length >= 3 && estSum) ? didSum / estSum : null;

  return `<div class="st-card">
      <div class="st-h">ช่วงเวลาที่ทำงานได้ดี</div>
      <!-- เลิกรายงาน "7 วันล่าสุด X ชม." ตรงนี้แล้ว — กราฟแท่งเหนือการ์ดนี้บอกตัวเลขเดียวกัน
           ของที่การ์ดนี้มีของตัวเองจริงคือการแยกตามช่วงเวลา กับความแม่นของการประเมิน -->
      <div class="st-line">จาก ${all.length} รอบที่จับเวลาไว้</div>
      ${topBand ? `<div class="st-bands">
        ${bands.map(([nm, min]) => `<div class="st-band">
          <span class="nm">${esc(nm)}</span>
          <span class="tr"><i style="width:${Math.round(min / bandTotal * 100)}%"></i></span>
          <span class="ct mono">${Math.round(min / 6) / 10} ชม.</span>
        </div>`).join('')}
      </div>
      <div class="st-line soft">ลงมือได้มากที่สุด<b>${esc(topBand[0])}</b> —
        ถ้าเลือกได้ กันงานหนักไว้ช่วงนั้น</div>` : ''}
    </div>
    ${ratio ? `<div class="st-card">
      <div class="st-h">ประเมินเวลาแม่นแค่ไหน</div>
      <div class="st-line">${ratio > 1.15
        ? `ใช้จริงมากกว่าที่ประเมินไว้ <b>${Math.round((ratio - 1) * 100)}%</b> —
           เผื่อเวลาเพิ่มอีกหน่อยตอนกรอกงานใหม่ แผนจะได้ไม่พังกลางทาง`
        : ratio < 0.85
        ? `ใช้จริงน้อยกว่าที่ประเมินไว้ <b>${Math.round((1 - ratio) * 100)}%</b> —
           ประเมินเผื่อไว้เยอะ กล้าใส่งานเพิ่มในวันเดียวกันได้`
        : `ประเมินได้ใกล้เคียงของจริงมาก (คลาดเคลื่อนไม่ถึง 15%) — เชื่อตัวเลขตัวเองได้เลย`}
        <span class="soft">· จาก ${rows.length} งานที่จับเวลาไว้</span></div>
    </div>` : ''}`;
}

function renderAll() {
  renderMenu(); renderHome(); renderTasks(); renderTimeline(); renderAi();
  renderProfile(); renderStats(); renderPlan(); renderFriends(); renderBadges();
  renderShop(); renderPro(); renderWheel(); renderInstallCard(); renderTabBadges(); renderContext();
  renderRunBar();
  // ระบบ LINE ของอีกสาย — เรียกเมื่อไฟล์ถูกโหลดจริงเท่านั้น
  // (กันแอปพังทั้งจอถ้าไฟล์ inbox.js/linelink.js โหลดไม่ขึ้น)
  if (typeof renderInbox === 'function') renderInbox();
  if (typeof renderSources === 'function') renderSources();
  if (typeof renderRoom === 'function') renderRoom();
  if (typeof renderMates === 'function') renderMates();
  if (typeof renderFeed === 'function') renderFeed();
}

// ---------- สแกนตารางเรียนจากรูป ----------
// ท่อ: เลือกรูป → ย่อในเครื่อง → Edge Function (Gemini อ่าน) → หน้าตรวจ → เขียนลงบริบท
//
// ขั้น "ตรวจ" ตัดออกไม่ได้เด็ดขาด แม้โมเดลจะแม่นแค่ไหน — คาบเรียนที่ผิดหนึ่งคาบ
// จะกลายเป็น "เวลาที่ไม่ว่าง" ในแผนของเขาไปทุกสัปดาห์ โดยไม่มีอะไรบอกว่ามันมาจากไหน
// รูปแบบเดียวกับหน้า "ตรวจก่อนบันทึก" ของใบงาน: AI เสนอ คนเป็นคนเคาะ
const TT_MAX_LONG = 1600;   // ตัวอักษรในตารางเล็กกว่าใบงาน ย่อมากกว่านี้แล้วอ่านไม่ออก
const TT_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

let ttState = { phase: 'pick', rows: [], note: '', error: '' };

function openTtScan() {
  ttState = { phase: 'pick', rows: [], note: '', error: '' };
  renderTtScan();
  go('scr-ttscan');
}

// ย่อก่อนส่งเสมอ — รูปจากกล้องมือถือ 4 MB ที่ส่งดิบ ๆ คือเน็ตมือถือของเด็กหนึ่งก้อน
// และโควตาที่จ่ายไปโดยไม่ได้ความแม่นเพิ่มขึ้นเลย
async function ttShrink(file) {
  const img = await ocrLoadBitmap(file);
  const long = Math.max(img.width, img.height);
  const k = long > TT_MAX_LONG ? TT_MAX_LONG / long : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  // 0.85 เพราะเส้นตารางกับตัวเลขบาง ๆ แตกง่ายกว่าตัวหนังสือบนใบงาน
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

async function ttPick(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (!currentUser) {
    ttState = { phase: 'pick', rows: [], note: '',
      error: 'ตัวอ่านตารางทำงานบนเซิร์ฟเวอร์ ต้องล็อกอินก่อนถึงจะใช้ได้ — กรอกเองในหน้าบริบทได้ตามปกติ' };
    return renderTtScan();
  }
  ttState = { phase: 'reading', rows: [], note: '', error: '' };
  renderTtScan();
  try {
    const image = await ttShrink(file);
    const { data, error } = await sb.functions.invoke('read-timetable', { body: { image, mime: 'image/jpeg' } });
    if (error) throw new Error(error.message || 'เรียกตัวอ่านไม่สำเร็จ');
    if (data && data.error) throw new Error(data.error);
    const rows = (data && data.classes || []).map(r => ({ ...r, on: true }));
    ttState = { phase: rows.length ? 'review' : 'pick', rows,
      note: (data && data.note) || '',
      error: rows.length ? '' : ((data && data.note) || 'อ่านตารางจากรูปนี้ไม่ได้ — ลองถ่ายให้ตรงและชัดขึ้น') };
  } catch (e) {
    ttState = { phase: 'pick', rows: [], note: '', error: e.message };
  }
  renderTtScan();
}

function ttSet(i, key, val) {
  const r = ttState.rows[i];
  if (!r) return;
  r[key] = key === 'day' ? +val : val;
  if (key !== 'on') r.on = true;    // แก้แถวไหน = ตั้งใจเก็บแถวนั้น
  renderTtScan();
}
function ttToggle(i) {
  const r = ttState.rows[i];
  if (r) { r.on = !r.on; renderTtScan(); }
}

// เขียนลงบริบท — เพิ่มเข้าไป ไม่ล้างของเดิม
// คนที่สแกนซ้ำเพราะเทอมใหม่ควรได้ลบของเก่าเองด้วยปุ่มที่เขียนว่าลบ ไม่ใช่โดนลบเพราะกดสแกน
function ttSave() {
  const keep = ttState.rows.filter(r => r.on && hm2min(r.start) != null &&
    hm2min(r.end) != null && hm2min(r.end) > hm2min(r.start));
  if (!keep.length) return;
  for (const r of keep) {
    ctxUpsert('class', { subject: r.subject.trim() || 'เรียน', start: r.start, end: r.end,
      weekday: [r.day] });
  }
  haptic('done');
  renderAll();
  go('scr-context');
  showToast({ title: `บันทึก ${keep.length} คาบเรียนแล้ว`,
    body: 'แผนวันนี้จะเลี่ยงเวลาเรียนให้เองตั้งแต่ตอนนี้' });
}

function renderTtScan() {
  const body = document.getElementById('ttBody');
  if (!body) return;
  const { phase, rows, error } = ttState;

  if (phase === 'reading') {
    body.innerHTML = `<div class="tt-wait">
      <div class="tt-spin"></div>
      <b>กำลังอ่านตาราง…</b>
      <span>ปกติใช้เวลาไม่เกิน 10 วินาที</span>
    </div>`;
    return;
  }

  if (phase === 'pick') {
    body.innerHTML = `
      ${error ? `<div class="tt-err">${icon('clock')}<span>${esc(error)}</span></div>` : ''}
      <div class="tt-intro">
        <div class="tt-ring">${icon('camera')}</div>
        <b>ถ่ายรูปตารางเรียนให้เห็นทั้งสัปดาห์</b>
        <p>วางให้ตรง ไม่เอียง เห็นทั้งชื่อวันและเวลาแต่ละคาบ — AI จะอ่านให้
          แล้วคุณตรวจแก้ได้ทุกคาบก่อนบันทึก</p>
      </div>
      <button class="tt-cta" onclick="document.getElementById('ttFile').click()">
        ${icon('camera')}เลือกรูปตารางเรียน</button>
      <p class="tt-foot">รูปถูกส่งไปให้ Gemini อ่านครั้งเดียวแล้วทิ้ง ไม่ได้ถูกเก็บไว้ที่ไหน
        · ส่วนอื่นของบริบทยังคำนวณในเครื่องเหมือนเดิม</p>`;
    return;
  }

  const on = rows.filter(r => r.on).length;
  body.innerHTML = `
    <div class="tt-sum">อ่านได้ <b>${rows.length}</b> คาบ — เลือกไว้ ${on} คาบ
      ${ttState.note ? `<span class="tt-note">${esc(ttState.note)}</span>` : ''}</div>
    <p class="tt-hint">ตรวจให้ครบก่อนบันทึก โดยเฉพาะเวลาเริ่ม–เลิก คาบที่ผิดจะไปกินเวลาว่างในแผนทุกสัปดาห์</p>
    <div class="tt-list">
      ${rows.map((r, i) => `<div class="tt-row${r.on ? '' : ' off'}">
        <button class="tt-ck${r.on ? ' on' : ''}" onclick="ttToggle(${i})"
          aria-label="${r.on ? 'ไม่เอาคาบนี้' : 'เอาคาบนี้'}">${icon('check')}</button>
        <div class="tt-fields">
          <input class="tt-sub" type="text" value="${esc(r.subject)}" maxlength="40"
            oninput="ttSet(${i},'subject',this.value)">
          <div class="tt-when">
            <select onchange="ttSet(${i},'day',this.value)">
              ${TT_DAYS.map((d, n) => `<option value="${n}"${n === r.day ? ' selected' : ''}>${d}</option>`).join('')}
            </select>
            <input type="time" value="${esc(r.start)}" onchange="ttSet(${i},'start',this.value)">
            <span class="tt-dash">–</span>
            <input type="time" value="${esc(r.end)}" onchange="ttSet(${i},'end',this.value)">
          </div>
        </div>
      </div>`).join('')}
    </div>
    <div class="tt-act">
      <button class="fm-save" onclick="ttSave()" ${on ? '' : 'disabled'}>บันทึก ${on} คาบเข้าบริบท</button>
      <button class="fm-cancel" onclick="openTtScan()">ถ่ายใหม่</button>
    </div>`;
}

// ---------- เวลาทำงานจริง ----------
// จนถึงตอนนี้แอปรู้แค่ "ประเมินไว้กี่นาที" กับ "กดเสร็จตอนกี่โมง" ซึ่งไม่พอจะพูดได้เลยว่า
// เขาทำงานได้ดีตอนไหน หรือประเมินเวลาแม่นแค่ไหน — สองอย่างนั้นต้องรู้ว่า
// "นั่งทำจริงตั้งแต่กี่โมงถึงกี่โมง" ซึ่งไม่มีทางเดาจากข้อมูลเดิมได้
//
// เก็บเป็นรายการรอบ ไม่ใช่ยอดรวมในตัวงาน เพราะคำถามที่อยากตอบคือคำถามเรื่องเวลา
// ("ช่วงไหนของวันทำได้เยอะสุด") ยอดรวมตอบไม่ได้ ต้องมีหัวท้ายของแต่ละรอบ
//
// state.running อยู่ใน state ที่เซฟลงเครื่อง ไม่ใช่ตัวแปรลอย ๆ — เด็กกดเริ่มแล้ววางมือถือ
// หน้าจอดับ เบราว์เซอร์ทิ้งแท็บ กลับมาอีกทีต้องยังจับเวลาอยู่ ไม่ใช่เริ่มนับหนึ่งใหม่
const SESSION_CAP = 400;        // เก็บย้อนหลังเท่านี้พอ ก้อนที่ซิงก์ขึ้น cloud จะได้ไม่บวม
const SESSION_STALE_H = 4;      // เกินเท่านี้ = ลืมกดหยุด ไม่ใช่การนั่งทำจริง

function sessions() {
  if (!Array.isArray(state.sessions)) state.sessions = [];
  return state.sessions;
}
function runningWork() { return state.running || null; }

// รอบที่ค้างมาจากการเปิดแอปครั้งก่อน — ถ้านานเกินจริงให้ทิ้ง ไม่ใช่บันทึกไว้
// ข้อมูลมั่ว ๆ อันเดียวทำให้ "ช่วงที่ทำได้ดีที่สุด" เพี้ยนไปทั้งสัปดาห์
// และคนใช้จะเลิกเชื่อตัวเลขนั้นทันทีที่เห็นว่ามันไม่ตรงกับที่ตัวเองจำได้
function reapStaleWork() {
  const r = runningWork();
  if (!r) return null;
  const h = (Date.now() - new Date(r.start)) / 3.6e6;
  if (h <= SESSION_STALE_H) return null;
  state.running = null;
  save();
  return r;
}

function startWork(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;
  const r = runningWork();
  if (r && r.taskId === taskId) return;
  if (r) stopWork(true);                       // สลับงาน = ปิดรอบเดิมให้เอง ไม่ทิ้งค้าง
  state.running = { taskId, start: new Date().toISOString() };
  save();
  haptic('tap');
  renderAll();
}

// quiet = สลับงานอัตโนมัติ ไม่ต้องเด้ง toast ซ้อนกับรอบใหม่ที่กำลังจะเริ่ม
function stopWork(quiet) {
  const r = runningWork();
  if (!r) return;
  const start = new Date(r.start);
  const min = Math.round((Date.now() - start) / 60000);
  state.running = null;
  // ต่ำกว่าหนึ่งนาทีคือกดพลาด ไม่ใช่การทำงาน — บันทึกไปก็มีแต่ทำให้ค่าเฉลี่ยเพี้ยน
  if (min >= 1) {
    sessions().push({ id: uid(), taskId: r.taskId, start: r.start,
      end: new Date().toISOString(), min });
    if (sessions().length > SESSION_CAP) state.sessions = sessions().slice(-SESSION_CAP);
    syncProgress(r.taskId);
  }
  save();
  if (!quiet && min >= 1) {
    const t = state.tasks.find(x => x.id === r.taskId);
    const total = workedMin(r.taskId);
    const est = t && t.estMin;
    // เทียบกับที่ประเมินไว้ทุกครั้ง — คนจะได้ค่อย ๆ รู้จักความเร็วของตัวเอง
    // โดยไม่ต้องเปิดหน้าสถิติ ซึ่งเป็นหน้าที่คนส่วนใหญ่ไม่เคยเปิด
    const cmp = est ? (total > est ? ` · เกินที่ประเมินไว้ ${total - est} นาที`
      : ` · ยังเหลือโควตาอีก ${est - total} นาที`) : '';
    showToast({ title: `จับเวลาไว้ ${min} นาที`,
      body: (t ? taskTitleText(t) : 'งานนี้') + ` — รวมทำไปแล้ว ${total} นาที${cmp}` });
  }
  haptic('tap');
  renderAll();
}

function workedMin(taskId) {
  return sessions().filter(s => s.taskId === taskId).reduce((a, s) => a + s.min, 0);
}

// เวลาที่จับได้ต้องไหลกลับเข้าแผน
//
// เดิมนาฬิกาเดินแล้วก็จบแค่นั้น: นั่งทำงาน 40 นาทีไป 70 นาที แต่ t.progress ไม่ถูกแตะเลย
// buildDayPlan คิดเวลาที่เหลือจาก estMin × (1 − progress/100) แผนพรุ่งนี้จึงยังกันเวลา
// ให้งานใบนั้นเต็ม 40 นาทีเหมือนไม่เคยทำอะไรไป — แล้วผู้ใช้ก็เห็นว่าแผนไม่รู้เรื่องตัวเอง
//
// เพดาน 95 ไม่ใช่ 100 โดยตั้งใจ: "เสร็จ" เป็นคำที่คนเป็นคนพูด ไม่ใช่นาฬิกา
// งานที่นั่งครบเวลาแล้วแต่ยังไม่พอใจกับมัน ยังไม่เสร็จ
function syncProgress(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t || t.done || !TASK_TYPES[taskType(t)].schedulable) return;
  // งานที่แตกขั้นตอนไว้แล้ว ความคืบหน้ามาจากขั้นที่ติ๊ก ไม่ใช่จากเวลาที่ผ่านไป
  // (นั่งอยู่หน้าจอหนึ่งชั่วโมงโดยยังไม่ได้เริ่มขั้นแรก เป็นเรื่องที่เกิดขึ้นจริง)
  const byStep = typeof stepProgress === 'function' ? stepProgress(t) : null;
  if (byStep != null) { t.progress = byStep; return; }
  const est = t.estMin || 30;
  t.progress = Math.max(t.progress || 0, Math.min(95, Math.round(workedMin(taskId) / est * 100)));
}

function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  const two = v => String(v).padStart(2, '0');
  return h ? h + ':' + two(m % 60) + ':' + two(s % 60) : m + ':' + two(s % 60);
}

// แถบจับเวลา — วาดโครงครั้งเดียวแล้วขยับแค่ตัวเลข
// วาดใหม่ทุกวินาทีจะทำให้ปุ่มหยุดถูกสร้างใหม่ใต้นิ้วที่กำลังกดอยู่พอดี แล้วกดไม่ติด
function renderRunBar() {
  const bar = document.getElementById('runBar');
  if (!bar) return;
  const r = runningWork();
  // ล้าง dataset.for ทุกครั้งที่เก็บแถบ ไม่งั้นพอเริ่มจับเวลา "งานใบเดิม" อีกรอบ
  // เงื่อนไขข้างล่างจะคิดว่าโครงยังอยู่ทั้งที่ innerHTML ถูกล้างไปแล้ว แล้ว .rb-el เป็น null
  if (!r) { bar.hidden = true; bar.innerHTML = ''; delete bar.dataset.for; return; }
  const t = state.tasks.find(x => x.id === r.taskId);
  if (!t) { state.running = null; save(); bar.hidden = true; bar.innerHTML = ''; delete bar.dataset.for; return; }
  if (bar.dataset.for !== r.taskId) {
    bar.dataset.for = r.taskId;
    bar.innerHTML = `<span class="rb-dot"></span>
      <span class="rb-tx"><b class="rb-tt"></b><span class="rb-el mono"></span></span>
      <button class="rb-stop" onclick="stopWork()">หยุด</button>`;
    bar.querySelector('.rb-tt').textContent = taskTitleText(t);
  }
  bar.hidden = false;
  bar.querySelector('.rb-el').textContent = fmtElapsed(Date.now() - new Date(r.start));
}

// ============================================================
// โหมดโฟกัส — จอที่เหลือแค่ "งานที่กำลังทำ" กับ "เวลาที่เดินอยู่"
// ============================================================
// ลูกโซ่ของโปรดักต์คือ เลือกให้ → เริ่มทำ → ทำเสร็จ → บอกงานถัดไป
// ก่อนหน้านี้ขาดตรงกลางทั้งท่อน: กด "เริ่มจับเวลา" แล้วยังอยู่ในจอเดิมที่มีงานอีกสิบใบ
// ปุ่มอีกยี่สิบปุ่ม และแถบเมนูล่างชวนไปที่อื่น — คือการเลือกงานให้แล้วปล่อยให้หลุดเอง
//
// จอนี้ไม่มีทางออกอื่นนอกจากสามปุ่ม: เสร็จ · พัก · ออก
// และตอนกดเสร็จ มันบอกชื่องานถัดไปทันที ไม่ใช่แค่คำชมแล้วโยนกลับหน้าแรก

let focusId = null;
let focusTimer = null;

function startFocus(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  const wrap = document.getElementById('focusWrap');
  // เครื่องที่ยังเสิร์ฟ index.html เก่าจากแคช service worker จะไม่มีกล่องนี้
  // ถอยไปจับเวลาแบบเดิมดีกว่าโยน error ทิ้งไว้แล้วปุ่มกดไม่ติดโดยไม่มีอะไรอธิบาย
  if (!t) return;
  if (!wrap) { startWork(taskId); return; }
  focusId = taskId;
  if (typeof ensureSteps === 'function') { ensureSteps(t); save(); }
  const r = runningWork();
  if (!r || r.taskId !== taskId) startWork(taskId);   // startWork เรียก renderAll ให้เอง
  renderFocus();
  wrap.hidden = false;
  document.body.classList.add('focus-on');
  clearInterval(focusTimer);
  focusTimer = setInterval(tickFocus, 1000);
  haptic('arm');
}

// Esc ออกจากโหมดโฟกัส — คนที่ใช้บนคอมคาดหวังปุ่มนี้กับทุกอย่างที่ทับเต็มจอ
// ไม่มีให้แล้วต้องไปเล็งกากบาทเล็ก ๆ มุมซ้ายบน ซึ่งเป็นการเพิ่มแรงเสียดทานให้ทางออก
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && focusId) closeFocus();
});

function closeFocus(keepRunning) {
  clearInterval(focusTimer); focusTimer = null;
  const wrap = document.getElementById('focusWrap');
  if (wrap) { wrap.hidden = true; wrap.innerHTML = ''; }
  document.body.classList.remove('focus-on');
  focusId = null;
  if (!keepRunning) stopWork();
  else renderAll();
}

// นาฬิกาเดินทุกวินาที แต่วาดใหม่แค่ตัวเลข — วาดทั้งจอทุกวินาทีจะสร้างปุ่มใหม่ใต้นิ้วที่กำลังกดอยู่
function tickFocus() {
  const r = runningWork();
  const el = document.getElementById('fcElapsed');
  if (!el) return;
  if (!r) { el.textContent = 'หยุดอยู่'; return; }
  el.textContent = fmtElapsed(Date.now() - new Date(r.start));

  // เลยเวลาที่ตั้งใจไว้ = ข้อมูล ไม่ใช่คำตำหนิ · ใช้บอกให้พักหรือปิดงานตรงนี้ก่อน
  const t = state.tasks.find(x => x.id === focusId);
  const cap = document.getElementById('fcOver');
  if (t && cap) {
    const target = (focusStep(t) || {}).min || t.estMin || 30;
    const spent = Math.round((Date.now() - new Date(r.start)) / 60000);
    cap.hidden = spent <= target;
    if (spent > target) cap.textContent = `เลยที่ตั้งใจไว้ ${spent - target} นาที — พักสักหน่อยหรือปิดตรงนี้ก่อนก็ได้`;
  }
}

function focusStep(t) {
  return typeof nextStep === 'function' ? nextStep(t) : null;
}

// ติ๊กขั้นตอน = ความคืบหน้าจริง ไม่ใช่แถบเลื่อนที่ผู้ใช้ลากเอาเอง
// ความคืบหน้าตัวนี้ไหลกลับเข้าแผนทันที (buildDayPlan กันเวลาให้เท่าที่เหลือจริง)
function toggleStep(stepId) {
  const t = state.tasks.find(x => x.id === focusId);
  if (!t || !t.steps) return;
  const s = t.steps.find(x => x.id === stepId);
  if (!s) return;
  s.done = !s.done;
  syncProgress(t.id);
  save();
  _planCache = null;
  renderFocus();
  haptic('tap');
  // ขั้นสุดท้ายถูกติ๊ก = งานเสร็จจริง ไม่ต้องให้กดซ้ำอีกปุ่ม
  if (t.steps.every(x => x.done)) setTimeout(() => finishFocus(), 350);
}

function renderFocus() {
  const wrap = document.getElementById('focusWrap');
  const t = state.tasks.find(x => x.id === focusId);
  if (!wrap || !t) return;
  const step = focusStep(t);
  const steps = t.steps || [];
  const target = (step || {}).min || t.estMin || 30;

  wrap.innerHTML = `<div class="fc-sheet">
    <div class="fc-top">
      <button class="fc-x" onclick="closeFocus()" aria-label="ออกจากโหมดโฟกัส">${icon('x')}</button>
      <span class="fc-sub">${esc(fmtDue(t.due, new Date(), t))}</span>
    </div>

    <div class="fc-head">
      ${t.subject && t.subject !== 'อื่น ๆ' ? `<div class="fc-subj">${esc(t.subject)}</div>` : ''}
      <h2 class="fc-title">${esc(t.detail || 'งานนี้')}</h2>
    </div>

    <div class="fc-clock">
      <div class="fc-el mono" id="fcElapsed">0:00</div>
      <div class="fc-target">ตั้งใจไว้ ~${target} นาที</div>
    </div>
    <div class="fc-over" id="fcOver" hidden></div>

    ${step ? `<div class="fc-now">
      <span class="fn-lb">ตอนนี้ทำ</span>
      <b>${esc(step.title)}</b>
    </div>` : ''}

    ${steps.length ? `<div class="fc-steps">
      ${steps.map(s => `<button class="fs-row${s.done ? ' done' : ''}${s === step ? ' cur' : ''}"
        onclick="toggleStep('${s.id}')">
        <span class="fs-tick">${icon('check')}</span>
        <span class="fs-tx">${esc(s.title)}</span>
        <span class="fs-min mono">${s.min}น</span>
      </button>`).join('')}
    </div>` : ''}

    <div class="fc-act">
      <button class="fc-done" onclick="finishFocus()">${icon('check')}ทำเสร็จแล้ว</button>
      <button class="fc-pause" onclick="closeFocus(false)">${icon('pause')}พักก่อน</button>
    </div>
  </div>`;
  tickFocus();
}

// เสร็จแล้วต้องรู้ทันทีว่าอะไรต่อ — นี่คือข้อต่อสุดท้ายของลูกโซ่ ที่ขาดมาตลอด
function finishFocus() {
  const t = state.tasks.find(x => x.id === focusId);
  if (!t) { closeFocus(); return; }
  stopWork(true);
  t.done = true;
  t.progress = 100;
  t.doneAt = new Date().toISOString();
  save();
  _planCache = null;
  haptic('done');

  const sp = todayPlan(new Date());
  const nxt = sp.now;
  clearInterval(focusTimer); focusTimer = null;

  const wrap = document.getElementById('focusWrap');
  wrap.innerHTML = `<div class="fc-sheet done">
    <div class="fc-win">${icon('check-circle')}</div>
    <h2 class="fc-wt">เสร็จแล้ว</h2>
    <p class="fc-wp">${esc(taskTitleText(t))}</p>
    ${nxt ? `<div class="fc-next">
      <span class="fn-lb">งานถัดไป</span>
      <b>${taskTitle(nxt.task)}</b>
      <span class="fn-min">~${nxt.task.estMin || 30} นาที · ${esc(topReason(nxt.info))}</span>
      <button class="fc-go" onclick="startFocus('${nxt.task.id}')">${icon('play')}ทำต่อเลย</button>
      <button class="fc-later" onclick="closeFocus(true)">พอแค่นี้ก่อน</button>
    </div>` : `<div class="fc-next">
      <b>ไม่เหลืองานค้างแล้ว</b>
      <span class="fn-min">วันนี้พักได้เต็มที่</span>
      <button class="fc-later" onclick="closeFocus(true)">กลับหน้าแรก</button>
    </div>`}
  </div>`;
  celebrate(document.querySelector('.fc-win'));
  setTimeout(checkBadges, 1800);
}

// ---------- task actions ----------
// el = ปุ่มที่กด (ถ้ามี) ใช้เป็นจุดกำเนิดของเอฟเฟกต์ฉลอง
function toggleDone(id, el) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const wasDone = t.done;
  // ติ๊กเสร็จทั้งที่ยังจับเวลางานใบนี้อยู่ = จบรอบพอดี ปิดให้เลย
  // ไม่ปิดให้แล้วนาฬิกาจะเดินต่อไปทั้งคืนกับงานที่เสร็จไปแล้ว
  const r = runningWork();
  if (!t.done && r && r.taskId === id) stopWork(true);
  t.done = !t.done;
  t.progress = t.done ? 100 : (t.progress === 100 ? 0 : t.progress);
  t.doneAt = t.done ? new Date().toISOString() : null;
  if (!wasDone && t.done) funnelDone();   // ต้องอยู่ก่อน save() จะได้เขียนลงไปในรอบเดียวกัน
  save();

  if (!wasDone && t.done) {
    // ให้เห็นจังหวะฉลองก่อน แล้วค่อยวาดรายการใหม่ (ไม่งั้นปุ่มหายไปก่อนดูจบ)
    if (el) { el.classList.add('on', 'pop'); }
    celebrate(el);
    haptic('done'); // ALT: จังหวะคู่ ให้รู้สึกว่า "เช็คสำเร็จ" ไม่ใช่แค่ภาพเปลี่ยน
    const cleared = pendingTasks().length === 0;
    setTimeout(() => {
      renderAll();
      // คำชมที่ไม่บอกว่างานถัดไปคืออะไร คือคำชมที่ทำให้ต้องกลับไปนั่งเลือกใหม่เอง
      // ลูกโซ่ เริ่ม → เสร็จ → ต่อ ขาดตรงนี้มาตลอด ทั้งที่ตัวจัดแผนรู้คำตอบอยู่แล้ว
      const sp = todayPlan(new Date());
      showToast(cleared || !sp.now ? celebrateCopy(true) : {
        title: 'เยี่ยม! เสร็จอีกงาน 💪',
        body: 'ต่อไป: ' + taskTitleText(sp.now.task) + ' · ~' + (sp.now.task.estMin || 30) + ' นาที',
      });
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
let formFromScan = false;  // งานใบที่กำลังกรอกอยู่ มาจาก AI อ่านให้หรือพิมพ์เอง (ดู openForm)

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

// ---------- ALT 1A7V2: ช่องข้อความที่ยืดตามเนื้อหา ----------
// ต้องรีเซ็ตเป็น auto ก่อนอ่าน scrollHeight ทุกครั้ง ไม่งั้นกล่องจะโตอย่างเดียวไม่หดกลับ
// (scrollHeight ของกล่องที่ถูกตรึงความสูงไว้แล้ว จะไม่มีทางน้อยกว่าความสูงที่ตรึงไว้)
// เพดาน 40% ของความสูงจอ — ข้อความยาวมากยังต้องเห็นปุ่มบันทึกโดยไม่ต้องเลื่อนทั้งฟอร์ม
function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  const cap = Math.round(window.innerHeight * 0.4);
  const need = el.scrollHeight;
  el.style.height = Math.min(need, cap) + 'px';
  el.style.overflowY = need > cap ? 'auto' : 'hidden';
}

// จอที่ควรกลับไปหลังบันทึก/ยกเลิก — แก้งานจากรายการไหน ก็เด้งกลับรายการนั้น
let formReturn = 'scr-home';

function openForm(id, parsed) {
  editingId = id;
  // งานใบนี้มาจาก "AI อ่านให้" หรือ "พิมพ์เองทีละช่อง"
  //
  // ตัวเลขนี้คือ capture rate — สัดส่วนงานที่เข้าระบบโดยผู้ใช้ไม่ต้องพิมพ์
  // ซึ่งเป็นตัวชี้เป็นชี้ตายของโปรดักต์ ("ไม่ต้องพิมพ์" คือคำสัญญาทั้งหมดของหน้าเพิ่มงาน)
  // เดิม saveForm เขียน fromScan: !!data._scan โดยที่ไม่มีใครใส่ _scan ให้เลย — ได้ false ทุกใบ
  // แปลว่าตัวเลขที่สำคัญที่สุดของโปรเจกต์วัดไม่ได้มาตลอด
  formFromScan = !!(parsed && parsed._src && parsed._src !== 'manual');
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
  // ต้องยืดหลังจอถูกแสดงแล้ว — วัด scrollHeight ตอนจอยัง display:none ได้ 0 ทุกครั้ง
  autoGrow(f.detail);
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
    state.tasks.push(Object.assign({ id: uid(), done: false, createdAt: new Date().toISOString(), fromScan: formFromScan }, data));
    funnelTask(formFromScan ? 'scan' : 'manual');
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
  parsedPending._src = source;   // 'ocr' · 'paste' · 'voice' — ใช้วัด capture rate (ดู openForm)
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

// __OCR_MIN_OVERRIDE / __OCR_MAX_OVERRIDE เป็นช่องให้เครื่องมือวัดผลทดลองค่าอื่นได้
// แอปจริงไม่เคยตั้งค่าพวกนี้ จึงใช้ OCR_MIN_LONG / OCR_MAX_LONG ตามปกติเสมอ
function ocrMinLong() {
  return (typeof window !== 'undefined' && window.__OCR_MIN_OVERRIDE !== undefined)
    ? window.__OCR_MIN_OVERRIDE : OCR_MIN_LONG;
}

// เทา + ยืด contrast ด้วยเปอร์เซ็นไทล์ (ตัดหัวท้าย 2% กันจุดสว่าง/จุดดำหลุด ๆ ลากค่าไปทั้งภาพ)
// minLongArg: ระบุเองได้ (0 หรือ null = ไม่ขยายภาพเล็ก) ไม่ระบุ = ใช้ค่าของแอป
function ocrToGray(img, minLongArg) {
  const long = Math.max(img.width, img.height);
  const minLong = minLongArg !== undefined ? minLongArg : ocrMinLong();
  const maxLong = (typeof window !== 'undefined' && window.__OCR_MAX_OVERRIDE)
    ? window.__OCR_MAX_OVERRIDE : OCR_MAX_LONG;
  const scale = long > maxLong ? maxLong / long
    : (minLong && long < minLong) ? minLong / long : 1;
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

// **ต้องสร้าง canvas ใบใหม่ทุกครั้ง ห้ามวาดทับใบที่มากับ prep**
// เหตุผล: ocrBinarize คืน { ...prep, gray: out } ซึ่ง spread ก๊อป *ตัวอ้างอิง* ของ
// canvas/ctx/id มาด้วย — ภาพเทากับภาพไบนารีของรอบเดียวกันจึงใช้ canvas ใบเดียวกัน
// ของเดิมวาดทับใบนั้นแล้วคืนมัน ผลคือพอเรียกครั้งที่สองด้วยภาพอีกแบบ
// ใบที่คืนไปครั้งแรกก็เปลี่ยนเนื้อตามไปด้วย (เป็นวัตถุตัวเดียวกัน)
// รอบสำรองที่ 2 ใน runOcrOn จึงอ่าน "ภาพสำรอง + PSM 6" ทั้งที่ตั้งใจให้เป็น "ภาพหลัก + PSM 6"
function ocrGrayToCanvas(prep) {
  const { gray, w, h } = prep;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const id = ctx.createImageData(w, h);
  for (let g = 0, i = 0; g < gray.length; g++, i += 4) {
    id.data[i] = id.data[i + 1] = id.data[i + 2] = gray[g];
    id.data[i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return c;
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
// เพดานตั้งไว้ 30 องศาโดยมีเหตุผลจากการวัด ไม่ใช่เดา:
// วัดแล้วพบว่า Tesseract อ่านได้ครบ 100% จนถึง 10 องศา แล้วร่วงเป็น 50% ที่ 15 องศา
// 30% ที่ 20 และ 10% ที่ 25 — ช่วงที่ "ต้องแก้จริง ๆ" คือ 12 องศาขึ้นไป
// เพดานเดิม 8 องศาจึงไปแก้เฉพาะมุมที่มันอ่านออกอยู่แล้ว และไม่เคยแตะช่วงที่พังเลย
const DESKEW_MAX = 30;
const DESKEW_STEP = 0.5;     // หยาบ ๆ ก่อน แล้วค่อยละเอียดรอบสอง
const DESKEW_MIN = 0.35;     // เอียงน้อยกว่านี้ไม่ต้องหมุน หมุนแล้วเสียรายละเอียดเปล่า
// ขนาดภาพที่ใช้หามุม — 640 เล็กเกินไปสำหรับใบงานที่ข้อความแน่น
// วัดจริง: ที่ 640 ชิ้นส่วนของ RP-3 ยังพอเป็นตัวอักษร (สูงมัธยฐาน 17px) แต่หามุมไม่เจอ (คืน 0°)
// ที่ 900 เจอ −2.6° ซึ่งตรงกับที่ตาเห็น และคืนวลีที่หายไปกลับมาได้
const DESKEW_WORK = 900;

// หาชิ้นส่วนที่เชื่อมกัน (connected components) แล้วคัดเฉพาะชิ้นที่ "ขนาดเหมือนตัวอักษร"
// เหตุผล: วิธีเดิมนับหมึกทุกจุดในภาพ ซึ่งพังทันทีเมื่อรูปมีสิ่งที่ตรงกับแกนภาพอยู่แล้ว
//   — บล็อก JPEG · ขอบกระดาษ · รอยเงา · เส้นตาราง
//   ของพวกนี้ตรง 0° อยู่แล้ว โปรไฟล์เลยพีคที่ 0° อย่างมั่นใจ ทั้งที่ข้อความเอียง 7°
//   (วัดจริง: ภาพ hard เอียง 7° แต่คะแนนที่ 0° ชนะที่ 7° ถึง 2.7 เท่า)
// ตัวอักษรมีขนาดใกล้เคียงกันทั้งหน้า ส่วนสิ่งรบกวนไม่ใช่ — คัดด้วยขนาดจึงแยกออกได้
// ย่อลงมาให้หามุมได้เร็ว — หามุมไม่ต้องใช้ความละเอียดเต็ม
//
// **ต้องย่อภาพเทาแล้วค่อยไบนารี ห้ามย่อภาพไบนารี**
// ของเดิมย่อภาพไบนารีด้วยการสุ่มจุด (nearest-neighbour) ซึ่งพังกับเส้นตัวอักษร:
// เส้นกว้าง 2–3px ที่อัตราย่อ ~2.8 เท่า เหลือไม่ถึงพิกเซล การสุ่มจุดจึงเก็บบ้างทิ้งบ้าง
// ตัวอักษรแตกเป็นเศษ วัดจริงกับรูปถ่ายทั้ง 3 ใบ: ความสูงมัธยฐานของชิ้นส่วนเหลือ 2px ทุกใบ
// ตัวกรองใน skewBaselines (h ≤ med×3.2 = 6.4px) จึงเก็บ "เศษจุดรบกวน" ไว้
// แล้วโยน "ตัวอักษรจริง" ทิ้ง — ตรงข้ามกับที่ตั้งใจไว้ทั้งหมด
//
// ย่อผ่าน canvas ได้การกรองจริง (เฉลี่ยพื้นที่) เส้นบางกลายเป็นสีเทาอ่อนแทนที่จะหายไป
// แล้วให้ Sauvola ที่ขนาดเล็กตัดสินอีกที — หน้าต่างของมันคิดตามสัดส่วนภาพอยู่แล้ว
function skewSmallBin(grayPrep, target) {
  const { w, h } = grayPrep;
  const scale = Math.min(1, target / Math.max(w, h));
  if (scale >= 1) return ocrBinarize(grayPrep);
  const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
  const c = document.createElement('canvas');
  c.width = nw; c.height = nh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ocrGrayToCanvas(grayPrep), 0, 0, nw, nh);
  const id = ctx.getImageData(0, 0, nw, nh);
  const gray = new Uint8ClampedArray(nw * nh);
  for (let g = 0, i = 0; g < gray.length; g++, i += 4) gray[g] = id.data[i];
  return ocrBinarize({ canvas: c, ctx, id, gray, w: nw, h: nh });
}

function skewComponents(bin, w, h) {
  const lab = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = new Int32Array(w * h);
  for (let p = 0; p < bin.length; p++) {
    if (bin[p] !== 0 || lab[p] !== -1) continue;   // 0 = หมึก
    let sp = 0;
    stack[sp++] = p;
    lab[p] = comps.length;
    let x0 = p % w, x1 = x0, y0 = (p / w) | 0, y1 = y0, n = 0;
    while (sp > 0) {
      const q = stack[--sp];
      const qx = q % w, qy = (q / w) | 0;
      n++;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx;
          if (nx < 0 || nx >= w) continue;
          const r = ny * w + nx;
          if (bin[r] === 0 && lab[r] === -1) { lab[r] = lab[p]; stack[sp++] = r; }
        }
      }
    }
    comps.push({ x0, x1, y0, y1, n, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return comps;
}

// จุดที่เอาไปฉาย = จุดกึ่งกลางขอบล่างของแต่ละชิ้น (เส้นฐานของตัวอักษร)
// เส้นฐานของตัวอักษรในบรรทัดเดียวกันเรียงตรงกันเสมอ ต่อให้ตัวอักษรสูงไม่เท่ากัน
// ส่วนสิ่งรบกวนไม่ได้เรียงเป็นเส้นฐาน จึงไม่สร้างพีคปลอม
function skewBaselines(bin, w, h) {
  const comps = skewComponents(bin, w, h);
  if (comps.length < 8) return null;
  const hs = comps.map(c => c.h).sort((a, b) => a - b);
  const med = hs[hs.length >> 1];
  if (med < 2) return null;
  const keep = comps.filter(c =>
    c.h >= Math.max(2, med * 0.45) && c.h <= med * 3.2 &&    // สูงพอ ๆ กับตัวอักษรทั่วไป
    c.w <= med * 14 &&                                       // ยาวเกินไป = เส้นตาราง/ขอบกระดาษ
    c.n >= 3 &&                                              // เล็กเกินไป = จุดรบกวน
    c.n <= c.w * c.h * 0.92);                                // ตันทั้งกล่อง = ก้อนเงา ไม่ใช่ตัวอักษร
  if (keep.length < 8) return null;
  return { pts: keep.map(c => ({ x: (c.x0 + c.x1) / 2, y: c.y1 })), med };
}

// คะแนนของมุมหนึ่ง = ความ "กองรวมเป็นแถบ" ของเส้นฐานหลังหักความเอียงออก
function skewScorePts(pts, tan, h) {
  const rows = new Float64Array(h * 2 + 4);
  const off = h >> 1;
  for (let i = 0; i < pts.length; i++) {
    const r = (pts[i].y - tan * pts[i].x + off) | 0;
    if (r >= 0 && r < rows.length) rows[r]++;
  }
  let s = 0;
  for (let i = 0; i < rows.length; i++) s += rows[i] * rows[i];
  return s;
}

// คืนมุมเอียงเป็นองศา (บวก = ภาพเอียงตามเข็ม ต้องหมุนทวนเข็มเพื่อแก้)
// คืน 0 เมื่อหาไม่ได้อย่างมั่นใจ — ดีกว่าเดามั่วแล้วหมุนผิดทาง
// **รับภาพเทา ไม่ใช่ภาพไบนารี** (เปลี่ยนตอนซ่อม skewSmallBin — ต้องไบนารีหลังย่อ)
function ocrFindSkew(grayPrep) {
  const s = skewSmallBin(grayPrep, DESKEW_WORK);
  const base = skewBaselines(s.gray, s.w, s.h);
  if (!base) return 0;
  const scan = (from, to, step) => {
    let bestA = 0, bestS = -1;
    for (let a = from; a <= to + 1e-9; a += step) {
      const sc = skewScorePts(base.pts, Math.tan(a * Math.PI / 180), s.h);
      if (sc > bestS) { bestS = sc; bestA = a; }
    }
    return { a: bestA, s: bestS };
  };
  const coarse = scan(-DESKEW_MAX, DESKEW_MAX, DESKEW_STEP);
  const fine = scan(coarse.a - DESKEW_STEP, coarse.a + DESKEW_STEP, 0.1);
  // ต้องชนะมุม 0 องศาชัดเจนพอ ไม่งั้นถือว่าไม่มั่นใจ แล้วปล่อยภาพไว้อย่างเดิม
  // กันเคสที่เส้นฐานกระจายจนพีคไม่มีความหมาย — หมุนมั่วแย่กว่าไม่หมุน
  const flat = skewScorePts(base.pts, 0, s.h);
  if (fine.s < flat * 1.08) return 0;
  return +fine.a.toFixed(2);
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
  let deg = 0;
  // หามุมจากภาพย่อ ไม่ต้องไบนารีความละเอียดเต็มก่อนอีกแล้ว —
  // ของเดิมไบนารีเต็มขนาดทิ้งไว้ก้อนหนึ่งซึ่งถูกโยนทิ้งทันทีเมื่อต้องหมุน (เสียเปล่า ~250ms)
  try { deg = ocrFindSkew(grayPrep); } catch (_) { deg = 0; }
  if (!isFinite(deg) || Math.abs(deg) < DESKEW_MIN) {
    return { gray: grayPrep, bin: ocrBinarize(grayPrep), deg: 0 };
  }
  const rot = ocrRotateGray(grayPrep, deg);
  return { gray: rot, bin: ocrBinarize(rot), deg };
}

// ---------- ภาพนี้เป็นภาพดิจิทัลหรือรูปถ่าย ----------
// สำคัญเพราะสองแบบต้องเตรียมภาพคนละทาง:
//   รูปถ่าย   — แสงไม่สม่ำเสมอ ต้องแยกขาวดำแบบดูเฉพาะบริเวณ (Sauvola)
//   ภาพดิจิทัล — พื้นเรียบสมบูรณ์ ตัวอักษรคมอยู่แล้ว การแยกขาวดำมีแต่ทำให้เส้นบวมและขอบแตก
// วัดจาก "ความเรียบ" = สัดส่วนพิกเซลที่เท่ากับเพื่อนบ้านด้านขวาเป๊ะ ๆ
// รูปถ่ายมีสัญญาณรบกวนจากเซนเซอร์ พิกเซลแทบไม่มีทางเท่ากันพอดี ภาพดิจิทัลเท่ากันเป็นผืน ๆ
// วัดจากรูปจริง 6 ใบ: รูปถ่ายได้ 27–45% · ภาพดิจิทัลได้ 79–86% — ช่องว่างกว้างมาก
const OCR_FLAT_CUT = 60;
function ocrIsDigital(prep) {
  const { gray, w, h } = prep;
  let same = 0, n = 0;
  const step = Math.max(1, (h / 400) | 0);   // สุ่มดูทีละแถว ไม่ต้องไล่ทุกพิกเซล
  for (let y = 0; y < h; y += step) {
    const row = y * w;
    for (let x = 0; x < w - 1; x++) { if (gray[row + x] === gray[row + x + 1]) same++; n++; }
  }
  return n ? (same / n * 100) >= OCR_FLAT_CUT : false;
}

// ============================================================
// ALT 1A7V: หาบล็อกข้อความ เพื่ออ่านทีละบล็อกแทนการยัดทั้งหน้า
// ------------------------------------------------------------
// ที่มา: การทดลองตัดเฉพาะหัวกระดาษออกมาอ่านเดี่ยว ๆ ได้ conf 88–92 ทั้งที่บริเวณเดียวกัน
// ตอนอยู่ในหน้าเต็มได้แค่ 9–39 — ตัวอักษรคุณภาพดีพอมาตลอด ความละเอียดพอ โหมดถูกแล้ว
// สิ่งเดียวที่เหลือคือการยัดทั้งหน้าเข้าไปพร้อมกันในครั้งเดียว
//
// วิธี RLSA (ละเลงหมึกแล้วหาชิ้นส่วนที่เชื่อมกัน): ถมช่องว่างสั้น ๆ ระหว่างหมึกให้ทึบ
// ชิ้นส่วนที่ได้จึงเป็น "ก้อนข้อความ" ไม่ใช่ตัวอักษร
// จงใจใช้จุดอ่อนของภาพให้เป็นประโยชน์ — ตัวอักษรไทยที่เชื่อมติดกันจนหาตัวอักษรไม่ได้
// กลับเป็นข้อดีตอนหาบล็อก เพราะเราอยากได้ก้อนอยู่แล้ว
// ============================================================

// ขนาดตัวอักษรโดยประมาณ — ใช้ "มัธยฐานถ่วงน้ำหนักด้วยปริมาณหมึก"
// ห้ามใช้มัธยฐานความสูงเฉย ๆ: วัดจริงกับรูปถ่าย 3 ใบได้ 2–3px ทั้งหมด
// เพราะเศษจุดรบกวนมีจำนวนมากกว่าตัวอักษรจริงเสมอ แต่กินหมึกรวมกันน้อยมาก
function ocrTextScale(comps) {
  if (!comps.length) return 10;
  const total = comps.reduce((a, c) => a + c.n, 0);
  const sorted = comps.slice().sort((a, b) => a.h - b.h);
  let acc = 0;
  for (const c of sorted) { acc += c.n; if (acc >= total / 2) return Math.max(3, c.h); }
  return Math.max(3, sorted[sorted.length >> 1].h);
}

// ละเลงหมึก: ถมช่องว่างที่สั้นกว่าเกณฑ์ทั้งแนวนอนและแนวตั้ง (0 = หมึก)
function ocrSmear(bin, w, h, hGap, vGap) {
  const m = new Uint8ClampedArray(bin);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    let last = -1;
    for (let x = 0; x < w; x++) {
      if (m[r + x] === 0) {
        if (last >= 0 && x - last <= hGap) for (let i = last + 1; i < x; i++) m[r + i] = 0;
        last = x;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1;
    for (let y = 0; y < h; y++) {
      if (m[y * w + x] === 0) {
        if (last >= 0 && y - last <= vGap) for (let i = last + 1; i < y; i++) m[i * w + x] = 0;
        last = y;
      }
    }
  }
  return m;
}

const BLOCK_WORK = 900;    // ขนาดภาพที่ใช้หาบล็อก — ไม่ต้องละเอียดเท่าตอนอ่านจริง
const BLOCK_MAX = 14;      // อ่านมากกว่านี้ไม่คุ้มเวลา เอาเฉพาะก้อนที่หมึกเยอะสุด

// คืนกรอบบล็อกเป็น "สัดส่วน 0–1 ของภาพ" เพื่อให้เอาไปครอบภาพขนาดไหนก็ได้
function ocrFindBlocks(grayPrep, opt = {}) {
  const small = skewSmallBin(grayPrep, opt.work || BLOCK_WORK);
  const comps = skewComponents(small.gray, small.w, small.h);
  if (comps.length < 4) return [];
  const med = ocrTextScale(comps);
  const hGap = Math.max(2, Math.round((opt.hGap != null ? opt.hGap : 1.4) * med));
  const vGap = Math.max(1, Math.round((opt.vGap != null ? opt.vGap : 0.7) * med));
  const mask = ocrSmear(small.gray, small.w, small.h, hGap, vGap);

  const page = small.w * small.h;
  let blocks = skewComponents(mask, small.w, small.h).filter(b =>
    b.n >= med * med * 1.5 &&            // ก้อนจิ๋วไม่คุ้มค่าเรียก OCR หนึ่งรอบ
    b.h >= med * 0.8 &&
    b.n <= page * 0.6 &&                 // เกือบทั้งหน้า = ละเลงเกินจนเหลือก้อนเดียว ไม่ได้ช่วยอะไร
    // **ความทึบของกรอบ** — กรอบใบงาน ขอบกระดาษ และเส้นตารางเป็นชิ้นส่วนเส้นยาวที่คดไปทั่วหน้า
    // กรอบครอบของมันจึงใหญ่เกือบเท่าหน้ากระดาษทั้งที่มีหมึกนิดเดียว (วัดจริง RP-1 ได้ก้อน 85×98%)
    // ครอบตามนั้นก็เท่ากับอ่านทั้งหน้าเหมือนเดิม ไม่ได้แก้อะไรเลย
    b.n >= b.w * b.h * 0.35);
  if (!blocks.length) return [];
  blocks.sort((a, b) => b.n - a.n);
  // ก้อนที่จมอยู่ในก้อนอื่นทั้งใบ = อ่านซ้ำเปล่า ๆ ตัดทิ้ง (ไล่จากก้อนใหญ่ไปเล็ก)
  const kept = [];
  for (const b of blocks) {
    if (kept.some(k => b.x0 >= k.x0 && b.x1 <= k.x1 && b.y0 >= k.y0 && b.y1 <= k.y1)) continue;
    kept.push(b);
    if (kept.length >= (opt.max || BLOCK_MAX)) break;
  }
  blocks = kept;

  // ลำดับการอ่าน: แบ่งเป็นแถบตามความสูงตัวอักษรก่อน แล้วในแถบเดียวกันค่อยเรียงซ้าย→ขวา
  // ถ้าเรียงด้วย y ดิบ ๆ บล็อกสองอันที่อยู่ระดับเดียวกันแต่ต่างกัน 3px จะสลับกันมั่ว
  const band = Math.max(1, med * 2);
  blocks.sort((a, b) => {
    const ba = (a.y0 / band) | 0, bb = (b.y0 / band) | 0;
    return ba !== bb ? ba - bb : a.x0 - b.x0;
  });

  // เผื่อขอบรอบกรอบ — ตัดชิดตัวอักษรเกินไปทำให้ตัวบนล่าง (สระ/วรรณยุกต์ไทย) ขาด
  const pad = Math.max(2, med * 0.6);
  return blocks.map(b => ({
    x: Math.max(0, (b.x0 - pad) / small.w),
    y: Math.max(0, (b.y0 - pad) / small.h),
    w: Math.min(1, (b.x1 + pad) / small.w) - Math.max(0, (b.x0 - pad) / small.w),
    h: Math.min(1, (b.y1 + pad) / small.h) - Math.max(0, (b.y0 - pad) / small.h),
    ink: b.n,
  }));
}

// ---------- เตรียมภาพทั้งชุด (ที่เดียว ใช้ทั้งแอปและเครื่องมือวัดผล) ----------
// ลำดับมีเหตุผล: ตัดสินว่าเป็นภาพดิจิทัลหรือรูปถ่าย **ก่อน** ตัดสินใจขยาย
//
// ทำไมต้องตัดสินก่อน: วัดกับรูปจริงแล้วพบว่าการขยายภาพเล็กทำให้ภาพดิจิทัลแย่ลงชัดเจน
//   DP-1 (763×673 ของเดิม) : ไม่ขยาย 4/4 conf 91 · ขยาย 1000 → 3/4 · ขยาย 1200 → 1/4 · 1500 → 1/4
//   DP-3 (443×61 ของเดิม)  : ไม่ขยาย 1/2 conf 77 · ขยาย 1200 → 0/2 conf 0 (อ่านไม่ออกเลย)
//   รวมภาพดิจิทัลทั้งชุด    : ไม่ขยาย 13/14 · ขยาย 1200 9/14
// ตัวอักษรบนจอคมอยู่แล้ว การขยายมีแต่เพิ่มความเบลอจากการเกลี่ยพิกเซล ไม่ได้เพิ่มรายละเอียด
// ส่วนรูปถ่ายผลก้ำกึ่ง (ย่อ RP-1/RP-2 ให้เล็กแล้ววัด: ขยาย 6/11 · ไม่ขยาย 5/11) จึงไม่แตะ
//
// อีกเหตุผลหนึ่ง: ของเดิมตัดสินจากภาพ *หลังแก้เอียง* ซึ่งถ้าภาพถูกหมุน พิกเซลจะถูกเกลี่ยใหม่หมด
// ความ "เรียบ" ที่ ocrIsDigital วัดจึงหายไปกับการหมุน — ภาพดิจิทัลที่เอียงจะถูกตัดสินผิดเป็นรูปถ่าย
function ocrPrepare(source, opt = {}) {
  const gray0 = ocrToGray(source, 0);               // ยังไม่ขยาย ไว้ตัดสินก่อน
  const digital = opt.digital !== undefined ? opt.digital : ocrIsDigital(gray0);
  const min = opt.minLong !== undefined ? opt.minLong : ocrMinLong();
  const grayIn = (!digital && min && Math.max(gray0.w, gray0.h) < min)
    ? ocrToGray(source, min)                        // รูปถ่ายที่เล็กเกินไปเท่านั้นที่ขยาย
    : gray0;
  const sk = opt.deskew === false
    ? { gray: grayIn, bin: ocrBinarize(grayIn), deg: 0 }
    : ocrDeskew(grayIn);
  // ภาพดิจิทัลส่งภาพเทาเข้าไปตรง ๆ — คมอยู่แล้ว แยกขาวดำมีแต่ทำให้เส้นบวมและขอบแตก
  // วัดกับรูปจริง: ภาพดิจิทัลดีขึ้น 86%→93% ส่วนรูปถ่ายถ้าไม่แยกขาวดำจะร่วง 77%→73%
  const useBin = opt.bin !== undefined ? opt.bin : !digital;
  return { gray: sk.gray, bin: sk.bin, deg: sk.deg, digital, useBin };
}

// ---------- worker ใช้ซ้ำ ----------
// เดิมสร้าง worker ใหม่แล้วทิ้งทุกครั้งที่สแกน — สแกนติดกันหลายใบเสียเวลา init ซ้ำทุกใบ
// **worker ตัวเดียวถูกใช้ซ้ำทั้งอายุแอป** ใครเปลี่ยน parameter ต้องคืนค่าเองเสมอ
// ไม่งั้นการสแกนใบถัดไปจะได้ค่าที่ค้างมาจากใบก่อน
let ocrWorker = null, ocrProgress = null;

const OCR_PSM_MAIN = '11';   // "ข้อความกระจาย" — ค่าปกติของแอป
const OCR_PSM_BLOCK = '6';   // "มองทั้งรูปเป็นบล็อกเดียว" — ใช้เฉพาะรอบสำรองที่ 2

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
  // PSM 11 = "ข้อความกระจาย" หาตัวหนังสือให้เจอมากที่สุดโดยไม่พยายามเดาโครงหน้ากระดาษ
  // เดิมใช้ PSM 6 (มองทั้งรูปเป็นบล็อกเดียว) ซึ่งเดาโครงผิดบ่อยกับภาพที่ข้อความไม่ได้เรียงเป็นย่อหน้า
  // วัดกับรูปจริง 6 ใบ: PSM 6 ได้ 25/36 · PSM 11 ได้ 29/36 — ดีขึ้นทั้งรูปถ่ายและภาพดิจิทัล
  // (เคยลอง PSM 7 "บรรทัดเดียว" ด้วย ได้ 0/36 พังทุกใบ — อย่ากลับไปใช้)
  await w.setParameters({
    tessedit_pageseg_mode: OCR_PSM_MAIN,
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
  rememberScan(c);          // เก็บไว้ให้ปุ่ม "อ่านให้แม่นขึ้น" ใช้ซ้ำ ผู้ใช้จะได้ไม่ต้องถ่ายใหม่
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
  vaultTouch();
  renderProfile();
  showToast({ title: 'เปลี่ยนรูปโปรไฟล์แล้ว 🖼', body: 'เอาออกได้ที่จอตั้งค่า' });
}

function clearAvatar() {
  try { localStorage.removeItem(AV_KEY); } catch (_) {}
  vaultTouch();
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

// ============================================================
// ALT 1A7V: ท่ออ่านภาพ — แยกออกจาก UI เพื่อให้เครื่องมือวัดผลเรียกสายเดียวกันได้
// ------------------------------------------------------------
// เดิมตรรกะทั้งหมดฝังอยู่ใน runOcrOn ซึ่งแตะ DOM ตั้งแต่บรรทัดแรก เครื่องมือวัดผลจึงเรียกไม่ได้
// ต้องไปเขียนสายของตัวเองขึ้นมาใหม่ใน ocrbench.js แล้วสองสายก็ค่อย ๆ เพี้ยนจากกัน
// (benchOnce ยังไบนารีทุกภาพอยู่เลย ทั้งที่แอปเลิกทำแบบนั้นตั้งแต่มีตัวแยกภาพดิจิทัลแล้ว
//  และไม่เคยตั้ง PSM เองเลยสักครั้ง — วัดอะไรอยู่ขึ้นกับว่าใครเรียกก่อนหน้า)
// ตอนนี้ทั้งแอปและ bench เรียกฟังก์ชันนี้ตัวเดียวกัน จะเพี้ยนจากกันอีกไม่ได้
//
// ไม่แตะ DOM เลย — รายงานความคืบหน้าผ่าน onStage(ชื่อขั้น) ให้ผู้เรียกไปทำ UI เอง
// ============================================================
async function ocrReadCanvas(source, onStage) {
  const t0 = performance.now();
  const say = onStage || (() => {});

  say('prep');
  const p = ocrPrepare(source);
  const digital = p.digital;
  const mainCanvas = ocrGrayToCanvas(p.useBin ? p.bin : p.gray);
  const altCanvas = () => ocrGrayToCanvas(p.useBin ? p.gray : p.bin);

  say('model');
  const worker = await getOcrWorker();

  let passes = 1;
  say('read');
  let { data } = await withTimeout(worker.recognize(mainCanvas, {}, OCR_OUTPUT), 90_000, 'อ่านรูปภาพ');
  let pass = digital ? 'digital' : 'photo';

  // รอบสำรอง 1: สลับไปเตรียมภาพอีกแบบ — เผื่อตัวแยกประเภทภาพตัดสินผิด
  // (เช่นแคปหน้าจอที่มีรูปถ่ายเต็มจอ หรือรูปถ่ายกระดาษขาวจัดที่เรียบผิดปกติ)
  if ((data.confidence || 0) < OCR_CONF_OK) {
    say('alt');
    passes++;
    const soft = await withTimeout(worker.recognize(altCanvas(), {}, OCR_OUTPUT), 90_000, 'อ่านรูปภาพ');
    if ((soft.data.confidence || 0) > (data.confidence || 0)) { data = soft.data; pass += '+alt'; }
  }
  // รอบสำรอง 2: ยังต่ำอยู่ → กลับไปมองเป็นบล็อกข้อความก้อนเดียว (PSM 6)
  // ใบงานที่เป็นย่อหน้ายาว ๆ ต่อเนื่องบางทีอ่านแบบนี้ดีกว่าแบบ "ข้อความกระจาย"
  if ((data.confidence || 0) < OCR_CONF_OK) {
    say('psm6');
    passes++;
    await worker.setParameters({ tessedit_pageseg_mode: OCR_PSM_BLOCK });
    try {
      // ต้องเป็น mainCanvas ตัวเดิม — รอบนี้ทดสอบ "โหมดมองหน้ากระดาษ" ไม่ใช่ "การเตรียมภาพ"
      const alt = await withTimeout(worker.recognize(mainCanvas, {}, OCR_OUTPUT), 90_000, 'อ่านรูปภาพ');
      if ((alt.data.confidence || 0) > (data.confidence || 0)) { data = alt.data; pass += '+psm6'; }
    } finally {
      // ต้องคืนค่าแม้รอบนี้จะพัง — worker ตัวนี้ถูกใช้ซ้ำกับการสแกนใบถัดไป
      // ของเดิมคืนค่านอก try ถ้ารอบนี้ timeout ทุกใบหลังจากนั้นจะติด PSM 6 ค้างไปตลอด
      await worker.setParameters({ tessedit_pageseg_mode: OCR_PSM_MAIN });
    }
  }

  // ---------- รอบเก็บตก: อ่านเฉพาะก้อนตัวหนังสือ ----------
  // หัวกระดาษกับบรรทัดคำชี้แจงคือสิ่งที่แอปอยากได้ที่สุด (มันบอกว่า "ใบงานอะไร")
  // แต่เป็นจุดที่การอ่านทั้งหน้าพลาดประจำ วัดจริง: RP-1 5/7 → 7/7 · RP-3 10/11 → 11/11
  // รวมทั้งชุด 30/36 → 33/36 แลกกับเวลา 2.96 → 4.06 วินาทีต่อใบ
  // ภาพดิจิทัลแทบไม่เสียเวลาเลยเพราะแบ่งบล็อกไม่ได้ (ข้ามรอบนี้ไป)
  //
  // ต่อ "ท้าย" ข้อความหน้าเต็มเสมอ ห้ามเอาไปแทน — ลำดับที่ parseAssignment เห็นก่อน
  // ยังเป็นลำดับเดิมของหน้ากระดาษ ความเสี่ยงเรื่องแกะช่องผิดลำดับจึงไม่เพิ่ม
  let blockText = '', blocks = 0;
  try {
    const boxes = ocrFindBlocks(p.gray);
    if (boxes.length >= 2) {
      say('blocks');
      blocks = boxes.length;
      passes++;
      // ภาพที่เรียงบล็อกแล้วเป็นคอลัมน์เดียวเรียบร้อย จึงใช้ PSM 6 (บล็อกเดียว) ไม่ใช่ 11
      // วัดแล้วต่างกันจริง: บล็อก psm6 ได้ 33/36 · บล็อก psm11 ได้ 32/36
      await worker.setParameters({ tessedit_pageseg_mode: OCR_PSM_BLOCK });
      try {
        const st = await withTimeout(
          worker.recognize(ocrStackBlocks(p, boxes), {}, { text: true }), 90_000, 'อ่านรูปภาพ');
        blockText = normalizeOcrText(st.data.text).trim();
      } finally {
        await worker.setParameters({ tessedit_pageseg_mode: OCR_PSM_MAIN });
      }
      if (blockText) pass += '+บล็อก' + blocks;
    }
  } catch (e) {
    // รอบนี้เป็นของแถม พังแล้วต้องไม่ทำให้ผลอ่านทั้งหน้าที่ได้มาแล้วหายไปด้วย
    console.warn('[ALT OCR] รอบอ่านทีละบล็อกไม่สำเร็จ', e);
  }

  const pageText = normalizeOcrText(data.text);   // OCR ไทยเว้นวรรคทีละตัวอักษร ต้องยุบก่อนแกะ
  return {
    data,
    text: blockText ? pageText + '\n' + blockText : pageText,
    conf: Math.round(data.confidence || 0),
    lowWords: collectLowWords(data),
    pass, passes, blocks, digital, deg: p.deg,
    w: p.gray.w, h: p.gray.h,
    ms: Math.round(performance.now() - t0),
  };
}

// เอาบล็อกมาเรียงต่อกันเป็นคอลัมน์เดียวในภาพใหม่ แล้วอ่าน "รอบเดียว"
// เหตุผล: อ่านทีละบล็อกได้ผลดี (RP-1 5/7→7/7 · RP-3 10/11→11/11) แต่จ่ายไป 14 รอบต่อใบ
// เวลาต่อใบพุ่งจาก 2.8 เป็น 8.4 วินาที ซึ่งแพงเกินกว่าจะปล่อยให้ผู้ใช้เจอ
// การเรียงต่อกันได้ประโยชน์หลักอันเดียวกัน — ตัดพื้นที่ว่าง ภาพประกอบ และกรอบออกจากหน้า
// เหลือแต่ก้อนตัวหนังสือชิดกันเป็นคอลัมน์เดียว — โดยจ่ายเพิ่มแค่รอบเดียว
function ocrStackBlocks(prep, boxes) {
  const src = ocrGrayToCanvas(prep.useBin ? prep.bin : prep.gray);
  const rects = boxes.map(b => ({
    sx: Math.round(b.x * src.width), sy: Math.round(b.y * src.height),
    sw: Math.max(8, Math.round(b.w * src.width)), sh: Math.max(8, Math.round(b.h * src.height)),
  }));
  const gap = Math.max(10, Math.round(src.height * 0.012));
  const w = Math.max(...rects.map(r => r.sw)) + gap * 2;
  const h = rects.reduce((a, r) => a + r.sh + gap, gap);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';                 // ช่องว่างระหว่างก้อนต้องเป็นขาว ไม่ใช่ดำ
  ctx.fillRect(0, 0, w, h);
  let y = gap;
  for (const r of rects) {
    ctx.drawImage(src, r.sx, r.sy, r.sw, r.sh, gap, y, r.sw, r.sh);
    y += r.sh + gap;
  }
  return c;
}

// อ่านทีละบล็อกแล้วต่อกันตามลำดับการอ่าน
// คืน null เมื่อแบ่งบล็อกไม่ได้ผล (0–1 ก้อน) — ผู้เรียกใช้ผลอ่านทั้งหน้าต่อไปตามเดิม
async function ocrReadBlocks(prep, worker, opt = {}) {
  const boxes = ocrFindBlocks(prep.gray, opt);
  if (boxes.length < 2) return null;
  const src = ocrGrayToCanvas(prep.useBin ? prep.bin : prep.gray);
  const parts = [];
  let confSum = 0, confN = 0;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true });
  for (const b of boxes) {
    const sx = Math.round(b.x * src.width), sy = Math.round(b.y * src.height);
    const sw = Math.max(8, Math.round(b.w * src.width));
    const sh = Math.max(8, Math.round(b.h * src.height));
    c.width = sw; c.height = sh;
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    const { data } = await worker.recognize(c, {}, { text: true });
    const t = normalizeOcrText(data.text).trim();
    if (t) { parts.push(t); confSum += (data.confidence || 0); confN++; }
  }
  if (!parts.length) return null;
  return { text: parts.join('\n'), conf: confN ? Math.round(confSum / confN) : 0, blocks: boxes.length };
}

const OCR_STAGE_TEXT = {
  prep: '🖼 กำลังปรับภาพให้อ่านง่ายขึ้น…',
  model: '⏳ กำลังเตรียมโมเดล OCR… (ครั้งแรกอาจรอนานหน่อย)',
  read: '📖 AI กำลังอ่านใบงาน…',
  alt: '🔁 ลองอ่านอีกแบบให้ชัดขึ้น…',
  psm6: '🔁 ลองมองหน้ากระดาษอีกแบบ…',
  blocks: '🔎 กำลังเก็บตกหัวข้อกับคำชี้แจง…',
};

async function runOcrOn(source, how) {
  const st = document.getElementById('ocrStatus');
  const barWrap = document.getElementById('ocrBarWrap');
  const bar = document.getElementById('ocrBar');
  try {
    barWrap.hidden = false; bar.style.width = '4%';
    startFunFacts(document.getElementById('scanFact')); // มีอะไรให้อ่านระหว่างรอ OCR
    ocrProgress = m => {
      if (m.status === 'recognizing text') {
        const p = 15 + Math.round(m.progress * 80);
        bar.style.width = p + '%';
        st.textContent = '📖 AI กำลังอ่านใบงาน… ' + Math.round(m.progress * 100) + '%';
      } else if (m.status) {
        st.textContent = '⏳ ' + m.status + '…';
      }
    };
    // ปรับภาพก่อน แล้วค่อยโหลดโมเดล — ผู้ใช้จะได้เห็นความคืบหน้าตั้งแต่วินาทีแรก
    const r = await ocrReadCanvas(source, stage => {
      st.textContent = OCR_STAGE_TEXT[stage] || '';
      if (stage === 'model') bar.style.width = '12%';
    });

    ocrProgress = null;
    stopFunFacts(document.getElementById('scanFact'));
    st.textContent = ''; barWrap.hidden = true;

    const text = r.text;
    const conf = r.conf;
    lastOcrConfidence = conf;
    lastOcrLowWords = r.lowWords;
    // บรรทัดเดียวก๊อปไปทำตารางวัดผลได้เลย (รอบวัดผลกับรูปจริง)
    console.debug(`[ALT OCR] conf=${conf}% pass=${r.pass} รอบ=${r.passes} บล็อก=${r.blocks} `
      + `how=${how || '-'} chars=${text.length} lowWords=${r.lowWords.length} ms=${r.ms} `
      + `size=${r.w}×${r.h} skew=${r.deg}°`);

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
    renderCloudOcr();     // อ่านในเครื่องจบแล้ว ค่อยเสนอทางเลือกที่แม่นกว่า
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

// ============================================================
// ALT 1A7V: อ่านให้แม่นขึ้นด้วย AI บนเซิร์ฟเวอร์ (ผู้ใช้เลือกเอง)
// ------------------------------------------------------------
// Tesseract ในเครื่องอ่านลายมือไทยไม่ได้เลย — นั่นคือเพดานที่ปรับภาพเท่าไหร่ก็ไม่ผ่าน
// ทางเดียวคือส่งรูปไปให้โมเดลบนเซิร์ฟเวอร์อ่าน
//
// **ต้องเป็นปุ่มที่ผู้ใช้กดเอง ห้ามเป็นค่าเริ่มต้นเด็ดขาด** เพราะแลกกับสามอย่าง:
//   ต้องมีเน็ต · มีค่าใช้จ่ายต่อภาพ · และรูปออกจากเครื่องไป
// การอ่านในเครื่องได้แบบออฟไลน์และรูปไม่ออกจากเครื่องเป็นจุดเด่นของแอปนี้ ห้ามทิ้ง
//
// คีย์ของผู้ให้บริการอยู่ใน secret ของ Supabase เท่านั้น — repo นี้เป็นสาธารณะ
// ฝั่งนี้รู้จักแค่ชื่อฟังก์ชัน `ocr-assist` กับรูปคำตอบ ไม่รู้ว่าเบื้องหลังเป็นเจ้าไหน
// เปลี่ยนผู้ให้บริการทีหลังจึงไม่ต้องแก้อะไรในไฟล์นี้เลย
// ============================================================
const CLOUD_OCR_OK_KEY = 'studentos.alt.cloudocr.ok';   // ผู้ใช้รับทราบเงื่อนไขแล้วหรือยัง
const CLOUD_OCR_LONG = 1600;   // ย่อก่อนส่งขึ้นเน็ต — ใหญ่กว่านี้เปลืองเน็ตโดยไม่ได้แม่นขึ้น

let lastScanJpeg = null;       // รูปล่าสุดที่สแกน เก็บเป็น JPEG พร้อมส่ง (ไม่ถือ canvas ไว้ทั้งใบ)

// เก็บรูปที่เพิ่งสแกนไว้ให้ปุ่ม "อ่านให้แม่นขึ้น" ใช้ซ้ำได้ โดยไม่ต้องให้ผู้ใช้ถ่ายใหม่
function rememberScan(canvas) {
  try {
    const scale = Math.min(1, CLOUD_OCR_LONG / Math.max(canvas.width, canvas.height));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(canvas.width * scale));
    out.height = Math.max(1, Math.round(canvas.height * scale));
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
    lastScanJpeg = out.toDataURL('image/jpeg', 0.85);
  } catch (_) { lastScanJpeg = null; }
}

// สถานะของปุ่ม — แยก "ยังไม่เปิดใช้" ออกจาก "เน็ตหลุด" และ "ยังไม่ล็อกอิน"
// ให้ข้อความบอกสาเหตุที่แก้ได้จริง แทนที่จะขึ้นว่า "ผิดพลาด" เฉย ๆ
function cloudOcrState() {
  if (!lastScanJpeg) return 'no-image';
  if (!cloudConfigured() || !sb) return 'no-cloud';
  if (!currentUser) return 'need-login';
  if (navigator.onLine === false) return 'offline';
  return 'ready';
}

const CLOUD_OCR_WHY = {
  'no-image': 'ยังไม่มีรูปที่สแกนไว้',
  'no-cloud': 'รุ่นนี้ยังไม่ได้เปิดใช้การอ่านด้วย AI บนเซิร์ฟเวอร์',
  'need-login': 'ต้องเข้าสู่ระบบก่อนถึงจะใช้ได้',
  'offline': 'ตอนนี้ไม่ได้ต่อเน็ต — วิธีนี้ต้องใช้เน็ต',
};

function renderCloudOcr() {
  const box = document.getElementById('cloudOcrBox');
  if (!box) return;
  const st = cloudOcrState();
  box.hidden = (st === 'no-image');     // ยังไม่ได้สแกน = ไม่ต้องโชว์อะไรเลย
  const btn = document.getElementById('cloudOcrBtn');
  const why = document.getElementById('cloudOcrWhy');
  if (!btn || !why) return;
  btn.disabled = (st !== 'ready');
  why.textContent = CLOUD_OCR_WHY[st] || '';
  why.hidden = (st === 'ready');
}

async function cloudOcrRetry() {
  const st = cloudOcrState();
  if (st !== 'ready') { renderCloudOcr(); return; }

  // ขอความยินยอมแบบเต็มครั้งแรกครั้งเดียว — บอกให้ครบว่าเกิดอะไรขึ้นกับรูป
  // ครั้งต่อ ๆ ไปการกดปุ่มเองคือการยินยอมอยู่แล้ว ไม่ต้องถามซ้ำจนน่ารำคาญ
  let seen = false;
  try { seen = localStorage.getItem(CLOUD_OCR_OK_KEY) === '1'; } catch (_) {}
  if (!seen) {
    const ok = confirm(
      'ส่งรูปนี้ให้ AI บนเซิร์ฟเวอร์ช่วยอ่าน?\n\n'
      + '• รูปจะถูกส่งออกจากเครื่องไปประมวลผลบนเซิร์ฟเวอร์\n'
      + '• ต้องใช้อินเทอร์เน็ต\n'
      + '• อ่านลายมือได้ และแม่นกว่าการอ่านในเครื่องมาก\n\n'
      + 'การอ่านในเครื่อง (ค่าเริ่มต้น) ไม่ส่งรูปออกไปไหนเลย');
    if (!ok) return;
    try { localStorage.setItem(CLOUD_OCR_OK_KEY, '1'); } catch (_) {}
  }

  const st2 = document.getElementById('ocrStatus');
  const btn = document.getElementById('cloudOcrBtn');
  if (btn) btn.disabled = true;
  if (st2) st2.textContent = '☁️ กำลังให้ AI บนเซิร์ฟเวอร์อ่าน…';
  try {
    const b64 = lastScanJpeg.replace(/^data:[^,]+,/, '');
    const { data, error } = await withTimeout(
      sb.functions.invoke('ocr-assist', { body: { image: b64, mime: 'image/jpeg' } }),
      60_000, 'อ่านด้วย AI บนเซิร์ฟเวอร์');

    // supabase-js คืน error สำหรับสถานะที่ไม่ใช่ 2xx โดยเนื้อความจริงอยู่ใน context
    // ต้องแกะออกมา ไม่งั้นผู้ใช้จะเห็นแค่ "Edge Function returned a non-2xx status code"
    let payload = data;
    if (error) {
      try { payload = await error.context.json(); } catch (_) { payload = null; }
    }
    if (!payload || payload.ok !== true) {
      alert(payload?.message || 'อ่านด้วย AI บนเซิร์ฟเวอร์ไม่สำเร็จ — ลองใหม่อีกครั้ง');
      return;
    }
    const text = normalizeOcrText(payload.text || '');
    if (text.trim().length < 5) {
      alert('เซิร์ฟเวอร์อ่านรูปนี้ไม่ออกเหมือนกัน — ลองถ่ายใหม่ให้ชัดขึ้น');
      return;
    }
    console.debug(`[ALT OCR/cloud] provider=${payload.provider} conf=${payload.conf}% `
      + `ms=${payload.ms} chars=${text.length}`);
    lastOcrConfidence = payload.conf ?? null;
    lastOcrLowWords = [];       // ฝั่งเซิร์ฟเวอร์ไม่ได้ให้คะแนนรายคำ อย่าเอาของรอบก่อนมาปน
    runParsing(text, 'ocr');
  } catch (e) {
    console.error('[ALT OCR/cloud]', e);
    alert('อ่านด้วย AI บนเซิร์ฟเวอร์ไม่สำเร็จ: ' + e.message);
  } finally {
    if (st2) st2.textContent = '';
    renderCloudOcr();
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
    // serviceWorker.ready ไม่รีเจ็กต์เองถ้า SW ตัวเก่าติดค้างอยู่ — มันค้างเงียบ ๆ ตลอดไป
    // และเพราะ initApp รอบรรทัดนี้อยู่ ฉากเปิดแอปเลยค้างที่ 66% ไม่ไปไหนทั้งที่โหลดอย่างอื่นครบแล้ว
    // เจอจริงบนเครื่องที่เคยติดตั้งรุ่นก่อนหน้าไว้ (เครื่องที่เพิ่งเปิดครั้งแรกจะไม่เจอ)
    const reg = await withTimeout(navigator.serviceWorker.ready, 5000, 'ตรวจสิทธิ์แจ้งเตือน');
    const sub = await reg.pushManager.getSubscription();
    pushState = sub ? 'on' : 'off';
  } catch (_) { pushState = 'off'; }
}

// กุญแจของ subscription ที่มีอยู่ ตรงกับกุญแจที่แอปถืออยู่ตอนนี้ไหม
// คืน true เมื่อ "เทียบไม่ได้" ด้วย — เบราว์เซอร์บางตัวไม่เปิด options ให้อ่าน
// การเดาว่าไม่ตรงแล้วสั่งสมัครใหม่ทุกครั้งที่เปิดแอป แย่กว่าการปล่อยไว้เฉย ๆ
function subKeyMatches(sub) {
  try {
    const raw = sub.options && sub.options.applicationServerKey;
    if (!raw) return true;
    const bytes = new Uint8Array(raw);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    const b64 = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64 === String(window.VAPID_PUBLIC_KEY || '').replace(/=+$/, '');
  } catch (_) { return true; }
}

async function subscribePush() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  // subscription ที่สร้างไว้ด้วยกุญแจ VAPID คนละดอกกับที่เซิร์ฟเวอร์ถืออยู่ จะถูกปฏิเสธ 403
  // ทุกครั้งที่ส่ง และมันไม่หายเอง — เบราว์เซอร์คืนตัวเดิมให้ตลอดจนกว่าจะสั่งเลิกเอง
  // ผลคือคนคนนั้นไม่ได้รับการเตือนอีกเลยตลอดกาล โดยไม่มีอะไรบนจอบอกสักตัว
  // (เกิดขึ้นจริงกับผู้ใช้หนึ่งคน 3 เครื่อง หลังเปลี่ยน VAPID_PUBLIC_KEY เมื่อ 23 ส.ค.)
  if (sub && !subKeyMatches(sub)) {
    console.warn('[push] กุญแจ VAPID ไม่ตรง — สมัครใหม่');
    try { await sub.unsubscribe(); } catch (_) {}
    // ลบแถวเก่าออกจาก cloud ด้วย ไม่งั้นค้างเป็นขยะที่ถูกยิงพลาดทุกครึ่งชั่วโมง
    if (sb && currentUser) {
      try { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); } catch (_) {}
    }
    sub = null;
  }

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

// ---------- เลือกชนิดการแจ้งเตือน ----------
// ค่าเริ่มต้นเป็น "เปิด" ทั้งคู่ — คนที่อุตส่าห์กดอนุญาตแจ้งเตือนไว้ แปลว่าเขาอยากได้
// เก็บใน state.settings จึงขึ้น cloud เองผ่าน pushToCloud() แล้ว send-reminders อ่านได้ทันที
// ไม่ต้องมีตารางใหม่ ไม่ต้องมีทางซิงก์เส้นที่สอง
function notifPref(key) { return state.settings[key] !== false; }

function toggleNotifPref(key) {
  const on = !notifPref(key);
  state.settings[key] = on;
  save();
  renderProfile();
  const name = key === 'notifDue' ? 'การเตือนงานใกล้ถึงกำหนด' : 'การทักเมื่อหายไปหลายวัน';
  showToast(on
    ? { title: 'เปิดแล้ว 🔔', body: name + ' จะกลับมาทำงานตามปกติ' }
    : { title: 'ปิดแล้ว', body: name + ' จะไม่ถูกส่งอีก — เปิดกลับได้ตรงนี้ทุกเมื่อ' });
}

// เอาไปโชว์บนปุ่มและซ่อน/แสดงแถว · เรียกจาก renderProfile
function renderNotifPrefs() {
  const granted = ('Notification' in window) && Notification.permission === 'granted';
  for (const [key, row, btn] of [
    ['notifDue', 'prefDueRow', 'prefDueBtn'],
    ['notifNudge', 'prefNudgeRow', 'prefNudgeBtn'],
  ]) {
    const r = document.getElementById(row), b = document.getElementById(btn);
    // ยังไม่อนุญาตแจ้งเตือน = สวิตช์พวกนี้ไม่มีความหมาย ซ่อนไว้ดีกว่าโชว์ของที่กดแล้วไม่เกิดอะไร
    if (r) r.hidden = !granted;
    if (b) b.textContent = notifPref(key) ? 'เปิดอยู่' : 'ปิดอยู่';
  }
}

async function enableNotif() {
  if (!('Notification' in window)) {
    if (isIOS() && !isStandalone()) { showInstallGuide(); return; } // สาเหตุคือยังไม่ได้ติดตั้ง แก้ตรงนี้ทันที
    return;
  }
  const perm = await Notification.requestPermission();
  // จุดร่วงที่ใหญ่ที่สุดจุดหนึ่ง — คนที่กดปฏิเสธตรงนี้จะไม่ได้รับการเตือนอีกเลย
  // และกล่องโต้ตอบของเบราว์เซอร์ขอซ้ำไม่ได้ ถ้าไม่บันทึกไว้เราจะไม่มีทางรู้ว่าเขาเคยมาถึงตรงนี้
  funnelMark('notifAskedAt');
  funnel().notif = perm;
  save();
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
  // งานที่ไม่ได้เลือกวิชาจะมี subject = 'อื่น ๆ' ติดมา ซึ่งเอามาแทนชื่องานในประโยคไม่ได้
  // ("อื่น ๆ เลยเวลาส่งไปแล้วน้า" ไม่ได้บอกว่างานไหน) → ถอยไปใช้ชื่องานแทน
  const s = taskLabel(t);
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
  return { title: 'มีงานรออยู่นะ ✨', body: `${taskTitleText(t)} (${fmtDue(t.due, now, t)})` };
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
    el.innerHTML = `<img class="tav" src="logo-splash-light.png" alt=""><div class="tc"><div class="tt"></div><div class="tb"></div></div><button class="tu" type="button" hidden>เลิกทำ</button>`;
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
// ชื่อแอปขึ้นบนสุดของการ์ดเสมอ — ใส่ที่นี่ที่เดียว ผู้เรียกทุกที่จึงส่งแค่หัวข้อจริงมา
// (ต้องตรงกับ APP_NAME ใน sw.js ที่ทำแบบเดียวกันกับ push จากเซิร์ฟเวอร์)
const NOTIF_BRAND = 'Student OS';

async function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  title = title ? NOTIF_BRAND + ' · ' + title : NOTIF_BRAND;
  const opt = {
    body, tag: tag || 'studentos-alt',
    icon: 'icon-192.png', badge: 'icon-192.png',
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
    // บริบทเป็นข้อมูลชีวิตประจำวัน (เรียนกี่โมง นอนกี่โมง ซ้อมบอลวันไหน)
    // "ล้างข้อมูลทุกอย่าง" ที่ไม่ล้างของพวกนี้ด้วยคือคำโกหก — และเป็นข้อมูลที่อ่อนไหวที่สุดที่แอปเก็บ
    if (typeof ctxClear === 'function') ctxClear();
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
// โค้ดชุดนี้ผูกกับรุ่นเดียว: ถ้า APP_VERSION ขยับไปรุ่นอื่นเมื่อไหร่
// ช่องใส่โค้ดจะหายไปเองและโค้ดจะหมดอายุทันที ไม่ต้องไล่ลบทีละจุด
// จะให้รุ่นถัดไปใช้ได้ต้องตั้งใจแก้บรรทัดล่างนี้เอง
// ตอนนี้ผูกกับ 1A7V (ชื่อใหม่ของรุ่นก่อนหน้า) ส่วน APP_VERSION เป็น 1A7V2 → โค้ดจึงหมดอายุอยู่
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
  vaultTouch();
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
  vaultTouch();
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

// ---------- จอแรกที่ผู้ใช้เห็น ----------
// เคยมีฉากเปิดแอป (โลโก้ + แถบเปอร์เซ็นต์ + เกร็ดความรู้) คั่นอยู่ 3.6 วินาทีขั้นต่ำ
// เอาออกแล้ว เพราะมันคือเวลาที่ผู้ใช้ต้องนั่งมองทุกครั้งที่เปิดแอป โดยไม่ได้อะไรกลับไป
// นอกจากรู้ว่าแอปกำลังโหลด — ซึ่งหน้าบัญชีก็บอกได้เหมือนกัน แถมกดต่อได้ทันที
//
// ปัญหาที่ต้องแก้พร้อมกันตอนเอาออก: routeStart() ของเดิมถูกเรียก "หลัง" await สองตัว
// (รอฟอนต์ 2.5 วิ + เชื่อมบัญชี 6 วิ) ซึ่งไม่เป็นไรตอนมีฉากเปิดบังอยู่ แต่พอไม่มีแล้ว
// ผู้ใช้จะจ้องจอเปล่า ๆ ได้นานถึง 8 วินาทีกว่าจอแรกจะโผล่ จอแรกจึงต้องถูกเลือก
// ตั้งแต่บรรทัดแรกของ initApp โดยใช้ข้อมูลในเครื่องล้วน ห้ามรอเน็ต

// "คนนี้เคยล็อกอินค้างไว้ไหม" — ตอบจาก localStorage ตรง ๆ ไม่ต้องรอ Supabase ตอบกลับ
// supabase-js เก็บ session ไว้ที่คีย์ sb-<project-ref>-auth-token เสมอ
// จำเป็นเพราะถ้าไม่รู้ล่วงหน้า คนที่ล็อกอินค้างอยู่จะเห็นหน้า "เข้าสู่ระบบ" แวบหนึ่ง
// ทุกครั้งที่เปิดแอป ทั้งที่เขาล็อกอินอยู่แล้ว ซึ่งน่ารำคาญกว่าฉากเปิดแอปที่เพิ่งเอาออกอีก
//
// อ่านแค่ว่า "มีโทเคนที่ยังไม่หมดอายุอยู่ไหม" ไม่ได้เอาไปใช้ยืนยันตัวตน
// การยืนยันจริงยังเป็นหน้าที่ของ initCloud() เหมือนเดิม
function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
      const v = JSON.parse(localStorage.getItem(k) || 'null');
      const exp = v && (v.expires_at || (v.currentSession && v.currentSession.expires_at));
      if (exp && exp * 1000 > Date.now()) return true;
    }
  } catch (_) {}
  return false;
}

// ---------- ALT: ทำความรู้จักผู้ใช้ (ครั้งแรกที่เปิด) ----------
const ONBOARD_SKIP_KEY = 'studentos.alt.onboardSkipped';

// ชื่อที่ผู้ใช้อยากให้เรียก — ใช้ทั่วแอป ทั้งคำชม คำเตือน และหน้าไม่มีงาน
function who() { return (state.settings.name || '').trim(); }

// หน้าทำความรู้จักขึ้นครั้งเดียวในชีวิตของเครื่องนั้น และขึ้นเฉพาะตอนที่ยังไม่มีอะไรเลย (1A9n)
//
// เดิมเช็คแค่ "ยังไม่รู้ชื่อ" ซึ่งพอในกรณีปกติ แต่ชื่อเป็นข้อมูลชิ้นเดียวที่หายได้
// โดยที่ของอื่นยังอยู่ครบ — ล้างชื่อในแท็บ "ฉัน" หรือ sync จาก cloud ที่ยังไม่มีฟิลด์นี้
// แล้วคนที่ใช้มาสามเดือนพร้อมงานสามสิบชิ้นจะโดนถามใหม่ทั้งชุดเหมือนเพิ่งลงแอป
//
// จึงถามหลักฐานทุกชิ้นที่แปลว่า "เครื่องนี้เคยถูกใช้มาแล้ว" ไม่ใช่แค่ชิ้นเดียว
// ผิดพลาดไปทางไม่ถามดีกว่าถามซ้ำ — คนที่ยังไม่ได้ตอบยังเจอการ์ดชวนกรอกในแท็บ "ฉัน" อยู่
function needsOnboard() {
  if (localStorage.getItem(ONBOARD_SKIP_KEY)) return false;              // เคยผ่านหน้านี้แล้ว
  if (who()) return false;                                               // รู้จักชื่อแล้ว
  if (state.tasks && state.tasks.length) return false;                   // มีงานอยู่ = เคยใช้มาก่อน
  if (typeof ctxIsEmpty === 'function' && !ctxIsEmpty()) return false;    // มีตารางเรียนแล้ว
  return true;
}

// ---------- ทางเข้าจาก URL ----------
// อ่านคิวรีเก็บไว้ตั้งแต่ตอนสคริปต์ถูกโหลด เพราะมีหลายที่ที่ล้าง URL ทิ้งหลังใช้เสร็จ
// ใครอ่านทีหลังจะเจอ URL เปล่า แล้วฟีเจอร์ที่มาทีหลังก็เงียบไปโดยไม่มีใครรู้ว่าทำไม
const BOOT_Q = (() => {
  try { return new URLSearchParams(location.search); } catch (_) { return new URLSearchParams(); }
})();

// ---------- ลิงก์เข้าร่วมห้องจาก LINE (?join=XXXXXX) ----------
// เก็บ token ไว้ก่อน ไม่ใช้ทันที — คนที่กดลิงก์มาจากกลุ่มส่วนใหญ่ยังไม่ได้ล็อกอิน
// ถ้าใช้ตอนเปิดเลย จะพลาดทุกคนที่มาครั้งแรก ซึ่งคือเกือบทั้งหมดของคนที่ลิงก์นี้มีไว้เพื่อ
const JOIN_KEY = 'studentos.alt.joinToken';

function stashJoinToken() {
  try {
    const t = BOOT_Q.get('join');
    if (!t) return;
    localStorage.setItem(JOIN_KEY, t.trim().toUpperCase().slice(0, 12));
  } catch (_) { /* ที่เก็บเต็มหรือถูกปิด — ปล่อยผ่าน ไม่ใช่เรื่องที่ต้องหยุดทั้งแอป */ }
}

// เรียกได้หลายครั้ง ปลอดภัยเสมอ — ไม่มี token หรือยังไม่ล็อกอินก็แค่ออก
async function applyJoinToken() {
  let t = null;
  try { t = localStorage.getItem(JOIN_KEY); } catch (_) { return; }
  if (!t || !(sb && currentUser)) return;
  try {
    const { data, error } = await sb.rpc('join_line_room', { p_token: t });
    if (error) throw error;
    try { localStorage.removeItem(JOIN_KEY); } catch (_) {}
    if (!data) {
      showToast({ title: 'ลิงก์นี้ใช้ไม่ได้แล้ว',
        body: 'ขอลิงก์ใหม่ได้โดยพิมพ์ “ลิงก์” ในกลุ่มห้อง' });
      return;
    }
    if (typeof funnelMark === 'function') { funnelMark('lineLinkedAt'); save(); }
    showToast({ title: 'เข้าร่วมห้องแล้ว 🎉',
      body: 'งานที่ครูสั่งในกลุ่มนั้นจะเข้ามาให้เอง ไม่ต้องพิมพ์เอง' });
    if (typeof loadLineLinks === 'function') await loadLineLinks();
    if (typeof pullInbox === 'function') await pullInbox();
  } catch (e) {
    // ไม่ลบ token ทิ้ง — เน็ตหลุดกลางทางแล้วต้องได้ลองใหม่รอบหน้า
    console.warn('[join] เข้าร่วมห้องไม่สำเร็จ:', (e && e.message) || e);
  }
}

// ---------- ข้อความที่แชร์เข้ามา (Web Share Target) ----------
// เมนูแชร์ของ Android ส่ง title/text/url มาทางคิวรี · รวมเป็นก้อนเดียวแล้วโยนเข้ากล่องเข้า
//
// นี่คือทางที่ใช้ได้กับทุกแอปโดยไม่ต้องต่อ API กับใคร — Messenger, Discord, Classroom
// หรือแม้แต่โน้ตของตัวเอง ต่างจากบอทที่ต้องทำใหม่ทีละแพลตฟอร์มและส่วนใหญ่ก็ปิดประตูไปแล้ว
// (iOS ไม่รองรับ Share Target สำหรับ PWA — บน iPhone ยังต้องก๊อปมาแปะเหมือนเดิม)
// เก็บลงเครื่องก่อน แล้วค่อยหยิบไปใช้ — ไม่อ่านจาก BOOT_Q ตรง ๆ
// เพราะตอนติดตั้งครั้งแรก service worker ตัวใหม่เข้าคุมแล้วสั่ง location.reload()
// รอบที่สอง URL ถูกล้างไปแล้ว ข้อความที่เขาอุตส่าห์แชร์มาจะหายเงียบ ๆ ในการลองครั้งแรกพอดี
// ซึ่งเป็นครั้งที่แพงที่สุด — คนที่ลองแล้วไม่เกิดอะไรจะไม่ลองอีก
const SHARE_KEY = 'studentos.alt.sharedText';

function stashSharedText() {
  const s = ['title', 'text', 'url'].map(k => BOOT_Q.get(k)).filter(Boolean).join(' ').trim();
  if (!s) return;
  try { localStorage.setItem(SHARE_KEY, s.slice(0, 2000)); } catch (_) {}
}

// หยิบแล้วลบทิ้งทันที — กันไม่ให้รีเฟรชอีกทีแล้วเพิ่มงานซ้ำ
function takeSharedText() {
  let s = null;
  try {
    s = localStorage.getItem(SHARE_KEY);
    if (s) localStorage.removeItem(SHARE_KEY);
  } catch (_) { return null; }
  return s || null;
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

// หน้าแนะนำ (land.html) ส่ง ?start=google|guest มา — คนกดเลือกไปแล้วที่หน้านั้น
// จอบัญชีจึงไม่ควรถามซ้ำ ไม่งั้นปุ่มบนหน้าขายของก็แค่พาไปเจอคำถามเดิม
//
// อ่านครั้งเดียวตอนโหลดไฟล์แล้วล้าง query ทิ้งทันที เพราะ routeStart()
// ถูกเรียกสองรอบโดยตั้งใจ — ถ้าอ่านสดทุกรอบจะยิง OAuth ซ้ำสองครั้ง
const LANDING_START = (() => {
  try {
    const s = new URLSearchParams(location.search).get('start');
    if (s !== 'google' && s !== 'guest') return null;
    history.replaceState(null, '', location.pathname);
    return s;
  } catch (_) { return null; }
})();
let landingUsed = false;

// เลือกจอแรกหลังเปิดแอป: บัญชี → ทำความรู้จัก → เข้าแอป
//
// ถูกเรียกสองครั้งโดยตั้งใจ:
//   1. ตอนเปิดแอปทันที — ยังไม่รู้ว่า session ใช้ได้จริงไหม จึงเดาจาก hasStoredSession()
//   2. หลัง initCloud() ตอบกลับ — ตอนนั้นรู้ของจริงแล้ว ถ้าเดาผิดค่อยแก้จอให้ถูก
// เรียกซ้ำแล้วผลเหมือนเดิมเสมอถ้าคำตอบไม่เปลี่ยน จึงเรียกกี่ครั้งก็ปลอดภัย
function routeStart() {
  const signedIn = currentUser || hasStoredSession();

  // เพิ่งกดปุ่มมาจากหน้าแนะนำ — ทำตามที่เขากดเลย ไม่ต้องแวะจอบัญชี
  // (คนที่ล็อกอินค้างอยู่แล้วไม่โดน — ปุ่มพวกนี้มีไว้สำหรับคนที่ยังไม่มีบัญชี)
  if (LANDING_START && !landingUsed && !signedIn) {
    landingUsed = true;
    if (LANDING_START === 'guest') { skipLogin(); return; }
    if (cloudConfigured()) { go('scr-login'); loginGoogle(); return; }
    skipLogin(); return; // ไม่มีระบบบัญชีให้สมัคร ก็อย่าปล่อยให้ค้างหน้าเปล่า
  }

  if (cloudConfigured() && !signedIn && !localStorage.getItem('studentos.alt.skipLogin')) {
    go('scr-login'); // มีระบบบัญชี + ยังไม่เคยเลือก → ให้เลือกก่อน
  } else if (needsOnboard()) {
    openOnboard();
  } else {
    // ปุ่มลัดมาก่อนเสมอ — ผู้ใช้เพิ่งกดบอกว่าจะไปไหน ชนะจอที่ค้างไว้จากรอบก่อน
    go(shortcutTarget() || resumeScreen() || 'scr-menu');
  }
}

// ใช้หลังผ่านหน้าบัญชีแล้ว (ล็อกอินสำเร็จ หรือกดใช้แบบไม่ล็อกอิน)
function routeAfterLogin() {
  if (needsOnboard()) return openOnboard();
  // กลับไปที่จอที่กดล็อกอินมา ถ้ามีธงค้างไว้ — คนที่กดล็อกอินจากหน้าเพื่อน
  // แล้วถูกส่งกลับมาที่หน้าแรก ส่วนใหญ่ไม่เดินกลับไปหน้าเพื่อนเองอีก
  // (ธงถูกลบทิ้งตอนอ่าน จึงมีผลครั้งเดียวต่อการล็อกอินหนึ่งครั้ง)
  const back = typeof takeAfterLogin === 'function' ? takeAfterLogin() : null;
  if (back === 'scr-mates') {
    if (typeof openFeed === 'function') openFeed();
    return;
  }
  go('scr-menu');
}

function openOnboard() {
  const n = document.getElementById('obName');
  const f = document.getElementById('obFree');
  if (n) n.value = state.settings.name || '';
  if (f) setObFree(state.settings.freeHours || 2, true);
  const w = document.getElementById('obWelcome');
  if (w) { w.hidden = true; w.classList.remove('on'); }
  obMeta = { hear: state.settings.hearFrom || '', grade: state.settings.grade || '' };
  renderObMeta();
  obShowStep(1);
  go('scr-onboard');
}

// ---------- ขั้น 2: รูปร่างของวันธรรมดา ----------
// สามคำถามนี้ถูกเลือกมาเพราะให้ "ช่องว่างจริง" ต่อการกดหนึ่งครั้งมากที่สุด
// เลิกเรียนกับเดินทางเป็นตัวกำหนดว่าบ่ายเริ่มได้เมื่อไหร่ (คือช่วงที่แผนเดิมมองไม่เห็นเลย)
// ส่วนเวลานอนเป็นตัวกำหนดปลายวัน — ที่เหลือคำนวณเอาได้หมด ไม่ต้องถามเพิ่ม
//
// ที่ไม่ถามคือ "เข้าเรียนกี่โมง" เพราะเช้าของเด็กมัธยมไทยแทบไม่มีใครว่างอยู่แล้ว
// ตอบไปก็ไม่เปลี่ยนแผนสักบรรทัด — คำถามที่ไม่เปลี่ยนคำตอบคือคำถามที่ควรตัดทิ้ง
const OB_SCHOOL_START = '08:00';
const OB_OUT = ['15:00', '15:30', '16:00', '16:30', '17:00'];
const OB_TRIP = [[0, 'ถึงเลย'], [30, '30 นาที'], [60, '1 ชม.'], [90, '1 ชม. ครึ่ง']];
const OB_BED = [['21:00', '3 ทุ่ม'], ['22:00', '4 ทุ่ม'], ['23:00', '5 ทุ่ม'], ['00:00', 'เที่ยงคืน']];

let obDay = { out: '16:00', trip: 30, bed: '22:00' };

// ---------- ขั้น 1–2: คำถามที่กดปุ่มเดียวจบ (1A9m) ----------
// ทั้งสองข้อไม่ได้เอาไปคำนวณอะไรในแผน มันมีไว้เพื่อสองอย่าง:
//   1) เก็บไว้ดูว่าคนมาจากทางไหน (hear) — ข้อมูลที่ไม่มีทางรู้ถ้าไม่ถามตอนนี้
//   2) เปิดหน้าด้วยคำถามที่ตอบง่ายกว่าการพิมพ์ชื่อ
// ข้อสองไม่ใช่ของแถม: ช่องพิมพ์เป็นอย่างแรกที่เห็นคือเหตุผลที่คนกดข้ามทั้งหน้า
const OB_HEAR = [['friend', 'เพื่อนแนะนำ'], ['social', 'TikTok · IG'],
                 ['school', 'ครู · โรงเรียน'], ['search', 'หาเจอเอง']];
const OB_GRADE = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

let obMeta = { hear: '', grade: '' };

const OB_STEPS = ['obStepHear', 'obStepGrade', 'obStep1', 'obStep2'];

function obShowStep(n) {
  OB_STEPS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.hidden = (i + 1) !== n;
  });
}

function obStepNext(n) {
  obShowStep(n);
  haptic('tap');
}

function obMetaPick(key, val) {
  // กดซ้ำที่อันเดิม = ยกเลิกคำตอบ ทั้งสองข้อข้ามได้ ไม่ควรมีทางเลือกที่กดแล้วถอนไม่ได้
  obMeta[key] = obMeta[key] === val ? '' : val;
  haptic('tap');
  renderObMeta();
}

function renderObMeta() {
  const hear = document.getElementById('obHear');
  if (hear) hear.innerHTML = OB_HEAR.map(([v, label]) => `<button type="button"
    class="ob-chip${obMeta.hear === v ? ' on' : ''}"
    onclick="obMetaPick('hear', '${v}')">${esc(label)}</button>`).join('');
  const grade = document.getElementById('obGrade');
  if (grade) grade.innerHTML = OB_GRADE.map(v => `<button type="button"
    class="ob-chip${obMeta.grade === v ? ' on' : ''}"
    onclick="obMetaPick('grade', '${v}')">${esc(v)}</button>`).join('');
}

// ขั้นแรกต้องมีชื่อก่อนถึงจะไปต่อ — ทั้งแอปเรียกชื่อนี้ ปล่อยผ่านไม่ได้
function obNext() {
  const input = document.getElementById('obName');
  const name = (input.value || '').trim();
  const err = document.getElementById('obErr');
  if (!name) {
    err.hidden = false;
    input.classList.add('bad');
    input.focus();
    setTimeout(() => input.classList.remove('bad'), 500);
    return;
  }
  err.hidden = true;
  obShowStep(4);
  renderObDay();
  haptic('tap');
}

function obPick(key, val) {
  obDay[key] = val;
  haptic('tap');
  renderObDay();
}

function renderObDay() {
  const chips = (id, list, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = list.map(([v, label]) => `<button type="button"
      class="ob-chip${obDay[key] === v ? ' on' : ''}"
      onclick="obPick('${key}', ${typeof v === 'number' ? v : `'${v}'`})">${esc(label)}</button>`).join('');
  };
  chips('obOut', OB_OUT.map(v => [v, v]), 'out');
  chips('obTrip', OB_TRIP, 'trip');
  chips('obBed', OB_BED, 'bed');

  // คำนวณจากคำตอบตรง ๆ ไม่ต้องเขียนลงบริบทก่อน — เขายังไม่ได้กดยืนยันสักหน่อย
  const home = min2hm(hm2min(obDay.out) + obDay.trip);
  const bed = hm2min(obDay.bed) || 22 * 60;
  const stop = (bed === 0 ? 24 * 60 : bed) - 60;      // เที่ยงคืนคือ 0 ต้องคิดเป็นปลายวัน
  const free = Math.max(0, stop - hm2min(home));
  const peek = document.getElementById('obPeek');
  if (!peek) return;
  peek.innerHTML = free < 30
    ? `<span class="obp-h">${icon('clock')}วันธรรมดาแทบไม่เหลือเวลาเลย</span>
       <span class="obp-p">ไม่เป็นไร — AI จะกันงานหนักไว้เสาร์อาทิตย์ให้แทน</span>`
    : `<span class="obp-h">${icon('clock')}วันธรรมดาคุณว่าง
         <b>${esc(home)}–${esc(min2hm(stop))}</b></span>
       <span class="obp-p">ประมาณ ${Math.round(free / 6) / 10} ชม. — AI จะวางงานลงช่วงนี้
         และเว้นชั่วโมงสุดท้ายก่อนนอนไว้ให้</span>`;
}

// เขียนคำตอบลงบริบทจริง — คาบเรียนหนึ่งก้อน จ–ศ + เวลาเดินทาง + เส้นเวลานอน
// ไม่ทับของเดิมเด็ดขาด: คนที่ล็อกอินแล้วดึงตารางจาก cloud มาไม่ควรโดนคำตอบหยาบ ๆ
// จากหน้าทำความรู้จักลบตารางที่เขาอุตส่าห์กรอกไว้ทั้งชุด
function obApplyDay() {
  if (typeof ctxUpsert !== 'function' || !ctxIsEmpty()) return false;
  const WEEKDAYS = [1, 2, 3, 4, 5];
  // เช้าก่อนเข้าเรียนต้องถูกกันไว้ด้วย ไม่งั้นช่วงตื่น–เข้าแถวจะถูกนับเป็นเวลาว่างวันละ 2 ชม.
  // ตัวเลขที่เกินจริงทุกวันธรรมดาคือตัวเลขที่ทำให้ทั้งหน้าจอเชื่อถือไม่ได้
  // ใครที่อ่านหนังสือตอนเช้าจริง ๆ ลบก้อนนี้ทิ้งได้ในหน้าบริบท — แต่ให้เป็นค่าตั้งต้นที่ปลอดภัยไว้ก่อน
  const wake = ctxPrefs().wake || '06:00';
  if (hm2min(wake) < hm2min(OB_SCHOOL_START)) {
    ctxUpsert('routine', { title: 'ตื่น เตรียมตัว ไปโรงเรียน', kind: 'routine',
      start: wake, end: OB_SCHOOL_START, weekday: WEEKDAYS });
  }
  ctxUpsert('class', { subject: 'เรียนที่โรงเรียน', start: OB_SCHOOL_START,
    end: obDay.out, weekday: WEEKDAYS });
  if (obDay.trip > 0) {
    ctxUpsert('routine', { title: 'เดินทางกลับบ้าน', kind: 'travel',
      start: obDay.out, end: min2hm(hm2min(obDay.out) + obDay.trip), weekday: WEEKDAYS });
  }
  const bed = hm2min(obDay.bed) || 24 * 60;
  ctxSetPrefs({ sleep: obDay.bed, noWorkAfter: min2hm(bed - 60) });
  return true;
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

function finishOnboard(skipDay) {
  const input = document.getElementById('obName');
  const name = (input.value || '').trim().slice(0, 24);
  const err = document.getElementById('obErr');
  if (!name) {
    obShowStep(3);
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
  // สองข้อนี้ข้ามได้ ค่าว่างจึงเป็นคำตอบที่ถูกต้อง — เขียนทับเฉพาะตอนที่มีคำตอบจริง
  if (obMeta.hear) state.settings.hearFrom = obMeta.hear;
  if (obMeta.grade) state.settings.grade = obMeta.grade;
  save();
  // ปักหมุดว่าผ่านหน้านี้แล้ว — เดิมบรรทัดนี้ "ลบ" หมุดทิ้ง แล้วไปพึ่งชื่อเป็นตัวจำแทน
  // ซึ่งแปลว่าวันไหนชื่อหาย หน้านี้ก็กลับมาถามใหม่ ทั้งที่เจ้าของเครื่องตอบไปหมดแล้ว
  // (ชื่อคีย์เดิมห้ามเปลี่ยน — เปลี่ยนเมื่อไหร่ทุกคนที่เคยกดข้ามจะโดนถามใหม่ทันที)
  localStorage.setItem(ONBOARD_SKIP_KEY, '1');
  haptic('done');
  // skipDay = กด "ยังไม่บอกตอนนี้" — บริบทว่างไว้ แผนจะกลับไปเดา 19:00 พร้อมการ์ดชวนกรอก
  showWelcome(name, skipDay ? false : obApplyDay());
}

function skipOnboard() {
  localStorage.setItem(ONBOARD_SKIP_KEY, '1'); // ข้ามแล้วไม่ต้องถามซ้ำทุกครั้งที่เปิด
  go('scr-menu');
}

// ฉาก "ยินดีที่ได้รู้จัก ___" — จังหวะเดียวที่แอปได้ทักผู้ใช้ด้วยชื่อเขาเป็นครั้งแรก
// gotDay = เขาตอบเรื่องรูปร่างของวันมาด้วยไหม
function showWelcome(name, gotDay) {
  // ของรางวัลรายวันไม่เด้งใส่คนใช้ครั้งแรกอีกแล้ว — จุดแดงบนแท็บ "ฉัน" รออยู่ตรงนั้นเอง
  // (ตัวแปรกันเด้งยังอยู่เพราะ openDailyCheck(true) ยังอ่านมันอยู่ เผื่อวันไหนเอาการเด้งกลับมา)
  checkinHoldUntil = Date.now() + 9000;
  const w = document.getElementById('obWelcome');
  document.getElementById('obwName').textContent = name;
  // คนที่อุตส่าห์ตอบเรื่องตารางมา ต้องได้ยินทันทีว่าคำตอบนั้นถูกใช้ทำอะไร
  // ไม่งั้นการถามสามคำถามก็เป็นแค่ด่านที่ต้องผ่านก่อนเข้าแอป
  document.getElementById('obwSub').textContent = gotDay
    ? 'รู้ตารางของ ' + name + ' แล้ว — จากนี้แค่บอกว่าครูสั่งอะไรมา เดี๋ยวจัดลงช่วงที่ว่างจริงให้เอง'
    : 'จากนี้ ' + name + ' แค่บอกว่าครูสั่งอะไรมา เดี๋ยวจัดลำดับให้เองว่าต้องทำอะไรก่อน';
  w.hidden = false;
  setTimeout(() => w.classList.add('on'), 20);
  setTimeout(() => {
    w.classList.remove('on');
    go('scr-menu');
    setTimeout(() => { w.hidden = true; }, 300);
    // ตัวเลขในข้อความนี้คำนวณสดจากบริบทที่เพิ่งเขียนไป ไม่ใช่ค่าที่พิมพ์ทิ้งไว้
    const win = typeof dayWindows === 'function' ? dayWindows(state.settings, new Date()) : null;
    const slot = win && win.slots[0];
    showToast({
      title: 'ยินดีที่ได้รู้จัก ' + name + ' 👋',
      body: gotDay && slot
        ? `ช่วงว่างถัดไปของคุณคือ ${slot.fromHm}–${slot.toHm} — เพิ่มงานแรกได้เลย`
        : 'ตั้งค่าเรียบร้อย — เพิ่มงานแรกได้เลย เดี๋ยวช่วยจัดลำดับให้',
    });
  }, 2300);
}

// ---------- init ----------
function tickClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  syncTimelineNow(); // ALT: หมุด "ตอนนี้" เดินตามเวลาจริงไปพร้อมนาฬิกา
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
  load();
  purgeOldTrash(); // ของในถังขยะที่เกิน 30 วัน ทิ้งถาวรตอนเปิดแอป
  funnelOpen();    // นับการเปิดแอป — ต้องอยู่หลัง load() ไม่งั้นนับทับก้อนเปล่า
  stashJoinToken();  // เก็บ token จากลิงก์กลุ่มไว้ก่อน ใช้จริงหลังล็อกอิน
  stashSharedText(); // ข้อความที่แชร์มาก็เก็บก่อนเหมือนกัน กันหายตอน sw สั่งรีโหลด
  // ล้างคิวรีออกจาก URL ครั้งเดียวตรงนี้ — ค่าที่ต้องใช้ถูกอ่านเก็บไว้ใน BOOT_Q แล้ว
  // ปล่อยค้างไว้ = รีเฟรชทีไรก็เข้าร่วมซ้ำ/เพิ่มงานซ้ำทุกที
  try { if (location.search) history.replaceState(null, '', location.pathname); } catch (_) {}

  // ป้ายเลขรุ่นกลางหัวจอถูกเอาออกจาก index.html แล้ว — บรรทัดนี้จึงไม่เจอ #verBadge
  // เก็บไว้เฉย ๆ เผื่อวันไหนเอาป้ายกลับมา จะได้ไม่ต้องมาไล่ต่อสายให้ APP_VERSION ใหม่
  const badge = document.getElementById('verBadge');
  if (badge) badge.textContent = APP_VERSION;

  applyDeepUnlock();     // ALT: ปุ่มธีมลับจะโผล่เฉพาะคนที่ปลดล็อกแล้ว
  applyGenesisUnlock();
  applyTheme();
  applyFontScale();  // ALT: ต้องมาก่อนวาดจอแรก ไม่งั้นตัวอักษรกระโดดขนาดให้เห็น
  applyUserBg();
  applyNav();
  fillSubjectSelect();
  initHomeSwipe(); // ALT: ปัดการ์ดในหน้าแรก (เกาะที่ #homeBody ครั้งเดียว อยู่รอดทุกการ render)
  initCrop();      // ALT: ลากกรอบในหน้าครอบภาพ
  // ช่อง "งานที่ต้องทำ" ยืดตามที่พิมพ์ · เกาะครั้งเดียวตอนบูต เพราะฟอร์มไม่ได้ถูกสร้างใหม่ทุกครั้ง
  const fd = document.getElementById('fDetail');
  if (fd) fd.addEventListener('input', () => autoGrow(fd));

  // วาดจอแรกตรงนี้ ก่อน await ทุกตัวข้างล่าง — นี่คือบรรทัดที่ทำให้เอาฉากเปิดแอปออกได้
  // ทุกอย่างที่จำเป็นต่อการวาดจอ (ธีม ฟอนต์สเกล พื้นหลัง เมนู) ถูกตั้งครบไปแล้วข้างบน
  // ที่เหลือ (ฟอนต์จาก CDN · บัญชี · การแจ้งเตือน) เติมเข้ามาทีหลังได้โดยไม่ต้องให้ใครรอ
  const guessedSignedIn = hasStoredSession();
  routeStart();

  // ข้อความที่แชร์เข้ามาจากแอปอื่น — ทำหลังวาดจอแรก จะได้เห็นผลทันทีว่ามันเข้าแล้ว
  // ไม่ต้องรอล็อกอิน เพราะกล่องเข้าอยู่ในเครื่อง คนที่แค่อยากลองจึงลองได้เลย
  const shared = takeSharedText();
  if (shared && typeof inboxAdd === 'function') {
    const r = inboxAdd(shared, 'share', { via: 'share' });
    // เขาปิดตัวเชื่อมนี้ไว้เอง แต่เพิ่งกดแชร์เข้ามา — เงียบไปเฉย ๆ คือแอปที่ดูเหมือนพัง
    // พาไปหน้าตัวเชื่อมเลย เพราะสวิตช์ที่ต้องกดอยู่ตรงนั้น ไม่ใช่ในกล่องเข้า
    const off = r && r.status === 'off';
    go(off ? 'scr-sources' : 'scr-inbox');
    setTimeout(() => showToast(
      off ? { title: 'ปิด "แชร์จากแอปอื่น" ไว้อยู่', body: 'เปิดสวิตช์แล้วแชร์เข้ามาใหม่อีกที' }
      : r && r.status === 'noise'
        ? { title: 'เก็บไว้ในบันทึกแล้ว', body: 'อ่านแล้วไม่เหมือนงานที่ครูสั่ง เลยไม่เอาขึ้นเป็นคำถาม' }
        : { title: 'รับข้อความแล้ว 📥', body: 'ดูในกล่องเข้าได้เลยว่าแกะออกมาเป็นงานอะไร' }), 700);
  }

  // ฟอนต์ไทยมาจาก CDN — รอให้พร้อมก่อน ไม่งั้นจอแรกกระตุกตอนฟอนต์สลับ
  // ถ้าเน็ตช้าหรือโหลดไม่ขึ้น ไม่รอเกิน 2.5 วิ แล้วไปต่อด้วยฟอนต์ระบบ
  if (document.fonts && document.fonts.ready) {
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  }

  tickClock();
  setInterval(tickClock, 30_000);
  // นาฬิกาจับเวลาเดินทุกวินาที — ขยับแค่ตัวเลขในแถบ ไม่ได้วาดจอใหม่
  setInterval(renderRunBar, 1000);
  // แผนของวันต้องเดินตามเวลาจริง — ดู minuteTick()
  minuteTick();
  setInterval(minuteTick, 15_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) minuteTick(); });
  addEventListener('pageshow', minuteTick);
  // รอบที่ค้างข้ามคืนเพราะลืมกดหยุด — บอกให้รู้ว่าทิ้งไปแล้ว ไม่ใช่หายเงียบ ๆ
  const stale = reapStaleWork();
  if (stale) {
    const st = state.tasks.find(x => x.id === stale.taskId);
    setTimeout(() => showToast({
      title: 'มีการจับเวลาค้างไว้',
      body: (st ? taskTitleText(st) : 'งานหนึ่ง') + ' เริ่มไว้ตั้งแต่ ' +
        fmtClock(new Date(stale.start)) + ' แต่ไม่ได้กดหยุด — รอบนั้นไม่ถูกบันทึก',
    }), 3200);
  }
  // เช็คบ่อยขึ้น (นาทีละครั้ง) + เช็คทุกครั้งที่กลับมาที่แอป
  // เวลาที่มือถือพักหน้าจอ timer จะถูกหยุด การกลับมาแล้วเช็คทันทีคือสิ่งที่ทำให้เตือนไม่หลุด
  setInterval(checkReminders, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
  checkReminders();

  await initCloud();
  // ตรวจคำเดาเมื่อกี้ว่าถูกไหม — แก้จอเฉพาะตอนเดาผิด ไม่ใช่วาดใหม่ทุกครั้ง
  // เดาผิดได้ทางเดียว: มีโทเคนค้างอยู่ใน localStorage แต่ใช้จริงไม่ได้แล้ว
  // (ถูกเพิกถอน · เปลี่ยนรหัส · หมดอายุระหว่างที่ปิดแอปไว้)
  if (guessedSignedIn && !currentUser && cloudConfigured() &&
      !localStorage.getItem('studentos.alt.skipLogin')) {
    routeStart();
  }
  // ตอนนี้รู้แล้วว่าล็อกอินสำเร็จจริงไหม — ถ้ามี token ค้างจากลิงก์กลุ่ม ใช้ตรงนี้
  await applyJoinToken();
  await refreshPushState();
  // เคยกดอนุญาตไว้แล้ว + ล็อกอินอยู่ → ต่อ push ให้อัตโนมัติ (เผื่อ subscription หลุด)
  if ('Notification' in window && Notification.permission === 'granted' && currentUser) {
    subscribePush().then(() => renderProfile()).catch(() => {});
  }

  // หน้าต่างเช็คอินไม่เด้งเองอีกแล้ว
  // ของรางวัลรายวันเคยเป็นสิ่งแรกที่ผู้ใช้เห็นตอนเปิดแอป — แผ่นเต็มจอทับหน้าแรกไว้ทั้งใบ
  // พร้อม toast เตือนงานซ้อนอยู่ข้างบนอีกชั้น คนที่เปิดแอปมาเพราะกลัวลืมส่งงาน
  // จึงต้องปัดของแจกทิ้งก่อนถึงจะได้เห็นงานของตัวเอง
  // ตอนนี้เหลือจุดแดงบนแท็บ "ฉัน" แทน (ดู renderTabBadges) — เห็นว่ามีของรอ
  // แต่เป็นคนเลือกเองว่าจะไปรับตอนไหน ส่วนตารางรอบ 7 วันยังกดดูได้ที่ร้านค้าเหมือนเดิม
  // ถึง 6 โมงเช้าระหว่างแอปเปิดค้าง จุดแดงก็ต้องขึ้นเอง ไม่ต้องรอปิดเปิดใหม่
  setInterval(renderTabBadges, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderTabBadges();
  });

  // ของสองอย่างที่เคยรอฉากเปิดแอปปิดก่อนถึงจะเด้ง — ตอนนี้รอให้ผู้ใช้ตั้งตัวแทน
  // toast เตือนงานด่วนขึ้นเฉพาะตอนที่เขาอยู่ในแอปจริงแล้ว ไม่ใช่ตอนยังค้างหน้าบัญชี
  setTimeout(() => {
    if (!document.getElementById('scr-login').classList.contains('on') &&
        !document.getElementById('scr-onboard').classList.contains('on')) openNudge();
    // iPhone + Safari (ยังไม่ติดตั้ง) → เด้งแนะนำวิธีติดตั้งอัตโนมัติครั้งเดียว กันลืม/กันงง
    if (isIOS() && !isStandalone() && !localStorage.getItem('studentos.alt.installGuideDismissed')) {
      setTimeout(showInstallGuide, 1400);
    }
  }, 900);
})();
