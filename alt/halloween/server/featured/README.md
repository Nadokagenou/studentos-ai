# Permanent featured badge service

`halloween-badge` is separate from the seasonal gameplay function. It reads one preference or equips/removes one badge, including after the event closes. It cannot grant rewards or write `halloween_states`.

The entry point verifies the bearer session through Auth, rejects anonymous users, checks the existing staff account restriction under the user's own JWT, and uses service-only storage after that check. The handler accepts only the two permanent event badge IDs and verifies owner, season, ID, permanent flag and receipt in the private server document. Dates come from that receipt. Browser-supplied owners and dates are ignored.

The public projection is `halloween_featured_badges`: one row per user, readable only by its owner or accepted, unblocked friends. Authenticated clients have SELECT only; anonymous users have no privileges. The table also uses the existing restrictive active-account check. No existing profile/RPC policy was widened and no SECURITY DEFINER function was added.

Migration was created with the Supabase CLI under ALT, applied with the migration connector, and named to match the returned database ledger version `20261025134306`. Run `verify-rls.sql` as the migration owner to repeat the transactional checks. Fictional users, friendships, selections and blocks roll back together. All eight visibility/privilege assertions passed against the project database.

Deployment: `halloween-badge` v1 ACTIVE with JWT verification on, 25 October 2026. Upload `index.ts` and `handler.mjs` without changing the original `halloween-event` function. Live unauthenticated POST returned 401; allowed-origin OPTIONS returned 204. No advisor findings reference the new table. Existing unrelated project advisor findings were left untouched.

Successful ownership/write paths and Auth/header forwarding are tested with fixtures using the real handler/entry code. The live owner did not receive test medals and no human two-device test was performed before opening day.
