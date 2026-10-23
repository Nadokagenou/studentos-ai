// ============================================================
// ชวนเพื่อน · ภารกิจปลดล็อกธีม Halloween (23 ต.ค. 69)
// ------------------------------------------------------------
// ภารกิจสองข้อ ครบทั้งคู่ = ได้ธีม INVITE_THEME
//   1. ชวนเพื่อนมาใช้ให้ครบ 3 คน — นับที่เซิร์ฟเวอร์ (redeem_invite · migration 20261023150000)
//      เพราะเป็นเรื่องระหว่างสองบัญชี นับในเครื่องเมื่อไหร่ใครก็แก้ localStorage ให้ครบได้
//   2. ทำงานในแอปเสร็จอย่างน้อย 1 งาน — นับในเครื่อง (งานเป็นของเจ้าตัวคนเดียวอยู่แล้ว)
//      จดลง funnel.hwTaskAt ครั้งเดียว ซิงก์ข้ามเครื่องไปกับ funnel · ลบงานทิ้งทีหลังภารกิจไม่ถอยกลับ
//
// ทางชวน: รหัสสามคำ (BAT-MOON-CANDY) พิมพ์/อ่านออกเสียงบอกกันได้ · ลิงก์ ?invite=รหัส · QR ของลิงก์นั้น
// ลิงก์ถูกเก็บรหัสไว้ตั้งแต่สคริปต์นี้โหลด (ก่อน app.js ล้าง URL) แล้วใช้หลังล็อกอินเสร็จ
// เหมือน ?join= ของห้อง LINE — คนที่สแกน QR มาส่วนใหญ่ยังไม่มีบัญชี
//
// ⚠️ ธีม INVITE_THEME ยังไม่มีใน THEME_NAME (เพื่อนในทีมกำลังทำหน้าตาอยู่) · ตอนเพิ่มธีม
// ให้ใช้ id นี้ แล้วล็อก/ปลดล็อกใน app.js (themeLocked · themeOwned · setTheme) ทำงานเองทันที
// อย่าลืม "เพิ่มธีมใหม่ต้องแก้ 3 ที่" ใน AGENTS.md — สคริปต์ใน <head> ต้องไม่วาดธีมนี้ถ้ายังไม่ปลดล็อก
// ============================================================

const INVITE_THEME = 'hw-invite';
const INVITE_GOAL = 3;
const INVITE_SINCE = '2026-10-23';                          // งานที่เสร็จตั้งแต่วันเปิดภารกิจถึงนับ
const INVITE_KEY = 'studentos.alt.inviteCode';              // รหัสจากลิงก์ รอใช้หลังล็อกอิน
const INVITE_CACHE_KEY = 'studentos.alt.inviteCache';       // ผลล่าสุดจากเซิร์ฟเวอร์ ไว้วาดตอนออฟไลน์
const INVITE_SEEN_KEY = 'studentos.alt.inviteUnlockSeen';   // ฉลองปลดล็อกไปแล้ว (ครั้งเดียวต่อบัญชี)
const INVITE_NEW_DAYS = 7;                                   // ต้องตรงกับ redeem_invite ฝั่ง SQL
// "ชวนเพื่อน" = ชวนคนที่ไม่เคยใช้ StudentOS (เจ้าของสั่ง 23 ต.ค. 69) · ฝั่ง SQL ตัดสินจริง ฝั่งนี้แค่ซ่อนช่องให้ตรงกัน
const INVITE_FIRST_GRACE = 864e5;                            // เปิดแอปก่อนสมัครได้ไม่เกิน 1 วัน (ต้องตรงกับ SQL)

// ---------- เก็บรหัสจากลิงก์ทันทีที่โหลด ----------
(function stashInviteCode() {
  try {
    const c = new URLSearchParams(location.search).get('invite');
    if (c && c.replace(/[^A-Za-z]/g, '').length >= 6) localStorage.setItem(INVITE_KEY, c.trim().toUpperCase().slice(0, 40));
  } catch (_) { /* ที่เก็บถูกปิด — ยังพิมพ์รหัสเองในแผ่นชวนเพื่อนได้ */ }
})();

