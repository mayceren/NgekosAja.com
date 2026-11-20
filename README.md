# NgekosAja.com

Phase 5 revisi menggunakan **Internal Payment Simulator** dengan Custom Checkout, empat metode ilustratif, Instant Simulated Settlement, invoice/Boost atomik dan receipt berlabel SIMULASI. Tidak ada gateway atau pemindahan uang. **Migration 15, dua Edge Functions dan konfigurasi simulator sudah aktif di ngekosaja-development setelah persetujuan.** Postflight dan penolakan HTTP tanpa autentikasi lulus; transaksi Cloud dengan akun login belum diuji. Simulator hanya mengizinkan empat akun fixture tenant/owner, dengan guard server dan DB. Lihat [status Phase 5](docs/payment/PHASE5_COMPLETION.md), [aktivasi aktual](docs/payment/CLOUD_VERIFICATION.md), [setup](docs/payment/SIMULATOR_SETUP.md), [API](docs/payment/API_CONTRACTS.md) dan [pengujian](docs/payment/TESTING.md). [Histori Midtrans](docs/payment/archive/midtrans-phase5/README.md) diarsipkan.

Phase 4 menambahkan Realtime dan Cloud Storage pada frontend existing. **Migration 14 telah diterapkan setelah persetujuan dan lulus postflight Cloud; pengujian realtime/upload antar-akun masih perlu diselesaikan.** Lihat [status](docs/phase4/PHASE4_COMPLETION.md), [setup](docs/phase4/SETUP_GUIDE.md), [pengujian](docs/phase4/TESTING.md), [Realtime](docs/realtime/REALTIME_ARCHITECTURE.md), dan [Storage](docs/storage/STORAGE_ARCHITECTURE.md). Tidak ada reset, perubahan akun/password atau git push.

**Cari Kos, Bayar Sewa, Kelola Semua dalam Satu Tempat.**

## Product Overview

NgekosAja.com merupakan platform digital yang menghubungkan calon penghuni, penghuni, serta pemilik atau pengelola kos melalui layanan pencarian properti, pembayaran sewa, dan pengelolaan operasional dalam satu sistem yang terintegrasi.

Produk menggabungkan **Property Marketplace**, **Integrated Rental Payment**, dan **Property Management**. Phase 3 menambahkan service layer dan antarmuka bisnis terhubung untuk properti, kamar, sewa, tagihan, keluhan, pesan dan laporan. **Migration Phase 3 sudah diterapkan ke Cloud setelah persetujuan dan lulus postflight.** Uji bisnis multi-akun Cloud masih perlu dilakukan terpisah. Pembayaran Connected belum memproses uang sungguhan; Demo tetap terpisah.

[Status dan feature matrix Phase 3](docs/backend/PHASE3_COMPLETION.md), [panduan integrasi](docs/backend/INTEGRATION_GUIDE.md), [kontrak API](docs/backend/API_CONTRACTS.md), dan [bukti pengujian](docs/backend/TESTING.md).

## Key Features

| Area | Akun terhubung | Demo Produk |
| --- | --- | --- |
| Authentication | Supabase Auth, session persistence, profil, pemulihan password, role database, protected routes | Profil dan peran contoh tanpa password |
| Marketplace | Katalog aman, filter/sort/range, grid/list, galeri, favorit, perbandingan dan recent searches; katalog published dari PostgreSQL | 16 listing ilustrasi, filter gabungan, sort, favorit, perbandingan dan galeri |
| Property Management | UI/services/RPC tersedia dan migration Cloud diterapkan; uji bisnis multi-akun Cloud belum selesai | Properti/kamar, check-in/check-out, penghuni, tagihan, jadwal dan laporan |
| Rental Payment | Payment gateway belum diintegrasikan | Checkout berhasil/gagal, admin Rp2.000, bukti cetak, reminder H-3, pencegahan pembayaran ganda |
| Maintenance & Chat | Keluhan/timeline/analisis/notifikasi via API dan direktori chat sudah tersedia; QA Cloud bisnis belum dijalankan | Tracking keluhan, konfirmasi penghuni, analisis aturan teks, lampiran dan chat lokal |
| Boost Listing | Pembelian promosi belum diintegrasikan | Simulasi Rp30.000/30 hari, badge Promosi, prioritas rekomendasi dan metrik interaksi lokal |

