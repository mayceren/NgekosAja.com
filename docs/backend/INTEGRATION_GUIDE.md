# Running and integrating Phase 3

Run `npm run dev` and open the printed loopback URL (default port 5500), or use Live Server. No backend server installation is needed by the application. Preserve the existing `config/runtime.js` publishable configuration. Existing Auth redirect-origin requirements still apply; use a consistent HTTP origin for email/PKCE flows.

Connected Mode uses the actual account session and database; Demo is explicitly selected before login and remains isolated. After login the user lands on home. Dashboard availability follows effective database rights. Profile retains the public navbar and a logout confirmation at the bottom of its settings menu. Preferensi extends those menus.

## Approved Cloud migration completed

Applied migration: `supabase/migrations/20261119000200_backend_integration.sql`, following the user's explicit approval. It adds atomic save APIs, member directory/operational summary and explicit rental consent. It deliberately tightens the old check-in API; see [API review](API_CONTRACTS.md). Existing application data/policies and unrelated functions were preserved. No reset, seed, fixture publication or user mutation was performed.

Read-only review, safe to rerun:

```powershell
node scripts/backend-remote-review.mjs
```

The tool verifies the linked ref/name and runs CLI 3.2 syntax `db push --remote=wfmhsbdfdcugxblqsaob --dry-run --skip-vault --output-format json`. Before apply it expects exactly the reviewed migration; after apply it expects 13 migrations and no pending files, verifies backend metadata and checks anonymous API rejection. The original pre-approval report is preserved; current checks write `remote-post-apply-review-results.json`.

The completed scoped apply used `scripts/apply-backend-migration.mjs` with the exact approved SHA-256 and `--skip-vault`, without `--include-seed`. This script refuses rerun when its apply report exists; use read-only review instead. It checked target, all migration hashes, prior test results, unchanged baseline metadata, one-migration dry-run, before/after row digests and final schema/grants/RLS/history. Evidence: [remote-apply-results.json](remote-apply-results.json). Do not run the historical Phase 1/2 audit as if the current Cloud should still have exactly 12 migrations.

Cloud now has six existing development accounts plus one personal account, two draft properties/rooms/active agreements and no public catalogue rows at review time. The empty marketplace is expected. Do not manufacture public data or re-provision those accounts. Cloud business E2E needs a separate approved fixture plan; any password input must use the existing private interactive terminal mechanism, never chat/arguments/files. Do not change personal accounts or reset passwords to automate QA.

The save/consent/directory/summary APIs now exist in Cloud with the expected grants. Positive flows still require authorized accounts and proper business state. No LocalStorage fallback or partial sequential browser writes were introduced. Multi-account business testing is not considered complete merely because migration/postflight succeeded.

## Local testing

```powershell
node --test tests/backend-core.test.mjs
node scripts/database-test.mjs --native --backend-fresh --output=tests/backend-database-fresh-results.json
node scripts/database-test.mjs --native --extended --postflight --development-accounts --backend --output=tests/backend-database-upgrade-results.json
python tests/backend_browser.py
```

The SQL commands require a loopback PostgreSQL test cluster, by default port 55432/user ngekosaja_test. They create/drop only a newly generated scratch database. They never reset or migrate the input database or Cloud. Native adapter models Auth claims, not GoTrue/PostgREST. Browser test defaults to a separately started local server on 5501 and intercepts all Supabase HTTP. No email is sent.

For large portfolios: forms currently expose at most 100 property/room/agreement choices; conversation directory caps 100 and favorite resolution caps 100. Extend paged pickers before using larger production datasets.
