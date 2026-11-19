// Read-only recovery/postflight. NO apply/reset/seed/user/Storage mutation command exists.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development',file='20261119000300_realtime_storage.sql';
const sha='876429b3e8d8e5feb9baf0ffbe329634a33792d83a0c044c4936dd2ae1738263';
const cli=resolve('node_modules/supabase/dist/supabase.js');
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const run=args=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000}));
const query=(path,key)=>{const out=run(['db','query','--remote='+ref,'--read-only','--file',path,'--output-format','json']);const value=objects(out).find(x=>Object.hasOwn(x,key))?.[key];if(value===undefined)throw Error('Read-only result missing');return typeof value==='string'?JSON.parse(value):value;};
const report={checked_at:new Date().toISOString(),project:{name,ref},read_only:true,remote_mutations:false,migration:{file,sha256:sha},status:'verifying',checks:{},limitations:['Schema/API read-only verification does not prove authenticated multi-account Realtime/Storage E2E.']};
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref||createHash('sha256').update(readFileSync('supabase/migrations/'+file)).digest('hex')!==sha)throw Error('Target/fingerprint changed');
 if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===ref||p.ref===ref)&&p.name===name&&p.status==='ACTIVE_HEALTHY'))throw Error('Project identity/health mismatch');
 const apply=JSON.parse(readFileSync('docs/phase4/remote-apply-results.json','utf8'));
 if(!apply.apply_completed||apply.approval.sha256!==sha)throw Error('Approved apply evidence missing');
 report.postflight=query('supabase/review/phase4-postflight.sql','phase4_postflight');
 const after=query('supabase/review/final-catalogue.sql','catalogue'),p=report.postflight,before=apply.before;
 const expected=['complaint_histories','complaints','conversation_members','invoices','messages','notifications','properties','rental_agreements','rental_offers','rooms'];
 report.checks={history:same(p.migrations,[...apply.preflight.history,file.slice(0,14)]),schema_counts:p.application_tables===34&&p.foreign_keys===58&&p.policies===48&&p.public_functions===37,
  all_rls:p.rls_disabled===0&&p.storage_objects_rls===true,safe_definers:p.unsafe_definers===0,no_public_execute:p.public_execute_grants===0,valid_constraints_indexes:p.invalid_constraints===0&&p.invalid_indexes===0,
  publication:same(p.published_tables,expected)&&same(p.publication,{insert:true,update:true,delete:false,truncate:false,all_tables:false}),
  private_buckets:p.buckets?.length===5&&p.buckets.every(b=>['property-images','room-images','avatars','complaint-attachments','chat-attachments'].includes(b.id)&&!b.public&&b.limit===(b.id==='avatars'?512000:1048576)&&same(b.mime,['image/jpeg','image/png','image/webp'])),
  storage_policies:p.storage_policies?.length===3&&same(p.storage_policies.map(s=>s.name),['ngekosaja_media_delete','ngekosaja_media_insert','ngekosaja_media_read']),
  capability_grants:p.capabilities_anonymous===true&&p.capabilities_authenticated===true,
  existing_rls_preserved:before.policies.every(policy=>after.policies.some(a=>same(policy,a))),existing_views_preserved:same(before.views,after.views),
  existing_constraints_preserved:before.constraints.every(c=>after.constraints.some(a=>same(c,a))),existing_indexes_preserved:before.indexes.every(c=>after.indexes.some(a=>same(c,a))),existing_triggers_preserved:before.triggers.every(c=>after.triggers.some(a=>same(c,a))),
  existing_counts_preserved:same(before.counts,after.counts),integrity:Object.values(after.integrity).every(n=>n===0)
 };
 for(const key of ['browser_direct_avatar_write','browser_direct_images_write','browser_direct_staging_write','browser_direct_room_images_write','browser_private_property_bypass','browser_private_room_bypass','anon_upload','anon_send_media','anon_avatar_directory','browser_server_payment'])report.checks[key+'_denied']=p[key]===false;
 const unchanged=before.functions.filter(f=>!(f.schema==='public'&&['owner_save_property','owner_save_room','conversation_directory'].includes(f.name)));
 report.checks.existing_other_functions_preserved=unchanged.every(f=>after.functions.some(a=>same(f,a)));
 report.checks.owner_implementations_preserved=['property','room'].every(k=>before.functions.find(f=>f.schema==='public'&&f.name==='owner_save_'+k)?.body_md5===after.functions.find(f=>f.schema==='private'&&f.name==='save_'+k+'_local')?.body_md5);
 report.aggregate_counts={before:before.counts,after:after.counts};report.integrity=after.integrity;
 if(apply.fingerprints_before){const digests=query('.database-test/phase4-apply/data-fingerprints.sql','data_fingerprints');report.checks.existing_row_digests_preserved=same(apply.fingerprints_before,digests);}else{
  report.row_digest_comparison='unavailable: initial apply process did not persist its in-memory before digests before postflight failed';
  report.limitations.push('Before/after aggregate counts and schema preservation are verified. Full row-by-row digest preservation cannot be claimed because the initial before digests were not persisted. Approved migration contains no existing-business/auth row updates.');
 }
 const cfg=readFileSync('config/runtime.js','utf8'),url=cfg.match(/https:\/\/[a-z]+\.supabase\.co/)?.[0],key=cfg.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];if(url!=='https://'+ref+'.supabase.co'||!key)throw Error('Public API configuration mismatch');
 const headers={apikey:key,'content-type':'application/json'};
 const request=async(path,body)=>{const response=await fetch(url+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});return {status:response.status,ok:response.ok,data:await response.json().catch(()=>null)};};
 const cap=await request('/rest/v1/rpc/phase4_capabilities',{});report.capabilities_api={status:cap.status,flags:cap.data};report.checks.capabilities_api=cap.ok&&same(cap.data,{version:4,storage:true,realtime:true,typing:false,presence:false});
 const catalogue=await request('/rest/v1/rpc/public_listings',{});report.public_catalogue={status:catalogue.status,published_listings:Array.isArray(catalogue.data)?catalogue.data.length:null};report.checks.public_catalogue=catalogue.ok&&Array.isArray(catalogue.data)&&catalogue.data.every(row=>!['owner_id','tenant_id','email','phone','room_id','room_number'].some(k=>Object.hasOwn(row,k)));
 report.anonymous_denials=[];
 for(const [path,body]of [['/rest/v1/media_uploads?select=id&limit=1',null],['/rest/v1/room_images?select=id&limit=1',null],['/rest/v1/rpc/conversation_avatars',{target_conversation:'00000000-0000-4000-8000-000000000001'}],['/rest/v1/rpc/begin_media_upload',{media_kind:'avatar',target_scope:'00000000-0000-4000-8000-000000000001',file_mime:'image/webp',file_size:100}],['/rest/v1/rpc/send_message_media',{target_conversation:'00000000-0000-4000-8000-000000000001',message_body:'',request_key:'00000000-0000-4000-8000-000000000002',upload_ids:[]}]] ){
  const res=await request(path,body);report.anonymous_denials.push({resource:path.split('?')[0],status:res.status,code:res.data?.code,denied:[401,403].includes(res.status)&&res.data?.code==='42501'});
 }
 report.checks.anonymous_private_apis_denied=report.anonymous_denials.every(r=>r.denied);
 const plan=run(['db','push','--remote='+ref,'--dry-run','--skip-vault','--output-format','json']);report.checks.no_pending_migrations=!!plan.upToDate&&!(plan.migrations||[]).length;report.pending_migrations=plan.migrations||[];
 if(Object.values(report.checks).some(v=>v!==true))throw Error('Read-only postflight verification mismatch');report.status='verified';
}catch{report.status='verification_incomplete';report.error='Read-only verification failed; raw CLI/network output withheld. No mutation or retry of apply attempted.';process.exitCode=1;}
report.finished_at=new Date().toISOString();writeFileSync('docs/phase4/cloud-postflight-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,migrations:report.postflight?.migrations?.length,tables:report.postflight?.application_tables,private_buckets:report.postflight?.buckets?.length,published_tables:report.postflight?.published_tables?.length,checks:report.checks,limitations:report.limitations}));