Coba Demo tersedia sebelum login dan memakai penyimpanan terpisah. Pengguna dapat mencoba perspektif calon penghuni, penghuni, pemilik, dan administrator tanpa membuat akun Supabase. Jumlah listing, akun, transaksi dan pendapatan demo bukan klaim pelanggan atau performa bisnis nyata.

## Technology Stack

- HTML5, CSS3, Vanilla JavaScript ES6+, SVG, Grid dan Flexbox; tanpa framework atau build frontend.
- Supabase Auth dan PostgreSQL dengan RLS untuk akun/data terhubung; SDK resmi tersedia lokal.
- LocalStorage untuk data demo; sessionStorage/localStorage untuk session Auth sesuai pilihan Ingat saya.
- Node.js >=20, Supabase CLI dan PostgreSQL native untuk tooling opsional.
- Playwright/Chromium untuk regresi browser; node:test untuk unit test.

Teknologi open-source dan layanan free tier tetap digunakan. Tidak ada layanan email tambahan atau dependency berbayar yang ditambahkan.

## System Architecture

Browser menjalankan hash router dan dua environment yang terpisah:

1. **Akun terhubung:** SDK memvalidasi session melalui Supabase Auth, memuat profil/role dari PostgreSQL, kemudian menerapkan route guard. Query tetap dibatasi RLS di server.
2. **Demo Environment:** alur bisnis berjalan pada sample data lokal. Mode ini tidak memberikan role Supabase atau menulis data bisnis Cloud.

[Arsitektur Auth](docs/auth/AUTH_ARCHITECTURE.md), [navigasi akun](docs/auth/NAVIGATION.md), dan [model data demo](docs/DATA_MODEL.md).

## Database Architecture

Database Cloud saat ini memiliki **13 migrasi, 32 tabel aplikasi dengan RLS, 53 foreign key, 46 policy, dan 30 fungsi publik**, sesuai postflight Phase 3. Fondasi Phase 1 sebelumnya memiliki 12 migrasi/31 tabel; dokumentasi historisnya tetap dipertahankan. Model mencakup identitas/role, properti/kamar, perjanjian sewa, tagihan/ledger, keluhan, chat, notifikasi dan promosi.

Migration `20261119000200_backend_integration.sql` sudah diterapkan ke `ngekosaja-development` setelah persetujuan, menggunakan CLI 3.2.0 dan `--skip-vault`. Tidak ada migration pending. Data pada seluruh 31 tabel existing tetap sama berdasarkan perbandingan fingerprint sebelum/sesudah; tidak ada seed, reset atau perubahan akun. [Laporan penerapan](docs/backend/remote-apply-results.json), [pemeriksaan read-only terbaru](docs/backend/remote-post-apply-review-results.json), dan [dry-run sebelum persetujuan](docs/backend/remote-review-results.json).

[Schema](docs/database/DATABASE_SCHEMA.md), [ERD](docs/database/ERD.md), [Data Dictionary](docs/database/DATA_DICTIONARY.md), [RLS policies](docs/database/RLS_POLICIES.md), [migration history](docs/database/MIGRATION_GUIDE.md), [verifikasi fondasi](docs/database/PHASE1_COMPLETION.md).

## Project Structure

