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

// ---------- บันไดสโคป ----------
// เรียงจากใกล้ไปไกล และแต่ละขั้นแลกของสองอย่างกันตรง ๆ:
// **ยิ่งใกล้ยิ่งมีคนรู้จักเรา ยิ่งไกลยิ่งมีคนว่างตอบ**
//
// 'country' คือขั้นที่เพิ่งเพิ่มเข้ามา (8 ก.ย. 2569) และมันมีเหตุผลชัดกว่าที่ดูเผิน ๆ:
// ห้องเรียนคือกลุ่มคนที่ได้ใบงานเดียวกัน ส่งวันเดียวกัน จึง **ติดพร้อมกัน** —
// คืนก่อนส่งคือเวลาที่ห้องเงียบที่สุด · คนระดับชั้นเดียวกันทั้งประเทศเรียนหลักสูตรเดียวกัน
// แต่ปฏิทินโรงเรียนไม่ตรงกันเป๊ะ จึงมีคนที่ผ่านเรื่องนี้ไปแล้วและว่างอยู่เสมอ
//
// ขั้นที่ไกลกว่านี้ (หัวข้อทั่วโลก) ไม่ได้อยู่ในฟีด มันอยู่คนละจอด้วยเหตุผลที่เขียนไว้ใน topic.js —
// ฟีดเรียงตามเวลา หน้าหัวข้อเรียงตามว่าคำตอบไหนช่วยได้จริง คนละตรรกะกันคนละเรื่อง
// ============================================================
// 1B95 · สวิตช์เปิด/ปิดชุมชน
// ------------------------------------------------------------
// เจ้าของสั่งเอง (14 ก.ย. 2569): "ระบบ Social / Class Posts ตอนนี้ยังไม่ต้องเปิด
// ให้ใช้งานจริง · ให้แสดงเป็น Coming Soon และทำให้ดูเหมือน feature ที่กำลังจะเปิด"
//
// **ปิด ไม่ใช่ลบ** — โค้ดฟีดทั้งก้อน (โพสต์ · ช่วง 4 ระดับ · presence · realtime)
// ทำงานได้จริงและมีโพสต์ของผู้ใช้อยู่แล้ว วันที่พร้อมเปิดคือแก้ค่าเดียวบรรทัดนี้
// ลบโค้ดทิ้งแล้วเขียนใหม่ทีหลังคือการจ่ายค่าเดิมสองรอบเพื่อไม่ได้อะไรเพิ่ม
//
// ปิดแล้วจอ scr-mates เหลือโหมดเดียวคือรายชื่อเพื่อน — ซึ่งเป็นคนละระบบกับฟีด
// และเป็นระบบที่เจ้าของสั่งให้แยกออกจากกันให้ชัด (communication vs community)
const COMMUNITY_LIVE = false;

const FEED_SCOPES = [
  { id: 'all',     name: 'ทั้งหมด' },
  { id: 'room',    name: 'ห้องฉัน' },
  { id: 'school',  name: 'โรงเรียน' },
  { id: 'country', name: 'ประเทศ' },
];

// จอ "เพื่อนร่วมห้อง" มีสองโหมดในจอเดียวกัน — ฟีด กับ รายชื่อเพื่อน (1B18)
// ก่อนหน้านี้แยกเป็นสองจอ แล้วคำว่า "เพื่อน" ไปโผล่สามที่ที่พาไปคนละหน้ากันหมด
// (ปุ่มแถบล่าง → ฟีด · ปุ่มลอยมุมขวาบน → รายชื่อ · แถวในแท็บ "ฉัน" → รายชื่อ)
// ผู้ใช้กดหารายชื่อเพื่อนไม่เจอสามรอบ ซึ่งเป็นหลักฐานพอแล้วว่าการแยกจอนี้ผิด
// ในหัวนักเรียน "เพื่อนร่วมห้อง" กับ "เพื่อนของฉัน" ไม่ใช่คนละเรื่อง
let feedView = 'feed';    // 'feed' | 'friends'
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
  // ชุมชนปิดอยู่ = ไม่มีโหมดฟีดให้กลับไป · ออกตรงนี้เลย
  // ไม่งั้น openFeed() ที่เพิ่งตั้ง feedView เป็น 'friends' จะถูกบรรทัดล่างดึงกลับเป็น 'feed'
  // ทันที (openFeed เรียก loadFeed ต่อเป็นขั้นตอนที่สอง) แล้วจอเพื่อนจะกลายเป็น
  // ฟีดเปล่าที่ขึ้นว่า "ล็อกอินเพื่อเห็นฟีด" ทั้งที่หัวจอเขียนว่า "เพื่อนของฉัน"
  // — เจอจริงตอนเทสต์ 14 ก.ย. 2569
  if (!COMMUNITY_LIVE) return;
  // กดแท็บช่วงของฟีดเมื่อไหร่ = กลับมาโหมดฟีดเสมอ · ไม่งั้นกดแล้วจอไม่เปลี่ยน
  const was = feedView;
  feedView = 'feed';
  if (scope) feedScope = scope;
  if (was !== 'feed') { renderFeed(); }
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
  // ชุมชนปิด = ไม่มีใครดูโพสต์อยู่ · ช่อง realtime ที่เปิดค้างกินโควตาซึ่งนับ
  // "จำนวนช่องที่เปิดพร้อมกัน" ไม่ใช่จำนวนข้อความ — เปิดทิ้งไว้เพื่อฟีดที่ไม่มีใครเห็น
  // คือการจ่ายโควตาให้ของที่ปิดอยู่
  if (!COMMUNITY_LIVE) return;
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
    avatar: typeof myFace === 'function' ? myFace() : null,
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
// ============================================================
// 1B54 · แถวตัวกรองหลบตอนเลื่อนลง
// ============================================================
// สี่ปุ่มนั้นกินสูง 45px ทุกจอตลอดเวลา ทั้งที่คนสลับช่วงฟีดวันละไม่กี่ครั้ง
// แต่เลื่อนอ่านตลอด · IG กับ LINE ซ่อนแถบของตัวเองตอนเลื่อนลงด้วยเหตุผลเดียวกัน
//
// ซ่อนตอน "เลื่อนลง" ไม่ใช่ตอน "เลื่อนพ้นระยะหนึ่ง" — แบบหลังทำให้แถบหายไปเลย
// เมื่ออ่านยาว ๆ แล้วต้องเลื่อนกลับขึ้นบนสุดถึงจะได้คืน
// แบบนี้ปัดขึ้นนิดเดียวก็ได้คืนทันที ซึ่งเป็นท่าที่นิ้วทำอยู่แล้วเวลาจะกดอะไรข้างบน
//
// กันสั่น: ต้องเลื่อนเกิน 8px ถึงนับเป็นการเปลี่ยนทิศ · ต่ำกว่านั้นคือมือสั่นบนจอสัมผัส
// และไม่ซ่อนเลยถ้าเนื้อหาสั้นกว่าหนึ่งจอ — ไม่มีอะไรให้เลื่อน ไม่ต้องมีอะไรให้หลบ
let fdLastY = 0, fdHidden = false;
// กันวงจรป้อนกลับตอนแถบตัวกรองย่อ/กาง — เหตุผลเต็มอยู่ใน watchFeedScroll (1B72)
let fdLockUntil = 0;
function watchFeedScroll() {
  const scr = document.getElementById('scr-mates');
  if (!scr || scr.dataset.scrollHook === '1') return;
  scr.dataset.scrollHook = '1';
  // ---------- บั๊กกระตุก (แก้ 1B72) ----------
  // ผู้ใช้แจ้งว่า "เหมือนมันบัคกระตุกตรงช่องเพื่อน" — และมันกระตุกจริง
  //
  // ต้นเหตุเป็นวงจรป้อนกลับ: .fd-tuck ย่อแถบตัวกรองจนความสูงหายไป ~60px
  // (ดู .fd-tuck .fd-scopes { max-height: 0 } ใน feed.css)
  // ความสูงเนื้อหาลดลง เบราว์เซอร์ปรับ scrollTop ตาม แล้วยิง scroll event ใหม่
  // รอบนั้นคำนวณ dy ได้ราว -60 ซึ่งเกินเกณฑ์ 8px → ตีความว่า "เลื่อนขึ้น" → กางคืน
  // ความสูงกลับมา +60px → ยิง scroll อีก → ย่อ → กาง → วนไม่จบตราบใดที่ยังเลื่อนอยู่
  //
  // เกณฑ์ 8px กันได้แค่มือสั่น กันวงจรนี้ไม่ได้เลย เพราะการกระโดดมันใหญ่กว่ามาก
  // แก้ด้วยการล็อกไม่ให้ตัดสินใจซ้ำระหว่างที่ความสูงกำลังเปลี่ยน (นานกว่า transition)
  // และขยับเกณฑ์เป็น 16px เพราะ 8px ยังไวเกินไปสำหรับการเลื่อนด้วยนิ้วจริง
  scr.addEventListener('scroll', () => {
    const y = scr.scrollTop;
    // ระหว่างล็อก แค่จำตำแหน่งไว้ ไม่ตัดสินใจอะไร — scroll ที่เกิดจากความสูงที่เราเปลี่ยนเอง
    // จะได้ไม่ถูกนับเป็นเจตนาของผู้ใช้
    if (Date.now() < fdLockUntil) { fdLastY = y; return; }
    const room = scr.scrollHeight - scr.clientHeight;
    if (room < 120) { if (fdHidden) { fdHidden = false; scr.classList.remove('fd-tuck'); } fdLastY = y; return; }
    const dy = y - fdLastY;
    if (Math.abs(dy) < 16) return;
    const down = dy > 0 && y > 40;
    if (down !== fdHidden) {
      fdHidden = down;
      scr.classList.toggle('fd-tuck', down);
      fdLockUntil = Date.now() + 340;   // .22s ของ transition + เผื่อเวลาจัดหน้าใหม่
    }
    fdLastY = y;
  }, { passive: true });
}

