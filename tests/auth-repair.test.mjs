import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {emailHash, assertOwnedAccount, repairOwnedAccount} from '../scripts/lib/owned-auth-account.mjs';
import {hiddenPrompt} from '../scripts/lib/hidden-prompt.mjs';

function fixture() {
  const user = {id: 'qa-owned-id', email: 'qa@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z', user_metadata: {auth_qa_run: 'test-run'}};
  const marker = {id: user.id, run: 'test-run', email_hash: emailHash(user.email)};
  const password = randomBytes(24).toString('base64url') + 'Qa1!';
  const writes = [], updates = [];
  let prompts = 0;
  const input = {
    marker,
    admin: {async getUserById() {return {data: {user}, error: null};}, async updateUserById(id, attributes) {updates.push({id, attributes}); return {data: {user: {id}}, error: null};}},
    prompt: async () => {prompts++; return password;},
    protect: async state => writes.push(state),
  };
  return {user, marker, password, writes, updates, input, prompts: () => prompts};
}

test('repair updates ONLY the chosen password of the matched confirmed identity', async () => {
  const f = fixture();
  const result = await repairOwnedAccount(f.input);
  assert.equal(f.updates.length, 1);
  assert.deepEqual(f.updates[0], {id: f.marker.id, attributes: {password: f.password}});
  assert.equal(f.prompts(), 2);
  assert.equal(f.writes[0].protected_from_qa, true);
  assert.ok(f.writes[1].repaired_at);
  assert.ok(result.repaired_at);
  assert.ok(!JSON.stringify(f.writes).includes(f.password));
  assert.ok(!JSON.stringify(result).includes(f.password));
});

for (const field of ['id', 'run', 'email_hash']) {
  test(`mismatched ${field} refuses before password prompt or mutation`, async () => {
    const f = fixture(); f.marker[field] = 'other';
    await assert.rejects(repairOwnedAccount(f.input), /Identitas tidak cocok/);
    assert.equal(f.prompts(), 0); assert.equal(f.updates.length, 0);
  });
}

test('unconfirmed and banned accounts are never confirmed or unbanned by repair', async () => {
  const f = fixture(); f.user.email_confirmed_at = null;
  await assert.rejects(repairOwnedAccount(f.input), /belum terverifikasi/);
  f.user.email_confirmed_at = '2026-01-01'; f.user.banned_until = '2099-01-01';
  await assert.rejects(repairOwnedAccount(f.input), /dibatasi/);
  assert.equal(f.updates.length, 0);
});

test('completed repairs cannot be reused as a permanent password-reset shortcut', async () => {
  const f = fixture(); f.marker.repaired_at = new Date().toISOString();
  await assert.rejects(repairOwnedAccount(f.input), /sudah selesai/);
  assert.equal(f.prompts(), 0); assert.equal(f.updates.length, 0);
});

test('mismatched confirmation, weak password, or cancellation never reaches Auth update', async () => {
  for (const mode of ['mismatch', 'weak', 'cancel']) {
    const f = fixture(); let calls = 0;
    f.input.prompt = async () => {
      if (mode === 'cancel') throw new Error('cancelled');
      return mode === 'weak' ? 'weak' : ++calls === 1 ? f.password : f.password + 'different';
    };
    await assert.rejects(repairOwnedAccount(f.input));
    assert.equal(f.updates.length, 0); assert.equal(f.writes.length, 0);
  }
});

test('failed protection write blocks remote password changes', async () => {
  const f = fixture(); f.input.protect = async () => {throw new Error('disk unavailable');};
  await assert.rejects(repairOwnedAccount(f.input));
  assert.equal(f.updates.length, 0);
});

test('Auth rejection does not leak raw response or mark a repair successful', async () => {
  const f = fixture();
  f.input.admin.updateUserById = async () => ({error: {message: f.password}});
  await assert.rejects(repairOwnedAccount(f.input), error => !error.message.includes(f.password));
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].repaired_at, undefined);
});

test('failed identity lookup never asks for a password or writes anything', async () => {
  const f = fixture(); f.input.admin.getUserById = async () => ({error: {message: 'server'}});
  await assert.rejects(repairOwnedAccount(f.input));
  assert.equal(f.prompts(), 0); assert.equal(f.writes.length, 0); assert.equal(f.updates.length, 0);
});

test('email comparison is normalized but an unrelated address is refused', () => {
  const f = fixture(); assert.equal(emailHash(' QA@Example.Invalid '), f.marker.email_hash);
  f.user.email = 'someone-else@example.invalid';
  assert.throws(() => assertOwnedAccount(f.marker, f.user), /Identitas tidak cocok/);
});

function terminal() {
  const input = new EventEmitter();
  Object.assign(input, {isTTY: true, isRaw: false, setRawMode(raw) {this.isRaw = raw;}, setEncoding() {}, resume() {}, pause() {this.paused = true;}});
  let output = '';
  return {input, output: {isTTY: true, write(text) {output += text;}}, text: () => output};
}

test('terminal input never echoes the password and restores normal mode on Enter', async () => {
  const t = terminal(), password = randomBytes(24).toString('base64url');
  const result = hiddenPrompt('Password: ', t.input, t.output);
  assert.equal(t.input.isRaw, true);
  t.input.emit('data', password + '\u001b[D\r');
  assert.equal(await result, password);
  assert.equal(t.text(), 'Password: \n');
  assert.equal(t.input.isRaw, false); assert.equal(t.input.listenerCount('data'), 0); assert.equal(t.input.paused, true);
});

test('terminal cancellation restores mode, removes listeners and never reveals typed input', async () => {
  const t = terminal(), password = randomBytes(24).toString('base64url');
  const result = hiddenPrompt('Password: ', t.input, t.output);
  t.input.emit('data', password + '\u0003');
  await assert.rejects(result, /Dibatalkan/);
  assert.equal(t.text(), 'Password: \n');
  assert.equal(t.input.isRaw, false); assert.equal(t.input.listenerCount('data'), 0);
});

test('password cannot be provided through a non-interactive pipe', () => {
  const t = terminal(); t.input.isTTY = false;
  assert.throws(() => hiddenPrompt('Password: ', t.input, t.output), /terminal VS Code interaktif/);
  assert.equal(t.text(), '');
});
