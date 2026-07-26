// ============================================================
// StudentOS AI — App (UI + state)
// ข้อมูลจริง เก็บใน localStorage · ทุกจอ render จาก state
// ============================================================

const APP_VERSION = 'v28';
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

function pendingTasks() { return state.tasks.filter(t => !t.done); }

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
      syncFromCloud().then(() => go(state.tasks.length ? 'scr-home' : 'scr-scan'));
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
  go(state.tasks.length ? 'scr-home' : 'scr-scan');
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
function starsHtml(n) {
  return '<span class="stars lv' + n + '">' + '★'.repeat(n) + '<span class="off">' + '★'.repeat(5 - n) + '</span></span>';
}
// ป้ายระดับความสำคัญแบบกะทัดรัด (ใช้แทนดาวในการ์ด)
function priorityBadge(stars) {
  return `<span class="pbadge lv${stars}">${esc(priorityLabel(stars))}</span>`;
}
// เมตาดาต้าสั้น ไม่เกิน 2 อัน — กรองเอาแต่ที่สำคัญ ไม่เอาที่ซ้ำกับ badge/deadline
function metaHtml(reasons) {
  const drop = /ใกล้กำหนด|ส่งภายใน|ยังพอมีเวลา|ส่งใน|กำหนดความสำคัญเอง|ยังไม่ระบุ/;
  const keep = reasons.filter(r => !drop.test(r)).slice(0, 2);
  if (!keep.length) return '';
  return '<div class="meta">' + keep.map(r => '<span class="mchip">' + esc(r) + '</span>').join('') + '</div>';
}
// หัวเรื่องการ์ด: ไม่โชว์ "อื่น ๆ ·" ซ้ำซ้อนเวลาไม่ได้ระบุวิชา
function taskTitle(t) {
  const subj = t.subject && t.subject !== 'อื่น ๆ' ? esc(t.subject) + ' · ' : '';
  return subj + esc(t.detail);
}
function typeChip(t) {
  const type = taskType(t);
  if (type === 'homework') return ''; // การบ้านคือค่าปกติ ไม่ต้องติดป้ายให้รก
  const ti = TASK_TYPES[type];
  return `<span class="tchip ${type}">${ti.icon} ${esc(ti.name)}</span>`;
}
function progressHtml(p) {
  p = Math.max(0, Math.min(100, p || 0));
  if (p <= 0) return '';
  return `<div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div><span class="progress-pct">${p}%</span></div>`;
}

// ไอคอน Lucide — เรียกใช้ซ้ำได้จาก <defs> ใน index.html
function icon(name, cls) {
  return `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#lu-${name}"/></svg>`;
}
// ไอคอนประจำประเภทงาน
const TYPE_ICON = { homework: 'pencil', exam: 'book', activity: 'calendar', reminder: 'clock' };

// การ์ดงานหลัก — ตัวเดียวที่เด่นในหน้าแรก พร้อมเหตุผลจาก AI
function heroCard(t, pending, now) {
  const info = priorityInfo(t, now);
  const urgent = info.urgency === 'over' || info.urgency === 'hot';
  const type = taskType(t);
  const ti = TASK_TYPES[type];
  const lv = info.stars >= 5 ? 'lv5' : info.stars >= 4 ? 'lv4' : '';
  const subject = t.subject && t.subject !== 'อื่น ๆ' ? `<div class="hero-subject">${esc(t.subject)}</div>` : '';
  const prog = Math.max(0, Math.min(100, t.progress || 0));
  return `
  <section>
    <div class="eyebrow">${icon('sparkles')}<span>AI แนะนำให้ทำก่อน</span></div>
    <div class="hero ${urgent ? 'urgent' : ''}" onclick="openForm('${t.id}')">
      <div class="hero-strip"></div>
      <div class="hero-in">
        <div class="hero-badges">
          <span class="hbadge ${lv}">${urgent ? icon('flame') : ''}${esc(priorityLabel(info.stars))}</span>
          <span class="hbadge">${icon(TYPE_ICON[type] || 'pencil')}${esc(ti.name)}</span>
        </div>
        <div>
          ${subject}
          <h3 class="hero-title">${esc(t.detail)}</h3>
        </div>
        <div class="hero-meta">
          <span class="due ${urgent ? 'hot' : ''}">${icon('clock')}${fmtDue(t.due, now, t)}</span>
          ${ti.schedulable ? `<span>~${t.estMin} นาที</span>` : ''}
          ${t.scorePct != null ? `<span>คะแนนเก็บ ${t.scorePct}%</span>` : ''}
        </div>
        ${prog > 0 ? `<div class="hero-prog">
          <div class="track"><div class="fill" style="width:${prog}%"></div></div>
          <span class="pct">${prog}%</span></div>` : ''}
        <div class="hero-why">${icon('sparkles')}<span>${esc(aiHeroWhy(t, pending, state.settings, now))}</span></div>
        <div class="hero-acts">
          <button class="edit" onclick="event.stopPropagation();openForm('${t.id}')">${icon('pencil')}แก้ไข</button>
          <button class="done" onclick="event.stopPropagation();toggleDone('${t.id}')">${icon('check')}ทำเสร็จแล้ว</button>
        </div>
      </div>
    </div>
  </section>`;
}

