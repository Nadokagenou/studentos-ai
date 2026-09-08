// ============================================================
// หัวข้อทั่วโลก — ชั้นที่ห้าของบันไดสโคป
// ------------------------------------------------------------
// แนวคิดทั้งหมดอยู่ในหัวไฟล์ของ migration 20260908090200_topics.sql
// สรุปสั้น: ห้องเรียนคือกลุ่มคนที่ **ติดพร้อมกัน** — ได้ใบงานเดียวกัน ส่งวันเดียวกัน
// คืนก่อนส่งจึงไม่มีใครในห้องรู้คำตอบเลยสักคน · คนที่ตอบได้คือคนที่ผ่านมันไปแล้ว
// และปฏิทินเขาไม่ตรงกับเรา ซึ่งมีอยู่เสมอถ้าขอบเขตคือทั้งโลก
//
// สามอย่างที่ไฟล์นี้ทำ:
//   1) แถวใต้การ์ดงาน (ต่อจากแถวห้องการบ้าน) — พาไปหาหัวข้อของงานชิ้นนั้น
//   2) จอหัวข้อ — คำถามที่คนทั้งโลกเคยถามเรื่องนี้ เรียงตาม "อันไหนมีคำตอบแล้ว"
//   3) จอเธรด — คุยกันในคำถามเดียว พร้อมแปลภาษาให้อัตโนมัติ
//
// ---------- เส้นที่ห้ามขยับ ----------
// **ไม่มีแท็บสำรวจ** ทางเข้ามีสองทางเท่านั้น คือจากการ์ดงาน กับจากรูปที่เพิ่งถ่าย
// รายการให้ไถดูเรื่อย ๆ คือสิ่งที่ทำให้มันกลายเป็นแอปโซเชียลอีกตัว
// ซึ่งนักเรียนมีอยู่แล้วสามตัวและไม่มีเหตุผลจะย้ายมาใช้ตัวที่สี่
// ============================================================

const TOPIC_LANG = 'th';          // ภาษาของคนใช้แอปนี้ · ใช้ตัดสินว่าต้องแปลอะไรบ้าง

let topicNow = null;              // ก้อนจาก topic_open
let topicErr = null;
let topicBusy = false;
let tthread = null;               // ก้อนจาก topic_thread
let tthreadErr = null;
let tthreadSub = null;
let topicPick = null;             // ผลจากการเดาหัวข้อ ตอนที่ยังไม่ชัดพอจะเปิดเลย
let topicFrom = 'scr-tasks';      // กดกลับแล้วต้องกลับไปที่เดิม ไม่ใช่กลับหน้าแรกเสมอ

// คำแปลที่ได้มาแล้ว · คีย์คือข้อความต้นฉบับ ไม่ใช่ id ของแถว
// เพราะข้อความเดียวกันโผล่ได้หลายที่ (คำถามในรายการ กับ คำถามในเธรด)
// แปลรอบเดียวแล้วใช้ได้ทั้งสองที่ และไม่หายเมื่อกดเข้าออก
const trCache = new Map();
let trBusy = false;
let showSrc = {};                 // id -> true = ผู้ใช้กด "ดูต้นฉบับ" ของชิ้นนั้น

// ---------- สวิตช์ ----------
// ใช้สวิตช์ตัวเดียวกับห้องการบ้าน (state.settings.social.hw) โดยตั้งใจ:
// ทั้งสองอย่างส่งของชิ้นเดียวกันออกจากเครื่อง — "ฉันมีงานวิชานี้ ยังไม่เสร็จ"
// ถามซ้ำสองรอบสำหรับของชิ้นเดียวกันคือการถามที่ไม่ได้ให้ทางเลือกอะไรเพิ่ม
function topicOn() {
  return typeof hwOn === 'function' ? hwOn() : false;
}

