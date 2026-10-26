// ทดสอบใช้งานยาวบนมือถือจำลองหลายสเปค — กันอาการ "ใช้ไปไม่นานเครื่องค้าง · ปุ่มหาย · เลื่อนรวน" (17 ต.ค. 69)
// ------------------------------------------------------------
// เปิด Chrome แบบไม่มีหน้าต่าง (โปรไฟล์ชั่วคราว ลบทิ้งเมื่อจบ) · จอ 375×812 · นิ้วแตะจำลอง · CPU ช้าลงตามระดับเครื่อง
// ใส่ข้อมูลแบบคนใช้มาสักพัก (งานค้าง 60 · งานเสร็จ 200) แล้วสุ่มใช้งาน: แตะแท็บ · เลื่อนจอ · ปัดเร็ว · เปิด/ปิดแผ่นเพิ่มงาน · แตะไทล์หน้าแรก
// ตรวจทุก 10 วิ: ปุ่มบนแถบล่าง/ในจอยังมองเห็น · หน้าเว็บไม่เลื่อนหลุด · ไม่มีชั้นใสค้างบังจอ · หน่วยความจำ/จำนวนชิ้น/ตัวฟังไม่งอก
//   และจดงานยาว (long task) กับเวลาตอบการแตะ ต่อช่วง 10 วิ
//
// ใช้: (เปิดเซิร์ฟเวอร์ที่รากของ repo ก่อน: python -m http.server 5173)
//   node alt/devtools/lowspec.mjs                 → ครบ 4 ระดับ ระดับละ 3 นาที
//   node alt/devtools/lowspec.mjs low vlow 2      → เฉพาะระดับที่ระบุ · ตัวเลขท้าย = นาทีต่อระดับ
//   THEME=earth2 CHROME="C:/…/chrome.exe" APP=http://localhost:5173/alt/ node alt/devtools/lowspec.mjs
// ระดับ: fast (CPU ปกติ · แรม 8) · mid (ช้า 4× · แรม 4) · low (ช้า 8× · แรม 3) · vlow (ช้า 12× · แรม 2 → โหมดลื่นเปิดเอง)
// จบด้วยรหัส 1 เมื่อเจอความผิดปกติของหน้าจอ / error / การกระทำค้างเกิน 40 วิ — ตัวเลขความเร็วรายงานอย่างเดียว (ขึ้นกับเครื่องที่รัน)
// ค่าอ้างอิง 17 ต.ค. 69 (คอมเจ้าของ · ธีมทะเล): แตะแล้วรอนานสุด fast ~70ms · mid ~220ms · low ~420ms · vlow ~1 วิ
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TIERS = { fast: [1, 8], mid: [4, 4], low: [8, 3], vlow: [12, 2] };
const argTiers = process.argv.slice(2).filter(a => TIERS[a]);
const argMin = process.argv.slice(2).find(a => /^\d+(\.\d+)?$/.test(a));
const TIER_LIST = argTiers.length ? argTiers : (process.env.TIER ? [process.env.TIER] : ['fast', 'mid', 'low', 'vlow']);
const MIN = +(argMin || process.env.MIN || 3);
const THEME = process.env.THEME || 'ocean';
const OUT = process.env.OUT || '';
const URL = process.env.APP || 'http://localhost:5173/alt/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let bad = 0;
for (const TIER of TIER_LIST) { const [RATE, MEM] = TIERS[TIER]; await runTier(TIER, RATE, MEM); }
process.exit(bad ? 1 : 0);

