import {randomBytes} from 'node:crypto';
import {fixtureId} from '../development-fixtures.mjs';
import {validateRepairPassword, RepairError} from './owned-auth-account.mjs';

export const fixtureTag = 'ngekosaja-development-auth-v1';
export const accounts = Object.freeze([
  {key:'prospect', role:'prospect', name:'Development Calon Penghuni'},
  {key:'tenant-a', role:'tenant', name:'Development Penghuni A'},
  {key:'tenant-b', role:'tenant', name:'Development Penghuni B'},
  {key:'owner-a', role:'owner', name:'Development Pemilik A'},
  {key:'owner-b', role:'owner', name:'Development Pemilik B'},
  {key:'admin', role:'admin', name:'Development Administrator'},
].map(account => Object.freeze({...account,email:`dev-${account.key}@ngekosaja.test`})));
export const resourceIds = Object.fromEntries(['property-a','property-b','room-a','room-b','agreement-a','agreement-b'].map(key=>[key,fixtureId(`${fixtureTag}:${key}`)]));
const uuid = value => {if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value||''))throw new RepairError('UUID fixture tidak valid.');return `'${value}'::uuid`;};

export async function requireNewAccounts(admin) {
  const wanted = new Set(accounts.map(account=>account.email));
  for(let page=1;;page++) {
    const {data,error}=await admin.listUsers({page,perPage:100});
    if(error||!Array.isArray(data?.users))throw new RepairError('Inventaris Auth tidak dapat diperiksa.');
    if(data.users.some(user=>wanted.has((user.email||'').toLowerCase())))throw new RepairError('Alamat fixture sudah ada. Akun existing tidak diubah atau diambil alih; periksa laporan dahulu.');
    if(data.users.length<100)break;
  }
}

export async function provisionNewAccounts({admin,prompt,persistReceipt,writeRelations,verifyAccounts=async()=>{}}) {
  await requireNewAccounts(admin);
  const passwords = new Map(), identities = {}, run = randomBytes(16).toString('hex');
  try {
    // Collect every private password before creating anything. Cancel/mismatch is safe.
    for(const account of accounts) {
      const password=await prompt(`Password ${account.email} (tersembunyi): `);
      const confirmation=await prompt('Ulangi password: ');
      validateRepairPassword(password,confirmation);
      passwords.set(account.key,password);
    }
    const receipt={fixture:fixtureTag,run,created:[],relations_committed:false};
    await persistReceipt(receipt);
    for(const account of accounts) {
      const {data,error}=await admin.createUser({email:account.email,password:passwords.get(account.key),email_confirm:true,
        user_metadata:{display_name:account.name},app_metadata:{development_fixture:fixtureTag,development_fixture_run:run}});
      if(error||!data?.user?.id)throw new RepairError('Pembuatan Auth fixture berhenti. Akun existing tidak diubah; akun baru yang sudah tercatat dipertahankan. Periksa receipt lokal.');
      const user=data.user;
      uuid(user.id);
      if(user.email?.toLowerCase()!==account.email || user.app_metadata?.development_fixture_run!==run)throw new RepairError('Respons identitas Auth tidak cocok; tahap relasi dibatalkan.');
      identities[account.key]=user.id;
      receipt.created.push({key:account.key,id:user.id});
      await persistReceipt(receipt);
    }
    await writeRelations(relationSQL(identities,run));
    receipt.relations_committed=true;
    await persistReceipt(receipt);
    await verifyAccounts(identities,passwords);
    return {identities,created:accounts.length,relations_committed:true};
  } finally {passwords.clear();}
}

export function preflightSQL() {
  const emails=accounts.map(account=>`'${account.email}'`).join(',');
  const ids=Object.values(resourceIds).map(uuid).join(',');
  return `select json_build_object(
    'existing_target_accounts',(select count(*) from auth.users where lower(email) in (${emails})),
    'fixture_id_collisions',(select count(*) from (select id from public.properties union all select id from public.rooms union all select id from public.rental_agreements) resources where id in (${ids})),
    'profile_trigger_present',exists(select 1 from pg_trigger where tgname='on_auth_user_created' and not tgisinternal),
    'rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
    'auth_users',(select count(*) from auth.users)
  ) as development_preflight;`;
}

