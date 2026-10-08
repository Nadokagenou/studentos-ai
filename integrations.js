// ============================================================
// integrations — ฝั่งแอปของชั้นตัวเชื่อม  ·  *** ALT ***
// ------------------------------------------------------------
// ไฟล์นี้ไม่รู้จัก API ของ Google หรือของโรงเรียนไหนเลยสักเจ้า และตั้งใจให้เป็นแบบนั้น
// มันรู้จักอย่างเดียวคือ Edge Function ชื่อ `integrations` ซึ่งเป็นประตูเดียวที่เปิดอยู่
//
// เหตุผลที่กุญแจไม่เคยเดินทางมาถึงไฟล์นี้: ทุกอย่างที่อยู่ในโค้ดฝั่งเบราว์เซอร์
// คือของสาธารณะ เปิด DevTools ก็อ่านได้ · refresh token ของบัญชีโรงเรียนจึงต้องไม่เคย
// ผ่านตรงนี้แม้แต่วินาทีเดียว — ฝั่งนี้เห็นแค่ "เชื่อมกับอะไรไว้ · สถานะเป็นยังไง"
//
// ของที่ไหลเข้ามาจริง ๆ ไม่ได้มาทางนี้ด้วยซ้ำ · มันมาทาง inbox_items → pullInbox()
// ท่อเดียวกับที่บอท LINE ใช้อยู่แล้ว (linelink.js)
// ============================================================

// สถานะอยู่ในหน่วยความจำ ไม่ลง state/localStorage โดยตั้งใจ —
// ความจริงเรื่อง "เชื่อมอะไรไว้บ้าง" อยู่ที่เซิร์ฟเวอร์ · เก็บสำเนาไว้ในเครื่องเมื่อไหร่
// จะมีวันที่มันไม่ตรงกัน แล้วผู้ใช้จะเห็นว่าเชื่อมอยู่ทั้งที่ถูกถอนสิทธิ์ไปแล้ว
let integ = { items: [], google: false, loaded: false, busy: '', err: '', tried: false };

function integReady() { return !!(typeof sb !== 'undefined' && sb && currentUser); }
function integItems() { return integ.items || []; }
function integBy(provider) { return integItems().filter(i => i.provider === provider); }

// ---------- คุยกับประตู ----------
async function integCall(action, body = {}) {
  if (!integReady()) throw new Error('ต้องล็อกอินก่อนถึงจะเชื่อมได้');
  const { data, error } = await sb.functions.invoke('integrations', { body: { action, ...body } });
  if (error) throw new Error(await integErrText(error));
  if (!data || data.ok === false) throw new Error((data && data.message) || 'ทำรายการไม่สำเร็จ');
  return data;
}

// supabase-js ห่อคำตอบที่ไม่ใช่ 2xx ไว้เป็น error ก้อนเดียวที่เขียนว่า
// "Edge Function returned a non-2xx status code" ซึ่งไม่ได้บอกอะไรกับใครเลย
// ข้อความจริงที่เราอุตส่าห์เขียนให้อ่านรู้เรื่องอยู่ใน body ของคำตอบ ต้องแกะออกมาเอง
async function integErrText(error) {
  try {
    const j = await error.context.json();
    if (j && j.message) return String(j.message);
  } catch (_) {}
  return (error && error.message) || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
}

async function integLoad(force) {
  if (!integReady()) { integ.items = []; integ.loaded = false; return; }
  if (integ.loaded && !force) return;
  integ.tried = true;
  try {
    const d = await integCall('list');
    integ.items = d.items || [];
    integ.google = !!(d.ready && d.ready.google);
    integ.loaded = true;
    integ.err = '';
  } catch (e) {
    integ.err = e.message;
    // ล้มรอบนี้ไม่ได้แปลว่าล้มตลอดไป (เน็ตสะดุดตอนบูตเป็นเรื่องปกติของมือถือ)
    // ปลดธงให้จอที่วาดครั้งหน้าได้ลองใหม่ · ไม่วนเองเพราะการวาดเกิดจากคนกดเท่านั้น
    integ.tried = false;
  }
  if (typeof renderSources === 'function') renderSources();
  // 1C40 · กล่องเข้ามีแถวสถานะของตัวเชื่อมด้วย — คำตอบจากเซิร์ฟเวอร์ต้องไปถึงจอนั้นเหมือนกัน
  if (typeof renderInbox === 'function') renderInbox();
}

