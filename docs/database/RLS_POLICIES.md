# Row Level Security dan izin aktual

Snapshot **12 migrasi applied**. Policy tetap 45; EXECUTE private.today() untuk service_role sudah diberikan dan terverifikasi, authenticated tetap true dan anon false. Lihat [penutupan Phase 1](PHASE1_COMPLETION.md).

Semua tabel public mengaktifkan RLS dalam transaksi pembuatannya. `private` tidak diekspos pada Data API. Migrasi awal menutup default grants; kebijakan akhir menambah akses yang sudah dibatasi. Tabel tanpa kebijakan tulis tetap tertutup. PUBLIC tidak mempunyai EXECUTE pada fungsi aplikasi.

Anonymous hanya mendapat `public_listings()` dengan proyeksi kolom tetap dan master facilities. Base properties tidak dapat dibaca anonymous. Profil, kontak, nomor kamar internal, owner UUID, dan transaksi tidak termasuk hasil katalog. Pemilik wajib menjaga isi teks listing tidak mengandung kontak pribadi.

`profiles` hanya diri sendiri, penghuni terkait pemilik melalui histori agreement, atau admin. Notifikasi/pengaturan/wishlist tetap milik pengguna sendiri, termasuk saat admin login. Peserta chat dibatasi FK + membership yang dibuat RPC, admin terotorisasi dapat membaca untuk kewenangan platform.

Role admin/owner tidak diambil dari user_metadata. Trigger Auth selalu memberi prospect. `server_grant_role` hanya service_role dan memeriksa claim server. Prospect menjadi tenant dengan UUID yang sama pada check-in oleh pemilik yang telah mempunyai percakapan terkait. Persetujuan identitas/check-in formal perlu diselesaikan pada Phase 2.

Mutasi sewa, tagihan, status tiket, keanggotaan chat dan pembayaran melalui fungsi dengan search_path kosong serta pemeriksaan otorisasi. Pembayaran dan role grant hanya server; bahkan JWT admin aplikasi tidak dapat memanggil pencatat pembayaran. Retry payment menggunakan lock dan kunci idempotensi, bukan status dari browser.

Lampiran tiket/pesan tidak mempunyai izin tulis browser selama cloud storage belum diimplementasikan. Analytics anonim juga ditutup; RPC hanya menerima aktor login. Riwayat, transaksi dan audit append-only. service_role adalah trust boundary server (BYPASSRLS), tidak boleh masuk frontend.

## Policies

Katalog berikut dihasilkan langsung dari pg_policies setelah seluruh migrasi dijalankan. `—` berarti ekspresi tidak dipakai oleh jenis command tersebut.

