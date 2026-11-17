// ============================================================
// Student OS Clear · หน้าแรก (เฟส 2 · 16 พ.ย. 69)
// ------------------------------------------------------------
// เจตนา: แอปจดงานจริง ๆ — เปิดมา → จดได้ทันที → รู้ว่าทำอะไรก่อน → ติ๊กเสร็จ → เห็นงานถัดไป
// หน้าแรกเหลือ 4 ชิ้น บนลงล่าง (ม็อกอัป A/B/C ที่เจ้าของรับแล้ว):
//   1 หัวจอ        "วันนี้" + วันที่ + เวลาว่าง (headSub ตัวเดิม)
//   2 ช่องจดงาน    พิมพ์ประโยคเดียว → เห็นผลแกะเป็นชิป → Enter = บันทึกเลย
//   3 ทำอันนี้ก่อน  nowCard() ตัวเดิม — อ่านจาก focusPlan() ก้อนเดียวกับทุกจอ ไม่คิดลำดับเอง
//   4 ต่อจากนั้น    งานถัดไปตามลำดับเดิม (sp.later) เท่าที่พอดีจอ + ลิงก์ดูทั้งหมด
//
// ตัวแกะ = parseAssignment (engine.js) · ตัวสร้างงาน = inboxToTask (inbox.js) · ตัวจับซ้ำ = findDuplicate
// ไม่มีทางแกะ/สร้างงานทางที่สอง — งานจากช่องนี้หน้าตาเหมือนงานจาก LINE/แปะข้อความทุกอย่าง
// โหลดก่อน app.js (renderMenu เรียก clearHomeHTML ตอนบูต) · ทุกฟังก์ชันของ app.js ถูกเรียกตอนใช้ ไม่ใช่ตอนโหลด
// ============================================================

const CLEAR_LIST_MAX = 2;   // แถว "ต่อจากนั้น" ที่ยังไม่ทำให้หน้าแรกล้นจอ 375×812 (วัด 16 พ.ย. 69 · 3 แถวล้นใต้แถบล่าง)

function clearHomeHTML(ctx) {
  const { sp, now } = ctx;
  const shown = sp.now ? sp.now.task : null;
  // ลำดับ "ต่อจากนั้น" = ช่องที่จัดไว้ในแผนวันนี้ก่อน (ตามเวลา) แล้วค่อยงานที่ยังไม่ได้ลงช่อง
  // เหมือนรางของหน้าแรกเดิม (dayRail) — ใช้แค่ sp.later จะข้ามงานที่จัดไว้คืนนี้ไปโชว์งานอาทิตย์หน้าแทน
  const next = [];
  for (const sl of sp.plan.slots) if (!sl.break && sl.task && sl.task !== shown && !next.includes(sl.task)) next.push(sl.task);
  for (const t of sp.later) if (t !== shown && !next.includes(t)) next.push(t);
  const total = pendingTasks().length;
  const empty = !total;
  return `
    <header class="clr-head">
      <div><h1>วันนี้</h1><p>${esc(fmtThaiDate(now))}${empty ? '' : ' · ' + headSub(sp)}</p></div>
      <button class="clr-ic" onclick="go('scr-settings')" aria-label="ตั้งค่า">${icon('cog')}</button>
    </header>
    ${clearCaptureHTML(empty)}
    <div id="clrPreview" class="clr-pv" hidden></div>
    ${shown ? `<p class="clr-lb">ทำอันนี้ก่อน</p>${clearNowCard(sp, now)}` : ''}
    ${next.length ? `<p class="clr-lb">ต่อจากนั้น</p>
      <div class="clr-list">${next.slice(0, CLEAR_LIST_MAX).map(clearRowHTML).join('')}</div>` : ''}
    ${total > (shown ? 1 : 0) + Math.min(next.length, CLEAR_LIST_MAX)
      ? `<button class="clr-more" onclick="goTasksTab()">ดูงานทั้งหมด (${total}) ›</button>` : ''}
    ${empty ? `<p class="clr-empty">ยังไม่มีงานค้าง · พิมพ์งานแรกในช่องด้านบน หรือถ่ายรูปใบงาน</p>` : ''}
    ${empty || next.length < CLEAR_LIST_MAX ? clearSetupHTML() : ''}`;
}

// ตารางเรียนยังว่าง = แผนเดาเวลาว่างเอง · ชวนตั้งครั้งเดียว (ตัวเดียวกับการ์ด td-setup ของหน้าแรกเดิม)
// บรรทัดเดียว ไม่ใช่การ์ด — หน้าแรกต้องไม่ล้นจอ และงานต้องเด่นกว่าคำชวน
// โผล่เฉพาะตอนรายการยังไม่เต็ม — รายการเต็มแล้วบรรทัดนี้จมใต้แถบล่าง (วัด 375×812) · ยังเข้าได้จากแท็บฉัน › บริบทของฉัน
function clearSetupHTML() {
  const due = typeof ctxIsEmpty === 'function' && ctxIsEmpty() && typeof openTtScan === 'function';
  return due ? `<button class="clr-setup" onclick="openTtScan()">${icon('scan')}<span>ตั้งตารางเรียน · แผนจะตรงกับเวลาว่างจริง</span>›</button>` : '';
}

