# NgekosAja.com 3.0 — Phase 2

**Authentication & Authorization sudah diimplementasikan:** Supabase Auth nyata, verifikasi email, recovery/reset password, session, profil PostgreSQL, role database dan protected routes. UI premium versi 2 dipertahankan. Connected Mode adalah default; Coba Demo membuka data simulasi terpisah tanpa akses backend.

```powershell
npm run dev
```

Buka **http://127.0.0.1:5500/#/register** atau **http://127.0.0.1:5500/#/login**. SDK lokal dan konfigurasi URL/Publishable Key sudah tersedia; tidak ada service/secret key di frontend. Jika node_modules belum ada untuk tooling, jalankan npm ci. Live Server port 5500 didukung; file:// untuk Demo saja. Buka link verifikasi/pemulihan pada browser tempat permintaan dibuat.

Dokumentasi: [arsitektur Auth](docs/auth/AUTH_ARCHITECTURE.md), [setup dan callback/SMTP](docs/auth/AUTH_SETUP.md), [role management](docs/auth/ROLE_MANAGEMENT.md), [hasil pengujian aktual](docs/auth/AUTH_TESTING.md).

Hasil: **33 kelompok browser Auth, 14 test pemulihan administratif, 3 guard QA offline**, serta pemeriksaan sebelumnya (52 SQL/RLS, 30 domain demo dan 11 kelompok browser bisnis demo). Hasil 13 Cloud Auth awal adalah historis; pengujian tersebut keliru memakai alamat pribadi dan meninggalkan password acak. Akun sudah terverifikasi dan dilindungi dari QA. **Jalankan npm run auth:repair-test-account dan isi password sendiri pada terminal tersembunyi**, lalu login; tidak memerlukan email atau quota. [Perbaikan dan status aktual](docs/auth/AUTH_RECOVERY_FIX.md). Penerimaan inbox dan konfirmasi dua alamat saat email change belum diverifikasi.

Pendaftaran publik memberi prospect. Tujuan pemilik memerlukan grant administratif; tenant mengikuti rental agreement yang sah. Tidak ada schema migration baru, reset remote atau git push. Connected workspace bisnis menampilkan state Phase 3, tanpa menampilkan data demo sebagai data akun sungguhan.

## Fondasi database dan referensi Demo 2.0

[Phase 1 Database Foundation selesai — 19 November 2026](docs/database/PHASE1_COMPLETION.md): dua temuan telah diperbaiki di Cloud, 12 migrasi applied dan 0 pending. Tes fresh install 52 kelompok dan upgrade 54 kelompok lulus; frontend tetap versi 2. Auth/JWT/HTTP menjadi pemeriksaan awal integrasi Phase 2.

Fondasi **3.0 Phase 1 — Database Foundation** tersedia terpisah di `supabase/` dan `scripts/`. Frontend versi 2 tetap memakai LocalStorage dan dapat dijalankan seperti sebelumnya. Dua belas migrasi dan seed master telah diterapkan ke project Supabase development setelah persetujuan pengguna; integrasi frontend dan UI tetap seperti versi 2.

Mulai dari [setup database](docs/database/SETUP_GUIDE.md), [schema dan tabel](docs/database/DATABASE_SCHEMA.md), [ERD](docs/database/ERD.md), [Data Dictionary](docs/database/DATA_DICTIONARY.md), [RLS](docs/database/RLS_POLICIES.md), [migrasi](docs/database/MIGRATION_GUIDE.md), [seed/fixture Auth](docs/database/SEED_GUIDE.md), dan [hasil pengujian aktual](docs/database/VERIFICATION.md). Tool database opsional: `npm ci`; pengujian PostgreSQL native lokal: `npm run db:test -- --native`. Stack Supabase lengkap membutuhkan Docker/Podman.

[Hasil remote terkini](docs/database/PHASE1_COMPLETION.md): 12 migrasi, 31 tabel dengan RLS aktif, 45 policy, serta 7 fasilitas master terverifikasi pada `ngekosaja-development`. [Penerapan awal 11 migrasi](docs/database/REMOTE_DEPLOYMENT.md) dan [review sebelum apply](docs/database/REMOTE_REVIEW.md) dipertahankan sebagai histori.

**Cari Kos, Bayar Sewa, Kelola Semua dalam Satu Tempat.**

Upgrade prototype PropTech Business Model Lean Canvas (BMLC), Milestone 2 Technopreneurship. Dibangun dengan HTML5, CSS, JavaScript ES6+, navigasi hash, dan LocalStorage. Tidak memerlukan build, database, API key, atau instalasi npm.

