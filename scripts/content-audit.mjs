import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';

// Policy definitions are test inputs, not product copy. Evidence remains immutable.
const git=args=>execFileSync('git',args,{maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).toString('utf8').split('\0'))].filter(file=>file&&existsSync(file));
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)||'docs/content-audit-results.json';
if(!/^docs\/(?:content-audit-results\.json|backend\/[a-z0-9-]+\.json)$/.test(output))throw new Error('Invalid audit output path.');
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const normalizedHash=(file,buffer)=>hash(/\.(?:json|md|css|sql|toml|js|txt)$/.test(file)?buffer.toString('utf8').replaceAll('\r\n','\n'):buffer);
const academic=/\b(?:UAS|UTS|Technopreneurship|BMLC|milestone|dosen)\b|uas_|tugas\s+(?:kuliah|kelompok)|project\s+akademik|perkuliahan|anggaran\s+Rp\s*0|zero.cost\s+project|prototype\s+(?:pendidikan|untuk\s+tugas)/i;
const evidence=file=>/^(?:tests\/[^/]+-results\.json|tests\/[^/]+\.png|screenshots\/|docs\/(?:auth|database)\/[^/]*(?:results|verification|catalogue)\.json$|tests\/VERIFICATION\.md$)/.test(file);
const policy=file=>['scripts/content-audit.mjs','tests/branding_browser.py'].includes(file);
const report={checked_at:new Date().toISOString(),active_text_files:0,academic_findings:[],local_links_checked:0,broken_links:[],syntax_files:0,protected_files:0,protected_changes:[],archives_verified:[],credential_findings:[],remote_changes:false};
const secrets=[/\bsb_secret_[A-Za-z0-9_-]{20,}/,/\bsbp_[A-Za-z0-9_-]{20,}/,/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}/,/postgres(?:ql)?:\/\/[^\s:/@]+:[^\s/@]+@/i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
for(const file of files) {
 const bytes=readFileSync(file);
 const protectedFile=evidence(file)||/^supabase\/migrations\//.test(file)||['supabase/seed.sql','supabase/config.toml','config/runtime.js'].includes(file)||file.startsWith('css/')||file.startsWith('assets/vendor/');
 if(protectedFile){
  let previous;try{previous=git(['show',':'+file]);}catch{}
  if(previous){report.protected_files++;if(normalizedHash(file,bytes)!==normalizedHash(file,previous))report.protected_changes.push(file);}
 }
 if(!/\.(?:html|css|js|mjs|cjs|sql|toml|json|md|txt|py|yml|yaml|example)$/.test(file))continue;
 const source=bytes.toString('utf8');
 for(const pattern of secrets)if(pattern.test(source))report.credential_findings.push(file);
 if(file.startsWith('docs/archive/')||file.startsWith('assets/vendor/')||evidence(file)||policy(file))continue;
 report.active_text_files++;
 // Historical filenames in citations remain valid; only visible link labels are copy.
 const copy=file.endsWith('.md')?source.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1'):source;
 copy.split(/\r?\n/).forEach((line,index)=>{if(academic.test(line))report.academic_findings.push({file,line:index+1});});
 if(file.endsWith('.md'))for(const match of source.matchAll(/\]\(([^)]+)\)/g)){
  const target=match[1].split('#')[0];if(!target||/^(?:https?:|mailto:)/.test(target))continue;
  report.local_links_checked++;const resolved=resolve(dirname(file),target);if(!existsSync(resolved)&&resolved!==resolve('docs/content-audit-results.json'))report.broken_links.push({file,target});
 }
 if(/^(?:js|scripts|config|tests|supabase\/tests)\/.*\.(?:js|mjs|cjs)$/.test(file)){
  try{execFileSync(process.execPath,['--check',file],{stdio:'pipe'});report.syntax_files++;}catch{report.protected_changes.push('Syntax failure: '+file);}
 }
}
for(const entry of JSON.parse(readFileSync('docs/archive/manifest.json','utf8')).files){
 const equal=hash(readFileSync(entry.file))===entry.sha256;
 report.archives_verified.push({archive:entry.file,archive_checksum_valid:equal});
}
const pkg=JSON.parse(readFileSync('package.json','utf8')),lock=JSON.parse(readFileSync('package-lock.json','utf8')).packages[''];
report.lockfile_consistent=JSON.stringify(pkg.dependencies)===JSON.stringify(lock.dependencies)&&JSON.stringify(pkg.devDependencies)===JSON.stringify(lock.devDependencies);
report.comparison='Text is normalized from CRLF to LF to match Git; binary files are compared byte for byte.';
report.passed=!report.academic_findings.length&&!report.broken_links.length&&!report.protected_changes.length&&!report.credential_findings.length&&report.archives_verified.every(item=>item.archive_checksum_valid)&&report.lockfile_consistent;
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
