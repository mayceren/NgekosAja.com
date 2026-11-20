# Lifecycle simulasi internal

1. Checkout membaca invoice/agreement atau properti dengan akses pengguna.
2. Pengguna memilih QRIS, Virtual Account, Transfer Bank atau E-Wallet ilustratif.
3. Konfirmasi mengirim resource ID, metode enum dan UUID idempotency. Tidak mengirim nominal/owner/payer/status.
4. Edge memverifikasi identitas, target development, marker administratif dan hak akses.
5. RPC mengunci request key lalu resource. Nominal diambil dari DB; attempt pending, transaksi, invoice paid/campaign 30 hari, notifikasi dan attempt succeeded dicatat dalam satu transaksi PostgreSQL.
6. Hanya setelah commit, respons berisi transaction_id dan completed_at. UI membaca data tersimpan untuk menampilkan “Pembayaran Simulasi Berhasil”.
7. Receipt dan dashboard dapat dibuka kembali setelah reload.

Tidak ada timer pemrosesan bank, OTP, webhook atau konfirmasi manual. Pending hanya merupakan tahap internal transaksi DB dan tidak terlihat sebagai settlement yang belum selesai setelah commit. Jika satu langkah gagal, seluruh pencatatan di-rollback. Kegagalan HTTP setelah commit mungkin ambigu; muat ulang checkout atau ulangi request dengan key yang sama untuk memperoleh transaksi existing.

Key idempotency memakai UUID acak. Frontend menyimpan hanya UUID retry scoped di sessionStorage; tidak menyimpan secret, token pembayaran, nominal atau hasil sukses. Logout menghapus key tersebut. Lock dan unique index tetap melindungi dua tab dengan key berbeda.

Retry key sama harus mempunyai payer/kind/resource/metode yang sama; payload berbeda ditolak. Invoice yang sudah dibayar simulator mengembalikan transaksi existing kepada payer yang sama. Invoice paid dari sumber lain dan invoice cancelled tidak dapat dibayar. Boost existing dari simulator yang masih aktif mengembalikan pembelian existing; campaign lain yang aktif/terjadwal menolak pembelian. Perpanjangan setelah campaign berakhir menggunakan key baru.

Semua attempt dan transaksi simulator menggunakan is_simulation=true. Riwayat sukses tidak dapat diedit/dihapus. Fee sewa Rp2.000; Boost Rp30.000 dengan interval tepat 30 hari. Pembelian hanya untuk properti published milik owner yang sah.

payment_accounting memisahkan simulation dan non_simulation: rent_gmv tidak termasuk fee; admin_fees dihitung terpisah; platform_revenue adalah fee sewa + Boost. UI mengganti kartu/grafik nominal gabungan dan ekspor lama dengan ringkasan kategori terpisah. Tidak ada klaim dana diterima atau pendapatan produksi. Perubahan invoice/occupancy tetap mengikuti aturan bisnis existing.
