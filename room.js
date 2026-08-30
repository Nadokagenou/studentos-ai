// ============================================================
// ห้องของฉัน — พื้นที่ส่วนตัวที่แต่งเองได้
// ------------------------------------------------------------
// ทำไมเป็น "ห้อง" ไม่ใช่ "ฟีด": นักเรียนไม่ได้อยากอวดว่าทำงานเสร็จกี่ชิ้น
// เขาอยากมีที่ที่เป็นของเขาคนเดียวและหน้าตาไม่เหมือนใคร ซึ่งเป็นของที่ IG ให้ไม่ได้
// เพราะโปรไฟล์ IG ของทุกคนหน้าตาเหมือนกันหมด เปลี่ยนอะไรไม่ได้เลยสักอย่าง
//
// ทำไมเป็น "ช่อง" ไม่ใช่ "ลากวางอิสระ": ลากวางบนจอมือถือทำยากและพังง่าย
// และห้องที่จัดไม่เป็นจะออกมาน่าเกลียดจนเจ้าของไม่กล้าอวด ซึ่งฆ่าฟีเจอร์ทั้งอัน
// ช่องตายตัวทำให้ทุกห้องออกมาดูดี ส่วนความเป็นตัวตนไปอยู่ที่ "เลือกอะไรมาวาง"
// กับสี ผนัง พื้น โทนแสง และข้อความที่พิมพ์เอง — อิสระพอที่จะไม่ซ้ำกัน
//
// รอบนี้ยังไม่มีหลังบ้าน: ห้องเก็บใน state.settings.room ซึ่งซิงก์ขึ้น cloud
// ตามก้อนเดิมอยู่แล้ว · หน้าสาธารณะ (studentos.app/@ชื่อ) กับสมุดเยี่ยม
// เป็นรอบถัดไป และ roomSceneSVG() ถูกเขียนเป็นฟังก์ชันบริสุทธิ์ไว้ให้รอบนั้นเรียกซ้ำได้
// ============================================================

// ---------- ผนัง ----------
// pat = ลายที่วาดทับสีพื้น (จุด/ทาง) — เก็บเป็น id ของ <pattern> ที่ประกาศใน defs
const ROOM_WALLS = [
  { id: 'cream',  name: 'ครีม',      cost: 0,  c: '#EFE6D6' },
  { id: 'sky',    name: 'ฟ้าอ่อน',    cost: 0,  c: '#D6E4F0' },
  { id: 'blush',  name: 'ชมพูอ่อน',   cost: 15, c: '#F2DCE4' },
  { id: 'mint',   name: 'เขียวมิ้นต์', cost: 15, c: '#D7E9DE' },
  { id: 'navy',   name: 'กรมท่า',     cost: 25, c: '#2B3350' },
  { id: 'plum',   name: 'ม่วงเข้ม',    cost: 25, c: '#3B2B44' },
  { id: 'dots',   name: 'ลายจุด',     cost: 35, c: '#EDE3F2', pat: 'rp-dots' },
  { id: 'stripe', name: 'ลายทาง',     cost: 35, c: '#E8E2D4', pat: 'rp-stripe' },
];

// ---------- พื้น ----------
const ROOM_FLOORS = [
  { id: 'wood',  name: 'ไม้',       cost: 0,  c: '#A8794F', c2: '#96693F' },
  { id: 'dark',  name: 'ไม้เข้ม',   cost: 15, c: '#6B4A33', c2: '#5A3C29' },
  { id: 'tile',  name: 'กระเบื้อง', cost: 20, c: '#D8D2C8', c2: '#C4BDB0' },
  { id: 'carpet',name: 'พรมเทา',    cost: 20, c: '#8A8894', c2: '#7B7986' },
];

// ---------- โทนแสง ----------
// เปลี่ยนอารมณ์ทั้งห้องด้วยค่าเดียว — ของถูกที่สุดที่ให้ผลเยอะที่สุด
const ROOM_LIGHTS = [
  { id: 'warm', name: 'อุ่น',    cost: 0,  c: '#FFCE7A' },
  { id: 'cool', name: 'ขาวนวล', cost: 0,  c: '#CFE4FF' },
  { id: 'pink', name: 'ชมพู',    cost: 20, c: '#FFA9D0' },
  { id: 'lime', name: 'เขียวเรือง', cost: 20, c: '#A9F0C4' },
];

