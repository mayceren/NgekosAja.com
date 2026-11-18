begin;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or private.related_tenant(id) or private.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
grant update(display_name,phone) on public.profiles to authenticated;
create policy roles_read on public.user_roles for select to authenticated using(user_id=(select auth.uid()) or private.is_admin());
create policy settings_own on public.user_settings for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant update(notifications_enabled,compact_mode,sidebar_collapsed) on public.user_settings to authenticated;

create policy properties_read on public.properties for select to authenticated using(private.property_party(id));
create policy properties_insert on public.properties for insert to authenticated with check(owner_id=(select auth.uid()) and private.has_role('owner'));
create policy properties_update on public.properties for update to authenticated using(private.owns_property(id)) with check(owner_id=(select auth.uid()));
create policy properties_delete on public.properties for delete to authenticated using(private.owns_property(id));
grant insert,delete on public.properties to authenticated;
grant update(name,location,address,description,base_rent,gender_policy,room_size,publication_status) on public.properties to authenticated;

create policy facilities_public on public.facilities for select to anon,authenticated using(true);
grant select on public.facilities to anon;
create policy images_read on public.property_images for select to authenticated using(private.property_party(property_id));
create policy images_write on public.property_images for all to authenticated using(private.owns_property(property_id)) with check(private.owns_property(property_id));
create policy rules_read on public.property_rules for select to authenticated using(private.property_party(property_id));
create policy rules_write on public.property_rules for all to authenticated using(private.owns_property(property_id)) with check(private.owns_property(property_id));
create policy landmarks_read on public.property_landmarks for select to authenticated using(private.property_party(property_id));
create policy landmarks_write on public.property_landmarks for all to authenticated using(private.owns_property(property_id)) with check(private.owns_property(property_id));
create policy property_facilities_read on public.property_facilities for select to authenticated using(private.property_party(property_id));
create policy property_facilities_write on public.property_facilities for all to authenticated using(private.owns_property(property_id)) with check(private.owns_property(property_id));
grant insert,update,delete on public.property_images,public.property_rules,public.property_landmarks,public.property_facilities to authenticated;

