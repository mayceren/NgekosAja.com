# Setup lokal dan langkah manual Supabase

Frontend tetap berjalan langsung dengan Live Server atau index.html, tanpa npm/database. Tooling di bawah hanya untuk development database Phase 1.

## Tooling yang diperiksa

Lingkungan pengerjaan: Windows/PowerShell, Node.js 20.12.0, npm 10.5.0, Git tersedia, PostgreSQL 16.3 terpasang. Dev dependencies dipin: Supabase CLI 3.2.0 dan pg 8.23.1. Docker dan Podman tidak ditemukan. Config lokal Supabase menggunakan PostgreSQL 17 bawaan CLI; kecocokan seluruh stack 17 belum dieksekusi, sementara SQL telah diuji pada PostgreSQL 16.3.

```powershell
node --version
npm --version
git --version
npm ci
npx supabase --version
docker --version
```

Jika npm.cmd di sandbox Windows gagal EPERM saat menemukan direktori user, jalankan terminal VS Code biasa yang mempunyai akses workspace. Itu batas sandbox pengujian, bukan alasan mengubah source frontend.

## Pilihan A: Supabase lengkap, memerlukan Docker

1. Instal/jalankan Docker Desktop dengan engine yang didukung Supabase, atau Podman sesuai dokumentasi resmi. Pastikan CLI engine tersedia pada PATH dan daemon berjalan.
2. Di root project, `npm ci`. Konfigurasi sudah diinisialisasi; tidak perlu `supabase init` lagi.
3. Jalankan `npx supabase start`. Ini layanan lokal; tidak memerlukan login cloud.
4. Jalankan `npm run db:reset:local` hanya jika siap mengganti data development lokal. Script memakai `supabase db reset` tanpa flag remote; CLI 3.2.0 menargetkan lokal secara default.
5. Jalankan `npm run db:fixtures`. Konfigurasi/secret lokal diambil script dalam memory. Jangan menyalin output key ke repository/chat.
6. Jalankan `npm run db:test`. Runner membuat database acak untuk fresh migration + SQL contract tests lalu menghapus database acak itu. Adapter Auth kontrak tetap digunakan; pengujian ini belum menguji JWT/HTTP meskipun host server adalah Supabase lokal.
7. Buka Studio lokal `http://127.0.0.1:54323`: periksa 31 tabel public, RLS, Foreign Keys, dan record fixture. Tabel profil hanya merujuk user yang ada pada Authentication > Users.
8. Lakukan validasi integrasi yang masih pending: GoTrue Admin API provisioning, login/token nyata pada akun uji lokal yang Anda kelola sendiri, lalu Data API sebagai anon/owner/tenant/admin untuk matriks RLS. Tidak cukup menguji SQL Editor sebagai postgres karena ia bypass RLS.
9. Hentikan stack dengan `npm run db:stop` setelah selesai.

Config hanya mengekspos public, auto_expose_new_tables=false. Realtime, storage, edge runtime dan analytics stack dinonaktifkan karena bukan cakupan Phase 1. Metadata lampiran tetap ada dalam schema, tanpa bucket/upload. Tidak ada cron atau gateway pembayaran.

## Pilihan B: pengujian SQL native tanpa Docker

Jika PostgreSQL tersedia, buat cluster terpisah **khusus project**. Contoh Windows di bawah menggunakan folder ignored `.local-db`; periksa lokasi bin PostgreSQL Anda dan pastikan port 55432 belum dipakai. Jangan arahkan folder ke database existing.

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
& "$pgBin\initdb.exe" -D '.local-db/data' -U ngekosaja_test --auth=trust --no-locale --encoding=UTF8
& "$pgBin\pg_ctl.exe" -D '.local-db/data' -l '.local-db/server.log' -o '-h 127.0.0.1 -p 55432' -w start
npm run db:test -- --native --docs
& "$pgBin\pg_ctl.exe" -D '.local-db/data' -m fast -w stop
```

Trust hanya untuk cluster pengujian sementara yang bind 127.0.0.1 dan tidak berisi data pribadi. Jangan gunakan pola trust ini pada server bersama/cloud. Runner default native memakai role ngekosaja_test pada port 55432; dapat memakai variabel PGHOST/PGPORT/PGUSER/PGPASSWORD terminal untuk cluster lokal lain, tetap wajib loopback. Role test memerlukan CREATE DATABASE dan CREATE ROLE untuk adapter, serta hak membuat extension btree_gist.

Runner menghapus hanya database dengan UUID acak yang dibuat dalam run tersebut. Cluster/folder tetap ada dan ignored; tidak menghapus database existing atau melakukan remote reset. Perintah --docs meregenerasi ERD, dictionary, RLS dan schema-catalogue dari hasil migrasi nyata sebelum database acak dibuang.

Untuk regenerasi dokumen dari database Supabase lokal yang sudah dimigrasi: `npm run db:docs`. Opsi --native pada generator standalone mengarah ke database postgres pada cluster test, yang sengaja tidak berisi tabel aplikasi; gunakan runner `db:test -- --native --docs` untuk menghasilkan dokumentasi native.

## Koneksi cloud dan langkah manual lanjutan

Project **ngekosaja-development** sudah dibuat dan workspace di-link oleh pengguna. Dua belas migrasi dan seed tujuh fasilitas telah diterapkan setelah persetujuan dan diverifikasi; lihat [PHASE1_COMPLETION.md](PHASE1_COMPLETION.md). Langkah pembuatan/login/link di bawah berlaku untuk setup baru, tidak perlu diulang pada workspace ini.

1. Setelah siap untuk review remote, buat/pilih project **development** pada Supabase Dashboard dengan akun Anda. Jangan mengirim password database atau secret key kepada agen/chat.
2. Periksa PostgreSQL version pada database target dan cocokkan config db.major_version sebelum tes stack final. Review kebijakan email Auth, redirect URL development, exposed schema public, dan akses anggota project. Jangan aktifkan registrasi owner/admin dari metadata.
3. Salin **project reference** (bukan secret) dari Settings > General ke variabel terminal yang sesuai. Tidak perlu menyalin service key ke frontend. Phase 1 tidak membutuhkan key cloud.
4. Login CLI sendiri melalui alur browser. Setelah persetujuan untuk link/review remote, gunakan perintah dokumentasi di bawah. Perintah ini belum dieksekusi pada pengerjaan Phase 1.

```powershell
npx supabase login
npx supabase link --project-ref $env:SUPABASE_PROJECT_REF
npx supabase db push --remote --dry-run --include-seed --skip-vault
```

Dry-run tidak menerapkan migration/seed. Manifest awal 11 migrasi dan migrasi perbaikan ke-12 sudah diterapkan dengan persetujuan dan tidak perlu diulang. Untuk perubahan baru, review target dan migrasi yang pending terlebih dahulu. Jangan menjalankan reset terhadap remote. Fixture provisioner sengaja menolak URL nonloopback; seed cloud yang dimuat hanya master fasilitas, bukan fixture Auth penuh.

`.env.example` hanya nama variabel kosong. Ekspor variabel ke proses Node menggunakan terminal/secret manager; script tidak otomatis membaca file .env. Folder project dapat disajikan utuh oleh Live Server/python, sehingga file secret perlu berada di luar folder web yang disajikan. .gitignore juga menutup file environment lokal dari commit. Hindari menampilkan CLI status mentah karena dapat mengandung key development.

Rujukan: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [local workflow](https://supabase.com/docs/guides/local-development/cli-workflows), [keamanan fungsi](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
