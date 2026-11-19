# Arsip dokumentasi

Direktori ini menyimpan salinan dokumen sebelum penyelarasan branding produk. Isinya merupakan histori dan tidak menjadi instruksi operasional aktif.

- README-2026-11-19.md: gambaran project sebelum cleanup. Tautan relatif di dalam salinan memakai lokasi dokumen aslinya di root.
- auth/development-account-plan-2026-11-19.json: plan provisioning sebelumnya, belum diterapkan. Identitas/fingerprint lama tidak berlaku untuk plan development terbaru.

Bukti pengujian historis di tests/*-results.json dan docs/auth/*-results.json tetap dipertahankan pada lokasi aslinya, termasuk nama teknis lama. Nama/narasi historis tersebut tidak dipakai pada antarmuka produk atau label akun development baru. SHA-256 bukti dan migrasi dibandingkan sebelum/sesudah cleanup; Git history tidak ditulis ulang.

manifest.json mencatat checksum byte asli kedua salinan arsip. Audit memeriksa checksum tetap tersebut, sehingga commit dokumentasi aktif di masa depan tidak mengubah acuan arsip.
