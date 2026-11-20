-- Phase 5: LOCAL, requires separate approval before Cloud application.
begin;
create table public.payment_attempts (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('rent','boost')),
 invoice_id uuid references public.invoices(id) on delete restrict,property_id uuid not null references public.properties(id) on delete restrict,
 payer_id uuid not null references public.profiles(id) on delete restrict,order_id text not null unique,
 property_name_snapshot text not null,payer_name_snapshot text not null,
 amount bigint not null check(amount between 1 and 100000000),admin_fee bigint not null,gross_amount bigint not null,
 environment text not null default 'sandbox' check(environment='sandbox'),
 status text not null default 'creating' check(status in ('creating','pending','succeeded','denied','cancelled','expired','failed','review','refunded','partial_refund')),
 gateway_transaction_id text unique,payment_method text,transaction_id uuid unique references public.transactions(id) on delete restrict,
 verified_at timestamptz,last_reconciled_at timestamptz,expires_at timestamptz not null default now()+interval '24 hours',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(gross_amount=amount+admin_fee),check((kind='rent' and invoice_id is not null and admin_fee=2000) or (kind='boost' and invoice_id is null and amount=30000 and admin_fee=0)),
 check(order_id ~ '^NK-SB-[0-9a-f]{32}$'),check(status not in ('succeeded','refunded','partial_refund') or transaction_id is not null)
);
select private.secure_table('public.payment_attempts');
create unique index payment_active_invoice_idx on public.payment_attempts(invoice_id) where kind='rent' and status in ('creating','pending');
create unique index payment_active_property_idx on public.payment_attempts(property_id) where kind='boost' and status in ('creating','pending');
create index payment_attempts_payer_idx on public.payment_attempts(payer_id,created_at);
create index payment_attempts_property_idx on public.payment_attempts(property_id,created_at);
create index payment_attempts_invoice_idx on public.payment_attempts(invoice_id);
create policy payment_attempts_read on public.payment_attempts for select to authenticated using(payer_id=auth.uid() or private.owns_property(property_id) or private.is_admin());
-- Snap tokens are checkout bearer credentials: never in a realtime/browser-readable table.
create table public.payment_sessions (
 id uuid primary key references public.payment_attempts(id) on delete restrict,snap_token text,
 lease_id uuid,lease_until timestamptz,create_count integer not null default 0 check(create_count between 0 and 5),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
select private.secure_table('public.payment_sessions');revoke all on public.payment_sessions from authenticated;
create table public.payment_events (
 id uuid primary key default gen_random_uuid(),attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
 event_key text not null check(event_key ~ '^[0-9a-f]{64}$'),gateway_status text not null,
 outcome text not null check(outcome in ('observed','applied','duplicate','ignored','conflict','refund_review')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(attempt_id,event_key)
);
select private.secure_table('public.payment_events');revoke all on public.payment_events from authenticated;
create trigger immutable_payment_event before update or delete on public.payment_events for each row execute function private.immutable_record();
create function private.payment_resource_lock(k text,r uuid) returns void language sql volatile set search_path='' as $$ select pg_advisory_xact_lock(hashtextextended('sandbox-payment:'||k||':'||r,0)) $$;
create function public.server_reserve_payment(actor uuid,payment_kind text,resource_id uuid) returns public.payment_attempts language plpgsql security definer set search_path='' as $$
declare i public.invoices;p public.properties;result public.payment_attempts;pid uuid;rent bigint;fee bigint;
begin
 perform private.require_server();
 if actor is null or payment_kind not in ('rent','boost') then raise insufficient_privilege; end if;
 perform private.payment_resource_lock(payment_kind,resource_id);
 if payment_kind='rent' then
  select * into i from public.invoices where id=resource_id for update;
  select r.property_id into pid from public.rental_agreements a join public.rooms r on r.id=a.room_id where a.id=i.agreement_id and a.tenant_id=actor;
  if pid is null then raise insufficient_privilege; end if;
  if i.status<>'pending' then raise exception 'Invoice not payable'; end if;
  rent:=i.amount;fee:=i.admin_fee;
 else
  select * into p from public.properties where id=resource_id for update;
  if p.id is null or p.owner_id<>actor or not exists(select 1 from public.user_roles where user_id=actor and role='owner') then raise insufficient_privilege; end if;
  if p.publication_status<>'published' or exists(select 1 from public.boost_campaigns where property_id=p.id and end_date>private.today()) then raise exception 'Boost unavailable'; end if;
  pid:=p.id;rent:=30000;fee:=0;
 end if;
 if exists(select 1 from public.payment_attempts where kind=payment_kind and case when payment_kind='rent' then invoice_id=resource_id else property_id=resource_id end and status='review') then raise exception 'Payment requires manual review';end if;
 select * into result from public.payment_attempts where kind=payment_kind and case when payment_kind='rent' then invoice_id=resource_id else property_id=resource_id end and status in ('creating','pending') for update;
 if found then
  if result.payer_id<>actor then raise insufficient_privilege; end if;return result;
 end if;
 if (select count(*) from public.payment_attempts where payer_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'Payment request budget exceeded'; end if;
 insert into public.payment_attempts(kind,invoice_id,property_id,payer_id,order_id,property_name_snapshot,payer_name_snapshot,amount,admin_fee,gross_amount)
 values(payment_kind,case when payment_kind='rent' then resource_id end,pid,actor,'NK-SB-'||replace(gen_random_uuid()::text,'-',''),case when payment_kind='rent' then i.property_name_snapshot else p.name end,(select display_name from public.profiles where id=actor),rent,fee,rent+fee) returning * into result;
 insert into public.payment_sessions(id) values(result.id);return result;
end $$;
create function public.server_payment_session(target_attempt uuid,actor uuid,claim boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.payment_attempts;s public.payment_sessions;
begin
 perform private.require_server();select * into a from public.payment_attempts where id=target_attempt for update;
 if a.id is null or a.payer_id<>actor or actor is null then raise insufficient_privilege; end if;
 select * into s from public.payment_sessions where id=a.id for update;
 if claim and a.status='creating' and s.snap_token is null and coalesce(s.lease_until,'-infinity')<now() and s.create_count<5 then
  update public.payment_sessions set lease_id=gen_random_uuid(),lease_until=now()+interval '90 seconds',create_count=create_count+1 where id=a.id returning * into s;
  return jsonb_build_object('attempt',to_jsonb(a),'token',null,'claim',s.lease_id);
 end if;
 return jsonb_build_object('attempt',to_jsonb(a),'token',case when a.status in ('creating','pending') and a.expires_at>now() then s.snap_token end,'claim',null);
end $$;
create function public.server_save_snap(target_attempt uuid,claim_id uuid,token text) returns void language plpgsql security definer set search_path='' as $$
declare a public.payment_attempts;
begin
 perform private.require_server();select * into a from public.payment_attempts where id=target_attempt for update;
 if a.id is null or claim_id is null or token is null or char_length(token) not between 10 and 200 or not exists(select 1 from public.payment_sessions where id=a.id and lease_id=claim_id) then raise exception 'Invalid Snap lease'; end if;
 update public.payment_sessions set snap_token=token,lease_id=null,lease_until=null where id=a.id;
 if a.status='creating' then update public.payment_attempts set status='pending' where id=a.id;end if;
end $$;
create function private.freeze_payment_resource() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='invoices' then
  if (new.amount,new.due_date,new.status) is distinct from (old.amount,old.due_date,old.status) and new.status<>'paid' and exists(select 1 from public.payment_attempts where invoice_id=old.id and status in ('creating','pending','review')) then raise exception 'Reconcile active payment before editing invoice';end if;
 elsif tg_table_name='properties' then
  if new.publication_status<>old.publication_status and exists(select 1 from public.payment_attempts where property_id=old.id and kind='boost' and status in ('creating','pending','review')) then raise exception 'Reconcile active boost payment before changing publication';end if;
 end if;
 return new;
end $$;
create trigger freeze_payment_invoice before update on public.invoices for each row execute function private.freeze_payment_resource();
create trigger freeze_payment_property before update on public.properties for each row execute function private.freeze_payment_resource();

-- This function accepts ONLY a whitelisted status verified by the Edge server against Midtrans.
-- Signature checking happens before any call; ordinary JWTs cannot execute it.
create function public.server_apply_payment(target_order text,gateway_id text,verified_gross bigint,gateway_state text,fraud text,method text,event_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.payment_attempts;eid uuid;next_state text;tid uuid;outcome text:='observed';invoice_status text;
begin
 perform private.require_server();
 if gateway_state not in ('pending','settlement','capture','deny','cancel','expire','failure','refund','partial_refund') or event_hash is null or event_hash !~ '^[0-9a-f]{64}$' or gateway_id is null or char_length(gateway_id) not between 1 and 100 or method is null or char_length(method) not between 1 and 80 then raise exception 'Invalid gateway status';end if;
 select * into a from public.payment_attempts where order_id=target_order;
 if a.id is null then raise exception 'Unknown order';end if;
 perform private.payment_resource_lock(a.kind,coalesce(a.invoice_id,a.property_id));
 select * into a from public.payment_attempts where id=a.id for update;
 if verified_gross is distinct from a.gross_amount or (a.gateway_transaction_id is not null and a.gateway_transaction_id<>gateway_id) then raise exception 'Gateway identity/amount mismatch';end if;
 select id into eid from public.payment_events where attempt_id=a.id and event_key=event_hash;
 if eid is not null then return jsonb_build_object('status',a.status,'duplicate',true);end if;
 next_state:=case gateway_state when 'settlement' then case when coalesce(fraud,'accept')<>'accept' or (method='credit_card' and fraud is distinct from 'accept') then 'review' else 'succeeded' end
 when 'capture' then case when fraud='deny' then 'denied' when fraud='accept' and a.kind='rent' then 'succeeded' else 'pending' end
 when 'deny' then 'denied' when 'cancel' then 'cancelled' when 'expire' then 'expired' when 'failure' then 'failed'
 when 'refund' then 'refunded' when 'partial_refund' then 'partial_refund' else 'pending' end;
 if gateway_state in ('refund','partial_refund') then
  if a.transaction_id is not null then update public.payment_attempts set status=case when a.status='refunded' then 'refunded' else next_state end,verified_at=now() where id=a.id;outcome:='refund_review';else outcome:='conflict';update public.payment_attempts set status='review' where id=a.id;end if;
 elsif a.status in ('succeeded','refunded','partial_refund') then outcome:='ignored';
 elsif next_state='succeeded' then
  if a.kind='rent' then
   select status into invoice_status from public.invoices where id=a.invoice_id for update;
   if invoice_status<>'pending' then outcome:='conflict';end if;
  else
   perform 1 from public.properties where id=a.property_id and publication_status='published' for update;
   if not found or exists(select 1 from public.boost_campaigns where property_id=a.property_id and end_date>private.today()) then outcome:='conflict';end if;
  end if;
  if outcome='conflict' then update public.payment_attempts set status='review',gateway_transaction_id=gateway_id,payment_method=method,verified_at=now() where id=a.id;
  else
   if a.kind='rent' then tid:=public.server_record_rent_payment(a.invoice_id,'midtrans:sandbox:'||a.order_id,true,method,true,now());
   else tid:=public.server_record_boost(a.property_id,'midtrans:sandbox:'||a.order_id,true,method,true);end if;
   update public.payment_attempts set status='succeeded',transaction_id=tid,gateway_transaction_id=gateway_id,payment_method=method,verified_at=now() where id=a.id;outcome:='applied';
   perform private.notify(a.payer_id,'sandbox-payment:'||a.id,'Pembayaran Sandbox terverifikasi','Status pembayaran telah dikonfirmasi server.',case when a.kind='rent' then '#/tenant/history' else '#/owner/boost' end);
  end if;
 elsif a.status in ('denied','cancelled','expired','failed') then outcome:='ignored';
 else
  update public.payment_attempts set status=next_state,gateway_transaction_id=gateway_id,payment_method=method,verified_at=now() where id=a.id;
  if next_state in ('denied','cancelled','expired','failed') then
   -- Distinct final event key; pending is never written to the financial ledger.
   if a.kind='rent' then select status into invoice_status from public.invoices where id=a.invoice_id for update;if invoice_status='pending' then tid:=public.server_record_rent_payment(a.invoice_id,'midtrans:sandbox:failed:'||a.order_id,false,method,true,now());end if;
   elsif not exists(select 1 from public.boost_campaigns where property_id=a.property_id and end_date>private.today()) and exists(select 1 from public.properties where id=a.property_id and publication_status='published') then tid:=public.server_record_boost(a.property_id,'midtrans:sandbox:failed:'||a.order_id,false,method,true);end if;
   outcome:='applied';
  end if;
 end if;
 insert into public.payment_events(attempt_id,event_key,gateway_status,outcome) values(a.id,event_hash,gateway_state,outcome);
 return jsonb_build_object('status',(select status from public.payment_attempts where id=a.id),'outcome',outcome);
end $$;
create function public.payment_capabilities() returns jsonb language sql stable set search_path='' as $$ select '{"version":5,"environment":"sandbox"}'::jsonb $$;
create function public.server_claim_reconciliation(target_attempt uuid,actor uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare a public.payment_attempts;
begin
 perform private.require_server();select * into a from public.payment_attempts where id=target_attempt for update;
 if a.id is null or actor is null or not (a.payer_id=actor or exists(select 1 from public.properties where id=a.property_id and owner_id=actor) or exists(select 1 from public.user_roles where user_id=actor and role='admin')) then raise insufficient_privilege;end if;
 if a.last_reconciled_at>now()-interval '15 seconds' then return false;end if;
 update public.payment_attempts set last_reconciled_at=now() where id=a.id;return true;
end $$;
grant execute on function public.payment_capabilities() to anon,authenticated;
grant execute on function public.server_reserve_payment(uuid,text,uuid),public.server_payment_session(uuid,uuid,boolean),public.server_save_snap(uuid,uuid,text),public.server_apply_payment(text,text,bigint,text,text,text,text) to service_role;
grant execute on function public.server_claim_reconciliation(uuid,uuid) to service_role;

create function public.payment_accounting(target_property uuid default null,from_date date default null,to_date date default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (private.has_role('owner') or private.is_admin()) or (target_property is not null and not (private.owns_property(target_property) or private.is_admin())) then raise insufficient_privilege;end if;
 if from_date>to_date then raise exception 'Invalid date range';end if;
 return (with scoped as (
  select t.* from public.transactions t left join public.invoices i on i.id=t.invoice_id left join public.rental_agreements a on a.id=i.agreement_id left join public.rooms r on r.id=a.room_id
  join public.properties p on p.id=coalesce(t.property_id,r.property_id)
  where (p.owner_id=auth.uid() or private.is_admin()) and (target_property is null or p.id=target_property)
  and (from_date is null or (t.occurred_at at time zone 'Asia/Jakarta')::date>=from_date) and (to_date is null or (t.occurred_at at time zone 'Asia/Jakarta')::date<=to_date)
 ), grouped as (select is_simulation,
  coalesce(sum(amount) filter(where kind='rent' and status='succeeded'),0)::text rent_gmv,
  coalesce(sum(admin_fee) filter(where status='succeeded'),0)::text admin_fees,
  coalesce(sum(amount) filter(where kind='boost' and status='succeeded'),0)::text boost_revenue,
  coalesce(sum(case when kind='rent' then admin_fee else amount end) filter(where status='succeeded'),0)::text platform_revenue from scoped group by is_simulation)
 select jsonb_build_object('sandbox',coalesce((select to_jsonb(g)-'is_simulation' from grouped g where is_simulation),'{}'),
 'non_simulation',coalesce((select to_jsonb(g)-'is_simulation' from grouped g where not is_simulation),'{}'),
 'refund_cases',(select count(*)::text from public.payment_attempts p where p.status in ('refunded','partial_refund') and (private.owns_property(p.property_id) or private.is_admin()) and (target_property is null or p.property_id=target_property)),
 'basis','Gross ledger; refund cases require review and are not net cash revenue'));
end $$;
grant execute on function public.payment_accounting(uuid,date,date) to authenticated;
do $$ declare t text;begin
 foreach t in array array['payment_attempts','transactions','boost_campaigns'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
commit;
