import {readFileSync,readdirSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const list=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(join(dir,e.name)):[join(dir,e.name)]);
const run=args=>execFileSync(process.execPath,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000});
const report={executed_at:new Date().toISOString(),remote_mutations:false,checks:{},limitations:['Unit/mock/native SQL results do not prove Cloud JWT/WebSocket/Storage service behavior.']};
try{
 const scripts=[...list('js').filter(f=>f.endsWith('.js')),'config/runtime.js'];for(const file of scripts)run(['--check',file]);report.checks.syntax={files:scripts.length,passed:true};
 const unit=run(['--test','tests/live-core.test.mjs','tests/backend-core.test.mjs','tests/development-provision.test.mjs','tests/development-verification.test.mjs','tests/auth-repair.test.mjs','tests/database-tooling.test.mjs']);
 report.checks.unit={passed:Number(unit.match(/# pass (\d+)/)?.[1]),failed:Number(unit.match(/# fail (\d+)/)?.[1])};
 const domain=run(['tests/domain.cjs']);report.checks.demo_domain={passed:Number(domain.match(/(\d+) domain regression/)?.[1])};
 const migrations=readdirSync('supabase/migrations').filter(f=>/^\d{14}_.*\.sql$/.test(f)&&f<'20261119000300').sort();
 for(const file of migrations){const before=execFileSync('git',['show','HEAD:supabase/migrations/'+file],{stdio:['ignore','pipe','pipe']}).toString().replaceAll('\r\n','\n');if(before!==readFileSync('supabase/migrations/'+file,'utf8').replaceAll('\r\n','\n'))throw Error('Historical migration changed: '+file);}
 report.checks.applied_migrations={unchanged:migrations.length};
 const historical=['docs/backend/remote-apply-results.json','docs/auth/PHASE2_FINALIZATION.md','tests/backend/results.json','tests/backend-database-upgrade-results.json'];
 for(const file of historical){const before=execFileSync('git',['show','HEAD:'+file],{stdio:['ignore','pipe','pipe']}).toString().replaceAll('\r\n','\n');if(before!==readFileSync(file,'utf8').replaceAll('\r\n','\n'))throw Error('Historical evidence changed');}report.checks.historical_evidence={unchanged:historical.length};
 const files=['index.html',...list('js'),...list('config')].filter(f=>/\.(html|js)$/.test(f));let findings=0;
 for(const file of files){const text=readFileSync(file,'utf8');if(/\b(?:sb_secret_|sbp_)[A-Za-z0-9_-]{16,}/.test(text))findings++;
  for(const jwt of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[])try{if(JSON.parse(Buffer.from(jwt.split('.')[1],'base64url')).role==='service_role')findings++;}catch{}
 }if(findings)throw Error('Frontend credential finding');report.checks.frontend_credentials={findings};
 const html=readFileSync('index.html','utf8');for(const [,target] of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^(https?:|data:)/.test(target)&&!existsSync(target))throw Error('Missing HTML asset');report.checks.html_assets={passed:true};
 for(const file of ['README.md',...list('docs/phase4'),...list('docs/realtime'),...list('docs/storage')].filter(f=>f.endsWith('.md'))){for(const [,target] of readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){if(/^(https?:|#)/.test(target))continue;const path=resolve(dirname(file),target.split('#')[0]);if(path===resolve('docs/phase4/local-verification-results.json'))continue;if(!existsSync(path))throw Error('Missing documentation link: '+file);}}
 report.checks.documentation_links={passed:true};
 const protectedPaths=['.env','.env.local','supabase/.temp/project-ref','.local-db/data/PG_VERSION','node_modules/pg/package.json','credentials-test.json'];
 const ignored=execFileSync('git',['check-ignore',...protectedPaths],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split(/\r?\n/);if(ignored.length!==protectedPaths.length)throw Error('Sensitive paths not ignored');report.checks.gitignore={protected_paths:ignored.length};
 for(const [label,path] of Object.entries({sql_upgrade:'tests/phase4-upgrade-results.json',sql_fresh:'tests/phase4-fresh-results.json',phase4_browser:'tests/phase4/browser/results.json',backend_browser:'tests/phase4/regression-backend/results.json',auth_browser:'tests/phase4/regression-auth/auth-browser-results.json',demo_browser:'tests/phase4/regression-demo/browser-results.json'})){
  const r=JSON.parse(readFileSync(path,'utf8'));const count=Array.isArray(r.passed)?r.passed.length:r.passed;const failed=r.failed||r.errors||r.javascript_errors||[];if(failed.length)throw Error('Recorded test failures');report.checks[label]={passed:count,failed:0,evidence:path};
 }
 report.migration={file:'20261119000300_realtime_storage.sql',sha256:createHash('sha256').update(readFileSync('supabase/migrations/20261119000300_realtime_storage.sql')).digest('hex')};
 report.success=true;
}catch(error){report.success=false;report.error=String(error.message).slice(0,200);process.exitCode=1;}
mkdirSync('docs/phase4',{recursive:true});writeFileSync('docs/phase4/local-verification-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
