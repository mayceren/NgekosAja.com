# API simulasi pembayaran

Kedua Edge Functions menggunakan POST application/json, Authorization Bearer JWT Supabase, verify_jwt=true. Tidak ada endpoint webhook atau status provider. Pembacaan status menggunakan payment_attempts/transactions melalui RLS existing.

simulate-rent-payment menerima invoice_id UUID, method enum dan idempotency_key UUID.
simulate-boost-payment menerima property_id UUID, method enum dan idempotency_key UUID.
Field tambahan, nominal, owner_id, payer_id dan status ditolak. Body maksimum 2 KB; origin browser harus masuk allowlist server. Server-to-server tanpa Origin tetap memerlukan JWT dan semua guard.

Metode: qris, virtual_account, bank_transfer, e_wallet. Hanya metadata ilustratif; tidak meminta data keuangan.

Respons 200: attempt yang benar-benar committed, status=succeeded, is_simulation=true, transaction_id, completed_at, reference, payer/kind/resource dan nominal. Tidak ada provider token/key. Request gagal tidak mengembalikan hasil sukses.

| HTTP | Kode |
| --- | --- |
| 400/413/415 | INVALID_REQUEST |
| 401 | AUTH_REQUIRED |
| 403 | FORBIDDEN / DEVELOPMENT_ACCOUNT_REQUIRED |
| 404 | FORBIDDEN untuk resource yang tidak dapat dibaca |
| 409 | PAYMENT_CONFLICT untuk perubahan resource/idempotency/aturan bisnis |
| 503 | SIMULATION_DISABLED / DATABASE_ERROR |

server_simulate_payment(actor uuid,payment_kind text,resource_id uuid,simulated_method text,request_key uuid) hanya dapat dieksekusi service_role. actor berasal dari getUser, bukan body browser. Identitas, role dan marker administratif diperiksa ulang di SQL.

payment_capabilities() mengekspos version/provider/environment/enabled tanpa secret. enabled hanya petunjuk UI; Edge dan DB tetap menjadi pengaman. payment_accounting(target_property,from_date,to_date) memerlukan owner/admin dan memisahkan simulation/non_simulation; owner tidak dapat meminta properti owner lain.

Fresh getUser dan user-scoped client digunakan sebelum service RPC. Tidak ada log body/JWT/key atau pesan error database mentah. Supabase URL/anon key adalah konfigurasi publik; service role hanya berada di environment Edge.
