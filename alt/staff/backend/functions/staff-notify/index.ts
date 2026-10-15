import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";
import { safePushEndpoint } from "./push-policy.mjs";
const role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(Deno.env.get("SUPABASE_URL")!, role, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!role || req.headers.get("authorization") !== `Bearer ${role}`)
    return json({ error: "Unauthorized" }, 401);
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY"),
    privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey)
    return json({ error: "VAPID is not configured; jobs remain queued" }, 503);
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ||
      "https://nadokagenou.github.io/studentos-ai/",
    publicKey,
    privateKey,
  );
  const { data: jobs, error } = await db.rpc("staff_claim_push_jobs", {
    p_limit: 10,
  });
  if (error) return json({ error: "Queue not available" }, 503);
  let accepted = 0,
    failed = 0;
  for (const job of jobs || []) {
    // Recheck withdrawal/expiry/preferences immediately before sending.
    const { data: notice, error: noticeError } = await db
      .from("staff_notices")
      .select("status,until_at")
      .eq("id", job.notice_id)
      .single();
    const { data: state, error: stateError } = await db
      .from("user_state")
      .select("data")
      .eq("id", job.user_id)
      .single();
    const live =
      !noticeError &&
      !stateError &&
      notice?.status === "published" &&
      (!notice.until_at || Date.parse(notice.until_at) > Date.now()) &&
      state?.data?.settings?.notif !== false;
    if (!live) {
      await db
        .from("staff_push_jobs")
        .update({
          status: noticeError || stateError ? "pending" : "cancelled",
          not_before: new Date(Date.now() + 900000).toISOString(),
        })
        .eq("notice_id", job.notice_id)
        .eq("user_id", job.user_id);
      continue;
    }
    const { data: subs, error: subsError } = await db
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", job.user_id)
      .limit(10);
    let ok = 0;
    if (!subsError)
      await Promise.all(
        (subs || [])
          .filter((s) =>
            safePushEndpoint(
              s.endpoint,
              (Deno.env.get("STAFF_PUSH_EXTRA_HOSTS") || "")
                .split(",")
                .filter(Boolean),
            ),
          )
          .map(async (s) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: s.endpoint,
                  keys: { p256dh: s.p256dh, auth: s.auth },
                },
                JSON.stringify({
                  title: job.title,
                  body: job.body,
                  tag: `staff-${job.notice_id}`,
                  url: "https://nadokagenou.github.io/studentos-ai/alt/?go=staff-news",
                }),
                { TTL: 86400, urgency: "normal", timeout: 5000 },
              );
              ok++;
            } catch (e) {
              const code =
                e && typeof e === "object" && "statusCode" in e
                  ? Number(e.statusCode)
                  : 0;
              if ([404, 410].includes(code))
                await db
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", s.endpoint);
            }
          }),
      );
    const status = ok ? "accepted" : job.attempts >= 4 ? "failed" : "pending";
    await db
      .from("staff_push_jobs")
      .update({
        status,
        finished_at:
          ok || status === "failed" ? new Date().toISOString() : null,
        not_before: new Date(Date.now() + 900000).toISOString(),
      })
      .eq("notice_id", job.notice_id)
      .eq("user_id", job.user_id);
    if (ok) accepted++;
    else failed++;
  }
  // accepted means the Push service accepted delivery, not that a person read it.
  return json({
    processed: jobs?.length || 0,
    accepted,
    retry_or_failed: failed,
  });
});