| Tabel | Policy | Command | Role | USING | WITH CHECK |
| --- | --- | --- | --- | --- | --- |
| activity_logs | activity_read | SELECT | {authenticated} | ((owner_id = ( SELECT auth.uid() AS uid)) OR private.is_admin()) | — |
| boost_campaigns | campaigns_read | SELECT | {authenticated} | (private.owns_property(property_id) OR private.is_admin()) | — |
| complaint_analyses | analyses_insert | INSERT | {authenticated} | — | ((accepted_by = ( SELECT auth.uid() AS uid)) AND private.can_read_complaint(complaint_id)) |
| complaint_analyses | analyses_read | SELECT | {authenticated} | private.can_read_complaint(complaint_id) | — |
| complaint_attachments | complaint_attachments_read | SELECT | {authenticated} | private.can_read_complaint(complaint_id) | — |
| complaint_histories | histories_read | SELECT | {authenticated} | private.can_read_complaint(complaint_id) | — |
| complaint_notes | notes_read | SELECT | {authenticated} | private.can_read_complaint(complaint_id) | — |
| complaints | complaints_read | SELECT | {authenticated} | private.can_read_agreement(agreement_id) | — |
| conversation_members | members_read | SELECT | {authenticated} | (private.is_member(conversation_id) OR private.is_admin()) | — |
| conversations | conversations_read | SELECT | {authenticated} | (private.is_member(id) OR private.is_admin()) | — |
| facilities | facilities_public | SELECT | {anon,authenticated} | true | — |
| favorites | favorites_own | ALL | {authenticated} | (user_id = ( SELECT auth.uid() AS uid)) | ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1    FROM public_listings() l(id, name, location, address, description, base_rent, gender_policy, room_size, total_rooms, available_rooms, images, facilities, rules, landmarks, promoted)   WHERE (l.id = favorites.property_id)))) |
| invoices | invoices_read | SELECT | {authenticated} | private.can_read_agreement(agreement_id) | — |
| listing_analytics | analytics_read | SELECT | {authenticated} | (private.owns_property(property_id) OR private.is_admin()) | — |
| message_attachments | message_attachments_read | SELECT | {authenticated} | (EXISTS ( SELECT 1    FROM messages m   WHERE ((m.id = message_attachments.message_id) AND (private.is_member(m.conversation_id) OR private.is_admin())))) | — |
| messages | messages_read | SELECT | {authenticated} | (private.is_member(conversation_id) OR private.is_admin()) | — |
| notifications | notifications_read | SELECT | {authenticated} | (user_id = ( SELECT auth.uid() AS uid)) | — |
| notifications | notifications_update | UPDATE | {authenticated} | (user_id = ( SELECT auth.uid() AS uid)) | (user_id = ( SELECT auth.uid() AS uid)) |
| profiles | profiles_read | SELECT | {authenticated} | ((id = ( SELECT auth.uid() AS uid)) OR private.related_tenant(id) OR private.is_admin()) | — |
| profiles | profiles_update_self | UPDATE | {authenticated} | (id = ( SELECT auth.uid() AS uid)) | (id = ( SELECT auth.uid() AS uid)) |
| properties | properties_delete | DELETE | {authenticated} | private.owns_property(id) | — |
| properties | properties_insert | INSERT | {authenticated} | — | ((owner_id = ( SELECT auth.uid() AS uid)) AND private.has_role('owner'::text)) |
| properties | properties_read | SELECT | {authenticated} | private.property_party(id) | — |
| properties | properties_update | UPDATE | {authenticated} | private.owns_property(id) | (owner_id = ( SELECT auth.uid() AS uid)) |
| property_facilities | property_facilities_read | SELECT | {authenticated} | private.property_party(property_id) | — |
| property_facilities | property_facilities_write | ALL | {authenticated} | private.owns_property(property_id) | private.owns_property(property_id) |
| property_images | images_read | SELECT | {authenticated} | private.property_party(property_id) | — |
| property_images | images_write | ALL | {authenticated} | private.owns_property(property_id) | private.owns_property(property_id) |
| property_landmarks | landmarks_read | SELECT | {authenticated} | private.property_party(property_id) | — |
| property_landmarks | landmarks_write | ALL | {authenticated} | private.owns_property(property_id) | private.owns_property(property_id) |
| property_rules | rules_read | SELECT | {authenticated} | private.property_party(property_id) | — |
| property_rules | rules_write | ALL | {authenticated} | private.owns_property(property_id) | private.owns_property(property_id) |
| recent_searches | searches_own | ALL | {authenticated} | (user_id = ( SELECT auth.uid() AS uid)) | (user_id = ( SELECT auth.uid() AS uid)) |
| recurring_invoices | recurring_read | SELECT | {authenticated} | private.can_read_agreement(agreement_id) | — |
| rental_agreements | agreements_read | SELECT | {authenticated} | private.can_read_agreement(id) | — |
| room_facilities | room_facilities_read | SELECT | {authenticated} | private.can_read_room(room_id) | — |
| room_facilities | room_facilities_write | ALL | {authenticated} | private.owns_room(room_id) | private.owns_room(room_id) |
| rooms | rooms_delete | DELETE | {authenticated} | private.owns_property(property_id) | — |
| rooms | rooms_insert | INSERT | {authenticated} | — | private.owns_property(property_id) |
| rooms | rooms_read | SELECT | {authenticated} | private.can_read_room(id) | — |
| rooms | rooms_update | UPDATE | {authenticated} | private.owns_property(property_id) | private.owns_property(property_id) |
| tenants | tenants_read | SELECT | {authenticated} | ((id = ( SELECT auth.uid() AS uid)) OR private.related_tenant(id) OR private.is_admin()) | — |
| transactions | transactions_read | SELECT | {authenticated} | (((kind = 'rent'::text) AND (EXISTS ( SELECT 1    FROM invoices i   WHERE ((i.id = transactions.invoice_id) AND private.can_read_agreement(i.agreement_id))))) OR ((kind = 'boost'::text) AND private.owns_property(property_id)) OR private.is_admin()) | — |
| user_roles | roles_read | SELECT | {authenticated} | ((user_id = ( SELECT auth.uid() AS uid)) OR private.is_admin()) | — |
| user_settings | settings_own | ALL | {authenticated} | (user_id = ( SELECT auth.uid() AS uid)) | (user_id = ( SELECT auth.uid() AS uid)) |

## Grants tabel

