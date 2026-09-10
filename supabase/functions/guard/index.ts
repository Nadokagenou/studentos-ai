// ============================================================
// guard · ตัวกรองเนื้อหา
// ------------------------------------------------------------
// ผู้ใช้ทักมาเอง (10 ก.ย. 2569): "ไม่มี ai วิเคราะห์รูปหรือข้อความที่เราจะส่ง
// กลัวเรื่องกฎหมายและความปลอดภัยของเด็กมากๆ" — ตรวจแล้วถูก ทั้งโปรเจกต์ไม่มีสักบรรทัด
//
// เขาเคาะกติกาเองว่า **รูปกันก่อนส่ง · ข้อความปล่อยขึ้นก่อนแล้วสแกนตามหลัง**
// ซึ่งเป็นการแลกที่ถูกต้อง และเหตุผลไม่ใช่ว่าข้อความสำคัญน้อยกว่า:
//
//   ข้อความที่ต้องรอ 2 วินาทีทุกครั้งที่กดส่ง จะทำให้คนเลิกคุยกันในแอปนี้
//   แล้วย้ายไปคุยที่อื่นแทน ซึ่งแปลว่าไม่มีใครกรองอะไรได้อีกเลยสักตัว
//   ตัวกรองที่ดีที่สุดคือตัวที่คนยังยอมอยู่ในระบบที่มีมันอยู่
//
//   ส่วนรูป คนรอได้อยู่แล้วเพราะมีขั้นตอนอัปโหลดที่เห็น ๆ กันอยู่
//   และรูปที่หลุดออกไปแม้แค่สิบวินาที ก็ถูกจับภาพหน้าจอส่งต่อได้เรียบร้อยแล้ว
//   ของที่เอากลับไม่ได้ ต้องกันตั้งแต่ก่อนออก
//
// **รูปล้มแบบปิด ข้อความล้มแบบเปิด** — ถ้า Gemini ล่มหรือหมดโควตา:
//   รูป     → ปฏิเสธ บอกผู้ใช้ว่าตรวจไม่ได้ ลองใหม่อีกที
//   ข้อความ → ปล่อยผ่าน (มันขึ้นไปแล้ว) แต่บันทึกไว้ว่ายังไม่ได้ตรวจ
// เพราะรูปที่ยังไม่ถูกตรวจแล้วปล่อยผ่าน คือความเสี่ยงที่เอาคืนไม่ได้
// ส่วนข้อความที่ยังไม่ถูกตรวจ ยังมีปุ่มรายงานกับปุ่มบล็อกรออยู่ข้างหลังอีกสองชั้น
//
// เรียกยังไง (ต้องแนบ JWT ของผู้ใช้เสมอ):
//   POST { mode: 'image', b64, mime }
//        → { ok: true } | { ok: false, reason, message }
//   POST { mode: 'text', kind, target, text }
//        → { ok: true } | { ok: false, reason, message }   (ซ่อนของให้แล้วถ้า false)
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { geminiGenerate, geminiTrailLine, type GeminiError } from '../_shared/gemini.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  });