// งานถัดไป — ย่อเหลือแถวเดียว อ่านผ่านตาเร็ว ไม่แย่งความสนใจจากงานหลัก
function nextRow(t, now) {
  const info = priorityInfo(t, now);
  const hot = info.urgency === 'over' || info.urgency === 'hot';
  const lv = info.stars >= 5 ? 'lv5' : info.stars >= 4 ? 'lv4' : '';
  return `
  <div class="nrow" onclick="openForm('${t.id}')">
    <div class="nbody">
      <div class="ntitle">${taskTitle(t)}</div>
      <div class="nmeta">
        <span class="nbadge ${lv}">${esc(priorityLabel(info.stars))}</span>
        <span class="ndue ${hot ? 'hot' : ''}">${fmtDue(t.due, now, t)}</span>
      </div>
    </div>
    <button class="ncheck" onclick="event.stopPropagation();toggleDone('${t.id}')" aria-label="ทำเสร็จ">
      <span>${icon('check')}</span>
    </button>
  </div>`;
}

function taskCard(t, rank, now) {
  const info = priorityInfo(t, now);
  const hot = info.urgency === 'over' || info.urgency === 'hot';
  const pin = t.userStars ? '<span class="pin" title="กำหนดความสำคัญเอง">📌</span>' : '';
  return `
  <div class="tcard" data-id="${t.id}" onclick="openForm('${t.id}')">
    <span class="rank ${rank === 1 ? 'r1' : ''}">${rank}</span>
    <div class="tbody">
      <div class="trow1">${priorityBadge(info.stars)}${typeChip(t)}${pin}<span class="tdue ${hot ? 'hot' : ''}">${fmtDue(t.due, now, t)}</span></div>
      <h4 class="ttitle">${taskTitle(t)}</h4>
      ${progressHtml(t.progress)}
      ${metaHtml(info.reasons)}
    </div>
    <button class="tcheck" onclick="event.stopPropagation();toggleDone('${t.id}')" aria-label="ทำเสร็จ" title="ทำเสร็จ"></button>
  </div>`;
}


// แถวสถิติ "ส่งตรงเวลากี่วันติด" — ให้เห็นความต่อเนื่อง ไม่ใช่แค่ตัวเลขรวม
function streakSection() {
  const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const now = new Date();
  const doneDays = new Set(state.tasks.filter(t => t.done && t.due)
    .map(t => new Date(t.due).getDay()));
  if (!doneDays.size) return '';
  const cells = days.map((d, i) => `<span class="${doneDays.has(i) ? 'on' : ''}">${d}</span>`).join('');
  return `<section><div class="streak">
    <div class="streak-days">${cells}</div>
    <div class="streak-txt">ส่งตรงเวลา <b>${doneDays.size} วัน</b> ในสัปดาห์นี้</div>
  </div></section>`;
}

