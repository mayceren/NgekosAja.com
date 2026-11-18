begin;
create function public.owner_check_in(target_tenant uuid, target_room uuid, starts date, ends date, monthly_rent bigint, due_day smallint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if auth.uid() is null or not private.has_role('owner') or not private.owns_room(target_room) then raise exception 'Room access denied' using errcode='42501'; end if;
 -- Require an existing account AND a conversation with this owner: no global profile directory.
 if not exists(select 1 from public.conversations c join public.properties p on p.id=c.property_id where c.prospect_id=target_tenant and p.owner_id=auth.uid()) then raise exception 'Tenant must first contact this owner' using errcode='42501'; end if;
 insert into public.tenants(id) values(target_tenant) on conflict do nothing;
 insert into public.user_roles(user_id,role,granted_by) values(target_tenant,'tenant',auth.uid()) on conflict do nothing;
 insert into public.rental_agreements(tenant_id,room_id,start_date,end_date,rent,payment_day) values(target_tenant,target_room,starts,ends,monthly_rent,due_day) returning id into result;
 return result;
end $$;
create function public.owner_close_agreement(target_agreement uuid, close_date date, reason text default 'checked_out') returns void language plpgsql security definer set search_path = '' as $$
declare a public.rental_agreements;
begin
 select * into a from public.rental_agreements where id=target_agreement for update;
 if a.id is null or not private.owns_room(a.room_id) then raise exception 'Lease access denied' using errcode='42501'; end if;
 if reason not in ('checked_out','transferred') or a.status<>'active' or close_date>private.today() then raise exception 'Invalid checkout'; end if;
 update public.rental_agreements set status=reason,closed_on=close_date where id=a.id;
end $$;
create function public.owner_transfer_agreement(target_agreement uuid, target_room uuid, moving_on date, ends date, monthly_rent bigint, due_day smallint) returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.rental_agreements; result uuid;
begin
 select * into a from public.rental_agreements where id=target_agreement for update;
 if a.id is null or not private.owns_room(a.room_id) or not private.owns_room(target_room) then raise exception 'Lease access denied' using errcode='42501'; end if;
 -- Checkout is exclusive: the old and new agreements meet on the moving date.
 perform public.owner_close_agreement(a.id,moving_on,'transferred');
 insert into public.rental_agreements(tenant_id,room_id,start_date,end_date,rent,payment_day) values(a.tenant_id,target_room,moving_on,ends,monthly_rent,due_day) returning id into result;
 return result;
end $$;
create function public.owner_create_invoice(target_agreement uuid, billing_month date, due_on date, rent_amount bigint, invoice_notes text default '') returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.rental_agreements; result uuid;
begin
 select * into a from public.rental_agreements where id=target_agreement for share;
 if a.id is null or not private.owns_room(a.room_id) then raise exception 'Lease access denied' using errcode='42501'; end if;
 if a.status<>'active' then raise exception 'Cannot issue a new invoice for a closed lease'; end if;
 insert into public.invoices(agreement_id,period_start,due_date,amount,notes,tenant_name_snapshot,property_name_snapshot,room_number_snapshot)
 select a.id,billing_month,due_on,rent_amount,invoice_notes,t.display_name,p.name,r.number
 from public.rooms r join public.properties p on p.id=r.property_id join public.profiles t on t.id=a.tenant_id where r.id=a.room_id returning id into result;
 return result;
end $$;
create function public.owner_update_invoice(target_invoice uuid, rent_amount bigint, due_on date, invoice_notes text default '', cancel boolean default false) returns void language plpgsql security definer set search_path = '' as $$
declare i public.invoices;
begin
 select * into i from public.invoices where id=target_invoice for update;
 if i.id is null or not exists(select 1 from public.rental_agreements a where a.id=i.agreement_id and private.owns_room(a.room_id)) then raise exception 'Invoice access denied' using errcode='42501'; end if;
 update public.invoices set amount=rent_amount,due_date=due_on,notes=invoice_notes,status=case when cancel then 'cancelled' else 'pending' end where id=i.id;
end $$;
create function public.owner_create_invoices_bulk(target_agreements uuid[], billing_month date, due_on date, fixed_rent bigint default null, invoice_notes text default '') returns uuid[] language plpgsql security definer set search_path = '' as $$
declare aid uuid; rent_amount bigint; result uuid[]:='{}';
begin
 if cardinality(target_agreements) is null or cardinality(target_agreements) not between 1 and 1000 then raise exception 'Choose 1–1000 agreements'; end if;
 -- Every call validates ownership and all writes share this transaction.
 -- Any invalid/duplicate agreement aborts the entire batch, including notifications/audit.
 foreach aid in array target_agreements loop
  select rent into rent_amount from public.rental_agreements where id=aid;
  result:=array_append(result,public.owner_create_invoice(aid,billing_month,due_on,coalesce(fixed_rent,rent_amount),invoice_notes));
 end loop;
 return result;
end $$;
create function public.owner_set_recurring(target_agreement uuid, rent_amount bigint, due_day smallint, starts date, enabled boolean default true) returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.rental_agreements; result uuid;
begin
 select * into a from public.rental_agreements where id=target_agreement for update;
 if a.id is null or not private.owns_room(a.room_id) then raise exception 'Lease access denied' using errcode='42501'; end if;
 if enabled and a.status<>'active' then raise exception 'Lease is not active'; end if;
 insert into public.recurring_invoices(agreement_id,amount,payment_day,start_month,active) values(a.id,rent_amount,due_day,starts,enabled)
 on conflict(agreement_id) do update set amount=excluded.amount,payment_day=excluded.payment_day,active=excluded.active returning id into result;
 return result;
end $$;
create function public.owner_generate_recurring(billing_month date) returns integer language plpgsql security definer set search_path = '' as $$
declare r record; total integer:=0;
begin
 if auth.uid() is null or not private.has_role('owner') then raise exception 'Owner required' using errcode='42501'; end if;
 if billing_month<>date_trunc('month',billing_month)::date then raise exception 'Expected first day of month'; end if;
 for r in select ri.* from public.recurring_invoices ri join public.rental_agreements a on a.id=ri.agreement_id where ri.active and a.status='active' and private.owns_room(a.room_id) and ri.start_month<=billing_month and (ri.last_generated_month is null or ri.last_generated_month<billing_month) for update of ri loop
  if not exists(select 1 from public.invoices where agreement_id=r.agreement_id and period_start=billing_month) then
   perform public.owner_create_invoice(r.agreement_id,billing_month,billing_month+(r.payment_day-1),r.amount,'Tagihan bulanan terjadwal'); total:=total+1;
  end if;
  update public.recurring_invoices set last_generated_month=billing_month where id=r.id;
 end loop;
 return total;
end $$;
create function public.server_record_rent_payment(target_invoice uuid, payment_key text, succeeded boolean, payment_method text, simulated boolean default true, paid_at timestamptz default now()) returns uuid language plpgsql security definer set search_path = '' as $$
declare i public.invoices; previous public.transactions; result uuid;
begin
 perform private.require_server();
 -- Serialize identical webhook retries, then lock the invoice for competing payments.
 perform pg_advisory_xact_lock(hashtextextended(payment_key,0));
 select * into previous from public.transactions where idempotency_key=payment_key;
 if found then
  if previous.invoice_id is distinct from target_invoice or previous.kind<>'rent' or previous.method<>payment_method or previous.is_simulation<>simulated or previous.status<>(case when succeeded then 'succeeded' else 'failed' end) then raise exception 'Idempotency payload mismatch'; end if;
  return previous.id;
 end if;
 select * into i from public.invoices where id=target_invoice for update;
 if i.id is null or i.status<>'pending' then raise exception 'Invoice not payable'; end if;
 insert into public.transactions(kind,invoice_id,amount,admin_fee,method,status,idempotency_key,is_simulation,occurred_at)
 values('rent',i.id,i.amount,i.admin_fee,payment_method,case when succeeded then 'succeeded' else 'failed' end,payment_key,simulated,paid_at) returning id into result;
 return result;
end $$;
create function public.server_record_boost(target_property uuid, payment_key text, succeeded boolean, payment_method text, simulated boolean default true) returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.transactions; result uuid;
begin
 perform private.require_server();
 perform pg_advisory_xact_lock(hashtextextended(payment_key,0));
 select * into previous from public.transactions where idempotency_key=payment_key;
 if found then
  if previous.kind<>'boost' or previous.property_id is distinct from target_property or previous.method<>payment_method or previous.is_simulation<>simulated or previous.status<>(case when succeeded then 'succeeded' else 'failed' end) then raise exception 'Idempotency payload mismatch'; end if;
  return previous.id;
 end if;
 perform 1 from public.properties where id=target_property and publication_status='published' for update;
 if not found then raise exception 'Published property required'; end if;
 if exists(select 1 from public.boost_campaigns where property_id=target_property and end_date>private.today()) then raise exception 'Campaign already active or scheduled'; end if;
 insert into public.transactions(kind,property_id,amount,admin_fee,method,status,idempotency_key,is_simulation)
 values('boost',target_property,30000,0,payment_method,case when succeeded then 'succeeded' else 'failed' end,payment_key,simulated) returning id into result;
 if succeeded then insert into public.boost_campaigns(property_id,transaction_id,start_date,end_date) values(target_property,result,private.today(),private.today()+30); end if;
 return result;
end $$;
-- No browser role, including a platform admin JWT, can invoke payment writers.
revoke all on function public.server_record_rent_payment(uuid,text,boolean,text,boolean,timestamptz), public.server_record_boost(uuid,text,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.server_record_rent_payment(uuid,text,boolean,text,boolean,timestamptz), public.server_record_boost(uuid,text,boolean,text,boolean) to service_role;
grant execute on function public.owner_check_in(uuid,uuid,date,date,bigint,smallint),public.owner_close_agreement(uuid,date,text),public.owner_transfer_agreement(uuid,uuid,date,date,bigint,smallint),public.owner_create_invoice(uuid,date,date,bigint,text),public.owner_update_invoice(uuid,bigint,date,text,boolean),public.owner_set_recurring(uuid,bigint,smallint,date,boolean),public.owner_generate_recurring(date) to authenticated;
grant execute on function public.owner_create_invoices_bulk(uuid[],date,date,bigint,text) to authenticated;
commit;