// ---------- สิ่งที่ต้องกัน ----------
// เขียนเป็นหมวดที่ตัดสินได้ ไม่ใช่คำว่า "ไม่เหมาะสม" ซึ่งแปลว่าอะไรก็ได้
// แล้วโมเดลจะลากไปถึงรูปที่ไม่มีปัญหาเลย เช่น รูปโจทย์ชีววิทยาที่มีภาพร่างกาย
//
// ข้อสุดท้ายสำคัญที่สุดสำหรับแอปนี้: **นี่คือแอปการบ้านที่ผู้ใช้เป็นเด็ก**
// รูปที่ปกติแล้วไม่ผิดอะไรเลยในแอปผู้ใหญ่ อาจไม่ควรอยู่ตรงนี้
const IMAGE_RULES = `คุณคือด่านตรวจรูปของแอปการบ้านสำหรับนักเรียนไทย ผู้ใช้ส่วนใหญ่อายุ 12-18 ปี

ตอบเป็น JSON เท่านั้น: {"verdict":"ok"|"block","reason":"...","note":"..."}

block เมื่อรูปมีสิ่งเหล่านี้:
- csam: เด็กในลักษณะทางเพศ ไม่ว่ากรณีใดทั้งสิ้น
- nudity: อวัยวะเพศ หน้าอก ก้น ที่เปลือย หรือชุดชั้นในที่ถ่ายเน้นเรือนร่าง
- sexual: ท่าทางหรือฉากทางเพศ แม้ใส่เสื้อผ้าครบ
- violence: เลือด ศพ การทำร้ายร่างกาย อาวุธที่จ่อคน
- selfharm: บาดแผลกรีดตัวเอง วิธีทำร้ายตัวเอง
- drug: ยาเสพติด อุปกรณ์เสพ เหล้าบุหรี่ที่เป็นจุดเด่นของรูป
- id: บัตรประชาชน พาสปอร์ต ทะเบียนบ้าน บัตรนักเรียนที่อ่านเลขได้ สมุดบัญชี บัตรเครดิต
- contact: เบอร์โทร ที่อยู่บ้าน หรือชื่อโรงเรียนพร้อมหน้าเด็ก ที่อ่านออกชัด
- gore: ภาพน่าสยดสยองอื่น ๆ

ok เมื่อเป็น: ใบงาน หนังสือเรียน สมุดจด กระดานเรียน ตารางสอน หน้าจอโจทย์
รูปวิวหรือของทั่วไป รูปหน้าตัวเองแบบปกติ มีม สติกเกอร์ การ์ตูน

ระวัง: รูปกายวิภาคในหนังสือชีววิทยา รูปสงครามในหนังสือประวัติศาสตร์
และรูปผ่าตัดในสื่อการเรียน คือ ok ถ้ามันอยู่ในบริบทของสื่อการเรียนจริง ๆ
ถ้าไม่แน่ใจระหว่าง ok กับ block ให้เลือก block เฉพาะหมวด csam nudity sexual selfharm
หมวดที่เหลือถ้าไม่แน่ใจให้ตอบ ok — บล็อกใบงานของเด็กผิด ๆ ก็ทำให้เขาเลิกใช้เหมือนกัน`;

const TEXT_RULES = `คุณคือด่านตรวจข้อความของแอปการบ้านสำหรับนักเรียนไทย ผู้ใช้ส่วนใหญ่อายุ 12-18 ปี

ตอบเป็น JSON เท่านั้น: {"verdict":"ok"|"block","reason":"...","note":"..."}

block เมื่อข้อความเป็น:
- grooming: ผู้ใหญ่ตีสนิทเด็กในทางที่ผิด ชวนไปเจอตัวจริงแบบลับ ๆ ขอรูป ขอให้เก็บเป็นความลับ
- sexual: ชวนคุยเรื่องเพศ ขอรูปโป๊ ส่งข้อความทางเพศ
- bully: ด่าทอ ข่มขู่ ประจาน ตั้งใจทำให้อาย ยุให้คนอื่นรุมคนหนึ่ง
- selfharm: ชวนหรือสอนทำร้ายตัวเอง หรือบอกว่ากำลังจะทำ
- threat: ขู่ทำร้าย ขู่เอาเรื่องนอกแอป
- doxx: แจกเบอร์ ที่อยู่ โรงเรียน หรือข้อมูลส่วนตัวของคนอื่น
- scam: หลอกโอนเงิน ขายของผิดกฎหมาย ชวนพนัน
- drug: ซื้อขายยาเสพติด

ok เมื่อเป็น: ถามการบ้าน บ่นเรื่องเรียน คุยเล่น ทักทาย หยอกกันแบบเพื่อน
คำหยาบที่ใช้กันปกติระหว่างเพื่อนโดยไม่ได้เจาะจงทำร้ายใคร คือ ok
วัยรุ่นไทยพิมพ์ "กูมึงเหี้ย" กับเพื่อนสนิทเป็นเรื่องปกติ อย่าเอาไปนับเป็น bully
สิ่งที่ต่างกันคือ **เจตนาทำร้ายคนที่อ่าน** ไม่ใช่คำที่ใช้

ถ้าไม่แน่ใจ ให้ตอบ ok ยกเว้นหมวด grooming csam sexual selfharm ที่ถ้าไม่แน่ใจให้ block`;

