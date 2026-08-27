// Student OS — "ถามน้องไซ": ผู้ช่วยที่รู้จักงานของผู้ใช้อยู่แล้ว
// ============================================================
// ทำไมต้องผ่าน Edge Function แทนที่จะยิงจากเบราว์เซอร์ตรง ๆ:
//   repo นี้เป็นสาธารณะ — API key อยู่ในโค้ดฝั่งหน้าเว็บเมื่อไหร่คือหลุดทันที
//   ทุก key อยู่ใน secret ของ Supabase เท่านั้น ฝั่งแอปไม่เคยเห็น
//   (กติกาเดียวกับ ocr-assist และ read-timetable — อย่าแตกแถว)
//
// **สถานะ: ยังไม่เปิดจนกว่าจะตั้ง ASK_PROVIDER**
// ไม่ตั้ง = ตอบ 501 พร้อมข้อความไทย ซึ่งเป็นพฤติกรรมที่ตั้งใจ
// แอปจะขึ้นว่า "ยังไม่เปิดใช้" แทนที่จะพัง
//
// วิธีเปิดใช้งาน — ตั้ง secret แล้ว deploy:
//    ASK_PROVIDER   = gemini
//    GEMINI_API_KEY = <กุญแจ>     (ดอกเดียวกับที่ read-timetable ใช้ ไม่ต้องตั้งซ้ำ)
//
// หรือใช้ gateway ที่พูดภาษา OpenAI (/v1/chat/completions) แทน:
//    ASK_PROVIDER = gateway
//    LLM_BASE_URL / LLM_API_KEY / LLM_MODEL   (ดูคำอธิบายใน _shared/llm.ts)
// สองเจ้านี้อยู่ร่วมกันได้ ตั้งไว้ทั้งคู่แล้วสลับด้วย ASK_PROVIDER ดอกเดียว
//
// อยากลองสายไฟก่อนโดยไม่เสียโควตา: ASK_PROVIDER = mock
// ============================================================

import { chat, chatStream, listModels, LLM_MODEL, type ChatMsg } from '../_shared/llm.ts';

const PROVIDER = Deno.env.get('ASK_PROVIDER') ?? 'none';
const API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

// ชื่อรุ่นของ Gemini เปลี่ยนบ่อยกว่าที่ควร รุ่นที่หายไปตอบ 404 ซึ่งหน้าตาเหมือน "ต่อไม่ติด"
// ไล่ลองตามลำดับเหมือน read-timetable แล้วจำตัวที่ติดไว้ใช้ต่อทั้งรอบชีวิตของ instance
const MODEL_ENV = Deno.env.get('GEMINI_MODEL') ?? '';
const MODEL_CANDIDATES = MODEL_ENV ? [MODEL_ENV] : [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];
let workingModel = '';

// ---------- เพดานของคำขอหนึ่งครั้ง ----------
// free tier มีโควตาจำกัด และคำขอเดียวที่ยัดบริบทมาเป็นเมกะไบต์เผาโควตาได้ทั้งวันในทีเดียว
// ฝั่งแอปตัดมาให้แล้วชั้นหนึ่ง ตรงนี้เป็นชั้นที่สองสำหรับคนที่ยิงตรงเข้ามาเอง
const MAX_QUESTION = 2_000;      // ตัวอักษร
const MAX_CONTEXT = 20_000;      // ตัวอักษร (งาน 28 ใบ + ตารางเรียนเต็มสัปดาห์ ยังไม่ถึงครึ่ง)
const MAX_HISTORY = 12;          // ข้อความย้อนหลัง — เกินนั้นค่าโทเคนโตเร็วกว่าประโยชน์ที่ได้
const MAX_OUTPUT_TOKENS = 800;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });

