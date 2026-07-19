// ============================================================
// StudentOS AI — App (UI + state)
// ข้อมูลจริง เก็บใน localStorage · ทุกจอ render จาก state
// ============================================================

const STORE_KEY = 'studentos.v1';

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
function chipsHtml(reasons) {
  return '<div class="chips">' + reasons.slice(0, 4).map(r => '<span class="chip">' + esc(r) + '</span>').join('') + '</div>';
}

function taskCard(t, rank, now) {
  const info = priorityInfo(t, now);
  return `
  <div class="card" data-id="${t.id}">
    <div class="thead">
      <span class="rank ${rank === 1 ? 'r1' : ''}">${rank}</span>
      <div>
        <h4>${esc(t.subject)} — ${esc(t.detail)}</h4>
        <div class="due ${info.urgency === 'over' || info.urgency === 'hot' ? '' : 'ok'}">${fmtDue(t.due, now)}</div>
        ${starsHtml(info.stars)}
        ${chipsHtml(info.reasons)}
      </div>
    </div>
    ${rank === 1 ? `<button class="btn primary sm" onclick="toggleDone('${t.id}')">✓ ทำเสร็จแล้ว</button>` : ''}
  </div>`;
}

function renderHome() {
  const now = new Date();
  const pending = sortByPriority(pendingTasks(), now);
  const doneToday = state.tasks.filter(t => t.done).length;

  const h = now.getHours();
  const eng = h < 11 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const name = state.settings.name || 'นักเรียน';
  document.getElementById('greeting').textContent = `${eng}, ${name} 👋`;
  document.getElementById('homeSub').textContent =
    `${fmtThaiDate(now)} · 📚 งานค้าง ${pending.length} งาน · เสร็จแล้ว ${doneToday}`;
  document.getElementById('aiMsg').textContent = aiGreeting(pending, state.settings, now);

  const box = document.getElementById('top3');
  if (!pending.length) {
    box.innerHTML = `<div class="card empty">ยังไม่มีงานในระบบ<br>
      กดปุ่ม 📷 <b>Scan</b> ด้านล่างเพื่อเพิ่มงานแรก<br>
      <span class="hint">หรือโหลดข้อมูลตัวอย่างได้ที่แท็บ "ฉัน"</span></div>`;
    return;
  }
  box.innerHTML = pending.slice(0, 3).map((t, i) => taskCard(t, i + 1, now)).join('')
    + (pending.length > 3
      ? `<button class="btn ghost sm" onclick="go('scr-tasks')">ดูงานทั้งหมด (${pending.length})</button>` : '');
}

function taskRow(t, now) {
  const info = priorityInfo(t, now);
  return `
  <div class="task-row ${t.done ? 'done' : ''}">
    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleDone('${t.id}')">
    <div class="task-main" onclick="openForm('${t.id}')">
      <div class="task-title">${esc(t.subject)} — ${esc(t.detail)}</div>
      <div class="due ${t.done ? 'ok' : (info.urgency === 'over' || info.urgency === 'hot' ? '' : 'ok')}">${t.done ? 'เสร็จแล้ว ✓' : fmtDue(t.due, now)}</div>
    </div>
    <button class="icon-btn" onclick="removeTask('${t.id}')" title="ลบ">🗑</button>
  </div>`;
}

function renderTasks() {
  const now = new Date();
  const pending = sortByPriority(pendingTasks(), now);
  const done = state.tasks.filter(t => t.done);
  document.getElementById('tasksSub').textContent =
    `${pending.length} งานค้าง · เรียงโดย AI — แตะงานเพื่อแก้ไข`;

  const hot = pending.filter(t => ['over', 'hot'].includes(priorityInfo(t, now).urgency));
  const rest = pending.filter(t => !hot.includes(t));

  let html = '';
  if (hot.length) html += `<div class="assign-sect">🔥 HIGH PRIORITY</div>` + hot.map(t => taskRow(t, now)).join('');
  if (rest.length) html += `<div class="assign-sect norm">ต่อจากนั้น</div>` + rest.map(t => taskRow(t, now)).join('');
  if (done.length) html += `<div class="assign-sect norm">เสร็จแล้ว (${done.length})</div>` + done.map(t => taskRow(t, now)).join('');
  if (!html) html = `<div class="card empty">ยังไม่มีงาน — กด 📷 Scan เพื่อเพิ่ม</div>`;
  document.getElementById('taskList').innerHTML = html;
}

