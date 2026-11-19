with p as(select pubname,puballtables,pubinsert,pubupdate,pubdelete,pubtruncate from pg_publication where pubname='supabase_realtime')
select jsonb_build_object(
 'history',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'application_tables',(select count(*) from pg_tables where schemaname='public'),
 'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'),
 'policies',(select count(*) from pg_policies where schemaname='public'),
 'public_functions',(select count(*) from pg_proc f join pg_namespace n on n.oid=f.pronamespace where n.nspname='public'),
 'rls_disabled',(select count(*) from pg_tables where schemaname='public' and not rowsecurity),
 'publication',(select to_jsonb(p) from p),
 'published_tables',coalesce((select jsonb_agg(tablename order by tablename) from pg_publication_tables where pubname='supabase_realtime'),'[]'::jsonb),
 'buckets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets),'[]'::jsonb),
 'storage_policies',coalesce((select jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'roles',roles) order by policyname) from pg_policies where schemaname='storage' and tablename='objects'),'[]'::jsonb),
 'storage_columns',(select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='storage' and table_name='objects'),
 'profiles',(select count(*) from public.profiles),
 'properties',(select count(*) from public.properties),
 'published_properties',(select count(*) from public.properties where publication_status='published'),
 'messages',(select count(*) from public.messages),
 'development_accounts',(select jsonb_agg(jsonb_build_object('label',d.label,'auth_present',u.id is not null,'profile_present',p.id is not null,'roles',(select jsonb_agg(role order by role) from public.user_roles where user_id=u.id)) order by d.label)
 from (values ('Prospect','dev-prospect@ngekosaja.test'),('Tenant A','dev-tenant-a@ngekosaja.test'),('Tenant B','dev-tenant-b@ngekosaja.test'),('Owner A','dev-owner-a@ngekosaja.test'),('Owner B','dev-owner-b@ngekosaja.test'),('Administrator','dev-admin@ngekosaja.test')) d(label,email)
 left join auth.users u on u.email=d.email left join public.profiles p on p.id=u.id)
) phase4_preflight;
