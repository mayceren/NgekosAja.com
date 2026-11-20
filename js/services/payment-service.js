(function(A,B,N){
 'use strict';
 const P=window.NPay={enabled:false,epoch:0,inflight:new Map(),scope:'',snap:null};
 P.check=async()=>{
  if(A.mode!=='connected')return false;const scope=B.scope();if(P.scope!==scope){P.scope=scope;P.capability=null;P.enabled=false;}
  if(!P.capability){const epoch=P.epoch;P.capability=B.rpc('payment_capabilities').then(c=>{if(scope!==B.scope()||epoch!==P.epoch)return false;return P.enabled=c?.version===5&&c.environment==='sandbox';}).catch(()=>false);}return P.capability;
 };
 const errors={AUTH_REQUIRED:'Sesi berakhir. Masuk kembali untuk melanjutkan.',FORBIDDEN:'Pembayaran ini tidak tersedia untuk akunmu.',PAYMENT_UNAVAILABLE:'Pembayaran Sandbox belum diaktifkan. Hubungi pengelola.',GATEWAY_UNAVAILABLE:'Layanan Sandbox belum dapat dihubungi. Periksa status sebelum mencoba lagi.',GATEWAY_MISMATCH:'Data pembayaran perlu diperiksa pengelola.',PAYMENT_BUSY:'Pembayaran sedang disiapkan. Gunakan Periksa status beberapa saat lagi.'};
 P.invoke=async(name,body)=>{
  if(A.mode!=='connected'||!A.user)throw B.fail('Masuk untuk melanjutkan pembayaran.');
  const scope=B.scope(),epoch=P.epoch;try{await A.authService.verifiedUser();}catch(error){throw B.fail(error?.status===401||error?.code==='session_not_found'?errors.AUTH_REQUIRED:'Sesi belum dapat diperiksa. Periksa koneksi lalu coba kembali.');}
  if(scope!==B.scope()||epoch!==P.epoch)throw Object.assign(new Error('stale'),{code:'STALE'});
  const {data,error}=await B.client().functions.invoke(name,{body});
  if(scope!==B.scope()||epoch!==P.epoch)throw Object.assign(new Error('stale'),{code:'STALE'});
  if(error){let code;const status=error.context?.status;try{code=(await error.context?.json())?.code;}catch{}throw B.fail(errors[code]||(status===401?errors.AUTH_REQUIRED:'Pembayaran belum dapat diproses. Periksa koneksi, konfigurasi Sandbox, dan status terbaru.'));}
  return data;
 };
 P.initiate=(kind,id)=>{
  const key=B.scope()+':'+kind+':'+id;if(P.inflight.has(key))return P.inflight.get(key);
  const task=P.invoke('create-'+kind+'-payment',{[kind==='rent'?'invoice_id':'property_id']:id}).finally(()=>{if(P.inflight.get(key)===task)P.inflight.delete(key);});P.inflight.set(key,task);return task;
 };
 P.status=(id,reconcile=true)=>P.invoke('payment-status',{attempt_id:id,reconcile});
 P.loadSnap=clientKey=>{
  if(!/^SB-Mid-client-[\w-]+$/.test(clientKey||''))return Promise.reject(B.fail('Konfigurasi Snap Sandbox belum valid.'));
  if(P.snap&&P.snapKey===clientKey)return P.snap;
  if(P.snapKey&&P.snapKey!==clientKey)return Promise.reject(B.fail('Konfigurasi pembayaran berubah. Muat ulang halaman.'));
  P.snapKey=clientKey;
  P.snap=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://app.sandbox.midtrans.com/snap/snap.js';script.dataset.clientKey=clientKey;script.async=true;
   const timer=setTimeout(()=>{script.remove();P.snap=null;reject(B.fail('Snap belum dapat dimuat. Periksa koneksi lalu coba kembali.'));},15000);
   script.onload=()=>{clearTimeout(timer);if(window.snap?.pay)resolve(window.snap);else{script.remove();P.snap=null;reject(B.fail('Snap Sandbox belum tersedia.'));}};
   script.onerror=()=>{clearTimeout(timer);script.remove();P.snap=null;reject(B.fail('Snap Sandbox gagal dimuat. Periksa koneksi lalu coba kembali.'));};document.head.append(script);
  });return P.snap;
 };
 P.refresh=()=>{window.NP?.invalidate();if(window.NP?.enabled)window.NP.refresh();else{for(const k of [...B.cache.keys()])if(k.startsWith(B.scope()+':route:'))B.cache.delete(k);N.render();}};
 P.open=async response=>{
  if(!response?.attempt?.id||response.attempt.environment!=='sandbox')throw B.fail('Rincian pembayaran Sandbox tidak valid.');
  if(!response.snap_token){N.toast(response.message||errors.PAYMENT_BUSY);P.refresh();return;}
  if(!/^[\w-]{10,200}$/.test(response.snap_token))throw B.fail('Token Snap belum valid.');
  const scope=B.scope(),epoch=P.epoch,snap=await P.loadSnap(response.client_key);if(scope!==B.scope()||epoch!==P.epoch)return;
  N.closeModal();P.refresh();
  let checking=false;
  const verify=async()=>{if(checking||scope!==B.scope()||epoch!==P.epoch)return;checking=true;try{const result=await P.status(response.attempt.id);if(scope!==B.scope()||epoch!==P.epoch)return;N.toast(result.attempt.status==='succeeded'?'Pembayaran Sandbox terverifikasi oleh server.':'Status belum lunas. Periksa perkembangan pembayaran.');P.refresh();}catch(error){if(scope===B.scope())N.toast(B.error(error),true);}finally{checking=false;}};
  // Popup results/redirect parameters never modify invoice, ledger or campaign status.
  snap.pay(response.snap_token,{onSuccess:verify,onPending:verify,onError:verify,onClose:verify});
 };
 const clear=A.clearIdentity;A.clearIdentity=()=>{P.epoch++;P.enabled=false;P.capability=null;P.scope='';P.inflight.clear();try{window.snap?.hide?.();}catch{}clear();};
})(window.NA,window.NB,window.NK);
