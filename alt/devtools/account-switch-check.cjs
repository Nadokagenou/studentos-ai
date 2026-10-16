// แยกข้อมูลรายบัญชีบนเครื่องเดียวกัน — สลับบัญชี/ออกจากระบบต้องไม่คัดลอกของข้ามบัญชี และกู้คืนได้ไม่หาย
// รัน: node alt/devtools/account-switch-check.cjs [ไฟล์ app.js — ค่าปริยาย alt/app.js]
//
// ข้อมูลจริง (16 ต.ค. 69 · อ่านอย่างเดียว): บัญชี cba92754 มีงาน 195 ใบ ซึ่ง 194 ใบมี id ตรงกับงานของ
// บัญชี d824e935 (Classroom 73 ใบตรงกับทะเบียนของ d824e935 ทุกใบ) · อีกสองบัญชีมี id ตรงกัน 10 ใบ
// ต้นเหตุ: logout() ไม่ล้างของในเครื่อง แล้ว syncFromCloud() ของบัญชีใหม่รวมทุกใบเข้าไปแล้วส่งขึ้น cloud
//
// ดึงฟังก์ชันจริงออกจากไฟล์มารันใน vm — ไม่ได้เขียนสำเนาขึ้นใหม่ · รันกับทั้งบิลด์ /alt/ และบิลด์ราก
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'app.js');
const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

const a = src.indexOf('\nconst OWNER_KEY');
const b = src.indexOf('\n// ---- end account owner');
check('มีบล็อกแยกข้อมูลรายบัญชี', a > 0 && b > a, file);
const block = a > 0 && b > a ? src.slice(a, b) : '';

// คีย์ในเครื่องที่เป็นของ "คน" (ตามค่าคงที่ที่บล็อกอ่าน) กับของ "เครื่อง"
const CONSTS = `
const TOKEN_KEY = 'studentos.alt.tokens', ALLBADGE_KEY = 'studentos.alt.allBadges', LUCK_KEY = 'studentos.alt.luck',
  GENESIS_KEY = 'studentos.alt.genesisUnlocked', VAULT_AT_KEY = 'studentos.alt.vaultAt', AV_KEY = 'studentos.alt.avatar',
  AI_LOG_KEY = 'studentos.alt.aiLog', AI_CHATS_KEY = 'studentos.alt.aiChats', PLAN_KEY = 'studentos.alt.plan',
  NOTIF_KEY = 'studentos.alt.notifSeen', SOCIAL_SEEN_KEY = 'studentos.alt.socialSeen', CHECKIN_ASKED_KEY = 'studentos.alt.checkinAsked';
const THEME_CODE = { astral: 'studentos.alt.astralUnlocked' };
const SECRETS = { x: { store: 'studentos.alt.secretX' } };`;

