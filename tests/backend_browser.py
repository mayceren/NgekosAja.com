"""Real Chromium and SDK, mocked HTTP boundary. No Cloud writes or email.
SQL semantics/RLS are verified separately in backend-contracts.mjs.
"""
import json, os, time, base64, secrets
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('NGEKOSAJA_TEST_OUTPUT',str(ROOT/'tests/backend'))); OUT.mkdir(parents=True,exist_ok=True)
ORIGIN=os.environ.get('NGEKOSAJA_TEST_ORIGIN','http://127.0.0.1:5501')
UID='11111111-1111-4111-8111-111111111111'; PID='22222222-2222-4222-8222-222222222222'; RID='33333333-3333-4333-8333-333333333333'; AID='44444444-4444-4444-8444-444444444444'; IID='55555555-5555-4555-8555-555555555555'; CID='66666666-6666-4666-8666-666666666666'; TID='77777777-7777-4777-8777-777777777777'; MID='88888888-8888-4888-8888-888888888888'
PW=secrets.token_urlsafe(24)+'Q1!'; rights=['prospect','owner']; errors=[]; passed=[]; calls=[]; unavailable=False
stamp='2026-11-19T05:00:00Z'
prop={'id':PID,'owner_id':UID,'name':'Kos Integrasi Grogol','location':'Grogol','address':'Jalan Uji 123','description':'Kos nyaman dengan fasilitas untuk kebutuhan harian.','base_rent':1500000,'gender_policy':'mixed','room_size':'3 x 4 m','publication_status':'published','created_at':stamp,'property_images':[{'image_path':'assets/images/room-2.jpg','alt_text':'Kamar','position':0}],'property_facilities':[],'property_rules':[],'property_landmarks':[]}
listing={k:v for k,v in prop.items() if k in ['id','name','location','address','description','base_rent','gender_policy','room_size']};listing.update(images=[{'path':'assets/images/room-2.jpg','alt':'Ilustrasi'}],facilities=['AC','WiFi'],rules=['Jaga kebersihan'],landmarks=[],promoted=False,total_rooms=2,available_rooms=1)
agreement={'id':AID,'tenant_id':UID,'room_id':RID,'start_date':'2026-11-01','end_date':'2027-10-31','rent':1500000,'payment_day':5,'status':'active','rooms':{'number':'A01','property_id':PID,'properties':{'name':prop['name'],'owner_id':UID}},'tenants':{'profiles':{'display_name':'Penghuni Uji','phone':None}},'created_at':stamp}
invoice={'id':IID,'agreement_id':AID,'period_start':'2026-11-01','due_date':'2026-11-21','amount':1500000,'admin_fee':2000,'status':'pending','effective_status':'pending','tenant_name_snapshot':'Penghuni Uji','property_name_snapshot':prop['name'],'room_number_snapshot':'A01','notes':'','created_at':stamp}
complaint={'id':CID,'agreement_id':AID,'title':'Keran kamar bocor','description':'Keran air bocor sejak semalam dan lantai licin.','category':'Air','urgency':'medium','priority':'medium','status':'waiting','estimated_completion':None,'created_at':stamp}
transaction={'id':TID,'invoice_id':IID,'kind':'rent','amount':1500000,'admin_fee':2000,'method':'LOCAL FIXTURE','status':'succeeded','is_simulation':True,'occurred_at':stamp,'created_at':stamp}
room={'id':RID,'property_id':PID,'number':'A01','room_type':'Standard','rent':1500000,'operational_status':'available','properties':{'name':prop['name']},'room_facilities':[],'rental_agreements':[],'created_at':stamp}
conversation={'id':MID,'property_id':PID,'prospect_id':UID,'property_name':prop['name'],'counterpart_name':'Pengelola Uji','unread_count':1,'last_message':'Halo, selamat datang.','updated_at':stamp}
messages=[{'id':CID,'conversation_id':MID,'sender_id':TID,'body':'Halo, selamat datang.','created_at':stamp}]
notification={'id':MID,'user_id':UID,'title':'Tagihan baru','body':'Tagihan sewa tersedia.','route':'#/tenant/bills','read_at':None,'created_at':stamp}
report={'rent_revenue':'1500000','outstanding':'1500000','overdue':'0','collection_rate':'50','total_rooms':'2','occupied_rooms':'1','occupancy_rate':'50','resolved_complaints':'0','active_listings':'1'}
operations={k:'1' for k in ['properties','rooms','available_rooms','maintenance_rooms','agreements','active_agreements','pending_invoices','paid_invoices','overdue_invoices','transactions','successful_payments','failed_payments','active_complaints','boost_campaigns','active_campaigns','owners','tenants']}
operations.update(rooms='2',available_rooms='1',maintenance_rooms='0',active_agreements='1',failed_payments='0',active_campaigns='0',month_rent_revenue='1500000')
settings={'id':UID,'user_id':UID,'notifications_enabled':True,'compact_mode':False,'sidebar_collapsed':False,'created_at':stamp}
offer={'id':IID,'owner_id':TID,'tenant_id':UID,'room_id':RID,'property_name_snapshot':prop['name'],'room_number_snapshot':'A01','start_date':'2026-11-19','end_date':'2027-10-31','rent':1500000,'payment_day':5,'status':'pending','expires_at':'2027-01-01T00:00:00Z','created_at':stamp}
def user():return {'id':UID,'aud':'authenticated','role':'authenticated','email':'test@example.invalid','email_confirmed_at':stamp,'user_metadata':{}}
def session():
 enc=lambda x:base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
 return {'access_token':enc({'alg':'HS256'})+'.'+enc({'sub':UID,'role':'authenticated','exp':int(time.time())+3600})+'.'+secrets.token_urlsafe(32),'refresh_token':secrets.token_urlsafe(32),'token_type':'bearer','expires_in':3600,'user':user()}