function clearCaptureHTML(empty) {
  return `<div class="clr-in">
    <input id="clrIn" type="text" maxlength="500" enterkeyhint="done" autocomplete="off"
      aria-label="จดงานใหม่" placeholder="${empty ? 'จดงาน… เช่น คณิต ส่งพรุ่งนี้' : 'จดงาน…'}"
      oninput="clearPreview()" onkeydown="if(event.key==='Enter'){event.preventDefault();clearCapture();}">
    <button class="clr-b clr-cam" onclick="clearPhoto()" aria-label="ถ่ายรูปใบงาน">${icon('camera')}</button>
    <button class="clr-b clr-mic" onclick="clearVoice()" aria-label="พูดเพิ่มงาน">${icon('mic')}</button>
    <button class="clr-b clr-go" onclick="clearCapture()" aria-label="บันทึกงาน">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg></button>
  </div>`;
}

function clearRowHTML(t) {
  const subj = t.subject && t.subject !== 'อื่น ๆ' ? t.subject : '';
  if (t.done) {
    const at = t.doneAt ? new Date(t.doneAt) : null;
    return `<div class="clr-row done">
    <button class="clr-ck" onclick="toggleDone('${esc(t.id)}', this)" aria-label="ยังไม่เสร็จ (ยกเลิกติ๊ก)">${icon('check')}</button>
    <button class="clr-tx" onclick="openForm('${esc(t.id)}')">
      <b>${esc(t.detail || t.title || subj || 'งาน')}</b>
      <small>${esc([subj, at ? 'เสร็จ ' + fmtClock(at) : 'เสร็จแล้ว'].filter(Boolean).join(' · '))}</small>
    </button>
  </div>`;
  }
  const du = clearDue(t, new Date());
  return `<div class="clr-row">
    <button class="clr-ck" onclick="toggleDone('${esc(t.id)}', this)" aria-label="ทำเสร็จแล้ว"></button>
    <button class="clr-tx" onclick="openForm('${esc(t.id)}')">
      <b>${esc(t.detail || t.title || subj || 'งาน')}</b>
      <small>${esc([subj, (t.estMin || 30) + ' นาที'].filter(Boolean).join(' · '))}</small>
    </button>
    <em class="clr-due ${du.tone}">${du.tone !== 'calm' ? '<i></i>' : ''}${esc(du.word)}</em>
  </div>`;
}

// ---------- ผลแกะสด ๆ ระหว่างพิมพ์ (ม็อกอัป B) ----------
// ให้เห็นก่อนกดว่าแอปเข้าใจว่าอะไร — แกะผิดจะได้แก้ประโยคก่อน ไม่ต้องไปตามแก้ทีหลัง
// ช่องว่าง = ไม่โชว์ · ทั้งหมดเป็นการอ่านล้วน ไม่มีอะไรถูกบันทึกจนกด Enter/ปุ่ม
function clearPreview() {
  const box = document.getElementById('clrPreview');
  const input = document.getElementById('clrIn');
  const text = (input && input.value) || '';
  if (input && input.parentNode) input.parentNode.classList.toggle('typed', !!text.trim());
  if (!box) return;
  if (!text.trim()) { box.hidden = true; box.innerHTML = ''; return; }
  const cut = typeof cutAssignments === 'function' ? cutAssignments(text) : null;
  if (cut && cut.multi) {
    box.hidden = false;
    box.innerHTML = `<span class="clr-pvh">จะแยกเป็น ${cut.segments ? cut.segments.length : 'หลาย'} งาน</span>`;
    return;
  }
  let p;
  try { p = parseAssignment(text, new Date()); } catch (_) { box.hidden = true; return; }
  const chips = [];
  if (p.subject && p.subject !== 'อื่น ๆ') chips.push(p.subject);
  chips.push(p.due ? fmtDue(p.due, new Date()) : 'ยังไม่มีกำหนดส่ง');
  if (p.scorePct != null) chips.push('คะแนน ' + p.scorePct + '%');
  chips.push('~' + (p.estMin || 30) + ' นาที');
  box.hidden = false;
  box.innerHTML = `<span class="clr-pvh">จะบันทึกเป็น</span>
    <div class="clr-chips">${chips.map(c => `<span>${esc(c)}</span>`).join('')}</div>
    ${p.detail ? `<b class="clr-pvd">${esc(p.detail)}</b>` : ''}`;
}

