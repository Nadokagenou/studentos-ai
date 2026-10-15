import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorize,
  createHandler,
  validate,
} from "../backend/functions/staff-console/core.mjs";
import { safePushEndpoint } from "../backend/functions/staff-notify/push-policy.mjs";
const uid = "11111111-1111-4111-8111-111111111111";
const user = {
  id: uid,
  identities: [{ provider: "github", identity_data: { provider_id: "42" } }],
};
const opts = {
  authorization: "Bearer valid",
  githubToken: "provider",
  repository: "Nadokagenou/studentos-ai",
  getUser: async () => user,
  github: async (path) =>
    path === "/user"
      ? { id: 42, login: "developer" }
      : { full_name: "Nadokagenou/studentos-ai", permissions: { push: true } },
};
test("verified GitHub collaborator is allowed", async () =>
  assert.deepEqual(await authorize(opts), { id: uid, login: "developer" }));
test("no Supabase session is denied", async () =>
  assert.rejects(() => authorize({ ...opts, authorization: null }), {
    status: 401,
  }));
test("forged or expired Supabase session is denied", async () =>
  assert.rejects(() => authorize({ ...opts, getUser: async () => null }), {
    status: 401,
  }));
test("another person’s GitHub token cannot be paired with a session", async () =>
  assert.rejects(
    () => authorize({ ...opts, github: async () => ({ id: 99 }) }),
    { status: 403 },
  ));
test("editable user metadata is not an admin credential", async () =>
  assert.rejects(
    () =>
      authorize({
        ...opts,
        getUser: async () => ({
          id: uid,
          user_metadata: { admin: true, provider_id: "42" },
          identities: [],
        }),
      }),
    { status: 403 },
  ));
test("public repository readers are denied", async () =>
  assert.rejects(
    () =>
      authorize({
        ...opts,
        github: async (path) =>
          path === "/user"
            ? { id: 42 }
            : {
                full_name: "Nadokagenou/studentos-ai",
                permissions: { pull: true, push: false },
              },
      }),
    { status: 403 },
  ));
test("write access to a different repository is denied", async () =>
  assert.rejects(
    () =>
      authorize({
        ...opts,
        github: async (path) =>
          path === "/user"
            ? { id: 42 }
            : { full_name: "other/repo", permissions: { push: true } },
      }),
    { status: 403 },
  ));
test("GitHub failure never falls back to client-side admin", async () =>
  assert.rejects(() =>
    authorize({
      ...opts,
      github: async () => {
        throw Error("network");
      },
    }),
  ));
test("amount limits and request identity are validated", () => {
  for (const amount of [-1, 0, 0.5, 10001, Infinity, "100"])
    assert.throws(() =>
      validate({
        action: "grant",
        target: uid,
        amount,
        reason: "test reason",
        request_id: uid,
      }),
    );
  assert.equal(
    validate({
      action: "grant",
      target: uid,
      amount: 1000,
      reason: "test reason",
      request_id: uid,
    }).payload.amount,
    1000,
  );
});
test("unknown commands cannot reach privileged RPC", async () => {
  let called = false;
  const handle = createHandler({
    ...opts,
    allowedOrigins: ["https://trusted.test"],
    command: async () => {
      called = true;
    },
  });
  const r = await handle(
    new Request("https://edge.test", {
      method: "POST",
      body: JSON.stringify({ action: "delete_users" }),
    }),
  );
  assert.equal(r.status, 400);
  assert.equal(called, false);
});
test("unapproved browser origin is rejected", async () => {
  const handle = createHandler({
    ...opts,
    allowedOrigins: ["https://trusted.test"],
  });
  const r = await handle(
    new Request("https://edge.test", {
      method: "POST",
      headers: { origin: "https://other.test" },
      body: "{}",
    }),
  );
  assert.equal(r.status, 403);
});
test("privileged RPC is never called for an unauthorized account", async () => {
  let called = false;
  const handle = createHandler({
    ...opts,
    getUser: async () => null,
    command: async () => {
      called = true;
    },
  });
  const r = await handle(
    new Request("https://edge.test", {
      method: "POST",
      headers: { authorization: "Bearer bad", "x-github-token": "bad" },
      body: JSON.stringify({ action: "overview" }),
    }),
  );
  assert.equal(r.status, 401);
  assert.equal(called, false);
  assert.equal(r.headers.get("cache-control"), "no-store");
});
test("push rejects internal URLs, arbitrary hosts and hostname lookalikes", () => {
  for (const endpoint of [
    "http://127.0.0.1/x",
    "https://127.0.0.1/x",
    "https://internal.invalid/x",
    "https://fcm.googleapis.com.evil.invalid/x",
    "https://evil.notify.windows.com.evil.invalid/x",
    "https://fcm.googleapis.com:8443/x",
    "https://u:p@fcm.googleapis.com/x",
  ])
    assert.equal(safePushEndpoint(endpoint), false);
  assert.equal(
    safePushEndpoint("https://fcm.googleapis.com/fcm/send/test"),
    true,
  );
  assert.equal(safePushEndpoint("https://web.push.apple.com/test"), true);
});
