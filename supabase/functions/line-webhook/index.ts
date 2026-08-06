// ============================================================
// students OS — LINE webhook
// ------------------------------------------------------------
// บอทอยู่ในกลุ่มห้องเรียน ครูสั่งงานทีเดียว เข้าระบบให้ทุกคนในห้องที่เชื่อมไว้
//
// ทำไมต้องเป็นบอทในกลุ่ม ไม่ใช่การอ่านแชทส่วนตัว:
//   LINE ไม่เปิด API ให้อ่านแชทของใครทั้งนั้น — ไม่ใช่ข้อจำกัดของเรา
//   แต่กลายเป็นข้อดี เพราะครูสั่งครั้งเดียวได้ทั้งห้อง ไม่มีใครต้องพิมพ์ซ้ำ
//
// หน้าที่ของไฟล์นี้มีแค่ 3 อย่าง — ตั้งใจให้โง่ที่สุดเท่าที่จะทำได้:
//   1. ตรวจลายเซ็นว่ามาจาก LINE จริง
//   2. ถ้าเป็นรหัสเชื่อม (SOS-XXXX) → จับคู่กลุ่มกับนักเรียน
//   3. ถ้าเป็นข้อความธรรมดา → หย่อนดิบ ๆ ลงตาราง inbox_items
//
// การอ่าน/แกะ/จับซ้ำ/ให้คะแนนความมั่นใจ ทำที่ฝั่งแอปทั้งหมด (inbox.js)
// เพื่อให้มีที่เดียวที่รู้ตรรกะนี้ ไม่ต้องดูแลสองที่ให้ตรงกัน
//
// ⚠️ ตอน deploy ต้องปิด "Verify JWT" ของฟังก์ชันนี้ (ดู supabase/config.toml)
//    LINE ไม่มีทางแนบ JWT ของเรามาด้วย ถ้าเปิดไว้จะโดน 401 ทุกครั้งแบบเงียบ ๆ
//    ด่านจริงคือลายเซ็น HMAC ข้างล่างนี้ ซึ่งแน่นกว่า JWT ในกรณีนี้
//
// secret ที่ต้องตั้งใน Supabase → Edge Functions → Secrets:
//    LINE_CHANNEL_SECRET · LINE_ACCESS_TOKEN
//    (SUPABASE_URL กับ SUPABASE_SERVICE_ROLE_KEY แพลตฟอร์มใส่ให้เอง)
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') ?? '';
const ACCESS_TOKEN = Deno.env.get('LINE_ACCESS_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ชื่อ secret ที่ตั้งผิดคือความผิดพลาดที่เกิดบ่อยที่สุดตอนติดตั้ง และเดิมมันพังแบบ
// แย่ที่สุดด้วย: crypto.importKey โยน error เพราะกุญแจว่าง → 500 Internal Server Error
// ซึ่งไม่ได้บอกอะไรเลยว่าต้องไปแก้ตรงไหน ตรวจตั้งแต่ต้นแล้วบอกชื่อที่ขาดไปตรง ๆ ดีกว่า
// (บอกแค่ "ชื่อไหนหาย" ไม่เคยพ่นค่าออกมา)
function missingSecrets(): string[] {
  const miss: string[] = [];
  if (!CHANNEL_SECRET) miss.push('LINE_CHANNEL_SECRET');
  if (!ACCESS_TOKEN) miss.push('LINE_ACCESS_TOKEN');
  return miss;
}

const db = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------- ตรวจลายเซ็น ----------
// LINE เซ็น body ด้วย channel secret — ถ้าไม่ตรงแปลว่ามีคนยิงมั่ว ต้องทิ้งทันที
// ไม่มีขั้นตอนนี้ = ใครก็ยิงงานปลอมเข้าแอปนักเรียนได้
async function verify(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(CHANNEL_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // เทียบแบบเวลาคงที่ กันการเดาลายเซ็นทีละตัวอักษร
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ---------- ตอบกลับในกลุ่ม ----------
async function reply(replyToken: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

// ข้อความที่ไม่มีทางเป็นงาน — กรองทิ้งตั้งแต่ต้นทาง จะได้ไม่ไปกวนกล่องเข้า
const NOISE = /^(ครับ|ค่ะ|คะ|จ้า|จ้าา|ok|โอเค|ได้|รับทราบ|555+|ขอบคุณ|thanks?|👍|🙏|\s*)$/i;

// ============================================================
// น้องไซ — ผู้ช่วยที่ "ตอบเฉพาะตอนถูกเรียก"
// ------------------------------------------------------------
// บอทที่แจมทุกประโยคในกลุ่มห้องเรียนจะโดนเตะออกภายในวันเดียว
// ต้องเรียกก่อนถึงจะพูด นอกนั้นเงียบสนิทและทำหน้าที่เก็บงานไปตามปกติ
// ============================================================
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-3.6-flash';

// "ไซ" คำเดียวไม่นับ เพราะไปชนกับ ไซส์/ไซเบอร์/ไซโล — ต้องเรียกให้ชัด
const CALLED = /น้องไซ|\bsynara\b|^ไซ[\s,.!?ๆ]/i;

const PERSONA = `คุณคือ "น้องไซ" (Synara) ผู้ช่วยประจำแอป students OS
อยู่ในกลุ่มไลน์ห้องเรียนกับนักเรียนมัธยม

บุคลิก: เป็นกันเอง สดใส แต่ไม่เว่อร์ พูดสั้นกระชับ เหมือนเพื่อนที่เก่งเรื่อง
จัดตารางและคอยเตือนงาน แทนตัวเองว่า "เรา"

กติกาที่ห้ามผิด:
- ตอบสั้น 1-3 ประโยค ไม่เกิน 60 คำ เพราะนี่คือแชทกลุ่ม ยาวไปคือกวน
- ห้ามแต่งเรื่องการบ้าน กำหนดส่ง หรือคะแนนของใครขึ้นมาเอง ไม่รู้ให้บอกว่าไม่รู้
- ถ้าถูกถามว่ามีงานอะไรค้าง ให้บอกว่าดูในแอป students OS ได้เลย
  เพราะเราไม่เห็นข้อมูลส่วนตัวของใครจากในกลุ่ม
- ห้ามทำการบ้านให้ทั้งข้อ ให้ใบ้หรืออธิบายวิธีคิดแทน แล้วชวนให้ลองทำเอง
- อยู่ในกลุ่มห้องเรียน ถ้าถูกชวนคุยเรื่องไม่เหมาะสม เลี่ยงอย่างสุภาพแล้วเปลี่ยนเรื่อง

ช่วยได้: อธิบายบทเรียน ให้กำลังใจ แนะนำวิธีแบ่งเวลาอ่านหนังสือ ตอบคำถามทั่วไป`;

// บางเวอร์ชันของ LINE ส่ง mention มาให้ด้วย ถ้ามีก็ใช้ ไม่มีก็ยังจับจากชื่อได้
function mentionedSelf(ev: any): boolean {
  const list = ev?.message?.mention?.mentionees;
  return Array.isArray(list) && list.some((m: any) => m?.isSelf === true);
}

// ---------- ความจำสั้น ๆ ----------
// เก็บเฉพาะที่คุยกับน้องไซ ไม่ใช่ทุกข้อความในกลุ่ม
// ถ้ายังไม่ได้สร้างตาราง line_chat ก็ทำงานได้ปกติ แค่จำเรื่องที่เพิ่งคุยไม่ได้
async function recentChat(roomId: string) {
  try {
    const { data } = await db.from('line_chat').select('role, text')
      .eq('room_id', roomId).order('created_at', { ascending: false }).limit(8);
    return (data ?? []).reverse();
  } catch { return []; }
}

async function rememberChat(roomId: string, q: string, a: string) {
  try {
    await db.from('line_chat').insert([
      { room_id: roomId, role: 'user', text: q.slice(0, 500) },
      { room_id: roomId, role: 'bot', text: a.slice(0, 500) },
    ]);
  } catch { /* ไม่มีตารางก็ข้ามไป ไม่ใช่เรื่องคอขาดบาดตาย */ }
}

async function askGemini(q: string, history: any[]): Promise<string> {
  const contents = [
    ...history.map((h) => ({
      role: h.role === 'bot' ? 'model' : 'user',
      parts: [{ text: String(h.text ?? '') }],
    })),
    { role: 'user', parts: [{ text: q }] },
  ];

  // LINE รอ webhook ไม่นาน ถ้า Gemini อืดต้องยอมแพ้แล้วตอบอย่างอื่นไปก่อน
  // ดีกว่าปล่อยให้ LINE timeout แล้วมองว่า webhook เรามีปัญหา
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PERSONA }] },
          contents,
          generationConfig: { temperature: 0.8, maxOutputTokens: 220 },
        }),
      },
    );
    const j = await res.json();
    if (!res.ok) {
      console.error('[gemini]', res.status, JSON.stringify(j).slice(0, 300));
      return 'ตอนนี้สมองเราติดขัดนิดหน่อย เดี๋ยวลองใหม่อีกทีนะ';
    }
    const out = (j?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p?.text ?? '').join('').trim();
    return out || 'เราคิดไม่ออกเลยแฮะ ถามใหม่อีกแบบได้ไหม';
  } catch {
    return 'เราค้างไปแป๊บนึง ลองเรียกใหม่อีกทีนะ';
  } finally {
    clearTimeout(timer);
  }
}

