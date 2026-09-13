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
function renderMates() {
  const box = document.getElementById('matesBody');
  if (!box) return;
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
      <div class="so-chips">
        ${known.length ? known.map(n => chip(n, 'good', c.strong.includes(n))).join('')
                       : '<span class="so-none">ยังไม่มีวิชาให้เลือก — เพิ่มงานสักสองสามชิ้นก่อน</span>'}
      </div>
      <p class="so-lb">วิชาที่อยากให้ใครมาช่วย</p>
      <div class="so-chips">
        ${known.length ? known.map(n => chip(n, 'need', c.weak.includes(n))).join('') : ''}
      </div>
      <label class="so-fld">
        <span>แนะนำตัวสั้น ๆ</span>
        <input type="text" maxlength="80" value="${esc(s.bio)}"
               placeholder="เช่น ติวเลขให้ได้ แลกกับโน้ตอังกฤษ"
               onchange="socialSetBio(this.value)">
      </label>
      <button class="so-pub" onclick="doPublish()">
        ${s.pubAt ? 'อัปเดตโปรไฟล์' : 'เผยแพร่ให้เพื่อนร่วมห้องเห็น'}
      </button>
      <p class="so-fine">เพื่อนเห็นได้แค่ชื่อ รูป คำแนะนำตัว และรายชื่อวิชาสองแถวนี้ ·
        งานของคุณ ตารางเรียน และสถิติ ไม่ได้ถูกส่งขึ้นไปด้วย</p>
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
  const inbox = typeof friendInboxHTML === 'function' ? friendInboxHTML() : '';
  box.innerHTML = matesHead() + inbox + setup
    + (s.pubAt ? '<div class="sec-label">คนในห้องของคุณ</div>' : '') + list;
}

function matesHead() {
  return `<div class="page-head">
    <div class="eyebrow mono">${esc(fmtThaiDate(new Date()))}</div>
    <h1 class="page-title">เพื่อนร่วมห้อง</h1>
    <p class="page-sub">ทุกคนเก่งคนละวิชา — ตรงนี้บอกว่าใครช่วยเรื่องอะไรได้ แล้วทักไปได้เลย</p>
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

async function pokeMate(id, topic) {
  if (!sb || !currentUser) return;
  const m = (mates || []).find(x => x.id === id);
  const { data, error } = await sb.rpc('open_dm', { p_other: id, p_subject: topic || null });
  if (error) {
    haptic('snooze');
    showToast({ title: 'เปิดห้องคุยไม่ได้', body: error.message });
    return;
  }
  chatThread = { id: data, name: (m && m.display_name) || 'เพื่อนร่วมห้อง', subject: topic || '' };
  chatMsgs = [];
  go('scr-chat');
  openChat();
}

async function openChat() {
  if (!chatThread) return;
  renderChat();
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

function renderChat() {
  const box = document.getElementById('chatBody');
  if (!box || !chatThread) return;
  const me = currentUser && currentUser.id;

  box.innerHTML = `
    <div class="ch-top">
      <button class="ch-back" onclick="go('scr-mates')" aria-label="กลับ">${icon('chevron')}</button>
      <div class="ch-who">
        <b>${esc(chatThread.name)}</b>
        ${chatThread.subject ? `<i>เรื่อง${esc(chatThread.subject)}</i>` : ''}
      </div>
    </div>
    <div class="ch-list" id="chatList">
      ${chatMsgs.length ? chatMsgs.map(m => `<div class="ch-msg${m.sender === me ? ' me' : ''}">
          <span class="ch-bub">${esc(m.body)}</span>
        </div>`).join('')
        : `<p class="ch-first">ยังไม่มีใครพิมพ์อะไร — ประโยคแรกยากที่สุดเสมอ
             ${chatThread.subject ? 'ลองใช้ที่ร่างไว้ให้ข้างล่างก็ได้' : ''}</p>`}
    </div>
    <div class="ch-bar">
      <input id="chatIn" type="text" maxlength="2000" placeholder="พิมพ์ข้อความ"
             value="${chatMsgs.length || !chatThread.subject ? ''
                     : esc(chatThread.subject + 'ขอถามหน่อยได้ป่ะ')}"
             onkeydown="if(event.key==='Enter')sendChat()">
      <button class="ch-send" onclick="sendChat()" aria-label="ส่ง">${icon('check')}</button>
    </div>`;

  const list = document.getElementById('chatList');
  if (list) list.scrollTop = list.scrollHeight;
}

async function sendChat() {
  const el = document.getElementById('chatIn');
  if (!el || !chatThread) return;
  const body = el.value.trim();
  if (!body) return;
  el.value = '';
  const { data, error } = await sb.from('dm_messages')
    .insert({ thread: chatThread.id, sender: currentUser.id, body })
    .select('id, sender, body, created_at')
    .single();
  if (error) {
    el.value = body;                       // คืนข้อความให้ ไม่ใช่กลืนหายไปเฉย ๆ
    haptic('snooze');
    showToast({ title: 'ส่งไม่สำเร็จ', body: error.message });
    return;
  }
  chatMsgs.push(data);
  renderChat();
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
function takeAfterLogin() {
  let v = null;
  try { v = localStorage.getItem(MATES_RETURN_KEY); localStorage.removeItem(MATES_RETURN_KEY); } catch (_) {}
  return v;
}