// ---------- ของที่วางในห้อง ----------
// แต่ละชิ้นวาดอยู่ในพิกัดของช่องตัวเอง ไม่ต้องมี transform จากข้างนอก
// ชิ้นไหนวาดเกินขอบช่องได้ (เช่น ไฟราวที่พาดทั้งเพดาน) ก็เขียนพิกัดเต็มไปเลย
const ROOM_ITEMS = [
  // ===== หน้าต่าง (วิวข้างนอก) : ช่อง x20..84 y28..80 =====
  { slot: 'window', id: 'day', name: 'กลางวัน', cost: 0, svg:
    `<rect x="20" y="28" width="64" height="52" fill="#8FC1E3"/>
     <circle cx="70" cy="42" r="7" fill="#FFF3C4"/>
     <ellipse cx="36" cy="52" rx="13" ry="6" fill="#FFFFFF" opacity=".8"/>
     <ellipse cx="52" cy="60" rx="10" ry="5" fill="#FFFFFF" opacity=".65"/>` },
  { slot: 'window', id: 'night', name: 'กลางคืน', cost: 15, svg:
    `<rect x="20" y="28" width="64" height="52" fill="#1B2547"/>
     <circle cx="66" cy="42" r="8" fill="#F3EDD2"/>
     <circle cx="62" cy="39" r="7" fill="#1B2547"/>
     <circle cx="32" cy="40" r="1.4" fill="#FFF"/><circle cx="44" cy="52" r="1.1" fill="#FFF"/>
     <circle cx="28" cy="62" r="1.3" fill="#FFF"/><circle cx="52" cy="36" r="1" fill="#FFF"/>
     <circle cx="72" cy="66" r="1.2" fill="#FFF"/><circle cx="38" cy="70" r="1" fill="#FFF"/>` },
  { slot: 'window', id: 'rain', name: 'ฝนตก', cost: 20, svg:
    `<rect x="20" y="28" width="64" height="52" fill="#5C6B7A"/>
     <ellipse cx="40" cy="44" rx="15" ry="7" fill="#8A97A5"/>
     <ellipse cx="60" cy="48" rx="12" ry="6" fill="#8A97A5"/>
     <g stroke="#C9D6E2" stroke-width="1.4" stroke-linecap="round" opacity=".85">
       <line x1="28" y1="58" x2="25" y2="66"/><line x1="40" y1="56" x2="37" y2="64"/>
       <line x1="52" y1="60" x2="49" y2="68"/><line x1="64" y1="55" x2="61" y2="63"/>
       <line x1="74" y1="62" x2="71" y2="70"/><line x1="34" y1="68" x2="31" y2="76"/>
       <line x1="58" y1="70" x2="55" y2="78"/></g>` },
  { slot: 'window', id: 'dusk', name: 'พระอาทิตย์ตก', cost: 25, svg:
    `<defs><linearGradient id="rg-dusk" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0" stop-color="#5A4A8C"/><stop offset=".55" stop-color="#E8865F"/>
       <stop offset="1" stop-color="#F5C58A"/></linearGradient></defs>
     <rect x="20" y="28" width="64" height="52" fill="url(#rg-dusk)"/>
     <circle cx="52" cy="62" r="10" fill="#FFE3A8"/>
     <rect x="20" y="70" width="64" height="10" fill="#3E3358" opacity=".55"/>` },

  // ===== โปสเตอร์บนผนัง : ช่อง x106..156 y26..84 =====
  { slot: 'poster', id: 'none', name: 'ไม่มี', cost: 0, svg: '' },
  { slot: 'poster', id: 'abstract', name: 'วงกลม', cost: 20, svg:
    `<g transform="rotate(-2.5 131 55)">
       <rect x="106" y="26" width="50" height="58" rx="2" fill="#F3EFE6"/>
       <circle cx="131" cy="48" r="13" fill="#E8734A"/>
       <circle cx="122" cy="58" r="9" fill="#3D5A80" opacity=".85"/>
       <rect x="114" y="72" width="34" height="2.5" rx="1.2" fill="#2B2B2B" opacity=".4"/>
       <rect x="114" y="77" width="22" height="2.5" rx="1.2" fill="#2B2B2B" opacity=".4"/>
       <rect x="106" y="26" width="50" height="58" rx="2" fill="none" stroke="#2B2622" stroke-width="2"/>
     </g>` },
  { slot: 'poster', id: 'cat', name: 'แมวใหญ่', cost: 25, svg:
    `<g transform="rotate(2 131 55)">
       <rect x="106" y="26" width="50" height="58" rx="2" fill="#FBE9D4"/>
       <ellipse cx="131" cy="62" rx="15" ry="12" fill="#4A4048"/>
       <circle cx="131" cy="46" r="11" fill="#4A4048"/>
       <path d="M122 39 L124 30 L130 38 Z" fill="#4A4048"/>
       <path d="M140 39 L138 30 L132 38 Z" fill="#4A4048"/>
       <circle cx="127" cy="45" r="1.8" fill="#F7D77A"/><circle cx="135" cy="45" r="1.8" fill="#F7D77A"/>
       <rect x="106" y="26" width="50" height="58" rx="2" fill="none" stroke="#2B2622" stroke-width="2"/>
     </g>` },
  { slot: 'poster', id: 'mountain', name: 'ภูเขา', cost: 25, svg:
    `<g transform="rotate(-1.5 131 55)">
       <rect x="106" y="26" width="50" height="58" rx="2" fill="#DCEAF0"/>
       <circle cx="142" cy="41" r="6" fill="#F5D98E"/>
       <path d="M106 74 L122 46 L134 66 L142 54 L156 74 Z" fill="#4C6B7A"/>
       <path d="M106 74 L120 56 L132 74 Z" fill="#6E8B96"/>
       <rect x="106" y="74" width="50" height="10" fill="#385260"/>
       <rect x="106" y="26" width="50" height="58" rx="2" fill="none" stroke="#2B2622" stroke-width="2"/>
     </g>` },
  { slot: 'poster', id: 'neon', name: 'ป้ายนีออน', cost: 40, svg:
    `<g transform="rotate(1 131 55)">
       <rect x="106" y="32" width="50" height="46" rx="6" fill="#170E24"/>
       <path d="M116 62 Q121 42 126 62 Q131 42 136 62" fill="none" stroke="#FF7AD9"
             stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
       <circle cx="146" cy="46" r="5" fill="none" stroke="#7AE9FF" stroke-width="2.5"/>
       <rect x="106" y="32" width="50" height="46" rx="6" fill="none" stroke="#3A2B4E" stroke-width="2"/>
     </g>` },

  // ===== ของบนชั้น : ชั้นอยู่ที่ y=74 ช่วง x176..300 · ของวางบน y50..74 =====
  { slot: 'shelf', id: 'none', name: 'ไม่มี', cost: 0, svg: '' },
  { slot: 'shelf', id: 'books', name: 'หนังสือ', cost: 0, svg:
    `<rect x="184" y="54" width="8" height="20" fill="#C4478A"/>
     <rect x="194" y="58" width="7" height="16" fill="#E8A87C"/>
     <rect x="203" y="51" width="9" height="23" fill="#5E9670"/>
     <rect x="214" y="60" width="7" height="14" fill="#F0E2B8"/>
     <rect x="223" y="55" width="8" height="19" fill="#7FA8D8"/>` },
  { slot: 'shelf', id: 'plant', name: 'ต้นไม้', cost: 20, svg:
    `<rect x="238" y="64" width="14" height="10" rx="2" fill="#B5745A"/>
     <ellipse cx="239" cy="58" rx="7" ry="9" fill="#5E9670"/>
     <ellipse cx="251" cy="59" rx="6" ry="8" fill="#4C7C5A"/>
     <ellipse cx="245" cy="53" rx="6" ry="9" fill="#6DA87E"/>` },
  { slot: 'shelf', id: 'trophy', name: 'ถ้วยรางวัล', cost: 35, svg:
    `<path d="M262 52 L282 52 L279 64 L265 64 Z" fill="#E8C25A"/>
     <path d="M262 54 Q255 56 260 62" fill="none" stroke="#E8C25A" stroke-width="2.5"/>
     <path d="M282 54 Q289 56 284 62" fill="none" stroke="#E8C25A" stroke-width="2.5"/>
     <rect x="269" y="64" width="6" height="6" fill="#C9A43F"/>
     <rect x="264" y="70" width="16" height="4" rx="1" fill="#8A6206"/>` },
  { slot: 'shelf', id: 'figure', name: 'ตุ๊กตา', cost: 35, svg:
    `<circle cx="200" cy="58" r="7" fill="#F5D2B8"/>
     <path d="M193 74 Q193 63 200 63 Q207 63 207 74 Z" fill="#C4478A"/>
     <circle cx="197" cy="58" r="1.2" fill="#3A2E2A"/><circle cx="203" cy="58" r="1.2" fill="#3A2E2A"/>
     <path d="M193 54 Q200 46 207 54 Q200 51 193 54 Z" fill="#6B4A33"/>` },
  { slot: 'shelf', id: 'crystal', name: 'คริสตัล', cost: 60, svg:
    `<path d="M252 74 L246 60 L252 48 L258 60 Z" fill="#9BD8E8" opacity=".9"/>
     <path d="M252 48 L258 60 L252 74 Z" fill="#6BB8CE" opacity=".9"/>
     <path d="M264 74 L260 64 L264 56 L268 64 Z" fill="#B7E8F5" opacity=".85"/>
     <ellipse cx="256" cy="74" rx="16" ry="3" fill="#9BD8E8" opacity=".28"/>` },

  // ===== ของบนโต๊ะ : โต๊ะ x150..290 หน้าโต๊ะ y=120 · ของวางบน y96..120 =====
  { slot: 'desk', id: 'none', name: 'ไม่มี', cost: 0, svg: '' },
  { slot: 'desk', id: 'laptop', name: 'โน้ตบุ๊ก', cost: 0, svg:
    `<rect x="166" y="98" width="40" height="22" rx="2" fill="#3A3F52"/>
     <rect x="169" y="101" width="34" height="16" rx="1" fill="#7FA8D8"/>
     <rect x="161" y="118" width="50" height="4" rx="2" fill="#4A5066"/>` },
  { slot: 'desk', id: 'books', name: 'กองหนังสือ', cost: 15, svg:
    `<rect x="166" y="110" width="42" height="5" rx="1" fill="#C4478A"/>
     <rect x="169" y="105" width="38" height="5" rx="1" fill="#5E9670"/>
     <rect x="164" y="100" width="40" height="5" rx="1" fill="#E8A87C"/>
     <rect x="171" y="115" width="36" height="5" rx="1" fill="#7FA8D8"/>` },
  { slot: 'desk', id: 'coffee', name: 'กาแฟ + สมุด', cost: 20, svg:
    `<rect x="163" y="110" width="34" height="10" rx="1.5" fill="#F3EFE6"/>
     <line x1="167" y1="114" x2="192" y2="114" stroke="#B8B0A2" stroke-width="1"/>
     <line x1="167" y1="117" x2="186" y2="117" stroke="#B8B0A2" stroke-width="1"/>
     <rect x="200" y="104" width="13" height="16" rx="2" fill="#D9CFC0"/>
     <path d="M213 108 Q219 111 213 115" fill="none" stroke="#D9CFC0" stroke-width="2.5"/>
     <ellipse cx="206.5" cy="104" rx="6.5" ry="2.5" fill="#6B4A33"/>
     <path d="M204 98 Q206 94 204 90" fill="none" stroke="#FFF" stroke-width="1.5" opacity=".5"/>` },
  { slot: 'desk', id: 'cactus', name: 'แคคตัส', cost: 20, svg:
    `<rect x="176" y="110" width="16" height="10" rx="2" fill="#C87A5A"/>
     <rect x="181" y="94" width="7" height="18" rx="3.5" fill="#5E9670"/>
     <rect x="174" y="100" width="6" height="9" rx="3" fill="#4C7C5A"/>
     <rect x="189" y="98" width="6" height="11" rx="3" fill="#4C7C5A"/>
     <circle cx="184.5" cy="94" r="2" fill="#F5A9C4"/>` },
  { slot: 'desk', id: 'vinyl', name: 'เครื่องเล่นแผ่น', cost: 45, svg:
    `<rect x="164" y="102" width="46" height="18" rx="2" fill="#3A2E2A"/>
     <circle cx="182" cy="111" r="7" fill="#141014"/>
     <circle cx="182" cy="111" r="2" fill="#E8A87C"/>
     <rect x="198" y="105" width="9" height="3" rx="1.5" fill="#8A7A6A"/>
     <path d="M203 108 L196 113" stroke="#8A7A6A" stroke-width="1.5" stroke-linecap="round"/>` },

  // ===== เพดาน : พาดตลอดความกว้าง y0..30 =====
  { slot: 'ceiling', id: 'none', name: 'ไม่มี', cost: 0, svg: '' },
  { slot: 'ceiling', id: 'string', name: 'ไฟราว', cost: 25, svg:
    `<path d="M0 12 Q46 26 92 12 Q138 -2 184 12 Q230 26 276 12 Q300 6 320 10"
           fill="none" stroke="#6B5A46" stroke-width="1.5"/>
     <circle cx="46" cy="19" r="3" fill="#FFD98A"/><circle cx="92" cy="12" r="3" fill="#FFB3D9"/>
     <circle cx="138" cy="5" r="3" fill="#FFD98A"/><circle cx="184" cy="12" r="3" fill="#9BE7C4"/>
     <circle cx="230" cy="19" r="3" fill="#FFD98A"/><circle cx="276" cy="12" r="3" fill="#FFB3D9"/>` },
  { slot: 'ceiling', id: 'moon', name: 'โคมพระจันทร์', cost: 40, svg:
    `<line x1="160" y1="0" x2="160" y2="18" stroke="#6B5A46" stroke-width="1.5"/>
     <circle cx="160" cy="27" r="10" fill="#F5EBC8"/>
     <circle cx="156" cy="24" r="2" fill="#DDD0A8" opacity=".7"/>
     <circle cx="163" cy="31" r="1.5" fill="#DDD0A8" opacity=".7"/>` },
  { slot: 'ceiling', id: 'stars', name: 'ดาวเรืองแสง', cost: 40, svg:
    `<g fill="#C8F0A8">
       <path d="M40 16 L42 21 L47 21 L43 24 L45 29 L40 26 L35 29 L37 24 L33 21 L38 21 Z"/>
       <path d="M120 8 L121.5 12 L126 12 L122 15 L124 19 L120 16.5 L116 19 L118 15 L114 12 L118.5 12 Z"/>
       <path d="M230 18 L232 23 L237 23 L233 26 L235 31 L230 28 L225 31 L227 26 L223 23 L228 23 Z"/>
       <path d="M290 6 L291.5 10 L296 10 L292 13 L294 17 L290 14.5 L286 17 L288 13 L284 10 L288.5 10 Z"/>
     </g>` },

  // ===== เพื่อนร่วมห้อง / ของบนพื้น : พรมอยู่ที่ cx60 cy205 =====
  { slot: 'pet', id: 'none', name: 'ไม่มี', cost: 0, svg: '' },
  { slot: 'pet', id: 'rug', name: 'พรมเปล่า', cost: 0, svg:
    `<ellipse cx="60" cy="205" rx="52" ry="17" fill="#7A5A6B"/>
     <ellipse cx="60" cy="205" rx="37" ry="11" fill="#8E6B7D"/>` },
  { slot: 'pet', id: 'cat', name: 'แมว', cost: 30, svg:
    `<ellipse cx="60" cy="205" rx="52" ry="17" fill="#7A5A6B"/>
     <ellipse cx="60" cy="205" rx="37" ry="11" fill="#8E6B7D"/>
     <ellipse cx="62" cy="200" rx="18" ry="9" fill="#3A3038"/>
     <circle cx="80" cy="193" r="8" fill="#3A3038"/>
     <path d="M74 187 L76 180 L80 187 Z" fill="#3A3038"/>
     <path d="M83 187 L87 180 L88 187 Z" fill="#3A3038"/>
     <circle cx="77" cy="192" r="1.4" fill="#F0E2B8"/><circle cx="83.5" cy="192" r="1.4" fill="#F0E2B8"/>
     <path d="M44 199 Q32 194 37 185" fill="none" stroke="#3A3038" stroke-width="4.5" stroke-linecap="round"/>` },
  { slot: 'pet', id: 'dog', name: 'หมา', cost: 30, svg:
    `<ellipse cx="60" cy="205" rx="52" ry="17" fill="#7A5A6B"/>
     <ellipse cx="60" cy="205" rx="37" ry="11" fill="#8E6B7D"/>
     <ellipse cx="60" cy="200" rx="19" ry="9" fill="#C89A6B"/>
     <circle cx="79" cy="192" r="9" fill="#C89A6B"/>
     <ellipse cx="72" cy="187" rx="4" ry="7" fill="#A87B4E" transform="rotate(-22 72 187)"/>
     <ellipse cx="87" cy="188" rx="4" ry="7" fill="#A87B4E" transform="rotate(18 87 188)"/>
     <circle cx="76" cy="191" r="1.4" fill="#3A2E2A"/><circle cx="83" cy="191" r="1.4" fill="#3A2E2A"/>
     <ellipse cx="80" cy="196" rx="2.6" ry="2" fill="#3A2E2A"/>
     <path d="M42 197 Q34 189 41 184" fill="none" stroke="#C89A6B" stroke-width="4.5" stroke-linecap="round"/>` },
  { slot: 'pet', id: 'beanbag', name: 'เบาะนั่ง', cost: 25, svg:
    `<ellipse cx="60" cy="205" rx="52" ry="17" fill="#7A5A6B"/>
     <ellipse cx="60" cy="205" rx="37" ry="11" fill="#8E6B7D"/>
     <path d="M34 204 Q30 182 60 180 Q90 182 86 204 Q60 212 34 204 Z" fill="#E8734A"/>
     <path d="M42 196 Q60 190 78 196" fill="none" stroke="#C4562F" stroke-width="1.5"/>` },
  { slot: 'pet', id: 'capybara', name: 'คาปิบารา', cost: 60, svg:
    `<ellipse cx="60" cy="205" rx="52" ry="17" fill="#7A5A6B"/>
     <ellipse cx="60" cy="205" rx="37" ry="11" fill="#8E6B7D"/>
     <ellipse cx="58" cy="199" rx="23" ry="11" fill="#9B7A5A"/>
     <ellipse cx="81" cy="191" rx="11" ry="9" fill="#9B7A5A"/>
     <ellipse cx="76" cy="184" rx="3" ry="2.5" fill="#7A5C42"/>
     <ellipse cx="87" cy="184" rx="3" ry="2.5" fill="#7A5C42"/>
     <path d="M78 190 L84 190" stroke="#5E4632" stroke-width="1.6" stroke-linecap="round"/>
     <ellipse cx="90" cy="193" rx="3.5" ry="2.6" fill="#7A5C42"/>
     <rect x="46" y="188" width="14" height="4" rx="2" fill="#F5D98E"/>` },
];

