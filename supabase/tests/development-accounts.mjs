import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {accounts,fixtureTag,resourceIds,relationSQL,verificationSQL,preflightSQL} from '../../scripts/lib/development-accounts.mjs';
import {expectedVisibility} from '../../scripts/lib/development-account-verification.mjs';

// Only invoked against the runner's newly created local throwaway database.
export async function runDevelopmentAccountContracts(db,results) {
 const identities=Object.fromEntries(accounts.map(account=>[account.key,randomUUID()])),run=randomBytes(16).toString('hex');
 await db.query("alter table auth.users add column if not exists raw_app_meta_data jsonb not null default '{}'");
 const unrelated=(await db.query('select count(*)::int count from auth.users')).rows[0].count;
 for(const account of accounts)await db.query('insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3,$4)',[identities[account.key],account.email,JSON.stringify({display_name:account.name}),JSON.stringify({development_fixture:fixtureTag,development_fixture_run:run})]);
 await db.query(relationSQL(identities,run));
 const state=(await db.query(verificationSQL(identities))).rows[0].development_verification;
 assert.equal(state.profiles,6);assert.equal(state.agreements,2);assert.equal(state.draft_properties,2);assert.equal(state.roles.length,11);
 assert.equal((await db.query('select count(*)::int count from auth.users')).rows[0].count,unrelated+6);
 results.passed.push('Development provisioning SQL creates six trigger profiles, eleven base/assigned roles and two coherent draft-property leases');
 async function scoped(key,action) {
  await db.query('begin');
  try {await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[identities[key]]);await action();}
  finally{await db.query('rollback');}
 }
 const inventory=(await db.query(preflightSQL())).rows[0].development_preflight;
 assert.equal(inventory.existing_target_accounts,6);assert.ok(inventory.accounts.every(account=>account.fixture_owned&&account.profile_exists));
 for(const account of accounts) {
  await scoped(account.key,async()=>{
   const expected=expectedVisibility(account),allIds=accounts.map(item=>identities[item.key]);
   const match=async(table,column,ids,visible)=>{
    const actual=(await db.query(`select distinct ${column} from public.${table} where ${column}=any($1::uuid[])`,[ids])).rows.map(row=>row[column]).sort();
    assert.deepEqual(actual,[...visible].sort());
   };
   await match('profiles','id',allIds,expected.profiles.map(key=>identities[key]));
   await match('user_roles','user_id',allIds,expected.role_users.map(key=>identities[key]));
   await match('user_settings','user_id',allIds,[identities[account.key]]);
   await match('tenants','id',['tenant-a','tenant-b'].map(key=>identities[key]),expected.tenants.map(key=>identities[key]));
   for(const [table,kind] of [['properties','property-'],['rooms','room-'],['rental_agreements','agreement-']])await match(table,'id',['a','b'].map(s=>resourceIds[kind+s]),expected.resources.map(s=>resourceIds[kind+s]));
  });
  results.passed.push(`Phase 2 Cloud verifier expectations match real SQL RLS for ${account.key}, including private administrator settings`);
 }
 for(const key of ['owner-a','owner-b','tenant-a','tenant-b']) {
  await scoped(key,async()=>{
   const suffix=key.endsWith('a')?'a':'b',other=suffix==='a'?'b':'a',owner=key.startsWith('owner');
   const table=owner?'properties':'rental_agreements',resource=owner?'property-':'agreement-';
   assert.equal((await db.query(`select id from public.${table} where id=$1`,[resourceIds[resource+suffix]])).rowCount,1);
   assert.equal((await db.query(`select id from public.${table} where id=$1`,[resourceIds[resource+other]])).rowCount,0);
   if(owner)assert.equal((await db.query("update public.properties set name='Unauthorized' where id=$1",[resourceIds[resource+other]])).rowCount,0);
  });
  results.passed.push(`Development ${key} reads own fixture and cannot read the other user's fixture`);
 }
 await scoped('prospect',async()=>{
  assert.equal((await db.query('select id from public.properties where id=any($1::uuid[])',[[resourceIds['property-a'],resourceIds['property-b']]])).rowCount,0);
  await assert.rejects(()=>db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[identities.prospect]),e=>e.code==='42501');
 });
 results.passed.push('Development prospect cannot see draft owner fixtures or grant itself administrator access');
 await scoped('admin',async()=>assert.equal((await db.query('select id from public.properties where id=any($1::uuid[])',[[resourceIds['property-a'],resourceIds['property-b']]])).rowCount,2));
 results.passed.push('Development platform administrator reads both test properties through existing policies');
 await assert.rejects(()=>db.query(relationSQL(identities,run)),/Existing roles/);await db.query('rollback');
 assert.equal((await db.query(verificationSQL(identities))).rows[0].development_verification.agreements,2);
 results.passed.push('Replaying Development provisioning refuses existing assigned identities without altering their leases');
}
