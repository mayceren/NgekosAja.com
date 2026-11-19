// One approved migration only. Never resets, seeds, changes accounts, or logs raw CLI output.
import {readFileSync,readdirSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development';
const file='20261119000300_realtime_storage.sql',sha='876429b3e8d8e5feb9baf0ffbe329634a33792d83a0c044c4936dd2ae1738263';
const output='docs/phase4/remote-apply-results.json',cli=resolve('node_modules/supabase/dist/supabase.js');
const approved=JSON.parse(readFileSync('docs/phase4/migration-plan.json','utf8'));
const report={project:{name,ref},approval:{message:'setuju',scope:file,sha256:sha,recorded_at:new Date().toISOString()},status:'preflight',steps:[]};
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
function manifest(){
 if(process.argv.length!==3||process.argv[2]!=='--approved-sha256='+sha)throw Error('Exact approved fingerprint required');
 if(approved.project!==name||approved.ref!==ref||approved.cli_version!=='3.2.0'||readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref||!same(approved.pending,[{file,sha256:sha}]))throw Error('Approved target/plan mismatch');
 if(JSON.parse(readFileSync('node_modules/supabase/package.json','utf8')).version!=='3.2.0')throw Error('CLI version changed');
 const items=[...approved.applied_files,{file,sha256:sha}];
 if(!same(readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort(),items.map(m=>m.file).sort()))throw Error('Unexpected migration file list');
 for(const m of items)if(createHash('sha256').update(readFileSync('supabase/migrations/'+m.file)).digest('hex')!==m.sha256)throw Error('Migration fingerprint changed');
 const local=JSON.parse(readFileSync('docs/phase4/local-verification-results.json','utf8'));
 if(!local.success||local.migration.sha256!==sha)throw Error('Reviewed local verification missing');
 for(const path of ['tests/phase4-upgrade-results.json','tests/phase4-fresh-results.json']){const r=JSON.parse(readFileSync(path,'utf8'));if(r.failed.length||r.migrations.at(-1)!==file)throw Error('Required SQL evidence missing');}
}
async function run(args){
 const result=await new Promise((done,reject)=>{
  const child=spawn(process.execPath,[cli,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='';
  const timer=setTimeout(()=>{child.kill();reject(Error('CLI timeout; inspect history before retry'));},55000);
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',()=>{});
  child.on('error',()=>{clearTimeout(timer);reject(Error('CLI could not start'));});
  child.on('close',code=>{clearTimeout(timer);done({code,stdout});});
 });
 report.steps.push({command:'supabase '+args.join(' '),finished_at:new Date().toISOString(),exit_code:result.code});save();
 if(result.code!==0)throw Error('CLI operation failed; raw output withheld. No automatic retry or reset.');
 try{return JSON.parse(result.stdout);}catch{throw Error('Structured CLI response missing; inspect history before retry');}
}
async function query(path,key){const data=await run(['db','query','--remote='+ref,'--read-only','--file',path,'--output-format','json']);const value=objects(data).find(x=>Object.hasOwn(x,key))?.[key];if(value===undefined)throw Error('Missing read-only result');return typeof value==='string'?JSON.parse(value):value;}
try{
 if(existsSync(output))throw Error('Apply report already exists; use read-only verification instead of repeating apply');
 manifest();
 const projects=await run(['projects','list','--output-format','json']);if(!objects(projects).some(p=>(p.id===ref||p.ref===ref)&&p.name===name&&p.status==='ACTIVE_HEALTHY'))throw Error('Live project identity/health mismatch');
 report.preflight=await query('supabase/review/phase4-preflight.sql','phase4_preflight');
 const pre=report.preflight;
 if(!same(pre.history,approved.applied_files.map(m=>m.file.slice(0,14)))||pre.application_tables!==32||pre.foreign_keys!==53||pre.policies!==46||pre.public_functions!==30||pre.rls_disabled||pre.buckets.length||pre.storage_policies.length||pre.published_tables.length)throw Error('Remote schema differs from reviewed baseline');
 report.before=await query('supabase/review/final-catalogue.sql','catalogue');
 const tables=report.before.tables.filter(t=>t.schema==='public').map(t=>t.name).sort();
 if(tables.length!==32||tables.some(t=>!/^\w+$/.test(t)))throw Error('Unexpected baseline table list');
 mkdirSync('.database-test/phase4-apply',{recursive:true});
 const fingerprintPath='.database-test/phase4-apply/data-fingerprints.sql';
 const sql=tables.map(t=>`select '${t}' table_name,count(*)::text row_count,md5(coalesce(string_agg(md5((to_jsonb(t)-'avatar_path'-'client_key')::text),'' order by t.id),'')) digest from public."${t}" t`).concat([
  "select 'auth.users' table_name,count(*)::text row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) digest from auth.users t",
  "select 'storage.objects' table_name,count(*)::text row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) digest from storage.objects t"
 ]).join(' union all ');
 writeFileSync(fingerprintPath,`select jsonb_agg(x order by table_name) data_fingerprints from (${sql}) x;\n`);
 const before=await query(fingerprintPath,'data_fingerprints');
 report.fingerprints_before=before;save();
 const args=['db','push','--remote='+ref,'--skip-vault','--output-format','json'];
 const plan=await run([...args,'--dry-run']);
 if(plan.dryRun!==true||plan.target?.project_ref!==ref||plan.target?.project_name!==name||!same(plan.migrations,[file])||(plan.seeds||[]).length||(plan.roles||[]).length)throw Error('Dry-run differs from approved single migration');
 report.dry_run={verified:true,migrations:plan.migrations,seeds:[],roles:[]};manifest();
 report.status='applying';save();console.log('Verified approved hash, target, baseline and dry-run. Applying one Phase 4 migration.');
 const applied=await run([...args,'--yes']);report.apply_completed=true;report.status='verifying';report.apply_result={migrations:applied.migrations||[],success:applied.success??null};save();
 report.postflight=await query('supabase/review/phase4-postflight.sql','phase4_postflight');
 report.after=await query('supabase/review/final-catalogue.sql','catalogue');
 const after=await query(fingerprintPath,'data_fingerprints');
 const p=report.postflight,expectedTables=['complaint_histories','complaints','conversation_members','invoices','messages','notifications','properties','rental_agreements','rental_offers','rooms'];
 report.verification={
  history:same(p.migrations,[...pre.history,file.slice(0,14)]),schema_counts:p.application_tables===34&&p.foreign_keys===58&&p.policies===48&&p.public_functions===37,
  all_existing_data_preserved:same(before,after),existing_tables_fingerprinted:tables.length===32,
  all_rls:p.rls_disabled===0&&p.storage_objects_rls===true,safe_definers:p.unsafe_definers===0,no_public_execute:p.public_execute_grants===0,
  constraints_indexes_valid:p.invalid_constraints===0&&p.invalid_indexes===0,
  publication:same(p.published_tables,expectedTables)&&same(p.publication,{insert:true,update:true,delete:false,truncate:false,all_tables:false}),
  buckets:p.buckets?.length===5&&p.buckets.every(b=>['property-images','room-images','avatars','complaint-attachments','chat-attachments'].includes(b.id)&&!b.public&&b.limit===(b.id==='avatars'?512000:1048576)&&same(b.mime,['image/jpeg','image/png','image/webp'])),
  storage_policies:p.storage_policies?.length===3&&same(p.storage_policies.map(s=>s.name),['ngekosaja_media_delete','ngekosaja_media_insert','ngekosaja_media_read']),
  capability_grants:p.capabilities_anonymous===true&&p.capabilities_authenticated===true,
  previous_rls_preserved:report.before.policies.every(policy=>report.after.policies.some(after=>same(policy,after))),
  financial_views_preserved:same(report.before.views,report.after.views)
 };
 for(const field of ['browser_direct_avatar_write','browser_direct_images_write','browser_direct_staging_write','browser_direct_room_images_write','browser_private_property_bypass','browser_private_room_bypass','anon_upload','anon_send_media','anon_avatar_directory','browser_server_payment'])report.verification[field+'_denied']=p[field]===false;
 report.preservation=before.map(b=>({table:b.table_name,rows:b.row_count,preserved:same(b,after.find(a=>a.table_name===b.table_name))}));
 if(Object.values(report.verification).some(v=>v!==true))throw Error('Postflight mismatch; no destructive rollback or automatic retry attempted');
 const final=await run([...args,'--dry-run']);report.no_pending_migrations=!!final.upToDate&&!(final.migrations||[]).length;if(!report.no_pending_migrations)throw Error('Final dry-run is not up to date');
 report.status='verified';report.finished_at=new Date().toISOString();save();
 console.log(JSON.stringify({status:report.status,migrations:p.migrations.length,tables:p.application_tables,private_buckets:p.buckets.length,published_tables:p.published_tables.length,all_existing_data_preserved:true,pending_migrations:0}));
}catch(error){if(report.steps.length){report.status=report.apply_completed?'verification_failed':report.status==='applying'?'apply_outcome_requires_history_check':'stopped';report.error=error.message;report.finished_at=new Date().toISOString();save();}console.error(error.message);process.exitCode=1;}
