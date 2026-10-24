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
      art: ev.art, cast: ev.cast, names: ev.names, left, candy: ev.candy(), sections: ev.sections || [],
      slides: ev.slides || [], rewards: ev.rewards || [], secretRewards: ev.secretRewards || 0 };
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
  evDeck.held = false;   // เปิดจอนี้ใหม่ = สไลด์กลับมาเลื่อนเอง
  go('scr-events');
  renderEvents();
}

function eventsSelect(id) {
  eventsPick = id;
  evDeck.idx = 0; evDeck.held = false;
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
// จึงพลิกเป็นคอลัมน์เดียว: แถบกิจกรรมแนวนอนบนสุด (เพิ่มกิจกรรมแล้วปัดข้างได้) · แบนเนอร์สไลด์เต็มความกว้าง
// ที่มีปุ่มเข้าเล่นกับ Candy อยู่ในตัว · ส่วนล่างดู eventsDetail — ทั้งจออยู่ในหน้าเดียวที่ 375×812
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
    <section class="ev-main">${detail}</section>`;
  evDeckMount();
}

// 24 ต.ค. 69 (รอบสาม) · เจ้าของ: "หน้า hallow ในนี้ อยากให้เป็นสไลด์เลื่อนเหมือนกัน แต่เป็นภาพตัวอย่างในกิจกรรมนี้"
// และส่วนล่าง "ไม่ค่อยถูกใจ มันควรเป็นอะไร" — เจ้าของเลือกจากม็อกอัปสามแบบ: แถวรางวัล + ชิปทางลัดเล็ก (ปก + 9 ฉาก)
// ไทล์หกช่องเดิมเป็นเมนูให้เลือกเอง ไม่ได้บอกว่าเล่นแล้วได้อะไร · แถวรางวัลตอบข้อนั้นด้วยของจริงจากแคตตาล็อก
// ทางลัดเหลือเป็นชิปบรรทัดเดียว (ไม่นับโถงกลาง — ปุ่มเข้าเล่นพาไปที่นั่นอยู่แล้ว)
const EV_KIND = { theme: 'ธีม', costume: 'ชุด', room: 'แต่งห้อง', effect: 'เอฟเฟกต์', relic: 'อาวุธ', badge: 'ตรา' };

function eventsDetail(e) {
  const cast = (e.cast || []).map((u, i) => `<figure style="--i:${i}"><img src="${esc(u)}" alt="" decoding="async">${
    e.names && e.names[i] ? `<figcaption>${esc(e.names[i])}</figcaption>` : ''}</figure>`).join('');
  const candy = e.candy !== null && e.candy !== undefined
    ? `<span class="ev-candy" aria-label="Candy ${esc(String(e.candy))}${e.preview ? ' ในห้องลอง' : ''}">${EV_CANDY}<b>${esc(String(e.candy))}</b></span>` : '';
  // สไลด์แรก = ปก (ภาพการ์ด + ตัวละคร) · ถัดไป = ฉากในกิจกรรม · ท้ายรางมีสำเนาปก (inert) ไว้วนต่อไปข้างหน้าแบบการ์ดหน้าแรก
  const cover = `<div class="ev-slide cover"${e.art ? ` style="--ev-art:url('${esc(e.art)}')"` : ''}>
      <span class="ev-slide-bg" aria-hidden="true"></span>
      <h2>${esc(e.name)}${e.tagline ? `<span>${esc(e.tagline)}</span>` : ''}</h2>
      ${e.blurb ? `<p class="ev-blurb">${esc(e.blurb)}</p>` : ''}
      ${cast ? `<span class="ev-cast" aria-hidden="true">${cast}</span>` : ''}
    </div>`;
  const scenes = (e.slides || []).map((sl, i) => `<div class="ev-slide scene" aria-label="${esc(sl.title)}">
      <img src="${esc(sl.art)}" alt="" ${i ? 'loading="lazy" ' : ''}decoding="async">
      <span class="ev-cap"><b>${esc(sl.title)}</b>${sl.sub ? `<span>${esc(sl.sub)}</span>` : ''}</span>
    </div>`).join('');
  const n = 1 + (e.slides || []).length;
  const dots = n > 1 ? `<div class="ev-dots" role="tablist">${Array.from({ length: n }, (_, k) =>
    `<button type="button" class="ev-dot" role="tab" onclick="evDeckGo(${k}, true)" aria-label="สไลด์ ${k + 1}"><i></i></button>`).join('')}</div>` : '';

  const shelf = (e.rewards || []).map(r => `<div class="ev-rw" style="--c:${esc(r.color)}">
      <span class="ev-rw-im"><img src="${esc(r.art)}" alt="" loading="lazy" decoding="async"></span>
      <b>${esc(r.name)}</b><i>${esc(EV_KIND[r.kind] || r.kind)}</i>
    </div>`).join('') + (e.secretRewards ? `<div class="ev-rw secret"><span class="ev-rw-im">?</span>
      <b>ของลับอีก ${e.secretRewards} ชิ้น</b><i>ไปหาเองในเกม</i></div>` : '');
  const total = (e.rewards || []).length + (e.secretRewards || 0);
  const chips = (e.sections || []).filter(s => s.id !== 'hub').map(s =>
    `<button type="button" class="ev-chip" onclick="eventsEnter('${esc(e.id)}','${esc(s.id)}')">${s.icon ? icon(s.icon) : ''}${esc(s.label)}</button>`).join('');

  return `<div class="ev-banner">
      <div class="ev-track" id="evTrack">${cover}${scenes}${n > 1 ? cover.replace('class="ev-slide cover"', 'class="ev-slide cover ev-clone" aria-hidden="true" inert') : ''}</div>
      <span class="ev-tags">${e.left ? `<i class="ev-left">${esc(e.left)}</i>` : ''}${e.preview ? '<i class="ev-try">ห้องลอง</i>' : ''}</span>
      <span class="ev-foot">
        <button type="button" class="ev-play" onclick="eventsEnter('${esc(e.id)}')">เข้าเล่น ${icon('chevron')}</button>${candy}
      </span>
    </div>
    ${dots}
    ${shelf ? `<h3 class="ev-sub">เล่นแล้วได้อะไร · รางวัล ${total} ชิ้น</h3><div class="ev-shelf">${shelf}</div>` : ''}
    ${chips ? `<div class="ev-chips">${chips}</div>` : ''}`;
}

// ---------- สไลด์ในแบนเนอร์ ----------
// กติกาเดียวกับสไลด์การ์ดหน้าแรก (app.js heroDeck): เลื่อนเองทุก 5 วิไปข้างหน้าเสมอ · ถึงสำเนาปกท้ายรางแล้วกระโดดกลับปกจริงแบบไม่มีแอนิเมชัน
// แตะ/ปัดเมื่อไหร่ = หยุดเลื่อนเองจนกว่าจะเปิดจอนี้ใหม่ · ไม่เลื่อนเองเมื่อตั้งลดการเคลื่อนไหว · โหมดลื่น · ไม่อยู่จอนี้ · แอปอยู่เบื้องหลัง
const EV_STAY = 5000;
const evDeck = { idx: 0, held: false, timer: 0 };

function evDeckGo(k, byHand) {
  const t = document.getElementById('evTrack');
  if (!t || !t.children[k]) return;
  if (byHand) evDeckHold();
  t.scrollTo({ left: t.children[k].offsetLeft - t.children[0].offsetLeft, behavior: 'smooth' });
}
function evDeckHold() { evDeck.held = true; clearTimeout(evDeck.timer); evDeck.timer = 0; }
function evDeckPaint() {
  document.querySelectorAll('#scr-events .ev-dot').forEach((d, k) => {
    d.classList.toggle('on', k === evDeck.idx); d.setAttribute('aria-selected', k === evDeck.idx);
  });
}
function evDeckArm() {
  clearTimeout(evDeck.timer); evDeck.timer = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.lite;
  if (evDeck.held || reduce) return;
  evDeck.timer = setTimeout(() => {
    evDeck.timer = 0;
    const t = document.getElementById('evTrack');
    if (!t) return;
    if (typeof curScreen !== 'undefined' && curScreen !== 'scr-events' || document.hidden) { evDeckArm(); return; }
    evDeckGo(evDeck.idx + 1);
    evDeckArm();
  }, EV_STAY);
}
function evDeckMount() {
  const t = document.getElementById('evTrack');
  if (!t) return;
  const n = t.children.length - 1;   // สไลด์จริง (ไม่นับสำเนาปกท้ายราง)
  if (evDeck.idx >= n) evDeck.idx = 0;
  const pos = k => t.children[k].offsetLeft - t.children[0].offsetLeft;
  t.scrollTo({ left: pos(evDeck.idx), behavior: 'instant' });
  let settle = 0;
  t.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      const k = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
      if (k >= n) { t.scrollTo({ left: 0, behavior: 'instant' }); evDeck.idx = 0; }
      else evDeck.idx = k;
      evDeckPaint();
    }, 90);
  }, { passive: true });
  t.addEventListener('pointerdown', evDeckHold, { passive: true });
  t.addEventListener('focusin', evDeckHold);
  evDeckPaint();
  if (n > 1) evDeckArm();
}
