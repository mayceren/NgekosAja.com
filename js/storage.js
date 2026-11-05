(function (N) {
  'use strict';
  const KEY = 'ngekosaja.demo.v1';
  let state;
  N.storageWarning = '';
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    state = saved && saved.version === N.VERSION && ['properties','tenants','invoices','transactions','complaints','conversations','activities'].every(k => Array.isArray(saved[k])) ? saved : N.seed();
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (_) { state = N.seed(); N.storageWarning = 'Penyimpanan browser tidak tersedia. Data hanya tersimpan selama halaman ini terbuka.'; }
  N.state = () => state;
  N.update = function (mutation) {
    const next = JSON.parse(JSON.stringify(state));
    const result = mutation(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {
      if (!N.storageWarning) throw new Error('Penyimpanan penuh. Hapus foto besar atau reset data demo, lalu coba lagi.');
    }
    state = next;
    return result;
  };
  N.reset = () => { const next = N.seed(); try {localStorage.setItem(KEY, JSON.stringify(next));} catch (_) {} state = next; };
  N.activeTenant = () => state.tenants.find(t => t.id === state.activeTenantId);
  N.property = id => state.properties.find(p => p.id === id);
  N.tenant = id => state.tenants.find(t => t.id === id);
  N.room = (propertyId, roomId) => N.property(propertyId)?.rooms.find(r => r.id === roomId);
  N.occupants = propertyId => state.tenants.filter(t => t.propertyId === propertyId);
  N.availableRooms = p => p.rooms.filter(r => r.available && !state.tenants.some(t => t.roomId === r.id));
  N.isBoosted = p => !!p.boostUntil && p.boostUntil >= N.dateKey();
  N.requireRole = role => { if (state.role !== role) throw new Error('Ganti peran demo untuk menggunakan fitur ini.'); };
  N.log = (s, text) => { s.activities.unshift({id:N.id('act'), text, date:new Date().toISOString()}); s.activities = s.activities.slice(0, 40); };
  N.setRole = (role, tenantId) => {
    if (!['guest','tenant','owner'].includes(role)) throw new Error('Peran tidak valid.');
    if (role === 'tenant' && !state.tenants.some(t => t.id === tenantId)) throw new Error('Pilih penghuni yang tersedia.');
    N.update(s => {s.role = role; if (tenantId) s.activeTenantId = tenantId; s.demoReminder = false;});
  };
  N.daysUntil = date => Math.round((new Date(date + 'T00:00:00') - new Date(N.dateKey() + 'T00:00:00')) / 86400000);
  N.reminders = () => state.invoices.filter(i => i.tenantId === state.activeTenantId && i.status !== 'Lunas' && (N.daysUntil(i.dueDate) <= 3 || (state.manualReminders || []).includes(i.id)));
  N.payInvoice = (invoiceId, method, success) => {
    N.requireRole('tenant');
    const inv = state.invoices.find(i => i.id === invoiceId && i.tenantId === state.activeTenantId);
    if (!inv || inv.status === 'Lunas') throw new Error('Tagihan tidak tersedia atau sudah lunas.');
    if (!['Virtual Account BCA','QRIS','Transfer Bank Mandiri'].includes(method)) throw new Error('Pilih metode pembayaran.');
    return N.update(s => {
      const tx = {id:N.id('trx'), kind:'rent', invoiceId:inv.id, tenantId:inv.tenantId, propertyId:inv.propertyId, amount:inv.amount, fee:2000, method, status:success ? 'Berhasil' : 'Gagal', date:new Date().toISOString()};
      s.transactions.unshift(tx);
      if (success) {s.invoices.find(i => i.id === inv.id).status = 'Lunas'; s.demoReminder = false; N.log(s, `${N.tenant(inv.tenantId).name} membayar sewa ${inv.period}.`);}
      return tx;
    });
  };
  N.saveInvoice = form => {
    N.requireRole('owner');
    const tenant = N.tenant(form.tenantId), amount = Number(form.amount);
    if (!tenant || !Number.isFinite(amount) || amount < 10000 || amount > 100000000 || !/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate) || !form.period.trim()) throw new Error('Lengkapi data tagihan dengan benar.');
    if (state.invoices.some(i => i.tenantId === tenant.id && i.period.toLowerCase() === form.period.trim().toLowerCase())) throw new Error('Tagihan periode ini untuk penghuni tersebut sudah ada.');
    N.update(s => {s.invoices.unshift({id:N.id('inv'), tenantId:tenant.id, propertyId:tenant.propertyId, amount, dueDate:form.dueDate, period:form.period.trim(), status:'Belum lunas', createdAt:N.dateKey()}); N.log(s, `Tagihan baru untuk ${tenant.name} dibuat.`);});
  };
  N.saveProperty = (form, id) => {
    N.requireRole('owner');
    const price = Number(form.price), total = Number(form.total);
    if (!form.name.trim() || !form.location.trim() || !form.address.trim() || !form.description.trim() || !Number.isFinite(price) || price < 100000 || price > 100000000 || !Number.isInteger(total) || total < 1 || total > 100) throw new Error('Periksa isian properti, harga, dan jumlah kamar.');
    const old = id && N.property(id);
    if (id && !old) throw new Error('Properti tidak ditemukan.');
    if (old && old.rooms.slice(total).some(r => state.tenants.some(t => t.roomId === r.id))) throw new Error('Kamar yang akan dihapus masih ditempati. Pindahkan penghuni terlebih dahulu.');
    N.update(s => {
      const pid = id || N.id('prop');
      const rooms = Array.from({length:total}, (_, i) => old?.rooms[i] || {id:`${pid}-r${i + 1}`, number:`K${String(i + 1).padStart(2,'0')}`, available:true});
      const data = {id:pid, name:form.name.trim(), location:form.location.trim(), address:form.address.trim(), description:form.description.trim(), type:form.type, price, size:form.size.trim() || '3 × 4 m', facilities:form.facilities.filter(f => N.facilities.includes(f)), image:old?.image || 'assets/images/room-4.jpg', rooms, boostUntil:old?.boostUntil || null, createdAt:old?.createdAt || N.dateKey()};
      if (old) s.properties[s.properties.findIndex(p => p.id === id)] = data; else s.properties.push(data);
      N.log(s, `Properti ${data.name} ${old ? 'diperbarui' : 'ditambahkan'}.`);
    });
  };
  N.deleteProperty = id => {
    N.requireRole('owner');
    if (!N.property(id)) throw new Error('Properti tidak ditemukan.');
    if (state.tenants.some(t => t.propertyId === id) || state.invoices.some(i => i.propertyId === id) || state.transactions.some(t => t.propertyId === id) || state.complaints.some(c => c.propertyId === id)) throw new Error('Properti memiliki penghuni atau riwayat tagihan, transaksi, atau laporan. Riwayat tersebut dipertahankan; Anda dapat mengedit properti dan ketersediaan kamarnya.');
    N.update(s => {s.properties = s.properties.filter(p => p.id !== id); s.conversations = s.conversations.filter(c => c.propertyId !== id); s.complaints = s.complaints.filter(c => c.propertyId !== id); N.log(s, 'Properti yang tidak aktif dihapus.');});
  };
  N.toggleRoom = (propertyId, roomId) => {
    N.requireRole('owner');
    if (state.tenants.some(t => t.roomId === roomId)) throw new Error('Kamar masih ditempati penghuni.');
    N.update(s => {const r = s.properties.find(p => p.id === propertyId)?.rooms.find(r => r.id === roomId); if (!r) throw new Error('Kamar tidak ditemukan.'); r.available = !r.available;});
  };
  N.saveTenant = (form, id) => {
    N.requireRole('owner');
    const p = N.property(form.propertyId);
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || !/^[+\d\s-]{8,18}$/.test(form.phone) || !p) throw new Error('Lengkapi nama, email, nomor telepon, dan kamar.');
    const room = p.rooms.find(r => r.id === form.roomId);
    if (!room?.available || state.tenants.some(t => t.roomId === room.id && t.id !== id)) throw new Error('Kamar tidak tersedia.');
    N.update(s => {
      const old = s.tenants.find(t => t.id === id);
      const data = {id:id || N.id('tenant'), name:form.name.trim(), email:form.email.trim(), phone:form.phone.trim(), propertyId:p.id, roomId:room.id, joinedAt:old?.joinedAt || N.dateKey()};
      if (old) s.tenants[s.tenants.findIndex(t => t.id === id)] = data; else s.tenants.push(data);
      N.log(s, `Data penghuni ${data.name} disimpan.`);
    });
  };
  N.deleteTenant = id => {
    N.requireRole('owner');
    if (state.invoices.some(i => i.tenantId === id) || state.complaints.some(c => c.tenantId === id) || state.conversations.some(c => c.participantId === id)) throw new Error('Penghuni memiliki riwayat tagihan, keluhan, atau percakapan. Riwayat tersebut perlu dipertahankan; Anda dapat mengedit data dan kamarnya.');
    N.update(s => {s.tenants = s.tenants.filter(t => t.id !== id); if (s.activeTenantId === id) s.activeTenantId = s.tenants[0]?.id || '';});
  };
  N.boost = (propertyId, success) => {
    N.requireRole('owner');
    const p = N.property(propertyId);
    if (!p || N.isBoosted(p)) throw new Error('Properti tidak tersedia atau promosi masih aktif.');
    N.update(s => {s.transactions.unshift({id:N.id('boost'), kind:'boost', propertyId, amount:30000, fee:0, status:success ? 'Berhasil' : 'Gagal', method:'Saldo demo', date:new Date().toISOString()}); if (success) {s.properties.find(p => p.id === propertyId).boostUntil = N.offsetDate(30); N.log(s, `Promosi ${p.name} diaktifkan selama 30 hari.`);}});
  };
  N.addComplaint = form => {
    N.requireRole('tenant');
    const t = N.activeTenant();
    if (!t || form.title.trim().length < 5 || form.description.trim().length < 10) throw new Error('Judul minimal 5 karakter dan deskripsi minimal 10 karakter.');
    if (form.photo && (!/^data:image\/(png|jpeg|webp);base64,/.test(form.photo) || form.photo.length > 1500000)) throw new Error('Foto harus JPG, PNG, atau WebP maksimal 1 MB.');
    N.update(s => {s.complaints.unshift({id:N.id('report'), tenantId:t.id, propertyId:t.propertyId, title:form.title.trim(), category:form.category, description:form.description.trim(), photo:form.photo || '', status:'Menunggu', createdAt:N.dateKey(), updatedAt:N.dateKey(), confirmed:false}); N.log(s, `${t.name} mengirim laporan ${form.title.trim()}.`);});
  };
  N.updateComplaint = (id, status) => {
    N.requireRole('owner');
    if (!['Menunggu','Diproses','Selesai'].includes(status)) throw new Error('Status tidak valid.');
    N.update(s => {const c = s.complaints.find(c => c.id === id); if (!c) throw new Error('Laporan tidak ditemukan.'); c.status = status; c.confirmed = false; c.updatedAt = N.dateKey(); N.log(s, `Laporan ${c.title}: ${status.toLowerCase()}.`);});
  };
  N.confirmComplaint = id => {
    N.requireRole('tenant');
    N.update(s => {const c = s.complaints.find(c => c.id === id && c.tenantId === s.activeTenantId); if (!c || c.status !== 'Selesai') throw new Error('Laporan belum diselesaikan.'); c.confirmed = true; c.updatedAt = N.dateKey();});
  };
  N.contact = propertyId => {
    if (!N.property(propertyId)) throw new Error('Properti tidak ditemukan.');
    const participantId = state.role === 'tenant' ? state.activeTenantId : 'guest';
    let conversation = state.conversations.find(c => c.propertyId === propertyId && c.participantId === participantId);
    if (!conversation) conversation = N.update(s => {const c = {id:N.id('chat'), propertyId, participantId, messages:[{id:N.id('msg'), sender:'owner', text:`Halo! Ada yang ingin ditanyakan tentang ${N.property(propertyId).name}? Silakan kirim pesan di sini.`, date:new Date().toISOString()}]}; s.conversations.push(c); return c;});
    return conversation.id;
  };
  N.sendMessage = (id, text) => {
    const message = text.trim();
    if (!message || message.length > 1000) throw new Error('Pesan harus berisi 1–1.000 karakter.');
    N.update(s => {const c = s.conversations.find(c => c.id === id); const who = s.role === 'tenant' ? s.activeTenantId : 'guest'; if (!c || (s.role !== 'owner' && c.participantId !== who)) throw new Error('Percakapan tidak tersedia.'); c.messages.push({id:N.id('msg'), sender:s.role === 'owner' ? 'owner' : who, text:message, date:new Date().toISOString()});});
  };
})(window.NK);
