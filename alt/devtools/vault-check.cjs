// คลังงาน (vault.js) · รัน: node alt/devtools/vault-check.cjs        (สาย ALT)
//                          node alt/devtools/vault-check.cjs .      (แอปหลักที่ราก)
// โหลด vault.js ทั้งไฟล์ใน vm · ส่วนที่แตะ IndexedDB/Supabase ใช้ตัวจำลองในหน่วยความจำ (สเปก alt/docs/superpowers/specs/2026-10-31-task-vault-design.md)
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');

const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(dir, 'vault.js'), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));   // ค่าจาก vm คนละ realm

// โลกใหม่ทุกครั้ง: ตัวแปรของแอปที่ vault.js อ่านตอนรัน (state · currentUser · sb · save) ใส่ผ่าน extra
function load(extra = {}) {
  const ctx = vm.createContext(Object.assign({
    console, Date, Math, JSON, Promise, Set, Map, Number, String, Array, Object, Error, setTimeout, clearTimeout, TextEncoder, Uint8Array,
    state: { tasks: [], settings: {} }, currentUser: null, sb: null, saves: 0,
  }, extra));
  vm.runInContext('function save() { saves++; }\n' + SRC, ctx);
  return ctx;
}

let n = 0;
const fails = [];
async function check(label, fn) {
  try { await fn(); n++; console.log('PASS ' + label); }
  catch (e) { fails.push(label); console.log('FAIL ' + label + '\n     ' + String(e.message).split('\n').slice(0, 6).join('\n     ')); }
}

