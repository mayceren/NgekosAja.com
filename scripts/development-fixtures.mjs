import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

// Stable illustrative IDs for NON-Auth records only. Auth IDs always come from Auth Admin.
export function fixtureId(label) {
  const h=createHash('sha256').update(`ngekosaja-phase1:${label}`).digest('hex').slice(0,32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}`;
}
export function fixtureSource() {
  // Fresh code seed only; never browser LocalStorage, imported files, or user accounts.
  const context=vm.createContext({window:{NK:{}},Date,console});
  for(const file of ['js/data.js','js/schema.js']) vm.runInContext(readFileSync(file,'utf8'),context,{filename:file});
  return JSON.parse(JSON.stringify(context.window.NK.seed()));
}
export function fixtureAccounts(source) {
  return source.users.map(u=>({...u,email:`phase1-${u.id}@fixtures.ngekosaja.invalid`}));
}
export async function populateDevelopmentFixtures(client, source, identities) {
  const id=fixtureId;
  const actor=key=>{ if(!identities[key]) throw new Error(`Auth identity belum tersedia: ${key}`); return identities[key]; };
  // Caller controls BEGIN/COMMIT. Every fixture has stable keys and never updates existing history.
  const insert=async(table,row)=> {
    const names=Object.keys(row);
    const result=await client.query(`insert into public.${table} (${names.join(',')}) values (${names.map((_,i)=>'$'+(i+1)).join(',')}) on conflict do nothing returning id`,Object.values(row));
    return result.rowCount>0;
  };
  await client.query("select set_config('request.jwt.claim.role','service_role',true), set_config('request.jwt.claim.sub','',true)");
  for(const u of fixtureAccounts(source)) {
    await client.query('update public.profiles set display_name=$2,phone=$3 where id=$1',[actor(u.id),u.name,u.phone||null]);
    await client.query('select public.server_grant_role($1,$2)',[actor(u.id),u.role==='guest'?'prospect':u.role]);
  }
  const facilities=(await client.query('select id,name from public.facilities')).rows;
  const facility=name=>{ const found=facilities.find(f=>f.name===name);if(!found)throw new Error(`Master fasilitas belum di-seed: ${name}`);return found.id; };
  for(const p of source.properties) {
    await insert('properties',{id:id(p.id),owner_id:actor(p.ownerId),name:p.name,location:p.location,address:p.address,description:p.description,base_rent:p.price,gender_policy:{Campur:'mixed',Putra:'male',Putri:'female'}[p.type],room_size:p.size,publication_status:'published'});
    for(const [position,path] of p.photos.entries()) await insert('property_images',{id:id(`${p.id}-image-${position}`),property_id:id(p.id),image_path:path,alt_text:`Ilustrasi ${p.name}`,position});
    for(const [position,text] of p.rules.entries()) await insert('property_rules',{id:id(`${p.id}-rule-${position}`),property_id:id(p.id),rule_text:text,position});
    for(const [i,landmark] of p.nearby.entries()) await insert('property_landmarks',{id:id(`${p.id}-landmark-${i}`),property_id:id(p.id),name:landmark.name,distance_label:landmark.distance,is_illustrative:true});
    for(const name of p.facilities) await insert('property_facilities',{id:id(`${p.id}-facility-${name}`),property_id:id(p.id),facility_id:facility(name)});
    for(const [index,r] of p.rooms.entries()) {
      // Preserve inactive p8, add one maintenance room in otherwise empty space.
      const status=r.status==='Tidak aktif'?'inactive':(p.id==='p16'&&index===5?'maintenance':'available');
      await insert('rooms',{id:id(r.id),property_id:id(p.id),number:r.number,room_type:index%3===0?'Deluxe':r.type,rent:r.price,operational_status:status});
      for(const name of r.facilities) await insert('room_facilities',{id:id(`${r.id}-facility-${name}`),room_id:id(r.id),facility_id:facility(name)});
    }
  }
  for(const t of source.tenants) {
    await insert('tenants',{id:actor(t.id)});
    // Frontend seed has 6 months of invoices but shorter joinedAt; DB fixture aligns lease to history.
    const firstMonth=source.invoices.filter(i=>i.tenantId===t.id).map(i=>i.createdAt.slice(0,7)+'-01').sort()[0]||t.joinedAt;
    const start=firstMonth<t.joinedAt?firstMonth:t.joinedAt;
    await insert('rental_agreements',{id:id(`lease-${t.id}`),tenant_id:actor(t.id),room_id:id(t.roomId),start_date:start,end_date:t.endDate,rent:t.rent,payment_day:t.paymentDay});
    await insert('recurring_invoices',{id:id(`recurring-${t.id}`),agreement_id:id(`lease-${t.id}`),amount:t.rent,payment_day:t.paymentDay,start_month:start.slice(0,7)+'-01'});
  }
  for(const inv of source.invoices) {
    const t=source.tenants.find(t=>t.id===inv.tenantId),p=source.properties.find(p=>p.id===inv.propertyId),r=p.rooms.find(r=>r.id===t.roomId);
    // The legacy label/createdAt determines billing month; dueDate may straddle month boundary.
    await insert('invoices',{id:id(inv.id),agreement_id:id(`lease-${t.id}`),period_start:inv.createdAt.slice(0,7)+'-01',due_date:inv.dueDate,amount:inv.amount,notes:'Fixture development — simulasi, tanpa perpindahan uang.',tenant_name_snapshot:t.name,property_name_snapshot:p.name,room_number_snapshot:r.number});
    const tx=source.transactions.find(tx=>tx.invoiceId===inv.id);
    if(tx) await client.query('select public.server_record_rent_payment($1,$2,true,$3,true,$4)',[id(inv.id),`fixture-${tx.id}`,tx.method,tx.date]);
  }
  await client.query('select public.server_record_rent_payment($1,$2,false,$3,true)',[id('inv-0-0'),'fixture-failed-rent','QRIS']);
  for(const c of source.complaints) {
    const added=await insert('complaints',{id:id(c.id),agreement_id:id(`lease-${c.tenantId}`),title:c.title,description:c.description,category:c.category,urgency:'medium',priority:'medium'});
    if(added&&c.status!=='Menunggu') await client.query('update public.complaints set status=$2 where id=$1',[id(c.id),c.status==='Diproses'?'in_progress':'awaiting_confirmation']);
  }
  await insert('complaint_attachments',{id:id('complaint-photo-c1'),complaint_id:id('c1'),uploaded_by:actor('t1'),storage_path:'development/illustration-ac.jpg',mime_type:'image/jpeg',size_bytes:1024});
  await insert('complaint_notes',{id:id('complaint-note-c1'),complaint_id:id('c1'),author_id:actor('o1'),body:'Teknisi dijadwalkan memeriksa AC; tunggu konfirmasi penghuni setelah perbaikan.'});
  await insert('complaint_analyses',{id:id('complaint-analysis-c1'),complaint_id:id('c1'),accepted_by:actor('o1'),suggested_category:'AC',suggested_priority:'medium',summary:'AC kamar tidak dingin sejak semalam.',safe_action:'Jadwalkan pemeriksaan bersama pengelola atau teknisi.'});
  for(const c of source.conversations) {
    await insert('conversations',{id:id(c.id),property_id:id(c.propertyId),prospect_id:actor(c.participantId)});
    for(const user of [c.participantId,c.ownerId]) await insert('conversation_members',{id:id(`${c.id}-member-${user}`),conversation_id:id(c.id),user_id:actor(user)});
    for(const m of c.messages) await insert('messages',{id:id(m.id),conversation_id:id(c.id),sender_id:actor(m.sender),body:m.text,created_at:m.date});
  }
  await insert('message_attachments',{id:id('message-attachment-m2'),message_id:id('m2'),storage_path:'development/illustration-room.jpg',mime_type:'image/jpeg',size_bytes:1024});
  // A registered prospect with existing favorites/chat demonstrates identity preservation.
  const prospect=actor('guest'), p=source.properties[0];
  await insert('favorites',{id:id('favorite-prospect'),user_id:prospect,property_id:id(p.id)});
  await insert('favorites',{id:id('favorite-t1'),user_id:actor('t1'),property_id:id('p2')});
  await insert('recent_searches',{id:id('search-prospect'),user_id:prospect,query:'Tanjung Duren'});
  await insert('conversations',{id:id('prospect-chat'),property_id:id(p.id),prospect_id:prospect});
  for(const user of ['guest',p.ownerId]) await insert('conversation_members',{id:id(`prospect-member-${user}`),conversation_id:id('prospect-chat'),user_id:actor(user)});
  await insert('messages',{id:id('prospect-message'),conversation_id:id('prospect-chat'),sender_id:prospect,body:'Halo Bu, apakah bisa survei kamar minggu ini?'});
  const today=(await client.query('select private.today()::text as date')).rows[0].date;
  const end=(await client.query('select (private.today()+30)::text as date')).rows[0].date;
  await insert('boost_campaigns',{id:id('initial-campaign'),property_id:id('p1'),start_date:today,end_date:end,source:'development_grant'});
  for(const [key,success] of [['fixture-boost-failed',false],['fixture-boost-paid',true]]) await client.query('select public.server_record_boost($1,$2,$3,$4,true)',[id('p2'),key,success,'Saldo demo']);
  for(const kind of ['view','detail','contact']) await insert('listing_analytics',{id:id(`analytics-${kind}`),property_id:id('p1'),actor_id:prospect,session_id:id('session-prospect'),kind,event_date:today});
  await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actor('t1')]);
  await client.query('select public.generate_payment_reminders()');
  await client.query("select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','service_role',true)");
}
