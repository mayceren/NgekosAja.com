# Keamanan pembayaran aktif

Simulator internal tidak mempunyai endpoint webhook. Seluruh settlement memerlukan Supabase Auth JWT, akun development ber-marker administratif, project target yang tepat, switch server dan DB, serta ownership/RLS. Tidak ada browser RPC untuk settlement.

Gunakan [arsitektur](PAYMENT_ARCHITECTURE.md) dan [kontrak API](API_CONTRACTS.md). Dokumentasi signature/webhook Midtrans sebelumnya hanya tersedia dalam [arsip](archive/midtrans-phase5/README.md).
