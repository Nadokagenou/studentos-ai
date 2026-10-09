// ============================================================
// quickadd — ปุ่มลัดเพิ่มงานจากตัวเครื่อง  ·  *** ALT ***
// ------------------------------------------------------------
// ช่องพิมพ์เล็ก ๆ ช่องเดียว พิมพ์แล้วงานเข้าแผนเลย ไม่ต้องผ่านจอเพิ่มงานเต็ม ๆ
// (เจ้าของ 9 ต.ค. 69: "ปุ่มเพิ่มงานแบบหน้าจอเล็ก ๆ เหมือน Gemini แล้วใส่งานให้เลย")
//
// ทางเข้าสองทาง แยกตามเครื่อง เพราะข้อจำกัดคนละเรื่องกัน:
//   Android — กดค้างที่ไอคอนแอป → "เพิ่มงานด่วน" (manifest shortcuts · ?go=quick)
//             เปิดแอปมาที่หน้าแรกแล้วเด้งแผ่นนี้ทันที · ทำงานในเครื่องล้วน ไม่ต้องล็อกอิน ไม่ต้องมีเน็ต
//   iPhone  — iOS ไม่รองรับ manifest shortcuts เลย และคำสั่งลัดเปิดลิงก์ได้แค่ใน Safari
//             ซึ่งเก็บข้อมูลแยกจากแอปบนจอโฮม → ต้องส่งผ่านเซิร์ฟเวอร์ (Edge Function quick-add)
//             แอปดึงมาเองตอนเปิดครั้งถัดไป (pullInbox) · ต้องล็อกอิน + มีกุญแจส่วนตัว
//
// ทั้งสองทางลงที่ inboxAdd(…, 'quick') ตัวเดียว — แกะ/จับซ้ำ/เกณฑ์ AUTO_ACCEPT เดิมทุกอย่าง
// พิมพ์ครบ (วิชา + วันส่ง) = เข้าแผนเอง · ไม่รู้วันส่ง = รอยืนยันในกล่องเข้าหนึ่งแตะ
// ============================================================

// ---------- แผ่นเพิ่มงานด่วน ----------
let quickEl = null;

function quickOpen() {
  if (quickEl) return;
  const host = document.querySelector('.phone') || document.body;
  const scrim = document.createElement('div');
  scrim.className = 'qa-scrim';
  const box = document.createElement('div');
  box.className = 'qa-sheet';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'เพิ่มงานด่วน');
  box.innerHTML = `<form class="qa-row" onsubmit="event.preventDefault();quickSend()">
      <input id="qaIn" class="qa-in" type="text" enterkeyhint="send" autocomplete="off"
        placeholder="รายงานชีวะ ส่งศุกร์" aria-label="งานที่ต้องทำ" maxlength="500">
      <button type="submit" class="qa-go" aria-label="เพิ่มงาน"><svg viewBox="0 0 24 24" width="20" height="20"
        fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg></button>
    </form>
    <div class="qa-chips" id="qaChips"></div>`;
  host.appendChild(scrim);
  host.appendChild(box);
  quickEl = { scrim, box };

  const inp = box.querySelector('#qaIn');
  inp.addEventListener('input', quickPreview);
  scrim.onclick = () => quickClose();
  document.addEventListener('keydown', quickKey, true);
  void box.offsetWidth;
  scrim.classList.add('open'); box.classList.add('open');
  // เปิดจากปุ่มลัดของเครื่อง = มาเพื่อพิมพ์อย่างเดียว · บางเครื่องไม่ยอมเปิดคีย์บอร์ดให้โดยไม่มีการแตะ
  // ก็ไม่เป็นไร — ช่องอยู่บนสุดของจอ แตะทีเดียวถึง
  try { inp.focus({ preventScroll: true }); } catch (_) {}
}

function quickKey(e) { if (e.key === 'Escape') { e.preventDefault(); quickClose(); } }

