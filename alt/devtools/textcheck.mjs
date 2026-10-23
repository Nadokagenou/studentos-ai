// ตัวหนังสืออ่านออกไหม — ทุกธีม ทุกจอหลัก (17 ต.ค. 69)
// ------------------------------------------------------------
// เจ้าของ: "ตรวจสอบพวกฟอนต์หรือข้อความที่ยังไม่ชัดในแต่ละธีมและแก้ด้วย"
// วัดจากภาพที่วาดออกมาจริง ไม่ใช่จากตารางโทเคนหรือการไล่ DOM: ทุกชิ้นที่มีตัวหนังสือและมองเห็นอยู่ในจอ
//   ① ความต่างของสีกับพื้นหลังจริง (WCAG) — ซ่อนเฉพาะตัวอักษร (-webkit-text-fill-color: transparent) แล้วถ่ายภาพจอ
//      อ่านสีพิกเซลที่อยู่ใต้ตัวอักษรของแต่ละชิ้นจริง ๆ → ได้พื้นที่ตาเห็น รวมกระจก (::before) · แถบเลื่อนข้างหลัง · ฉากของธีม · รูป
//      (ลองไล่พื้นจาก DOM ก่อนแล้ว — พลาดพื้นที่วาดด้วย ::before / ชิ้นพี่น้อง เช่นปุ่มหลักขาวบนน้ำเงินได้ 2.3 ทั้งที่อ่านชัด)
//      ความจาง (opacity) ของชิ้นและพ่อแม่คูณเข้าไปที่สีตัวหนังสือ · ใช้ค่าที่ 10% แย่สุดของพิกเซลพื้น (พื้นมีลายก็ไม่ถูกเฉลี่ยกลบ)
//      เกณฑ์: ตัวปกติ ≥ 4.5 · ตัวใหญ่ (≥24px หรือ ≥18.66px หนา) ≥ 3 (DESIGN.md ข้อ 2)
//   ② ขนาด: ประโยคที่ต้องอ่านต้อง ≥ 11px (DESIGN.md ข้อ 3 · ต่ำกว่านี้ได้เฉพาะตัวเลขในแบดจ์)
//   ③ ฟอนต์: ข้อความไทยต้องมีฟอนต์ไทย (Sarabun ฯลฯ) อยู่ในลำดับฟอนต์ — ไม่งั้นตัวไทยตกไปฟอนต์ของเครื่อง
// ตัวหนังสือไล่สี (background-clip:text) = วัดทุกสีในไล่สี เอาค่าที่แย่สุด (ตอนถ่ายพื้นปิดไล่สีของชิ้นนั้น)
// ข้าม: ปุ่มที่ปิดใช้ (WCAG ยกเว้น) · ของที่ซ่อนจากโปรแกรมอ่านจอ (aria-hidden)
//   · ดาวเรทติ้งล้วน ★☆ (มีคำว่า "ด่วนมาก" ฯลฯ กำกับเสมอ ดาวว่างจางโดยตั้งใจ)
//   · ส่วนที่มีชิ้นอื่นทับ (แถบล่างลอย ฯลฯ) — มองไม่เห็นอยู่แล้ว วัดตอนเลื่อนแล้วโผล่ออกมาแทน
// ขอบนุ่มรอบตัวอักษร (text-shadow) นับเป็นพื้นด้วย — ซ่อนแค่ตัวอักษร เงายังอยู่ เพราะตาเห็นขอบนั้นจริง
// ภาพนิ่ง: ตั้ง prefers-reduced-motion ให้ฉาก/อนิเมชันหยุด วัดซ้ำได้ผลเดิม
//
// ใช้: (เปิดเซิร์ฟเวอร์ที่รากของ repo ก่อน: python -m http.server 5173)
//   node alt/devtools/textcheck.mjs                  → ทุกธีม
//   node alt/devtools/textcheck.mjs space ocean      → เฉพาะธีมที่ระบุ
//   JSON=out.json node alt/devtools/textcheck.mjs    → เก็บรายละเอียดทุกชิ้นที่ไม่ผ่าน
// จบด้วยรหัส 1 เมื่อมีตัวหนังสือที่ไม่ผ่านเกณฑ์
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
// 23 ต.ค. 69 · ธีมจากอีเวนต์ฮาโลวีน (alt/halloween/rewards) — เดิมไม่อยู่ในรายชื่อ จึงไม่เคยถูกตรวจ
//   moonlight:light = Moon & Candle โทนแสงจันทร์ (ธีมเดียวมีสองชุดสี สลับด้วย data-hw-tone)
const ALL = ['light', 'dark', 'warm', 'space', 'earth', 'ocean', 'magic', 'galaxy', 'deepocean', 'earth2', 'sweet', 'genesis', 'meta', 'glitch', 'astral',
  'halloween', 'moonlight', 'moonlight:light', 'hw-ghostship', 'hw-jackhollow', 'hw-vampire', 'hw-graveyard'];
