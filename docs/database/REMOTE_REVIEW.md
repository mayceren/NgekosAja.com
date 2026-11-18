# Review remote sebelum penerapan migrasi

**Catatan review sebelum apply, 18 November 2026.** Sesudah review ini pengguna memberi persetujuan; 11 migrasi dan seed master kini berhasil diterapkan dan diverifikasi. Hasil terbaru: [REMOTE_DEPLOYMENT.md](REMOTE_DEPLOYMENT.md). Isi di bawah mempertahankan bukti keadaan sebelum penerapan; pada tahap review hanya operasi read-only/dry-run yang dilakukan. File migrasi yang direview tetap sama.

Hasil mesin beserta SHA-256 seluruh file migrasi: [remote-review-results.json](remote-review-results.json). Pemeriksaan dilakukan melalui CLI terpasang dan query `--read-only`, tanpa mencetak credential atau menyimpan output key.

## Target yang terverifikasi

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Nama project dari daftar project live | **ngekosaja-development** |
| Project reference yang terhubung | **wfmhsbdfdcugxblqsaob** |
| Status | ACTIVE_HEALTHY |
| Region | ap-northeast-1 |
| Supabase CLI | **3.2.0** dari dependency project |
| PostgreSQL remote | **17.12**, sesuai major_version=17 lokal |
| Label environment dari CLI | **production** — target cabang utama project tersebut, bukan preview branch. Nama project development tidak mengubah label ini. Persetujuan harus menyebut target ini secara jelas. |
| Relasi/fungsi aplikasi pada public/private | **0 / 0** sebelum dan sesudah dry-run |
| Akun Auth | **0** sebelum dan sesudah dry-run |
| Histori migrasi remote | Belum ada supabase_migrations.schema_migrations |
| Trigger aplikasi pada auth.users | Belum ada; tidak ada benturan nama trigger signup |
| btree_gist | Tersedia untuk instalasi; belum terpasang. Migrasi pertama memasangnya di extensions. |
| Role API | anon/authenticated bukan superuser dan tidak BYPASSRLS; service_role BYPASSRLS sesuai trust boundary server |

Identitas cache `.temp/project-ref` dan `.temp/linked-project.json` dicocokkan terhadap daftar project Supabase **live**, bukan dipercaya hanya dari nama folder. `.temp` tetap ignored. Tidak ada benturan tabel/fungsi/trigger aplikasi existing yang ditemukan.

## Dry-run yang benar-benar dijalankan

```powershell
npx supabase db push --remote=wfmhsbdfdcugxblqsaob --dry-run --include-seed --skip-vault --output-format json
```

Output: `dryRun=true`, `upToDate=false`, 11 migrasi, seed `supabase/seed.sql`, custom roles `[]`. `--skip-vault` mencegah pembaruan Vault dari konfigurasi. Tidak memakai --include-all, repair, pull, config push, atau reset. Perintah dry-run menyusun rencana; ia **tidak mengeksekusi SQL migrasi, menguji constraint pada remote, atau membuktikan izin DDL executor saat apply**.

## Daftar migrasi yang akan diterapkan

| Urutan | File | Dependensi / cakupan |
| --- | --- | --- |
| 1 | 20261118000100_foundation_identity.sql | Extensions/private, profile → auth.users, role, settings, signup trigger |
| 2 | 20261118000200_properties_rooms.sql | Owner profile → properties → images/rules/landmarks/facilities/rooms |
| 3 | 20261118000300_tenants_agreements.sql | Profile → tenants; room/tenant → agreement; UNIQUE dan exclusion periode |
| 4 | 20261118000400_finance_promotions.sql | Agreement → invoice/recurring; invoice/property → transaction → campaign |
| 5 | 20261118000500_complaints.sql | Agreement → complaint → history/attachment/note/analysis |
| 6 | 20261118000600_messaging_personal_data.sql | Property/profile → conversation/member/message; notification/favorite/analytics/audit |
| 7 | 20261118000700_atomic_business_operations.sql | RPC check-in/out/transfer, invoice individual/batch, recurring dan pembayaran server |
| 8 | 20261118000800_complaint_chat_notifications.sql | Workflow tiket/chat, notifikasi/reminder dan analytics |
| 9 | 20261118000900_public_catalogue_reports.sql | Proyeksi katalog publik, view security-invoker, laporan terotorisasi |
| 10 | 20261118001000_rls_and_audit.sql | Policy/grants pada seluruh entitas yang sudah ada; trigger audit |
| 11 | 20261118001100_integrity_hardening.sql | Cursor recurring, constraint pesan deferred, penghapusan properti yang dibatasi histori |