const ROOM_SLOTS = [
  { id: 'wall',    name: 'ผนัง' },
  { id: 'floor',   name: 'พื้น' },
  { id: 'light',   name: 'แสง' },
  { id: 'window',  name: 'หน้าต่าง' },
  { id: 'poster',  name: 'โปสเตอร์' },
  { id: 'ceiling', name: 'เพดาน' },
  { id: 'shelf',   name: 'ชั้น' },
  { id: 'desk',    name: 'บนโต๊ะ' },
  { id: 'pet',     name: 'บนพื้น' },
];

// ---------- สถานะห้อง ----------
// อยู่ใน state.settings เพื่อให้ติดรถไปกับ sync ก้อนเดิม ไม่ต้องมีท่อของตัวเอง
function roomState() {
  const r = (state && state.settings && state.settings.room) || {};
  return {
    name:   typeof r.name === 'string' ? r.name : '',
    status: typeof r.status === 'string' ? r.status : '',
    wall:   r.wall || 'cream',
    floor:  r.floor || 'wood',
    light:  r.light || 'warm',
    owned:  Array.isArray(r.owned) ? r.owned : [],
    on:     Object.assign({ window: 'day', poster: 'none', ceiling: 'none',
                            shelf: 'books', desk: 'laptop', pet: 'none' }, r.on || {}),
  };
}
function saveRoom(r) {
  if (!state.settings) state.settings = {};
  state.settings.room = r;
  save();
}

