// Accounts: the sign-in screen (#login) and signing out. Password change and the admin's account list are in ⚙️ (js/settings.js).
// Each account has its own progress on the server and its own copy in this browser (see App.store in common.js).
(function (App) {
  const { esc } = App;

  async function post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(App.tg && App.tg.initData ? { "x-telegram-init-data": App.tg.initData } : {}) },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || `Ошибка сервера (${r.status})`), { status: r.status });
    return data;
  }

  // New session → reload, so every module starts over with this account's data.
  function signedIn(s) {
    App.saveSession({ ...s, fresh: true });
    location.reload();
  }

  App.logout = async () => {
    try { await App.sync.flush(); } catch (e) { /* still sign out */ }
    try { await App.sync.api("/api/auth?logout=1", { method: "POST", noLogout: true }); } catch (e) { /* the session is dropped locally anyway */ }
    App.saveSession(null);
    history.replaceState(null, "", location.pathname);
    location.reload();
  };

  App.pages.login = {
    title: "Вход",
    noFilter: true,
    render(root) {
      // Pick your name from the list of accounts, then type the password. The last choice is remembered.
      const LAST = "vocab.lastLogin";
      let last = "";
      try { last = localStorage.getItem(LAST) || ""; } catch (e) { /* private mode */ }
      root.innerHTML = `<div class="card login">
        <h3>👤 Кто входит?</h3>
        <form id="login-form">
          <div class="row chips login-accounts" id="accounts" role="radiogroup" aria-label="Аккаунт"><span class="muted small">⏳ Загружаю аккаунты…</span></div>
          <input class="field" id="login" placeholder="Логин" autocomplete="username" autocapitalize="none" hidden>
          <input class="field" id="password" type="password" placeholder="Пароль" autocomplete="current-password" required>
          <button class="btn primary wide">Войти</button>
        </form>
        <p class="small" id="login-msg">${App.tg ? "⏳ Проверяю Telegram…" : ""}</p>
      </div>`;
      const $ = (sel) => root.querySelector(sel);
      const msg = (t) => { $("#login-msg").textContent = t; };
      const choose = (login) => {
        $("#login").value = login;
        root.querySelectorAll("[data-login]").forEach((b) => {
          b.classList.toggle("on", b.dataset.login === login);
          b.setAttribute("aria-checked", b.dataset.login === login);
        });
        $("#password").focus();
      };
      fetch("/api/auth?logins=1").then((r) => r.json()).then(({ logins }) => {
        if (!logins || !logins.length) throw new Error("no accounts");
        $("#accounts").innerHTML = logins.map((l) =>
          `<button type="button" class="chip" role="radio" aria-checked="false" data-login="${App.esc(l)}">${App.esc(l)}</button>`).join("");
        root.querySelectorAll("[data-login]").forEach((b) => b.onclick = () => choose(b.dataset.login));
        const pre = logins.find((l) => l.toLowerCase() === last.toLowerCase()) || (logins.length === 1 ? logins[0] : "");
        if (pre) choose(pre);
      }).catch(() => {
        // No list (server unreachable) — type the login by hand.
        $("#accounts").hidden = true;
        $("#login").hidden = false;
        $("#login").value = last;
      });
      $("#login-form").onsubmit = async (e) => {
        e.preventDefault();
        const login = $("#login").value.trim();
        if (!login) return msg("Выбери аккаунт");
        msg("⏳ Вхожу…");
        try {
          const s = await post("/api/auth", { login, password: $("#password").value });
          try { localStorage.setItem(LAST, s.login); } catch (err) { /* private mode */ }
          signedIn(s);
        } catch (err) { msg("⚠️ " + err.message); }
      };
      // Inside Telegram: a bound Telegram signs in by itself.
      if (App.tg) {
        post("/api/auth?telegram=1").then(signedIn).catch(() => msg("Этот Telegram пока не привязан к аккаунту. Войди один раз — дальше вход будет сам."));
      }
    },
  };
})(window.App);
