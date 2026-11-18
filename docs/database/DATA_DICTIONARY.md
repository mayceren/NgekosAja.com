# Data Dictionary

Dihasilkan dari katalog PostgreSQL yang menjalankan seluruh migrasi. Semua nilai uang disimpan sebagai bigint rupiah. Kolom nullable, default, PK/FK, constraint dan index di bawah sesuai database aktual.

## activity_logs

Audit append-only tanpa payload data pribadi; scoped ke pemilik dan admin. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| owner_id | uuid | FK → public.profiles (FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Ya | — | Profil pemilik properti/portofolio; bukan input role registrasi. |
| actor_id | uuid | FK → public.profiles (FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Ya | — | Profil aktor tindakan; NULL untuk operasi server tanpa pengguna. |
| entity_table | text |  | Tidak | — | Nama tabel yang diaudit. |
| entity_id | uuid |  | Tidak | — | UUID entitas audit; sengaja bukan FK agar log tetap ada setelah penghapusan yang sah. |
| action | text |  | Tidak | — | Jenis perubahan database. |
| description | text |  | Tidak | — | Uraian entitas. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **activity_logs_action_check**: `CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text, 'ROLE_GRANT'::text])))`
- **activity_logs_actor_id_fkey**: `FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- **activity_logs_description_check**: `CHECK ((char_length(description) <= 300))`
- **activity_logs_owner_id_fkey**: `FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- **activity_logs_pkey**: `PRIMARY KEY (id)`

Index aktual:

- `CREATE INDEX activity_logs_actor_idx ON public.activity_logs USING btree (actor_id)`
- `CREATE INDEX activity_logs_owner_idx ON public.activity_logs USING btree (owner_id, created_at)`
- `CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id)`

## boost_campaigns

Periode promosi 30 hari dengan pembayaran atau grant development yang tidak dianggap pendapatan. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| transaction_id | uuid | UNIQUE; FK → public.transactions (FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT) | Ya | — | Pembayaran boost berhasil; NULL hanya untuk grant development. |
| start_date | date |  | Tidak | private.today() | Tanggal awal berlaku (Jakarta). |
| end_date | date |  | Tidak | — | Tanggal akhir sewa inklusif; untuk kampanye merupakan batas eksklusif start_date + 30. |
| source | text |  | Tidak | 'payment'::text | payment atau development_grant; grant tanpa transaksi tidak menambah pendapatan. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **boost_campaigns_check**: `CHECK ((end_date = (start_date + 30)))`
- **boost_campaigns_check1**: `CHECK ((((source = 'payment'::text) AND (transaction_id IS NOT NULL)) OR ((source = 'development_grant'::text) AND (transaction_id IS NULL))))`
- **boost_campaigns_pkey**: `PRIMARY KEY (id)`
- **boost_campaigns_property_id_daterange_excl**: `EXCLUDE USING gist (property_id WITH =, daterange(start_date, end_date, '[)'::text) WITH &&)`
- **boost_campaigns_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT`
- **boost_campaigns_source_check**: `CHECK ((source = ANY (ARRAY['payment'::text, 'development_grant'::text])))`
- **boost_campaigns_transaction_id_fkey**: `FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT`
- **boost_campaigns_transaction_id_key**: `UNIQUE (transaction_id)`

Index aktual:

- `CREATE UNIQUE INDEX boost_campaigns_pkey ON public.boost_campaigns USING btree (id)`
- `CREATE INDEX boost_campaigns_property_id_daterange_excl ON public.boost_campaigns USING gist (property_id, daterange(start_date, end_date, '[)'::text))`
- `CREATE UNIQUE INDEX boost_campaigns_transaction_id_key ON public.boost_campaigns USING btree (transaction_id)`

## complaint_analyses

Rekomendasi berbasis aturan lokal yang diterima pengguna, bukan hasil API AI. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| complaint_id | uuid | FK → public.complaints (FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT) | Tidak | — | Tiket keluhan induk. |
| accepted_by | uuid | FK → public.profiles (FOREIGN KEY (accepted_by) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Profil yang menerima rekomendasi lokal. |
| rule_version | text |  | Tidak | 'local-keywords-v2'::text | Versi aturan lokal yang menghasilkan rekomendasi. |
| suggested_category | text |  | Tidak | — | Kategori yang direkomendasikan aturan lokal. |
| suggested_priority | text |  | Tidak | — | Prioritas yang direkomendasikan aturan lokal. |
| summary | text |  | Tidak | — | Ringkasan input pengguna. |
| safe_action | text |  | Tidak | — | Saran aman, bukan diagnosis teknis. |
| emergency | boolean |  | Tidak | false | Penanda eskalasi keselamatan dari aturan lokal. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **complaint_analyses_accepted_by_fkey**: `FOREIGN KEY (accepted_by) REFERENCES profiles(id) ON DELETE RESTRICT`
- **complaint_analyses_complaint_id_fkey**: `FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT`
- **complaint_analyses_pkey**: `PRIMARY KEY (id)`
- **complaint_analyses_safe_action_check**: `CHECK (((char_length(safe_action) >= 1) AND (char_length(safe_action) <= 1000)))`
- **complaint_analyses_suggested_category_check**: `CHECK ((suggested_category = ANY (ARRAY['AC'::text, 'Listrik'::text, 'Air'::text, 'Internet'::text, 'Kebersihan'::text, 'Keamanan'::text, 'Furnitur'::text, 'Lainnya'::text])))`
- **complaint_analyses_suggested_priority_check**: `CHECK ((suggested_priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])))`
- **complaint_analyses_summary_check**: `CHECK (((char_length(summary) >= 1) AND (char_length(summary) <= 300)))`

Index aktual:

- `CREATE INDEX complaint_analyses_actor_idx ON public.complaint_analyses USING btree (accepted_by)`
- `CREATE UNIQUE INDEX complaint_analyses_pkey ON public.complaint_analyses USING btree (id)`
- `CREATE INDEX complaint_analyses_ticket_idx ON public.complaint_analyses USING btree (complaint_id)`

## complaint_attachments

Metadata lampiran tiket. Penulisan browser ditutup selama cloud storage belum tersedia. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| complaint_id | uuid | FK → public.complaints (FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT) | Tidak | — | Tiket keluhan induk. |
| uploaded_by | uuid | FK → public.profiles (FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Profil pengunggah metadata lampiran tiket. |
| storage_path | text |  | Tidak | — | Path metadata file privat; belum ada bucket/storage policy Phase 1. |
| mime_type | text |  | Tidak | — | MIME JPG/PNG/WebP. |
| size_bytes | integer |  | Tidak | — | Ukuran file 1–1048576 byte. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **complaint_attachments_complaint_id_fkey**: `FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT`
- **complaint_attachments_mime_type_check**: `CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])))`
- **complaint_attachments_pkey**: `PRIMARY KEY (id)`
- **complaint_attachments_size_bytes_check**: `CHECK (((size_bytes >= 1) AND (size_bytes <= 1048576)))`
- **complaint_attachments_storage_path_check**: `CHECK ((((char_length(storage_path) >= 1) AND (char_length(storage_path) <= 500)) AND (storage_path !~* '^(data:|javascript:)'::text)))`
- **complaint_attachments_uploaded_by_fkey**: `FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE RESTRICT`

Index aktual:

- `CREATE UNIQUE INDEX complaint_attachments_pkey ON public.complaint_attachments USING btree (id)`
- `CREATE INDEX complaint_attachments_ticket_idx ON public.complaint_attachments USING btree (complaint_id)`
- `CREATE INDEX complaint_attachments_uploader_idx ON public.complaint_attachments USING btree (uploaded_by)`

## complaint_histories

Timeline append-only yang dibuat trigger, bukan input bebas browser. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| complaint_id | uuid | FK → public.complaints (FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT) | Tidak | — | Tiket keluhan induk. |
| actor_id | uuid | FK → public.profiles (FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Ya | — | Profil aktor tindakan; NULL untuk operasi server tanpa pengguna. |
| previous_status | text |  | Ya | — | Status sebelum perubahan; NULL pada pencatatan awal. |
| status | text |  | Tidak | — | Status proses; daftar nilai dan pembatasan terdapat pada CHECK di bawah. |
| note | text |  | Tidak | ''::text | Uraian transisi pada timeline. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **complaint_histories_actor_id_fkey**: `FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- **complaint_histories_complaint_id_fkey**: `FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT`
- **complaint_histories_note_check**: `CHECK ((char_length(note) <= 1000))`
- **complaint_histories_pkey**: `PRIMARY KEY (id)`
- **complaint_histories_previous_status_check**: `CHECK ((previous_status = ANY (ARRAY['waiting'::text, 'in_progress'::text, 'awaiting_confirmation'::text, 'resolved'::text])))`
- **complaint_histories_status_check**: `CHECK ((status = ANY (ARRAY['waiting'::text, 'in_progress'::text, 'awaiting_confirmation'::text, 'resolved'::text])))`

