-- Read-only Phase 4 baseline for Phase 5. No Auth records or gateway credentials exported.
select jsonb_build_object(
 'history',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'tables',(select count(*) from pg_tables where schemaname='public'),
 'rls_disabled',(select count(*) from pg_tables where schemaname='public' and not rowsecurity),
 'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and contype='f'),
 'policies',(select count(*) from pg_policies where schemaname='public'),
 'public_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'publication',(select jsonb_build_object('insert',pubinsert,'update',pubupdate,'delete',pubdelete,'truncate',pubtruncate) from pg_publication where pubname='supabase_realtime'),
 'published_tables',(select jsonb_agg(tablename order by tablename) from pg_publication_tables where pubname='supabase_realtime'),
 'buckets',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'limit',file_size_limit,'mimes',allowed_mime_types) order by id) from storage.buckets),
 'auth_user_count',(select count(*) from auth.users),
 'profiles',(select count(*) from public.profiles),'invoices',(select count(*) from public.invoices),'transactions',(select count(*) from public.transactions),'campaigns',(select count(*) from public.boost_campaigns),
 'browser_rent_writer',has_function_privilege('authenticated','public.server_record_rent_payment(uuid,text,boolean,text,boolean,timestamptz)','execute'),
 'browser_boost_writer',has_function_privilege('authenticated','public.server_record_boost(uuid,text,boolean,text,boolean)','execute')
) phase5_preflight;