const ARG_T = process.argv.slice(2).filter(a => ALL.includes(a));
const THEMES = ARG_T.length ? ARG_T : ALL;
const SCREENS = (process.env.SCREENS || 'scr-menu,scr-tasks,scr-timeline,scr-plan,scr-why,scr-ai,scr-profile,scr-settings,scr-stats,scr-context,scr-notif,scr-room,scr-shop,scr-badges,scr-explore,scr-news').split(',');
const APP = process.env.APP || 'http://localhost:5173/alt/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LITE = process.env.LITE || '0';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = Date.now(), iso = h => new Date(now + h * 3600e3).toISOString();
const SUBJ = ['ฟิสิกส์', 'ภาษาอังกฤษ', 'คณิตศาสตร์', 'สังคมศึกษา', 'เคมี'];
const tasks = [];
for (let i = 0; i < 8; i++) tasks.push({ id: 'p' + i, subject: SUBJ[i % 5], detail: 'งานทดสอบ ' + i, estMin: 30 + i * 5, due: iso(3 + i * 11), done: false, createdAt: iso(-48), isExam: i === 3 });
for (let i = 0; i < 12; i++) tasks.push({ id: 'd' + i, subject: SUBJ[i % 5], detail: 'งานเสร็จ ' + i, estMin: 30, due: iso(-i * 9), done: true, doneAt: iso(-i * 9.5), createdAt: iso(-i * 9.5 - 30) });
const seed = { 'studentos.alt.onboardSkipped': '1', 'studentos.alt.skipLogin': '1', 'studentos.alt.theme': 'light', 'studentos.alt.lite': LITE, 'studentos.alt.checkinAsked': new Date().toISOString().slice(0, 10),
  'studentos.alt.v1': JSON.stringify({ tasks, settings: { name: 'ทดสอบ', freeHours: 2.5 }, marks: [], sessions: [], running: null }) };

// ---------- PNG (ภาพจอจาก Chrome) → พิกเซล RGBA ----------
function decodePng(buf) {
  let o = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (o < buf.length) { const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; } else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; o += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(w * h * 4); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      if (f === 1) line[i] = (line[i] + a) & 255; else if (f === 2) line[i] = (line[i] + b) & 255; else if (f === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; } }
    for (let x = 0; x < w; x++) { px[(y * w + x) * 4] = line[x * bpp]; px[(y * w + x) * 4 + 1] = line[x * bpp + 1]; px[(y * w + x) * 4 + 2] = line[x * bpp + 2]; px[(y * w + x) * 4 + 3] = 255; }
    prev = line; }
  return { w, h, px };
}
const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

