// Reports stay in memory; account changes invalidate all in-flight responses.
const BUG_CATEGORIES = { tasks: 'งานและแผน', scan: 'สแกนและเพิ่มงาน', sync: 'บัญชีและการซิงก์', notifications: 'แจ้งเตือน', display: 'หน้าจอและการใช้งาน', other: 'อื่น ๆ' };
const BUG_STATUSES = { open: 'ใหม่', reviewing: 'กำลังตรวจ', needs_info: 'ต้องการข้อมูลเพิ่ม', resolved: 'แก้แล้ว' };
let bugOwner = null, bugEpoch = 0, bugLoadSeq = 0, bugBusy = false, bugPending = null, bugOffset = 0;
const bugReplyPending = new Map();
const bugEl = id => document.getElementById(id);
const bugEscape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function bugMessage(text, error = false) {
  const el = bugEl('bugMessage');
  el.textContent = text; el.classList.toggle('bug-error', error);
}
function bugAccountChanged(reload = true) {
  const owner = currentUser?.id || null;
  if (owner === bugOwner) return;
  bugOwner = owner; bugEpoch++; bugLoadSeq++; bugBusy = false; bugPending = null; bugOffset = 0; bugReplyPending.clear();
  bugEl('bugForm').reset(); bugEl('bugList').replaceChildren(); bugMessage('');
  bugEl('bugSend').disabled = !owner;
  bugEl('bugPrev').disabled = true; bugEl('bugNext').disabled = true;
  bugEl('bugLoginHint').hidden = !!owner;
  if (reload && curScreen === 'scr-bugs') void loadBugReports();
}
function openBugReports() { go('scr-bugs'); }
function bugReportsEnter() { bugAccountChanged(false); void loadBugReports(); }
function bugPayload() {
  return {
    category: bugEl('bugCategory').value,
    page: bugEl('bugPage').value,
    summary: bugEl('bugSummary').value.trim(),
    detail: bugEl('bugDetail').value.trim(),
    steps: bugEl('bugSteps').value.trim(),
    expected: bugEl('bugExpected').value.trim(),
    diagnostics: bugEl('bugDiagnostics').checked ? { version: APP_VERSION, display_mode: matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser' } : null,
  };
}
function bugError(error) {
  const msg = String(error?.message || '');
  if (msg.includes('BUG_RATE_LIMIT')) return 'วันนี้ส่งครบจำนวนที่กำหนดแล้ว ลองใหม่ภายหลังครับ';
  if (msg.includes('BUG_NOT_AWAITING_REPLY')) return 'สถานะเรื่องนี้เปลี่ยนแล้ว กดอัปเดตสถานะก่อนครับ';
  if (msg.includes('BUG_INVALID')) return 'กรุณาตรวจช่องที่กรอกและความยาวข้อความครับ';
  if (msg.includes('BUG_AUTH')) return 'กรุณาเข้าสู่ระบบอีกครั้งครับ';
  return 'ยังทำรายการไม่สำเร็จ ข้อความยังอยู่ ลองใหม่ได้ครับ';
}
async function submitBugReport(event) {
  event.preventDefault(); bugAccountChanged();
  if (!currentUser || !sb || bugBusy || !bugEl('bugForm').reportValidity()) return;
  const payload = bugPayload(), key = JSON.stringify(payload);
  if (!bugPending || bugPending.key !== key) bugPending = { key, id: crypto.randomUUID() };
  const epoch = bugEpoch, owner = currentUser.id;
  bugBusy = true; bugEl('bugSend').disabled = true; bugMessage('กำลังส่งเรื่อง…');
  try {
    const { error } = await sb.rpc('submit_bug_report', { p_request_id: bugPending.id, p_payload: payload });
    if (epoch !== bugEpoch || currentUser?.id !== owner) return;
    if (error) throw error;
    bugPending = null; bugEl('bugForm').reset(); bugOffset = 0;
    bugMessage('ส่งเรื่องแล้วครับ ดูความคืบหน้าได้ใน “เรื่องของฉัน”');
    await loadBugReports();
  } catch (error) { if (epoch === bugEpoch && currentUser?.id === owner) bugMessage(bugError(error), true); }
  finally { if (epoch === bugEpoch && currentUser?.id === owner) { bugBusy = false; bugEl('bugSend').disabled = false; } }
}
async function loadBugReports() {
  const list = bugEl('bugList'), owner = currentUser?.id;
  if (!owner || !sb) { list.textContent = 'เข้าสู่ระบบเพื่อส่งเรื่องและดูความคืบหน้าครับ'; return; }
  const epoch = bugEpoch, seq = ++bugLoadSeq;
  list.textContent = 'กำลังอ่านเรื่องของคุณ…';
  try {
    const { data, error } = await sb.rpc('my_bug_reports', { p_offset: bugOffset });
    if (epoch !== bugEpoch || currentUser?.id !== owner || seq !== bugLoadSeq) return;
    if (error) throw error;
    list.innerHTML = data.items?.length ? data.items.map(bugReportHTML).join('') : '<p>ยังไม่มีเรื่องที่ส่งครับ</p>';
    bugEl('bugPrev').disabled = bugOffset === 0; bugEl('bugNext').disabled = !data.has_more;
  } catch { if (epoch === bugEpoch && currentUser?.id === owner && seq === bugLoadSeq) { list.textContent = 'ยังอ่านสถานะไม่ได้ครับ กดอัปเดตสถานะเพื่อลองอีกครั้ง'; bugEl('bugNext').disabled = true; } }
}
function bugReportHTML(report) {
  const esc = bugEscape;
  const latest = (report.events || []).filter(e => e.author_kind === 'staff' && e.reply).at(-1);
  return `<article class="bug-item"><div class="bug-item-head"><h3>${esc(report.summary)}</h3><span class="bug-status">${esc(BUG_STATUSES[report.status] || report.status)}</span></div><p class="bug-meta">${esc(BUG_CATEGORIES[report.category])} · ${esc(report.page)} · ${esc(new Date(report.created_at).toLocaleDateString('th-TH'))}</p>${latest ? `<h4>ข้อความล่าสุดจากทีม</h4><p class="bug-text">${esc(latest.reply)}</p>` : ''}<details><summary>รายละเอียดและประวัติล่าสุด</summary><p class="bug-text">${esc(report.detail)}</p><h4>ขั้นตอนที่ทำ</h4><p class="bug-text">${esc(report.steps)}</p>${report.expected ? `<h4>สิ่งที่คาดหวัง</h4><p class="bug-text">${esc(report.expected)}</p>` : ''}<ol class="bug-history">${(report.events || []).map(e => `<li><b>${esc(e.author_kind === 'reporter' ? 'คุณ' : 'ทีม Student OS')} · ${esc(BUG_STATUSES[e.status])}</b><time>${esc(new Date(e.created_at).toLocaleString('th-TH'))}</time>${e.reply ? `<p class="bug-text">${esc(e.reply)}</p>` : ''}</li>`).join('')}</ol></details>${report.status === 'needs_info' ? `<form class="bug-reply" onsubmit="replyBugReport(event, '${esc(report.id)}')"><label for="bugReply-${esc(report.id)}">เพิ่มข้อมูลให้ทีม<textarea id="bugReply-${esc(report.id)}" required minlength="5" maxlength="1500" rows="3" placeholder="ตอบคำถามของทีม โดยไม่ใส่ข้อมูลส่วนตัว"></textarea></label><button class="bug-button" type="submit">ส่งข้อมูลเพิ่ม</button><p role="status"></p></form>` : ''}</article>`;
}
async function replyBugReport(event, id) {
  event.preventDefault();
  if (!currentUser || !sb) return;
  const form = event.target, button = form.querySelector('button'), message = form.querySelector('[role="status"]');
  if (button.disabled || !form.reportValidity()) return;
  const reply = form.querySelector('textarea').value.trim(), owner = currentUser.id, epoch = bugEpoch;
  const prior = bugReplyPending.get(id);
  const request = prior?.reply === reply ? prior : { reply, id: crypto.randomUUID() };
  bugReplyPending.set(id, request); button.disabled = true; message.textContent = 'กำลังส่ง…';
  try {
    const { error } = await sb.rpc('reply_bug_report', { p_request_id: request.id, p_report_id: id, p_reply: reply });
    if (epoch !== bugEpoch || currentUser?.id !== owner) return;
    if (error) throw error;
    bugReplyPending.delete(id); await loadBugReports();
  } catch (error) { if (epoch === bugEpoch && currentUser?.id === owner) message.textContent = bugError(error); }
  finally { if (epoch === bugEpoch && currentUser?.id === owner) button.disabled = false; }
}
function bugPage(direction) { bugOffset = Math.max(0, bugOffset + direction * 20); void loadBugReports(); }
