import { readFileSync,writeFileSync,readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Inspection only. There is deliberately no apply, reset, seed or config-push mode.
const expected={name:'ngekosaja-development',ref:'wfmhsbdfdcugxblqsaob'};
const cli=resolve('node_modules/supabase/dist/supabase.js');
const completed=process.argv.includes('--completed');
const scrub=s=>String(s).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[redacted database address]').replace(/\b(?:sbp_|sb_secret_)[A-Za-z0-9_-]+/g,'[redacted credential]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted token]');
function run(args) {
 try{return execFileSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:55000,stdio:['ignore','pipe','pipe']});}
 catch(e){throw new Error(`Read-only CLI ${args.slice(0,2).join(' ')} failed: ${scrub(e.stderr||e.stdout||e.message)}`);}
}
const parse=s=>JSON.parse(s);
function objects(v) {return Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];}
function query(file,key) {
 const data=parse(run(['db','query',`--remote=${expected.ref}`,'--read-only','--file',file,'--output-format','json']));
 const row=objects(data).find(x=>Object.hasOwn(x,key));
 if(!row)throw new Error(`Missing ${key} in metadata response.`);
 return typeof row[key]==='string'?parse(row[key]):row[key];
}
const stable=v=>JSON.stringify(v);
try {
 const ref=readFileSync('supabase/.temp/project-ref','utf8').trim();
 const cache=parse(readFileSync('supabase/.temp/linked-project.json','utf8'));
 if(ref!==expected.ref||cache.ref!==ref||cache.name!==expected.name)throw new Error('Linked project does not match the approved development project.');
 const project=objects(parse(run(['projects','list','--output-format','json']))).find(p=>(p.id===ref||p.ref===ref)&&p.name===expected.name);
 if(!project)throw new Error('Live project identity could not be confirmed.');
 const version=run(['--version']).trim();
 if(version!=='3.2.0')throw new Error('Recheck read-only/dry-run syntax for the newly installed CLI version.');
 let approved=parse(readFileSync('docs/database/remote-apply-results.json','utf8')).approved_migrations;
 if(completed){
  const correction=parse(readFileSync('docs/database/remote-fixes-apply-results.json','utf8'));
  if(!correction.apply_completed)throw new Error('Correction has not been applied; use baseline verification.');
  approved=[...approved,...correction.approved_migrations];
 }
 const migrations=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().map(file=>({file,sha256:createHash('sha256').update(readFileSync(`supabase/migrations/${file}`)).digest('hex')}));
 for(const old of approved)if(!migrations.some(m=>m.file===old.file&&m.sha256===old.sha256))throw new Error(`Applied migration was changed or removed: ${old.file}`);
 const report={checked_at:new Date().toISOString(),comparison_target:completed?'all-12-applied-migrations':'11-migration-baseline',project:{...expected,status:project.status,region:project.region},cli_version:version,remote_mutations:false,applied_migration_hashes_unchanged:true,local_migrations:migrations};
 console.log(`Verified live project: ${project.name}; reading migration history and catalogue.`);
 report.history=query('supabase/review/migration-history.sql','migration_history');
 report.postflight=query('supabase/review/postflight.sql','postflight');
 report.structure=query('supabase/review/structure.sql','structure');
 report.catalogue=query('supabase/review/final-catalogue.sql','catalogue');
 const local=parse(readFileSync(completed?'tests/database-candidate-catalogue.json':'tests/database-baseline-catalogue.json','utf8'));
 report.baseline_comparison={};
 for(const section of ['tables','columns','constraints','indexes','policies','functions','triggers','views','api_privileges','api_roles','schema_access']) {
  const expectedRows=local[section],actualRows=report.catalogue[section];
  // Sort keys recursively: jsonb from Cloud may serialize object keys in a different order.
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const differences=[];
  for(let i=0;i<Math.max(expectedRows.length,actualRows.length);i++)if(stable(canonical(expectedRows[i]))!==stable(canonical(actualRows[i])))differences.push({local:expectedRows[i]||null,remote:actualRows[i]||null});
  report.baseline_comparison[section]={local_count:expectedRows.length,remote_count:actualRows.length,match:differences.length===0,differences};
 }
 // Generated SELECT counts quote identifiers through PostgreSQL format(%I), never row values.
 const fkSql=report.catalogue.fk_checks.map(c=>c.sql).join('\nunion all\n');
 writeFileSync('supabase/review/final-orphans.sql',`-- Generated read-only counts for all application foreign keys.\nselect coalesce(jsonb_agg(row_to_json(checks) order by constraint_name),'[]'::jsonb) as fk_orphans from (\n${fkSql}\n) checks;\n`);
 report.foreign_key_orphans=query('supabase/review/final-orphans.sql','fk_orphans');
 const config=parse(run(['config','diff',`--remote=${ref}`,'--output-format','json']));
 const safeValue=(path,value)=>{
  if(value===null||typeof value==='boolean'||typeof value==='number')return value;
  if(path==='api.schemas'&&Array.isArray(value)&&value.every(v=>/^[a-z_]+$/.test(v)))return value;
  if(path==='auth.password_requirements'&&typeof value==='string'&&/^[a-z_]*$/.test(value))return value;
  if(typeof value==='string'&&/^\d+[smhd]$/.test(value))return value;
  return Array.isArray(value)?`[${value.length} values withheld]`:value===''?'[empty]':'[value withheld]';
 };
 report.config_diff={counts:config.counts,changes:(config.changes||[]).map(c=>{const path=c.path.join('.');return {path,classification:c.class,local:safeValue(path,c.local),remote:safeValue(path,c.remote)};}),masked_setting_names:(config.masked||[]).map(p=>p.join('.')),unmanaged_setting_names:(config.unmanaged||[]).map(p=>p.join('.')),raw_values_saved:false};
 report.history_matches_approved=stable(report.history.map(h=>({version:h.version,name:h.name})))===stable(approved.map(m=>({version:m.file.slice(0,14),name:m.file.slice(15,-4)})));
 report.pending_local=migrations.filter(m=>!report.history.some(h=>h.version===m.file.slice(0,14)));
 const args=['db','push',`--remote=${ref}`,'--dry-run','--skip-vault','--output-format','json'];
 report.dry_run={command:`npx supabase ${args.join(' ')}`,result:parse(run(args)),applied:false};
 report.completed_at=new Date().toISOString();
 report.verified=report.history_matches_approved&&Object.values(report.baseline_comparison).every(c=>c.match)&&report.foreign_key_orphans.every(c=>c.orphan_count===0)&&Object.values(report.catalogue.integrity).every(c=>c===0);
 writeFileSync(completed?'docs/database/phase1-completion-verification.json':'docs/database/final-remote-verification.json',scrub(JSON.stringify(report,null,2))+'\n');
 if(completed&&(!report.verified||report.pending_local.length||!report.dry_run.result.upToDate))throw new Error('Completion verification failed; inspect saved read-only evidence.');
 console.log(JSON.stringify({history_count:report.history.length,history_matches_approved:report.history_matches_approved,pending:report.pending_local.map(m=>m.file),catalogue_sections:Object.fromEntries(Object.entries(report.baseline_comparison).map(([k,v])=>[k,{match:v.match,remote_count:v.remote_count,differences:v.differences.length}])),counts:report.catalogue.counts,integrity:report.catalogue.integrity,orphan_count:report.foreign_key_orphans.reduce((s,c)=>s+c.orphan_count,0),dry_run:report.dry_run.result}));
}catch(e){console.error(scrub(e.message));process.exitCode=1;}