// ตาข่ายชั้นสอง: จอไหนที่ต้องใช้ข้อมูลนี้ เรียกตัวนี้ตอนเริ่มวาดได้เลย
// ไม่ต้องไปพึ่งว่าเส้นทางบูตเส้นไหนจะเรียก integLoad ให้หรือเปล่า — ซึ่งเป็นสมมติฐาน
// ที่ผิดมาแล้วหนึ่งรอบ (ดูหมายเหตุใน initCloud) และผิดแบบเงียบสนิทไม่มีอะไรฟ้อง
function integAutoLoad() {
  if (integ.tried || integ.loaded || !integReady()) return;
  integLoad(true);
}

// ---------- เชื่อมปฏิทินของ LMS ----------
// ทางนี้ไม่ต้องขออนุมัติใคร ใช้ได้ทันทีกับ Canvas · Moodle · พอร์ทัลโรงเรียนอีกมาก
// เพราะเป็นลิงก์ที่ระบบของโรงเรียนออกให้นักเรียนเองอยู่แล้ว
async function integConnectIcs(url) {
  const clean = String(url || '').trim();
  if (!clean) { showToast({ title: 'ยังไม่ได้วางลิงก์' }); return false; }
  integ.busy = 'ics';
  if (typeof renderSources === 'function') renderSources();
  try {
    // เขตเวลาของเครื่องนี้ — ปฏิทินบางใบส่งเวลามาแบบไม่มีเขตเวลาติดมาด้วย
    // ฝั่งเซิร์ฟเวอร์จึงต้องรู้ว่า "เวลาลอย" ของคนคนนี้หมายถึงเวลาที่ไหน
    let tz = 'Asia/Bangkok';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (_) {}

    const d = await integCall('connect_ics', { url: clean, tz });
    await integLoad(true);
    // ของรอบแรกถูกซิงก์ไปแล้วฝั่งเซิร์ฟเวอร์ — ลากลงมาเลย ไม่ต้องรอรอบ poll ถัดไป
    if (typeof pullInbox === 'function') await pullInbox();
    showToast(d.found
      ? { title: 'เชื่อมปฏิทินแล้ว', body: `เจอ ${d.found} รายการ` }
      : { title: 'เชื่อมปฏิทินแล้ว', body: 'ยังไม่มีงานในปฏิทิน' });
    return true;
  } catch (e) {
    showToast({ title: 'เชื่อมไม่สำเร็จ', body: e.message });
    return false;
  } finally {
    integ.busy = '';
    if (typeof renderSources === 'function') renderSources();
  }
}

// ---------- เชื่อมบัญชี Google ----------
// พาออกไปหน้าอนุญาตของ Google แล้วเดินทางกลับเข้ามาที่ integBootNotice()
//
// ก่อนออกไปต้องผ่านแผ่นบอกทางหนึ่งแผ่นเสมอ (ข้ามได้ด้วย go = true จากปุ่มในแผ่นเอง)
// เพราะหน้าของ Google มีกับดักสามจุดที่คนพลาดกันจริง และพลาดแล้วไม่มีอะไรบอกว่าพลาด:
//   1. เลือกบัญชีส่วนตัวแทนบัญชีโรงเรียน → เชื่อมผ่าน แต่ไม่มีงานเข้าเลยสักใบ
//   2. แอปยังไม่ผ่านการตรวจของ Google → ขึ้นหน้าเตือนสีแดง ซ่อนปุ่มไปต่อไว้หลัง "ขั้นสูง"
//      คนที่ไม่รู้มาก่อนจะกด "กลับสู่ความปลอดภัย" แล้วสรุปว่าแอปพัง
//   3. Google ให้ติ๊กสิทธิ์ทีละช่อง → ไม่ติ๊กครบ เชื่อมผ่านแต่ดึงงานไม่ได้
// prompt=consent แปลว่าเจอหน้าพวกนี้ทุกครั้งที่กดเชื่อม แผ่นนี้จึงโผล่ทุกครั้งเหมือนกัน
const GOOGLE_GUIDE = {
  google_classroom: { acct: 'เลือกบัญชีโรงเรียน' },
  google_calendar:  { acct: 'เลือกบัญชีโรงเรียน' },
};

