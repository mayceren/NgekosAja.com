# Phase 3 implementation and release gate

Status: **migration Phase 3 sudah diterapkan setelah persetujuan dan lulus Cloud postflight; uji bisnis multi-akun masih pending**. Do not interpret schema deployment as proof that every live business flow has passed E2E.

Verification on 19 November 2026:

| Environment | Actual result |
| --- | --- |
| Core/transport unit | 10 passed, 0 failed |
| Existing Auth/provision/repair/database-tooling unit | 39 passed, 0 failed |
| Demo domain regression | 30 passed, 0 failed |
| Fresh disposable PostgreSQL | 16 groups passed, 0 failed; all 13 migrations |
| Baseline + additive upgrade + SQL regression | 83 groups passed, 0 failed |
| Connected Chromium + SDK + mocked HTTP | 30 groups passed, no uncaught JavaScript errors |
| Auth Chromium + mocked HTTP | 51 groups passed, no uncaught JavaScript errors |
| Existing Demo Chromium | 11 groups passed, no JavaScript/resource errors |
| Source/content/secret audit | No credential findings, broken local links or modified historical protected artifacts |
| Cloud migration | Exactly the approved migration applied; 13 migrations, 32 tables, 53 FKs, 46 policies, 30 public functions; final dry-run up to date |
| Cloud preservation | All rows in all 31 existing application tables have matching before/after digests; aggregate counts and existing policies/grants/constraints preserved |
| Cloud read-only API | Public catalogue succeeds with 0 published rows; four private table/RPC probes deny anonymous access with HTTP 401 / SQL 42501 |

Both local tests and Cloud postflight prove 32 tables / 53 FKs / 46 policies / 30 public functions, all RLS enabled, no PUBLIC execute grants or unsafe definer search paths, and no browser offer writes/private check-in/server payment/boost/role-grant access. See [Cloud apply evidence](remote-apply-results.json), [read-only API review](remote-post-apply-review-results.json), [schema extension and dictionary](SCHEMA_EXTENSION.md), [SQL upgrade evidence](../../tests/backend-database-upgrade-results.json), [browser evidence](../../tests/backend/results.json), and [audit](content-audit-results.json).

Migration fingerprint reviewed by dry-run: `ccee330228bf97b26138c4a486b01a0e24284ae076985ef7376ad8957ace9e49`. Cloud business mutations and current six-user JWT E2E were not run in this phase. Historical Phase 2 JWT verification is retained separately. No live payment or email was sent.

The workspace implements separate Connected routes and services for discovery, property/room operations, agreements/offers, invoicing/recurring, financial reporting, maintenance, chat, notifications, preferences, analytics, boost history and app-admin reporting. Auth and Demo retain their existing security/persistence behavior. The sole approved remote schema change is now applied. No existing application data, accounts/passwords/roles, email settings or frontend were changed during this apply; no seed, reset, email or git push was performed.

| Feature | Implementation status | Cloud limitation |
| --- | --- | --- |
| Public catalogue, filters/sort/range, grid/list/detail/gallery/related | Fully integrated with existing safe RPC | Verified anonymous read; currently zero published rows |
| Homepage catalogue | Fully integrated | Empty state expected; no demo business cards/counters |
| Favorites, recent searches, compare | Fully integrated locally/service UI | Per-user Cloud E2E pending |
| Owner dashboard / financial report / chart / CSV | Partially integrated | Summary/financial RPCs now in Cloud; per-account business E2E pending |
| Property and room atomic editing | Partially integrated | RPCs deployed and grants checked; positive Cloud mutation QA pending |
| Tenant listing, agreement history/close/transfer | Partially integrated | Local API/UI present; Cloud mutation QA pending; transfer has no separately stored consent offer |
| Explicit offer / tenant consent / safe check-in | Partially integrated | Relation/RPCs deployed with RLS; positive Cloud mutation QA pending |
| Individual/edit/cancel/bulk invoices and manual recurring generation | Partially integrated | Local API/UI present; Cloud mutation QA pending |
| Tenant dashboard, checkout reading, print invoice/recorded receipt | Partially integrated | Local API/UI tested; Cloud business QA pending; gateway actions intentionally unavailable |
| Complaint table/board/detail/timeline/transition/confirmation/reopen | Partially integrated | Local API/UI present; Cloud mutation QA pending |
| Rule analysis acceptance | Partially integrated | Explicit scoped input and API/UI present; Cloud mutation QA pending; no external AI |
| Chat messages/read/unread/directory/search/quick replies | Partially integrated | Member directory deployed and anonymous access denied; member JWT flow pending |
| Notification center/manual reminder and own preferences | Partially integrated | API/UI present; Cloud mutation QA pending; no scheduler/realtime |
| Boost history / active validity and listing analytics | Partially integrated | Read/record services present; no new paid campaign can be activated from browser |
| App admin metrics / user list / scoped resource pages | Partially integrated | Operations summary deployed; admin JWT reporting QA pending; no sensitive admin writes |
| Owner onboarding | Partially integrated | Existing administrative grant procedure; no fake self-approval |
| Storage/upload, realtime, gateway, scheduler, external email | Pending next phase | Deliberately out of Phase 3 scope |
| Demo regression | Fully integrated | Existing local features pass regression; cannot write Supabase business rows |

Applied migration: **20261119000200_backend_integration.sql**, following the user's explicit approval. The approved checksum and all 12 prior migration files are unchanged; final dry-run finds no pending files. See [API contracts](API_CONTRACTS.md), [security](SECURITY.md) and [integration guide](INTEGRATION_GUIDE.md). Consent deliberately tightens check-in; existing agreements are retained. No destructive table/drop/reset/data correction was executed; child replacement is only inside later authorized property/room saves.

Phase 4 readiness is conditional: migration application and metadata/security postflight have passed. Phase 3 cannot yet be declared fully complete on Cloud before approved multi-account business E2E using the development JWTs and safe business fixtures. This approval covered the reviewed schema migration, not new business fixtures or publication of the two draft properties. Passwords must be entered through the existing private interactive terminal mechanism, never chat/files/arguments. No production readiness claim is made.

## Changed files and usage

Created `js/core/backend-core.js`, `js/services/backend-services.js`, `js/adapters/data-mappers.js`, `js/backend/{pages,forms,events}.js`, `css/backend.css`, one additional migration, backend postflight SQL, remote read-only review script, SQL/unit/browser tests, and the backend documentation package. Updated `index.html`, Auth fetch/session/events/route guards, scoped complaint analysis, database test runner, Auth regression expectations, content-audit output handling, npm scripts, README and Auth navigation/architecture references. Existing UI assets, runtime public credentials, applied migrations, RLS baseline, demo persistence and historical evidence remain preserved.

The service table/RPC inventory is in [SERVICE_LAYER.md](SERVICE_LAYER.md); contracts and restrictions are in [API_CONTRACTS.md](API_CONTRACTS.md). All existing application table groups are used for the relevant data views; cloud attachment upload/access remains for Phase 4. Screenshots under `tests/backend/` show mocked test fixtures, not the current empty/draft Cloud catalogue.

Run `npm run dev`, then open the printed HTTP URL. For backend core tests use `npm run test:backend`; read-only Cloud/dry-run review uses `npm run backend:review`. Database scratch prerequisites and full commands are in [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md).
