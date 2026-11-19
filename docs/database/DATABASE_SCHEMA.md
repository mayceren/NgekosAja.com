# NgekosAja 3.0 — Phase 1 Database Foundation

Fondasi database terpisah dari frontend versi 2. `index.html`, CSS, JavaScript, navigasi hash, dan LocalStorage tidak diintegrasikan atau diubah pada Phase 1. Setelah persetujuan pengguna, **12 migrasi** dan seed master telah diterapkan ke Supabase development; hasil terkini tersedia di [PHASE1_COMPLETION.md](PHASE1_COMPLETION.md). Tidak ada git push atau reset remote.

Skema aktual terdiri dari **31 tabel aplikasi**, **236 kolom**, **48 foreign key**, **45 policy RLS**, satu view security-invoker, dan 24 fungsi public dengan izin EXECUTE eksplisit. Inventaris mesin: [schema-catalogue.json](schema-catalogue.json). Rincian kolom, constraint dan index: [DATA_DICTIONARY.md](DATA_DICTIONARY.md). Diagram seluruh relasi: [ERD.md](ERD.md).

## Tabel yang dibuat

| Kelompok | Tabel |
| --- | --- |
| Identitas | profiles, user_roles, user_settings |
| Listing dan kamar | properties, property_images, property_rules, property_landmarks, facilities, property_facilities, rooms, room_facilities |
| Penyewaan | tenants, rental_agreements |
| Keuangan | invoices, recurring_invoices, transactions |
| Keluhan | complaints, complaint_histories, complaint_attachments, complaint_notes, complaint_analyses |
| Percakapan | conversations, conversation_members, messages, message_attachments |
| Data personal | notifications, favorites, recent_searches |
| Promosi dan pemantauan | boost_campaigns, listing_analytics, activity_logs |

`auth.users` milik Supabase dan tidak dibuat oleh migrasi aplikasi. `profiles.id` dan `tenants.id` menggunakan UUID Auth yang sama. Peran berada di user_roles dengan UNIQUE(user_id, role), sehingga prospect bisa menjadi tenant tanpa akun baru. Trigger signup mengabaikan role dari metadata dan hanya memberi prospect. Owner/admin diberikan server terotorisasi, bukan formulir registrasi.

## Penyesuaian model versi 2

- Objek rooms/facilities/photos/rules/nearby tersarang menjadi tabel terpisah. Fasilitas memakai relasi many-to-many.
- ownerId/propertyId/tenantId tidak disalin berulang ke setiap turunan: invoice → agreement → room → property → owner. Ini menghindari tagihan menunjuk tenant dan owner yang berbeda. Snapshot nama properti, nama penghuni, nomor kamar, nominal, dan biaya pada dokumen keuangan sengaja dipertahankan untuk histori.
- tenants hanya menyatakan identitas penghuni. Penempatan terkini dihitung dari agreement active; check-out/pindah menutup agreement lama dan membuat record baru bila perlu.
- Semua identitas record UUID. Nominal bigint rupiah; penjumlahan laporan memakai numeric untuk menghindari overflow agregat, tanpa floating-point.
- Periode invoice menjadi date hari pertama bulan. Label bebas versi 2 dipisahkan dari identitas periode; catatan masuk notes. UNIQUE(agreement_id, period_start) tetap berlaku untuk tagihan dibatalkan. Tagihan yang dibatalkan tidak dibuat ulang dengan identitas bulan sama pada Phase 1.
- Terlambat merupakan status turunan, bukan pembaruan massal harian. View invoice_statuses menambahkan effective_status dengan tetap tunduk pada RLS.
- boostUntil tidak disalin ke properties; status promosi dihitung dari periode campaign. Grant development tanpa transaksi bukan pendapatan.
- Histori/readBy/messages/notes menjadi relasi. Persetujuan saran keluhan dicatat di complaint_analyses dengan rule_version. Tidak ada integrasi AI.
- Compare, peran demo aktif, selected conversation, filter, dan sesi UI tetap di frontend. recent_searches menyimpan pencarian per identitas; batas lima hasil diambil query UI pada Phase 2.
- Email dan password tetap otoritatif di Auth. Profil aplikasi hanya menyimpan nama dan telepon privat; pembacaan email login/kontak tambahan memerlukan backend terotorisasi Phase 2, tidak ada directory email publik.

## Aturan integritas

Sewa aktif unik per kamar dan per penghuni melalui partial UNIQUE index. Exclusion GiST pada UUID + daterange melarang periode historis bertumpuk, termasuk request bersamaan. Check-in juga mengunci kamar dan memeriksa kondisi operasional serta publikasi. Kamar terisi tidak dapat dinonaktifkan; pemilik/identitas properti dan kamar tidak dapat diganti.

`start_date` dan `end_date` sewa inklusif. `closed_on` adalah batas check-out eksklusif. Rentang efektif `[start_date, coalesce(closed_on, end_date + 1))`. Pindah tanggal 20 menutup agreement lama pada tanggal 20 dan memulai yang baru pada tanggal 20; transaksi pindah atomik. Penghuni boleh check-out pada hari check-in, membentuk rentang kosong dengan record histori tetap ada. Status active dipakai sebagai status operasional eksplisit, bukan otomatis berubah saat end_date lewat; scheduler/penutupan otomatis belum dibuat.

Properti dengan histori dilindungi FK RESTRICT dari agreement melalui rooms, serta transaksi boost, campaign, chat dan analytics. `owner_delete_property` hanya berhasil jika seluruh dependensi historis mengizinkan; kegagalan mengembalikan penghapusan kamar. Gunakan publication_status=archived untuk properti berhistori.

