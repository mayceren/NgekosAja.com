// Sandbox-only adapter. No environment option can select a production endpoint.
export class PaymentError extends Error{constructor(code,status=400){super(code);this.code=code;this.status=status;}}
const fail=(code,status=400)=>{throw new PaymentError(code,status);};
export const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function configuration(env){
 const serverKey=env('MIDTRANS_SERVER_KEY'),clientKey=env('MIDTRANS_CLIENT_KEY');
 if(env('MIDTRANS_IS_PRODUCTION')!=='false'||!/^SB-Mid-server-[\w-]+$/.test(serverKey||'')||!/^SB-Mid-client-[\w-]+$/.test(clientKey||''))fail('PAYMENT_UNAVAILABLE',503);
 return {serverKey,clientKey,merchantId:env('MIDTRANS_MERCHANT_ID')||null};
}
export function rupiah(value){
 if(typeof value!=='string'&&!Number.isSafeInteger(value))fail('INVALID_AMOUNT');const text=String(value);
 if(!/^\d+(?:\.00)?$/.test(text))fail('INVALID_AMOUNT');const n=BigInt(text.split('.')[0]);if(n<1n||n>100002000n)fail('INVALID_AMOUNT');return Number(n);
}
export async function digest(text,algorithm='SHA-256'){const bytes=await crypto.subtle.digest(algorithm,new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function validSignature(payload,key){
 if(typeof payload?.order_id!=='string'||!/^NK-SB-[0-9a-f]{32}$/.test(payload.order_id)||typeof payload.status_code!=='string'||!/^\d{3}$/.test(payload.status_code)||typeof payload.gross_amount!=='string'||!/^\d+(?:\.00)?$/.test(payload.gross_amount)||!/^([a-fA-F0-9]{128})$/.test(payload.signature_key||''))return false;
 const expected=await digest(payload.order_id+payload.status_code+payload.gross_amount+key,'SHA-512'),actual=payload.signature_key.toLowerCase();let diff=0;for(let i=0;i<128;i++)diff|=expected.charCodeAt(i)^actual.charCodeAt(i);return diff===0;
}
export function normalizeStatus(raw,attempt,config){
 if(!raw||raw.order_id!==attempt.order_id||rupiah(raw.gross_amount)!==rupiah(attempt.gross_amount)||raw.currency!=='IDR'||(config.merchantId&&raw.merchant_id!==config.merchantId)||typeof raw.transaction_id!=='string'||raw.transaction_id.length<1||raw.transaction_id.length>100||(attempt.gateway_transaction_id&&attempt.gateway_transaction_id!==raw.transaction_id)||!['pending','settlement','capture','deny','cancel','expire','failure','refund','partial_refund'].includes(raw.transaction_status)||!/^\w{1,80}$/.test(raw.payment_type||''))fail('GATEWAY_MISMATCH',409);
 if(raw.fraud_status&&!['accept','challenge','deny'].includes(raw.fraud_status))fail('GATEWAY_MISMATCH',409);
 return {order_id:raw.order_id,transaction_id:raw.transaction_id,gross_amount:rupiah(raw.gross_amount),status:raw.transaction_status,fraud:raw.fraud_status||null,method:raw.payment_type,refund_amount:raw.refund_amount==null?null:rupiah(raw.refund_amount)};
}
export function snapRequest(a){
 if(a.environment!=='sandbox'||!/^NK-SB-[0-9a-f]{32}$/.test(a.order_id)||rupiah(a.gross_amount)!==Number(a.amount)+Number(a.admin_fee)||!['rent','boost'].includes(a.kind)||(a.kind==='rent'&&Number(a.admin_fee)!==2000)||(a.kind==='boost'&&(Number(a.admin_fee)!==0||Number(a.amount)!==30000)))fail('INVALID_AMOUNT');
 const date=new Date(a.created_at);if(!Number.isFinite(date.getTime()))fail('INVALID_REQUEST');
 return {transaction_details:{order_id:a.order_id,gross_amount:rupiah(a.gross_amount)},item_details:[{id:a.kind==='rent'?'rent':'boost',price:rupiah(a.amount),quantity:1,name:a.kind==='rent'?'Sewa kos - Sandbox':'Boost Listing 30 hari - Sandbox'},...(Number(a.admin_fee)?[{id:'admin',price:2000,quantity:1,name:'Biaya administrasi'}]:[])],expiry:{start_time:date.toISOString().slice(0,19).replace('T',' ')+' +0000',unit:'hour',duration:24},page_expiry:{duration:24,unit:'hour'}};
}
export function gateway(config,fetcher=fetch){
 const request=async(url,body)=>{
  let response;try{response=await fetcher(url,{method:body?'POST':'GET',redirect:'error',headers:{Authorization:'Basic '+btoa(config.serverKey+':'),'Content-Type':'application/json',Accept:'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});}catch{fail('GATEWAY_UNAVAILABLE',503);}
  let data;try{data=await response.json();}catch{fail('GATEWAY_UNAVAILABLE',503);}
  if(response.status===404||data?.status_code==='404')return null;
  if(!response.ok||[401,403].includes(Number(data?.status_code)))fail('GATEWAY_UNAVAILABLE',503);return data;
 };
 return {
  async create(a){const data=await request('https://app.sandbox.midtrans.com/snap/v1/transactions',snapRequest(a));if(!data||!/^[\w-]{10,200}$/.test(data.token||''))fail('GATEWAY_UNAVAILABLE',503);return {token:data.token};},
  async status(order){if(!/^NK-SB-[0-9a-f]{32}$/.test(order))fail('INVALID_REQUEST');return request('https://api.sandbox.midtrans.com/v2/'+encodeURIComponent(order)+'/status');}
 };
}
