// ของในจออยู่ในจอครบไหม — ทุกจอหลัก × หลายขนาดจอ (26 ต.ค. 69)
// ------------------------------------------------------------
// เจ้าของ: "ทำให้ปุ่มหรืออะไรก็ตามอยู่เต็มหน้าจอเสมอ พวก UI และไม่ขาด ทั้งแอปเลย"
// วัดจากผังที่เบราว์เซอร์วางจริง (ไม่ใช่อ่าน CSS) — แต่ละจอ แต่ละขนาด ตรวจ 5 อย่าง:
//   ① ล้นข้าง: ทั้งหน้าหรือตัวจอเลื่อนซ้ายขวาได้ (ไม่ควรมีเลย)
//   ② หลุดจอ: ปุ่ม/ลิงก์/ช่องกรอกยื่นพ้นขอบจอซ้ายหรือขวา — ยกเว้นของในแถวที่ตั้งใจให้ปัดข้าง (มีพ่อแม่ overflow-x: auto/scroll)
//   ③ ตัวหนังสือโดนตัด: กล่องที่ตัดของล้น (overflow ≠ visible) แต่ข้อความยาวกว่ากล่อง และไม่มี "…" (text-overflow: ellipsis)
//   ④ ตัวหนังสือล้นปุ่ม: ตัวอักษรจริงยื่นพ้นกรอบปุ่ม/ชิปที่มันอยู่เกิน 2px
//   ⑤ ถึงไม่ได้: เลื่อนจอจนสุดแล้ว ของที่กดได้ชิ้นสุดท้ายยังอยู่ใต้แถบเมนูล่าง (กดไม่ได้ · เห็นไม่ครบ)
// ข้าม: ของที่ซ่อน · aria-hidden · ฉากพื้นหลัง · ของใน <details> ที่ปิด · แถบสไลด์ที่ตั้งใจเลื่อนข้าง
//
// ใช้: (เปิดเซิร์ฟเวอร์ที่รากของ repo ก่อน: python -m http.server 5173)
//   node alt/devtools/fitcheck.mjs                        → ธีม light ทุกขนาด
//   node alt/devtools/fitcheck.mjs light meta halloween   → หลายธีม (ฟอนต์/ทรงต่างกัน ความกว้างตัวหนังสือต่างกัน)
//   SIZES=375x812,1024x768 node alt/devtools/fitcheck.mjs → เฉพาะขนาด
//   JSON=out.json node alt/devtools/fitcheck.mjs          → เก็บรายละเอียดทุกชิ้น
// จบด้วยรหัส 1 เมื่อมีของที่ไม่ผ่าน
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const THEMES = process.argv.slice(2).length ? process.argv.slice(2) : ['light'];
const SCREENS = (process.env.SCREENS || 'scr-menu,scr-tasks,scr-timeline,scr-plan,scr-why,scr-ai,scr-profile,scr-settings,scr-stats,scr-context,scr-notif,scr-room,scr-shop,scr-badges,scr-news,scr-events').split(',');
const SIZES = (process.env.SIZES || '320x568,375x812,414x896,600x960,768x1024,1024x768,1280x800,1600x900').split(',')
  .map(s => s.split('x').map(Number));
const APP = process.env.APP || 'http://localhost:5173/alt/';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = Date.now(), iso = h => new Date(now + h * 3600e3).toISOString();
const SUBJ = ['ฟิสิกส์', 'ภาษาอังกฤษ', 'คณิตศาสตร์', 'สังคมศึกษา', 'เคมี'];
const tasks = [];
// ชื่องานยาวด้วย 2 ชิ้น — ของที่ล้นมักโผล่ตอนข้อความยาว ไม่ใช่ตอน "งานทดสอบ 1"
for (let i = 0; i < 8; i++) tasks.push({ id: 'p' + i, subject: SUBJ[i % 5], detail: i < 2 ? 'รายงานการทดลองเรื่องการเคลื่อนที่แบบโพรเจกไทล์พร้อมกราฟและข้อสรุป ' + i : 'งานทดสอบ ' + i, estMin: 30 + i * 5, due: iso(3 + i * 11), done: false, createdAt: iso(-48), isExam: i === 3 });
for (let i = 0; i < 12; i++) tasks.push({ id: 'd' + i, subject: SUBJ[i % 5], detail: 'งานเสร็จ ' + i, estMin: 30, due: iso(-i * 9), done: true, doneAt: iso(-i * 9.5), createdAt: iso(-i * 9.5 - 30) });
const seed = { 'studentos.alt.onboardSkipped': '1', 'studentos.alt.skipLogin': '1', 'studentos.alt.theme': 'light', 'studentos.alt.lite': '0', 'studentos.alt.checkinAsked': new Date().toISOString().slice(0, 10),
  'studentos.alt.v1': JSON.stringify({ tasks, settings: { name: 'ทดสอบชื่อยาวมากสำหรับดูการล้น', freeHours: 2.5 }, marks: [], sessions: [], running: null }) };