Index aktual:

- `CREATE UNIQUE INDEX complaint_histories_pkey ON public.complaint_histories USING btree (id)`
- `CREATE INDEX complaint_histories_ticket_idx ON public.complaint_histories USING btree (complaint_id, created_at)`

## complaint_notes

Catatan tindakan yang dibagikan kepada pihak terkait; tidak ada catatan internal tersembunyi. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| complaint_id | uuid | FK → public.complaints (FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT) | Tidak | — | Tiket keluhan induk. |
| author_id | uuid | FK → public.profiles (FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Profil penulis catatan. |
| body | text |  | Tidak | — | Isi teks pesan/catatan/notifikasi. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **complaint_notes_author_id_fkey**: `FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- **complaint_notes_body_check**: `CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 1000)))`
- **complaint_notes_complaint_id_fkey**: `FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE RESTRICT`
- **complaint_notes_pkey**: `PRIMARY KEY (id)`

Index aktual:

- `CREATE INDEX complaint_notes_author_idx ON public.complaint_notes USING btree (author_id)`
- `CREATE UNIQUE INDEX complaint_notes_pkey ON public.complaint_notes USING btree (id)`
- `CREATE INDEX complaint_notes_ticket_idx ON public.complaint_notes USING btree (complaint_id, created_at)`

## complaints

Tiket fasilitas sesuai agreement asal; konfirmasi akhir oleh penghuni. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| agreement_id | uuid | FK → public.rental_agreements (FOREIGN KEY (agreement_id) REFERENCES rental_agreements(id) ON DELETE RESTRICT) | Tidak | — | Perjanjian sewa sumber; tenant/kamar/pemilik diturunkan dari relasi ini. |
| title | text |  | Tidak | — | Judul singkat tiket/notifikasi. |
| description | text |  | Tidak | — | Uraian entitas. |
| category | text |  | Tidak | — | Kategori fasilitas sesuai daftar CHECK. |
| urgency | text |  | Tidak | — | Urgensi yang dipilih pelapor. |
| priority | text |  | Tidak | — | Prioritas penanganan yang diputuskan pengelola. |
| status | text |  | Tidak | 'waiting'::text | Status proses; daftar nilai dan pembatasan terdapat pada CHECK di bawah. |
| estimated_completion | date |  | Ya | — | Tanggal estimasi penyelesaian opsional. |
| confirmed_at | timestamp with time zone |  | Ya | — | Waktu penghuni mengonfirmasi selesai, hanya terisi pada resolved. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **complaints_agreement_id_fkey**: `FOREIGN KEY (agreement_id) REFERENCES rental_agreements(id) ON DELETE RESTRICT`
- **complaints_category_check**: `CHECK ((category = ANY (ARRAY['AC'::text, 'Listrik'::text, 'Air'::text, 'Internet'::text, 'Kebersihan'::text, 'Keamanan'::text, 'Furnitur'::text, 'Lainnya'::text])))`
- **complaints_check**: `CHECK ((((status = 'resolved'::text) AND (confirmed_at IS NOT NULL)) OR ((status <> 'resolved'::text) AND (confirmed_at IS NULL))))`
- **complaints_description_check**: `CHECK (((char_length(btrim(description)) >= 10) AND (char_length(btrim(description)) <= 4000)))`
- **complaints_pkey**: `PRIMARY KEY (id)`
- **complaints_priority_check**: `CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])))`
- **complaints_status_check**: `CHECK ((status = ANY (ARRAY['waiting'::text, 'in_progress'::text, 'awaiting_confirmation'::text, 'resolved'::text])))`
- **complaints_title_check**: `CHECK (((char_length(btrim(title)) >= 5) AND (char_length(btrim(title)) <= 150)))`
- **complaints_urgency_check**: `CHECK ((urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])))`

Index aktual:

- `CREATE INDEX complaints_agreement_idx ON public.complaints USING btree (agreement_id, status)`
- `CREATE UNIQUE INDEX complaints_pkey ON public.complaints USING btree (id)`

## conversation_members

Dua peserta sah: pemilik properti dan calon penghuni; menyimpan penanda baca. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| conversation_id | uuid | FK → public.conversations (FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT) | Tidak | — | Percakapan induk. |
| user_id | uuid | FK → public.profiles (FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Identitas profil pemilik data ini. |
| last_read_at | timestamp with time zone |  | Ya | — | Waktu baca terakhir anggota sendiri melalui RPC. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **conversation_members_conversation_id_fkey**: `FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT`
- **conversation_members_conversation_id_user_id_key**: `UNIQUE (conversation_id, user_id)`
- **conversation_members_pkey**: `PRIMARY KEY (id)`
- **conversation_members_user_id_fkey**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT`

