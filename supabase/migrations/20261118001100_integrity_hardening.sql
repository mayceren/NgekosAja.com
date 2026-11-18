begin;
create function private.guard_recurring() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='UPDATE' and (new.id,new.agreement_id,new.start_month) is distinct from (old.id,old.agreement_id,old.start_month) then raise exception 'Recurring identity and start month are immutable'; end if;
 if tg_op='UPDATE' and old.last_generated_month is not null and (new.last_generated_month is null or new.last_generated_month<old.last_generated_month) then raise exception 'Recurring cursor cannot move backwards'; end if;
 if new.active and not exists(select 1 from public.rental_agreements where id=new.agreement_id and status='active') then raise exception 'Active recurring requires active agreement'; end if;
 return new;
end $$;
create trigger guard_recurring before insert or update on public.recurring_invoices for each row execute function private.guard_recurring();

create function private.validate_message_content() returns trigger language plpgsql security definer set search_path = '' as $$
declare mid uuid;
begin
 if tg_table_name='messages' then mid:=new.id;
 else mid:=case when tg_op='DELETE' then old.message_id else new.message_id end; end if;
 if exists(select 1 from public.messages where id=mid and char_length(btrim(body))=0) and not exists(select 1 from public.message_attachments where message_id=mid) then raise exception 'Message requires text or an attachment' using errcode='23514'; end if;
 return null;
end $$;
-- Deferred so a future trusted upload workflow can insert message + attachment atomically.
create constraint trigger message_content_check after insert or update on public.messages deferrable initially deferred for each row execute function private.validate_message_content();
create constraint trigger attachment_content_check after insert or update or delete on public.message_attachments deferrable initially deferred for each row execute function private.validate_message_content();
create trigger immutable_message_attachment before update on public.message_attachments for each row execute function private.immutable_record();

create function public.owner_delete_property(target_property uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not private.owns_property(target_property) then raise exception 'Property access denied' using errcode='42501'; end if;
 perform 1 from public.properties where id=target_property for update;
 -- RESTRICT FKs block ALL deletions with agreements/transactions/chat/analytics/campaigns.
 -- Failure rolls back removal of rooms; archival is the normal historical workflow.
 delete from public.rooms where property_id=target_property;
 delete from public.properties where id=target_property;
end $$;
grant execute on function public.owner_delete_property(uuid) to authenticated;
commit;
