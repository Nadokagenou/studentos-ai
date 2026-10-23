// กันฉากพื้นหลังของธีม (.fx) กลับไปกินเธรดหลัก — ต้นเหตุที่มือถือสเปคต่ำค้างแล้วกดอะไรไม่ได้ (16 ต.ค. 69)
// ------------------------------------------------------------
// ฉากเคลื่อนไหวตลอดเวลาที่แอปเปิดอยู่ · ถ้าขยับคุณสมบัติที่การ์ดจอทำแทนไม่ได้ (background-position · margin · drop-shadow …)
// เบราว์เซอร์ต้องคิดสไตล์ จัดผัง วาดใหม่บนเธรดหลักทุกเฟรม — เธรดเดียวกับที่รับการแตะ
// วัดจริง (CPU ช้า 6 เท่า · วางเครื่องนิ่ง): ธีมทะเลเธรดหลักไม่ว่าง 68% · หลังแก้ 17% · ธีมไม่มีฉาก 7–10%
//
// ใช้:  node alt/devtools/scene-check.cjs [ไฟล์ css ...]     (ไม่ใส่ = alt/alt.css กับ style.css ที่ราก)
//
// กฎ: ① ทุก @keyframes ที่ชั้นฉากเรียกใช้ ขยับได้เฉพาะ transform · translate · rotate · scale · opacity
//        และ filter ที่ไม่ขยับพิกเซล (brightness · contrast · saturate · grayscale · hue-rotate · invert · sepia · opacity)
//     ② ชิ้นเดียวกันห้ามมีสองอนิเมชันที่ขยับ transform พร้อมกัน — Chrome ส่งให้การ์ดจอไม่ได้ทั้งคู่ (TargetHasIncompatibleAnimations)
//        แยกเป็น rotate / scale / translate คนละตัวได้
// ไม่นับ: ช่วงอีเวนต์สั้น ๆ ([data-gevent] 20 วิ · [data-gfx] จอสั่น ~0.4 วิ) · กฎใน @media (prefers-reduced-motion) (มีแต่ animation: none)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : [path.join(root, 'alt', 'alt.css'), path.join(root, 'style.css'), ...['theme-main.css','biome-themes.css','theme-moonlight.css'].map(name=>path.join(root,'alt','halloween','rewards',name))];

// ยกเว้นทีละชื่อ ต้องมีตัวเลขที่วัดได้กำกับ — ไม่ใช่ที่ทิ้งของที่ขี้เกียจแก้
const EXEMPT = {
  // Astral: แสงวิ่งตามเส้นคลื่น ผ่านหน้ากากรูปเส้น — ย้ายไป translate ต้องแยกหน้ากากออกจากแสง (รื้อโครงชั้นหน้า)
  // วัด CPU ช้า 6 เท่า วางนิ่ง: เปิด 9% / 8% · หยุด 8% / 7% (ต่างราว 1 จุด) จึงยังไม่คุ้มรื้อ
  'as-shimmer': 'วัดแล้วกินราว 1 จุด (16 ต.ค. 69)',
};

const OK_PROPS = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity', 'animation-timing-function', 'offset']);
const OK_FILTER = new Set(['brightness', 'contrast', 'saturate', 'grayscale', 'hue-rotate', 'invert', 'sepia', 'opacity', 'none']);

