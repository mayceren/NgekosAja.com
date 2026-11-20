(function(A,B,N,P,C){
 'use strict';
 let manager,identity='',ticket=0,batch,notificationTask,routeHash='',scopeData,scopeTask;
 const uuid=v=>/^[0-9a-f-]{36}$/i.test(v||'');
 const filter=(table,column,ids)=>{ids=[...new Set(ids.filter(uuid))].slice(0,100);return ids.length?{table,filter:column+'=in.('+ids.join(',')+')'}:null;};
 const scoped=async()=>{
  const key=B.scope();if(scopeData?.key===key&&scopeData.until>Date.now())return scopeData;
  if(scopeTask?.key===key)return scopeTask.promise;
  const epoch=P.epoch;
  const promise=(async()=>{
   const [rooms,agreements,conversations,invoices,properties]=await Promise.all([B.read('rooms',{size:100,select:'id,property_id'}),B.read('rental_agreements',{size:100,select:'id,room_id,tenant_id'}),B.services.chat.list(),B.services.invoice.list({size:100,select:'id'}),A.allowed('owner')?B.services.property.list({size:100,select:'id',filters:{owner_id:A.user.id}}):Promise.resolve([])]);
   const data={key,until:Date.now()+30000,rooms,agreements,conversations,invoices,properties};if(epoch===P.epoch&&key===B.scope())scopeData=data;return data;
  })().finally(()=>{if(scopeTask?.promise===promise)scopeTask=null;});scopeTask={key,promise};return promise;
 };
 P.connection=status=>{P.lastConnection=status;document.querySelectorAll('[data-p4-connection]').forEach(node=>{node.textContent=status==='SUBSCRIBED'?'Terhubung':'Menyambungkan kembali…';node.dataset.connected=String(status==='SUBSCRIBED');});};
 P.refresh=()=>{
  clearTimeout(batch);const scope=B.scope(),hash=location.hash;
  batch=setTimeout(()=>{if(scope!==B.scope()||hash!==location.hash||!P.enabled||!A.user)return;
   // A busy modal owns its own snapshot. Refresh the underlying view only.
   P.invalidate();P.liveHash=hash;N.render();
  },300);
 };
 P.notifications=async()=>{
  if(!A.user||!P.enabled||A.mode!=='connected')return;
  if(notificationTask)return notificationTask;
  const epoch=P.epoch,scope=B.scope();
  const task=(async()=>{
   const uid=A.user.id,client=B.client();const [rows,count]=await Promise.all([B.read('notifications',{size:6,filters:{user_id:uid}}),client.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',uid).is('read_at',null)]);
   if(epoch!==P.epoch||scope!==B.scope()||count.error)return;P.noticeRows=rows;
   document.querySelectorAll('.b-notification-bell').forEach(bell=>{
    bell.querySelectorAll('b').forEach(n=>n.remove());bell.setAttribute('aria-label',`Notifikasi, ${count.count||0} belum dibaca`);
    if(count.count){const badge=document.createElement('b');badge.textContent=count.count>99?'99+':String(count.count);bell.append(badge);}
    bell.href='#/notifications';bell.dataset.p4Action='notices';bell.setAttribute('aria-haspopup','dialog');
   });
   if(document.querySelector('.p4-notices'))P.noticePanel(true);
  })().catch(()=>{}).finally(()=>{if(notificationTask===task)notificationTask=null;});notificationTask=task;return task;
 };
 const toastSeen=new C.Seen(200,3600000);
 const event=(payload,key)=>{
  if(A.mode!=='connected'||!A.user)return;
  if(payload.table==='notifications'){
   const row=payload.new;if(row.user_id!==A.user.id)return;P.notifications();
   const c=B.params().get('id')||B.pageData?.conversation?.id;
   const active=A.route()[0]==='chat'&&row.dedupe_key?.startsWith('message:'+c+':');
   if(payload.eventType==='INSERT'&&!active&&!row.read_at&&toastSeen.accept(row.id)){
    B.load('ui-preferences',s=>B.services.settings.load(s)).then(rows=>{if(rows[0]?.notifications_enabled&&row.user_id===A.user?.id)N.toast(row.title);}).catch(()=>{});
   }
   // Notification routes cover unseen/new agreements and complaints outside current IDs.
   if(['owner','tenant','admin','offers','chat','notifications'].includes(A.route()[0])){scopeData=null;P.refresh();}
  }else{
   if(['rental_agreements','rooms','properties','invoices'].includes(payload.table))scopeData=null;
   P.refresh();
  }
 };
 P.reconcile=async()=>{
  const id=A.mode==='connected'?A.user?.id:'';
  if(id!==identity){manager?.dispose();manager=null;identity=id;ticket++;scopeData=null;scopeTask=null;}
  const hash=location.hash,mine=++ticket,epoch=P.epoch;
  if(!id||!await P.check()||mine!==ticket||epoch!==P.epoch||hash!==location.hash)return;
  if(!manager)manager=new C.Subscriptions(B.client(),event,status=>P.connection(status),key=>{if(key==='notices')P.notifications();else P.refresh();});
  const notices=[{table:'notifications',filter:'user_id=eq.'+id}],groups={notices};
  const [route]=A.route();
  if(['chat','owner','tenant','admin','offers','checkout'].includes(route)){
   try{
    const d=await scoped();if(mine!==ticket||epoch!==P.epoch||hash!==location.hash)return;
    let active=[];
    if(route==='chat'){
     active=[filter('messages','conversation_id',d.conversations.map(c=>c.id)),{table:'conversation_members',filter:'user_id=eq.'+id}];
    }else if(route==='admin'&&A.allowed('admin')){
     active=['rooms','rental_agreements','invoices','complaints','rental_offers','properties'].map(table=>({table}));
    }else{
     const agreements=d.agreements.map(a=>a.id),props=d.rooms.map(r=>r.property_id);
     active=[filter('invoices','agreement_id',agreements),filter('complaints','agreement_id',agreements),filter('rooms','property_id',props),filter('rental_agreements','room_id',d.rooms.map(r=>r.id))];
     active.push({table:'rental_offers',filter:(A.allowed('owner')&&route==='owner'?'owner_id':'tenant_id')+'=eq.'+id});
     if(route==='owner')active.push({table:'properties',filter:'owner_id=eq.'+id});
     if(route==='tenant')active.push({table:'rental_agreements',filter:'tenant_id=eq.'+id});
    }
    if(window.NPay?.enabled&&['checkout','owner','tenant','admin'].includes(route)){
     active.push({table:'payment_attempts',filter:'payer_id=eq.'+id});
     active.push(filter('transactions','invoice_id',d.invoices.map(i=>i.id)));
     if(route==='owner'||route==='checkout'&&A.allowed('owner')){const props=[...d.rooms.map(r=>r.property_id),...d.properties.map(p=>p.id)];active.push(filter('boost_campaigns','property_id',props),filter('payment_attempts','property_id',props),filter('transactions','property_id',props));}
     if(route==='admin'&&A.allowed('admin'))active.push({table:'payment_attempts'},{table:'transactions'},{table:'boost_campaigns'});
    }
    groups['route:'+hash]=active.filter(Boolean);
   }catch{/* Existing REST pages continue to work when scope discovery is offline. */}
  }
  if(mine!==ticket||epoch!==P.epoch||hash!==location.hash)return;
  routeHash=hash;manager.sync(groups);P.notifications();
 };
 P.liveResult=(root,result,route)=>{
  if(P.liveHash!==location.hash)return false;P.liveHash=null;
  if(route==='chat'&&P.patchChat)return P.patchChat(result);
  const template=document.createElement('template');template.innerHTML=result.html;
  const current=root.querySelector('#main'),next=template.content.querySelector('#main');if(!current||!next)return false;
  // Keep the active payment form/error target stable while its authorized request is pending.
  if(current.querySelector('[data-payment-form][data-busy="true"]'))return true;
  const positions={x:scrollX,y:scrollY},focus=document.activeElement,focusName=focus?.name,selection=focus?.selectionStart,forms=[];
  for(const f of current.querySelectorAll('form'))forms.push({key:f.dataset.backendForm||f.dataset.authForm,values:[...f.elements].filter(el=>el.name&&!['password','file','hidden','submit'].includes(el.type)).map(el=>({name:el.name,value:el.value,checked:el.checked}))});
  current.replaceChildren(...next.childNodes);
  for(const f of forms){const node=[...current.querySelectorAll('form')].find(el=>(el.dataset.backendForm||el.dataset.authForm)===f.key);if(!node)continue;for(const v of f.values){const el=[...node.elements].find(el=>el.name===v.name&&(!['checkbox','radio'].includes(el.type)||el.value===v.value));if(el){el.value=v.value;el.checked=v.checked;}}}
  if(focusName){const el=[...current.querySelectorAll('[name]')].find(el=>el.name===focusName);if(el){el.focus({preventScroll:true});try{el.setSelectionRange(selection,selection);}catch{}}}
  scrollTo(positions.x,positions.y);return true;
 };
 P.noticePanel=keep=>{
  const old=document.querySelector('.p4-notices');if(old&&!keep){old.remove();return;}
  old?.remove();const panel=document.createElement('aside');panel.className='p4-notices panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Notifikasi terbaru');
  panel.innerHTML=`<div class="b-actions"><strong>Notifikasi</strong><button class="icon-btn" data-p4-action="notices" aria-label="Tutup notifikasi">×</button></div>${(P.noticeRows||[]).map(r=>`<button class="p4-notice ${r.read_at?'':'b-unread'}" data-p4-action="notice" data-id="${N.e(r.id)}"><strong>${N.e(r.title)}</strong><span>${N.e(r.body)}</span><small>${B.date(r.created_at)}</small></button>`).join('')||'<p>Belum ada notifikasi.</p>'}<div class="b-actions"><button class="btn btn-outline" data-p4-action="read-all">Tandai semua dibaca</button><a class="btn btn-outline" href="#/notifications">Lihat riwayat</a></div>`;document.body.append(panel);
 };
 P.dispose=()=>{
  P.epoch++;P.enabled=false;P.capability=null;P.liveHash=null;P.lastConnection=null;ticket++;clearTimeout(batch);manager?.dispose();manager=null;identity='';scopeData=null;scopeTask=null;notificationTask=null;P.noticeRows=[];
  P.urls.clear();P.pending.clear();P.drafts.clear();toastSeen.clear();document.querySelector('.p4-notices')?.remove();
  for(const w of [...P.widgets])w.dispose(false);P.widgets.clear();
 };
 const after=B.afterRender;B.afterRender=(route,page)=>{after?.(route,page);P.afterRender?.(route,page);P.reconcile();};
 window.addEventListener('hashchange',()=>{P.liveHash=null;document.querySelector('.p4-notices')?.remove();manager?.sync(identity?{notices:[{table:'notifications',filter:'user_id=eq.'+identity}]}:{});P.reconcile();});
 window.addEventListener('offline',()=>P.connection('CLOSED'));
 window.addEventListener('online',()=>{manager?.dispose();manager=null;scopeData=null;P.reconcile();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&P.enabled){P.refresh();P.notifications();}});
 // The callback schedules outside the SDK auth lock, using the existing singleton.
 const start=A.start;A.start=async()=>{await start();if(A.mode==='connected'&&A.client&&!P.authWatch){P.authWatch=A.client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{if(A.mode!=='connected')return;if(session?.access_token)A.client?.realtime.setAuth(session.access_token).catch(()=>{});if(event==='SIGNED_OUT')P.dispose();else P.reconcile();},0);}).data.subscription;}};
 const dispose=A.dispose;A.dispose=()=>{P.authWatch?.unsubscribe();P.authWatch=null;dispose();};
})(window.NA,window.NB,window.NK,window.NP,window.NKLiveCore);
