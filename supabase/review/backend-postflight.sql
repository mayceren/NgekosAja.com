-- Metadata only. Use after approved Phase 3 application; no row identities/secrets.
select jsonb_build_object(
 'tables',(select count(*) from pg_tables where schemaname='public'),
 'policies',(select count(*) from pg_policies where schemaname='public'),
 'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'),
 'public_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'rls_disabled',(select count(*) from pg_tables where schemaname='public' and not rowsecurity),
 'unsafe_definer_paths',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false)),
 'public_execute_grants',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where n.nspname in ('public','private') and acl.grantee=0 and acl.privilege_type='EXECUTE'),
 'browser_direct_offer_write',has_table_privilege('authenticated','public.rental_offers','insert,update,delete'),
 'browser_private_checkin',has_function_privilege('authenticated','private.check_in_consented(uuid,uuid,date,date,bigint,smallint)','execute'),
 'browser_server_payment',has_function_privilege('authenticated','public.server_record_rent_payment(uuid,text,boolean,text,boolean,timestamptz)','execute'),
 'browser_server_boost',has_function_privilege('authenticated','public.server_record_boost(uuid,text,boolean,text,boolean)','execute'),
 'browser_role_grant',has_function_privilege('authenticated','public.server_grant_role(uuid,text)','execute'),
 'anonymous_property_save',has_function_privilege('anon','public.owner_save_property(jsonb)','execute'),
 'anonymous_base_properties',has_table_privilege('anon','public.properties','select'),
 'anonymous_catalogue',has_function_privilege('anon','public.public_listings()','execute'),
 'offer_read_policy',(select count(*) from pg_policies where schemaname='public' and tablename='rental_offers' and policyname='rental_offers_read'),
 'offer_rows',(select count(*) from public.rental_offers)
) backend_postflight;
