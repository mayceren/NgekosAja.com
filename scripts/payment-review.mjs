// Fixed read-only target; no apply/deploy/secrets mode exists.
import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development',migration='20261120000100_sandbox_payments.sql',cli=resolve('node_modules/supabase/dist/supabase.js');
const run=args=>{try{return JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000}));}catch(error){let code='CLI_FAILED';try{code=JSON.parse(String(error.stdout)).error?.code||JSON.parse(String(error.stdout)).code||code;}catch{}if(error.code==='ETIMEDOUT')code='CLI_TIMEOUT';lastCode=code;console.error(JSON.stringify({stage,error_code:code,exit_code:error.status??null,signal:error.signal??null}));throw Error('CLI failed');}};
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
let stage='target',lastCode;
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw Error();
 if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===ref||p.ref===ref)&&p.name===name&&p.status==='ACTIVE_HEALTHY'))throw Error();
 stage='read-only preflight';const out=run(['db','query','--remote='+ref,'--read-only','--file','supabase/review/phase5-preflight.sql','--output-format','json']);let pre=objects(out).find(x=>Object.hasOwn(x,'phase5_preflight'))?.phase5_preflight;if(typeof pre==='string')pre=JSON.parse(pre);
 stage='baseline comparison';
 if(!pre||pre.history.length!==14||pre.history.at(-1)!=='20261119000300'||pre.tables!==34||pre.rls_disabled||pre.foreign_keys!==58||pre.policies!==48||pre.public_functions!==37||pre.browser_rent_writer||pre.browser_boost_writer)throw Error();
 mkdirSync('docs/payment',{recursive:true});writeFileSync('docs/payment/cloud-preflight-results.json',JSON.stringify({checked_at:new Date().toISOString(),project:{name,ref},read_only:true,remote_mutations:false,preflight:pre},null,2)+'\n');
 stage='dry-run';const plan=run(['db','push','--remote='+ref,'--dry-run','--skip-vault','--output-format','json','--dns-resolver','https']);
 stage='plan comparison';
 if(!plan.dryRun||plan.target?.project_ref!==ref||plan.target?.project_name!==name||plan.migrations?.length!==1||plan.migrations[0]!==migration||(plan.seeds||[]).length||(plan.roles||[]).length)throw Error();
 const report={checked_at:new Date().toISOString(),project:{name,ref},read_only:true,remote_mutations:false,migrations_applied:false,functions_deployed:false,midtrans_connected:false,preflight:pre,cli_version:JSON.parse(readFileSync('node_modules/supabase/package.json','utf8')).version,pending:[{file:migration,sha256:hash('supabase/migrations/'+migration)}],applied_files:readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f!==migration).sort().map(file=>({file,sha256:hash('supabase/migrations/'+file)})),functions:['create-rent-payment','create-boost-payment','payment-status','midtrans-webhook'].map(name=>({name,sha256:hash('supabase/functions/'+name+'/index.ts'),verify_jwt:name!=='midtrans-webhook'})),shared_files:readdirSync('supabase/functions/_shared').sort().map(file=>({file,sha256:hash('supabase/functions/_shared/'+file)})),limitations:['Phase 4 real-JWT multi-account realtime/storage E2E still pending.','No Midtrans account/keys available; all payment execution evidence is local/mock.']};
 mkdirSync('docs/payment',{recursive:true});writeFileSync('docs/payment/remote-review-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({project:name,applied_migrations:pre.history.length,pending:report.pending,remote_mutations:false,functions_deployed:false}));
}catch{
 mkdirSync('docs/payment',{recursive:true});
 const report={checked_at:new Date().toISOString(),project:{name,ref},status:'incomplete',failed_stage:stage,error_code:lastCode||'REVIEW_MISMATCH',read_only:true,remote_mutations:false,functions_deployed:false,midtrans_connected:false,dry_run:{attempted:stage.includes('dry-run')||stage==='plan comparison',verified:false},expected_pending:[{file:migration,sha256:hash('supabase/migrations/'+migration)}],applied_files:readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f!==migration).sort().map(file=>({file,sha256:hash('supabase/migrations/'+file)})),functions:['create-rent-payment','create-boost-payment','payment-status','midtrans-webhook'].map(name=>({name,sha256:hash('supabase/functions/'+name+'/index.ts'),verify_jwt:name!=='midtrans-webhook'})),shared_files:readdirSync('supabase/functions/_shared').sort().map(file=>({file,sha256:hash('supabase/functions/_shared/'+file)})),limitations:['Cloud preflight is recorded separately; expected migration list is not a successful CLI dry-run.','No apply or deploy is authorized. Retry dry-run successfully before requesting deployment approval.']};
 writeFileSync('docs/payment/remote-review-results.json',JSON.stringify(report,null,2)+'\n');
 console.error('Read-only payment review incomplete at '+stage+'; raw CLI output/credentials withheld. No mutation attempted.');process.exitCode=1;
}
