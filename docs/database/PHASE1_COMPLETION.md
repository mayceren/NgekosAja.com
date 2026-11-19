# Penutupan Phase 1 — 19 November 2026

**Phase 1 Database Foundation selesai dan siap dilanjutkan ke Phase 2.** Dua temuan final verification telah diperbaiki di Supabase Cloud setelah pengguna meminta penerapannya. Hasil ini mencakup fondasi SQL, migrasi, integritas, RLS dan dokumentasi; pengujian Auth/JWT/HTTP nyata tetap menjadi pemeriksaan awal integrasi Phase 2.

Project live: **ngekosaja-development** (`wfmhsbdfdcugxblqsaob`), ACTIVE_HEALTHY, ap-northeast-1, PostgreSQL **17.12**, CLI **3.2.0**. Apply selesai **19 November 2026 08:48:40 WIB** (`2026-11-19T01:48:40.607Z`); verifikasi read-only independen selesai **08:49:22 WIB** (`2026-11-19T01:49:22.199Z`). Label environment `production` dari CLI adalah main branch project development ini.

## Perbaikan yang benar-benar diterapkan

Migrasi **20261119000100_final_verification_fixes.sql** diterapkan satu kali. Target live, hash seluruh file, schema awal dan fresh dry-run cocok dengan review sebelum apply. Tidak ada reset, DROP/TRUNCATE/DELETE, koreksi otomatis record, seed ulang, provisioning Auth, config push, perubahan Vault atau perubahan frontend.

| Temuan | Hasil setelah perbaikan |
| --- | --- |
| F1: checkout dengan tanggal NULL menutup agreement dan menghentikan recurring | CHECK **agreement_closed_on_required** ada dan **validated** di Cloud. RPC menolak tanggal/alasan NULL (`22004`), serta tanggal/alasan invalid (`22023`). Signature, konfigurasi, ACL dan fingerprint body cocok dengan kandidat yang diuji. |
| F2: service_role gagal membaca status invoice karena helper tanggal | EXECUTE **private.today()** untuk service_role terverifikasi **true**, authenticated tetap true, anon tetap false. View tetap security_invoker=true; izin tabel dan policy tidak diperluas. |

Jumlah record bisnis dan fasilitas sebelum/sesudah apply sama. Uji upgrade lokal membuktikan isi seluruh baris tidak berubah, dan data historis invalid menyebabkan seluruh DDL rollback tanpa mengarang tanggal checkout.

## Verifikasi Cloud aktual

| Pemeriksaan | Hasil |
| --- | --- |
| Migration history | **12 versi**, nama/urutan cocok; 11 file lama dan migrasi perbaikan tetap sesuai hash review |
| Dry-run terakhir | **upToDate=true**, migrations/seeds/roles kosong |
| Tabel dan kolom | **31 tabel, 236 kolom**, tipe/default/nullability sesuai replay lokal |
| Keys dan constraints | **31 PK UUID, 48 FK, 20 UNIQUE, 79 CHECK, 3 EXCLUDE**; total **183**, seluruhnya validated |
| Index | **86**, seluruh definisi cocok, tidak ada invalid/not-ready |
| RLS dan policies | **31/31 tabel aktif**, **45 policy**; command, role, USING dan WITH CHECK cocok |
| Functions | **24 public + 34 private**; signature, hasil, bahasa, volatility, search_path, fingerprint body dan izin EXECUTE cocok |
| Triggers dan view | **65 trigger enabled**, satu view invoice_statuses invoker; semua definisi cocok |
| Grants | **672 kombinasi** privilege relasi cocok; tidak ada TRUNCATE/TRIGGER/REFERENCES/MAINTAIN untuk role API |
| Privilege fungsi | Tidak ada PUBLIC EXECUTE, definer search_path tidak aman, atau izin browser untuk mencatat payment/boost dan memberi role |
| Role dan schema | anon/authenticated tidak superuser/BYPASSRLS; service_role BYPASSRLS hanya untuk server; role API tidak bisa CREATE schema public/private; anon tanpa USAGE private |
| Foreign-key orphans | **0** pada seluruh **48** FK, termasuk relasi ke auth.users dan FK komposit |
| Integritas agregat | **0** penempatan aktif ganda, pembayaran sukses ganda, closed tanpa tanggal, mismatch invoice/payment, recurring aktif pada agreement tertutup |
| Seed | **7 fasilitas** tetap ada, tidak dimuat ulang |
| Data bisnis | Auth/profil/properti/kamar/penghuni/agreement/invoice/transaksi tetap **0**; fixture penuh hanya lokal |

Observer Cloud adalah supabase_read_only_user dengan BYPASSRLS=true. Pemeriksaan Cloud membuktikan katalog/grants/keadaan data, sedangkan pembatasan identitas diuji sebagai role SQL aplikasi dengan fixture lokal. Nol pelanggaran pada Cloud kosong tidak dipakai sebagai pengganti tes perilaku.

## Hasil pengujian dan dokumentasi

