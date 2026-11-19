import {accounts,fixtureTag,resourceIds} from './development-accounts.mjs';
import {RepairError} from './owned-auth-account.mjs';

const same=(actual,expected)=>JSON.stringify([...actual].sort())===JSON.stringify([...expected].sort());
const requireCheck=(condition,account,check)=>{if(!condition)throw new RepairError(`Verifikasi ${account}: ${check} gagal. Tidak ada akun, password atau role yang diubah.`);};

export function expectedVisibility(account) {
 const suffix=account.key.endsWith('-a')?'a':'b';
 const party=['owner','tenant'].includes(account.role);
 return {
  profiles:account.role==='admin'?accounts.map(item=>item.key):account.role==='owner'?[account.key,'tenant-'+suffix]:[account.key],
  role_users:account.role==='admin'?accounts.map(item=>item.key):[account.key],
  resources:account.role==='admin'?['a','b']:party?[suffix]:[],
  tenants:account.role==='admin'?['tenant-a','tenant-b']:party?['tenant-'+suffix]:[],
 };
}

// Only SELECT/RPC-public-listings after password login; no Admin API or data writes.
// Client factory must receive a publishable key. Tokens/passwords never enter reports.
export async function verifyDevelopmentAccounts({createScopedClient,identities,passwords}) {
 requireCheck(accounts.every(account=>/^[a-f0-9-]{36}$/i.test(identities[account.key]||''))&&new Set(Object.values(identities)).size===6,'fixture','identitas');
 const allIds=accounts.map(account=>identities[account.key]),checks=[];
 for(const account of accounts){
  const scoped=createScopedClient(),visibility=expectedVisibility(account),id=identities[account.key];
  try {
   const signed=await scoped.auth.signInWithPassword({email:account.email,password:passwords.get(account.key)});
   requireCheck(!signed.error&&signed.data?.session&&signed.data.user?.id===id,account.key,'login');
   const current=await scoped.auth.getUser();
   requireCheck(!current.error&&current.data?.user?.id===id&&current.data.user.email?.toLowerCase()===account.email&&current.data.user.app_metadata?.development_fixture===fixtureTag,account.key,'session getUser');
   const select=async(table,column,ids)=>{
    const result=await scoped.from(table).select(column).in(column,ids);
    requireCheck(!result.error&&Array.isArray(result.data),account.key,table);
    return result.data.map(row=>row[column]);
   };
   const profiles=await select('profiles','id',allIds);
   requireCheck(same(profiles,visibility.profiles.map(key=>identities[key])),account.key,'isolasi profil');
   const roleUsers=[...new Set(await select('user_roles','user_id',allIds))];
   requireCheck(same(roleUsers,visibility.role_users.map(key=>identities[key])),account.key,'isolasi role');
   const roles=await scoped.from('user_roles').select('role').eq('user_id',id);
   requireCheck(!roles.error&&Array.isArray(roles.data)&&same(roles.data.map(row=>row.role),account.role==='prospect'?['prospect']:['prospect',account.role]),account.key,'role database');
   for(const [table,kind] of [['properties','property-'],['rooms','room-'],['rental_agreements','agreement-']]){
    const visible=await select(table,'id',['a','b'].map(s=>resourceIds[kind+s]));
    requireCheck(same(visible,visibility.resources.map(s=>resourceIds[kind+s])),account.key,'isolasi '+table);
   }
   const tenants=await select('tenants','id',['tenant-a','tenant-b'].map(key=>identities[key]));
   requireCheck(same(tenants,visibility.tenants.map(key=>identities[key])),account.key,'isolasi penghuni');
   const settings=await select('user_settings','user_id',allIds);
   requireCheck(same(settings,[id]),account.key,'pengaturan privat termasuk administrator');
   const catalogue=await scoped.rpc('public_listings');
   requireCheck(!catalogue.error&&Array.isArray(catalogue.data)&&!catalogue.data.some(row=>[resourceIds['property-a'],resourceIds['property-b']].includes(row.id)),account.key,'properti draft tidak masuk katalog');
   // Rehydrate the SDK session in another client, like a fresh app instance.
   const restored=createScopedClient();
   try {
    const result=await restored.auth.setSession({access_token:signed.data.session.access_token,refresh_token:signed.data.session.refresh_token});
    const verified=await restored.auth.getUser();
    requireCheck(!result.error&&!verified.error&&verified.data?.user?.id===id,account.key,'session restoration');
   } finally {restored.auth.stopAutoRefresh();restored.realtime?.disconnect();}
   const out=await scoped.auth.signOut({scope:'local'});
   requireCheck(!out.error,account.key,'logout');
   const after=await scoped.auth.getSession();
   requireCheck(!after.error&&!after.data?.session,account.key,'session cleared');
   checks.push({account:account.key,login:true,get_user:true,profile:true,role:true,isolation:true,visibility,session_restoration:true,logout:true,private_data_writes:0});
  } finally {
   await scoped.auth.signOut({scope:'local'}).catch(()=>{});
   scoped.auth.stopAutoRefresh();scoped.realtime?.disconnect();
  }
 }
 return checks;
}
