// Read-only migration plan. No apply mode is intentionally provided here.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const ref='wfmhsbdfdcugxblqsaob',migration='20261119000300_realtime_storage.sql';
const cli=resolve('node_modules/supabase/dist/supabase.js');
const run=args=>execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000});
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw Error();
 const projects=JSON.parse(run(['projects','list','--output-format','json']));
 const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
 if(!objects(projects).some(p=>(p.id===ref||p.ref===ref)&&p.name==='ngekosaja-development'))throw Error();
 const version=run(['--version']).trim();
 const output=run(['db','push','--remote='+ref,'--dry-run','--skip-vault','--output-format','json']);
 const found=[...new Set(output.match(/\d{14}_[a-z0-9_]+\.sql/g)||[])];
 const parsed=JSON.parse(output),upToDate=!!parsed.upToDate&&found.length===0;
 if(parsed.target?.project_ref!==ref||parsed.target?.project_name!=='ngekosaja-development'||(!upToDate&&(found.length!==1||found[0]!==migration)))throw Error('Unexpected migration plan');
 const digest=file=>createHash('sha256').update(readFileSync('supabase/migrations/'+file)).digest('hex');
 const report={checked_at:new Date().toISOString(),project:'ngekosaja-development',ref,cli_version:version,dry_run:true,remote_mutations:false,arguments:['db','push','--remote='+ref,'--dry-run','--skip-vault','--output-format','json'],pending:found.map(file=>({file,sha256:digest(file)})),applied_files:readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f!==migration).sort().map(file=>({file,sha256:digest(file)})),limitations:['Dry-run checks migration history/plan, not SQL execution. Native local SQL adapter tests are separate.']};
 mkdirSync('docs/phase4',{recursive:true});writeFileSync(upToDate?'docs/phase4/migration-current-plan.json':'docs/phase4/migration-plan.json',JSON.stringify({...report,up_to_date:upToDate},null,2)+'\n');console.log(JSON.stringify({project:report.project,cli_version:version,pending:report.pending,remote_mutations:false}));
}catch{console.error('Dry-run belum terverifikasi. Raw CLI output dan credential tidak ditampilkan.');process.exitCode=1;}
