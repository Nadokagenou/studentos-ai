// ============================================================
// ข่าวสารจากทีมพัฒนา (จอ scr-news)
// ------------------------------------------------------------
// เจ้าของสั่ง (15 ต.ค. 69): ระบบประกาศถึงผู้ใช้ — ฟีเจอร์ใหม่ · ธีมใหม่ · อัปเดตแอป
// แสดงในหน้าข่าวสาร **แยกจากการแจ้งเตือนงาน** และห้ามมีข่าวของที่ยังไม่มีจริง
//
// ทำไมแยกจากจอ "การแจ้งเตือน" (scr-notif):
//   จอนั้นคือ "มีอะไรเข้ามาถึงฉัน" (งาน · ข้อความเพื่อน) — ของที่ต้องตัดสินใจ
//   ข่าวจากทีมไม่ได้ขอให้ตัดสินใจอะไร ถ้าไปปนกัน เลขบนกระดิ่งจะนับของที่ไม่เร่ง
//   แล้วคนจะเลิกเชื่อกระดิ่ง · ข่าวจึงอยู่แท็บ "ฉัน" ไม่แตะกระดิ่ง ไม่แตะหน้าแรก
//
// ที่มาของข่าว: alt/news/announcements.json ใน repo (แก้ผ่าน PR เท่านั้น)
//   ทุกประกาศต้องผ่าน `node alt/devtools/news.mjs check` ซึ่งบังคับให้ทุกประโยค
//   ยกคำพูดจากแพตช์โน้ตหรือคอมมิตจริงมาเป็นหลักฐาน — ดู alt/news/README.md
//   ร่างที่ AI เสนออยู่ใน news/drafts.json ซึ่งแอปไม่โหลด (ยกเว้น ?newsDraft=1 ไว้ตรวจ)
//
// คีย์ใหม่สองตัว ไม่แตะคีย์เดิม: studentos.alt.newsCache (สำเนาไฟล์ ล้างได้เสมอ)
//   · studentos.alt.newsSeen (ประกาศไหนเปิดดูแล้ว)
// ============================================================
const NEWS_URL = 'news/announcements.json';
const NEWS_DRAFT_URL = 'news/drafts.json';
const NEWS_CACHE_KEY = 'studentos.alt.newsCache';
const NEWS_SEEN_KEY = 'studentos.alt.newsSeen';
// ประกาศเก่ากว่านี้ไม่นับเป็น "ใหม่" แม้ยังไม่เคยเปิด — คนเพิ่งติดตั้งไม่ต้องเจอเลขค้างสิบอัน
const NEWS_FRESH_DAYS = 30;
// [ชื่อ, ไอคอน] · ไม่ใช้ประกาย (sparkles) — 1C57 ถอดออกทั้งแอปเพราะเป็นท่าของแอป AI
const NEWS_KINDS = {
  feature: ['ฟีเจอร์ใหม่', 'zap'],
  theme:   ['ธีมใหม่', 'contrast'],
  update:  ['อัปเดตแอป', 'download'],
  fix:     ['แก้ไข', 'check'],
};
// จอที่ปุ่มในประกาศพาไปได้ — ต้องเป็นจอที่ go() เปล่า ๆ วาดเนื้อหาเองได้
// (ดูความจำ render-screens-need-their-open-fn) · news.mjs check อ่านรายการนี้ ประกาศที่ชี้จออื่นไม่ผ่าน
const NEWS_OPEN = ['scr-notif', 'scr-room', 'scr-shop', 'scr-settings', 'scr-tasks'];

// ?newsDraft=1 ต้องอยู่รอดการโหลดหน้าใหม่: app.js ลบคิวรีทิ้งตอนบูต แล้ว service worker ตัวใหม่
// สั่งโหลดหน้าซ้ำอีกรอบ — จำไว้ในแท็บนี้แท็บเดียว (sessionStorage) · ?newsDraft=0 = เลิก
const newsDraftMode = (() => {
  const m = /[?&]newsDraft=([01])\b/.exec(location.search);
  try {
    if (m) { if (m[1] === '1') sessionStorage.setItem('studentos.alt.newsDraft', '1'); else sessionStorage.removeItem('studentos.alt.newsDraft'); }
    return sessionStorage.getItem('studentos.alt.newsDraft') === '1';
  } catch (_) { return !!m && m[1] === '1'; }
})();
let newsItems = null;       // null = ยังไม่เคยได้ไฟล์เลย (ทั้งจากเน็ตและสำเนา)
let newsDrafts = [];
let newsLoadedAt = 0;
let newsFailed = false;
let newsVisit = null;       // ประกาศที่ "ใหม่" ตอนเปิดจอ — ไฮไลต์ไว้จนออกจากจอ (ท่าเดียวกับ notifVisit)

