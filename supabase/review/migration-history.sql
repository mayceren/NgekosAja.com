-- Read-only; run only after approved application creates migration history.
select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]'::jsonb) as migration_history
from supabase_migrations.schema_migrations;