type Verdict = { verdict: string; reason?: string; note?: string };

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['ok', 'block'] },
    reason: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['verdict'],
};

// ข้อความที่เอาไปโชว์ผู้ใช้ได้เลย — ไม่บอกว่าโมเดลคิดยังไง เพราะนั่นคือคู่มือหลบด่าน
const SAY: Record<string, string> = {
  csam: 'ส่งรูปนี้ไม่ได้',
  nudity: 'ส่งรูปนี้ไม่ได้',
  sexual: 'ส่งเนื้อหาแบบนี้ไม่ได้',
  violence: 'รูปนี้แรงเกินไปสำหรับแอปนี้',
  gore: 'รูปนี้แรงเกินไปสำหรับแอปนี้',
  selfharm: 'ถ้ากำลังรู้สึกแย่อยู่ โทร 1323 ได้ตลอด 24 ชม. คุยกับคนจริง ๆ ฟรี',
  drug: 'ส่งเนื้อหาแบบนี้ไม่ได้',
  id: 'รูปนี้มีข้อมูลบัตรหรือเอกสารส่วนตัวอยู่ — ปิดส่วนนั้นก่อนแล้วส่งใหม่',
  contact: 'รูปนี้มีข้อมูลติดต่อส่วนตัวอยู่ — ปิดส่วนนั้นก่อนแล้วส่งใหม่',
  grooming: 'ข้อความนี้ถูกซ่อนไว้',
  bully: 'ข้อความนี้ถูกซ่อนไว้',
  threat: 'ข้อความนี้ถูกซ่อนไว้',
  doxx: 'ข้อความนี้มีข้อมูลส่วนตัวของคนอื่น จึงถูกซ่อนไว้',
  scam: 'ข้อความนี้ถูกซ่อนไว้',
};
const saySomething = (r?: string) => SAY[r ?? ''] ?? 'เนื้อหานี้ส่งไม่ได้';

// ---------- ทำไมเพดานโทเคนถึงต้องสูงทั้งที่คำตอบสั้นนิดเดียว ----------
// _shared/gemini.ts เตือนไว้เองว่า "เพดานนี้**นับความคิดรวมด้วย**"
// รุ่น 3.x คิดก่อนตอบเป็นค่าเริ่มต้น และ think:'off' เป็นแค่การ *ขอ* ซึ่งบางรุ่น
// ไม่รับแล้วถอยลงมาเป็น 'none' คือคุมการคิดไม่ได้เลย
// ตั้งไว้ 512 ความคิดจึงกินหมดก่อน เหลือให้เขียน JSON ไม่ครบวงเล็บ
// ผลคือ readVerdict อ่านไม่ออก แล้วเรานับเป็น guard_down ทั้งที่ Gemini ตอบ 200 มาแล้ว
// วัดจริง 10 ก.ย. 69: จาก 4 ครั้งที่ล้ม มี 3 ครั้งเป็น 'อ่านคำตัดสินไม่ออก'
// มีครั้งเดียวที่เป็นปัญหาเครือข่ายจริง ('gemini 0')
// คำตัดสินยาวไม่ถึง 100 โทเคน 2048 จึงไม่ได้แพงขึ้นจริงเพราะจ่ายตามที่ใช้จริง
const VERDICT_TOKENS = 2048;