// ---------- คำสั่งถึงโมเดล ----------
// ข้อที่สำคัญที่สุดคือข้อ 1: ห้ามทำการบ้านให้เสร็จแทน
// แอปนี้ส่งให้โรงเรียนและส่งประกวด ถ้ามันกลายเป็นเครื่องทำการบ้านแทนเด็ก
// มันจะถูกแบนจากห้องเรียนก่อนที่ใครจะได้ใช้ประโยชน์จากส่วนที่เหลือ
// ข้อ 5 มีเพราะโมเดลชอบตอบเป็นเรียงความ ซึ่งบนจอมือถืออ่านไม่จบ
const SYSTEM = `คุณคือ "น้องไซ" ผู้ช่วยของนักเรียนไทยในแอป Student OS

# กติกาที่ห้ามแหก
1. ห้ามทำการบ้านให้เสร็จแทน — อธิบายวิธีคิด ยกตัวอย่างที่คล้ายแต่ไม่ใช่ข้อเดียวกัน
   ถามกลับว่าติดตรงไหน แล้วให้เขาลงมือเอง
   ถ้าเขาขอคำตอบตรง ๆ ให้บอกว่าจะพาคิดทีละขั้นแทน แล้วเริ่มขั้นแรกให้เลย
2. ห้ามเดาสิ่งที่ไม่มีในข้อมูล — วันส่ง คะแนน ชื่อครู เนื้อหาวิชา ถ้าไม่มีให้บอกว่าไม่มี
   "ไม่รู้" ที่ตรงไปตรงมา มีค่ากว่าคำตอบที่ฟังดูดีแต่ผิด เพราะเขาเอาไปวางแผนจริง

# ตอบยังไง
3. ตอบทันที ไม่ต้องเกริ่น ไม่ต้องทวนคำถาม ไม่ต้องสรุปตอนท้ายว่าเพิ่งพูดอะไรไป
   ประโยคแรกต้องเป็นเนื้อคำตอบเลย
4. สั้น — 2 ถึง 5 บรรทัด ถ้าต้องยาวกว่านั้นให้แบ่งเป็นข้อ ๆ ไม่เกิน 4 ข้อ
   แล้วปิดท้ายด้วยคำถามเดียวว่าจะเจาะข้อไหนต่อ
5. ภาษาไทยแบบพูดกับเพื่อนร่วมห้อง ไม่ต้องสุภาพจนเกร็ง ไม่ต้องลงท้าย "ครับ/ค่ะ" ทุกประโยค
   แทนตัวเองว่า "เรา" เรียกเขาว่า "เธอ" หรือไม่เรียกเลยก็ได้
6. ห้ามใช้หัวข้อใหญ่ ห้ามใช้ตาราง ห้ามขึ้น bullet ซ้อน bullet — จอมือถือแคบ
   เน้นคำสำคัญด้วย **ตัวหนา** ได้ แต่อย่าเกินสองที่ต่อคำตอบ

# ข้อมูลที่เธอเห็น
7. ส่วน "ข้อมูลของผู้ใช้" คืองานจริงของเขา ณ วินาทีนี้ ใช้ได้เลยโดยไม่ต้องถามซ้ำ
8. หัวข้อ "งานที่ยังไม่เสร็จ" ถูกแอปเรียงลำดับมาให้แล้ว — ข้อ 1 คือใบที่ควรทำก่อน
   ถามว่า "ทำอะไรก่อน" = ตอบใบที่ 1 เสมอ ห้ามจัดลำดับใหม่เอง ห้ามเทียบวันที่เอง
   ลำดับนั้นคิดจาก กำหนดส่ง × คะแนน × เวลาที่ต้องใช้ ซึ่งละเอียดกว่าที่เธอเดาจากวันที่อย่างเดียว
   เหตุผลที่ยกให้เขาฟัง ต้องหยิบจากบรรทัดของใบนั้นจริง ๆ (กำหนดส่ง คะแนนเก็บ เวลาที่ประเมิน)
   ห้ามแต่งเหตุผลเอง และห้ามพูดว่า "ส่งช้าที่สุดเลยทำก่อน" ซึ่งกลับหัวกับความจริง
9. ถ้าข้อมูลว่างเปล่า อย่าแกล้งทำเป็นมี — บอกว่ายังไม่เห็นงาน แล้วชวนให้สแกนใบงาน
   หรือพิมพ์งานเข้ามา หนึ่งประโยคพอ ไม่ต้องขายของ

# เรื่องความเร็ว
10. อย่าไตร่ตรองยาว คำถามนักเรียนส่วนใหญ่ตรงไปตรงมา อ่านแล้วตอบได้เลย
   ใช้เวลาคิดเท่าที่จำเป็นกับคำถามตรงหน้า แล้วเขียนคำตอบออกมาทันที`;

type Msg = { role: 'user' | 'model'; text: string };

