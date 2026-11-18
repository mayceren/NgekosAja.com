import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { localConfiguration,connect,safeError } from './local-database.mjs';
import { fixtureSource,fixtureAccounts,populateDevelopmentFixtures } from './development-fixtures.mjs';

let client;
try {
  const config=localConfiguration(); // Both API and DB must be loopback; no remote override exists.
  if(!config.serviceKey) throw new Error('Local Auth Admin key unavailable.');
  const source=fixtureSource(), identities={};
  async function admin(path, options={}) {
    const response=await fetch(`${config.apiUrl}/auth/v1/admin/${path}`,{...options,headers:{apikey:config.serviceKey,Authorization:`Bearer ${config.serviceKey}`,'Content-Type':'application/json'}});
    if(!response.ok) throw new Error(`Local Auth Admin API failed (HTTP ${response.status}); response body sengaja tidak dicetak.`);
    return response.json();
  }
  let users=[];
  for(let page=1;;page++) { const result=await admin(`users?page=${page}&per_page=100`); const batch=result.users||[];users.push(...batch);if(batch.length<100)break; }
  for(const account of fixtureAccounts(source)) {
    let user=users.find(u=>u.email===account.email);
    if(!user) {
      // Generated in memory, discarded immediately, never logged or committed.
      user=await admin('users',{method:'POST',body:JSON.stringify({email:account.email,password:randomBytes(36).toString('base64url'),email_confirm:true,user_metadata:{display_name:account.name}})});
    }
    identities[account.id]=user.id;
  }
  client=await connect(config.db);
  await client.query('begin');
  await client.query("select pg_advisory_xact_lock(hashtextextended('ngekosaja-development-fixtures',0))");
  await client.query(readFileSync('supabase/seed.sql','utf8'));
  await populateDevelopmentFixtures(client,source,identities);
  await client.query('commit');
  console.log(`Fixture lokal selesai: ${source.owners.length} pemilik, ${source.properties.length} properti, ${source.tenants.length} penghuni. Tidak ada credential yang disimpan.`);
} catch(error) { if(client)await client.query('rollback').catch(()=>{});console.error(safeError(error));process.exitCode=1; }
finally { if(client)await client.end(); }
