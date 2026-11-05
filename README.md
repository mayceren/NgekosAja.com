# NgekosAja.com

**Cari Kos, Bayar Sewa, Kelola Semua dalam Satu Tempat.**

Prototype Business Model Lean Canvas (BMLC), Milestone 2 mata kuliah Technopreneurship. Seluruh konten dan identitas merupakan data demo.

## Menjalankan website

Tidak perlu instalasi npm, build, API key, backend, atau database.

1. Buka folder project ini di VS Code.
2. Klik kanan `index.html` → **Open with Live Server**.
3. Alternatif: klik dua kali `index.html` untuk membukanya langsung di Chrome/Edge/Firefox. Aplikasi memakai script klasik dan navigasi hash sehingga mendukung `file://`.
4. Alternatif terminal jika Python tersedia: `python -m http.server 5500`, lalu buka `http://localhost:5500`.

Foto dan ikon tersimpan lokal; aplikasi tidak perlu internet. Font memakai Plus Jakarta Sans/Inter jika sudah terpasang, lalu Segoe UI/Arial sebagai fallback. Tidak ada font dari CDN.

**Live Server direkomendasikan untuk presentasi** agar alamat asal LocalStorage konsisten. Data pada `file://`, `localhost`, `127.0.0.1`, dan port yang berbeda berada di ruang penyimpanan browser yang berbeda.

## Fitur yang diimplementasikan

- Homepage lengkap: pencarian, rekomendasi, keunggulan, cara kerja, CTA pemilik, halaman Fitur dan Tentang, footer.
- Marketplace: delapan listing di Tanjung Duren, Grogol, Tomang, Kebon Jeruk, dan Palmerah; pencarian nama/lokasi, rentang harga, fasilitas, tipe kos, ketersediaan, sorting, prioritas promosi, dan empty state.
- Detail kos: galeri, alamat, harga, fasilitas, ukuran, deskripsi, ketersediaan kamar, profil pengelola, dan pembuka percakapan. Foto galeri pendukung diberi label ilustrasi.
- Dashboard pemilik: statistik dari state, grafik pendapatan enam bulan dari transaksi berhasil, aktivitas, transaksi terbaru, dan tagihan tertunda.
- Properti: tambah, edit, hapus, serta aktif/nonaktif kamar kosong. Perubahan terlihat pada marketplace.
- Penghuni: tambah, edit kontak, pindah kamar, dan hapus data tanpa riwayat. Penempatan kamar langsung mengubah ketersediaan.
- Tagihan: dibuat pemilik untuk penghuni tertentu, nominal, periode, dan tanggal jatuh tempo; pencegahan periode ganda.
- Pembayaran: rincian sewa + admin Rp2.000, pilihan VA BCA/QRIS/Bank Mandiri, simulasi gagal/berhasil, bukti, riwayat, dan status Lunas yang sama pada kedua dashboard.
- Reminder: pemeriksaan tagihan belum lunas dengan jatuh tempo H-3 sampai hari H; tagihan terlambat mendapat peringatan tersendiri. Bell notifikasi, pengingat manual dari pemilik, dan tombol Simulasikan Reminder tersedia. Simulasi reminder hanya membuat notifikasi contoh, tanpa mengubah tagihan.
- Keluhan: tiga contoh awal, formulir, unggah foto JPG/PNG/WebP maksimal 1 MB, status Menunggu/Diproses/Selesai, progres, filter, dan konfirmasi penyelesaian oleh penghuni.
- Pesan: percakapan per properti/pengguna, kirim dari penghuni/calon penghuni dan balas dari pemilik, timestamp, serta persistensi lokal.
- Boost: simulasi gagal/berhasil Rp30.000 per properti untuk 30 hari, riwayat transaksi, badge Promosi, kedaluwarsa berdasarkan tanggal, dan prioritas marketplace.
- Pergantian peran, pemilihan lima penghuni demo, indikator peran, pembatasan route/tindakan sesuai peran, dan Reset Data Demo dengan konfirmasi.
- Layout responsif, modal dengan fokus keyboard dan Escape, toast, validasi form, status, dan empty state.

