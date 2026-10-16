import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";
import { drainQueue, nextDrain } from "./queue.mjs";
import { deliverJob } from "./delivery.mjs";
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const projectUrl = Deno.env.get("SUPABASE_URL")!;
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
  const authorization = req.headers.get("authorization");
  if (!role || !authorization?.startsWith("Bearer ") || authorization.length > 8192)
    return json({ error: "Unauthorized" }, 401);
  if (authorization !== `Bearer ${role}`) {
    // The dashboard service JWT and runtime service key can differ. Supabase
    // validates the caller's token; only service_role has SELECT on staff_audit.
    // A zero-row HEAD request proves permission without reading any audit data.
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, role, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      const { error } = await caller
        .from("staff_audit")
        .select("id", { head: true })
        .limit(0);
      if (error) return json({ error: "Unauthorized" }, 401);
    } catch {
      return json({ error: "Authorization unavailable" }, 503);
    }
  }
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
  const input = await req.json().catch(() => ({}));
  if (!input || typeof input !== "object" || Array.isArray(input)) return json({error:"Invalid input"},400);
  const testNotice = input.test_notice_id;
  if (testNotice != null && (typeof testNotice !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(testNotice))) return json({error:"Invalid test notice"},400);
  const depth = input.drain_depth ?? 0;
  if (!Number.isInteger(depth) || depth < 0 || depth > 10) return json({error:"Invalid drain depth"},400);
  const run = async () => {
    try {
      let testClaimed = false;
      const result = await drainQueue({
        claim: async (limit: number) => {
          if (testNotice && testClaimed) return [];
          testClaimed = true;
          const { data, error } = testNotice
            ? await db.rpc("staff_claim_test_push_job", {p_notice:testNotice})
            : await db.rpc("staff_claim_push_jobs", {p_limit:limit});
          if (error) throw Error("Queue not available");
          return data || [];
        },
        deliver: (job: Record<string, unknown>) => deliverJob(job, {
          db, send: webpush.sendNotification.bind(webpush),
          extraHosts: (Deno.env.get("STAFF_PUSH_EXTRA_HOSTS") || "").split(",").filter(Boolean),
        }),
      });
      const next = nextDrain(result, depth, !!testNotice);
      if (next) EdgeRuntime.waitUntil((async () => {
        try {
          const r = await fetch(projectUrl + "/functions/v1/staff-notify", {
            method: "POST",
            headers: {authorization: "Bearer " + role, "content-type":"application/json"},
            body: JSON.stringify(next), signal: AbortSignal.timeout(10000),
          });
          await r.text();
          if (!r.ok) console.warn("[staff-notify] continuation deferred to cron");
        } catch { console.warn("[staff-notify] continuation deferred to cron"); }
      })());
      console.log(JSON.stringify({event:"staff_push_batch", ...result, drain_depth:depth}));
      return json(result);
    } catch {
      console.warn("[staff-notify] queue unavailable; cron will retry");
      return json({error:"Queue not available"},503);
    }
  };
  if (input.background === true) {
    EdgeRuntime.waitUntil(run());
    return json({queued:true},202);
  }
  return await run();
});
