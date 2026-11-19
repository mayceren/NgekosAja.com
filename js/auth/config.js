(function(w){
'use strict';
const A=w.NA={};
A.safeRead=(store,key)=>{try{return store.getItem(key);}catch{return null;}};
A.safeWrite=(store,key,value)=>{try{value===null?store.removeItem(key):store.setItem(key,value);return true;}catch{return false;}};
A.mode=(()=>{try{return A.safeRead(w.localStorage,'ngekosaja.mode.v3')==='demo'?'demo':'connected';}catch{return 'connected';}})();
A.config=w.NGEKOSAJA_PUBLIC_CONFIG||{};
A.configError=()=>{
 try{void w.localStorage;void w.sessionStorage;}catch{return 'Browser memblokir penyimpanan sesi. Izinkan penyimpanan situs untuk masuk, atau gunakan Demo Mode.';}
 try{const u=new URL(A.config.supabaseUrl);if(!((u.protocol==='https:'&&u.hostname.endsWith('.supabase.co'))||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error();}catch{return 'Alamat Supabase belum valid. Periksa config/runtime.js.';}
 if(!/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(A.config.publishableKey||''))return 'Publishable Key belum tersedia. Isi konfigurasi publik di config/runtime.js atau jalankan npm run auth:configure.';
 if(!/^https?:$/.test(location.protocol))return 'Connected Mode memerlukan HTTP. Buka melalui Live Server atau npm run dev. Demo tetap dapat dibuka langsung.';
 if(!w.supabase?.createClient)return 'SDK Supabase belum tersedia. Jalankan npm run auth:configure.';
 return '';
};
A.callbackUrl=flow=>{const u=new URL('index.html',location.href);u.hash='';u.search='';u.searchParams.set('auth_flow',flow);return u.href;};
A.initialCallback=(()=>{const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.replace(/^#/,''));return {present:q.has('code')||q.has('token_hash')||q.has('access_token')||h.has('access_token')||q.has('error')||h.has('error'),code:q.get('code'),flow:q.get('auth_flow'),hasError:q.has('error')||h.has('error'),tokenHash:q.get('token_hash'),type:q.get('type')};})();
if(A.initialCallback.present)A.mode='connected';
A.clearCallback=()=>{const u=new URL(location.href);for(const key of ['code','auth_flow','token_hash','type','error','error_code','error_description','state','access_token','refresh_token','expires_in','expires_at','token_type','provider_token','provider_refresh_token'])u.searchParams.delete(key);u.hash='';history.replaceState(null,'',u.pathname+u.search);Object.assign(A.initialCallback,{present:false,hasError:false,code:null,tokenHash:null});};
A.setMode=mode=>{if(!['demo','connected'].includes(mode))return;A.mode=mode;try{A.safeWrite(w.localStorage,'ngekosaja.mode.v3',mode);}catch{}if(mode==='demo')A.dispose?.();else A.ready=false;};
})(window);