function renderFeed() {
  const box = document.getElementById('feedBody');
  if (!box) return;

  // ชุมชนปิดอยู่ = จอนี้คือ "เพื่อนของฉัน" ล้วน ๆ · ชื่อจอต้องตรงกับสิ่งที่อยู่ในจอ
  // หัวข้อว่า "เพื่อนร่วมห้อง" บนจอที่มีแต่รายชื่อเพื่อน คือคำโกหกเล็ก ๆ
  // ที่ทำให้คนไม่แน่ใจว่ากดมาถูกที่หรือเปล่า (บทเรียนเดียวกับ viewTitle ใน 1B93)
  const onlyFriends = !COMMUNITY_LIVE;

  box.innerHTML = `
    <div class="fd-top">
      <h1 class="fd-title">${onlyFriends ? 'เพื่อนของฉัน' : 'เพื่อนร่วมห้อง'}</h1>
      <!-- 1B53 · แว่นขยายอยู่บนหัวจอ ไม่ใช่ช่องค้นหากางค้างอยู่กลางจอ
           จอนี้เปิดมาเพื่อดูเพื่อน ไม่ใช่เพื่อค้นหา — ช่องที่กางค้างคือแถบสูง 46px
           ที่กันคนส่วนใหญ่ออกจากเนื้อหาโดยไม่ได้ช่วยอะไรเขา -->
      <!-- แว่นขยายถูกถอดออกเมื่อ 1B64 · ช่องค้นหากางค้างอยู่ในจอแล้ว
           ปุ่มที่พาไปหาของที่มองเห็นอยู่แล้วคือปุ่มที่กินที่บนหัวจอเปล่า ๆ -->
      <!-- กล่องข้อความ · จำเป็นตั้งแต่วันที่การทักไม่ได้จำกัดอยู่แค่คนในห้องเรียนอีกต่อไป
           ข้อความจากคนที่ไม่ได้อยู่ในรายชื่อไหนเลยต้องมีที่ไปรวมกัน ไม่งั้นไม่มีทางถูกเห็น -->
      <!-- ปุ่มข้อความย้ายลงไปลอยมุมล่างขวาตั้งแต่ 1B68 (ดู feedFab)
           ผู้ใช้วาดลูกศรจากไอคอนบนหัวจอชี้ลงมุมล่าง แล้วบอกว่า "อยากให้เห็นชัดกว่านี้" -->
      <button class="fd-people" onclick="go('scr-people'); renderMates()" aria-label="วิชาของฉันกับคนในห้อง">
        ${icon('users')}
      </button>
    </div>

    ${onlyFriends ? '' : `<div class="fd-scopes" role="tablist">
      ${FEED_SCOPES.filter(s => s.id !== 'country'
          || (typeof cohortReady !== 'undefined' && cohortReady))
        .map(s => `<button role="tab" class="fd-scope${
        feedView === 'feed' && s.id === feedScope ? ' on' : ''}"
        aria-selected="${feedView === 'feed' && s.id === feedScope}"
        onclick="loadFeed('${s.id}')">${esc(s.name)}</button>`).join('')}
      <!-- แท็บที่สี่ไม่ใช่ "ช่วงของฟีด" แต่เป็นอีกมุมมองของจอเดียวกัน — คั่นด้วยเส้น
           เพื่อไม่ให้อ่านว่าเป็นตัวกรองโพสต์อีกตัวหนึ่ง -->
      <button role="tab" class="fd-scope fd-scope-fr${feedView === 'friends' ? ' on' : ''}"
        aria-selected="${feedView === 'friends'}"
        onclick="showFriendsTab()">เพื่อนฉัน<span class="fd-scope-n" id="frTabN" hidden></span></button>
    </div>`}

    ${feedView === 'friends' ? '<div id="friendsBody" class="fr-body"></div>' : `
      <div id="onlineRow"></div>
      ${currentUser ? composerHTML() : ''}
      <div id="freshPill"></div>
      <div id="feedList">${feedListHTML()}</div>`}`;

  if (feedView === 'friends') {
    // renderFriends อยู่ใน app.js — โครงจอถูกสร้างใหม่ทุกครั้งที่สลับโหมด
    // จึงต้องบังคับวาดใหม่ ไม่ใช่ปล่อยให้มันคิดว่าโครงเดิมยังอยู่
    if (typeof renderFriends === 'function') renderFriends(true);
    if (typeof loadFriends === 'function') loadFriends();
  } else {
    renderOnline();
    renderFreshPill();
  }
  renderFriendDot();
  paintFeedFab();
  if (typeof loadDmDot === 'function') loadDmDot();
  keepScopeInView();
  watchFeedScroll();
}

// ---------- ปุ่มที่เลือกอยู่ต้องมองเห็นเสมอ ----------
// ห้าปุ่มยาวเกินจอ 320px แถวจึงเลื่อนได้ (ดู 1B61a ใน feed.css)
// แต่แถวที่เลื่อนได้อย่างเดียวยังไม่พอ — กด "เพื่อนฉัน" แล้วจอวาดใหม่โดยเลื่อนกลับไปซ้ายสุด
// ผู้ใช้จะเห็นว่าตัวเองอยู่แท็บที่มองไม่เห็น ซึ่งอ่านเหมือนกดแล้วไม่มีอะไรเกิดขึ้น
function keepScopeInView() {
  const row = document.querySelector('.fd-scopes');
  const on = row && row.querySelector('.fd-scope.on');
  if (!row || !on) return;
  const pad = 12;
  const left = on.offsetLeft - pad;
  const right = on.offsetLeft + on.offsetWidth + pad;
  if (left < row.scrollLeft) row.scrollLeft = Math.max(0, left);
  else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth;
}

// สลับมาโหมดรายชื่อเพื่อน · ไม่ยิงโหลดฟีดซ้ำ เพราะฟีดที่โหลดไว้แล้วยังอยู่ครบ
function showFriendsTab() {
  feedView = 'friends';
  renderFeed();
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
        : `<span>${esc(faceLetter(u))}</span>`;
      return `<div class="fd-on${busy ? ' busy' : ''}" onclick="openUser('${esc(u.id)}')" role="link" tabindex="0">
        <div class="fd-on-ring"${u.avatar ? '' : ` style="${faceTint(u)}"`}>${av}</div>
        <div class="fd-on-nm">${esc(personName(u))}</div>
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
  const name = anon ? 'ไม่ระบุชื่อ' : personName(p);
  const av = (!anon && p.avatar)
    ? `<img class="fd-av" src="${esc(p.avatar)}" alt="">`
    : `<div class="fd-av${anon ? ' anon' : ''}"${anon ? '' : ` style="${faceTint(p)}"`}>${
        anon ? '?' : esc(faceLetter(p))}</div>`;

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
      ${p.mine
        ? `<button class="fd-flagbtn" aria-label="ลบโพสต์นี้"
            onclick="event.stopPropagation();delPost('${esc(p.id)}')">${icon('trash')}</button>`
        : `<button class="fd-flagbtn" aria-label="รายงานโพสต์นี้"
            onclick="event.stopPropagation();openReport('post','${esc(p.id)}')">${icon('flag')}</button>`}
    </div>
  </article>`;
}