Urutan timestamp valid, nama unik, dan referensi tabel/FK mengikuti dependensi. Fungsi trigger yang menyentuh tabel lanjutan baru dihubungkan setelah tabelnya tersedia. Seluruh file dibungkus transaksi. Setiap tabel memanggil secure_table pada transaksi pembuatannya sehingga RLS/grants tidak menunggu deployment lain.

## Hasil pemeriksaan SQL, constraints dan keamanan

- Rancangan menghasilkan **31 tabel, 236 kolom, 48 FK, 45 policy RLS, 24 fungsi public, satu view security-invoker**. Detail: [schema](DATABASE_SCHEMA.md), [dictionary](DATA_DICTIONARY.md), [policies](RLS_POLICIES.md).
- Tidak ada **DROP TABLE/SCHEMA/COLUMN, TRUNCATE, DELETE data top-level**, konversi tipe yang menghapus nilai, atau penggantian tabel existing. DELETE yang ditemukan berada di definisi fungsi bisnis owner_delete_property; membuat fungsi tidak menjalankan DELETE. Fungsinya sendiri memeriksa kepemilikan dan FK RESTRICT histori.
- Profil mengikuti UUID Auth; tidak ada password aplikasi. Role signup selalu prospect. Admin/owner dan pencatatan pembayaran hanya melalui server terotorisasi. Browser tidak mendapat UPDATE status invoice atau INSERT ledger.
- Sewa menggunakan UUID/date, UNIQUE aktif per room/tenant, serta exclusion GiST periode. Snapshot uang bigint, nominal positif, admin sewa 2000, boost 30000/30 hari, invoice unik agreement/bulan dan satu pembayaran sukses per invoice.
- Fungsi SECURITY DEFINER mempunyai search_path kosong, grant EXECUTE eksplisit dan pemeriksaan akses. Katalog publik menggunakan projection tetap tanpa kontak pribadi atau data penghuni. View invoice_statuses security_invoker tetap mengikuti RLS.
- Remote mempunyai default ACL yang masih memberi privilege seperti TRUNCATE/TRIGGER/REFERENCES/MAINTAIN pada object baru tertentu. secure_table me-REVOKE ALL pada setiap tabel baru sebelum memberi izin yang dibutuhkan. View juga menutup default grants. Ini perlu diperiksa lagi setelah apply, termasuk MAINTAIN pada PostgreSQL 17.
- Perubahan default EXECUTE berlaku untuk object yang dibuat role migrasi, termasuk fungsi postgres yang dibuat kelak; bukan pencabutan izin semua fungsi existing. Default milik role Supabase internal lain tidak diubah secara massal. Tidak ada object aplikasi existing saat review.
- Histori transaksi/tiket/audit append-only; payment function mengunci invoice dan key idempotensi; biaya/revenue gagal tidak dihitung. Check-in dan transfer mempertahankan histori. Realtime, gateway, cloud upload dan scheduler tidak dibuka.

Tidak ditemukan perubahan data destructive atau celah akses kritis dari pemeriksaan ini. Hasil ini **bukan** klaim bahwa SQL sudah dijalankan atau policy sudah diuji pada remote.

## Perbedaan konfigurasi — tidak diterapkan

