# Hasil pengujian aktual Phase 2 — 19 November 2026

**Perbaikan penerimaan akun pengguna masih menunggu password yang dipilih pengguna sendiri.** Pengujian Cloud awal memakai alamat pribadi dan meninggalkan password acak; hasil historis tersebut tidak membuktikan pengguna bisa memakai password pendaftaran ulang. [Perbaikan dan langkah tanpa email](AUTH_RECOVERY_FIX.md). Tidak ada reset, git push, penonaktifan RLS atau schema migration tambahan.

| Lapisan | Hasil aktual | Bukti |
| --- | --- | --- |
| Browser Chromium + SDK resmi, HTTP Auth/PostgREST terkontrol | **33 kelompok lulus**, 0 error JavaScript; termasuk PKCE lintas tab, bukan klaim Cloud | [auth-browser-results.json](../../tests/auth-browser-results.json) |
| Pemulihan administratif terbatas | **14 test lulus**, Auth di memori dan terminal terkontrol, tanpa perubahan Cloud | tests/auth-repair.test.mjs; npm run test:auth-repair |
| Guard QA Cloud | **3 test lulus**, semua koneksi dicegat, tanpa email | [auth-cloud-safety-results.json](../../tests/auth-cloud-safety-results.json) |
| Chromium + GoTrue/PostgREST Cloud development nyata | **13 kelompok lulus historis**, tetapi handoff akun pengguna gagal; jangan ulangi pada alamat pribadi | [auth-cloud-results.json](../../tests/auth-cloud-results.json) |
| PostgreSQL native 16.3, adapter Auth, 12 migrasi | **52 kelompok lulus** + postflight; multi-owner/tenant dengan fixture nyata SQL | [database-auth-phase2-results.json](../../tests/database-auth-phase2-results.json) |
| Domain bisnis demo | **30 skenario lulus** | tests/domain.cjs, output terminal |
| Browser bisnis Demo Mode | **11 kelompok lulus**, 0 JS/resource errors | [browser-results.json](../../tests/browser-results.json) |
| Demo upgrade HTTP dan file:// | **2 konteks lulus**, masing-masing 5 kelompok | [upgrade-results.json](../../tests/upgrade-results.json) |
| Audit Cloud read-only + file credential | **Verified**, 12 migrasi tidak berubah, 31 tabel RLS aktif, 45 policy, 0 temuan pola secret | [security-audit-results.json](security-audit-results.json) |
| Callback allowlist | Enam URL lokal applied; hanya satu path konfigurasi berubah | [callback-config-results.json](callback-config-results.json) |
| Kualitas artefak akhir | **43 file syntax-check**, bundle SDK sama dengan paket resmi, konfigurasi publik valid, seluruh referensi dokumen lokal valid, lockfile konsisten, 0 database sementara tersisa | [final-quality-results.json](final-quality-results.json) |

npm audit --omit=dev melaporkan **0 vulnerabilities** pada dependency runtime saat pemeriksaan. Password uji Cloud maupun mock dibuat acak di RAM; tidak ada password akun uji yang ditulis pada tracked files.

## Cakupan browser terkontrol

Form email/password, visibility, consent, allowed intents, password strength/confirmation, invalid credentials, unverified redirect, resend page, signup response, guard anonymous/403, DB role mengalahkan metadata, sessionStorage vs localStorage, reload, profile UPDATE, email confirmation request, current-password check, trusted role redirects untuk owner/tenant/admin, blocking mutasi demo saat Connected, zero backend request saat demo, return-mode identity, logout, callback PKCE recovery, reset dan error URL sanitization lulus.

Viewport **390, 768 dan 1440 px** tidak menghasilkan overflow horizontal. Screenshot aktual tanpa data pribadi: [desktop](../../tests/auth-desktop.png), [mobile](../../tests/auth-mobile.png). File internal .env, supabase/.temp, node_modules dan script administratif ditolak dev server.

## Cakupan Cloud nyata

Pengujian berlangsung pada **ngekosaja-development**, selesai `2026-11-19T02:32:36.905994Z` (**09:32:36 WIB**). Public signup dilakukan melalui form yang sebenarnya; login sebelum verifikasi ditolak GoTrue. Signup token satu kali diverifikasi menggunakan Auth nyata, profil dari trigger dimuat lewat PostgREST, login/reload/profile update berfungsi, dan role tetap prospect meskipun memilih tujuan pemilik atau mengubah metadata menjadi admin.