// ============================================================
// ตัวกรองเนื้อหา — ฝั่งแอป (1B76)
// ------------------------------------------------------------
// ผู้ใช้เคาะกติกาไว้: รูปกันก่อนส่ง · ข้อความปล่อยขึ้นก่อนแล้วสแกนตามหลัง
// ฝั่งเซิร์ฟเวอร์อยู่ใน Edge Function ชื่อ guard (migration 27)
//
// **สามสถานะที่ต้องแยกให้ออก** ไม่ใช่สองอย่างที่คนมักเขียน (ผ่าน/ไม่ผ่าน):
//   1) ตัวกรองบอกว่าไม่ผ่าน      -> ไม่ให้ส่ง บอกเหตุผลเป็นภาษาคน
//   2) ตัวกรองล่ม/หมดโควตา      -> ไม่ให้ส่ง บอกให้ลองใหม่  (ล้มแบบปิด)
//   3) ยังไม่ได้ deploy guard เลย -> ให้ส่ง
//
// ข้อ 3 คือข้อที่ต้องคิด: ถ้าเหมาว่า "เรียกไม่ได้ = ไม่ให้ส่ง" แอปจะส่งรูปไม่ได้เลย
// ทั้งแอปจนกว่าจะมีคน deploy ซึ่งไม่ได้ทำให้ใครปลอดภัยขึ้น มีแต่ทำให้แอปพัง
// และสภาพก่อนหน้านี้ก็คือไม่มีตัวกรองอยู่แล้ว จึงไม่ได้แย่ลงกว่าเดิม
// แยกสองอย่างนี้ด้วยรหัสตอบกลับ: 404 = ยังไม่มีฟังก์ชัน · อย่างอื่น = มีแต่ล้ม
//
// ---------- 2A · ข้อ 3 ข้างบนใช้กับ "รูป" ไม่ได้อีกต่อไป (เจ้าของเคาะ 13 ก.ย. 2569) ----------
// เหตุผลเดิมฟังขึ้นตอนที่ยังไม่มีใครใช้ตัวกรอง แต่มันเปิดช่องที่กว้างกว่าที่ตั้งใจ:
// 404 **ครั้งเดียว** — เช่นเสี้ยววินาทีระหว่าง redeploy guard — ทำให้ธงนี้ติดค้าง
// ทั้งอายุแอป แล้วรูปทุกใบหลังจากนั้นขึ้นไปโดยไม่มีใครตรวจเลยสักใบ
// ซึ่งขัดกับกติกา "รูปล้มแบบปิด" ที่เจ้าของเคาะไว้เอง และเป็นช่องที่ไม่มีใครตั้งใจให้มี
//
// ตอนนี้จึงแยกกันชัด ๆ ตามกติกาของแต่ละชนิด ไม่ใช่ธงเดียวคุมทั้งสองอย่าง:
//   รูป     → ไม่มีทางผ่านฟรี · ตรวจไม่ได้เมื่อไหร่ = ไม่ให้ส่งเมื่อนั้น (ธงนี้ไม่มีผลกับรูป)
//   ข้อความ → ยังใช้ธงนี้เหมือนเดิม เพราะ policy ของข้อความคือ fail-open อยู่แล้ว
//             ธงนี้กับข้อความจึงมีหน้าที่เดียวคือเลิกยิงไปที่ 404 ซ้ำ ๆ ไม่ได้ปลดการตรวจอะไร
//
// **ผลที่ต้องรู้ก่อน deploy**: ถ้า guard ยังไม่ได้ deploy จริง แอปจะส่งรูปไม่ได้ทั้งแอป
// ทันที — นั่นคือสิ่งที่ fail-closed แปลว่า และเป็นราคาที่เจ้าของเลือกจ่ายเอง
let guardMissing = false;         // ใช้กับ "ข้อความ" เท่านั้นแล้ว — รูปไม่อ่านธงนี้

function blobToB64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(new Error('อ่านไฟล์ไม่ได้'));
    r.readAsDataURL(blob);
  });
}

// คืน { ok } เมื่อผ่าน · { ok:false, message } เมื่อไม่ผ่านหรือตรวจไม่ได้
//
// **ลองซ้ำหนึ่งครั้งก่อนยอมแพ้** — วัดจริงกับแอปจริง 10 ก.ย. 69 ยิงไป 6 ครั้ง
// ล้มไป 2 ครั้งด้วย guard_down (Gemini อืดหรือคนแน่น) ซึ่งไม่ใช่การบล็อกเนื้อหา
// แต่ผู้ใช้เห็นเป็น "ส่งรูปไม่ได้" เหมือนกันหมด · รูปที่ส่งไม่ได้หนึ่งในสามครั้ง
// จะทำให้คนเลิกแนบรูป แล้วด่านที่อุตส่าห์ทำก็ไม่มีอะไรให้ตรวจอีกเลย
//
// ลองซ้ำเฉพาะตอน guard_down เท่านั้น · คำตัดสินว่า "ไม่ผ่าน" ห้ามลองซ้ำเด็ดขาด
// เพราะการยิงซ้ำจนกว่าจะผ่านคือวิธีหลบด่านที่ง่ายที่สุดเท่าที่มี
async function guardImage(blob) {
  const first = await guardImageOnce(blob);
  if (first.ok || first.reason !== 'guard_down') return first;
  return await guardImageOnce(blob);
}

async function guardImageOnce(blob) {
  // ---------- ไม่มีบัญชี = ตรวจไม่ได้ = ไม่ให้ใช้รูป ----------
  // guard ต้องการ JWT เพื่อรู้ว่าใครถูกกรอง (mod_log ที่ไม่รู้ว่าใครคือบันทึกที่ใช้ไม่ได้)
  // ของเดิมคืน ok ตรงนี้ ซึ่งเปิดช่องที่ใหญ่กว่าที่เห็น: ตั้งรูปโปรไฟล์ตอนยังไม่ล็อกอิน
  // → เก็บลงเครื่องโดยไม่ตรวจ → พอล็อกอินครั้งถัดไป syncPublicFace() ดันรูปนั้น
  // ขึ้น profiles.avatar ให้เอง **โดยไม่เคยผ่านตัวกรองเลยสักครั้ง**
  // และรูปโปรไฟล์คือรูปที่โผล่ทุกหน้าที่มีชื่อคนนั้น คนที่ไม่เคยเปิดโพสต์เขาก็ยังเห็น
  if (!sb || !currentUser) {
    return { ok: false, reason: 'guard_noauth',
             message: 'ต้องเข้าสู่ระบบก่อนถึงจะใช้รูปได้' };
  }
  // **ไม่อ่าน guardMissing แล้ว** — ธงนั้นติดค้างทั้งอายุแอปจาก 404 ครั้งเดียว
  // ยอมเสียคำขอเปล่าใบละครั้งดีกว่าปลดการตรวจรูปยาวทั้งเซสชัน และการยิงจริงทุกครั้ง
  // ทำให้มันฟื้นเองได้เมื่อ guard กลับมา · คำขอที่ตกที่ 404 ไม่แตะโควตา Gemini เลย
  try {
    const b64 = await blobToB64(blob);
    const { data, error } = await sb.functions.invoke('guard', {
      body: { mode: 'image', b64, mime: 'image/jpeg' },
    });
    if (error) {
      // supabase-js ยัดสถานะไว้ใน error.context ตอนฟังก์ชันตอบไม่ใช่ 2xx
      const st = (error.context && error.context.status) || 0;
      // 404 = ยังไม่มีฟังก์ชัน · ยังตั้งธงไว้เพื่อให้ **ข้อความ** เลิกยิงซ้ำ (policy fail-open)
      // แต่ **รูปไม่ได้ผ่านเพราะธงนี้อีกแล้ว** — ตรวจไม่ได้คือไม่ให้ส่ง
      if (st === 404) {
        guardMissing = true;
        return { ok: false, reason: 'guard_missing',
                 message: 'ตรวจรูปไม่ได้ตอนนี้ ลองใหม่อีกครั้ง' };
      }
      // guard เองตอบ 503 พร้อมข้อความไทยตอนตรวจไม่สำเร็จ — เอามาโชว์ตรง ๆ
      let msg = 'ตรวจรูปไม่สำเร็จ ลองส่งใหม่อีกครั้ง';
      let why = 'guard_down';
      try {
        const b = await error.context.json();
        if (b && b.message) msg = b.message;
        if (b && b.reason) why = b.reason;
      } catch (_) {}
      return { ok: false, reason: why, message: msg };
    }
    if (data && data.ok === false) {
      return { ok: false, reason: data.reason || 'block',
               message: data.message || 'ส่งรูปนี้ไม่ได้' };
    }
    return { ok: true };
  } catch (_) {
    // ยิงไม่ถึงเลย (เน็ตหลุด) — ล้มแบบปิดเหมือนกัน
    return { ok: false, reason: 'guard_down',
             message: 'ตรวจรูปไม่สำเร็จ ลองส่งใหม่อีกครั้ง' };
  }
}

// ข้อความ: ยิงแล้วไม่รอ · ของขึ้นไปแล้ว การรอผลจึงไม่ได้กันอะไร มีแต่ทำให้ช้า
// ถ้าตัวกรองตัดสินว่าไม่ผ่าน มันซ่อนของให้เองฝั่งเซิร์ฟเวอร์แล้ว
function guardText(kind, target, text) {
  if (guardMissing || !sb || !currentUser || !target || !String(text || '').trim()) return;
  try {
    sb.functions.invoke('guard', { body: { mode: 'text', kind, target: String(target), text } })
      .then(({ error }) => {
        if (error && (error.context && error.context.status) === 404) guardMissing = true;
      })
      .catch(() => {});
  } catch (_) {}
}


