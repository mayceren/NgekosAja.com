(function(A,B,N,P){
 'use strict';
 const e=N.e,button=(label,action,id='')=>`<button type="button" class="btn btn-outline" data-p4-action="${action}" data-id="${e(id)}">${label}</button>`;
 class Uploader {
  constructor(form,{kind,scope,refs=[],max=4}){
   this.form=form;this.kind=kind;this.scope=scope;this.max=max;this.items=refs.map(ref=>({ref}));this.busy=false;this.disposed=false;
   this.node=document.createElement('fieldset');this.node.className='p4-upload';this.node.innerHTML=`<legend>${kind==='avatar'?'Foto profil':kind==='property'?'Galeri properti':kind==='room'?'Galeri kamar':'Lampiran foto'}</legend><label class="p4-drop" tabindex="0">Pilih atau seret foto ke sini<input type="file" accept="image/jpeg,image/png,image/webp" ${max>1?'multiple':''}><small>JPEG, PNG, WebP · maksimal 8 MB sebelum kompresi · ${max} foto</small></label><p class="field-help" aria-live="polite"></p><div class="p4-previews"></div>`;
   form.querySelector('button[type="submit"]')?.before(this.node);if(!this.node.isConnected)form.append(this.node);
   this.node.querySelector('input').addEventListener('change',async ev=>{await this.add([...ev.target.files]);ev.target.value='';});
   const drop=this.node.querySelector('.p4-drop');drop.addEventListener('keydown',ev=>{if(['Enter',' '].includes(ev.key)){ev.preventDefault();drop.querySelector('input').click();}});
   for(const type of ['dragenter','dragover'])drop.addEventListener(type,ev=>{ev.preventDefault();drop.classList.add('dragging');});
   drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));drop.addEventListener('drop',ev=>{ev.preventDefault();drop.classList.remove('dragging');this.add([...ev.dataTransfer.files]);});
   this.node.addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-upload-action]');if(!btn)return;ev.preventDefault();if(this.busy)return;const i=Number(btn.dataset.index),item=this.items[i];if(!item)return;
    if(btn.dataset.uploadAction==='remove'){this.items.splice(i,1);this.release(item);}
    else if(btn.dataset.uploadAction==='cover'){this.items.splice(i,1);this.items.unshift(item);}
    else if(btn.dataset.uploadAction==='left'&&i>0)[this.items[i-1],this.items[i]]=[this.items[i],this.items[i-1]];
    else if(btn.dataset.uploadAction==='right'&&i<this.items.length-1)[this.items[i+1],this.items[i]]=[this.items[i],this.items[i+1]];
    this.render();
   });
   P.widgets.add(this);form.p4Uploader=this;this.render();
  }
  render(){
   const target=this.node.querySelector('.p4-previews');target.innerHTML=this.items.map((item,i)=>`<div class="p4-preview">${item.preview?`<img src="${e(item.preview)}" alt="Pratinjau foto ${i+1}">`:P.photo(item.ref,'Foto '+(i+1))}<small>${i===0&&['room','property'].includes(this.kind)?'Cover':`Foto ${i+1}`}</small><div>${['room','property'].includes(this.kind)?`<button type="button" data-upload-action="cover" data-index="${i}" aria-label="Jadikan cover foto ${i+1}">★</button><button type="button" data-upload-action="left" data-index="${i}" aria-label="Geser foto ke kiri">←</button><button type="button" data-upload-action="right" data-index="${i}" aria-label="Geser foto ke kanan">→</button>`:''}<button type="button" data-upload-action="remove" data-index="${i}" aria-label="Hapus foto ${i+1}">×</button></div></div>`).join('');
   const images=this.form.elements.namedItem('images');if(images&&this.kind==='property')images.value=this.items.map(i=>i.ref).join('\n');
   this.node.querySelector('input').disabled=this.busy;P.hydrate(this.node);
  }
  async add(files){
   if(this.busy||this.disposed)return;const status=this.node.querySelector('[aria-live]');
   if(!this.scope){status.textContent='Simpan data terlebih dahulu, lalu buka Edit untuk mengunggah foto.';return;}
   if(this.items.length+files.length>this.max){status.textContent=`Maksimal ${this.max} foto. Hapus pilihan lama untuk menggantinya.`;return;}
   this.busy=true;this.render();status.textContent='Memproses dan mengunggah foto…';
   try{for(const file of files){const item=await P.upload(file,this.kind,this.scope);if(this.disposed){URL.revokeObjectURL(item.preview);await P.cleanup([item.id]);break;}this.items.push(item);this.render();}if(!this.disposed)status.textContent='Foto siap. Simpan formulir untuk menyelesaikan perubahan.';}
   catch(error){if(!this.disposed)status.textContent=B.error(error)||'Unggahan dibatalkan.';}
   finally{this.busy=false;if(!this.disposed)this.render();}
  }
  ids(){return this.items.filter(i=>i.id).map(i=>i.id);}
  refs(){return this.items.map(i=>({path:i.ref,alt:''}));}
  release(item,cleanup=true){if(item.preview)URL.revokeObjectURL(item.preview);if(cleanup&&item.id)P.cleanup([item.id]);}
  dispose(cleanup=true){if(this.disposed)return;this.disposed=true;P.widgets.delete(this);for(const item of this.items)this.release(item,cleanup);}
 }
 P.Uploader=Uploader;
 const loadWorkspace=B.loadWorkspace;B.loadWorkspace=async(role,page,signal)=>{
  const data=await loadWorkspace(role,page,signal);
  if(page==='rooms'&&await P.check()){
   const ids=data.rows.map(r=>r.id);if(ids.length){const images=await B.guardResponse(B.unwrap(B.client().from('room_images').select('*').in('room_id',ids).order('position')));for(const row of data.rows)row.room_images=images.filter(i=>i.room_id===row.id);}
  }
  return data;
 };
 const workspace=B.workspace;B.workspace=data=>{
  const template=document.createElement('template');template.innerHTML=workspace(data);
  if(['properties','listings','rooms'].includes(data.page)){
   for(const row of data.rows||[]){const images=data.page==='rooms'?row.room_images:row.property_images;
    const control=template.content.querySelector(`[data-id="${row.id}"]`),cell=control?.closest('tr')?.querySelector('td');
    if(cell&&images?.length){const box=document.createElement('div');box.className='p4-attachments';box.innerHTML=images.slice().sort((a,b)=>a.position-b.position).map(i=>P.thumb(i.image_path)).join('');cell.prepend(box);}
   }
  }
  return template.innerHTML;
 };
 const property=B.propertyForm;B.propertyForm=async id=>{await property(id);if(!await P.check())return;const form=document.querySelector('form[data-backend-form="property"]');if(!form)return;
  const input=form.elements.namedItem('images');input.closest('label')?.classList.add('p4-hidden');input.required=false;
  const note=form.querySelector('.field-help');if(note)note.textContent=id?'Foto cover berada pada urutan pertama. Foto lama tetap aman sampai perubahan disimpan.':'Simpan properti dahulu, lalu gunakan Edit untuk mengunggah foto.';
  new Uploader(form,{kind:'property',scope:id,refs:input.value.split('\n').filter(Boolean),max:8});
 };
 const room=B.roomForm;B.roomForm=async id=>{await room(id);if(!await P.check())return;const form=document.querySelector('form[data-backend-form="room"]');if(!form)return;const refs=id?await B.read('room_images',{filters:{room_id:id},order:'position',asc:true,size:4}):[];
  if(!form.isConnected)return;new Uploader(form,{kind:'room',scope:id,refs:refs.map(i=>i.image_path),max:4});
 };
 const complaint=B.complaintForm;B.complaintForm=async()=>{await complaint();if(!await P.check())return;const form=document.querySelector('form[data-backend-form="complaint"]');if(!form)return;
  form.querySelector('.field-help')?.remove();const select=form.elements.namedItem('agreement_id'),u=new Uploader(form,{kind:'complaint',scope:select.value,max:4});
  select.addEventListener('change',()=>{if(u.busy||u.items.length){select.value=u.scope;N.toast('Hapus lampiran dahulu sebelum mengganti masa sewa.');}else u.scope=select.value;});
 };
 const detail=B.complaintDetail;B.complaintDetail=async id=>{await detail(id);if(!await P.check())return;const attachments=await B.services.complaint.attachments(id);if(B.currentComplaint?.id!==id)return;
  const content=document.querySelector('.b-modal-body');if(!content)return;
  [...content.querySelectorAll('.field-help')].filter(n=>n.textContent.includes('referensi lampiran')).forEach(n=>n.remove());
  const gallery=document.createElement('div');gallery.className='p4-attachments';gallery.innerHTML=attachments.map(a=>P.thumb('cloud:complaint-attachments/'+a.storage_path)).join('');content.querySelector('p')?.after(gallery);P.hydrate(gallery);
 };
 P.thumb=ref=>`<button type="button" class="p4-thumb" data-p4-action="photo" data-ref="${e(ref)}" aria-label="Perbesar foto">${P.photo(ref,'Lampiran foto')}</button>`;
 P.beforeForm=async(kind,form,d)=>{
  const u=form.p4Uploader;if(u?.busy)throw B.fail('Tunggu unggahan foto selesai.');
  if(kind==='complaint'&&u?.items.length){await B.rpc('tenant_create_complaint_media',{target_agreement:d.agreement_id,ticket_title:d.title.trim(),ticket_description:d.description.trim(),ticket_category:d.category,ticket_urgency:d.urgency,upload_ids:u.ids()});return true;}
  if(kind==='room'&&u)d.images=u.refs();return false;
 };
 P.profile=()=>{
  if(!P.enabled||!A.user||A.route().join('/')!=='account/profile')return;
  const main=document.querySelector('#main');if(!main||main.querySelector('[data-p4-form="avatar"]'))return;
  const node=document.createElement('section');node.className='panel b-panel';node.innerHTML=`<h2>Foto profil</h2><p>Foto dipotong persegi dari bagian tengah. Maksimal 500 KB setelah diproses.</p><div class="p4-current-avatar">${A.profile?.avatar_path?P.photo(A.profile.avatar_path,A.profile.display_name):N.avatar(A.profile?.display_name||'Pengguna')}</div><form data-p4-form="avatar"><p class="auth-form-error" role="alert"></p><button class="btn btn-primary" type="submit">Simpan foto</button>${button('Hapus foto','remove-avatar')}</form>`;
  main.append(node);new Uploader(node.querySelector('form'),{kind:'avatar',scope:A.user.id,max:1});P.hydrate(node);
 };
 const observer=new MutationObserver(()=>{for(const u of [...P.widgets])if(!u.form.isConnected)u.dispose();});observer.observe(document.getElementById('modal-root'),{childList:true,subtree:true});
 document.addEventListener('submit',async ev=>{
  const form=ev.target;if(A.mode!=='connected'||form.dataset.p4Form!=='avatar')return;ev.preventDefault();ev.stopImmediatePropagation();if(form.dataset.busy)return;
  form.dataset.busy='true';const button=form.querySelector('button[type=submit]');button.disabled=true;
  try{const u=form.p4Uploader;if(u.busy||!u.items.length)throw B.fail('Pilih foto dan tunggu unggahan selesai.');await B.rpc('set_my_avatar',{image_ref:u.items[0].ref});await A.resolveIdentity(true);u.dispose();P.invalidate();N.render();N.toast('Foto profil disimpan.');}
  catch(error){form.querySelector('[role=alert]').textContent=B.error(error);}finally{delete form.dataset.busy;button.disabled=false;}
 },true);
 document.addEventListener('click',async ev=>{
  const node=ev.target.closest('[data-p4-action]');if(!node||A.mode!=='connected')return;
  ev.preventDefault();if(node.disabled)return;const action=node.dataset.p4Action,scope=B.scope();
  try{
   if(action==='photo')await P.viewer(node.dataset.ref);
   else if(action==='zoom')document.querySelector('.p4-viewer')?.classList.toggle('zoomed');
   else if(action==='retry-photo'){document.querySelectorAll('#modal-root [data-media-loading]').forEach(el=>{delete el.dataset.mediaLoading;P.urls.delete(B.scope()+':'+el.dataset.mediaRef);});P.hydrate(document.getElementById('modal-root'));}
   else if(action==='remove-avatar'){node.disabled=true;await B.rpc('set_my_avatar',{image_ref:null});await A.resolveIdentity(true);N.render();N.toast('Foto profil dihapus.');}
   else if(action==='notices')P.noticePanel();
   else if(action==='notice'){
    const r=P.noticeRows?.find(r=>r.id===node.dataset.id);if(!r)return;await B.unwrap(B.client().from('notifications').update({read_at:new Date().toISOString()}).eq('id',r.id).eq('user_id',A.user.id));
    if(scope!==B.scope())return;document.querySelector('.p4-notices')?.remove();P.invalidate();const target=r.route?.replace(/^#\//,'');N.navigate(target&&/^[a-z0-9/?=&_-]+$/i.test(target)?target:'notifications');P.notifications();
   }else if(action==='read-all'){await B.unwrap(B.client().from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',A.user.id).is('read_at',null));P.notifications();P.refresh();}
   else if(action==='latest')P.latest?.();
   else if(action==='retry-message')await P.retryMessage?.(node.dataset.id);
  }catch(error){if(scope===B.scope())N.toast(B.error(error),true);}finally{if(node.isConnected)node.disabled=false;}
 });
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape')document.querySelector('.p4-notices')?.remove();});
 P.afterRender=async()=>{
  for(const u of [...P.widgets])if(!u.form.isConnected)u.dispose();
  if(A.mode!=='connected')return;
  const epoch=P.epoch;if(!await P.check()||epoch!==P.epoch)return;
  P.profile();if(P.lastConnection)P.connection(P.lastConnection);
  if(A.profile?.avatar_path){document.querySelectorAll('.nav-actions .avatar,.sidebar .avatar').forEach(node=>{if(!node.querySelector('img'))node.innerHTML=P.photo(A.profile.avatar_path,A.profile.display_name);});}
  P.initChat?.();P.hydrate();
 };
})(window.NA,window.NB,window.NK,window.NP);
