// ============================================================
// StudentOS AI — App (UI + state)  ·  *** เวอร์ชัน ALT (SANDBOX) ***
// ข้อมูลจริง เก็บใน localStorage · ทุกจอ render จาก state
// ------------------------------------------------------------
// ALT = รุ่นทดลองฟีเจอร์ แยกขาดจากตัวจริง:
//   - localStorage ใช้ prefix 'studentos.alt.*' → เล่นยังไงก็ไม่แตะข้อมูลตัวจริง
//   - service worker ใช้ cache คนละชื่อ
// ============================================================

const APP_VERSION = '1A5';                 // สายเลข ALT ของตัวเอง ไม่ผูกกับ v35 ของตัวจริงแล้ว
const APP_CHANNEL = 'ALT';                 // ป้ายกำกับรุ่น — โชว์ทั้งบนแอปและในหน้า "ฉัน"
const STORE_KEY = 'studentos.alt.v1';      // ALT: แยกที่เก็บข้อมูลจากตัวจริง ('studentos.v1')
const APP_T0 = performance.now(); // ใช้คุมเวลาโชว์ splash ขั้นต่ำ

let state = { tasks: [], settings: { name: '', freeHours: 2 } };
let editingId = null; // null = เพิ่มใหม่, ไม่ null = แก้ไขงานเดิม

// ---------- storage ----------
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state = Object.assign({ tasks: [], settings: { name: '', freeHours: 2 } }, JSON.parse(raw));
  } catch (e) { /* ข้อมูลเสีย → เริ่มใหม่ */ }
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
  light: '#FCFBF7', dark: '#0D1220', warm: '#F7F1E4', space: '#0A0E24',
  earth: '#F1F6F1', library: '#EFE3CE', magic: '#150E26', galaxy: '#0B0618',
};
const THEME_NAME = {
  system: 'ตามระบบ', light: 'สว่าง', dark: 'มืด', warm: 'อุ่น', space: 'อวกาศ',
  earth: 'โลก', library: 'ห้องสมุด', magic: 'เวทมนตร์', galaxy: 'กาแล็กซี',
};
const THEMES = Object.keys(THEME_NAME);

function themePref() {
  let v = null;
  try { v = localStorage.getItem(THEME_KEY); } catch (_) {}
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
  const now = document.getElementById('themeNow');
  if (now) now.textContent = pref === 'system' ? `ตามระบบ · ตอนนี้โทน${THEME_NAME[theme]}` : '';
}

