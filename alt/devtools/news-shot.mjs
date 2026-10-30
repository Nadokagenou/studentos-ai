// ============================================================
// ถ่ายภาพหน้าจอประกอบข่าว → alt/news/img/ (ไม่ถูกโหลดโดยแอป)
// ------------------------------------------------------------
//   node alt/devtools/news-shot.mjs <ชื่อไฟล์> [scr-จอ] [--theme=light|dark|galaxy|magic|halloween]
//   node alt/devtools/news-shot.mjs 1c57-notif scr-notif
//   → alt/news/img/1c57-notif.png  (375×812 ความคมชัด 2 เท่า · แบบมือถือ)
//
// ใช้ desktop-preview.mjs เป็นเซิร์ฟเวอร์ — ข้อมูลจำลองชุดเดียวกัน ไม่เชื่อมบัญชีจริง ไม่มีข้อมูลผู้ใช้
// ไม่ใส่จอ = หน้าแรก (scr-menu) · ต้องมี Playwright (เครื่องคลาวด์ของ Claude มีให้แล้ว)
// ภาพที่ได้ต้องเปิดดูเองก่อนใส่ข่าว — เครื่องถ่ายได้ แต่ตัดสินไม่ได้ว่าภาพเล่าเรื่องตรงกับข่าว
// ============================================================
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALT = join(HERE, '..');
const PORT = 4197;

const args = process.argv.slice(2);
const theme = (args.find(a => a.startsWith('--theme=')) || '--theme=light').slice(8);
const [name, screen = 'scr-menu'] = args.filter(a => !a.startsWith('--'));
if (!/^[a-z0-9][a-z0-9._-]*$/.test(name || '')) {
  console.error('ใช้: node alt/devtools/news-shot.mjs <ชื่อไฟล์ a-z 0-9 . _ -> [scr-จอ] [--theme=...]');
  process.exit(1);
}
if (!readFileSync(join(ALT, 'index.html'), 'utf8').includes(`id="${screen}"`)) {
  console.error(`ไม่มีจอ "${screen}" ใน index.html`);
  process.exit(1);
}

// Playwright ติดตั้งระดับเครื่อง ไม่ใช่ใน repo (repo ไม่มี npm)
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = createRequire(join(process.cwd(), 'x'))('playwright')); }

const server = spawn(process.execPath, [join(HERE, 'desktop-preview.mjs'), `--port=${PORT}`, `--theme=${theme}`], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, fail) => { server.stdout.once('data', ok); server.once('exit', fail); });

const out = join(ALT, 'news', 'img', name + '.png');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/alt/`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof go === 'function' && typeof curScreen === 'string' && curScreen, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);   // หน้าโหลด + แอนิเมชันเข้าจอ
  if (screen !== 'scr-menu') { await page.evaluate(id => go(id), screen); await page.waitForTimeout(1200); }
  // ป้าย "ข้อมูลจำลอง" ของพรีวิวเป็นของคนพัฒนา ไม่ใช่ของแอป
  await page.evaluate(() => [...document.body.children].filter(el => el.tagName === 'SPAN' && /ข้อมูลจำลอง/.test(el.textContent)).forEach(el => el.remove()));
  const active = await page.evaluate(() => typeof curScreen === 'string' ? curScreen : '');
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  if (errors.length) console.warn('เตือน · แอปมี error ระหว่างถ่าย:\n  ' + errors.join('\n  '));
  if (active !== screen) console.warn(`เตือน · จอที่เห็นคือ "${active || '?'}" ไม่ใช่ "${screen}" — เปิดภาพดูก่อนใช้`);
  const kb = Math.round(statSync(out).size / 1024);
  console.log(`ได้ภาพ alt/news/img/${name}.png (${kb} KB) — ใส่ในข่าวเป็น "image": "img/${name}.png"`);
} finally {
  await browser.close();
  server.kill();
}
