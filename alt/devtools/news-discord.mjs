// ============================================================
// ข่าวสาร → Discord ของ tester (ไม่ถูกโหลดโดยแอป)
// ------------------------------------------------------------
// ข่าวที่ผ่าน `news.mjs check` และเจ้าของย้ายเข้า announcements.json แล้ว
// คือข่าวที่ "จริงและอนุมัติแล้ว" — ส่งต่อให้ tester ใน Discord ด้วยข้อความเดียวกัน
// ไม่ต้องเขียนซ้ำ ไม่ต้องมีใครจำว่าต้องโพสต์
//
//   node alt/devtools/news-discord.mjs <ไฟล์เก่า|-> <ไฟล์ใหม่> [--dry]
//     ส่งเฉพาะ id ที่มีในไฟล์ใหม่แต่ไม่มีในไฟล์เก่า ("-" = ไม่มีไฟล์เก่า → ไม่ส่งอะไร
//     กันยิงข่าวเก่าทั้งหมดซ้ำตอนรันครั้งแรก)
//   node alt/devtools/news-discord.mjs --id <id,id,...|รุ่น> <ไฟล์ใหม่> [--dry]
//     ส่งซ้ำด้วยมือ — หลาย id คั่นด้วยจุลภาค หรือใส่เลขรุ่น (1C60) = ทุกข่าวของรุ่นนั้น
//
// URL ของ webhook อ่านจาก env DISCORD_WEBHOOK_URL เท่านั้น — repo สาธารณะ ห้ามเขียนลงไฟล์
// ไม่มี env = พิมพ์ข้อความที่จะส่งออกมาเฉย ๆ (เหมือน --dry)
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const APP_URL = 'https://nadokagenou.github.io/studentos-ai/alt/';
// ชื่อหมวดเดียวกับจอข่าวสาร (NEWS_KINDS ใน news.js) — tester เห็นคำเดียวกับในแอป
const KIND = {
  feature: ['ฟีเจอร์ใหม่', 0x3b82f6],
  theme:   ['ธีมใหม่', 0xa855f7],
  update:  ['อัปเดตแอป', 0x22c55e],
  fix:     ['แก้ไข', 0x64748b],
  notice:  ['ประกาศสำคัญ', 0xef4444],
};

export function newItems(oldDoc, newDoc, now = Date.now()) {
  if (!oldDoc) return [];
  const seen = new Set((oldDoc.items || []).map(it => it.id));
  return (newDoc.items || []).filter(it => !seen.has(it.id))
    // ประกาศปิดปรับปรุงที่จบไปแล้วไม่ใช่ข่าว — แอปก็ซ่อน
    .filter(it => !(it.until && Date.parse(it.until) < now));
}

// รูปอ่านจาก raw.githubusercontent ของคอมมิตที่เพิ่งถูก push — มีทันที ไม่ต้องรอเว็บจริงอัปเดต
export function imageUrl(it, env = process.env) {
  if (!it.image) return null;
  const repo = env.GITHUB_REPOSITORY || 'nadokagenou/studentos-ai';
  return `https://raw.githubusercontent.com/${repo}/${env.GITHUB_SHA || 'main'}/alt/news/${it.image}`;
}

export function toEmbed(it, env = process.env) {
  const [name, color] = KIND[it.kind] || ['ข่าวสาร', 0x64748b];
  const points = (it.points || []).map(p => '• ' + p).join('\n');
  const from = it.kind === 'notice' ? 'จาก' + (it.by || 'ทีม StudentOS') : 'รุ่น ' + (it.release || '');
  // มี promo = พาดหัวชวนลองเป็นหัวใหญ่ แล้วหัวข้อเดิมเป็นบรรทัดหนาแรก
  const head = it.promo ? '**' + it.title + '**' : '';
  const e = {
    title: (it.promo || it.title).slice(0, 256),
    url: APP_URL,
    description: [head, it.body, points].filter(Boolean).join('\n\n').slice(0, 4000),
    color,
    // evidence ไม่ส่ง — เป็นของสำหรับตรวจ ไม่ใช่ของสำหรับอ่าน
    footer: { text: `${name} · ${from}` },
    timestamp: new Date(it.date).toISOString(),
  };
  const img = imageUrl(it, env);
  if (img) e.image = { url: img };
  return e;
}

// ข้อความนำ — ชวนเปิดแอปและชวนแจ้งบั๊ก ไม่อ้างอะไรเกินข่าวที่ตรวจแล้ว
// ไม่สัญญาแทนทีม ("ทีมอ่านทุกข้อความ") — ทีมไม่มีเวลาตอบ สัญญาแล้วเงียบแย่กว่าไม่สัญญา
export function intro(n) {
  return `🚀 **StudentOS อัปเดตใหม่ ${n} เรื่อง!** เปิดแอปแล้วลองเลย 👉 ${APP_URL}\n` +
    'ลองแล้วเจอบั๊ก หรือชอบ/ไม่ชอบตรงไหน บอกในห้องนี้ได้เลย 🙏';
}

// "1c60-a, 1c60-b" = ตาม id · "1C60" = ทุกข่าวของรุ่นนั้น · เรียงตามไฟล์ (ใหม่สุดก่อน)
export function pick(doc, query) {
  const want = String(query || '').split(',').map(x => x.trim()).filter(Boolean);
  return (doc.items || []).filter(it => want.includes(it.id) || want.some(w => it.release && w.toUpperCase() === it.release.toUpperCase()));
}

// Discord รับได้ 10 embed ต่อข้อความ
export function toMessages(items, env = process.env) {
  const out = [];
  for (let i = 0; i < items.length; i += 10) {
    out.push({ username: 'StudentOS', content: i ? '' : intro(items.length), embeds: items.slice(i, i + 10).map(it => toEmbed(it, env)) });
  }
  return out;
}

async function main(argv) {
  const dry = argv.includes('--dry');
  const args = argv.filter(a => a !== '--dry');
  const read = f => JSON.parse(readFileSync(f, 'utf8'));
  let items;
  if (args[0] === '--id') {
    items = pick(read(args[2]), args[1]);
    if (!items.length) { console.error(`ไม่พบข่าว "${args[1]}" — ใส่ id (คั่นด้วยจุลภาค) หรือเลขรุ่น เช่น 1C60`); process.exit(1); }
  } else {
    items = newItems(args[0] === '-' ? null : read(args[0]), read(args[1]));
  }
  if (!items.length) { console.log('ไม่มีข่าวใหม่ — ไม่ส่ง'); return; }
  const hook = process.env.DISCORD_WEBHOOK_URL;
  for (const msg of toMessages(items)) {
    if (dry || !hook) { console.log(JSON.stringify(msg, null, 2)); continue; }
    const res = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
    if (!res.ok) { console.error(`Discord ตอบ ${res.status}: ${await res.text()}`); process.exit(1); }
  }
  console.log(`${dry || !hook ? 'ทดลอง (ไม่ได้ส่งจริง)' : 'ส่งแล้ว'}: ${items.map(it => it.id).join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