// ---------- บันทึก ----------
// ผู้ใช้พิมพ์เองในช่องจดงาน = ตั้งใจให้เป็นงาน → ไม่ผ่านเกณฑ์ความมั่นใจของกล่องเข้า (AUTO_ACCEPT)
// เกณฑ์นั้นมีไว้กรองข้อความที่ไหลเข้ามาเอง (LINE · แชร์) ไม่ใช่สิ่งที่คนพิมพ์ใส่แอปตรง ๆ
// ซ้ำกับงานที่มีอยู่ = ไม่เพิ่ม บอกว่ามีแล้ว · หลายงานในข้อความเดียว = ส่งให้กล่องเข้าตัดเป็นใบ ๆ ตามเดิม
function clearCapture(via) {
  const input = document.getElementById('clrIn');
  const text = input ? input.value.trim() : '';
  if (!text) { if (input) input.focus(); return; }

  const cut = typeof cutAssignments === 'function' ? cutAssignments(text) : null;
  if (cut && cut.multi && typeof inboxAdd === 'function') {
    const r = inboxAdd(text, 'text', { via: 'clear-capture' });
    clearCaptureDone(input);
    clearCapLog();
    renderAll();
    showToast({ title: 'แยกเป็นหลายงานแล้ว', body: 'ดูและยืนยันในกล่องเข้า',
      action: { label: 'เปิดกล่องเข้า', fn: () => go('scr-inbox') } });
    return r;
  }

  let parsed;
  try { parsed = parseAssignment(text, new Date()); } catch (_) { parsed = null; }
  if (!parsed) { showToast({ title: 'อ่านข้อความนี้ไม่ได้', body: 'ลองพิมพ์ใหม่อีกครั้ง' }); return; }

  const dup = typeof findDuplicate === 'function' ? findDuplicate(parsed) : null;
  if (dup && dup.kind === 'task') {
    showToast({ title: 'มีงานนี้อยู่แล้ว', body: '',
      action: { label: 'เปิดดู', fn: () => openForm(dup.id) } });
    return;
  }

  const t = inboxToTask({ parsed, source: via === 'voice' ? 'clear-voice' : 'clear', raw: text, id: null });
  t.createdAt = new Date().toISOString();
  delete t.fromInbox;
  clearCaptureDone(input);
  clearCapLog();
  save(); renderAll();
  showToast({
    title: 'บันทึกแล้ว', body: [t.subject !== 'อื่น ๆ' && t.subject, t.detail].filter(Boolean).join(' · '),
    undo: () => { state.tasks = state.tasks.filter(x => x.id !== t.id); save(); renderAll(); },
  });
  return t;
}

function clearCaptureDone(input) {
  if (input) { input.value = ''; input.blur(); if (input.parentNode) input.parentNode.classList.remove('typed'); }
  const box = document.getElementById('clrPreview');
  if (box) { box.hidden = true; box.innerHTML = ''; }
}

// ============================================================
// เป้า 30 วินาที: เข้ามา → จด → ออก (รอบ 1 · 16 พ.ย. 69)
// ------------------------------------------------------------
// แอปเปิดจนพิมพ์ได้ ~1.5–2 วิ (วัดแล้ว) · เวลาที่เหลือคือขั้นตอนของคน — ตัดได้เท่าไหร่ตัดเท่านั้น
//   1 เปิดแอป (หรือกลับเข้าแอปหลังหายไปเกิน 1 นาที) บนหน้าแรก = โฟกัสช่องจดงานเลย
//     Android: คีย์บอร์ดขึ้นเอง · iPhone: Safari ไม่ยอมให้เว็บเปิดคีย์บอร์ดเอง ต้องแตะช่องหนึ่งครั้งอยู่ดี
//   2 กดค้างไอคอน → "จดงานด่วน" (?go=quick) = หน้าแรก + โฟกัส + ข้อความจากปุ่มลัด Android (ถ้ามี)
//   3 จดเวลาเปิด→บันทึกของจริงไว้ใน funnel.cap — รู้ว่าผู้ใช้จริงใช้กี่วินาที ไม่ต้องเดา
// ============================================================
let clearOpenedAt = 0;          // 0 = นับจากตอนเริ่มโหลดหน้า (performance.now() เริ่มที่ศูนย์) → รวมเวลาบูต
let clearHiddenAt = 0;
const CLEAR_REOPEN_MS = 60 * 1000;      // หายไปนานกว่านี้แล้วกลับมา = นับเป็นการเปิดใหม่
const CLEAR_SESSION_MAX = 5 * 60 * 1000; // เปิดค้างนานกว่านี้แล้วค่อยจด = ไม่ใช่ "เข้ามาจด" ไม่นับเวลา

function clearAutoFocus() {
  if (typeof curScreen === 'undefined' || curScreen !== 'scr-menu') return;
  const a = document.activeElement;
  if (a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;   // กำลังพิมพ์ที่อื่นอยู่
  const i = document.getElementById('clrIn');
  if (!i || i.offsetParent === null) return;
  try { i.focus({ preventScroll: true }); } catch (_) {}
}

function clearQuickOpen() {
  if (typeof curScreen !== 'undefined' && curScreen !== 'scr-menu') go('scr-menu');
  setTimeout(() => {
    if (typeof shortcutDraftApply === 'function') shortcutDraftApply('quick');
    clearAutoFocus();
  }, 60);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') { clearHiddenAt = Date.now(); return; }
  if (clearHiddenAt && Date.now() - clearHiddenAt > CLEAR_REOPEN_MS) {
    clearOpenedAt = performance.now();
    setTimeout(clearAutoFocus, 120);
  }
});

// เก็บแค่ตัวเลข (ไม่มีข้อความงาน) · ขึ้น cloud ไปกับ funnel ตามเดิม · 30 ค่าล่าสุดพอสำหรับดูแนวโน้ม
function clearCapLog() {
  if (typeof funnel !== 'function') return;
  const ms = performance.now() - clearOpenedAt;
  if (!(ms > 0) || ms > CLEAR_SESSION_MAX) return;
  const f = funnel();
  const c = f.cap = f.cap || { n: 0, u30: 0, last: [] };
  c.n++;
  if (ms <= 30000) c.u30++;
  c.last = (c.last || []).concat(Math.round(ms / 100) / 10).slice(-30);   // วินาที ทศนิยม 1 ตำแหน่ง
  clearOpenedAt = performance.now();      // จดต่อใบที่สองในรอบเดียวกัน = นับจากใบก่อนหน้า
}

