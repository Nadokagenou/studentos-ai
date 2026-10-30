// ============================================================
// sync-integrations — ตัวที่ทำให้งานไหลเข้ามาเองตอนที่ไม่มีใครเปิดแอป
// ------------------------------------------------------------
// ยิงจาก cron ทุก 30 นาที (migration 20260917090100) และยิงตรงได้จากปุ่ม
// "ซิงก์เดี๋ยวนี้" ผ่านฟังก์ชัน integrations โดยส่ง integration_id มาด้วย
//
// หน้าที่มีสี่อย่าง และข้อ 3 คือข้อที่ยากจริง:
//   1. ถอดรหัสกุญแจ แล้วถามต้นทางว่ามีงานอะไรบ้าง
//   2. แปลงเป็น StandardTask (ตัวเชื่อมแต่ละตัวทำเอง ไฟล์นี้ไม่รู้จัก API ของใครเลย)
//   3. เทียบกับทะเบียนว่า **อะไรใหม่ · อะไรถูกแก้ · อะไรหายไปจากต้นทาง**
//   4. หย่อนเฉพาะส่วนที่เปลี่ยนลง inbox_items ท่อเดิม
//
// ⚠️ ห้ามเขียนลง user_state.data เด็ดขาด — เหตุผลอยู่ในหัว migration
//    งานที่เขียนแทรกเข้าไปตรง ๆ จะหายเงียบ ๆ ภายใน 1.5 วินาที
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cryptoReady, fingerprint, unseal } from '../_shared/integrations.ts';
import type { StandardTask } from '../_shared/integrations.ts';
import { fetchIcs } from '../_shared/ics.ts';
import { classroomReady, fetchClassroom } from '../_shared/classroom.ts';
import { fetchCalendar } from '../_shared/gcal.ts';
import { isQuietHours, markSent, pushReady, pushToUser, pushToUserDetailed, unsentKeys } from '../_shared/notify.ts';
import type { PushResult } from '../_shared/notify.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY);

// กี่เส้นต่อรอบ — ฟังก์ชันมีเพดานเวลาของมัน และการเชื่อมหนึ่งเส้นใช้เวลาไม่เท่ากันเลย
// (ICS หนึ่งคำขอจบ · Classroom ยิงต่อคอร์ส) · เหลือไว้รอบหน้าดีกว่าโดนตัดกลางคัน
const BATCH = 10;

// ถอยห่างเมื่อพัง — 30 นาที · 2 ชม. · 8 ชม. · 24 ชม. แล้วคาที่วันละครั้ง
// ต้นทางล่มแล้วเรายิงซ้ำทุก 30 นาทีไปเรื่อย ๆ คือการเติมภาระให้ระบบที่กำลังมีปัญหาอยู่แล้ว
const BACKOFF_MIN = [30, 120, 480, 1440];
const NORMAL_GAP_MIN = 30;
// 30 ต.ค. 69 · Classroom ลองเร็วสองครั้งก่อนเข้าขั้นเดิม — ข้อมูลจริง 24 ชม.: 503 ×4 · timeout ×2 ·
// internal_failure ×1 ทุกครั้งหายเองในรอบถัดไป แต่ขั้นแรก 30 นาทีทำให้งานใหม่หายไปครึ่งชั่วโมงทุกครั้ง
// ทั้งที่ตั้งใจซิงก์ทุก 1 นาที · ล้มเกินสองครั้งติด = ต้นทางมีปัญหาจริง ถอยห่างเหมือนเดิม
const BACKOFF_FAST: Record<string, number[]> = { google_classroom: [2, 5] };
const backoffFor = (provider: string) => [...(BACKOFF_FAST[provider] ?? []), ...BACKOFF_MIN];

// ============================================================
// 16 ต.ค. 69 · Classroom ซิงก์ทุก 1 นาที (เจ้าของ: "ขอส่งแล้วเข้าเลย")
// ------------------------------------------------------------
// Google ไม่มีช่องทางแจ้งทันที — Pub/Sub ของ Classroom เองก็ "ปกติภายในไม่กี่นาที" ตามเอกสาร
// การถามทุกนาทีจึงเร็วที่สุดที่ทำได้จริง · ปฏิทิน (ICS/Calendar) ยังทุก 30 นาทีเหมือนเดิม
//
// ราคาของการถามถี่ ต้องจ่ายสามอย่าง และแต่ละอย่างมีตัวกันของมัน:
//   1. รอบซ้อนกัน — บัญชี 23 ห้องใช้ ~20 วิ ทุกนาทีจึงมีวันที่รอบใหม่เริ่มก่อนรอบเก่าจบ สองรอบซิงก์บัญชี
//      เดียวกันพร้อมกัน = กล่องเข้าได้งานใบเดียวกันสองแถว (เทสต์จับได้จริง) → จองแถวก่อนซิงก์ (sync_lease_until)
//   2. บัญชีใหญ่ถ่วงบัญชีอื่น → ซิงก์ขนานกันทีละ SYNC_PARALLEL บัญชี
//   3. รอบถัดไปต้องไม่หลุดรอบ cron → นัดเทียบกับนาทีที่รอบนี้ "เริ่ม" ลบ 1 วิ ไม่ใช่เทียบกับตอนเสร็จ
// ============================================================
// ---------- ความด่วนของ push ----------
// 16 ต.ค. 69 · ข้อมูลจริง: เซิร์ฟเวอร์ส่งถึงสามบัญชีห่างกันไม่เกิน 3 วิ แต่เจ้าของเห็นแจ้งเตือนมาไม่พร้อมกันได้ถึง ~5 นาที
// เดิมไม่ได้ใส่ความด่วน = ค่าปริยายของ web-push (normal · TTL 4 สัปดาห์) → Android ที่ประหยัดแบตกับ iPhone ที่จอดับ
// พักไว้จนเครื่อง "ตื่น" ทีละเครื่อง · บทเรียนเดียวกับ pushOpts ใน send-reminders (เตือนงานใกล้กำหนด · แชทเพื่อน)
// high ใช้ได้ เพราะส่งอย่างมากดอกเดียวต่อรอบต่อบัญชี (ดูข้อ 1 ของ notifyNewItems)
// TTL: งานใหม่ยังมีประโยชน์ถ้ามาถึงภายในครึ่งวัน (เครื่องปิดทั้งคืน) · ให้เชื่อมใหม่ยังจริงทั้งวัน
const PUSH_OPTS_NEW = { urgency: 'high' as const, TTL: 12 * 3600 };
const PUSH_OPTS_REAUTH = { urgency: 'high' as const, TTL: 24 * 3600 };

const GAP_MIN: Record<string, number> = { google_classroom: 1 };
const gapFor = (provider: string) => GAP_MIN[provider] ?? NORMAL_GAP_MIN;
const LEASE_MS = 3 * 60_000;   // รอบที่ตายกลางทางคืนแถวเองหลังนี้ · ยาวกว่ารอบที่ช้าที่สุดที่วัดได้ (~25 วิ) หลายเท่า
const SYNC_PARALLEL = 4;

