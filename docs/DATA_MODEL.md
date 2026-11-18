# Model data dan definisi metrik

## Penyimpanan dan migrasi

`data.js` mempertahankan seed dasar dan utilitas versi awal. `schema.js` memperluasnya untuk instalasi baru dan memigrasikan state lama secara aditif. `storage.js` memiliki satu state aktif pada `ngekosaja.demo.v2`. Key `ngekosaja.demo.v1` hanya dibaca dan dipertahankan sebagai cadangan, termasuk setelah reset versi 2.

Migrasi mempertahankan ID dan perubahan pengguna. Properti lama tanpa `ownerId` diatribusikan ke `o1`, pemilik tunggal versi 1. ID properti/tenant/invoice/transaksi lama tidak diganti. Penghuni mendapat agreement awal yang merepresentasikan masa sewa lama. Keluhan lama `Selesai` tanpa konfirmasi menjadi `Menunggu Konfirmasi`; laporan yang sudah dikonfirmasi tetap Selesai. Pengirim pesan `owner` menjadi ownerId properti. Migrasi dapat dijalankan kembali tanpa menambah properti/agreements/kampanye yang sama.

## Relasi

| Entitas | Identitas / relasi |
| --- | --- |
| owners, users | ID identitas demo yang stabil; profil pemilik/penghuni mempunyai cermin pada users |
| properties | ownerId, gambar/galeri, harga dasar, peraturan, arsip, boostUntil |
| rooms | ID unik tersarang di properti; ownerId, nomor, tipe, harga, fasilitas, status dasar |
| tenants | Profil dan penempatan terkini; propertyId, roomId, ownerId, leaseStatus, tanggal, harga, hari pembayaran |
| agreements | Riwayat perjanjian; tenantId, propertyId, roomId, ownerId, nominal, tanggal, Aktif/Pindah/Check-out |
| invoices | tenantId, propertyId, ownerId, agreementId bila tersedia, periode, nominal, jatuh tempo, catatan, status |
| transactions | Nomor unik, invoiceId untuk sewa, propertyId, ownerId, tenantId, kind rent/boost, amount, fee, metode, tanggal, hasil |
| complaints | tenantId, propertyId, roomId, ownerId, kategori, prioritas, urgensi, foto, estimasi, status, history dan notes |
| conversations | propertyId, ownerId, participantId, messages dan readBy per identitas |
| notifications | userId, key deduplikasi, invoiceId bila terkait, judul, pesan, link, tanggal, read |
| favorites/recentSearches/settings | Dipisahkan berdasarkan ID identitas demo |
| campaigns | propertyId, ownerId, startDate, endDate, transactionId bila dibeli pada versi 2 |
| analytics | propertyId, ownerId, actorId, session, tanggal, kind views/details/contacts |
| recurring | tenantId, propertyId, ownerId, nominal, hari, bulan mulai/terakhir, aktif |
| activities | Owner, aktor, waktu dan uraian perubahan |

Status kamar **Terisi** dihitung dari penghuni dengan leaseStatus Aktif. Ketersediaan membutuhkan status dasar Tersedia, tidak ditempati, dan properti tidak diarsipkan. Karena itu check-out melepaskan penghuni tanpa menimpa status perbaikan/nonaktif kamar.

Pindah kamar menutup agreement lama sebagai Pindah dan membuat yang baru. Perubahan harga tidak menulis ulang invoice/transaksi historis. Pembatasan ownerId divalidasi pada fungsi bisnis, bukan hanya tampilan. Ini tetap simulasi frontend, bukan otorisasi server produksi.

## Keuangan

- **Pendapatan pemilik:** jumlah `amount` transaksi `kind=rent`, `status=Berhasil`, milik pemilik aktif. Tidak mencakup admin atau boost.
- **Pendapatan bulan ini:** kriteria yang sama dengan bulan kalender pembayaran sama dengan bulan saat aplikasi dibuka.
- **Outstanding:** jumlah nominal tagihan yang belum Lunas dan belum Dibatalkan.
- **Overdue:** bagian outstanding dengan tanggal jatuh tempo sebelum hari ini. Termasuk dalam outstanding, bukan tambahan terpisah.
- **Collection rate:** jumlah invoice Lunas / seluruh invoice yang tidak Dibatalkan, berdasarkan properti dan tanggal jatuh tempo yang dipilih. Menggunakan jumlah tagihan, bukan rasio nominal.
- **Report dates:** rentang tanggal inklusif; invoice berdasarkan dueDate, transaksi berdasarkan tanggal pembayaran. Grafik mengikuti properti/rentang yang dipilih, maksimal 24 periode terakhir pada rentang panjang.
- **GMV platform:** nominal sewa berhasil seluruh pemilik, tidak termasuk admin/boost; bukan pendapatan platform.
- **Admin fee revenue:** fee transaksi sewa Berhasil; Rp2.000 per transaksi. Gagal tidak menambah revenue.
- **Boost revenue:** amount transaksi boost Berhasil; Rp30.000 per pembelian demo. Kampanye bawaan tidak dianggap pembelian berbayar jika tidak mempunyai transaksi.
- **Total platform revenue:** admin fee revenue + boost revenue.
- **Akun terdaftar:** jumlah identitas contoh pada users; bukan klaim pengguna aktif nyata.
- **Occupancy:** penghuni Aktif / total kamar pada portofolio pilihan, termasuk kamar nonaktif pada denominator. Kamar arsip/nonaktif tidak dianggap tersedia.
- **Keluhan selesai:** status Selesai dan confirmed=true.

Admin menampilkan metrik kumulatif sejak data demo dibuat, kecuali grafik bulanan. Periode dan aturan ditulis pada UI. Export CSV dibatasi akun pemilik, mengutip field, dan melindungi nilai teks yang menyerupai formula spreadsheet. Export dari Laporan mengikuti filter; export dari halaman Transaksi mencakup seluruh transaksi akun yang ditampilkan.

## Reminder dan jadwal

Reminder H-3 dibuat pada pemeriksaan pertama ketika tagihan masuk jendela tiga hari sebelum jatuh tempo. Hari H dan terlambat mempunyai key tahap berbeda. Setiap kombinasi invoice/tahap/penerima hanya dibuat sekali. Reminder manual dideduplikasi per invoice/hari. Notifikasi lama tetap ada sebagai riwayat dan ditandai dibaca saat pembayaran berhasil/pembatalan; reminder aktif tidak lagi menampilkan tagihan final.

Jadwal bulanan diperiksa saat startup dan simulasi eksplisit. Periode yang sudah dihasilkan tidak dibuat ulang, tanggal dibatasi 1–28, dan jadwal berhenti saat check-out. Tidak ada proses server atau scheduler ketika aplikasi ditutup.

## Analytics dan analisis keluhan

Views dicatat melalui IntersectionObserver ketika minimal 35% card terlihat. Detail dicatat ketika halaman detail dibuka; contact ketika tombol hubungi membuat/membuka percakapan. Kombinasi properti, jenis aksi, identitas, sesi, dan hari dideduplikasi untuk menghindari kenaikan dari render ulang. Angka kumulatif lokal bukan unique visitors lintas perangkat, conversion rate, atau klaim hasil promosi.

Analisis keluhan mencocokkan kata kunci kategori dan urgensi, menggunakan ringkasan dari teks pengguna, serta menghitung laporan kategori sama dalam scope akun. Foto tidak dianalisis. Rekomendasi harus diterapkan/disimpan pengguna. Darurat tidak menunggu keputusan aplikasi: panel menyarankan menjauh dari bahaya dan segera menghubungi pihak terkait.
