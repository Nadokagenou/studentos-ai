// ============================================================
// ข่าวสารจากทีมพัฒนา — เครื่องมือฝั่งคนเขียน (ไม่ถูกโหลดโดยแอป)
// ------------------------------------------------------------
// สองคำสั่ง:
//
//   node alt/devtools/news.mjs evidence 1C57
//     รวม "หลักฐาน" ของรุ่นนั้นเป็นก้อนเดียว: แพตช์โน้ตของรุ่น · คอมมิตในช่วงรุ่น ·
//     ไฟล์ที่เปลี่ยน · บรรทัดที่บอกว่า "ยังไม่ ..." — ให้ AI อ่านก่อนร่างประกาศ
//
//   node alt/devtools/news.mjs check
//     ตรวจ alt/news/announcements.json และ alt/news/drafts.json
//     ทุกประโยคที่ผู้ใช้จะอ่าน (หัวข้อ · เนื้อความ · ทุกข้อย่อย) ต้องมีคำพูดที่ยกมา
//     จากแพตช์โน้ตของรุ่นนั้นหรือข้อความคอมมิตจริงอย่างน้อยหนึ่งชิ้น และคำพูดนั้น
//     ต้องหาเจอในต้นฉบับแบบตรงตัว — ไม่เจอ = ล้ม (exit 1)
//
// ทำไมต้องตรวจด้วยโค้ด ไม่ใช่เชื่อ AI ว่า "ไม่แต่ง":
// โมเดลภาษาเขียนประโยคที่ฟังดูจริงได้เก่งพอ ๆ กับประโยคที่จริง
// ด่านเดียวที่กันได้คือบังคับให้ทุกประโยคชี้กลับไปที่ของที่เกิดขึ้นแล้ว แล้วให้เครื่องเช็ค
// ============================================================
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(ALT, '..');
const PATCHNOTES = join(ALT, 'PATCHNOTES.md');
const FILES = [join(ALT, 'news', 'announcements.json'), join(ALT, 'news', 'drafts.json')];

const KINDS = ['feature', 'theme', 'update', 'fix', 'notice'];
// notice = ประกาศสำคัญที่ทีมเขียนเอง (ปิดปรับปรุง · นโยบายข้อมูล · กิจกรรม) — ไม่ได้มาจากรุ่นแอป
// คำที่สัญญาของที่ยังไม่มี — ประกาศพูดได้แค่สิ่งที่ปล่อยไปแล้ว
const FUTURE = ['เร็ว ๆ นี้', 'เร็วๆ นี้', 'เร็วๆนี้', 'กำลังจะมา', 'เตรียมพบ', 'รอติดตาม', 'เร็ว ๆ', 'ในอนาคต',
  'จะเปิดให้', 'จะมีให้', 'coming soon', 'soon'];
// ประกาศสำคัญพูดถึงเวลาข้างหน้าได้ ("ปิดปรับปรุงคืนวันเสาร์") แต่ห้ามแง้มฟีเจอร์ที่ยังไม่มี
const TEASE = ['เร็ว ๆ นี้', 'เร็วๆ นี้', 'เร็วๆนี้', 'กำลังจะมา', 'เตรียมพบ', 'รอติดตาม', 'coming soon'];

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
}
// ตัดเครื่องหมาย markdown กับช่องว่างที่ต่างกันทิ้ง — ยกมาตรงคำแต่ไม่ต้องตรงตัวหนา/ขึ้นบรรทัด
function norm(s) {
  return String(s).replace(/\r/g, '').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
}

