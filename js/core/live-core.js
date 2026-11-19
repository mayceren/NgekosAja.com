/* Pure, dependency-free contracts shared by the browser and Node tests. */
(function(root){
 'use strict';
 const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
 const buckets=['property-images','room-images','avatars','complaint-attachments','chat-attachments'];
 const parseRef=value=>{
  const m=new RegExp('^cloud:('+buckets.join('|')+')/('+UUID+'/'+UUID+'\\.(?:webp|png|jpg))$','i').exec(value||'');
  return m?{bucket:m[1],path:m[2]}:null;
 };
 function format(bytes){
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
 }
 class Seen {
  constructor(limit=500,ttl=120000){this.items=new Map();this.limit=limit;this.ttl=ttl;}
  accept(key,now=Date.now()){const old=this.items.get(key);if(old!==undefined&&now-old<this.ttl)return false;this.items.delete(key);this.items.set(key,now);while(this.items.size>this.limit)this.items.delete(this.items.keys().next().value);return true;}
  clear(){this.items.clear();}
 }
 class Subscriptions {
  constructor(client,onEvent,onState,onCatchup){this.client=client;this.onEvent=onEvent;this.onState=onState;this.onCatchup=onCatchup;this.epoch=0;this.groups=new Map();this.seen=new Seen();}
  sync(groups){
   for(const [key,entry] of this.groups)if(!groups[key]||entry.spec!==JSON.stringify(groups[key])){this.remove(key);}
   for(const [key,spec] of Object.entries(groups))if(spec.length&&!this.groups.has(key))this.add(key,spec);
  }
  add(key,spec){
   const epoch=this.epoch,entry={spec:JSON.stringify(spec),channel:null,timer:null,attempts:0,active:true};this.groups.set(key,entry);
   const valid=()=>entry.active&&epoch===this.epoch&&this.groups.get(key)===entry;
   const connect=()=>{
    if(!valid())return;
    const channel=entry.channel=this.client.channel('nk:'+key+':'+epoch+':'+entry.attempts);
    for(const item of spec)for(const event of ['INSERT','UPDATE'])channel.on('postgres_changes',{event,schema:'public',...item},payload=>{
     if(!valid()||entry.channel!==channel)return;const row=payload.new;if(!row?.id)return;
     const stamp=row.updated_at||row.created_at||payload.commit_timestamp;
     if(this.seen.accept([payload.table,event,row.id,stamp].join(':')))this.onEvent(payload,key);
    });
    channel.subscribe(status=>{
     if(!valid()||entry.channel!==channel)return;this.onState(status,key);
     if(status==='SUBSCRIBED'){entry.attempts=0;if(entry.timer)clearTimeout(entry.timer);entry.timer=null;this.onCatchup(key);}
     else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)&&!entry.timer){
      if(entry.attempts>=5)return; // SDK handles socket reconnect; bounded channel rejoin, no polling.
      entry.timer=setTimeout(async()=>{entry.timer=null;if(!valid())return;entry.attempts++;entry.channel=null;await this.client.removeChannel(channel);if(valid())connect();},Math.min(30000,1000*2**entry.attempts));
     }
    });
   };connect();
  }
  remove(key){const entry=this.groups.get(key);if(!entry)return;entry.active=false;if(entry.timer)clearTimeout(entry.timer);entry.timer=null;this.groups.delete(key);if(entry.channel)this.client.removeChannel(entry.channel).catch(()=>{});}
  dispose(){this.epoch++;for(const key of [...this.groups.keys()])this.remove(key);this.seen.clear();}
 }
 root.NKLiveCore={parseRef,format,Seen,Subscriptions,buckets};
})(typeof window!=='undefined'?window:globalThis);