/** นัดรอบถัดไปให้ตรงกับรอบ cron: ต้นนาทีที่รอบนี้เริ่ม + gap − 1 วิ · ไม่ขึ้นกับว่ารอบนี้เริ่มช้าหรือนานแค่ไหน */
function nextTickAt(runStart: number, gapMin: number): string {
  return new Date(Math.floor(runStart / 60_000) * 60_000 + gapMin * 60_000 - 1000).toISOString();
}

/** จองแถวก่อนซิงก์ · คืน false เมื่อมีรอบอื่นจองอยู่และยังไม่หมดอายุ (นาฬิกาเดียวกันทั้งตอนตั้งและตอนเทียบ) */
async function claimRow(id: string): Promise<boolean> {
  const now = Date.now();
  const { data, error } = await db.from('integrations')
    .update({ sync_lease_until: new Date(now + LEASE_MS).toISOString() })
    .eq('id', id)
    .or(`sync_lease_until.is.null,sync_lease_until.lt.${new Date(now).toISOString()}`)
    .select('id');
  if (error) throw error;
  return !!(data && data.length);
}
async function releaseRow(id: string): Promise<void> {
  await db.from('integrations').update({ sync_lease_until: null }).eq('id', id);
}

/** ทำงานพร้อมกันไม่เกิน limit ชิ้น · คืนผลตามลำดับเดิม */
async function inPool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

type Row = {
  id: string; user_id: string; provider: string; account: string;
  secret: string | null; meta: Record<string, unknown>; fail_count: number;
  last_sync_at: string | null;
  updated_at?: string | null;   // ขยับทุกครั้งที่กดเชื่อมใหม่ = รุ่นของกุญแจ (ใช้กันแจ้งเตือนซ้ำ)
  // รอบนี้เป็นการซิงก์ครั้งแรกของการเชื่อมเส้นนี้ไหม — ต้องอ่านก่อนที่ syncOne
  // จะเขียน last_sync_at ทับ ไม่งั้นทุกอย่างดูเหมือนไม่ใช่ครั้งแรกไปหมด
  first_sync?: boolean;
  run_start?: number;   // เวลาที่รอบนี้เริ่ม — ใช้นัดรอบถัดไปให้ตรงกับรอบ cron (nextTickAt)
  force?: boolean;      // "ซิงก์เดี๋ยวนี้" — เทียบทะเบียนเต็มเสมอ ไม่ใช้ทางลัดรายการเดิม (ดู listFingerprint)
};

