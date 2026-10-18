// โหมดเมนูซ้าย (จอกว้าง · data-nav="side"): แอปต้องเต็มหน้าต่าง · แผ่นที่เลื่อนขึ้นจากล่างต้องไม่ยืดเต็มหน้าต่าง/ไม่ทับเมนู (17 ต.ค. 69)
// ใช้: (เปิดเซิร์ฟเวอร์ที่รากของ repo: python -m http.server 5173) แล้ว
//   node alt/devtools/sidecheck.mjs                    → 900×700 · 1280×800 · 1920×1080
//   node alt/devtools/sidecheck.mjs 1440x900 2560x1440
// จบด้วยรหัส 1 ถ้า: แอปไม่เต็มหน้าต่าง · หน้าเว็บเลื่อนได้ · มีแถบสถานะปลอม/ข้อความใต้กรอบ · แผ่นทับเมนูซ้ายหรือกว้างเกิน 760px
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const SIZES = (process.argv.slice(2).length ? process.argv.slice(2) : ['900x700', '1280x800', '1920x1080']).map(s => s.split('x').map(Number));
const CHROME_PATH = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.env.APP || 'http://localhost:5173/alt/';
let bad = 0;
const SCR = process.env.SCR || 'scr-menu';
const CHROME = CHROME_PATH;
const PORT = 9600 + Math.floor(Math.random() * 90);
const prof = mkdtempSync(join(tmpdir(), 'ss-'));
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver; for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let seq = 0; const pend = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true });
const cmd = (m, p) => send(m, p, S);
const ev = async e => (await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value;
await cmd('Page.enable');
const seed = { 'studentos.alt.onboardSkipped': '1', 'studentos.alt.skipLogin': '1', 'studentos.alt.theme': process.env.THEME || 'ocean', 'studentos.alt.lite': '1', 'studentos.alt.checkinAsked': new Date().toISOString().slice(0, 10), 'studentos.alt.v1': JSON.stringify({ tasks: [{ id: 'a', subject: 'คณิตศาสตร์', detail: 'แบบฝึกหัด 2.3', estMin: 30, due: new Date(Date.now() + 5 * 3600e3).toISOString(), done: false }], settings: { name: 'ทดสอบ' }, marks: [], sessions: [], running: null }) };
await cmd('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await cmd('Page.navigate', { url: APP }); await sleep(2500);
await ev(`(()=>{localStorage.clear();const s=${JSON.stringify(seed)};for(const k in s)localStorage.setItem(k,s[k]);return 1})()`);
await cmd('Page.navigate', { url: APP }); await sleep(6000);
const CASES = [
  ['แผ่นเพิ่มงาน', 'openAddSheet()', '#addSheet .as-card', 'closeAddSheet()'],
  ['แผ่นกำลังจะเปิด', "openSoonSheet('community')", '#soonSheet .as-card', 'closeSoonSheet()'],
  ['แผ่นน้องฮูก', 'openAiHub()', '#aiSheet .ah-card', 'closeAiHub()'],
  ['ปุ่มลอย (จอเพื่อน)', "go('scr-mates'); toggleFabHub()", '#fabMenu .fh-op, #fabMenu .fh-card, #fabMenu > :not(.fh-scrim)', "closeFabHub(true); go('scr-menu')"],
  ['ปุ่มลอยเอง', "go('scr-mates'); 1", '.feed-fab, .fab, .fd-fab, [class*="fab"]:not(.fab-hub):not(#fabMenu *)', "go('scr-menu')"],
  ['แผ่นรายงาน', "openReport('post','x')", '#reportSheet .rp-card', "typeof closeReport==='function'&&closeReport()"],
  ['กล่องยืนยัน', "appConfirm({title:'ทดสอบ',body:'x'}); 1", '.ac-sheet', "document.querySelectorAll('.ac-sheet,.ac-scrim').forEach(e=>e.remove())"],
  ['toast', "showToast({title:'ทดสอบ',body:'ข้อความ'})", '#appToast', "document.getElementById('appToast').classList.remove('show')"],
  ['ติดตั้งแอป', 'showInstallGuide()', '#installGuide > *', "document.getElementById('installGuide').hidden=true"],
];
for (const [W, H] of SIZES) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }); await sleep(900);
  await ev(`go('scr-menu')`); await sleep(700);
  const nav = await ev(`(()=>{const t=document.querySelector('.tabbar').getBoundingClientRect();return [Math.round(t.left),Math.round(t.right)]})()`);
  const full = await ev(`(()=>{const p=document.querySelector('.phone').getBoundingClientRect();const n=document.querySelector('.stage-note');const sb=document.querySelector('.statusbar');const se=document.scrollingElement;
    return {mode:document.documentElement.dataset.nav, phone:[Math.round(p.left),Math.round(p.top),Math.round(p.width),Math.round(p.height)], note: !!(n && getComputedStyle(n).display!=='none'), status: !!(sb && getComputedStyle(sb).display!=='none'), docScroll: se.scrollHeight - se.clientHeight}})()`);
  const ff = [];
  if (full.mode !== 'side') ff.push('ไม่ได้อยู่โหมดเมนูซ้าย (' + full.mode + ')');
  if (full.phone[0] !== 0 || full.phone[1] !== 0 || full.phone[2] !== W || full.phone[3] !== H) ff.push('แอปไม่เต็มหน้าต่าง ' + full.phone.join(','));
  if (full.docScroll > 1) ff.push('หน้าเว็บเลื่อนได้ ' + full.docScroll + 'px');
  if (full.status) ff.push('มีแถบสถานะปลอม');
  if (full.note) ff.push('มีข้อความใต้กรอบ');
  if (ff.length) bad++;
  console.log(`=== ${W}x${H} · แถบซ้าย x=${nav[0]}–${nav[1]} · ${ff.length ? 'FAIL ' + ff.join(' · ') : 'PASS แอปเต็มหน้าต่าง หน้าเว็บไม่เลื่อน'}`);
  for (const [name, open, sel, close] of CASES) {
    const r = await ev(`(async()=>{ try { ${open}; } catch(e) { return 'ERR ' + e.message; } await new Promise(r=>setTimeout(r,700)); const els=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>{const b=e.getBoundingClientRect();return b.width>2&&b.height>2;}); if(!els.length) return 'ไม่เจอ'; const b=els.map(e=>e.getBoundingClientRect()); const l=Math.min(...b.map(x=>x.left)), rr=Math.max(...b.map(x=>x.right)); return { l: Math.round(l), r: Math.round(rr), w: Math.round(rr-l) }; })()`);
    const fail = typeof r === 'object' && (r.l < nav[1] || r.w > 760);
    if (fail) bad++;
    console.log(`  ${fail ? 'FAIL' : typeof r === 'object' ? 'PASS' : 'SKIP'} ${name.padEnd(18)} ${typeof r === 'string' ? r + ' (ต้องล็อกอิน/ข้อมูลถึงจะมี)' : `x=${r.l}–${r.r} กว้าง ${r.w}px${r.l < nav[1] ? ' · ทับแถบซ้าย' : ''}${r.w > 760 ? ' · กว้างเกิน' : ''}`}`);
    await ev(`(()=>{ try { ${close}; } catch(e) {} return 1; })()`); await sleep(500);
  }
  if (process.env.SHOT) { await ev(process.env.SHOT); await sleep(800); const s = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 55 }); writeFileSync(`overlay_${W}x${H}.jpg`, Buffer.from(s.data, 'base64')); }
}
ws.close(); proc.kill(); await sleep(400); try { rmSync(prof, { recursive: true, force: true }); } catch {}
console.log(bad ? `\nsidecheck: พบ ${bad} จุด` : '\nsidecheck: ผ่านทั้งหมด');
process.exit(bad ? 1 : 0);
