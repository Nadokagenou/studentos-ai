// ============================================================
// students OS — read-timetable
// ------------------------------------------------------------
// รับรูปตารางเรียน คืนคาบเรียนเป็น JSON ให้แอปเอาไปเติมลง "บริบทของฉัน"
//
// ทำไมต้องมีฟังก์ชันนี้ ทั้งที่แอปมี OCR ในเครื่องอยู่แล้ว:
//   Tesseract อ่านใบงานที่เป็นบรรทัด ๆ ได้ดี แต่ตารางเรียนเป็นกริด —
//   มีช่องรวม หัวคอลัมน์แนวตั้ง เส้นตาราง และคาบที่กินสองช่อง
//   OCR คืนข้อความมาเป็นกองโดยไม่รู้ว่าคำไหนอยู่ช่องไหน ซึ่งใช้ต่อไม่ได้เลย
//   งานนี้ต้องการโมเดลที่ "เห็น" ตำแหน่งในภาพ ไม่ใช่แค่แปลงภาพเป็นตัวอักษร
//
// ทำไมกุญแจต้องอยู่ที่นี่ ไม่ใช่ในเบราว์เซอร์:
//   API key ที่ส่งไปถึงหน้าเว็บคือ API key ที่หลุดแล้ว ใครเปิด devtools ก็ก๊อปไปใช้ได้
//   ฟังก์ชันนี้จึงเป็นด่านเดียวที่รู้จักกุญแจ และเปิดให้เฉพาะคนที่ล็อกอินแล้วเรียก
//   (verify_jwt = true ใน config.toml — ถ้าปิด มันจะกลายเป็นพร็อกซีฟรีให้คนทั้งอินเทอร์เน็ต
//   ยิง Gemini ด้วยโควตาของเรา ซึ่งรู้ตัวอีกทีตอนโควตาหมดแล้ว)
//
// secret ที่ต้องตั้งใน Supabase → Edge Functions → Secrets:
//    GEMINI_API_KEY   (บังคับ)
//    GEMINI_MODEL     (ไม่บังคับ — ไว้เปลี่ยนรุ่นโมเดลโดยไม่ต้อง deploy ใหม่)
//
// ฟังก์ชันนี้ไม่เก็บรูปไว้ที่ไหนทั้งสิ้น ไม่เขียนลงฐานข้อมูลสักแถว
// รูปเข้ามา → ส่งต่อ → คืนผล → จบ ผู้ใช้ต้องกดยืนยันในแอปเองก่อนถึงจะถูกบันทึก
// ============================================================

const API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

// รูปจากกล้องมือถือปัจจุบันอยู่ราว 2–5 MB ฝั่งแอปย่อให้เหลือหลักร้อย KB ก่อนส่งอยู่แล้ว
// เพดานนี้จึงไม่ได้ไว้กันผู้ใช้ปกติ แต่กันคนที่ยิงไฟล์ใหญ่ ๆ ใส่เพื่อเผาโควตา
const MAX_B64 = 6_000_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// คำสั่งถึงโมเดล — เขียนเป็นกฎสั้น ๆ ที่ตรวจได้ ไม่ใช่ย่อหน้าอธิบายความ
// ข้อที่สำคัญที่สุดคือข้อสุดท้าย: อ่านไม่ออกให้ข้าม ห้ามเดา
// คาบเรียนที่ถูกเดาขึ้นมาจะไปโผล่เป็น "เวลาที่ไม่ว่าง" ในแผนของเด็กทุกสัปดาห์
// ผิดแบบขาดไปหนึ่งคาบ ผู้ใช้เห็นแล้วเติมเองได้ · ผิดแบบเกินมาหนึ่งคาบ เขาไม่มีทางรู้
const PROMPT = `รูปนี้คือตารางเรียนของนักเรียนไทย อ่านแล้วคืนคาบเรียนทั้งหมดที่เห็น

กติกา:
- day: 0=อาทิตย์ 1=จันทร์ 2=อังคาร 3=พุธ 4=พฤหัสบดี 5=ศุกร์ 6=เสาร์
- start/end: รูปแบบ HH:MM แบบ 24 ชั่วโมงเท่านั้น เช่น 08:20
- subject: ชื่อวิชาตามที่เขียนในตาราง ถ้ามีทั้งรหัสวิชาและชื่อ ให้เอาชื่อ
- คาบที่กินหลายช่องติดกัน รวมเป็นคาบเดียวที่ยาวขึ้น
- ช่องพักกลางวัน/พักเบรก/กิจกรรมหน้าเสาธง ใส่มาด้วย ใช้ชื่อตามที่เขียน
- ช่องว่าง ช่องคาบว่าง หรือช่องที่อ่านไม่ออก ให้ข้ามไป ห้ามเดาขึ้นมาเอง
- ถ้ารูปไม่ใช่ตารางเรียน ให้คืน classes เป็นลิสต์ว่าง แล้วบอกเหตุผลสั้น ๆ ใน note`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    classes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          subject: { type: 'STRING' },
          day: { type: 'INTEGER' },
          start: { type: 'STRING' },
          end: { type: 'STRING' },
        },
        required: ['subject', 'day', 'start', 'end'],
      },
    },
    note: { type: 'STRING' },
  },
  required: ['classes'],
};

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function toMin(s: string): number | null {
  const m = HHMM.exec(String(s ?? '').trim());
  return m ? +m[1] * 60 + +m[2] : null;
}
function pad(v: number): string {
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
}

