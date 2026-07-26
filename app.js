// ============================================================
// StudentOS AI — App (UI + state)
// ข้อมูลจริง เก็บใน localStorage · ทุกจอ render จาก state
// ============================================================

const APP_VERSION = 'v33';
const STORE_KEY = 'studentos.v1';
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
const THEME_KEY = 'studentos.theme';
// สีแถบสถานะของแต่ละโทน (ต้องตรงกับ --scr ใน style.css และตารางในสคริปต์ <head>)
const THEME_BAR = { light: '#FCFBF7', dark: '#0D1220', warm: '#F7F1E4', space: '#0A0E24' };
const THEME_NAME = { system: 'ตามระบบ', light: 'สว่าง', dark: 'มืด', warm: 'อุ่น', space: 'อวกาศ' };
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

// ---------- navigation ----------
function go2(id){ return go(id); }
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  document.body.classList.toggle('login-mode', id === 'scr-login');
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
      syncFromCloud().then(() => go(liveTasks().length ? 'scr-home' : 'scr-scan'));
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
  localStorage.setItem('studentos.skipLogin', '1');
  go(liveTasks().length ? 'scr-home' : 'scr-scan');
}

async function logout() {
  if (sb) await sb.auth.signOut();
  currentUser = null; lastSync = null;
  localStorage.removeItem('studentos.skipLogin');
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
  return `<div class="rank-card" onclick="openForm('${t.id}')">
    <span class="rank ${tone}">${n}</span>
    <div class="rc-body">
      <span class="tag ${tone}">${esc(priorityLabel(info.stars))}</span>
      <div class="rc-title">${taskTitle(t)}</div>
      <div class="rc-meta">${bits.join('<i class="msep"></i>')}</div>
    </div>
    <button class="rc-check" onclick="event.stopPropagation();toggleDone('${t.id}',this)"
      aria-label="ทำเสร็จ">${icon('check')}</button>
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

  if (!pending.length) {
    // เคลียร์หมด — เป็นช่วงเวลาที่ควรให้กำลังใจ ไม่ใช่จอว่างเปล่า
    const cleared = doneCount > 0;
    body.innerHTML = head + `<section class="empty-wrap">
      <div class="empty-ring">${icon('check-circle')}</div>
      <h3 class="empty-h">${cleared ? 'เคลียร์หมดแล้ว' : 'ยังไม่มีงานในระบบ'}</h3>
      <p class="empty-p">${cleared
        ? 'ไม่มีงานค้างสักงาน — วันนี้พักได้เต็มที่'
        : 'กดปุ่มกลางแถบล่างเพื่อเพิ่มงานแรก'}</p>
      <button class="empty-cta" onclick="go('scr-scan')">${icon('sparkles')}เพิ่มงานใหม่</button>
    </section>`;
    return;
  }

  const rest = pending.length - 3;
  body.innerHTML = head + briefCard(pending, now)
    + `<div class="sec-label">ลำดับที่ AI แนะนำ</div>`
    + pending.slice(0, 3).map((t, i) => rankCard(t, i + 1, now)).join('')
    + (rest > 0 ? `<button class="ghost-wide" onclick="go('scr-tasks')">
        ดูงานที่เหลืออีก ${rest} งาน${icon('chevron')}</button>` : '');
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
        : `<span class="tag ${tone}">${esc(priorityLabel(info.stars))}</span>
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
function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el) return;
  const now = new Date();
  const pending = pendingTasks();

  const groups = new Map(); // key -> { label, hot, order, list }
  const put = (key, label, hot, order, t) => {
    if (!groups.has(key)) groups.set(key, { label, hot, order, list: [] });
    groups.get(key).list.push(t);
  };
  for (const t of pending) {
    if (!t.due) { put('none', 'ยังไม่ระบุวัน', false, 9e5, t); continue; }
    const d = new Date(t.due);
    if (d < now) { put('over', 'เลยกำหนด', true, -1, t); continue; }
    const diff = Math.round((atTime(d, 0, 0) - atTime(now, 0, 0)) / 8.64e7);
    if (diff > 7) { put('far', 'ถัดจากนั้น', false, 8e4, t); continue; }
    const label = diff === 0 ? 'วันนี้' : diff === 1 ? 'พรุ่งนี้'
      : 'วัน' + THAI_DAY[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()];
    put('d' + diff, label, diff <= 1, diff, t);
  }

  let html = `<div class="page-head">
      <div class="eyebrow">ภาพรวม</div>
      <h1 class="page-title">เส้นเวลา</h1>
    </div>
    <div class="legend">
      <span><i style="background:var(--pri-red)"></i>ด่วนมาก</span>
      <span><i style="background:var(--pri-yellow)"></i>สำคัญ–ปานกลาง</span>
      <span><i style="background:var(--pri-green)"></i>รอได้</span>
    </div>`;

  const sorted = [...groups.values()].sort((a, b) => a.order - b.order);
  for (const g of sorted) {
    g.list.sort((a, b) => new Date(a.due || 8.64e15) - new Date(b.due || 8.64e15));
    html += `<div class="day-label ${g.hot ? 'hot' : ''}">
      <span>${esc(g.label)}</span><span class="ln"></span><span class="ct">${g.list.length}</span></div>`;
    for (const t of g.list) {
      const info = priorityInfo(t, now);
      const tone = priorityTone(info.stars);
      const hot = info.urgency === 'over' || info.urgency === 'hot';
      html += `<div class="tlrow">
        <div class="tltime ${hot ? 'hot' : ''}">${esc(dueClock(t))}</div>
        <div class="tlrail ${tone}"></div>
        <div class="tlcard" onclick="openForm('${t.id}')">
          <span class="tag ${tone}">${esc(priorityLabel(info.stars))}</span>
          <div class="tltitle">${taskTitle(t)}</div>
          <div class="tlsub">${esc(fmtDue(t.due, now, t))}</div>
        </div>
      </div>`;
    }
  }

  if (!sorted.length) html += `<div class="card empty">ไม่มีงานในเส้นเวลา 🎉</div>`;

  const insight = timelineInsight(pending, now);
  if (insight) html += `<div class="tl-note">
    <span class="tile">${icon('sparkles')}</span>
    <div style="flex:1;min-width:0">
      <div class="lb">วันงานชน</div>
      <div class="tx">${esc(insight)}</div>
    </div>
  </div>`;
  el.innerHTML = html;
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
  const ver = document.getElementById('appVer');
  if (ver) ver.textContent = 'StudentOS AI · ' + APP_VERSION;
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
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }
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

