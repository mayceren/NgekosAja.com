import {createClient} from 'npm:@supabase/supabase-js@2.99.3';
import {createPaymentHandler} from './payment-handler.mjs';
import {PaymentError} from './midtrans.mjs';
type Caller={id:string;token:string};
export function handler(kind:'rent'|'boost'|'status'|'webhook'){
 const env=(key:string)=>Deno.env.get(key);
 const clients=()=>{
  const url=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key||!service)throw new PaymentError('PAYMENT_UNAVAILABLE',503);
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  return {url,key,options,admin:createClient(url,service,options)};
 };
 const unwrap=async(query:PromiseLike<{data:unknown;error:unknown}>)=>{const {data,error}=await query;if(error)throw new PaymentError('DATABASE_ERROR',503);return data;};
 const userClient=(user:Caller)=>{const c=clients();return createClient(c.url,c.key,{...c.options,global:{headers:{Authorization:'Bearer '+user.token}}});};
 const rpc=async(name:string,args:Record<string,unknown>)=>{const data=await unwrap(clients().admin.rpc(name,args));return Array.isArray(data)?data[0]:data;};
 return createPaymentHandler(kind,{env,
  async authenticate(req:Request){
   const token=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];if(!token)throw new PaymentError('AUTH_REQUIRED',401);
   const c=clients(),{data,error}=await createClient(c.url,c.key,c.options).auth.getUser(token);if(error||!data.user)throw new PaymentError('AUTH_REQUIRED',401);
   return {id:data.user.id,token};
  },
  db:{
   async resource(user:Caller,kind:string,id:string){
    if(kind==='boost'){const row=await unwrap(userClient(user).from('properties').select('id,owner_id,publication_status').eq('id',id).maybeSingle()) as {owner_id:string;publication_status:string}|null;return !!row&&row.owner_id===user.id&&row.publication_status==='published';}
    const row=await unwrap(userClient(user).from('invoices').select('id,rental_agreements!inner(tenant_id)').eq('id',id).eq('rental_agreements.tenant_id',user.id).maybeSingle());return !!row;
   },
   reserve:(actor:string,payment_kind:string,resource_id:string)=>rpc('server_reserve_payment',{actor,payment_kind,resource_id}),
   session:(target_attempt:string,actor:string,claim:boolean)=>rpc('server_payment_session',{target_attempt,actor,claim}),
   saveSnap:(target_attempt:string,claim_id:string,token:string)=>rpc('server_save_snap',{target_attempt,claim_id,token}),
   async visible(user:Caller,id:string){return unwrap(userClient(user).from('payment_attempts').select('*').eq('id',id).maybeSingle());},
   async order(order:string){return unwrap(clients().admin.from('payment_attempts').select('*').eq('order_id',order).maybeSingle());},
   claimReconcile:(target_attempt:string,actor:string)=>rpc('server_claim_reconciliation',{target_attempt,actor}),
   apply:(s:{order_id:string;transaction_id:string;gross_amount:number;status:string;fraud:string;method:string},event_hash:string)=>rpc('server_apply_payment',{target_order:s.order_id,gateway_id:s.transaction_id,verified_gross:s.gross_amount,gateway_state:s.status,fraud:s.fraud,method:s.method,event_hash})
  }
 });
}
