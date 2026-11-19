# Final verification Phase 1 — 19 November 2026

**Status terbaru: kedua temuan sudah diperbaiki di Cloud dan Phase 1 Database Foundation selesai.** Lihat [laporan penutupan](PHASE1_COMPLETION.md). Bagian di bawah adalah catatan historis sebelum penerapan migrasi 12; snapshot aslinya dipertahankan di [FINAL_VERIFICATION_BASELINE.md](FINAL_VERIFICATION_BASELINE.md).

## Hasil sebelum perbaikan (historis)

**Keputusan: belum siap dinyatakan selesai untuk melanjutkan integrasi Phase 2.** Dua masalah terbukti pada baseline yang sudah deployed. Perbaikan tersedia dan lulus pengujian lokal, tetapi migrasi tambahan **belum diterapkan ke Cloud dan memerlukan persetujuan baru**. Frontend/UI tidak diubah.

Target live terkonfirmasi: **ngekosaja-development**, ref `wfmhsbdfdcugxblqsaob`, ACTIVE_HEALTHY, ap-northeast-1, PostgreSQL **17.12**, CLI **3.2.0**. Pemeriksaan Cloud selesai **19 November 2026 00:26:25 WIB** (`2026-11-18T17:26:25.030Z`). Label environment `production` dari CLI menunjuk main branch project development ini.

Bukti aktual: [remote final](final-remote-verification.json), [audit artefak](final-artifact-audit.json), [baseline tests](../../tests/database-baseline-final-results.json), [candidate tests](../../tests/database-candidate-final-results.json), [upgrade tests](../../tests/database-upgrade-final-results.json). Laporan penerapan 18 November dan manifest persetujuan lama dipertahankan tanpa ditimpa.

## Hasil Cloud yang benar-benar diperiksa

Seluruh query Cloud memakai `db query --read-only`; hanya metadata, fingerprint fungsi dan jumlah baris yang disimpan. Tidak ada reset, DDL/DML remote, seed ulang, provisioning Auth, config push, atau pemanggilan RPC pembayaran. Semua operasi yang mengubah data untuk tes berlangsung pada database acak lokal yang kemudian dihapus.

| Area | Hasil aktual |
| --- | --- |
| Migration history | **11 versi**, urutan cocok dengan manifest approved; SHA-256 seluruh file applied tetap sama |
| Tabel dan kolom | **31 tabel, 236 kolom**; tipe, nullability dan default cocok dengan baseline hasil replay lokal |
| Primary key | **31**, semuanya UUID |
| Foreign key | **48**, seluruhnya validated; pemeriksaan orphan pada setiap FK menghasilkan **0** |
| Constraint lain | **20 UNIQUE, 78 CHECK, 3 EXCLUDE**; total bersama PK/FK **182**; 0 unvalidated |
| Index | **86**; seluruh definisi cocok; 0 invalid/not-ready |
| RLS | Aktif pada **31/31 tabel**, **45 policy**; nama, command, role, USING dan WITH CHECK cocok |
| Functions | **24 public + 34 private**; signature, hasil, bahasa, volatility, konfigurasi, fingerprint body dan hak EXECUTE cocok |
| SECURITY DEFINER | **53**; tidak ada search_path yang tidak aman; tidak ada EXECUTE untuk PUBLIC pada fungsi aplikasi |
| Triggers | **65**, termasuk trigger aplikasi pada auth.users; seluruh definisi cocok dan enabled |
| View | **invoice_statuses**, security_invoker=true; definisi cocok; ada masalah izin service_role yang dijelaskan di bawah |
| Grants API | **672 kombinasi** hak relasi dibandingkan dan cocok; tidak ada TRUNCATE/TRIGGER/REFERENCES/MAINTAIN untuk role API |
| Role API | anon/authenticated bukan superuser dan tidak BYPASSRLS; service_role BYPASSRLS sebagai batas kepercayaan server |
| Schema access | Role API tidak bisa CREATE pada public/private; anon tidak mendapat USAGE private |
| Seed Cloud | **7 fasilitas**: ac, furniture, laundry, parking, private_bathroom, shared_kitchen, wifi |
| Data bisnis Cloud | Auth/profil/properti/kamar/penghuni/agreement/invoice/transaksi masing-masing **0** |
| Pemeriksaan integritas agregat | 0 penempatan aktif ganda, 0 pembayaran sukses ganda, 0 closed tanpa tanggal, 0 mismatch invoice/payment, 0 recurring aktif untuk agreement tertutup |
| Konfigurasi | **13 perbedaan** lokal/hosted masih ada; private tidak termasuk exposed API schemas; konfigurasi hosted tidak ditimpa |

