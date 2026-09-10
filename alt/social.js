// ============================================================
// เพื่อนร่วมห้อง — ตัวตน · จับคู่ · ช่องคุย
// ------------------------------------------------------------
// แนวคิดทั้งหมดอยู่ในหัวไฟล์ของ migration 20260829120000_social.sql
// สรุปสั้น: คนหนึ่งคนเป็นทั้ง "คนขาย" และ "คนซื้อ" พร้อมกัน แยกตามวิชา
// และแอปเป็นคนเดียวที่รู้ว่าใครจมวิชาไหน จึงเป็นคนแนะนำให้เจอกันได้
//
// เส้นที่ห้ามข้าม: งานจริงของผู้ใช้ไม่เคยออกจากเครื่องไปให้ใครอื่นอ่าน
// สิ่งที่ส่งขึ้นไปคือ "สรุปว่ารอด/จมวิชาไหน" ซึ่งผู้ใช้เห็นและแก้ได้ก่อนกดเผยแพร่
// ============================================================

// ---------- ต้องมีงานกี่ชิ้นถึงจะตัดสินวิชาหนึ่งได้ ----------
// สองชิ้นแล้วบอกว่า "เธอจมวิชานี้" คือการกล่าวหาจากตัวอย่างที่น้อยเกินไป
// และคนที่ถูกกล่าวหาผิดจะไม่กลับมาแก้ให้ เขาจะปิดแอปไปเลย
const SUBJ_MIN = 3;

// ---------- อ่านว่ารอดหรือจมวิชาไหน ----------
// ใช้ข้อมูลเดียวกับที่ renderStats ใช้ — ไม่ตั้งกติกาใหม่ซ้อนของเดิม
// สัญญาณที่เชื่อได้จริงมีสามอย่าง: ส่งทันไหม · ค้างเลยกำหนดกี่ชิ้น · เลื่อนบ่อยแค่ไหน
function subjectSignals() {
  const now = new Date();
  const rows = {};
  for (const t of (typeof liveTasks === 'function' ? liveTasks() : (state.tasks || []))) {
    const k = (t.subject || '').trim();
    if (!k || k === 'อื่น ๆ') continue;          // ไม่ระบุวิชา = ตัดสินอะไรไม่ได้
    const r = rows[k] || (rows[k] = { n: 0, rated: 0, onTime: 0, late: 0, snooze: 0 });
    r.n++;
    r.snooze += t.snoozeCount || 0;
    if (t.done && t.doneAt && t.due) {
      r.rated++;
      if (new Date(t.doneAt) <= new Date(t.due)) r.onTime++;
    } else if (!t.done && t.due && new Date(t.due) < now) {
      r.late++;                                   // ยังไม่เสร็จ และเลยกำหนดมาแล้ว
    }
  }

  const strong = [], weak = [];
  for (const [name, r] of Object.entries(rows)) {
    if (r.n < SUBJ_MIN) continue;
    const pct = r.rated ? r.onTime / r.rated : null;
    const snoozePer = r.n ? r.snooze / r.n : 0;
    if (r.late >= 2 || (pct != null && pct < 0.5) || snoozePer >= 2) weak.push(name);
    else if (pct != null && pct >= 0.8 && !r.late) strong.push(name);
  }
  return { strong, weak };
}

// ---------- สิ่งที่ผู้ใช้ยืนยันแล้ว ----------
// ค่าที่แอปเดามาเป็นแค่ข้อเสนอ · ของจริงคือสิ่งที่เจ้าของกดยืนยัน
// เพราะ "ยินดีช่วยวิชาไหน" เป็นเรื่องความสมัครใจ ไม่ใช่เรื่องที่สถิติตัดสินแทนได้
function socialState() {
  const s = (state && state.settings && state.settings.social) || {};
  return {
    strong: Array.isArray(s.strong) ? s.strong : null,   // null = ยังไม่เคยยืนยัน
    weak:   Array.isArray(s.weak)   ? s.weak   : null,
    bio:    typeof s.bio === 'string' ? s.bio : '',
    open:   s.open !== false,
    pubAt:  s.pubAt || null,
    ageBand: s.ageBand || null,
    agreedAt: s.agreedAt || null,
  };
}
function saveSocial(s) {
  if (!state.settings) state.settings = {};
  state.settings.social = s;
  save();
}
// ค่าที่จะเอาไปโชว์: ยืนยันแล้วใช้ของที่ยืนยัน · ยังไม่เคยยืนยันใช้ที่แอปเดา
function socialChips() {
  const s = socialState();
  if (s.strong && s.weak) return { strong: s.strong, weak: s.weak, confirmed: true };
  const g = subjectSignals();
  return { strong: g.strong, weak: g.weak, confirmed: false };
}

// วิชาทั้งหมดที่ผู้ใช้เคยพิมพ์ไว้ — ใช้เป็นตัวเลือกตอนแก้เอง
function knownSubjects() {
  const set = new Set();
  for (const t of (state.tasks || [])) {
    const k = (t.subject || '').trim();
    if (k && k !== 'อื่น ๆ') set.add(k);
  }
  return [...set].sort();
}

// ============================================================
// คุยกับเซิร์ฟเวอร์
// ============================================================
let mates = null;          // ผลจับคู่ล่าสุด · null = ยังไม่เคยโหลด
let matesErr = null;
let matesBusy = false;

