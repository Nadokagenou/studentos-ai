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
  const origTasks = JSON.stringify(state.tasks);
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

    // ----- เลื่อนไปพรุ่งนี้ = หายจากแผนวันนี้ -----
    (rowBtn('psc-a') || a).click(); await wait(120);
    const sn = document.querySelector('#planRowSheet [data-act="snooze"]'); if (sn) sn.click(); await wait(500);
    const A2 = state.tasks.find(t => t.id === 'psc-a');
    const tmr = new ShiftDate(); tmr.setDate(tmr.getDate() + 1); tmr.setHours(0, 0, 0, 0);
    add('กด "เลื่อนไปพรุ่งนี้" → แผ่นปิด', !isOpen());
    add('งานถูกตั้งแผนเป็นพรุ่งนี้ (plannedFor)', !!A2.plannedFor && new ShiftDate(A2.plannedFor).getTime() === tmr.getTime(), String(A2.plannedFor));
    add('งานหายจากเส้นเวลาของวันนี้ (วาดใหม่แล้ว)', curScreen === 'scr-sai' && !rowIds().includes('psc-a'), 'แถว: ' + rowIds().join(','));
    // toast ของการเลื่อนปิดเอง/ปิดทิ้งก่อนไปขั้นต่อไป
    document.querySelectorAll('.toast').forEach(x => x.remove());

    // ----- เสร็จแล้ว = ติ๊กเสร็จทางเดียวกับการ์ดหน้าแรก -----
    const c = rowBtn('psc-c');
    if (c) { c.click(); await wait(120); const dn = document.querySelector('#planRowSheet [data-act="done"]'); if (dn) dn.click(); }
    await wait(900);
    const C2 = state.tasks.find(t => t.id === 'psc-c');
    add('กด "เสร็จแล้ว" → งานถูกติ๊กเสร็จ + แผ่นปิด', !!C2 && C2.done === true && !!C2.doneAt && !isOpen(), C2 ? 'done=' + C2.done : 'ไม่พบงาน');
    add('ติ๊กเสร็จแล้วงานหายจากเส้นเวลา', !rowIds().includes('psc-c'), 'แถว: ' + rowIds().join(','));
  } finally {
    // เอฟเฟกต์ฉลอง/ toast ที่ตามหลังติ๊กเสร็จ — เก็บให้เกลี้ยงก่อนคืนของ
    try { if (typeof closeFx === 'function') closeFx(true); } catch (_) {}
    await closeAll();
    document.querySelectorAll('.toast').forEach(x => x.remove());
    window.Date = RealDate;
    // คืนรายการงานเดิมทั้งก้อน (งานที่ทดสอบเลื่อน/ติ๊กเสร็จหายไปพร้อมกัน)
    state.tasks.splice(0, state.tasks.length, ...JSON.parse(origTasks));
    save();
    go('scr-menu'); await wait(150);
  }
  add('คืนรายการงานเดิมครบ', JSON.stringify(state.tasks) === origTasks);
  const pass = rows.filter(r => r.ok).length;
  console.log(`planSheetCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
