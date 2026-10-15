import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "../backend/node_modules/@electric-sql/pglite/dist/index.js";
const actor = "11111111-1111-4111-8111-111111111111",
  target = "22222222-2222-4222-8222-222222222222";
const req = (n) => `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
create table public.user_state(id uuid primary key references auth.users on delete cascade,data jsonb not null,updated_at timestamptz default now());
create table public.profiles(id uuid primary key,display_name text,handle text);
create table public.reports(id bigint primary key,kind text,reason text,note text,created_at timestamptz default now());
create table public.push_subscriptions(user_id uuid,endpoint text);
insert into auth.users values('${actor}'),('${target}');
insert into user_state values('${target}','{"tasks":[{"id":"task-1","detail":"keep this"}],"settings":{"name":"sample"},"vault":{"at":1,"tokens":{"bal":20.5,"skins":{"a":1}}}}',now());
insert into profiles values('${target}','Sample','sample');
insert into reports values(1,'user','spam','example',now());
insert into push_subscriptions values('${target}','https://push.invalid/1'),('${target}','https://push.invalid/2');`);
await db.exec(
  await readFile(new URL("../backend/migration.sql", import.meta.url), "utf8"),
);
await db.exec(
  await readFile(new URL("../backend/migration.sql", import.meta.url), "utf8"),
);
async function cmd(action, payload) {
  return (
    await db.query("select public.staff_command($1,$2,$3,$4) r", [
      actor,
      "developer",
      action,
      JSON.stringify(payload),
    ])
  ).rows[0].r;
}
async function bal() {
  return (
    await db.query(
      `select data#>>'{vault,tokens,bal}' bal from user_state where id=$1`,
      [target],
    )
  ).rows[0].bal;
}
test("user search paginates real rows and returns only permitted profile fields", async () => {
  await db.exec("begin");
  try {
    await db.exec(`
      insert into auth.users select ('44444444-4444-4444-8444-' || lpad(i::text,12,'0'))::uuid from generate_series(1,21) i;
      insert into profiles select id,'Page Student ' || right(id::text,2), 'page_student' || right(id::text,2)::integer from auth.users where id::text like '44444444-%';
      insert into user_state select id,'{"vault":{"tokens":{"bal":3}}}',now() from auth.users where id::text like '44444444-%';
    `);
    const first = await cmd("users", { query: "", offset: 0 });
    const second = await cmd("users", { query: "", offset: 20 });
    assert.equal(first.items.length, 20);
    assert.equal(first.has_more, true);
    assert.equal(second.items.length, 2);
    assert.equal(second.has_more, false);
    assert.equal(new Set([...first.items, ...second.items].map(x => x.id)).size, 22);
    const search = await cmd("users", { query: "@page_student7", offset: 0 });
    assert.equal(search.items.length, 1);
    assert.equal(search.items[0].handle, "page_student7");
    assert.equal(search.items[0].balance, 3);
    assert.deepEqual(Object.keys(search.items[0]).sort(), ["balance", "display_name", "handle", "id", "last_sync"]);
    assert.deepEqual((await cmd("users", { query: "missing_account", offset: 0 })).items, []);
  } finally {
    await db.exec("rollback");
  }
});