async function publishProfile() {
  if (!sb || !currentUser) return { error: 'ยังไม่ได้ล็อกอิน' };
  const c = socialChips();
  const s = socialState();
  const row = {
    id: currentUser.id,
    display_name: (state.settings.name || '').trim() || 'นักเรียน',
    avatar: (state.settings.avatar || null),
    bio: s.bio || null,
    strong: c.strong,
    weak: c.weak,
    open_to_help: s.open,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('profiles').upsert(row);
  if (error) return { error: error.message };
  saveSocial(Object.assign(s, { strong: c.strong, weak: c.weak, pubAt: Date.now() }));
  return {};
}

async function loadMates() {
  if (!sb || !currentUser) { matesErr = 'ยังไม่ได้ล็อกอิน'; return; }
  matesBusy = true; renderMates();
  const { data, error } = await sb.rpc('study_matches', { p_limit: 30 });
  matesBusy = false;
  if (error) { matesErr = error.message; mates = null; }
  else { matesErr = null; mates = data || []; }
  renderMates();
}

// ============================================================
// จอ "เพื่อนร่วมห้อง"
// ============================================================
// ============================================================
// หลังบ้านยังไม่ได้ apply migration หรือยัง
// ------------------------------------------------------------
// หน้าเว็บกับฐานข้อมูลปล่อยคนละรอบเสมอ — โค้ดขึ้น GitHub Pages ทันทีที่ push
// แต่ migration ต้องมีคนรัน `supabase db push` เอง ช่วงกลางระหว่างสองอย่างนี้
// อาจยาวเป็นวัน และมีคนใช้แอปอยู่จริงตลอดช่วงนั้น
//
// PostgREST ตอบ PGRST202 เมื่อเรียกฟังก์ชันที่ยังไม่มี · จับตรงนี้แล้ว
// **ซ่อนฟีเจอร์ที่ยังไม่พร้อม** แทนที่จะปล่อยให้ผู้ใช้กดแล้วเจอ error
// ปุ่มที่กดแล้วขึ้น error อ่านเหมือนแอปพัง ส่วนปุ่มที่ยังไม่โผล่ไม่มีใครคิดถึง
// และมันโผล่เองทันทีที่ apply migration เสร็จ ไม่ต้องปล่อยเว็บใหม่
function rpcMissing(err) {
  if (!err) return false;
  const c = String(err.code || '');
  const m = String(err.message || '');
  return c === 'PGRST202' || c === '42883'
    || /could not find the function|does not exist/i.test(m);
}

// ============================================================
// ช่วงชั้น — กุญแจของสโคป "ทั่วประเทศ"
// ------------------------------------------------------------
// สามปุ่มเท่านั้น (ม.ต้น / ม.ปลาย / มหาลัย) ตามที่ผู้ใช้เคาะเมื่อ 8 ก.ย. 2569
// ไม่แยกเป็น ม.1 ถึง ม.6 ด้วยเหตุผลที่เขียนไว้ยาว ๆ ใน migration 20260908090000:
// ผู้ชมต้องกว้างพอที่จะมีคนว่างตอบเสมอ · ม.4 อย่างเดียวคือหนึ่งในสามของ ม.ปลาย
//
// ช่องนี้ทำงานสองอย่างพร้อมกัน — เป็นตัวจับคู่ของฟีดทั่วประเทศ
// และเป็นตัวบอกช่วงอายุแบบหยาบ ๆ สำหรับค่าเริ่มต้นด้านความปลอดภัย โดยไม่ต้องถามวันเกิด
// ============================================================
const GRADE_BANDS = ['ม.ต้น', 'ม.ปลาย', 'มหาลัย'];
let cohort = { country: 'TH', grade: null };
let cohortLoaded = false;
// false จนกว่าจะพิสูจน์ได้ว่าหลังบ้านมีของแล้ว — ไม่ใช่ true แล้วค่อยพัง
let cohortReady = false;

async function loadCohort() {
  if (!sb || !currentUser || cohortLoaded) return;
  cohortLoaded = true;
  const { data, error } = await sb.rpc('my_cohort');
  if (rpcMissing(error)) { cohortReady = false; renderMates(); return; }
  cohortReady = true;
  const row = Array.isArray(data) ? data[0] : data;
  if (row) cohort = { country: row.country || 'TH', grade: row.grade || null };
  renderMates();
  if (typeof renderFeed === 'function') renderFeed();
}

function cohortBlock() {
  if (!currentUser || !cohortReady) return '';
  return `<p class="ch-lb">ตอนนี้เรียนอยู่ช่วงไหน</p>
    <div class="ch-row">
      ${GRADE_BANDS.map(g => `<button class="ch-chip${cohort.grade === g ? ' on' : ''}"
        onclick="setCohort('${g}')">${g}</button>`).join('')}
    </div>
    <p class="ch-fine">${cohort.grade
      ? 'ใช้จับคู่กับคนที่เรียนเรื่องเดียวกันทั้งประเทศ — แท็บ "ทั่วประเทศ" ในฟีด'
      : 'ยังไม่ได้เลือก · แท็บ "ทั่วประเทศ" ในฟีดจะยังว่างอยู่จนกว่าจะเลือก'}</p>`;
}

async function setCohort(g) {
  if (!sb || !currentUser) return loginFromMates();
  const was = cohort.grade;
  cohort.grade = (was === g) ? null : g;    // กดซ้ำ = ยกเลิก
  renderMates();
  const { error } = await sb.rpc('set_cohort', { p_grade: cohort.grade, p_track: null });
  if (error) {
    cohort.grade = was;
    renderMates();
    showToast({ title: 'บันทึกไม่สำเร็จ', body: error.message });
    return;
  }
  if (typeof haptic === 'function') haptic('arm');
}

function renderMates() {
  const box = document.getElementById('matesBody');
  if (!box) return;
  if (currentUser && !cohortLoaded) loadCohort();
  const c = socialChips();
  const s = socialState();
  const known = knownSubjects();

  // ---- ยังไม่ได้ยืนยันวิชา: ต้องทำอันนี้ก่อนถึงจะจับคู่ได้ ----
  //
  // จอนี้เคยเป็นกำแพงล็อกอินทึบ ๆ ที่ไม่มีอะไรให้ดูเลยนอกจากปุ่มเข้าสู่ระบบ
  // ซึ่งผิดสองชั้น: คนตัดสินใจไม่ได้ว่าจะล็อกอินไปทำไม เพราะไม่เคยเห็นว่าข้างในคืออะไร
  // และครึ่งบนของจอนี้ (เลือกวิชา) ทำงานได้ครบโดยไม่ต้องต่อเน็ตสักนิดอยู่แล้ว
  // ตอนนี้จึงเห็นและกดได้ทั้งหมด · ล็อกอินไปขอตอนที่มันจำเป็นจริง ๆ เท่านั้น
  // คือตอนจะเผยแพร่ให้คนอื่นเห็น กับตอนจะเปิดรายชื่อคนในห้อง
  const chip = (name, kind, on) => `<button class="so-chip ${kind}${on ? ' on' : ''}"
    onclick="toggleSubj('${kind}','${esc(name).replace(/'/g, "\\'")}')">${esc(name)}</button>`;

  const setup = `<div class="so-card">
      <div class="so-card-h">
        <b>วิชาของฉัน</b>
        ${c.confirmed ? '' : '<span class="so-guess">แอปเดาให้จากงานที่ผ่านมา — แก้ได้</span>'}
      </div>
      <p class="so-lb">วิชาที่ช่วยเพื่อนได้</p>
      <div class="so-chips row">
        ${known.length ? known.map(n => chip(n, 'good', c.strong.includes(n))).join('')
                       : '<span class="so-none">ยังไม่มีวิชาให้เลือก — เพิ่มงานสักสองสามชิ้นก่อน</span>'}
      </div>
      <p class="so-lb">วิชาที่อยากให้ใครมาช่วย</p>
      <div class="so-chips row">
        ${known.length ? known.map(n => chip(n, 'need', c.weak.includes(n))).join('') : ''}
      </div>
      <label class="so-fld">
        <span>แนะนำตัวสั้น ๆ</span>
        <input type="text" maxlength="80" value="${esc(s.bio)}"
               placeholder="เช่น ติวเลขให้ได้ แลกกับโน้ตอังกฤษ"
               onchange="socialSetBio(this.value)">
      </label>
      ${cohortBlock()}
      <button class="so-pub" onclick="doPublish()">
        ${s.pubAt ? 'อัปเดตโปรไฟล์' : 'เผยแพร่ให้เพื่อนร่วมห้องเห็น'}
      </button>
      <p class="so-fine">เพื่อนเห็นแค่ชื่อ รูป และสองแถวนี้ — งานกับตารางเรียนไม่ได้ส่งขึ้นไป</p>
    </div>`;

  // ---- รายชื่อ ----
  let list = '';
  if (!currentUser) {
    // ตัวอย่างสองใบ ติดป้ายชัดว่าเป็นตัวอย่าง — คนต้องเห็นว่า "ข้างในหน้าตาแบบนี้"
    // ก่อนจะตัดสินใจว่าจะล็อกอินไหม · ชื่อในตัวอย่างเป็นชื่อสมมติ ไม่ใช่คนจริงในระบบ
    const eg = [
      { id: '', display_name: 'เพื่อนในห้องเธอ', avatar: null, bio: '',
        strong: c.weak.length ? [c.weak[0]] : ['เลข'], weak: [],
        match: c.weak.length ? [c.weak[0]] : ['เลข'], give: [] },
      { id: '', display_name: 'อีกคนในห้องเธอ', avatar: null, bio: '',
        strong: [], weak: c.strong.length ? [c.strong[0]] : ['เคมี'],
        match: [], give: c.strong.length ? [c.strong[0]] : ['เคมี'] },
    ];
    list = `<div class="sec-label">หน้าตาเวลามีเพื่อนแล้ว</div>
      <div class="so-demo">
        ${eg.map(m => mateCard(m, true)).join('')}
      </div>
      <div class="so-empty">
        <p class="so-empty-h">ล็อกอินเพื่อเจอคนจริง</p>
        <p class="so-empty-p">ห้องเรียนต้องรู้ว่าใครเป็นใคร ตรงนี้จึงต้องมีบัญชี ·
          วิชาที่เลือกไว้ข้างบนถูกเก็บในเครื่องแล้ว ล็อกอินเสร็จจะกลับมาที่หน้านี้เอง</p>
        <button class="btn google" onclick="loginFromMates()"><span class="g-badge">G</span>
          เข้าสู่ระบบด้วย Google</button>
      </div>`;
  } else if (!s.pubAt) {
    list = `<p class="so-hint">เผยแพร่โปรไฟล์ก่อน แล้วจะเห็นว่าใครในห้องช่วยเรื่องอะไรได้บ้าง</p>`;
  } else if (matesBusy) {
    list = `<p class="so-hint">กำลังดูว่าใครอยู่ห้องเดียวกับคุณ…</p>`;
  } else if (matesErr) {
    list = `<p class="so-hint err">เปิดรายชื่อไม่ได้ — ${esc(matesErr)}
      <button class="so-retry" onclick="loadMates()">ลองใหม่</button></p>`;
  } else if (mates && !mates.length) {
    list = `<div class="so-empty">
        <p class="so-empty-h">ยังไม่มีใครในห้องเลย</p>
        <p class="so-empty-p">รายชื่อนี้มาจากกลุ่ม LINE ที่บอทอยู่ — ถ้าเพื่อนยังไม่ได้กดลิงก์เข้าร่วม
          พวกเขาจะยังไม่โผล่ตรงนี้</p>
        <button class="so-retry" onclick="go('scr-sources')">ไปหน้าตัวเชื่อม</button>
      </div>`;
  } else if (mates) {
    list = mates.map(m => mateCard(m)).join('');
  }

  // คำขอเป็นเพื่อนขึ้นก่อนทุกอย่าง — ของที่รอคนตอบต้องไม่อยู่ใต้ของที่ตั้งครั้งเดียวจบ
  // คำขอเพื่อนย้ายไปอยู่แท็บ "เพื่อนฉัน" ของจอฟีดแล้ว (1B18) — เดิมมันโผล่สองที่
  // ด้วยโค้ดคนละชุด ซึ่งแปลว่ากดรับที่หนึ่งแล้วอีกที่ยังค้างอยู่จนกว่าจะโหลดใหม่
  const inbox = '';
  box.innerHTML = matesHead() + inbox + setup
    + (s.pubAt ? '<div class="sec-label">คนในห้องของคุณ</div>' : '') + list;
}

function matesHead() {
  return `<div class="page-head">
    <div class="eyebrow mono">${esc(fmtThaiDate(new Date()))}</div>
    <h1 class="page-title">เพื่อนร่วมห้อง</h1>
    <p class="page-sub">บอกว่าคุณช่วยเรื่องอะไรได้ แล้วแอปจะหาคนที่ตรงกันให้</p>
  </div>`;
}

// การ์ดคนหนึ่งคน — เหตุผลต้องอยู่บนการ์ด ไม่ใช่ซ่อนอยู่ข้างใน
// เพราะสิ่งที่ทำให้กล้ากดทักคือ "รู้ว่าจะทักไปว่าอะไร" ไม่ใช่ "รู้ว่าเขาชื่ออะไร"
function mateCard(m, demo) {
  const match = m.match || [];
  const give = m.give || [];
  const av = m.avatar
    ? `<img class="so-av" src="${esc(m.avatar)}" alt="">`
    : `<div class="so-av">${esc((m.display_name || '?').slice(0, 1))}</div>`;

  let why = '';
  if (match.length) {
    why = `<p class="so-why good">เก่ง<b>${esc(match.join(' · '))}</b> ซึ่งเป็นวิชาที่คุณกำลังจม</p>`;
  } else if (give.length) {
    why = `<p class="so-why give">กำลังจม<b>${esc(give.join(' · '))}</b> ซึ่งคุณช่วยได้</p>`;
  } else {
    why = `<p class="so-why">อยู่ห้องเดียวกัน</p>`;
  }

  const topic = match[0] || give[0] || '';
  // ใบตัวอย่างกดทักไม่ได้ — ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มที่ทำให้คนคิดว่าแอปพัง
  if (demo) {
    return `<div class="so-mate demo">
      ${av}
      <div class="so-bd">
        <div class="so-nm">${esc(m.display_name)}<span class="so-egtag">ตัวอย่าง</span></div>
        ${why}
      </div>
      <span class="so-poke off" aria-hidden="true">${icon('chat')}</span>
    </div>`;
  }
  return `<div class="so-mate">
    ${av}
    <div class="so-bd">
      <div class="so-nm">${esc(m.display_name || 'นักเรียน')}</div>
      ${why}
      ${m.bio ? `<p class="so-bio">${esc(m.bio)}</p>` : ''}
      ${m.strong && m.strong.length
        ? `<div class="so-tags">${m.strong.slice(0, 4).map(x =>
            `<span class="so-tag">${esc(x)}</span>`).join('')}</div>` : ''}
    </div>
    <button class="so-poke" onclick="pokeMate('${esc(m.id)}','${esc(topic).replace(/'/g, "\\'")}')"
      aria-label="ทัก ${esc(m.display_name || '')}">${icon('chat')}</button>
  </div>`;
}

function toggleSubj(kind, name) {
  const c = socialChips();
  const s = socialState();
  const key = kind === 'good' ? 'strong' : 'weak';
  const other = kind === 'good' ? 'weak' : 'strong';
  const cur = { strong: c.strong.slice(), weak: c.weak.slice() };
  const i = cur[key].indexOf(name);
  if (i >= 0) cur[key].splice(i, 1);
  else {
    cur[key].push(name);
    // วิชาเดียวอยู่สองแถวพร้อมกันไม่ได้ — "ช่วยได้" กับ "อยากให้ช่วย" ขัดกันเอง
    const j = cur[other].indexOf(name);
    if (j >= 0) cur[other].splice(j, 1);
  }
  saveSocial(Object.assign(s, cur));
  haptic('arm');
  renderMates();
}

function socialSetBio(v) {
  const s = socialState();
  s.bio = String(v || '').slice(0, 80).trim();
  saveSocial(s);
}

async function doPublish() {
  // ยังไม่ล็อกอินก็กดปุ่มนี้ได้ — มันคือจุดที่บัญชีเริ่มจำเป็นจริง ๆ
  // พาไปล็อกอินเลยดีกว่าขึ้น error บอกว่า "ยังไม่ได้ล็อกอิน" ซึ่งไม่ได้ช่วยอะไร
  if (!currentUser) return loginFromMates();
  const r = await publishProfile();
  if (r.error) {
    haptic('snooze');
    showToast({ title: 'เผยแพร่ไม่สำเร็จ', body: r.error });
    return;
  }
  haptic('done');
  showToast({ title: 'เผยแพร่แล้ว', body: 'เพื่อนร่วมห้องเห็นโปรไฟล์ของคุณได้แล้ว' });
  renderMates();
  loadMates();
}

// ============================================================
// ช่องคุย
// ============================================================
let chatThread = null;     // { id, name, subject }
let chatMsgs = [];
let chatSub = null;        // ช่องรับข้อความสด — ต้องปิดทุกครั้งที่ออกจากจอ

async function pokeMate(id, topic, name) {
  if (!sb || !currentUser) return;
  const m = (mates || []).find(x => x.id === id);
  const { data, error } = await sb.rpc('open_dm', { p_other: id, p_subject: topic || null });
  if (error) {
    haptic('snooze');
    // ข้อความจาก dm_gate เป็นภาษาไทยที่เอาไปโชว์ได้ตรง ๆ อยู่แล้ว (โควตาเต็ม · ช่วงอายุ · ตั้งค่าปิด)
    // จึงไม่ต้องแปลงอะไร — และห้ามเขียนทับด้วยข้อความกลาง ๆ เพราะเหตุผลคือสิ่งเดียวที่ช่วยเขาได้
    showToast({ title: 'ทักไม่ได้', body: error.message });
    return;
  }
  chatThread = {
    id: data, name: (m && m.display_name) || name || 'นักเรียน',
    avatar: (m && m.avatar) || null,
    subject: topic || '', other: id,
  };
  chatMsgs = [];
  go('scr-chat');
  openChat();
}

async function openChat() {
  if (!chatThread) return;
  renderChat();

  // ---------- สถานะของห้อง ----------
  // ต้องรู้ก่อนวาด ว่านี่คือห้องที่เปิดแล้ว หรือคำขอที่ยังไม่มีใครตอบรับ
  // ไม่งั้นคนขอจะพิมพ์ข้อความที่สองแล้วเจอ error โดยไม่รู้ว่าทำไม
  const { data: t } = await sb.from('dm_threads')
    .select('state, opener').eq('id', chatThread.id).maybeSingle();
  if (t) {
    chatThread.state = t.state || 'open';
    chatThread.mineReq = t.opener === currentUser.id;
  }
  renderChat();

  // ---------- ชื่อจริงกับรูปของอีกฝ่าย ----------
  // ของเดิมพึ่งชื่อที่ผู้เรียกส่งมาอย่างเดียว ทางเข้าไหนที่ไม่ได้ส่งมาก็ตกไปเป็น "นักเรียน"
  // ซึ่งผู้ใช้เจอจริง — หัวจอขึ้นคำว่า "นักเรียน" ทั้งที่คุยกับคนที่มีชื่อ
  // ถามผ่าน user_card เพราะเป็นประตูเดียวกับหน้าโปรไฟล์ กติกาการมองเห็นจึงตรงกันเสมอ
  if (chatThread.other) {
    const { data: c } = await sb.rpc('user_card', { p_user: chatThread.other });
    const u = Array.isArray(c) ? c[0] : c;
    if (u) {
      // personName อยู่ใน feed.js — ถ้ายังไม่ได้ตั้งชื่อจะได้ @ชื่อผู้ใช้แทนคำว่า "นักเรียน"
      chatThread.name = (typeof personName === 'function' ? personName(u) : u.display_name)
        || chatThread.name;
      chatThread.avatar = u.avatar || null;
      renderChat();
    }
  }

  const { data, error } = await sb.from('dm_messages')
    .select('id, sender, body, created_at')
    .eq('thread', chatThread.id)
    .order('created_at', { ascending: true })
    .limit(200);
  if (!error) chatMsgs = data || [];
  renderChat();

  // ข้อความใหม่เด้งเข้าเอง — ไม่ต้องปัดลงรีเฟรช
  closeChat();
  chatSub = sb.channel('dm:' + chatThread.id)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dm_messages',
        filter: 'thread=eq.' + chatThread.id },
      p => {
        if (chatMsgs.some(m => m.id === p.new.id)) return;   // ของตัวเองที่เพิ่งส่งไป
        chatMsgs.push(p.new);
        renderChat();
      })
    .subscribe();
}