// ============================================================
// แถวใต้การ์ดงาน
// ------------------------------------------------------------
// ขึ้นต่อจากแถวห้องการบ้าน และขึ้นเฉพาะงานที่ยังไม่เสร็จและมีวิชา
// ต่างกันตรงที่แถวห้องการบ้านตอบว่า "ใครยังไม่เสร็จเหมือนเรา"
// ส่วนแถวนี้ตอบว่า "ใครเคยผ่านเรื่องนี้มาแล้ว" — คนละกลุ่มคนกันคนละเรื่อง
// ============================================================
function topicStrip(t) {
  if (!t || t.done || !sb || !currentUser || !topicOn()) return '';
  const subj = (t.subject || '').trim();
  if (!subj || subj === 'อื่น ๆ') return '';
  return `<div class="tp-strip" onclick="event.stopPropagation();openTopicForTask('${esc(t.id)}')">
    <span class="tp-strip-ic">${icon('sparkles')}</span>
    <span class="tp-strip-tx">ถามคนที่ผ่านเรื่องนี้มาแล้ว</span>
    <span class="tp-strip-go">${icon('chevron')}</span>
  </div>`;
}

// ============================================================
// "มีคนตอบคำถามที่คุณถามไว้"
// ------------------------------------------------------------
// สิ่งที่ครูของผู้ใช้อยากได้คือ "ช่วยให้นักเรียนไม่ลืม แล้วมีแจ้งเตือน" — ข้อนั้นใช้กับชั้นนี้ตรง ๆ
// คนถามตอนตีหนึ่ง คำตอบมาถึงตอนบ่ายสามของอีกซีกโลก ถ้าไม่มีอะไรบอก
// คำตอบที่ดีที่สุดในแอปจะไม่มีวันถูกอ่าน และเขาจะจำไม่ได้ด้วยซ้ำว่าเคยถามอะไรไว้
//
// แถวนี้ขึ้นบนสุดของรายการงาน ไม่ใช่ในหน้าอื่น — เพราะจอที่นักเรียนเปิดทุกวันคือจอนั้น
// ของที่อยู่ในจอที่ต้องเดินไปหา เท่ากับของที่ไม่มีอยู่
let topicNews = [];
let topicNewsAt = 0;

async function loadTopicNews(force) {
  if (!sb || !currentUser || !topicOn()) { topicNews = []; return; }
  if (!force && Date.now() - topicNewsAt < 120000) return;   // เช็คอย่างมากทุก 2 นาที
  topicNewsAt = Date.now();
  const { data, error } = await sb.rpc('topic_news');
  if (error) return;                        // เงียบ ๆ — แถวนี้เป็นของแถม ไม่ใช่ของหลัก
  topicNews = data || [];
  if (typeof renderTasks === 'function') renderTasks();
  if (typeof renderHome === 'function') renderHome();
}

function topicNewsCard() {
  if (!topicNews.length) return '';
  const n = topicNews.length;
  const first = topicNews[0];
  return `<div class="tp-news" onclick="openTThread('${esc(first.id)}')">
    <span class="tp-news-ic">${icon('bell')}</span>
    <div class="tp-news-bd">
      <b>${n === 1 ? 'มีคนตอบคำถามที่คุณถามไว้' : `มีคำตอบใหม่ ${n} เธรด`}</b>
      <i>${esc(first.topic_name || '')} · ${esc(String(first.body || '').slice(0, 48))}</i>
    </div>
    <span class="tp-news-go">${icon('chevron')}</span>
  </div>`;
}

// เปิดเธรดเมื่อไหร่ = อ่านแล้ว · เขียนเวลาไว้ที่เดียวแล้วล้างแถวออกจากจอทันที
// ไม่รอรอบถัดไป เพราะป้ายที่ยังค้างอยู่หลังกดอ่านแล้วอ่านเหมือนแอปพัง
async function markTopicSeen() {
  if (!sb || !currentUser) return;
  topicNews = [];
  topicNewsAt = 0;
  try { await sb.rpc('topic_seen'); } catch (_) {}
  if (typeof renderTasks === 'function') renderTasks();
}