| Tabel/view | Role | Izin |
| --- | --- | --- |
| activity_logs | authenticated | SELECT |
| activity_logs | service_role | DELETE |
| activity_logs | service_role | INSERT |
| activity_logs | service_role | SELECT |
| activity_logs | service_role | UPDATE |
| boost_campaigns | authenticated | SELECT |
| boost_campaigns | service_role | DELETE |
| boost_campaigns | service_role | INSERT |
| boost_campaigns | service_role | SELECT |
| boost_campaigns | service_role | UPDATE |
| complaint_analyses | authenticated | INSERT |
| complaint_analyses | authenticated | SELECT |
| complaint_analyses | service_role | DELETE |
| complaint_analyses | service_role | INSERT |
| complaint_analyses | service_role | SELECT |
| complaint_analyses | service_role | UPDATE |
| complaint_attachments | authenticated | SELECT |
| complaint_attachments | service_role | DELETE |
| complaint_attachments | service_role | INSERT |
| complaint_attachments | service_role | SELECT |
| complaint_attachments | service_role | UPDATE |
| complaint_histories | authenticated | SELECT |
| complaint_histories | service_role | DELETE |
| complaint_histories | service_role | INSERT |
| complaint_histories | service_role | SELECT |
| complaint_histories | service_role | UPDATE |
| complaint_notes | authenticated | SELECT |
| complaint_notes | service_role | DELETE |
| complaint_notes | service_role | INSERT |
| complaint_notes | service_role | SELECT |
| complaint_notes | service_role | UPDATE |
| complaints | authenticated | SELECT |
| complaints | service_role | DELETE |
| complaints | service_role | INSERT |
| complaints | service_role | SELECT |
| complaints | service_role | UPDATE |
| conversation_members | authenticated | SELECT |
| conversation_members | service_role | DELETE |
| conversation_members | service_role | INSERT |
| conversation_members | service_role | SELECT |
| conversation_members | service_role | UPDATE |
| conversations | authenticated | SELECT |
| conversations | service_role | DELETE |
| conversations | service_role | INSERT |
| conversations | service_role | SELECT |
| conversations | service_role | UPDATE |
| facilities | anon | SELECT |
| facilities | authenticated | SELECT |
| facilities | service_role | DELETE |
| facilities | service_role | INSERT |
| facilities | service_role | SELECT |
| facilities | service_role | UPDATE |
| favorites | authenticated | DELETE |
| favorites | authenticated | INSERT |
| favorites | authenticated | SELECT |
| favorites | service_role | DELETE |
| favorites | service_role | INSERT |
| favorites | service_role | SELECT |
| favorites | service_role | UPDATE |
| invoice_statuses | authenticated | SELECT |
| invoice_statuses | service_role | SELECT |
| invoices | authenticated | SELECT |
| invoices | service_role | DELETE |
| invoices | service_role | INSERT |
| invoices | service_role | SELECT |
| invoices | service_role | UPDATE |
| listing_analytics | authenticated | SELECT |
| listing_analytics | service_role | DELETE |
| listing_analytics | service_role | INSERT |
| listing_analytics | service_role | SELECT |
| listing_analytics | service_role | UPDATE |
| message_attachments | authenticated | SELECT |
| message_attachments | service_role | DELETE |
| message_attachments | service_role | INSERT |
| message_attachments | service_role | SELECT |
| message_attachments | service_role | UPDATE |
| messages | authenticated | SELECT |
| messages | service_role | DELETE |
| messages | service_role | INSERT |
| messages | service_role | SELECT |
| messages | service_role | UPDATE |
| notifications | authenticated | SELECT |
| notifications | service_role | DELETE |
| notifications | service_role | INSERT |
| notifications | service_role | SELECT |
| notifications | service_role | UPDATE |
| profiles | authenticated | SELECT |
| profiles | service_role | DELETE |
| profiles | service_role | INSERT |
| profiles | service_role | SELECT |
| profiles | service_role | UPDATE |
| properties | authenticated | DELETE |
| properties | authenticated | INSERT |
| properties | authenticated | SELECT |
| properties | service_role | DELETE |
| properties | service_role | INSERT |
| properties | service_role | SELECT |
| properties | service_role | UPDATE |
| property_facilities | authenticated | DELETE |
| property_facilities | authenticated | INSERT |
| property_facilities | authenticated | SELECT |
| property_facilities | authenticated | UPDATE |
| property_facilities | service_role | DELETE |
| property_facilities | service_role | INSERT |
| property_facilities | service_role | SELECT |
| property_facilities | service_role | UPDATE |
| property_images | authenticated | DELETE |
| property_images | authenticated | INSERT |
| property_images | authenticated | SELECT |
| property_images | authenticated | UPDATE |
| property_images | service_role | DELETE |
| property_images | service_role | INSERT |
| property_images | service_role | SELECT |
| property_images | service_role | UPDATE |
| property_landmarks | authenticated | DELETE |
| property_landmarks | authenticated | INSERT |
| property_landmarks | authenticated | SELECT |
| property_landmarks | authenticated | UPDATE |
| property_landmarks | service_role | DELETE |
| property_landmarks | service_role | INSERT |
| property_landmarks | service_role | SELECT |
| property_landmarks | service_role | UPDATE |
| property_rules | authenticated | DELETE |
| property_rules | authenticated | INSERT |
| property_rules | authenticated | SELECT |
| property_rules | authenticated | UPDATE |
| property_rules | service_role | DELETE |
| property_rules | service_role | INSERT |
| property_rules | service_role | SELECT |
| property_rules | service_role | UPDATE |
| recent_searches | authenticated | DELETE |
| recent_searches | authenticated | INSERT |
| recent_searches | authenticated | SELECT |
| recent_searches | authenticated | UPDATE |
| recent_searches | service_role | DELETE |
| recent_searches | service_role | INSERT |
| recent_searches | service_role | SELECT |
| recent_searches | service_role | UPDATE |
| recurring_invoices | authenticated | SELECT |
| recurring_invoices | service_role | DELETE |
| recurring_invoices | service_role | INSERT |
| recurring_invoices | service_role | SELECT |
| recurring_invoices | service_role | UPDATE |
| rental_agreements | authenticated | SELECT |
| rental_agreements | service_role | DELETE |
| rental_agreements | service_role | INSERT |
| rental_agreements | service_role | SELECT |
| rental_agreements | service_role | UPDATE |
| room_facilities | authenticated | DELETE |
| room_facilities | authenticated | INSERT |
| room_facilities | authenticated | SELECT |
| room_facilities | authenticated | UPDATE |
| room_facilities | service_role | DELETE |
| room_facilities | service_role | INSERT |
| room_facilities | service_role | SELECT |
| room_facilities | service_role | UPDATE |
| rooms | authenticated | DELETE |
| rooms | authenticated | INSERT |
| rooms | authenticated | SELECT |
| rooms | service_role | DELETE |
| rooms | service_role | INSERT |
| rooms | service_role | SELECT |
| rooms | service_role | UPDATE |
| tenants | authenticated | SELECT |
| tenants | service_role | DELETE |
| tenants | service_role | INSERT |
| tenants | service_role | SELECT |
| tenants | service_role | UPDATE |
| transactions | authenticated | SELECT |
| transactions | service_role | DELETE |
| transactions | service_role | INSERT |
| transactions | service_role | SELECT |
| transactions | service_role | UPDATE |
| user_roles | authenticated | SELECT |
| user_roles | service_role | DELETE |
| user_roles | service_role | INSERT |
| user_roles | service_role | SELECT |
| user_roles | service_role | UPDATE |
| user_settings | authenticated | SELECT |
| user_settings | service_role | DELETE |
| user_settings | service_role | INSERT |
| user_settings | service_role | SELECT |
| user_settings | service_role | UPDATE |

