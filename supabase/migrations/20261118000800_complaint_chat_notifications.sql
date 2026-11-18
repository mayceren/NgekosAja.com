begin;
create function public.tenant_create_complaint(target_agreement uuid, ticket_title text, ticket_description text, ticket_category text, ticket_urgency text) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if not exists(select 1 from public.rental_agreements where id=target_agreement and tenant_id=auth.uid() and status='active') then raise exception 'Active tenant required' using errcode='42501'; end if;
 insert into public.complaints(agreement_id,title,description,category,urgency,priority) values(target_agreement,ticket_title,ticket_description,ticket_category,ticket_urgency,ticket_urgency) returning id into result;
 return result;
end $$;
create function public.transition_complaint(target_complaint uuid, next_status text, treatment_note text default '', final_category text default null, final_priority text default null, eta date default null) returns void language plpgsql security definer set search_path = '' as $$
declare c public.complaints; a public.rental_agreements; is_tenant boolean; is_owner boolean;
begin
 select * into c from public.complaints where id=target_complaint for update;
 select * into a from public.rental_agreements where id=c.agreement_id;
 is_tenant:=a.tenant_id=auth.uid(); is_owner:=private.owns_room(a.room_id);
 if c.id is null or auth.uid() is null or not (is_tenant or is_owner or private.is_admin()) then raise exception 'Complaint access denied' using errcode='42501'; end if;
 if is_tenant and not is_owner then
  if not ((c.status='awaiting_confirmation' and next_status='resolved') or (c.status in ('awaiting_confirmation','resolved') and next_status='waiting' and char_length(btrim(treatment_note))>0)) then raise exception 'Tenant transition denied'; end if;
  if final_category is not null or final_priority is not null or eta is not null then raise exception 'Tenant cannot edit treatment fields'; end if;
 else
  if c.status='resolved' or next_status not in ('waiting','in_progress','awaiting_confirmation') then raise exception 'Completion must be confirmed by tenant'; end if;
 end if;
 perform set_config('app.complaint_note',treatment_note,true);
 update public.complaints set status=next_status,category=coalesce(final_category,category),priority=coalesce(final_priority,priority),estimated_completion=coalesce(eta,estimated_completion),confirmed_at=case when next_status='resolved' then now() else null end where id=c.id;
 if char_length(btrim(treatment_note))>0 then insert into public.complaint_notes(complaint_id,author_id,body) values(c.id,auth.uid(),treatment_note); end if;
 perform set_config('app.complaint_note','',true);