// ============================================================
// เป้า 30 วินาที รอบ 2: พูด · ถ่ายรูป (16 พ.ย. 69)
// ============================================================

// ---------- พูดแทนพิมพ์ ในช่องเดิม ----------
// แตะไมค์ → พูด → หยุดพูด = บันทึกเอง (มี "เลิกทำ" ใน toast) · แตะไมค์อีกครั้งระหว่างฟัง = หยุด
// เดิมไมค์พาไปจอสแกน แล้วต้องผ่านจอแกะ → ฟอร์มยืนยัน อีกสองจอ
// เบราว์เซอร์ที่ไม่มีระบบแปลงเสียง = ใช้ทางเดิม (จอสแกน) ซึ่งบอกเหตุผลเองอยู่แล้ว
let clearRecog = null;
function clearVoice() {
  if (clearRecog) { try { clearRecog.stop(); } catch (_) {} return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { go('scr-scan'); if (typeof toggleVoice === 'function') toggleVoice(); return; }
  const input = document.getElementById('clrIn');
  const wrap = input && input.parentNode;
  if (!input) return;
  const r = clearRecog = new SR();
  r.lang = 'th-TH'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let finalText = '', lastInterim = '', failed = '';
  const prevPh = input.placeholder;
  r.onstart = () => { if (wrap) wrap.classList.add('listening'); input.value = ''; input.placeholder = 'กำลังฟัง… พูดได้เลย'; clearPreview(); };
  r.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
    }
    lastInterim = interim;
    input.value = (finalText + interim).trim();
    clearPreview();
  };
  r.onerror = e => {
    failed = {
      'not-allowed': 'ยังไม่ได้อนุญาตให้ใช้ไมค์', 'service-not-allowed': 'ยังไม่ได้อนุญาตให้ใช้ไมค์',
      'no-speech': 'ไม่ได้ยินเสียง ลองพูดใหม่อีกครั้ง', 'audio-capture': 'หาไมโครโฟนไม่เจอ',
      'network': 'ต้องต่อเน็ตเพื่อแปลงเสียงเป็นข้อความ', 'aborted': '',
    }[e.error];
    if (failed === undefined) failed = 'ฟังไม่สำเร็จ ลองอีกครั้ง';
  };
  r.onend = () => {
    clearRecog = null;
    if (wrap) wrap.classList.remove('listening');
    input.placeholder = prevPh;
    // Safari บน iPhone บางทีจบรอบโดยไม่ส่งผล isFinal — เก็บคำที่ขึ้นจอล่าสุดไว้ด้วย (แบบเดียวกับ toggleVoice)
    const raw = (finalText + lastInterim).trim();
    const text = raw && typeof normalizeSpokenText === 'function' ? normalizeSpokenText(raw) : raw;
    if (!text || text.length < 3) {
      input.value = ''; clearPreview();
      if (failed || raw) showToast({ title: failed || 'ได้ยินไม่ชัด ลองพูดใหม่อีกครั้ง', body: '' });
      return;
    }
    input.value = text; clearPreview();
    // เว้นจังหวะให้เห็นผลแกะก่อนบันทึก — แตะช่องแล้วแก้ระหว่างนี้ = ไม่บันทึกเอง
    setTimeout(() => { if (document.activeElement !== input && input.value === text) clearCapture('voice'); }, 700);
  };
  try { input.blur(); r.start(); } catch (_) { clearRecog = null; showToast({ title: 'เริ่มฟังไม่สำเร็จ ลองอีกครั้ง', body: '' }); }
}

// ---------- ถ่ายรูป: ข้ามจอครอบ · AI อ่านครบ = บันทึกเลย ----------
// ทางเดิม: กล้อง → จอครอบ → AI อ่าน → ฟอร์มยืนยัน → บันทึก
// ทาง Clear: กล้อง → AI อ่าน → (ครบ) บันทึกพร้อมเลิกทำ (แก้ = แตะงานบนหน้าแรก) · (ไม่ครบ) ฟอร์มยืนยันเหมือนเดิม
// toast มีปุ่มได้ปุ่มเดียว (showToast: undo มาก่อน action) จึงเลือก "เลิกทำ"
// การขอยินยอมครั้งแรก · ออฟไลน์/ไม่ยินยอม/AI ล้ม = อ่านในเครื่อง → ฟอร์ม ยังเป็นของ readPhoto ทุกอย่าง (ทางสำรองห้ามถอด)
var clearPhotoQuick = false;
function clearPhoto() {
  clearPhotoQuick = true;
  openShot();
}
document.addEventListener('visibilitychange', () => { /* ออกจากแอปกลางทาง = รอบหน้าเริ่มสะอาด */
  if (document.visibilityState === 'hidden' && typeof curScreen !== 'undefined' && !['scr-shot', 'scr-scan', 'scr-crop', 'scr-parsing'].includes(curScreen)) clearPhotoQuick = false;
});