// ต้องเรียกทุกครั้งที่ออกจากจอแชท — ช่องที่เปิดค้างไว้กินเน็ตและกินโควตา
// realtime ของ Supabase นับจำนวนช่องที่เปิดพร้อมกัน ไม่ใช่จำนวนข้อความ
function closeChat() {
  if (chatSub) { try { sb.removeChannel(chatSub); } catch (_) {} chatSub = null; }
}

// ============================================================
// จอแชท — ทรงเดียวกับ Instagram (1B67)
// ------------------------------------------------------------
// ผู้ใช้ส่งหน้า DM ของ IG มาให้ดูแล้วบอกว่า "ขอเหมือน ig เลย" (10 ก.ย. 2569)
//
// สามอย่างที่ทำให้ IG อ่านเป็นห้องแชท ไม่ใช่รายการข้อความ:
//   1) หัวจอมีรูปคนคุยอยู่ด้วย และแตะแล้วไปโปรไฟล์ได้ — ของเดิมมีแต่ชื่อเป็นตัวหนังสือ
//      ทำให้จอนี้ตัดขาดจากตัวตนของอีกฝ่ายโดยสิ้นเชิง
//   2) ข้อความที่ส่งติด ๆ กันถูกจับเป็นก้อนเดียว รูปโผล่แค่ฟองสุดท้ายของก้อน
//      ถ้าให้รูปโผล่ทุกฟอง สิบข้อความติดกันจะกลายเป็นสิบหน้าเรียงลงมา
//   3) ช่องพิมพ์เป็นแคปซูลใบเดียว ปุ่มส่งโผล่ตอนมีตัวอักษรเท่านั้น
//      ปุ่มส่งที่ค้างอยู่ตลอดเวลาทั้งที่กดไปก็ไม่เกิดอะไร คือปุ่มที่สอนให้คนเลิกเชื่อปุ่ม
//
// ที่ไม่ได้ทำตาม IG: ปุ่มโทร ปุ่มวิดีโอคอล และปุ่มกล้อง — สองอันแรกไม่มีในแอปนี้
// และจะไม่มี (เส้นความปลอดภัยที่ขีดไว้ในเอกสารบันไดสโคป) ส่วนกล้องยังส่งรูปในแชทไม่ได้
// ปุ่มที่กดแล้วไม่เกิดอะไรแย่กว่าปุ่มที่ยังไม่มี
// ============================================================

