// ---------- 24 ต.ค. 69 · จออีเวนต์ (scr-events) ----------
// เจ้าของ: "ตรงกดเข้าร่วม event อยากให้มันเข้าไปแล้วเป็น event กดยังไม่ต้องเล่น แล้วค่อยสร้างช่องแยก แอป > event > และก็แยกย่อยไป
//          เดี๋ยวจะมีกิจกรรมอื่นด้วย" (แนบภาพศูนย์กิจกรรมของเกม: รายการกิจกรรมทางซ้าย · หน้ากิจกรรมทางขวา)
// เดิมการ์ดอีเวนต์บนหน้าแรกพาเข้าเกมฮาโลวีนทันที — ตอนนี้พามาที่นี่ก่อน:
//   แอป → อีเวนต์ (จอนี้) → เลือกกิจกรรมทางซ้าย → ดูรายละเอียด · กด "เข้าเล่น" หรือเข้าส่วนย่อยของกิจกรรมนั้นตรง ๆ
// จอนี้ไม่รู้จักฮาโลวีนเป็นพิเศษ — อ่านจาก eventsList() ซึ่งแปลงแหล่งอีเวนต์แต่ละตัวให้หน้าตาเดียวกัน
// อีเวนต์ใหม่ = เพิ่มแหล่งใน EVENT_SOURCES ตัวเดียว (คืน null เมื่อไม่ได้จัด/จบแล้ว แล้วมันหายจากรายการเอง)
// โหลดก่อน app.js แต่ทุกฟังก์ชันถูกเรียกตอนใช้งานจริง (esc · icon · go มาจาก app.js)

const EVENT_SOURCES = [
  // ฮาโลวีน · halloween/rewards/runtime.js อ่าน event/config.json แล้วตั้ง HalloweenEventEntry
  () => {
    const ev = window.HalloweenEventEntry || null;
    const left = ev ? ev.countdown() : null;
    if (!ev || left === null) return null;
    return { id: 'halloween', name: ev.name, tagline: ev.tagline, blurb: ev.blurb, href: ev.href, preview: ev.preview,
      art: ev.art, cast: ev.cast, names: ev.names, left, candy: ev.candy(), sections: ev.sections || [] };
  },
];

function eventsList() {
  const out = [];
  EVENT_SOURCES.forEach(f => { try { const e = f(); if (e) out.push(e); } catch (_) {} });
  return out;
}

var eventsPick = null;   // กิจกรรมที่เลือกอยู่ทางซ้าย · ไม่จำข้ามการเปิดแอป (ค่าเริ่มคือตัวแรก)

function openEvents(id) {
  if (id) eventsPick = id;
  go('scr-events');
  renderEvents();
}

function eventsSelect(id) {
  eventsPick = id;
  renderEvents();
  const scr = document.getElementById('scr-events');   // ตัวจอเลื่อน ไม่ใช่ .scr-body
  if (scr) scr.scrollTop = 0;
}

// ส่วนย่อยเปิดด้วย #id บนลิงก์เกมเดิม (experience.js อ่าน location.hash) · ไม่มีส่วนย่อย = เข้าหน้าแรกของกิจกรรม
function eventsEnter(id, section) {
  const e = eventsList().find(x => x.id === id);
  if (!e) { renderEvents(); return; }
  if (typeof haptic === 'function') haptic('tap');
  location.href = e.href.split('#')[0] + (section ? '#' + encodeURIComponent(section) : '');
}

