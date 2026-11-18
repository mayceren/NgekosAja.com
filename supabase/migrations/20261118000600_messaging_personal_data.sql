begin;
create table public.conversations (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete restrict,
 prospect_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(property_id,prospect_id)
);
select private.secure_table('public.conversations');
create index conversations_prospect_idx on public.conversations(prospect_id);
create table public.conversation_members (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict, last_read_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(conversation_id,user_id)
);
select private.secure_table('public.conversation_members');
create index conversation_members_user_idx on public.conversation_members(user_id);
create table public.messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete restrict,
 sender_id uuid not null references public.profiles(id) on delete restrict,
 body text not null default '' check(char_length(body)<=1000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(conversation_id,sender_id) references public.conversation_members(conversation_id,user_id) on delete restrict
);
select private.secure_table('public.messages');
create index messages_conversation_idx on public.messages(conversation_id,created_at);
create index messages_sender_idx on public.messages(sender_id);
create table public.message_attachments (
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages(id) on delete restrict,
 storage_path text not null check(char_length(storage_path) between 1 and 500 and storage_path !~* '^(data:|javascript:)'),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')), size_bytes integer not null check(size_bytes between 1 and 1048576),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.message_attachments');
create index message_attachments_message_idx on public.message_attachments(message_id);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete restrict,
 dedupe_key text not null check(char_length(dedupe_key) between 1 and 200),
 invoice_id uuid references public.invoices(id) on delete restrict,
 title text not null check(char_length(title) between 1 and 150), body text not null check(char_length(body) between 1 and 1000),
 route text not null default '' check(char_length(route)<=200), read_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,dedupe_key)
);
select private.secure_table('public.notifications');
create index notifications_user_idx on public.notifications(user_id,created_at);
create index notifications_invoice_idx on public.notifications(invoice_id);
create table public.favorites (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 property_id uuid not null references public.properties(id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,property_id)
);
select private.secure_table('public.favorites');
create index favorites_property_idx on public.favorites(property_id);
create table public.recent_searches (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 query text not null check(char_length(btrim(query)) between 1 and 80),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,query)
);
select private.secure_table('public.recent_searches');
create table public.listing_analytics (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 session_id uuid not null, event_date date not null default private.today(),
 kind text not null check(kind in ('view','detail','contact')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(property_id,actor_id,session_id,event_date,kind)
);
select private.secure_table('public.listing_analytics');
create index listing_analytics_actor_idx on public.listing_analytics(actor_id);
create table public.activity_logs (
 id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete restrict,
 entity_table text not null, entity_id uuid not null, action text not null check(action in ('INSERT','UPDATE','DELETE','ROLE_GRANT')),
 description text not null check(char_length(description)<=300),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.activity_logs');
create index activity_logs_owner_idx on public.activity_logs(owner_id,created_at);
create index activity_logs_actor_idx on public.activity_logs(actor_id);
create function private.is_member(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from public.conversation_members where conversation_id=cid and user_id=auth.uid())
$$;
create function private.guard_member() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='UPDATE' and (new.id,new.conversation_id,new.user_id) is distinct from (old.id,old.conversation_id,old.user_id) then raise exception 'Membership is immutable'; end if;
 if not exists(select 1 from public.conversations c join public.properties p on p.id=c.property_id where c.id=new.conversation_id and new.user_id in (c.prospect_id,p.owner_id)) then raise exception 'Unauthorized conversation member'; end if;
 return new;
end $$;
create trigger guard_member before insert or update on public.conversation_members for each row execute function private.guard_member();
create trigger immutable_message before update or delete on public.messages for each row execute function private.immutable_record();
create trigger immutable_activity before update or delete on public.activity_logs for each row execute function private.immutable_record();
grant execute on function private.is_member(uuid) to authenticated;
commit;
