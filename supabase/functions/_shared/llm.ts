// Student OS — สายเดียวสำหรับคุยกับ LLM ที่พูดภาษา OpenAI (/v1/chat/completions)
// ============================================================
// ทำไมต้องมีไฟล์นี้: gateway ที่ไม่ใช่ Google (เช่น gateway.9arm.co) พูดคนละภาษากับ
// Gemini ทั้งรูป request และรูป response — จะก๊อปโค้ดยิงไปวางซ้ำในทุกฟังก์ชันก็ได้
// แต่วันที่ endpoint เปลี่ยนจะต้องไล่แก้สี่ที่ และที่ลืมไปหนึ่งที่คือที่ที่พังเงียบ ๆ
//
// secret ที่ต้องตั้งใน Supabase (Edge Functions → Secrets):
//    LLM_BASE_URL = https://gateway.9arm.co/v1     ← ลงท้าย /v1 ไม่ต้องมี /chat/completions
//    LLM_API_KEY  = sk-...
//    LLM_MODEL    = qwen3.8-27b-fp8
// ครบสามดอกเมื่อไหร่ ฟังก์ชันที่รองรับจะเปลี่ยนมาใช้เจ้านี้แทน Gemini เอง
// ============================================================

export const LLM_BASE_URL = (Deno.env.get('LLM_BASE_URL') ?? '').replace(/\/+$/, '');
export const LLM_API_KEY = Deno.env.get('LLM_API_KEY') ?? '';
export const LLM_MODEL = Deno.env.get('LLM_MODEL') ?? '';

// ตั้งครบสามดอกถึงจะนับว่าพร้อม — ขาดดอกใดดอกหนึ่งแล้วยิงไป จะได้ 401/404
// ที่หน้าตาเหมือน "เน็ตล่ม" มากกว่า "ติดตั้งไม่ครบ" ซึ่งหลอกคนแก้ไปได้ไกลมาก
export const llmReady = () => Boolean(LLM_BASE_URL && LLM_API_KEY && LLM_MODEL);

// ---------- ปิดโหมดคิดก่อนตอบ ----------
// qwen3 ใช้เวลาเกือบทั้งหมดไปกับการคิด แล้วค่อยเขียนคำตอบตอนท้าย
// วัดจริงกับคำถามของนักเรียน: คิด 24 วินาที เขียนคำตอบอีก 2 วินาที
// ผู้ใช้จึงนั่งมองจอนิ่ง ๆ 24 วินาทีเพื่อคำตอบ 3 บรรทัด ซึ่งไม่คุ้มกันเลย
//
// สั่งสองทางเพราะไม่มีทางไหนที่ได้ผลกับทุก gateway:
//   chat_template_kwargs  — ทางที่ถูกต้อง แต่ gateway ต้องยอมส่งต่อให้ backend
//   /no_think             — โทเคนที่ตัวโมเดลรู้จักเอง ใช้ได้แม้ gateway ไม่ส่งต่ออะไรเลย
// ตัวไหนไม่ถูกรองรับจะถูกเมินเฉย ๆ ไม่ทำให้คำขอพัง
const NO_THINK_TOKEN = ' /no_think';

function applyNoThink(messages: ChatMsg[]): ChatMsg[] {
  const out = messages.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m.role !== 'user' || typeof m.content !== 'string') continue;
    out[i] = { ...m, content: m.content + NO_THINK_TOKEN };
    break;
  }
  return out;
}

export type ChatMsg = {
  role: 'system' | 'user' | 'assistant';
  // string ธรรมดา = ข้อความล้วน · array = ข้อความปนรูป (ต้องเป็นรุ่นที่ดูรูปได้)
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
};