## UPDATE per kolom

Selain izin tabel di atas, browser hanya memperoleh UPDATE kolom berikut.

| Tabel | Kolom | Role |
| --- | --- | --- |
| notifications | read_at | authenticated |
| profiles | display_name | authenticated |
| profiles | phone | authenticated |
| properties | address | authenticated |
| properties | base_rent | authenticated |
| properties | description | authenticated |
| properties | gender_policy | authenticated |
| properties | location | authenticated |
| properties | name | authenticated |
| properties | publication_status | authenticated |
| properties | room_size | authenticated |
| property_facilities | created_at | authenticated |
| property_facilities | facility_id | authenticated |
| property_facilities | id | authenticated |
| property_facilities | property_id | authenticated |
| property_facilities | updated_at | authenticated |
| property_images | alt_text | authenticated |
| property_images | created_at | authenticated |
| property_images | id | authenticated |
| property_images | image_path | authenticated |
| property_images | position | authenticated |
| property_images | property_id | authenticated |
| property_images | updated_at | authenticated |
| property_landmarks | created_at | authenticated |
| property_landmarks | distance_label | authenticated |
| property_landmarks | id | authenticated |
| property_landmarks | is_illustrative | authenticated |
| property_landmarks | name | authenticated |
| property_landmarks | property_id | authenticated |
| property_landmarks | updated_at | authenticated |
| property_rules | created_at | authenticated |
| property_rules | id | authenticated |
| property_rules | position | authenticated |
| property_rules | property_id | authenticated |
| property_rules | rule_text | authenticated |
| property_rules | updated_at | authenticated |
| recent_searches | created_at | authenticated |
| recent_searches | id | authenticated |
| recent_searches | query | authenticated |
| recent_searches | updated_at | authenticated |
| recent_searches | user_id | authenticated |
| room_facilities | created_at | authenticated |
| room_facilities | facility_id | authenticated |
| room_facilities | id | authenticated |
| room_facilities | room_id | authenticated |
| room_facilities | updated_at | authenticated |
| rooms | number | authenticated |
| rooms | operational_status | authenticated |
| rooms | rent | authenticated |
| rooms | room_type | authenticated |
| user_settings | compact_mode | authenticated |
| user_settings | notifications_enabled | authenticated |
| user_settings | sidebar_collapsed | authenticated |

