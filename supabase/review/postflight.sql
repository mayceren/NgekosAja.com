-- Read-only verification to run ONLY AFTER approved migration application.
-- Never calls payment functions, fixture provisioners, reset or DML.
with application_relations as (
 select c.oid,c.relname,c.relrowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','v','m','p')
), application_tables as (
 select r.* from application_relations r join pg_class c on c.oid=r.oid where c.relkind='r'
), application_functions as (
 select p.*,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private')
)
select jsonb_build_object(
 'server_version',current_setting('server_version'),
 'inspection_role',current_user,
 'inspection_bypass_rls',(select rolbypassrls from pg_roles where rolname=current_user),
 'tables',coalesce((select jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity) order by relname) from application_tables),'[]'::jsonb),
 'table_count',(select count(*) from application_tables),
 'rls_disabled_table_count',(select count(*) from application_tables where not relrowsecurity),
 'policy_count',(select count(*) from pg_policies where schemaname='public'),
 'foreign_key_count',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'),
 'public_function_count',(select count(*) from application_functions where nspname='public'),
 'unsafe_definer_search_paths',(select count(*) from application_functions p where p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false)),
 'public_execute_grants',(select count(*) from application_functions p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where acl.grantee=0 and acl.privilege_type='EXECUTE'),
 'anon_table_grants',coalesce((select jsonb_agg(jsonb_build_object('table',r.relname,'privilege',acl.privilege_type)) from application_relations r join pg_class c on c.oid=r.oid cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl join pg_roles role on role.oid=acl.grantee where role.rolname='anon'),'[]'::jsonb),
 'invoice_view_security_invoker',coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='invoice_statuses'),false),
 'browser_can_grant_roles',has_function_privilege('authenticated','public.server_grant_role(uuid,text)','EXECUTE'),
 'browser_can_record_rent',has_function_privilege('authenticated','public.server_record_rent_payment(uuid,text,boolean,text,boolean,timestamptz)','EXECUTE'),
 'browser_can_record_boost',has_function_privilege('authenticated','public.server_record_boost(uuid,text,boolean,text,boolean)','EXECUTE'),
 'public_listings_accessible_to_anon',has_function_privilege('anon','public.public_listings()','EXECUTE'),
 'dangerous_api_table_privileges',coalesce((select jsonb_agg(jsonb_build_object('role',role.rolname,'table',r.relname,'privilege',acl.privilege_type)) from application_relations r join pg_class c on c.oid=r.oid cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl join pg_roles role on role.oid=acl.grantee where role.rolname in ('anon','authenticated','service_role') and acl.privilege_type in ('TRUNCATE','TRIGGER','REFERENCES','MAINTAIN')),'[]'::jsonb),
 'master_facility_count',(select count(*) from public.facilities),
 'master_facility_codes',(select jsonb_agg(code order by code) from public.facilities)
) as postflight;
