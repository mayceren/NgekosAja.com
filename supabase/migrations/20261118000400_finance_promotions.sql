begin;
set local search_path = public, extensions;
create table public.invoices (
 id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.rental_agreements(id) on delete restrict,
 period_start date not null check(extract(day from period_start)=1), due_date date not null,
 amount bigint not null check(amount between 100000 and 100000000), admin_fee bigint not null default 2000 check(admin_fee=2000),
 status text not null default 'pending' check(status in ('pending','paid','cancelled')),
 notes text not null default '' check(char_length(notes)<=1000),
 tenant_name_snapshot text not null, property_name_snapshot text not null, room_number_snapshot text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(agreement_id,period_start)
);
select private.secure_table('public.invoices');
create index invoices_due_idx on public.invoices(status,due_date);
create table public.recurring_invoices (
 id uuid primary key default gen_random_uuid(), agreement_id uuid not null unique references public.rental_agreements(id) on delete restrict,
 amount bigint not null check(amount between 100000 and 100000000), payment_day smallint not null check(payment_day between 1 and 28),
 start_month date not null check(extract(day from start_month)=1), last_generated_month date check(extract(day from last_generated_month)=1),
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(last_generated_month is null or last_generated_month>=start_month)
);
select private.secure_table('public.recurring_invoices');
create table public.transactions (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('rent','boost')),
 invoice_id uuid references public.invoices(id) on delete restrict,
 property_id uuid references public.properties(id) on delete restrict,
 amount bigint not null check(amount>0 and amount<=100000000), admin_fee bigint not null,
 method text not null check(char_length(btrim(method)) between 1 and 80), status text not null check(status in ('succeeded','failed')),
 idempotency_key text not null unique check(char_length(idempotency_key) between 8 and 150),
 is_simulation boolean not null default true,
 occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((kind='rent' and invoice_id is not null and property_id is null and admin_fee=2000) or
       (kind='boost' and invoice_id is null and property_id is not null and admin_fee=0 and amount=30000))
);
select private.secure_table('public.transactions');
create unique index one_successful_payment_per_invoice on public.transactions(invoice_id) where kind='rent' and status='succeeded';
create index transactions_invoice_idx on public.transactions(invoice_id);
create index transactions_property_idx on public.transactions(property_id,occurred_at);
create index transactions_occurred_idx on public.transactions(occurred_at) where status='succeeded';
create table public.boost_campaigns (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete restrict,
 transaction_id uuid unique references public.transactions(id) on delete restrict,
 start_date date not null default private.today(), end_date date not null,
 source text not null default 'payment' check(source in ('payment','development_grant')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_date=start_date+30),
 check((source='payment' and transaction_id is not null) or (source='development_grant' and transaction_id is null)),
 exclude using gist(property_id with =, daterange(start_date,end_date,'[)') with &&)
);
select private.secure_table('public.boost_campaigns');
create function private.immutable_record() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Historical records are immutable' using errcode='23514'; end $$;
create trigger immutable_transaction before update or delete on public.transactions for each row execute function private.immutable_record();
create trigger immutable_campaign before update or delete on public.boost_campaigns for each row execute function private.immutable_record();
create function private.guard_invoice() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='DELETE' then raise exception 'Preserve invoice history'; end if;
 if tg_op='INSERT' and new.status<>'pending' then raise exception 'Invoice must start pending'; end if;
 if tg_op='UPDATE' then
  if (new.id,new.agreement_id,new.period_start,new.admin_fee,new.tenant_name_snapshot,new.property_name_snapshot,new.room_number_snapshot) is distinct from
     (old.id,old.agreement_id,old.period_start,old.admin_fee,old.tenant_name_snapshot,old.property_name_snapshot,old.room_number_snapshot) then raise exception 'Invoice identity and snapshots are immutable'; end if;
  if old.status<>'pending' then raise exception 'Final invoice is immutable'; end if;
  if new.status='paid' then
   if (new.amount,new.due_date,new.notes) is distinct from (old.amount,old.due_date,old.notes) or not exists(select 1 from public.transactions where invoice_id=old.id and status='succeeded') then raise exception 'Successful server transaction required'; end if;
  elsif exists(select 1 from public.transactions where invoice_id=old.id) then raise exception 'Invoice with payment attempts cannot be edited or cancelled'; end if;
 end if;
 return new;
end $$;
create trigger guard_invoice before insert or update or delete on public.invoices for each row execute function private.guard_invoice();
create function private.guard_transaction() returns trigger language plpgsql security definer set search_path = '' as $$
declare i public.invoices;
begin
 if new.kind='rent' then
  select * into i from public.invoices where id=new.invoice_id for update;
  if i.id is null or i.status<>'pending' or new.amount<>i.amount or new.admin_fee<>i.admin_fee then raise exception 'Invoice is final or payment nominal does not match'; end if;
 else
  perform 1 from public.properties where id=new.property_id and publication_status='published' for update;
  if not found then raise exception 'Boost requires published property'; end if;
 end if;
 return new;
end $$;
create trigger guard_transaction before insert on public.transactions for each row execute function private.guard_transaction();
create function private.apply_rent_payment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.kind='rent' and new.status='succeeded' then update public.invoices set status='paid' where id=new.invoice_id; end if;
 return new;
end $$;
create trigger apply_rent_payment after insert on public.transactions for each row execute function private.apply_rent_payment();
create function private.guard_campaign() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.properties where id=new.property_id and publication_status='published' for update;
 if not found then raise exception 'Campaign requires published property'; end if;
 if new.source='payment' and not exists(select 1 from public.transactions where id=new.transaction_id and property_id=new.property_id and kind='boost' and status='succeeded' and amount=30000) then raise exception 'Successful matching boost transaction required'; end if;
 return new;
end $$;
create trigger guard_campaign before insert on public.boost_campaigns for each row execute function private.guard_campaign();
create function private.stop_recurring() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status<>'active' then update public.recurring_invoices set active=false where agreement_id=new.id; end if;
 return new;
end $$;
create trigger stop_recurring after update of status on public.rental_agreements for each row execute function private.stop_recurring();
commit;
