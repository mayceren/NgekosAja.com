import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connect} from '../../scripts/local-database.mjs';
import {readFileSync} from 'node:fs';
export async function runBackendContracts(db,config,results){
 const ids=Object.fromEntries(['owner','other','tenant','tenant2','stranger'].map(k=>[k,randomUUID()]));
 const val=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0]||{})[0];
 const as=async(key,fn,client=db,role='authenticated')=>{
  await client.query('begin');try{await client.query(`set local role ${role}`);await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[ids[key]||'',role]);const r=await fn(client);await client.query('commit');return r;}catch(error){await client.query('rollback');throw error;}
 };
 const rpc=(key,sql,args=[])=>as(key,c=>c.query(sql,args));
 const denied=fn=>assert.rejects(fn);
 const test=async(name,fn)=>{await fn();results.passed.push('Backend: '+name);console.log('PASS Backend: '+name);};
 for(const [key,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${key}-${id}@backend.test`,JSON.stringify({display_name:'Backend '+key})]);
 for(const key of ['owner','other'])await db.query("insert into public.user_roles(user_id,role) values($1,'owner')",[ids[key]]);
 const payload={name:'Kos Integrasi Lokal',location:'Grogol',address:'Jalan Pengujian Lokal 123',description:'Properti untuk pengujian pada database sementara.',base_rent:'1500000',gender_policy:'mixed',room_size:'3 x 4 m',publication_status:'published',images:[{path:'assets/images/room-2.jpg',alt:'Ilustrasi'}],facilities:[],rules:['Jaga kebersihan'],landmarks:[{name:'Kampus',distance:'5 menit'}]};
 let property,room,conversation,offer,agreement;
 await test('property multi-table creation is atomic and catalogue-safe',async()=>{
  property=(await rpc('owner','select public.owner_save_property($1::jsonb)',[JSON.stringify(payload)])).rows[0].owner_save_property;
  assert.equal(await val('select count(*)::int from public.property_images where property_id=$1',[property]),1);
  const catalogue=await as(null,c=>c.query('select * from public.public_listings() where id=$1',[property]),db,'anon');
  assert.equal(catalogue.rows.length,1);assert.equal('owner_id' in catalogue.rows[0],false);
  const before=await val('select count(*) from public.properties');await denied(()=>rpc('owner','select public.owner_save_property($1::jsonb)',[JSON.stringify({...payload,images:[{path:'data:image/png;base64,test'}]})]));assert.equal(await val('select count(*) from public.properties'),before);
 });
 await test('cross-owner property edits and client ownership spoofing rejected',async()=>{
  await denied(()=>rpc('other','select public.owner_save_property($1::jsonb)',[JSON.stringify({...payload,id:property})]));
  await denied(()=>rpc('stranger','select public.owner_save_property($1::jsonb)',[JSON.stringify(payload)]));
 });
 await test('room facilities save atomically; identity cannot cross property',async()=>{
  room=(await rpc('owner','select public.owner_save_room($1::jsonb)',[JSON.stringify({property_id:property,number:'T01',room_type:'Standard',rent:'1500000',operational_status:'available',facilities:[]})])).rows[0].owner_save_room;
  await denied(()=>rpc('other','select public.owner_save_room($1::jsonb)',[JSON.stringify({id:room,property_id:property,number:'Hijack',rent:'1500000',operational_status:'available'})]));
 });
 await test('invalid child replacement rolls back property header and old images',async()=>{
  await denied(()=>rpc('owner','select public.owner_save_property($1::jsonb)',[JSON.stringify({...payload,id:property,name:'Must Roll Back',facilities:[randomUUID()]})]));
  assert.equal(await val('select name from public.properties where id=$1',[property]),payload.name);
  assert.equal(await val('select count(*)::int from public.property_images where property_id=$1',[property]),1);
 });
 await test('operational summary rejects tenant/admin impersonation and scopes ownership',async()=>{
  const o=(await rpc('owner','select public.operational_summary(false,$1)',[property])).rows[0].operational_summary;assert.equal(o.properties,'1');assert.equal(o.available_rooms,'1');
  await denied(()=>rpc('tenant','select public.operational_summary()'));await denied(()=>rpc('owner','select public.operational_summary(true)'));await denied(()=>rpc('other','select public.operational_summary(false,$1)',[property]));
 });
 await test('conversation directory exposes participant names only to members',async()=>{
  conversation=(await rpc('tenant','select public.open_conversation($1)',[property])).rows[0].open_conversation;
  assert.equal((await rpc('owner','select * from public.conversation_directory() where id=$1',[conversation])).rows.length,1);
  assert.equal((await rpc('stranger','select * from public.conversation_directory() where id=$1',[conversation])).rows.length,0);
  await rpc('tenant','select public.send_message($1,$2)',[conversation,'Apakah kamar tersedia?']);
  const row=(await rpc('owner','select * from public.conversation_directory() where id=$1',[conversation])).rows[0];assert.equal(Number(row.unread_count),1);assert.equal('email' in row,false);
 });
 const dates=(await db.query("select private.today()::text starts,(private.today()+180)::text ends")).rows[0];
 const terms={conversation_id:conversation,room_id:room,start_date:dates.starts,end_date:dates.ends,rent:'1500000',payment_day:5};
 await test('check-in without explicit consent is denied despite valid conversation',async()=>{
  await denied(()=>rpc('owner','select public.owner_check_in($1,$2,$3,$4,1500000,5::smallint)',[ids.tenant,room,dates.starts,dates.ends]));
  assert.equal(await val('select count(*)::int from public.rental_agreements where room_id=$1',[room]),0);
 });
 await test('offer may originate only from the owner of the conversation property',async()=>{
  await denied(()=>rpc('other','select public.owner_propose_rental($1::jsonb)',[JSON.stringify(terms)]));
  offer=(await rpc('owner','select public.owner_propose_rental($1::jsonb)',[JSON.stringify({...terms,tenant_id:ids.stranger,owner_id:ids.other})])).rows[0].owner_propose_rental;
  assert.equal(await val('select tenant_id from public.rental_offers where id=$1',[offer]),ids.tenant);
  assert.equal(await val('select owner_id from public.rental_offers where id=$1',[offer]),ids.owner);
  assert.equal((await rpc('stranger','select * from public.rental_offers where id=$1',[offer])).rows.length,0);
  await denied(()=>rpc('owner','update public.rental_offers set status=$1 where id=$2',['accepted',offer]));
 });
 await test('only the actual tenant may accept; owner cannot forge consent',async()=>{
  await denied(()=>rpc('owner','select public.tenant_respond_rental($1,true)',[offer]));await denied(()=>rpc('stranger','select public.tenant_respond_rental($1,true)',[offer]));
  await db.query("update public.rental_offers set expires_at=now()-interval '1 minute' where id=$1",[offer]);
  await denied(()=>rpc('tenant','select public.tenant_respond_rental($1,true)',[offer]));
  await db.query("update public.rental_offers set expires_at=now()+interval '1 day' where id=$1",[offer]);
  await rpc('tenant','select public.tenant_respond_rental($1,true)',[offer]);
  await denied(()=>rpc('tenant','select public.tenant_respond_rental($1,false)',[offer]));
 });
 await test('changed rental terms invalidate consent; private bypass cannot execute',async()=>{
  await denied(()=>rpc('owner','select public.owner_check_in($1,$2,$3,$4,1600000,5::smallint)',[ids.tenant,room,dates.starts,dates.ends]));
  await denied(()=>rpc('owner','select private.check_in_consented($1,$2,$3,$4,1500000,5::smallint)',[ids.tenant,room,dates.starts,dates.ends]));
 });
 await test('expired accepted offers cannot be consumed and cannot silently extend',async()=>{
  await db.query("update public.rental_offers set expires_at=now()-interval '1 minute' where id=$1",[offer]);
  await denied(()=>rpc('owner','select public.owner_check_in($1,$2,$3,$4,1500000,5::smallint)',[ids.tenant,room,dates.starts,dates.ends]));
  await db.query("update public.rental_offers set expires_at=now()+interval '1 day' where id=$1",[offer]);
 });
 await test('concurrent consumption produces exactly one agreement and no double occupancy',async()=>{
  const clients=await Promise.all([connect(config),connect(config)]);
  try{const attempts=await Promise.allSettled(clients.map(c=>as('owner',x=>x.query('select public.owner_check_in($1,$2,$3,$4,1500000,5::smallint)',[ids.tenant,room,dates.starts,dates.ends]),c)));assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);}
  finally{await Promise.all(clients.map(c=>c.end()));}
  agreement=await val('select agreement_id from public.rental_offers where id=$1',[offer]);assert.ok(agreement);assert.equal(await val('select count(*)::int from public.rental_agreements where room_id=$1',[room]),1);
 });
 await test('invoice visible only to scoped parties; recurring deduplication and server-only ledger',async()=>{
  const month=dates.starts.slice(0,7)+'-01';
  const invoice=(await rpc('owner','select public.owner_create_invoice($1,$2,$3,1500000)',[agreement,month,dates.starts])).rows[0].owner_create_invoice;
  assert.equal((await rpc('tenant','select * from public.invoice_statuses where id=$1',[invoice])).rows.length,1);
  assert.equal((await rpc('tenant2','select * from public.invoice_statuses where id=$1',[invoice])).rows.length,0);
  await denied(()=>rpc('tenant','select public.server_record_rent_payment($1,$2,true,$3)',[invoice,'backend-browser-forgery','QRIS']));
  await denied(()=>rpc('owner','select public.owner_create_invoice($1,$2,$3,1500000)',[agreement,month,dates.starts]));
  // Use service-role claims explicitly in isolated test database, never in browser.
  await as(null,c=>c.query('select public.server_record_rent_payment($1,$2,true,$3)',[invoice,'backend-local-final-payment','LOCAL TEST']),db,'service_role');
  await denied(()=>as(null,c=>c.query('select public.server_record_rent_payment($1,$2,true,$3)',[invoice,'backend-duplicate-payment','LOCAL TEST']),db,'service_role'));
 });
 await test('complaint timeline and tenant-only final confirmation are enforced',async()=>{
  const cid=(await rpc('tenant','select public.tenant_create_complaint($1,$2,$3,$4,$5)',[agreement,'Keran air bocor','Keran air bocor sejak semalam.','Air','medium'])).rows[0].tenant_create_complaint;
  await denied(()=>rpc('stranger','select public.transition_complaint($1,$2)',[cid,'in_progress']));
  await rpc('owner','select public.transition_complaint($1,$2)',[cid,'in_progress']);await rpc('owner','select public.transition_complaint($1,$2)',[cid,'awaiting_confirmation']);
  await denied(()=>rpc('owner','select public.transition_complaint($1,$2)',[cid,'resolved']));await rpc('tenant','select public.transition_complaint($1,$2)',[cid,'resolved']);
  assert.ok(Number(await val('select count(*) from public.complaint_histories where complaint_id=$1',[cid]))>=4);
 });
 await test('new API functions have safe search paths, no anonymous execute or direct writes',async()=>{
  assert.equal(await val("select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=\"\"'],false)"),0);
  assert.equal(await val("select has_function_privilege('anon','public.owner_save_property(jsonb)','execute')"),false);
  assert.equal(await val("select has_table_privilege('authenticated','public.rental_offers','insert')"),false);
  assert.equal(await val("select has_table_privilege('service_role','public.rental_offers','truncate')"),false);
  assert.equal(await val("select count(*)::int from pg_tables where schemaname='public' and not rowsecurity"),0);
 });
 results.backend_structure=(await db.query(`select jsonb_build_object(
  'tables',(select count(*) from pg_tables where schemaname='public'),
  'policies',(select count(*) from pg_policies where schemaname='public'),
  'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'),
  'public_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
  'rls_disabled',(select count(*) from pg_tables where schemaname='public' and not rowsecurity)) structure`)).rows[0].structure;
 const postflight=(await db.query(readFileSync('supabase/review/backend-postflight.sql','utf8'))).rows[0].backend_postflight;
 assert.equal(postflight.tables,32);assert.equal(postflight.policies,46);assert.equal(postflight.foreign_keys,53);assert.equal(postflight.public_functions,30);
 for(const field of ['rls_disabled','unsafe_definer_paths','public_execute_grants'])assert.equal(postflight[field],0);
 for(const field of ['browser_direct_offer_write','browser_private_checkin','browser_server_payment','browser_server_boost','browser_role_grant','anonymous_property_save','anonymous_base_properties'])assert.equal(postflight[field],false);
 assert.equal(postflight.anonymous_catalogue,true);assert.equal(postflight.offer_read_policy,1);
 results.backend_postflight=postflight;results.passed.push('Backend: postflight schema, RLS and privilege metadata assertions');
}
