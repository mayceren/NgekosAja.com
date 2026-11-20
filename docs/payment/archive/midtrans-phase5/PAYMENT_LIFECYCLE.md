# Lifecycle, idempotency, dan akuntansi

Order menggunakan `NK-SB-` ditambah UUID tanpa separator. Database mengunci resource sebelum reserve/apply. Partial unique index membatasi satu creating/pending per invoice atau properti Boost; status review memblokir reserve berikutnya melalui RPC. Dua tab mendapatkan order yang sama. Harga, payer, invoice/property dan environment ditentukan server.

State utama: creating → pending → succeeded, denied, cancelled, expired atau failed. Review mencatat konflik, bukan settlement sukses. Refunded/partial_refund menandai transaksi historis untuk peninjauan. Semua attempt dipertahankan. Invoice yang paid/cancelled tidak menerima order baru; Boost aktif/terjadwal menolak pembelian baru.

| Status gateway | Perlakuan |
| --- | --- |
| pending | Tidak mencatat success/failure ledger |
| settlement | Sukses setelah semua kecocokan lolos; fraud selain accept masuk review |
| capture | Sewa sukses hanya jika fraud_status=accept; deny menjadi ditolak, challenge menunggu; Boost tetap menunggu settlement |
| deny/cancel/expire/failure | Final gagal, histori dipertahankan, tidak menghasilkan pendapatan |
| refund/partial_refund | Tidak membuat pembayaran sukses baru; menandai review refund tanpa mengubah ledger immutable |

Event hash mencakup order, gateway transaction ID, nominal, status, fraud, metode dan refund amount yang dinormalisasi dari respons Get Status. Pending dan settlement memiliki hash berbeda; tidak memakai satu key ledger untuk dua final payload berbeda. Duplicate webhook hanya mengembalikan hasil existing. Pending/expiry terlambat tidak menurunkan sukses. Dua settlement dari attempt berbeda menghasilkan satu success invoice; attempt yang berbenturan masuk review. Unique success invoice dan idempotency ledger existing tetap berlaku.

Lease Snap berdurasi 90 detik dengan maksimum lima klaim. Token existing dipakai ulang. API timeout/duplicate order tidak langsung dianggap gagal: server mencoba Get Status untuk order **yang sama**, mempertahankan attempt jika outcome tidak pasti. Jika order terbukti pending tetapi token hilang sebelum tersimpan, UI hanya dapat memeriksa status; jangan membuat order baru berdasarkan tebakan. Tunggu expiry yang dikonfirmasi gateway atau pemeriksaan administratif. Tidak ada auto-cancel/refund di Phase 5.

Expiry request ditetapkan 24 jam dari created_at, dengan zona waktu eksplisit. Deadline lokal hanya membatasi pembukaan token; tidak boleh otomatis melunasi, membuat final failed, atau membebaskan order yang outcome-nya belum diketahui. [Semantik expiry Snap](https://docs.midtrans.com/reference/expire-a-snap-session) membedakan umur halaman dan metode pembayaran; Get Status tetap menentukan status akhir.

Invoice amount/due/status cancellation dibekukan selama creating/pending/review; publication properti Boost juga dibekukan saat payment aktif. Status paid hanya berubah melalui transaksi server. Notifikasi server, invoice dan publication memperbarui dashboard setelah commit. Manual Periksa status menjadi fallback ketika Realtime terputus; ada throttle server 15 detik.

Semua pencatatan gateway ini memakai is_simulation=true. Laporan development existing diberi label bahwa angkanya merupakan gross ledger gabungan, bukan pendapatan produksi. Panel payment_accounting memisahkan Sandbox dan nonsimulasi historis: GMV sewa tidak mencakup biaya admin; platform revenue adalah fee sewa + Boost. Pending/failed tidak menambah pendapatan. Kasus refund ditampilkan terpisah sebagai review; angka gross bukan net cash setelah refund. Tidak ada otomatisasi koreksi/refund atau uang produksi.
