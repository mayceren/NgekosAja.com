-- Dry-run inventory only; excludes all referenced historical files.
-- Paths and personal identifiers deliberately omitted from report output.
select u.bucket_id,u.state,count(*)::int candidates,min(u.created_at) oldest
from public.media_uploads u join storage.objects o on o.bucket_id=u.bucket_id and o.name=u.object_path
where u.created_at<now()-interval '24 hours' and not private.media_in_use(u.bucket_id,u.object_path)
group by u.bucket_id,u.state order by u.bucket_id,u.state;
