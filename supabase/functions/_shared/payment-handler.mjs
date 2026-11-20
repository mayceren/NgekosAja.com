import {PaymentError,configuration,uuid,validSignature,normalizeStatus,digest,gateway} from './midtrans.mjs';
const messages={AUTH_REQUIRED:'Sesi berakhir. Masuk kembali untuk melanjutkan.',FORBIDDEN:'Pembayaran ini tidak tersedia untuk akunmu.',INVALID_REQUEST:'Permintaan pembayaran tidak valid.',PAYMENT_UNAVAILABLE:'Pembayaran Sandbox belum tersedia. Hubungi pengelola.',GATEWAY_UNAVAILABLE:'Layanan pembayaran belum dapat dihubungi. Periksa status sebelum mencoba lagi.',GATEWAY_MISMATCH:'Data pembayaran belum cocok. Status memerlukan pemeriksaan.',INVALID_SIGNATURE:'Notifikasi pembayaran tidak valid.',PAYMENT_BUSY:'Pembayaran sedang disiapkan. Periksa status beberapa saat lagi.',DATABASE_ERROR:'Pembayaran belum dapat diproses. Periksa status lalu coba kembali.'};
async function jsonBody(req,max){
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new PaymentError('INVALID_REQUEST',415);
 if(Number(req.headers.get('content-length')||0)>max)throw new PaymentError('INVALID_REQUEST',413);
 const reader=req.body?.getReader();if(!reader)throw new PaymentError('INVALID_REQUEST');let total=0;const chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new PaymentError('INVALID_REQUEST',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}let obj;try{obj=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new PaymentError('INVALID_REQUEST');}
 if(!obj||Array.isArray(obj)||typeof obj!=='object')throw new PaymentError('INVALID_REQUEST');return obj;
}
const exact=(body,keys)=>{if(Object.keys(body).some(k=>!keys.includes(k)))throw new PaymentError('INVALID_REQUEST');};
const publicAttempt=a=>{const {id,kind,invoice_id,property_id,order_id,amount,admin_fee,gross_amount,status,payment_method,transaction_id,verified_at,expires_at,created_at}=a;return {id,kind,invoice_id,property_id,order_id,amount,admin_fee,gross_amount,status,payment_method,transaction_id,verified_at,expires_at,created_at,environment:'sandbox'};};
export function createPaymentHandler(kind,deps){
 return async req=>{
  const origin=req.headers.get('origin'),allowed=(deps.env('PAYMENT_ALLOWED_ORIGINS')||'http://127.0.0.1:5500,http://localhost:5500').split(',').map(v=>v.trim());
  const cors=origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{};
  const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(kind!=='webhook'&&origin&&!allowed.includes(origin))return respond({code:'FORBIDDEN',message:messages.FORBIDDEN},403);
  if(req.method==='OPTIONS'&&kind!=='webhook')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return respond({code:'METHOD_NOT_ALLOWED'},405);
  try{
   const user=kind==='webhook'?null:await deps.authenticate(req);if(kind!=='webhook'&&!uuid(user?.id))throw new PaymentError('AUTH_REQUIRED',401);
   const body=await jsonBody(req,kind==='webhook'?32768:2048),config=configuration(deps.env),api=deps.gateway?.(config)||gateway(config,deps.fetcher),db=deps.db;
   const reconcile=async attempt=>{
    const raw=await api.status(attempt.order_id);if(!raw)return false;
    const normalized=normalizeStatus(raw,attempt,config),hash=await digest(JSON.stringify(normalized));await db.apply(normalized,hash);return true;
   };
   if(kind==='webhook'){
    if(!await validSignature(body,config.serverKey))throw new PaymentError('INVALID_SIGNATURE',403);
    const attempt=await db.order(body.order_id);if(!attempt)throw new PaymentError('FORBIDDEN',404);
    // Signature alone never settles. A fresh authenticated Sandbox status response is authoritative.
    if(String(attempt.gross_amount)!==String(Number(body.gross_amount)))throw new PaymentError('GATEWAY_MISMATCH',409);
    if(!await reconcile(attempt))throw new PaymentError('GATEWAY_UNAVAILABLE',503);
    return respond({received:true});
   }
   if(kind==='status'){
    exact(body,['attempt_id','reconcile']);if(!uuid(body.attempt_id)||(body.reconcile!==undefined&&typeof body.reconcile!=='boolean'))throw new PaymentError('INVALID_REQUEST');
    const attempt=await db.visible(user,body.attempt_id);if(!attempt)throw new PaymentError('FORBIDDEN',404);
    if(body.reconcile&&await db.claimReconcile(attempt.id,user.id))await reconcile(attempt);
    const latest=await db.visible(user,attempt.id);return respond({attempt:publicAttempt(latest)});
   }
   const field=kind==='rent'?'invoice_id':'property_id';exact(body,[field]);if(!uuid(body[field]))throw new PaymentError('INVALID_REQUEST');
   // Ordinary user JWT and RLS first, authoritative service RPC rechecks identity/ownership.
   if(!await db.resource(user,kind,body[field]))throw new PaymentError('FORBIDDEN',404);
   const attempt=await db.reserve(user.id,kind,body[field]);let session=await db.session(attempt.id,user.id,true);
   if(session.claim){
    try{const snap=await api.create(attempt);await db.saveSnap(attempt.id,session.claim,snap.token);}
    catch(error){try{await reconcile(attempt);}catch{/* Unknown create outcome stays durable; do not create a second order. */}throw error;}
    session=await db.session(attempt.id,user.id,false);
   }
   if(!session.token)return respond({attempt:publicAttempt(session.attempt),code:'PAYMENT_BUSY',message:messages.PAYMENT_BUSY},202);
   return respond({attempt:publicAttempt(session.attempt),snap_token:session.token,client_key:config.clientKey});
  }catch(error){const safe=error instanceof PaymentError?error:new PaymentError('DATABASE_ERROR',503);return respond({code:safe.code,message:messages[safe.code]||messages.INVALID_REQUEST},safe.status);}
 };
}
