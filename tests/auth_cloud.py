"""Opt-in development GoTrue/PostgREST/Chromium QA for a NEW DISPOSABLE identity.
Server admin key is captured in memory from CLI; never injected in the browser.
Passwords and one-time links exist only in RAM. Existing unrelated users are untouched.
Never target a personal or existing account, resume an old run, or send a handoff email.
"""
import json,os,re,secrets,subprocess,hashlib,urllib.request,urllib.error
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
REF='wfmhsbdfdcugxblqsaob';BASE='https://'+REF+'.supabase.co'
EMAIL=os.environ.get('NGEKOSAJA_TEST_EMAIL','').strip()
NODE=r'C:\Program Files\nodejs\node.exe'
report={'checked_at':datetime.now(timezone.utc).isoformat(),'mode':'live-supabase-cloud-development-real-chromium','project':'ngekosaja-development','passed':[],'limitations':['DISPOSABLE account only. No existing account may be resumed or changed.','Inbox receipt is not independently verified. Admin-generated one-time links exercise real GoTrue verification/recovery without reading the inbox.','No schema changes, role grants, existing-account password changes, or business fixtures.']}
stage='preflight'
def passed(label):report['passed'].append(label)
def command(args):
 p=subprocess.run([NODE,str(ROOT/'node_modules/supabase/dist/supabase.js'),*args],cwd=ROOT,capture_output=True,text=True,timeout=55)
 if p.returncode:raise RuntimeError('CLI request unavailable')
 return json.loads(p.stdout)
def objects(v):
 if isinstance(v,list):return [x for item in v for x in objects(item)]
 if isinstance(v,dict):return [v]+[x for item in v.values() if isinstance(item,(dict,list)) for x in objects(item)]
 return []