```text
index.html              Entry point dan metadata
css/                    Design system dan responsive layout
js/                     Router, UI dan domain Demo Produk
js/auth/                Supabase Auth, profil, role dan route guard
config/                 Konfigurasi publik browser
assets/                 Foto, font, ikon dan SDK lokal
supabase/migrations/    Migrasi PostgreSQL berurutan
supabase/tests/         Kontrak SQL untuk database test sementara
scripts/                Server lokal dan tooling administratif
tests/                 Unit/browser tests dan bukti historis
docs/                  Panduan teknis, produk dan hasil pemeriksaan
docs/archive/          Dokumen arsip; bukan instruksi operasional aktif
```

## Getting Started

```powershell
npm ci
npm run dev
```

Buka **http://127.0.0.1:5500/**. Server hanya melayani file publik dan menolak secret, tooling serta file internal. VS Code Live Server pada port 5500 juga dapat digunakan tanpa build. Membuka index.html melalui file:// hanya mendukung Demo Produk; Supabase Auth memerlukan HTTP dan internet. Gunakan origin yang sama sepanjang sesi.

## Installation & Configuration

config/runtime.js berisi Project URL dan Publishable Key yang memang publik. Untuk checkout baru, ikuti bentuk config/runtime.example.js. Jangan menambahkan service role key, server secret atau password database ke frontend.

Callback login/verifikasi/pemulihan harus masuk allowlist Supabase untuk origin yang dipakai. Workspace terhubung ke **ngekosaja-development**. Jangan melakukan config push penuh, mengubah setting hosted, menerapkan migrasi, atau membuat akun remote tanpa otorisasi yang sesuai. [Setup Auth](docs/auth/AUTH_SETUP.md) dan [setup database](docs/database/SETUP_GUIDE.md).

## Authentication & Authorization

Confirm Email dinonaktifkan pada environment development sesuai hasil pemeriksaan read-only sebelumnya. Jika signup mengembalikan session aktif, identitas/profil/role diverifikasi sebelum pengguna masuk dan menerima notifikasi berhasil. Jika tidak ada session, alur verifikasi tetap tersedia. Signup publik memberi prospect; memilih tujuan pemilik tidak memberi owner/admin.

Login menuju home; pengaturan profil memiliki menu terpisah. Logout berada paling bawah menu akun dan meminta konfirmasi. Recovery tetap memerlukan email Supabase serta callback/session pemulihan yang valid; kuota email tetap berlaku. Menonaktifkan Confirm Email bukan bukti kepemilikan inbox atau konfigurasi siap production.

[Role management](docs/auth/ROLE_MANAGEMENT.md) dan [Development Test Accounts](docs/auth/DEVELOPMENT_ACCOUNTS.md). Provisioning akun development menggunakan Admin API hanya melalui script server administratif. Perintah default membuat plan read-only; pembuatan remote memerlukan persetujuan dan password pribadi melalui terminal tersembunyi. Enam akun development kemudian dibuat setelah persetujuan dan lulus verifikasi Cloud; gunakan akun yang sudah tersedia tanpa apply ulang.

[Finalisasi Phase 2](docs/auth/PHASE2_FINALIZATION.md) mencatat kondisi Cloud terbaru serta syarat lanjut Phase 3. Keenam akun telah lulus login, profil, role, isolasi, pemulihan session SDK dan logout melalui Supabase Cloud. Fondasi development siap untuk Phase 3; akun pribadi dan password/role existing tidak diubah.

## Security

- RLS dan role database tetap menjadi batas akses server; route guard bukan pengganti RLS.
- Metadata pendaftaran tidak dapat memberikan owner/admin. RPC sensitif tidak tersedia bagi JWT pengguna biasa.
- Service key/password tidak masuk frontend, repository atau log. File privat dan receipt administratif diabaikan Git.
- Reset Data Demo hanya memengaruhi state demo di browser, bukan akun atau database Supabase.
- Tidak ada PIN, OTP, kartu atau rekening yang diminta oleh checkout simulasi.

[Audit keamanan terdokumentasi](docs/auth/security-audit-results.json). Secret scan berbasis pola bukan jaminan seluruh Git history bebas credential; jangan menaruh secret pada direktori publik server statis.