-- Tenants can see only their own historical room, never the internal room roster.
create function private.can_read_room(rid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select private.owns_room(rid) or private.is_admin() or exists(select 1 from public.rental_agreements where room_id=rid and tenant_id=auth.uid())
$$;
grant execute on function private.can_read_room(uuid) to authenticated;
create policy rooms_read on public.rooms for select to authenticated using(private.can_read_room(id));
create policy rooms_insert on public.rooms for insert to authenticated with check(private.owns_property(property_id));
create policy rooms_update on public.rooms for update to authenticated using(private.owns_property(property_id)) with check(private.owns_property(property_id));
create policy rooms_delete on public.rooms for delete to authenticated using(private.owns_property(property_id));
grant insert,delete on public.rooms to authenticated;
grant update(number,room_type,rent,operational_status) on public.rooms to authenticated;
create policy room_facilities_read on public.room_facilities for select to authenticated using(private.can_read_room(room_id));
create policy room_facilities_write on public.room_facilities for all to authenticated using(private.owns_room(room_id)) with check(private.owns_room(room_id));
grant insert,update,delete on public.room_facilities to authenticated;

create policy tenants_read on public.tenants for select to authenticated using(id=(select auth.uid()) or private.related_tenant(id) or private.is_admin());
create policy agreements_read on public.rental_agreements for select to authenticated using(private.can_read_agreement(id));
create policy invoices_read on public.invoices for select to authenticated using(private.can_read_agreement(agreement_id));
create policy recurring_read on public.recurring_invoices for select to authenticated using(private.can_read_agreement(agreement_id));
create policy transactions_read on public.transactions for select to authenticated using((kind='rent' and exists(select 1 from public.invoices i where i.id=invoice_id and private.can_read_agreement(i.agreement_id))) or (kind='boost' and private.owns_property(property_id)) or private.is_admin());
create policy campaigns_read on public.boost_campaigns for select to authenticated using(private.owns_property(property_id) or private.is_admin());
create policy complaints_read on public.complaints for select to authenticated using(private.can_read_agreement(agreement_id));
create policy histories_read on public.complaint_histories for select to authenticated using(private.can_read_complaint(complaint_id));
create policy complaint_attachments_read on public.complaint_attachments for select to authenticated using(private.can_read_complaint(complaint_id));
create policy notes_read on public.complaint_notes for select to authenticated using(private.can_read_complaint(complaint_id));
create policy analyses_read on public.complaint_analyses for select to authenticated using(private.can_read_complaint(complaint_id));
-- Cloud uploads are not implemented in Phase 1. Both attachment tables remain write-closed.
-- Only an involved party can accept a local rule analysis; it cannot alter complaint state.
create policy analyses_insert on public.complaint_analyses for insert to authenticated with check(accepted_by=(select auth.uid()) and private.can_read_complaint(complaint_id));
grant insert on public.complaint_analyses to authenticated;

create policy conversations_read on public.conversations for select to authenticated using(private.is_member(id) or private.is_admin());
create policy members_read on public.conversation_members for select to authenticated using(private.is_member(conversation_id) or private.is_admin());
create policy messages_read on public.messages for select to authenticated using(private.is_member(conversation_id) or private.is_admin());
create policy message_attachments_read on public.message_attachments for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id and (private.is_member(m.conversation_id) or private.is_admin())));
create policy notifications_read on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant update(read_at) on public.notifications to authenticated;
create policy favorites_own on public.favorites for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.public_listings() l where l.id=property_id));
grant insert,delete on public.favorites to authenticated;
create policy searches_own on public.recent_searches for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant insert,update,delete on public.recent_searches to authenticated;
create policy analytics_read on public.listing_analytics for select to authenticated using(private.owns_property(property_id) or private.is_admin());
create policy activity_read on public.activity_logs for select to authenticated using(owner_id=(select auth.uid()) or private.is_admin());

create function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; oid uuid; rid uuid; aid uuid; iid uuid;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name='properties' then oid:=(row_data->>'owner_id')::uuid;
 elsif tg_table_name='user_roles' then oid:=null;
 else
  if row_data ? 'property_id' then select owner_id into oid from public.properties where id=(row_data->>'property_id')::uuid; end if;
  rid:=case when tg_table_name='rooms' then (row_data->>'id')::uuid else (row_data->>'room_id')::uuid end;
  aid:=(row_data->>'agreement_id')::uuid; iid:=(row_data->>'invoice_id')::uuid;
  if iid is not null then select agreement_id into aid from public.invoices where id=iid; end if;
  if aid is not null then select room_id into rid from public.rental_agreements where id=aid; end if;
  if rid is not null then select p.owner_id into oid from public.rooms r join public.properties p on p.id=r.property_id where r.id=rid; end if;
 end if;
 insert into public.activity_logs(owner_id,actor_id,entity_table,entity_id,action,description) values(oid,auth.uid(),tg_table_name,(row_data->>'id')::uuid,tg_op,tg_table_name||' · '||tg_op);
 -- No old/new payloads: prevents cross-tenant PII being copied into audit logs.
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger audit_properties after insert or update or delete on public.properties for each row execute function private.audit_change();
create trigger audit_rooms after insert or update or delete on public.rooms for each row execute function private.audit_change();
create trigger audit_agreements after insert or update on public.rental_agreements for each row execute function private.audit_change();
create trigger audit_invoices after insert or update on public.invoices for each row execute function private.audit_change();
create trigger audit_transactions after insert on public.transactions for each row execute function private.audit_change();
create trigger audit_complaints after insert or update on public.complaints for each row execute function private.audit_change();
create trigger audit_campaigns after insert on public.boost_campaigns for each row execute function private.audit_change();
create trigger audit_roles after insert or update or delete on public.user_roles for each row execute function private.audit_change();
-- Tables were already RLS protected at creation. No write policy = no direct browser writes.
commit;
