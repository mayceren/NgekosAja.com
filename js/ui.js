(function (N) {
  'use strict';
  N.e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  N.money = value => new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0}).format(value);
  N.date = (value, opts) => value ? new Date(value.length === 10 ? value + 'T00:00:00' : value).toLocaleDateString('id-ID', opts || {day:'numeric', month:'short', year:'numeric'}) : '—';
  N.time = value => new Date(value).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
  const icons = {
    user:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    mail:'M3 5h18v14H3Zm0 0 9 7 9-7',
    key:'M21 7a5 5 0 1 1-9.6 2L3 17v4h4v-3h3v-3l3.1-3.1A5 5 0 0 1 21 7ZM17 7h.01',
    sparkles:'m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7ZM20 2v4m-2-2h4',
    compare:'M8 3v18M16 3v18M3 7h10M11 17h10', list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', settings:'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM9 2h6l1 4 4 1 2 5-2 5-4 1-1 4H9l-1-4-4-1-2-5 2-5 4-1Z', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0', print:'M6 8V2h12v6M6 17H3V8h18v9h-3M6 14h12v8H6ZM17 11h1', copy:'M8 8h13v13H8ZM16 8V2H2v14h6', archive:'M3 3h18v5H3ZM5 8v13h14V8M9 12h6',
    home:'m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    arrow:'M4 12h16m-6-6 6 6-6 6', arrowUp:'M7 17 17 7M7 7h10v10', chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6',
    pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    check:'m5 12 4 4L19 6', shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6',
    grid:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
    building:'M4 21V5h10v16M14 10h6v11M2 21h20M7 8h4M7 12h4M7 16h4M17 13v2M17 17v1',
    users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    wallet:'M20 8V5H4a2 2 0 0 1 0-4h14v4M4 5a2 2 0 0 0-2 2v13h20V8Zm12 7h6m-4-1v2',
    receipt:'M6 2h12v20l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3',
    clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2',
    bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    tool:'m14 6 4 4 4-4a6 6 0 0 1-8 8L6 22l-4-4 8-8a6 6 0 0 1 8-8Z',
    chat:'M21 11a9 9 0 0 1-9 9H7l-5 3 1-7a9 9 0 1 1 18-5ZM7 10h10M7 14h6',
    rocket:'M14 4c3-2 6-2 8-2 0 2 0 5-2 8l-7 7-6-6ZM14 4H7l-5 5 5 2m13-1v7l-5 5-2-5M5 15l-3 7 7-3M15 7h2',
    plus:'M12 5v14M5 12h14', edit:'m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5', trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    close:'m6 6 12 12M6 18 18 6', menu:'M4 6h16M4 12h16M4 18h16',
    wifi:'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01',
    snow:'M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M8 4l4 4 4-4M8 20l4-4 4 4M3 11l5-1-1-5m14 6-5-1 1-5M3 13l5 1-1 5m14-6-5 1 1 5',
    bed:'M3 18V6m0 9h18v6M3 10h18v8M6 10V7h5v3m2 0V7h5v3M3 21v-3',
    bath:'M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Zm2 0V5a3 3 0 0 1 6 0M5 20v2m14-2v2',
    star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
    send:'m22 2-7 20-4-9-9-4Zm0 0L11 13', logout:'M9 3H3v18h6M14 7l5 5-5 5M8 12h12',
    refresh:'M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-3l2 3M4 17l2 3a8 8 0 0 0 13-3',
    filter:'M4 7h16M7 12h10M10 17h4', camera:'M3 7h4l2-3h6l2 3h4v14H3Zm13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6M12 7h.01', leaf:'M20 3c-10-1-17 3-16 10 1 8 15 8 16-10ZM4 21 16 9',
    sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
    calendar:'M4 5h16v16H4ZM8 2v6m8-6v6M4 10h16', download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8'
  };
  N.icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.home}"/></svg>`;
  N.logo = () => `<a class="brand" href="#/" aria-label="NgekosAja.com beranda"><img src="assets/icons/logo.svg" width="37" height="37" alt=""><span>Ngekos<span class="brand-light">Aja</span><small>.com</small></span></a>`;
  N.badge = status => `<span class="badge ${['Lunas','Berhasil','Selesai','Tersedia','Aktif'].includes(status)?'success':['Gagal','Terlambat','Mendesak'].includes(status)?'danger':['Diproses','Terisi'].includes(status)?'blue':['Tidak aktif','Dibatalkan','Check-out','Diarsipkan','Berakhir','Dihentikan'].includes(status)?'neutral':'warning'}">${N.e(status)}</span>`;
  N.empty = (title, text, action = '') => `<div class="empty">${N.icon('search')}<h3>${N.e(title)}</h3><p>${N.e(text)}</p>${action}</div>`;
  N.heading = (eyebrow, title, description, action = '') => `<div class="page-heading"><div>${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}<h1>${title}</h1><p>${description}</p></div>${action}</div>`;
  N.toast = (text, error = false) => {
    const el = document.createElement('div'); el.className = `toast ${error ? 'error' : ''}`;
    el.innerHTML = `${N.icon(error ? 'info' : 'check')}<span>${N.e(text)}</span>`;
    document.getElementById('toast-root').append(el); setTimeout(() => el.remove(), 4500);
  };
  let returnFocus;
  N.modal = (title, body, wide = false) => {
    returnFocus = document.activeElement;
    document.getElementById('modal-root').innerHTML = `<div class="modal-overlay"><section class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="Tutup dialog">${N.icon('close')}</button></div>${body}</section></div>`;
    document.body.classList.add('modal-open');
    setTimeout(() => document.querySelector('.modal input:not([type=hidden]), .modal select, .modal button')?.focus(), 30);
  };
  N.closeModal = () => { document.getElementById('modal-root').innerHTML = ''; document.body.classList.remove('modal-open'); if (returnFocus?.isConnected) returnFocus.focus(); };
  N.confirm = (title, text, action, id = '') => N.modal(title, `<p class="modal-description">${N.e(text)}</p><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Batal</button><button class="btn ${action.startsWith('delete') || action === 'reset-confirm' ? 'btn-danger' : 'btn-primary'}" data-action="${action}" data-id="${N.e(id)}">Ya, lanjutkan</button></div>`);

})(window.NK);
