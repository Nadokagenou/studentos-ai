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
  // 24 ต.ค. 69 · กิจกรรมถัดไปของฮาโลวีน (แทนช่อง "เร็ว ๆ นี้") — ปลดล็อกธีม Halloween ด้วยภารกิจ 2 อย่าง
  // อยู่เท่าที่อีเวนต์ฮาโลวีนยังจัด (นับถอยหลังเดียวกัน) · ปลดแล้วธีมเป็นของเขาถาวร ไม่หายตามอีเวนต์
  () => {
    const ev = window.HalloweenEventEntry || null;
    const left = ev ? ev.countdown() : null;
    if (!ev || left === null) return null;
    return { id: 'hw-theme', kind: 'quest', name: 'ธีม Halloween', tagline: 'ภารกิจปลดล็อก', left,
      art: 'halloween/rewards/theme-assets/night-academy.svg' };
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
  // 25 ต.ค. 69 · เจ้าของ: "มันค้าง ๆ" — เดิม go() วาดจอนี้ (ตาราง SCREEN_RENDER) แล้วเรียกวาดซ้ำอีกรอบตรงนี้
  // วัด (CPU ช้า 6 เท่า): วาดสองรอบ 430–660ms จากกดจนเห็นจอ 570–900ms · วาดรอบเดียวผ่าน go() พอ
  // ล้างตราประทับก่อน ไม่งั้น go() ถือว่าจอที่วาดไว้ไม่เกิน 30 วิยังสด แล้วข้ามไป (วันที่เหลือ/Candy ค้างค่าเก่า)
  if (typeof screenStamp === 'object' && screenStamp) delete screenStamp['scr-events'];
  go('scr-events');
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

  const detail = cur ? (cur.kind === 'quest' ? questDetail(cur) : eventsDetail(cur)) : `<div class="ev-empty">
      <b>ตอนนี้ยังไม่มีอีเวนต์</b><span>มีกิจกรรมใหม่เมื่อไหร่ จะขึ้นที่นี่และบนหน้าแรก</span></div>`;

  // 24 ต.ค. 69 · เจ้าของวงหัวจอจาก iPhone ("บั๊กสีแปลก ๆ") — เดิมหัวนี้วาดเองเป็นแถบกระจก (--glass) เต็มกว้างลอดใต้นาฬิกา
  // ทั้งที่หัวจออื่นทุกจอบนมือถือโปร่งใสหมดแล้ว (alt.css "remove the long glass frame") จึงเห็นเป็นแถบสีเทาม่วงทับฉากธีม
  // ใช้หัวแบบเดียวกับจออื่น (.sticky-head.sh-inline) — โปร่ง · ติดขอบบน · เลื่อนลงแล้วชื่อจางเหลือปุ่มกลับ (.stuck ใน app.js)
  box.innerHTML = `<div class="sticky-head row sh-inline ev-head">
      <div><h2 class="sh-title">อีเวนต์</h2></div>
      <button class="sh-btn" onclick="goBack('scr-menu')" aria-label="กลับ"><svg viewBox="0 0 24 24"><use href="#lu-chevron"/></svg></button>
    </div>
    <nav class="ev-tabs" aria-label="กิจกรรมทั้งหมด">${tabs}</nav>
    <section class="ev-main">${detail}</section>`;
  evDeckMount();
  evFlowMount();
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
    ${shelf ? `<h3 class="ev-sub">เล่นแล้วได้อะไร · รางวัล ${total} ชิ้น</h3><div class="ev-shelf" id="evShelf"><div class="ev-flow">${shelf}${
      shelf.replace(/<div class="ev-rw/g, '<div aria-hidden="true" inert class="ev-rw ev-clone')}</div></div>` : ''}
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
  t.scrollTo({ left: k * t.clientWidth, behavior: 'smooth' });   // สไลด์กว้าง 100% ไม่มีช่องไฟ
}
// ภาพฉากโหลดแบบ lazy — ถ้ารอให้เลื่อนถึงก่อน เบราว์เซอร์จะโหลดและถอดรหัสภาพกลางการปัด = กระตุก/เห็นช่องว่าง
// จึงอุ่นสไลด์ถัดไปไว้ล่วงหน้าทีละใบตอนเครื่องว่าง (ถอดรหัสนอกเธรดหลักด้วย decode())
function evWarm(t, k) {
  const img = t.children[k] && t.children[k].querySelector('img[loading="lazy"]');
  if (!img) return;
  const go = () => { img.loading = 'eager'; if (img.decode) img.decode().catch(() => {}); };
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 300);
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
  // ห้ามอ่านขนาด/ตำแหน่งตรงนี้ — เพิ่งเขียน innerHTML เสร็จ การอ่านบังคับให้คำนวณผังทั้งหน้าทันที (~90ms ที่ CPU ช้า 6 เท่า)
  // รางใหม่เริ่มที่สไลด์แรกอยู่แล้ว · ต้องวางคืนที่อื่นค่อยทำในเฟรมถัดไปหลังเบราว์เซอร์จัดผังเอง
  if (evDeck.idx) { const k = evDeck.idx; requestAnimationFrame(() => t.scrollTo({ left: k * t.clientWidth, behavior: 'instant' })); }
  evWarm(t, evDeck.idx + 1);
  let settle = 0;
  t.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(() => {
      const k = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
      if (k >= n) { t.scrollTo({ left: 0, behavior: 'instant' }); evDeck.idx = 0; }
      else evDeck.idx = k;
      evDeckPaint();
      evWarm(t, evDeck.idx + 1);
    }, 90);
  }, { passive: true });
  t.addEventListener('pointerdown', evDeckHold, { passive: true });
  t.addEventListener('focusin', evDeckHold);
  evDeckPaint();
  if (n > 1) evDeckArm();
}

