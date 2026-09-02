// Student OS — สายเดียวสำหรับคุยกับ Gemini
// ============================================================
// ทำไมต้องมีไฟล์นี้: สามฟังก์ชัน (ask-sai · ocr-assist · read-timetable) ยิง Gemini
// คนละที่ ด้วยโค้ดที่ก๊อปกันมา แล้วค่อย ๆ เพี้ยนจากกันจนกลายเป็นบั๊กคนละตัว:
//
//   1) รายชื่อรุ่นไม่ตรงกัน — ask-sai ไล่ 3.6/3.5/3-preview (วัดจริงแล้วใช้ได้)
//      ส่วน ocr-assist ยังตั้ง gemini-2.5-flash ตัวเดียวซึ่ง **404 กับโปรเจกต์นี้แล้ว**
//      ปุ่ม "อ่านให้แม่นขึ้น" จึงพัง 502 ทุกครั้ง โดยที่ฝั่งแอปไม่มีทางรู้ว่าเพราะชื่อรุ่น
//      (read-timetable ก็ไล่ 2.5/2.0 ซึ่งตายทั้งคู่ เหลือรอดตัวเดียวคือ flash-latest)
//
//   2) อ่านคำตอบจาก parts[0] ตัวเดียว — รุ่น 3.x "คิดก่อนตอบ" เป็นค่าเริ่มต้น
//      คำตอบจึงกลับมาเป็นหลาย part และ part แรกอาจเป็นความคิด (thought: true)
//      อ่านแค่ตัวแรกจึงได้คำตอบขาด ๆ หรือได้ความคิดมาแทนคำตอบ
//      — นี่คืออาการ "น้องไซตอบไม่ครบ ดูรวน ๆ"
//
//   3) เพดานโทเคนนับความคิดรวมด้วย — ask-sai ตั้ง 1500 ซึ่งความคิดกินไปเกือบหมด
//      เหลือให้เขียนคำตอบไม่กี่บรรทัดแล้วโดนตัดกลางประโยค (finishReason = MAX_TOKENS)
//
// ที่นี่แก้ทั้งสามเรื่องที่เดียว แล้วให้ทุกฟังก์ชันเรียกผ่านตัวนี้
// ============================================================

export const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? Deno.env.get('OCR_API_KEY') ?? '';

// ตั้ง GEMINI_MODEL ไว้ = บังคับใช้ตัวนั้นตัวเดียว ไม่ต้องเดา
const MODEL_ENV = Deno.env.get('GEMINI_MODEL') ?? '';

// เรียงจากดีสุดลงมา — เป็น "บันไดถอย" ไม่ใช่แค่กันชื่อรุ่นเปลี่ยน:
// free tier ของ Google นับโควตาแยกต่อรุ่น พอรุ่นบนหมดโควตา (429) มันไถลลงมาใช้รุ่นล่างเอง
//
// วัดจริง 1 ก.ย. 69 ด้วย probe:'models2' (ยิงคำขอจริงทีละรุ่นด้วยกุญแจของโปรเจกต์นี้):
//   gemini-3.6-flash       → 200 (2.4 วิ)
//   gemini-3.5-flash       → 200 (1.0 วิ) และคืน thoughtSignature มาด้วย = คิดก่อนตอบจริง
//   gemini-3-flash-preview → 200 (1.3 วิ)
//   gemini-flash-latest    → 503 คนแน่น
//   gemini-2.5-flash       → 404 ปิดรับโปรเจกต์ใหม่แล้ว   ← อย่าใส่กลับเข้ามา
//   gemini-2.0-flash       → 404 ปลดระวางแล้ว             ← อย่าใส่กลับเข้ามา
export const GEMINI_MODELS = MODEL_ENV ? [MODEL_ENV] : [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-flash-latest',      // ตาข่ายรับสุดท้าย ชื่อนี้ Google ชี้ไปรุ่นใหม่ให้เอง
];

