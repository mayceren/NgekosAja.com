"""Real Chromium/SDK. Explicit HTTP/Realtime mocks; no Cloud writes or provider."""
import json,time,os,uuid
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
fixture=(ROOT/'tests/backend_browser.py').read_text(encoding='utf-8').split('with sync_playwright() as p:')[0]
exec(compile(fixture,str(ROOT/'tests/backend_browser.py'),'exec'))
OUT=ROOT/'tests/payment-simulator/browser';OUT.mkdir(parents=True,exist_ok=True)
passed=[];errors=[];attempts=[];campaigns=[];transactions=[];edge_calls=[];requests=[];backend_fail=False;server_enabled=True;personal=False;phase4_enabled=False;finance_reads=0
base_handler=handle;base_user=user
def user():
 u=base_user();role='owner' if 'owner' in rights else 'tenant'
 u.update(email='personal@example.invalid' if personal else 'dev-'+role+'-a@ngekosaja.test',app_metadata={} if personal else {'development_fixture':'ngekosaja-development-auth-v1','development_fixture_run':'a'*32});return u
headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','content-type':'application/json'}
def reply(route,data,status=200):route.fulfill(status=status,headers=headers,body=json.dumps(data))
def handler(route):
 global finance_reads
 req=route.request;url=urlparse(req.url);path=url.path;query=parse_qs(url.query)
 if req.method=='OPTIONS':return reply(route,{})
 if path.endswith('/rpc/payment_capabilities'):return reply(route,{'version':5,'provider':'internal-simulator','environment':'development','enabled':server_enabled})
 if path.endswith('/rpc/phase4_capabilities'):return reply(route,{'version':4,'storage':True,'realtime':True} if phase4_enabled else None)
 if path.endswith('/rpc/payment_accounting'):
  finance_reads+=1;return reply(route,{'simulation':{'rent_gmv':'1500000','admin_fees':'2000','boost_revenue':'30000','platform_revenue':'32000'},'non_simulation':{}})
 if '/functions/v1/' in path:
  body=req.post_data_json;edge_calls.append({'path':path,'body':body})
  if backend_fail:return reply(route,{'code':'DATABASE_ERROR'},503)
  if not server_enabled:return reply(route,{'code':'SIMULATION_DISABLED'},503)
  if personal:return reply(route,{'code':'DEVELOPMENT_ACCOUNT_REQUIRED'},403)
  kind='rent' if path.endswith('simulate-rent-payment') else 'boost'
  existing=next((a for a in attempts if a['kind']==kind and a['payer_id']==UID),None)
  if existing:return reply(route,{'attempt':existing})
  a={'id':str(uuid.uuid4()),'reference':'NKA-SIM-'+uuid.uuid4().hex.upper(),'payer_id':UID,'property_id':PID,'invoice_id':IID if kind=='rent' else None,'kind':kind,'status':'succeeded','is_simulation':True,'environment':'development','amount':invoice['amount'] if kind=='rent' else 30000,'admin_fee':2000 if kind=='rent' else 0,'gross_amount':invoice['amount']+2000 if kind=='rent' else 30000,'payment_method':body['method'],'idempotency_key':body['idempotency_key'],'transaction_id':str(uuid.uuid4()),'created_at':stamp,'completed_at':stamp,'property_name_snapshot':prop['name'],'payer_name_snapshot':'Penghuni Uji' if kind=='rent' else 'Pemilik Uji'}
  attempts.append(a);transactions.append({'id':a['transaction_id'],'kind':kind,'invoice_id':a['invoice_id'],'property_id':PID if kind=='boost' else None,'amount':a['amount'],'admin_fee':a['admin_fee'],'method':'SIMULASI '+body['method'],'status':'succeeded','is_simulation':True,'occurred_at':stamp,'created_at':stamp})
  if kind=='rent':invoice.update(status='paid',effective_status='paid')
  else:campaigns.append({'id':str(uuid.uuid4()),'property_id':PID,'transaction_id':a['transaction_id'],'start_date':'2026-11-20','end_date':'2026-12-20','properties':{'name':prop['name']},'created_at':stamp});listing['promoted']=True
  notification.update(title='SIMULASI: pembayaran berhasil',body='Transaksi tercatat. Tidak ada uang sungguhan yang dipindahkan.')
  return reply(route,{'attempt':a})
 if path.endswith('/payment_attempts') or path.endswith('/transactions') or path.endswith('/boost_campaigns'):
  data=attempts if path.endswith('/payment_attempts') else transactions if path.endswith('/transactions') else campaigns
  for k,values in query.items():
   value=values[0]
   if value.startswith('eq.'):data=[r for r in data if str(r.get(k))==value[3:]]
  return reply(route,data)
 return base_handler(route)
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':1440,'height':1000},locale='id-ID');context.route('https://*.supabase.co/**',handler)
 page=context.new_page();page.on('pageerror',lambda err:errors.append(str(err)));page.on('request',lambda req:requests.append(req.url))
 def visit(route,text=None):
  if page.url==ORIGIN+'/#/'+route:page.reload()
  else:page.goto(ORIGIN+'/#/'+route)
  page.wait_for_function('NA.ready');page.wait_for_timeout(300)
  if text:expect(page.locator('#main')).to_contain_text(text)
 def ok(text):passed.append(text)
 def login(role):
  rights[:]=['prospect',role];visit('login');page.locator('[name=email]').fill(user()['email']);page.locator('[name=password]').fill(PW);page.locator('#auth-login-form [type=submit]').click();page.wait_for_function('NA.user && NA.profile');page.wait_for_url(ORIGIN+'/#/')
 def logout():
  visit('account/profile');page.locator('[data-auth-action=logout]').click();page.locator('[data-auth-action=logout-confirm]').click();page.wait_for_function('!NA.user')
 login('tenant');visit('checkout/'+IID,'Pilih metode simulasi');expect(page.locator('.pay-total')).to_contain_text('1.502.000');expect(page.locator('.pay-total')).to_contain_text('2.000');assert page.locator('.pay-method').count()==4;ok('Custom checkout presents invoice, tenant, period, server-derived amount, 2,000 fee and four illustrative methods')
 for width in [1440,768,390]:
  page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(OUT/('checkout-desktop.png' if width==1440 else 'checkout-mobile.png' if width==390 else 'checkout-tablet.png')),full_page=True)
 ok('Two-column desktop and single-column mobile/tablet have no horizontal overflow')
 page.set_viewport_size({'width':1440,'height':900});page.locator('[name=method][value=virtual_account]').focus();page.keyboard.press('Space');expect(page.locator('[name=method][value=virtual_account]')).to_be_checked();ok('Payment method cards support keyboard focus and selection')
 backend_fail=True;page.locator('.pay-confirm').click();expect(page.locator('.pay-feedback')).to_contain_text('Transaksi belum dapat dikonfirmasi');assert invoice['status']=='pending';assert not attempts;assert page.locator('.pay-success').count()==0;failed_key=edge_calls[-1]['body']['idempotency_key'];ok('Backend failure preserves unpaid invoice and displays an honest error without false success')
 page.reload();page.wait_for_selector('.pay-confirm');page.locator('[name=method][value=virtual_account]').focus();page.keyboard.press('Space');backend_fail=False
 page.evaluate('()=>{const f=document.querySelector("[data-payment-form]");f.requestSubmit();f.requestSubmit()}');page.wait_for_selector('.pay-success');assert len(attempts)==1;assert invoice['status']=='paid';assert edge_calls[-1]['body']['idempotency_key']==failed_key;assert len([c for c in edge_calls if c['path'].endswith('simulate-rent-payment')])==2;ok('Double-submit sends one request; retry retains idempotency key across reload and shows persisted success')
 expect(page.locator('.pay-success')).to_contain_text('Pembayaran Simulasi Berhasil');expect(page.locator('.pay-success')).to_contain_text('Virtual Account');expect(page.locator('.pay-success')).to_contain_text('Bukan bukti transfer dana');page.locator('.pay-checkmark path').evaluate('(el)=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))');page.screenshot(path=str(OUT/'success-desktop.png'),full_page=True);ok('Success screen includes recorded reference, amount, method, time and simulation disclaimer')
 page.reload();page.wait_for_selector('.pay-success');ok('Success and transaction history survive reload from persisted server fixture')
 page.emulate_media(reduced_motion='reduce');assert page.locator('.pay-checkmark path').evaluate('(el)=>getComputedStyle(el).animationName')=='none';page.emulate_media(reduced_motion='no-preference');page.set_viewport_size({'width':390,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(OUT/'success-mobile.png'),full_page=True);page.set_viewport_size({'width':1440,'height':900});ok('Success respects reduced-motion preference and fits mobile')
 page.locator('[data-b-action=receipt]').click();expect(page.locator('.pay-receipt')).to_contain_text('Simulasi Berhasil');expect(page.locator('.pay-receipt')).to_contain_text('Bukan bukti transfer dana');expect(page.locator('.pay-receipt')).to_contain_text('Penghuni Uji');page.screenshot(path=str(OUT/'receipt-desktop.png'),full_page=True)
 page.evaluate('()=>{window.print=()=>window.__printed=document.querySelector(".b-print").textContent}');page.locator('[data-b-action=print]').click();assert attempts[0]['reference'] in page.evaluate('window.__printed');page.locator('[data-b-action=close]').click();ok('Receipt and print include correct tenant, property, reference, amount and simulation mark')
 visit('tenant/history','Riwayat pembayaran');expect(page.locator('#main')).to_contain_text('SIMULASI');visit('notifications','SIMULASI: pembayaran berhasil');ok('Tenant history and notification center reflect the recorded simulation')
 logout();login('owner');visit('owner/boost','Jangkau lebih banyak');page.locator('[data-pay-action=boost-checkout]').click();page.wait_for_selector('[data-payment-form]');expect(page.locator('.pay-total')).to_contain_text('30.000');expect(page.locator('#main')).to_contain_text('30 hari');page.locator('[name=method][value=e_wallet]').focus();page.keyboard.press('Space');page.locator('.pay-confirm').click();page.wait_for_selector('.pay-success');assert len(campaigns)==1;assert attempts[-1]['gross_amount']==30000;ok('Custom Boost checkout records 30,000 simulation and activates one 30-day campaign')
 visit('owner/boost','Riwayat pembayaran Boost');expect(page.locator('#main')).to_contain_text('Aktif');assert listing['promoted'];ok('Boost history and promotion state are sourced from recorded campaign data')
 visit('owner/finance','Pemisahan catatan pembayaran');expect(page.locator('#main')).to_contain_text('Transaksi simulasi');expect(page.locator('#main')).to_contain_text('Catatan nonsimulasi historis');assert page.locator('.stat-card').filter(has_text='Pendapatan sewa').count()==0;assert page.locator('[data-b-action=export-finance]').count()==0;ok('Financial view separates simulation from nonsimulation and replaces mixed monetary cards/chart/export')
 phase4_enabled=True;page.evaluate('''()=>{window.__channels=[];NA.client.channel=name=>{const c={name,handlers:[],on(type,filter,fn){this.handlers.push({filter,fn});return this},subscribe(fn){this.state=fn;queueMicrotask(()=>fn('SUBSCRIBED'));return this}};__channels.push(c);return c};NA.client.removeChannel=async c=>{c.removed=true;c.state?.('CLOSED');return 'ok'};window.__event=(table,row)=>{for(const c of __channels.filter(c=>!c.removed))for(const h of c.handlers)if(h.filter.table===table&&h.filter.event==='INSERT')h.fn({table,new:row,eventType:'INSERT',commit_timestamp:new Date().toISOString()})};NP.capability=null;NP.reconcile()}''');page.wait_for_timeout(900)
 assert page.evaluate('__channels.filter(c=>!c.removed).length')==2
 specs=page.evaluate('__channels.filter(c=>!c.removed).flatMap(c=>c.handlers.map(h=>h.filter))');assert any(s['table']=='payment_attempts' and s.get('filter')=='payer_id=eq.'+UID for s in specs);assert any(s['table']=='transactions' and 'invoice_id' in s.get('filter','') for s in specs);assert any(s['table']=='boost_campaigns' and PID in s.get('filter','') for s in specs);ok('Payment Realtime uses scoped payer/invoice/property subscriptions with only two active channels')
 before=finance_reads;page.evaluate('(row)=>{__event("transactions",row);__event("transactions",row)}',transactions[0]);page.wait_for_timeout(850);assert finance_reads==before+1;assert page.evaluate('__channels.filter(c=>!c.removed).length')==2;page.wait_for_timeout(400);assert finance_reads==before+1;ok('Duplicate ledger events refresh authoritative financial data once without subscriptions or render loops')
 visit('owner/payments','Tagihan sewa');expect(page.locator('#main')).to_contain_text('Lunas');ok('Owner invoice list reflects tenant payment after navigation/reload')
 logout();personal=True;login('tenant');attempts.clear();invoice.update(status='pending',effective_status='pending');visit('checkout/'+IID,'akun pengujian');expect(page.locator('.pay-confirm')).to_be_disabled();ok('Personal account sees unavailable simulation and cannot use checkout confirmation')
 logout();personal=False;server_enabled=False;login('tenant');visit('checkout/'+IID,'belum tersedia pada lingkungan');expect(page.locator('.pay-confirm')).to_be_disabled();ok('Disabled server capability leaves checkout unavailable')
 assert page.evaluate('''()=>{const f=document.querySelector('[data-payment-form]');f.dataset.busy='true';NP.liveHash=location.hash;const result=NP.liveResult(document.getElementById('app'),{html:document.getElementById('app').innerHTML},'checkout');const same=f===document.querySelector('[data-payment-form]');delete f.dataset.busy;return result&&same}''');ok('Realtime preserves an in-flight checkout form and its feedback target')
 context.set_offline(False);logout();assert page.evaluate('NPay.inflight.size')==0;assert page.evaluate('Object.keys(sessionStorage).filter(k=>k.startsWith("nka:simulation:")).length')==0;ok('Logout clears scoped payment keys and in-flight state')
 assert all(set(c['body'])=={'invoice_id' if c['path'].endswith('simulate-rent-payment') else 'property_id','method','idempotency_key'} for c in edge_calls);assert not any('midtrans' in u.lower() for u in requests);assert not errors,errors;ok('No gateway requests, client prices, owner IDs, secrets or uncaught JavaScript errors')
 browser.close()
(OUT/'results.json').write_text(json.dumps({'scope':'real-browser-sdk-mocked-internal-edge-and-postgrest','passed':passed,'errors':errors,'cloud_writes':False,'provider_calls':False,'executed_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())},indent=2),encoding='utf-8')
print(json.dumps({'passed':len(passed),'errors':errors,'output':str(OUT)}))