## Jalankan

1. Buka folder project ini di VS Code.
2. Klik kanan `index.html` → **Open with Live Server**.
3. Alternatif: buka `index.html` langsung di Chrome/Edge/Firefox.
4. Alternatif terminal: `python -m http.server 5500`, lalu buka `http://localhost:5500`.

Gunakan origin yang sama selama presentasi. `file://`, `localhost`, `127.0.0.1`, dan port berbeda mempunyai penyimpanan terpisah. Seluruh foto, font, dan ikon tersedia lokal sehingga website tidak membutuhkan koneksi internet.

## Apa yang berubah

- Redesign menyeluruh: deep forest green, warm cream, heading editorial Cormorant Garamond, body Plus Jakarta Sans, fotografi besar, komposisi bento, status yang konsisten, modal, toast, drawer, dan motion singkat dengan dukungan reduced motion.
- Homepage baru: pencarian lokasi/budget/tipe, rekomendasi, delapan area populer, pencarian berdasarkan kebutuhan, pembayaran transparan, pratinjau workspace dari state, alur penggunaan, FAQ interaktif, serta CTA pemilik.
- Marketplace **16 listing ilustrasi**: pencarian/saran lokasi dan nama, recent searches, rentang harga, tipe, beberapa fasilitas sekaligus, ketersediaan, chips, reset, grid/list, wishlist per identitas, dan perbandingan maksimal tiga kos.
- Detail kos: galeri/thumbnail/fullscreen viewer, fasilitas, tipe kamar, peraturan, area sekitar berlabel ilustrasi, pengelola terkait, rekomendasi serupa, favorit, copy link, dan percakapan yang tepat.
- Akun: halaman Masuk, Daftar, pilihan peran, pemulihan akses demo, pengaturan profil, logout, dan Quick Demo Access. Tidak meminta atau menyimpan kata sandi.
- **Multi-owner**: tiga pemilik awal, dengan pembatasan pada query dan fungsi bisnis untuk properti, kamar, penghuni, tagihan, transaksi, keluhan, chat, promosi, aktivitas, dan laporan. Marketplace tetap menampilkan seluruh listing publik.
- Workspace pemilik: sidebar berkelompok dan dapat diringkas, grafik pendapatan interaktif, occupancy donut, distribusi pembayaran, transaksi, jatuh tempo, aktivitas, quick actions, serta filter properti/periode.
- Properti: tambah/edit foto lokal atau unggahan, deskripsi, alamat, harga, fasilitas, aturan, kapasitas, preview, arsip/publikasi, dan hapus tanpa riwayat.
- Kamar: halaman grid khusus, filter properti/status, status Tersedia/Terisi/Dalam perbaikan/Tidak aktif, tipe, harga, fasilitas, dan pengamanan penempatan ganda.
- Penghuni: pencarian/filter, profil, masa sewa, harga dan jadwal pembayaran, pindah kamar pada properti pemilik aktif, riwayat tagihan/keluhan, check-in dan check-out dengan histori yang dipertahankan. Profil pendaftar dapat dihubungkan saat check-in sehingga favorit dan percakapan tetap memakai identitas yang sama.
- Keuangan: tagihan individual/massal, catatan, edit/pembatalan sebelum ada transaksi, jadwal bulanan lokal, simulasi periode berikutnya, reminder, serta status Belum lunas/Lunas/Terlambat/Dibatalkan.
- **Checkout sewa**: VA, QRIS, E-Wallet, transfer bank; rincian sewa + admin Rp2.000; konfirmasi; skenario berhasil/gagal; pencegahan pembayaran ganda; hasil transaksi; bukti print-friendly dan simpan PDF melalui dialog cetak browser.
- Laporan keuangan: filter properti/tanggal yang juga diterapkan pada grafik, pendapatan sewa, outstanding, overdue, collection rate, transaksi, serta export CSV. Admin platform dipisahkan dari pendapatan pemilik.
- Notifikasi: H-3, hari H, keterlambatan, reminder manual, pesan dan perkembangan laporan, indikator unread, tandai dibaca, tandai semua, riwayat, serta deduplikasi berdasarkan tagihan/tahap.
- Keluhan: kategori/urgensi/foto, search/filter, tabel dan kanban pemilik, detail tiket, catatan, estimasi, timeline, Menunggu → Diproses → Menunggu Konfirmasi → Selesai, konfirmasi penghuni, serta reopen.
- **Analisis keluhan lokal**: kategori/prioritas berdasarkan kata kunci input, ringkasan, saran aman, pengelompokan kategori, dan arahan segera menghubungi pihak terkait bila terdeteksi keadaan darurat. Rekomendasi harus diterima/disimpan pengguna, bukan keputusan otomatis.
- Chat: konteks properti/peserta, pencarian, unread lokal, tanggal, pesan dua arah, quick reply, lampiran gambar, auto-scroll, dan tampilan percakapan mobile. Tidak ada indikator online/typing/read receipt palsu.
- Boost: Rp30.000/30 hari, preview, checkout gagal/berhasil, kampanye/mulai/berakhir/sisa hari, riwayat, serta analytics dari tampilan listing, detail, dan klik hubungi yang benar-benar dicatat lokal.
- Platform admin demo: akun, pemilik, listing, transaksi, keluhan, promosi, GMV, occupancy, serta admin fee/boost revenue yang dipisahkan.

