// Student OS — Service Worker
// กลยุทธ์: network-first (ได้เวอร์ชันใหม่เสมอเมื่อมีเน็ต) + cache fallback (เปิด offline ได้)
// ชื่อ cache ผูกกับเลขรุ่น — ปล่อยรุ่นใหม่แล้วของเก่าถูกลบทิ้งตอน activate
// สายนี้เคยเป็นบิลด์ทดลอง (ALT) และถูกยกขึ้นเป็นตัวหลักตั้งแต่ 1A7V2 · ชื่อ cache เลยเปลี่ยนตาม
// -m: เปลี่ยนโลโก้ทั้งชุด — ชื่อไฟล์เดิมทุกไฟล์ ถ้าไม่ขึ้นเลขรุ่น เครื่องที่ติดตั้งไว้แล้ว
// จะเสิร์ฟโลโก้เก่าจากแคชต่อไปโดยไม่มีอะไรบอกว่ามีของใหม่
// แยกชื่อแคช ALT จากเว็บหลัก: ปล่อยเฉพาะ ALT ต้องไม่ล้างแคชของเว็บหลักบน origin เดียวกัน
const CACHE_PREFIX = 'studentos-alt-';
const CACHE = CACHE_PREFIX + '1c60-subjects-20261031'; // Own subjects, tablet form fixes, effects page, costume picker, settings tidy; app version unchanged.
let HALLOWEEN_FILES = [];
try { importScripts('halloween/cache-manifest.js'); HALLOWEEN_FILES = self.HALLOWEEN_SHELL || []; } catch (_) {}
// ทุกไฟล์ที่ index.html อ้างถึงต้องอยู่ในรายการนี้ — ไฟล์ที่หน้าเรียกแต่ไม่ได้แคชไว้
// จะหายไปเงียบ ๆ ตอนออฟไลน์ โดยไม่มีอะไรบอกว่าหายไปไหน (icon-alt-* เลิกใช้ในหน้าแล้วตั้งแต่ QA 6 ต.ค. 69 · คงไว้ให้ index.html เก่าในแคชของเครื่องที่ยังไม่อัปเดต)
//
// **visual-editor.js ถูกถอดออกจากรายการนี้ตั้งแต่ 1B89 โดยตั้งใจ** — index.html ไม่ได้อ้างถึงมันแล้ว
// (Control Center ฉีดเข้า iframe ตอนรันเอง) การแคชไว้จึงเป็นการส่ง ~50KB ไปให้เด็กทุกคน
// เพื่อของที่มีคนเดียวได้ใช้ · และที่แย่กว่านั้นคือมันทำให้ปล่อยรุ่นใหม่แล้วหน้าแอดมิน
// ได้ "หน้าแม่ใหม่ + ตัวแก้ดีไซน์เก่า" ซึ่งอาการคือกดแล้วไม่มีอะไรเกิดขึ้น
// 31 ต.ค. 69 · ห่อด้วย Set — Chrome ปฏิเสธ addAll ทั้งก้อนถ้ามีชื่อซ้ำ (InvalidStateError: duplicate requests) = SW ติดตั้งไม่ขึ้น
// เคยหลุดขึ้นเว็บจริง 25–31 ต.ค.: เรือผี 8 ไฟล์อยู่ทั้งในรายการนี้และใน halloween/cache-manifest.js (คนละทีมดูแล)
// ผลคือเครื่องใหม่ไม่มี SW เลย (ไม่มีแจ้งเตือน ไม่มีออฟไลน์) และเครื่องเก่าค้าง SW รุ่นเก่า · devtools/sw-check.cjs กันไว้แล้ว
const SHELL = [...new Set(['.', 'index.html', 'style.css', 'alt.css', 'inbox.css', 'today.css', 'room.css', 'social.css', 'feed.css', 'safety.css', 'hw.css', 'topic.css', 'sai.css', 'hoop.css', 'fxgames.css', 'gacha-fx.css', 'board.css', 'custom.css',
  'engine.js', 'context.js', 'planner.js', 'facts.js', 'profile.js', 'simulate.js', 'calibrate.js', 'loss.js', 'decide.js', 'brain.js', 'inbox.js', 'linelink.js', 'integrations.js', 'room.js', 'social.js', 'feed.js', 'hw.js', 'topic.js', 'safety.js', 'sai.js', 'fxgames.js', 'fx3d.js', 'hoop.js', 'gacha-fx.js', 'quickadd.js', 'board.js', 'news.js', 'app.js', 'config.js', 'remote-config.js',
  'manifest.json', 'compat.js', 'staff-news.js', 'bug-reports.js', 'bug-reports.css', 'events.js', 'events.css', 'classrooms.js', 'classrooms.css', 'contrast.css', 'glass.css', 'notification-policy.mjs',
  'halloween/death-quests.js', 'halloween/death-quest-main.js', 'halloween/death-quest-main.css',
  'halloween/study-pact.js','halloween/study-pact-main.js','halloween/study-pact-main.css',
  'device-preview.html', 'device-preview.css', 'device-preview.js', 'device-preview-controls.css', 'device-preview-bridge.js', ...HALLOWEEN_FILES,
  // 24 ต.ค. 69 · ชุดแต่งจอโหลด/จอเข้าสู่ระบบช่วงฮาโลวีน (index.html อ้างถึงตรง ๆ จึงอยู่ที่นี่ ไม่อยู่ใน cache-manifest ของรางวัลถาวร)
  'halloween/season/season.css', 'halloween/season/hook-mummy-224.webp',
  // 25 ต.ค. 69 · ฉากเรือผีบนจอ "เสร็จแล้ว" (THE CURSED SHIP)
  'halloween/season/cursed-ship.js', 'halloween/season/cursed-ship.css',
  // ภาพทุกช็อตตัดจากสตอรีบอร์ดของเจ้าของ (~150KB) — ฉากไม่เล่นถ้าภาพไม่ครบ จึงต้องอยู่ในแคชติดเครื่อง
  'halloween/season/cursed-ship/ship.webp', 'halloween/season/cursed-ship/ship-bg.webp', 'halloween/season/cursed-ship/yard.webp', 'halloween/season/cursed-ship/yard-bg.webp', 'halloween/season/cursed-ship/banner.webp', 'halloween/season/cursed-ship/seal.webp',
  'shortcut-draft.js', 'desktop.css', 'desktop-entry.js', 'desktop.js', 'desktop-navigation.mjs',
  // 15 ต.ค. 69 · ข่าวสารจากทีม — แคชไว้ให้เปิดจอข่าวตอนออฟไลน์ได้ (drafts.json ไม่แคช: แอปไม่ได้โหลดมัน)
  'news/announcements.json',
  'icon-alt-192.png', 'icon-alt-512.png', 'icon-192.png', 'badge-96.png', 'icon-512.png', 'icon-maskable-512.png',
  'logo-mark.png', 'logo-splash.png', 'logo-splash-light.png',
  // หน้าน้องไซบนฟองแชท — ต้องอยู่ในแคชด้วย ไม่งั้นเปิดแอปตอนไม่มีเน็ตแล้วมาสคอตหายไปทั้งจอ
  'sai-avatar.png',
  // น้องไซตัวเป็น ๆ — สีหน้าหกแบบ + ชิบิ ตัดจาก character sheet ใบเดียวกัน
  // ใบไหนไม่ได้แคชไว้ = เปิดแอปออฟไลน์แล้วมาสคอตกลายเป็นกรอบเปล่า ซึ่งแย่กว่าไม่มี
  'sai-face-normal.webp', 'sai-face-happy.webp', 'sai-face-wow.webp',
  'sai-face-serious.webp', 'sai-face-sleepy.webp', 'sai-face-sulk.webp',
  'sai-chibi.webp',
  // น้องฮูก (Hook) — มาสคอตค่าเริ่มต้นตั้งแต่ 9 ต.ค. 69 · ภาพเดียวตัดเป็นสามขนาด สีหน้ามาจาก CSS
  // 24 ต.ค. 69 · เจ้าของ: ใช้น้องฮูกใส่หมวกแม่มดแทนตัวเดิมทุกธีม (ภาพต้นฉบับยังอยู่ — devtools/hook-hat.mjs ใช้สร้าง)
  'hook-hat-avatar.svg', 'hook-hat-face.svg', 'hook-hat-body.svg'])];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
  // This registration belongs to ALT only. Leave the main app registration intact.
  if (self.registration.pushManager) e.waitUntil(self.registration.pushManager.getSubscription()
    .then(sub => sub && sub.unsubscribe()).catch(() => {}));
});

