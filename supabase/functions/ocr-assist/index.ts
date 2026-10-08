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
import { appConfig, num } from '../_shared/appconfig.ts';

const PROVIDER = Deno.env.get('OCR_PROVIDER') ?? 'none';

// รุ่น/ขั้นการคิดของคำขอล่าสุด — โผล่ในคำตอบเฉพาะตอนขอด้วย debug: true
// มีไว้ตอบคำถามเดียว: ที่ช้าอยู่นี่เพราะยังคิดอยู่ หรือเพราะรุ่นมันช้าเอง
let lastShot: { model: string; think: string; ms: number } | null = null;
const MAX_BYTES = Number(Deno.env.get('OCR_MAX_BYTES') ?? 6_000_000);  // ~6MB หลังถอด base64

// ---------- ค่าที่ Control Center ทับได้ ----------
// ค่าเริ่มต้นเป็นของเดิมทุกตัว · อ่านไม่ได้ = ใช้ของเดิม (ดู _shared/appconfig.ts)
// budgetMs เคยเป็น 45 วิฝังในสาย gemini และ 30 วิในสาย gateway — ต่างกันเพราะ
// สองเจ้าตอบไม่เท่ากัน · ค่าที่ตั้งจากหน้าเว็บจึงคูณลงบนอัตราส่วนเดิม ไม่ได้ตั้งทับให้เท่ากัน
const OCR_BUDGET_GEMINI = 45_000;
const OCR_BUDGET_GATEWAY = 30_000;
let ocrBudgetScale = 1;   // ตั้งจาก ocr.timeout (วินาที) เทียบกับ 20 วิที่เป็นค่าเริ่มต้น
let ocrRetries = 1;       // ลองใหม่กี่รอบเมื่อผู้ให้บริการล้ม (ไม่นับรอบแรก)
let ocrAutoRetry = true;

async function loadOcrConfig() {
  const c = await appConfig();
  const secs = num(c.ocr?.timeout, 20, 3, 60);
  ocrBudgetScale = secs / 20;
  ocrRetries = Math.round(num(c.ocr?.retries, 1, 0, 5));
  ocrAutoRetry = c.ocr?.autoRetry !== false;
}

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
// รับ  : { image: <base64 ไม่มีหัว data:>, mime: 'image/jpeg', mode?: 'task', today?: 'YYYY-MM-DD' }
// คืน  : { ok: true, text, conf, provider, ms, task? }   ← task มาเฉพาะ mode: 'task' (ดู OcrTask)
//        { ok: false, code, message }   ← message เป็นภาษาไทย เอาไปโชว์ผู้ใช้ได้เลย
//
// **ห้ามเปลี่ยนรูปคืนค่านี้ตอนเพิ่มผู้ให้บริการ** — ฝั่งแอปอ่านแค่สี่ฟิลด์นี้
// เปลี่ยนเจ้าแล้วแอปต้องไม่ต้องแก้อะไรเลย นั่นคือเหตุผลที่แยกชั้นนี้ออกมา
export type OcrImage = { b64: string; mime: string };
export type OcrResult = { text: string; conf: number };
export type OcrAdapter = (img: OcrImage) => Promise<OcrResult>;

// ---------- โหมด "วิเคราะห์ใบงาน" (mode: 'task') ----------
// คำขอเดิม (ไม่มี mode) ยังได้ข้อความดิบเหมือนเดิมทุกตัวอักษร — แอปรุ่นเก่าที่ยังค้างในเครื่องคนไม่พัง
// โหมดนี้ได้ฟิลด์ `task` เพิ่ม: โมเดล "เข้าใจ" ว่ารูปนี้สั่งอะไร ไม่ใช่แค่ถอดตัวอักษร
//
// ทำไมต้องมี (เจ้าของ 8 ต.ค. 69: "มันอ่านรูปไม่เข้าใจ ต้องมี AI วิเคราะห์ด้วย"):
//   การถอดตัวอักษรอย่างเดียวโยนงานยากที่สุดกลับไปให้ parseAssignment —
//   รูปหน้าหนังสือเต็มหน้า ข้อความถูกต้องทุกตัวก็ยังไม่บอกว่า "งานคืออะไร"
//   ช่องงานที่ต้องทำจึงได้ย่อหน้าทั้งก้อนแทนชื่องานสั้น ๆ ที่ใช้ได้จริง
//
// `text` ยังเป็นถ้อยคำเดิมในรูปเสมอ (ไม่ใช่คำสรุป) — แอปเอาไปให้ parseAssignment
// แกะวันเวลาจากคำของครูเองซ้ำอีกชั้น ตัวแกะนั้นวัดไว้แล้ว 49/49 จึงเชื่อได้มากกว่าการคิดวันของโมเดล
export type OcrTask = {
  kind: 'task' | 'notice' | 'other';
  text: string; title: string; detail: string; subject: string; type: string;
  dueText: string; dueDate: string; dueTime: string;
  teacher: string; score: number; estMin: number; summary: string;
};

