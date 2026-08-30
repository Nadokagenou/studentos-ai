// ============================================================
// ฟีด — โพสต์ · ตอบเป็นเธรด · ใครออนไลน์อยู่ตอนนี้
// ------------------------------------------------------------
// ของเดิมเป็น "รายชื่อเพื่อน" ซึ่งเป็นของนิ่ง เปิดวันนี้กับพรุ่งนี้เห็นเหมือนกันเป๊ะ
// จึงไม่มีเหตุผลให้เปิดซ้ำ · ฟีดเปลี่ยนทุกครั้งที่เปิด นั่นคือสิ่งที่ทำให้คนกลับมา
//
// ต่างจาก IG ตรงที่ IG เรียงตามความนิยม เราเรียงตาม "ใครช่วยใครได้"
// โพสต์ถามเลขที่ยังไม่มีใครตอบ จะถูกดันขึ้นบนสุดให้คนที่เก่งเลขเห็นก่อน (ดู feed() ใน SQL)
// รายชื่อเพื่อนกับตัวจับคู่ไม่ได้หายไป มันย้ายไปเป็นเครื่องยนต์ที่จัดลำดับฟีดแทน
// ============================================================

const FEED_SCOPES = [
  { id: 'all',    name: 'ทั้งหมด' },
  { id: 'room',   name: 'ห้องฉัน' },
  { id: 'school', name: 'โรงเรียน' },
];

let feedScope = 'all';
let feedRows = null;      // null = ยังไม่เคยโหลด
let feedErr = null;
let feedBusy = false;
let feedFresh = 0;        // จำนวนโพสต์ใหม่ที่เข้ามาระหว่างที่เปิดค้างอยู่
let feedSub = null;
let onlineNow = [];       // คนที่กำลังเปิดแอปอยู่ตอนนี้
let presenceSub = null;

// ---------- เวลาแบบ "4 นาทีที่แล้ว" ----------
// วันที่เต็ม ๆ ทำให้ฟีดอ่านเหมือนเอกสาร · เวลาสัมพัทธ์ทำให้มันอ่านเหมือนของที่เพิ่งเกิด
// ซึ่งเป็นครึ่งหนึ่งของความรู้สึกว่าฟีด "มีชีวิต"
function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'เมื่อกี้';
  if (s < 3600) return Math.round(s / 60) + ' นาทีที่แล้ว';
  if (s < 86400) return Math.round(s / 3600) + ' ชม.ที่แล้ว';
  if (s < 604800) return Math.round(s / 86400) + ' วันก่อน';
  return fmtThaiDate(new Date(iso));
}


// ---------- สีประจำตัวจากชื่อ ----------
// ฟีดที่ทุกวงกลมสีเดียวกันหมดอ่านเป็น "ตาราง" ไม่ใช่ "คน"
// IG ดูมีชีวิตส่วนหนึ่งเพราะหน้าคนไม่ซ้ำกัน เราไม่มีรูปหน้าทุกคน จึงใช้สีแทน
// สีมาจากชื่อ แปลว่าคนเดิมได้สีเดิมทุกที่ในแอป ไม่ใช่สุ่มใหม่ทุกครั้งที่วาด
function hueOf(name) {
  let h = 0;
  const s = String(name || '?');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function avStyle(name) {
  const h = hueOf(name);
  return `background:hsl(${h} 62% 88%);color:hsl(${h} 58% 30%)`;
}
function avStyleDark(name) {
  const h = hueOf(name);
  return `background:hsl(${h} 38% 26%);color:hsl(${h} 70% 82%)`;
}
// ธีมมืดต้องใช้อีกชุด ไม่งั้นตัวหนังสือเข้มบนพื้นอ่อนจะแสบตากลางฟีดสีดำ
function avOf(name) {
  const dark = getComputedStyle(document.documentElement)
    .getPropertyValue('color-scheme').trim() === 'dark'
    || matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? avStyleDark(name) : avStyle(name);
}

// ============================================================
// โหลดฟีด
// ============================================================
async function loadFeed(scope) {
  if (scope) feedScope = scope;
  if (!sb || !currentUser) { feedErr = 'ยังไม่ได้ล็อกอิน'; renderFeed(); return; }
  feedBusy = true; feedFresh = 0; renderFeed();
  const { data, error } = await sb.rpc('feed', { p_scope: feedScope, p_limit: 30 });
  feedBusy = false;
  if (error) { feedErr = error.message; feedRows = null; }
  else { feedErr = null; feedRows = data || []; }
  renderFeed();
}

// โพสต์ใหม่ไม่แทรกเข้ากลางหน้าที่กำลังอ่านอยู่ — ขึ้นเป็นปุ่ม "มีโพสต์ใหม่" ให้กดเอง
// ของที่ขยับเองใต้นิ้วระหว่างอ่านคือของที่น่ารำคาญ ไม่ใช่ของที่น่าตื่นเต้น
function watchFeed() {
  unwatchFeed();
  if (!sb || !currentUser) return;
  feedSub = sb.channel('feed-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, p => {
      if (p.new && p.new.author === currentUser.id) return;   // ของตัวเองที่เพิ่งโพสต์
      feedFresh++;
      renderFreshPill();
    })
    .subscribe();
}
function unwatchFeed() {
  if (feedSub) { try { sb.removeChannel(feedSub); } catch (_) {} feedSub = null; }
}

