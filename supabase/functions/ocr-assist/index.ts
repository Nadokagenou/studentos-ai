// Student OS — อ่านตัวหนังสือจากรูปด้วย AI บนเซิร์ฟเวอร์ (ทางเลือกของผู้ใช้)
// ============================================================
// ทำไมต้องมี: Tesseract ในเครื่องอ่าน "ลายมือไทย" ไม่ได้เลย ไม่ว่าจะเตรียมภาพดีแค่ไหน
// นั่นคือเพดานที่ปีนไม่ได้ ต้องพึ่งโมเดลบนเซิร์ฟเวอร์เท่านั้น
//
// ทำไมต้องผ่าน Edge Function แทนที่จะยิงจากเบราว์เซอร์ตรง ๆ:
//   repo นี้เป็นสาธารณะ — API key อยู่ในโค้ดฝั่งหน้าเว็บเมื่อไหร่คือหลุดทันที
//   ทุก key อยู่ใน secret ของ Supabase เท่านั้น ฝั่งแอปไม่เคยเห็น
//
// **สถานะ: มีอะแดปเตอร์ Gemini แล้ว แต่ยังไม่เปิดจนกว่าจะตั้ง OCR_PROVIDER**
// ไม่ตั้ง = ยังได้ 501 พร้อมข้อความว่ายังไม่เปิดใช้ ซึ่งเป็นพฤติกรรมที่ตั้งใจ
// แอปจะขึ้นข้อความว่า "ยังไม่เปิดใช้" แทนที่จะพัง
//
// วิธีเปิดใช้งาน — ตั้ง secret สองดอกแล้ว deploy:
//    OCR_PROVIDER = gemini
//    GEMINI_API_KEY = <กุญแจ>        (ดอกเดียวกับที่ read-timetable ใช้ ไม่ต้องตั้งซ้ำ)
//
// หรือใช้ gateway ที่พูดภาษา OpenAI:  OCR_PROVIDER = gateway  (ดู _shared/llm.ts)
// ข้อแม้: รุ่นที่ตั้งใน LLM_MODEL ต้อง "ดูรูปได้" จริง ๆ — รุ่นข้อความล้วนจะตอบ 400
// หรือแย่กว่านั้นคือเดาเนื้อหาในรูปให้ทั้งที่ไม่เห็น ลองกับรูปจริงก่อนเปิดใช้เสมอ
//
// อยากลองสายไฟก่อนโดยไม่เสียโควตา: ตั้ง OCR_PROVIDER = mock
// ============================================================

import { chat, dataUri } from '../_shared/llm.ts';
import { geminiGenerate, geminiTrailLine, type GeminiError } from '../_shared/gemini.ts';

const PROVIDER = Deno.env.get('OCR_PROVIDER') ?? 'none';

// รุ่น/ขั้นการคิดของคำขอล่าสุด — โผล่ในคำตอบเฉพาะตอนขอด้วย debug: true
// มีไว้ตอบคำถามเดียว: ที่ช้าอยู่นี่เพราะยังคิดอยู่ หรือเพราะรุ่นมันช้าเอง
let lastShot: { model: string; think: string; ms: number } | null = null;
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
// สั่งให้คืน "ข้อความที่เห็น" ล้วน ๆ ห้ามสรุป ห้ามเติม ห้ามจัดรูปแบบใหม่
// ปลายทางของข้อความนี้คือ parseAssignment() ที่ฝั่งแอป ซึ่งมองหาวันเวลากับคะแนน
// จากถ้อยคำเดิมของครู — โมเดลที่ "ช่วย" เรียบเรียงให้จะลบสิ่งที่ตัวแกะต้องใช้ทิ้งพอดี
//
// ทุกอะแดปเตอร์ต้องใช้ก้อนนี้ก้อนเดียวกัน ไม่งั้นเปลี่ยนผู้ให้บริการแล้วผลที่ได้จะเปลี่ยนไปด้วย
const OCR_PROMPT = [
  'อ่านข้อความทั้งหมดในรูปนี้ แล้วคืนเฉพาะข้อความที่อ่านได้',
  '- คงถ้อยคำเดิมทุกตัว รวมทั้งวันที่ เวลา ตัวเลข คะแนน และชื่อครู',
  '- ขึ้นบรรทัดใหม่ตามที่เห็นในรูป',
  '- ห้ามสรุป ห้ามแปล ห้ามเติมคำที่ไม่ได้อยู่ในรูป',
  '- ตรงไหนอ่านไม่ออกให้ข้ามไป ไม่ต้องเดา และไม่ต้องเขียนอธิบายว่าอ่านไม่ออก',
  '- ถ้าไม่มีข้อความในรูปเลย ให้คืนข้อความว่าง',
].join('\n');

