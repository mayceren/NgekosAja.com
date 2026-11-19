# Hasil pemeriksaan Phase 1

**Penutupan 19 November 2026:** dua masalah baseline sudah diperbaiki di Cloud setelah persetujuan pengguna. **12 migrasi applied, 0 pending**, 52 kelompok tes fresh install dan 54 kelompok tes upgrade lulus. **Phase 1 Database Foundation selesai.** Bukti terbaru ada di [PHASE1_COMPLETION.md](PHASE1_COMPLETION.md); JWT/HTTP nyata menjadi pemeriksaan awal integrasi Phase 2. Catatan di bawah merupakan histori sebelum perbaikan.

Pemeriksaan aktual dilakukan pada **18 November 2026** di workspace Windows. Hasil pengujian SQL lokal dan timestamp mesin tersedia di [tests/database-results.json](../../tests/database-results.json). Hasil penerapan dan inspeksi cloud dicatat terpisah di [REMOTE_DEPLOYMENT.md](REMOTE_DEPLOYMENT.md) dan [remote-apply-results.json](remote-apply-results.json).

Pembaruan remote: setelah pengguna menyetujui, **11 migrasi dan seed 7 fasilitas berhasil diterapkan** ke ngekosaja-development pada PostgreSQL 17.12. Verifikasi remote membuktikan 31 tabel RLS aktif, 236 kolom sesuai schema, 48 FK, 45 policy, 24 fungsi public, seluruh histori migrasi, grants aman, serta 0 migrasi pending. Kontrak SQL 43 kelompok dan 3 tes tooling adalah pengujian lokal; pengujian JWT/HTTP penuh tidak diklaim sebagai bagian dari inspeksi katalog ini.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Instalasi tooling | Node 20.12.0, npm 10.5.0; Supabase CLI 3.2.0, pg 8.23.1 terpasang dan dipin |
| Fresh migrations pada PostgreSQL 16.3 | **11/11 migrasi berhasil**, masing-masing pada database acak baru |
| Kontrak SQL dan RLS | **43 kelompok lulus**, 0 gagal; beberapa assertion per kelompok |
| Tooling security | **3 tes lulus**: loopback/driver URL override, penolakan cloud sebelum koneksi, redaksi error |
| Regresi domain frontend | **30 skenario lulus** pada tests/domain.cjs |
| Sintaks JavaScript | **22 file lulus** node --check: 15 frontend, 5 script database, contracts.mjs dan tes tooling |
| ERD/dictionary/policies | Dihasilkan dari pg_catalog setelah migrasi, bukan schema perkiraan |
| Inventaris schema | **31 tabel, 236 kolom, 48 FK, 45 policy, 24 fungsi public**, satu view security-invoker |
| Frontend dipertahankan | git diff --exit-code untuk index.html/js/css/assets lulus, tanpa perubahan source frontend |
| Default grants yang permisif | Adapter memulai dengan grants API permisif; migrasi menutup tabel, fungsi dan view, termasuk TRUNCATE/TRIGGER/REFERENCES service_role |
| File rahasia/temporer | node_modules, .local-db, supabase/.temp dan .env.local terbukti ignored; pemeriksaan pola credential pada file baru tidak menemukan credential aktual |
| Stack Supabase lengkap | **Belum berjalan**: supabase start gagal dengan DockerLifecycleInspectError; docker/podman tidak tersedia |
| Remote | 11 migrasi + 7 fasilitas applied dan verified setelah persetujuan; tanpa reset/config push/git push |

## Cakupan SQL yang dijalankan

Runner membuat database baru ber-UUID, menginisialisasi adapter Auth minimal, lalu menjalankan seluruh file migrasi sesuai urutan. Fixture menguji FK ke identitas Auth adapter yang benar-benar ada. Setiap pengujian impersonasi memakai SET LOCAL ROLE anon/authenticated/service_role dan claim UUID pengguna dalam transaksi tersendiri; query tidak diuji hanya sebagai superuser.

Yang dibuktikan oleh 43 kelompok tersebut:

