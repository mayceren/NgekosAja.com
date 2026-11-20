-- Unapplied Phase 5 revision. Review/approval required before any Cloud mutation.
begin;
-- Two independent switches: this DB setting AND the Edge server environment.
create table private.payment_simulator_settings (
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 environment text not null default 'development' check(environment='development'),
 project_ref text not null default 'wfmhsbdfdcugxblqsaob' check(project_ref='wfmhsbdfdcugxblqsaob')
);
revoke all on private.payment_simulator_settings from public,anon,authenticated,service_role;
insert into private.payment_simulator_settings(singleton) values(true);
create table public.payment_attempts (
 id uuid primary key default gen_random_uuid(),reference text not null unique default ('NKA-SIM-'||upper(replace(gen_random_uuid()::text,'-',''))),
 payer_id uuid not null references public.profiles(id) on delete restrict,
 invoice_id uuid references public.invoices(id) on delete restrict,property_id uuid not null references public.properties(id) on delete restrict,
 kind text not null check(kind in ('rent','boost')),property_name_snapshot text not null,payer_name_snapshot text not null,
 amount bigint not null check(amount between 1 and 100000000),admin_fee bigint not null,gross_amount bigint not null,
 payment_method text not null check(payment_method in ('qris','virtual_account','bank_transfer','e_wallet')),
 status text not null default 'pending' check(status in ('pending','succeeded')),
 is_simulation boolean not null default true check(is_simulation),environment text not null default 'development' check(environment='development'),
 idempotency_key uuid not null unique,transaction_id uuid unique references public.transactions(id) on delete restrict,
 created_at timestamptz not null default now(),completed_at timestamptz,updated_at timestamptz not null default now(),
 check(gross_amount=amount+admin_fee),
 check((kind='rent' and invoice_id is not null and admin_fee=2000) or (kind='boost' and invoice_id is null and amount=30000 and admin_fee=0)),
 check((status='pending' and transaction_id is null and completed_at is null) or (status='succeeded' and transaction_id is not null and completed_at is not null))
);
select private.secure_table('public.payment_attempts');
create unique index payment_one_success_invoice on public.payment_attempts(invoice_id) where kind='rent' and status='succeeded';
create index payment_attempts_payer_idx on public.payment_attempts(payer_id,created_at);
create index payment_attempts_property_idx on public.payment_attempts(property_id,created_at);
create policy payment_attempts_read on public.payment_attempts for select to authenticated using(payer_id=auth.uid() or private.owns_property(property_id) or private.is_admin());
create function private.guard_simulated_attempt() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.status='succeeded' then raise exception 'Payment history is immutable' using errcode='23514';end if;
 if (new.id,new.reference,new.payer_id,new.invoice_id,new.property_id,new.kind,new.amount,new.admin_fee,new.gross_amount,new.payment_method,new.idempotency_key,new.is_simulation,new.environment,new.property_name_snapshot,new.payer_name_snapshot,new.created_at) is distinct from
 (old.id,old.reference,old.payer_id,old.invoice_id,old.property_id,old.kind,old.amount,old.admin_fee,old.gross_amount,old.payment_method,old.idempotency_key,old.is_simulation,old.environment,old.property_name_snapshot,old.payer_name_snapshot,old.created_at) then raise exception 'Payment identity is immutable' using errcode='23514';end if;
 return new;
end $$;
create trigger immutable_payment_attempt before update or delete on public.payment_attempts for each row execute function private.guard_simulated_attempt();

