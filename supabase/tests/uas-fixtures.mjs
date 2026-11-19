import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {accounts,fixtureTag,resourceIds,relationSQL,verificationSQL} from '../../scripts/lib/uas-fixtures.mjs';

// Only invoked against the runner's newly created local throwaway database.
export async function runUasContracts(db,results) {
 const identities=Object.fromEntries(accounts.map(account=>[account.key,randomUUID()])),run=randomBytes(16).toString('hex');
 await db.query("alter table auth.users add column if not exists raw_app_meta_data jsonb not null default '{}'");
 const unrelated=(await db.query('select count(*)::int count from auth.users')).rows[0].count;
 for(const account of accounts)await db.query('insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3,$4)',[identities[account.key],account.email,JSON.stringify({display_name:account.name}),JSON.stringify({uas_fixture:fixtureTag,uas_fixture_run:run})]);
 await db.query(relationSQL(identities,run));
 const state=(await db.query(verificationSQL(identities))).rows[0].uas_verification;
 assert.equal(state.profiles,6);assert.equal(state.agreements,2);assert.equal(state.draft_properties,2);assert.equal(state.roles.length,11);
 assert.equal((await db.query('select count(*)::int count from auth.users')).rows[0].count,unrelated+6);
 results.passed.push('UAS provisioning SQL creates six trigger profiles, eleven base/assigned roles and two coherent draft-property leases');
 async function scoped(key,action) {
  await db.query('begin');
  try {await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[identities[key]]);await action();}
  finally{await db.query('rollback');}
 }
 for(const key of ['owner-a','owner-b','tenant-a','tenant-b']) {
  await scoped(key,async()=>{
   const suffix=key.endsWith('a')?'a':'b',other=suffix==='a'?'b':'a',owner=key.startsWith('owner');
   const table=owner?'properties':'rental_agreements',resource=owner?'property-':'agreement-';
   assert.equal((await db.query(`select id from public.${table} where id=$1`,[resourceIds[resource+suffix]])).rowCount,1);
   assert.equal((await db.query(`select id from public.${table} where id=$1`,[resourceIds[resource+other]])).rowCount,0);
   if(owner)assert.equal((await db.query("update public.properties set name='Unauthorized' where id=$1",[resourceIds[resource+other]])).rowCount,0);
  });
  results.passed.push(`UAS ${key} reads own fixture and cannot read the other user's fixture`);
 }
 await scoped('prospect',async()=>{
  assert.equal((await db.query('select id from public.properties where id=any($1::uuid[])',[[resourceIds['property-a'],resourceIds['property-b']]])).rowCount,0);
  await assert.rejects(()=>db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[identities.prospect]),e=>e.code==='42501');
 });
 results.passed.push('UAS prospect cannot see draft owner fixtures or grant itself administrator access');
 await scoped('admin',async()=>assert.equal((await db.query('select id from public.properties where id=any($1::uuid[])',[[resourceIds['property-a'],resourceIds['property-b']]])).rowCount,2));
 results.passed.push('UAS platform administrator reads both test properties through existing policies');
 await assert.rejects(()=>db.query(relationSQL(identities,run)),/Existing roles/);await db.query('rollback');
 assert.equal((await db.query(verificationSQL(identities))).rows[0].uas_verification.agreements,2);
 results.passed.push('Replaying UAS provisioning refuses existing assigned identities without altering their leases');
}