function clearPhotoAutoSave(parsed) {
  if (!clearPhotoQuick) return false;
  clearPhotoQuick = false;
  if (!parsed || !parsed.due || !parsed.detail || !parsed.subject || parsed.subject === 'อื่น ๆ') return false;
  const dup = typeof findDuplicate === 'function' ? findDuplicate(parsed) : null;
  if (dup) return false;                      // ซ้ำ/คล้าย = ให้คนดูฟอร์มเอง
  const t = inboxToTask({ parsed, source: 'clear-photo', raw: parsed.raw || '', id: null });
  t.createdAt = new Date().toISOString();
  delete t.fromInbox;
  clearCapLog();
  save();
  go('scr-menu');
  renderAll();
  showToast({
    title: 'บันทึกจากรูปแล้ว', body: [t.subject, t.detail].filter(Boolean).join(' · '),
    undo: () => { state.tasks = state.tasks.filter(x => x.id !== t.id); save(); renderAll(); },
  });
  return true;
}

// ============================================================
// เป้า 30 วินาที รอบ 3: จดโดยไม่ต้องเปิดแอป (16 พ.ย. 69)
// ------------------------------------------------------------
// LINE · แตะหลังเครื่อง (quick-add) · Classroom/ปฏิทิน มีอยู่แล้วทั้งหมด แต่ลง inbox_items ตัวเดียวกับแอปหลัก
// → แอปไหนเปิดก่อนได้ไป · สวิตช์นี้ให้ผู้ใช้เลือกเองว่า "ของที่ไหลเข้า" ไปที่ Clear (ตาราง inbox_route)
// ฐานข้อมูลย้ายให้เองตอนเขียน (supabase/migrations/20261116130000_clear_inbox_route.sql) — แอปหลักไม่ต้องแก้
// การ์ดอยู่บนสุดของจอตัวเชื่อม (scr-sources) · ทางเข้า: แท็บฉัน › จดงานโดยไม่ต้องเปิดแอป
// ============================================================
let clearRoute = { app: null, missing: false, busy: false, uid: null };

async function clearRouteLoad() {
  if (typeof sb === 'undefined' || !sb || typeof currentUser === 'undefined' || !currentUser) return;
  if (clearRoute.uid === currentUser.id && clearRoute.app) return;
  const uid = currentUser.id;
  const { data, error } = await sb.from('inbox_route').select('app').eq('user_id', uid).maybeSingle();
  if (!currentUser || currentUser.id !== uid) return;
  if (error) { if (error.code === 'PGRST205' || error.code === '42P01') clearRoute.missing = true; return; }
  clearRoute = { app: (data && data.app) || 'main', missing: false, busy: false, uid };
  clearRoutePaint();
}

async function clearRouteSet(app) {
  if (clearRoute.busy || typeof currentUser === 'undefined' || !currentUser) return;
  clearRoute.busy = true; clearRoutePaint();
  const uid = currentUser.id;
  const { error } = await sb.from('inbox_route').upsert({ user_id: uid, app, updated_at: new Date().toISOString() });
  clearRoute.busy = false;
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') clearRoute.missing = true;
    showToast({ title: 'เปลี่ยนไม่สำเร็จ', body: clearRoute.missing ? 'ฐานข้อมูลยังไม่พร้อม' : 'ลองใหม่อีกครั้ง' });
  } else {
    clearRoute.app = app; clearRoute.uid = uid;
    showToast({ title: app === 'clear' ? 'งานที่ส่งเข้ามาจะมาที่ Clear แล้ว' : 'งานที่ส่งเข้ามาจะไปที่แอปหลัก', body: '' });
    if (app === 'clear' && typeof pullInbox === 'function') pullInbox();
  }
  clearRoutePaint();
}

function clearRouteHTML() {
  const logged = typeof currentUser !== 'undefined' && !!currentUser;
  const on = clearRoute.app === 'clear';
  let sub, btn = '';
  if (!logged) sub = 'เข้าสู่ระบบก่อน — งานจาก LINE และปุ่มลัดผูกกับบัญชี';
  else if (clearRoute.missing) sub = 'ยังเปิดไม่ได้ · ฐานข้อมูลยังไม่พร้อม';
  else if (!clearRoute.app) sub = 'กำลังดู…';
  else {
    sub = on ? 'เปิดอยู่ · LINE แตะหลังเครื่อง และ Classroom เข้าแอปนี้ แอปหลักไม่ได้รับ'
      : 'ปิดอยู่ · ตอนนี้ของที่ส่งเข้ามาไปแอปไหนก็ได้ที่เปิดก่อน';
    btn = `<button class="clr-rt-b${on ? ' on' : ''}" ${clearRoute.busy ? 'disabled' : ''}
      onclick="clearRouteSet('${on ? 'main' : 'clear'}')">${on ? 'ปิด' : 'เปิด'}</button>`;
  }
  return `<div class="clr-rt" id="clrRoute"><div><b>ส่งงานที่ส่งเข้ามา มาที่ Clear</b><small>${esc(sub)}</small></div>${btn}</div>`;
}

function clearRoutePaint() {
  const el = document.getElementById('clrRoute');
  if (el) el.outerHTML = clearRouteHTML();
}

if (typeof renderSources === 'function') {
  const baseRenderSources = renderSources;
  // eslint-disable-next-line no-global-assign
  renderSources = function () {
    baseRenderSources.apply(this, arguments);
    const body = document.getElementById('srcBody');
    if (body && !document.getElementById('clrRoute')) body.insertAdjacentHTML('afterbegin', clearRouteHTML());
    clearRouteLoad();
  };
}

