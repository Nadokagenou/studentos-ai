// ============================================================
// คลังงาน (Task Vault) · รูปโจทย์ · งานที่ทำเสร็จ · โน้ต · จดไว้ · พอร์ต
// ------------------------------------------------------------
// สเปก: alt/docs/superpowers/specs/2026-10-31-task-vault-design.md · แผน: alt/docs/superpowers/plans/2026-10-31-task-vault.md
// เจ้าของ (31 ต.ค. – 1 พ.ย. 69): "เปิดหน้าที่เก็บข้อมูลแบบแอป Notion" → "ปรับให้มันเก็บข้อมูลได้ด้วยนะ" → "สร้างคลังในแอปเลย"
//
// ทำไมรายการรูป (t.files) กับโน้ต (t.note) อยู่ในงาน ไม่ใช่ตารางใหม่:
// งานซิงก์ รวมสามทาง (syncMergeById) และย้ายตามบัญชีตอนสลับ (stashAccount/swapInAccount) อยู่แล้ว
// ใส่ลงงานจึงได้ทั้งหมดนี้ฟรี · ราคาที่จ่าย: แก้งานเดียวกันพร้อมกันสองเครื่อง = รายการรูปของเครื่องหนึ่งหาย
// (ไฟล์ยังอยู่บนคลาวด์ แล้วถูกเก็บกวาดเป็นไฟล์กำพร้า — vaultOrphans)
//
// ไฟล์รูปจริง: bucket ปิด 'task-files' path '<uid>/<fileId>.jpg' (migration 20261031120000_task_files.sql)
// ในเครื่อง: IndexedDB 'studentos-files' — ทั้งแคชและคิวส่ง · ไม่แตะคีย์ studentos.alt.* เลย
// โหลดก่อน app.js · เรียก global ของแอป (state · save · currentUser · sb · go …) ตอนรันเท่านั้น
// ============================================================

const VAULT_CAP = 300;                    // รูปต่อบัญชี (สเปกข้อ 5 · เจ้าของเปลี่ยนได้)
const VAULT_SWEEP_GRACE_MS = 86400000;    // เก็บกวาดเฉพาะไฟล์กำพร้าที่เก่ากว่าหนึ่งวัน — อีกเครื่องอาจเพิ่งอัปโหลดแต่งานยังซิงก์มาไม่ถึง
const VAULT_BUCKET = 'task-files';
const VAULT_KINDS = ['q', 'done', 'note'];
const VAULT_MAX_SIDE = 1600;

// ---------- แกนข้อมูล (ไม่แตะ DOM · IndexedDB · Supabase — vault-check.cjs เทสต์ตรง) ----------
function vaultFiles(t) { return (t && Array.isArray(t.files)) ? t.files : []; }

function vaultNewId() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6).padEnd(4, '0');
}

function vaultAddMeta(t, meta) {
  if (!Array.isArray(t.files)) t.files = [];
  t.files.push(meta);
  return meta;
}

// ลบใบสุดท้ายแล้วถอดช่องทิ้ง — งานที่ไม่มีรูปต้องหน้าตาเหมือนงานที่ไม่เคยมีรูป (ลายนิ้วมือซิงก์ไม่เปลี่ยนเปล่า ๆ)
function vaultRemoveMeta(t, id) {
  const list = vaultFiles(t), i = list.findIndex(m => m.id === id);
  if (i < 0) return null;
  const [m] = list.splice(i, 1);
  if (!list.length) delete t.files;
  return m;
}

// นับทุกงานรวมงานในถังขยะ — งานในถังยังเก็บรูปไว้ (กู้คืนแล้วรูปต้องกลับมาครบ) จึงกินพื้นที่จริง
function vaultCount(tasks) {
  let files = 0, withFiles = 0;
  for (const t of tasks || []) { const k = vaultFiles(t).length; files += k; if (k) withFiles++; }
  return { files, tasks: withFiles };
}
function vaultCapLeft(tasks) { return Math.max(0, VAULT_CAP - vaultCount(tasks).files); }
function vaultSheetPlan(n, left) { const take = Math.max(0, Math.min(n, left)); return { take, skip: n - take }; }

function vaultShrinkSize(w, h) {
  const k = Math.min(1, VAULT_MAX_SIDE / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

function vaultPath(uid, id) { return uid + '/' + id + '.jpg'; }

// objects = ผลของ storage.list(uid) · คืน path เต็มของไฟล์ที่ไม่มีงานไหนอ้างถึง (รวมงานในถัง) และเก่ากว่าวัน
function vaultOrphans(objects, tasks, uid, nowMs) {
  const owned = new Set();
  for (const t of tasks || []) for (const m of vaultFiles(t)) owned.add(m.id);
  return (objects || [])
    .filter(o => o && /\.jpg$/.test(o.name))
    .filter(o => !owned.has(o.name.replace(/\.jpg$/, '')))
    .filter(o => nowMs - Date.parse(o.created_at) > VAULT_SWEEP_GRACE_MS)
    .map(o => vaultPath(uid, o.name.replace(/\.jpg$/, '')));
}

// มีในเครื่อง = local · ไม่มีแต่ขึ้นคลาวด์แล้ว = cloud · ไม่มีทั้งคู่ = อีกเครื่องถ่ายไว้แต่ยังไม่ได้ส่ง (elsewhere)
function vaultThumbState(meta, hasLocal) {
  if (hasLocal) return 'local';
  return meta && meta.up ? 'cloud' : 'elsewhere';
}

// หน้าคลัง (ต้นแบบ 1 พ.ย. 69): "ทำต่อ" เรียงตามกำหนดส่ง ไม่มีกำหนดไว้ท้าย · "ส่งแล้ว" ใหม่สุดก่อน · งานในถังไม่ขึ้น
function vaultGroups(tasks, subj) {
  const live = (tasks || []).filter(t => t && !t.deleted && (!subj || t.subject === subj));
  const due = t => { const ms = Date.parse(t.due); return Number.isFinite(ms) ? ms : Infinity; };
  const at = t => Date.parse(t.doneAt) || 0;
  return {
    pend: live.filter(t => !t.done).sort((a, b) => due(a) - due(b)),
    done: live.filter(t => t.done).sort((a, b) => at(b) - at(a)),
  };
}

// ============================================================
// ที่เก็บในเครื่อง — IndexedDB 'studentos-files' ก้อนเดียวที่แตะ indexedDB
// ------------------------------------------------------------
// blobs: { id, owner, blob, at, pending } · owner = uid หรือ 'guest' (สลับบัญชีแล้วอ่านได้เฉพาะของตัวเอง)
// deletes: { path, owner } คิวลบบนคลาวด์ที่ยังลบไม่ได้ (ออฟไลน์) · meta: { key, value } เช่นวันเก็บกวาดล่าสุด
// เป็น var ไม่ใช่ const โดยตั้งใจ — vault-check.cjs สลับทั้งก้อนเป็นตัวจำลองในหน่วยความจำ
// ============================================================
var VaultStore = (() => {
  let dbp = null, asked = false;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('studentos-files', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('blobs', { keyPath: 'id' }).createIndex('owner', 'owner');
      d.createObjectStore('deletes', { keyPath: 'path' });
      d.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const run = async (store, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode), req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = t.onabort = () => rej(t.error);
    });
  };
  return {
    getBlob: id => run('blobs', 'readonly', s => s.get(id)).then(r => r || null),
    putBlob: rec => {
      // ครั้งแรกที่เก็บรูป ขอให้เบราว์เซอร์ไม่ล้างที่เก็บเอง (iPhone ล้าง IndexedDB ของเว็บที่ไม่ได้เปิด 7 วัน)
      if (!asked) { asked = true; try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {} }
      return run('blobs', 'readwrite', s => s.put(rec));
    },
    delBlob: id => run('blobs', 'readwrite', s => s.delete(id)),
    blobsOf: owner => run('blobs', 'readonly', s => s.index('owner').getAll(owner)),
    queueDelete: (path, owner) => run('deletes', 'readwrite', s => s.put({ path, owner })),
    deletesOf: owner => run('deletes', 'readonly', s => s.getAll()).then(l => (l || []).filter(x => x.owner === owner)),
    doneDelete: path => run('deletes', 'readwrite', s => s.delete(path)),
    getMeta: key => run('meta', 'readonly', s => s.get(key)).then(r => (r ? r.value : undefined)),
    setMeta: (key, value) => run('meta', 'readwrite', s => s.put({ key, value })),
  };
})();

// ---------- ใครถือรูป · เจ้าของในเครื่อง ----------
function vaultOwner() { return (typeof currentUser !== 'undefined' && currentUser && currentUser.id) || 'guest'; }
function vaultCloudUser() {
  return typeof currentUser !== 'undefined' && currentUser && currentUser.id && typeof sb !== 'undefined' && sb && sb.storage ? currentUser.id : null;
}
// ของที่มีรูปได้: งาน + ผลงานในพอร์ต (งาน 8) — ทั้งคู่ถือรูปในช่อง files แบบเดียวกัน
function vaultHolders() { return ((state && state.tasks) || []).concat((state && state.portfolio) || []); }
function vaultFindHolder(id) { return vaultHolders().find(h => h && h.id === id) || null; }

async function vaultLocalBlob(id) {
  const rec = await VaultStore.getBlob(id);
  return rec && rec.owner === vaultOwner() ? rec.blob : null;
}

