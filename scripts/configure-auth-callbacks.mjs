import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development',cli=resolve('node_modules/supabase/dist/supabase.js');
const dir=resolve('.database-test/auth-callback-config'),reportFile='docs/auth/callback-config-results.json';
const run=args=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:55000,stdio:['ignore','pipe','pipe']}));
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const pathOf=c=>c.path.join('.');
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw Error('target');
 if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===ref||p.ref===ref)&&p.name===name))throw Error('identity');
 const original=run(['config','diff',`--remote=${ref}`,'--output-format','json']);
 const redirects=original.changes.find(c=>pathOf(c)==='auth.additional_redirect_urls');
 // If no diff is returned, local URLs already equal hosted configuration.
 const existing=redirects?.remote||['http://localhost:5500'];
 if(!Array.isArray(existing)||!existing.every(v=>typeof v==='string'))throw Error('redirect configuration shape');
 const required=['http://127.0.0.1:5500','http://localhost:5500'].flatMap(origin=>['verify','recovery','email-change'].map(flow=>`${origin}/index.html?auth_flow=${flow}`));
 const allowed=[...new Set([...existing,...required])];
 mkdirSync(dir+'/supabase',{recursive:true});mkdirSync('docs/auth',{recursive:true});
 const aligned={'auth.additional_redirect_urls':allowed};
 const preserve=new Set(['auth.email.enable_confirmations','auth.email.max_frequency','auth.email.otp_length','auth.mfa.totp.enroll_enabled','auth.mfa.totp.verify_enabled','auth.site_url','auth.sms.enable_confirmations','db.pooler.default_pool_size','db.pooler.max_client_conn','storage.vector.enabled']);
 const writeConfig=()=>{
  const sections={};for(const [key,value] of Object.entries(aligned)){const parts=key.split('.'),leaf=parts.pop(),section=parts.join('.');(sections[section]||=[]).push(`${leaf} = ${JSON.stringify(value)}`);}
  writeFileSync(dir+'/supabase/config.toml','project_id = "ngekosaja-auth-callbacks"\n'+Object.entries(sections).map(([section,lines])=>`[${section}]\n${lines.join('\n')}`).join('\n')+'\n');
 };
 writeConfig();
 const args=[`--remote=${ref}`,'--workdir',dir,'--output-format','json'];
 let diff=run(['config','diff',...args]);
 // CLI 3.2.0 materializes some defaults even for a sparse file. Align these to
 // their live values first; never push that initial diff or downgrade security.
 for(const c of diff.changes.filter(c=>pathOf(c)!=='auth.additional_redirect_urls')){
  if(!preserve.has(pathOf(c))||c.remote===null||c.remote===undefined)throw Error('unexpected default; manual review required');
  aligned[pathOf(c)]=c.remote;
 }
 writeConfig();diff=run(['config','diff',...args]);
 if(diff.changes.some(c=>pathOf(c)!=='auth.additional_redirect_urls'))throw Error('configuration includes unexpected settings after alignment');
 const report={checked_at:new Date().toISOString(),project:{name,ref},scope:'Append six exact development callbacks only; preserve all other hosted settings.',before:existing,after:allowed,changes:diff.changes.map(c=>({path:pathOf(c),classification:c.class})),default_alignment_paths:Object.keys(aligned).filter(k=>k!=='auth.additional_redirect_urls'),applied:false};
 if(diff.changes.length){
  if(!process.argv.includes('--apply')){writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');console.log('One allowlist change prepared. Use --apply within authorized Phase 2 scope.');process.exit(0);}
  const result=run(['config','push',...args,'--yes']);report.applied=true;report.result_summary={completed:true};
 }
 const after=run(['config','diff',...args]);if(after.changes.length)throw Error('callback verification did not converge');
 report.verified=true;report.finished_at=new Date().toISOString();writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({callback_urls:allowed.length,only_allowlist_changed:true,applied:report.applied,verified:true}));
}catch{console.error('Callback configuration stopped safely. No raw configuration or credential printed; review sparse config before retrying.');process.exitCode=1;}