// ============================================================
// ลบของตัวเอง (1B76)
// ------------------------------------------------------------
// ผู้ใช้ทักมาว่า "แบบนี้ลบสิ่งที่โพสไม่ได้" ซึ่งถูก — ก่อน migration 26
// ทั้งฐานข้อมูลไม่มีคำสั่งลบเลยสักตัว และ policy บน posts มีแค่ insert
//
// **RPC คืน path ของรูปมาให้ แล้วต้องลบไฟล์ต่อเสมอ** ลบแค่แถวในตาราง
// แล้วทิ้งไฟล์ไว้ = รูปยังเปิดได้ด้วย URL เดิมทุกประการ ซึ่งไม่ใช่การลบ
// เป็นแค่การเอาออกจากหน้าจอ · คนที่กดลบเพราะเผลอโพสต์รูปที่ไม่ควรโพสต์
// จะเข้าใจว่ามันหายไปแล้ว ทั้งที่ยังอยู่
function rpcGone(err) {
  return !!err && (err.code === 'PGRST202' || err.code === '42883');
}

async function delPost(id) {
  if (!sb || !currentUser) return;
  if (!confirm('ลบโพสต์นี้ถาวร คำตอบใต้โพสต์หายไปด้วย แน่ใจนะ?')) return;
  const { data, error } = await sb.rpc('post_delete', { p_post: id });
  if (error) {
    if (typeof haptic === 'function') haptic('snooze');
    showToast({ title: 'ลบไม่สำเร็จ',
      body: rpcGone(error) ? 'ยังไม่ได้อัปเดตฐานข้อมูล' : error.message });
    return;
  }
  if (data) { try { await sb.storage.from('posts').remove([data]); } catch (_) {} }
  feedRows = (typeof feedRows !== 'undefined' && Array.isArray(feedRows))
    ? feedRows.filter(x => x.id !== id) : feedRows;
  if (typeof thePost !== 'undefined' && thePost && thePost.id === id) { go('scr-feed'); }
  if (typeof haptic === 'function') haptic('done');
  renderFeed();
  showToast({ title: 'ลบแล้ว' });
}