// ของฟรีถือว่ามีติดตัวมาแต่แรก ไม่ต้องไปเขียนลงรายการที่ซื้อ
function roomOwns(kind, id) {
  const it = roomFind(kind, id);
  if (!it) return false;
  if (!it.cost) return true;
  return roomState().owned.includes(kind + ':' + id);
}
function roomFind(kind, id) {
  if (kind === 'wall')  return ROOM_WALLS.find(w => w.id === id);
  if (kind === 'floor') return ROOM_FLOORS.find(f => f.id === id);
  if (kind === 'light') return ROOM_LIGHTS.find(l => l.id === id);
  return ROOM_ITEMS.find(i => i.slot === kind && i.id === id);
}
function roomOptions(kind) {
  if (kind === 'wall')  return ROOM_WALLS;
  if (kind === 'floor') return ROOM_FLOORS;
  if (kind === 'light') return ROOM_LIGHTS;
  return ROOM_ITEMS.filter(i => i.slot === kind);
}

// "ไฟยังเปิดอยู่" = กำลังจับเวลาทำงานอยู่จริง ๆ ตอนนี้
// นี่คือชิ้นเดียวในห้องที่ไม่ได้มาจากการกดเลือก มันมาจากชีวิตจริง
// และเป็นเหตุผลที่คนจะเข้ามาส่องห้องกันทุกวันโดยไม่ต้องมีใครโพสต์อะไรเลย
function roomLightsOn() {
  try { return typeof runningWork === 'function' && !!runningWork(); } catch (_) { return false; }
}

