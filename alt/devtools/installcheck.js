// ปุ่ม "ติดตั้งเลย" (ตั้งค่า) — แตะซ้ำระหว่างหน้าต่างติดตั้งยังเปิด ต้องไม่เรียก prompt() รอบสอง (17 ต.ค. 69)
// ------------------------------------------------------------
// เหตุการณ์ beforeinstallprompt ของเบราว์เซอร์เรียก prompt() ได้ครั้งเดียว · รอบสองโยน error ที่ไม่มีใครจับ
// เดิม handleInstallClick ล้างตัวแปรหลังผู้ใช้ตอบหน้าต่างเท่านั้น — แตะซ้ำตอนหน้าต่างยังเปิด (มือถือช้า คนแตะซ้ำบ่อย) = เรียกซ้ำ
// และถ้า prompt() ล้ม บรรทัดล้างไม่เคยทำงาน ปุ่มค้างเป็น "ติดตั้งเลย" แตะทีไรพังทุกที (ตัวสำรวจปุ่มทุกจอเจอ 17 ต.ค.)
//
// ใช้: ฉีดด้วย <script src="devtools/installcheck.js"> แล้วเรียก await installCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
async function installCheck() {
  const rows = [];
  const add = (name, ok, note) => { rows.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
  const fake = () => { let calls = 0, answer;
    const ev = { prompt() { calls++; return calls > 1 ? Promise.reject(new DOMException('prompt() ใช้ได้ครั้งเดียว', 'InvalidStateError')) : Promise.resolve(); },
      userChoice: new Promise(r => { answer = r; }) };
    return { ev, calls: () => calls, answer: () => answer({ outcome: 'dismissed' }) }; };
  const leaks = []; const onRej = e => { leaks.push(String(e.reason && e.reason.message || e.reason)); e.preventDefault(); };
  window.addEventListener('unhandledrejection', onRej);
  const saved = deferredInstallPrompt;
  try {
    // ① แตะสองครั้งติดกันระหว่างหน้าต่างยังเปิด
    const f = fake(); deferredInstallPrompt = f.ev;
    const a = handleInstallClick(); const b = handleInstallClick();
    await new Promise(r => setTimeout(r, 50)); f.answer(); await Promise.allSettled([a, b]); await new Promise(r => setTimeout(r, 50));
    add('แตะซ้ำระหว่างหน้าต่างติดตั้งเปิด เรียก prompt() ครั้งเดียว', f.calls() === 1, 'เรียก ' + f.calls() + ' ครั้ง');
    add('ไม่มี error หลุดออกมา', !leaks.length, leaks.join(' | '));
    // ② prompt() ล้ม → ปุ่มต้องไม่ค้างเป็นของที่ใช้ไม่ได้
    const g = { prompt: () => Promise.reject(new DOMException('ล้ม', 'NotAllowedError')), userChoice: new Promise(() => {}) };
    deferredInstallPrompt = g; leaks.length = 0;
    await Promise.race([handleInstallClick(), new Promise(r => setTimeout(r, 300))]); await new Promise(r => setTimeout(r, 50));
    add('prompt() ล้ม = ไม่เก็บเหตุการณ์ที่ใช้ไม่ได้ไว้ต่อ', deferredInstallPrompt !== g, '');
    add('prompt() ล้มก็ไม่มี error หลุดออกมา', !leaks.length, leaks.join(' | '));
  } finally {
    deferredInstallPrompt = saved; window.removeEventListener('unhandledrejection', onRej);
  }
  const pass = rows.filter(r => r.ok).length;
  console.log(`installCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
