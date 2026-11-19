# Role dan otorisasi

## Sumber hak akses

| Role database | Perolehan | Route |
| --- | --- | --- |
| prospect | Trigger signup publik, tanpa membaca role metadata | #/, #/account/profile |
| tenant | Check-in sah melalui owner_check_in, dengan agreement | #/tenant, #/account |
| owner | Grant oleh server/administrator terpercaya | #/owner, #/account |
| admin | Proses administratif server, tidak tersedia pada registrasi publik | #/admin, #/account |

Role dibaca dari public.user_roles dengan user_id=UUID hasil getUser. Penghuni juga harus mempunyai agreement yang terkait dengan UUID itu. Memberi role tenant secara manual tanpa agreement tidak membuka workspace penghuni. Histori agreement yang sah tetap dapat mempertahankan akses pengguna yang sudah checkout; data akun, favorit dan percakapan tidak dipindahkan ke identitas baru.

Login biasa selalu menuju home. Untuk navigasi Dashboard dan signup yang langsung menghasilkan session, prioritas hak efektif adalah admin > owner > tenant > prospect (prospect menuju home). Navigasi workspace hanya menawarkan role yang sah dari database. Scope owner/admin tidak saling menggantikan: admin tanpa role owner tidak membuka route owner. UI dapat dimodifikasi pengguna, tetapi setiap query bisnis berikutnya tetap harus memakai RLS.

## Pendaftaran pemilik

Tujuan owner-request pada formulir hanyalah informasi minat. Tidak ada izin INSERT/UPDATE user_roles untuk browser. Phase 2 sengaja mempertahankan aturan Phase 1, tidak membuat jalur self-grant atau migrasi baru. Administrator meninjau pemohon melalui Auth/profil, memverifikasi tujuan dan kepemilikan, lalu memberikan owner lewat proses server terpercaya.

Contoh **hanya di SQL Editor sebagai administrator database terpercaya**, setelah meninjau UUID sebenarnya. Jangan menaruhnya di frontend atau membungkusnya dalam RPC publik:

```sql
begin;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.server_grant_role('UUID_AUTH_YANG_SUDAH_DIVERIFIKASI'::uuid, 'owner');
commit;
```

Contoh tersebut tidak dijalankan oleh pekerjaan Phase 2. server_grant_role memiliki GRANT EXECUTE hanya untuk service_role dan pemeriksaan server; JWT admin aplikasi tidak cukup. Jangan memberi key server kepada calon pemilik. Pemberian admin harus melalui proses administratif yang lebih ketat, bukan tombol di profil.

## Penempatan penghuni

Calon penghuni tetap memakai UUID yang sama. Dalam integrasi bisnis Phase 3, calon penghuni membuka percakapan properti, pemilik melakukan owner_check_in untuk kamar miliknya, dan transaksi database membuat tenants/user_roles tenant/rental_agreements secara atomik. Constraint mencegah penempatan ganda. Jangan memberi role tenant dari pilihan registrasi atau menyalin user ke profil baru.

Role/profile dimuat ulang saat login, reload, event Auth, tombol Periksa pembaruan akses, dan focus setelah interval 30 detik. Pencabutan role dibaca ulang; RLS tetap menolak akses yang dicabut walaupun UI sesaat belum refresh. Tidak ada cache role persisten sebagai sumber otorisasi.

## Pembuktian keamanan

Pengujian historis Cloud menolak self-admin INSERT, server_grant_role RPC oleh user biasa, UPDATE invoice menjadi paid, dan UPDATE id profil dengan kode 42501. Metadata role=admin/is_admin=true tidak mengubah role database. Pemeriksaan UAS terbaru tidak mengubah akun existing atau mengulang QA pada alamat pribadi; enam akun development baru masih menunggu persetujuan. Lihat [DEVELOPMENT_ACCOUNTS.md](DEVELOPMENT_ACCOUNTS.md).

Cross-owner/cross-tenant serta privasi chat, keluhan dan notifikasi diuji pada PostgreSQL nyata dengan fixture berbeda identitas. Cloud tidak diisi properti/penghuni bisnis hanya untuk mengklaim tes lintas pemilik; batas bukti dijelaskan pada [AUTH_TESTING.md](AUTH_TESTING.md).
