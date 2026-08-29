// Student OS — Service Worker
// กลยุทธ์: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต) + cache fallback (เปิด offline ได้)
// ชื่อ cache ผูกกับเลขรุ่น — ปล่อยรุ่นใหม่แล้วของเก่าถูกลบทิ้งตอน activate
// สายนี้เคยเป็นบิลด์ทดลอง (ALT) และถูกยกขึ้นเป็นตัวหลักตั้งแต่ 1A7V2 · ชื่อ cache เลยเปลี่ยนตาม
// -m: เปลี่ยนโลโก้ทั้งชุด — ชื่อไฟล์เดิมทุกไฟล์ ถ้าไม่ขึ้นเลขรุ่น เครื่องที่ติดตั้งไว้แล้ว
// จะเสิร์ฟโลโก้เก่าจากแคชต่อไปโดยไม่มีอะไรบอกว่ามีของใหม่
const CACHE = 'studentos-1b6-klasse'; // ขึ้นเวอร์ชันทุกครั้งที่ปล่อย ของเก่าถูกลบตอน activate
// ทุกไฟล์ที่ index.html อ้างถึงต้องอยู่ในรายการนี้ — ไฟล์ที่หน้าเรียกแต่ไม่ได้แคชไว้
// จะหายไปเงียบ ๆ ตอนออฟไลน์ โดยไม่มีอะไรบอกว่าหายไปไหน (visual-editor.js กับไอคอน icon-alt-*
// เป็นสองอย่างที่หน้ายังอ้างถึงอยู่จริง)
const SHELL = ['.', 'index.html', 'style.css', 'alt.css', 'inbox.css', 'today.css', 'custom.css',
  'engine.js', 'context.js', 'planner.js', 'brain.js', 'inbox.js', 'linelink.js', 'app.js', 'config.js',
  'visual-editor.js', 'manifest.json',
  'icon-alt-192.png', 'icon-alt-512.png', 'icon-192.png', 'icon-512.png',
  'logo-mark.png', 'logo-splash.png', 'logo-splash-light.png',
  // หน้าน้องไซบนฟองแชท — ต้องอยู่ในแคชด้วย ไม่งั้นเปิดแอปตอนไม่มีเน็ตแล้วมาสคอตหายไปทั้งจอ
  'sai-avatar.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---------- Web Push: เตือนได้แม้ปิดแอป ----------
// ชื่อแอปต้องอยู่บนสุดของการ์ดเสมอ — บนเครื่องที่ยังไม่ได้ติดตั้งเป็นแอป
// เบราว์เซอร์จะขึ้นชื่อโดเมนดิบ ๆ แทน ซึ่งไม่มีใครรู้ว่าคืออะไร
// ใส่ที่นี่ที่เดียว ข้อความทุกอันฝั่งเซิร์ฟเวอร์จึงไม่ต้องพกชื่อแอปติดตัวไปด้วย
const APP_NAME = 'Student OS';
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title ? APP_NAME + ' · ' + d.title : APP_NAME;
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'studentos-reminder',
    renotify: true,
    requireInteraction: false,
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.registration.scope) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // ปล่อยให้คำขอข้ามโดเมนผ่านตรง ไม่ผ่าน SW เลย — กัน CDN ของ OCR (Tesseract.js,
  // wasm, ไฟล์ภาษา) พังเวลาเน็ตสะดุดแล้วตกไปหา cache ที่ไม่เคยเก็บไฟล์เหล่านี้ไว้
  if (new URL(e.request.url).origin !== location.origin) return;
  // cache: 'no-store' สำคัญกว่าที่เห็น — network-first เฉย ๆ ยังไม่พอ
  // เพราะ HTTP cache ของเบราว์เซอร์นั่งขวางอยู่หน้า fetch() ของ SW อีกชั้น
  // GitHub Pages ส่ง max-age=600 มาด้วย แปลว่าอัปเดตแล้วผู้ใช้จะยังเห็นของเก่า
  // ไปอีก 10 นาที รีเฟรชกี่ครั้งก็ไม่เปลี่ยน — ซึ่งหาสาเหตุยากมากเวลาเจอ
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