// ============================================================
// หาหัวข้อของงานชิ้นหนึ่ง
// ------------------------------------------------------------
// ถาม SQL ก่อนเสมอ (topic_pick จับคำจาก aliases) เพราะมันเร็ว ฟรี และทำงานได้
// แม้ยังไม่ได้ตั้ง secret ของ Gemini — ฟีเจอร์ที่ต้องรอ secret ถึงจะขยับ
// คือฟีเจอร์ที่เงียบสนิทในวันที่ยังไม่ได้ตั้ง ซึ่งอ่านเหมือนแอปพัง
// ============================================================
async function openTopicForTask(taskId) {
  if (!sb || !currentUser) return;
  const list = typeof liveTasks === 'function' ? liveTasks() : (state.tasks || []);
  const t = list.find(x => String(x.id) === String(taskId));
  if (!t) return;

  topicFrom = curScreen || 'scr-tasks';
  topicPick = null;
  const { data, error } = await sb.rpc('topic_pick', {
    p_subject: (t.subject || '').trim() || null,
    p_title: (t.detail || t.title || '') || null,
  });
  if (error) { showToast({ title: 'หาหัวข้อไม่ได้', body: error.message }); return; }

  const rows = data || [];
  const best = rows[0];
  // ตรงชัดพอ (โดนคำสำคัญอย่างน้อยสองคำ) ก็เข้าไปเลย ไม่ต้องถาม
  // ถามทุกครั้งคือการเพิ่มขั้นตอนให้คนที่รู้อยู่แล้วว่าตัวเองติดเรื่องอะไร
  if (best && best.hits >= 2) return openTopic(best.id);
  if (!rows.length) {
    showToast({ title: 'ยังไม่มีหัวข้อของวิชานี้',
      body: 'ลองพิมพ์ชื่อเรื่องที่ติดในช่องค้นหาดู' });
    return;
  }
  topicPick = { rows, subject: (t.subject || '').trim(), title: t.detail || '' };
  go('scr-topic');
  renderTopic();
}

// ---------- เลือกหัวข้อจากรูป ----------
// ใช้ Edge Function topic-match · ถ้ายังไม่ได้ตั้ง secret มันถอยไปจับคำให้เอง
// ฝั่งนี้จึงไม่ต้องรู้เลยว่าหลังบ้านตั้งค่าไว้หรือยัง
async function topicFromImage(blob, subject) {
  if (!sb || !currentUser) return null;
  const b64 = await blobToB64(blob);
  const { data, error } = await sb.functions.invoke('topic-match', {
    body: { image: b64, mime: 'image/jpeg', subject: subject || null },
  });
  if (error) return null;
  return data && data.topic ? data : null;
}
// ---------- ทางเข้าที่สอง: จากรูปในหน้าเขียนโพสต์ ----------
// คนที่แนบรูปโจทย์มาแล้วคือคนที่มีของอยู่ในมือครบแล้ว เหลือแค่เลือกว่าจะถามใคร
// ถามในห้อง (โพสต์) หรือถามคนที่ผ่านเรื่องนี้มาแล้ว (หัวข้อ) — เป็นคนละกลุ่มคนกัน
async function topicFromCompose() {
  const btn = document.getElementById('cpTopic');
  if (!composeImg || !composeImg.blob) return;
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังอ่านรูป…'; }
  const subjBtn = document.querySelector('#cpSubj .cp-chip.on');
  let r = null;
  try {
    r = await topicFromImage(composeImg.blob, subjBtn ? subjBtn.dataset.subj : null);
  } catch (_) { r = null; }
  if (btn) { btn.disabled = false; btn.innerHTML = icon('sparkles') + 'ถามคนทั้งโลกจากรูปนี้แทน'; }

  topicFrom = 'scr-compose';
  // มั่นใจไม่พอก็ไม่เปิดเลย — เปิดหัวข้อผิดแล้วให้เขาถามลงไปในนั้น แปลว่าคำถาม
  // ไปนั่งอยู่ในที่ที่ไม่มีคนที่ตอบได้เข้ามาดู ซึ่งแย่กว่าให้เขาเลือกเองหนึ่งครั้ง
  if (r && r.topic && (r.confidence || 0) >= 0.5) return openTopic(r.topic);

  // อ่านไม่ออกหรือไม่มั่นใจ — ให้เลือกเอง ดีกว่าเดาแล้วพาไปผิดที่
  const subj = subjBtn ? subjBtn.dataset.subj : '';
  const { data: picks } = await sb.rpc('topic_pick', {
    p_subject: subj || null, p_title: (document.getElementById('cpText') || {}).value || null,
  });
  topicPick = { rows: picks || [], subject: subj };
  go('scr-topic');
  renderTopic();
}

