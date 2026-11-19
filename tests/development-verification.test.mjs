import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {accounts,fixtureTag,resourceIds} from '../scripts/lib/development-accounts.mjs';
import {verifyDevelopmentAccounts} from '../scripts/lib/development-account-verification.mjs';

function harness(inject={}) {
 const identities=Object.fromEntries(accounts.map(account=>[account.key,randomUUID()])),passwords=new Map(accounts.map(account=>[account.key,randomBytes(24).toString('hex')])),clients=[];
 const sessions=new Map(),token=()=>randomBytes(24).toString('hex');
 const factory=()=>{
  const state={key:null,session:null,signouts:0};clients.push(state);
  const user=()=>({id:identities[state.key],email:accounts.find(account=>account.key===state.key)?.email,app_metadata:{development_fixture:fixtureTag}});
  return {auth:{
   signInWithPassword:async({email,password})=>{
    const account=accounts.find(account=>account.email===email);assert.equal(password,passwords.get(account.key));state.key=account.key;
    if(inject.loginError)return {error:{message:inject.loginError}};
    state.session={access_token:token(),refresh_token:token()};sessions.set(state.session.access_token,account.key);return {data:{user:user(),session:state.session}};
   },
   getUser:async()=>({data:{user:{...user(),...(inject.identity||{})}}}),
   setSession:async session=>{state.key=sessions.get(session.access_token);state.session=session;return inject.restoreError?{error:{message:'restore rejected'}}:{data:{session}};},
   signOut:async()=>{state.signouts++;if(!inject.logoutStuck)state.session=null;return {};},
   getSession:async()=>({data:{session:state.session}}),stopAutoRefresh:()=>{},
  },realtime:{disconnect:()=>{}},
  from:table=>({select:column=>({
   eq:async(_,id)=>({data:(inject.roles|| (state.key==='prospect'?['prospect']:['prospect',state.key.split('-')[0]])).map(role=>({role}))}),
   in:async(_,ids)=>{
    const key=state.key,admin=key==='admin',owner=key.startsWith('owner'),tenant=key.startsWith('tenant'),side=key.endsWith('a')?'a':'b';let allowed;
    if(table==='profiles')allowed=admin?accounts.map(a=>identities[a.key]):owner?[identities[key],identities['tenant-'+side]]:[identities[key]];
    else if(table==='user_roles')allowed=admin?accounts.map(a=>identities[a.key]):[identities[key]];
    else if(table==='user_settings')allowed=[identities[key]];
    else if(table==='tenants')allowed=(admin?['a','b']:owner||tenant?[side]:[]).map(s=>identities['tenant-'+s]);
    else {const prefix={properties:'property-',rooms:'room-',rental_agreements:'agreement-'}[table];allowed=(admin?['a','b']:owner||tenant?[side]:[]).map(s=>resourceIds[prefix+s]);}
    let rows=allowed.filter(id=>ids.includes(id)).map(id=>({[column]:id}));
    if(inject.query)rows=inject.query({key,table,column,ids,rows});return {data:rows,error:inject.queryError?{message:'query rejected'}:null};
   },
  })}),
  rpc:async()=>({data:inject.catalogue||[]}),
  };
 };
 return {options:{createScopedClient:factory,identities,passwords},clients,passwords};
}
test('six JWT scopes validate identity, role, private data, restored session and logout without saving credentials',async()=>{
 const h=harness(),result=await verifyDevelopmentAccounts(h.options);
 assert.equal(result.length,6);assert.ok(result.every(row=>row.isolation&&row.logout&&row.session_restoration));
 assert.deepEqual(result.find(row=>row.account==='prospect').visibility.resources,[]);
 assert.deepEqual(result.find(row=>row.account==='admin').visibility.resources,['a','b']);
 for(const secret of h.passwords.values())assert.ok(!JSON.stringify(result).includes(secret));
 assert.ok(h.clients.filter(client=>client.signouts).every(client=>client.session===null));
});
test('prospect seeing any fixture property fails the verification',async()=>{
 const h=harness({query:({key,table,column,ids,rows})=>key==='prospect'&&table==='properties'?[{[column]:ids[0]}]:rows});
 await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/prospect: isolasi properties/);
});
test('administrator cannot pass verification if private settings of other users are visible',async()=>{
 const h=harness({query:({key,table,column,ids,rows})=>key==='admin'&&table==='user_settings'?ids.map(id=>({[column]:id})):rows});
 await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/pengaturan privat termasuk administrator/);
});
test('tenant A must not see tenant B room',async()=>{
 const h=harness({query:({key,table,column,ids,rows})=>key==='tenant-a'&&table==='rooms'?ids.map(id=>({[column]:id})):rows});
 await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/tenant-a: isolasi rooms/);
});
test('unexpected admin role on prospect is rejected',async()=>{
 const h=harness({roles:['prospect','admin']});await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/role database/);
});
test('server getUser with a different identity cannot authorize data queries',async()=>{
 const h=harness({identity:{id:randomUUID()}});await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/session getUser/);assert.equal(h.clients[0].session,null);
});
test('Auth rejection is sanitized and no repair or password change is attempted',async()=>{
 const secret=randomBytes(24).toString('hex'),h=harness({loginError:secret});
 await assert.rejects(()=>verifyDevelopmentAccounts(h.options),error=>!error.message.includes(secret)&&/login/.test(error.message));assert.equal(h.clients[0].signouts,1);
});
test('session restoration must succeed before recording account success',async()=>{
 const h=harness({restoreError:true});await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/session restoration/);assert.equal(h.clients[0].session,null);
});
test('logout must clear SDK session',async()=>{
 const h=harness({logoutStuck:true});await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/session cleared/);
});
test('PostgREST errors fail closed and still sign out',async()=>{
 const h=harness({queryError:true});await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/profiles/);assert.equal(h.clients[0].session,null);
});
test('a published development fixture fails the catalogue contract',async()=>{
 const h=harness({catalogue:[{id:resourceIds['property-a']}]});await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/draft tidak masuk katalog/);
});
test('duplicate or missing fixture identities fail before client creation',async()=>{
 const h=harness();h.options.identities.admin=h.options.identities.prospect;
 await assert.rejects(()=>verifyDevelopmentAccounts(h.options),/identitas/);assert.equal(h.clients.length,0);
});
