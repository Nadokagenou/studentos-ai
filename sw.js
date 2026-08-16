// students OS — Service Worker
// กลยุทธ์: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต) + cache fallback (เปิด offline ได้)
// บิลด์ทดลองที่ /alt/ ใช้ชื่อ cache คนละตัว — สลับไปมาสองรุ่นแล้วไฟล์ไม่ปนกัน
//
// ⚠️ ทุกชื่อในลิสต์นี้ต้องมีไฟล์อยู่จริง — addAll จะล้มทั้งก้อนถ้ามีตัวใดตัวหนึ่ง 404
//    แล้วแอปจะไม่มีแคชเลย (เปิดออฟไลน์ไม่ได้) โดยไม่มี error โผล่ให้เห็นที่หน้าจอ
//    เคยพลาดมาแล้วตอนคัดลอกไฟล์จาก alt/ ขึ้นมา: ลิสต์ยังมี icon-alt-* ซึ่ง root ไม่มี
const CACHE = 'studentos-1a7v-o';   // ขึ้นเวอร์ชันทุกครั้งที่ปล่อย ของเก่าถูกลบตอน activate
const SHELL = ['.', 'index.html', 'style.css', 'alt.css', 'inbox.css', 'custom.css',
  'engine.js', 'context.js', 'brain.js', 'inbox.js', 'linelink.js', 'app.js', 'config.js', 'manifest.json',
  'icon-192.png', 'icon-512.png', 'logo-mark.png', 'logo-splash.png', 'logo-splash-light.png'];

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
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'StudentOS AI', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'StudentOS AI';
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