function blobToB64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || '').replace(/^data:[^,]+,/, ''));
    r.onerror = () => rej(new Error('read'));
    r.readAsDataURL(blob);
  });
}

// ============================================================
// จอหัวข้อ
// ============================================================
async function openTopic(id) {
  if (!sb || !currentUser) return;
  topicPick = null; topicNow = null; topicErr = null; topicBusy = true;
  if (curScreen !== 'scr-topic') topicFrom = curScreen || 'scr-tasks';
  go('scr-topic');
  renderTopic();

  const { data, error } = await sb.rpc('topic_open', { p_topic: id, p_limit: 30 });
  topicBusy = false;
  if (error) topicErr = error.message;
  else if (!data) topicErr = 'ไม่พบหัวข้อนี้';
  else topicNow = data;
  renderTopic();
  if (topicNow) translateSoon((topicNow.threads || []).map(x => x.body), () => renderTopic());
}

async function topicSearch(q) {
  if (!sb || !currentUser) return;
  const s = String(q || '').trim();
  if (s.length < 2) { topicPick = null; renderTopic(); return; }
  const { data } = await sb.rpc('topic_find', { p_q: s, p_limit: 12 });
  topicPick = { rows: (data || []).map(r => ({ ...r, hits: 0 })), q: s };
  renderTopic();
}

function renderTopic() {
  const box = document.getElementById('topicBody');
  if (!box) return;

  const head = (title, sub) => `<div class="tp-top">
    <button class="tp-back" onclick="go('${esc(topicFrom)}')" aria-label="กลับ">${icon('chevron')}</button>
    <div class="tp-who"><b>${esc(title)}</b>${sub ? `<i>${esc(sub)}</i>` : ''}</div>
  </div>`;

  // ---------- โหมดเลือกหัวข้อ ----------
  if (topicPick) {
    box.innerHTML = head('เรื่องไหนที่ติด', topicPick.subject || '')
      + `<div class="tp-search">
          <input id="tpQ" type="search" placeholder="พิมพ์ชื่อเรื่อง เช่น ผังงาน · สมดุลเคมี"
            value="${esc(topicPick.q || '')}"
            oninput="topicSearchSoon(this.value)">
        </div>
        <div class="tp-picks">
          ${topicPick.rows.length
            ? topicPick.rows.map(r => `<button class="tp-pick" onclick="openTopic('${esc(r.id)}')">
                <b>${esc(r.name)}</b>
                ${r.blurb ? `<i>${esc(r.blurb)}</i>` : ''}
                <span class="tp-pick-tag${r.universal ? ' world' : ''}">${
                  r.universal ? 'ทั่วโลก' : 'ในประเทศ'}</span>
              </button>`).join('')
            : '<p class="tp-empty">ไม่เจอหัวข้อที่ตรง — ลองคำสั้นลง เช่น "ลิมิต" แทน "หาลิมิตของฟังก์ชัน"</p>'}
        </div>`;
    return;
  }

  if (topicErr) { box.innerHTML = head('หัวข้อ') + `<p class="tp-empty">${esc(topicErr)}</p>`; return; }
  if (!topicNow) { box.innerHTML = head(topicBusy ? 'กำลังเปิดหัวข้อ…' : 'หัวข้อ'); return; }

  const th = topicNow.threads || [];
  const world = !!topicNow.universal;

  box.innerHTML = head(topicNow.name, topicNow.subject) + `
    <div class="tp-hero">
      <span class="tp-tag${world ? ' world' : ''}">${icon(world ? 'users' : 'pin')}${
        world ? 'ถามได้ทั้งโลก' : 'เฉพาะในประเทศ'}</span>
      ${topicNow.blurb ? `<p class="tp-blurb">${esc(topicNow.blurb)}</p>` : ''}
      ${world
        ? `<p class="tp-fine">คนที่ตอบคือคนที่ผ่านเรื่องนี้ไปแล้ว — ตอนนี้ดึกที่ไทย
             แต่เป็นกลางวันของอีกครึ่งโลก</p>`
        : `<p class="tp-fine">วิชานี้เป็นของหลักสูตรไทย หัวข้อจึงอยู่ในประเทศเท่านั้น</p>`}
    </div>

    <button class="tp-ask" onclick="openTopicAsk()">
      ${icon('pencil')}<span>ถามในหัวข้อนี้</span>
    </button>

    <div class="tp-list">
      ${th.length
        ? th.map(topicThreadCard).join('')
        : `<div class="tp-blank">
             <div class="tp-blank-ic">${icon('chat')}</div>
             <p class="tp-blank-h">ยังไม่มีใครถามเรื่องนี้</p>
             <p class="tp-blank-p">คำถามแรกมักเป็นตัวที่ทำให้คนอื่นกล้าถามตาม —
               และถ้าไม่มีใครตอบใน 10 นาที น้องไซจะเข้ามาช่วยก่อน</p>
           </div>`}
    </div>`;
}

