"""Real Chromium UI tests with a labelled fake HTTP Auth/PostgREST boundary.
No Cloud credentials, users or emails are created by this suite.
Real SDK + real DOM; mock results are deliberately separate from live-cloud QA.
"""
import json,time,secrets,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('NGEKOSAJA_TEST_OUTPUT',str(ROOT/'tests')));OUT.mkdir(parents=True,exist_ok=True)
ORIGIN=os.environ.get('NGEKOSAJA_TEST_ORIGIN','http://127.0.0.1:5500').rstrip('/')
passed=[];errors=[];calls=[]
PW,WRONG,UNVERIFIED,MISMATCH,UPDATED,RESET=[secrets.token_urlsafe(24)+'Qa1!' for _ in range(6)]
uid='11111111-1111-4111-8111-111111111111'
user={'id':uid,'aud':'authenticated','role':'authenticated','email':'qa@example.invalid','email_confirmed_at':'2026-01-01T00:00:00Z','user_metadata':{'display_name':'Metadata Bukan Profil','role':'admin'}}
rights=['prospect'];profile={'id':uid,'display_name':'Ruang QA','phone':None,'created_at':'2026-01-01T00:00:00Z'}
signup_mode='verify';mail_limited=False
def token():
 import base64
 enc=lambda v:base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
 return enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'sub':uid,'aud':'authenticated','role':'authenticated','exp':int(time.time())+3600})+'.'+secrets.token_urlsafe(32)