function reminderCopy(t, now) {
  const h = t.due ? (new Date(t.due) - now) / 3.6e6 : null;
  const s = t.subject;
  const hr = h != null ? Math.max(1, Math.round(h)) : 0;
  if (h != null && h < 0) return { title: 'อุ๊ย เลยกำหนดแล้ว! 😬', body: pick([
    `${s} เลยเวลาส่งไปแล้วน้า… แต่ยังไม่สายเกินไป รีบเคลียร์เลย!`,
    `${s} ยังค้างอยู่นะ ครูกำลังมองอยู่ 👀 ส่งตอนนี้ยังพอทัน!`,
    `เฮ้! ${s} หนีไม่พ้นหรอกน้า ทำให้จบวันนี้เถอะ 🙏`,
  ]) };
  if (h != null && h <= 3) return { title: '⏰ เหลือเวลาไม่มากแล้ว!', body: pick([
    `${s} เหลือแค่ ${hr} ชม.! ลุยเลยตอนนี้ เดี๋ยวไม่ทันน้า`,
    `นับถอยหลัง ${hr} ชม. สำหรับ ${s} — สู้ ๆ คุณทำได้! 💪`,
    `${s} กำลังจะหมดเวลาแล้ว รีบอีกนิดเดียว ใกล้เสร็จแล้ว!`,
  ]) };
  if (h != null && h <= 12) return { title: 'อย่าเพิ่งลืมนะ 📚', body: pick([
    `${s} รออยู่ เหลือ ${hr} ชม. ทำตอนนี้สบายกว่าตอนดึกเยอะ 😉`,
    `แอบเตือนเรื่อง ${s} หน่อย~ เริ่มเลยดีกว่า จะได้พักแบบไม่มีห่วง`,
    `${s} ยังรอคุณอยู่นะ เริ่มจากนิดเดียวก็ได้ เดี๋ยวก็เสร็จ!`,
  ]) };
  return { title: 'มีงานรออยู่นะ ✨', body: `${s} — ${t.detail} (${fmtDue(t.due, now, t)})` };
}