// พิมพ์แล้วค่อยยิง — พิมพ์ทีละตัวอักษรแล้วยิงทุกตัวคือเน็ตของเด็ก
let tpQTimer = null;
function topicSearchSoon(v) {
  clearTimeout(tpQTimer);
  tpQTimer = setTimeout(() => topicSearch(v), 350);
}

function topicThreadCard(x) {
  const body = trShow(x.body, x.id);
  const foreign = x.lang && x.lang !== TOPIC_LANG;
  const av = x.avatar
    ? `<img class="tp-av" src="${esc(x.avatar)}" alt="">`
    : `<div class="tp-av"${x.name ? ` style="${typeof avOf === 'function' ? avOf(x.name) : ''}"` : ''}>${
        esc((x.name || '?').slice(0, 1))}</div>`;
  return `<article class="tp-card${x.answers ? ' has' : ''}" onclick="openTThread('${esc(x.id)}')">
    <div class="tp-card-h">
      ${av}
      <div class="tp-card-who">
        <b>${esc(x.name || 'ไม่ระบุชื่อ')}${x.mine ? '<span class="tp-mine">คุณ</span>' : ''}</b>
        <i>${x.near && !x.mine ? '<span class="tp-near">ในไทย</span>' : ''}${esc(flagOf(x.country))}${
          x.at && typeof ago === 'function' ? ' · ' + esc(ago(x.at)) : ''}</i>
      </div>
      ${x.solved ? `<span class="tp-solved">${icon('check')}เคลียร์แล้ว</span>` : ''}
    </div>
    <p class="tp-card-b">${esc(body.text)}</p>
    ${foreign ? trNote(x.id, body) : ''}
    <div class="tp-card-f">
      <span>${icon('chat')}${x.answers ? x.answers + ' คำตอบ' : 'ยังไม่มีใครตอบ'}</span>
    </div>
  </article>`;
}

// ---------- ธงประเทศแบบไม่ใช้อีโมจิ ----------
// อีโมจิธงเรนเดอร์ไม่เหมือนกันเลยข้ามเครื่อง (Windows ไม่มีธงให้เลยสักอัน)
// ตัวอักษรสองตัวอ่านออกทุกที่และไม่มีวันกลายเป็นสี่เหลี่ยมว่าง
function flagOf(cc) {
  const c = String(cc || 'TH').toUpperCase();
  const named = { TH: 'ไทย', BR: 'บราซิล', ID: 'อินโดนีเซีย', VN: 'เวียดนาม',
    IN: 'อินเดีย', DE: 'เยอรมนี', JP: 'ญี่ปุ่น', KR: 'เกาหลี', PH: 'ฟิลิปปินส์',
    US: 'สหรัฐฯ', GB: 'อังกฤษ', MY: 'มาเลเซีย', SG: 'สิงคโปร์', CN: 'จีน' };
  return named[c] || c;
}