function device(store = {}) {
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { if (store.__full && !k.startsWith('studentos.alt.owner')) throw new Error('QuotaExceededError'); store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const box = { localStorage: ls, console: { warn() {} }, JSON, Date, Object, Set, state: { tasks: [], settings: {} },
    ctxNow: null, stateRev: 0,
    persistState() { store['studentos.alt.v1'] = JSON.stringify(box.state); return true; } };
  box.ctxExport = () => box.ctxNow; box.ctxImport = c => { box.ctxNow = c; }; box.ctxClear = () => { box.ctxNow = null; };
  const c = vm.createContext(box);
  vm.runInContext(`${CONSTS}\n${block}\nvar __s = () => state, __set = v => { state = v; };`, c);
  return { c, store, box };
}
const A = 'user-a', B = 'user-b';
const fill = (d, who) => {
  d.c.__set({ tasks: [{ id: 't-' + who, detail: 'งานของ ' + who }], settings: { name: who }, sessions: [{ id: 's-' + who }], marks: [{ id: 'm-' + who }], inbox: [{ id: 'i-' + who }] });
  d.store['studentos.alt.tokens'] = JSON.stringify({ bal: who === A ? 100 : 7 });
  d.store['studentos.alt.aiChats'] = JSON.stringify([{ q: 'คำถามของ ' + who }]);
  d.store['studentos.alt.astralUnlocked'] = '1';
  d.box.ctxNow = { kind: 'ตารางของ ' + who };
};

if (block) {
  // 1) เครื่องที่มีของ A แล้ว B ล็อกอิน
  {
    const d = device({ 'studentos.alt.owner': A, 'studentos.alt.theme': 'dark' });
    fill(d, A);
    const r = d.c.adoptAccountIfNeeded(B);
    const s = d.c.__s();
    check('A → B: ผลคือ adopted', r === 'adopted', r);
    check('A → B: งาน · ชื่อ · รอบจับเวลา · หมุด · กล่องเข้าของ A ไม่ติดไป', s.tasks.length === 0 && !s.settings.name
      && !(s.sessions || []).length && !(s.marks || []).length && !(s.inbox || []).length, JSON.stringify(s));
    check('A → B: ตารางเรียนของ A ไม่ติดไป', d.box.ctxNow === null, JSON.stringify(d.box.ctxNow));
    check('A → B: โทเคน · ประวัติ AI · ธีมที่ปลดแล้วของ A ไม่ติดไป', !('studentos.alt.tokens' in d.store)
      && !('studentos.alt.aiChats' in d.store) && !('studentos.alt.astralUnlocked' in d.store), Object.keys(d.store).join(','));
    check('A → B: ของของเครื่อง (ธีม) อยู่ที่เดิม', d.store['studentos.alt.theme'] === 'dark', d.store['studentos.alt.theme']);
    const bk = JSON.parse(d.store['studentos.alt.accountBackup.' + A] || 'null');
    check('A → B: ของ A ทั้งหมดอยู่ในที่สำรองของ A', bk && bk.owner === A && bk.state.tasks[0].id === 't-' + A
      && bk.ctx.kind === 'ตารางของ ' + A && JSON.parse(bk.keys['studentos.alt.tokens']).bal === 100, JSON.stringify(bk));
    check('A → B: ก่อนรวมกับ cloud ของ B ห้ามส่ง', d.c.cloudWritableFor(B) === false, 'อนุญาตให้ส่ง');
    d.c.setLocalOwner(B);
    check('A → B: หลังรวมเสร็จส่งขึ้น B ได้', d.c.cloudWritableFor(B) === true, 'ไม่อนุญาต');

    // 2) B ทำงานไปแล้วยังไม่ทันซิงก์ (ของ B ในเครื่อง) แล้ว A กลับมาล็อกอิน
    d.c.__s().tasks.push({ id: 't-' + B, detail: 'งานของ B ที่ยังไม่ได้ซิงก์' });
    d.store['studentos.alt.tokens'] = JSON.stringify({ bal: 7 });
    const r2 = d.c.adoptAccountIfNeeded(A);
    const s2 = d.c.__s();
    check('B → A: คืนงานของ A จากที่สำรอง', r2 === 'adopted' && s2.tasks.some(t => t.id === 't-' + A), JSON.stringify(s2.tasks));
    check('B → A: งานของ B ไม่ติดมา', !s2.tasks.some(t => t.id === 't-' + B), JSON.stringify(s2.tasks));
    check('B → A: โทเคน · ประวัติ AI · ตารางเรียนของ A กลับมาครบ', JSON.parse(d.store['studentos.alt.tokens']).bal === 100
      && /ของ user-a/.test(d.store['studentos.alt.aiChats']) && d.box.ctxNow.kind === 'ตารางของ ' + A, JSON.stringify([d.store['studentos.alt.tokens'], d.box.ctxNow]));
    const bkB = JSON.parse(d.store['studentos.alt.accountBackup.' + B] || 'null');
    check('B → A: งานของ B ที่ยังไม่ได้ซิงก์อยู่ในที่สำรองของ B (ไม่หาย)', bkB && bkB.state.tasks.some(t => t.id === 't-' + B), JSON.stringify(bkB && bkB.state.tasks));
    d.c.setLocalOwner(A); d.c.dropAccountBackup(A);
    check('A รวมกับ cloud เสร็จ → ที่สำรองของ A ถูกทิ้ง (ไม่ฟื้นของที่ลบแล้วรอบหน้า)', !('studentos.alt.accountBackup.' + A in d.store), Object.keys(d.store).join(','));
    check('A รวมเสร็จ → ที่สำรองของ B ยังอยู่', ('studentos.alt.accountBackup.' + B) in d.store, Object.keys(d.store).join(','));
  }
  // 3) บัญชีเดิมล็อกอินซ้ำ → ไม่แตะ
  {
    const d = device({ 'studentos.alt.owner': A });
    fill(d, A);
    check('บัญชีเดิม → ไม่ล้างอะไร', d.c.adoptAccountIfNeeded(A) === 'same' && d.c.__s().tasks.length === 1
      && 'studentos.alt.tokens' in d.store, JSON.stringify(d.c.__s()));
  }
  // 4) ใช้แบบไม่ล็อกอินแล้วล็อกอินครั้งแรก → งานที่ทำไว้ตามขึ้นบัญชีไป
  {
    const d = device({});
    fill(d, 'guest');
    check('ยังไม่มีเจ้าของ → งานที่ทำก่อนล็อกอินตามไป', d.c.adoptAccountIfNeeded(B) === 'same' && d.c.__s().tasks.length === 1, JSON.stringify(d.c.__s()));
    check('ยังไม่มีเจ้าของ → ห้ามส่งจนรวมกับ cloud เสร็จ', d.c.cloudWritableFor(B) === false, 'อนุญาตให้ส่ง');
  }
  // 5) เครื่องเต็ม สำรองไม่ลง → ไม่สลับ ไม่ล้าง ไม่ส่ง
  {
    const d = device({ 'studentos.alt.owner': A });
    fill(d, A);
    d.store.__full = true;
    const r = d.c.adoptAccountIfNeeded(B);
    check('เครื่องเต็ม → blocked', r === 'blocked', r);
    check('เครื่องเต็ม → ของ A อยู่ครบ', d.c.__s().tasks[0].id === 't-' + A && 'studentos.alt.tokens' in d.store, JSON.stringify(d.c.__s()));
    check('เครื่องเต็ม → ห้ามส่งขึ้น B', d.c.cloudWritableFor(B) === false, 'อนุญาตให้ส่ง');
  }
  // 6) ออกจากระบบ → เครื่องเปล่า · ล็อกอินกลับมาได้ของครบ · คนอื่นล็อกอินไม่ได้ของ A
  {
    const d = device({ 'studentos.alt.owner': A, 'studentos.alt.theme': 'dark' });
    fill(d, A);
    d.c.leaveAccount();
    check('ออกจากระบบ → งานของ A ไม่ค้างบนเครื่อง', d.c.__s().tasks.length === 0 && !('studentos.alt.tokens' in d.store)
      && d.box.ctxNow === null, JSON.stringify(d.c.__s()));
    check('ออกจากระบบ → ไม่มีเจ้าของ', d.c.localOwner() === '', d.c.localOwner());
    check('ออกจากระบบ → ธีมของเครื่องอยู่ที่เดิม', d.store['studentos.alt.theme'] === 'dark', d.store['studentos.alt.theme']);
    // คนอื่น (B) ล็อกอินต่อ — ต้องไม่ได้ของ A
    d.c.adoptAccountIfNeeded(B);
    check('หลัง A ออก → B ล็อกอินไม่ได้งานของ A', !d.c.__s().tasks.some(t => t.id === 't-' + A), JSON.stringify(d.c.__s()));
    check('หลัง A ออก → B ไม่ได้โทเคนของ A', !('studentos.alt.tokens' in d.store), d.store['studentos.alt.tokens']);
    // A กลับมาล็อกอิน (B ออกไปก่อน)
    d.c.setLocalOwner(B); d.c.leaveAccount();
    d.c.adoptAccountIfNeeded(A);
    check('A ล็อกอินกลับ → ได้งาน · โทเคน · ตารางของ A คืนครบ', d.c.__s().tasks.some(t => t.id === 't-' + A)
      && JSON.parse(d.store['studentos.alt.tokens'] || '{}').bal === 100 && d.box.ctxNow && d.box.ctxNow.kind === 'ตารางของ ' + A,
      JSON.stringify([d.c.__s().tasks, d.store['studentos.alt.tokens'], d.box.ctxNow]));
  }
}

// 7) ตำแหน่งที่เรียกในโค้ดจริง
{
  const body = name => { const i = src.search(new RegExp(`\\n(async )?function ${name}\\(`)); return i < 0 ? '' : src.slice(i, src.indexOf('\n}', i + 1)); };
  const noComments = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const sf = noComments(body('syncFromCloud'));
  const ad = sf.indexOf('adoptAccountIfNeeded('), aw = sf.indexOf('await ');
  check('syncFromCloud เรียก adoptAccountIfNeeded ก่อน await แรก', ad > 0 && (aw < 0 || ad < aw), `adopt@${ad} await@${aw}`);
  check('syncFromCloud หยุดเมื่อ blocked', /'blocked'[\s\S]{0,400}return;/.test(sf), 'ไม่หยุด');
  check('syncFromCloud ตั้งเจ้าของและทิ้งที่สำรองหลังรวมเสร็จ', sf.lastIndexOf('setLocalOwner(') > ad && sf.includes('dropAccountBackup('), 'ไม่ครบ');
  const pc = body('pushRound') || body('pushToCloud');
  check('การส่งขึ้น cloud มีด่านเจ้าของข้อมูล', pc.includes('cloudWritableFor('), 'ไม่มีด่าน');
  const ic = body('initCloud');
  check('initCloud จดเจ้าของให้เครื่องที่ล็อกอินค้างอยู่ก่อนรุ่นนี้', ic.includes('setLocalOwner('), 'ไม่จด');
  const lo = noComments(body('logout'));
  const lp = lo.indexOf('pushToCloud('), ls = lo.indexOf('signOut('), ll = lo.indexOf('leaveAccount(');
  check('logout ส่งของค้างก่อน signOut แล้วจึงเก็บเข้าที่สำรอง', lp > 0 && ls > lp && ll > ls, `push@${lp} signOut@${ls} leave@${ll}`);
}

const pass = results.filter(r => r.pass).length;
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
console.log(`\n${pass}/${results.length} ผ่าน · ${path.relative(process.cwd(), file)}`);
process.exit(pass === results.length ? 0 : 1);