export type ChatOpts = {
  messages: ChatMsg[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** บังคับให้คืน JSON ล้วน — gateway บางเจ้าไม่รองรับ ถ้าไม่รองรับจะโดนเมิน ไม่ถึงกับพัง */
  json?: boolean;
  /** สั่งให้เลิก "คิดก่อนตอบ" — ดู noThinkBody() ว่าทำไมต้องสั่งสองทาง */
  noThink?: boolean;
};

/** ยิงหนึ่งครั้ง คืนข้อความล้วน — โยน Error พร้อม .status เมื่อปลายทางตอบไม่ผ่าน */
export async function chat(opts: ChatOpts): Promise<string> {
  if (!llmReady()) {
    throw new Error('ยังตั้ง secret ไม่ครบ (ต้องมี LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)');
  }

  // ทุกที่ที่เรียกใช้มีคนรออยู่ปลายทาง (คนพิมพ์ในแอป หรือ LINE ที่รอ webhook)
  // ปล่อยให้ค้างยาวคือพังในสายตาผู้ใช้อยู่ดี ตัดเองดีกว่าให้คนอื่นตัด
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 20000);

  try {
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      signal: ctl.signal,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: opts.noThink ? applyNoThink(opts.messages) : opts.messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 700,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        ...(opts.noThink ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      }),
    });

    if (!res.ok) {
      // ข้อความ error จาก gateway มีชื่อโปรเจกต์/ชื่อรุ่นปนมาได้ เก็บลง log ไม่ส่งกลับหน้าเว็บ
      const detail = (await res.text()).slice(0, 300);
      console.warn('[llm]', res.status, detail);
      const e = new Error('llm ' + res.status) as Error & { status?: number };
      e.status = res.status;
      throw e;
    }

    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const finish = data?.choices?.[0]?.finish_reason;

    // รุ่นตระกูล "คิดก่อนตอบ" (qwen3 ฯลฯ) พ่นความคิดออกมาด้วย บาง gateway แยกไว้
    // คนละช่อง (reasoning_content) บาง gateway ยัดมาใน content คาแท็ก <think>
    // ถ้าปล่อยผ่าน ผู้ใช้จะเห็นบอทคิดดัง ๆ ทั้งย่อหน้าก่อนถึงคำตอบจริง
    const text = String(msg?.content ?? '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^[\s\S]*?<\/think>/i, '')   // เปิดแท็กหายแต่ปิดมา = ข้างหน้าคือความคิดล้วน
      .trim();

    if (finish && finish !== 'stop') console.warn('[llm] finish_reason =', finish);

    // ได้ความคิดมาแต่ไม่ได้คำตอบ = คิดเพลินจนโทเคนหมดก่อนเขียนคำตอบจริง
    // เกิดบ่อยเวลา context ยาว และเป็นสาเหตุที่คำถามยาก ๆ ล้มแบบสุ่มทั้งที่คำถามสั้นผ่านตลอด
    // บอกให้ชัดใน log จะได้ไม่ไปไล่หาที่กุญแจหรือเน็ตอีก
    if (!text) {
      const thought = String((msg as { reasoning_content?: string })?.reasoning_content ?? '');
      if (thought) console.warn('[llm] ได้แต่ความคิด ไม่ได้คำตอบ — โทเคนหมดกลางทาง', finish);
      throw new Error('คำตอบว่าง');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** แปลง base64 + mime เป็น data URI ตามรูปที่ฝั่ง OpenAI รับ */
export const dataUri = (mime: string, b64: string) => `data:${mime};base64,${b64}`;

/** ถามว่ากุญแจดอกนี้เรียกรุ่นไหนได้บ้าง — ไม่ต้องเดาชื่อรุ่นเองตอนติดตั้ง
 *  ไม่กินโควตาการตอบ และไม่เคยพ่นค่ากุญแจออกมา (ชื่อรุ่นล้วน ๆ) */
export async function listModels(): Promise<string[]> {
  if (!llmReady()) throw new Error('ยังตั้ง secret ไม่ครบ');
  const res = await fetch(`${LLM_BASE_URL}/models`, {
    headers: { 'Authorization': `Bearer ${LLM_API_KEY}` },
  });
  if (!res.ok) {
    const e = new Error('models ' + res.status) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }
  const d = await res.json();
  return (d?.data ?? []).map((m: { id?: string }) => String(m?.id ?? '')).filter(Boolean);
}

/** เหมือน chat() แต่ส่งคำตอบออกมาทีละชิ้นระหว่างที่โมเดลยังเขียนไม่จบ
 *  ------------------------------------------------------------------
 *  ทำไมต้องมี: รุ่นนี้ใช้เวลา 10-30 วินาทีกว่าจะเขียนจบ และการรอหน้าจอนิ่ง ๆ
 *  20 วินาทีคือจุดที่คนกดออกจากแอป ทั้งที่คำแรกพร้อมส่งตั้งแต่วินาทีที่สาม
 *
 *  ส่วนที่โมเดล "คิด" ถูกกรองทิ้งระหว่างทาง ไม่ปล่อยให้ไหลถึงผู้ใช้ —
 *  คนอ่านต้องเห็นคำตอบ ไม่ใช่เห็นมันคิดดัง ๆ */
export async function* chatStream(opts: ChatOpts): AsyncGenerator<string> {
  if (!llmReady()) throw new Error('ยังตั้ง secret ไม่ครบ');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 40000);

  try {
    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      signal: ctl.signal,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: opts.noThink ? applyNoThink(opts.messages) : opts.messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 700,
        stream: true,
        ...(opts.noThink ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      }),
    });

    if (!res.ok || !res.body) {
      const detail = res.body ? (await res.text()).slice(0, 300) : '';
      console.warn('[llm:stream]', res.status, detail);
      const e = new Error('llm ' + res.status) as Error & { status?: number };
      e.status = res.status;
      throw e;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';        // ชิ้นที่อ่านมาอาจขาดกลางบรรทัด ต้องพักไว้จนจบบรรทัด
    let sent = false;    // เคยส่งอะไรออกไปแล้วหรือยัง — ใช้ตัดสินว่าคำตอบว่างจริงไหม
    let inThink = false; // อยู่กลางก้อน <think> อยู่หรือเปล่า

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') continue;

        let piece = '';
        try { piece = JSON.parse(payload)?.choices?.[0]?.delta?.content ?? ''; }
        catch { continue; }
        if (!piece) continue;

        // แท็กคิดมาเป็นชิ้น ๆ ไม่ใช่ก้อนเดียว จึงต้องจำสถานะข้ามรอบ
        // ไม่งั้นครึ่งแรกของความคิดจะหลุดออกจอไปก่อนที่จะเจอแท็กปิด
        let out = '';
        for (const tok of piece.split(/(<think>|<\/think>)/i)) {
          if (/^<think>$/i.test(tok)) { inThink = true; continue; }
          if (/^<\/think>$/i.test(tok)) { inThink = false; continue; }
          if (!inThink) out += tok;
        }

        if (out) { sent = true; yield out; }
      }
    }

    if (!sent) throw new Error('คำตอบว่าง');
  } finally {
    clearTimeout(timer);
  }
}
