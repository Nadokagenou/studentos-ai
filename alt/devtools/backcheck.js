// ปุ่มย้อนกลับของเครื่อง (Android) ระหว่างเอฟเฟกต์ฉลองงานเสร็จ (เกมชู้ตลูก ฯลฯ) ต้องปิดเอฟเฟกต์ ไม่ใช่ย้อนจอข้างหลัง (17 ต.ค. 69)
// ------------------------------------------------------------
// เดิมชั้นเอฟเฟกต์ (.hoop-ov) ไม่อยู่ในรายการชั้นที่ปุ่มย้อนกลับต้องปิดก่อน (OVERLAYS ใน app.js)
// กดย้อนกลับ = จอข้างหลังเปลี่ยน (หน้า "ฉัน" → หน้าแรก) ทั้งที่เอฟเฟกต์ยังค้าง · และจอใหม่โปร่งใสค้าง
// เพราะระหว่างเอฟเฟกต์แอปหยุดอนิเมชันของจอข้างหลัง (.phone.fx-on) อนิเมชันเข้าจอเลยค้างอยู่ที่เฟรมแรก
//
// ใช้: ฉีดด้วย <script src="devtools/backcheck.js"> แล้วเรียก await backCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
async function backCheck() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = [];
  const add = (name, ok, note) => { rows.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
  if (typeof previewFx !== 'function') { add('มีเอฟเฟกต์ให้ทดสอบ', false); return { pass: 0, total: 1, rows }; }
  // ปิดชั้นอื่นที่อาจเด้งเองก่อน (แผ่นรับของรายวัน ฯลฯ) — ไม่งั้นปุ่มย้อนไปปิดชั้นนั้นแทน
  for (let i = 0; i < 5 && openOverlayEl(); i++) dismissTopOverlay();
  go('scr-tasks'); await wait(300); go('scr-profile'); await wait(300);
  const before = curScreen;
  previewFx('hoop'); await wait(500);
  add('เปิดเอฟเฟกต์ได้', !!document.querySelector('.hoop-ov'));
  window.dispatchEvent(new PopStateEvent('popstate'));          // = กดย้อนกลับของเครื่องหนึ่งครั้ง
  await wait(400);
  const open = !!document.querySelector('.hoop-ov:not(.out)');
  add('กดย้อนกลับ = ปิดเอฟเฟกต์', !open);
  add('จอข้างหลังไม่เปลี่ยน', curScreen === before, `ก่อน ${before} · หลัง ${curScreen}`);
  add('อนิเมชันของจอกลับมาเดิน', !document.querySelector('.phone').classList.contains('fx-on'));
  if (typeof closeFx === 'function') closeFx(true);
  const pass = rows.filter(r => r.ok).length;
  console.log(`backCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
