# Pengujian Internal Payment Simulator

Bukti revisi dipisahkan dari pengujian Midtrans historis. Semua transaksi testing baru tetap berada pada database scratch/HTTP mock. Migration, dua fungsi dan konfigurasi Cloud sudah diterapkan setelah persetujuan; tidak ada transaksi Cloud baru, perubahan akun/password, email atau provider API.

| Lapisan | Bukti aktual |
| --- | --- |
| Unit handler | tests/payment-edge.test.mjs: 14 tes guard project/production/akun, metode, payload, CORS, error dan hasil tersimpan |
| SQL fresh | [Hasil](../../tests/phase5-simulator-fresh-results.json): seluruh migration sebelum fixture simulator |
| SQL upgrade / Phase 1–5 | [Hasil](../../tests/phase5-simulator-upgrade-results.json): constraints/RLS, dua tab, rollback setelah ledger, fee/harga, notifikasi, 30 hari, isolasi A/B, receipt dan pemisahan keuangan |
| HTTP + PostgreSQL | Handler asli dengan SQL scratch, Auth adapter; tanpa provider |
| Deno + SDK | [Hasil](deno-verification-results.json): dua entry TypeScript dan tujuh tes SDK dengan HTTP dicegat, tanpa izin jaringan untuk tes |
| Browser custom checkout | [Hasil](../../tests/payment-simulator/browser/results.json): 21 tes DOM/SDK, responsive, keyboard, reduced motion, gagal/sukses, retry reload, duplikasi submit, receipt/print, guard UI dan scoped Realtime mock |
| Regresi backend/Auth/Phase 4/Demo | tests/payment-simulator/regression-*; hasil baru disimpan terpisah |
| Cloud sebelum apply | [Preflight](revision-preflight-results.json) dan [dry-run](revision-remote-review-results.json) historis: 14 applied, satu migration revisi pending, tanpa seed/role apply |
| Cloud setelah aktivasi | [Hasil](cloud-activation-resume-results.json): 15 applied, schema/RLS/grants cocok, dua fungsi ACTIVE/JWT wajib, switch aktif, fingerprint data existing sama dan nol pending |
| HTTP Cloud | Capability enabled 200; kedua fungsi tanpa autentikasi 401; origin asing 403; RPC writer anonim ditolak; CORS origin lokal 204 |
| Akun development Cloud | Enam profil/role/marker diperiksa read-only; tidak login atau mengganti akun/password |
| Cloud E2E | Transaksi dengan login/password existing belum dijalankan; fixture testing memerlukan persetujuan tersendiri atau dibuat pengguna lewat UI |

Perintah: npm run test:payment, npm run test:payment-sql, npm run test:payment-runtime, npm run test:payment-audit; python tests/payment_browser.py. Fresh SQL: node scripts/database-test.mjs --native --phase5-fresh --output=tests/phase5-simulator-fresh-results.json. Website uji dijalankan dengan npm run dev (tes browser default 127.0.0.1:5501; NGEKOSAJA_TEST_ORIGIN dapat disesuaikan).

Tooling opsional Node >=20, pg, PostgreSQL loopback 55432, Python/Playwright, serta Deno 2.9.6 untuk tes binding. Runner Deno menerima NGEKOSAJA_DENO bila binary tidak ada di PATH. Seluruh scratch database dibuat acak dan hanya database milik runner yang dibuang; tidak mereset input database/remote.

SQL menguji is_simulation=true, nominal DB, invoice berubah paid, unique successes, key collision, distinct-key two-tab race, role/server-only, personal account/metadata forgery, environment guard dan rollback semua tabel setelah kegagalan. Kelompok nonsimulasi di SQL hanya control fixture lokal untuk membuktikan pemisahan; bukan transaksi uang asli.

Browser menguji response gagal tidak menghasilkan sukses palsu, idempotency key bertahan reload, state bersih setelah logout, metode ilustratif dan ketiadaan request Midtrans. Realtime delivery memakai mock; publication/RLS dan subscriptions diuji terpisah. Tidak mengklaim delivery WebSocket/JWT Cloud sebagai lulus.

Screenshot: [desktop](../../tests/payment-simulator/browser/checkout-desktop.png), [mobile](../../tests/payment-simulator/browser/checkout-mobile.png), [success](../../tests/payment-simulator/browser/success-desktop.png), [receipt](../../tests/payment-simulator/browser/receipt-desktop.png). Angka suite final yang dijalankan ulang tersedia pada local-verification-results.json.

Hasil final revisi: 69 unit gabungan, 7 Deno/SDK, 30 domain Demo, 19 SQL fresh, 117 SQL upgrade, 21 browser pembayaran, 30 backend, 51 Auth, 18 Phase 4, 11 Demo; tidak ada kegagalan atau exception JavaScript pada hasil akhir.
