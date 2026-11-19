# Perbaikan insiden akun QA — 19 November 2026

Pengguna menerima email verifikasi dan reset, tautan konfirmasi gagal dipakai, login ditolak, lalu quota email penuh. Ini dampak pengujian otomatis sebelumnya, bukan hasil satu submit register yang memanggil dua jenis email.

Penyebab aktual pada tests/auth_cloud.py lama:

1. Signup memakai alamat pribadi yang diberikan untuk pengujian dan password acak di RAM.
2. Tes mengonsumsi token konfirmasi melalui Admin-generated link, lalu mengganti password melalui recovery dengan password acak lain.
3. Tes meminta email recovery terakhir melalui browser headless PKCE, lalu menutup browser dan menghilangkan verifier.
4. Pendaftaran ulang pada akun existing tidak mengganti passwordnya. Keberadaan auth.users tidak berarti password pendaftaran ulang berlaku.

Ada pula cacat pada adapter browser: verifier PKCE mengikuti preferensi sessionStorage, padahal email sering dibuka di tab baru. Cacat tersebut diperbaiki tanpa memindahkan session yang tidak diingat ke localStorage.

## Hasil aktual

Pemeriksaan Cloud **read-only** memastikan identitas cocok dengan marker QA lokal dan email sudah terverifikasi. Tidak mengirim email atau mengubah password, role, schema, konfigurasi email dan data bisnis. Marker ignored dilindungi dari QA. [Status aktual](account-repair-results.json): **awaiting-user-chosen-password** sampai pengguna menyelesaikan langkah di bawah. Login menggunakan password pilihan pengguna belum dapat diklaim terverifikasi.

## Menyelesaikan pemulihan tanpa email

Di terminal VS Code workspace ini:

```powershell
npm run auth:repair-test-account
```

Isi password baru dua kali; input tidak ditampilkan. Gunakan 12–128 karakter, huruf besar/kecil, angka dan simbol. Jangan mengirim password melalui chat, argumen atau file. CLI yang sudah login memverifikasi project ngekosaja-development dan hanya memperbarui password UUID akun QA lama yang cocok dengan hash email dan metadata run. Tidak mengonfirmasi email baru, memberi role, menghapus user atau mereset database. Setelah berhasil, laporan diperbarui dan tool menolak pemakaian ulang.

Jalankan npm run dev lalu buka http://127.0.0.1:5500/#/login. Gunakan alamat yang sama dan password baru; jangan daftar ulang atau membuka dua email lama. Password tidak diketahui agen dan baru dikirim setelah pengguna memasukkannya sendiri. Keberhasilan login perlu diperiksa pengguna pada langkah ini.

Tool menggunakan [Auth Admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) dari proses lokal, bukan frontend. Key administratif hanya ditangkap di memori dari CLI, tidak disimpan atau dicetak. --check hanya membaca kondisi remote dan memperbarui perlindungan lokal. Pemulihan publik selanjutnya tetap memakai alur email normal.

## Pencegahan dan pengujian

- QA Cloud membutuhkan opt-in identitas disposable baru; akun existing **selalu ditolak**, termasuk milik run lama. Email asli pada marker lama diblokir sebelum koneksi CLI/network. Recovery email penutup dan jalur resume yang mengganti password existing dihapus.
- Pendaftaran browser diuji menghasilkan tepat satu POST signup, tanpa recover/resend otomatis.
- Verifier dibagikan lintas tab pada origin yang sama, dihapus sesudah konsumsi/logout, dan kedaluwarsa lokal satu jam. Access/refresh session yang tidak diingat tetap per tab. Tidak menghapus pembuktian PKCE atau melonggarkan RLS.
- **33 kelompok Chromium lulus, 0 error JavaScript**, termasuk recovery pada tab baru, pemisahan session, expiry verifier, pendaftaran tunggal dan responsive.
- **14 test unit lulus** memakai Auth di memori: pembatasan UUID/email/run, unconfirmed/banned, konfirmasi password, pembatalan, kegagalan disk/Auth, proteksi sesudah selesai, hanya field password berubah, input tidak tercetak dan mode terminal dipulihkan.
- **3 guard QA lulus** dengan seluruh boundary CLI/network dicegat, tanpa email atau mutasi Cloud.

Bukti: [browser](../../tests/auth-browser-results.json), [guard QA](../../tests/auth-cloud-safety-results.json). Test administratif: npm run test:auth-repair. Laporan 13 Cloud Auth awal dipertahankan sebagai histori, tidak diulang memakai alamat pribadi.

Dokumen resmi menjelaskan [verifier harus berasal dari browser/perangkat yang memulai alur](https://supabase.com/docs/guides/auth/sessions/pkce-flow) dan [batas bawaan dua email per jam per project](https://supabase.com/docs/guides/auth/rate-limits). Tidak ada klaim quota sudah pulih atau inbox asli sudah diuji.