async function delReply(id) {
  if (!sb || !currentUser) return;
  if (!confirm('ลบคำตอบนี้ถาวร แน่ใจนะ?')) return;
  const { error } = await sb.rpc('reply_delete', { p_reply: Number(id) });
  if (error) {
    if (typeof haptic === 'function') haptic('snooze');
    showToast({ title: 'ลบไม่สำเร็จ',
      body: rpcGone(error) ? 'ยังไม่ได้อัปเดตฐานข้อมูล' : error.message });
    return;
  }
  theReplies = (theReplies || []).filter(x => String(x.id) !== String(id));
  if (typeof haptic === 'function') haptic('done');
  renderFeed();
  showToast({ title: 'ลบแล้ว' });
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
  // ไม่มี 'ทุกคนในแอป' อีกแล้ว — การกระจายเสียงหาคนทั้งแอปคือช่องที่คนแปลกหน้า
  // เข้าถึงเด็กได้ ซึ่งเป็นเส้นเดียวที่ทำให้แอปแบบนี้อันตรายจริง
  // (แท็บ "ทั้งหมด" ในฟีดยังอยู่ มันคือมุมมองรวมของสิ่งที่เราเห็นได้ คนละเรื่องกัน)
  // ซ่อน 'ทั่วประเทศ' ด้วยถ้าหลังบ้านยังไม่พร้อม — เลือกได้แต่โพสต์ไม่ผ่าน policy
  // คือปุ่มที่หลอกให้เสียเวลาพิมพ์ทั้งโพสต์แล้วค่อยบอกว่าไม่ได้
  const scopes = FEED_SCOPES.filter(s => s.id !== 'all'
    && (s.id !== 'country' || (typeof cohortReady !== 'undefined' && cohortReady)));

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
        </div>
        <!-- ทางเข้าที่สองของชั้นหัวข้อ (อีกทางคือแถวใต้การ์ดงาน) —
             รูปใบงานอยู่ในมือถือเด็กอยู่แล้ว แอปจึงไม่ต้องถามว่าเขาติดเรื่องอะไร
             นี่คือข้อที่ฟอรัมถาม-ตอบระดับโลกทุกเจ้าทำไม่ได้ เพราะต้องรอให้ผู้ใช้พิมพ์แท็กเอง -->
        ${typeof topicReady !== 'undefined' && topicReady
          ? `<button class="cp-add" id="cpTopic" onclick="topicFromCompose()">
              ${icon('sparkles')}ถามคนทั้งโลกจากรูปนี้แทน
            </button>` : ''}` : ''}

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
    // ตรวจก่อนอัปโหลด ไม่ใช่หลังอัปโหลด — ตรวจทีหลังแปลว่ารูปขึ้นไปอยู่บน storage
    // และมี URL ที่เปิดได้จริงแล้วตั้งแต่ก่อนรู้ผล
    if (btn) btn.textContent = 'กำลังตรวจรูป…';
    const g = await guardImage(composeImg.blob);
    if (!g.ok) {
      if (btn) { btn.disabled = false; btn.textContent = 'โพสต์'; }
      if (typeof haptic === 'function') haptic('snooze');
      showToast({ title: 'ส่งรูปนี้ไม่ได้', body: g.message });
      return;
    }
    if (btn) btn.textContent = 'กำลังโพสต์…';
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
  // ประเทศ+ช่วงชั้นถ่ายสำเนาไว้ตอนโพสต์ ไม่ได้อ้างอิงโปรไฟล์ตอนอ่าน —
  // ขึ้น ม.ปลายแล้วโพสต์เก่าต้องอยู่ในฟีดของ ม.ต้นต่อไป ไม่ใช่ย้ายตามเจ้าของขึ้นไปทั้งก้อน
  if (scope === 'country') {
    const c = await myCohort();
    row.country = c.country || 'TH';
    row.grade = c.grade || null;
  }

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
  if (scope === 'country' && !row.grade) {
    if (btn) { btn.disabled = false; btn.textContent = 'โพสต์'; }
    showToast({ title: 'ยังไม่ได้เลือกช่วงชั้น',
      body: 'เลือกได้ที่หน้า "วิชาของฉัน" — แท็บทั่วประเทศใช้ช่วงชั้นเป็นตัวจับคู่' });
    return;
  }

  // ขอ id กลับมาด้วย — ไม่งั้นสแกนเสร็จแล้วไม่รู้ว่าจะไปซ่อนแถวไหน
  // ค่าใช้จ่ายคือคอลัมน์เดียวต่อโพสต์ ซึ่งถูกกว่าการมีตัวกรองที่ชี้เป้าไม่ได้มาก
  const { data: made, error } = await sb.from('posts').insert(row).select('id').single();
  if (btn) { btn.disabled = false; btn.textContent = 'โพสต์'; }
  if (error) { showToast({ title: 'โพสต์ไม่สำเร็จ', body: error.message }); return; }

  // ข้อความสแกนตามหลัง ไม่รอผล (กติกาที่ผู้ใช้เคาะไว้)
  if (made && made.id) guardText('post', made.id, body);

  haptic('done');
  closeCompose();
  loadFeed(scope === 'all' ? 'all' : feedScope);
}

async function myFirstRoom() {
  const { data } = await sb.from('line_links').select('room_id').limit(1);
  return (data && data[0] && data[0].room_id) || null;
}
// ประเทศ + ช่วงชั้นของตัวเอง · คืนเป็นก้อนเดียวเพราะสองค่านี้ใช้คู่กันเสมอ
// (ประเทศอย่างเดียวไม่พอ ช่วงชั้นอย่างเดียวก็ไม่พอ — กุญแจของสโคปนี้คือทั้งคู่)
// ============================================================
// ปุ่มข้อความลอย (1B68 · ย้ายออกนอกกองจอใน 1B70)
// ------------------------------------------------------------
// ผู้ใช้สั่งสองรอบ: รอบแรก "อยากให้เห็นชัดกว่านี้" (ย้ายลงมุมล่างขวา)
// รอบสอง "อยากให้ติดขอบจอตลอด ไม่ว่าจะเปิดหน้าไหน เลื่อนลงเลื่อนขึ้น"
//
// รอบแรกวางไว้ข้างใน #scr-mates ซึ่งผิด เพราะ .screen เป็น absolute + overflow-y:auto
// ปุ่มจึงเป็นลูกของกล่องที่เลื่อนได้ แล้วเลื่อนหนีตามเนื้อหา และโผล่แค่จอเดียว
// ตอนนี้ตัวปุ่มอยู่ใน index.html เป็นพี่น้องกับ .tabbar แล้ว (อิงกล่องเดียวกัน อยู่นิ่งเสมอ)
// ฟังก์ชันนี้เหลือหน้าที่เดียวคือเปิด/ปิด และอัปเดตตัวเลข
//
// ซ่อนในจอที่ปุ่มจะไปทับของสำคัญ: จอล็อกอิน · จอที่มีช่องพิมพ์ติดก้นจอ
// (แชท · ห้องการบ้าน · เธรดหัวข้อ · กล่องข้อความเอง ซึ่งมีปุ่มดินสอของตัวเองอยู่แล้ว)
// 1C09 · scr-profile เข้ารายการนี้ด้วย ด้วยเกณฑ์เดิมของรายการเป๊ะ ๆ สองข้อ:
//   1) มันทับของสำคัญจริง — ลิสต์ทางเข้าของแท็บ "ฉัน" มีค่าชิดขวาทุกแถว
//      (0 โทเคน · ยังไม่ได้เลือก · เร็ว ๆ นี้) ปุ่มลอยนั่งทับคอลัมน์นั้นพอดี
//      เห็นได้ในภาพที่เจ้าของส่งมาเอง: มันบังค่าของแถว "StudentOS Pro"
//   2) ทั้งสองปลายทางของปุ่มมีทางเข้าอยู่แล้วบนจอนี้ — "ข้อความ" เป็นแถวในลิสต์
//      ตั้งแต่ 1B95 และ "น้องไซ" เป็นช่องบนแถบล่างที่เห็นพร้อมกันอยู่แล้ว
//      ปุ่มลอยจึงเป็นทางเข้าที่สาม/สี่ไปที่เดิม ซึ่งจ่ายด้วยการบังเนื้อหา
const FAB_HIDE = ['scr-login', 'scr-onboard', 'scr-chat', 'scr-hw', 'scr-profile',
  'scr-topic', 'scr-tthread', 'scr-dm', 'scr-compose', 'scr-crop', 'scr-scan'];

// 1B94 · ปุ่มนี้ไม่ใช่ปุ่มข้อความอีกแล้ว — มันคือปุ่มรวม (ข้อความ + ผู้ช่วย)
// เงื่อนไข "ต้องล็อกอินก่อนถึงจะโผล่" จึงถูกถอดออก: ผู้ช่วยใช้ได้โดยไม่ต้องมีบัญชี
// การซ่อนทั้งปุ่มเมื่อยังไม่ล็อกอิน เท่ากับซ่อนผู้ช่วยจากคนที่ยังไม่ได้สมัคร
// เงื่อนไขเดิมย้ายไปอยู่ที่ dmUsable() ใน app.js ซึ่งคุมเฉพาะ "ช่องข้อความ" ในเมนู
function paintFeedFab() {
  const fab = document.getElementById('feedFab');
  if (!fab) return;
  const show = !FAB_HIDE.includes(curScreen);
  fab.hidden = !show;
  // ออกจากจอที่มีเมนูกางค้างอยู่ = ต้องเก็บเมนูไปด้วย ไม่งั้นมันลอยทับจอใหม่
  if (!show) { if (typeof closeFabHub === 'function') closeFabHub(true); return; }
  fab.onclick = () => (typeof toggleFabHub === 'function' ? toggleFabHub() : openDmInbox());
  // เลขบนปุ่มยังเป็นเลขข้อความเหมือนเดิม และนับได้ต่อเมื่อกล่องข้อความใช้ได้จริง
  const usable = typeof dmUsable === 'function' ? dmUsable() : !!currentUser;
  const n = usable && typeof dmPending === 'number' ? dmPending : 0;
  // ไอคอนหลักเป็นประกาย ไม่ใช่ลูกโป่งคำพูด — ปุ่มนี้เปิดสองอย่าง ถ้ายังเป็นลูกโป่ง
  // คนจะอ่านว่ามันคือแชท แล้วเมนูที่กางออกมาจะกลายเป็นเรื่องเซอร์ไพรส์ทุกครั้ง
  fab.innerHTML = icon('sparkles') + (n ? `<i>${n > 9 ? '9+' : n}</i>` : '');
  fab.classList.toggle('has-req', !!n);
}

async function myCohort() {
  const { data } = await sb.from('profiles')
    .select('country, grade').eq('id', currentUser.id).maybeSingle();
  return { country: (data && data.country) || 'TH', grade: (data && data.grade) || null };
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
  postReturn = (typeof pickReturn === 'function') ? pickReturn('scr-mates', 'scr-post') : 'scr-mates';
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
      <button class="cp-x" onclick="postBack()">${icon('chevron')}</button>
      <b>โพสต์</b><span></span>
    </div>
    <div class="th-scroll">
      ${postCard(Object.assign({}, p, { for_me: false })).replace(/onclick="openPost\([^"]*\)"/, '')}
      <div class="th-lb">${theReplies.length ? theReplies.length + ' คำตอบ' : 'ยังไม่มีใครตอบ — เป็นคนแรกก็ได้'}</div>
      ${theReplies.map(r => {
        const ra = !r.display_name;
        return `<div class="th-reply"${ra || !r.author ? '' :
          ` onclick="openUser('${esc(r.author)}')" role="link" tabindex="0"`}>
          <div class="fd-av sm${ra ? ' anon' : ''}"${ra ? '' : ` style="${faceTint(r)}"`}>${
            ra ? '?' : esc(faceLetter(r))}</div>
          <div class="th-bd">
            <b>${ra ? 'ไม่ระบุชื่อ' : esc(personName(r))}${r.mine ? '<span class="fd-mine">คุณ</span>' : ''}
              <i>${esc(ago(r.created_at))}</i></b>
            <p>${esc(r.body)}</p>
          </div>
          ${r.mine
            ? `<button class="fd-flagbtn" aria-label="ลบคำตอบนี้"
                onclick="event.stopPropagation();delReply('${esc(r.id)}')">${icon('trash')}</button>`
            : `<button class="fd-flagbtn" aria-label="รายงานคำตอบนี้"
                onclick="event.stopPropagation();openReport('reply','${esc(r.id)}')">${icon('flag')}</button>`}
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
  const { data: made, error } = await sb.from('post_replies')
    .insert({ post: thePost.id, author: currentUser.id, body, anon: false })
    .select('id').single();
  if (error) {
    el.value = body;
    showToast({ title: 'ตอบไม่สำเร็จ', body: error.message });
    return;
  }
  if (made && made.id) guardText('reply', made.id, body);
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
function openFeed(view) {
  // ครั้งแรกต้องรู้ก่อนว่าอะไรเป็นอะไร แล้วค่อยเข้าไปเจอคน
  if (currentUser && typeof needsConsent === 'function' && needsConsent()) {
    go('scr-consent');
    renderConsent();
    return;
  }
  // ชุมชนปิดอยู่ = จอนี้มีโหมดเดียว · ทางเข้าเดิมที่ยังเรียก openFeed() เปล่า ๆ
  // (ลิงก์เก่า · จอที่ค้างไว้ตอนสลับแอป) ต้องลงที่รายชื่อเพื่อน ไม่ใช่ฟีดเปล่า
  feedView = (!COMMUNITY_LIVE || view === 'friends') ? 'friends' : 'feed';
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
// ============================================================
// หัวโปรไฟล์ตัวกลาง — ใช้ทั้งหน้าเพื่อนและแท็บ "ฉัน" (1B70)
// ------------------------------------------------------------
// ผู้ใช้สั่งเอง: "ตรงโปรไฟล์ฉันอยากให้มันเป็นอันเดียวกัน ต้องเป็นอันเดียวกัน
// ตอนเพื่อนเปิดดูของเราก็จะเป็นหน้านี้"
//
// เหตุผลที่ลึกกว่าความสวย: ถ้าหน้าตัวเองกับหน้าที่คนอื่นเห็นเป็นคนละหน้า
// **ไม่มีใครรู้เลยว่าคนอื่นเห็นเราเป็นยังไง** — ซึ่งเป็นสิ่งที่คนแก้ให้ดีขึ้นไม่ได้
// ถ้ามองไม่เห็น · IG แก้ข้อนี้ด้วยการใช้หน้าเดียวกัน ต่างแค่ปุ่ม
//
// ฟังก์ชันนี้จึงเป็น **แหล่งเดียว** ของหัวโปรไฟล์ทั้งแอป
// วันไหนแก้ ต้องแก้ที่นี่ที่เดียว และทั้งสองจอเปลี่ยนพร้อมกันเสมอโดยอัตโนมัติ
// ============================================================
function profileHeadHTML(u, opts) {
  const o = opts || {};
  const name = personName(u);
  const n = (v) => (v > 999 ? (v / 1000).toFixed(1).replace('.0', '') + 'k' : (v || 0));
  const where = [u.grade, u.school].filter(Boolean).join(' · ');
  const chips = []
    .concat((u.strong || []).map(x => `<span class="ig-chip good">ช่วยได้ · ${esc(x)}</span>`))
    .concat((u.weak || []).map(x => `<span class="ig-chip need">อยากได้ · ${esc(x)}</span>`));

  // รูป: แตะแล้วขยายเสมอ · ของตัวเองมีป้ายกล้องมุมล่างขวาไว้เปลี่ยนรูป (ทรงเดียวกับ IG)
  const face = u.avatar
    ? `<img class="ig-av tap" src="${esc(u.avatar)}" alt="รูปโปรไฟล์"
         onclick="openFace('${esc(u.avatar)}','${esc(name).replace(/'/g, "\\'")}')">`
    : `<div class="ig-av" style="${faceTint(u)}">${esc(faceLetter(u))}</div>`;

  // ============================================================
  // 1B95 · หัวของ "ฉัน" กับหัวของ "เพื่อน" ต่างกันสามจุด
  // ------------------------------------------------------------
  // ยังเป็นฟังก์ชันเดียวกันตามมติ 1B70 (เปิดหน้าตัวเองต้องเห็นของจริงที่เพื่อนเห็น)
  // แต่หน้าตัวเองมีงานเพิ่มอีกอย่างที่หน้าเพื่อนไม่มี คือ "เข้าไปตั้งค่า"
  //
  // 1) แถวบนสุด: @ชื่อผู้ใช้ · ชั้นเรียน ทางซ้าย — เฟืองทางขวา
  //    เจ้าของสั่งเอง (14 ก.ย. 2569): "ฟันเฟืองต้องอยู่ด้านบนขวา"
  //    ของเดิมเป็นปุ่มลอย .top-set แบบ position:fixed อยู่นอกกองจอ พอเลื่อนหน้าลงมา
  //    มันไม่เลื่อนตาม แล้วไปทับคำว่า "ดูทั้งหมด" ของบล็อกผลของฉันพอดี (ผู้ใช้ส่งภาพมา)
  //    ย้ายเข้ามาอยู่ในหัวจึงหายไปกับเนื้อหาเวลาเลื่อน และไม่ทับอะไรอีกเลย
  //
  // 2) บรรทัดชื่อเหลือแค่ชื่อกับป้ายนักเรียน — ชั้นเรียนย้ายขึ้นไปแถวบนแล้ว
  //    ที่ใต้ชื่อคืนให้ bio ตรงที่ IG วางไว้ ("ไอที่มันอยู่ด้านล่างชื่อคือ bio")
  //
  // 3) ชิปวิชาไม่ขึ้นในหน้าตัวเอง — ไปเป็นแถว "วิชาของฉัน" ในลิสต์ข้างล่างแทน
  //    **แต่ยังขึ้นครบในหน้าที่เพื่อนเปิดดู** เพราะนั่นคือที่ที่มันทำงานจริง:
  //    คนอื่นใช้ชิปหาว่าเราช่วยอะไรได้ ส่วนเราไม่ต้องโชว์ให้ตัวเองดู แค่มีทางไปแก้ก็พอ
  // 1C10 · ทรง compact ของหัวแท็บ "ฉัน" ถูกถอดทั้งก้อน — เจ้าของดูของจริงแล้วบอกว่า
  //   "ด้านบนการ์ดตัวแรกขอแบบเดิม มันแปลกๆอยู่นะ ไม่เหมือนที่คิดไว้" (19 ก.ย. 2569)
  // ตัวเลขที่ 1C09 อ้าง (หัวสูง 232px = 29% ของจอแรก) ยังจริงอยู่ แต่มันไม่ใช่ปัญหา
  // ที่เจ้าของรู้สึก · หัวโปรไฟล์ของจอนี้คือหน้าเดียวกับที่เพื่อนเปิดดูตามมติ 1B70
  // พอย่อฝั่งเดียว สองจอก็เลิกเป็นหน้าเดียวกัน ซึ่งเป็นเหตุผลทั้งหมดที่ 1B70 มีอยู่
  // ฟังก์ชันนี้จึงกลับไปมีทรงเดียวเหมือนเดิม และทั้งสองจอเปลี่ยนพร้อมกันเสมออีกครั้ง

  const topRow = o.mine ? `
    <div class="ig-top">
      <span class="ig-hd">${[u.handle ? '@' + esc(u.handle) : '', esc(where)]
        .filter(Boolean).join(' · ') || 'ยังไม่มีชื่อผู้ใช้'}</span>
      <button class="ig-set" onclick="go('scr-settings')" aria-label="ตั้งค่า">${icon('cog')}</button>
    </div>` : '';

  return `${topRow}
    <div class="ig-head">
      <div class="ig-av-wrap">
        ${face}
        ${o.mine ? `<button class="ig-av-cam" aria-label="เปลี่ยนรูปโปรไฟล์"
          onclick="document.getElementById('avInput').click()">${icon('camera')}</button>` : ''}
      </div>
      <div class="ig-stats num-row">
        <button onclick="switchUserTab('posts')"><b>${n(u.post_count)}</b><span>โพสต์</span></button>
        <div><b>${n(u.friend_count)}</b><span>เพื่อน</span></div>
        <button onclick="switchUserTab('answers')"><b>${n(u.help_count)}</b><span>ช่วยแล้ว</span></button>
      </div>
    </div>

    <div class="ig-id">
      <b>${esc(name)}<span class="ig-tick">${icon('check')}นักเรียน</span></b>
      ${!o.mine && where ? `<i>${esc(where)}</i>` : ''}
      ${o.extra || ''}
    </div>
    ${u.bio ? `<p class="ig-bio">${esc(u.bio)}</p>` : ''}
    ${o.buttons || ''}
    ${!o.mine && chips.length ? `<div class="ig-strip">${chips.join('')}</div>` : ''}`;
}

// ---------- ก้อนโปรไฟล์ของตัวเอง ----------
// ถามผ่าน user_card ตัวเดียวกับหน้าเพื่อน — ตัวเลขจึงนับด้วยกติกาเดียวกันเป๊ะ
// ถ้าคิดเองฝั่งแอป วันหนึ่งสองหน้าจะบอกเลขไม่ตรงกันโดยไม่มีใครรู้ว่าอันไหนถูก
let myCard = null;
let myCardAt = 0;
async function loadMyCard(force) {
  if (!sb || !currentUser) { myCard = null; return; }
  if (!force && myCard && Date.now() - myCardAt < 60000) return;
  myCardAt = Date.now();
  const { data } = await sb.rpc('user_card', { p_user: currentUser.id });
  myCard = (Array.isArray(data) ? data[0] : data) || null;
  renderProfileHead();
}

// วาดหัวในแท็บ "ฉัน" · เรียกจาก renderProfile ใน app.js
function renderProfileHead() {
  const box = document.getElementById('pfHead');
  if (!box) return;

  // ยังไม่ได้ล็อกอิน = ไม่มีโปรไฟล์สาธารณะให้โชว์ · บอกตรง ๆ แล้วให้ทางไปต่อ
  if (!currentUser) {
    const nm = (state.settings.name || '').trim() || 'นักเรียน';
    const pic = typeof userAvatar === 'function' ? userAvatar() : '';
    box.innerHTML = profileHeadHTML(
      { display_name: nm, avatar: pic || null, strong: [], weak: [],
        post_count: 0, friend_count: 0, help_count: 0 },
      { mine: true,
        buttons: `<div class="ig-btns">
          <button class="pri" onclick="setLoginView('root');go('scr-login')">${icon('user')}เข้าสู่ระบบ</button>
        </div>`,
        extra: '<i>ยังไม่ล็อกอิน — เพื่อนยังหาคุณไม่เจอ</i>' });
    return;
  }

  // ระหว่างรอเซิร์ฟเวอร์ ใช้ของในเครื่องไปก่อน จอจะได้ไม่ว่างหนึ่งจังหวะ
  const local = {
    id: currentUser.id,
    display_name: (state.settings.name || '').trim(),
    handle: (typeof frHandle !== 'undefined' && frHandle) ? frHandle : '',
    avatar: (typeof userAvatar === 'function' ? userAvatar() : '') || null,
    strong: [], weak: [], post_count: 0, friend_count: 0, help_count: 0,
  };
  const u = Object.assign(local, myCard || {});
  // รูปในเครื่องมาก่อนของเซิร์ฟเวอร์เสมอ — เครื่องนี้คือที่ที่เขาเพิ่งตั้งมัน
  if (local.avatar) u.avatar = local.avatar;
  // 1B95 · @ชื่อผู้ใช้ขึ้นไปอยู่แถวบนสุดของหัวแล้ว จึงต้องไม่หายระหว่างรอเซิร์ฟเวอร์
  // Object.assign ข้างบนปล่อยให้ handle ของ myCard (ซึ่งอาจเป็น null) ทับของในเครื่องได้
  if (!u.handle && local.handle) u.handle = local.handle;

  // ปุ่มซ้ายกลับเป็นพื้นทึบตามเดิมใน 1C10 — 1C09 ลดมันลงเป็นปุ่มเงียบพร้อมกับย่อหัว
  // พอหัวกลับเป็นทรงเดิม ปุ่มก็ต้องกลับด้วย ไม่งั้นได้ทรงเดิมที่ปุ่มผิดสี
  // (ปุ่มขวายังเรียก openMyPublic() ซึ่งมีด่านกันคนยังไม่ล็อกอิน — ของเดิมยิง
  //  openUser(currentUser.id) ตรง ๆ ซึ่งพังถ้า currentUser หลุดไประหว่างทาง)
  box.innerHTML = profileHeadHTML(u, {
    mine: true,
    buttons: `<div class="ig-btns">
      <button class="pri" onclick="go('scr-people'); renderMates()">${icon('pencil')}แก้ไขโปรไฟล์</button>
      <!-- ปุ่มนี้คือหัวใจของการรวมสองหน้า — กดแล้วเห็นของจริงที่เพื่อนเห็น
           ไม่ใช่ภาพจำลอง เพราะมันเปิดหน้าเดียวกับที่เพื่อนเปิดจริง ๆ -->
      <button onclick="openMyPublic()">${icon('users')}ดูแบบที่เพื่อนเห็น</button>
    </div>`,
  });
}

// ============================================================
// แตะรูปโปรไฟล์แล้วขยาย (1B69)
// ------------------------------------------------------------
// ผู้ใช้ขอเอง "อยากให้กดรูปแล้วขยาย แบบ IG"
// วงกลม 74px บอกไม่ได้ว่าในรูปมีใครอยู่บ้าง — ซึ่งเป็นข้อมูลที่คนอยากได้จริง
// ตอนกำลังตัดสินใจว่าจะทักคนแปลกหน้าคนนี้ดีไหม
//
// สร้างชั้นซ้อนสด ๆ แล้วลบทิ้งเมื่อปิด ไม่ใช่ซ่อนไว้ในหน้าตลอดเวลา —
// รูปเป็น data URL ขนาดหลายสิบ KB การถือ <img> ที่ซ่อนอยู่ไว้ทุกจอคือหน่วยความจำเปล่า
function openFace(src, name) {
  if (!src) return;
  const box = document.createElement('div');
  box.className = 'face-zoom';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'รูปโปรไฟล์');
  box.innerHTML = `<img src="${esc(src)}" alt="รูปโปรไฟล์ของ${esc(name || '')}">`;
  // แตะที่ไหนก็ปิด · ปุ่มปิดแยกอีกอันคือของที่ต้องเล็งกดโดยไม่จำเป็น
  box.onclick = () => box.remove();
  document.addEventListener('keydown', function esc2(e) {
    if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc2); }
  });
  document.body.appendChild(box);
}

