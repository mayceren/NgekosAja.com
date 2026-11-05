# Hasil pemeriksaan NgekosAja.com

Pemeriksaan dijalankan pada **5 November 2026**, zona waktu browser **Asia/Jakarta**, menggunakan Chromium headless melalui Python Playwright. Website sendiri tidak membutuhkan Python atau Playwright.

| Pemeriksaan | Hasil |
| --- | --- |
| Syntax seluruh 10 file JavaScript (`node --check` melalui stdin) | Lolos |
| Aturan bisnis (`tests/domain.cjs`) | 28 pemeriksaan lolos |
| Alur lengkap melalui HTTP `http://127.0.0.1:5500` | 11 kelompok skenario lolos |
| Alur lengkap dengan membuka `index.html` melalui `file://` | 11 kelompok skenario lolos |
| Error JavaScript browser pada kedua pengujian lengkap | 0 |
| Halaman publik dan pemilik pada 1440, 1024, 768, 390, dan 360 px | Tidak ada overflow horizontal dokumen |
| Halaman penghuni pada 1440, 768, 390, dan 360 px | Tidak ada overflow horizontal dokumen |
| Pemeriksaan visual akhir homepage pada 320, 360, 390, 430, 600, 768, 1024, dan 1440 px | Lolos; judul, pencarian, tombol, dan navigasi berada dalam viewport |
| Modal pembayaran pada 320, 360, 390, 768, dan 1440 px | Lolos; tidak ada overflow horizontal modal |
| Semua gambar lokal pada homepage | Berhasil dimuat |

## Alur yang diperiksa di browser

1. Homepage dan pemuatan foto lokal.
2. Marketplace: pencarian, harga, fasilitas, ketersediaan, urutan harga dengan prioritas promosi, dan hasil kosong.
3. Calon penghuni menghubungi pemilik dari detail kos, pemilik membalas, calon penghuni melihat balasan.
4. Reminder H-3, tombol simulasi, bell notifikasi, pembayaran gagal, mencoba kembali, pembayaran berhasil, admin Rp2.000, bukti transaksi, dan persistensi Lunas setelah reload.
5. Pemilik membuat tagihan, penghuni terkait membayar, pemilik melihat Lunas pada tagihan yang sama.
6. Penghuni membuat keluhan dengan foto; pemilik mengubah Diproses/Selesai; penghuni mengonfirmasi.
7. Pesan dari penghuni terlihat pada percakapan pemilik yang sama.
8. Tambah/edit/hapus properti dan penghuni baru; aktif/nonaktif kamar; perubahan kapasitas tersedia akibat penghuni masuk/keluar.
9. Boost Rp30.000 gagal lalu berhasil, riwayat transaksi, badge, dan prioritas listing.
10. Pembatasan route berdasarkan peran dan layout seluruh menu pada ukuran di atas.
11. Reset data demo dan menu navigasi mobile.

## Pemeriksaan aturan bisnis tambahan

Mencakup penolakan pembayaran lintas penghuni dan pembayaran ganda; metode tidak valid; tagihan periode ganda/nominal nol; kamar terisi; kamar ganda; pengurangan kapasitas yang menghapus kamar terisi; penghapusan data dengan riwayat; boost yang masih aktif/kedaluwarsa; laporan terlalu pendek; foto SVG yang tidak didukung; konfirmasi laporan dari penghuni lain; pengiriman pesan ke percakapan pengguna lain; serta kegagalan quota LocalStorage yang tidak boleh memutasi state yang telah tersimpan.

## Screenshot siap dilihat

- `home-1440.png`: beranda pada 1440 × 900.
- `marketplace-1440.png`: pencarian pada 1440 × 900.
- `owner-1440.png`: dashboard pemilik pada 1440 × 900.
- `tenant-1440.png`: dashboard penghuni pada 1440 × 900.
- `payment-1440.png`: modal pembayaran pada 1440 × 900.
- `home-desktop.png`, `owner-desktop.png`, `tenant-desktop.png`: screenshot halaman penuh dengan data awal bersih.
- `home-mobile.png`: beranda penuh pada lebar 390 px.

Screenshot akhir dibuat dengan `python tests/visual_check.py`. Pengujian menggunakan browser context terisolasi dan tidak mengubah data browser presentasi pengguna.

## Lingkup verifikasi

Pengujian otomatis aktual dilakukan pada Chromium. Firefox, Safari, perangkat ponsel fisik, dan teknologi bantu pembaca layar belum diuji secara langsung. Responsif diperiksa dengan viewport browser. Fokus keyboard, focus trap modal, Escape, label input, dan preferensi reduced motion diimplementasikan; tidak ada klaim audit aksesibilitas penuh.
