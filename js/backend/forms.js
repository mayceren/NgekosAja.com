(function(B,A,N){
 'use strict';
 const S=B.services,e=N.e,I=B.input,T=B.textarea,H=B.hidden,Q=B.select;
 B.modal=(title,body,wide=false)=>{
  N.modal(e(title),`<div class="b-modal-body">${body}</div>`,wide);
  const close=document.querySelector('.modal [data-action="close-modal"]');if(close){close.removeAttribute('data-action');close.dataset.bAction='close';}
 };
 B.facilityFields=(rows,selected=[])=>`<fieldset><legend>Fasilitas</legend>${rows.map(f=>`<label class="checkbox-label"><input name="facilities" type="checkbox" value="${e(f.id)}" ${selected.includes(f.id)?'checked':''}>${e(f.name)}</label>`).join('')}</fieldset>`;
 B.propertyForm=async id=>{
  const [facilities,rows]=await Promise.all([S.property.facilities(),id?S.property.list({filters:{id},select:'*,property_images(image_path,alt_text,position),property_facilities(facility_id),property_rules(rule_text),property_landmarks(name,distance_label)'}):Promise.resolve([])]),p=rows[0]||{};
  if(id&&!p.id)throw B.fail('Properti tidak tersedia.');
  B.modal(id?'Edit properti':'Tambah properti',B.form('property',H('id',id||'')+`<div class="b-filters">${I('name','Nama kos',p.name,'text','required minlength="3" maxlength="100"')}${I('location','Lokasi',p.location,'text','required minlength="2" maxlength="80"')}${I('address','Alamat',p.address,'text','required minlength="5" maxlength="300"')}${I('base_rent','Sewa dasar (rupiah)',p.base_rent||'1500000','number','required min="100000" max="100000000" step="1"')}${Q('gender_policy','Tipe kos',['mixed','male','female'],p.gender_policy)}${I('room_size','Ukuran kamar',p.room_size||'3 × 4 m','text','required maxlength="60"')}${Q('publication_status','Publikasi',['draft','published','archived'],p.publication_status||'draft')}</div>`+T('description','Deskripsi',p.description,'required minlength="10" maxlength="4000"')+B.facilityFields(facilities,(p.property_facilities||[]).map(f=>f.facility_id))+T('rules','Peraturan (satu per baris)',(p.property_rules||[]).map(r=>r.rule_text).join('\n'),'maxlength="10000"')+T('landmarks','Area sekitar: nama | jarak (satu per baris)',(p.property_landmarks||[]).map(l=>l.name+' | '+l.distance_label).join('\n'),'maxlength="4000"')+T('images','Referensi ilustrasi lokal (satu path per baris)',(p.property_images?.length?p.property_images:[{image_path:'assets/images/room-2.jpg'}]).sort((a,b)=>(a.position||0)-(b.position||0)).map(im=>im.image_path).join('\n'),'required maxlength="4000"')+'<p class="field-help">Gunakan aset assets/images/ yang tersedia. Unggah foto cloud tersedia pada tahap selanjutnya. Informasi area diberi label ilustrasi.</p>'),true);
 };
 B.roomForm=async id=>{
  const [properties,facilities,rows]=await Promise.all([S.property.list({size:100,select:'id,name'}),S.property.facilities(),id?S.room.list({filters:{id},select:'*,room_facilities(facility_id)'}):Promise.resolve([])]),r=rows[0]||{};
  if(id&&!r.id)throw B.fail('Kamar tidak tersedia.');if(!properties.length)throw B.fail('Tambahkan properti terlebih dahulu.');
  B.modal(id?'Edit kamar':'Tambah kamar',B.form('room',H('id',id||'')+Q('property_id','Properti',properties.filter(p=>!id||p.id===r.property_id).map(p=>[p.id,p.name]),r.property_id)+`<div class="b-filters">${I('number','Nomor kamar',r.number,'text','required maxlength="20"')}${I('room_type','Tipe kamar',r.room_type||'Standard','text','required maxlength="60"')}${I('rent','Harga sewa (rupiah)',r.rent||'1500000','number','required min="100000" max="100000000" step="1"')}${Q('operational_status','Status operasional',['available','maintenance','inactive'],r.operational_status)}</div>`+B.facilityFields(facilities,(r.room_facilities||[]).map(f=>f.facility_id))+'<p class="field-help">Status Terisi mengikuti sewa aktif. Kamar terisi tidak dapat dinonaktifkan.</p>'));
 };
 B.agreementOptions=async()=> (await S.agreement.list({size:100,filters:{status:'active'}})).map(B.mappers.agreement);
 B.agreementSelect=rows=>Q('agreement_id','Masa sewa',rows.map(a=>[a.id,`${a.name} · ${a.property} / ${a.room}`]));
 B.invoiceForm=async(kind,id)=>{
  const now=B.today(),month=now.slice(0,7)+'-01';
  if(kind==='edit-invoice'){
   const rows=await S.invoice.list({filters:{id}}),r=rows[0];if(!r||r.status!=='pending')throw B.fail('Hanya tagihan belum lunas yang dapat diubah.');
   B.modal('Ubah tagihan',B.form('edit-invoice',H('id',id)+I('amount','Sewa (rupiah)',r.amount,'number','required min="100000" max="100000000" step="1"')+I('due','Jatuh tempo',r.due_date,'date','required')+T('notes','Catatan',r.notes,'maxlength="1000"')+'<label class="checkbox-label"><input name="cancel" type="checkbox">Batalkan tagihan ini</label><p class="field-help">Tagihan yang memiliki upaya pembayaran atau sudah final tidak dapat diubah.</p>'));return;
  }
  if(kind==='generate-form'){B.modal('Buat tagihan bulanan',B.form('generate',I('month','Periode',now.slice(0,7),'month','required'),'Jalankan generator'));return;}
  const rows=await B.agreementOptions();if(!rows.length)throw B.fail('Belum ada masa sewa aktif yang dapat ditagih.');
  const bulk=kind==='bulk-form',recurring=kind==='recurring-form';
  const agreement=bulk?`<fieldset><legend>Pilih masa sewa</legend>${rows.map(a=>`<label class="checkbox-label"><input name="agreements" type="checkbox" value="${e(a.id)}">${e(a.name)} · ${e(a.property)} / ${e(a.room)}</label>`).join('')}</fieldset>`:B.agreementSelect(rows);
  B.modal(recurring?'Jadwal tagihan berulang':bulk?'Buat tagihan massal':'Buat tagihan sewa',B.form(recurring?'recurring':bulk?'bulk':'invoice',agreement+I('month',recurring?'Periode awal':'Periode tagihan',month.slice(0,7),'month','required')+I('amount',bulk?'Sewa seragam (kosongkan untuk nominal agreement)':'Sewa (rupiah)',bulk?'':rows[0].rent,'number',`${bulk?'':'required'} min="100000" max="100000000" step="1"`)+(recurring?I('day','Tanggal pembayaran','5','number','required min="1" max="28" step="1"')+'<label class="checkbox-label"><input name="enabled" type="checkbox" checked>Jadwal aktif</label><p class="field-help">Periode awal yang sudah tersimpan tidak diubah. Generator berjalan manual.</p>':I('due','Jatuh tempo',now,'date','required')+T('notes','Catatan','','maxlength="1000"'))),true);
 };
 B.offerForm=async()=>{
  const [conversations,rooms]=await Promise.all([S.chat.list(),S.room.list({size:100,select:'*,properties(name),rental_agreements(status)'})]);
  const available=rooms.filter(r=>r.operational_status==='available'&&!r.rental_agreements.some(a=>a.status==='active'));
  if(!conversations.length||!available.length)throw B.fail('Perlu percakapan dari listing terpublikasi dan kamar yang tersedia.');
  B.modal('Buat penawaran sewa',B.form('offer',Q('conversation_id','Calon penghuni dari percakapan',conversations.map(c=>[c.id,c.counterpart_name+' · '+c.property_name]))+Q('room_id','Kamar',available.map(r=>[r.id,r.properties?.name+' · '+r.number]))+I('start_date','Tanggal mulai',B.today(),'date','required')+I('end_date','Tanggal akhir','','date','required')+I('rent','Sewa bulanan (rupiah)','1500000','number','required min="100000" max="100000000" step="1"')+I('payment_day','Tanggal pembayaran','5','number','required min="1" max="28"')+'<p class="field-help">Percakapan dan kamar harus pada properti yang sama. Penghuni meninjau dan menyetujui penawaran sebelum kamu dapat melakukan check-in. Penawaran berlaku 7 hari.</p>','Kirim penawaran'));
 };
 B.transferForm=async id=>{
  const agreements=await B.agreementOptions(),a=agreements.find(r=>r.id===id),rooms=await S.room.list({size:100,select:'*,properties(name),rental_agreements(status)'});
  if(!a)throw B.fail('Masa sewa aktif tidak ditemukan.');
  B.modal('Pindah kamar',B.form('transfer',H('id',id)+Q('room','Kamar tujuan',rooms.filter(r=>r.id!==a.room_id&&r.operational_status==='available'&&!r.rental_agreements.some(x=>x.status==='active')).map(r=>[r.id,`${r.properties?.name} / ${r.number}`]))+I('date','Tanggal pindah',B.today(),'date','required')+I('end','Tanggal akhir',a.end_date,'date','required')+I('rent','Sewa baru (rupiah)',a.rent,'number','required min="100000" max="100000000" step="1"')+I('day','Tanggal pembayaran',a.payment_day,'number','required min="1" max="28"')+'<p class="field-help">Pastikan perubahan disepakati penghuni. Histori kamar lama tetap disimpan.</p>'));
 };
 B.complaintForm=async()=>{
  const rows=await B.agreementOptions();if(!rows.length)throw B.fail('Laporan baru memerlukan masa sewa aktif.');
  B.modal('Laporkan kendala',B.form('complaint',B.agreementSelect(rows)+I('title','Judul kendala','','text','required minlength="5" maxlength="150"')+T('description','Jelaskan lokasi, waktu dan kendala','','required minlength="10" maxlength="4000"')+Q('category','Kategori',N.categories)+Q('urgency','Urgensi',['low','medium','high','urgent'],'medium')+'<p class="field-help">Unggah lampiran tersedia setelah integrasi penyimpanan cloud.</p>','Kirim laporan'));
 };
 B.complaintDetail=async id=>{
  const [rows,history,notes,analyses,attachments]=await Promise.all([S.complaint.list({filters:{id}}),S.complaint.history(id),S.complaint.notes(id),S.complaint.analyses(id),S.complaint.attachments(id)]),c=rows[0];
  if(!c)throw B.fail('Laporan tidak tersedia.');B.currentComplaint=c;
  const agreements=await S.agreement.list({filters:{id:c.agreement_id}});
  const owner=A.allowed('admin')||agreements[0]?.rooms?.properties?.owner_id===A.user.id;
  const similar=await S.complaint.list({filters:{category:c.category},size:100});
  B.analysis=N.analyzeComplaint(c.title,c.description,similar.map(r=>({...r,status:r.status==='resolved'?'Selesai':r.status})));
  const analysis=B.analysis;
  B.modal(c.title,`<p class="b-preserve">${e(c.description)}</p><div class="b-actions">${B.badge(c.status)}${B.badge(c.priority)}<span>${e(c.category)}</span></div>${B.panel('Riwayat penanganan',history.map(h=>`<p>${dt(h.created_at)} · ${e(B.labels[h.status])}<br>${e(h.note)}</p>`).join(''))}${notes.length?B.panel('Catatan',notes.map(n=>`<p>${e(n.body)}</p>`).join('')):''}${B.panel('Analisis berbasis aturan',`<p>${e(analysis.summary)}</p><p>Kategori ${e(analysis.category)} · Prioritas ${e(analysis.priority)} · ${analysis.similar} laporan serupa pada data yang boleh diakses.</p><p>${e(analysis.action)}</p><p class="field-help">Rekomendasi aturan kata kunci, bukan AI generatif atau pengganti penanganan darurat. Keputusan penanganan tetap pada pengelola.</p>${B.button('Simpan rekomendasi','save-analysis',id)}`)}${analyses.length?`<p>${analyses.length} rekomendasi tersimpan pada laporan ini.</p>`:''}<p class="field-help">${attachments.length} referensi lampiran tersimpan. Akses berkas cloud menunggu Phase 4.</p>${owner&&c.status!=='resolved'?B.form('transition',H('id',id)+Q('status','Status penanganan',['waiting','in_progress','awaiting_confirmation'],c.status)+Q('category','Kategori akhir',N.categories,c.category)+Q('priority','Prioritas akhir',['low','medium','high','urgent'],c.priority)+I('eta','Estimasi selesai',c.estimated_completion||'','date')+T('note','Catatan penanganan','','maxlength="1000"'),'Perbarui penanganan'):!owner&&['awaiting_confirmation','resolved'].includes(c.status)?B.form('tenant-transition',H('id',id)+Q('status','Tindakan',c.status==='awaiting_confirmation'?[['resolved','Konfirmasi selesai'],['waiting','Buka kembali']]:[['waiting','Buka kembali']])+T('note','Catatan / alasan pembukaan kembali','','maxlength="1000"'),'Kirim tanggapan'):''}`,true);
 };
 const dt=B.date;
 B.invoiceDetail=async id=>{
  const rows=await S.invoice.list({filters:{id}}),i=rows[0];if(!i)throw B.fail('Tagihan tidak ditemukan.');B.printRecord={type:'invoice',row:i};
  B.modal('Rincian tagihan',B.printMarkup('invoice',i)+B.button('Cetak tagihan','print'));
 };
 B.receiptDetail=async id=>{
  const rows=await S.transaction.list({filters:{id}}),t=rows[0];if(!t||t.status!=='succeeded')throw B.fail('Bukti tersedia untuk transaksi berhasil yang tercatat.');B.printRecord={type:'receipt',row:t};
  B.modal('Bukti pembayaran',B.printMarkup('receipt',t)+B.button('Cetak bukti','print'));
 };
 B.printMarkup=(type,row)=>`<section class="b-document"><h2>NgekosAja.com</h2><h3>${type==='invoice'?'Tagihan sewa':'Bukti pembayaran'}</h3><p>ID: ${e(row.id)}</p>${type==='invoice'?`<p>${e(row.tenant_name_snapshot)} · ${e(row.property_name_snapshot)} · Kamar ${e(row.room_number_snapshot)}</p><p>Periode ${dt(row.period_start)} · Jatuh tempo ${dt(row.due_date)}</p>`:`<p>Waktu ${dt(row.occurred_at)} · ${e(row.method)}</p>${row.is_simulation?'<p>Transaksi simulasi tercatat; bukan bukti pemindahan uang.</p>':''}`}<dl class="b-summary"><dt>Nominal</dt><dd>${B.money(row.amount)}</dd><dt>Biaya admin</dt><dd>${B.money(row.admin_fee)}</dd><dt>Total</dt><dd>${B.money(B.integer(row.amount)+B.integer(row.admin_fee))}</dd></dl>${B.badge(row.effective_status||row.status)}</section>`;
})(window.NB,window.NA,window.NK);
