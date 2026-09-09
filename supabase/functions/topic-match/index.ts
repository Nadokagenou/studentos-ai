// Student OS — จับรูปใบงานให้กลายเป็น "หัวข้อ"
// ============================================================
// นี่คือชิ้นที่ทำให้ชั้นโลกเป็นไปได้ และเป็นชิ้นที่คู่แข่งลอกไม่ได้
//
// ฟอรัมถาม-ตอบระดับโลกมีมาแล้วเป็นสิบเจ้าและตายเกือบหมด ด้วยเหตุผลเดียวกันทุกเจ้า:
// ต้องให้ผู้ใช้พิมพ์เองว่าตัวเองติดเรื่องอะไร แล้ว **ไม่มีใครพิมพ์**
// แอปนี้ไม่ต้องถาม เพราะรูปใบงานอยู่ในมือถือเด็กอยู่แล้ว และแอปรู้ว่างานชิ้นนี้วิชาอะไร
//
// สิ่งที่ฟังก์ชันนี้ทำคือ "จับคู่" ไม่ใช่ "สร้าง" — คืน id ของหัวข้อที่มีอยู่แล้วในตาราง topics
// เท่านั้น ห้ามคิดหัวข้อใหม่ขึ้นมาเอง เพราะหัวข้อที่งอกเองจะแตกเป็นสิบชื่อของเรื่องเดียวกัน
// ภายในสัปดาห์เดียว ซึ่งทำลายเหตุผลทั้งหมดของการมีกราฟหัวข้อตั้งแต่แรก
//
// **สถานะ: ไม่ตั้ง secret ก็ยังใช้งานได้** — ถอยไปหา topic_pick ใน SQL ซึ่งจับคำจาก aliases
// ตรง ๆ โดยไม่ต้องใช้ AI เลย · ตั้งใจให้เป็นแบบนั้น เพราะฟีเจอร์ที่เงียบสนิทคือฟีเจอร์ที่ไม่มีอยู่
// (บทเรียนเดียวกับ hwNoRoom ใน hw.js) ตั้ง GEMINI_API_KEY เมื่อไหร่ก็แม่นขึ้นเมื่อนั้น
//
// วิธีเปิดใช้ความแม่นเต็มที่ — ตั้ง secret แล้ว deploy:
//    GEMINI_API_KEY = <กุญแจ>   (ดอกเดียวกับที่ ocr-assist / read-timetable ใช้ ไม่ต้องตั้งซ้ำ)
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GEMINI_KEY, geminiGenerate } from '../_shared/gemini.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });

// รูปจากกล้องมือถือใบละ 3-5 MB · ฝั่งแอปย่อมาให้แล้วชั้นหนึ่ง (shrinkImage ใน feed.js)
// ตรงนี้เป็นชั้นที่สองสำหรับคนที่ยิงตรงเข้ามาเอง
const MAX_IMAGE_B64 = 1_400_000;   // ~1 MB หลังถอด base64
const MAX_TEXT = 600;

// คำสั่งสั้นโดยตั้งใจ — งานนี้เป็นงานจับคู่ ไม่ใช่งานคิด
// ยิ่งสั่งยาว โมเดลยิ่งอยากอธิบายเนื้อหาในรูปแทนที่จะเลือก id มาให้
const SYSTEM = `คุณคือตัวจับคู่หัวข้อของแอปเรียนไทย
งานของคุณคืออ่านโจทย์/ใบงานที่ให้มา แล้วเลือก "หัวข้อ" ที่ตรงที่สุดจากรายการที่ให้ไว้เท่านั้น

กติกา
1. ตอบเป็น id จากรายการเท่านั้น ห้ามคิด id ใหม่ ห้ามเดาชื่อหัวข้อที่ไม่มีในรายการ
2. ถ้าไม่มีหัวข้อไหนตรงเลย ให้ topic เป็น null — การตอบผิดแย่กว่าการตอบว่าไม่รู้
3. ดูที่ "แนวคิดที่โจทย์ใช้" ไม่ใช่ชื่อใบงานหรือชื่อบท ใบงานชื่ออะไรไม่สำคัญ
4. confidence 0-1 ตามความมั่นใจจริง ไม่ต้องปัดขึ้นให้ดูดี
5. alt คือ id สำรองไม่เกินสองตัว เผื่อผู้ใช้เลือกเอง`;

