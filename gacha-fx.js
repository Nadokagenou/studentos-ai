// ============================================================
// สุ่มสกิน · หน้าการ์ด + เอฟเฟกต์โชว์แบบในเกม
// ------------------------------------------------------------
// เจ้าของ (7 ต.ค. 2569): "อยากปรับระบบสุ่มให้มันมีหน้าการ์ดด้วยและมีเอฟเฟคโชว์เหมือนในเกม
// ลองไปหาดูใน google มีเยอะ ขอดี ๆ นะครับ"
//
// ของที่หยิบมาจากเกมจริง (และเหตุผล):
//   • ดาวตกก่อนเปิด (Genshin Impact) — สีของดาวบอกของที่ดีที่สุดในรอบ *ก่อน* จะรู้ว่าได้อะไร
//     ช่วงสั้น ๆ ที่ "รู้ระดับแต่ยังไม่รู้ของ" คือหัวใจของจังหวะนี้
//   • หลังการ์ดเรืองสีตามระดับ (Hearthstone · Arknights: Endfield) — ใบไหนน่าเปิดเห็นก่อนพลิก
//   • กรอบการ์ดหรูขึ้นตามระดับ (Fate/Grand Order) — Common เรียบ · Rare ลายมุม · Legendary ทอง ·
//     Mythic กรอบรุ้งหมุน
//   • ฟอยล์โฮโลแกรม (การ์ดโปเกมอน · poke-holo) — แสงรุ้งวิ่งตามนิ้ว/เมาส์ที่ลากบนการ์ด
//   • ของหายากได้จอโชว์เต็มจอ — รัศมีหมุนสีตามระดับ การ์ดใหญ่กลางจอ
//
// กติกาที่ไม่เปลี่ยน: ผลล็อกตั้งแต่กดสุ่ม · ของเข้ากระเป๋าตอนหงาย (app.js) · ข้ามได้ทุกจังหวะ (แตะจอ)
// ลดการเคลื่อนไหว = ไม่มีดาวตก/จอโชว์ (การ์ดยังพลิกเหมือนเดิม)
// เสียงใช้ตัวสังเคราะห์ของ hoop.js (HSFX) และปุ่มปิดเสียงตัวเดียวกัน
// ============================================================

const GC_STARS = { common: 1, rare: 3, legendary: 5, secret: 5, mythic: 6 };
const GC_LABEL = { common: 'COMMON', rare: 'RARE', legendary: 'LEGENDARY', secret: '???', mythic: 'MYTHIC 3D' };

function gcBest(results) {
  return results.reduce((a, b) => (RANK[b.rarity] || 0) > (RANK[a.rarity] || 0) ? b : a, results[0]);
}
function gcReduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

// ---------- เสียง ----------
// ใช้ได้ก็ต่อเมื่อ hoop.js โหลดแล้ว และผู้ใช้ไม่ได้ปิดเสียงไว้
const GCS = {
  ok() { return typeof HSFX === 'object' && typeof hoopSoundOn === 'function' && hoopSoundOn(); },
  meteor(best) {
    if (!this.ok()) return;
    HSFX.noise('bandpass', 3200, 500, 1.4, 0.22, 0.25, 0.9);
    HSFX.tone('sine', 1760, 880, 0.05, 0.2, 0.8);
    if (RANK[best] >= 2) for (let i = 0; i < 8; i++) HSFX.tone('sine', 2000 + i * 260, 2000 + i * 260, 0.04, 0.005, 0.25, 0.35 + i * 0.06);
  },
  land(best) {
    if (!this.ok()) return;
    HSFX.noise('lowpass', 1800, 200, 0.8, 0.3, 0.004, 0.5);
    HSFX.tone('sine', 110, 55, 0.3, 0.004, 0.6);
    if (best === 'mythic') this.choir(0.1);
  },
  flip(r) {
    if (!this.ok()) return;
    const rk = RANK[r.rarity] || 0;
    HSFX.noise('bandpass', 1800, 900, 1.5, 0.14, 0.004, 0.12);       // "ฟึ่บ" ตอนพลิก
    if (rk === 0) { HSFX.tone('triangle', 660, 660, 0.12, 0.004, 0.25); return; }
    const chords = { 1: [659, 988], 2: [523, 659, 784, 1047, 1319], 3: [466, 554, 698, 932], 4: [523, 659, 784, 1047, 1319, 1568] };
    (chords[rk] || chords[1]).forEach((f, i) => {
      HSFX.tone('triangle', f, f, 0.13, 0.006, 0.6, 0.08 + i * 0.07);
      HSFX.tone('sine', f * 2, f * 2, 0.035, 0.006, 0.35, 0.08 + i * 0.07);
    });
    if (rk >= 2) HSFX.noise('highpass', 6000, 4000, 0.7, 0.08, 0.2, 0.8, 0.2);   // ประกาย "ชิ้ง ๆ"
    if (r.rarity === 'secret') for (let i = 0; i < 6; i++) HSFX.tone('square', 200 + Math.random() * 900, 120, 0.04, 0.002, 0.04, i * 0.05);
  },
  // เสียงคอรัสแผ่ว ๆ ของ Mythic — ฟันเลื่อยหลายตัวเพี้ยนกันนิด ผ่านกรองต่ำ
  choir(delay = 0) {
    [261.6, 329.6, 392, 523.2].forEach(f => [0.996, 1.004].forEach(k =>
      HSFX.tone('sawtooth', f * k, f * k, 0.05, 0.35, 1.6, delay, 1400)));
  },
};