## Skenario demo utama

### Pembayaran sewa

1. Klik **Coba Demo → Penghuni → Andi Pratama**. Data awal Andi memiliki tagihan jatuh tempo dua hari setelah data demo dibuat.
2. Lihat reminder dan klik **Bayar Sekarang** atau buka **Tagihan Sewa**.
3. Periksa nominal dan admin Rp2.000, lalu pilih metode.
4. Klik **Simulasikan Gagal**: tagihan tetap belum lunas; percobaan tercatat sebagai Gagal.
5. Klik **Coba Lagi → Simulasikan Berhasil**: tagihan menjadi Lunas, riwayat dan bukti tersedia.
6. Klik **Ganti Peran Demo → Pemilik Kos → Pembayaran**. Tagihan Andi sudah Lunas dan transaksi muncul di dashboard/grafik.
7. Untuk membuat tagihan sendiri, klik **Buat Tagihan** dari peran pemilik. Pilih penghuni dan gunakan periode berbeda dari yang sudah ada, misalnya `Sewa tambahan November 2026`. Kembali ke penghuni yang dipilih untuk membayarnya.

### Keluhan dan chat

1. Sebagai penghuni, buka **Laporan Keluhan → Buat Laporan**. Tambahkan foto bila diperlukan.
2. Ganti ke pemilik, buka **Keluhan**, ubah status menjadi Diproses lalu Selesai.
3. Kembali ke penghuni dan klik **Konfirmasi Selesai** pada laporan tersebut.
4. Buka **Pesan**, kirim pesan, lalu ganti peran untuk membalas. Tidak ada balasan otomatis yang menyamar sebagai pemilik.
5. Calon penghuni dapat memulai chat melalui **Cari Kos → Lihat Detail → Hubungi Pemilik**.

### Promosi dan ketersediaan

1. Pemilik → **Boost Listing** → pilih listing tanpa promosi.
2. Simulasikan pembayaran berhasil Rp30.000. Listing kini mendapat badge dan prioritas hasil pencarian.
3. Saat sorting harga, listing promosi tetap berada pada kelompok pertama; harga diurutkan dalam masing-masing kelompok promosi/nonpromosi.
4. Pemilik → **Kelola Properti → Atur Kamar**. Klik kamar kosong untuk menonaktifkan/mengaktifkan penawaran; periksa jumlah kamar di marketplace.

## Data dan konsistensi

State tunggal berada pada key **`ngekosaja.demo.v1`** di LocalStorage:

| Data | Hubungan |
| --- | --- |
| Properti dan kamar | Kamar memiliki ID unik; ketersediaan dihitung dari status aktif dan penempatan penghuni |
| Penghuni | Mengacu pada ID properti dan kamar |
| Tagihan | Mengacu pada penghuni dan properti pada saat tagihan dibuat |
| Transaksi sewa | Mengacu pada tagihan; pembayaran berhasil hanya boleh terjadi sekali per tagihan |
| Keluhan | Mengacu pada penghuni dan properti pada saat dilaporkan |
| Percakapan | Mengacu pada properti dan identitas peserta demo |
| Promosi | Tanggal aktif pada properti dan transaksi promosi pada riwayat |

Data awal: 8 properti, 53 kamar, 5 penghuni, 30 tagihan selama 6 bulan, transaksi berhasil historis, 3 keluhan, satu percakapan, dan satu promosi aktif. Enam kamar properti Tomang Urban Stay dinonaktifkan sementara untuk mendemonstrasikan listing tanpa kamar tersedia; kamar tersebut tidak dihitung sebagai kamar terisi. Data awal diberi tanggal relatif saat pertama dibuat/reset. Data tersimpan tidak diubah otomatis saat dibuka esok hari; reminder, keterlambatan, dan berakhirnya promosi tetap dihitung berdasarkan tanggal saat itu.