// ---------- แพตช์โน้ต ----------
// หัวรุ่นมีสองแบบ: "# StudentOS Update 1C57 — ..." (ถึง 1C57) · "## 1C60: ..." / "## 1C59 — ..." (ตั้งแต่ 1C58)
// บางเลขมีหลายหัว (1C50 · 1C46) → รวมทุกหัวของเลขนั้น
// ส่วนของรุ่นจบที่หัวถัดไประดับเดียวกันหรือสูงกว่า — หัว "## ... (คงรุ่น 1C59)" ที่คั่นอยู่ไม่ใช่ของรุ่นก่อนหน้า
function releases() {
  const lines = readFileSync(PATCHNOTES, 'utf8').replace(/\r/g, '').split('\n');
  const heads = [];
  lines.forEach((l, i) => {
    const m = /^# StudentOS Update (\S+)/.exec(l) || /^## (\d[A-Z]\d+[a-z]?)(?::| —| -)/.exec(l);
    if (m) heads.push({ rel: m[1], at: i, lv: l.startsWith('## ') ? 2 : 1 });
  });
  const out = new Map();
  heads.forEach(h => {
    let end = h.at + 1;
    while (end < lines.length && !(/^#{1,2} /.test(lines[end]) && lines[end].match(/^#+/)[0].length <= h.lv)) end++;
    const body = lines.slice(h.at, end).join('\n');
    out.set(h.rel, (out.get(h.rel) ? out.get(h.rel) + '\n\n' : '') + body);
  });
  return { map: out, order: [...new Set(heads.map(h => h.rel))] };   // order = ใหม่สุดก่อน
}

// คอมมิตที่ทำให้ APP_VERSION เป็นเลขนั้นครั้งแรก
function introCommit(rel) {
  try {
    const l = git(['log', '--format=%H', '--reverse', `-SAPP_VERSION = '${rel}'`, '--', 'alt/app.js']).trim().split('\n')[0];
    return l || null;
  } catch (_) { return null; }
}
// ช่วงคอมมิตของรุ่น = หลังรุ่นก่อนหน้าเริ่ม → ถึงก่อนรุ่นถัดไปเริ่ม (รุ่นล่าสุด = ถึง HEAD)
function releaseRange(rel) {
  const { order } = releases();
  const i = order.indexOf(rel);
  if (i < 0) return null;
  const prev = order[i + 1] && introCommit(order[i + 1]);
  const next = i > 0 && introCommit(order[i - 1]);
  const to = next ? next + '~1' : 'HEAD';
  return { from: prev, to, spec: prev ? `${prev}..${to}` : to };
}

// ---------- evidence ----------
function evidence(rel) {
  const { map } = releases();
  if (!map.has(rel)) {
    console.error(`ไม่พบรุ่น ${rel} ใน PATCHNOTES.md — ประกาศได้เฉพาะรุ่นที่มีแพตช์โน้ตแล้ว`);
    process.exit(1);
  }
  const sec = map.get(rel);
  const r = releaseRange(rel);
  const commits = r ? git(['log', '--no-merges', '--format=%h%x09%ad%x09%s%n%b%x1e', '--date=short', r.spec]) : '';
  const stat = r ? git(['diff', '--stat=100', r.from ? r.from : r.to + '~1', r.to, '--', 'alt/']) : '';
  const notYet = sec.split('\n').filter(l => /ยังไม่/.test(l)).map(l => '- ' + l.trim());

  console.log(`# หลักฐานของรุ่น ${rel}

> ก้อนนี้คือ **สิ่งเดียว** ที่ประกาศอ้างได้ · ทุกประโยคต้องมีคำพูดที่ยกจากตรงนี้ (ดู alt/news/README.md)

## 1. แพตช์โน้ตของรุ่น (source: "patchnotes")

${sec.trim()}

## 2. คอมมิตในช่วงรุ่น ${r ? '`' + r.spec + '`' : '(หาช่วงไม่ได้)'} (source: "commit:<sha>")

${commits.split('\x1e').map(c => c.trim()).filter(Boolean).map(c => {
    const [head, ...rest] = c.split('\n');
    const [sha, date, subj] = head.split('\t');
    return `### ${sha} · ${date}\n${subj}\n${rest.join('\n').trim()}`;
  }).join('\n\n') || '(ไม่มี)'}

## 3. ไฟล์ใน alt/ ที่เปลี่ยน

\`\`\`
${stat.trim() || '(ไม่มี)'}
\`\`\`

## 4. บรรทัดที่บอกว่า "ยังไม่ ..." — ห้ามประกาศเป็นของที่ใช้ได้แล้ว

${notYet.join('\n') || '(ไม่มี)'}
`);
}