async function runTier(TIER, RATE, MEM) {
const PORT = 9300 + Math.floor(Math.random() * 600);
const prof = mkdtempSync(join(tmpdir(), 'soak-'));
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=375,812', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let seq = 0; const pend = new Map(); const handlers = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } else handlers.forEach(h => h(d)); };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
const cmd = (m, p) => send(m, p, S);
const ev = async (expr, timeout = 60000) => { const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(timeout).then(() => ({ timeout: true }))]); if (r.timeout) return { __timeout: true }; if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description?.slice(0, 200) || r.exceptionDetails.text }; return r.result.value; };
const errors = [];
handlers.push(d => { if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').slice(0, 160)); });
await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Performance.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await cmd('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-A035F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });

// ข้อมูลแบบคนใช้จริงมาสักพัก: งานค้าง 60 · งานเสร็จ 200 (ย้อน 30 วัน)
const now = Date.now(), iso = h => new Date(now + h * 3600e3).toISOString();
const SUBJ = ['ฟิสิกส์', 'ภาษาอังกฤษ', 'คณิตศาสตร์', 'สังคมศึกษา', 'เคมี', 'ชีววิทยา', 'ภาษาไทย', 'ประวัติศาสตร์'];
const tasks = [];
for (let i = 0; i < 60; i++) tasks.push({ id: 'p' + i, subject: SUBJ[i % 8], detail: 'งานทดสอบชิ้นที่ ' + i, estMin: 20 + (i % 5) * 10, due: iso(4 + i * 7), done: false, createdAt: iso(-48) });
for (let i = 0; i < 200; i++) tasks.push({ id: 'd' + i, subject: SUBJ[i % 8], detail: 'งานเสร็จชิ้นที่ ' + i, estMin: 30, due: iso(-i * 3.5), done: true, doneAt: iso(-i * 3.6), createdAt: iso(-i * 3.6 - 30) });
const seed = { 'studentos.alt.onboardSkipped': '1', 'studentos.alt.skipLogin': '1', 'studentos.alt.theme': THEME, 'studentos.alt.checkinAsked': new Date().toISOString().slice(0, 10),
  'studentos.alt.v1': JSON.stringify({ tasks, settings: { name: 'ทดสอบ', freeHours: 2.5 }, marks: [], sessions: [], running: null }) };
// BLOCK=glass.css,identity.css → ไม่โหลดไฟล์เหล่านี้ (ทดสอบ A/B: วัดว่าของชุดไหนทำให้ช้า เทียบกันบนเครื่องเดียวกันในรอบเดียวกัน · 26 ต.ค. 69)
if (process.env.BLOCK) { await cmd('Network.enable'); await cmd('Network.setBlockedURLs', { urls: process.env.BLOCK.split(',').map(x => '*' + x.trim() + '*') }); }
await cmd('Page.navigate', { url: URL }); await sleep(2500);
await ev(`(()=>{localStorage.clear();const s=${JSON.stringify(seed)};for(const k in s)localStorage.setItem(k,s[k]);return 1})()`);
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `
  try { Object.defineProperty(navigator, 'deviceMemory', { get: () => ${MEM} }); } catch (e) {}
  window.__lt = []; window.__et = [];
  try { new PerformanceObserver(l => l.getEntries().forEach(e => __lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.interactionId) __et.push([Math.round(e.startTime), Math.round(e.duration)]); })).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) {}
` });
await cmd('Emulation.setCPUThrottlingRate', { rate: RATE });
await cmd('Page.navigate', { url: URL });
await sleep(9000);

// ---------- ตรวจสภาพ ----------
const CHECK = `(() => {
  const vis = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; o *= +cs.opacity; }
    return o > .35; };
  // ของที่ถูกพับไว้โดยตั้งใจ (กล่องแม่สูงเกือบ 0 และตัดของล้น เช่น "ทำไมงานนี้" ที่ยังไม่กาง) ไม่นับว่า "อยู่ในจอ"
  const folded = el => { for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.overflow !== 'visible' && n.getBoundingClientRect().height < 4) return true; } return false; };
  const scr = document.querySelector('.screen.on');
  const tabs = [...document.querySelectorAll('.tabbar .tab')];
  const tabHidden = tabs.filter(t => !vis(t)).map(t => (t.textContent || '').trim().slice(0, 8) || t.className);
  const tabT = tabs.map(t => t.style.transform).filter(Boolean);
  const btns = scr ? [...scr.querySelectorAll('button, a[href], [onclick]')] : [];
  const inView = btns.filter(b => { const r = b.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && !folded(b); });
  const invisible = inView.filter(b => !vis(b)).map(b => ((b.textContent || '').trim().slice(0, 14) || b.className.toString().slice(0, 24)));
  const se = document.scrollingElement;
  const menu = document.getElementById('scr-menu');
  const big = [...document.querySelectorAll('.screen, .scr-body, .home-body')].map(e => [e.id || e.className.toString().slice(0, 20), e.scrollHeight]).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const overlays = [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' && cs.position !== 'absolute') return false; const r = e.getBoundingClientRect(); return r.width >= innerWidth * .9 && r.height >= innerHeight * .9 && cs.pointerEvents !== 'none' && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > .01 && !e.classList.contains('screen') && !e.classList.contains('screens') && !e.classList.contains('phone') && !e.classList.contains('fx'); }).map(e => e.id || e.className.toString().slice(0, 30)).slice(0, 4);
  return { scr: scr && scr.id, lite: document.documentElement.dataset.lite || null, tabHidden, tabT: tabT.slice(0, 3), inView: inView.length, invisible: invisible.slice(0, 6), nInvisible: invisible.length,
    docScroll: se.scrollTop, docOver: se.scrollHeight - se.clientHeight, menuOver: menu ? menu.scrollHeight - menu.clientHeight : null, scrTop: scr ? scr.scrollTop : null, big,
    overlays, nodes: document.getElementsByTagName('*').length, anims: document.getAnimations().length,
    finished: document.getAnimations().filter(a => a.playState === 'finished').length, paused: document.getAnimations().filter(a => a.playState === 'paused').length,
    toast: (document.querySelector('#appToast.show .tt') || {}).textContent || null, sheetUp: document.body.classList.contains('sheet-up') };
})()`;
const metrics = async () => { const { metrics } = await cmd('Performance.getMetrics'); const m = Object.fromEntries(metrics.map(x => [x.name, x.value])); return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, layouts: m.LayoutCount, styles: m.RecalcStyleCount, taskS: +m.TaskDuration.toFixed(2) }; };

