// ============================================================
// ชุดความปลอดภัย — รายงาน · อายุ · ลบบัญชี · บอกว่าเก็บอะไร
// ------------------------------------------------------------
// ผู้ใช้ของแอปนี้เป็นผู้เยาว์ทั้งหมด สิ่งที่ทำให้แอปแบบนี้อันตรายไม่ใช่
// "การมีเด็กใช้" แต่คือ "การที่คนแปลกหน้าเข้าถึงเด็กได้"
// ทุกอย่างในไฟล์นี้ยืนอยู่บนเส้นนั้นเส้นเดียว
// ============================================================

const REPORT_REASONS = [
  { id: 'bully',    t: 'กลั่นแกล้ง ว่าร้าย' },
  { id: 'sexual',   t: 'เนื้อหาทางเพศ' },
  { id: 'violence', t: 'ความรุนแรง ทำร้ายตัวเอง' },
  { id: 'spam',     t: 'สแปม ขายของ' },
  { id: 'other',    t: 'อื่น ๆ' },
];

let reportTarget = null;   // { kind, id }

function openReport(kind, id) {
  reportTarget = { kind, id: String(id) };
  const sh = document.getElementById('reportSheet');
  if (!sh) return;
  sh.hidden = false;
  sh.innerHTML = `
    <div class="rp-back" onclick="closeReport()"></div>
    <div class="rp-card" role="dialog" aria-label="รายงานเนื้อหา">
      <div class="rp-h">รายงานเนื้อหานี้</div>
      <p class="rp-p">ทีมงานจะเห็นคำร้องของคุณ · ถ้ามีคนรายงานชิ้นเดียวกันหลายคน
        ระบบจะซ่อนให้ทันทีระหว่างรอตรวจ · คนที่ถูกรายงานจะไม่รู้ว่าใครเป็นคนรายงาน</p>
      ${REPORT_REASONS.map(r => `<button class="rp-op" onclick="sendReport('${r.id}')">
        ${esc(r.t)}</button>`).join('')}
      <button class="rp-cancel" onclick="closeReport()">ยกเลิก</button>
    </div>`;
}
function closeReport() {
  const sh = document.getElementById('reportSheet');
  if (sh) { sh.hidden = true; sh.innerHTML = ''; }
  reportTarget = null;
}

async function sendReport(reason) {
  if (!reportTarget || !sb || !currentUser) return closeReport();
  const t = reportTarget;
  closeReport();
  const { error } = await sb.rpc('report_content',
    { p_kind: t.kind, p_target: t.id, p_reason: reason, p_note: null });
  if (error) { showToast({ title: 'รายงานไม่สำเร็จ', body: error.message }); return; }
  haptic('done');
  // ซ่อนจากตาเจ้าตัวทันที ไม่ต้องรอถึงเกณฑ์ — คนที่เพิ่งรายงานไม่ควรต้องเห็นมันอีก
  if (t.kind === 'post') {
    feedRows = (feedRows || []).filter(p => p.id !== t.id);
    if (typeof renderFeed === 'function') renderFeed();
  } else {
    theReplies = (theReplies || []).filter(r => String(r.id) !== t.id);
    if (typeof renderThread === 'function') renderThread();
  }
  showToast({ title: 'รายงานแล้ว ขอบคุณ', body: 'เราซ่อนมันออกจากหน้าของคุณให้แล้ว' });
}

// ============================================================
// อายุ + ความยินยอม
// ------------------------------------------------------------
// ถามครั้งเดียวตอนเข้าใช้ชั้นสังคมครั้งแรก ไม่ถามวันเกิด — ถามแค่ช่วง
// เก็บน้อยที่สุดเท่าที่ตอบคำถามได้ คือสิ่งที่ทำให้ข้อมูลรั่วแล้วเสียหายน้อยที่สุด
// ============================================================
function needsConsent() {
  const s = (state.settings && state.settings.social) || {};
  return !s.agreedAt;
}