// ---------- ใครเปิดแอปอยู่ตอนนี้ ----------
// IG บอกได้แค่ "active now" · เราบอกได้ว่ากำลังติววิชาอะไรอยู่ เพราะ runningWork() รู้จริง
// นี่คือของที่คู่แข่งลอกไม่ได้ เพราะเขาไม่มีข้อมูลตัวนี้ตั้งแต่แรก
function watchPresence() {
  unwatchPresence();
  if (!sb || !currentUser) return;
  const ch = sb.channel('who-online', { config: { presence: { key: currentUser.id } } });
  ch.on('presence', { event: 'sync' }, () => {
    const st = ch.presenceState();
    onlineNow = Object.keys(st)
      .map(k => (st[k] && st[k][0]) || null)
      .filter(x => x && x.id !== currentUser.id);
    renderOnline();
  }).subscribe(async status => {
    if (status !== 'SUBSCRIBED') return;
    await ch.track(presenceCard());
  });
  presenceSub = ch;
  // สถานะเปลี่ยนได้ระหว่างเปิดค้าง (เริ่ม/หยุดจับเวลา) จึงต้องส่งใหม่เป็นระยะ
  clearInterval(watchPresence._t);
  watchPresence._t = setInterval(() => {
    if (presenceSub) presenceSub.track(presenceCard()).catch(() => {});
  }, 45000);
}
function presenceCard() {
  let subject = null, since = null;
  try {
    const r = typeof runningWork === 'function' ? runningWork() : null;
    if (r) {
      const t = (state.tasks || []).find(x => x.id === r.taskId);
      subject = (t && t.subject) || null;
      since = r.start || null;
    }
  } catch (_) {}
  return {
    id: currentUser.id,
    name: (state.settings.name || '').trim() || 'นักเรียน',
    avatar: state.settings.avatar || null,
    subject, since,
  };
}
function unwatchPresence() {
  clearInterval(watchPresence._t);
  if (presenceSub) { try { sb.removeChannel(presenceSub); } catch (_) {} presenceSub = null; }
  onlineNow = [];
}

// ============================================================
// วาดฟีด
// ============================================================
function renderFeed() {
  const box = document.getElementById('feedBody');
  if (!box) return;

  box.innerHTML = `
    <div class="fd-top">
      <h1 class="fd-title">เพื่อนร่วมห้อง</h1>
      <button class="fd-people" onclick="go('scr-people'); renderMates()" aria-label="วิชาของฉันกับคนในห้อง">
        ${icon('users')}
      </button>
    </div>

    <div class="fd-scopes" role="tablist">
      ${FEED_SCOPES.map(s => `<button role="tab" class="fd-scope${s.id === feedScope ? ' on' : ''}"
        aria-selected="${s.id === feedScope}"
        onclick="loadFeed('${s.id}')">${esc(s.name)}</button>`).join('')}
    </div>

    <div id="onlineRow"></div>
    ${currentUser ? composerHTML() : ''}
    <div id="freshPill"></div>
    <div id="feedList">${feedListHTML()}</div>`;

  renderOnline();
  renderFreshPill();
}

