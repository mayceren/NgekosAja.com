import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const ref='wfmhsbdfdcugxblqsaob',cli=resolve('node_modules/supabase/dist/supabase.js');
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const run=args=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000}));
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw Error();
 if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===ref||p.ref===ref)&&p.name==='ngekosaja-development'))throw Error();
 const result=objects(run(['db','query','--remote='+ref,'--read-only','--file','supabase/review/phase4-preflight.sql','--output-format','json'])).find(x=>Object.hasOwn(x,'phase4_preflight'))?.phase4_preflight;
 const data=typeof result==='string'?JSON.parse(result):result;if(!data)throw Error();
 const report={checked_at:new Date().toISOString(),project:'ngekosaja-development',read_only:true,remote_mutations:false,manual_feedback:'User reports features worked during manual testing; no specific scenarios/results supplied.',...data};
 const path=data.history?.includes('20261119000300')?'docs/phase4/cloud-current-state.json':'docs/phase4/cloud-preflight-results.json';
 mkdirSync('docs/phase4',{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error('Phase 4 read-only review incomplete; raw CLI output and credentials withheld.');process.exitCode=1;}
