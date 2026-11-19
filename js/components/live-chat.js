(function(A,B,N,P){
 'use strict';
 const e=N.e;let mounted='',lastRead='';
 const time=value=>new Date(value).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'});
 const directory=list=>list.map(c=>`<a class="b-conversation ${c.id===B.pageData?.conversation?.id?'active':''}" href="#/chat?id=${e(c.id)}"><strong>${e(c.counterpart_name)}</strong><small>${e(c.last_message||c.property_name)}</small><small>${e(c.property_name)} · ${B.date(c.updated_at)}</small>${Number(c.unread_count)>0?N.badge(`${c.unread_count} belum dibaca`):''}</a>`).join('');
 const message=msg=>`<article data-message-id="${e(msg.id)}" data-client-key="${e(msg.client_key||'')}" class="b-message ${msg.sender_id===A.user.id?'mine':''}">${msg.body?`<p>${e(msg.body)}</p>`:''}<div class="p4-attachments">${(msg.message_attachments||[]).map(a=>P.thumb('cloud:chat-attachments/'+a.storage_path)).join('')}</div><small>${time(msg.created_at)}</small></article>`;
 const timeline=rows=>{let date='';return rows.slice().reverse().map(msg=>{const d=B.date(msg.created_at),separator=d!==date?`<p class="p4-date">${e(d)}</p>`:'';date=d;return separator+message(msg);}).join('');};
 const old=B.chatPage;
 B.chatPage=async signal=>{
  if(!await P.check())return old(signal);
  const list=await B.services.chat.list(signal),selected=B.params().get('id')||list[0]?.id,conversation=list.find(c=>c.id===selected);
  const messages=conversation?await B.read('messages',{select:'*,message_attachments(*)',filters:{conversation_id:selected},size:30,page:B.page()},signal):[];
  const avatars=conversation?await B.rpc('conversation_avatars',{target_conversation:selected},signal):[];
  B.pageData={conversations:list,conversation,messages,avatars};
  return B.personal('Pesan',`<p class="field-help" data-p4-connection role="status">Menyambungkan pesan…</p><div class="b-chat p4-chat"><aside>${B.input('chat-search','Cari percakapan','','search','data-b-chat-search')}<div class="p4-directory">${directory(list)||N.empty('Belum ada percakapan','Hubungi pemilik melalui detail kos.')}</div></aside><section>${conversation?`<h2>${e(conversation.counterpart_name)}</h2><p>${e(conversation.property_name)}</p><div class="b-messages" tabindex="0" aria-label="Riwayat pesan"><div class="p4-timeline">${timeline(messages)||'<p>Mulai percakapan dengan pengelola.</p>'}</div><div class="p4-pending" aria-live="polite"></div></div><div class="p4-newest">${B.page()?'<a class="btn btn-outline" href="#/chat?id='+e(selected)+'">Kembali ke pesan terbaru</a>':'<button type="button" class="btn btn-outline" data-p4-action="latest" hidden>Pesan baru ↓</button>'}</div>${B.pager(messages.length,30)}<form class="b-form" data-p4-form="message">${B.hidden('conversation_id',selected)}${B.textarea('body','Pesan','','maxlength="1000" rows="3"')}<p class="auth-form-error" role="alert"></p><button class="btn btn-primary" type="submit">Kirim pesan</button></form><div class="b-actions">${B.button('Apakah kamar masih tersedia?','quick-reply','Apakah kamar masih tersedia?')}${B.button('Saya ingin jadwal survei','quick-reply','Saya ingin membuat jadwal survei kos.')}</div>`:N.empty('Pilih percakapan','Riwayat pesan akan tampil di sini.')}</section></div>`);
 };
 P.pendingMarkup=()=>{
  const target=document.querySelector('.p4-pending'),id=document.querySelector('[data-p4-form="message"] [name="conversation_id"]')?.value;if(!target)return;
  target.innerHTML=[...P.pending.values()].filter(p=>p.conversation===id).map(p=>`<article class="b-message mine p4-message-pending"><p>${e(p.body||'Lampiran foto')}</p><small>${p.status==='sending'?'Mengirim…':'Pesan belum terkirim. Coba kembali.'}</small>${p.status==='failed'?`<button type="button" class="btn btn-outline" data-p4-action="retry-message" data-id="${e(p.key)}">Kirim ulang</button>`:''}</article>`).join('');
 };
 const bottom=()=>{const el=document.querySelector('.b-messages');return !!el&&el.scrollHeight-el.scrollTop-el.clientHeight<80;};
 P.latest=()=>{if(B.page()){N.navigate('chat?id='+B.pageData?.conversation?.id);return;}const el=document.querySelector('.b-messages');if(el)el.scrollTop=el.scrollHeight;const b=document.querySelector('[data-p4-action="latest"]');if(b)b.hidden=true;read();};
 const read=async()=>{
  if(document.hidden||B.page()||!bottom()||A.route()[0]!=='chat')return;
  const c=B.pageData?.conversation,latest=B.pageData?.messages?.[0]?.id;
  if(!c||!latest||lastRead===A.user?.id+':'+latest||!Number(c.unread_count))return;
  const scope=B.scope();lastRead=A.user.id+':'+latest;
  try{await B.rpc('mark_conversation_read',{target_conversation:c.id});if(scope===B.scope()){c.unread_count=0;P.notifications();}}catch{lastRead='';}
 };
 P.initChat=()=>{
  const form=document.querySelector('[data-p4-form="message"]');if(!form)return;const conversation=form.elements.namedItem('conversation_id').value;
  if(!form.p4Uploader){new P.Uploader(form,{kind:'chat',scope:conversation,max:4});form.elements.namedItem('body').value=P.drafts.get(conversation)||'';form.elements.namedItem('body').addEventListener('input',ev=>P.drafts.set(conversation,ev.target.value));
   document.querySelector('.b-messages').addEventListener('scroll',read,{passive:true});
   if(!B.page())P.latest();else document.querySelector('.b-messages').scrollTop=0;
  }
  mounted=conversation;P.pendingMarkup();P.hydrate();read();
  const counterpart=B.pageData?.avatars?.find(p=>p.user_id!==A.user.id),heading=document.querySelector('.p4-chat section h2');
  if(counterpart?.avatar_path&&heading&&!heading.querySelector('img'))heading.insertAdjacentHTML('afterbegin',P.photo(counterpart.avatar_path,counterpart.display_name,'class="p4-chat-avatar"'));
 };
 P.patchChat=result=>{
  const data=result.data||{},conversation=data.conversation;
  const form=document.querySelector('[data-p4-form="message"]');
  // Changing the selected conversation is a normal navigation, never a live patch.
  if(!form||conversation?.id!==form.elements.namedItem('conversation_id').value)return false;
  const list=document.querySelector('.p4-directory'),search=document.querySelector('[data-b-chat-search]')?.value||'';
  B.pageData=data;if(list){list.innerHTML=directory(data.conversations||[]);for(const node of list.querySelectorAll('.b-conversation'))node.hidden=!node.textContent.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id'));}
  const scroller=document.querySelector('.b-messages'),wasBottom=bottom(),top=scroller.scrollTop;
  const target=document.querySelector('.p4-timeline'),existing=new Map([...target.querySelectorAll('[data-message-id]')].map(el=>[el.dataset.messageId,el]));
  // Keep message elements already in the DOM. Reorder by server result and add only new IDs.
  const fragment=document.createDocumentFragment();let date='',newIncoming=false;
  for(const msg of (data.messages||[]).slice().reverse()){
   if(msg.client_key&&P.pending.has(msg.client_key)){const pending=P.pending.get(msg.client_key);P.pending.delete(msg.client_key);P.ackMessage(pending);}
   const d=B.date(msg.created_at);if(d!==date){const separator=document.createElement('p');separator.className='p4-date';separator.textContent=d;fragment.append(separator);date=d;}
   let node=existing.get(msg.id);if(!node){const t=document.createElement('template');t.innerHTML=message(msg);node=t.content.firstElementChild;if(msg.sender_id!==A.user.id)newIncoming=true;}fragment.append(node);
  }
  target.replaceChildren(fragment);P.pendingMarkup();P.hydrate(target);
  if(wasBottom&&!B.page())P.latest();else{scroller.scrollTop=top;if(newIncoming){const btn=document.querySelector('[data-p4-action="latest"]');if(btn)btn.hidden=false;}}
  read();return true;
 };
 P.ackMessage=pending=>{
  const form=document.querySelector('[data-p4-form="message"]');if(!form||form.elements.namedItem('conversation_id').value!==pending.conversation)return;
  const input=form.elements.namedItem('body');if(input.value===pending.body){input.value='';P.drafts.delete(pending.conversation);}
  form.querySelector('[role="alert"]').textContent='';
  const u=form.p4Uploader;if(u){const ids=new Set(pending.ids);u.items=u.items.filter(item=>{if(ids.has(item.id)){u.release(item,false);return false;}return true;});u.render();}
 };
 P.retryMessage=async key=>{
  const pending=P.pending.get(key);if(!pending||pending.status==='sending')return;pending.status='sending';P.pendingMarkup();const epoch=P.epoch,scope=B.scope();
  const current=document.querySelector('[data-p4-form="message"] [role="alert"]');if(current)current.textContent='';
  try{
   await B.rpc('send_message_media',{target_conversation:pending.conversation,message_body:pending.body,request_key:pending.key,upload_ids:pending.ids});
   if(epoch!==P.epoch||scope!==B.scope())return;
   P.pending.delete(key);P.ackMessage(pending);P.pendingMarkup();P.refresh();
  }catch(error){if(epoch!==P.epoch||scope!==B.scope())return;pending.status='failed';P.pendingMarkup();const form=document.querySelector('[data-p4-form="message"]');if(form)form.querySelector('[role="alert"]').textContent=B.error(error);}
 };
 document.addEventListener('submit',async ev=>{
  const form=ev.target;if(A.mode!=='connected'||form.dataset.p4Form!=='message')return;ev.preventDefault();ev.stopImmediatePropagation();
  const u=form.p4Uploader,body=form.elements.namedItem('body').value.trim(),conversation=form.elements.namedItem('conversation_id').value;
  if(u.busy){form.querySelector('[role=alert]').textContent='Tunggu unggahan foto selesai.';return;}
  if(!body&&!u.items.length){form.querySelector('[role=alert]').textContent='Tulis pesan atau pilih foto.';return;}
  const ids=u.ids(),existing=[...P.pending.values()].find(p=>p.conversation===conversation&&p.body===body&&JSON.stringify(p.ids)===JSON.stringify(ids));
  if(existing){if(existing.status==='failed')P.retryMessage(existing.key);return;}
  const key=crypto.randomUUID();P.pending.set(key,{key,body,conversation,ids,status:'ready'});await P.retryMessage(key);
 },true);
})(window.NA,window.NB,window.NK,window.NP);
