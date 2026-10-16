// syncbench — ทดสอบการซิงก์ข้ามเครื่องของ alt/app.js (cloudPull · pushRound · การรวมสามทาง) ด้วย Supabase ปลอม
// รัน: node alt/devtools/syncbench.cjs   (ไม่ถูกโหลดโดยแอป · ตัดบล็อกจริงจาก app.js มารันใน vm)
// แก้โค้ดซิงก์เมื่อไหร่รันตัวนี้ก่อน · เจอเคสที่ทำของหายเมื่อไหร่ เพิ่มเป็นเคสก่อนแก้โค้ด
const fs = require('fs'), vm = require('vm'), path = require('path');
const repo = process.argv[2] || path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(repo, 'alt/app.js'), 'utf8').split(/\r?\n/);
const a = src.findIndex(l => l.startsWith('// ดึงข้อมูลจาก cloud มารวมกับในเครื่อง'));
const b = src.findIndex((l, i) => i > a && l.startsWith('function pushToCloud(immediate) {'));
let e = b; while (src[e] !== '}') e++;
const cheap = src.findIndex(l => l.startsWith('function cheapHash('));
let ce = cheap; while (src[ce] !== '}') ce++;
let block = src.slice(a, e + 1).join('\n');
// cheapHash sits inside the block already? (it does — between pull and push) — guard duplicate
if (!block.includes('function cheapHash(')) block = src.slice(cheap, ce + 1).join('\n') + '\n' + block;

const listeners = {};
const harness = `
let sb = null, currentUser = null, syncTimer = null, lastSync = null, pushDiagRemote = null;
const SESSION_CAP = 400;
let state = { tasks: [], settings: {}, sessions: [], marks: [] };
let renders = 0, persisted = 0, ctxStore = null;
function persistState() { persisted++; }
function funnelMerge() {} function funnelExport() { return {}; }
function renderAll() { renders++; } function renderProfile() {}
async function loadLineLinks() {} async function pullInbox() { return 0; }
function pushHints() { return null; } function showToast(t) { toasts.push(t); }
const toasts = [];
function ctxExport() { return ctxStore; } function ctxImport(c) { ctxStore = c; }
${block}
;({ get state() { return state; }, set state(v) { state = v; }, setSb(v) { sb = v; }, setUser(v) { currentUser = v; },
  get lastSeenRev() { return lastSeenRev; }, get syncBase() { return syncBase; }, get lastPushedHash() { return lastPushedHash; },
  syncFromCloud, pushToCloud, cloudPull, syncSerial, syncFp, save() { pushToCloud(); }, get renders() { return renders; },
  setCtx(c) { ctxStore = c; }, get ctx() { return ctxStore; }, toasts })`;
const ctx = vm.createContext({
  console, setTimeout, clearTimeout, Promise, JSON, Object, Map, Set, Math, Date, Error, Array,
  navigator: { onLine: true },
  window: { addEventListener: (t, f) => (listeners['w:' + t] = f) },
  document: { hidden: false, addEventListener: (t, f) => ((listeners[t] = listeners[t] || []).push(f)) },
});
const app = vm.runInContext(harness, ctx, { filename: 'app-sync-block.js', timeout: 2000 });
const resume = () => (listeners.visibilitychange || []).forEach(f => f());

