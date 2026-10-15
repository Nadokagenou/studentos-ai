// Student OS — Service Worker
// กลยุทธ์: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต) + cache fallback (เปิด offline ได้)
// บิลด์ทดลองที่ /alt/ ใช้ชื่อ cache คนละตัว — สลับไปมาสองรุ่นแล้วไฟล์ไม่ปนกัน
//
// ⚠️ ทุกชื่อในลิสต์นี้ต้องมีไฟล์อยู่จริง — addAll จะล้มทั้งก้อนถ้ามีตัวใดตัวหนึ่ง 404
//    แล้วแอปจะไม่มีแคชเลย (เปิดออฟไลน์ไม่ได้) โดยไม่มี error โผล่ให้เห็นที่หน้าจอ
//    เคยพลาดมาแล้วตอนคัดลอกไฟล์จาก alt/ ขึ้นมา: ลิสต์ยังมี icon-alt-* ซึ่ง root ไม่มี
const CACHE = 'studentos-main-1c57-plus-shortcuts-20261015'; // ปุ่มลัดรวมในเมนู + คงเลขรุ่นเดิม
const SHELL = ['.', 'index.html', 'style.css', 'alt.css', 'inbox.css', 'today.css', 'room.css', 'social.css', 'feed.css', 'safety.css', 'hw.css', 'topic.css', 'custom.css',
  'engine.js', 'context.js', 'planner.js', 'facts.js', 'profile.js', 'simulate.js', 'calibrate.js', 'loss.js', 'decide.js', 'brain.js', 'inbox.js', 'linelink.js', 'room.js', 'social.js', 'feed.js', 'hw.js', 'topic.js', 'safety.js', 'app.js', 'config.js', 'remote-config.js',
  'integrations.js', 'sai.css', 'sai.js', 'sai-face-normal.webp', 'sai-face-happy.webp', 'sai-face-wow.webp', 'sai-face-serious.webp', 'sai-face-sleepy.webp', 'sai-face-sulk.webp', 'sai-chibi.webp', 'hoop.css', 'hoop.js', 'fxgames.css', 'gacha-fx.css', 'fxgames.js', 'fx3d.js', 'gacha-fx.js', 'hook-avatar.png', 'hook-body.webp', 'hook-face.webp', 'quickadd.js', 'board.css', 'board.js', 'news.js', 'manifest.json', 'shortcut-draft.js',
  'icon-192.png', 'icon-512.png', 'logo-mark.png', 'logo-splash.png', 'logo-splash-light.png',
  // หน้าน้องไซบนฟองแชท — ต้องอยู่ในแคชด้วย ไม่งั้นเปิดแอปตอนไม่มีเน็ตแล้วมาสคอตหายไปทั้งจอ
  'sai-avatar.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && (k.startsWith('studentos-main-') || /^studentos-1[a-z0-9-]*$/i.test(k))).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---------- Web Push: เตือนได้แม้ปิดแอป ----------
// 1C33 · ไม่เติมชื่อแอปหน้าหัวการ์ดแล้ว — ตรงกับ alt/sw.js (root ค้างรุ่นเก่ามาจนถึง 12 ต.ค.)
// iPhone เติม "from Student OS" ให้ทุกการ์ดของเว็บแอปเองอยู่แล้ว · Android มีแถวชื่อแอปบนสุด
// เติมเองอีกจึงกลายเป็นชื่อแอปซ้ำ และการ์ดแชทกลายเป็น "Student OS · ชื่อเพื่อน" สามบรรทัด
const APP_NAME = 'Student OS';
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || APP_NAME;
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
  const requestUrl = new URL(e.request.url);
  if (requestUrl.origin !== location.origin) return;
  const appPath = new URL(self.registration.scope).pathname;
  if (requestUrl.pathname.startsWith(appPath + 'alt/') || requestUrl.pathname.startsWith(appPath + 'android-shortcuts/')) return;
  // cache: 'no-store' สำคัญกว่าที่เห็น — network-first เฉย ๆ ยังไม่พอ
  // เพราะ HTTP cache ของเบราว์เซอร์นั่งขวางอยู่หน้า fetch() ของ SW อีกชั้น
  // GitHub Pages ส่ง max-age=600 มาด้วย แปลว่าอัปเดตแล้วผู้ใช้จะยังเห็นของเก่า
  // ไปอีก 10 นาที รีเฟรชกี่ครั้งก็ไม่เปลี่ยน — ซึ่งหาสาเหตุยากมากเวลาเจอ
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true })))
  );
});
