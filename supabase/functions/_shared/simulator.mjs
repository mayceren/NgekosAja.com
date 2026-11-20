export class PaymentError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
export const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const methods=['qris','virtual_account','bank_transfer','e_wallet'];
export const projectRef='wfmhsbdfdcugxblqsaob';
export function configuration(env){
 if(env('PAYMENT_SIMULATOR_ENABLED')!=='true'||env('PAYMENT_ENVIRONMENT')!=='development'||env('PAYMENT_ALLOWED_PROJECT_REF')!==projectRef||env('SUPABASE_URL')!==`https://${projectRef}.supabase.co`)throw new PaymentError('SIMULATION_DISABLED',503);
 const origins=(env('PAYMENT_ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);
 if(!origins.length||origins.some(o=>{try{const u=new URL(o);return u.origin!==o||!['http:','https:'].includes(u.protocol);}catch{return true;}}))throw new PaymentError('SIMULATION_DISABLED',503);
 return {origins};
}
export function requireDevelopmentUser(user,kind){
 const allowed=kind==='rent'?['dev-tenant-a@ngekosaja.test','dev-tenant-b@ngekosaja.test']:['dev-owner-a@ngekosaja.test','dev-owner-b@ngekosaja.test'];
 if(!uuid(user?.id)||!allowed.includes(user.email?.toLowerCase())||user.app_metadata?.development_fixture!=='ngekosaja-development-auth-v1'||!/^[a-f0-9]{32}$/.test(user.app_metadata?.development_fixture_run||''))throw new PaymentError('DEVELOPMENT_ACCOUNT_REQUIRED',403);
}
export const messages={AUTH_REQUIRED:'Sesi berakhir. Masuk kembali untuk melanjutkan.',FORBIDDEN:'Pembayaran ini tidak tersedia untuk akunmu.',SIMULATION_DISABLED:'Pembayaran simulasi belum tersedia pada lingkungan ini.',DEVELOPMENT_ACCOUNT_REQUIRED:'Simulasi ini hanya tersedia untuk akun pengujian yang diizinkan.',INVALID_REQUEST:'Pilihan pembayaran tidak valid. Periksa lalu coba kembali.',PAYMENT_CONFLICT:'Tagihan atau promosi sudah berubah. Muat ulang untuk melihat status terbaru.',DATABASE_ERROR:'Transaksi belum dapat dikonfirmasi. Periksa status terbaru sebelum mencoba kembali.'};
async function body(req){
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new PaymentError('INVALID_REQUEST',415);
 if(Number(req.headers.get('content-length')||0)>2048)throw new PaymentError('INVALID_REQUEST',413);
 const reader=req.body?.getReader();if(!reader)throw new PaymentError('INVALID_REQUEST');let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
 try{for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>2048){await reader.cancel();throw new PaymentError('INVALID_REQUEST',413);}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 let data;try{data=JSON.parse(text);}catch{throw new PaymentError('INVALID_REQUEST');}if(!data||typeof data!=='object'||Array.isArray(data))throw new PaymentError('INVALID_REQUEST');return data;
}
export function createSimulatorHandler(kind,deps){
 if(!['rent','boost'].includes(kind))throw new Error('Invalid payment handler');
 return async req=>{
  let cors={};const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  try{
   const config=configuration(deps.env),origin=req.headers.get('origin');
   if(origin&&!config.origins.includes(origin))throw new PaymentError('FORBIDDEN',403);
   if(origin)cors={'Access-Control-Allow-Origin':origin,Vary:'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
   if(req.method!=='POST')return respond({code:'METHOD_NOT_ALLOWED'},405);
   const user=await deps.authenticate(req);requireDevelopmentUser(user,kind);
   const data=await body(req),field=kind==='rent'?'invoice_id':'property_id';
   if(Object.keys(data).some(k=>![field,'method','idempotency_key'].includes(k))||!uuid(data[field])||!uuid(data.idempotency_key)||!methods.includes(data.method))throw new PaymentError('INVALID_REQUEST');
   if(!await deps.resource(user,kind,data[field]))throw new PaymentError('FORBIDDEN',404);
   const attempt=await deps.settle(user.id,kind,data[field],data.method,data.idempotency_key);
   // A recorded transaction is the only success signal; transport/UI state is never sufficient.
   if(!uuid(attempt?.id)||!uuid(attempt.transaction_id)||attempt.status!=='succeeded'||attempt.is_simulation!==true||!attempt.completed_at||attempt.payer_id!==user.id||attempt.kind!==kind||attempt[field]!==data[field])throw new PaymentError('DATABASE_ERROR',503);
   return respond({attempt});
  }catch(error){const safe=error instanceof PaymentError?error:new PaymentError('DATABASE_ERROR',503);return respond({code:safe.code,message:messages[safe.code]||messages.INVALID_REQUEST},safe.status);}
 };
}
