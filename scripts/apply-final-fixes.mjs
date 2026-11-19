import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

// User approved fixing the two reviewed Phase 1 issues. Fixed scope: migration 12 only.
// No reset, data correction, seed, Auth provisioning, config push or destructive recovery.
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development';
const filename='20261119000100_final_verification_fixes.sql';
const reportFile='docs/database/remote-fixes-apply-results.json';
const reviewed=JSON.parse(readFileSync('docs/database/final-remote-verification.json','utf8'));
const cli=resolve('node_modules/supabase/dist/supabase.js');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const redact=s=>String(s).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[redacted database address]').replace(/\b(?:sbp_|sb_secret_)[A-Za-z0-9_-]+/g,'[redacted credential]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted token]');
const approved=reviewed.pending_local;
const report={project:{name,ref},approval:{user_message:'kalau gitu perbaiki masalahnya, biar bisa menyelesaikan phase 1',scope:'Apply the single reviewed migration fixing NULL checkout and service-role invoice-view helper permission; no remote reset or seed.',recorded_at:new Date().toISOString()},approved_migrations:approved,status:'preflight',steps:[]};
function save(){writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');}
function checkManifest(){
 if(reviewed.project.name!==name||reviewed.project.ref!==ref||readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw new Error('Reviewed/linked target mismatch.');
 if(approved.length!==1||approved[0].file!==filename)throw new Error('Reviewed scope is not exactly the expected correction.');
 const actual=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
 if(!same(actual,reviewed.local_migrations.map(m=>m.file)))throw new Error('Unexpected migration file list.');
 for(const m of reviewed.local_migrations)if(createHash('sha256').update(readFileSync(`supabase/migrations/${m.file}`)).digest('hex')!==m.sha256)throw new Error(`Reviewed migration hash changed: ${m.file}`);
 for(const [file,count] of [['tests/database-candidate-final-results.json',52],['tests/database-upgrade-final-results.json',54]]){
  const test=JSON.parse(readFileSync(file,'utf8'));
  if(test.failed.length||test.passed.length!==count||test.migrations.at(-1)!==filename)throw new Error('Required local regression/upgrade tests have not passed.');
 }
}
async function run(args){
 const started_at=new Date().toISOString();
 const result=await new Promise((done,reject)=>{
  const child=spawn(process.execPath,[cli,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  child.on('error',reject);child.on('close',code=>done({code,stdout,stderr}));
 });
 const step={command:`npx supabase ${args.join(' ')}`,started_at,finished_at:new Date().toISOString(),exit_code:result.code};
 try{step.result=JSON.parse(redact(result.stdout));}catch{}
 if(args[0]==='projects'&&step.result)step.result=objects(step.result).filter(p=>(p.id===ref||p.ref===ref)&&p.name===name).map(p=>({id:p.id||p.ref,name:p.name,status:p.status,region:p.region}));
 if(result.stderr.trim())step.diagnostics=redact(result.stderr);
 report.steps.push(step);save();
 if(result.code!==0||!step.result)throw new Error(`CLI operation failed (${result.code}): ${redact(result.stderr||'Expected structured response; no raw stdout saved.')}`);
 return step.result;
}
async function query(file,key){
 const result=await run(['db','query',`--remote=${ref}`,'--read-only','--file',file,'--output-format','json']);
 const row=objects(result).find(r=>Object.hasOwn(r,key));
 if(!row)throw new Error(`Missing metadata result: ${key}`);
 return typeof row[key]==='string'?JSON.parse(row[key]):row[key];
}
try{
 if(existsSync(reportFile))throw new Error('A correction deployment report already exists; inspect it and use read-only verification instead of rerunning apply.');
 if(!process.argv.includes('--approved'))throw new Error('Explicit approval flag required.');
 checkManifest();
 if(JSON.parse(readFileSync('node_modules/supabase/package.json','utf8')).version!=='3.2.0')throw new Error('CLI version differs from reviewed syntax.');
 report.cli_version='3.2.0';
 const projects=await run(['projects','list','--output-format','json']);
 if(!objects(projects).some(p=>(p.id===ref||p.ref===ref)&&p.name===name&&p.status==='ACTIVE_HEALTHY'))throw new Error('Live target identity or health mismatch.');
 report.history_before=await query('supabase/review/migration-history.sql','migration_history');
 if(!same(report.history_before,reviewed.history))throw new Error('Remote migration history changed; refusing apply.');
 report.before=await query('supabase/review/final-catalogue.sql','catalogue');
 for(const key of ['tables','columns','constraints','indexes','policies','functions','triggers','views','api_privileges','api_roles','schema_access'])if(!same(report.before[key],reviewed.catalogue[key]))throw new Error(`Remote schema drift in ${key}; refusing apply.`);
 if(Object.values(report.before.integrity).some(v=>v!==0))throw new Error('Existing data integrity check failed; no automatic row correction authorized.');
 const args=['db','push',`--remote=${ref}`,'--skip-vault','--output-format','json'];
 report.dry_run=await run([...args,'--dry-run']);
 const plan=report.dry_run;
 if(plan.dryRun!==true||plan.target.project_ref!==ref||plan.target.project_name!==name||!same(plan.migrations,[filename])||(plan.seeds||[]).length||(plan.roles||[]).length)throw new Error('Fresh dry-run differs from the one-migration approved scope.');
 checkManifest();report.status='applying';save();console.log('Verified target, unchanged hashes and one-migration dry-run. Applying approved correction only.');
 report.apply=await run([...args,'--yes']);
 report.apply_completed=true;report.status='verifying';save();
 report.history_after=await query('supabase/review/migration-history.sql','migration_history');
 report.after=await query('supabase/review/final-catalogue.sql','catalogue');
 report.postflight=await query('supabase/review/postflight.sql','postflight');
 const candidate=JSON.parse(readFileSync('tests/database-candidate-catalogue.json','utf8'));
 report.verification={history:same(report.history_after.map(h=>h.version),reviewed.local_migrations.map(m=>m.file.slice(0,14))),row_counts_preserved:same(report.before.counts,report.after.counts),all_constraints_valid:report.after.constraints.every(c=>c.validated),all_tables_rls:report.after.tables.every(t=>t.rls),integrity:Object.values(report.after.integrity).every(v=>v===0)};
 for(const key of ['tables','columns','constraints','indexes','policies','functions','triggers','views','api_privileges','api_roles','schema_access'])report.verification[`${key}_match_tested_candidate`]=same(report.after[key],candidate[key]);
 if(Object.values(report.verification).some(v=>!v))throw new Error('Post-apply checks failed. No destructive recovery attempted; inspect report.');
 report.final_dry_run=await run([...args,'--dry-run']);
 if(!report.final_dry_run.upToDate||(report.final_dry_run.migrations||[]).length)throw new Error('Post-apply dry-run is not up to date.');
 report.status='verified';report.finished_at=new Date().toISOString();save();
 console.log(JSON.stringify({status:report.status,migrations:report.history_after.length,pending:0,counts_preserved:report.verification.row_counts_preserved,correction:filename}));
}catch(e){
 // Never overwrite an earlier apply record on an accidental rerun.
 if(report.steps.length){report.status=report.apply_completed?'verification_failed':'stopped';report.error=redact(e.message);report.finished_at=new Date().toISOString();save();}
 console.error(redact(e.message));process.exitCode=1;
}
