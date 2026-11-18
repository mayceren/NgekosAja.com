-- Read-only metadata verification; no application row values returned.
select jsonb_build_object(
 'columns',coalesce((
  select jsonb_agg(jsonb_build_object('table_name',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull) order by c.relname,a.attnum)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
  where n.nspname='public' and c.relkind='r'
 ),'[]'::jsonb),
 'non_uuid_primary_keys',coalesce((
  select jsonb_agg(jsonb_build_object('table',t.relname,'constraint',c.conname))
  from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and c.contype='p' and (cardinality(c.conkey)<>1 or exists(select 1 from pg_attribute a where a.attrelid=t.oid and a.attnum=any(c.conkey) and a.atttypid<>'uuid'::regtype))
 ),'[]'::jsonb),
 'unvalidated_constraints',coalesce((select jsonb_agg(c.conname) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and not c.convalidated),'[]'::jsonb),
 'invalid_indexes',coalesce((select jsonb_agg(t.relname) from pg_index i join pg_class t on t.oid=i.indexrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and not i.indisvalid),'[]'::jsonb),
 'auth_user_count',(select count(*) from auth.users),
 'property_count',(select count(*) from public.properties),
 'transaction_count',(select count(*) from public.transactions)
) as structure;
