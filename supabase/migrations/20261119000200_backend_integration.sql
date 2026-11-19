-- Phase 3. LOCAL/PENDING APPROVAL: never edit applied migrations.
begin;
create function public.owner_save_property(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid; item jsonb; pos integer:=0;
begin
 if auth.uid() is null or not private.has_role('owner') then raise insufficient_privilege; end if;
 if jsonb_typeof(payload)<>'object' then raise exception 'Invalid payload'; end if;
 pid:=nullif(payload->>'id','')::uuid;
 if pid is null then
  insert into public.properties(owner_id,name,location,address,description,base_rent,gender_policy,room_size,publication_status)
  values(auth.uid(),payload->>'name',payload->>'location',payload->>'address',payload->>'description',(payload->>'base_rent')::bigint,payload->>'gender_policy',payload->>'room_size',payload->>'publication_status') returning id into pid;
 else
  perform 1 from public.properties where id=pid for update;
  if not private.owns_property(pid) then raise insufficient_privilege; end if;
  update public.properties set name=payload->>'name',location=payload->>'location',address=payload->>'address',description=payload->>'description',base_rent=(payload->>'base_rent')::bigint,gender_policy=payload->>'gender_policy',room_size=payload->>'room_size',publication_status=payload->>'publication_status' where id=pid;
 end if;
 if jsonb_array_length(coalesce(payload->'images','[]'))>8 or jsonb_array_length(coalesce(payload->'rules','[]'))>30 or jsonb_array_length(coalesce(payload->'landmarks','[]'))>20 or jsonb_array_length(coalesce(payload->'facilities','[]'))>100 then raise exception 'Too many details'; end if;
 delete from public.property_images where property_id=pid;
 for item in select * from jsonb_array_elements(coalesce(payload->'images','[]')) loop
  if item->>'path' is null or item->>'path' !~ '^assets/images/(room-([1-9]|1[0-2])|kitchen|bathroom)\.jpg$' then raise exception 'Local illustration required'; end if;
  insert into public.property_images(property_id,image_path,alt_text,position) values(pid,item->>'path',coalesce(item->>'alt',''),pos);pos:=pos+1;
 end loop;
 delete from public.property_rules where property_id=pid;pos:=0;
 for item in select * from jsonb_array_elements(coalesce(payload->'rules','[]')) loop
  insert into public.property_rules(property_id,rule_text,position) values(pid,item#>>'{}',pos);pos:=pos+1;
 end loop;
 delete from public.property_landmarks where property_id=pid;
 for item in select * from jsonb_array_elements(coalesce(payload->'landmarks','[]')) loop
  insert into public.property_landmarks(property_id,name,distance_label,is_illustrative) values(pid,item->>'name',item->>'distance',true);
 end loop;
 delete from public.property_facilities where property_id=pid;
 insert into public.property_facilities(property_id,facility_id) select pid,(value#>>'{}')::uuid from jsonb_array_elements(coalesce(payload->'facilities','[]'));
 return pid;
end $$;
create function public.owner_save_room(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; pid uuid;
begin
 rid:=nullif(payload->>'id','')::uuid;pid:=(payload->>'property_id')::uuid;
 if not private.owns_property(pid) then raise insufficient_privilege; end if;
 if rid is null then
  insert into public.rooms(property_id,number,room_type,rent,operational_status) values(pid,payload->>'number',payload->>'room_type',(payload->>'rent')::bigint,payload->>'operational_status') returning id into rid;
 else
  perform 1 from public.rooms where id=rid and property_id=pid for update;
  if not found or not private.owns_room(rid) then raise insufficient_privilege; end if;
  update public.rooms set number=payload->>'number',room_type=payload->>'room_type',rent=(payload->>'rent')::bigint,operational_status=payload->>'operational_status' where id=rid;
 end if;
 if jsonb_array_length(coalesce(payload->'facilities','[]'))>100 then raise exception 'Too many facilities'; end if;
 delete from public.room_facilities where room_id=rid;
 insert into public.room_facilities(room_id,facility_id) select rid,(value#>>'{}')::uuid from jsonb_array_elements(coalesce(payload->'facilities','[]'));
 return rid;
end $$;

create table public.rental_offers (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete restrict,
 owner_id uuid not null references public.profiles(id) on delete restrict,
 tenant_id uuid not null references public.profiles(id) on delete restrict,
 room_id uuid not null references public.rooms(id) on delete restrict,
 property_name_snapshot text not null,room_number_snapshot text not null,
 start_date date not null,end_date date not null check(end_date>=start_date),
 rent bigint not null check(rent between 100000 and 100000000),payment_day smallint not null check(payment_day between 1 and 28),
 status text not null default 'pending' check(status in ('pending','accepted','declined','placed')),
 expires_at timestamptz not null default now()+interval '7 days',responded_at timestamptz,
 agreement_id uuid unique references public.rental_agreements(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(owner_id<>tenant_id),
 check((status='pending' and responded_at is null and agreement_id is null) or (status in ('accepted','declined') and responded_at is not null and agreement_id is null) or (status='placed' and responded_at is not null and agreement_id is not null))
);
select private.secure_table('public.rental_offers');
create index rental_offers_owner_idx on public.rental_offers(owner_id,created_at);
create index rental_offers_tenant_idx on public.rental_offers(tenant_id,created_at);
create index rental_offers_room_idx on public.rental_offers(room_id);
create index rental_offers_conversation_idx on public.rental_offers(conversation_id);
create policy rental_offers_read on public.rental_offers for select to authenticated using(owner_id=auth.uid() or tenant_id=auth.uid() or private.is_admin());
grant select on public.rental_offers to authenticated;

create function public.owner_propose_rental(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.conversations; r public.rooms; pid uuid; oid uuid;
begin
 select * into c from public.conversations where id=(payload->>'conversation_id')::uuid;
 select * into r from public.rooms where id=(payload->>'room_id')::uuid for update;
 select id into pid from public.properties where id=r.property_id and publication_status='published' for share;
 if c.id is null or r.id is null or pid is null or not private.owns_room(r.id) or c.property_id<>pid or c.prospect_id=auth.uid() or not private.is_member(c.id) then raise insufficient_privilege; end if;
 if r.operational_status<>'available' or exists(select 1 from public.rental_agreements where room_id=r.id and status='active') then raise exception 'Room unavailable'; end if;
 if exists(select 1 from public.rental_offers where conversation_id=c.id and room_id=r.id and status in ('pending','accepted') and expires_at>now()) then raise exception 'Unfinished offer exists'; end if;
 insert into public.rental_offers(conversation_id,owner_id,tenant_id,room_id,property_name_snapshot,room_number_snapshot,start_date,end_date,rent,payment_day)
 values(c.id,auth.uid(),c.prospect_id,r.id,(select name from public.properties where id=pid),r.number,(payload->>'start_date')::date,(payload->>'end_date')::date,(payload->>'rent')::bigint,(payload->>'payment_day')::smallint) returning id into oid;
 perform private.notify(c.prospect_id,'rental-offer:'||oid,'Penawaran sewa baru','Tinjau rincian dan setujui hanya jika sesuai kesepakatan.','#/offers');
 return oid;
end $$;
create function public.tenant_respond_rental(target_offer uuid,accept boolean) returns void language plpgsql security definer set search_path='' as $$
declare o public.rental_offers;
begin
 select * into o from public.rental_offers where id=target_offer for update;
 if o.id is null or o.tenant_id<>auth.uid() or auth.uid() is null then raise insufficient_privilege; end if;
 if accept is null or o.status<>'pending' or o.expires_at<=now() then raise exception 'Offer no longer pending'; end if;
 update public.rental_offers set status=case when accept then 'accepted' else 'declined' end,responded_at=now() where id=o.id;
 perform private.notify(o.owner_id,'rental-response:'||o.id,'Tanggapan penawaran sewa','Calon penghuni telah menanggapi penawaran sewa.','#/owner/tenants');
end $$;

-- Preserve the existing atomic implementation, but remove direct browser execution.
alter function public.owner_check_in(uuid,uuid,date,date,bigint,smallint) set schema private;
alter function private.owner_check_in(uuid,uuid,date,date,bigint,smallint) rename to check_in_consented;
revoke all on function private.check_in_consented(uuid,uuid,date,date,bigint,smallint) from public,anon,authenticated,service_role;
create function public.owner_check_in(target_tenant uuid,target_room uuid,starts date,ends date,monthly_rent bigint,due_day smallint) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.rental_offers; aid uuid;
begin
 if not private.owns_room(target_room) then raise insufficient_privilege; end if;
 select * into o from public.rental_offers where owner_id=auth.uid() and tenant_id=target_tenant and room_id=target_room and start_date=starts and end_date=ends and rent=monthly_rent and payment_day=due_day and status='accepted' and expires_at>now() order by created_at for update limit 1;
 if o.id is null then raise exception 'Explicit unexpired tenant consent required'; end if;
 aid:=private.check_in_consented(target_tenant,target_room,starts,ends,monthly_rent,due_day);
 update public.rental_offers set status='placed',agreement_id=aid where id=o.id;
 return aid;
end $$;

create function public.conversation_directory() returns table(id uuid,property_id uuid,property_name text,prospect_id uuid,counterpart_name text,updated_at timestamptz,unread_count bigint,last_message text) language sql stable security definer set search_path='' as $$
 select c.id,c.property_id,p.name,c.prospect_id,pr.display_name,c.updated_at,
 (select count(*) from public.messages msg where msg.conversation_id=c.id and msg.sender_id<>auth.uid() and (m.last_read_at is null or msg.created_at>m.last_read_at)),
 (select left(msg.body,100) from public.messages msg where msg.conversation_id=c.id order by msg.created_at desc,msg.id desc limit 1)
 from public.conversations c join public.properties p on p.id=c.property_id
 join public.conversation_members m on m.conversation_id=c.id and m.user_id=auth.uid()
 join public.profiles pr on pr.id=case when c.prospect_id=auth.uid() then p.owner_id else c.prospect_id end
 order by c.updated_at desc,c.id limit 100
$$;
create function public.operational_summary(platform_scope boolean default false,target_property uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or (platform_scope and not private.is_admin()) or (not platform_scope and not private.has_role('owner')) then raise insufficient_privilege; end if;
 if target_property is not null and not platform_scope and not private.owns_property(target_property) then raise insufficient_privilege; end if;
 return (
 with p as (select * from public.properties where (platform_scope or owner_id=auth.uid()) and (target_property is null or id=target_property)),
 r as (select r.* from public.rooms r join p on p.id=r.property_id),
 a as (select a.* from public.rental_agreements a join r on r.id=a.room_id),
 i as (select i.* from public.invoices i join a on a.id=i.agreement_id),
 t as (select t.* from public.transactions t where t.invoice_id in(select id from i) or t.property_id in(select id from p))
 select jsonb_build_object(
 'properties',(select count(*)::text from p),'rooms',(select count(*)::text from r),
 'available_rooms',(select count(*)::text from r where operational_status='available' and not exists(select 1 from a where room_id=r.id and status='active')),
 'maintenance_rooms',(select count(*)::text from r where operational_status='maintenance'),
 'agreements',(select count(*)::text from a),'active_agreements',(select count(*)::text from a where status='active'),
 'pending_invoices',(select count(*)::text from i where status='pending'),'paid_invoices',(select count(*)::text from i where status='paid'),
 'overdue_invoices',(select count(*)::text from i where status='pending' and due_date<private.today()),
 'transactions',(select count(*)::text from t),'successful_payments',(select count(*)::text from t where kind='rent' and status='succeeded'),
 'failed_payments',(select count(*)::text from t where kind='rent' and status='failed'),
 'month_rent_revenue',(select coalesce(sum(amount),0)::text from t where kind='rent' and status='succeeded' and (occurred_at at time zone 'Asia/Jakarta')::date between date_trunc('month',private.today())::date and private.today()),
 'listing_views',(select count(*)::text from public.listing_analytics where property_id in(select id from p) and kind='view'),
 'detail_views',(select count(*)::text from public.listing_analytics where property_id in(select id from p) and kind='detail'),
 'contact_clicks',(select count(*)::text from public.listing_analytics where property_id in(select id from p) and kind='contact'),
 'active_complaints',(select count(*)::text from public.complaints where agreement_id in(select id from a) and status<>'resolved'),
 'boost_campaigns',(select count(*)::text from public.boost_campaigns where property_id in(select id from p)),
 'active_campaigns',(select count(*)::text from public.boost_campaigns where property_id in(select id from p) and start_date<=private.today() and end_date>private.today()),
 'owners',case when platform_scope then (select count(*)::text from public.user_roles where role='owner') else null end,
 'tenants',case when platform_scope then (select count(*)::text from public.user_roles where role='tenant') else null end)
 );
end $$;
-- All new RPCs require an authenticated JWT. No ledger/role grants are added.
revoke all on function public.owner_save_property(jsonb),public.owner_save_room(jsonb),public.owner_propose_rental(jsonb),public.tenant_respond_rental(uuid,boolean),public.owner_check_in(uuid,uuid,date,date,bigint,smallint),public.conversation_directory() from public,anon;
revoke all on function public.operational_summary(boolean,uuid) from public,anon;
grant execute on function public.operational_summary(boolean,uuid) to authenticated;
grant execute on function public.owner_save_property(jsonb),public.owner_save_room(jsonb),public.owner_propose_rental(jsonb),public.tenant_respond_rental(uuid,boolean),public.owner_check_in(uuid,uuid,date,date,bigint,smallint),public.conversation_directory() to authenticated;
commit;
