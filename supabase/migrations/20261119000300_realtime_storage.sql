-- Phase 4 additive upgrade. Pending explicit remote approval.
begin;
alter table public.profiles add column avatar_path text;
alter table public.messages add column client_key uuid;
create unique index messages_client_key_idx on public.messages(sender_id,client_key) where client_key is not null;
create table public.room_images (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 image_path text not null, alt_text text not null default '', position integer not null check(position between 0 and 3),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(room_id,position)
);
select private.secure_table('public.room_images');
create policy room_images_read on public.room_images for select to authenticated using(private.owns_room(room_id) or private.is_admin() or exists(select 1 from public.rental_agreements a where a.room_id=room_images.room_id and a.tenant_id=auth.uid()));
-- Metadata writes happen only through atomic RPCs, never arbitrary browser paths.
revoke insert,update,delete on public.property_images from authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
select id,id,false,case when id='avatars' then 512000 else 1048576 end,array['image/jpeg','image/png','image/webp']
from unnest(array['property-images','room-images','avatars','complaint-attachments','chat-attachments']) id
on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id in ('property-images','room-images','avatars','complaint-attachments','chat-attachments') and
 (public or file_size_limit is distinct from case when id='avatars' then 512000::bigint else 1048576::bigint end or allowed_mime_types is distinct from array['image/jpeg','image/png','image/webp'])) then raise exception 'Existing bucket configuration differs; review required'; end if;