// ---------- แถวรางวัลไหลเอง ----------
// 25 ต.ค. 69 · เจ้าของ: "ด้านล่างเลื่อนเร็ว ๆ กว่าด้านบน ไปเรื่อย ๆ" — แบนเนอร์บนเปลี่ยนทีละสไลด์ทุก 5 วิ
// แถวรางวัลไหลต่อเนื่องแทน (40px/วิ ≈ การ์ดละ 2.5 วิ เร็วกว่าแบนเนอร์) · ต่อท้ายด้วยสำเนาทั้งแถว (inert)
// ไหลถึงต้นสำเนาเมื่อไหร่ถอยกลับไปหนึ่งชุด — หน้าตาเหมือนกันเป๊ะ ตาไม่เห็นการกระโดด
// 25 ต.ค. 69 (รอบสอง) · เจ้าของ: "มันบั๊คยาวเฉย แล้วมันช้าตอนเคลื่อน"
//   • ยาว: สำเนาแทนคลาสกว้างไปโดน ev-rw-im ด้วย รูปในสำเนาไม่มีกรอบ ขยายเต็มขนาดจริง การ์ดทั้งแถวยืดตาม → แทนเฉพาะ <div class="ev-rw
//   • ช้า: เดิมตั้ง scrollLeft ทุกเฟรมด้วย JS — iPhone เลื่อนแบบนั้นไม่ลื่น · ตอนนี้ไหลด้วย transform ผ่าน Web Animations
//     (การ์ดจอทำเอง ไม่ผ่านเธรดหลัก) · แตะเมื่อไหร่แปลงตำแหน่งแอนิเมชันเป็น scrollLeft ให้ปัดต่อจากตรงนั้นได้ ปล่อยแล้วแปลงกลับ
// นิ้วแตะ = หยุดให้ปัดเอง · ปล่อยแล้ว 3 วิไหลต่อจากตรงที่ปัดไว้ (ต่างจากแบนเนอร์ที่หยุดถาวร — แถวนี้ไม่มีอะไรให้อ่านค้าง)
// ไม่ไหลเมื่อตั้งลดการเคลื่อนไหว · โหมดลื่น · แอปอยู่เบื้องหลังเบราว์เซอร์หยุดแอนิเมชันเอง
const EV_FLOW = 40;   // px ต่อวินาที
const evFlow = { anim: null, wait: 0, span: 0, el: null };