create function public.server_simulate_payment(actor uuid,payment_kind text,resource_id uuid,simulated_method text,request_key uuid) returns public.payment_attempts language plpgsql security definer set search_path='' as $$
declare i public.invoices;p public.properties;a public.payment_attempts;pid uuid;rent bigint;fee bigint;tid uuid;expected_email text;
begin
 perform private.require_server();
 if not exists(select 1 from private.payment_simulator_settings where singleton and enabled and environment='development' and project_ref='wfmhsbdfdcugxblqsaob' for share) then raise exception 'SIMULATION_DISABLED' using errcode='42501';end if;
 if actor is null or resource_id is null or request_key is null or payment_kind is null or payment_kind not in ('rent','boost') or simulated_method is null or simulated_method not in ('qris','virtual_account','bank_transfer','e_wallet') then raise exception 'INVALID_PAYMENT' using errcode='22023';end if;
 -- app metadata is server-managed; user_metadata and an email alone never authorize simulation.
 select lower(email) into expected_email from auth.users where id=actor and raw_app_meta_data->>'development_fixture'='ngekosaja-development-auth-v1' and coalesce(raw_app_meta_data->>'development_fixture_run','') ~ '^[a-f0-9]{32}$';
 if expected_email is null or (payment_kind='rent' and expected_email not in ('dev-tenant-a@ngekosaja.test','dev-tenant-b@ngekosaja.test')) or (payment_kind='boost' and expected_email not in ('dev-owner-a@ngekosaja.test','dev-owner-b@ngekosaja.test')) then raise insufficient_privilege using message='DEVELOPMENT_ACCOUNT_REQUIRED';end if;
 if not exists(select 1 from public.user_roles where user_id=actor and role=case when payment_kind='rent' then 'tenant' else 'owner' end) then raise insufficient_privilege;end if;
 -- Stable lock ordering: request key then resource; different tabs serialize the same resource.
 perform pg_advisory_xact_lock(hashtextextended('simulation-key:'||request_key,0));
 perform pg_advisory_xact_lock(hashtextextended('simulation-resource:'||payment_kind||':'||resource_id,0));
 select * into a from public.payment_attempts where idempotency_key=request_key;
 if found then
  if a.payer_id<>actor or a.kind<>payment_kind or coalesce(a.invoice_id,a.property_id)<>resource_id or a.payment_method<>simulated_method then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='22023';end if;
  if a.status<>'succeeded' then raise exception 'PAYMENT_INCOMPLETE';end if;
  return a;
 end if;
 if payment_kind='rent' then
  select * into i from public.invoices where id=resource_id for update;
  select r.property_id into pid from public.rental_agreements g join public.rooms r on r.id=g.room_id where g.id=i.agreement_id and g.tenant_id=actor;
  if pid is null then raise insufficient_privilege;end if;
  if i.status='paid' then
   select * into a from public.payment_attempts where invoice_id=i.id and payer_id=actor and status='succeeded';
   if found then return a;end if;
  end if;
  if i.status<>'pending' then raise exception 'INVOICE_NOT_PAYABLE';end if;
  rent:=i.amount;fee:=i.admin_fee;select * into p from public.properties where id=pid;
 else
  select * into p from public.properties where id=resource_id for update;
  if p.id is null or p.owner_id<>actor then raise insufficient_privilege;end if;
  if p.publication_status<>'published' then raise exception 'BOOST_UNAVAILABLE';end if;
  select pa.* into a from public.payment_attempts pa join public.boost_campaigns b on b.transaction_id=pa.transaction_id where pa.property_id=p.id and pa.payer_id=actor and pa.kind='boost' and pa.status='succeeded' and b.end_date>private.today();
  if found then return a;end if;
  if exists(select 1 from public.boost_campaigns where property_id=p.id and end_date>private.today()) then raise exception 'BOOST_UNAVAILABLE';end if;
  pid:=p.id;rent:=30000;fee:=0;
 end if;
 if (select count(*) from public.payment_attempts where payer_id=actor and created_at>now()-interval '1 hour')>=20 then raise exception 'PAYMENT_RATE_LIMIT';end if;
 insert into public.payment_attempts(payer_id,invoice_id,property_id,kind,property_name_snapshot,payer_name_snapshot,amount,admin_fee,gross_amount,payment_method,idempotency_key)
 values(actor,case when payment_kind='rent' then i.id end,pid,payment_kind,p.name,(select display_name from public.profiles where id=actor),rent,fee,rent+fee,simulated_method,request_key) returning * into a;
 if payment_kind='rent' then tid:=public.server_record_rent_payment(i.id,'internal-simulation:'||a.id,true,'SIMULASI '||simulated_method,true,now());
 else tid:=public.server_record_boost(p.id,'internal-simulation:'||a.id,true,'SIMULASI '||simulated_method,true);end if;
 update public.payment_attempts set status='succeeded',transaction_id=tid,completed_at=now() where id=a.id returning * into a;
 if payment_kind='rent' then
  update public.notifications set title='SIMULASI: pembayaran sewa tercatat',body=i.tenant_name_snapshot||' · Tidak ada dana yang dipindahkan.',route='#/owner/payments' where user_id=p.owner_id and dedupe_key='payment:'||i.id;
 end if;
 perform private.notify(actor,'simulation:'||a.id,'SIMULASI: pembayaran berhasil',p.name||' · Bukan bukti transfer dana.',case when payment_kind='rent' then '#/checkout/'||i.id else '#/checkout/boost?property='||p.id end);
 return a;
end $$;
revoke all on function public.server_simulate_payment(uuid,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.server_simulate_payment(uuid,text,uuid,text,uuid) to service_role;
create function public.payment_capabilities() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',5,'provider','internal-simulator','environment','development','enabled',coalesce((select enabled from private.payment_simulator_settings where singleton),false))
$$;
grant execute on function public.payment_capabilities() to anon,authenticated;
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
 select jsonb_build_object('simulation',coalesce((select to_jsonb(g)-'is_simulation' from grouped g where is_simulation),'{}'),
 'non_simulation',coalesce((select to_jsonb(g)-'is_simulation' from grouped g where not is_simulation),'{}'),
 'basis','Simulated ledger totals are not received funds or production revenue'));
end $$;
grant execute on function public.payment_accounting(uuid,date,date) to authenticated;
do $$ declare t text;begin
 foreach t in array array['payment_attempts','transactions','boost_campaigns'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
commit;
