// ============================================================
// เติมโทเคน — ตรรกะล้วนที่ใช้ร่วมกันระหว่าง token-checkout กับ token-webhook
// ------------------------------------------------------------
// เป็น .mjs ไม่ใช่ .ts โดยตั้งใจ: Deno import ได้ตรง ๆ และ node --test import ได้โดยไม่ต้อง bundle
// (ดู token-webhook/__tests__/topup.test.mjs) · ไม่มีการเรียกเครือข่ายในไฟล์นี้เลย
//
// ราคาอยู่ที่นี่ที่เดียว — แอปมีสำเนาไว้วาดแผ่นเติมโทเคน (TOPUP_PACKS ใน app.js)
// แต่เซิร์ฟเวอร์ไม่เชื่อตัวเลขจากแอป: แอปส่งมาแค่รหัสแพ็ก ราคาและจำนวนโทเคนอ่านจากตารางนี้
// และ webhook ตรวจยอดที่จ่ายจริงกับตารางนี้อีกรอบก่อนเติม
//
// เจ้าของตั้งราคาเอง (30 ต.ค. 69): "100 โทเค้น 19 บาทพอ แล้วก็ทำเรื่อยๆ ไม่เอา 1:1"
// แพ็กที่ใหญ่ขึ้นได้โทเคนต่อบาทมากขึ้น (5.3 → 5.7 → 6.1 → 6.4 ต่อบาท)
// ============================================================

export const PACKS = Object.freeze([
  Object.freeze({ id: 'p19', tokens: 100, satang: 1900 }),
  Object.freeze({ id: 'p49', tokens: 280, satang: 4900 }),
  Object.freeze({ id: 'p99', tokens: 600, satang: 9900 }),
  Object.freeze({ id: 'p249', tokens: 1600, satang: 24900 }),
]);
export const CURRENCY = 'thb';

export const packOf = id => PACKS.find(p => p.id === id) || null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_RETURN = 'https://nadokagenou.github.io/studentos-ai/';

// หน้าที่ผู้ให้บริการส่งผู้ใช้กลับมาหลังจ่าย — รับเฉพาะเว็บของเรากับเครื่องพัฒนา
// ไม่งั้นใครก็สร้างลิงก์จ่ายเงินที่จ่ายจบแล้วพาไปหน้าปลอมได้
export function returnBase(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch { return DEFAULT_RETURN; }
  const local = u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname);
  const live = u.protocol === 'https:' && u.hostname === 'nadokagenou.github.io'
    && /^\/studentos-ai(\/|$)/.test(u.pathname);
  if (!local && !live) return DEFAULT_RETURN;
  if (!/^\/[A-Za-z0-9._\/-]*$/.test(u.pathname)) return DEFAULT_RETURN;
  return u.origin + u.pathname.replace(/[^/]*$/, '');
}

// โหมดของกุญแจ — ถ้าไม่ได้เปิด live ไว้ชัด ๆ ต้องเป็นกุญแจทดสอบเท่านั้น
export function keyMode(secret) {
  const s = String(secret || '');
  if (/^(sk|rk)_test_/.test(s)) return 'test';
  if (/^(sk|rk)_live_/.test(s)) return 'live';
  return null;
}

// ฟอร์มที่ส่งไป POST /v1/checkout/sessions ของ Stripe
// ไม่ระบุ payment_method_types — ให้ Stripe โชว์วิธีจ่ายตามที่เปิดไว้ในแดชบอร์ด (พร้อมเพย์ · บัตร)
export function checkoutForm(pack, uid, back) {
  if (!pack || !UUID.test(uid || '')) throw Error('bad input');
  const f = new URLSearchParams();
  f.set('mode', 'payment');
  f.set('client_reference_id', uid);
  f.set('metadata[uid]', uid);
  f.set('metadata[pack]', pack.id);
  f.set('line_items[0][quantity]', '1');
  f.set('line_items[0][price_data][currency]', CURRENCY);
  f.set('line_items[0][price_data][unit_amount]', String(pack.satang));
  f.set('line_items[0][price_data][product_data][name]', pack.tokens + ' โทเคน · Student OS');
  f.set('success_url', back + '?topup=done');
  f.set('cancel_url', back + '?topup=cancel');
  return f;
}

const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ตรวจหัว Stripe-Signature: "t=<วินาที>,v1=<hmac>,v1=..." · HMAC-SHA256 ของ "<t>.<body ดิบ>"
// ห่างจากเวลาปัจจุบันเกิน tolerance วินาที = ปฏิเสธ (กันเอาคำขอเก่าที่ดักได้มายิงซ้ำ)
export async function verifySignature(payload, header, secret, nowSec, tolerance = 300) {
  if (!secret || !header) return false;
  let t = null; const sigs = [];
  for (const part of String(header).split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 't' && /^\d{1,12}$/.test(v)) t = Number(v);
    else if (k === 'v1' && /^[0-9a-f]{64}$/.test(v)) sigs.push(v);
  }
  if (t === null || !sigs.length || Math.abs(nowSec - t) > tolerance) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(t + '.' + payload)));
  return sigs.some(s => same(s, mac));
}

// เหตุการณ์จาก webhook → ใบเสร็จหนึ่งแถว หรือ { skip: เหตุผล }
// พร้อมเพย์เป็นการจ่ายแบบรอผล: completed มาก่อนด้วย payment_status 'unpaid'
// แล้ว async_payment_succeeded ตามมาตอนเงินเข้าจริง — เติมเฉพาะตอน paid เท่านั้น
export function purchaseFromEvent(event) {
  const type = event && event.type;
  if (type !== 'checkout.session.completed' && type !== 'checkout.session.async_payment_succeeded') {
    return { skip: 'ignored ' + type };
  }
  const s = event.data && event.data.object;
  if (!s || typeof s.id !== 'string') return { skip: 'no session' };
  if (s.mode !== 'payment') return { skip: 'not a payment' };
  if (s.payment_status !== 'paid') return { skip: 'not paid yet' };
  const uid = s.client_reference_id;
  if (!UUID.test(uid || '') || (s.metadata && s.metadata.uid !== uid)) return { skip: 'bad owner' };
  const pack = packOf(s.metadata && s.metadata.pack);
  if (!pack) return { skip: 'unknown pack' };
  // ยอดที่จ่ายจริงต้องตรงกับราคาในตารางพอดี — กันแพ็กที่ราคาเปลี่ยนระหว่างทางหรือ session ที่ถูกแต่ง
  if (s.currency !== CURRENCY || s.amount_total !== pack.satang) return { skip: 'amount mismatch' };
  return {
    row: {
      id: s.id, target: uid, pack: pack.id, tokens: pack.tokens,
      amount_satang: s.amount_total, currency: s.currency, provider: 'stripe', livemode: event.livemode === true,
    },
  };
}
