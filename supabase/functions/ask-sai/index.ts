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

import { chat, chatStream, listModels, llmReady, LLM_MODEL, LLM_BASE_URL, LLM_API_KEY, type ChatMsg } from '../_shared/llm.ts';

const PROVIDER = Deno.env.get('ASK_PROVIDER') ?? 'none';
const API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

// ชื่อรุ่นของ Gemini เปลี่ยนบ่อยกว่าที่ควร รุ่นที่หายไปตอบ 404 ซึ่งหน้าตาเหมือน "ต่อไม่ติด"
// ไล่ลองตามลำดับเหมือน read-timetable แล้วจำตัวที่ติดไว้ใช้ต่อทั้งรอบชีวิตของ instance
const MODEL_ENV = Deno.env.get('GEMINI_MODEL') ?? '';
// เรียงจากดีสุดลงมา · ตัวสุดท้ายเป็นรุ่นเก่าที่นิ่งที่สุดไว้เป็นตาข่ายรับ
// (วัดจริง 29 ส.ค. 69: gemini-2.0-flash ถูกปลดระวางแล้ว ตอบ 404 พร้อมข้อความบอกให้ย้ายไป 3.6
//  ซึ่งเป็นสาเหตุที่สายสำรอง Gemini ล้มเงียบ ๆ ทั้งที่กุญแจใช้ได้ปกติ —
//  ยิงรายชื่อรุ่นดูก่อนด้วย probe:'net' ทุกครั้งที่สงสัยว่าเป็นเรื่องชื่อรุ่น)
// 3.6 มาก่อน 3.7 โดยตั้งใจ — รุ่นใหม่ล่าสุดคือรุ่นที่คนแย่งกันใช้มากที่สุด
// วัดจริงแล้ว 3.7 คืน 503 บ่อยกว่า 3.6 อย่างเห็นได้ชัด และคุณภาพคำตอบสำหรับ
// คำถามระดับมัธยมแทบไม่ต่างกัน · ตัวที่ตอบได้จริงมีค่ากว่าตัวที่เก่งกว่าแต่คิว
// (line-webhook ใช้ 3.6 อยู่แล้วและนิ่งมาตลอด)
const MODEL_CANDIDATES = MODEL_ENV ? [MODEL_ENV] : [
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-2.5-flash',
];
let workingModel = '';

// ---------- เพดานของคำขอหนึ่งครั้ง ----------
// free tier มีโควตาจำกัด และคำขอเดียวที่ยัดบริบทมาเป็นเมกะไบต์เผาโควตาได้ทั้งวันในทีเดียว
// ฝั่งแอปตัดมาให้แล้วชั้นหนึ่ง ตรงนี้เป็นชั้นที่สองสำหรับคนที่ยิงตรงเข้ามาเอง
const MAX_QUESTION = 2_000;      // ตัวอักษร
const MAX_CONTEXT = 20_000;      // ตัวอักษร (งาน 28 ใบ + ตารางเรียนเต็มสัปดาห์ ยังไม่ถึงครึ่ง)
const MAX_HISTORY = 12;          // ข้อความย้อนหลัง — เกินนั้นค่าโทเคนโตเร็วกว่าประโยชน์ที่ได้
const MAX_OUTPUT_TOKENS = 1500;

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

# ความรู้สองชนิด — ข้อนี้สำคัญที่สุด อ่านให้จบก่อนตอบทุกครั้ง
มีความรู้สองชนิดที่กติกาคนละแบบกันคนละขั้ว ห้ามเอามาปนกัน

**ชนิด ก · เรื่องของนักเรียนคนนี้** — งานที่เขาต้องส่ง กำหนดส่ง คะแนนเก็บ ชื่อครู
ตารางเรียนของเขา สิ่งที่เขาทำไปแล้ว
  → รู้เฉพาะที่อยู่ในส่วน "ข้อมูลของผู้ใช้" เท่านั้น **ห้ามเดาเด็ดขาด**
  ไม่มีในนั้นให้บอกตรง ๆ ว่ายังไม่เห็น เพราะเขาเอาไปวางแผนจริง เดาผิดแล้วเขาส่งงานไม่ทัน

