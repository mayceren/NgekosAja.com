(function(N){
'use strict';
const app=document.getElementById('app');N.sessionId=N.id('visit');
N.route=()=>location.hash.replace(/^#\/?/,'').split('?')[0].split('/');
N.navigate=path=>{const hash='#/'+path;if(location.hash===hash)N.render();else location.hash=hash;};
N.refresh=message=>{N.closeModal();N.render();if(message)N.toast(message);};
let cardObserver,revealObserver;
N.observeCards=()=>{cardObserver?.disconnect();if(!('IntersectionObserver'in window))return;cardObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){N.recordInteraction(entry.target.dataset.propertyId,'views',N.sessionId);cardObserver.unobserve(entry.target);}}),{threshold:.35});document.querySelectorAll('.property-card[data-property-id]').forEach(el=>cardObserver.observe(el));};
N.render=()=>{
 if(window.NA?.render?.())return;
 document.body.dataset.mode='demo';
 const [route,page]=N.route(),s=N.state();
 if(['owner','tenant','admin'].includes(route)&&s.role!==route){N.navigate(['owner','tenant','admin'].includes(s.role)?s.role:'login');N.toast('Halaman disesuaikan dengan peran demo aktif.');return;}
 try{
  N.syncReminders();let body;
  if(route==='owner'){const views={'':N.ownerDashboard,properties:N.ownerProperties,rooms:N.ownerRooms,tenants:N.ownerTenants,payments:N.ownerPayments,transactions:N.ownerTransactions,reports:N.reportPage,complaints:N.complaintsPage,chat:N.chatPage,boost:N.ownerBoost,notifications:N.notificationPage,settings:N.settingsPage,profile:N.settingsPage,activity:()=>N.heading('OVERVIEW / AKTIVITAS','Jejak ruang yang terus dirawat.','Aktivitas operasional dari akun pemilik aktif.')+`<section class="panel">${N.activityList(100)}</section>`};body=N.dashboardShell(page||'',(views[page||'']||(()=>N.empty('Halaman belum ditemukan.','Gunakan navigasi workspace untuk melanjutkan.')))());}
  else if(route==='tenant'){const views={'':N.tenantDashboard,home:N.tenantHome,bills:N.tenantBills,history:N.tenantHistory,complaints:N.complaintsPage,chat:N.chatPage,notifications:N.notificationPage,favorites:N.favoritesPage,settings:N.settingsPage,profile:N.settingsPage};body=N.dashboardShell(page||'',(views[page||'']||(()=>N.empty('Halaman belum ditemukan.','Gunakan menu untuk melanjutkan.')))())+N.compareBar();}
  else if(route==='admin')body=N.dashboardShell(page||'',page==='settings'?N.settingsPage():N.adminPage(page));
  else if(route==='marketplace')body=N.marketplace();
  else if(route==='property'){body=N.propertyDetail(page);if(N.property(page)&&!N.property(page).archived)N.recordInteraction(page,'details',N.sessionId);}
  else if(['login','register','forgot'].includes(route))body=N.authPage(route);
  else if(['fitur','tentang','untuk-pemilik'].includes(route))body=N.infoPage(route);
  else if(route==='help'||route==='privacy')body=N.helpPage(route==='privacy');
  else if(route==='favorites')body=N.navbar()+`<main class="container section" id="main">${N.favoritesPage()}</main>`+N.footer()+N.compareBar();
  else if(route==='compare')body=N.comparePage();
  else if(route==='checkout')body=N.checkoutPage(page);
  else if(route==='payment-result')body=N.resultPage(page);
  else if(route==='chat')body=N.navbar()+`<main class="container section guest-chat" id="main">${N.chatPage()}</main>`+N.footer();
  else if(route==='account')body=N.navbar()+`<main class="container section" id="main">${N.settingsPage()}</main>`+N.footer();
  else if(!route)body=N.home();
  else body=N.navbar()+`<main class="container section" id="main">${N.empty('Halaman tidak ditemukan.','Mulai lagi dari ruang yang kamu kenal.','<a class="btn btn-primary" href="#/">Ke Beranda</a>')}</main>`+N.footer();
  app.innerHTML=body;N.renderResults();N.accountPreview();N.observeCards();
  const msgs=document.getElementById('chat-messages');if(msgs)msgs.scrollTop=msgs.scrollHeight;
  const names={owner:'Workspace Pemilik',tenant:'Ruang Penghuni',admin:'Monitoring Platform',marketplace:'Cari Kos',property:N.property(page)?.name,login:'Masuk',register:'Daftar',checkout:'Checkout Sewa',favorites:'Kos Favorit',compare:'Bandingkan Kos'};document.title=`${names[route]||'Temukan Tempat Pulang'} · NgekosAja.com`;
  revealObserver?.disconnect();if('IntersectionObserver'in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){revealObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');revealObserver.unobserve(e.target);}}),{threshold:.08});document.querySelectorAll('.needs-grid,.how-grid,.platform-intro,.owner-preview,.closing-cta').forEach(el=>{el.classList.add('reveal');revealObserver.observe(el);});}
 }catch(error){console.error(error);app.innerHTML=N.navbar()+`<main class="container section" id="main">${N.empty('Halaman ini tidak dapat dibuka.',error.message,'<a class="btn btn-primary" href="#/">Kembali ke Beranda</a>')}</main>`+N.footer();}
};
N.readImage=async file=>{if(!file)return '';if(file.size>1048576||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Gunakan JPG, PNG, atau WebP maksimal 1 MB.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Foto gagal dibaca.'));reader.readAsDataURL(file);});};
const targetRolePath=()=>['owner','tenant','admin'].includes(N.state().role)?N.state().role:'marketplace';
function changeRole(role,id){N.setRole(role,id);N.selectedConversation='';N.pagination={};N.overviewFilter={property:'all',months:6};N.financeFilter={property:'all',from:'',to:'',months:6};N.roomFilter={property:'all',status:'all'};N.tenantFilter={query:'',property:'all',status:'all'};N.invoiceFilter={query:'',property:'all',status:'all'};N.complaintFilters={query:'',category:'all',priority:'all',status:'all'};N.closeModal();N.navigate(targetRolePath());N.toast(`Mode ${N.roleName()} · ${N.actor().name}`);}
function searchLocation(query){N.marketplaceFilters={...N.defaultFilters(),query};N.rememberSearch(query);N.navigate('marketplace');}
document.addEventListener('click',async event=>{
 const el=event.target.closest('[data-action]');if(!el){if(event.target.classList.contains('modal-overlay'))N.closeModal();return;}const a=el.dataset.action,id=el.dataset.id;
 try{switch(a){
 case 'roles':N.roleModal();break;
 case 'role':changeRole(el.dataset.role,el.dataset.role==='owner'?document.getElementById('demo-owner')?.value:el.dataset.role==='tenant'?document.getElementById('demo-tenant')?.value:'');break;
 case 'logout':changeRole('guest','guest');N.navigate('');break;
 case 'close-modal':case 'close-on-nav':N.closeModal();break;
 case 'menu':{const open=document.querySelector('.public-nav').classList.toggle('open');el.setAttribute('aria-expanded',open);break;}
 case 'sidebar':{const layout=document.querySelector('.dashboard-layout'),open=layout.classList.toggle('sidebar-open');document.querySelector('[data-action=sidebar]')?.setAttribute('aria-expanded',open);break;}
 case 'collapse-sidebar':N.update(s=>{const key=N.actorId();s.settings[key]={...s.settings[key],sidebar:!s.settings[key]?.sidebar};});N.render();break;
 case 'guide':N.guideModal();break;
 case 'guide-step':N.setRole(el.dataset.role,el.dataset.role==='owner'?'o1':el.dataset.role==='tenant'?'t1':'guest');N.closeModal();N.navigate(el.dataset.path);break;
 case 'reset':N.confirm('Mulai ulang data demo versi 2?','Semua perubahan versi 2, foto unggahan, dan pesan akan direset. Salinan data versi 1 tetap dipertahankan sebagai cadangan migrasi.','reset-confirm');break;
 case 'reset-confirm':N.reset();N.selectedConversation='';N.pagination={};N.marketplaceFilters=N.defaultFilters();N.financeFilter={property:'all',from:'',to:'',months:6};N.closeModal();N.navigate('');N.render();N.toast('Data demo versi 2 dikembalikan ke kondisi awal.');break;
 case 'location-search':case 'recent-search':searchLocation(el.dataset.query);break;
 case 'need-search':{N.marketplaceFilters=N.defaultFilters();const need=el.dataset.need;if(need==='budget')N.marketplaceFilters.max='1500000';else if(need==='Putri')N.marketplaceFilters.type='Putri';else N.marketplaceFilters.facilities=[need];N.navigate('marketplace');break;}
 case 'reset-filters':N.marketplaceFilters=N.defaultFilters();N.render();break;
 case 'remove-filter':{const key=el.dataset.key;if(key==='facility')N.marketplaceFilters.facilities=N.marketplaceFilters.facilities.filter(x=>x!==el.dataset.value);else N.marketplaceFilters[key]=['type','availability'].includes(key)?'all':'';N.render();break;}
 case 'filter-drawer':{const open=document.querySelector('.filter-panel').classList.toggle('filter-open');document.body.classList.toggle('filter-is-open',open);break;}
 case 'market-view':N.marketView=el.dataset.view;N.render();break;
 case 'favorite':N.toggleFavorite(id);N.render();N.toast(N.favoriteIds().includes(id)?'Disimpan ke kos favorit.':'Dihapus dari favorit.');break;
 case 'compare-toggle':N.toggleCompare(id);N.render();break;
 case 'clear-compare':N.update(s=>s.compare=[]);N.render();break;
 case 'detail-click':N.recordInteraction(id,'details',N.sessionId);break;
 case 'gallery':{const img=document.getElementById('gallery-main');img.src=el.dataset.src;img.alt=el.dataset.alt;break;}
 case 'fullscreen-photo':N.photoViewer(id,el.dataset.index);break;
 case 'share':{const url=location.href.split('#')[0]+'#/property/'+id;try{await navigator.clipboard.writeText(url);N.toast('Tautan kos disalin.');}catch(_){N.modal('Bagikan pilihanmu',`${N.input('link','Tautan kos',url,'text','readonly id="share-link"')}<p class="field-help">Pilih dan salin tautan ini untuk browser dengan alamat project yang sama.</p>`);document.getElementById('share-link').select();}break;}
 case 'contact':{N.selectedConversation=N.contact(id);N.chatMobileList=false;N.closeModal();N.navigate(N.state().role==='guest'?'chat':N.state().role+'/chat');break;}
 case 'select-chat':N.selectedConversation=id;N.chatMobileList=false;N.render();break;
 case 'chat-list':N.chatMobileList=true;N.render();break;
 case 'quick-reply':{const input=document.getElementById('message-input');input.value=el.dataset.text;input.focus();break;}
 case 'chat-photo':{const c=N.accessConversation(id),m=c.messages.find(m=>m.id===el.dataset.message);if(m?.photo)N.modal('Lampiran percakapan',`<img class="report-full-photo" src="${m.photo}" alt="Lampiran percakapan">`,true);break;}
 case 'add-property':N.requireRole('owner');N.propertyForm();break;
 case 'edit-property':N.propertyForm(id);break;
 case 'archive-property':N.requireProperty(id);N.confirm('Ubah publikasi listing?','Arsip menyembunyikan listing dari pencarian. Riwayat sewa, transaksi, dan laporan tetap disimpan.','archive-property-confirm',id);break;
 case 'archive-property-confirm':N.archiveProperty(id);N.refresh('Status publikasi diperbarui.');break;
 case 'delete-property':N.requireProperty(id);N.confirm('Hapus properti tanpa riwayat?','Data dengan penghuni atau riwayat tidak dapat dihapus. Gunakan arsip untuk mempertahankan catatan.','delete-property-confirm',id);break;
 case 'delete-property-confirm':N.deleteProperty(id);N.refresh('Properti dihapus.');break;
 case 'property-rooms':N.roomFilter.property=id;break;
 case 'rooms':N.roomsModal(id);break;
 case 'room-detail':N.roomModal(el.dataset.property,id);break;
 case 'toggle-room':N.toggleRoom(el.dataset.property,id);N.refresh('Ketersediaan kamar diperbarui.');break;
 case 'add-tenant':N.requireRole('owner');N.tenantForm();break;
 case 'edit-tenant':N.tenantForm(id);break;
 case 'tenant-detail':N.tenantDetail(id);break;
 case 'checkout-tenant':N.requireOwned('tenants',id);N.confirm('Konfirmasi check-out?','Kamar akan dilepas dan jadwal tagihan berikutnya dihentikan. Tagihan, transaksi, dan laporan lama tetap tersimpan.','checkout-tenant-confirm',id);break;
 case 'checkout-tenant-confirm':N.checkoutTenant(id);N.refresh('Check-out dicatat. Riwayat penghuni tetap tersedia.');break;
 case 'delete-tenant':N.confirm('Hapus profil tanpa riwayat?','Profil dengan riwayat harus menggunakan Check-out.','delete-tenant-confirm',id);break;
 case 'delete-tenant-confirm':N.deleteTenant(id);N.refresh('Profil penghuni dihapus.');break;
 case 'add-invoice':N.requireRole('owner');N.invoiceForm();break;
 case 'bulk-invoice':N.requireRole('owner');N.invoiceForm(null,true);break;
 case 'edit-invoice':N.invoiceForm(id);break;
 case 'cancel-invoice':N.requireOwned('invoices',id);N.confirm('Batalkan tagihan?','Hanya tagihan belum final dan tanpa transaksi terkait yang dapat dibatalkan.','cancel-invoice-confirm',id);break;
 case 'cancel-invoice-confirm':N.cancelInvoice(id);N.refresh('Tagihan dibatalkan.');break;
 case 'invoice-detail':N.invoiceDetail(id);break;
 case 'recurring-form':N.requireRole('owner');N.recurringForm();break;
 case 'recurring-next':{const refs=N.visible('recurring').filter(r=>r.active).map(r=>r.lastMonth||N.monthKey()).sort(),latest=refs.at(-1)||N.monthKey(),d=new Date(latest+'-01T12:00:00');d.setMonth(d.getMonth()+1);const ref=N.monthKey(d);const count=N.runRecurring(ref,true);N.refresh(count?`${count} tagihan periode ${ref} dibuat.`:'Tidak ada jadwal aktif yang perlu dibuat.');break;}
 case 'toggle-recurring':{const r=N.requireOwned('recurring',id);if(!r.active&&(!N.isActive(N.tenant(r.tenantId))||N.tenant(r.tenantId).propertyId!==r.propertyId))throw new Error('Penghuni sudah tidak aktif atau berpindah properti. Buat jadwal sesuai sewa aktif.');N.update(s=>s.recurring.find(x=>x.id===id).active=!r.active);N.render();N.toast('Status jadwal diperbarui.');break;}
 case 'remind-tenant':N.manualReminder(id);N.render();N.toast('Pengingat lokal tersedia pada akun penghuni terkait.');break;
 case 'pay':N.paymentModal(id);break;
 case 'process-payment':{const pending=N.pendingPayment;if(!pending||pending.actorId!==N.actorId())throw new Error('Konfirmasi kedaluwarsa. Buka checkout kembali.');el.disabled=true;const tx=N.payInvoice(pending.id,pending.method,el.dataset.result==='success');N.pendingPayment=null;N.closeModal();N.paymentResult(tx);break;}
 case 'receipt':N.receiptModal(id);break;
 case 'print-receipt':window.print();break;
 case 'simulate-reminder':N.requireRole('tenant');N.update(s=>{s.demoReminder=true;N.notify(s,N.actorId(),`demo-reminder-${N.dateKey()}`,'Contoh pengingat H-3','Notifikasi demonstrasi. Nominal dan tanggal tagihan tidak berubah.','#/tenant/bills');});N.render();N.toast('Contoh reminder H-3 ditampilkan.');break;
 case 'notifications':N.notifications();break;
 case 'mark-read':N.markRead(id);N.render();break;
 case 'open-notification':N.markRead(id);break;
 case 'chart-month':{N.requireRole(N.state().role==='admin'?'admin':'owner');const d=new Date(id+'-01T12:00:00');N.financeFilter={...N.financeFilter,property:N.overviewFilter.property,from:id+'-01',to:N.dateKey(new Date(d.getFullYear(),d.getMonth()+1,0))};N.navigate(N.state().role==='owner'?'owner/reports':'admin/transactions');break;}
 case 'reset-report':N.financeFilter={property:'all',from:'',to:'',months:6};N.render();break;
 case 'export-csv':N.exportCSV(N.route()[1]==='transactions'?{property:'all',from:'',to:''}:N.financeFilter);break;
 case 'add-complaint':N.requireRole('tenant');N.complaintForm();break;
 case 'analyze-complaint':N.showLiveAnalysis();break;
 case 'apply-analysis':{const f=document.getElementById('complaint-form');if(N.currentAnalysis&&f){f.elements.category.value=N.currentAnalysis.category;f.elements.urgency.value=N.currentAnalysis.priority;N.toast('Rekomendasi diterapkan. Kamu tetap dapat mengubahnya.');}break;}
 case 'ticket-view':N.ticketView=el.dataset.view;N.render();break;
 case 'ticket-detail':N.ticketDetail(id);break;
 case 'accept-ticket-analysis':{const c=N.accessComplaint(id),analysis=N.analyzeComplaint(c.title,c.description),f=document.getElementById('ticket-treatment-form');f.elements.category.value=analysis.category;f.elements.priority.value=analysis.priority;f.elements.note.value=analysis.action;N.toast('Saran diisikan. Periksa dan simpan keputusan Anda.');break;}
 case 'confirm-complaint':N.confirmComplaint(id);N.refresh('Penyelesaian dikonfirmasi. Terima kasih sudah memberi kabar.');break;
 case 'reopen-ticket':N.accessComplaint(id);N.modal('Apa yang masih perlu diperbaiki?',`<form id="reopen-form" data-id="${id}"><label class="field">Alasan membuka kembali<textarea name="note" rows="4" required minlength="5" maxlength="1000"></textarea></label>${N.formEnd('Buka Kembali Laporan')}</form>`);break;
 case 'view-photo':{const c=N.accessComplaint(id);if(c.photo)N.modal('Lampiran laporan',`<img class="report-full-photo" src="${c.photo}" alt="${N.e(c.title)}">`,true);break;}
 case 'boost':N.boostModal(id);break;
 case 'boost-success':N.boost(id,true);N.refresh('Promosi aktif selama 30 hari. Rekomendasi marketplace diperbarui.');break;
 case 'boost-fail':N.boost(id,false);N.refresh();N.toast('Simulasi gagal. Promosi belum diaktifkan.',true);break;
 case 'paginate':N.pagination[el.dataset.key]=Math.max(0,(N.pagination[el.dataset.key]||0)+Number(el.dataset.step));N.render();break;
 }}catch(error){if(el.isConnected)el.disabled=false;N.toast(error.message,true);}
});
document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches('form'))return;event.preventDefault();const fd=new FormData(form),d=Object.fromEntries(fd),err=form.querySelector('.form-error'),button=event.submitter;if(err)err.textContent='';if(button)button.disabled=true;
 try{switch(form.id){
 case 'hero-search':N.marketplaceFilters={...N.defaultFilters(),query:d.query.trim(),max:d.budget,type:d.type};N.rememberSearch(d.query);N.navigate('marketplace');break;
 case 'filter-form':if(d.min&&d.max&&Number(d.min)>Number(d.max))throw new Error('Harga minimum tidak boleh melebihi maksimum.');N.marketplaceFilters={...N.marketplaceFilters,query:d.query.trim(),min:d.min,max:d.max,type:d.type,facilities:fd.getAll('facilities'),availability:d.available?'available':'all'};N.rememberSearch(d.query);document.body.classList.remove('filter-is-open');N.render();break;
 case 'login-form':{const user=N.state().users.find(u=>u.id===d.account);if(!user)throw new Error('Pilih akun demo.');changeRole(user.role,user.id);break;}
 case 'register-form':N.registerDemo(d);N.navigate(targetRolePath());N.toast('Profil demo dibuat. Tidak ada kata sandi yang disimpan.');break;
 case 'forgot-form':{const u=N.state().users.find(u=>u.id===d.account);N.modal('Akses akun demo',`<p class="modal-description">${N.e(u.name)} tidak memerlukan kata sandi pada prototype ini. Tidak ada email yang dikirim.</p><button class="btn btn-primary btn-full" data-action="login-selected" data-id="${u.id}">Lanjut sebagai ${N.e(u.name)} ${N.icon('arrow')}</button>`);break;}
 case 'settings-form':N.saveSettings({...d,notifications:fd.has('notifications'),compact:fd.has('compact')});N.refresh('Profil dan preferensi akun diperbarui.');break;
 case 'property-form':N.saveProperty({...d,facilities:fd.getAll('facilities'),photo:await N.readImage(form.elements.photo.files[0])},form.dataset.id||null);N.refresh('Properti disimpan. Marketplace mengikuti data terbaru.');break;
 case 'room-filter':N.roomFilter=d;N.render();break;
 case 'room-form':N.setRoom(form.dataset.property,form.dataset.id,{...d,facilities:fd.getAll('facilities')});N.refresh('Informasi dan status kamar diperbarui.');break;
 case 'tenant-filter':N.tenantFilter=d;N.pagination.tenants=0;N.render();break;
 case 'tenant-form':N.saveTenant(d,form.dataset.id||null);N.refresh('Profil dan penempatan kamar disimpan.');break;
 case 'invoice-filter':N.invoiceFilter=d;N.pagination.invoices=0;N.render();break;
 case 'invoice-form':N.saveInvoice(d,form.dataset.id||null);N.refresh('Tagihan disimpan pada kedua akun terkait.');break;
 case 'bulk-invoice-form':N.bulkInvoice({...d,tenantIds:fd.getAll('tenantIds'),useRent:fd.has('useRent')});N.refresh('Seluruh tagihan dalam kelompok berhasil dibuat.');break;
 case 'recurring-form':N.saveRecurring(d);N.runRecurring();N.refresh('Jadwal bulanan lokal disimpan dan periode saat ini diperiksa.');break;
 case 'checkout-form':N.confirmPayment(form.dataset.id,d.method);break;
 case 'report-filter':if(d.from&&d.to&&d.from>d.to)throw new Error('Tanggal mulai tidak boleh melewati tanggal akhir.');N.financeFilter={...N.financeFilter,...d};N.render();break;
 case 'ticket-filter':N.complaintFilters=d;N.render();break;
 case 'complaint-form':N.addComplaint({...d,photo:await N.readImage(form.elements.photo.files[0])});N.refresh('Laporan terkirim. Pengelola dapat menindaklanjutinya.');break;
 case 'ticket-treatment-form':N.updateComplaint(form.dataset.id,d.status,d);N.refresh('Penanganan diperbarui dan penghuni diberi notifikasi lokal.');break;
 case 'reopen-form':N.reopenComplaint(form.dataset.id,d.note);N.refresh('Laporan dibuka kembali untuk ditinjau pengelola.');break;
 case 'chat-search-form':N.chatQuery=d.query;N.render();break;
 case 'chat-form':N.sendMessage(form.dataset.id,d.message,await N.readImage(form.elements.photo.files[0]));N.render();document.getElementById('message-input')?.focus();break;
 }}catch(error){if(err)err.textContent=error.message;else N.toast(error.message,true);}finally{if(button?.isConnected)button.disabled=false;}
});
// Account recovery action is kept outside the generic switch so it can share login behavior.
document.addEventListener('click',event=>{const el=event.target.closest('[data-action=login-selected]');if(!el)return;const u=N.state().users.find(u=>u.id===el.dataset.id);if(u)changeRole(u.role,u.id);});
document.addEventListener('change',async event=>{const el=event.target;try{
 if(el.id==='sort-properties'){N.marketplaceFilters.sort=el.value;N.renderResults();N.observeCards();}
 if(el.dataset.compareId){N.toggleCompare(el.dataset.compareId);N.render();}
 if(el.id==='login-account')N.accountPreview();
 if(el.id==='tenant-existing'){const u=N.state().users.find(u=>u.id===el.value),f=el.closest('form');if(u){f.elements.name.value=u.name;f.elements.email.value=u.email;f.elements.phone.value=u.phone||'';}}
 if(el.id==='tenant-property')N.fillTenantRooms(el.closest('form').dataset.id);
 if(el.id==='invoice-tenant')document.getElementById('invoice-amount').value=N.tenant(el.value)?.rent||0;
 if(el.id==='overview-property'){N.overviewFilter.property=el.value;N.render();}
 if(el.id==='overview-months'){N.overviewFilter.months=Number(el.value);N.render();}
 if(el.matches('#complaint-form [name=photo]')){const data=await N.readImage(el.files[0]),preview=document.getElementById('photo-preview');if(preview)preview.innerHTML=data?`<img class="upload-preview" src="${data}" alt="Pratinjau laporan">`:'';}
 if(el.matches('#chat-form [name=photo]')){await N.readImage(el.files[0]);document.getElementById('chat-attachment-name').textContent=el.files[0]?.name||'';}
 if(el.matches('#checkout-form [name=method]'))document.getElementById('method-info').innerHTML=el.value==='QRIS'?`${N.icon('grid')}QRIS DEMO · Tidak ada kode pembayaran nyata untuk dipindai.`:`${N.icon('shield')}Metode ${N.e(el.value)} adalah simulasi, tanpa data finansial yang diminta.`;
}catch(error){if(el.type==='file')el.value='';N.toast(error.message,true);}});
let inputTimer;
document.addEventListener('input',event=>{const el=event.target;if(el.matches('#complaint-form [name=title],#complaint-form [name=description]')){clearTimeout(inputTimer);inputTimer=setTimeout(N.showLiveAnalysis,260);}if(el.matches('#filter-form [name=query]')){clearTimeout(inputTimer);const query=el.value;inputTimer=setTimeout(()=>{N.marketplaceFilters.query=query;N.renderResults();N.observeCards();},180);}});
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('.chart-point'))event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));const modal=document.querySelector('.modal');if(!modal)return;if(event.key==='Escape'){N.closeModal();return;}if(event.key==='Tab'){const controls=[...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea')].filter(e=>e.offsetParent!==null),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
window.addEventListener('hashchange',()=>{N.closeModal();document.body.classList.remove('filter-is-open');N.render();window.scrollTo(0,0);document.getElementById('main')?.focus({preventScroll:true});});
window.addEventListener('storage',event=>{if(event.key===N.STORAGE_KEY)location.reload();});
if(!window.NA||NA.mode==='demo'){try{N.runRecurring();N.syncReminders();}catch(error){N.storageWarning=error.message;}}
N.render();if(window.NA)NA.start().then(()=>N.render());if(N.storageWarning)N.toast(N.storageWarning,true);if(N.migrated&&(!window.NA||NA.mode==='demo'))N.toast('Data versi 1 berhasil dimigrasikan. Salinan lama tetap disimpan.');
})(window.NK);