test("grant is atomic, idempotent, and preserves task data", async () => {
  const payload = {
    request_id: req(1),
    target,
    amount: 1000,
    reason: "compensation for a reported issue",
  };
  await cmd("grant", payload);
  assert.equal(Number(await bal()), 1020.5);
  await cmd("grant", payload);
  assert.equal(Number(await bal()), 1020.5);
  await assert.rejects(() => cmd("grant", { ...payload, amount: 2000 }));
  assert.equal(Number(await bal()), 1020.5);
  const data = (
    await db.query("select data from user_state where id=$1", [target])
  ).rows[0].data;
  assert.equal(data.tasks[0].detail, "keep this");
  assert.equal(data.vault.tokens.skins.a, 1);
  assert.equal(data.vault.tokens.staffMinted, 1000);
});
test("a stale cloud snapshot retains the admin grant once", async () => {
  const old = {
    tasks: [{ id: "task-1", detail: "keep this" }],
    vault: { at: 2, tokens: { bal: 15.5 } },
  };
  await db.query("update user_state set data=$1 where id=$2", [
    JSON.stringify(old),
    target,
  ]);
  assert.equal(Number(await bal()), 1015.5);
  const current = (
    await db.query("select data from user_state where id=$1", [target])
  ).rows[0].data;
  await db.query("update user_state set data=$1 where id=$2", [
    JSON.stringify(current),
    target,
  ]);
  assert.equal(Number(await bal()), 1015.5);
});
test("anonymous and normal users cannot grant, read staff tables or edit audit", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    for (const sql of [
      "select * from staff_audit",
      "select * from staff_token_grants",
      "select * from staff_notices",
        "select staff_claim_push_jobs(10)",
      `select staff_command('${actor}','developer','overview','{}')`,
    ])
      await assert.rejects(() => db.query(sql));
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  assert.deepEqual((await db.query("select id from staff_audit limit 0")).rows, []);
  await assert.rejects(() => db.exec("delete from staff_audit"));
  await db.exec("reset role");
});
test("public news excludes drafts, withdrawn and expired copy; push jobs deduplicate", async () => {
  assert.deepEqual((await cmd("notices", {})).items, []);
  const id = req(2);
  await cmd("draft", {
    request_id: id,
    title: "Test announcement",
    body: "Approved copy",
    until: null,
  });
  const draftList = (await cmd("notices", {})).items;
  assert.equal(draftList.length, 1);
  assert.equal(draftList[0].status, "draft");
  assert.equal(draftList[0].title, "Test announcement");
  assert.deepEqual(
    (await db.query("select staff_public_notices() r")).rows[0].r,
    [],
  );
  const publish = { request_id: req(3), id, push: true };
  await cmd("publish", publish);
  await cmd("publish", publish);
  const publishedList = (await cmd("notices", {})).items;
  assert.equal(publishedList[0].status, "published");
  assert.match(publishedList[0].push_status, /1 บัญชีในคิว/);
  assert.equal(
    (await db.query("select count(*)::int n from staff_push_jobs")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select staff_public_notices() r")).rows[0].r.length,
    1,
  );
  const jobs = (await db.query('select staff_claim_push_jobs(10) r')).rows[0].r;
  assert.ok(jobs.length === 0 || jobs.length === 1);
  if (jobs.length) {
    assert.equal(jobs[0].user_id, target);
    assert.equal(jobs[0].attempts, 1);
    assert.deepEqual((await db.query('select staff_claim_push_jobs(10) r')).rows[0].r, []);
  }
  await cmd("withdraw", { request_id: req(4), id });
  assert.deepEqual(
    (await db.query("select staff_public_notices() r")).rows[0].r,
    [],
  );
  assert.equal(
    (await db.query("select status from staff_push_jobs")).rows[0].status,
    jobs.length ? "sending" : "cancelled",
  );
});
test("report status changes are audited and reversible", async () => {
  await cmd("triage", {
    request_id: req(5),
    id: 1,
    status: "closed",
    note: "reviewed by the team",
  });
  assert.equal((await cmd("issues", {})).items[0].status, "closed");
  assert.equal(
    (await cmd("issues", {})).items[0].staff_note,
    "reviewed by the team",
  );
  await cmd("triage", { request_id: req(6), id: 1, status: "open" });
  assert.equal((await cmd("issues", {})).items[0].status, "open");
});
test("server validates amounts and rejects unsynced recipients without a ledger entry", async () => {
  const count = (
    await db.query("select count(*)::int n from staff_token_grants")
  ).rows[0].n;
  await assert.rejects(() =>
    cmd("grant", {
      request_id: req(7),
      target,
      amount: -1,
      reason: "invalid amount",
    }),
  );
  await assert.rejects(() =>
    cmd("grant", {
      request_id: req(8),
      target: actor,
      amount: 1,
      reason: "no cloud snapshot",
    }),
  );
  assert.equal(
    (await db.query("select count(*)::int n from staff_token_grants")).rows[0]
      .n,
    count,
  );
});
test("expired copy never becomes public and cannot be published", async () => {
  const id = req(9);
  await cmd("draft", {
    request_id: id,
    title: "Expiry check",
    body: "Only visible while valid",
    until: null,
  });
  await db.query(
    "update staff_notices set status='published',published_at=now(),until_at=now()-interval '1 minute' where id=$1",
    [id],
  );
  assert.deepEqual(
    (await db.query("select staff_public_notices() r")).rows[0].r,
    [],
  );
  await db.query("update staff_notices set status='draft' where id=$1", [id]);
  await assert.rejects(() =>
    cmd("publish", { request_id: req(10), id, push: false }),
  );
});
test("the daily per-operator grant limit is enforced in the database", async () => {
  for (let i = 0; i < 9; i++)
    await cmd("grant", {
      request_id: req(100 + i),
      target,
      amount: 10000,
      reason: "daily limit test",
    });
  await cmd("grant", {
    request_id: req(110),
    target,
    amount: 9000,
    reason: "daily limit exact boundary",
  });
  await assert.rejects(() =>
    cmd("grant", {
      request_id: req(111),
      target,
      amount: 1,
      reason: "one beyond the daily limit",
    }),
  );
  const total = (
    await db.query("select sum(amount)::int n from staff_token_grants")
  ).rows[0].n;
  assert.equal(total, 100000);
});
test("normal account deletion is not blocked by admin ledger foreign keys", async () => {
  await db.query("delete from auth.users where id=$1", [target]);
  assert.equal(
    (await db.query("select count(*)::int n from staff_token_grants")).rows[0]
      .n,
    0,
  );
  assert.ok(
    (await db.query("select count(*)::int n from staff_audit")).rows[0].n > 0,
  );
  await db.close();
});