def request(method,path,body=None):
 payload=json.dumps(body).encode() if body is not None else None
 req=urllib.request.Request(BASE+'/auth/v1'+path,data=payload,method=method,headers={'apikey':SERVER_KEY,'Authorization':'Bearer '+SERVER_KEY,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=30) as response:return json.loads(response.read() or '{}')
def find_user():return next((u for u in request('GET','/admin/users?per_page=1000').get('users',[]) if u.get('email','').lower()==EMAIL.lower()),None)
try:
 if os.environ.get('NGEKOSAJA_QA_DISPOSABLE_ACCOUNT')!='yes':raise RuntimeError('Explicit disposable-account opt-in required before any network request')
 if not EMAIL or not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+',EMAIL):raise RuntimeError('Provide a user-owned test email through NGEKOSAJA_TEST_EMAIL')
 # The old QA identity is now a personal account and is permanently excluded.
 previous=ROOT/'.local-db/auth-qa-identity.json'
 if previous.exists() and json.loads(previous.read_text()).get('email_hash')==hashlib.sha256(EMAIL.lower().encode()).hexdigest():raise RuntimeError('Original account is protected; use a NEW disposable identity')
 if (ROOT/'supabase/.temp/project-ref').read_text().strip()!=REF:raise RuntimeError('Linked target mismatch')
 if not any(p.get('name')=='ngekosaja-development' and (p.get('id')==REF or p.get('ref')==REF) for p in objects(command(['projects','list','--output-format','json']))):raise RuntimeError('Live target mismatch')
 keys=objects(command(['projects','api-keys','--remote='+REF,'--reveal','--output-format','json']))
 candidates=[k for k in keys if k.get('name')=='service_role' or k.get('type')=='secret']
 SERVER_KEY=next((k.get('api_key') or k.get('key') for k in candidates if isinstance(k.get('api_key') or k.get('key'),str) and (k.get('api_key') or k.get('key')).startswith('eyJ')),None)
 if not SERVER_KEY:raise RuntimeError('Server-only QA key unavailable')
 stage='owned-test-identity-check'
 marker=ROOT/'.database-test/auth-qa-disposable.json';marker.parent.mkdir(exist_ok=True)
 owned=json.loads(marker.read_text()) if marker.exists() else {'run':secrets.token_hex(16),'email_hash':hashlib.sha256(EMAIL.lower().encode()).hexdigest()}
 if owned['email_hash']!=hashlib.sha256(EMAIL.lower().encode()).hexdigest():raise RuntimeError('Another QA identity is already recorded; no account changed')
 existing=find_user()
 if existing:raise RuntimeError('Existing account: QA cannot resume, log in, change password, or clean up this identity')
 marker.write_text(json.dumps(owned))
 password=secrets.token_urlsafe(25)+'Qa1!'
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  context=browser.new_context(viewport={'width':1440,'height':900},locale='id-ID')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(type(e).__name__))
  def goto(route):page.goto('http://127.0.0.1:5500/#/'+route);page.wait_for_function('NA.ready',timeout=30000)
  def login(secret,remember=False):
   if page.evaluate('!!window.NA?.user'):page.evaluate('NA.authService.logout()')
   goto('login');page.locator('[name=email]').fill(EMAIL);page.locator('[name=password]').fill(secret)
   if remember:page.locator('[name=remember]').check()
   page.locator('[type=submit]').click()
  if not existing:
   stage='public-registration'
   goto('register')
   for field,value in [('name','Pengguna Uji NgekosAja'),('email',EMAIL),('password',password),('confirmation',password)]:page.locator('[name='+field+']').fill(value)
   page.locator('[name=intent]').select_option('owner-request');page.locator('[name=consent]').check();page.locator('[type=submit]').click()
   expect(page.locator('#auth-resend-form')).to_be_visible(timeout=30000)
   user=find_user()
   if not user:raise RuntimeError('Public registration did not create the test identity')
   owned['id']=user['id'];marker.write_text(json.dumps(owned))
   request('PUT','/admin/users/'+user['id'],{'user_metadata':{**user.get('user_metadata',{}),'auth_qa_run':owned['run']}})
   passed('Public signUp through actual form accepted by Cloud; verification email requested')
   stage='unverified-login'
   login(password);expect(page.locator('#auth-resend-form')).to_be_visible(timeout=20000)
   passed('Real GoTrue rejects password login before email confirmation')
  stage='real-email-verification'
  if not user.get('email_confirmed_at'):
   link=request('POST','/admin/generate_link',{'type':'signup','email':EMAIL,'password':password,'redirect_to':'http://127.0.0.1:5500/index.html?auth_flow=verify'})
   props=link.get('properties',link);hashed=props['hashed_token'];kind=props.get('verification_type','signup')
   page.goto('http://127.0.0.1:5500/index.html?token_hash='+hashed+'&type='+kind+'&auth_flow=verify')
   page.wait_for_function('NA.ready && NA.user && NA.profile',timeout=30000)
   assert 'token_hash=' not in page.url
   passed('One-time signup token verified by real GoTrue, callback sanitized, session and DB profile loaded')
  stage='password-login'
  login(password,True);page.wait_for_function('NA.user && NA.profile',timeout=30000)
  assert page.evaluate('NA.roles.join(",")')=='prospect';assert page.evaluate('NA.defaultPath()')=='workspace'
  assert page.evaluate('NA.profile.id===NA.user.id')
  expect(page).to_have_url('http://127.0.0.1:5500/#/')
  passed('Actual login opens home; DB prospect role grants no owner/admin from registration intent')
  page.reload();page.wait_for_function('NA.user && NA.profile',timeout=30000);passed('Real session restored after reload and revalidated through getUser/PostgREST')
  stage='profile-update'
  page.evaluate('NK.navigate("account")');page.locator('#auth-profile-form [name=name]').fill('Pengguna Uji NgekosAja');page.locator('#auth-profile-form [type=submit]').click();expect(page.locator('.notice').first).to_contain_text('server',timeout=20000)
  passed('Real profile UPDATE and reload succeed through RLS; no browser profile INSERT/upsert')
  stage='privilege-negative-tests'
  result=page.evaluate("""async()=>{
   const uid=NA.user.id;
   const role=await NA.client.from('user_roles').insert({user_id:uid,role:'admin'});
   const grant=await NA.client.rpc('server_grant_role',{target_user:uid,target_role:'admin'});
   const paid=await NA.client.from('invoices').update({status:'paid'}).eq('id','00000000-0000-4000-8000-000000000001');
   const identity=await NA.client.from('profiles').update({id:'00000000-0000-4000-8000-000000000001'}).eq('id',uid);
   return [role,grant,paid,identity].map(r=>({denied:!!r.error,code:r.error?.code}));
  }""")
  assert all(r['denied'] for r in result);report['permission_denials']=result
  passed('Real PostgREST denies self-admin insert, server_grant_role RPC, invoice paid mutation and profile ID mutation')
  page.evaluate('NA.client.auth.updateUser({data:{role:"admin",is_admin:true}})');page.evaluate('NA.refreshIdentity()');page.wait_for_timeout(400)
  assert page.evaluate('NA.roles.join(",")')=='prospect';passed('Editable user metadata cannot elevate the actual database role')
  page.evaluate('NA.client.auth.updateUser({data:{role:null,is_admin:null}})')
  for route in ['owner','tenant','admin']:
   page.evaluate('(route)=>NK.navigate(route)',route);expect(page.locator('h1')).to_contain_text('akses tersendiri')
  passed('Live account is refused owner, tenant and administrator UI routes')
  stage='real-password-recovery'
  link=request('POST','/admin/generate_link',{'type':'recovery','email':EMAIL,'redirect_to':'http://127.0.0.1:5500/index.html?auth_flow=recovery'})
  props=link.get('properties',link);hashed=props['hashed_token']
  page.goto('http://127.0.0.1:5500/index.html?token_hash='+hashed+'&type=recovery&auth_flow=recovery');page.wait_for_function('NA.ready',timeout=30000)
  expect(page.locator('#auth-reset-form')).to_be_visible(timeout=30000)
  newpassword=secrets.token_urlsafe(25)+'Qa2!'
  page.locator('[name=password]').fill(newpassword);page.locator('[name=confirmation]').fill(newpassword);page.locator('[type=submit]').click();expect(page.locator('#auth-login-form')).to_be_visible(timeout=30000)
  passed('Real one-time recovery session updates password via Auth; reset signs out')
  login(newpassword);page.wait_for_function('NA.user && NA.profile',timeout=30000);passed('New password successfully logs in through real GoTrue')
  page.evaluate('NK.navigate("account")');page.locator('[data-auth-action=logout]').first.click();page.wait_for_function('!NA.user');passed('Actual signOut clears app authorization and browser session')
  # No final recovery email: its PKCE verifier would belong to this closed context.
  assert not errors
  context.close();browser.close()
 report['status']='passed';report['count']=len(report['passed']);report['test_identity_retained']=True
except Exception as exc:
 report['status']='incomplete';report['stopped_at']=stage;report['error_type']=type(exc).__name__
 # Do not print exception messages: HTTP errors / browser URLs may carry credentials.
finally:
 report['finished_at']=datetime.now(timezone.utc).isoformat()
 (ROOT/'tests/auth-cloud-latest-attempt.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 if report['status']=='passed':(ROOT/'tests/auth-cloud-results.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 print(json.dumps({'status':report['status'],'passed':len(report['passed']),'stopped_at':report.get('stopped_at'),'error_type':report.get('error_type')}))
 if report['status']!='passed':raise SystemExit(1)
