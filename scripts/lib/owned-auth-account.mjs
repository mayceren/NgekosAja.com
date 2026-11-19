import {createHash} from 'node:crypto';

export const projectRef = 'wfmhsbdfdcugxblqsaob';
export const projectName = 'ngekosaja-development';
export class RepairError extends Error {}
export const emailHash = email => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

// Only the identity accidentally created by the old QA run can use this repair.
// This is an administrative CLI utility, never a website password-reset endpoint.
export function assertOwnedAccount(marker, user) {
  if (!marker?.id || !marker.run || !marker.email_hash || !user?.id ||
      marker.id !== user.id || marker.email_hash !== emailHash(user.email || '') ||
      user.user_metadata?.auth_qa_run !== marker.run) {
    throw new RepairError('Identitas tidak cocok dengan catatan QA. Tidak ada akun yang diubah.');
  }
  if (!user.email_confirmed_at) throw new RepairError('Email akun belum terverifikasi; pemulihan administratif ini ditolak.');
  if (user.banned_until && new Date(user.banned_until) > new Date()) throw new RepairError('Akun dibatasi. Pemulihan ini ditolak.');
}

export function validateRepairPassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new RepairError('Gunakan 12–128 karakter dengan huruf besar/kecil, angka, dan simbol.');
  }
  if (password !== confirmation) throw new RepairError('Konfirmasi kata sandi belum cocok. Tidak ada akun yang diubah.');
}

export async function repairOwnedAccount({admin, marker, prompt, protect}) {
  const {data, error} = await admin.getUserById(marker.id);
  if (error) throw new RepairError('Pemeriksaan Auth gagal. Tidak ada akun yang diubah.');
  assertOwnedAccount(marker, data.user);
  if (marker.repaired_at) throw new RepairError('Pemulihan akun ini sudah selesai. Gunakan alur akun biasa.');
  let password, confirmation;
  try {
    password = await prompt('Kata sandi baru (input tersembunyi): ');
    confirmation = await prompt('Ulangi kata sandi baru: ');
    validateRepairPassword(password, confirmation);
    // Refuse to write remotely unless the local protection can be persisted first.
    await protect({...marker, protected_from_qa: true});
    const result = await admin.updateUserById(marker.id, {password});
    if (result.error) throw new RepairError('Auth menolak perubahan password. Password tidak dicetak; coba lagi atau periksa pengaturan Auth.');
    if (result.data?.user?.id !== marker.id) throw new RepairError('Respons Auth tidak sesuai. Periksa akun melalui Dashboard.');
    const repairedAt = new Date().toISOString();
    await protect({...marker, protected_from_qa: true, repaired_at: repairedAt});
    return {repaired_at: repairedAt};
  } finally {
    // JS strings cannot be reliably zeroed; never serialize or log these values.
    password = confirmation = undefined;
  }
}
