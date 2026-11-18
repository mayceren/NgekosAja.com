import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { requireLoopback,localConfiguration,safeError } from '../scripts/local-database.mjs';

test('Loopback guard rejects remote hosts, credential tricks, driver host overrides and unexpected schemes',()=>{
 for(const url of ['https://project.supabase.co','postgresql://remote.invalid/db','http://localhost@remote.invalid','postgresql://127.0.0.1/db?host=remote.invalid','postgresql://localhost/db?hostaddr=10.0.0.1','file://localhost/path']) assert.throws(()=>requireLoopback(url,'test'));
 for(const url of ['http://127.0.0.1:54321','http://localhost:54321','postgresql://127.0.0.1:54322/postgres','http://[::1]:54321']) assert.doesNotThrow(()=>requireLoopback(url,'test'));
});
test('Provisioning refuses remote configuration before any network or SQL connection',()=>{
 const old={...process.env};
 try {
  process.env.SUPABASE_URL='https://project.supabase.co';process.env.SUPABASE_DB_URL='postgresql://127.0.0.1/postgres';process.env.SUPABASE_SERVICE_ROLE_KEY='unused-test-placeholder';
  assert.throws(()=>localConfiguration(),/loopback/);
  process.env.SUPABASE_URL='http://localhost:54321';process.env.SUPABASE_DB_URL='postgresql://127.0.0.1/postgres?host=remote.invalid';assert.throws(()=>localConfiguration(),/parameter URL/);
 } finally {for(const key of ['SUPABASE_URL','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY']) {if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
test('Error output redacts database addresses, JWT-shaped tokens and Supabase secret formats',()=>{
 const address=new URL('postgresql://127.0.0.1/db');address.username='redaction-test';address.password=randomBytes(16).toString('hex');
 const secrets=['sbp_','sb_secret_'].map(prefix=>prefix+randomBytes(24).toString('hex'));
 const raw=address.href+' '+['eyJ','header.payload.signature'].join('')+' '+secrets.join(' ');
 const message=safeError(new Error(raw));assert.ok(!message.includes(address.password));assert.ok(!message.includes('eyJ'));assert.ok(secrets.every(secret=>!message.includes(secret)));assert.ok(message.includes('redacted'));
});
