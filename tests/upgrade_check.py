"""Targeted v2 checks after final account/report refinements, using file:// as well."""
from pathlib import Path
import json,csv,io
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 for url in ['http://127.0.0.1:5500',(ROOT/'index.html').as_uri()]:
  context=browser.new_context(viewport={'width':1440,'height':900},locale='id-ID',timezone_id='Asia/Jakarta')
  context.add_init_script("localStorage.setItem('ngekosaja.mode.v3','demo')")
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto(url);page.wait_for_function('window.NK');page.evaluate('localStorage.clear()');page.reload()
  def route(path):page.evaluate('(p)=>NK.navigate(p)',path);page.wait_for_timeout(90)
  route('register')
  for field,value in [('name','Lina Demo'),('email','lina@example.com')]:page.locator(f'#register-form [name={field}]').fill(value)
  page.locator('#register-form [name=role]').select_option('guest');page.locator('#register-form [name=consent]').check();page.locator('#register-form [type=submit]').click();page.wait_for_timeout(90)
  uid=page.evaluate('NK.actorId()');assert uid!='guest'
  route('property/p2');page.locator('[data-action=favorite]').first.click();page.locator('[data-action=contact]').click();page.locator('#message-input').fill('Saya ingin survei kos ini.');page.locator('#chat-form [type=submit]').click();cid=page.evaluate('NK.selectedConversation')
  page.locator('[data-action=roles]:visible').first.click();page.locator('#demo-owner').select_option('o1');page.locator('[data-action=role][data-role=owner]').click()
  route('owner/tenants');page.locator('[data-action=add-tenant]').click();page.locator('#tenant-existing').select_option(uid);assert page.locator('#tenant-form [name=name]').input_value()=='Lina Demo'
  page.locator('#tenant-form [name=phone]').fill('081234567890');page.locator('#tenant-property').select_option('p2');page.locator('#tenant-form [type=submit]').click();expect(page.locator('.modal')).to_have_count(0)
  assert page.evaluate('(id)=>NK.tenant(id).leaseStatus',uid)=='Aktif'
  page.locator('[data-action=roles]:visible').first.click();page.locator('#demo-tenant').select_option(uid);page.locator('[data-action=role][data-role=tenant]').click();expect(page.locator('.tenant-room-card')).to_contain_text('Ruang Teduh Grogol')
  route('tenant/favorites');expect(page.locator('.property-card')).to_have_count(1);route('tenant/chat');assert page.evaluate('NK.selectedConversation')==cid
  page.reload();expect(page.locator('.chat-messages')).to_contain_text('survei kos ini')
  page.evaluate('NK.setRole("owner","o1")');route('owner/reports');today=page.evaluate('NK.dateKey()');page.locator('#report-filter [name=property]').select_option('p1');page.locator('#report-filter [name=from]').fill(today);page.locator('#report-filter [name=to]').fill(today);page.locator('#report-filter [type=submit]').click();expect(page.locator('.chart-point')).to_have_count(1)
  assert page.evaluate('NK.revenueSeries(6,"p1",NK.financeFilter)[0].total===NK.financialSummary().rent')
  with page.expect_download() as report_download:page.locator('[data-action=export-csv]').click()
  report_rows=list(csv.reader(io.StringIO(report_download.value.path().read_text(encoding='utf-8-sig'))))
  assert len(report_rows)-1==page.evaluate('NK.financialRows().transactions.length')
  route('owner/transactions')
  with page.expect_download() as all_download:page.locator('[data-action=export-csv]').click()
  all_rows=list(csv.reader(io.StringIO(all_download.value.path().read_text(encoding='utf-8-sig'))))
  assert len(all_rows)-1==page.evaluate('NK.visible("transactions").length')
  route('owner/reports')

  if url.startswith('http'):
   page.locator('[data-action=reset-report]').click();page.screenshot(path=str(ROOT/'screenshots/financial-report.png'),animations='disabled')
  assert not errors,errors
  results.append({'url':url,'passed':['registration -> same-identity owner check-in','preserved favorites and property conversation','reload persistence','financial chart date/property filtering','CSV report respects filters, transactions export includes visible account rows'],'javascript_errors':errors})
  context.close()
 browser.close()
(ROOT/'tests/upgrade-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=True,indent=2))
