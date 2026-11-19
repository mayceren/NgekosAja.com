import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const ref='wfmhsbdfdcugxblqsaob',cli=resolve('node_modules/supabase/dist/supabase.js');
const run=args=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000}));
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const eq=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const query=(file,key)=>{const r=objects(run(['db','query',`--remote=${ref}`,'--read-only','--file',file,'--output-format','json'])).find(x=>Object.hasOwn(x,key));if(!r)throw Error('Missing metadata');return typeof r[key]==='string'?JSON.parse(r[key]):r[key];};
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw Error('Linked target mismatch');
 if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===ref||p.ref===ref)&&p.name==='ngekosaja-development'))throw Error('Live project mismatch');
 const original=JSON.parse(readFileSync('docs/database/phase1-completion-verification.json','utf8'));
 const catalogue=query('supabase/review/final-catalogue.sql','catalogue');
 const report={checked_at:new Date().toISOString(),project:'ngekosaja-development',remote_sql_read_only:true,schema_changes_applied:false,postflight:query('supabase/review/postflight.sql','postflight'),history:query('supabase/review/migration-history.sql','migration_history'),counts:catalogue.counts,integrity:catalogue.integrity,unchanged:{}};
 for(const section of ['tables','columns','constraints','indexes','policies','functions','triggers','views','api_privileges','api_roles','schema_access'])report.unchanged[section]=eq(original.catalogue[section],catalogue[section]);
 report.applied_migrations_unchanged=original.local_migrations.every(m=>createHash('sha256').update(readFileSync(`supabase/migrations/${m.file}`)).digest('hex')===m.sha256);
 const audited=['profiles','user_roles','properties','tenants','rental_agreements','invoices','transactions','complaints','conversations','messages','notifications'];
 report.audited_rls=catalogue.policies.filter(p=>audited.includes(p.table));
 report.credential_scan={scope:'Tracked and non-ignored working-tree text; server secrets are never expected in browser files.',findings:[],files:0};
 const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',maxBuffer:8*1024*1024}).split('\0').filter(Boolean);
 const patterns=[['server secret',/\bsb_secret_[A-Za-z0-9_-]{20,}/],['access token',/\bsbp_[A-Za-z0-9_-]{20,}/],['JWT',/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}/],['database password URI',/postgres(?:ql)?:\/\/[^\s:/@]+:[^\s/@]+@/i],['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]];
 for(const file of paths){if(!/\.(?:js|mjs|cjs|json|html|sql|md|py|toml|example)$/.test(file)||!existsSync(file))continue;report.credential_scan.files++;const source=readFileSync(file,'utf8');for(const [kind,pattern] of patterns)if(pattern.test(source))report.credential_scan.findings.push({file,kind});}
 const ignored=execFileSync('git',['check-ignore','--no-index','--stdin'],{input:'.local-db/auth-qa-identity.json\n.env.local\n.database-test/auth-callback-config/supabase/config.toml\n',encoding:'utf8'}).trim().split(/\r?\n/);
 report.private_paths_ignored=ignored.length===3;
 report.verified=Object.values(report.unchanged).every(Boolean)&&report.applied_migrations_unchanged&&report.history.length===12&&Object.values(report.integrity).every(v=>v===0)&&report.credential_scan.findings.length===0&&report.private_paths_ignored;
 writeFileSync('docs/auth/security-audit-results.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({verified:report.verified,migrations:report.history.length,all_31_tables_rls:report.postflight.rls_disabled_table_count===0,policies:report.postflight.policy_count,auth_users:report.counts.auth_users,credential_findings:report.credential_scan.findings.length}));
 if(!report.verified)process.exitCode=1;
}catch{console.error('Auth audit incomplete. No raw CLI output or credential printed.');process.exitCode=1;}