let ivData = null;        // { code, max_uses, used, friends, invited_by } · null = ยังไม่รู้
let ivLoading = null;     // promise ที่กำลังโหลดอยู่ (กันยิงซ้อน)
let ivQrLib = null;       // promise โหลด vendor/qrcode-generator.js ครั้งเดียว
let ivFailed = false;     // โหลดรอบล่าสุดล้ม (ออฟไลน์ · ยังไม่ได้รัน migration) — แผ่นต้องไม่หมุนรอตลอดไป

function ivUid() { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null; }
function ivReady() { return typeof sb !== 'undefined' && !!sb && !!ivUid(); }

function ivReadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(INVITE_CACHE_KEY) || 'null');
    return c && c.uid === ivUid() ? c.data : null;
  } catch (_) { return null; }
}
function ivWriteCache(data) {
  try { localStorage.setItem(INVITE_CACHE_KEY, JSON.stringify({ uid: ivUid(), data })); } catch (_) {}
}

// ---------- ภารกิจ ----------
function inviteCount() {
  const d = ivData || ivReadCache();
  return d ? Math.max(0, Number(d.used) || 0) : 0;
}
function inviteTaskMet() {
  if (typeof state === 'undefined' || !state) return false;
  const f = state.funnel || {};
  if (f.hwTaskAt) return true;
  const t = (state.tasks || []).find(x => x && x.done && typeof x.doneAt === 'string' && x.doneAt >= INVITE_SINCE);
  if (t && typeof funnelMark === 'function') funnelMark('hwTaskAt', t.doneAt);
  return !!t;
}
function inviteUnlocked() { return inviteCount() >= INVITE_GOAL && inviteTaskMet(); }
function inviteThemeReady() { return typeof THEME_NAME !== 'undefined' && !!THEME_NAME[INVITE_THEME]; }

// เรียกจาก setTheme — กดปุ่มธีมนี้ตอนยังไม่ปลดล็อก = เปิดแผ่นภารกิจแทน (ไม่ใช่ toast "ยังไม่มีธีมนี้")
function inviteThemeGate(id) {
  if (id !== INVITE_THEME || inviteUnlocked()) return false;
  if (typeof haptic === 'function') haptic('snooze');
  openInvite();
  return true;
}

// ---------- โหลดจากเซิร์ฟเวอร์ ----------
async function inviteRefresh() {
  if (!ivReady()) return null;
  if (ivLoading) return ivLoading;
  const uid = ivUid();
  ivLoading = (async () => {
    try {
      const { data, error } = await sb.rpc('my_invite');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      // สลับบัญชีระหว่างรอ — ผลนี้เป็นของคนเดิม ทิ้งไป
      if (row && row.code && ivUid() === uid) { ivData = row; ivOwner = uid; ivWriteCache(row); }
      ivFailed = false;
    } catch (e) {
      ivFailed = true;
      console.warn('[invite] โหลดรหัสเชิญไม่สำเร็จ:', (e && e.message) || e);
      if (!ivData) ivData = ivReadCache();
    }
    ivLoading = null;
    paintInvite();
    inviteCheckUnlock();
    return ivData;
  })();
  return ivLoading;
}

// ---------- ใช้รหัสของเพื่อน ----------
const INVITE_MSG = {
  ok:        ['ใช้รหัสเชิญแล้ว', 'คุณกับเพื่อนที่ชวนมาเป็นเพื่อนกันในแอปแล้ว'],
  not_found: ['ไม่พบรหัสนี้', 'เช็กตัวสะกดอีกครั้ง รหัสเป็นคำอังกฤษ 3 คำ เช่น BAT-MOON-CANDY'],
  self:      ['นี่คือรหัสของคุณเอง', 'ส่งรหัสนี้ให้เพื่อนใช้นะ'],
  already:   ['บัญชีนี้ใช้รหัสเชิญไปแล้ว', 'รหัสเชิญใช้ได้บัญชีละครั้ง'],
  full:      ['รหัสนี้มีคนใช้ครบแล้ว', 'ขอรหัสจากเพื่อนคนอื่นแทนได้'],
  not_new:   ['รหัสเชิญใช้ได้กับคนที่ไม่เคยใช้ StudentOS เท่านั้น', 'บัญชีนี้เคยใช้แอปมาก่อนแล้ว จึงนับเป็นเพื่อนที่ถูกชวนมาไม่ได้'],
  blocked:   ['ใช้รหัสนี้ไม่ได้', ''],
};