// ============================================================
// ถามในหัวข้อ
// ============================================================
function openTopicAsk() {
  if (!topicNow) return;
  const box = document.getElementById('topicBody');
  if (!box) return;
  const sheet = document.createElement('div');
  sheet.className = 'tp-sheet';
  sheet.id = 'tpSheet';
  sheet.innerHTML = `<div class="tp-sheet-card" role="dialog" aria-label="ถามในหัวข้อนี้">
    <div class="tp-sheet-h">ถามเรื่อง${esc(topicNow.name)}</div>
    <textarea id="tpAsk" rows="4" maxlength="1000"
      placeholder="ติดตรงไหน เขียนให้คนที่ไม่เห็นใบงานของเราเข้าใจได้ — เช่น ไล่ผังงานถึงกล่องเงื่อนไขแล้วไม่รู้ว่าเส้นไหนคือใช่"></textarea>
    <label class="tp-anon"><input type="checkbox" id="tpAnon">
      <span>ไม่ระบุชื่อ</span></label>
    <div class="tp-sheet-row">
      <button class="tp-no" onclick="closeTopicAsk()">ยกเลิก</button>
      <button class="tp-yes" id="tpAskGo" onclick="sendTopicAsk()">ถามเลย</button>
    </div>
  </div>`;
  box.appendChild(sheet);
  const ta = document.getElementById('tpAsk');
  if (ta) ta.focus();
}
function closeTopicAsk() {
  const s = document.getElementById('tpSheet');
  if (s) s.remove();
}
async function sendTopicAsk() {
  const ta = document.getElementById('tpAsk');
  const btn = document.getElementById('tpAskGo');
  if (!ta || !topicNow) return;
  const body = ta.value.trim();
  if (body.length < 2) { showToast({ title: 'ยังไม่ได้เขียนอะไร', body: 'เขียนสักบรรทัดก่อนนะ' }); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังส่ง…'; }
  const { data, error } = await sb.rpc('topic_ask', {
    p_topic: topicNow.id, p_body: body, p_lang: TOPIC_LANG,
    p_anon: !!(document.getElementById('tpAnon') || {}).checked,
  });
  if (btn) { btn.disabled = false; btn.textContent = 'ถามเลย'; }
  if (error) { showToast({ title: 'ถามไม่สำเร็จ', body: error.message }); return; }
  if (typeof haptic === 'function') haptic('done');
  closeTopicAsk();
  await openTopic(topicNow.id);
  if (data) openTThread(data);
}

// ============================================================
// จอเธรด
// ============================================================
async function openTThread(id) {
  if (!sb || !currentUser) return;
  tthread = null; tthreadErr = null;
  go('scr-tthread');
  renderTThread();
  markTopicSeen();

  const { data, error } = await sb.rpc('topic_thread', { p_thread: id });
  if (error) tthreadErr = error.message;
  else if (!data) tthreadErr = 'ไม่พบเธรดนี้';
  else tthread = data;
  renderTThread();

  if (tthread) {
    const src = [tthread.body].concat((tthread.msgs || []).map(m => m.body));
    translateSoon(src, () => renderTThread());
  }

  // ข้อความใหม่เด้งเข้าเอง — เธรดที่ต้องปัดลงรีเฟรชคือเธรดที่ไม่มีใครรู้สึกว่ามีคนอยู่
  closeTThread();
  tthreadSub = sb.channel('tp:' + id)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'topic_msgs', filter: 'thread=eq.' + id },
      p => {
        if (!tthread || !p.new) return;
        if ((tthread.msgs || []).some(m => String(m.id) === String(p.new.id))) return;
        tthread.msgs = (tthread.msgs || []).concat([{
          id: p.new.id, body: p.new.body, lang: p.new.lang, ai: p.new.is_ai,
          mine: p.new.author === currentUser.id,
          name: p.new.is_ai ? 'น้องไซ' : 'เพื่อนร่วมหัวข้อ',
          avatar: null, at: p.new.created_at,
        }]);
        renderTThread();
        translateSoon([p.new.body], () => renderTThread());
      })
    .subscribe();
}

// ต้องเรียกทุกครั้งที่ออกจากจอ — ช่องที่เปิดค้างกินโควตา realtime ซึ่งนับจำนวนช่อง
// ที่เปิดพร้อมกัน ไม่ใช่จำนวนข้อความ (บทเรียนเดียวกับ closeChat และ closeHwRoom)
function closeTThread() {
  if (tthreadSub) { try { sb.removeChannel(tthreadSub); } catch (_) {} tthreadSub = null; }
}