// ============================================================
// R2 · การ์ด "ทำอันนี้ก่อน" แบบคริสตัล (17 พ.ย. 69)
// ------------------------------------------------------------
// ข้อมูลเดียวกับ nowCard() ทุกอย่าง (focusPlan → sp.now) · ต่างแค่หน้าตาและป้ายปุ่ม:
//   ปุ่มหลักปุ่มเดียว "เริ่มทำ" · "เสร็จแล้ว" กับ "เลื่อนไปทีหลัง" เป็นปุ่มรองที่มีชื่อ (เดิมเป็นไอคอน ✓ กับนาฬิกาให้เดา)
//   ความด่วน = คำ + จุดสี (เลยกำหนด · วันนี้ · พรุ่งนี้) แทนดาว ★★★★★ ที่อ่านเป็นคะแนนรีวิว
//   เส้นปริซึมบนขอบการ์ด = เอกลักษณ์ของ Clear · มีบนการ์ดใบนี้ใบเดียว
// บรรทัดเหตุผลแตะได้ = กาง "ทำไมอันนี้ก่อน" (แผงเดิม toggleNowWhy · nowWhyHTML จึงคลาสต้องเป็น tn-why-go / tn-why-pane ตามเดิม)
// ============================================================
const CLEAR_DAY_MS = 864e5;
function clearDue(t, now) {
  if (!t.due) return { tone: 'calm', word: 'ไม่มีกำหนด' };
  const d = new Date(t.due);
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / CLEAR_DAY_MS);
  const hhmm = d.getHours() === 23 && d.getMinutes() === 59 ? '' : ' ' + fmtClock(d);
  if (d < now) return { tone: 'late', word: diff === 0 ? 'เลยเวลาแล้ว' : diff === -1 ? 'เลยกำหนด เมื่อวาน' : 'เลยกำหนด' };
  if (diff === 0) return { tone: 'late', word: 'วันนี้' + hhmm };
  if (diff === 1) return { tone: 'soon', word: 'พรุ่งนี้' + hhmm };
  const TH_D = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return { tone: 'calm', word: diff < 7 ? TH_D[d.getDay()] + ' ' + d.getDate() : d.getDate() + '/' + (d.getMonth() + 1) };
}

function clearNowCard(sp, now) {
  const n = sp.now;
  if (!n) return '';
  const t = n.task, info = n.info, slot = n.slot;
  const run = typeof runningWork === 'function' ? runningWork() : null;
  const running = run && run.taskId === t.id;
  const subj = t.subject && t.subject !== 'อื่น ๆ' ? t.subject : 'งาน';
  const du = clearDue(t, now);
  const late = t.due && new Date(t.due) < now;
  const why = !t.due ? 'ยังไม่รู้กำหนดส่ง เลือกให้จากงานที่ค้างนานที่สุด'
    : late ? 'เลยกำหนดมา ' + overdueFor(now - new Date(t.due))
    : topReason(info);
  const whyBits = [why];
  if (t.scorePct != null && !String(why).includes('คะแนน')) whyBits.push('เก็บคะแนน ' + t.scorePct + '%');
  const mins = t.estMin || 30;
  const when = slot ? fmtClock(slot.start) + ' – ' + fmtClock(slot.end || new Date(+slot.start + mins * 6e4)) + ' · ' : '';
  const firstMin = n.step ? (slot && slot.min ? Math.min(n.step.min, slot.min) : n.step.min) : 0;
  const goTx = running ? 'กลับเข้าโหมดโฟกัส' : n.step ? 'เริ่ม ' + firstMin + ' นาทีแรก' : 'เริ่มทำ';
  const prog = Math.max(0, Math.min(100, t.progress || 0));
  const whyOpen = typeof NOW_WHY_OPEN !== 'undefined' && NOW_WHY_OPEN;
  return `<section class="cn${running ? ' running' : ''}">
    <div class="cn-meta"><span class="cn-subj"><i class="cn-dot ${du.tone}"></i>${esc(subj)}</span>
      <span class="clr-due ${du.tone}">${esc(du.tone === 'calm' && t.due ? 'ส่ง ' + du.word : du.word)}</span></div>
    <h2 class="cn-title">${esc(t.detail || 'งานนี้')}</h2>
    <p class="cn-when">${esc(when + 'ประมาณ ' + mins + ' นาที')}</p>
    ${prog > 0 && prog < 100 ? `<div class="cn-bar"><i style="width:${prog}%"></i></div>` : ''}
    ${typeof nowWhyHTML === 'function'
      ? `<button class="tn-why-go cn-why${whyOpen ? ' open' : ''}" aria-expanded="${whyOpen}" onclick="toggleNowWhy(this)"><span>${esc(whyBits.filter(Boolean).join(' · '))}</span>${icon('chevron')}</button>
      <div class="tn-why-pane${whyOpen ? ' open' : ''}" aria-hidden="${!whyOpen}"${whyOpen ? '' : ' inert'}><div class="tn-why-in">${nowWhyHTML(t, now)}</div></div>`
      : `<p class="cn-why">${esc(whyBits.filter(Boolean).join(' · '))}</p>`}
    <button class="cn-go" onclick="startFocus('${esc(t.id)}')">${icon(running ? 'clock' : 'play')}${esc(goTx)}</button>
    <div class="cn-sec">
      <button onclick="toggleDone('${esc(t.id)}', this)">${icon('check')}เสร็จแล้ว</button>
      <button onclick="notNow('${esc(t.id)}')">${icon('clock')}เลื่อนไปทีหลัง</button>
    </div>
    ${!t.due ? `<button class="cn-ask" onclick="openForm('${esc(t.id)}')">${icon('calendar')}ครูสั่งส่งวันไหน — ใส่แล้วแผนแม่นขึ้น</button>` : ''}
  </section>`;
}