**Sorting penting:** promosi didahulukan hanya pada Rekomendasi. Harga terendah/tertinggi mengikuti nominal secara global, sambil mempertahankan badge Promosi.

## Mulai presentasi

Klik **Mode Demo** di navbar atau identitas workspace. Pilih pemilik atau penghuni yang diinginkan. Tombol **Panduan Demo** berisi langkah yang dapat langsung membuka peran/halaman terkait.

| Akun contoh | Untuk mencoba |
| --- | --- |
| Sari Wulandari / `o1` | Pemilik Kos Senja, Ruang Teduh, dan portofolio terkait |
| Arif Rahman / `o2` | Memeriksa pembatasan portofolio pemilik kedua |
| Dewi Anggraini / `o3` | Portofolio pemilik ketiga |
| Andi Pratama / `t1` | Pembayaran, reminder H-3, keluhan, dan chat utama |
| Nadia Putri / `t2` | Contoh tagihan terlambat |
| Platform Admin | Monitoring GMV, pendapatan platform, pengguna, dan operasional |

Untuk demo pembayaran: Penghuni Andi → Tagihan Sewa → Bayar → pilih metode → konfirmasi → Simulasikan Gagal → Coba Lagi → Simulasikan Berhasil. Ganti ke Sari → Tagihan/Laporan untuk melihat hasil yang sama. Bukti tersedia pada tagihan Lunas.

Untuk demo keluhan: Andi → Buat Laporan → Analisis Keluhan → tentukan kategori/urgensi → kirim; Sari → Keluhan → detail tiket → catatan/estimasi/status Menunggu Konfirmasi; Andi → Konfirmasi Selesai atau buka kembali.

Untuk alur pendaftar: Daftar sebagai calon penghuni → favorit/chat → Sari → Tambah Penghuni → pilih profil pada **Hubungkan profil yang sudah terdaftar** → tentukan kamar/kontak contoh → simpan. Identitas tersebut kini tersedia sebagai Penghuni; favorit dan percakapannya tetap sama.

Panduan lebih rinci: [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md).

## State, migrasi, dan konsistensi

- Key aktif: **`ngekosaja.demo.v2`**.
- Data `ngekosaja.demo.v1` dimigrasikan secara aditif, dengan ID, edit properti, foto, pembayaran, percakapan, dan riwayat lama dipertahankan.
- Key versi 1 **tidak dihapus atau ditimpa**. Reset mengembalikan versi 2; cadangan versi 1 tetap ada.
- Properti lama tanpa pemilik diatribusikan ke Sari (`o1`) agar portofolio lama tidak terpecah. Data baru menyediakan portofolio pemilik lain. Instalasi baru membagi portofolio contoh sejak awal.
- State mempunyai owners, users, properties/rooms, tenants, agreements, invoices, transactions, complaints/history/notes, conversations/messages/readBy, notifications, favorites, recentSearches, recurring, campaigns, analytics, settings, dan activities.
- Setiap perubahan dikloning lalu ditulis ke LocalStorage sebelum mengganti state aktif. Gagal quota tidak meninggalkan separuh operasi; batch tagihan divalidasi penuh sebelum disimpan.
- Penghuni checkout tidak dihapus; invoice dan agreement lama tetap terhubung ke properti/pemilik pada saat dibuat.
- Kamar terisi tidak boleh dinonaktifkan; kamar dengan riwayat agreement tidak boleh dihapus saat kapasitas dikurangi.
- Arsip menyembunyikan listing dari publik tanpa menghapus data pengelolaan. Data dengan riwayat tidak dapat dihapus permanen lewat aksi hapus.
- Pengingat dan jadwal bulanan diperiksa saat aplikasi dibuka. Reminder juga diperiksa saat halaman dirender. Tidak ada scheduler yang berjalan di latar belakang ketika browser ditutup.

