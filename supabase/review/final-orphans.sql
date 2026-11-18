-- Generated read-only counts for all application foreign keys.
select coalesce(jsonb_agg(row_to_json(checks) order by constraint_name),'[]'::jsonb) as fk_orphans from (
select 'activity_logs_actor_id_fkey' as constraint_name, count(*)::int as orphan_count from public.activity_logs child where child.actor_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.actor_id)
union all
select 'activity_logs_owner_id_fkey' as constraint_name, count(*)::int as orphan_count from public.activity_logs child where child.owner_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.owner_id)
union all
select 'boost_campaigns_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.boost_campaigns child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'boost_campaigns_transaction_id_fkey' as constraint_name, count(*)::int as orphan_count from public.boost_campaigns child where child.transaction_id is not null and not exists (select 1 from public.transactions parent where parent.id = child.transaction_id)
union all
select 'complaint_analyses_accepted_by_fkey' as constraint_name, count(*)::int as orphan_count from public.complaint_analyses child where child.accepted_by is not null and not exists (select 1 from public.profiles parent where parent.id = child.accepted_by)
union all
select 'complaint_analyses_complaint_id_fkey' as constraint_name, count(*)::int as orphan_count from public.complaint_analyses child where child.complaint_id is not null and not exists (select 1 from public.complaints parent where parent.id = child.complaint_id)
union all
select 'complaint_attachments_complaint_id_fkey' as constraint_name, count(*)::int as orphan_count from public.complaint_attachments child where child.complaint_id is not null and not exists (select 1 from public.complaints parent where parent.id = child.complaint_id)
union all
select 'complaint_attachments_uploaded_by_fkey' as constraint_name, count(*)::int as orphan_count from public.complaint_attachments child where child.uploaded_by is not null and not exists (select 1 from public.profiles parent where parent.id = child.uploaded_by)
union all
select 'complaint_histories_actor_id_fkey' as constraint_name, count(*)::int as orphan_count from public.complaint_histories child where child.actor_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.actor_id)
union all
select 'complaint_histories_complaint_id_fkey' as constraint_name, count(*)::int as orphan_count from public.complaint_histories child where child.complaint_id is not null and not exists (select 1 from public.complaints parent where parent.id = child.complaint_id)
union all
select 'complaint_notes_author_id_fkey' as constraint_name, count(*)::int as orphan_count from public.complaint_notes child where child.author_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.author_id)
union all
select 'complaint_notes_complaint_id_fkey' as constraint_name, count(*)::int as orphan_count from public.complaint_notes child where child.complaint_id is not null and not exists (select 1 from public.complaints parent where parent.id = child.complaint_id)
union all
select 'complaints_agreement_id_fkey' as constraint_name, count(*)::int as orphan_count from public.complaints child where child.agreement_id is not null and not exists (select 1 from public.rental_agreements parent where parent.id = child.agreement_id)
union all
select 'conversation_members_conversation_id_fkey' as constraint_name, count(*)::int as orphan_count from public.conversation_members child where child.conversation_id is not null and not exists (select 1 from public.conversations parent where parent.id = child.conversation_id)
union all
select 'conversation_members_user_id_fkey' as constraint_name, count(*)::int as orphan_count from public.conversation_members child where child.user_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.user_id)
union all
select 'conversations_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.conversations child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'conversations_prospect_id_fkey' as constraint_name, count(*)::int as orphan_count from public.conversations child where child.prospect_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.prospect_id)
union all
select 'favorites_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.favorites child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'favorites_user_id_fkey' as constraint_name, count(*)::int as orphan_count from public.favorites child where child.user_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.user_id)
union all
select 'invoices_agreement_id_fkey' as constraint_name, count(*)::int as orphan_count from public.invoices child where child.agreement_id is not null and not exists (select 1 from public.rental_agreements parent where parent.id = child.agreement_id)
union all
select 'listing_analytics_actor_id_fkey' as constraint_name, count(*)::int as orphan_count from public.listing_analytics child where child.actor_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.actor_id)
union all
select 'listing_analytics_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.listing_analytics child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'message_attachments_message_id_fkey' as constraint_name, count(*)::int as orphan_count from public.message_attachments child where child.message_id is not null and not exists (select 1 from public.messages parent where parent.id = child.message_id)
union all
select 'messages_conversation_id_fkey' as constraint_name, count(*)::int as orphan_count from public.messages child where child.conversation_id is not null and not exists (select 1 from public.conversations parent where parent.id = child.conversation_id)
union all
select 'messages_conversation_id_sender_id_fkey' as constraint_name, count(*)::int as orphan_count from public.messages child where child.conversation_id is not null and child.sender_id is not null and not exists (select 1 from public.conversation_members parent where parent.conversation_id = child.conversation_id and parent.user_id = child.sender_id)
union all
select 'messages_sender_id_fkey' as constraint_name, count(*)::int as orphan_count from public.messages child where child.sender_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.sender_id)
union all
select 'notifications_invoice_id_fkey' as constraint_name, count(*)::int as orphan_count from public.notifications child where child.invoice_id is not null and not exists (select 1 from public.invoices parent where parent.id = child.invoice_id)
union all
select 'notifications_user_id_fkey' as constraint_name, count(*)::int as orphan_count from public.notifications child where child.user_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.user_id)
union all
select 'profiles_id_fkey' as constraint_name, count(*)::int as orphan_count from public.profiles child where child.id is not null and not exists (select 1 from auth.users parent where parent.id = child.id)
union all
select 'properties_owner_id_fkey' as constraint_name, count(*)::int as orphan_count from public.properties child where child.owner_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.owner_id)
union all
select 'property_facilities_facility_id_fkey' as constraint_name, count(*)::int as orphan_count from public.property_facilities child where child.facility_id is not null and not exists (select 1 from public.facilities parent where parent.id = child.facility_id)
union all
select 'property_facilities_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.property_facilities child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'property_images_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.property_images child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'property_landmarks_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.property_landmarks child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'property_rules_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.property_rules child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'recent_searches_user_id_fkey' as constraint_name, count(*)::int as orphan_count from public.recent_searches child where child.user_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.user_id)
union all
select 'recurring_invoices_agreement_id_fkey' as constraint_name, count(*)::int as orphan_count from public.recurring_invoices child where child.agreement_id is not null and not exists (select 1 from public.rental_agreements parent where parent.id = child.agreement_id)
union all
select 'rental_agreements_room_id_fkey' as constraint_name, count(*)::int as orphan_count from public.rental_agreements child where child.room_id is not null and not exists (select 1 from public.rooms parent where parent.id = child.room_id)
union all
select 'rental_agreements_tenant_id_fkey' as constraint_name, count(*)::int as orphan_count from public.rental_agreements child where child.tenant_id is not null and not exists (select 1 from public.tenants parent where parent.id = child.tenant_id)
union all
select 'room_facilities_facility_id_fkey' as constraint_name, count(*)::int as orphan_count from public.room_facilities child where child.facility_id is not null and not exists (select 1 from public.facilities parent where parent.id = child.facility_id)
union all
select 'room_facilities_room_id_fkey' as constraint_name, count(*)::int as orphan_count from public.room_facilities child where child.room_id is not null and not exists (select 1 from public.rooms parent where parent.id = child.room_id)
union all
select 'rooms_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.rooms child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'tenants_id_fkey' as constraint_name, count(*)::int as orphan_count from public.tenants child where child.id is not null and not exists (select 1 from public.profiles parent where parent.id = child.id)
union all
select 'transactions_invoice_id_fkey' as constraint_name, count(*)::int as orphan_count from public.transactions child where child.invoice_id is not null and not exists (select 1 from public.invoices parent where parent.id = child.invoice_id)
union all
select 'transactions_property_id_fkey' as constraint_name, count(*)::int as orphan_count from public.transactions child where child.property_id is not null and not exists (select 1 from public.properties parent where parent.id = child.property_id)
union all
select 'user_roles_granted_by_fkey' as constraint_name, count(*)::int as orphan_count from public.user_roles child where child.granted_by is not null and not exists (select 1 from public.profiles parent where parent.id = child.granted_by)
union all
select 'user_roles_user_id_fkey' as constraint_name, count(*)::int as orphan_count from public.user_roles child where child.user_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.user_id)
union all
select 'user_settings_user_id_fkey' as constraint_name, count(*)::int as orphan_count from public.user_settings child where child.user_id is not null and not exists (select 1 from public.profiles parent where parent.id = child.user_id)
) checks;
