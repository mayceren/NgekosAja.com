import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {connect} from '../../scripts/local-database.mjs';
import {createPaymentHandler} from '../functions/_shared/payment-handler.mjs';
import {digest} from '../functions/_shared/midtrans.mjs';
export async function runPaymentContracts(db,results,config){
 const ids=Object.fromEntries(['owner','otherOwner','tenant','otherTenant','admin'].map(k=>[k,randomUUID()]));
 const run=async(key,sql,args=[],client=db,role='authenticated')=>{await client.query('begin');try{await client.query(`set local role ${role}`);await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[ids[key]||'',role]);const rows=(await client.query(sql,args)).rows;await client.query('commit');return rows;}catch(e){await client.query('rollback');throw e;}};
 const rpc=async(key,sql,args=[],role='authenticated')=>Object.values((await run(key,sql,args,db,role))[0]||{})[0];
 const server=(sql,args=[])=>rpc(null,sql,args,'service_role');
 const first=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0]||{})[0];
 const test=async(name,fn)=>{await fn();results.passed.push('Payment: '+name);console.log('PASS Payment: '+name);};
 const reject=fn=>assert.rejects(fn);
 for(const [key,id]of Object.entries(ids))await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@payment.test`,{display_name:key}]);
 for(const [key,role]of [['owner','owner'],['otherOwner','owner'],['admin','admin']])await db.query('insert into public.user_roles(user_id,role) values($1,$2)',[ids[key],role]);
 const property=await rpc('owner','select public.owner_save_property($1)',[{name:'Kos Pembayaran Lokal',location:'Grogol',address:'Jalan Pengujian 101',description:'Fixture pembayaran hanya di database sementara.',base_rent:'1500000',gender_policy:'mixed',room_size:'3 x 4 m',publication_status:'published',images:[],facilities:[],rules:[],landmarks:[]}]);
 const room=await rpc('owner','select public.owner_save_room($1)',[{property_id:property,number:'PAY01',room_type:'Standard',rent:'1500000',operational_status:'available',facilities:[]}]);
 const conversation=await rpc('tenant','select public.open_conversation($1)',[property]);
 const dates=(await db.query("select private.today()::text start,(private.today()+180)::text finish,date_trunc('month',private.today())::date::text billing_month")).rows[0];
 const offer=await rpc('owner','select public.owner_propose_rental($1)',[{conversation_id:conversation,room_id:room,start_date:dates.start,end_date:dates.finish,rent:'1500000',payment_day:5}]);
 await rpc('tenant','select public.tenant_respond_rental($1,true)',[offer]);
 const agreement=await rpc('owner','select public.owner_check_in($1,$2,$3,$4,1500000,5::smallint)',[ids.tenant,room,dates.start,dates.finish]);
 const invoice=await rpc('owner','select public.owner_create_invoice($1,$2,$3,1500000,$4)',[agreement,dates.billing_month,dates.start,'Fixture Sandbox']);
 const reserve=async(key,kind,id)=>(await run(null,'select * from public.server_reserve_payment($1,$2,$3)',[ids[key],kind,id],db,'service_role'))[0];
 const event=(a,state,extra='')=>createHash('sha256').update(a.id+state+extra).digest('hex');
 const apply=(a,state,{id='gateway-'+a.id,gross=a.gross_amount,fraud=null,method='bank_transfer',hash=event(a,state)}={})=>server('select public.server_apply_payment($1,$2,$3,$4,$5,$6,$7)',[a.order_id,id,gross,state,fraud,method,hash]);
 let attempt;
 await test('server-only initiation and processing deny tenant/owner/admin/anonymous RPCs',async()=>{
  for(const key of ['tenant','owner','admin'])await reject(()=>rpc(key,'select public.server_reserve_payment($1,$2,$3)',[ids.tenant,'rent',invoice]));
  await reject(()=>run(null,'select public.server_apply_payment($1,$2,1502000,$3,null,$4,$5)',['NK-SB-'+randomUUID().replaceAll('-',''),'fake','settlement','bank_transfer','a'.repeat(64)],db,'anon'));
 });
 await test('resource ownership enforced and server derives 1,500,000+2,000 rupiah',async()=>{
  await reject(()=>reserve('otherTenant','rent',invoice));await reject(()=>reserve('owner','rent',invoice));await reject(()=>reserve('otherOwner','boost',property));
  attempt=await reserve('tenant','rent',invoice);assert.equal(attempt.amount,'1500000');assert.equal(attempt.admin_fee,'2000');assert.equal(attempt.gross_amount,'1502000');assert.equal(attempt.environment,'sandbox');assert.match(attempt.order_id,/^NK-SB-[0-9a-f]{32}$/);
 });
 await test('two-tab concurrent initialization returns exactly the same order',async()=>{
  const clients=await Promise.all([connect(config),connect(config)]);try{const rows=await Promise.all(clients.map(c=>run(null,'select * from public.server_reserve_payment($1,$2,$3)',[ids.tenant,'rent',invoice],c,'service_role')));assert.equal(rows[0][0].id,rows[1][0].id);assert.equal(rows[0][0].id,attempt.id);}finally{await Promise.all(clients.map(c=>c.end()));}
 });
 await test('attempt RLS scopes payer, related owner and admin; Snap tokens remain inaccessible',async()=>{
  for(const key of ['tenant','owner','admin'])assert.equal((await run(key,'select id from public.payment_attempts where id=$1',[attempt.id])).length,1);
  for(const key of ['otherTenant','otherOwner'])assert.equal((await run(key,'select id from public.payment_attempts where id=$1',[attempt.id])).length,0);
  await reject(()=>run('tenant','select * from public.payment_sessions'));await reject(()=>run('admin','select * from public.payment_events'));
  await reject(()=>run('tenant',"update public.payment_attempts set status='succeeded' where id=$1",[attempt.id]));
 });
 await test('claim lease prevents duplicate Snap creation; secret token available only to payer server operation',async()=>{
  const s=await server('select public.server_payment_session($1,$2,true)',[attempt.id,ids.tenant]);assert.ok(s.claim);
  const duplicate=await server('select public.server_payment_session($1,$2,true)',[attempt.id,ids.tenant]);assert.equal(duplicate.claim,null);
  await reject(()=>server('select public.server_save_snap($1,$2,$3)',[attempt.id,randomUUID(),'local-fixture-token-123']));
  await server('select public.server_save_snap($1,$2,$3)',[attempt.id,s.claim,'local-fixture-token-123']);
  await reject(()=>server('select public.server_payment_session($1,$2,false)',[attempt.id,ids.otherTenant]));
  assert.equal((await server('select public.server_payment_session($1,$2,false)',[attempt.id,ids.tenant])).token,'local-fixture-token-123');
 });
 await test('active gateway attempt freezes invoice amount/cancellation; pending adds no financial transaction',async()=>{
  await reject(()=>rpc('owner','select public.owner_update_invoice($1,1600000,$2,$3,false)',[invoice,dates.start,'tamper']));
  await apply(attempt,'pending');assert.equal(await first('select status from public.invoices where id=$1',[invoice]),'pending');assert.equal(Number(await first('select count(*) from public.transactions where invoice_id=$1',[invoice])),0);
 });
 await test('amount mismatch and gateway ID swap cannot settle an invoice',async()=>{
  await reject(()=>apply(attempt,'settlement',{gross:'1500000'}));await reject(()=>apply(attempt,'settlement',{id:'different-gateway'}));assert.equal(await first('select status from public.invoices where id=$1',[invoice]),'pending');
 });
 await test('duplicate/concurrent verified settlement records exactly one success and marks invoice paid',async()=>{
  const clients=await Promise.all([connect(config),connect(config)]);try{await Promise.all(clients.map(c=>run(null,'select public.server_apply_payment($1,$2,1502000,$3,null,$4,$5)',[attempt.order_id,'gateway-'+attempt.id,'settlement','bank_transfer',event(attempt,'settlement')],c,'service_role')));}finally{await Promise.all(clients.map(c=>c.end()));}
  assert.equal(await first('select status from public.invoices where id=$1',[invoice]),'paid');assert.equal(Number(await first("select count(*) from public.transactions where invoice_id=$1 and status='succeeded'",[invoice])),1);
  assert.equal(await first('select is_simulation from public.transactions where invoice_id=$1',[invoice]),true);
 });
 await test('paid invoice blocks new attempt; out-of-order pending/expire cannot downgrade success',async()=>{
  await reject(()=>reserve('tenant','rent',invoice));await apply(attempt,'pending',{hash:event(attempt,'pending','new')});await apply(attempt,'expire');assert.equal(await first('select status from public.payment_attempts where id=$1',[attempt.id]),'succeeded');
 });
 let boost;
 await test('Boost is server-priced at Rp30,000, pending/capture does not activate a campaign',async()=>{
  boost=await reserve('owner','boost',property);assert.equal(boost.gross_amount,'30000');assert.equal(boost.admin_fee,'0');await apply(boost,'pending');await apply(boost,'capture',{fraud:'accept'});
  assert.equal(Number(await first('select count(*) from public.boost_campaigns where property_id=$1',[property])),0);
  await reject(()=>run('owner',"update public.properties set publication_status='archived' where id=$1",[property]));
 });
 await test('Boost settlement creates one exact 30-day campaign; duplicate purchase is blocked',async()=>{
  await apply(boost,'settlement');await apply(boost,'settlement');const rows=await db.query('select end_date-start_date days from public.boost_campaigns where property_id=$1',[property]);assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].days,30);await reject(()=>reserve('owner','boost',property));
 });
 let retryInvoice,expired,newAttempt;
 await test('final failure/expiry retained; retry creates a new unique order without income',async()=>{
  const next=await first("select ($1::date+interval '1 month')::date::text",[dates.billing_month]);
  retryInvoice=await rpc('owner','select public.owner_create_invoice($1,$2,$3,1500000,$4)',[agreement,next,dates.start,'Retry fixture']);expired=await reserve('tenant','rent',retryInvoice);await apply(expired,'expire');newAttempt=await reserve('tenant','rent',retryInvoice);assert.notEqual(newAttempt.order_id,expired.order_id);
  assert.equal(Number(await first("select count(*) from public.transactions where invoice_id=$1 and status='succeeded'",[retryInvoice])),0);
 });
 await test('late settlements from two attempts create one success and retain conflict for review',async()=>{
  await apply(expired,'settlement');await apply(newAttempt,'settlement');assert.equal(await first('select status from public.payment_attempts where id=$1',[newAttempt.id]),'review');assert.equal(Number(await first("select count(*) from public.transactions where invoice_id=$1 and status='succeeded'",[retryInvoice])),1);assert.equal(await first('select outcome from public.payment_events where attempt_id=$1 order by created_at desc limit 1',[newAttempt.id]),'conflict');
 });
 await test('refund events never create new successes or rewrite immutable invoice/ledger',async()=>{
  await apply(attempt,'partial_refund');await apply(attempt,'refund');await apply(attempt,'partial_refund',{hash:event(attempt,'partial_refund','late')});
  assert.equal(await first('select status from public.payment_attempts where id=$1',[attempt.id]),'refunded');assert.equal(await first('select status from public.invoices where id=$1',[invoice]),'paid');assert.equal(Number(await first("select count(*) from public.transactions where invoice_id=$1 and status='succeeded'",[invoice])),1);
 });
 await test('accounting separates Sandbox GMV, fees, Boost and historical nonsimulation; rejects foreign owner scope',async()=>{
  const report=await rpc('owner','select public.payment_accounting($1)',[property]);assert.equal(report.sandbox.rent_gmv,'3000000');assert.equal(report.sandbox.admin_fees,'4000');assert.equal(report.sandbox.boost_revenue,'30000');assert.equal(report.sandbox.platform_revenue,'34000');assert.deepEqual(report.non_simulation,{});assert.equal(report.refund_cases,'1');await reject(()=>rpc('otherOwner','select public.payment_accounting($1)',[property]));await reject(()=>rpc('tenant','select public.payment_accounting()'));
 });
 await test('financial receipt RLS and all payment tables remain protected; events immutable',async()=>{
  const id=await first('select transaction_id from public.payment_attempts where id=$1',[attempt.id]);assert.equal((await run('tenant','select * from public.transactions where id=$1',[id])).length,1);assert.equal((await run('otherTenant','select * from public.transactions where id=$1',[id])).length,0);
  await reject(()=>db.query("update public.payment_events set outcome='ignored' where attempt_id=$1",[attempt.id]));assert.equal(Number(await first("select count(*) from pg_tables where schemaname='public' and not rowsecurity")),0);
  assert.equal(Number(await first("select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename in ('payment_attempts','transactions','boost_campaigns')")),3);
 });
 await test('actual Edge handler + real temporary SQL + mocked HTTP round-trip persists verified rent and rejects callback-only success',async()=>{
  const period=await first("select ($1::date+interval '2 months')::date::text",[dates.billing_month]);
  const inv=await rpc('owner','select public.owner_create_invoice($1,$2,$3,1500000,$4)',[agreement,period,dates.start,'Edge integration fixture']);
  const sandboxKey='SB-Mid-server-'+randomUUID(),clientKey='SB-Mid-client-'+randomUUID();let state='pending',a;
  const deps={env:k=>({MIDTRANS_IS_PRODUCTION:'false',MIDTRANS_SERVER_KEY:sandboxKey,MIDTRANS_CLIENT_KEY:clientKey}[k]),authenticate:async()=>({id:ids.tenant}),
   fetcher:async(url)=>url.includes('/snap/')?Response.json({token:'integration-fixture-token-'+randomUUID()}):Response.json({order_id:a.order_id,transaction_id:'integration-'+a.id,gross_amount:'1502000.00',currency:'IDR',payment_type:'bank_transfer',transaction_status:state}),
   db:{resource:async()=>!!(await run('tenant','select id from public.invoices where id=$1',[inv])).length,
    reserve:async()=>a=await reserve('tenant','rent',inv),
    session:(id,actor,claim)=>server('select public.server_payment_session($1,$2,$3)',[id,actor,claim]),
    saveSnap:(id,claim,token)=>server('select public.server_save_snap($1,$2,$3)',[id,claim,token]),
    order:async()=>a,
    visible:async()=> (await run('tenant','select * from public.payment_attempts where id=$1',[a.id]))[0],
    claimReconcile:()=>true,
    apply:(s,hash)=>server('select public.server_apply_payment($1,$2,$3,$4,$5,$6,$7)',[s.order_id,s.transaction_id,s.gross_amount,s.status,s.fraud,s.method,hash])}
  };
  const req=body=>new Request('http://127.0.0.1/local-edge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const initiation=await createPaymentHandler('rent',deps)(req({invoice_id:inv}));assert.equal(initiation.status,200);assert.ok((await initiation.json()).snap_token);
  const incoming={order_id:a.order_id,status_code:'200',gross_amount:'1502000.00',transaction_status:'settlement'};incoming.signature_key=await digest(incoming.order_id+incoming.status_code+incoming.gross_amount+sandboxKey,'SHA-512');
  const hook=createPaymentHandler('webhook',deps);assert.equal((await hook(req(incoming))).status,200);assert.equal(await first('select status from public.invoices where id=$1',[inv]),'pending');
  state='settlement';assert.equal((await hook(req(incoming))).status,200);assert.equal((await hook(req(incoming))).status,200);assert.equal(await first('select status from public.invoices where id=$1',[inv]),'paid');assert.equal(Number(await first("select count(*) from public.transactions where invoice_id=$1 and status='succeeded'",[inv])),1);
 });
 await test('deny/cancel/failure each preserve failed history with zero successful revenue',async()=>{
  for(const [offset,state]of [[3,'deny'],[4,'cancel'],[5,'failure']]){
   const period=await first("select ($1::date+make_interval(months=>$2))::date::text",[dates.billing_month,offset]);const inv=await rpc('owner','select public.owner_create_invoice($1,$2,$3,1500000,$4)',[agreement,period,dates.start,'Terminal fixture']);const a=await reserve('tenant','rent',inv);await apply(a,state);await apply(a,state);assert.equal(Number(await first("select count(*) from public.transactions where invoice_id=$1 and status='failed'",[inv])),1);assert.equal(await first('select status from public.invoices where id=$1',[inv]),'pending');
  }
 });
 await test('card capture challenge waits; accepted capture succeeds; missing settlement fraud never settles a card',async()=>{
  const period=await first("select ($1::date+interval '6 months')::date::text",[dates.billing_month]);const inv=await rpc('owner','select public.owner_create_invoice($1,$2,$3,1500000,$4)',[agreement,period,dates.start,'Card fixture']);const a=await reserve('tenant','rent',inv);
  await apply(a,'capture',{fraud:'challenge',method:'credit_card',hash:event(a,'capture','challenge')});assert.equal(await first('select status from public.invoices where id=$1',[inv]),'pending');
  await apply(a,'settlement',{method:'credit_card',hash:event(a,'settlement','missing-fraud')});assert.equal(await first('select status from public.payment_attempts where id=$1',[a.id]),'review');assert.equal(await first('select status from public.invoices where id=$1',[inv]),'pending');
  await apply(a,'capture',{fraud:'accept',method:'credit_card',hash:event(a,'capture','accept')});assert.equal(await first('select status from public.invoices where id=$1',[inv]),'paid');
 });
 results.phase5_catalogue=await first(`select jsonb_build_object(
 'tables',(select count(*) from pg_tables where schemaname='public'),
 'rls_disabled',(select count(*) from pg_tables where schemaname='public' and not rowsecurity),
 'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and contype='f'),
 'policies',(select count(*) from pg_policies where schemaname='public'),
 'public_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'unsafe_definers',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false)),
 'public_execute_grants',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname in ('public','private') and a.grantee=0 and a.privilege_type='EXECUTE'),
 'published_tables',(select count(*) from pg_publication_tables where pubname='supabase_realtime'),
 'invalid_indexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (not i.indisvalid or not i.indisready)))`);
}