function renderTimeline() {
  const now = new Date();
  const pending = sortByPriority(pendingTasks(), now);
  const buckets = [
    { name: '⚠ เลยกำหนด', bar: 'hot',  test: h => h != null && h < 0 },
    { name: 'Today',      bar: 'hot',  test: h => h != null && h >= 0 && h <= (24 - now.getHours()) },
    { name: 'Tomorrow',   bar: 'mid',  test: h => h != null && h > (24 - now.getHours()) && h <= (48 - now.getHours()) },
    { name: 'This Week',  bar: '',     test: h => h != null && h > (48 - now.getHours()) && h <= 24 * 7 },
    { name: 'Later',      bar: '',     test: h => h == null || h > 24 * 7 },
  ];
  let html = '';
  for (const b of buckets) {
    const list = pending.filter(t => b.test(priorityInfo(t, now).hoursLeft));
    if (!list.length) continue;
    html += `<div class="tl-group"><div class="tl-head">${b.name}</div>` + list.map(t => {
      const info = priorityInfo(t, now);
      return `
      <div class="tl-item"><span class="tl-bar lv${info.stars}"></span>
        <div class="card"><h4 style="font-size:15px">${esc(t.subject)} — ${esc(t.detail)}</h4>
        <div class="due ${b.bar === 'hot' ? '' : 'ok'}">${fmtDue(t.due, now)} · ${starsHtml(info.stars)}</div></div>
      </div>`;
    }).join('') + `</div>`;
  }
  const insight = timelineInsight(pending, now);
  if (insight) html += `
    <div class="card ai" style="margin-top:4px">
      <div class="ai-head"><span class="ai-dot">S</span><span class="ai-name">STUDENTOS AI</span></div>
      <div class="ai-msg" style="font-size:13.5px">${esc(insight)}</div>
    </div>`;
  if (!html) html = `<div class="card empty">ไม่มีงานในเส้นเวลา 🎉</div>`;
  document.getElementById('timeline').innerHTML = html;
}

function renderProfile() {
  const acc = document.getElementById('accountCard');
  if (!cloudConfigured()) {
    acc.innerHTML = `<h4 style="margin-bottom:6px">บัญชี</h4>
      <p class="hint" style="text-align:left; margin:0">โหมดออฟไลน์ — ข้อมูลอยู่ในเครื่องนี้เครื่องเดียว<br>(ระบบล็อกอิน/ซิงก์กำลังตั้งค่า)</p>`;
  } else if (currentUser) {
    acc.innerHTML = `<h4 style="margin-bottom:6px">บัญชี</h4>
      <p style="font-size:14px; margin-bottom:4px">✅ ${esc(currentUser.email || currentUser.id)}</p>
      <p class="hint" style="text-align:left; margin:0 0 10px">ซิงก์ข้ามเครื่องอัตโนมัติ${lastSync ? ' · ล่าสุด ' + lastSync.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
      <button class="btn ghost sm" onclick="logout()">ออกจากระบบ</button>`;
  } else {
    acc.innerHTML = `<h4 style="margin-bottom:6px">บัญชี</h4>
      <p class="hint" style="text-align:left; margin:0 0 10px">ยังไม่ได้ล็อกอิน — ข้อมูลอยู่ในเครื่องนี้เท่านั้น</p>
      <button class="btn google sm" onclick="loginGoogle()"><span class="g-badge">G</span> เข้าสู่ระบบด้วย Google</button>`;
  }
  document.getElementById('pName').value = state.settings.name || '';
  document.getElementById('pFree').value = state.settings.freeHours || 2;
  const st = document.getElementById('notifStatus');
  if (!('Notification' in window)) st.textContent = 'เบราว์เซอร์นี้ไม่รองรับ';
  else st.textContent = Notification.permission === 'granted' ? 'เปิดอยู่ ✓ — เตือนงานที่ใกล้ส่งใน 24 ชม. ขณะเปิดแอป' : 'ยังไม่ได้เปิด';
}

function renderAll() { renderHome(); renderTasks(); renderTimeline(); renderProfile(); }

// ---------- task actions ----------
function toggleDone(id) {
  const t = state.tasks.find(x => x.id === id);
  if (t) { t.done = !t.done; save(); renderAll(); }
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
    teacher: document.getElementById('fTeacher'), exam: document.getElementById('fExam'),
  };
  const chips = document.getElementById('detectedChips');
  const title = document.getElementById('formTitle');
  const sub = document.getElementById('formSub');

  let t = null;
  if (id) t = state.tasks.find(x => x.id === id);

  if (parsed) {
    title.textContent = 'AI ตรวจพบ ✨';
    sub.textContent = 'ตรวจสอบก่อนบันทึก — แก้สิ่งที่ AI อ่านผิดได้เสมอ';
    const d = parsed.detected;
    const found = [d.subject && 'วิชา', d.teacher && 'ครู', d.due && 'Deadline', d.score && 'คะแนน', d.est && 'เวลาที่ใช้'].filter(Boolean);
    chips.innerHTML = found.map(x => `<span class="chip new">✔ ${x}</span>`).join('')
      + (found.length < 3 ? `<span class="chip">บางช่องอ่านไม่เจอ — เติมเองได้เลย</span>` : '');
    t = parsed;
  } else if (t) {
    title.textContent = 'แก้ไขงาน ✎';
    sub.textContent = '';
    chips.innerHTML = '';
  } else {
    title.textContent = 'เพิ่มงานใหม่';
    sub.textContent = 'กรอกเอง — หรือกลับไปใช้ Scan ให้ AI ช่วยอ่าน';
    chips.innerHTML = '';
  }

  setStarPick(t?.userStars || 0);
  f.subject.value = t?.subject || 'อื่น ๆ';
  f.detail.value = t?.detail || '';
  f.teacher.value = t?.teacher || '';
  f.score.value = t?.scorePct ?? '';
  f.est.value = t?.estMin || 30;
  f.exam.checked = !!t?.isExam;

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

  const data = {
    subject: document.getElementById('fSubject').value,
    detail,
    teacher: document.getElementById('fTeacher').value.trim(),
    scorePct: scoreV === '' ? null : Math.min(100, +scoreV),
    estMin: Math.max(5, +document.getElementById('fEst').value || 30),
    isExam: document.getElementById('fExam').checked,
    userStars: formUserStars || null,
    due: due ? due.toISOString() : null,
  };

  if (editingId) {
    Object.assign(state.tasks.find(x => x.id === editingId), data);
  } else {
    state.tasks.push(Object.assign({ id: uid(), done: false, createdAt: new Date().toISOString(), fromScan: !!data._scan }, data));
  }
  editingId = null;
  save();
  go('scr-home');
}