// เรียกได้หลายครั้ง ปลอดภัยเสมอ · ไม่มีรหัสหรือยังไม่ล็อกอินก็แค่ออก
// manual = รหัสที่พิมพ์เองในแผ่น (ไม่แตะรหัสที่ค้างจากลิงก์)
async function applyInviteCode(manual) {
  let c = manual || null;
  if (!c) { try { c = localStorage.getItem(INVITE_KEY); } catch (_) { return null; } }
  if (!c || !ivReady()) return null;
  let r = null;
  try {
    const { data, error } = await sb.rpc('redeem_invite', { p_code: c });
    if (error) throw error;
    r = data;
  } catch (e) {
    // ไม่ลบรหัสที่ค้างจากลิงก์ — เน็ตหลุดกลางทางต้องได้ลองใหม่รอบหน้า
    console.warn('[invite] ใช้รหัสไม่สำเร็จ:', (e && e.message) || e);
    if (manual) showToast({ title: 'ใช้รหัสไม่สำเร็จ', body: 'เช็กอินเทอร์เน็ตแล้วลองใหม่' });
    return null;
  }
  if (!manual) { try { localStorage.removeItem(INVITE_KEY); } catch (_) {} }
  const [title, body] = INVITE_MSG[r] || INVITE_MSG.not_found;
  showToast({ title, body });
  if (r === 'ok') {
    if (typeof haptic === 'function') haptic('done');
    if (typeof splashBurst === 'function') splashBurst(16, 'egg-star');
    if (typeof loadFriends === 'function') loadFriends();
    inviteRefresh();
  } else if (typeof haptic === 'function') haptic('snooze');
  return r;
}

// ---------- ฉลองตอนปลดล็อก (ครั้งเดียว) ----------
function inviteCheckUnlock() {
  if (!inviteUnlocked()) return;
  const uid = ivUid() || 'local';
  let seen = null;
  try { seen = localStorage.getItem(INVITE_SEEN_KEY); } catch (_) {}
  if (seen === uid) return;
  try { localStorage.setItem(INVITE_SEEN_KEY, uid); } catch (_) {}
  if (typeof applyThemeLocks === 'function') applyThemeLocks();
  paintInvite();
  if (typeof haptic === 'function') haptic('done');
  if (typeof splashBurst === 'function') splashBurst(24, 'egg-star');
  showToast({ title: 'ปลดล็อกธีม Halloween แล้ว 🎃',
    body: inviteThemeReady() ? 'เลือกใช้ได้ที่จอธีม' : 'ธีมกำลังจะมาในอัปเดตถัดไป สิทธิ์ของคุณเก็บไว้แล้ว' });
}

// เรียกจาก toggleDone ตอนงานเพิ่งถูกติ๊กเสร็จ — รอให้ toast "ต่อไป: …" ของจอฉลองพูดจบก่อน
function inviteOnTaskDone() {
  const first = typeof funnelMark === 'function' && funnelMark('hwTaskAt');
  if (first) setTimeout(inviteCheckUnlock, 2800);
}

// ---------- QR ----------
function ivLoadQr() {
  if (typeof qrcode === 'function') return Promise.resolve(true);
  if (ivQrLib) return ivQrLib;
  ivQrLib = new Promise(res => {
    const s = document.createElement('script');
    s.src = 'vendor/qrcode-generator.js';
    s.onload = () => res(typeof qrcode === 'function');
    s.onerror = () => { ivQrLib = null; res(false); };
    document.head.appendChild(s);
  });
  return ivQrLib;
}

function inviteLink(code) {
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  return base + '?invite=' + encodeURIComponent(code);
}