// สถานะที่ "ลองรุ่นถัดไปแล้วอาจรอด" — 401/403 คือปัญหาที่กุญแจ ลองรุ่นอื่นก็เหมือนเดิม
// **400 อยู่ในนี้ด้วยตั้งแต่ 2 ก.ย. 69**: ช่องอย่าง responseSchema หรือ thinkingLevel
// รุ่นหนึ่งรับ อีกรุ่นตอบ 400 ทิ้ง — ถือว่าเป็น "คำขอเสียทั้งใบ" แล้วหยุดที่รุ่นแรก
// คือสาเหตุที่ทั้ง read-timetable และ ocr-assist ล้มทุกครั้งโดยไม่เคยแตะรุ่นสำรองเลย
export const RETRY_NEXT_MODEL = new Set([400, 404, 429, 500, 502, 503, 504]);

// เพดานเวลาต่อการยิงหนึ่งครั้ง — ตั้งให้ต่ำกว่า budgetMs เสมอ เพื่อให้เหลือเวลาถอยไปรุ่นถัดไป
const ATTEMPT_MS = 22_000;

// ---------- คิดก่อนตอบ: สั่งเท่าที่รุ่นนั้นยอมรับ ----------
// รุ่น 3.x คิดก่อนตอบเป็นค่าเริ่มต้น ซึ่งดีกับคำถามยาก แต่แพงและช้ากับงานถอดข้อความ
// ปัญหาคือชื่อช่องไม่เหมือนกันระหว่างรุ่น (3.x ใช้ thinkingLevel · 2.5 ใช้ thinkingBudget)
// และรุ่นที่ไม่รู้จักช่องนั้นตอบ 400 ทิ้ง ซึ่งบันไดถอยของเราถือว่าเป็น "ปัญหาที่คำขอ" แล้วหยุด
//
// จึงไม่เดา: ลองช่องที่น่าจะใช่ก่อน ถ้าโดน 400 ก็ถอยลงมาช่องถัดไป **กับรุ่นเดิม** ทันที
// แล้วจำไว้ทั้งอายุ instance ผู้ใช้จึงไม่เห็นความล้มเหลวจากการลองนี้ อย่างมากคือช้าขึ้นครั้งเดียว
type ThinkStep = 'level' | 'budget' | 'none';
const THINK_LADDER: ThinkStep[] = ['level', 'budget', 'none'];
const thinkStep: Record<string, number> = {};

const thinkKey = (model: string, want: 'low' | 'off') => model + ':' + want;

/** ค่า generationConfig ส่วนที่คุมการคิด สำหรับรุ่นนี้ ณ ขั้นบันไดปัจจุบัน
 *
 *  **ทั้งสองช่องอยู่ใต้ thinkingConfig ไม่ใช่ระดับบนของ generationConfig**
 *  วางผิดชั้นมาตลอด Google จึงตอบกลับมาว่า (วัดจริง 2 ก.ย. 69):
 *    Unknown name "thinkingLevel" at 'generation_config': Cannot find field.
 *    Unknown name "thinkingBudget" at 'generation_config': Cannot find field.
 *  = ทั้งสองขั้นแรกของบันไดเผาตัวเองทิ้งทุกคำขอ เหลือขั้น 'none' ที่ไม่สั่งอะไรเลย
 *  แล้วรุ่น 3.x ก็คิดยาวตามค่าเริ่มต้นจนกินงบเวลาหมด — นี่คือ 45 วินาทีที่หายไป */
function thinkingConfig(model: string, want: 'low' | 'off') {
  const step = THINK_LADDER[thinkStep[thinkKey(model, want)] ?? 0];
  // want 'off' เคยได้ 'low' เท่ากับ want 'low' เป๊ะ ๆ — ช่อง want จึงไม่เคยมีความหมาย
  // ในขั้นนี้เลย และงานถอดข้อความก็ยังนั่งคิดอยู่ดี (วัดจริง: ocr-assist 35–39 วิ
  // ขณะที่ read-timetable ซึ่งคืน JSON สั้น ๆ ใช้ 9.3 วิ ด้วยรุ่นเดียวกัน)
  // 'minimal' รุ่นไหนไม่รู้จักจะตอบ 400 ที่มีคำว่า thinking — บันไดถอยรับไว้เองอยู่แล้ว
  if (step === 'level') {
    return { thinkingConfig: { thinkingLevel: want === 'off' ? 'minimal' : 'low' } };
  }
  if (step === 'budget') return { thinkingConfig: { thinkingBudget: want === 'off' ? 0 : 512 } };
  return null;                       // ขั้นสุดท้าย: ไม่สั่งอะไรเลย ปล่อยตามค่าเริ่มต้นของรุ่น
}