def session():return {'access_token':token(),'refresh_token':secrets.token_urlsafe(24),'token_type':'bearer','expires_in':3600,'expires_at':int(time.time())+3600,'user':user}
def handle(route):
 req=route.request;url=req.url;calls.append((req.method,url.split('?')[0]));body=req.post_data_json if req.post_data else {}
 headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','content-type':'application/json','x-supabase-api-version':'2024-01-01'}
 status=200;data={}
 if req.method=='OPTIONS':pass
 elif '/auth/v1/signup' in url:
  if signup_mode=='session':data=session()
  elif signup_mode=='duplicate':status=422;data={'error_code':'user_already_exists','msg':'User already registered'}
  elif signup_mode=='obfuscated':data={'user':{**user,'identities':[]},'session':None}
  else:data={'user':user,'session':None}
 elif '/auth/v1/token' in url:
  if 'grant_type=pkce' in url:assert body.get('code_verifier'),'PKCE must use the verifier from the initiating tab'
  if body.get('password')==WRONG:status=400;data={'code':400,'error_code':'invalid_credentials','msg':'Invalid login credentials'}
  elif body.get('password')==UNVERIFIED:status=400;data={'code':400,'error_code':'email_not_confirmed','msg':'Email not confirmed'}
  else:data=session()
 elif '/auth/v1/user' in url:data={**user,**({'new_email':body['email']} if body.get('email') else {})}
 elif '/auth/v1/recover' in url and mail_limited:status=429;data={'error_code':'over_email_send_rate_limit','msg':'Email rate limit exceeded'}
 elif '/auth/v1/logout' in url or '/auth/v1/recover' in url or '/auth/v1/resend' in url:data={}
 elif '/rest/v1/profiles' in url:
  if req.method=='PATCH':profile.update(body)
  data=profile
 elif '/rest/v1/user_roles' in url:data=[{'role':r} for r in rights]
 elif '/rest/v1/rental_agreements' in url:data=[{'id':'lease-qa','rent':1500000,'start_date':'2026-11-01','end_date':'2027-10-31','payment_day':5,'status':'active','rooms':{'number':'A01','properties':{'name':'Kos QA'}}}] if 'tenant' in rights else []
 elif '/rest/v1/rpc/public_listings' in url:data=[]
 elif '/rest/v1/rpc/owner_financial_report' in url or '/rest/v1/rpc/platform_financial_report' in url:data=[{}]
 elif '/rest/v1/rpc/operational_summary' in url:data={}
 elif '/rest/v1/' in url:data=[]
 else:status=404;data={}
 route.fulfill(status=status,headers=headers,body=json.dumps(data))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':1440,'height':900},locale='id-ID')
 context.route('https://*.supabase.co/**',handle)
 page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto(ORIGIN+'/#/login');page.wait_for_function('NA.ready')
 expect(page.locator('#auth-login-form')).to_be_visible();passed.append('Primary login uses real email/password UI and local official SDK')
 assert 'connected mode' not in page.locator('body').inner_text().lower();passed.append('Login does not expose the internal connection-mode label')
 page.screenshot(path=str(OUT/'auth-desktop.png'),full_page=True)
 page.locator('[data-auth-action=password-toggle]').click();assert page.locator('[name=password]').get_attribute('type')=='text';passed.append('Password visibility is accessible and functional')
 page.locator('[name=email]').fill(user['email']);page.locator('[name=password]').fill(WRONG);page.locator('[type=submit]').click();expect(page.locator('.auth-form-error')).to_contain_text('tidak cocok');passed.append('Failed login displays safe Indonesian error')
 page.locator('[name=password]').fill(UNVERIFIED);page.locator('[type=submit]').click();expect(page.locator('#auth-resend-form')).to_be_visible();passed.append('Unverified login routes to email verification')
 page.goto(ORIGIN+'/#/register');page.wait_for_function('NA.ready')
 assert page.locator('[name=intent] option[value=admin]').count()==0
 for name,value in [('name','Pengguna QA'),('email',user['email']),('password','short'),('confirmation','short')]:page.locator(f'[name={name}]').fill(value)
 page.locator('[name=consent]').check();page.locator('[type=submit]').click();expect(page.locator('.auth-form-error')).to_contain_text('min 12');passed.append('Signup validation, consent and allowed intents prevent admin self-selection')
 page.locator('[name=password]').fill(PW);page.locator('[name=confirmation]').fill(MISMATCH);page.locator('[type=submit]').click();expect(page.locator('.auth-form-error')).to_contain_text('belum cocok');passed.append('Password confirmation and strength validation work')
 signup_start=len(calls)
 page.locator('[name=confirmation]').fill(PW);page.locator('[type=submit]').click();expect(page.locator('#auth-resend-form')).to_be_visible();passed.append('Signup confirmation flow and resend page render without claiming auto-verification')
 signup_calls=calls[signup_start:];assert sum(method=='POST' and url.endswith('/auth/v1/signup') for method,url in signup_calls)==1
 assert not any(url.endswith('/auth/v1/recover') or url.endswith('/auth/v1/resend') for _,url in signup_calls)
 passed.append('One registration sends only one signup request and never auto-sends recovery/resend email')
 def register():
  page.goto(ORIGIN+'/#/register');page.wait_for_function('NA.ready')
  for name,value in [('name','Pengguna QA'),('email',user['email']),('password',PW),('confirmation',PW)]:page.locator(f'[name={name}]').fill(value)
  page.locator('[name=intent]').select_option('owner-request');page.locator('[name=consent]').check();page.locator('[type=submit]').click()
 signup_mode='session';signup_start=len(calls);register();page.wait_for_function('NA.user && NA.profile');expect(page).to_have_url(ORIGIN+'/#/');expect(page.locator('#toast-root')).to_contain_text('Registrasi berhasil')
 assert page.evaluate('NA.effectiveRoles.includes("prospect") && !NA.effectiveRoles.includes("owner") && !NA.effectiveRoles.includes("admin")')
 assert not any(url.endswith('/auth/v1/recover') or url.endswith('/auth/v1/resend') or (method=='POST' and '/rest/v1/profiles' in url) for method,url in calls[signup_start:])
 passed.append('Confirm Email off: signup session enters home with DB prospect role, success toast and no extra email/profile insert')
 page.reload();page.wait_for_function('NA.user && NA.profile');passed.append('Session returned directly by signup survives reload and reloads verified DB identity')
 page.evaluate('NK.navigate("account/profile")');page.locator('[data-auth-action=logout]').click();page.locator('[data-auth-action=logout-confirm]').click();page.wait_for_function('!NA.user')
 for mode in ['duplicate','obfuscated']:
  signup_mode=mode;register();expect(page.locator('.auth-form-error')).to_contain_text('terdaftar');assert page.evaluate('!NA.user');expect(page.locator('#auth-register-form')).to_be_visible()
 passed.append('Registered email errors and GoTrue obfuscated identities are handled without account takeover or auto-login')
 signup_mode='verify';mail_limited=True;page.goto(ORIGIN+'/#/forgot');page.wait_for_function('NA.ready');expect(page.locator('.field-help').first).to_contain_text('kuota')
 page.locator('[name=email]').fill(user['email']);page.locator('[type=submit]').click();expect(page.locator('.auth-form-error')).to_contain_text('Batas pengiriman email project tercapai');expect(page.locator('#auth-reset-form')).to_have_count(0)
 passed.append('Forgot password explains email quota and a quota rejection cannot open reset or bypass recovery validation');mail_limited=False
 page.goto(ORIGIN+'/#/owner');page.wait_for_function('NA.ready');expect(page.locator('#auth-login-form')).to_be_visible();passed.append('Anonymous private route renders login without workspace flash')
 def login(remember=False,route='login'):
  page.goto(ORIGIN+'/#/'+route);page.wait_for_function('NA.ready');page.locator('[name=email]').fill(user['email']);page.locator('[name=password]').fill(PW)
  if remember:page.locator('[name=remember]').check()
  page.locator('[type=submit]').click();page.wait_for_function('NA.user && NA.profile');expect(page).to_have_url(ORIGIN+'/#/');page.wait_for_function('!NA.loadingListings')
 login();page.wait_for_timeout(250)
 assert page.evaluate('NA.defaultPath()')=='workspace';assert page.evaluate('NA.profile.display_name')=='Ruang QA';passed.append('Login opens public home; workspace access follows DB prospect role rather than editable metadata')
 expect(page.locator('.public-nav a[aria-current=page]')).to_have_text('Beranda')
 expect(page.locator('.public-header a[href="#/workspace"]')).to_have_count(0);expect(page.locator('.public-nav a',has_text='Dashboard')).to_have_count(0)
 page.evaluate('NK.navigate("workspace")');expect(page).to_have_url(ORIGIN+'/#/');passed.append('Prospect sees no workspace entry and legacy workspace URL returns to home')
 for route in ['', 'marketplace', 'fitur', 'tentang', 'untuk-pemilik', 'privacy', 'help', 'account/profile', 'account/email', 'account/security', 'account/access']:
  page.evaluate('(route)=>NK.navigate(route)',route);page.wait_for_timeout(60);expect(page.locator('[data-auth-action=demo],[data-action=roles],[data-action=guide]')).to_have_count(0)
  assert 'connected mode' not in page.locator('body').inner_text().lower()
  if route.startswith('account/'):
   expect(page.locator('.connected-profile-card,.connected-profile-grid')).to_have_count(0)
   expect(page.locator('.public-header [data-auth-action=logout]')).to_have_count(0);expect(page.locator('.sidebar nav > :last-child')).to_have_attribute('data-auth-action','logout')
 passed.append('Signed-in home, public pages and all account menus have no Demo action')
 passed.append('All account menus remove the identity card and place logout last in the settings menu')
 for route in ['login','register']:
  page.evaluate('(route)=>NK.navigate(route)',route);expect(page).to_have_url(ORIGIN+'/#/');expect(page.locator('.public-nav a[aria-current=page]')).to_have_text('Beranda')
 passed.append('An already signed-in user opening login or register returns to home')
 page.evaluate('NK.navigate("account/profile")');expect(page.locator('.sidebar nav a')).to_have_count(5)
 assert page.locator('.sidebar nav a').all_text_contents()==['Informasi Pribadi','Alamat Email','Kata Sandi','Hak Akses','Preferensi']
 assert page.locator('.sidebar nav a[href="#/marketplace"],.sidebar nav a[href="#/workspace"]').count()==0
 passed.append('Account sidebar retains identity/security menus and adds DB preferences without Beranda or Cari Kos')
 expect(page.locator('.public-header')).to_be_visible();expect(page.locator('.public-nav a')).to_have_count(4)
 page.locator('.public-nav a[href="#/"]').click();expect(page).to_have_url(ORIGIN+'/#/');page.locator('.connected-account-link').click();expect(page).to_have_url(ORIGIN+'/#/account/profile');expect(page.locator('#auth-profile-form')).to_be_visible()
 passed.append('Account retains the main navbar; Beranda and profile links navigate out and back')
 for section,form_id,title in [('profile','profile','Informasi Pribadi'),('email','email','Alamat Email'),('security','password','Kata Sandi')]:
  page.locator('.sidebar nav a[href="#/account/'+section+'"]').click();expect(page.locator('h1')).to_have_text(title);expect(page.locator('.sidebar nav a[aria-current=page]')).to_have_attribute('href','#/account/'+section)
  expect(page.locator('#auth-'+form_id+'-form')).to_be_visible();expect(page.locator('[data-auth-form]')).to_have_count(1)
 page.locator('.sidebar nav a[href="#/account/access"]').click();expect(page.locator('.connected-access-list')).to_contain_text('Calon penghuni');expect(page.locator('[data-auth-form]')).to_have_count(0)
 passed.append('Account menus navigate to separate forms and access information with correct active state')
 logout_requests=lambda:sum(method=='POST' and url.endswith('/auth/v1/logout') for method,url in calls)
 before_logout=logout_requests();page.locator('[data-auth-action=logout]').click();expect(page.get_by_role('dialog')).to_be_visible();expect(page.get_by_role('heading',name='Yakin ingin keluar?')).to_be_visible();assert page.evaluate('!!NA.user');assert logout_requests()==before_logout
 passed.append('Logout opens a confirmation dialog without signing out or calling Auth')
 page.get_by_role('button',name='Batal',exact=True).click();expect(page.get_by_role('dialog')).to_have_count(0);assert page.evaluate('!!NA.user')
 for dismiss in ['close','escape','overlay']:
  page.locator('[data-auth-action=logout]').click();expect(page.get_by_role('dialog')).to_be_visible()
  if dismiss=='close':page.get_by_role('button',name='Tutup dialog').click()
  elif dismiss=='escape':page.keyboard.press('Escape')
  else:page.locator('.modal-overlay').click(position={'x':2,'y':2})
  expect(page.get_by_role('dialog')).to_have_count(0);assert page.evaluate('!!NA.user');assert logout_requests()==before_logout
 passed.append('Cancel, close icon, Escape and backdrop preserve the account session')
 assert page.evaluate('localStorage.getItem("ngekosaja.auth.v3")') is None;assert page.evaluate('sessionStorage.getItem("ngekosaja.auth.v3")') is not None;passed.append('Non-remembered session stays out of localStorage')
 page.reload();page.wait_for_function('NA.user && NA.profile');passed.append('Session restoration verifies user and reloads DB profile/roles')
 for role in ['owner','tenant','admin']:
  page.evaluate('(r)=>NK.navigate(r)',role);expect(page.locator('h1')).to_contain_text('akses tersendiri')
 passed.append('Prospect cannot open owner, tenant or administrator workspace')
 page.evaluate('NK.navigate("reset")');expect(page.locator('#auth-reset-form')).to_have_count(0);passed.append('A forged reset route cannot turn an ordinary session into recovery')
 page.evaluate('NK.navigate("account")');page.locator('#auth-profile-form [name=name]').fill('Profil Tersimpan');page.locator('#auth-profile-form [type=submit]').click();page.wait_for_function('NA.profile.display_name==="Profil Tersimpan"');passed.append('Profile update sends only allowed fields with verified user ID')
 page.locator('.sidebar nav a[href="#/account/email"]').click();page.locator('#auth-email-form [name=email]').fill('new@example.invalid');page.locator('#auth-email-form [type=submit]').click();expect(page.locator('.notice').first).to_contain_text('Konfirmasikan');page.wait_for_timeout(200);expect(page.locator('.notice').first).to_contain_text('Konfirmasikan');passed.append('Email update uses Auth confirmation and preserves success state through SDK callbacks')
 page.locator('.sidebar nav a[href="#/account/security"]').click()
 for field,value in [('current',WRONG),('password',UPDATED),('confirmation',UPDATED)]:page.locator('#auth-password-form [name='+field+']').fill(value)
 page.locator('#auth-password-form [type=submit]').click();expect(page.locator('#auth-password-form .auth-form-error')).to_contain_text('tidak cocok');page.locator('#auth-password-form [name=current]').fill(PW);page.locator('#auth-password-form [type=submit]').click();expect(page.locator('.notice').first).to_contain_text('berhasil diperbarui');passed.append('Profile password change revalidates current password and persists success state')
 page.evaluate('NK.navigate("owner")');rights[:]=['owner'];page.evaluate('NA.refreshIdentity()');page.wait_for_function('NA.effectiveRoles.includes("owner")');page.evaluate('NK.navigate("owner")');expect(page.locator('.b-layout')).to_be_visible();expect(page.locator('#main')).to_contain_text('Pendapatan sewa');passed.append('Trusted owner role enables scoped backend dashboard without Phase 2 placeholder')
 assert page.evaluate('(()=>{try{NK.setRole("admin");return false}catch{return true}})()');passed.append('Connected mode blocks legacy demo mutation/role switching')
 page.evaluate('document.body.insertAdjacentHTML("beforeend",\'<button id="injected-demo" data-auth-action="demo">Injected demo</button>\')');page.locator('#injected-demo').dispatch_event('click');assert page.evaluate('NA.mode==="connected" && !!NA.user');page.locator('#injected-demo').evaluate('(el)=>el.remove()');passed.append('Signed-in demo mode switch is refused even if a stale action is triggered')
 page.evaluate('NK.navigate("account/security")');page.locator('[data-auth-action=logout]').first.click();page.locator('[data-auth-action=logout-confirm]').click();page.wait_for_function('!NA.user');assert page.evaluate('sessionStorage.getItem("ngekosaja.auth.v3")') is None;expect(page.locator('[data-auth-action=demo]')).not_to_have_count(0);passed.append('Logout clears authorization and makes Demo available again')
 page.wait_for_timeout(150);before=len(calls);page.locator('[data-auth-action=demo]').first.click();page.locator('[data-action=role][data-role=admin]').click();page.wait_for_timeout(200);assert len(calls)==before;assert page.evaluate('NA.client===null');assert page.evaluate('(()=>{try{NA.createClient();return false}catch{return true}})()');passed.append('Anonymous Demo admin selection uses local data, refuses client creation and makes no backend request')
 expect(page.locator('.demo-mode-bar')).to_be_visible();page.locator('[data-auth-action=connected]').first.click();page.wait_for_function('NA.mode==="connected" && NA.ready');assert page.evaluate('NA.user===null');passed.append('Return from anonymous demo does not adopt a demo role or restore a logged-out identity')
 rights[:]=['prospect'];login(True,'account/security');assert page.evaluate('localStorage.getItem("ngekosaja.auth.v3")') is not None;passed.append('Login from a protected settings URL opens home and remembered session uses persistent storage')
 for role in ['owner','tenant','admin']:
  page.evaluate('NK.navigate("account")');page.locator('[data-auth-action=logout]').first.click();page.locator('[data-auth-action=logout-confirm]').click();page.wait_for_function('!NA.user');rights[:]=[role];login();assert page.evaluate('(role)=>NA.effectiveRoles.includes(role)',role);expect(page.locator('.public-nav a[href="#/'+role+'"]')).to_have_text('Dashboard');page.locator('.public-nav a[href="#/'+role+'"]').click();expect(page.locator('.b-layout')).to_be_visible()
 passed.append('Owner, tenant and admin all land on home after login and retain their authorized workspace access')
 for width in [390,768,1440]:
  page.set_viewport_size({'width':width,'height':900});page.evaluate('NK.navigate("account/profile")');page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  expect(page.locator('.public-header')).to_be_visible()
  if page.locator('.mobile-menu').is_visible():page.locator('.mobile-menu').click();expect(page.locator('.public-nav')).to_be_visible()
  page.locator('.public-nav a[href="#/"]').click();expect(page).to_have_url(ORIGIN+'/#/');page.locator('.connected-account-link').click();expect(page.locator('#auth-profile-form')).to_be_visible()
  bounds=page.evaluate('(()=>{const header=document.querySelector(".public-header").getBoundingClientRect(),sidebar=document.querySelector(".sidebar").getBoundingClientRect();return {headerBottom:header.bottom,sidebarTop:sidebar.top}})()')
  assert bounds['sidebarTop']>=bounds['headerBottom']-1,'Account sidebar must begin below the main navbar'
  page.evaluate('window.scrollTo(0,document.body.scrollHeight)');page.wait_for_timeout(60)
  assert page.evaluate('!!document.elementFromPoint(innerWidth/2,20)?.closest(".public-header")'),'Main navbar must remain on top while scrolling account settings'
  page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(60)
  for bounds in page.locator('.sidebar nav a').evaluate_all('(links)=>links.map(link=>{const box=link.getBoundingClientRect();return {left:box.left,right:box.right,height:box.height}})'):
   assert bounds['left']>=0 and bounds['right']<=width+1 and bounds['height']<=70,'All account menus must fit visibly with compact rows'
  expect(page.locator('.account-logout-menu')).to_be_visible();page.locator('.account-logout-menu').click();expect(page.get_by_role('dialog')).to_be_visible()
  assert page.get_by_role('dialog').evaluate('(el)=>{const box=el.getBoundingClientRect();return box.left>=0 && box.right<=innerWidth+1 && box.height<=innerHeight}')
  if width==1440:page.screenshot(path=str(OUT/'logout-confirmation.png'),full_page=True,animations='disabled')
  page.get_by_role('button',name='Batal',exact=True).click();assert page.evaluate('!!NA.user')
  page.screenshot(path=str(OUT/('account-mobile.png' if width==390 else 'account-desktop.png' if width==1440 else 'account-tablet.png')),full_page=True)
  for route in ['login','forgot','verify','reset','account','account/profile','account/email','account/security','account/access','workspace','owner','marketplace','access-denied']:
   page.evaluate('(route)=>NK.navigate(route)',route);page.wait_for_timeout(60);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Overflow: {route} at {width}'
 passed.append('Authentication pages fit 390/768/1440px without horizontal overflow')
 passed.append('Account menus have compact desktop rows and all four remain visible on mobile/tablet')
 passed.append('Main navbar works on desktop/tablet/mobile and never overlaps the account sidebar')
 passed.append('Main navbar remains accessible above account settings while scrolling')
 page.evaluate('NK.navigate("account")');page.locator('[data-auth-action=logout]').first.click();page.locator('[data-auth-action=logout-confirm]').click();page.wait_for_function('!NA.user')
 page.evaluate('(email)=>NA.authService.recover(email)',user['email'])
 assert page.evaluate('localStorage.getItem("ngekosaja.auth.v3-code-verifier")!==null && sessionStorage.getItem("ngekosaja.auth.v3-code-verifier")===null')
 page.evaluate('NA.setRemember(true);NA.setRemember(false)');assert page.evaluate('localStorage.getItem("ngekosaja.auth.v3-code-verifier")!==null')
 passed.append('PKCE verifier is shared across tabs independently of remembered login preference')
 recovery_page=context.new_page();recovery_page.on('pageerror',lambda error:errors.append(str(error)))
 recovery_page.goto(ORIGIN+'/index.html?code=qa-recovery-code&auth_flow=recovery');recovery_page.wait_for_function('NA.ready');expect(recovery_page.locator('#auth-reset-form')).to_be_visible();assert 'code=' not in recovery_page.url
 assert recovery_page.evaluate('localStorage.getItem("ngekosaja.auth.v3")===null && sessionStorage.getItem("ngekosaja.auth.v3")!==null')
 passed.append('Email recovery in a NEW tab uses the real SDK PKCE exchange; unremembered session stays out of localStorage')
 assert recovery_page.evaluate('localStorage.getItem("ngekosaja.auth.v3-code-verifier")===null && localStorage.getItem("ngekosaja.auth.v3-code-verifier.expires_at")===null')
 passed.append('Consumed PKCE verifier and local expiry are removed')
 recovery_page.locator('#auth-reset-form [name=password]').fill(RESET);recovery_page.locator('#auth-reset-form [name=confirmation]').fill(RESET);recovery_page.locator('#auth-reset-form [type=submit]').click();expect(recovery_page.locator('#auth-login-form')).to_be_visible();passed.append('Validated reset updates password and signs out');recovery_page.close()
 page.evaluate('(email)=>NA.authService.recover(email)',user['email']);page.evaluate('localStorage.setItem("ngekosaja.auth.v3-code-verifier.expires_at",String(Date.now()-1000))')
 assert page.evaluate('NA.authStorage.getItem("ngekosaja.auth.v3-code-verifier")===null && localStorage.getItem("ngekosaja.auth.v3-code-verifier")===null')
 passed.append('Expired PKCE verifier is refused and cleared locally')
 page.goto(ORIGIN+'/index.html?error=access_denied&error_description=Expired');page.wait_for_function('NA.ready');expect(page.locator('h1')).to_contain_text('masuk kembali');assert 'error_description' not in page.url;passed.append('Expired callback is sanitized without exposing tokens or raw error text')
 for path in ['/.env','/supabase/.temp/pooler-url','/node_modules/pg/package.json','/scripts/apply-final-fixes.mjs']:
  assert context.request.get(ORIGIN+''+path).status==404
 passed.append('Development server refuses secrets, internal SQL, tooling and node_modules')
 blocked=browser.new_context();blocked_errors=[]
 blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}})")
 blocked_page=blocked.new_page();blocked_page.on('pageerror',lambda error:blocked_errors.append(str(error)));blocked_page.goto(ORIGIN+'/#/login');blocked_page.wait_for_function('NA.ready');expect(blocked_page.locator('.auth-config-warning')).to_contain_text('memblokir');assert blocked_page.evaluate('NA.client===undefined');blocked_page.locator('[data-auth-action=demo]').first.click();expect(blocked_page.locator('.modal')).to_be_visible();assert not blocked_errors;blocked.close();passed.append('Blocked storage fails closed for Connected Mode while explicit volatile Demo remains available')
 context.close();browser.close()
assert not errors,errors
report={'mode':'real-chromium-sdk-with-mocked-http-auth-boundary','passed':passed,'count':len(passed),'javascript_errors':errors,'limitations':['No real email, GoTrue or Cloud account is created by this browser suite. Public Cloud signup with Confirm Email off has not been rerun. Historical live-cloud results do not verify this change.']}
(OUT/'auth-browser-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'passed':len(passed),'javascript_errors':len(errors),'mode':report['mode']}))
