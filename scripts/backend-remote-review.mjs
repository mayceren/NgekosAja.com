// Read-only Cloud audit and CLI dry run. Never invokes push without --dry-run.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const ref='wfmhsbdfdcugxblqsaob',cli=resolve('node_modules/supabase/dist/supabase.js');
const run=args=>execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000});
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw Error('Target mismatch');
 const projects=objects(JSON.parse(run(['projects','list','--output-format','json'])));
 if(!projects.some(p=>(p.id===ref||p.ref===ref)&&p.name==='ngekosaja-development'))throw Error('Target mismatch');
 const version=run(['--version']).trim();
 const plan=JSON.parse(run(['db','push',`--remote=${ref}`,'--dry-run','--skip-vault','--output-format','json']));
 const pending=plan.migrations||[];
 const file='20261119000200_backend_integration.sql';
 // Compare with a fresh authenticated read-only migration-history query.
 const history=objects(JSON.parse(run(['db','query',`--remote=${ref}`,'--read-only','--file','supabase/review/migration-history.sql','--output-format','json']))).find(x=>Object.hasOwn(x,'migration_history'))?.migration_history;
 const baseline=JSON.parse(readFileSync('docs/database/phase1-completion-verification.json','utf8'));
 const expected=baseline.local_migrations.map(m=>m.file.slice(0,14));
 const applied=Array.isArray(history)&&history.length===13&&history.at(-1).version==='20261119000200';
 if(!Array.isArray(history)||JSON.stringify(history.map(row=>row.version))!==JSON.stringify(applied?[...expected,'20261119000200']:expected))throw Error('Unexpected remote history');
 if(plan.target?.project_ref!==ref||plan.target?.project_name!=='ngekosaja-development'||(plan.seeds||[]).length||(plan.roles||[]).length)throw Error('Unexpected plan target or seed/role operations');
 if(applied?(!plan.upToDate||pending.length):(plan.dryRun!==true||pending.length!==1||pending[0]!==file))throw Error('Unexpected pending migration set');
 let postflight;
 if(applied){
  postflight=objects(JSON.parse(run(['db','query',`--remote=${ref}`,'--read-only','--file','supabase/review/backend-postflight.sql','--output-format','json']))).find(x=>Object.hasOwn(x,'backend_postflight'))?.backend_postflight;
  if(typeof postflight==='string')postflight=JSON.parse(postflight);
  if(!postflight||postflight.tables!==32||postflight.foreign_keys!==53||postflight.policies!==46||postflight.public_functions!==30||postflight.rls_disabled!==0||postflight.unsafe_definer_paths!==0||postflight.public_execute_grants!==0||postflight.offer_read_policy!==1||!postflight.anonymous_catalogue)throw Error('Backend postflight metadata mismatch');
  for(const key of ['browser_direct_offer_write','browser_private_checkin','browser_server_payment','browser_server_boost','browser_role_grant','anonymous_property_save','anonymous_base_properties'])if(postflight[key]!==false)throw Error('Backend privilege mismatch');
 }
 const config=readFileSync('config/runtime.js','utf8');const url=config.match(/https:\/\/[a-z]+\.supabase\.co/)?.[0],key=config.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
 if(!url||!key)throw Error('Public client config missing');
 const response=await fetch(url+'/rest/v1/rpc/public_listings',{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:'{}'});
 if(!response.ok)throw Error('Public catalogue check failed');const listings=await response.json();
 const forbidden=['owner_id','tenant_id','email','phone','room_id','room_number'];
 if(!Array.isArray(listings)||listings.some(row=>forbidden.some(k=>Object.hasOwn(row,k))))throw Error('Unsafe public projection');
 const denied=[];
 if(applied){
  for(const [path,body] of [['properties?select=id&limit=1',null],['rental_offers?select=id&limit=1',null],['rpc/operational_summary',{platform_scope:true}],['rpc/conversation_directory',{}]]){
   const response=await fetch(url+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:key,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
   const error=await response.json().catch(()=>({}));
   if(![401,403].includes(response.status)||error.code!=='42501')throw Error('Anonymous access rejection contract failed');
   denied.push({resource:path.split('?')[0],status:response.status,code:error.code});
  }
 }
 const result={checked_at:new Date().toISOString(),project:'ngekosaja-development',cli_version:version,command:'supabase db push --remote='+ref+' --dry-run --skip-vault --output-format json',stage:applied?'post-apply-read-only':'pre-apply-read-only',remote_schema_changed:false,remote_data_changed:false,applied_migrations:history.length,pending_migrations:pending,migration_sha256:createHash('sha256').update(readFileSync('supabase/migrations/'+file)).digest('hex'),...(postflight?{postflight}:{}),public_catalogue:{anonymous_rpc_verified:true,published_listings:listings.length,forbidden_fields_absent:true},anonymous_access_denied:denied,limitation:'Read-only/anonymous checks do not replace per-user Cloud JWT business mutation tests.'};
 const output=applied?'docs/backend/remote-post-apply-review-results.json':'docs/backend/remote-review-results.json';
 mkdirSync('docs/backend',{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch{console.error('Read-only review incomplete. Raw CLI output and credentials withheld. No migration apply attempted.');process.exitCode=1;}