end $$;
create function public.open_conversation(target_property uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.properties; result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into p from public.properties where id=target_property and publication_status='published';
 if p.id is null or p.owner_id=auth.uid() then raise exception 'Cannot start this conversation'; end if;
 insert into public.conversations(property_id,prospect_id) values(p.id,auth.uid()) on conflict(property_id,prospect_id) do update set updated_at=now() returning id into result;
 insert into public.conversation_members(conversation_id,user_id) values(result,auth.uid()),(result,p.owner_id) on conflict do nothing;
 return result;
end $$;
create function public.send_message(target_conversation uuid, message_body text) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if not private.is_member(target_conversation) then raise exception 'Conversation access denied' using errcode='42501'; end if;
 insert into public.messages(conversation_id,sender_id,body) values(target_conversation,auth.uid(),btrim(message_body)) returning id into result;
 update public.conversations set updated_at=now() where id=target_conversation;
 return result;
end $$;
create function public.mark_conversation_read(target_conversation uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_member(target_conversation) then raise exception 'Conversation access denied' using errcode='42501'; end if;
 update public.conversation_members set last_read_at=now() where conversation_id=target_conversation and user_id=auth.uid();
 update public.notifications set read_at=now() where user_id=auth.uid() and dedupe_key like 'message:'||target_conversation::text||':%' and read_at is null;
end $$;
create function private.notify(recipient uuid, dedup text, subject text, content text, target_route text default '', target_invoice uuid default null) returns void language sql security definer set search_path = '' as $$
 insert into public.notifications(user_id,dedupe_key,title,body,route,invoice_id) values(recipient,dedup,subject,content,target_route,target_invoice) on conflict(user_id,dedupe_key) do nothing
$$;
create function private.notify_message() returns trigger language plpgsql security definer set search_path = '' as $$
declare member record;
begin
 for member in select user_id from public.conversation_members where conversation_id=new.conversation_id and user_id<>new.sender_id loop
  perform private.notify(member.user_id,'message:'||new.conversation_id||':'||new.id,'Pesan baru',coalesce(nullif(left(btrim(new.body),80),''),'Lampiran gambar'),'#/chat');
 end loop;
 return new;
end $$;
create trigger notify_message after insert on public.messages for each row execute function private.notify_message();
create function private.notify_complaint() returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_user uuid; tenant_user uuid; recipient uuid;
begin
 select p.owner_id,a.tenant_id into owner_user,tenant_user from public.rental_agreements a join public.rooms r on r.id=a.room_id join public.properties p on p.id=r.property_id where a.id=new.agreement_id;
 recipient:=case when tg_op='INSERT' or auth.uid()=tenant_user then owner_user else tenant_user end;
 perform private.notify(recipient,'complaint:'||new.id||':'||gen_random_uuid(),'Perkembangan laporan',new.title||' · '||new.status,'#/complaints');
 return new;
end $$;
create trigger notify_complaint after insert or update on public.complaints for each row execute function private.notify_complaint();
create function private.notify_invoice() returns trigger language plpgsql security definer set search_path = '' as $$
declare t uuid; o uuid;
begin
 select a.tenant_id,p.owner_id into t,o from public.rental_agreements a join public.rooms r on r.id=a.room_id join public.properties p on p.id=r.property_id where a.id=new.agreement_id;
 if tg_op='INSERT' then perform private.notify(t,'invoice:'||new.id,'Tagihan sewa baru',new.property_name_snapshot||' · '||new.period_start,'#/tenant/bills',new.id);
 elsif new.status in ('paid','cancelled') then
  update public.notifications set read_at=coalesce(read_at,now()) where invoice_id=new.id;
  if new.status='paid' then perform private.notify(o,'payment:'||new.id,'Pembayaran sewa diterima',new.tenant_name_snapshot||' · '||new.period_start,'#/owner/bills',new.id); end if;
 end if;
 return new;
end $$;
create trigger notify_invoice after insert or update on public.invoices for each row execute function private.notify_invoice();
create function public.generate_payment_reminders() returns integer language plpgsql security definer set search_path = '' as $$
declare i record; stage text; before_count bigint; after_count bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select count(*) into before_count from public.notifications where user_id=auth.uid();
 for i in select inv.*,a.tenant_id from public.invoices inv join public.rental_agreements a on a.id=inv.agreement_id where inv.status='pending' and a.tenant_id=auth.uid() and inv.due_date<=private.today()+3 for update of inv loop
  stage:=case when i.due_date<private.today() then 'overdue' when i.due_date=private.today() then 'due_today' else 'h3' end;
  perform private.notify(i.tenant_id,'reminder:'||i.id||':'||stage,'Pengingat pembayaran sewa',i.property_name_snapshot||' · jatuh tempo '||i.due_date,'#/tenant/bills',i.id);
 end loop;
 select count(*) into after_count from public.notifications where user_id=auth.uid(); return (after_count-before_count)::integer;
end $$;
create function public.owner_send_reminder(target_invoice uuid) returns void language plpgsql security definer set search_path = '' as $$
declare i public.invoices; tid uuid;
begin
 select * into i from public.invoices where id=target_invoice for update;
 select a.tenant_id into tid from public.rental_agreements a where a.id=i.agreement_id and private.owns_room(a.room_id);
 if tid is null then raise exception 'Invoice access denied' using errcode='42501'; end if;
 if i.status<>'pending' then raise exception 'Invoice is final'; end if;
 perform private.notify(tid,'manual:'||i.id||':'||private.today(),'Pengingat dari pengelola',i.property_name_snapshot||' · jatuh tempo '||i.due_date,'#/tenant/bills',i.id);
end $$;
create function public.record_listing_event(target_property uuid, event_kind text, event_session uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.properties where id=target_property and publication_status='published') then raise exception 'Published listing and signed in actor required' using errcode='42501'; end if;
 insert into public.listing_analytics(property_id,actor_id,session_id,kind) values(target_property,auth.uid(),event_session,event_kind) on conflict do nothing;
end $$;
grant execute on function public.tenant_create_complaint(uuid,text,text,text,text), public.transition_complaint(uuid,text,text,text,text,date),public.open_conversation(uuid),public.send_message(uuid,text),public.mark_conversation_read(uuid),public.generate_payment_reminders(),public.owner_send_reminder(uuid),public.record_listing_event(uuid,text,uuid) to authenticated;
commit;
