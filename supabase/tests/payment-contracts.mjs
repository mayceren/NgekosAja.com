import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connect} from '../../scripts/local-database.mjs';
import {createSimulatorHandler,projectRef} from '../functions/_shared/simulator.mjs';
export async function runPaymentContracts(db,results,config){
 const ids={};
 for(const [key,email]of Object.entries({owner:'dev-owner-a@ngekosaja.test',otherOwner:'dev-owner-b@ngekosaja.test',tenant:'dev-tenant-a@ngekosaja.test',otherTenant:'dev-tenant-b@ngekosaja.test',admin:'dev-admin@ngekosaja.test',prospect:'dev-prospect@ngekosaja.test',personal:randomUUID()+'@personal.test'})){
  let row=(await db.query('select id from auth.users where email=$1',[email])).rows[0];
  if(!row){row=(await db.query('insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3,$4) returning id',[randomUUID(),email,{display_name:key},key==='personal'?{}:{development_fixture:'ngekosaja-development-auth-v1',development_fixture_run:'a'.repeat(32)}])).rows[0];}
  ids[key]=row.id;
 }
 for(const [key,role]of [['owner','owner'],['otherOwner','owner'],['tenant','tenant'],['otherTenant','tenant'],['admin','admin']])await db.query('insert into public.user_roles(user_id,role) values($1,$2) on conflict(user_id,role) do nothing',[ids[key],role]);
 const run=async(key,sql,args=[],client=db,role='authenticated')=>{await client.query('begin');try{await client.query(`set local role ${role}`);await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[ids[key]||'',role]);const rows=(await client.query(sql,args)).rows;await client.query('commit');return rows;}catch(e){await client.query('rollback');throw e;}};
 const rpc=async(key,sql,args=[])=>Object.values((await run(key,sql,args))[0]||{})[0];
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0]||{})[0];
 const test=async(name,fn)=>{await fn();results.passed.push('Payment Simulator: '+name);console.log('PASS Payment Simulator: '+name);};
 const settle=(key,kind,id,method='qris',requestKey=randomUUID(),client=db)=>run(null,'select * from public.server_simulate_payment($1,$2,$3,$4,$5)',[ids[key],kind,id,method,requestKey],client,'service_role').then(rows=>rows[0]);
 const makeProperty=key=>rpc(key,'select public.owner_save_property($1)',[{name:'Kos Simulasi '+key,location:'Grogol',address:'Jalan Pengujian Lokal 101',description:'Fixture simulasi hanya dalam database scratch.',base_rent:'1500000',gender_policy:'mixed',room_size:'3 x 4 m',publication_status:'published',images:[],facilities:[],rules:[],landmarks:[]}]);
 const property=await makeProperty('owner'),otherProperty=await makeProperty('otherOwner');
 const room=await rpc('owner','select public.owner_save_room($1)',[{property_id:property,number:'SIM01',room_type:'Standard',rent:'1500000',operational_status:'available',facilities:[]}]);
 const dates=(await db.query("select private.today()::text start,(private.today()+180)::text finish,date_trunc('month',private.today())::date::text billing_month")).rows[0];
 const conversation=await rpc('tenant','select public.open_conversation($1)',[property]);
 const offer=await rpc('owner','select public.owner_propose_rental($1)',[{conversation_id:conversation,room_id:room,start_date:dates.start,end_date:dates.finish,rent:'1500000',payment_day:5}]);await rpc('tenant','select public.tenant_respond_rental($1,true)',[offer]);
 // Existing Phase 2 fixture lease is preserved; close it only in this scratch test if present.
 for(const old of (await db.query("select id from public.rental_agreements where tenant_id=$1 and status='active'",[ids.tenant])).rows)await rpc('owner','select public.owner_close_agreement($1,$2,$3)',[old.id,dates.start,'transferred']);
 const agreement=await rpc('owner','select public.owner_check_in($1,$2,$3,$4,1500000,5::smallint)',[ids.tenant,room,dates.start,dates.finish]);
 let offset=0;const newInvoice=async()=>{const period=await value("select ($1::date+make_interval(months=>$2))::date::text",[dates.billing_month,offset++]);return rpc('owner','select public.owner_create_invoice($1,$2,$3,1500000,$4)',[agreement,period,dates.start,'Internal simulation fixture']);};
 const invoice=await newInvoice();let paid,boost;const requestKey=randomUUID();
 await test('disabled by default; private configuration and production settings denied',async()=>{
  assert.equal((await rpc('tenant','select public.payment_capabilities()')).enabled,false);await assert.rejects(()=>settle('tenant','rent',invoice));
  for(const key of ['tenant','owner','admin'])await assert.rejects(()=>run(key,'select * from private.payment_simulator_settings'));
  await assert.rejects(()=>db.query("update private.payment_simulator_settings set environment='production'"));await assert.rejects(()=>db.query("update private.payment_simulator_settings set project_ref='other'"));
  await db.query('update private.payment_simulator_settings set enabled=true');
 });
 await test('settlement writers remain inaccessible to anonymous, tenant, owner and admin JWT roles',async()=>{
  for(const role of ['anon','authenticated'])for(const key of ['tenant','owner','admin'])await assert.rejects(()=>run(key,'select public.server_simulate_payment($1,$2,$3,$4,$5)',[ids.tenant,'rent',invoice,'qris',requestKey],db,role));
 });
 await test('personal/prospect/admin and wrong tenant/owner cannot settle another resource',async()=>{
  for(const key of ['personal','prospect','admin','otherTenant','owner'])await assert.rejects(()=>settle(key,'rent',invoice));
  await assert.rejects(()=>settle('otherOwner','boost',property));await assert.rejects(()=>settle('owner','boost',otherProperty));
 });
 await test('trusted app metadata required; self-editable metadata never grants simulation',async()=>{
  const saved=await value('select raw_app_meta_data from auth.users where id=$1',[ids.tenant]);
  await db.query("update auth.users set raw_app_meta_data='{}',raw_user_meta_data=raw_user_meta_data||$2::jsonb where id=$1",[ids.tenant,saved]);
  try{await assert.rejects(()=>settle('tenant','rent',invoice));}finally{await db.query('update auth.users set raw_app_meta_data=$2 where id=$1',[ids.tenant,saved]);}
 });
 await test('rent derives DB amount plus 2,000 and commits invoice, ledger and attempt together',async()=>{
  paid=await settle('tenant','rent',invoice,'qris',requestKey);assert.equal(paid.amount,'1500000');assert.equal(paid.admin_fee,'2000');assert.equal(paid.gross_amount,'1502000');assert.equal(paid.is_simulation,true);assert.equal(paid.status,'succeeded');assert.ok(paid.completed_at);assert.equal(await value('select status from public.invoices where id=$1',[invoice]),'paid');
  const t=(await db.query('select * from public.transactions where id=$1',[paid.transaction_id])).rows[0];assert.equal(t.is_simulation,true);assert.equal(t.method,'SIMULASI qris');
 });
 await test('same key retry returns saved transaction; payload/key collision is rejected',async()=>{
  assert.equal((await settle('tenant','rent',invoice,'qris',requestKey)).id,paid.id);await assert.rejects(()=>settle('tenant','rent',invoice,'e_wallet',requestKey));await assert.rejects(()=>settle('owner','boost',property,'qris',requestKey));
  assert.equal((await settle('tenant','rent',invoice,'virtual_account')).id,paid.id);assert.equal(Number(await value('select count(*) from public.transactions where invoice_id=$1',[invoice])),1);
 });
 await test('two tabs with distinct keys serialize one payment and one ledger entry',async()=>{
  const inv=await newInvoice(),clients=await Promise.all([connect(config),connect(config)]);
  try{const rows=await Promise.all(clients.map(c=>settle('tenant','rent',inv,'bank_transfer',randomUUID(),c)));assert.equal(rows[0].id,rows[1].id);}finally{await Promise.all(clients.map(c=>c.end()));}
  assert.equal(Number(await value('select count(*) from public.transactions where invoice_id=$1',[inv])),1);
 });
 await test('attempt/transaction/receipt RLS isolates both owners and tenants',async()=>{
  for(const key of ['tenant','owner','admin']){assert.equal((await run(key,'select id from public.payment_attempts where id=$1',[paid.id])).length,1);assert.equal((await run(key,'select id from public.transactions where id=$1',[paid.transaction_id])).length,1);}
  for(const key of ['otherTenant','otherOwner','prospect','personal']){assert.equal((await run(key,'select id from public.payment_attempts where id=$1',[paid.id])).length,0);assert.equal((await run(key,'select id from public.transactions where id=$1',[paid.transaction_id])).length,0);}
  await assert.rejects(()=>run('tenant',"update public.payment_attempts set amount=1 where id=$1",[paid.id]));await assert.rejects(()=>db.query('delete from public.payment_attempts where id=$1',[paid.id]));
 });
 await test('cancelled invoice and invalid methods cannot create attempts or transactions',async()=>{
  const inv=await newInvoice();await rpc('owner','select public.owner_update_invoice($1,1500000,$2,$3,true)',[inv,dates.start,'Cancelled test']);await assert.rejects(()=>settle('tenant','rent',inv));await assert.rejects(()=>settle('tenant','rent',invoice,'real_bank'));
  assert.equal(Number(await value('select count(*) from public.payment_attempts where invoice_id=$1',[inv])),0);
 });
 await test('Boost atomic success creates one exact 30-day campaign; two tabs reuse active purchase',async()=>{
  const clients=await Promise.all([connect(config),connect(config)]);try{const rows=await Promise.all(clients.map(c=>settle('owner','boost',property,'e_wallet',randomUUID(),c)));boost=rows[0];assert.equal(rows[0].id,rows[1].id);}finally{await Promise.all(clients.map(c=>c.end()));}
  assert.equal(boost.gross_amount,'30000');assert.equal(boost.admin_fee,'0');const rows=(await db.query('select end_date-start_date days from public.boost_campaigns where transaction_id=$1',[boost.transaction_id])).rows;assert.equal(rows.length,1);assert.equal(rows[0].days,30);
  assert.equal((await settle('owner','boost',property)).id,boost.id);assert.equal(Number(await value('select count(*) from public.boost_campaigns where property_id=$1',[property])),1);
 });
 await test('draft listing and existing unrelated campaign reject Boost',async()=>{
  await run('otherOwner',"update public.properties set publication_status='draft' where id=$1",[otherProperty]);await assert.rejects(()=>settle('otherOwner','boost',otherProperty));await run('otherOwner',"update public.properties set publication_status='published' where id=$1",[otherProperty]);
  await db.query("insert into public.boost_campaigns(property_id,start_date,end_date,source) values($1,private.today(),private.today()+30,'development_grant')",[otherProperty]);await assert.rejects(()=>settle('otherOwner','boost',otherProperty));
 });
 await test('failure after ledger insert rolls back invoice, attempt, ledger and notifications',async()=>{
  const inv=await newInvoice();await db.query("create function private.test_payment_failure() returns trigger language plpgsql as $$ begin if new.dedupe_key like 'simulation:%' then raise exception 'Forced scratch failure';end if;return new;end $$; create trigger test_payment_failure before insert on public.notifications for each row execute function private.test_payment_failure()");
  try{await assert.rejects(()=>settle('tenant','rent',inv));}finally{await db.query('drop trigger test_payment_failure on public.notifications;drop function private.test_payment_failure()');}
  assert.equal(await value('select status from public.invoices where id=$1',[inv]),'pending');for(const table of ['transactions','payment_attempts'])assert.equal(Number(await value(`select count(*) from public.${table} where invoice_id=$1`,[inv])),0);
 });
 await test('all illustrative methods use the same server mechanism and persist after new connection',async()=>{
  for(const method of ['qris','virtual_account','bank_transfer','e_wallet']){const a=await settle('tenant','rent',await newInvoice(),method);assert.equal(a.payment_method,method);const c=await connect(config);try{assert.equal((await run('tenant','select status from public.payment_attempts where id=$1',[a.id],c))[0].status,'succeeded');}finally{await c.end();}}
 });
 await test('notifications are simulation-labelled and private to the relevant tenant/owner',async()=>{
  const ownerRows=await run('owner','select title,body from public.notifications where invoice_id=$1 and dedupe_key=$2',[invoice,'payment:'+invoice]);assert.ok(ownerRows[0].title.startsWith('SIMULASI'));assert.ok(ownerRows[0].body.includes('Tidak ada dana'));
  assert.equal((await run('tenant','select id from public.notifications where dedupe_key=$1',['simulation:'+paid.id])).length,1);assert.equal((await run('otherTenant','select id from public.notifications where dedupe_key=$1',['simulation:'+paid.id])).length,0);
 });
 await test('accounting separates simulated and nonsimulated totals and denies foreign owner scope',async()=>{
  const inv=await newInvoice();await run(null,'select public.server_record_rent_payment($1,$2,true,$3,false,now())',[inv,'historical-nonsimulation:'+randomUUID(),'HISTORICAL TEST'],db,'service_role');
  const a=await rpc('owner','select public.payment_accounting($1)',[property]);assert.ok(BigInt(a.simulation.rent_gmv)>0n);assert.equal(a.simulation.boost_revenue,'30000');assert.equal(a.non_simulation.rent_gmv,'1500000');assert.equal(a.non_simulation.admin_fees,'2000');await assert.rejects(()=>rpc('otherOwner','select public.payment_accounting($1)',[property]));
 });
 await test('Tenant B and Owner B can settle their own resources without exposing records to A',async()=>{
  const p=await makeProperty('otherOwner'),r=await rpc('otherOwner','select public.owner_save_room($1)',[{property_id:p,number:'SIM-B',room_type:'Standard',rent:'1500000',operational_status:'available',facilities:[]}]);
  const c=await rpc('otherTenant','select public.open_conversation($1)',[p]),offer=await rpc('otherOwner','select public.owner_propose_rental($1)',[{conversation_id:c,room_id:r,start_date:dates.start,end_date:dates.finish,rent:'1500000',payment_day:5}]);await rpc('otherTenant','select public.tenant_respond_rental($1,true)',[offer]);
  for(const old of (await db.query("select id from public.rental_agreements where tenant_id=$1 and status='active'",[ids.otherTenant])).rows)await rpc('otherOwner','select public.owner_close_agreement($1,$2,$3)',[old.id,dates.start,'transferred']);
  const g=await rpc('otherOwner','select public.owner_check_in($1,$2,$3,$4,1500000,5::smallint)',[ids.otherTenant,r,dates.start,dates.finish]),i=await rpc('otherOwner','select public.owner_create_invoice($1,$2,$3,1500000,$4)',[g,dates.billing_month,dates.start,'Tenant B test']);
  const a=await settle('otherTenant','rent',i),b=await settle('otherOwner','boost',p);assert.equal(a.status,'succeeded');assert.equal(b.status,'succeeded');
  for(const key of ['tenant','owner'])assert.equal((await run(key,'select id from public.payment_attempts where id=any($1::uuid[])',[[a.id,b.id]])).length,0);
 });
 await test('actual HTTP handler and real PostgreSQL settle without a provider or optimistic UI',async()=>{
  const inv=await newInvoice(),u=(await db.query('select id,email,raw_app_meta_data app_metadata from auth.users where id=$1',[ids.tenant])).rows[0];
  const env={PAYMENT_SIMULATOR_ENABLED:'true',PAYMENT_ENVIRONMENT:'development',PAYMENT_ALLOWED_PROJECT_REF:projectRef,SUPABASE_URL:`https://${projectRef}.supabase.co`,PAYMENT_ALLOWED_ORIGINS:'http://localhost:5500'};
  const h=createSimulatorHandler('rent',{env:k=>env[k],authenticate:async()=>u,resource:async()=>true,settle:(_actor,kind,id,method,k)=>settle('tenant',kind,id,method,k)});
  const res=await h(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoice_id:inv,method:'qris',idempotency_key:randomUUID()})}));assert.equal(res.status,200);assert.equal((await res.json()).attempt.is_simulation,true);assert.equal(await value('select status from public.invoices where id=$1',[inv]),'paid');
 });
 await test('publication includes payment ledger/campaign/attempt with safe INSERT/UPDATE operations',async()=>{
  const tables=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows.map(r=>r.tablename);for(const t of ['transactions','boost_campaigns','payment_attempts','invoices','notifications'])assert.ok(tables.includes(t));
  const p=(await db.query("select pubinsert,pubupdate,pubdelete,pubtruncate from pg_publication where pubname='supabase_realtime'")).rows[0];assert.deepEqual(p,{pubinsert:true,pubupdate:true,pubdelete:false,pubtruncate:false});
 });
 await test('all payment definers pin search_path and have no PUBLIC execution grants',async()=>{
  assert.equal(Number(await value("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=\"\"'],false)")),0);
  assert.equal(Number(await value("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname in ('public','private') and a.grantee=0 and a.privilege_type='EXECUTE'")),0);
 });
 results.phase5_catalogue=await value(`select jsonb_build_object('tables',(select count(*) from pg_tables where schemaname='public'),'rls_disabled',(select count(*) from pg_tables where schemaname='public' and not rowsecurity),'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and contype='f'),'policies',(select count(*) from pg_policies where schemaname='public'),'public_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),'published_tables',(select count(*) from pg_publication_tables where pubname='supabase_realtime'),'invalid_indexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (not i.indisvalid or not i.indisready)))`);
}
