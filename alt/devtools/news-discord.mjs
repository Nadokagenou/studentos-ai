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
//   node alt/devtools/news-discord.mjs --id <id> <ไฟล์ใหม่> [--dry]
//     ส่งข่าวชิ้นเดียวซ้ำด้วยมือ
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

export function toEmbed(it) {
  const [name, color] = KIND[it.kind] || ['ข่าวสาร', 0x64748b];
  const points = (it.points || []).map(p => '• ' + p).join('\n');
  const from = it.kind === 'notice' ? 'จาก' + (it.by || 'ทีม StudentOS') : 'รุ่น ' + (it.release || '');
  return {
    title: it.title.slice(0, 256),
    url: APP_URL,
    description: [it.body, points].filter(Boolean).join('\n\n').slice(0, 4000),
    color,
    // evidence ไม่ส่ง — เป็นของสำหรับตรวจ ไม่ใช่ของสำหรับอ่าน
    footer: { text: `${name} · ${from}` },
    timestamp: new Date(it.date).toISOString(),
  };
}

// Discord รับได้ 10 embed ต่อข้อความ
export function toMessages(items) {
  const out = [];
  for (let i = 0; i < items.length; i += 10) {
    out.push({ username: 'StudentOS', content: i ? '' : `มีอัปเดตใหม่ ${items.length} เรื่อง · เปิดแอป ${APP_URL}`, embeds: items.slice(i, i + 10).map(toEmbed) });
  }
  return out;
}

async function main(argv) {
  const dry = argv.includes('--dry');
  const args = argv.filter(a => a !== '--dry');
  const read = f => JSON.parse(readFileSync(f, 'utf8'));
  let items;
  if (args[0] === '--id') {
    items = (read(args[2]).items || []).filter(it => it.id === args[1]);
    if (!items.length) { console.error(`ไม่พบข่าว id "${args[1]}"`); process.exit(1); }
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
