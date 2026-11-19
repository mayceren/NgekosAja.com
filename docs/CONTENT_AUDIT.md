# Branding dan audit konten

Penyelarasan 19 November 2026 memosisikan NgekosAja.com sebagai platform PropTech untuk pencarian kos, pembayaran sewa dan pengelolaan properti. Desain, layout, fitur, autentikasi, PostgreSQL dan RLS dipertahankan. Tidak ada perubahan konfigurasi remote, pembuatan akun, reset database, deployment atau git push.

## Cakupan perubahan

| Area | Hasil |
| --- | --- |
| Identitas produk | Deskripsi bisnis yang konsisten di metadata, halaman Tentang dan README; nama publik NgekosAja.com |
| Halaman publik | Footer dan panduan berfokus pada Demo Produk; homepage, FAQ dan CTA memakai bahasa sesuai kemampuan saat ini |
| Akun | Petunjuk signup mengakomodasi session langsung dan verifikasi jika diminta; kuota recovery tetap dijelaskan |
| Status integrasi | Halaman akun/detail menjelaskan fitur yang masih dikembangkan tanpa label tahapan internal |
| Privasi/ketentuan | Perbedaan data Supabase dan data demo, tanggung jawab akun, reset lokal dan pembayaran simulasi dijelaskan |
| Transaksi | Label simulasi pada checkout, hasil transaksi, boost dan bukti cetak tetap terlihat |
| Development | Nama akun, email fixture, metadata, script dan perintah memakai konteks development; plan baru belum diterapkan |
| Dokumentasi | README mencakup produk, fitur, stack, arsitektur, instalasi, Auth, keamanan, roadmap, testing, deployment dan batas implementasi |

Bahasa demo menggunakan istilah Demo Produk, Demo Environment, data ilustrasi dan akun development sesuai konteks. Istilah lokasi kampus atau aktivitas penghuni bukan narasi penugasan dan tidak otomatis dihapus. Angka demo tidak dijadikan klaim pengguna, transaksi, pendapatan atau performa bisnis nyata.

Tidak ditemukan template email custom di repository. Template hosted Supabase tidak diubah; pengiriman email dan penerimaan inbox tidak diuji ulang. Tidak ada SMTP tambahan atau layanan berbayar yang ditambahkan.

## Bukti historis dan kompatibilitas

[Arsip](archive/README.md) mempertahankan salinan README dan plan sebelum cleanup. Bukti JSON, screenshot, migration history dan hasil pemeriksaan terdahulu tetap berada pada lokasi aslinya tanpa penulisan ulang. Tautan ke nama file historis dipertahankan; nama tersebut bukan label produk aktif.

Penamaan tooling development berubah menjadi:

```powershell
npm run auth:provision-development
npm run db:test -- --native --postflight --development-accounts --output=tests/branding-database-results.json
```

Perintah plan default hanya membaca remote. Fingerprint plan lama tidak berlaku untuk manifest baru. Pembuatan enam akun dan relasinya tetap memerlukan persetujuan terpisah; tidak dilakukan pada cleanup ini. UUID/resource pada plan baru tidak mengubah data existing.

## Hasil pengujian aktual

| Pemeriksaan | Hasil | Bukti |
| --- | --- | --- |
| Konten browser, publik dan semua peran demo | **110 pemeriksaan rute/viewport**, 0 temuan konteks penugasan, 0 error JavaScript, tanpa mutasi Cloud | [content-browser-results.json](../tests/branding/content-browser-results.json) |
| Authentication | **51 kelompok lulus**, SDK resmi dengan API mock | [auth-browser-results.json](../tests/branding/auth-browser-results.json) |
| Alur bisnis Demo Produk | **11 kelompok lulus**, 0 error JavaScript/resource | [browser-results.json](../tests/branding/browser-results.json) |
| SQL/RLS lokal dan fixture development | **60 kelompok lulus**, postflight lulus; database acak dibersihkan | [branding-database-results.json](../tests/branding-database-results.json) |
| Unit tooling, terminal privat dan provisioning | **27 test lulus**, tanpa network | tests/development-provision.test.mjs, tests/auth-repair.test.mjs, tests/database-tooling.test.mjs |
| Domain bisnis demo | **30 skenario lulus** | tests/domain.cjs; output terminal |
| Audit file, link dan integritas | Hasil mesin mencatat temuan, jumlah file, hash arsip/bukti/migrasi, syntax dan credential scan | [content-audit-results.json](content-audit-results.json) |

Browser konten memeriksa desktop 1440 px dan ponsel 390 px, termasuk halaman informasi, Auth, seluruh dashboard demo, checkout, keluhan dan bukti transaksi. Regresi Auth juga memeriksa 768 px. Screenshot baru terpisah dari bukti lama di tests/branding/.

Tes browser menggunakan respons Supabase yang dicegat. Tes SQL memakai adapter Auth pada PostgreSQL native lokal, bukan GoTrue/JWT/PostgREST Cloud. Pemeriksaan remote pada pekerjaan ini hanya menghasilkan plan read-only. Hasil tersebut tidak menjadi klaim kesiapan production atau pengujian registrasi Cloud/inbox terbaru.

## Menjalankan pemeriksaan ulang

```powershell
npm run test:content
```

Audit mencari konteks penugasan secara case-insensitive pada file teks aktif, memeriksa link dokumentasi, syntax JavaScript dan pola credential. Definisi aturan di script/test audit dipisahkan dari copy produk. Arsip, vendor dan bukti historis memiliki pengecualian yang eksplisit. Penyebutan yang tersisa hanya pada arsip, nama bukti lama, dan definisi pola pemeriksaan; tidak pada halaman pengguna atau narasi dokumentasi aktif.

Integritas file yang dilindungi dibandingkan terhadap index Git saat cleanup dimulai; index tersebut berisi perubahan sesi sebelumnya yang sudah disimpan pengguna. Teks dinormalisasi dari CRLF ke LF saat membandingkan dengan Git; file biner dibandingkan byte per byte. File bukti sendiri tidak dinormalisasi atau ditulis ulang. Pemeriksaan ini tidak melakukan commit atau mengubah Git history. Secret scan berbasis pola bukan jaminan seluruh Git history atau secret store eksternal bebas credential.

Untuk menyimpan hasil browser tanpa menimpa bukti lama:

```powershell
$env:NGEKOSAJA_TEST_OUTPUT='tests/branding'
$env:NGEKOSAJA_TEST_ORIGIN='http://127.0.0.1:5501'
python tests/auth_browser.py
python tests/browser_check.py --url http://127.0.0.1:5501
python tests/branding_browser.py
```

Server QA harus sudah aktif pada origin yang dipilih. Hentikan hanya proses QA yang dimiliki sendiri setelah pengujian; jangan menghentikan server pengguna.
