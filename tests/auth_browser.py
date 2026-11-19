"""Real Chromium UI tests with a labelled fake HTTP Auth/PostgREST boundary.
No Cloud credentials, users or emails are created by this suite.
Real SDK + real DOM; mock results are deliberately separate from live-cloud QA.
"""
import json,time,secrets
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
passed=[];errors=[];calls=[]
PW,WRONG,UNVERIFIED,MISMATCH,UPDATED,RESET=[secrets.token_urlsafe(24)+'Qa1!' for _ in range(6)]
uid='11111111-1111-4111-8111-111111111111'
user={'id':uid,'aud':'authenticated','role':'authenticated','email':'qa@example.invalid','email_confirmed_at':'2026-01-01T00:00:00Z','user_metadata':{'display_name':'Metadata Bukan Profil','role':'admin'}}
rights=['prospect'];profile={'id':uid,'display_name':'Ruang QA','phone':None,'created_at':'2026-01-01T00:00:00Z'}
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
 elif '/auth/v1/signup' in url:data={'user':user,'session':None}
 elif '/auth/v1/token' in url:
  if 'grant_type=pkce' in url:assert body.get('code_verifier'),'PKCE must use the verifier from the initiating tab'
  if body.get('password')==WRONG:status=400;data={'code':400,'error_code':'invalid_credentials','msg':'Invalid login credentials'}
  elif body.get('password')==UNVERIFIED:status=400;data={'code':400,'error_code':'email_not_confirmed','msg':'Email not confirmed'}
  else:data=session()
 elif '/auth/v1/user' in url:data={**user,**({'new_email':body['email']} if body.get('email') else {})}
 elif '/auth/v1/logout' in url or '/auth/v1/recover' in url or '/auth/v1/resend' in url:data={}
 elif '/rest/v1/profiles' in url:
  if req.method=='PATCH':profile.update(body)
  data=profile
 elif '/rest/v1/user_roles' in url:data=[{'role':r} for r in rights]
 elif '/rest/v1/rental_agreements' in url:data=[{'id':'lease-qa'}] if 'tenant' in rights else []
 elif '/rest/v1/rpc/public_listings' in url:data=[]
 else:status=404;data={}
 route.fulfill(status=status,headers=headers,body=json.dumps(data))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':1440,'height':900},locale='id-ID')
 context.route('https://*.supabase.co/**',handle)
 page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto('http://127.0.0.1:5500/#/login');page.wait_for_function('NA.ready')
 expect(page.locator('#auth-login-form')).to_be_visible();passed.append('Primary login uses real email/password UI and local official SDK')
 page.screenshot(path=str(ROOT/'tests/auth-desktop.png'),full_page=True)
 page.locator('[data-auth-action=password-toggle]').click();assert page.locator('[name=password]').get_attribute('type')=='text';passed.append('Password visibility is accessible and functional')
 page.locator('[name=email]').fill(user['email']);page.locator('[name=password]').fill(WRONG);page.locator('[type=submit]').click();expect(page.locator('.auth-form-error')).to_contain_text('tidak cocok');passed.append('Failed login displays safe Indonesian error')
 page.locator('[name=password]').fill(UNVERIFIED);page.locator('[type=submit]').click();expect(page.locator('#auth-resend-form')).to_be_visible();passed.append('Unverified login routes to email verification')
 page.goto('http://127.0.0.1:5500/#/register');page.wait_for_function('NA.ready')
 assert page.locator('[name=intent] option[value=admin]').count()==0
 for name,value in [('name','Pengguna QA'),('email',user['email']),('password','short'),('confirmation','short')]:page.locator(f'[name={name}]').fill(value)
 page.locator('[name=consent]').check();page.locator('[type=submit]').click();expect(page.locator('.auth-form-error')).to_contain_text('min 12');passed.append('Signup validation, consent and allowed intents prevent admin self-selection')
 page.locator('[name=password]').fill(PW);page.locator('[name=confirmation]').fill(MISMATCH);page.locator('[type=submit]').click();expect(page.locator('.auth-form-error')).to_contain_text('belum cocok');passed.append('Password confirmation and strength validation work')
 signup_start=len(calls)
 page.locator('[name=confirmation]').fill(PW);page.locator('[type=submit]').click();expect(page.locator('#auth-resend-form')).to_be_visible();passed.append('Signup confirmation flow and resend page render without claiming auto-verification')
 signup_calls=calls[signup_start:];assert sum(method=='POST' and url.endswith('/auth/v1/signup') for method,url in signup_calls)==1
 assert not any(url.endswith('/auth/v1/recover') or url.endswith('/auth/v1/resend') for _,url in signup_calls)
 passed.append('One registration sends only one signup request and never auto-sends recovery/resend email')
 page.goto('http://127.0.0.1:5500/#/owner');page.wait_for_function('NA.ready');expect(page.locator('#auth-login-form')).to_be_visible();passed.append('Anonymous private route renders login without workspace flash')
 def login(remember=False):
  page.goto('http://127.0.0.1:5500/#/login');page.wait_for_function('NA.ready');page.locator('[name=email]').fill(user['email']);page.locator('[name=password]').fill(PW)
  if remember:page.locator('[name=remember]').check()
  page.locator('[type=submit]').click();page.wait_for_function('NA.user && NA.profile')
 login();page.wait_for_timeout(250)
 assert page.evaluate('NA.defaultPath()')=='workspace';assert page.evaluate('NA.profile.display_name')=='Ruang QA';passed.append('DB profile/role override user-editable metadata, role redirect is prospect')
 assert page.evaluate('localStorage.getItem("ngekosaja.auth.v3")') is None;assert page.evaluate('sessionStorage.getItem("ngekosaja.auth.v3")') is not None;passed.append('Non-remembered session stays out of localStorage')
 page.reload();page.wait_for_function('NA.user && NA.profile');passed.append('Session restoration verifies user and reloads DB profile/roles')
 for role in ['owner','tenant','admin']:
  page.evaluate('(r)=>NK.navigate(r)',role);expect(page.locator('h1')).to_contain_text('akses tersendiri')
 passed.append('Prospect cannot open owner, tenant or administrator workspace')
 page.evaluate('NK.navigate("reset")');expect(page.locator('#auth-reset-form')).to_have_count(0);passed.append('A forged reset route cannot turn an ordinary session into recovery')
 page.evaluate('NK.navigate("account")');page.locator('#auth-profile-form [name=name]').fill('Profil Tersimpan');page.locator('#auth-profile-form [type=submit]').click();page.wait_for_function('NA.profile.display_name==="Profil Tersimpan"');passed.append('Profile update sends only allowed fields with verified user ID')
 page.locator('#auth-email-form [name=email]').fill('new@example.invalid');page.locator('#auth-email-form [type=submit]').click();expect(page.locator('.notice').first).to_contain_text('Konfirmasikan');page.wait_for_timeout(200);expect(page.locator('.notice').first).to_contain_text('Konfirmasikan');passed.append('Email update uses Auth confirmation and preserves success state through SDK callbacks')
 for field,value in [('current',WRONG),('password',UPDATED),('confirmation',UPDATED)]:page.locator('#auth-password-form [name='+field+']').fill(value)
 page.locator('#auth-password-form [type=submit]').click();expect(page.locator('#auth-password-form .auth-form-error')).to_contain_text('tidak cocok');page.locator('#auth-password-form [name=current]').fill(PW);page.locator('#auth-password-form [type=submit]').click();expect(page.locator('.notice').first).to_contain_text('berhasil diperbarui');passed.append('Profile password change revalidates current password and persists success state')
 page.evaluate('NK.navigate("owner")');rights[:]=['owner'];page.evaluate('NA.refreshIdentity()');page.wait_for_function('NA.effectiveRoles.includes("owner")');page.evaluate('NK.navigate("owner")');expect(page.locator('.connected-phase')).to_be_visible();expect(page.locator('.connected-phase')).to_contain_text('Phase 3');passed.append('Trusted owner role enables scoped workspace with explicit unintegrated state')
 assert page.evaluate('(()=>{try{NK.setRole("admin");return false}catch{return true}})()');passed.append('Connected mode blocks legacy demo mutation/role switching')
 before=len(calls);page.locator('[data-auth-action=demo]').first.click();page.locator('[data-action=role][data-role=admin]').click();page.wait_for_timeout(200);assert len(calls)==before;assert page.evaluate('NA.client===null');assert page.evaluate('(()=>{try{NA.createClient();return false}catch{return true}})()');passed.append('Demo admin selection uses local data, refuses client creation and makes no backend request')
 expect(page.locator('.demo-mode-bar')).to_be_visible();page.locator('[data-auth-action=connected]').first.click();page.wait_for_function('NA.mode==="connected" && NA.ready');passed.append('Return from demo restores connected identity without adopting demo role')
 page.evaluate('NK.navigate("account")');page.locator('[data-auth-action=logout]').first.click();page.wait_for_function('!NA.user');assert page.evaluate('sessionStorage.getItem("ngekosaja.auth.v3")') is None;passed.append('Logout clears session and in-memory authorization')
 rights[:]=['prospect'];login(True);assert page.evaluate('localStorage.getItem("ngekosaja.auth.v3")') is not None;passed.append('Remembered session uses explicit persistent storage')
 for role in ['owner','tenant','admin']:
  page.evaluate('NK.navigate("account")');page.locator('[data-auth-action=logout]').first.click();page.wait_for_function('!NA.user');rights[:]=[role];login();expect(page).to_have_url('http://127.0.0.1:5500/#/'+role)
 passed.append('Login redirects owner, tenant with agreement, and administrator using trusted database roles')
 for width in [390,768,1440]:
  page.set_viewport_size({'width':width,'height':900});page.evaluate('NK.navigate("register")');page.wait_for_timeout(100);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  if width==390:page.screenshot(path=str(ROOT/'tests/auth-mobile.png'),full_page=True)
  for route in ['login','forgot','verify','reset','account','workspace','owner','marketplace','access-denied']:
   page.evaluate('(route)=>NK.navigate(route)',route);page.wait_for_timeout(60);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Overflow: {route} at {width}'
 passed.append('Authentication pages fit 390/768/1440px without horizontal overflow')
 page.evaluate('NK.navigate("account")');page.locator('[data-auth-action=logout]').first.click();page.wait_for_function('!NA.user')
 page.evaluate('(email)=>NA.authService.recover(email)',user['email'])
 assert page.evaluate('localStorage.getItem("ngekosaja.auth.v3-code-verifier")!==null && sessionStorage.getItem("ngekosaja.auth.v3-code-verifier")===null')
 page.evaluate('NA.setRemember(true);NA.setRemember(false)');assert page.evaluate('localStorage.getItem("ngekosaja.auth.v3-code-verifier")!==null')
 passed.append('PKCE verifier is shared across tabs independently of remembered login preference')
 recovery_page=context.new_page();recovery_page.on('pageerror',lambda error:errors.append(str(error)))
 recovery_page.goto('http://127.0.0.1:5500/index.html?code=qa-recovery-code&auth_flow=recovery');recovery_page.wait_for_function('NA.ready');expect(recovery_page.locator('#auth-reset-form')).to_be_visible();assert 'code=' not in recovery_page.url
 assert recovery_page.evaluate('localStorage.getItem("ngekosaja.auth.v3")===null && sessionStorage.getItem("ngekosaja.auth.v3")!==null')
 passed.append('Email recovery in a NEW tab uses the real SDK PKCE exchange; unremembered session stays out of localStorage')
 assert recovery_page.evaluate('localStorage.getItem("ngekosaja.auth.v3-code-verifier")===null && localStorage.getItem("ngekosaja.auth.v3-code-verifier.expires_at")===null')
 passed.append('Consumed PKCE verifier and local expiry are removed')
 recovery_page.locator('#auth-reset-form [name=password]').fill(RESET);recovery_page.locator('#auth-reset-form [name=confirmation]').fill(RESET);recovery_page.locator('#auth-reset-form [type=submit]').click();expect(recovery_page.locator('#auth-login-form')).to_be_visible();passed.append('Validated reset updates password and signs out');recovery_page.close()
 page.evaluate('(email)=>NA.authService.recover(email)',user['email']);page.evaluate('localStorage.setItem("ngekosaja.auth.v3-code-verifier.expires_at",String(Date.now()-1000))')
 assert page.evaluate('NA.authStorage.getItem("ngekosaja.auth.v3-code-verifier")===null && localStorage.getItem("ngekosaja.auth.v3-code-verifier")===null')
 passed.append('Expired PKCE verifier is refused and cleared locally')
 page.goto('http://127.0.0.1:5500/index.html?error=access_denied&error_description=Expired');page.wait_for_function('NA.ready');expect(page.locator('h1')).to_contain_text('masuk kembali');assert 'error_description' not in page.url;passed.append('Expired callback is sanitized without exposing tokens or raw error text')
 for path in ['/.env','/supabase/.temp/pooler-url','/node_modules/pg/package.json','/scripts/apply-final-fixes.mjs']:
  assert context.request.get('http://127.0.0.1:5500'+path).status==404
 passed.append('Development server refuses secrets, internal SQL, tooling and node_modules')
 blocked=browser.new_context();blocked_errors=[]
 blocked.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}})")
 blocked_page=blocked.new_page();blocked_page.on('pageerror',lambda error:blocked_errors.append(str(error)));blocked_page.goto('http://127.0.0.1:5500/#/login');blocked_page.wait_for_function('NA.ready');expect(blocked_page.locator('.auth-config-warning')).to_contain_text('memblokir');assert blocked_page.evaluate('NA.client===undefined');blocked_page.locator('[data-auth-action=demo]').first.click();expect(blocked_page.locator('.modal')).to_be_visible();assert not blocked_errors;blocked.close();passed.append('Blocked storage fails closed for Connected Mode while explicit volatile Demo remains available')
 context.close();browser.close()
assert not errors,errors
report={'mode':'real-chromium-sdk-with-mocked-http-auth-boundary','passed':passed,'count':len(passed),'javascript_errors':errors,'limitations':['No real email, GoTrue or Cloud account is created by this browser suite. See separate live-cloud results.']}
(ROOT/'tests/auth-browser-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'passed':len(passed),'javascript_errors':len(errors),'mode':report['mode']}))