// เพิ่มรูปที่ย่อแล้ว — เคารพเพดาน (เก็บเท่าที่เหลือ บอกจำนวนที่ข้าม) · เก็บในเครื่องก่อนเสมอ แล้วค่อยส่ง
async function vaultAddPhotos(holderId, items, kind) {
  const h = vaultFindHolder(holderId);
  if (!h) return { saved: 0, skipped: items.length };
  const plan = vaultSheetPlan(items.length, vaultCapLeft(vaultHolders())), owner = vaultOwner();
  for (const it of items.slice(0, plan.take)) {
    const id = vaultNewId(), at = Date.now();
    await VaultStore.putBlob({ id, owner, blob: it.blob, at, pending: true });
    vaultAddMeta(h, { id, kind, w: it.w, h: it.h, bytes: it.blob.size, at, up: false });
  }
  if (plan.take) { save(); vaultSync(); }
  return { saved: plan.take, skipped: plan.skip };
}

// ---------- ส่งขึ้น · ลบตามคิว · เก็บกวาด — ทำทีละรอบ ไม่ซ้อนกัน ----------
// เรียกซ้ำระหว่างรอบ = ได้ promise ของรอบที่กำลังวิ่ง และนัดวิ่งอีกรอบเมื่อจบ (ของที่เพิ่มกลางรอบไม่ตกหล่น)
let vaultRun = null, vaultAgain = false;
function vaultSync() {
  if (vaultRun) { vaultAgain = true; return vaultRun; }
  vaultRun = (async () => {
    do {
      vaultAgain = false;
      const uid = vaultCloudUser();
      if (!uid) break;
      try { await vaultUploadPending(uid); await vaultFlushDeletes(uid); await vaultSweep(uid); }
      catch (e) { console.warn('[vault] sync:', e && e.message); }
    } while (vaultAgain);
  })().finally(() => { vaultRun = null; });
  return vaultRun;
}

async function vaultUploadPending(uid) {
  const bucket = sb.storage.from(VAULT_BUCKET);
  for (const h of vaultHolders()) for (const m of vaultFiles(h).slice()) {
    if (m.up || m.localOnly) continue;
    const rec = await VaultStore.getBlob(m.id);
    if (!rec || rec.owner !== uid) continue;            // อีกเครื่องถ่ายไว้ (ยังไม่ส่งจากเครื่องนั้น) หรือของบัญชีอื่น
    let ok = false;
    try {
      const { error } = await bucket.upload(vaultPath(uid, m.id), rec.blob, { contentType: 'image/jpeg' });
      // 409 = ไฟล์นี้ขึ้นไปแล้ว (รอบก่อนส่งสำเร็จแต่ปิดแอปก่อนได้จดว่า up) — ถือว่าสำเร็จ
      ok = !error || String(error.statusCode) === '409' || /exist/i.test(String(error.message || ''));
    } catch (_) { ok = false; }                         // ออฟไลน์ · เน็ตหลุด = ไว้รอบหน้า
    if (!ok) continue;
    // สลับบัญชีระหว่างส่ง: งานชิ้นนี้ไม่อยู่ใน state ปัจจุบันแล้ว — ห้ามเขียนอะไรลงข้อมูลของบัญชีใหม่
    if (vaultOwner() !== uid || !vaultHolders().includes(h)) return;
    m.up = true;
    rec.pending = false;
    await VaultStore.putBlob(rec);
    save();
  }
}

async function vaultRemoveCloud(ids) {
  const uid = vaultCloudUser();
  if (!ids.length || !uid) return;
  const paths = ids.map(id => vaultPath(uid, id));
  let ok = false;
  try { const { error } = await sb.storage.from(VAULT_BUCKET).remove(paths); ok = !error; } catch (_) {}
  if (!ok) for (const p of paths) await VaultStore.queueDelete(p, uid);
}

async function vaultFlushDeletes(uid) {
  const q = await VaultStore.deletesOf(uid);
  if (!q.length) return;
  try {
    const { error } = await sb.storage.from(VAULT_BUCKET).remove(q.map(d => d.path));
    if (!error) for (const d of q) await VaultStore.doneDelete(d.path);
  } catch (_) {}
}

async function vaultSweep(uid) {
  const key = 'sweep:' + uid, last = await VaultStore.getMeta(key);
  if (last && Date.now() - last < VAULT_SWEEP_GRACE_MS) return;
  const { data, error } = await sb.storage.from(VAULT_BUCKET).list(uid, { limit: 1000 });
  if (error) return;
  const gone = vaultOrphans(data || [], vaultHolders(), uid, Date.now());
  if (gone.length) await sb.storage.from(VAULT_BUCKET).remove(gone);
  await VaultStore.setMeta(key, Date.now());
}

// ทางเดียวของ "ลบรูป" — ออกจากงานก่อน (จอเปลี่ยนทันที) แล้วค่อยตามลบในเครื่องและบนคลาวด์
async function vaultDeleteFile(holderId, fileId) {
  const h = vaultFindHolder(holderId), m = h && vaultRemoveMeta(h, fileId);
  if (!m) return;
  save();
  vaultForgetUrl(fileId);
  await VaultStore.delBlob(fileId);
  if (m.up) await vaultRemoveCloud([fileId]);
}

// เรียกก่อนเอางานออกจาก state ถาวร (ล้างถังขยะ · ลบถาวร · อยู่ในถังเกิน 30 วัน) — งานที่แค่ลงถังไม่แตะรูป
async function vaultForgetTasks(tasks) {
  const ms = [].concat(...(tasks || []).map(vaultFiles));
  for (const m of ms) { vaultForgetUrl(m.id); await VaultStore.delBlob(m.id); }
  await vaultRemoveCloud(ms.filter(m => m.up).map(m => m.id));
}

// ใช้แบบไม่ล็อกอินแล้วล็อกอิน — งานตามขึ้นบัญชีอยู่แล้ว (adoptAccountIfNeeded) รูปในเครื่องต้องตามไปด้วย
async function vaultAdoptGuest(uid) {
  for (const rec of await VaultStore.blobsOf('guest')) { rec.owner = uid; await VaultStore.putBlob(rec); }
}

// ลบบัญชี — delete_account() ไม่ลบไฟล์ใน storage ให้ (ไม่มี cascade) จึงต้องลบทั้งโฟลเดอร์เองก่อน
async function vaultWipeCloud() {
  const uid = vaultCloudUser();
  if (!uid) return { left: 0 };
  let left = 0;
  try {
    const { data } = await sb.storage.from(VAULT_BUCKET).list(uid, { limit: 1000 });
    const paths = (data || []).map(o => uid + '/' + o.name);
    if (paths.length) {
      let ok = false;
      try { const { error } = await sb.storage.from(VAULT_BUCKET).remove(paths); ok = !error; } catch (_) {}
      if (!ok) left = paths.length;
    }
  } catch (_) {}
  for (const rec of await VaultStore.blobsOf(uid)) await VaultStore.delBlob(rec.id);
  return { left };
}

// ---------- URL ของรูป: ในเครื่องก่อน · ไม่มีค่อยขอ signed URL แล้วเก็บแคช ----------
const vaultUrls = new Map();
function vaultForgetUrl(id) {
  const u = vaultUrls.get(id);
  if (u) { try { URL.revokeObjectURL(u); } catch (_) {} vaultUrls.delete(id); }
}
async function vaultUrl(meta) {
  if (vaultUrls.has(meta.id)) return vaultUrls.get(meta.id);
  let blob = await vaultLocalBlob(meta.id);
  if (!blob) {
    const uid = vaultCloudUser();
    if (!meta.up || !uid) return null;
    try {
      const { data, error } = await sb.storage.from(VAULT_BUCKET).createSignedUrl(vaultPath(uid, meta.id), 3600);
      if (error || !data) return null;
      const res = await fetch(data.signedUrl);
      if (!res.ok) return null;
      blob = await res.blob();
      await VaultStore.putBlob({ id: meta.id, owner: uid, blob, at: Date.now(), pending: false });
    } catch (_) { return null; }
  }
  const u = URL.createObjectURL(blob);
  vaultUrls.set(meta.id, u);
  return u;
}

if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', () => vaultSync());

// ============================================================
// จอ — หน้าตาตามต้นแบบที่เจ้าของเลือก 1 พ.ย. 69 (alt/docs/superpowers/mockups/2026-10-31-task-vault-prototype.html)
// ------------------------------------------------------------
// คลัง: ชิปวิชา → เพิ่งเพิ่ม → ทำต่อ (แกลเลอรี) → ส่งแล้ว (แถวเบา) → พื้นที่ที่ใช้
// หน้างาน: การ์ดหัว + เส้นสายสี่สาย (Illustration Fluid Rendering ของ Cult UI · MIT) เข้า โจทย์ · ทำเสร็จ · โน้ต · จดไว้
// ชิปวิชาใช้ .cp-chip ของแอป (กระจกตามธีม) · การ์ด = Notion Gallery บนเปลือกกระจกตระกูล Halo ของ Cult UI
// รูปขึ้นทีหลัง (vaultUrl เป็น async) — วาดช่องก่อน แล้วค่อยเติมภาพ (vaultHydrate) จอจึงไม่รอเน็ต
// ============================================================
const VAULT_KIND_NAME = { q: 'โจทย์', done: 'ทำเสร็จ', note: 'โน้ต', port: 'ผลงาน' };
let vaultFrom = 'scr-profile', vaultSubj = null, vaultTaskId = null, vaultGoWrapped = false;
const vEsc = s => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s));
const vIcon = (n, c) => (typeof icon === 'function' ? icon(n, c) : '');