- **52/52 kelompok** SQL contract tests pada fresh install 12 migrasi, ditambah postflight.
- **54/54 kelompok** pada upgrade baseline berisi fixture, termasuk rollback data invalid dan kesamaan digest seluruh baris, ditambah postflight.
- **3/3 tes** keamanan tooling: loopback/URL override, penolakan koneksi remote untuk fixture, redaksi URI/JWT/format secret Supabase.
- **16/16 file** tooling/tests lulus node --check.
- Isolasi pemilik/penghuni, signup metadata tidak berwenang, private child records/chat, laporan keuangan, idempotency, percobaan gagal dan snapshot immutable lulus.
- Dua koneksi independen membayar invoice bersamaan menghasilkan **tepat satu sukses**; dua check-in ke kamar sama menghasilkan **tepat satu penghuni aktif**.
- Financial reporting melalui invoice_statuses dan RPC owner_financial_report/owner_monthly_revenue/platform_financial_report diuji terhadap ledger: GMV, fee Rp2.000, boost Rp30.000, tanggal Jakarta dan scope pemilik/platform benar.

Fixture lokal memakai 36 profil, 3 pemilik, 16 properti, 101 kamar, 31 penghuni/agreement, 172 invoice, 162 transaksi dan data keluhan/chat terkait. Replay seed dan fixture tidak menggandakan record. Tidak ada fixture atau akun tambahan yang dibuat di Cloud.

[ERD](ERD.md), [Data Dictionary](DATA_DICTIONARY.md), [RLS](RLS_POLICIES.md) dan schema-catalogue.json telah dihasilkan ulang dari replay **12 migrasi** pada database sementara lokal. Audit mencocokkan 31 tabel/236 kolom, 48 relasi beserta kardinalitas, 183 nama constraint dan 86 definisi index terhadap katalog Cloud terkini.

Audit credential mencakup file tracked/non-ignored saat ini; tidak ada pola credential aktual yang ditemukan atau dicetak. .env.example kosong dan seluruh probe .gitignore lulus. Ini tidak mengklaim pemindaian seluruh riwayat Git atau secret store eksternal. Diff index.html/js/css/assets tetap kosong. Seluruh database sementara dihapus dan server PostgreSQL lokal dihentikan setelah pekerjaan selesai.

## Batas yang diteruskan ke Phase 2

Tes perilaku berjalan pada PostgreSQL native **16.3** dengan adapter auth.users/auth.uid/auth.role; Cloud **17.12** cocok pada seluruh bagian katalog yang dibandingkan. Docker/Podman tidak tersedia, sehingga GoTrue, JWT asli, PostgREST/GraphQL HTTP dan Auth Admin belum diuji. Tidak ada klaim autentikasi end-to-end atau payment gateway nyata. Frontend/UI tidak diintegrasikan pada pekerjaan ini.

Konfigurasi hosted yang lebih ketat dipertahankan: konfirmasi email, OTP 8 digit dan TOTP. **13 config differences** lokal/Cloud bukan migrasi pending; private tidak diekspos. Site URL/redirect Auth perlu ditinjau saat integrasi Phase 2, tanpa config push otomatis.

Dua FK tanpa index penuh pada prefix kolomnya, complaint_histories_actor_id_fkey dan user_roles_granted_by_fkey, adalah tindak lanjut performa saat data membesar. FK tetap valid. Risiko urutan lock checkout/generator recurring dari review statis belum diuji deadlock khusus; backend perlu retry terbatas untuk 40P01/40001. Keduanya tidak membatalkan integritas atau menjadi blocker fondasi development.

## Bukti mesin dan reproduksi

- [Apply perbaikan, persetujuan, hash, dry-run dan pre/post checks](remote-fixes-apply-results.json).
- [Verifikasi Cloud independen 12 migrasi](phase1-completion-verification.json).
- [Audit dokumen, credential dan frontend](phase1-completion-artifact-audit.json).
- [Fresh install](../../tests/database-candidate-final-results.json), [populated upgrade](../../tests/database-upgrade-final-results.json), [tooling/syntax/cleanup](../../tests/database-final-tooling-results.json).
- [Review sebelum perbaikan](FINAL_VERIFICATION_BASELINE.md), [baseline Cloud 11 migrasi](final-remote-verification.json), serta laporan apply awal dipertahankan sebagai histori.

Perintah apply di bawah **sudah dijalankan**, tidak perlu diulang:

```powershell
npx supabase db push --remote=wfmhsbdfdcugxblqsaob --skip-vault --output-format json --yes
```

Verifikasi ulang tanpa mengubah Cloud:

```powershell
node scripts/final-verify-remote.mjs --completed
node scripts/final-artifact-audit.mjs --completed
```

Pengujian ulang ketika cluster lokal loopback sudah aktif sesuai SETUP_GUIDE.md:

```powershell
npm run db:test -- --native --postflight --output=tests/database-candidate-final-results.json --catalogue-output=tests/database-candidate-catalogue.json
node scripts/database-test.mjs --native --through=20261118001100 --upgrade-check --extended --postflight --output=tests/database-upgrade-final-results.json
npm run test:database-tooling
node scripts/refresh-phase1-docs.mjs
```

Script apply-final-fixes.mjs menolak apply ulang jika laporan eksekusi sudah ada. Semua perubahan schema berikutnya memerlukan migrasi baru dan review sesuai lingkupnya. Tidak ada remote reset atau penghapusan data yang diizinkan oleh penutupan Phase 1 ini.
