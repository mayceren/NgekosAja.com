import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

// Fixed scope approved by the user: these 11 migrations + master facilities only.
// No reset, config push, fixture provisioning, key creation or destructive recovery.
const ref='wfmhsbdfdcugxblqsaob', name='ngekosaja-development';
const reportFile='docs/database/remote-apply-results.json';
const cli=resolve('node_modules/supabase/dist/supabase.js');
const approved=JSON.parse(readFileSync('docs/database/remote-review-results.json','utf8'));
const redact=s=>String(s).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[redacted database address]').replace(/\b(?:sbp_|sb_secret_)[A-Za-z0-9_-]+/g,'[redacted credential]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted token]');
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(c=>c&&typeof c==='object').flatMap(objects)]:[];
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
let report={project:{name,ref},approval:{user_message:'aku setuju',scope:'11 reviewed migrations and seed of 7 master facilities; verify tables, RLS and grants',recorded_at:new Date().toISOString()},approved_migrations:approved.migrations,approved_seeds:approved.seeds,status:'preflight',steps:[]};
function save(){writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');}
function checkManifest(){
 if(approved.project.name!==name||approved.project.ref!==ref||readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw new Error('Approved/linked project mismatch.');
 const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
 if(files.length!==11||JSON.stringify(files)!==JSON.stringify(approved.migrations.map(m=>m.file)))throw new Error('Migration file list differs from approved plan.');
 for(const m of approved.migrations)if(digest(`supabase/migrations/${m.file}`)!==m.sha256)throw new Error(`Approved hash mismatch: ${m.file}`);
 if(approved.seeds.length!==1||approved.seeds[0].file!=='supabase/seed.sql'||digest('supabase/seed.sql')!==approved.seeds[0].sha256)throw new Error('Seed differs from approved plan.');
}
async function run(args){
 const started_at=new Date().toISOString();
 const result=await new Promise((resolveResult,reject)=>{
  const child=spawn(process.execPath,[cli,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',b=>stdout+=b.toString());child.stderr.on('data',b=>stderr+=b.toString());
  child.on('error',reject);child.on('close',code=>resolveResult({code,stdout,stderr}));
 });
 const step={command:`npx supabase ${args.join(' ')}`,started_at,finished_at:new Date().toISOString(),exit_code:result.code};
 try{step.result=JSON.parse(redact(result.stdout));}catch{step.output=redact(result.stdout);}
 if(args[0]==='projects'&&args[1]==='list'&&step.result)step.result=objects(step.result).filter(p=>(p.id===ref||p.ref===ref)&&p.name===name).map(p=>({id:p.id||p.ref,name:p.name,status:p.status,region:p.region}));
 if(result.stderr.trim())step.diagnostics=redact(result.stderr);
 report.steps.push(step);save();
 if(result.code!==0)throw new Error(`CLI failed (${result.code}): ${redact(result.stderr||result.stdout)}`);
 if(!step.result)throw new Error('Expected structured CLI output; inspect the sanitized report before continuing.');
 return step.result;
}
async function query(file,column){
 const output=await run(['db','query',`--remote=${ref}`,'--read-only','--file',file,'--output-format','json']);
 const row=objects(output).find(o=>Object.hasOwn(o,column));
 if(!row)throw new Error(`Missing read-only result: ${column}`);
 return typeof row[column]==='string'?JSON.parse(row[column]):row[column];
}
try{
 if((()=>{try{return JSON.parse(readFileSync(reportFile,'utf8')).apply_completed;}catch{return false;}})()){
  console.error('Apply already completed. Evidence preserved; use read-only verification instead of rerunning deployment.');process.exit(1);
 }
 if(!process.argv.includes('--approved'))throw new Error('Explicit --approved flag required; review authorization before running.');
 checkManifest();
 const installed=JSON.parse(readFileSync('node_modules/supabase/package.json','utf8')).version;
 if(installed!==approved.cli_version)throw new Error('Installed CLI version differs from reviewed version.');
 report.cli_version=installed;
 const projects=await run(['projects','list','--output-format','json']);
 if(!objects(projects).some(p=>(p.id===ref||p.ref===ref)&&p.name===name&&p.status==='ACTIVE_HEALTHY'))throw new Error('Live project identity/health mismatch.');
 const preflight=await query('supabase/review/preflight.sql','preflight');report.preflight=preflight;save();
 if(preflight.application_relations.length||preflight.application_functions.length||preflight.auth_user_count!==0||preflight.migration_history_exists)throw new Error('Remote state changed from reviewed empty project; stop for review.');
 const plan=await run(['db','push',`--remote=${ref}`,'--dry-run','--include-seed','--skip-vault','--output-format','json']);
 if(plan.dryRun!==true||plan.target.project_ref!==ref||plan.target.project_name!==name||JSON.stringify(plan.migrations)!==JSON.stringify(approved.migrations.map(m=>m.file))||JSON.stringify(plan.seeds)!==JSON.stringify(['supabase/seed.sql'])||(plan.roles||[]).length)throw new Error('Fresh dry-run differs from approved scope.');
 checkManifest();report.status='applying';save();console.log('Target, hashes and fresh dry-run verified. Applying approved migrations and master seed.');
 report.apply=await run(['db','push',`--remote=${ref}`,'--include-seed','--skip-vault','--yes','--output-format','json']);
 report.apply_completed=true;report.status='verifying';save();console.log('Migration command completed. Verifying tables, RLS, grants and master data read-only.');
 report.postflight=await query('supabase/review/postflight.sql','postflight');
 report.history=await query('supabase/review/migration-history.sql','migration_history');
 const p=report.postflight;
 const tests={table_count:p.table_count===31,policy_count:p.policy_count===45,foreign_key_count:p.foreign_key_count===48,public_function_count:p.public_function_count===24,all_tables_rls:p.rls_disabled_table_count===0,safe_definers:p.unsafe_definer_search_paths===0,no_public_execute:p.public_execute_grants===0,invoice_view_invoker:p.invoice_view_security_invoker===true,no_browser_role_grant:p.browser_can_grant_roles===false,no_browser_rent_payment:p.browser_can_record_rent===false,no_browser_boost_payment:p.browser_can_record_boost===false,anon_catalogue:p.public_listings_accessible_to_anon===true,no_dangerous_api_privileges:p.dangerous_api_table_privileges.length===0,anon_table_scope:p.anon_table_grants.length===1&&p.anon_table_grants[0].table==='facilities'&&p.anon_table_grants[0].privilege==='SELECT',migration_history:JSON.stringify(report.history.map(m=>m.version))===JSON.stringify(approved.migrations.map(m=>m.file.slice(0,14)))};
 report.verification=tests;
 if(Object.values(tests).some(v=>!v))throw new Error('Postflight catalogue checks failed; inspect saved evidence. No destructive recovery attempted.');
 report.seed_verified=p.master_facility_count===7&&JSON.stringify(p.master_facility_codes)===JSON.stringify(['ac','furniture','laundry','parking','private_bathroom','shared_kitchen','wifi']);
 report.status=report.seed_verified?'verified':'catalogue_verified_seed_requires_additional_check';report.finished_at=new Date().toISOString();save();
 console.log(JSON.stringify({status:report.status,tables:p.table_count,policies:p.policy_count,foreign_keys:p.foreign_key_count,facilities:p.master_facility_count,migrations:report.history.length,inspection_role:p.inspection_role,bypass_rls:p.inspection_bypass_rls}));
}catch(error){report.status=report.apply_completed?'verification_failed':'stopped';report.error=redact(error.message);report.finished_at=new Date().toISOString();save();console.error(report.error);process.exitCode=1;}