// หัวข้อความคั่นวัน — IG มี และมันจำเป็นจริงเมื่อห้องเริ่มมีข้อความข้ามวัน
function chatDayLabel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const today = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'วันนี้';
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (same(d, y)) return 'เมื่อวาน';
  return typeof fmtThaiDate === 'function' ? fmtThaiDate(d) : d.toLocaleDateString();
}
function chatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function chatAvatar() {
  const nm = chatThread.name || 'นักเรียน';
  return chatThread.avatar
    ? `<img class="ch-face" src="${esc(chatThread.avatar)}" alt="">`
    : `<span class="ch-face" style="${typeof avOf === 'function' ? avOf(nm) : ''}">${
        esc(nm.slice(0, 1))}</span>`;
}

function renderChat() {
  const box = document.getElementById('chatBody');
  if (!box || !chatThread) return;
  const me = currentUser && currentUser.id;

  // ---------- คำขอทัก ----------
  // ฝั่งคนขอ: บอกตรง ๆ ว่าส่งได้ข้อความเดียวจนกว่าจะมีคนตอบ · ถ้าไม่บอก เขาจะพิมพ์ต่อ
  // แล้วเจอ error ที่อ่านเหมือนแอปพัง ทั้งที่มันคือกติกาที่ตั้งใจให้เป็นแบบนั้น
  // ฝั่งคนรับ: ปุ่มรับ/ปฏิเสธอยู่บนสุด และ **ตอบกลับก็คือการรับ** ไม่ต้องกดปุ่มก่อนก็ได้
  const pending = chatThread.state === 'pending';
  const asked = pending && chatThread.mineReq;
  const gotAsked = pending && !chatThread.mineReq;
  const usedUp = asked && chatMsgs.some(m => m.sender === me);

  // ---------- จับข้อความติด ๆ กันเป็นก้อน ----------
  // เกณฑ์: คนเดียวกัน และห่างกันไม่เกิน 5 นาที · เกินนั้นถือว่าเป็นคนละจังหวะการคุย
  let lastDay = '';
  const rows = chatMsgs.map((m, i) => {
    const prev = chatMsgs[i - 1];
    const next = chatMsgs[i + 1];
    const mine = m.sender === me;
    const gap = (x, y) => !x || !y
      || Math.abs(new Date(y.created_at) - new Date(x.created_at)) > 5 * 60 * 1000;
    const startsRun = !prev || prev.sender !== m.sender || gap(prev, m);
    const endsRun = !next || next.sender !== m.sender || gap(m, next);

    const day = chatDayLabel(m.created_at);
    const dayHead = day && day !== lastDay ? `<div class="ch-day"><span>${esc(day)}</span></div>` : '';
    lastDay = day || lastDay;

    return dayHead + `<div class="ch-msg${mine ? ' me' : ''}${endsRun ? ' last' : ''}">
      ${mine ? '' : (endsRun ? chatAvatar() : '<span class="ch-face ghost"></span>')}
      <span class="ch-bub${startsRun ? ' first' : ''}${endsRun ? ' tail' : ''}"
        title="${esc(chatTime(m.created_at))}">${esc(m.body)}</span>
    </div>`;
  }).join('');

  box.innerHTML = `
    <div class="ch-top">
      <button class="ch-back" onclick="go('scr-mates')" aria-label="กลับ">${icon('chevron')}</button>
      <!-- รูป+ชื่อแตะแล้วไปโปรไฟล์ เหมือน IG · จอแชทที่ไม่มีทางไปหาตัวตนของอีกฝ่าย
           คือจอที่คุยกับคนที่ตรวจสอบไม่ได้ ซึ่งเป็นสิ่งที่ต้องไม่เกิดหลังเปิดให้ทักทั้งแอป -->
      <button class="ch-who${chatThread.other ? ' tap' : ''}"
        ${chatThread.other ? `onclick="openUser('${esc(chatThread.other)}')"` : ''}>
        ${chatAvatar()}
        <span class="ch-who-tx">
          <b>${esc(chatThread.name)}${chatThread.other ? icon('chevron') : ''}</b>
          ${chatThread.subject ? `<i>เรื่อง${esc(chatThread.subject)}</i>` : ''}
        </span>
      </button>
      ${chatThread.other ? `<button class="ch-more" aria-label="รายงานหรือบล็อก"
        onclick="openReport('user','${esc(chatThread.other)}')">${icon('flag')}</button>` : ''}
    </div>

    ${gotAsked ? `<div class="ch-req">
      <p>คนนี้ยังไม่ใช่เพื่อนของคุณ — เขาส่งคำขอทักมา</p>
      <div class="ch-req-row">
        <button class="ch-req-no" onclick="declineDm('${esc(chatThread.id)}', false)">ไม่รับ</button>
        <button class="ch-req-block" onclick="declineDm('${esc(chatThread.id)}', true)">บล็อก</button>
        <button class="ch-req-ok" onclick="acceptDm('${esc(chatThread.id)}')">รับ</button>
      </div>
    </div>` : ''}
    ${asked ? `<p class="ch-wait">${usedUp
        ? 'ส่งคำขอแล้ว — ส่งได้อีกครั้งเมื่อเขาตอบกลับ'
        : 'คนนี้ยังไม่ใช่เพื่อนของคุณ ข้อความแรกจะไปอยู่ในกล่องคำขอของเขา'}</p>` : ''}

    <div class="ch-list" id="chatList">
      ${chatMsgs.length ? rows : `<div class="ch-blank">
          ${chatAvatar()}
          <b>${esc(chatThread.name)}</b>
          <p>ยังไม่มีใครพิมพ์อะไร — ประโยคแรกยากที่สุดเสมอ</p>
        </div>`}
    </div>

    ${usedUp ? '' : `<div class="ch-bar">
      <div class="ch-field">
        <input id="chatIn" type="text" maxlength="2000" placeholder="ข้อความ…"
               autocomplete="off"
               value="${chatMsgs.length || !chatThread.subject ? ''
                       : esc(chatThread.subject + 'ขอถามหน่อยได้ป่ะ')}"
               oninput="chatTyping()"
               onkeydown="if(event.key==='Enter')sendChat()">
        <button class="ch-send" id="chSend" onclick="sendChat()" aria-label="ส่ง">${icon('check')}</button>
      </div>
    </div>`}`;

  chatTyping();
  const list = document.getElementById('chatList');
  if (list) list.scrollTop = list.scrollHeight;
}