// ---------- fake supabase ----------
const cloud = { row: null }; const log = []; let beforeWrite = null;
const clone = x => JSON.parse(JSON.stringify(x));
// jsonb does not keep key order — emulate by reversing keys of every stored object
const jsonbify = x => Array.isArray(x) ? x.map(jsonbify) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).reverse().map(k => [k, jsonbify(x[k])])) : x;
function from(table) {
  const q = { op: 'select', cols: '', f: [], payload: null };
  const run = () => {
    log.push(q.op + (q.cols ? '(' + q.cols + ')' : '') + q.f.map(x => ` ${x[0]}=${x[1]}`).join(''));
    if (q.op === 'upsert' || q.op === 'update') {
      if (beforeWrite) { const f = beforeWrite; beforeWrite = null; f(); }
      const cur = cloud.row;
      if (q.op === 'update') { const r = q.f.find(x => x[0] === 'rev'); if (!cur || (r && cur.rev !== r[1])) return { data: null, error: null }; }
      cloud.row = { rev: cur ? cur.rev + 1 : 0, data: jsonbify(clone(q.payload.data)), avatar: 'avatar' in q.payload ? q.payload.avatar : cur && cur.avatar };
      return { data: { rev: cloud.row.rev, vault: null }, error: null };
    }
    if (!cloud.row) return { data: null, error: null };
    const out = {}; for (const c of q.cols.split(',').map(s => s.trim())) out[c] = c === 'data' ? clone(cloud.row.data) : cloud.row[c];
    return { data: out, error: null };
  };
  const api = { select(c) { if (q.op === 'select') q.cols = c; return api; }, eq(k, v) { if (k !== 'id') q.f.push([k, v]); return api; },
    upsert(p) { q.op = 'upsert'; q.payload = p; return api; }, update(p) { q.op = 'update'; q.payload = p; return api; },
    maybeSingle() { return new Promise(r => setTimeout(() => r(run()), 2)); } };
  return api;
}
const mk = (id, detail, x) => Object.assign({ id, subject: 'คณิต', detail, due: '2026-10-20T16:00:00.000Z', type: 'homework', done: false, doneAt: null, deleted: false, progress: 0 }, x || {});
const wait = ms => new Promise(r => setTimeout(r, ms));
const ids = arr => arr.map(t => t.id).sort().join(',');
const results = []; const check = (name, ok, info) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`);

(async () => {
  app.setSb({ from }); app.setUser({ id: 'u-b' });
  cloud.row = { rev: 5, data: jsonbify({ tasks: [mk('tX', 'X'), mk('tY', 'Y')], settings: { name: 'ทดสอบ', theme: 'dark' } }), avatar: null };
  app.state = { tasks: [mk('tX', 'X'), mk('tY', 'Y')], settings: { name: 'ทดสอบ', theme: 'dark' }, sessions: [], marks: [] };
  await app.syncFromCloud();
  check('boot: base fingerprints survive jsonb key reorder', app.syncFp(app.state.tasks.find(t => t.id === 'tX')) === app.syncBase.tasks.tX);

  // (a) device A wrote while B slept: adds Classroom Z, renames Y · B ticks X then save()
  let c = cloud.row; c.data.tasks.push(mk('tZ', 'Z Classroom')); c.data.tasks.find(t => t.id === 'tY').detail = 'Y (แก้จาก A)'; c.rev++;
  const x = app.state.tasks.find(t => t.id === 'tX'); x.done = true; x.progress = 100;
  log.length = 0; app.save(); await wait(1700);
  let ct = cloud.row.data.tasks;
  check('a: task Z added on device A survives B\'s push', ids(ct) === 'tX,tY,tZ', ids(ct));
  check('a: B\'s fresh tick on X wins', ct.find(t => t.id === 'tX').done === true);
  check('a: A\'s edit to Y (untouched on B) wins', ct.find(t => t.id === 'tY').detail === 'Y (แก้จาก A)');
  check('a: B screen re-rendered with Z', ids(app.state.tasks) === 'tX,tY,tZ');

  // (b) A writes in the gap between B's rev check and B's write
  beforeWrite = () => { cloud.row.data.tasks.push(mk('tW', 'W race')); cloud.row.rev++; };
  app.state.tasks.find(t => t.id === 'tY').progress = 50;
  log.length = 0; app.save(); await wait(1700);
  ct = cloud.row.data.tasks;
  check('b: race write W survives (conditional update + retry)', ct.some(t => t.id === 'tW'), log.join(' | '));
  check('b: B\'s progress on Y kept', ct.find(t => t.id === 'tY').progress === 50);

  // (c) save() with nothing changed → zero requests
  log.length = 0; app.save(); await wait(1700);
  check('c: unchanged save() makes no request', log.length === 0, log.join(' | '));

  // (d) resume, cloud unchanged → exactly one rev read, no push
  log.length = 0; resume(); await wait(50);
  check('d: resume with same rev = one tiny read', log.length === 1 && log[0] === 'select(rev)', log.join(' | '));
  // resume, A added V → pulled, rendered, not pushed
  cloud.row.data.tasks.push(mk('tV', 'V')); cloud.row.rev++;
  const r0 = app.renders; log.length = 0; resume(); await wait(50);
  check('d: resume after A wrote pulls V', app.state.tasks.some(t => t.id === 'tV') && app.renders > r0, log.join(' | '));
  check('d: resume does not upload', !log.some(l => l.startsWith('upsert') || l.startsWith('update')));

  // (e) A hard-deleted Y (purge trash), B never touched it since → B follows
  cloud.row.data.tasks = cloud.row.data.tasks.filter(t => t.id !== 'tY'); cloud.row.rev++;
  resume(); await wait(50);
  check('e: hard delete on A propagates to untouched copy on B', !app.state.tasks.some(t => t.id === 'tY'));
  // (f) B hard-deletes V, A did not touch V → V stays deleted after B pulls something else
  app.state.tasks = app.state.tasks.filter(t => t.id !== 'tV');
  cloud.row.data.tasks.push(mk('tU', 'U')); cloud.row.rev++;
  app.save(); await wait(1700);
  ct = cloud.row.data.tasks;
  check('f: B\'s hard delete of V not resurrected by merge', !ct.some(t => t.id === 'tV') && ct.some(t => t.id === 'tU'), ids(ct));

  // (g) settings: B toggles a key while A changed another key
  cloud.row.data.settings.theme = 'light'; cloud.row.rev++;
  app.state.settings.srcOff = { google_classroom: true };
  app.save(); await wait(1700);
  const s = cloud.row.data.settings;
  check('g: B\'s new setting kept and A\'s theme change kept', s.srcOff && s.srcOff.google_classroom === true && s.theme === 'light', JSON.stringify(s));

  // (h) ctx: B edited timetable, A did not → B's ctx wins; A edited, B did not → A's wins
  app.setCtx({ classes: [{ d: 1 }] }); app.save(); await wait(1700);
  cloud.row.data.ctx = { classes: [{ d: 2 }] }; cloud.row.rev++;
  resume(); await wait(50);
  check('h: untouched ctx on B takes A\'s timetable', JSON.stringify(app.ctx) === JSON.stringify({ classes: [{ d: 2 }] }), JSON.stringify(app.ctx));
  app.setCtx({ classes: [{ d: 3 }] });
  cloud.row.data.tasks.push(mk('tT', 'T')); cloud.row.rev++;
  app.save(); await wait(1700);
  check('h: B\'s fresh timetable edit not overwritten by pull-before-push', JSON.stringify(cloud.row.data.ctx) === JSON.stringify({ classes: [{ d: 3 }] }), JSON.stringify(cloud.row.data.ctx));

  // (i) account switch: base from another account must not drop the new account's local-only tasks
  app.setUser({ id: 'u-other' });
  cloud.row = { rev: 1, data: jsonbify({ tasks: [mk('o1', 'other')], settings: {} }), avatar: null };
  await app.syncFromCloud();
  check('i: switching account uses legacy union (no base from other account)', app.state.tasks.some(t => t.id === 'tX') && app.state.tasks.some(t => t.id === 'o1'));

  // (j) brand-new account (no row yet) → upsert creates it, then conditional updates work
  app.setUser({ id: 'u-new' }); cloud.row = null; app.state = { tasks: [mk('n1', 'n')], settings: {}, sessions: [], marks: [] };
  log.length = 0; await app.syncFromCloud();
  check('j: first push on new account creates row via upsert', cloud.row && cloud.row.rev === 0 && log.some(l => l.startsWith('upsert')), log.join(' | '));
  app.state.tasks[0].done = true; log.length = 0; app.save(); await wait(1700);
  check('j: next push uses conditional update', log.some(l => l === 'update rev=0') && cloud.row.data.tasks[0].done === true, log.join(' | '));

  // (k) task created on THIS device (local key order), untouched since; A hard-deletes it → B must follow
  //     needs order-independent fingerprints: base comes from the pulled (jsonb-ordered) copy
  cloud.row.data.tasks.push(mk('k2', 'k2')); cloud.row.rev++;
  resume(); await wait(50);                 // base now from cloud (reversed key order)
  cloud.row.data.tasks = cloud.row.data.tasks.filter(t => t.id !== 'n1'); cloud.row.rev++;
  resume(); await wait(50);
  check('k: delete on A propagates to a task this device created (key order independent)', !app.state.tasks.some(t => t.id === 'n1'), ids(app.state.tasks));

  console.log(results.join('\n'));
  console.log(`\n${results.filter(r => r.startsWith('PASS')).length}/${results.length} passed`);
})().catch(err => { console.error('HARNESS ERROR', err); process.exit(1); });