function renderHome() {
  const now = new Date();
  const pending = sortByPriority(pendingTasks(), now);
  const doneToday = state.tasks.filter(t => t.done).length;

  const h = now.getHours();
  const greet = h < 11 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนค่ำ';
  const name = state.settings.name || 'นักเรียน';
  document.getElementById('greeting').textContent = `${greet}, ${name}`;
  document.getElementById('hhDate').textContent = fmtThaiDate(now);
  const hhNum = document.getElementById('hhNum');
  hhNum.textContent = pending.length;
  hhNum.classList.toggle('hot', pending.some(t => {
    const u = priorityInfo(t, now).urgency; return u === 'over' || u === 'hot';
  }));

  const body = document.getElementById('homeBody');
  if (!pending.length) {
    // เคลียร์หมด — เป็นช่วงเวลาที่ควรให้กำลังใจ ไม่ใช่จอว่างเปล่า
    const cleared = doneToday > 0;
    body.innerHTML = `<section class="empty-wrap">
      <div class="empty-ring">${icon('check-circle')}</div>
      <h3 class="empty-h">${cleared ? 'เคลียร์หมดแล้ว' : 'ยังไม่มีงานในระบบ'}</h3>
      <p class="empty-p">${cleared
        ? 'ไม่มีงานค้างสักงาน — วันนี้พักได้เต็มที่<br>ครูสั่งอะไรมาใหม่ กดปุ่มกลางแถบล่างแล้วให้ AI แกะให้'
        : 'กดปุ่มกลางแถบล่างเพื่อเพิ่มงานแรก<br>พูด ถ่ายรูป หรือแปะข้อความจาก LINE ก็ได้'}</p>
      ${cleared ? `<div class="empty-note">${icon('sparkles')}<span>ทำเสร็จไปแล้ว ${doneToday} งาน — รักษาจังหวะนี้ไว้ คะแนนเก็บจะเต็มทั้งเทอม</span></div>` : ''}
      <button class="empty-cta" onclick="go('scr-scan')">${icon('sparkles')}เพิ่มงานแรกของวัน</button>
    </section>` + streakSection();
    return;
  }

  // ลำดับสายตา: งานหลัก 1 ชิ้นเด่นชัด → งานถัดไปย่อเป็นแถว → ทางเข้าแผนวันนี้
  const rest = pending.slice(1, 3);
  const plan = buildDayPlan(pending, state.settings, now);
  const firstSlot = plan.slots.find(s => !s.break);
  const teaser = firstSlot
    ? `เริ่ม ${fmtClock(firstSlot.start)} · ${plan.slots.filter(s => !s.break).length} ช่วง จัดตามความสำคัญ`
    : 'จัดเวลาให้อัตโนมัติตามความสำคัญ';

  body.innerHTML = heroCard(pending[0], pending, now)
    + (rest.length ? `<section>
        <div class="row-head">
          <span class="lbl">ถัดไป</span>
          ${pending.length > 3 ? `<button class="more" onclick="go('scr-tasks')">ทั้งหมด ${pending.length}${icon('chevron')}</button>` : ''}
        </div>
        ${rest.map(t => nextRow(t, now)).join('')}
      </section>` : '')
    + `<button class="plan-card" onclick="go('scr-plan')">
        <span class="tile">${icon('calendar')}</span>
        <span class="pc-body">
          <span class="pc-title">ให้ AI วางแผนเวลาวันนี้</span>
          <span class="pc-sub">${esc(teaser)}</span>
        </span>
        ${icon('chevron')}
      </button>`;
}

function taskRow(t, now) {
  const info = priorityInfo(t, now);
  const hot = info.urgency === 'over' || info.urgency === 'hot';
  return `
  <div class="task-row ${t.done ? 'done' : ''}">
    <button class="tcheck ${t.done ? 'on' : ''}" onclick="toggleDone('${t.id}')" aria-label="${t.done ? 'ทำเสร็จแล้ว' : 'ทำเสร็จ'}"></button>
    <div class="task-main" onclick="openForm('${t.id}')">
      <div class="task-title">${taskTitle(t)}</div>
      <div class="trow1 sm">${t.done ? '<span class="tdue ok">เสร็จแล้ว</span>' : priorityBadge(info.stars) + typeChip(t) + '<span class="tdue ' + (hot ? 'hot' : '') + '">' + fmtDue(t.due, now, t) + '</span>'}</div>
      ${!t.done ? progressHtml(t.progress) : ''}
    </div>
    <button class="icon-btn" onclick="removeTask('${t.id}')" aria-label="ลบ">✕</button>
  </div>`;
}

let taskFilter = 'all';
function setFilter(f) {
  taskFilter = f;
  document.querySelectorAll('#filterRow .fchip').forEach(b => b.classList.toggle('active', b.dataset.f === f));
  renderTasks();
}

