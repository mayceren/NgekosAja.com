import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {accounts,resourceIds,fixtureTag,preflightSQL,provisionNewAccounts,verificationSQL} from './lib/development-accounts.mjs';
import {hiddenPrompt} from './lib/hidden-prompt.mjs';
import {projectRef,projectName,RepairError} from './lib/owned-auth-account.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cli=resolve(root,'node_modules/supabase/dist/supabase.js');
const dir=resolve(root,'.database-test/development-accounts');
const args=process.argv.slice(2), apply=args.includes('--apply');
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
try {
  if(args.some(arg=>arg!=='--apply'&&!arg.startsWith('--approve-remote=')) || (approval&&!apply))throw new RepairError('Gunakan tanpa argumen untuk plan read-only. Password tidak boleh menjadi argumen.');
  if(apply&&approval!==fingerprint)throw new RepairError('Belum ada persetujuan untuk plan yang tepat. Jalankan plan read-only lalu tinjau fingerprint-nya.');
  if(apply&&(!process.stdin.isTTY||!process.stdout.isTTY))throw new RepairError('Provisioning harus dijalankan dari terminal interaktif untuk password pribadi.');
  if(readFileSync(resolve(root,'supabase/.temp/project-ref'),'utf8').trim()!==projectRef)throw new RepairError('Project CLI bukan target development yang diizinkan.');
  if(!objects(run(['projects','list','--output-format','json'])).some(p=>(p.id===projectRef||p.ref===projectRef)&&p.name===projectName))throw new RepairError('Nama/ref project remote tidak cocok.');
  mkdirSync(dir,{recursive:true});
  const preflight=field(query(preflightSQL(),'preflight'),'development_preflight');
  const local=readFileSync(resolve(root,'supabase/config.toml'),'utf8').split('[auth.email]')[1]?.split(/\n\[/)[0];
  const localSetting=local?.match(/^\s*enable_confirmations\s*=\s*(true|false)/m)?.[1];
  if(!localSetting)throw new RepairError('Nilai konfirmasi email lokal tidak dapat dibaca.');
  const diff=run(['config','diff',`--remote=${projectRef}`,'--output-format','json']);
  const confirmChange=diff.changes.find(change=>change.path.join('.')==='auth.email.enable_confirmations');
  const confirmEmail=confirmChange?confirmChange.remote:localSetting==='true';
  if(typeof confirmEmail!=='boolean')throw new RepairError('Status konfirmasi email remote tidak dapat dipastikan.');
  const report={checked_at:new Date().toISOString(),manifest,fingerprint,remote_read_only:!apply,remote_applied:false,
    confirm_email_enabled:confirmEmail,configuration_changed:false,production_ready:false,preflight,
    changes:{auth_users:6,profiles_from_trigger:6,additional_role_grants:5,properties_draft:2,rooms:2,tenants:2,active_agreements:2},
    protected_existing_accounts:true,password_delivery:'User enters six private passwords in interactive terminal; no password is logged, saved, or shared with the agent.',
    apply_command:`npm run auth:provision-development -- --apply --approve-remote=${fingerprint}`};
  report.status='awaiting-explicit-remote-approval';
  writeFileSync(resolve(root,'docs/auth/development-account-plan.json'),JSON.stringify(report,null,2)+'\n');
  if(!apply){console.log(JSON.stringify({project:projectName,status:report.status,confirm_email_enabled:confirmEmail,existing_target_accounts:preflight.existing_target_accounts,fixture_id_collisions:preflight.fixture_id_collisions,planned_accounts:6,fingerprint}));process.exit(0);}
  if(preflight.existing_target_accounts!==0||preflight.fixture_id_collisions!==0||!preflight.profile_trigger_present||preflight.rls_tables!==31)throw new RepairError('Preflight tidak aman: akun/resource existing atau schema tidak sesuai. Tidak ada akun yang diubah.');
  stage='admin-key-in-memory';
  const keys=objects(run(['projects','api-keys',`--remote=${projectRef}`,'--reveal','--output-format','json']));
  const values=keys.map(key=>({name:key.name,type:key.type,value:key.api_key||key.key}));
  const serverKey=values.find(key=>(key.name==='service_role'||key.type==='secret')&&typeof key.value==='string'&&(key.value.startsWith('eyJ')||key.value.startsWith('sb_secret_')))?.value;
  const publicKey=values.find(key=>key.value?.startsWith('sb_publishable_'))?.value;
  if(!serverKey||!publicKey)throw new RepairError('Key administratif/publik tidak tersedia; tidak ada credential yang dicetak.');
  const url=`https://${projectRef}.supabase.co`, admin=createClient(url,serverKey,options).auth.admin;
  console.log('Hanya akun development baru. Isi password berbeda untuk setiap akun; ketikan tidak ditampilkan.');
  stage='create-new-development-identities';
  const checks=[];
  const result=await provisionNewAccounts({admin,prompt:hiddenPrompt,
    persistReceipt:receipt=>writeFileSync(resolve(dir,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600}),
    writeRelations:sql=>{stage='new-fixture-relations-transaction';query(sql,'apply',false);},
    verifyAccounts:async(identities,passwords)=>{
      stage='verify-new-identities-and-isolation';
      const verified=field(query(verificationSQL(identities),'verify'),'development_verification');
      if(verified.profiles!==6||verified.agreements!==2||verified.draft_properties!==2)throw new RepairError('Verifikasi relasi fixture belum lengkap.');
      for(const account of accounts){
        const scoped=createClient(url,publicKey,options);
        try {
          const signed=await scoped.auth.signInWithPassword({email:account.email,password:passwords.get(account.key)});
          if(signed.error||signed.data.user?.id!==identities[account.key])throw new RepairError('Verifikasi login akun baru gagal.');
          const profile=await scoped.from('profiles').select('id').eq('id',identities[account.key]).single();
          const roles=await scoped.from('user_roles').select('role').eq('user_id',identities[account.key]);
          if(profile.error||roles.error||!roles.data.some(row=>row.role===account.role))throw new RepairError('Verifikasi profil/role akun baru gagal.');
          if(['owner','tenant'].includes(account.role)){
            const suffix=account.key.endsWith('-a')?'a':'b', other=suffix==='a'?'b':'a';
            const table=account.role==='owner'?'properties':'rental_agreements';
            const kind=account.role==='owner'?'property-':'agreement-';
            const own=await scoped.from(table).select('id').eq('id',resourceIds[kind+suffix]);
            const foreign=await scoped.from(table).select('id').eq('id',resourceIds[kind+other]);
            if(own.error||foreign.error||own.data.length!==1||foreign.data.length!==0)throw new RepairError('Isolasi data akun baru belum terverifikasi.');
          }
          checks.push({account:account.key,login:true,profile:true,role:true,isolation:['owner','tenant'].includes(account.role)?true:'not-applicable'});
        } finally {await scoped.auth.signOut({scope:'local'}).catch(()=>{});}
      }
    }});
  report.remote_applied=true;report.status='created-and-verified';report.accounts_created=result.created;report.checks=checks;report.finished_at=new Date().toISOString();
  writeFileSync(resolve(root,'docs/auth/development-account-apply-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,accounts_created:result.created,logins_verified:checks.length,passwords_saved:false,emails_requested:0}));
} catch(error){
  console.error(error instanceof RepairError?error.message:`Provisioning berhenti pada ${stage}. Detail CLI/API yang mungkin sensitif tidak dicetak.`);
  process.exitCode=1;
}
