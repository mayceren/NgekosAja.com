-- Metadata only, intended AFTER a separately approved migration. No RPC execution.
select jsonb_build_object(
 'history',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'tables',(select count(*) from pg_tables where schemaname='public'),
 'rls_disabled',(select count(*) from pg_tables where schemaname='public' and not rowsecurity),
 'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and contype='f'),
 'policies',(select count(*) from pg_policies where schemaname='public'),
 'public_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'server_functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'browser',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('server_simulate_payment','server_record_rent_payment','server_record_boost')),
 'browser_attempt_write',has_table_privilege('authenticated','public.payment_attempts','INSERT,UPDATE,DELETE'),
 'simulator_enabled',(select enabled from private.payment_simulator_settings where singleton),
 'browser_config_read',has_table_privilege('authenticated','private.payment_simulator_settings','SELECT'),
 'published_tables',(select jsonb_agg(tablename order by tablename) from pg_publication_tables where pubname='supabase_realtime'),
 'publication',(select jsonb_build_object('insert',pubinsert,'update',pubupdate,'delete',pubdelete,'truncate',pubtruncate) from pg_publication where pubname='supabase_realtime'),
 'unsafe_definers',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false)),
 'invalid_constraints',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and not c.convalidated),
 'invalid_indexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (not i.indisvalid or not i.indisready))
) phase5_postflight;
