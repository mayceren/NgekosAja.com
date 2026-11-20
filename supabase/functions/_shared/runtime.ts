import {createClient} from 'npm:@supabase/supabase-js@2.99.3';
import {createSimulatorHandler,PaymentError} from './simulator.mjs';
type Caller={id:string;token:string};
export function handler(kind:'rent'|'boost'){
 const env=(key:string)=>Deno.env.get(key);
 const clients=()=>{
  const url=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key||!service)throw new PaymentError('SIMULATION_DISABLED',503);
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  return {url,key,service,options};
 };
 const userClient=(user:Caller)=>{const c=clients();return createClient(c.url,c.key,{...c.options,global:{headers:{Authorization:'Bearer '+user.token}}});};
 return createSimulatorHandler(kind,{env,
  async authenticate(req:Request){
   const token=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];if(!token)throw new PaymentError('AUTH_REQUIRED',401);
   const c=clients(),{data,error}=await createClient(c.url,c.key,c.options).auth.getUser(token);if(error||!data.user)throw new PaymentError('AUTH_REQUIRED',401);
   return {...data.user,token};
  },
  async resource(user:Caller,paymentKind:string,id:string){
   const client=userClient(user);
   const query=paymentKind==='rent'?client.from('invoices').select('id,rental_agreements!inner(tenant_id)').eq('id',id).eq('rental_agreements.tenant_id',user.id):client.from('properties').select('id,owner_id,publication_status').eq('id',id).eq('owner_id',user.id).eq('publication_status','published');
   const {data,error}=await query.maybeSingle();if(error)throw new PaymentError('DATABASE_ERROR',503);return !!data;
  },
  async settle(actor:string,payment_kind:string,resource_id:string,simulated_method:string,request_key:string){
   const c=clients(),{data,error}=await createClient(c.url,c.service,c.options).rpc('server_simulate_payment',{actor,payment_kind,resource_id,simulated_method,request_key});
   if(error){const code=String(error.message||'');if(code.includes('SIMULATION_DISABLED'))throw new PaymentError('SIMULATION_DISABLED',503);if(error.code==='42501')throw new PaymentError('FORBIDDEN',403);if(['22023','23505','23P01','P0001'].includes(error.code||''))throw new PaymentError('PAYMENT_CONFLICT',409);throw new PaymentError('DATABASE_ERROR',503);}
   return Array.isArray(data)?data[0]:data;
  }
 });
}
