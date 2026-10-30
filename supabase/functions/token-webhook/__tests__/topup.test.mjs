// รัน: node --test supabase/functions/token-webhook/__tests__/topup.test.mjs
// ตรรกะล้วนของการเติมโทเคน (_shared/topup.mjs) — ไม่แตะเครือข่ายหรือ Stripe จริง
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS, packOf, returnBase, keyMode, checkoutForm, verifySignature, purchaseFromEvent, DEFAULT_RETURN }
  from '../../_shared/topup.mjs';

const UID = '11111111-2222-4333-8444-555555555555';
const SECRET = 'whsec_test_123';
const sign = (body, t, secret = SECRET) =>
  `t=${t},v1=${createHmac('sha256', secret).update(t + '.' + body).digest('hex')}`;
const session = over => ({
  id: 'cs_test_abcdef12', mode: 'payment', payment_status: 'paid', client_reference_id: UID,
  metadata: { uid: UID, pack: 'p19' }, currency: 'thb', amount_total: 1900, ...over,
});
const ev = (s, type = 'checkout.session.completed', livemode = false) => ({ type, livemode, data: { object: s } });

test('ราคาที่เจ้าของตั้ง: 100 โทเคน ฿19 และแพ็กใหญ่ได้ต่อบาทมากขึ้นเรื่อย ๆ', () => {
  assert.deepEqual(packOf('p19'), { id: 'p19', tokens: 100, satang: 1900 });
  for (let i = 1; i < PACKS.length; i++) {
    assert.ok(PACKS[i].tokens / PACKS[i].satang > PACKS[i - 1].tokens / PACKS[i - 1].satang, PACKS[i].id);
  }
  assert.equal(packOf('p1'), null);
});

test('สำเนาราคาในแอปตรงกับของเซิร์ฟเวอร์ทุกแพ็ก', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(here, '..', '..', '..', '..', 'app.js'), 'utf8');
  const m = src.match(/const TOPUP_PACKS = (\[[\s\S]*?\]);/);
  assert.ok(m, 'หา TOPUP_PACKS ใน app.js ไม่เจอ');
  const app = Function('return ' + m[1])();
  assert.deepEqual(app.map(p => [p.id, p.tokens, p.baht * 100]), PACKS.map(p => [p.id, p.tokens, p.satang]));
});

test('หน้ากลับหลังจ่าย รับแค่เว็บจริงกับเครื่องพัฒนา', () => {
  assert.equal(returnBase('https://nadokagenou.github.io/studentos-ai/'), 'https://nadokagenou.github.io/studentos-ai/');
  assert.equal(returnBase('https://nadokagenou.github.io/studentos-ai/alt/index.html'), 'https://nadokagenou.github.io/studentos-ai/alt/');
  assert.equal(returnBase('http://localhost:5631/'), 'http://localhost:5631/');
  assert.equal(returnBase('https://evil.example/studentos-ai/'), DEFAULT_RETURN);
  assert.equal(returnBase('https://nadokagenou.github.io/other/'), DEFAULT_RETURN);
  assert.equal(returnBase('http://nadokagenou.github.io/studentos-ai/'), DEFAULT_RETURN);
  assert.equal(returnBase('javascript:alert(1)'), DEFAULT_RETURN);
  assert.equal(returnBase(''), DEFAULT_RETURN);
});

test('โหมดกุญแจ', () => {
  assert.equal(keyMode('sk_test_x'), 'test');
  assert.equal(keyMode('rk_test_x'), 'test');
  assert.equal(keyMode('sk_live_x'), 'live');
  assert.equal(keyMode('pk_test_x'), null);
  assert.equal(keyMode(undefined), null);
});

test('ฟอร์ม checkout ใช้ราคาจากตาราง ไม่ใช่จากผู้ใช้', () => {
  const f = checkoutForm(packOf('p49'), UID, 'https://nadokagenou.github.io/studentos-ai/');
  assert.equal(f.get('line_items[0][price_data][unit_amount]'), '4900');
  assert.equal(f.get('line_items[0][price_data][currency]'), 'thb');
  assert.equal(f.get('client_reference_id'), UID);
  assert.equal(f.get('metadata[pack]'), 'p49');
  assert.equal(f.get('success_url'), 'https://nadokagenou.github.io/studentos-ai/?topup=done');
  assert.throws(() => checkoutForm(packOf('p49'), 'not-a-uuid', DEFAULT_RETURN));
  assert.throws(() => checkoutForm(null, UID, DEFAULT_RETURN));
});

test('ลายเซ็น webhook', async () => {
  const body = JSON.stringify(ev(session()));
  const now = 1_800_000_000;
  assert.equal(await verifySignature(body, sign(body, now), SECRET, now), true);
  assert.equal(await verifySignature(body, sign(body, now) + ',v1=' + 'a'.repeat(64), SECRET, now), true, 'มีหลายลายเซ็นได้');
  assert.equal(await verifySignature(body + ' ', sign(body, now), SECRET, now), false, 'body ถูกแก้');
  assert.equal(await verifySignature(body, sign(body, now, 'whsec_other'), SECRET, now), false, 'กุญแจอื่น');
  assert.equal(await verifySignature(body, sign(body, now - 301), SECRET, now), false, 'เก่าเกิน 5 นาที');
  assert.equal(await verifySignature(body, `t=${now}`, SECRET, now), false, 'ไม่มี v1');
  assert.equal(await verifySignature(body, sign(body, now), '', now), false, 'ยังไม่ตั้งกุญแจ');
  assert.equal(await verifySignature(body, null, SECRET, now), false);
});

test('เหตุการณ์ที่จ่ายแล้ว → ใบเสร็จหนึ่งแถว', () => {
  assert.deepEqual(purchaseFromEvent(ev(session())).row, {
    id: 'cs_test_abcdef12', target: UID, pack: 'p19', tokens: 100, amount_satang: 1900,
    currency: 'thb', provider: 'stripe', livemode: false,
  });
  const late = purchaseFromEvent(ev(session(), 'checkout.session.async_payment_succeeded', true)).row;
  assert.equal(late.tokens, 100);
  assert.equal(late.livemode, true);
});

test('เหตุการณ์ที่ต้องไม่เติมโทเคน', () => {
  const skip = e => assert.ok(purchaseFromEvent(e).skip, JSON.stringify(e).slice(0, 80));
  skip(ev(session({ payment_status: 'unpaid' })));                      // พร้อมเพย์ยังไม่โอน
  skip(ev(session(), 'checkout.session.async_payment_failed'));
  skip(ev(session(), 'checkout.session.expired'));
  skip(ev(session({ amount_total: 100 })));                             // จ่ายไม่ครบ
  skip(ev(session({ currency: 'usd' })));
  skip(ev(session({ metadata: { uid: UID, pack: 'p999' } })));
  skip(ev(session({ metadata: { uid: '99999999-2222-4333-8444-555555555555', pack: 'p19' } }))); // เจ้าของไม่ตรง
  skip(ev(session({ client_reference_id: null })));
  skip(ev(session({ mode: 'subscription' })));
  skip(ev(null));
  skip({ type: 'checkout.session.completed', data: {} });
  skip(null);
});