Detail relasi dan definisi metrik: [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

## Struktur

```text
index.html
css/
  style.css          # Tokens, typography, komponen publik, marketplace/detail
  components.css     # Dashboard, management, checkout, tiket, chat, akun
  responsive.css     # 320–1920px, motion, print
js/
  data.js            # Basis data awal versi 1 dan utilitas tanggal/ID
  schema.js          # Seed versi 2 dan migrasi aditif
  storage.js         # State, pembatasan bisnis, finance/rooms/identity/chat
  ui.js              # Ikon SVG, formatter, modal, toast
  shell.js           # Navbar, sidebar, tabel, notifikasi, panduan
  finance.js         # Metrik, grafik, laporan, CSV, admin
  accounts.js        # Login, register, pemulihan, settings, FAQ
  analysis.js        # Analisis berbasis aturan dan siklus tiket
  marketplace.js     # Homepage, pencarian, detail, wishlist, compare
  owner.js           # Workspace pemilik dan formulir pengelolaan
  tenant.js          # Dashboard penghuni, tagihan, tempat tinggal
  payments.js        # Checkout, konfirmasi, hasil, invoice dan bukti
  complaints.js      # Kanban/tabel, formulir, detail tiket
  chat.js            # Antarmuka percakapan dan lampiran
  app.js             # Router, events, rendering, inisialisasi
assets/
  images/            # Foto ilustrasi lokal
  fonts/             # Font lokal dan lisensi OFL
  icons/logo.svg
  CREDITS.md
docs/                # Panduan demo dan model data
tests/               # Regresi domain, browser, visual, dan laporan aktual
screenshots/         # Screenshot versi 2 aktual + contoh PDF simulasi
```

## Pemeriksaan

Website tidak memerlukan tooling berikut untuk digunakan. Pengujian pengembangan memakai Node, Python, dan Playwright/Chromium yang tersedia pada lingkungan pengerjaan.

```powershell
# Aturan bisnis tanpa dependensi npm
Get-Content -Raw tests/domain.cjs | node --input-type=commonjs

# Terminal terpisah, server QA lokal
python tests/serve.py

# Regresi UI lengkap dan screenshot/responsive
python tests/browser_check.py --url http://127.0.0.1:5500
python tests/visual_check.py --url http://127.0.0.1:5500

# Identitas pendaftar -> check-in, grafik tanggal, HTTP dan file://
python tests/upgrade_check.py
```

Hasil aktual: [tests/VERIFICATION.md](tests/VERIFICATION.md). Output mesin berada pada `tests/browser-results.json`, `tests/visual-results.json`, dan `tests/upgrade-results.json`. Screenshot versi 2 berada di `screenshots/`; gambar lama di `tests/*.png` merupakan dokumentasi versi 1.

## Batas simulasi

- Seluruh akun, properti, identitas, harga, foto, jarak area, dan transaksi adalah data ilustrasi.
- Autentikasi dan pemisahan peran hanya simulasi frontend; LocalStorage dapat diperiksa/diubah dari browser dan bukan sistem keamanan produksi.
- Pembayaran sewa/boost tidak menghubungi bank, QRIS, e-wallet, atau memindahkan uang. Tidak meminta rekening, PIN, OTP, atau kartu.
- Analisis keluhan hanya membaca kata kunci teks, bukan foto, model AI, diagnosis teknis, atau pengganti penanganan darurat.
- Chat/notification tersimpan lokal, tidak realtime lintas perangkat, tanpa WhatsApp/email/SMS/push eksternal.
- Lampiran/properti menerima JPG/PNG/WebP maksimal 1 MB. Quota LocalStorage bergantung browser. Gunakan foto kecil untuk presentasi panjang.
- Simpan PDF menggunakan dialog Cetak browser. Tautan berbagi hanya berguna jika penerima mempunyai alamat project/server yang sama.
- Tampilan terang tersedia menyeluruh. Dark mode tidak ditambahkan agar kualitas tema utama tetap konsisten.
- Tidak ada booking otomatis, backend, analytics eksternal, atau scheduler server.