// รายชื่อวิชาต้องตรงกับ SUBJECTS ใน alt/engine.js ทุกตัว — แอปรับเฉพาะชื่อในรายการนี้
const TASK_SUBJECTS = ['ฟิสิกส์', 'เคมี', 'ชีววิทยา', 'คณิตศาสตร์', 'ภาษาอังกฤษ', 'ภาษาไทย',
  'สังคมศึกษา', 'วิทยาการคำนวณ', 'วิทยาศาสตร์', 'นาฏศิลป์', 'ศิลปะ', 'หน้าที่พลเมือง',
  'การงานอาชีพ', 'สุขศึกษา/พลศึกษา', 'แนะแนว', 'อื่น ๆ'];

const THAI_DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function taskPrompt(today: string) {
  // วันนี้มาจากเครื่องผู้ใช้ (เขตเวลาไทย) — นาฬิกาเซิร์ฟเวอร์เป็น UTC ผิดวันได้ช่วงตีห้าถึงเจ็ดโมงเช้า
  const d = /^\d{4}-\d{2}-\d{2}$/.test(today) ? new Date(today + 'T12:00:00Z') : new Date();
  const iso = d.toISOString().slice(0, 10);
  return [
    'คุณคือผู้ช่วยของนักเรียนมัธยมไทย ดูรูปนี้ (มักเป็นใบงาน กระดานดำ แชทครู หรือหน้าหนังสือ)',
    'แล้วสรุปว่า "นักเรียนต้องทำอะไร" ตอบเป็น JSON ก้อนเดียวตามโครงนี้ ห้ามมีข้อความอื่น:',
    '{',
    '  "text": "ถ้อยคำในรูปที่เกี่ยวกับงานนี้ คัดตามตัวอักษรเดิม ไม่สรุป ไม่แปล (ไม่เกิน 800 ตัวอักษร)",',
    '  "kind": "task ถ้ามีคำสั่งงาน/การบ้าน/สอบ/กิจกรรม · notice ถ้าเป็นประกาศ · other ถ้าไม่ใช่ทั้งสองอย่าง",',
    '  "title": "ชื่องานสั้น ๆ ภาษาไทย ไม่เกิน 60 ตัวอักษร ขึ้นต้นด้วยสิ่งที่ต้องทำ เช่น ทำใบงานเรื่องเซต ข้อ 1–10",',
    '  "detail": "รายละเอียดที่ต้องรู้ตอนลงมือทำ ไม่เกิน 160 ตัวอักษร (ว่างได้)",',
    `  "subject": "เลือกหนึ่งจาก: ${TASK_SUBJECTS.join(' | ')}",`,
    '  "type": "homework | exam | activity | reminder",',
    '  "dueText": "คำที่บอกกำหนดส่งตามที่เขียนในรูปเป๊ะ ๆ เช่น ส่งวันศุกร์หน้า (ว่างถ้าไม่มี)",',
    '  "dueDate": "YYYY-MM-DD (ค.ศ.) ถ้าคิดได้ ว่างถ้าไม่มีกำหนด",',
    '  "dueTime": "HH:MM แบบ 24 ชม. ว่างถ้าไม่ได้บอกเวลา",',
    '  "teacher": "ชื่อครูถ้ามี",',
    '  "score": "คะแนนเก็บเป็นตัวเลข 0 ถ้าไม่มี",',
    '  "estMin": "นาทีที่นักเรียน ม.ปลายน่าจะใช้ทำ ประมาณจากปริมาณงานจริง",',
    '  "summary": "ประโยคเดียวภาษาไทยบอกว่ารูปนี้คืออะไร"',
    '}',
    `วันนี้คือวัน${THAI_DOW[d.getUTCDay()]}ที่ ${iso} — ใช้คิด dueDate จากคำอย่าง "พรุ่งนี้" "ศุกร์หน้า"`,
    'ปีในรูปมักเป็น พ.ศ. (เช่น 2569 หรือ 69) ต้องแปลงเป็น ค.ศ. ก่อนใส่ dueDate',
    'ห้ามแต่งข้อมูลที่ไม่มีในรูป ช่องที่ไม่รู้ให้ว่าง หรือ 0',
    'ถ้าเป็นหน้าหนังสือหรือบทความที่ไม่มีคำสั่ง ให้ kind = other และ title เป็น "อ่าน" ตามด้วยหัวเรื่อง',
  ].join('\n');
}

