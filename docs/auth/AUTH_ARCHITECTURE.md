# Phase 2 — Authentication & Authorization

Implementasi 19 November 2026 mempertahankan HTML/CSS/Vanilla JavaScript, hash router, font, foto, dan desain editorial versi 2. Tidak ada framework baru, git push, reset remote atau migrasi schema baru. Database tetap pada 12 migrasi Phase 1. Ringkasan pemeriksaan: [AUTH_TESTING.md](AUTH_TESTING.md).

## Modul dan batas tanggung jawab

| File | Tanggung jawab |
| --- | --- |
| config/runtime.js | Konfigurasi **publik** URL/project dan sb_publishable_; bukan pembaca .env |
| assets/vendor/supabase.js | Bundle UMD SDK resmi **2.99.3**, lisensi MIT disertakan; tidak memerlukan CDN/build |
| js/auth/config.js | Mode, validasi konfigurasi, identifikasi callback dan sanitasi URL |
| js/auth/client.js | Satu client aktif, adapter sessionStorage/localStorage dan preferensi remember |
| js/auth/auth-service.js | Signup, login, resend, recovery, reset, email, password dan logout resmi Supabase |
| js/auth/session.js | Bootstrap sebelum router, getUser, pemuatan identitas, callback SDK dan pembatalan hasil request lama |
| js/auth/profile-service.js | SELECT/UPDATE profil sendiri, whitelist display_name dan phone |
| js/auth/role-service.js | Role database dan relasi agreement untuk hak penghuni |
| js/auth/route-guard.js | Guard UI dan whitelist tujuan setelah login |
| js/auth/errors.js | Pesan aman bahasa Indonesia dan validasi password |
| js/auth/pages.js, events.js | Halaman Auth/profil/workspace, form state dan pemisahan event demo |
| css/auth.css | Desain halaman Auth dan workspace terhubung, responsive 390–1440px |