// ---------- งานทั้งหมด (โครง Refined: เช็คซ้าย · ลบขวา · หัวหมวดมีไอคอน) ----------
function renderTasks() {
  const now = new Date();
  const match = t => taskFilter === 'all' || taskType(t) === taskFilter;
  const pending = sortByPriority(pendingTasks().filter(match), now);
  const done = state.tasks.filter(t => t.done && match(t));
  const label = taskFilter === 'all' ? '' : ' · ' + TASK_TYPES[taskFilter].name;
  document.getElementById('tasksSub').textContent =
    `${pending.length} งานค้าง${label} · เรียงโดย AI — แตะเพื่อแก้ไข`;

  const hot = pending.filter(t => ['over', 'hot'].includes(priorityInfo(t, now).urgency));
  const rest = pending.filter(t => !hot.includes(t));
  const sec = (label, rows, isHot) => rows.length ? `
    <div class="tsec">
      <div class="tsec-head ${isHot ? 'hot' : ''}">${isHot ? icon('flame') : ''}<span>${esc(label)}</span></div>
      ${rows.map(t => taskRow(t, now)).join('')}
    </div>` : '';

  let html = sec('ด่วน', hot, true) + sec('ต่อจากนั้น', rest, false) + sec(`เสร็จแล้ว · ${done.length}`, done, false);
  if (!html) html = `<div class="card empty">${taskFilter === 'all'
    ? 'ยังไม่มีงาน — กดปุ่ม <b>เพิ่ม</b> ด้านล่างเพื่อเริ่ม'
    : `ไม่มีรายการประเภท “${esc(TASK_TYPES[taskFilter].name)}”`}</div>`;
  document.getElementById('taskList').innerHTML = html;
}

function taskRow(t, now) {
  const info = priorityInfo(t, now);
  const hot = info.urgency === 'over' || info.urgency === 'hot';
  const lv = info.stars >= 5 ? 'lv5' : info.stars >= 4 ? 'lv4' : '';
  return `
  <div class="trow ${t.done ? 'done' : ''}">
    <button class="tcheck2" onclick="toggleDone('${t.id}')" aria-label="${t.done ? 'ทำเสร็จแล้ว' : 'ทำเสร็จ'}">
      <span>${icon('check')}</span>
    </button>
    <div class="tmain" onclick="openForm('${t.id}')">
      <div class="tt">${taskTitle(t)}</div>
      <div class="tm">
        ${t.done ? '<span class="nbadge">เสร็จแล้ว</span>'
          : `<span class="nbadge ${lv}">${esc(priorityLabel(info.stars))}</span>
             <span class="ndue ${hot ? 'hot' : ''}">${fmtDue(t.due, now, t)}</span>`}
      </div>
    </div>
    <button class="tdel" onclick="removeTask('${t.id}')" aria-label="ลบ">${icon('trash')}</button>
  </div>`;
}

