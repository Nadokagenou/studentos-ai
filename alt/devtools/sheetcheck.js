// แผ่นเพิ่มงาน (ปุ่ม +): ปิดแล้วต้องไม่บังการแตะ · ปิดแล้วกดเปิดซ้ำเร็ว ๆ ต้องเปิดจริง (17 ต.ค. 69)
// ------------------------------------------------------------
// ทำไม: ตอนปิด แผ่นถอดคลาส .on (เลื่อนลง · ฉากหลังจางเป็น 0) แล้วรอตัวจับเวลา 200ms ถึงจะ hidden
// ระหว่างนั้นแผ่นเต็มจอ (z-index 95) ยังรับการแตะ — มือถือช้า ตัวจับเวลามาช้ากว่า 200ms มาก = แตะอะไรก็ไม่ติด
// และกด + ซ้ำในช่วงนั้น โค้ดคิดว่า "เปิดอยู่แล้ว" (ยังไม่ hidden) เลยไม่ใส่ .on คืน → ตัวจับเวลาเดิมซ่อนแผ่นทิ้ง = กดแล้วไม่ขึ้น
//
// ใช้: ฉีดด้วย <script src="devtools/sheetcheck.js"> แล้วเรียก await sheetCheck()  (ไม่ถูกโหลดโดยแอป · ห้าม eval)
async function sheetCheck() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const el = document.getElementById('addSheet');
  const rows = [];
  const add = (name, ok, note) => { rows.push({ name, ok, note }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
  if (!el) { add('มีแผ่นเพิ่มงานในหน้า', false); return { pass: 0, total: 1, rows }; }
  go('scr-menu'); await sleep(300);
  // ① ระหว่างกำลังปิด การแตะต้องทะลุไปถึงจอข้างหลัง
  openAddSheet(); await sleep(400);
  closeAddSheet();
  const hit = document.elementFromPoint(innerWidth / 2, innerHeight * .3);
  const blocked = !!(hit && hit.closest('#addSheet'));
  add('ระหว่างแผ่นกำลังปิด แตะทะลุถึงจอข้างหลัง', !blocked, blocked ? 'โดน ' + (hit.className || hit.tagName) + ' บังไว้' : '');
  await sleep(400);
  // ② ปิดแล้วกดเปิดซ้ำทันที (ก่อนตัวจับเวลาปิดจะทำงาน) → ต้องเปิดอยู่จริงหลังจากนั้น
  openAddSheet(); await sleep(400);
  closeAddSheet(); await sleep(30);
  openAddSheet(); await sleep(600);
  const open = !el.hidden && el.classList.contains('on') && !!el.querySelector('.as-card');
  add('ปิดแล้วกดเปิดซ้ำทันที แผ่นเปิดอยู่จริง', open, `hidden=${el.hidden} on=${el.classList.contains('on')} card=${!!el.querySelector('.as-card')}`);
  closeAddSheet(); await sleep(400);
  // ③ ปกติ: เปิดแล้วรับการแตะ · ปิดสนิทแล้ว hidden
  openAddSheet(); await sleep(400);
  const hit2 = document.elementFromPoint(innerWidth / 2, innerHeight * .3);
  add('ตอนเปิด ฉากหลังของแผ่นรับการแตะ (แตะพื้นที่ว่าง = ปิด)', !!(hit2 && hit2.closest('#addSheet')));
  closeAddSheet(); await sleep(450);
  add('ปิดสนิทแล้วแผ่นถูกซ่อน', el.hidden === true);
  // ④ แผ่น "กำลังจะเปิด" (soonSheet) — บั๊กเดียวกัน: ปิดแล้วเปิดซ้ำทันที ตัวจับเวลาปิดของรอบก่อนล้างแผ่นใหม่ทิ้ง
  const soon = document.getElementById('soonSheet');
  if (soon && typeof openSoonSheet === 'function') {
    const key = Object.keys(typeof SOON_SHEETS === 'object' ? SOON_SHEETS : {})[0];
    openSoonSheet(key); await sleep(400);
    closeSoonSheet(); await sleep(30);
    openSoonSheet(key); await sleep(600);
    const ok = !soon.hidden && soon.classList.contains('on') && !!soon.querySelector('.as-card');
    add('แผ่น "กำลังจะเปิด" ปิดแล้วเปิดซ้ำทันที ยังเปิดอยู่จริง', ok, `hidden=${soon.hidden} on=${soon.classList.contains('on')} card=${!!soon.querySelector('.as-card')}`);
    closeSoonSheet(); await sleep(400);
  }
  const pass = rows.filter(r => r.ok).length;
  console.log(`sheetCheck: ${pass}/${rows.length}`);
  return { pass, total: rows.length, rows };
}