const ADAPTERS: Record<string, OcrAdapter> = {
  // ตัวทดสอบสายไฟ: ไม่ยิงออกนอก ไม่เสียเงิน ใช้ยืนยันว่าฝั่งแอป → Edge Function → กลับ ทำงานครบ
  // ตั้ง OCR_PROVIDER=mock แล้วกดปุ่มในแอปหนึ่งครั้ง ถ้าเห็นข้อความนี้โผล่ในฟอร์ม = สายครบแล้ว
  mock: async (img) => ({
    text: `[mock] รับภาพแล้ว ${img.mime} ขนาด ${Math.round(img.b64.length * 0.75 / 1024)} KB`,
    conf: 99,
  }),

  // ---------- Gemini ----------
  // เลือกเจ้านี้เพราะเป็นตัวเดียวกับที่ read-timetable ใช้อยู่แล้ว — กุญแจดอกเดียว
  // โควตาก้อนเดียว ไม่ต้องดูแลบัญชีสองที่ และมันอ่านลายมือไทยได้จริง ซึ่งเป็นเหตุผล
  // ทั้งหมดที่ชั้นนี้ถูกสร้างขึ้นมา
  //
  // ตั้ง OCR_PROVIDER=gemini แล้วปุ่มในแอปทำงานทันที ไม่ต้องแก้ฝั่งแอปสักบรรทัด
  gemini: async (img) => {
    // รายชื่อรุ่น · บันไดถอย · การอ่านคำตอบให้ครบทุก part อยู่ใน _shared/gemini.ts
    //
    // **ของเดิมตั้งรุ่นตายตัวเป็น gemini-2.5-flash ซึ่งตอบ 404 กับโปรเจกต์นี้ไปแล้ว**
    // (Google ปิดรับโปรเจกต์ใหม่กับรุ่นนั้น — วัดจริงด้วย probe:'models2' ของ ask-sai)
    // ผลคือปุ่ม "อ่านให้แม่นขึ้น" ในแอปคืน 502 ทุกครั้ง ทั้งที่กุญแจกับสายไฟดีหมด
    // และฝั่งแอปไม่มีทางรู้เลยว่าที่พังคือ "ชื่อรุ่น" เพราะข้อความ error ถูกกลืนไว้ในนี้
    // ใช้รายชื่อกลางแล้วปัญหานี้แก้ที่เดียวจบทั้งสามฟังก์ชัน
    const r = await geminiGenerate({
      parts: [{ text: OCR_PROMPT }, { inline_data: { mime_type: img.mime, data: img.b64 } }],
      temperature: 0,        // งานถอดข้อความ ไม่ใช่งานแต่งเรื่อง
      think: 'off',          // ถอดตัวอักษรที่เห็น ไม่ต้องคิด — คิดแล้วเปลืองโทเคนจนคำตอบโดนตัด
      maxOutputTokens: 4096, // ใบงานเต็มหน้ากินโทเคนเยอะ ตัดกลางคัน = ได้ข้อความไม่ครบ
      budgetMs: 45_000,
    });

    // Gemini ไม่คืนคะแนนความมั่นใจมาให้ ต่างจาก Tesseract ที่มีให้เป็นตัวเลขจริง
    // จะกรอก 99 ไปเฉย ๆ ก็ได้ แต่นั่นคือการโกหกฝั่งแอปที่เอาเลขนี้ไปเตือนผู้ใช้
    // ว่า "อ่านมาไม่ค่อยชัด ตรวจหน่อย" — ตัวเลขที่แต่งขึ้นจะปิดคำเตือนนั้นทิ้งทั้งหมด
    //
    // สิ่งที่พอวัดได้จริงคือจบครบหรือโดนตัดกลางคัน ซึ่งแปลว่าข้อความที่ได้ไม่ครบแน่ ๆ
    lastShot = { model: r.model, think: r.think, ms: r.ms };
    return { text: r.text, conf: !r.text ? 0 : r.truncated ? 55 : 90 };
  },

  // ---------- gateway ที่พูดภาษา OpenAI ----------
  // รูปเดินทางเป็น data URI ในช่อง image_url แทน inline_data ของ Google
  // คำสั่งใช้ก้อนเดียวกับของ gemini — ปลายทางคือ parseAssignment() เหมือนกัน
  // เพราะฉะนั้นข้อห้าม "ห้ามสรุป ห้ามเรียบเรียง" ต้องเหมือนกันด้วย
  gateway: async (img) => {
    const text = await chat({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: dataUri(img.mime, img.b64) } },
        ],
      }],
      temperature: 0,      // งานถอดข้อความ ไม่ใช่งานแต่งเรื่อง
      maxTokens: 2000,     // ใบงานเต็มหน้ากินโทเคนเยอะ ตัดกลางคัน = ได้ข้อความไม่ครบ
      timeoutMs: 30000,    // อ่านรูปช้ากว่าตอบข้อความมาก
    });

    // ฝั่ง OpenAI ไม่มีตัวเลขความมั่นใจให้เหมือนกัน และเรายังไม่ยอมแต่งเลขขึ้นมาเอง
    // 85 คือ "เชื่อได้ระดับหนึ่ง แต่ยังต่ำพอให้แอปเตือนผู้ใช้ให้ตรวจ" เหมือนสาย gemini
    return { text: text.trim(), conf: text.trim() ? 85 : 0 };
  },
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

  let body: { image?: string; mime?: string; debug?: boolean };
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
      ...(body.debug === true && lastShot ? { shot: lastShot } : {}),
    });
  } catch (e) {
    // รายละเอียดจริงเก็บไว้ใน log ฝั่งเซิร์ฟเวอร์ ไม่ส่งกลับไปหน้าเว็บ
    // (ข้อความ error ของผู้ให้บริการบางเจ้ามีชิ้นส่วนของ key หรือ endpoint ติดมาด้วย)
    //
    // ...ยกเว้นตอนถูกขอมาด้วย debug: true — ถ้าเปิด log ของ Supabase ไม่ได้
    // 'provider_failed' เปล่า ๆ คือทางตัน ไล่ต่อไม่ได้เลยว่าล้มที่รุ่นไหน เพราะอะไร
    const err = e as GeminiError;
    console.error('[ocr-assist]', PROVIDER, err?.status ?? '', err?.message ?? e,
      geminiTrailLine(err?.trail));
    const dbg = body.debug === true
      ? { status: err?.status ?? 0, detail: err?.detail ?? String(err?.message ?? e), trail: err?.trail ?? [] }
      : {};
    return json({
      ...dbg,
      ok: false, code: 'provider_failed',
      message: 'เซิร์ฟเวอร์อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง',
    }, 502);
  }
});