// ---------- การกระทำ ----------
const touch = async (pts) => { await cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] }); for (let i = 1; i < pts.length; i++) { await cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pts[i]] }); await sleep(16); } await cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const tap = (x, y) => touch([{ x, y }]);
const swipe = (y0, y1) => { const pts = []; for (let k = 0; k <= 10; k++) pts.push({ x: 190, y: y0 + (y1 - y0) * k / 10 }); return touch(pts); };
const rect = sel => ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2&&r.top>=0&&r.bottom<=innerHeight});if(!e)return null;const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`, 20000);
const tabsPos = await ev(`[...document.querySelectorAll('.tabbar .tab')].map(t=>{const r=t.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,(t.textContent||'').trim().slice(0,8)]})`);
const ACTIONS = [
  async () => { const t = tabsPos[Math.floor(Math.random() * tabsPos.length)]; if (!t || /เพิ่ม/.test(t[2])) return 'skip'; await tap(t[0], t[1]); return 'tab:' + t[2]; },
  async () => { await swipe(620, 220); return 'scroll-down'; },
  async () => { await swipe(220, 620); return 'scroll-up'; },
  async () => { await swipe(650, 150); await sleep(80); await swipe(650, 150); return 'fling-down×2'; },
  async () => { const p = tabsPos.find(t => /เพิ่ม/.test(t[2])) || tabsPos[Math.floor(tabsPos.length / 2)]; await tap(p[0], p[1]); await sleep(1500); await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await ev(`(()=>{const s=document.getElementById('addSheet');if(s&&!s.hidden&&typeof closeAdd==='function')closeAdd();return 1})()`, 10000); return 'add-sheet'; },
  async () => { const p = await rect('#menuBody .tg-t, #scr-menu .th-bell'); if (!p) return 'skip'; await tap(p[0], p[1]); await sleep(1200); await ev(`(()=>{if(typeof go==='function')go('scr-menu');return 1})()`, 15000); return 'home-tile'; },
];

const t0 = Date.now(); const timeline = []; let acts = 0; const actLog = [];
let nextCheck = t0;
// PROFILE=ไฟล์.cpuprofile → อัดโปรไฟล์ CPU ตลอดรอบใช้งาน (เปิดใน DevTools > Performance หรือรวมตามฟังก์ชันเอง) · 26 ต.ค. 69
if (process.env.PROFILE) { await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 500 }); await cmd('Profiler.start'); }
while (Date.now() - t0 < MIN * 60000) {
  if (Date.now() >= nextCheck) {
    // 26 ต.ค. 69 · ตัวตรวจ (CHECK) ไล่ getComputedStyle ทุกชิ้นในหน้า — ที่ CPU ช้า 8–12 เท่า กินเวลาเอง ~1 วิต่อรอบ
    // เคยถูกนับรวมเป็น "งานยาวของแอป" (โปรไฟล์: 8–10 วิใน 2 นาที) → จดช่วงเวลาที่ตัวตรวจรัน แล้วตัดงานยาว/การแตะที่ทับช่วงนั้นออก
    const c = await ev(`(() => { const s0 = performance.now(); const r = ${CHECK}; (window.__chk = window.__chk || []).push([s0, performance.now()]); return r; })()`, 30000); const m = await metrics();
    const lt = await ev(`(() => { const ck = (window.__chk || []).splice(0); const hit = x => ck.some(([s, e]) => x[0] < e + 50 && x[0] + x[1] > s - 50);
      const a = __lt.splice(0).filter(x => !hit(x)); const e = __et.splice(0).filter(x => !hit(x)); return { n: a.length, sum: a.reduce((s, x) => s + x[1], 0), max: Math.max(0, ...a.map(x => x[1])), tapN: e.length, tapMax: Math.max(0, ...e.map(x => x[1])), tapMed: e.length ? e.map(x => x[1]).sort((a, b) => a - b)[e.length >> 1] : 0 }; })()`, 30000);
    timeline.push({ t: Math.round((Date.now() - t0) / 1000), ...c, ...m, lt, acts });
    nextCheck = Date.now() + 10000;
  }
  const a = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  const t1 = Date.now(); const r = await Promise.race([a().catch(e => 'ERR ' + e.message.slice(0, 60)), sleep(40000).then(() => 'STUCK>40s')]);
  actLog.push(`${Math.round((t1 - t0) / 1000)}s ${r} ${Date.now() - t1}ms`); acts++;
  await sleep(600 + Math.random() * 900);
}
if (process.env.PROFILE) { const { profile } = await cmd('Profiler.stop'); writeFileSync(process.env.PROFILE.replace('{tier}', TIER), JSON.stringify(profile)); }
const shot = await cmd('Page.captureScreenshot', { format: 'png' }).catch(() => null);
if (OUT && shot) writeFileSync(OUT + '.png', Buffer.from(shot.data, 'base64'));
const res = { TIER, RATE, MEM, THEME, MIN, acts, errors: [...new Set(errors)].slice(0, 8), timeline, slowActs: actLog.filter(l => +l.split(' ').pop().replace('ms', '') > 8000 || /STUCK|ERR/.test(l)).slice(0, 15) };
if (OUT) writeFileSync(OUT + '.json', JSON.stringify(res, null, 1));
// สรุปสั้น
const first = timeline[0], last = timeline[timeline.length - 1];
console.log(`${TIER} (${RATE}× mem${MEM}) ${THEME} ${MIN}min acts=${acts} lite=${last.lite} errors=${res.errors.length}`);
console.log(`  heap ${first.heapMB}→${last.heapMB}MB · nodes ${first.nodes}→${last.nodes} · listeners ${first.listeners}→${last.listeners} · anims ${first.anims}→${last.anims} (finished ${last.finished}, paused ${last.paused})`);
console.log(`  long tasks/10s: ${timeline.map(x => x.lt.sum).join(' ')}  ·  tap max/10s: ${timeline.map(x => x.lt.tapMax).join(' ')}`);
{ const all = timeline.slice(1).map(x => x.lt); const lts = all.reduce((s, x) => s + x.sum, 0), meds = all.map(x => x.tapMed).filter(Boolean).sort((a, b) => a - b), maxs = all.map(x => x.tapMax).sort((a, b) => a - b);
  console.log(`  สรุป (ไม่นับเวลาของตัวตรวจเอง): งานยาวรวม ${lts}ms · แตะแล้วรอ มัธยฐาน ${meds[meds.length >> 1] || 0}ms · สูงสุดช่วงที่ 2 จากบน ${maxs[maxs.length - 2] || 0}ms · สูงสุด ${maxs[maxs.length - 1] || 0}ms`); }
const anomalies = timeline.filter(x => x.tabHidden.length || x.nInvisible || x.docScroll || x.docOver > 2 || (x.menuOver > 2 && x.scr === 'scr-menu') || x.overlays.length || x.tabT.length);
console.log(`  anomalies at ${anomalies.length}/${timeline.length} checks`);
anomalies.slice(0, 8).forEach(x => console.log(`   t=${x.t}s scr=${x.scr} tabHidden=${JSON.stringify(x.tabHidden)} tabT=${JSON.stringify(x.tabT)} invisible(${x.nInvisible})=${JSON.stringify(x.invisible)} docScroll=${x.docScroll} docOver=${x.docOver} menuOver=${x.menuOver} overlays=${JSON.stringify(x.overlays)}`));
if (res.slowActs.length) console.log('  slow/stuck actions: ' + res.slowActs.join(' | '));
if (res.errors.length) console.log('  JS errors: ' + res.errors.join(' | '));
if (anomalies.length || res.errors.length || res.slowActs.some(l => /STUCK/.test(l))) bad++;
ws.close(); proc.kill(); await sleep(500); try { rmSync(prof, { recursive: true, force: true }); } catch {}
}
