(function (A) {
  "use strict";
  A.errorMessage = (error) => {
    const code = error?.code || "",
      status = error?.status;
    if (code === "pkce_code_verifier_not_found")
      return "Tautan harus dibuka pada browser tempat permintaan dibuat. Minta tautan baru dari browser ini.";
    if (error?.name === "AuthSessionMissingError")
      return "Sesi berakhir. Silakan masuk kembali.";
    const messages = {
      invalid_credentials: "Email atau kata sandi tidak cocok.",
      email_not_confirmed:
        "Email belum diverifikasi. Buka email verifikasi atau kirim ulang dari halaman verifikasi.",
      user_already_exists:
        "Jika alamat ini sudah terdaftar, gunakan Masuk atau Lupa kata sandi.",
      email_exists:
        "Jika alamat ini sudah terdaftar, gunakan Masuk atau Lupa kata sandi.",
      weak_password:
        "Kata sandi terlalu lemah. Gunakan sedikitnya 12 karakter dengan huruf besar, huruf kecil, angka, dan simbol.",
      same_password: "Gunakan kata sandi baru yang berbeda.",
      over_email_send_rate_limit:
        "Batas pengiriman email project tercapai. Permintaan email belum berhasil. Tunggu sebelum meminta tautan baru; jangan kirim ulang berulang kali.",
      over_request_rate_limit:
        "Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.",
      otp_expired:
        "Tautan sudah kedaluwarsa atau pernah dipakai. Minta tautan baru.",
      bad_code_verifier:
        "Tautan harus dibuka pada browser tempat permintaan dibuat. Minta tautan baru dari browser ini.",
      flow_state_not_found:
        "Sesi tautan tidak ditemukan. Minta tautan baru dari browser ini.",
      session_not_found: "Sesi berakhir. Silakan masuk kembali.",
      refresh_token_not_found: "Sesi berakhir. Silakan masuk kembali.",
      refresh_token_already_used: "Sesi berakhir. Silakan masuk kembali.",
      reauthentication_needed: "Masuk kembali sebelum mengganti kata sandi.",
      reauthentication_not_valid:
        "Verifikasi ulang tidak valid. Masuk kembali.",
      validation_failed: "Periksa kembali data yang diisi.",
      email_address_invalid: "Alamat email tidak valid.",
      email_address_not_authorized:
        "Email ini belum diizinkan oleh konfigurasi pengiriman project.",
      signup_disabled: "Pendaftaran belum diaktifkan pada project.",
      request_timeout: "Koneksi terlalu lama. Periksa jaringan lalu coba lagi.",
      42501: "Akses tidak diizinkan. Hak akun diperiksa oleh database.",
      23514: "Periksa nama dan format nomor kontak.",
      PGRST116:
        "Profil belum tersedia. Muat ulang akses atau hubungi pengelola platform.",
    };
    if (messages[code]) return messages[code];
    if (error?.publicMessage) return error.publicMessage;
    if (status === 429) return messages.over_request_rate_limit;
    if (status === 401) return messages.session_not_found;
    if (
      error instanceof TypeError ||
      /fetch|network|connection/i.test(error?.message || "")
    )
      return "Tidak dapat terhubung. Periksa koneksi dan konfigurasi project.";
    return "Permintaan belum berhasil. Coba kembali atau hubungi pengelola platform.";
  };
  A.fail = (message) =>
    Object.assign(new Error("Validated application input"), {
      publicMessage: message,
    });
  A.validatePassword = (value) =>
    value.length >= 12 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value);
  A.passwordScore = (value) =>
    Math.min(
      4,
      [
        value.length >= 12,
        /[a-z]/.test(value) && /[A-Z]/.test(value),
        /\d/.test(value),
        /[^A-Za-z0-9]/.test(value),
      ].filter(Boolean).length,
    );
  A.requirePassword = (password, confirmation) => {
    if (!A.validatePassword(password))
      throw A.fail(
        "Gunakan min 12 karakter dengan huruf besar, huruf kecil, angka, dan simbol.",
      );
    if (password !== confirmation)
      throw A.fail("Konfirmasi kata sandi belum cocok.");
  };
})(window.NA);