Properti/penghuni yang memiliki riwayat relevan tidak dapat dihapus agar referensi transaksi/laporan tetap utuh. Untuk memperagakan hapus, tambahkan properti atau penghuni baru tanpa riwayat, kemudian hapus. Kamar terisi tidak dapat dinonaktifkan; pindahkan/edit penghuni terlebih dahulu. Pengurangan kapasitas properti tidak boleh menghapus kamar yang masih ditempati.

Klik **Reset Data Demo** pada footer atau sidebar untuk memulai presentasi dari data awal dan tanggal terbaru. Reset menghapus semua perubahan lokal setelah dikonfirmasi. Penyimpanan penuh menampilkan pesan kegagalan dan mempertahankan state sebelumnya. Jika LocalStorage tidak tersedia sejak awal, aplikasi menampilkan peringatan dan berjalan dengan state sementara.

## Batas simulasi

- Masuk/Daftar membuka pemilih peran demo; tidak ada akun, kata sandi, atau autentikasi sungguhan. Pembatasan peran hanya untuk demonstrasi UI, bukan keamanan produksi.
- Pembayaran sewa dan boost tidak memindahkan uang atau menghubungi bank/QRIS. Riwayat gagal menampilkan nominal percobaan, bukan biaya yang ditarik.
- Reminder ditampilkan di dalam aplikasi; tidak ada scheduler server, WhatsApp, push notification, atau email.
- Chat bukan realtime lintas perangkat. Pergantian peran pada browser yang sama menggunakan percakapan yang sama; tab dengan origin sama memuat ulang ketika LocalStorage berubah.
- Data tidak dikirim ke server. Jangan memasukkan informasi sensitif; ini merupakan prototype pembelajaran.
- Tidak ada pemesanan otomatis, peta eksternal, atau payment gateway.

## Struktur project

```text
NgekosAja/
├── index.html
├── css/
│   ├── style.css          # Design system dan halaman publik
│   ├── components.css     # Dashboard, form, tabel, modal, chat
│   └── responsive.css     # Desktop, tablet, smartphone
├── js/
│   ├── data.js            # Seed dan utilitas tanggal
│   ├── storage.js         # State tunggal dan aturan bisnis
│   ├── ui.js              # Ikon SVG dan komponen bersama
│   ├── marketplace.js     # Homepage, pencarian, detail, informasi
│   ├── owner.js           # Workspace pemilik dan formulir pengelolaan
│   ├── tenant.js          # Dashboard penghuni dan notifikasi
│   ├── payments.js        # Modal pembayaran, hasil, bukti
│   ├── complaints.js      # Laporan dan pelacakan
│   ├── chat.js            # Percakapan dua arah
│   └── app.js             # Router, event, dan inisialisasi
├── assets/
│   ├── images/           # 8 foto interior lokal
│   ├── icons/logo.svg
│   └── CREDITS.md
├── tests/                # Skrip pengujian dan hasil screenshot
└── README.md
```

## Pengujian

Website tidak membutuhkan tooling test untuk digunakan. Untuk menjalankan ulang pengujian pengembangan, gunakan Python dengan Playwright dan Chromium yang terpasang:

```powershell
python tests/browser_check.py --url http://127.0.0.1:5500
# Atau periksa pembukaan file secara langsung:
python tests/browser_check.py
```

Skrip menggunakan browser context baru dan membersihkan LocalStorage miliknya sendiri. Mencakup pencarian/filter, dua arah chat, pembayaran gagal/berhasil/admin/bukti/reload, tagihan pemilik ke penghuni, foto keluhan dan status, CRUD properti/penghuni, ketersediaan kamar, boost, proteksi peran, reset, dan pengecekan overflow halaman publik/dashboard pada lebar 360–1440 px. Screenshot otomatis ditulis ke `tests/`.

Untuk pemeriksaan aturan bisnis dengan Node tanpa dependensi:

```powershell
Get-Content -Raw tests/domain.cjs | node --input-type=commonjs
```

Hasil pemeriksaan aktual dicatat dalam `tests/VERIFICATION.md`.