function quickClose() {
  if (!quickEl) return;
  const { scrim, box } = quickEl;
  quickEl = null;
  // ปิดแผ่นแล้ว = ปุ่มลัดที่พามาถูกใช้จบแล้ว · รีโหลดหลังจากนี้ต้องไม่เด้งแผ่นซ้ำ (ดู shortcutTarget)
  try { sessionStorage.removeItem('studentos.alt.shortcut'); } catch (_) {}
  document.removeEventListener('keydown', quickKey, true);
  try { document.activeElement && document.activeElement.blur(); } catch (_) {}
  scrim.classList.remove('open'); box.classList.remove('open');
  setTimeout(() => { scrim.remove(); box.remove(); }, 260);
}

// ป้ายใต้ช่อง: บอกว่าแอปอ่านได้อะไรระหว่างพิมพ์ — วิชา · วันส่ง
// ไม่เจอวันส่ง = ป้ายสีเตือน เพราะนั่นคือสิ่งเดียวที่ทำให้งานไม่เข้าแผนเอง (เติมคำว่า "พรุ่งนี้" ก็พอ)
function quickPreview() {
  const box = document.getElementById('qaChips');
  const inp = document.getElementById('qaIn');
  if (!box || !inp) return;
  inp.classList.remove('bad');
  const text = inp.value.trim();
  if (!text || typeof parseAssignment !== 'function') { box.innerHTML = ''; return; }
  const p = parseAssignment(text);
  const d = p.detected || {};
  const chips = [];
  if (d.subject && p.subject && p.subject !== 'อื่น ๆ') chips.push(`<span class="qa-chip">${esc(p.subject)}</span>`);
  chips.push(d.due && p.due
    ? `<span class="qa-chip">${esc(fmtDue(p.due, new Date(), p))}</span>`
    : `<span class="qa-chip warn">ยังไม่มีวันส่ง</span>`);
  box.innerHTML = chips.join('');
}

function quickSend() {
  const inp = document.getElementById('qaIn');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) {
    inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad');
    return;
  }
  const r = inboxAdd(text, 'quick', { via: 'sheet' });
  if (typeof haptic === 'function') haptic('arm');
  quickClose();
  if (typeof renderAll === 'function') renderAll();
  showToast(quickToast(r));
}

function quickToast(r) {
  const s = r && r.status;
  if (s === 'accepted') {
    if (r.count > 1) return { title: `เพิ่มแล้ว ${r.count} งาน`, body: '' };
    const t = r.task || {};
    return { title: 'เพิ่มแล้ว', body: [t.subject && t.subject !== 'อื่น ๆ' ? t.subject : '',
      t.due ? fmtDue(t.due, new Date(), t) : ''].filter(Boolean).join(' · ') };
  }
  if (s === 'pending') return { title: 'อยู่ในกล่องเข้า', body: 'รอยืนยัน' };
  if (s === 'duplicate') return { title: 'มีงานนี้อยู่แล้ว', body: '' };
  return { title: 'เพิ่มไม่สำเร็จ', body: '' };
}

// ============================================================
// กุญแจส่วนตัวสำหรับคำสั่งลัดบน iPhone
// ------------------------------------------------------------
// ตัวกุญแจเก็บในเครื่องนี้ (คีย์ใหม่ studentos.alt.quickKey) ไว้คัดลอกซ้ำได้ · เซิร์ฟเวอร์เก็บแค่แฮช
// เครื่องอื่นที่ล็อกอินบัญชีเดียวกันจะเห็นว่า "มีลิงก์อยู่แล้ว" แต่คัดลอกไม่ได้ — ต้องสร้างใหม่
// (สร้างใหม่ = ลิงก์เดิมตายทันที ซึ่งเป็นสิ่งที่ต้องการเวลากุญแจหลุด)
// ============================================================
const QUICK_KEY_STORE = 'studentos.alt.quickKey';
// remote: ฝั่งเซิร์ฟเวอร์มีกุญแจของบัญชีนี้ไหม · null = ยังไม่ได้ถาม · busy กันกดซ้ำระหว่างรอ
const quick = { remote: null, asked: '', busy: false };

function quickLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(QUICK_KEY_STORE) || 'null');
    // กุญแจผูกกับบัญชี — สลับบัญชีในเครื่องเดียวกันแล้วต้องไม่เห็นลิงก์ของอีกคน
    return v && v.key && currentUser && v.uid === currentUser.id ? v : null;
  } catch (_) { return null; }
}

function quickUrl(key) {
  const c = window.SUPABASE_CONFIG || {};
  return c.url + '/functions/v1/quick-add?k=' + key;
}

function quickNewKey() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function quickHash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ถามเซิร์ฟเวอร์ครั้งเดียวต่อบัญชีว่ามีกุญแจอยู่แล้วไหม แล้ววาดจอตัวเชื่อมใหม่เมื่อได้คำตอบ
async function quickCheckRemote() {
  if (!sb || !currentUser || quick.asked === currentUser.id) return;
  quick.asked = currentUser.id;
  const { data, error } = await sb.from('quick_keys').select('user_id').maybeSingle();
  quick.remote = error ? null : !!data;
  if (typeof renderSources === 'function') renderSources();
}

async function quickCreate() {
  if (quick.busy || !sb || !currentUser) return;
  // มีลิงก์อยู่แล้ว (ในเครื่องนี้หรือเครื่องอื่น) — สร้างใหม่ = ปุ่มที่ตั้งไว้ใน iPhone ใช้ไม่ได้จนกว่าจะวางลิงก์ใหม่
  if ((quickLocal() || quick.remote) && !(await appConfirm({
    title: 'สร้างลิงก์ใหม่?', body: 'ลิงก์เดิมจะใช้ไม่ได้', ok: 'สร้างใหม่' }))) return;
  quick.busy = true; renderSources();
  const key = quickNewKey();
  const { error } = await sb.from('quick_keys').upsert(
    { user_id: currentUser.id, key_hash: await quickHash(key), created_at: new Date().toISOString(), last_used_at: null },
    { onConflict: 'user_id' });
  quick.busy = false;
  if (error) { renderSources(); showToast({ title: 'สร้างลิงก์ไม่สำเร็จ', body: error.message }); return; }
  try { localStorage.setItem(QUICK_KEY_STORE, JSON.stringify({ key, uid: currentUser.id, at: Date.now() })); } catch (_) {}
  quick.remote = true;
  renderSources();
  quickCopy();
}

async function quickRevoke() {
  if (quick.busy || !sb || !currentUser) return;
  if (!(await appConfirm({ title: 'ปิดปุ่มลัดบน iPhone?', body: 'ลิงก์เดิมจะใช้ไม่ได้', ok: 'ปิด', danger: true }))) return;
  quick.busy = true; renderSources();
  const { error } = await sb.from('quick_keys').delete().eq('user_id', currentUser.id);
  quick.busy = false;
  if (error) { renderSources(); showToast({ title: 'ปิดไม่สำเร็จ', body: error.message }); return; }
  try { localStorage.removeItem(QUICK_KEY_STORE); } catch (_) {}
  quick.remote = false;
  renderSources();
}

function quickCopy() {
  const v = quickLocal();
  if (!v) return;
  const url = quickUrl(v.key);
  const ok = () => showToast({ title: 'คัดลอกลิงก์แล้ว', body: '' });
  try {
    navigator.clipboard.writeText(url).then(ok, () => quickCopyFallback(url));
  } catch (_) { quickCopyFallback(url); }
}

// เบราว์เซอร์ไม่ให้สิทธิ์คลิปบอร์ด — เลือกข้อความในช่องให้ ผู้ใช้กดคัดลอกเองได้
function quickCopyFallback() {
  const el = document.getElementById('qaUrl');
  if (el) { el.focus(); el.select(); }
  showToast({ title: 'กดค้างที่ลิงก์แล้วเลือกคัดลอก', body: '' });
}

