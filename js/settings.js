// ⚙️ Settings (#settings): account (password, sign out), sync, Telegram bot and word reminders, Statham quotes,
// progress backup — and, for the admin, the list of accounts (create one, reset a password).
//
// Every part of the settings is a collapsible section. Other pages add their own sections with
//   App.settingsSection(id, order, () => ({ icon, title, sub?, html(), bind(root, redraw), load?(redraw) }))
// (a fresh object on every visit to the page); #settings?s=<id> opens that section and scrolls to it.
(function (App) {
  const { esc } = App;
  const srs = App.srs;
  const extra = []; // [{id, order, make}]
  App.settingsSection = (id, order, make) => { extra.push({ id, order, make }); };

  App.pages.settings = {
    title: "Настройки",
    noFilter: true,
    // Came here from a page's own link (#settings?s=cuff) → ← goes back to that page.
    parent: (p) => (["cuff", "grammar", "tracker"].includes(p.get("s")) ? p.get("s") : ""),
    render(root, params = new URLSearchParams()) {
      const online = App.sync.connected;
      const remind = App.Reminder("words", {
        label: "Напоминать о словах к повторению",
        note: (r) => "Бот пишет, только если есть слова к повторению." + (r.saved ? "" : " Пока ты не поменяешь настройки, напоминание приходит раз в день около 19:00–20:00 по Новосибирску."),
      });
      const st = {
        admin: !!(App.session && App.session.admin),
        quotes: App.store.get("quotes", { enabled: true, mat: true }),
        bot: null, // {bot, linked} | {error}
        users: null, // admin: [{uid, login, telegram, admin}]
        pwOpen: false,
        resetFor: "", // uid whose password the admin is resetting
        msg: {}, // per section: account, bot, quotes, admin
      };
      const say = (section, text) => { st.msg[section] = text; draw(); };
      const msgLine = (section) => (st.msg[section] ? `<p class="small">${st.msg[section]}</p>` : "");
      const api = (path, method, body) => App.sync.api(path, { method, noLogout: method !== "GET", body: body && JSON.stringify(body) });

      function accountCard() {
        if (!App.session) return "";
        return `<div class="row account-row">
            <span>Ты вошёл как <b>${esc(App.session.login)}</b>${st.admin ? ' <span class="badge">админ</span>' : ""}</span>
          </div>
          <div class="row">
            <button class="btn small" id="pw-toggle">🔑 Сменить пароль</button>
            <button class="btn small danger" id="logout">Выйти</button>
          </div>
          ${st.pwOpen ? `<form class="row" id="pw-form">
            <input class="field" id="pw-old" type="password" placeholder="Текущий пароль" autocomplete="current-password" required style="flex:1;min-width:140px">
            <input class="field" id="pw-new" type="password" placeholder="Новый пароль" autocomplete="new-password" minlength="4" required style="flex:1;min-width:140px">
            <button class="btn primary">Сохранить</button>
          </form>` : ""}
          ${msgLine("account")}`;
      }

      function syncCard() {
        return `<p class="small" id="sync-status">${esc(App.sync.status() || "")}</p>
          ${online ? `<p class="muted small">Прогресс этого аккаунта одинаковый на всех устройствах: просто войди под тем же логином.</p>` : ""}`;
      }

      function telegramCard() {
        if (!online) return "";
        const b = st.bot;
        const status = !b ? "🤖 Проверяю бота…"
          : b.error ? "🤖 " + esc(b.error)
          : b.linked ? `🤖 Бот <a href="https://t.me/${esc(b.bot)}" target="_blank" rel="noopener">@${esc(b.bot)}</a> подключён ✓`
          : `🤖 Бот <b>@${esc(b.bot)}</b> ещё не привязан к этому аккаунту — нажми «Подключить бота»`;
        const q = st.quotes;
        return `<p class="small">${status}</p>
          <div class="row"><button class="btn" id="bot-setup">🤖 ${b && b.linked ? "Переподключить бота" : "Подключить бота"}</button></div>
          ${msgLine("bot")}
          <p class="muted small">Когда напоминать, настраивается в разделах трекера, грамматики и Speak off the cuff.</p>
          <h3 class="section">💬 Цитата Стэтхэма в напоминаниях</h3>
          <label class="row check"><input type="checkbox" id="q-on" ${q.enabled ? "checked" : ""}> Добавлять цитату к каждому напоминанию</label>
          <label class="row check${q.enabled ? "" : " muted"}"><input type="checkbox" id="q-mat" ${q.mat ? "checked" : ""} ${q.enabled ? "" : "disabled"}> Можно с матом</label>
          ${msgLine("quotes")}`;
      }

      function trackerCard() {
        const a = srs.autoStatus();
        return `<label class="row check"><input type="checkbox" id="auto-take" ${a.on ? "checked" : ""}>
            Автоматически добавлять ${App.words(srs.AUTO_SIZE)} каждые ${srs.AUTO_DAYS / 7} недели</label>
          <p class="muted small">Берутся сначала новые слова из выбранного периода (📅). Добавление приостанавливается,
            пока изучается ${srs.AUTO_CAP} слов или больше.${a.on ? (a.paused ? " ⏸️ Сейчас на паузе: изучается " + App.words(a.learning) + "." : ` Следующие слова: ${a.nextDate <= App.today() ? "сегодня" : App.fmtDate(a.nextDate)}.`) : ""}</p>
          <h3 class="section">🔔 Напоминание о словах в Telegram</h3>${remind.html()}`;
      }

      function backupCard() {
        return `<p class="muted small">${online ? "Прогресс и так хранится на сервере. Копия в файл — на всякий случай:" : "Прогресс хранится в этом браузере. Сохраняй резервную копию, чтобы перенести его на другой компьютер."}</p>
          <div class="row">
            <button class="btn" id="export">💾 Сохранить в файл</button>
            <label class="btn">📂 Загрузить из файла<input type="file" id="import" accept=".json" hidden></label>
            <button class="btn danger" id="reset">Сбросить прогресс трекера</button>
          </div>`;
      }

      function adminCard() {
        if (!online || !st.admin) return "";
        const users = st.users;
        return `${!users ? `<p class="muted small">⏳ Загружаю…</p>` : `<table class="users">
            ${users.map((u) => `<tr>
              <td><b>${esc(u.login)}</b>${u.admin ? ' <span class="badge">админ</span>' : ""}</td>
              <td class="muted small">${u.telegram ? "🤖 Telegram ✓" : "без Telegram"}</td>
              <td><button class="btn small" data-reset="${esc(u.uid)}">Сбросить пароль</button></td>
            </tr>${st.resetFor === u.uid ? `<tr><td colspan="3"><form class="row" id="reset-form">
              <input class="field" id="reset-pw" type="text" placeholder="Новый пароль для ${esc(u.login)}" minlength="4" required autocomplete="off" style="flex:1;min-width:160px">
              <button class="btn primary">Сохранить</button></form></td></tr>` : ""}`).join("")}
          </table>`}
          <h3 class="section">Новый аккаунт</h3>
          <form class="row" id="create-form">
            <input class="field" id="new-login" placeholder="Логин (латиницей)" autocapitalize="none" autocomplete="off" required style="flex:1;min-width:140px">
            <input class="field" id="new-pw" type="text" placeholder="Пароль" minlength="4" required autocomplete="off" style="flex:1;min-width:140px">
            <button class="btn primary">Создать</button>
          </form>
          ${msgLine("admin")}
          <p class="muted small">Сброс пароля не выкидывает уже вошедшие устройства этого аккаунта.</p>`;
      }

      // Sections in display order. Built-in ones plus whatever other pages registered (grammar, Speak off the cuff).
      const own = [
        { id: "account", order: 10, icon: "👤", title: "Аккаунт", show: () => !!App.session, html: accountCard, sub: () => App.session && App.session.login },
        { id: "sync", order: 20, icon: "☁️", title: "Синхронизация", html: syncCard },
        { id: "tracker", order: 30, icon: "🗓️", title: "Трекер повторений", html: trackerCard,
          sub: () => (srs.settings.auto ? (srs.autoStatus().paused ? "авто: пауза" : "авто: вкл") : "авто: выкл") },
        { id: "telegram", order: 60, icon: "🤖", title: "Telegram", show: () => online, html: telegramCard,
          sub: () => (st.bot && st.bot.linked ? "бот подключён" : "") },
        { id: "admin", order: 80, icon: "👥", title: "Аккаунты", show: () => online && st.admin, html: adminCard },
        { id: "backup", order: 90, icon: "💾", title: "Резервная копия", html: backupCard },
      ];
      const sections = own.concat(extra.map((x) => ({ id: x.id, order: x.order, ...x.make() }))).sort((a, b) => a.order - b.order);

      // Which sections are open: remembered in this browser; a link with ?s=<id> opens that one.
      const OPEN_KEY = "settingsOpen";
      const opened = new Set(App.store.get(OPEN_KEY, []));
      const jump = params.get("s");
      if (jump) opened.add(jump);

      function draw() {
        root.innerHTML = sections.filter((x) => !x.show || x.show()).map((x) => {
          const sub = x.sub ? x.sub() : "";
          return `<details class="card settings-section" data-sec="${x.id}" ${opened.has(x.id) ? "open" : ""}>
            <summary><span class="sec-icon">${x.icon}</span><b>${esc(x.title)}</b>${sub ? `<span class="muted small sec-sub">${esc(sub)}</span>` : ""}</summary>
            <div class="sec-body">${x.html()}</div>
          </details>`;
        }).join("");
        root.querySelectorAll("details[data-sec]").forEach((d) => d.addEventListener("toggle", () => {
          if (d.open) opened.add(d.dataset.sec); else opened.delete(d.dataset.sec);
          App.store.set(OPEN_KEY, [...opened]);
        }));
        bind();
        sections.forEach((x) => x.bind && x.bind(root, draw));
      }

      function bind() {
        const $ = (s) => root.querySelector(s);
        const on = (s, ev, fn) => { const el = $(s); if (el) el[ev] = fn; };

        // account
        on("#logout", "onclick", async () => {
          if (await App.confirm(`Выйти из аккаунта ${App.session.login}? Прогресс сохранён на сервере.`)) App.logout();
        });
        on("#pw-toggle", "onclick", () => { st.pwOpen = !st.pwOpen; st.msg.account = ""; draw(); });
        on("#pw-form", "onsubmit", async (e) => {
          e.preventDefault();
          try {
            await api("/api/auth?password=1", "PUT", { old: $("#pw-old").value, password: $("#pw-new").value });
            st.pwOpen = false;
            say("account", "✓ Пароль изменён");
          } catch (err) { say("account", "⚠️ " + esc(err.message)); }
        });

        // Telegram
        remind.bind(root, draw);
        on("#bot-setup", "onclick", async () => {
          say("bot", "⏳ Настраиваю бота…");
          try {
            const r = await App.sync.setupBot();
            say("bot", `Открой ссылку и нажми <b>Start</b> — бот запомнит, что этот Telegram твой (ссылка работает час):<br>
              <a class="btn primary" href="${esc(r.link)}" target="_blank" rel="noopener" style="margin-top:8px">Открыть @${esc(r.bot)} в Telegram</a>`);
          } catch (err) { say("bot", "⚠️ " + esc(err.message)); }
        });
        const saveQuotes = async (patch) => {
          st.quotes = { ...st.quotes, ...patch };
          App.store.set("quotes", st.quotes);
          say("quotes", "⏳ Сохраняю…");
          try { st.quotes = (await App.sync.quotes.save(st.quotes)).quotes; App.store.set("quotes", st.quotes); say("quotes", "✓ Сохранено"); }
          catch (err) { say("quotes", "⚠️ " + esc(err.message)); }
        };
        on("#q-on", "onchange", (e) => saveQuotes({ enabled: e.target.checked }));
        on("#q-mat", "onchange", (e) => saveQuotes({ mat: e.target.checked }));

        // admin
        root.querySelectorAll("[data-reset]").forEach((b) => b.onclick = () => {
          st.resetFor = st.resetFor === b.dataset.reset ? "" : b.dataset.reset;
          st.msg.admin = "";
          draw();
          if ($("#reset-pw")) $("#reset-pw").focus();
        });
        on("#reset-form", "onsubmit", async (e) => {
          e.preventDefault();
          const u = st.users.find((x) => x.uid === st.resetFor);
          try {
            await api("/api/auth?reset=1", "PUT", { uid: st.resetFor, password: $("#reset-pw").value });
            st.resetFor = "";
            say("admin", `✓ Новый пароль для ${esc(u ? u.login : "")} сохранён`);
          } catch (err) { say("admin", "⚠️ " + esc(err.message)); }
        });
        on("#create-form", "onsubmit", async (e) => {
          e.preventDefault();
          const login = $("#new-login").value.trim();
          try {
            await api("/api/auth?create=1", "POST", { login, password: $("#new-pw").value });
            say("admin", `✓ Аккаунт ${esc(login)} создан`);
            loadUsers();
          } catch (err) { say("admin", "⚠️ " + esc(err.message)); }
        });

        // tracker auto mode
        on("#auto-take", "onchange", (e) => {
          srs.setSettings({ auto: e.target.checked });
          if (e.target.checked) srs.autoTake();
          draw();
        });

        // backup
        on("#export", "onclick", () => {
          const blob = new Blob([srs.exportJSON()], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `english-progress-${App.today()}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
        on("#import", "onchange", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try { srs.importJSON(await file.text()); App.renderFilter(); App.alert("Прогресс загружен"); }
          catch (err) { App.alert("Не получилось загрузить: " + err.message); }
        });
        on("#reset", "onclick", async () => {
          if (await App.confirm("Точно удалить все группы и прогресс повторений?")) { srs.reset(); App.alert("Прогресс трекера сброшен"); }
        });
      }

      function loadUsers() {
        api("/api/auth?users=1", "GET").then((r) => { st.users = r.users; draw(); }).catch((err) => say("admin", "⚠️ " + esc(err.message)));
      }

      draw();
      sections.forEach((x) => x.load && x.load(draw));
      if (jump) { const el = root.querySelector(`[data-sec="${CSS.escape(jump)}"]`); if (el) el.scrollIntoView({ block: "start" }); }
      if (online) {
        remind.load(draw);
        App.sync.quotes.get().then((r) => { st.quotes = r.quotes; App.store.set("quotes", st.quotes); draw(); }).catch(() => {});
        App.sync.botStatus().then((b) => { st.bot = b; draw(); }).catch((err) => { st.bot = { error: err.message }; draw(); });
        // Sessions from before the admin flag existed don't carry it — ask the server.
        api("/api/auth", "GET").then((me) => {
          if (me.admin !== st.admin) { st.admin = me.admin; App.saveSession({ ...App.session, admin: me.admin }); draw(); }
          if (me.admin) loadUsers();
        }).catch(() => {});
      }

      const onSync = () => { const el = root.querySelector("#sync-status"); if (el) el.textContent = App.sync.status(); };
      document.addEventListener("sync-status", onSync);
      return () => document.removeEventListener("sync-status", onSync);
    },
  };
})(window.App);