// ---------- ชื่อที่เอาไปโชว์จริง ----------
// profiles.display_name มี default เป็น 'นักเรียน' อยู่ใน schema (migration 10)
// แปลว่าคนที่ยังไม่เคยตั้งชื่อ **มีชื่อว่า "นักเรียน" จริง ๆ ในฐานข้อมูล** ไม่ใช่ค่าว่าง
// ทุกจอจึงขึ้นคำเดียวกันหมด และตัวอักษรแรกในวงกลมกลายเป็น "น" เหมือนกันทุกคน —
// เปิดหน้าใครก็เหมือนเปิดหน้าเดิม ซึ่งผู้ใช้ทักมาเองเมื่อ 10 ก.ย. 2569
//
// ทางแก้: ถ้ายังไม่ได้ตั้งชื่อ ใช้ @ชื่อผู้ใช้แทน เพราะมันไม่ซ้ำกันและเป็นของเขาจริง
// ส่วนคำว่า "นักเรียน" ย้ายไปเป็นป้ายติ๊กถูกข้างชื่อ ตามที่ผู้ใช้เสนอ
const NO_NAME = 'นักเรียน';
function personName(u) {
  if (!u) return NO_NAME;
  // บางจอส่งฟิลด์ชื่อมาว่า name (แถวออนไลน์ · การ์ดในหัวข้อโลก) บางจอส่ง display_name
  // รับทั้งสองอย่างตรงนี้ที่เดียว จะได้ไม่ต้องมีจอไหนคิดชื่อเองอีก
  const raw = u.display_name != null ? u.display_name : u.name;
  const n = String(raw || '').trim();
  if (n && n !== NO_NAME) return n;
  const h = String(u.handle || '').trim();
  return h || NO_NAME;
}