const SCHEMA = {
  type: 'object',
  properties: {
    topic: { type: 'string', nullable: true },
    confidence: { type: 'number' },
    alt: { type: 'array', items: { type: 'string' } },
  },
  required: ['topic', 'confidence'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'ต้องเป็น POST' }, 405);

  // ---------- ต้องล็อกอินก่อน ----------
  // ไม่ใช่เรื่องความลับของหัวข้อ (ใครอ่านก็ได้) แต่เป็นเรื่องโควตา —
  // ปล่อยให้ยิงได้โดยไม่ต้องมีบัญชี = ใครก็เผาโควตา Gemini ของโปรเจกต์ทิ้งได้ในคืนเดียว
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'ต้องล็อกอินก่อน' }, 401);
  let uid: string | null = null;
  try {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data } = await asUser.auth.getUser();
    uid = data?.user?.id ?? null;
  } catch (_) { uid = null; }
  if (!uid) return json({ error: 'ต้องล็อกอินก่อน' }, 401);

  let body: { image?: string; mime?: string; text?: string; subject?: string; grade?: string };
  try { body = await req.json(); } catch (_) { return json({ error: 'อ่านคำขอไม่ได้' }, 400); }

  const subject = String(body.subject ?? '').trim();
  const text = String(body.text ?? '').slice(0, MAX_TEXT).trim();
  const image = typeof body.image === 'string' ? body.image.replace(/^data:[^,]+,/, '') : '';
  if (!image && !text) return json({ error: 'ต้องส่งรูปหรือข้อความมาอย่างน้อยหนึ่งอย่าง' }, 400);
  if (image.length > MAX_IMAGE_B64) return json({ error: 'รูปใหญ่เกินไป ย่อก่อนส่ง' }, 413);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ---------- รายการหัวข้อที่ให้เลือก ----------
  // กรองด้วยวิชาก่อนเสมอถ้ารู้ — รายการสั้นลงสิบเท่าแปลว่าโมเดลเลือกแม่นขึ้นและถูกลง
  let q = db.from('topics').select('id, subject, name, name_en, blurb, grades').order('sort');
  if (subject) q = q.eq('subject', subject);
  const { data: topics, error: tErr } = await q.limit(400);
  if (tErr) return json({ error: 'อ่านรายการหัวข้อไม่ได้' }, 500);
  if (!topics?.length) {
    return json({ topic: null, confidence: 0, alt: [], how: 'empty',
      note: 'ยังไม่มีหัวข้อของวิชานี้ในระบบ' });
  }

  // ---------- ทางสำรองที่ไม่ต้องใช้ AI ----------
  const fallback = async (why: string) => {
    const { data } = await db.rpc('topic_pick', { p_subject: subject || null, p_title: text || null });
    const top = Array.isArray(data) && data.length ? data[0] : null;
    return json({
      topic: top && top.hits > 0 ? top.id : null,
      confidence: top && top.hits > 0 ? Math.min(0.6, 0.25 * top.hits) : 0,
      alt: (Array.isArray(data) ? data.slice(1, 3) : []).map((r: { id: string }) => r.id),
      how: why,
    });
  };

  if (!GEMINI_KEY) return await fallback('keyword');
  // รูปอย่างเดียวไม่มีข้อความ แล้วไม่มีกุญแจ = จับคำไม่ได้เลย — ตอบตรง ๆ ดีกว่าเดา
  if (!image && !text) return await fallback('keyword');

  const list = topics.map((t) =>
    `${t.id} | ${t.subject} | ${t.name}${t.name_en ? ' / ' + t.name_en : ''} | ${t.blurb ?? ''}`
  ).join('\n');

  const parts: unknown[] = [];
  if (image) {
    parts.push({ inlineData: { mimeType: body.mime || 'image/jpeg', data: image } });
  }
  parts.push({
    text: [
      text ? `ข้อความที่ผู้ใช้พิมพ์มา: ${text}` : '',
      subject ? `วิชา: ${subject}` : '',
      body.grade ? `ระดับชั้น: ${body.grade}` : '',
      '',
      'รายการหัวข้อที่เลือกได้ (id | วิชา | ชื่อ | คำอธิบาย):',
      list,
    ].filter(Boolean).join('\n'),
  });

  try {
    const r = await geminiGenerate({
      system: SYSTEM,
      parts,
      json: true,
      responseSchema: SCHEMA,
      think: 'off',              // งานจับคู่ ไม่ใช่งานคิด
      temperature: 0.1,
      maxOutputTokens: 512,
      budgetMs: 25_000,
    });
    const out = JSON.parse(r.text || '{}');
    const ids = new Set(topics.map((t) => t.id));
    // โมเดลคิด id ขึ้นมาเองเป็นเรื่องปกติ ต้องกรองทิ้งเสมอ ไม่ใช่เชื่อคำตอบดิบ
    const pick = typeof out.topic === 'string' && ids.has(out.topic) ? out.topic : null;
    const alt = Array.isArray(out.alt) ? out.alt.filter((x: string) => ids.has(x) && x !== pick).slice(0, 2) : [];
    if (!pick) return await fallback('ai-miss');
    return json({
      topic: pick,
      confidence: Math.max(0, Math.min(1, Number(out.confidence) || 0)),
      alt,
      how: 'ai',
      model: r.model,
    });
  } catch (e) {
    // โควตาหมด · รุ่นหาย · เน็ตสะดุด — ผู้ใช้ไม่ควรเจอหน้าจอพัง ถอยไปจับคำแทน
    console.warn('topic-match fell back:', (e as Error).message);
    return await fallback('ai-error');
  }
});
