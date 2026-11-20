import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {configuration,requireDevelopmentUser,createSimulatorHandler,projectRef} from '../supabase/functions/_shared/simulator.mjs';
const environment={PAYMENT_SIMULATOR_ENABLED:'true',PAYMENT_ENVIRONMENT:'development',PAYMENT_ALLOWED_PROJECT_REF:projectRef,SUPABASE_URL:`https://${projectRef}.supabase.co`,PAYMENT_ALLOWED_ORIGINS:'http://localhost:5500'};
const user={id:randomUUID(),email:'dev-tenant-a@ngekosaja.test',app_metadata:{development_fixture:'ngekosaja-development-auth-v1',development_fixture_run:'a'.repeat(32)}};
const resource=randomUUID(),key=randomUUID();
const request=(patch={},headers={})=>new Request('http://localhost/payment',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({invoice_id:resource,method:'qris',idempotency_key:key,...patch})});
function harness(kind='rent'){
 const calls=[],state={user:structuredClone(user),resource:true,fail:false};
 if(kind==='boost')state.user.email='dev-owner-a@ngekosaja.test';
 const deps={env:k=>environment[k],authenticate:async()=>state.user,resource:async()=>{calls.push('resource');return state.resource;},settle:async(actor,k,id,method,requestKey)=>{calls.push({actor,kind:k,id,method,requestKey});if(state.fail)throw Error('private-database-details');return {id:randomUUID(),payer_id:actor,kind:k,[k==='rent'?'invoice_id':'property_id']:id,status:'succeeded',is_simulation:true,transaction_id:randomUUID(),completed_at:new Date().toISOString()};}};
 return {calls,state,deps,handler:createSimulatorHandler(kind,deps)};
}
test('development configuration requires explicit enable, exact target and allowed origin',()=>{
 assert.ok(configuration(k=>environment[k]));
 for(const patch of [{PAYMENT_SIMULATOR_ENABLED:'false'},{PAYMENT_SIMULATOR_ENABLED:undefined},{PAYMENT_ENVIRONMENT:'production'},{PAYMENT_ALLOWED_PROJECT_REF:'another-project'},{SUPABASE_URL:'https://another-project.supabase.co'},{SUPABASE_URL:`https://${projectRef}.supabase.co/evil`},{PAYMENT_ALLOWED_ORIGINS:'*'}])assert.throws(()=>configuration(k=>Object.hasOwn(patch,k)?patch[k]:environment[k]));
});
test('account gate requires server app metadata, fixed testing email and a valid fixture run',()=>{
 requireDevelopmentUser(user,'rent');
 for(const patch of [{id:null},{email:'personal@example.invalid'},{email:'dev-owner-a@ngekosaja.test'},{app_metadata:{}},{app_metadata:{...user.app_metadata,development_fixture_run:''}},{app_metadata:null,user_metadata:user.app_metadata}])assert.throws(()=>requireDevelopmentUser({...user,...patch},'rent'));
});
for(const method of ['qris','virtual_account','bank_transfer','e_wallet'])test('rent method '+method+' returns only recorded server success',async()=>{const h=harness(),res=await h.handler(request({method}));assert.equal(res.status,200);assert.equal((await res.json()).attempt.is_simulation,true);assert.equal(h.calls[1].method,method);});
test('boost handler derives kind and forwards property ID, never a client price',async()=>{const h=harness('boost'),res=await h.handler(new Request('http://localhost',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({property_id:resource,method:'e_wallet',idempotency_key:key})}));assert.equal(res.status,200);assert.equal(h.calls[1].kind,'boost');});
test('client amounts, owners, status and unknown fields are rejected before writes',async()=>{
 for(const patch of [{amount:1},{gross_amount:1},{owner_id:user.id},{payer_id:user.id},{status:'succeeded'},{method:'real_bank'},{idempotency_key:'bad'},{invoice_id:'bad'}]){const h=harness();assert.equal((await h.handler(request(patch))).status,400);assert.equal(h.calls.length,0);}
});
test('unauthenticated and unmarked users cannot access a resource',async()=>{const h=harness();h.state.user=null;assert.equal((await h.handler(request())).status,403);assert.equal(h.calls.length,0);});
test('RLS-hidden resource is rejected before privileged settlement',async()=>{const h=harness();h.state.resource=false;assert.equal((await h.handler(request())).status,404);assert.equal(h.calls.length,1);});
test('failed backend produces an error without invented success or raw database details',async()=>{const h=harness();h.state.fail=true;const res=await h.handler(request());assert.equal(res.status,503);const text=await res.text();assert.ok(!text.includes('private-database'));assert.ok(!text.includes('"attempt"'));});
test('pending, missing transaction or inconsistent server results never become HTTP success',async()=>{
 for(const patch of [{status:'pending'},{transaction_id:null},{completed_at:null},{is_simulation:false},{payer_id:randomUUID()},{invoice_id:randomUUID()},{kind:'boost'}]){const h=harness(),settle=h.deps.settle;h.deps.settle=async(...args)=>({...await settle(...args),...patch});assert.equal((await h.handler(request())).status,503);}
});
test('production guard stops before authentication, database or any external call',async()=>{const h=harness();h.deps.env=k=>k==='PAYMENT_ENVIRONMENT'?'production':environment[k];assert.equal((await h.handler(request())).status,503);assert.equal(h.calls.length,0);});
test('method, CORS, JSON and streaming body bounds are enforced',async()=>{
 const h=harness();assert.equal((await h.handler(request({}, {Origin:'https://untrusted.invalid'}))).status,403);
 assert.equal((await h.handler(new Request('http://localhost',{method:'GET'}))).status,405);
 assert.equal((await h.handler(new Request('http://localhost',{method:'POST',body:'{}'}))).status,415);
 assert.equal((await h.handler(request({padding:'x'.repeat(3000)}))).status,413);
 const res=await h.handler(new Request('http://localhost',{method:'OPTIONS',headers:{Origin:'http://localhost:5500'}}));assert.equal(res.status,204);assert.equal(res.headers.get('access-control-allow-origin'),'http://localhost:5500');assert.equal(h.calls.length,0);
});