// ============================================================
// R3 · แท็บงาน = รายการเดียว แบ่งตามเวลา (17 พ.ย. 69)
// ------------------------------------------------------------
// หน้าแรกบอก "ทำอะไร" · แท็บนี้บอก "มีอะไรบ้าง" — ไม่ซ้ำกัน
// ตัดออก: ตัวเลือกมุมมอง วันนี้/สัปดาห์/รายการ · การ์ด "ควรทำก่อน" (ซ้ำหน้าแรก) · ตัวเลข 3 ช่อง · ดาว
// เหลือ: หัวจอ · ค้นหา · กลุ่ม เลยกำหนด → วันนี้ → พรุ่งนี้ → 7 วันนี้ → หลังจากนั้น → ไม่มีกำหนด → เสร็จวันนี้
// ในกลุ่มเรียงตามกำหนดส่ง (ไม่ใช่คะแนนความสำคัญ — "ทำอะไรก่อน" เป็นงานของหน้าแรก)
// ถังขยะ/ทั้งหมดที่เสร็จ ยังเป็นมุมมองเดิมของ renderTasks (taskFilter = 'bin' · 'done')
// ============================================================
let clearTaskQ = '';
function clearTasksHTML() {
  const live = liveTasks();
  const pend = live.filter(t => !t.done);
  const now = new Date();
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const today = day(now);
  const doneToday = live.filter(t => t.done && t.doneAt && day(new Date(t.doneAt)) === today);
  return `<div class="clr-tasks">
    <header class="clr-head"><div><h1>งานทั้งหมด</h1>
      <p>ค้าง ${pend.length}${doneToday.length ? ' · เสร็จวันนี้ ' + doneToday.length : ''}</p></div></header>
    <div class="clr-srch">${icon('search')}<input id="clrTq" type="search" placeholder="ค้นหา" aria-label="ค้นหางาน"
      value="${esc(clearTaskQ)}" oninput="clearTaskQ=this.value;clearTasksPaint()"></div>
    <div id="clrTaskGroups">${clearTaskGroupsHTML()}</div>
    <div class="clr-foot">
      <button onclick="taskFilter='done';renderTasks()">งานที่เสร็จแล้วทั้งหมด</button>
      <button onclick="taskFilter='bin';renderTasks()">ถังขยะ</button>
    </div>
  </div>`;
}

function clearTaskGroupsHTML() {
  const now = new Date();
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const today = day(now);
  const q = clearTaskQ.trim();
  const live = liveTasks().filter(t => !q || (typeof matchTask === 'function' ? matchTask(t, q) : true));
  const byDue = (a, b) => new Date(a.due) - new Date(b.due);
  const G = [
    { k: 'late', label: 'เลยกำหนด', tone: 'late', rows: [] },
    { k: 'today', label: 'วันนี้', rows: [] },
    { k: 'tmr', label: 'พรุ่งนี้', rows: [] },
    { k: 'week', label: '7 วันนี้', rows: [] },
    { k: 'later', label: 'หลังจากนั้น', rows: [] },
    { k: 'none', label: 'ไม่มีกำหนดส่ง', rows: [] },
  ];
  for (const t of live) {
    if (t.done) continue;
    if (!t.due) { G[5].rows.push(t); continue; }
    const d = new Date(t.due), diff = Math.round((day(d) - today) / CLEAR_DAY_MS);
    G[d < now ? 0 : diff <= 0 ? 1 : diff === 1 ? 2 : diff <= 7 ? 3 : 4].rows.push(t);
  }
  G.forEach(g => { if (g.k !== 'none') g.rows.sort(byDue); });
  const done = live.filter(t => t.done && t.doneAt && day(new Date(t.doneAt)) === today)
    .sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  G.push({ k: 'done', label: 'เสร็จวันนี้', tone: 'done', rows: done });
  const html = G.filter(g => g.rows.length).map(g => `
    <div class="clr-grp ${g.tone || ''}"><span>${esc(g.label)}</span><span>${g.rows.length}</span></div>
    <div class="clr-list">${g.rows.map(clearRowHTML).join('')}</div>`).join('');
  return html || `<p class="clr-empty">${q ? 'ไม่เจองานที่ตรงกับ "' + esc(q) + '"' : 'ไม่มีงานค้าง · จดงานใหม่ได้ที่หน้าแรก'}</p>`;
}

// พิมพ์ค้นหา = วาดใหม่แค่ส่วนรายการ — ช่องค้นหาไม่ถูกวาดทับ คีย์บอร์ดไม่หุบ
function clearTasksPaint() {
  const box = document.getElementById('clrTaskGroups');
  if (box) box.innerHTML = clearTaskGroupsHTML();
}