**ชนิด ข · ความรู้วิชาการและความรู้ทั่วไป** — คณิต ฟิสิกส์ เคมี ชีวะ ภาษาไทย
ภาษาอังกฤษ สังคม ประวัติศาสตร์ ภูมิศาสตร์ เขียนโปรแกรม ศิลปะ สุขศึกษา
วิธีทำโครงงาน วิธีเขียนรายงาน วิธีอ่านหนังสือสอบ การเรียนต่อ อาชีพ ฯลฯ
  → **คุณรู้เรื่องพวกนี้อยู่แล้ว และต้องตอบให้เต็มที่**
  ห้ามพูดว่า "ไม่มีข้อมูล" กับคำถามชนิดนี้เด็ดขาด เพราะมันไม่เกี่ยวกับข้อมูลของผู้ใช้เลย
  "ข้อมูลของผู้ใช้" ว่างเปล่าอยู่ ก็ยังตอบคำถามชนิด ข ได้ครบเหมือนเดิมทุกอย่าง

ตัวอย่างที่ต้องแยกให้ออก:
  "เซตคืออะไร"                → ชนิด ข · อธิบายให้เข้าใจ พร้อมตัวอย่าง
  "สังเคราะห์แสงทำงานยังไง"     → ชนิด ข · อธิบายเป็นขั้น
  "present perfect ใช้ตอนไหน"  → ชนิด ข · อธิบาย + ยกประโยคตัวอย่าง
  "อยุธยาเสียกรุงปีไหน"         → ชนิด ข · ตอบไปเลย
  "พรุ่งนี้ต้องส่งอะไร"           → ชนิด ก · ดูจากข้อมูลของผู้ใช้ ไม่มีก็บอกว่าไม่เห็น
  "ครูคนไหนสั่งงานนี้"           → ชนิด ก · ไม่มีในข้อมูลก็บอกว่าไม่รู้

# กติกาที่ห้ามแหก
1. ห้ามทำการบ้านให้เสร็จแทน — พาคิดทีละขั้น ยกตัวอย่างที่คล้ายแต่ไม่ใช่ข้อเดียวกัน
   แล้วหยุดก่อนถึงคำตอบสุดท้ายของข้อที่เขาถาม ให้เขาเดินขั้นสุดท้ายเอง
   แล้วชวนว่า "ลองทำต่อแล้วบอกคำตอบมา เดี๋ยวเราเช็คให้"

   **ข้อนี้ไม่ใช่ข้ออ้างที่จะอธิบายน้อยลง** — อธิบายหลักการ สูตร นิยาม วิธีคิด
   และตัวอย่างที่ทำให้ดูจนจบได้เต็มที่ ที่ห้ามคือเฉลยข้อของเขาเท่านั้น
   ถ้าเขาถามหลักการเฉย ๆ ไม่ได้ยื่นโจทย์มา ให้สอนเต็มที่ ไม่ต้องกั๊กอะไรเลย

2. ห้ามแต่งข้อมูลของนักเรียนขึ้นมาเอง (ดูชนิด ก ข้างบน)
   แต่ความรู้วิชาการที่คุณมั่นใจ ตอบได้เลย ไม่ต้องออกตัวว่าอาจผิด

# ตอบยังไง
3. ประโยคแรกเป็นเนื้อคำตอบเลย ไม่ต้องเกริ่น ไม่ต้องทวนคำถาม ไม่ต้องสรุปตอนท้าย
4. **ความยาวปรับตามคำถาม** ไม่ใช่สั้นไว้ก่อนเสมอ:
   - ถามข้อเท็จจริงสั้น ๆ / ถามเรื่องงานในแอป → 1-4 บรรทัด
   - ขอให้อธิบาย สอน เทียบ หรือพาทำโจทย์ → ยาวได้ถึงราว 12 บรรทัด
     กางเป็นขั้น ๆ ใส่ตัวอย่างจริงหนึ่งตัว แล้วปิดท้ายด้วยคำถามเดียวว่าจะเจาะตรงไหนต่อ
   คำอธิบายที่สั้นจนเข้าใจไม่ได้ แย่กว่าคำอธิบายที่ยาวไปหนึ่งบรรทัด
5. ภาษาไทยแบบพูดกับเพื่อนร่วมห้อง ไม่สุภาพจนเกร็ง ไม่ต้องลงท้าย "ครับ/ค่ะ" ทุกประโยค
   แทนตัวเองว่า "เรา" เรียกเขาว่า "เธอ" หรือไม่เรียกเลยก็ได้
6. จอมือถือแคบ — ห้ามหัวข้อใหญ่ ห้ามตาราง ห้าม bullet ซ้อน bullet
   เน้นคำสำคัญด้วย **ตัวหนา** ได้ แต่อย่าเกินสองที่ต่อคำตอบ
   สูตรคณิต/เคมี เขียนเป็นบรรทัดเดียวธรรมดา (เช่น  x = (-b ± √(b²-4ac)) / 2a )
   ห้ามใช้ LaTeX เพราะแอปไม่ได้เรนเดอร์ ผู้ใช้จะเห็นเป็นแบ็กสแลชรก ๆ

