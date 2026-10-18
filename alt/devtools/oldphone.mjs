// มือถือรุ่นเก่า: iPhone 6s · 7 · SE รุ่นแรก อัปได้สุด iOS 15 (Safari 15) — แอปต้องยังใช้ได้และอ่านออก (17 ต.ค. 69)
// ------------------------------------------------------------
// ไม่มี iPhone ให้ลอง จึงจำลองบน Chrome ให้ "ไม่รู้จัก" ของที่ Safari 15 ไม่มี แบบเดียวกับที่ Safari ทำจริง:
//   · color-mix()  (Safari 16.2) — ดักไฟล์ CSS ที่หน้าโหลด เปลี่ยนชื่อฟังก์ชันให้ผิด → ประกาศที่ใช้ถูกทิ้งเหมือนบน Safari 15
//                                 และ CSS.supports('color', 'color-mix(…)') ตอบ false เหมือนเครื่องจริง
//   · AbortSignal.timeout (16.0) · Object.hasOwn · Array.prototype.at · crypto.randomUUID (15.4) — ลบทิ้งก่อนแอปโหลด
//     (iOS 15.0–15.3 ไม่มีสามตัวหลัง · ทุกรุ่นของ iOS 15 ไม่มีตัวแรก)
// แล้วเทียบสไตล์ที่คำนวณแล้วของทุกชิ้นที่มองเห็นในจอหลัก กับ Chrome ปกติ (ค่าเผื่อสี ±3/255 · ความทึบ ±0.02)
//
// ใช้: (เปิดเซิร์ฟเวอร์ที่รากของ repo ก่อน: python -m http.server 5173)
//   node alt/devtools/oldphone.mjs                    → ธีม ocean
//   THEME=space node alt/devtools/oldphone.mjs        → ธีมอื่น
//   SHOTS=1 node alt/devtools/oldphone.mjs            → เก็บภาพทั้งสองโหมดไว้ที่ oldphone-shots/
//   NOCOMPAT=1 node alt/devtools/oldphone.mjs         → ไม่โหลด compat.js (ต้องล้ม — 17 ต.ค. ล้ม 9 ข้อ · หาย 109 ชิ้น)
// จบด้วยรหัส 1 เมื่อ: หัวการ์ด "ตอนนี้" ไม่มีพื้น · มี error ตอนใช้งาน · ฟังก์ชันที่ขาดไม่ถูกเติม · สีต่างจากเครื่องใหม่เกินค่าเผื่อ
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const THEME = process.env.THEME || 'ocean';
const APP = process.env.APP || 'http://localhost:5173/alt/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = process.env.SHOTS === '1';
const THEME2 = process.env.THEME2 || (THEME === 'dark' ? 'light' : 'dark');   // ธีมที่สลับไปกลางทาง
const NOCOMPAT = process.env.NOCOMPAT === '1';   // ไม่โหลด compat.js — ต้องล้ม (พิสูจน์ว่าเทสต์จับบั๊กได้จริง)
const SCREENS = ['scr-menu', 'scr-tasks', 'scr-timeline', 'scr-plan', 'scr-why', 'scr-ai', 'scr-profile', 'scr-settings', 'scr-stats', 'scr-context', 'scr-notif', 'scr-room', 'scr-shop', 'scr-badges', 'scr-explore', 'scr-form'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = Date.now(), iso = h => new Date(now + h * 3600e3).toISOString();
const SUBJ = ['ฟิสิกส์', 'ภาษาอังกฤษ', 'คณิตศาสตร์', 'สังคมศึกษา', 'เคมี'];
const tasks = [];
for (let i = 0; i < 8; i++) tasks.push({ id: 'p' + i, subject: SUBJ[i % 5], detail: 'งานทดสอบ ' + i, estMin: 30 + i * 5, due: iso(3 + i * 11), done: false, createdAt: iso(-48), isExam: i === 3 });
for (let i = 0; i < 12; i++) tasks.push({ id: 'd' + i, subject: SUBJ[i % 5], detail: 'งานเสร็จ ' + i, estMin: 30, due: iso(-i * 9), done: true, doneAt: iso(-i * 9.5), createdAt: iso(-i * 9.5 - 30) });
const seed = { 'studentos.alt.onboardSkipped': '1', 'studentos.alt.skipLogin': '1', 'studentos.alt.theme': THEME, 'studentos.alt.lite': '1', 'studentos.alt.checkinAsked': new Date().toISOString().slice(0, 10),
  'studentos.alt.v1': JSON.stringify({ tasks, settings: { name: 'ทดสอบ', freeHours: 2.5 }, marks: [], sessions: [], running: null }) };
// ของที่ Safari 15 ไม่มี — ลบก่อนแอปโหลด
const OLD_JS = `(() => {
  const sup = CSS.supports.bind(CSS);
  CSS.supports = function (a, b) { if (/color-mix/i.test(String(a) + ' ' + String(b || ''))) return false; return arguments.length > 1 ? sup(a, b) : sup(a); };
  try { AbortSignal.timeout = undefined; } catch (e) {}
  try { delete Object.hasOwn; } catch (e) {}
  try { delete Array.prototype.at; } catch (e) {}
  try { if (window.crypto) Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }); } catch (e) {}
})();`;
// ลายเซ็นสไตล์ของทุกชิ้นที่มองเห็นในจอ (+ แถบล่าง)
const SIG = `(() => { const out = []; const roots = [document.querySelector('.screen.on'), document.querySelector('.tabbar')].filter(Boolean);
  for (const root of roots) for (const e of [root, ...root.querySelectorAll('*')]) { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    out.push({ k: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''),
      color: own ? cs.color : '', bg: cs.backgroundColor, img: cs.backgroundImage, border: cs.borderTopWidth === '0px' ? '' : cs.borderTopColor, shadow: cs.boxShadow, text: own ? (e.textContent || '').trim().slice(0, 20) : '' }); }
  return out; })()`;
// สี: rgb()/rgba()/color(srgb …) → [r,g,b,a] (0–255, 0–1)
const COLOR_RE = /rgba?\([^)]*\)|color\(srgb[^)]*\)/g;
const parseColor = s => { let m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4])];
  m = s.match(/^color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
  if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4])];
  return null; };