// ============================================================
// R4 · แท็บฉัน = บัญชี + ตั้งค่าที่ใช้จริง 5 หมวด (17 พ.ย. 69)
// ------------------------------------------------------------
// เดิม: ห้อง/เหรียญตรา/ต่อเนื่อง · เช็คอินรับโทเคน · กราฟ · ร้านค้า · เพื่อน · อันดับ · ข่าว · Pro (ส่วนใหญ่ถูกตัดไปแล้ว)
// ตอนนี้: การ์ดบัญชี → จดงาน → เวลา → แจ้งเตือน → หน้าตา → อื่น ๆ · ทุกแถวบอกค่าปัจจุบัน แตะแล้วไปที่ที่แก้ได้
// ของเดิมใน .pf-body ยังอยู่ (ซ่อนด้วย clear.css) เพราะ renderProfile ยังเขียนลงช่องพวกนั้น
// "วิชาของฉัน" ไม่มีในนี้: ตัวแก้วิชาอยู่ในจอโปรไฟล์โซเชียล (scr-people) ที่ตัดไปแล้ว — เพิ่มวิชายังทำได้ในฟอร์มงาน
// ============================================================
function clearProfileHTML() {
  const logged = typeof currentUser !== 'undefined' && !!currentUser && !currentUser.is_anonymous;
  const name = (typeof who === 'function' && who()) || (typeof accountName === 'function' && accountName()) || '';
  const mail = logged && currentUser.email ? currentUser.email : '';
  const face = typeof headFace === 'function' ? headFace() : '';
  const notifOk = ('Notification' in window) && Notification.permission === 'granted' && (typeof notifOn !== 'function' || notifOn());
  const themeVal = typeof THEME_NAME === 'object' && typeof themePref === 'function' ? THEME_NAME[themePref()] : '';
  const fontVal = typeof FONT_NAME === 'object' && typeof fontPref === 'function' ? FONT_NAME[fontPref()] : '';
  const hours = state.settings && state.settings.freeHours != null ? state.settings.freeHours + ' ชม.' : '';
  const ctxEmpty = typeof ctxIsEmpty === 'function' && ctxIsEmpty();
  const row = (ic, label, val, go, cls = '') => `<button class="clr-pr ${cls}" onclick="${go}">
      <span class="clr-pr-ic">${icon(ic)}</span><span class="clr-pr-lb">${esc(label)}</span>
      ${val ? `<span class="clr-pr-v">${esc(val)}</span>` : ''}${icon('chevron')}</button>`;
  const grp = (title, rows) => `<p class="clr-grp"><span>${esc(title)}</span></p><div class="clr-prg">${rows.join('')}</div>`;
  return `
    <header class="clr-head"><div><h1>ฉัน</h1></div></header>
    <div class="clr-acc">
      <span class="clr-av">${face ? `<img src="${esc(face)}" alt="">` : esc((name || 'ฉ').slice(0, 1))}</span>
      <div class="clr-acc-tx"><b>${esc(name || 'ยังไม่ได้ตั้งชื่อ')}</b>
        <small>${esc(logged ? (mail || 'เข้าสู่ระบบแล้ว') : 'ยังไม่ได้เข้าสู่ระบบ')}</small></div>
      ${logged ? `<button class="clr-acc-b ghost" onclick="go('scr-settings')">บัญชี</button>`
        : `<button class="clr-acc-b" onclick="go('scr-login')">เข้าสู่ระบบ</button>`}
    </div>
    ${grp('จดงาน', [
      row('zap', 'จดงานโดยไม่ต้องเปิดแอป', '', "go('scr-sources')"),
    ])}
    ${grp('เวลา', [
      row('calendar', 'ตารางเรียน · เวลาว่าง', ctxEmpty ? 'ยังไม่ได้ตั้ง' : 'ตั้งแล้ว', "go('scr-context')", ctxEmpty ? 'todo' : ''),
      row('clock', 'เวลาทำงานต่อวัน', hours, "go('scr-settings')"),
    ])}
    ${grp('แจ้งเตือน', [
      row('bell', 'การแจ้งเตือน', notifOk ? 'เปิดอยู่' : 'ปิดอยู่', "go('scr-settings')", notifOk ? '' : 'todo'),
    ])}
    ${grp('หน้าตา', [
      row('contrast', 'ธีม', themeVal, "openSetOpt('theme')"),
      row('type', 'ขนาดตัวอักษร', fontVal, "openSetOpt('font')"),
    ])}
    ${grp('อื่น ๆ', [
      row('chart', 'สรุปงานที่ทำ', '', "go('scr-stats')"),
      row('flag', 'รายงานปัญหาแอป', '', 'openBugReports()'),
      row('cog', 'ตั้งค่าทั้งหมด', '', "go('scr-settings')"),
    ])}
    <p class="clr-ver">${esc(typeof APP_VERSION === 'string' ? 'Student OS Clear ' + APP_VERSION + (typeof APP_CODENAME === 'string' && APP_CODENAME ? ' “' + APP_CODENAME + '”' : '') : '')}</p>`;
}
function clearProfilePaint() {
  const box = document.getElementById('clrProf');
  if (box) box.innerHTML = clearProfileHTML();
}
