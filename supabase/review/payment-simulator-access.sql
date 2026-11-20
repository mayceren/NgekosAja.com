-- Read-only: no UUIDs, password hashes or secret metadata returned.
select jsonb_agg(jsonb_build_object(
 'account',target.label,'exists',u.id is not null,'profile_exists',p.id is not null,
 'fixture_marked',coalesce(u.raw_app_meta_data->>'development_fixture'='ngekosaja-development-auth-v1' and u.raw_app_meta_data->>'development_fixture_run' ~ '^[a-f0-9]{32}$',false),
 'role_matches',exists(select 1 from public.user_roles where user_id=u.id and role=target.role),
 'settlement_allowed_by_account_type',target.role in ('tenant','owner')
) order by target.label) simulator_account_access
from (values ('Prospect','dev-prospect@ngekosaja.test','prospect'),('Tenant A','dev-tenant-a@ngekosaja.test','tenant'),('Tenant B','dev-tenant-b@ngekosaja.test','tenant'),('Owner A','dev-owner-a@ngekosaja.test','owner'),('Owner B','dev-owner-b@ngekosaja.test','owner'),('Administrator','dev-admin@ngekosaja.test','admin')) target(label,email,role)
left join auth.users u on lower(u.email)=target.email left join public.profiles p on p.id=u.id;
