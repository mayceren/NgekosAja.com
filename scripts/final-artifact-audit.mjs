import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
const paths=git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
const patterns=[
 ['Supabase personal access token',/\bsbp_[A-Za-z0-9_-]{20,}/],
 ['Supabase server secret',/\bsb_secret_[A-Za-z0-9_-]{20,}/],
 ['JWT-shaped credential',/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}/],
 ['Database URI with password',/postgres(?:ql)?:\/\/[^\s:/@]+:[^\s/@]+@/i],
 ['Private key block',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['AWS access key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/]
];
const report={checked_at:new Date().toISOString(),credential_scan:{files_scanned:0,findings:[],scope:'Tracked and non-ignored text files in the working tree; not a guarantee about deleted Git history or external secret stores.'}};
for(const file of paths) {
 if(!existsSync(file)||!/(?:\.(?:html|css|js|mjs|cjs|json|sql|md|toml|txt|py|yml|yaml|example)|(?:^|\/)\.gitignore)$/.test(file))continue;
 const text=readFileSync(file,'utf8');report.credential_scan.files_scanned++;
 for(const [kind,pattern] of patterns)if(pattern.test(text))report.credential_scan.findings.push({file,kind});
}
const examples=['.env','.env.local','.env.production','supabase/.temp/project-ref','supabase/.temp/pooler-url','node_modules/example','supabase/.branches/example','.local-db/data/example','private.pem','private.key','credentials-test.json'];
const ignored=execFileSync('git',['check-ignore','--no-index','--stdin'],{input:examples.join('\n')+'\n',encoding:'utf8'}).trim().split(/\r?\n/);
report.gitignore=examples.map(file=>({file,ignored:ignored.includes(file)}));
report.env_example_tracked=git(['ls-files','.env.example']).trim()==='.env.example';
report.env_example_values_empty=readFileSync('.env.example','utf8').split(/\r?\n/).filter(line=>line.trim()&&!line.trim().startsWith('#')).every(line=>/^[A-Z_]+=$/.test(line));
report.frontend_diff=git(['diff','HEAD','--name-only','--','index.html','js','css','assets']).trim().split(/\r?\n/).filter(Boolean);
const doc=JSON.parse(readFileSync('docs/database/schema-catalogue.json','utf8'));
const remote=JSON.parse(readFileSync('docs/database/final-remote-verification.json','utf8'));
const erd=readFileSync('docs/database/ERD.md','utf8'),dictionary=readFileSync('docs/database/DATA_DICTIONARY.md','utf8');
const entities=[...erd.matchAll(/^  ([a-z_]+) \{/gm)].map(m=>m[1]);
const dictionaryTables=[...dictionary.matchAll(/^## ([a-z_]+)\r?$/gm)].map(m=>m[1]);
const actualEdges=erd.split(/\r?\n/).filter(line=>/^  [a-z_]+ [|o-]+(?:o\{|o\|) [a-z_]+ : /.test(line)).map(line=>line.trim()).sort();
const expectedEdges=remote.catalogue.constraints.filter(c=>c.type==='f').map(c=>{
 const match=c.definition.match(/^FOREIGN KEY \(([^)]+)\) REFERENCES ([a-z_.]+)\(/);
 assert.ok(match,`Unknown FK syntax: ${c.name}`);
 const names=match[1].split(',').map(s=>s.trim());
 const cols=remote.catalogue.columns.filter(col=>col.table===c.table&&names.includes(col.name));
 const unique=remote.catalogue.constraints.some(k=>k.table===c.table&&['p','u'].includes(k.type)&&JSON.stringify(k.definition.match(/\(([^)]+)\)/)[1].split(',').map(s=>s.trim()).sort())===JSON.stringify([...names].sort()));
 const parent=match[2]==='auth.users'?'auth_users':match[2].replace(/^public\./,'');
 return `${parent} ${cols.every(col=>col.not_null)?'||':'|o'}--${unique?'o|':'o{'} ${c.table} : "${cols.map(col=>col.name).join('_')}"`;
}).sort();
report.documentation={stats:doc.stats,erd_entities:entities.length,erd_application_tables:entities.filter(n=>n!=='auth_users').sort(),dictionary_tables:dictionaryTables.length,
 erd_foreign_keys:actualEdges.length,all_erd_relationships_match:JSON.stringify(actualEdges)===JSON.stringify(expectedEdges),
 all_dictionary_constraints_present:remote.catalogue.constraints.every(c=>dictionary.includes(`**${c.name}**:`)),
 all_dictionary_indexes_present:remote.catalogue.indexes.every(i=>dictionary.includes(i.definition)),
 all_erd_tables_match:JSON.stringify(entities.filter(n=>n!=='auth_users').sort())===JSON.stringify(remote.catalogue.tables.map(t=>t.name).sort()),
 all_dictionary_tables_match:JSON.stringify(dictionaryTables.sort())===JSON.stringify(remote.catalogue.tables.map(t=>t.name).sort()),
 all_dictionary_columns_match:doc.tables.every(t=>JSON.stringify(t.columns.map(c=>({table:c.table_name,name:c.name,type:c.type,not_null:c.not_null})))===JSON.stringify(remote.catalogue.columns.filter(c=>c.table===t.name).map(c=>({table:c.table,name:c.name,type:c.type,not_null:c.not_null}))))};
report.passed=report.credential_scan.findings.length===0&&report.gitignore.every(r=>r.ignored)&&report.env_example_tracked&&report.env_example_values_empty&&report.frontend_diff.length===0&&Object.entries(report.documentation).filter(([key])=>key.startsWith('all_')).every(([,value])=>value===true);
writeFileSync('docs/database/final-artifact-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
assert.equal(report.passed,true,'Inspect final-artifact-audit.json for failures; credential values are never printed.');
