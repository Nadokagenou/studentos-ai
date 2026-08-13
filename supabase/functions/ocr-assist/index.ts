// StudentOS AI — อ่านตัวหนังสือจากรูปด้วย AI บนเซิร์ฟเวอร์ (ทางเลือกของผู้ใช้)
// ============================================================
// ทำไมต้องมี: Tesseract ในเครื่องอ่าน "ลายมือไทย" ไม่ได้เลย ไม่ว่าจะเตรียมภาพดีแค่ไหน
// นั่นคือเพดานที่ปีนไม่ได้ ต้องพึ่งโมเดลบนเซิร์ฟเวอร์เท่านั้น
//
// ทำไมต้องผ่าน Edge Function แทนที่จะยิงจากเบราว์เซอร์ตรง ๆ:
//   repo นี้เป็นสาธารณะ — API key อยู่ในโค้ดฝั่งหน้าเว็บเมื่อไหร่คือหลุดทันที
//   ทุก key อยู่ใน secret ของ Supabase เท่านั้น ฝั่งแอปไม่เคยเห็น
//
// **สถานะ: โครงกลาง ยังไม่ได้เลือกผู้ให้บริการ**
// ตอนนี้ทุกคำขอจะได้ 501 พร้อมข้อความบอกว่ายังไม่ได้ตั้งค่า ซึ่งเป็นพฤติกรรมที่ตั้งใจ —
// แอปจะขึ้นข้อความว่า "ยังไม่เปิดใช้" แทนที่จะพัง
// วิธีเปิดใช้งาน: เขียนอะแดปเตอร์หนึ่งตัวข้างล่าง แล้วตั้ง OCR_PROVIDER เป็นชื่อนั้น
// ============================================================

const PROVIDER = Deno.env.get('OCR_PROVIDER') ?? 'none';
const MAX_BYTES = Number(Deno.env.get('OCR_MAX_BYTES') ?? 6_000_000);  // ~6MB หลังถอด base64

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });

// ---------- สัญญาที่ฝั่งแอปพึ่งพา ----------
// รับ  : { image: <base64 ไม่มีหัว data:>, mime: 'image/jpeg' }
// คืน  : { ok: true, text, conf, provider, ms }
//        { ok: false, code, message }   ← message เป็นภาษาไทย เอาไปโชว์ผู้ใช้ได้เลย
//
// **ห้ามเปลี่ยนรูปคืนค่านี้ตอนเพิ่มผู้ให้บริการ** — ฝั่งแอปอ่านแค่สี่ฟิลด์นี้
// เปลี่ยนเจ้าแล้วแอปต้องไม่ต้องแก้อะไรเลย นั่นคือเหตุผลที่แยกชั้นนี้ออกมา
export type OcrImage = { b64: string; mime: string };
export type OcrResult = { text: string; conf: number };
export type OcrAdapter = (img: OcrImage) => Promise<OcrResult>;

// ---------- ทะเบียนผู้ให้บริการ ----------
// เพิ่มเจ้าใหม่ = เขียนฟังก์ชันหนึ่งตัวที่รับ OcrImage คืน OcrResult แล้วใส่ในตารางนี้
// สิ่งที่แต่ละตัวต้องทำ: ยิง API ของเจ้านั้น → ดึงข้อความออกมา → คืนเป็นรูปเดียวกัน
// สิ่งที่ **ไม่ต้อง** ทำ: จัดการ CORS, ตรวจสิทธิ์, จำกัดขนาด, จับ error — ชั้นนี้ทำให้หมดแล้ว
const ADAPTERS: Record<string, OcrAdapter> = {
  // ตัวทดสอบสายไฟ: ไม่ยิงออกนอก ไม่เสียเงิน ใช้ยืนยันว่าฝั่งแอป → Edge Function → กลับ ทำงานครบ
  // ตั้ง OCR_PROVIDER=mock แล้วกดปุ่มในแอปหนึ่งครั้ง ถ้าเห็นข้อความนี้โผล่ในฟอร์ม = สายครบแล้ว
  mock: async (img) => ({
    text: `[mock] รับภาพแล้ว ${img.mime} ขนาด ${Math.round(img.b64.length * 0.75 / 1024)} KB`,
    conf: 99,
  }),

  // TODO: เพิ่มอะแดปเตอร์จริงตรงนี้ตอนเลือกเจ้าได้แล้ว
  //
  // โครงที่ต้องเขียน:
  //   ชื่อเจ้า: async (img) => {
  //     const key = Deno.env.get('OCR_API_KEY')!;       // ตั้งด้วย supabase secrets set
  //     const r = await fetch('<endpoint ของเจ้านั้น>', { ... img.b64 ... });
  //     if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  //     const d = await r.json();
  //     return { text: <ข้อความที่ได้>, conf: <0–100> };
  //   },
  //
  // ยังไม่เขียนไว้ล่วงหน้าเพราะรูปคำขอ/คำตอบของแต่ละเจ้าต่างกัน และเดาผิดแล้วจะพังเงียบ ๆ
  // ตอนเลือกได้แล้วค่อยเขียนตัวเดียวโดยอ่านเอกสารของเจ้านั้นประกอบ
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, code: 'method', message: 'ต้องเป็น POST' }, 405);

  const adapter = ADAPTERS[PROVIDER];
  if (!adapter) {
    // ยังไม่ได้เลือกผู้ให้บริการ — ตอบให้ชัดเพื่อให้แอปแยกออกจาก "เน็ตล่ม"
    return json({
      ok: false,
      code: 'not_configured',
      message: 'ยังไม่ได้เปิดใช้การอ่านด้วย AI บนเซิร์ฟเวอร์',
    }, 501);
  }

  let body: { image?: string; mime?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, code: 'bad_json', message: 'ข้อมูลที่ส่งมาไม่ถูกรูปแบบ' }, 400); }

  const b64 = (body.image ?? '').replace(/^data:[^,]+,/, '');   // เผื่อฝั่งแอปส่งหัว data: ติดมา
  if (!b64) return json({ ok: false, code: 'no_image', message: 'ไม่พบรูปภาพในคำขอ' }, 400);

  // base64 พองขึ้น ~4/3 เท่า — คิดกลับเป็นขนาดจริงก่อนเทียบเพดาน
  const bytes = Math.floor(b64.length * 0.75);
  if (bytes > MAX_BYTES) {
    return json({
      ok: false, code: 'too_large',
      message: `รูปใหญ่เกินไป (${Math.round(bytes / 1024 / 1024 * 10) / 10} MB) — ลองครอบให้แคบลง`,
    }, 413);
  }

  const t0 = Date.now();
  try {
    const r = await adapter({ b64, mime: body.mime || 'image/jpeg' });
    return json({
      ok: true,
      text: r.text ?? '',
      conf: Math.max(0, Math.min(100, Math.round(r.conf ?? 0))),
      provider: PROVIDER,
      ms: Date.now() - t0,
    });
  } catch (e) {
    // รายละเอียดจริงเก็บไว้ใน log ฝั่งเซิร์ฟเวอร์ ไม่ส่งกลับไปหน้าเว็บ
    // (ข้อความ error ของผู้ให้บริการบางเจ้ามีชิ้นส่วนของ key หรือ endpoint ติดมาด้วย)
    console.error('[ocr-assist]', PROVIDER, e);
    return json({
      ok: false, code: 'provider_failed',
      message: 'เซิร์ฟเวอร์อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง',
    }, 502);
  }
});
