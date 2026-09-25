// Router, period filter, home page and word list.
(function (App) {
  const { esc } = App;
  App.pages = App.pages || {};
  let cleanup = null;

  // ---------- period filter: 📅 button in the header + popover panel
  const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const PRESETS = [["Всё время", 0], ["7 дней", 7], ["30 дней", 30], ["3 месяца", 91]];
  let panelOpen = false;

  const presetFrom = (days) => (days ? App.addDays(App.today(), -days) : "");
  const shortMonth = (iso) => { const [y, m] = iso.split("-").map(Number); return `${MONTHS_SHORT[m - 1]}${y !== new Date().getFullYear() ? " " + y : ""}`; };
  const shortDay = (iso) => `${+iso.slice(8)} ${MONTHS_SHORT[+iso.slice(5, 7) - 1]}`;
  const lastOfMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return App.iso(new Date(y, m, 0)); };

  // Short text next to the icon, "" when nothing is filtered.
  function filterLabel() {
    const { from, to, hardOnly } = App.filter;
    let period = "";
    const preset = PRESETS.find(([, d]) => d && from === presetFrom(d) && !to);
    if (preset) period = preset[1] === 91 ? "3 мес" : `${preset[1]} дн`;
    else if (from && to && from.endsWith("-01") && to === lastOfMonth(from.slice(0, 7))) period = shortMonth(from);
    else if (from && !to) period = from.endsWith("-01") ? `с ${shortMonth(from)}` : `с ${shortDay(from)}`;
    else if (!from && to) period = `по ${shortDay(to)}`;
    else if (from && to) period = `${shortDay(from)} – ${shortDay(to)}`;
    return [period, hardOnly ? "трудные" : ""].filter(Boolean).join(" · ");
  }

  function renderFilter() {
    const f = App.filter;
    const btn = document.getElementById("filter-btn");
    const label = filterLabel();
    const count = App.filtered().length;
    btn.classList.toggle("active", !!label);
    btn.title = `Период: ${label || "всё время"} · ${App.words(count)}`;
    btn.setAttribute("aria-expanded", panelOpen);
    btn.innerHTML = `<span aria-hidden="true">📅</span>${label ? `<span class="flabel">${esc(label)}</span>` : ""}`;

    const panel = document.getElementById("filter-panel");
    panel.hidden = !panelOpen;
    if (!panelOpen) return;
    const months = [...new Set(App.ALL.map((w) => w.date.slice(0, 7)))].sort().reverse();
    const hardCount = Object.keys(App.hard).length;
    panel.innerHTML = `
      <div class="panel-head"><b>Период</b><button class="icon-btn small" id="f-close" aria-label="Закрыть">✕</button></div>
      <div class="row chips">
        ${PRESETS.map(([t, d]) => `<button class="chip${f.from === presetFrom(d) && !f.to ? " on" : ""}" data-days="${d}">${t}</button>`).join("")}
      </div>
      <select id="f-month" aria-label="Период по месяцам">
        <option value="">По месяцам…</option>
        <optgroup label="Начиная с месяца">
          ${months.map((m) => `<option value="from:${m}">с ${App.monthName(m)}</option>`).join("")}
        </optgroup>
        <optgroup label="Только один месяц">
          ${months.map((m) => `<option value="only:${m}">${App.monthName(m)}</option>`).join("")}
        </optgroup>
      </select>
      <div class="row">
        <label>с <input type="date" id="f-from" value="${esc(f.from)}"></label>
        <label>по <input type="date" id="f-to" value="${esc(f.to)}"></label>
      </div>
      <label class="row check"><input type="checkbox" id="f-hard" ${f.hardOnly ? "checked" : ""} ${hardCount || f.hardOnly ? "" : "disabled"}>
        только трудные слова (${hardCount})</label>
      <p class="panel-count">В выборке <b>${App.words(count)}</b></p>`;
    const apply = (patch) => { App.setFilter(patch); renderFilter(); route(); };
    panel.querySelector("#f-close").onclick = () => toggleFilter(false);
    panel.querySelector("#f-from").onchange = (e) => apply({ from: e.target.value });
    panel.querySelector("#f-to").onchange = (e) => apply({ to: e.target.value });
    panel.querySelector("#f-hard").onchange = (e) => apply({ hardOnly: e.target.checked });
    panel.querySelectorAll("[data-days]").forEach((b) => b.onclick = () => apply({ from: presetFrom(+b.dataset.days), to: "" }));
    panel.querySelector("#f-month").onchange = (e) => {
      const [kind, ym] = e.target.value.split(":");
      if (ym) apply(kind === "from" ? { from: `${ym}-01`, to: "" } : { from: `${ym}-01`, to: lastOfMonth(ym) });
    };
  }

  function toggleFilter(open = !panelOpen) {
    panelOpen = open;
    renderFilter();
  }
  App.openFilter = () => toggleFilter(true);
  document.addEventListener("click", (e) => {
    if (e.target.closest("#filter-btn")) return toggleFilter();
    if (e.target.closest("[data-open-filter]")) return toggleFilter(true);
    if (panelOpen && !e.target.closest("#filter-panel")) toggleFilter(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen) toggleFilter(false); });
  App.renderFilter = renderFilter;

  // ---------- home
  App.pages.home = {
    title: "Мой английский",
    render(root) {
      const due = App.srs.dueWords().length;
      const active = App.srs.activeGroups().length;
      const tiles = [
        ["tracker", "🗓️", "Трекер повторений", active ? (due ? `<b>${App.words(due)}</b> к повторению сегодня` : "На сегодня всё повторено ✨") : "Возьми первую группу слов"],
        ["cards", "🃏", "Карточки", "Перевернул — вспомнил — отметил"],
        ["quiz", "✅", "Квиз", "4 варианта ответа, EN→RU и RU→EN"],
        ["hangman", "🪢", "Виселица", "Угадай слово по буквам"],
        ["listen", "🎧", "Аудирование", "Послушай и напиши"],
        ["cloze", "🧩", "Вставь слово", "Слово пропущено в предложении"],
        ["words", "📖", "Словарь", "Все слова с поиском"],
        ["add", "➕", "Добавить слова", "Вставь новые слова с урока"],
      ];
      root.innerHTML = `
        <div class="tiles">
          ${tiles.map(([id, icon, title, sub]) => `
            <a class="tile${id === "tracker" && due ? " accent" : ""}" href="#${id}">
              <span class="tile-icon">${icon}</span>
              <span class="tile-title">${title}</span>
              <span class="tile-sub">${sub}</span>
            </a>`).join("")}
        </div>`;
    },
  };

  // ---------- word list
  App.pages.words = {
    title: "Словарь",
    render(root) {
      const list = App.filtered().slice().reverse();
      root.innerHTML = `
        <input type="search" id="q" class="search" placeholder="Поиск по-английски или по-русски" autocomplete="off">
        <div id="list"></div>`;
      const draw = () => {
        const q = root.querySelector("#q").value.trim().toLowerCase();
        const rows = list.filter((w) => !q || w.en.toLowerCase().includes(q) || App.meaning(w).toLowerCase().includes(q));
        let lastMonth = "";
        root.querySelector("#list").innerHTML = rows.slice(0, 400).map((w) => {
          const m = w.date.slice(0, 7);
          const head = m !== lastMonth ? `<h3 class="month">${App.monthName(m)}</h3>` : "";
          lastMonth = m;
          return `${head}<div class="word-row">
            ${App.speakBtn(w.en)}
            <div><b>${esc(w.en)}</b> ${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ""}${App.hard[w.en] ? ' <span class="badge">трудное</span>' : ""}${w.source === "manual" ? ' <span class="badge added">добавлено</span>' : ""}
              <div>${esc(App.meaning(w))}</div>
              ${App.exampleHtml(w)}</div>
            <div class="row-side"><span class="muted small">${App.fmtDate(w.date)}</span>
              ${w.source === "manual" ? `<button class="icon-btn small" data-remove="${esc(w.en)}" title="Удалить слово" aria-label="Удалить слово">🗑</button>` : ""}</div>
          </div>`;
        }).join("") + (rows.length > 400 ? `<p class="muted center">…и ещё ${rows.length - 400}. Уточни поиск или фильтр.</p>` : "")
          + (rows.length ? "" : `<p class="muted center">Ничего не найдено</p>`);
      };
      root.querySelector("#q").addEventListener("input", draw);
      root.querySelector("#list").addEventListener("click", async (e) => {
        const b = e.target.closest("[data-remove]");
        if (!b || !(await App.confirm(`Удалить «${b.dataset.remove}» из словаря?`))) return;
        App.removeWord(b.dataset.remove);
        const k = list.findIndex((w) => w.en === b.dataset.remove);
        if (k >= 0) list.splice(k, 1);
        renderFilter();
        draw();
      });
      draw();
    },
  };

  // ---------- router
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    const name = (location.hash.slice(1) || "home").split("?")[0];
    const page = App.pages[name] || App.pages.home;
    document.getElementById("title").textContent = page.title;
    document.getElementById("back").hidden = page === App.pages.home;
    document.title = page === App.pages.home ? "Мой английский" : `${page.title} · Мой английский`;
    const root = document.getElementById("page");
    root.innerHTML = "";
    root.className = `page page-${name}`;
    if (!App.ALL.length) {
      root.innerHTML = `<p class="center">Слов пока нет. Запусти <code>python scripts/extract_words.py</code>.</p>`;
      return;
    }
    cleanup = page.render(root) || null;
    renderFilter();
  }
  App.route = route;

  // Shown by games when the current filter leaves too few words.
  App.notEnough = (root, need) => {
    root.innerHTML = `<div class="card center"><p>В выбранном периоде ${App.words(App.filtered().length)}, а нужно хотя бы ${need}.</p>
      <button class="btn" data-open-filter>📅 Изменить период</button></div>`;
  };

  // Links from the Telegram bot open ?page=review; Telegram itself may put its launch data into the hash.
  const startPage = new URLSearchParams(location.search).get("page");
  if (startPage !== null || /^#tgWeb/.test(location.hash)) {
    history.replaceState(null, "", location.pathname + (startPage ? "#" + startPage : ""));
  }

  window.addEventListener("hashchange", () => { panelOpen = false; route(); });
  document.addEventListener("DOMContentLoaded", () => {
    renderFilter();
    route();
  });
})(window.App);
