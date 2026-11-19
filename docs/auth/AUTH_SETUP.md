# Menjalankan Auth Phase 2 untuk environment development

Pengaturan ini digunakan pada environment development NgekosAja.com. Supabase Auth, PostgreSQL, RLS, session, role dan UI existing dipertahankan. Konfigurasi ini **belum siap production**.

## Workspace saat ini

URL dan Publishable Key **sudah dikonfigurasi** pada config/runtime.js dari project live ngekosaja-development. File ini sengaja berisi nilai publik yang diperlukan browser; key berawalan sb*publishable* bukan secret/server key. Enam callback lokal juga sudah ditambahkan ke allowlist Cloud, tanpa menurunkan konfirmasi email, OTP atau MFA. Bukti: [callback-config-results.json](callback-config-results.json).

Jalankan dari root project:

```powershell
npm run dev
```

Buka **http://127.0.0.1:5500/#/register** atau **http://127.0.0.1:5500/#/login**. SDK telah disertakan lokal, sehingga website tidak memerlukan npm install untuk dipakai. Tooling development membutuhkan Node >=20; jika node_modules belum ada, jalankan npm ci. VS Code Live Server pada port 5500 juga dapat dipakai. file:// hanya untuk Demo Mode; Connected memerlukan HTTP.

Server npm run dev hanya melayani index/config publik/js/css/assets. .env, supabase/.temp, node_modules, docs, script administratif dan file internal lain ditolak. Jangan menaruh secret pada direktori yang dilayani server statis.

## Clone atau project baru

1. Salin bentuk config/runtime.example.js ke config/runtime.js dan isi Project URL + **Publishable Key** dari Dashboard > Project Settings > API Keys. Tidak boleh service*role, sb_secret*, password database, PAT atau JWT server.
2. Jika workspace ini masih terhubung melalui CLI dan target tetap development, npm run auth:configure dapat membaca public key tanpa --reveal serta menyalin bundle SDK/lisensi. Script memverifikasi ref/nama live, tidak meminta secret dan tidak menampilkan key.
3. .env bukan konfigurasi JavaScript browser. .env.example lama tetap hanya untuk tooling server lokal; jangan menambah service key ke config/runtime.js.

## Pengaturan Dashboard

Email/password provider tetap aktif. Pemilik project mengatur **Authentication > Sign In / Providers > Email > Confirm email: OFF** secara manual untuk environment development (label Dashboard dapat berubah). Pemeriksaan read-only 19 November 2026 memastikan remote **false** pada **ngekosaja-development**; bukti [development-account-plan.json](development-account-plan.json). Script dan aplikasi tidak mengubah konfigurasi hosted. Pertahankan secure email change/double confirmation, RLS dan MFA configuration.

Confirm Email OFF membuat Supabase memperlakukan email akun baru sebagai terkonfirmasi tanpa membuktikan kepemilikan inbox. Ini hanya keputusan untuk environment development; akun existing tidak diubah dan tidak diasumsikan otomatis terkonfirmasi. Jika fitur diaktifkan kembali, alur verifikasi sebelumnya tetap didukung.

Authentication > URL Configuration > Redirect URLs sudah memuat tepat:

```text
http://127.0.0.1:5500/index.html?auth_flow=verify
http://127.0.0.1:5500/index.html?auth_flow=recovery
http://127.0.0.1:5500/index.html?auth_flow=email-change
http://localhost:5500/index.html?auth_flow=verify
http://localhost:5500/index.html?auth_flow=recovery
http://localhost:5500/index.html?auth_flow=email-change
```

Site URL existing tidak diganti; seluruh metode aplikasi mengirim redirectTo yang eksplisit. Untuk port, subfolder atau domain baru, tambahkan URL callback yang sesuai melalui Dashboard sebelum mencoba. Jangan memakai wildcard production tanpa kebutuhan. Jangan melakukan config push terhadap supabase/config.toml penuh: konfigurasi lokal berbeda dari hosted.

scripts/configure-auth-callbacks.mjs menyiapkan konfigurasi terpisah ignored, menyelaraskan default CLI dengan nilai remote, lalu **menolak** diff selain auth.additional_redirect_urls. Perubahan enam URL tersebut sudah applied dalam lingkup Phase 2. Tidak perlu mengulang. CLI 3.2.0 ternyata materialize beberapa default meskipun file minimal; guard awal mencegah downgrade sebelum apply.

## Email verifikasi dan pemulihan

Daftar dengan nama, email, password 12–128 karakter (besar/kecil/angka/simbol), konfirmasi dan persetujuan ketentuan. Auth membuat akun; trigger PostgreSQL membuat profil dan prospect. Jika signup mengembalikan session aktif, aplikasi memverifikasi user melalui getUser, memuat profil/role database, lalu masuk sesuai hak efektif dan menampilkan notifikasi berhasil. Prospect menuju home; memilih tujuan pemilik tidak memberi owner/admin. Jika tidak ada session, halaman verifikasi tetap digunakan: buka email pada browser tempat mendaftar. Email existing ditangani tanpa mengganti password, mengambil alih akun, atau retry email otomatis.