function renderConsent() {
  const box = document.getElementById('consentBody');
  if (!box) return;
  box.innerHTML = `
    <div class="cs-wrap">
      <div class="cs-ic">${icon('lock')}</div>
      <h1 class="cs-h">ก่อนเข้าไปเจอเพื่อน</h1>
      <p class="cs-p">ตรงนี้มีคนอื่นอยู่ด้วย เราเลยอยากให้คุณรู้ก่อนว่าอะไรเป็นอะไร
        ใช้เวลาไม่ถึงนาที</p>

      <div class="cs-box">
        <div class="cs-row"><b>เพื่อนเห็นอะไรของคุณ</b>
          <span>ชื่อ รูป คำแนะนำตัว และรายชื่อวิชาที่คุณเลือกเอง</span></div>
        <div class="cs-row"><b>เพื่อนไม่เห็นอะไร</b>
          <span>งานของคุณ ตารางเรียน สถิติ คะแนน — ไม่มีอะไรพวกนี้ถูกส่งขึ้นไป</span></div>
        <div class="cs-row"><b>ใครเข้ามาได้บ้าง</b>
          <span>เฉพาะคนที่กดลิงก์จากกลุ่ม LINE ห้องคุณ — ไม่มีคนแปลกหน้าค้นเจอคุณได้</span></div>
        <div class="cs-row"><b>ถอนตัวได้ตลอด</b>
          <span>ลบบัญชีและข้อมูลทั้งหมดได้เองที่หน้าตั้งค่า ลบแล้วหายจริง</span></div>
      </div>

      <p class="cs-q">คุณอายุเท่าไหร่</p>
      <div class="cs-ages">
        <button class="cs-age" onclick="acceptConsent('under')">ต่ำกว่า 15</button>
        <button class="cs-age" onclick="acceptConsent('ok')">15 ขึ้นไป</button>
      </div>
      <p class="cs-fine">ถ้าต่ำกว่า 15 คุณจะโพสต์ได้เฉพาะในห้องเรียนของตัวเอง
        ซึ่งเป็นวงที่ทุกคนรู้จักกันตัวจริง · เราถามแค่ช่วงอายุ ไม่ได้เก็บวันเกิด</p>
      <button class="cs-read" onclick="go('scr-privacy')">อ่านฉบับเต็มว่าเราเก็บอะไรบ้าง</button>
    </div>`;
}

async function acceptConsent(band) {
  const s = (typeof socialState === 'function' ? socialState() : {}) || {};
  s.ageBand = band;
  s.agreedAt = Date.now();
  if (typeof saveSocial === 'function') saveSocial(s);
  if (sb && currentUser) {
    await sb.from('profiles').upsert({
      id: currentUser.id,
      display_name: (state.settings.name || '').trim() || 'นักเรียน',
      age_band: band,
      agreed_at: new Date().toISOString(),
    });
  }
  haptic('done');
  if (typeof openFeed === 'function') openFeed();
}

// ============================================================
// ลบบัญชี
// ============================================================
async function deleteAccount() {
  if (!sb || !currentUser) return;
  if (!confirm('ลบบัญชีและข้อมูลทั้งหมดถาวร?\n\nโพสต์ คำตอบ เพื่อน ข้อความ และงานทั้งหมดจะหายไป กู้คืนไม่ได้')) return;
  if (!confirm('แน่ใจนะ — กดตกลงแล้วลบทันที')) return;

  const { error } = await sb.rpc('delete_account');
  if (error) { showToast({ title: 'ลบไม่สำเร็จ', body: error.message }); return; }
  try { localStorage.clear(); } catch (_) {}
  try { await sb.auth.signOut(); } catch (_) {}
  alert('ลบเรียบร้อยแล้ว ขอบคุณที่เคยใช้');
  location.reload();
}