function setTheme(pref) {
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
function go2(id){ return go(id); }
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
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
// ---------- หน้าแรก ----------
// โครง: หัวข้อทักทาย → การ์ดสรุปของ AI → งาน 3 อันดับแรก → ทางไปงานที่เหลือ
// การ์ดสรุปคือที่เดียวที่ AI "พูด" ยาว ๆ ได้ การ์ดงานจึงเหลือแต่ข้อมูลดิบล้วน
function briefCard(pending, now) {
  const top = pending[0];
  const raw = aiGreeting(pending, state.settings, now);
  // เน้นชื่อวิชากับจำนวนชั่วโมง เพราะเป็นสองคำที่สายตาต้องจับให้ได้ก่อน
  let msg = esc(raw).replace(/~([\d.]+) ชม\./g, '<b>~$1 ชม.</b>');
  if (top && top.subject) msg = msg.replace(esc(top.subject), '<b>' + esc(top.subject) + '</b>');
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
    <h1 class="page-title">${greet}, ${esc(name)}</h1>
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
    + `<div class="sw-hint"><span class="l">${icon('chevron')}เลื่อนพรุ่งนี้</span>
        <span class="r">ทำเสร็จ${icon('chevron')}</span></div>`
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
    <div class="empty-ring">${icon(cleared ? 'check-circle' : 'sparkles')}</div>
    <h3 class="empty-h">${c.h}</h3>
    <p class="empty-p">${c.p}</p>
    ${today ? `<div class="empty-stat">${icon('flame')}วันนี้ติ๊กไปแล้ว <b>${today}</b> งาน</div>` : ''}
    <button class="empty-cta" onclick="go('scr-scan')">${icon('sparkles')}เพิ่มงานใหม่</button>
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
  t.remindedAt = null;   // กำหนดใหม่แล้ว ต้องเตือนใหม่ได้อีกครั้ง
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
      <p class="page-sub">ป้ายจอด <b>${dated.length}</b> งาน · หมุดของคุณขยับตามเวลาจริง</p>
    </div>`;

  if (!dated.length) {
    el.innerHTML = head + `<section class="empty-wrap">
      <div class="empty-ring">${icon('flag')}</div>
      <h3 class="empty-h">เส้นทางยังโล่ง</h3>
      <p class="empty-p">${undated.length
        ? 'มีงานอยู่ ' + undated.length + ' งานแต่ยังไม่ได้ใส่วัน — ใส่กำหนดส่งแล้วจะขึ้นมาเป็นป้ายบนเส้นทางทันที'
        : 'ยังไม่มีงานที่มีกำหนดส่ง เพิ่มงานแล้วจะเห็นเป็นป้ายจอดเรียงตามเวลา'}</p>
      <button class="empty-cta" onclick="go('scr-scan')">${icon('sparkles')}เพิ่มงานใหม่</button>
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
    <span class="tile">${icon(late.length ? 'flame' : 'pin')}</span>
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
    <span class="tile">${icon('sparkles')}</span>
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
    </div>
    <p class="jr-hint">ปัดซ้าย–ขวาเพื่อดูทั้งเส้นทาง · แตะป้ายเพื่อเปิดงานนั้น</p>`
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
      <div class="povf-head">${icon('flame')}<span>เวลาวันนี้ไม่พอ — ย้ายไปพรุ่งนี้</span></div>
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

  const av = document.getElementById('pfAv');
  if (av) av.innerHTML = pic ? `<img src="${esc(pic)}" alt="">` : esc(name.trim().charAt(0).toUpperCase() || 'N');
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
  const ver = document.getElementById('appVer');
  if (ver) ver.textContent = 'StudentOS ' + APP_CHANNEL + ' Version ' + APP_VERSION + ' · รุ่นทดลองฟีเจอร์';
  const pn = document.getElementById('pName'); if (pn) pn.value = state.settings.name || '';
  const pf = document.getElementById('pFree'); if (pf) pf.value = state.settings.freeHours || 2;

  // การแจ้งเตือน
  const st = document.getElementById('notifStatus');
  const nb = document.getElementById('notifBtn');
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

function renderAll() { renderHome(); renderTasks(); renderTimeline(); renderProfile(); renderPlan(); renderInstallCard(); }

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
    setTimeout(() => { renderAll(); showToast(celebrateCopy(cleared)); }, 430);
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
    const fields = [[d.type,'ประเภท'],[d.subject,'วิชา'],[d.teacher,'ครูผู้สั่ง'],[d.due,'กำหนดส่ง'],[d.score,'คะแนน'],[d.est,'เวลาที่ใช้']];
    const got = fields.filter(f => f[0]);
    const miss = fields.filter(f => !f[0]);
    chips.innerHTML = got.map(f => `<span class="chip new">${icon('check')}${esc(f[1])}</span>`).join('')
      + (miss.length ? `<span class="chip">อีก ${miss.length} ช่องเติมเอง</span>` : '');
    if (okBadge) {
      okBadge.className = 'fm-ok show';
      okBadge.innerHTML = `${icon('check-circle')}AI อ่านได้ ${got.length} จาก ${fields.length} ช่อง`;
    }
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
    if (target.due !== data.due) { data.snoozedAt = null; data.snoozeCount = 0; }
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
  parsedPending = parseAssignment(text);
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

async function scanFromPhoto(file) {
  const st = document.getElementById('ocrStatus');
  const barWrap = document.getElementById('ocrBarWrap');
  const bar = document.getElementById('ocrBar');
  let worker = null;
  try {
    st.textContent = '⏳ กำลังโหลดโมเดล OCR… (ครั้งแรกอาจรอนานหน่อย)';
    barWrap.hidden = false; bar.style.width = '5%';
    await withTimeout(loadTesseract(), 30_000, 'โหลดไลบรารี OCR');

    worker = await withTimeout(
      Tesseract.createWorker('tha+eng', 1, {
        workerPath: TESSERACT_BASE + 'worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        logger: m => {
          if (m.status === 'recognizing text') {
            bar.style.width = Math.round(m.progress * 100) + '%';
            st.textContent = '📖 AI กำลังอ่านใบงาน… ' + Math.round(m.progress * 100) + '%';
          } else if (m.status) {
            st.textContent = '⏳ ' + m.status + '…';
          }
        },
      }),
      45_000, 'เตรียมเครื่องมือ OCR'
    );
    const { data } = await withTimeout(worker.recognize(file), 60_000, 'อ่านรูปภาพ');
    await worker.terminate();
    worker = null;

    st.textContent = ''; barWrap.hidden = true;
    const text = normalizeOcrText(data.text); // OCR ไทยเว้นวรรคทีละตัวอักษร ต้องยุบก่อนแกะ
    if (text.length < 5) { alert('อ่านตัวหนังสือจากรูปไม่ได้ — ลองถ่ายให้ชัดขึ้น สว่างขึ้น หรือแปะข้อความแทน'); return; }
    runParsing(text, 'ocr');
  } catch (e) {
    st.textContent = ''; barWrap.hidden = true;
    console.error('[OCR]', e);
    if (worker) { try { await worker.terminate(); } catch (_) {} }
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
    el.innerHTML = `<img class="tav" src="logo-mark.png" alt=""><div class="tc"><div class="tt"></div><div class="tb"></div></div><button class="tu" type="button" hidden>เลิกทำ</button>`;
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

function checkReminders() {
  const now = new Date();
  const canNotify = ('Notification' in window) && Notification.permission === 'granted';
  for (const t of pendingTasks()) {
    if (!t.due || t.remindedAt) continue;
    const hLeft = (new Date(t.due) - now) / 3.6e6;
    if (hLeft > 0 && hLeft <= 24) {
      if (canNotify) {
        const c = reminderCopy(t, now);
        new Notification(c.title, { body: c.body, icon: 'icon-192.png', badge: 'icon-192.png' });
      }
      t.remindedAt = now.toISOString();
    }
  }
  save();
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
    state = { tasks: [], settings: { name: '', freeHours: 2 } };
    renderAll();
  }
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

// เลือกจอแรกหลังเปิดแอป: บัญชี → ทำความรู้จัก → เข้าแอป
function routeStart() {
  if (cloudConfigured() && !currentUser && !localStorage.getItem('studentos.alt.skipLogin')) {
    go('scr-login'); // มีระบบบัญชี + ยังไม่เคยเลือก → ให้เลือกก่อน
  } else if (needsOnboard()) {
    openOnboard();
  } else {
    go(liveTasks().length ? 'scr-home' : 'scr-scan'); // ครั้งแรก: เริ่มที่ Scan (จุดขายของเรา)
  }
}

// ใช้หลังผ่านหน้าบัญชีแล้ว (ล็อกอินสำเร็จ หรือกดใช้แบบไม่ล็อกอิน)
function routeAfterLogin() {
  if (needsOnboard()) openOnboard();
  else go(liveTasks().length ? 'scr-home' : 'scr-scan');
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
  go(liveTasks().length ? 'scr-home' : 'scr-scan');
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
    go(liveTasks().length ? 'scr-home' : 'scr-scan');
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

  applyTheme();
  applyFontScale();  // ALT: ต้องมาก่อนวาดจอแรก ไม่งั้นตัวอักษรกระโดดขนาดให้เห็น
  applyUserBg();
  fillSubjectSelect();
  initHomeSwipe(); // ALT: ปัดการ์ดในหน้าแรก (เกาะที่ #homeBody ครั้งเดียว อยู่รอดทุกการ render)
  // ฟอนต์ไทยมาจาก CDN — รอให้พร้อมก่อน ไม่งั้นจอแรกกระตุกตอนฟอนต์สลับ
  // ถ้าเน็ตช้าหรือโหลดไม่ขึ้น ไม่รอเกิน 2.5 วิ แล้วไปต่อด้วยฟอนต์ระบบ
  if (document.fonts && document.fonts.ready) {
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  }
  splashStep('theme');

  tickClock();
  setInterval(tickClock, 30_000);
  setInterval(checkReminders, 5 * 60_000);
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