// ============================================================
// วงกลมหน้าคน — แหล่งเดียวของทั้งแอป (1B75)
// ------------------------------------------------------------
// กติกามีข้อเดียว: **ตัวอักษรกับสีต้องมาจากชื่อที่คนเห็นบนจอเดียวกันนั้น**
// ถ้าจอหนึ่งโชว์ชื่อว่า sos1048666 แต่วงกลมข้าง ๆ เอา "นักเรียน" ไปคิดสี
// วงกลมนั้นก็ไม่ได้แทนใครเลย · และคนคนเดียวกันจะเปลี่ยนหน้าไปมาระหว่างจอ
// ซึ่งอ่านเหมือนแอปจำคนผิด มากกว่าจะอ่านเป็นเรื่องสีสวยไม่สวย
//
// ตัวพิมพ์ใหญ่เฉพาะ a-z: ชื่อผู้ใช้ที่ระบบตั้งให้เป็นตัวเล็กหมด (sos1048666)
// ตัวเล็กตัวเดียวกลางวงกลมใหญ่อ่านเหมือนตัวอักษรหลุดมา ไม่เหมือนหน้าคน
// ภาษาไทยไม่มีตัวใหญ่ตัวเล็ก จึงไม่แตะ
function faceLetter(u) {
  const c = personName(u).trim().slice(0, 1);
  return /[a-z]/.test(c) ? c.toUpperCase() : (c || '?');
}
function faceTint(u) {
  return avOf(personName(u));
}

let theUserPosts = [];
let userBusy = false;

// ============================================================
// 1B95b · จอโปรไฟล์กับจอเธรดก็ต้องจำทางกลับเหมือนกัน
// ------------------------------------------------------------
// ผู้ใช้กด "ดูแบบที่เพื่อนเห็น" จากแท็บ "ฉัน" แล้วกดย้อนกลับ → **ได้จอขาวล้วน**
// ที่มีแต่ปุ่ม AI ลอยอยู่ (ส่งภาพมา 14 ก.ย. 2569 เวลา 14:02)
//
// ต้นเหตุ: ปุ่มย้อนกลับของจอนี้เขียนตายตัวว่า go('scr-mates') เหมือนกับที่กล่องข้อความ
// เคยเป็น · ฟีดวาดเนื้อในด้วย JS ทั้งใบ และ go() ไม่ได้สั่งวาด — ใครที่ไม่เคยเปิดฟีด
// มาก่อนในรอบนี้ จึงถูกส่งไปยืนอยู่บนจอที่ยังไม่มีอะไรอยู่ในนั้นเลย
//
// 1B95 ทำให้เจอง่ายขึ้นมาก เพราะชุมชนถูกปิด คนทั่วไปจึงไม่มีเหตุให้เปิดฟีดอีกแล้ว
// ทางเดียวที่เคยกลบบั๊กนี้ไว้คือ "บังเอิญเคยเปิดฟีดมาก่อน"
//
// แก้สองชั้น: จำจอที่เข้ามา + ทางกลับที่ลงฟีดต้องผ่าน backToFeed() ซึ่งสั่งวาดเสมอ
let userReturn = 'scr-mates';
let postReturn = 'scr-mates';

// ห้ามใช้ go('scr-mates') ดิบ ๆ จากที่ไหนอีก — จอนั้นว่างเปล่าจนกว่าจะมีคนสั่งวาด
function backToFeed() {
  if (typeof openFeed === 'function') openFeed(feedView);
  else go('scr-mates');
}
function userBack() {
  if (userReturn === 'scr-mates') { backToFeed(); return; }
  go(userReturn);
}
function postBack() {
  if (postReturn === 'scr-mates') { backToFeed(); return; }
  go(postReturn);
}

