# Phase 4 verification

The user reports Phase 3 manual testing worked; no scenarios/results were provided. Do not infer more detailed manual evidence.

| Layer | Evidence and scope |
| --- | --- |
| Cloud preflight | [JSON](cloud-preflight-results.json): 13 migrations, 32 tables, 53 FKs, 46 policies, 30 functions, all RLS; no buckets/publication members; read-only |
| Approved migration | [Apply evidence](remote-apply-results.json): migration 14 applied once after approval; no reset/seed/account changes |
| Cloud postflight/API | [JSON](cloud-postflight-results.json): 14 migrations, 34 tables, 58 FKs, 48 policies, 37 functions, five private buckets, ten-table INSERT/UPDATE publication; 33 checks passed |
| CLI dry-run | [Approved historical plan](migration-plan.json), final up-to-date check in Cloud postflight; no pending migration |
| Native SQL upgrade/regression | [JSON](../../tests/phase4-upgrade-results.json): loopback scratch DB, Auth claims/Storage table adapters |
| Native fresh Phase 4 | [JSON](../../tests/phase4-fresh-results.json): all migrations before Phase 4 fixtures |
| Unit | live-core plus existing backend/Auth/tooling; dedup, reconnect, stale events, lifecycle, signatures/reference validation |
| Phase 4 browser | [JSON](../../tests/phase4/browser/results.json): real Chromium/SDK/Canvas, explicitly mock HTTP/channels; retry, node/draft preservation, media, pixel/input limits, avatar, notifications, filters, logout, responsive |
| Phase 3 browser | [JSON](../../tests/phase4/regression-backend/results.json): real SDK/DOM, mock HTTP, no Cloud writes |
| Auth browser | [JSON](../../tests/phase4/regression-auth/auth-browser-results.json): mock boundary, no email |
| Demo browser | [JSON](../../tests/phase4/regression-demo/browser-results.json): isolated local state |
| Cloud mutation/WebSocket/Storage HTTP | **Pending approval and execution** |
| Private Broadcast/Presence | **Disabled**, no authorization claim |

Actual final totals: [local verification](local-verification-results.json). Native/mocks do not prove Cloud JWT validation, Storage enforcement or actual WebSocket delivery.

Deployment inspection initially failed because the CLI read-only role cannot execute the capabilities RPC; migration had already succeeded. Metadata inspection was corrected and the RPC checked through the public API, without replaying migration. Before fingerprints were not persisted from that first process, so only aggregate row-count preservation is proven; no full row-digest preservation claim is made. Existing schema/policy/function preservation and business integrity checks passed. This limitation is recorded in cloud-postflight-results.json.

Final run: **55 unit, 30 Demo domain, 98 SQL upgrade/regression, 15 fresh SQL, 18 Phase 4 browser, 30 backend browser, 51 Auth browser, 11 Demo browser groups passed; zero recorded failures.** Source audit checked 37 JavaScript files, 13 unchanged applied migrations, historical evidence, frontend secrets, HTML assets, documentation links and six ignored sensitive paths.

```powershell
node --test tests/live-core.test.mjs tests/backend-core.test.mjs tests/development-provision.test.mjs tests/development-verification.test.mjs tests/auth-repair.test.mjs tests/database-tooling.test.mjs
node tests/domain.cjs
npm run test:phase4-sql
node scripts/database-test.mjs --native --phase4-fresh --phase4 --output=tests/phase4-fresh-results.json
python tests/phase4_browser.py
```

Browser suite uses port 5501 or NGEKOSAJA_TEST_ORIGIN. Historical reports remain intact. Actual screenshots of labelled mock fixtures: tests/phase4/browser/chat-desktop.png, chat-mobile.png, property-uploader.png. They are not Cloud-user screenshots.

After approval, test ordinary JWTs for Owner A/B cross-property read/upload/delete denial, Tenant A/B cross-agreement complaint/chat denial, Prospect published-only images, explicit Admin reads without impersonation, signed URL expiry, real size/MIME enforcement, two-account message/attachment delivery, unread/read cursors, token expiry/refresh, offline/reconnect, old-session callbacks and resource changes. Use known paths to verify that path secrecy is not authorization. Never substitute service-role tests for RLS evidence.

Limits: no server raster malware scanner, memory-only draft/pending recovery, gallery reordering uses arrows/cover controls while drag/drop selects files. See storage security docs. No production-readiness claim.