// ปุ่มส่งโผล่ตอนมีตัวอักษรเท่านั้น (เหมือน IG)
// ปุ่มที่ค้างอยู่ตลอดทั้งที่กดไปก็ไม่เกิดอะไร คือปุ่มที่สอนให้คนเลิกเชื่อปุ่ม
function chatTyping() {
  const el = document.getElementById('chatIn');
  const btn = document.getElementById('chSend');
  if (!el || !btn) return;
  btn.classList.toggle('on', !!el.value.trim());
}

// ส่งผ่าน dm_say เสมอ ไม่ insert ตรงอีกแล้ว
// policy ของ dm_messages ถูกบีบให้รับเฉพาะห้องที่เปิดแล้ว (migration 19) —
// ห้องที่ยังเป็นคำขอจึงเข้าได้ทางฟังก์ชันนี้ทางเดียว ซึ่งเป็นที่ที่บังคับกติกา
// "คนขอส่งได้ข้อความเดียว" กับ "ปลายทางตอบ = ห้องเปิด" ไว้ที่เดียว
async function sendChat() {
  const el = document.getElementById('chatIn');
  if (!el || !chatThread) return;
  const body = el.value.trim();
  if (!body) return;
  el.value = '';
  let { data, error } = await sb.rpc('dm_say', { p_thread: chatThread.id, p_body: body });
  // ยังไม่ได้ apply migration 19 — ถอยไปเขียนตรงแบบเดิม
  // ปลอดภัยเพราะถ้ายังไม่มี dm_say ก็แปลว่ายังไม่มีคอลัมน์ state ด้วย จึงไม่มีห้องคำขอ
  // ให้ข้ามกติกาตั้งแต่แรก · ข้อสำคัญคือ **แชทเดิมต้องไม่พังระหว่างรอ migration**
  if (rpcMissing(error)) {
    const r = await sb.from('dm_messages')
      .insert({ thread: chatThread.id, sender: currentUser.id, body })
      .select('id, sender, body, created_at').single();
    data = r.data ? [r.data] : null;
    error = r.error;
  }
  if (error) {
    el.value = body;                       // คืนข้อความให้ ไม่ใช่กลืนหายไปเฉย ๆ
    haptic('snooze');
    showToast({ title: 'ส่งไม่สำเร็จ', body: error.message });
    return;
  }
  const row = Array.isArray(data) ? data[0] : data;
  chatMsgs.push({
    id: (row && row.id) || Date.now(), sender: currentUser.id, body,
    created_at: (row && row.created_at) || new Date().toISOString(),
  });
  // ปลายทางพิมพ์ตอบ = ห้องเปิดแล้วฝั่งเซิร์ฟเวอร์ · ฝั่งนี้ต้องตามให้ทัน
  // ไม่งั้นแบนเนอร์ "คำขอ" ยังค้างอยู่ทั้งที่คุยกันได้แล้ว
  if (chatThread.state === 'pending' && !chatThread.mineReq) chatThread.state = 'open';
  renderChat();
}

