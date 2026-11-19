(function (A, N) {
  "use strict";
  function showMessage(form, message, success = false) {
    const node = form.querySelector(
      success ? ".auth-form-success" : ".auth-form-error",
    );
    if (node) {
      node.textContent = message;
      if (!success) node.focus();
    }
  }
  async function switchMode(mode) {
    N.closeModal();
    document.getElementById("toast-root").replaceChildren();
    A.setMode(mode);
    A.notice = "";
    A.identityError = "";
    A.catalogue = undefined;
    A.catalogueError = "";
    document.body.dataset.mode = mode;
    history.replaceState(null, "", location.pathname + location.search + "#/");
    await A.start();
    N.render();
    if (mode === "demo") N.roleModal();
  }
  document.addEventListener(
    "click",
    async (event) => {
      const el = event.target.closest("[data-auth-action]");
      if (el) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const action = el.dataset.authAction;
        try {
          if (action === "password-toggle") {
            const input = document.getElementById(el.dataset.target),
              show = input.type === "password";
            input.type = show ? "text" : "password";
            el.setAttribute("aria-pressed", String(show));
            el.setAttribute(
              "aria-label",
              show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
            );
          } else if (action === "demo") await switchMode("demo");
          else if (action === "connected") await switchMode("connected");
          else if (action === "logout") {
            el.disabled = true;
            await A.authService.logout();
            A.notice = "Kamu sudah keluar dari akun.";
            N.navigate("login");
            N.render();
          } else if (action === "refresh-rights") {
            el.disabled = true;
            await A.refreshIdentity();
            if (A.user) N.toast("Hak akses dibaca ulang dari database.");
          } else if (action === "menu") {
            const nav = document.querySelector(".public-nav");
            const open = nav.classList.toggle("open");
            el.setAttribute("aria-expanded", String(open));
          } else if (action === "retry-listings") {
            A.catalogue = undefined;
            A.catalogueError = "";
            N.render();
          }
        } catch (error) {
          N.toast(A.errorMessage(error), true);
          if (el.isConnected) el.disabled = false;
        }
        return;
      }
      if (A.mode !== "connected") return;
      const legacy = event.target.closest("[data-action]");
      if (legacy) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (["roles", "guide"].includes(legacy.dataset.action))
          await switchMode("demo");
        else N.toast("Fitur ini belum terhubung. Coba melalui Demo Mode.");
      }
    },
    true,
  );
  document.addEventListener(
    "submit",
    async (event) => {
      if (A.mode !== "connected") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const f = event.target;
      if (!f.matches("form")) return;
      const kind = f.dataset.authForm;
      if (!kind) {
        if (f.id === "hero-search") {
          A.search = new FormData(f).get("query") || "";
          N.navigate("marketplace");
        }
        return;
      }
      if (f.dataset.busy === "true") return;
      const data = Object.fromEntries(new FormData(f));
      const button = f.querySelector('button[type="submit"]'),
        label = button?.textContent;
      f.dataset.busy = "true";
      f.setAttribute("aria-busy", "true");
      if (button) {
        button.disabled = true;
        button.textContent = "Sedang memproses…";
      }
      f.querySelectorAll(".auth-form-error,.auth-form-success").forEach(
        (n) => (n.textContent = ""),
      );
      try {
        if (kind === "search") {
          A.search = data.query.trim();
          N.render();
          return;
        }
        if (A.configError()) throw A.fail(A.configError());
        if (kind === "register") {
          const result = await A.authService.signup({
            ...data,
            consent: data.consent === "on",
          });
          A.pendingEmail = data.email;
          if (result.session) {
            await A.resolveIdentity(true);
            N.navigate(A.defaultPath());
          } else {
            A.notice =
              "Periksa email untuk melanjutkan. Jika akun sudah ada, gunakan Masuk atau Lupa kata sandi.";
            N.navigate("verify");
          }
        } else if (kind === "login") {
          await A.authService.login({
            ...data,
            remember: data.remember === "on",
          });
          await A.resolveIdentity(true);
          A.notice = "";
          const next = A.nextPath;
          A.nextPath = "";
          N.navigate(
            next && A.guard(next.split("/")[0]) === "allowed"
              ? next
              : A.defaultPath(),
          );
        } else if (kind === "forgot" || kind === "resend") {
          const cooldown = Number(
            A.safeRead(sessionStorage, "ngekosaja.auth.mailCooldown") || 0,
          );
          if (Date.now() < cooldown)
            throw A.fail("Tunggu sebentar sebelum mengirim email lagi.");
          if (kind === "forgot") await A.authService.recover(data.email);
          else await A.authService.resend(data.email);
          A.safeWrite(
            sessionStorage,
            "ngekosaja.auth.mailCooldown",
            String(Date.now() + 45000),
          );
          showMessage(
            f,
            "Jika alamat memenuhi syarat, email sudah diminta. Periksa kotak masuk dan spam; buka tautan di browser ini.",
            true,
          );
        } else if (kind === "reset") {
          await A.authService.reset(data.password, data.confirmation);
          A.notice =
            "Kata sandi berhasil diganti. Masuk dengan kata sandi barumu.";
          N.navigate("login");
        } else if (kind === "profile") {
          await A.profileService.update(data);
          await A.resolveIdentity(true);
          A.notice = "Profil berhasil disimpan pada server.";
          N.render();
        } else if (kind === "email") {
          await A.authService.email(data.email);
          A.notice =
            "Permintaan perubahan email terkirim. Konfirmasikan melalui email sesuai petunjuk Supabase.";
          await A.resolveIdentity(true);
          N.render();
        } else if (kind === "password") {
          await A.authService.password(
            data.current,
            data.password,
            data.confirmation,
          );
          A.notice = "Kata sandi berhasil diperbarui.";
          N.render();
        }
      } catch (error) {
        if (error.code === "email_not_confirmed") {
          A.pendingEmail = data.email;
          A.notice = A.errorMessage(error);
          N.navigate("verify");
        } else showMessage(f, A.errorMessage(error));
      } finally {
        f.dataset.busy = "false";
        f.removeAttribute("aria-busy");
        if (button) {
          button.disabled = false;
          button.textContent = label;
        }
      }
    },
    true,
  );
  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-strength]")) return;
    const node = event.target
        .closest("form")
        .querySelector(".password-strength"),
      score = A.passwordScore(event.target.value);
    if (node) {
      node.querySelector("meter").value = score;
      node.querySelector("small").textContent = [
        "Gunakan min 12 karakter, huruf besar/kecil, angka, dan simbol.",
        "Masih lemah. Tambahkan variasi karakter.",
        "Cukup bervariasi. Lengkapi persyaratan di atas.",
        "Hampir siap. Lengkapi semua persyaratan.",
        "Kuat · semua persyaratan terpenuhi.",
      ][score];
    }
  });
})(window.NA, window.NK);
