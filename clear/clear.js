// ============================================================
// Student OS Clear · กันทางเข้าจอของฟีเจอร์ที่ถอดออก (เฟส 1 · 16 พ.ย. 69)
// ------------------------------------------------------------
// สคริปต์ของจอพวกนี้ไม่ถูกโหลดแล้ว แต่ app.js ยังมีทางเรียก go() ไปหาได้หลายทาง
// (ลิงก์ในการ์ด · ปุ่มลัด · จอที่จำไว้ตอนปิดแอปครั้งก่อน) — ดักที่ go() ที่เดียว ส่งกลับหน้าแรก
// โหลดหลัง app.js เท่านั้น · go เป็น function ระดับบนสุด เรียกผ่านชื่อจึงมาถึงตัวนี้ทุกทาง
// ============================================================
(function () {
  'use strict';
  const CUT = new Set(['scr-ai', 'scr-mates', 'scr-people', 'scr-compose', 'scr-user', 'scr-post', 'scr-chat',
    'scr-hw', 'scr-topic', 'scr-tthread', 'scr-dm', 'scr-room', 'scr-shop', 'scr-pro', 'scr-wheel',
    'scr-board', 'scr-events', 'scr-badges', 'scr-news', 'scr-classrooms']);
  if (typeof window.go !== 'function') return;
  const go = window.go;
  window.go = function (id, ...rest) { return go.call(this, CUT.has(id) ? 'scr-menu' : id, ...rest); };
  if (typeof curScreen === 'string' && CUT.has(curScreen)) window.go('scr-menu');

  // ฟังก์ชันของไฟล์ที่ถอดออก ที่ app.js เรียกตรง ๆ โดยไม่เช็ค typeof (สแกน 16 พ.ย. 69)
  // ตัวที่มีเช็ค typeof อยู่แล้ว (openFeed · openDmInbox · openBoard · guardImage · FX_SHOP) ห้ามใส่ตรงนี้
  // ไม่งั้นแอปจะคิดว่าฟีเจอร์นั้นยังอยู่แล้วโชว์ปุ่มกลับมา
  const noop = () => {};
  for (const name of ['openEvents', 'openUser', 'staffNotifOpen', 'closeFx', 'closeTopicAsk', 'boardWarm', 'loginFromFriends']) {
    if (typeof window[name] !== 'function') window[name] = noop;
  }
  // ร้านค้า: index.html ถอด id="shopBody" ออก → renderShop() จบตั้งแต่บรรทัดแรก
  // (ต้องตัดที่นั่น ไม่ใช่ที่นี่ — app.js วาดทุกจอครั้งแรกตอนบูตก่อนไฟล์นี้จะโหลด)
})();
