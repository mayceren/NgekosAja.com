# Hasil pemeriksaan Authentication UAS

Pemeriksaan 19 November 2026 tidak membuat/mengubah akun Cloud, tidak mengirim email, tidak mengubah schema/RLS atau konfigurasi hosted, dan tidak mereset remote. UI existing dipertahankan. Konfigurasi ini khusus UAS/development, **belum siap production**.

## Hasil aktual perubahan ini

| Lapisan | Hasil | Bukti |
| --- | --- | --- |
| Chromium + SDK resmi, HTTP Auth/PostgREST mock | **51 kelompok lulus**, 0 error JavaScript | [auth-browser-results.json](../../tests/auth-browser-results.json) |
| Unit test provisioning UAS | **10 lulus**, Admin API mock, tidak ada network | [uas-provision.test.mjs](../../tests/uas-provision.test.mjs) |
| Unit pemulihan administratif lama + terminal tersembunyi | **14 lulus**, seluruhnya mock/offline | [auth-repair.test.mjs](../../tests/auth-repair.test.mjs) |
| Unit guard tooling database | **3 lulus**, menolak host remote | [database-tooling.test.mjs](../../tests/database-tooling.test.mjs) |
| PostgreSQL native 16.3 + adapter Auth, 12 migrasi | **60 kelompok lulus**, 0 gagal, postflight lulus, database sementara dibuang | [database-auth-uas-results.json](../../tests/database-auth-uas-results.json) |
| Domain demo | **30 skenario lulus** | [domain.cjs](../../tests/domain.cjs) |
| Guard QA Cloud | **3 lulus**, koneksi dicegat, 0 email/mutasi remote | [auth-cloud-safety-results.json](../../tests/auth-cloud-safety-results.json) |
| Cloud audit read-only | **Verified**, 12 migrasi cocok, 31 tabel RLS, 45 policy, 0 temuan pola credential | [security-audit-results.json](security-audit-results.json) |
| Plan provisioning Cloud read-only | Project/ref cocok, Confirm Email **false**, 1 akun existing, 0 target existing, 0 collision | [development-account-plan.json](development-account-plan.json) |
| Artefak lokal | **55 file syntax-check**, 51 link lokal valid, 3 guard approval lulus, lockfile cocok, path privat diabaikan Git, 0 database sementara tersisa | [uas-final-quality-results.json](uas-final-quality-results.json) |

## Cakupan browser

Signup dengan respons session aktif langsung menuju home sebagai prospect dan memberi toast berhasil, tanpa INSERT/upsert profil atau permintaan recover/resend tambahan. Session signup bertahan setelah reload dan identitas dimuat ulang lewat SDK getUser/profil/role database. Tujuan owner-request dan metadata admin tidak mengangkat hak akses.

Signup tanpa session tetap membuka verifikasi. Error duplicate email serta respons identitas kosong GoTrue ditangani tanpa auto-login, penggantian password atau takeover. Form forgot menjelaskan kuota; respons rate limit tidak membuka reset atau melewati validasi recovery.

Regresi login/logout, dialog logout dan pembatalannya, remember/sessionStorage vs localStorage, protected routes, profil, email/password settings, role owner/tenant/admin, pemisahan Demo, callback PKCE lintas tab dan reset terverifikasi lulus. Route reset palsu ditolak. Viewport 390/768/1440 px tidak overflow; navbar/menu akun tetap dapat dipakai. File privat ditolak dev server. Screenshot memakai identitas mock, bukan akun pribadi.

## Cakupan SQL dan provisioning

Seluruh 52 kontrak database sebelumnya dijalankan ulang, termasuk isolasi antar-pemilik/penghuni, role grant terlarang, constraint PK/FK, views keuangan, pencegahan pembayaran/penempatan ganda, dan tes konkurensi. Delapan pemeriksaan tambahan menggunakan SQL relasi yang sama dengan provisioning UAS: enam profil trigger, sebelas role dasar/tambahan, dua agreement aktif, dua properti draft, isolasi owner A/B dan tenant A/B, penolakan self-grant prospect, akses admin serta penolakan replay tanpa mengubah agreement.

Unit provisioning menguji pembuatan hanya akun baru, password tersembunyi tidak masuk receipt/SQL, inventaris berhalaman, penolakan akun existing sebelum prompt, mismatch/cancel sebelum penulisan, kegagalan Auth parsial, rollback relasi, respons identitas tidak cocok dan penolakan UUID/run tidak valid. Tidak ada delete/update akun existing pada mekanisme baru.

## Batas bukti

**Signup publik Cloud dengan Confirm Email OFF, login enam akun development nyata, dan isolasi enam JWT Cloud belum dijalankan.** Akun remote belum diprovisikan karena menunggu persetujuan. Script siap memeriksa login/profil/role/isolation sesudah pembuatan yang disetujui; hasilnya belum boleh diklaim lulus. [Panduan dan plan](DEVELOPMENT_ACCOUNTS.md).

Browser menggunakan SDK nyata dengan mock HTTP, bukan GoTrue Cloud. SQL native memakai adapter UUID/claim dan PostgreSQL 16.3, bukan GoTrue/JWT/PostgREST atau stack Cloud PostgreSQL 17.12. Audit Cloud hanya membaca katalog/count. Secret scan berbasis pola bukan jaminan seluruh Git history bebas secret.

Penerimaan inbox, email change dua inbox, produksi, MFA end-to-end dan integrasi bisnis Phase 3 belum diverifikasi oleh perubahan ini. Kuota recovery tetap berlaku. Tidak memakai SMTP tambahan.

Histori Cloud awal pada [auth-cloud-results.json](../../tests/auth-cloud-results.json) tidak dihitung sebagai pengujian perubahan UAS. QA lama keliru memakai alamat pribadi dan menyebabkan masalah handoff; jangan diulang. [Histori insiden](AUTH_RECOVERY_FIX.md) dipertahankan untuk audit, bukan instruksi mengubah akun existing sekarang.

## Reproduksi aman

Dengan server lokal aktif:

```powershell
python tests/auth_browser.py
npm run test:auth-provision
npm run test:auth-repair
npm run test:database-tooling
npm run test:frontend
python tests/auth_cloud_safety.py
node scripts/auth-audit.mjs
npm run auth:provision-uas
```

Dua perintah terakhir hanya membaca Cloud. Untuk port QA 5501, tetapkan NGEKOSAJA_TEST_ORIGIN=http://127.0.0.1:5501. Jangan menghentikan server pengguna di port 5500.

Jika cluster PostgreSQL test loopback sudah aktif pada port 55432:

```powershell
npm run db:test -- --native --postflight --uas-fixtures --output=tests/database-auth-uas-results.json
```

Tidak perlu menjalankan Cloud signup QA atau provisioning apply untuk mereproduksi tes lokal ini. Jangan memakai alamat pribadi untuk QA, melakukan remote reset atau menaruh password di repository.
