(function(A){
'use strict';
A.roleLabels={prospect:'Calon penghuni',tenant:'Penghuni',owner:'Pemilik kos',admin:'Administrator platform'};
A.roleService={async load(uid){
 const {data,error}=await A.client.from('user_roles').select('role').eq('user_id',uid);if(error)throw error;
 const roles=[...new Set(data.map(row=>row.role).filter(role=>Object.hasOwn(A.roleLabels,role)))];
 let hasAgreement=false;
 if(roles.includes('tenant')){const result=await A.client.from('rental_agreements').select('id').eq('tenant_id',uid).limit(1);if(result.error)throw result.error;hasAgreement=result.data.length>0;}
 return {roles,effectiveRoles:roles.filter(role=>role!=='tenant'||hasAgreement),hasAgreement};
}};
A.defaultPath=()=>A.effectiveRoles?.includes('admin')?'admin':A.effectiveRoles?.includes('owner')?'owner':A.effectiveRoles?.includes('tenant')?'tenant':'workspace';
A.allowed=role=>A.user&&A.effectiveRoles?.includes(role);
})(window.NA);