Deno.serve(async (req) => {
  try {
    if (!cryptoReady()) {
      return json({ ok: false, error: 'ยังไม่ได้ตั้ง INTEGRATION_KEY' }, 500);
    }
    const body = await req.json().catch(() => ({}));
    const only = typeof body?.integration_id === 'string' ? body.integration_id : null;
    // 16 ต.ค. 69 · แยกรายบัญชีฝั่งเซิร์ฟเวอร์ — กุญแจ publishable อยู่ใน repo สาธารณะ และ verify_jwt รับมัน
    // เดิมใครก็ส่ง integration_id ของคนอื่นมาสั่งซิงก์ได้ และคำตอบบอก id + ตัวเลขของทุกบัญชี
    // สั่งซิงก์รายเส้นได้เฉพาะผู้ถือกุญแจ service (ฟังก์ชัน integrations ตรวจเจ้าของแล้วค่อยเรียก)
    // รอบ cron ยังเรียกด้วยกุญแจ publishable ได้เหมือนเดิม แต่ได้แค่ตัวเลขรวม — รายบัญชีอยู่ใน meta.last_run
    const trusted = (req.headers.get('Authorization') ?? '') === `Bearer ${SERVICE_KEY}`;
    if (only && !trusted) return json({ ok: false, error: 'ต้องเรียกผ่านฟังก์ชัน integrations' }, 403);

    let q = db.from('integrations')
      .select('id, user_id, provider, account, secret, meta, fail_count, last_sync_at, updated_at');
    q = only
      ? q.eq('id', only)
      // paused = ผู้ใช้ปิดไว้เอง · needs_reauth = ลองใหม่เองอีกกี่รอบก็ไม่หาย ต้องรอคนมากด
      : q.in('status', ['active', 'error']).lte('next_sync_at', new Date().toISOString())
         .order('next_sync_at', { ascending: true }).limit(BATCH);

    const { data, error } = await q;
    if (error) throw error;

    const runStart = Date.now();
    const ran = await inPool((data || []) as Row[], SYNC_PARALLEL, async row => {
      // อีกรอบกำลังซิงก์บัญชีนี้อยู่ — ปล่อยให้รอบนั้นทำ ไม่ซ้อน (ดูหัวข้อ "ซิงก์ทุก 1 นาที")
      if (!(await claimRow(row.id))) return null;
      try { return await syncOne({ ...row, first_sync: !row.last_sync_at, run_start: runStart, force: !!only }); }
      finally { await releaseRow(row.id).catch(() => {}); }
    });
    const out = ran.filter(r => r !== null);
    const okCount = out.filter(r => r.status === 'ok' || r.status === 'unchanged').length;
    return json(trusted
      ? { ok: true, ran: out.length, results: out }
      : { ok: true, ran: out.length, ok_count: okCount, error_count: out.length - okCount });
  } catch (e) {
    console.error('[sync] รอบนี้ล้มทั้งรอบ:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

// ============================================================
// 16 ต.ค. 69 · บันทึกผลรอบซิงก์รายบัญชี
// ------------------------------------------------------------
// ข้อมูลจริง: cron (pg_net) รอคำตอบแค่ 5 วินาที แต่รอบหนึ่งใช้ ~38 วิ (บัญชี 23 ห้องคนเดียว 20 วิ)
// ทุกรอบจึงจบด้วย "Timeout of 5000 ms" แล้วผลที่ฟังก์ชันคืน (ส่งกี่ใบ · push ถึงกี่เครื่อง) หายหมด
// ตอนเจ้าของถามว่า "แจ้งเตือนเด้งไหม" จึงไม่มีอะไรให้ตอบนอกจากเดา
// ตอนนี้ทุกรอบเขียนสรุปลง integrations.meta.last_run (ของล่าสุดต่อบัญชี) และพิมพ์หนึ่งบรรทัดลง
// Function logs ด้วย · เป็นตัวเลขล้วน ไม่มีชื่องาน ไม่มีอีเมล — อ่านใน dashboard ได้โดยไม่เห็นข้อมูลนักเรียน
// ============================================================
type RunLog = {
  at: string; ms: number; status: string; error?: string;
  tasks?: number; delivered?: number; push?: PushResult | null;
};

async function syncOne(row: Row) {
  const t0 = Date.now();
  // เวลาเป็นตัวเลขของรอบนี้ — ใช้นาฬิกาเดียวกับส่วนอื่นของไฟล์ (Date.now) ไม่ใช่ new Date() เปล่า ๆ
  const done = (status: string, extra: Partial<RunLog> = {}): RunLog => {
    const log: RunLog = { at: new Date(Date.now()).toISOString(), ms: Date.now() - t0, status, ...extra };
    console.log('[sync-run] ' + JSON.stringify({ integration: row.id, provider: row.provider, ...log }));
    return log;
  };
  try {
    const secret = await unseal(row.secret);
    if (!secret) {
      // ถอดรหัสไม่ออก = กุญแจถูกเปลี่ยน หรือข้อมูลเสีย · ลองใหม่เองไม่มีทางหาย
      await markReauth(row, 'กุญแจที่เก็บไว้ใช้ไม่ได้แล้ว ต้องเชื่อมใหม่',
        done('needs_reauth', { error: 'unseal' }));
      return { id: row.id, status: 'needs_reauth' };
    }

    const res = await pull(row, secret);
    const listFp = res.unchanged ? null : await listFingerprint(res);
    if (res.unchanged || (!row.force && listFp === row.meta?.list_fp)) {
      // ของค้างจากกลางดึกยังต้องถูกแจ้งตอนเช้า แม้รายการจะเหมือนเดิม (ดู heldTasks)
      // กวาดเฉพาะช่วงที่ยังมีของให้กวาด — นอกช่วงนั้น heldTasks คืนว่างแน่นอน การอ่านกล่องเข้าทุกนาทีคือ egress เปล่า ๆ
      const held = Date.parse(String(row.meta?.held_until ?? '')) > Date.now();
      const push = held ? await notifyNewItems(row, []).catch(() => null) : null;
      await db.from('integrations').update({
        last_sync_at: new Date().toISOString(),
        next_sync_at: nextTickAt(row.run_start ?? t0, gapFor(row.provider)),
        status: 'active', error_msg: null, fail_count: 0,
        // res.meta ยังต้องเก็บ — ICS ที่ etag เปลี่ยนแต่เนื้อเท่าเดิม ต้องจำ etag ใหม่ ไม่งั้นโหลดเต็มทุกรอบ
        meta: { ...row.meta, ...res.meta, last_run: done('unchanged', push ? { push } : {}) },
      }).eq('id', row.id);
      return { id: row.id, status: 'unchanged', sent: 0, pushed: push?.ok ?? 0 };
    }

    const sent = await reconcile(row, res.tasks, new Set(res.doneIds ?? []));

    await db.from('integrations').update({
      last_sync_at: new Date().toISOString(),
      next_sync_at: nextTickAt(row.run_start ?? t0, gapFor(row.provider)),
      status: 'active', error_msg: null, fail_count: 0,
      meta: { ...row.meta, ...res.meta,
        // จำไว้ **หลัง** reconcile สำเร็จเท่านั้น — รอบที่ล้มกลางทางห้ามทิ้งลายนิ้วมือไว้ให้รอบหน้าข้าม
        list_fp: listFp,
        // รอบแรกปักหมุดทุกใบไปแล้ว ไม่มีอะไรค้างให้กวาด · แถวที่ยังไม่เคยมีลายนิ้วมือ (เพิ่ง deploy · หลังรอบที่ล้ม)
        // อาจมีของค้างที่มาก่อนหน้านี้ ให้กวาดต่ออีกหนึ่งช่วงเผื่อไว้
        ...((sent.fresh || !row.meta?.list_fp) && !row.first_sync ? { held_until: new Date(Date.now() + HELD_HOURS * 3.6e6).toISOString() } : {}),
        last_run: done('ok', { tasks: res.tasks.length, delivered: sent.sent, push: sent.push }) },
      ...(res.account ? { account: res.account } : {}),
    }).eq('id', row.id);

    return { id: row.id, status: 'ok', sent: sent.sent, pushed: sent.pushed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const log = done('error', { error: msg.slice(0, 200) });
    // reauth = ปัญหาที่ต้องให้คนมากด · ที่เหลือคือปัญหาชั่วคราวที่ถอยห่างแล้วลองใหม่เองได้
    if ((e as { reauth?: boolean })?.reauth) {
      await markReauth(row, msg, { ...log, status: 'needs_reauth' });
      return { id: row.id, status: 'needs_reauth', error: msg };
    }
    const ladder = backoffFor(row.provider);
    const n = Math.min(row.fail_count + 1, ladder.length);
    const wait = ladder[n - 1];
    await db.from('integrations').update({
      status: 'error', error_msg: msg.slice(0, 300), fail_count: n,
      last_sync_at: new Date().toISOString(),
      // ช่วงสั้นนัดตามรอบ cron (เหมือนรอบปกติ) · minutesFromNow หักเผื่อ 2 นาที ซึ่งจะกลืน "รอ 2 นาที" จนเหลือศูนย์
      next_sync_at: wait < NORMAL_GAP_MIN ? nextTickAt(row.run_start ?? t0, wait) : minutesFromNow(wait),
      // diag ของรอบที่สำเร็จล่าสุดยังอยู่ · ลืมลายนิ้วมือ — ทะเบียนอาจถูกเขียนไปครึ่งทาง รอบหน้าต้องเทียบเต็ม
      meta: { ...row.meta, list_fp: null, last_run: log },
    }).eq('id', row.id);
    return { id: row.id, status: 'error', error: msg };
  }
}

async function markReauth(row: Row, msg: string, log?: RunLog) {
  // ⚠️ ทำไมต้องบอกเจ้าตัว (15 ต.ค. 69): การเชื่อม Google ของนักเรียนตายเงียบ ๆ จริง
  // ข้อมูล production: การเชื่อมที่ออกกุญแจ 18 ก.ย. 05:46 ตายด้วย invalid_grant ในรอบ cron
  // 25 ก.ย. 06:00 — ครบ 7 วันพอดี ทั้ง Classroom และ Calendar พร้อมกัน · นั่นคืออายุ refresh token
  // ของแอปที่ OAuth consent screen ยังเป็นโหมด Testing (แก้ที่ Google Cloud Console ไม่ใช่ที่โค้ด)
  // แต่ไม่ว่าสาเหตุคืออะไร ผลคืองานจากครูหยุดไหลโดยที่นักเรียนไม่รู้ตัวเลย เพราะจอเดียวที่บอก
  // คือจอตัวเชื่อมซึ่งไม่มีใครเปิดดูทุกวัน · คนพัฒนาไม่เจอเพราะกดเชื่อมใหม่บ่อยจนกุญแจไม่เคยแก่
  const quiet = isQuietHours();
  await db.from('integrations').update({
    status: 'needs_reauth', error_msg: msg.slice(0, 300),
    last_sync_at: new Date().toISOString(),
    // ไม่ต้องยิงซ้ำอีกจนกว่าคนจะมากดเชื่อมใหม่ — ตั้งไว้ไกล ๆ แทนการปิดสวิตช์
    // เผื่อกรณีที่ต้นทางหายชั่วคราวแล้วกลับมาเอง จะได้ลองอีกครั้งในวันรุ่งขึ้น
    // ตายตอนกลางดึก = ลองใหม่ตอนเช้าแทน ไม่งั้น +24 ชม. ก็ตกกลางดึกอีก แล้วไม่มีวันได้แจ้ง
    next_sync_at: quiet ? morningAfterQuiet() : minutesFromNow(1440),
    ...(log ? { meta: { ...row.meta, list_fp: null, last_run: log } } : {}),
  }).eq('id', row.id);
  if (!quiet) await notifyReauth(row).catch(() => 0);
}

/** ดอกเดียวต่อกุญแจหนึ่งชุด — คีย์ผูกกับ updated_at ซึ่ง oauth-callback ขยับทุกครั้งที่กดเชื่อมใหม่
 *  กุญแจชุดใหม่ตายอีกรอบจึงได้แจ้งอีกครั้ง แต่ชุดเดิมที่ถูกลองซ้ำวันละครั้งไม่ดังซ้ำ */
async function notifyReauth(row: Row): Promise<number> {
  if (!pushReady()) return 0;
  const key = `reauth::${row.id}::${row.updated_at || ''}`;
  if (!(await unsentKeys(db, row.user_id, [key])).length) return 0;
  const name = row.provider === 'google_classroom' ? 'Google Classroom'
             : row.provider === 'google_calendar' ? 'Google Calendar' : 'ปฏิทินของโรงเรียน';
  const ok = await pushToUser(db, row.user_id, {
    title: `${name} หยุดส่งงานเข้ามาแล้ว`,
    body: `${row.account ? row.account + ' · ' : ''}เปิดแอปแล้วกด "เชื่อมใหม่" งานจากครูจะกลับมาเอง`,
    tag: 'integ-reauth',
  }, PUSH_OPTS_REAUTH);
  await markSent(db, row.user_id, [key]);
  return ok;
}

/** 07:05 น. เวลาไทย = 00:05 UTC — ช่วงเงียบ (22:00–07:00 ไทย) อยู่ใน 15:00–24:00 UTC ทั้งหมด */
function morningAfterQuiet(): string {
  const d = new Date(Date.now());   // นาฬิกาเดียวกับ isQuietHours — ไม่ใช่ new Date() เปล่า ๆ
  d.setUTCHours(24, 5, 0, 0);
  return d.toISOString();
}

// ---------- ทะเบียนตัวเชื่อม ----------
// เพิ่มเจ้าใหม่ = เขียนไฟล์ใน _shared/ แล้วต่ออีกหนึ่ง case ตรงนี้ · ที่เหลือไม่ต้องแตะ
async function pull(row: Row, secret: string): Promise<{
  tasks: StandardTask[]; meta?: Record<string, unknown>; account?: string; unchanged?: boolean;
  doneIds?: string[];   // งานที่ต้นทางบอกว่า "ส่งแล้ว" — มีแค่ Classroom
}> {
  if (row.provider === 'ics') {
    const tz = String(row.meta?.tz || 'Asia/Bangkok');
    const r = await fetchIcs(secret, tz, {
      etag: (row.meta?.etag as string) ?? null,
      lastModified: (row.meta?.last_modified as string) ?? null,
    });
    if (r.unchanged) return { tasks: [], unchanged: true };
    return {
      tasks: r.tasks,
      meta: { etag: r.etag ?? null, last_modified: r.lastModified ?? null, cal_name: r.calName },
      account: r.calName || undefined,
    };
  }

  if (row.provider === 'google_classroom') {
    if (!classroomReady()) throw new Error('ยังไม่ได้ตั้งกุญแจ Google ฝั่งเซิร์ฟเวอร์');
    const r = await fetchClassroom(secret);
    return { tasks: r.tasks, account: r.account || undefined, meta: { diag: r.diag }, doneIds: r.doneIds };
  }

  if (row.provider === 'google_calendar') {
    if (!classroomReady()) throw new Error('ยังไม่ได้ตั้งกุญแจ Google ฝั่งเซิร์ฟเวอร์');
    const r = await fetchCalendar(secret);
    return { tasks: r.tasks };
  }

  throw new Error(`ไม่รู้จักตัวเชื่อม "${row.provider}"`);
}

// ============================================================
// 29 ต.ค. 69 · ไม่มีงานใหม่ = ไม่แตะฐานข้อมูล
// ------------------------------------------------------------
// ข้อมูลจริง: Egress ของ Supabase เกินแผนฟรี 363% · log 24 ชม. มี ~45,000 คำขอ 82% มาจาก cron
// ตัวนี้ทุกนาทีลากทะเบียนทั้งบัญชีออกมาเทียบ (~5,600 ครั้ง/วัน · บัญชีใหญ่ 212 แถว) และกวาด
// inbox_items หาของค้าง (~3,700 ครั้ง/วัน) ทั้งที่เกือบทุกรอบ Classroom ตอบเหมือนรอบก่อนเป๊ะ
// เจ้าของ: "อยากให้มันตรวจดึงตอนที่มีงานเท่านั้น"
//
// Google ยังถูกถามทุกนาทีเหมือนเดิม (ขาเข้า ไม่ใช่ egress ของเรา) · งานใหม่ยังเข้าภายในรอบเดียว
// ที่เปลี่ยนคือ ถ้ารายการที่ได้มาเหมือนรอบที่ reconcile สำเร็จล่าสุด → ข้าม reconcile ทั้งก้อน
//
// ทำไมข้ามได้โดยไม่พลาดอะไร: reconcile กับรายการเดิมซ้ำเป็นจุดคงที่ — ใบที่เคยส่ง/จดว่าเก่าแล้ว
// ถูก continue ก่อนด่านเวลา (STALE_MS) ทุกใบ · ใบที่หายไปถูกตัดสินครั้งเดียวตอนมันหาย
// สิ่งเดียวที่ขึ้นกับเวลาจริงคือการกวาดของค้างตอนเช้า → แยกไปทำในทางลัดเองตาม held_until
//
// ลายนิ้วมือต้องครอบทุกอย่างที่ reconcile ใช้ตัดสิน: ลายนิ้วมือรายใบ · doneIds · account
// ⚠️ แก้กฎใน reconcile เมื่อไหร่ ให้ขยับ LIST_FP_V — ไม่งั้นบัญชีที่รายการนิ่งจะไม่ได้กฎใหม่
//    จนกว่าครูจะสั่งงานถัดไป
// ============================================================
const LIST_FP_V = 1;

async function listFingerprint(res: { tasks: StandardTask[]; account?: string; doneIds?: string[] }): Promise<string> {
  const items: string[] = [];
  for (const t of res.tasks) {
    // ใบที่ reconcile ข้าม (ไม่มี id/ชื่อ) ไม่นับ — ให้ตรงกับสิ่งที่ reconcile เห็นจริง
    if (t.sourceId && t.title) items.push(t.sourceId + '=' + await fingerprint(t));
  }
  const face = JSON.stringify([LIST_FP_V, res.account ?? '', items.sort(), [...(res.doneIds ?? [])].sort()]);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(face));
  return Array.from(new Uint8Array(buf).slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---------- เทียบกับทะเบียน ----------
// หัวใจของการ "ไม่ส่งซ้ำ" และ "ตามการแก้ไขให้ทัน" อยู่ที่นี่ที่เดียว
async function reconcile(row: Row, tasks: StandardTask[], doneIds: Set<string> = new Set()) {
  const { data: known, error } = await db.from('integration_items')
    .select('source_id, fingerprint, sent_fingerprint, state, title, due')
    .eq('integration_id', row.id);
  if (error) throw error;

  const byId = new Map((known || []).map(k => [k.source_id, k]));
  const now = new Date().toISOString();

  // ---------- งานที่เลยกำหนดไปแล้ว ไม่ต้องส่งเข้ากล่องเข้า ----------
  // เจอตอนทดสอบกับปฏิทินจริง: ฟีดหนึ่งใบมี 317 รายการ ย้อนหลังไปถึงปี 2021
  // ทั้งหมดถูกหย่อนเข้ากล่องเข้าในวินาทีที่กดเชื่อม — ปฏิทินของโรงเรียนจริงก็หน้าตาแบบนี้
  // (งานทั้งเทอมที่ผ่านมาอยู่ในฟีดเดียวกันกับงานสัปดาห์หน้า)
  //
  // ผลคือกล่องเข้าที่มีเพดาน 150 รายการถูกงานที่ส่งไปแล้วเมื่อปีที่แล้วกลืนจนหมด
  // แล้วงานที่ต้องส่งพรุ่งนี้หายไปอยู่ท้ายแถว ซึ่งแย่กว่าการไม่เชื่อมเลย
  //
  // เผื่อไว้หนึ่งวันเต็ม ไม่ใช่ตัดที่ "เดี๋ยวนี้" — งานที่ครบกำหนดเมื่อเช้ายังเป็นงานที่
  // เจ้าตัวอาจยังไม่ได้ทำและยังส่งตามได้ · ที่เก่ากว่านั้นคือประวัติศาสตร์
  const STALE_MS = 24 * 3600_000;
  const staleBefore = Date.now() - STALE_MS;
  // งานที่ครูไม่ได้ตั้งกำหนดส่ง ด่านข้างบนตัดสินไม่ได้เลย จึงไม่เคย "เก่า" สักใบ
  // เจอกับบัญชีจริง (7 ต.ค. 2569): งาน Classroom ไม่มีกำหนดส่ง 72 ใบตั้งแต่ต้นเทอม
  // ไหลเข้ามาเป็นงานค้าง หน้าแรกขึ้น "ค้าง 80 งาน" ทั้งที่งานจริงมีแค่ 8
  // ใช้วันที่โพสต์แทน · สองสัปดาห์คือนานพอให้งานที่ครูสั่งปากเปล่าว่า "ส่งสัปดาห์หน้า"
  // ยังอยู่ในแผน ส่วนที่เก่ากว่านั้นคือใบงานที่ทำในห้องไปแล้วแต่ไม่ได้กดส่งในระบบ
  // ต้นทางที่ไม่บอกวันโพสต์ (ICS) ยังได้ทุกใบเหมือนเดิม — ไม่รู้ ดีกว่าเดาแล้วทิ้งงานจริง
  const UNDATED_STALE_MS = 14 * 24 * 3600_000;
  const undatedBefore = Date.now() - UNDATED_STALE_MS;
  const deliver: { task: StandardTask; op: 'new' | 'update' | 'cancel'; fp: string; reason?: string }[] = [];
  const ledger: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const t of tasks) {
    if (!t.sourceId || !t.title) continue;
    seen.add(t.sourceId);
    const fp = await fingerprint(t);
    const old = byId.get(t.sourceId);

    // ไม่มีอะไรเปลี่ยน และเคยส่งไปแล้ว — ข้ามไปเลย ไม่ต้องเขียนอะไรทั้งนั้น
    // ⚠️ ต้องยัง active อยู่ด้วย (16 ต.ค. 69) · ใบที่ทะเบียนปิดไปแล้ว (ส่งแล้ว/หายไป) แล้วกลับมา
    // มีลายนิ้วมือเท่าเดิมเป๊ะ — เดิมถูกข้ามตรงนี้ตลอดไป ทะเบียนค้างเป็น cancelled และงานไม่กลับเข้าแอปอีกเลย
    // (นักเรียนกด "ยกเลิกการส่ง" · ครูคืนให้แก้ · Classroom ตอบห้องหนึ่งหายไปชั่วคราว)
    // ใบที่ต้นทางยังส่งมาพร้อมธงยกเลิก (ICS STATUS:CANCELLED) ไม่ใช่ "กลับมา" — ไม่งั้นส่ง cancel ซ้ำทุกรอบ
    const reopened = !!old && old.state !== 'active' && !t.cancelled;
    if (old && old.fingerprint === fp && old.sent_fingerprint === fp && !reopened) continue;

    // เก่าเกินกว่าจะเป็นงานที่ทำอะไรต่อได้ — จดไว้ในทะเบียนว่ารู้จักแล้ว แต่ไม่ส่งต่อ
    // จดด้วย sent_fingerprint เท่ากับของปัจจุบัน เพื่อไม่ต้องคิดใหม่ทุกรอบ sync
    // แต่ถ้าวันหลังครูเลื่อนกำหนดส่งมาข้างหน้า ลายนิ้วมือจะเปลี่ยน แล้วมันจะกลับเข้าเส้นทางนี้
    // อีกครั้งโดยอัตโนมัติ คราวนี้ผ่านด่านเพราะกำหนดส่งอยู่ในอนาคตแล้ว
    const stale = !t.cancelled && (t.due
      ? new Date(t.due).getTime() < staleBefore
      : !!t.posted && new Date(t.posted).getTime() < undatedBefore);

    // "ใหม่" = ยังไม่เคยไปถึงแอปจริง ไม่ใช่ "ยังไม่มีในทะเบียน" — รอบที่ล้มหลังจดทะเบียนแต่ก่อนเขียน
    // กล่องเข้า ทิ้งแถวที่ไม่มี sent_fingerprint ไว้ · เดิมรอบหน้าส่งเป็น update ซึ่งแอปยังสร้างงานให้
    // แต่ไม่มีดอกแจ้งเตือนเลย (แจ้งเฉพาะ op 'new') · ใบที่กลับมาหลังปิดทะเบียนเคยถึงแอปแล้ว จึงเป็น update
    if (!stale) deliver.push({ task: t, op: t.cancelled ? 'cancel' : (old?.sent_fingerprint ? 'update' : 'new'), fp });
    ledger.push({
      integration_id: row.id, source_id: t.sourceId, user_id: row.user_id,
      fingerprint: fp, title: t.title.slice(0, 200), due: t.due ?? null, url: t.url ?? null,
      state: t.cancelled ? 'cancelled' : 'active',
      seen_at: now, updated_at: now,
      ...(stale ? { sent_fingerprint: fp, sent_at: now } : {}),
    });
  }

  // ---------- ของที่หายไปเฉย ๆ ----------
  // ICS ไม่มีวิธีบอกว่า "ลบแล้ว" มันแค่ไม่ส่งมาอีก · Classroom ก็หยุดส่งงานที่ถูกลบ
  // เงียบ ๆ เหมือนกัน — การหายไปจึงเป็นสัญญาณเดียวที่มี และต้องแปลให้ถูก
  //
  // แต่ต้องแปลอย่างระวัง: ปฏิทินที่ตัดงานเก่าออกหลังผ่านไป 30 วัน จะทำให้งานที่
  // "ส่งไปแล้วเมื่อเดือนที่แล้ว" หายจากฟีดพร้อมกันทีเดียวสิบใบ — ถ้าตีความว่าครูยกเลิก
  // นักเรียนจะได้แจ้งเตือน "งานถูกยกเลิก" สิบดอกรวดเรื่องงานที่เขาทำส่งไปนานแล้ว
  // จึงบอกแอปเฉพาะงานที่ **ยังไม่ถึงกำหนด** เท่านั้น ที่เหลือแค่ปิดทะเบียนเงียบ ๆ
  //
  // 16 ต.ค. 69 · "หายไป" มีสองแบบที่ต้องจดต่างกัน: Classroom ไม่ส่งงานที่นักเรียน "ส่งแล้ว" มาใน tasks
  // (classroom.ts กรองออก) → เดิมถูกจดว่า cancelled และแอปขึ้นว่า "ครูยกเลิกงาน" ทั้งที่เด็กเพิ่งกดส่ง
  // ตอนนี้จดเป็น done และแนบ reason: 'turned_in' · op ยังเป็น cancel เหมือนเดิมโดยตั้งใจ
  // เพราะแอปรุ่นที่ใช้อยู่รู้จักแค่ cancel (เอาออกจากแผน = ผลที่ถูกแล้ว) · op ชนิดใหม่ที่แอปไม่รู้จัก
  // จะกลายเป็น update ที่ไม่ทำอะไร แล้วงานที่ส่งไปแล้วจะค้างอยู่ในแผน — แย่กว่าข้อความผิด
  // ข้อความในแอปเปลี่ยนตาม reason ได้ทีหลังโดยไม่ต้องแตะเซิร์ฟเวอร์อีก
  const cutoff = Date.now();
  for (const k of (known || [])) {
    if (seen.has(k.source_id) || k.state === 'cancelled' || k.state === 'done') continue;
    const turnedIn = doneIds.has(k.source_id);
    ledger.push({
      integration_id: row.id, source_id: k.source_id, user_id: row.user_id,
      fingerprint: k.fingerprint, title: k.title, due: k.due,
      state: turnedIn ? 'done' : 'cancelled', seen_at: now, updated_at: now,
    });
    // บอกแอปเฉพาะงานที่เคยส่งไปแล้วจริง และยังไม่ถึงกำหนด
    const pending = k.sent_fingerprint && k.due && new Date(k.due).getTime() > cutoff;
    if (!pending) continue;
    deliver.push({
      task: { sourceId: k.source_id, title: k.title || '', due: k.due, cancelled: true },
      op: 'cancel', fp: k.fingerprint, ...(turnedIn ? { reason: 'turned_in' } : {}),
    });
  }

  if (ledger.length) {
    const { error: upErr } = await db.from('integration_items')
      .upsert(ledger, { onConflict: 'integration_id,source_id' });
    if (upErr) throw upErr;
  }

  // ไม่มีของใหม่รอบนี้ ก็ยังต้องดูของที่ค้างจากกลางดึก — รอบ 07:00 ส่วนใหญ่ไม่มีของใหม่เลย
  // ถ้าออกตรงนี้ไปเฉย ๆ ของที่เข้ามาตอนสี่ทุ่มจะไม่มีวันถูกแจ้ง (ดู heldTasks)
  if (!deliver.length) {
    const push = await notifyNewItems(row, []).catch(() => null);
    return { sent: 0, fresh: 0, pushed: push?.ok ?? 0, push };
  }

  // ---------- หย่อนลงท่อเดิม ----------
  const rows = deliver.map(d => ({
    user_id: row.user_id,
    source: row.provider,
    raw: humanLine(d.task),
    meta: {
      v: 1,
      structured: true,          // ฝั่งแอปเห็นธงนี้แล้วข้ามตัวแกะข้อความทั้งหมด
      op: d.op,
      ...(d.reason ? { reason: d.reason } : {}),
      provider: row.provider,
      // กุญแจที่ฝั่งแอปใช้จับว่า "งานใบนี้คืองานใบเดิมที่เคยรับไปแล้ว"
      // ใช้ provider ไม่ใช่ integration_id เพราะถ้าผู้ใช้ตัดการเชื่อมแล้วเชื่อมใหม่
      // มันต้องจับได้ว่าเป็นงานเดิม ไม่ใช่งานใหม่ทั้งปฏิทิน
      srcKey: `${row.provider}:${d.task.sourceId}`,
      sourceId: d.task.sourceId,
      sourceUrl: d.task.url ?? null,
      account: row.account || null,
      task: {
        title: d.task.title,
        detail: d.task.detail ?? '',
        subject: d.task.subject ?? '',
        due: d.task.due ?? null,
        type: d.task.type ?? 'homework',
      },
    },
  }));

  const { error: inErr } = await db.from('inbox_items').insert(rows);
  if (inErr) throw inErr;

  // ทำเครื่องหมายว่าส่งแล้ว **หลัง** เขียน inbox สำเร็จเท่านั้น
  // สลับลำดับเมื่อไหร่ เน็ตหลุดกลางทางจะกลายเป็น "ทะเบียนบอกว่าส่งแล้ว แต่ไม่มีใครได้รับ"
  // ซึ่งเป็นความเงียบที่ไม่มีใครจับได้จนกว่าจะถึงวันส่งงาน
  for (const d of deliver) {
    await db.from('integration_items')
      .update({ sent_fingerprint: d.fp, sent_at: now })
      .eq('integration_id', row.id).eq('source_id', d.task.sourceId);
  }

  // บอกเจ้าตัวว่ามีของใหม่เข้ามา — ทำหลังทุกอย่างสำเร็จแล้วเท่านั้น
  // ล้มตรงนี้ไม่ทำให้รอบ sync ล้ม งานยังอยู่ในกล่องเข้าครบ แค่ไม่มีดอกเตือน
  const push = await notifyNewItems(row, deliver).catch(() => null);

  return { sent: deliver.length, fresh: deliver.filter(d => d.op === 'new').length, pushed: push?.ok ?? 0, push };
}

// ============================================================
// แจ้งเตือนว่ามีของใหม่ไหลเข้ามา
// ------------------------------------------------------------
// ทำไมต้องมี ทั้งที่ send-reminders เตือนงานใกล้กำหนดอยู่แล้ว:
// ตั้งแต่มีตัวเชื่อม งานเข้าแอปได้เองตอนที่เจ้าตัวไม่ได้เปิดแอปเลย · ถ้าไม่บอก
// เขาจะไม่รู้จนกว่าจะบังเอิญเปิดแอป หรือจนกว่ามันจะใกล้กำหนดส่งแล้ว
// ซึ่งสายไปสำหรับงานที่ครูสั่งล่วงหน้าหนึ่งสัปดาห์
//
// สี่ข้อที่ตั้งใจให้เป็นแบบนี้ และแต่ละข้อมีราคาถ้าทำกลับกัน:
//
//   1. **ดอกเดียวต่อรอบ ไม่ใช่ดอกต่องาน** — เชื่อมปฏิทินครั้งแรกได้ 133 รายการ
//      ยิงทีละใบคือการสอนให้คนปิดการแจ้งเตือนภายในสิบวินาที
//   2. **เงียบตอนกลางคืน แล้วแจ้งตอนเช้า** — ของยังอยู่ในกล่องเข้าครบ แค่ยังไม่มีดอก
//      รอบแรกหลัง 07:00 กวาดไปรวมแจ้ง (heldTasks · 15 ต.ค. 69 — เดิมปล่อยหายเงียบ)
//   3. **ไม่แจ้งตอนซิงก์รอบแรก** — คนที่เพิ่งกดเชื่อมกำลังมองจออยู่และเห็น toast
//      ในแอปไปแล้ว ("เจอ 133 รายการ") · ดอกที่สองคือการพูดซ้ำเรื่องที่เพิ่งพูดจบ
//      (ปักหมุดไว้เลย ไม่งั้นการกวาดของข้อ 2 จะลากทั้ง 133 ใบมาแจ้งในรอบถัดไป)
//   4. **เฉพาะ op = 'new'** — งานที่ครูแก้กำหนดส่งกับงานที่ถูกยกเลิก ฝั่งแอปขึ้น
//      ข้อความให้ตอนเปิดอยู่แล้ว (inboxPullToast) ยังไม่มีหลักฐานว่าต้องดังถึงขั้น push
// ============================================================

/** ปิดสวิตช์ "เตือนงานใกล้ถึงกำหนด" ไว้ = ไม่อยากได้การเตือนเรื่องงาน ซึ่งรวมถึงเรื่องนี้ด้วย
 *  จงใจไม่เพิ่มสวิตช์ตัวที่สี่ — สวิตช์ที่แยกละเอียดเกินกว่าที่คนจะเข้าใจความต่าง
 *  คือสวิตช์ที่ไม่มีใครกด และเป็นของที่ต้องดูแลตลอดไป */
async function wantsTaskPush(userId: string): Promise<boolean> {
  const { data } = await db.from('user_state')
    .select('settings:data->settings').eq('id', userId).maybeSingle();
  return (data as { settings?: { notifDue?: boolean } } | null)?.settings?.notifDue !== false;
}

// ============================================================
// 15 ต.ค. 69 · ของที่เข้ามาช่วงกลางดึกต้องถูกแจ้งตอนเช้า ไม่ใช่หายเงียบ
// ------------------------------------------------------------
// เจ้าของ: "ระบบแจ้งเตือนผ่าน Classroom ไม่เข้าแอป" · ข้อมูลจริงคืนนี้ (อ่านแบบอ่านอย่างเดียว):
// ครูโพสต์งานในห้องเดียวกันราว 21:30 น. · บัญชีที่ซิงก์ทันรอบ 21:30 ได้ดอกแจ้งเตือน
// อีกสองบัญชีซิงก์รอบ 22:00 ซึ่งเป็นช่วงห้ามส่ง → งานเข้าแอปเงียบ ๆ และไม่เคยถูกแจ้งเลย
// ข้อ 2 ข้างบนเคยเชื่อว่า "send-reminders จะเจอมันเองตอนใกล้กำหนด" — แต่งานใบนั้นไม่มีกำหนดส่ง
// และต่อให้มี การรู้ตอนใกล้กำหนดคือรู้ช้าไปหลายวันสำหรับงานที่ครูสั่งล่วงหน้า
//
// ทางแก้ไม่ต้องมีคิวหรือตารางใหม่: กลางดึกยังไม่ปักหมุดเหมือนเดิม แล้วรอบแรกที่พ้นช่วงเงียบ
// กวาดของใน inbox_items ย้อนหลัง HELD_HOURS ที่ยังไม่มีหมุด มารวมในดอกเดียวกับของรอบนั้น
// ราคาของการกวาด: ของรอบแรก (เพิ่งกดเชื่อม) ที่ตั้งใจไม่แจ้ง ต้องถูกปักหมุดทันที
// ไม่งั้นรอบถัดไปจะกวาดทั้งปฏิทิน 133 ใบมาแจ้งซ้ำกับ toast ที่เขาเพิ่งเห็น
// ============================================================
const HELD_HOURS = 12;   // ช่วงห้ามส่งยาว 9 ชม. (22:00–07:00) · เผื่อรอบที่ล้มหรือเลื่อน

type Fresh = { task: StandardTask };

async function heldTasks(row: Row, skip: Set<string>): Promise<Fresh[]> {
  const since = new Date(Date.now() - HELD_HOURS * 3.6e6).toISOString();
  const { data, error } = await db.from('inbox_items')
    .select('meta, created_at')
    .eq('user_id', row.user_id).eq('source', row.provider)
    .gte('created_at', since);
  if (error) return [];
  const out: Fresh[] = [];
  for (const r of (data ?? []) as { meta?: Record<string, any> }[]) {
    const m = r.meta;
    if (!m || m.op !== 'new' || !m.sourceId || skip.has(m.sourceId)) continue;
    skip.add(m.sourceId);
    out.push({ task: {
      sourceId: m.sourceId, title: m.task?.title ?? '', subject: m.task?.subject ?? '',
      due: m.task?.due ?? null, type: m.task?.type ?? 'homework',
    } as StandardTask });
  }
  return out;
}

async function notifyNewItems(
  row: Row,
  deliver: { task: StandardTask; op: string; fp: string }[],
): Promise<PushResult | null> {
  if (!pushReady()) return null;
  const keyOf = (d: Fresh) => `sync-new::${row.provider}::${d.task.sourceId}`;
  const fresh: Fresh[] = deliver.filter(d => d.op === 'new' && !d.task.cancelled);

  // รอบแรก: ไม่แจ้ง (แอปขึ้น toast ให้แล้ว) แต่ปักหมุดไว้ ไม่ให้รอบเช้ากวาดไปแจ้งทีหลัง
  if (row.first_sync) {
    await markSent(db, row.user_id, fresh.map(keyOf));
    return null;
  }
  // กลางดึก: ไม่ส่ง และไม่ปัก — รอบแรกหลัง 07:00 จะกวาดไปแจ้ง (heldTasks)
  if (isQuietHours()) return null;

  const all = fresh.concat(await heldTasks(row, new Set(fresh.map(d => d.task.sourceId))));
  if (!all.length) return null;
  if (!(await wantsTaskPush(row.user_id))) return null;

  // กันซ้ำถาวรต่องานหนึ่งใบ — ไม่ผูกกับ integration_id เพราะตัดการเชื่อมแล้วเชื่อมใหม่
  // ไม่ควรได้ดอกเดิมซ้ำทั้งปฏิทิน (เหตุผลเดียวกับที่ srcKey ใช้ provider)
  const todo = await unsentKeys(db, row.user_id, all.map(keyOf));
  if (!todo.length) return null;
  // ดอกนี้พูดถึงเฉพาะของที่ยังไม่เคยแจ้ง — ของที่กวาดมาแล้วเคยแจ้งไป ไม่นับรวมในจำนวน
  const left = new Set(todo);
  const pending = all.filter(d => left.has(keyOf(d)));

  const res = await pushToUserDetailed(db, row.user_id, newItemsCopy(pending, row.account), PUSH_OPTS_NEW);
  // ปักหมุดเมื่อถึงอย่างน้อยหนึ่งเครื่อง หรือไม่มีเครื่องให้ส่งจริง ๆ (ไม่มีเลย/ตายถาวรหมด)
  // ไม่งั้นคนที่ไม่มีเครื่องรับ push เลยจะถูกคิดใหม่ทุกรอบตลอดไป และวันที่เขาเปิด push ครั้งแรก
  // จะโดนของเก่าทั้งเทอมรวดเดียว
  // ⚠️ 16 ต.ค. 69 · แต่ "ล้มชั่วคราวทุกเครื่อง" (5xx · 429 · เน็ต) ห้ามปัก — เดิมปักเสมอ ดอกนั้นจึงหาย
  // ถาวรโดยไม่มีบันทึกที่ไหน · ไม่ปัก = รอบถัดไปกวาดมาแจ้งใหม่ผ่าน heldTasks (ย้อนได้ HELD_HOURS)
  if (res.ok > 0 || res.failed === 0) await markSent(db, row.user_id, todo);
  return res;
}

/** หนึ่งข้อความที่สรุปทั้งรอบ — เจาะจงพอที่จะปัดทิ้งไม่ลง แต่ไม่ยาวจนโดนตัดกลางคัน
 *  กฎเดียวกับข้อความใน send-reminders: ต้องมีชื่อของจริงเสมอ ไม่พูดลอย ๆ ว่า "มีงานใหม่" */
function newItemsCopy(
  fresh: { task: StandardTask }[],
  account: string,
): { title: string; body: string; tag: string } {
  const exams = fresh.filter(d => d.task.type === 'exam');
  const events = fresh.filter(d => d.task.type === 'event');
  const n = fresh.length;

  // ใบเดียว บอกชื่อกับกำหนดส่งไปเลย — เจาะจงที่สุดเท่าที่ทำได้
  if (n === 1) {
    const t = fresh[0].task;
    const what = t.type === 'exam' ? 'มีสอบเพิ่มเข้ามา 📖'
               : t.type === 'event' ? 'มีกิจกรรมเพิ่มเข้ามา 📅'
               : 'มีงานใหม่เข้ามา 📥';
    const name = [t.subject, t.title].filter(Boolean).join(' · ') || t.title;
    return { title: what, body: name + dueSuffix(t.due), tag: 'sync-new' };
  }

  // หลายใบ บอกจำนวนกับวิชา ไม่ใช่ชื่อทุกใบ — การ์ดแจ้งเตือนสูงไม่กี่บรรทัด
  const subjects = [...new Set(fresh.map(d => d.task.subject).filter(Boolean))].slice(0, 3);
  const head = exams.length === n ? `มีสอบใหม่ ${n} รายการ 📖`
             : events.length === n ? `มีกิจกรรมใหม่ ${n} รายการ 📅`
             : `มีงานใหม่ ${n} ชิ้น 📥`;
  const soonest = fresh.map(d => d.task).filter(t => t.due)
    .sort((a, b) => Date.parse(a.due!) - Date.parse(b.due!))[0];
  const body = (subjects.length ? subjects.join(' · ') : account || 'เข้ามาเอง')
    + (soonest ? ` — อันที่ใกล้สุด${dueSuffix(soonest.due)}` : '');
  return { title: head, body, tag: 'sync-new' };
}

/** " ส่งพรุ่งนี้" — คนพูดกันแบบนี้ ไม่มีใครพูดว่า "ส่งอีก 31 ชั่วโมง" */
function dueSuffix(due: string | null | undefined): string {
  if (!due) return '';
  const ms = Date.parse(due);
  if (!Number.isFinite(ms)) return '';
  const TH = 7 * 3.6e6;
  const day = (x: number) => { const d = new Date(x + TH);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  const diff = Math.round((day(ms) - day(Date.now())) / 86400000);
  if (diff < 0) return ' (เลยกำหนดแล้ว)';
  if (diff === 0) return ' ส่งวันนี้';
  if (diff === 1) return ' ส่งพรุ่งนี้';
  if (diff === 2) return ' ส่งมะรืนนี้';
  const TH_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];
  if (diff <= 6) return ' ส่งวัน' + TH_DAY[new Date(ms + TH).getUTCDay()];
  return ` ส่งอีก ${diff} วัน`;
}

/** บรรทัดที่อ่านออกด้วยตา — inbox_items.raw ห้ามว่าง และมันคือสิ่งที่โผล่ในบันทึก
 *  ตอนผู้ใช้ถามว่า "งานนี้มาจากไหน" · ต้องอ่านรู้เรื่องโดยไม่ต้องเปิด meta ดู */
function humanLine(t: StandardTask): string {
  const bits = [t.subject, t.title].filter(Boolean).join(' · ');
  if (!t.due) return bits;
  const d = new Date(t.due);
  return isNaN(d.getTime()) ? bits : `${bits} (ส่ง ${d.toISOString().slice(0, 16).replace('T', ' ')})`;
}

// ⚠️ ต้องนัดให้ "ก่อน" ถึงรอบ cron ถัดไปเล็กน้อย (15 ต.ค. 69 · ข้อมูลจริง)
// cron ยิงตรง :00 กับ :30 แต่แถวถูกซิงก์เสร็จตอน :00:10 · นัด +30 นาทีพอดี = :30:10
// ซึ่งช้ากว่ารอบ :30:00 อยู่สิบวินาที → ถูกข้ามไปรอบหนึ่งเสมอ ทุกบัญชีจึงได้ซิงก์ชั่วโมงละครั้ง
// แทนที่จะเป็นทุก 30 นาที (นัด 13:00:10 ไม่ถูกซิงก์ในรอบ 13:00 · นัด 12:30:09 มาถูกซิงก์ตอน 13:00)
// หักไว้ 2 นาทีพอกินเวลาที่ฟังก์ชันใช้ในรอบหนึ่ง โดยไม่ทำให้ซิงก์ถี่ขึ้นเกินตั้งใจ
const CRON_SLACK_MS = 2 * 60_000;
function minutesFromNow(min: number): string {
  return new Date(Date.now() + min * 60_000 - CRON_SLACK_MS).toISOString();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