// ============================================================
// วาดห้อง — ฟังก์ชันบริสุทธิ์ รับสถานะเข้า คืนสตริง SVG ออก
// เขียนแบบนี้ตั้งใจ เพราะรอบหน้าหน้าสาธารณะต้องวาดห้องเดียวกันนี้
// จากข้อมูลที่ดึงมาจากเซิร์ฟเวอร์ โดยไม่มี state ของเครื่องนี้ให้พึ่ง
// ============================================================
function roomSceneSVG(r, opts) {
  const o = opts || {};
  const on = o.lit != null ? o.lit : roomLightsOn();
  const wall  = roomFind('wall',  r.wall)  || ROOM_WALLS[0];
  const floor = roomFind('floor', r.floor) || ROOM_FLOORS[0];
  const light = roomFind('light', r.light) || ROOM_LIGHTS[0];

  const part = slot => {
    const it = roomFind(slot, r.on[slot]);
    return it ? it.svg : '';
  };

  return `<svg class="rm-scene" viewBox="0 0 320 240" role="img"
    aria-label="ห้องที่แต่งไว้${esc(r.name ? ' — ' + r.name : '')}">
    <defs>
      <pattern id="rp-dots" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="8" cy="8" r="2" fill="#C9A9D8" opacity=".55"/></pattern>
      <pattern id="rp-stripe" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="7" height="14" fill="#D6CCB6" opacity=".5"/></pattern>
      <radialGradient id="rp-glow" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="${light.c}" stop-opacity=".55"/>
        <stop offset="1" stop-color="${light.c}" stop-opacity="0"/></radialGradient>
    </defs>

    <!-- ผนัง -->
    <rect x="0" y="0" width="320" height="170" fill="${wall.c}"/>
    ${wall.pat ? `<rect x="0" y="0" width="320" height="170" fill="url(#${wall.pat})"/>` : ''}

    <!-- หน้าต่าง: วิวข้างหลังก่อน แล้วค่อยตีกรอบทับ -->
    ${part('window')}
    <rect x="20" y="28" width="64" height="52" fill="none" stroke="#5A4436" stroke-width="4"/>
    <line x1="52" y1="28" x2="52" y2="80" stroke="#5A4436" stroke-width="3"/>
    <line x1="20" y1="54" x2="84" y2="54" stroke="#5A4436" stroke-width="3"/>
    <rect x="16" y="80" width="72" height="5" rx="1.5" fill="#6B5240"/>

    ${part('poster')}

    <!-- ชั้นวางของ -->
    <rect x="176" y="74" width="124" height="5" rx="1.5" fill="#8A6A4F"/>
    <rect x="180" y="79" width="5" height="7" fill="#6B5340"/>
    <rect x="291" y="79" width="5" height="7" fill="#6B5340"/>
    ${part('shelf')}

    ${part('ceiling')}

    <!-- พื้น -->
    <rect x="0" y="170" width="320" height="70" fill="${floor.c}"/>
    <g stroke="${floor.c2}" stroke-width="1.5">
      <line x1="0" y1="188" x2="320" y2="188"/>
      <line x1="0" y1="208" x2="320" y2="208"/>
      <line x1="0" y1="228" x2="320" y2="228"/>
    </g>
    <rect x="0" y="168" width="320" height="4" fill="#00000022"/>

    <!-- ของบนพื้น วาดก่อนโต๊ะ เพราะพรมอยู่ซ้ายและไม่ทับกัน -->
    ${part('pet')}

    <!-- โต๊ะ + โคมไฟ (โคมเป็นของประจำห้อง ไม่ใช่ของที่ซื้อ เพราะมันคือตัวบอกว่าไฟเปิดอยู่) -->
    ${part('desk')}
    <rect x="150" y="120" width="140" height="7" rx="2" fill="#8A6A4F"/>
    <rect x="156" y="127" width="7" height="43" fill="#6B5340"/>
    <rect x="277" y="127" width="7" height="43" fill="#6B5340"/>
    <path d="M262 120 L262 96 L250 88" fill="none" stroke="#C9B08A" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="262" cy="120" rx="11" ry="3.5" fill="#C9B08A"/>
    <path d="M238 82 L262 82 L256 94 L244 94 Z" fill="${on ? light.c : '#9A8E7A'}"/>
    ${on ? `<path d="M250 94 L286 170 L214 170 Z" fill="${light.c}" opacity=".20"/>
            <ellipse cx="250" cy="90" rx="34" ry="30" fill="url(#rp-glow)"/>` : ''}

    <!-- ม่านแสงคลุมทั้งห้อง: ปิดไฟแล้วห้องต้องมืดลงจริง ไม่ใช่แค่โคมดับ
         แต่ห้ามมืดจนห้องดูหม่น — คนที่ยังไม่เคยจับเวลาเลยจะเห็นสถานะนี้เป็นภาพแรก
         และภาพแรกที่ดูหม่นทำให้ไม่มีใครอยากแต่งต่อ · .26 มืดพอให้รู้ว่าต่างกัน
         โดยที่สีผนังที่เพิ่งเลือกมายังอ่านออกว่าเป็นสีอะไร -->
    ${on
      ? `<rect x="0" y="0" width="320" height="240" fill="${light.c}" opacity=".10"/>`
      : `<rect x="0" y="0" width="320" height="240" fill="#1B2340" opacity=".26"/>`}
  </svg>`;
}