// ---------- ในหน้า: หาของที่ล้น/หลุด/โดนตัด ----------
const COLLECT = `(() => {
  const W = innerWidth, out = [];
  const scr = document.querySelector('.screen.on'); if (!scr) return { err: 'no screen' };
  const keyOf = el => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
    + (el.parentElement && typeof el.parentElement.className === 'string' && el.parentElement.className.trim() ? ' < ' + el.parentElement.className.trim().split(/\\s+/)[0] : '');
  const label = el => (el.getAttribute('aria-label') || el.textContent || el.value || el.placeholder || '').replace(/\\s+/g, ' ').trim().slice(0, 30);
  const visible = el => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    if (el.closest('[aria-hidden="true"], .hw-scene, .hw-biome-scene, .fx, .starfield, [hidden]')) return false;
    const d = el.closest('details'); if (d && !d.open && !el.closest('summary')) return false;
    const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  // แถวที่ตั้งใจให้ปัดข้าง/ตัดขอบ (สไลด์การ์ด · แถบชิป · ปฏิทินเลื่อน) — ของที่เกินขอบในนั้นคือ "อยู่นอกช่องมอง" ไม่ใช่ "หลุดจอ"
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || (ox === 'hidden' && p.scrollWidth > p.clientWidth + 2)) return true; } return false; };
  // ① ล้นข้าง
  const de = document.scrollingElement || document.documentElement;
  if (de.scrollWidth > W + 1) out.push({ kind: 'ล้นข้าง', key: 'หน้า (document)', text: 'กว้าง ' + de.scrollWidth + ' > ' + W, px: de.scrollWidth - W });
  if (scr.scrollWidth > scr.clientWidth + 1 && getComputedStyle(scr).overflowX !== 'hidden') out.push({ kind: 'ล้นข้าง', key: '#' + scr.id, text: 'กว้าง ' + scr.scrollWidth + ' > ' + scr.clientWidth, px: scr.scrollWidth - scr.clientWidth });
  const scope = [scr, document.querySelector('.tabbar')].filter(Boolean);
  const CTL = 'button, a[href], a[onclick], input:not([type=hidden]), select, textarea, [role="button"], .chip';
  for (const sc of scope) for (const el of sc.querySelectorAll(CTL)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    // ② หลุดจอ
    if ((r.right > W + 1 || r.left < -1) && !inScroller(el))
      out.push({ kind: 'หลุดจอ', key: keyOf(el), text: label(el), px: Math.round(Math.max(r.right - W, -r.left)) });
    // ④ ตัวหนังสือล้นปุ่ม
    if (el.matches('button, a, [role="button"], .chip')) {
      const cs = getComputedStyle(el);
      let over = 0;
      for (const t of [...el.querySelectorAll('*'), el].flatMap(x => [...x.childNodes].filter(c => c.nodeType === 3 && c.textContent.trim()))) {
        // ข้อความที่มีกล่องระหว่างทางตัดไว้แล้ว (overflow: hidden + "…") = ไม่ได้ล้นออกนอกปุ่มจริง · ถ้าโดนตัดโดยไม่มี "…" ข้อ ③ จับเอง
        let clipped = false; for (let p = t.parentElement; p && p !== el; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break; }
        if (clipped) continue;
        // ป้ายที่ตั้งใจวางนอกกรอบ (position: absolute · เช่นเวลาในคอลัมน์ซ้ายของไทม์ไลน์) ไม่ใช่ข้อความที่ล้น
        if (getComputedStyle(t.parentElement).position === 'absolute' && t.parentElement !== el) continue;
        const rg = document.createRange(); rg.selectNodeContents(t);
        for (const b of rg.getClientRects()) over = Math.max(over, b.right - r.right, r.left - b.left, b.bottom - r.bottom - 2, r.top - b.top - 2);
      }
      if (over > 2 && cs.overflow === 'visible') out.push({ kind: 'ล้นปุ่ม', key: keyOf(el), text: label(el), px: Math.round(over) });
    }
  }
  // ③ ตัวหนังสือโดนตัด (ไม่มี …)
  for (const sc of scope) for (const el of sc.querySelectorAll('*')) {
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
    const cs = getComputedStyle(el); if (cs.overflowX === 'visible' && cs.overflow === 'visible') continue;
    if (!visible(el)) continue;
    if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && !/auto|scroll/.test(cs.overflowX))
      out.push({ kind: 'โดนตัด', key: keyOf(el), text: label(el), px: el.scrollWidth - el.clientWidth });
  }
  return { out, W };
})()`;

