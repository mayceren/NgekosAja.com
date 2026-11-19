# Hasil penerapan database development

Laporan ini mencatat penerapan awal **11 migrasi** pada 18 November. Status terkini setelah migrasi perbaikan ke-12: **Phase 1 Database Foundation selesai**, lihat [PHASE1_COMPLETION.md](PHASE1_COMPLETION.md). Bukti dan lingkup persetujuan awal di bawah dipertahankan sebagai histori.

**Berhasil diterapkan dan diverifikasi pada 18 November 2026.** Pengguna menyetujui rencana melalui pesan **“aku setuju”** setelah review 11 migrasi dan seed master tujuh fasilitas. Tidak ada reset, DROP, penghapusan data existing, config push, pembaruan Vault, provisioning akun demo, atau git push.

Target: **ngekosaja-development**, project reference **wfmhsbdfdcugxblqsaob**, region ap-northeast-1. CLI **3.2.0**, PostgreSQL remote **17.12**. Cabang utama tetap dilabeli `production` oleh CLI; target tersebut telah tercakup dalam persetujuan pengguna.

Bukti mesin: [remote-apply-results.json](remote-apply-results.json). Manifest hash yang disetujui dan review sebelum apply dipertahankan di [remote-review-results.json](remote-review-results.json) serta [REMOTE_REVIEW.md](REMOTE_REVIEW.md).

## Eksekusi aktual

Sebelum menerapkan, identitas project diverifikasi ulang melalui daftar project live. Semua SHA-256 11 migrasi dan seed cocok dengan manifest review. Katalog masih kosong, akun Auth 0, dan fresh dry-run menghasilkan daftar yang sama dengan rencana persetujuan.

Perintah yang **sudah dijalankan**, bukan instruksi untuk mengulang:

```powershell
npx supabase db push --remote=wfmhsbdfdcugxblqsaob --include-seed --skip-vault --yes --output-format json
```

CLI selesai dengan exit code 0 dan `dryRun=false`. Sebelas versi berikut tercatat pada **supabase_migrations.schema_migrations** di remote:

| Versi | Nama | Hasil |
| --- | --- | --- |
| 20261118000100 | foundation_identity | Applied |
| 20261118000200 | properties_rooms | Applied |
| 20261118000300 | tenants_agreements | Applied |
| 20261118000400 | finance_promotions | Applied |
| 20261118000500 | complaints | Applied |
| 20261118000600 | messaging_personal_data | Applied |
| 20261118000700 | atomic_business_operations | Applied |
| 20261118000800 | complaint_chat_notifications | Applied |
| 20261118000900 | public_catalogue_reports | Applied |
| 20261118001000 | rls_and_audit | Applied |
| 20261118001100 | integrity_hardening | Applied |

Pemeriksaan postflight selesai pada **2026-11-18 16:47:15 UTC** (23:47:15 WIB). Timestamp tahap dan pemeriksaan struktur lanjutan ada di laporan JSON.

## Verifikasi remote aktual

Query postflight, histori dan struktur dijalankan dengan **--read-only**. Observer adalah `supabase_read_only_user` dengan **BYPASSRLS=true**: cocok untuk inspeksi katalog dan jumlah record, tetapi **bukan** simulasi hak pengguna aplikasi.

| Pemeriksaan | Hasil |
| --- | --- |
| Tabel aplikasi | **31**, nama sesuai schema review |
| Kolom | **236**, seluruh nama, tipe dan nullability cocok dengan katalog schema yang direview |
| Primary key | Seluruhnya UUID |
| Foreign key | **48** |
| Policy RLS | **45** |
| Tabel tanpa RLS aktif | **0** |
| Fungsi public | **24** |
| SECURITY DEFINER dengan search_path tidak aman | **0** |
| EXECUTE fungsi aplikasi untuk PUBLIC | **0** |
| View invoice_statuses | security_invoker=true |
| authenticated dapat server_grant_role | **false** |
| authenticated dapat server_record_rent_payment | **false** |
| authenticated dapat server_record_boost | **false** |
| Anonymous | SELECT hanya pada facilities; EXECUTE public_listings tersedia |
| TRUNCATE/TRIGGER/REFERENCES/MAINTAIN untuk role API pada relasi aplikasi | **Tidak ada** |
| Constraint belum tervalidasi | **0** |
| Index invalid | **0** |
| Histori migrasi | **11**, seluruh versi cocok dengan manifest |
| Dry-run terakhir tanpa seed ulang | **upToDate=true, migrations=[]** |

Pemeriksaan 43 kelompok SQL dan 3 tes tooling yang dilakukan lokal tetap terdokumentasi terpisah di [VERIFICATION.md](VERIFICATION.md). Verifikasi remote kali ini membuktikan penerapan SQL di PostgreSQL 17 dan konfigurasi katalog/grants/RLS; tidak mengklaim seluruh skenario tenant/owner dengan JWT nyata sudah diuji melalui HTTP.

## Seed yang berhasil dimuat

Seed yang dijalankan hanya **supabase/seed.sql**: **7 fasilitas** terverifikasi melalui pembacaan tabel remote:

| Code | Fasilitas |
| --- | --- |
| ac | AC |
| furniture | Furnitur |
| laundry | Laundry |
| parking | Parkir |
| private_bathroom | Kamar mandi dalam |
| shared_kitchen | Dapur bersama |
| wifi | WiFi |

Seed memakai ON CONFLICT(code) DO NOTHING. Setelah selesai, jumlah akun Auth, properti, dan transaksi remote masing-masing **0**. Tidak ada akun/password/admin demo yang dibuat atau fixture penuh yang diimpor. Guard loopback pada provisioner fixture tetap aktif.

## Cakupan yang dipertahankan

Frontend versi 2 tetap memakai LocalStorage; index.html, js, css dan assets tidak berubah. Konfigurasi keamanan hosted yang lebih ketat tidak ditimpa oleh konfigurasi demo lokal. Tidak ada secret, password database, access token, atau service key yang dicetak/disimpan dalam laporan. Data metadata dan hash review aman dipertahankan di repository.

Batas selanjutnya: Auth UI/integrasi frontend, pengujian GoTrue/JWT/PostgREST dengan identitas nyata, fixture Auth cloud, realtime, upload, scheduler dan gateway tetap di luar pekerjaan ini. Migrasi yang telah applied **jangan diedit atau dijalankan ulang secara manual**; perubahan schema selanjutnya memakai migrasi timestamp baru dan review terpisah.

## Verifikasi ulang tanpa menerapkan perubahan

```powershell
npx supabase db query --remote=wfmhsbdfdcugxblqsaob --read-only --file supabase/review/postflight.sql --output-format json
npx supabase db query --remote=wfmhsbdfdcugxblqsaob --read-only --file supabase/review/migration-history.sql --output-format json
npx supabase db query --remote=wfmhsbdfdcugxblqsaob --read-only --file supabase/review/structure.sql --output-format json
npx supabase db push --remote=wfmhsbdfdcugxblqsaob --dry-run --skip-vault --output-format json
```

scripts/apply-approved-remote.mjs menyimpan tahap yang disanitasi dan menolak apply ulang ketika bukti apply_completed sudah ada. Gunakan perintah read-only di atas untuk inspeksi berikutnya. Persetujuan pada pekerjaan ini tidak memberikan izin reset atau perubahan remote lain di luar manifest yang direview.
