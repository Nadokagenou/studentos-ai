// แอปรับงานจากกล่องเข้าทันทีที่เข้า (Supabase Realtime) — ไม่ต้องรอรอบ 45 วิ
// รัน: node alt/devtools/inbox-live-check.cjs [ไฟล์ linelink.js — ค่าปริยาย alt/linelink.js]
// ดึงฟังก์ชันจริงออกจากไฟล์มารันใน vm กับ supabase จำลอง · รันกับทั้งบิลด์ /alt/ และบิลด์ราก
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'linelink.js');
const src = fs.readFileSync(file, 'utf8').split('\r\n').join('\n');
const results = [];
const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail });

const grab = name => {
  const m = new RegExp('\\n(async )?function ' + name + '\\(').exec(src);
  if (!m) return null;
  return src.slice(m.index + 1, src.indexOf('\n}', m.index + 1) + 2);
};
const fns = ['inboxLiveEnsure', 'inboxLiveStop', 'pullInbox'].map(n => [n, grab(n)]);
for (const [n, f] of fns) check(`${path.basename(file)} มี ${n}`, !!f, 'ไม่เจอฟังก์ชัน');
const lets = (src.match(/^let (inboxLive|inboxLiveUid|inboxPullBusy|inboxPullAgain)\b.*$/gm) || []).join('\n');

function sandbox() {
  const chans = [], removed = [];
  let pulls = 0, release = null;
  const sb = {
    channel(name) {
      const ch = { name, handlers: [], subscribed: false,
        on(type, filter, cb) { ch.handlers.push({ type, filter, cb }); return ch; },
        subscribe() { ch.subscribed = true; return ch; } };
      chans.push(ch); return ch;
    },
    removeChannel(ch) { removed.push(ch.name); },
  };
  const box = { sb, currentUser: null, console: { warn() {} }, Promise,
    pullInboxOnce: () => { pulls++; return new Promise(r => { release = r; }); } };
  const c = vm.createContext(box);
  vm.runInContext(`${lets}\n${fns.map(x => x[1] || '').join('\n')}`, c);
  return { c, box, chans, removed, get pulls() { return pulls; }, done() { const r = release; release = null; if (r) r(0); } };
}
const tick = () => new Promise(r => setImmediate(r));

