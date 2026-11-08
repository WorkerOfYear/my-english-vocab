// 📊 Statistics (#stats): how many words each account has learned. No places — just everyone's numbers side by side.
// Data: GET /api/stats → { users: [{login, me, learned, consolidated, learning, weeks:[8 counts], accuracy, streak, since}] }
(function (App) {
  const { esc } = App;
  const WEEKS = 8;

  function weeksChart(weeks) {
    const max = Math.max(1, ...weeks);
    return `<div class="weeks" title="Повторений за неделю, последние ${WEEKS} недель">
      ${weeks.map((n, i) => `<div class="wk${i === weeks.length - 1 ? " now" : ""}" title="${i === weeks.length - 1 ? "эта неделя" : `${weeks.length - 1 - i} нед. назад`}: ${n}">
        <div class="bar" style="height:${(n / max) * 100}%"></div></div>`).join("")}
    </div>`;
  }

  function userCard(u) {
    const total = u.learned + u.consolidated + u.learning;
    const seg = (n, cls, label) => (n ? `<div class="${cls}" style="flex:${n}" title="${label}: ${n}"></div>` : "");
    return `<div class="card user-stat${u.me ? " me" : ""}">
      <div class="user-head">
        <b>${esc(u.login)}</b>${u.me ? ' <span class="badge added">это ты</span>' : ""}
        <span class="streak${u.streak ? "" : " muted"}" title="Дней подряд с повторениями">🔥 ${u.streak} ${App.plural(u.streak, "день", "дня", "дней")} подряд</span>
      </div>
      <div class="nums">
        <div><div class="num learned">${u.learned}</div><div class="muted small">выучено</div></div>
        <div><div class="num">${u.consolidated}</div><div class="muted small">закреплено</div></div>
        <div><div class="num">${u.learning}</div><div class="muted small">в процессе</div></div>
      </div>
      ${total ? `<div class="stepbar thin">${seg(u.learned, "s6", "выучено")}${seg(u.consolidated, "s4", "закреплено")}${seg(u.learning, "s1", "в процессе")}</div>` : ""}
      <div class="small muted weeks-label">Повторения за ${WEEKS} недель</div>
      ${weeksChart(u.weeks)}
      <div class="small muted">${u.accuracy != null ? `точность ${u.accuracy}%` : "ещё нет повторений"}${u.since ? ` · учится с ${App.fmtDate(u.since)}` : ""}</div>
    </div>`;
  }

  function draw(root, users) {
    users = users.slice().sort((a, b) => (b.me - a.me) || a.login.localeCompare(b.login));
    const learned = users.reduce((n, u) => n + u.learned, 0);
    root.innerHTML = `
      <div class="card today-card">
        <div class="big">${App.words(learned)}</div>
        <p class="muted">выучили все вместе · ${users.length} ${App.plural(users.length, "человек", "человека", "человек")}</p>
      </div>
      ${users.map(userCard).join("")}
      <p class="muted small center"><b>Выучено</b> — слово прошло 30-дневное повторение, <b>закреплено</b> — недельное,
        <b>в процессе</b> — остальные слова из активных групп трекера.</p>`;
  }

  App.pages.stats = {
    title: "Статистика",
    noFilter: true,
    render(root) {
      if (App.statsData) return draw(root, App.statsData); // preview with sample data
      root.innerHTML = `<p class="muted center">⏳ Загружаю…</p>`;
      App.sync.api("/api/stats").then((r) => draw(root, r.users))
        .catch((e) => { root.innerHTML = `<div class="card center"><p>⚠️ ${esc(e.message)}</p></div>`; });
    },
  };
})(window.App);