// ---------- แผงในจอ "ตัวเชื่อม" (แถว "ปุ่มลัดเพิ่มงาน") ----------
function quickPanel() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '')
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const steps = list => `<span class="src-how">${list.map((h, i) => `<span><b>${i + 1}</b>${h}</span>`).join('')}</span>`;

  const android = `<div class="qa-p">
      <span class="qa-h">Android</span>
      ${steps(['กดค้างที่ไอคอน Student OS', 'เลือก <b>เพิ่มงานด่วน</b> · ลากไปวางบนจอได้'])}
    </div>`;

  let ios;
  if (typeof cloudConfigured !== 'function' || !cloudConfigured()) {
    ios = '';
  } else if (!currentUser) {
    ios = `<div class="src-need">${icon('lock')}ต้องล็อกอินก่อน</div>
      <button class="ib-go" style="margin-top:10px; align-self:flex-start" onclick="go('scr-profile')">ไปล็อกอิน</button>`;
  } else {
    quickCheckRemote();
    const v = quickLocal();
    const ready = typeof sosCfg === 'function' ? sosCfg('quick.iosShortcut', '') : '';
    const busy = quick.busy ? ' disabled' : '';
    ios = v
      ? `<input class="src-in" id="qaUrl" readonly value="${esc(quickUrl(v.key))}" onclick="this.select()">
        <div class="ib-act">
          <button class="ib-go" onclick="quickCopy()"${busy}>${icon('copy')}คัดลอกลิงก์</button>
          ${ready ? `<button onclick="window.open('${esc(ready)}','_blank')">ติดตั้งคำสั่งลัด</button>` : ''}
        </div>
        ${ready ? steps(['คัดลอกลิงก์', 'กด <b>ติดตั้งคำสั่งลัด</b> แล้ววางลิงก์', 'การตั้งค่า → การช่วยการเข้าถึง → สัมผัส → <b>แตะด้านหลัง</b> → แตะสองครั้ง → เลือกคำสั่งนี้'])
          : steps(['แอปคำสั่งลัด → สร้างคำสั่งใหม่',
            '<b>ถามหาข้อมูลเข้า</b> (Ask for Input)',
            '<b>รับเนื้อหาของ URL</b> (Get Contents of URL) · วางลิงก์ · วิธี POST · เนื้อหา JSON: <b>text</b> = ข้อมูลเข้าที่ระบุ',
            '<b>แสดงการแจ้งเตือน</b> (Show Notification) · เนื้อหาของ URL',
            'การตั้งค่า → การช่วยการเข้าถึง → สัมผัส → <b>แตะด้านหลัง</b> → แตะสองครั้ง → เลือกคำสั่งนี้'])}
        <div class="ib-act">
          <button onclick="quickCreate()"${busy}>สร้างลิงก์ใหม่</button>
          <button onclick="quickRevoke()"${busy}>ปิด</button>
        </div>`
      : `${quick.remote ? `<div class="src-need">${icon('flag')}มีลิงก์บนเครื่องอื่นอยู่แล้ว</div>` : ''}
        <button class="ib-go" style="margin-top:10px; align-self:flex-start" onclick="quickCreate()"${busy}>
          ${quick.busy ? 'กำลังสร้าง…' : quick.remote ? 'สร้างลิงก์ใหม่' : 'สร้างลิงก์'}</button>`;
  }

  const iosBlock = ios ? `<div class="qa-p"><span class="qa-h">iPhone</span>${ios}</div>` : '';
  // แสดงของเครื่องตัวเองก่อน — คนส่วนใหญ่ตั้งค่าบนเครื่องที่ถืออยู่
  return `<div class="qa-panel">
      ${isIOS ? iosBlock + android : android + iosBlock}
      <button class="qa-try" onclick="quickOpen()">${icon('sparkles')}ลองเลย</button>
    </div>`;
}
