begin;
create table public.complaints (
 id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.rental_agreements(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 5 and 150), description text not null check(char_length(btrim(description)) between 10 and 4000),
 category text not null check(category in ('AC','Listrik','Air','Internet','Kebersihan','Keamanan','Furnitur','Lainnya')),
 urgency text not null check(urgency in ('low','medium','high','urgent')),
 priority text not null check(priority in ('low','medium','high','urgent')),
 status text not null default 'waiting' check(status in ('waiting','in_progress','awaiting_confirmation','resolved')),
 estimated_completion date, confirmed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((status='resolved' and confirmed_at is not null) or (status<>'resolved' and confirmed_at is null))
);
select private.secure_table('public.complaints');
create index complaints_agreement_idx on public.complaints(agreement_id,status);
create table public.complaint_histories (
 id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.complaints(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete restrict,
 previous_status text check(previous_status in ('waiting','in_progress','awaiting_confirmation','resolved')),
 status text not null check(status in ('waiting','in_progress','awaiting_confirmation','resolved')),
 note text not null default '' check(char_length(note)<=1000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.complaint_histories');
create index complaint_histories_ticket_idx on public.complaint_histories(complaint_id,created_at);
create table public.complaint_attachments (
 id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.complaints(id) on delete restrict,
 uploaded_by uuid not null references public.profiles(id) on delete restrict,
 storage_path text not null check(char_length(storage_path) between 1 and 500 and storage_path !~* '^(data:|javascript:)'),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')), size_bytes integer not null check(size_bytes between 1 and 1048576),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.complaint_attachments');
create index complaint_attachments_ticket_idx on public.complaint_attachments(complaint_id);
create index complaint_attachments_uploader_idx on public.complaint_attachments(uploaded_by);
create table public.complaint_notes (
 id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.complaints(id) on delete restrict,
 author_id uuid not null references public.profiles(id) on delete restrict, body text not null check(char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.complaint_notes');
create index complaint_notes_ticket_idx on public.complaint_notes(complaint_id,created_at);
create index complaint_notes_author_idx on public.complaint_notes(author_id);
create table public.complaint_analyses (
 id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.complaints(id) on delete restrict,
 accepted_by uuid not null references public.profiles(id) on delete restrict,
 rule_version text not null default 'local-keywords-v2', suggested_category text not null check(suggested_category in ('AC','Listrik','Air','Internet','Kebersihan','Keamanan','Furnitur','Lainnya')),
 suggested_priority text not null check(suggested_priority in ('low','medium','high','urgent')),
 summary text not null check(char_length(summary) between 1 and 300), safe_action text not null check(char_length(safe_action) between 1 and 1000),
 emergency boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select private.secure_table('public.complaint_analyses');
create index complaint_analyses_ticket_idx on public.complaint_analyses(complaint_id);
create index complaint_analyses_actor_idx on public.complaint_analyses(accepted_by);
create function private.can_read_complaint(cid uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.complaints where id=cid and private.can_read_agreement(agreement_id))
$$;
create function private.guard_complaint() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='UPDATE' and (new.id,new.agreement_id,new.title,new.description,new.urgency) is distinct from (old.id,old.agreement_id,old.title,old.description,old.urgency) then raise exception 'Complaint origin is immutable'; end if;
 if tg_op='INSERT' and (new.status<>'waiting' or not exists(select 1 from public.rental_agreements where id=new.agreement_id and status='active')) then raise exception 'New complaint requires active lease and waiting state'; end if;
 return new;
end $$;
create trigger guard_complaint before insert or update on public.complaints for each row execute function private.guard_complaint();
create function private.complaint_timeline() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.complaint_histories(complaint_id,actor_id,previous_status,status,note)
 values(new.id,auth.uid(),case when tg_op='UPDATE' then old.status else null end,new.status,coalesce(current_setting('app.complaint_note',true),''));
 return new;
end $$;
create trigger complaint_timeline after insert or update of status,priority,category,estimated_completion on public.complaints for each row execute function private.complaint_timeline();
create trigger immutable_complaint_history before update or delete on public.complaint_histories for each row execute function private.immutable_record();
create trigger immutable_complaint_note before update or delete on public.complaint_notes for each row execute function private.immutable_record();
create trigger immutable_complaint_analysis before update or delete on public.complaint_analyses for each row execute function private.immutable_record();
grant execute on function private.can_read_complaint(uuid) to authenticated;
commit;
