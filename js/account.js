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
      root.innerHTML = `<div class="card login">
        <h3>👤 Войди в свой аккаунт</h3>
        <p class="muted small">У каждого аккаунта свой прогресс, свои слова и свои напоминания в Telegram.</p>
        <form id="login-form">
          <input class="field" id="login" placeholder="Логин" autocomplete="username" autocapitalize="none" required>
          <input class="field" id="password" type="password" placeholder="Пароль" autocomplete="current-password" required>
          <button class="btn primary wide">Войти</button>
        </form>
        <p class="small" id="login-msg">${App.tg ? "⏳ Проверяю Telegram…" : ""}</p>
      </div>`;
      const msg = (t) => { root.querySelector("#login-msg").textContent = t; };
      root.querySelector("#login-form").onsubmit = async (e) => {
        e.preventDefault();
        msg("⏳ Вхожу…");
        try { signedIn(await post("/api/auth", { login: root.querySelector("#login").value, password: root.querySelector("#password").value })); }
        catch (err) { msg("⚠️ " + err.message); }
      };
      // Inside Telegram: a bound Telegram signs in by itself.
      if (App.tg) {
        post("/api/auth?telegram=1").then(signedIn).catch(() => msg("Этот Telegram пока не привязан к аккаунту. Войди один раз — дальше вход будет сам."));
      }
    },
  };
})(window.App);
