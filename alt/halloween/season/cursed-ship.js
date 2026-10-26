// ============================================================
// THE CURSED SHIP · เอฟเฟกต์ตอนงานเสร็จ (ตัวเลือกในตั้งค่า › ธีมสี › เอฟเฟกต์ตอนงานเสร็จ)
// ------------------------------------------------------------
// เจ้าของส่งสตอรีบอร์ด 12 ช่อง (25 ต.ค. 69) แล้วขอ "ให้เหมือนที่สุดเท่าที่เป็นไปได้"
// ภาพทุกช็อตตัดมาจากสตอรีบอร์ดของเจ้าของเอง (cursed-ship/*.webp · ลบป้ายตัวเลข/การ์ดเดิมออกแล้ว
// สร้างใหม่ได้ด้วย halloween/tools/build-cursed-ship-art.py) แล้วตัดต่อเป็นช็อตตามลำดับช่อง:
//   ช่อง 1 ใบงานเรือง → 2 หมอกม่วง → 3 เรือผีโผล่ → 4 ใบงานลอยบนดาดฟ้า (พลังเขียว)
//   → 5 ตราประทับ CLAIMED BY DUTCHMAN → 6 เรือแล่นหาย → 11 จันทร์กับป่าช้า → 7–10 หน้าสรุป
// ตัวหนังสือและตัวเลขทั้งหมดเป็น HTML ของจริงที่วางทับภาพ ไม่ใช่ตัวหนังสือในภาพ
//
// รอบแรกฉากนี้เล่นเองทุกครั้งในช่วงฮาโลวีน เฉพาะโหมดโฟกัส — เจ้าของหาไม่เจอ แล้วสั่งให้เป็น
// "เอฟเฟกต์ตอนงานเสร็จอันใหม่" แทน: เลือกเองในตั้งค่า แล้วเล่นทุกที่ที่ติ๊กงานเสร็จ
// (โหมดโฟกัส · ติ๊กจากหน้าแรก/รายการ) ผ่านช่องทางเดียวกับเอฟเฟกต์อื่นใน hoop.js
//
// กติกาที่ตั้งใจ (อย่าแก้โดยไม่รู้เหตุผล):
//   • งานถูกบันทึกว่าเสร็จก่อนฉากนี้เริ่ม (finishFocus / toggleDone ใน app.js) — ฉากเป็นแค่ฉลอง
//     ไฟล์นี้ไม่แตะ state ไม่แตะสถิติ ตัวเลขบนใบคืออ่านจากงานจริงด้วยสูตรเดียวกับจอ "เสร็จแล้ว"
//   • ทั้งฉาก 3.2 วิ แตะตรงไหนก็ข้าม · Esc/ปุ่มย้อนกลับ = ข้าม · onClose เรียกครั้งเดียวเสมอ
//   • ลดการเคลื่อนไหว (ระบบ) · ภาพนิ่งฮาโลวีน (data-hw-motion="still") · กราฟิกน้อย · ภาพยังโหลดไม่ครบ
//     = ไม่เล่นฉาก (doneFxActive ตอบ false) แต่จอ "เสร็จแล้ว" ของโหมดโฟกัสยังเป็นฉบับเรือผี (ช่อง 12)
//   • ไม่มีเสียง — ฉากไม่พึ่งเสียง จึงไม่มีอะไรพังตอนปิดเสียง/ไม่มีไฟล์
// ============================================================
(function () {
  'use strict';
  const ID = 'cursedship';        // id ใน FX_SHOP / ค่าใน localStorage['studentos.alt.doneFx']
  // 25 ต.ค. 69 · เจ้าของอัดจอมือถือจริงมาให้ดูแล้วบอกว่า "มันคืออะไรไม่เข้าใจ" (6 ช็อตใน 2.95 วิ)
  // 26 ต.ค. 69 · ยังไม่เข้าใจ "ให้เป็นเรื่องเป็นราว · ยาว 7–10 วิได้" — การ์ดเคยถูกดูดหายเข้าโคม
  // แล้วโผล่กลับมาใหญ่ให้ประทับตรา คนดูงงว่ากลับมาได้ยังไง · ตอนนี้เล่าเป็นเรื่องเดียว 8.6 วิ
  // การ์ดอยู่ในจอตลอด: งานเสร็จ → เรือมาถึง → ประทับตราตรงนั้น → แสงเขียวดึงขึ้นเรือ → เรือจากไป
  // แต่ละจังหวะมีคำบรรยายหนึ่งบรรทัด (CAPS) · ไทม์ไลน์เต็มอยู่หัวส่วนฉากใน cursed-ship.css
  const TOTAL = 8600;             // ฉากทั้งชุด (ms)
  const REVEAL_AT = 8100;         // จอข้างหลังเริ่มโผล่ — ซ้อนกับตอนเรือจางในหมอก
  const STAMP_AT = 3400;          // ตราประทับตก (ต้องตรงกับ animation-delay ของ .cs-seal ใน cursed-ship.css)
  const CAPS = ['งานนี้เสร็จแล้ว…', 'เรือผีมารับงานของคุณ', 'ประทับตรา · ส่งงานแล้ว', 'ไม่ต้องห่วงงานนี้อีกแล้ว'];

  // cx = จุดบนภาพ (แนวนอน) ที่อยากให้อยู่กลางจอ — ต้องตรงกับ --cx ใน cursed-ship.css
  const ART = { fog: { cx: .5 }, ship: { cx: .5 }, far: { cx: .55 }, yard: { cx: .62 } };
  const FILES = ['fog', 'ship', 'far', 'yard'].flatMap(k => [k + '.webp', k + '-bg.webp']).concat('banner.webp', 'seal.webp');

  // ---------- คลิปวิดีโอ (เจ้าของสร้างเองตามบรีฟ · 25 ต.ค. 69) ----------
  // เจ้าของ: "ภาพเบลอ ดูไม่รู้เรื่อง ทำเป็นเฟรมให้สมจริง ไม่ใช่เอาภาพเดียว" — เครื่องที่ทำงานนี้สร้างภาพ/วิดีโอเองไม่ได้
  // เจ้าของจึงสร้างคลิปแนวตั้งด้วย AI วิดีโอ แล้วแอปเล่นคลิปนั้น วางใบงานจริง (HTML) ลอยตามเส้นทางข้างล่าง
  // ใส่ไฟล์ที่ cursed-ship/<file> แล้วตั้งค่าตรงนี้ · null = ใช้ฉากภาพนิ่ง 3 ช็อตเดิม
  //   path: t = วินาทีในคลิป · x, y = สัดส่วนบนเฟรมคลิป (0–1) · w = ความกว้างใบเทียบเฟรม · r = องศา · o = ความทึบ
  //         จุดที่ไม่มี x, y = ตำแหน่งเดิมของใบ (ใบพระเอก/การ์ดที่เพิ่งติ๊ก)
  //   seal = วินาทีที่ตราประทับตก · out = วินาทีที่ฉากจบ (ตัดท้ายคลิปได้)
  // คลิปเล่นไม่ได้ (เช่น iPhone โหมดประหยัดพลังงานไม่ยอมเล่นวิดีโอเอง) = ถอยไปฉากภาพนิ่งเดิม
  const CLIP = null;

  const root = document.documentElement;
  const DONEFX = 'studentos.alt.doneFx';   // คีย์เดียวกับ DONEFX_KEY ใน hoop.js (อ่านอย่างเดียว)
  const selected = () => { try { return localStorage.getItem(DONEFX) === ID; } catch (_) { return false; } };

  // เล่นฉากได้ไหม — แยกเป็นฟังก์ชันล้วนให้เทสต์ได้โดยไม่ต้องมี DOM
  function motionOk(o) { return !o.reduced && !o.still && o.quality !== 'low'; }
  function env() {
    return {
      reduced: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
      still: root.dataset.hwMotion === 'still',
      quality: root.dataset.quality || '',
    };
  }

  // ---------- ภาพ: โหลดล่วงหน้าตอนว่าง (~150KB ทั้งชุด) เฉพาะคนที่เลือกเอฟเฟกต์นี้ ----------
  const script = document.currentScript;
  const BASE = (() => { try { return new URL('cursed-ship/', script && script.src).href; } catch (_) { return 'halloween/season/cursed-ship/'; } })();
  let loaded = 0, failed = false, started = false;
  // คลิปโหลดทั้งไฟล์เป็น blob ก่อนเล่น — iOS ขอวิดีโอเป็นช่วง ๆ (Range) ซึ่ง service worker ของแอปเก็บแคชให้ไม่ได้
  // และฉากที่ค้างรอโหลดกลางทางแย่กว่าไม่เล่นเลย
  let clipUrl = null, clipStarted = false;
  function preloadClip() {
    if (!CLIP || clipStarted || typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') return;
    clipStarted = true;
    fetch(BASE + CLIP.file).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => { clipUrl = URL.createObjectURL(b); }).catch(() => {});
  }
  function preload() {
    preloadClip();
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
  const usable = () => !!clipUrl || ready();
  if (selected()) {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(preload, { timeout: 5000 });
    else setTimeout(preload, 2500);
  }
  // hoop.js ถามก่อนเปิดเอฟเฟกต์ทุกครั้ง — ภาพไม่ครบ/ขอลดการเคลื่อนไหว = ตอบ false แอปฉลองแบบปกติแทน
  const canPlay = () => { preload(); return motionOk(env()) && usable(); };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ตัวเลขบนใบ = สองช่องเดียวกับสตอรีบอร์ด (งานเสร็จวันนี้ · เสร็จทั้งหมด) จากงานจริง
  // สูตรเดียวกับ finishFocus ใน app.js — ห้ามแต่งตัวเลขให้ฉากดูดี
  function stats() {
    try {
      const dk = new Date().toDateString();
      const today = liveTasks().filter(x => x.done && x.doneAt && new Date(x.doneAt).toDateString() === dk).length;
      return [[today, 'งานเสร็จวันนี้'], [doneCount(), 'เสร็จทั้งหมด']];
    } catch (_) { return []; }
  }

  // ---------- จอ "เสร็จแล้ว" ของโหมดโฟกัส (ใช้เมื่อเลือกเอฟเฟกต์นี้) ----------
  const skinOn = () => selected();
  // ฉากหลัง = ช็อตป่าช้าตัวเดียวกับท้ายฉาก (ช่อง 11) + แสงโคม/เทียนมุมล่าง (ช่อง 7, 9)
  function scene() {
    return `<div class="cs-scene" aria-hidden="true"><i class="cs-bgl k-yard"></i><i class="cs-art k-yard"></i>
      <i class="cs-mist"></i><i class="cs-lamp l"></i><i class="cs-lamp r"></i></div>`;
  }

  // ---------- ฉาก ----------
  let run = null;   // { ov, sheet, timers, anims, onClose, done }

  function cardHtml(title, st) {
    return `<div class="cs-card">
      <div class="cs-card-h"><span class="cs-card-tick"></span><b>เสร็จแล้ว</b></div>
      <p class="cs-card-p">${esc(title)}</p>
      <div class="cs-card-s">${st.map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
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

  // ใบงานเริ่มที่ "ตำแหน่งเดิม": ใบพระเอกของจอเสร็จแล้ว (โหมดโฟกัส) · การ์ดที่เพิ่งติ๊ก (หน้าแรก/รายการ) · กลางจอ
  function origin(host) {
    const hero = document.querySelector('#focusWrap:not([hidden]) .fw-hero');
    const card = !hero && document.querySelector('.just-done');
    const el = hero || card;
    const hr = host.getBoundingClientRect();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.bottom < hr.top || r.top > hr.bottom) return null;
    return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + Math.min(r.height, 260) / 2, w: r.width };
  }

  // เปิดจาก openDoneFx (hoop.js) — title = ชื่องาน · onClose = ทุกอย่างที่แอปรอทำหลังฉลอง (วาดใหม่ · บอกงานถัดไป)
  function playFx(title, onClose, preview) {
    const host = document.querySelector('.phone');
    preload();
    // ปุ่ม "ลองเล่นดู" กดทันทีหลังเลือก — ภาพอาจยังโหลดไม่เสร็จ รอได้ไม่เกิน 3 วิ (งานจริงไม่รอ: doneFxActive กันไว้แล้ว)
    if (preview && host && motionOk(env()) && !usable() && !failed && !(preview > 25)) {
      setTimeout(() => playFx(title, onClose, (typeof preview === 'number' ? preview : 0) + 1), 120);
      return;
    }
    if (!host || !motionOk(env()) || !usable()) {
      if (preview && typeof window.showToast === 'function') window.showToast(!motionOk(env())
        ? { title: 'ปิดการเคลื่อนไหวอยู่', body: 'เครื่องนี้ขอลดการเคลื่อนไหว ฉากเรือผีจึงไม่เล่น' }
        : { title: 'กำลังโหลดภาพเรือผี', body: 'ลองกดอีกครั้งในอีกสักครู่' });
      if (typeof onClose === 'function') onClose();
      return;
    }
    stop(true);
    const sheet = document.querySelector('#focusWrap:not([hidden]) .fc-sheet.done.cs-done');
    if (clipUrl) return playClip(title, onClose, host, sheet);
    playStills(title, onClose, host, sheet);
  }

  // ทั้งสองแบบใช้: แตะที่ไหนก็ข้าม (pointerdown ไม่ใช่ click จะได้ไม่ต้องรอปล่อยนิ้ว) · Enter/Space บนปุ่มข้าม
  function mount(host, sheet, ov, onClose) {
    if (sheet) sheet.classList.add('cs-playing');
    host.appendChild(ov);
    run = { ov, sheet, timers: [], onClose, done: false, anims: [], raf: 0, video: null };
    ov.addEventListener('pointerdown', e => { e.preventDefault(); skip(); });
    ov.querySelector('.cs-skip').addEventListener('click', skip);
    ov.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } });
    try { ov.querySelector('.cs-skip').focus({ preventScroll: true }); } catch (_) {}
  }
  // วางใบงานไว้ที่ตำแหน่งเดิมก่อนเริ่มขยับ — คืนจุดกลาง (x0, y0) กับความกว้าง cw
  function placeCard(ov, host) {
    const card = ov.querySelector('.cs-card');
    const W = ov.clientWidth, H = ov.clientHeight;
    const o0 = origin(host);
    const cw = Math.min(o0 ? o0.w - 24 : W - 48, 360);
    card.style.width = cw + 'px';
    const ch = card.offsetHeight || 150;
    const x0 = o0 ? o0.x : W / 2, y0 = o0 ? o0.y : H * .3;
    card.style.left = (x0 - cw / 2) + 'px';
    card.style.top = (y0 - ch / 2) + 'px';
    return { card, W, H, cw, ch, x0, y0 };
  }
  const reveal = sheet => { if (sheet) { sheet.classList.add('cs-reveal'); sheet.classList.remove('cs-playing'); } };

  // จุดบนเฟรมคลิป → พิกัดในกรอบ (คลิปแสดงแบบ object-fit: cover — ขอบซ้ายขวาหรือบนล่างถูกตัด)
  function clipBox(ov, video) {
    const W = ov.clientWidth, H = ov.clientHeight;
    const vw = video.videoWidth || 1080, vh = video.videoHeight || 1920;
    const k = Math.max(W / vw, H / vh), w = vw * k, h = vh * k;
    return { left: (W - w) / 2, top: (H - h) / 2, w, h };
  }

  function playClip(title, onClose, host, sheet) {
    const ov = document.createElement('div');
    ov.className = 'cs-ov cs-clip';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'งานเสร็จแล้ว · เรือผีมารับงาน แตะเพื่อข้าม');
    ov.innerHTML = `<video class="cs-video" muted playsinline webkit-playsinline preload="auto" aria-hidden="true"></video>
      <i class="cs-vig"></i>${cardHtml(title, stats())}
      <button type="button" class="cs-skip">ข้าม</button>`;
    const video = ov.querySelector('video');
    video.muted = true; video.defaultMuted = true;   // iOS เล่นเองได้เฉพาะวิดีโอที่ปิดเสียง
    video.src = clipUrl;
    mount(host, sheet, ov, onClose);
    run.video = video;
    const me = run;
    const { card, cw, x0, y0 } = placeCard(ov, host);
    const end = CLIP.out;
    let anim = null, stamped = false, outed = false;

    const build = () => {
      if (anim || !card.animate) return;
      const b = clipBox(ov, video);
      anim = card.animate(CLIP.path.map(p => {
        const x = p.x == null ? x0 : b.left + p.x * b.w, y = p.y == null ? y0 : b.top + p.y * b.h;
        const sc = p.w == null ? 1 : (p.w * b.w) / cw;
        return { offset: Math.min(1, p.t / end), opacity: p.o == null ? 1 : p.o, easing: 'ease-in-out',
          transform: `translate(${x - x0}px,${y - y0}px) rotate(${p.r || 0}deg) scale(${sc})` };
      }), { duration: end * 1000, easing: 'linear', fill: 'both' });
      anim.pause();
      me.anims.push(anim);
    };
    // ใบงานเดินตามเวลาของคลิปทุกเฟรม ไม่ใช่นาฬิกาแยก — คลิปสะดุด ใบก็หยุดรอ ไม่หลุดจากเรือ
    const tick = () => {
      if (run !== me || me.done) return;
      const t = video.currentTime || 0;
      if (anim) anim.currentTime = Math.min(t, end) * 1000;
      if (!stamped && t >= CLIP.seal) {
        stamped = true; card.classList.add('stamp'); ov.classList.add('shake');
        if (typeof window.haptic === 'function') window.haptic('tap');
      }
      if (!outed && t >= end - .25) { outed = true; reveal(sheet); ov.classList.add('out'); }
      if (t >= end || video.ended) { finish(); return; }
      me.raf = requestAnimationFrame(tick);
    };
    const go = () => { build(); tick(); };
    let p;
    try { p = video.play(); } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(go, () => {
      // เครื่องไม่ยอมเล่นวิดีโอ — ปิดฉากคลิปเงียบ ๆ แล้วเล่นฉากภาพนิ่งแทน (ถ้าภาพพร้อม) ไม่งั้นจบเลย
      if (run !== me || me.done) return;
      me.onClose = null; finish();
      if (ready()) playStills(title, onClose, host, sheet);
      else if (typeof onClose === 'function') onClose();
    });
    // กันคลิปค้าง (เน็ต/ถอดรหัสสะดุด) — ไม่ว่าอะไรเกิดขึ้น ฉากจบภายใน out + 2 วิ
    at((end + 2) * 1000, finish);
  }

  function playStills(title, onClose, host, sheet) {
    const lite = root.dataset.lite === '1';

    const ov = document.createElement('div');
    ov.className = 'cs-ov' + (lite ? ' lite' : '');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'งานเสร็จแล้ว · เรือผีมารับงาน แตะเพื่อข้าม');
    ov.innerHTML = `<i class="cs-dark"></i>
      ${shot('fog')}${shot('ship')}${shot('far')}
      <i class="cs-flash"></i><i class="cs-blood"></i>
      <i class="cs-fog l"></i><i class="cs-fog r"></i><i class="cs-fog front"></i>
      <i class="cs-halo"></i><i class="cs-beam"></i><i class="cs-glint"></i>
      ${cardHtml(title, stats())}
      <i class="cs-vig"></i>
      <div class="cs-cap" aria-live="polite">${CAPS.map((c, i) => `<span class="c${i + 1}">${esc(c)}</span>`).join('')}</div>
      <button type="button" class="cs-skip">ข้าม</button>`;
    mount(host, sheet, ov, onClose);

    // ตำแหน่งอ่านจากภาพจริง: โคมเขียวบนดาดฟ้าเรือ (ช่อง 3) คือที่ที่ใบงานถูกดูดเข้าไป
    const { card, W, H, cw, ch, x0, y0 } = placeCard(ov, host);
    const halo = ov.querySelector('.cs-halo');
    halo.style.left = x0 + 'px'; halo.style.top = (y0 + ch / 2 + 6) + 'px'; halo.style.width = cw * 1.1 + 'px';

    // ตำแหน่งอ่านจากภาพจริง: โคมเขียวบนดาดฟ้าเรือ (ช่อง 3) คือที่ที่ใบงานถูกดึงขึ้นไป
    const lamp = artPoint(ov, 'ship', .655, .7);
    const glint = ov.querySelector('.cs-glint');
    glint.style.left = lamp.x + 'px'; glint.style.top = lamp.y + 'px';
    // ใบงานลอยหน้าเรือ ต่ำกว่าตัวเรือ — ไม่บังเรือ และตราประทับ (ล้นขวาใบ 4%) อยู่ในจอทั้งดวง
    const sf = Math.min(1, (W * .74) / cw);
    // ห่างจากโคมพอให้เห็นลำแสงเขียวเต็มเส้น (รอบแรกใบอยู่ใกล้โคมเกิน ลำแสงจมอยู่หลังใบ)
    const front = { x: W * .48, y: Math.max(lamp.y + 150 + ch * sf / 2, H * .78) };
    // ลำแสงเขียว: จากโคมลงมาถึงใบงาน (ความยาว/มุมคิดจากสองจุดนี้)
    const beam = ov.querySelector('.cs-beam');
    const dx = front.x - lamp.x, dy = front.y - lamp.y;
    beam.style.left = lamp.x + 'px'; beam.style.top = lamp.y + 'px';
    beam.style.height = Math.hypot(dx, dy) + 'px';
    beam.style.transform = `rotate(${-Math.atan2(dx, dy) * 180 / Math.PI}deg)`;
    const mid = { x: (front.x + lamp.x) / 2, y: (front.y + lamp.y) / 2 };
    const to = (p, sc, r) => `translate(${p.x - x0}px,${p.y - y0}px) rotate(${r}deg) scale(${sc})`;
    const o = { x: x0, y: y0 };
    if (card.animate) {
      // easing ต้องอยู่รายช่วง — ใส่ที่ตัว animation จะบิดเวลาทั้งเส้น ช็อตคลาดจาก CSS
      const K = (t, transform, opacity = 1) => ({ offset: t / TOTAL, transform, opacity, easing: 'ease-in-out' });
      run.anims.push(card.animate([
        K(0, to(o, 1, 0)),
        K(500, to({ x: x0, y: y0 - 12 }, 1.03, -1)),                       // งานนี้เสร็จแล้ว… ใบเรืองยกตัว
        K(1300, to({ x: x0, y: y0 - 16 }, 1.0, -1.5), .7),                  //   จอมืด หมอกเข้า
        K(2600, to(front, sf, -5)),                                         // เรือผีมาถึง ใบลอยลงมาอยู่หน้าเรือ
        K(3350, to({ x: front.x, y: front.y - 6 }, sf, -6)),                //   ค้างรอ…
        K(3500, to({ x: front.x, y: front.y + 4 }, sf * .97, -8)),          // ประทับตรา (3.4 วิ) ใบสะดุ้งตามแรงกระแทก
        K(4600, to({ x: front.x + 2, y: front.y }, sf, -8)),                //   ค้างให้อ่านตรา
        K(5200, to({ x: front.x, y: front.y - 30 }, sf * .92, -10)),        // แสงเขียวลงมา ใบเริ่มลอยขึ้น
        K(5700, to(mid, sf * .5, -14)),                                     //   ถูกดึงขึ้นตามลำแสง
        K(6050, to(lamp, .06, -20), 0),                                     //   หายเข้าโคมเรือ (แสงวาบ)
        K(TOTAL, to(lamp, .06, -20), 0),
      ], { duration: TOTAL, easing: 'linear', fill: 'both' }));
    }

    at(STAMP_AT, () => { if (typeof window.haptic === 'function') window.haptic('tap'); });
    at(REVEAL_AT, () => { reveal(sheet); ov.classList.add('out'); });
    at(TOTAL, () => finish());
  }

  function finish() {
    if (!run || run.done) return;
    const r = run;
    r.done = true;
    r.timers.forEach(clearTimeout);
    if (r.raf) cancelAnimationFrame(r.raf);
    if (r.video) try { r.video.pause(); } catch (_) {}
    r.anims.forEach(a => { try { a.cancel(); } catch (_) {} });
    if (r.sheet) { r.sheet.classList.remove('cs-playing'); r.sheet.classList.add('cs-reveal'); }
    const hadFocus = r.ov.contains(document.activeElement);
    r.ov.remove();
    run = null;
    if (hadFocus && r.sheet) { const go = r.sheet.querySelector('.fc-go'); if (go) try { go.focus({ preventScroll: true }); } catch (_) {} }
    if (typeof r.onClose === 'function') r.onClose();
  }
  // ข้าม = จอข้างหลังขึ้นทันที ไม่มีจังหวะจางรอ — คนที่กดข้ามคือคนที่รีบ
  function skip() { if (run && !run.done) { if (run.sheet) run.sheet.classList.add('cs-skipped'); finish(); } }
  // หยุดเงียบ ๆ (ไม่เรียก onClose) — ใช้ตอนเริ่มฉากใหม่ทับ
  function stop(silent) {
    if (!run) return;
    if (silent) run.onClose = null;
    finish();
  }
  const active = () => !!(run && !run.done && run.ov.isConnected);

  // Esc ต้องข้ามฉากก่อน ไม่ใช่ปิดทั้งโหมดโฟกัส (ตัวจัดการ Esc ของแอปฟังที่ document)
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && active()) { e.preventDefault(); e.stopImmediatePropagation(); skip(); }
  }, true);

  // ลงทะเบียนเป็นเอฟเฟกต์ตอนงานเสร็จ — ฟรีแบบเดียวกับเอฟเฟกต์ Halloween ชุดอื่น (integration.js)
  // ต่อท้ายตาราง = อยู่ท้ายแถวในหน้าธีม
  const ICON = `<img class="hw-effect-icon" src="${BASE}seal.webp" alt="">`;
  if (typeof FX_SHOP !== 'undefined' && !FX_SHOP[ID]) {
    FX_SHOP[ID] = { cost: 0, name: 'The Cursed Ship', desc: 'เรือผีมารับงาน ตราประทับคำสาป แล้วแล่นหายในหมอก', emoji: '⚓', halloween: true, free: true, icon: ICON };
    if (typeof renderFxPick === 'function') try { renderFxPick(); } catch (_) {}
  }

  window.CursedShip = Object.freeze({
    ID, TOTAL, FILES, CLIP, motionOk, ready, preload, canPlay, stats,
    skinOn, scene, playFx, skip, stop, active,
  });
})();