// ---------- 1) ดาวตกก่อนเปิด ----------
// เต็มจอ (ลูกของ .phone) · แตะเพื่อข้าม · คืน Promise ตอนจบ
function gcIntro(results) {
  return new Promise(resolve => {
    const phone = document.querySelector('.phone');
    if (!phone || gcReduced() || !results.length) return resolve();
    const best = gcBest(results).rarity;
    const rk = RANK[best] || 0;
    const ov = document.createElement('div');
    ov.className = 'gc-intro b-' + best;
    ov.innerHTML = `<i class="gci-sky"></i><i class="gci-stars"></i>
      <i class="gci-met"><b></b></i>${rk >= 2 ? '<i class="gci-met m2"><b></b></i>' : ''}
      <i class="gci-land"></i><i class="gci-flash"></i>
      <span class="gci-skip">แตะเพื่อข้าม</span>`;
    // ดาวพุ่งจากมุมขวาบนนอกจอ มาตกกลางจอ (ตรงที่วงการ์ดจะโผล่) · หางชี้ย้อนทางที่มา
    const b = phone.getBoundingClientRect();
    const x0 = b.width + 60, y0 = -60, x1 = b.width * 0.5, y1 = b.height * 0.42;
    const rot = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI - 180;
    ov.style.cssText = `--x0:${x0}px;--y0:${y0}px;--x1:${x1}px;--y1:${y1}px;--rot:${rot.toFixed(1)}deg;--dur:${rk === 0 ? 0.6 : rk === 1 ? 0.9 : 1.6}s`;
    phone.appendChild(ov);
    GCS.meteor(best);
    let done = false;
    const end = () => {
      if (done) return; done = true;
      ov.classList.add('out');
      setTimeout(() => ov.remove(), 260);
      resolve();
    };
    ov.addEventListener('pointerdown', end);
    // ยาวขึ้นตามระดับ — ของธรรมดาไม่ต้องรอนาน ของหายากได้พิธีเต็ม
    const dur = rk === 0 ? 1100 : rk === 1 ? 1500 : 2300;
    setTimeout(() => { if (!done) { ov.classList.add('landed'); GCS.land(best); } }, dur - 520);
    setTimeout(end, dur);
  });
}

// ---------- 2) หน้าการ์ด ----------
function gcArt(r) {
  if (r.kind === 'token') {
    return `<span class="gcf-art a-tok"><i class="gcf-rays"></i>${coin(54)}</span>`;
  }
  if (r.kind === 'fx3d') {
    const ic = typeof fxIcon === 'function' ? fxIcon(r.fx) : '';
    return `<span class="gcf-art a-3d"><i class="gcf-grid"></i><span class="gcf-ico">${ic}</span><span class="gcf-3d">3D</span></span>`;
  }
  return `<span class="gcf-art a-skin"><i class="gcf-sw sw-${esc(r.theme || r.id)}"></i><i class="gcf-ph"></i></span>`;
}
function gcType(r) {
  if (r.kind === 'token') return 'เข้ากระเป๋าแล้ว';
  if (r.duplicate) return 'ซ้ำ · คืน ' + fmtTok(r.amount) + ' โทเคน';
  if (r.kind === 'fx3d') return r.locked ? '🔒 ซื้อเอฟเฟกต์ปกติก่อน' : 'เอฟเฟกต์ 3D · ใช้ได้เลย';
  return 'ธีมใหม่';
}
// r ต้องผ่าน grantPrize แล้ว (รู้ duplicate/amount/locked)
function gcCardFace(r) {
  const holo = (RANK[r.rarity] || 0) >= 2;
  const isNew = r.kind !== 'token' && !r.duplicate;
  const nm = r.kind === 'token' ? '+' + fmtTok(r.amount) + ' โทเคน' : r.kind === 'fx3d' ? FX3D_NAME[r.fx] : r.label;
  return `<span class="gcf gcf-${r.rarity}${r.kind === 'fx3d' ? ' k-3d' : ''}">
    <span class="gcf-frame"></span>
    <span class="gcf-top"><b>${GC_LABEL[r.rarity]}</b><i>${'★'.repeat(GC_STARS[r.rarity] || 1)}</i></span>
    ${gcArt(r)}
    <span class="gcf-nm">${esc(nm)}</span>
    <span class="gcf-ty">${esc(gcType(r))}</span>
    ${isNew ? '<span class="gcf-new">NEW</span>' : ''}
    ${holo ? '<span class="gcf-holo"></span><span class="gcf-glare"></span>' : ''}
  </span>`;
}

