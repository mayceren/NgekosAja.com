(function(A,B,N,P){
 'use strict';
 const e=N.e,labels={creating:'Menyiapkan pembayaran',pending:'Menunggu pembayaran',succeeded:'Terverifikasi',denied:'Ditolak',cancelled:'Dibatalkan',expired:'Kedaluwarsa',failed:'Gagal',review:'Perlu pemeriksaan',refunded:'Refund perlu tinjauan',partial_refund:'Refund sebagian perlu tinjauan'};
 const badge=status=>`<span class="status-badge pay-status pay-${e(status)}">${e(labels[status]||status)}</span>`;
 const button=(label,action,id='',disabled=false)=>`<button type="button" class="btn btn-${action.startsWith('confirm')?'primary':'outline'}" data-pay-action="${action}" data-id="${e(id)}" ${disabled?'disabled':''}>${label}</button>`;
 const sandbox='<span class="pay-sandbox">Sandbox Payment</span>';
 const notice='<p class="notice pay-notice">Lingkungan pengujian Midtrans Sandbox. Tidak ada uang sungguhan yang diproses. Status lunas hanya ditampilkan setelah verifikasi server.</p>';
 const attemptsTable=rows=>B.table(['Nomor pembayaran','Dibuat','Total','Status','Tindakan'],rows.map(r=>[e(r.order_id),B.date(r.created_at),B.money(r.gross_amount),badge(r.status),button('Periksa status','status',r.id)+(r.status==='succeeded'&&r.transaction_id?B.button('Bukti pembayaran','receipt',r.transaction_id):'')]));
 const transactionTable=B.transactionTable;B.transactionTable=rows=>{
  const template=document.createElement('template');template.innerHTML=transactionTable(rows);
  for(const [i,row]of rows.entries()){const cell=template.content.querySelectorAll('tbody tr')[i]?.querySelectorAll('td')[1];if(cell&&row.is_simulation)cell.insertAdjacentHTML('beforeend','<br>'+sandbox);}
  return template.innerHTML;
 };
 B.checkoutPage=async(id,signal)=>{
  const [rows,enabled]=await Promise.all([B.services.invoice.list({filters:{id}},signal),P.check()]);const invoice=rows[0];
  if(!invoice)return B.personal('Pembayaran sewa',N.empty('Tagihan tidak tersedia','Tagihan ini tidak ditemukan atau tidak menjadi hak akses akunmu.'));
  const attempts=enabled?await B.read('payment_attempts',{filters:{invoice_id:id},size:10},signal):[],active=attempts.find(r=>['creating','pending','review'].includes(r.status));
  B.pageData={invoice,paymentAttempts:attempts};
  return B.personal('Pembayaran sewa',`<div class="pay-title">${sandbox}<span>Tagihan ${e(id.slice(0,8).toUpperCase())}</span></div>${notice}<div class="pay-checkout"><section class="panel b-panel"><span class="eyebrow">RINCIAN SEWA</span><h2>${e(invoice.property_name_snapshot)}</h2><p>Kamar ${e(invoice.room_number_snapshot)} · ${e(invoice.tenant_name_snapshot)}</p><dl class="b-summary"><dt>Periode</dt><dd>${B.date(invoice.period_start)}</dd><dt>Jatuh tempo</dt><dd>${B.date(invoice.due_date)}</dd><dt>Status tagihan</dt><dd>${B.badge(invoice.effective_status)}</dd></dl><p class="field-help">Nomor tagihan: ${e(invoice.id)}</p>${B.button('Cetak tagihan','invoice',id)}</section><section class="panel b-panel pay-total"><span class="eyebrow">TOTAL PEMBAYARAN</span><dl class="b-summary"><dt>Sewa kos</dt><dd>${B.money(invoice.amount)}</dd><dt>Biaya administrasi</dt><dd>${B.money(invoice.admin_fee)}</dd></dl><strong>${B.money(B.integer(invoice.amount)+B.integer(invoice.admin_fee))}</strong><p>Melalui Midtrans Snap Sandbox</p>${invoice.status==='paid'?`<div class="notice">Tagihan sudah lunas berdasarkan catatan server.</div>${attempts.find(r=>r.transaction_id)?B.button('Lihat bukti pembayaran','receipt',attempts.find(r=>r.transaction_id).transaction_id):''}`:invoice.status==='cancelled'?'<p class="notice">Tagihan dibatalkan dan tidak dapat dibayar.</p>':`${button(active?'Lanjutkan pembayaran Sandbox':'Bayar melalui Sandbox','confirm-rent',id,!enabled||active?.status==='review')}<p class="field-help">${!enabled?'Pembayaran online belum tersedia. Aktivasi Sandbox masih menunggu konfigurasi pengelola.':active?.status==='review'?'Hubungi pengelola untuk meninjau pembayaran ini.':active?'Order yang sama akan digunakan agar tidak membuat pembayaran ganda.':'Harga dan hak akses diperiksa kembali oleh server.'}</p>`}<div class="pay-feedback" role="status" aria-live="polite"></div></section></div>${enabled?B.panel('Riwayat upaya pembayaran',attemptsTable(attempts)):''}`);
 };
 const workspace=B.loadWorkspace;B.loadWorkspace=async(role,page,signal)=>{
  const d=await workspace(role,page,signal),enabled=await P.check();
  if(enabled&&role==='owner'&&page==='boost'){
   d.paymentProperties=await B.services.property.list({size:100,select:'id,name,publication_status',filters:{publication_status:'published'}},signal);
   d.paymentAttempts=await B.read('payment_attempts',{filters:{kind:'boost'},size:10},signal);
  }
  if(enabled&&['owner','admin'].includes(role)&&(!page||page==='finance'))d.paymentAccounting=await B.rpc('payment_accounting',{target_property:B.params().get('property')||null,from_date:B.params().get('from')||null,to_date:B.params().get('to')||null},signal);
  return d;
 };
 const renderWorkspace=B.workspace;B.workspace=d=>{
  const template=document.createElement('template');template.innerHTML=renderWorkspace(d);const main=template.content.querySelector('#main');if(!main)return template.innerHTML;
  if(d.role==='owner'&&d.page==='boost'){
   main.querySelector('.notice')?.remove();const section=document.createElement('section');section.className='panel b-panel';
   section.innerHTML=`${sandbox}<h2>Jangkau lebih banyak calon penghuni</h2><p>Promosikan kos selama 30 hari dengan biaya ${B.money(30000)}. Campaign aktif setelah settlement Sandbox diverifikasi.</p>${notice}${d.paymentProperties?.length?B.select('payment_property','Pilih properti',d.paymentProperties.map(p=>[p.id,p.name]))+button('Tinjau pembelian Boost','confirm-boost'):P.enabled?'<p>Publikasikan properti terlebih dahulu untuk membeli Boost Listing.</p>':'<p class="field-help">Pembelian menunggu aktivasi payment gateway Sandbox oleh pengelola.</p>'}<div class="pay-feedback" role="status"></div>`;
   const heading=main.querySelector('.page-heading,.section-heading');if(heading)heading.after(section);else main.prepend(section);
   if(d.paymentAttempts)main.insertAdjacentHTML('beforeend',B.panel('Riwayat pembayaran Boost',attemptsTable(d.paymentAttempts)));
  }
  if(d.paymentAccounting){const a=d.paymentAccounting,s=a.sandbox||{},live=a.non_simulation||{};
   main.insertAdjacentHTML('afterbegin',`<div class="notice pay-notice">Laporan development mencakup ledger Sandbox. Angka gabungan di bawah bukan pendapatan produksi. Refund ditampilkan sebagai kasus yang perlu ditinjau, bukan koreksi otomatis saldo.</div>${B.panel('Pemisahan ledger pembayaran',`<div class="pay-accounting"><div>${sandbox}<dl class="b-summary"><dt>GMV sewa</dt><dd>${B.money(s.rent_gmv||0)}</dd><dt>Biaya admin</dt><dd>${B.money(s.admin_fees||0)}</dd><dt>Pendapatan Boost</dt><dd>${B.money(s.boost_revenue||0)}</dd><dt>Pendapatan platform</dt><dd>${B.money(s.platform_revenue||0)}</dd></dl></div><div><strong>Ledger nonsimulasi historis</strong><p>Integrasi ini tidak mendukung transaksi produksi.</p><dl class="b-summary"><dt>GMV sewa</dt><dd>${B.money(live.rent_gmv||0)}</dd><dt>Pendapatan platform</dt><dd>${B.money(live.platform_revenue||0)}</dd></dl></div></div><p class="field-help">${e(a.refund_cases)} kasus refund memerlukan pemeriksaan. Ringkasan ini adalah gross ledger, bukan arus kas bersih.</p>`)}`);
  }
  return template.innerHTML;
 };
 const receipt=B.receiptDetail;B.receiptDetail=async id=>{
  if(!await P.check())return receipt(id);
  const rows=await B.services.transaction.list({filters:{id}}),t=rows[0];if(!t||t.status!=='succeeded')throw B.fail('Bukti tersedia setelah transaksi terverifikasi.');
  const attempts=await B.read('payment_attempts',{filters:{transaction_id:id},size:1}),attempt=attempts[0];
  let invoice;if(t.invoice_id)invoice=(await B.services.invoice.list({filters:{id:t.invoice_id}}))[0];
  B.printRecord={type:'receipt',row:{...t,paymentAttempt:attempt,invoice}};B.modal('Bukti pembayaran',B.printMarkup('receipt',B.printRecord.row)+B.button('Cetak / simpan PDF','print'));
 };
 const print=B.printMarkup;B.printMarkup=(type,row)=>{
  if(type!=='receipt'||!row.paymentAttempt)return print(type,row);
  const a=row.paymentAttempt,i=row.invoice,verified=['succeeded','refunded','partial_refund'].includes(a.status)&&row.status==='succeeded'&&!!a.verified_at;
  return `<section class="b-document"><h2>NgekosAja.com</h2>${sandbox}<h3>Bukti pembayaran Sandbox</h3><p>Bukan bukti pemindahan uang sungguhan.</p><p>Nomor: ${e(a.order_id)}</p><p>Referensi transaksi: ${e(row.id)}</p>${i?`<p>${e(i.property_name_snapshot)} · Kamar ${e(i.room_number_snapshot)}</p><p>${e(i.tenant_name_snapshot)} · Periode ${B.date(i.period_start)}</p><p>Referensi tagihan: ${e(i.id)}</p>`:`<p>Pembelian Boost Listing 30 hari · ${e(a.property_name_snapshot||'Properti')}</p><p>Pembayar: ${e(a.payer_name_snapshot||A.profile?.display_name||'Pemilik')}</p>`}<dl class="b-summary"><dt>Nominal</dt><dd>${B.money(row.amount)}</dd><dt>Biaya admin</dt><dd>${B.money(row.admin_fee)}</dd><dt>Total</dt><dd>${B.money(B.integer(row.amount)+B.integer(row.admin_fee))}</dd><dt>Metode</dt><dd>${e(row.method)}</dd><dt>Tercatat</dt><dd>${e(new Date(row.occurred_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}))} WIB</dd><dt>Verifikasi server</dt><dd>${verified?'Terverifikasi':'Belum terverifikasi'}</dd></dl>${badge(a.status)}${['refunded','partial_refund'].includes(a.status)?'<p>Refund memerlukan peninjauan; dokumen ini mencatat transaksi historis.</p>':''}</section>`;
 };
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-pay-action]');if(!el||A.mode!=='connected')return;event.preventDefault();if(el.disabled)return;
  const action=el.dataset.payAction,id=el.dataset.id,scope=B.scope();el.disabled=true;
  try{
   if(!A.user)throw B.fail('Masuk untuk melanjutkan.');if(!await P.check())throw B.fail('Pembayaran Sandbox belum diaktifkan.');
   if(action==='confirm-rent'){
    const invoice=B.pageData?.invoice;if(invoice?.id!==id||invoice.status!=='pending')throw B.fail('Tagihan tidak dapat dibayar.');
    B.modal('Tinjau pembayaran sewa',`${sandbox}<p>${e(invoice.property_name_snapshot)} · ${e(invoice.tenant_name_snapshot)}</p><dl class="b-summary"><dt>Sewa</dt><dd>${B.money(invoice.amount)}</dd><dt>Biaya admin</dt><dd>${B.money(invoice.admin_fee)}</dd><dt>Total Sandbox</dt><dd>${B.money(B.integer(invoice.amount)+B.integer(invoice.admin_fee))}</dd></dl>${notice}${button('Buka Midtrans Sandbox','start-rent',id)}`);
   }else if(action==='confirm-boost'){
    const select=document.querySelector('[name="payment_property"]'),pid=select?.value;if(!pid)throw B.fail('Pilih properti terlebih dahulu.');
    B.modal('Tinjau pembelian Boost',`${sandbox}<h3>${e(select.selectedOptions[0].textContent)}</h3><p>30 hari · ${B.money(30000)}</p>${notice}${button('Buka Midtrans Sandbox','start-boost',pid)}`);
   }else if(action==='start-rent'||action==='start-boost'){
    el.textContent='Menyiapkan pembayaran…';const response=await P.initiate(action==='start-rent'?'rent':'boost',id);if(scope!==B.scope())return;await P.open(response);
   }else if(action==='status'){
    const result=await P.status(id);if(scope!==B.scope())return;N.toast('Status server: '+(labels[result.attempt.status]||result.attempt.status));P.refresh();
   }
  }catch(error){if(scope===B.scope()&&error.code!=='STALE'){const feedback=document.querySelector('.modal .pay-feedback,.pay-feedback');if(feedback)feedback.textContent=B.error(error);N.toast(B.error(error),true);}}
  finally{if(el.isConnected){el.disabled=false;if(action.startsWith('start-'))el.textContent='Coba buka kembali Midtrans Sandbox';}}
 },true);
})(window.NA,window.NB,window.NK,window.NPay);