// ของที่หน้าตาไม่ครบไม่แสดง — ไฟล์เสียบางชิ้นต้องไม่ทำให้ทั้งจอพัง
// ประกาศที่ไม่มีหลักฐานแนบไม่แสดงด้วย: ด่านสุดท้ายถ้ามีคนแก้ไฟล์ตรงโดยไม่ผ่าน check
function newsValid(it) {
  return !!it && typeof it.id === 'string' && typeof it.title === 'string' && it.title.trim()
    && typeof it.body === 'string' && NEWS_KINDS[it.kind] && !isNaN(Date.parse(it.date))
    && Array.isArray(it.evidence) && it.evidence.length > 0;
}
function newsClean(doc) {
  const list = doc && doc.schema === 1 && Array.isArray(doc.items) ? doc.items.filter(newsValid) : [];
  return list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function newsFromCache() {
  try {
    const c = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY));
    if (c && Array.isArray(c.items)) newsItems = newsClean({ schema: 1, items: c.items });
  } catch (_) {}
}

async function newsFetch(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return newsClean(await r.json());
}

// ถามไฟล์ห่างกันอย่างน้อย 10 นาที (ไฟล์ข่าวเปลี่ยนเป็นวัน ไม่ใช่เป็นนาที) · เปิดจอข่าว = ถามเสมอ
async function newsLoad(force) {
  if (!force && Date.now() - newsLoadedAt < 600000) return;
  newsLoadedAt = Date.now();
  try {
    newsItems = await newsFetch(NEWS_URL);
    newsFailed = false;
    try { localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ at: Date.now(), items: newsItems })); } catch (_) {}
  } catch (_) {
    newsFailed = true;     // ออฟไลน์ = ใช้สำเนาเดิมต่อ (newsItems ไม่ถูกล้าง)
  }
  if (newsDraftMode) {
    try { newsDrafts = await newsFetch(NEWS_DRAFT_URL); } catch (_) { newsDrafts = []; }
  }
  newsPaintRow();
  if (typeof curScreen !== 'undefined' && curScreen === 'scr-news') renderNews();
}

function newsSeen() {
  try { const s = JSON.parse(localStorage.getItem(NEWS_SEEN_KEY)); if (s && Array.isArray(s.ids)) return s; } catch (_) {}
  return { ids: [] };
}
function newsSaveSeen(s) {
  // เก็บแค่ 200 id ล่าสุด — ไฟล์ข่าวโตได้เรื่อย ๆ แต่ที่จำต้องไม่โตตาม
  s.ids = s.ids.slice(-200);
  try { localStorage.setItem(NEWS_SEEN_KEY, JSON.stringify(s)); } catch (_) {}
}
function newsIsFresh(it) {
  return Date.now() - Date.parse(it.date) < NEWS_FRESH_DAYS * 864e5;
}
function newsUnreadList() {
  const ids = new Set(newsSeen().ids);
  return (newsItems || []).filter(it => !ids.has(it.id) && newsIsFresh(it));
}

// เลขบนแถว "ข่าวสาร" ในแท็บฉัน — ทรงเดียวกับเลขข้อความค้าง (.pe-n)
function newsPaintRow() {
  const n = newsUnreadList().length;
  const b = document.getElementById('peNewsN');
  if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); }
  const v = document.getElementById('peNewsCt');
  // คอลัมน์ขวาบอกรุ่นของประกาศล่าสุด — ไม่ใช่ APP_VERSION เพราะสองอย่างนี้ไม่ได้ขยับพร้อมกัน
  if (v) v.textContent = newsItems && newsItems.length ? 'รุ่น ' + newsItems[0].release : '';
  const row = document.getElementById('peNews');
  if (row) row.setAttribute('aria-label', n ? `ข่าวสารจากทีม ใหม่ ${n} เรื่อง` : 'ข่าวสารจากทีม');
}

const NEWS_TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function newsDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return `${d} ${NEWS_TH_MONTH[m - 1]} ${String(y + 543).slice(-2)}`;
}

function newsGo(screen) {
  if (!NEWS_OPEN.includes(screen) || !document.getElementById(screen)) return;
  go(screen);
}

