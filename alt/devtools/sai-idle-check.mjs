// น้องฮูกต้องหยุดลูปเองตอนนิ่ง และหันตามนิ้วเมื่อแตะ — โหมดลื่น · หน้าแรก (26 ต.ค. 69)
// ------------------------------------------------------------
// บั๊กที่กัน: saiTick วนทุกเฟรมตลอดที่หน้าแรกเปิด ทั้งที่ไม่มีอะไรขยับ (3 วินาทีนิ่ง ๆ = 361 รอบ · ค้น DOM ทั้งหน้าทุกรอบ)
// ใช้: (เปิดเซิร์ฟเวอร์ที่รากของ repo ก่อน: python -m http.server 5173)  node alt/devtools/sai-idle-check.mjs
// ผ่าน = นิ่ง 3 วิ ลูปรันไม่เกิน 5 รอบ · แตะมุมซ้ายบนแล้ว --sx ของเวทีเปลี่ยนชัด (หันไปทางนิ้ว)
import { spawn } from 'node:child_process'; import { mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 9500 + Math.floor(Math.random() * 200), prof = mkdtempSync(join(tmpdir(), 'sai-'));
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let ver; for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let seq = 0; const pend = new Map(); ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' }); const S = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
const cmd = (m, p) => send(m, p, S); const ev = async e => { const r = await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? { __err: r.exceptionDetails.exception?.description } : r.result.value; };
await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
const URL = process.env.APP || 'http://localhost:5173/alt/';
await cmd('Page.navigate', { url: URL }); await sleep(2000);
await ev(`(()=>{localStorage.clear(); Object.entries({'studentos.alt.onboardSkipped':'1','studentos.alt.skipLogin':'1','studentos.alt.lite':'1','studentos.alt.checkinAsked':new Date().toISOString().slice(0,10),'studentos.alt.v1':JSON.stringify({tasks:Array.from({length:8},(_,i)=>({id:'p'+i,subject:'ฟิสิกส์',detail:'งาน '+i,estMin:30,due:new Date(Date.now()+(3+i*11)*3600e3).toISOString(),done:false,createdAt:new Date(Date.now()-48*3600e3).toISOString()})),settings:{name:'ทดสอบ',freeHours:2.5},marks:[],sessions:[],running:null})}).forEach(([k,v])=>localStorage.setItem(k,v)); return 1})()`);
await cmd('Page.navigate', { url: URL }); await sleep(9000);
const r = await ev(`(async()=>{ document.querySelectorAll('dialog[open]').forEach(d=>d.close()); go('scr-menu'); await new Promise(r=>setTimeout(r,2500));
  const stage = !!document.querySelector('.screen.on .saih-stage, .screen.on .saip-stage');
  let n = 0; const orig = window.requestAnimationFrame; window.requestAnimationFrame = cb => { if (cb === saiTick || cb.name === 'saiTick') n++; return orig(cb); };
  await new Promise(r=>setTimeout(r,3000)); const idle = n;
  n = 0; window.dispatchEvent(new TouchEvent('touchstart', { touches: [new Touch({ identifier: 1, target: document.body, clientX: 40, clientY: 40 })] }));
  await new Promise(r=>setTimeout(r,500)); const afterTouch = n; window.requestAnimationFrame = orig;
  const st = document.querySelector('.screen.on .saih-stage, .screen.on .saip-stage');
  return { lite: document.documentElement.dataset.lite, stage, idle, afterTouch, sx: st && st.style.getPropertyValue('--sx') }; })()`);
console.log(JSON.stringify(r));
const turned = r.sx && Math.abs(parseFloat(r.sx)) > 0.3;   // แตะมุมซ้ายบน → หันไปทางซ้าย (ค่าติดลบชัด ๆ)
const pass = r.stage && r.idle <= 5 && r.afterTouch >= 1 && turned;
console.log(pass ? 'PASS saiTick หยุดตอนนิ่ง และตื่นเมื่อแตะ' : 'FAIL ' + (r.idle > 5 ? `วนอยู่ ${r.idle} ครั้งใน 3 วิทั้งที่ไม่มีอะไรขยับ` : !r.stage ? 'ไม่มีเวทีน้องฮูกบนหน้าแรก' : `แตะแล้วไม่หัน (รอบ ${r.afterTouch} · --sx ${r.sx})`));
ws.close(); proc.kill(); process.exit(pass ? 0 : 1);
