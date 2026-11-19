# Seed dan fixture development

Ada dua jalur terpisah: seed master tanpa Auth dan fixture pengguna/properti khusus lokal. Keduanya dapat diulang tanpa membuat record duplikat. Tidak ada credential demo yang disimpan di repository.

Status remote: seed master **7 fasilitas** telah dimuat dan diverifikasi pada ngekosaja-development setelah persetujuan pengguna. Fixture Auth/properti penuh tidak diimpor ke cloud. Hasil aktual: [REMOTE_DEPLOYMENT.md](REMOTE_DEPLOYMENT.md).

## Master data

`supabase/seed.sql` hanya memasukkan tujuh fasilitas: WiFi, AC, kamar mandi dalam, furnitur, dapur bersama, parkir dan laundry. `ON CONFLICT(code) DO NOTHING` mempertahankan data existing. Tidak membuat Auth user atau profile palsu dan aman dijalankan sebelum ada akun.

Supabase menjalankannya setelah reset lokal sesuai config.toml. Pengujian menjalankannya dua kali dan membandingkan jumlah record.

## Fixture Auth lokal

Untuk enam akun development yang dapat login dengan password pilihan pengguna, tersedia mekanisme baru terpisah: [DEVELOPMENT_ACCOUNTS.md](../auth/DEVELOPMENT_ACCOUNTS.md). Plan default hanya membaca project development Cloud; apply memerlukan persetujuan terlebih dahulu, terminal interaktif, dan menolak semua alamat existing. Mekanisme tersebut tidak menjalankan seed penuh/reset di bawah ini. Akun remote belum dibuat pada pemeriksaan penyederhanaan Auth.

```powershell
npm ci
npx supabase start
npm run db:reset:local
npm run db:fixtures
```

Provisioning memakai `scripts/provision-fixtures.mjs`:

1. Mengambil konfigurasi stack lokal melalui CLI `status -o json` dalam memory, atau variabel terminal pada .env.example. Script tidak mencetak status/secret dan tidak otomatis membaca file .env.
2. Memastikan URL database dan Auth API hanya localhost/loopback. Tidak ada flag untuk mengizinkan cloud.
3. Membaca fresh seed **kode** `js/data.js` dan `js/schema.js` melalui VM terbatas. Tidak membaca LocalStorage atau file data pengguna.
4. Memanggil Auth Admin API listUsers/createUser lokal. Email memakai domain `.invalid`; password acak kuat hanya ada selama request, langsung dibuang tanpa dicetak atau disimpan. Pengguna existing ditemukan lewat email fixture stabil; UUID berasal dari hasil Auth, bukan UUID rekaan untuk profil.
5. Trigger Auth membuat profil, pengaturan dan role prospect. SQL parameterized menghubungkan UUID tersebut, lalu server_grant_role memberi role fixture yang sesuai. Admin contoh diberikan secara eksplisit oleh server development, tidak berasal dari metadata signup.
6. Menambahkan properti, kamar, agreement, tagihan, ledger, keluhan, pesan, notifikasi, wishlist dan campaign dalam satu transaksi SQL dengan advisory lock. Kunci non-Auth stabil; `ON CONFLICT DO NOTHING` dan idempotency key transaksi mencegah duplikasi.

Hasil memuat tiga pemilik (Sari, Arif, Dewi), 16 properti, 101 kamar dengan tipe/kondisi berbeda, 31 penghuni, satu prospect dan satu admin contoh, agreement terkait, enam bulan tagihan/transaksi, empat tiket, chat dua arah, notifikasi, wishlist, jadwal bulanan dan promosi. Nilai/jumlah pasti sebelum skenario tes tambahan tercatat pada tests/database-results.json setelah pengujian. Semua transaksi ilustrasi; grant campaign bawaan bukan revenue.

Tidak disediakan password login fixture. Jika membutuhkan sesi akun untuk Phase 2, gunakan mekanisme Auth Admin generateLink/undangan lokal yang disetujui atau akun pengujian yang dibuat sendiri; jangan memasang password tetap dalam source.

Auth Admin tidak ikut transaksi SQL. Jika SQL fixture gagal, akun Auth yang berhasil dibuat tetap ada; rerun akan memakai UUID yang sama dan mengulang SQL tanpa menduplikasi. Jangan menjalankan dua provisioning paralel pada proses pembuatan akun Auth. Script SQL mengunci tahap pengisian relasi, tetapi operasi Auth HTTP tidak berada dalam lock SQL tersebut.

Replay mempertahankan snapshot/history dan tidak memperbarui periode campaign atau jatuh tempo lama. Untuk fixture bertanggal baru, ulangi reset **lokal** lalu provisioning. Script menyesuaikan start_date agreement paling lambat bulan invoice historis pertama karena seed versi 2 mempunyai sebagian joinedAt lebih baru daripada histori enam bulan. Periode invoice memakai bulan createdAt/label seed, bukan due_date yang bisa bergeser melewati batas bulan.

## Pengujian tanpa GoTrue/Docker

`npm run db:test -- --native` membuat database acak dan adapter `supabase/tests/bootstrap_native.sql`. Auth UUID test dibuat sebagai fixture dalam tabel adapter di database acak, lalu seluruh tabel aplikasi tetap mempunyai FK yang valid. Ini pengujian kontrak SQL, bukan provisioning GoTrue asli dan bukan pengganti Auth Admin untuk development app.

Adapter tidak menyimpan password/credential dan tidak pernah dipasang pada project Supabase. Script Auth Admin tersedia tetapi belum diuji terhadap GoTrue di lingkungan saat ini karena Docker/Podman tidak tersedia. Semua izin browser yang berhubungan upload/gateway tetap tertutup.

Rujukan: [Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers), [profil dan Auth users](https://supabase.com/docs/guides/auth/managing-user-data).
