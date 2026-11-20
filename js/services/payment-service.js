(function(A,B,N){
 'use strict';
 const P=window.NPay={enabled:false,serverEnabled:false,epoch:0,inflight:new Map(),keys:new Map(),scope:''};
 P.methods=[['qris','QRIS','grid','Ilustrasi pembayaran QR, tanpa kode yang dapat dipindai.'],['virtual_account','Virtual Account','building','Ilustrasi virtual account, tanpa nomor rekening.'],['bank_transfer','Transfer Bank','receipt','Ilustrasi transfer bank, tanpa pemindahan dana.'],['e_wallet','E-Wallet','wallet','Ilustrasi dompet digital, tanpa saldo atau PIN.']];
 P.methodLabel=id=>P.methods.find(m=>m[0]===id)?.[1]||id;
 P.check=async()=>{
  if(A.mode!=='connected')return false;const scope=B.scope();if(P.scope!==scope){P.scope=scope;P.capability=null;P.enabled=false;P.serverEnabled=false;}
  if(!P.capability){const epoch=P.epoch;P.capability=B.rpc('payment_capabilities').then(c=>{if(scope!==B.scope()||epoch!==P.epoch)return false;P.serverEnabled=c?.enabled===true;return P.enabled=c?.version===5&&c.provider==='internal-simulator'&&c.environment==='development';}).catch(()=>false);}return P.capability;
 };
 P.allowed=kind=>{const u=A.user,emails=kind==='rent'?['dev-tenant-a@ngekosaja.test','dev-tenant-b@ngekosaja.test']:['dev-owner-a@ngekosaja.test','dev-owner-b@ngekosaja.test'];return P.serverEnabled&&emails.includes(u?.email?.toLowerCase())&&u?.app_metadata?.development_fixture==='ngekosaja-development-auth-v1';};
 const errors={AUTH_REQUIRED:'Sesi berakhir. Masuk kembali untuk melanjutkan.',FORBIDDEN:'Pembayaran ini tidak tersedia untuk akunmu.',SIMULATION_DISABLED:'Pembayaran simulasi belum tersedia pada lingkungan ini.',DEVELOPMENT_ACCOUNT_REQUIRED:'Simulasi ini hanya tersedia untuk akun pengujian yang diizinkan.',PAYMENT_CONFLICT:'Data pembayaran berubah. Muat ulang untuk memeriksa status terbaru.',INVALID_REQUEST:'Periksa kembali metode pembayaran yang dipilih.',DATABASE_ERROR:'Transaksi belum dapat dikonfirmasi. Periksa status terbaru sebelum mencoba kembali.'};
 P.invoke=async(name,body)=>{
  if(A.mode!=='connected'||!A.user)throw B.fail('Masuk untuk melanjutkan pembayaran.');
  const scope=B.scope(),epoch=P.epoch;try{await A.authService.verifiedUser();}catch(error){throw B.fail(error?.status===401||error?.code==='session_not_found'?errors.AUTH_REQUIRED:'Sesi belum dapat diperiksa. Periksa koneksi lalu coba kembali.');}
  if(scope!==B.scope()||epoch!==P.epoch)throw Object.assign(new Error('stale'),{code:'STALE'});
  const {data,error}=await B.client().functions.invoke(name,{body});
  if(scope!==B.scope()||epoch!==P.epoch)throw Object.assign(new Error('stale'),{code:'STALE'});
  if(error){let code;try{code=(await error.context?.json())?.code;}catch{}throw B.fail(errors[code]||(error.context?.status===401?errors.AUTH_REQUIRED:errors.DATABASE_ERROR));}return data;
 };
 P.confirm=(kind,id,method)=>{
  if(!['rent','boost'].includes(kind)||!P.methods.some(m=>m[0]===method))return Promise.reject(B.fail('Pilih metode simulasi yang tersedia.'));
  const scope=B.scope(),epoch=P.epoch,key=scope+':'+kind+':'+id+':'+method;if(P.inflight.has(key))return P.inflight.get(key);
  const storageKey='nka:simulation:'+key;let requestKey=P.keys.get(key);if(!requestKey){try{requestKey=sessionStorage.getItem(storageKey);}catch{}if(!/^[0-9a-f-]{36}$/i.test(requestKey||''))requestKey=crypto.randomUUID();P.keys.set(key,requestKey);try{sessionStorage.setItem(storageKey,requestKey);}catch{}}
  const task=P.invoke('simulate-'+kind+'-payment',{[kind==='rent'?'invoice_id':'property_id']:id,method,idempotency_key:requestKey}).then(data=>{
   const a=data?.attempt;if(!a||a.status!=='succeeded'||a.is_simulation!==true||!a.transaction_id||!a.completed_at||a.kind!==kind||a.payer_id!==A.user?.id||a[kind==='rent'?'invoice_id':'property_id']!==id)throw B.fail(errors.DATABASE_ERROR);
   if(scope!==B.scope()||epoch!==P.epoch)throw Object.assign(new Error('stale'),{code:'STALE'});P.keys.delete(key);try{sessionStorage.removeItem(storageKey);}catch{}return a;
  }).finally(()=>{if(P.inflight.get(key)===task)P.inflight.delete(key);});P.inflight.set(key,task);return task;
 };
 P.invalidate=()=>{for(const key of [...B.cache.keys()])if(key.startsWith(B.scope()+':route:')||key.includes('notification-indicator'))B.cache.delete(key);window.NP?.invalidate();window.NP?.notifications?.();};
 const clear=A.clearIdentity;A.clearIdentity=()=>{P.epoch++;P.enabled=false;P.serverEnabled=false;P.capability=null;P.scope='';P.inflight.clear();P.keys.clear();try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith('nka:simulation:'))sessionStorage.removeItem(k);}}catch{}clear();};
})(window.NA,window.NB,window.NK);