Login biasa tetap menuju home. Logout tetap di menu profil paling bawah dengan konfirmasi; session persistence, protected routes dan pengaturan profil dipertahankan.

Untuk pemulihan, buka #/forgot di browser yang akan dipakai, minta email, lalu buka tautannya pada browser tersebut. Jangan mulai permintaan kedua sebelum menyelesaikan yang pertama. Sesudah password diganti, masuk kembali. Tautan hanya dapat dipakai sesuai validitas Auth; route #/reset saja tidak cukup.

Lupa kata sandi tetap memerlukan email resmi dan callback/recovery session yang valid. Form menjelaskan batas kuota dan memberi pesan aman jika pengiriman ditolak. Tunggu sebelum mencoba lagi; tidak ada reset berdasarkan email saja, kode buatan atau jalur publik Auth Admin. Confirm Email OFF tidak menghilangkan kuota recovery. Tidak memakai Gmail SMTP, Resend, Mailtrap atau layanan tambahan/berbayar. Lihat [rate limits](https://supabase.com/docs/guides/auth/rate-limits) dan [pengaturan Auth](https://supabase.com/docs/guides/auth/general-configuration).

## Akun development dan histori insiden

Enam akun testing dan relasi owner/tenant telah dibuat setelah persetujuan, lalu lulus login, profil, role, isolasi, pemulihan session SDK dan logout di Supabase Cloud. Password dimasukkan pengguna melalui terminal tersembunyi. Akun pribadi serta password/role existing tidak diubah. Lihat [hasil finalisasi Phase 2](PHASE2_FINALIZATION.md) dan [panduan akun development](DEVELOPMENT_ACCOUNTS.md). Plan default tetap read-only; jangan menjalankan apply ulang pada akun yang sudah tersedia.

Paragraf pemulihan berikut merupakan histori insiden QA sebelumnya, bukan langkah setup normal. Utilitas perbaikan tersebut tidak dijalankan oleh penyederhanaan Auth ini. Jangan mengulang Cloud QA pada alamat pribadi.

Pengujian awal secara keliru memakai alamat pengguna sebagai identitas QA: konfirmasi dikonsumsi tes, password diganti acak, lalu recovery diminta dari browser QA yang ditutup. Dua email tersebut bukan hasil satu submit pendaftaran biasa. Pemeriksaan read-only berikutnya memastikan akun itu **sudah terverifikasi**, tetapi password pilihan pengguna belum dipasang. Akun tersebut sekarang dilindungi dari QA; jangan daftar ulang atau memakai dua tautan lama.

Untuk akun khusus yang dibuat QA lama tersebut, jalankan di terminal VS Code pada workspace ini:

```powershell
npm run auth:repair-test-account
```

Isi password baru dan konfirmasinya (input **tidak ditampilkan**). Password 12–128 karakter, mengandung huruf besar/kecil, angka dan simbol. Script memverifikasi project development, UUID, hash email dan metadata run; hanya password akun tersebut yang diperbarui melalui API Admin resmi, tanpa email. CLI harus tetap login. Tidak perlu menunggu quota email. Setelah berhasil, jalankan npm run dev dan masuk pada http://127.0.0.1:5500/#/login dengan password baru. Jangan mengirim password ke chat atau menjadikannya argumen command.

Script ini bukan jalur pemulihan website publik: akun lain, email belum terverifikasi, akun dibatasi, dan pemulihan yang sudah selesai ditolak. Key server tidak masuk browser/file/output. Tidak mengubah role, schema atau menghapus data. Pemeriksaan --check **belum** mengubah password; pengguna harus mengisinya sendiri. [Status aktual](account-repair-results.json), [rincian perbaikan](AUTH_RECOVERY_FIX.md). Akun biasa selanjutnya tetap memakai Lupa kata sandi dari browser sendiri.

Perbaikan PKCE menyimpan **hanya verifier** sementara pada localStorage agar tautan dapat dibuka di tab baru pada browser/profil dan origin yang sama (localhost berbeda dari 127.0.0.1). Verifier dibersihkan setelah dipakai/logout dan ditolak sesudah satu jam. Access/refresh session tetap pada sessionStorage bila Ingat saya tidak dicentang. Permintaan tautan baru menggantikan verifier sebelumnya; gunakan tautan terbaru.

Pengiriman API telah diuji; penerimaan inbox belum diverifikasi secara independen. Mengganti alamat email ke alamat lain dan mengonfirmasi dua inbox memerlukan pengujian manual dengan alamat yang dikuasai. Tidak ada SMTP custom atau perubahan alamat user existing yang dilakukan otomatis.
