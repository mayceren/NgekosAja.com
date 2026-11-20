import { readFileSync,readdirSync,writeFileSync,mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { connect,localConfiguration,safeError } from './local-database.mjs';
import { runContracts } from '../supabase/tests/contracts.mjs';

// Always creates a NEW throwaway DB. It never resets, drops or migrates the input DB.
// Native adapter deliberately excludes Supabase Auth/PostgREST integration verification.
const native=process.argv.includes('--native');
const option=name=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const through=option('through');
const phase4Fresh=process.argv.includes('--phase4-fresh');
const phase5=process.argv.includes('--phase5'),phase5Fresh=process.argv.includes('--phase5-fresh');
const backendFresh=process.argv.includes('--backend-fresh')||phase4Fresh||phase5Fresh;
const phase4=process.argv.includes('--phase4')||phase5||phase5Fresh;
const backend=process.argv.includes('--backend')||(!backendFresh&&(!through||through>='20261119000200')&&readdirSync('supabase/migrations').includes('20261119000200_backend_integration.sql'));
if(through&&!/^\d{14}$/.test(through))throw new Error('Invalid migration boundary.');
const output=option('output')||'tests/database-results.json';
if(!/^tests\/[a-z0-9-]+\.json$/.test(output))throw new Error('Results must be written to a JSON file in tests/.');
let root,client,scratch;
const results={engine:'',mode:native?'native-postgresql-auth-contract-adapter':'local-supabase-postgresql-auth-contract-adapter',migrations:[],passed:[],failed:[],limitations:['GoTrue/Auth Admin API, JWT verification, PostgREST, Supabase Docker startup and PostgreSQL 17 stack not exercised by SQL contract adapter.']};
try {
 const config=localConfiguration({native});
 root=await connect(config.db);
 scratch='ngekosaja_test_'+randomUUID().replaceAll('-','');
 await root.query(`create database "${scratch}"`);
 const dbConfig=config.db.connectionString?{...config.db,database:scratch,connectionString:undefined,...(()=>{const u=new URL(config.db.connectionString);return {host:u.hostname,port:Number(u.port||5432),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password)};})()}:{...config.db,database:scratch};
 client=await connect(dbConfig);
 results.engine=(await client.query('select version() as version')).rows[0].version;
 await client.query(readFileSync('supabase/tests/bootstrap_native.sql','utf8'));
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f.slice(0,14)<='20261119000200'&&(!through||f.slice(0,14)<=through)&&(!backend||f.slice(0,14)<='20261119000100')).sort()) {
  try { await client.query(readFileSync(`supabase/migrations/${file}`,'utf8'));results.migrations.push(file);console.log(`Migration OK: ${file}`); }
  catch(error) { throw new Error(`${file}: ${safeError(error)}`); }
 }
 if(!backendFresh)await runContracts(client,dbConfig,results);
 if(process.argv.includes('--upgrade-check')) {
  if(through!=='20261118001100')throw new Error('Upgrade check must start from the applied 11-migration baseline.');
  const {verifyFinalUpgrade}=await import('../supabase/tests/final-upgrade.mjs');
  await verifyFinalUpgrade(client,results);
 }
 if(process.argv.includes('--extended')) {
  const {runFinalContracts}=await import('../supabase/tests/final-contracts.mjs');
  await runFinalContracts(client,dbConfig,results);
  if(results.failed.length)process.exitCode=1;
 }
 if(process.argv.includes('--development-accounts')) {
  const {runDevelopmentAccountContracts}=await import('../supabase/tests/development-accounts.mjs');
  await runDevelopmentAccountContracts(client,results);
 }
 if(option('catalogue-output')) {
  const path=option('catalogue-output');
  if(!/^tests\/[a-z0-9-]+\.json$/.test(path))throw new Error('Invalid catalogue output path.');
  const row=(await client.query(readFileSync('supabase/review/final-catalogue.sql','utf8'))).rows[0];
  writeFileSync(path,JSON.stringify(row.catalogue,null,2)+'\n');
 }
 if(process.argv.includes('--postflight')) {
  const {postflight}= (await client.query(readFileSync('supabase/review/postflight.sql','utf8'))).rows[0];
  if(postflight.table_count!==31||postflight.policy_count!==45||postflight.foreign_key_count!==48||postflight.public_function_count!==24||postflight.rls_disabled_table_count!==0||postflight.public_execute_grants!==0||postflight.unsafe_definer_search_paths!==0||postflight.browser_can_grant_roles||postflight.browser_can_record_rent||postflight.browser_can_record_boost||!postflight.invoice_view_security_invoker||!postflight.public_listings_accessible_to_anon||postflight.dangerous_api_table_privileges.length||postflight.master_facility_count!==7) throw new Error('Postflight verification contract failed.');
  results.postflight=postflight;console.log('PASS postflight verification SQL against locally migrated database');
 }
 if(process.argv.includes('--docs')) { const {generateDatabaseDocs}=await import('./database-docs.mjs');await generateDatabaseDocs(client); }
 if((backend || backendFresh)&&!phase4Fresh&&!phase5Fresh){
  if(backend){
   const before=(await client.query('select count(*)::int n from public.rental_agreements')).rows[0].n;
   const file='20261119000200_backend_integration.sql';await client.query(readFileSync('supabase/migrations/'+file,'utf8'));results.migrations.push(file);
   const after=(await client.query('select count(*)::int n from public.rental_agreements')).rows[0].n;if(before!==after)throw new Error('Upgrade changed agreement count.');
   results.passed.push('Phase 3 additive upgrade preserves existing agreements');
  }
  const {runBackendContracts}=await import('../supabase/tests/backend-contracts.mjs');await runBackendContracts(client,dbConfig,results);
 }
 if(phase4){
  await client.query(readFileSync('supabase/tests/bootstrap_storage_native.sql','utf8'));
  const file='20261119000300_realtime_storage.sql';const sql=readFileSync('supabase/migrations/'+file,'utf8');try{await client.query(sql);}catch(e){console.error('Phase4 SQL position:',e.position,'line:',sql.slice(0,Number(e.position)).split('\n').length);throw e;}results.migrations.push(file);
  if(!phase5Fresh){const {runPhase4Contracts}=await import('../supabase/tests/phase4-contracts.mjs');await runPhase4Contracts(client,results,dbConfig);}
  results.limitations.push('Storage schema/objects and JWT claims are native SQL adapters; Cloud Storage upload/signing/WebSocket delivery are not verified.');
 }
 if(phase5||phase5Fresh){
  const file='20261120000100_internal_payment_simulator.sql',sql=readFileSync('supabase/migrations/'+file,'utf8');
  try{await client.query(sql);}catch(e){console.error('Phase5 SQL line:',sql.slice(0,Number(e.position)).split('\n').length);throw e;}results.migrations.push(file);
  const {runPaymentContracts}=await import('../supabase/tests/payment-contracts.mjs');await runPaymentContracts(client,results,dbConfig);
 }
} catch(error) { results.failed.push(safeError(error));console.error(safeError(error));process.exitCode=1; }
finally {
 if(client)await client.end();
 if(root&&scratch) { await root.query(`drop database "${scratch}" with (force)`).catch(()=>{}); }
 if(root)await root.end();
 results.executed_at=new Date().toISOString();mkdirSync('tests',{recursive:true});
 writeFileSync(output,JSON.stringify(results,null,2)+'\n');
 console.log(`${results.passed.length} passed, ${results.failed.length} failed; scratch database removed.`);
}