Versi SDK dipin pada rilis stabil yang mendukung Node 20 di workspace. Rilis terbaru yang diperiksa memerlukan Node 22; aplikasi tidak memigrasikan runtime/framework. npm audit saat pemasangan melaporkan 0 vulnerabilities. Bundle lokal berasal dari paket resmi dan lisensi [supabase-js](https://github.com/supabase/supabase-js/tree/v2.99.3).

## Identitas dan otorisasi

Alur: SDK memulihkan session → **getUser** memverifikasi identitas terhadap Auth → profiles.id = auth.users.id → SELECT user_roles untuk UUID tersebut → guard UI. Tidak ada role dari localStorage, formulir atau user_metadata. Session/role/profile hanya dipasang bersama setelah query selesai; request identitas digabungkan, dan hasil yang tiba setelah logout/pergantian mode diabaikan.

Profil dibuat **hanya oleh trigger database** on_auth_user_created. Frontend tidak membuat/upsert profil, sehingga tidak ada jalur profil ganda atau penentuan UUID bebas. Mutasi profil selalu memperoleh ulang user dari Auth dan hanya mengirim display_name/phone, tanpa role, id, owner_id atau email PostgreSQL.

Pendaftaran mengirim display_name dan signup_intent sebagai metadata informasi. Trigger selalu memberi **prospect**. Pilihan ingin mengelola kos tidak memberi owner. Tenant berasal dari check-in atomik yang sudah tersedia pada Phase 1. [Role management](ROLE_MANAGEMENT.md) menjelaskan proses administratif dan kesinambungan identitas.

Guard merupakan perlindungan UI; setiap akses data tetap memakai JWT pengguna dan **RLS**. Bahkan jika seseorang mengubah JavaScript/hash/mode di browser, JWT tidak menjadi owner/admin. JWT admin aplikasi juga tidak mempunyai EXECUTE server_grant_role atau pencatat payment. Prinsipnya mengikuti [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Session dan callback

Remember tidak dicentang: sessionStorage; dicentang: localStorage. Preferensi penyimpanan bukan otorisasi. SDK mengelola access/refresh token, refresh otomatis, dan signOut(scope: local). Password tidak disimpan aplikasi. Browser harus mengizinkan penyimpanan situs; sessionStorage bertahan saat reload pada tab yang sama, bukan jaminan browser menghapus session ketika fitur restore-tabs digunakan.

Pengecualian untuk verifier PKCE: disimpan pada localStorage origin yang sama dengan expiry satu jam, agar email yang dibuka di tab baru dapat menyelesaikan alur. Ini bukan access/refresh token atau pemberian role. Pergantian remember tidak memindahkan verifier; konsumsi/logout menghapusnya dan adapter menolak verifier kedaluwarsa. Browser/profil/origin lain tetap tidak dapat menukar code tanpa verifier yang benar. Verifier sessionStorage dari build lama dimigrasikan ketika dibaca.

Callback menuju **index.html?auth_flow=...**, tanpa hash route pada redirect URL. Router menunggu bootstrap selesai. PKCE code ditukar melalui exchangeCodeForSession sebelum code dihapus; token_hash diverifikasi lewat verifyOtp. Sesudah keberhasilan/kegagalan diketahui, parameter sensitif dibersihkan dengan history.replaceState dan route #/reset atau workspace baru dipasang. Error tidak mencetak raw callback, token, atau response Auth.

SDK 2.99.3 auto-initialization PKCE kehilangan redirectType pada jalur recovery; implementasi melakukan explicit exchange dan mempertahankan marker recovery hasil SDK. Label auth_flow atau route #/reset sendiri **tidak** membuat sesi recovery. Reset memerlukan identitas terverifikasi dan recovery UID yang sesuai; setelah reset aplikasi logout. Reload halaman reset setelah callback dikonsumsi memerlukan permintaan link baru atau penggantian password dari profil yang sudah login.

PKCE memerlukan browser/perangkat tempat permintaan dimulai. Jangan menimpa verifier dengan memulai beberapa alur sekaligus. Lihat [PKCE resmi](https://supabase.com/docs/guides/auth/sessions/pkce-flow). Tautan implicit lama yang tidak sesuai konfigurasi PKCE ditolak dengan aman; minta tautan baru melalui aplikasi ini.

## Pemisahan Demo dan Connected

Connected adalah default. Auth/profil memakai Supabase; marketplace/detail hanya membaca proyeksi public_listings yang aman. Workspace bisnis memberi state Phase 3, tanpa tabel, saldo, tagihan atau penghuni demo. Preview pemasaran pada homepage tetap berlabel contoh/pratinjau demo, bukan properti akun login.

Masuk Demo membatalkan subscription Auth aplikasi, menghentikan refresh client, melepaskan client aktif dan menghapus identitas dari memori. Session tersimpan dapat dipulihkan saat kembali Connected, tetapi peran demo tidak dipakai. Mutasi NK.update/NK.reset ditolak pada Connected; event bisnis lama juga ditahan. Berpindah mode membersihkan modal/toast agar label admin demo tidak terbawa ke akun nyata.

Mode demo tidak mengirim request backend dari interaksi normal. Penyimpanan demo tetap ngekosaja.demo.v2, session Auth memakai ngekosaja.auth.v3, dan mode ngekosaja.mode.v3. Data lokal lama serta cadangan versi 1 dipertahankan.

## Batas Phase 2

Email/password Auth, verifikasi, recovery, profil, role/guard dan empty states sudah diimplementasikan. Owner onboarding masih administratif; tidak ada self-grant owner/admin. Form perubahan email mengikuti konfirmasi Auth, bukan UPDATE email pada profil. Penggantian password profil memeriksa password lama melalui Auth; ini adalah UX reautentikasi, sedangkan kewenangan update akun ditegakkan oleh session Auth.

Belum ada integrasi bisnis penuh, realtime, Storage/avatar, gateway pembayaran, scheduler, deployment production, UI enrollment/challenge MFA, atau admin role editor. Konfigurasi TOTP Cloud dipertahankan; kebijakan AAL/MFA end-to-end perlu dikaji sebelum akses produksi. Phase 3 dapat melanjutkan adapter bisnis tanpa memakai demo sebagai sumber data akun sungguhan.
