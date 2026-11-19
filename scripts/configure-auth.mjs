import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const ref='wfmhsbdfdcugxblqsaob',name='ngekosaja-development';
const cli=resolve('node_modules/supabase/dist/supabase.js');
const run=args=>JSON.parse(execFileSync(process.execPath,[cli,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
try{
 if(readFileSync('supabase/.temp/project-ref','utf8').trim()!==ref)throw new Error('Linked target mismatch.');
 if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===ref||p.ref===ref)&&p.name===name))throw new Error('Live development project not confirmed.');
 // No --reveal: secret key values are never requested or written by this script.
 const keys=objects(run(['projects','api-keys',`--remote=${ref}`,'--output-format','json']));
 const key=keys.map(k=>k.api_key||k.key||k.value).find(k=>typeof k==='string'&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(k));
 if(!key)throw new Error('No publishable key available. Fill config/runtime.js from Dashboard > API Keys > Publishable key.');
 const config={supabaseUrl:`https://${ref}.supabase.co`,publishableKey:key,defaultMode:'connected'};
 writeFileSync('config/runtime.js','// Public configuration only; RLS enforces access. No secret keys.\nwindow.NGEKOSAJA_PUBLIC_CONFIG = window.NGEKOSAJA_PUBLIC_CONFIG || Object.freeze('+JSON.stringify(config,null,2)+');\n');
 console.log('Public configuration saved for ngekosaja-development; no credential values printed.');
}catch(e){console.error(e.message?.includes('publishable')?e.message:'Public configuration unavailable. Use config/runtime.example.js; no raw CLI response printed.');process.exitCode=1;}
// Ship the official UMD locally: no CDN or framework needed by the browser.
mkdirSync('assets/vendor',{recursive:true});
copyFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js','assets/vendor/supabase.js');
const license=await fetch('https://raw.githubusercontent.com/supabase/supabase-js/v2.99.3/LICENSE');
if(!license.ok)throw new Error('Official SDK license could not be downloaded.');
writeFileSync('assets/vendor/SUPABASE_LICENSE',await license.text());
console.log('Official Supabase SDK 2.99.3 browser bundle copied.');
