(function(A){
'use strict';
A.profileService={
 async load(uid){const {data,error}=await A.client.from('profiles').select('id,display_name,phone,created_at').eq('id',uid).single();if(error)throw error;if(data.id!==uid)throw A.fail('Identitas profil tidak cocok.');return data;},
 async update({name,phone}){
  const user=await A.authService.verifiedUser();
  if(!name?.trim()||name.trim().length>70)throw A.fail('Nama wajib diisi, maksimal 70 karakter.');
  if(phone&&!/^[+0-9 -]{8,18}$/.test(phone))throw A.fail('Nomor kontak memakai 8–18 karakter angka, +, spasi, atau tanda hubung.');
  const {data,error}=await A.client.from('profiles').update({display_name:name.trim(),phone:phone?.trim()||null}).eq('id',user.id).select('id,display_name,phone,created_at').single();if(error)throw error;return data;
 }
};
})(window.NA);