// วาด QR เป็น SVG เอง (จุดกลม · มุมสามมุมเป็นตาโคม) แทน <img> ของไลบรารี
// ระดับแก้ผิด H (30%) เพื่อให้มีฟักทองกลางรูปได้โดยยังสแกนติด · ฟักทองกิน ~5% ของพื้นที่
function inviteQrSvg(text) {
  if (typeof qrcode !== 'function') return '';
  const qr = qrcode(0, 'H');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const eye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const mid = n / 2, hole = n * 0.13;
  let dots = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c) || eye(r, c)) continue;
      if (Math.abs(r + 0.5 - mid) < hole && Math.abs(c + 0.5 - mid) < hole) continue;
      // รัศมี .48 — จุดที่เล็กกว่านี้ (.42–.46) ตัวถอด jsQR อ่านไม่ออกเลยในการทดสอบ ห้ามลด
      dots += `M${c + 0.5} ${r + 0.02}a.48 .48 0 1 0 .001 0z`;
    }
  }
  const eyeAt = (x, y) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.8" class="iv-qr-ring"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="1" class="iv-qr-pupil"/>`;
  const p = mid, s = hole * 0.92;
  const pumpkin = `<g class="iv-qr-pumpkin" transform="translate(${p} ${p}) scale(${s / 10})">
      <path d="M-1 -8.5c.4-1.6 1.6-2.4 2.8-2.6l.4 1.3c-.9.3-1.5.8-1.7 1.6z" class="stem"/>
      <ellipse cx="-4" cy="0" rx="5.2" ry="7.6"/><ellipse cx="4" cy="0" rx="5.2" ry="7.6"/>
      <ellipse cx="0" cy="0" rx="5.4" ry="8"/>
      <path d="M-4.6 -1.8l1.8-2.6 1.6 2.6zM1.2 -1.8l1.8-2.6 1.6 2.6zM-5 2.2c2.6 3 7.4 3 10 0l-1.6.4-.9 1.5-1.4-1.2-1.4 1.2-1.4-1.2-1.4 1.2-.9-1.5z" class="face"/>
    </g>`;
  return `<svg class="iv-qr-svg" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="QR โค้ดลิงก์ชวนเพื่อน">
      <rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" rx="4" class="iv-qr-bg"/>
      <path d="${dots}" class="iv-qr-dot"/>
      ${eyeAt(0, 0)}${eyeAt(n - 7, 0)}${eyeAt(0, n - 7)}
      <circle cx="${p}" cy="${p}" r="${hole}" class="iv-qr-bg"/>
      ${pumpkin}
    </svg>`;
}

// ---------- แผ่นชวนเพื่อน ----------
function inviteSheetEl() {
  let sh = document.getElementById('inviteSheet');
  if (!sh) {
    sh = document.createElement('div');
    sh.id = 'inviteSheet';
    sh.className = 'iv-sheet';
    sh.hidden = true;
    (document.querySelector('.phone') || document.body).appendChild(sh);
  }
  return sh;
}

function openInvite() {
  const sh = inviteSheetEl();
  if (!ivData) ivData = ivReadCache();
  sh.hidden = false;
  paintInvite(true);
  document.addEventListener('keydown', ivEsc);
  if (ivReady()) inviteRefresh();
  ivLoadQr().then(() => paintInvite());
}
function closeInvite() {
  const sh = document.getElementById('inviteSheet');
  if (sh) { sh.hidden = true; sh.innerHTML = ''; }
  document.removeEventListener('keydown', ivEsc);
}
function ivEsc(e) { if (e.key === 'Escape') closeInvite(); }

