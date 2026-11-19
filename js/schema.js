/* Schema 2 is an additive migration: existing records and financial history survive. */
(function (N) {
  'use strict';
  const legacySeed = N.seed;
  N.VERSION = 2;
  N.locations = ['Tanjung Duren','Grogol','Tomang','Kebon Jeruk','Palmerah','Slipi','Kemanggisan','Jelambar'];
  N.facilities = ['WiFi','AC','Kamar mandi dalam','Furnitur','Dapur bersama','Parkir','Laundry'];
  N.categories = ['AC','Listrik','Air','Internet','Kebersihan','Keamanan','Furnitur','Lainnya'];
  N.priorities = ['Rendah','Sedang','Tinggi','Mendesak'];
  N.ticketStatuses = ['Menunggu','Diproses','Menunggu Konfirmasi','Selesai'];
  N.methods = ['Virtual Account BCA','QRIS','E-Wallet','Transfer Bank Mandiri'];
  N.monthKey = (value = new Date()) => N.dateKey(value).slice(0,7);
  N.validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(new Date(value+'T00:00:00').getTime()) && N.dateKey(value+'T00:00:00') === value;
  N.monthDate = (offset, day=5) => {const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return N.dateKey(d);};
  const owners = [
    {id:'o1',name:'Sari Wulandari',email:'sari@demo.ngekosaja.com',role:'owner',phone:'0812 0000 1001'},
    {id:'o2',name:'Arif Rahman',email:'arif@demo.ngekosaja.com',role:'owner',phone:'0812 0000 1002'},
    {id:'o3',name:'Dewi Anggraini',email:'dewi@demo.ngekosaja.com',role:'owner',phone:'0812 0000 1003'}
  ];
  N.migrate = function (input, fresh=false) {
    const s=JSON.parse(JSON.stringify(input));
    const old=s.version !== 2 || fresh;
    s.owners ||= owners.map(o=>({...o}));
    s.users ||= [{id:'guest',name:'Pengunjung Demo',email:'tamu@demo.ngekosaja.com',role:'guest'},...s.owners,{id:'admin',name:'Tim NgekosAja.com',email:'admin@demo.ngekosaja.com',role:'admin'}];
    s.activeOwnerId ||= 'o1'; s.activeUserId ||= 'guest';
    for(const key of ['agreements','notifications','campaigns','recurring','analytics']) s[key] ||= [];
    for(const key of ['favorites','recentSearches','settings']) s[key] ||= {};
    s.compare ||= [];s.manualReminders ||= [];
    if(old){
      const extra=[['p9','Kos Luma Slipi','Slipi',1450000,'Putri'],['p10','Pondok Akasia','Kemanggisan',1650000,'Campur'],['p11','Kos Rimbun Jelambar','Jelambar',1100000,'Putra'],['p12','Rumah Nala','Palmerah',1800000,'Putri'],['p13','Kos Aruna','Kebon Jeruk',1300000,'Campur'],['p14','Pondok Teras','Jelambar',950000,'Putra'],['p15','Kos Sela','Slipi',2100000,'Campur'],['p16','Rumah Singgah Kemi','Kemanggisan',1550000,'Putri']];
      for(const [id,name,location,price,type] of extra){
        if(s.properties.some(p=>p.id===id))continue;
        const i=Number(id.slice(1));
        s.properties.push({id,name,location,price,type,ownerId:i%3===0?'o1':i%3===1?'o2':'o3',address:`Jl. ${location} Utama No. ${i+4}, Jakarta Barat`,description:`Kos hangat dan fungsional di ${location}. Ada meja belajar, tempat menyimpan barang, serta akses mudah ke tempat makan dan transportasi. Ruang untuk aktivitas sehari-hari, bekerja, dan beristirahat. Informasi area merupakan ilustrasi demo; tanyakan kondisi kamar kepada pengelola.`,size:'3 × 4 m',image:`assets/images/room-${9+(i-9)%4}.jpg`,facilities:i%2?['WiFi','Furnitur','Parkir','Dapur bersama']:['WiFi','AC','Furnitur','Kamar mandi dalam','Dapur bersama'],rooms:Array.from({length:6},(_,r)=>({id:`${id}-r${r+1}`,number:`${String.fromCharCode(65+i%16)}${String(r+1).padStart(2,'0')}`,available:true})),createdAt:N.dateKey()});
      }
    }
    s.properties.forEach((p,i)=>{
      p.ownerId ||= fresh?['o1','o1','o2','o2','o3','o3','o1','o2'][i%8]:'o1';
      p.archived ||= false;
      p.rules ||= ['Saling menghormati jam istirahat pukul 22.00–06.00.','Tamu wajib melapor kepada pengelola.','Dilarang merokok di dalam kamar.','Jaga kebersihan fasilitas bersama.'];
      p.nearby ||= [{name:'Tempat makan & minimarket',distance:'± 5 menit berjalan kaki'},{name:'Transportasi umum',distance:'± 8 menit berjalan kaki'},{name:'Kawasan kampus & perkantoran',distance:'± 10–15 menit berkendara'}];
      if(old && fresh && p.id==='p1')p.image='assets/images/room-2.jpg';
      if(old && fresh && p.id==='p3')p.image='assets/images/room-10.jpg';
      p.photos ||= [p.image,'assets/images/kitchen.jpg','assets/images/bathroom.jpg'];
      p.rooms.forEach(r=>{r.status ||= r.available?'Tersedia':'Tidak aktif';r.type ||= 'Standard';r.price ||= p.price;r.facilities ||= [...p.facilities];r.ownerId=p.ownerId;});
    });
    if(old && fresh){
      const names=['Alya Maharani','Dimas Putra','Fajar Nugroho','Nisa Ramadhani','Kevin Wijaya','Salsa Amelia','Reza Aditya','Vina Anjani','Yoga Prasetyo','Dinda Safitri','Fikri Hakim','Intan Permata','Gilang Saputra','Laras Puspita','Ardi Kurnia','Maya Salsabila','Rafi Firmansyah','Tiara Andini','Wahyu Pradana','Putri Ayuning','Bagas Setiawan','Anisa Fitria','Ilham Akbar','Nabila Zahra','Hafiz Ramadhan','Dhea Anggita','Farhan Yusuf','Zahra Kirana'];
      names.forEach((name,i)=>{const p=s.properties[(i*5)%16],r=p.rooms.find(r=>r.available&&!s.tenants.some(t=>t.roomId===r.id));if(!r)return;s.tenants.push({id:`t${i+6}`,name,email:`penghuni${i+6}@demo.ngekosaja.com`,phone:`08120000${String(i+6).padStart(4,'0')}`,propertyId:p.id,roomId:r.id,joinedAt:N.offsetDate(-90-i)});});
    }
    s.tenants.forEach(t=>{
      const p=s.properties.find(p=>p.id===t.propertyId);
      t.ownerId ||= p?.ownerId;t.leaseStatus ||= 'Aktif';t.endDate ||= N.offsetDate(180);t.rent ||= p?.price||1500000;t.paymentDay ||= 5;
      if(!s.users.some(u=>u.id===t.id))s.users.push({id:t.id,name:t.name,email:t.email,role:'tenant',phone:t.phone});
      if(!s.agreements.some(a=>a.tenantId===t.id))s.agreements.push({id:`lease-${t.id}`,tenantId:t.id,propertyId:t.propertyId,roomId:t.roomId,ownerId:t.ownerId,startDate:t.joinedAt,endDate:t.endDate,rent:t.rent,paymentDay:t.paymentDay,status:t.leaseStatus});
    });
    if(old && fresh){
      s.tenants.filter(t=>Number(t.id.slice(1))>=6).forEach((t,i)=>{
        for(let m=5;m>=0;m--){
          if(m>0 && (i+m)%9===0)continue;
          const due=m===0?N.offsetDate(i%7-2):N.monthDate(-m),paid=m>0||i%3!==0;
          const inv={id:`inv-v2-${m}-${t.id}`,tenantId:t.id,propertyId:t.propertyId,ownerId:t.ownerId,agreementId:`lease-${t.id}`,amount:t.rent,dueDate:due,period:new Date(due+'T12:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'}),status:paid?'Lunas':'Belum lunas',createdAt:N.monthDate(-m,1),notes:''};s.invoices.push(inv);
          if(paid)s.transactions.push({id:`trx-v2-${m}-${t.id}`,kind:'rent',invoiceId:inv.id,tenantId:t.id,propertyId:t.propertyId,ownerId:t.ownerId,amount:t.rent,fee:2000,method:i%2?'QRIS':'Virtual Account BCA',status:'Berhasil',date:m===0?new Date(Date.now()-(i+2)*60000).toISOString():new Date(N.monthDate(-m,3)+'T10:30:00').toISOString()});
        }
      });
      s.complaints.push({id:'c4',tenantId:'t5',propertyId:'p3',title:'WiFi sering terputus',description:'Koneksi WiFi kamar terputus saat belajar daring sejak kemarin sore.',category:'Internet',priority:'Sedang',status:'Menunggu',createdAt:N.offsetDate(-1),updatedAt:N.dateKey(),photo:''});
    }
    for(const group of ['invoices','transactions','complaints','conversations'])s[group].forEach(item=>{item.ownerId ||= s.properties.find(p=>p.id===item.propertyId)?.ownerId||'o1';});
    s.invoices.forEach(i=>{i.notes ||= '';i.agreementId ||= `lease-${i.tenantId}`;});
    s.complaints.forEach(c=>{
      c.priority ||= 'Sedang';c.urgency ||= c.priority;c.roomId ||= s.tenants.find(t=>t.id===c.tenantId)?.roomId;
      if(c.category==='AC & listrik')c.category=/lampu|listrik/i.test(c.title)?'Listrik':'AC';
      if(c.category==='Air & sanitasi')c.category='Air';
      if(c.status==='Selesai'&&!c.confirmed)c.status='Menunggu Konfirmasi';
      c.history ||= [{id:`event-${c.id}`,status:c.status,note:'Laporan tercatat pada sistem.',actorId:c.tenantId,date:c.createdAt+'T09:00:00'}];c.notes ||= [];c.eta ||= '';
    });
    s.conversations.forEach(c=>{c.readBy ||= {};c.messages.forEach(m=>{if(m.sender==='owner')m.sender=c.ownerId;});});
    s.activities.forEach(a=>{a.ownerId ||= 'o1';});
    s.properties.filter(p=>p.boostUntil).forEach(p=>{if(!s.campaigns.some(c=>c.propertyId===p.id&&c.endDate===p.boostUntil))s.campaigns.push({id:`campaign-${p.id}`,propertyId:p.id,ownerId:p.ownerId,startDate:p.createdAt||N.dateKey(),endDate:p.boostUntil,source:'demo awal'});});
    s.activeTenantId ||= s.tenants[0]?.id||'';s.role ||= 'guest';s.version=2;
    return s;
  };
  N.seed = () => {const s=legacySeed();s.version=1;return N.migrate(s,true);};
})(window.NK);
