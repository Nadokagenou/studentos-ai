// เลือกเอฟเฟกต์ตอนงานเสร็จ = เลือกเฉย ๆ · กด "ลองเล่นดู" ถึงจะเล่น (18 ต.ค. 69)
// ------------------------------------------------------------
// เจ้าของ: "แก้ให้มันเสถียรกว่าเดิม ให้เลือกก่อนแล้วกดเล่น ไม่ใช่กดเลือกแล้วเล่นเลย"
// เดิม setDoneFx (แตะชื่อเกม) และ setFx3dMode (สลับ 2D/3D) เปิดเกมทันทีทุกครั้ง — ไล่แตะดูหลายตัว = โหลดเกม (3D หนัก) ซ้ำ ๆ
// และแตะ "ลองเล่นดู" ซ้ำระหว่างเกมเปิด = ปิดแล้วสร้างเกมใหม่ (fxShell เรียก closeFx ก่อนเสมอ) — เครื่องช้าสะดุด
//
// ใช้: ฉีดด้วย <script src="devtools/fxpickcheck.js"> แล้วเรียก await fxPickCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
// ไม่แตะข้อมูลผู้ใช้ — คืนค่าที่เลือกไว้เดิมตอนจบ · จำลองว่ามีเอฟเฟกต์ครบด้วยการแทน fxOwned ชั่วคราว
async function fxPickCheck() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = [];
  const add = (name, ok, note) => { rows.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
  if (typeof setDoneFx !== 'function' || typeof FX_SHOP !== 'object') { add('มีระบบเอฟเฟกต์ให้ทดสอบ', false); return { pass: 0, total: 1, rows }; }
  const open = () => !!document.querySelector('.hoop-ov:not(.out)');
  let saved = null; try { saved = localStorage.getItem(DONEFX_KEY); } catch (_) {}
  const ownedOrig = window.fxOwned;
  const shellOrig = window.fxShell; let shells = 0;
  window.fxOwned = () => true;
  window.fxShell = function () { shells++; return shellOrig.apply(this, arguments); };
  const id = Object.keys(FX_SHOP).find(k => k !== 'hoop') || 'hoop';
  try {
    for (let i = 0; i < 5 && openOverlayEl(); i++) dismissTopOverlay();
    if (typeof closeFx === 'function') closeFx(true);
    shells = 0;
    setDoneFx(id); await wait(250);
    add('แตะเลือกเอฟเฟกต์ = เลือกอย่างเดียว ไม่เล่น', !open() && shells === 0, `เปิดเกม ${shells} ครั้ง`);
    add('ค่าที่เลือกถูกบันทึก', doneFxPref() === id, doneFxPref());
    shells = 0;
    setFx3dMode(id, false); await wait(250);
    add('สลับ 2D/3D = ไม่เล่น', !open() && shells === 0, `เปิดเกม ${shells} ครั้ง`);
    const btn = document.getElementById('fxTry');
    shells = 0;
    if (btn) { btn.click(); btn.click(); btn.click(); } else previewFx(id);
    await wait(400);
    add('กด "ลองเล่นดู" = เล่นตัวที่เลือก', open(), '');
    add('กดซ้ำระหว่างเกมเปิด ไม่สร้างเกมใหม่', shells === 1, `สร้าง ${shells} ครั้ง`);
  } finally {
    if (typeof closeFx === 'function') closeFx(true);
    window.fxOwned = ownedOrig; window.fxShell = shellOrig;
    try { if (saved === null) localStorage.removeItem(DONEFX_KEY); else localStorage.setItem(DONEFX_KEY, saved); } catch (_) {}
    if (typeof renderFxPick === 'function') renderFxPick();
  }
  const pass = rows.filter(r => r.ok).length;
  console.log(`fxPickCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