/** ถอยลงบันไดหนึ่งขั้น — คืน false เมื่อถอยจนสุดแล้ว (แปลว่า 400 ไม่ได้มาจากเรื่องนี้) */
function downgradeThinking(model: string, want: 'low' | 'off') {
  const k = thinkKey(model, want);
  const next = (thinkStep[k] ?? 0) + 1;
  if (next >= THINK_LADDER.length) return false;
  thinkStep[k] = next;
  return true;
}

// ---------- อ่านคำตอบให้ครบทุก part ----------
// **ห้ามกลับไปใช้ parts[0].text** — รุ่นที่คิดก่อนตอบคืนความคิดมาเป็น part ที่มี thought: true
// ปนอยู่กับคำตอบจริง อ่านตัวแรกตัวเดียวจึงได้ครึ่ง ๆ กลาง ๆ หรือได้ความคิดมาแทนคำตอบ
export function geminiPickText(data: unknown): string {
  const parts = (data as { candidates?: Array<{ content?: { parts?: unknown[] } }> })
    ?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !(p as { thought?: boolean })?.thought)
    .map((p) => (p as { text?: string })?.text ?? '')
    .join('');
}

export function geminiFinish(data: unknown): string {
  return String((data as { candidates?: Array<{ finishReason?: string }> })
    ?.candidates?.[0]?.finishReason ?? '');
}

// ---------- จำรุ่นที่ใช้ได้ ----------
// ไล่รุ่นใหม่ทุกคำขอ = จ่ายค่า 404/503 ของรุ่นบนซ้ำ ๆ ทั้งวัน
// จำไว้ทั้งอายุ instance แล้วเอาขึ้นหัวแถว (ไม่ตัดตัวอื่นทิ้ง เผื่อตัวที่จำไว้ล่มทีหลัง)
let workingModel = '';
export function geminiRemember(model: string) { workingModel = model; }
export function geminiOrder(models = GEMINI_MODELS) {
  return workingModel && models.includes(workingModel)
    ? [workingModel, ...models.filter((m) => m !== workingModel)]
    : models.slice();
}

export type GeminiOpts = {
  /** เนื้อคำขอ — ใส่ parts (คำขอเทิร์นเดียว) หรือ contents (มีประวัติการคุย) อย่างใดอย่างหนึ่ง */
  parts?: unknown[];
  contents?: unknown[];
  system?: string;
  temperature?: number;
  /** เพดานนี้ **นับความคิดรวมด้วย** — ตั้งต่ำเมื่อไหร่ ได้คำตอบขาดกลางประโยคเมื่อนั้น */
  maxOutputTokens?: number;
  budgetMs?: number;
  /** เพดานเวลาของ **การยิงหนึ่งครั้ง** (ไม่ใช่ทั้งคำขอ) — กันครั้งที่ค้างไม่ให้กินงบหมด */
  attemptMs?: number;
  /** 'off' = งานถอดข้อความ/คืน JSON ไม่ต้องคิด · 'low' = ตอบคำถามคน คิดนิดเดียวพอ */
  think?: 'low' | 'off';
  models?: string[];
  /** บังคับให้คืน JSON ล้วน */
  json?: boolean;
  /** โครง JSON ที่ต้องการ (ใช้คู่กับ json: true) — Gemini จะคืนตามโครงนี้เป๊ะ ๆ */
  responseSchema?: unknown;
};

/** ขั้นของบันไดการคิดที่รุ่นนี้ยืนอยู่ตอนนี้ */
export function geminiThinkStep(model: string, want: 'low' | 'off' = 'low'): ThinkStep {
  return THINK_LADDER[thinkStep[thinkKey(model, want)] ?? 0];
}

export function geminiBody(model: string, o: GeminiOpts): string {
  const think = thinkingConfig(model, o.think ?? 'low');
  return JSON.stringify({
    ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
    contents: o.contents ?? [{ role: 'user', parts: o.parts ?? [] }],
    generationConfig: {
      temperature: o.temperature ?? 0.6,
      maxOutputTokens: o.maxOutputTokens ?? 4096,
      ...(o.json ? { responseMimeType: 'application/json' } : {}),
      ...(o.responseSchema ? { responseSchema: o.responseSchema } : {}),
      ...(think ?? {}),
    },
  });
}