`supabase config validate`: valid=true, complete=true, errors=[], warnings=[]. `config diff` benar-benar dijalankan secara read-only, dengan **13 perbedaan: 12 update, 1 local_only**. Nilai secret tidak disimpan.

| Setting | Lokal | Remote | Penilaian |
| --- | --- | --- | --- |
| api.schemas | public | public + graphql_public | Perbedaan terkonfirmasi; private tidak termasuk daftar remote. RLS/grants tetap wajib untuk kedua jalur API. |
| auth.email.enable_confirmations | false | true | Remote lebih ketat; pertahankan. |
| auth.email.otp_length | 6 | 8 | Remote lebih kuat; pertahankan. |
| auth.mfa.totp.enroll_enabled / verify_enabled | false / false | true / true | Jangan diturunkan mengikuti demo lokal. |
| auth.sms.enable_confirmations | false | true | Pertahankan setting remote. |
| auth.site_url / additional_redirect_urls | URL demo lokal / 1 URL | Berbeda / 0 URL tambahan | Perlu konfigurasi terpisah saat Auth Phase 2; tidak diubah oleh migrasi SQL. |
| auth.email.max_frequency | 1s | Berbeda | Batas demo lokal tidak didorong ke cloud. |
| auth.password_requirements | String kosong | Tidak dipetakan sebagai nilai yang sama oleh CLI | Review kebijakan password tersendiri sebelum Auth produksi. |
| db.pooler.default_pool_size / max_client_conn | 20 / 100 | 15 / 200 | Perbedaan deployment, bukan benturan schema SQL. |
| storage.s3_protocol.enabled | false | true | Tidak membuat bucket/izin upload. Migrasi tidak mengubah konfigurasi storage remote. |

Nama setting secret yang dimask CLI dan setting unmanaged dicatat tanpa nilainya pada laporan JSON. Tidak menjalankan config push: menyalin config demo lokal ke remote bisa menurunkan konfirmasi email/MFA. Konfigurasi lokal tidak otomatis menjadi konfigurasi hosted hanya karena db push dilakukan.

## Batas dan risiko yang masih perlu diperhatikan

1. CLI melabeli cabang utama sebagai production. Persetujuan berlaku hanya untuk ref yang tercantum di atas; sebelum apply, cocokkan kembali identitas, hash file dan keadaan remote.
2. Observer `db query --read-only` adalah **supabase_read_only_user**, bukan executor DDL. Hasil has_schema_privilege CREATE/has_table_privilege TRIGGER=false dalam laporan adalah batas observer tersebut. Itu tidak membuktikan executor migration tidak berizin, dan juga tidak membuktikan ia pasti berizin. Jika apply gagal, hentikan dan review error, jangan memberi hak DDL kepada role read-only atau melakukan reset.
3. Pada waktu review awal, dry-run belum mengeksekusi SQL PostgreSQL 17. Pengujian lokal pada PostgreSQL **16.3** lulus **43 kelompok SQL**, 3 tes tooling, dan query postflight. Setelah persetujuan, apply pada remote **17.12 sudah berhasil** dan dicatat di REMOTE_DEPLOYMENT.md; pengujian GoTrue/JWT/PostgREST penuh tetap belum dilakukan.
4. Migrasi terdiri dari transaksi per file, bukan satu jaminan rollback untuk seluruh 11 file. Bila ada kegagalan, file terdahulu mungkin sudah applied. Catat histori aktual dan lanjutkan review secara aditif; jangan menghapus tabel atau repair histori secara sembarangan.
5. Pemeriksaan lock menunjukkan kemungkinan deadlock operasional ketika checkout (agreement lalu recurring) bersamaan dengan generator recurring (recurring lalu agreement). Ini temuan analisis urutan lock, belum direproduksi sebagai uji konkurensi khusus. PostgreSQL akan membatalkan salah satu transaksi; integrasi backend perlu retry terbatas pada 40P01/40001. Constraint tetap melindungi integritas. Tidak mengubah skema untuk dugaan ini pada tahap review.
6. Jika akun/data baru muncul sebelum apply, review ulang. Trigger signup tidak membackfill akun Auth yang sudah ada; saat pemeriksaan jumlah Auth masih 0.

