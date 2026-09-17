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
let integ = { items: [], google: false, loaded: false, busy: '', err: '' };

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
  try {
    const d = await integCall('list');
    integ.items = d.items || [];
    integ.google = !!(d.ready && d.ready.google);
    integ.loaded = true;
    integ.err = '';
  } catch (e) {
    integ.err = e.message;
  }
  if (typeof renderSources === 'function') renderSources();
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
      ? { title: 'เชื่อมปฏิทินแล้ว', body: `เจอ ${d.found} รายการในปฏิทิน — ที่ยังไม่ถึงกำหนดจะทยอยเข้าแผนให้` }
      : { title: 'เชื่อมปฏิทินแล้ว', body: 'ตอนนี้ยังไม่มีงานในปฏิทิน มีเมื่อไหร่จะเข้ามาเอง' });
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
async function integConnectGoogle(provider) {
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
    + 'งานที่เข้าแผนไปแล้วยังอยู่ครบ — หยุดแค่ของใหม่ที่จะไหลเข้ามา\n'
    + 'สิทธิ์ที่เคยให้ไว้จะถูกถอนคืนที่ฝั่งผู้ให้บริการด้วย')) return;

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
    showToast({ title: 'เชื่อมบัญชีแล้ว', body: 'กำลังดึงงานรอบแรกให้ — อาจใช้เวลาสักครู่' });
    // ฝั่งเซิร์ฟเวอร์เพิ่งสั่งซิงก์รอบแรกไปตอนที่เรากำลังเดินทางกลับ ยังไม่เสร็จแน่ ๆ
    // รอสั้น ๆ แล้วค่อยลากของลงมา ดีกว่าลากทันทีแล้วได้ของว่าง
    setTimeout(() => { if (typeof pullInbox === 'function') pullInbox(); }, 4000);
    integLoad(true);
  } else if (st === 'cancelled') {
    showToast({ title: 'ยกเลิกการเชื่อมแล้ว', body: 'ไม่มีอะไรถูกบันทึก' });
  } else {
    // รายละเอียดเป็นศัพท์ของระบบ ไม่เอามาโชว์ตรง ๆ แต่เขียนลง console ไว้ให้ไล่ตามได้
    console.warn('[integrations] เชื่อมไม่สำเร็จ:', q.get('detail') || '');
    showToast({ title: 'เชื่อมไม่สำเร็จ', body: 'ลองใหม่อีกครั้งจากหน้าตัวเชื่อม' });
  }
}

// ---------- ข้อความสถานะที่ผู้ใช้อ่านรู้เรื่อง ----------
// สถานะดิบจากเซิร์ฟเวอร์เป็นคำของโปรแกรมเมอร์ · หน้าจอไม่ควรเห็นมันเลยสักคำ
function integStatusText(row) {
  if (!row) return '';
  if (row.status === 'needs_reauth') return row.error_msg || 'ต้องเชื่อมใหม่';
  if (row.status === 'paused') return 'พักไว้';
  if (row.status === 'error') return 'ต้นทางมีปัญหา กำลังลองใหม่ให้เอง';
  if (!row.last_sync_at) return 'กำลังดึงรอบแรก';
  const mins = Math.round((Date.now() - new Date(row.last_sync_at).getTime()) / 60000);
  if (!isFinite(mins) || mins < 0) return 'ทำงานอยู่';
  if (mins < 1) return 'อัปเดตเมื่อสักครู่';
  if (mins < 60) return `อัปเดตเมื่อ ${mins} นาทีที่แล้ว`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `อัปเดตเมื่อ ${hrs} ชม.ที่แล้ว` : 'อัปเดตเมื่อวานหรือก่อนหน้า';
}