// ---------- ในหน้า: ชิ้นที่มีตัวหนังสือที่มองเห็น + กรอบของตัวอักษรจริง ----------
const COLLECT = `(() => {
  const okToRgb = (L, a, b, al) => { const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    return lin.map(v => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }).concat(al); };
  const al = x => x == null ? 1 : (String(x).endsWith('%') ? parseFloat(x) / 100 : +x);
  const parse = s => { s = String(s).trim(); let m;
    if ((m = s.match(/^rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:\\s*[,/]\\s*([\\d.]+%?))?\\s*\\)$/))) return [+m[1], +m[2], +m[3], al(m[4])];
    if ((m = s.match(/^color\\(srgb\\s+([-\\d.e]+)\\s+([-\\d.e]+)\\s+([-\\d.e]+)(?:\\s*\\/\\s*([\\d.]+%?))?\\s*\\)$/))) return [m[1] * 255, m[2] * 255, m[3] * 255, al(m[4])];
    if ((m = s.match(/^oklab\\(\\s*([-\\d.e]+%?)\\s+([-\\d.e]+)\\s+([-\\d.e]+)(?:\\s*\\/\\s*([\\d.]+%?))?\\s*\\)$/))) return okToRgb(m[1].endsWith('%') ? parseFloat(m[1]) / 100 : +m[1], +m[2], +m[3], al(m[4]));
    if ((m = s.match(/^oklch\\(\\s*([-\\d.e]+%?)\\s+([-\\d.e]+)\\s+([-\\d.e]+)(?:deg)?(?:\\s*\\/\\s*([\\d.]+%?))?\\s*\\)$/))) { const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : +m[1], h = +m[3] * Math.PI / 180; return okToRgb(L, +m[2] * Math.cos(h), +m[2] * Math.sin(h), al(m[4])); }
    return null; };
  const scope = [document.querySelector('.screen.on'), document.querySelector('.tabbar')].filter(Boolean);
  const items = []; let gradText = 0;
  for (const sc of scope) for (const el of sc.querySelectorAll('*')) {
    const nodes = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    const own = nodes.map(n => n.textContent).join('').replace(/\\s+/g, ' ').trim();
    if (!own || /^[\\s·•|/,.:;()\\[\\]–—-]+$/.test(own)) continue;
    // ดาวเรทติ้งล้วน = ภาพประกอบของป้ายข้าง ๆ ("ด่วนมาก") ข้อมูลซ้ำกับคำ · ดาวว่างจางโดยตั้งใจ — ไม่นับ
    if (/^[★☆\\s]+$/.test(own)) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.closest('[aria-hidden="true"], :disabled, [aria-disabled="true"], .sr-only')) continue;
    // ของใน <details> ที่ปิดอยู่: Chrome รุ่นใหม่ยังให้กรอบมีขนาด แต่ไม่วาดตัวอักษร → วัดได้พื้นทับพื้น ~1.0:1 ทั้งที่ไม่ได้โชว์
    // (23 ต.ค. 69 · ปุ่ม "ตั้งปิดเทอม" ในจอบริบทฟ้อง 1.04 ทุกธีม · เปิดหัวข้อแล้วอ่านชัด)
    { const d = el.closest('details'); if (d && !d.open && !el.closest('summary')) continue; }
    // ตัวหนังสือไล่สี (background-clip: text) — สีตัวหนังสือ = ทุกสีในไล่สี (เอาค่าที่แย่สุด) · ตอนถ่ายพื้นปิดไล่สีของชิ้นนี้ (data-tc-grad)
    let stops = null;
    if (/rgba[(]0, 0, 0, 0[)]/.test(cs.webkitTextFillColor) && /text/.test(cs.backgroundClip + cs.webkitBackgroundClip)) {
      stops = (cs.backgroundImage.match(/(rgba?|color|oklab|oklch)[(][^)]*[)]/g) || []).map(parse).filter(Boolean);
      // จุดโปร่งใสของชั้นประกายที่วิ่งผ่าน (Astral) ไม่ใช่สีตัวหนังสือ — ชั้นไล่สีข้างใต้แสดงแทน
      if (stops.some(c => c[3] >= 0.5)) stops = stops.filter(c => c[3] >= 0.5);
      if (!stops.length) { gradText++; continue; }
      el.setAttribute('data-tc-grad', '1');
    }
    const rects = [];
    for (const n of nodes) { const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) { const x = Math.max(0, b.left), y = Math.max(0, b.top), x2 = Math.min(innerWidth, b.right), y2 = Math.min(innerHeight, b.bottom); if (x2 - x < 2 || y2 - y < 4) continue;
        // บรรทัดที่ขอบจอตัดไปบางส่วน = อยู่ใต้เงาไล่จางของกล่องเลื่อน (ตั้งใจให้จาง) — วัดตอนเลื่อนจนเห็นทั้งบรรทัด
        // (เคยได้ 3.23 จากเศษบรรทัดสูง 5px ที่ขอบล่าง ทั้งที่บรรทัดเต็มได้ 5.68)
        if (y2 - y < (b.bottom - b.top) * 0.9) continue;
        // มีชิ้นอื่นทับอยู่ (แถบล่างลอย · หัวจอที่ค้างบน) = ตอนนี้มองไม่เห็นอยู่แล้ว ข้ามไปวัดตอนเลื่อนแล้วโผล่ออกมา
        // (เคยอ่านสีของแถบล่างแทนพื้นจริง → ตัวเขียวบนพื้นขาวได้ 1.15)
        const top = document.elementFromPoint((x + x2) / 2, (y + y2) / 2);
        if (top && !el.contains(top) && !top.contains(el)) continue;
        rects.push([x, y, x2 - x, y2 - y]); } }
    if (!rects.length) continue;
    let op = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
    if (op < 0.05) continue;
    const fg = stops ? stops[0] : parse(cs.color); if (!fg) continue;
    const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight || 400, thai = /[\\u0E00-\\u0E7F]/.test(own);
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const key = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') + (el.parentElement && typeof el.parentElement.className === 'string' && el.parentElement.className.trim() ? ' < ' + el.parentElement.className.trim().split(/\\s+/)[0] : '');
    items.push({ key, text: own.slice(0, 28), rects, fg, stops, op, fs, fw, fam,
      large: fs >= 24 || (fs >= 18.66 && fw >= 700),
      tiny: fs < 11 && own.length > 1 && !/^[\\d\\s+.,:%/×x★☆-]{1,6}$/.test(own),
      // ฟอนต์ประจำธีมที่เป็นละตินล้วน (Orbitron ของ meta) ตั้งใจให้ตัวไทยตกไป Sarabun ในลำดับถัดไป = ไม่ผิด
      // ที่ผิด = ข้อความไทยที่ลำดับฟอนต์ไม่มีฟอนต์ไทยเลย → ตัวไทยไปตกที่ฟอนต์อะไรก็ได้ของเครื่อง (ไม่มีหัว/ไม่เข้าชุด)
      badFont: thai && !/sarabun|leelawadee|noto sans thai|ibm plex sans thai|thonburi/i.test(cs.fontFamily),
      // เงาไม่เยื้อง (ขอบนุ่มรองตัวอักษร) = ส่วนหนึ่งของพื้นที่ตาเห็น → วัดจากภาพที่มีเงา
      // เงาเยื้อง (ลายแยกสีของ glitch ฯลฯ) = ลายตกแต่งที่ตัวอักษรทับอยู่ → วัดจากภาพที่ไม่มีเงา
      // (ไม่ใช้ backslash ในนี้ — ทั้งก้อนเป็น template string ของ Node · \\d จะเหลือแค่ d)
      halo: cs.textShadow !== 'none' && cs.textShadow.replace(/(rgba?|color|oklab|oklch)[(][^)]*[)]/g, '').split(',')
        .every(sh => { const n = sh.trim().split(' ').map(parseFloat); return n[0] === 0 && n[1] === 0; }) });
  }
  return { items, gradText, w: innerWidth };
})()`;
const HIDE = keepShadow => `(() => { let s = document.getElementById('__tcHide'); if (!s) { s = document.createElement('style'); s.id = '__tcHide'; document.head.appendChild(s); }
  s.textContent = '*, *::before, *::after { -webkit-text-fill-color: transparent !important; caret-color: transparent !important;${keepShadow ? '' : ' text-shadow: none !important;'} } [data-tc-grad] { background-image: none !important; }';
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))})()`;
const SHOW = `(() => { const s = document.getElementById('__tcHide'); if (s) s.remove(); return 1; })()`;

