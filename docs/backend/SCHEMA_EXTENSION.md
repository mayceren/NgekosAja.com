# Phase 3 schema extension and data dictionary

This document describes the Phase 3 migration applied to Cloud after user approval. Existing Phase 1 schema/ERD/dictionary documents remain the historical baseline. Current Cloud metadata is recorded in [postflight](remote-apply-results.json).

`rental_offers` stores explicit consent before initial placement. No credentials, email ownership proof or payments are stored here.

| Column | Type | Null / default / relation |
| --- | --- | --- |
| id | uuid | PK, generated |
| conversation_id | uuid | Required FK conversations, deletion restricted |
| owner_id | uuid | Required FK profiles, deletion restricted; derived from JWT |
| tenant_id | uuid | Required FK profiles, deletion restricted; derived from conversation |
| room_id | uuid | Required FK rooms, deletion restricted |
| property_name_snapshot | text | Required; server reads property name |
| room_number_snapshot | text | Required; server reads room number |
| start_date | date | Required |
| end_date | date | Required; at least start_date |
| rent | bigint | Required, 100000–100000000 integer rupiah |
| payment_day | smallint | Required, 1–28 |
| status | text | Required, pending by default; pending/accepted/declined/placed |
| expires_at | timestamptz | Required, seven days from creation |
| responded_at | timestamptz | Null until actual tenant accepts/declines |
| agreement_id | uuid | Nullable unique FK rental_agreements, required when placed; deletion restricted |
| created_at | timestamptz | Required, now() |
| updated_at | timestamptz | Required, now(); touch trigger |

Owner and tenant must differ. Pending requires no response/agreement. Accepted/declined require a response and no agreement. Placed requires response plus agreement. Authenticated clients can only read either-party rows; app admin can read all offers. No browser row mutation grant or policy exists. RPC state transitions/locks are authoritative. Accepted consent must match exact user, room, dates, rent and payment day and remain unexpired before check-in; consumed offers cannot be reused.

Indexes cover owner/created_at, tenant/created_at, room and conversation, alongside PK/unique-agreement indexes. The migration uses `private.secure_table` to enable RLS and timestamp trigger in the creation transaction. No existing RLS policies are removed.

Both local tests and Cloud postflight confirm: 13 migrations, 32 application tables, 53 foreign keys, 46 policies, 30 public functions. Metadata checks: `supabase/review/backend-postflight.sql`; executable expectations: `supabase/tests/backend-contracts.mjs`. All existing application row digests were preserved during migration.

See [API contracts and ERD](API_CONTRACTS.md) for offer-to-agreement flow and the deliberately tightened check-in signature.
