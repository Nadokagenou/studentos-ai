// แตะแถวในเส้นเวลาของจอแผน → แผ่นล่างที่ทำอะไรกับงานนั้นได้เลย (20 ต.ค. 69)
// ------------------------------------------------------------
// เดิมแตะแถวงานในเส้นเวลา = เปิดฟอร์มแก้ไข ไกลเกินไปสำหรับสิ่งที่คนทำบ่อยสุด (เริ่ม · เสร็จ · เลื่อน)
// ตอนนี้แตะแล้วขึ้นแผ่นสี่ปุ่ม: เริ่มทำ · เสร็จแล้ว · เลื่อนไปพรุ่งนี้ · แก้ไขรายละเอียด
// งานที่ "วันนี้เป็นโอกาสสุดท้าย" เลื่อนไม่ได้ (snoozeToTomorrow ปฏิเสธอยู่แล้ว) → แผ่นต้องไม่เสนอปุ่มเลื่อน เหลือสามปุ่ม
// ปิดแผ่นได้สามทาง: แตะฉากมืด · Esc · ปุ่มย้อนของเครื่อง (dismissTopOverlay) — ปิดแล้วต้องไม่เกิดผลข้างเคียง
//
// เทสต์ตั้งนาฬิกาเป็น 16:10 เอง — ไม่งั้นรันตอนดึกแล้วเส้นเวลาไม่มีแถวงานให้แตะ (ผลเทสต์ขึ้นกับเวลาที่รัน)
// สร้างงานทดสอบเอง แล้วคืนรายการงานเดิมทั้งก้อนตอนจบ
//
// ใช้: ฉีดด้วย <script src="devtools/plansheetcheck.js"> แล้วเรียก await planSheetCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
async function planSheetCheck() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = [];
  const add = (name, ok, note) => { rows.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
  const closeAll = async () => { for (let i = 0; i < 6 && openOverlayEl(); i++) dismissTopOverlay(); await wait(260); };
  const sheet = () => document.getElementById('planRowSheet');
  const isOpen = () => { const s = sheet(); return !!s && !s.hidden && !!s.firstElementChild; };
  const acts = () => [...document.querySelectorAll('#planRowSheet [data-act]')].map(b => b.dataset.act);
  const rowBtn = id => [...document.querySelectorAll('#saiBody .dt-job button.dt-c')].find(b => (b.getAttribute('onclick') || '').includes("'" + id + "'"));
  const rowIds = () => [...document.querySelectorAll('#saiBody .dt-job button.dt-c')].map(b => ((b.getAttribute('onclick') || '').match(/'([^']+)'/) || [])[1]);

  // ----- ตั้งนาฬิกา 16:10 วันนี้ · จำของเดิมไว้คืน -----
  const RealDate = Date;
  // จำ state ทั้งก้อน ไม่ใช่แค่ tasks — ติ๊กเสร็จแตะ funnel (firstDone · doneEver ที่ใช้วัด capture rate ของผู้ใช้จริง) · สตรีค · แต้ม
  // ถ้าไม่คืน ตัวเลขที่ชี้เป็นชี้ตายของการทดสอบกับนักเรียนจะมีงานปลอมของเทสต์ปนอยู่
  const origState = JSON.stringify(state);
  const origTasks = JSON.stringify(state.tasks);
  const quietToast = () => { const tt = document.getElementById('appToast'); if (tt) tt.classList.remove('show'); };
  const t0 = new RealDate(); t0.setHours(16, 10, 0, 0);
  const off = t0 - RealDate.now();
  class ShiftDate extends RealDate {
    constructor(...a) { if (!a.length) super(RealDate.now() + off); else super(...a); }
    static now() { return RealDate.now() + off; }
  }
  window.Date = ShiftDate;
  const iso = h => new ShiftDate(ShiftDate.now() + h * 3600e3).toISOString();
  const mk = (id, detail, estMin, dueH) => ({ id, subject: 'ฟิสิกส์', detail, estMin, due: iso(dueH), done: false, createdAt: iso(-24), progress: 0 });
  try {
    await closeAll();
    // A = ทำวันนี้ก็ได้พรุ่งนี้ก็ได้ (ส่งอีก 2 วัน) · B = ส่งคืนนี้ ไม่มีเวลาว่างวันหลังจากนี้ = โอกาสสุดท้าย
    state.tasks.splice(0, state.tasks.length,
      mk('psc-a', 'โจทย์แรงเสียดทาน', 40, 48),
      mk('psc-b', 'ใบงานคลื่น', 60, 3),
      mk('psc-c', 'สรุปบทที่ 3', 30, 50));
    save();
    const A = state.tasks.find(t => t.id === 'psc-a'), B = state.tasks.find(t => t.id === 'psc-b');
    add('ตั้งต้น: B เป็นงานโอกาสสุดท้าย · A ไม่ใช่', isLastChanceToday(B, new Date()) === true && isLastChanceToday(A, new Date()) === false,
      `B=${isLastChanceToday(B, new Date())} A=${isLastChanceToday(A, new Date())}`);

    go('scr-menu'); await wait(150);
    openSaiPlan(); await wait(500);
    const ids = rowIds();
    add('จอแผนมีแถวงานของ A และ B ให้แตะ', ids.includes('psc-a') && ids.includes('psc-b'), 'แถว: ' + ids.join(','));
    add('ก่อนแตะ ยังไม่มีแผ่น', !isOpen());

    // ----- แตะแถว A = แผ่นสี่ปุ่ม -----
    const a = rowBtn('psc-a'); if (a) a.click(); await wait(120);
    add('แตะแถวงาน → แผ่นเปิด', isOpen());
    const s = sheet();
    add('แผ่นอยู่ในรายการชั้นที่ปิดด้วย Esc/ย้อนได้', !!openOverlayEl() && openOverlayEl().el === s);
    add('แผ่นขึ้นชื่องานและ วิชา · นาที', !!s && s.textContent.includes('โจทย์แรงเสียดทาน') && s.textContent.includes('ฟิสิกส์') && /40\s*นาที/.test(s.textContent),
      s ? s.textContent.replace(/\s+/g, ' ').slice(0, 80) : 'ไม่มีแผ่น');
    add('งานทั่วไป: สี่ปุ่ม เริ่ม · เสร็จ · เลื่อน · แก้', acts().join(',') === 'start,done,snooze,edit', acts().join(','));
    const prim = document.querySelector('#planRowSheet [data-act="start"]');
    add('ปุ่มเริ่มทำเป็นปุ่มหลัก ข้อความ "เริ่มทำ"', !!prim && prim.classList.contains('primary') && prim.textContent.trim() === 'เริ่มทำ', prim ? prim.className : '');

    // ----- ปิดสามทางโดยไม่มีผลข้างเคียง -----
    const before = JSON.stringify(state.tasks);
    add('ปุ่มย้อนของเครื่อง (dismissTopOverlay) ปิดแผ่น', dismissTopOverlay() === true && (await wait(300), !isOpen()));
    a && (rowBtn('psc-a') || a).click(); await wait(120);
    const scrim = document.querySelector('#planRowSheet .as-scrim'); if (scrim) scrim.click(); await wait(300);
    add('แตะฉากมืดปิดแผ่น', !!scrim && !isOpen());
    (rowBtn('psc-a') || a).click(); await wait(120);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
    add('Esc ปิดแผ่น', !isOpen());
    add('ปิดสามทางแล้วงานไม่เปลี่ยนเลย', JSON.stringify(state.tasks) === before);
    add('ปิดแล้วยังอยู่จอแผน', curScreen === 'scr-sai', curScreen);

    // ----- งานโอกาสสุดท้าย = สามปุ่ม ไม่มีปุ่มเลื่อน -----
    const b = rowBtn('psc-b'); if (b) b.click(); await wait(120);
    add('งานโอกาสสุดท้าย: สามปุ่ม ไม่มีเลื่อนไปพรุ่งนี้', isOpen() && acts().join(',') === 'start,done,edit', acts().join(','));
    await closeAll();

    // ----- index.html เก่าจากแคช (ไม่มีกล่องแผ่น) → แตะแถวต้องไม่เงียบ ถอยไปเปิดฟอร์มเหมือนเดิม -----
    add('แผ่นอยู่ใน .phone (วงโฟกัสคีย์บอร์ดของ .phone ครอบถึง)', !!s && !!s.closest('.phone'));
    const holder = s.parentNode, nextSib = s.nextSibling;
    s.remove();
    openPlanRowSheet('psc-a', 40); await wait(250);
    add('ไม่มีกล่องแผ่น (index.html เก่า) → ถอยไปเปิดฟอร์มแก้ไข', curScreen === 'scr-form', curScreen);
    holder.insertBefore(s, nextSib);
    await closeAll(); openSaiPlan(); await wait(500);

    // ----- งานเสร็จไประหว่างที่แผ่นเปิดอยู่ → "เสร็จแล้ว" ต้องไม่ยกเลิกการเสร็จ -----
    // (ใช้ A — ตอนเริ่ม C ยังไม่อยู่ในแผนวันนี้ เพราะเวลาว่างถูก A กับ B กินหมด)
    const cc = rowBtn('psc-a'); if (cc) cc.click(); await wait(120);
    const C0 = state.tasks.find(t => t.id === 'psc-a');
    const sheetOpenedForGuard = isOpen();
    C0.done = true; C0.doneAt = new ShiftDate().toISOString();   // เสร็จจากที่อื่น (ซิงก์) ระหว่างแผ่นเปิด
    const dn0 = document.querySelector('#planRowSheet [data-act="done"]'); if (dn0) dn0.click(); await wait(700);
    add('งานเสร็จไปแล้วระหว่างแผ่นเปิด → กด "เสร็จแล้ว" ไม่ยกเลิกการเสร็จ', sheetOpenedForGuard && C0.done === true && !isOpen(), 'done=' + C0.done);
    C0.done = false; C0.doneAt = null; quietToast(); renderSaiPlan();

    // ----- ข้ามเส้น "โอกาสสุดท้าย" ระหว่างแผ่นเปิด → ปุ่มที่เห็นต้องยังกดได้ (ใช้ชุดปุ่มที่วาดตอนเปิด) -----
    const cd = rowBtn('psc-a'); if (cd) cd.click(); await wait(120);
    const cDue = C0.due, cEst = C0.estMin;
    C0.due = iso(3); C0.estMin = 60;   // กลายเป็นโอกาสสุดท้ายหลังเปิดแผ่น
    const sn0 = document.querySelector('#planRowSheet [data-act="snooze"]'); if (sn0) sn0.click(); await wait(400);
    add('เส้นโอกาสสุดท้ายถูกข้ามระหว่างแผ่นเปิด → ปุ่มเลื่อนที่เห็นยังทำงาน', !!sn0 && !!C0.plannedFor && !isOpen(), 'plannedFor=' + C0.plannedFor);
    C0.due = cDue; C0.estMin = cEst; delete C0.plannedFor; delete C0.snoozedAt; delete C0.snoozeCount; quietToast(); renderSaiPlan();

    // ----- เลื่อนไปพรุ่งนี้ = หายจากแผนวันนี้ -----
    (rowBtn('psc-a') || a).click(); await wait(120);
    const sn = document.querySelector('#planRowSheet [data-act="snooze"]'); if (sn) sn.click(); await wait(500);
    const A2 = state.tasks.find(t => t.id === 'psc-a');
    const tmr = new ShiftDate(); tmr.setDate(tmr.getDate() + 1); tmr.setHours(0, 0, 0, 0);
    add('กด "เลื่อนไปพรุ่งนี้" → แผ่นปิด', !isOpen());
    add('งานถูกตั้งแผนเป็นพรุ่งนี้ (plannedFor)', !!A2.plannedFor && new ShiftDate(A2.plannedFor).getTime() === tmr.getTime(), String(A2.plannedFor));
    add('งานหายจากเส้นเวลาของวันนี้ (วาดใหม่แล้ว)', curScreen === 'scr-sai' && !rowIds().includes('psc-a'), 'แถว: ' + rowIds().join(','));
    // "เลิกทำ" ใน toast เรียก renderAll() — จอแผนต้องวาดตาม แถวที่หายต้องกลับมา (เดิมค้างจนกว่าจะเข้าจอใหม่)
    const undoBtn = document.querySelector('#appToast .tu');
    if (undoBtn && !undoBtn.hidden) undoBtn.click(); await wait(300);
    add('กด "เลิกทำ" ใน toast หลังเลื่อน → แถวกลับมาบนจอแผน', !A2.plannedFor && rowIds().includes('psc-a'), 'plannedFor=' + A2.plannedFor + ' แถว: ' + rowIds().join(','));
    quietToast();

    // ----- เสร็จแล้ว = ติ๊กเสร็จทางเดียวกับการ์ดหน้าแรก -----
    // เลื่อน A อีกรอบให้เวลาว่างพอ C ขึ้นแผนวันนี้ (เลิกทำเมื่อกี้พา A กลับมาแล้ว)
    (rowBtn('psc-a') || a).click(); await wait(120);
    const sn2 = document.querySelector('#planRowSheet [data-act="snooze"]'); if (sn2) sn2.click(); await wait(400);
    quietToast();
    const c = rowBtn('psc-c');
    if (c) { c.click(); await wait(120); const dn = document.querySelector('#planRowSheet [data-act="done"]'); if (dn) dn.click(); }
    await wait(900);
    const C2 = state.tasks.find(t => t.id === 'psc-c');
    add('กด "เสร็จแล้ว" → งานถูกติ๊กเสร็จ + แผ่นปิด', !!C2 && C2.done === true && !!C2.doneAt && !isOpen(), C2 ? 'done=' + C2.done : 'ไม่พบงาน');
    add('ติ๊กเสร็จแล้วงานหายจากเส้นเวลา', !rowIds().includes('psc-c'), 'แถว: ' + rowIds().join(','));
    add('ติ๊กเสร็จแตะ funnel จริง (ตัวที่ต้องคืน)', JSON.stringify(state.funnel || {}) !== JSON.stringify(JSON.parse(origState).funnel || {}));
  } finally {
    // เอฟเฟกต์ฉลอง/ toast ที่ตามหลังติ๊กเสร็จ — เก็บให้เกลี้ยงก่อนคืนของ
    try { if (typeof closeFx === 'function') closeFx(true); } catch (_) {}
    await closeAll();
    quietToast();
    window.Date = RealDate;
    // คืน state ทั้งก้อน (tasks ใช้ splice คงตัวอาร์เรย์เดิม · คีย์ที่เทสต์เพิ่มเข้ามาลบทิ้ง)
    const snap = JSON.parse(origState);
    for (const k of Object.keys(state)) if (!(k in snap)) delete state[k];
    for (const k of Object.keys(snap)) if (k !== 'tasks') state[k] = snap[k];
    state.tasks.splice(0, state.tasks.length, ...snap.tasks);
    save();
    go('scr-menu'); await wait(150);
  }
  add('คืนรายการงานเดิมครบ', JSON.stringify(state.tasks) === origTasks);
  add('คืน state ทั้งก้อน (รวม funnel) เหมือนก่อนเทสต์', JSON.stringify(state) === origState);
  const pass = rows.filter(r => r.ok).length;
  console.log(`planSheetCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
