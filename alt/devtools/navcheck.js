// ตรวจว่าการเปลี่ยนจอวาดเฉพาะจอที่กำลังจะแสดง — ไม่วาดใหม่ทั้ง ~25 จอทุกครั้งที่แตะแท็บ (17 ต.ค. 69)
// ------------------------------------------------------------
// ทำไม: go() เคยเรียก renderAll() ท้ายฟังก์ชัน = แตะแท็บหนึ่งครั้ง วาดใหม่ทุกจอที่ซ่อนอยู่ (display:none) ด้วย
// แล้วตัววาดหลายตัวถามขนาด/ตำแหน่งกลางคัน → เบราว์เซอร์คิดสไตล์+จัดผังซ้ำหลายรอบ
// วัดบนเครื่องจำลอง CPU ช้า 12 เท่า (มือถือสเปคต่ำมาก): แตะแท็บหนึ่งครั้ง 1.1–1.4 วิ · เธรดหลักไม่ว่าง 21 จาก 33 วิ
// จอที่ซ่อนอยู่ถูกวาดไว้แล้วตอนข้อมูลเปลี่ยนครั้งล่าสุด (ทางนั้นยังเรียก renderAll) จึงไม่ต้องวาดซ้ำตอนสลับจอ
//
// ใช้: ฉีดด้วย <script src="devtools/navcheck.js"> แล้วเรียก await navCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
// ไม่แตะข้อมูลผู้ใช้ · จบแล้วคืนตัววาดเดิมและกลับจอเดิม
async function navCheck() {
  const RENDERERS = ['renderMenu', 'renderHome', 'renderTasks', 'renderTimeline', 'renderAi', 'renderWhy', 'renderProfile',
    'renderShowcase', 'renderStats', 'renderPlan', 'renderFriends', 'renderBadges', 'renderShop', 'renderPro', 'renderWheel',
    'renderRestoredDraw', 'renderInstallCard', 'renderTabBadges', 'renderContext', 'renderRunBar', 'renderInbox',
    'renderNotif', 'renderSources', 'renderRoom', 'renderMates', 'renderFeed'];
  const calls = []; const orig = {};
  RENDERERS.forEach(n => { if (typeof window[n] !== 'function') return; orig[n] = window[n];
    window[n] = function () { calls.push(n); return orig[n].apply(this, arguments); }; });
  const back = curScreen;
  const CASES = [
    // [จอ, ต้องวาด, ห้ามวาด]
    ['scr-menu', ['renderMenu', 'renderTabBadges', 'renderRunBar'], ['renderAi', 'renderProfile', 'renderTasks', 'renderShop', 'renderFeed', 'renderSources']],
    ['scr-tasks', ['renderTasks', 'renderTabBadges'], ['renderAi', 'renderProfile', 'renderMenu', 'renderShop', 'renderFeed']],
    ['scr-ai', ['renderAi', 'renderTabBadges'], ['renderProfile', 'renderTasks', 'renderMenu', 'renderShop', 'renderFeed']],
    ['scr-profile', ['renderProfile', 'renderStats', 'renderTabBadges'], ['renderAi', 'renderTasks', 'renderMenu', 'renderShop', 'renderFeed']],
    // 17 ต.ค. 69 · จอที่เคยวาดทั้งหมดทุกครั้งที่เปิด (ไม่อยู่ในตาราง) — CPU ช้า 6 เท่า เปิดฟอร์มเพิ่มงาน/สำรวจ/ข่าว 150–412ms
    // วัดว่าตัววาดตัวไหนเขียนลงจอไหนจริง (MutationObserver + อ่านโค้ด): ฟอร์มไม่มีตัวไหนเขียนเลย · สำรวจ = เมนู/โปรไฟล์/บริบท · ข่าว = เมนู
    ['scr-form', ['renderTabBadges', 'renderRunBar'], ['renderAi', 'renderProfile', 'renderMenu', 'renderTasks', 'renderShop', 'renderFeed', 'renderStats']],
    ['scr-explore', ['renderMenu', 'renderProfile', 'renderContext', 'renderTabBadges'], ['renderAi', 'renderTasks', 'renderShop', 'renderFeed', 'renderStats']],
    ['scr-news', ['renderMenu', 'renderTabBadges'], ['renderAi', 'renderProfile', 'renderTasks', 'renderShop', 'renderFeed']],
    ['scr-hw', ['renderTabBadges'], ['renderAi', 'renderProfile', 'renderMenu', 'renderTasks', 'renderShop', 'renderFeed']],
  ];
  const rows = [];
  try {
    for (const [scr, must, mustNot] of CASES) {
      // 18 ต.ค. 69 · กลับจอเดิมที่ข้อมูลไม่เปลี่ยน = ไม่วาดซ้ำ — เคสนี้ทดสอบ "ตอนต้องวาด วาดตัวไหน" จึงประกาศว่าข้อมูลเปลี่ยนก่อน
      if (typeof markDataChanged === 'function') markDataChanged();
      calls.length = 0;
      go(scr);
      const ran = [...new Set(calls)];
      const missing = must.filter(n => !ran.includes(n));
      const extra = mustNot.filter(n => ran.includes(n));
      rows.push({ scr, ok: !missing.length && !extra.length, ran: ran.length, missing, extra });
    }
    // ข้อมูลเปลี่ยน (renderAll) ตอนอยู่จอที่จับคู่แล้ว = วาดเฉพาะจอนั้น + ของส่วนกลาง · จอที่ซ่อนอยู่ go() วาดให้ตอนเปิด
    go('scr-tasks'); calls.length = 0;
    renderAll();
    { const ran = [...new Set(calls)]; const extra = ['renderAi', 'renderProfile', 'renderMenu', 'renderShop', 'renderFeed'].filter(n => ran.includes(n));
      const missing = ['renderTasks', 'renderTabBadges', 'renderRunBar'].filter(n => !ran.includes(n));
      rows.push({ scr: 'renderAll() ตอนอยู่แท็บงาน', ok: !extra.length && !missing.length, ran: ran.length, missing, extra }); }
    // ข้อมูลเปลี่ยนตอนอยู่จออื่น แล้วเปิดจอที่แสดงข้อมูลนั้น = ต้องเห็นของใหม่ (แก้ในหน่วยความจำ ไม่ save · คืนค่าเดิมตอนจบ)
    // เลือกงานที่ "แสดงอยู่จริง" ในแท็บงานตอนนี้ — งานค้างใบแรกอาจไม่อยู่ในมุมมองที่เปิดอยู่ (วันนี้ · กรอง)
    go('scr-tasks');
    { const listText = document.getElementById('scr-tasks').textContent || '';
      const t = (typeof liveTasks === 'function' ? liveTasks() : []).find(x => !x.done && x.detail && x.detail.length > 3 && listText.includes(x.detail));
      if (!t) rows.push({ scr: 'ข้อมูลเปลี่ยนตอนอยู่จออื่น (ข้าม: แท็บงานไม่มีงานให้ทดสอบ)', ok: true, ran: 0, missing: [], extra: [] });
      if (t) { const old = t.detail; const MARK = 'navcheck-' + Date.now();
        try { go('scr-ai'); t.detail = MARK; renderAll(); go('scr-tasks');
          const shown = (document.getElementById('scr-tasks').textContent || '').includes(MARK);
          rows.push({ scr: 'ข้อมูลเปลี่ยนตอนอยู่จออื่น → เปิดแท็บงานเห็นของใหม่', ok: shown, ran: 0, missing: shown ? [] : ['ไม่เห็นชื่องานใหม่'], extra: [] });
        } finally { t.detail = old; renderAll(); } } }
    // จอสำรวจ: รายการในจอยังถูกกรองใหม่ทุกครั้งที่เปิด (เดิม renderEverything เรียก filterExplore เมื่ออยู่จอนี้)
    { const fe = window.filterExplore; let n = 0; window.filterExplore = function () { n++; return fe.apply(this, arguments); };
      try { go('scr-menu'); n = 0; go('scr-explore'); } finally { window.filterExplore = fe; }
      rows.push({ scr: 'เปิดจอสำรวจ → กรองรายการใหม่', ok: n > 0, ran: n, missing: n ? [] : ['filterExplore'], extra: [] }); }
    // 18 ต.ค. 69 · สลับจอเร็วกว่า 1.4 วิ — screenFx ยกเลิกตัวจับเวลาที่ถอด .fx-in ของจอก่อนหน้า คลาสจึงค้างบนจอที่เพิ่งผ่าน
    // กลับมาจอนั้น = เข้าทาง "เล่นซ้ำ" ที่บังคับจัดผังทั้งหน้า (offsetWidth) · ยิ่งสลับเร็วยิ่งมีจอค้างคลาสมาก = "เริ่มหน่วง"
    { go('scr-tasks'); go('scr-ai'); go('scr-tasks');
      const left = [...document.querySelectorAll('.screen.fx-in')].filter(s => s.id !== curScreen).map(s => s.id);
      rows.push({ scr: 'สลับเร็ว → จอที่ผ่านไปไม่ค้าง .fx-in', ok: !left.length, ran: 0, missing: left, extra: [] });
      const back = document.getElementById('scr-ai'); let reads = 0;
      const proto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      Object.defineProperty(back, 'offsetWidth', { configurable: true, get() { reads++; return proto.get.call(this); } });
      try { go('scr-ai'); } finally { delete back.offsetWidth; }
      rows.push({ scr: 'กลับเข้าจอที่เพิ่งผ่าน ไม่บังคับจัดผังทั้งหน้า', ok: reads === 0, ran: reads, missing: reads ? ['offsetWidth ' + reads + ' ครั้ง'] : [], extra: [] }); }
    // 18 ต.ค. 69 · renderAi อ่านความสูง/ตำแหน่งเลื่อนของบทสนทนา "เก่า" ก่อนแทนที่ด้วยของใหม่
    // = บังคับคิดสไตล์+จัดผังเนื้อหาที่กำลังจะทิ้ง (CPU ช้า 6 เท่า: ~110ms ต่อการเข้าจอน้องฮูก) → จำตำแหน่งไว้ตอนผู้ใช้เลื่อนเองแทน
    { go('scr-menu'); const old = document.querySelector('#scr-ai .ai-thread'); let r = 0;
      if (old) { for (const p of ['scrollHeight', 'scrollTop', 'clientHeight']) {
        const d = Object.getOwnPropertyDescriptor(Element.prototype, p);
        Object.defineProperty(old, p, { configurable: true, get() { r++; return d.get.call(this); }, set(v) { d.set && d.set.call(this, v); } }); } }
      try { go('scr-ai'); } finally { if (old) ['scrollHeight', 'scrollTop', 'clientHeight'].forEach(p => delete old[p]); }
      rows.push({ scr: 'เข้าจอน้องฮูก ไม่วัดบทสนทนาเก่าที่กำลังทิ้ง', ok: !!old && r === 0, ran: r, missing: old ? (r ? ['อ่าน ' + r + ' ครั้ง'] : []) : ['ไม่มีบทสนทนาให้ทดสอบ'], extra: [] }); }
    // 18 ต.ค. 69 · กลับจอที่ข้อมูลไม่เปลี่ยน = ไม่วาดใหม่ทั้งจอ (วาดใหม่ = DOM ใหม่ทั้งจอ ต้องคิดสไตล์+จัดผังใหม่หมด
    // CPU ช้า 6 เท่า: หน้าแรก ~106ms · หน้า "ฉัน" ~70ms ทุกครั้งที่กลับมา) · ข้อมูลเปลี่ยน/ตั้งค่าเปลี่ยน = ต้องวาดใหม่เสมอ
    { go('scr-menu'); go('scr-tasks'); calls.length = 0; go('scr-menu');
      const ran = [...new Set(calls)];
      rows.push({ scr: 'กลับหน้าแรก ข้อมูลไม่เปลี่ยน → ไม่วาดซ้ำ', ok: !ran.includes('renderMenu') && ran.includes('renderTabBadges'), ran: ran.length, missing: ran.includes('renderTabBadges') ? [] : ['renderTabBadges'], extra: ran.includes('renderMenu') ? ['renderMenu'] : [] }); }
    { go('scr-menu'); go('scr-tasks'); renderAll(); calls.length = 0; go('scr-menu');
      const ran = [...new Set(calls)];
      rows.push({ scr: 'ข้อมูลเปลี่ยนตอนอยู่จออื่น → กลับหน้าแรกวาดใหม่', ok: ran.includes('renderMenu'), ran: ran.length, missing: ran.includes('renderMenu') ? [] : ['renderMenu'], extra: [] }); }
    { go('scr-profile'); go('scr-menu'); const K = 'studentos.alt.navcheckProbe';
      try { localStorage.setItem(K, String(Date.now())); } finally { localStorage.removeItem(K); }
      calls.length = 0; go('scr-profile');
      const ran = [...new Set(calls)];
      rows.push({ scr: 'ตั้งค่าเปลี่ยน (เขียน studentos.alt.*) → กลับหน้า "ฉัน" วาดใหม่', ok: ran.includes('renderProfile'), ran: ran.length, missing: ran.includes('renderProfile') ? [] : ['renderProfile'], extra: [] }); }
    // 18 ต.ค. 69 · growBars เริ่มอนิเมชันแท่งใหม่ด้วย offsetWidth = บังคับจัดผังทั้งหน้าทุกครั้งที่เข้าหน้า "ฉัน" (CPU ช้า 6 เท่า ~21ms)
    { go('scr-menu'); await new Promise(r => setTimeout(r, 60)); const bars = [...document.querySelectorAll('#scr-profile .st-bars, #scr-profile #statFull')]; let r = 0;
      const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
      bars.forEach(b => Object.defineProperty(b, 'offsetWidth', { configurable: true, get() { r++; return d.get.call(this); } }));
      try { go('scr-profile'); await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 30)))); } finally { bars.forEach(b => delete b.offsetWidth); }
      const grown = bars.length ? bars.every(b => b.classList.contains(b.id === 'statFull' ? 'an-in' : 'grow')) : true;
      rows.push({ scr: 'เข้าหน้า "ฉัน" แท่งงอกใหม่โดยไม่บังคับจัดผัง', ok: r === 0 && grown, ran: r, missing: (r ? ['offsetWidth ' + r + ' ครั้ง'] : []).concat(grown ? [] : ['แท่งไม่ได้คลาสงอก']), extra: [] }); }
    // 18 ต.ค. 69 · โหมดลื่น (เครื่องแรม < 4GB เปิดเอง) = แตะแถบล่างไม่ขยายแบบ dock — ลูปนั้นวัดตำแหน่งทุกเฟรม (บังคับจัดผัง)
    { const root = document.documentElement, was = root.dataset.lite; const tab = document.querySelector('.tabbar .tab:not(.scan)');
      let moved = null;
      if (tab && typeof Touch === 'function') {
        root.dataset.lite = '1';
        try { const r = tab.getBoundingClientRect(); const t = new Touch({ identifier: 7, target: tab, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
          tab.dispatchEvent(new TouchEvent('touchstart', { touches: [t], bubbles: true }));
          await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 40))));
          moved = [...document.querySelectorAll('.tabbar .tab')].some(x => x.style.transform);
          tab.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true }));
          await new Promise(res => setTimeout(res, 400));
        } finally { if (was === undefined) delete root.dataset.lite; else root.dataset.lite = was; }
      }
      rows.push({ scr: 'โหมดลื่น → แตะแถบล่างไม่ขยายแบบ dock', ok: moved === false, ran: 0, missing: moved === null ? ['สร้าง TouchEvent ไม่ได้'] : moved ? ['แท็บถูกขยาย'] : [], extra: [] }); }
    // จอที่ยังไม่ได้จับคู่ตัววาด = วาดทั้งหมดเหมือนเดิม (ปลอดภัยไว้ก่อน) — เรียกตรง ๆ ด้วยชื่อจอที่ไม่มีในตาราง
    calls.length = 0;
    renderForScreen('scr-ไม่มีในตาราง');
    { const ran = [...new Set(calls)];
      rows.push({ scr: 'จอที่ไม่อยู่ในตาราง → วาดทั้งหมดแบบเดิม', ok: ran.includes('renderAi') && ran.includes('renderProfile'), ran: ran.length, missing: [], extra: [] }); }
  } finally {
    Object.entries(orig).forEach(([n, f]) => { window[n] = f; });
    go(back);
  }
  const pass = rows.filter(r => r.ok).length;
  rows.forEach(r => console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.scr} · วาด ${r.ran} ตัว${r.missing.length ? ' · ขาด ' + r.missing.join(',') : ''}${r.extra.length ? ' · เกิน ' + r.extra.join(',') : ''}`));
  console.log(`navCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
