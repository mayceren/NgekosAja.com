# Bucket policies

All five buckets are private. These rules depend on actual relational ownership/membership and exact staging records, not secrecy of UUID paths. The browser receives no service-role key.

| Bucket | Upload/finalize | Read referenced objects | Delete |
| --- | --- | --- | --- |
| property-images | Property owner | Anyone while the referenced property is published; authorized property parties for draft/archive | Uploader's unfinalized, unreferenced staging only |
| room-images | Room's property owner | Room owner, its current/historic tenant, explicit platform administrator | Same staging rule |
| avatars | Current user only | Self, related tenant's owner, legitimate shared-conversation participant, explicit administrator | Same staging rule |
| complaint-attachments | Tenant's own active agreement; atomic complaint creation | Parties authorized to read the actual complaint, including explicit admin | Same staging rule; historic attachment is never deleted |
| chat-attachments | Legitimate conversation member; server derives sender | Actual members, explicit administrator as in existing message read policy | Same staging rule; historic attachment is never deleted |

An uploader may inspect their own staged objects. Anonymous users cannot read unfinalized property uploads. Published-property images become inaccessible for new signatures when the listing is draft/archived. Existing signed URLs remain usable until expiry; changing RLS or publication status cannot instantly revoke an already-issued URL. Do not place sensitive documents in public listing images. See [Supabase signing behavior](https://supabase.com/docs/guides/storage/security/signing-keys).

Storage INSERT requires an exact self-owned staging record and a currently authorized scope. Bucket MIME and size restrictions apply at the actual Storage service. No UPDATE/upsert policy is created: overwriting committed media is denied. SELECT checks actual references, and DELETE locks the staging row and denies finalized objects. Browser writes to property-image metadata are revoked in favor of the atomic owner save RPC. New avatar metadata is not included in direct profile UPDATE grants.

Three policies are added to storage.objects: `ngekosaja_media_read`, `ngekosaja_media_insert`, `ngekosaja_media_delete`. Native tests model storage.objects RLS but do not emulate the Storage HTTP service's MIME/size processing. Exact Cloud policies and signed URL issuance must still be tested after approval.
