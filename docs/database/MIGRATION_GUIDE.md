# Panduan migrasi

Semua file dijalankan menurut nama timestamp, masing-masing dalam transaksi. Tabel baru langsung diaktifkan RLS dan ditutup grants-nya dalam transaksi pembuatannya; migrasi terakhir memberi policy dan izin yang diperlukan. Tidak ada tahap deployment yang mengekspos tabel sementara tanpa RLS.

| Urutan | File pada supabase/migrations | Isi |
| --- | --- | --- |
| 1 | 20261118000100_foundation_identity.sql | btree_gist, private schema, default privileges, profil Auth, role, settings, trigger signup |
| 2 | 20261118000200_properties_rooms.sql | Properti, galeri, aturan, landmarks, fasilitas dan kamar |
| 3 | 20261118000300_tenants_agreements.sql | Penghuni, agreement, exclusion interval, proteksi penempatan |
| 4 | 20261118000400_finance_promotions.sql | Tagihan, recurring, ledger transaksi, boost, proteksi snapshot |
| 5 | 20261118000500_complaints.sql | Tiket, timeline, foto metadata, notes, analisis lokal |
| 6 | 20261118000600_messaging_personal_data.sql | Percakapan, anggota, pesan, lampiran metadata, notifikasi, wishlist, pencarian, analytics, audit |
| 7 | 20261118000700_atomic_business_operations.sql | RPC pemilik, check-in/out/pindah, invoice, recurring, pembayaran khusus server |
| 8 | 20261118000800_complaint_chat_notifications.sql | Transisi tiket, chat, notifikasi/reminder, event listing |
| 9 | 20261118000900_public_catalogue_reports.sql | Katalog publik aman, invoice_statuses, laporan owner/platform |
| 10 | 20261118001000_rls_and_audit.sql | Policy/grants terperinci dan trigger audit |
| 11 | 20261118001100_integrity_hardening.sql | Cursor recurring, pesan berlampiran, penghapusan properti terotorisasi |
| 12 — applied | 20261119000100_final_verification_fixes.sql | CHECK tanggal checkout wajib, validasi RPC, EXECUTE helper tanggal untuk service_role |

Seluruh **12 migrasi telah applied**, setelah persetujuan pengguna, dengan **0 pending**. Hasil dry-run terakhir, uji upgrade dan bukti penerapan terdapat di [PHASE1_COMPLETION.md](PHASE1_COMPLETION.md). Tidak perlu menjalankan ulang apply. Perubahan schema berikutnya memakai migrasi baru dan review terpisah.

## Development lokal

CLI dipin pada **3.2.0** dalam package-lock.json. Sintaks diperiksa memakai --help CLI terpasang. Versi ini menargetkan lokal secara default; `--remote` eksplisit diperlukan untuk hosted. `--local` bukan flag db reset versi ini.

```powershell
npm ci
npx supabase start
# Hanya mengulang database development LOKAL, menghapus data lokal sebelumnya.
npm run db:reset:local
npm run db:fixtures
npm run db:test
```

`db:reset:local` berisi `supabase db reset` tanpa --remote dan hanya menjalankan seed master. Fixture Auth dijalankan terpisah melalui Auth Admin lokal. Tidak ada import otomatis LocalStorage.

Alternatif tanpa Docker jika PostgreSQL tersedia: ikuti setup cluster loopback di [SETUP_GUIDE.md](SETUP_GUIDE.md), lalu `npm run db:test -- --native --docs`. Runner membuat database baru dengan nama acak, menerapkan seluruh migrasi dan adapter kontrak Auth, menguji, lalu menghapus hanya database acak yang dibuatnya. Runner menolak alamat nonloopback. Ini bukan reset database yang Anda berikan.

## Review remote dan batas persetujuan

Workspace terhubung ke **ngekosaja-development**. Dua belas migrasi dan seed master telah **diterapkan setelah persetujuan pengguna** dan diverifikasi: [PHASE1_COMPLETION.md](PHASE1_COMPLETION.md). [REMOTE_REVIEW.md](REMOTE_REVIEW.md) menyimpan histori review awal. Perintah login/link di bawah hanya diperlukan pada workspace baru, bukan untuk mengulang koneksi yang sudah terverifikasi. Jangan menerapkan file bootstrap_native.sql ke cloud/Supabase: itu hanya adapter test pada database acak.

```powershell
npx supabase login
# PROJECT_REF diisi sendiri dari Settings > General pada project development.
npx supabase link --project-ref $env:SUPABASE_PROJECT_REF
# Daftar migrasi dan seed yang akan dipakai, tanpa menerapkannya.
npx supabase db push --remote --dry-run --include-seed --skip-vault
```

Jangan menaruh password/token di argumen yang disimpan riwayat shell atau di source. Gunakan prompt CLI dan credential manager lokal; jangan kirim credential melalui chat. Output dry-run perlu direview untuk memastikan target, versi PostgreSQL, schema existing, konflik migrasi, privilege default, dan kebijakan organisasi benar.

Penerapan manifest awal yang disetujui telah selesai. Perubahan remote berikutnya memerlukan review dan kewenangan yang sesuai. Tidak ada instruksi remote reset. Untuk project dengan data/schema existing, jangan menyalin seluruh initial migrations ke SQL Editor; buat migrasi aditif yang sesuai.

## Perubahan selanjutnya

Seluruh initial migration Phase 1 sudah applied pada remote development. Jangan mengedit file yang sudah applied. Tambahkan timestamp baru, jalankan seluruh pengujian lokal, regenerasi dictionary/ERD/policies dari database hasilnya, dan review dry-run.

Jika satu file gagal, transaksi file itu rollback. Perbaiki di development atau buat migration lanjutan sesuai status applied; jangan menonaktifkan RLS untuk melewati error. Histori sewa/pembayaran dipertahankan; tidak ada down migration yang membuang data finansial. Pemulihan cloud harus mengikuti backup/restore resmi dan persetujuan tersendiri.

Rujukan: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [workflow migrasi](https://supabase.com/docs/guides/local-development/cli-workflows), [constraints PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html).