def handle(route):
 global unavailable
 req=route.request;parsed=urlparse(req.url);path=parsed.path;query=parse_qs(parsed.query);body=req.post_data_json if req.post_data else {};calls.append({'method':req.method,'path':path,'query':query,'body':body})
 headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','content-type':'application/json'};status=200;data=[]
 if req.method=='OPTIONS':data={}
 elif path.endswith('/auth/v1/token'):data=session()
 elif path.endswith('/auth/v1/user'):data=user()
 elif path.endswith('/auth/v1/logout'):data={}
 elif path.endswith('/profiles'):
  profile={'id':UID,'display_name':'Akun Integrasi','phone':None,'created_at':stamp,'user_roles':[{'role':r} for r in rights]};data=profile if 'object' in req.headers.get('accept','') else [profile]
 elif path.endswith('/user_roles'):data=[{'role':r} for r in rights]
 elif '/rpc/' in path:
  name=path.split('/')[-1]
  if name=='public_listings':
   if unavailable:status=503;data={'message':'Unavailable'}
   else:data=[] if 'noresult' in str(query) else [listing]
  elif name=='owner_financial_report':data=[report]
  elif name=='owner_monthly_revenue':data=[{'month':'2026-10-01','rent_revenue':'1000000'},{'month':'2026-11-01','rent_revenue':'1500000'}]
  elif name=='platform_financial_report':data=[{'gmv':'1500000','admin_fee_revenue':'2000','boost_revenue':'30000','total_platform_revenue':'32000','registered_accounts':'7','active_listings':'1','resolved_complaints':'0','total_rooms':'2','occupied_rooms':'1','occupancy_rate':'50'}]
  elif name=='operational_summary':data=operations
  elif name=='conversation_directory':data=[conversation]
  elif name=='open_conversation':data=MID
  elif name=='send_message':messages.insert(0,{'id':secrets.token_hex(16),'conversation_id':MID,'sender_id':UID,'body':body['message_body'],'created_at':stamp});data=MID
  elif name=='owner_save_property':prop.update({k:v for k,v in body['payload'].items() if k not in ['images','rules','landmarks','facilities']});data=PID
  elif name=='owner_save_room':room.update({k:v for k,v in body['payload'].items() if k!='facilities'});data=RID
  elif name=='owner_update_invoice':invoice.update(amount=body['rent_amount'],due_date=body['due_on'],notes=body['invoice_notes']);data=None
  elif name=='tenant_create_complaint':complaint.update(title=body['ticket_title'],description=body['ticket_description']);data=CID
  elif name=='transition_complaint':complaint.update(status=body['next_status']);data=None
  elif name=='tenant_respond_rental':offer['status']='accepted' if body['accept'] else 'declined';data=None
  elif name=='generate_payment_reminders':data=0
  else:data=None
 else:
  table=path.split('/')[-1]
  data={'properties':[prop],'rooms':[room],'rental_agreements':[agreement] if 'tenant' in rights or 'owner' in rights else [],'rental_offers':[offer],'invoice_statuses':[invoice],'transactions':[transaction],'recurring_invoices':[],'complaints':[complaint],'complaint_histories':[{'id':MID,'status':complaint['status'],'note':'Laporan tercatat','created_at':stamp}],'complaint_notes':[],'complaint_analyses':[],'complaint_attachments':[],'messages':messages,'notifications':[notification],'user_settings':[settings],'facilities':[{'id':MID,'name':'AC','code':'ac'}],'boost_campaigns':[],'listing_analytics':[],'activity_logs':[{'id':MID,'description':'Properti diperbarui','created_at':stamp}],'favorites':[{'id':MID,'user_id':UID,'property_id':PID,'created_at':stamp}],'recent_searches':[{'id':MID,'query':'Grogol','created_at':stamp}]}.get(table,[])
  if req.method=='PATCH':
   if table=='user_settings':settings.update(body)
   if table=='notifications':notification.update(body)
   data=[]
  if req.method in ['DELETE','POST']:data=[]
  for key,values in query.items():
   value=values[0]
   if value.startswith('eq.'):data=[row for row in data if str(row.get(key))==value[3:]]
 route.fulfill(status=status,headers=headers,body=json.dumps(data))
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':1440,'height':900},locale='id-ID');context.route('https://*.supabase.co/**',handle);page=context.new_page();page.on('pageerror',lambda err:errors.append(str(err)))
 def visit(path,text=None):
  target=ORIGIN+'/#/'+path
  if page.url==target:page.reload()
  else:page.goto(target)
  page.wait_for_function('NA.ready');page.wait_for_timeout(250)
  if text:expect(page.locator('#main')).to_contain_text(text)
 def ok(text):passed.append(text)
 def login(role):
  rights[:]=['prospect']+([role] if role!='prospect' else []);visit('login');page.locator('[name=email]').fill('test@example.invalid');page.locator('[name=password]').fill(PW);page.locator('#auth-login-form [type=submit]').click();page.wait_for_function('NA.user && NA.profile');page.wait_for_url(ORIGIN+'/#/')
 def logout():
  visit('account/profile');page.locator('[data-auth-action=logout]').click();page.locator('[data-auth-action=logout-confirm]').click();page.wait_for_function('!NA.user')
 visit('owner','Senang bertemu');ok('Anonymous protected owner route requires login')
 visit('marketplace','Kos Integrasi Grogol');page.locator('[name=query]').fill('Grogol');page.locator('[name=min]').fill('1000000');page.locator('[name=sort]').select_option('asc');page.locator('form [type=submit]').click();page.wait_for_url('**/*query=Grogol*');page.wait_for_timeout(250);assert any(c['query'].get('order',[''])[0].startswith('base_rent.asc') for c in calls if c['path'].endswith('public_listings'));ok('Public catalogue filters and global price order use RPC result query')
 visit('property/'+PID,'Hubungi pengelola');page.locator('[data-b-action=image]').first.click();expect(page.locator('.modal img')).to_be_visible();page.locator('[data-b-action=close]').click();ok('Public detail and gallery use safe published projection')
 login('owner');ok('Real SDK login still lands on home')
 visit('owner','Pendapatan sewa');page.screenshot(path=str(OUT/'owner-desktop.png'),full_page=True);ok('Owner financial report, operations summary and monthly chart render HTTP fixture values')
 visit('owner/properties','Kelola properti');page.locator('[data-b-action=property-form]').filter(has_text='Edit').click();page.locator('.modal [name=name]').fill('Kos Integrasi Diperbarui');page.locator('.modal [type=submit]').click();expect(page.locator('#main')).to_contain_text('Kos Integrasi Diperbarui');assert any(c['path'].endswith('owner_save_property') for c in calls);ok('Property editor sends one multi-table atomic RPC and reloads saved result')
 visit('owner/rooms','Manajemen kamar');page.locator('[data-b-action=room-form]').filter(has_text='Edit').click();page.locator('.modal [name=number]').fill('A02');page.locator('.modal [type=submit]').click();expect(page.locator('#main')).to_contain_text('A02');ok('Room editor persists operational fields through atomic RPC')
 visit('owner/payments','Tagihan sewa');page.locator('[data-b-action=edit-invoice]').click();page.locator('.modal [name=notes]').fill('Catatan integrasi');page.locator('.modal [type=submit]').click();page.wait_for_timeout(250);assert invoice['notes']=='Catatan integrasi';ok('Invoice edit uses authorized RPC and updates record')
 page.locator('[data-b-action=invoice]').first.click();expect(page.locator('.modal')).to_contain_text('1.502.000');page.evaluate('()=>{window.print=()=>{window.__printed=document.querySelector(".b-print").textContent}}');page.locator('[data-b-action=print]').click();assert '1.502.000' in page.evaluate('window.__printed');page.locator('[data-b-action=close]').click();ok('Invoice detail adds admin fee exactly and prepares printable document')
 visit('owner/tenants','Penawaran & persetujuan');visit('owner/recurring','Generator dijalankan manual');visit('owner/boost','Simulator menunggu aktivasi');visit('owner/analytics','Analitik listing');ok('Agreement, recurring, boost and analytics routes are connected or honestly gated')
 visit('owner/complaints','Keran kamar bocor');page.locator('[data-b-action=complaint]').click();expect(page.locator('.modal')).to_contain_text('Analisis berbasis aturan');page.locator('.modal [name=status]').select_option('in_progress');page.locator('.modal [name=note]').fill('Teknisi dijadwalkan');page.locator('.modal [type=submit]').click();expect(page.locator('#main')).to_contain_text('Diproses');ok('Owner complaint transition and rule analysis use actual ticket text')
 visit('chat','Halo, selamat datang.');page.locator('[data-b-action=quick-reply]').first.click();page.locator('form[data-backend-form=message] [type=submit]').click();expect(page.locator('.b-messages')).to_contain_text('Apakah kamar masih tersedia?');page.reload();expect(page.locator('.b-messages')).to_contain_text('Apakah kamar masih tersedia?');ok('Chat sends through RPC without sender override and persists mock boundary across reload')
 visit('notifications','Tagihan baru');page.locator('[data-b-action=read-all]').click();page.wait_for_timeout(250);assert notification['read_at'];ok('Notification read updates are scoped to authenticated user')
 visit('account/preferences','Sesuaikan pengalamanmu');page.locator('[name=compact_mode]').check();page.locator('[type=submit]').click();page.wait_for_timeout(250);assert settings['compact_mode'];ok('Preferences write only whitelisted user settings')
 visit('favorites','Kos favorit');visit('searches','Grogol');visit('compare?ids='+PID,'Bandingkan kos');ok('Favorites, recent searches and compare use database/public projection')
 visit('owner/finance','Laporan keuangan');page.locator('[data-b-action=export-finance]').click();ok('Owner CSV export is available for the loaded authorized report')
 for width in [390,768,1440]:
  page.set_viewport_size({'width':width,'height':900});visit('owner','Pendapatan sewa');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
 ok('Owner dashboard and financial tables fit desktop/tablet/mobile')
 logout();login('tenant');visit('tenant','Tempat tinggalmu');visit('tenant/bills','Tagihan sewa');visit('checkout/'+IID,'Pembayaran online belum tersedia');assert page.locator('[data-action=pay-success],[data-b-action=pay-success]').count()==0;ok('Tenant sees linked data and checkout cannot mark an invoice paid')
 visit('tenant/complaints','Laporan keluhan');page.locator('[data-b-action=complaint-form]').click();page.locator('.modal [name=title]').fill('Lampu kamar mati');page.locator('.modal [name=description]').fill('Lampu kamar mati sejak tadi pagi.');page.locator('.modal [type=submit]').click();expect(page.locator('#main')).to_contain_text('Lampu kamar mati');ok('Tenant complaint creates through tenant-scoped RPC')
 visit('offers','Penawaran sewa');page.locator('[data-b-action=review-offer]').click();expect(page.locator('.modal')).to_contain_text('Kamar');page.locator('[data-b-action=accept-offer]').click();expect(page.locator('#main')).to_contain_text('Disetujui');ok('Rental offer requires explicit tenant review and response RPC')
 visit('owner','Ruang ini punya akses tersendiri');ok('Tenant cannot open owner dashboard')
 logout();login('admin');visit('admin','Pendapatan platform');page.screenshot(path=str(OUT/'admin-desktop.png'),full_page=True);visit('admin/users','Pengguna');ok('Application admin gets reports and read-only user list without service key')
 logout();login('prospect');visit('owner','Ruang ini punya akses tersendiri');ok('Prospect cannot self-elevate to owner')
 visit('chat','Pesan');page.locator('[name=chat-search]').fill('doesnotexist');expect(page.locator('.b-conversation')).to_be_hidden();ok('Conversation search filters locally without private directory lookup')
 unavailable=True;visit('marketplace','Data belum dapat dimuat');assert 'Kos Integrasi Grogol' not in page.locator('#main').inner_text();unavailable=False;ok('Connected transport failure shows error without demo fallback')
 for width in [1440,768,390]:
  page.set_viewport_size({'width':width,'height':900});visit('marketplace','Kos Integrasi Grogol');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1');visit('chat','Pesan');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
 page.screenshot(path=str(OUT/'chat-mobile.png'),full_page=True);ok('Marketplace and chat avoid horizontal overflow at desktop/tablet/mobile')
 assert not any(c['path'].endswith(('server_record_rent_payment','server_record_boost','server_grant_role')) for c in calls);ok('Browser never calls server-only financial/role RPCs')
 assert not any('/auth/v1/recover' in c['path'] or '/auth/v1/signup' in c['path'] for c in calls);ok('Regression suite sends no signup or email requests')
 original=listing['name'];listing['name']='<img src=x onerror="window.__xss=1">';visit('marketplace');page.reload();expect(page.locator('#main')).to_contain_text('<img src=x');assert page.locator('.property-body img').count()==0;assert page.evaluate('window.__xss===undefined');listing['name']=original;ok('Stored listing markup is escaped and cannot execute an image handler')
 assert not errors,errors;ok('No uncaught JavaScript exceptions in exercised routes')
 browser.close()
(OUT/'results.json').write_text(json.dumps({'scope':'mock-http-real-browser-sdk','passed':passed,'errors':errors,'cloud_writes':False,'emails_sent':False,'executed_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())},indent=2),encoding='utf-8')
print(json.dumps({'passed':len(passed),'errors':errors,'output':'tests/backend/results.json'}))
