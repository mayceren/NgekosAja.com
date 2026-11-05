/* Classic scripts deliberately support file:// without modules or a build step. */
window.NK = window.NK || {};
(function (N) {
  'use strict';
  N.VERSION = 1;
  N.dateKey = function (value = new Date()) {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  N.offsetDate = function (days, value = new Date()) { const d = new Date(value); d.setDate(d.getDate() + days); return N.dateKey(d); };
  N.id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  N.facilities = ['WiFi', 'AC', 'Kamar mandi dalam', 'Parkir', 'Dapur bersama', 'Laundry'];
  N.seed = function () {
    const specs = [
      ['p1', 'Kos Senja Residence', 'Tanjung Duren', 1850000, 'Campur', 8, ['WiFi', 'AC', 'Kamar mandi dalam', 'Parkir', 'Dapur bersama']],
      ['p2', 'Ruang Teduh Grogol', 'Grogol', 1500000, 'Putri', 7, ['WiFi', 'AC', 'Kamar mandi dalam', 'Laundry']],
      ['p3', 'Kos Botanica', 'Tomang', 2200000, 'Campur', 6, ['WiFi', 'AC', 'Kamar mandi dalam', 'Parkir', 'Laundry']],
      ['p4', 'Paviliun Kebon Jeruk', 'Kebon Jeruk', 1350000, 'Putra', 8, ['WiFi', 'Parkir', 'Dapur bersama']],
      ['p5', 'Kos Nara Living', 'Palmerah', 1750000, 'Putri', 6, ['WiFi', 'AC', 'Kamar mandi dalam', 'Dapur bersama']],
      ['p6', 'Duren House', 'Tanjung Duren', 1250000, 'Putra', 6, ['WiFi', 'Parkir', 'Dapur bersama']],
      ['p7', 'Kos Sora', 'Grogol', 1950000, 'Campur', 6, ['WiFi', 'AC', 'Kamar mandi dalam', 'Laundry']],
      ['p8', 'Tomang Urban Stay', 'Tomang', 2500000, 'Campur', 6, ['WiFi', 'AC', 'Kamar mandi dalam', 'Parkir', 'Laundry']]
    ];
    const properties = specs.map((s, i) => ({id:s[0], name:s[1], location:s[2], price:s[3], type:s[4], facilities:s[6], image:`assets/images/room-${i + 1}.jpg`, address:`Jl. ${s[2]} Raya No. ${12 + i * 3}, Jakarta Barat`, description:`Ruang nyaman untuk hari-hari produktifmu di ${s[2]}. Kamar terang dengan furnitur lengkap, tempat tidur, lemari, dan meja belajar. Dekat transportasi umum, tempat makan, serta kawasan kampus. Harga bulanan sudah termasuk WiFi; listrik mengikuti pemakaian. Survei kamar dapat dijadwalkan melalui chat pengelola.`, size: i % 2 ? '3 × 4 m' : '4 × 4 m', rooms:Array.from({length:s[5]}, (_, r) => ({id:`${s[0]}-r${r + 1}`, number:`${String.fromCharCode(65 + i)}${String(r + 1).padStart(2, '0')}`, available:true})), boostUntil:i === 0 ? N.offsetDate(20) : null, createdAt:N.dateKey()}));
    const tenants = ['Andi Pratama', 'Nadia Putri', 'Rizky Maulana', 'Citra Lestari', 'Bima Saputra'].map((name, i) => ({id:`t${i + 1}`, name, email:`${name.split(' ')[0].toLowerCase()}@example.com`, phone:`08123456000${i + 1}`, propertyId: i < 3 ? 'p1' : `p${i - 1}`, roomId: i < 3 ? `p1-r${i + 1}` : `p${i - 1}-r1`, joinedAt:N.offsetDate(-120)}));
    properties[7].rooms.forEach(r => { r.available = false; });
    const invoices = [], transactions = [];
    for (let month = 5; month >= 0; month--) {
      tenants.forEach((t, i) => {
        const p = properties.find(p => p.id === t.propertyId);
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - month); d.setDate(5);
        const inv = {id:`inv-${month}-${i}`, tenantId:t.id, propertyId:p.id, amount:p.price, dueDate:month === 0 ? N.offsetDate(i === 0 ? 2 : i === 1 ? -2 : i + 3) : N.dateKey(d), period:d.toLocaleDateString('id-ID', {month:'long', year:'numeric'}), status:month > 0 || i === 3 ? 'Lunas' : 'Belum lunas', createdAt:N.dateKey(d)};
        invoices.push(inv);
        if (inv.status === 'Lunas') transactions.push({id:`trx-${month}-${i}`, invoiceId:inv.id, tenantId:t.id, propertyId:p.id, kind:'rent', amount:p.price, fee:2000, method:'Virtual Account BCA', status:'Berhasil', date:month === 0 ? new Date(Date.now() - 3600000).toISOString() : new Date(d.getFullYear(), d.getMonth(), 3, 10, 15 + i).toISOString()});
      });
    }
    const complaints = [
      {id:'c1', tenantId:'t1', propertyId:'p1', title:'AC tidak dingin', category:'AC & listrik', description:'AC kamar A01 sudah menyala tetapi udara tidak dingin sejak semalam. Mohon dibantu pengecekan.', status:'Diproses', createdAt:N.offsetDate(-2), updatedAt:N.offsetDate(-1), photo:'', confirmed:false},
      {id:'c2', tenantId:'t2', propertyId:'p1', title:'Keran air bocor', category:'Air & sanitasi', description:'Keran wastafel terus menetes meskipun sudah ditutup rapat.', status:'Menunggu', createdAt:N.offsetDate(-1), updatedAt:N.offsetDate(-1), photo:'', confirmed:false},
      {id:'c3', tenantId:'t1', propertyId:'p1', title:'Lampu kamar rusak', category:'AC & listrik', description:'Lampu utama kamar berkedip. Lampu telah diganti oleh teknisi.', status:'Selesai', createdAt:N.offsetDate(-8), updatedAt:N.offsetDate(-5), photo:'', confirmed:false}
    ];
    return {version:N.VERSION, role:'guest', activeTenantId:'t1', properties, tenants, invoices, transactions, complaints, conversations:[{id:'chat-t1-p1', participantId:'t1', propertyId:'p1', messages:[{id:'m1', sender:'owner', text:'Halo Andi, selamat datang di Kos Senja! Jika ada kebutuhan terkait kamar, kabari Ibu di sini ya.', date:new Date(Date.now() - 86400000).toISOString()}, {id:'m2', sender:'t1', text:'Baik Bu, terima kasih. Saya sudah membuat laporan untuk AC kamar saya.', date:new Date(Date.now() - 82000000).toISOString()}, {id:'m3', sender:'owner', text:'Laporannya sudah Ibu terima. Teknisi dijadwalkan datang besok pukul 10.00.', date:new Date(Date.now() - 80000000).toISOString()}]}], activities:[{id:'a1', text:'Teknisi ditugaskan untuk laporan AC kamar A01.', date:new Date().toISOString()}, {id:'a2', text:'Promosi Kos Senja Residence sedang aktif.', date:new Date().toISOString()}], demoReminder:false};
  };
})(window.NK);