// แกะ JSON ที่โมเดลคืนมา — บางรุ่นห่อด้วย ``` ทั้งที่สั่ง JSON ล้วนแล้ว
function readTask(raw: string): OcrTask | null {
  const s = String(raw || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  let o: Record<string, unknown>;
  try { o = JSON.parse(s); } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { o = JSON.parse(m[0]); } catch { return null; }
  }
  if (!o || typeof o !== 'object') return null;
  const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
  const int = (v: unknown, hi: number) => {
    const x = Math.round(Number(String(v ?? '').replace(/[^\d.]/g, '')));
    return isFinite(x) && x > 0 ? Math.min(hi, x) : 0;
  };
  const kind = ['task', 'notice', 'other'].includes(String(o.kind)) ? o.kind as OcrTask['kind'] : 'task';
  const type = ['homework', 'exam', 'activity', 'reminder'].includes(String(o.type)) ? String(o.type) : 'homework';
  const subject = TASK_SUBJECTS.includes(String(o.subject)) ? String(o.subject) : 'อื่น ๆ';
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(o.dueDate)) ? String(o.dueDate) : '';
  const dueTime = /^\d{1,2}:\d{2}$/.test(String(o.dueTime)) ? String(o.dueTime).padStart(5, '0') : '';
  return {
    kind, type, subject, dueDate, dueTime,
    text: str(o.text, 1200), title: str(o.title, 80), detail: str(o.detail, 200),
    dueText: str(o.dueText, 80), teacher: str(o.teacher, 40),
    score: int(o.score, 100), estMin: int(o.estMin, 600), summary: str(o.summary, 160),
  };
}

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

// ---------- ผู้ให้บริการสำหรับโหมดวิเคราะห์ ----------
// แยกตารางจาก ADAPTERS เพราะคำสั่งกับรูปคำตอบคนละแบบ — แต่ใช้ผู้ให้บริการตัวเดียวกัน (OCR_PROVIDER)
// คืนข้อความดิบที่โมเดลตอบ ให้ readTask แกะเป็นชั้นเดียว ทุกเจ้าจะได้ผ่านการตรวจชุดเดียวกัน
type TaskAdapter = (img: OcrImage, prompt: string) => Promise<{ raw: string; truncated: boolean }>;

