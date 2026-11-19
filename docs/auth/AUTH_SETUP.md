# Menjalankan Auth Phase 2

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

Email/password provider harus aktif dan **Confirm email tetap aktif**. Pertahankan secure email change/double confirmation serta pengaturan keamanan hosted lainnya. Pengujian saat ini tidak menonaktifkan RLS, konfirmasi email atau MFA.

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

Daftar dengan nama, email milik sendiri, password min 12 karakter (besar/kecil/angka/simbol), konfirmasi dan persetujuan ketentuan. Buka email verifikasi **pada browser yang sama**. Login setelah email terkonfirmasi. Jika ingin menjadi pemilik, pilih tujuan akun tersebut lalu minta administrator memberi akses; status awal tetap calon penghuni.

Untuk pemulihan, buka #/forgot di browser yang akan dipakai, minta email, lalu buka tautannya pada browser tersebut. Jangan mulai permintaan kedua sebelum menyelesaikan yang pertama. Sesudah password diganti, masuk kembali. Tautan hanya dapat dipakai sesuai validitas Auth; route #/reset saja tidak cukup.

Supabase built-in email memiliki batas rendah, saat ini **dua email per jam per project**, dan pembatasan penerima. Untuk pengujian banyak pengguna atau alamat di luar team, konfigurasikan SMTP sendiri di Dashboard. Credential SMTP tetap di Supabase/secret manager, bukan frontend. Lihat [rate limits](https://supabase.com/docs/guides/auth/rate-limits) dan [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Pengujian awal secara keliru memakai alamat pengguna sebagai identitas QA: konfirmasi dikonsumsi tes, password diganti acak, lalu recovery diminta dari browser QA yang ditutup. Dua email tersebut bukan hasil satu submit pendaftaran biasa. Pemeriksaan read-only berikutnya memastikan akun itu **sudah terverifikasi**, tetapi password pilihan pengguna belum dipasang. Akun tersebut sekarang dilindungi dari QA; jangan daftar ulang atau memakai dua tautan lama.

Untuk akun khusus yang dibuat QA lama tersebut, jalankan di terminal VS Code pada workspace ini:

```powershell
npm run auth:repair-test-account
```

Isi password baru dan konfirmasinya (input **tidak ditampilkan**). Password 12–128 karakter, mengandung huruf besar/kecil, angka dan simbol. Script memverifikasi project development, UUID, hash email dan metadata run; hanya password akun tersebut yang diperbarui melalui API Admin resmi, tanpa email. CLI harus tetap login. Tidak perlu menunggu quota email. Setelah berhasil, jalankan npm run dev dan masuk pada http://127.0.0.1:5500/#/login dengan password baru. Jangan mengirim password ke chat atau menjadikannya argumen command.

Script ini bukan jalur pemulihan website publik: akun lain, email belum terverifikasi, akun dibatasi, dan pemulihan yang sudah selesai ditolak. Key server tidak masuk browser/file/output. Tidak mengubah role, schema atau menghapus data. Pemeriksaan --check **belum** mengubah password; pengguna harus mengisinya sendiri. [Status aktual](account-repair-results.json), [rincian perbaikan](AUTH_RECOVERY_FIX.md). Akun biasa selanjutnya tetap memakai Lupa kata sandi dari browser sendiri.

Perbaikan PKCE menyimpan **hanya verifier** sementara pada localStorage agar tautan dapat dibuka di tab baru pada browser/profil dan origin yang sama (localhost berbeda dari 127.0.0.1). Verifier dibersihkan setelah dipakai/logout dan ditolak sesudah satu jam. Access/refresh session tetap pada sessionStorage bila Ingat saya tidak dicentang. Permintaan tautan baru menggantikan verifier sebelumnya; gunakan tautan terbaru.

Pengiriman API telah diuji; penerimaan inbox belum diverifikasi secara independen. Mengganti alamat email ke alamat lain dan mengonfirmasi dua inbox memerlukan pengujian manual dengan alamat yang dikuasai. Tidak ada SMTP custom atau perubahan alamat user existing yang dilakukan otomatis.