(async () => {
  const V = load();

  await check('ย่อด้านยาวเหลือ 1600 ไม่ขยายรูปเล็ก', () => {
    assert.deepEqual(plain(V.vaultShrinkSize(2400, 3200)), { w: 1200, h: 1600 });
    assert.deepEqual(plain(V.vaultShrinkSize(4000, 1000)), { w: 1600, h: 400 });
    assert.deepEqual(plain(V.vaultShrinkSize(800, 600)), { w: 800, h: 600 });
  });

  await check('งานไม่มีรูป = ไม่มีช่อง files · ลบใบสุดท้ายแล้วช่องหาย', () => {
    const t = { id: 'a' };
    assert.equal(V.vaultFiles(t).length, 0);
    assert.ok(!('files' in t));
    const m = V.vaultAddMeta(t, { id: 'f1', kind: 'q', w: 1, h: 1, bytes: 1, at: 1, up: false });
    assert.equal(t.files.length, 1);
    assert.equal(m.id, 'f1');
    assert.equal(V.vaultRemoveMeta(t, 'f1').id, 'f1');
    assert.ok(!('files' in t));
    assert.equal(V.vaultRemoveMeta(t, 'nope'), null);
  });

  await check('เลข id ขึ้นต้น f ไม่ซ้ำกัน', () => {
    const ids = new Set(Array.from({ length: 50 }, () => V.vaultNewId()));
    assert.equal(ids.size, 50);
    for (const id of ids) assert.match(id, /^f[0-9a-z]{9,}$/);
  });

  await check('เพดาน 300 นับงานในถังด้วย', () => {
    const many = k => Array.from({ length: k }, (_, i) => ({ id: 'f' + i, kind: 'q', up: true }));
    assert.equal(V.vaultCapLeft([{ files: many(200) }, { deleted: true, files: many(99) }]), 1);
    assert.equal(V.vaultCapLeft([{ files: many(300) }]), 0);
    assert.equal(V.vaultCapLeft([{ files: many(320) }]), 0);
    assert.deepEqual(plain(V.vaultCount([{ files: many(3) }, {}, { files: many(2) }])), { files: 5, tasks: 2 });
  });

  await check('คลังเหลือ 2 ช่อง เลือก 5 = เก็บ 2 ข้าม 3', () => {
    assert.deepEqual(plain(V.vaultSheetPlan(5, 2)), { take: 2, skip: 3 });
    assert.deepEqual(plain(V.vaultSheetPlan(3, 10)), { take: 3, skip: 0 });
  });

  await check('path บนคลาวด์ = <uid>/<id>.jpg', () => assert.equal(V.vaultPath('u1', 'fa'), 'u1/fa.jpg'));

  await check('เก็บกวาด: ไม่ลบของใหม่กว่าวัน · ไม่ลบของงานในถัง', () => {
    const now = Date.parse('2026-10-31T12:00:00Z'), old = '2026-10-29T00:00:00Z', fresh = '2026-10-31T10:00:00Z';
    const objs = [{ name: 'fa.jpg', created_at: old }, { name: 'fb.jpg', created_at: old }, { name: 'fc.jpg', created_at: fresh }, { name: 'fd.jpg', created_at: old }];
    const tasks = [{ files: [{ id: 'fa' }] }, { deleted: true, files: [{ id: 'fd' }] }];
    assert.deepEqual(plain(V.vaultOrphans(objs, tasks, 'u1', now)), ['u1/fb.jpg']);
  });

  await check('ช่องรูป: ในเครื่อง · บนคลาวด์ · รอเครื่องที่ถ่าย', () => {
    assert.equal(V.vaultThumbState({ up: false }, true), 'local');
    assert.equal(V.vaultThumbState({ up: true }, false), 'cloud');
    assert.equal(V.vaultThumbState({ up: false }, false), 'elsewhere');
  });

  // Ruling (ledger): หน้าตาใหม่ที่เจ้าของเลือก 1 พ.ย. แยก "ทำต่อ" (เรียงตามกำหนดส่ง) กับ "ส่งแล้ว" (ใหม่สุดก่อน)
  await check('จัดกลุ่มคลัง: ทำต่อเรียงตามกำหนดส่ง (ไม่มีกำหนดไว้ท้าย) · ส่งแล้วใหม่สุดก่อน · ไม่เอางานในถัง · กรองวิชาได้', () => {
    const tasks = [
      { id: 'd1', subject: 'คณิต', done: true, doneAt: '2026-10-28T10:00:00Z' },
      { id: 'd2', subject: 'เคมี', done: true, doneAt: '2026-10-30T10:00:00Z' },
      { id: 'far', subject: 'คณิต', due: '2026-11-20T08:00:00Z' },
      { id: 'none', subject: 'เคมี' },
      { id: 'near', subject: 'เคมี', due: '2026-11-02T08:00:00Z' },
      { id: 'bin', subject: 'คณิต', due: '2026-11-01T08:00:00Z', deleted: true },
    ];
    const g = V.vaultGroups(tasks, null);
    assert.deepEqual(plain(g.pend.map(t => t.id)), ['near', 'far', 'none']);
    assert.deepEqual(plain(g.done.map(t => t.id)), ['d2', 'd1']);
    const k = V.vaultGroups(tasks, 'คณิต');
    assert.deepEqual(plain([k.pend.map(t => t.id), k.done.map(t => t.id)]), [['far'], ['d1']]);
  });

  // ---------- ชั้นที่เก็บ: IndexedDB จำลอง (VaultStore) + Supabase Storage จำลอง ----------
  function fakeStore() {
    const blobs = new Map(), dels = new Map(), meta = new Map();
    return { blobs, dels,
      async getBlob(id) { return blobs.get(id) || null; }, async putBlob(r) { blobs.set(r.id, Object.assign({}, r)); },
      async delBlob(id) { blobs.delete(id); }, async blobsOf(o) { return [...blobs.values()].filter(r => r.owner === o); },
      async queueDelete(p, owner) { dels.set(p, { path: p, owner }); }, async deletesOf(o) { return [...dels.values()].filter(x => x.owner === o); },
      async doneDelete(p) { dels.delete(p); }, async getMeta(k) { return meta.get(k); }, async setMeta(k, v) { meta.set(k, v); } };
  }
  function fakeSb(opt = {}) {
    const log = { upload: [], remove: [], list: 0 };
    const bucket = {
      async upload(p) { log.upload.push(p); return opt.upload ? opt.upload(p) : { data: { path: p }, error: null }; },
      async remove(ps) { log.remove.push(...ps); return opt.remove ? opt.remove(ps) : { data: ps, error: null }; },
      async list() { log.list++; return { data: opt.objects ? opt.objects() : [], error: null }; },
      async createSignedUrl() { return { data: { signedUrl: 'https://x/y' }, error: null }; },
    };
    return { log, storage: { from: b => { assert.equal(b, 'task-files'); return bucket; } } };
  }
  const blob = s => new Blob([s || 'jpg'], { type: 'image/jpeg' });
  function world({ tasks = [], user = { id: 'u1' }, sb = fakeSb() } = {}) {
    const C = load({ state: { tasks, settings: {} }, currentUser: user, sb, Blob });
    const st = fakeStore(); C.VaultStore = st;
    return { C, st, sb };
  }

  await check('เพิ่มรูปตอนไม่มีเน็ต = ค้าง up:false แล้วส่งเองรอบหน้า', async () => {
    let offline = true;
    const sb = fakeSb({ upload: () => { if (offline) throw new Error('Failed to fetch'); return { data: {}, error: null }; } });
    const t = { id: 't1' }, { C, st } = world({ tasks: [t], sb });
    const r = await C.vaultAddPhotos('t1', [{ blob: blob(), w: 10, h: 20 }], 'q');
    await C.vaultSync();
    assert.deepEqual(plain(r), { saved: 1, skipped: 0 });
    const m = t.files[0];
    assert.equal(m.up, false); assert.equal(m.kind, 'q'); assert.equal(m.w, 10);
    assert.equal(st.blobs.get(m.id).pending, true);
    offline = false;
    const before = C.saves;
    await C.vaultSync();
    assert.equal(m.up, true);
    assert.equal(st.blobs.get(m.id).pending, false);
    assert.ok(sb.log.upload.includes('u1/' + m.id + '.jpg'));
    assert.ok(C.saves > before);
  });

  await check('ส่งซ้ำเจอ 409 = ถือว่าขึ้นแล้ว', async () => {
    const sb = fakeSb({ upload: () => ({ data: null, error: { statusCode: '409', message: 'The resource already exists' } }) });
    const t = { id: 't1' }, { C } = world({ tasks: [t], sb });
    await C.vaultAddPhotos('t1', [{ blob: blob(), w: 1, h: 1 }], 'done');
    await C.vaultSync();
    assert.equal(t.files[0].up, true);
  });

  await check('สลับบัญชีระหว่างส่ง = ไม่เขียนลงงานของบัญชีใหม่', async () => {
    let release; const gate = new Promise(r => { release = r; });
    const sb = fakeSb({ upload: async () => { await gate; return { data: {}, error: null }; } });
    const t = { id: 't1' }, { C } = world({ tasks: [t], sb });
    await C.vaultAddPhotos('t1', [{ blob: blob(), w: 1, h: 1 }], 'q');
    const running = C.vaultSync();
    await new Promise(r => setTimeout(r, 5));
    const u2task = { id: 't9' };
    C.currentUser = { id: 'u2' }; C.state = { tasks: [u2task], settings: {} };
    const before = C.saves;
    release(); await running;
    assert.ok(!('files' in u2task));
    assert.equal(C.saves, before);
  });

  await check('ไม่ล็อกอิน = ไม่ส่งอะไรขึ้น', async () => {
    const sb = fakeSb(), t = { id: 't1' }, { C } = world({ tasks: [t], sb, user: null });
    await C.vaultAddPhotos('t1', [{ blob: blob(), w: 1, h: 1 }], 'q');
    await C.vaultSync();
    assert.equal(sb.log.upload.length, 0);
    assert.equal(t.files[0].up, false);
  });

  await check('รูปจากฟอร์มที่ระบุเฉพาะเครื่องต้องไม่อัปโหลดเมื่อคลังซิงก์', async () => {
    const sb = fakeSb(), t = { id: 't1', files: [{ id: 'local-photo', kind: 'q', up: false, localOnly: true }] }, { C, st } = world({ tasks: [t], sb });
    st.blobs.set('local-photo', { id: 'local-photo', owner: 'u1', blob: blob(), pending: false, localOnly: true });
    await C.vaultSync();
    assert.equal(sb.log.upload.length, 0);
    assert.equal(t.files[0].up, false);
    assert.ok(await C.vaultLocalBlob('local-photo'));
  });

  await check('คลังเหลือ 2 เลือก 5 = เก็บ 2 บอกว่าข้าม 3', async () => {
    const full = { id: 'old', files: Array.from({ length: 298 }, (_, i) => ({ id: 'x' + i, kind: 'q', up: true })) };
    const t = { id: 't1' }, { C } = world({ tasks: [full, t] });
    const r = await C.vaultAddPhotos('t1', Array.from({ length: 5 }, () => ({ blob: blob(), w: 1, h: 1 })), 'q');
    assert.deepEqual(plain(r), { saved: 2, skipped: 3 });
    assert.equal(t.files.length, 2);
  });

  await check('ลบรูปออฟไลน์ = จดคิว แล้วลบตามทีหลัง', async () => {
    let offline = true;
    const sb = fakeSb({ remove: () => { if (offline) throw new Error('Failed to fetch'); return { data: [], error: null }; } });
    const t = { id: 't1', files: [{ id: 'f1', kind: 'q', up: true }] }, { C, st } = world({ tasks: [t], sb });
    st.blobs.set('f1', { id: 'f1', owner: 'u1', blob: blob(), pending: false });
    await C.vaultDeleteFile('t1', 'f1');
    assert.ok(!('files' in t)); assert.ok(!st.blobs.has('f1'));
    assert.deepEqual(plain((await st.deletesOf('u1')).map(d => d.path)), ['u1/f1.jpg']);
    offline = false;
    await C.vaultSync();
    assert.equal((await st.deletesOf('u1')).length, 0);
  });

  await check('ลบงานถาวร = ลบรูปทุกใบของงานนั้น', async () => {
    const sb = fakeSb(), t = { id: 't1', files: [{ id: 'f1', up: true }, { id: 'f2', up: true }] }, { C, st } = world({ tasks: [t], sb });
    st.blobs.set('f1', { id: 'f1', owner: 'u1', blob: blob() });
    await C.vaultForgetTasks([t]);
    assert.deepEqual(plain(sb.log.remove.slice().sort()), ['u1/f1.jpg', 'u1/f2.jpg']);
    assert.ok(!st.blobs.has('f1'));
  });

  await check('เก็บกวาดวันละครั้ง', async () => {
    const old = new Date(Date.now() - 3 * 864e5).toISOString();
    const sb = fakeSb({ objects: () => [{ name: 'fo.jpg', created_at: old }, { name: 'f1.jpg', created_at: old }] });
    const t = { id: 't1', files: [{ id: 'f1', up: true }] }, { C } = world({ tasks: [t], sb });
    await C.vaultSync();
    assert.deepEqual(plain(sb.log.remove), ['u1/fo.jpg']);
    await C.vaultSync();
    assert.equal(sb.log.list, 1);
  });

  await check('ใช้แบบไม่ล็อกอินแล้วล็อกอิน = รูปตามขึ้นบัญชี', async () => {
    const { C, st } = world({ tasks: [] });
    st.blobs.set('fg', { id: 'fg', owner: 'guest', blob: blob('g') });
    await C.vaultAdoptGuest('u1');
    assert.ok(await C.vaultLocalBlob('fg'));
  });

  await check('บัญชีอื่นเห็นรูปในเครื่องไม่ได้', async () => {
    const { C, st } = world({ tasks: [], user: { id: 'u2' } });
    st.blobs.set('f1', { id: 'f1', owner: 'u1', blob: blob() });
    assert.equal(await C.vaultLocalBlob('f1'), null);
  });

  await check('ลบบัญชี = ลบทั้งโฟลเดอร์ · ลบไม่ได้บอกจำนวนที่ค้าง', async () => {
    const objs = () => ['a', 'b', 'c'].map(x => ({ name: x + '.jpg', created_at: new Date().toISOString() }));
    const ok1 = world({ sb: fakeSb({ objects: objs }) });
    ok1.st.blobs.set('a', { id: 'a', owner: 'u1', blob: blob() });
    assert.deepEqual(plain(await ok1.C.vaultWipeCloud()), { left: 0 });
    assert.deepEqual(plain(ok1.sb.log.remove.slice().sort()), ['u1/a.jpg', 'u1/b.jpg', 'u1/c.jpg']);
    assert.equal(ok1.st.blobs.size, 0);
    const bad = world({ sb: fakeSb({ objects: objs, remove: () => ({ data: null, error: { message: 'denied' } }) }) });
    assert.deepEqual(plain(await bad.C.vaultWipeCloud()), { left: 3 });
  });

  // ---------- ทางเข้า: ไทล์หน้าแรก 4×2 (เจ้าของ 1 พ.ย. 69 · คงสถิติ เพิ่มอันดับ + คลังงาน) ----------
  const APP = fs.readFileSync(path.join(dir, 'app.js'), 'utf8').split(/\r?\n/);
  const cutApp = name => {
    const a = APP.findIndex(l => l.startsWith('function ' + name + '('));
    assert.ok(a >= 0, 'ไม่เจอ function ' + name);
    let b = a; while (APP[b] !== '}') b++;
    return APP.slice(a, b + 1).join('\n');
  };
  const tilesOf = (features = {}) => {
    const T = vm.createContext({ Math, String, Array, frReqs: [],
      homeBlockOn: id => id === 'todayTop', ctxIsEmpty: () => false, dailyPending: () => false, dmPendingCount: () => 0, inboxPending: () => [],
      sosFeature: id => features[id] !== false, icon: n => `<svg data-i="${n}"></svg>` });
    vm.runInContext(cutApp('toolsGrid'), T);
    const html = vm.runInContext('toolsGrid()', T);
    return { labels: [...html.matchAll(/<span class="tg-lb2">([^<]*)<\/span>/g)].map(m => m[1]), cols: +(html.match(/--tg-cols:(\d+)/) || [])[1],
      onclick: (html.match(/onclick="([^"]*)"[^>]*>\s*<span class="tg-ic"><svg data-i="archive"/) || [])[1] };
  };
  await check('หน้าแรก 8 ไทล์ 4×2: ข้อความ·เพื่อนฉัน·กล่องเข้า·อันดับ / สถิติ·ของสะสม·ร้านค้า·คลังงาน', () => {
    const t = tilesOf();
    assert.deepEqual(t.labels, ['ข้อความ', 'เพื่อนฉัน', 'กล่องเข้า', 'อันดับ', 'สถิติ', 'ของสะสม', 'ร้านค้า', 'คลังงาน']);
    assert.equal(t.cols, 4);
    assert.equal(t.onclick, "openVault('scr-menu')");
  });
  await check('ปิดฟีเจอร์ vault = ไม่มีไทล์คลังงาน · 7 ไทล์ยังเป็นสองแถว', () => {
    const t = tilesOf({ vault: false });
    assert.ok(!t.labels.includes('คลังงาน'));
    assert.equal(t.cols, 4);
  });

  // ---------- โหมดโฟกัส: แถวดูโจทย์ · ปุ่มถ่ายงานที่ทำเสร็จ ----------
  const focusWorld = (features = {}) => load({ sosFeature: id => features[id] !== false, document: { getElementById: () => null }, icon: n => `<i data-i="${n}"></i>`, esc: s => String(s) });
  await check('ไม่มีรูปโจทย์ = จอโฟกัสเหมือนเดิม (ไม่มีแถว)', () => {
    const F = focusWorld();
    assert.equal(F.vaultFocusPeek({ id: 'a' }), '');
    assert.equal(F.vaultFocusPeek({ id: 'a', files: [{ id: 'n1', kind: 'note' }] }), '');
  });
  await check('มีโจทย์ 2 รูป = แถวบอก "โจทย์ 2 รูป" · ปิดฟีเจอร์ = ไม่มีแถว', () => {
    const t = { id: 'a', files: [{ id: 'q1', kind: 'q' }, { id: 'q2', kind: 'q' }, { id: 'd1', kind: 'done' }] };
    assert.match(focusWorld().vaultFocusPeek(t), /โจทย์ 2 รูป/);
    assert.equal(focusWorld({ vault: false }).vaultFocusPeek(t), '');
  });
  await check('แตะดูโจทย์ = นับเพิ่มหนึ่ง (ตัวชี้วัดของสเปก · ไม่ส่งไปไหน)', () => {
    const F = focusWorld();
    F.state = { tasks: [{ id: 'a', files: [{ id: 'q1', kind: 'q' }] }], settings: {} };
    F.vaultPeek('a'); F.vaultPeek('a');
    assert.equal(F.state.settings.vaultStats.peek, 2);
    assert.ok(F.saves >= 2);
  });
  await check('จอเสร็จแล้ว: ยังไม่มีรูปงานที่ทำเสร็จ = มีปุ่มถ่าย · มีแล้ว/ปิดฟีเจอร์ = ไม่มี', () => {
    assert.match(focusWorld().vaultDoneOffer({ id: 'a' }), /ถ่ายงานที่ทำเสร็จ/);
    assert.equal(focusWorld().vaultDoneOffer({ id: 'a', files: [{ id: 'd1', kind: 'done' }] }), '');
    assert.equal(focusWorld({ vault: false }).vaultDoneOffer({ id: 'a' }), '');
  });

  // ---------- พอร์ต + PDF (งาน 8 · สเปกข้อ 10) ----------
  await check('พอร์ต 6 หมวดของ TCASfolio · เต็ม 40 = ไม่เพิ่ม', () => {
    const { C } = world();
    assert.deepEqual(plain(vm.runInContext('PORT_CATS.map(c => c[0])', C)), ['essay', 'letter', 'project', 'activity', 'award', 'extra']);   // const = ไม่อยู่บน context
    C.state.portfolio = Array.from({ length: 39 }, (_, i) => ({ id: 'p' + i }));
    const it = C.portAdd({ title: 'ค่าย สอวน.' });
    assert.equal(it.cat, 'project'); assert.equal(it.title, 'ค่าย สอวน.'); assert.match(it.id, /^pi/);
    assert.equal(C.portAdd({ title: 'เกิน' }), null);
    assert.equal(C.state.portfolio.length, 40);
  });

  await check('ส่งงานที่ทำเสร็จเข้าพอร์ต = ชื่องาน + โน้ต + รูปกลุ่มทำเสร็จ (รูปใหม่ ไม่ใช้ร่วมกับงาน)', async () => {
    const t = { id: 't1', subject: 'ฟิสิกส์', detail: 'โครงงานรถพลังยาง', done: true, note: 'ได้ที่ 2 ของห้อง',
      files: [{ id: 'fq', kind: 'q', up: true }, { id: 'fd', kind: 'done', up: true, w: 3, h: 4 }] };
    const { C, st } = world({ tasks: [t] });
    st.blobs.set('fd', { id: 'fd', owner: 'u1', blob: blob('done') });
    const it = await C.portFromTask('t1');
    assert.equal(it.title, 'โครงงานรถพลังยาง'); assert.equal(it.desc, 'ได้ที่ 2 ของห้อง'); assert.equal(it.from, 't1');
    assert.equal(it.files.length, 1);
    assert.equal(it.files[0].kind, 'port');
    assert.notEqual(it.files[0].id, 'fd');
    assert.equal(it.files[0].up, false);
    assert.ok(st.blobs.has(it.files[0].id));
  });

  await check('คัดลอกข้อความ = ชื่อ / วันที่ · บทบาท / เล่า', () => {
    const { C } = world();
    assert.equal(C.portCopyText({ title: 'ค่าย สอวน.', date: 'มี.ค. 2569', role: 'ผ่านค่าย 2', desc: 'ได้ฝึกใช้กล้องจุลทรรศน์' }),
      'ค่าย สอวน.\nมี.ค. 2569 · ผ่านค่าย 2\n\nได้ฝึกใช้กล้องจุลทรรศน์');
    assert.equal(C.portCopyText({ title: 'จิตอาสา', date: '', role: '', desc: '' }), 'จิตอาสา');
  });

  await check('PDF: ปก + ผลงานละหน้า · ทุกตำแหน่งใน xref ชี้ "N 0 obj" · บรรทัดละ 20 ไบต์', async () => {
    const { C } = world();
    assert.equal(C.portPdfPages(0), 0); assert.equal(C.portPdfPages(9), 10);
    const jpeg = new Uint8Array([0xFF, 0xD8, 1, 2, 3, 0xFF, 0xD9]);
    const pdf = C.portBuildPdf([{ jpeg, w: 4, h: 6 }, { jpeg, w: 4, h: 6 }, { jpeg, w: 4, h: 6 }]);
    const txt = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
    assert.ok(txt.startsWith('%PDF-1.4')); assert.ok(txt.trimEnd().endsWith('%%EOF'));
    assert.equal(+txt.match(/\/Count (\d+)/)[1], 3);
    const sx = +txt.match(/startxref\n(\d+)/)[1], xr = txt.slice(sx).split('\n'), total = +xr[1].split(' ')[1];
    for (let i = 1; i < total; i++) assert.ok(txt.startsWith(i + ' 0 obj', +xr[2 + i].slice(0, 10)), 'obj ' + i);
    assert.ok(xr.slice(2, 2 + total).every(l => (l + '\n').length === 20));
  });

  await check('เก็บกวาดไม่ลบรูปของพอร์ต', async () => {
    const old = new Date(Date.now() - 3 * 864e5).toISOString();
    const sb = fakeSb({ objects: () => [{ name: 'fp.jpg', created_at: old }] });
    const { C } = world({ sb });
    C.state.portfolio = [{ id: 'pi1', files: [{ id: 'fp', kind: 'port', up: true }] }];
    await C.vaultSync();
    assert.equal(sb.log.remove.length, 0);
  });

  // ---------- สลับ งาน ↔ พอร์ต (1 พ.ย. 69 · เจ้าของ: "ตรงงานกับพอร์ตทำอนิเมชั่นหน่อย") ----------
  await check('สลับ งาน ↔ พอร์ต = เนื้อหาเลื่อนเข้าจากฝั่งที่กด (พอร์ตเข้าจากขวา · งานเข้าจากซ้าย)', () => {
    const cls = new Set();
    const box = { dataset: {}, innerHTML: '', offsetWidth: 0, querySelectorAll: () => [],
      classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } };
    const F = load({ document: { getElementById: id => (id === 'vtBody' ? box : null), querySelector: () => null, querySelectorAll: () => [] },
      setTimeout: () => 0, clearTimeout: () => {} });
    F.vaultSwitch('port');
    assert.equal(String(box.dataset.swap), '1');
    assert.ok(cls.has('vt-swap'));
    F.vaultSwitch('work');
    assert.equal(String(box.dataset.swap), '-1');
    assert.ok(cls.has('vt-swap'));
  });

  console.log(`คลังงาน (${path.basename(dir) === 'alt' ? 'ALT' : 'แอปหลัก'}): ${n}/${n + fails.length}`);
  if (fails.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