const TASK_ADAPTERS: Record<string, TaskAdapter> = {
  mock: async () => ({
    raw: JSON.stringify({
      text: '[mock] ใบงานคณิต เรื่องเซต ข้อ 1-10 ส่งศุกร์หน้า', kind: 'task',
      title: 'ทำใบงานคณิต เรื่องเซต ข้อ 1–10', detail: '', subject: 'คณิตศาสตร์', type: 'homework',
      dueText: 'ส่งศุกร์หน้า', dueDate: '', dueTime: '', teacher: '', score: 0, estMin: 40,
      summary: '[mock] สายไฟครบ — ยังไม่ได้ยิงโมเดลจริง',
    }),
    truncated: false,
  }),

  gemini: async (img, prompt) => {
    const r = await geminiGenerate({
      parts: [{ text: prompt }, { inline_data: { mime_type: img.mime, data: img.b64 } }],
      temperature: 0,
      // ต้องตีความ "ศุกร์หน้า" เป็นวันที่ กับประเมินเวลาจากปริมาณงาน — คิดนิดเดียวพอ
      // งบโทเคนจึงเผื่อให้ความคิดด้วย (เพดานนับความคิดรวม ตั้งต่ำ = JSON ขาดกลางก้อน)
      think: 'low',
      json: true,
      maxOutputTokens: 6144,
      budgetMs: Math.round(OCR_BUDGET_GEMINI * ocrBudgetScale),
    });
    lastShot = { model: r.model, think: r.think, ms: r.ms };
    return { raw: r.text, truncated: r.truncated };
  },

  gateway: async (img, prompt) => {
    const raw = await chat({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUri(img.mime, img.b64) } },
        ],
      }],
      temperature: 0,
      json: true,
      maxTokens: 2500,
      timeoutMs: Math.round(OCR_BUDGET_GATEWAY * ocrBudgetScale),
    });
    return { raw, truncated: false };
  },
};

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
      budgetMs: Math.round(OCR_BUDGET_GEMINI * ocrBudgetScale),
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
      timeoutMs: Math.round(OCR_BUDGET_GATEWAY * ocrBudgetScale),  // อ่านรูปช้ากว่าตอบข้อความมาก
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

  // เพดานเวลา/จำนวนรอบที่เจ้าของระบบตั้งไว้ · แคช 60 วิ · ล้มเหลว = ใช้ค่าเดิม
  await loadOcrConfig();

  let body: { image?: string; mime?: string; debug?: boolean; mode?: string; today?: string };
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
    // ---------- ลองใหม่เมื่อผู้ให้บริการล้ม ----------
    // จำนวนรอบมาจาก Control Center (ค่าเริ่มต้น 1 = ลองซ้ำอีกครั้งเดียว)
    //
    // ลองซ้ำเฉพาะตอน "ล้ม" เท่านั้น ไม่ใช่ตอนอ่านได้แต่ได้ข้อความน้อย —
    // รูปที่เบลอจริงจะเบลอเท่าเดิมทุกรอบ การยิงซ้ำจึงเผาโควตาฟรีโดยไม่มีทางได้ผลต่าง
    // (ฝั่งแอปมีชั้นลองรูปหลายแบบของตัวเองอยู่แล้ว ดู ocrTextScore ใน app.js)
    //
    // **ไม่ยืดเวลารวมตามจำนวนรอบ** — แต่ละรอบมีงบของตัวเองเท่าเดิม เพราะ platform
    // ตัดที่ ~150 วิ ตั้ง 5 รอบ × 45 วิ = โดนตัดกลางรอบที่สามโดยไม่มีอะไรบอก
    const tries = ocrAutoRetry ? ocrRetries + 1 : 1;
    const img = { b64, mime: body.mime || 'image/jpeg' };
    // โหมดวิเคราะห์: JSON ที่แกะไม่ออกนับเป็น "ล้ม" ให้ลองรอบใหม่ได้ (โมเดลตอบไม่เหมือนเดิมทุกรอบ)
    // ส่วนรอบที่ได้ JSON ครบแล้วแต่ไม่เจองาน ไม่ใช่ความล้มเหลว — รูปนั้นไม่มีงานจริง ๆ
    const taskAdapter = body.mode === 'task' ? TASK_ADAPTERS[PROVIDER] : undefined;
    const runOnce = async (): Promise<OcrResult & { task?: OcrTask }> => {
      if (!taskAdapter) return adapter(img);
      const out = await taskAdapter(img, taskPrompt(String(body.today ?? '')));
      const task = readTask(out.raw);
      if (!task) throw Object.assign(new Error('อ่าน JSON ของโมเดลไม่ออก'), { detail: out.raw.slice(0, 300) });
      // ไม่มีเลขความมั่นใจจากโมเดล — ใช้เกณฑ์เดียวกับโหมดข้อความ: ครบ 90 · โดนตัด 55
      return { text: task.text, conf: out.truncated ? 55 : 90, task };
    };
    let last: unknown = null;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await runOnce();
        return json({
          ok: true,
          text: r.text ?? '',
          conf: Math.max(0, Math.min(100, Math.round(r.conf ?? 0))),
          provider: PROVIDER,
          ms: Date.now() - t0,
          ...(r.task ? { task: r.task } : {}),
          ...(i > 0 ? { retried: i } : {}),
          ...(body.debug === true && lastShot ? { shot: lastShot } : {}),
        });
      } catch (e) {
        last = e;
        // เหลือเวลาไม่พอให้อีกรอบจบ = เลิกลองดีกว่าโดน platform ตัดกลางคัน
        if (Date.now() - t0 > 90_000) break;
      }
    }
    throw last;
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
