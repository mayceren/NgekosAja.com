# Upload guide

Run the website using `npm run dev` or VS Code Live Server, then sign in. Phase 4 upload controls activate only after the migration capability RPC exists. Before remote approval, Phase 3 text chat and local listing illustrations continue to work.

- Property: save the property first, open Edit, select/drop photos, use the star to set cover, arrows to reorder, × to remove, then Save. Maximum eight, including legacy illustrations. Replacing a photo means removing its gallery reference and selecting a new file; old bytes are not removed before commit.
- Room: save the room first, open Edit, add/replace/remove up to four photos, then Save. Private room galleries stay out of the anonymous catalogue.
- Avatar: Account → Informasi Pribadi → Foto profil. Select a photo and Save, or Hapus foto. The browser center-crops to a square; initials remain the fallback.
- Complaint: choose the correct active agreement, select up to four photos, then submit the report. Remove selected photos before changing agreements. Owner sees authorized thumbnails in the complaint detail viewer.
- Chat: select up to four photos in the composer; optional text. Send. Pending status becomes successful only after the database RPC returns or its persisted row is fetched. Retry reuses the original request key. Click a thumbnail for viewer, zoom and image retry.

Input limit is 8 MB before decoding, accepted signatures/MIME are JPEG/PNG/WebP, encoded dimensions must be valid, at most 12,000 on either axis and 24 megapixels total. The client reads dimensions before decoding. Canvas re-encodes, strips original EXIF, resizes to max 2048 px for property/room, 1200 px for attachments, square max512 avatar, and tries WebP quality .85/.7/.55/.4 within output limits. Unsupported compression or corrupt files show an error; no original file is uploaded as fallback.

Processing/upload uses honest loading text; no fake percentage. Cancelling the form removes confirmed-unused staging uploads when possible. In-flight SDK uploads are not abortable by this UI; finishing after cancellation triggers safe compensation. A failed network/upload can be retried by selecting the file again; failed persisted message attempts use Kirim ulang. Drafts/pending sends are memory-only and cannot be recovered after closing/reloading the browser.

Security limit: browser signature checks and Canvas re-encoding are not trusted server content inspection. Buckets enforce declared MIME/size and finalization compares actual Storage metadata, but a custom client can upload malformed bytes with a misleading content type. No malware scanner or server raster decoder is installed. Treat this as a development/UAS implementation, not a production upload-security certification. SVG/HTML/executables are not permitted; photos must still be treated as untrusted content.
