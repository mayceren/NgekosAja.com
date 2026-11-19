(function(A){
'use strict';
A.authService={
 // getUser validates the session with Auth. Email-confirmation requirements belong
 // to GoTrue configuration, not a frontend flag; anonymous sessions are not supported.
 async verifiedUser(){const {data,error}=await A.client.auth.getUser();if(error)throw error;if(!data.user||data.user.is_anonymous||!data.user.email)throw A.fail('Sesi akun tidak valid. Silakan masuk kembali.');return data.user;},
 async signup({name,email,password,confirmation,intent,consent}){
  if(!name?.trim()||name.trim().length>70)throw A.fail('Nama wajib diisi, maksimal 70 karakter.');
  if(!consent)throw A.fail('Setujui ketentuan penggunaan terlebih dahulu.');
  if(!['prospect','owner-request'].includes(intent))throw A.fail('Pilih jenis pendaftaran yang tersedia.');
  A.requirePassword(password,confirmation);A.setRemember(false);
  // Intent is informational only. Auth trigger creates the profile and prospect role.
  const {data,error}=await A.createClient().auth.signUp({email:email.trim(),password,options:{emailRedirectTo:A.callbackUrl('verify'),data:{display_name:name.trim(),signup_intent:intent}}});if(error)throw error;
  if(!data?.user)throw A.fail('Registrasi belum dapat diselesaikan. Silakan coba lagi.');
  // Supabase may obscure an existing confirmed account instead of returning an error.
  // Do not probe profiles by email, overwrite passwords, or grant roles from metadata.
  if(!data.session&&Array.isArray(data.user.identities)&&data.user.identities.length===0)throw A.fail('Jika alamat ini sudah terdaftar, gunakan Masuk atau Lupa kata sandi.');
  return data;
 },
 async login({email,password,remember}){A.setRemember(!!remember);const {data,error}=await A.createClient().auth.signInWithPassword({email:email.trim(),password});if(error)throw error;return data;},
 async resend(email){const {error}=await A.createClient().auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:A.callbackUrl('verify')}});if(error)throw error;},
 async recover(email){const {error}=await A.createClient().auth.resetPasswordForEmail(email.trim(),{redirectTo:A.callbackUrl('recovery')});if(error)throw error;},
 async reset(password,confirmation){
  A.requirePassword(password,confirmation);const user=await this.verifiedUser();
  if(!A.recoveryUid||user.id!==A.recoveryUid)throw A.fail('Sesi pemulihan tidak valid. Minta tautan baru dari halaman lupa kata sandi.');
  const {error}=await A.client.auth.updateUser({password});if(error)throw error;A.recoveryUid=null;await this.logout();
 },
 async email(email){await this.verifiedUser();const {error}=await A.client.auth.updateUser({email:email.trim()},{emailRedirectTo:A.callbackUrl('email-change')});if(error)throw error;},
 async password(current,password,confirmation){
  A.requirePassword(password,confirmation);const user=await this.verifiedUser();
  const {data,error}=await A.client.auth.signInWithPassword({email:user.email,password:current});if(error)throw error;
  if(data.user?.id!==user.id)throw A.fail('Identitas sesi berubah. Masuk kembali.');
  const result=await A.client.auth.updateUser({password});if(result.error)throw result.error;
 },
 async logout(){const {error}=await A.client.auth.signOut({scope:'local'});A.clearIdentity();A.recoveryUid=null;A.clearStoredSession();if(error)throw error;}
};
})(window.NA);