// ---------- check ----------
function check(only) {
  const { map } = releases();
  let html = '';
  try { html = readFileSync(join(ALT, 'index.html'), 'utf8'); } catch (_) {}
  // จอที่ปุ่มในประกาศพาไปได้ = รายการ NEWS_OPEN ใน news.js (จอที่ go() วาดเนื้อหาเองได้)
  let open = [];
  try {
    const m = /const NEWS_OPEN = \[([^\]]*)\]/.exec(readFileSync(join(ALT, 'news.js'), 'utf8'));
    if (m) open = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  } catch (_) {}
  const errs = [], warns = [];
  const commitMsg = new Map();
  const msgOf = sha => {
    if (!commitMsg.has(sha)) {
      try { commitMsg.set(sha, git(['show', '-s', '--format=%B', sha])); } catch (_) { commitMsg.set(sha, null); }
    }
    return commitMsg.get(sha);
  };
  const ids = new Set();
  let total = 0;

  for (const file of only && only.length ? only : FILES) {
    if (!existsSync(file)) { if (only && only.length) errs.push(`ไม่มีไฟล์ ${file}`); continue; }
    const name = file.startsWith(ALT) ? file.slice(ALT.length + 1).replace(/\\/g, '/') : basename(file);
    let doc;
    try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { errs.push(`${name}: JSON เสีย — ${e.message}`); continue; }
    if (doc.schema !== 1 || !Array.isArray(doc.items)) { errs.push(`${name}: ต้องเป็น { "schema": 1, "items": [...] }`); continue; }

    doc.items.forEach((it, n) => {
      total++;
      const at = `${name} · ${it && it.id || '#' + n}`;
      const bad = m => errs.push(`${at}: ${m}`);
      if (!it || typeof it !== 'object') return bad('ไม่ใช่ object');
      if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(it.id || '')) bad('id ต้องเป็น a-z 0-9 - (3–61 ตัว)');
      if (ids.has(it.id)) bad('id ซ้ำ'); ids.add(it.id);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(it.date || '') || isNaN(Date.parse(it.date))) bad('date ต้องเป็น YYYY-MM-DD');
      else if (Date.parse(it.date) > Date.now() + 864e5) bad('date อยู่ในอนาคต — ประกาศได้แค่ของที่ปล่อยแล้ว');
      if (!KINDS.includes(it.kind)) bad(`kind ต้องเป็นหนึ่งใน ${KINDS.join(' · ')}`);
      const notice = it.kind === 'notice';
      if (notice ? it.release != null && !map.has(it.release) : !map.has(it.release)) bad(`release "${it.release}" ไม่มีในแพตช์โน้ต`);
      if (it.until != null) {
        if (isNaN(Date.parse(it.until))) bad('until ต้องเป็นวันเวลา เช่น 2026-10-18T23:00:00+07:00');
        else if (Date.parse(it.until) <= Date.parse(it.date)) bad('until ต้องหลัง date');
        else if (Date.parse(it.until) < Date.now()) warns.push(`${at}: until พ้นไปแล้ว — แอปจะไม่แสดงประกาศนี้`);
      }
      if (it.by != null && (typeof it.by !== 'string' || !it.by.trim() || it.by.length > 30)) bad('by (ใครเขียน) ไม่เกิน 30 ตัวอักษร');
      if (typeof it.title !== 'string' || it.title.length < 4 || it.title.length > 60) bad('title 4–60 ตัวอักษร');
      if (typeof it.body !== 'string' || !it.body.trim() || it.body.length > 280) bad('body ต้องมี และไม่เกิน 280 ตัวอักษร');
      const points = it.points || [];
      if (!Array.isArray(points) || points.length > 5 || points.some(p => typeof p !== 'string' || !p.trim() || p.length > 120)) {
        bad('points เป็นรายการข้อความ ไม่เกิน 5 ข้อ ข้อละไม่เกิน 120 ตัวอักษร');
      }
      // promo = พาดหัวชวนลองสำหรับ Discord ของ tester (แอปไม่แสดง) — โปรโมทได้ แต่ต้องมีหลักฐานเหมือนช่องอื่น
      if (it.promo != null && (typeof it.promo !== 'string' || it.promo.length < 4 || it.promo.length > 100)) bad('promo 4–100 ตัวอักษร');
      // image = รูปประกอบ อยู่ใน alt/news/img/ (ส่งไป Discord · แอปไม่แสดง)
      if (it.image != null) {
        const f = join(ALT, 'news', String(it.image));
        if (!/^img\/[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|gif)$/.test(it.image)) bad('image ต้องเป็น img/<ชื่อไฟล์>.png|jpg|webp|gif (a-z 0-9 . _ -)');
        else if (!existsSync(f)) bad(`image ไม่มีไฟล์ alt/news/${it.image}`);
        else if (statSync(f).size > 2 << 20) bad('image ใหญ่เกิน 2 MB');
      }
      if (it.action != null) {
        const a = it.action;
        if (!a || typeof a.label !== 'string' || !a.label.trim() || a.label.length > 24) bad('action.label ต้องมี ไม่เกิน 24 ตัวอักษร');
        else if (!/^scr-[a-z0-9-]+$/.test(a.screen || '') || !html.includes(`id="${a.screen}"`)) bad(`action.screen "${a && a.screen}" ไม่มีจอนี้ใน index.html`);
        else if (!open.includes(a.screen)) bad(`action.screen "${a.screen}" ไม่อยู่ใน NEWS_OPEN ของ news.js — ปุ่มจะไม่แสดง`);
      }

      // คำที่สัญญาของที่ยังไม่ปล่อย
      const texts = [['title', it.title], ['body', it.body], ...points.map((p, k) => ['points.' + k, p]),
        ...(it.promo != null ? [['promo', it.promo]] : []),
        ...(it.action ? [['action', it.action.label]] : [])];
      for (const [f, t] of texts) {
        const low = String(t || '').toLowerCase();
        const hit = (notice ? TEASE : FUTURE).find(w => low.includes(w));
        if (hit) bad(`${f} มีคำว่า "${hit}" — ประกาศพูดได้แค่ของที่ใช้ได้แล้ว`);
      }

      // หลักฐาน: ทุกช่องที่ผู้ใช้อ่าน ต้องมีอย่างน้อยหนึ่งชิ้นที่ยืนยันได้
      const ev = Array.isArray(it.evidence) ? it.evidence : [];
      const covered = new Set();
      const sec = norm(map.get(it.release) || '');
      ev.forEach((e, k) => {
        const where = `evidence[${k}]`;
        if (!e || typeof e.quote !== 'string' || norm(e.quote).length < 8) return bad(`${where}: quote ต้องยาวอย่างน้อย 8 ตัวอักษร`);
        const q = norm(e.quote);
        let ok = false;
        if (e.source === 'patchnotes') {
          ok = sec.includes(q);
          if (!ok) bad(`${where}: หาคำพูดนี้ไม่เจอในแพตช์โน้ตรุ่น ${it.release} — "${e.quote.slice(0, 60)}"`);
        } else if (/^commit:[0-9a-f]{7,40}$/.test(e.source || '')) {
          const msg = msgOf(e.source.slice(7));
          if (msg == null) bad(`${where}: ไม่มีคอมมิต ${e.source.slice(7)}`);
          else { ok = norm(msg).includes(q); if (!ok) bad(`${where}: หาคำพูดนี้ไม่เจอในข้อความคอมมิต — "${e.quote.slice(0, 60)}"`); }
        } else if (e.source === 'owner') {
          // คำพูดของเจ้าของที่สั่งให้ประกาศ — เครื่องพิสูจน์ไม่ได้ว่าเจ้าของพูดจริง ด่านนี้คือเจ้าของตอนอนุมัติ
          if (!notice) bad(`${where}: source "owner" ใช้ได้กับประกาศสำคัญ (notice) เท่านั้น — ข่าวจากรุ่นแอปต้องอ้างแพตช์โน้ตหรือคอมมิต`);
          else if (!/^\d{4}-\d{2}-\d{2}$/.test(e.said || '')) bad(`${where}: ต้องมี "said" (วันที่เจ้าของสั่ง YYYY-MM-DD)`);
          else {
            ok = true;
            warns.push(`${at} ${where}: อ้างคำพูดเจ้าของ (${e.said}) — เครื่องยืนยันไม่ได้ เจ้าของต้องอ่านเองก่อนเผยแพร่`);
          }
        } else bad(`${where}: source ต้องเป็น "patchnotes" · "commit:<sha>" · หรือ "owner" (เฉพาะประกาศสำคัญ)`);
        if (ok) {
          if (/ยังไม่/.test(q)) warns.push(`${at} ${where}: ยกมาจากประโยคที่มีคำว่า "ยังไม่" — เช็คว่าไม่ได้ประกาศของที่ยังไม่เสร็จ`);
          for (const f of [].concat(e.for || [])) covered.add(f);
        }
      });
      for (const [f] of texts) {
        if (f === 'action') continue;   // ปุ่มเช็คแล้วว่าจอมีจริง
        if (!covered.has(f)) bad(`${f} ไม่มีหลักฐานที่ยืนยันได้ — ใส่ evidence ที่ "for" ชี้มาที่ "${f}"`);
      }
    });
  }

  // แอปหลัก (ราก) อ่านไฟล์ข่าวของตัวเองที่ news/announcements.json — แยกจาก alt/ ตั้งแต่ 21 ต.ค. 69
  // ข่าวต้องตรงกันทั้งสองไฟล์ ไม่งั้นผู้ใช้เว็บจริงไม่เห็นข่าวที่ส่งเข้า Discord ไปแล้ว
  const rootFile = join(ROOT, 'news', 'announcements.json');
  if (!(only && only.length) && existsSync(rootFile)) {
    const ids = f => (JSON.parse(readFileSync(f, 'utf8')).items || []).map(it => it.id).join(',');
    const a = ids(FILES[0]), r = ids(rootFile);
    if (a !== r) errs.push(`news/announcements.json (แอปหลัก) ไม่ตรงกับ alt/news/announcements.json — ก๊อป items ไปให้ตรงกัน\n    alt : ${a}\n    ราก: ${r}`);
  }

  warns.forEach(w => console.warn('เตือน · ' + w));
  if (errs.length) {
    errs.forEach(e => console.error('ผิด · ' + e));
    console.error(`\nไม่ผ่าน — ${errs.length} จุด จาก ${total} ประกาศ`);
    process.exit(1);
  }
  console.log(`ผ่าน — ${total} ประกาศ ทุกประโยคมีหลักฐานที่หาเจอจริง`);
}

const [cmd, arg, ...more] = process.argv.slice(2);
if (cmd === 'evidence' && arg) evidence(arg);
else if (cmd === 'check') check([arg, ...more].filter(Boolean));   // ไม่ใส่ไฟล์ = ตรวจทั้งสองไฟล์ใน alt/news/
else {
  console.log('ใช้: node alt/devtools/news.mjs evidence <รุ่น>   |   node alt/devtools/news.mjs check');
  process.exit(cmd ? 1 : 0);
}