const sameColor = (a, b) => { if (a === b) return true; const x = parseColor(a), y = parseColor(b); if (!x || !y) return false;
  if (x[3] < 0.02 && y[3] < 0.02) return true; return Math.abs(x[0] - y[0]) <= 3 && Math.abs(x[1] - y[1]) <= 3 && Math.abs(x[2] - y[2]) <= 3 && Math.abs(x[3] - y[3]) <= 0.02; };
// พื้นไล่สี/เงา: โครงต้องเหมือนกัน และสีข้างในต้องใกล้กันทุกตัว
const sameComposite = (a, b) => { if (a === b) return true; const ca = a.match(COLOR_RE) || [], cb = b.match(COLOR_RE) || [];
  if (a.replace(COLOR_RE, 'C') !== b.replace(COLOR_RE, 'C') || ca.length !== cb.length) return false; return ca.every((c, i) => sameColor(c, cb[i])); };

async function run(mode) {
  const PORT = 9700 + Math.floor(Math.random() * 250);
  const prof = mkdtempSync(join(tmpdir(), 'oldphone-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--window-size=375,812', 'about:blank'], { stdio: 'ignore' });
  let ver; for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let seq = 0, S; const pend = new Map(); const errs = []; let intercepted = 0;
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
  ws.onmessage = async m => { const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); return; }
    const P = d.params || {};
    if (d.method === 'Runtime.exceptionThrown') { const fr = P.exceptionDetails.stackTrace?.callFrames?.[0]; errs.push((P.exceptionDetails.exception?.description || P.exceptionDetails.text || '').split('\n')[0].slice(0, 160) + (fr ? ` @ ${fr.url.replace(/^.*\/alt\//, '').replace(/\?.*$/, '')}:${fr.lineNumber + 1}` : '')); }
    if (d.method === 'Runtime.consoleAPICalled' && P.type === 'error') errs.push('console.error ' + P.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 160));
    if (d.method === 'Fetch.requestPaused' && /\/compat\.js/.test(P.request.url)) { await send('Fetch.failRequest', { requestId: P.requestId, errorReason: 'BlockedByClient' }, S).catch(() => {}); return; }
    if (d.method === 'Fetch.requestPaused') {
      // ไฟล์ CSS ที่หน้าโหลดผ่าน <link> เท่านั้น — fetch() ของโค้ดในแอปได้ไฟล์จริง (บน iPhone จริงไฟล์บนเซิร์ฟเวอร์ก็มี color-mix ครบ)
      try { const b = await send('Fetch.getResponseBody', { requestId: P.requestId }, S);
        const txt = b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : b.body;
        const hdrs = (P.responseHeaders || []).filter(h => !/content-length|content-encoding/i.test(h.name));
        intercepted++;
        await send('Fetch.fulfillRequest', { requestId: P.requestId, responseCode: P.responseStatusCode || 200, responseHeaders: hdrs, body: Buffer.from(txt.replace(/color-mix\(/g, 'color-mixx('), 'utf8').toString('base64') }, S);
      } catch (e) { try { await send('Fetch.continueRequest', { requestId: P.requestId }, S); } catch {} } }
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  S = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  const cmd = (m, p) => send(m, p, S);
  const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? { __err: r.exceptionDetails.exception?.description?.split('\n')[0] } : r.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Network.enable');
  await cmd('Network.setCacheDisabled', { cacheDisabled: true });
  await cmd('Network.setBypassServiceWorker', { bypass: true }).catch(() => {});
  await cmd('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  // ไม่ให้ service worker ลงทะเบียน — ตัวใหม่ขึ้นกลางเทสต์แล้วแอปโหลดหน้าใหม่เอง (ตั้งใจไว้ใน 1C59) ทำให้ค่าที่วัดกลายเป็นของหน้าที่ยังโหลดไม่เสร็จ
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `try { delete Navigator.prototype.serviceWorker; } catch (e) {}` });
  if (mode === 'old') {
    await cmd('Fetch.enable', { patterns: [{ urlPattern: '*', resourceType: 'Stylesheet', requestStage: 'Response' }].concat(NOCOMPAT ? [{ urlPattern: '*compat.js*', requestStage: 'Request' }] : []) });
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: OLD_JS });
  }
  await cmd('Page.navigate', { url: APP }); await sleep(2500);
  await ev(`(()=>{localStorage.clear();const s=${JSON.stringify(seed)};for(const k in s)localStorage.setItem(k,s[k]);return 1})()`);
  errs.length = 0;
  await cmd('Page.navigate', { url: APP }); await sleep(800);
  // รอจนแอปพร้อมจริง (เครื่องที่รันเทสต์ช้า/ยุ่ง ใช้เวลาไม่เท่ากัน) — โหมดจำลองรอ compat.js คำนวณสีเสร็จด้วย
  const want = mode === 'old' && !NOCOMPAT ? ` && document.querySelectorAll('style[data-compat]').length > 0` : '';
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) { ready = (await ev(`typeof go === 'function' && typeof openExplore === 'function' && !!document.querySelector('.td-now') && (!document.getElementById('boot') || document.getElementById('boot').classList.contains('out'))${want}`)) === true; if (!ready) await sleep(250); }
  if (!ready) errs.push('แอปไม่พร้อมภายใน 30 วิ (' + mode + ')');
  await sleep(600);
  const env = await ev(`({ mix: CSS.supports('color', 'color-mix(in srgb, red 50%, blue)'), timeout: typeof AbortSignal.timeout, hasOwn: typeof Object.hasOwn, at: typeof [].at, uuid: typeof (window.crypto && crypto.randomUUID),
    compatSheets: document.querySelectorAll('style[data-compat]').length })`);
  // ใช้ฟีเจอร์ที่เรียกของที่ขาด: จอสำรวจ (Object.hasOwn) · รายการแจ้งปัญหา (Array.at) · คำขอที่ตั้งเวลาหมด (AbortSignal.timeout)
  const use = await ev(`(async () => { const out = {};
    try { openExplore(''); out.explore = curScreen; } catch (e) { out.explore = 'ERR ' + e.message; }
    try { out.bugHtml = typeof bugReportHTML === 'function' ? /ข้อความล่าสุดจากทีม/.test(bugReportHTML({ id: 'x', summary: 's', status: 'open', category: 'other', page: 'p', created_at: new Date().toISOString(), detail: 'd', steps: 's', events: [{ author_kind: 'staff', reply: 'ตอบแล้ว', status: 'open', created_at: new Date().toISOString() }] })) : 'none'; } catch (e) { out.bugHtml = 'ERR ' + e.message; }
    try { const sig = AbortSignal.timeout(30); await new Promise(r => setTimeout(r, 80)); out.timeoutAborts = sig.aborted; } catch (e) { out.timeoutAborts = 'ERR ' + e.message; }
    try { out.uuid = /^[0-9a-f-]{36}$/.test(crypto.randomUUID()); } catch (e) { out.uuid = 'ERR ' + e.message; }
    go('scr-menu'); return out; })()`);
  await sleep(600);
  // หัวการ์ด "ตอนนี้": ต้องมีพื้นสี ไม่ใช่โปร่งใส (ตัวหนังสือในนั้นเป็นสีขาว)
  const hero = await ev(`(() => { const h = document.querySelector('.td-now .tn-head'); if (!h) return { found: false }; const cs = getComputedStyle(h);
    return { found: true, bg: cs.backgroundColor, img: cs.backgroundImage, ink: getComputedStyle(h.querySelector('h2, h3, .tn-title, b, strong') || h).color }; })()`);
  const res = {};
  for (const id of SCREENS) {
    await ev(`(()=>{ for (let i=0;i<5&&typeof openOverlayEl==='function'&&openOverlayEl();i++) dismissTopOverlay(); go('${id}'); return 1 })()`);
    await sleep(1300);
    res[id] = await ev(SIG);
    if (SHOTS) { mkdirSync('oldphone-shots', { recursive: true }); const shot = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(join('oldphone-shots', `${THEME}_${id}_${mode}.jpg`), Buffer.from(shot.data, 'base64')); }
  }
  // สลับธีมระหว่างใช้งาน — compat.js ต้องคำนวณสีใหม่จากโทเคนของธีมใหม่ (ไม่ใช่ค่าที่คำนวณไว้ของธีมเก่า)
  await ev(`(()=>{ document.documentElement.dataset.theme = '${THEME2}'; go('scr-menu'); return 1 })()`);
  await sleep(1800);
  res['สลับธีม→' + THEME2 + ' scr-menu'] = await ev(SIG);
  ws.close(); proc.kill(); await sleep(400); try { rmSync(prof, { recursive: true, force: true }); } catch {}
  return { env, use, hero, res, errs: [...new Set(errs)], intercepted };
}

