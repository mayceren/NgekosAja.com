-- Read-only remote catalogue inspection. No application row values or credentials.
select jsonb_build_object(
 'server_version', current_setting('server_version'),
 'database_name', current_database(),
 'inspection_role',current_user,
 'inspection_session_role',session_user,
 'migration_prerequisites', jsonb_build_object(
   'public_schema_create',has_schema_privilege(current_user,'public','CREATE'),
   'auth_users_trigger',has_table_privilege(current_user,'auth.users','TRIGGER'),
   'database_create',has_database_privilege(current_user,current_database(),'CREATE'),
   'btree_gist_available',exists(select 1 from pg_available_extensions where name='btree_gist'),
   'postgres_current_role',current_user='postgres'
 ),
 'auth_user_count', (select count(*) from auth.users),
 'application_relations', coalesce((
   select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'estimated_rows',c.reltuples::bigint) order by n.nspname,c.relname)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','private') and c.relkind in ('r','p','v','m')
 ),'[]'::jsonb),
 'application_functions', coalesce((
   select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef) order by n.nspname,p.proname)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
 ),'[]'::jsonb),
 'auth_user_triggers',coalesce((
   select jsonb_agg(jsonb_build_object('name',t.tgname,'function_schema',n.nspname,'function',p.proname))
   from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
   where t.tgrelid='auth.users'::regclass and not t.tgisinternal
 ),'[]'::jsonb),
 'extensions',coalesce((select jsonb_agg(jsonb_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion) order by e.extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'policy',policyname,'command',cmd,'roles',roles) order by tablename,policyname) from pg_policies where schemaname in ('public','private')),'[]'::jsonb),
 'migration_history_exists',to_regclass('supabase_migrations.schema_migrations') is not null,
 'api_roles',coalesce((select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit)) from pg_roles where rolname in ('anon','authenticated','service_role')),'[]'::jsonb),
 'api_schema_settings',coalesce((select jsonb_agg(jsonb_build_object('role',r.rolname,'setting',s.setting)) from pg_db_role_setting ds join pg_roles r on r.oid=ds.setrole cross join lateral unnest(ds.setconfig) s(setting) where s.setting like 'pgrst.db_schemas=%'),'[]'::jsonb),
 'default_privileges',coalesce((select jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',coalesce(n.nspname,'<global>'),'object_type',d.defaclobjtype,'acl',d.defaclacl::text)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclnamespace=0 or n.nspname in ('public','private')),'[]'::jsonb)
) as preflight;