(async () => {
if (fns.every(x => x[1])) {
  // 1) ล็อกอิน → ฟังการ INSERT ของกล่องเข้า "ของบัญชีนี้เท่านั้น"
  {
    const s = sandbox();
    s.box.currentUser = { id: 'u-a' };
    s.c.inboxLiveEnsure();
    const ch = s.chans[0];
    const h = ch && ch.handlers[0];
    check('ล็อกอิน → เปิดช่อง realtime หนึ่งช่อง', s.chans.length === 1 && ch.subscribed, JSON.stringify(s.chans.map(c => c.name)));
    check('ฟังเฉพาะ INSERT ของ inbox_items', h && h.type === 'postgres_changes' && h.filter.event === 'INSERT'
      && h.filter.table === 'inbox_items' && h.filter.schema === 'public', JSON.stringify(h && h.filter));
    check('กรองเฉพาะแถวของบัญชีนี้ (user_id=eq.<id>)', h && h.filter.filter === 'user_id=eq.u-a', JSON.stringify(h && h.filter));
    // เรียกซ้ำ (ทุกครั้งที่ pullInbox) → ไม่เปิดช่องซ้ำ
    s.c.inboxLiveEnsure(); s.c.inboxLiveEnsure();
    check('เรียกซ้ำ → ไม่เปิดช่องเพิ่ม', s.chans.length === 1, s.chans.length);
  }
  // 2) มีงานเข้า → ดึงทันที · หลายแถวพร้อมกัน → ไม่ยิงเกินจำเป็น แต่ต้องไม่ตกแถวที่เข้ามาระหว่างดึง
  {
    const s = sandbox();
    s.box.currentUser = { id: 'u-a' };
    s.c.inboxLiveEnsure();
    const fire = () => s.chans[0].handlers[0].cb({ new: { user_id: 'u-a' } });
    fire();
    check('งานเข้า → ดึงกล่องเข้าทันที', s.pulls === 1, s.pulls);
    fire(); fire(); fire();                       // cron หย่อน 3 แถวระหว่างที่รอบแรกยังดึงอยู่
    check('ระหว่างดึงอยู่ → ไม่ดึงซ้อน', s.pulls === 1, s.pulls);
    s.done(); await tick(); await tick();
    check('ดึงเสร็จแล้วมีของมาระหว่างนั้น → ดึงต่ออีกรอบเดียว (ไม่ตกแถว)', s.pulls === 2, s.pulls);
    s.done(); await tick(); await tick();
    check('ไม่มีอะไรมาเพิ่ม → หยุด', s.pulls === 2, s.pulls);
  }
  // 3) สลับบัญชี → ปิดช่องเดิม เปิดช่องของบัญชีใหม่ · งานของบัญชีเดิมที่มาค้างต้องไม่ทำให้ดึงในนามบัญชีใหม่
  {
    const s = sandbox();
    s.box.currentUser = { id: 'u-a' };
    s.c.inboxLiveEnsure();
    const oldCb = s.chans[0].handlers[0].cb;
    s.box.currentUser = { id: 'u-b' };
    s.c.inboxLiveEnsure();
    check('สลับบัญชี → ปิดช่องของบัญชีเดิม', s.removed.includes(s.chans[0].name), JSON.stringify(s.removed));
    check('สลับบัญชี → เปิดช่องกรองด้วยบัญชีใหม่', s.chans[1] && s.chans[1].handlers[0].filter.filter === 'user_id=eq.u-b', JSON.stringify(s.chans[1] && s.chans[1].handlers[0].filter));
    oldCb({ new: { user_id: 'u-a' } });
    check('สัญญาณค้างจากช่องเก่า → ไม่ดึงในนามบัญชีใหม่', s.pulls === 0, s.pulls);
  }
  // 4) ออกจากระบบ → ปิดช่อง
  {
    const s = sandbox();
    s.box.currentUser = { id: 'u-a' };
    s.c.inboxLiveEnsure();
    s.box.currentUser = null;
    s.c.inboxLiveEnsure();
    check('ไม่มีผู้ใช้ → ปิดช่อง', s.removed.length === 1, JSON.stringify(s.removed));
    s.c.inboxLiveEnsure();
    check('ไม่มีผู้ใช้ → ไม่เปิดช่องใหม่', s.chans.length === 1, s.chans.length);
  }
}
// 5) จุดเรียกในโค้ดจริง: pullInbox ตรวจช่องทุกครั้ง · logout ปิดช่องก่อน signOut
{
  const pi = grab('pullInbox') || '';
  check('pullInbox เปิด/ตรวจช่อง realtime ทุกครั้ง', pi.includes('inboxLiveEnsure('), 'ไม่เรียก');
  const appFile = path.join(path.dirname(file), 'app.js');
  const app = fs.existsSync(appFile) ? fs.readFileSync(appFile, 'utf8').split('\r\n').join('\n') : '';
  const i = app.search(/\nasync function logout\(/);
  // ตัดบรรทัดคอมเมนต์ก่อนค้น — หัวฟังก์ชันมีคำว่า signOut() ในคอมเมนต์
  const lo = (i < 0 ? '' : app.slice(i, app.indexOf('\n}', i + 1))).split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const a = lo.indexOf('inboxLiveStop('), b = lo.indexOf('signOut(');
  check('logout ปิดช่อง realtime ก่อน signOut', a > 0 && b > 0 && a < b, `stop@${a} signOut@${b}`);
}

const pass = results.filter(r => r.pass).length;
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.pass ? '' : '   → ' + r.detail));
console.log(`\n${pass}/${results.length} ผ่าน · ${path.relative(process.cwd(), file)}`);
process.exit(pass === results.length ? 0 : 1);
})();