// ---------- Web Push: เตือนได้แม้ปิดแอป ----------
// 1C33 · ไม่เติมชื่อแอปหน้าหัวการ์ดแล้ว — แอปที่ติดตั้งไว้ (ซึ่งคือทุกเครื่องที่รับ push ได้บน iPhone)
// มือถือพิมพ์ "Student OS" ให้บนการ์ดอยู่แล้ว เติมเองจึงกลายเป็นชื่อแอปซ้ำสองครั้ง
// และกินที่ของชื่องาน ซึ่งเป็นสิ่งเดียวบนการ์ดที่คนต้องอ่าน
const APP_NAME = 'Student OS';
// ปุ่มบนการ์ด "ถึงเวลาทำ" (tag do-<id>) — ต้องตรงกับ doAtNotifyMore ใน app.js (การ์ดใบเดียวกันที่แอปยิงเองตอนเปิดอยู่)
const DO_ACTIONS = [{ action: 'start', title: 'เริ่มเลย' }];
// 31 ต.ค. 69 · เจ้าของ: "แก้แจ้งเตือนให้เหมือนแจ้งเตือนของแอปอื่นๆแบบปกติ ทำทั้งแอนดรอยและ ios"
// • ไอคอนเล็ก (badge) เดิมใช้ icon-192.png ซึ่งเป็นภาพสีเต็มใบไม่มีส่วนใส — Android วาดไอคอนแถบสถานะจาก "ส่วนใส" อย่างเดียว
//   ภาพทึบทั้งใบจึงกลายเป็นสี่เหลี่ยมขาวโล่ง · ตอนนี้ใช้ badge-96.png = เงาขาวรูปหนังสือซ้อนเป็นตัว S บนพื้นใส แบบแอปทั่วไป
//   (iPhone ไม่ใช้ icon/badge ของการ์ด — ใช้ไอคอนแอปบนหน้าจอโฮมเอง)
// • เลขบนไอคอนแอป (Badging API · iPhone 16.4+ ที่ติดตั้งลงหน้าจอโฮม · Android ที่ติดตั้งได้จุด) = จำนวนการ์ดที่ค้างในถาด
//   ตั้งใหม่ทุกครั้งที่การ์ดเด้ง · ถูกแตะ · ถูกปัดทิ้ง · เปิดแอปแล้วแอปล้างให้เอง (clearAppBadge ใน app.js)
function syncAppBadge() {
  const nav = self.navigator;
  if (!nav || !('setAppBadge' in nav)) return Promise.resolve();
  return self.registration.getNotifications()
    .then(list => list.length ? nav.setAppBadge(list.length) : nav.clearAppBadge())
    .catch(() => {});
}
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || APP_NAME;
  // 31 ต.ค. 69 · นัด "ถึงเวลาทำ" จากเซิร์ฟเวอร์ได้ปุ่มเริ่มเลย + ค้างบนคอม + รู้ว่างานไหน (แตะแล้วเริ่มงาน)
  // อ่านจาก tag ที่ send-reminders ส่งมาอยู่แล้ว — ไม่ต้อง deploy ฟังก์ชันใหม่ก็ได้ของนี้
  const doId = typeof d.tag === 'string' && d.tag.startsWith('do-') ? d.tag.slice(3) : '';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'badge-96.png',
    tag: d.tag || 'studentos-reminder',
    renotify: true,
    requireInteraction: !!doId,
    actions: doId ? DO_ACTIONS : [],
    data: Object.assign({ url: d.url || './' }, doId ? { taskId: doId } : {}),
  }).then(syncAppBadge));
});