## EXECUTE fungsi public

| Fungsi / argumen | SECURITY DEFINER | anon | authenticated | service_role |
| --- | --- | --- | --- | --- |
| generate_payment_reminders() | true | false | true | false |
| mark_conversation_read(target_conversation uuid) | true | false | true | false |
| open_conversation(target_property uuid) | true | false | true | false |
| owner_check_in(target_tenant uuid, target_room uuid, starts date, ends date, monthly_rent bigint, due_day smallint) | true | false | true | false |
| owner_close_agreement(target_agreement uuid, close_date date, reason text) | true | false | true | false |
| owner_create_invoice(target_agreement uuid, billing_month date, due_on date, rent_amount bigint, invoice_notes text) | true | false | true | false |
| owner_create_invoices_bulk(target_agreements uuid[], billing_month date, due_on date, fixed_rent bigint, invoice_notes text) | true | false | true | false |
| owner_delete_property(target_property uuid) | true | false | true | false |
| owner_financial_report(target_property uuid, from_date date, to_date date) | true | false | true | false |
| owner_generate_recurring(billing_month date) | true | false | true | false |
| owner_monthly_revenue(target_property uuid, from_date date, to_date date) | true | false | true | false |
| owner_send_reminder(target_invoice uuid) | true | false | true | false |
| owner_set_recurring(target_agreement uuid, rent_amount bigint, due_day smallint, starts date, enabled boolean) | true | false | true | false |
| owner_transfer_agreement(target_agreement uuid, target_room uuid, moving_on date, ends date, monthly_rent bigint, due_day smallint) | true | false | true | false |
| owner_update_invoice(target_invoice uuid, rent_amount bigint, due_on date, invoice_notes text, cancel boolean) | true | false | true | false |
| platform_financial_report() | true | false | true | false |
| public_listings() | true | true | true | true |
| record_listing_event(target_property uuid, event_kind text, event_session uuid) | true | false | true | false |
| send_message(target_conversation uuid, message_body text) | true | false | true | false |
| server_grant_role(target_user uuid, target_role text) | true | false | false | true |
| server_record_boost(target_property uuid, payment_key text, succeeded boolean, payment_method text, simulated boolean) | true | false | false | true |
| server_record_rent_payment(target_invoice uuid, payment_key text, succeeded boolean, payment_method text, simulated boolean, paid_at timestamp with time zone) | true | false | false | true |
| tenant_create_complaint(target_agreement uuid, ticket_title text, ticket_description text, ticket_category text, ticket_urgency text) | true | false | true | false |
| transition_complaint(target_complaint uuid, next_status text, treatment_note text, final_category text, final_priority text, eta date) | true | false | true | false |

## Batas verifikasi

Tes native PostgreSQL menjalankan policy/GRANT sebagai role SQL anon/authenticated/service_role serta claim Auth kontrak. Ini memverifikasi SQL, bukan verifikasi JWT oleh gateway atau GoTrue. Penerapan remote dan inspeksi katalog RLS/grants telah berhasil setelah persetujuan pengguna; lihat [hasil remote](REMOTE_DEPLOYMENT.md). Pengujian JWT/HTTP dan Auth Admin nyata masih terpisah; Docker diperlukan untuk stack Supabase lokal, bukan untuk akses hosted. Izin upload, gateway pembayaran, realtime, scheduler dan integrasi frontend belum dibuka pada Phase 1. Lihat [laporan pemeriksaan](VERIFICATION.md).

Rujukan: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [user profiles Auth](https://supabase.com/docs/guides/auth/managing-user-data), [database functions](https://supabase.com/docs/guides/database/functions).
