// Student OS — รับแจ้งจาก Stripe ว่าเงินเข้าแล้ว แล้วจดใบเสร็จ (= เติมโทเคน)
// ============================================================
// Stripe ยิงมาที่นี่ (ไม่มี JWT ของผู้ใช้ → verify_jwt = false ใน config.toml)
// ด่านจริงคือลายเซ็น Stripe-Signature ที่ตรวจด้วย STRIPE_WEBHOOK_SECRET — ไม่มี secret ก็ปลอมไม่ได้
//
// จดลง public.token_purchases แถวเดียวต่อ session (id ซ้ำ = ข้าม) · คลังโทเคนของบัญชีอ่านยอด
// จากตารางนี้เองผ่าน studentos_economy_minted() ครั้งถัดไปที่แอปขอยอด — ไม่ต้องแตะคลังตรง ๆ
//
// ตอบ 200 กับเหตุการณ์ที่ไม่เกี่ยว/ไม่ต้องเติม (ไม่งั้น Stripe ยิงซ้ำไปเรื่อย ๆ)
// ตอบ 500 เฉพาะตอนเขียนฐานข้อมูลไม่ได้ — ให้ Stripe ลองใหม่เอง (ยิงซ้ำได้ปลอดภัยเพราะ id ซ้ำถูกข้าม)
//
// ยังไม่ทำ: คืนเงิน (charge.refunded) — ตอนนี้ต้องหักโทเคนคืนด้วยมือผ่านระบบทีมงาน
//
// secrets: STRIPE_WEBHOOK_SECRET (whsec_...) — ได้ตอนเพิ่ม endpoint ในแดชบอร์ด Stripe
// เลือกเหตุการณ์: checkout.session.completed · checkout.session.async_payment_succeeded
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifySignature, purchaseFromEvent } from '../_shared/topup.mjs';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async req => {
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  const payload = await req.text();
  const ok = await verifySignature(payload, req.headers.get('stripe-signature'),
    Deno.env.get('STRIPE_WEBHOOK_SECRET') || '', Math.floor(Date.now() / 1000));
  if (!ok) return reply({ error: 'signature' }, 400);

  let event;
  try { event = JSON.parse(payload); } catch { return reply({ error: 'json' }, 400); }
  const got = purchaseFromEvent(event);
  if (!got.row) {
    if (got.skip !== 'not paid yet' && !String(got.skip).startsWith('ignored')) console.warn('topup skip', got.skip, event?.data?.object?.id);
    return reply({ ok: true, skip: got.skip });
  }

  const { error } = await db.from('token_purchases').upsert(got.row, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    console.error('topup insert', error.code, error.message);
    return reply({ error: 'db' }, 500);
  }
  return reply({ ok: true });
});