// ---------- เส้นเวลา (โครง Refined: หัวหมวดมีจุดสี + เส้นคั่น + จำนวน) ----------
function renderTimeline() {
  const now = new Date();
  const pending = sortByPriority(pendingTasks(), now);
  const buckets = [
    { name: 'เลยกำหนด', hot: true,  test: h => h != null && h < 0 },
    { name: 'วันนี้',    hot: true,  test: h => h != null && h >= 0 && h <= (24 - now.getHours()) },
    { name: 'พรุ่งนี้',  hot: false, test: h => h != null && h > (24 - now.getHours()) && h <= (48 - now.getHours()) },
    { name: 'สัปดาห์นี้', hot: false, test: h => h != null && h > (48 - now.getHours()) && h <= 24 * 7 },
    { name: 'ถัดจากนั้น', hot: false, test: h => h == null || h > 24 * 7 },
  ];
  let html = '';
  for (const b of buckets) {
    const list = pending.filter(t => b.test(priorityInfo(t, now).hoursLeft));
    if (!list.length) continue;
    const top = priorityInfo(list[0], now).stars;
    const dot = top >= 5 ? 'lv5' : top >= 4 ? 'lv4' : '';
    html += `<div class="tlg">
      <div class="tlg-head">
        <span class="dot ${dot}"></span>
        <span class="nm ${b.hot ? 'hot' : ''}">${esc(b.name)}</span>
        <span class="ln"></span>
        <span class="ct">${list.length}</span>
      </div>
      ${list.map(t => {
        const info = priorityInfo(t, now);
        const lv = info.stars >= 5 ? 'lv5' : info.stars >= 4 ? 'lv4' : info.stars >= 3 ? 'lv3' : '';
        const isHot = info.urgency === 'over' || info.urgency === 'hot';
        return `<div class="tli" onclick="openForm('${t.id}')">
          <div class="bar ${lv}"></div>
          <div class="cd">
            <div class="tm">
              <span class="nbadge ${lv === 'lv3' ? '' : lv}">${esc(priorityLabel(info.stars))}</span>
              <span class="ndue ${isHot ? 'hot' : ''}">${fmtDue(t.due, now, t)}</span>
            </div>
            <div class="tt">${taskTitle(t)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  const insight = timelineInsight(pending, now);
  if (insight) html += `<div class="tl-note">
    <span class="tile">${icon('sparkles')}</span>
    <div style="flex:1;min-width:0">
      <div class="lb">วันงานชน</div>
      <div class="tx">${esc(insight)}</div>
    </div>
  </div>`;
  if (!html) html = `<div class="card empty">ไม่มีงานในเส้นเวลา 🎉</div>`;
  document.getElementById('timeline').innerHTML = html;
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
  html += `<p class="plan-foot">แผนคำนวณใหม่ทุกครั้งจากงานล่าสุด · ตั้งเวลาว่างต่อวันได้ที่แท็บ “ฉัน”</p>`;
  list.innerHTML = html;
}

function renderProfile() {
  const now = new Date();
  const pending = pendingTasks();
  const done = state.tasks.filter(t => t.done).length;
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
function toggleDone(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t) {
    const wasDone = t.done;
    t.done = !t.done;
    t.progress = t.done ? 100 : (t.progress === 100 ? 0 : t.progress);
    save(); renderAll();
    if (!wasDone && t.done) showToast(celebrateCopy(pendingTasks().length === 0)); // ฉลองตอนทำเสร็จ
  }
}
function removeTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t && confirm(`ลบ "${t.subject} — ${t.detail}" ?`)) {
    state.tasks = state.tasks.filter(x => x.id !== id);
    save(); renderAll();
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

function openForm(id, parsed) {
  editingId = id;
  fillSubjectSelect();
  const f = {
    subject: document.getElementById('fSubject'), detail: document.getElementById('fDetail'),
    date: document.getElementById('fDate'), time: document.getElementById('fTime'),
    score: document.getElementById('fScore'), est: document.getElementById('fEst'),
    teacher: document.getElementById('fTeacher'),
  };
  const chips = document.getElementById('detectedChips');
  const title = document.getElementById('formTitle');
  const sub = document.getElementById('formSub');

  let t = null;
  if (id) t = state.tasks.find(x => x.id === id);

  const okBadge = document.getElementById('fmOk');
  if (parsed) {
    title.textContent = 'ตรวจก่อนบันทึก';
    sub.textContent = 'แก้ช่องที่ AI อ่านผิดได้ทุกช่อง — ระบบจะจำรูปแบบที่คุณแก้ไว้';
    const d = parsed.detected;
    const fields = [[d.type,'ประเภท'],[d.subject,'วิชา'],[d.teacher,'ครูผู้สั่ง'],[d.due,'กำหนดส่ง'],[d.score,'คะแนน'],[d.est,'เวลาที่ใช้']];
    const got = fields.filter(f => f[0]);
    chips.innerHTML = got.map(f => `<span class="chip new">${icon('check')}${esc(f[1])}</span>`).join('')
      + fields.filter(f => !f[0]).map(f => `<span class="chip">${esc(f[1])} — เติมเอง</span>`).join('');
    if (okBadge) {
      okBadge.className = 'fm-ok show';
      okBadge.innerHTML = `${icon('check-circle')}AI อ่านได้ ${got.length} จาก ${fields.length} ช่อง`;
    }
    t = parsed;
  } else if (t) {
    title.textContent = 'แก้ไขงาน';
    sub.textContent = 'ปรับรายละเอียดได้ทุกช่อง';
    chips.innerHTML = '';
    if (okBadge) okBadge.className = 'fm-ok';
  } else {
    title.textContent = 'เพิ่มงานใหม่';
    sub.textContent = 'กรอกเอง — หรือกลับไปให้ AI ช่วยอ่าน';
    chips.innerHTML = '';
    if (okBadge) okBadge.className = 'fm-ok';
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

  if (editingId) {
    Object.assign(state.tasks.find(x => x.id === editingId), data);
  } else {
    state.tasks.push(Object.assign({ id: uid(), done: false, createdAt: new Date().toISOString(), fromScan: !!data._scan }, data));
  }
  editingId = null;
  save();
  go('scr-home');
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
  const sub = document.getElementById('parseSub');
  if (sub) sub.textContent = source === 'voice'
    ? 'แกะสิ่งที่คุณพูดเป็นวิชา กำหนดส่ง คะแนน และเวลาที่ต้องใช้'
    : 'แกะวิชา ครู กำหนดส่ง คะแนน และเวลาที่ต้องใช้จากข้อความที่แปะมา';
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
    const text = (data.text || '').trim();
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
    go(state.tasks.length ? 'scr-home' : 'scr-scan'); // ครั้งแรก: เริ่มที่ Scan (จุดขายของเรา)
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
