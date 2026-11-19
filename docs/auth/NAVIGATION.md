# Navigasi akun

Perubahan ini hanya menyentuh frontend dan pengujian. Tidak mengubah schema, role, akun Cloud atau mengirim email pengujian.

- Sebelum login, Coba Demo tetap tersedia pada halaman publik dan autentikasi.
- Setelah login, semua aksi masuk ke demo disembunyikan. Logout membuatnya tersedia kembali.
- Login yang berhasil selalu menuju home #/, untuk calon penghuni, penghuni, pemilik maupun administrator. URL privat sebelumnya tidak dijadikan tujuan login.
- Sesi yang dipulihkan saat refresh tetap mempertahankan halaman aktif. Pengguna yang sudah login membuka login/register diarahkan ke home.
- Verifikasi email yang menghasilkan sesi menuju home; tautan pemulihan yang valid tetap menuju formulir reset.
- Calon penghuni tidak melihat tombol Workspace atau Dashboard; URL workspace lama kembali ke home. Menu Dashboard hanya muncul pada navigasi untuk pemilik, penghuni dengan penempatan sah, atau admin sesuai role database.

| Menu pengaturan | Rute | Isi |
| --- | --- | --- |
| Informasi Pribadi | #/account/profile | Nama dan nomor kontak |
| Alamat Email | #/account/email | Perubahan email melalui konfirmasi Auth |
| Kata Sandi | #/account/security | Password saat ini, password baru dan konfirmasi |
| Hak Akses | #/account/access | Role akun, status akses dan muat ulang akses |

#/account tetap membuka Informasi Pribadi. **Navbar utama tetap tampil pada semua halaman pengaturan akun**, dengan Beranda, Cari Kos, Fitur dan Tentang seperti pada home. Pengguna dapat berpindah halaman langsung; menu ponsel dan navbar saat scroll tetap tersedia. Sidebar akun hanya memuat pengaturan, tersusun rapat pada desktop dan dua kolom pada ponsel. Menu aktif ditandai aria-current. Label teknis Connected Mode dihapus dari antarmuka; pemisahan akun dan demo tetap berjalan di internal aplikasi.

Kartu identitas berulang (avatar, nama, email, role dan tombol keluar) dihapus dari keempat menu. Setiap halaman langsung menampilkan formulir atau informasi yang dipilih. Identitas ringkas tersedia pada navbar; informasi peran tetap pada Hak Akses. Formulir menggunakan satu kolom dengan lebar yang nyaman dibaca.

Tombol **Keluar dari Akun** berada paling bawah menu profil, setelah Hak Akses, dan tidak tampil di navbar. Tombol membuka dialog **Yakin ingin keluar?** dengan pilihan Batal dan Ya, keluar. Permintaan logout hanya dikirim setelah konfirmasi. Batal, ikon tutup, Escape dan klik latar dialog mempertahankan sesi. Setelah konfirmasi berhasil, modal ditutup dan pengguna menuju halaman masuk.

Pengujian Chromium dengan SDK resmi dan boundary Supabase simulasi: **51 kelompok lulus, 0 error JavaScript**, termasuk signup dengan session langsung maupun tanpa session, duplicate email, quota recovery, PKCE lintas tab, redirect login semua role ke home, URL privat sebelum login, pemisahan form, penghapusan kartu identitas di semua menu, tombol keluar paling bawah menu, konfirmasi dan pembatalan logout tanpa permintaan Auth, dashboard sesuai peran, ketiadaan aksi demo setelah login, demo tersedia setelah logout, ketiadaan label mode, navbar akun dan menu ponsel, navbar saat scroll, serta layout dan modal pada 390/768/1440 px. Tidak ada permintaan email ke Cloud. [Laporan](../../tests/auth-browser-results.json).

Tangkapan layar memakai identitas mock, bukan data akun pengguna: [desktop](../../tests/account-desktop.png), [tablet](../../tests/account-tablet.png), [ponsel](../../tests/account-mobile.png).
