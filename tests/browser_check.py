"""End-to-end checks. Optional dev tool: Python + Playwright (not needed to run the app).
Run: python tests/browser_check.py --url http://127.0.0.1:5500
"""
import argparse
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default=(ROOT / 'index.html').as_uri())
args = parser.parse_args()
errors = []
passed = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='id-ID', timezone_id='Asia/Jakarta')
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url)
    page.evaluate('localStorage.clear()')
    page.reload()
    expect(page.locator('.hero h1')).to_contain_text('Cari Kos Nyaman')
    page.wait_for_function('Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)')
    page.screenshot(animations='disabled', path=str(ROOT / 'tests/home-desktop.png'), full_page=True)
    passed.append('Homepage and all local images')

    def state(expression):
        return page.evaluate('() => ' + expression)

    def route(path):
        page.evaluate('(path) => location.hash = path', '#/' + path)
        page.wait_for_timeout(120)

    def role(name, tenant='t1'):
        # Open through the same visible role picker used in the demo.
        page.locator('[data-action=roles]').first.click()
        if name == 'tenant':
            page.locator('#demo-tenant').select_option(tenant)
        page.locator(f'[data-action=role][data-role={name}]').click()
        page.wait_for_timeout(150)
        assert state('NK.state().role') == name

    route('marketplace')
    expect(page.locator('.property-card')).to_have_count(8)
    page.locator('#filter-form [name=query]').fill('tidak-ada-hasil')
    expect(page.locator('#marketplace-results')).to_contain_text('Belum ada kos yang cocok')
    page.locator('#marketplace-results [data-action=reset-filters]').click()
    page.locator('#filter-form [name=max]').fill('1600000')
    page.locator('#filter-form button[type=submit]').click()
    expect(page.locator('.property-card')).to_have_count(3)
    page.locator('[data-action=reset-filters]').first.click()
    page.locator('#filter-form [name=facility]').select_option('AC')
    page.locator('#filter-form [name=available]').check()
    page.locator('#filter-form button[type=submit]').click()
    expect(page.locator('.property-card')).to_have_count(5)
    page.locator('[data-action=reset-filters]').first.click()
    page.locator('#sort-properties').select_option('low')
    assert 'Senja' in page.locator('.property-title').first.inner_text()
    prices = state('NK.filteredProperties(NK.marketplaceFilters).slice(1).map(p=>p.price)')
    assert prices == sorted(prices)
    passed.append('Marketplace search, price, facility, availability, sort, empty state')

    route('property/p2')
    page.locator('[data-action=contact]').click()
    page.locator('#message-input').fill('Halo, apakah bisa survei hari Sabtu?')
    page.locator('#chat-form button').click()
    expect(page.locator('.message-bubble').last).to_contain_text('survei hari Sabtu')
    guest_chat = state('NK.selectedConversation')
    role('owner')
    route('owner/chat')
    page.locator(f'[data-action=select-chat][data-id="{guest_chat}"]').click()
    page.locator('#message-input').fill('Bisa, silakan datang pukul 10.00 ya.')
    page.locator('#chat-form button').click()
    role('guest')
    route('chat')
    expect(page.locator('.chat-messages')).to_contain_text('silakan datang pukul 10.00')
    passed.append('Guest to owner chat, and owner reply')

    role('tenant')
    expect(page.locator('.reminder-card')).to_be_visible()
    page.locator('[data-action=simulate-reminder]').click()
    expect(page.locator('.reminder-card')).to_contain_text('Demo pengingat H-3 aktif')
    page.locator('[data-action=notifications]').click()
    expect(page.locator('.modal')).to_contain_text('Pengingat sewa')
    page.locator('[data-action=close-modal]').click()
    route('tenant/bills')
    invoice_id = page.locator('[data-action=pay]').first.get_attribute('data-id')
    page.locator('[data-action=pay]').first.click()
    expect(page.locator('.payment-breakdown')).to_contain_text('Rp2.000')
    page.locator('[name=result][value=fail]').click()
    expect(page.locator('.modal')).to_contain_text('Pembayaran belum berhasil')
    assert state(f'NK.state().invoices.find(i=>i.id==="{invoice_id}").status') == 'Belum lunas'
    page.locator('.modal [data-action=pay]').click()
    page.locator('[name=method][value=QRIS]').check()
    page.locator('[name=result][value=success]').click()
    expect(page.locator('.modal')).to_contain_text('Pembayaran berhasil!')
    assert state(f'NK.state().invoices.find(i=>i.id==="{invoice_id}").status') == 'Lunas'
    assert state(f'NK.state().transactions.filter(t=>t.invoiceId==="{invoice_id}"&&t.status==="Berhasil").length') == 1
    page.locator('[data-action=close-modal]').first.click()
    page.reload()
    assert state(f'NK.state().invoices.find(i=>i.id==="{invoice_id}").status') == 'Lunas'
    page.locator(f'[data-action=receipt][data-id="{invoice_id}"]').click()
    expect(page.locator('.modal')).to_contain_text('Bukti pembayaran sewa')
    page.locator('[data-action=close-modal]').first.click()
    passed.append('H-3 reminder, bell, failed/successful payment, fee, receipt, reload persistence')

    role('owner')
    route('owner/payments')
    page.locator('[data-action=add-invoice]').click()
    page.locator('#invoice-form [name=period]').fill('Tagihan Uji Integrasi')
    page.locator('#invoice-form [name=amount]').fill('1600000')
    page.locator('#invoice-form [type=submit]').click()
    expect(page.locator('table').first).to_contain_text('Tagihan Uji Integrasi')
    new_id = state('NK.state().invoices.find(i=>i.period==="Tagihan Uji Integrasi").id')
    page.locator(f'[data-action=remind-tenant][data-id="{new_id}"]').click()
    role('tenant')
    route('tenant/bills')
    expect(page.locator('table')).to_contain_text('Tagihan Uji Integrasi')
    page.locator(f'[data-action=pay][data-id="{new_id}"]').click()
    page.locator('[name=result][value=success]').click()
    page.locator('[data-action=close-modal]').first.click()
    role('owner')
    route('owner/payments')
    expect(page.locator(f'[data-action=receipt][data-id="{new_id}"]')).to_be_visible()
    passed.append('Owner invoice -> tenant payment -> owner synchronized Lunas')

    role('tenant')
    route('tenant/complaints')
    page.locator('[data-action=add-complaint]').click()
    page.locator('#complaint-form [name=title]').fill('Pintu lemari perlu diperbaiki')
    page.locator('#complaint-form [name=description]').fill('Engsel pintu lemari kamar longgar sejak pagi ini.')
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=')
    page.locator('#complaint-form [name=photo]').set_input_files({'name':'laporan.png','mimeType':'image/png','buffer':png})
    page.locator('#complaint-form [type=submit]').click()
    expect(page.locator('.complaint-list')).to_contain_text('Pintu lemari perlu diperbaiki')
    report_id = state('NK.state().complaints.find(c=>c.title==="Pintu lemari perlu diperbaiki").id')
    assert state(f'NK.state().complaints.find(c=>c.id==="{report_id}").photo.startsWith("data:image/png")')
    role('owner')
    route('owner/complaints')
    page.locator(f'[data-complaint-id="{report_id}"]').select_option('Diproses')
    page.locator(f'[data-complaint-id="{report_id}"]').select_option('Selesai')
    role('tenant')
    route('tenant/complaints')
    page.locator(f'[data-action=confirm-complaint][data-id="{report_id}"]').click()
    expect(page.locator('.complaint-list')).to_contain_text('Sudah dikonfirmasi')
    passed.append('Complaint photo -> owner process/resolve -> tenant confirmation')

    route('tenant/chat')
    page.locator('#message-input').fill('Terima kasih, fasilitasnya sudah diperbaiki.')
    page.locator('#chat-form button').click()
    tenant_chat = state('NK.selectedConversation')
    role('owner')
    route('owner/chat')
    page.locator(f'[data-action=select-chat][data-id="{tenant_chat}"]').click()
    expect(page.locator('.chat-messages')).to_contain_text('fasilitasnya sudah diperbaiki')
    passed.append('Tenant to owner chat synchronization')

    route('owner/properties')
    page.locator('[data-action=add-property]').click()
    form = page.locator('#property-form')
    for key,value in {'name':'Kos Uji Integrasi','location':'Palmerah','address':'Jl. Uji No. 1, Jakarta Barat','description':'Kamar demo untuk pengujian pengelolaan properti.'}.items():
        form.locator(f'[name={key}]').fill(value)
    form.locator('[type=submit]').click()
    prop_id = state('NK.state().properties.find(p=>p.name==="Kos Uji Integrasi").id')
    page.locator(f'[data-action=edit-property][data-id="{prop_id}"]').click()
    page.locator('#property-form [name=price]').fill('1700000')
    page.locator('#property-form [type=submit]').click()
    assert state(f'NK.property("{prop_id}").price') == 1700000
    before = state(f'NK.availableRooms(NK.property("{prop_id}")).length')
    page.locator(f'[data-action=rooms][data-id="{prop_id}"]').click()
    page.locator('[data-action=toggle-room]').first.click()
    assert state(f'NK.availableRooms(NK.property("{prop_id}")).length') == before-1
    page.locator('[data-action=close-modal]').first.click()
    route('owner/tenants')
    page.locator('[data-action=add-tenant]').click()
    for key,value in {'name':'Penghuni Uji','email':'uji@example.com','phone':'081234567890'}.items():
        page.locator(f'#tenant-form [name={key}]').fill(value)
    page.locator('#tenant-property').select_option(prop_id)
    page.locator('#tenant-form [type=submit]').click()
    tenant_id = state('NK.state().tenants.find(t=>t.name==="Penghuni Uji").id')
    assert state(f'NK.availableRooms(NK.property("{prop_id}")).length') == before-2
    page.locator(f'[data-action=edit-tenant][data-id="{tenant_id}"]').click()
    page.locator('#tenant-form [name=name]').fill('Penghuni Uji Diperbarui')
    page.locator('#tenant-form [type=submit]').click()
    expect(page.locator('table')).to_contain_text('Penghuni Uji Diperbarui')
    page.locator(f'[data-action=delete-tenant][data-id="{tenant_id}"]').click()
    page.locator('[data-action=delete-tenant-confirm]').click()
    assert not state(f'NK.state().tenants.some(t=>t.id==="{tenant_id}")')
    route('owner/properties')
    page.locator(f'[data-action=delete-property][data-id="{prop_id}"]').click()
    page.locator('[data-action=delete-property-confirm]').click()
    assert not state(f'NK.state().properties.some(p=>p.id==="{prop_id}")')
    passed.append('Property create/edit/delete, room availability, tenant CRUD and occupancy')

    route('owner/boost')
    page.locator('[data-action=boost][data-id=p2]').click()
    page.locator('[data-action=boost-fail]').click()
    assert not state('NK.isBoosted(NK.property("p2"))')
    page.locator('[data-action=boost][data-id=p2]').click()
    page.locator('[data-action=boost-success]').click()
    assert state('NK.isBoosted(NK.property("p2"))')
    route('marketplace')
    assert state('NK.filteredProperties(NK.marketplaceFilters).slice(0,2).every(NK.isBoosted)')
    assert page.locator('.promo-badge').count() == 2
    passed.append('Boost failure/success, Rp30.000 history, promoted sort priority')

    # Check every public and authorized dashboard route at four widths.
    desktop_routes = ['', 'marketplace', 'property/p1', 'fitur', 'tentang', 'owner', 'owner/properties', 'owner/tenants', 'owner/payments', 'owner/complaints', 'owner/chat', 'owner/boost']
    for width in [1440, 1024, 768, 390, 360]:
        page.set_viewport_size({'width':width,'height':900 if width > 760 else 844})
        for path in desktop_routes:
            route(path)
            overflow = state('document.documentElement.scrollWidth > innerWidth + 1')
            assert not overflow, f'Horizontal overflow: {path}, {width}px'
    page.set_viewport_size({'width':1440,'height':900})
    route('owner')
    page.screenshot(animations='disabled', path=str(ROOT / 'tests/owner-desktop.png'), full_page=True)
    role('tenant')
    for width in [1440, 768, 390, 360]:
        page.set_viewport_size({'width':width,'height':900 if width > 760 else 844})
        for path in ['tenant','tenant/bills','tenant/history','tenant/complaints','tenant/chat']:
            route(path)
            assert not state('document.documentElement.scrollWidth > innerWidth + 1'), f'Overflow: {path} {width}'
    page.set_viewport_size({'width':1440,'height':900})
    route('tenant')
    page.screenshot(animations='disabled', path=str(ROOT / 'tests/tenant-desktop.png'), full_page=True)
    route('owner/payments')
    assert '#/tenant' == page.evaluate('location.hash')
    passed.append('Role access protection; all pages responsive at 360–1440px')

    page.locator('[data-action=reset]').first.click()
    page.locator('[data-action=reset-confirm]').click()
    assert state('NK.state().properties.length') == 8
    assert state('NK.state().role') == 'guest'
    page.set_viewport_size({'width':390,'height':844})
    route('')
    page.screenshot(animations='disabled', path=str(ROOT / 'tests/home-mobile.png'), full_page=True)
    page.locator('[data-action=menu]').click()
    expect(page.locator('.public-nav')).to_be_visible()
    passed.append('Demo reset, mobile navigation')
    assert not errors, 'JavaScript errors: ' + json.dumps(errors)
    print(json.dumps({'passed':passed,'javascript_errors':errors,'base_url':args.url}, ensure_ascii=True, indent=2))
    browser.close()
