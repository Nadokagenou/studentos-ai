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

// สถานะที่ "ลองรุ่นถัดไปแล้วอาจรอด" — 400/401/403 คือปัญหาที่กุญแจหรือคำขอ ลองรุ่นอื่นก็เหมือนเดิม
export const RETRY_NEXT_MODEL = new Set([404, 429, 500, 502, 503, 504]);

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

/** ค่า generationConfig ส่วนที่คุมการคิด สำหรับรุ่นนี้ ณ ขั้นบันไดปัจจุบัน */
function thinkingConfig(model: string, want: 'low' | 'off') {
  const step = THINK_LADDER[thinkStep[thinkKey(model, want)] ?? 0];
  if (step === 'level') return { thinkingLevel: 'low' };
  if (step === 'budget') return { thinkingBudget: want === 'off' ? 0 : 512 };
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
  /** 'off' = งานถอดข้อความ/คืน JSON ไม่ต้องคิด · 'low' = ตอบคำถามคน คิดนิดเดียวพอ */
  think?: 'low' | 'off';
  models?: string[];
  /** บังคับให้คืน JSON ล้วน */
  json?: boolean;
  /** โครง JSON ที่ต้องการ (ใช้คู่กับ json: true) — Gemini จะคืนตามโครงนี้เป๊ะ ๆ */
  responseSchema?: unknown;
};

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
};

/** ยิงจริง ไล่รุ่นตามบันไดถอย + ถอยขั้นการคิดเองเมื่อโดน 400 เรื่องช่องที่ไม่รู้จัก */
export async function geminiGenerate(opts: GeminiOpts): Promise<GeminiResult> {
  if (!GEMINI_KEY) throw new Error('ยังไม่ได้ตั้ง secret GEMINI_API_KEY');

  const models = opts.models ?? geminiOrder();
  const want = opts.think ?? 'low';
  const deadline = Date.now() + (opts.budgetMs ?? 30_000);
  const t0 = Date.now();
  let o = opts;
  let lastStatus = 0;
  let fatal = false;                 // 400/401/403 = ลองรุ่นอื่นก็เหมือนเดิม หยุดเลย

  for (const model of models) {
    // ลองซ้ำกับรุ่นเดิมได้ไม่เกินจำนวนขั้นของบันไดการคิด (ถอยขั้นแล้วยิงใหม่)
    for (let attempt = 0; attempt < THINK_LADDER.length; attempt++) {
      const left = deadline - Date.now();
      if (left < 4000) break;                    // เหลือน้อยกว่านี้ ยิงไปก็ไม่ทันตอบจบ
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), left);
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
            return { text, model, finish, truncated: finish === 'MAX_TOKENS', ms: Date.now() - t0 };
          }
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
        const body = (await res.text()).slice(0, 300);
        // ข้อความจากฝั่ง Google มีรายละเอียดของโปรเจกต์ปนมาได้ เก็บไว้ใน log ไม่ส่งกลับหน้าเว็บ
        console.warn('[gemini]', model, res.status, body);
        // 400 ที่บ่นเรื่องช่องคุมการคิด = เราสั่งด้วยชื่อช่องที่รุ่นนี้ไม่รู้จัก ไม่ใช่คำขอเสีย
        if (res.status === 400 && geminiThinkingRetry(model, body, want)) continue;
        fatal = !RETRY_NEXT_MODEL.has(res.status);
        break;
      } catch (e) {
        console.warn('[gemini]', model, (e as Error)?.message ?? e);
        break;                                   // รุ่นนี้ค้างจนหมดเวลา ไปรุ่นถัดไป
      } finally {
        clearTimeout(timer);
      }
    }
    if (fatal) break;
  }

  const e = new Error('gemini ' + lastStatus) as Error & { status?: number };
  e.status = lastStatus;
  throw e;
}
