# Akun development tanpa email

Status: **keenam akun telah dibuat dan diverifikasi di Supabase Cloud setelah persetujuan pengguna; jangan menjalankan apply ulang**. Target dikunci ke `ngekosaja-development` (`wfmhsbdfdcugxblqsaob`). Tidak ada migration baru, reset, penghapusan akun atau perubahan password akun existing. Hasil aktual: [PHASE2_FINALIZATION.md](PHASE2_FINALIZATION.md).

| Email testing | Akses tambahan |
| --- | --- |
| dev-prospect@ngekosaja.test | Calon penghuni |
| dev-tenant-a@ngekosaja.test | Penghuni A |
| dev-tenant-b@ngekosaja.test | Penghuni B |
| dev-owner-a@ngekosaja.test | Pemilik A |
| dev-owner-b@ngekosaja.test | Pemilik B |
| dev-admin@ngekosaja.test | Administrator platform |

Semua akun mempertahankan role dasar prospect dari trigger. Domain `.test` hanya identitas development dan tidak menerima email. Admin API createUser memakai email_confirm:true pada **akun baru ini saja**, tanpa email. Bukan mekanisme reset password website.

Relasi baru: enam profil dari trigger, lima grant tambahan melalui fungsi server existing, dua properti testing **draft**, masing-masing satu kamar, dua record penghuni dan dua agreement aktif. Pemilik A terkait penghuni A; pemilik B terkait penghuni B. Tidak menambah tagihan/pembayaran/pendapatan palsu. Trigger dapat menambah pengaturan/audit pendukung sesuai schema. Properti testing tidak tampil pada katalog publik.

[Plan JSON](development-account-plan.json) mencantumkan ID resource, fingerprint dan preflight aktual: tujuh akun Auth, keenam email fixture beserta profil/role sudah tersedia, trigger profil tersedia dan 31 tabel RLS. Enam ID resource yang ditemukan adalah fixture yang telah dibuat sesuai plan. Hanya jumlah akun existing dicatat, bukan identitas/passwordnya.

## Plan tanpa perubahan remote

```powershell
npm run auth:provision-development
```

CLI harus sudah login dan linked ke project development. Script memverifikasi ref lokal, nama/ref remote, collision dan Confirm Email melalui operasi read-only. Tahap ini tidak mengambil key administratif atau mengubah konfigurasi hosted.

## Histori mekanisme apply (sudah dijalankan)

Bagian ini menjelaskan mekanisme yang telah dipakai setelah persetujuan, bukan instruksi menjalankan apply ulang. Plan existing sekarang tidak menyediakan apply_command. Bentuk perintah untuk plan baru yang benar-benar disetujui:

```text
npm run auth:provision-development -- --apply --approve-remote=<fingerprint-plan-yang-disetujui>
```

Flag harus cocok dengan fingerprint manifest. Tanpa flag tepat atau terminal TTY, script berhenti sebelum network. Persetujuan percakapan diperlukan sebelum menjalankannya. Jangan menjalankan dua provisioning bersamaan.

Masukkan password berbeda untuk setiap akun dan konfirmasinya: minimal 12 karakter, huruf besar/kecil, angka dan simbol. Input tidak ditampilkan. Jangan menaruh password pada argumen, frontend, chat atau file project. Pengguna menyimpan password sendiri secara pribadi bila diperlukan.

Key server diambil melalui CLI hanya di RAM setelah approval/preflight. Tidak dikirim ke browser, disimpan di konfigurasi, dicetak atau dimasukkan report. Password juga hanya di RAM. Verifikasi login menggunakan publishable key dan JWT tiap akun, bukan key server untuk query data pengguna.

Semua alamat target diperiksa sebelum meminta password. Jika satu saja sudah ada, seluruh provisioning ditolak tanpa mengubah akun. UUID harus berasal dari Admin API; SQL memeriksa email, marker run dan UUID keenam akun sebelum grant/relasi. Metadata role dari formulir tidak dipercaya.

Relasi dibuat dalam satu transaksi dengan advisory lock. Check-in existing mensyaratkan properti published; hanya dua properti baru dipublikasikan sementara **di dalam transaksi yang sama**, lalu kembali draft sebelum commit. Properti sementara tidak terlihat oleh transaksi publik. RLS/trigger tidak dimatikan.

Setelah commit, script memeriksa profil, role, dua agreement aktif, dua properti draft, login, getUser, pemulihan session SDK dan logout keenam akun. Setiap JWT memeriksa profil, role, properti, kamar, penghuni, agreement dan pengaturan privat melalui PostgREST. Owner/tenant A tidak melihat data B; prospect tidak melihat properti draft; admin boleh membaca data fixture tetapi tidak pengaturan privat pengguna lain. Properti draft tidak boleh muncul di katalog publik. Hasil sukses baru dicatat ke docs/auth/development-account-apply-results.json jika semua pemeriksaan lulus. Ini tidak menggantikan uji signup publik Cloud tanpa verifikasi atau penerimaan inbox; keduanya belum dilakukan ulang.

## Jika akun sudah tersedia

Jangan menjalankan apply lagi. Plan terbaru mencatat status per email beserta keberadaan profil, marker fixture dan role. Bila sebagian akun tersedia, provisioning ditolak dan memerlukan pemeriksaan manual; tidak ada pengisian ulang role atau reset password otomatis.

Jika seluruh enam akun lengkap dan marker administratif cocok, gunakan terminal pribadi:

```powershell
npm run auth:provision-development -- --verify
```

Mode ini hanya memakai publishable key, meminta password existing keenam akun dengan input tersembunyi, lalu memeriksa JWT tiap akun. Tidak meminta service role key, membuat akun, mengubah profil/role/password, atau menulis tabel bisnis. Login/logout tetap membuat/mencabut session Auth dan dapat memperbarui waktu login akun fixture. Hasil baru disimpan di docs/auth/development-account-verification-results.json. Mode ini menolak akun yang marker-nya tidak cocok, sekalipun alamat email sama. Jangan membagikan password melalui chat.

Status finalisasi dan langkah approval terbaru: [PHASE2_FINALIZATION.md](PHASE2_FINALIZATION.md).

## Jika terjadi kegagalan parsial

Auth Admin HTTP tidak berada dalam transaksi SQL. Akun baru yang sempat dibuat tetap dipertahankan; script tidak menghapus atau mengambil alih akun. Receipt lokal .database-test/development-accounts/receipt.json menyimpan UUID/marker run dan status commit, tanpa password, serta diabaikan Git. Kegagalan receipt/verifikasi menghentikan script tanpa klaim sukses. Periksa Auth dan receipt secara administratif sebelum langkah berikutnya; jangan rerun untuk mengganti akun existing.

Sebelum tahap relasi, akun parsial hanya memiliki prospect. Kegagalan SQL me-rollback seluruh relasi/grant. Jika verifikasi sesudah commit gagal, relasi tetap ada; receipt relations_committed:true membedakan kondisi itu. Tidak ada cleanup remote otomatis.

## Pengujian aman

```powershell
npm run test:auth-provision
npm run db:test -- --native --postflight --development-accounts --output=tests/branding-database-results.json
```

Unit test tidak menyentuh network. Suite SQL membuat database acak di PostgreSQL loopback, menguji migrasi/fixture/RLS, lalu membuang database sementara tersebut. Tidak mereset input database atau Cloud. Cluster PostgreSQL test lokal harus sudah aktif pada port 55432. Adapter Auth bukan GoTrue.

Confirm Email OFF hanya untuk environment development; produk ini **belum siap production**. Rujukan: [Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