// ============================================================
// กล่องข้อความ — ห้องที่เปิดแล้ว กับ คำขอทัก
// ------------------------------------------------------------
// จอนี้เกิดขึ้นเพราะการทักไม่ได้จำกัดอยู่แค่คนในห้องเรียนอีกต่อไป (migration 19)
// ตอนที่ทักได้เฉพาะคนห้องเดียวกัน ทางเข้าห้องคุยคือรายชื่อคนในห้อง ซึ่งพอ
// พอเปิดให้ทักกันได้ทั่วไป ต้องมีที่ที่ข้อความเข้ามารวมกัน ไม่งั้นข้อความจากคนที่
// ไม่ได้อยู่ในรายชื่อไหนเลยจะไม่มีทางถูกเห็น
//
// คำขออยู่บนสุดเสมอและนับให้เห็นเป็นตัวเลข ส่วนห้องที่เปิดแล้วเรียงตามเวลาปกติ
// ============================================================
let dmRows = [];
let dmBusy = false;
let dmPending = 0;        // จำนวนคำขอที่ยังไม่ได้ตอบ — ใช้ติดจุดแดงบนปุ่มในหัวฟีด
let dmReady = false;      // กล่องข้อความโผล่ต่อเมื่อหลังบ้านมี dm_inbox แล้ว
let dmDotAt = 0;

// เช็คคำขอค้างแบบเบา ๆ · ไม่ยิงถี่กว่าทุกสองนาที เพราะจุดแดงเป็นของที่ช้าได้
// (บทเรียนเดียวกับ HW_MIN_GAP ใน hw.js — ยิงทุกเรนเดอร์คือเน็ตของเด็ก)
async function loadDmDot(force) {
  if (!sb || !currentUser) { dmPending = 0; return; }
  if (!force && Date.now() - dmDotAt < 120000) return;
  dmDotAt = Date.now();
  const { data, error } = await sb.rpc('dm_inbox');
  if (rpcMissing(error)) { dmReady = false; if (typeof renderFeed === 'function') renderFeed(); return; }
  if (error) return;
  dmReady = true;
  dmRows = data || [];
  const n = dmRows.filter(r => r.is_request).length;
  if (n !== dmPending) { dmPending = n; if (typeof renderFeed === 'function') renderFeed(); }
}

async function openDmInbox() {
  if (!sb || !currentUser) return loginFromMates();
  go('scr-dm');
  dmBusy = true;
  renderDmInbox();
  const { data, error } = await sb.rpc('dm_inbox');
  dmBusy = false;
  dmRows = error ? [] : (data || []);
  renderDmInbox();
}

function dmPendingCount() {
  return dmRows.filter(r => r.is_request).length;
}

// ============================================================
// เริ่มแชทใหม่ — เลือกคนจากหน้าข้อความได้เลย
// ------------------------------------------------------------
// ของเดิมทักได้ทางเดียวคือเดินไปหน้าโปรไฟล์ของคนคนนั้นก่อน ซึ่งแปลว่า
// ต้องเจอเขาในฟีดหรือในหัวข้อเสียก่อน · คนที่เปิดหน้าข้อความมาเพราะ
// "อยากทักเพื่อน" จึงเจอทางตัน แล้วข้อความว่างเปล่าที่บอกให้ไปหาที่อื่น
// คือหน้าจอที่ทำให้คนปิดแอป ไม่ใช่หน้าจอที่พาเขาไปต่อ
//
// ทำแบบ IG: ปุ่มดินสอมุมขวาบน → รายชื่อเพื่อน + ช่องค้นหา @ชื่อผู้ใช้
// เพื่อนขึ้นก่อนเสมอโดยไม่ต้องพิมพ์อะไร เพราะคนที่จะทักส่วนใหญ่คือเพื่อนอยู่แล้ว
// ส่วนช่องค้นหามีไว้สำหรับคนที่ยังไม่ได้เป็นเพื่อน ซึ่งจะกลายเป็นคำขอทักตามกติกาเดิม
// ============================================================
let dmNew = false;          // true = กำลังอยู่ในโหมดเลือกคนที่จะทัก
let dmFriends = null;       // null = ยังไม่เคยโหลด
let dmFound = [];           // ผลค้นหา @ชื่อผู้ใช้
let dmFindQ = '';
let dmFindBusy = false;

