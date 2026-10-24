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

// 24 ต.ค. 69 (รอบสอง) · เจ้าของ: "มันใช้พื้นที่แปลก ๆ อยู่"
// รอบแรกลอกเกมมาตรง ๆ: รางกิจกรรมทางซ้าย 84px — เกมนั้นเป็นจอแนวนอน แต่มือถือเป็นแนวตั้ง
// รางกินหนึ่งในสี่ของความกว้างทั้งที่มีกิจกรรมเดียว ใต้รางว่างยาว และการ์ดทางขวาเหลือแคบจนต้องเลื่อนหาส่วนย่อย
// จึงพลิกเป็นคอลัมน์เดียว: แถบกิจกรรมแนวนอนบนสุด (เพิ่มกิจกรรมแล้วปัดข้างได้) · แบนเนอร์เต็มความกว้าง
// ที่มีปุ่มเข้าเล่นกับ Candy อยู่ในตัว · ส่วนย่อยเป็นไทล์สองคอลัมน์ — ทั้งจออยู่ในหน้าเดียวที่ 375×812
function renderEvents() {
  const box = document.getElementById('eventsBody');
  if (!box) return;
  const list = eventsList();
  const cur = list.find(e => e.id === eventsPick) || list[0] || null;
  if (cur) eventsPick = cur.id;

  // ช่อง "เร็ว ๆ นี้" บอกว่าที่นี่จะมีกิจกรรมเพิ่ม (กดไม่ได้ ไม่ใช่ปุ่มที่กดแล้วเงียบ)
  const tabs = list.map(e => `<button type="button" class="ev-tab${e === cur ? ' on' : ''}" onclick="eventsSelect('${esc(e.id)}')"
      aria-pressed="${e === cur}">
      <span class="ev-tab-art" aria-hidden="true" ${e.art ? `style="--ev-art:url('${esc(e.art)}')"` : ''}></span>
      <span class="ev-tab-tx"><b>${esc(e.name)}</b>${e.left ? `<small>${esc(e.left)}</small>` : ''}</span>
    </button>`).join('') + `<span class="ev-tab soon" aria-label="กิจกรรมถัดไป เร็ว ๆ นี้">
      <span class="ev-tab-art" aria-hidden="true">${icon('sparkles')}</span>
      <span class="ev-tab-tx"><b>เร็ว ๆ นี้</b><small>กิจกรรมถัดไป</small></span></span>`;

  const detail = cur ? eventsDetail(cur) : `<div class="ev-empty">
      <b>ตอนนี้ยังไม่มีอีเวนต์</b><span>มีกิจกรรมใหม่เมื่อไหร่ จะขึ้นที่นี่และบนหน้าแรก</span></div>`;

  box.innerHTML = `<div class="ev-head">
      <button class="sh-btn" onclick="goBack('scr-menu')" aria-label="กลับ"><svg viewBox="0 0 24 24"><use href="#lu-chevron"/></svg></button>
      <h1>อีเวนต์</h1>
    </div>
    <nav class="ev-tabs" aria-label="กิจกรรมทั้งหมด">${tabs}</nav>
    <section class="ev-main" aria-live="polite">${detail}</section>`;
}

function eventsDetail(e) {
  const cast = (e.cast || []).map((u, i) => `<figure style="--i:${i}"><img src="${esc(u)}" alt="" decoding="async">${
    e.names && e.names[i] ? `<figcaption>${esc(e.names[i])}</figcaption>` : ''}</figure>`).join('');
  const candy = e.candy !== null && e.candy !== undefined
    ? `<span class="ev-candy" aria-label="Candy ${esc(String(e.candy))}${e.preview ? ' ในห้องลอง' : ''}">${EV_CANDY}<b>${esc(String(e.candy))}</b></span>` : '';
  const parts = (e.sections || []).map(s => `<button type="button" class="ev-part" onclick="eventsEnter('${esc(e.id)}','${esc(s.id)}')">
      <span class="ev-part-ic" aria-hidden="true">${icon(s.icon || 'chevron')}</span>
      <span class="ev-part-tx"><b>${esc(s.label)}</b>${s.hint ? `<small>${esc(s.hint)}</small>` : ''}</span>
    </button>`).join('');
  return `<div class="ev-banner" ${e.art ? `style="--ev-art:url('${esc(e.art)}')"` : ''}>
      <span class="ev-banner-bg" aria-hidden="true"></span>
      <span class="ev-tags">${e.left ? `<i class="ev-left">${esc(e.left)}</i>` : ''}${e.preview ? '<i class="ev-try">ห้องลอง</i>' : ''}</span>
      <h2>${esc(e.name)}${e.tagline ? `<span>${esc(e.tagline)}</span>` : ''}</h2>
      ${e.blurb ? `<p class="ev-blurb">${esc(e.blurb)}</p>` : ''}
      ${cast ? `<span class="ev-cast" aria-hidden="true">${cast}</span>` : ''}
      <span class="ev-foot">
        <button type="button" class="ev-play" onclick="eventsEnter('${esc(e.id)}')">เข้าเล่น ${icon('chevron')}</button>${candy}
      </span>
    </div>
    ${parts ? `<h3 class="ev-sub">ในอีเวนต์นี้</h3><div class="ev-parts">${parts}</div>` : ''}`;
}
