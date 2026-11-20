# Arsitektur pembayaran Phase 5

Implementasi lokal menggunakan Midtrans Snap **Sandbox saja**, Supabase Edge Functions, PostgreSQL, Auth, RLS, dan frontend Vanilla JavaScript existing. Akun/key Midtrans belum tersedia menurut pengguna; belum ada deployment, transaksi Midtrans sungguhan maupun pengujian Cloud webhook. Hasil mock tidak dianggap bukti integrasi Sandbox Cloud.

Alur sewa: JWT pengguna diverifikasi melalui Auth getUser → query invoice memakai JWT/RLS → RPC server memeriksa ulang tenant dan harga → payment_attempt tersimpan → lease pembuatan Snap → API Sandbox → token disimpan terpisah → Snap dibuka → webhook bertanda tangan diverifikasi → Get Status API Sandbox → operasi PostgreSQL atomik → invoice/ledger/notifikasi → realtime dan receipt. Browser hanya mengirim invoice_id; biaya sewa dan Rp2.000 dihitung server.

Alur Boost: resource property_id harus milik owner, published, tanpa campaign bertabrakan → Rp30.000, 30 hari → Snap → settlement terverifikasi → server_record_boost → satu campaign. Capture kartu yang fraud_status=accept dapat melunasi sewa, tetapi Boost menunggu settlement. Status pending tidak menghasilkan pendapatan atau campaign.

| Komponen | Tanggung jawab |
| --- | --- |
| create-rent-payment | JWT, invoice/RLS, reserve order dan Snap |
| create-boost-payment | JWT, kepemilikan properti, harga server dan Snap |
| payment-status | JWT/RLS, status attempt; reconciliation manual dibatasi 15 detik/attempt |
| midtrans-webhook | Tanpa JWT Supabase; signature SHA512 dan Get Status wajib sebelum pencatatan |
| _shared/midtrans.mjs | Adapter HTTP, endpoint Sandbox tetap, validasi nominal/status, signature |
| _shared/payment-handler.mjs | Handler HTTP yang sama untuk Edge dan test Node; dependency injection khusus pengujian |
| _shared/runtime.ts | Binding SDK 2.99.3, JWT user client dan privileged RPC terbatas |
| js/services/payment-service.js | Singleton SDK existing, in-flight dedup, lazy Snap, stale-session guards |
| js/components/payment-components.js | Checkout, Boost, riwayat attempt, receipt dan pemisahan laporan |

Migration lokal `20261120000100_sandbox_payments.sql` menambahkan tiga tabel:

ERD dan dictionary lengkap: [model data pembayaran](DATABASE_SCHEMA.md).

- payment_attempts: payer, invoice/property, order UUID, snapshot nama, nominal/fee/gross, environment sandbox, status, gateway ID, transaction FK dan waktu verifikasi/expiry. SELECT hanya payer, owner properti atau administrator; tidak ada browser write.
- payment_sessions: token Snap dan lease pembuatan, hanya server. Token tidak masuk tabel Realtime, localStorage, URL aplikasi atau log.
- payment_events: status terverifikasi dengan hash deduplikasi dan outcome; append-only, server-only. Tidak menyimpan payload kartu, account number, signature atau Server Key.

RPC server-only: server_reserve_payment, server_payment_session, server_save_snap, server_apply_payment dan server_claim_reconciliation. server_record_rent_payment/server_record_boost tetap dipertahankan, beserta guard invoice/ledger/campaign existing. payment_accounting menghasilkan kelompok Sandbox dan nonsimulasi; payment_capabilities hanya menampilkan versi/environment. Tidak ada RPC publik untuk settlement dari browser.

Payment attempts, transactions dan boost_campaigns ditambahkan ke publication INSERT/UPDATE existing. Subscription mengikuti payer/property/role pada halaman aktif; Snap callback hanya meminta reconciliation. Tidak ada polling agresif atau status sukses optimistis. Invoice/event/notifikasi tetap menjadi sumber kebenaran server.

Dokumentasi primer: [Midtrans Snap](https://docs.midtrans.com/docs/snap-snap-integration-guide), [Supabase Edge Functions](https://supabase.com/docs/guides/functions), [pengamanan Edge Functions](https://supabase.com/docs/guides/functions/auth).