# ข้อมูลของผู้ใช้ที่เธอเห็น
7. ส่วน "ข้อมูลของผู้ใช้" คืองานจริงของเขา ณ วินาทีนี้ ใช้ได้เลยโดยไม่ต้องถามซ้ำ
8. หัวข้อ "งานที่ยังไม่เสร็จ" ถูกแอปเรียงลำดับมาให้แล้ว — ข้อ 1 คือใบที่ควรทำก่อน
   ถามว่า "ทำอะไรก่อน" = ตอบใบที่ 1 เสมอ ห้ามจัดลำดับใหม่เอง ห้ามเทียบวันที่เอง
   ลำดับนั้นคิดจาก กำหนดส่ง × คะแนน × เวลาที่ต้องใช้ ซึ่งละเอียดกว่าที่เธอเดาจากวันที่อย่างเดียว
   เหตุผลที่ยกให้เขาฟัง ต้องหยิบจากบรรทัดของใบนั้นจริง ๆ (กำหนดส่ง คะแนนเก็บ เวลาที่ประเมิน)
   ห้ามแต่งเหตุผลเอง และห้ามพูดว่า "ส่งช้าที่สุดเลยทำก่อน" ซึ่งกลับหัวกับความจริง
9. ข้อมูลว่างเปล่า = เขายังไม่ได้ใส่งาน **ไม่ได้แปลว่าตอบคำถามอื่นไม่ได้**
   ถ้าเขาถามเรื่องงาน ให้บอกว่ายังไม่เห็นงาน แล้วชวนสแกนใบงานหรือพิมพ์เข้ามา หนึ่งประโยคพอ
   ถ้าเขาถามความรู้วิชาการ ตอบไปตามปกติ ห้ามเอาเรื่องข้อมูลว่างมาเป็นเหตุผลที่จะไม่ตอบ

# โรงเรียนไทยทำงานยังไง (พื้นฐานที่ต้องรู้ ไม่ต้องถามผู้ใช้)
- ระดับชั้น: ป.1-ป.6 (ประถม) · ม.1-ม.3 (ม.ต้น) · ม.4-ม.6 (ม.ปลาย)
  ม.1 อายุราว 12-13 · ม.6 ราว 17-18 · ผู้ใช้แอปนี้ส่วนใหญ่คือ ม.ต้น-ม.ปลาย
- 8 กลุ่มสาระ: ภาษาไทย · คณิตศาสตร์ · วิทยาศาสตร์และเทคโนโลยี · สังคมศึกษา ศาสนา
  และวัฒนธรรม · สุขศึกษาและพลศึกษา · ศิลปะ · การงานอาชีพ · ภาษาต่างประเทศ
  วิชาที่เจอบ่อยเพิ่ม: วิทยาการคำนวณ · นาฏศิลป์ · หน้าที่พลเมือง · แนะแนว · ชุมนุม
- ปีการศึกษา 2 เทอม: เทอม 1 ราวกลาง พ.ค. ถึง ก.ย. · เทอม 2 ราว พ.ย. ถึง มี.ค.
  ปิดเทอมใหญ่ราว มี.ค.-พ.ค. · ปิดเทอมเล็กราว ต.ค.
- คะแนนเต็ม 100 ต่อวิชาต่อเทอม แบ่งเป็น คะแนนเก็บ (งาน ใบงาน ควิซ) +
  สอบกลางภาค + สอบปลายภาค · สัดส่วนแล้วแต่ครูแต่ละคน
- เกรด: 4 (80+) · 3.5 (75-79) · 3 (70-74) · 2.5 (65-69) · 2 (60-64)
  · 1.5 (55-59) · 1 (50-54) · 0 (ต่ำกว่า 50)
  GPA = เกรดเฉลี่ยเทอมนั้น · GPAX = เกรดเฉลี่ยสะสมทุกเทอม (ตัวที่ใช้ยื่นเข้ามหาลัย)
- ติด 0 = สอบตก ต้องซ่อม · ติด ร = งานยังไม่ครบ · ติด มส = เวลาเรียนไม่ถึง 80%
- ม.ปลายแยกสาย: วิทย์-คณิต · ศิลป์-คำนวณ · ศิลป์-ภาษา · ศิลป์-สังคม
- เข้ามหาลัยผ่าน TCAS 4 รอบ: รอบ 1 Portfolio · รอบ 2 โควตา · รอบ 3 Admission ·
  รอบ 4 รับตรงอิสระ · ข้อสอบกลาง: TGAT · TPAT · A-Level
