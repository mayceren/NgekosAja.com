import assert from 'node:assert/strict';
import { fixtureId } from '../../scripts/development-fixtures.mjs';
import { safeError } from '../../scripts/local-database.mjs';

// Runs after the original 43 groups, only inside the runner's throwaway database.
// Every case rolls back, including expected failures, so cases are independent.
export async function runFinalContracts(db,config,results) {
 const agreement=fixtureId('lease-t2');
 const owner=(await db.query('select owner_id from public.properties where id=$1',[fixtureId('p1')])).rows[0].owner_id;
 const tenant=(await db.query('select tenant_id from public.rental_agreements where id=$1',[agreement])).rows[0].tenant_id;
 async function as(role,uid='') {
  assert.ok(['authenticated','anon','service_role'].includes(role));
  await db.query(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[uid,role]);
 }
 async function test(name,action) {
  await db.query('begin');
  try {await action();results.passed.push(name);console.log(`PASS ${name}`);}
  catch(error){results.failed.push({test:name,error:safeError(error)});console.error(`FAIL ${name}: ${safeError(error)}`);}
  finally{await db.query('rollback');}
 }
 await test('Checkout RPC rejects a NULL date without closing an active agreement',async()=>{
  await as('authenticated',owner);
  await assert.rejects(()=>db.query('select public.owner_close_agreement($1,null)',[agreement]),e=>e.code==='22004');
 });
 await test('Checkout constraint rejects NULL closure even for trusted direct SQL',async()=>{
  await assert.rejects(()=>db.query("update public.rental_agreements set status='checked_out',closed_on=null where id=$1",[agreement]),e=>e.code==='23514');
 });
 await test('Checkout RPC rejects a NULL reason explicitly',async()=>{
  await as('authenticated',owner);
  await assert.rejects(()=>db.query('select public.owner_close_agreement($1,private.today(),null)',[agreement]),e=>e.code==='22004');
 });
 await test('Service role can evaluate overdue invoice status through the invoker view',async()=>{
  await as('service_role');
  const rows=(await db.query("select effective_status from public.invoice_statuses where status='pending' limit 1")).rows;
  assert.equal(rows.length,1);assert.ok(['pending','overdue'].includes(rows[0].effective_status));
 });
 await test('Anonymous remains unable to execute the private business-date helper',async()=>{
  assert.equal((await db.query("select has_function_privilege('anon','private.today()','EXECUTE') allowed")).rows[0].allowed,false);
 });
 await test('NULL checkout fails atomically: agreement and recurring schedule remain active',async()=>{
  await as('authenticated',owner);
  await db.query('savepoint checkout');
  try{await db.query('select public.owner_close_agreement($1,null)',[agreement]);}catch{await db.query('rollback to checkout');}
  const state=(await db.query('select a.status,ri.active from public.rental_agreements a join public.recurring_invoices ri on ri.agreement_id=a.id where a.id=$1',[agreement])).rows[0];
  assert.deepEqual(state,{status:'active',active:true});
 });
 await test('Tenant cannot close even their own rental agreement',async()=>{
  await as('authenticated',tenant);
  await assert.rejects(()=>db.query('select public.owner_close_agreement($1,private.today())',[agreement]),e=>e.code==='42501');
 });
 await test('Checkout rejects future dates and dates before the lease starts',async()=>{
  await as('authenticated',owner);
  for(const sql of ['private.today()+1',"(select start_date-1 from public.rental_agreements where id=$1)"]) {
   await db.query('savepoint invalid_date');
   await assert.rejects(()=>db.query(`select public.owner_close_agreement($1,${sql})`,[agreement]),e=>e.code==='22023');
   await db.query('rollback to invalid_date');
  }
 });
 await test('Valid checkout sets the exclusive date and stops recurring billing',async()=>{
  await as('authenticated',owner);
  await db.query('select public.owner_close_agreement($1,private.today())',[agreement]);
  const state=(await db.query('select a.status,a.closed_on=private.today() correct_date,ri.active from public.rental_agreements a join public.recurring_invoices ri on ri.agreement_id=a.id where a.id=$1',[agreement])).rows[0];
  assert.deepEqual(state,{status:'checked_out',correct_date:true,active:false});
 });
}
