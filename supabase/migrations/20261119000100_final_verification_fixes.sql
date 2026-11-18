-- Prepared after final verification. NOT authorized for remote application yet.
-- Additive, transactional; preserves all existing rows and all applied migrations.
begin;

-- The previous CHECK could evaluate to NULL, which PostgreSQL accepts.
-- Fail closed on inconsistent existing data; never invent a historical checkout date.
alter table public.rental_agreements
 add constraint agreement_closed_on_required
 check (
  (status='active' and closed_on is null)
  or
  (status in ('checked_out','transferred') and closed_on is not null
   and closed_on between start_date and end_date+1)
 ) not valid;
alter table public.rental_agreements validate constraint agreement_closed_on_required;

create or replace function public.owner_close_agreement(target_agreement uuid, close_date date, reason text default 'checked_out')
returns void language plpgsql security definer set search_path = '' as $$
declare a public.rental_agreements;
begin
 select * into a from public.rental_agreements where id=target_agreement for update;
 if a.id is null or not private.owns_room(a.room_id) then raise exception 'Lease access denied' using errcode='42501'; end if;
 if close_date is null or reason is null then raise exception 'Checkout date and reason are required' using errcode='22004'; end if;
 if reason not in ('checked_out','transferred') or a.status<>'active'
    or close_date>private.today() or close_date<a.start_date or close_date>a.end_date+1 then
  raise exception 'Invalid checkout' using errcode='22023';
 end if;
 update public.rental_agreements set status=reason,closed_on=close_date where id=a.id;
end $$;

-- CREATE OR REPLACE retains the prior owner and function ACL. No browser grant added.
-- The security-invoker view evaluates this helper with the invoking role's rights.
grant execute on function private.today() to service_role;
commit;