// ฟอยล์ตามนิ้ว — ตำแหน่งนิ้วบนการ์ด (0–100%) ส่งเป็นตัวแปร CSS ให้แถบรุ้ง/แสงสะท้อนเลื่อนตาม
function gcHoloBind(host) {
  if (!host || host.__holo) return;
  host.__holo = true;
  const set = e => {
    const f = host.querySelector('.gcf');
    if (!f) return;
    const b = f.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
    const y = Math.max(0, Math.min(1, (e.clientY - b.top) / b.height));
    f.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    f.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    f.classList.add('touch');
  };
  host.addEventListener('pointermove', set);
  host.addEventListener('pointerdown', set);
  host.addEventListener('pointerleave', () => { const f = host.querySelector('.gcf'); if (f) f.classList.remove('touch'); });
}

// ---------- 3) ตอนพลิก ----------
function gcFlipFx(r, el) {
  GCS.flip(r);
  gcHoloBind(el);
  if ((RANK[r.rarity] || 0) >= 2 && !gcReduced()) setTimeout(() => gcReveal(r), 640);
}

// ---------- 4) จอโชว์ของหายาก ----------
// เป็นคิว — "หงายที่เหลือทั้งหมด" อาจพลิกได้ Legendary กับ Mythic ในรอบเดียว
// รุ่นแรกใบหลังลบจอของใบก่อนทิ้ง = ของที่หายากที่สุดอาจไม่เคยได้โชว์เลย
const gcQueue = [];
function gcReveal(r) {
  gcQueue.push(r);
  if (gcQueue.length === 1) gcRevealShow(r);
  else gcGoLabel();
}
// ปุ่มบอกว่ายังเหลือของดีรอโชว์อีกกี่ใบ — คิวโตขึ้นได้ระหว่างที่จอแรกเปิดอยู่
function gcGoLabel() {
  const b = document.querySelector('.phone > .gc-rv:not(.out) .gcr-go');
  if (b) b.textContent = gcQueue.length > 1 ? 'ไปต่อ (อีก ' + (gcQueue.length - 1) + ')' : 'ไปต่อ';
}
function gcRevealNext() {
  gcQueue.shift();
  if (gcQueue.length) setTimeout(() => gcRevealShow(gcQueue[0]), 180);
}
function gcRevealShow(r) {
  const phone = document.querySelector('.phone');
  if (!phone) { gcQueue.length = 0; return; }
  const ov = document.createElement('div');
  ov.className = 'gc-rv b-' + r.rarity;
  let note = '';
  if (r.kind === 'fx3d') {
    note = r.duplicate ? 'มีอยู่แล้ว คืนให้ ' + fmtTok(r.amount) + ' โทเคน'
      : r.locked ? 'ซื้อเอฟเฟกต์ "' + FX3D_NAME[r.fx] + '" ในร้านค้า (10 โทเคน) แล้ว 3D ใช้ได้ทันที'
      : 'สลับเป็น 3D ได้ที่ ตั้งค่า › ธีมสี';
  } else if (r.kind === 'skin') {
    note = r.duplicate ? 'มีอยู่แล้ว คืนให้ ' + fmtTok(r.amount) + ' โทเคน' : 'เลือกใช้ได้ที่ ตั้งค่า › ธีมสี';
  }
  ov.innerHTML = `<i class="gcr-bg"></i><i class="gcr-rays"></i><i class="gcr-rays r2"></i><i class="gcr-ring"></i>
    <div class="gcr-hd">${r.kind === 'fx3d' ? 'MYTHIC · เอฟเฟกต์ 3D' : GC_LABEL[r.rarity]}</div>
    <div class="gcr-card"><span class="gcr-face">${gcCardFace(r)}</span></div>
    <div class="gcr-note">${esc(note)}</div>
    <button type="button" class="gcr-go">ไปต่อ</button>`;
  phone.appendChild(ov);
  gcHoloBind(ov.querySelector('.gcr-card'));
  if (r.rarity === 'mythic') GCS.choir(0.15);
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    s.className = 'gcr-spk';
    const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 160;
    s.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
    s.style.setProperty('--dy', (Math.sin(a) * d).toFixed(0) + 'px');
    s.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
    ov.appendChild(s);
  }
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    ov.classList.add('out');
    setTimeout(() => { ov.remove(); gcRevealNext(); }, 260);
  };
  gcGoLabel();
  ov.addEventListener('click', e => { if (!e.target.closest('.gcr-card')) close(); });
  ov.querySelector('.gcr-go').addEventListener('click', close);
}