// ============================================================
// หน้าบอกว่าเก็บอะไร
// ------------------------------------------------------------
// เขียนเป็นภาษาที่นักเรียนอ่านรู้เรื่อง ไม่ใช่ภาษากฎหมายที่ไม่มีใครอ่าน
// นโยบายที่ไม่มีใครอ่านคือนโยบายที่ไม่ได้ทำหน้าที่ของมัน
// ============================================================
function renderPrivacy() {
  const box = document.getElementById('privacyBody');
  if (!box) return;
  box.innerHTML = `
    <div class="cp-top">
      <button class="cp-x" onclick="history.length>1?history.back():go('scr-settings')">${icon('chevron')}</button>
      <b>เราเก็บอะไรของคุณบ้าง</b><span></span>
    </div>
    <div class="pv-scroll">
      <p class="pv-lead">เขียนให้อ่านรู้เรื่อง ไม่ใช่ให้อ่านไม่จบ · ถ้ามีตรงไหนไม่โอเค
        บอกได้ที่หน้าตั้งค่า แล้วลบบัญชีได้ทันทีเหมือนกัน</p>

      <h3 class="pv-h">อยู่ในเครื่องคุณอย่างเดียว</h3>
      <ul class="pv-ul">
        <li>งานทั้งหมด ตารางเรียน เวลาที่จับไว้ สถิติ เหรียญ โทเคน</li>
        <li>ถ้าไม่ล็อกอิน ข้อมูลทั้งหมดไม่เคยออกจากเครื่องเลยสักไบต์</li>
      </ul>

      <h3 class="pv-h">ขึ้นไปเก็บบนเซิร์ฟเวอร์ เมื่อคุณล็อกอิน</h3>
      <ul class="pv-ul">
        <li>อีเมลกับชื่อจากบัญชี Google — ใช้เพื่อรู้ว่าเครื่องไหนเป็นของคุณ</li>
        <li>งานของคุณ (เข้ารหัสอยู่ในบัญชีคุณ) — ใช้ซิงก์ข้ามเครื่อง <b>ไม่มีใครอื่นอ่านได้</b></li>
      </ul>

      <h3 class="pv-h">เพื่อนร่วมห้องเห็นได้</h3>
      <ul class="pv-ul">
        <li>ชื่อ รูป คำแนะนำตัว</li>
        <li>รายชื่อวิชาที่คุณ<b>เลือกเอง</b>ว่าช่วยได้ / อยากให้ช่วย</li>
        <li>โพสต์กับคำตอบที่คุณเขียน (ถ้าเลือก "ไม่ระบุชื่อ" ชื่อจะถูกกลบตั้งแต่ฝั่งเซิร์ฟเวอร์)</li>
        <li>ว่าคุณกำลังเปิดแอปอยู่ไหม และกำลังติววิชาอะไร (ปิดได้ด้วยการปิดแอป)</li>
      </ul>

      <h3 class="pv-h">ไม่เคยเก็บ</h3>
      <ul class="pv-ul">
        <li>วันเกิด — ถามแค่ช่วงอายุ</li>
        <li>ตำแหน่งที่อยู่ เบอร์โทร เลขบัตรประชาชน</li>
        <li>รายชื่อเพื่อนใน LINE หรือข้อความส่วนตัวในไลน์</li>
      </ul>

      <h3 class="pv-h">ใครเข้ามาเจอคุณได้</h3>
      <p class="pv-p">เฉพาะคนที่อยู่ห้องเรียนเดียวกับคุณ ซึ่งเข้ามาได้ทางเดียวคือกดลิงก์
        จากกลุ่ม LINE ของห้อง <b>ไม่มีหน้าค้นหานักเรียน</b> คนนอกจึงไล่หาคุณไม่ได้
        และทักหาคุณไม่ได้</p>

      <h3 class="pv-h">สิทธิ์ของคุณ</h3>
      <ul class="pv-ul">
        <li>ขอดูว่าเรามีอะไรของคุณ — อยู่ในหน้านี้ทั้งหมดแล้ว</li>
        <li>ลบทุกอย่างถาวรได้เอง ที่ตั้งค่า → ลบบัญชี</li>
        <li>รายงานเนื้อหาที่ไม่โอเคได้ทุกชิ้น</li>
      </ul>

      <p class="pv-foot">แอปนี้ทำโดยนักเรียน และยังอยู่ในช่วงทดลอง
        ถ้ามีอะไรผิดพลาด บอกเราแล้วเราจะรีบแก้</p>
    </div>`;
}
