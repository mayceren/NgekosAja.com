(function(B,A,N){
 'use strict';
 const e=N.e,S=B.services,m=B.money,dt=B.date;
 B.selection=[];B.eventsSeen=new Set();B.analyticsSession=crypto.randomUUID();
 B.params=()=>new URLSearchParams(location.hash.split('?')[1]||'');
 B.page=()=>Math.max(0,Math.min(10000,Number(B.params().get('page'))||0));
 B.link=(text,path,cls='outline')=>`<a class="btn btn-${cls} btn-sm" href="#/${e(path)}">${e(text)}</a>`;
 B.button=(text,action,id='',cls='outline')=>`<button type="button" class="btn btn-${cls} btn-sm" data-b-action="${e(action)}" data-id="${e(id)}">${e(text)}</button>`;
 B.panel=(title,body)=>`<section class="panel b-panel"><h2>${e(title)}</h2>${body}</section>`;
 B.table=(columns,rows)=>rows.length?`<div class="table-wrap"><table><thead><tr>${columns.map(c=>`<th scope="col">${e(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:N.empty('Belum ada data','Data yang menjadi hak akses akunmu akan tampil di sini.');
 B.pager=(count,size=25)=>`<nav class="b-pagination" aria-label="Halaman data">${B.page()?B.button('Sebelumnya','page',String(B.page()-1)):''}<span>Halaman ${B.page()+1}</span>${count===size?B.button('Berikutnya','page',String(B.page()+1)):''}</nav>`;
 B.stats=items=>`<div class="b-stats">${items.map(([title,value])=>`<article class="stat-card"><span>${e(title)}</span><strong>${e(value)}</strong></article>`).join('')}</div>`;
 B.form=(kind,body,label='Simpan')=>`<form data-backend-form="${e(kind)}" class="b-form">${body}<p class="auth-form-error" role="alert" tabindex="-1"></p><button class="btn btn-primary" type="submit">${e(label)}</button></form>`;
 B.input=(name,label,value='',type='text',attrs='')=>`<label class="field">${e(label)}<input name="${e(name)}" type="${e(type)}" value="${e(value)}" ${attrs}></label>`;
 B.select=(name,label,items,value='')=>`<label class="field">${e(label)}<select name="${e(name)}">${items.map(item=>{const [id,text]=Array.isArray(item)?item:[item,B.labels[item]||item];return `<option value="${e(id)}" ${String(value)===String(id)?'selected':''}>${e(text)}</option>`;}).join('')}</select></label>`;
 B.textarea=(name,label,value='',attrs='')=>`<label class="field">${e(label)}<textarea name="${e(name)}" ${attrs}>${e(value)}</textarea></label>`;
 B.hidden=(name,value)=>`<input type="hidden" name="${e(name)}" value="${e(value)}">`;
 B.shell=(role,page,body)=>{
  const groups=role==='owner'?[['','grid','Ringkasan'],['properties','building','Properti'],['rooms','bed','Kamar'],['tenants','users','Penghuni & sewa'],['payments','receipt','Tagihan'],['recurring','calendar','Tagihan berulang'],['finance','wallet','Keuangan'],['complaints','tool','Keluhan'],['chat','chat','Pesan'],['boost','rocket','Promosi'],['analytics','eye','Analitik']]:role==='admin'?[['','grid','Ringkasan platform'],['users','users','Pengguna'],['properties','building','Properti'],['rooms','bed','Kamar'],['agreements','key','Sewa'],['payments','receipt','Tagihan'],['transactions','wallet','Transaksi'],['complaints','tool','Keluhan'],['boost','rocket','Promosi'],['activity','list','Aktivitas']]:[['','home','Ringkasan'],['bills','receipt','Tagihan sewa'],['history','wallet','Riwayat pembayaran'],['agreements','key','Masa sewa'],['complaints','tool','Laporan keluhan'],['chat','chat','Pesan']];
  return `${A.navbar()}<div class="dashboard-layout connected-layout b-layout"><aside class="sidebar"><span class="eyebrow">${role==='owner'?'PENGELOLAAN KOS':role==='admin'?'ADMINISTRATOR':'RUANG PENGHUNI'}</span><nav aria-label="Navigasi operasional">${groups.map(([path,icon,title])=>`<a class="side-link ${page===path?'active':''}" href="#/${path==='chat'?'chat':role+(path?'/'+path:'')}">${N.icon(icon)}<span>${e(title)}</span></a>`).join('')}<a class="side-link" href="#/notifications">${N.icon('bell')}Notifikasi</a><a class="side-link" href="#/account/preferences">${N.icon('settings')}Preferensi</a><a class="side-link" href="#/account/profile">${N.icon('user')}Profil saya</a></nav></aside><div class="dashboard-area"><main id="main" class="dashboard-main">${body}</main><footer class="dashboard-footnote">NgekosAja.com · ${dt(B.today())} · Data sesuai akses akun</footer></div></div>`;
 };
 B.personal=(title,body)=>`${A.navbar()}<main id="main" class="container section">${N.heading('RUANG PRIBADI',e(title),'Tersimpan pada akunmu, dapat diakses kembali dari perangkat lain.')}<nav class="b-personal-nav">${[['favorites','Kos favorit'],['searches','Pencarian terakhir'],['compare','Bandingkan'],['offers','Penawaran sewa'],['chat','Pesan'],['notifications','Notifikasi'],['account/preferences','Preferensi']].map(([p,t])=>B.link(t,p)).join('')}</nav>${body}</main>${A.footer()}`;
 B.card=p=>`<article class="property-card" data-b-listing="${e(p.id)}"><div class="property-image"><a href="#/property/${e(p.id)}"><img loading="lazy" data-media-ref="${e(p.images?.[0]?.path||'')}" src="${e(B.image(p.images?.[0]?.path))}" alt="${e(p.images?.[0]?.alt||p.name)}"></a>${p.promoted?'<span class="promo-badge">Promosi</span>':''}<span class="type-badge">${e(B.labels[p.gender_policy])}</span></div><div class="property-body"><p class="property-location">${N.icon('pin')}${e(p.location)}</p><h3><a href="#/property/${e(p.id)}">${e(p.name)}</a></h3><p>${e(p.available_rooms)} dari ${e(p.total_rooms)} kamar tersedia</p><div class="property-facilities">${(p.facilities||[]).slice(0,3).map(f=>`<span>${e(f)}</span>`).join('')}</div><div class="property-bottom"><strong>${m(p.base_rent)}<small> / bulan</small></strong></div><div class="b-actions">${B.link('Lihat detail','property/'+p.id)}${B.button('Simpan','favorite',p.id)}${B.button('Bandingkan','compare',p.id)}</div></div></article>`;
 const catalogueOptions=()=>Object.fromEntries(B.params());
 B.catalogue=async(signal)=>{
  const options={...catalogueOptions(),query:B.params().get('query')||A.search||'',page:B.page()};
  const rows=(await S.catalogue.list(options,signal)).map(B.mappers.property);
  const facilities=await B.load('facility-master',s=>S.property.facilities(s),300000);
  return {rows,options,facilities};
 };
 B.marketplace=d=>`${A.navbar('marketplace')}<main class="container section" id="main"><div class="marketplace-banner"><div><span class="eyebrow">TEMUKAN RUANG BARUMU</span><h1>Kos yang pas, <em>rasanya beda.</em></h1><p>Pilihan kos yang dipublikasikan langsung oleh pengelola.</p></div></div>${B.form('search',`<div class="b-filters">${B.input('query','Nama atau lokasi',d.options.query,'search','maxlength="80" placeholder="Coba Grogol"')}${B.input('min','Harga minimum',d.options.min||'','number','min="0" step="1"')}${B.input('max','Harga maksimum',d.options.max||'','number','min="0" step="1"')}${B.select('gender','Tipe kos',[['','Semua tipe'],'male','female','mixed'],d.options.gender)}${B.select('facility','Fasilitas',[['','Semua fasilitas'],...d.facilities.map(f=>[f.name,f.name])],d.options.facility)}${B.select('sort','Urutkan',[['recommended','Rekomendasi'],['asc','Harga terendah'],['desc','Harga tertinggi']],d.options.sort)}<label class="checkbox-label"><input name="available" type="checkbox" ${d.options.available?'checked':''}>Hanya kamar tersedia</label>${B.select('view','Tampilan',[['grid','Grid'],['list','Daftar']],d.options.view)}</div>`,'Terapkan pencarian')}<div class="b-actions">${B.link('Hapus filter','marketplace')}${B.link('Kos favorit','favorites')}${B.link('Bandingkan pilihan','compare')}</div><div class="property-grid connected-listings ${d.options.view==='list'?'b-list-view':''}">${d.rows.length?d.rows.map(B.card).join(''):N.empty('Belum ada kos yang cocok','Ubah filter atau cari lokasi lain. Listing draft dan arsip tidak tampil di katalog.')}</div>${B.pager(d.rows.length,12)}</main>${A.footer()}`;
 B.detail=async(id,signal)=>{
  const rows=await S.catalogue.list({id},signal),p=rows[0];
  if(!p)return A.publicNotice('Kos belum ditemukan','Listing belum dipublikasikan atau sudah diarsipkan.');
  const related=(await S.catalogue.list({query:p.location},signal)).filter(x=>x.id!==id).slice(0,3);
  B.currentProperty=p;
  return `${A.navbar()}<main class="container section" id="main"><div class="detail-breadcrumb"><a href="#/marketplace">Cari kos</a> / ${e(p.location)}</div><div class="detail-top"><div><span class="eyebrow">RUANG UNTUK CERITA BARU</span><h1>${e(p.name)}</h1><p>${e(p.address)}</p>${p.promoted?N.badge('Promosi'):''}</div><strong class="detail-price">${m(p.base_rent)} <small>/ bulan</small></strong></div><div class="connected-gallery">${(p.images.length?p.images:[{path:'assets/images/room-2.jpg',alt:'Ilustrasi kamar'}]).map(im=>`<button class="b-gallery" data-b-action="image" data-id="${e(im.path)}" aria-label="Perbesar ${e(im.alt||p.name)}"><img data-media-ref="${e(im.path)}" src="${e(B.image(im.path))}" alt="${e(im.alt||p.name)}"></button>`).join('')}</div><div class="detail-grid"><div>${B.panel('Tentang kos',`<p class="b-preserve">${e(p.description)}</p><p>Tipe ${e(B.labels[p.gender_policy])} · Ukuran ${e(p.room_size)}</p>`)}${B.panel('Fasilitas',`<div class="facility-grid">${p.facilities.map(f=>`<span>${N.icon('check')}${e(f)}</span>`).join('')}</div>`)}${B.panel('Peraturan kos',`<ul>${p.rules.map(f=>`<li>${e(f)}</li>`).join('')}</ul>`)}${B.panel('Area sekitar',p.landmarks.map(l=>`<p>${e(l.name)} · ${e(l.distance)} ${l.illustrative?'(ilustrasi)':''}</p>`).join('')||'<p>Informasi area belum ditambahkan.</p>')}</div><aside>${B.panel('Hubungi pengelola',`<h3>${e(p.available_rooms)} kamar tersedia</h3><p>Pengelola ${e(p.name)} menerima pertanyaan melalui pesan. Ketersediaan mengikuti penempatan sewa aktif.</p><div class="b-actions">${B.button('Hubungi pemilik','contact',p.id,'primary')}${B.button('Simpan kos','favorite',p.id)}${B.button('Bandingkan','compare',p.id)}</div>`)}</aside></div>${B.panel('Pilihan di sekitar',`<div class="property-grid">${related.length?related.map(B.card).join(''):'<p>Belum ada pilihan lain di area ini.</p>'}</div>`)}</main>${A.footer()}`;
 };
 B.invoiceTable=(rows,owner=false)=>B.table(['Periode / penghuni','Kos / kamar','Jatuh tempo','Sewa','Status','Tindakan'],rows.map(i=>[`${dt(i.period_start)}<small>${e(i.tenant_name_snapshot)}</small>`,`${e(i.property_name_snapshot)}<small>Kamar ${e(i.room_number_snapshot)}</small>`,dt(i.due_date),m(i.amount),B.badge(i.effective_status||i.status),`<div class="b-actions">${B.button('Rincian','invoice',i.id)}${owner&&i.status==='pending'?B.button('Ubah','edit-invoice',i.id)+B.button('Reminder','remind',i.id):!owner&&i.status==='pending'?B.link('Bayar','checkout/'+i.id,'primary'):''}</div>`]));
 B.transactionTable=rows=>B.table(['Waktu','Jenis','Nominal','Biaya admin','Status','Bukti'],rows.map(t=>[dt(t.occurred_at),t.kind==='rent'?'Sewa kos':'Promosi',m(t.amount),m(t.admin_fee),B.badge(t.status),t.status==='succeeded'?B.button('Lihat bukti','receipt',t.id):'—']));
 B.agreementTable=(rows,owner)=>B.table(['Penghuni','Kos / kamar','Masa sewa','Sewa / jadwal','Status','Tindakan'],rows.map(a=>[e(a.name),`${e(a.property)}<small>Kamar ${e(a.room)}</small>`,`${dt(a.start_date)} — ${dt(a.end_date)}`,`${m(a.rent)}<small>Setiap tanggal ${e(a.payment_day)}</small>`,B.badge(a.status),owner&&a.status==='active'?`<div class="b-actions">${B.button('Pindah','transfer',a.id)}${B.button('Check-out','checkout-tenant',a.id)}</div>`:'—']));
 B.chart=rows=>{
  const max=rows.reduce((v,r)=>B.integer(r.rent_revenue)>v?B.integer(r.rent_revenue):v,1n);
  return `<div class="b-chart" role="img" aria-label="Grafik pendapatan bulanan">${rows.map(r=>`<div><span>${m(r.rent_revenue)}</span><i style="height:${Number(B.integer(r.rent_revenue)*100n/max)}px"></i><small>${e(r.month.slice(0,7))}</small></div>`).join('')}</div>`;
 };
 B.distribution=(title,parts)=>{
  const total=parts.reduce((sum,[,value])=>sum+B.integer(value||0),0n);
  return B.panel(title,`<div class="b-distribution">${parts.map(([label,value])=>`<div><span>${e(label)}</span><strong>${e(value||'0')}</strong><meter min="0" max="100" value="${total?Number(B.integer(value||0)*100n/total):0}">${e(value||'0')}</meter></div>`).join('')}</div>`);
 };
 B.loadWorkspace=async(role,page,signal)=>{
  const filters={}, p=B.params(),property=p.get('property')||null,from=p.get('from')||null,to=p.get('to')||null;
  const options={page:B.page(),filters};
  if(role==='tenant')filters.tenant_id=A.user.id;
  let data={role,page};
  if(['properties','listings'].includes(page)) data.rows=await S.property.list({page:B.page(),select:'*,property_images(image_path,alt_text,position),property_facilities(facility_id),property_rules(rule_text),property_landmarks(name,distance_label)'},signal);
  else if(page==='rooms'){
   data.rows=await S.room.list({page:B.page(),select:'*,properties(name),room_facilities(facility_id),rental_agreements(id,status,tenant_id)',filters:property?{property_id:property}:{}},signal);
  }else if(['tenants','agreements'].includes(page)){
   data.rows=(await S.agreement.list(options,signal)).map(B.mappers.agreement);
   if(page==='tenants') {try{data.offers=await S.agreement.offers({page:B.page()},signal);}catch(error){data.offerError=B.error(error);}}
  }else if(['payments','bills'].includes(page)){
   const f={};if(p.get('status'))f.effective_status=p.get('status');
   data.rows=await S.invoice.list({page:B.page(),filters:f},signal);
  }else if(['transactions','history'].includes(page))data.rows=await S.transaction.list({page:B.page(),order:'occurred_at'},signal);
  else if(page==='recurring')data.rows=await S.invoice.recurring({page:B.page()},signal);
  else if(page==='complaints'){
   const f={};for(const k of ['status','category','priority'])if(p.get(k))f[k]=p.get(k);
   data.rows=await S.complaint.list({page:B.page(),filters:f},signal);
  }else if(['boost','campaigns'].includes(page))data.rows=await S.boost.list({page:B.page(),select:'*,properties(name)'},signal);
  else if(page==='analytics')data.rows=await S.analytics.list({page:B.page(),select:'*,properties(name)'},signal);
  else if(page==='activity')data.rows=await S.activity.list({page:B.page()},signal);
  else if(page==='users')data.rows=await S.admin.profiles({page:B.page()},signal);
  else if(page==='finance'||!page){
   if(role==='owner'){
    const args={target_property:property,from_date:from,to_date:to};
    const [report,monthly,transactions,upcoming,complaints,properties,campaigns,activity]=await Promise.all([S.finance.owner(args,signal),S.finance.monthly(args,signal),S.transaction.list({size:5,order:'occurred_at'},signal),S.invoice.list({size:5,order:'due_date',asc:true,filters:{status:'pending'}},signal),S.complaint.list({size:5},signal),S.property.list({size:100,select:'id,name,publication_status'},signal),S.boost.list({size:100},signal),S.activity.list({size:5},signal)]);
    Object.assign(data,{report:report[0],monthly,transactions,upcoming,complaints,properties,campaigns,activity});
    data.operations=await S.finance.operations(false,property,signal);
   }else if(role==='admin'){
    const [report,operations]=await Promise.all([S.finance.platform(signal),S.finance.operations(true,null,signal)]);data.report=report[0];data.operations=operations;
   }else{
    const [agreements,invoices,transactions,complaints,notifications]=await Promise.all([S.agreement.list({size:5,filters:{tenant_id:A.user.id,status:'active'}},signal),S.invoice.list({size:5,filters:{status:'pending'},order:'due_date',asc:true},signal),S.transaction.list({size:5,order:'occurred_at'},signal),S.complaint.list({size:5},signal),S.notification.list({size:5},signal)]);
    Object.assign(data,{agreements:agreements.map(B.mappers.agreement),invoices,transactions,complaints,notifications});
   }
  }
  return data;
 };
 B.workspace=d=>{
  const {role,page}=d,owner=role==='owner',admin=role==='admin';let body='';
  const titles={properties:'Kelola properti',listings:'Listing',rooms:'Manajemen kamar',tenants:'Penghuni & masa sewa',agreements:'Masa sewa',payments:'Tagihan sewa',bills:'Tagihan sewa',recurring:'Tagihan berulang',finance:'Laporan keuangan',transactions:'Transaksi',history:'Riwayat pembayaran',complaints:'Laporan keluhan',boost:'Promosi listing',campaigns:'Promosi listing',analytics:'Analitik listing',activity:'Aktivitas',users:'Pengguna'};
  if(['properties','listings'].includes(page))body=B.table(['Properti','Lokasi','Sewa dasar','Publikasi','Tindakan'],d.rows.map(p=>[e(p.name),e(p.location),m(p.base_rent),B.badge(p.publication_status),owner?`<div class="b-actions">${B.button('Edit','property-form',p.id)}${B.button('Preview','preview',p.id)}${B.button('Hapus','delete-property',p.id)}</div>`:'Baca saja']));
  else if(page==='rooms')body=`${B.form('room-filter',B.input('property','ID properti (opsional)',B.params().get('property')||'')+B.select('status','Status',[['','Semua'],'available','occupied','maintenance','inactive'],B.params().get('status')),'Filter kamar')}${B.table(['Kamar','Properti','Tipe / sewa','Status','Tindakan'],d.rows.filter(r=>!B.params().get('status')||B.params().get('status')===(r.rental_agreements.some(a=>a.status==='active')?'occupied':r.operational_status)).map(r=>[e(r.number),e(r.properties?.name),`${e(r.room_type)}<small>${m(r.rent)}</small>`,B.badge(r.rental_agreements.some(a=>a.status==='active')?'Terisi':r.operational_status),owner?B.button('Edit','room-form',r.id)+B.button('Hapus','delete-room',r.id):'Baca saja']))}`;
  else if(['tenants','agreements'].includes(page))body=`${B.form('local-search',B.input('query','Cari penghuni dalam halaman ini','','search'),'Cari')}<div data-b-search-list>${B.agreementTable(d.rows,owner)}</div>${page==='tenants'?B.panel('Penawaran & persetujuan calon penghuni',d.offerError?`<p role="status">${e(d.offerError)}</p>`:B.offerTable(d.offers,true)):''}`;
  else if(['payments','bills'].includes(page))body=`${B.form('invoice-filter',B.select('status','Status',[['','Semua'],'pending','paid','overdue','cancelled'],B.params().get('status')),'Filter')}${B.invoiceTable(d.rows,owner)}`;
  else if(['transactions','history'].includes(page))body=B.transactionTable(d.rows);
  else if(page==='recurring')body=`<p class="notice">Generator dijalankan manual. Penjadwalan otomatis belum aktif.</p><div class="b-actions">${B.button('Atur jadwal','recurring-form')}${B.button('Buat tagihan bulanan','generate-form')}</div>${B.table(['Agreement','Nominal','Tanggal bayar','Mulai','Periode terakhir','Status'],d.rows.map(r=>[e(r.agreement_id),m(r.amount),e(r.payment_day),dt(r.start_month),dt(r.last_generated_month),B.badge(r.active?'active':'inactive')]))}`;
  else if(page==='complaints')body=`${B.form('complaint-filter',`<div class="b-filters">${B.select('status','Status',[['','Semua'],'waiting','in_progress','awaiting_confirmation','resolved'],B.params().get('status'))}${B.select('category','Kategori',[['','Semua'],...N.categories],B.params().get('category'))}${B.select('priority','Prioritas',[['','Semua'],'low','medium','high','urgent'],B.params().get('priority'))}${B.select('view','Tampilan',[['table','Tabel'],['kanban','Papan status']],B.params().get('view'))}</div>`,'Terapkan')}${B.params().get('view')==='kanban'?`<div class="b-kanban">${['waiting','in_progress','awaiting_confirmation','resolved'].map(status=>`<section><h3>${e(B.labels[status])}</h3>${d.rows.filter(c=>c.status===status).map(c=>`<article class="panel b-panel"><strong>${e(c.title)}</strong><p>${e(c.category)} · ${e(B.labels[c.priority])}</p>${B.button('Rincian','complaint',c.id)}</article>`).join('')}</section>`).join('')}</div>`:B.complaintTable(d.rows)}`;
  else if(['boost','campaigns'].includes(page))body=`<div class="notice">Promosi Rp30.000 untuk 30 hari. Pembelian menunggu integrasi payment gateway; campaign tidak dapat diaktifkan dari browser.</div>${B.table(['Properti','Mulai','Berakhir','Status','Sisa periode'],d.rows.map(c=>{const active=c.start_date<=B.today()&&c.end_date>B.today();return[e(c.properties?.name),dt(c.start_date),dt(c.end_date),B.badge(active?'Aktif':c.start_date>B.today()?'Terjadwal':'Berakhir'),active?`${Math.ceil((Date.parse(c.end_date)-Date.parse(B.today()))/86400000)} hari`:'—'];}))}`;
  else if(page==='analytics')body=B.table(['Properti','Interaksi','Tanggal'],d.rows.map(r=>[e(r.properties?.name),e({view:'Tampilan listing',detail:'Detail kos',contact:'Hubungi pemilik'}[r.kind]),dt(r.event_date)]));
  else if(page==='activity')body=B.activityTable(d.rows);
  else if(page==='users')body=`<p class="notice">Akses pemilik ditinjau dan diberikan melalui prosedur administratif yang terdokumentasi. Tidak tersedia pemberian role atau penggantian password dari halaman ini.</p>${B.table(['Nama','Terdaftar','Role'],d.rows.map(p=>[e(p.display_name),dt(p.created_at),p.user_roles.map(r=>e(r.role)).join(', ')]))}`;
  else if(owner&&(page==='finance'||!page)){
   const r=d.report||{};body=`${B.form('finance-filter',`<div class="b-filters">${B.select('property','Properti',[['','Semua properti'],...d.properties.map(p=>[p.id,p.name])],B.params().get('property'))}${B.input('from','Dari tanggal',B.params().get('from')||'','date')}${B.input('to','Sampai tanggal',B.params().get('to')||'','date')}</div>`,'Terapkan periode')}${B.stats([['Pendapatan sewa',m(r.rent_revenue)],['Belum lunas',m(r.outstanding)],['Terlambat',m(r.overdue)],['Total kamar',r.total_rooms||'0'],['Kamar terisi',r.occupied_rooms||'0'],['Okupansi',`${r.occupancy_rate||0}%`],['Collection rate',`${r.collection_rate||0}%`],['Listing aktif',r.active_listings||'0']])}${B.panel('Pendapatan bulanan',B.chart(d.monthly))}<div class="b-two">${B.panel('Transaksi terbaru',B.transactionTable(d.transactions))}${B.panel('Jatuh tempo terdekat',B.invoiceTable(d.upcoming,true))}</div>${B.panel('Pemeliharaan terbaru',B.complaintTable(d.complaints))}${B.panel('Aktivitas terakhir',B.activityTable(d.activity))}${B.button('Ekspor laporan CSV','export-finance')}<p class="field-help">Ringkasan tanggal dan properti berlaku pada laporan keuangan serta grafik. Daftar aktivitas terbaru mencakup akun pemilik ini. ${d.properties.length===100?'Daftar pilihan dibatasi 100 properti.':''}</p>`;
  }else if(admin&&!page){const r=d.report||{};body=B.stats([['Akun terdaftar',r.registered_accounts||'0'],['Listing aktif',r.active_listings||'0'],['Total kamar',r.total_rooms||'0'],['Kamar terisi',r.occupied_rooms||'0'],['Okupansi',`${r.occupancy_rate||0}%`],['GMV sewa',m(r.gmv)],['Pendapatan admin fee',m(r.admin_fee_revenue)],['Pendapatan promosi',m(r.boost_revenue)],['Pendapatan platform',m(r.total_platform_revenue)],['Keluhan selesai',r.resolved_complaints||'0']])+B.panel('Definisi laporan','<p>GMV adalah nilai sewa berhasil. Pendapatan platform hanya biaya admin dan promosi. Akun terdaftar bukan jumlah pengguna aktif. Role tambahan dapat dimiliki oleh akun yang sama.</p>');}
  else if(!page){body=`${B.panel('Tempat tinggalmu',d.agreements.length?d.agreements.map(a=>`<h2>${e(a.property)} · Kamar ${e(a.room)}</h2><p>${dt(a.start_date)} — ${dt(a.end_date)} · ${m(a.rent)}/bulan · Pembayaran tanggal ${e(a.payment_day)}</p>`).join(''):N.empty('Belum ada masa sewa aktif','Hubungi pengelola melalui listing dan tinjau penawaran sewa pada akunmu.',B.link('Penawaran sewa','offers')))}${B.panel('Tagihan berikutnya',B.invoiceTable(d.invoices))}${B.panel('Pengingat & kabar terbaru',d.notifications.map(n=>`<p>${e(n.title)} · ${e(n.body)}</p>`).join('')||'<p>Belum ada notifikasi.</p>')}${B.panel('Riwayat pembayaran',B.transactionTable(d.transactions))}${B.panel('Laporan terbaru',B.complaintTable(d.complaints))}`;}
  else body=N.empty('Halaman belum tersedia','Gunakan menu yang tersedia untuk mengelola data akunmu.');
  const actions=owner&&['properties','listings'].includes(page)?B.button('Tambah properti','property-form','','primary'):owner&&page==='rooms'?B.button('Tambah kamar','room-form','','primary'):owner&&page==='tenants'?B.button('Buat penawaran sewa','offer-form','','primary'):owner&&page==='payments'?B.button('Buat tagihan','invoice-form','','primary')+B.button('Tagihan massal','bulk-form'):role==='tenant'&&page==='complaints'?B.button('Laporkan kendala','complaint-form','','primary'):'';
  if(owner&&!page&&!d.properties?.length)body=N.empty('Mulai kelola kos pertamamu','Simpan informasi properti, tambahkan kamar, lalu publikasikan saat siap menerima calon penghuni.',B.button('Tambah properti','property-form','','primary'))+body;
  if(d.operations){const o=d.operations;body=B.stats([['Properti',o.properties],['Kamar tersedia',o.available_rooms],['Pendapatan sewa bulan ini',B.money(o.month_rent_revenue)],['Sewa aktif',o.active_agreements],['Keluhan aktif',o.active_complaints],['Promosi aktif',o.active_campaigns],['Pembayaran berhasil',o.successful_payments],['Pembayaran gagal',o.failed_payments],...(admin?[['Pemilik',o.owners],['Penghuni',o.tenants],['Riwayat sewa',o.agreements],['Transaksi tercatat',o.transactions]]:[])])+`<div class="b-distribution-grid">${B.distribution('Okupansi kamar',[['Terisi',d.report?.occupied_rooms||o.active_agreements],['Tersedia',o.available_rooms],['Dalam perbaikan',o.maintenance_rooms]])}${B.distribution('Distribusi upaya pembayaran',[['Berhasil',o.successful_payments],['Gagal',o.failed_payments]])}</div>`+body;}
  return B.shell(role,page,N.heading(role==='admin'?'PLATFORM':owner?'PENGELOLAAN KOS':'RUANG PENGHUNI',titles[page]||`Halo, ${e(A.profile?.display_name||'selamat datang')}.`,'Informasi aktual sesuai hak akses akunmu.',`<div class="b-actions">${actions}${B.button('Muat ulang','refresh')}</div>`)+body+(d.rows?B.pager(d.rows.length):''));
 };
 B.activityTable=rows=>B.table(['Waktu','Aktivitas'],rows.map(a=>[dt(a.created_at),e(a.description)]));
 B.complaintTable=rows=>B.table(['Laporan','Kategori','Prioritas','Status','Estimasi','Tindakan'],rows.map(c=>[e(c.title),e(c.category),B.badge(c.priority),B.badge(c.status),dt(c.estimated_completion),B.button('Rincian','complaint',c.id)]));
 B.offerTable=(rows,owner=false)=>B.table(['Kamar','Masa sewa','Sewa','Jadwal','Status','Tindakan'],rows.map(o=>[e(o.property_name_snapshot || '')+' / '+e(o.room_number_snapshot || o.room_id),`${dt(o.start_date)} — ${dt(o.end_date)}`,m(o.rent),`Tanggal ${e(o.payment_day)}`,B.badge(o.status!=='placed'&&new Date(o.expires_at)<new Date()?'expired':o.status),o.status==='pending'&&!owner?B.button('Tinjau penawaran','review-offer',o.id):o.status==='accepted'&&owner?B.button('Tempatkan penghuni','checkin',o.id,'primary'):'—']));
 B.personalPage=async(route,signal)=>{
  if(route==='favorites'){
   const favorites=await S.favorite.list(signal);const rows=favorites.length?await S.catalogue.list({ids:favorites.map(f=>f.property_id),page:B.page()},signal):[];
   B.favoriteIds=new Set(favorites.map(f=>f.property_id));
   return B.personal('Kos favorit',`<div class="property-grid">${rows.map(p=>B.card(p)+B.button('Hapus favorit','unfavorite',p.id)).join('')||N.empty('Belum ada kos favorit','Simpan pilihan dari katalog untuk membandingkan nanti.')}</div><p class="field-help">Kos yang diarsipkan tidak tampil di katalog favorit.</p>${B.pager(rows.length,12)}`);
  }
  if(route==='searches'){
   const rows=await S.search.list(signal);return B.personal('Pencarian terakhir',B.table(['Pencarian','Tindakan'],rows.map(r=>[B.link(r.query,'marketplace?query='+encodeURIComponent(r.query)),B.button('Hapus','delete-search',r.id)])));
  }
  if(route==='offers'){
   const rows=await S.agreement.offers({page:B.page(),filters:{tenant_id:A.user.id}},signal);B.pageData={offers:rows};return B.personal('Penawaran sewa',B.offerTable(rows)+B.pager(rows.length));
  }
  if(route==='notifications'){
   const rows=await S.notification.list({page:B.page()},signal);B.pageData={notifications:rows};return B.personal('Notifikasi',`<div class="b-actions">${B.button('Tandai semua dibaca','read-all')}${B.button('Periksa pengingat tagihan','generate-reminders')}${B.button('Muat ulang','refresh')}</div><p class="field-help">Pengingat diperiksa saat tombol ditekan. Penjadwalan otomatis belum aktif. Kabar terbaru mengikuti koneksi akun.</p>${rows.map(r=>`<article class="panel b-panel ${r.read_at?'':'b-unread'}"><div class="b-actions"><strong>${e(r.title)}</strong>${r.read_at?'':N.badge('Belum dibaca')}</div><p>${e(r.body)}</p><small>${dt(r.created_at)}</small>${B.button('Buka & tandai dibaca','notification',r.id)}</article>`).join('')||N.empty('Belum ada notifikasi','Kabar tagihan, pesan dan laporan akan tampil di sini.')}${B.pager(rows.length)}`);
  }
  if(route==='compare'){
   const ids=[...new Set((B.params().get('ids')||'').split(',').filter(id=>/^[0-9a-f-]{36}$/.test(id)))].slice(0,3);B.selection=ids;
   const rows=ids.length?await S.catalogue.list({ids},signal):[];
   return B.personal('Bandingkan kos',rows.length?B.table(['Kos','Lokasi','Sewa','Tipe','Kamar tersedia','Fasilitas',''],rows.map(p=>[(window.NP?.photo(p.images?.[0]?.path,p.name,'class="p4-compare-photo"')||'')+e(p.name),e(p.location),m(p.base_rent),e(B.labels[p.gender_policy]),e(p.available_rooms),p.facilities.map(e).join(', '),B.link('Rincian','property/'+p.id)+B.button('Hapus pilihan','uncompare',p.id)])):N.empty('Belum ada pilihan','Pilih hingga tiga kos melalui tombol Bandingkan pada katalog.'));
  }
 };
 B.chatPage=async(signal)=>{
  const list=await S.chat.list(signal),selected=B.params().get('id')||list[0]?.id,conversation=list.find(c=>c.id===selected),messages=conversation?await S.chat.messages(selected,B.page(),signal):[];
  B.pageData={conversations:list,messages,conversation};
  return B.personal('Pesan',`<p class="field-help">Pesan tersimpan di server. Gunakan Muat ulang untuk membaca balasan terbaru; pembaruan realtime dan lampiran menyusul.</p><div class="b-actions">${B.button('Muat ulang','refresh')}${conversation?B.button('Tandai dibaca','read-chat',selected):''}</div><div class="b-chat"><aside>${B.input('chat-search','Cari percakapan','','search','data-b-chat-search')}${list.map(c=>`<a class="b-conversation ${c.id===selected?'active':''}" href="#/chat?id=${e(c.id)}"><strong>${e(c.counterpart_name)}</strong><small>${e(c.last_message||c.property_name)}</small><small>${e(c.property_name)} · ${dt(c.updated_at)}</small>${B.integer(c.unread_count)>0n?N.badge(`${c.unread_count} belum dibaca`):''}</a>`).join('')||N.empty('Belum ada percakapan','Mulai melalui tombol Hubungi pemilik pada detail kos.')}</aside><section>${conversation?`<h2>${e(conversation.property_name)}</h2><div class="b-messages">${messages.slice().reverse().map(msg=>`<article class="b-message ${msg.sender_id===A.user.id?'mine':''}"><p>${e(msg.body)}</p><small>${dt(msg.created_at)} · ${new Date(msg.created_at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'})}</small></article>`).join('')||'<p>Mulai percakapan dengan pengelola.</p>'}</div>${B.pager(messages.length,30)}${B.form('message',B.hidden('conversation_id',selected)+B.textarea('body','Pesan','','required minlength="1" maxlength="1000" rows="3"'),'Kirim pesan')}<div class="b-actions">${B.button('Apakah kamar masih tersedia?','quick-reply','Apakah kamar masih tersedia?')}${B.button('Saya ingin jadwal survei','quick-reply','Saya ingin membuat jadwal survei kos.')}</div>`:N.empty('Pilih percakapan','Riwayat pesan akan tampil di sini.')}</section></div>`);
 };
 B.settingsPage=async(signal)=>{
  const rows=await S.settings.load(signal),r=rows[0]||{};
  const content=B.panel('Sesuaikan pengalamanmu',B.form('settings',`<label class="checkbox-label"><input type="checkbox" name="notifications_enabled" ${r.notifications_enabled?'checked':''}>Tampilkan indikator notifikasi</label><label class="checkbox-label"><input type="checkbox" name="compact_mode" ${r.compact_mode?'checked':''}>Tampilan ringkas</label><label class="checkbox-label"><input type="checkbox" name="sidebar_collapsed" ${r.sidebar_collapsed?'checked':''}>Ringkas sidebar dashboard</label>`));
  const template=document.createElement('template');template.innerHTML=A.workspace('account','preferences');
  template.content.querySelector('#main').innerHTML=N.heading('PENGATURAN AKUN','Preferensi akun','Sesuaikan tampilan dan indikator notifikasi.')+content;
  template.content.querySelectorAll('.sidebar [aria-current]').forEach(el=>el.removeAttribute('aria-current'));
  template.content.querySelector('a[href="#/account/preferences"]')?.setAttribute('aria-current','page');
  return template.innerHTML;
 };
 B.checkoutPage=async(id,signal)=>{
  const rows=await S.invoice.list({filters:{id}},signal),invoice=rows[0];B.pageData={invoice};
  return B.personal('Rincian pembayaran',invoice?B.panel('Tagihan sewa',`<h2>${e(invoice.property_name_snapshot)} · ${e(invoice.room_number_snapshot)}</h2><p>Periode ${dt(invoice.period_start)} · Jatuh tempo ${dt(invoice.due_date)}</p><dl class="b-summary"><dt>Sewa</dt><dd>${m(invoice.amount)}</dd><dt>Biaya administrasi</dt><dd>${m(invoice.admin_fee)}</dd><dt>Total pembayaran</dt><dd>${m(B.integer(invoice.amount)+B.integer(invoice.admin_fee))}</dd></dl>${B.badge(invoice.effective_status)}<div class="notice">Pembayaran online belum tersedia. Payment gateway akan diintegrasikan pada tahap berikutnya. Halaman ini tidak memproses uang atau mengubah tagihan menjadi lunas.</div>${B.button('Cetak tagihan','invoice',invoice.id)}`):N.empty('Tagihan tidak ditemukan','Tagihan tidak tersedia untuk akun ini.'));
 };
 const originalNavbar=A.navbar;
 A.navbar=active=>{
  let html=originalNavbar(active);if(A.user)html=html.replace('<div class="nav-actions">','<div class="nav-actions"><a class="icon-btn" href="#/favorites" aria-label="Kos favorit">'+N.icon('heart')+'</a><a class="icon-btn" href="#/chat" aria-label="Pesan">'+N.icon('chat')+'</a><a class="icon-btn b-notification-bell" href="#/notifications" aria-label="Notifikasi">'+N.icon('bell')+'</a>');return html;
 };
 A.listingCard=B.card;
 const oldHome=A.home;
 A.home=()=>{
  const template=document.createElement('template');template.innerHTML=oldHome();
  template.content.querySelectorAll('.demo-totals,.mini-invoice,.preview-stats,.preview-rows').forEach(node=>node.remove());
  const preview=template.content.querySelector('.preview-app');if(preview)preview.innerHTML='<div class="preview-toolbar"><span>Semua urusan kos, lebih tertata.</span></div><div class="b-panel"><h3>Properti. Sewa. Pemeliharaan.</h3><p>Pengelola memantau kamar, tagihan dan laporan sesuai akses akun. Penghuni melihat perkembangan dari ruang pribadinya.</p><a class="btn btn-outline" href="#/fitur">Jelajahi fitur</a></div>';
  template.content.querySelectorAll('[data-action="popular-search"],[data-action="need-search"]').forEach(node=>{node.dataset.bAction='discovery';node.dataset.id=node.dataset.query||node.dataset.need||node.textContent.trim();node.removeAttribute('data-action');});
  const form=template.content.querySelector('#hero-search');if(form){form.dataset.backendForm='search';const notice=document.createElement('p');notice.className='auth-form-error';notice.setAttribute('role','alert');notice.tabIndex=-1;form.append(notice);}
  return template.innerHTML;
 };
 const oldWorkspace=A.workspace;
 A.workspace=(route,page)=>{
  const template=document.createElement('template');template.innerHTML=oldWorkspace(route,page);
  const logout=template.content.querySelector('.account-logout-menu');if(logout){const link=document.createElement('a');link.href='#/account/preferences';link.innerHTML=N.icon('settings')+'Preferensi';logout.before(link);}
  return template.innerHTML;
 };
 A.fetchListings=async()=>{
  if(A.loadingListings||A.catalogue!==undefined)return;
  const scope=B.scope(),ticket=B.revision,generation=B.catalogueGeneration=(B.catalogueGeneration||0)+1;A.loadingListings=true;
  try{const rows=await B.load('home-catalogue',signal=>S.catalogue.list({},signal));if(scope===B.scope()&&ticket===B.revision)A.catalogue=rows;}
  catch(error){if(error.code!=='STALE'&&scope===B.scope()&&ticket===B.revision&&generation===B.catalogueGeneration){A.catalogueError=B.error(error);A.catalogue=[];}}
  finally{if(generation===B.catalogueGeneration)A.loadingListings=false;if(scope===B.scope()&&ticket===B.revision&&generation===B.catalogueGeneration)N.render();}
 };
 const oldRender=A.render;
 B.renderToken=0;
 B.managed=route=>['marketplace','property','owner','tenant','admin','favorites','searches','compare','offers','chat','notifications','checkout','complaints'].includes(route);
 A.render=()=>{
  const [route,page]=A.route();
  if(A.mode!=='connected'||!A.ready||(!B.managed(route)&&!(route==='account'&&page==='preferences'))){B.renderToken++;const result=oldRender();if(A.mode==='connected'&&A.ready)B.afterRender?.(route,page);return result;}
  let guard=A.guard(route);if(['searches','offers','notifications','complaints'].includes(route)&&!A.user)guard='login';
  if(guard==='login'||guard==='session-expired')return oldRenderGuard(guard);
  if(guard==='access-denied')return oldRenderGuard('access-denied');
  if(route==='complaints'){N.navigate(A.allowed('owner')?'owner/complaints':'tenant/complaints');return true;}
  if(['owner','tenant','admin'].includes(route)&&['settings','profile','notifications','favorites','reports'].includes(page)){N.navigate(({settings:'account/preferences',profile:'account/profile',notifications:'notifications',favorites:'favorites',reports:'owner/finance'})[page]);return true;}
  if(['owner','tenant'].includes(route)&&page==='chat'){N.navigate('chat');return true;}
  if(route==='owner'&&page==='bills'){N.navigate('owner/payments');return true;}
  const key=location.hash,token=++B.renderToken,scope=B.scope(),revision=B.revision;
  const root=document.getElementById('app');if(window.NP?.liveHash!==key)root.innerHTML=`${A.navbar()}<main id="main" class="container section"><div class="connected-loading" role="status">Memuat data terbaru…</div></main>`;
  document.title='Ruangmu · NgekosAja.com';
  B.load('route:'+key,async signal=>{
   if(route==='marketplace'){const d=await B.catalogue(signal);return {html:B.marketplace(d),data:d};}
   if(route==='property')return {html:await B.detail(page,signal)};
   if(['owner','tenant','admin'].includes(route)){const d=await B.loadWorkspace(route,page||'',signal);return {html:B.workspace(d),data:d};}
   if(route==='chat')return {html:await B.chatPage(signal),data:B.pageData};
   if(route==='checkout')return {html:await B.checkoutPage(page,signal),data:B.pageData};
   if(route==='account')return {html:await B.settingsPage(signal)};
   return {html:await B.personalPage(route,signal),data:B.pageData};
  }).then(result=>{
   if(token!==B.renderToken||key!==location.hash||scope!==B.scope()||revision!==B.revision)return;
   if(!window.NP?.liveResult(root,result,route))root.innerHTML=result.html;B.pageData=result.data||{};
   B.afterRender?.(route,page);
  }).catch(error=>{
   if(error.code==='STALE'||token!==B.renderToken||key!==location.hash||scope!==B.scope()||revision!==B.revision)return;
   if(window.NP?.liveHash===key){window.NP.liveHash=null;window.NP.connection('CLOSED');return;}
   root.innerHTML=B.personal('Data belum dapat dimuat',N.empty('Coba lagi sebentar',B.error(error),B.button('Muat ulang','refresh')));
  });
  return true;
 };
 function oldRenderGuard(route){const root=document.getElementById('app');root.innerHTML=route==='access-denied'?A.denied():A.authPage(route);return true;}
})(window.NB,window.NA,window.NK);
