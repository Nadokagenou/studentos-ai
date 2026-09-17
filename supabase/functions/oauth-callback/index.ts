// ============================================================
// oauth-callback — ที่ที่ Google ส่งผู้ใช้กลับมาหลังกดอนุญาต
// ------------------------------------------------------------
// ⚠️ ตอน deploy ต้องปิด "Verify JWT" ของฟังก์ชันนี้ (ดู supabase/config.toml)
//    Google เปิด URL นี้ในเบราว์เซอร์ของผู้ใช้ มันไม่มีทางแนบ JWT ของเรามาด้วย
//    เปิดไว้จะได้ 401 ทุกครั้งแบบเงียบ ๆ — อาการเหมือน line-webhook เป๊ะ
//
// ด่านจริงคือ state ที่เราเซ็นไว้ตอนกดปุ่มเชื่อม (ดู signState/verifyState):
//   · บอกว่าใครเป็นคนกด — ไม่มีอันนี้ ใครก็ยิง URL นี้เพื่อเอาบัญชี Google ของตัวเอง
//     ไปผูกกับบัญชี StudentOS ของคนอื่นได้ แล้วจะได้เห็นงานของเขาทั้งเทอม
//   · หมดอายุใน 10 นาที — ตั๋วที่ค้างอยู่ในประวัติเบราว์เซอร์จะใช้ซ้ำไม่ได้
//
// ไฟล์นี้ไม่คืน JSON เพราะคนที่มาถึงคือ "คนจริงในเบราว์เซอร์" ไม่ใช่โค้ด —
// ทุกทางออกจึงเป็นการพากลับเข้าแอปพร้อมผลลัพธ์ที่อ่านรู้เรื่อง
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cryptoReady, seal, verifyState } from '../_shared/integrations.ts';
import { classroomReady, exchangeCode, googleEmail } from '../_shared/classroom.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://nadokagenou.github.io/studentos-ai/';

const db = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const err = u.searchParams.get('error');
  const code = u.searchParams.get('code') ?? '';
  const state = u.searchParams.get('state') ?? '';

  // ผู้ใช้กดยกเลิกที่หน้าของ Google — ไม่ใช่ข้อผิดพลาด พากลับเงียบ ๆ
  if (err === 'access_denied') return back('cancelled');
  if (err) return back('error', err);
  if (!cryptoReady() || !classroomReady()) return back('error', 'server_not_configured');

  const st = await verifyState(state);
  if (!st || typeof st.u !== 'string') return back('error', 'bad_state');

  const uid = st.u as string;
  const provider = st.p === 'google_calendar' ? 'google_calendar' : 'google_classroom';

  try {
    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-callback`;
    const tok = await exchangeCode(code, redirectUri);
    const email = await googleEmail(tok.accessToken);

    const { data, error } = await db.from('integrations').upsert({
      user_id: uid,
      provider,
      account: email,
      secret: await seal(tok.refreshToken),
      scopes: tok.scopes,
      meta: {},
      status: 'active', error_msg: null, fail_count: 0,
      next_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider,account' }).select('id').single();
    if (error) throw error;

    // ซิงก์รอบแรกทันทีโดยไม่รอผล — คนที่เพิ่งกดเชื่อมกำลังเดินทางกลับเข้าแอปอยู่
    // ให้เขาไปถึงแล้วเจองานรออยู่แล้ว ดีกว่าให้จ้องหน้าจอเปล่าครึ่งชั่วโมง
    kick(String(data.id));

    return back('ok', provider);
  } catch (e) {
    console.error('[oauth-callback]', e instanceof Error ? e.message : e);
    return back('error', 'exchange_failed');
  }
});

/** พากลับเข้าแอปเสมอ — ไม่ว่าจบแบบไหน
 *  ไม่เชื่อค่า back ที่ติดมากับ state ถ้ามันไม่ได้อยู่ใต้ APP_URL: ตั๋วของเราเอง
 *  ก็จริง แต่ปลายทางที่เปิดได้ทุก URL คือ open redirect ที่เอาไปใช้หลอกคนต่อได้ */
function back(status: string, detail = ''): Response {
  const url = new URL(APP_URL);
  url.searchParams.set('integration', status);
  if (detail) url.searchParams.set('detail', detail);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

function kick(integrationId: string) {
  fetch(`${SUPABASE_URL}/functions/v1/sync-integrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ integration_id: integrationId }),
  }).catch(() => { /* cron เก็บให้เองใน 30 นาที */ });
}
