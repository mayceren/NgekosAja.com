-- SQL CONTRACT ADAPTER ONLY, loaded into a new throwaway DB, never into Supabase.
-- Models the Auth UUID/claims interface, not GoTrue, JWT verification or PostgREST.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users(id uuid primary key, email text unique, raw_user_meta_data jsonb not null default '{}',raw_app_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid(),auth.role() to anon,authenticated,service_role;
-- Simulate permissive pre-existing API defaults so migrations must actively close them.
alter default privileges grant execute on functions to anon,authenticated,service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