async function run() {
  const PORT = 9600 + Math.floor(Math.random() * 300);
  const prof = mkdtempSync(join(tmpdir(), 'textcheck-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--window-size=375,812', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let ver; for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let seq = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const S = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  const cmd = (m, p) => send(m, p, S);
  const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? { __err: r.exceptionDetails.exception?.description?.split('\n')[0] } : r.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });   // ภาพนิ่ง วัดซ้ำได้ผลเดิม
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `try { delete Navigator.prototype.serviceWorker; } catch (e) {}` });
  await cmd('Page.navigate', { url: APP }); await sleep(2500);
  await ev(`(()=>{localStorage.clear();const s=${JSON.stringify(seed)};for(const k in s)localStorage.setItem(k,s[k]);return 1})()`);
  await cmd('Page.navigate', { url: APP });
  for (let i = 0; i < 120; i++) { if ((await ev(`typeof go === 'function' && !!document.querySelector('.td-now') && (!document.getElementById('boot') || document.getElementById('boot').classList.contains('out'))`)) === true) break; await sleep(250); }
  await sleep(800);
  const measure = async () => {
    const c = await ev(COLLECT); if (!c || c.__err) return { err: c && c.__err };
    await ev(HIDE(true));
    const shotA = await cmd('Page.captureScreenshot', { format: 'png' });
    await ev(HIDE(false));
    const shotB = await cmd('Page.captureScreenshot', { format: 'png' });
    await ev(SHOW);
    const imgA = decodePng(Buffer.from(shotA.data, 'base64')), imgB = decodePng(Buffer.from(shotB.data, 'base64')); const k = imgA.w / c.w;
    const rows = [];
    for (const it of c.items) {
      const img = it.halo ? imgA : imgB;
      const fa = it.fg[3] * it.op, vals = [];
      for (const [x, y0, w, h0] of it.rects) {
        // อ่านเฉพาะช่วงกลางของบรรทัด (ตัด 20% บน-ล่าง = ช่องว่างเหนือ/ใต้ตัวอักษร) — กรอบบรรทัดสูงกว่าตัวอักษร
        // ชิ้นข้าง ๆ ที่ยื่นมาทับแค่ช่องว่างนั้น (ปุ่ม + บนแถบล่างทับขอบบนของคำว่า "เพิ่ม") ไม่ได้บังตัวอักษร
        const y = y0 + h0 * 0.2, h = h0 * 0.6;
        const step = Math.max(1, Math.floor(Math.min(w, h) * k / 10));
        for (let py = Math.floor(y * k); py < Math.min(img.h, (y + h) * k); py += step) for (let px = Math.floor(x * k); px < Math.min(img.w, (x + w) * k); px += step) {
          const i = (py * img.w + px) * 4, br = img.px[i], bg = img.px[i + 1], bb = img.px[i + 2];
          let worst = 99;
          for (const f of (it.stops || [it.fg])) { const a = it.stops ? f[3] * it.op : fa;
            worst = Math.min(worst, ratio(lum(f[0] * a + br * (1 - a), f[1] * a + bg * (1 - a), f[2] * a + bb * (1 - a)), lum(br, bg, bb))); }
          vals.push(worst);
        } }
      if (!vals.length) continue;
      vals.sort((a, b) => a - b);
      const worst = vals[Math.floor(vals.length * 0.1)];
      rows.push({ ...it, ratio: +worst.toFixed(2), need: it.large ? 3 : 4.5, rects: undefined });
    }
    return { rows, gradText: c.gradText };
  };
  const res = {};
  for (const th of THEMES) {
    const [thName, thTone] = th.split(':');
    // ตั้งโทนก่อนธีม — theme-main.js ฟัง data-theme แล้ววาดฉากตามโทนที่ติดอยู่ตอนนั้น
    const applied = await ev(`(()=>{ const r = document.documentElement; r.dataset.hwTone = '${thTone || 'dark'}'; r.dataset.theme = '${thName}'; return r.dataset.theme + ':' + r.dataset.hwTone })()`);
    if (applied !== thName + ':' + (thTone || 'dark')) throw new Error('ธีมไม่ติด: ' + th + ' ได้ ' + applied);
    await sleep(400);
    res[th] = { checked: 0, gradText: 0, fails: [] };
    for (const id of SCREENS) {
      await ev(`(()=>{ for (let i=0;i<5&&typeof openOverlayEl==='function'&&openOverlayEl();i++) dismissTopOverlay(); go('${id}'); return 1 })()`);
      await sleep(600);
      const seenKey = new Set();
      for (let p = 0; p < 4; p++) {
        if (p) { const moved = await ev(`(() => { const s = document.querySelector('.screen.on'); let any = false; [s, ...s.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)).forEach(e => { const t = Math.min(e.scrollHeight - e.clientHeight, ${p} * innerHeight * 0.8); if (t > e.scrollTop + 20) { e.scrollTop = t; any = true; } }); return any; })()`); if (moved !== true) break; await sleep(300); }
        const m = await measure();
        if (m.err) { res[th].fails.push({ scr: id, key: 'วัดไม่ได้', text: String(m.err), ratio: 0, need: 0 }); break; }
        res[th].gradText += m.gradText;
        for (const r of m.rows) { const k = r.key + '|' + r.text; if (seenKey.has(k)) continue; seenKey.add(k); res[th].checked++;
          if (r.ratio < r.need || r.tiny || r.badFont) res[th].fails.push({ scr: id, ...r }); }
      }
      await ev(`(() => { const s = document.querySelector('.screen.on'); [s, ...s.querySelectorAll('*')].forEach(e => { if (e.scrollTop) e.scrollTop = 0; }); return 1; })()`);
    }
  }
  ws.close(); proc.kill(); await sleep(400); try { rmSync(prof, { recursive: true, force: true }); } catch {}
  return res;
}

