# Pengujian Phase 5

Status lokal dan Cloud harus dipisahkan. Akun Midtrans/key belum tersedia; tidak ada API Midtrans, deployment Edge, webhook Cloud atau simulator yang dijalankan. Phase 4 schema/API Cloud telah diperiksa read-only; real-JWT multi-account Realtime/Storage E2E tetap pending. Laporan Phase 4 historis dipertahankan.

| Lapisan | Bukti |
| --- | --- |
| Unit adapter + handler | tests/payment-edge.test.mjs: signature SHA512, nominal, pin Sandbox host, fraud/status, CORS/bounds, JWT/ownership boundary mock, timeout, duplicate create, forged settlement, reconciliation dan error redaction |
| Fresh database | [Hasil](../../tests/phase5-database-fresh-results.json): seluruh migration sebelum fixture pembayaran, database scratch lokal |
| Upgrade + Phase 1–5 | [Hasil](../../tests/phase5-database-upgrade-results.json): constraint, isolasi role, concurrency dua koneksi, duplicate/late settlement, campaign 30 hari, refund review, accounting dan receipt RLS |
| Handler + PostgreSQL | Termasuk kontrak SQL: handler Edge asli + database sungguhan sementara + HTTP Midtrans mock; Auth claims memakai adapter, bukan JWT Cloud |
| Browser pembayaran | [Hasil](../../tests/payment/browser/results.json): Chromium/SDK, mock Edge/PostgREST/Snap; popup success palsu tidak melunasi, server confirmation/receipt, Boost, error config dan responsive |
| Regresi backend/Auth/Phase 4/Demo | Folder tests/payment/regression-*; hasil baru tidak menimpa bukti historis |
| Read-only preflight | [Hasil](cloud-preflight-results.json): ngekosaja-development, 14 migration/34 tabel/58 FK/48 policy/37 fungsi, RLS aktif; tidak apply/deploy |
| CLI dry-run | [Catatan](dry-run-attempts.json): tiga percobaan timeout pada batas 55 detik, termasuk retry resolver HTTPS; **belum terverifikasi**. [Manifest lokal](remote-review-results.json) mengharapkan migration 15, bukan bukti dry-run berhasil |
| Deno + SDK binding | [Hasil](deno-verification-results.json): Deno 2.9.6 memeriksa empat entry TypeScript dan menjalankan lima tes binding SDK 2.99.3; getUser, user JWT/RLS header, service RPC, foreign invoice/status dan webhook. Semua HTTP dicegat; tes tanpa izin jaringan |
| Supabase gateway/Cloud JWT | Belum diuji pada gateway Supabase atau memakai verifikasi JWT Cloud sungguhan |
| Midtrans Sandbox API/Cloud webhook/manual E2E | **Belum dijalankan; menunggu akun/key, approval dan fixture** |

Perintah lokal:

```powershell
node --test tests/payment-edge.test.mjs tests/live-core.test.mjs tests/backend-core.test.mjs tests/development-provision.test.mjs tests/development-verification.test.mjs tests/auth-repair.test.mjs tests/database-tooling.test.mjs
node tests/domain.cjs
node scripts/database-test.mjs --native --phase5-fresh --output=tests/phase5-database-fresh-results.json
node scripts/database-test.mjs --native --extended --development-accounts --backend --phase4 --phase5 --output=tests/phase5-database-upgrade-results.json
python tests/payment_browser.py
deno check --no-lock supabase/functions/create-rent-payment/index.ts supabase/functions/create-boost-payment/index.ts supabase/functions/payment-status/index.ts supabase/functions/midtrans-webhook/index.ts
deno test --no-lock --allow-env tests/payment-runtime.test.ts
```

Node >=20, pg, PostgreSQL native loopback dan Python Playwright diperlukan hanya untuk tooling. Runner membuat database baru acak dan hanya membersihkan database scratch-nya sendiri. Tidak pernah mereset remote atau database existing. Untuk full stack lokal, gunakan Supabase CLI/Docker dan `supabase functions serve --env-file supabase/functions/.env.local`; tidak dijalankan bila tooling/credentials tidak tersedia. Mock diaktifkan hanya melalui dependency injection test, bukan konfigurasi deployed.

Screenshot aktual dari fixture mock: [checkout desktop](../../tests/payment/browser/checkout-desktop.png), [checkout mobile](../../tests/payment/browser/checkout-mobile.png). Bukan screenshot pembayaran Midtrans Cloud. Ringkasan final dan fingerprint audit disimpan pada local-verification-results.json.

Hasil akhir lokal: **80 unit**, **5 Deno/SDK runtime**, **30 domain Demo**, **19 SQL fresh**, **117 SQL upgrade/regression**, **11 browser pembayaran**, **30 backend**, **51 Auth**, **18 Phase 4**, dan **11 Demo** lolos. Audit memeriksa 14 migration applied tetap utuh, bukti historis, konfigurasi JWT, secrets frontend, asset dan link. Angka ini tidak mengubah status pending gateway Supabase/Cloud/provider E2E. Deno tersedia sementara lewat npm cache (`npm exec --yes --package=deno@2.9.6 -- deno ...`); tidak menjadi dependensi website. Tes runtime memakai nilai acak khusus mock yang tidak berlaku sebagai credential.

Kasus yang masih wajib diuji pada Sandbox Cloud: JWT dan signature asli; payer/owner lain tidak dapat membaca token atau status; dua tab, webhook duplikat/out-of-order; API timeout; nominal tidak cocok; late settlement konflik; invoice cancel/paid; Snap ditutup/token expired; realtime reconnect; receipt pemilik/penghuni; campaign aktif hanya setelah settlement; tidak ada email, uang sungguhan atau secret pada log. Refund ditangani sebagai review historis, bukan otomatisasi pengembalian uang.