function readVerdict(raw: string): Verdict | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const v = JSON.parse(m[0]) as Verdict;
    return v && typeof v.verdict === 'string' ? v : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, message: 'ต้องเป็น POST' }, 405);

  // ---------- ต้องรู้ให้ได้ว่าใครเรียก ----------
  // ไม่ใช่เพื่อกันคนนอก (verify_jwt ทำอยู่แล้ว) แต่เพื่อให้ mod_log ชี้ตัวได้
  // บันทึกที่ไม่รู้ว่าใครถูกกรอง คือบันทึกที่เอาไปทำอะไรต่อไม่ได้เลย
  const auth = req.headers.get('Authorization') ?? '';
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: who } = await asUser.auth.getUser();
  const uid = who?.user?.id ?? null;
  if (!uid) return json({ ok: false, message: 'ต้องล็อกอินก่อน' }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ ok: false, message: 'คำขอไม่ถูกต้อง' }, 400); }

  const mode = String(body.mode ?? '');

  // ============================================================
  // รูป — ตัดสินก่อนที่มันจะไปอยู่ที่ไหนสักแห่ง
  // ------------------------------------------------------------
  // รับมาเป็น base64 ตรง ๆ ไม่ใช่ path ใน storage โดยตั้งใจ
  // ถ้ารับเป็น path แปลว่ารูปต้องถูกอัปโหลดขึ้นไปก่อนถึงจะตรวจได้
  // และช่วงเวลาระหว่างอัปโหลดเสร็จกับตรวจเสร็จ คือช่วงที่รูปนั้นมี URL อยู่จริงแล้ว
  // ============================================================
  if (mode === 'image') {
    const b64 = String(body.b64 ?? '');
    const mime = String(body.mime ?? 'image/jpeg');
    if (!b64) return json({ ok: false, message: 'ไม่มีรูปมาให้ตรวจ' }, 400);
    if (b64.length > 12_000_000) return json({ ok: false, message: 'รูปใหญ่เกินไป' }, 413);

    try {
      const r = await geminiGenerate({
        parts: [{ text: IMAGE_RULES }, { inline_data: { mime_type: mime, data: b64 } }],
        temperature: 0,
        think: 'off',
        json: true,
        responseSchema: SCHEMA,
        maxOutputTokens: VERDICT_TOKENS,
        // budgetMs คือเพดานของ **ทั้งคำขอ** ส่วน attemptMs คือของ **การยิงหนึ่งครั้ง**
        // เดิมตั้ง budgetMs 20 วิเฉย ๆ แล้วปล่อยให้ attemptMs เป็นค่าปริยาย 22 วิ
        // ซึ่งยาวกว่างบทั้งก้อน — พอรุ่นแรกอืด งบก็หมดตั้งแต่ยังไม่ได้ลองรุ่นสำรองสักตัว
        // บันไดถอยที่อุตส่าห์มีจึงไม่เคยถูกใช้เลย และผู้ใช้เห็นเป็น "ตรวจรูปไม่สำเร็จ"
        // วัดจริง 10 ก.ย. 69: ยิง 6 ครั้งจากแอปจริง ล้ม 2 ครั้งด้วย guard_down
        attemptMs: 12_000,
        budgetMs: 45_000,
      });
      const v = readVerdict(r.text ?? '');
      if (!v) throw Object.assign(new Error('อ่านคำตัดสินไม่ออก'),
        { raw: String(r.text ?? '').slice(0, 300), finish: r.finish, truncated: r.truncated });

      await db.rpc('mod_note', {
        p_kind: 'image', p_target: null, p_author: uid,
        p_verdict: v.verdict === 'block' ? 'block' : 'ok',
        p_reason: v.reason ?? null, p_score: v as unknown,
      });

      if (v.verdict === 'block') {
        return json({ ok: false, reason: v.reason ?? 'other', message: saySomething(v.reason) });
      }
      return json({ ok: true });
    } catch (e) {
      // ---------- ล้มแบบปิด ----------
      // ตรวจไม่ได้ = ไม่ให้ส่ง · นี่คือจุดที่ต้องยอมให้ผู้ใช้หงุดหงิด
      // ทางเลือกอีกทางคือปล่อยรูปที่ไม่มีใครดูเลยขึ้นไป ซึ่งในแอปที่ผู้ใช้เป็นเด็ก
      // แลกไม่ได้ · บันทึกไว้ด้วยว่าล้มเพราะอะไร จะได้รู้ว่ามันล้มบ่อยแค่ไหน
      await db.rpc('mod_note', {
        p_kind: 'image', p_target: null, p_author: uid,
        p_verdict: 'review', p_reason: 'guard_down',
        // trail บอกว่าลองรุ่นไหนไปบ้าง แต่ละรุ่นตอบสถานะอะไร ใช้เวลาเท่าไร
        // เก็บแค่ e.message จะได้ 'gemini 503' ลอย ๆ ซึ่งตอบไม่ได้ว่าควรแก้ตรงไหน
        p_score: { error: String((e as Error).message ?? e),
                   trail: geminiTrailLine((e as GeminiError).trail),
                   raw: (e as { raw?: string }).raw ?? null,
                   finish: (e as { finish?: string }).finish ?? null,
                   truncated: (e as { truncated?: boolean }).truncated ?? null },
      });
      return json({
        ok: false, reason: 'guard_down',
        message: 'ตรวจรูปไม่สำเร็จ ลองส่งใหม่อีกครั้ง',
      }, 503);
    }
  }

  // ============================================================
  // ข้อความ — ขึ้นไปแล้ว ตรวจตามหลัง
  // ============================================================
  if (mode === 'text') {
    const kind = String(body.kind ?? '');
    const target = body.target == null ? null : String(body.target);
    const text = String(body.text ?? '').slice(0, 2000);
    if (!text.trim()) return json({ ok: true });
    if (!['post', 'reply', 'dm', 'tthread', 'tmsg'].includes(kind)) {
      return json({ ok: false, message: 'ไม่รู้จักชนิดเนื้อหา' }, 400);
    }

    try {
      const r = await geminiGenerate({
        parts: [{ text: TEXT_RULES }, { text: '\n\nข้อความที่ต้องตรวจ:\n' + text }],
        temperature: 0,
        think: 'off',
        json: true,
        responseSchema: SCHEMA,
        maxOutputTokens: VERDICT_TOKENS,
        attemptMs: 8_000,
        budgetMs: 24_000,
      });
      const v = readVerdict(r.text ?? '');
      if (!v) throw Object.assign(new Error('อ่านคำตัดสินไม่ออก'),
        { raw: String(r.text ?? '').slice(0, 300), finish: r.finish, truncated: r.truncated });

      if (v.verdict === 'block' && target) {
        // mod_hide ซ่อนของ **แล้วเขียน mod_log ให้ในตัว** จึงไม่ต้องเรียก mod_note ซ้ำ
        await db.rpc('mod_hide', {
          p_kind: kind, p_target: target,
          p_reason: v.reason ?? null, p_score: v as unknown,
        });
        return json({ ok: false, reason: v.reason ?? 'other', message: saySomething(v.reason) });
      }

      await db.rpc('mod_note', {
        p_kind: kind, p_target: target, p_author: uid,
        p_verdict: 'ok', p_reason: v.reason ?? null, p_score: v as unknown,
      });
      return json({ ok: true });
    } catch (e) {
      // ---------- ล้มแบบเปิด ----------
      // ข้อความขึ้นไปแล้วตั้งแต่ก่อนเรียกตัวนี้ · จะ "ไม่อนุมัติ" ย้อนหลังก็ไม่มีความหมาย
      // ที่ทำได้คือทำเครื่องหมายไว้ว่ายังไม่ได้ตรวจ เพื่อให้ตามเก็บทีหลังได้
      await db.rpc('mod_note', {
        p_kind: kind, p_target: target, p_author: uid,
        p_verdict: 'review', p_reason: 'guard_down',
        p_score: { error: String((e as Error).message ?? e),
                   trail: geminiTrailLine((e as GeminiError).trail),
                   raw: (e as { raw?: string }).raw ?? null,
                   finish: (e as { finish?: string }).finish ?? null,
                   truncated: (e as { truncated?: boolean }).truncated ?? null },
      });
      return json({ ok: true, unchecked: true });
    }
  }

  return json({ ok: false, message: 'ไม่รู้จักโหมดนี้' }, 400);
});