// ============================================================
// จอ "ห้องของฉัน"
// ============================================================
let roomTab = 'wall';   // ช่องที่กำลังเลือกดูอยู่ — ไม่ต้องเก็บถาวร รีเซ็ตทุกครั้งที่เข้าใหม่ก็ได้

function renderRoom() {
  const box = document.getElementById('roomBody');
  if (!box) return;
  const r = roomState();
  const lit = roomLightsOn();
  const bal = typeof tokenBalance === 'function' ? tokenBalance() : 0;
  const who = (state.settings && state.settings.name) || 'นักเรียน';
  const title = r.name || ('ห้องของ' + who);

  const opts = roomOptions(roomTab);
  const cur = (roomTab === 'wall' || roomTab === 'floor' || roomTab === 'light')
    ? r[roomTab] : r.on[roomTab];

  box.innerHTML = `
    <div class="page-head">
      <div class="eyebrow mono">${esc(fmtThaiDate(new Date()))}</div>
      <h1 class="page-title">ห้องของฉัน</h1>
      <p class="page-sub">ที่ที่เป็นของเธอคนเดียว — แต่งยังไงก็ได้ แล้วเดี๋ยวเปิดให้เพื่อนเข้ามาดู</p>
    </div>

    <!-- ป้ายไฟกับป้ายหน้าห้องอยู่ใต้ฉาก ไม่ลอยทับ — ของที่วางไว้มุมล่างซ้ายของห้อง
         (พรม สัตว์เลี้ยง) นั่งอยู่ตรงนั้นพอดี ป้ายลอยทับแล้วบังของที่เพิ่งซื้อมา -->
    <div class="rm-stage">
      ${roomSceneSVG(r, { lit })}
      <div class="rm-plate">
        <span class="rm-lamp ${lit ? 'on' : ''}">
          <span class="rm-dot"></span>${lit ? 'ไฟยังเปิดอยู่' : 'ไฟปิดอยู่'}
        </span>
        ${r.status ? `<span class="rm-say">${esc(r.status)}</span>` : ''}
      </div>
    </div>

    <div class="rm-id">
      <label class="rm-fld">
        <span>ชื่อห้อง</span>
        <input id="rmName" type="text" maxlength="28" placeholder="${esc('ห้องของ' + who)}"
               value="${esc(r.name)}" onchange="roomSetText('name', this.value)">
      </label>
      <label class="rm-fld">
        <span>ป้ายหน้าห้อง</span>
        <input id="rmStatus" type="text" maxlength="60" placeholder="เขียนอะไรก็ได้ที่อยากให้คนอ่าน"
               value="${esc(r.status)}" onchange="roomSetText('status', this.value)">
      </label>
    </div>

    <div class="rm-bar">
      <span class="rm-ttl">${esc(title)}</span>
      <span class="rm-bal">${icon('bag')}${fmtTok(bal)} โทเคน</span>
    </div>

    <div class="rm-tabs" role="tablist">
      ${ROOM_SLOTS.map(s => `<button role="tab" class="rm-tab${s.id === roomTab ? ' on' : ''}"
        aria-selected="${s.id === roomTab}" onclick="roomGo('${s.id}')">${esc(s.name)}</button>`).join('')}
    </div>

    <div class="rm-grid">
      ${opts.map(it => {
        const owned = roomOwns(roomTab, it.id);
        const active = it.id === cur;
        const sw = (roomTab === 'wall' || roomTab === 'floor' || roomTab === 'light')
          ? `<span class="rm-sw" style="background:${it.c}"></span>`
          : `<span class="rm-mini">${roomThumb(roomTab, it)}</span>`;
        return `<button class="rm-opt${active ? ' on' : ''}${owned ? '' : ' locked'}"
          onclick="roomPick('${roomTab}','${it.id}')"
          aria-label="${esc(it.name)}${owned ? '' : ' — ' + it.cost + ' โทเคน'}">
          ${sw}
          <span class="rm-nm">${esc(it.name)}</span>
          ${owned ? (active ? '<span class="rm-on">ใช้อยู่</span>' : '')
                  : `<span class="rm-cost">${it.cost}</span>`}
        </button>`;
      }).join('')}
    </div>

    <p class="rm-note">ของที่ซื้อแล้วอยู่กับเธอตลอด เปลี่ยนสลับไปมาได้ไม่เสียโทเคนเพิ่ม ·
      โทเคนได้จากการเช็คอินทุกวันและกล่องสุ่ม</p>`;
}