function vaultWrapGo() {
  // ออกจากจอไหนก็ตาม (ปุ่มกลับ · แถบล่าง · ปุ่มย้อนของเครื่อง) ตัวดูรูป/แผ่นเพิ่มรูปต้องปิดตาม ไม่ค้างทับจออื่น
  if (vaultGoWrapped || typeof window.go !== 'function') return;
  vaultGoWrapped = true;
  const g = window.go;
  window.go = function (...a) { vaultCloseOverlays(); return g.apply(this, a); };
}

function openVault(from) {
  vaultWrapGo();
  if (from) vaultFrom = from;
  renderVault();
  go('scr-vault');
}
function vaultBack() { go(vaultFrom || 'scr-profile'); }

function vaultTitle(t) { return t.detail || (typeof taskTitleText === 'function' ? taskTitleText(t) : '') || 'งานของฉัน'; }
function vaultDue(t, now) {
  if (t.done) return 'ส่งแล้ว';
  if (!t.due || typeof fmtDue !== 'function') return '';
  return fmtDue(t.due, now, t).replace(/^⚠\s*/, '');
}

function renderVault() {
  const box = document.getElementById('vtBody');
  if (!box) return;
  vaultPaintTop();
  if (vaultTab === 'port') { renderPort(); return; }   // สวิตช์ งาน · พอร์ต (งาน 8)
  const now = new Date(), tasks = (state && state.tasks) || [];
  const subjects = [...new Set(tasks.filter(t => !t.deleted && t.subject).map(t => t.subject))];
  if (vaultSubj && !subjects.includes(vaultSubj)) vaultSubj = null;
  const g = vaultGroups(tasks, vaultSubj);
  const live = tasks.filter(t => !t.deleted);
  const all = vaultHolders(), cnt = vaultCount(all);
  const sum = document.getElementById('vtSum');
  if (sum) sum.textContent = `${live.length} งาน · ${vaultCount(live).files} รูป`;

  // 1) ชิปวิชา — "ทั้งหมด" ก่อน · แตะซ้ำที่ชิปที่เลือกอยู่ = กลับไปทั้งหมด
  const chip = (s, label, n) => `<button type="button" class="cp-chip vt-chip${(vaultSubj || '') === (s || '') ? ' on' : ''}" data-vs="${vEsc(s || '')}" aria-pressed="${(vaultSubj || '') === (s || '')}">`
    + (s ? `<i class="${typeof subjClass === 'function' ? subjClass(s) : ''}"></i>` : '') + `${vEsc(label)}<small>${n}</small></button>`;
  const chips = chip(null, 'ทั้งหมด', live.length) + subjects.map(s => chip(s, s, live.filter(t => t.subject === s).length)).join('');

  // 2) เพิ่งเพิ่ม — รูปของงาน (ไม่รวมพอร์ต) ใหม่สุดก่อน 8 รูป · ไม่มีรูป = ซ่อนทั้งส่วน
  const recent = [];
  for (const t of live) if (!vaultSubj || t.subject === vaultSubj) for (const m of vaultFiles(t)) recent.push({ t, m });
  recent.sort((a, b) => b.m.at - a.m.at).splice(8);

  const card = (t, i) => {
    const fs = vaultFiles(t), cover = fs.find(m => m.kind === 'q') || fs[0], tone = typeof dueTone === 'function' ? dueTone(t, now) : '';
    return `<button type="button" class="vt-card ${typeof subjClass === 'function' ? subjClass(t.subject) : ''}" data-vt="${vEsc(t.id)}" style="--i:${i}">`
      + `<span class="vt-cov"${cover ? ` data-f="${vEsc(cover.id)}" data-h="${vEsc(t.id)}"` : ''}>${cover ? '' : vIcon('book', 'vt-big')}`
      + (fs.length ? `<span class="vt-badge">${vIcon('camera')}${fs.length}</span>` : '')
      + (t.note ? `<span class="vt-badge n" title="มีโน้ต">${vIcon('pencil')}</span>` : '') + '</span>'
      + `<span class="vt-cb"><b>${vEsc(vaultTitle(t))}</b><span class="vt-meta"><i></i>${vEsc(t.subject || 'ไม่มีวิชา')}</span>`
      + `<span class="vt-due${tone ? ' ' + tone : ''}">${vEsc(vaultDue(t, now))}</span></span></button>`;
  };
  const row = (t, i) => {
    const k = vaultFiles(t).length;
    return `<button type="button" class="vt-row ${typeof subjClass === 'function' ? subjClass(t.subject) : ''}" data-vt="${vEsc(t.id)}" style="--i:${i}">`
      + `<span class="vt-dot">${vIcon('check')}</span><span class="vt-rt"><b>${vEsc(vaultTitle(t))}</b>`
      + `<small>${vEsc(t.subject || 'ไม่มีวิชา')} · ${k ? k + ' รูป' : 'ยังไม่มีรูป'}</small></span><em>ส่งแล้ว</em></button>`;
  };
  const used = cnt.files, pend = all.reduce((a, h) => a + vaultFiles(h).filter(m => !m.up).length, 0);
  const bytes = all.reduce((a, h) => a + vaultFiles(h).reduce((b, m) => b + (m.bytes || 0), 0), 0);
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  box.innerHTML = `<div class="vt-chips" role="group" aria-label="กรองตามวิชา">${chips}</div>`
    + (recent.length ? `<section class="vt-sec"><h3>เพิ่งเพิ่ม</h3><div class="vt-recent">${recent.map((r, i) =>
        `<button type="button" class="vt-rc ${typeof subjClass === 'function' ? subjClass(r.t.subject) : ''}" data-vt="${vEsc(r.t.id)}" data-vf="${vEsc(r.m.id)}" style="--i:${i}" aria-label="เปิดรูป${VAULT_KIND_NAME[r.m.kind] || ''}">`
        + `<span data-f="${vEsc(r.m.id)}" data-h="${vEsc(r.t.id)}"></span><small>${VAULT_KIND_NAME[r.m.kind] || ''}</small></button>`).join('')}</div></section>` : '')
    + `<section class="vt-sec"><h3>ทำต่อ<small>${g.pend.length}</small></h3><div class="vt-gal">`
    + (g.pend.length ? g.pend.map(card).join('') : '<div class="vt-none">ไม่มีงานค้าง' + (vaultSubj ? 'ในวิชานี้' : '') + '</div>') + '</div></section>'
    + (g.done.length ? `<section class="vt-sec"><h3>ส่งแล้ว<small>${g.done.length}</small></h3>${g.done.map(row).join('')}</section>` : '')
    + `<div class="vt-meter"><div class="vt-mt"><span>ใช้พื้นที่ ${used}/${VAULT_CAP} รูป</span><span>${used ? kb(bytes) : 'ยังว่าง'}</span></div>`
    + `<div class="vt-bar"><i style="transform:scaleX(${Math.min(1, used / VAULT_CAP)})"></i></div>`
    + `<small>${pend ? `รอส่งขึ้นคลาวด์ ${pend} รูป · ต่อเน็ตแล้วส่งเอง` : used ? 'ขึ้นคลาวด์ครบแล้ว · เปิดได้ทุกเครื่องที่ล็อกอิน' : 'รูปที่เก็บจะเปิดได้ทุกเครื่องที่ล็อกอิน'}</small></div>`;
  vaultHydrate(box);
}

// เติมรูปลงช่องที่วาดไว้ (data-f = id รูป · data-h = เจ้าของ) · รูปที่อีกเครื่องยังไม่ได้ส่ง = ป้ายบอก ไม่ใช่รูปพัง
function vaultHydrate(root) {
  for (const el of root.querySelectorAll('[data-f]')) {
    const h = vaultFindHolder(el.dataset.h), m = h && vaultFiles(h).find(x => x.id === el.dataset.f);
    if (!m) continue;
    vaultUrl(m).then(u => {
      if (u) { el.style.backgroundImage = `url("${u}")`; el.classList.add('has-img'); }
      else if (!m.up) { el.classList.add('vt-away'); el.dataset.away = 'รอส่งจากเครื่องที่ถ่าย'; }
      else el.classList.add('vt-miss');
    });
  }
}

