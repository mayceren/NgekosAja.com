(function(A){
'use strict';
const key='ngekosaja.auth.v3',preference='ngekosaja.auth.remember.v3';
const verifier=key+'-code-verifier',expiry=verifier+'.expires_at',verifierLifetime=60*60*1000;
const store=()=>A.safeRead(localStorage,preference)==='yes'?localStorage:sessionStorage;
const removeVerifier=()=>{for(const s of [localStorage,sessionStorage])A.safeWrite(s,verifier,null);A.safeWrite(localStorage,expiry,null);};
const writeVerifier=value=>{
 if(!A.safeWrite(localStorage,expiry,String(Date.now()+verifierLifetime))||!A.safeWrite(localStorage,verifier,value)){removeVerifier();throw A.fail('Penyimpanan tautan tidak tersedia. Izinkan penyimpanan situs lalu coba lagi.');}
 A.safeWrite(sessionStorage,verifier,null);
};
A.authStorage={
 getItem(name){
  if(name!==verifier)return A.safeRead(store(),name);
  // Email apps commonly open another tab. Share ONLY the short-lived PKCE
  // verifier across tabs; unremembered access/refresh sessions stay tab-scoped.
  const until=A.safeRead(localStorage,expiry);
  if(until&&(!Number.isFinite(Number(until))||Date.now()>=Number(until))){removeVerifier();return null;}
  const value=A.safeRead(localStorage,verifier)||A.safeRead(sessionStorage,verifier);
  if(value&&!until)writeVerifier(value); // Migrate a flow started by the old build.
  return value;
 },
 setItem(name,value){if(name===verifier){writeVerifier(value);return;}if(!A.safeWrite(store(),name,value))throw A.fail('Penyimpanan sesi tidak tersedia. Izinkan penyimpanan situs lalu coba lagi.');},
 removeItem(name){if(name===verifier)removeVerifier();else A.safeWrite(store(),name,null);}
};
A.setRemember=remember=>{
 const previous=store(),next=remember?localStorage:sessionStorage;
 if(!A.safeWrite(localStorage,preference,remember?'yes':'no'))throw A.fail('Preferensi sesi tidak dapat disimpan pada browser ini.');
 for(const suffix of ['', '-user']){const name=key+suffix,value=A.safeRead(previous,name);if(previous!==next){if(value&&!A.safeWrite(next,name,value))throw A.fail('Penyimpanan sesi tidak tersedia.');A.safeWrite(previous,name,null);}}
};
A.createClient=()=>{
 if(A.mode!=='connected')throw A.fail('Layanan akun sungguhan hanya tersedia pada Connected Mode.');
 if(A.client)return A.client;
 const error=A.configError();if(error)throw A.fail(error);
 A.client=window.supabase.createClient(A.config.supabaseUrl,A.config.publishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:!A.initialCallback.code,storage:A.authStorage,storageKey:key},global:{headers:{'X-Client-Info':'ngekosaja-phase2'}}});
 return A.client;
};
A.clearStoredSession=()=>{for(const s of [localStorage,sessionStorage])for(const suffix of ['','-user'])A.safeWrite(s,key+suffix,null);removeVerifier();};
})(window.NA);
