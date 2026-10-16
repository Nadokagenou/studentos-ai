import { mapConcurrent } from './queue.mjs';
import { safePushEndpoint } from './push-policy.mjs';

export async function deliverJob(job, { db, send, extraHosts = [], now = Date.now }) {
  const update = async (values) => {
    const { error } = await db.from('staff_push_jobs').update(values)
      .eq('notice_id', job.notice_id).eq('user_id', job.user_id);
    if (error) throw Error('Queue update failed');
  };
  try {
    // Fetch independently, and never pull homework snapshots merely to check a
    // notification preference. Every recipient still gets a fresh access check.
    const [noticeResult, stateResult, subsResult] = await Promise.all([
      db.from('staff_notices').select('status,until_at,audience_id').eq('id', job.notice_id).single(),
      db.from('user_state').select('notifications:data->settings->notif').eq('id', job.user_id).single(),
      db.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', job.user_id).limit(10),
    ]);
    if (noticeResult.error || stateResult.error || subsResult.error) throw Error('Recipient lookup failed');
    const notice = noticeResult.data;
    if (notice?.status !== 'published' ||
        (notice.audience_id && notice.audience_id !== job.user_id) ||
        (notice.until_at && Date.parse(notice.until_at) <= now()) ||
        stateResult.data?.notifications === false) {
      await update({ status: 'cancelled' });
      return 'cancelled';
    }
    const subscriptions = (subsResult.data || []).filter(s => safePushEndpoint(s.endpoint, extraHosts));
    if (!subscriptions.length) {
      await update({ status: 'cancelled' });
      return 'cancelled';
    }
    const outcomes = await mapConcurrent(subscriptions, 3, async s => {
      try {
        await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: job.title, body: job.body, tag: `staff-${job.notice_id}`,
            url: 'https://nadokagenou.github.io/studentos-ai/?go=' + (job.audience_id ? 'staff-notif' : 'staff-news') }),
          { TTL: 86400, urgency: 'high', timeout: 5000 });
        return true;
      } catch (error) {
        if ([404, 410].includes(Number(error?.statusCode)))
          await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        return false;
      }
    });
    const ok = outcomes.some(Boolean);
    const status = ok ? 'accepted' : job.attempts >= 4 ? 'failed' : 'pending';
    await update({ status, finished_at: ok || status === 'failed' ? new Date(now()).toISOString() : null,
      not_before: new Date(now() + 900000).toISOString() });
    return ok ? 'accepted' : 'retry';
  } catch {
    // A recipient-specific database/network problem does not abort the batch.
    try { await update({ status: job.attempts >= 4 ? 'failed' : 'pending',
      not_before: new Date(now() + 900000).toISOString() }); } catch { /* stale claims are recovered by SQL */ }
    return 'retry';
  }
}
