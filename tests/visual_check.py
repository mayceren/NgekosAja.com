"""Route, responsive layout, resources and actual presentation screenshots."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'screenshots';OUT.mkdir(exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5500');parser.add_argument('--screenshots-only',action='store_true');args=parser.parse_args()
errors=[];failures=[];screens=[];checks=0
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':1440,'height':900},locale='id-ID',timezone_id='Asia/Jakarta')
 page.add_init_script("localStorage.setItem('ngekosaja.mode.v3','demo')")
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('requestfailed',lambda r:failures.append(str(r.failure)+' '+r.url))
 page.on('response',lambda r:failures.append(f'{r.status} {r.url}') if r.status>=400 else None)
 page.goto(args.url);page.evaluate('localStorage.clear()');page.reload();page.wait_for_function('window.NK && NK.state().version===2');page.evaluate('document.fonts.ready')
 def route(path):page.evaluate('(path)=>NK.navigate(path)',path);page.wait_for_timeout(65)
 def role(name,identity=''):
  page.evaluate('(x)=>{NK.setRole(x[0],x[1]);NK.selectedConversation="";NK.pagination={};}',[name,identity or ('o1' if name=='owner' else 't1' if name=='tenant' else '')])
 def shot(name,full=False):
  page.wait_for_timeout(90);page.screenshot(path=str(OUT/(name+'.png')),full_page=full,animations='disabled');screens.append(name+'.png')
 route('');shot('homepage')
 # Reveal every section via actual scrolling before the full-page capture.
 height=page.evaluate('document.body.scrollHeight')
 for y in range(0,height,650):page.evaluate('(y)=>window.scrollTo(0,y)',y);page.wait_for_timeout(35)
 page.evaluate('window.scrollTo(0,0)');shot('homepage-full',True)
 route('marketplace');shot('marketplace');route('property/p1');shot('property-detail');route('login');shot('login')
 role('owner');route('owner');shot('owner-dashboard')
 for path,name in [('properties','property-management'),('rooms','room-management'),('tenants','tenant-management'),('reports','financial-report'),('complaints','complaint-management'),('chat','chat'),('boost','boost-listing')]:route('owner/'+path);shot(name)
 route('owner/complaints');page.locator('[data-action=ticket-detail][data-id=c1]').click();expect(page.locator('.analysis-panel')).to_be_visible();shot('complaint-analysis');page.locator('.modal [data-action=close-modal]').first.click()
 role('tenant');route('tenant');shot('tenant-dashboard');route('checkout/inv-0-0');shot('payment-checkout')
 page.locator('#checkout-form [type=submit]').click();page.locator('[data-action=process-payment][data-result=success]').click();page.wait_for_timeout(100);shot('payment-success')
 role('admin');route('admin');shot('platform-admin')
 role('guest');route('');page.set_viewport_size({'width':390,'height':844});shot('mobile-homepage');shot('mobile-homepage-full',True)
 role('tenant');route('tenant');shot('mobile-tenant-dashboard')
 # Every route is rendered under the proper role at every required viewport.
 routes={
  'guest':['','marketplace','property/p1','favorites','compare','login','register','forgot','fitur','tentang','untuk-pemilik','help','privacy','chat','account/settings'],
  'owner':['owner','owner/activity','owner/properties','owner/rooms','owner/tenants','owner/payments','owner/transactions','owner/reports','owner/complaints','owner/chat','owner/boost','owner/notifications','owner/settings'],
  'tenant':['tenant','tenant/home','tenant/bills','tenant/history','tenant/complaints','tenant/chat','tenant/notifications','tenant/favorites','tenant/settings','checkout/inv-0-1'],
  'admin':['admin','admin/users','admin/listings','admin/transactions','admin/complaints','admin/campaigns','admin/settings']
 }
 # Restore unpaid checkout for the active tenant so checkout is checked too.
 page.evaluate('NK.reset()')
 routes['tenant'][-1]='checkout/inv-0-0'
 for width in ([] if args.screenshots_only else [1920,1440,1280,1024,768,390,360,320]):
  page.set_viewport_size({'width':width,'height':900 if width>=768 else 844})
  for r,paths in routes.items():
   role(r)
   for path in paths:
    route(path);checks+=1
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1'),f'Document overflow {width}: {path}'
    assert page.locator('main').count(),f'Missing main {path}'
    assert not page.get_by_text('Halaman ini tidak dapat dibuka.',exact=True).count(),f'Broken route {path}'
    if path=='':
     for selector in ['.hero h1 em','#hero-search','.hero-search button','.nav-actions']:
      box=page.locator(selector).bounding_box();assert box['x']>=-1 and box['x']+box['width']<=width+1,f'Clipped {selector} at {width}'
  print('Responsive routes passed at',width,flush=True)
 # Mobile dialogs, keyboard focus and sidebar behavior are checked separately.
 page.set_viewport_size({'width':320,'height':760});role('owner');route('owner');page.locator('.dashboard-header [data-action=sidebar]').click();expect(page.locator('.sidebar-open')).to_be_visible();page.locator('.sidebar-backdrop').click(position={'x':300,'y':300})
 page.locator('[data-action=add-invoice]').click();box=page.locator('.modal').bounding_box();assert box['x']>=0 and box['x']+box['width']<=320;assert page.locator('.modal').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');page.keyboard.press('Escape');expect(page.locator('.modal')).to_have_count(0)
 page.set_viewport_size({'width':1440,'height':900});route('owner');page.locator('[data-action=collapse-sidebar]').click();expect(page.locator('.sidebar-collapsed')).to_be_visible();page.locator('[data-action=collapse-sidebar]').click()
 assert not errors,errors;assert not failures,failures
 result={'base_url':args.url,'responsive_route_checks':checks,'viewports':([1440,390,320] if args.screenshots_only else [1920,1440,1280,1024,768,390,360,320]),'screenshots':screens,'javascript_errors':errors,'resource_errors':failures}
 (ROOT/('tests/screenshot-results.json' if args.screenshots_only else 'tests/visual-results.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=True,indent=2));browser.close()
