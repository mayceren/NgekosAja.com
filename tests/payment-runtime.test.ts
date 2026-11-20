// Actual Deno + pinned Supabase SDK binding; every HTTP request is intercepted.
// This is not a Cloud JWT/provider test. No real credentials are used or saved.
import assert from 'node:assert/strict';
import {handler} from '../supabase/functions/_shared/runtime.ts';
import {digest} from '../supabase/functions/_shared/midtrans.mjs';

const userId=crypto.randomUUID(),attemptId=crypto.randomUUID(),invoiceId=crypto.randomUUID();
const userToken='mock.user.signature',anonymous='mock-anonymous',service='mock-service';
const variables={SUPABASE_URL:'https://database.invalid',SUPABASE_ANON_KEY:anonymous,SUPABASE_SERVICE_ROLE_KEY:service,MIDTRANS_IS_PRODUCTION:'false',MIDTRANS_SERVER_KEY:'SB-Mid-server-'+crypto.randomUUID(),MIDTRANS_CLIENT_KEY:'SB-Mid-client-'+crypto.randomUUID()};
type Call={url:URL;headers:Headers;body:Record<string,unknown>};
const attempt=()=>({id:attemptId,kind:'rent',invoice_id:invoiceId,property_id:crypto.randomUUID(),payer_id:userId,order_id:'NK-SB-'+crypto.randomUUID().replaceAll('-',''),amount:1500000,admin_fee:2000,gross_amount:1502000,status:'pending',environment:'sandbox',created_at:new Date().toISOString()});
const request=(body:unknown,authenticated=true)=>new Request('http://localhost/payment',{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+userToken}:{})},body:JSON.stringify(body)});
async function isolated(run:(calls:Call[],mock:(respond:(call:Call)=>Response|Promise<Response>)=>void)=>Promise<void>){
 const saved=new Map(Object.keys(variables).map(k=>[k,Deno.env.get(k)]));
 const original=globalThis.fetch,calls:Call[]=[];
 try{
  for(const [k,v]of Object.entries(variables))Deno.env.set(k,v);
  await run(calls,respond=>{globalThis.fetch=async(input,init)=>{
   const req=new Request(input,init),raw=req.method==='GET'?'':await req.text();
   const call={url:new URL(req.url),headers:req.headers,body:raw?JSON.parse(raw):{}};calls.push(call);
   return respond(call);
  };});
 }finally{globalThis.fetch=original;for(const [k,v]of saved)v===undefined?Deno.env.delete(k):Deno.env.set(k,v);}
}
const auth=(c:Call)=>{assert.equal(c.headers.get('apikey'),anonymous);assert.equal(c.headers.get('authorization'),'Bearer '+userToken);return Response.json({id:userId,aud:'authenticated',created_at:new Date().toISOString()});};
const privileged=(c:Call)=>{assert.equal(c.headers.get('apikey'),service);assert.equal(c.headers.get('authorization'),'Bearer '+service);};
const scoped=(c:Call)=>{assert.equal(c.headers.get('apikey'),anonymous);assert.equal(c.headers.get('authorization'),'Bearer '+userToken);};

Deno.test('runtime: JWT getUser, RLS resource, service RPC and Sandbox request stay separated',()=>isolated(async(calls,mock)=>{
 const a=attempt();let sessions=0;
 mock(c=>{
  if(c.url.pathname==='/auth/v1/user')return auth(c);
  if(c.url.pathname==='/rest/v1/invoices'){scoped(c);assert.equal(c.url.searchParams.get('rental_agreements.tenant_id'),'eq.'+userId);return Response.json({id:invoiceId});}
  if(c.url.hostname==='app.sandbox.midtrans.com'){assert.equal(c.headers.get('authorization'),'Basic '+btoa(variables.MIDTRANS_SERVER_KEY+':'));return Response.json({token:'mock-sandbox-token-runtime'});}
  privileged(c);
  if(c.url.pathname.endsWith('/server_reserve_payment')){assert.deepEqual(c.body,{actor:userId,payment_kind:'rent',resource_id:invoiceId});return Response.json(a);}
  if(c.url.pathname.endsWith('/server_payment_session'))return Response.json({attempt:a,claim:++sessions===1?crypto.randomUUID():null,token:sessions===2?'mock-sandbox-token-runtime':null});
  if(c.url.pathname.endsWith('/server_save_snap'))return Response.json(true);
  throw Error('Unexpected intercepted route');
 });
 const res=await handler('rent')(request({invoice_id:invoiceId}));assert.equal(res.status,200);assert.equal((await res.json()).attempt.status,'pending');
 assert.equal(calls.length,7);assert.ok(!calls.some(c=>c.url.pathname.endsWith('/server_apply_payment')));
}));

Deno.test('runtime: invalid session stops before database and gateway',()=>isolated(async(calls,mock)=>{
 mock(c=>{assert.equal(c.url.pathname,'/auth/v1/user');return Response.json({message:'Invalid JWT',error_code:'bad_jwt'},{status:401});});
 const res=await handler('rent')(request({invoice_id:invoiceId}));assert.equal(res.status,401);assert.equal(calls.length,1);
}));

Deno.test('runtime: status hidden by RLS cannot invoke privileged reconciliation',()=>isolated(async(calls,mock)=>{
 mock(c=>{if(c.url.pathname==='/auth/v1/user')return auth(c);scoped(c);assert.equal(c.url.pathname,'/rest/v1/payment_attempts');return Response.json(null);});
 const res=await handler('status')(request({attempt_id:attemptId,reconcile:true}));assert.equal(res.status,404);assert.equal(calls.length,2);
}));

Deno.test('runtime: public webhook checks signature and fresh provider status before service writer',()=>isolated(async(calls,mock)=>{
 const a=attempt(),incoming={order_id:a.order_id,status_code:'200',gross_amount:'1502000.00',transaction_status:'settlement',signature_key:''};
 incoming.signature_key=await digest(incoming.order_id+incoming.status_code+incoming.gross_amount+variables.MIDTRANS_SERVER_KEY,'SHA-512');
 mock(c=>{
  if(c.url.hostname==='api.sandbox.midtrans.com')return Response.json({...incoming,transaction_id:'mock-gateway-runtime',currency:'IDR',payment_type:'bank_transfer',transaction_status:'pending'});
  privileged(c);
  if(c.url.pathname==='/rest/v1/payment_attempts')return Response.json(a);
  assert.ok(c.url.pathname.endsWith('/server_apply_payment'));assert.equal(c.body.gateway_state,'pending');assert.equal(c.body.verified_gross,1502000);return Response.json(a);
 });
 const res=await handler('webhook')(request(incoming,false));assert.equal(res.status,200);assert.equal(calls.length,3);assert.ok(!calls.some(c=>c.url.pathname.includes('/auth/')));
}));

Deno.test('runtime: unreadable foreign invoice never calls service RPC',()=>isolated(async(calls,mock)=>{
 mock(c=>{if(c.url.pathname==='/auth/v1/user')return auth(c);scoped(c);assert.equal(c.url.pathname,'/rest/v1/invoices');return Response.json(null);});
 const res=await handler('rent')(request({invoice_id:invoiceId}));assert.equal(res.status,404);assert.equal(calls.length,2);
}));