const EV_CANDY = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M2.5 8l4.6 2.4-.9 3.4-3.7 2.2zM21.5 8l-4.6 2.4.9 3.4 3.7 2.2z" fill="currentColor" opacity=".65"/>
  <circle cx="12" cy="12" r="5.6" fill="currentColor"/></svg>`;

function renderEvents() {
  const box = document.getElementById('eventsBody');
  if (!box) return;
  const list = eventsList();
  const cur = list.find(e => e.id === eventsPick) || list[0] || null;
  if (cur) eventsPick = cur.id;

  // รายการกิจกรรมทางซ้าย · ช่องท้าย "เร็ว ๆ นี้" บอกว่าที่นี่จะมีกิจกรรมเพิ่ม (กดไม่ได้ ไม่ใช่ปุ่มที่กดแล้วเงียบ)
  const rail = list.map(e => `<button type="button" class="ev-tab${e === cur ? ' on' : ''}" onclick="eventsSelect('${esc(e.id)}')"
      aria-pressed="${e === cur}" ${e.art ? `style="--ev-art:url('${esc(e.art)}')"` : ''}>
      <span class="ev-tab-art" aria-hidden="true"></span>
      <b>${esc(e.name)}</b>
      ${e.left ? `<small>${esc(e.left)}</small>` : ''}
    </button>`).join('') + `<div class="ev-tab soon" aria-label="กิจกรรมถัดไป เร็ว ๆ นี้">
      <span class="ev-tab-art" aria-hidden="true">${icon('sparkles')}</span><b>เร็ว ๆ นี้</b><small>กิจกรรมถัดไป</small></div>`;

  const detail = cur ? eventsDetail(cur) : `<div class="ev-empty">
      <b>ตอนนี้ยังไม่มีอีเวนต์</b><span>มีกิจกรรมใหม่เมื่อไหร่ จะขึ้นที่นี่และบนหน้าแรก</span></div>`;

  box.innerHTML = `<div class="ev-head">
      <button class="sh-btn" onclick="goBack('scr-menu')" aria-label="กลับ"><svg viewBox="0 0 24 24"><use href="#lu-chevron"/></svg></button>
      <h1>อีเวนต์</h1>
    </div>
    <div class="ev-wrap">
      <nav class="ev-rail" aria-label="กิจกรรมทั้งหมด">${rail}</nav>
      <section class="ev-main" aria-live="polite">${detail}</section>
    </div>`;
}

function eventsDetail(e) {
  const cast = (e.cast || []).map((u, i) => `<figure style="--i:${i}"><img src="${esc(u)}" alt="" decoding="async">${
    e.names && e.names[i] ? `<figcaption>${esc(e.names[i])}</figcaption>` : ''}</figure>`).join('');
  const parts = (e.sections || []).map(s => `<button type="button" class="ev-part" onclick="eventsEnter('${esc(e.id)}','${esc(s.id)}')">
      <span class="ev-part-tx"><b>${esc(s.label)}</b>${s.hint ? `<small>${esc(s.hint)}</small>` : ''}</span>
      <span class="ev-part-go">${icon('chevron')}</span>
    </button>`).join('');
  return `<div class="ev-banner" ${e.art ? `style="--ev-art:url('${esc(e.art)}')"` : ''}>
      <span class="ev-banner-bg" aria-hidden="true"></span>
      <span class="ev-tags">${e.left ? `<i class="ev-left">${esc(e.left)}</i>` : ''}${e.preview ? '<i class="ev-try">ห้องลอง</i>' : ''}</span>
      <h2>${esc(e.name)}</h2>
      ${e.tagline ? `<p class="ev-tagline">${esc(e.tagline)}</p>` : ''}
      ${cast ? `<span class="ev-cast" aria-hidden="true">${cast}</span>` : ''}
    </div>
    ${e.blurb ? `<p class="ev-blurb">${esc(e.blurb)}</p>` : ''}
    ${e.candy !== null && e.candy !== undefined ? `<div class="ev-wallet">${EV_CANDY}<span>Candy ที่มี${e.preview ? ' (ห้องลอง)' : ''}</span><b>${esc(String(e.candy))}</b></div>` : ''}
    <button type="button" class="ev-play" onclick="eventsEnter('${esc(e.id)}')">เข้าเล่น ${icon('chevron')}</button>
    ${parts ? `<h3 class="ev-sub">ในอีเวนต์นี้</h3><div class="ev-parts">${parts}</div>` : ''}`;
}
