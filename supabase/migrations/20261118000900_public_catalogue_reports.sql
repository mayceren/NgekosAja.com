begin;
-- An intentional, narrow SECURITY DEFINER projection: anon has NO SELECT on base tables.
-- No identity UUID, contact, tenant, invoice, internal room number or audit data is returned.
create function public.public_listings() returns table(
 id uuid, name text, location text, address text, description text, base_rent bigint,
 gender_policy text, room_size text, total_rooms bigint, available_rooms bigint,
 images jsonb, facilities jsonb, rules jsonb, landmarks jsonb, promoted boolean
) language sql stable security definer set search_path = '' as $$
 select p.id,p.name,p.location,p.address,p.description,p.base_rent,p.gender_policy,p.room_size,
 (select count(*) from public.rooms r where r.property_id=p.id),
 (select count(*) from public.rooms r where r.property_id=p.id and r.operational_status='available' and not exists(select 1 from public.rental_agreements a where a.room_id=r.id and a.status='active')),
 coalesce((select jsonb_agg(jsonb_build_object('path',im.image_path,'alt',im.alt_text) order by im.position) from public.property_images im where im.property_id=p.id),'[]'::jsonb),
 coalesce((select jsonb_agg(f.name order by f.name) from public.property_facilities pf join public.facilities f on f.id=pf.facility_id where pf.property_id=p.id),'[]'::jsonb),
 coalesce((select jsonb_agg(pr.rule_text order by pr.position) from public.property_rules pr where pr.property_id=p.id),'[]'::jsonb),
 coalesce((select jsonb_agg(jsonb_build_object('name',pl.name,'distance',pl.distance_label,'illustrative',pl.is_illustrative) order by pl.name) from public.property_landmarks pl where pl.property_id=p.id),'[]'::jsonb),
 exists(select 1 from public.boost_campaigns b where b.property_id=p.id and b.start_date<=private.today() and b.end_date>private.today())
 from public.properties p where p.publication_status='published'
$$;
revoke all on function public.public_listings() from public;
grant execute on function public.public_listings() to anon,authenticated,service_role;

create view public.invoice_statuses with (security_invoker=true) as
 select i.*,case when i.status='pending' and i.due_date<private.today() then 'overdue' else i.status end as effective_status from public.invoices i;
revoke all on public.invoice_statuses from public,anon,authenticated,service_role;
grant select on public.invoice_statuses to authenticated,service_role;

