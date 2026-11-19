(function (A, N) {
  "use strict";
  const e = N.e;
  const input = (name, label, type = "text", attrs = "", value = "") =>
    N.input(name, label, value, type, attrs);
  const password = (
    name,
    label,
    autocomplete = "new-password",
    strength = false,
  ) =>
    `<label class="field auth-password">${label}<span><input name="${name}" id="auth-${name}" type="password" required maxlength="128" autocomplete="${autocomplete}" ${strength ? 'data-strength="true"' : ""}><button type="button" class="icon-btn" data-auth-action="password-toggle" data-target="auth-${name}" aria-label="Tampilkan ${label.toLowerCase()}" aria-pressed="false">${N.icon("eye")}</button></span></label>${strength ? '<div class="password-strength" aria-live="polite"><meter min="0" max="4" value="0"></meter><small>min 12 karakter, huruf besar/kecil, angka, dan simbol.</small></div>' : ""}`;
  const end = (label) =>
    `<p class="auth-form-error" role="alert" tabindex="-1"></p><p class="auth-form-success" role="status"></p><button class="btn btn-primary btn-full" type="submit">${label}</button>`;
  const form = (name, body) =>
    `<form data-auth-form="${name}" id="auth-${name}-form">${body}</form>`;
  const modeBadge = () =>
    '<span class="connected-badge">' +
    N.icon("shield") +
    "CONNECTED MODE</span>";
  const action = (text, name, cls = "outline") =>
    `<button type="button" class="btn btn-${cls}" data-auth-action="${name}">${text}</button>`;
  A.navbar = (active) =>
    `<header class="public-header"><div class="container nav-inner">${N.logo()}<nav class="public-nav" aria-label="Navigasi utama">${[
      ["", "Beranda"],
      ["marketplace", "Cari Kos"],
      ["fitur", "Fitur"],
      ["tentang", "Tentang"],
    ]
      .map(
        ([p, t]) =>
          `<a href="#/${p}" ${active === p ? 'aria-current="page"' : ""}>${t}</a>`,
      )
      .join(
        "",
      )}</nav><div class="nav-actions">${A.user ? `<a class="connected-account-link" href="#/account">${N.avatar(A.profile?.display_name)}<span>${e(A.profile?.display_name)}</span></a><a class="btn btn-primary btn-sm" href="#/${A.defaultPath()}">Workspace</a>` : '<a class="login-btn" href="#/login">Masuk</a><a class="btn btn-primary btn-sm" href="#/register">Daftar</a>'}<button class="demo-pill" data-auth-action="demo">Coba Demo</button><button class="icon-btn mobile-menu" data-auth-action="menu" aria-label="Buka menu navigasi" aria-expanded="false">${N.icon("menu")}</button></div></div></header>`;
  A.footer = () =>
    `<footer class="footer connected-footer"><div class="container"><div>${N.logo()}<p>Cari kos, bayar sewa, kelola semua dalam satu tempat.</p></div><div><a href="#/privacy">Privasi & ketentuan</a><a href="#/help">Bantuan</a><button class="text-btn" data-auth-action="demo">Jelajahi demo terpisah</button></div><small>Connected Mode · Identitas akun tersimpan pada Supabase. Transaksi belum terhubung.</small></div></footer>`;
  A.authPage = (page) => {
    let title = "Senang bertemu lagi.",
      intro = "Masuk ke akunmu dan lanjutkan cerita yang lebih tertata.",
      body = "";
    if (page === "register") {
      title = "Mulai cerita barumu.";
      intro =
        "Satu identitas untuk menemukan ruang dan mengelola kehidupan kos.";
      body = form(
        "register",
        input(
          "name",
          "Nama lengkap",
          "text",
          'required maxlength="70" autocomplete="name"',
        ) +
          input(
            "email",
            "Email",
            "email",
            'required maxlength="254" autocomplete="email"',
          ) +
          password("password", "Kata sandi", "new-password", true) +
          password("confirmation", "Konfirmasi kata sandi") +
          N.select(
            "intent",
            "Tujuan akun",
            [
              ["prospect", "Mencari kos · calon penghuni"],
              [
                "owner-request",
                "Mengelola kos · akses pemilik melalui persetujuan",
              ],
            ],
            "prospect",
          ) +
          '<p class="field-help">Pendaftaran publik membuat akun calon penghuni. Akses pemilik diberikan pengelola platform; akses penghuni mengikuti penempatan sewa yang sah.</p><label class="checkbox-label"><input name="consent" type="checkbox" required><span>Saya menyetujui <a href="#/privacy">ketentuan penggunaan dan privasi</a>.</span></label>' +
          end("Buat akun"),
      );
    } else if (page === "forgot") {
      title = "Temukan kembali aksesmu.";
      intro =
        "Kirim tautan pemulihan ke email akunmu. Buka tautannya di browser ini.";
      body = form(
        "forgot",
        input("email", "Email akun", "email", 'required autocomplete="email"') +
          end("Kirim tautan pemulihan"),
      );
    } else if (page === "verify") {
      title = "Satu langkah menuju rumah.";
      intro =
        "Periksa kotak masuk dan folder spam. Buka tautan verifikasi di browser tempat kamu mendaftar.";
      body =
        `<div class="auth-success-icon">${N.icon("shield")}</div><p class="auth-inline-note">Jika alamat ini baru dan memenuhi syarat, email verifikasi akan dikirim. Untuk akun yang sudah ada, gunakan Masuk atau Lupa kata sandi.</p>` +
        form(
          "resend",
          input(
            "email",
            "Email pendaftaran",
            "email",
            'required autocomplete="email"',
            A.pendingEmail || "",
          ) + end("Kirim ulang verifikasi"),
        );
    } else if (page === "reset") {
      title = "Akses baru. Hari yang baru.";
      intro = "Pilih kata sandi yang kuat untuk menjaga ruang pribadimu.";
      body =
        A.user && A.recoveryUid === A.user.id
          ? form(
              "reset",
              password("password", "Kata sandi baru", "new-password", true) +
                password("confirmation", "Konfirmasi kata sandi baru") +
                end("Simpan kata sandi baru"),
            )
          : '<div class="notice">Tautan pemulihan belum valid, sudah digunakan, atau sesi halaman telah berakhir. Minta tautan baru dari browser ini.</div><a class="btn btn-primary btn-full" href="#/forgot">Minta tautan baru</a>';
    } else if (page === "session-expired") {
      title = "Mari masuk kembali.";
      intro =
        "Sesi atau tautan tidak dapat digunakan. Akunmu tetap tersimpan dengan aman.";
      body = `<div class="notice" role="alert">${e(A.identityError || "Tautan sudah kedaluwarsa atau pernah digunakan.")}</div><a class="btn btn-primary btn-full" href="#/login">Masuk kembali</a><a class="auth-forgot" href="#/forgot">Minta tautan pemulihan baru</a>`;
    } else {
      body =
        form(
          "login",
          input(
            "email",
            "Email",
            "email",
            'required maxlength="254" autocomplete="username"',
          ) +
            password("password", "Kata sandi", "current-password") +
            '<div class="auth-options"><label class="checkbox-label"><input name="remember" type="checkbox">Ingat saya di perangkat ini</label><a href="#/forgot">Lupa kata sandi?</a></div>' +
            end("Masuk ke akun"),
        ) +
        '<a class="auth-forgot" href="#/verify">Email belum diverifikasi?</a>';
    }
    const config = A.configurationError || A.configError();
    return `<main class="auth-layout auth-connected" id="main" tabindex="-1"><section class="auth-story"><img src="assets/images/room-2.jpg" alt="Kamar nyaman bernuansa natural"><div class="auth-story-overlay"></div>${N.logo()}<div class="auth-story-copy"><span class="eyebrow">RUANG BARU. CERITA BARU.</span><h2>Pulang ke tempat<br>yang terasa <em>seperti rumah.</em></h2><p>Satu identitas, akses yang sesuai, dan urusan kos yang lebih tenang.</p></div><span class="auth-story-foot">NgekosAja.com · Ruang untuk cerita berikutnya.</span></section><section class="auth-form-area"><a class="auth-back text-btn" href="#/">Kembali ke beranda</a><div class="auth-form-wrap">${modeBadge()}<h1>${title}</h1><p>${intro}</p>${config ? `<div class="notice auth-config-warning" role="status">${e(config)}</div>` : ""}${A.notice ? `<div class="notice" role="status">${e(A.notice)}</div>` : ""}${body}<p class="auth-switch">${page === "register" ? 'Sudah punya akun? <a href="#/login">Masuk</a>' : 'Belum punya akun? <a href="#/register">Daftar sekarang</a>'}</p><div class="auth-divider"><span>ingin melihat alurnya dulu?</span></div>${action("Coba demo tanpa akun", "demo")}<small class="auth-disclaimer">Demo memakai data simulasi terpisah. Kata sandi akun sungguhan hanya dikirim ke Supabase Auth.</small></div></section></main>`;
  };
  A.profilePage = () => {
    const p = A.profile;
    return `${N.heading("AKUN / PROFIL", "Ruangmu, identitasmu.", "Profil ini terhubung dengan identitas Supabase milikmu.")}<div class="connected-profile-grid"><aside class="panel connected-profile-card">${N.avatar(p.display_name, "avatar-xl")}<h2>${e(p.display_name)}</h2><p>${e(A.user.email)}</p><div class="connected-roles">${A.roles.map((r) => `<span class="badge">${e(A.roleLabels[r])}</span>`).join("")}</div><p class="field-help">Hak akses berasal dari database. Foto profil tersedia pada Phase 4.</p>${action("Muat ulang akses", "refresh-rights")}${action("Keluar dari akun", "logout")}</aside><div class="connected-profile-forms"><section class="panel"><h2>Informasi pribadi</h2>${form("profile", input("name", "Nama lengkap", "text", 'required maxlength="70" autocomplete="name"', p.display_name) + input("phone", "Nomor kontak", "tel", 'maxlength="18" autocomplete="tel" placeholder="0812 3456 7890"', p.phone || "") + end("Simpan profil"))}</section><section class="panel"><h2>Alamat email</h2><p>Perubahan perlu dikonfirmasi melalui email sesuai kebijakan project. Email lama tetap berlaku sampai proses selesai.</p>${form("email", input("email", "Email baru", "email", 'required autocomplete="email"') + end("Kirim konfirmasi email"))}</section><section class="panel"><h2>Ganti kata sandi</h2>${form("password", password("current", "Kata sandi saat ini", "current-password") + password("password", "Kata sandi baru", "new-password", true) + password("confirmation", "Konfirmasi kata sandi baru") + end("Perbarui kata sandi"))}</section></div></div>`;
  };
  A.workspace = (route, page) => {
    const role = ["owner", "tenant", "admin"].includes(route)
        ? route
        : ["owner", "tenant", "admin"].includes(A.defaultPath())
          ? A.defaultPath()
          : "prospect",
      label = A.roleLabels[role];
    const privateBody =
      ["account", "settings", "profile"].includes(page) || route === "account"
        ? A.profilePage()
        : `${N.heading("WORKSPACE / " + label.toUpperCase(), `Halo, ${e(A.profile.display_name.split(" ")[0])}.`, "Identitas terhubung. Ruang yang tepat untuk langkah berikutnya.")}<section class="panel connected-welcome"><span class="connected-icon">${N.icon(role === "owner" ? "building" : role === "tenant" ? "home" : role === "admin" ? "shield" : "search")}</span><div><span class="eyebrow">${e(label)}</span><h2>${role === "prospect" ? "Akunmu siap untuk menemukan tempat pulang." : "Akses akunmu sudah terverifikasi."}</h2><p>${role === "prospect" ? "Jelajahi listing publik. Ketika penempatan sewa disepakati dengan pemilik, identitas yang sama akan mendapatkan akses penghuni." : "Workspace ini mengikuti hak akses dari database. Profil dan keamanan akun sudah dapat dikelola."}</p><a class="btn btn-primary" href="#/account">Kelola profil</a><a class="btn btn-outline" href="#/marketplace">Jelajahi kos</a></div></section><section class="panel connected-phase"><h2>${page ? "Fitur ini belum terhubung." : "Operasional menyusul di Phase 3."}</h2><p>Properti, tagihan, transaksi, keluhan, dan pesan belum diintegrasikan ke workspace ini. Tidak ada data demo yang ditampilkan sebagai milik akunmu, dan aksi bisnis belum dibuka.</p>${role === "prospect" ? "<p>Butuh akses pemilik? Hubungi administrator platform. Pilihan tujuan registrasi tidak otomatis memberikan hak pemilik.</p>" : ""}${A.roles.includes("tenant") && !A.hasAgreement ? "<p>Role penghuni belum mempunyai relasi sewa. Minta pemilik menghubungkan penempatan yang sah.</p>" : ""}${action("Periksa pembaruan akses", "refresh-rights")}</section>`;
    return `<div class="dashboard-layout connected-layout"><aside class="sidebar">${N.logo()}<span class="sidebar-workspace">CONNECTED WORKSPACE</span><nav aria-label="Workspace"><a href="#/${A.defaultPath()}">${N.icon("home")}Beranda</a>${A.effectiveRoles
      .filter((r) => r !== "prospect")
      .map((r) => `<a href="#/${r}">${N.icon("grid")}${e(A.roleLabels[r])}</a>`)
      .join(
        "",
      )}<a href="#/account">${N.icon("settings")}Profil & keamanan</a><a href="#/marketplace">${N.icon("search")}Cari kos</a></nav><div class="connected-sidebar-bottom">${modeBadge()}${action("Keluar", "logout")}</div></aside><div class="dashboard-area"><header class="dashboard-header"><div class="breadcrumb">Workspace ${N.icon("chevron")} ${e(label)}</div><div class="dashboard-header-actions">${modeBadge()}<a href="#/account" aria-label="Buka profil">${N.avatar(A.profile.display_name)}</a>${action("Coba demo", "demo")}</div></header><main class="dashboard-main" id="main" tabindex="-1">${A.notice ? `<div class="notice" role="status">${e(A.notice)}</div>` : ""}${privateBody}</main><footer class="dashboard-footnote">Connected Mode · Profil tersimpan pada server · Modul bisnis menyusul di Phase 3.</footer></div></div>`;
  };
  A.denied = () =>
    `${A.navbar()}<main id="main" class="container section connected-denied"><span class="connected-icon">${N.icon("shield")}</span><span class="eyebrow">AKSES DIBATASI</span><h1>Ruang ini punya akses tersendiri.</h1><p>Akunmu tidak mempunyai hak untuk membuka workspace ini. Mengganti tautan atau peran demo tidak mengubah hak akses database.</p><a class="btn btn-primary" href="#/${A.defaultPath()}">Ke workspace saya</a><a class="btn btn-outline" href="#/account">Lihat profil</a></main>${A.footer()}`;
  A.publicNotice = (title, description) =>
    `${A.navbar()}<main id="main" class="container section connected-denied"><span class="eyebrow">CONNECTED MODE</span><h1>${title}</h1><p>${description}</p><a class="btn btn-primary" href="#/marketplace">Jelajahi kos</a></main>${A.footer()}`;
  // Preserve the existing marketing composition and styling, without demo recommendations.
  A.home = () => {
    const template = document.createElement("template");
    template.innerHTML = N.home();
    template.content
      .querySelectorAll(".property-card,.compare-bar")
      .forEach((node) => node.remove());
    const grid = template.content.querySelector(".property-grid");
    if (grid) grid.innerHTML = A.listingsMarkup(true);
    const proof = template.content.querySelector(".hero-proof small");
    if (proof)
      proof.textContent =
        "Identitas terhubung. Demo tersedia sebagai ruang terpisah.";
    const counter = template.content.querySelector(".photo-editorial-number");
    if (counter) counter.textContent = "RUANG UNTUK CERITA BARU";
    template.content
      .querySelectorAll('[data-action="roles"]')
      .forEach((node) => {
        node.removeAttribute("data-action");
        node.dataset.authAction = "demo";
      });
    const faqs = template.content.querySelector(".faq-section>div:last-child");
    if (faqs)
      faqs.innerHTML = [
        [
          "Bagaimana cara mulai menggunakan akun?",
          "Daftar dengan email milikmu, verifikasi pada browser yang sama, lalu masuk. Profilmu tersimpan pada server.",
        ],
        [
          "Apakah pencarian kos memerlukan akun?",
          "Katalog dan detail listing yang dipublikasikan dapat dibaca tanpa login. Connected Mode hanya menampilkan listing dari database.",
        ],
        [
          "Bagaimana memperoleh akses pemilik atau penghuni?",
          "Pemilik mendapat persetujuan administrator. Penghuni dihubungkan dengan penempatan sewa yang sah, tetap memakai identitas akun yang sama.",
        ],
        [
          "Apakah pembayaran sudah terhubung?",
          "Belum. Integrasi bisnis dilakukan pada Phase 3. Kamu dapat mencoba seluruh alur pembayaran simulasi melalui Demo Mode yang terpisah.",
        ],
      ]
        .map(
          ([q, a]) =>
            `<details class="faq-item"><summary>${q}${N.icon("plus")}</summary><p>${a}</p></details>`,
        )
        .join("");
    return template.innerHTML;
  };
  const safeImage = (path) =>
    typeof path === "string" &&
    /^assets\/images\/[\w.-]+\.(?:jpg|png|webp|jpeg)$/.test(path)
      ? path
      : "assets/images/room-2.jpg";
  A.listingCard = (p) =>
    `<article class="property-card"><a class="property-image" href="#/property/${e(p.id)}"><img src="${e(safeImage(p.images?.[0]?.path))}" alt="${e(p.images?.[0]?.alt || p.name)}" loading="lazy"><div class="image-badges">${p.promoted ? '<span class="promo-badge">Promosi</span>' : ""}</div></a><div class="property-body"><div class="property-meta"><span class="type-label">${e({ mixed: "Campur", male: "Putra", female: "Putri" }[p.gender_policy] || "Kos")}</span><span class="availability">${Number(p.available_rooms) || 0} kamar tersedia</span></div><a class="property-title" href="#/property/${e(p.id)}">${e(p.name)}</a><p class="property-location">${N.icon("pin")}${e(p.location)}</p><div class="property-features">${(
      p.facilities || []
    )
      .slice(0, 3)
      .map((f) => `<span>${e(f)}</span>`)
      .join(
        "",
      )}</div><div class="property-bottom"><strong>${N.money(p.base_rent)}</strong><a href="#/property/${e(p.id)}">Lihat detail</a></div></div></article>`;
  A.listingsMarkup = (short) => {
    if (A.configurationError || A.configError())
      return N.empty(
        "Katalog belum terhubung.",
        "Connected Mode memerlukan konfigurasi dan koneksi Supabase. Kamu tetap bisa mencoba data ilustrasi melalui Demo Mode.",
        action("Jelajahi demo", "demo"),
      );
    if (A.catalogueError)
      return N.empty(
        "Listing belum dapat dimuat.",
        A.catalogueError,
        action("Coba lagi", "retry-listings"),
      );
    if (!A.catalogue)
      return '<div class="connected-loading" role="status">Memuat listing publik…</div>';
    const q = (A.search || "").toLocaleLowerCase("id");
    const listings = A.catalogue.filter((p) =>
      `${p.name} ${p.location}`.toLocaleLowerCase("id").includes(q),
    );
    return listings.length
      ? (short ? listings.slice(0, 3) : listings).map(A.listingCard).join("")
      : N.empty(
          "Belum ada kos yang dipublikasikan.",
          "Listing Connected Mode dibaca dari database. Jelajahi data ilustrasi melalui Coba Demo.",
          action("Lihat demo marketplace", "demo"),
        );
  };
  A.marketplace = () =>
    `${A.navbar("marketplace")}<main id="main" class="container section"><div class="marketplace-banner"><div><span class="eyebrow">PILIHAN DARI KATALOG PUBLIK</span><h1>Kos yang pas, <em>rasanya beda.</em></h1><p>Listing yang dipublikasikan di Supabase, tanpa data demo.</p></div>${modeBadge()}</div>${form("search", input("query", "Cari nama atau lokasi", "search", 'placeholder="Coba Grogol"', A.search || "") + '<button class="btn btn-primary" type="submit">Cari kos</button>')}<div class="property-grid connected-listings">${A.listingsMarkup(false)}</div></main>${A.footer()}`;
  A.detail = (id) => {
    const p = A.catalogue?.find((p) => p.id === id);
    if (!p)
      return A.publicNotice(
        A.catalogue ? "Kos belum ditemukan." : "Memuat detail kos…",
        A.catalogue
          ? "Listing mungkin belum dipublikasikan atau telah diarsipkan."
          : "Detail hanya diambil dari katalog publik Supabase.",
      );
    return `${A.navbar()}<main id="main" class="container section"><div class="detail-breadcrumb"><a href="#/marketplace">Cari kos</a> / ${e(p.location)}</div><div class="detail-top"><div><span class="eyebrow">KATALOG PUBLIK</span><h1>${e(p.name)}</h1><p>${e(p.address)}</p></div><strong class="detail-price">${N.money(p.base_rent)} <small>/ bulan</small></strong></div><div class="connected-gallery">${(p
      .images?.length
      ? p.images
      : [{ path: "assets/images/room-2.jpg", alt: "Ilustrasi kamar" }]
    )
      .slice(0, 3)
      .map(
        (im) =>
          `<img src="${e(safeImage(im.path))}" alt="${e(im.alt || p.name)}">`,
      )
      .join(
        "",
      )}</div><div class="detail-grid"><div><section class="detail-section"><h2>Tentang tempat ini</h2><p>${e(p.description)}</p></section><section class="detail-section"><h2>Fasilitas</h2><div class="facility-grid">${p.facilities.map((f) => `<span>${N.icon("check")}${e(f)}</span>`).join("")}</div></section></div><aside class="panel contact-card"><h2>${Number(p.available_rooms)} kamar tersedia</h2><p>Hubungi pemilik dan proses penempatan akan diintegrasikan pada Phase 3. Tidak ada booking otomatis.</p><a class="btn btn-primary btn-full" href="#/${A.user ? "workspace" : "login"}">${A.user ? "Ke workspace" : "Masuk ke akun"}</a></aside></div></main>${A.footer()}`;
  };
  A.fetchListings = async () => {
    if (A.loadingListings || A.catalogue !== undefined) return;
    A.loadingListings = true;
    try {
      const { data, error } = await A.createClient().rpc("public_listings");
      if (error) throw error;
      if (A.mode === "connected") A.catalogue = data || [];
    } catch (error) {
      A.catalogueError = A.errorMessage(error);
      A.catalogue = [];
    } finally {
      A.loadingListings = false;
      if (A.mode === "connected") N.render();
    }
  };
  A.render = () => {
    if (A.mode === "demo") return false;
    const root = document.getElementById("app");
    document.body.dataset.mode = "connected";
    if (!A.ready) {
      root.innerHTML =
        '<main id="main" class="connected-loading" role="status">Menyiapkan ruangmu dengan aman…</main>';
      return true;
    }
    let [route, page] = A.route();
    const guard = A.guard(route);
    if (["login", "session-expired"].includes(guard)) {
      A.nextPath = A.safeNext([route, page].filter(Boolean).join("/"));
      route = guard;
    }
    if (guard === "access-denied") route = "access-denied";
    let body;
    if (
      [
        "login",
        "register",
        "forgot",
        "verify",
        "reset",
        "session-expired",
      ].includes(route)
    )
      body = A.authPage(route);
    else if (route === "access-denied") body = A.denied();
    else if (
      ["owner", "tenant", "admin", "workspace", "account"].includes(route)
    )
      body = A.workspace(route, page);
    else if (!route) body = A.home();
    else if (route === "marketplace") body = A.marketplace();
    else if (route === "property") body = A.detail(page);
    else if (["fitur", "tentang", "untuk-pemilik"].includes(route)) {
      const template = document.createElement("template");
      template.innerHTML = N.infoPage(route);
      const notice = template.content.querySelector(".notice");
      if (notice)
        notice.textContent =
          "Identitas dan profil Connected Mode sudah terhubung. Operasional bisnis menyusul di Phase 3; coba alurnya melalui Demo Mode. Tidak ada pembayaran nyata.";
      body = template.innerHTML;
    } else if (route === "privacy")
      body = A.publicNotice(
        "Privasi dimulai dari kendali.",
        "Connected Mode mengirim email, kata sandi, dan profil ke Supabase. Email dan kata sandi dikelola Supabase Auth; nama dan kontak disimpan di profil dengan RLS. Tujuan pendaftaran tidak memberi hak akses. Data demo tersimpan terpisah di browser. Tidak ada pembayaran nyata. Untuk perubahan atau penghapusan akun, hubungi administrator platform.",
      );
    else if (route === "help")
      body = A.publicNotice(
        "Ada yang ingin kamu tanyakan?",
        "Daftar, verifikasi email di browser yang sama, lalu masuk. Gunakan Lupa kata sandi untuk pemulihan. Pemilik perlu persetujuan administrator; penghuni dihubungkan melalui penempatan sah. Coba Demo tersedia terpisah tanpa akses backend.",
      );
    else
      body = A.publicNotice(
        "Ruang ini belum terhubung.",
        "Fitur bisnis akan diintegrasikan pada Phase 3. Tidak ada perubahan yang disimpan ke data demo dari Connected Mode.",
      );
    root.innerHTML = body;
    document.title = `${route === "login" ? "Masuk" : route === "register" ? "Daftar" : route === "account" ? "Profil & keamanan" : "Ruang terhubung"} · NgekosAja.com`;
    if (["", "marketplace", "property"].includes(route) && !A.configError())
      A.fetchListings();
    return true;
  };
  const oldNavbar = N.navbar,
    oldFooter = N.footer,
    oldDashboard = N.dashboardShell;
  N.navbar = (active) =>
    A.mode === "connected"
      ? A.navbar(active)
      : '<div class="demo-mode-bar">DEMO MODE · Data simulasi lokal <button data-auth-action="connected">Kembali ke akun sungguhan</button></div>' +
        oldNavbar(active);
  N.footer = () => (A.mode === "connected" ? A.footer() : oldFooter());
  N.dashboardShell = (page, body) =>
    '<div class="demo-mode-bar">DEMO MODE · Tidak terhubung ke backend <button data-auth-action="connected">Kembali ke akun sungguhan</button></div>' +
    oldDashboard(page, body);
})(window.NA, window.NK);
