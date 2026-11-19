# Security review

Cloud target **ngekosaja-development** received exactly the approved Phase 3 migration. Postflight confirms 13 migrations, 32 RLS tables, 53 foreign keys, 46 policies and 30 public functions with zero pending migration. See [apply evidence](remote-apply-results.json), [latest read-only review](remote-post-apply-review-results.json), [pre-approval review](remote-review-results.json), and [starting audit](../auth/phase3-start-audit-results.json).

Before/after digests of all rows in all 31 existing application tables match; aggregate counts, existing policies/grants/constraints/indexes/triggers/views and unrelated function definitions were preserved. Digests were compared in memory; raw application rows and Auth credentials were not exported. The new rental_offers table is empty. No seed, account mutation, reset or compensating deletion was executed.

Anonymous HTTP checks against private properties, rental_offers, operational_summary and conversation_directory all returned HTTP 401 / PostgreSQL 42501. Public catalogue reads still succeed. These negative anonymous checks and metadata grants are not a substitute for positive business operations using the six development JWTs.

The browser contains only the existing public URL/publishable key. No service role, database password, access token or account password was added to frontend files, documentation or repository. `.env*`, `.local-db/`, `.database-test/`, Supabase temp and private key paths remain ignored. Development server continues rejecting internal scripts, credentials and node_modules.

Authorization comes from verified Auth identity and database roles. Request metadata/form intent cannot grant owner/admin. Owner onboarding remains an actual administrative review/grant procedure; no fake request approval or browser grant button was added. Owner access is not automatically granted during registration. No personal account or existing password/role was modified.

New functions fix empty search_path, revoke PUBLIC/anon execution and perform owner/member/tenant checks inside the transaction. New rental_offers table has RLS at creation and no browser writes. Existing RLS policies were retained; the migration adds one party-read policy. The private check-in implementation is no longer directly executable by authenticated/service_role. Successful placement requires matching accepted consent; room/tenant uniqueness and exclusion constraints remain in force.

Data API reads use the current JWT. The public catalogue has no owner UUID, private contacts, tenant data or internal room identifiers. Conversation directory exposes only member-scoped display names and context. App admin is still an authenticated application user, not a service-role client; own settings/notifications remain private even from other app users.

Stored content is escaped before HTML output. Image references are restricted to local assets, with no data/javascript/external URL or traversal. CSV cells beginning with whitespace/formula operators are neutralized and quoted. BigInt/JSON transport prevents monetary precision loss. No raw database errors are presented to users.

Local SQL tests cover cross-owner edits, tenant invoice isolation, consent forgery/reuse/expiry, atomic rollback, check-in races and server-only payment constraints. Browser HTTP mocks verify routing and payloads, not live RLS. Cloud JWT mutation verification has **not** been performed for Phase 3 and must follow approval and deliberate development fixtures. The existing Phase 2 six-account results remain historical evidence.

Current limitations: transfers use the existing atomic owner-authorized function without a new persisted transfer-consent workflow; room/property pickers and conversation/favorite lists are bounded; no gateway, Storage, realtime, cron, rate-limit load test or production deployment. Confirm Email remains off for the approved development setup; this is not a production-readiness claim.