- กิจกรรมที่มีทุกโรงเรียน: เข้าแถวเคารพธงชาติ · ชุมนุม/ชมรม · ลูกเสือ-เนตรนารี-ยุวกาชาด
  · รด. (ม.ปลาย) · กีฬาสี · วันไหว้ครู · ปัจฉิมนิเทศ

# แอป Student OS ทำอะไรได้ (ตอบได้ถ้าถูกถาม)
- บอทในกลุ่มไลน์ห้องเรียนเก็บงานที่ครูสั่งเข้าแอปให้เอง นักเรียนไม่ต้องพิมพ์
  ข้อความเดียวที่ครูสั่งงานทั้งสัปดาห์ ถูกแตกเป็นงานทีละใบให้
- สแกนใบงาน/ตารางเรียนที่จดด้วยลายมือเข้าแอปได้
- แชร์ข้อความจากแอปไหนก็ได้ (โน้ต Classroom Gmail เว็บ) เข้าแอปผ่านปุ่มแชร์ของเครื่อง
- จัดลำดับว่าควรทำอะไรก่อน จากกำหนดส่ง คะแนน และเวลาที่ต้องใช้ · แบ่งเวลาให้ในแต่ละวัน
- เตือนก่อนถึงกำหนดส่ง แม้ปิดแอปอยู่
- ข้อมูลงานเก็บในเครื่อง ไม่ได้ส่งไปไหนนอกจากตอนซิงก์บัญชีของเจ้าตัวเอง

