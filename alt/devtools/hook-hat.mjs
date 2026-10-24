// สร้างรูปน้องฮูกใส่หมวกแม่มดสำหรับธีม Halloween — node alt/devtools/hook-hat.mjs
// 24 ต.ค. 69 · เจ้าของ: "น้องฮูกทำให้กลับเป็นน้องเดิมแค่ใส่หมวกฮาลาวีน"
// เดิมธีมเปลี่ยนรูปน้องฮูกทั้งตัวเป็นมัมมี่ (hook-mummy.webp — ยังเป็นชุดสะสมในคอลเลกชันได้ตามเดิม)
// ตอนนี้ใช้รูปน้องฮูกตัวจริง (ฝังเป็น data URI — SVG ที่เปิดผ่าน <img> โหลดไฟล์อื่นไม่ได้) แล้ววาดหมวกทับ
// ขนาดภาพเท่าต้นฉบับทุกไฟล์ จอไหนเคยวางน้องฮูกไว้ยังไงก็วางเหมือนเดิม · แก้หมวกที่นี่แล้วรันใหม่ อย่าแก้ไฟล์ .svg ตรง ๆ
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ALT = fileURLToPath(new URL('..', import.meta.url));
const OUT = ALT;

// หมวกวาดรอบจุด (0,0) = กลางปีกหมวก กว้าง 200
const HAT = `
  <defs>
    <linearGradient id="hc" x1="0" x2="1"><stop offset="0" stop-color="#5B3A8C"/><stop offset=".45" stop-color="#3A2361"/><stop offset="1" stop-color="#1E1236"/></linearGradient>
    <linearGradient id="hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C2F78"/><stop offset="1" stop-color="#1A0F2E"/></linearGradient>
    <linearGradient id="hs" x1="0" x2="1"><stop offset="0" stop-color="#FFB25A"/><stop offset=".5" stop-color="#F07A16"/><stop offset="1" stop-color="#B9520A"/></linearGradient>
    <filter id="hsh" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <ellipse cx="2" cy="14" rx="86" ry="15" fill="#0B1240" opacity=".28" filter="url(#hsh)"/>
  <ellipse cx="0" cy="0" rx="100" ry="23" fill="url(#hb)"/>
  <ellipse cx="0" cy="-3" rx="92" ry="17" fill="#2A1A47"/>
  <path d="M-54 -4 C-50 -40 -36 -80 -14 -112 C-4 -126 14 -138 34 -140 C50 -141 64 -134 72 -124 C58 -126 44 -122 34 -112 C24 -100 30 -60 54 -4 C20 6 -20 6 -54 -4 Z" fill="url(#hc)"/>
  <path d="M-40 -40 C-34 -70 -22 -96 -8 -114" fill="none" stroke="#9A7BD0" stroke-width="5" stroke-linecap="round" opacity=".45"/>
  <path d="M-52 -14 C-18 -5 18 -5 51 -14 L47 -34 C16 -26 -16 -26 -47 -34 Z" fill="url(#hs)"/>
  <rect x="-13" y="-34" width="26" height="24" rx="3" fill="none" stroke="#F8D46A" stroke-width="5"/>
  <rect x="-3" y="-28" width="6" height="12" rx="1" fill="#F8D46A"/>`;

// owl: ย่อน้องฮูกแล้วชิดล่าง เพื่อเว้นที่บนหัวให้หมวก · hat: ตำแหน่ง/ขนาด/เอียงของหมวกบนภาพนั้น
// bg: สีพื้นของภาพที่ไม่โปร่งใส (hook-avatar.png ทึบทั้งแผ่น) — ย่อแล้วต้องเติมขอบด้วยสีเดียวกัน ไม่งั้นเห็นเป็นกรอบในวงกลม
const VARIANTS = [
  { src: 'hook-body.webp', type: 'image/webp', w: 360, h: 501, owl: 0.86, hat: 'translate(186 128) rotate(-8) scale(.86)' },
  { src: 'hook-face.webp', type: 'image/webp', w: 240, h: 240, owl: 0.8, hat: 'translate(122 74) rotate(-8) scale(.62)' },
  { src: 'hook-avatar.png', type: 'image/png', w: 192, h: 192, owl: 0.8, bg: '#E8EFFF', hat: 'translate(98 62) rotate(-8) scale(.5)' },
];

for (const v of VARIANTS) {
  const data = readFileSync(ALT + v.src).toString('base64');
  const ow = v.w * v.owl, oh = v.h * v.owl, ox = (v.w - ow) / 2, oy = v.h - oh;
  const name = 'hook-hat-' + v.src.split('-')[1].split('.')[0] + '.svg';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.w} ${v.h}" width="${v.w}" height="${v.h}">` +
    (v.bg ? `<rect width="${v.w}" height="${v.h}" fill="${v.bg}"/>` : '') +
    `<image x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${ow.toFixed(1)}" height="${oh.toFixed(1)}" href="data:${v.type};base64,${data}"/>` +
    `<g transform="${v.hat}">${HAT}</g></svg>\n`;
  writeFileSync(OUT + name, svg);
  console.log(name, (svg.length / 1024).toFixed(1) + 'KB');
}