end $$;
create table public.media_uploads (
 id uuid primary key default gen_random_uuid(),uploader_id uuid not null references public.profiles(id) on delete restrict,
 kind text not null check(kind in ('property','room','avatar','complaint','chat')),scope_id uuid not null,
 bucket_id text not null references storage.buckets(id) on delete restrict,object_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),size_bytes integer not null check(size_bytes between 1 and 1048576),
 state text not null default 'staged' check(state in ('staged','finalized')),
 message_id uuid references public.messages(id) on delete restrict,complaint_id uuid references public.complaints(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
select private.secure_table('public.media_uploads');
create policy media_uploads_self on public.media_uploads for select to authenticated using(uploader_id=auth.uid());
create index media_uploads_uploader_idx on public.media_uploads(uploader_id,created_at);
create index media_uploads_scope_idx on public.media_uploads(kind,scope_id);
create index media_uploads_message_idx on public.media_uploads(message_id);
create index media_uploads_complaint_idx on public.media_uploads(complaint_id);

create function private.media_scope_allowed(k text,s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and case k when 'property' then private.owns_property(s) when 'room' then private.owns_room(s)
 when 'avatar' then s=auth.uid() when 'chat' then private.is_member(s)
 when 'complaint' then exists(select 1 from public.rental_agreements where id=s and tenant_id=auth.uid() and status='active') else false end
$$;
create function private.media_in_use(b text,p text) returns boolean language sql stable security definer set search_path='' as $$
 select case b
 when 'property-images' then exists(select 1 from public.property_images where image_path='cloud:'||b||'/'||p)
 when 'room-images' then exists(select 1 from public.room_images where image_path='cloud:'||b||'/'||p)
 when 'avatars' then exists(select 1 from public.profiles where avatar_path='cloud:'||b||'/'||p)
 when 'complaint-attachments' then exists(select 1 from public.complaint_attachments where storage_path=p)
 when 'chat-attachments' then exists(select 1 from public.message_attachments where storage_path=p) else false end
$$;
create function private.media_readable(b text,p text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media_uploads u where u.bucket_id=b and u.object_path=p and u.uploader_id=auth.uid()) or case b
 when 'property-images' then exists(select 1 from public.property_images i join public.properties pr on pr.id=i.property_id where i.image_path='cloud:'||b||'/'||p and (pr.publication_status='published' or private.property_party(pr.id)))
 when 'room-images' then exists(select 1 from public.room_images i where i.image_path='cloud:'||b||'/'||p and (private.owns_room(i.room_id) or private.is_admin() or exists(select 1 from public.rental_agreements a where a.room_id=i.room_id and a.tenant_id=auth.uid())))
 when 'avatars' then exists(select 1 from public.profiles pr where pr.avatar_path='cloud:'||b||'/'||p and (pr.id=auth.uid() or private.related_tenant(pr.id) or private.is_admin() or exists(select 1 from public.conversation_members m join public.conversation_members me on me.conversation_id=m.conversation_id and me.user_id=auth.uid() where m.user_id=pr.id)))
 when 'complaint-attachments' then exists(select 1 from public.complaint_attachments a where a.storage_path=p and private.can_read_complaint(a.complaint_id))
 when 'chat-attachments' then exists(select 1 from public.message_attachments a join public.messages m on m.id=a.message_id where a.storage_path=p and (private.is_member(m.conversation_id) or private.is_admin())) else false end
$$;
create function private.media_insertable(b text,p text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media_uploads where bucket_id=b and object_path=p and uploader_id=auth.uid() and state='staged' and private.media_scope_allowed(kind,scope_id))
$$;
create function private.media_deletable(b text,p text) returns boolean language sql volatile security definer set search_path='' as $$
 -- Serialize deletion against finalization: a referenced object can never be removed.
 select exists(select 1 from public.media_uploads where bucket_id=b and object_path=p and uploader_id=auth.uid() and state='staged' for update) and not private.media_in_use(b,p)
$$;
grant usage on schema private to anon;
grant execute on function private.media_readable(text,text) to anon,authenticated;
grant execute on function private.media_insertable(text,text),private.media_deletable(text,text) to authenticated;
create policy ngekosaja_media_read on storage.objects for select to anon,authenticated using(private.media_readable(bucket_id,name));
create policy ngekosaja_media_insert on storage.objects for insert to authenticated with check(private.media_insertable(bucket_id,name));
create policy ngekosaja_media_delete on storage.objects for delete to authenticated using(private.media_deletable(bucket_id,name));
-- No UPDATE/upsert policy: bytes cannot change after a message/photo is finalized.
create function public.begin_media_upload(media_kind text,target_scope uuid,file_mime text,file_size integer) returns public.media_uploads language plpgsql security definer set search_path='' as $$
declare u public.media_uploads; b text;
begin
 if not private.media_scope_allowed(media_kind,target_scope) then raise insufficient_privilege; end if;
 if file_mime not in ('image/jpeg','image/png','image/webp') or file_size is null or file_size<1 or file_size>(case when media_kind='avatar' then 512000 else 1048576 end) then raise exception 'Invalid file'; end if;
 -- A bounded staging budget, not an assertion of magic-byte validation.
 if (select count(*) from public.media_uploads where uploader_id=auth.uid() and created_at>now()-interval '1 hour' and state='staged')>=100 then raise exception 'Upload budget exceeded'; end if;
 b:=case media_kind when 'property' then 'property-images' when 'room' then 'room-images' when 'avatar' then 'avatars' when 'complaint' then 'complaint-attachments' else 'chat-attachments' end;
 insert into public.media_uploads(uploader_id,kind,scope_id,bucket_id,object_path,mime_type,size_bytes)
 values(auth.uid(),media_kind,target_scope,b,target_scope||'/'||gen_random_uuid()||case file_mime when 'image/jpeg' then '.jpg' when 'image/png' then '.png' else '.webp' end,file_mime,file_size) returning * into u;
 return u;
end $$;
create function private.finalize_media(b text,p text,k text,s uuid) returns public.media_uploads language plpgsql security definer set search_path='' as $$
declare u public.media_uploads; meta jsonb;
begin
 select * into u from public.media_uploads where bucket_id=b and object_path=p for update;
 if u.id is null or u.uploader_id<>auth.uid() or u.kind<>k or u.scope_id<>s or not private.media_scope_allowed(k,s) then raise insufficient_privilege; end if;
 select metadata into meta from storage.objects where bucket_id=b and name=p;
 if meta is null or meta->>'mimetype' is distinct from u.mime_type or (meta->>'size')::bigint is distinct from u.size_bytes::bigint then raise exception 'Uploaded object metadata mismatch'; end if;
 update public.media_uploads set state='finalized' where id=u.id;
 return u;
end $$;
create function public.media_upload_status(upload_ids uuid[]) returns table(id uuid,bucket_id text,object_path text,in_use boolean,object_exists boolean) language sql stable security definer set search_path='' as $$
 select u.id,u.bucket_id,u.object_path,private.media_in_use(u.bucket_id,u.object_path),exists(select 1 from storage.objects o where o.bucket_id=u.bucket_id and o.name=u.object_path)
 from public.media_uploads u where u.id=any(upload_ids) and u.uploader_id=auth.uid() limit 100
$$;
alter function public.owner_save_property(jsonb) set schema private;
alter function private.owner_save_property(jsonb) rename to save_property_local;
revoke all on function private.save_property_local(jsonb) from public,anon,authenticated,service_role;
create function public.owner_save_property(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid; item jsonb; pos integer:=0; original jsonb:=coalesce(payload->'images','[]'); path text;
begin
 if jsonb_typeof(original)<>'array' or jsonb_array_length(original)>8 then raise exception 'Maximum 8 photos'; end if;
 -- The preserved implementation still validates every legacy illustration.
 pid:=private.save_property_local(jsonb_set(payload,'{images}',coalesce((select jsonb_agg(x) from jsonb_array_elements(original) x where x->>'path' not like 'cloud:%'),'[]')));
 delete from public.property_images where property_id=pid;
 for item in select * from jsonb_array_elements(original) loop
  path:=item->>'path';
  if path like 'cloud:%' then perform private.finalize_media('property-images',substring(path from 23),'property',pid);
   if path not like 'cloud:property-images/%' then raise exception 'Invalid bucket'; end if;
  end if;
  insert into public.property_images(property_id,image_path,alt_text,position) values(pid,path,left(coalesce(item->>'alt',''),200),pos);pos:=pos+1;
 end loop;
 return pid;
end $$;
alter function public.owner_save_room(jsonb) set schema private;
alter function private.owner_save_room(jsonb) rename to save_room_local;
revoke all on function private.save_room_local(jsonb) from public,anon,authenticated,service_role;
create function public.owner_save_room(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; item jsonb; pos integer:=0; path text;
begin
 rid:=private.save_room_local(payload);
 if payload ? 'images' then
  if jsonb_typeof(payload->'images')<>'array' or jsonb_array_length(payload->'images')>4 then raise exception 'Maximum 4 photos'; end if;
  delete from public.room_images where room_id=rid;
  for item in select * from jsonb_array_elements(payload->'images') loop
   path:=item->>'path';if path not like 'cloud:room-images/%' then raise exception 'Invalid room photo'; end if;
   perform private.finalize_media('room-images',substring(path from 19),'room',rid);
   insert into public.room_images(room_id,image_path,alt_text,position) values(rid,path,left(coalesce(item->>'alt',''),200),pos);pos:=pos+1;
  end loop;
 end if;
 return rid;
end $$;
create function public.set_my_avatar(image_ref text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if image_ref is not null then
  if image_ref not like 'cloud:avatars/%' then raise exception 'Invalid avatar'; end if;
  perform private.finalize_media('avatars',substring(image_ref from 15),'avatar',auth.uid());
 end if;
 update public.profiles set avatar_path=image_ref where id=auth.uid();
end $$;
create function public.send_message_media(target_conversation uuid,message_body text,request_key uuid,upload_ids uuid[] default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid; existing public.messages; uid uuid; u public.media_uploads;
begin
 if not private.is_member(target_conversation) or request_key is null then raise insufficient_privilege; end if;
 if message_body is null or char_length(message_body)>1000 or cardinality(upload_ids)>4 or cardinality(upload_ids)<>(select count(distinct x) from unnest(upload_ids) x) then raise exception 'Invalid message'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||request_key::text,0));
 select * into existing from public.messages where sender_id=auth.uid() and client_key=request_key;
 if existing.id is not null then
  if existing.conversation_id<>target_conversation or existing.body<>btrim(message_body) or (select coalesce(array_agg(id order by id),'{}'::uuid[]) from public.media_uploads where message_id=existing.id) is distinct from (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(upload_ids) x) then raise exception 'Idempotency key conflict'; end if;
  return existing.id;
 end if;
 if btrim(message_body)='' and cardinality(upload_ids)=0 then raise exception 'Empty message'; end if;
 insert into public.messages(conversation_id,sender_id,body,client_key) values(target_conversation,auth.uid(),btrim(message_body),request_key) returning id into mid;
 foreach uid in array upload_ids loop
  select * into u from public.media_uploads where id=uid;
  if u.id is null or u.message_id is not null then raise exception 'Invalid attachment'; end if;
  u:=private.finalize_media('chat-attachments',u.object_path,'chat',target_conversation);
  insert into public.message_attachments(message_id,storage_path,mime_type,size_bytes) values(mid,u.object_path,u.mime_type,u.size_bytes);
  update public.media_uploads set message_id=mid where id=u.id;
 end loop;
 update public.conversations set updated_at=clock_timestamp() where id=target_conversation;
 return mid;
end $$;
create function public.tenant_create_complaint_media(target_agreement uuid,ticket_title text,ticket_description text,ticket_category text,ticket_urgency text,upload_ids uuid[] default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; uid uuid; u public.media_uploads;
begin
 if cardinality(upload_ids)>4 or cardinality(upload_ids)<>(select count(distinct x) from unnest(upload_ids) x) then raise exception 'Maximum 4 attachments'; end if;
 -- Uploaded IDs also serve as a retry key for attachment-bearing reports.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||target_agreement::text,0));
 select complaint_id into cid from public.media_uploads where id=any(upload_ids) and uploader_id=auth.uid() and complaint_id is not null limit 1;
 if cid is not null then
  if (select coalesce(array_agg(id order by id),'{}'::uuid[]) from public.media_uploads where complaint_id=cid and uploader_id=auth.uid()) is distinct from (select coalesce(array_agg(x order by x),'{}'::uuid[]) from unnest(upload_ids) x) or not exists(select 1 from public.complaints where id=cid and agreement_id=target_agreement and title=btrim(ticket_title) and description=btrim(ticket_description) and category=ticket_category and urgency=ticket_urgency) then raise exception 'Retry conflict'; end if;
  return cid;
 end if;
 cid:=public.tenant_create_complaint(target_agreement,ticket_title,ticket_description,ticket_category,ticket_urgency);
 foreach uid in array upload_ids loop
  select * into u from public.media_uploads where id=uid;
  if u.id is null or u.complaint_id is not null then raise exception 'Invalid attachment'; end if;
  u:=private.finalize_media('complaint-attachments',u.object_path,'complaint',target_agreement);
  insert into public.complaint_attachments(complaint_id,uploaded_by,storage_path,mime_type,size_bytes) values(cid,auth.uid(),u.object_path,u.mime_type,u.size_bytes);
  update public.media_uploads set complaint_id=cid where id=u.id;
 end loop;
 return cid;
end $$;
create function public.phase4_capabilities() returns jsonb language sql stable set search_path='' as $$ select '{"version":4,"storage":true,"realtime":true,"typing":false,"presence":false}'::jsonb $$;
create function public.conversation_avatars(target_conversation uuid) returns table(user_id uuid,display_name text,avatar_path text) language sql stable security definer set search_path='' as $$
 select p.id,p.display_name,p.avatar_path from public.conversation_members m join public.profiles p on p.id=m.user_id where m.conversation_id=target_conversation and private.is_member(target_conversation)
$$;
grant execute on function public.conversation_avatars(uuid) to authenticated;
create or replace function public.conversation_directory() returns table(id uuid,property_id uuid,property_name text,prospect_id uuid,counterpart_name text,updated_at timestamptz,unread_count bigint,last_message text) language sql stable security definer set search_path='' as $$
 select c.id,c.property_id,p.name,c.prospect_id,pr.display_name,c.updated_at,
 (select count(*) from public.messages msg where msg.conversation_id=c.id and msg.sender_id<>auth.uid() and (m.last_read_at is null or msg.created_at>m.last_read_at)),
 (select coalesce(nullif(left(msg.body,100),''),'Lampiran foto') from public.messages msg where msg.conversation_id=c.id order by msg.created_at desc,msg.id desc limit 1)
 from public.conversations c join public.properties p on p.id=c.property_id
 join public.conversation_members m on m.conversation_id=c.id and m.user_id=auth.uid()
 join public.profiles pr on pr.id=case when c.prospect_id=auth.uid() then p.owner_id else c.prospect_id end
 order by c.updated_at desc,c.id limit 100
$$;
grant execute on function public.phase4_capabilities() to anon,authenticated;
grant execute on function public.begin_media_upload(text,uuid,text,integer),public.media_upload_status(uuid[]),public.owner_save_property(jsonb),public.owner_save_room(jsonb),public.set_my_avatar(text),public.send_message_media(uuid,text,uuid,uuid[]),public.tenant_create_complaint_media(uuid,text,text,text,text,uuid[]) to authenticated;
do $$ declare t text; begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime with(publish='insert,update'); end if;
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and (schemaname<>'public' or tablename not in ('messages','notifications','complaints','complaint_histories','invoices','rental_offers','rental_agreements','rooms','conversation_members','properties'))) then raise exception 'Unexpected publication members; review required'; end if;
 alter publication supabase_realtime set(publish='insert,update');
 foreach t in array array['messages','notifications','complaints','complaint_histories','invoices','rental_offers','rental_agreements','rooms','conversation_members','properties'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
 end loop;
end $$;
commit;
