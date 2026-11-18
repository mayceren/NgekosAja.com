begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;
revoke create on schema public from public, anon, authenticated;
-- Function EXECUTE is globally granted to PUBLIC by PostgreSQL by default.
-- A per-schema REVOKE cannot remove that global default; revoke it globally first.
alter default privileges revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create function private.today() returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Jakarta')::date $$;
create function private.touch_updated_at() returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := clock_timestamp(); return new; end $$;
-- Called within the SAME transaction that creates a table: no unprotected API window.
create function private.secure_table(target regclass) returns void language plpgsql set search_path = '' as $$
begin
  execute format('alter table %s enable row level security', target);
  execute format('revoke all on %s from public, anon, authenticated, service_role', target);
  execute format('grant select on %s to authenticated', target);
  execute format('grant select,insert,update,delete on %s to service_role', target);
  execute format('create trigger touch_updated_at before update on %s for each row execute function private.touch_updated_at()', target);
end $$;
revoke all on all functions in schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 70),
  phone text check (phone is null or phone ~ '^[+0-9 -]{8,18}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.profiles');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('prospect','tenant','owner','admin')),
  granted_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, role)
);
select private.secure_table('public.user_roles');
create table public.user_settings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
  notifications_enabled boolean not null default true, compact_mode boolean not null default false,
  sidebar_collapsed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.user_settings');

create function private.has_role(wanted text) returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (select 1 from public.user_roles where user_id = auth.uid() and role = wanted)
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select private.has_role('admin')
$$;
create function private.require_server() returns void language plpgsql set search_path = '' as $$
begin
 if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Authorized server required' using errcode='42501'; end if;
end $$;
create function private.handle_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id, display_name) values(new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Pengguna NgekosAja'),70));
 -- Untrusted registration metadata NEVER grants owner, tenant or admin.
 insert into public.user_roles(user_id,role) values(new.id,'prospect');
 insert into public.user_settings(user_id) values(new.id);
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_auth_user();
create function public.server_grant_role(target_user uuid, target_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_server();
 if target_role not in ('prospect','tenant','owner','admin') then raise exception 'Invalid role'; end if;
 insert into public.user_roles(user_id,role,granted_by) values(target_user,target_role,auth.uid()) on conflict(user_id,role) do nothing;
end $$;
revoke all on function public.server_grant_role(uuid,text) from public, anon, authenticated;
grant execute on function public.server_grant_role(uuid,text) to service_role;
grant execute on function private.has_role(text), private.is_admin(), private.today() to authenticated;
commit;
