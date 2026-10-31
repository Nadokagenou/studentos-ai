// Student OS — Service Worker
// กลยุทธ์: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต) + cache fallback (เปิด offline ได้)
// บิลด์ทดลองที่ /alt/ ใช้ชื่อ cache คนละตัว — สลับไปมาสองรุ่นแล้วไฟล์ไม่ปนกัน
//
// ⚠️ ทุกชื่อในลิสต์นี้ต้องมีไฟล์อยู่จริง — addAll จะล้มทั้งก้อนถ้ามีตัวใดตัวหนึ่ง 404
//    แล้วแอปจะไม่มีแคชเลย (เปิดออฟไลน์ไม่ได้) โดยไม่มี error โผล่ให้เห็นที่หน้าจอ
//    เคยพลาดมาแล้วตอนคัดลอกไฟล์จาก alt/ ขึ้นมา: ลิสต์ยังมี icon-alt-* ซึ่ง root ไม่มี
const CACHE = 'studentos-main-1c60-subjects-20261031';
// These filenames carry an immutable art version, so reuse them across app updates.
const EVENT_ART_CACHE = 'studentos-event-art-v1', eventArtLoads = new Map();
async function eventArt(request, key) {
  let cache;
  try { cache = await caches.open(EVENT_ART_CACHE); const saved = await cache.match(key); if (saved) return saved; } catch {}
  let pending = eventArtLoads.get(key);
  if (!pending) {
    pending = fetch(request, { cache: 'force-cache' }).then(async response => {
      if (response.ok && cache) { try { await cache.put(key, response.clone()); } catch {} }
      return response;
    });
    eventArtLoads.set(key, pending);
  }
  try { return (await pending).clone(); }
  finally { if (eventArtLoads.get(key) === pending) eventArtLoads.delete(key); }
}
// Large event artwork is cached on first use, not during the main app update.
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
  "halloween/rewards/preview-mode.js",
  "halloween/rewards/catalog.js",
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
  "halloween/invite-friend/invite-friend.css",
  "device-preview-controls.css",
  "halloween/rewards/theme-main.css",
  "halloween/rewards/biome-themes.css",
  "halloween/rewards/effect-games.css",
  "halloween/rewards/effect-ceremony.css",
  "halloween/rewards/effect-stage.css",
  "halloween/rewards/badges.css",
  "halloween/rewards/featured-badge.css",
  "halloween/rewards/theme-moonlight.css",
  "halloween/season/season.css",
  "halloween/season/cursed-ship.css",
  "contrast.css",
  "glass.css",
  "halloween/rewards/identity.css",
  "halloween/invite-friend/thai-layout.css",
  "halloween/season/biome-finishes.css",
  "halloween/season/cinematic-variants.css",
  "economy/client.css",
  "hook-hat-avatar.svg",
  "halloween/season/hook-mummy-224.webp",
  "compat.js",
  "classrooms.js",
  "halloween/death-quests.js",
  "halloween/study-pact.js",
  "events.js",
  "halloween/invite-friend/invite-friend.js",
  "halloween/invite-friend/thai-ranat.js",
  "halloween/invite-friend/thai-theme.js",
  "halloween/rewards/account-store.js",
  "economy/focus-checkpoints.js",
  "halloween/rewards/entitlements.js",
  "halloween/death-quest-main.js",
  "halloween/death-quest-main.css",
  "halloween/study-pact-main.js",
  "halloween/study-pact-main.css",
  "halloween/rewards/theme-main.js",
  "halloween/rewards/effect-stage.js",
  "halloween/rewards/effect-games.js",
  "halloween/rewards/runtime.js",
  "halloween/rewards/integration.js",
  "halloween/rewards/badges.js",
  "halloween/rewards/featured-badge.js",
  "halloween/rewards/theme-rarity.js",
  "halloween/season/biome-finishes.js",
  "halloween/season/cursed-ship.js",
  "economy/client.js",
  "halloween/cache-manifest.js",
  "halloween/rewards/ownership.js",
  "halloween/rewards/acquisition.js",
  "halloween/rewards/acquisition.css",
  "halloween/rewards/vault.html",
  "halloween/rewards/vault.js",
  "halloween/rewards/vault.css",
  "halloween/rewards/theme-assets/night-academy.svg",
  "halloween/rewards/theme-assets/graveyard.svg",
  "halloween/rewards/theme-assets/sai-witch.webp",
  "halloween/rewards/theme-assets/hook-mummy.webp",
  "halloween/rewards/theme-assets/app-icon.webp",
  "halloween/rewards/profile-assets/hello.svg",
  "halloween/rewards/profile-assets/try.svg",
  "halloween/rewards/profile-assets/hard.svg",
  "halloween/rewards/profile-assets/nah.svg",
  "halloween/rewards/profile-assets/unstoppable.svg",
  "halloween/rewards/profile-assets/deep.svg",
  "halloween/rewards/profile-assets/tree.svg",
  "halloween/rewards/profile-assets/sophyra.svg",
  "halloween/rewards/profile-assets/genesis.svg",
  "halloween/rewards/profile-assets/metaworld.svg",
  "halloween/rewards/profile-assets/err404.svg",
  "halloween/rewards/assets/ghostship-sea.svg",
  "halloween/rewards/assets/ghostship-vessel.svg",
  "halloween/rewards/assets/vampire-distance.svg",
  "halloween/rewards/assets/harbor-lantern.svg",
  "halloween/rewards/assets/laughing-pumpkin.svg",
  "halloween/rewards/assets/crimson-candle.svg",
  "halloween/rewards/assets/quiet-gravestone.svg",
  "halloween/rewards/assets/bottled-dutchman.svg",
  "halloween/rewards/assets/jacks-portrait.svg",
  "halloween/rewards/assets/velvet-bat.svg",
  "halloween/rewards/assets/little-wisp.svg",
  "halloween/rewards/assets/theme-ghostship.svg",
  "halloween/rewards/assets/theme-jackhollow.svg",
  "halloween/rewards/assets/theme-vampire.svg",
  "halloween/rewards/assets/theme-graveyard.svg",
  "halloween/rewards/assets/fx-soulwake.svg",
  "halloween/rewards/assets/fx-pumpkin-sparks.svg",
  "halloween/rewards/assets/fx-velvet-flight.svg",
  "halloween/rewards/assets/fx-soul-bloom.svg",
  "halloween/rewards/assets/fx-dutchman-arrival.svg",
  "halloween/rewards/assets/fx-jacks-verdict.svg",
  "halloween/rewards/assets/fx-crimson-eclipse.svg",
  "halloween/rewards/assets/fx-reaper-gate.svg",
  "halloween/rewards/assets/theme-midnight-academy.svg",
  "halloween/rewards/assets/greater-spear.svg",
  "halloween/rewards/assets/jacks-axe.svg",
  "halloween/rewards/assets/cruor-quill.svg",
  "halloween/rewards/assets/dullahan-scythe.svg",
  "halloween/rewards/assets/crown-of-midnight.svg",
  "halloween/rewards/assets/theme-moon-candle.svg",
  "halloween/rewards/assets/midnight-conqueror.svg",
  "halloween/invite-friend/qrcode-generator.js",
  "halloween/invite-friend/thai-estate.svg",
  "halloween/invite-friend/jade-moon.webp",
  "halloween/season/cursed-ship/banner.webp",
  "halloween/season/cursed-ship/seal.webp",
  "halloween/season/cursed-ship/ship-bg.webp",
  "halloween/season/cursed-ship/ship.webp",
  "halloween/season/cursed-ship/yard-bg.webp",
  "halloween/season/cursed-ship/yard.webp",
  "halloween/season/biome-cinematics/graveyard-night.webp",
  "halloween/season/biome-cinematics/jack-night.webp",
  "halloween/season/biome-cinematics/undertow-specter.webp",
  "halloween/season/biome-cinematics/vampire-night.webp",
  "hook-hat-face.svg",
  "hook-hat-body.svg",
  "mobile-stability.css",
  "news/announcements.json",
  "halloween/event/adventure.css",
  "halloween/event/balance.js",
  "halloween/event/battle-ui.js",
  "halloween/event/battle.css",
  "halloween/event/brain-games.js",
  "halloween/event/brain-ui.js",
  "halloween/event/collection.css",
  "halloween/event/collection.js",
  "halloween/event/combat.js",
  "halloween/event/config.json",
  "halloween/event/core.js",
  "halloween/event/counter.css",
  "halloween/event/dungeon-ui.css",
  "halloween/event/experience.css",
  "halloween/event/experience.js",
  "halloween/event/feedback.css",
  "halloween/event/feedback.js",
  "halloween/event/games.js",
  "halloween/event/game-playback.js",
  "halloween/event/guide-ui.css",
  "halloween/event/guide.js",
  "halloween/event/hud.js",
  "halloween/event/index.html",
  "halloween/event/journal.css",
  "halloween/event/journal.js",
  "halloween/event/journey.css",
  "halloween/event/market.js",
  "halloween/event/missions.js",
  "halloween/event/npcs.js",
  "halloween/event/objective.js",
  "halloween/event/rewards.html",
  "halloween/event/rotations.js",
  "halloween/event/season.js",
  "halloween/event/sound.js",
  "halloween/event/study-pact.css",
  "halloween/event/theme-preview.html",
  "halloween/event/world.css",
  "halloween/event/world.js",
  "halloween/event/data/materials.json",
  "halloween/event/data/preview-rules.json",
  "halloween/event/data/quests.dutchman.json",
  "halloween/event/data/quests.graveyard.json",
  "halloween/event/data/quests.jack.json",
  "halloween/event/data/quests.vampire.json"
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
  if (requestUrl.pathname.startsWith(appPath + 'alt/') || requestUrl.pathname.startsWith(appPath + 'android-shortcuts/')) return;
  if (requestUrl.pathname.startsWith(appPath + 'halloween/event/assets/') && /\/[a-z0-9-]+-fast-v\d+\.webp$/.test(requestUrl.pathname)) {
    e.respondWith(eventArt(e.request, requestUrl.origin + requestUrl.pathname));
    return;
  }
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