async function openDmNew() {
  dmNew = true;
  renderDmInbox();
  if (dmFriends === null) {
    const { data, error } = await sb.rpc('friend_list');
    dmFriends = error ? [] : (data || []);
    renderDmInbox();
  }
}
function closeDmNew() { dmNew = false; renderDmInbox(); }

// พิมพ์แล้วค่อยยิง — พิมพ์ทีละตัวอักษรแล้วยิงทุกตัวคือเน็ตของเด็ก
let dmFindTimer = null;
function dmFindSoon(v) {
  dmFindQ = String(v || '');
  clearTimeout(dmFindTimer);
  dmFindTimer = setTimeout(dmFind, 350);
}
async function dmFind() {
  const q = dmFindQ.trim();
  if (q.length < 2) { dmFound = []; renderDmInbox(); return; }
  dmFindBusy = true; renderDmInbox();
  const { data, error } = await sb.rpc('find_people', { p_q: q });
  dmFindBusy = false;
  dmFound = error ? [] : (data || []);
  renderDmInbox();
}

// เลือกคนแล้วเข้าห้องเลย · pokeMate เป็นประตูเดิมที่เรียก open_dm อยู่แล้ว
// กติกาทั้งหมด (เพื่อน = เปิดห้องเลย · ไม่ใช่เพื่อน = เข้ากล่องคำขอ) อยู่ฝั่งเซิร์ฟเวอร์
// ฝั่งนี้จึงไม่ต้องรู้ว่าใครเป็นเพื่อนใคร แค่ส่ง id ไปแล้วรับผลมา
function dmStart(id, name) {
  dmNew = false;
  pokeMate(id, '', name);
}

// ---------- วาดใหม่โดยไม่ให้โฟกัสหลุดจากช่องค้นหา ----------
// จอนี้วาดด้วย innerHTML ทั้งก้อน แปลว่า <input> ถูกสร้างใหม่ทุกครั้ง —
// พิมพ์ตัวแรกแล้ว debounce ยิง render กลับมา คีย์บอร์ดจะเด้งปิดกลางคัน
// และตัวที่พิมพ์ต่อไปหายเงียบ ๆ · เก็บสถานะโฟกัสไว้แล้วคืนให้หลังวาดเสร็จ
function renderDmInbox() {
  const was = document.activeElement && document.activeElement.id === 'dmQ';
  renderDmInboxInner();
  if (!was) return;
  const el = document.getElementById('dmQ');
  if (!el) return;
  el.focus();
  // เคอร์เซอร์ต้องกลับไปท้ายข้อความ ไม่ใช่ต้นบรรทัด ไม่งั้นตัวถัดไปโผล่หน้าคำที่พิมพ์ไว้
  try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {}
}

function renderDmInboxInner() {
  const box = document.getElementById('dmBody');
  if (!box) return;
  const q = dmFindQ.trim().toLowerCase().replace(/^@/, '');

  const avOfRow = (name, avatar) => avatar
    ? `<img class="dm-av" src="${esc(avatar)}" alt="">`
    : `<div class="dm-av" style="${typeof avOf === 'function' ? avOf(name) : ''}">${
        esc((name || '?').slice(0, 1))}</div>`;

  const row = (r) => `<div class="dm-row" onclick="openDmRow('${esc(r.id)}','${esc(r.other)}','${
      esc(String(r.display_name || '').replace(/'/g, "\'"))}','${esc(r.avatar || '')}')">
      ${avOfRow(r.display_name, r.avatar)}
      <div class="dm-bd">
        <b>${esc(typeof personName === 'function' ? personName(r) : (r.display_name || 'นักเรียน'))}${r.handle ? `<span>@${esc(r.handle)}</span>` : ''}</b>
        <i>${r.last_body ? (r.mine_last ? 'คุณ: ' : '') + esc(String(r.last_body).slice(0, 60))
                         : 'ยังไม่มีข้อความ'}</i>
      </div>
    </div>`;

  // แถวของคนที่ยังไม่มีห้องคุยกัน — ไม่มีข้อความล่าสุดให้โชว์ จึงโชว์เหตุผลที่จะทักเขาแทน
  const pickRow = (p, why) => `<div class="dm-row" onclick="dmStart('${esc(p.id)}','${
      esc(String(p.display_name || '').replace(/'/g, "\'"))}')">
      ${avOfRow(p.display_name, p.avatar)}
      <div class="dm-bd">
        <b>${esc(typeof personName === 'function' ? personName(p) : (p.display_name || 'นักเรียน'))}${p.handle ? `<span>@${esc(p.handle)}</span>` : ''}</b>
        <i>${esc(why || '')}</i>
      </div>
      <span class="dm-go">${icon('chat')}</span>
    </div>`;

  // ---------- ช่องค้นหาอยู่บนสุดตลอดเวลา ----------
  // ต่างจาก IG ที่ซ่อนช่องค้นหาไว้หลังปุ่มเขียนข้อความ · Telegram วางไว้ให้เห็นเสมอ
  // แล้วมันค้นสองอย่างพร้อมกันในช่องเดียว: ห้องที่คุยกันอยู่แล้ว กับ คนที่ยังไม่เคยคุย
  // ซึ่งตรงกับสิ่งที่คนคิดในหัวจริง ๆ — เขาคิดถึง "คน" ไม่ได้คิดว่าคนนั้นอยู่ในรายการไหน
  const head = `
    <div class="ch-top">
      <button class="ch-back" onclick="go('scr-mates')" aria-label="กลับ">${icon('chevron')}</button>
      <div class="ch-who"><b>ข้อความ</b></div>
    </div>
    <div class="dm-find">
      <span class="dm-find-ic">${icon('search')}</span>
      <input type="search" id="dmQ" value="${esc(dmFindQ)}" autocomplete="off"
        placeholder="ค้นหาชื่อ หรือ @ชื่อผู้ใช้" oninput="dmFindSoon(this.value)">
      ${dmFindQ ? `<button class="dm-find-x" onclick="dmClearFind()" aria-label="ล้าง">${icon('x')}</button>` : ''}
    </div>`;

  // ปุ่มดินสอลอยมุมล่างขวา — ทางเข้าสำหรับคนที่ยังไม่รู้ว่าจะทักใคร จึงยังพิมพ์อะไรไม่ได้
  const fab = `<button class="dm-fab" onclick="openDmNew()" aria-label="เริ่มแชทใหม่">${icon('pencil')}</button>`;

  // ---------- โหมดไล่ดูเพื่อน (มาจากปุ่มดินสอ) ----------
  if (dmNew) {
    const fr = dmFriends || [];
    box.innerHTML = `
      <div class="ch-top">
        <button class="ch-back" onclick="closeDmNew()" aria-label="กลับ">${icon('chevron')}</button>
        <div class="ch-who"><b>ทักใครดี</b></div>
      </div>
      <div class="dm-list">
        ${fr.length ? `<div class="sec-label">เพื่อนของคุณ</div>
          ${fr.map(p => pickRow(p, (p.strong && p.strong.length)
            ? 'ช่วยได้เรื่อง' + esc(p.strong.slice(0, 2).join(' · '))
            : (p.bio || 'แตะเพื่อเริ่มคุย'))).join('')}`
          : (dmFriends === null ? '<p class="so-hint">กำลังโหลด…</p>'
            : `<p class="so-hint">ยังไม่มีเพื่อน — ปิดหน้านี้แล้วพิมพ์ @ชื่อผู้ใช้ในช่องค้นหาด้านบน
                 หรือส่ง @ชื่อผู้ใช้ของคุณให้เพื่อนที่หน้า "เพื่อนฉัน"</p>`)}
      </div>`;
    return;
  }

  // ---------- กำลังค้นหา ----------
  if (q.length >= 1) {
    const hit = (r) => (String(r.display_name || '').toLowerCase().includes(q)
      || String(r.handle || '').toLowerCase().includes(q));
    const chats = dmRows.filter(hit);
    const known = new Set(dmRows.map(r => r.other));
    const others = dmFound.filter(p => !known.has(p.id));

    box.innerHTML = head + `
      <div class="dm-list">
        ${chats.length ? `<div class="sec-label">แชท</div>${chats.map(row).join('')}` : ''}
        ${q.length >= 2 ? `
          <div class="sec-label">คนอื่นในแอป</div>
          ${dmFindBusy ? '<p class="so-hint">กำลังค้นหา…</p>' : ''}
          ${others.length
            ? others.map(p => pickRow(p, p.rel === 'friends' ? 'เพื่อนของคุณ'
                : 'ยังไม่ใช่เพื่อน — ข้อความแรกจะไปอยู่ในกล่องคำขอของเขา')).join('')
            : (dmFindBusy ? '' : '<p class="so-hint">ไม่เจอใครที่ตรงกับคำนี้</p>')}`
          : '<p class="so-hint">พิมพ์อีกสักตัวเพื่อค้นหาคนทั้งแอป</p>'}
      </div>` + fab;
    return;
  }

  // ---------- รายการปกติ ----------
  const reqs = dmRows.filter(r => r.is_request);
  const open = dmRows.filter(r => !r.is_request);
  box.innerHTML = head + `
    <div class="dm-list">
      ${dmBusy && !dmRows.length ? '<p class="so-hint">กำลังโหลด…</p>' : ''}
      ${reqs.length ? `<div class="sec-label">คำขอทัก ${reqs.length}</div>
        <p class="dm-fine">คนที่ยังไม่ใช่เพื่อนส่งข้อความมาได้ข้อความเดียว
          จนกว่าคุณจะตอบกลับ · ไม่ตอบก็ไม่เกิดอะไรขึ้น</p>
        ${reqs.map(row).join('')}` : ''}
      ${open.length ? `<div class="sec-label">${reqs.length ? 'ห้องที่คุยกันแล้ว' : 'ข้อความ'}</div>
        ${open.map(row).join('')}` : ''}
      ${!dmBusy && !dmRows.length
        ? `<div class="dm-blank">
             <div class="dm-blank-ic">${icon('chat')}</div>
             <p class="dm-blank-h">ยังไม่มีข้อความ</p>
             <p class="dm-blank-p">พิมพ์ชื่อเพื่อนในช่องด้านบนเพื่อเริ่มคุย
               หรือกดปุ่มดินสอเพื่อไล่ดูรายชื่อเพื่อน</p>
           </div>` : ''}
    </div>` + fab;
}