function integGoogleGuide(provider) {
  const el = document.getElementById('soonSheet');
  const g = GOOGLE_GUIDE[provider];
  if (!el || !g) return false;
  const s = (typeof SOURCES !== 'undefined' && SOURCES.find(x => x.id === provider)) || {};
  el.innerHTML = `<div class="as-scrim" onclick="closeSoonSheet()"></div>
    <div class="as-card soon-card" role="dialog" aria-label="เชื่อม ${esc(s.name || 'Google')}">
      <div class="as-grip"></div>
      <div class="soon-ic">${icon(s.icon || 'book')}</div>
      <h3 class="soon-t">เชื่อม ${esc(s.name || 'Google')}</h3>
      <ol class="gg-steps">
        <li>${esc(g.acct)}</li>
        <li>ถ้าขึ้นว่า <b>“Google ยังไม่ได้ยืนยันแอปนี้”</b> ให้กด <b>ขั้นสูง</b>
          แล้วกดลิงก์ <b>ไปที่ … (ไม่ปลอดภัย)</b> ข้างล่าง</li>
        <li><b>ติ๊กทุกช่อง</b> แล้วกดดำเนินการต่อ</li>
      </ol>
      <p class="gg-note">ถ้าขึ้นว่าถูกบล็อกหรือต้องให้ผู้ดูแลอนุมัติ แปลว่าโรงเรียนปิดกั้นแอปภายนอก
        ใช้ปุ่มแชร์ใน Classroom ส่งงานเข้าแอปนี้แทนได้</p>
      <button class="soon-go" onclick="closeSoonSheet();integConnectGoogle('${provider}', true)">ไปหน้า Google</button>
      <button class="soon-x" onclick="closeSoonSheet()">ยกเลิก</button>
    </div>`;
  el.hidden = false;
  setTimeout(() => el.classList.add('on'), 16);
  if (typeof haptic === 'function') haptic('tap');
  return true;
}

async function integConnectGoogle(provider, go) {
  if (!go && integGoogleGuide(provider)) return false;
  integ.busy = provider;
  if (typeof renderSources === 'function') renderSources();
  try {
    const d = await integCall('connect_google', { provider });
    if (!d.url) throw new Error('เซิร์ฟเวอร์ไม่ได้ส่งลิงก์กลับมา');
    location.href = d.url;
    return true;
  } catch (e) {
    integ.busy = '';
    showToast({ title: 'เชื่อมไม่สำเร็จ', body: e.message });
    if (typeof renderSources === 'function') renderSources();
    return false;
  }
}

// ---------- ตัดการเชื่อม ----------
// ยืนยันก่อนเสมอ — ของที่เข้าแผนไปแล้วไม่ได้หายตาม แต่คนกดควรรู้ว่าอะไรจะหยุด
async function integDisconnect(id) {
  const row = integItems().find(i => i.id === id);
  if (!row) return;
  // งานที่เข้าแผนไปแล้วไม่หายตาม — ต้องเขียนไว้ในคำถาม ไม่งั้นคนจะไม่กล้ากดตัด
  // ทั้งที่อยากตัด เพราะกลัวว่างานทั้งเทอมจะหายไปด้วย
  if (!confirm(`ตัดการเชื่อม${row.account ? ' ' + row.account : ''}?\n\n`
    + 'งานที่เข้าแผนไปแล้วยังอยู่ครบ')) return;

  integ.busy = id;
  if (typeof renderSources === 'function') renderSources();
  try {
    await integCall('disconnect', { id });
    await integLoad(true);
    showToast({ title: 'ตัดการเชื่อมแล้ว' });
  } catch (e) {
    showToast({ title: 'ตัดไม่สำเร็จ', body: e.message });
  } finally {
    integ.busy = '';
    if (typeof renderSources === 'function') renderSources();
  }
}