// ค้างค้างคาวกับหยากไย่ไว้เป็น SVG ในไฟล์ — ไม่ต้องโหลดรูปเพิ่ม และสีตามโทเคนของแผ่น
const IV_BAT = '<svg viewBox="0 0 64 28" aria-hidden="true"><path d="M32 9c1.4-3 2.4-4 3-6 .6 2 1 3 1.2 4.6 4-3.6 12-6 20-4.6-3 1.4-5 3.6-5.6 6.6 3-.4 6.6.4 9.4 2.4-4.6.4-8.6 2.6-10.4 6-2.4-2-6.4-2.4-9 0-1.6-2.4-4.6-3.6-8.6-3.4-4 -.2-7 1-8.6 3.4-2.6-2.4-6.6-2-9 0-1.8-3.4-5.8-5.6-10.4-6 2.8-2 6.4-2.8 9.4-2.4-.6-3-2.6-5.2-5.6-6.6 8-1.4 16 1 20 4.6.2-1.6.6-2.6 1.2-4.6.6 2 1.6 3 3 6z"/></svg>';
const IV_WEB = '<svg viewBox="0 0 80 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".9"><path d="M0 0L80 80M0 0L40 80M0 0L80 40M0 0L80 12M0 0L12 80"/><path d="M14 0Q12 7 0 14M30 0Q27 15 0 30M48 0Q44 24 0 48M66 0Q60 34 0 66" /></g></svg>';

function ivSlots(n) {
  let s = '';
  for (let i = 0; i < INVITE_GOAL; i++) {
    s += `<span class="iv-slot${i < n ? ' on' : ''}" aria-hidden="true">${i < n ? '🎃' : ''}</span>`;
  }
  return s;
}

function paintInvite(first) {
  const sh = document.getElementById('inviteSheet');
  if (sh && !sh.hidden) ivPaintSheet(sh, first);
  paintInviteEntry();
}

