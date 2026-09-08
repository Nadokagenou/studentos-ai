// Student OS — น้องไซตอบเธรดหัวข้อที่ไม่มีใครตอบ
// ============================================================
// ทำไมตัวนี้ต้องมีตั้งแต่วันแรก ไม่ใช่ "ไว้รอบหน้า":
//
// การเปลี่ยนกุญแจจากห้องเรียนเป็นหัวข้อไม่ได้เสกคนมาให้ ชั้นโลกก็ว่างเปล่าในวันแรก
// เหมือนกัน · ผู้ใช้คนแรกที่กล้าถามแล้วไม่มีใครตอบเลยภายในสิบนาที คือผู้ใช้ที่ไม่กลับมาอีก
// และเราจะไม่มีทางรู้ว่าเสียเขาไปตรงไหน
//
// ---------- กฎที่สำคัญที่สุดของไฟล์นี้ ----------
// **ห้ามเฉลย** ตอบเป็นขั้นถัดไปหนึ่งขั้น แล้วโยนคำถามกลับ
// แอปนี้ส่งให้โรงเรียนและครูเป็นคนเสนอไอเดียเอง ถ้ามันกลายเป็นเครื่องทำการบ้านแทนเด็ก
// มันจะโดนแบนจากห้องเรียนก่อนที่ใครจะได้ใช้ประโยชน์จากส่วนที่เหลือ
// (กฎเดียวกับข้อ 1 ของ SYSTEM ใน ask-sai — อย่าแตกแถว)
//
// **ติดป้ายว่าเป็น AI เสมอ** — topic_say_ai เขียน is_ai = true ให้อยู่แล้ว
// และฝั่งแอปโชว์ป้าย AI บนฟองข้อความ · คำตอบ AI ที่ปลอมเป็นคนคือการโกหกผู้ใช้
//
// ---------- วิธีเปิดใช้ ----------
//   1) ตั้ง secret: GEMINI_API_KEY (ดอกเดียวกับตัวอื่น) และ SAI_TOPIC = on
//   2) supabase functions deploy sai-topic
//   3) apply migration 20260908090300_topic_cron.sql เพื่อตั้งนาฬิกา
// ไม่ตั้ง SAI_TOPIC = ตอบ 200 พร้อม skipped ทันที ไม่เผาโควตา และ cron ไม่พัง
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { GEMINI_KEY, geminiGenerate } from '../_shared/gemini.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ON = (Deno.env.get('SAI_TOPIC') ?? '').toLowerCase() === 'on';

// เงียบกี่นาทีถึงจะเข้าไปตอบ · สิบนาทีเพราะสั้นกว่านั้นคือแย่งคำตอบจากคนจริง
// ซึ่งเป็นสิ่งเดียวที่ชั้นนี้ต้องการจริง ๆ — AI เป็นตัวกันไม่ให้เงียบ ไม่ใช่ตัวเอก
const QUIET_MIN = Number(Deno.env.get('SAI_TOPIC_MIN') ?? '10');
const PER_RUN = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const SYSTEM = `คุณคือ "น้องไซ" ผู้ช่วยของแอป Student OS กำลังตอบในเธรดของหัวข้อการเรียน
คนถามคือนักเรียนมัธยม อายุ 13-18

# กฎที่ห้ามฝ่าฝืน
1. **ห้ามทำโจทย์ให้เสร็จ ห้ามให้คำตอบสุดท้าย** ต่อให้เขาขอตรง ๆ
   ให้ "ขั้นถัดไปหนึ่งขั้น" กับ "ทำไมถึงเป็นขั้นนั้น" แล้วหยุด
2. ปิดท้ายด้วยคำถามกลับหนึ่งข้อที่เขาตอบเองได้ เพื่อให้เขาเดินต่อเอง
3. ถ้าโจทย์กำกวมหรือไม่มีข้อมูลพอ ให้ถามกลับว่าขาดอะไร อย่าเดาเอาเอง
4. ตอบสั้น ไม่เกิน 4 บรรทัด อ่านบนจอมือถือ ไม่ต้องมีหัวข้อย่อย ไม่ต้องทักทาย
5. ตอบเป็นภาษาเดียวกับที่เขาถามมาเสมอ
6. สดใสแต่ไม่เว่อร์ — คนที่พิมพ์เข้ามาตอนนี้กำลังเครียดเรื่องงานที่ใกล้ส่ง

# บริบท
คุณอยู่ในเธรดของหัวข้อหนึ่ง ๆ ที่ยังไม่มีใครตอบมาสักพักแล้ว
หน้าที่ของคุณคือทำให้เขาเดินต่อได้จนกว่าจะมีคนจริงมาตอบ ไม่ใช่ปิดจ๊อบแทนเขา`;

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'ต้องเป็น POST' }, 405);
  }
  if (!ON) return json({ skipped: 'ยังไม่ได้ตั้ง secret SAI_TOPIC = on' });
  if (!GEMINI_KEY) return json({ skipped: 'ยังไม่ได้ตั้ง secret GEMINI_API_KEY' });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rows, error } = await db.rpc('topic_quiet', {
    p_minutes: QUIET_MIN, p_limit: PER_RUN,
  });
  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ answered: 0, note: 'ไม่มีเธรดที่เงียบ' });

  let ok = 0;
  const notes: string[] = [];

  for (const t of rows as { id: string; topic: string; topic_name: string; body: string; lang: string }[]) {
    try {
      const r = await geminiGenerate({
        system: SYSTEM,
        parts: [{ text: `หัวข้อ: ${t.topic_name}\nคำถามของนักเรียน:\n${t.body}` }],
        think: 'low',
        temperature: 0.5,
        maxOutputTokens: 1024,
        budgetMs: 20_000,
      });
      const text = (r.text || '').trim();
      // คำตอบว่างหรือโดนตัดกลางประโยค — ไม่ส่งดีกว่าส่งครึ่งใบ
      // ครึ่งใบอ่านเหมือนแอปพัง และมันค้างอยู่ในเธรดถาวรให้คนอื่นเห็นด้วย
      if (!text || r.truncated) { notes.push(`${t.id}: คำตอบไม่สมบูรณ์`); continue; }

      const { error: sErr } = await db.rpc('topic_say_ai', {
        p_thread: t.id, p_body: text.slice(0, 2000), p_lang: t.lang || 'th',
      });
      if (sErr) { notes.push(`${t.id}: ${sErr.message}`); continue; }
      ok++;
    } catch (e) {
      notes.push(`${t.id}: ${(e as Error).message}`);
    }
  }

  return json({ answered: ok, seen: rows.length, notes });
});