async function askGemini(question: string, context: string, history: Msg[]) {
  if (!API_KEY) throw new Error('GEMINI_API_KEY ยังไม่ได้ตั้ง');

  const contents = [
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: `ข้อมูลของผู้ใช้ (ณ ตอนนี้):\n${context}\n\nคำถาม:\n${question}` }] },
  ];

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents,
    generationConfig: {
      temperature: 0.6,          // ต้องอธิบายให้เข้าใจ ไม่ใช่อ่านตำรา — แต่ไม่ถึงกับแต่งเรื่อง
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });

  const order = workingModel
    ? [workingModel, ...MODEL_CANDIDATES.filter(m => m !== workingModel)]
    : MODEL_CANDIDATES;

  let res: Response | null = null;
  let lastStatus = 0;

  for (const model of order) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
        body: payload,
      },
    );
    if (res.ok) { workingModel = model; break; }
    lastStatus = res.status;
    // ข้อความจากฝั่ง Google มีรายละเอียดของโปรเจกต์ปนมาได้ เก็บไว้ใน log ไม่ส่งกลับหน้าเว็บ
    console.warn('[ask-sai] gemini', model, res.status, (await res.text()).slice(0, 200));
    if (res.status !== 404) break;   // 404 = ไม่มีรุ่นนี้ · อย่างอื่นไม่ใช่เรื่องชื่อรุ่น
    res = null;
  }

  if (!res || !res.ok) {
    const e = new Error('gemini ' + lastStatus) as Error & { status?: number };
    e.status = lastStatus;
    throw e;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text.trim()) throw new Error('คำตอบว่าง');
  return text.trim();
}

// ---------- gateway ที่พูดภาษา OpenAI ----------
// ต่างจาก Gemini สองเรื่องที่ต้องระวัง: บุคลิกไปอยู่ใน message ตัวแรก (role 'system')
// แทนที่จะเป็นช่องแยก และฝั่งบอทเรียกตัวเองว่า 'assistant' ไม่ใช่ 'model'
// ที่เหลือ (ไล่ลองชื่อรุ่น) ไม่ต้องมี เพราะชื่อรุ่นของ gateway ตั้งมาตายตัวจาก LLM_MODEL
function gatewayMessages(question: string, context: string, history: Msg[]): ChatMsg[] {
  return [
    { role: 'system', content: SYSTEM },
    ...history.map((m): ChatMsg => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.text,
    })),
    { role: 'user', content: `ข้อมูลของผู้ใช้ (ณ ตอนนี้):
${context}

คำถาม:
${question}` },
  ];
}

async function askGateway(question: string, context: string, history: Msg[]) {
  const messages = gatewayMessages(question, context, history);
  // เพดานนี้ต้องสูงกว่าของสาย Gemini มาก เพราะรุ่น "คิดก่อนตอบ" นับความคิดรวมในเพดานเดียวกัน
  // ตั้งเท่า 800 เหมือน Gemini = คิดเสร็จพอดีโทเคนหมด แล้วคืนคำตอบเปล่ากลับมา
  // ความยาวคำตอบจริงคุมด้วยข้อ 5 ใน SYSTEM ไม่ได้คุมด้วยเพดานนี้
  return await chat({ messages, temperature: 0.4, maxTokens: 1200, timeoutMs: 40000, noThink: true });
}

// สายไฟล้วน ๆ สำหรับทดสอบหน้าจอโดยไม่เสียโควตา
async function askMock(question: string, context: string) {
  const n = (context.match(/^- /gm) || []).length;
  return `(โหมดทดสอบ) ได้รับคำถามแล้ว: "${question.slice(0, 60)}"\n`
    + `เห็นข้อมูลของคุณ ${n} รายการ — ตั้ง ASK_PROVIDER = gemini หรือ gateway เพื่อต่อกับ AI จริง`;
}

const ADAPTERS: Record<string, (q: string, c: string, h: Msg[]) => Promise<string>> = {
  gemini: askGemini,
  gateway: askGateway,
  mock: askMock,
};