function ivPaintSheet(sh, first) {
  const logged = ivReady();
  const d = ivData;
  const used = inviteCount();
  const taskOk = inviteTaskMet();
  const unlocked = inviteUnlocked();
  const left = d ? Math.max(0, (Number(d.max_uses) || 0) - used) : null;
  const code = d && d.code ? d.code : '';
  const born = logged && currentUser.created_at ? Date.parse(currentUser.created_at) : 0;
  const firstOpen = Date.parse(((typeof state !== 'undefined' && state && state.funnel) || {}).firstOpen || '');
  const usedBefore = born && firstOpen && firstOpen < born - INVITE_FIRST_GRACE;
  const canRedeem = logged && d && !d.invited_by && born && !usedBefore && Date.now() - born < INVITE_NEW_DAYS * 864e5;
  // ช่องที่กำลังพิมพ์ต้องไม่หายตอนวาดใหม่ (โหลดเสร็จ · QR มา)
  const typing = document.getElementById('ivRedeemIn');
  const typed = typing ? typing.value : '';
  const opened = !!(document.getElementById('ivRedeem') || {}).open;

  const ticket = !logged ? `
      <div class="iv-ticket iv-ticket-off">
        <p>เข้าบัญชีก่อน แล้วจะได้รหัสเชิญกับ QR ของคุณเอง</p>
        <button class="iv-btn iv-pri" type="button" onclick="ivLogin()">เข้าสู่ระบบ</button>
      </div>`
    : !code && ivFailed ? `
      <div class="iv-ticket iv-ticket-off">
        <p>ยังสร้างรหัสเชิญไม่ได้ เช็กอินเทอร์เน็ตแล้วลองใหม่</p>
        <button class="iv-btn" type="button" onclick="inviteRefresh()">ลองใหม่</button>
      </div>`
    : !code ? `
      <div class="iv-ticket iv-ticket-off" aria-busy="true">
        <div class="iv-qr iv-qr-wait"><span class="iv-candle" aria-hidden="true"></span></div>
        <p>กำลังเสกรหัสเชิญ…</p>
      </div>`
    : `
      <div class="iv-ticket">
        <div class="iv-qr">${inviteQrSvg(inviteLink(code)) || '<span class="iv-qr-none">QR จะขึ้นเมื่อออนไลน์</span>'}</div>
        <small>รหัสเชิญของคุณ</small>
        <div class="iv-code" aria-label="${esc(code.split('-').join(' '))}">${code.split('-').map(w => `<span>${esc(w)}</span>`).join('<i>-</i>')}</div>
        <div class="iv-btns">
          <button class="iv-btn iv-pri" type="button" onclick="inviteCopy('code')">${typeof icon === 'function' ? icon('copy') : ''}คัดลอกรหัส</button>
          <button class="iv-btn" type="button" onclick="inviteShare()">${typeof icon === 'function' ? icon('share') : ''}ส่งลิงก์</button>
        </div>
      </div>`;

  sh.innerHTML = `
    <div class="iv-back" onclick="closeInvite()"></div>
    <div class="iv-card${first ? ' iv-in' : ''}" role="dialog" aria-modal="true" aria-labelledby="ivTitle">
      <div class="iv-sky" aria-hidden="true">
        <i class="iv-moon"></i>
        <span class="iv-bat b1">${IV_BAT}</span><span class="iv-bat b2">${IV_BAT}</span><span class="iv-bat b3">${IV_BAT}</span>
        <span class="iv-web">${IV_WEB}</span>
        <i class="iv-fog"></i>
      </div>
      <button class="iv-x" type="button" onclick="closeInvite()" aria-label="ปิด">✕</button>
      <div class="iv-head">
        <div class="iv-kicker">HALLOWEEN · TRICK OR INVITE</div>
        <h2 id="ivTitle">ชวนเพื่อน ปลดล็อกธีม Halloween</h2>
        <p class="iv-sub">${left == null ? 'ส่งรหัสให้เพื่อนที่ยังไม่เคยใช้ StudentOS'
          : left > 0 ? `รหัสนี้ใช้ได้อีก <b>${left} คน</b> · แบ่งให้เพื่อนที่ไว้ใจ`
          : 'รหัสนี้มีเพื่อนใช้ครบแล้ว'}</p>
      </div>
      ${ticket}
      <section class="iv-quests" aria-label="ภารกิจปลดล็อก">
        <div class="iv-q${used >= INVITE_GOAL ? ' done' : ''}">
          <div class="iv-q-ic">${ivSlots(Math.min(used, INVITE_GOAL))}</div>
          <div class="iv-q-t"><b>ชวนเพื่อนครบ ${INVITE_GOAL} คน</b>
            <small>${d && d.friends && d.friends.length
              ? d.friends.slice(0, 6).map(f => esc(f.handle ? '@' + f.handle : f.name)).join(' · ')
              : 'นับเมื่อเพื่อนที่ไม่เคยใช้ StudentOS สมัครแล้วใส่รหัสของคุณ'}</small></div>
          <div class="iv-q-n">${Math.min(used, INVITE_GOAL)}/${INVITE_GOAL}</div>
        </div>
        <div class="iv-q${taskOk ? ' done' : ''}">
          <div class="iv-q-ic"><span class="iv-slot${taskOk ? ' on' : ''}" aria-hidden="true">${taskOk ? '🕯️' : ''}</span></div>
          <div class="iv-q-t"><b>ทำงานในแอปเสร็จ 1 งาน</b>
            <small>${taskOk ? 'เสร็จแล้ว' : 'ติ๊กงานไหนก็ได้ว่าเสร็จ'}</small></div>
          <div class="iv-q-n">${taskOk ? 1 : 0}/1</div>
        </div>
        <div class="iv-reward${unlocked ? ' on' : ''}">
          <span class="iv-lock" aria-hidden="true">${unlocked ? '🔓' : '🔒'}</span>
          <div><b>${unlocked ? 'ปลดล็อกธีม Halloween แล้ว' : 'รางวัล: ธีม Halloween'}</b>
            <small>${unlocked
              ? (inviteThemeReady() ? 'กดใช้ได้เลย' : 'ธีมกำลังจะมาในอัปเดตถัดไป สิทธิ์ของคุณเก็บไว้แล้ว')
              : 'ครบสองภารกิจแล้วได้ธีมทันที ใช้ได้ถาวร'}</small></div>
          ${unlocked && inviteThemeReady() ? `<button class="iv-btn iv-pri" type="button" onclick="closeInvite();setTheme('${INVITE_THEME}')">ใช้ธีม</button>` : ''}
        </div>
      </section>
      ${canRedeem ? `
      <details class="iv-redeem" id="ivRedeem"${opened || typed ? ' open' : ''}>
        <summary>มีรหัสเชิญจากเพื่อน?</summary>
        <form onsubmit="event.preventDefault();inviteRedeemTyped()">
          <input id="ivRedeemIn" autocomplete="off" autocapitalize="characters" spellcheck="false"
                 placeholder="เช่น BAT-MOON-CANDY" maxlength="40" aria-label="รหัสเชิญจากเพื่อน" value="${esc(typed)}">
          <button class="iv-btn" type="submit">ใช้รหัส</button>
        </form>
      </details>` : ''}
      ${d && d.invited_by ? `<p class="iv-fine">คุณมาจากคำชวนของ ${esc(d.invited_by.handle ? '@' + d.invited_by.handle : d.invited_by.name)}</p>` : ''}
      <p class="iv-fine">นับเฉพาะเพื่อนที่ไม่เคยใช้ StudentOS มาก่อน (ใส่รหัสภายใน ${INVITE_NEW_DAYS} วันหลังสมัคร) · ใช้รหัสแล้วเป็นเพื่อนกันในแอปอัตโนมัติ</p>
    </div>`;
}