const A = await run('new');
const B = await run('old');
let bad = 0;
const check = (name, ok, note = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' · ' + note : ''}`); };
console.log(`ธีม ${THEME} · เครื่องใหม่: color-mix=${A.env.mix} · จำลอง iOS 15: color-mix=${B.env.mix} AbortSignal.timeout=${B.env.timeout} hasOwn=${B.env.hasOwn} at=${B.env.at} randomUUID=${B.env.uuid} · ดักไฟล์ CSS ${B.intercepted} ไฟล์`);
check('การจำลองทำงานจริง (ดัก CSS ได้ · CSS.supports ตอบ false)', B.intercepted > 0 && B.env.mix === false && A.env.mix === true);
check('เครื่องใหม่ไม่ถูกแตะ (ไม่มีชั้นแก้สีของเครื่องเก่า)', A.env.compatSheets === 0, `${A.env.compatSheets} ชั้น`);
const isClear = c => { const p = parseColor(c); return !p || p[3] < 0.05; };
check('หัวการ์ด "ตอนนี้" บนเครื่องเก่ามีพื้นสี (ตัวหนังสือขาวอ่านออก)', B.hero.found && (B.hero.img !== 'none' || !isClear(B.hero.bg)), `พื้น ${B.hero.bg} · ภาพพื้น ${String(B.hero.img).slice(0, 60)}`);
check('หัวการ์ด "ตอนนี้" สีเหมือนเครื่องใหม่', B.hero.found && sameComposite(A.hero.img, B.hero.img) && sameColor(A.hero.bg, B.hero.bg), '');
check('ฟังก์ชันที่ iOS 15 ไม่มีถูกเติมครบ', B.env.timeout === 'function' && B.env.hasOwn === 'function' && B.env.at === 'function' && B.env.uuid === 'function', JSON.stringify(B.env));
check('จอสำรวจเปิดได้ (Object.hasOwn)', B.use.explore === 'scr-explore', String(B.use.explore));
check('รายการแจ้งปัญหาแสดงข้อความล่าสุดจากทีมได้ (Array.at)', B.use.bugHtml === true || B.use.bugHtml === 'none', String(B.use.bugHtml));
check('คำขอที่ตั้งเวลาหมดถูกยกเลิกจริง (AbortSignal.timeout)', B.use.timeoutAborts === true, String(B.use.timeoutAborts));
check('สร้างรหัสคำขอได้ (crypto.randomUUID)', B.use.uuid === true, String(B.use.uuid));
check('ไม่มี error บนเครื่องเก่า', !B.errs.length, B.errs.slice(0, 4).join(' | '));
// แยกสองแบบ: "หาย" (เครื่องใหม่มีพื้น/เงา/ขอบ/ตัวอักษร แต่เครื่องเก่าไม่มี = มองไม่เห็น) → ล้มทันที
//            "สีใกล้เคียง" (มีทั้งคู่ แต่ไม่ตรง) → ยอมได้ไม่เกิน APPROX_MAX ชิ้น
// ที่รู้ว่าจะใกล้เคียง (17 ต.ค.): ตัวแปรสีที่ตั้งต่อชิ้น เช่น --tc ของการ์ดสถิติ · --sj ของรางกราฟวิชา — compat.js ใช้ค่าของชิ้นแรก
//   และ color-mix(in oklab) 2 จุดที่ compat.js ผสมแบบ srgb · ทำให้ตรงต่อชิ้นต้องคำนวณใหม่ทุกครั้งที่จอวาดใหม่ = หนักเครื่องเก่า
const APPROX_MAX = 15;
const visible = c => { const p = parseColor(c || ''); return !!p && p[3] >= 0.05; };
const lostPaint = (x, y) => (x !== 'none' && x !== '') && (y === 'none' || y === '');
let lost = 0, approx = 0; const lines = [];
for (const id of Object.keys(A.res)) {
  const a = A.res[id], b = B.res[id]; const diffs = [];
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) { lost++; lines.push([id, 0, ['อ่านสไตล์ของจอนี้ไม่ได้ · ' + JSON.stringify(Array.isArray(b) ? a : b).slice(0, 120)]]); continue; }
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { const x = a[i], y = b[i]; if (x.k !== y.k) continue; const gone = [], near = [];
    const txt = (x.color || y.color) && !sameColor(x.color || 'rgba(0,0,0,0)', y.color || 'rgba(0,0,0,0)');
    if (txt) (visible(x.color) && !visible(y.color) ? gone : near).push(`ตัวอักษร ${x.color} → ${y.color}`);
    if (!sameColor(x.bg, y.bg)) (visible(x.bg) && !visible(y.bg) ? gone : near).push(`พื้น ${x.bg} → ${y.bg}`);
    if (!sameComposite(x.img, y.img)) (lostPaint(x.img, y.img) ? gone : near).push(`ภาพพื้น ${x.img.slice(0, 50)} → ${y.img.slice(0, 50)}`);
    if ((x.border || y.border) && !sameColor(x.border || 'rgba(0,0,0,0)', y.border || 'rgba(0,0,0,0)')) (visible(x.border) && !visible(y.border) ? gone : near).push(`ขอบ ${x.border} → ${y.border}`);
    if (!sameComposite(x.shadow, y.shadow)) (lostPaint(x.shadow, y.shadow) ? gone : near).push(`เงา ${x.shadow.slice(0, 40)} → ${y.shadow.slice(0, 40)}`);
    if (gone.length) { lost++; diffs.push(`หาย · ${x.k}${x.text ? ' "' + x.text + '"' : ''}: ${gone.concat(near).join(' | ')}`); }
    else if (near.length) { approx++; diffs.push(`ใกล้เคียง · ${x.k}${x.text ? ' "' + x.text + '"' : ''}: ${near.join(' | ')}`); } }
  lines.push([id, n, diffs]);
}
check(`ไม่มีชิ้นไหนหาย/มองไม่เห็นบนเครื่องเก่า (${SCREENS.length} จอ + สลับธีม)`, lost === 0, `หาย ${lost} ชิ้น`);
check(`สีใกล้เคียงแต่ไม่ตรง ไม่เกิน ${APPROX_MAX} ชิ้น`, approx <= APPROX_MAX, `${approx} ชิ้น`);
for (const [id, n, diffs] of lines) if (diffs.length) { console.log(`  ${id}: ${diffs.length}/${n} ชิ้นต่าง`); diffs.slice(0, 8).forEach(d => console.log('     ' + d.slice(0, 190))); }
console.log(bad ? `\noldphone: ไม่ผ่าน ${bad} ข้อ` : '\noldphone: ผ่านทุกข้อ');
process.exit(bad ? 1 : 0);