function renderTThread() {
  const box = document.getElementById('tthreadBody');
  if (!box) return;

  const backTo = topicNow ? 'scr-topic' : topicFrom;
  const head = (title, sub) => `<div class="tp-top">
    <button class="tp-back" onclick="go('${esc(backTo)}')" aria-label="กลับ">${icon('chevron')}</button>
    <div class="tp-who"><b>${esc(title)}</b>${sub ? `<i>${esc(sub)}</i>` : ''}</div>
  </div>`;

  if (tthreadErr) { box.innerHTML = head('เธรด') + `<p class="tp-empty">${esc(tthreadErr)}</p>`; return; }
  if (!tthread) { box.innerHTML = head('กำลังเปิด…'); return; }

  const q = trShow(tthread.body, tthread.id);
  const qForeign = tthread.lang && tthread.lang !== TOPIC_LANG;
  const msgs = tthread.msgs || [];

  box.innerHTML = head(tthread.topic_name || 'เธรด', flagOf(tthread.country)) + `
    <div class="tp-q">
      <div class="tp-q-who">
        <b>${esc(tthread.name || 'ไม่ระบุชื่อ')}</b>
        <i>${esc(flagOf(tthread.country))}${tthread.at && typeof ago === 'function'
            ? ' · ' + esc(ago(tthread.at)) : ''}</i>
        <!-- ปุ่มรายงานต้องอยู่ในทุกจอที่มีคนแปลกหน้า ไม่มีข้อยกเว้น
             จอที่ลืมใส่คือจอที่คนโดนกวนแล้วไม่มีอะไรทำได้นอกจากปิดแอปทิ้ง -->
        ${tthread.mine ? '' : `<button class="tp-flag" aria-label="รายงานคำถามนี้"
          onclick="openReport('topic','${esc(tthread.id)}')">${icon('flag')}</button>`}
      </div>
      <p class="tp-q-b">${esc(q.text)}</p>
      ${qForeign ? trNote(tthread.id, q) : ''}
      ${tthread.image ? `<img class="tp-q-img" loading="lazy" alt="รูปโจทย์ที่แนบมา"
          src="${esc(typeof postImageUrl === 'function' ? postImageUrl(tthread.image) : tthread.image)}">` : ''}
      ${tthread.mine ? `<button class="tp-mark${tthread.solved ? ' on' : ''}"
        onclick="markTSolved(${tthread.solved ? 'false' : 'true'})">
        ${icon('check')}${tthread.solved ? 'เคลียร์แล้ว' : 'อันนี้ช่วยได้ ปิดเธรด'}</button>` : ''}
    </div>

    <div class="tp-msgs" id="tpMsgs">
      ${msgs.length
        ? msgs.map(m => {
            const b = trShow(m.body, 'm' + m.id);
            const f = m.lang && m.lang !== TOPIC_LANG;
            return `<div class="tp-msg${m.mine ? ' me' : ''}${m.ai ? ' ai' : ''}">
              <div class="tp-bub">
                ${m.mine ? '' : `<span class="tp-nm">${esc(m.name || 'นักเรียน')}${
                  m.ai ? '<em>AI</em>' : ''}
                  ${m.ai ? '' : `<button class="tp-flag" aria-label="รายงานคำตอบนี้"
                    onclick="openReport('tmsg','${esc(String(m.id))}')">${icon('flag')}</button>`}
                </span>`}
                ${esc(b.text)}
                ${f ? trNote('m' + m.id, b) : ''}
              </div>
            </div>`;
          }).join('')
        : `<p class="tp-empty">ยังไม่มีใครตอบ<br>ถ้าเงียบครบสิบนาที น้องไซจะเข้ามาช่วยก่อน
             แล้วค่อยรอคนที่ผ่านเรื่องนี้มาแล้ว</p>`}
    </div>

    <div class="tp-bar">
      <input id="tpIn" type="text" maxlength="2000" placeholder="ตอบ หรือถามต่อ"
             onkeydown="if(event.key==='Enter')sayTopic()">
      <button class="tp-send" onclick="sayTopic()" aria-label="ส่ง">${icon('check')}</button>
    </div>`;

  const list = document.getElementById('tpMsgs');
  if (list) list.scrollTop = list.scrollHeight;
}

