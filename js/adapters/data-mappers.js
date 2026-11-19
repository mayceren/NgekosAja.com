(function(B){
 'use strict';
 B.mappers={
  property:row=>({...row,base_rent:String(row.base_rent),images:row.images||[],facilities:row.facilities||[],rules:row.rules||[],landmarks:row.landmarks||[],available_rooms:String(row.available_rooms||0),total_rooms:String(row.total_rooms||0)}),
  invoice:row=>({...row,amount:String(row.amount),admin_fee:String(row.admin_fee),total:B.integer(row.amount)+B.integer(row.admin_fee),label:B.labels[row.effective_status||row.status]}),
  agreement:row=>({...row,rent:String(row.rent),name:row.tenants?.profiles?.display_name||'Penghuni',property:row.rooms?.properties?.name||'Properti',room:row.rooms?.number||'—'}),
  transaction:row=>({...row,amount:String(row.amount),admin_fee:String(row.admin_fee),total:B.integer(row.amount)+B.integer(row.admin_fee)})
 };
})(window.NB);