Cloud belum berisi data bisnis: hasil orphan dan agregat nol membuktikan keadaan saat inspeksi, bukan pengganti pengujian perilaku dengan fixture. Observer Cloud adalah `supabase_read_only_user` dengan **BYPASSRLS=true**; pembatasan identitas diuji secara terpisah sebagai role aplikasi pada PostgreSQL lokal.

## Temuan yang memerlukan perbaikan

### F1 — Checkout tanpa tanggal dapat tersimpan

**Prioritas tinggi, integritas operasional.** CHECK baseline pada rental_agreements membolehkan hasil NULL. Pemilik sah dapat memanggil `owner_close_agreement(agreement_id, NULL)`: agreement berubah menjadi checked_out dengan closed_on NULL, recurring berhenti, sementara interval historis masih memakai end_date. Ini dapat menyebabkan perbedaan antara ketersediaan aktif dan periode kamar yang masih terblokir. Tidak ditemukan record seperti ini di Cloud saat pemeriksaan.

Reproduksi SQL lokal membuktikan RPC dan trusted direct UPDATE menerima keadaan invalid tersebut. Ini bukan bypass kepemilikan: tenant tetap ditolak dan pengujian isolasi pemilik tetap lulus. Alasan NULL dan tanggal invalid sebelumnya ditolak oleh lapisan lain; kandidat menambahkan validasi eksplisit serta SQLSTATE yang konsisten untuk kontrak Phase 2.