- Signup metadata role=admin/is_admin tidak memberi admin; profile FK menolak identitas yang tidak ada; calon penghuni menjadi tenant dengan UUID, favorit dan chat sama.
- RLS aktif pada seluruh tabel, semua fungsi definer menetapkan search_path kosong, fungsi aplikasi tidak mempunyai PUBLIC EXECUTE. Pencatat pembayaran/role grant tidak tersedia untuk browser atau JWT admin aplikasi.
- Nominal negatif/biaya boost invalid ditolak; nomor kamar, agreement/bulan dan pembayaran sukses duplikat ditolak. Batch tagihan lintas owner rollback seluruh batch.
- Dua koneksi independen melakukan check-in bersamaan ke kamar yang sama: hanya satu berhasil. Dua koneksi membayar invoice yang sama bersamaan: hanya satu berhasil. Hasilnya dihitung dari record database setelah commit.
- Pemilik tidak membaca/mengubah portofolio lain atau mengganti owner_id. Pencabutan role owner segera menutup akses. Penghuni tidak membaca profil, kamar, tagihan, recurring, lampiran, notes, analisis atau data personal orang lain.
- Anonymous hanya membaca proyeksi listing publik aman/master fasilitas; raw properties/profiles/invoices/messages/transaksi/audit ditolak. Arsip hilang dari katalog tanpa menghapus histori.
- Laporan owner/platform dan view status invoice tidak melewati scope. Rumus GMV, fee, boost dan batas tanggal Jakarta diuji; kegagalan tidak menambah revenue. Penghuni tidak mempunyai laporan owner, owner tidak mempunyai laporan platform.
- Percakapan memerlukan anggota sah; pengirim dan penambahan anggota ilegal ditolak. Pesan kosong gagal saat commit, pesan hanya berlampiran dapat disimpan dalam transaksi server terotorisasi, browser tidak dapat mengunggah metadata lampiran.
- Pengelola tidak menutup tiket sebagai resolved; hanya tenant terkait dapat mengonfirmasi. Reopen membuat timeline dan status baru. Reminder H-3/manual dan analytics dideduplikasi.
- Transaksi paid mengubah invoice atomik, retry payload sama tidak menambah record, payload berbeda ditolak, harga properti baru tidak mengubah snapshot. Ledger dan invoice final tidak bisa ditulis ulang. Properti berhistori tidak dapat dihapus.
- Checkout dan transfer mempertahankan agreement sebelumnya; status recurring berhenti dan cursor tidak bergerak mundur. Campaign tepat 30 hari, Rp30.000, tanpa revenue untuk grant bawaan.
- Seed master dan fixture development dijalankan ulang; jumlah baris semua tabel sama sebelum/sesudah replay. Timestamp aplikasi bertipe timestamptz; business date memakai Asia/Jakarta.

## Fixture yang benar-benar dimuat

Sebelum skenario tambahan mengubah state pada run terakhir: **36 profil, 3 owner, 16 properti, 101 kamar, 31 penghuni/agreement, 172 invoice, 162 transaksi, 4 tiket, 2 percakapan, 4 pesan, 342 notifikasi, 2 wishlist, 2 campaign, 7 fasilitas**. Termasuk transaksi gagal, ledger historis simulasi, metadata foto, catatan dan rekomendasi tiket. Jumlah notifikasi serta tanggal fixture bisa berbeda pada hari lain; hasil run aktual disimpan di JSON.

Semua akun/data ilustrasi pada database acak dihapus bersama database acak setelah pengujian. Cluster lokal ignored dipertahankan agar setup dapat dipakai ulang; server dihentikan setelah pemeriksaan akhir. Tidak ada kredensial fixture tetap.

## Pengujian yang belum dijalankan

Docker/Podman tidak terpasang, sehingga bootstrap stack Supabase lokal, provisioning lewat GoTrue Auth Admin, verifikasi JWT gateway, serta akses HTTP PostgREST belum diverifikasi. Penerapan migrasi pada **Supabase remote PostgreSQL 17.12 sudah berhasil**, dengan persetujuan pengguna. Adapter auth.users/auth.uid/auth.role pada PostgreSQL native hanya memodelkan kontrak SQL, bukan implementasi autentikasi Supabase.

Script provisioning Auth Admin lokal sudah dibuat dan syntax-checked; replay fungsi pengisian relasinya diuji pada PostgreSQL, tetapi request Auth Admin nyata belum dijalankan. Panduan setup mencantumkan langkah lanjutan ketika Docker tersedia. Tidak ada key cloud yang diperlukan atau diminta.

Browser/visual suite tidak dijalankan ulang pada Phase 1 karena seluruh source frontend identik. Regresi domain dan syntax diperiksa ulang; hasil browser versi 2 yang lama tetap berada di tests/VERIFICATION.md dan tidak diklaim sebagai run baru Phase 1.

Upload cloud, realtime, scheduler, pembayaran nyata dan frontend Auth termasuk tahap berikutnya; akses tulis yang belum aman tetap tertutup. Fungsi database sudah tersedia di project development sesuai grants yang diverifikasi; frontend belum menggunakannya.

## Reproduksi

```powershell
npm ci
# Cluster PostgreSQL test loopback sudah aktif sesuai SETUP_GUIDE.md:
npm run db:test -- --native --docs
npm run test:database-tooling
npm run test:frontend
```

Tanpa --native, runner membutuhkan stack Supabase lokal dan tetap membuat database acak dengan adapter kontrak Auth. Pengujian JWT/HTTP harus dilakukan terpisah setelah stack lengkap tersedia. Lihat [SETUP_GUIDE.md](SETUP_GUIDE.md).
