// StudentOS AI — Service Worker
// กลยุทธ์: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต) + cache fallback (เปิด offline ได้)
const CACHE = 'studentos-v4';
const SHELL = ['.', 'index.html', 'style.css', 'engine.js', 'app.js', 'config.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // ปล่อยให้คำขอข้ามโดเมนผ่านตรง ไม่ผ่าน SW เลย — กัน CDN ของ OCR (Tesseract.js,
  // wasm, ไฟล์ภาษา) พังเวลาเน็ตสะดุดแล้วตกไปหา cache ที่ไม่เคยเก็บไฟล์เหล่านี้ไว้
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