// ---------- สัญญาที่ฝั่งแอปพึ่งพา ----------
// รับ  : { question, context, history?: [{role:'user'|'model', text}] }
// คืน  : { ok: true, answer, provider, ms }
//        { ok: false, code, message }   ← message เป็นภาษาไทย เอาไปโชว์ผู้ใช้ได้เลย
// **ห้ามเปลี่ยนรูปคืนค่านี้ตอนเพิ่มผู้ให้บริการ** — ฝั่งแอปอ่านแค่สี่ฟิลด์นี้
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, code: 'method', message: 'ต้องเป็น POST' }, 405);

  const adapter = ADAPTERS[PROVIDER];
  if (!adapter) {
    return json({
      ok: false, code: 'not_configured',
      message: 'ยังไม่ได้เปิดใช้น้องไซบนเซิร์ฟเวอร์',
    }, 501);
  }

  let body: { question?: string; context?: string; history?: Msg[]; stream?: boolean };
  try { body = await req.json(); }
  catch { return json({ ok: false, code: 'bad_json', message: 'ข้อมูลที่ส่งมาไม่ถูกรูปแบบ' }, 400); }

  // โหมดสำรวจ: บอกว่ากุญแจดอกนี้เรียกรุ่นไหนได้บ้าง — แบบเดียวกับ read-timetable
  // มีไว้เพื่อไม่ต้องเอากุญแจออกจากเซิร์ฟเวอร์มาลองยิงเองตอนจะเปลี่ยนรุ่น
  if ((body as { probe?: string }).probe === 'models') {
    try {
      return json({ ok: true, models: await listModels(), using: LLM_MODEL });
    } catch (e) {
      return json({ ok: false, code: 'probe_failed', message: (e as Error).message }, 502);
    }
  }

  const question = String(body.question ?? '').trim();
  if (!question) return json({ ok: false, code: 'no_question', message: 'ยังไม่ได้พิมพ์คำถาม' }, 400);
  if (question.length > MAX_QUESTION) {
    return json({ ok: false, code: 'too_long', message: 'คำถามยาวเกินไป ลองตัดให้สั้นลง' }, 413);
  }

  const context = String(body.context ?? '').slice(0, MAX_CONTEXT);
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, text: m.text.slice(0, MAX_QUESTION) }));

  // ---------- ไหลทีละคำ ----------
  // รุ่นนี้ใช้เวลา 10-30 วินาทีกว่าจะเขียนจบ · หน้าจอนิ่ง 20 วินาทีคือจุดที่คนกดออก
  // ทั้งที่คำแรกพร้อมตั้งแต่วินาทีที่สาม จึงส่งออกไปเลยระหว่างที่ยังเขียนไม่จบ
  //
  // รูปแบบที่ส่งกลับคือ NDJSON — หนึ่งบรรทัดหนึ่งเหตุการณ์:
  //   {"t":"ข้อความชิ้นหนึ่ง"}     ← ต่อท้ายฟองแชทได้เลย
  //   {"done":true,"ms":1234}     ← จบแล้ว
  //   {"error":"...","code":"..."} ← พังกลางทาง เอา error ไปโชว์ได้เลย
  // เลือก NDJSON แทน SSE เพราะฝั่งแอปอ่านเองด้วย fetch ธรรมดา ไม่ต้องพึ่ง EventSource
  // (ซึ่งส่ง POST ไม่ได้) และแยกบรรทัดง่ายกว่าไล่ parse event: / data: ของ SSE
  //
  // ใช้ได้เฉพาะสาย gateway — Gemini กับ mock ยังตอบเป็นก้อนเดียวเหมือนเดิม
  if (body.stream === true && PROVIDER === 'gateway') {
    const t0 = Date.now();
    const enc = new TextEncoder();
    const line = (o: unknown) => enc.encode(JSON.stringify(o) + '\n');

    const stream = new ReadableStream({
      async start(c) {
        try {
          for await (const piece of chatStream({
            messages: gatewayMessages(question, context, history),
            temperature: 0.4, maxTokens: 1200, timeoutMs: 40000, noThink: true,
          })) c.enqueue(line({ t: piece }));
          c.enqueue(line({ done: true, ms: Date.now() - t0 }));
        } catch (e) {
          // สตรีมเริ่มไปแล้ว เปลี่ยนรหัสสถานะ HTTP ไม่ได้อีก — error จึงต้องเดินทาง
          // มาในตัวสตรีมเอง ไม่งั้นฝั่งแอปจะเห็นสตรีมจบเฉย ๆ แล้วนึกว่าคำตอบหมดแค่นั้น
          const status = (e as { status?: number }).status ?? 0;
          console.error('[ask-sai:stream]', e);
          c.enqueue(line({
            error: status === 429
              ? 'น้องไซถูกถามเยอะไปหน่อย รอสักครู่แล้วลองใหม่'
              : 'น้องไซตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง',
            code: status === 429 ? 'rate_limited' : 'provider_failed',
          }));
        } finally {
          c.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...CORS, 'content-type': 'application/x-ndjson; charset=utf-8' },
    });
  }

  const t0 = Date.now();
  try {
    const answer = await adapter(question, context, history);
    return json({ ok: true, answer, provider: PROVIDER, ms: Date.now() - t0 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 0;
    console.error('[ask-sai]', PROVIDER, e);
    // โควตาเต็มต้องแยกออกจาก "พัง" — ผู้ใช้ทำอะไรได้ต่างกัน (รอ vs แจ้งคนทำแอป)
    if (status === 429) {
      return json({
        ok: false, code: 'rate_limited',
        message: 'น้องไซถูกถามเยอะไปหน่อย รอสักครู่แล้วลองใหม่',
      }, 429);
    }
    return json({
      ok: false, code: 'provider_failed',
      message: 'น้องไซตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง',
    }, 502);
  }
});
