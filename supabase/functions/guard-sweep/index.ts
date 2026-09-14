// ============================================================
// guard-sweep · ไล่เก็บเนื้อหาที่หลุดการตรวจสดไป
// ------------------------------------------------------------
// guard ตรวจตอนคนกดส่ง ซึ่งดีได้เท่าที่หน้าเว็บยังเปิดอยู่เท่านั้น
// มีสองทางที่ของหลุดไปได้ และทั้งสองทางไม่ใช่เรื่องหายาก:
//
//   1) ปิดแท็บทันทีหลังกดส่ง — การสแกนข้อความยิงแล้วไม่รอผลตามกติกาที่ตกลงกันไว้
//      หน้าเว็บตายก่อน = คำขอนั้นตายไปด้วย และคนที่ตั้งใจส่งของแย่ ๆ
//      คือคนที่มีแรงจูงใจจะปิดแท็บที่สุด
//   2) ตัวกรองล่มตอนนั้นพอดี — บันทึกเป็น verdict='review' แล้วไม่มีใครกลับมาดูอีก
//      ซึ่งเท่ากับไม่ได้ตรวจ แต่ดูเหมือนตรวจแล้วในบันทึก
//
// ตัวนี้ถูก cron เรียกทุก 10 นาที หยิบของที่ยังไม่มีใครตัดสินมาตรวจให้จบ
//
// **ทำไมถึงไม่ต้องมี JWT ของผู้ใช้** — ต่างจาก guard ตรงที่ไม่มีผู้ใช้คนไหนเป็นเจ้าของ
// คำขอนี้ มันคืองานของระบบ · ด่านที่กันคนนอกคือ verify_jwt ของ Supabase
// (cron แนบ publishable key มาให้) บวกกับตรงนี้ไม่รับคำสั่งอะไรจากตัวคำขอเลย
// ไม่ว่าใครยิงมา มันก็ทำสิ่งเดียวกันเสมอคือไล่ตรวจของที่ค้าง จึงไม่มีอะไรให้สั่งผิดทาง
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { geminiGenerate, geminiTrailLine, type GeminiError } from '../_shared/gemini.ts';
import { TEXT_RULES, VERDICT_TOKENS, readVerdict } from '../_shared/modrules.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ตาข่ายชั้นสองใช้ **ถังเดียวกับ guard** ไม่ใช่ถังที่สาม — มันคือชั้นกรองชั้นเดียวกัน
// และสามถังแปลว่าต้องเฝ้าสามที่ · เบรกของตัวมันเองยังอยู่ (down >= 3 แล้วหยุดรอบ)
// จึงกินได้ไม่เกินสามคำขอเสียต่อรอบแม้ถังจะแห้ง
// ไม่ได้ตั้ง = ถอยไปใช้ GEMINI_API_KEY เหมือนเดิม (ดูหมายเหตุเต็มใน guard/index.ts)
const GUARD_KEY = Deno.env.get('GUARD_GEMINI_KEY') ?? '';

// เพดานต่อรอบ · ไม่ใช่เพื่อประหยัด แต่เพราะ Edge Function มีเพดานเวลาของมันเอง
// ทำเกินนี้ในรอบเดียวแปลว่าโดนตัดกลางคัน แล้วของที่ตรวจไปแล้วบางส่วนจะไม่ถูกบันทึก
// รอบหน้าอีก 10 นาทีค่อยมาเก็บต่อ ซึ่งของที่ค้างก็ยังอยู่ครบเพราะ mod_pending
// ดูจาก "ยังไม่มีใครตัดสิน" ไม่ได้ดูจากเวลา
const PER_RUN = 8;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

Deno.serve(async () => {
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: rows, error } = await db.rpc('mod_pending', {
    p_minutes: 1440, p_limit: PER_RUN,
  });
  if (error) return json({ ok: false, message: error.message }, 500);
  if (!rows || !rows.length) return json({ ok: true, checked: 0, note: 'ไม่มีของค้าง' });

  let blocked = 0, checked = 0, down = 0;

  for (const r of rows as Array<{ kind: string; target: string; author: string; body: string }>) {
    try {
      const g = await geminiGenerate({
        parts: [{ text: TEXT_RULES }, { text: '\n\nข้อความที่ต้องตรวจ:\n' + String(r.body).slice(0, 2000) }],
        apiKey: GUARD_KEY,
        temperature: 0,
        think: 'off',
        json: true,
        maxOutputTokens: VERDICT_TOKENS,
        attemptMs: 15_000,
        budgetMs: 40_000,
      });
      const v = readVerdict(g.text ?? '');
      if (!v) throw Object.assign(new Error('อ่านคำตัดสินไม่ออก'),
        { raw: String(g.text ?? '').slice(0, 300) });

      if (v.verdict === 'block') {
        await db.rpc('mod_hide', {
          p_kind: r.kind, p_target: r.target,
          p_reason: v.reason ?? null,
          p_score: { ...v, by: 'sweep' },
        });
        blocked++;
      } else {
        await db.rpc('mod_note', {
          p_kind: r.kind, p_target: r.target, p_author: r.author,
          p_verdict: 'ok', p_reason: v.reason ?? null,
          p_score: { ...v, by: 'sweep' },
        });
      }
      checked++;
    } catch (e) {
      // ล้มก็ปล่อยไว้ให้รอบหน้ามาเก็บ — **ห้ามบันทึกเป็น ok เด็ดขาด**
      // บันทึก ok ทั้งที่ยังไม่ได้ตรวจ จะทำให้ mod_pending เลิกหยิบมันขึ้นมาอีกตลอดกาล
      // ซึ่งแปลว่าของชิ้นนั้นรอดด่านไปถาวรเพราะตัวกรองล่มครั้งเดียว
      await db.rpc('mod_note', {
        p_kind: r.kind, p_target: r.target, p_author: r.author,
        p_verdict: 'review', p_reason: 'sweep_down',
        p_score: { error: String((e as Error).message ?? e),
                   trail: geminiTrailLine((e as GeminiError).trail),
                   raw: (e as { raw?: string }).raw ?? null },
      });
      down++;
      // โควตาหมดแล้วก็คือหมด ยิงต่อในรอบนี้มีแต่จะได้ 429 เพิ่ม
      if (down >= 3) break;
    }
  }

  return json({ ok: true, checked, blocked, down, queued: rows.length });
});