function celebrateCopy(allDone) {
  return allDone
    ? { title: 'เคลียร์หมดแล้ว! 🎉', body: pick([
        'เก่งมาก! งานหมดเกลี้ยง วันนี้พักได้เต็มที่เลย',
        'สุดยอด! ไม่เหลืองานค้างสักงาน ภูมิใจในตัวเองได้เลย 💙',
      ]) }
    : { title: 'เยี่ยม! เสร็จอีกงาน 💪', body: pick([
        'ทำได้ดีมาก ไปต่องานถัดไปกันเลย!',
        'อีกนิดเดียว ใกล้เคลียร์หมดแล้ว สู้ ๆ!',
        'เก่งจัง! ทุกงานที่เสร็จคือก้าวเล็ก ๆ สู่เป้าหมาย ✨',
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
    el.innerHTML = `<img class="tav" src="logo-mark.png" alt=""><div class="tc"><div class="tt"></div><div class="tb"></div></div>`;
    el.onclick = () => el.classList.remove('show');
    phone.appendChild(el);
  }
  el.querySelector('.tt').textContent = copy.title;
  el.querySelector('.tb').textContent = copy.body;
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
  if (dontShowAgain) localStorage.setItem('studentos.installGuideDismissed', '1');
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

// ---------- init ----------
function tickClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

for (const id of ['cameraInput', 'galleryInput']) {
  document.getElementById(id).addEventListener('change', e => {
    if (e.target.files[0]) scanFromPhoto(e.target.files[0]);
    e.target.value = '';
  });
}

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
  applyTheme();
  fillSubjectSelect();
  tickClock();
  setInterval(tickClock, 30_000);
  setInterval(checkReminders, 5 * 60_000);
  checkReminders();

  await initCloud();
  await refreshPushState();
  // เคยกดอนุญาตไว้แล้ว + ล็อกอินอยู่ → ต่อ push ให้อัตโนมัติ (เผื่อ subscription หลุด)
  if ('Notification' in window && Notification.permission === 'granted' && currentUser) {
    subscribePush().then(() => renderProfile()).catch(() => {});
  }

  if (cloudConfigured() && !currentUser && !localStorage.getItem('studentos.skipLogin')) {
    go('scr-login'); // มีระบบบัญชี + ยังไม่เคยเลือก → ให้เลือกก่อน
  } else {
    go(liveTasks().length ? 'scr-home' : 'scr-scan'); // ครั้งแรก: เริ่มที่ Scan (จุดขายของเรา)
  }

  // ปิดฉากเปิดแอป: โชว์อย่างน้อย 2.3 วิ (ถ้าโหลดเร็ว) แล้วเฟดออก
  const splash = document.getElementById('splash');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minShow = reduced ? 600 : 2300;
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.classList.add('gone'), 600);
    // หลัง splash หาย ค่อยเด้ง toast เตือนงานด่วน (ถ้าอยู่หน้าแอป ไม่ใช่หน้า login)
    if (!document.getElementById('scr-login').classList.contains('on')) openNudge();
    // iPhone + Safari (ยังไม่ติดตั้ง) → เด้งแนะนำวิธีติดตั้งอัตโนมัติครั้งเดียว กันลืม/กันงง
    if (isIOS() && !isStandalone() && !localStorage.getItem('studentos.installGuideDismissed')) {
      setTimeout(showInstallGuide, 1400);
    }
  }, Math.max(300, minShow - (performance.now() - APP_T0)));
})();