Tagihan baru pending, terkait satu agreement yang valid. Browser hanya dapat membuat/mengedit/membatalkan melalui fungsi pemilik. Tagihan yang final atau mempunyai percobaan pembayaran tidak bisa diedit/dibatalkan. Snapshot dokumen tetap sama walau harga/nama listing berubah. Ledger transaksi dan campaign append-only.

`server_record_rent_payment` hanya service_role, mengunci kunci idempotensi dan invoice. Retry payload sama mengembalikan ID sebelumnya; retry berbeda ditolak. UNIQUE parsial membatasi satu pembayaran sukses per invoice. Trigger memvalidasi nominal, admin fee Rp2.000, lalu memperbarui invoice paid dalam transaksi yang sama. Gagal hanya dicatat, tidak melunasi atau menambah pendapatan. Browser, termasuk admin aplikasi, tidak mendapat pencatat pembayaran.

`server_record_boost` hanya service_role, biaya Rp30.000, admin 0, campaign `[start_date, end_date)` tepat 30 hari. Pembayaran dan campaign disimpan atomik; periode tumpang tindih ditolak. Tidak ada gateway atau pemindahan uang pada Phase 1.

Keluhan: waiting → in_progress → awaiting_confirmation → resolved. Pengelola boleh memindahkan tiket di tiga tahap penanganan sebelum resolved; hanya penghuni terkait yang mengonfirmasi tahap akhir. Penghuni dapat membuka kembali awaiting_confirmation/resolved dengan alasan. Timeline/notifikasi dibuat trigger. Catatan dapat dibaca kedua pihak; tidak menyimpan catatan internal yang tersembunyi dari penghuni.

Chat memiliki tepat peserta yang diizinkan: prospect_id dan owner properti. FK komposit mengharuskan pengirim anggota percakapan. Pesan tidak dapat diedit/dihapus. Constraint deferred memastikan pesan berteks atau berlampiran pada commit. Tabel attachment hanya metadata dan belum menerima tulis browser. Tidak ada bucket, realtime, atau klaim upload sudah bekerja.

## Tanggal, reminder dan generator

Timestamp memakai timestamptz; pencatatan adalah instant yang sama walau sesi berbeda zona waktu. Batas bisnis memakai `(now() at time zone 'Asia/Jakarta')::date`, bukan timezone browser/session.

Reminder H-3 pada jendela 1–3 hari sebelum jatuh tempo, hari H, dan overdue memakai kunci terpisah per invoice/penerima. Reminder manual unik per invoice/hari Jakarta. Pembayaran/pembatalan menandai notifikasi lama dibaca. Pemeriksaan reminder mengunci invoice agar tidak membuat reminder setelah pembayaran bersamaan. Tidak ada cron/background job di Phase 1.

Recurring memakai agreement, nominal, payment_day 1–28, start_month dan cursor monotonic. Generator dipanggil eksplisit pemilik, hanya portofolio sendiri; bulan yang sama tidak dibuat ulang. Check-out mematikan jadwal. Generator tidak mengisi seluruh bulan yang terlewat secara otomatis; caller memilih satu bulan. Sewa berakhir berdasarkan status eksplisit, sama seperti prototype versi 2.

## Laporan dan definisi metrik

| API | Perhitungan dan batas akses |
| --- | --- |
| owner_financial_report(property, from, to) | Owner sendiri; admin terotorisasi boleh seluruh portofolio. Pendapatan = amount rent sukses. Outstanding = pending. Overdue = pending due_date < hari Jakarta. Collection = jumlah invoice paid / jumlah invoice noncancelled. Occupancy = jumlah agreement active / seluruh kamar termasuk nonaktif. Keluhan selesai = resolved dengan confirmed_at. Listing aktif = published. |
| owner_monthly_revenue(property, from, to) | Scope sama, pembayaran per bulan kalender Jakarta; bulan kosong 0; maksimal 24 bulan terakhir pada rentang pilihan, default 6 bulan. |
| platform_financial_report() | Hanya admin. GMV = amount rent sukses; admin revenue = fee rent sukses; boost revenue = amount boost sukses; total platform = admin + boost. Metrik kumulatif, akun terdaftar bukan klaim pengguna aktif. |

Filter tanggal inklusif: invoice berdasarkan due_date, transaksi berdasarkan occurred_at dikonversi tanggal Jakarta. Occupancy, resolved complaints dan active listings merupakan keadaan operasional saat query, tidak difilter periode pembayaran. Kegagalan tidak menghasilkan pendapatan. Owner revenue tidak menjumlahkan fee/boost. GMV bukan pendapatan platform. View invoice_statuses memakai security_invoker, seluruh laporan definer memeriksa pemanggil dan menyaring kepemilikan secara eksplisit.

## Batas trust dan kelanjutan

RLS/grants detail di [RLS_POLICIES.md](RLS_POLICIES.md). service_role merupakan trust boundary server dan tetap dapat melakukan DML sesuai izin server; jangan berikan kepada browser. Role server dapat menambahkan data master/fixture, sementara trigger histori tetap melindungi ledger. Tidak mengklaim perlindungan terhadap administrator PostgreSQL yang sengaja menonaktifkan trigger.

Sebelum Phase 2: jalankan pengujian pada stack Supabase lengkap, validasi JWT/PostgREST dan Auth Admin nyata, tetapkan alur persetujuan check-in, onboarding owner, server verifikasi pembayaran, kontrak upload privat dan retention data. Fitur yang belum memiliki alur aman tetap tidak menerima tulis browser. Panduan setup dan hasil aktual tersedia di [SETUP_GUIDE.md](SETUP_GUIDE.md) dan [VERIFICATION.md](VERIFICATION.md).
