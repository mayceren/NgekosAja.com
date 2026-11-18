# Verifikasi NgekosAja.com 2.0

Pemeriksaan aktual dilakukan **18 November 2026**, zona waktu browser **Asia/Jakarta**, pada Chromium headless melalui Python Playwright. Hasil berikut berasal dari eksekusi di workspace, bukan rencana pengujian.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Syntax seluruh 15 file JavaScript, `node --check` melalui stdin | Lolos |
| `tests/domain.cjs` | **30 skenario regresi lolos** dengan beberapa assertion per skenario |
| `tests/browser_check.py` melalui HTTP lokal | **11 kelompok alur end-to-end lolos** |
| `tests/visual_check.py` melalui HTTP lokal | **360 kombinasi route/viewport lolos**, tanpa overflow horizontal dokumen |
| Viewport route | **1920, 1440, 1280, 1024, 768, 390, 360, 320 px** |
| `tests/upgrade_check.py` | **5 kelompok pemeriksaan tambahan lolos pada HTTP dan `file://`** |
| Error JavaScript / console error pada hasil akhir browser, visual, tambahan | **0** |
| Kegagalan resource pada hasil akhir browser/visual | **0** |
| Screenshot akhir | **21 PNG aktual** pada `screenshots/`, termasuk versi halaman penuh dan mobile |
| Bukti pembayaran print-friendly | Chromium berhasil menghasilkan `screenshots/receipt-demo.pdf` |

## Alur browser lengkap

1. Homepage editorial, font/foto lokal, pencarian lokasi/budget/tipe yang diteruskan ke marketplace.
2. Search, beberapa fasilitas sekaligus, harga, tipe, ketersediaan, chips, empty state, harga global meskipun promosi aktif, grid/list, wishlist per identitas, compare maksimal tiga properti.
3. Detail properti, galeri fullscreen/next, share/copy link, chat calon penghuni dan balasan pemilik, quick reply.
4. Reminder H-3 dan simulasi, notification center/tandai semua, checkout QRIS/E-Wallet, hasil gagal lalu berhasil, admin Rp2.000, pencegahan duplikasi, persistensi setelah reload, bukti/PDF, dan status Lunas yang sama di pemilik.
5. Pemisahan data pemilik, tagihan individual, edit/catatan, reminder manual, pembayaran penghuni, tagihan massal, pembatalan, recurring dan simulasi periode berikutnya, laporan terfilter dan unduh CSV.
6. Keluhan dengan analisis input lokal, penerimaan rekomendasi, lampiran foto, board/tabel, keputusan kategori/prioritas/estimasi/catatan, Diproses/Menunggu Konfirmasi, konfirmasi penghuni dan reopen.
7. Chat penghuni/pemilik, foto lampiran, konteks percakapan, dan unread lokal.
8. Properti tambah/edit/hapus tanpa riwayat/arsip; kamar perbaikan/tersedia; penghuni tambah/edit/pindah/check-out; pelepasan kamar dan histori tetap utuh.
9. Boost gagal/berhasil, kampanye 30 hari, badge/prioritas rekomendasi, dan admin yang memisahkan GMV dari pendapatan platform.
10. Register/login/pemulihan demo, pengaturan profil/notification/density, persistensi per akun, dan pengamanan route sesuai peran.
11. Migrasi v1 dengan salinan source yang identik tetap disimpan, reset terkonfirmasi, menu mobile, dan filter bottom sheet.

Output lengkap: `browser-results.json`.

## Regresi domain

Tiga puluh skenario mencakup:

