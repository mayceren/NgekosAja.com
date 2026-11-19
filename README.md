# NgekosAja.com

**Cari Kos, Bayar Sewa, Kelola Semua dalam Satu Tempat.**

## Product Overview

NgekosAja.com merupakan platform digital yang menghubungkan calon penghuni, penghuni, serta pemilik atau pengelola kos melalui layanan pencarian properti, pembayaran sewa, dan pengelolaan operasional dalam satu sistem yang terintegrasi.

Produk menggabungkan **Property Marketplace**, **Integrated Rental Payment**, dan **Property Management**. Pengembangan saat ini mencakup fondasi database, autentikasi, katalog publik, dan Demo Produk untuk mengeksplorasi alur bisnis dengan data ilustrasi. Integrasi operasional untuk akun terhubung masih dalam pengembangan; pembayaran belum memproses uang sungguhan.

## Key Features

| Area | Akun terhubung | Demo Produk |
| --- | --- | --- |
| Authentication | Supabase Auth, session persistence, profil, pemulihan password, role database, protected routes | Profil dan peran contoh tanpa password |
| Marketplace | Pencarian nama/lokasi dan detail listing terpublikasi melalui katalog aman | 16 listing ilustrasi, filter gabungan, sort, favorit, perbandingan dan galeri |
| Property Management | Schema, RLS dan fungsi transaksi tersedia; workspace operasional belum diintegrasikan | Properti/kamar, check-in/check-out, penghuni, tagihan, jadwal dan laporan |
| Rental Payment | Payment gateway belum diintegrasikan | Checkout berhasil/gagal, admin Rp2.000, bukti cetak, reminder H-3, pencegahan pembayaran ganda |
| Maintenance & Chat | Integrasi antarmuka bisnis masih dalam pengembangan | Tracking keluhan, konfirmasi penghuni, analisis aturan teks, lampiran dan chat lokal |
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

Fondasi database terdiri dari **12 migrasi, 31 tabel aplikasi dengan RLS, 48 foreign key, dan 45 policy**, sesuai pemeriksaan Cloud terdokumentasi. Model mencakup identitas/role, properti/kamar, perjanjian sewa, tagihan/ledger, keluhan, chat, notifikasi dan promosi. Constraint serta fungsi atomik melindungi relasi, histori, penempatan kamar dan pencatatan pembayaran.

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

[Role management](docs/auth/ROLE_MANAGEMENT.md) dan [Development Test Accounts](docs/auth/DEVELOPMENT_ACCOUNTS.md). Provisioning akun development menggunakan Admin API hanya melalui script server administratif. Perintah default membuat plan read-only; pembuatan remote memerlukan persetujuan dan password pribadi melalui terminal tersembunyi. Tidak ada akun remote baru yang dibuat oleh cleanup konten ini.

## Security

- RLS dan role database tetap menjadi batas akses server; route guard bukan pengganti RLS.
- Metadata pendaftaran tidak dapat memberikan owner/admin. RPC sensitif tidak tersedia bagi JWT pengguna biasa.
- Service key/password tidak masuk frontend, repository atau log. File privat dan receipt administratif diabaikan Git.
- Reset Data Demo hanya memengaruhi state demo di browser, bukan akun atau database Supabase.
- Tidak ada PIN, OTP, kartu atau rekening yang diminta oleh checkout simulasi.

[Audit keamanan terdokumentasi](docs/auth/security-audit-results.json). Secret scan berbasis pola bukan jaminan seluruh Git history bebas credential; jangan menaruh secret pada direktori publik server statis.

## Development Roadmap

1. Fondasi PostgreSQL, constraint, RLS, laporan dan histori migrasi: tersedia dengan bukti pemeriksaan.
2. Authentication, profil, role dan katalog publik: tersedia; validasi akun development Cloud lanjutan memerlukan provisioning yang disetujui.
3. Integrasi workspace bisnis terhubung: properti, penghuni, tagihan, keluhan, chat dan promosi.
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
npm run db:test -- --native --postflight --development-accounts --output=tests/branding-database-results.json
```

Runner membuat database acak baru, lalu membersihkannya. Jangan mereset remote. SQL adapter lokal tidak menguji GoTrue/JWT/PostgREST nyata; tes browser Auth menggunakan HTTP mock. Lihat [hasil Auth](docs/auth/AUTH_TESTING.md), [hasil database](docs/database/VERIFICATION.md), dan [audit konten](docs/CONTENT_AUDIT.md). Hasil historis tetap dipertahankan.

## Deployment

Frontend dapat disajikan melalui HTTP static hosting; konfigurasi origin/callback dan akses file publik harus ditinjau untuk environment tujuan. Jangan menerbitkan .env, scripts, node_modules, supabase/.temp atau receipt administratif. Tidak ada deployment, konfigurasi remote atau git push yang dilakukan pada cleanup ini.

Produk masih dalam pengembangan dan **belum dinyatakan siap production**. Deployment production memerlukan pemeriksaan terpisah atas Auth/email, RLS, integrasi operasional, observability dan pengelolaan secret.

## Current Limitations

- Pembayaran dan boost hanya simulasi; tidak ada koneksi bank, QRIS atau dompet digital.
- Workspace bisnis akun terhubung belum mengelola data operasional; Demo Produk tidak dijadikan data akun nyata.
- Chat, notifikasi, jadwal dan analytics demo bersifat lokal, tanpa realtime/scheduler lintas perangkat.
- Analisis keluhan mencocokkan kata kunci teks; tidak menganalisis foto atau menggantikan diagnosis teknis/darurat.
- Foto demo maksimal 1 MB; kapasitas LocalStorage bergantung browser. Simpan PDF memakai dialog cetak browser.
- Booking otomatis, gateway, Storage, pengiriman email production dan MFA end-to-end belum diverifikasi.
- Inbound email dan signup Cloud tanpa Confirm Email belum diuji ulang oleh cleanup konten ini.

[Demo Produk](docs/DEMO_GUIDE.md), [kredit aset](assets/CREDITS.md), dan [arsip](docs/archive/README.md).
