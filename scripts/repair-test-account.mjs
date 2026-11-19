import {readFileSync, writeFileSync, renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {assertOwnedAccount, repairOwnedAccount, projectRef, projectName, RepairError} from './lib/owned-auth-account.mjs';
import {hiddenPrompt} from './lib/hidden-prompt.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkOnly = args.length === 1 && args[0] === '--check';
const markerPath = resolve(root, '.local-db/auth-qa-identity.json');
const reportPath = resolve(root, 'docs/auth/account-repair-results.json');
const report = {checked_at: new Date().toISOString(), project: projectName, emails_sent: 0, schema_changes: false, password_changed: false};
const command = args => JSON.parse(execFileSync(process.execPath, [resolve(root, 'node_modules/supabase/dist/supabase.js'), ...args], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 55000,
}));
const objects = v => Array.isArray(v) ? v.flatMap(objects) : v && typeof v === 'object' ? [v, ...Object.values(v).filter(x => x && typeof x === 'object').flatMap(objects)] : [];
const protect = marker => {
  const pending = markerPath + '.tmp';
  writeFileSync(pending, JSON.stringify(marker) + '\n', {mode: 0o600});
  renameSync(pending, markerPath);
};

try {
  if (args.length && !checkOnly) throw new RepairError('Gunakan npm run auth:repair-test-account atau tambahkan -- --check. Password tidak boleh menjadi argumen.');
  if (!checkOnly && (!process.stdin.isTTY || !process.stdout.isTTY)) throw new RepairError('Jalankan npm run auth:repair-test-account di terminal VS Code interaktif.');
  if (readFileSync(resolve(root, 'supabase/.temp/project-ref'), 'utf8').trim() !== projectRef) throw new RepairError('Target CLI bukan project development yang diizinkan.');
  if (!objects(command(['projects', 'list', '--output-format', 'json'])).some(p => (p.id === projectRef || p.ref === projectRef) && p.name === projectName)) throw new RepairError('Identitas project remote tidak cocok.');
  const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  // CLI captures server key only in this local process; no browser, file or stdout.
  const keys = objects(command(['projects', 'api-keys', '--remote=' + projectRef, '--reveal', '--output-format', 'json']));
  const key = keys.filter(k => k.name === 'service_role' || k.type === 'secret').map(k => k.api_key || k.key).find(k => typeof k === 'string' && (k.startsWith('eyJ') || k.startsWith('sb_secret_')));
  if (!key) throw new RepairError('Akses administratif CLI tidak tersedia.');
  const client = createClient('https://' + projectRef + '.supabase.co', key, {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}});
  const {data, error} = await client.auth.admin.getUserById(marker.id);
  if (error) throw new RepairError('Kondisi akun belum dapat diperiksa.');
  assertOwnedAccount(marker, data.user);
  Object.assign(report, {email_confirmed: true, qa_identity_matches: true, previous_repair_completed: !!marker.repaired_at});
  // No remote mutation: prevent the old personal identity from being a QA target.
  protect({...marker, protected_from_qa: true});
  if (checkOnly) {
    report.status = marker.repaired_at ? 'already-repaired' : 'awaiting-user-chosen-password';
    console.log('Akun QA ditemukan dan email sudah terverifikasi. Tidak mengirim email atau mengubah password.');
  } else {
    console.log('Pemulihan khusus akun yang dibuat QA lama di ngekosaja-development.');
    console.log('Password baru hanya di memori terminal. Tidak dikirim lewat email atau disimpan di file.');
    console.log('Gunakan 12–128 karakter dengan huruf besar/kecil, angka, dan simbol. Ctrl+C untuk membatalkan.');
    Object.assign(report, await repairOwnedAccount({admin: client.auth.admin, marker, prompt: hiddenPrompt, protect}));
    report.password_changed = true;
    report.status = 'repaired-login-not-yet-verified';
    console.log('Password berhasil diganti. Buka http://127.0.0.1:5500/#/login dan masuk memakai password baru.');
    console.log('Tidak perlu daftar ulang atau memakai kedua email lama.');
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
} catch (error) {
  // SDK/CLI exceptions may contain keys, request bodies or tokens: never log them.
  console.error(error instanceof RepairError ? error.message : 'Pemulihan belum selesai. Periksa koneksi dan login CLI; detail sensitif tidak dicetak.');
  process.exitCode = 1;
}