# เรื่องความเร็ว
10. อย่าไตร่ตรองยาว คำถามนักเรียนส่วนใหญ่ตรงไปตรงมา อ่านแล้วตอบได้เลย
   ใช้เวลาคิดเท่าที่จำเป็นกับคำถามตรงหน้า แล้วเขียนคำตอบออกมาทันที`;

// รหัสสถานะที่แปลว่า "ลองรุ่นถัดไปเถอะ" ไม่ใช่ "เลิกเถอะ"
//   404 = รุ่นนี้ถูกปลดระวางไปแล้ว
//   503 = รุ่นนี้คนใช้แน่นอยู่ (Google คืนบ่อยมากกับรุ่นใหม่ล่าสุดในชั่วโมงเร่งด่วน)
//   500 / 429 = ฝั่งโน้นสะดุด หรือโควตารุ่นนั้นเต็ม
// ของเดิมเลิกลองทันทีที่ไม่ใช่ 404 ผลคือ 503 จากรุ่นแรกทำให้ทั้งสายล้ม
// ทั้งที่รุ่นสำรองอีกสองตัวว่างอยู่ — วัดจริงแล้วเป็นสาเหตุที่พบบ่อยที่สุด
const RETRY_NEXT_MODEL = new Set([404, 429, 500, 502, 503, 504]);

type Msg = { role: 'user' | 'model'; text: string };

// รูปคำขอของ Gemini — ใช้ร่วมกันทั้งสายตอบทีเดียวและสายไหลทีละคำ
// แยกไว้เพราะสองสายนั้นต้องเห็นบุคลิกและบริบทชุดเดียวกันเป๊ะ ๆ
// ถ้าปล่อยให้ต่างคนต่างประกอบ วันหนึ่งจะได้บอทที่นิสัยไม่เหมือนกันแล้วแต่ว่าสตรีมหรือไม่
function geminiPayload(question: string, context: string, history: Msg[]) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: 'user', parts: [{ text: `ข้อมูลของผู้ใช้ (ณ ตอนนี้):\n${context}\n\nคำถาม:\n${question}` }] },
    ],
    generationConfig: {
      temperature: 0.6,        // ต้องอธิบายให้เข้าใจ ไม่ใช่อ่านตำรา — แต่ไม่ถึงกับแต่งเรื่อง
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  });
}

// ---------- Gemini แบบไหลทีละคำ ----------
// เดิมสตรีมได้เฉพาะสาย gateway — พอ gateway ล่ม คำตอบเลยกลับไปโผล่ทีเดียวทั้งก้อน
// ซึ่งแปลว่าหน้าจอนิ่งสิบกว่าวินาที และนั่นคือจุดที่คนกดออกจากแอป
// Gemini มี streamGenerateContent อยู่แล้ว ไม่มีเหตุผลที่จะไม่ใช้
//
// alt=sse ทำให้ตอบเป็น "data: {...}" ทีละบรรทัดแบบเดียวกับฝั่ง OpenAI
// ไม่ใส่ alt=sse จะได้ JSON array ก้อนใหญ่ที่ต้องรอครบก่อนถึงจะแกะได้ = ไม่ได้สตรีมจริง
async function* geminiStream(question: string, context: string, history: Msg[], budgetMs = 35000)
  : AsyncGenerator<string> {
  if (!API_KEY) throw new Error('GEMINI_API_KEY ยังไม่ได้ตั้ง');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), budgetMs);
  const payload = geminiPayload(question, context, history);
  const order = workingModel
    ? [workingModel, ...MODEL_CANDIDATES.filter(m => m !== workingModel)]
    : MODEL_CANDIDATES;

  try {
    let res: Response | null = null;
    let lastStatus = 0;
    for (const model of order) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        { method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
          body: payload, signal: ctl.signal });
      if (res.ok) { workingModel = model; break; }
      lastStatus = res.status;
      console.warn('[ask-sai:gemini-stream]', model, res.status, (await res.text()).slice(0, 200));
      if (!RETRY_NEXT_MODEL.has(res.status)) break;
      res = null;
    }
    if (!res || !res.ok || !res.body) {
      const e = new Error('gemini ' + lastStatus) as Error & { status?: number };
      e.status = lastStatus;
      throw e;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';      // ชิ้นที่อ่านมาอาจขาดกลางบรรทัด ต้องพักไว้จนจบบรรทัด
    let sent = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const raw = t.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        let piece = '';
        try { piece = JSON.parse(raw)?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''; }
        catch { continue; }
        if (piece) { sent = true; yield piece; }
      }
    }
    if (!sent) throw new Error('คำตอบว่าง');
  } finally {
    clearTimeout(timer);
  }
}

// เดิมใช้ตัวจับเวลา "ตัวเดียว" คุมการลองทุกรุ่นรวมกัน ซึ่งพังแบบที่หาสาเหตุยาก:
// รุ่นแรกกินเวลาไป 20 วินาทีกว่าจะคืน 503 แล้วรุ่นสำรองเหลือเวลาแค่ 8 วินาที
// ทั้งที่มันตอบได้ถ้ามีเวลาพอ — ผลคือคำถามล้มแบบสุ่ม ๆ ทั้งที่ทุกอย่างตั้งถูกหมด
// ตอนนี้แต่ละรุ่นได้เวลาของตัวเอง แต่รวมกันแล้วต้องไม่เกินงบทั้งก้อน
async function askGemini(question: string, context: string, history: Msg[], budgetMs = 30000) {
  if (!API_KEY) throw new Error('GEMINI_API_KEY ยังไม่ได้ตั้ง');

  const payload = geminiPayload(question, context, history);
  const order = workingModel
    ? [workingModel, ...MODEL_CANDIDATES.filter(m => m !== workingModel)]
    : MODEL_CANDIDATES;

  const deadline = Date.now() + budgetMs;
  let lastStatus = 0;

  for (const model of order) {
    const left = deadline - Date.now();
    if (left < 4000) break;              // เหลือน้อยกว่านี้ ยิงไปก็ไม่ทันตอบจบ
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), left);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
          body: payload,
          signal: ctl.signal,
        },
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text.trim()) { workingModel = model; return text.trim(); }
        // ตอบ 200 แต่ไม่มีเนื้อ = โดนตัวกรองความปลอดภัย หรือโทเคนหมดกลางทาง
        // ลองรุ่นถัดไปดีกว่าคืนช่องว่างให้ผู้ใช้
        console.warn('[ask-sai] gemini', model, 'คำตอบว่าง', JSON.stringify(data).slice(0, 200));
        lastStatus = 204;
        continue;
      }
      lastStatus = res.status;
      // ข้อความจากฝั่ง Google มีรายละเอียดของโปรเจกต์ปนมาได้ เก็บไว้ใน log ไม่ส่งกลับหน้าเว็บ
      console.warn('[ask-sai] gemini', model, res.status, (await res.text()).slice(0, 200));
      if (!RETRY_NEXT_MODEL.has(res.status)) break;   // 400/401/403 = ปัญหาที่กุญแจหรือคำขอ ลองรุ่นอื่นก็ไม่ช่วย
    } catch (e) {
      // รุ่นนี้ค้างจนหมดเวลา — ยังเหลือเวลาก็ลองรุ่นถัดไปต่อ
      console.warn('[ask-sai] gemini', model, (e as Error)?.message ?? e);
      lastStatus = lastStatus || 0;
    } finally {
      clearTimeout(timer);
    }
  }

  const e = new Error('gemini ' + lastStatus) as Error & { status?: number };
  e.status = lastStatus;
  throw e;
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

async function askGateway(question: string, context: string, history: Msg[], budgetMs = 40000) {
  const messages = gatewayMessages(question, context, history);
  // เพดานนี้ต้องสูงกว่าของสาย Gemini มาก เพราะรุ่น "คิดก่อนตอบ" นับความคิดรวมในเพดานเดียวกัน
  // ตั้งเท่า 800 เหมือน Gemini = คิดเสร็จพอดีโทเคนหมด แล้วคืนคำตอบเปล่ากลับมา
  // ความยาวคำตอบจริงคุมด้วยข้อ 5 ใน SYSTEM ไม่ได้คุมด้วยเพดานนี้
  return await chat({ messages, temperature: 0.4, maxTokens: 2000, timeoutMs: budgetMs, noThink: true });
}

// สายไฟล้วน ๆ สำหรับทดสอบหน้าจอโดยไม่เสียโควตา
async function askMock(question: string, context: string, _h?: Msg[], _b?: number) {
  const n = (context.match(/^- /gm) || []).length;
  return `(โหมดทดสอบ) ได้รับคำถามแล้ว: "${question.slice(0, 60)}"\n`
    + `เห็นข้อมูลของคุณ ${n} รายการ — ตั้ง ASK_PROVIDER = gemini หรือ gateway เพื่อต่อกับ AI จริง`;
}

type Adapter = (q: string, c: string, h: Msg[], budgetMs: number) => Promise<string>;
const ADAPTERS: Record<string, Adapter> = {
  gemini: askGemini,
  gateway: askGateway,
  mock: askMock,
};

// ---------- ผู้ให้บริการสำรอง ----------
// เจอกับตัวเองรอบนี้: gateway รับคำขอแล้วเงียบสนิท ทุกคำถามในแอปจึงขึ้น
// "น้องไซตอบไม่ได้ตอนนี้" ทุกครั้งติดต่อกัน โดยที่ probe models ยังผ่านฉลุย
// (กุญแจถูก URL ถูก รุ่นถูก — ที่พังคือ /chat/completions อย่างเดียว)
//
// บทเรียน: ผู้ให้บริการเดียว = จุดตายจุดเดียวที่ทำให้ฟีเจอร์ทั้งฟีเจอร์หายไปเงียบ ๆ
// มีกุญแจ Gemini อยู่แล้ว ไม่มีเหตุผลที่จะไม่ลองต่อเมื่อตัวหลักล้ม
function providerChain(): string[] {
  const chain = [PROVIDER];
  if (PROVIDER === 'gateway' && API_KEY) chain.push('gemini');
  if (PROVIDER === 'gemini' && llmReady()) chain.push('gateway');
  return orderByHealth(chain.filter(p => ADAPTERS[p]));
}

// ---------- เบรกเกอร์ ----------
// ตัวหลักที่ "ค้าง" แพงกว่าตัวหลักที่ "ตอบว่าไม่ได้" มาก เพราะทุกคำถามของทุกคน
// ต้องรอจนครบงบเวลาก่อนถึงจะได้เริ่มถามตัวสำรอง — 12 วินาทีที่เสียเปล่าทุกครั้ง
//
// จำไว้ว่าใครเพิ่งล้ม แล้วดันมันไปท้ายแถวชั่วคราว ไม่ได้ตัดทิ้ง —
// ตัดทิ้งถาวรแปลว่าตอนปลายทางกลับมาดีแล้วเราจะไม่มีวันรู้
// (ความจำอยู่ใน instance เดียว หายตอน cold start ซึ่งกลายเป็นข้อดี: ได้ลองใหม่เองเรื่อย ๆ)
const COOLDOWN_MS = 60_000;
const lastFail: Record<string, number> = {};

function orderByHealth(chain: string[]): string[] {
  if (chain.length < 2) return chain;
  const now = Date.now();
  const hot = chain.filter(p => now - (lastFail[p] ?? 0) >= COOLDOWN_MS);
  const cold = chain.filter(p => now - (lastFail[p] ?? 0) < COOLDOWN_MS);
  return hot.length ? [...hot, ...cold] : chain;   // ล้มหมดทุกตัว = เรียงตามเดิม ลองใหม่ทั้งแถว
}

// งบเวลาของแต่ละตัวในสาย
//
// เคยตั้ง 12 วินาทีเพราะคิดว่า "ตัวที่มีตัวสำรองควรรีบยอมแพ้" — ผิด และผิดแบบเจ็บ:
// วัดจริงแล้ว Gemini ใช้ 6 วินาทีแค่ตอบคำเดียว คำถามจริงที่ต้องอธิบายจึงเกิน 12 เสมอ
// ผลคือตัวที่ทำงานได้ดีถูกตัดทิ้งทุกครั้ง แล้วตกไปหาตัวสำรองที่ล่มอยู่ = พังทั้งที่ไม่ควรพัง
//
// งบต้องกว้างพอให้ตัวที่ "ช้าแต่ทำงานได้" ทำงานจนจบ
// ส่วนตัวที่ "ตายจริง" ให้เบรกเกอร์ข้างล่างเป็นคนกันไม่ให้ผู้ใช้คนถัดไปมาเสียเวลาซ้ำ
const BUDGET_WITH_FALLBACK = 28000;
const BUDGET_LAST = 35000;

/** ไล่ลองทีละตัวจนกว่าจะได้คำตอบ — คืนคำตอบพร้อมชื่อตัวที่ตอบได้จริง */
async function askWithFallback(question: string, context: string, history: Msg[]) {
  const chain = providerChain();
  let lastErr: unknown = null;

  for (let i = 0; i < chain.length; i++) {
    const name = chain[i];
    const last = i === chain.length - 1;
    try {
      const answer = await ADAPTERS[name](
        question, context, history, last ? BUDGET_LAST : BUDGET_WITH_FALLBACK);
      if (i > 0) console.warn('[ask-sai] ตัวหลักล้ม ใช้ตัวสำรองแทน:', name);
      return { answer, provider: name };
    } catch (e) {
      console.error('[ask-sai]', name, (e as Error)?.message ?? e);
      lastFail[name] = Date.now();
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('ไม่มีผู้ให้บริการที่ใช้ได้');
}

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
  // โหมดตรวจสุขภาพ: ยิงคำถามสั้นที่สุดผ่านผู้ให้บริการทุกตัวในสาย แล้วบอกว่าตัวไหนตอบได้
  //
  // มีเพราะรอบที่แล้วใช้เวลานานเกินควรกว่าจะรู้ว่าอะไรพัง: หน้าแอปขึ้นแค่
  // "น้องไซตอบไม่ได้ตอนนี้" ส่วน probe models ก็ผ่าน ทำให้ดูเหมือนทุกอย่างปกติ
  // ทั้งที่ /chat/completions ค้างจนครบ timeout ทุกครั้ง
  // รายละเอียด error ตรงนี้ปลอดภัยที่จะส่งกลับ เพราะไม่เคยมีค่ากุญแจอยู่ในนั้น
  if ((body as { probe?: string }).probe === 'health') {
    const out: Array<Record<string, unknown>> = [];
    for (const name of providerChain()) {
      const t = Date.now();
      try {
        const a = await ADAPTERS[name]('ตอบว่า พร้อม คำเดียว', '- ไม่มีงานค้าง', [], 15000);
        out.push({ provider: name, ok: true, ms: Date.now() - t, sample: a.slice(0, 60) });
      } catch (e) {
        out.push({ provider: name, ok: false, ms: Date.now() - t, error: String((e as Error)?.message ?? e) });
      }
    }
    return json({ ok: out.some(o => o.ok), configured: PROVIDER, chain: out });
  }

  // โหมดตรวจสายเน็ต: ยิงคำขอที่เล็กที่สุดเท่าที่จะเล็กได้ไปหาปลายทางแต่ละเจ้า
  // แล้วรายงานรหัสสถานะดิบ ๆ · แยก "ปลายทางตอบว่าไม่ผ่าน" ออกจาก "ปลายทางไม่ตอบเลย"
  // สองอย่างนี้หน้าตาเหมือนกันหมดจากฝั่งแอป แต่ต้องแก้คนละทางกันสิ้นเชิง
  if ((body as { probe?: string }).probe === 'net') {
    const out: Array<Record<string, unknown>> = [];
    const hit = async (label: string, url: string, init: RequestInit, ms = 8000) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), ms);
      const t0 = Date.now();
      try {
        const r = await fetch(url, { ...init, signal: ctl.signal });
        const body = (await r.text()).slice(0, 160);
        out.push({ label, status: r.status, ms: Date.now() - t0, body });
      } catch (e) {
        out.push({ label, status: 0, ms: Date.now() - t0, error: String((e as Error)?.message ?? e) });
      } finally { clearTimeout(t); }
    };

    // ดึงรายชื่อรุ่นที่กุญแจดอกนี้เรียกได้จริง — ชื่อรุ่นของ Google เปลี่ยน/ปลดระวางบ่อยกว่าที่ควร
    // และรุ่นที่หายไปตอบ 404 ซึ่งหน้าตาเหมือน "ต่อไม่ติด" มากกว่า "ชื่อรุ่นเก่า"
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
        { headers: { 'x-goog-api-key': API_KEY } });
      const d = await r.json();
      out.push({ label: 'google:models', status: r.status, ms: 0,
        body: (d?.models ?? []).map((m: { name?: string }) => String(m?.name ?? '').replace('models/', ''))
          .filter((n: string) => n.includes('flash') || n.includes('pro')).join(' ') });
    } catch (e) {
      out.push({ label: 'google:models', status: 0, ms: 0, error: String((e as Error)?.message ?? e) });
    }
    await hit('google:generate(POST)',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': API_KEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }) });
    await hit('gateway:models(GET)', `${LLM_BASE_URL}/models`,
      { headers: { Authorization: `Bearer ${LLM_API_KEY}` } });
    await hit('gateway:chat(POST)', `${LLM_BASE_URL}/chat/completions`,
      { method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
        body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'user', content: 'hi' }], max_tokens: 8 }) });

    return json({ ok: true, checks: out });
  }

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
  // สตรีมได้ทั้งสองเจ้าแล้ว — เดิมผูกไว้กับ gateway ตัวเดียว พอ gateway ล่ม
  // คำตอบเลยกลับไปโผล่ทีเดียวทั้งก้อน หน้าจอนิ่งสิบกว่าวินาที ซึ่งคือจุดที่คนกดออก
  const STREAMERS: Record<string, (q: string, c: string, h: Msg[], ms: number) => AsyncGenerator<string>> = {
    gateway: (q, c, h, ms) => chatStream({
      messages: gatewayMessages(q, c, h),
      temperature: 0.4, maxTokens: 2000, timeoutMs: ms, noThink: true,
    }),
    gemini: geminiStream,
  };

  if (body.stream === true && STREAMERS[providerChain()[0]]) {
    const t0 = Date.now();
    const enc = new TextEncoder();
    const line = (o: unknown) => enc.encode(JSON.stringify(o) + '\n');

    const chain = providerChain();
    const first = chain[0];
    const hasFallback = chain.length > 1;
    let sentAny = false;

    const stream = new ReadableStream({
      async start(c) {
        try {
          // มีตัวสำรองรออยู่ = ต้องรีบยอมแพ้ ไม่งั้นผู้ใช้รอจนครบงบก่อนจะได้เริ่มนับหนึ่งใหม่
          for await (const piece of STREAMERS[first](
            question, context, history, hasFallback ? BUDGET_WITH_FALLBACK : 40000)) {
            sentAny = true;
            c.enqueue(line({ t: piece }));
          }
          c.enqueue(line({ done: true, ms: Date.now() - t0, provider: first }));
        } catch (e) {
          const status = (e as { status?: number }).status ?? 0;
          console.error('[ask-sai:stream]', e);

          // ยังไม่ได้ส่งตัวอักษรออกไปเลย = ยังกู้ได้ · ลองตัวสำรองแล้วส่งเป็นก้อนเดียว
          // ไหลทีละคำไม่ได้ก็จริง แต่คำตอบที่มาช้ากว่าปกติดีกว่าไม่มีคำตอบเลย
          //
          // ส่งหลังจากเริ่มไหลแล้วไม่กู้ ตรงนั้นผู้ใช้อ่านครึ่งแรกไปแล้ว
          // การเอาคำตอบคนละชุดมาต่อท้ายทำให้ได้ย่อหน้าที่ขัดกันเองกลางประโยค
          if (!sentAny) {
            lastFail[first] = Date.now();
            for (const name of chain.slice(1)) {
              try {
                const a = await ADAPTERS[name](question, context, history, BUDGET_LAST);
                console.warn('[ask-sai:stream] ตัวหลักล้ม ใช้ตัวสำรองแทน:', name);
                c.enqueue(line({ t: a }));
                c.enqueue(line({ done: true, ms: Date.now() - t0, provider: name }));
                return;
              } catch (e2) {
                console.error('[ask-sai:stream]', name, (e2 as Error)?.message ?? e2);
                lastFail[name] = Date.now();
              }
            }
          }

          // สตรีมเริ่มไปแล้ว เปลี่ยนรหัสสถานะ HTTP ไม่ได้อีก — error จึงต้องเดินทาง
          // มาในตัวสตรีมเอง ไม่งั้นฝั่งแอปจะเห็นสตรีมจบเฉย ๆ แล้วนึกว่าคำตอบหมดแค่นั้น
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
    const r = await askWithFallback(question, context, history);
    return json({ ok: true, answer: r.answer, provider: r.provider, ms: Date.now() - t0 });
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