Perbaikan: CHECK baru **agreement_closed_on_required** mewajibkan tanggal pada status tertutup; RPC menolak tanggal/alasan NULL dengan `22004` dan tanggal/alasan invalid dengan `22023`. Tanggal tetap berada pada rentang agreement dan tidak melewati hari ini. Perubahan gagal secara atomik jika ada data historis invalid; tidak mengarang atau menimpa tanggal lama. PostgreSQL menjelaskan bahwa [CHECK yang bernilai NULL dianggap memenuhi constraint](https://www.postgresql.org/docs/17/sql-createtable.html).

### F2 — service_role tidak dapat membaca status tagihan melalui view

**Prioritas sedang, kegagalan akses proses server.** SELECT effective_status untuk invoice pending melalui invoice_statuses gagal dengan `42501: permission denied for function today`. View security_invoker memakai hak pemanggil, sedangkan private.today() baseline hanya diberikan kepada authenticated.

Perbaikan: berikan **EXECUTE private.today() hanya kepada service_role**. Tidak membuka schema private ke Data API, tidak menambah hak browser, dan tidak memberi anon akses helper. Kebutuhan EXECUTE fungsi pada view dijelaskan dalam [dokumentasi CREATE VIEW PostgreSQL](https://www.postgresql.org/docs/current/sql-createview.html).

## Migrasi kandidat dan dampaknya

Satu file baru: [20261119000100_final_verification_fixes.sql](../../supabase/migrations/20261119000100_final_verification_fixes.sql).

Isinya ADD CHECK NOT VALID lalu VALIDATE, CREATE OR REPLACE RPC checkout dengan signature tetap, dan GRANT helper tanggal yang sempit. ACL RPC lama dipertahankan. Tidak ada DROP/TRUNCATE/DELETE, perubahan tipe kolom, perubahan policy, atau perubahan isi record. DDL membutuhkan lock tabel singkat; VALIDATE dapat menolak data lama yang tidak konsisten. Pengujian upgrade membuktikan rollback seluruh DDL dan pelestarian semua isi baris.

Dry-run aktual:

```powershell
npx supabase db push --remote=wfmhsbdfdcugxblqsaob --dry-run --skip-vault --output-format json
```

Hasil: `dryRun=true`, `upToDate=false`, migrations hanya **20261119000100_final_verification_fixes.sql**, seeds/roles kosong. **Ini belum apply.** Persetujuan lama untuk 11 migrasi tidak dipakai sebagai persetujuan kandidat baru.

## Pengujian lokal aktual

PostgreSQL native **16.3**, loopback 127.0.0.1:55432, adapter auth.users/auth.uid/auth.role. Runner selalu membuat database ber-UUID dan menghapus database sementara itu sesudah tes; database input dan Cloud tidak di-reset.

| Jalur | Hasil |
| --- | --- |
| Baseline 11 applied migrations | **43/43 kelompok lama lulus**; dengan 9 kelompok tambahan: **46 lulus, 6 gagal** |
| Fresh install kandidat 12 migrations | **52 lulus, 0 gagal** + postflight lulus |
| Upgrade baseline berisi fixture ke kandidat | **54 lulus, 0 gagal** + postflight lulus |
| Tooling security | **3/3 tes lulus**, termasuk loopback guard, penolakan target cloud dan redaksi URI/JWT/sbp_/sb_secret_ |
| Sintaks tooling dan tests | **14/14 file** lulus node --check; bukti di [database-final-tooling-results.json](../../tests/database-final-tooling-results.json) |

Enam kegagalan baseline adalah assertion atas dua temuan dan penyeragaman kontrak error checkout, bukan enam celah keamanan terpisah. Hasil baseline yang gagal disimpan agar temuan dapat direproduksi. Jalur kandidat membuktikan check-in/out/pindah valid tetap bekerja, sewa gagal tidak tertutup, recurring tidak berhenti pada checkout invalid, dan anon tetap tidak mendapat helper tanggal.

Fixture sebelum mutasi skenario: **36 profil, 3 pemilik, 16 properti, 101 kamar, 31 penghuni/agreement, 172 invoice, 162 transaksi, 4 keluhan, 2 percakapan, 4 pesan, 342 notifikasi, 2 favorit, 2 kampanye, 7 fasilitas**. Replay seed master dan fixture tidak menggandakan record. FK dan trigger dijalankan oleh PostgreSQL, bukan mock JavaScript.

Pengujian isolasi menggunakan SET LOCAL ROLE anon/authenticated/service_role serta claim UUID berbeda. Pemilik tidak bisa membaca/mengubah properti lain, mengambil alih owner_id, atau menagih agreement pemilik lain. Penghuni tidak dapat mengakses profil, kamar, invoice, keluhan, lampiran, chat, notifikasi dan pengaturan penghuni lain. Metadata signup role=admin diabaikan; browser termasuk admin aplikasi tidak bisa mencatat pembayaran atau memberi role.

Pencegahan pembayaran ganda diuji dengan retry idempotency, payload konflik, percobaan gagal, serta **dua koneksi independen membayar invoice bersamaan: tepat satu sukses**. Penempatan memakai UNIQUE aktif + exclusion interval + lock kamar; **dua koneksi check-in ke kamar yang sama: tepat satu sukses**. Riwayat dan snapshot keuangan tidak dapat ditulis ulang.

Financial reporting berupa satu view status invoice serta RPC owner_financial_report, owner_monthly_revenue dan platform_financial_report. Tes membandingkan output dengan agregasi ledger: sewa masuk ke GMV/pendapatan pemilik, admin Rp2.000 dan boost Rp30.000 terpisah, pembayaran gagal/grant gratis tidak menambah pendapatan, tanggal Jakarta inklusif, dan scope role/properti dipatuhi.

## ERD, dictionary, index dan credential

[ERD](ERD.md) cocok untuk **31 tabel aplikasi + auth_users**, seluruh **48 relasi beserta kardinalitasnya**. [Data Dictionary](DATA_DICTIONARY.md) mencakup seluruh 236 kolom, 182 nama constraint dan 86 definisi index baseline deployed. Dokumen dan schema-catalogue sengaja tetap merepresentasikan Cloud 11 migrasi; CHECK tambahan masih diberi status kandidat terpisah sampai approved/applied.

Dua FK belum mempunyai index penuh dengan kolom FK sebagai prefix: **complaint_histories_actor_id_fkey** dan **user_roles_granted_by_fkey**. FK tetap tervalidasi dan menjaga integritas. Ini tindak lanjut performa untuk pencarian/penghapusan profil dalam dataset besar, bukan blocker data kosong development; belum ada benchmark yang membenarkan index tambahan.

Risiko urutan lock checkout versus generator recurring yang dicatat pada review sebelumnya tetap merupakan temuan analisis, belum uji deadlock khusus. Integrasi backend Phase 2 perlu retry terbatas untuk `40P01`/`40001`; transaksi rollback tetap menjaga integritas. Pengujian double payment dan double occupancy di atas tidak diklaim sebagai pengujian seluruh kemungkinan deadlock.

Audit file tracked/non-ignored tidak menemukan pola credential aktual; nilai tidak dicetak. .env.example tetap kosong. Sebelas probe .gitignore lulus, termasuk .env lokal/production, cache Supabase, node_modules, cluster test, PEM/key dan credentials*.json. Error sanitizer diperluas untuk format secret Supabase. Audit ini tidak memindai seluruh riwayat Git yang terhapus atau secret store eksternal.

Konfigurasi Cloud mempertahankan konfirmasi email, OTP 8 digit dan TOTP yang lebih ketat daripada demo lokal. Perbedaan site URL/redirect perlu disesuaikan saat integrasi Auth Phase 2 melalui review terpisah. Tidak ada credential yang dimasukkan ke frontend dan diff index.html/js/css/assets kosong.

## Batas bukti dan keputusan kelanjutan

Docker/Podman tidak tersedia, sehingga GoTrue signup/login, JWT asli, PostgREST/GraphQL HTTP, provisioning Auth Admin, dan seluruh stack Supabase PostgreSQL 17 lokal belum diuji. Kesesuaian katalog PostgreSQL 17 Cloud terbukti; tes perilaku SQL berjalan pada PostgreSQL 16 dengan adapter Auth. Ini bukan klaim end-to-end autentikasi Cloud. Frontend/browser suite tidak dijalankan ulang karena tugas ini melarang perubahan frontend.

Sebelum Phase 1 ditutup: **setujui lalu terapkan kandidat, ulangi verifikasi Cloud dan cocokkan CHECK/RPC/grant yang baru**. Jangan melakukan reset atau menghapus record existing. Setelah itu fondasi SQL dapat diteruskan ke Phase 2, dengan pengujian Auth/JWT/HTTP sebagai pemeriksaan awal integrasi. Saat laporan ini dibuat, Cloud tetap pada 11 migrasi dan dua temuan belum diperbaiki di Cloud.

## Reproduksi aman

Dengan cluster lokal aktif sesuai SETUP_GUIDE.md:

```powershell
# Baseline ini memang diharapkan gagal pada regression cases baru:
node scripts/database-test.mjs --native --through=20261118001100 --extended --postflight --output=tests/database-baseline-final-results.json --catalogue-output=tests/database-baseline-catalogue.json
# Fresh candidate:
npm run db:test -- --native --postflight --output=tests/database-candidate-final-results.json --catalogue-output=tests/database-candidate-catalogue.json
# Populated upgrade dan rollback data invalid:
node scripts/database-test.mjs --native --through=20261118001100 --upgrade-check --extended --postflight --output=tests/database-upgrade-final-results.json
npm run test:database-tooling
# Target terverifikasi live, hanya SELECT dan dry-run, tanpa apply:
node scripts/final-verify-remote.mjs
node scripts/final-artifact-audit.mjs
```

SQL inspeksi berada di supabase/review/final-catalogue.sql dan final-orphans.sql. Catatan waktu dan hash kandidat ada di final-remote-verification.json. Server PostgreSQL lokal dihentikan setelah pemeriksaan; database sementara pengujian telah dihapus.