// ---------- scan: ข้อความ ----------
function scanFromText() {
  const text = document.getElementById('pasteText').value.trim();
  if (!text) { alert('แปะข้อความก่อนนะ'); return; }
  const parsed = parseAssignment(text);
  document.getElementById('pasteText').value = '';
  openForm(null, parsed);
}

// ---------- scan: รูป (OCR ด้วย Tesseract.js) ----------
let tesseractReady = null;
function loadTesseract() {
  if (tesseractReady) return tesseractReady;
  tesseractReady = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = res;
    s.onerror = () => { tesseractReady = null; rej(new Error('โหลดไลบรารี OCR ไม่ได้ — เช็คอินเทอร์เน็ต')); };
    document.head.appendChild(s);
  });
  return tesseractReady;
}

async function scanFromPhoto(file) {
  const st = document.getElementById('ocrStatus');
  const barWrap = document.getElementById('ocrBarWrap');
  const bar = document.getElementById('ocrBar');
  try {
    st.textContent = '⏳ กำลังโหลดโมเดล OCR…';
    barWrap.hidden = false; bar.style.width = '5%';
    await loadTesseract();

    const worker = await Tesseract.createWorker('tha+eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          bar.style.width = Math.round(m.progress * 100) + '%';
          st.textContent = '📖 AI กำลังอ่านใบงาน… ' + Math.round(m.progress * 100) + '%';
        }
      },
    });
    const { data } = await worker.recognize(file);
    await worker.terminate();

    st.textContent = ''; barWrap.hidden = true;
    const text = (data.text || '').trim();
    if (text.length < 5) { alert('อ่านตัวหนังสือจากรูปไม่ได้ — ลองถ่ายให้ชัดขึ้น หรือแปะข้อความแทน'); return; }
    openForm(null, parseAssignment(text));
  } catch (e) {
    st.textContent = ''; barWrap.hidden = true;
    alert('OCR ล้มเหลว: ' + e.message + '\nใช้วิธีแปะข้อความแทนได้เลย');
  }
}

// ---------- profile ----------
function saveProfile() {
  state.settings.name = document.getElementById('pName').value.trim();
  state.settings.freeHours = Math.max(0.5, +document.getElementById('pFree').value || 2);
  save(); renderAll();
  alert('บันทึกแล้ว ✓');
}

function enableNotif() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(() => { renderProfile(); checkReminders(); });
}

function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  for (const t of pendingTasks()) {
    if (!t.due || t.remindedAt) continue;
    const hLeft = (new Date(t.due) - now) / 3.6e6;
    if (hLeft > 0 && hLeft <= 24) {
      new Notification('StudentOS AI — ใกล้กำหนดส่ง', {
        body: `${t.subject} — ${t.detail} (${fmtDue(t.due, now)})`,
      });
      t.remindedAt = now.toISOString();
    }
  }
  save();
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

// ---------- init ----------
function tickClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
}

document.getElementById('photoInput').addEventListener('change', e => {
  if (e.target.files[0]) scanFromPhoto(e.target.files[0]);
  e.target.value = '';
});

// PWA: ลงทะเบียน service worker (เฉพาะเมื่อเปิดผ่าน http/https)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

(async function initApp() {
  load();
  fillSubjectSelect();
  tickClock();
  setInterval(tickClock, 30_000);
  setInterval(checkReminders, 5 * 60_000);
  checkReminders();

  await initCloud();

  if (cloudConfigured() && !currentUser && !localStorage.getItem('studentos.skipLogin')) {
    go('scr-login'); // มีระบบบัญชี + ยังไม่เคยเลือก → ให้เลือกก่อน
  } else {
    go(state.tasks.length ? 'scr-home' : 'scr-scan'); // ครั้งแรก: เริ่มที่ Scan (จุดขายของเรา)
  }
})();
