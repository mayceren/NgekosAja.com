# Phase 4 setup and approval gate

Current status: migration 14 has been approved/applied once. [Cloud postflight](cloud-postflight-results.json) passed; do not repeat the apply script. The approval/apply instructions below document the procedure already used. `npm run phase4:verify-remote` runs read-only checks. `phase4:plan` now saves the up-to-date result separately and preserves the approved historical plan.

Run `npm run dev` (http://127.0.0.1:5500) or Live Server. No framework/build/paid dependency is added. Connected Auth/Storage require HTTP. Never put service credentials in runtime.js. Phase 4 controls activate only when phase4_capabilities exists; reload after migration. Before that, Phase 3 text chat and illustrations remain usable.

Target: **ngekosaja-development**, ref `wfmhsbdfdcugxblqsaob`, CLI **3.2.0**. [Preflight](cloud-preflight-results.json) is read-only. [Plan](migration-plan.json) records the exact migration SHA-256 and applied-file hashes.

```powershell
npm run phase4:review
npm run phase4:plan
```

Exactly **20261119000300_realtime_storage.sql** was approved and applied. No migration is currently pending. User instructions still require approval before further schema/config changes. The plan script has no apply mode and passes --dry-run --skip-vault. Dry-run checks history/plan, not execution.

Only after approval: verify unchanged hash/target, then installed CLI syntax is `supabase db push --remote=wfmhsbdfdcugxblqsaob --skip-vault`. Do not add reset/include-seed/include-all/role/config push flags. Record actual result, run supabase/review/phase4-postflight.sql read-only and save a NEW Cloud postflight report. Check local catalogue expectations, five private buckets, ten-table INSERT/UPDATE-only publication. Preserve preflight evidence.

Migration adds nullable columns/tables, wraps owner RPCs, tightens direct property-image writes and restricts publication operations. No business rows, accounts, passwords or financial records are deleted/seeded. Unexpected bucket configuration/publication members cause failure for review; do not bypass guards.

Cloud E2E mutations need approval for named fixtures. Use the existing six development accounts, no provisioning/reset. Enter passwords only through a private interactive terminal, never chat/arguments/logs/config. First verify ordinary-JWT identity/profile/roles; then use separate private windows for Owner A/Tenant A and Owner B/Tenant B. Approved QA should create dedicated tagged properties/rooms/conversations for image tests and complaints under existing approved agreements. Preserve personal properties and immutable histories. Cleanup deletions are not pre-authorized.

Native runner accepts loopback only and creates/removes its own random scratch DB. Full Supabase Docker/GoTrue/Storage/Realtime integration was not executed. No remote reset, git push or email is required.