function newsCard(it, isNew, draft) {
  const [kName, kIc] = NEWS_KINDS[it.kind];
  const pts = (it.points || []).filter(p => typeof p === 'string' && p.trim());
  const a = it.action && NEWS_OPEN.includes(it.action.screen) && document.getElementById(it.action.screen) ? it.action : null;
  return `<article class="nw-card${isNew ? ' new' : ''}${draft ? ' draft' : ''}">
    <div class="nw-top">
      <span class="nw-kind">${icon(kIc)}<b>${kName}</b></span>
      ${draft ? '<span class="nw-tag draft">ร่าง · ยังไม่เผยแพร่</span>' : isNew ? '<span class="nw-tag">ใหม่</span>' : ''}
    </div>
    <h3 class="nw-t">${esc(it.title)}</h3>
    <p class="nw-b">${esc(it.body)}</p>
    ${pts.length ? `<ul class="nw-pts">${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    <div class="nw-foot">
      <span class="nw-meta">รุ่น ${esc(it.release || '')}<i aria-hidden="true">·</i>${esc(newsDate(it.date))}</span>
      ${a ? `<button class="nw-go" onclick="newsGo('${esc(a.screen)}')">${esc(a.label)}${icon('chevron')}</button>` : ''}
    </div>
  </article>`;
}

// เข้าจอ (จาก go) = รอบเปิดใหม่ — ป้าย "ใหม่" ของรอบก่อนต้องหาย
// แยกจาก renderNews เพราะ renderAll วาดจอนี้ซ้ำได้ระหว่างที่เปิดอยู่ ซึ่งต้องคงป้ายไว้
function newsEnter() {
  newsVisit = null;
  renderNews();
}

function renderNews() {
  const body = document.getElementById('newsBody');
  if (!body) return;
  const onScr = typeof curScreen !== 'undefined' && curScreen === 'scr-news';
  if (onScr && Date.now() - newsLoadedAt > 30000) newsLoad(true);   // วาดของที่มีก่อน ไฟล์ใหม่มาแล้ววาดซ้ำเอง

  const items = newsItems || [];
  if (!onScr) newsVisit = null;
  else {
    // เปิดจอ = อ่านแล้ว แต่ของที่ใหม่ตอนเข้ามายังติดป้าย "ใหม่" จนออกจากจอ
    if (!newsVisit) newsVisit = new Set();
    const unread = newsUnreadList();
    if (unread.length) {
      unread.forEach(it => newsVisit.add(it.id));
      const s = newsSeen(); s.ids = s.ids.concat(unread.map(it => it.id)); newsSaveSeen(s);
      newsPaintRow();
    }
  }
  const isNew = it => !!(newsVisit && newsVisit.has(it.id));

  const sub = document.getElementById('newsSub');
  if (sub) sub.textContent = 'ฟีเจอร์ใหม่ · ธีมใหม่ · อัปเดตแอป';

  const drafts = newsDraftMode && newsDrafts.length
    ? `<div class="nw-draftbar">โหมดตรวจร่าง — ร่าง ${newsDrafts.length} ชิ้นข้างล่างนี้ผู้ใช้ยังไม่เห็น</div>
       <div class="nw-list">${newsDrafts.map(it => newsCard(it, false, true)).join('')}</div>` : '';

  let main;
  if (!items.length) {
    const off = newsItems === null && newsFailed;
    main = `<section class="nt-empty">
      <span class="nt-empty-ic">${icon(off ? 'signal' : 'bell')}</span>
      <div class="nt-empty-t">${off ? 'ยังโหลดข่าวไม่ได้' : 'ยังไม่มีประกาศ'}</div>
      <p class="nt-empty-p">${off ? 'ต่อเน็ตแล้วเปิดจอนี้อีกครั้ง'
        : 'มีฟีเจอร์ใหม่ ธีมใหม่ หรืออัปเดตแอปเมื่อไหร่ ทีมจะมาบอกที่นี่'}</p>
    </section>`;
  } else {
    const fresh = items.filter(isNew), older = items.filter(it => !isNew(it));
    main = [['ใหม่', fresh], ['ก่อนหน้านี้', older]].filter(g => g[1].length).map(([name, list]) =>
      `<div class="ib2-sec"><span>${name}</span></div>
       <div class="nw-list">${list.map(it => newsCard(it, isNew(it), false)).join('')}</div>`).join('');
  }
  body.innerHTML = drafts + main;
}

// ---------- บูต ----------
// วาดเลขจากสำเนาในเครื่องทันที แล้วค่อยถามไฟล์หลังแอปเปิดเสร็จ (ไม่แย่งเน็ตกับหน้าโหลด)
newsFromCache();
window.addEventListener('load', () => setTimeout(() => newsLoad(), 2500));
document.addEventListener('visibilitychange', () => { if (!document.hidden) newsLoad(); });
