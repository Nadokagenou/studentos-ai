// ============================================================
// Student OS — read-day
// ------------------------------------------------------------
// รับข้อความที่ผู้ใช้เล่าเรื่องวันนี้ ("ไปห้างบ่ายโมงถึงห้าโมง แล้วเย็นเรียนพิเศษ")
// คืนเป็นช่วงเวลา + ไปโรงเรียนไหม + ข้อสังเกตสั้น ๆ หนึ่งบรรทัด
//
// แอปไม่บันทึกอะไรจากที่นี่เอง — ผลนี้ไปขึ้นการ์ด "จดแบบนี้ ถูกไหม" ก่อนเสมอ
// และ "งานไหนก่อน" ยังมาจากเอนจินในเครื่อง (studyPlan) · ที่นี่พูดได้แค่เรื่องเวลา
// ถ้าปล่อยให้ AI เลือกงานเอง หน้าแรกกับการ์ดนี้จะบอกงานแรกคนละใบ ซึ่งเคยเกิดมาแล้ว
//
// กุญแจ Gemini อยู่ที่นี่เท่านั้น · verify_jwt = true (config.toml) ห้ามปิด
// ไม่เก็บข้อความไว้ที่ไหน ไม่เขียนฐานข้อมูลสักแถว
// สเปก: alt/docs/superpowers/specs/2026-10-18-daily-context-design.md
// ============================================================

import { GEMINI_KEY, geminiGenerate, geminiTrailLine, type GeminiError } from '../_shared/gemini.ts';
import { cleanDay, cleanInput } from './clean.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function prompt(i: { text: string; today: string; now: string; summary: string }) {
  return `คุณช่วยนักเรียนมัธยมไทยจดว่า "วันนั้นเป็นยังไง" จากข้อความที่เขาพิมพ์ แล้วคืน JSON ตาม schema

วันนี้: ${i.today}${i.now ? ' เวลา ' + i.now : ''}
ข้อมูลที่แอปรู้อยู่แล้ว:
${i.summary || '(ไม่มี)'}

ข้อความของผู้ใช้:
"""${i.text}"""

กติกา:
- date: วันที่ข้อความพูดถึง YYYY-MM-DD (ไม่ระบุ = วันนี้) · ไม่เกิน 7 วันข้างหน้า
- school: true ถ้าบอกว่าไปโรงเรียน · false ถ้าบอกว่าไม่ไป/อยู่บ้าน/ปิดเทอม/ไปเที่ยวทั้งวันในวันเรียน · ไม่ได้พูดถึง = null
- away: true เฉพาะเมื่อไม่อยู่ทั้งวันจริง ๆ (ไปต่างจังหวัด เข้าค่าย) ไม่มีเวลาทำงานเลย
- blocks: ช่วงที่ไม่ว่าง start/end แบบ HH:MM 24 ชม. · "บ่ายโมง"=13:00 "ห้าโมงเย็น"=17:00 "สองทุ่ม"=20:00 "เที่ยง"=12:00
  ถ้าบอกเวลาเริ่มแต่ไม่บอกจบ ให้ประเมินจากกิจกรรมแบบสมเหตุสมผล แล้วเขียนใน note ว่าเดาเวลาจบ
  ถ้าไม่มีเวลาเลย ห้ามแต่งเวลาขึ้นมา — blocks ว่าง แล้วบอกใน note
- title: ชื่อสั้น ๆ ไม่เกิน 30 ตัวอักษร เช่น "ไปห้าง" "เรียนพิเศษ"
- breakUntil: ถ้าพูดถึงวันเปิดเทอม ให้ใส่วันเปิดเทอม YYYY-MM-DD · ไม่พูดถึง = null
- advice: ภาษาไทย ไม่เกิน 160 ตัวอักษร พูดกับผู้ใช้ตรง ๆ เรื่องเวลา: หลังหักช่วงที่ไม่อยู่ เหลือว่างช่วงไหน และงานที่ใกล้ส่งจะทันไหม
  ห้ามเสนอให้ทำงานอื่นก่อน "งานแรกตอนนี้" ที่แอปบอกไว้ · ห้ามให้กำลังใจลอย ๆ · ไม่มีอะไรน่าห่วงก็บอกสั้น ๆ ว่าทันสบาย
- note: เหตุผลสั้น ๆ เมื่ออ่านไม่ออกหรือต้องเดา · ปกติให้ว่าง`;
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING' },
    school: { type: 'BOOLEAN', nullable: true },
    away: { type: 'BOOLEAN' },
    blocks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { start: { type: 'STRING' }, end: { type: 'STRING' }, title: { type: 'STRING' } },
        required: ['start', 'end', 'title'],
      },
    },
    breakUntil: { type: 'STRING', nullable: true },
    advice: { type: 'STRING' },
    note: { type: 'STRING' },
  },
  required: ['date', 'away', 'blocks', 'advice'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, message: 'ต้องเรียกด้วย POST' }, 405);
  if (!GEMINI_KEY) return json({ ok: false, message: 'ยังไม่ได้ตั้ง secret ชื่อ GEMINI_API_KEY' }, 500);

  let input: ReturnType<typeof cleanInput> = null;
  try { input = cleanInput(await req.json()); } catch { input = null; }
  if (!input) return json({ ok: false, message: 'ไม่มีข้อความ หรือวันที่ไม่ถูกรูปแบบ' }, 400);

  let parsed: unknown = {};
  try {
    const r = await geminiGenerate({
      parts: [{ text: prompt(input) }],
      temperature: 0.2,
      think: 'off',            // แปลงข้อความเป็นช่วงเวลา ไม่ใช่โจทย์ที่ต้องคิดยาว
      json: true,
      responseSchema: SCHEMA,
      maxOutputTokens: 1024,
      budgetMs: 25_000,        // ฝั่งแอปรอ 30 วิ — ต้องจบก่อนแอปเลิกรอ
    });
    parsed = JSON.parse(r.text);
  } catch (e) {
    const err = e as GeminiError;
    console.warn('[read-day] gemini', err.status ?? 0, err.message, geminiTrailLine(err.trail));
    if (err.status === 429) return json({ ok: false, message: 'AI คนแน่นชั่วคราว ลองใหม่อีกสักครู่ หรือเลือกเวลาเอง' }, 502);
    return json({ ok: false, message: 'AI อ่านไม่สำเร็จ ลองเลือกเวลาเองแทนได้' }, 502);
  }

  return json({ ok: true, ...cleanDay(parsed, input.today) });
});