async function inviteRedeemTyped() {
  const el = document.getElementById('ivRedeemIn');
  const v = ((el && el.value) || '').trim();
  if (!v) { if (el) el.focus(); return; }
  const r = await applyInviteCode(v);
  if (r === 'ok' && el) el.value = '';
}

function ivLogin() {
  closeInvite();
  if (typeof loginFromFriends === 'function') loginFromFriends();
  else if (typeof loginGoogle === 'function') loginGoogle();
}

async function inviteCopy(what) {
  const d = ivData;
  if (!d || !d.code) return;
  const text = what === 'link' ? inviteLink(d.code) : d.code;
  try {
    await navigator.clipboard.writeText(text);
    if (typeof haptic === 'function') haptic('arm');
    showToast({ title: what === 'link' ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกรหัสแล้ว', body: text });
  } catch (_) {
    showToast({ title: 'คัดลอกไม่ได้', body: text });
  }
}

async function inviteShare() {
  const d = ivData;
  if (!d || !d.code) return;
  const url = inviteLink(d.code);
  const text = `มาใช้ StudentOS ด้วยกัน 🎃 ใส่รหัสเชิญ ${d.code} หรือกดลิงก์นี้`;
  if (navigator.share) {
    try { await navigator.share({ title: 'ชวนใช้ StudentOS', text, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  inviteCopy('link');
}

// ---------- การ์ดทางเข้าในจอเพื่อน ----------
function paintInviteEntry() {
  const box = document.getElementById('frInviteRow');
  if (!box) return;
  const used = Math.min(inviteCount(), INVITE_GOAL);
  const unlocked = inviteUnlocked();
  box.innerHTML = `
    <button class="iv-entry${unlocked ? ' done' : ''}" type="button" onclick="openInvite()">
      <span class="iv-entry-art" aria-hidden="true">🎃<i>${IV_BAT}</i></span>
      <span class="iv-entry-t"><b>${unlocked ? 'ได้ธีม Halloween แล้ว' : 'ชวนเพื่อน 3 คน รับธีม Halloween'}</b>
        <small>${unlocked ? 'ชวนต่อได้ · ดูรหัสเชิญและ QR' : `ชวนแล้ว ${used}/${INVITE_GOAL} · รหัสเชิญและ QR ของคุณ`}</small></span>
      <span class="iv-entry-go" aria-hidden="true">›</span>
    </button>`;
}

// สลับ/ออกจากบัญชี — ของในหน่วยความจำเป็นของบัญชีเดิม (แคชใน localStorage ผูก uid ไว้แล้ว)
// onAuthStateChange ยิงทุกครั้งที่ต่ออายุ token ด้วย — ล้างเฉพาะตอนเปลี่ยนคนจริง ไม่งั้นแผ่นที่เปิดอยู่ปิดเอง
let ivOwner = null;
function inviteAccountChanged() {
  const uid = ivUid();
  if (uid === ivOwner) return;
  ivOwner = uid;
  ivData = null;
  ivLoading = null;
  ivFailed = false;
  closeInvite();
}
