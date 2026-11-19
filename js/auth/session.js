(function(A){
'use strict';
let generation=0,subscription,booting=false,resolving;
A.ready=false;A.user=null;A.roles=[];A.effectiveRoles=[];A.profile=null;A.recoveryUid=null;
A.clearIdentity=()=>{generation++;resolving=null;A.user=null;A.profile=null;A.roles=[];A.effectiveRoles=[];A.hasAgreement=false;};
A.resolveIdentity=async(force=false)=>{
 if(force){generation++;resolving=null;}
 if(resolving)return resolving;
 const ticket=++generation;
 const task=(async()=>{
  try{
   const user=await A.authService.verifiedUser();
   const [profile,rights]=await Promise.all([A.profileService.load(user.id),A.roleService.load(user.id)]);
   if(ticket!==generation||A.mode!=='connected')return false;
   A.user=user;A.profile=profile;Object.assign(A,rights);A.identityError='';A.lastVerified=Date.now();return true;
  }catch(error){if(ticket!==generation)return false;A.clearIdentity();throw error;}
 })();
 resolving=task;try{return await task;}finally{if(resolving===task)resolving=null;}
};
A.dispose=()=>{subscription?.unsubscribe();subscription=null;A.client?.auth.stopAutoRefresh();A.client?.realtime.disconnect();A.client=null;A.clearIdentity();A.ready=true;A.catalogue=undefined;};
A.refreshIdentity=async(force=true)=>{try{await A.resolveIdentity(force);}catch(e){A.clearIdentity();A.identityError=A.errorMessage(e);}window.NK?.render?.();};
A.start=async()=>{
 if(booting)return;booting=true;
 try{
  if(A.mode==='demo'){A.ready=true;return;}
  A.configurationError=A.configError();if(A.configurationError){A.ready=true;if(A.initialCallback.present){A.clearCallback();location.hash='#/session-expired';}return;}
  const client=A.createClient();
  subscription=client.auth.onAuthStateChange((event,session)=>{
   // Never call an async SDK method inside this callback: SDK holds its auth lock.
   if(event==='PASSWORD_RECOVERY'&&session?.user?.id)A.recoveryUid=session.user.id;
   if(event==='SIGNED_IN'&&A.user&&session?.user?.id!==A.user.id)A.clearIdentity();
   if(event==='SIGNED_OUT'){A.clearIdentity();A.recoveryUid=null;}
   if(!booting)setTimeout(async()=>{
    if(A.mode!=='connected')return;
    if(session){await A.refreshIdentity(false);if(event==='PASSWORD_RECOVERY')window.NK?.navigate('reset');}
    else{window.NK?.render?.();}
   },0);
  }).data.subscription;
  let initError;
  if(A.initialCallback.code){
   // SDK 2.99.3 automatic PKCE initialization drops redirectType. Explicit exchange
   // preserves the SDK's recovery marker, rather than trusting a URL flow label.
   const {data,error}=await client.auth.exchangeCodeForSession(A.initialCallback.code);initError=error;
   if(!error&&data.redirectType==='PASSWORD_RECOVERY')A.recoveryUid=data.user?.id;
   A.initialCallback.code=null;
  }else if(A.initialCallback.tokenHash){
   if(!['signup','recovery','email_change','email','magiclink','invite'].includes(A.initialCallback.type)){throw A.fail('Jenis tautan autentikasi tidak didukung.');}
   const {data,error}=await client.auth.verifyOtp({token_hash:A.initialCallback.tokenHash,type:A.initialCallback.type});initError=error;
   if(!error&&A.initialCallback.type==='recovery')A.recoveryUid=data.user?.id;
   A.initialCallback.tokenHash=null;
  }else{const result=await client.auth.initialize();initError=result.error;}
  const {data,error}=await client.auth.getSession();if(error)throw error;
  // Allow the official PASSWORD_RECOVERY event queued by SDK initialization to run.
  await new Promise(resolve=>setTimeout(resolve,0));
  if(initError||A.initialCallback.hasError)throw initError||A.fail('Tautan tidak valid atau telah kedaluwarsa.');
  if(data.session)await A.resolveIdentity();
  if(A.initialCallback.present){
   const recovery=A.recoveryUid&&A.user?.id===A.recoveryUid;
   A.clearCallback();history.replaceState(null,'',location.pathname+location.search+'#/'+(recovery?'reset':A.user?A.defaultPath():'verify'));
   if(A.user&&!recovery)A.notice='Email terverifikasi. Akunmu siap digunakan.';
  }
 }catch(e){
  A.clearIdentity();A.identityError=A.errorMessage(e);
  if(A.initialCallback.present){A.clearCallback();history.replaceState(null,'',location.pathname+location.search+'#/session-expired');}
 }finally{A.ready=true;booting=false;}
};
window.addEventListener('focus',()=>{if(A.mode==='connected'&&A.user&&Date.now()-A.lastVerified>30000)A.refreshIdentity();});
window.addEventListener('storage',event=>{if(event.key==='ngekosaja.mode.v3'&&event.newValue!==A.mode)location.reload();});
})(window.NA);