- Relasi seed, pemilik, kamar, penghuni dan agreement.
- Migrasi versi 1, preservasi ID/edit/pesan/transaksi, status keluhan lama, cadangan sumber, dan idempotensi.
- Penolakan mutasi properti, tenant, invoice, kamar, boost, atau keluhan oleh pemilik lain.
- Pembayaran lintas penghuni, metode palsu, gagal/sukses, admin, Lunas dan pencegahan pembayaran ganda.
- Tanggal tagihan mustahil, nominal negatif, periode ganda, edit/cancel setelah transaksi, dan batch atomik.
- Recurring yang tidak berulang, tidak memundurkan bulan setelah simulasi, serta penghentian saat checkout.
- H-3/hari H/terlambat, deduplikasi notifikasi, dan read state.
- CRUD/arsip properti, foto tidak didukung, penempatan ganda, kapasitas kamar dengan histori, check-in/pindah/check-out.
- Favorit per identitas, compare, filter gabungan, sorting harga/promosi.
- Analisis berbeda sesuai teks, kategori/priority darurat, grup masalah, validasi keluhan/foto, timeline, konfirmasi dan reopen.
- Isolasi percakapan/pesan, unread lokal, dan lampiran.
- Boost/masa berlaku/riwayat, deduplikasi analytics lokal.
- Pemisahan pendapatan sewa/admin, filtering laporan, CSV quoting/formula protection.
- Pendaftaran, profil, preferensi, reload/reset dan atomicity ketika LocalStorage penuh.
- Profil calon penghuni yang menjadi penghuni dengan ID, favorit, dan percakapan yang sama.
- Grafik laporan yang mengikuti rentang tanggal dan properti tanpa memasukkan admin ke pendapatan.

## Pemeriksaan visual dan akses UI

45 route publik/pemilik/penghuni/admin dirender pada delapan lebar layar, total 360 kombinasi. Pemeriksaan tidak hanya membaca source: browser menjalankan script, merender DOM, memuat resource, dan mengukur lebar dokumen. Hero, search, tombol pencarian, serta navbar diperiksa batasnya terhadap viewport.

Pemeriksaan tambahan menggunakan drawer sidebar pada 320 px, lebar/scroll modal, Escape, serta collapse sidebar desktop. Penelusuran screenshot memicu scroll reveal secara nyata sebelum pengambilan halaman penuh. Screenshot diambil dengan animasi diselesaikan agar tampil stabil.

Output matriks: `visual-results.json`. Pengambilan ulang screenshot akhir setelah polish: `screenshot-results.json` (tidak mengulangi matriks; jumlah pemeriksaan route pada file ini memang 0).

## Pemeriksaan tambahan setelah refinemen akhir

`upgrade_check.py` dijalankan melalui HTTP dan pembukaan langsung `index.html`:

1. Daftar sebagai calon penghuni, hubungi pemilik, lalu hubungkan profil terdaftar melalui form check-in pemilik.
2. Favorit dan percakapan tetap tersedia pada identitas penghuni yang sama.
3. Penempatan/pesan tetap tersimpan setelah reload.
4. Grafik pendapatan berubah mengikuti filter properti dan rentang tanggal.
5. CSV laporan mengikuti filter, sedangkan export pada halaman Transaksi berisi seluruh baris akun yang ditampilkan, meskipun laporan sebelumnya difilter.

Output: `upgrade-results.json`.

## Screenshot versi 2

Desktop utama **1440 × 900**:

- `homepage.png`, `marketplace.png`, `property-detail.png`, `login.png`
- `owner-dashboard.png`, `property-management.png`, `room-management.png`, `tenant-management.png`
- `financial-report.png`, `tenant-dashboard.png`, `payment-checkout.png`, `payment-success.png`
- `complaint-management.png`, `complaint-analysis.png`, `chat.png`, `boost-listing.png`, `platform-admin.png`

Tambahan:

- `homepage-full.png`: halaman penuh desktop.
- `mobile-homepage.png`: viewport 390 × 844.
- `mobile-homepage-full.png`: halaman penuh pada 390 px.
- `mobile-tenant-dashboard.png`: viewport 390 × 844.
- `receipt-demo.pdf`: hasil cetak Chromium, berlabel bukti simulasi.

Semua berada di `screenshots/`. Gambar pada `tests/*.png` berasal dari versi 1 dan tidak dijadikan screenshot versi 2.

## Lingkup yang belum diverifikasi langsung

Firefox, Safari, perangkat mobile fisik, pembaca layar, dan kombinasi browser/OS lain belum diuji langsung. Tidak ada klaim audit aksesibilitas penuh. Keyboard focus, Escape, focus trap modal, label, print layout, dan reduced motion diimplementasikan. Pembayaran, autentikasi, AI, notifikasi, serta chat tetap simulasi lokal sesuai ruang lingkup prototype.
