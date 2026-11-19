(function(B,A,N){
 'use strict';
 const S=B.services;
 const requireUser=()=>{if(!A.user){N.navigate('login');throw B.fail('Masuk untuk melanjutkan.');}};
 const reload=()=>{B.clear();A.catalogue=undefined;A.catalogueError='';N.render();};
 const scopeTask=async factory=>{const scope=B.scope(),revision=B.revision;const value=await factory();if(scope!==B.scope()||revision!==B.revision)throw Object.assign(new Error('Stale action'),{code:'STALE'});return value;};
 B.queryRoute=data=>{const query=new URLSearchParams();for(const [k,v] of Object.entries(data))if(v&&k!=='page')query.set(k,v);location.hash=location.hash.split('?')[0]+(query.size?'?'+query:'');};
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-b-action]');if(!el||A.mode!=='connected')return;
  event.preventDefault();event.stopImmediatePropagation();if(el.disabled)return;
  const action=el.dataset.bAction,id=el.dataset.id,scope=B.scope();el.disabled=true;
  try{
   if(action==='close'){N.closeModal();return;}
   if(action==='refresh'){reload();return;}
   if(action==='page'){const params=B.params();params.set('page',id);location.hash=location.hash.split('?')[0]+'?'+params;return;}
   if(action==='discovery'){const params=new URLSearchParams();if(id==='Putri')params.set('gender','female');else if(id==='budget')params.set('max','1500000');else if(['AC','Furnitur'].includes(id))params.set('facility',id);else params.set('query',id);N.navigate('marketplace?'+params);return;}
   if(action==='image'){B.modal('Galeri kos',`<img class="b-modal-image" style="max-width:100%" src="${N.e(B.image(id))}" alt="Ilustrasi kamar">`);return;}
   requireUser();
   if(action==='compare'||action==='uncompare'){
    let ids=B.selection||[];if(action==='uncompare')ids=ids.filter(i=>i!==id);else if(!ids.includes(id)){if(ids.length===3)throw B.fail('Pilih maksimal tiga kos untuk dibandingkan.');ids.push(id);}B.selection=ids;N.navigate('compare?ids='+ids.join(','));return;
   }
   if(action==='favorite'){await S.favorite.add(id);N.toast('Kos disimpan ke favorit.');}
   else if(action==='unfavorite'){await S.favorite.remove(id);reload();}
   else if(action==='contact'){const conversation=await S.chat.open(id);B.track(id,'contact');N.navigate('chat?id='+conversation);}
   else if(action==='delete-search'){await S.search.remove(id);reload();}
   else if(action==='property-form'){await scopeTask(()=>B.propertyForm(id));}
   else if(action==='room-form'){await scopeTask(()=>B.roomForm(id));}
   else if(['invoice-form','bulk-form','edit-invoice','recurring-form','generate-form'].includes(action)){await scopeTask(()=>B.invoiceForm(action,id));}
   else if(action==='offer-form'){await scopeTask(B.offerForm);}
   else if(action==='transfer'){await scopeTask(()=>B.transferForm(id));}
   else if(action==='complaint-form'){await scopeTask(B.complaintForm);}
   else if(action==='complaint'){await scopeTask(()=>B.complaintDetail(id));}
   else if(action==='invoice'){await scopeTask(()=>B.invoiceDetail(id));}
   else if(action==='receipt'){await scopeTask(()=>B.receiptDetail(id));}
   else if(action==='print'){
    const record=B.printRecord;if(!record)throw B.fail('Buka rincian tagihan terlebih dahulu.');
    document.querySelector('.b-print')?.remove();const node=document.createElement('div');node.className='b-print';node.innerHTML=B.printMarkup(record.type,record.row);document.body.append(node);document.body.classList.add('b-printing');window.print();document.body.classList.remove('b-printing');node.remove();
   }
   else if(action==='delete-property'||action==='delete-room'){
    B.modal('Hapus data tanpa histori?',`<p>Data yang memiliki relasi atau histori akan ditolak database. Gunakan arsip atau status tidak aktif bila perlu.</p><div class="b-actions">${B.button('Batal','close')}${B.button('Ya, hapus',action+'-confirm',id,'danger')}</div>`);
   }else if(action==='delete-property-confirm'){await S.property.remove(id);N.closeModal();reload();N.toast('Properti dihapus.');}
   else if(action==='delete-room-confirm'){await S.room.remove(id);N.closeModal();reload();N.toast('Kamar dihapus.');}
   else if(action==='preview'){
    const rows=await S.property.list({filters:{id}}),p=rows[0];if(!p)throw B.fail('Properti tidak tersedia.');B.modal('Preview properti',`<h2>${N.e(p.name)}</h2><p>${N.e(p.address)}</p><p class="b-preserve">${N.e(p.description)}</p><strong>${B.money(p.base_rent)}</strong>${B.badge(p.publication_status)}`);
   }else if(action==='checkout-tenant'){B.modal('Check-out penghuni',B.form('close-agreement',B.hidden('id',id)+B.input('date','Tanggal check-out',B.today(),'date','required')+'<p>Histori sewa dan tagihan tetap disimpan. Jadwal tagihan berulang akan dinonaktifkan.</p>','Konfirmasi check-out'));}
   else if(action==='review-offer'){
    const rows=await S.agreement.offers({filters:{id,tenant_id:A.user.id}}),o=rows[0];if(!o||o.status!=='pending')throw B.fail('Penawaran tidak tersedia.');
    B.modal('Tinjau penawaran sewa',`<p>Masa sewa ${B.date(o.start_date)} — ${B.date(o.end_date)}</p><p>Sewa ${B.money(o.rent)} / bulan · Dibayar tanggal ${N.e(o.payment_day)}</p><p>Berlaku hingga ${B.date(o.expires_at)}. Dengan menyetujui, kamu memberi izin penempatan pada kamar yang tercantum dalam penawaran ini.</p><p>Kamar ${N.e(o.property_name_snapshot)} / ${N.e(o.room_number_snapshot)}</p><div class="b-actions">${B.button('Tolak','decline-offer',id)}${B.button('Setujui penawaran','accept-offer',id,'primary')}</div>`);
   }else if(action==='accept-offer'||action==='decline-offer'){await S.agreement.respond(id,action==='accept-offer');N.closeModal();reload();N.toast('Tanggapan penawaran tersimpan.');}
   else if(action==='checkin'){
    const rows=await S.agreement.offers({filters:{id}}),o=rows[0];if(!o)throw B.fail('Penawaran tidak tersedia.');await S.agreement.checkin(o);N.toast('Penghuni ditempatkan sesuai persetujuan.');reload();
   }else if(action==='remind'){await S.invoice.remind(id);N.toast('Pengingat tersimpan pada akun penghuni.');reload();}
   else if(action==='generate-reminders'){const count=await S.notification.generate();reload();N.toast(`${count} pengingat baru dibuat. Tidak ada email dikirim.`);}
   else if(action==='notification'){
    const n=B.pageData.notifications?.find(n=>n.id===id);if(!n)throw B.fail('Notifikasi tidak tersedia.');
    await S.notification.read(id);let route=n.route.replace(/^#\//,'');if(route==='complaints')route=A.allowed('owner')?'owner/complaints':'tenant/complaints';if(route==='owner/bills')route='owner/payments';if(!/^(owner|tenant|chat|offers|notifications)(\/[^?#]*)?(\?[^#]*)?$/.test(route))route='notifications';N.navigate(route);reload();
   }else if(action==='read-all'){await S.notification.all();reload();}
   else if(action==='read-chat'){await S.chat.read(id);reload();}
   else if(action==='quick-reply'){const input=document.querySelector('form[data-backend-form="message"] textarea');if(input){input.value=id;input.focus();}}
   else if(action==='save-analysis'){
    const c=B.currentComplaint,a=B.analysis;if(!c||c.id!==id||!a)throw B.fail('Buka kembali laporan untuk membaca analisis.');
    await S.complaint.analyze({complaint_id:id,rule_version:'local-keywords-v2',suggested_category:a.category,suggested_priority:{Rendah:'low',Sedang:'medium',Tinggi:'high',Mendesak:'urgent'}[a.priority],summary:a.summary,safe_action:a.action,emergency:a.emergency});N.toast('Rekomendasi tersimpan. Keputusan penanganan tetap pada pengelola.');
   }else if(action==='export-finance'){
    const report=B.pageData.report;if(!report)throw B.fail('Muat laporan terlebih dahulu.');
    const rows=[['Metrik','Nilai'],...Object.entries(report).map(([k,v])=>[k,v]),[],['Bulan','Pendapatan sewa'],...B.pageData.monthly.map(r=>[r.month,r.rent_revenue])];B.download('laporan-keuangan.csv',B.csv(rows));
   }
  }catch(error){if(error.code!=='STALE'&&scope===B.scope())N.toast(B.error(error),true);}
  finally{if(el.isConnected)el.disabled=false;}
 },true);
 document.addEventListener('submit',async event=>{
  const form=event.target;if(A.mode!=='connected'||!form.matches('form[data-backend-form]'))return;
  event.preventDefault();event.stopImmediatePropagation();if(form.dataset.busy)return;
  const kind=form.dataset.backendForm,fd=new FormData(form),d=Object.fromEntries(fd),scope=B.scope();
  if(!form.reportValidity())return;
  form.dataset.busy='true';const button=form.querySelector('[type="submit"]');button.disabled=true;const errorNode=form.querySelector('[role="alert"]');errorNode.textContent='';
  try{
   if(kind==='search'){
    if(d.min)B.integer(d.min);if(d.max)B.integer(d.max);if(d.min&&d.max&&B.integer(d.min)>B.integer(d.max))throw B.fail('Harga minimum melebihi maksimum.');
    A.search=(d.query||'').trim();if(A.user&&A.search)await S.search.save(A.search);const params=new URLSearchParams();for(const [key,value] of Object.entries({...d,available:fd.has('available')?'1':''}))if(value)params.set(key,value);N.navigate('marketplace'+(params.size?'?'+params:''));return;
   }
   if(['finance-filter','invoice-filter','complaint-filter','room-filter'].includes(kind)){B.queryRoute(d);return;}
   if(kind==='local-search'){
    document.querySelectorAll('[data-b-search-list] tbody tr').forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase('id').includes(d.query.toLocaleLowerCase('id')));return;
   }
   requireUser();
   if(kind==='property'){
    B.integer(d.base_rent);const lines=name=>d[name].split('\n').map(v=>v.trim()).filter(Boolean);
    const images=lines('images').map(path=>{if(B.image(path)!==path)throw B.fail('Gunakan path aset ilustrasi lokal yang diizinkan.');return {path,alt:d.name};});
    const landmarks=lines('landmarks').map(line=>{const [name,distance]=line.split('|').map(v=>v.trim());if(!name||!distance)throw B.fail('Area sekitar memakai format nama | jarak.');return {name,distance};});
    await S.property.save({...d,facilities:fd.getAll('facilities'),rules:lines('rules'),images,landmarks});
   }else if(kind==='room'){B.integer(d.rent);await S.room.save({...d,facilities:fd.getAll('facilities')});}
   else if(kind==='offer'){B.integer(d.rent);if(d.end_date<d.start_date)throw B.fail('Tanggal akhir harus setelah tanggal mulai.');await S.agreement.propose(d);}
   else if(kind==='close-agreement'){await S.agreement.close(d.id,d.date);}
   else if(kind==='transfer'){B.integer(d.rent);await S.agreement.transfer({target_agreement:d.id,target_room:d.room,moving_on:d.date,ends:d.end,monthly_rent:d.rent,due_day:d.day});}
   else if(kind==='invoice'||kind==='bulk'){
    if(d.amount)B.integer(d.amount);const args={billing_month:d.month+'-01',due_on:d.due,invoice_notes:d.notes};
    if(kind==='bulk'){const ids=fd.getAll('agreements');if(!ids.length)throw B.fail('Pilih setidaknya satu masa sewa.');await S.invoice.bulk({...args,target_agreements:ids,fixed_rent:d.amount||null});}
    else await S.invoice.create({...args,target_agreement:d.agreement_id,rent_amount:d.amount});
   }else if(kind==='edit-invoice'){B.integer(d.amount);await S.invoice.update({target_invoice:d.id,rent_amount:d.amount,due_on:d.due,invoice_notes:d.notes,cancel:fd.has('cancel')});}
   else if(kind==='recurring'){B.integer(d.amount);await S.invoice.schedule({target_agreement:d.agreement_id,rent_amount:d.amount,due_day:d.day,starts:d.month+'-01',enabled:fd.has('enabled')});}
   else if(kind==='generate'){await S.invoice.generate(d.month+'-01');}
   else if(kind==='complaint'){await S.complaint.create({target_agreement:d.agreement_id,ticket_title:d.title.trim(),ticket_description:d.description.trim(),ticket_category:d.category,ticket_urgency:d.urgency});}
   else if(kind==='transition'){await S.complaint.transition({target_complaint:d.id,next_status:d.status,treatment_note:d.note,final_category:d.category,final_priority:d.priority,eta:d.eta||null});}
   else if(kind==='tenant-transition'){if(d.status==='waiting'&&!d.note.trim())throw B.fail('Tuliskan alasan pembukaan kembali.');await S.complaint.transition({target_complaint:d.id,next_status:d.status,treatment_note:d.note});}
   else if(kind==='message'){if(!d.body.trim())throw B.fail('Pesan tidak boleh kosong.');await S.chat.send(d.conversation_id,d.body.trim());}
   else if(kind==='settings'){await S.settings.save({notifications_enabled:fd.has('notifications_enabled'),compact_mode:fd.has('compact_mode'),sidebar_collapsed:fd.has('sidebar_collapsed')});}
   N.closeModal();reload();N.toast('Perubahan tersimpan pada akunmu.');
  }catch(error){if(error.code!=='STALE'&&scope===B.scope()){errorNode.textContent=B.error(error);errorNode.focus();}}
  finally{delete form.dataset.busy;if(button.isConnected)button.disabled=false;}
 },true);
 let searchTimer;
 document.addEventListener('input',event=>{
  if(A.mode!=='connected')return;
  if(event.target.matches('form[data-backend-form="search"] [name="query"]')&&A.route()[0]==='marketplace'){
   clearTimeout(searchTimer);const input=event.target,value=input.value,scope=B.scope(),hash=location.hash;
   searchTimer=setTimeout(()=>{if(scope!==B.scope()||hash!==location.hash||value!==input.value||document.activeElement!==input)return;B.searchFocus=input.selectionStart;const params=B.params();params.set('query',value);params.delete('page');location.hash='#/marketplace?'+params;},450);return;
  }
  if(!event.target.matches('[data-b-chat-search]'))return;
  const value=event.target.value.toLocaleLowerCase('id');document.querySelectorAll('.b-conversation').forEach(el=>el.hidden=!el.textContent.toLocaleLowerCase('id').includes(value));
 });
 B.track=(id,kind)=>{
  if(A.mode!=='connected'||!A.user)return;const key=A.user.id+':'+B.today()+':'+id+':'+kind;
  if(B.eventsSeen.has(key))return;B.eventsSeen.add(key);if(B.eventsSeen.size>500)B.eventsSeen.delete(B.eventsSeen.values().next().value);
  S.analytics.record(id,kind,B.analyticsSession).catch(()=>B.eventsSeen.delete(key));
 };
 let observer,notificationTicket=0;
 B.afterRender=(route,id)=>{
  observer?.disconnect();
  if(route==='marketplace'&&B.searchFocus!==undefined){const input=document.querySelector('[data-backend-form="search"] [name="query"]');if(input){input.focus();input.setSelectionRange(B.searchFocus,B.searchFocus);}delete B.searchFocus;}
  if(A.user){
   observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){B.track(entry.target.dataset.bListing,'view');observer.unobserve(entry.target);}}),{threshold:0.5});document.querySelectorAll('[data-b-listing]').forEach(el=>observer.observe(el));
   if(route==='property')B.track(id,'detail');
   const scope=B.scope(),ticket=++notificationTicket;
   B.load('ui-preferences',signal=>S.settings.load(signal)).then(rows=>{
    if(scope!==B.scope()||ticket!==notificationTicket)return;const setting=rows[0]||{};
    document.body.classList.toggle('b-compact',!!setting.compact_mode);document.body.classList.toggle('b-collapsed',!!setting.sidebar_collapsed);
    if(setting.notifications_enabled)B.load('notification-indicator',signal=>S.notification.list({size:10,filters:{read_at:null}},signal)).then(rows=>{if(scope!==B.scope()||ticket!==notificationTicket)return;const bell=document.querySelector('.b-notification-bell');if(bell&&rows.length)bell.insertAdjacentHTML('beforeend',`<b>${rows.length===10?'9+':rows.length}</b>`);}).catch(()=>{});
   }).catch(()=>{});
  }else document.body.classList.remove('b-compact','b-collapsed');
 };
 // Clear all user-specific dialog/data snapshots alongside the session cache.
 const clear=B.clear;B.clear=()=>{observer?.disconnect();notificationTicket++;clear();B.currentComplaint=null;B.analysis=null;B.currentProperty=null;B.printRecord=null;B.favoriteIds=null;N.closeModal();document.querySelector('.b-print')?.remove();document.body.classList.remove('b-compact','b-collapsed');};
})(window.NB,window.NA,window.NK);
