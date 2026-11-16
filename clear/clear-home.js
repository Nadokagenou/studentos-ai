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
    ${shown ? `<p class="clr-lb">ทำอันนี้ก่อน</p>${nowCard(sp, now)}` : ''}
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
    <button class="clr-b clr-cam" onclick="openShot()" aria-label="ถ่ายรูปใบงาน">${icon('camera')}</button>
    <button class="clr-b clr-mic" onclick="go('scr-scan');toggleVoice()" aria-label="พูดเพิ่มงาน">${icon('mic')}</button>
    <button class="clr-b clr-go" onclick="clearCapture()" aria-label="บันทึกงาน">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg></button>
  </div>`;
}

function clearRowHTML(t) {
  const subj = t.subject && t.subject !== 'อื่น ๆ' ? t.subject : '';
  const dueTxt = t.due ? fmtDue(t.due, new Date(), t) : 'ไม่มีกำหนด';
  const late = t.due && new Date(t.due) - Date.now() < 24 * 3.6e6;
  return `<div class="clr-row">
    <button class="clr-ck" onclick="toggleDone('${esc(t.id)}', this)" aria-label="ทำเสร็จแล้ว"></button>
    <button class="clr-tx" onclick="openForm('${esc(t.id)}')">
      <b>${esc(t.detail || t.title || subj || 'งาน')}</b>
      <small>${esc([subj, (t.estMin || 30) + ' นาที'].filter(Boolean).join(' · '))}</small>
    </button>
    <em class="${late ? 'hot' : ''}">${esc(dueTxt)}</em>
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
function clearCapture() {
  const input = document.getElementById('clrIn');
  const text = input ? input.value.trim() : '';
  if (!text) { if (input) input.focus(); return; }

  const cut = typeof cutAssignments === 'function' ? cutAssignments(text) : null;
  if (cut && cut.multi && typeof inboxAdd === 'function') {
    const r = inboxAdd(text, 'text', { via: 'clear-capture' });
    clearCaptureDone(input);
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

  const t = inboxToTask({ parsed, source: 'clear', raw: text, id: null });
  t.createdAt = new Date().toISOString();
  delete t.fromInbox;
  clearCaptureDone(input);
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