export function relationSQL(identities,run) {
  if(!/^[a-f0-9]{32}$/.test(run||''))throw new RepairError('Identitas run fixture tidak valid.');
  const user=key=>uuid(identities[key]),id=key=>uuid(resourceIds[key]);
  const userIds=accounts.map(account=>user(account.key));
  if(new Set(userIds).size!==accounts.length)throw new RepairError('Identitas Auth fixture harus berbeda.');
  const checks=accounts.map(account=>`if not exists(select 1 from auth.users where id=${user(account.key)} and lower(email)='${account.email}' and raw_app_meta_data->>'development_fixture_run'='${run}' and raw_app_meta_data->>'development_fixture'='${fixtureTag}') then raise exception 'Fixture Auth ownership mismatch'; end if;`).join('\n');
  const grants=accounts.filter(account=>account.role!=='prospect').map(account=>`perform public.server_grant_role(${user(account.key)},'${account.role}');`).join('\n');
  return `begin;
select pg_advisory_xact_lock(hashtextextended('${fixtureTag}',0));
select set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claim.sub','',true);
do $development$
begin
${checks}
if (select count(*) from public.profiles where id in (${userIds}))<>6 then raise exception 'Auth profile trigger incomplete'; end if;
if exists(select 1 from public.user_roles where user_id in (${userIds}) and role<>'prospect') then raise exception 'Existing roles cannot be changed by fixture provisioning'; end if;
if exists(select 1 from (select id from public.properties union all select id from public.rooms union all select id from public.rental_agreements) resources where id in (${Object.values(resourceIds).map(uuid)})) then raise exception 'Existing fixture resource collision'; end if;
${grants}
-- Check-in requires published property. Only NEW fixtures are temporarily published
-- inside this transaction and returned to draft before commit; never public listings.
insert into public.properties(id,owner_id,name,location,address,description,base_rent,gender_policy,publication_status) values
(${id('property-a')},${user('owner-a')},'DEVELOPMENT TEST Kos A','Tanjung Duren','Alamat ilustrasi Development A, Jakarta Barat','Properti testing development, bukan penawaran kos sungguhan.',1500000,'mixed','published'),
(${id('property-b')},${user('owner-b')},'DEVELOPMENT TEST Kos B','Grogol','Alamat ilustrasi Development B, Jakarta Barat','Properti testing development, bukan penawaran kos sungguhan.',1700000,'mixed','published');
insert into public.rooms(id,property_id,number,rent) values (${id('room-a')},${id('property-a')},'A-01',1500000),(${id('room-b')},${id('property-b')},'B-01',1700000);
insert into public.tenants(id) values (${user('tenant-a')}),(${user('tenant-b')});
insert into public.rental_agreements(id,tenant_id,room_id,start_date,end_date,rent,payment_day) values
(${id('agreement-a')},${user('tenant-a')},${id('room-a')},private.today(),(private.today()+interval '1 year')::date,1500000,5),
(${id('agreement-b')},${user('tenant-b')},${id('room-b')},private.today(),(private.today()+interval '1 year')::date,1700000,5);
update public.properties set publication_status='draft' where id in (${id('property-a')},${id('property-b')});
end $development$;
commit;`;
}

export function verificationSQL(identities) {
  const ids=accounts.map(account=>uuid(identities[account.key])).join(',');
  return `select json_build_object('profiles',(select count(*) from public.profiles where id in (${ids})),
  'roles',(select coalesce(json_agg(json_build_object('user_id',user_id,'role',role)),'[]') from public.user_roles where user_id in (${ids})),
  'agreements',(select count(*) from public.rental_agreements where id in (${uuid(resourceIds['agreement-a'])},${uuid(resourceIds['agreement-b'])}) and status='active'),
  'draft_properties',(select count(*) from public.properties where id in (${uuid(resourceIds['property-a'])},${uuid(resourceIds['property-b'])}) and publication_status='draft')) as development_verification;`;
}
