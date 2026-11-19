import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {accounts,resourceIds,fixtureTag,preflightSQL,provisionNewAccounts,verificationSQL} from './lib/development-accounts.mjs';
import {hiddenPrompt} from './lib/hidden-prompt.mjs';
import {projectRef,projectName,RepairError} from './lib/owned-auth-account.mjs';
import {verifyDevelopmentAccounts} from './lib/development-account-verification.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cli=resolve(root,'node_modules/supabase/dist/supabase.js');
const dir=resolve(root,'.database-test/development-accounts');
const args=process.argv.slice(2), apply=args.includes('--apply');
const verify=args.includes('--verify');
const approval=args.find(arg=>arg.startsWith('--approve-remote='))?.slice('--approve-remote='.length);
const manifest={project:projectName,ref:projectRef,fixture:fixtureTag,accounts,resources:resourceIds,final_publication_status:'draft'};
const fingerprint=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const run=arguments_=>JSON.parse(execFileSync(process.execPath,[cli,...arguments_],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:55000}));
const objects=v=>Array.isArray(v)?v.flatMap(objects):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(objects)]:[];
const query=(source,label,readOnly=true)=>{
  const path=resolve(dir,label+'.sql');writeFileSync(path,source);
  return run(['db','query',`--remote=${projectRef}`,'--file',path,...(readOnly?['--read-only']:['--yes']),'--output-format','json']);
};
const field=(result,key)=>{const row=objects(result).find(row=>Object.hasOwn(row,key));if(!row)throw new RepairError('Respons pemeriksaan database tidak lengkap.');return typeof row[key]==='string'?JSON.parse(row[key]):row[key];};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
let stage='preflight';
let recordAttempt=false;
const attempt=(status,message)=>{if(recordAttempt)writeFileSync(resolve(dir,'attempt-status.json'),JSON.stringify({updated_at:new Date().toISOString(),project:projectName,stage,status,...(message?{safe_message:message}:{})},null,2)+'\n');};
try {
  if(args.some(arg=>!['--apply','--verify'].includes(arg)&&!arg.startsWith('--approve-remote=')) || (approval&&!apply)||apply&&verify)throw new RepairError('Gunakan tanpa argumen untuk plan read-only, atau --verify untuk akun development existing. Password tidak boleh menjadi argumen.');
  if(apply&&approval!==fingerprint)throw new RepairError('Belum ada persetujuan untuk plan yang tepat. Jalankan plan read-only lalu tinjau fingerprint-nya.');
  if((apply||verify)&&(!process.stdin.isTTY||!process.stdout.isTTY))throw new RepairError('Provisioning/verifikasi harus dijalankan dari terminal interaktif untuk password pribadi.');
  if(readFileSync(resolve(root,'supabase/.temp/project-ref'),'utf8').trim()!==projectRef)throw new RepairError('Project CLI bukan target development yang diizinkan.');
  if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===projectRef||p.ref===projectRef)&&p.name===projectName))throw new RepairError('Nama/ref project remote tidak cocok.');
  mkdirSync(dir,{recursive:true});
  recordAttempt=(apply||verify)&&!!process.stdin.isTTY&&!!process.stdout.isTTY;
  attempt('running');
  const preflight=field(query(preflightSQL(),'preflight'),'development_preflight');
  const local=readFileSync(resolve(root,'supabase/config.toml'),'utf8').split('[auth.email]')[1]?.split(/\n\[/)[0];
  const localSetting=local?.match(/^\s*enable_confirmations\s*=\s*(true|false)/m)?.[1];
  if(!localSetting)throw new RepairError('Nilai konfirmasi email lokal tidak dapat dibaca.');
  const diff=run(['config','diff',`--remote=${projectRef}`,'--output-format','json']);
  const confirmChange=diff.changes.find(change=>change.path.join('.')==='auth.email.enable_confirmations');
  const confirmEmail=confirmChange?confirmChange.remote:localSetting==='true';
  if(typeof confirmEmail!=='boolean')throw new RepairError('Status konfirmasi email remote tidak dapat dipastikan.');
  const report={checked_at:new Date().toISOString(),manifest,fingerprint,remote_read_only:!apply&&!verify,remote_sql_read_only:!apply,auth_session_activity:apply||verify,remote_applied:false,
    confirm_email_enabled:confirmEmail,configuration_changed:false,production_ready:false,preflight,
    changes:{auth_users:6,profiles_from_trigger:6,additional_role_grants:5,properties_draft:2,rooms:2,tenants:2,active_agreements:2},
    protected_existing_accounts:true,password_delivery:'User enters six private passwords in interactive terminal; no password is logged, saved, or shared with the agent.',
    apply_command:preflight.existing_target_accounts===0?`npm run auth:provision-development -- --apply --approve-remote=${fingerprint}`:null,
    verify_command:'npm run auth:provision-development -- --verify'};
  report.status=preflight.existing_target_accounts===0?'awaiting-explicit-remote-approval':preflight.existing_target_accounts===6?'existing-accounts-do-not-reprovision':'partial-existing-accounts-manual-review';
  writeFileSync(resolve(root,'docs/auth/development-account-plan.json'),JSON.stringify(report,null,2)+'\n');
  if(!apply&&!verify){console.log(JSON.stringify({project:projectName,status:report.status,confirm_email_enabled:confirmEmail,existing_target_accounts:preflight.existing_target_accounts,fixture_id_collisions:preflight.fixture_id_collisions,planned_accounts:6,fingerprint}));process.exit(0);}
  if(verify){
    stage='verify-existing-development-accounts';
    if(preflight.existing_target_accounts!==6||preflight.accounts?.length!==6||preflight.accounts.some(account=>!account.exists||!account.id||!account.fixture_owned||!account.profile_exists))throw new RepairError('Enam akun fixture lengkap belum tersedia atau marker tidak cocok. Tidak ada akun existing yang diubah.');
    const identities=Object.fromEntries(preflight.accounts.map(account=>[account.key,account.id]));
    const verified=field(query(verificationSQL(identities),'verify-existing'),'development_verification');
    if(verified.profiles!==6||verified.agreements!==2||verified.draft_properties!==2)throw new RepairError('Relasi development belum lengkap; verifikasi login dibatalkan tanpa memperbaiki akun existing.');
    const keys=objects(run(['projects','api-keys',`--remote=${projectRef}`,'--output-format','json']));
    const publicKey=keys.map(key=>key.api_key||key.key||key.value).find(key=>typeof key==='string'&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(key));
    if(!publicKey)throw new RepairError('Publishable key tidak tersedia. Tidak ada key server yang diminta.');
    const passwords=new Map();
    try {
      for(const account of accounts)passwords.set(account.key,await hiddenPrompt(`Password existing ${account.email} (tersembunyi): `));
      const checks=await verifyDevelopmentAccounts({createScopedClient:()=>createClient(`https://${projectRef}.supabase.co`,publicKey,options),identities,passwords});
      writeFileSync(resolve(root,'docs/auth/development-account-verification-results.json'),JSON.stringify({checked_at:new Date().toISOString(),project:projectName,mode:'cloud-existing-fixture-password-login',account_configuration_changes:false,auth_sessions_created_and_closed:true,sql_read_only:true,emails_requested:0,passwords_saved:false,production_ready:false,checks,verified:checks.length===6},null,2)+'\n');
      console.log(JSON.stringify({verified:true,accounts:checks.length,account_configuration_changes:false,emails_requested:0}));
    } finally {passwords.clear();}
    attempt('verified');process.exit(0);
  }
  if(preflight.existing_target_accounts!==0||preflight.fixture_id_collisions!==0||!preflight.profile_trigger_present||preflight.rls_tables!==31)throw new RepairError('Preflight tidak aman: akun/resource existing atau schema tidak sesuai. Tidak ada akun yang diubah.');
  stage='admin-key-in-memory';
  const keys=objects(run(['projects','api-keys',`--remote=${projectRef}`,'--reveal','--output-format','json']));
  const values=keys.map(key=>({name:key.name,type:key.type,value:key.api_key||key.key||key.value}));
  const serverKey=values.find(key=>(key.name==='service_role'||key.type==='secret')&&typeof key.value==='string'&&(key.value.startsWith('eyJ')||key.value.startsWith('sb_secret_')))?.value;
  const publicKey=values.find(key=>key.value?.startsWith('sb_publishable_'))?.value;
  if(!serverKey||!publicKey)throw new RepairError('Key administratif/publik tidak tersedia; tidak ada credential yang dicetak.');
  const url=`https://${projectRef}.supabase.co`, admin=createClient(url,serverKey,options).auth.admin;
  console.log('Hanya akun development baru. Isi password berbeda untuk setiap akun; ketikan tidak ditampilkan.');
  stage='create-new-development-identities';
  const checks=[];
  const result=await provisionNewAccounts({admin,prompt:hiddenPrompt,
    onStage:step=>{stage=step;attempt('running');},
    persistReceipt:receipt=>writeFileSync(resolve(dir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600}),
    writeRelations:sql=>{stage='new-fixture-relations-transaction';query(sql,'apply',false);},
    verifyAccounts:async(identities,passwords)=>{
      stage='verify-new-identities-and-isolation';
      const verified=field(query(verificationSQL(identities),'verify'),'development_verification');
      if(verified.profiles!==6||verified.agreements!==2||verified.draft_properties!==2)throw new RepairError('Verifikasi relasi fixture belum lengkap.');
      checks.push(...await verifyDevelopmentAccounts({createScopedClient:()=>createClient(url,publicKey,options),identities,passwords}));
    }});
  report.remote_applied=true;report.status='created-and-verified';report.accounts_created=result.created;report.checks=checks;report.finished_at=new Date().toISOString();
  writeFileSync(resolve(root,'docs/auth/development-account-apply-results.json'),JSON.stringify(report,null,2)+'\n');
  attempt('created-and-verified');
  console.log(JSON.stringify({status:report.status,accounts_created:result.created,logins_verified:checks.length,passwords_saved:false,emails_requested:0}));
} catch(error){
  const safeMessage=error instanceof RepairError?error.message:`Provisioning berhenti pada ${stage}. Detail CLI/API yang mungkin sensitif tidak dicetak.`;
  try{attempt('failed',safeMessage);}catch{}
  console.error(safeMessage);
  process.exitCode=1;
}
