// ============================================================
// THE CURSED SHIP · ฉากงานเสร็จช่วงฮาโลวีน (จอ "เสร็จแล้ว" ของโหมดโฟกัส)
// ------------------------------------------------------------
// เจ้าของส่งสตอรีบอร์ด 12 ช่อง (25 ต.ค. 69) แล้วขอ "ให้เหมือนที่สุดเท่าที่เป็นไปได้"
// รอบแรกวาดเรือด้วย SVG เอง — ออกมาเป็นภาพคนละแบบกับภาพวาดของเจ้าของ
// รอบนี้ภาพทุกช็อตตัดมาจากสตอรีบอร์ดของเจ้าของเอง (cursed-ship/*.webp · ลบป้ายตัวเลข/การ์ดเดิมออกแล้ว)
// แล้วตัดต่อเป็นช็อตตามลำดับช่อง:
//   ช่อง 1 ใบงานเรือง → 2 หมอกม่วง → 3 เรือผีโผล่ → 4 ใบงานลอยบนดาดฟ้า (พลังเขียว)
//   → 5 ตราประทับ CLAIMED BY THE DUTCHMAN → 6 เรือแล่นหาย → 11 จันทร์กับป่าช้า → 7–10 หน้าสรุป
// ตัวหนังสือและตัวเลขทั้งหมดเป็น HTML ของจริงที่วางทับภาพ ไม่ใช่ตัวหนังสือในภาพ
//
// กติกาที่ตั้งใจ (อย่าแก้โดยไม่รู้เหตุผล):
//   • งานถูกบันทึกว่าเสร็จก่อนฉากนี้เริ่ม (finishFocus ใน app.js) — ฉากเป็นแค่ฉลอง
//     ไฟล์นี้ไม่แตะ state ไม่แตะสถิติ ตัวเลขบนใบที่ลอยคือตัวเลขที่ app.js คิดมาแล้ว
//   • ทั้งฉาก 2.95 วิ แตะตรงไหนก็ข้าม · Esc/ปุ่มย้อนกลับ = ข้าม · onEnd เรียกครั้งเดียวเสมอ
//   • ลดการเคลื่อนไหว (ระบบ) · ภาพนิ่งฮาโลวีน (data-hw-motion="still") · กราฟิกน้อย · ปิดเอฟเฟกต์เอง
//     = ไม่เล่นฉาก เห็นหน้าสรุปฉบับฮาโลวีนทันที (ช่องที่ 12)
//   • ภาพยังโหลดไม่ครบ = ไม่เล่นฉาก (play คืน false) — ฉากที่ภาพโผล่ทีละช็อตแย่กว่าไม่มีฉาก
//   • ผู้ใช้เลือกเอฟเฟกต์งานเสร็จแบบเกมไว้ (hoop.js) = เกมนั้นชนะ — ของที่เขาเลือกเองต้องได้เล่น
//   • ไม่มีเสียง — ฉากไม่พึ่งเสียง จึงไม่มีอะไรพังตอนปิดเสียง/ไม่มีไฟล์
//   • ฉากอยู่ใน #focusWrap — closeFocus/startFocus ล้าง innerHTML แล้วฉากหายไปด้วยเอง
// ค่าที่เก็บ: localStorage['studentos.alt.cursedShip'] = '0' เมื่อผู้ใช้ปิดเอฟเฟกต์ (ไม่มีค่า = เปิด)
// ============================================================
(function () {
  'use strict';
  const PREF_KEY = 'studentos.alt.cursedShip';
  const TOTAL = 2950;          // ฉากทั้งชุด (ms)
  const REVEAL_AT = 2700;      // หน้าสรุปเริ่มโผล่ — ซ้อนกับช็อตป่าช้า ภาพหลังจึงต่อกันเป็นภาพเดียว
  const STAMP_AT = 1850;       // ตราประทับตก (ต้องตรงกับ animation-delay ของ .cs-seal ใน cursed-ship.css)

  // ภาพแต่ละช็อต: ขนาดจริงของไฟล์ (หาอัตราส่วน) · cx = จุดบนภาพ (แนวนอน) ที่อยากให้อยู่กลางจอ
  // ต้องตรงกับ --ar / --cx ใน cursed-ship.css
  const ART = {
    fog: { cx: .5 }, ship: { cx: .5 }, deck: { cx: .55 }, far: { cx: .55 }, yard: { cx: .62 },
  };
  const FILES = ['fog', 'ship', 'deck', 'far', 'yard'].flatMap(k => [k + '.webp', k + '-bg.webp']).concat('banner.webp', 'seal.webp');

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

  // ---------- ภาพ: โหลดล่วงหน้าตอนว่าง (~150KB ทั้งชุด) ----------
  const script = document.currentScript;
  const BASE = (() => { try { return new URL('cursed-ship/', script && script.src).href; } catch (_) { return 'halloween/season/cursed-ship/'; } })();
  let loaded = 0, failed = false, started = false;
  function preload() {
    if (started || typeof Image !== 'function') return;
    started = true;
    FILES.forEach(f => {
      const im = new Image();
      im.onload = () => { loaded++; };
      im.onerror = () => { failed = true; };
      im.src = BASE + f;
    });
  }
  const ready = () => !failed && loaded >= FILES.length;
  if (root.classList.contains('hw-season')) {
    const go = () => preload();
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(go, { timeout: 5000 });
    else setTimeout(go, 2500);
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- หน้าสรุป ----------
  // ฉากหลังของหน้าสรุป = ช็อตป่าช้าตัวเดียวกับท้ายฉาก (ช่อง 11) + แสงโคม/เทียนมุมล่าง (ช่อง 7, 9)
  function scene() {
    return `<div class="cs-scene" aria-hidden="true"><i class="cs-bgl k-yard"></i><i class="cs-art k-yard"></i>
      <i class="cs-mist"></i><i class="cs-lamp l"></i><i class="cs-lamp r"></i></div>`;
  }
  // ปุ่มเล็กมุมขวาบน — ช่องที่ 12 ของสตอรีบอร์ด "ปิดเอฟเฟกต์ได้ จะเห็นแค่หน้าสรุปแบบปกติ"
  const fxLabel = on => (on ? 'ปิดเอฟเฟกต์' : 'เปิดเอฟเฟกต์');
  function fxButton() {
    const on = readPref();
    return `<button type="button" class="cs-fxbtn" onclick="CursedShip.toggle(this)" aria-pressed="${on ? 'false' : 'true'}"><span aria-hidden="true">⚙</span>${fxLabel(on)}</button>`;
  }
  function toggle(btn) {
    const on = !readPref();
    writePref(on);
    if (on) preload();
    if (btn && btn.lastChild) { btn.lastChild.textContent = fxLabel(on); btn.setAttribute('aria-pressed', on ? 'false' : 'true'); }
    if (typeof window.showToast === 'function') window.showToast({
      title: on ? 'เปิดฉากเรือผีแล้ว' : 'ปิดฉากเรือผีแล้ว',
      body: on ? 'งานถัดไปที่ทำเสร็จจะเห็นเรือมารับ' : 'ต่อไปจะเห็นแค่หน้าสรุป',
    });
  }

  // ---------- ฉาก ----------
  let run = null;   // { ov, sheet, timers, anims, onEnd, done }

  function cardHtml(d) {
    return `<div class="cs-card">
      <div class="cs-card-h"><span class="cs-card-tick"></span><b>เสร็จแล้ว</b></div>
      <p class="cs-card-p">${esc(d.title)}</p>
      <div class="cs-card-s">${(d.stats || []).map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
      <i class="cs-seal"></i>
    </div>`;
  }
  const shot = k => `<div class="cs-shot k-${k}"><i class="cs-bgl k-${k}"></i><i class="cs-art k-${k}"></i></div>`;

  function at(ms, fn) { run.timers.push(setTimeout(fn, ms)); }

  // จุดบนภาพของช็อต k (fx, fy = สัดส่วนบนไฟล์ภาพ) → พิกัดในกรอบฉาก
  // ภาพวางด้วย left:50% top:50% แล้วเลื่อนกลับ cx·กว้าง / ครึ่งสูง (ดู .cs-art ใน CSS)
  function artPoint(ov, k, fx, fy) {
    const el = ov.querySelector('.cs-art.k-' + k);
    const W = ov.clientWidth, H = ov.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    return { x: W / 2 - ART[k].cx * w + fx * w, y: H / 2 - h / 2 + fy * h, w };
  }

  // sheet = .fc-sheet.done.cs-done ที่วาดเสร็จแล้ว (ข้อมูลจริงอยู่ในนั้นครบ) · data = { title, stats }
  // คืน true ถ้าเริ่มเล่น — false แปลว่าผู้เรียกต้องจบงานเอง (onEnd ไม่ถูกเรียก)
  function play(sheet, data, onEnd) {
    const wrap = sheet && sheet.parentElement;
    if (!wrap || decide(env(false)) !== 'cinematic') return false;
    preload();
    if (!ready()) return false;
    stop(true);
    const hero = sheet.querySelector('.fw-hero');
    const lite = root.dataset.lite === '1';

    const ov = document.createElement('div');
    ov.className = 'cs-ov' + (lite ? ' lite' : '');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'งานเสร็จแล้ว · เรือผีมารับงาน แตะเพื่อข้าม');
    ov.innerHTML = `<i class="cs-dark"></i>
      ${shot('fog')}${shot('ship')}${shot('deck')}${shot('far')}${shot('yard')}
      <i class="cs-flash"></i><i class="cs-blood"></i>
      <i class="cs-fog l"></i><i class="cs-fog r"></i>
      <i class="cs-halo"></i>
      ${cardHtml(data || {})}
      <i class="cs-fog front"></i><i class="cs-vig"></i>
      <button type="button" class="cs-skip">ข้าม</button>`;
    sheet.classList.add('cs-playing');
    wrap.appendChild(ov);
    run = { ov, sheet, timers: [], onEnd, done: false, anims: [] };

    // แตะที่ไหนก็ข้าม — pointerdown ไม่ใช่ click จะได้ไม่ต้องรอปล่อยนิ้ว
    ov.addEventListener('pointerdown', e => { e.preventDefault(); skip(); });
    ov.querySelector('.cs-skip').addEventListener('click', skip);
    ov.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } });
    try { ov.querySelector('.cs-skip').focus({ preventScroll: true }); } catch (_) {}

    // ใบงานเริ่มที่ตำแหน่งใบพระเอกของหน้าสรุป ("ลอยขึ้นจากตำแหน่งเดิม") แล้วตามกล้องไปทีละช็อต
    // ตำแหน่งในช็อตอื่นอ่านจากภาพจริง: เท้าเรือ (ช่อง 3) · จุดที่ใบงานลอยบนดาดฟ้า (ช่อง 4) · แสงเรือที่แล่นไกล (ช่อง 6)
    const card = ov.querySelector('.cs-card');
    const W = ov.clientWidth, H = ov.clientHeight;
    const wr = wrap.getBoundingClientRect();
    const hr = hero ? hero.getBoundingClientRect() : null;
    const cw = Math.min(hr ? hr.width - 24 : W - 48, 360);
    card.style.width = cw + 'px';
    const ch = card.offsetHeight || 150;
    const x0 = hr ? hr.left - wr.left + hr.width / 2 : W / 2;
    const y0 = hr ? hr.top - wr.top + Math.min(hr.height, 260) / 2 : H * .25;
    card.style.left = (x0 - cw / 2) + 'px';
    card.style.top = (y0 - ch / 2) + 'px';
    const halo = ov.querySelector('.cs-halo');
    halo.style.left = x0 + 'px'; halo.style.top = (y0 + ch / 2 + 6) + 'px'; halo.style.width = cw * 1.1 + 'px';

    const p3 = artPoint(ov, 'ship', .53, .86), p4 = artPoint(ov, 'deck', .556, .516), p6 = artPoint(ov, 'far', .553, .667);
    const p5 = { x: W / 2, y: H * .45 };
    const s3 = .32 * p3.w / cw, s4 = .425 * p4.w / cw, s5 = Math.min(1.02, (W * .8) / cw);
    const to = (p, s, r) => `translate(${p.x - x0}px,${p.y - y0}px) rotate(${r}deg) scale(${s})`;
    const o = { x: x0, y: y0 };
    if (card.animate) {
      const K = (t, transform, opacity = 1) => ({ offset: t / TOTAL, transform, opacity });
      run.anims.push(card.animate([
        K(0, to(o, 1, 0)),
        K(380, to({ x: x0, y: y0 - 10 }, 1.02, -1)),                 // 1 · ใบงานเรือง ยกตัวนิดหนึ่ง
        K(700, to({ x: x0, y: y0 - 14 }, 1.02, -1.5), .5),            // 2 · ใบงานจมลงในความมืดพร้อมหมอก
        K(1150, to(p3, s3, -3)),                                     // 3 · ถูกดึงไปที่เท้าเรือ (เล็กลงตามระยะ)
        K(1370, to(p3, s3 * .98, -4)),
        K(1400, to(p4, s4, -10)),                                    // ตัด → 4 · ลอยบนดาดฟ้า
        K(1760, to({ x: p4.x, y: p4.y - 16 }, s4 * 1.03, -8)),
        K(1790, to(p5, s5, -12)),                                    // ตัด → 5 · ภาพใกล้ ตราประทับตก
        K(2190, to({ x: p5.x + 4, y: p5.y + 3 }, s5 * .98, -12.5)),
        K(2230, to(p6, .22 * p6.w / cw, -6)),                         // ตัด → 6 · ใบงานถูกพาไปกับเรือ
        K(2560, to(p6, .03, -2), 0),
        K(TOTAL, to(p6, .03, -2), 0),
      ], { duration: TOTAL, easing: 'linear', fill: 'both' }));
    }

    at(STAMP_AT, () => { if (typeof window.haptic === 'function') window.haptic('tap'); });
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
    PREF_KEY, TOTAL, FILES, decide, ready, preload,
    mode: otherFx => decide(env(otherFx)),
    scene, fxButton, toggle, play, skip, stop, active,
  });
})();
