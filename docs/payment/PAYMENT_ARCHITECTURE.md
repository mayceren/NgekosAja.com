# Internal Payment Simulator

NgekosAja Payment Experience menggunakan Custom Checkout dan Instant Simulated Settlement. Tidak ada gateway eksternal, webhook, API key pembayaran, QR yang dapat dibayar, rekening, OTP, PIN atau transfer dana. Implementasi Midtrans sebelumnya tersimpan pada [arsip](archive/midtrans-phase5/README.md).

Alur: Supabase Auth getUser → akun development tervalidasi → pembacaan resource dengan JWT pengguna/RLS → satu RPC server-only → invoice/ledger/campaign/attempt/notifikasi commit atomik → respons tersimpan → pembacaan ulang PostgreSQL → halaman sukses. Browser tidak dapat menjalankan RPC settlement atau menentukan harga.

| Komponen | Kontrak |
| --- | --- |
| simulate-rent-payment | JWT, akun penghuni development, invoice miliknya; sewa DB + Rp2.000 |
| simulate-boost-payment | JWT, akun pemilik development, propertinya published; Rp30.000/30 hari |
| _shared/simulator.mjs | Guard environment/project/akun, CORS, validasi request, hasil tersimpan |
| _shared/runtime.ts | SDK 2.99.3, getUser, user JWT untuk query; service client hanya RPC spesifik |
| payment-service.js | In-flight dedup, UUID idempotency scoped, stale-session guard; tanpa Snap |
| payment-components.js + payment.css | Checkout, metode ilustratif, success, receipt/print dan keuangan terpisah |
| payment_attempts | Referensi internal, snapshot, nominal, metode, idempotency dan transaksi tersimpan |
| private.payment_simulator_settings | Kill switch DB; default disabled dan tidak dapat diakses browser |

Guard Edge membutuhkan PAYMENT_SIMULATOR_ENABLED=true, PAYMENT_ENVIRONMENT=development, PAYMENT_ALLOWED_PROJECT_REF=wfmhsbdfdcugxblqsaob dan SUPABASE_URL persis URL project tersebut. Guard DB memeriksa konfigurasi development yang eksplisit diaktifkan, marker app_metadata administratif, email fixture dan role database. user_metadata atau flag frontend tidak memberikan kewenangan. Akun pribadi, prospect dan admin tidak dapat melakukan settlement simulasi.

Akun yang diizinkan: dev-tenant-a/b@ngekosaja.test untuk sewa; dev-owner-a/b@ngekosaja.test untuk Boost. Marker development_fixture=ngekosaja-development-auth-v1 dan development_fixture_run 32 karakter hex harus tersedia. Akun existing tidak diubah atau dibuat ulang.

Demo Mode tetap memakai LocalStorage dan tidak menulis Supabase. Connected Development menyimpan transaksi simulasi permanen setelah deployment yang disetujui. Production/project lain menolak simulator; tidak tersedia pemrosesan pembayaran sungguhan.

Realtime memakai publication INSERT/UPDATE existing dengan scope payer, invoice dan properti. Cache halaman/notifikasi di-invalidasi setelah commit dan event. Tidak ada polling, subscription duplikat atau optimistic paid. Form yang sedang mengirim dilindungi dari penggantian DOM oleh Realtime.

Lihat [kontrak API](API_CONTRACTS.md), [database](DATABASE_SCHEMA.md), [lifecycle](PAYMENT_LIFECYCLE.md), [setup](SIMULATOR_SETUP.md) dan [pengujian](TESTING.md).
