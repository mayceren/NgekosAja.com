import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixtureId } from '../../scripts/development-fixtures.mjs';

export async function verifyFinalUpgrade(db,results) {
 const migration='20261119000100_final_verification_fixes.sql';
 const sql=readFileSync(`supabase/migrations/${migration}`,'utf8');
 const agreement=fixtureId('lease-t2');
 const tables=(await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(r=>r.tablename);
 async function snapshot() {
  const result={};
  for(const name of tables) {
   assert.match(name,/^[a-z_]+$/);
   result[name]=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(row_to_json(t)::text,'' order by id),'')) digest from public.${name} t`)).rows[0];
  }
  return result;
 }
 const before=await snapshot();
 // Reproduce an invalid historical row inside a transaction, then prove VALIDATE
 // aborts the entire migration. ROLLBACK also removes that deliberately invalid row.
 await db.query('begin');
 try {
  await db.query("update public.rental_agreements set status='checked_out',closed_on=null where id=$1",[agreement]);
  await assert.rejects(()=>db.query(sql),e=>e.code==='23514');
 }finally{await db.query('rollback');}
 assert.equal((await db.query("select count(*)::int count from pg_constraint where conname='agreement_closed_on_required'")).rows[0].count,0);
 assert.deepEqual(await snapshot(),before);
 results.passed.push('Upgrade refuses invalid historical closures and rolls back all DDL without changing rows');
 console.log('PASS Upgrade refuses invalid historical closures and rolls back all DDL without changing rows');
 await db.query(sql);
 assert.deepEqual(await snapshot(),before);
 assert.equal((await db.query("select convalidated from pg_constraint where conname='agreement_closed_on_required'")).rows[0].convalidated,true);
 results.migrations.push(migration);
 results.passed.push('Upgrade applies to populated baseline with identical row counts and row digests');
 console.log('PASS Upgrade applies to populated baseline with identical row counts and row digests');
}
