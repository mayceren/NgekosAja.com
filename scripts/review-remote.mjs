import { readFileSync,writeFileSync,mkdirSync,readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// This script has NO apply/reset/seed operation. Remote SQL is always --read-only.
const expectedName='ngekosaja-development';
const cli=resolve('node_modules/supabase/dist/supabase.js');
const reportPath='docs/database/remote-review-results.json';
const scrub=s=>String(s).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[redacted database address]').replace(/\b(?:sbp_|sb_secret_)[A-Za-z0-9_-]+/g,'[redacted credential]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted token]');
function run(args) {
 try {return execFileSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:55000,stdio:['ignore','pipe','pipe']});}
 catch(error) {throw new Error(`CLI ${args.slice(0,3).join(' ')} failed: ${scrub(error.stderr||error.stdout||error.message)}`);}
}
function parse(text) {try{return JSON.parse(text);}catch{throw new Error('CLI response was not JSON; raw output not saved.');}}
function objects(value) {
 if(Array.isArray(value))return value.flatMap(objects);
 if(value&&typeof value==='object')return [value,...Object.values(value).filter(v=>v&&typeof v==='object').flatMap(objects)];
 return [];
}
const mode=process.argv[2]||'identity';
if(!['identity','catalogue','dry-run','config'].includes(mode))throw new Error('Allowed review modes: identity, catalogue, dry-run, config.');
try {
 const ref=readFileSync('supabase/.temp/project-ref','utf8').trim();
 if(!/^[a-z]{20}$/.test(ref))throw new Error('Invalid linked project reference.');
 const cached=JSON.parse(readFileSync('supabase/.temp/linked-project.json','utf8'));
 if(cached.ref!==ref||cached.name!==expectedName)throw new Error('Cached project identity does not match ngekosaja-development; refusing remote command.');
 const projects=parse(run(['projects','list','--output-format','json']));
 const project=objects(projects).find(p=>(p.id===ref||p.ref===ref)&&p.name===expectedName);
 if(!project)throw new Error('Live project list does not confirm the linked reference/name; refusing further remote commands.');
 let report={};try{report=JSON.parse(readFileSync(reportPath,'utf8'));}catch{}
 report.project={name:project.name,ref,region:project.region||null,status:project.status||null,verified_live_at:new Date().toISOString()};
 report.cli_version=run(['--version']).trim();
 report.migrations=readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort().map(file=>({file,sha256:createHash('sha256').update(readFileSync(`supabase/migrations/${file}`)).digest('hex')}));
 report.seeds=[{file:'supabase/seed.sql',sha256:createHash('sha256').update(readFileSync('supabase/seed.sql')).digest('hex')}];
 console.log(JSON.stringify({project:report.project,cli_version:report.cli_version}));
 if(mode==='catalogue') {
  const result=parse(run(['db','query',`--remote=${ref}`,'--read-only','--file','supabase/review/preflight.sql','--output-format','json']));
  const row=objects(result).find(r=>Object.hasOwn(r,'preflight'));
  if(!row)throw new Error(`Cannot locate preflight result; response keys: ${Object.keys(result).join(', ')}`);
  report.catalogue=typeof row.preflight==='string'?JSON.parse(row.preflight):row.preflight;
  report.catalogue_checked_at=new Date().toISOString();
  console.log(JSON.stringify(report.catalogue));
 }
 if(mode==='dry-run') {
  const args=['db','push',`--remote=${ref}`,'--dry-run','--include-seed','--skip-vault','--output-format','json'];
  const output=run(args);
  report.dry_run={command:`npx supabase ${args.join(' ')}`,checked_at:new Date().toISOString(),output:parse(output),applied:false};
  console.log(scrub(output));
 }
 if(mode==='config') {
  const result=parse(run(['config','diff',`--remote=${ref}`,'--output-format','json']));
  const safeValue=(path,value)=> {
   if(value===null||typeof value==='boolean'||typeof value==='number')return value;
   if(path==='api.schemas'&&Array.isArray(value)&&value.every(v=>/^[a-z_]+$/.test(v)))return value;
   if(path==='auth.password_requirements'&&typeof value==='string'&&/^[a-z_]*$/.test(value))return value;
   if(typeof value==='string'&&/^\d+[smhd]$/.test(value))return value;
   return Array.isArray(value)?`[${value.length} values withheld]`:value===''?'[empty]':'[value withheld]';
  };
  const changes=(result.changes||[]).map(c=>{const path=c.path.join('.');return {path,classification:c.class,local:safeValue(path,c.local),remote:safeValue(path,c.remote)};});
  report.config_diff={checked_at:new Date().toISOString(),changes,counts:result.counts,masked_setting_names:(result.masked||[]).map(p=>p.join('.')),unmanaged_setting_names:(result.unmanaged||[]).map(p=>p.join('.')),raw_values_saved:false};
  console.log(JSON.stringify(report.config_diff));
 }
 mkdirSync('docs/database',{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
}catch(error){console.error(scrub(error.message));process.exitCode=1;}