// ⑤ ถึงไม่ได้: เลื่อนจนสุด แล้วดูของกดได้ชิ้นล่างสุดเทียบขอบบนของแถบล่าง
const REACH = `(() => {
  const scr = document.querySelector('.screen.on'); const bar = document.querySelector('.tabbar');
  const sc = [scr, ...scr.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) || scr;
  sc.scrollTop = sc.scrollHeight;
  return new Promise(res => setTimeout(() => {
    const br = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null;
    // แถบข้าง (data-nav=side) ไม่บังของด้านล่าง
    if (!br || br.height > innerHeight * 0.6) return res(null);
    let worst = null;
    for (const el of scr.querySelectorAll('button, a[href], a[onclick], input:not([type=hidden]), [role="button"]')) {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"], [hidden]')) continue;
      // ของใน <details> ที่ปิดอยู่ไม่ได้วาด (Chrome ยังให้กรอบ) — ไม่ใช่ของที่ "ถูกแถบบัง"
      { const d = el.closest('details'); if (d && !d.open && !el.closest('summary')) continue; }
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < br.left || r.left > br.right) continue;
      if (r.bottom > br.top + 2 && r.top < innerHeight) { const hidden = Math.min(r.bottom, innerHeight) - br.top;
        if (!worst || hidden > worst.px) worst = { px: Math.round(hidden), text: (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30),
          key: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : '') }; }
    }
    sc.scrollTop = 0; res(worst);
  }, 350));
})()`;

async function run() {
  const PORT = 9300 + Math.floor(Math.random() * 300);
  const prof = mkdtempSync(join(tmpdir(), 'fitcheck-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--no-first-run', '--window-size=1600,1000', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
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
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: `try { delete Navigator.prototype.serviceWorker; } catch (e) {}` });
  const boot = async () => {
    await cmd('Page.navigate', { url: APP });
    for (let i = 0; i < 120; i++) { if ((await ev(`typeof go === 'function' && !!document.querySelector('#menuBody') && (!document.getElementById('boot') || document.getElementById('boot').classList.contains('out'))`)) === true) break; await sleep(250); }
    await sleep(700);
  };
  await cmd('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await cmd('Page.navigate', { url: APP }); await sleep(2500);
  await ev(`(()=>{localStorage.clear();const s=${JSON.stringify(seed)};for(const k in s)localStorage.setItem(k,s[k]);return 1})()`);
  const res = {};
  for (const [w, h] of SIZES) {
    const mobile = w < 769;
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
    await cmd('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await boot();   // ขนาดเปลี่ยน = โหลดใหม่ (แอปเลือกผังตอนบูต · matchMedia ของแถบข้าง)
    for (const th of THEMES) {
      for (const id of SCREENS) {
        let ok; for (let t = 0; t < 30; t++) { ok = await ev(`(()=>{ if (!document.getElementById('${id}')) return '__noscreen'; for (let i=0;i<5&&typeof openOverlayEl==='function'&&openOverlayEl();i++) dismissTopOverlay(); go('${id}'); document.documentElement.dataset.theme='${th}'; return 'ok' })()`); if (ok === 'ok' || ok === '__noscreen') break; await sleep(250); }
        if (ok === '__noscreen') continue;
        await sleep(550);
        await ev(`document.documentElement.dataset.theme='${th}'`);
        const c = await ev(COLLECT);
        const reach = await ev(REACH);
        const rows = c && !c.__err ? c.out : [{ kind: 'วัดไม่ได้', key: String(c && c.__err), text: '', px: 0 }];
        if (reach && reach.px > 2) rows.push({ kind: 'ถึงไม่ได้', key: reach.key, text: reach.text, px: reach.px });
        for (const r of rows) { const k = r.kind + ' · ' + r.key + ' · ' + id;
          (res[k] = res[k] || { ...r, scr: id, where: new Set(), max: 0 }).where.add(w + 'x' + h + (THEMES.length > 1 ? '/' + th : '')); res[k].max = Math.max(res[k].max, r.px); }
      }
    }
    process.stdout.write(`${w}x${h} ✓  `);
  }
  console.log('');
  const list = Object.values(res).sort((a, b) => b.where.size - a.where.size || b.max - a.max);
  const order = ['ล้นข้าง', 'หลุดจอ', 'ถึงไม่ได้', 'ล้นปุ่ม', 'โดนตัด', 'วัดไม่ได้'];
  for (const kind of order) { const g = list.filter(x => x.kind === kind); if (!g.length) continue;
    console.log(`\n=== ${kind} · ${g.length} ชิ้น ===`);
    for (const x of g.slice(0, +(process.env.TOP || 40))) console.log(` ${x.scr} · ${x.key} "${x.text}" · ${x.max}px · [${[...x.where].join(' ')}]`); }
  if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(list.map(x => ({ ...x, where: [...x.where] })), null, 1));
  console.log(`\nfitcheck: ${list.length ? 'ไม่ผ่าน ' + list.length + ' รายการ' : 'ผ่านทุกจอทุกขนาด'}`);
  ws.close(); proc.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
  process.exit(list.length ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(2); });