// ---------- หน้างาน ----------
const VAULT_RAILS = [['q', 'โจทย์ · ใบงาน', '#2BB59B'], ['done', 'งานที่ทำเสร็จ', '#3E8EF0'], ['note', 'โน้ต · สไลด์', '#8B6CF0']];
function openVaultTask(id, hiKind) {
  vaultWrapGo();
  vaultTaskId = id;
  renderVaultTask(hiKind);
  go('scr-vault-task');
  requestAnimationFrame(vaultDrawRails);
}
function renderVaultTask(hiKind) {
  const box = document.getElementById('vtTask'), t = vaultFindHolder(vaultTaskId);
  if (!box || !t) return;
  const now = new Date(), fs = vaultFiles(t), wait = fs.filter(m => !m.up && !m.localOnly).length, local = fs.filter(m => m.localOnly).length;
  const ttl = document.getElementById('vtTaskTitle');
  if (ttl) ttl.textContent = t.subject || 'งาน';
  box.innerHTML = `<div class="vt-hub ${typeof subjClass === 'function' ? subjClass(t.subject) : ''}"><span class="vt-chipsj"><i></i>${vEsc(t.subject || 'ไม่มีวิชา')}</span>`
    + `<b>${vEsc(vaultTitle(t))}</b><small>${vEsc(vaultDue(t, now))}${t.estMin ? ' · ~' + Math.round(t.estMin) + ' นาที' : ''}</small></div>`
    + `<div class="vt-list" id="vtRails"><svg class="vt-rails" aria-hidden="true"></svg>`
    + VAULT_RAILS.map(([k, name, c]) => {
      const list = fs.filter(m => m.kind === k);
      const strip = list.length || k !== 'done'
        ? list.map(m => `<button type="button" class="vt-th" data-vv="${vEsc(m.id)}" data-f="${vEsc(m.id)}" data-h="${vEsc(t.id)}" aria-label="ดูรูป${VAULT_KIND_NAME[k]}"></button>`).join('')
          + `<button type="button" class="vt-add" data-va="${k}"><b>+</b>เพิ่ม</button>`
        : `<button type="button" class="vt-dash" data-va="done">ยังไม่มีรูป <span>+ ถ่าย</span></button>`;
      return `<div class="vt-rc-card${k === hiKind ? ' hi' : ''}" data-c="${c}" data-kind="${k}"><div class="vt-h"><i style="background:${c}"></i>${name}`
        + `<small>${list.length ? list.length + ' รูป' : k === 'done' ? 'ถ่ายก่อนส่ง' : ''}</small></div><div class="vt-strip">${strip}</div></div>`;
    }).join('')
    + `<div class="vt-rc-card" data-c="#E5484D"><div class="vt-h"><i style="background:#E5484D"></i>จดไว้<small class="vt-saved" id="vtSaved">บันทึกแล้ว ✓</small></div>`
    + `<textarea class="vt-note" id="vtNote" rows="3" placeholder="แตะเพื่อจด เช่น ข้อ 7 ถามครูก่อน">${vEsc(t.note || '')}</textarea></div></div>`
    + `<p class="vt-store">${fs.length ? `เก็บแล้ว ${fs.length} รูป${wait ? ` · รอส่ง ${wait} รูป` : ''}${local ? ` · เฉพาะเครื่องนี้ ${local} รูป` : wait ? '' : ' · ขึ้นคลาวด์ครบ'}` : ''}</p>`
    // งานที่ทำเสร็จแล้ว → ส่งเข้าพอร์ตได้ (งาน 8) · เหรียญไม่ใช่ดาว — ทองไว้ของที่สำเร็จจริงเท่านั้น
    + (t.done && vaultOn() ? `<button type="button" class="btn secondary vt-toport" data-ptask>${vIcon('medal')}ส่งเข้าพอร์ต</button>` : '');
  const cta = document.getElementById('vtStart');
  if (cta) cta.hidden = !!(t.done || t.deleted || !(state.tasks || []).includes(t));
  vaultHydrate(box);
  requestAnimationFrame(vaultDrawRails);
}