Index aktual:

- `CREATE UNIQUE INDEX conversation_members_conversation_id_user_id_key ON public.conversation_members USING btree (conversation_id, user_id)`
- `CREATE UNIQUE INDEX conversation_members_pkey ON public.conversation_members USING btree (id)`
- `CREATE INDEX conversation_members_user_idx ON public.conversation_members USING btree (user_id)`

## conversations

Percakapan properti dan satu calon penghuni; identitas tetap saat menjadi penghuni. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| prospect_id | uuid | FK → public.profiles (FOREIGN KEY (prospect_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Profil calon penghuni/penghuni yang memulai percakapan. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **conversations_pkey**: `PRIMARY KEY (id)`
- **conversations_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT`
- **conversations_property_id_prospect_id_key**: `UNIQUE (property_id, prospect_id)`
- **conversations_prospect_id_fkey**: `FOREIGN KEY (prospect_id) REFERENCES profiles(id) ON DELETE RESTRICT`

Index aktual:

- `CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id)`
- `CREATE UNIQUE INDEX conversations_property_id_prospect_id_key ON public.conversations USING btree (property_id, prospect_id)`
- `CREATE INDEX conversations_prospect_idx ON public.conversations USING btree (prospect_id)`

## facilities

Master fasilitas publik nonpersonal. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| code | text | UNIQUE | Tidak | — | Kode master yang stabil dan unik. |
| name | text | UNIQUE | Tidak | — | Nama entitas yang ditampilkan. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **facilities_code_check**: `CHECK ((code ~ '^[a-z_]+$'::text))`
- **facilities_code_key**: `UNIQUE (code)`
- **facilities_name_check**: `CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)))`
- **facilities_name_key**: `UNIQUE (name)`
- **facilities_pkey**: `PRIMARY KEY (id)`

Index aktual:

- `CREATE UNIQUE INDEX facilities_code_key ON public.facilities USING btree (code)`
- `CREATE UNIQUE INDEX facilities_name_key ON public.facilities USING btree (name)`
- `CREATE UNIQUE INDEX facilities_pkey ON public.facilities USING btree (id)`

## favorites

Wishlist terikat identitas, tetap ada setelah check-in. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| user_id | uuid | FK → public.profiles (FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE) | Tidak | — | Identitas profil pemilik data ini. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **favorites_pkey**: `PRIMARY KEY (id)`
- **favorites_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- **favorites_user_id_fkey**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **favorites_user_id_property_id_key**: `UNIQUE (user_id, property_id)`

Index aktual:

- `CREATE UNIQUE INDEX favorites_pkey ON public.favorites USING btree (id)`
- `CREATE INDEX favorites_property_idx ON public.favorites USING btree (property_id)`
- `CREATE UNIQUE INDEX favorites_user_id_property_id_key ON public.favorites USING btree (user_id, property_id)`

## invoices

Tagihan bulanan terkait agreement, termasuk snapshot bukti historis. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| agreement_id | uuid | FK → public.rental_agreements (FOREIGN KEY (agreement_id) REFERENCES rental_agreements(id) ON DELETE RESTRICT) | Tidak | — | Perjanjian sewa sumber; tenant/kamar/pemilik diturunkan dari relasi ini. |
| period_start | date |  | Tidak | — | Tanggal pertama bulan tagihan; unik per agreement, termasuk tagihan dibatalkan. |
| due_date | date |  | Tidak | — | Tanggal jatuh tempo lokal; overdue dihitung saat baca, tidak disimpan sebagai status. |
| amount | bigint |  | Tidak | — | Nominal rupiah snapshot. Nilai gagal tercatat sebagai percobaan, bukan pendapatan. |
| admin_fee | bigint |  | Tidak | 2000 | Biaya admin rupiah: 2000 untuk sewa, 0 untuk boost; hanya sukses dihitung revenue. |
| status | text |  | Tidak | 'pending'::text | Status proses; daftar nilai dan pembatasan terdapat pada CHECK di bawah. |
| notes | text |  | Tidak | ''::text | Catatan tagihan, dibekukan setelah percobaan pembayaran. |
| tenant_name_snapshot | text |  | Tidak | — | Nama penghuni saat tagihan dibuat, tidak mengikuti edit profil. |
| property_name_snapshot | text |  | Tidak | — | Nama properti saat tagihan dibuat. |
| room_number_snapshot | text |  | Tidak | — | Nomor kamar saat tagihan dibuat. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **invoices_admin_fee_check**: `CHECK ((admin_fee = 2000))`
- **invoices_agreement_id_fkey**: `FOREIGN KEY (agreement_id) REFERENCES rental_agreements(id) ON DELETE RESTRICT`
- **invoices_agreement_id_period_start_key**: `UNIQUE (agreement_id, period_start)`
- **invoices_amount_check**: `CHECK (((amount >= 100000) AND (amount <= 100000000)))`
- **invoices_notes_check**: `CHECK ((char_length(notes) <= 1000))`
- **invoices_period_start_check**: `CHECK ((EXTRACT(day FROM period_start) = (1)::numeric))`
- **invoices_pkey**: `PRIMARY KEY (id)`
- **invoices_status_check**: `CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text])))`

Index aktual:

- `CREATE UNIQUE INDEX invoices_agreement_id_period_start_key ON public.invoices USING btree (agreement_id, period_start)`
- `CREATE INDEX invoices_due_idx ON public.invoices USING btree (status, due_date)`
- `CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id)`

## listing_analytics

Event listing bertanggal Jakarta yang dideduplikasi; akses tulis hanya RPC aktor login, tanpa klaim unique visitor. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| actor_id | uuid | FK → public.profiles (FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Profil aktor tindakan; NULL untuk operasi server tanpa pengguna. |
| session_id | uuid |  | Tidak | — | UUID sesi pengamatan, bukan autentikasi. |
| event_date | date |  | Tidak | private.today() | Tanggal bisnis Jakarta untuk deduplikasi event. |
| kind | text |  | Tidak | — | Jenis transaksi rent/boost atau jenis event view/detail/contact sesuai tabel. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **listing_analytics_actor_id_fkey**: `FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- **listing_analytics_kind_check**: `CHECK ((kind = ANY (ARRAY['view'::text, 'detail'::text, 'contact'::text])))`
- **listing_analytics_pkey**: `PRIMARY KEY (id)`
- **listing_analytics_property_id_actor_id_session_id_event_dat_key**: `UNIQUE (property_id, actor_id, session_id, event_date, kind)`
- **listing_analytics_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT`

Index aktual:

- `CREATE INDEX listing_analytics_actor_idx ON public.listing_analytics USING btree (actor_id)`
- `CREATE UNIQUE INDEX listing_analytics_pkey ON public.listing_analytics USING btree (id)`
- `CREATE UNIQUE INDEX listing_analytics_property_id_actor_id_session_id_event_dat_key ON public.listing_analytics USING btree (property_id, actor_id, session_id, event_date, kind)`

## message_attachments

Metadata lampiran gambar pesan; tidak menyediakan upload cloud. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| message_id | uuid | FK → public.messages (FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE RESTRICT) | Tidak | — | Pesan induk lampiran. |
| storage_path | text |  | Tidak | — | Path metadata file privat; belum ada bucket/storage policy Phase 1. |
| mime_type | text |  | Tidak | — | MIME JPG/PNG/WebP. |
| size_bytes | integer |  | Tidak | — | Ukuran file 1–1048576 byte. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **attachment_content_check**: `TRIGGER DEFERRABLE INITIALLY DEFERRED`
- **message_attachments_message_id_fkey**: `FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE RESTRICT`
- **message_attachments_mime_type_check**: `CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])))`
- **message_attachments_pkey**: `PRIMARY KEY (id)`
- **message_attachments_size_bytes_check**: `CHECK (((size_bytes >= 1) AND (size_bytes <= 1048576)))`
- **message_attachments_storage_path_check**: `CHECK ((((char_length(storage_path) >= 1) AND (char_length(storage_path) <= 500)) AND (storage_path !~* '^(data:|javascript:)'::text)))`

Index aktual:

- `CREATE INDEX message_attachments_message_idx ON public.message_attachments USING btree (message_id)`
- `CREATE UNIQUE INDEX message_attachments_pkey ON public.message_attachments USING btree (id)`

## messages

Pesan append-only. Wajib mempunyai teks atau lampiran pada akhir transaksi. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| conversation_id | uuid | FK → public.conversations (FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT); FK → public.conversation_members (FOREIGN KEY (conversation_id, sender_id) REFERENCES conversation_members(conversation_id, user_id) ON DELETE RESTRICT) | Tidak | — | Percakapan induk. |
| sender_id | uuid | FK → public.conversation_members (FOREIGN KEY (conversation_id, sender_id) REFERENCES conversation_members(conversation_id, user_id) ON DELETE RESTRICT); FK → public.profiles (FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Profil pengirim, harus anggota percakapan melalui FK komposit. |
| body | text |  | Tidak | ''::text | Isi teks pesan/catatan/notifikasi. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **message_content_check**: `TRIGGER DEFERRABLE INITIALLY DEFERRED`
- **messages_body_check**: `CHECK ((char_length(body) <= 1000))`
- **messages_conversation_id_fkey**: `FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT`
- **messages_conversation_id_sender_id_fkey**: `FOREIGN KEY (conversation_id, sender_id) REFERENCES conversation_members(conversation_id, user_id) ON DELETE RESTRICT`
- **messages_pkey**: `PRIMARY KEY (id)`
- **messages_sender_id_fkey**: `FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE RESTRICT`

Index aktual:

- `CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at)`
- `CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id)`
- `CREATE INDEX messages_sender_idx ON public.messages USING btree (sender_id)`

## notifications

Notifikasi privat dengan key deduplikasi per pengguna. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| user_id | uuid | FK → public.profiles (FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Identitas profil pemilik data ini. |
| dedupe_key | text |  | Tidak | — | Kunci notifikasi unik per penerima. |
| invoice_id | uuid | FK → public.invoices (FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT) | Ya | — | Tagihan terkait; wajib untuk transaksi sewa, NULL untuk boost. |
| title | text |  | Tidak | — | Judul singkat tiket/notifikasi. |
| body | text |  | Tidak | — | Isi teks pesan/catatan/notifikasi. |
| route | text |  | Tidak | ''::text | Rute aplikasi tujuan; tidak memanggil layanan eksternal. |
| read_at | timestamp with time zone |  | Ya | — | Waktu pengguna membaca notifikasi; NULL berarti belum dibaca. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **notifications_body_check**: `CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000)))`
- **notifications_dedupe_key_check**: `CHECK (((char_length(dedupe_key) >= 1) AND (char_length(dedupe_key) <= 200)))`
- **notifications_invoice_id_fkey**: `FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT`
- **notifications_pkey**: `PRIMARY KEY (id)`
- **notifications_route_check**: `CHECK ((char_length(route) <= 200))`
- **notifications_title_check**: `CHECK (((char_length(title) >= 1) AND (char_length(title) <= 150)))`
- **notifications_user_id_dedupe_key_key**: `UNIQUE (user_id, dedupe_key)`
- **notifications_user_id_fkey**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT`