const res = await run();
let bad = 0; const all = [];
for (const th of THEMES) {
  const r = res[th]; const contrast = r.fails.filter(f => f.ratio < f.need), tiny = r.fails.filter(f => f.tiny), font = r.fails.filter(f => f.badFont);
  bad += r.fails.length; all.push(...r.fails.map(f => ({ theme: th, ...f })));
  console.log(`${th.padEnd(10)} ตรวจ ${String(r.checked).padStart(4)} ชิ้น · สีจางเกิน ${String(contrast.length).padStart(3)} · เล็กเกิน ${String(tiny.length).padStart(2)} · ฟอนต์ผิด ${font.length}${r.gradText ? ' · (ตัวไล่สี ข้าม ' + r.gradText + ')' : ''}`);
}
// รวมตามชิ้น (คลาส) ข้ามธีม — แก้ที่ต้นเหตุทีเดียวได้หลายธีม
const groups = new Map();
for (const f of all) { const g = groups.get(f.key) || { key: f.key, themes: new Set(), worst: 99, sample: f, tiny: false, badFont: false }; g.themes.add(f.theme);
  if (f.ratio < f.need && f.ratio < g.worst) { g.worst = f.ratio; g.sample = f; } g.tiny = g.tiny || f.tiny; g.badFont = g.badFont || f.badFont; groups.set(f.key, g); }
const list = [...groups.values()].sort((a, b) => b.themes.size - a.themes.size || a.worst - b.worst);
console.log(`\n=== ${list.length} กลุ่ม (เรียงตามจำนวนธีมที่เจอ) ===`);
list.slice(0, +(process.env.TOP || 80)).forEach(g => console.log(`${String(g.themes.size).padStart(2)} ธีม · ${g.worst < 99 ? g.worst.toFixed(2) + '/' + g.sample.need : '—'}${g.tiny ? ' · เล็ก ' + g.sample.fs + 'px' : ''}${g.badFont ? ' · ฟอนต์ ' + g.sample.fam : ''} · ${g.key} "${g.sample.text}" (${g.sample.theme}/${g.sample.scr} ${g.sample.fs}px op${(+g.sample.op).toFixed(2)}) [${[...g.themes].join(' ')}]`));
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(all, null, 1));
console.log(bad ? `\ntextcheck: ไม่ผ่าน ${bad} รายการ` : '\ntextcheck: ผ่านทุกธีม');
process.exit(bad ? 1 : 0);