self.addEventListener('notificationclose', e => { e.waitUntil(syncAppBadge()); });

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(syncAppBadge());
  const target = (e.notification.data && e.notification.data.url) || './';
  const taskId = e.notification.data && e.notification.data.taskId;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.registration.scope) && !c.url.includes('/staff/') && 'focus' in c) {
          // แจ้งเตือนจากแอปที่มีงานติดมา (เตือนให้ทำตอน · 31 ต.ค. 69) + แอปเปิดอยู่ = บอกแอปให้เริ่มงานนั้นเลย ไม่โหลดหน้าใหม่
          if (taskId && 'postMessage' in c) { c.postMessage({ type: 'start-task', id: taskId }); return c.focus(); }
          const next = new URL(target, self.registration.scope);
          if (next.origin === new URL(self.registration.scope).origin && next.href.startsWith(self.registration.scope)) {
            return c.navigate(next.href).then(() => c.focus());
          }
          return c.focus();
        }
      }
      // แอปปิดอยู่ + การ์ดมีงานติดมา = เปิดแอปด้วย ?do=<งาน> ให้แอปเข้าโหมดโฟกัสเอง (ตัวรับอยู่ใต้ BOOT_Q ใน app.js)
      if (taskId) { const u = new URL(target, self.registration.scope); u.searchParams.set('do', taskId); return self.clients.openWindow(u.href); }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // ปล่อยให้คำขอข้ามโดเมนผ่านตรง ไม่ผ่าน SW เลย — กัน CDN ของ OCR (Tesseract.js,
  // wasm, ไฟล์ภาษา) พังเวลาเน็ตสะดุดแล้วตกไปหา cache ที่ไม่เคยเก็บไฟล์เหล่านี้ไว้
  if (new URL(e.request.url).origin !== location.origin) return;
  // เว็บแอดมินแยก ไม่เก็บไว้ในแคชแอปนักเรียน
  if (new URL(e.request.url).pathname.includes('/staff/')) return;
  // Temporary event pages must disappear when removed; never revive their switch offline.
  if (new URL(e.request.url).pathname.includes('/halloween/event/')) return;
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
      .catch(() => caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true })))
  );
});
