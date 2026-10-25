// ============================================================
// THE CURSED SHIP · ฉากงานเสร็จช่วงฮาโลวีน (จอ "เสร็จแล้ว" ของโหมดโฟกัส)
// ------------------------------------------------------------
// เจ้าของส่งสตอรีบอร์ด 12 ช่อง (25 ต.ค. 69): จอมืด หมอกไหลเข้า → เรือผีโผล่จากทะเล
// → ใบงานที่เพิ่งเสร็จลอยไปหาเรือ → ตราประทับ "CLAIMED BY THE DUTCHMAN" → เรือแล่นหายในหมอก
// → หน้าสรุปฉบับฮาโลวีน (ข้อมูลจริง) พร้อมปุ่ม "ทำต่อเลย"
//
// กติกาที่ตั้งใจ (อย่าแก้โดยไม่รู้เหตุผล):
//   • งานถูกบันทึกว่าเสร็จก่อนฉากนี้เริ่ม (finishFocus ใน app.js) — ฉากเป็นแค่ฉลอง
//     ไฟล์นี้ไม่แตะ state ไม่แตะสถิติ ตัวเลขบนใบที่ลอยคือตัวเลขที่ app.js คิดมาแล้ว
//   • ทั้งฉาก 2.8 วิ แตะตรงไหนก็ข้าม · Esc/ปุ่มย้อนกลับ = ข้าม · onEnd เรียกครั้งเดียวเสมอ
//   • ลดการเคลื่อนไหว (ระบบ) · ภาพนิ่งฮาโลวีน (data-hw-motion="still") · กราฟิกน้อย · ปิดเอฟเฟกต์เอง
//     = ไม่เล่นฉาก เห็นหน้าสรุปฉบับฮาโลวีนทันที
//   • ผู้ใช้เลือกเอฟเฟกต์งานเสร็จแบบเกมไว้ (hoop.js) = เกมนั้นชนะ — ของที่เขาเลือกเองต้องได้เล่น
//   • ไม่มีเสียง — ฉากไม่พึ่งเสียง จึงไม่มีอะไรพังตอนปิดเสียง/ไม่มีไฟล์
//   • ฉากอยู่ใน #focusWrap — closeFocus/startFocus ล้าง innerHTML แล้วฉากหายไปด้วยเอง
// ค่าที่เก็บ: localStorage['studentos.alt.cursedShip'] = '0' เมื่อผู้ใช้ปิดเอฟเฟกต์ (ไม่มีค่า = เปิด)
// ============================================================
(function () {
  'use strict';
  const PREF_KEY = 'studentos.alt.cursedShip';
  const TOTAL = 2800;          // ฉากทั้งชุด (ms)
  const REVEAL_AT = 2420;      // หน้าสรุปเริ่มโผล่ตอนนี้ — ซ้อนกับตอนหมอกจาง ไม่ใช่รอให้ดำสนิทก่อน
  const CARD_AT = 780, CARD_MS = 1400;   // ใบงานลอย 0.78 → 2.18 วิ (ตราประทับตกที่ 50% ของช่วงนี้)

  const root = document.documentElement;
  const readPref = () => { try { return localStorage.getItem(PREF_KEY) !== '0'; } catch (_) { return true; } };
  const writePref = on => { try { on ? localStorage.removeItem(PREF_KEY) : localStorage.setItem(PREF_KEY, '0'); } catch (_) {} };

  // ตัดสินว่าจะเล่นแบบไหน — แยกเป็นฟังก์ชันล้วนให้เทสต์ได้โดยไม่ต้องมี DOM
  //   'off'       = ไม่ใช่ช่วงฮาโลวีน → จอเดิมทุกอย่าง
  //   'still'     = หน้าสรุปฉบับฮาโลวีน ไม่มีฉาก
  //   'cinematic' = เล่นฉากเรือผีก่อน
  function decide(o) {
    if (!o.season) return 'off';
    if (o.otherFx) return 'still';
    if (!o.pref || o.reduced || o.still || o.quality === 'low') return 'still';
    return 'cinematic';
  }
  function env(otherFx) {
    return {
      season: root.classList.contains('hw-season'),
      otherFx: !!otherFx,
      pref: readPref(),
      reduced: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
      still: root.dataset.hwMotion === 'still',
      quality: root.dataset.quality || '',
    };
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- ภาพ ----------
  // เรือวาดเป็นเงาดำ ขอบรับแสงเขียววิญญาณ ใบเรือขาดรุ่ย — ไม่ใช่เรือการ์ตูนสีสด
  const SHIP = `<svg class="cs-ship" viewBox="0 0 400 300" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="csLamp"><stop offset="0" stop-color="#E9FFF3"/><stop offset=".35" stop-color="#7CF5C8" stop-opacity=".7"/><stop offset="1" stop-color="#7CF5C8" stop-opacity="0"/></radialGradient>
      <linearGradient id="csSail" x1="0" y1="0" x2=".2" y2="1"><stop offset="0" stop-color="#A9D9C8" stop-opacity=".42"/><stop offset=".55" stop-color="#4E7A72" stop-opacity=".26"/><stop offset="1" stop-color="#1B2B30" stop-opacity=".05"/></linearGradient>
      <linearGradient id="csHull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A2A33"/><stop offset=".4" stop-color="#0C141C"/><stop offset="1" stop-color="#030508"/></linearGradient>
    </defs>
    <g id="csShipG">
      <path class="cs-rig" d="M-6 178 L128 52 L210 22 L292 64 L384 160 M128 52 L44 200 M210 22 L120 198 M210 22 L300 196 M292 64 L344 186 M128 82 L210 50 L292 92 M60 196 L128 132 M300 194 L292 140"/>
      <path class="cs-mast" d="M128 50 V206 M210 18 V204 M292 62 V200 M18 202 L-10 172"/>
      <path class="cs-spar" d="M98 84 L160 80 M92 134 L166 130 M172 54 L250 52 M162 114 L258 112 M262 94 L320 96 M256 138 L324 140"/>
      <g class="cs-sails" fill="url(#csSail)">
        <path d="M100 85 Q128 92 158 81 L162 112 L156 127 L150 116 L143 129 L136 119 L129 131 L121 118 L114 128 L106 117 L99 124 Z"/>
        <path d="M94 135 Q130 146 164 131 L168 168 L160 186 L153 172 L146 190 L137 175 L129 192 L119 174 L111 188 L103 171 L92 182 Z"/>
        <path d="M174 55 Q210 66 248 53 L252 92 L245 110 L237 98 L229 112 L220 100 L212 116 L203 101 L194 112 L186 99 L176 108 Z"/>
        <path d="M164 115 Q210 128 256 113 L262 160 L254 180 L246 166 L238 184 L227 168 L216 188 L205 168 L195 184 L185 166 L175 180 L166 166 Z"/>
        <path d="M264 95 Q292 104 318 97 L322 128 L316 141 L309 131 L302 143 L294 132 L287 144 L279 131 L271 140 L263 129 Z"/>
        <path d="M258 139 Q292 150 322 141 L326 176 L318 192 L310 178 L302 194 L292 180 L284 195 L274 179 L266 190 L257 176 Z"/>
      </g>
      <g class="cs-holes">
        <path d="M137 95 l4 1 2 5 -1 6 -3 3 -2 -6 z M110 148 l5 -1 3 4 -2 9 -4 1 -1 -6 z M216 70 l5 2 1 7 -3 6 -2 -1 -1 -8 z M189 136 l4 -2 4 5 -1 10 -4 3 -1 -9 z M298 106 l3 1 2 6 -2 4 -2 -4 z"/>
      </g>
      <path class="cs-tears" d="M141 131 L143 112 M216 188 L214 160 M127 192 L130 168 M292 195 L290 176 M229 112 L231 96"/>
      <path class="cs-shred" d="M160 186 q2 10 -1 18 M254 180 q3 9 0 16 M106 117 q-2 8 1 14 M318 192 q2 8 -1 13"/>
      <path class="cs-flag" d="M210 20 L246 24 L233 29 L249 35 L224 36 L232 42 L210 42 Z"/>
      <path class="cs-hull" fill="url(#csHull)" d="M18 204 L60 200 L316 196 L334 166 L384 158 L380 200 Q364 252 302 268 L118 268 Q62 256 18 204 Z"/>
      <path class="cs-plank" d="M36 220 Q190 236 376 212 M62 240 Q200 256 360 232 M96 258 Q210 268 330 252"/>
      <path class="cs-rim" d="M18 204 L60 200 L316 196 L334 166 L384 158"/>
      <path class="cs-fig" d="M18 204 q-12 -2 -16 -12 q6 -6 13 -3 q4 7 3 15 z"/>
      <g class="cs-ports">
        <rect x="100" y="222" width="8" height="6" rx="1.5"/><rect x="130" y="224" width="8" height="6" rx="1.5"/>
        <rect x="160" y="225" width="8" height="6" rx="1.5"/><rect x="190" y="225" width="8" height="6" rx="1.5"/>
        <rect x="220" y="224" width="8" height="6" rx="1.5"/><rect x="250" y="223" width="8" height="6" rx="1.5"/>
        <rect x="280" y="221" width="8" height="6" rx="1.5"/><rect x="342" y="174" width="7" height="10" rx="1.5"/>
        <rect x="356" y="172" width="7" height="10" rx="1.5"/><rect x="370" y="170" width="6" height="10" rx="1.5"/>
      </g>
      <g class="cs-lamps">
        <circle cx="382" cy="150" r="24" fill="url(#csLamp)"/><circle cx="382" cy="150" r="4"/>
        <circle cx="40" cy="192" r="20" fill="url(#csLamp)"/><circle cx="40" cy="192" r="3.6"/>
        <circle cx="210" cy="110" r="15" fill="url(#csLamp)"/><circle cx="210" cy="110" r="2.8"/>
      </g>
      <path class="cs-wisp" d="M90 214 q-10 -26 6 -46 q14 -18 2 -40 M220 210 q14 -24 0 -46 q-12 -18 4 -38 M330 196 q12 -20 0 -40"/>
    </g>
  </svg>`;

  // ตราขี้ผึ้งแดง ขอบไม่เรียบเหมือนหยดจริง ตัวอักษรนูน — อีสเตอร์เอ้ก ไม่ใช่ข้อความที่ต้องอ่าน
  const SEAL = `<svg class="cs-seal" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
    <defs><radialGradient id="csWax" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#E0384A"/><stop offset=".55" stop-color="#A3121F"/><stop offset="1" stop-color="#5A0710"/></radialGradient></defs>
    <path fill="url(#csWax)" d="M100 8 C122 10 128 2 146 16 C164 28 182 30 186 56 C192 78 200 88 190 110 C182 132 192 146 172 164 C154 180 146 196 120 192 C96 190 86 200 64 186 C42 174 22 176 14 150 C6 126 -2 116 10 92 C18 70 8 56 28 36 C46 18 74 6 100 8 Z"/>
    <path fill="#7E0C17" d="M150 176 C154 186 152 198 146 199 C140 199 140 188 142 180 Z M40 168 C36 178 34 190 40 192 C46 192 46 182 46 174 Z"/>
    <circle cx="100" cy="100" r="66" fill="none" stroke="#F06A74" stroke-opacity=".55" stroke-width="3"/>
    <circle cx="100" cy="100" r="56" fill="none" stroke="#3E040A" stroke-opacity=".6" stroke-width="2"/>
    <path fill="#F4A3A8" fill-opacity=".85" d="M84 66 L100 50 L116 66 Z M99 50 h2 v36 h-2 Z M80 70 Q100 64 120 70 L118 84 L82 84 Z"/>
    <text x="100" y="112" text-anchor="middle" class="cs-seal-t">CLAIMED BY</text>
    <text x="100" y="140" text-anchor="middle" class="cs-seal-t big">THE DUTCHMAN</text>
  </svg>`;

  // ฉากหลังของหน้าสรุป — พระจันทร์ หมอก โคม และป่าช้าเป็นเงา (ไม่มีภาพจากไฟล์ จึงไม่ต้องรอโหลด)
  const SCENE = `<div class="cs-scene" aria-hidden="true">
    <i class="cs-moonbg"></i><i class="cs-stars"></i><i class="cs-mist"></i>
    <svg class="cs-yard" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" focusable="false">
      <path d="M0 120 V92 Q60 80 120 90 T240 86 T400 90 V120 Z" fill="#0A0616"/>
      <path d="M38 96 v-26 q0-12 12-12 q12 0 12 12 v26 Z M300 98 v-22 q0-10 10-10 q10 0 10 10 v22 Z M342 96 v-14 h-8 v-6 h8 v-8 h6 v8 h8 v6 h-8 v14 Z M80 98 v-12 h-6 v-5 h6 v-7 h5 v7 h6 v5 h-6 v12 Z" fill="#120A24"/>
      <path d="M150 92 C152 70 162 52 160 30 M160 52 C170 46 176 40 182 30 M157 64 C148 60 140 54 136 44" stroke="#120A24" stroke-width="4" fill="none" stroke-linecap="round"/>
    </svg>
    <i class="cs-lamp l"></i><i class="cs-lamp r"></i>
  </div>`;

  // ---------- หน้าสรุป ----------
  function scene() { return SCENE; }
  // ปุ่มเล็กมุมขวาบน — ช่องที่ 12 ของสตอรีบอร์ด "ปิดเอฟเฟกต์ได้ จะเห็นแค่หน้าสรุปแบบปกติ"
  function fxButton() {
    const on = readPref();
    return `<button type="button" class="cs-fxbtn" onclick="CursedShip.toggle(this)" aria-pressed="${on ? 'false' : 'true'}">${on ? 'ปิดเอฟเฟกต์' : 'เปิดเอฟเฟกต์'}</button>`;
  }
  function toggle(btn) {
    const on = !readPref();
    writePref(on);
    if (btn) { btn.textContent = on ? 'ปิดเอฟเฟกต์' : 'เปิดเอฟเฟกต์'; btn.setAttribute('aria-pressed', on ? 'false' : 'true'); }
    if (typeof window.showToast === 'function') window.showToast({
      title: on ? 'เปิดฉากเรือผีแล้ว' : 'ปิดฉากเรือผีแล้ว',
      body: on ? 'งานถัดไปที่ทำเสร็จจะเห็นเรือมารับ' : 'ต่อไปจะเห็นแค่หน้าสรุป',
    });
  }

  // ---------- ฉาก ----------
  let run = null;   // { ov, sheet, timers, onEnd, done }

  function cardHtml(d) {
    return `<div class="cs-card">
      <div class="cs-card-h"><span class="cs-card-tick"></span><b>เสร็จแล้ว</b></div>
      <p class="cs-card-p">${esc(d.title)}</p>
      <div class="cs-card-s">${(d.stats || []).map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
      ${SEAL}
    </div>`;
  }

  function at(ms, fn) { run.timers.push(setTimeout(fn, ms)); }

  // sheet = .fc-sheet.done.cs-done ที่วาดเสร็จแล้ว (ข้อมูลจริงอยู่ในนั้นครบ) · data = { title, stats }
  // คืน true ถ้าเริ่มเล่น — false แปลว่าผู้เรียกต้องจบงานเอง (onEnd ไม่ถูกเรียก)
  function play(sheet, data, onEnd) {
    const wrap = sheet && sheet.parentElement;
    if (!wrap || decide(env(false)) !== 'cinematic') return false;
    stop(true);
    const hero = sheet.querySelector('.fw-hero');
    const lite = root.dataset.lite === '1';

    const ov = document.createElement('div');
    ov.className = 'cs-ov' + (lite ? ' lite' : '');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'งานเสร็จแล้ว · เรือผีมารับงาน แตะเพื่อข้าม');
    ov.innerHTML = `<i class="cs-dark"></i><i class="cs-flash"></i><i class="cs-moon"></i>
      <i class="cs-fog l"></i><i class="cs-fog r"></i><i class="cs-sea"></i>
      <div class="cs-shipwrap">${SHIP}<svg class="cs-reflect" viewBox="0 0 400 300" aria-hidden="true"><use href="#csShipG"/></svg></div>
      <i class="cs-shadow"></i>
      ${cardHtml(data || {})}
      <i class="cs-fog front"></i>
      <button type="button" class="cs-skip">ข้าม</button>`;
    sheet.classList.add('cs-playing');
    wrap.appendChild(ov);
    run = { ov, sheet, timers: [], onEnd, done: false, anims: [] };

    // แตะที่ไหนก็ข้าม — pointerdown ไม่ใช่ click จะได้ไม่ต้องรอปล่อยนิ้ว
    ov.addEventListener('pointerdown', e => { e.preventDefault(); skip(); });
    ov.querySelector('.cs-skip').addEventListener('click', skip);
    ov.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } });
    try { ov.querySelector('.cs-skip').focus({ preventScroll: true }); } catch (_) {}

    // ใบงานเริ่มที่ตำแหน่งใบพระเอกของหน้าสรุปพอดี ("ลอยขึ้นจากตำแหน่งเดิม") แล้วไปลงดาดฟ้าเรือ
    const card = ov.querySelector('.cs-card');
    const wr = wrap.getBoundingClientRect();
    const hr = hero ? hero.getBoundingClientRect() : null;
    const w = hr ? Math.min(hr.width, 420) : Math.min(wr.width - 36, 340);
    const x0 = hr ? hr.left - wr.left + (hr.width - w) / 2 : (wr.width - w) / 2;
    const y0 = hr ? hr.top - wr.top + 4 : wr.height * .22;
    card.style.width = w + 'px';
    card.style.left = x0 + 'px';
    card.style.top = y0 + 'px';
    const ship = ov.querySelector('.cs-ship').getBoundingClientRect();
    const ch = card.offsetHeight || 150;
    // จุดลอยค้างตอนโดนประทับ = ระหว่างตำแหน่งเดิมกับเรือ · จุดจบ = กลางดาดฟ้า
    const deckX = ship.left - wr.left + ship.width * .52 - (x0 + w / 2);
    const deckY = ship.top - wr.top + ship.height * .64 - (y0 + ch / 2);
    const midX = deckX * .35, midY = Math.min(deckY * .42, wr.height * .5 - (y0 + ch / 2));
    if (card.animate) {
      run.anims.push(card.animate([
        { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1, offset: 0 },
        { transform: 'translate(0,-16px) rotate(-1.5deg) scale(1.02)', opacity: 1, offset: .16 },
        { transform: `translate(${midX}px,${midY}px) rotate(-7deg) scale(.8)`, opacity: 1, offset: .48 },
        { transform: `translate(${midX + 3}px,${midY + 2}px) rotate(-8deg) scale(.78)`, opacity: 1, offset: .7 },
        { transform: `translate(${deckX}px,${deckY}px) rotate(-16deg) scale(.1)`, opacity: 0, offset: 1 },
      ], { duration: CARD_MS, delay: CARD_AT, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' }));
    }

    // ตราประทับตก = สะเทือนจอนิดหนึ่ง + สั่นเครื่องสั้น ๆ (ถ้าเครื่องทำได้)
    at(CARD_AT + CARD_MS * .48, () => { if (typeof window.haptic === 'function') window.haptic('tap'); });
    at(REVEAL_AT, () => { sheet.classList.add('cs-reveal'); sheet.classList.remove('cs-playing'); ov.classList.add('out'); });
    at(TOTAL, () => finish());
    return true;
  }

  function finish() {
    if (!run || run.done) return;
    const r = run;
    r.done = true;
    r.timers.forEach(clearTimeout);
    r.anims.forEach(a => { try { a.cancel(); } catch (_) {} });
    r.sheet.classList.remove('cs-playing');
    r.sheet.classList.add('cs-reveal');
    const hadFocus = r.ov.contains(document.activeElement);
    r.ov.remove();
    run = null;
    if (hadFocus) { const go = r.sheet.querySelector('.fc-go'); if (go) try { go.focus({ preventScroll: true }); } catch (_) {} }
    if (typeof r.onEnd === 'function') r.onEnd();
  }
  // ข้าม = หน้าสรุปขึ้นทันที ไม่มีจังหวะจางรอ — คนที่กดข้ามคือคนที่รีบ
  function skip() { if (run && !run.done) { run.sheet.classList.add('cs-skipped'); finish(); } }
  // หยุดเงียบ ๆ (ไม่เรียก onEnd) — ใช้ตอนเริ่มฉากใหม่ทับ หรือจอถูกปิด
  function stop(silent) {
    if (!run) return;
    if (silent) { run.onEnd = null; }
    finish();
  }
  const active = () => !!(run && !run.done && run.ov.isConnected);

  // Esc ต้องข้ามฉากก่อน ไม่ใช่ปิดทั้งโหมดโฟกัส (ตัวจัดการ Esc ของแอปฟังที่ document)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && active()) { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
  }, true);

  window.CursedShip = Object.freeze({
    PREF_KEY, TOTAL, decide,
    mode: otherFx => decide(env(otherFx)),
    scene, fxButton, toggle, play, skip, stop, active,
  });
})();