create function public.owner_financial_report(target_property uuid default null, from_date date default null, to_date date default null)
returns table(rent_revenue numeric,outstanding numeric,overdue numeric,collection_rate numeric,total_rooms bigint,occupied_rooms bigint,occupancy_rate numeric,resolved_complaints bigint,active_listings bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not (private.has_role('owner') or private.is_admin()) then raise exception 'Report access denied' using errcode='42501'; end if;
 if from_date>to_date then raise exception 'Invalid report range'; end if;
 if target_property is not null and not (private.owns_property(target_property) or private.is_admin()) then raise exception 'Property access denied' using errcode='42501'; end if;
 return query with scope as (
  select p.id from public.properties p where (p.owner_id=auth.uid() or private.is_admin()) and (target_property is null or p.id=target_property)
 ), leases as (select a.* from public.rental_agreements a join public.rooms r on r.id=a.room_id where r.property_id in (select id from scope)),
 inv as (select i.* from public.invoices i where i.agreement_id in (select id from leases) and (from_date is null or i.due_date>=from_date) and (to_date is null or i.due_date<=to_date)),
 revenue as (select coalesce(sum(t.amount),0)::numeric v from public.transactions t join public.invoices i on i.id=t.invoice_id where t.kind='rent' and t.status='succeeded' and i.agreement_id in (select id from leases) and (from_date is null or (t.occurred_at at time zone 'Asia/Jakarta')::date>=from_date) and (to_date is null or (t.occurred_at at time zone 'Asia/Jakarta')::date<=to_date)),
 room_counts as (select count(*) total from public.rooms where property_id in (select id from scope)), occupied as (select count(*) total from leases where status='active')
 select revenue.v,coalesce((select sum(amount) from inv where status='pending'),0)::numeric,
 coalesce((select sum(amount) from inv where status='pending' and due_date<private.today()),0)::numeric,
 coalesce((select round(100.0*count(*) filter(where status='paid')/nullif(count(*) filter(where status<>'cancelled'),0),2) from inv),0),
 room_counts.total,occupied.total,coalesce(round(100.0*occupied.total/nullif(room_counts.total,0),2),0),
 (select count(*) from public.complaints where agreement_id in (select id from leases) and status='resolved' and confirmed_at is not null),
 (select count(*) from public.properties where id in (select id from scope) and publication_status='published')
 from revenue cross join room_counts cross join occupied;
end $$;
create function public.owner_monthly_revenue(target_property uuid default null, from_date date default null, to_date date default null)
returns table(month date,rent_revenue numeric) language plpgsql stable security definer set search_path = '' as $$
declare first_month date; last_month date;
begin
 if auth.uid() is null or not (private.has_role('owner') or private.is_admin()) then raise exception 'Report access denied' using errcode='42501'; end if;
 if target_property is not null and not (private.owns_property(target_property) or private.is_admin()) then raise exception 'Property access denied' using errcode='42501'; end if;
 if from_date>to_date then raise exception 'Invalid report range'; end if;
 last_month:=date_trunc('month',coalesce(to_date,private.today()))::date;
 first_month:=greatest(date_trunc('month',coalesce(from_date,(last_month-interval '5 months')::date))::date,(last_month-interval '23 months')::date);
 return query select m::date,coalesce((select sum(t.amount) from public.transactions t join public.invoices i on i.id=t.invoice_id join public.rental_agreements a on a.id=i.agreement_id join public.rooms r on r.id=a.room_id join public.properties p on p.id=r.property_id
 where t.kind='rent' and t.status='succeeded' and (p.owner_id=auth.uid() or private.is_admin()) and (target_property is null or p.id=target_property) and date_trunc('month',t.occurred_at at time zone 'Asia/Jakarta')=m and (from_date is null or (t.occurred_at at time zone 'Asia/Jakarta')::date>=from_date) and (to_date is null or (t.occurred_at at time zone 'Asia/Jakarta')::date<=to_date)),0)::numeric
 from generate_series(first_month::timestamp,last_month::timestamp,interval '1 month') m;
end $$;
create function public.platform_financial_report() returns table(gmv numeric,admin_fee_revenue numeric,boost_revenue numeric,total_platform_revenue numeric,registered_accounts bigint,active_listings bigint,resolved_complaints bigint,total_rooms bigint,occupied_rooms bigint,occupancy_rate numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'Platform admin required' using errcode='42501'; end if;
 return query with revenue as (select coalesce(sum(amount) filter(where kind='rent'),0)::numeric gmv,coalesce(sum(admin_fee) filter(where kind='rent'),0)::numeric fee,coalesce(sum(amount) filter(where kind='boost'),0)::numeric boost from public.transactions where status='succeeded'), room_counts as (select count(*) n from public.rooms), occupied as (select count(*) n from public.rental_agreements where status='active')
 select revenue.gmv,revenue.fee,revenue.boost,revenue.fee+revenue.boost,(select count(*) from public.profiles),(select count(*) from public.properties where publication_status='published'),(select count(*) from public.complaints where status='resolved' and confirmed_at is not null),room_counts.n,occupied.n,coalesce(round(100.0*occupied.n/nullif(room_counts.n,0),2),0) from revenue cross join room_counts cross join occupied;
end $$;
grant execute on function public.owner_financial_report(uuid,date,date),public.owner_monthly_revenue(uuid,date,date),public.platform_financial_report() to authenticated;
commit;
