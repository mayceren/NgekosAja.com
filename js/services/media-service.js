(function(A,B,N,C){
 'use strict';
 const P=window.NP={enabled:false,capability:null,epoch:0,urls:new Map(),widgets:new Set(),pending:new Map(),drafts:new Map()};
 P.invalidate=()=>{for(const key of [...B.cache.keys()])if(key.startsWith(B.scope()+':route:')||key.includes('notification-indicator'))B.cache.delete(key);};
 P.check=async()=>{
  if(A.mode!=='connected')return false;
  if(P.capability)return P.capability;
  const ticket=P.epoch,scope=B.scope();
  P.capability=(async()=>{try{const flags=await B.rpc('phase4_capabilities');if(ticket!==P.epoch||scope!==B.scope())return false;return P.enabled=flags?.version>=4&&!!flags.storage&&!!flags.realtime;}catch{return false;}})();
  return P.capability;
 };
 P.ref=C.parseRef;
 P.photo=(ref,alt='',extra='')=>`<img src="${N.e(B.image(ref))}" ${P.ref(ref)?`data-media-ref="${N.e(ref)}"`:''} alt="${N.e(alt)}" loading="lazy" ${extra}>`;
 P.signed=async ref=>{
  const media=P.ref(ref);if(!media)throw B.fail('Foto tidak tersedia.');
  const key=B.scope()+':'+ref,entry=P.urls.get(key);if(entry&&entry.until>Date.now()+15000)return entry.url;
  const epoch=P.epoch,scope=B.scope(),ttl=media.bucket==='property-images'?60:300;
  const {data,error}=await B.client().storage.from(media.bucket).createSignedUrl(media.path,ttl);if(error)throw error;
  if(epoch!==P.epoch||scope!==B.scope())throw Object.assign(new Error('stale'),{code:'STALE'});
  const url=new URL(data.signedUrl),base=new URL(A.config.supabaseUrl);
  if(url.origin!==base.origin||!url.pathname.startsWith('/storage/v1/object/sign/'+media.bucket+'/'))throw B.fail('Alamat foto tidak valid.');
  P.urls.set(key,{url:url.href,until:Date.now()+ttl*1000});while(P.urls.size>200)P.urls.delete(P.urls.keys().next().value);return url.href;
 };
 P.hydrate=async(root=document)=>{
  const epoch=P.epoch;for(const img of root.querySelectorAll('img[data-media-ref]:not([data-media-loading])')){
   const ref=img.dataset.mediaRef;if(!P.ref(ref))continue;img.dataset.mediaLoading='true';
   try{const url=await P.signed(ref);if(img.isConnected&&epoch===P.epoch&&img.dataset.mediaRef===ref){img.src=url;img.onerror=()=>{img.onerror=null;img.src=B.image();img.dataset.mediaError='true';img.alt='Foto belum dapat dimuat';};}}
   catch{if(img.isConnected){img.dataset.mediaError='true';img.title='Foto belum dapat dimuat. Buka kembali saat koneksi tersedia.';}}
  }
 };
 P.compress=async(file,kind)=>{
  const fail=message=>{throw B.fail(message);};
  if(!file||file.size<12||file.size>8*1024*1024)fail('Pilih gambar maksimal 8 MB.');
  const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer()),mime=C.format(bytes);
  if(!mime||mime!==file.type)fail('Gunakan JPEG, PNG, atau WebP yang valid.');
  // Read encoded dimensions before decoding (PNG/JPEG/WebP) to reject decompression bombs.
  const header=new Uint8Array(await file.arrayBuffer()),view=new DataView(header.buffer);let width=0,height=0;
  if(mime==='image/png'){width=view.getUint32(16);height=view.getUint32(20);}
  else if(mime==='image/jpeg'){
   let i=2;while(i+9<header.length){if(header[i++]!==255)continue;let marker=header[i++];while(marker===255)marker=header[i++];if(marker===217||marker===218)break;if(marker===216||marker===1||(marker>=208&&marker<=215))continue;
    const length=view.getUint16(i);if(length<2||i+length>header.length)break;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){height=view.getUint16(i+3);width=view.getUint16(i+5);break;}i+=length;
   }
  }else{
   const tag=String.fromCharCode(...header.slice(12,16));
   if(tag==='VP8X'){width=1+header[24]+(header[25]<<8)+(header[26]<<16);height=1+header[27]+(header[28]<<8)+(header[29]<<16);}
   else if(tag==='VP8 '&&header[23]===157&&header[24]===1&&header[25]===42){width=view.getUint16(26,true)&16383;height=view.getUint16(28,true)&16383;}
   else if(tag==='VP8L'&&header[20]===47){width=1+header[21]+((header[22]&63)<<8);height=1+(header[22]>>6)+(header[23]<<2)+((header[24]&15)<<10);}
  }
  if(!width||!height||width>12000||height>12000||width*height>24000000)fail('Dimensi gambar tidak valid atau melebihi 24 megapiksel.');
  let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{fail('Gambar rusak atau tidak dapat dibaca.');}
  try{
   const max=kind==='avatar'?512:['chat','complaint'].includes(kind)?1200:2048,canvas=document.createElement('canvas');
   const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
   canvas.width=kind==='avatar'?Math.min(512,bitmap.width,bitmap.height):Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=kind==='avatar'?canvas.width:Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');if(!ctx)fail('Browser tidak mendukung pemrosesan gambar.');
   if(kind==='avatar'){const size=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,canvas.width,canvas.height);}else ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const limit=kind==='avatar'?512000:1048576;
   for(const quality of [.85,.7,.55,.4]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob&&['image/webp','image/png','image/jpeg'].includes(blob.type)&&blob.size<=limit)return blob;}
   fail('Gambar masih terlalu besar setelah kompresi. Pilih foto yang lebih kecil.');
  }finally{bitmap.close();}
 };
 P.upload=async(file,kind,scope)=>{
  const epoch=P.epoch,identity=B.scope(),blob=await P.compress(file,kind);
  if(epoch!==P.epoch||identity!==B.scope())throw Object.assign(new Error('stale'),{code:'STALE'});
  let row=await B.rpc('begin_media_upload',{media_kind:kind,target_scope:scope,file_mime:blob.type,file_size:blob.size});row=Array.isArray(row)?row[0]:row;
  const ref='cloud:'+row.bucket_id+'/'+row.object_path;if(!P.ref(ref))throw B.fail('Referensi unggahan ditolak.');
  try{
   const {error}=await B.client().storage.from(row.bucket_id).upload(row.object_path,blob,{contentType:blob.type,upsert:false,cacheControl:'60'});if(error)throw error;
   if(epoch!==P.epoch||identity!==B.scope())throw Object.assign(new Error('stale'),{code:'STALE'});
   return {id:row.id,ref,preview:URL.createObjectURL(blob)};
  }catch(error){if(epoch===P.epoch&&identity===B.scope())await P.cleanup([row.id]);throw error;}
 };
 P.cleanup=async ids=>{
  ids=ids.filter(id=>![...P.pending.values()].some(p=>p.ids?.includes(id)));
  if(!ids.length||!A.user||A.mode!=='connected')return;
  const epoch=P.epoch,scope=B.scope();
  try{const rows=await B.rpc('media_upload_status',{upload_ids:ids});if(epoch!==P.epoch||scope!==B.scope())return;
   for(const row of rows){if(row.in_use||!row.object_exists)continue;await B.client().storage.from(row.bucket_id).remove([row.object_path]);}
  }catch{/* Keep uncertain objects. Never guess whether the transaction committed. */}
 };
 P.viewer=async ref=>{
  B.modal('Foto',`<div class="p4-viewer" role="region" aria-label="Foto diperbesar">${P.photo(ref,'Foto diperbesar')}</div><div class="b-actions"><button type="button" class="btn btn-outline" data-p4-action="zoom">Perbesar / perkecil</button><button type="button" class="btn btn-outline" data-p4-action="retry-photo">Muat ulang foto</button></div>`,true);await P.hydrate(document.getElementById('modal-root'));
 };
 const clear=A.clearIdentity;A.clearIdentity=()=>{P.dispose?.();clear();};
})(window.NA,window.NB,window.NK,window.NKLiveCore);