// กรองผลของโมเดลอีกชั้นก่อนส่งกลับ — โมเดลทำตาม schema เรื่องชนิดข้อมูลได้
// แต่ไม่มีอะไรรับประกันว่าค่าจะสมเหตุสมผล ("25:70" ยังเป็น STRING ที่ถูกต้องอยู่ดี)
// ฝั่งแอปก็ตรวจอีกรอบ แต่ของเสียไม่ควรออกจากที่นี่ตั้งแต่แรก
function clean(rows: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const r of rows.slice(0, 120)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const a = toMin(o.start as string), b = toMin(o.end as string);
    const day = Number(o.day);
    const subject = String(o.subject ?? '').trim().slice(0, 40);
    if (a == null || b == null || b <= a) continue;          // ข้ามเที่ยงคืนไม่มีในตารางเรียน
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!subject) continue;
    out.push({ subject, day, start: pad(a), end: pad(b) });
  }
  // เรียงตามวันแล้วตามเวลา — หน้าตรวจจะได้อ่านไล่ลงมาเหมือนตารางจริง
  return out.sort((x, y) => (x.day as number) - (y.day as number) ||
    toMin(x.start as string)! - toMin(y.start as string)!);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'ต้องเรียกด้วย POST' }, 405);
  // บอกชื่อ secret ที่ขาดไปตรง ๆ — ตอนติดตั้งจริงนี่คือข้อผิดพลาดที่เจอบ่อยที่สุด
  // และถ้าไม่บอก มันจะพังเป็น 500 เปล่า ๆ ที่ไม่ได้ชี้ว่าต้องไปแก้ตรงไหน
  if (!API_KEY) return json({ error: 'ยังไม่ได้ตั้ง secret ชื่อ GEMINI_API_KEY' }, 500);

  let image = '', mime = 'image/jpeg';
  try {
    const body = await req.json();
    image = String(body?.image ?? '');
    if (body?.mime) mime = String(body.mime);
  } catch { return json({ error: 'อ่าน body ไม่ได้' }, 400); }

  if (!image) return json({ error: 'ไม่มีรูปมาด้วย' }, 400);
  if (image.length > MAX_B64) return json({ error: 'รูปใหญ่เกินไป' }, 413);
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return json({ error: 'รองรับเฉพาะ JPEG/PNG/WebP' }, 415);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: image } }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          temperature: 0,          // งานอ่านตาราง ไม่ใช่งานแต่งเรื่อง
        },
      }),
    });
  } catch (e) {
    return json({ error: 'ต่อ Gemini ไม่ได้: ' + (e as Error).message }, 502);
  }

  if (!res.ok) {
    // ข้อความจากฝั่ง Google อาจมีรายละเอียดของโปรเจกต์ปนมา ตัดให้สั้นและไม่ส่งทั้งก้อนกลับ
    const detail = (await res.text()).slice(0, 200);
    console.warn('[read-timetable] gemini error', res.status, detail);
    return json({ error: res.status === 429
      ? 'โควตา Gemini เต็มชั่วคราว ลองใหม่อีกสักครู่'
      : 'Gemini ตอบกลับมาเป็นข้อผิดพลาด (' + res.status + ')' }, 502);
  }

  let parsed: { classes?: unknown; note?: unknown } = {};
  try {
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    parsed = JSON.parse(text);
  } catch (e) {
    console.warn('[read-timetable] parse failed', (e as Error).message);
    return json({ error: 'อ่านคำตอบของ Gemini ไม่ออก ลองถ่ายใหม่ให้ชัดขึ้น' }, 502);
  }

  const classes = clean(parsed.classes);
  return json({ classes, note: String(parsed.note ?? '').slice(0, 200) });
});
