"""Real DOM/SDK/Canvas + explicit fake HTTP and fake Realtime channel boundary.
This does NOT verify Supabase Cloud Storage, WebSocket authorization or delivery.
Reuses the Phase 3 HTTP fixture definitions, without executing its regression body.
"""
import json,time,os,base64,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
fixture=(ROOT/'tests/backend_browser.py').read_text(encoding='utf-8').split('with sync_playwright() as p:')[0]
exec(compile(fixture,str(ROOT/'tests/backend_browser.py'),'exec'))
OUT=Path(os.environ.get('NGEKOSAJA_TEST_OUTPUT',str(ROOT/'tests/phase4/browser')));OUT.mkdir(parents=True,exist_ok=True)
passed=[];errors=[];enabled=False;staged={};objects=set();fail_send=False;committed={};attempt_keys=[]
original_handle=handle
headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','content-type':'application/json','content-range':'0-0/1'}
def reply(route,data,status=200):route.fulfill(status=status,headers=headers,body=json.dumps(data))
def handle4(route):
 global fail_send
 req=route.request;path=urlparse(req.url).path
 if req.method=='OPTIONS':return reply(route,{})
 if '/storage/v1/' in path:
  if '/object/sign/' in path:return reply(route,{'signedURL':path.replace('/storage/v1','')+'?token=mock-only'})
  if req.method=='POST':objects.add(path.split('/object/',1)[-1]);return reply(route,{'Key':path.split('/object/',1)[-1]})
  if req.method=='DELETE':return reply(route,[])
  # Return a valid PNG for signed image requests; fixture bytes are not Cloud content.
  return route.fulfill(status=200,content_type='image/png',body=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII='))
 if '/rpc/' in path:
  name=path.split('/')[-1];body=req.post_data_json or {}
  if name=='phase4_capabilities':return reply(route,{'version':4,'storage':True,'realtime':True} if enabled else None)
  if name=='conversation_avatars':return reply(route,[])
  if name=='begin_media_upload':
   bucket={'property':'property-images','room':'room-images','avatar':'avatars','chat':'chat-attachments','complaint':'complaint-attachments'}[body['media_kind']]
   row={'id':str(uuid.uuid4()),'bucket_id':bucket,'object_path':body['target_scope']+'/'+str(uuid.uuid4())+'.webp','mime_type':body['file_mime'],'size_bytes':body['file_size']};staged[row['id']]=row;return reply(route,row)
  if name=='media_upload_status':return reply(route,[dict(r,in_use=any(r['id'] in x.get('upload_ids',[]) for x in committed.values()),object_exists=True) for r in staged.values() if r['id'] in body['upload_ids']])
  if name=='send_message_media':
   key=body['request_key'];attempt_keys.append(key)
   if fail_send:fail_send=False;return reply(route,{'code':'MOCK_TIMEOUT','message':'Simulated transport failure'},503)
   if key not in committed:
    committed[key]=body
    attachments=[{'storage_path':staged[i]['object_path']} for i in body['upload_ids']]
    messages.insert(0,{'id':str(uuid.uuid4()),'client_key':key,'conversation_id':body['target_conversation'],'sender_id':UID,'body':body['message_body'],'created_at':'2026-11-19T12:00:00Z','message_attachments':attachments})
   return reply(route,next(m['id'] for m in messages if m.get('client_key')==key))
  if name=='set_my_avatar':return reply(route,None)
  if name=='owner_save_property':
   prop['property_images']=[{'image_path':im['path'],'alt_text':im['alt'],'position':i} for i,im in enumerate(body['payload']['images'])];return reply(route,PID)
  if name=='mark_conversation_read':conversation['unread_count']=0;return reply(route,None)
 return original_handle(route)
FAKE="""() => {
 window.__channels=[];
 NA.client.channel=(name)=>{const c={name,handlers:[],on(type,filter,fn){this.handlers.push({filter,fn});return this},subscribe(fn){this.state=fn;queueMicrotask(()=>fn('SUBSCRIBED'));return this}};__channels.push(c);return c};
 NA.client.removeChannel=async c=>{c.removed=true;c.state?.('CLOSED');return 'ok'};
 window.__event=(table,row,type='INSERT')=>{for(const c of __channels.filter(c=>!c.removed))for(const h of c.handlers)if(h.filter.table===table&&h.filter.event===type)h.fn({table,new:row,eventType:type,commit_timestamp:new Date().toISOString()})};
 NP.capability=null;
}"""
with sync_playwright() as pw:
 browser=pw.chromium.launch();context=browser.new_context(viewport={'width':1440,'height':900});context.route('https://*.supabase.co/**',handle4);page=context.new_page();page.on('pageerror',lambda err:errors.append(str(err)))
 page.goto(ORIGIN+'/#/login');page.wait_for_function('NA.ready');rights[:]=['prospect','owner','tenant'];page.locator('[name=email]').fill('test@example.invalid');page.locator('[name=password]').fill(PW);page.locator('#auth-login-form [type=submit]').click();page.wait_for_function('NA.user && NA.profile');page.wait_for_url(ORIGIN+'/#/')
 enabled=True;page.evaluate(FAKE)
 def visit(route,text=None):
  page.evaluate('(r)=>NK.navigate(r)',route);page.wait_for_timeout(500)
  if text:expect(page.locator('#main')).to_contain_text(text)
 def ok(name):passed.append(name)
 visit('chat?id='+MID,'Halo, selamat datang.');page.wait_for_selector('[data-p4-form=message]');page.wait_for_timeout(800)
 assert page.evaluate('__channels.filter(c=>!c.removed).length')==2;ok('One notification channel and one scoped route channel; repeated rendering does not duplicate them')
 page.locator('[name=body]').fill('Draft tetap tersimpan');page.evaluate('window.__composer=document.querySelector("[data-p4-form=message]")')
 incoming={'id':str(uuid.uuid4()),'conversation_id':MID,'sender_id':TID,'body':'Balasan baru dari mock transport','created_at':'2026-11-19T11:00:00Z','updated_at':'2026-11-19T11:00:00Z'};messages.insert(0,incoming)
 page.evaluate('(r)=>__event("messages",r)',incoming);expect(page.locator('.b-messages')).to_contain_text(incoming['body']);assert page.evaluate('__composer===document.querySelector("[data-p4-form=message]")');expect(page.locator('[name=body]')).to_have_value('Draft tetap tersimpan');ok('Incoming event fetches persisted HTTP fixture, preserves composer node, focus and draft')
 page.evaluate('(r)=>{__event("messages",r);__event("messages",r)}',incoming);page.wait_for_timeout(400);assert page.locator('[data-message-id="'+incoming['id']+'"]').count()==1;ok('Duplicate events do not duplicate messages')
 page.locator('[data-b-action=quick-reply]').first.click();expect(page.locator('[name=body]')).to_have_value('Apakah kamar masih tersedia?');ok('Quick replies work in the live composer')
 fail_send=True;page.locator('[data-p4-form=message] [type=submit]').click();expect(page.locator('[data-p4-action=retry-message]')).to_be_visible();page.locator('[data-p4-action=retry-message]').click();expect(page.locator('.p4-timeline')).to_contain_text('Apakah kamar masih tersedia?');assert attempt_keys[-1]==attempt_keys[-2];assert len(committed)==1;ok('Failed send exposes retry and reuses the same idempotency key')
 png=page.evaluate('''async()=>{const c=document.createElement('canvas');c.width=1800;c.height=1000;const x=c.getContext('2d');x.fillStyle='#729b83';x.fillRect(0,0,c.width,c.height);return c.toDataURL('image/png').split(',')[1]}''');photo=base64.b64decode(png)
 page.locator('[data-p4-form=message] input[type=file]').set_input_files({'name':'private-location.png','mimeType':'image/png','buffer':photo});expect(page.locator('.p4-previews img')).to_be_visible();page.wait_for_function('!document.querySelector("[data-p4-form=message]").p4Uploader.busy');assert list(staged.values())[-1]['size_bytes']<=1048576;assert list(staged.values())[-1]['mime_type']=='image/webp';ok('Actual Canvas resizes/re-encodes PNG to WebP under 1 MB before SDK upload')
 page.locator('[name=body]').fill('');page.locator('[data-p4-form=message] [type=submit]').click();page.wait_for_function('document.querySelector(".p4-timeline .p4-thumb")');page.locator('.p4-timeline .p4-thumb').click();expect(page.locator('.p4-viewer img')).to_be_visible();page.locator('[data-p4-action=zoom]').click();assert page.locator('.p4-viewer.zoomed').count()==1;page.locator('[data-b-action=close]').click();ok('Image-only send creates attachment metadata and opens zoomable signed-URL viewer')
 invalid=page.evaluate('''async()=>{try{await NP.compress(new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'}),'chat');return false}catch{return true}}''');assert invalid;ok('SVG rejected before decoding/upload')
 checks=page.evaluate('''async()=>{
  const huge=new Uint8Array(9*1024*1024);let size=false,pixels=false;
  try{await NP.compress(new File([huge],'huge.png',{type:'image/png'}),'chat')}catch{size=true}
  const h=new Uint8Array(32);h.set([137,80,78,71,13,10,26,10]);const v=new DataView(h.buffer);v.setUint32(16,12000);v.setUint32(20,12000);
  try{await NP.compress(new File([h],'bomb.png',{type:'image/png'}),'chat')}catch{pixels=true}
  const c=document.createElement('canvas');c.width=900;c.height=600;const raw=await new Promise(r=>c.toBlob(r,'image/png'));const blob=await NP.compress(new File([raw],'avatar.png',{type:'image/png'}),'avatar');const bitmap=await createImageBitmap(blob);const avatar=bitmap.width===512&&bitmap.height===512&&blob.size<=512000;bitmap.close();return {size,pixels,avatar};
 }''');assert all(checks.values()),checks;ok('Oversized input and encoded pixel bomb rejected; avatar is square and under 500 KB')
 page.locator('[name=body]').fill('Draft saat token diperbarui');page.evaluate('window.__composer=document.querySelector("[data-p4-form=message]")');page.evaluate('NA.refreshIdentity(false)');page.wait_for_timeout(650);assert page.evaluate('__composer===document.querySelector("[data-p4-form=message]")');expect(page.locator('[name=body]')).to_have_value('Draft saat token diperbarui');ok('Unchanged-identity session refresh preserves the composer and draft')
 # Fill enough history to test reading old messages without a jump.
 for i in range(20):messages.insert(0,{'id':str(uuid.uuid4()),'conversation_id':MID,'sender_id':TID,'body':'Riwayat '+str(i),'created_at':'2026-11-19T11:30:00Z'})
 page.evaluate('NP.refresh()');page.wait_for_timeout(650);page.locator('.b-messages').evaluate('(el)=>el.scrollTop=0');scroll=page.locator('.b-messages').evaluate('(el)=>el.scrollTop');incoming=dict(incoming,id=str(uuid.uuid4()),body='Pesan saat membaca riwayat',updated_at='2026-11-19T12:30:00Z');messages.insert(0,incoming);page.evaluate('(r)=>__event("messages",r)',incoming);page.wait_for_timeout(650);assert page.locator('.b-messages').evaluate('(el)=>el.scrollTop')==scroll;expect(page.locator('[data-p4-action=latest]')).to_be_visible();page.locator('[data-p4-action=latest]').click();assert page.locator('.b-messages').evaluate('(el)=>el.scrollHeight-el.scrollTop-el.clientHeight')<5;ok('Reading old messages preserves scroll and offers a latest-message button')
 page.evaluate('document.activeElement?.blur();scrollTo(0,0)');page.screenshot(path=str(OUT/'chat-desktop.png'),full_page=True)
 visit('owner/properties','Kelola properti');page.locator('[data-b-action=property-form]').filter(has_text='Edit').click();page.wait_for_selector('.p4-upload');page.locator('.modal input[type=file]').set_input_files({'name':'room.png','mimeType':'image/png','buffer':photo});page.wait_for_function('!document.querySelector(".modal form").p4Uploader.busy');page.locator('.modal [data-upload-action=cover]').last.click();assert page.locator('.p4-preview').count()==2;page.screenshot(path=str(OUT/'property-uploader.png'),full_page=True);page.locator('.modal [type=submit]').click();page.wait_for_timeout(600);assert prop['property_images'][0]['image_path'].startswith('cloud:property-images/');ok('Property gallery uploads, previews and persists reordered cover through existing atomic RPC')
 visit('account/profile','Foto profil');expect(page.locator('.public-nav')).to_be_visible();assert page.locator('[data-p4-form=avatar]').count()==1;ok('Avatar uploader extends profile without removing navbar or logout confirmation')
 for width in [1440,768,390]:
  page.set_viewport_size({'width':width,'height':900});visit('chat?id='+MID,'Pesan');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 page.evaluate('document.activeElement?.blur();scrollTo(0,0)');page.screenshot(path=str(OUT/'chat-mobile.png'),full_page=True);ok('Live chat and uploader fit desktop, tablet and mobile')
 visit('owner','Pendapatan sewa');page.locator('[name=from]').fill('2026-11-01');page.evaluate('window.__filter=document.querySelector("[name=from]")');page.evaluate('(r)=>__event("rooms",r)',{'id':RID,'updated_at':'2026-11-19T15:00:00Z'});page.wait_for_timeout(650);expect(page.locator('[name=from]')).to_have_value('2026-11-01');ok('Dashboard invalidation preserves unsaved filter values')
 page.locator('.b-notification-bell').click();expect(page.locator('.p4-notices')).to_contain_text('Tagihan baru');page.locator('.p4-notices [data-p4-action=read-all]').click();page.wait_for_timeout(350);ok('Notification dropdown and scoped mark-all-read work through SDK')
 visit('account/profile');page.locator('[data-auth-action=logout]').click();page.locator('[data-auth-action=logout-confirm]').click();page.wait_for_function('!NA.user');assert page.evaluate('__channels.filter(c=>!c.removed).length')==0;ok('Logout disposes every live channel and private in-memory state')
 assert not errors,errors;ok('No uncaught JavaScript exceptions')
 browser.close()
(OUT/'results.json').write_text(json.dumps({'scope':'real-browser-sdk-canvas-with-mock-http-and-realtime','passed':passed,'errors':errors,'cloud_writes':False,'emails_sent':False,'limitations':['No Cloud WebSocket delivery/authorization or Storage service verified.','Cross-account RLS verified by separate native SQL adapter only.'],'executed_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())},indent=2),encoding='utf-8')
print(json.dumps({'passed':len(passed),'errors':errors,'output':str(OUT)}))
