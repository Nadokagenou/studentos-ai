// พลุตอนงานเสร็จ (celebrate ใน app.js) ต้องจบตามเวลา ไม่ใช่ตามจำนวนเฟรม (17 ต.ค. 69)
// ------------------------------------------------------------
// เดิมเศษกระดาษ 20 ชิ้นขยับทีละเฟรมจนครบ ~59 เฟรม และเขียน left/top ทุกเฟรม (จัดผังใหม่ทั้งหน้าทุกเฟรม)
// เครื่องเร็ว 60fps = ~1 วิ · เครื่องช้าที่เหลือ 5fps = ~12 วิ ที่เธรดหลักต้องจัดผังวนอยู่ — บั๊กแบบเดียวกับตัวเลขหมุนที่แก้ใน 1C56
//
// ใช้: ฉีดด้วย <script src="devtools/celebratecheck.js"> แล้วเรียก await celebrateCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
async function celebrateCheck() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = [];
  const add = (name, ok, note) => { rows.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { add('ข้าม: เครื่องตั้งลดการเคลื่อนไหว (พลุไม่เล่นอยู่แล้ว)', true); return { pass: 1, total: 1, rows }; }
  document.querySelectorAll('.particle').forEach(p => p.remove());
  // จำลองเครื่องช้ามาก: เฟรมมาทุก 200ms (5fps)
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 200);
  let maxCount = 0, gone = null; const t0 = performance.now();
  try {
    celebrate(null);
    for (let i = 0; i < 40; i++) {
      await wait(100);
      const n = document.querySelectorAll('.phone > .particle').length;
      maxCount = Math.max(maxCount, n);
      if (!n) { gone = Math.round(performance.now() - t0); break; }
    }
  } finally { window.requestAnimationFrame = raf; }
  add('มีพลุออกมาจริง', maxCount > 0, maxCount + ' ชิ้น');
  add('เครื่อง 5fps พลุหายหมดภายใน 2 วิ', gone !== null && gone <= 2000, gone === null ? 'ยังไม่หายหลัง 4 วิ' : 'หายหมดที่ ' + gone + 'ms');
  document.querySelectorAll('.particle').forEach(p => p.remove());
  // ③ ขยับด้วย transform ไม่ใช่ left/top — left/top เปลี่ยน = จัดผังใหม่ทุกเฟรม
  // วัดจริง 17 ต.ค. (CPU ช้า 6×, พลุ 5 รอบ): left/top จัดผัง 339ms · translate 25–43ms
  celebrate(null);
  const start = [...document.querySelectorAll('.phone > .particle')].map(p => [p, p.style.left, p.style.top]);
  await wait(300);
  const alive = start.filter(([p]) => p.isConnected);
  const moved = alive.filter(([p, l, t]) => p.style.left !== l || p.style.top !== t).length;
  const viaTf = alive.filter(([p]) => /translate/.test(p.style.transform)).length;
  add('เศษกระดาษขยับด้วย transform (ไม่เขียน left/top ทุกเฟรม)', alive.length > 0 && !moved && viaTf === alive.length,
    `${alive.length} ชิ้น · left/top เปลี่ยน ${moved} · ใช้ translate ${viaTf}`);
  document.querySelectorAll('.particle').forEach(p => p.remove());
  const pass = rows.filter(r => r.ok).length;
  console.log(`celebrateCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