async function handleChat(ev: any, text: string, roomId: string) {
  if (!ev.replyToken) return;

  const q = text.replace(CALLED, '').replace(/^[\s,:@]+/, '').trim().slice(0, 400);

  if (!GEMINI_KEY) {
    await reply(ev.replyToken,
      'เรียกเราเหรอ 🙌 ตอนนี้ยังคิดเองไม่ได้นะ ต้องให้คนดูแลใส่ GEMINI_API_KEY ใน Supabase ก่อน');
    return;
  }
  if (!q) {
    await reply(ev.replyToken, 'เรียกเราเหรอ มีอะไรให้ช่วยบอกได้เลย');
    return;
  }

  const answer = await askGemini(q, await recentChat(roomId));
  await reply(ev.replyToken, answer);
  await rememberChat(roomId, q, answer);
}

Deno.serve(async (req) => {
  const body = await req.text();

  const miss = missingSecrets();
  if (miss.length) {
    console.error('[line-webhook] ยังไม่ได้ตั้ง secret:', miss.join(', '));
    return new Response(`server not configured: ยังไม่ได้ตั้ง ${miss.join(' และ ')} ` +
      `ใน Supabase → Edge Functions → Secrets (ชื่อต้องตรงเป๊ะ ตัวใหญ่ทั้งหมด)`, { status: 500 });
  }

  if (!(await verify(body, req.headers.get('x-line-signature')))) {
    return new Response('bad signature', { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(body); } catch { return new Response('ok'); }

  for (const ev of payload.events ?? []) {
    if (ev.type !== 'message' || ev.message?.type !== 'text') continue;

    const text: string = (ev.message.text ?? '').trim();
    // รองรับทั้งกลุ่ม ห้องรวม และแชทเดี่ยวกับบอท
    const roomId: string = ev.source?.groupId ?? ev.source?.roomId ?? ev.source?.userId ?? '';
    if (!roomId) continue;

    // ---------- 1) รหัสเชื่อมบัญชี ----------
    const code = text.toUpperCase().match(/\bSOS-[A-Z0-9]{4,6}\b/)?.[0];
    if (code) {
      const { data: link } = await db.from('line_codes')
        .select('user_id').eq('code', code).maybeSingle();

      if (!link) {
        if (ev.replyToken) await reply(ev.replyToken, 'รหัสนี้ใช้ไม่ได้แล้ว — กดขอรหัสใหม่ในแอป students OS');
        continue;
      }

      await db.from('line_links').upsert(
        { user_id: link.user_id, room_id: roomId, created_at: new Date().toISOString() },
        { onConflict: 'user_id,room_id' },
      );
      await db.from('line_codes').delete().eq('code', code); // รหัสใช้ได้ครั้งเดียว

      if (ev.replyToken) {
        await reply(ev.replyToken,
          'เชื่อมกับ students OS แล้ว ✅\nต่อจากนี้งานที่ครูสั่งในกลุ่มนี้จะเข้าแอปให้อัตโนมัติ ไม่ต้องพิมพ์เอง');
      }
      continue;
    }

    // ---------- 2) เรียกน้องไซ ----------
    // อยู่ก่อนขั้นเก็บงานโดยตั้งใจ — ข้อความที่พิมพ์คุยกับน้องไซ
    // ไม่ใช่งานที่ครูสั่ง จึงไม่ควรถูกเก็บเข้ากล่องเข้าซ้ำอีกที
    if (CALLED.test(text) || mentionedSelf(ev)) {
      await handleChat(ev, text, roomId);
      continue;
    }

    // ---------- 3) ข้อความธรรมดา → หย่อนเข้ากล่องเข้า ----------
    if (text.length < 8 || NOISE.test(text)) continue;

    const { data: links } = await db.from('line_links')
      .select('user_id').eq('room_id', roomId);
    if (!links?.length) continue; // ไม่มีใครในห้องนี้เชื่อมไว้ ไม่ต้องเก็บอะไรเลย

    const at = new Date().toISOString();
    await db.from('inbox_items').insert(
      links.map((l) => ({
        user_id: l.user_id,
        source: 'line',
        raw: text.slice(0, 2000),
        meta: { roomId, lineMessageId: ev.message.id, senderId: ev.source?.userId ?? null },
        created_at: at,
      })),
    );
  }

  // LINE ต้องได้ 200 กลับเสมอ ไม่งั้นมันจะยิงซ้ำและปิด webhook ทิ้งในที่สุด
  return new Response('ok');
});
