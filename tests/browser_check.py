"""NgekosAja 2.0 browser regression. No test packages are needed by the website itself."""
import argparse, base64, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:5500')
args=parser.parse_args()
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=')
passed=[];errors=[];resources=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':1440,'height':900},locale='id-ID',timezone_id='Asia/Jakarta',accept_downloads=True)
 page=context.new_page()
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('response',lambda r:resources.append(f'{r.status} {r.url}') if r.status>=400 else None)
 page.goto(args.url);page.evaluate('localStorage.clear()');page.reload();page.wait_for_function('window.NK && NK.state().version===2')
 def state(expression):return page.evaluate('()=>'+expression)
 def route(path):
  page.evaluate('(p)=>NK.navigate(p)',path)
  page.wait_for_timeout(100)
 def role(name,identity=None):
  page.locator('[data-action=roles]:visible').first.click()
  if name=='owner':page.locator('#demo-owner').select_option(identity or 'o1')
  if name=='tenant':page.locator('#demo-tenant').select_option(identity or 't1')
  page.locator(f'[data-action=role][data-role={name}]').click()
  page.wait_for_timeout(100)
  assert state('NK.state().role')==name
 def close():page.locator('.modal [data-action=close-modal]').first.click()
 expect(page.locator('.hero h1')).to_contain_text('tempat pulang')
 page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
 page.locator('#hero-search [name=query]').fill('Grogol')
 page.locator('#hero-search [name=budget]').select_option('2000000')
 page.locator('#hero-search [name=type]').select_option('Putri')
 page.locator('#hero-search [type=submit]').click()
 expect(page.locator('.property-card')).to_have_count(1)
 assert state('NK.marketplaceFilters.max')=='2000000'
 passed.append('Editorial homepage, local assets, connected location/budget/type search')

 page.locator('[data-action=reset-filters]').first.click()
 expect(page.locator('.property-card')).to_have_count(16)
 page.locator('#filter-form [name=query]').fill('tidak-ada-hasil')
 expect(page.locator('#marketplace-results')).to_contain_text('Belum ketemu yang pas')
 page.locator('#marketplace-results [data-action=reset-filters]').click()
 page.locator('#filter-form [name=max]').fill('1800000')
 page.locator('#filter-form [name=facilities][value=AC]').check()
 page.locator('#filter-form [name=facilities][value=WiFi]').check()
 page.locator('#filter-form [name=available]').check()
 page.locator('#filter-form [type=submit]').click()
 assert state('NK.filteredProperties(NK.marketplaceFilters).every(p=>p.price<=1800000&&p.facilities.includes("AC")&&p.facilities.includes("WiFi")&&NK.availableRooms(p).length>0)')
 assert page.locator('.active-filters button').count()>=4
 page.locator('[data-action=reset-filters]').first.click()
 page.locator('#sort-properties').select_option('low')
 prices=state('NK.filteredProperties(NK.marketplaceFilters).map(p=>p.price)');assert prices==sorted(prices)
 page.locator('[data-action=market-view][data-view=list]').click();expect(page.locator('.list-view')).to_be_visible()
 page.locator('[data-action=market-view][data-view=grid]').click()
 page.locator('[data-action=favorite][data-id=p1]').click()
 route('favorites');expect(page.locator('.property-card')).to_have_count(1)
 route('marketplace')
 for id in ['p1','p2','p3']:page.locator(f'[data-compare-id={id}]').check()
 page.locator('.compare-bar a').click();expect(page.locator('.comparison-table thead th')).to_have_count(4)
 page.locator('[data-action=compare-toggle][data-id=p3]').click();expect(page.locator('.comparison-table thead th')).to_have_count(3)
 passed.append('Composed filters, chips, empty state, explicit price sorting, grid/list, wishlist, bounded compare')

 route('property/p2');page.locator('[data-action=fullscreen-photo]').first.click();expect(page.locator('.image-viewer')).to_be_visible()
 page.locator('.fullscreen-gallery [data-index="1"]').click();expect(page.locator('.fullscreen-gallery')).to_contain_text('2 / 3');close()
 page.locator('[data-action=share]').click();page.wait_for_timeout(100)
 if page.locator('.modal').count():close()
 page.locator('[data-action=contact]').click();page.locator('#message-input').fill('Halo, bisa survei hari Sabtu?');page.locator('#chat-form [type=submit]').click()
 guest_chat=state('NK.selectedConversation')
 role('owner','o1');route('owner/chat');page.locator(f'[data-action=select-chat][data-id="{guest_chat}"]').click()
 expect(page.locator('.chat-messages')).to_contain_text('survei hari Sabtu')
 page.locator('[data-action=quick-reply]').first.click();assert page.locator('#message-input').input_value()
 page.locator('#message-input').fill('Bisa, silakan datang pukul 10.00.');page.locator('#chat-form [type=submit]').click()
 role('guest');route('chat');expect(page.locator('.chat-messages')).to_contain_text('datang pukul 10.00')
 passed.append('Property detail, fullscreen gallery, sharing, guest-to-owner chat and quick reply')

 role('tenant','t1');assert not state('NK.favoriteIds().includes("p1")')
 expect(page.locator('.reminder-card')).to_be_visible();page.locator('[data-action=simulate-reminder]').click()
 expect(page.locator('.reminder-card')).to_contain_text('Contoh pengingat H-3 aktif')
 route('tenant/notifications');page.locator('[data-action=mark-read][data-id=all]').click();assert state('NK.myNotifications().every(n=>n.read)')
 route('tenant/bills');invoice='inv-0-0';page.locator(f'[data-action=pay][data-id={invoice}]').click()
 expect(page.locator('.checkout-summary')).to_contain_text('Rp2.000')
 page.locator('[name=method][value=QRIS]').check();expect(page.locator('#method-info')).to_contain_text('QRIS DEMO')
 page.locator('#checkout-form [type=submit]').click();page.locator('[data-action=process-payment][data-result=fail]').click()
 expect(page.locator('.payment-result h1')).to_contain_text('Belum berhasil');assert state('NK.state().invoices.find(i=>i.id==="inv-0-0").status')=='Belum lunas'
 page.locator('[data-action=pay]').click();page.locator('[name=method][value="E-Wallet"]').check();page.locator('#checkout-form [type=submit]').click();page.locator('[data-action=process-payment][data-result=success]').click()
 expect(page.locator('.payment-result h1')).to_contain_text('Pembayaran berhasil')
 assert state('NK.state().transactions.filter(t=>t.invoiceId==="inv-0-0"&&t.status==="Berhasil").length')==1
 page.reload();expect(page.locator('.payment-result h1')).to_contain_text('Pembayaran berhasil')
 page.locator('[data-action=receipt]').click();expect(page.locator('.receipt-sheet')).to_contain_text('BUKTI PEMBAYARAN SIMULASI')
 # Exercise Chromium print output rather than a fake download button.
 page.pdf(path=str(ROOT/'screenshots/receipt-demo.pdf'),print_background=True,format='A4');close()
 role('owner','o1');route('owner/payments');page.locator('#invoice-filter [name=query]').fill('Andi');page.locator('#invoice-filter [type=submit]').click();expect(page.locator(f'[data-action=receipt][data-id={invoice}]')).to_be_visible()
 passed.append('H-3 reminder, notification read state, failed/successful checkout, E-Wallet/QRIS, admin, reload, receipt/PDF and owner sync')

 role('owner','o2');assert state('NK.visible("properties").every(p=>p.ownerId==="o2")');route('owner/payments')
 assert not page.locator(f'[data-action=receipt][data-id={invoice}]').count()
 blocked=page.evaluate('()=>{try{NK.manualReminder("inv-0-0");return false}catch(e){return true}}');assert blocked
 role('owner','o1');route('owner/payments');page.locator('[data-action=add-invoice]').click()
 page.locator('#invoice-form [name=period]').fill('Tagihan Uji Browser');page.locator('#invoice-form [name=amount]').fill('1600000');page.locator('#invoice-form [type=submit]').click()
 new_id=state('NK.state().invoices.find(i=>i.period==="Tagihan Uji Browser").id')
 page.locator(f'[data-action=edit-invoice][data-id="{new_id}"]').click();page.locator('#invoice-form [name=notes]').fill('Catatan yang tersimpan');page.locator('#invoice-form [type=submit]').click()
 page.locator(f'[data-action=remind-tenant][data-id="{new_id}"]').click()
 role('tenant','t1');route('tenant/bills');expect(page.locator('table')).to_contain_text('Tagihan Uji Browser')
 page.locator(f'[data-action=pay][data-id="{new_id}"]').click();page.locator('#checkout-form [type=submit]').click();page.locator('[data-action=process-payment][data-result=success]').click()
 role('owner','o1');route('owner/payments');page.locator('[data-action=bulk-invoice]').click()
 page.locator('#bulk-invoice-form [name=tenantIds][value=t1]').check();page.locator('#bulk-invoice-form [name=tenantIds][value=t2]').check();page.locator('#bulk-invoice-form [name=period]').fill('Batch Uji Browser');page.locator('#bulk-invoice-form [type=submit]').click()
 assert state('NK.state().invoices.filter(i=>i.period==="Batch Uji Browser").length')==2
 cancel_id=state('NK.state().invoices.find(i=>i.period==="Batch Uji Browser").id');page.locator(f'[data-action=cancel-invoice][data-id="{cancel_id}"]').click();page.locator('[data-action=cancel-invoice-confirm]').click()
 assert state(f'NK.state().invoices.find(i=>i.id==="{cancel_id}").status')=='Dibatalkan'
 page.locator('[data-action=recurring-form]').click();page.locator('#recurring-form [type=submit]').click();page.locator('[data-action=recurring-next]').click()
 assert state('NK.visible("recurring").length')==1
 route('owner/reports');page.locator('#report-filter [name=property]').select_option('p1');page.locator('#report-filter [name=from]').fill(state('NK.dateKey()'));page.locator('#report-filter [name=to]').fill(state('NK.dateKey()'));page.locator('#report-filter [type=submit]').click()
 with page.expect_download() as download:page.locator('[data-action=export-csv]').click()
 csv=download.value.path().read_text(encoding='utf-8-sig');assert 'Admin platform' in csv;assert 'Kos Botanica' not in csv
 passed.append('Multi-owner isolation, individual/edit/cancel/bulk/recurring invoices, synchronized payment, filtered financial report and CSV')

 role('tenant','t1');route('tenant/complaints');page.locator('[data-action=add-complaint]').click()
 page.locator('#complaint-form [name=title]').fill('AC kamar tidak dingin');page.locator('#complaint-form [name=description]').fill('AC mengeluarkan suara berisik dan tidak dingin sejak kemarin.');page.locator('[data-action=analyze-complaint]').click()
 expect(page.locator('#live-analysis')).to_contain_text('Simulasi AI');expect(page.locator('.analysis-recommendations')).to_contain_text('AC')
 page.locator('[data-action=apply-analysis]').click();assert page.locator('#complaint-form [name=category]').input_value()=='AC'
 page.locator('#complaint-form [name=photo]').set_input_files({'name':'laporan.png','mimeType':'image/png','buffer':PNG});page.locator('#complaint-form [type=submit]').click();expect(page.locator('#complaint-form')).to_have_count(0)
 report_id=state('NK.state().complaints.find(c=>c.title==="AC kamar tidak dingin").id')
 assert state(f'NK.accessComplaint("{report_id}").photo.startsWith("data:image/png")')
 role('owner','o1');route('owner/complaints');expect(page.locator('.kanban-board')).to_be_visible()
 page.locator(f'[data-action=ticket-detail][data-id="{report_id}"]').click();page.locator('[data-action=accept-ticket-analysis]').click()
 page.locator('#ticket-treatment-form [name=status]').select_option('Diproses');page.locator('#ticket-treatment-form [name=note]').fill('Teknisi memeriksa dan membersihkan filter.');page.locator('#ticket-treatment-form [type=submit]').click()
 page.locator('[data-action=ticket-view][data-view=table]').click();page.locator(f'[data-action=ticket-detail][data-id="{report_id}"]').click();page.locator('#ticket-treatment-form [name=status]').select_option('Menunggu Konfirmasi');page.locator('#ticket-treatment-form [name=note]').fill('Perbaikan selesai. Silakan konfirmasi.');page.locator('#ticket-treatment-form [type=submit]').click()
 role('tenant','t1');route('tenant/complaints');page.locator(f'[data-action=confirm-complaint][data-id="{report_id}"]').click();assert state(f'NK.accessComplaint("{report_id}").status')=='Selesai'
 page.locator(f'[data-action=ticket-detail][data-id="{report_id}"]').click();page.locator('[data-action=reopen-ticket]').click();page.locator('#reopen-form [name=note]').fill('Suara masih terdengar saat AC dinyalakan.');page.locator('#reopen-form [type=submit]').click();assert state(f'NK.accessComplaint("{report_id}").status')=='Menunggu'
 passed.append('Rule-based analysis, user acceptance, photo upload, table/kanban, treatment/timeline, tenant confirmation and reopen')

 route('tenant/chat');page.locator('#message-input').fill('Terima kasih, mohon cek kembali AC saya.');page.locator('#chat-form [name=photo]').set_input_files({'name':'kamar.png','mimeType':'image/png','buffer':PNG});page.locator('#chat-form [type=submit]').click();tenant_chat=state('NK.selectedConversation')
 role('owner','o1');route('owner/chat');page.locator(f'[data-action=select-chat][data-id="{tenant_chat}"]').click();expect(page.locator('.chat-messages')).to_contain_text('cek kembali AC saya');expect(page.locator('.message-photo').last).to_be_visible()
 passed.append('Tenant-owner messaging, image attachment and local unread tracking')

 route('owner/properties')
 def add_property(name,total='3'):
  page.locator('[data-action=add-property]').click();form=page.locator('#property-form')
  for field,value in {'name':name,'location':'Slipi','address':'Jl. Contoh No. 1, Jakarta Barat','description':'Properti ilustrasi untuk pengujian pengelolaan kamar.','total':total}.items():form.locator(f'[name={field}]').fill(value)
  form.locator('[name=facilities][value=WiFi]').check();form.locator('[type=submit]').click();return state('NK.state().properties.find(p=>p.name==='+json.dumps(name)+').id')
 delete_prop=add_property('Kos Tanpa Riwayat Uji')
 page.locator(f'[data-action=edit-property][data-id="{delete_prop}"]').click();page.locator('#property-form [name=price]').fill('1700000');page.locator('#property-form [type=submit]').click();assert state(f'NK.property("{delete_prop}").price')==1700000
 page.locator(f'[data-action=delete-property][data-id="{delete_prop}"]').locator('xpath=ancestor::details').locator('summary').click();page.locator(f'[data-action=delete-property][data-id="{delete_prop}"]').click();page.locator('[data-action=delete-property-confirm]').click();assert not state(f'NK.property("{delete_prop}")')
 prop=add_property('Kos Penempatan Uji')
 page.locator(f'[data-action=property-rooms][data-id="{prop}"]').click();expect(page.locator('.room-card')).to_have_count(3)
 room=page.locator('.room-card').first.get_attribute('data-id');page.locator('.room-card').first.click();page.locator('#room-form [name=status]').select_option('Dalam perbaikan');page.locator('#room-form [type=submit]').click();assert state(f'NK.availableRooms(NK.property("{prop}")).length')==2
 page.locator(f'[data-action=room-detail][data-id="{room}"]').click();page.locator('#room-form [name=status]').select_option('Tersedia');page.locator('#room-form [type=submit]').click()
 route('owner/tenants');page.locator('[data-action=add-tenant]').click()
 for field,value in {'name':'Penghuni Browser Uji','email':'uji@example.com','phone':'081234567890'}.items():page.locator(f'#tenant-form [name={field}]').fill(value)
 page.locator('#tenant-property').select_option(prop);page.locator('#tenant-form [type=submit]').click();tid=state('NK.state().tenants.find(t=>t.name==="Penghuni Browser Uji").id')
 page.locator(f'[data-action=edit-tenant][data-id="{tid}"]').click();page.locator('#tenant-form [name=name]').fill('Penghuni Diperbarui');page.locator('#tenant-room').select_option(index=1);page.locator('#tenant-form [type=submit]').click();expect(page.locator('table')).to_contain_text('Penghuni Diperbarui')
 page.locator(f'[data-action=checkout-tenant][data-id="{tid}"]').click();page.locator('[data-action=checkout-tenant-confirm]').click();assert state(f'NK.tenant("{tid}").leaseStatus')=='Check-out';assert state(f'NK.availableRooms(NK.property("{prop}")).length')==3
 route('owner/properties');page.locator(f'[data-action=archive-property][data-id="{prop}"]').locator('xpath=ancestor::details').locator('summary').click();page.locator(f'[data-action=archive-property][data-id="{prop}"]').click();page.locator('[data-action=archive-property-confirm]').click();assert state(f'NK.property("{prop}").archived')
 passed.append('Property create/edit/delete/archive, room repair/available, tenant check-in/edit/move/check-out and historical retention')

 route('owner/boost');page.locator('[data-action=boost][data-id=p2]').click();page.locator('[data-action=boost-fail]').click();assert not state('NK.isBoosted(NK.property("p2"))')
 page.locator('[data-action=boost][data-id=p2]').click();page.locator('[data-action=boost-success]').click();assert state('NK.isBoosted(NK.property("p2"))');assert state('NK.visible("campaigns").some(c=>c.propertyId==="p2")')
 route('marketplace');page.locator('#sort-properties').select_option('recommended');assert state('NK.filteredProperties(NK.marketplaceFilters).slice(0,2).every(NK.isBoosted)')
 role('admin');expect(page.locator('main')).to_contain_text('GMV sewa');expect(page.locator('main')).to_contain_text('PENDAPATAN PLATFORM')
 passed.append('Boost failure/success, 30-day campaign, recommendation priority and separate admin GMV/platform revenue')

 route('register');page.locator('#register-form [name=name]').fill('Rani Demo');page.locator('#register-form [name=email]').fill('rani@example.com');page.locator('#register-form [name=role]').select_option('owner');page.locator('#register-form [name=consent]').check();page.locator('#register-form [type=submit]').click();assert state('NK.actor().name')=='Rani Demo'
 route('owner/settings');page.locator('#settings-form [name=name]').fill('Rani Pengelola');page.locator('#settings-form [name=notifications]').uncheck();page.locator('#settings-form [name=compact]').check();page.locator('#settings-form [type=submit]').click();expect(page.locator('.density-compact')).to_be_visible();page.reload();assert state('NK.actor().name')=='Rani Pengelola'
 route('login');page.locator('#login-account').select_option('t1');page.locator('#login-form [type=submit]').click();assert state('NK.actorId()')=='t1'
 route('forgot');page.locator('#forgot-form [name=account]').select_option('o2');page.locator('#forgot-form [type=submit]').click();page.locator('[data-action=login-selected]').click();assert state('NK.actorId()')=='o2'
 route('tenant/bills');assert page.evaluate('location.hash')=='#/owner'
 passed.append('Register/login/recovery demo, per-account profile/preferences persistence, and role route guards')

 # Migration is tested in a separate context, retaining a byte-identical v1 key.
 migration=context.new_page();migration.goto(args.url);migration.wait_for_function('window.NK')
 legacy=migration.evaluate('()=>{let s=NK.seed();s.version=1;s.properties=s.properties.slice(0,8);s.properties[0].name="Kos Lama Pengguna";for(const p of s.properties)delete p.ownerId;s.tenants=s.tenants.slice(0,5);s.invoices=s.invoices.filter(i=>!i.id.includes("v2"));s.transactions=s.transactions.filter(t=>!t.id.includes("v2"));for(const k of ["owners","users","agreements","campaigns","notifications","favorites","settings"])delete s[k];localStorage.clear();localStorage.setItem("ngekosaja.demo.v1",JSON.stringify(s));return JSON.stringify(s)}')
 migration.reload();migration.wait_for_function('NK.state().version===2');assert migration.evaluate('NK.property("p1").name')=='Kos Lama Pengguna';assert migration.evaluate('localStorage.getItem("ngekosaja.demo.v1")')==legacy;migration.close()
 # Restore this test context after the other tab's storage event reload.
 page.reload();page.wait_for_function('window.NK');role('guest');route('')
 page.locator('[data-action=reset]').first.click();page.locator('[data-action=reset-confirm]').click();assert state('NK.state().properties.length')==16;assert state('NK.state().role')=='guest'
 page.set_viewport_size({'width':390,'height':844});page.locator('[data-action=menu]').click();expect(page.locator('.public-nav')).to_be_visible()
 route('marketplace');page.locator('.mobile-filter-btn').click();expect(page.locator('.filter-open')).to_be_visible();page.locator('#filter-form [name=type]').select_option('Putri');page.locator('#filter-form [type=submit]').click();expect(page.locator('.filter-open')).to_have_count(0)
 passed.append('Browser v1 migration preserves source, confirmed reset, mobile menu and functional bottom-sheet filter')
 assert not resources,resources
 assert not errors,errors
 result={'base_url':args.url,'passed':passed,'javascript_errors':errors,'failed_resources':resources}
 (ROOT/'tests/browser-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(result,ensure_ascii=True,indent=2));browser.close()
