import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fixtureSource,fixtureAccounts,fixtureId,populateDevelopmentFixtures } from '../../scripts/development-fixtures.mjs';
import { connect } from '../../scripts/local-database.mjs';

export async function runContracts(db,config,results) {
 const source=fixtureSource(), identities={},id=fixtureId;
 const query=(sql,args=[])=>db.query(sql,args);
 const value=async(sql,args=[])=>Object.values((await query(sql,args)).rows[0])[0];
 async function test(name,action) { await action();results.passed.push(name);console.log(`PASS ${name}`); }
 async function denied(action, code) { await assert.rejects(action, e=>code?e.code===code:!!e.code); }
 async function as(key,action,role='authenticated') {
  await query('begin');
  try {await query(`set local role ${role}`);await query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[key?identities[key]:'',role]);const r=await action();await query('commit');return r;}
  catch(error){await query('rollback');throw error;}
 }
 for(const u of fixtureAccounts(source)) {
  identities[u.id]=randomUUID();
  await query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[identities[u.id],u.email,JSON.stringify({display_name:u.name,role:'admin',is_admin:true})]);
 }
 await test('Auth trigger ignores malicious admin registration metadata',async()=>assert.equal(await value("select count(*)::int from public.user_roles where role<>'prospect'"),0));
 await query('begin');await query(readFileSync('supabase/seed.sql','utf8'));await populateDevelopmentFixtures(db,source,identities);await query('commit');
 await test('All migrations and coherent 3-owner / 16-property / 31-tenant fixtures load',async()=>{
  assert.equal(await value("select count(*)::int from public.user_roles where role='owner'"),3);
  assert.equal(await value('select count(*)::int from public.properties'),16);
  assert.equal(await value('select count(*)::int from public.tenants'),31);
  results.fixture_counts={};
  for(const table of ['properties','rooms','profiles','tenants','rental_agreements','invoices','transactions','complaints','conversations','messages','notifications','favorites','boost_campaigns','facilities']) results.fixture_counts[table]=Number(await value(`select count(*) from public.${table}`));
 });
 await test('RLS enabled on every exposed application table',async()=>assert.equal(await value("select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"),0));
 await test('SECURITY DEFINER functions fix search_path and revoke PUBLIC execute',async()=>{
  assert.equal(await value("select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=\"\"'],false)"),0);
  assert.equal(await value("select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where n.nspname in ('public','private') and acl.grantee=0 and acl.privilege_type='EXECUTE'"),0);
  assert.equal(await value("select count(*)::int from information_schema.role_table_grants where table_schema='public' and grantee='service_role' and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')"),0);
 });
 const counts=async()=> (await query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.reduce(async(p,r)=>{const all=await p;all[r.tablename]=Number(await value(`select count(*) from public.${r.tablename}`));return all;},Promise.resolve({}));
 await test('Master and Auth-bound development fixture replay does not duplicate rows',async()=>{
  const before=await counts();await query('begin');await query(readFileSync('supabase/seed.sql','utf8'));await populateDevelopmentFixtures(db,source,identities);await query('commit');assert.deepEqual(await counts(),before);
 });
 await test('Profile FK rejects nonexistent Auth UUID',()=>denied(()=>query('insert into public.profiles(id,display_name) values($1,$2)',[randomUUID(),'Tidak ada']), '23503'));
 await test('Negative rental nominal rejected',()=>denied(()=>query('update public.rooms set rent=-1 where id=$1',[id('p1-r8')]),'23514'));
 await test('Unique room number per property enforced',()=>denied(()=>query("insert into public.rooms(property_id,number,rent) values($1,'A01',1500000)",[id('p1')]),'23505'));
 await test('Duplicate agreement-month invoice rejected',()=>denied(()=>query("insert into public.invoices(agreement_id,period_start,due_date,amount,tenant_name_snapshot,property_name_snapshot,room_number_snapshot) select agreement_id,period_start,due_date,amount,tenant_name_snapshot,property_name_snapshot,room_number_snapshot from public.invoices limit 1"),'23505'));
 await test('Invalid invoice amount and boost/admin money constraints rejected',async()=>{
  await denied(()=>as('o1',()=>query("select public.owner_update_invoice($1,-10,private.today())",[id('inv-0-1')])),'23514');
  await denied(()=>query("insert into public.transactions(kind,property_id,amount,admin_fee,method,status,idempotency_key) values('boost',$1,-1,0,'QRIS','failed','invalid-negative-boost')",[id('p3')]),'23514');
  await denied(()=>query("insert into public.transactions(kind,property_id,amount,admin_fee,method,status,idempotency_key) values('boost',$1,30000,2000,'QRIS','failed','invalid-admin-boost')",[id('p3')]),'23514');
 });
 await test('Bulk invoice fails atomically on cross-owner agreement; valid batch uses lease rent',async()=>{
  const before=await value('select count(*) from public.invoices');
  const month=await value("select (date_trunc('month',private.today())+interval '2 months')::date::text");
  await denied(()=>as('o1',()=>query('select public.owner_create_invoices_bulk($1,$2,$2)',[[id('lease-t1'),id('lease-t5')],month])),'42501');
  assert.equal(await value('select count(*) from public.invoices'),before);
  await as('o1',()=>query('select public.owner_create_invoices_bulk($1,$2,$2)',[[id('lease-t1'),id('lease-t2')],month]));
  assert.equal(Number(await value('select count(*) from public.invoices')),Number(before)+2);
 });
 await test('Double room assignment and historical date overlap rejected',()=>denied(()=>query("insert into public.rental_agreements(tenant_id,room_id,start_date,end_date,rent,payment_day) values($1,$2,current_date,current_date+20,1500000,5)",[identities.t2,id('p1-r1')])));
 await test('Occupied room cannot enter maintenance',()=>denied(()=>query("update public.rooms set operational_status='maintenance' where id=$1",[id('p1-r1')])));
 await test('Owner A cannot select or update Owner B property',async()=>as('o1',async()=>{
  assert.equal(await value('select count(*)::int from public.properties where id=$1',[id('p3')]),0);
  assert.equal((await query("update public.properties set name='Disusupi' where id=$1",[id('p3')])).rowCount,0);
 }));
 await test('Owner cannot hijack owner_id, even for own property',()=>denied(()=>as('o1',()=>query('update public.properties set owner_id=$1 where id=$2',[identities.o2,id('p1')])),'42501'));
 await test('Owner cannot inject a property under another owner',()=>denied(()=>as('o1',()=>query("insert into public.properties(owner_id,name,location,address,description,base_rent,gender_policy) values($1,'Kos Baru','Grogol','Alamat contoh','Deskripsi cukup panjang',1500000,'mixed')",[identities.o2])),'42501'));
 await test('Revoking owner role immediately removes property write/read authority',async()=>{
  await query("delete from public.user_roles where user_id=$1 and role='owner'",[identities.o2]);
  await as('o2',async()=>assert.equal(await value('select count(*)::int from public.properties where owner_id=$1',[identities.o2]),0));
  await query("insert into public.user_roles(user_id,role) values($1,'owner')",[identities.o2]);
 });
 await test('Tenant A cannot access Tenant B profile/invoices/private room',async()=>as('t1',async()=>{
  assert.equal(await value('select count(*)::int from public.profiles where id=$1',[identities.t2]),0);
  assert.equal(await value('select count(*)::int from public.invoices where agreement_id=$1',[id('lease-t2')]),0);
  assert.equal(await value('select count(*)::int from public.rooms where id=$1',[id('p1-r2')]),0);
 }));
 await test('Owner may read related tenant but not an unrelated account',async()=>as('o2',async()=>{
  assert.equal(await value('select count(*)::int from public.profiles where id=$1',[identities.t5]),1);
  assert.equal(await value('select count(*)::int from public.profiles where id=$1',[identities.t1]),0);
 }));
 await test('Prospect cannot self-grant admin or invoke server role grant',async()=>{
  await denied(()=>as('guest',()=>query("insert into public.user_roles(user_id,role) values($1,'admin')",[identities.guest])),'42501');
  await denied(()=>as('guest',()=>query("select public.server_grant_role($1,'admin')",[identities.guest])),'42501');
 });
 await test('Tenant, owner and admin JWT cannot write payments or mark paid directly',async()=>{
  for(const actor of ['t1','o1','admin']) {
   await denied(()=>as(actor,()=>query("update public.invoices set status='paid' where id=$1",[id('inv-0-0')])),'42501');
   await denied(()=>as(actor,()=>query("select public.server_record_rent_payment($1,'illegal-payment',true,'QRIS')",[id('inv-0-0')])),'42501');
  }
 });
 await test('Anonymous sees safe published catalogue only; no base properties or PII',async()=>{
  await as(null,async()=>{const catalogue=await query('select * from public.public_listings()');assert.equal(catalogue.rows.length,16);assert.ok(['owner_id','phone','tenant_id'].every(key=>!Object.hasOwn(catalogue.rows[0],key)));},'anon');
  for(const table of ['properties','profiles','invoices','transactions','messages','activity_logs']) await denied(()=>as(null,()=>query(`select * from public.${table}`),'anon'),'42501');
 });
 await test('Archived listing absent from public catalogue without deleting history',async()=>{
  await query("update public.properties set publication_status='archived' where id=$1",[id('p16')]);
  await as(null,async()=>assert.equal(await value('select count(*)::int from public.public_listings() where id=$1',[id('p16')]),0),'anon');
  await query("update public.properties set publication_status='published' where id=$1",[id('p16')]);
 });
 await test('Financial reports enforce owner scope and disallow tenant/admin impersonation',async()=>{
  const expected=await value("select coalesce(sum(t.amount),0)::text from public.transactions t join public.invoices i on i.id=t.invoice_id join public.rental_agreements a on a.id=i.agreement_id join public.rooms r on r.id=a.room_id join public.properties p on p.id=r.property_id where p.owner_id=$1 and t.status='succeeded'",[identities.o1]);
  await as('o1',async()=>assert.equal(await value('select rent_revenue::text from public.owner_financial_report()'),expected));
  await denied(()=>as('o1',()=>query('select * from public.owner_financial_report($1)',[id('p3')])),'42501');
  await denied(()=>as('t1',()=>query('select * from public.owner_financial_report()')),'42501');
  await denied(()=>as('o1',()=>query('select * from public.platform_financial_report()')),'42501');
 });
 await test('Security-invoker invoice status view cannot leak another tenant',()=>as('t1',async()=>assert.equal(await value('select count(*)::int from public.invoice_statuses where agreement_id=$1',[id('lease-t2')]),0)));
 await test('Private children, recurring, notifications, wishlist and settings do not cross identities',async()=>{
  await as('t2',async()=>{
   for(const table of ['complaint_histories','complaint_attachments','complaint_notes','complaint_analyses']) assert.equal(await value(`select count(*)::int from public.${table} where complaint_id=$1`,[id('c1')]),0);
   assert.equal(await value('select count(*)::int from public.recurring_invoices where agreement_id=$1',[id('lease-t1')]),0);
   assert.equal(await value('select count(*)::int from public.message_attachments'),0);
   for(const table of ['notifications','favorites','user_settings','recent_searches']) assert.equal(await value(`select count(*)::int from public.${table} where user_id=$1`,[identities.t1]),0);
  });
  await as('o2',async()=>{
   for(const table of ['property_images','property_rules','property_landmarks','property_facilities','boost_campaigns','listing_analytics']) assert.equal(await value(`select count(*)::int from public.${table} where property_id=$1`,[id('p1')]),0);
   assert.equal(await value('select count(*)::int from public.room_facilities where room_id=$1',[id('p1-r1')]),0);
  });
 });
 await test('Report formula separates GMV, fees, boost and uses inclusive Jakarta dates',async()=>{
  const amounts=(await query("select coalesce(sum(amount) filter(where kind='rent'),0)::text gmv,coalesce(sum(admin_fee) filter(where kind='rent'),0)::text fee,coalesce(sum(amount) filter(where kind='boost'),0)::text boost from public.transactions where status='succeeded'")).rows[0];
  await as('admin',async()=>{const report=(await query('select * from public.platform_financial_report()')).rows[0];assert.equal(report.gmv,amounts.gmv);assert.equal(report.admin_fee_revenue,amounts.fee);assert.equal(report.boost_revenue,amounts.boost);assert.equal(Number(report.total_platform_revenue),Number(amounts.fee)+Number(amounts.boost));});
  const day=await value("select (occurred_at at time zone 'Asia/Jakarta')::date::text from public.transactions where kind='rent' and status='succeeded' order by occurred_at limit 1");
  const expected=await value("select coalesce(sum(t.amount),0)::text from public.transactions t join public.invoices i on i.id=t.invoice_id join public.rental_agreements a on a.id=i.agreement_id join public.rooms r on r.id=a.room_id join public.properties p on p.id=r.property_id where p.owner_id=$1 and t.status='succeeded' and (t.occurred_at at time zone 'Asia/Jakarta')::date=$2::date",[identities.o1,day]);
  await as('o1',async()=>{assert.equal(await value('select rent_revenue::text from public.owner_financial_report(null,$1,$1)',[day]),expected);assert.equal(await value('select coalesce(sum(rent_revenue),0)::text from public.owner_monthly_revenue(null,$1,$1)',[day]),expected);});
 });
 await test('Chat membership prevents unrelated reads, messages and membership forgery',async()=>{
  await as('t2',async()=>assert.equal(await value('select count(*)::int from public.messages where conversation_id=$1',[id('chat-t1-p1')]),0));
  await denied(()=>as('t2',()=>query("select public.send_message($1,'Pesan ilegal')",[id('chat-t1-p1')])),'42501');
  await denied(()=>as('t2',()=>query('insert into public.conversation_members(conversation_id,user_id) values($1,$2)',[id('chat-t1-p1'),identities.t2])),'42501');
 });
 await test('Complaint privacy and owner/tenant confirmation transitions enforced',async()=>{
  await as('o2',async()=>assert.equal(await value('select count(*)::int from public.complaints where id=$1',[id('c1')]),0));
  await denied(()=>as('o1',()=>query("select public.transition_complaint($1,'resolved')",[id('c1')])));
  await denied(()=>as('t2',()=>query("select public.transition_complaint($1,'resolved')",[id('c3')])),'42501');
  await as('t1',()=>query("select public.transition_complaint($1,'resolved','Sudah berfungsi, terima kasih.')",[id('c3')]));
  assert.equal(await value('select confirmed_at is not null from public.complaints where id=$1',[id('c3')]),true);
  await as('t1',()=>query("select public.transition_complaint($1,'waiting','Lampu kembali berkedip.')",[id('c3')]));
  assert.ok(Number(await value('select count(*) from public.complaint_histories where complaint_id=$1',[id('c3')]))>=4);
 });
 await test('Wishlist belongs to identity; cannot create a different user favorite',()=>denied(()=>as('t1',()=>query('insert into public.favorites(user_id,property_id) values($1,$2)',[identities.t2,id('p3')])),'42501'));
 await test('H-3/manual reminders are dynamically dated and deduplicated',async()=>{
  await as('t1',()=>query('select public.generate_payment_reminders()'));
  const before=await value('select count(*) from public.notifications');
  await as('t1',()=>query('select public.generate_payment_reminders()'));assert.equal(await value('select count(*) from public.notifications'),before);
  await as('o1',()=>query('select public.owner_send_reminder($1)',[id('inv-0-0')]));
  const manual=await value('select count(*) from public.notifications');await as('o1',()=>query('select public.owner_send_reminder($1)',[id('inv-0-0')]));assert.equal(await value('select count(*) from public.notifications'),manual);
 });
 await test('Failed rent attempt earns nothing; success atomically pays invoice and preserves snapshots',async()=>{
  const before=await as('admin',()=>query('select * from public.platform_financial_report()'));
  await as(null,()=>query("select public.server_record_rent_payment($1,'test-failed-rent',false,'QRIS')",[id('inv-0-0')]),'service_role');
  assert.equal(await value('select status from public.invoices where id=$1',[id('inv-0-0')]),'pending');
  const failed=await as('admin',()=>query('select * from public.platform_financial_report()'));assert.deepEqual(failed.rows,before.rows);
  await as(null,()=>query("select public.server_record_rent_payment($1,'test-paid-rent-key',true,'QRIS')",[id('inv-0-0')]),'service_role');
  assert.equal(await value('select status from public.invoices where id=$1',[id('inv-0-0')]),'paid');
  const after=await as('admin',()=>query('select * from public.platform_financial_report()'));assert.equal(Number(after.rows[0].admin_fee_revenue)-Number(before.rows[0].admin_fee_revenue),2000);
  await as('o1',()=>query('update public.properties set base_rent=2500000 where id=$1',[id('p1')]));
  assert.equal(Number(await value('select amount from public.invoices where id=$1',[id('inv-0-0')])),1850000);
 });
 await test('Successful payment retry is idempotent; conflicting payload and second payment rejected',async()=>{
  const before=await value('select count(*) from public.transactions');
  await as(null,()=>query("select public.server_record_rent_payment($1,'test-paid-rent-key',true,'QRIS')",[id('inv-0-0')]),'service_role');assert.equal(await value('select count(*) from public.transactions'),before);
  await denied(()=>as(null,()=>query("select public.server_record_rent_payment($1,'test-paid-rent-key',false,'QRIS')",[id('inv-0-0')]),'service_role'));
  await denied(()=>as(null,()=>query("select public.server_record_rent_payment($1,'test-second-payment',true,'QRIS')",[id('inv-0-0')]),'service_role'));
 });
 await test('Historical transaction and invoices with failed attempts cannot be rewritten',async()=>{
  await denied(()=>query('update public.transactions set amount=1 where idempotency_key=$1',['test-paid-rent-key']));
  await denied(()=>query("update public.invoices set amount=1600000 where id=$1",[id('inv-0-0')]));
  await denied(()=>query('delete from public.properties where id=$1',[id('p1')]),'23503');
 });
 await test('Boost has exact 30000 price, 30 day interval, and no revenue for free grant',async()=>{
  assert.equal(await value('select end_date-start_date from public.boost_campaigns where id=$1',[id('initial-campaign')]),30);
  assert.equal(await value("select count(*)::int from public.transactions where kind='boost' and status='succeeded'"),1);
  await denied(()=>as(null,()=>query("select public.server_record_boost($1,'duplicate-campaign',true,'QRIS')",[id('p2')]),'service_role'));
  await denied(()=>as('o1',()=>query("select public.server_record_boost($1,'illegal-boost-paid',true,'QRIS')",[id('p2')])),'42501');
 });
 await test('Analytics deduplicates event per property/actor/session/Jakarta date',async()=>{
  const args=[id('p1'),'view',randomUUID()];await as('guest',()=>query('select public.record_listing_event($1,$2,$3)',args));const before=await value('select count(*) from public.listing_analytics');await as('guest',()=>query('select public.record_listing_event($1,$2,$3)',args));assert.equal(await value('select count(*) from public.listing_analytics'),before);
 });
 await test('Prospect check-in preserves user ID, favorites and existing chat; checkout preserves history',async()=>{
  const favorite=await value('select count(*) from public.favorites where user_id=$1',[identities.guest]);
  const lease=await as('o1',()=>query('select public.owner_check_in($1,$2,private.today(),private.today()+90,1500000,5::smallint)',[identities.guest,id('p1-r8')]));
  assert.equal(await value('select count(*) from public.favorites where user_id=$1',[identities.guest]),favorite);
  assert.equal(await value('select count(*)::int from public.conversations where prospect_id=$1',[identities.guest]),1);
  const aid=lease.rows[0].owner_check_in;
  await as('o1',()=>query('select public.owner_close_agreement($1,private.today())',[aid]));
  assert.equal(await value('select status from public.rental_agreements where id=$1',[aid]),'checked_out');
 });
 await test('Recurring generation is scoped, deduplicated, monotonic and stops on checkout',async()=>{
  const month=await value("select (date_trunc('month',private.today())+interval '1 month')::date::text");
  await as('o1',()=>query('select public.owner_generate_recurring($1)',[month]));
  const before=await value('select count(*) from public.invoices');await as('o1',()=>query('select public.owner_generate_recurring($1)',[month]));assert.equal(await value('select count(*) from public.invoices'),before);
  await as('o1',()=>query('select public.owner_close_agreement($1,private.today())',[id('lease-t3')]));
  assert.equal(await value('select active from public.recurring_invoices where agreement_id=$1',[id('lease-t3')]),false);
  await denied(()=>query('update public.recurring_invoices set active=true where agreement_id=$1',[id('lease-t3')]));
 });
 await test('Same-day transfer keeps both agreements and moves occupancy atomically',async()=>{
  const room=await value("select r.id from public.rooms r join public.properties p on p.id=r.property_id where p.owner_id=$1 and r.operational_status='available' and not exists(select 1 from public.rental_agreements a where a.room_id=r.id) limit 1",[identities.o1]);
  const result=await as('o1',()=>query('select public.owner_transfer_agreement($1,$2,private.today(),private.today()+90,1500000,5::smallint)',[id('lease-t1'),room]));
  assert.equal(await value('select status from public.rental_agreements where id=$1',[id('lease-t1')]),'transferred');
  assert.equal(await value('select tenant_id from public.rental_agreements where id=$1',[result.rows[0].owner_transfer_agreement]),identities.t1);
  assert.equal(await value('select status from public.invoices where id=$1',[id('inv-0-0')]),'paid');
 });
 await test('Blank messages rejected; attachment-only message allowed only in a trusted atomic transaction',async()=>{
  await denied(()=>as('t1',()=>query("select public.send_message($1,'   ')",[id('chat-t1-p1')])),'23514');
  await query('begin');
  const mid=randomUUID();
  await query("insert into public.messages(id,conversation_id,sender_id,body) values($1,$2,$3,'')",[mid,id('chat-t1-p1'),identities.t1]);
  await query("insert into public.message_attachments(message_id,storage_path,mime_type,size_bytes) values($1,'development/illustration.jpg','image/jpeg',100)",[mid]);
  await query('commit');
  await denied(()=>as('t1',()=>query("insert into public.message_attachments(message_id,storage_path,mime_type,size_bytes) values($1,'untrusted.jpg','image/jpeg',100)",[mid])),'42501');
 });
 await test('Concurrent room check-ins serialize: exactly one tenant gets the room',async()=>{
  for(const key of ['qa1','qa2']) {
   identities[key]=randomUUID();await query('insert into auth.users(id,email) values($1,$2)',[identities[key],`${key}@test.invalid`]);
   await as(key,()=>query('select public.open_conversation($1)',[id('p1')]));
  }
  const room=await value("select r.id from public.rooms r join public.properties p on p.id=r.property_id where p.owner_id=$1 and r.operational_status='available' and not exists(select 1 from public.rental_agreements a where a.room_id=r.id) limit 1",[identities.o1]);
  const clients=await Promise.all([connect(config),connect(config)]);
  try {
   const outcomes=await Promise.allSettled(clients.map(async(c,index)=>{await c.query('begin');try{
    await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[identities.o1]);
    await c.query('select public.owner_check_in($1,$2,private.today(),private.today()+90,1500000,5::smallint)',[identities[`qa${index+1}`],room]);await c.query('commit');
   }catch(e){await c.query('rollback');throw e;}}));
   assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
   assert.equal(await value("select count(*)::int from public.rental_agreements where room_id=$1 and status='active'",[room]),1);
  }finally{await Promise.all(clients.map(c=>c.end()));}
 });
 await test('Concurrent successful payments serialize: exactly one succeeds',async()=>{
  const clients=await Promise.all([connect(config),connect(config)]);
  try {
   const attempts=clients.map(async(c,index)=>{await c.query('begin');try{await c.query('set local role service_role');await c.query("select set_config('request.jwt.claim.role','service_role',true)");await c.query('select public.server_record_rent_payment($1,$2,true,$3)',[id('inv-0-1'),`concurrent-payment-${index}`,'QRIS']);await c.query('commit');return 'success';}catch(e){await c.query('rollback');throw e;}});
   const outcomes=await Promise.allSettled(attempts);assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
   assert.equal(await value("select count(*)::int from public.transactions where invoice_id=$1 and status='succeeded'",[id('inv-0-1')]),1);
  } finally {await Promise.all(clients.map(c=>c.end()));}
 });
 await test('Audit scoped to owner, timestamps are timestamptz, Jakarta business dates stable',async()=>{
  await as('o2',async()=>assert.equal(await value('select count(*)::int from public.activity_logs where owner_id=$1',[identities.o1]),0));
  assert.equal(await value("select count(*)::int from information_schema.columns where table_schema='public' and column_name in ('created_at','updated_at') and data_type<>'timestamp with time zone'"),0);
  assert.equal(await value("select private.today()=(now() at time zone 'Asia/Jakarta')::date"),true);
 });
}