## Seed yang termasuk rencana persetujuan

Hanya **seed master tujuh fasilitas** pada supabase/seed.sql, idempotent melalui ON CONFLICT(code) DO NOTHING. Tidak menimpa atau menghapus record existing dan tidak membuat akun demo/password/admin. Schema saat ini belum mempunyai facilities, sehingga belum ada benturan code/name yang ditemukan.

Fixture penuh 3 owner/16 properti/31 tenant memerlukan Auth Admin dan provisioner yang saat ini **khusus loopback lokal** sesuai [SEED_GUIDE.md](SEED_GUIDE.md). Guard tersebut tetap dipertahankan. Fixture penuh tidak termasuk seed cloud pada dry-run ini dan tidak akan dipaksakan dengan menonaktifkan guard. Provisioning fixture cloud membutuhkan rancangan dan persetujuan eksplisit terpisah.

## Prosedur sesudah persetujuan — sudah dijalankan

Prosedur berikut selesai setelah pesan persetujuan pengguna “aku setuju”. Daftar ini merupakan catatan rencana yang dijalankan, bukan instruksi untuk mengulang apply; hasil aktual tersimpan pada REMOTE_DEPLOYMENT.md.

1. Cocokkan kembali project/ref, hash 11 migrasi dalam JSON, keadaan schema, dan dry-run. Jika berbeda, hentikan untuk review baru.
2. Terapkan hanya rencana yang disetujui, tanpa config push/Vault/reset. Contoh perintah **hanya setelah persetujuan**:

```powershell
npx supabase db push --remote=wfmhsbdfdcugxblqsaob --include-seed --skip-vault --yes --output-format json
```

3. Simpan hasil apply yang telah disanitasi. Jalankan verifikasi read-only berikut, lalu cocokkan jumlah object dan hash dengan schema yang direview:

```powershell
npx supabase db query --remote=wfmhsbdfdcugxblqsaob --read-only --file supabase/review/postflight.sql --output-format json
```

4. Target pemeriksaan: 31 tabel, 45 policy, 48 FK, 24 fungsi public; 0 tabel RLS nonaktif; 0 PUBLIC EXECUTE dan definer search_path tidak aman; browser tidak bisa mencatat payment/grant role; anon hanya SELECT facilities dan RPC katalog; tidak ada TRUNCATE/TRIGGER/REFERENCES/MAINTAIN role API; invoice view invoker; 7 fasilitas master. Query katalog ACL membaca pg_class/aclexplode agar tidak bergantung pada filtering information_schema berdasarkan observer.
5. Jumlah baris master dibaca sesuai kemampuan RLS observer; jangan menyimpulkan seed kosong hanya dari hasil 0 pada observer yang dibatasi RLS. Verifikasi tambahan lewat akses anon ke master atau role server terotorisasi bila perlu. Test role dengan JWT nyata merupakan tahap verifikasi integrasi terpisah.
6. Catat migration history aktual, hasil postflight, seed dan batas integrasi di laporan ini. Jika gagal, hentikan dengan data existing dipertahankan. Tidak menjalankan reset, DROP, pembersihan akun atau rollback destructive.

## Reproduksi review tanpa apply

```powershell
node scripts/review-remote.mjs identity
node scripts/review-remote.mjs catalogue
node scripts/review-remote.mjs config
node scripts/review-remote.mjs dry-run
```

Script memverifikasi nama/ref live pada setiap run. Tidak mempunyai mode apply/reset/seed; seluruh query remote memakai --read-only. Referensi: [target lokal/hosted CLI](https://supabase.com/docs/guides/local-development/local-and-hosted-projects), [migrasi CLI v3](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3).