// เส้นสาย: เส้นที่ i วิ่งลงจากใต้การ์ดหัว แล้วโค้งรัศมี 8 เข้าจุดต่อของการ์ดใบที่ i · ใบบนสุดได้เส้นขวาสุด เส้นจึงไม่ตัดกัน
function vaultDrawRails() {
  const list = document.getElementById('vtRails');
  if (!list) return;
  const svg = list.querySelector('.vt-rails'), cards = [...list.querySelectorAll('.vt-rc-card')], box = list.getBoundingClientRect(), n = cards.length;
  if (!box.width) return;
  svg.setAttribute('viewBox', '0 -14 ' + box.width + ' ' + (box.height + 14));
  svg.innerHTML = cards.map((c, i) => {
    const r = c.getBoundingClientRect(), cy = r.top - box.top + 20, x = 6 + (n - 1 - i) * 6, end = r.left - box.left - 4.5;
    return `<path d="M${x} -14V${cy - 8}Q${x} ${cy} ${x + 8} ${cy}H${end}" stroke="${c.dataset.c}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }).join('');
}
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', () => requestAnimationFrame(vaultDrawRails));

// ---------- เพิ่มรูป: เลือกได้หลายรูป → แผ่นยืนยันเลือกประเภททั้งชุด → ย่อทีละรูป → เก็บ ----------
let vaultPending = [], vaultKind = 'q', vaultFor = null;
function vaultPick(kind, holderId) {
  vaultKind = kind || 'q';
  vaultFor = holderId || vaultTaskId;
  const inp = document.getElementById('vtPick');
  if (inp) { inp.value = ''; inp.click(); }
}
function vaultTakeMore() { const c = document.getElementById('vtCam'); if (c) { c.value = ''; c.click(); } }
function vaultOnFiles(files) {
  for (const f of files || []) if (f && /^image\//.test(f.type)) vaultPending.push({ f, url: URL.createObjectURL(f) });
  if (!vaultPending.length) return;
  vaultPaintSheet();
  const sh = document.getElementById('vtSheet');
  if (sh) sh.hidden = false;
}
function vaultPaintSheet() {
  const sh = document.getElementById('vtSheet');
  if (!sh) return;
  const left = vaultCapLeft(vaultHolders()), n = vaultPending.length;
  sh.innerHTML = `<div class="vt-dim" data-vclose></div><div class="vt-sheet"><div class="vt-grab"></div>`
    + `<h4>เพิ่ม ${n} รูป</h4><p>${n > left ? `คลังเหลือที่ ${left} รูป · จะเก็บ ${left} รูปแรก` : 'ย่อรูปในเครื่องก่อนเก็บ · เปิดได้ทุกเครื่องที่ล็อกอิน'}</p>`
    + `<div class="vt-strip">${vaultPending.map(p => `<span class="vt-th has-img" style="background-image:url('${p.url}')"></span>`).join('')}</div>`
    + ((state.portfolio || []).some(x => x.id === vaultFor) ? ''   // ผลงานในพอร์ตมีรูปประเภทเดียว — ไม่ต้องเลือก
      : `<div class="vt-kinds">${[['q', 'โจทย์', 'ใบงาน/หนังสือ'], ['done', 'ทำเสร็จ', 'ก่อนส่ง'], ['note', 'โน้ต', 'สไลด์/จดเอง']].map(([k, a, b]) =>
        `<button type="button" class="vt-k${k === vaultKind ? ' on' : ''}" data-vk="${k}">${a}<small>${b}</small></button>`).join('')}</div>`)
    + `<div class="vt-two"><button type="button" class="btn secondary" data-vmore>ถ่าย/เลือกเพิ่ม</button>`
    + `<button type="button" class="btn primary" id="vtSave"${left ? '' : ' disabled'}>${left ? `บันทึก ${Math.min(n, left)} รูป` : 'คลังเต็ม'}</button></div></div>`;
}
function vaultCloseSheet() {
  for (const p of vaultPending) { try { URL.revokeObjectURL(p.url); } catch (_) {} }
  vaultPending = [];
  const sh = document.getElementById('vtSheet');
  if (sh) { sh.hidden = true; sh.innerHTML = ''; }
}
async function vaultSaveSheet() {
  const btn = document.getElementById('vtSave');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const take = vaultPending.slice(0, vaultCapLeft(vaultHolders())), items = [];
  let bad = 0;
  for (let i = 0; i < take.length; i++) {
    // ทีละรูป ไม่ใช่ Promise.all — เครื่องเล็กย่อรูป 12MP สิบรูปพร้อมกันแล้วค้าง (Review Focus ข้อ 1)
    btn.textContent = `กำลังย่อรูป ${i + 1}/${take.length}`;
    try { items.push(await vaultShrink(take[i].f)); } catch (_) { bad++; }
  }
  const r = await vaultAddPhotos(vaultFor, items, vaultKind);
  const skip = vaultPending.length - take.length + r.skipped;
  vaultCloseSheet();
  if (typeof showToast === 'function' && (skip || bad)) {
    showToast({ title: skip ? `คลังเต็ม · เก็บ ${r.saved} รูป` : `เก็บ ${r.saved} รูป`,
      body: [skip ? `ไม่ได้เก็บ ${skip} รูป · ลบรูปเก่าก่อนแล้วเพิ่มใหม่` : '', bad ? `อ่านรูปไม่ได้ ${bad} รูป` : ''].filter(Boolean).join(' · ') });
  }
  if (typeof haptic === 'function' && r.saved) haptic('done');
  vaultRefresh(vaultKind);
}
function vaultRefresh(hiKind) {
  if (document.getElementById('scr-vault-task')?.classList.contains('on')) renderVaultTask(hiKind);
  if (document.getElementById('scr-vault')?.classList.contains('on')) renderVault();
  if (typeof vaultPortRefresh === 'function') vaultPortRefresh();
}

// ย่อด้านยาวไม่เกิน 1600px → JPEG 0.82 · เกิน 1MB (เพดานของ bucket) ลองใหม่ที่ 0.7
// อ่านรูปด้วย createImageBitmap ก่อน — img.decode() ค้างตลอดตอนหน้าถูกซ่อน (เจอในพรีวิว 1 พ.ย. 69)
// และ Android ซ่อนหน้าแอปชั่วครู่ทุกครั้งที่เปิดแกลเลอรีเลือกรูป · createImageBitmap หมุนรูปตาม EXIF ให้ด้วย
async function vaultShrink(file) {
  let src = null, url = null;
  try {
    if (typeof createImageBitmap === 'function') {
      try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { src = null; }
    }
    if (!src) {
      url = URL.createObjectURL(file);
      src = new Image();
      src.src = url;
      await src.decode();
    }
    const W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
    const s = vaultShrinkSize(W, H), c = document.createElement('canvas');
    c.width = s.w; c.height = s.h;
    c.getContext('2d').drawImage(src, 0, 0, s.w, s.h);
    let blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .82));
    if (blob && blob.size > 1048576) blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .7));
    if (!blob) throw new Error('encode');
    return { blob, w: s.w, h: s.h };
  } finally {
    if (url) URL.revokeObjectURL(url);
    if (src && typeof src.close === 'function') src.close();
  }
}

// ---------- ดูรูปเต็มจอ — ซ้อนได้ทั้งบนหน้างานและบนโหมดโฟกัส · ลบ = แตะสองครั้ง ----------
let vaultView_ = { h: null, list: [], i: 0, sure: false };
function vaultView(fileId, holderId) {
  const h = vaultFindHolder(holderId || vaultTaskId) || vaultHolders().find(x => vaultFiles(x).some(m => m.id === fileId));
  if (!h) return;
  const m = vaultFiles(h).find(x => x.id === fileId);
  if (!m) return;
  vaultView_ = { h, list: vaultFiles(h).filter(x => x.kind === m.kind), i: 0, sure: false };
  vaultView_.i = vaultView_.list.indexOf(m);
  const v = document.getElementById('vtViewer');
  if (v) v.hidden = false;
  vaultPaintViewer();
}
function vaultPaintViewer() {
  const v = document.getElementById('vtViewer'), S = vaultView_, m = S.list[S.i];
  if (!v || !m) return;
  v.innerHTML = `<div class="vt-vtop"><button type="button" class="sh-btn" data-vclose aria-label="ปิด">${vIcon('chevron')}</button>`
    + `<span>${VAULT_KIND_NAME[m.kind] || ''} ${S.i + 1}/${S.list.length}</span><span class="vt-vsp"></span></div>`
    + `<div class="vt-vimg"><img alt="" id="vtVImg"></div>`
    + `<div class="vt-vbot"><button type="button" data-vprev${S.i ? '' : ' disabled'}>ก่อนหน้า</button>`
    + `<button type="button" class="vt-del${S.sure ? ' sure' : ''}" data-vdel>${S.sure ? 'แตะอีกครั้งเพื่อลบ' : 'ลบรูปนี้'}</button>`
    + `<button type="button" data-vnext${S.i < S.list.length - 1 ? '' : ' disabled'}>ถัดไป</button></div>`;
  vaultUrl(m).then(u => {
    const img = document.getElementById('vtVImg');
    if (img && u) img.src = u;
    else if (img) img.replaceWith(Object.assign(document.createElement('p'), { className: 'vt-vmiss', textContent: m.up ? 'โหลดรูปไม่ได้ · ลองใหม่ตอนต่อเน็ต' : 'รอส่งจากเครื่องที่ถ่าย' }));
  });
}
async function vaultViewerDelete() {
  const S = vaultView_;
  if (!S.sure) { S.sure = true; vaultPaintViewer(); return; }
  const m = S.list[S.i];
  await vaultDeleteFile(S.h.id, m.id);
  S.list.splice(S.i, 1);
  S.sure = false;
  vaultRefresh();
  if (!S.list.length) { vaultCloseViewer(); return; }
  S.i = Math.min(S.i, S.list.length - 1);
  vaultPaintViewer();
}
function vaultCloseViewer() { const v = document.getElementById('vtViewer'); if (v) { v.hidden = true; v.innerHTML = ''; } }
function vaultCloseOverlays() { vaultCloseViewer(); vaultCloseSheet(); }

// จดไว้ — บันทึกลง t.note หลังหยุดพิมพ์ 0.4 วิ (ซิงก์ไปกับงาน · ช่องค้นหางานค้นช่องนี้อยู่แล้ว)
let vaultNoteT = 0;
function vaultNoteInput(el) {
  clearTimeout(vaultNoteT);
  vaultNoteT = setTimeout(() => {
    const t = vaultFindHolder(vaultTaskId);
    if (!t) return;
    const v = el.value.trim();
    if (v) t.note = el.value; else delete t.note;
    save();
    const s = document.getElementById('vtSaved');
    if (s) { s.classList.add('on'); setTimeout(() => s.classList.remove('on'), 1200); }
  }, 400);
}

// ---------- ตัวรับการแตะทั้งหมด (ผูกครั้งเดียวตอนโหลดหน้า) ----------
function vaultBind() {
  const vb = document.getElementById('vtBody'), tk = document.getElementById('vtTask');
  const sh = document.getElementById('vtSheet'), v = document.getElementById('vtViewer');
  if (vb) vb.addEventListener('click', e => {
    const c = e.target.closest('[data-vs]');
    if (c) { const s = c.dataset.vs || null; vaultSubj = s && s !== vaultSubj ? s : null; if (typeof haptic === 'function') haptic('tap'); renderVault(); return; }
    const r = e.target.closest('[data-vf]');
    if (r) { openVaultTask(r.dataset.vt); vaultView(r.dataset.vf, r.dataset.vt); return; }
    const t = e.target.closest('[data-vt]');
    if (t) openVaultTask(t.dataset.vt);
  });
  if (tk) {
    tk.addEventListener('click', e => {
      const a = e.target.closest('[data-va]');
      if (a) { vaultPick(a.dataset.va); return; }
      const th = e.target.closest('[data-vv]');
      if (th) vaultView(th.dataset.vv, vaultTaskId);
    });
    tk.addEventListener('input', e => { if (e.target.id === 'vtNote') vaultNoteInput(e.target); });
  }
  if (sh) sh.addEventListener('click', e => {
    if (e.target.closest('[data-vclose]')) { vaultCloseSheet(); return; }
    if (e.target.closest('[data-vmore]')) { vaultTakeMore(); return; }
    const k = e.target.closest('[data-vk]');
    if (k) { vaultKind = k.dataset.vk; vaultPaintSheet(); return; }
    if (e.target.closest('#vtSave')) vaultSaveSheet();
  });
  if (v) {
    v.addEventListener('click', e => {
      if (e.target.closest('[data-vclose]')) vaultCloseViewer();
      else if (e.target.closest('[data-vprev]') && vaultView_.i > 0) { vaultView_.i--; vaultView_.sure = false; vaultPaintViewer(); }
      else if (e.target.closest('[data-vnext]') && vaultView_.i < vaultView_.list.length - 1) { vaultView_.i++; vaultView_.sure = false; vaultPaintViewer(); }
      else if (e.target.closest('[data-vdel]')) vaultViewerDelete();
    });
    let sx = null;
    v.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    v.addEventListener('touchend', e => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx;
      sx = null;
      if (Math.abs(dx) < 50) return;
      const S = vaultView_, j = S.i + (dx < 0 ? 1 : -1);
      if (j >= 0 && j < S.list.length) { S.i = j; S.sure = false; vaultPaintViewer(); }
    });
  }
  for (const id of ['vtPick', 'vtCam']) {
    const inp = document.getElementById(id);
    if (inp) inp.addEventListener('change', e => vaultOnFiles(e.target.files));
  }
}
if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vaultBind);
  else vaultBind();
}

// แถว "คลังงาน" ในแท็บ "ฉัน" — บรรทัดรองบอกค่าที่มีอยู่ (เกณฑ์เดียวกับแถววิชาของฉัน) · ปิดฟีเจอร์ = ซ่อนแถว
function vaultPaintRow() {
  const row = document.getElementById('peVault');
  if (!row) return;
  const on = typeof sosFeature !== 'function' || sosFeature('vault');
  row.hidden = !on;
  const ct = document.getElementById('peVaultCt');
  if (!ct || !on) return;
  const c = vaultCount(((state && state.tasks) || []).filter(t => !t.deleted));
  ct.textContent = c.files ? `${c.files} รูป · ${c.tasks} งาน` : '';
}

// ---------- โหมดโฟกัส (งาน 6) ----------
const vaultOn = () => typeof sosFeature !== 'function' || sosFeature('vault');

// แถว "ดูโจทย์" — โผล่เฉพาะงานที่มีรูปโจทย์ · ไม่มีรูป = จอโฟกัสเหมือนเดิมทุกพิกเซล (คืน '')
function vaultFocusPeek(t) {
  const q = vaultFiles(t).filter(m => m.kind === 'q');
  if (!q.length || !vaultOn()) return '';
  return `<button type="button" class="vt-peek" onclick="vaultPeek('${vEsc(t.id)}')">`
    + `<span class="vt-th" data-f="${vEsc(q[0].id)}" data-h="${vEsc(t.id)}"></span>`
    + `<span class="vt-pk"><b>โจทย์ ${q.length} รูป</b><small>แตะเพื่อดูเต็มจอ · เวลายังเดิน</small></span><span class="vt-go">ดูโจทย์</span></button>`;
}
// ตัวชี้วัดของสเปก: นับครั้งที่เปิดดูโจทย์ระหว่างโฟกัส · เก็บในข้อมูลของบัญชี ไม่ส่งรูปหรือชื่องานไปไหน
function vaultPeek(taskId) {
  const t = vaultFindHolder(taskId), q = vaultFiles(t).find(m => m.kind === 'q');
  if (!t || !q) return;
  const s = state.settings || (state.settings = {});
  s.vaultStats = Object.assign({ peek: 0 }, s.vaultStats);
  s.vaultStats.peek += 1;
  save();
  vaultView(q.id, taskId);
}
// จอ "เสร็จแล้ว" — ปุ่มรองชวนถ่ายงานก่อนส่ง · อยู่ท้ายแถวปุ่ม ไม่แทรกก่อน "ทำต่อเลย" (ลูกโซ่หลักของวิสัยทัศน์)
function vaultDoneOffer(t) {
  if (!t || !vaultOn() || vaultFiles(t).some(m => m.kind === 'done')) return '';
  return `<button type="button" class="fc-later vt-shoot" onclick="vaultShootDone('${vEsc(t.id)}')">${vIcon('camera')}ถ่ายงานที่ทำเสร็จ</button>`;
}
// เรียกจากการแตะเท่านั้น — ช่องเลือกไฟล์ต้องเปิดในจังหวะเดียวกับนิ้วแตะ ไม่งั้นเบราว์เซอร์มือถือบล็อก
function vaultShootDone(id) {
  if (typeof closeFocus === 'function') closeFocus(true);
  openVaultTask(id, 'done');
  vaultPick('done', id);
}

// ============================================================
// พอร์ต (งาน 8 · สเปกข้อ 10) — เจ้าของ 1 พ.ย. 69: "ทำให้มีระบบเก็บพอร์ตด้วย" → ทั้งหมวดผลงาน TCAS และส่งงานที่ทำเสร็จเข้าไป · ทำ PDF ด้วย
// ------------------------------------------------------------
// หมวด = 6 หมวดของ TCASfolio (ทปอ.) · สูงสุด 40 รายการตามระบบนั้น · ระบบนั้นรับแต่พิมพ์กรอก → ปุ่ม "คัดลอกข้อความ"
// ผลงานอยู่ใน state.portfolio (ซิงก์ด้วยระบบเดิม · cloudPull ใน app.js) · รูปผลงานใช้คิว/bucket เดียวกับรูปงาน (kind 'port')
// PDF: วาดหน้า A4 ลง canvas (เบราว์เซอร์ตัดคำ/วางสระไทยถูกเอง) → JPEG → ห่อเป็นไฟล์ PDF เอง ไม่ใช้ไลบรารี · ตัวหนังสือใน PDF เลือกไม่ได้
// ============================================================
const PORT_CATS = [
  ['essay', 'เรียงความ · เหตุผลที่สมัคร', '#8B6CF0'],
  ['letter', 'หนังสือรับรอง', '#3E8EF0'],
  ['project', 'โครงการ · โครงงาน', '#2BB59B'],
  ['activity', 'กิจกรรม', '#E0663A'],
  ['award', 'เกียรติบัตร · รางวัล', '#C2410C'],
  ['extra', 'คำถามเพิ่มเติมจากมหาวิทยาลัย', '#8593AB'],
];
const PORT_CAP = 40, PORT_PDF_MAX = 10;   // 10 หน้า = เกณฑ์ที่หลายมหาวิทยาลัยใช้ (มหิดล ฯลฯ) · แต่ละคณะต่างกันได้ เปลี่ยนที่นี่ที่เดียว
const portCat = k => PORT_CATS.find(c => c[0] === k) || PORT_CATS[2];
function portItems() { return (state && Array.isArray(state.portfolio)) ? state.portfolio : []; }

function portAdd(fields) {
  if (!Array.isArray(state.portfolio)) state.portfolio = [];
  if (state.portfolio.length >= PORT_CAP) return null;
  const it = Object.assign({ id: 'pi' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    cat: 'project', title: '', date: '', role: '', desc: '', at: Date.now() }, fields || {});
  state.portfolio.push(it);
  save();
  return it;
}

// งานที่ทำเสร็จ → ผลงาน: ชื่องาน · โน้ต · รูปกลุ่ม "ทำเสร็จ" (ไม่มีกลุ่มนั้น = ทุกรูป) — รูปเป็นสำเนาใหม่ ลบงานแล้วรูปในพอร์ตไม่หายตาม
async function portFromTask(taskId) {
  const t = ((state && state.tasks) || []).find(x => x.id === taskId);
  if (!t) return null;
  const it = portAdd({ cat: 'project', title: vaultTitle(t), desc: t.note || '', from: t.id });
  if (!it) return null;
  const src = vaultFiles(t), pick = src.some(m => m.kind === 'done') ? src.filter(m => m.kind === 'done') : src;
  const owner = vaultOwner();
  let added = 0;
  for (const m of pick) {
    if (vaultCapLeft(vaultHolders()) <= 0) break;
    let b = await vaultLocalBlob(m.id);
    if (!b && m.up) { await vaultUrl(m); b = await vaultLocalBlob(m.id); }   // vaultUrl เก็บแคชลงเครื่องให้แล้ว
    if (!b) continue;
    const id = vaultNewId(), at = Date.now();
    await VaultStore.putBlob({ id, owner, blob: b, at, pending: true });
    vaultAddMeta(it, { id, kind: 'port', w: m.w || 0, h: m.h || 0, bytes: b.size, at, up: false });
    added++;
  }
  if (added) { save(); vaultSync(); }
  return it;
}

function portCopyText(it) {
  const meta = [it.date, it.role].filter(Boolean).join(' · ');
  return [it.title, meta, it.desc ? '\n' + it.desc : ''].filter(Boolean).join('\n').trim();
}
function portPdfPages(n) { return n ? n + 1 : 0; }

function portDelete(id) {
  const it = portItems().find(x => x.id === id);
  if (!it) return;
  vaultForgetTasks([it]);
  state.portfolio = portItems().filter(x => x.id !== id);
  save();
}

// ห่อภาพ JPEG เป็น PDF 1.4: catalog → pages → (page · content · image) ต่อหน้า + ตาราง xref (บรรทัดละ 20 ไบต์ตามสเปก PDF)
function portBuildPdf(pages) {
  const enc = new TextEncoder(), parts = [], off = [];
  let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (id, body) => { off[id] = len; push(id + ' 0 obj\n'); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n'); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ')}] /Count ${pages.length} >>`));
  pages.forEach((p, i) => {
    const pid = 3 + i * 3, cs = `q 595.28 0 0 841.89 0 0 cm /Im${i} Do Q`;
    obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${pid + 2} 0 R >> >> /Contents ${pid + 1} 0 R >>`));
    obj(pid + 1, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(pid + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg); push('\nendstream');
    });
  });
  const xref = len, total = 3 + pages.length * 3;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

// ---------- สวิตช์ งาน · พอร์ต — .tk-modes + .tk-thumb ของแอป (หน้าตาเดียวกับ วันนี้ · สัปดาห์ · รายการ ทุกธีม) ----------
let vaultTab = 'work', portItemId = null, portPick = null, portDelArm = false, portT = 0;
function vaultPaintTop() {
  const top = document.getElementById('vtTop');
  if (!top) return;
  const i = vaultTab === 'port' ? 1 : 0;
  top.innerHTML = `<div class="tk-modes has-thumb vt-modes" role="tablist" style="--n:2"><i class="tk-thumb" aria-hidden="true" style="--il:${i};--ir:${i}"></i>`
    + `<button type="button" role="tab" class="tk-mode${i ? '' : ' on'}" aria-selected="${!i}" data-vtab="work">งาน</button>`
    + `<button type="button" role="tab" class="tk-mode${i ? ' on' : ''}" aria-selected="${!!i}" data-vtab="port">พอร์ต</button></div>`;
}
// ขอบด้านที่ไปถึงก่อน ขอบหลังตามมาเด้งนิด ๆ — Rubber Segment ของ React Bits แบบเดียวกับ tkThumbStep · ลดการเคลื่อนไหว = กระโดดไปเลย
function vaultSegMove(th, from, to) {
  const set = (l, r) => { th.style.setProperty('--il', l.toFixed(4)); th.style.setProperty('--ir', r.toFixed(4)); };
  if ((window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || from === to) { set(to, to); return; }
  const t0 = performance.now(), right = to > from;
  const out = x => 1 - Math.pow(1 - x, 3), back = x => 1 + 2.6 * Math.pow(x - 1, 3) + 1.6 * Math.pow(x - 1, 2);
  (function step(now) {
    const k = now - t0, lead = out(Math.min(1, k / 200)), trail = back(Math.min(1, Math.max(0, (k - 50) / 300)));
    const a = from + (to - from) * (right ? trail : lead), b = from + (to - from) * (right ? lead : trail);
    set(Math.min(a, b), Math.max(a, b));
    if (k < 360) requestAnimationFrame(step); else set(to, to);
  })(t0);
}
function vaultSwitch(tab) {
  if (tab === vaultTab) return;
  const th = document.querySelector('#vtTop .tk-thumb'), from = vaultTab === 'port' ? 1 : 0;
  vaultTab = tab;
  document.querySelectorAll('#vtTop .tk-mode').forEach(b => { const on = b.dataset.vtab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  if (th) vaultSegMove(th, from, tab === 'port' ? 1 : 0);
  if (typeof haptic === 'function') haptic('tap');
  if (tab === 'port') renderPort(); else renderVault(true);
  // 1 พ.ย. 69 · เจ้าของ: "ตรงงานกับพอร์ตทำอนิเมชั่นหน่อย" — เนื้อหาเลื่อนเข้าจากฝั่งที่กด แบบเดียวกับแท็บหน้างาน (setTaskView)
  // ส่วน "direction-aware" ของ Direction Aware Tabs (Cult UI · MIT) · พอร์ตอยู่ขวา = เข้าจากขวา · กลับไปงาน = เข้าจากซ้าย
  const box = document.getElementById('vtBody');
  if (box) {
    box.dataset.swap = tab === 'port' ? 1 : -1;
    box.classList.remove('vt-swap'); void box.offsetWidth; box.classList.add('vt-swap');
    clearTimeout(vaultSwapT);
    vaultSwapT = setTimeout(() => box.classList.remove('vt-swap'), 560);
  }
}
let vaultSwapT = 0;

function renderPort() {
  const box = document.getElementById('vtBody');
  if (!box) return;
  const items = portItems().slice().sort((a, b) => b.at - a.at);
  const sum = document.getElementById('vtSum');
  if (sum) sum.textContent = `${items.length}/${PORT_CAP} ผลงาน · หมวดเดียวกับ TCASfolio`;
  box.innerHTML = `<div class="vt-two vt-pbar"><button type="button" class="btn secondary" data-padd>+ เพิ่มผลงาน</button>`
    + `<button type="button" class="btn primary" data-ppdf${items.length ? '' : ' disabled'}>ทำ PDF</button></div>`
    + PORT_CATS.map(([k, name, c]) => {
      const list = items.filter(i => i.cat === k);
      return `<section class="vt-sec vt-pcat"><h3><i style="background:${c}"></i>${name}<small>${list.length || ''}</small></h3>`
        + (list.length ? list.map((i, n) => {
          const f = vaultFiles(i)[0], meta = [i.date, i.role].filter(Boolean).join(' · ');
          return `<button type="button" class="vt-row vt-pit" data-pi="${vEsc(i.id)}" style="--i:${n}">`
            + `<span class="vt-th"${f ? ` data-f="${vEsc(f.id)}" data-h="${vEsc(i.id)}"` : ''}>${f ? '' : vIcon('medal')}</span>`
            + `<span class="vt-rt"><b>${vEsc(i.title || 'ยังไม่ได้ตั้งชื่อ')}</b><small>${vEsc(meta || 'แตะเพื่อกรอก')}</small></span>${vIcon('chevron', 'vt-chev')}</button>`;
        }).join('') : '<div class="vt-pempty">ยังไม่มี</div>') + '</section>';
    }).join('')
    + `<p class="vt-store">TCASfolio ให้พิมพ์กรอกเองทีละรายการ · เปิดผลงานแล้วกด "คัดลอกข้อความ" ไปแปะได้เลย</p>`;
  vaultHydrate(box);
}

// ---------- แก้ผลงาน · บันทึกเองตอนพิมพ์ ----------
function openPortItem(id) {
  vaultWrapGo();
  portItemId = id; portDelArm = false;
  renderPortItem();
  go('scr-vault-item');
}
function portBack() { clearTimeout(portT); if (portFlushForm()) save(); vaultTab = 'port'; renderVault(); go('scr-vault'); }
// อ่านทุกช่องบนจอเข้าผลงาน — ใช้ก่อนวาดฟอร์มใหม่ (แตะหมวด · เพิ่มรูป · ลบ) และตอนตัวหน่วงครบ
// เดิมจดทีละช่องด้วยตัวหน่วงตัวเดียว: พิมพ์ชื่อแล้วพิมพ์วันที่ภายใน 0.4 วิ = ชื่อไม่ถูกบันทึก (เจอในพรีวิว 1 พ.ย. 69)
function portFlushForm() {
  const box = document.getElementById('vtItem'), it = box && portItems().find(x => x.id === box.dataset.pid);
  if (!it) return false;
  let changed = false;
  for (const el of box.querySelectorAll('[data-pf]')) if (it[el.dataset.pf] !== el.value) { it[el.dataset.pf] = el.value; changed = true; }
  return changed;
}
function renderPortItem() {
  if (portFlushForm()) save();
  const box = document.getElementById('vtItem'), it = portItems().find(x => x.id === portItemId);
  if (!box || !it) return;
  box.dataset.pid = it.id;
  const fs = vaultFiles(it);
  box.innerHTML = `<span class="vt-lbl">หมวด</span><div class="vt-cats">${PORT_CATS.map(([k, n]) =>
      `<button type="button" class="cp-chip${it.cat === k ? ' on' : ''}" data-pc="${k}">${n}</button>`).join('')}</div>`
    + `<label class="vt-lbl">ชื่อผลงาน<input class="vt-in" data-pf="title" value="${vEsc(it.title)}" placeholder="เช่น ค่ายวิทยาศาสตร์ สอวน. ค่าย 1"></label>`
    + `<label class="vt-lbl">วันที่ / ช่วงเวลา<input class="vt-in" data-pf="date" value="${vEsc(it.date)}" placeholder="เช่น มี.ค. 2569"></label>`
    + `<label class="vt-lbl">บทบาท / สิ่งที่ได้<input class="vt-in" data-pf="role" value="${vEsc(it.role)}" placeholder="เช่น หัวหน้าทีม · เหรียญทอง"></label>`
    + `<label class="vt-lbl">เล่าสั้น ๆ<textarea class="vt-in" data-pf="desc" rows="4" placeholder="ทำอะไร ได้เรียนรู้อะไร (แปะลง TCASfolio ได้เลย)">${vEsc(it.desc)}</textarea></label>`
    + `<span class="vt-lbl">รูป / เกียรติบัตร</span><div class="vt-strip">${fs.map(m =>
      `<button type="button" class="vt-th" data-vv="${vEsc(m.id)}" data-f="${vEsc(m.id)}" data-h="${vEsc(it.id)}" aria-label="ดูรูป"></button>`).join('')}`
    + `<button type="button" class="vt-add" data-va="port"><b>+</b>เพิ่ม</button></div>`
    + `<div class="vt-two vt-iact"><button type="button" class="btn secondary" data-pcopy>คัดลอกข้อความ</button>`
    + `<button type="button" class="btn secondary vt-pdel${portDelArm ? ' sure' : ''}" data-pdel>${portDelArm ? 'แตะอีกครั้งเพื่อลบ' : 'ลบผลงาน'}</button></div>`;
  vaultHydrate(box);
}
function portSaveField() {
  clearTimeout(portT);
  portT = setTimeout(() => {
    if (!portFlushForm()) return;
    save();
    const s = document.getElementById('vtItemSaved');
    if (s) { s.textContent = 'บันทึกแล้ว ✓'; clearTimeout(portSaveField.t); portSaveField.t = setTimeout(() => { s.textContent = ''; }, 1200); }
  }, 400);
}
async function portCopy() {
  const it = portItems().find(x => x.id === portItemId);
  if (!it) return;
  let ok = false;
  try { await navigator.clipboard.writeText(portCopyText(it)); ok = true; } catch (_) {}
  if (typeof showToast === 'function') showToast(ok ? { title: 'คัดลอกแล้ว', body: 'ไปแปะในช่องของ TCASfolio ได้เลย' }
    : { title: 'คัดลอกไม่ได้ในเบราว์เซอร์นี้', body: 'กดค้างที่ข้อความแล้วคัดลอกเอง' });
}
function vaultPortRefresh() {
  if (document.getElementById('scr-vault-item')?.classList.contains('on')) renderPortItem();
  if (document.getElementById('scr-vault')?.classList.contains('on') && vaultTab === 'port') renderPort();
}

// ---------- ทำ PDF ----------
const portSorted = items => items.slice().sort((a, b) => PORT_CATS.findIndex(c => c[0] === a.cat) - PORT_CATS.findIndex(c => c[0] === b.cat) || a.at - b.at);
function openPortPdf() {
  vaultWrapGo();
  const items = portItems();
  if (!portPick) portPick = new Set(portSorted(items).slice(0, PORT_PDF_MAX - 1).map(i => i.id));
  for (const id of [...portPick]) if (!items.some(i => i.id === id)) portPick.delete(id);
  renderPortPdf();
  go('scr-vault-pdf');
}
function renderPortPdf() {
  const box = document.getElementById('vtPdf');
  if (!box) return;
  const items = portSorted(portItems()), s = state.settings || {};
  const n = items.filter(i => portPick.has(i.id)).length, pages = portPdfPages(n), over = pages > PORT_PDF_MAX;
  box.innerHTML = `<p class="vt-store vt-left">A4 · ปก + สารบัญ 1 หน้า + ผลงานละ 1 หน้า · หลายมหาวิทยาลัยรับไม่เกิน ${PORT_PDF_MAX} หน้า (เช็คประกาศของคณะที่สมัครด้วย)</p>`
    + `<label class="vt-lbl">ชื่อ-นามสกุลบนปก<input class="vt-in" data-pn="portName" value="${vEsc(s.portName || '')}" placeholder="ชื่อ-นามสกุล"></label>`
    + `<label class="vt-lbl">คณะ / สาขาที่สมัคร<input class="vt-in" data-pn="portProg" value="${vEsc(s.portProg || '')}" placeholder="เช่น วิศวกรรมคอมพิวเตอร์"></label>`
    + `<div class="vt-plist">${items.map(i => `<label class="vt-prow"><input type="checkbox" data-pk="${vEsc(i.id)}"${portPick.has(i.id) ? ' checked' : ''}>`
      + `<span>${vEsc(i.title || 'ยังไม่ได้ตั้งชื่อ')}</span><small>${vEsc(portCat(i.cat)[1])}</small></label>`).join('')}</div>`
    + `<div class="vt-pages${over ? ' over' : ''}">${!n ? 'เลือกผลงานอย่างน้อย 1 อย่าง'
      : `ปก 1 + ผลงาน ${n} = ${pages} หน้า` + (over ? ` · เกิน ${PORT_PDF_MAX} หน้า เอาออกอีก ${pages - PORT_PDF_MAX} อย่าง` : ` · ไม่เกิน ${PORT_PDF_MAX} หน้า ✓`)}</div>`
    + `<img class="vt-pv" id="vtPdfPv" alt="ตัวอย่างหน้าปก" hidden>`
    + `<button type="button" class="btn primary vt-cta" id="vtPdfGo"${!n || over ? ' disabled' : ''}>สร้าง PDF</button>`;
}

// วาดหน้า A4 ที่ 150 dpi ลง canvas — ใช้ฟอนต์ตัวเดียวกับแอป · ตัดบรรทัดภาษาไทยตามคำ (Intl.Segmenter)
const PW = 1240, PH = 1754, PM = 110;
function portLines(g, text, maxW, maxLines) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    const segs = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('th', { granularity: 'word' }).segment(para)].map(s => s.segment) : [...para];
    let line = '';
    for (const s of segs) {
      if (g.measureText(line + s).width > maxW && line) { out.push(line.trimEnd()); line = s.trimStart(); } else line += s;
    }
    out.push(line);
  }
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/.{0,2}$/, '…'); }
  return out;
}
async function portPage(draw) {
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, PW, PH);
  await draw(g);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), w: PW, h: PH, url: c.toDataURL('image/jpeg', .5) };
}
async function portFit(g, blob, x, y, w, h) {
  const bmp = await createImageBitmap(blob), k = Math.min(w / bmp.width, h / bmp.height), dw = bmp.width * k, dh = bmp.height * k;
  g.drawImage(bmp, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  g.strokeStyle = '#D3DBE8'; g.lineWidth = 2; g.strokeRect(x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
async function portMakePdf() {
  const btn = document.getElementById('vtPdfGo');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const label = btn.textContent;
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const FF = getComputedStyle(document.body).fontFamily, s = state.settings || {};
    const items = portSorted(portItems()).filter(i => portPick.has(i.id)), name = (s.portName || '').trim(), prog = (s.portProg || '').trim();
    btn.textContent = 'กำลังจัดหน้าปก…';
    const pages = [await portPage(g => {
      g.fillStyle = '#1F4FB8'; g.fillRect(0, 0, PW, 16);
      g.fillStyle = '#12233F'; g.font = `800 78px ${FF}`; g.fillText('แฟ้มสะสมผลงาน', PM, 300);
      g.fillStyle = '#5B6B86'; g.font = `600 38px ${FF}`; g.fillText('Portfolio', PM, 360);
      g.fillStyle = '#12233F'; g.font = `800 56px ${FF}`; g.fillText(name || 'ชื่อ-นามสกุล', PM, 560);
      if (prog) { g.fillStyle = '#4A5A75'; g.font = `400 38px ${FF}`; g.fillText('สมัคร ' + prog, PM, 628); }
      g.fillStyle = '#12233F'; g.font = `800 38px ${FF}`; g.fillText('สารบัญ', PM, 800);
      g.font = `400 34px ${FF}`;
      items.forEach((it, i) => {
        const y = 870 + i * 62;
        g.fillStyle = portCat(it.cat)[2]; g.fillRect(PM, y - 22, 10, 10);
        g.fillStyle = '#12233F'; g.fillText(portLines(g, it.title || 'ไม่มีชื่อ', PW - PM * 2 - 140, 1)[0], PM + 30, y);
        g.fillStyle = '#5B6B86'; g.textAlign = 'right'; g.fillText(String(i + 2), PW - PM, y); g.textAlign = 'left';
      });
      g.fillStyle = '#8592A8'; g.font = `400 26px ${FF}`;
      g.fillText('ทำจากคลังงาน StudentOS · ' + new Date().toLocaleDateString('th-TH', { dateStyle: 'long' }), PM, PH - 90);
    })];
    for (let i = 0; i < items.length; i++) {
      btn.textContent = `กำลังจัดหน้า ${i + 2}/${items.length + 1}`;
      const it = items[i], pics = [];
      for (const m of vaultFiles(it).slice(0, 2)) {
        let b = await vaultLocalBlob(m.id);
        if (!b && m.up) { await vaultUrl(m); b = await vaultLocalBlob(m.id); }
        if (b) pics.push(b);
      }
      pages.push(await portPage(async g => {
        const [, cname, color] = portCat(it.cat);
        g.fillStyle = color; g.fillRect(0, 0, PW, 16);
        g.font = `700 32px ${FF}`; g.fillText(cname, PM, 140);
        g.fillStyle = '#12233F'; g.font = `800 58px ${FF}`;
        let y = 230;
        for (const l of portLines(g, it.title || 'ไม่มีชื่อ', PW - PM * 2, 2)) { g.fillText(l, PM, y); y += 74; }
        const meta = [it.date, it.role].filter(Boolean).join(' · ');
        if (meta) { g.fillStyle = '#4A5A75'; g.font = `600 34px ${FF}`; g.fillText(portLines(g, meta, PW - PM * 2, 1)[0], PM, y + 6); y += 70; }
        if (it.desc) { g.fillStyle = '#12233F'; g.font = `400 33px ${FF}`; for (const l of portLines(g, it.desc, PW - PM * 2, 9)) { y += 52; g.fillText(l, PM, y); } y += 30; }
        const top = y + 30, h = PH - 150 - top;
        if (pics.length === 1 && h > 200) await portFit(g, pics[0], PM, top, PW - PM * 2, h);
        if (pics.length === 2 && h > 200) { const w = (PW - PM * 2 - 30) / 2; await portFit(g, pics[0], PM, top, w, h); await portFit(g, pics[1], PM + w + 30, top, w, h); }
        g.fillStyle = '#8592A8'; g.font = `400 26px ${FF}`; g.fillText(name, PM, PH - 70);
        g.textAlign = 'right'; g.fillText(String(i + 2), PW - PM, PH - 70); g.textAlign = 'left';
      }));
    }
    const pdf = portBuildPdf(pages), fname = 'portfolio' + (name ? '-' + name.replace(/\s+/g, '-') : '') + '.pdf';
    window.__vaultLastPdf = pdf;
    const pv = document.getElementById('vtPdfPv');
    if (pv) { pv.src = pages[0].url; pv.hidden = false; }
    // มือถือ: แผ่นแชร์ของเครื่อง (เซฟลงไฟล์/ส่งต่อได้) · ใช้ไม่ได้ (คอม หรือหมดจังหวะนิ้วแตะ) = ดาวน์โหลดตรง
    let shared = false;
    try {
      const file = new File([pdf], fname, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'พอร์ต' }); shared = true; }
    } catch (_) {}
    if (!shared) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdf); a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    }
    if (typeof showToast === 'function') showToast({ title: `สร้าง PDF แล้ว · ${pages.length} หน้า`, body: Math.round(pdf.size / 1024) + ' KB' });
  } catch (e) {
    if (typeof showToast === 'function') showToast({ title: 'สร้าง PDF ไม่สำเร็จ', body: e.message });
  }
  btn.disabled = false; btn.textContent = label;
}

// ---------- ตัวรับการแตะของพอร์ต ----------
function vaultBindPort() {
  const top = document.getElementById('vtTop'), vb = document.getElementById('vtBody'), item = document.getElementById('vtItem'), pdf = document.getElementById('vtPdf');
  const tk = document.getElementById('vtTask');
  if (top) top.addEventListener('click', e => { const b = e.target.closest('[data-vtab]'); if (b) vaultSwitch(b.dataset.vtab); });
  if (vb) vb.addEventListener('click', e => {
    if (e.target.closest('[data-padd]')) { const it = portAdd({}); if (it) openPortItem(it.id); else if (typeof showToast === 'function') showToast({ title: `พอร์ตเต็ม ${PORT_CAP} รายการแล้ว`, body: 'เท่าที่ TCASfolio รับ · ลบอันที่ไม่ใช้ก่อน' }); return; }
    if (e.target.closest('[data-ppdf]')) { openPortPdf(); return; }
    const p = e.target.closest('[data-pi]');
    if (p) openPortItem(p.dataset.pi);
  });
  if (tk) tk.addEventListener('click', async e => {
    if (!e.target.closest('[data-ptask]')) return;
    const it = await portFromTask(vaultTaskId);
    if (!it) { if (typeof showToast === 'function') showToast({ title: `พอร์ตเต็ม ${PORT_CAP} รายการแล้ว`, body: 'ลบอันที่ไม่ใช้ก่อน' }); return; }
    if (typeof showToast === 'function') showToast({ title: 'ส่งเข้าพอร์ตแล้ว', body: 'เลือกหมวดและเติมรายละเอียดได้เลย' });
    openPortItem(it.id);
  });
  if (item) {
    item.addEventListener('click', e => {
      const c = e.target.closest('[data-pc]');
      if (c) { const it = portItems().find(x => x.id === portItemId); if (it) { it.cat = c.dataset.pc; save(); renderPortItem(); } return; }
      if (e.target.closest('[data-va]')) { vaultPick('port', portItemId); return; }
      const th = e.target.closest('[data-vv]');
      if (th) { vaultView(th.dataset.vv, portItemId); return; }
      if (e.target.closest('[data-pcopy]')) { portCopy(); return; }
      if (e.target.closest('[data-pdel]')) {
        if (!portDelArm) { portDelArm = true; renderPortItem(); return; }
        portDelete(portItemId); portItemId = null; portBack();
      }
    });
    item.addEventListener('input', e => { if (e.target.dataset.pf) portSaveField(); });
  }
  if (pdf) {
    pdf.addEventListener('change', e => {
      const k = e.target.closest('[data-pk]');
      if (k) { k.checked ? portPick.add(k.dataset.pk) : portPick.delete(k.dataset.pk); renderPortPdf(); }
    });
    pdf.addEventListener('input', e => {
      const f = e.target.dataset.pn;
      if (!f) return;
      clearTimeout(portT);
      portT = setTimeout(() => { (state.settings || (state.settings = {}))[f] = e.target.value; save(); }, 400);
    });
    pdf.addEventListener('click', e => { if (e.target.closest('#vtPdfGo')) portMakePdf(); });
  }
}
if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vaultBindPort);
  else vaultBindPort();
}