Empat mutasi ilegal ditolak dengan **42501**: INSERT admin role, RPC server_grant_role oleh pengguna, UPDATE invoice paid, UPDATE UUID profil. Route owner/tenant/admin ditolak. Recovery token nyata membuka reset; password acak baru diterima login, dan logout menghapus identitas aplikasi. API permintaan recovery email terakhir diterima.

Key server QA hanya di memori proses Python, tidak diinjeksi browser, ditulis file, dicetak atau dipakai runtime website. Password acak dan link/token hanya di RAM. Harness lama mengizinkan resume identitas pada marker; perilaku tersebut sudah dihapus. Harness sekarang menolak **semua akun existing**, memblokir email pada marker lama, mensyaratkan opt-in akun disposable baru dan memakai marker ignored .database-test/auth-qa-disposable.json. Akun pengguna tidak boleh lagi dipakai QA. Tidak ada grant owner/admin atau data bisnis yang dibuat.

Admin-generated one-time links dipakai untuk menguji konsumsi token tanpa membaca inbox. **Penerimaan email oleh inbox, klik dari email asli, konfirmasi dua alamat saat email change, dan live account dengan owner/tenant/admin bukan hasil yang diklaim lulus.** Role redirect diuji pada kontrak browser dan SQL multi-identitas. Callback PKCE code diuji SDK/browser terkontrol, termasuk tab baru; Cloud callback token_hash diuji end-to-end secara historis. Email terakhir dari browser QA yang ditutup tidak dapat menjadi handoff. Akun pengguna kini memakai [pemulihan terminal tanpa email](AUTH_SETUP.md), dengan password yang dipilih pengguna sendiri.

## Audit database dan keterbatasan

RLS profiles, user_roles, properties, tenants, rental_agreements, invoices, transactions, complaints, conversations, messages dan notifications diperiksa. Seluruh definisi tabel/kolom/constraint/index/policy/function/trigger/view/ACL dibandingkan dengan snapshot Phase 1 yang sudah applied dan cocok. SHA-256 12 file migrasi tidak berubah. Audit sesudah QA menunjukkan Auth/profil **1**, fasilitas **7**, data bisnis **0**; keadaan Phase 1 sebelum QA tetap tersimpan historis pada dokumen database.

SQL tests menjalankan role anon/authenticated/service_role dengan UUID fixture berbeda: owner A tidak membaca/mengubah data owner B; tenant A tidak melihat profil/invoice/room/keluhan/chat/notifikasi tenant B; metadata signup tidak memberi admin; payment/grant RPC tidak tersedia untuk JWT pengguna/admin aplikasi; PK/FK/constraints dan uji konkurensi tetap lulus. Adapter Auth lokal bukan GoTrue, sedangkan tes Cloud di atas memakai GoTrue/JWT/PostgREST nyata.

Custom SMTP, inbox delivery, MFA enrollment/challenge UI, upload/avatar Storage, production hardening/deployment, business adapter penuh, realtime, pembayaran nyata dan scheduler belum dikerjakan. Email bawaan Supabase memiliki pembatasan penerima dan quota rendah; perhatikan [AUTH_SETUP.md](AUTH_SETUP.md). Tidak ada perubahan password user existing lain.

## Reproduksi

Dengan npm run dev aktif:

```powershell
python tests/auth_browser.py
python tests/browser_check.py
python tests/upgrade_check.py
npm run test:frontend
node scripts/auth-audit.mjs
```

Jika cluster PostgreSQL test lokal aktif:

```powershell
npm run db:test -- --native --postflight --output=tests/database-auth-phase2-results.json
```

**Jangan mengulang Cloud QA pada alamat pribadi.** Harness memerlukan NGEKOSAJA_QA_DISPOSABLE_ACCOUNT=yes dan NGEKOSAJA_TEST_EMAIL untuk identitas disposable yang belum terdaftar, CLI development dan persetujuan pengujian akun disposable tersebut. Semua akun existing dan alamat QA lama ditolak; tidak ada resume atau recovery email penutup. Uji browser terkontrol/guard offline cukup untuk regresi ini dan tidak memakai quota email. Jalankan npm run test:auth-repair serta python tests/auth_cloud_safety.py untuk pemeriksaan tambahan tanpa Cloud.
