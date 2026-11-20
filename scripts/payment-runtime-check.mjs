// Optional QA tool. Resolves Deno from PATH or NGEKOSAJA_DENO, never deploys.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const deno=process.env.NGEKOSAJA_DENO||'deno',report={executed_at:new Date().toISOString(),scope:'Deno/SDK with intercepted HTTP; no real JWT/Cloud gateway verification',network_permission:false,remote_mutations:false,provider_calls:false};
try{
 report.deno_version=execFileSync(deno,['--version'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).split(/\r?\n/)[0];
 execFileSync(deno,['check','--no-lock','supabase/functions/simulate-rent-payment/index.ts','supabase/functions/simulate-boost-payment/index.ts'],{stdio:['ignore','pipe','pipe'],timeout:55000});report.entrypoints_checked=2;
 const output=execFileSync(deno,['test','--no-lock','--allow-env','tests/payment-runtime.test.ts'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000});const text=output.replace(/\x1b\[[0-9;]*m/g,'');report.passed=Number(text.match(/(\d+) passed/)?.[1]);report.failed=Number(text.match(/(\d+) failed/)?.[1]);if(report.passed!==7||report.failed)throw Error();report.success=true;
}catch{report.success=false;report.error='DENO_CHECK_OR_TEST_UNAVAILABLE';process.exitCode=1;}
writeFileSync('docs/payment/deno-verification-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
