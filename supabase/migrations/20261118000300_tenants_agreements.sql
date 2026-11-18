begin;
set local search_path = public, extensions;
create table public.tenants (
 id uuid primary key references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.tenants');
create table public.rental_agreements (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict,
 room_id uuid not null references public.rooms(id) on delete restrict,
 start_date date not null, end_date date not null check(end_date>=start_date),
 rent bigint not null check(rent between 100000 and 100000000), payment_day smallint not null check(payment_day between 1 and 28),
 status text not null default 'active' check(status in ('active','transferred','checked_out')),
 closed_on date, check((status='active' and closed_on is null) or (status<>'active' and closed_on between start_date and end_date+1)),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 -- end_date is inclusive; closed_on is the exclusive checkout/move date.
 -- Allows same-day turnover without erasing the previous agreement.
 exclude using gist (room_id with =, daterange(start_date,coalesce(closed_on,end_date+1),'[)') with &&),
 exclude using gist (tenant_id with =, daterange(start_date,coalesce(closed_on,end_date+1),'[)') with &&)
);
select private.secure_table('public.rental_agreements');
create unique index one_active_agreement_per_room on public.rental_agreements(room_id) where status='active';
create unique index one_active_agreement_per_tenant on public.rental_agreements(tenant_id) where status='active';
create index agreements_tenant_idx on public.rental_agreements(tenant_id,start_date);
create function private.can_read_agreement(aid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.rental_agreements a where a.id=aid and (a.tenant_id=auth.uid() or private.owns_room(a.room_id) or private.is_admin()))
$$;
create function private.property_party(pid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.owns_property(pid) or private.is_admin() or exists(select 1 from public.rental_agreements a join public.rooms r on r.id=a.room_id where r.property_id=pid and a.tenant_id=auth.uid())
$$;
create function private.related_tenant(tid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.rental_agreements a where a.tenant_id=tid and private.owns_room(a.room_id))
$$;
create function private.guard_agreement() returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.rooms; p public.properties;
begin
 if tg_op='DELETE' then raise exception 'Preserve agreement history'; end if;
 if tg_op='UPDATE' and (new.id,new.tenant_id,new.room_id,new.start_date,new.rent,new.payment_day) is distinct from (old.id,old.tenant_id,old.room_id,old.start_date,old.rent,old.payment_day) then raise exception 'Agreement snapshots are immutable; close and create another agreement'; end if;
 if tg_op='UPDATE' and old.status<>'active' then raise exception 'Closed agreement is immutable'; end if;
 -- Same lock order for check-in and room status updates serializes availability checks.
 select * into r from public.rooms where id=new.room_id for update;
 select * into p from public.properties where id=r.property_id for share;
 if new.status='active' and (r.operational_status<>'available' or p.publication_status<>'published') then raise exception 'Room is unavailable'; end if;
 return new;
end $$;
create trigger guard_agreement before insert or update or delete on public.rental_agreements for each row execute function private.guard_agreement();
create function private.guard_room() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if (new.id,new.property_id) is distinct from (old.id,old.property_id) then raise exception 'Room identity is immutable'; end if;
 if new.operational_status<>'available' and exists(select 1 from public.rental_agreements where room_id=old.id and status='active') then raise exception 'Occupied room cannot be disabled'; end if;
 return new;
end $$;
create trigger guard_room before update on public.rooms for each row execute function private.guard_room();
grant execute on function private.can_read_agreement(uuid), private.property_party(uuid), private.related_tenant(uuid) to authenticated;
commit;