// รูปย่อในปุ่มเลือก — วาดฉากจริงย่อส่วนแล้วครอปเฉพาะช่องนั้น
// ทำแบบนี้เพื่อไม่ต้องวาดไอคอนชุดที่สองให้ของทุกชิ้น (และไม่ต้องมาไล่แก้สองที่ตอนของเปลี่ยน)
const ROOM_CROP = {
  window:  '10 20 84 72',
  poster:  '100 20 62 70',
  shelf:   '176 44 128 40',
  desk:    '156 86 62 40',
  ceiling: '0 0 320 44',
  pet:     '4 176 112 44',
};
function roomThumb(slot, it) {
  if (!it.svg) return '<i class="rm-none">—</i>';
  const box = ROOM_CROP[slot] || '0 0 320 240';
  return `<svg viewBox="${box}" aria-hidden="true">${it.svg}</svg>`;
}

function roomGo(slot) {
  roomTab = slot;
  renderRoom();
}

function roomSetText(key, v) {
  const r = roomState();
  r[key] = String(v || '').slice(0, key === 'name' ? 28 : 60).trim();
  saveRoom(r);
  renderRoom();
}

// กดของชิ้นหนึ่ง = ใส่เลยถ้ามีอยู่แล้ว · ถ้ายังไม่มีก็ถามซื้อก่อน
// ไม่แยกเป็นสองปุ่ม เพราะปุ่มเดียวที่ทำสิ่งที่ควรทำในสถานการณ์นั้นอ่านง่ายกว่า
function roomPick(kind, id) {
  const it = roomFind(kind, id);
  if (!it) return;
  if (!roomOwns(kind, id)) return roomBuy(kind, id);
  const r = roomState();
  if (kind === 'wall' || kind === 'floor' || kind === 'light') r[kind] = id;
  else r.on[kind] = id;
  saveRoom(r);
  haptic('arm');
  renderRoom();
}

function roomBuy(kind, id) {
  const it = roomFind(kind, id);
  if (!it || !it.cost) return;
  const s = tokenState();
  if ((s.bal || 0) < it.cost) {
    haptic('snooze');
    showToast({ title: 'โทเคนไม่พอ',
      body: esc(it.name) + ' ราคา ' + it.cost + ' โทเคน — ยังขาดอีก ' + fmtTok(it.cost - (s.bal || 0)) });
    return;
  }
  s.bal = Math.round((s.bal - it.cost) * 10) / 10;
  saveTokenState(s);

  const r = roomState();
  r.owned = r.owned.concat(kind + ':' + id);
  if (kind === 'wall' || kind === 'floor' || kind === 'light') r[kind] = id;
  else r.on[kind] = id;
  saveRoom(r);

  haptic('done');
  if (typeof splashBurst === 'function') splashBurst(12, 'egg-star');
  showToast({ title: 'ได้ ' + it.name + ' มาแล้ว', body: 'วางไว้ในห้องให้เรียบร้อยแล้ว · เหลือ ' + fmtTok(s.bal) + ' โทเคน' });
  renderRoom();
}
