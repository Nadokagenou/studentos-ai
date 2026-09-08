// Student OS — แปลข้อความในเธรดหัวข้อ
// ============================================================
// ในชั้นหัวข้อทั่วโลก ภาษาไม่ใช่ต้นทุน มันคือฟีเจอร์:
// ผู้ใช้ถามเป็นไทย เห็นคำตอบเป็นไทย ทั้งที่คนตอบพิมพ์โปรตุเกส
// และเขาไม่ต้องรู้ด้วยซ้ำว่ามีการแปลเกิดขึ้น
//
// **ข้อความต้นฉบับไม่เคยถูกเขียนทับ** — คำแปลอยู่คนละตาราง (topic_tr)
// ถ้าเก็บทับ วันที่โมเดลแปลผิดจะไม่มีทางกู้ข้อความจริงกลับมาได้เลย
//
// แคชคีย์ = md5(ข้อความต้นฉบับ) + ภาษาปลายทาง · แปลครั้งเดียวใช้ได้ทั้งประเทศนั้น
// เธรดที่มีคนไทยอ่านพันคนจึงเสียค่าแปลครั้งเดียว ไม่ใช่พันครั้ง
//
// **สถานะ: ไม่ตั้ง GEMINI_API_KEY = ตอบ 501** และฝั่งแอปจะโชว์ข้อความต้นฉบับต่อไป
// พร้อมปุ่ม "แปล" ที่บอกว่ายังไม่เปิดใช้ ซึ่งดีกว่าปุ่มที่กดแล้วเงียบ
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

const MAX_ITEMS = 40;
const MAX_CHARS = 2000;

// md5 ผ่าน Web Crypto ไม่มีให้ใช้ใน Deno — ใช้ SHA-256 แล้วตัดเอา 32 ตัวแรกแทน
// (ตารางเก็บเป็น text ไม่ได้ผูกกับความยาวของ md5 อยู่แล้ว)
async function keyOf(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SYSTEM = `คุณคือตัวแปลของแอปเรียนสำหรับนักเรียนมัธยม

กติกา
1. แปลให้เป็นภาษาที่ขอ โดยรักษาความหมายทางวิชาการให้ตรงที่สุด
2. สูตร ตัวเลข สัญลักษณ์ทางคณิตศาสตร์และเคมี ชื่อตัวแปร และโค้ด — คงไว้เหมือนเดิมทุกตัว
3. ใช้ภาษาพูดแบบนักเรียนคุยกัน ไม่ใช่ภาษาทางการ คนอ่านคืออายุ 13-18
4. ห้ามเพิ่มคำอธิบาย ห้ามตอบคำถามในข้อความ ห้ามแก้เนื้อหาที่ผิด — แปลอย่างเดียว
5. คืน JSON เป็นอาเรย์ของสตริง ยาวเท่ากับที่รับมาเป๊ะ ๆ เรียงลำดับเดิม`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'ต้องเป็น POST' }, 405);

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

  let body: { texts?: string[]; to?: string };
  try { body = await req.json(); } catch (_) { return json({ error: 'อ่านคำขอไม่ได้' }, 400); }

  const to = String(body.to ?? 'th').toLowerCase().slice(0, 2);
  if (!/^[a-z]{2}$/.test(to)) return json({ error: 'ภาษาปลายทางไม่ถูกต้อง' }, 400);
  const texts = (Array.isArray(body.texts) ? body.texts : [])
    .map((t) => String(t ?? '').slice(0, MAX_CHARS));
  if (!texts.length) return json({ out: [] });
  if (texts.length > MAX_ITEMS) return json({ error: 'ส่งมาทีละไม่เกิน 40 ข้อความ' }, 413);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const keys = await Promise.all(texts.map(keyOf));

  // ---------- ของที่แปลไว้แล้ว ----------
  const { data: hit } = await db.from('topic_tr')
    .select('src_hash, body').eq('lang', to).in('src_hash', keys);
  const cache = new Map<string, string>((hit ?? []).map((r) => [r.src_hash, r.body]));

  const out: (string | null)[] = keys.map((k) => cache.get(k) ?? null);
  const missing = out.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
  if (!missing.length) return json({ out, how: 'cache' });

  if (!GEMINI_KEY) {
    // ยังไม่ได้ตั้งกุญแจ — คืนเท่าที่แคชมี ส่วนที่เหลือเป็น null
    // ฝั่งแอปเห็น null แล้วโชว์ข้อความต้นฉบับต่อไป ไม่ใช่ช่องว่าง
    return json({ out, how: 'cache-only', note: 'ยังไม่ได้ตั้ง GEMINI_API_KEY' }, 501);
  }

  try {
    const r = await geminiGenerate({
      system: SYSTEM,
      parts: [{
        text: `แปลเป็นภาษารหัส "${to}"\n\n` +
          JSON.stringify(missing.map((i) => texts[i])),
      }],
      json: true,
      responseSchema: { type: 'array', items: { type: 'string' } },
      think: 'off',
      temperature: 0.2,
      maxOutputTokens: 4096,
      budgetMs: 28_000,
    });
    const arr = JSON.parse(r.text || '[]');
    if (!Array.isArray(arr) || arr.length !== missing.length) {
      // ความยาวไม่ตรงแปลว่าจับคู่กลับไม่ได้ · เขียนของผิดลงแคชคือความเสียหายถาวร
      return json({ out, how: 'length-mismatch' }, 200);
    }

    const rows: { src_hash: string; lang: string; body: string }[] = [];
    missing.forEach((idx, n) => {
      const v = String(arr[n] ?? '');
      if (!v) return;
      out[idx] = v;
      rows.push({ src_hash: keys[idx], lang: to, body: v });
    });
    if (rows.length) await db.from('topic_tr').upsert(rows, { onConflict: 'src_hash,lang' });

    return json({ out, how: 'ai', model: r.model });
  } catch (e) {
    console.warn('translate failed:', (e as Error).message);
    // คืนเท่าที่มี — แปลไม่ได้ไม่ใช่เหตุผลที่จะทำให้ทั้งจอพัง
    return json({ out, how: 'error' }, 200);
  }
});
