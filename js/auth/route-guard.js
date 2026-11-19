(function(A){
'use strict';
A.route=()=>location.hash.replace(/^#\/?/,'').split('?')[0].split('/');
A.guard=route=>{
 const privateRoutes=['owner','tenant','admin','workspace','account','favorites','chat','checkout','payment-result','compare'];
 if(!privateRoutes.includes(route))return 'public';
 if(!A.user)return A.identityError?'session-expired':'login';
 if(['owner','tenant','admin'].includes(route)&&!A.allowed(route))return 'access-denied';
 return 'allowed';
};
A.safeNext=path=>/^(?:owner|tenant|admin|workspace|account)(?:\/(?:settings|profile))?$/.test(path||'')?path:'';
})(window.NA);