## Development Roadmap

1. Fondasi PostgreSQL, constraint, RLS, laporan dan histori migrasi: tersedia dengan bukti pemeriksaan.
2. Authentication, profil, role dan katalog publik: tersedia; enam akun development telah diprovisikan setelah persetujuan dan lulus verifikasi Cloud.
3. Integrasi workspace bisnis terhubung: implementasi lokal tersedia; migration tambahan telah diterapkan setelah persetujuan; verifikasi bisnis Cloud multi-akun masih pending.
4. Integrasi pembayaran, pengiriman notifikasi, Storage dan scheduler setelah rancangan operasional serta keamanan ditinjau.
5. Kesiapan production: pengujian environment target, pengiriman email, pemantauan, backup/restore dan evaluasi keamanan.

Roadmap bukan klaim bahwa integrasi yang belum tersedia sudah berfungsi.

## Testing

```powershell
npm run test:frontend
npm run test:auth-provision
npm run test:auth-repair
npm run test:database-tooling
python tests/auth_browser.py
python tests/browser_check.py
```

Tes browser membutuhkan Python, Playwright dan Chromium yang terpasang pada environment development. Website sendiri tidak memerlukan dependency Python. Untuk memisahkan artefak regresi baru dari bukti lama, gunakan NGEKOSAJA_TEST_OUTPUT. Auth browser mendukung NGEKOSAJA_TEST_ORIGIN; browser demo menerima --url.

Dengan cluster PostgreSQL test loopback yang sudah aktif:

```powershell
npm run db:test -- --native --postflight --development-accounts --backend --output=tests/backend-database-upgrade-results.json
```

Runner membuat database acak baru, lalu membersihkannya. Jangan mereset remote. SQL adapter lokal tidak menguji GoTrue/JWT/PostgREST nyata; tes browser Auth menggunakan HTTP mock. Lihat [hasil Auth](docs/auth/AUTH_TESTING.md), [hasil database](docs/database/VERIFICATION.md), dan [audit konten](docs/CONTENT_AUDIT.md). Hasil historis tetap dipertahankan.

## Deployment

Frontend dapat disajikan melalui HTTP static hosting; konfigurasi origin/callback dan akses file publik harus ditinjau untuk environment tujuan. Jangan menerbitkan .env, scripts, node_modules, supabase/.temp atau receipt administratif. Tidak ada deployment frontend atau git push. Migration database Phase 3 telah diterapkan setelah persetujuan; perubahan tersebut tercatat pada laporan backend.

Produk masih dalam pengembangan dan **belum dinyatakan siap production**. Deployment production memerlukan pemeriksaan terpisah atas Auth/email, RLS, integrasi operasional, observability dan pengelolaan secret.

## Current Limitations

- Pembayaran/boost Connected menunggu gateway; simulasi berhasil/gagal hanya pada Demo. Tidak ada koneksi bank, QRIS atau dompet digital.
- Migration Phase 3 sudah diterapkan; QA bisnis Cloud multi-akun belum selesai. Tidak ada fallback ke data demo.
- Chat, notifikasi, jadwal dan analytics demo bersifat lokal, tanpa realtime/scheduler lintas perangkat.
- Analisis keluhan mencocokkan kata kunci teks; tidak menganalisis foto atau menggantikan diagnosis teknis/darurat.
- Foto demo maksimal 1 MB; kapasitas LocalStorage bergantung browser. Simpan PDF memakai dialog cetak browser.
- Booking otomatis, gateway, Storage, pengiriman email production dan MFA end-to-end belum diverifikasi.
- Inbound email dan signup Cloud tanpa Confirm Email belum diuji ulang oleh cleanup konten ini.

[Demo Produk](docs/DEMO_GUIDE.md), [kredit aset](assets/CREDITS.md), dan [arsip](docs/archive/README.md).
