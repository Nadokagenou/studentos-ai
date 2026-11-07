// แผนที่การพึ่งพาของสคริปต์ในแอปหลัก (index.html ที่ราก) — 7 พ.ย. 69
// รัน: node devtools/architecture-map.mjs            → ตารางทุกไฟล์ + fan-in
//      node devtools/architecture-map.mjs <ไฟล์.js>  → ใครใช้ไฟล์นี้ และไฟล์นี้ใช้ใคร (ก่อนแก้/ย้ายไฟล์)
// วิธีนับ: หาชื่อระดับบนสุด (function/const/let/var/window.X =) ของแต่ละไฟล์ แล้วนับว่าไฟล์อื่นอ้างชื่อนั้นกี่ชื่อ
// เป็นการเดาแบบข้อความ ไม่ใช่ parser — ชื่อสั้น/คำทั่วไปถูกตัดทิ้ง ผลใช้ดูภาพรวม ไม่ใช่หลักฐานว่า "ไม่มีใครใช้"
// "late-bound" = อ้างไฟล์ที่โหลดทีหลัง → ใช้ได้เฉพาะตอนฟังก์ชันถูกเรียก ห้ามอ้างตอนโหลดไฟล์
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const files = [...html.matchAll(/<script[^>]*\ssrc="([^"?]+)/g)].map(m => m[1]).filter(f => !/^https?:/.test(f));
let lazy = {};
try { lazy = (await import('../src/core/feature-registry.js')).default?.manifest || {}; } catch {}
for (const [name, spec] of Object.entries(lazy)) if (!files.includes(spec.src)) files.push(spec.src);
const lazySrc = new Set(Object.values(lazy).map(s => s.src));
const src = Object.fromEntries(files.map(f => [f, fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : null]));
const STOP = new Set(['state', 'init', 'render', 'load', 'save', 'open', 'close', 'data', 'list', 'show', 'hide', 'item', 'name', 'node', 'root', 'time', 'text', 'type', 'value', 'result', 'event']);
const defs = {}, fileDefs = {};
for (const f of files) {
  if (!src[f]) continue;
  const set = new Set();
  for (const re of [/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm, /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm, /window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g])
    for (const m of src[f].matchAll(re)) set.add(m[1]);
  fileDefs[f] = set;
  for (const n of set) if (n.length > 3 && !STOP.has(n) && !defs[n]) defs[n] = f;
}
const order = Object.fromEntries(files.map((f, i) => [f, i]));
const edges = {};
for (const f of files) {
  if (!src[f]) continue;
  edges[f] = {};
  for (const [n, df] of Object.entries(defs)) {
    if (df === f) continue;
    const e = n.replace(/\$/g, '\$');
    if (new RegExp('(?<![\w$.])' + e + '(?![\w$])|window\.' + e + '(?![\w$])').test(src[f])) (edges[f][df] ||= []).push(n);
  }
}
const usedBy = {};
for (const [f, e] of Object.entries(edges)) for (const [d, names] of Object.entries(e)) (usedBy[d] ||= {})[f] = names;
const target = process.argv[2];
if (target) {
  if (!edges[target]) { console.error('ไม่พบ ' + target + ' ใน index.html'); process.exit(1); }
  console.log(`${target}${lazySrc.has(target) ? ' (โหลดตอนใช้)' : ''}\n\nใช้ชื่อจาก:`);
  for (const [d, n] of Object.entries(edges[target]).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${d}: ${n.join(', ')}`);
  console.log('\nถูกใช้โดย:');
  for (const [d, n] of Object.entries(usedBy[target] || {}).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${d}: ${n.join(', ')}`);
  process.exit(0);
}
const kb = f => src[f] ? (Buffer.byteLength(src[f]) / 1024).toFixed(0) + 'KB' : 'missing';
for (const f of files) {
  if (!src[f]) { console.log(`   ${f}  (ไม่มีไฟล์)`); continue; }
  const deps = Object.entries(edges[f]).sort((a, b) => b[1].length - a[1].length);
  const late = deps.filter(([d]) => order[d] > order[f]).map(([d]) => d);
  console.log(`${String(order[f]).padStart(2)} ${f}${lazySrc.has(f) ? ' [lazy]' : ''} (${kb(f)}) → ${deps.map(([d, n]) => `${d}(${n.length})`).join(', ') || '-'}${late.length ? `  · late-bound: ${late.join(', ')}` : ''}`);
}
console.log('\nFAN-IN (จำนวนไฟล์ที่พึ่งไฟล์นี้):');
for (const f of files.filter(f => usedBy[f]).sort((a, b) => Object.keys(usedBy[b]).length - Object.keys(usedBy[a]).length))
  console.log(`  ${String(Object.keys(usedBy[f]).length).padStart(2)}  ${f}`);