async function sayTopic() {
  const el = document.getElementById('tpIn');
  if (!el || !tthread) return;
  const body = el.value.trim();
  if (!body) return;
  el.value = '';
  const { data, error } = await sb.rpc('topic_say', {
    p_thread: tthread.id, p_body: body, p_lang: TOPIC_LANG,
  });
  if (error) {
    el.value = body;                       // คืนข้อความให้ ไม่ใช่กลืนหายไปเฉย ๆ
    if (typeof haptic === 'function') haptic('snooze');
    showToast({ title: 'ส่งไม่สำเร็จ', body: error.message });
    return;
  }
  const row = Array.isArray(data) ? data[0] : data;
  tthread.msgs = (tthread.msgs || []).concat([{
    id: (row && row.id) || Date.now(), body, lang: TOPIC_LANG, ai: false, mine: true,
    name: (state.settings.name || '').trim() || 'ฉัน',
    avatar: state.settings.avatar || null,
    at: (row && row.created_at) || new Date().toISOString(),
  }]);
  renderTThread();
}

async function markTSolved(on) {
  if (!tthread) return;
  const { error } = await sb.rpc('topic_solved', { p_thread: tthread.id, p_on: !!on });
  if (error) { showToast({ title: 'ทำไม่สำเร็จ', body: error.message }); return; }
  tthread.solved = !!on;
  renderTThread();
}

// ============================================================
// แปลภาษา
// ------------------------------------------------------------
// ข้อความต้นฉบับไม่เคยถูกทิ้ง — เก็บไว้ทั้งคู่แล้วให้ผู้ใช้สลับดูได้
// เพราะวันที่โมเดลแปลเพี้ยน คนอ่านต้องมีทางเห็นว่าจริง ๆ เขาเขียนว่าอะไร
//
// ถ้ายังไม่ได้ตั้ง secret ฝั่งหลังบ้าน ฟังก์ชันคืน 501 แล้วเราก็โชว์ต้นฉบับต่อไป
// ไม่มีอะไรพัง ไม่มีช่องว่าง แค่ไม่มีคำแปล
// ============================================================
function trShow(src, id) {
  const s = String(src || '');
  const tr = trCache.get(s);
  if (!tr || showSrc[id]) return { text: s, translated: false, has: !!tr };
  return { text: tr, translated: true, has: true };
}
function trNote(id, shown) {
  if (!shown.has) {
    return `<span class="tp-tr off">${icon('unplug')}ยังแปลไม่ได้ — นี่คือต้นฉบับ</span>`;
  }
  return `<button class="tp-tr" onclick="event.stopPropagation();toggleSrc('${esc(String(id))}')">
    ${shown.translated ? 'แปลอัตโนมัติ · ดูต้นฉบับ' : 'กำลังดูต้นฉบับ · ดูคำแปล'}</button>`;
}
function toggleSrc(id) {
  showSrc[id] = !showSrc[id];
  renderTopic();
  renderTThread();
}

// รวบข้อความทั้งจอยิงรอบเดียว ไม่ใช่ยิงทีละฟองข้อความ
// สี่สิบข้อความ = สี่สิบคำขอ = โควตาหมดในเธรดเดียว
async function translateSoon(list, after) {
  if (trBusy || !sb || !currentUser) return;
  const need = [];
  for (const s of (list || [])) {
    const v = String(s || '');
    if (!v || trCache.has(v)) continue;
    if (looksThai(v)) { trCache.set(v, v); continue; }   // ไทยอยู่แล้ว ไม่ต้องแปล
    if (!need.includes(v)) need.push(v);
  }
  if (!need.length) return;
  trBusy = true;
  try {
    const { data, error } = await sb.functions.invoke('translate', {
      body: { texts: need.slice(0, 40), to: TOPIC_LANG },
    });
    if (!error && data && Array.isArray(data.out)) {
      data.out.forEach((v, i) => { if (v) trCache.set(need[i], v); });
    }
  } catch (_) { /* แปลไม่ได้ไม่ใช่เหตุผลที่จะทำให้ทั้งจอพัง */ }
  trBusy = false;
  if (typeof after === 'function') after();
}

// เดาว่าข้อความเป็นไทยหรือยัง — ประหยัดกว่าถามเซิร์ฟเวอร์ว่าภาษาอะไร
// และ 99% ของข้อความในแอปนี้เป็นไทยอยู่แล้ว
function looksThai(s) {
  const t = String(s || '');
  let thai = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c >= 0x0e00 && c <= 0x0e7f) thai++;
  }
  return thai >= Math.max(2, t.replace(/\s/g, '').length * 0.2);
}
