import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,webcrypto} from 'node:crypto';
import {configuration,rupiah,digest,validSignature,normalizeStatus,snapRequest,gateway} from '../supabase/functions/_shared/midtrans.mjs';
import {createPaymentHandler} from '../supabase/functions/_shared/payment-handler.mjs';
globalThis.crypto ||= webcrypto;
const keys={MIDTRANS_IS_PRODUCTION:'false',MIDTRANS_SERVER_KEY:'SB-Mid-server-'+randomUUID(),MIDTRANS_CLIENT_KEY:'SB-Mid-client-'+randomUUID(),MIDTRANS_MERCHANT_ID:'MOCK-MERCHANT'};
const env=k=>keys[k];
const uid=randomUUID(),id=randomUUID(),order='NK-SB-'+randomUUID().replaceAll('-','');
const attempt=()=>({id,kind:'rent',invoice_id:randomUUID(),property_id:randomUUID(),payer_id:uid,order_id:order,amount:'1500000',admin_fee:'2000',gross_amount:'1502000',status:'creating',environment:'sandbox',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()});
const status=(a,state='settlement')=>({order_id:a.order_id,transaction_id:'MOCK-'+a.id,gross_amount:'1502000.00',status_code:'200',transaction_status:state,currency:'IDR',payment_type:'bank_transfer',merchant_id:'MOCK-MERCHANT'});
const sign=async p=>({...p,signature_key:await digest(p.order_id+p.status_code+p.gross_amount+keys.MIDTRANS_SERVER_KEY,'SHA-512')});
const request=(body,headers={})=>new Request('http://localhost/function',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer mock-user',...headers},body:JSON.stringify(body)});
function harness(){const a=attempt(),calls=[],state={user:{id:uid},resource:true,claim:true,token:null,raw:status(a)};return {a,calls,state,deps:{env,authenticate:async()=>state.user,gateway:()=>({create:async x=>{calls.push('gateway-create');if(state.failCreate)throw Error('do not disclose credentials');return {token:'mock-checkout-'+x.id};},status:async()=>{calls.push('gateway-status');return state.raw;}}),db:{resource:async()=>state.resource,reserve:async()=>a,session:async(_id,_actor,claim)=>({attempt:a,claim:claim&&state.claim?'lease-id':null,token:state.token}),saveSnap:async(_id,_claim,token)=>{calls.push('save-token');state.token=token;a.status='pending';},order:async()=>state.unknown?null:a,visible:async()=>state.visible===false?null:a,claimReconcile:async()=>state.reconcile!==false,apply:async s=>{calls.push(s);a.status=s.status==='settlement'?'succeeded':s.status;}}}};}
test('configuration rejects production, missing keys and production-style keys',()=>{
 assert.equal(configuration(env).clientKey,keys.MIDTRANS_CLIENT_KEY);
 for(const patch of [{MIDTRANS_IS_PRODUCTION:'true'},{MIDTRANS_IS_PRODUCTION:undefined},{MIDTRANS_SERVER_KEY:'Mid-server-not-sandbox'},{MIDTRANS_CLIENT_KEY:''}])assert.throws(()=>configuration(k=>Object.hasOwn(patch,k)?patch[k]:keys[k]));
});
test('rupiah rejects decimal/nonfinite/unsafe/negative values without rounding',()=>{for(const v of [null,undefined,1.2,-1,'1.01','1e6','NaN','100002001'])assert.throws(()=>rupiah(v));assert.equal(rupiah('1502000.00'),1502000);});
test('Snap request derives item totals, fixed admin fee and explicit bounded Sandbox expiry',()=>{
 const a=attempt(),p=snapRequest(a);assert.equal(p.transaction_details.gross_amount,1502000);assert.equal(p.item_details.reduce((n,i)=>n+i.price*i.quantity,0),1502000);assert.equal(p.item_details[1].price,2000);assert.equal(p.expiry.duration,24);assert.match(p.expiry.start_time,/\+0000$/);
 const b={...a,kind:'boost',amount:'30000',admin_fee:'0',gross_amount:'30000'};assert.equal(snapRequest(b).item_details[0].price,30000);assert.throws(()=>snapRequest({...a,environment:'production'}));
});
test('signature uses exact decimal string with SHA512 and rejects modified payload/signature',async()=>{
 const p=await sign(status(attempt()));assert.equal(await validSignature(p,keys.MIDTRANS_SERVER_KEY),true);assert.equal(await validSignature({...p,gross_amount:'1502000'},keys.MIDTRANS_SERVER_KEY),false);assert.equal(await validSignature({...p,signature_key:'0'.repeat(128)},keys.MIDTRANS_SERVER_KEY),false);assert.equal(await validSignature({...p,status_code:200},keys.MIDTRANS_SERVER_KEY),false);
});
test('status verification binds order, exact amount, IDR currency, merchant, transaction ID and status',()=>{
 const a=attempt(),s=status(a);assert.equal(normalizeStatus(s,a,configuration(env)).status,'settlement');
 for(const change of [{order_id:'other'},{gross_amount:'1500000.00'},{currency:'USD'},{merchant_id:'other'},{transaction_status:'success'},{transaction_id:''},{fraud_status:'unknown'}])assert.throws(()=>normalizeStatus({...s,...change},a,configuration(env)));
 assert.throws(()=>normalizeStatus(s,{...a,gateway_transaction_id:'other'},configuration(env)));
});
test('Midtrans adapter only requests Sandbox hosts, disables redirects and handles outage/invalid token',async()=>{
 const calls=[],api=gateway(configuration(env),async(url,opts)=>{calls.push({url,opts});return Response.json(url.includes('/snap/')?{token:'mock-snap-token-123'}:status(attempt()));});await api.create(attempt());await api.status(order);assert.ok(calls.every(c=>new URL(c.url).hostname.endsWith('.sandbox.midtrans.com')));assert.ok(calls.every(c=>c.opts.redirect==='error'));assert.equal(calls[0].opts.headers.Authorization,'Basic '+btoa(keys.MIDTRANS_SERVER_KEY+':'));
 await assert.rejects(()=>gateway(configuration(env),async()=>{throw Error('secret');}).create(attempt()));await assert.rejects(()=>gateway(configuration(env),async()=>Response.json({token:'x'})).create(attempt()));
 assert.equal(await gateway(configuration(env),async()=>Response.json({status_code:'404'})).status(order),null);
});
test('rent initiation persists token and never settles from initiation',async()=>{const h=harness(),res=await createPaymentHandler('rent',h.deps)(request({invoice_id:h.a.invoice_id}));assert.equal(res.status,200);const body=await res.json();assert.match(body.snap_token,/mock-checkout/);assert.equal(body.attempt.status,'pending');assert.equal(body.attempt.environment,'sandbox');assert.ok(!h.calls.some(c=>c.status==='settlement'));});
test('initiation rejects extra client amount/payer/owner fields and invalid resource IDs',async()=>{
 for(const extra of [{gross_amount:1},{owner_id:uid},{payer_id:uid}]){const h=harness(),res=await createPaymentHandler('rent',h.deps)(request({invoice_id:h.a.invoice_id,...extra}));assert.equal(res.status,400);assert.equal(h.calls.length,0);}
 const h=harness();assert.equal((await createPaymentHandler('boost',h.deps)(request({property_id:'fake'}))).status,400);
});
test('missing authentication and foreign resources cannot create orders',async()=>{
 const h=harness();h.state.user=null;assert.equal((await createPaymentHandler('rent',h.deps)(request({invoice_id:h.a.invoice_id}))).status,401);h.state.user={id:uid};h.state.resource=false;assert.equal((await createPaymentHandler('rent',h.deps)(request({invoice_id:h.a.invoice_id}))).status,404);assert.equal(h.calls.length,0);
});
test('duplicate in-flight create returns pending and does not call gateway again',async()=>{const h=harness();h.state.claim=false;const res=await createPaymentHandler('rent',h.deps)(request({invoice_id:h.a.invoice_id}));assert.equal(res.status,202);assert.equal(h.calls.length,0);});
test('uncertain create failure reconciles the SAME order, no new attempt or invented failure',async()=>{const h=harness();h.state.failCreate=true;h.state.raw=status(h.a,'pending');const res=await createPaymentHandler('rent',h.deps)(request({invoice_id:h.a.invoice_id}));assert.equal(res.status,503);assert.equal(h.a.order_id,order);assert.ok(h.calls.includes('gateway-status'));assert.equal(h.a.status,'pending');assert.ok(!(await res.text()).includes('disclose'));});
test('forged or mismatched webhook cannot reach sensitive processing',async()=>{
 const h=harness(),handler=createPaymentHandler('webhook',h.deps);assert.equal((await handler(request({...status(h.a),signature_key:'0'.repeat(128)}))).status,403);assert.equal(h.calls.length,0);
 const signed=await sign({...status(h.a),gross_amount:'1.00'});assert.equal((await handler(request(signed))).status,409);assert.equal(h.calls.length,0);
});
test('valid signed webhook always verifies status API and ignores forged incoming settlement',async()=>{
 const h=harness();h.state.raw=status(h.a,'pending');const incoming=await sign(status(h.a,'settlement'));const res=await createPaymentHandler('webhook',h.deps)(request(incoming));assert.equal(res.status,200);assert.equal(h.calls[0],'gateway-status');assert.equal(h.a.status,'pending');
});
for(const state of ['pending','settlement','capture','deny','cancel','expire','failure','refund','partial_refund'])test('authenticated gateway status is mapped for '+state,async()=>{const h=harness();h.state.raw=status(h.a,state);const res=await createPaymentHandler('webhook',h.deps)(request(await sign(status(h.a,state))));assert.equal(res.status,200);assert.equal(h.calls.find(c=>typeof c==='object').status,state);});
test('unknown order and status API mismatch fail closed',async()=>{const h=harness();h.state.unknown=true;const handler=createPaymentHandler('webhook',h.deps);assert.equal((await handler(request(await sign(status(h.a))))).status,404);h.state.unknown=false;h.state.raw={...status(h.a),gross_amount:'2000.00'};assert.equal((await handler(request(await sign(status(h.a))))).status,409);assert.ok(!h.calls.some(c=>typeof c==='object'));});
test('status inquiry checks RLS visibility before reconciliation and never returns token',async()=>{
 const h=harness(),handler=createPaymentHandler('status',h.deps);h.state.visible=false;assert.equal((await handler(request({attempt_id:id,reconcile:true}))).status,404);assert.equal(h.calls.length,0);h.state.visible=true;const res=await handler(request({attempt_id:id,reconcile:true}));assert.equal(res.status,200);assert.equal((await res.json()).snap_token,undefined);assert.equal(h.a.status,'succeeded');
});
test('reconciliation throttling avoids repeated gateway requests; CORS/method/payload restrictions',async()=>{
 const h=harness(),handler=createPaymentHandler('status',h.deps);h.state.reconcile=false;assert.equal((await handler(request({attempt_id:id,reconcile:true}))).status,200);assert.equal(h.calls.length,0);
 assert.equal((await handler(request({attempt_id:id},{Origin:'https://untrusted.invalid'}))).status,403);assert.equal((await handler(new Request('http://localhost',{method:'GET'}))).status,405);assert.equal((await handler(request({attempt_id:id,padding:'x'.repeat(3000)}))).status,413);
});
