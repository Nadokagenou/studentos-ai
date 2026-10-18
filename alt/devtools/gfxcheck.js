// ระดับกราฟิก น้อย · กลาง · มาก (ตั้งค่า › กราฟิก) · 19 ต.ค. 69
// ------------------------------------------------------------
// เจ้าของ: "ทำให้มีปุ่มสามารถปรับกราฟิกหรือความสวยได้หน่อย และก็ปรับตามนั้น มี น้อย กลาง มาก"
// มาก = ครบทุกอย่าง · กลาง = โหมดลื่นเดิม (data-lite) · น้อย = กลาง + ไม่มีฉากธีม/อนิเมชันเข้าจอ/พลุ (data-quality="low")
// (เดิมใช้ data-gfx — ชนกับธีม glitch ที่ใช้ชื่อนี้สั่นจอแล้ว removeAttribute ทุกครั้งที่ applyTheme · เปิดแอปมาที่ระดับน้อยแล้วกลายเป็นกลาง)
// คีย์เดิม studentos.alt.lite ยังใช้เหมือนเดิม ('1' = ลด · '0' = ผู้ใช้เลือกเต็ม ตัววัดไม่เปิดให้อีก) + คีย์ใหม่ studentos.alt.gfx
//
// ใช้: ฉีดด้วย <script src="devtools/gfxcheck.js"> แล้วเรียก await gfxCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
// คืนระดับเดิมของผู้ใช้ตอนจบ
async function gfxCheck() {
  const rows = [];
  const add = (name, ok, note) => { rows.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
  if (typeof setGfx !== 'function') { add('มีตัวปรับระดับกราฟิก (setGfx)', false); return { pass: 0, total: 1, rows }; }
  const root = document.documentElement;
  const keep = { lite: localStorage.getItem('studentos.alt.lite'), gfx: localStorage.getItem('studentos.alt.gfx'), dl: root.dataset.lite, dg: root.dataset.quality };
  const seg = () => [...document.querySelectorAll('#gfxSeg button')];
  const pressed = () => (seg().find(b => b.getAttribute('aria-pressed') === 'true') || {}).dataset?.gfx;
  try {
    add('มีปุ่มสามระดับในตั้งค่า', seg().length === 3 && seg().map(b => b.textContent.trim()).join(',') === 'น้อย,กลาง,มาก', seg().map(b => b.textContent.trim()).join(','));
    setGfx('high');
    add('มาก = ไม่ลดอะไร', !root.dataset.lite && !root.dataset.quality && pressed() === 'high', `lite=${root.dataset.lite} quality=${root.dataset.quality}`);
    add('มาก = ตัววัดเครื่องไม่เปิดโหมดลดให้เอง', localStorage.getItem('studentos.alt.lite') === '0' && localStorage.getItem('studentos.alt.gfx') === 'high');
    setGfx('mid');
    add('กลาง = โหมดลื่นเดิม', root.dataset.lite === '1' && !root.dataset.quality && pressed() === 'mid', `lite=${root.dataset.lite} quality=${root.dataset.quality}`);
    setGfx('low');
    add('น้อย = โหมดลื่น + ลดเพิ่ม', root.dataset.lite === '1' && root.dataset.quality === 'low' && pressed() === 'low', `lite=${root.dataset.lite} quality=${root.dataset.quality}`);
    // ตั้งธีมใหม่ (รวมถึงตอนเปิดแอป) ต้องไม่ล้างระดับทิ้ง — เคยหายเพราะชื่อชนกับธีม glitch
    if (typeof applyTheme === 'function') applyTheme();
    add('ตั้งธีมแล้วระดับไม่หาย', gfxLevel() === 'low', `quality=${root.dataset.quality}`);
    add('เลือกแล้วจำไว้', localStorage.getItem('studentos.alt.gfx') === 'low' && localStorage.getItem('studentos.alt.lite') === '1');
    // น้อย: ฉากของธีมไม่วาดเลย
    const fx = document.querySelector('.fx, .starfield');
    add('น้อย = ฉากของธีมซ่อน', !fx || getComputedStyle(fx).display === 'none', fx ? getComputedStyle(fx).display : 'ไม่มีฉาก');
    // น้อย: ไม่มีพลุตอนงานเสร็จ
    document.querySelectorAll('.particle').forEach(p => p.remove());
    if (typeof celebrate === 'function') celebrate(null);
    add('น้อย = ไม่มีพลุ', !document.querySelector('.phone > .particle'));
    document.querySelectorAll('.particle').forEach(p => p.remove());
    // น้อย: จอใหม่ไม่ลอยขึ้น (อนิเมชันเข้าจอ)
    go('scr-tasks'); go('scr-menu');
    const anim = getComputedStyle(document.getElementById('scr-menu')).animationName;
    add('น้อย = จอใหม่ไม่มีอนิเมชันเข้า', anim === 'none', anim);
  } finally {
    const put = (k, v) => { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); };
    put('studentos.alt.lite', keep.lite); put('studentos.alt.gfx', keep.gfx);
    if (keep.dl === undefined) delete root.dataset.lite; else root.dataset.lite = keep.dl;
    if (keep.dg === undefined) delete root.dataset.quality; else root.dataset.quality = keep.dg;
    if (typeof syncGfxRow === 'function') syncGfxRow();
  }
  const pass = rows.filter(r => r.ok).length;
  console.log(`gfxCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