async function openUser(id) {
  if (!id || !sb || !currentUser) return;
  userReturn = (typeof pickReturn === 'function') ? pickReturn('scr-mates', 'scr-user') : 'scr-mates';
  theUser = null; theUserPosts = []; userBusy = true;
  // เปิดหน้าใหม่ = รีเซ็ตแท็บกลับมาที่โพสต์เสมอ ไม่ใช่ค้างแท็บของคนก่อนหน้า
  userTab = 'posts'; userAnswers = null; answersBusy = false;
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

// ============================================================
// หน้าโปรไฟล์ — ทรงเดียวกับ Instagram (1B65)
// ------------------------------------------------------------
// ผู้ใช้ขอเองเมื่อ 9 ก.ย. 2569 พร้อมส่งหน้า IG ของตัวเองมาให้ดู
//
// ของเดิมวางแบบ "การ์ดแนะนำตัว" — รูปกลางจอ ชื่อใต้รูป แล้วสองคอลัมน์วิชา
// ซึ่งกินครึ่งจอบนไปกับข้อมูลที่ตอบไม่ได้เลยว่า **คนนี้น่าเชื่อแค่ไหน**
// และปุ่มทักตกไปอยู่ล่างสุดจนต้องเลื่อนหา
//
// ทรงของ IG แก้ทั้งสองข้อพร้อมกัน: รูปกับตัวเลขอยู่บรรทัดเดียวกัน
// ตัวเลขตอบคำถามแรกที่คนดูโปรไฟล์คนแปลกหน้าถามเสมอ ("คนนี้มีตัวตนจริงไหม")
// แล้วปุ่มอยู่เหนือพับจอเสมอ
//
// ตัวเลขที่เลือกมาสามตัว: โพสต์ · เพื่อน · **ช่วยแล้ว**
// ตัวที่สามแทนที่ "ผู้ติดตาม" ของ IG โดยตั้งใจ — แอปนี้ไม่มีการติดตาม และ
// บทเรียนเดิมที่ผู้ใช้เคยปฏิเสธไว้คือ "นักเรียนไม่ได้อยากอวดว่าทำงานเสร็จกี่ชิ้น"
// ตัวเลขที่ควรอวดจึงต้องเป็นสิ่งที่เขาทำให้ **คนอื่น** ไม่ใช่สิ่งที่เขาทำให้ตัวเอง
// ============================================================
let userTab = 'posts';        // posts | answers
let userAnswers = null;       // null = ยังไม่เคยโหลด
let answersBusy = false;

function switchUserTab(t) {
  userTab = t;
  renderUser();
  if (t === 'answers' && userAnswers === null) loadUserAnswers();
}

async function loadUserAnswers() {
  if (!theUser || !sb) return;
  answersBusy = true; renderUser();
  const { data, error } = await sb.rpc('user_answers', { p_user: theUser.id, p_limit: 20 });
  answersBusy = false;
  userAnswers = error ? [] : (data || []);
  renderUser();
}

function renderUser() {
  const box = document.getElementById('userBody');
  if (!box) return;

  if (userBusy && !theUser) {
    box.innerHTML = `<div class="cp-top"><button class="cp-x" onclick="userBack()">${icon('chevron')}</button>
      <b>โปรไฟล์</b><span></span></div><p class="so-hint" style="padding:0 14px">กำลังเปิด…</p>`;
    return;
  }
  if (!theUser) {
    box.innerHTML = `<div class="cp-top"><button class="cp-x" onclick="userBack()">${icon('chevron')}</button>
      <b>โปรไฟล์</b><span></span></div>
      <div class="so-empty" style="margin:14px">
        <p class="so-empty-h">เปิดหน้านี้ไม่ได้</p>
        <p class="so-empty-p">อาจเป็นเพราะบัญชีนี้ถูกลบไปแล้ว หรือคุณกับเขาบล็อกกันอยู่</p>
      </div>`;
    return;
  }

  const u = theUser;
  const on = onlineOf(u.id);
  const name = personName(u);
  const n = (v) => (v > 999 ? (v / 1000).toFixed(1).replace('.0', '') + 'k' : (v || 0));

  // บรรทัดใต้ชื่อ — ช่วงชั้นกับโรงเรียน · โรงเรียนไม่โผล่ให้คนต่างประเทศเห็น
  // (ฝั่งเซิร์ฟเวอร์คืน null มาให้เองแล้ว ฝั่งนี้จึงไม่ต้องรู้กติกาซ้ำอีกที่)
  const where = [u.grade, u.school].filter(Boolean).join(' · ');

  const chips = []
    .concat((u.strong || []).map(x => `<span class="ig-chip good">ช่วยได้ · ${esc(x)}</span>`))
    .concat((u.weak || []).map(x => `<span class="ig-chip need">อยากได้ · ${esc(x)}</span>`));

  box.innerHTML = `
    <div class="cp-top">
      <button class="cp-x" onclick="userBack()">${icon('chevron')}</button>
      <b>${u.handle ? '@' + esc(u.handle) : esc(name)}</b>
      ${u.mine ? '<span></span>' : `<button class="cp-flag" aria-label="รายงานหรือบล็อก"
        onclick="openReport('user','${esc(u.id)}')">${icon('flag')}</button>`}
    </div>

    <div class="us-scroll">
      ${profileHeadHTML(u, {
        mine: false,
        extra: on ? `<div class="us-live${on.subject ? ' busy' : ''}">
            <span class="rm-dot"></span>${on.subject
              ? 'กำลังติว' + esc(on.subject) + 'อยู่' : 'ออนไลน์อยู่'}</div>` : '',
        buttons: u.mine ? '' : (() => {
          const f = FRIEND_BTN[friendState] || FRIEND_BTN.none;
          return `<div class="ig-btns">
            <button class="pri" onclick="pokeUser()">${icon('chat')}ทัก</button>
            <button class="${f.cls}" onclick="${f.act}">
              ${icon(friendState === 'friends' ? 'check' : 'users')}${f.t}</button>
          </div>`;
        })(),
      })}

      <!-- เหตุผลที่ควรทักเขา — ของชิ้นเดียวบนหน้านี้ที่ IG ไม่มีและลอกไม่ได้
           เพราะมันมาจากการที่แอปรู้ว่าใครจมวิชาไหน -->
      ${(u.match && u.match.length) || (u.give && u.give.length) ? `<div class="ig-why">
        ${u.match && u.match.length
          ? `<p class="so-why good">เก่ง<b>${esc(u.match.join(' · '))}</b> ซึ่งเป็นวิชาที่คุณกำลังจม</p>` : ''}
        ${u.give && u.give.length
          ? `<p class="so-why give">กำลังจม<b>${esc(u.give.join(' · '))}</b> ซึ่งคุณช่วยได้</p>` : ''}
      </div>` : ''}

      <div class="ig-tabs">
        <button class="${userTab === 'posts' ? 'on' : ''}" onclick="switchUserTab('posts')">
          ${icon('type')}โพสต์</button>
        <button class="${userTab === 'answers' ? 'on' : ''}" onclick="switchUserTab('answers')">
          ${icon('chat')}คำตอบ</button>
      </div>

      <div class="ig-tabbody">${userTab === 'posts' ? userPostsHTML(u, name) : userAnswersHTML(u)}</div>
    </div>`;
}

function userPostsHTML(u, name) {
  if (theUserPosts.length) {
    return theUserPosts.map(p => postCard(Object.assign({}, p, {
      display_name: p.anon ? null : name, avatar: u.avatar, author: u.id, for_me: false,
    }))).join('');
  }
  return `<p class="so-hint">${u.mine
    ? 'โพสต์ของคุณจะมาอยู่ตรงนี้'
    : 'เขายังไม่เคยโพสต์อะไรที่คุณเห็นได้'}</p>`;
}

// แท็บคำตอบทำให้ตัวเลข "ช่วยแล้ว" กดดูได้ ไม่ใช่เลขลอย ๆ
// ตัวเลขที่กดไม่ได้คือตัวเลขที่ไม่มีใครเชื่อ
function userAnswersHTML(u) {
  if (answersBusy && userAnswers === null) return '<p class="so-hint">กำลังโหลด…</p>';
  const rows = userAnswers || [];
  if (!rows.length) {
    return `<p class="so-hint">${u.mine
      ? 'คำตอบที่คุณเขียนให้คนอื่นจะมาอยู่ตรงนี้'
      : 'เขายังไม่เคยตอบใครในที่ที่คุณเห็นได้'}</p>`;
  }
  return rows.map(r => `<div class="ig-ans" onclick="${r.kind === 'topic'
      ? `openTThread('${esc(r.ref)}')` : `openPost('${esc(r.ref)}')`}">
    <div class="ig-ans-h">
      <span class="ig-ans-tag">${r.kind === 'topic' ? 'ในหัวข้อ' : 'ใต้โพสต์'}</span>
      ${r.topic || r.subject ? `<span>${esc(r.topic || r.subject)}</span>` : ''}
      <i>${r.at && typeof ago === 'function' ? esc(ago(r.at)) : ''}</i>
    </div>
    <p>${esc(String(r.body || '').slice(0, 160))}</p>
  </div>`).join('');
}

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
  // เลขต้องอยู่บนปุ่มที่พาไปยังที่ที่กดตอบคำขอได้จริง — เดิมมันอยู่บนปุ่มที่พาไป
  // หน้า "วิชาของฉัน" ซึ่งไม่ใช่ที่ที่คำขออยู่อีกต่อไปแล้วหลังยุบสองจอเข้าด้วยกัน
  const n = friendInbox.length;
  const el = document.getElementById('frTabN');
  if (el) { el.hidden = !n; el.textContent = n > 9 ? '9+' : String(n); }
}

// ---------- คำขอที่รอตอบ วาดไว้บนสุดของหน้า "คนในห้อง" ----------
function friendInboxHTML() {
  if (!friendInbox.length) return '';
  return `<div class="fi-box">
    <div class="fi-h">${icon('users')}คำขอเป็นเพื่อน ${friendInbox.length}</div>
    ${friendInbox.map(u => `<div class="fi-row">
      ${u.avatar
        ? `<img class="fd-av" src="${esc(u.avatar)}" alt="">`
        : `<div class="fd-av" style="${faceTint(u)}">${esc(faceLetter(u))}</div>`}
      <div class="fi-bd">
        <b>${esc(personName(u))}</b>
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
