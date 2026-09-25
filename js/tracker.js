// Tracker dashboard (#tracker) and the daily review session (#review).
(function (App) {
  const { esc } = App;
  const srs = App.srs;
  const STEP_LABELS = ["новое", "1 день", "3 дня", "неделя", "2 недели", "месяц", "выучено"];

  function stepBar(stats) {
    return `<div class="stepbar" title="Сколько слов на каком интервале">
      ${stats.steps.map((n, s) => n ? `<div class="s${s}" style="flex:${n}" title="${STEP_LABELS[s]}: ${n}">${n}</div>` : "").join("")}
    </div>`;
  }

  function forecastChart() {
    const counts = srs.forecast(30);
    const max = Math.max(1, ...counts);
    const today = App.today();
    return `<div class="forecast">
      ${counts.map((n, d) => {
        const date = App.addDays(today, d);
        const label = d === 0 ? "сегодня" : d === 1 ? "завтра" : App.fmtDate(date);
        return `<div class="day${d === 0 ? " today" : ""}" title="${label}: ${App.words(n)}">
          <div class="bar" style="height:${(n / max) * 100}%">${n ? `<span>${n}</span>` : ""}</div>
          <div class="dlabel">${d % 7 === 0 ? (d === 0 ? "сег" : date.slice(8)) : ""}</div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function groupCard(g) {
    const s = srs.groupStats(g);
    const done = !!g.completedAt;
    const words = srs.groupWords(g).map((en) => App.byEn.get(en));
    return `<details class="group card">
      <summary>
        <div class="group-head">
          <b>Группа ${srs.groupNumber(g)}</b>
          <span class="muted small">${done ? `выучена ${App.fmtDate(g.completedAt)}` : `с ${App.fmtDate(g.createdAt)} · закреплено ${s.consolidated}/${s.total}`}</span>
        </div>
        ${stepBar(s)}
      </summary>
      <table class="group-words">
        ${words.map((w) => {
          const c = srs.card(w.en) || { step: 0 };
          return `<tr><td>${App.speakBtn(w.en)}</td><td><b>${esc(w.en)}</b><br><span class="muted">${esc(App.meaning(w))}</span></td>
            <td class="small"><span class="pill s${Math.min(c.step, 6)}">${STEP_LABELS[Math.min(c.step, 6)]}</span><br>
            <span class="muted">${c.due ? (c.due <= App.today() ? "повторить сегодня" : App.fmtDate(c.due)) : ""}</span></td></tr>`;
        }).join("")}
      </table>
      ${done ? "" : `<button class="btn small danger" data-remove="${g.id}">Удалить группу</button>`}
    </details>`;
  }

  App.pages.tracker = {
    title: "Трекер повторений",
    render(root) {
      function draw() {
        const due = srs.dueWords();
        const active = srs.activeGroups();
        const completed = srs.completedGroups();
        const block = srs.blockReason();
        const candidates = srs.candidates().length;
        const set = srs.settings;
        const learnedTotal = completed.reduce((n, g) => n + srs.groupWords(g).length, 0);
        root.innerHTML = `
          <div class="card today-card ${due.length ? "accent" : ""}">
            ${active.length ? (due.length ? `
              <div class="big">${App.words(due.length)}</div>
              <p>нужно повторить сегодня</p>
              <a class="btn primary wide" href="#review">Начать повторение</a>` : `
              <div class="big">✨ На сегодня всё</div>
              <p class="muted">Следующее повторение: ${nextReviewText()}</p>`) : `
              <div class="big">Начнём?</div>
              <p>Трекер даёт группу из ${set.batchSize} слов и напоминает, когда их повторить:
              через 1, 3, 7, 14 и 30 дней. Когда группа закреплена, открывается следующая.</p>`}
          </div>

          <div class="card">
            <h3>Новая группа слов</h3>
            <p class="muted small">Слова берутся из периода, выбранного в <button class="link" data-open-filter>📅 справа вверху</button> — доступно ещё ${App.words(candidates)}.</p>
            <div class="row">
              <label>Размер <select id="batch">${[10, 15, 20, 30].map((n) => `<option${n === set.batchSize ? " selected" : ""}>${n}</option>`).join("")}</select></label>
              <label>Порядок <select id="order">
                <option value="old"${set.order === "old" ? " selected" : ""}>сначала старые</option>
                <option value="new"${set.order === "new" ? " selected" : ""}>сначала новые</option>
                <option value="random"${set.order === "random" ? " selected" : ""}>случайно</option>
              </select></label>
            </div>
            ${block ? `<p class="note">${esc(block)}</p>` : ""}
            <button class="btn ${block ? "" : "primary"} wide" id="take" ${candidates ? "" : "disabled"}>
              ${block && candidates ? "Всё равно взять группу" : "Взять группу слов"}</button>
          </div>

          ${active.length ? `<div class="card"><h3>Повторения на 30 дней</h3>${forecastChart()}</div>` : ""}

          ${active.length ? `<h3 class="section">Активные группы</h3>${active.map(groupCard).join("")}` : ""}
          ${completed.length ? `<h3 class="section">Выученные группы · ${App.words(learnedTotal)}</h3>${completed.map(groupCard).join("")}` : ""}

          <div class="legend">${STEP_LABELS.map((l, s) => `<span class="pill s${s}">${l}</span>`).join("")}</div>

          ${syncCard()}

          <div class="card">
            <h3>Прогресс</h3>
            <p class="muted small">${App.sync.connected ? "Прогресс синхронизируется между устройствами. Резервная копия на всякий случай:" : "Прогресс хранится в этом браузере. Сохраняй резервную копию, чтобы перенести его на другой компьютер."}</p>
            <div class="row">
              <button class="btn" id="export">💾 Сохранить в файл</button>
              <label class="btn">📂 Загрузить из файла<input type="file" id="import" accept=".json" hidden></label>
              <button class="btn danger" id="reset">Сбросить всё</button>
            </div>
          </div>`;

        root.querySelector("#batch").onchange = (e) => { srs.setSettings({ batchSize: +e.target.value }); draw(); };
        root.querySelector("#order").onchange = (e) => { srs.setSettings({ order: e.target.value }); draw(); };
        root.querySelector("#take").onclick = async () => {
          if (block && !(await App.confirm(`${block}\n\nВсё равно взять новую группу? Повторений станет больше.`))) return;
          srs.takeGroup();
          draw();
        };
        root.querySelectorAll("[data-remove]").forEach((b) => b.onclick = async () => {
          if (await App.confirm("Удалить группу и её прогресс?")) { srs.removeGroup(+b.dataset.remove); draw(); }
        });
        root.querySelector("#export").onclick = () => {
          const blob = new Blob([srs.exportJSON()], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `english-progress-${App.today()}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        };
        root.querySelector("#import").onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try { srs.importJSON(await file.text()); App.renderFilter(); draw(); App.alert("Прогресс загружен"); }
          catch (err) { App.alert("Не получилось загрузить: " + err.message); }
        };
        root.querySelector("#reset").onclick = async () => {
          if (await App.confirm("Точно удалить все группы и прогресс повторений?")) { srs.reset(); draw(); }
        };
        bindSync();
      }

      function syncCard() {
        const sync = App.sync;
        const head = `<div class="card"><h3>☁️ Синхронизация и Telegram</h3>`;
        if (!sync.online) {
          return `${head}<p class="muted small">${esc(sync.status())} Открой сайт на Vercel, чтобы подключить напоминания.</p></div>`;
        }
        if (sync.viaTelegram) {
          return `${head}<p class="small">✅ Вход через Telegram — прогресс общий с сайтом.</p>
            <p class="small" id="sync-status">${esc(sync.status())}</p>
            <div class="row"><button class="btn" id="sync-test">📨 Прислать напоминание сейчас</button></div>
            <p class="small" id="sync-msg"></p></div>`;
        }
        if (!sync.connected) {
          return `${head}<p class="muted small">Прогресс будет одинаковым на телефоне и компьютере, а бот в Telegram будет присылать
            вечером ссылку на повторение. Введи ключ — это значение <code>SYNC_KEY</code> из настроек проекта в Vercel.</p>
            <form class="row" id="sync-form">
              <input class="field" id="sync-key" type="password" placeholder="Ключ синхронизации" autocomplete="off" style="flex:1;min-width:180px">
              <button class="btn primary">Подключить</button>
            </form>
            <p class="small" id="sync-status"></p></div>`;
        }
        return `${head}<p class="small" id="sync-status">${esc(sync.status())}</p>
          <p class="small" id="bot-status">🤖 Проверяю бота…</p>
          <div class="row">
            <button class="btn" id="bot-setup">🤖 Подключить бота</button>
            <button class="btn" id="sync-test">📨 Проверить Telegram</button>
            <button class="btn" id="sync-link">📱 Подключить телефон</button>
            <button class="btn danger" id="sync-off">Отключить</button>
          </div>
          <p class="small" id="sync-msg"></p></div>`;
      }

      function bindSync() {
        const $ = (sel) => root.querySelector(sel);
        const msg = (html) => { const el = $("#sync-msg"); if (el) el.innerHTML = html; };
        const form = $("#sync-form");
        if (form) form.onsubmit = async (e) => {
          e.preventDefault();
          const key = $("#sync-key").value.trim();
          if (!key) return;
          $("#sync-status").textContent = "⏳ Подключаюсь…";
          try { await App.sync.connect(key); draw(); }
          catch (err) { $("#sync-status").textContent = "⚠️ " + err.message; }
        };
        const botStatus = $("#bot-status");
        if (botStatus) {
          App.sync.botStatus().then((b) => {
            botStatus.innerHTML = b.linked
              ? `🤖 Бот <a href="https://t.me/${esc(b.bot)}" target="_blank" rel="noopener">@${esc(b.bot)}</a> подключён ✓`
              : `🤖 Бот <b>@${esc(b.bot)}</b> ещё не привязан — нажми «Подключить бота»`;
            if (b.linked) $("#bot-setup").textContent = "🤖 Переподключить бота";
          }).catch((err) => { botStatus.textContent = "🤖 " + err.message; });
        }
        const setup = $("#bot-setup");
        if (setup) setup.onclick = async () => {
          msg("⏳ Настраиваю бота…");
          try {
            const r = await App.sync.setupBot();
            msg(`Открой ссылку и нажми <b>Start</b> — бот запомнит тебя (ссылка работает час):<br>
              <a class="btn primary" href="${esc(r.link)}" target="_blank" rel="noopener" style="margin-top:8px">Открыть @${esc(r.bot)} в Telegram</a>`);
          } catch (err) { msg("⚠️ " + esc(err.message)); }
        };
        const test = $("#sync-test");
        if (test) test.onclick = async () => {
          msg("⏳ Отправляю…");
          try {
            const r = await App.sync.test();
            msg(r.sent ? "✅ Сообщение отправлено — проверь Telegram" : "Отправлено");
          } catch (err) { msg("⚠️ " + esc(err.message)); }
        };
        const link = $("#sync-link");
        if (link) link.onclick = async () => {
          const url = App.sync.deviceLink();
          try {
            await navigator.clipboard.writeText(url);
            msg("🔗 Ссылка скопирована. Открой её на телефоне — он подключится сам. Никому её не отправляй.");
          } catch (e) {
            msg(`Открой эту ссылку на телефоне (никому её не отправляй):<br><input class="field small" readonly value="${esc(url)}" onfocus="this.select()">`);
          }
        };
        const off = $("#sync-off");
        if (off) off.onclick = async () => {
          if (await App.confirm("Отключить синхронизацию на этом устройстве? Прогресс останется в браузере.")) { App.sync.disconnect(); draw(); }
        };
      }

      function nextReviewText() {
        const counts = srs.forecast(60);
        const d = counts.findIndex((n) => n > 0);
        if (d < 0) return "нет запланированных";
        return `${d === 1 ? "завтра" : App.fmtDate(App.addDays(App.today(), d))} (${App.words(counts[d])})`;
      }

      draw();
      const onSync = () => {
        const el = root.querySelector("#sync-status");
        if (el && App.sync.connected) el.textContent = App.sync.status();
      };
      document.addEventListener("sync-status", onSync);
      return () => document.removeEventListener("sync-status", onSync);
    },
  };

  // ---------- review session: new/early words as flashcards, later ones typed from memory
  App.pages.review = {
    title: "Повторение",
    render(root) {
      const queue = App.shuffle(srs.dueWords());
      const total = queue.length;
      const graded = new Set();
      let w, revealed, typed, correct = 0;

      if (!total) {
        root.innerHTML = `<div class="card center"><div class="big">✨ Нечего повторять</div>
          <p><a href="#tracker">К трекеру</a></p></div>`;
        return;
      }

      function next() {
        w = queue.shift();
        revealed = false;
        typed = null;
        draw();
      }

      const typing = () => (srs.card(w.en)?.step ?? 0) >= 2;

      function grade(ok) {
        if (!graded.has(w.en)) {
          graded.add(w.en);
          srs.answer(w.en, ok);
          App.record(w, ok);
          if (ok) correct++;
        }
        if (!ok) queue.push(w); // must get it right once before the session ends
        next();
      }

      function draw() {
        if (!w) {
          root.innerHTML = `<div class="card center"><div class="big">Готово! 🎉</div>
            <p>Вспомнил с первого раза: <b>${correct}</b> из ${total}</p>
            <p class="muted">Слова с ошибками вернутся завтра.</p>
            <a class="btn primary" href="#tracker">К трекеру</a></div>`;
          return;
        }
        const c = srs.card(w.en) || { step: 0 };
        const head = `
          <div class="toolbar"><span class="muted">осталось ${queue.length + 1}</span>
            <span class="pill s${Math.min(c.step, 6)}">${STEP_LABELS[Math.min(c.step, 6)]}</span></div>
          <div class="progress"><div style="width:${(graded.size / total) * 100}%"></div></div>`;
        const details = `<hr><div class="big">${esc(w.en)}</div>${w.ipa ? `<div class="ipa">${esc(w.ipa)}</div>` : ""}
          <div class="speak-row">${App.speakBtn(w.en)}${App.speakBtn(w.en, true)}</div>
          <div class="ru">${esc(App.meaning(w))}</div>
          ${App.exampleHtml(w)}`;

        if (!typing()) {
          // flashcard: see the English word, recall the meaning
          root.innerHTML = `${head}
            <div class="flashcard" id="fc">
              <div class="big">${esc(w.en)}</div>
              <div class="speak-row">${App.speakBtn(w.en)}</div>
              ${revealed ? `<hr><div class="big ru">${esc(App.meaning(w))}</div>${App.exampleHtml(w)}`
                : `<div class="muted small hint">вспомни перевод и нажми (пробел)</div>`}
            </div>
            <div class="answer-row" ${revealed ? "" : "hidden"}>
              <button class="btn bad" id="no">😕 Не вспомнил <kbd>←</kbd></button>
              <button class="btn good" id="yes">😎 Вспомнил <kbd>→</kbd></button>
            </div>`;
          root.querySelector("#fc").onclick = (e) => { if (!e.target.closest("button")) reveal(); };
          root.querySelector("#no").onclick = () => grade(false);
          root.querySelector("#yes").onclick = () => grade(true);
          if (!revealed) App.speak(w.en);
          return;
        }

        // typing: see the meaning, type the English word
        root.innerHTML = `${head}
          <div class="card center"><div class="big ru">${esc(App.meaning(w))}</div>
            ${typed === null ? `<p class="muted small">напиши по-английски</p>` : details}</div>
          ${typed === null ? `<form id="f" autocomplete="off">
              <input id="answer" class="answer" autocapitalize="off" spellcheck="false" placeholder="English">
              <div class="answer-row"><button type="button" class="btn" id="dunno">Не помню</button><button class="btn primary">Проверить</button></div>
            </form>` : `
            <div class="feedback ${App.isCorrect(typed, w.en) ? "good" : "bad"}">
              ${App.isCorrect(typed, w.en) ? "Верно! 🎉" : typed ? `Ты написал: <s>${esc(typed)}</s>` : "Ничего, повторим ещё раз"}
            </div>
            ${App.isCorrect(typed, w.en) ? "" : `<p class="muted small center">Опечатка? <button class="link" id="override">Засчитать как верный</button></p>`}
            <button class="btn primary wide" id="next">Дальше <kbd>Enter</kbd></button>`}`;
        if (typed === null) {
          const input = root.querySelector("#answer");
          input.focus();
          root.querySelector("#f").onsubmit = (e) => { e.preventDefault(); typed = input.value.trim(); draw(); App.speak(w.en); };
          root.querySelector("#dunno").onclick = () => { typed = ""; draw(); App.speak(w.en); };
        } else {
          const ok = App.isCorrect(typed, w.en);
          root.querySelector("#next").onclick = () => grade(ok);
          root.querySelector("#next").focus();
          const o = root.querySelector("#override");
          if (o) o.onclick = () => grade(true);
        }
      }

      function reveal() {
        if (revealed) return;
        revealed = true;
        draw();
      }

      const onKey = (e) => {
        if (!w || e.target.matches("input, select, textarea, button")) return;
        if (typing()) return;
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); revealed ? grade(true) : reveal(); }
        else if (revealed && e.key === "ArrowLeft") grade(false);
        else if (revealed && e.key === "ArrowRight") grade(true);
      };
      document.addEventListener("keydown", onKey);
      next();
      return () => document.removeEventListener("keydown", onKey);
    },
  };
})(window.App);