/** 400 ที่มาจากช่องคุมการคิด ให้ถอยขั้นแล้วบอกผู้เรียกว่าลองรุ่นเดิมซ้ำได้ (ใช้กับสายสตรีม) */
export function geminiThinkingRetry(model: string, body: string, want: 'low' | 'off' = 'low') {
  return /thinking|thought|Unknown name|Invalid JSON payload/i.test(body)
    && downgradeThinking(model, want);
}

export type GeminiResult = {
  text: string;
  model: string;
  finish: string;
  /** คำตอบโดนตัดกลางคันเพราะโทเคนหมด — ผู้เรียกควรบอกผู้ใช้ ไม่ใช่ทำเป็นว่าจบแล้ว */
  truncated: boolean;
  ms: number;
  /** ขั้นของบันไดการคิดที่คำขอนี้ใช้จริง — 'none' แปลว่าถอยจนไม่ได้คุมการคิดแล้ว */
  think: ThinkStep;
};

// ---------- ร่องรอยของคำขอที่ล้ม ----------
// เดิมทีเวลาล้ม ผู้เรียกได้แค่ `new Error('gemini 400')` แล้วส่งเลข 400 ต่อไปหน้าเว็บ
// ซึ่งตอบไม่ได้เลยว่า Google บ่นเรื่องอะไร ลองไปกี่รุ่น และเวลา 45 วินาทีหมดไปกับอะไร
// ข้อความจาก Google อยู่ใน console.warn มาตลอด แต่ถ้าเปิด log ของ Supabase ไม่ได้
// ก็เท่ากับไม่มี — จึงแนบติดตัว error มาด้วย ให้ผู้เรียกเลือกเองว่าจะเปิดให้ใครเห็น
export type GeminiAttempt = {
  model: string;
  /** สถานะ HTTP · 0 = ยิงไม่ถึง/หมดเวลา · 204 = ตอบ 200 แต่ไม่มีเนื้อ */
  status: number;
  ms: number;
  /** ข้อความจาก Google (ตัดแล้ว) หรือเหตุผลที่ยิงไม่ถึง */
  note?: string;
};

export type GeminiError = Error & {
  status?: number;
  /** ข้อความดิบจาก Google ของครั้งสุดท้ายที่ล้ม — **ห้ามส่งให้ผู้ใช้ทั่วไปเห็น** */
  detail?: string;
  /** ทุกครั้งที่ยิง เรียงตามลำดับ — ใช้ตอบว่าเวลาหมดไปกับรุ่นไหน */
  trail?: GeminiAttempt[];
};

/** ย่อ trail ให้อ่านได้ในบรรทัดเดียว: `3.6-flash 400 1.2s · 3.5-flash 400 0.9s` */
export function geminiTrailLine(trail: GeminiAttempt[] = []) {
  return trail
    .map((a) => `${a.model.replace(/^gemini-/, '')} ${a.status} ${(a.ms / 1000).toFixed(1)}s`)
    .join(' · ');
}

