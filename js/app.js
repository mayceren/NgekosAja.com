(function (N) {
  'use strict';
  const app = document.getElementById('app');
  N.route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/');
  N.render = () => {
    let [route, page, id] = N.route();
    const s = N.state();
    if ((route === 'owner' || route === 'tenant') && s.role !== route) {
      location.hash = s.role === 'guest' ? '#/' : `#/${s.role}`;
      N.toast('Halaman disesuaikan dengan peran demo aktif.'); return;
    }
    let content;
    if (route === 'owner') {
      const views = {'':N.ownerDashboard, properties:N.ownerProperties, tenants:N.ownerTenants, payments:N.ownerPayments, complaints:N.complaintsPage, chat:N.chatPage, boost:N.ownerBoost};
      content = N.dashboardShell(page || '', (views[page || ''] || (() => N.empty('Halaman tidak ditemukan','Gunakan menu di samping untuk melanjutkan.')))());
    } else if (route === 'tenant') {
      const views = {'':N.tenantDashboard, bills:N.tenantBills, history:N.tenantHistory, complaints:N.complaintsPage, chat:N.chatPage};
      content = N.dashboardShell(page || '', (views[page || ''] || (() => N.empty('Halaman tidak ditemukan','Gunakan menu di samping untuk melanjutkan.')))());
    } else if (route === 'marketplace') content = N.marketplace();
    else if (route === 'property') content = N.propertyDetail(page);
    else if (route === 'fitur' || route === 'tentang') content = N.infoPage(route === 'tentang');
    else if (route === 'chat') content = `${N.navbar()}<main class="container section guest-chat" id="main" tabindex="-1"><div class="active-role-label">Peran aktif: ${N.roleName()}</div>${N.chatPage()}</main>${N.footer()}`;
    else if (!route) content = N.home();
    else content = `${N.navbar()}<main id="main" class="container section">${N.empty('Halaman tidak ditemukan','Kembali ke beranda untuk mulai menjelajahi.','<a class="btn btn-primary" href="#/">Ke Beranda</a>')}</main>${N.footer()}`;
    app.innerHTML = content;
    N.renderResults();
    const messages = document.getElementById('chat-messages'); if (messages) messages.scrollTop = messages.scrollHeight;
    const titles = {owner:'Workspace Pemilik',tenant:'Dashboard Penghuni',marketplace:'Cari Kos',property:N.property(page)?.name,chat:'Pesan',fitur:'Fitur',tentang:'Tentang'};
    document.title = `${titles[route] || 'Cari Kos Nyaman'} · NgekosAja.com`;
  };
  const refresh = message => { N.closeModal(); N.render(); if (message) N.toast(message); };
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-action]');
    if (!el) {if (event.target.classList.contains('modal-overlay')) N.closeModal(); return;}
    const action = el.dataset.action, id = el.dataset.id;
    try {
      switch (action) {
        case 'roles': N.roleModal(); break;
        case 'role': {
          const role = el.dataset.role, tenantId = document.getElementById('demo-tenant')?.value;
          N.setRole(role, role === 'tenant' ? tenantId : null);
          N.closeModal(); const next = role === 'guest' ? '#/marketplace' : `#/${role}`;
          if (location.hash === next) N.render(); else location.hash = next;
          N.toast(`Mode ${N.roleName()} aktif.`); break;
        }
        case 'close-modal': case 'close-on-nav': N.closeModal(); break;
        case 'menu': {const open = document.querySelector('.public-nav').classList.toggle('open'); el.setAttribute('aria-expanded',open); break;}
        case 'sidebar': {const open = document.querySelector('.sidebar').classList.toggle('open'); el.setAttribute('aria-expanded',open); break;}
        case 'reset': N.confirm('Mulai ulang data demo?', 'Semua perubahan, foto laporan, dan pesan lokal akan dihapus. Delapan properti dan data contoh akan dibuat kembali dengan tanggal yang relevan hari ini.', 'reset-confirm'); break;
        case 'reset-confirm': N.reset(); N.selectedConversation = ''; N.marketplaceFilters = {query:'',min:'',max:'',facility:'',availability:'all',type:'all',sort:'recommended'}; N.paymentFilter = 'all'; N.complaintFilter = 'all'; N.closeModal(); location.hash = '#/'; N.render(); N.toast('Data demo berhasil direset.'); break;
        case 'reset-filters': N.marketplaceFilters = {query:'',min:'',max:'',facility:'',availability:'all',type:'all',sort:'recommended'}; N.render(); break;
        case 'gallery': {const img = document.getElementById('gallery-main'); img.src = el.dataset.src; img.alt = el.dataset.alt; break;}
        case 'contact': N.selectedConversation = N.contact(id); location.hash = N.state().role === 'guest' ? '#/chat' : `#/${N.state().role}/chat`; break;
        case 'select-chat': N.selectedConversation = id; N.render(); break;
        case 'add-property': N.requireRole('owner'); N.propertyForm(); break;
        case 'edit-property': N.requireRole('owner'); N.propertyForm(id); break;
        case 'delete-property': N.requireRole('owner'); N.confirm('Hapus properti?', `Hapus ${N.property(id)?.name}? Properti dengan penghuni, tagihan, transaksi, atau laporan akan dipertahankan.`, 'delete-property-confirm', id); break;
        case 'delete-property-confirm': N.deleteProperty(id); refresh('Properti dihapus dari marketplace.'); break;
        case 'rooms': N.requireRole('owner'); N.roomsModal(id); break;
        case 'toggle-room': N.toggleRoom(el.dataset.property,id); N.render(); N.roomsModal(el.dataset.property); N.toast('Ketersediaan kamar diperbarui.'); break;
        case 'add-tenant': N.requireRole('owner'); N.tenantForm(); break;
        case 'edit-tenant': N.requireRole('owner'); N.tenantForm(id); break;
        case 'delete-tenant': N.requireRole('owner'); N.confirm('Hapus data penghuni?', 'Data penghuni tanpa riwayat dapat dihapus. Penghuni dengan tagihan, laporan, atau pesan akan dipertahankan agar riwayat tetap utuh.', 'delete-tenant-confirm', id); break;
        case 'delete-tenant-confirm': N.deleteTenant(id); refresh('Data penghuni dihapus dan kamar tersedia kembali.'); break;
        case 'add-invoice': N.requireRole('owner'); N.invoiceForm(); break;
        case 'remind-tenant': {
          N.requireRole('owner'); N.update(s => {s.manualReminders = [...new Set([...(s.manualReminders || []),id])]; N.log(s, `Pengingat demo tagihan ${id} dikirim ke dashboard penghuni.`);}); N.render(); N.toast('Pengingat ditambahkan ke notifikasi penghuni terkait.'); break;
        }
        case 'pay': N.paymentModal(id); break;
        case 'receipt': N.receiptModal(id); break;
        case 'simulate-reminder': N.requireRole('tenant'); N.update(s => {s.demoReminder = true;}); N.render(); N.toast('Contoh reminder H-3 ditampilkan. Tanggal dan nominal tagihan tetap sama.'); break;
        case 'notifications': N.notifications(); break;
        case 'add-complaint': N.requireRole('tenant'); N.complaintForm(); break;
        case 'filter-complaints': N.complaintFilter = el.dataset.status; N.render(); break;
        case 'confirm-complaint': N.confirmComplaint(id); refresh('Penyelesaian laporan sudah dikonfirmasi.'); break;
        case 'view-photo': {const c = N.state().complaints.find(c => c.id === id && (N.state().role === 'owner' || c.tenantId === N.state().activeTenantId)); if (c?.photo) N.modal('Lampiran laporan', `<img class="report-full-photo" src="${c.photo}" alt="${N.e(c.title)}">`); break;}
        case 'boost': N.requireRole('owner'); N.boostModal(id); break;
        case 'boost-success': N.boost(id,true); refresh('Promosi aktif selama 30 hari. Listing kini mendapat prioritas pencarian.'); break;
        case 'boost-fail': N.boost(id,false); refresh(); N.toast('Simulasi pembayaran gagal. Promosi belum diaktifkan.',true); break;
      }
    } catch (error) { N.toast(error.message,true); }
  });
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!form.matches('form')) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errorEl = form.querySelector('.form-error'); if (errorEl) errorEl.textContent = '';
    const submitter = event.submitter; if (submitter) submitter.disabled = true;
    try {
      switch (form.id) {
        case 'hero-search': N.marketplaceFilters.query = data.query.trim(); location.hash = '#/marketplace'; break;
        case 'filter-form': {
          if (data.min && data.max && Number(data.min) > Number(data.max)) throw new Error('Harga minimum tidak boleh melebihi harga maksimum.');
          N.marketplaceFilters = {...N.marketplaceFilters,query:data.query,min:data.min,max:data.max,facility:data.facility,type:data.type,availability:data.available ? 'available' : 'all'}; N.renderResults(); break;
        }
        case 'property-form': N.saveProperty({...data, facilities:new FormData(form).getAll('facilities')}, form.dataset.id || null); refresh('Informasi properti dan marketplace diperbarui.'); break;
        case 'tenant-form': N.saveTenant(data,form.dataset.id || null); refresh('Data penghuni dan ketersediaan kamar diperbarui.'); break;
        case 'invoice-form': N.saveInvoice(data); refresh('Tagihan berhasil dibuat dan tersedia untuk penghuni.'); break;
        case 'payment-form': {const tx = N.payInvoice(form.dataset.id,data.method,submitter?.value === 'success'); N.closeModal(); N.render(); N.paymentResult(tx); break;}
        case 'complaint-form': {
          const file = form.querySelector('[name=photo]').files[0]; let photo = '';
          if (file) {
            if (file.size > 1048576 || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Gunakan foto JPG, PNG, atau WebP maksimal 1 MB.');
            photo = await new Promise((resolve,reject) => {const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Foto gagal dibaca.')); reader.readAsDataURL(file);});
          }
          N.addComplaint({...data,photo}); refresh('Laporan terkirim. Pengelola dapat melihatnya di dashboard.'); break;
        }
        case 'chat-form': N.sendMessage(form.dataset.id,data.message); N.render(); document.getElementById('message-input')?.focus(); break;
      }
    } catch (error) {if (errorEl) errorEl.textContent = error.message; else N.toast(error.message,true);}
    finally {if (submitter?.isConnected) submitter.disabled = false;}
  });
  document.addEventListener('change', event => {
    const el = event.target;
    try {
      if (el.id === 'sort-properties') {N.marketplaceFilters.sort = el.value; N.renderResults();}
      if (el.id === 'tenant-property') N.fillTenantRooms(el.closest('form').dataset.id);
      if (el.id === 'invoice-tenant') document.getElementById('invoice-amount').value = N.property(N.tenant(el.value)?.propertyId)?.price || 0;
      if (el.id === 'payment-filter') {N.paymentFilter = el.value; N.render();}
      if (el.dataset.complaintId) {N.updateComplaint(el.dataset.complaintId,el.value); N.render(); N.toast('Status laporan diperbarui untuk penghuni.');}
      if (el.matches('#complaint-form [name=photo]')) {
        const file = el.files[0], preview = document.getElementById('photo-preview'); preview.innerHTML = '';
        if (file) {
          if (file.size > 1048576 || !['image/jpeg','image/png','image/webp'].includes(file.type)) {el.value = ''; throw new Error('Gunakan JPG, PNG, atau WebP maksimal 1 MB.');}
          const reader = new FileReader(); reader.onload = () => {if (preview.isConnected) preview.innerHTML = `<img class="upload-preview" src="${reader.result}" alt="Pratinjau foto laporan">`;}; reader.readAsDataURL(file);
        }
      }
    } catch (error) {N.toast(error.message,true);}
  });
  // Lightweight live search; advanced filter values are applied together on submit.
  let searchTimer;
  document.addEventListener('input', event => {
    if (event.target.matches('#filter-form [name=query]')) {
      clearTimeout(searchTimer); const query = event.target.value;
      searchTimer = setTimeout(() => {N.marketplaceFilters.query = query; N.renderResults();},160);
    }
  });
  document.addEventListener('keydown', event => {
    const modal = document.querySelector('.modal'); if (!modal) return;
    if (event.key === 'Escape') {N.closeModal(); return;}
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea,select')].filter(el => el.offsetParent !== null);
      const first = controls[0], last = controls[controls.length-1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    }
  });
  window.addEventListener('hashchange', () => {N.closeModal(); N.render(); window.scrollTo(0,0); document.getElementById('main')?.focus({preventScroll:true});});
  window.addEventListener('storage', event => {if (event.key === 'ngekosaja.demo.v1') {location.reload();}});
  N.render();
  if (N.storageWarning) N.toast(N.storageWarning,true);
})(window.NK);
