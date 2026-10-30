// Student OS — เปิดหน้าจ่ายเงินเพื่อเติมโทเคน
// ============================================================
// แอปส่งมาแค่ "รหัสแพ็ก" กับ "หน้าที่จะกลับไป" → ที่นี่สร้าง Stripe Checkout Session แล้วคืน URL
// ผู้ใช้จ่ายบนหน้าของ Stripe (พร้อมเพย์ · บัตร) — แอปเราไม่เคยเห็นเลขบัตร
//
// ที่นี่ไม่เติมโทเคนเลย: การกลับมาที่ ?topup=done ไม่ได้พิสูจน์ว่าเงินเข้า
// โทเคนเข้าเมื่อ token-webhook ได้รับเหตุการณ์ที่ Stripe เซ็นมาแล้วเท่านั้น
//
// ด่าน:
//   ต้องล็อกอินด้วยบัญชีจริง (ไม่ใช่บัญชีนิรนาม) — โทเคนผูกกับบัญชี ไม่ใช่กับเครื่อง
//   ราคาอ่านจาก _shared/topup.mjs ไม่ใช่จาก body
//   กุญแจ live ถูกล็อกไว้จนกว่าจะตั้ง TOPUP_ALLOW_LIVE=1 — ใส่กุญแจผิดชุดจะไม่ตัดเงินจริงโดยไม่ตั้งใจ
//
// secrets ที่ต้องตั้งใน Supabase: STRIPE_SECRET_KEY (sk_test_...) · TOPUP_ALLOW_LIVE (เว้นไว้ = ทดสอบเท่านั้น)
//
// สัญญา:
//   POST /functions/v1/token-checkout   body { "pack": "p19", "back": "<location ปัจจุบัน>" }
//   200 { "url": "https://checkout.stripe.com/..." }
//   401 { "error": "login" } · 400 { "error": "pack" } · 503 { "error": "not_configured" | "live_locked" | "provider" }
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { packOf, returnBase, keyMode, checkoutForm } from '../_shared/topup.mjs';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const secret = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const mode = keyMode(secret);
  if (!mode) return json({ error: 'not_configured' }, 503);
  if (mode === 'live' && Deno.env.get('TOPUP_ALLOW_LIVE') !== '1') return json({ error: 'live_locked' }, 503);

  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = jwt ? await db.auth.getUser(jwt) : { data: null };
  const user = who?.user;
  if (!user || user.is_anonymous) return json({ error: 'login' }, 401);

  let body: { pack?: string; back?: string } = {};
  try { body = await req.json(); } catch { /* ว่าง = ไม่มีแพ็ก */ }
  const pack = packOf(body.pack);
  if (!pack) return json({ error: 'pack' }, 400);

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: checkoutForm(pack, user.id, returnBase(body.back)),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || typeof out.url !== 'string') {
    console.error('stripe checkout', r.status, out?.error?.code || '', out?.error?.message || '');
    return json({ error: 'provider' }, 503);
  }
  return json({ url: out.url, test: mode === 'test' });
});
