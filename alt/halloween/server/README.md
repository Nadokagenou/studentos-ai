# Halloween account service · approved for 28 October 2026

The browser sends an action and a UUID. The service verifies the Supabase user, loads that user's private document, applies the shared engine with server time and cryptographic entropy, and commits a revision and receipt atomically. It never accepts a browser save, Candy balance, reward list, elapsed focus counter, or preview tool command.

The live engine uses `authoritative:true`, `preview:false`, and the Bangkok season boundary: 28 October 00:00 through 30 November 23:59:59.999. Shop, crafting, Totem, farming, quests, games and battles are intended live gameplay. The separate preview-only commands are rejected both by the service whitelist and the shared engine. The deployment must not disable live gameplay to get through an approval review.

`schema.sql` was applied to the StudentOS project on 24 October. RLS and denied browser privileges were checked; commit/replay/stale-revision assertions passed in a transaction that was rolled back. No player documents were retained by that database test.

The owner explicitly confirmed the current rules and production deployment on 24 October. `halloween-event` version 1 deployed ACTIVE with JWT verification; a live unauthenticated POST returned 401. The client activation is being released with ALT. Two-device human play and an actual 20-minute production quest have not been performed before opening day.

Build: `node alt/halloween/server/build.cjs`. Upload `index.ts`, `engine.mjs`, and `rules.json` as `halloween-event`, with JWT verification enabled. The function reads existing server environment variables only; no secret belongs in these files. `rules.json` is generated from the current ALT event values as a release candidate, with no change to drop weights or prices. The owner confirmed these live values, including a 30-visit biome aid that awards one still-missing house-pool quest material, rarest first. This aid does not alter ordinary drop weights and never grants locked rewards or homegrown crops.

The account adapter is permanent in `rewards/account-store.js`; the permanent vault does not depend on event files. Lost replies retry the same receipt. Logging out / switching accounts clears the snapshot. Server focus leases count short, non-overlapping heartbeats from a visible running quest; these reduce clock and replay abuse but cannot prove a human actually studied. No claim of perfect anti-cheat is made.

Release checks: verify the public signed-in reader; two-device play and an ordinary production transaction remain opening-day checks. Real date-gated grants must remain unavailable before 28 October. Keep the existing preview key and saves separate; never import preview supplies into account documents.