// ---------- แถวคนออนไลน์ ----------
// วงกลมเรียงแนวนอนแบบสตอรี่ แต่ข้างในไม่ใช่รูปที่โพสต์ไว้ — เป็นคนที่เปิดแอปอยู่จริงตอนนี้
function renderOnline() {
  const el = document.getElementById('onlineRow');
  if (!el) return;
  if (!currentUser || !onlineNow.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="fd-online">
    ${onlineNow.slice(0, 12).map(u => {
      const busy = !!u.subject;
      const av = u.avatar
        ? `<img src="${esc(u.avatar)}" alt="">`
        : `<span>${esc((u.name || '?').slice(0, 1))}</span>`;
      return `<div class="fd-on${busy ? ' busy' : ''}" onclick="openUser('${esc(u.id)}')" role="link" tabindex="0">
        <div class="fd-on-ring"${u.avatar ? '' : ` style="${avOf(u.name)}"`}>${av}</div>
        <div class="fd-on-nm">${esc(u.name || 'นักเรียน')}</div>
        <div class="fd-on-sub">${busy ? esc(u.subject) : 'ออนไลน์'}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderFreshPill() {
  const el = document.getElementById('freshPill');
  if (!el) return;
  el.innerHTML = feedFresh
    ? `<button class="fd-fresh" onclick="loadFeed()">
         ${icon('sparkles')}มีโพสต์ใหม่ ${feedFresh > 9 ? '9+' : feedFresh}</button>`
    : '';
}

function composerHTML() {
  return `<button class="fd-ask" onclick="openCompose()">
    <span class="fd-ask-av">${esc(((state.settings.name || 'น')).slice(0, 1))}</span>
    <span class="fd-ask-tx">ติดตรงไหน ถามเลย…</span>
    <span class="fd-ask-cam">${icon('camera')}</span>
  </button>`;
}

function feedListHTML() {
  if (!currentUser) {
    return `<div class="so-empty">
      <p class="so-empty-h">ล็อกอินเพื่อเห็นฟีด</p>
      <p class="so-empty-p">ฟีดคือของที่คนในห้องเพิ่งโพสต์ — ต้องรู้ว่าใครเป็นใครก่อน
        ถึงจะรู้ว่าโพสต์ไหนควรให้ใครเห็น</p>
      <button class="btn google" onclick="loginFromMates()"><span class="g-badge">G</span>
        เข้าสู่ระบบด้วย Google</button>
    </div>`;
  }
  if (feedBusy && !feedRows) return `<p class="so-hint">กำลังโหลดฟีด…</p>`;
  if (feedErr) return `<p class="so-hint err">เปิดฟีดไม่ได้ — ${esc(feedErr)}
    <button class="so-retry" onclick="loadFeed()">ลองใหม่</button></p>`;
  if (feedRows && !feedRows.length) {
    // สถานะว่างที่บอกแค่ "ไม่มีข้อมูล" ทำให้คนปิดแอป · อันนี้ต้องชวนให้ลงมือ
    // เพราะฟีดที่ว่างแก้ได้ด้วยการที่คนอ่านกลายเป็นคนโพสต์ ซึ่งเป็นสิ่งเดียวที่แก้ได้จริง
    return `<div class="fd-blank">
      <div class="fd-blank-ic">${icon('chat')}</div>
      <p class="fd-blank-h">${feedScope === 'room' ? 'ห้องนี้ยังเงียบอยู่' : 'ยังไม่มีใครโพสต์'}</p>
      <p class="fd-blank-p">โพสต์แรกมักเป็นตัวที่ทำให้คนอื่นกล้าโพสต์ตาม —
        ถามอะไรที่ติดอยู่จริง ๆ ก็ได้ ไม่ต้องคิดนาน</p>
      <button class="fd-blank-go" onclick="openCompose()">เขียนโพสต์แรก</button>
      ${feedScope !== 'all'
        ? `<button class="fd-blank-alt" onclick="loadFeed('all')">หรือดูของทั้งหมดก่อน</button>` : ''}
    </div>`;
  }
  return (feedRows || []).map(postCard).join('');
}

// ---------- การ์ดโพสต์ ----------
function postCard(p) {
  const anon = !p.display_name;
  const name = anon ? 'ไม่ระบุชื่อ' : p.display_name;
  const av = (!anon && p.avatar)
    ? `<img class="fd-av" src="${esc(p.avatar)}" alt="">`
    : `<div class="fd-av${anon ? ' anon' : ''}"${anon ? '' : ` style="${avOf(name)}"`}>${
        anon ? '?' : esc((name || '?').slice(0, 1))}</div>`;

  const tapHead = !anon && p.author;
  return `<article class="fd-post${p.for_me ? ' for-me' : ''}" onclick="openPost('${esc(p.id)}')">
    ${p.for_me ? `<div class="fd-flag">${icon('sparkles')}เขาถามวิชาที่เธอเก่ง</div>` : ''}
    <div class="fd-head${tapHead ? ' tap' : ''}"${!tapHead ? '' :
      ` onclick="event.stopPropagation();openUser('${esc(p.author)}')" role="link" tabindex="0"`}>
      ${av}
      <div class="fd-who">
        <b>${esc(name)}${p.mine ? '<span class="fd-mine">คุณ</span>' : ''}</b>
        <i>${p.subject ? `<span class="fd-subj ${subjClass ? subjClass(p.subject) : ''}">${esc(p.subject)}</span> · ` : ''}${esc(ago(p.created_at))}</i>
      </div>
    </div>
    <p class="fd-body">${esc(p.body)}</p>
    ${p.image ? `<img class="fd-img" src="${esc(postImageUrl(p.image))}" alt="รูปที่แนบมากับโพสต์" loading="lazy">` : ''}
    <div class="fd-foot">
      <span class="fd-reply">${icon('chat')}${p.reply_count ? p.reply_count + ' คำตอบ' : 'ยังไม่มีใครตอบ'}</span>
      ${p.kind === 'help' && !p.reply_count ? '<span class="fd-wait">รออยู่</span>' : ''}
    </div>
  </article>`;
}

function postImageUrl(path) {
  if (!path) return '';
  if (/^https?:/.test(path)) return path;
  try { return sb.storage.from('posts').getPublicUrl(path).data.publicUrl; }
  catch (_) { return ''; }
}

// ============================================================
// เขียนโพสต์
// ============================================================
let composeImg = null;    // { blob, url } — url ไว้โชว์ก่อนส่ง

function openCompose() {
  composeImg = null;
  go('scr-compose');
  renderCompose();
}

function renderCompose() {
  const box = document.getElementById('composeBody');
  if (!box) return;
  const subs = typeof knownSubjects === 'function' ? knownSubjects() : [];
  const scopes = FEED_SCOPES.filter(s => s.id !== 'all')
    .concat([{ id: 'all', name: 'ทุกคนในแอป' }]);

  box.innerHTML = `
    <div class="cp-top">
      <button class="cp-x" onclick="closeCompose()">ยกเลิก</button>
      <b>โพสต์ใหม่</b>
      <button class="cp-send" id="cpSend" onclick="submitPost()">โพสต์</button>
    </div>
    <div class="cp-body">
      <textarea id="cpText" rows="4" maxlength="1000"
        placeholder="ติดตรงไหน เขียนมาเลย — เช่น ข้อ 7 ทำไม่เป็นจริง ๆ ใครพอช่วยได้บ้าง"></textarea>

      ${composeImg ? `<div class="cp-img">
          <img src="${esc(composeImg.url)}" alt="รูปที่จะแนบ">
          <button class="cp-img-x" onclick="dropComposeImg()" aria-label="เอารูปออก">${icon('x')}</button>
        </div>` : ''}

      <button class="cp-add" onclick="document.getElementById('cpFile').click()">
        ${icon('camera')}${composeImg ? 'เปลี่ยนรูป' : 'แนบรูปโจทย์'}
      </button>
      <input type="file" id="cpFile" accept="image/*" hidden onchange="pickComposeImg(this)">

      <p class="cp-lb">วิชา</p>
      <div class="cp-chips" id="cpSubj">
        ${subs.length
          ? subs.map(s => `<button class="cp-chip" data-subj="${esc(s)}"
              onclick="pickCpChip(this,'cpSubj')">${esc(s)}</button>`).join('')
          : '<span class="so-none">ยังไม่มีวิชา — เพิ่มงานสักชิ้นก่อน แล้ววิชาจะมาโผล่ตรงนี้</span>'}
      </div>

      <p class="cp-lb">ให้ใครเห็น</p>
      <div class="cp-chips" id="cpScope">
        ${scopes.map((s, i) => `<button class="cp-chip${i === 0 ? ' on' : ''}" data-scope="${s.id}"
          onclick="pickCpChip(this,'cpScope')">${esc(s.name)}</button>`).join('')}
      </div>

      <!-- ไม่ระบุชื่อ: "ข้อ 7 ทำไม่เป็น" คือการยอมรับว่าตัวเองไม่รอด
           บังคับติดชื่อทุกโพสต์แปลว่าไม่มีใครกล้าถาม ซึ่งฆ่าโพสต์ชนิดที่สำคัญที่สุดในแอปนี้ -->
      <label class="cp-anon">
        <input type="checkbox" id="cpAnon">
        <span><b>ไม่ระบุชื่อ</b><i>เพื่อนจะเห็นแค่คำถาม ไม่เห็นว่าเป็นใคร</i></span>
      </label>
    </div>`;
}

function closeCompose() {
  if (composeImg && composeImg.url) URL.revokeObjectURL(composeImg.url);
  composeImg = null;
  go('scr-mates');
}
function dropComposeImg() {
  if (composeImg && composeImg.url) URL.revokeObjectURL(composeImg.url);
  composeImg = null;
  renderCompose();
}
function pickCpChip(btn, group) {
  const box = document.getElementById(group);
  if (!box) return;
  const was = btn.classList.contains('on');
  box.querySelectorAll('.cp-chip').forEach(b => b.classList.remove('on'));
  // วิชาเลือกแล้วกดซ้ำ = ยกเลิก · ขอบเขตต้องมีเสมอ กดซ้ำจึงไม่ยกเลิก
  if (!(was && group === 'cpSubj')) btn.classList.add('on');
}

// ย่อรูปในเครื่องก่อนส่งเสมอ — รูปจากกล้องมือถือใบละ 3–5 MB
// อัปโหลดดิบ ๆ บนเน็ตโรงเรียนคือรอเป็นนาที แล้วคนก็เลิกโพสต์ไปเลย
async function pickComposeImg(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    const blob = await shrinkImage(file, 1280, 0.72);
    if (composeImg && composeImg.url) URL.revokeObjectURL(composeImg.url);
    composeImg = { blob, url: URL.createObjectURL(blob) };
    renderCompose();
  } catch (_) {
    showToast({ title: 'อ่านรูปไม่ได้', body: 'ลองรูปอื่นดู' });
  }
}
function shrinkImage(file, max, q) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc);
      c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('load')); };
    img.src = url;
  });
}

async function submitPost() {
  const btn = document.getElementById('cpSend');
  const body = (document.getElementById('cpText').value || '').trim();
  if (!body) { showToast({ title: 'ยังไม่ได้เขียนอะไร', body: 'เขียนสักบรรทัดก่อนนะ' }); return; }
  const subjBtn = document.querySelector('#cpSubj .cp-chip.on');
  const scopeBtn = document.querySelector('#cpScope .cp-chip.on');
  const scope = scopeBtn ? scopeBtn.dataset.scope : 'room';
  const anon = !!document.getElementById('cpAnon').checked;

  if (btn) { btn.disabled = true; btn.textContent = 'กำลังโพสต์…'; }

  let imagePath = null;
  if (composeImg) {
    const path = currentUser.id + '/' + Date.now() + '.jpg';
    const up = await sb.storage.from('posts').upload(path, composeImg.blob, { contentType: 'image/jpeg' });
    if (up.error) {
      if (btn) { btn.disabled = false; btn.textContent = 'โพสต์'; }
      showToast({ title: 'อัปโหลดรูปไม่สำเร็จ', body: up.error.message });
      return;
    }
    imagePath = path;
  }

  const row = {
    author: currentUser.id, scope,
    kind: subjBtn ? 'help' : 'chat',
    subject: subjBtn ? subjBtn.dataset.subj : null,
    body, image: imagePath, anon,
  };
  // ขอบเขตต้องมีที่อยู่จริง ไม่งั้น policy ฝั่งเซิร์ฟเวอร์ปฏิเสธ
  if (scope === 'room') row.room_id = await myFirstRoom();
  if (scope === 'school') row.school = await mySchool();

  if (scope === 'room' && !row.room_id) {
    if (btn) { btn.disabled = false; btn.textContent = 'โพสต์'; }
    showToast({ title: 'ยังไม่ได้เข้าห้องเรียน',
      body: 'ต้องกดลิงก์จากกลุ่ม LINE ของห้องก่อน หรือเลือกให้ "ทุกคนในแอป" เห็นแทน' });
    return;
  }
  if (scope === 'school' && !row.school) {
    if (btn) { btn.disabled = false; btn.textContent = 'โพสต์'; }
    showToast({ title: 'ยังไม่ได้กรอกโรงเรียน', body: 'กรอกได้ที่หน้า "วิชาของฉัน"' });
    return;
  }

  const { error } = await sb.from('posts').insert(row);
  if (btn) { btn.disabled = false; btn.textContent = 'โพสต์'; }
  if (error) { showToast({ title: 'โพสต์ไม่สำเร็จ', body: error.message }); return; }

  haptic('done');
  closeCompose();
  loadFeed(scope === 'all' ? 'all' : feedScope);
}

async function myFirstRoom() {
  const { data } = await sb.from('line_links').select('room_id').limit(1);
  return (data && data[0] && data[0].room_id) || null;
}
async function mySchool() {
  const { data } = await sb.from('profiles').select('school').eq('id', currentUser.id).maybeSingle();
  return (data && data.school) || null;
}

// ============================================================
// เธรดใต้โพสต์
// ============================================================
let thePost = null;
let theReplies = [];

async function openPost(id) {
  thePost = (feedRows || []).find(p => p.id === id) || null;
  theReplies = [];
  go('scr-post');
  renderThread();
  const { data, error } = await sb.rpc('post_thread', { p_post: id });
  if (!error) theReplies = data || [];
  renderThread();
}

function renderThread() {
  const box = document.getElementById('postBody');
  if (!box || !thePost) return;
  const p = thePost;
  const anon = !p.display_name;

  box.innerHTML = `
    <div class="cp-top">
      <button class="cp-x" onclick="go('scr-mates')">${icon('chevron')}</button>
      <b>โพสต์</b><span></span>
    </div>
    <div class="th-scroll">
      ${postCard(Object.assign({}, p, { for_me: false })).replace(/onclick="openPost\([^"]*\)"/, '')}
      <div class="th-lb">${theReplies.length ? theReplies.length + ' คำตอบ' : 'ยังไม่มีใครตอบ — เป็นคนแรกก็ได้'}</div>
      ${theReplies.map(r => {
        const ra = !r.display_name;
        return `<div class="th-reply"${ra || !r.author ? '' :
          ` onclick="openUser('${esc(r.author)}')" role="link" tabindex="0"`}>
          <div class="fd-av sm${ra ? ' anon' : ''}"${ra ? '' : ` style="${avOf(r.display_name)}"`}>${
            ra ? '?' : esc((r.display_name || '?').slice(0, 1))}</div>
          <div class="th-bd">
            <b>${ra ? 'ไม่ระบุชื่อ' : esc(r.display_name)}${r.mine ? '<span class="fd-mine">คุณ</span>' : ''}
              <i>${esc(ago(r.created_at))}</i></b>
            <p>${esc(r.body)}</p>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="ch-bar">
      <input id="thIn" type="text" maxlength="1000"
        placeholder="${anon ? 'ตอบคำถามนี้' : 'ตอบ ' + esc(p.display_name || '')}"
        onkeydown="if(event.key==='Enter')sendReply()">
      <button class="ch-send" onclick="sendReply()" aria-label="ส่ง">${icon('check')}</button>
    </div>`;
}

async function sendReply() {
  const el = document.getElementById('thIn');
  if (!el || !thePost) return;
  const body = el.value.trim();
  if (!body) return;
  el.value = '';
  const { error } = await sb.from('post_replies')
    .insert({ post: thePost.id, author: currentUser.id, body, anon: false });
  if (error) {
    el.value = body;
    showToast({ title: 'ตอบไม่สำเร็จ', body: error.message });
    return;
  }
  haptic('done');
  const { data } = await sb.rpc('post_thread', { p_post: thePost.id });
  theReplies = data || [];
  thePost.reply_count = theReplies.length;
  renderThread();
}

// ---------- ทางเข้าฟีด ----------
// รวมสี่อย่างที่ต้องทำพร้อมกันไว้ที่เดียว: เปิดจอ · โหลด · ฟังโพสต์ใหม่ · บอกว่าเราออนไลน์
// ถ้ากระจายไปเรียกตามปุ่มต่าง ๆ วันหนึ่งจะมีทางเข้าที่ลืมเรียกอันใดอันหนึ่ง
// แล้วฟีดจะนิ่งเงียบเฉพาะตอนเข้าทางนั้น ซึ่งเป็นบั๊กที่หาสาเหตุยากมาก
function openFeed() {
  go('scr-mates');
  renderFeed();
  loadFeed();
  watchFeed();
  watchPresence();
  loadFriendInbox();   // จุดแดงบนปุ่มคนต้องขึ้นตั้งแต่เปิดฟีด ไม่ใช่ตอนกดเข้าไปดู
}

// ============================================================
// หน้าของคนคนหนึ่ง
// ------------------------------------------------------------
// ครึ่งหนึ่งของเวลาที่คนเปิด IG คือไปส่องคน ไม่ใช่อ่านฟีด
// ฟีดที่แตะรูปใครแล้วไม่มีอะไรเกิดขึ้น จึงอ่านเป็น "รายการข้อความ" ไม่ใช่ "ที่ที่มีคนอยู่"
// ============================================================
let theUser = null;
let theUserPosts = [];
let userBusy = false;

async function openUser(id) {
  if (!id || !sb || !currentUser) return;
  theUser = null; theUserPosts = []; userBusy = true;
  go('scr-user');
  renderUser();
  const [c, p] = await Promise.all([
    sb.rpc('user_card', { p_user: id }),
    sb.rpc('user_posts', { p_user: id, p_limit: 20 }),
    loadFriendState(id),
  ]);
  userBusy = false;
  theUser = (c.data && c.data[0]) || null;
  theUserPosts = p.data || [];
  if (!theUser && c.error) showToast({ title: 'เปิดหน้านี้ไม่ได้', body: c.error.message });
  renderUser();
}

// คนที่กำลังนั่งทำงานอยู่ตอนนี้ — อ่านจากแถวออนไลน์ที่ presence ส่งมาแล้ว
// ไม่ต้องถามเซิร์ฟเวอร์ซ้ำ เพราะข้อมูลอยู่ในเครื่องอยู่แล้ว
function onlineOf(id) {
  return (onlineNow || []).find(u => u.id === id) || null;
}

function renderUser() {
  const box = document.getElementById('userBody');
  if (!box) return;

  if (userBusy && !theUser) {
    box.innerHTML = `<div class="cp-top"><button class="cp-x" onclick="go('scr-mates')">${icon('chevron')}</button>
      <b>โปรไฟล์</b><span></span></div><p class="so-hint" style="padding:0 14px">กำลังเปิด…</p>`;
    return;
  }
  if (!theUser) {
    box.innerHTML = `<div class="cp-top"><button class="cp-x" onclick="go('scr-mates')">${icon('chevron')}</button>
      <b>โปรไฟล์</b><span></span></div>
      <div class="so-empty" style="margin:14px">
        <p class="so-empty-h">เปิดหน้านี้ไม่ได้</p>
        <p class="so-empty-p">เห็นโปรไฟล์ได้เฉพาะคนที่อยู่ห้องเรียนเดียวกัน</p>
      </div>`;
    return;
  }

  const u = theUser;
  const on = onlineOf(u.id);
  const name = u.display_name || 'นักเรียน';

  box.innerHTML = `
    <div class="cp-top">
      <button class="cp-x" onclick="go('scr-mates')">${icon('chevron')}</button>
      <b>${esc(name)}</b><span></span>
    </div>
    <div class="us-scroll">
      <div class="us-hero">
        ${u.avatar
          ? `<img class="us-av" src="${esc(u.avatar)}" alt="">`
          : `<div class="us-av" style="${avOf(name)}">${esc(name.slice(0, 1))}</div>`}
        <div class="us-nm">${esc(name)}${u.mine ? '<span class="fd-mine">คุณ</span>' : ''}</div>
        ${on
          ? `<div class="us-live${on.subject ? ' busy' : ''}">
               <span class="rm-dot"></span>${on.subject
                 ? 'กำลังติว' + esc(on.subject) + 'อยู่' : 'ออนไลน์อยู่'}</div>`
          : ''}
        ${u.bio ? `<p class="us-bio">${esc(u.bio)}</p>` : ''}
      </div>

      ${(u.match && u.match.length) || (u.give && u.give.length) ? `<div class="us-why">
        ${u.match && u.match.length
          ? `<p class="so-why good">เก่ง<b>${esc(u.match.join(' · '))}</b> ซึ่งเป็นวิชาที่คุณกำลังจม</p>` : ''}
        ${u.give && u.give.length
          ? `<p class="so-why give">กำลังจม<b>${esc(u.give.join(' · '))}</b> ซึ่งคุณช่วยได้</p>` : ''}
      </div>` : ''}

      <div class="us-subs">
        <div class="us-col">
          <span class="us-lb">ช่วยเพื่อนได้</span>
          <div class="so-chips">${(u.strong || []).length
            ? u.strong.map(x => `<span class="so-chip good on">${esc(x)}</span>`).join('')
            : '<span class="so-none">ยังไม่ได้ระบุ</span>'}</div>
        </div>
        <div class="us-col">
          <span class="us-lb">อยากให้ช่วย</span>
          <div class="so-chips">${(u.weak || []).length
            ? u.weak.map(x => `<span class="so-chip need on">${esc(x)}</span>`).join('')
            : '<span class="so-none">ยังไม่ได้ระบุ</span>'}</div>
        </div>
      </div>

      ${u.mine ? '' : (() => {
        const f = FRIEND_BTN[friendState] || FRIEND_BTN.none;
        return `<div class="us-acts">
          <button class="us-friend ${f.cls}" onclick="${f.act}">
            ${icon(friendState === 'friends' ? 'check' : 'users')}${f.t}</button>
          <button class="us-poke" onclick="pokeUser()">
            ${icon('chat')}ทัก</button>
        </div>`;
      })()}

      <div class="us-lb us-postlb">${u.post_count ? 'โพสต์ ' + u.post_count + ' ใบ' : 'ยังไม่เคยโพสต์'}</div>
      ${theUserPosts.length
        ? theUserPosts.map(p => postCard(Object.assign({}, p, {
            display_name: p.anon ? null : name, avatar: u.avatar, author: u.id, for_me: false,
          }))).join('')
        : `<p class="so-hint">${u.mine
            ? 'โพสต์ของคุณจะมาอยู่ตรงนี้'
            : 'เขายังไม่เคยโพสต์อะไรที่คุณเห็นได้'}</p>`}
    </div>`;
}

// ทักจากหน้าโปรไฟล์ — ใช้ท่อเดียวกับที่ทักจากรายชื่อ
function pokeUser() {
  if (!theUser) return;
  const topic = (theUser.match && theUser.match[0]) || (theUser.give && theUser.give[0]) || '';
  if (typeof pokeMate === 'function') {
    // pokeMate อ่านชื่อจาก mates — ยัดใบนี้เข้าไปก่อนถ้ายังไม่มี
    if (!(mates || []).some(m => m.id === theUser.id)) {
      mates = (mates || []).concat([{ id: theUser.id, display_name: theUser.display_name }]);
    }
    pokeMate(theUser.id, topic);
  }
}

// ============================================================
// เพิ่มเพื่อน
// ------------------------------------------------------------
// "เพื่อนร่วมห้อง" (ใครก็ตามที่อยู่ห้องเดียวกัน) กับ "เพื่อน" ไม่ใช่อย่างเดียวกัน
// แอปที่มีแต่อย่างแรกอ่านแปลก ๆ: เห็นคนทั้งห้อง ทักได้ทุกคน
// แต่ไม่มีใครเป็นใครของใครเลย ไม่มีความสัมพันธ์สักเส้นในแอปทั้งแอป
// ============================================================
let friendState = 'none';   // สถานะกับคนที่กำลังเปิดหน้าอยู่
let friendInbox = [];       // คำขอที่รอเราตอบ

const FRIEND_BTN = {
  none:     { t: 'เพิ่มเพื่อน',     cls: 'go',   act: 'askFriend()' },
  sent:     { t: 'ส่งคำขอแล้ว',    cls: 'wait', act: 'dropFriend()' },
  incoming: { t: 'ตอบรับคำขอ',     cls: 'go',   act: 'askFriend()' },
  friends:  { t: 'เพื่อนกันแล้ว',  cls: 'done', act: 'dropFriend()' },
};

async function loadFriendState(id) {
  friendState = 'none';
  if (!sb || !currentUser || !id) return;
  const { data } = await sb.rpc('friend_state', { p_other: id });
  friendState = data || 'none';
}

async function askFriend() {
  if (!theUser) return;
  const { data, error } = await sb.rpc('ask_friend', { p_other: theUser.id });
  if (error) { haptic('snooze'); showToast({ title: 'เพิ่มไม่สำเร็จ', body: error.message }); return; }
  friendState = data || 'sent';
  haptic('done');
  showToast(friendState === 'friends'
    ? { title: 'เป็นเพื่อนกันแล้ว', body: 'ทักหากันได้เลย' }
    : { title: 'ส่งคำขอแล้ว', body: 'รอ' + (theUser.display_name || 'เขา') + 'กดรับ' });
  renderUser();
  loadFriendInbox();
}

// ยกเลิกคำขอ · ปฏิเสธ · เลิกเป็นเพื่อน — สามคำ การกระทำเดียว
// เลิกเป็นเพื่อนต้องถามก่อน เพราะกดพลาดแล้วกู้ไม่ได้ ต้องไปขอใหม่และอีกฝ่ายจะเห็น
async function dropFriend() {
  if (!theUser) return;
  if (friendState === 'friends' &&
      !confirm('เลิกเป็นเพื่อนกับ' + (theUser.display_name || 'คนนี้') + '?')) return;
  const { error } = await sb.rpc('drop_friend', { p_other: theUser.id });
  if (error) { showToast({ title: 'ทำไม่สำเร็จ', body: error.message }); return; }
  friendState = 'none';
  renderUser();
  loadFriendInbox();
}

async function loadFriendInbox() {
  if (!sb || !currentUser) { friendInbox = []; return; }
  const { data } = await sb.rpc('friend_inbox');
  friendInbox = data || [];
  renderFriendDot();
}

// จุดแดงบนปุ่มคนในหัวฟีด — คำขอที่ไม่มีใครเห็นคือคำขอที่ไม่มีใครตอบ
function renderFriendDot() {
  const b = document.querySelector('.fd-people');
  if (!b) return;
  b.classList.toggle('has-req', friendInbox.length > 0);
  b.dataset.n = friendInbox.length > 9 ? '9+' : String(friendInbox.length || '');
}

// ---------- คำขอที่รอตอบ วาดไว้บนสุดของหน้า "คนในห้อง" ----------
function friendInboxHTML() {
  if (!friendInbox.length) return '';
  return `<div class="fi-box">
    <div class="fi-h">${icon('users')}คำขอเป็นเพื่อน ${friendInbox.length}</div>
    ${friendInbox.map(u => `<div class="fi-row">
      ${u.avatar
        ? `<img class="fd-av" src="${esc(u.avatar)}" alt="">`
        : `<div class="fd-av" style="${avOf(u.display_name)}">${
            esc((u.display_name || '?').slice(0, 1))}</div>`}
      <div class="fi-bd">
        <b>${esc(u.display_name || 'นักเรียน')}</b>
        ${u.strong && u.strong.length
          ? `<i>เก่ง${esc(u.strong.slice(0, 2).join(' · '))}</i>` : ''}
      </div>
      <button class="fi-yes" onclick="inboxAnswer('${esc(u.id)}',true)">รับ</button>
      <button class="fi-no" onclick="inboxAnswer('${esc(u.id)}',false)"
        aria-label="ปฏิเสธ">${icon('x')}</button>
    </div>`).join('')}
  </div>`;
}

async function inboxAnswer(id, yes) {
  const { error } = await sb.rpc(yes ? 'ask_friend' : 'drop_friend', { p_other: id });
  if (error) { showToast({ title: 'ทำไม่สำเร็จ', body: error.message }); return; }
  haptic(yes ? 'done' : 'arm');
  await loadFriendInbox();
  if (typeof renderMates === 'function') renderMates();
}
