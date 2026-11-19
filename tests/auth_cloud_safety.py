"""Run the live harness with all network/CLI boundaries intercepted: zero real email."""
import io,json,os,runpy,secrets,subprocess,urllib.request
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
passed=[]
def attempt(env,cli,response):
 captured={}
 def capture(path,text,*args,**kwargs):
  assert str(path).endswith('auth-cloud-latest-attempt.json'),'Offline safety test must not write markers or live success reports'
  captured['report']=json.loads(text)
  return len(text)
 with patch.dict(os.environ,env,clear=True),patch.object(subprocess,'run',side_effect=cli),patch.object(urllib.request,'urlopen',side_effect=response),patch.object(Path,'write_text',capture):
  try:runpy.run_path(str(ROOT/'tests/auth_cloud.py'),run_name='__main__')
  except SystemExit as exc:assert exc.code==1
  else:raise AssertionError('Unsafe cloud harness was not refused')
 return captured['report']
def forbidden(*args,**kwargs):raise AssertionError('This boundary must not be reached')

report=attempt({},forbidden,forbidden)
assert report['stopped_at']=='preflight' and report['error_type']=='RuntimeError'
passed.append('No disposable opt-in: stop before any CLI/network request')

# Use only the local protected hash. A synthetic address cannot match this hash;
# execute the hash check by substituting a copy of the marker during its read.
original=Path.read_text
email='disposable-'+secrets.token_hex(8)+'@example.invalid'
import hashlib
def protected_read(path,*args,**kwargs):
 if str(path).endswith('auth-qa-identity.json'):return json.dumps({'email_hash':hashlib.sha256(email.encode()).hexdigest()})
 return original(path,*args,**kwargs)
with patch.object(Path,'read_text',protected_read):
 report=attempt({'NGEKOSAJA_QA_DISPOSABLE_ACCOUNT':'yes','NGEKOSAJA_TEST_EMAIL':email},forbidden,forbidden)
assert report['stopped_at']=='preflight' and report['error_type']=='RuntimeError'
passed.append('Protected original email: stop before CLI/network even with disposable opt-in')

requests=[]
def cli(args,**kwargs):
 data=[{'name':'ngekosaja-development','id':'wfmhsbdfdcugxblqsaob'}] if 'list' in args else [{'name':'service_role','api_key':'eyJfake'}]
 return subprocess.CompletedProcess(args,0,json.dumps(data),'')
def response(req,**kwargs):
 requests.append(req.method)
 assert req.method=='GET' and '/admin/users?' in req.full_url
 return io.BytesIO(json.dumps({'users':[{'id':'existing','email':email}]}).encode())
report=attempt({'NGEKOSAJA_QA_DISPOSABLE_ACCOUNT':'yes','NGEKOSAJA_TEST_EMAIL':email},cli,response)
assert report['stopped_at']=='owned-test-identity-check' and report['error_type']=='RuntimeError'
assert requests==['GET']
passed.append('Any existing remote identity: refuse before login, password mutation, or link generation')

output={'mode':'offline-cloud-safety-boundaries','passed':passed,'count':len(passed),'real_emails_sent':0,'remote_mutations':0}
(ROOT/'tests/auth-cloud-safety-results.json').write_text(json.dumps(output,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':len(passed),'real_emails_sent':0,'remote_mutations':0}))
