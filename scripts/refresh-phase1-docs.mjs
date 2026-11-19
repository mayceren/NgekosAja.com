import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {connect,localConfiguration,safeError} from './local-database.mjs';
import {generateDatabaseDocs} from './database-docs.mjs';

// Rebuild documentation from a NEW empty local scratch database, never the input DB.
// Does not provision fixtures or access the Cloud; no reset operation is used.
let root,db,scratch;
try{
 const config=localConfiguration({native:true}).db;
 root=await connect(config);
 scratch='ngekosaja_docs_'+randomUUID().replaceAll('-','');
 await root.query(`create database "${scratch}"`);
 db=await connect({...config,database:scratch});
 await db.query(readFileSync('supabase/tests/bootstrap_native.sql','utf8'));
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.query(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await generateDatabaseDocs(db);
}catch(e){console.error(safeError(e));process.exitCode=1;}
finally{
 if(db)await db.end();
 if(root&&scratch)await root.query(`drop database "${scratch}" with (force)`);
 if(root)await root.end();
}
