// Read-only metadata and dry-run only. Never applies/deploys/loads service keys.
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development',cli=resolve('node_modules/supabase/dist/supabase.js');
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
let stage='target';
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const migration='20261120000100_internal_payment_simulator.sql';
const report={checked_at:new Date().toISOString(),project:{name,ref},read_only:true,remote_mutations:false,deployment_performed:false};
const run=args=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000}));
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw Error('TARGET_MISMATCH');
 if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===ref||p.ref===ref)&&p.name===name&&p.status==='ACTIVE_HEALTHY'))throw Error('TARGET_MISMATCH');
 stage='preflight';const out=run(['db','query','--remote='+ref,'--read-only','--file','supabase/review/phase5-preflight.sql','--output-format','json']);
 let pre=objects(out).find(x=>Object.hasOwn(x,'phase5_preflight'))?.phase5_preflight;if(typeof pre==='string')pre=JSON.parse(pre);
 if(!pre?.history)throw Error('NO_HISTORY');report.preflight=pre;report.phase5_applied=pre.history.includes('20261120000100');
 if(!process.argv.includes('--preflight-only')){
  const applied=report.phase5_applied;
  if(pre.history.length!==(applied?15:14)||pre.history.at(-1)!==(applied?'20261120000100':'20261119000300')||pre.tables!==(applied?35:34)||pre.foreign_keys!==(applied?62:58)||pre.policies!==(applied?49:48)||pre.public_functions!==(applied?40:37)||pre.rls_disabled||pre.browser_rent_writer||pre.browser_boost_writer)throw Error('PLAN_MISMATCH');
  report.expected_pending=applied?[]:[{file:migration,sha256:hash('supabase/migrations/'+migration)}];
  report.functions=['simulate-rent-payment','simulate-boost-payment'].map(name=>({name,verify_jwt:true,sha256:hash('supabase/functions/'+name+'/index.ts')}));
  report.shared_files=readdirSync('supabase/functions/_shared').sort().map(file=>({file,sha256:hash('supabase/functions/_shared/'+file)}));
  stage='dry-run';report.dry_run=run(['db','push','--remote='+ref,'--dry-run','--skip-vault','--output-format','json']);
  if(report.dry_run.target?.project_ref!==ref||report.dry_run.target?.project_name!==name||(report.dry_run.seeds||[]).length||(report.dry_run.roles||[]).length||(applied?(!report.dry_run.upToDate||(report.dry_run.migrations||[]).length):(!report.dry_run.dryRun||report.dry_run.migrations?.length!==1||report.dry_run.migrations[0]!==migration)))throw Error('PLAN_MISMATCH');
  if(applied){
   stage='read-only postflight';const post=run(['db','query','--remote='+ref,'--read-only','--file','supabase/review/phase5-postflight.sql','--output-format','json']);let p=objects(post).find(x=>Object.hasOwn(x,'phase5_postflight'))?.phase5_postflight;if(typeof p==='string')p=JSON.parse(p);
   if(!p||p.tables!==35||p.rls_disabled||p.foreign_keys!==62||p.policies!==49||p.public_functions!==40||p.unsafe_definers||p.invalid_indexes||p.invalid_constraints||p.browser_attempt_write||p.browser_config_read||p.server_functions?.length!==3||p.server_functions.some(f=>f.browser||f.anon||!f.service)||p.published_tables?.length!==13||p.publication.delete||p.publication.truncate)throw Error('PLAN_MISMATCH');report.postflight=p;
   stage='functions metadata';const deployed=objects(run(['functions','list','--remote='+ref,'--output-format','json']));report.deployed_functions=['simulate-rent-payment','simulate-boost-payment'].map(slug=>{const f=deployed.find(f=>f.slug===slug);return {slug,status:f?.status,version:f?.version,verify_jwt:f?.verify_jwt};});if(report.deployed_functions.some(f=>f.status!=='ACTIVE'||!f.verify_jwt))throw Error('PLAN_MISMATCH');
  }
 }
 report.success=true;
}catch(error){report.success=false;report.failed_stage=stage;report.error_code=error.code==='ETIMEDOUT'?'CLI_TIMEOUT':['TARGET_MISMATCH','NO_HISTORY','PLAN_MISMATCH'].includes(error.message)?error.message:'CLI_FAILED';process.exitCode=1;}
report.local_migrations=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().map(file=>({file,sha256:createHash('sha256').update(readFileSync('supabase/migrations/'+file)).digest('hex')}));
mkdirSync('docs/payment',{recursive:true});const path=report.phase5_applied?'docs/payment/cloud-current-review-results.json':process.argv.includes('--preflight-only')?'docs/payment/revision-preflight-results.json':'docs/payment/revision-remote-review-results.json';
writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,stage,phase5_applied:report.phase5_applied,error:report.error_code,remote_mutations:false,report:path}));
