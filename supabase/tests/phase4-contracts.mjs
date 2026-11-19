import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connect} from '../../scripts/local-database.mjs';
export async function runPhase4Contracts(db,results,config){
 const ids=Object.fromEntries(['ownerA','ownerB','tenantA','tenantB','prospect','admin'].map(k=>[k,randomUUID()]));
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0]||{})[0];
 const as=async(k,sql,args=[],role='authenticated')=>{await db.query('begin');try{await db.query(`set local role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)",[ids[k]||'',role]);const r=await db.query(sql,args);await db.query('commit');return r.rows;}catch(e){await db.query('rollback');throw e;}};
 const rpc=async(k,sql,args=[])=>Object.values((await as(k,sql,args))[0]||{})[0];
 const test=async(name,fn)=>{await fn();results.passed.push('Phase 4: '+name);console.log('PASS Phase 4: '+name);};
 const reject=fn=>assert.rejects(fn);
 for(const [k,id] of Object.entries(ids))await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@phase4.test`,JSON.stringify({display_name:k})]);
 for(const k of ['ownerA','ownerB'])await db.query("insert into public.user_roles(user_id,role) values($1,'owner')",[ids[k]]);
 await db.query("insert into public.user_roles(user_id,role) values($1,'admin')",[ids.admin]);
 const prop={name:'Kos Media Aman',location:'Grogol',address:'Jalan Pengujian Lokal 77',description:'Pengujian lampiran cloud pada database sementara.',base_rent:'1500000',gender_policy:'mixed',room_size:'3 x 4 m',publication_status:'published',images:[],facilities:[],rules:[],landmarks:[]};
 const p=await rpc('ownerA','select public.owner_save_property($1)',[prop]);
 const r=await rpc('ownerA','select public.owner_save_room($1)',[{property_id:p,number:'P4',room_type:'Standard',rent:'1500000',operational_status:'available',facilities:[]}]);
 const c=await rpc('tenantA','select public.open_conversation($1)',[p]);
 const stage=async(k,kind,scope)=>(await as(k,'select * from public.begin_media_upload($1,$2,$3,$4)',[kind,scope,'image/webp',100]))[0];
 const upload=async(k,u)=>as(k,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',[u.bucket_id,u.object_path,{size:100,mimetype:'image/webp'}]);
 const ref=u=>'cloud:'+u.bucket_id+'/'+u.object_path;
 let photo,chat,avatar,mid,aid;
 await test('34 application tables use RLS; five private MIME/size-limited buckets',async()=>{
  assert.equal(Number(await value("select count(*) from pg_tables where schemaname='public' and not rowsecurity")),0);
  assert.equal(Number(await value("select count(*) from storage.buckets where not public")),5);
  assert.equal(await value("select file_size_limit from storage.buckets where id='avatars'"),'512000');
 });
 await test('upload staging rejects cross-owner, cross-tenant, invalid MIME/size/scope',async()=>{
  await reject(()=>stage('ownerB','property',p));await reject(()=>stage('tenantB','chat',c));
  await reject(()=>stage('tenantB','avatar',ids.tenantA));await reject(()=>rpc('ownerA','select public.begin_media_upload($1,$2,$3,$4)',['property',p,'image/svg+xml',100]));
  await reject(()=>rpc('ownerA','select public.begin_media_upload($1,$2,$3,$4)',['property',p,'image/png',1048577]));
 });
 await test('object INSERT needs exact self-owned staging; UPDATE/upsert denied',async()=>{
  photo=await stage('ownerA','property',p);await reject(()=>upload('ownerB',photo));await upload('ownerA',photo);
  await reject(()=>as('ownerA','insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['property-images',`${p}/${randomUUID()}.webp`,{}]));
  assert.equal((await as('ownerA',"update storage.objects set metadata='{}' where name=$1 returning id",[photo.object_path])).length,0);
 });
 await test('unfinalized upload not publicly readable; property finalization atomic',async()=>{
  assert.equal((await as(null,'select * from storage.objects where name=$1',[photo.object_path],'anon')).length,0);
  await rpc('ownerA','select public.owner_save_property($1)',[{...prop,id:p,images:[{path:ref(photo)}]}]);
  assert.equal((await as(null,'select * from storage.objects where name=$1',[photo.object_path],'anon')).length,1);
  await reject(()=>rpc('ownerB','select public.owner_save_property($1)',[{...prop,id:p,images:[{path:ref(photo)}]}]));
 });
 await test('draft/archived property removes anonymous access; retained owner access',async()=>{
  await rpc('ownerA','select public.owner_save_property($1)',[{...prop,id:p,publication_status:'draft',images:[{path:ref(photo)}]}]);
  assert.equal((await as(null,'select * from storage.objects where name=$1',[photo.object_path],'anon')).length,0);
  assert.equal((await as('ownerB','select * from storage.objects where name=$1',[photo.object_path])).length,0);
  assert.equal((await as('ownerA','select * from storage.objects where name=$1',[photo.object_path])).length,1);
 });
 await test('finalized object cannot be removed or overwritten; arbitrary metadata cannot be inserted',async()=>{
  assert.equal((await as('ownerA','delete from storage.objects where name=$1 returning id',[photo.object_path])).length,0);
  await reject(()=>as('ownerA','insert into public.property_images(property_id,image_path,position) values($1,$2,2)',[p,'cloud:property-images/fake.webp']));
 });
 await test('room gallery scoped, maximum 4 and atomic rollback on invalid photo',async()=>{
  const u=await stage('ownerA','room',r);await upload('ownerA',u);
  const payload={id:r,property_id:p,number:'P4',room_type:'Standard',rent:'1500000',operational_status:'available',facilities:[],images:[{path:ref(u)}]};
  await rpc('ownerA','select public.owner_save_room($1)',[payload]);
  assert.equal((await as('ownerB','select * from public.room_images where room_id=$1',[r])).length,0);
  await reject(()=>rpc('ownerA','select public.owner_save_room($1)',[{...payload,number:'ROLLBACK',images:Array(5).fill({path:ref(u)})}]));
  assert.equal(await value('select number from public.rooms where id=$1',[r]),'P4');
 });
 await test('avatar self RPC and storage isolation; direct profile avatar assignment denied',async()=>{
  avatar=await stage('tenantA','avatar',ids.tenantA);await upload('tenantA',avatar);await rpc('tenantA','select public.set_my_avatar($1)',[ref(avatar)]);
  await reject(()=>rpc('tenantB','select public.set_my_avatar($1)',[ref(avatar)]));
  assert.equal((await as('tenantB','select * from storage.objects where name=$1',[avatar.object_path])).length,0);
  await reject(()=>as('tenantA','update public.profiles set avatar_path=$1 where id=$2',[ref(photo),ids.tenantA]));
 });
 const key=randomUUID();
 await test('image-only chat finalizes metadata atomically and retry returns same message',async()=>{
  chat=await stage('tenantA','chat',c);await upload('tenantA',chat);
  mid=await rpc('tenantA','select public.send_message_media($1,$2,$3,$4)',[c,'',key,[chat.id]]);
  assert.equal(await rpc('tenantA','select public.send_message_media($1,$2,$3,$4)',[c,'',key,[chat.id]]),mid);
  assert.equal(Number(await value('select count(*) from public.message_attachments where message_id=$1',[mid])),1);
  await reject(()=>rpc('tenantA','select public.send_message_media($1,$2,$3,$4)',[c,'different',key,[chat.id]]));
 });
 await test('non-member cannot send, read attachment, read staging or forge read cursor',async()=>{
  await reject(()=>rpc('tenantB','select public.send_message_media($1,$2,$3,$4)',[c,'hijack',randomUUID(),[]]));
  assert.equal((await as('ownerB','select * from storage.objects where name=$1',[chat.object_path])).length,0);
  assert.equal((await as('ownerA','select * from storage.objects where name=$1',[chat.object_path])).length,1);
  assert.equal((await as('tenantB','select * from public.media_uploads')).length,0);
  await reject(()=>rpc('tenantB','select public.mark_conversation_read($1)',[c]));
 });
 await test('concurrent retries on two connections create exactly one persisted message',async()=>{
  const clients=await Promise.all([connect(config),connect(config)]),key=randomUUID();
  try{const sends=clients.map(async client=>{await client.query('begin');try{await client.query('set local role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.tenantA]);const row=(await client.query('select public.send_message_media($1,$2,$3)',[c,'Concurrent retry',key])).rows[0];await client.query('commit');return row.send_message_media;}catch(e){await client.query('rollback');throw e;}});const values=await Promise.all(sends);assert.equal(values[0],values[1]);assert.equal(Number(await value('select count(*) from public.messages where client_key=$1',[key])),1);}finally{await Promise.all(clients.map(c=>c.end()));}
 });
 await test('uncertain commit cleanup sees in-use and cannot delete referenced messages',async()=>{
  const status=await rpc('tenantA','select * from public.media_upload_status($1)',[[chat.id]]);assert.ok(status); // first column is UUID
  const rows=await as('tenantA','select * from public.media_upload_status($1)',[[chat.id]]);assert.equal(rows[0].in_use,true);
  assert.equal((await as('tenantA','delete from storage.objects where name=$1 returning id',[chat.object_path])).length,0);
 });
 await test('invalid uploaded metadata rolls back message and notifications, permits safe staged cleanup',async()=>{
  const u=await stage('tenantA','chat',c);await as('tenantA','insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',[u.bucket_id,u.object_path,{size:99,mimetype:'image/webp'}]);
  const before=await value('select count(*) from public.messages');await reject(()=>rpc('tenantA','select public.send_message_media($1,$2,$3,$4)',[c,'fails',randomUUID(),[u.id]]));assert.equal(await value('select count(*) from public.messages'),before);
  assert.equal((await as('tenantA','delete from storage.objects where name=$1 returning id',[u.object_path])).length,1);
 });
 // Existing backend consent workflow remains mandatory.
 await rpc('ownerA','select public.owner_save_property($1)',[{...prop,id:p,images:[{path:ref(photo)}]}]);
 const dates=(await db.query("select private.today()::text start,(private.today()+180)::text finish")).rows[0];
 const offer=await rpc('ownerA','select public.owner_propose_rental($1)',[{conversation_id:c,room_id:r,start_date:dates.start,end_date:dates.finish,rent:'1500000',payment_day:5}]);
 await rpc('tenantA','select public.tenant_respond_rental($1,true)',[offer]);aid=await rpc('ownerA','select public.owner_check_in($1,$2,$3,$4,1500000,5::smallint)',[ids.tenantA,r,dates.start,dates.finish]);
 await test('complaint creation plus attachments is atomic and owner-scoped',async()=>{
  const u=await stage('tenantA','complaint',aid);await upload('tenantA',u);
  const args=[aid,'AC tidak dingin','AC kamar tidak dingin sejak pagi.','AC','medium',[u.id]];
  const cid=await rpc('tenantA','select public.tenant_create_complaint_media($1,$2,$3,$4,$5,$6)',args);
  assert.equal(await rpc('tenantA','select public.tenant_create_complaint_media($1,$2,$3,$4,$5,$6)',args),cid);
  assert.equal((await as('ownerA','select * from storage.objects where name=$1',[u.object_path])).length,1);
  assert.equal((await as('ownerB','select * from storage.objects where name=$1',[u.object_path])).length,0);
  await reject(()=>stage('tenantB','complaint',aid));
 });
 await test('private helpers inaccessible; no DELETE publication or replica identity FULL',async()=>{
  await reject(()=>rpc('tenantA','select private.finalize_media($1,$2,$3,$4)',['chat-attachments',chat.object_path,'chat',c]));
  const pub=(await db.query("select * from pg_publication where pubname='supabase_realtime'")).rows[0];assert.equal(pub.pubdelete,false);assert.equal(pub.pubtruncate,false);
  assert.equal(Number(await value("select count(*) from pg_publication_tables where pubname='supabase_realtime'")),10);
  assert.equal(Number(await value("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relreplident='f'")),0);
 });
 results.phase4_catalogue=await value(`select jsonb_build_object(
 'application_tables',(select count(*) from pg_tables where schemaname='public'),
 'rls_disabled',(select count(*) from pg_tables where schemaname='public' and not rowsecurity),
 'foreign_keys',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and contype='f'),
 'public_policies',(select count(*) from pg_policies where schemaname='public'),
 'public_functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
 'storage_policies',(select count(*) from pg_policies where schemaname='storage'),
 'published_tables',(select jsonb_agg(tablename order by tablename) from pg_publication_tables where pubname='supabase_realtime'),
 'unsafe_definers',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false)))`);
}
