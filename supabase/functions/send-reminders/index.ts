// StudentOS AI — ส่งการเตือนแบบ Web Push (ทำงานแม้ผู้ใช้ปิดแอป)
// เรียกโดย pg_cron ทุก 30 นาที: หางานที่ใกล้ถึงกำหนดส่งแล้วส่ง push ให้เจ้าของงาน
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:studentos@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const db = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------- ข้อความเตือนสไตล์เพื่อน (ให้เหมือนในแอป) ----------
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function reminderCopy(subject: string, detail: string, hoursLeft: number) {
  const hr = Math.max(1, Math.round(hoursLeft));
  if (hoursLeft < 0) return {
    title: 'อุ๊ย เลยกำหนดแล้ว! 😬',
    body: pick([
      `${subject} เลยเวลาส่งไปแล้วน้า… แต่ยังไม่สายเกินไป รีบเคลียร์เลย!`,
      `${subject} ยังค้างอยู่นะ ครูกำลังมองอยู่ 👀 ส่งตอนนี้ยังพอทัน!`,
    ]),
  };
  if (hoursLeft <= 3) return {
    title: '⏰ เหลือเวลาไม่มากแล้ว!',
    body: pick([
      `${subject} เหลือแค่ ${hr} ชม.! ลุยเลยตอนนี้ เดี๋ยวไม่ทันน้า`,
      `นับถอยหลัง ${hr} ชม. สำหรับ ${subject} — สู้ ๆ คุณทำได้! 💪`,
    ]),
  };
  if (hoursLeft <= 12) return {
    title: 'อย่าเพิ่งลืมนะ 📚',
    body: pick([
      `${subject} รออยู่ เหลือ ${hr} ชม. ทำตอนนี้สบายกว่าตอนดึกเยอะ 😉`,
      `แอบเตือนเรื่อง ${subject} หน่อย~ เริ่มเลยดีกว่า จะได้พักแบบไม่มีห่วง`,
    ]),
  };
  return { title: 'มีงานรออยู่นะ ✨', body: `${subject} — ${detail} ใกล้ถึงกำหนดส่งแล้ว` };
}

Deno.serve(async () => {
  const now = Date.now();
  const sent: string[] = [];
  const errors: string[] = [];

  // 1) ดึงผู้ใช้ที่เปิด push ไว้
  const { data: subs, error: subErr } = await db.from('push_subscriptions').select('*');
  if (subErr) return new Response(JSON.stringify({ error: subErr.message }), { status: 500 });
  if (!subs?.length) return new Response(JSON.stringify({ ok: true, sent: 0, note: 'no subscriptions' }));

  const userIds = [...new Set(subs.map((s) => s.user_id))];

  // 2) ดึงงานของผู้ใช้เหล่านั้น
  const { data: states } = await db.from('user_state').select('id, data').in('id', userIds);
  const tasksByUser = new Map<string, any[]>();
  for (const s of states ?? []) tasksByUser.set(s.id, s.data?.tasks ?? []);

  for (const sub of subs) {
    const tasks = tasksByUser.get(sub.user_id) ?? [];

    // เลือกงานที่ด่วนสุดที่ยังไม่ได้เตือน (ภายใน 24 ชม. หรือเลยกำหนดไม่เกิน 24 ชม.)
    const candidates = tasks
      .filter((t: any) => !t.done && t.due && !t.pushedAt)
      .map((t: any) => ({ t, h: (new Date(t.due).getTime() - now) / 3.6e6 }))
      .filter((x) => x.h <= 24 && x.h > -24)
      .sort((a, b) => a.h - b.h);

    if (!candidates.length) continue;
    const { t, h } = candidates[0];

    // กันสแปม: เตือนคนเดิมไม่เกิน 1 ครั้งต่อ 4 ชม.
    if (sub.last_sent_at && now - new Date(sub.last_sent_at).getTime() < 4 * 3.6e6) continue;

    const copy = reminderCopy(t.subject ?? 'งาน', t.detail ?? '', h);
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ ...copy, tag: 'task-' + t.id, url: './' }),
      );
      sent.push(sub.user_id);

      // ทำเครื่องหมายว่าเตือนงานนี้แล้ว เพื่อไม่ให้เตือนซ้ำ
      const updated = tasks.map((x: any) => (x.id === t.id ? { ...x, pushedAt: new Date().toISOString() } : x));
      const cur = (states ?? []).find((s) => s.id === sub.user_id);
      await db.from('user_state').update({ data: { ...cur?.data, tasks: updated } }).eq('id', sub.user_id);
      await db.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('endpoint', sub.endpoint);
    } catch (e: any) {
      errors.push(`${sub.user_id}: ${e?.statusCode ?? ''} ${e?.message ?? e}`);
      // 404/410 = subscription หมดอายุ (ถอนแอป/ล้างข้อมูล) → ลบทิ้ง
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: sent.length, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