Index aktual:

- `CREATE INDEX notifications_invoice_idx ON public.notifications USING btree (invoice_id)`
- `CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)`
- `CREATE UNIQUE INDEX notifications_user_id_dedupe_key_key ON public.notifications USING btree (user_id, dedupe_key)`
- `CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at)`

## profiles

Profil privat dengan ID yang sama dengan Supabase Auth. Email/kata sandi dikelola Auth, tidak disalin ke tabel aplikasi. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK; FK → auth.users (FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT) | Tidak | — | Identitas UUID record; unik dan wajib. |
| display_name | text |  | Tidak | — | Nama tampilan pengguna, bukan email login. |
| phone | text |  | Ya | — | Kontak privat opsional, hanya format telepon yang diizinkan. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **profiles_display_name_check**: `CHECK (((char_length(btrim(display_name)) >= 1) AND (char_length(btrim(display_name)) <= 70)))`
- **profiles_id_fkey**: `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT`
- **profiles_phone_check**: `CHECK (((phone IS NULL) OR (phone ~ '^[+0-9 -]{8,18}$'::text)))`
- **profiles_pkey**: `PRIMARY KEY (id)`

Index aktual:

- `CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)`

## properties

Properti milik satu pemilik terotorisasi; arsip mempertahankan riwayat. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| owner_id | uuid | FK → public.profiles (FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Profil pemilik properti/portofolio; bukan input role registrasi. |
| name | text |  | Tidak | — | Nama entitas yang ditampilkan. |
| location | text |  | Tidak | — | Nama kawasan pencarian. |
| address | text |  | Tidak | — | Alamat properti yang disiapkan pemilik untuk listing publik; jangan masukkan kontak pribadi. |
| description | text |  | Tidak | — | Uraian entitas. |
| base_rent | bigint |  | Tidak | — | Harga dasar listing saat ini dalam rupiah; tidak mengubah snapshot sewa/tagihan. |
| gender_policy | text |  | Tidak | — | Kebijakan penghuni mixed/male/female. |
| room_size | text |  | Tidak | '3 × 4 m'::text | Label ukuran kamar. |
| publication_status | text |  | Tidak | 'draft'::text | draft, published atau archived; hanya published masuk katalog. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **properties_address_check**: `CHECK (((char_length(btrim(address)) >= 5) AND (char_length(btrim(address)) <= 300)))`
- **properties_base_rent_check**: `CHECK (((base_rent >= 100000) AND (base_rent <= 100000000)))`
- **properties_description_check**: `CHECK (((char_length(btrim(description)) >= 10) AND (char_length(btrim(description)) <= 4000)))`
- **properties_gender_policy_check**: `CHECK ((gender_policy = ANY (ARRAY['mixed'::text, 'male'::text, 'female'::text])))`
- **properties_location_check**: `CHECK (((char_length(btrim(location)) >= 2) AND (char_length(btrim(location)) <= 80)))`
- **properties_name_check**: `CHECK (((char_length(btrim(name)) >= 3) AND (char_length(btrim(name)) <= 100)))`
- **properties_owner_id_fkey**: `FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- **properties_pkey**: `PRIMARY KEY (id)`
- **properties_publication_status_check**: `CHECK ((publication_status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))`
- **properties_room_size_check**: `CHECK (((char_length(room_size) >= 1) AND (char_length(room_size) <= 60)))`

Index aktual:

- `CREATE INDEX properties_name_search_idx ON public.properties USING btree (lower(name) text_pattern_ops)`
- `CREATE INDEX properties_owner_idx ON public.properties USING btree (owner_id)`
- `CREATE UNIQUE INDEX properties_pkey ON public.properties USING btree (id)`
- `CREATE INDEX properties_public_search_idx ON public.properties USING btree (publication_status, location, base_rent)`

## property_facilities

Relasi fasilitas yang berlaku untuk properti. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| facility_id | uuid | FK → public.facilities (FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT) | Tidak | — | Referensi master fasilitas. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **property_facilities_facility_id_fkey**: `FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT`
- **property_facilities_pkey**: `PRIMARY KEY (id)`
- **property_facilities_property_id_facility_id_key**: `UNIQUE (property_id, facility_id)`
- **property_facilities_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`

Index aktual:

- `CREATE INDEX property_facilities_facility_idx ON public.property_facilities USING btree (facility_id)`
- `CREATE UNIQUE INDEX property_facilities_pkey ON public.property_facilities USING btree (id)`
- `CREATE UNIQUE INDEX property_facilities_property_id_facility_id_key ON public.property_facilities USING btree (property_id, facility_id)`

## property_images

Galeri berurutan berupa path metadata; tidak membuat bucket atau mengunggah file. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| image_path | text |  | Tidak | — | Path gambar katalog; bukan data URI atau kode JavaScript. |
| alt_text | text |  | Tidak | ''::text | Deskripsi alternatif gambar. |
| position | integer |  | Tidak | 0 | Urutan tampilan mulai nol. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **property_images_alt_text_check**: `CHECK ((char_length(alt_text) <= 150))`
- **property_images_image_path_check**: `CHECK ((((char_length(image_path) >= 1) AND (char_length(image_path) <= 500)) AND (image_path !~* '^(data:|javascript:)'::text)))`
- **property_images_pkey**: `PRIMARY KEY (id)`
- **property_images_position_check**: `CHECK (("position" >= 0))`
- **property_images_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- **property_images_property_id_position_key**: `UNIQUE (property_id, "position")`

Index aktual:

- `CREATE UNIQUE INDEX property_images_pkey ON public.property_images USING btree (id)`
- `CREATE UNIQUE INDEX property_images_property_id_position_key ON public.property_images USING btree (property_id, "position")`

## property_landmarks

Area sekitar dan jarak ilustrasi sesuai listing versi 2. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| name | text |  | Tidak | — | Nama entitas yang ditampilkan. |
| distance_label | text |  | Tidak | — | Label estimasi jarak, bukan hasil geolokasi. |
| is_illustrative | boolean |  | Tidak | true | Penanda informasi sekitar merupakan ilustrasi. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **property_landmarks_distance_label_check**: `CHECK (((char_length(distance_label) >= 1) AND (char_length(distance_label) <= 120)))`
- **property_landmarks_name_check**: `CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 100)))`
- **property_landmarks_pkey**: `PRIMARY KEY (id)`
- **property_landmarks_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- **property_landmarks_property_id_name_key**: `UNIQUE (property_id, name)`

Index aktual:

- `CREATE UNIQUE INDEX property_landmarks_pkey ON public.property_landmarks USING btree (id)`
- `CREATE UNIQUE INDEX property_landmarks_property_id_name_key ON public.property_landmarks USING btree (property_id, name)`

## property_rules

Peraturan properti berurutan, satu peraturan per baris. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| rule_text | text |  | Tidak | — | Satu peraturan properti. |
| position | integer |  | Tidak | — | Urutan tampilan mulai nol. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **property_rules_pkey**: `PRIMARY KEY (id)`
- **property_rules_position_check**: `CHECK (("position" >= 0))`
- **property_rules_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`
- **property_rules_property_id_position_key**: `UNIQUE (property_id, "position")`
- **property_rules_rule_text_check**: `CHECK (((char_length(btrim(rule_text)) >= 1) AND (char_length(btrim(rule_text)) <= 500)))`

Index aktual:

- `CREATE UNIQUE INDEX property_rules_pkey ON public.property_rules USING btree (id)`
- `CREATE UNIQUE INDEX property_rules_property_id_position_key ON public.property_rules USING btree (property_id, "position")`

## recent_searches

Pencarian tersimpan per pengguna; UI Phase 2 dapat mengambil lima terbaru. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| user_id | uuid | FK → public.profiles (FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE) | Tidak | — | Identitas profil pemilik data ini. |
| query | text |  | Tidak | — | Teks pencarian pengguna. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **recent_searches_pkey**: `PRIMARY KEY (id)`
- **recent_searches_query_check**: `CHECK (((char_length(btrim(query)) >= 1) AND (char_length(btrim(query)) <= 80)))`
- **recent_searches_user_id_fkey**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **recent_searches_user_id_query_key**: `UNIQUE (user_id, query)`

Index aktual:

- `CREATE UNIQUE INDEX recent_searches_pkey ON public.recent_searches USING btree (id)`
- `CREATE UNIQUE INDEX recent_searches_user_id_query_key ON public.recent_searches USING btree (user_id, query)`

## recurring_invoices

Konfigurasi tagihan berkala per agreement; generator eksplisit, tanpa scheduler. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| agreement_id | uuid | UNIQUE; FK → public.rental_agreements (FOREIGN KEY (agreement_id) REFERENCES rental_agreements(id) ON DELETE RESTRICT) | Tidak | — | Perjanjian sewa sumber; tenant/kamar/pemilik diturunkan dari relasi ini. |
| amount | bigint |  | Tidak | — | Nominal rupiah snapshot. Nilai gagal tercatat sebagai percobaan, bukan pendapatan. |
| payment_day | smallint |  | Tidak | — | Hari pembayaran 1–28 agar valid di semua bulan. |
| start_month | date |  | Tidak | — | Tanggal pertama bulan mulai jadwal. |
| last_generated_month | date |  | Ya | — | Cursor bulan terakhir; tidak boleh bergerak mundur. |
| active | boolean |  | Tidak | true | Apakah jadwal masih aktif; otomatis false ketika sewa ditutup. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **recurring_invoices_agreement_id_fkey**: `FOREIGN KEY (agreement_id) REFERENCES rental_agreements(id) ON DELETE RESTRICT`
- **recurring_invoices_agreement_id_key**: `UNIQUE (agreement_id)`
- **recurring_invoices_amount_check**: `CHECK (((amount >= 100000) AND (amount <= 100000000)))`
- **recurring_invoices_check**: `CHECK (((last_generated_month IS NULL) OR (last_generated_month >= start_month)))`
- **recurring_invoices_last_generated_month_check**: `CHECK ((EXTRACT(day FROM last_generated_month) = (1)::numeric))`
- **recurring_invoices_payment_day_check**: `CHECK (((payment_day >= 1) AND (payment_day <= 28)))`
- **recurring_invoices_pkey**: `PRIMARY KEY (id)`
- **recurring_invoices_start_month_check**: `CHECK ((EXTRACT(day FROM start_month) = (1)::numeric))`

Index aktual:

- `CREATE UNIQUE INDEX recurring_invoices_agreement_id_key ON public.recurring_invoices USING btree (agreement_id)`
- `CREATE UNIQUE INDEX recurring_invoices_pkey ON public.recurring_invoices USING btree (id)`

## rental_agreements

Histori sewa/penempatan dengan snapshot harga, tanpa menyalin owner/property yang dapat diturunkan dari kamar. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| tenant_id | uuid | FK → public.tenants (FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT) | Tidak | — | Profil penghuni yang juga terdaftar pada tenants. |
| room_id | uuid | FK → public.rooms (FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT) | Tidak | — | Kamar terkait; properti diturunkan dari rooms.property_id. |
| start_date | date |  | Tidak | — | Tanggal awal berlaku (Jakarta). |
| end_date | date |  | Tidak | — | Tanggal akhir sewa inklusif; untuk kampanye merupakan batas eksklusif start_date + 30. |
| rent | bigint |  | Tidak | — | Nominal sewa dalam rupiah, tanpa pecahan. |
| payment_day | smallint |  | Tidak | — | Hari pembayaran 1–28 agar valid di semua bulan. |
| status | text |  | Tidak | 'active'::text | Status proses; daftar nilai dan pembatasan terdapat pada CHECK di bawah. |
| closed_on | date |  | Ya | — | Tanggal check-out/pindah eksklusif. NULL selama active; memungkinkan turnover pada tanggal yang sama. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **rental_agreements_check**: `CHECK ((end_date >= start_date))`
- **rental_agreements_check1**: `CHECK ((((status = 'active'::text) AND (closed_on IS NULL)) OR ((status <> 'active'::text) AND ((closed_on >= start_date) AND (closed_on <= (end_date + 1))))))`
- **rental_agreements_payment_day_check**: `CHECK (((payment_day >= 1) AND (payment_day <= 28)))`
- **rental_agreements_pkey**: `PRIMARY KEY (id)`
- **rental_agreements_rent_check**: `CHECK (((rent >= 100000) AND (rent <= 100000000)))`
- **rental_agreements_room_id_daterange_excl**: `EXCLUDE USING gist (room_id WITH =, daterange(start_date, COALESCE(closed_on, (end_date + 1)), '[)'::text) WITH &&)`
- **rental_agreements_room_id_fkey**: `FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT`
- **rental_agreements_status_check**: `CHECK ((status = ANY (ARRAY['active'::text, 'transferred'::text, 'checked_out'::text])))`
- **rental_agreements_tenant_id_daterange_excl**: `EXCLUDE USING gist (tenant_id WITH =, daterange(start_date, COALESCE(closed_on, (end_date + 1)), '[)'::text) WITH &&)`
- **rental_agreements_tenant_id_fkey**: `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`

Index aktual:

- `CREATE INDEX agreements_tenant_idx ON public.rental_agreements USING btree (tenant_id, start_date)`
- `CREATE UNIQUE INDEX one_active_agreement_per_room ON public.rental_agreements USING btree (room_id) WHERE (status = 'active'::text)`
- `CREATE UNIQUE INDEX one_active_agreement_per_tenant ON public.rental_agreements USING btree (tenant_id) WHERE (status = 'active'::text)`
- `CREATE UNIQUE INDEX rental_agreements_pkey ON public.rental_agreements USING btree (id)`
- `CREATE INDEX rental_agreements_room_id_daterange_excl ON public.rental_agreements USING gist (room_id, daterange(start_date, COALESCE(closed_on, (end_date + 1)), '[)'::text))`
- `CREATE INDEX rental_agreements_tenant_id_daterange_excl ON public.rental_agreements USING gist (tenant_id, daterange(start_date, COALESCE(closed_on, (end_date + 1)), '[)'::text))`

## room_facilities

Relasi fasilitas per kamar. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| room_id | uuid | FK → public.rooms (FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE) | Tidak | — | Kamar terkait; properti diturunkan dari rooms.property_id. |
| facility_id | uuid | FK → public.facilities (FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT) | Tidak | — | Referensi master fasilitas. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **room_facilities_facility_id_fkey**: `FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT`
- **room_facilities_pkey**: `PRIMARY KEY (id)`
- **room_facilities_room_id_facility_id_key**: `UNIQUE (room_id, facility_id)`
- **room_facilities_room_id_fkey**: `FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE`

Index aktual:

- `CREATE INDEX room_facilities_facility_idx ON public.room_facilities USING btree (facility_id)`
- `CREATE UNIQUE INDEX room_facilities_pkey ON public.room_facilities USING btree (id)`
- `CREATE UNIQUE INDEX room_facilities_room_id_facility_id_key ON public.room_facilities USING btree (room_id, facility_id)`

## rooms

Inventaris kamar, harga saat ini, dan kondisi operasional; Terisi dihitung dari agreement aktif. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT) | Tidak | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| number | text |  | Tidak | — | Nomor kamar unik dalam properti. |
| room_type | text |  | Tidak | 'Standard'::text | Tipe kamar seperti Standard atau Deluxe. |
| rent | bigint |  | Tidak | — | Nominal sewa dalam rupiah, tanpa pecahan. |
| operational_status | text |  | Tidak | 'available'::text | available, maintenance atau inactive; occupied dihitung dari sewa aktif. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **rooms_number_check**: `CHECK (((char_length(btrim(number)) >= 1) AND (char_length(btrim(number)) <= 20)))`
- **rooms_operational_status_check**: `CHECK ((operational_status = ANY (ARRAY['available'::text, 'maintenance'::text, 'inactive'::text])))`
- **rooms_pkey**: `PRIMARY KEY (id)`
- **rooms_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT`
- **rooms_property_id_number_key**: `UNIQUE (property_id, number)`
- **rooms_rent_check**: `CHECK (((rent >= 100000) AND (rent <= 100000000)))`
- **rooms_room_type_check**: `CHECK (((char_length(btrim(room_type)) >= 1) AND (char_length(btrim(room_type)) <= 60)))`

Index aktual:

- `CREATE UNIQUE INDEX rooms_pkey ON public.rooms USING btree (id)`
- `CREATE UNIQUE INDEX rooms_property_id_number_key ON public.rooms USING btree (property_id, number)`

## tenants

Identitas penghuni yang tetap sama dengan profil; penempatan dan harga ada pada agreement. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK; FK → public.profiles (FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Identitas UUID record; unik dan wajib. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **tenants_id_fkey**: `FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE RESTRICT`
- **tenants_pkey**: `PRIMARY KEY (id)`

Index aktual:

- `CREATE UNIQUE INDEX tenants_pkey ON public.tenants USING btree (id)`

## transactions

Ledger append-only percobaan pembayaran sewa atau promosi, berhasil maupun gagal. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| kind | text |  | Tidak | — | Jenis transaksi rent/boost atau jenis event view/detail/contact sesuai tabel. |
| invoice_id | uuid | FK → public.invoices (FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT) | Ya | — | Tagihan terkait; wajib untuk transaksi sewa, NULL untuk boost. |
| property_id | uuid | FK → public.properties (FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT) | Ya | — | Properti terkait; kepemilikan diturunkan dari properties.owner_id. |
| amount | bigint |  | Tidak | — | Nominal rupiah snapshot. Nilai gagal tercatat sebagai percobaan, bukan pendapatan. |
| admin_fee | bigint |  | Tidak | — | Biaya admin rupiah: 2000 untuk sewa, 0 untuk boost; hanya sukses dihitung revenue. |
| method | text |  | Tidak | — | Label metode pembayaran; tanpa rekening/kartu/OTP. |
| status | text |  | Tidak | — | Status proses; daftar nilai dan pembatasan terdapat pada CHECK di bawah. |
| idempotency_key | text | UNIQUE | Tidak | — | Kunci unik retry server, payload berbeda ditolak. |
| is_simulation | boolean |  | Tidak | true | Menandai transaksi ilustrasi; Phase 1 tidak memproses uang. |
| occurred_at | timestamp with time zone |  | Tidak | now() | Waktu pembayaran/percobaan sebagai instant timestamptz. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **transactions_amount_check**: `CHECK (((amount > 0) AND (amount <= 100000000)))`
- **transactions_check**: `CHECK ((((kind = 'rent'::text) AND (invoice_id IS NOT NULL) AND (property_id IS NULL) AND (admin_fee = 2000)) OR ((kind = 'boost'::text) AND (invoice_id IS NULL) AND (property_id IS NOT NULL) AND (admin_fee = 0) AND (amount = 30000))))`
- **transactions_idempotency_key_check**: `CHECK (((char_length(idempotency_key) >= 8) AND (char_length(idempotency_key) <= 150)))`
- **transactions_idempotency_key_key**: `UNIQUE (idempotency_key)`
- **transactions_invoice_id_fkey**: `FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT`
- **transactions_kind_check**: `CHECK ((kind = ANY (ARRAY['rent'::text, 'boost'::text])))`
- **transactions_method_check**: `CHECK (((char_length(btrim(method)) >= 1) AND (char_length(btrim(method)) <= 80)))`
- **transactions_pkey**: `PRIMARY KEY (id)`
- **transactions_property_id_fkey**: `FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT`
- **transactions_status_check**: `CHECK ((status = ANY (ARRAY['succeeded'::text, 'failed'::text])))`

Index aktual:

- `CREATE UNIQUE INDEX one_successful_payment_per_invoice ON public.transactions USING btree (invoice_id) WHERE ((kind = 'rent'::text) AND (status = 'succeeded'::text))`
- `CREATE UNIQUE INDEX transactions_idempotency_key_key ON public.transactions USING btree (idempotency_key)`
- `CREATE INDEX transactions_invoice_idx ON public.transactions USING btree (invoice_id)`
- `CREATE INDEX transactions_occurred_idx ON public.transactions USING btree (occurred_at) WHERE (status = 'succeeded'::text)`
- `CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id)`
- `CREATE INDEX transactions_property_idx ON public.transactions USING btree (property_id, occurred_at)`

## user_roles

Keanggotaan peran server; pengguna dapat mempunyai beberapa peran tanpa mengganti identitas. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| user_id | uuid | FK → public.profiles (FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT) | Tidak | — | Identitas profil pemilik data ini. |
| role | text |  | Tidak | — | Peran prospect, tenant, owner atau admin; penulisan hanya server. |
| granted_by | uuid | FK → public.profiles (FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE RESTRICT) | Ya | — | Profil pemberi peran; NULL untuk bootstrap server. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **user_roles_granted_by_fkey**: `FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE RESTRICT`
- **user_roles_pkey**: `PRIMARY KEY (id)`
- **user_roles_role_check**: `CHECK ((role = ANY (ARRAY['prospect'::text, 'tenant'::text, 'owner'::text, 'admin'::text])))`
- **user_roles_user_id_fkey**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT`
- **user_roles_user_id_role_key**: `UNIQUE (user_id, role)`

Index aktual:

- `CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id)`
- `CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role)`

## user_settings

Preferensi tampilan dan indikator notifikasi per identitas. RLS: aktif.

| Kolom | Tipe | Kunci / FK | NULL | Default | Fungsi |
| --- | --- | --- | --- | --- | --- |
| id | uuid | PK | Tidak | gen_random_uuid() | Identitas UUID record; unik dan wajib. |
| user_id | uuid | UNIQUE; FK → public.profiles (FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE) | Tidak | — | Identitas profil pemilik data ini. |
| notifications_enabled | boolean |  | Tidak | true | Preferensi badge; tidak menonaktifkan pencatatan notifikasi. |
| compact_mode | boolean |  | Tidak | false | Preferensi kepadatan tampilan. |
| sidebar_collapsed | boolean |  | Tidak | false | Preferensi sidebar ringkas. |
| created_at | timestamp with time zone |  | Tidak | now() | Waktu record dibuat, timestamptz; instant konsisten lintas zona waktu. |
| updated_at | timestamp with time zone |  | Tidak | now() | Waktu pembaruan dari trigger; ledger/history tetap append-only. |

Constraint tabel (termasuk CHECK dan FK komposit):

- **user_settings_pkey**: `PRIMARY KEY (id)`
- **user_settings_user_id_fkey**: `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`
- **user_settings_user_id_key**: `UNIQUE (user_id)`

Index aktual:

- `CREATE UNIQUE INDEX user_settings_pkey ON public.user_settings USING btree (id)`
- `CREATE UNIQUE INDEX user_settings_user_id_key ON public.user_settings USING btree (user_id)`

