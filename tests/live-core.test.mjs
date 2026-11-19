import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/live-core.js';
const {parseRef,format,Seen,Subscriptions}=globalThis.NKLiveCore;
const uid='11111111-1111-4111-8111-111111111111';
test('media references accept exact buckets/UUID files, reject arbitrary URLs/traversal',()=>{
 for(const bucket of globalThis.NKLiveCore.buckets)assert.deepEqual(parseRef(`cloud:${bucket}/${uid}/${uid}.webp`),{bucket,path:`${uid}/${uid}.webp`});
 for(const path of ['https://evil.test/image.png','data:image/png;base64,x',`cloud:avatars/${uid}/../x.png`,`cloud:other/${uid}/${uid}.png`,`cloud:avatars/${uid}/${uid}.svg`])assert.equal(parseRef(path),null);
});
test('image signatures require actual JPEG/PNG/WebP bytes',()=>{
 assert.equal(format(new Uint8Array([255,216,255])),'image/jpeg');assert.equal(format(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(format(new TextEncoder().encode('RIFF1234WEBP')),'image/webp');assert.equal(format(new TextEncoder().encode('<svg onload=alert(1)>')),null);
});
test('event dedup has bounded memory and permits events after TTL',()=>{
 const seen=new Seen(2,10);assert.ok(seen.accept('a',0));assert.equal(seen.accept('a',1),false);assert.ok(seen.accept('a',11));seen.accept('b',12);seen.accept('c',13);assert.equal(seen.items.size,2);assert.ok(seen.accept('a',14));seen.clear();assert.equal(seen.items.size,0);
});
function fake(){const channels=[],removed=[];return {channels,removed,channel(name){const c={name,handlers:[],on(kind,filter,fn){this.handlers.push({kind,filter,fn});return this;},subscribe(fn){this.status=fn;return this;}};channels.push(c);return c;},async removeChannel(c){removed.push(c);c?.status?.('CLOSED');}};}
test('subscriptions are deduplicated, scoped, INSERT/UPDATE only, and catch up on reconnect',()=>{
 const client=fake(),events=[],states=[],catchup=[];const m=new Subscriptions(client,p=>events.push(p),s=>states.push(s),k=>catchup.push(k));const groups={notices:[{table:'notifications',filter:'user_id=eq.'+uid}]};m.sync(groups);m.sync(groups);assert.equal(client.channels.length,1);
 const c=client.channels[0];assert.deepEqual(c.handlers.map(h=>h.filter.event),['INSERT','UPDATE']);assert.ok(c.handlers.every(h=>h.filter.filter.includes(uid)));
 c.status('SUBSCRIBED');c.status('SUBSCRIBED');assert.equal(catchup.length,2);
 const p={table:'notifications',new:{id:uid,updated_at:'now'}};c.handlers[0].fn(p);c.handlers[0].fn(p);assert.equal(events.length,1);m.dispose();
});
test('route/session cleanup rejects late events, late statuses, and removes old channels',()=>{
 const client=fake(),events=[];const m=new Subscriptions(client,p=>events.push(p),()=>{},()=>{});m.sync({route:[{table:'messages',filter:'conversation_id=eq.'+uid}]});const old=client.channels[0];m.sync({notices:[{table:'notifications',filter:'user_id=eq.'+uid}]});
 old.handlers[0].fn({table:'messages',new:{id:uid}});old.status('CHANNEL_ERROR');assert.equal(events.length,0);assert.equal(m.groups.size,1);m.dispose();assert.equal(m.groups.size,0);assert.equal(client.removed.length,2);
});
test('reconnection re-subscribes once and disposal cancels queued work',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const client=fake();let caught=0;const m=new Subscriptions(client,()=>{},()=>{},()=>caught++);m.sync({route:[{table:'messages',filter:'conversation_id=eq.'+uid}]});
 client.channels[0].status('CHANNEL_ERROR');client.channels[0].status('CHANNEL_ERROR');t.mock.timers.tick(1000);await Promise.resolve();await Promise.resolve();assert.equal(client.channels.length,2);client.channels[1].status('SUBSCRIBED');assert.equal(caught,1);
 client.channels[1].status('TIMED_OUT');m.dispose();t.mock.timers.tick(30000);await Promise.resolve();assert.equal(client.channels.length,2);
});
