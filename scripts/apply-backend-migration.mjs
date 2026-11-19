import {readFileSync,readdirSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

// Fixed scope approved by the user. No reset, seed, user changes or config push.
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development';
const file='20261119000200_backend_integration.sql';
const sha='ccee330228bf97b26138c4a486b01a0e24284ae076985ef7376ad8957ace9e49';
const output='docs/backend/remote-apply-results.json';
const cli=resolve('node_modules/supabase/dist/supabase.js');
const baseline=JSON.parse(readFileSync('docs/database/phase1-completion-verification.json','utf8'));
const review=JSON.parse(readFileSync('docs/backend/remote-review-results.json','utf8'));
const report={project:{name,ref},approval:{message:'setuju',scope:file,sha256:sha,recorded_at:new Date().toISOString()},status:'preflight',steps:[]};
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
function manifest(){
 if(process.argv.length!==3||process.argv[2]!=='--approved-sha256='+sha)throw Error('Exact approved fingerprint required');
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref||review.project!==name||review.migration_sha256!==sha)throw Error('Linked/reviewed target mismatch');
 const expected=[...baseline.local_migrations.map(m=>m.file),file].sort();
 if(!same(readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort(),expected))throw Error('Unexpected migration list');
 for(const item of [...baseline.local_migrations,{file,sha256:sha}])if(createHash('sha256').update(readFileSync('supabase/migrations/'+item.file)).digest('hex')!==item.sha256)throw Error('Migration checksum mismatch');
 for(const [path,total] of [['tests/backend-database-fresh-results.json',16],['tests/backend-database-upgrade-results.json',83]]){
  const result=JSON.parse(readFileSync(path,'utf8'));if(result.failed.length||result.passed.length!==total||result.migrations.at(-1)!==file)throw Error('Required SQL test evidence missing');
 }
}
async function run(args){
 const result=await new Promise((done,reject)=>{
  const child=spawn(process.execPath,[cli,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='';
  const timer=setTimeout(()=>{child.kill();reject(Error('CLI timeout; inspect history before any retry'));},55000);
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',()=>{});
  child.on('error',()=>{clearTimeout(timer);reject(Error('CLI could not start'));});
  child.on('close',code=>{clearTimeout(timer);done({code,stdout});});
 });
 report.steps.push({command:'supabase '+args.join(' '),finished_at:new Date().toISOString(),exit_code:result.code});save();
 if(result.code!==0)throw Error('CLI operation failed; raw output withheld. No automatic retry/reset');
 try{return JSON.parse(result.stdout);}catch{throw Error('Structured CLI response missing; inspect remote history before retry');}
}
async function query(path,key){const data=await run(['db','query','--remote='+ref,'--read-only','--file',path,'--output-format','json']);const value=objects(data).find(x=>Object.hasOwn(x,key))?.[key];if(value===undefined)throw Error('Missing read-only result');return typeof value==='string'?JSON.parse(value):value;}
try{
 if(existsSync(output))throw Error('An apply report already exists. Use read-only verification; do not rerun apply');
 manifest();
 const projects=await run(['projects','list','--output-format','json']);
 if(!objects(projects).some(p=>(p.id===ref||p.ref===ref)&&p.name===name&&p.status==='ACTIVE_HEALTHY'))throw Error('Live project identity/health mismatch');
 report.history_before=await query('supabase/review/migration-history.sql','migration_history');
 if(!same(report.history_before.map(r=>r.version),baseline.local_migrations.map(m=>m.file.slice(0,14))))throw Error('Unexpected remote migration history');
 report.before=await query('supabase/review/final-catalogue.sql','catalogue');
 for(const section of ['tables','columns','constraints','indexes','policies','functions','triggers','views','api_privileges','api_roles','schema_access'])if(!same(report.before[section],baseline.catalogue[section]))throw Error('Remote baseline schema drift: '+section);
 if(Object.values(report.before.integrity).some(n=>n!==0))throw Error('Existing integrity problem; no data corrections authorized');
 const tables=report.before.tables.filter(t=>t.schema==='public').map(t=>t.name);
 if(tables.length!==31||tables.some(t=>!/^\w+$/.test(t)))throw Error('Unexpected baseline table list');
 mkdirSync('.database-test/backend-apply',{recursive:true});
 const fingerprintPath='.database-test/backend-apply/data-fingerprints.sql';
 const sql=tables.map(t=>`select '${t}' table_name,count(*)::text row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) digest from public."${t}" t`).join(' union all ');
 writeFileSync(fingerprintPath,`select jsonb_agg(x order by table_name) data_fingerprints from (${sql}) x;\n`);
 const fingerprints=await query(fingerprintPath,'data_fingerprints');
 const args=['db','push','--remote='+ref,'--skip-vault','--output-format','json'];
 const plan=await run([...args,'--dry-run']);
 if(plan.dryRun!==true||plan.target?.project_ref!==ref||plan.target?.project_name!==name||!same(plan.migrations,[file])||(plan.seeds||[]).length||(plan.roles||[]).length)throw Error('Dry-run differs from the approved single migration');
 report.dry_run={verified:true,migrations:plan.migrations,seeds:[],roles:[]};manifest();
 report.status='applying';save();console.log('Target, fingerprints, tests and one-migration dry-run verified. Applying approved migration only.');
 const applied=await run([...args,'--yes']);report.apply_completed=true;report.status='verifying';report.apply_result={migrations:applied.migrations||[],success:applied.success??null};save();
 report.history_after=await query('supabase/review/migration-history.sql','migration_history');
 report.after=await query('supabase/review/final-catalogue.sql','catalogue');
 report.postflight=await query('supabase/review/backend-postflight.sql','backend_postflight');
 const afterFingerprints=await query(fingerprintPath,'data_fingerprints');
 report.verification={history:same(report.history_after.map(r=>r.version),[...baseline.local_migrations.map(m=>m.file.slice(0,14)),file.slice(0,14)]),all_existing_data_preserved:same(fingerprints,afterFingerprints),aggregate_counts_preserved:same(report.before.counts,report.after.counts),integrity:Object.values(report.after.integrity).every(n=>n===0),all_constraints_valid:report.after.constraints.every(c=>c.validated),all_indexes_valid:report.after.indexes.every(i=>i.valid&&i.ready)};
 for(const section of ['tables','columns','constraints','indexes','policies','triggers','api_privileges'])report.verification['existing_'+section+'_preserved']=same(report.before[section],report.after[section].filter(x=>(x.table||x.name)!=='rental_offers'));
 for(const section of ['views','api_roles','schema_access'])report.verification[section+'_preserved']=same(report.before[section],report.after[section]);
 const unchanged=report.before.functions.filter(f=>!(f.schema==='public'&&f.name==='owner_check_in'));
 report.verification.existing_other_functions_preserved=unchanged.every(f=>report.after.functions.some(g=>same(f,g)));
 const old=report.before.functions.find(f=>f.schema==='public'&&f.name==='owner_check_in'),moved=report.after.functions.find(f=>f.schema==='private'&&f.name==='check_in_consented');
 report.verification.private_implementation_preserved=old?.body_md5===moved?.body_md5;
 const p=report.postflight;report.verification.postflight=p.tables===32&&p.policies===46&&p.foreign_keys===53&&p.public_functions===30&&p.offer_read_policy===1&&p.offer_rows===0&&p.anonymous_catalogue;
 for(const field of ['rls_disabled','unsafe_definer_paths','public_execute_grants'])report.verification[field+'_zero']=p[field]===0;
 for(const field of ['browser_direct_offer_write','browser_private_checkin','browser_server_payment','browser_server_boost','browser_role_grant','anonymous_property_save','anonymous_base_properties'])report.verification[field+'_denied']=p[field]===false;
 if(Object.values(report.verification).some(v=>v!==true))throw Error('Postflight mismatch; no destructive rollback or automatic retry attempted');
 const final=await run([...args,'--dry-run']);report.no_pending_migrations=!!final.upToDate&&!(final.migrations||[]).length;
 if(!report.no_pending_migrations)throw Error('Final dry-run not up to date');
 report.existing_tables_fingerprinted=tables.length;report.status='verified';report.finished_at=new Date().toISOString();save();
 console.log(JSON.stringify({status:report.status,migrations:report.history_after.length,tables:p.tables,foreign_keys:p.foreign_keys,policies:p.policies,public_functions:p.public_functions,existing_data_preserved:true,pending_migrations:0}));
}catch(error){if(report.steps.length){report.status=report.apply_completed?'verification_failed':report.status==='applying'?'apply_outcome_requires_history_check':'stopped';report.error=error.message;report.finished_at=new Date().toISOString();save();}console.error(error.message);process.exitCode=1;}