function strip(css) { return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')); }

// อ่านไฟล์เป็นรายการกฎแบน ๆ: { sel, body, at, line } · @keyframes แยกเก็บ { name → [body ทุกเฟรม] }
function parse(css, file) {
  const rules = [], keyframes = {};
  const lineOf = i => css.slice(0, i).split('\n').length;
  function walk(start, end, at) {
    let i = start;
    while (i < end) {
      const open = css.indexOf('{', i);
      if (open < 0 || open >= end) break;
      const head = css.slice(i, open).trim();
      let d = 1, j = open + 1;
      while (d && j < end) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
      const inner = [open + 1, j - 1];
      if (/^@keyframes\s+/i.test(head)) {
        const name = head.replace(/^@keyframes\s+/i, '').trim();
        const frames = []; const fre = /\{([^{}]*)\}/g; const body = css.slice(inner[0], inner[1]); let m;
        while ((m = fre.exec(body))) frames.push(m[1]);
        (keyframes[name] = keyframes[name] || []).push({ frames, file, line: lineOf(open) });
      } else if (/^@(media|supports|layer|container)/i.test(head)) {
        walk(inner[0], inner[1], at.concat(head));
      } else if (head && !head.startsWith('@')) {
        rules.push({ sel: head.replace(/\s+/g, ' '), body: css.slice(inner[0], inner[1]), at, file, line: lineOf(open) });
      }
      i = j;
    }
  }
  walk(0, css.length, []);
  return { rules, keyframes };
}

const all = { rules: [], keyframes: {} };
for (const f of files) {
  const p = parse(strip(fs.readFileSync(f, 'utf8')), path.relative(root, f));
  all.rules.push(...p.rules);
  for (const [k, v] of Object.entries(p.keyframes)) (all.keyframes[k] = all.keyframes[k] || []).push(...v);
}

// ชั้นฉาก = .fx เอง หรือชิ้นในนั้น (.fx-a … .fx-h · .fx-shoot) หรือชั้นดาวของธีมอวกาศ · ไม่ใช่ .fx-in (คลาสตอนเข้าจอ)
const SCENE = /\.fx(?=[\s,:.\[>*]|$)|\.fx-(?:[a-h]|shoot)\b|\.starfield\b|\.hw-(?:scene|night|haze|mist|spark|ghost|bats|candle|card-smoke|card-ghost|graveyard|wanderer|ground-fog|biome-view|biome-fog|biome-glints)\b/;
const EVENT_ONLY = /\[data-gevent|\[data-gfx/;
const sceneRules = all.rules.filter(r =>
  !r.at.some(a => /prefers-reduced-motion/.test(a)) &&
  r.sel.split(',').some(part => SCENE.test(part) && !EVENT_ONLY.test(part)));

function animNames(body) {
  const names = [];
  const decl = body.match(/(?:^|;)\s*animation(?:-name)?\s*:([^;]*)/g) || [];
  for (const d of decl) {
    const v = d.replace(/^[;\s]*animation(?:-name)?\s*:/, '');
    for (const layer of v.split(',')) {
      const tok = layer.trim().split(/\s+/).find(t => all.keyframes[t]);
      names.push(tok || null);
    }
  }
  return names.filter(Boolean);
}
function animatedProps(name) {
  const props = new Map();   // prop → [ค่า]
  for (const kf of all.keyframes[name] || []) for (const fr of kf.frames) {
    for (const d of fr.split(';')) {
      const m = d.match(/^\s*([\w-]+)\s*:\s*(.*)$/s); if (!m) continue;
      const p = m[1].toLowerCase(); (props.get(p) || props.set(p, []).get(p)).push(m[2].trim());
    }
  }
  return props;
}
function badProps(name) {
  const bad = [];
  for (const [p, vals] of animatedProps(name)) {
    if (OK_PROPS.has(p)) continue;
    if (p === 'filter' || p === '-webkit-filter') {
      // ชื่อฟังก์ชันชั้นนอกสุดเท่านั้น — rgba(…) ที่อยู่ในวงเล็บของ drop-shadow ไม่ใช่ฟิลเตอร์
      const fns = vals.flatMap(v => {
        const out = []; let d = 0, w = '';
        for (const c of v) {
          if (c === '(') { if (!d && w) out.push(w); d++; w = ''; }
          else if (c === ')') d--;
          else if (!d) w = /[a-z-]/i.test(c) ? w + c : '';
        }
        return out.length ? out : [v.trim()];
      });
      const moving = fns.filter(fn => !OK_FILTER.has(fn));
      if (moving.length) bad.push(`filter(${[...new Set(moving)].join(',')})`);
      continue;
    }
    bad.push(p);
  }
  return bad;
}

// ① คุณสมบัติที่การ์ดจอทำแทนไม่ได้
const offenders = new Map();
for (const r of sceneRules) for (const n of animNames(r.body)) {
  if (EXEMPT[n]) continue;
  const bad = badProps(n);
  if (!bad.length) continue;
  const k = `${n} [${bad.join(', ')}]`;
  if (!offenders.has(k)) offenders.set(k, `${r.file}:${r.line}  ${r.sel.slice(-70)}`);
}
// ตรวจครบทุกข้อก่อนแล้วค่อยฟ้องรวม — ข้อแรกพังต้องไม่บังข้อถัดไป
const failures = [];
if (offenders.size) failures.push('ฉากพื้นหลังขยับคุณสมบัติที่ต้องวาดใหม่บนเธรดหลักทุกเฟรม (ย้ายไป translate / rotate / scale / opacity):\n' +
  [...offenders].map(([k, at]) => `  ✗ ${k}\n      ใช้ที่ ${at}`).join('\n'));
else console.log(`PASS ฉากพื้นหลัง ${sceneRules.length} กฎ ขยับเฉพาะคุณสมบัติที่การ์ดจอทำเองได้`);

// ② สองอนิเมชันแย่ง transform บนชิ้นเดียวกัน
const clashes = [];
for (const r of sceneRules) {
  const names = animNames(r.body);
  const onTransform = names.filter(n => animatedProps(n).has('transform'));
  if (onTransform.length > 1) clashes.push(`  ✗ ${onTransform.join(' + ')}  ใช้ที่ ${r.file}:${r.line}  ${r.sel.slice(-70)}`);
}
if (clashes.length) failures.push('ชิ้นเดียวกันมีหลายอนิเมชันขยับ transform พร้อมกัน — การ์ดจอรับไม่ได้ทั้งหมด (แยกเป็น rotate / scale / translate):\n' + clashes.join('\n'));
else console.log('PASS ไม่มีชิ้นไหนในฉากที่สองอนิเมชันแย่ง transform กัน');

assert.equal(failures.length, 0, '\n' + failures.join('\n\n'));
