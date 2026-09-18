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
import { isQuietHours, markSent, pushReady, pushToUser, unsentKeys } from '../_shared/notify.ts';

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

type Row = {
  id: string; user_id: string; provider: string; account: string;
  secret: string | null; meta: Record<string, unknown>; fail_count: number;
  last_sync_at: string | null;
  // รอบนี้เป็นการซิงก์ครั้งแรกของการเชื่อมเส้นนี้ไหม — ต้องอ่านก่อนที่ syncOne
  // จะเขียน last_sync_at ทับ ไม่งั้นทุกอย่างดูเหมือนไม่ใช่ครั้งแรกไปหมด
  first_sync?: boolean;
};

Deno.serve(async (req) => {
  try {
    if (!cryptoReady()) {
      return json({ ok: false, error: 'ยังไม่ได้ตั้ง INTEGRATION_KEY' }, 500);
    }
    const body = await req.json().catch(() => ({}));
    const only = typeof body?.integration_id === 'string' ? body.integration_id : null;

    let q = db.from('integrations')
      .select('id, user_id, provider, account, secret, meta, fail_count, last_sync_at');
    q = only
      ? q.eq('id', only)
      // paused = ผู้ใช้ปิดไว้เอง · needs_reauth = ลองใหม่เองอีกกี่รอบก็ไม่หาย ต้องรอคนมากด
      : q.in('status', ['active', 'error']).lte('next_sync_at', new Date().toISOString())
         .order('next_sync_at', { ascending: true }).limit(BATCH);

    const { data, error } = await q;
    if (error) throw error;

    const out = [];
    for (const row of (data || []) as Row[]) {
      out.push(await syncOne({ ...row, first_sync: !row.last_sync_at }));
    }
    return json({ ok: true, ran: out.length, results: out });
  } catch (e) {
    console.error('[sync] รอบนี้ล้มทั้งรอบ:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

async function syncOne(row: Row) {
  try {
    const secret = await unseal(row.secret);
    if (!secret) {
      // ถอดรหัสไม่ออก = กุญแจถูกเปลี่ยน หรือข้อมูลเสีย · ลองใหม่เองไม่มีทางหาย
      await markReauth(row, 'กุญแจที่เก็บไว้ใช้ไม่ได้แล้ว ต้องเชื่อมใหม่');
      return { id: row.id, status: 'needs_reauth' };
    }

    const res = await pull(row, secret);
    if (res.unchanged) {
      await db.from('integrations').update({
        last_sync_at: new Date().toISOString(),
        next_sync_at: minutesFromNow(NORMAL_GAP_MIN),
        status: 'active', error_msg: null, fail_count: 0,
      }).eq('id', row.id);
      return { id: row.id, status: 'unchanged' };
    }

    const sent = await reconcile(row, res.tasks);

    await db.from('integrations').update({
      last_sync_at: new Date().toISOString(),
      next_sync_at: minutesFromNow(NORMAL_GAP_MIN),
      status: 'active', error_msg: null, fail_count: 0,
      meta: { ...row.meta, ...res.meta },
      ...(res.account ? { account: res.account } : {}),
    }).eq('id', row.id);

    return { id: row.id, status: 'ok', ...sent };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // reauth = ปัญหาที่ต้องให้คนมากด · ที่เหลือคือปัญหาชั่วคราวที่ถอยห่างแล้วลองใหม่เองได้
    if ((e as { reauth?: boolean })?.reauth) {
      await markReauth(row, msg);
      return { id: row.id, status: 'needs_reauth', error: msg };
    }
    const n = Math.min(row.fail_count + 1, BACKOFF_MIN.length);
    await db.from('integrations').update({
      status: 'error', error_msg: msg.slice(0, 300), fail_count: n,
      last_sync_at: new Date().toISOString(),
      next_sync_at: minutesFromNow(BACKOFF_MIN[n - 1]),
    }).eq('id', row.id);
    return { id: row.id, status: 'error', error: msg };
  }
}

async function markReauth(row: Row, msg: string) {
  await db.from('integrations').update({
    status: 'needs_reauth', error_msg: msg.slice(0, 300),
    last_sync_at: new Date().toISOString(),
    // ไม่ต้องยิงซ้ำอีกจนกว่าคนจะมากดเชื่อมใหม่ — ตั้งไว้ไกล ๆ แทนการปิดสวิตช์
    // เผื่อกรณีที่ต้นทางหายชั่วคราวแล้วกลับมาเอง จะได้ลองอีกครั้งในวันรุ่งขึ้น
    next_sync_at: minutesFromNow(1440),
  }).eq('id', row.id);
}

// ---------- ทะเบียนตัวเชื่อม ----------
// เพิ่มเจ้าใหม่ = เขียนไฟล์ใน _shared/ แล้วต่ออีกหนึ่ง case ตรงนี้ · ที่เหลือไม่ต้องแตะ
async function pull(row: Row, secret: string): Promise<{
  tasks: StandardTask[]; meta?: Record<string, unknown>; account?: string; unchanged?: boolean;
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
    return { tasks: r.tasks, account: r.account || undefined };
  }

  if (row.provider === 'google_calendar') {
    if (!classroomReady()) throw new Error('ยังไม่ได้ตั้งกุญแจ Google ฝั่งเซิร์ฟเวอร์');
    const r = await fetchCalendar(secret);
    return { tasks: r.tasks };
  }

  throw new Error(`ไม่รู้จักตัวเชื่อม "${row.provider}"`);
}

// ---------- เทียบกับทะเบียน ----------
// หัวใจของการ "ไม่ส่งซ้ำ" และ "ตามการแก้ไขให้ทัน" อยู่ที่นี่ที่เดียว
async function reconcile(row: Row, tasks: StandardTask[]) {
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
  const deliver: { task: StandardTask; op: 'new' | 'update' | 'cancel'; fp: string }[] = [];
  const ledger: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const t of tasks) {
    if (!t.sourceId || !t.title) continue;
    seen.add(t.sourceId);
    const fp = await fingerprint(t);
    const old = byId.get(t.sourceId);

    // ไม่มีอะไรเปลี่ยน และเคยส่งไปแล้ว — ข้ามไปเลย ไม่ต้องเขียนอะไรทั้งนั้น
    if (old && old.fingerprint === fp && old.sent_fingerprint === fp) continue;

    // เก่าเกินกว่าจะเป็นงานที่ทำอะไรต่อได้ — จดไว้ในทะเบียนว่ารู้จักแล้ว แต่ไม่ส่งต่อ
    // จดด้วย sent_fingerprint เท่ากับของปัจจุบัน เพื่อไม่ต้องคิดใหม่ทุกรอบ sync
    // แต่ถ้าวันหลังครูเลื่อนกำหนดส่งมาข้างหน้า ลายนิ้วมือจะเปลี่ยน แล้วมันจะกลับเข้าเส้นทางนี้
    // อีกครั้งโดยอัตโนมัติ คราวนี้ผ่านด่านเพราะกำหนดส่งอยู่ในอนาคตแล้ว
    const stale = !t.cancelled && t.due && new Date(t.due).getTime() < staleBefore;

    if (!stale) deliver.push({ task: t, op: t.cancelled ? 'cancel' : (old ? 'update' : 'new'), fp });
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
  const cutoff = Date.now();
  for (const k of (known || [])) {
    if (seen.has(k.source_id) || k.state === 'cancelled') continue;
    ledger.push({
      integration_id: row.id, source_id: k.source_id, user_id: row.user_id,
      fingerprint: k.fingerprint, title: k.title, due: k.due,
      state: 'cancelled', seen_at: now, updated_at: now,
    });
    // บอกแอปเฉพาะงานที่เคยส่งไปแล้วจริง และยังไม่ถึงกำหนด
    const pending = k.sent_fingerprint && k.due && new Date(k.due).getTime() > cutoff;
    if (!pending) continue;
    deliver.push({
      task: { sourceId: k.source_id, title: k.title || '', due: k.due, cancelled: true },
      op: 'cancel', fp: k.fingerprint,
    });
  }

  if (ledger.length) {
    const { error: upErr } = await db.from('integration_items')
      .upsert(ledger, { onConflict: 'integration_id,source_id' });
    if (upErr) throw upErr;
  }

  if (!deliver.length) return { sent: 0 };

  // ---------- หย่อนลงท่อเดิม ----------
  const rows = deliver.map(d => ({
    user_id: row.user_id,
    source: row.provider,
    raw: humanLine(d.task),
    meta: {
      v: 1,
      structured: true,          // ฝั่งแอปเห็นธงนี้แล้วข้ามตัวแกะข้อความทั้งหมด
      op: d.op,
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
  const pushed = await notifyNewItems(row, deliver).catch(() => 0);

  return { sent: deliver.length, pushed };
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
//   2. **เงียบตอนกลางคืน** — ของยังอยู่ในกล่องเข้าครบ แค่ไม่มีดอก และ send-reminders
//      จะเจอมันเองตอนใกล้กำหนด · ไม่ต้องมีคิวรอส่ง เพราะไม่มีอะไรหาย
//   3. **ไม่แจ้งตอนซิงก์รอบแรก** — คนที่เพิ่งกดเชื่อมกำลังมองจออยู่และเห็น toast
//      ในแอปไปแล้ว ("เจอ 133 รายการ") · ดอกที่สองคือการพูดซ้ำเรื่องที่เพิ่งพูดจบ
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

async function notifyNewItems(
  row: Row,
  deliver: { task: StandardTask; op: string; fp: string }[],
): Promise<number> {
  if (!pushReady() || isQuietHours()) return 0;
  if (row.first_sync) return 0;

  const fresh = deliver.filter(d => d.op === 'new' && !d.task.cancelled);
  if (!fresh.length) return 0;
  if (!(await wantsTaskPush(row.user_id))) return 0;

  // กันซ้ำถาวรต่องานหนึ่งใบ — ไม่ผูกกับ integration_id เพราะตัดการเชื่อมแล้วเชื่อมใหม่
  // ไม่ควรได้ดอกเดิมซ้ำทั้งปฏิทิน (เหตุผลเดียวกับที่ srcKey ใช้ provider)
  const keys = fresh.map(d => `sync-new::${row.provider}::${d.task.sourceId}`);
  const todo = await unsentKeys(db, row.user_id, keys);
  if (!todo.length) return 0;

  const ok = await pushToUser(db, row.user_id, newItemsCopy(fresh, row.account));
  // ปักหมุดแม้ส่งไม่สำเร็จสักเครื่อง — ไม่งั้นคนที่ไม่มีเครื่องรับ push เลยจะถูกคิดใหม่
  // ทุกรอบตลอดไป และวันที่เขาเปิด push ครั้งแรกจะโดนของเก่าทั้งเทอมรวดเดียว
  await markSent(db, row.user_id, todo);
  return ok;
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

function minutesFromNow(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
