"""Product content audit in Chromium. All Supabase HTTP is intercepted; no Cloud writes."""
import json,os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
ORIGIN=os.environ.get('NGEKOSAJA_TEST_ORIGIN','http://127.0.0.1:5501').rstrip('/')
OUT=ROOT/'tests/branding';OUT.mkdir(parents=True,exist_ok=True)
ACADEMIC=re.compile(r'\b(?:UAS|UTS|Technopreneurship|BMLC|milestone|dosen)\b|tugas\s+(?:kuliah|kelompok)|project\s+akademik|perkuliahan|anggaran\s+Rp\s*0|prototype\s+pendidikan',re.I)
errors=[];checks=[];requests=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':1440,'height':900},locale='id-ID')
 def boundary(route):
  requests.append((route.request.method,route.request.url.split('?')[0]))
  route.fulfill(status=200 if '/rest/v1/rpc/public_listings' in route.request.url else 401,content_type='application/json',body='[]' if '/rest/v1/rpc/public_listings' in route.request.url else '{}',headers={'access-control-allow-origin':'*'})
 context.route('https://*.supabase.co/**',boundary)
 page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto(ORIGIN);page.wait_for_function('NA.ready')
 description=page.locator('meta[name=description]').get_attribute('content')
 assert not ACADEMIC.search(description);assert 'NgekosAja.com' in description
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':900})
  for path in ['', 'marketplace','fitur','tentang','untuk-pemilik','help','privacy','login','register','forgot','verify','reset']:
   page.evaluate('(path)=>NK.navigate(path)',path);page.wait_for_timeout(80)
   visible=page.locator('body').inner_text();assert not ACADEMIC.search(visible),path
   assert page.title().endswith('NgekosAja.com');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),path
   if path=='tentang':
    assert 'calon penghuni, penghuni' in visible;assert 'sistem yang terintegrasi' in visible
    assert 'masih dikembangkan' in visible
   if path=='help':assert 'Jika diminta' in visible and 'kuota' in visible
   if path=='privacy':assert 'Supabase' in visible and 'Reset Data Demo' in visible and 'tidak memindahkan uang' in visible
   checks.append({'environment':'connected-anonymous','width':width,'route':path or 'home'})
  page.evaluate('NK.navigate("tentang")');page.screenshot(path=str(OUT/f'about-{width}.png'),full_page=True)
 page.set_viewport_size({'width':1440,'height':900});page.goto(ORIGIN+'/#/login');page.wait_for_function('NA.ready')
 page.locator('[data-auth-action=demo]').first.click();page.get_by_role('dialog').wait_for();page.locator('[data-action=role][data-role=guest]').click()
 assert page.evaluate('NA.mode==="demo" && NA.client===null')
 demo_requests=len(requests)
 routes={
  'guest':['','marketplace','property/p1','favorites','compare','fitur','tentang','untuk-pemilik','help','privacy','login','register','forgot','account/settings','chat'],
  'owner':['owner','owner/properties','owner/rooms','owner/tenants','owner/payments','owner/transactions','owner/reports','owner/complaints','owner/chat','owner/boost','owner/notifications','owner/settings'],
  'tenant':['tenant','tenant/home','tenant/bills','tenant/history','tenant/complaints','tenant/chat','tenant/notifications','tenant/settings','checkout/inv-0-0'],
  'admin':['admin','admin/users','admin/listings','admin/transactions','admin/complaints','admin/campaigns','admin/settings']}
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':900})
  for role,paths in routes.items():
   page.evaluate('(role)=>NK.setRole(role)',role)
   for path in paths:
    page.evaluate('(path)=>NK.navigate(path)',path);page.wait_for_timeout(65)
    assert not ACADEMIC.search(page.locator('body').inner_text()),path
    assert page.title().endswith('NgekosAja.com');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'{width}: {path}'
    if path.startswith('checkout/'):expect(page.locator('.payment-label')).to_contain_text('Simulasi Pembayaran')
    if role=='tenant' and path=='tenant/complaints':
     page.locator('[data-action=ticket-detail][data-id=c1]').click();assert not ACADEMIC.search(page.get_by_role('dialog').inner_text());page.keyboard.press('Escape')
    checks.append({'environment':'demo','role':role,'width':width,'route':path or 'home'})
 page.set_viewport_size({'width':1440,'height':900});page.evaluate('NK.setRole("tenant");NK.navigate("checkout/inv-0-0")');page.wait_for_timeout(100)
 page.screenshot(path=str(OUT/'sandbox-checkout.png'),full_page=True)
 page.locator('#checkout-form [type=submit]').click();expect(page.get_by_role('dialog')).to_contain_text('Simulasi Pembayaran');page.locator('[data-action=process-payment][data-result=success]').click()
 page.locator('[data-action=receipt]').click();expect(page.get_by_role('dialog')).to_contain_text('BUKTI PEMBAYARAN SIMULASI');assert not ACADEMIC.search(page.get_by_role('dialog').inner_text());page.screenshot(path=str(OUT/'sandbox-receipt.png'),full_page=True)
 assert len(requests)==demo_requests,'Demo must not make backend requests'
 assert not errors,errors
 context.close();browser.close()
report={'mode':'chromium-public-and-demo-with-intercepted-supabase','route_viewport_checks':len(checks),'checks':checks,'javascript_errors':errors,'cloud_mutations':0,'sandbox_disclosures_preserved':True,'academic_matches':0}
(OUT/'content-browser-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:report[key] for key in ['route_viewport_checks','javascript_errors','academic_matches','cloud_mutations','sandbox_disclosures_preserved']}))
