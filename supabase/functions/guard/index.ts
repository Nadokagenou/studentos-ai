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
import { IMAGE_RULES, TEXT_RULES, VERDICT_TOKENS, readVerdict, saySomething }
  from '../_shared/modrules.ts';

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
        // ไม่ส่ง responseSchema แล้ว — trail ชี้ว่า flash-latest ตอบ 400 ทิ้งทุกครั้ง
        // ซึ่งบันไดถอยนับเป็น "คำขอเสียทั้งใบ" ขั้นสุดท้ายของบันไดจึงตายมาตลอด
        // คำสั่งในพรอมป์ต์บอกรูป JSON อยู่แล้ว และ readVerdict เจียดเอาวงเล็บปีกกา
        // ออกมาจากข้อความได้เอง จึงไม่ได้พึ่ง schema ตั้งแต่แรก
        maxOutputTokens: VERDICT_TOKENS,
        // budgetMs คือเพดานของ **ทั้งคำขอ** ส่วน attemptMs คือของ **การยิงหนึ่งครั้ง**
        // เดิมตั้ง budgetMs 20 วิเฉย ๆ แล้วปล่อยให้ attemptMs เป็นค่าปริยาย 22 วิ
        // ซึ่งยาวกว่างบทั้งก้อน — พอรุ่นแรกอืด งบก็หมดตั้งแต่ยังไม่ได้ลองรุ่นสำรองสักตัว
        // บันไดถอยที่อุตส่าห์มีจึงไม่เคยถูกใช้เลย และผู้ใช้เห็นเป็น "ตรวจรูปไม่สำเร็จ"
        //
        // **12 วิสั้นเกินไป** — trail รอบสองบอกว่า '3.6-flash 0 12.0s' คือเราไปตัดเอง
        // ตอนที่โมเดลยังทำงานอยู่ แล้วเดินลงบันไดไปเจอตัวที่ช้ากว่าเดิม
        // งานดูรูปกินเวลามากกว่างานข้อความล้วนอยู่แล้ว 25 วิจึงเป็นเพดานที่สมจริง
        attemptMs: 25_000,
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
        maxOutputTokens: VERDICT_TOKENS,
        attemptMs: 15_000,
        budgetMs: 40_000,
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
