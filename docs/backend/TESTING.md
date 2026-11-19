# Phase 3 verification

Tests and evidence are deliberately separated by environment. Existing historical reports/screenshots are retained. New screenshots use mocked HTTP fixtures and must not be presented as Cloud data.

| Scope | Execution / evidence | Meaning |
| --- | --- | --- |
| Core unit | `node --test tests/backend-core.test.mjs` | Bigint/JSON/CSV/assets/cache/stale sessions; no network |
| Existing domain | `node tests/domain.cjs` | 30 existing LocalStorage/demo business scenarios |
| Existing Auth/tooling unit | development provisioning/verification, auth repair, database tooling | 39 tests, no network |
| Native SQL fresh | `tests/backend-database-fresh-results.json` | All 13 migrations on disposable PostgreSQL, new business/security contracts |
| Native SQL upgrade | `tests/backend-database-upgrade-results.json` | Existing contracts/fixtures on 12 migrations, additive upgrade, new contracts |
| Connected browser | `tests/backend/results.json` | Real Chromium + real SDK, HTTP mock; UI/actions/roles/layout/persistence at mock boundary |
| Auth browser | `tests/backend/auth-regression/auth-browser-results.json` | Existing PKCE/session/profile/logout flow with mocks, updated dashboard/menu expectations |
| Demo browser | `tests/backend/demo-regression/browser-results.json` | Existing end-to-end demo business regression |
| Approved Cloud migration | `remote-apply-results.json` | Exactly one approved migration applied; 31 existing table digests preserved; 13 migrations and no pending files |
| Cloud read-only | `remote-post-apply-review-results.json`, pre-approval review, starting audit | Schema/grants/RLS/history plus safe catalogue and four anonymous HTTP 401/42501 rejections |
| Cloud business JWT E2E | **Not run for Phase 3** | Requires private development password entry and a separately approved business fixture plan |

Core assertions include exact bigint boundaries and zero-decimal numeric aggregates, safe image paths, CSV injection, cache dedup/bounds and rejection after logout/account switch. Browser suite forbids calls to server payment/role RPCs and signup/recovery email requests. SQL verifies successful server payments only inside isolated test databases and denial from browser roles.

SQL race tests use independent connections. The original baseline tests cover payment races and room races; new tests verify accepted-offer consumption can create exactly one lease. Upgrade preserves existing agreement count. Invalid nested property child writes roll back header/images together. Offer acceptance requires actual tenant, same property conversation, matching terms, non-expiry and no prior consumption.

Native SQL cannot prove live GoTrue/JWT/PostgREST behavior. Mocked browser persistence is not remote durability. Anonymous Cloud catalogue is empty, so forbidden-field checks on rows are vacuous at present; schema projection and populated local SQL tests provide complementary evidence. Free-tier load/concurrency stress testing was not performed.

Screenshots: `tests/backend/owner-desktop.png`, `admin-desktop.png`, `chat-mobile.png`; Auth/Demo regression screenshots are under their separate subfolders. Use completion report for the latest actual counts and blockers.

Latest recorded totals: core 10, existing unit 39, demo domain 30, SQL fresh 16, SQL upgrade 83, Connected browser 30, Auth browser 51, Demo browser 11; no failing group in those completed runs. The `backend_postflight` section records the extension metadata separately from the original baseline postflight.

Post-apply final artifact inspection passed: [final-apply-checks.json](final-apply-checks.json). Automatic approval review rejected a proposed runtime rerun-guard test because invoking an apply-capable script again could repeat a Cloud mutation if the guard failed. That command was not executed or retried. The guard was inspected statically instead; no runtime reapply-test success is claimed. This rejection did not affect the already completed, approved migration or its Cloud postflight.
