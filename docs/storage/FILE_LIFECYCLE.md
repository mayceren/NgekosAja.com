# File lifecycle and orphan review

1. Validate/re-encode before upload; `begin_media_upload` authorizes exact kind/scope and returns a random path.
2. SDK uploads without upsert to a private bucket. A staging record alone never makes a listing public.
3. Save RPC locks staging records, checks uploader, scope, actual storage.objects MIME/size and inserts references in one PostgreSQL transaction. Property/room headers, gallery order and cloud metadata roll back together. Message body and attachment rows satisfy the deferred text-or-attachment constraint at commit.
4. Only after commit does the UI report success. `messages(sender_id,client_key)` uniqueness plus transaction advisory locking serialize duplicate/retried sends. Same key with different content/uploads is rejected. Attachment-bearing complaint retry checks the exact attachment set and report fields. Text-only complaint submission retains the existing Phase 3 behavior.
5. On cancel/failure/timeout, `media_upload_status` checks authoritative references before compensation. Pending message uploads are retained for retry. If the query/session fails or commit is uncertain, keep the object; never assume rollback. Row locking and staged-only DELETE prevent cleanup from deleting finalized bytes.

Old avatar/gallery files are retained after metadata replacement. Finalized files are not client-deletable even if later unreferenced. This conservative rule protects histories and concurrent saves. Complaint/message references are historical and are never garbage-collected while referenced.

`supabase/review/phase4-orphans.sql` is a **read-only** aggregate inventory of objects older than 24 hours without references. It lists counts/age by bucket/state, no personal filenames. Run it only after migration 14. There is no automatic remote deletion job. Bulk cleanup needs a fresh inventory, reference recheck under lock and explicit approval, through a trusted administrative procedure. Do not delete directly from storage.objects: actual bytes must be removed through Storage API. Staging metadata is retained for audit; the current per-user 100-staged-uploads/hour budget ages out naturally.

On logout/account change, clear private URL cache, drafts, pending sends and preview Blob URLs, and stop old subscriptions. Cancel cleanup is attempted only under the original current identity. Orphans may remain after network loss or closing a tab; these are preferable to deleting a committed historic attachment.
