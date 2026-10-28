// Student OS — Service Worker
// กลยุทธ์: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต) + cache fallback (เปิด offline ได้)
// บิลด์ทดลองที่ /alt/ ใช้ชื่อ cache คนละตัว — สลับไปมาสองรุ่นแล้วไฟล์ไม่ปนกัน
//
// ⚠️ ทุกชื่อในลิสต์นี้ต้องมีไฟล์อยู่จริง — addAll จะล้มทั้งก้อนถ้ามีตัวใดตัวหนึ่ง 404
//    แล้วแอปจะไม่มีแคชเลย (เปิดออฟไลน์ไม่ได้) โดยไม่มี error โผล่ให้เห็นที่หน้าจอ
//    เคยพลาดมาแล้วตอนคัดลอกไฟล์จาก alt/ ขึ้นมา: ลิสต์ยังมี icon-alt-* ซึ่ง root ไม่มี
const CACHE = 'studentos-main-1c60-alt-ui-20261028'; // Requested visual parity; main push/config/storage preserved.
const SHELL = [
  "halloween-countdown.js",
  "halloween-countdown.css",
  ".",
  "index.html",
  "style.css",
  "alt.css",
  "inbox.css",
  "today.css",
  "room.css",
  "social.css",
  "feed.css",
  "safety.css",
  "hw.css",
  "topic.css",
  "custom.css",
  "engine.js",
  "context.js",
  "planner.js",
  "facts.js",
  "profile.js",
  "simulate.js",
  "calibrate.js",
  "loss.js",
  "decide.js",
  "brain.js",
  "inbox.js",
  "linelink.js",
  "room.js",
  "social.js",
  "feed.js",
  "hw.js",
  "topic.js",
  "safety.js",
  "app.js",
  "config.js",
  "remote-config.js",
  "integrations.js",
  "sai.css",
  "sai.js",
  "sai-face-normal.webp",
  "sai-face-happy.webp",
  "sai-face-wow.webp",
  "sai-face-serious.webp",
  "sai-face-sleepy.webp",
  "sai-face-sulk.webp",
  "sai-chibi.webp",
  "hoop.css",
  "hoop.js",
  "fxgames.css",
  "gacha-fx.css",
  "fxgames.js",
  "fx3d.js",
  "gacha-fx.js",
  "hook-avatar.png",
  "hook-body.webp",
  "hook-face.webp",
  "quickadd.js",
  "board.css",
  "board.js",
  "news.js",
  "staff-news.js",
  "bug-reports.js",
  "bug-reports.css",
  "manifest.json",
  "shortcut-draft.js",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "logo-mark.png",
  "logo-splash.png",
  "logo-splash-light.png",
  "sai-avatar.png",
  "desktop.css",
  "desktop-entry.js",
  "desktop.js",
  "desktop-navigation.mjs",
  "alt/halloween/rewards/preview-mode.js",
  "alt/halloween/rewards/catalog.js",
  "splash-1320x2868.png",
  "splash-1290x2796.png",
  "splash-1284x2778.png",
  "splash-1206x2622.png",
  "splash-1179x2556.png",
  "splash-1170x2532.png",
  "splash-1125x2436.png",
  "splash-1242x2688.png",
  "splash-828x1792.png",
  "splash-1242x2208.png",
  "splash-750x1334.png",
  "events.css",
  "classrooms.css",
  "alt/halloween/invite-friend/invite-friend.css",
  "device-preview-controls.css",
  "alt/halloween/rewards/theme-main.css",
  "alt/halloween/rewards/biome-themes.css",
  "alt/halloween/rewards/effect-games.css",
  "alt/halloween/rewards/effect-ceremony.css",
  "alt/halloween/rewards/effect-stage.css",
  "alt/halloween/rewards/badges.css",
  "alt/halloween/rewards/featured-badge.css",
  "alt/halloween/rewards/theme-moonlight.css",
  "alt/halloween/season/season.css",
  "alt/halloween/season/cursed-ship.css",
  "contrast.css",
  "glass.css",
  "alt/halloween/rewards/identity.css",
  "alt/halloween/invite-friend/thai-layout.css",
  "alt/halloween/season/biome-finishes.css",
  "alt/halloween/season/cinematic-variants.css",
  "alt/economy/client.css",
  "hook-hat-avatar.svg",
  "alt/halloween/season/hook-mummy-224.webp",
  "compat.js",
  "classrooms.js",
  "alt/halloween/death-quests.js",
  "alt/halloween/study-pact.js",
  "events.js",
  "alt/halloween/invite-friend/invite-friend.js",
  "alt/halloween/invite-friend/thai-ranat.js",
  "alt/halloween/invite-friend/thai-theme.js",
  "alt/halloween/rewards/account-store.js",
  "alt/economy/focus-checkpoints.js",
  "alt/halloween/rewards/entitlements.js",
  "alt/halloween/death-quest-main.js",
  "alt/halloween/death-quest-main.css",
  "alt/halloween/study-pact-main.js",
  "alt/halloween/study-pact-main.css",
  "alt/halloween/rewards/theme-main.js",
  "alt/halloween/rewards/effect-stage.js",
  "alt/halloween/rewards/effect-games.js",
  "alt/halloween/rewards/runtime.js",
  "alt/halloween/rewards/integration.js",
  "alt/halloween/rewards/badges.js",
  "alt/halloween/rewards/featured-badge.js",
  "alt/halloween/rewards/theme-rarity.js",
  "alt/halloween/season/biome-finishes.js",
  "alt/halloween/season/cursed-ship.js",
  "alt/economy/client.js",
  "alt/halloween/cache-manifest.js",
  "alt/halloween/rewards/ownership.js",
  "alt/halloween/rewards/acquisition.js",
  "alt/halloween/rewards/acquisition.css",
  "alt/halloween/rewards/vault.html",
  "alt/halloween/rewards/vault.js",
  "alt/halloween/rewards/vault.css",
  "alt/halloween/rewards/theme-assets/night-academy.svg",
  "alt/halloween/rewards/theme-assets/graveyard.svg",
  "alt/halloween/rewards/theme-assets/sai-witch.webp",
  "alt/halloween/rewards/theme-assets/hook-mummy.webp",
  "alt/halloween/rewards/theme-assets/app-icon.webp",
  "alt/halloween/rewards/profile-assets/hello.svg",
  "alt/halloween/rewards/profile-assets/try.svg",
  "alt/halloween/rewards/profile-assets/hard.svg",
  "alt/halloween/rewards/profile-assets/nah.svg",
  "alt/halloween/rewards/profile-assets/unstoppable.svg",
  "alt/halloween/rewards/profile-assets/deep.svg",
  "alt/halloween/rewards/profile-assets/tree.svg",
  "alt/halloween/rewards/profile-assets/sophyra.svg",
  "alt/halloween/rewards/profile-assets/genesis.svg",
  "alt/halloween/rewards/profile-assets/metaworld.svg",
  "alt/halloween/rewards/profile-assets/err404.svg",
  "alt/halloween/rewards/assets/ghostship-sea.svg",
  "alt/halloween/rewards/assets/ghostship-vessel.svg",
  "alt/halloween/rewards/assets/vampire-distance.svg",
  "alt/halloween/rewards/assets/harbor-lantern.svg",
  "alt/halloween/rewards/assets/laughing-pumpkin.svg",
  "alt/halloween/rewards/assets/crimson-candle.svg",
  "alt/halloween/rewards/assets/quiet-gravestone.svg",
  "alt/halloween/rewards/assets/bottled-dutchman.svg",
  "alt/halloween/rewards/assets/jacks-portrait.svg",
  "alt/halloween/rewards/assets/velvet-bat.svg",
  "alt/halloween/rewards/assets/little-wisp.svg",
  "alt/halloween/rewards/assets/theme-ghostship.svg",
  "alt/halloween/rewards/assets/theme-jackhollow.svg",
  "alt/halloween/rewards/assets/theme-vampire.svg",
  "alt/halloween/rewards/assets/theme-graveyard.svg",
  "alt/halloween/rewards/assets/fx-soulwake.svg",
  "alt/halloween/rewards/assets/fx-pumpkin-sparks.svg",
  "alt/halloween/rewards/assets/fx-velvet-flight.svg",
  "alt/halloween/rewards/assets/fx-soul-bloom.svg",
  "alt/halloween/rewards/assets/fx-dutchman-arrival.svg",
  "alt/halloween/rewards/assets/fx-jacks-verdict.svg",
  "alt/halloween/rewards/assets/fx-crimson-eclipse.svg",
  "alt/halloween/rewards/assets/fx-reaper-gate.svg",
  "alt/halloween/rewards/assets/theme-midnight-academy.svg",
  "alt/halloween/rewards/assets/greater-spear.svg",
  "alt/halloween/rewards/assets/jacks-axe.svg",
  "alt/halloween/rewards/assets/cruor-quill.svg",
  "alt/halloween/rewards/assets/dullahan-scythe.svg",
  "alt/halloween/rewards/assets/crown-of-midnight.svg",
  "alt/halloween/rewards/assets/theme-moon-candle.svg",
  "alt/halloween/rewards/assets/midnight-conqueror.svg",
  "alt/halloween/invite-friend/qrcode-generator.js",
  "alt/halloween/invite-friend/thai-estate.svg",
  "alt/halloween/invite-friend/jade-moon.webp",
  "alt/halloween/rewards/cinematic-preview.html",
  "alt/halloween/season/cursed-ship/banner.webp",
  "alt/halloween/season/cursed-ship/seal.webp",
  "alt/halloween/season/cursed-ship/ship-bg.webp",
  "alt/halloween/season/cursed-ship/ship.webp",
  "alt/halloween/season/cursed-ship/yard-bg.webp",
  "alt/halloween/season/cursed-ship/yard.webp",
  "alt/halloween/season/biome-cinematics/graveyard-night.webp",
  "alt/halloween/season/biome-cinematics/jack-night.webp",
  "alt/halloween/season/biome-cinematics/undertow-specter.webp",
  "alt/halloween/season/biome-cinematics/vampire-night.webp",
  "hook-hat-face.svg",
  "hook-hat-body.svg"
];

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
        const next = new URL(target, self.registration.scope);
        const scope = new URL(self.registration.scope);
        if (c.url.startsWith(scope.href) && !c.url.startsWith(scope.href+'alt/') && 'focus' in c) {
          if (next.origin === scope.origin && next.href.startsWith(scope.href)) return c.navigate(next.href).then(() => c.focus());
          return c.focus();
        }
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
  const shared = requestUrl.pathname.startsWith(appPath + 'alt/') && SHELL.includes(requestUrl.pathname.slice(appPath.length));
  if ((requestUrl.pathname.startsWith(appPath + 'alt/') && !shared) || requestUrl.pathname.startsWith(appPath + 'android-shortcuts/')) return;
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
