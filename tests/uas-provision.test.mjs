import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {accounts,fixtureTag,resourceIds,requireNewAccounts,provisionNewAccounts,relationSQL} from '../scripts/lib/uas-fixtures.mjs';

const password=()=>randomBytes(20).toString('base64url')+'Qa1!';
function harness(overrides={}) {
  const created=[],receipts=[],sql=[],passwords=new Map(accounts.map(a=>[a.key,password()]));let prompts=0,verified=false;
  const admin={listUsers:async()=>({data:{users:[]}}),createUser:async input=>{created.push(input);return {data:{user:{id:randomUUID(),email:input.email,app_metadata:input.app_metadata}}};},...overrides};
  const options={admin,prompt:async()=>passwords.get(accounts[Math.floor(prompts++/2)].key),persistReceipt:async receipt=>receipts.push(structuredClone(receipt)),writeRelations:async source=>sql.push(source),verifyAccounts:async(ids,privatePasswords)=>{assert.equal(Object.keys(ids).length,6);assert.deepEqual(privatePasswords,passwords);verified=true;}};
  return {options,created,receipts,sql,passwords,get prompts(){return prompts;},get verified(){return verified;}};
}
test('six reserved identities have distinct emails and expected development roles',()=>{
  assert.deepEqual(accounts.map(a=>a.role),['prospect','tenant','tenant','owner','owner','admin']);
  assert.equal(new Set(accounts.map(a=>a.email)).size,6);assert.ok(accounts.every(a=>a.email.endsWith('@ngekosaja.test')));
  assert.equal(new Set(Object.values(resourceIds)).size,6);
});
test('successful provisioning confirms only new accounts, commits relations and stores no passwords',async()=>{
  const h=harness();const result=await provisionNewAccounts(h.options);
  assert.equal(result.created,6);assert.equal(h.prompts,12);assert.equal(h.verified,true);
  assert.equal(h.sql.length,1);assert.match(h.sql[0],/^begin;/);assert.match(h.sql[0],/publication_status='draft'/);assert.match(h.sql[0],/commit;$/);
  for(const input of h.created){assert.equal(input.email_confirm,true);assert.equal(input.app_metadata.uas_fixture,fixtureTag);assert.equal(input.user_metadata.role,undefined);}
  assert.equal(h.receipts.at(-1).relations_committed,true);assert.equal(h.receipts.at(-1).created.length,6);
  const saved=JSON.stringify(h.receipts)+h.sql.join('');for(const pw of h.passwords.values())assert.ok(!saved.includes(pw));
});
test('any existing target email stops before prompting or creating',async()=>{
  const h=harness({listUsers:async()=>({data:{users:[{email:accounts[2].email.toUpperCase()}]}})});
  await assert.rejects(()=>provisionNewAccounts(h.options),/existing/);assert.equal(h.created.length,0);assert.equal(h.prompts,0);assert.equal(h.receipts.length,0);
});
test('inventory paginates and leaves unrelated existing users untouched',async()=>{
  const pages=[];await requireNewAccounts({listUsers:async({page})=>{pages.push(page);return {data:{users:page===1?Array.from({length:100},(_,i)=>({email:`unrelated-${i}@example.invalid`})) : []}};}});
  assert.deepEqual(pages,[1,2]);
});
test('password mismatch aborts before all remote writes',async()=>{
  const h=harness();let n=0;h.options.prompt=async()=>n++%2?password():password();
  await assert.rejects(()=>provisionNewAccounts(h.options));assert.equal(h.created.length,0);assert.equal(h.receipts.length,0);assert.equal(h.sql.length,0);
});
test('cancel during password entry creates no account',async()=>{
  const h=harness();h.options.prompt=async()=>{throw new Error('cancelled');};
  await assert.rejects(()=>provisionNewAccounts(h.options),/cancelled/);assert.equal(h.created.length,0);assert.equal(h.receipts.length,0);
});
test('partial Auth failure retains receipt and never deletes or updates users',async()=>{
  const h=harness();const create=h.options.admin.createUser;h.options.admin.createUser=async input=>h.created.length===2?{error:{message:'injected'}}:create(input);
  await assert.rejects(()=>provisionNewAccounts(h.options),/dipertahankan/);assert.equal(h.created.length,2);assert.equal(h.receipts.at(-1).created.length,2);assert.equal(h.receipts.at(-1).relations_committed,false);assert.equal(h.sql.length,0);
});
test('transaction failure keeps Auth receipt and does not claim committed relations',async()=>{
  const h=harness();h.options.writeRelations=async()=>{throw new Error('transaction rejected');};
  await assert.rejects(()=>provisionNewAccounts(h.options),/transaction rejected/);assert.equal(h.receipts.at(-1).created.length,6);assert.equal(h.receipts.at(-1).relations_committed,false);assert.equal(h.verified,false);
});
test('untrusted Auth identity response never reaches relation SQL',async()=>{
  const h=harness({createUser:async input=>({data:{user:{id:randomUUID(),email:'other@example.invalid',app_metadata:input.app_metadata}}})});
  await assert.rejects(()=>provisionNewAccounts(h.options),/tidak cocok/);assert.equal(h.sql.length,0);
});
test('SQL builder refuses injected, missing or duplicate UUIDs and invalid run markers',()=>{
  const ids=Object.fromEntries(accounts.map(a=>[a.key,randomUUID()])),run='a'.repeat(32);
  assert.throws(()=>relationSQL({...ids,admin:"';delete from auth.users;--"},run),/UUID/);
  assert.throws(()=>relationSQL({...ids,admin:ids.prospect},run),/berbeda/);
  assert.throws(()=>relationSQL(ids,'invalid'),/run/);
  const source=relationSQL(ids,run);assert.doesNotMatch(source,/delete\s+from|truncate|disable\s+trigger|alter\s+table|update\s+auth\.users/i);
});