async function integSyncNow(id) {
  integ.busy = id;
  if (typeof renderSources === 'function') renderSources();
  try {
    await integCall('sync_now', { id });
    await integLoad(true);
    if (typeof pullInbox === 'function') await pullInbox();
  } catch (e) {
    showToast({ title: 'ซิงก์ไม่สำเร็จ', body: e.message });
  } finally {
    integ.busy = '';
    if (typeof renderSources === 'function') renderSources();
  }
}

async function integSetPaused(id, paused) {
  try {
    await integCall('set_paused', { id, paused: !!paused });
    await integLoad(true);
  } catch (e) {
    showToast({ title: 'เปลี่ยนสถานะไม่สำเร็จ', body: e.message });
  }
}

// ---------- ขากลับจากหน้าอนุญาตของ Google ----------
// ต้องมีข้อความบอกผลเสมอ ไม่ว่าจบแบบไหน · การเดินทางออกไปเว็บของคนอื่นแล้วกลับมา
// เจอหน้าเดิมเฉย ๆ คือจังหวะที่คนสรุปเองว่า "กดแล้วไม่เกิดอะไรขึ้น" แล้วไม่กดอีก
function integBootNotice() {
  const q = (typeof BOOT_Q !== 'undefined' && BOOT_Q) ? BOOT_Q : new URLSearchParams(location.search);
  const st = q.get('integration');
  if (!st) return;

  if (st === 'ok') {
    showToast({ title: 'เชื่อมบัญชีแล้ว', body: 'กำลังดึงงาน…' });
    // ฝั่งเซิร์ฟเวอร์เพิ่งสั่งซิงก์รอบแรกไปตอนที่เรากำลังเดินทางกลับ ยังไม่เสร็จแน่ ๆ
    // รอสั้น ๆ แล้วค่อยลากของลงมา ดีกว่าลากทันทีแล้วได้ของว่าง
    setTimeout(() => { if (typeof pullInbox === 'function') pullInbox(); }, 4000);
    integLoad(true);
  } else if (st === 'cancelled') {
    showToast({ title: 'ยกเลิกการเชื่อมแล้ว', body: 'ไม่มีอะไรถูกบันทึก' });
  } else {
    // รายละเอียดเป็นศัพท์ของระบบ ไม่เอามาโชว์ตรง ๆ แต่เขียนลง console ไว้ให้ไล่ตามได้
    console.warn('[integrations] เชื่อมไม่สำเร็จ:', q.get('detail') || '');
    showToast({ title: 'เชื่อมไม่สำเร็จ', body: 'ลองใหม่อีกครั้ง' });
  }
}