/** ยิงจริง ไล่รุ่นตามบันไดถอย + ถอยขั้นการคิดเองเมื่อโดน 400 เรื่องช่องที่ไม่รู้จัก */
export async function geminiGenerate(opts: GeminiOpts): Promise<GeminiResult> {
  if (!GEMINI_KEY) throw new Error('ยังไม่ได้ตั้ง secret GEMINI_API_KEY');

  const models = opts.models ?? geminiOrder();
  const want = opts.think ?? 'low';
  const deadline = Date.now() + (opts.budgetMs ?? 30_000);
  const t0 = Date.now();
  let o = opts;
  let lastStatus = 0;
  let lastDetail = '';
  const trail: GeminiAttempt[] = [];
  let fatal = false;                 // 401/403 = ลองรุ่นอื่นก็เหมือนเดิม หยุดเลย

  for (const model of models) {
    // ลองซ้ำกับรุ่นเดิมได้ไม่เกินจำนวนขั้นของบันไดการคิด (ถอยขั้นแล้วยิงใหม่)
    for (let attempt = 0; attempt < THINK_LADDER.length; attempt++) {
      const left = deadline - Date.now();
      if (left < 4000) break;                    // เหลือน้อยกว่านี้ ยิงไปก็ไม่ทันตอบจบ
      // ให้เวลาต่อหนึ่งครั้งไม่เกิน ATTEMPT_MS — ของเดิมยกงบที่เหลือให้ครั้งเดียวทั้งก้อน
      // ครั้งที่ค้างจึงกลืนงบหมดแล้วบันไดถอยไม่มีเวลาเหลือให้ลองรุ่นสำรองเลยสักรุ่น
      // (วัดจริง: ยิงพลาดสองครั้งแรกใช้ไป 0.2 วิ ครั้งที่สามค้าง 44.8 วิ แล้วจบเห่อ)
      const span = Math.min(left, opts.attemptMs ?? ATTEMPT_MS);
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), span);
      const a0 = Date.now();
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
            body: geminiBody(model, o),
            signal: ctl.signal,
          },
        );
        if (res.ok) {
          const data = await res.json();
          const text = geminiPickText(data).trim();
          const finish = geminiFinish(data);
          if (text) {
            geminiRemember(model);
            return {
              text, model, finish,
              truncated: finish === 'MAX_TOKENS',
              ms: Date.now() - t0,
              think: geminiThinkStep(model, want),
            };
          }
          trail.push({ model, status: 204, ms: Date.now() - a0, note: 'คำตอบว่าง finish=' + finish });
          // ตอบ 200 แต่ไม่มีเนื้อ — สองสาเหตุที่ต้องแยกกัน:
          //   MAX_TOKENS = คิดจนโทเคนหมดก่อนได้เขียนคำตอบ → เลิกคิด เพิ่มเพดาน แล้วลองรุ่นเดิมอีกที
          //   อย่างอื่น   = โดนตัวกรองความปลอดภัย → ลองรุ่นถัดไป
          console.warn('[gemini]', model, 'คำตอบว่าง', finish, JSON.stringify(data).slice(0, 200));
          if (finish === 'MAX_TOKENS' && attempt === 0) {
            thinkStep[thinkKey(model, want)] = THINK_LADDER.indexOf('budget');
            o = { ...o, maxOutputTokens: (o.maxOutputTokens ?? 4096) * 2, think: 'off' };
            continue;
          }
          lastStatus = 204;
          break;
        }
        lastStatus = res.status;
        const body = (await res.text()).slice(0, 500);
        lastDetail = body;
        trail.push({ model, status: res.status, ms: Date.now() - a0, note: body.slice(0, 200) });
        // ข้อความจากฝั่ง Google มีรายละเอียดของโปรเจกต์ปนมาได้ เก็บไว้ใน log ไม่ส่งกลับหน้าเว็บ
        console.warn('[gemini]', model, res.status, body);
        // 400 ที่บ่นเรื่องช่องคุมการคิด = เราสั่งด้วยชื่อช่องที่รุ่นนี้ไม่รู้จัก ไม่ใช่คำขอเสีย
        if (res.status === 400 && geminiThinkingRetry(model, body, want)) continue;
        // 400 ที่เหลือ **ไม่ใช่เรื่องตายตัวของทั้งคำขออีกต่อไป** — ของเดิมถือว่าเป็น
        // "คำขอเสีย ลองรุ่นอื่นก็เหมือนเดิม" แล้วหยุดที่รุ่นแรกทันที ซึ่งผิดกับความจริงที่ว่า
        // ช่องอย่าง responseSchema / thinkingLevel รุ่นหนึ่งรับ อีกรุ่นตอบ 400 ทิ้ง
        // (อาการที่เจอจริง 2 ก.ย. 69: อ่านตารางเรียนกับ OCR ล้ม 400 ทุกครั้งโดยไม่เคยลองรุ่นที่สอง)
        // ปล่อยให้ไถลลงรุ่นถัดไปได้ · ยังคุมด้วย budgetMs เหมือนเดิมจึงไม่บานปลาย
        fatal = res.status === 401 || res.status === 403;
        break;
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        trail.push({ model, status: 0, ms: Date.now() - a0, note: msg.slice(0, 200) });
        if (!lastDetail) lastDetail = msg;
        console.warn('[gemini]', model, msg);
        break;                                   // รุ่นนี้ค้างจนหมดเวลา ไปรุ่นถัดไป
      } finally {
        clearTimeout(timer);
      }
    }
    if (fatal) break;
  }

  const e = new Error('gemini ' + lastStatus) as GeminiError;
  e.status = lastStatus;
  e.detail = lastDetail;
  e.trail = trail;
  throw e;
}
