# Halloween account service · candidate for 28 October 2026

The browser sends an action and a UUID. The service verifies the Supabase user, loads that user's private document, applies the shared engine with server time and cryptographic entropy, and commits a revision and receipt atomically. It never accepts a browser save, Candy balance, reward list, elapsed focus counter, or preview tool command.

The live engine uses `authoritative:true`, `preview:false`, and the Bangkok season boundary: 28 October 00:00 through 30 November 23:59:59.999. Shop, crafting, Totem, farming, quests, games and battles are intended live gameplay. The separate preview-only commands are rejected both by the service whitelist and the shared engine. The deployment must not disable live gameplay to get through an approval review.

`schema.sql` was applied to the StudentOS project on 24 October. RLS and denied browser privileges were checked; commit/replay/stale-revision assertions passed in a transaction that was rolled back. No player documents were retained by that database test.

The edge deployment has **not succeeded**: automatic approval first could not run because of a usage limit, then rejected the shared preview terminology / allowance of the live shop, crafting, Totem and games. The latest source separates the live mode and has explicit tests for real purchases/crafting and blocked preview tools. Do not bypass the approval system. Keep `event/config.json.claimingEnabled` false until deployment and verification succeed.

Build: `node alt/halloween/server/build.cjs`. Upload `index.ts`, `engine.mjs`, and `rules.json` as `halloween-event`, with JWT verification enabled. The function reads existing server environment variables only; no secret belongs in these files. `rules.json` is generated from the current ALT event values as a release candidate, with no change to drop weights or prices. Owner confirmation is still needed to adopt those candidate values for live play.

The account adapter is permanent in `rewards/account-store.js`; the permanent vault does not depend on event files. Lost replies retry the same receipt. Logging out / switching accounts clears the snapshot. Server focus leases count short, non-overlapping heartbeats from a visible running quest; these reduce clock and replay abuse but cannot prove a human actually studied. No claim of perfect anti-cheat is made.

Before enabling: deploy this candidate, verify signed-in read and one ordinary transaction, verify a second device and account switch, and check the public client. Real date-gated grants must remain unavailable before 28 October. Keep the existing preview key and saves separate; never import preview supplies into account documents.
