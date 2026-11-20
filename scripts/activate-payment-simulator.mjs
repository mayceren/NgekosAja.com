// Executes the user's explicit approval for this exact reviewed migration/functions/config.
// Never creates accounts/fixtures, sends email, resets databases, or prints raw CLI/secret output.
import {readFileSync,readdirSync,writeFileSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development',migration='20261120000100_internal_payment_simulator.sql';
const sha='d2cd2c4e11dded89408a46ec86471c7f43663fc6270f4ed3f515f4396044f4b5',cli=resolve('node_modules/supabase/dist/supabase.js');
const output='docs/payment/cloud-activation-results.json',folder='.database-test/payment-activation',envPath=folder+'/activation.env';
const source={
 'supabase/functions/simulate-rent-payment/index.ts':'e44b849ebbdc6e62722075a5a5bae63179ed64f14e16256e591e86366a202885',
 'supabase/functions/simulate-boost-payment/index.ts':'4d18491704a0ffe82b1914b089a63d27950dba8ebda67abecf9f51c76f4a5aa8',
 'supabase/functions/_shared/runtime.ts':'a623aacff02c5e91323d5faf063da957f685a33fffff0dcf49599c7db210f69e',
 'supabase/functions/_shared/simulator.mjs':'0f72b44801e4992d69e3290265166744405ee427df93cf1750fb040d9386db30'
};
const env={PAYMENT_SIMULATOR_ENABLED:'true',PAYMENT_ENVIRONMENT:'development',PAYMENT_ALLOWED_PROJECT_REF:ref,PAYMENT_ALLOWED_ORIGINS:'http://127.0.0.1:5500,http://localhost:5500'};
const functions=['simulate-rent-payment','simulate-boost-payment'];
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
let stage='manifest',started=false;
const report={started_at:new Date().toISOString(),project:{name,ref},approval:{message:'ya',scope:'one migration, two Edge Functions, development-only server and DB activation',migration_sha256:sha},status:'preflight',steps:[],business_writes_requested:false,accounts_changed:false,emails_sent:false,reset:false};
const save=()=>{if(started)writeFileSync(output,JSON.stringify(report,null,2)+'\n');};
const run=args=>{
 let out;try{out=execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000,windowsHide:true});report.steps.push({stage,finished_at:new Date().toISOString(),success:true});save();}
 catch(e){report.steps.push({stage,finished_at:new Date().toISOString(),success:false,error_code:e.code==='ETIMEDOUT'?'CLI_TIMEOUT':'CLI_FAILED'});save();throw Error(e.code==='ETIMEDOUT'?'CLI_TIMEOUT':'CLI_FAILED');}
 try{return JSON.parse(out);}catch{throw Error('CLI_RESPONSE_INVALID');}
};
const query=(path,key,readOnly=true)=>{
 const args=['db','query','--remote='+ref,...(readOnly?['--read-only']:['--yes']),'--file',path,'--output-format','json'];
 const data=run(args),value=objects(data).find(o=>Object.hasOwn(o,key))?.[key];if(value===undefined)throw Error('QUERY_RESULT_MISSING');return typeof value==='string'?JSON.parse(value):value;
};
function verifyManifest(){
 if(process.argv.length!==3||process.argv[2]!=='--approved-sha256='+sha)throw Error('APPROVED_FINGERPRINT_REQUIRED');
 const plan=JSON.parse(readFileSync('docs/payment/revision-remote-review-results.json','utf8')),local=JSON.parse(readFileSync('docs/payment/local-verification-results.json','utf8'));
 if(!plan.success||!plan.dry_run?.dryRun||plan.project.ref!==ref||plan.project.name!==name||!same(plan.dry_run.migrations,[migration])||!same(plan.expected_pending,[{file:migration,sha256:sha}])||!local.success||local.migration.sha256!==sha)throw Error('REVIEW_MISMATCH');
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref||JSON.parse(readFileSync('node_modules/supabase/package.json','utf8')).version!=='3.2.0')throw Error('LOCAL_TARGET_MISMATCH');
 if(!same(readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort(),plan.local_migrations.map(m=>m.file).sort()))throw Error('MIGRATION_LIST_CHANGED');
 for(const m of plan.local_migrations)if(hash('supabase/migrations/'+m.file)!==m.sha256)throw Error('MIGRATION_HASH_CHANGED');
 if(hash('supabase/migrations/'+migration)!==sha)throw Error('APPROVED_MIGRATION_CHANGED');
 for(const [file,digest]of Object.entries(source))if(hash(file)!==digest)throw Error('APPROVED_SOURCE_CHANGED');
 const config=readFileSync('supabase/config.toml','utf8');for(const f of functions)if(!new RegExp('\\[functions\\.'+f+'\\]\\s*verify_jwt\\s*=\\s*true').test(config))throw Error('JWT_CONFIGURATION_CHANGED');
}
// CLI 3.2 uses `value` for the SHA256 digest; it does not return the secret itself.
const secretMetadata=out=>objects(out).filter(o=>typeof o.name==='string'&&/^[a-f0-9]{64}$/i.test(o.digest||o.value||'')).map(o=>({name:o.name,digest:(o.digest||o.value).toLowerCase()})).sort((a,b)=>a.name.localeCompare(b.name));
const functionMetadata=out=>objects(out).filter(o=>typeof o.slug==='string'&&typeof o.status==='string').map(o=>({slug:o.slug,id:o.id,status:o.status,version:o.version,verify_jwt:o.verify_jwt})).sort((a,b)=>a.slug.localeCompare(b.slug));
try{
 if(existsSync(output))throw Error('ACTIVATION_REPORT_EXISTS_INSPECT_DO_NOT_REPEAT');verifyManifest();mkdirSync('docs/payment',{recursive:true});mkdirSync(folder,{recursive:true});started=true;save();
 stage='target';if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===ref||p.ref===ref)&&p.name===name&&p.status==='ACTIVE_HEALTHY'))throw Error('LIVE_TARGET_MISMATCH');
 stage='preflight';const pre=report.preflight=query('supabase/review/phase5-preflight.sql','phase5_preflight');
 if(pre.history.length!==14||pre.history.at(-1)!=='20261119000300'||pre.tables!==34||pre.foreign_keys!==58||pre.policies!==48||pre.public_functions!==37||pre.rls_disabled||pre.browser_rent_writer||pre.browser_boost_writer)throw Error('BASELINE_MISMATCH');
 const catalogue=query('supabase/review/final-catalogue.sql','catalogue'),tables=catalogue.tables.filter(t=>t.schema==='public').map(t=>t.name).sort();if(tables.length!==34||tables.some(t=>!/^\w+$/.test(t)))throw Error('TABLE_BASELINE_MISMATCH');
 const fingerprintPath=folder+'/data-fingerprints.sql';
 const fingerprints=tables.map(t=>`select '${t}' table_name,count(*)::text row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) digest from public."${t}" t`).concat(["select 'auth.users' table_name,count(*)::text row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) digest from auth.users t","select 'storage.objects' table_name,count(*)::text row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) digest from storage.objects t"]);
 writeFileSync(fingerprintPath,'select jsonb_agg(x order by table_name) data_fingerprints from ('+fingerprints.join(' union all ')+') x;\n');
 const before=report.fingerprints_before=query(fingerprintPath,'data_fingerprints');
 const previousFunctions=functionMetadata(run(['functions','list','--remote='+ref,'--output-format','json']));report.previous_functions=previousFunctions;
 if(previousFunctions.some(f=>functions.includes(f.slug)))throw Error('FUNCTION_ALREADY_EXISTS_INSPECT_FIRST');
 const previousSecrets=secretMetadata(run(['secrets','list','--remote='+ref,'--output-format','json']));
 stage='final-dry-run';const args=['db','push','--remote='+ref,'--skip-vault','--output-format','json'],dry=run([...args,'--dry-run']);
 if(!dry.dryRun||dry.target?.project_ref!==ref||dry.target?.project_name!==name||!same(dry.migrations,[migration])||(dry.seeds||[]).length||(dry.roles||[]).length)throw Error('FINAL_DRY_RUN_MISMATCH');report.dry_run={verified:true,target:dry.target,migrations:dry.migrations,seeds:[],roles:[]};verifyManifest();save();
 stage='migration-apply';report.status='applying';save();const applied=run([...args,'--yes']);report.migration_applied=true;report.apply_result={migrations:applied.migrations||[],target:applied.target};save();
 stage='postflight-disabled';const post=report.postflight_before_activation=query('supabase/review/phase5-postflight.sql','phase5_postflight');
 const expectedTables=[...pre.published_tables,'payment_attempts','transactions','boost_campaigns'].sort();
 const valid=p=>same(p.history,[...pre.history,'20261120000100'])&&p.tables===35&&p.foreign_keys===62&&p.policies===49&&p.public_functions===40&&p.rls_disabled===0&&p.unsafe_definers===0&&p.invalid_constraints===0&&p.invalid_indexes===0&&!p.browser_attempt_write&&!p.browser_config_read&&p.server_functions.length===3&&p.server_functions.every(f=>!f.browser&&!f.anon&&f.service)&&same(p.published_tables,expectedTables)&&same(p.publication,{insert:true,update:true,delete:false,truncate:false});
 if(!valid(post)||post.simulator_enabled)throw Error('POSTFLIGHT_MISMATCH');
 const afterCatalogue=query('supabase/review/final-catalogue.sql','catalogue');
 report.previous_policies_preserved=catalogue.policies.every(p=>afterCatalogue.policies.some(a=>same(p,a)));report.previous_views_preserved=same(catalogue.views,afterCatalogue.views);
 if(!report.previous_policies_preserved||!report.previous_views_preserved)throw Error('EXISTING_METADATA_CHANGED');
 if(!same(before,query(fingerprintPath,'data_fingerprints')))throw Error('EXISTING_DATA_CHANGED');
 stage='deploy-two-functions';report.status='deploying';save();run(['functions','deploy',...functions,'--remote='+ref,'--use-api','--yes','--output-format','json']);report.functions_deployed=true;save();
 const deployed=functionMetadata(run(['functions','list','--remote='+ref,'--output-format','json']));report.deployed_functions=deployed.filter(f=>functions.includes(f.slug));
 if(report.deployed_functions.length!==2||report.deployed_functions.some(f=>f.status!=='ACTIVE'||f.verify_jwt!==true)||!same(deployed.filter(f=>!functions.includes(f.slug)),previousFunctions))throw Error('FUNCTION_VERIFICATION_FAILED');
 stage='configure-edge';writeFileSync(envPath,Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n');run(['secrets','set','--env-file',envPath,'--remote='+ref,'--yes','--output-format','json']);report.edge_environment_configured=true;save();
 const secrets=secretMetadata(run(['secrets','list','--remote='+ref,'--output-format','json']));
 report.configured_names=Object.keys(env);report.configuration_digests_match=Object.entries(env).every(([k,v])=>secrets.some(s=>s.name===k&&s.digest.toLowerCase()===createHash('sha256').update(v).digest('hex')));
 report.unrelated_secrets_preserved=previousSecrets.filter(s=>!Object.hasOwn(env,s.name)).every(s=>secrets.some(a=>same(a,s)));
 if(!report.configuration_digests_match||!report.unrelated_secrets_preserved)throw Error('SERVER_CONFIGURATION_VERIFICATION_FAILED');
 stage='enable-db-switch';const enablePath=folder+'/enable-simulator.sql';writeFileSync(enablePath,"begin; do $$ begin if not exists(select 1 from supabase_migrations.schema_migrations where version='20261120000100') then raise exception 'Migration missing';end if; if (select count(*) from private.payment_simulator_settings where singleton and environment='development' and project_ref='"+ref+"')<>1 then raise exception 'Target settings mismatch';end if;end $$; update private.payment_simulator_settings set enabled=true where singleton and environment='development' and project_ref='"+ref+"'; commit; select jsonb_build_object('enabled',enabled,'environment',environment,'project_ref',project_ref) simulator_configuration from private.payment_simulator_settings where singleton;\n");
 const setting=report.database_switch=query(enablePath,'simulator_configuration',false);if(!setting.enabled||setting.environment!=='development'||setting.project_ref!==ref)throw Error('DB_ACTIVATION_NOT_VERIFIED');report.database_enabled=true;save();
 stage='postflight-active';const final=report.postflight=query('supabase/review/phase5-postflight.sql','phase5_postflight');if(!valid(final)||!final.simulator_enabled)throw Error('FINAL_POSTFLIGHT_FAILED');
 const after=query(fingerprintPath,'data_fingerprints');report.all_existing_data_preserved=same(before,after);report.preservation=before.map(b=>({table:b.table_name,rows:b.row_count,preserved:same(b,after.find(a=>a.table_name===b.table_name))}));if(!report.all_existing_data_preserved)throw Error('EXISTING_DATA_CHANGED');
 stage='final-dry-run';const last=run([...args,'--dry-run']);report.no_pending_migrations=!!last.upToDate&&!(last.migrations||[]).length;if(!report.no_pending_migrations)throw Error('PENDING_MIGRATIONS_REMAIN');
 stage='http-read-only-smoke';const runtime=readFileSync('config/runtime.js','utf8'),key=runtime.match(/"publishableKey"\s*:\s*"([^"]+)"/)?.[1];if(!key)throw Error('PUBLIC_CONFIGURATION_MISSING');
 const headers={apikey:key,'Content-Type':'application/json'},base=`https://${ref}.supabase.co`;
 const http=async(path,opts)=>{const r=await fetch(base+path,{...opts,signal:AbortSignal.timeout(12000)});return {status:r.status,data:await r.json().catch(()=>null),headers:r.headers};};
 const capability=await http('/rest/v1/rpc/payment_capabilities',{method:'POST',headers,body:'{}'});report.public_capability=capability.data;if(capability.status!==200||capability.data?.enabled!==true||capability.data?.provider!=='internal-simulator')throw Error('CAPABILITY_HTTP_FAILED');
 report.http_denials=[];for(const f of functions){const denied=await http('/functions/v1/'+f,{method:'POST',headers,body:JSON.stringify({[f.includes('rent')?'invoice_id':'property_id']:randomUUID(),method:'qris',idempotency_key:randomUUID()})});report.http_denials.push({function:f,unauthenticated_status:denied.status});if(![401,403].includes(denied.status))throw Error('UNAUTHENTICATED_ENDPOINT_NOT_DENIED');}
 const browserWriter=await http('/rest/v1/rpc/server_simulate_payment',{method:'POST',headers,body:JSON.stringify({actor:null,payment_kind:'rent',resource_id:randomUUID(),simulated_method:'qris',request_key:randomUUID()})});report.anonymous_writer_status=browserWriter.status;if(![401,403,404].includes(browserWriter.status))throw Error('ANONYMOUS_WRITER_NOT_DENIED');
 report.status='verified-active-development-only';report.limitations=['No authenticated Cloud payment transaction, account login, or new QA fixture was performed.','Real-JWT multi-account/Realtime and receipt E2E remain separate testing work.'];report.finished_at=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,history:final.history.length,tables:final.tables,functions:report.deployed_functions.map(f=>f.slug),existing_data_preserved:true,pending_migrations:0,cloud_payment_e2e:false,report:output}));
}catch(error){if(started){report.status='stopped-inspect-before-any-retry';report.failed_stage=stage;report.error_code=error.message;report.finished_at=new Date().toISOString();save();}console.error(JSON.stringify({status:report.status,stage,error_code:error.message,report:started?output:null,raw_output_withheld:true}));process.exitCode=1;}
finally{if(existsSync(envPath))unlinkSync(envPath);}
