// ปุ่มกลับพาไปจอที่เปิดมา ไม่ใช่จอตายตัว (20 ต.ค. 69)
// ------------------------------------------------------------
// เจ้าของ: "ตรวจดูว่าเมื่อกดปุ่มออกแล้วจะไปอยู่หน้าไหน … หน้าไหนออกแล้วไปอยู่หน้าที่ควรอยู่"
// ไล่ทุกปุ่มที่พาไปจออื่นแล้วกดกลับ (สคริปต์ crawl 40 ทาง) — 16 ทางกลับไม่ถึงจอเดิม เพราะปุ่มกลับเขียนปลายทางตายตัว
// เช่น หน้าแรก → บริบทของฉัน → กลับ = แท็บ "ฉัน" · ตั้งค่า → ร้านค้า → กลับ = แท็บ "ฉัน"
// และหน้าเข้าสู่ระบบที่เปิดจากในแอปไม่มีทางกลับเลย (ปุ่มย้อนของเครื่องก็ไม่ทำอะไร)
// "กด" กลับ = backOneScreen() ทางเดียวกับปุ่มย้อนของเครื่อง ซึ่งกดปุ่มกลับบนหัวจอให้
//
// ใช้: ฉีดด้วย <script src="devtools/backroutecheck.js"> แล้วเรียก await backRouteCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
async function backRouteCheck() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = [];
  const add = (name, ok, note) => { rows.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
  const closeAll = async () => { for (let i = 0; i < 6 && openOverlayEl(); i++) dismissTopOverlay(); await wait(40); };
  const back = async () => { backOneScreen(); await wait(250); return curScreen; };
  // เดินตามทาง แล้วกดกลับทีละครั้ง เทียบจอที่ลงกับที่คาด
  const route = async (name, path, expect) => {
    await closeAll(); go('scr-menu'); await wait(150);
    for (const id of path) { go(id); await wait(200); }
    const got = [];
    for (let i = 0; i < expect.length; i++) got.push(await back());
    add(name, got.join(' › ') === expect.join(' › '), `${path.join(' → ')} · กลับได้ ${got.join(' › ')} (ควร ${expect.join(' › ')})`);
  };
  const skip = localStorage.getItem('studentos.alt.skipLogin');
  try {
    await route('หน้าแรก → บริบทของฉัน → กลับ = หน้าแรก', ['scr-context'], ['scr-menu']);
    await route('แผน → บริบทของฉัน → กลับ = แผน', ['scr-plan', 'scr-context'], ['scr-plan']);
    await route('งาน → สแกนตาราง → กลับ = งาน', ['scr-tasks', 'scr-ttscan'], ['scr-tasks']);
    await route('บริบท → สแกนตาราง → กลับ › กลับ = บริบท › หน้าแรก', ['scr-context', 'scr-ttscan'], ['scr-context', 'scr-menu']);
    await route('สำรวจ → ข่าวสาร → กลับ = สำรวจ', ['scr-explore', 'scr-news'], ['scr-explore']);
    await route('ตั้งค่า → ร้านค้า → กลับ = ตั้งค่า', ['scr-profile', 'scr-settings', 'scr-shop'], ['scr-settings']);
    await route('ตั้งค่า → เหรียญตรา → กลับ = ตั้งค่า', ['scr-profile', 'scr-settings', 'scr-badges'], ['scr-settings']);
    await route('ตั้งค่า → เพื่อน → กลับ = ตั้งค่า', ['scr-profile', 'scr-settings', 'scr-mates'], ['scr-settings']);
    await route('ตั้งค่า → Pro → กลับ = ตั้งค่า', ['scr-profile', 'scr-settings', 'scr-pro'], ['scr-settings']);
    // ห้ามวน: จอลูกกลับขึ้นมาหาแม่ด้วยปุ่มตายตัว (สุ่ม → go('scr-shop')) ต้องไม่ถูกจำเป็น "ที่มา" ของร้านค้า
    await route('ตั้งค่า → ร้านค้า → สุ่ม → กลับ › กลับ = ร้านค้า › ตั้งค่า (ไม่วน)', ['scr-profile', 'scr-settings', 'scr-shop', 'scr-wheel'], ['scr-shop', 'scr-settings']);
    await route('หน้าแรก → เหรียญตรา → กลับ = หน้าแรก (ของเดิมที่ถูกอยู่แล้ว)', ['scr-badges'], ['scr-menu']);
    // จอพูด/ถ่ายรูปแทนพิมพ์ไม่มีปุ่มกลับบนหัวจอ — ปุ่มย้อนของเครื่องเคยพาไปหน้าแรก ทิ้งฟอร์มที่กรอกค้าง
    await closeAll(); go('scr-menu'); await wait(100); openForm(null); await wait(250); go('scr-scan'); await wait(200);
    add('ฟอร์มเพิ่มงาน → พูด/ถ่ายรูป → กลับ = ฟอร์ม', (await back()) === 'scr-form', curScreen);
    // ฟอร์มสลับจอเองไม่ผ่าน go() — เดิม curScreen ค้างเป็นจอก่อนหน้า ปุ่มย้อนของเครื่องบนฟอร์มเลยคิดว่าอยู่หน้าแรก
    // ไม่ทำอะไร (กดซ้ำ = Android ปิดแอปทั้งที่กรอกงานค้าง) · ต้องปิดฟอร์มกลับจอที่เปิดมา
    await closeAll(); go('scr-tasks'); await wait(150); openForm(null); await wait(250);
    add('ฟอร์มเพิ่มงาน: แอปรู้ว่าอยู่ที่ฟอร์ม', curScreen === 'scr-form', curScreen);
    add('ฟอร์มเพิ่มงานจากแท็บงาน → ปุ่มย้อนของเครื่อง = แท็บงาน', (await back()) === 'scr-tasks', curScreen);
    // ไม่รู้ที่มา (เปิดแอปกลับมาที่จอนั้นตรง ๆ) = ปุ่มทำงานแบบเดิม
    await closeAll(); go('scr-menu'); await wait(100);
    if (typeof backFrom === 'object') delete backFrom['scr-context'];
    curScreen = 'scr-context'; document.querySelectorAll('.screen.on').forEach(s => s.classList.remove('on'));
    document.getElementById('scr-context').classList.add('on'); await wait(50);
    add('ไม่รู้ที่มา = ปลายทางเดิมของปุ่ม (บริบท → ฉัน)', (await back()) === 'scr-profile', curScreen);

    // หน้าเข้าสู่ระบบที่เปิดจากในแอป (ผู้ใช้แบบไม่สมัคร) — มีปุ่มกลับ และปุ่มย้อนของเครื่องพากลับ
    localStorage.setItem('studentos.alt.skipLogin', '1');
    await closeAll(); go('scr-profile'); await wait(150); go('scr-login'); await wait(250);
    const lb = document.querySelector('#scr-login .lg-back');
    add('เข้าสู่ระบบจากแท็บฉัน = มีปุ่มกลับ', !!lb && lb.offsetParent !== null);
    add('เข้าสู่ระบบจากแท็บฉัน → กลับ = แท็บฉัน', (await back()) === 'scr-profile', curScreen);
    // ออกจากระบบ (ล้าง skipLogin ก่อนพาไปหน้าเข้าสู่ระบบ) — ห้ามมีทางกลับเข้าแอป
    localStorage.removeItem('studentos.alt.skipLogin');
    await closeAll(); go('scr-settings'); await wait(150); go('scr-login'); await wait(250);
    const lb2 = document.querySelector('#scr-login .lg-back');
    add('หลังออกจากระบบ = ไม่มีปุ่มกลับ', !lb2 || lb2.offsetParent === null);
  } finally {
    if (skip === null) localStorage.removeItem('studentos.alt.skipLogin'); else localStorage.setItem('studentos.alt.skipLogin', skip);
    await closeAll(); go('scr-menu');
  }
  const pass = rows.filter(r => r.ok).length;
  console.log(`backRouteCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
