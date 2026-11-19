# Akun development UAS tanpa email

Status: **plan diperiksa, belum diterapkan ke Cloud, menunggu persetujuan pengguna**. Target dikunci ke `ngekosaja-development` (`wfmhsbdfdcugxblqsaob`). Tidak ada migration baru, reset, penghapusan akun atau perubahan password akun existing.

| Email testing | Akses tambahan |
| --- | --- |
| uas-prospect@ngekosaja.test | Calon penghuni |
| uas-tenant-a@ngekosaja.test | Penghuni A |
| uas-tenant-b@ngekosaja.test | Penghuni B |
| uas-owner-a@ngekosaja.test | Pemilik A |
| uas-owner-b@ngekosaja.test | Pemilik B |
| uas-admin@ngekosaja.test | Administrator platform |

Semua akun mempertahankan role dasar prospect dari trigger. Domain `.test` hanya identitas development dan tidak menerima email. Admin API createUser memakai email_confirm:true pada **akun baru ini saja**, tanpa email. Bukan mekanisme reset password website.

Relasi baru: enam profil dari trigger, lima grant tambahan melalui fungsi server existing, dua properti testing **draft**, masing-masing satu kamar, dua record penghuni dan dua agreement aktif. Pemilik A terkait penghuni A; pemilik B terkait penghuni B. Tidak menambah tagihan/pembayaran/pendapatan palsu. Trigger dapat menambah pengaturan/audit pendukung sesuai schema. Properti testing tidak tampil pada katalog publik.

[Plan JSON](development-account-plan.json) mencantumkan ID resource, fingerprint dan preflight aktual: satu akun Auth existing, nol email fixture existing, nol benturan resource, trigger profil tersedia dan 31 tabel RLS. Hanya jumlah akun existing dicatat, bukan identitas/passwordnya.

## Plan tanpa perubahan remote

```powershell
npm run auth:provision-uas
```

CLI harus sudah login dan linked ke project development. Script memverifikasi ref lokal, nama/ref remote, collision dan Confirm Email melalui operasi read-only. Tahap ini tidak mengambil key administratif atau mengubah konfigurasi hosted.

## Setelah pengguna menyetujui plan

Jalankan apply_command dari JSON plan **di terminal interaktif pribadi**. Bentuk perintah:

```text
npm run auth:provision-uas -- --apply --approve-remote=<fingerprint-plan-yang-disetujui>
```

Flag harus cocok dengan fingerprint manifest. Tanpa flag tepat atau terminal TTY, script berhenti sebelum network. Persetujuan percakapan diperlukan sebelum menjalankannya. Jangan menjalankan dua provisioning bersamaan.

Masukkan password berbeda untuk setiap akun dan konfirmasinya: minimal 12 karakter, huruf besar/kecil, angka dan simbol. Input tidak ditampilkan. Jangan menaruh password pada argumen, frontend, chat atau file project. Pengguna menyimpan password sendiri secara pribadi bila diperlukan.

Key server diambil melalui CLI hanya di RAM setelah approval/preflight. Tidak dikirim ke browser, disimpan di konfigurasi, dicetak atau dimasukkan report. Password juga hanya di RAM. Verifikasi login menggunakan publishable key dan JWT tiap akun, bukan key server untuk query data pengguna.

Semua alamat target diperiksa sebelum meminta password. Jika satu saja sudah ada, seluruh provisioning ditolak tanpa mengubah akun. UUID harus berasal dari Admin API; SQL memeriksa email, marker run dan UUID keenam akun sebelum grant/relasi. Metadata role dari formulir tidak dipercaya.

Relasi dibuat dalam satu transaksi dengan advisory lock. Check-in existing mensyaratkan properti published; hanya dua properti baru dipublikasikan sementara **di dalam transaksi yang sama**, lalu kembali draft sebelum commit. Properti sementara tidak terlihat oleh transaksi publik. RLS/trigger tidak dimatikan.

Setelah commit, script memeriksa profil, role, dua agreement aktif, dua properti draft, login keenam akun dan isolasi owner/tenant A terhadap B melalui PostgREST. Hasil sukses baru dicatat ke docs/auth/development-account-apply-results.json jika semua pemeriksaan lulus. Ini tidak menggantikan uji signup publik Cloud tanpa verifikasi atau penerimaan inbox; keduanya belum dilakukan ulang.

## Jika terjadi kegagalan parsial

Auth Admin HTTP tidak berada dalam transaksi SQL. Akun baru yang sempat dibuat tetap dipertahankan; script tidak menghapus atau mengambil alih akun. Receipt lokal .database-test/uas-accounts/receipt.json menyimpan UUID/marker run dan status commit, tanpa password, serta diabaikan Git. Kegagalan receipt/verifikasi menghentikan script tanpa klaim sukses. Periksa Auth dan receipt secara administratif sebelum langkah berikutnya; jangan rerun untuk mengganti akun existing.

Sebelum tahap relasi, akun parsial hanya memiliki prospect. Kegagalan SQL me-rollback seluruh relasi/grant. Jika verifikasi sesudah commit gagal, relasi tetap ada; receipt relations_committed:true membedakan kondisi itu. Tidak ada cleanup remote otomatis.

## Pengujian aman

```powershell
npm run test:auth-provision
npm run db:test -- --native --postflight --uas-fixtures --output=tests/database-auth-uas-results.json
```

Unit test tidak menyentuh network. Suite SQL membuat database acak di PostgreSQL loopback, menguji migrasi/fixture/RLS, lalu membuang database sementara tersebut. Tidak mereset input database atau Cloud. Cluster PostgreSQL test lokal harus sudah aktif pada port 55432. Adapter Auth bukan GoTrue.

Confirm Email OFF hanya untuk UAS/development; prototype ini **belum siap production**. Rujukan: [Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
