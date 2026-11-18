begin;
create table public.properties (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete restrict,
 name text not null check(char_length(btrim(name)) between 3 and 100),
 location text not null check(char_length(btrim(location)) between 2 and 80),
 address text not null check(char_length(btrim(address)) between 5 and 300),
 description text not null check(char_length(btrim(description)) between 10 and 4000),
 base_rent bigint not null check(base_rent between 100000 and 100000000),
 gender_policy text not null check(gender_policy in ('mixed','male','female')),
 room_size text not null default '3 × 4 m' check(char_length(room_size) between 1 and 60),
 publication_status text not null default 'draft' check(publication_status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.properties');
create index properties_owner_idx on public.properties(owner_id);
create index properties_public_search_idx on public.properties(publication_status,location,base_rent);
create index properties_name_search_idx on public.properties(lower(name) text_pattern_ops);
create table public.property_images (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
 image_path text not null check(char_length(image_path) between 1 and 500 and image_path !~* '^(data:|javascript:)'),
 alt_text text not null default '' check(char_length(alt_text)<=150), position integer not null default 0 check(position>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(property_id,position)
);
select private.secure_table('public.property_images');
create table public.property_rules (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
 rule_text text not null check(char_length(btrim(rule_text)) between 1 and 500), position integer not null check(position>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(property_id,position)
);
select private.secure_table('public.property_rules');
create table public.property_landmarks (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
 name text not null check(char_length(btrim(name)) between 1 and 100), distance_label text not null check(char_length(distance_label) between 1 and 120),
 is_illustrative boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(property_id,name)
);
select private.secure_table('public.property_landmarks');
create table public.facilities (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[a-z_]+$'),
 name text not null unique check(char_length(name) between 1 and 80),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.facilities');
create table public.property_facilities (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete cascade,
 facility_id uuid not null references public.facilities(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(property_id,facility_id)
);
select private.secure_table('public.property_facilities');
create index property_facilities_facility_idx on public.property_facilities(facility_id);
create table public.rooms (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete restrict,
 number text not null check(char_length(btrim(number)) between 1 and 20), room_type text not null default 'Standard' check(char_length(btrim(room_type)) between 1 and 60),
 rent bigint not null check(rent between 100000 and 100000000),
 operational_status text not null default 'available' check(operational_status in ('available','maintenance','inactive')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(property_id,number)
);
select private.secure_table('public.rooms');
create table public.room_facilities (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id) on delete cascade,
 facility_id uuid not null references public.facilities(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(room_id,facility_id)
);
select private.secure_table('public.room_facilities');
create index room_facilities_facility_idx on public.room_facilities(facility_id);

create function private.owns_property(pid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and private.has_role('owner') and exists(select 1 from public.properties where id=pid and owner_id=auth.uid())
$$;
create function private.owns_room(rid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.rooms r where r.id=rid and private.owns_property(r.property_id))
$$;
create function private.guard_property() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.owner_id<>old.owner_id) then raise exception 'Property identity and ownership are immutable'; end if;
 if not exists(select 1 from public.user_roles where user_id=new.owner_id and role='owner') then raise exception 'Owner role required'; end if;
 return new;
end $$;
create trigger guard_property before insert or update on public.properties for each row execute function private.guard_property();
grant execute on function private.owns_property(uuid), private.owns_room(uuid) to authenticated;
commit;
