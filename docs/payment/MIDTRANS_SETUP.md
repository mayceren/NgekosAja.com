# Setup Midtrans Sandbox

Status: pengguna menyatakan akun Midtrans belum tersedia. Semua implementasi/pengujian pembayaran saat ini lokal/mock. Migration 15 belum diterapkan, Edge Functions belum di-deploy, secrets/Notification URL remote belum diubah. Tidak ada Server Key yang dibuat-buat atau disimpan di frontend/repository.

Preflight Cloud berhasil, tetapi dry-run CLI pada sesi ini mengalami timeout. [Catatan aktual](dry-run-attempts.json) dan [manifest yang belum terverifikasi](remote-review-results.json) disimpan. Sebelum meminta approval deployment, dry-run baru harus selesai dengan target/hash/list yang cocok; jangan menerapkan migration berdasarkan timeout atau manifest lokal saja.

1. Buat akun Midtrans dan pilih **Sandbox**. Ambil Server Key dan Client Key Sandbox melalui Settings → Access Keys; jangan kirim ke chat. Siapkan merchant ID untuk pemeriksaan tambahan.
2. Tinjau docs/payment/remote-review-results.json, migration dan kode empat fungsi. Minta persetujuan tersendiri sebelum migration Cloud, secrets/config remote, deployment dan fixture E2E. Approval Phase 4 tidak berlaku untuk perubahan Phase 5.
3. Setelah disetujui, jalankan dry-run baru dengan `npm run payment:review`, verifikasi fingerprint/target ngekosaja-development dan tepat satu migration pending. Apply hanya migration yang telah ditinjau, tanpa seed/reset/include-all.
4. Isi secret di Supabase Dashboard → Edge Functions → Secrets, atau melalui terminal privat menggunakan file lokal yang diabaikan Git. Variabel: MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION=false, MIDTRANS_MERCHANT_ID, PAYMENT_ALLOWED_ORIGINS (origin HTTP website dipisahkan koma). SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY disediakan environment Supabase; jangan masukkan privileged key ke runtime.js.

Template tersedia pada supabase/functions/.env.example. Untuk testing lokal, salin ke supabase/functions/.env.local (ignored), isi melalui editor/terminal privat. Jangan memasukkan value secret sebagai argumen command atau menyalin output secrets ke chat. Pada Cloud, utamakan input langsung Dashboard. CLI `supabase secrets set --env-file supabase/functions/.env.local --remote=wfmhsbdfdcugxblqsaob` hanya boleh dijalankan setelah approval dan pemeriksaan help versi CLI; tidak dijalankan oleh implementasi ini. Hapus file lokal berisi secret setelah penggunaan sesuai kebutuhan dan jangan commit.

CLI terpasang 3.2.0: `functions deploy` mendukung daftar nama dan --remote. Setelah approval, deploy **hanya** create-rent-payment, create-boost-payment, payment-status, midtrans-webhook. Contoh: `supabase functions deploy create-rent-payment create-boost-payment payment-status midtrans-webhook --remote=wfmhsbdfdcugxblqsaob --use-api`. Jangan gunakan --prune, deploy tanpa nama, atau --no-verify-jwt global. Konfigurasi function-specific di supabase/config.toml hanya menonaktifkan JWT platform untuk webhook; signature/Get Status tetap wajib.

Notification URL untuk dipasang pada **Midtrans Sandbox Dashboard** setelah deployment:

`https://wfmhsbdfdcugxblqsaob.supabase.co/functions/v1/midtrans-webhook`

Masukkan melalui Settings → Configuration → Payment Notification URL. URL harus dapat dijangkau publik lewat HTTPS; localhost tidak dapat menerima webhook Midtrans. Lihat [Notification URL resmi](https://docs.midtrans.com/docs/https-notification-webhooks). Tidak perlu membeli domain baru atau menambah layanan berbayar.

Frontend mengambil public Client Key dari respons Edge yang sah dan memuat https://app.sandbox.midtrans.com/snap/snap.js saat checkout dibuka. Tidak perlu Server Key di browser. Refresh website setelah migration/configuration agar capability detection diperbarui. Bila belum aktif, checkout menampilkan informasi belum tersedia dan tidak menyediakan tombol sukses/gagal palsu.

Untuk E2E setelah approval: login akun development existing, gunakan invoice/campaign fixture yang disetujui, pilih metode Sandbox, dan selesaikan lewat [simulator resmi Sandbox](https://docs.midtrans.com/docs/testing-payment-on-sandbox). Jangan scan QRIS Sandbox dengan aplikasi uang nyata atau memakai rekening/kartu sungguhan. Pastikan webhook diterima, invoice paid/Boost aktif dari status server, duplicate/out-of-order aman, receipt berlabel Sandbox, dan owner/tenant lain ditolak. Catat hasil aktual tanpa credential. Tidak ada klaim siap Production.
