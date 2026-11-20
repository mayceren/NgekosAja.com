# Aktivasi simulator di Supabase Cloud

Status aktual 20 November 2026: **aktif khusus development** pada ngekosaja-development (wfmhsbdfdcugxblqsaob), setelah pengguna menyetujui migration, dua fungsi dan aktivasi melalui pesan “ya”. Tidak ada layanan pembayaran eksternal atau pemindahan uang.

Migration 20261120000100_internal_payment_simulator.sql diterapkan tepat sekali. SHA256: d2cd2c4e11dded89408a46ec86471c7f43663fc6270f4ed3f515f4396044f4b5. Sekarang terdapat 15 migration applied dan nol pending. Migration applied tidak diedit. Tidak ada reset, seed, provisioning, perubahan role/password, transaksi testing Cloud, email atau git push.

Postflight aktual: 35 tabel public, 62 FK, 49 policies, 40 public functions, 13 publication members; RLS seluruh tabel aktif, tidak ada unsafe definer atau index/constraint invalid. Browser tidak dapat menulis payment_attempts, membaca switch private, atau menjalankan ketiga writer server-only. Policies dan views existing dipertahankan.

Fingerprint sebelum/sesudah cocok untuk 34 tabel public existing, auth.users dan storage.objects. Tujuh akun Auth, tujuh profil, satu invoice, nol transaksi dan nol campaign tetap sama selama aktivasi. Pemeriksaan read-only memastikan keenam akun fixture memiliki profil, role dan marker administratif yang sesuai; ini bukan bukti login atau uji JWT antar-akun.

simulate-rent-payment dan simulate-boost-payment ACTIVE versi 1 dengan verify_jwt=true. Empat variabel PAYMENT_* sesuai digest yang ditinjau; environment=development, target ref dikunci, simulator enabled. Switch database juga enabled. Origin browser yang diizinkan: http://127.0.0.1:5500 dan http://localhost:5500. Tidak ada service role key pada frontend, repository atau laporan.

HTTP aktual: payment_capabilities mengembalikan provider internal-simulator, development, enabled=true (200). Preflight CORS kedua runtime lulus (204). Request tanpa autentikasi ditolak (401), origin asing ditolak (403), dan pemanggilan writer anonim ditolak. Tidak ada transaksi tercatat oleh smoke test tersebut.

Pelaksanaan pertama berhenti aman pada verifier konfigurasi karena script mengharapkan field digest. CLI 3.2.0 ternyata menempatkan digest SHA256 pada field value. Keempat hash diverifikasi cocok tanpa menampilkan nilainya. Pemeriksaan dilanjutkan dari tahap tersebut; migration/deploy/secrets set tidak diulang. Switch DB baru diaktifkan setelah verifikasi konfigurasi, runtime dan marker akun lulus.

Bukti: [apply/deploy awal](cloud-activation-results.json), [kelanjutan dan hasil akhir](cloud-activation-resume-results.json), [review terkini](cloud-current-review-results.json), dan [pengujian lokal](TESTING.md). Review sebelum apply dipertahankan pada revision-remote-review-results.json.

Untuk mencoba: jalankan npm run dev, buka http://127.0.0.1:5500 dan refresh. Gunakan password existing akun dev-tenant-a/b@ngekosaja.test atau dev-owner-a/b@ngekosaja.test. Owner membuat tagihan lewat UI; tenant membuka tagihannya, memilih metode ilustratif dan mengonfirmasi. Boost membutuhkan properti sendiri yang published. Akun pribadi, Prospect dan Administrator tidak diizinkan settlement simulasi. Tidak ada QR/rekening/PIN/OTP yang diminta.

**Batas verifikasi:** belum menjalankan transaksi Cloud dengan akun login nyata, pembuatan fixture, atau E2E Realtime lintas akun/perangkat. Langkah tersebut memerlukan password melalui terminal/UI privat dan persetujuan data testing tersendiri. Tidak mengklaim Cloud payment E2E atau kesiapan Production.