// ---------- แถวตัวเชื่อม API ในเมนู + ----------
// เหตุผลเดียวกับที่ connectorMenuRows() มีอยู่: หน้าเต็มอยู่ลึกสองชั้น ซึ่งแปลว่าไม่มีใครหาเจอ
// ส่วนปุ่ม + อยู่บนแถบล่างของทุกหน้า — ห่างจากนิ้วหนึ่งครั้งกดเสมอ
//
// กติกาของแผ่นนี้ต่างจากหน้าเต็มหนึ่งข้อ: **โชว์เฉพาะสิ่งที่กดแล้วเกิดอะไรขึ้นจริง**
// ยังไม่ล็อกอิน · เซิร์ฟเวอร์ยังไม่พร้อม · ยังไม่ได้ตั้งกุญแจ Google → ไม่ต้องโผล่ตรงนี้
// เพราะแผ่นนี้คือที่ที่คนมาเพื่อ "ทำอะไรสักอย่างให้เสร็จเดี๋ยวนี้" ไม่ใช่ที่อ่านว่าทำไมยังทำไม่ได้
// (หน้าเต็มอธิบายครบอยู่แล้ว และ "ดูตัวเชื่อมทั้งหมด" อยู่ท้ายแผ่นพอดี)
function integMenuRows() {
  integAutoLoad();
  if (!integReady() || integ.err) return '';
  const src = id => (typeof SOURCES !== 'undefined' && SOURCES.find(s => s.id === id)) || null;
  let html = '';

  // ---- ที่เชื่อมไว้แล้ว: บอกสถานะ แตะเพื่อไปจัดการต่อ ----
  for (const r of integItems()) {
    const s = src(r.provider) || { name: r.provider, icon: 'calendar' };
    const bad = r.status === 'needs_reauth';
    html += `<div class="as-row as-tgl" onclick="closeAddSheet();go('scr-sources')">
      <span class="as-ic">${icon(s.icon)}</span>
      <span class="as-tx"><b>${esc(s.shortName || s.name)}</b>
        <span>${esc(r.account || integStatusText(r))}</span></span>
      <span class="as-cnt ${bad ? 'bad' : 'ok'}">${icon(bad ? 'flag' : 'check')}${bad ? 'ต้องเชื่อมใหม่' : 'เชื่อมแล้ว'}</span>
    </div>`;
  }

  // ---- ที่ยังต่อเพิ่มได้: กดแล้วเริ่มเชื่อมจากตรงนี้เลย ----
  const connected = new Set(integItems().map(r => r.provider));
  const open = (typeof SOURCES !== 'undefined' ? SOURCES : [])
    .filter(s => s.connect && !connected.has(s.id))
    .filter(s => s.connect !== 'google' || integ.google);
  for (const s of open) {
    // ปฏิทินต้องวางลิงก์ซึ่งพิมพ์ในแผ่นเตี้ย ๆ ไม่ไหว → พาไปหน้าเต็มแล้วโฟกัสช่องให้เลย
    // ส่วน Google ไม่ต้องกรอกอะไรสักช่อง กดแล้วออกไปหน้าอนุญาตได้ทันทีจากตรงนี้
    const act = s.connect === 'google'
      ? `closeAddSheet();integConnectGoogle('${s.id}')`
      : `closeAddSheet();go('scr-sources');setTimeout(()=>{const e=document.getElementById('icsUrl');if(e)e.focus();},350)`;
    html += `<div class="as-row as-tgl" onclick="${act}">
      <span class="as-ic">${icon(s.icon)}</span>
      <span class="as-tx"><b>${esc(s.shortName || s.name)}</b><span>${esc(s.desc)}</span></span>
      <span class="as-cnt">เชื่อม</span>
    </div>`;
  }
  return html;
}

// ---------- ข้อความสถานะที่ผู้ใช้อ่านรู้เรื่อง ----------
// สถานะดิบจากเซิร์ฟเวอร์เป็นคำของโปรแกรมเมอร์ · หน้าจอไม่ควรเห็นมันเลยสักคำ
function integStatusText(row) {
  if (!row) return '';
  if (row.status === 'needs_reauth') return row.error_msg || 'ต้องเชื่อมใหม่';
  if (row.status === 'paused') return 'พักไว้';
  if (row.status === 'error') return 'ต้นทางมีปัญหา กำลังลองใหม่';
  if (!row.last_sync_at) return 'กำลังดึงรอบแรก';
  const mins = Math.round((Date.now() - new Date(row.last_sync_at).getTime()) / 60000);
  if (!isFinite(mins) || mins < 0) return 'ทำงานอยู่';
  if (mins < 1) return 'อัปเดตเมื่อสักครู่';
  if (mins < 60) return `อัปเดตเมื่อ ${mins} นาทีที่แล้ว`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `อัปเดตเมื่อ ${hrs} ชม.ที่แล้ว` : 'อัปเดตเมื่อวานหรือก่อนหน้า';
}
