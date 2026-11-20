# Rencana aktivasi Cloud yang memerlukan persetujuan

**Status terbaru: rencana migration, dua fungsi dan aktivasi development telah disetujui melalui pesan “ya”, lalu dijalankan pada 20 November 2026.** Jangan ulangi apply/deploy. [Hasil aktual](CLOUD_VERIFICATION.md) dan cloud-activation-resume-results.json menjadi status terkini; bagian di bawah mempertahankan rencana yang ditinjau sebelum pelaksanaan.

Target: ngekosaja-development, ref wfmhsbdfdcugxblqsaob. CLI 3.2.0 mengidentifikasi main branch sebagai environment=production; project ini ditetapkan pengguna sebagai development. Definisi environment aplikasi tetap dikunci oleh konfigurasi server dan DB, bukan nama branch atau flag frontend.

Dry-run aktual pada revision-remote-review-results.json lulus dengan tepat satu migration pending, tanpa seed atau role apply. Sebelum apply, ulangi review read-only dan pastikan fingerprint serta history masih cocok.

1. Terapkan 20261120000100_internal_payment_simulator.sql (SHA256 d2cd2c4e11dded89408a46ec86471c7f43663fc6270f4ed3f515f4396044f4b5). Menambah public.payment_attempts, private.payment_simulator_settings (OFF), tiga public RPC, satu policy, indexes/constraints/trigger dan tiga anggota publication. Tidak mengedit migration applied atau mereset data.
2. Verifikasi schema/RLS/grants/publication menggunakan phase5-postflight.sql secara read-only. Expected: 35 public tables, 62 FK, 49 policies, 40 public functions, 13 publication members; browser tidak dapat mengeksekusi writer atau membaca switch private.
3. Deploy hanya simulate-rent-payment dan simulate-boost-payment beserta shared runtime/handler yang telah diuji; keduanya verify_jwt=true. Hash source ada pada manifest review.
4. Jika aktivasi termasuk dalam persetujuan, tambahkan konfigurasi Edge: PAYMENT_SIMULATOR_ENABLED=true, PAYMENT_ENVIRONMENT=development, PAYMENT_ALLOWED_PROJECT_REF=wfmhsbdfdcugxblqsaob dan PAYMENT_ALLOWED_ORIGINS untuk origin website yang disetujui. Tidak memerlukan key pembayaran baru. Jangan mengubah secret unrelated.
5. Aktifkan private.payment_simulator_settings.enabled=true hanya pada target development ini jika disetujui. Setelah kedua guard aktif, hanya dev-tenant-a/b dan dev-owner-a/b yang dapat melakukan simulasi sesuai kepemilikan; marker administratif dan role DB wajib cocok. Akun pribadi/prospect/admin tidak dapat settlement.
6. Verifikasi read-only setelah deployment/configuration. Testing transaksi Cloud memerlukan fixture/data testing yang disetujui tersendiri atau dibuat pengguna melalui UI. Login akun testing menggunakan password existing melalui terminal/UI privat; tidak membuat ulang atau mengganti password akun.

Saat pengguna mengonfirmasi simulasi nanti, invoice development dapat menjadi paid dan campaign 30 hari dapat tercatat permanen sebagai simulasi. Tidak ada pemindahan uang. Untuk menonaktifkan endpoint, set switch Edge atau DB false; histori tetap disimpan.

Status saat rencana ditulis: **belum ada migration apply, deploy atau aktivasi Cloud**. Tidak menjalankan provisioning, seed massal, reset, git push, atau perubahan akun. Lihat [hasil implementasi](PHASE5_COMPLETION.md), [setup](SIMULATOR_SETUP.md), [testing](TESTING.md) dan [manifest review](revision-remote-review-results.json).
