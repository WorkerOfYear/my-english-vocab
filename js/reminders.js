// Reminder settings block (time + days of the week), shared by the tracker (words), grammar and Speak off the cuff.
// Settings live on the server (api/reminders.js): the external scheduler reads them there.
//   const r = App.Reminder("words", { label, note });
//   r.html() inside your markup, r.bind(root, redraw) after rendering, r.load(redraw) once to fetch from the server.
(function (App) {
  const { esc } = App;
  const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]; // ISO weekdays 1..7
  const myTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } };
  const ago = (ms) => {
    const min = Math.round((Date.now() - ms) / 60000);
    return min < 1 ? "только что" : min < 60 ? `${min} мин назад` : min < 48 * 60 ? `${Math.round(min / 60)} ч назад` : `${Math.round(min / 1440)} дн назад`;
  };

  App.Reminder = function (kind, opts = {}) {
    const KEY = "remind." + kind;
    const st = { data: App.store.get(KEY, null), lastTick: 0, cronSecret: true, msg: "", loaded: false };
    let timer = null;
    let redraw = () => {};
    const id = (x) => `rm-${kind}-${x}`;

    function schedulerLine() {
      if (!st.data || !st.data.enabled || !st.loaded) return "";
      if (!st.cronSecret) return "⚠️ На сервере не задан CRON_SECRET: без него планировщик не запустится. Как настроить, написано в README.";
      if (!st.lastTick) return "⚠️ Планировщик ещё ни разу не срабатывал. Настрой cron-job.org по инструкции в README, иначе напоминание не придёт.";
      if (Date.now() - st.lastTick > 3 * 3600 * 1000) return `⚠️ Планировщик давно молчит (последний сигнал ${ago(st.lastTick)}). Проверь задачу на cron-job.org.`;
      return `✓ Планировщик работает, последний сигнал ${ago(st.lastTick)}.`;
    }

    function save(patch) {
      Object.assign(st.data, patch, { tz: myTz() || st.data.tz });
      App.store.set(KEY, st.data);
      st.msg = "⏳ Сохраняю…";
      redraw();
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          st.data = (await App.sync.reminders.save(kind, st.data)).settings;
          App.store.set(KEY, st.data);
          st.msg = "✓ Сохранено";
        } catch (e) {
          st.msg = "⚠️ " + e.message;
        }
        redraw();
      }, 700);
    }

    return {
      html() {
        if (!App.sync || !App.sync.connected) {
          return `<p class="muted small">Чтобы бот присылал напоминания, подключи синхронизацию и бота в трекере (☁️ Синхронизация и Telegram).</p>`;
        }
        const r = st.data;
        if (!r) return `<p class="muted small">${st.msg ? esc(st.msg) : "⏳ Загружаю…"}</p>`;
        const line = schedulerLine();
        const note = typeof opts.note === "function" ? opts.note(r) : opts.note;
        return `<div class="reminder">
          <label class="row check"><input type="checkbox" id="${id("on")}" ${r.enabled ? "checked" : ""}> ${esc(opts.label || "Напоминать")}</label>
          <div class="reminder-body${r.enabled ? "" : " off"}">
            <div class="row"><label>Во сколько <input type="time" class="time-input" id="${id("time")}" value="${esc(r.time)}" ${r.enabled ? "" : "disabled"}></label></div>
            <div class="row chips" role="group" aria-label="Дни недели">
              ${DAYS.map((d, i) => `<button class="chip${r.days.includes(i + 1) ? " on" : ""}" data-rm-day="${kind}:${i + 1}" ${r.enabled ? "" : "disabled"}>${d}</button>`).join("")}
            </div>
            <p class="muted small">Время по часовому поясу ${esc(r.tz || myTz())}.${note ? " " + esc(note) : ""}</p>
            ${line ? `<p class="small">${esc(line)}</p>` : ""}
          </div>
          <div class="row"><button class="btn small" id="${id("test")}">📨 Прислать напоминание сейчас</button></div>
          ${st.msg ? `<p class="small">${esc(st.msg)}</p>` : ""}
        </div>`;
      },

      bind(root, rd) {
        redraw = rd;
        const $ = (x) => root.querySelector("#" + id(x));
        if ($("on")) $("on").onchange = (e) => save({ enabled: e.target.checked });
        if ($("time")) $("time").onchange = (e) => { if (e.target.value) save({ time: e.target.value }); };
        root.querySelectorAll(`[data-rm-day^="${kind}:"]`).forEach((b) => b.onclick = () => {
          const d = +b.dataset.rmDay.split(":")[1], days = st.data.days;
          const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
          if (next.length) save({ days: next });
        });
        if ($("test")) $("test").onclick = async () => {
          st.msg = "⏳ Отправляю…";
          redraw();
          try {
            const r = await App.sync.reminders.test(kind);
            st.msg = r.sent === false ? "Сейчас напоминать не о чем — бот промолчал бы." : "✅ Отправлено, проверь Telegram";
          } catch (e) { st.msg = "⚠️ " + e.message; }
          redraw();
        };
      },

      async load(rd) {
        if (rd) redraw = rd;
        if (!App.sync || !App.sync.connected) return;
        st.msg = "";
        try {
          const r = await App.sync.reminders.get(kind);
          Object.assign(st, { data: r.settings, lastTick: r.lastTick, cronSecret: r.cronSecret, loaded: true });
          App.store.set(KEY, r.settings);
        } catch (e) {
          st.msg = "⚠️ " + e.message;
        }
        redraw();
      },
    };
  };
})(window.App);