function dmClearFind() {
  dmFindQ = ''; dmFound = [];
  renderDmInbox();
  const el = document.getElementById('dmQ');
  if (el) el.focus();
}

function openDmRow(id, other, name, avatar) {
  chatThread = { id, other, name: name || 'นักเรียน', avatar: avatar || null, subject: '' };
  chatMsgs = [];
  go('scr-chat');
  openChat();
}

async function acceptDm(id) {
  const { error } = await sb.rpc('dm_accept', { p_thread: id });
  if (error) { showToast({ title: 'ทำไม่สำเร็จ', body: error.message }); return; }
  if (chatThread && chatThread.id === id) { chatThread.state = 'open'; renderChat(); }
  dmRows = dmRows.map(r => (r.id === id ? { ...r, is_request: false, state: 'open' } : r));
  renderDmInbox();
}

// ปฏิเสธ = ลบห้องทิ้งทั้งใบ ไม่ใช่แค่ซ่อน (เหตุผลอยู่ใน dm_decline ที่ migration 19)
// ถ้าแค่ซ่อน คนขอจะยังส่งเข้ามาได้ในห้องที่เรามองไม่เห็น ซึ่งเป็นช่องที่แย่ที่สุดช่องหนึ่ง
async function declineDm(id, block) {
  const { error } = await sb.rpc('dm_decline', { p_thread: id, p_block: !!block });
  if (error) { showToast({ title: 'ทำไม่สำเร็จ', body: error.message }); return; }
  dmRows = dmRows.filter(r => r.id !== id);
  chatThread = null;
  go('scr-dm');
  renderDmInbox();
  showToast({ title: block ? 'บล็อกแล้ว' : 'ไม่รับคำขอแล้ว',
    body: block ? 'เขาจะทักคุณไม่ได้อีก และไม่รู้ว่าถูกบล็อก' : 'เขาไม่ได้รับแจ้งอะไร' });
}

// ---------- ล็อกอินแล้วต้องกลับมาที่หน้านี้ ----------
// ของเดิม routeAfterLogin() พาไป scr-menu เสมอ · คนที่กดล็อกอินจากหน้าเพื่อน
// จะถูกส่งกลับมาที่หน้าแรกแล้วต้องเดินมาเองใหม่ ซึ่งคนส่วนใหญ่ไม่เดินกลับมา
// เก็บธงไว้ก่อนออกไป OAuth แล้ว routeAfterLogin() มาอ่านตอนกลับ (ธงใช้ครั้งเดียวแล้วลบ)
const MATES_RETURN_KEY = 'studentos.alt.afterLogin';
function loginFromMates() {
  try { localStorage.setItem(MATES_RETURN_KEY, 'scr-mates'); } catch (_) {}
  loginGoogle();
}
// เหมือน loginFromMates แต่จำว่ามาจากแท็บ "เพื่อนฉัน" — คนละปลายทางกัน
function loginFromFriends() {
  try { localStorage.setItem(MATES_RETURN_KEY, 'scr-friends'); } catch (_) {}
  loginGoogle();
}
function takeAfterLogin() {
  let v = null;
  try { v = localStorage.getItem(MATES_RETURN_KEY); localStorage.removeItem(MATES_RETURN_KEY); } catch (_) {}
  return v;
}
