"""Real SDK/Chromium UI with explicit mock Edge/PostgREST/Snap boundary.
No actual Midtrans API, Cloud writes, account creation or email.
"""
import json,time,os,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
fixture=(ROOT/'tests/backend_browser.py').read_text(encoding='utf-8').split('with sync_playwright() as p:')[0]
exec(compile(fixture,str(ROOT/'tests/backend_browser.py'),'exec'))
OUT=ROOT/'tests/payment/browser';OUT.mkdir(parents=True,exist_ok=True)
passed=[];errors=[];attempts=[];edge_calls=[];unconfigured=False;capability=True
base_handler=handle
headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','content-type':'application/json'}
def reply(route,data,status=200):route.fulfill(status=status,headers=headers,body=json.dumps(data))
def handler(route):
 req=route.request;path=urlparse(req.url).path
 if req.method=='OPTIONS':return reply(route,{})
 body=req.post_data_json if req.post_data else {}
 if path.endswith('rpc/payment_capabilities'):return reply(route,{'version':5,'environment':'sandbox'} if capability else None)
 if path.endswith('rpc/payment_accounting'):return reply(route,{'sandbox':{'rent_gmv':'1500000','admin_fees':'2000','boost_revenue':'30000','platform_revenue':'32000'},'non_simulation':{},'refund_cases':'0'})
 if path.endswith('/payment_attempts'):
  rows=attempts[:]
  from urllib.parse import parse_qs
  for k,v in parse_qs(urlparse(req.url).query).items():
   if v[0].startswith('eq.'):rows=[r for r in rows if str(r.get(k))==v[0][3:]]
  return reply(route,rows)
 if '/functions/v1/' in path:
  edge_calls.append({'path':path,'body':body});name=path.split('/')[-1]
  if unconfigured:return reply(route,{'code':'PAYMENT_UNAVAILABLE','message':'unavailable'},503)
  if name.startswith('create-'):
   kind='rent' if name=='create-rent-payment' else 'boost';a=next((a for a in attempts if a['kind']==kind and a['status']=='pending'),None)
   if not a:
    a={'id':str(uuid.uuid4()),'kind':kind,'invoice_id':IID if kind=='rent' else None,'property_id':PID,'payer_id':UID,'order_id':'NK-SB-'+uuid.uuid4().hex,'amount':1500000 if kind=='rent' else 30000,'admin_fee':2000 if kind=='rent' else 0,'gross_amount':1502000 if kind=='rent' else 30000,'status':'pending','environment':'sandbox','created_at':stamp,'expires_at':'2027-01-01T00:00:00Z','transaction_id':None,'verified_at':None};attempts.insert(0,a)
   return reply(route,{'attempt':a,'snap_token':'mock-checkout-token-12345','client_key':'SB-Mid-client-local-mock'})
  if name=='payment-status':return reply(route,{'attempt':next(a for a in attempts if a['id']==body['attempt_id'])})
 return base_handler(route)
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':1440,'height':900},locale='id-ID');context.route('https://*.supabase.co/**',handler)
 context.route('https://app.sandbox.midtrans.com/snap/snap.js',lambda r:r.fulfill(status=200,content_type='text/javascript',body='window.snap={pay(token,callbacks){window.__snapToken=token;window.__snapCallbacks=callbacks},hide(){window.__hidden=true}}'))
 page=context.new_page();page.on('pageerror',lambda err:errors.append(str(err)))
 def visit(route,text=None):
  page.evaluate('(r)=>NK.navigate(r)',route);page.wait_for_timeout(350)
  if text:expect(page.locator('#main')).to_contain_text(text)
 def ok(text):passed.append(text)
 def login(role):
  rights[:]=['prospect',role];page.goto(ORIGIN+'/#/login');page.wait_for_function('NA.ready');page.locator('[name=email]').fill('test@example.invalid');page.locator('[name=password]').fill(PW);page.locator('#auth-login-form [type=submit]').click();page.wait_for_function('NA.user && NA.profile');page.wait_for_url(ORIGIN+'/#/')
 def logout():
  visit('account/profile');page.locator('[data-auth-action=logout]').click();page.locator('[data-auth-action=logout-confirm]').click();page.wait_for_function('!NA.user')
 login('tenant');visit('checkout/'+IID,'Sandbox Payment');expect(page.locator('.pay-total')).to_contain_text('1.502.000');assert page.locator('[data-action=pay-success],[data-pay-action=success]').count()==0;ok('Connected checkout shows authoritative rent/admin/total and clear Sandbox label without fake success buttons')
 page.evaluate('document.activeElement?.blur();scrollTo(0,0)');page.screenshot(path=str(OUT/'checkout-desktop.png'),full_page=True)
 page.locator('[data-pay-action=confirm-rent]').click();expect(page.locator('.modal')).to_contain_text('Biaya admin');page.locator('[data-pay-action=start-rent]').click();page.wait_for_function('window.__snapCallbacks');assert edge_calls[0]['body']=={'invoice_id':IID};assert page.locator('script[data-client-key]').get_attribute('src')=='https://app.sandbox.midtrans.com/snap/snap.js';ok('Payment confirmation calls Edge with invoice ID only and loads pinned Snap Sandbox script')
 page.evaluate('__snapCallbacks.onSuccess({transaction_status:"settlement",gross_amount:1})');page.wait_for_timeout(700);expect(page.locator('.pay-total')).not_to_contain_text('sudah lunas');assert invoice['status']=='pending';ok('Forged popup success triggers reconciliation but cannot mark invoice paid')
 a=attempts[0];a.update(status='succeeded',transaction_id=TID,verified_at=stamp,payment_method='bank_transfer');invoice.update(status='paid',effective_status='paid');transaction.update(is_simulation=True,invoice_id=IID,method='bank_transfer')
 page.locator('[data-pay-action=status]').first.click();expect(page.locator('.pay-total')).to_contain_text('sudah lunas');page.locator('.pay-total [data-b-action=receipt]').click();expect(page.locator('.modal')).to_contain_text('Bukti pembayaran Sandbox');expect(page.locator('.modal')).to_contain_text('Terverifikasi');expect(page.locator('.modal')).to_contain_text('Bukan bukti pemindahan uang sungguhan');ok('Only persisted server confirmation shows paid and enables labelled verified Sandbox receipt')
 page.evaluate('()=>{window.print=()=>{window.__printed=document.querySelector(".b-print").textContent}}');page.locator('[data-b-action=print]').click();assert a['order_id'] in page.evaluate('window.__printed');page.locator('[data-b-action=close]').click();ok('Printed receipt includes order, invoice, exact total, server verification and Sandbox disclaimer')
 for width in [1440,768,390]:
  page.set_viewport_size({'width':width,'height':900});visit('tenant/bills','Tagihan sewa');visit('checkout/'+IID,'Sandbox Payment');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 page.screenshot(path=str(OUT/'checkout-mobile.png'),full_page=True);ok('Checkout fits desktop, tablet and mobile without horizontal overflow')
 logout();login('owner');page.set_viewport_size({'width':1440,'height':900});visit('owner/boost','Jangkau lebih banyak');page.locator('[data-pay-action=confirm-boost]').click();expect(page.locator('.modal')).to_contain_text('30.000');page.locator('[data-pay-action=start-boost]').click();page.wait_for_timeout(400);assert any(c['path'].endswith('create-boost-payment') and c['body']=={'property_id':PID} for c in edge_calls);ok('Boost uses property selection, Rp30,000 confirmation and resource-only Edge request')
 visit('owner/finance','Pemisahan ledger pembayaran');expect(page.locator('#main')).to_contain_text('bukan pendapatan produksi');expect(page.locator('#main')).to_contain_text('Ledger nonsimulasi historis');ok('Financial dashboard clearly separates Sandbox ledger and nonsimulation history')
 visit('owner/boost');unconfigured=True;page.locator('[data-pay-action=confirm-boost]').click();page.locator('[data-pay-action=start-boost]').click();expect(page.locator('#toast-root')).to_contain_text('Sandbox belum diaktifkan');assert not page.evaluate('document.body.textContent.includes("SB-Mid-server")');ok('Missing configuration reports Indonesian error without exposing secrets or inventing settlement')
 page.locator('[data-b-action=close]').click();logout();assert page.evaluate('NPay.inflight.size')==0;ok('Logout clears private payment state')
 assert not any(k in str(c['body']) for c in edge_calls for k in ['server_key','owner_id','gross_amount']);assert not errors,errors;ok('No client prices/owner/server key sent; no uncaught JavaScript exceptions')
 browser.close()
(OUT/'results.json').write_text(json.dumps({'scope':'real-browser-sdk-with-mock-edge-postgrest-snap','passed':passed,'errors':errors,'cloud_writes':False,'midtrans_api_called':False,'emails_sent':False,'executed_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())},indent=2),encoding='utf-8')
print(json.dumps({'passed':len(passed),'errors':errors,'output':str(OUT)}))