function evFlowStop() {
  clearTimeout(evFlow.wait); evFlow.wait = 0;
  const s = evFlow.el, a = evFlow.anim;
  evFlow.anim = null;
  if (!a) return;
  const pos = ((a.currentTime || 0) * EV_FLOW / 1000) % evFlow.span;
  a.cancel();
  if (s) { s.classList.remove('run'); s.scrollLeft = pos; }
}
function evFlowStart(delay) {
  evFlowStop();
  const s = evFlow.el, row = s && s.firstElementChild;
  if (!row || !s.isConnected || !row.animate) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.lite;
  if (reduce) return;
  evFlow.wait = setTimeout(() => {
    evFlow.wait = 0;
    if (!s.isConnected) return;
    if (typeof curScreen !== 'undefined' && curScreen !== 'scr-events' || document.hidden) { evFlowStart(1000); return; }
    // วัดตอนนี้ (หลังเบราว์เซอร์จัดผังแล้ว) ไม่ใช่ตอนเพิ่งเขียน innerHTML
    const first = row.children[0], half = row.children[row.children.length / 2];
    evFlow.span = half && first ? half.offsetLeft - first.offsetLeft : 0;
    if (evFlow.span < s.clientWidth) return;   // ชุดเดียวยังไม่ล้นจอ ไม่ต้องไหล
    const pos = s.scrollLeft % evFlow.span;
    s.classList.add('run');
    s.scrollLeft = 0;
    const ms = evFlow.span / EV_FLOW * 1000;
    evFlow.anim = row.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-evFlow.span}px)` }],
      { duration: ms, iterations: Infinity, easing: 'linear' });
    evFlow.anim.currentTime = pos / EV_FLOW * 1000;   // ไหลต่อจากตรงที่ปัดค้างไว้
  }, delay);
}
function evFlowMount() {
  evFlowStop();
  const s = document.getElementById('evShelf');
  evFlow.el = s;
  if (!s) return;
  const hold = () => evFlowStop();
  const rest = () => evFlowStart(3000);
  s.addEventListener('pointerdown', hold, { passive: true });
  s.addEventListener('touchstart', hold, { passive: true });
  s.addEventListener('wheel', () => { hold(); rest(); }, { passive: true });
  s.addEventListener('pointerup', rest, { passive: true });
  s.addEventListener('pointercancel', rest, { passive: true });
  s.addEventListener('touchend', rest, { passive: true });
  evFlowStart(1500);
}

// ---------- ภารกิจปลดล็อกธีม Halloween (24 ต.ค. 69) ----------
// เจ้าของ: "event ถัดไปของ hallow คือธีมสี halloween … ปลดล็อกธีมด้วยภารกิจ 2 อย่าง
//          1. เชิญเพื่อนมาใช้ StudentOS AI ให้ครบ 3 คน 2. ทำงานให้เสร็จอย่างน้อย 1 งานภายในแอป"
// ข้อ 1 นับที่เซิร์ฟเวอร์เท่านั้น (my_invite_count · ลิงก์ ?inv= · ดู supabase/migrations/20261024120000_invites.sql)
//   ยอดในเครื่องแก้เองได้ — ทีมก่อนหน้าห้ามนับแบบนั้นไว้แล้ว (halloween/docs/STUDENTOS-MISSIONS-2026-10-24.md)
// ข้อ 2 นับในเครื่อง: งานที่ติ๊กเสร็จ (ไม่อยู่ในถังขยะ) ตั้งแต่เปิดภารกิจ — ต้องทำหลังเห็นภารกิจ ไม่ใช่ของเก่าที่เสร็จไปแล้ว
// ครบทั้งสอง → ปุ่มรับธีม → ธง THEME_QUEST (app.js) · เครื่องอื่นเปิดจอนี้แล้วกดรับซ้ำได้ เพราะทั้งสองข้อตามบัญชีไป
const HWQ_OPEN = Date.parse('2026-10-24T00:00:00+07:00');   // ต้องตรงกับ v_open ใน claim_invite
const HWQ_NEED = 3;
const hwq = { invited: null, at: 0, busy: false, err: false };

function hwqDone() {
  return (state.tasks || []).filter(t => t.done && !t.deleted && t.doneAt && Date.parse(t.doneAt) >= HWQ_OPEN).length;
}
function hwqSignedIn() { return typeof sb !== 'undefined' && !!sb && typeof currentUser !== 'undefined' && !!currentUser; }

// ถามยอดชวนใหม่เมื่อเปิดจอนี้ (เก่ากว่า 20 วิ) — เพื่อนสมัครระหว่างที่เราเปิดแอปค้างไว้ต้องขึ้นโดยไม่ต้องปิดเปิดแอป
function hwqLoad() {
  if (!hwqSignedIn() || hwq.busy || Date.now() - hwq.at < 20000) return;
  hwq.busy = true;
  sb.rpc('my_invite_count').then(({ data, error }) => {
    hwq.busy = false; hwq.at = Date.now();
    hwq.err = !!error;
    if (!error && Number.isInteger(data)) hwq.invited = data;
    if (curScreen === 'scr-events' && eventsPick === 'hw-theme') renderEvents();
  }, () => { hwq.busy = false; hwq.at = Date.now(); hwq.err = true; });
}

function questDetail(e) {
  hwqLoad();
  const owned = typeof questThemeOwned === 'function' && questThemeOwned('halloween');
  const signed = hwqSignedIn();
  const inv = Math.min(hwq.invited || 0, HWQ_NEED);
  const done = Math.min(hwqDone(), 1);
  const ok1 = inv >= HWQ_NEED, ok2 = done >= 1;
  const bar = (n, of) => `<span class="hq-bar" aria-hidden="true"><i style="width:${Math.round(n / of * 100)}%"></i></span>`;
  const tick = on => `<span class="hq-tick${on ? ' on' : ''}" aria-hidden="true">${on ? icon('check') : ''}</span>`;

  // ข้อ 1 — ยังไม่ล็อกอิน = ยังนับไม่ได้ (ยอดอยู่ที่บัญชี) บอกตรง ๆ แทนการขึ้น 0/3 ที่ไม่จริง
  const invAct = ok1 ? '' : !signed
    ? `<button type="button" class="hq-btn" onclick="setLoginView('root');go('scr-login')">เข้าสู่ระบบ</button>`
    : `<button type="button" class="hq-btn" onclick="hwqShare()">${icon('share')}ส่งลิงก์เชิญ</button>`;
  const invSub = !signed ? 'ต้องเข้าสู่ระบบก่อน ยอดชวนนับตามบัญชี'
    : hwq.invited === null ? (hwq.err ? 'ยังนับไม่ได้ตอนนี้ ลองเปิดจอนี้ใหม่อีกครั้ง' : 'กำลังนับ…')
    : ok1 ? 'ครบแล้ว' : 'เพื่อนกดลิงก์ของเธอ แล้วสมัครบัญชีใหม่ = นับ 1 คน';
  const doneAct = ok2 ? '' : `<button type="button" class="hq-btn" onclick="go('scr-menu')">ไปทำงาน</button>`;

  const cta = owned
    ? `<button type="button" class="hq-claim" onclick="setTheme('halloween')">ใช้ธีม Halloween</button>`
    : ok1 && ok2
      ? `<button type="button" class="hq-claim" onclick="hwqClaim()">${icon('sparkles')}รับธีม Halloween</button>`
      : `<span class="hq-lock">${icon('lock')}ทำครบ 2 ภารกิจเพื่อปลดล็อก</span>`;

  return `<div class="hq-banner" style="--ev-art:url('${esc(e.art)}')">
      <span class="ev-tags">${e.left ? `<i class="ev-left">${esc(e.left)}</i>` : ''}${owned ? '<i class="hq-own">ปลดล็อกแล้ว</i>' : ''}</span>
      <span class="hq-sw sw-halloween" aria-hidden="true"></span>
      <h2>ธีม Halloween<span>ธีมสีกลางคืน · ฉากโรงเรียนรัตติกาล</span></h2>
      <p>ทำภารกิจครบสองข้อ แล้วธีมนี้เป็นของเธอถาวร</p>
    </div>
    <h3 class="ev-sub">ภารกิจ · ${(ok1 ? 1 : 0) + (ok2 ? 1 : 0)}/2</h3>
    <div class="hq-list">
      <div class="hq-row${ok1 ? ' ok' : ''}">${tick(ok1)}
        <div class="hq-tx"><b>เชิญเพื่อนมาใช้ StudentOS AI ให้ครบ 3 คน</b><small>${esc(invSub)}</small>
          ${signed ? `<span class="hq-prog">${bar(inv, HWQ_NEED)}<em>${inv}/${HWQ_NEED}</em></span>` : ''}</div>
        ${invAct}</div>
      <div class="hq-row${ok2 ? ' ok' : ''}">${tick(ok2)}
        <div class="hq-tx"><b>ทำงานให้เสร็จอย่างน้อย 1 งาน</b><small>${ok2 ? 'ครบแล้ว' : 'ติ๊กงานเสร็จในแอปตั้งแต่วันนี้ไป'}</small>
          <span class="hq-prog">${bar(done, 1)}<em>${done}/1</em></span></div>
        ${doneAct}</div>
    </div>
    ${cta}`;
}

// ลิงก์ = ที่อยู่แอปนี้ + ?inv=<id บัญชีเรา> · เมนูแชร์ของเครื่องก่อน (LINE/IG) ไม่มีก็คัดลอก
// ไม่นับอะไรตรงนี้ — นับเมื่อเพื่อนสมัครจริงเท่านั้น
function hwqShare() {
  if (!hwqSignedIn()) return;
  const url = new URL('.', location.href).href + '?inv=' + encodeURIComponent(currentUser.id);
  const text = 'มาใช้ StudentOS AI ด้วยกัน — แอปที่บอกว่าตอนนี้ควรทำการบ้านอะไรก่อน';
  if (typeof haptic === 'function') haptic('tap');
  if (navigator.share) {
    navigator.share({ title: 'StudentOS AI', text, url }).catch(() => {});
    return;
  }
  try {
    navigator.clipboard.writeText(text + '\n' + url).then(
      () => showToast({ title: 'คัดลอกลิงก์เชิญแล้ว', body: 'ส่งให้เพื่อน · นับเมื่อเพื่อนสมัครบัญชีใหม่' }),
      () => showToast({ title: 'คัดลอกไม่ได้', body: url }));
  } catch (_) { showToast({ title: 'ลิงก์เชิญของเธอ', body: url }); }
}

function hwqClaim() {
  if (hwqDone() < 1 || (hwq.invited || 0) < HWQ_NEED) { renderEvents(); return; }
  try { localStorage.setItem(THEME_QUEST.halloween, '1'); } catch (_) { return; }
  if (typeof applyThemeLocks === 'function') applyThemeLocks();
  if (typeof haptic === 'function') haptic('done');
  if (typeof splashBurst === 'function') splashBurst(20, 'egg-star');
  setTheme('halloween');
  showToast({ title: 'ได้ธีม Halloween แล้ว', body: 'เปลี่ยนธีมได้ที่จอตั้งค่า · เป็นของเธอถาวร' });
  renderEvents();
}
