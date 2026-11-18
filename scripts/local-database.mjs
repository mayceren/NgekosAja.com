import pg from 'pg';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function requireLoopback(value, label) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error(`${label}: hanya alamat loopback lokal yang diizinkan.`);
  if (url.search || url.hash) throw new Error(`${label}: parameter URL tidak diizinkan agar host/port tidak dapat ditimpa driver.`);
  if (!['http:','https:','postgres:','postgresql:'].includes(url.protocol)) throw new Error(`${label}: protokol tidak didukung.`);
  return url;
}

export function localConfiguration({ native = false } = {}) {
  if (native) {
    if (process.env.PGHOST && !['127.0.0.1','localhost','::1'].includes(process.env.PGHOST)) throw new Error('PGHOST harus loopback.');
    return { db: { host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 55432), user: process.env.PGUSER || 'ngekosaja_test', password: process.env.PGPASSWORD, database: 'postgres' } };
  }
  let status = {};
  if (!process.env.SUPABASE_DB_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_URL) {
    try {
      const bin = resolve('node_modules/supabase/dist/supabase.js');
      status = JSON.parse(execFileSync(process.execPath, [bin,'status','-o','json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
    } catch { throw new Error('Stack lokal belum aktif. Jalankan npx supabase start (memerlukan Docker), atau gunakan --native untuk SQL contract tests. Jangan kirim credential melalui chat.'); }
  }
  const dbUrl = process.env.SUPABASE_DB_URL || status.DB_URL;
  const apiUrl = process.env.SUPABASE_URL || status.API_URL;
  const parsedDb=requireLoopback(dbUrl, 'Database'), parsedApi=requireLoopback(apiUrl, 'Auth API');
  if(!['postgres:','postgresql:'].includes(parsedDb.protocol)||!['http:','https:'].includes(parsedApi.protocol)) throw new Error('Protokol database/Auth API tidak sesuai.');
  return { db: { connectionString: dbUrl }, apiUrl, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || status.SERVICE_ROLE_KEY };
}

export async function connect(config) { const client = new pg.Client(config); await client.connect(); return client; }
// Never log raw pg/network errors: a connection error can contain secrets.
export function safeError(error) { return `${error.code ? `[${error.code}] ` : ''}${String(error.message || error).replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[redacted database address]').replace(/\b(?:sbp_|sb_secret_)[A-Za-z0-9_-]+/g,'[redacted credential]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted token]')}`; }
