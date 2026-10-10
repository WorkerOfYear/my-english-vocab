// Grammar: one rule a week in the order of the course book (js/grammar-rules-*.js).
// Read the explanation, then practise with checked exercises; learned rules come back in mixed reviews.
// A new rule opens every Monday once the current one has been practised (or earlier on request).
// If the learner has loaded their course book (js/book.js), each rule also shows the Grammar Bank page and the
// Grammar Bank + Workbook exercises, checked the same way.
(function (App) {
  const { esc } = App;
  const ROUND = 10;
  const REVIEW_AFTER = 14; // days: a learned rule not practised for this long is due for review

  const rules = () => window.GRAMMAR || [];
  const byId = (id) => rules().find((r) => r.id === id);
  // rules: id -> {learned, best, bookBest, last, reviews, wrong: {taskKey: n}}
  const defaults = () => ({ cur: 0, weekOf: "", rules: {} });
  const load = () => Object.assign(defaults(), App.store.get("grammar", {}));
  // The current rule's id/unit/title go along so the server can name it in the Telegram reminder.
  const save = (g) => {
    const r = rules()[g.cur];
    if (r) Object.assign(g, { curId: r.id, curUnit: r.unit, curTitle: r.title });
    App.store.set("grammar", g);
  };

  const mondayOf = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const wd = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = Monday
    return App.addDays(iso, -wd);
  };

  // New week + current rule practised → next rule (one step per week, even after a long break).
  function advance(g) {
    const monday = mondayOf(App.today());
    if (!g.weekOf || g.curId !== (rules()[g.cur] || {}).id) { g.weekOf = g.weekOf || monday; save(g); return g; }
    const cur = rules()[g.cur];
    if (monday > g.weekOf && cur && g.rules[cur.id]?.learned && g.cur < rules().length - 1) {
      g.cur += 1;
      g.weekOf = monday;
      save(g);
    }
    return g;
  }

  const isDue = (g, r) => {
    const s = g.rules[r.id];
    return s && s.learned && App.daysBetween(s.last || s.learned, App.today()) >= REVIEW_AFTER;
  };

  // ---------- answer checking: case, apostrophes, punctuation, spaces and contractions don't matter
  function forms(s) {
    let t = String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/[,;:"“”—–]|\.(?=\s)|\s-\s/g, " ").replace(/\s+/g, " ").trim()
      .replace(/[.!?]+$/, "").trim();
    t = t.replace(/\bcan't\b/g, "cannot").replace(/\bcan not\b/g, "cannot").replace(/\bwon't\b/g, "will not")
      .replace(/\bshan't\b/g, "shall not").replace(/n't\b/g, " not").replace(/'re\b/g, " are").replace(/'ve\b/g, " have")
      .replace(/'ll\b/g, " will").replace(/\bi'm\b/g, "i am").replace(/\s+/g, " ").trim();
    return t.includes("'d") ? [t.replace(/'d\b/g, " would").trim(), t.replace(/'d\b/g, " had").trim()] : [t];
  }
  const isRight = (input, answers) => {
    const got = new Set(forms(input));
    return answers.some((a) => forms(a).some((f) => got.has(f)));
  };

  // ---------- tasks: the app's own exercises and the book's, in one shape
  // { key, r, kind: choice|gap|open|fix, q, opts, right: [i], answers: [s], both, hint, why, header, lead }
  function appTask(r, i) {
    const e = r.ex[i];
    return e.opts
      ? { key: String(i), r, kind: "choice", q: e.q, opts: e.opts, right: [e.a], why: e.why }
      : { key: String(i), r, kind: "gap", q: e.q, answers: e.a, hint: e.hint, why: e.why };
  }
  const SRC = { gb: "Grammar Bank", wb: "Workbook" };
  function bookTasks(r) {
    const unit = App.book && App.book.unit(r.unit);
    if (!unit) return [];
    const out = [];
    for (const src of ["gb", "wb"]) {
      const part = unit[src];
      if (!part) continue;
      part.ex.forEach((ex, xi) => ex.items.forEach((it, ii) => {
        const t = {
          key: `${src}:${xi}:${ii}`, r, q: it.q, why: it.why, hint: it.hint, lead: it.lead,
          header: `${SRC[src]} p. ${part.page} · ${ex.key ? ex.key + ") " : ""}${ex.task}`,
        };
        if (it.opts) Object.assign(t, { kind: "choice", opts: it.opts, right: it.a, both: !!ex.both });
        else if (it.fix) Object.assign(t, { kind: "fix", answers: it.a, rewrite: !!ex.rewrite });
        else Object.assign(t, { kind: it.open ? "open" : "gap", answers: it.a });
        out.push(t);
      }));
    }
    return out;
  }
  const allTasks = (r) => r.ex.map((e, i) => appTask(r, i)).concat(bookTasks(r));

  // Mixed review: rules that are due first, then exercises answered wrong before, then the rest.
  function reviewSet(g) {
    const items = [];
    for (const r of rules().filter((x) => g.rules[x.id]?.learned)) {
      const s = g.rules[r.id];
      for (const t of allTasks(r)) items.push({ t, w: (s.wrong?.[t.key] || 0) * 3 + (isDue(g, r) ? 2 : 0) + Math.random() * 2 });
    }
    return items.sort((a, b) => b.w - a.w).slice(0, ROUND).map((x) => x.t);
  }

  App.grammarSummary = () => {
    if (!rules().length) return "";
    const g = advance(load());
    const r = rules()[g.cur];
    return `Правило недели: <b>${esc(r.unit)}</b> ${esc(r.title)}`;
  };

  App.pages.grammar = {
    // Screens: #grammar (list), #grammar?rule=ID[&tab=book], #grammar?practice=ID&mode=app|book, #grammar?review=1,
    // #grammar?settings=1 (course book + reminder).
    title(p) {
      const r = byId(p.get("rule") || p.get("practice"));
      if (r) return `Грамматика · ${r.unit}`;
      if (p.get("settings")) return "Грамматика · настройки";
      return p.get("review") ? "Грамматика · повторение" : "Грамматика";
    },
    // ← goes one level up: exercises → their rule → list of rules → home.
    parent(p) {
      if (p.get("practice") && byId(p.get("practice"))) return `grammar?rule=${p.get("practice")}${p.get("mode") === "book" ? "&tab=book" : ""}`;
      if (p.get("rule") || p.get("review") || p.get("settings")) return "grammar";
      return "";
    },
    noFilter: true,
    render(root, params = new URLSearchParams()) {
      let g = advance(load());
      let view = { name: "home" }; // home | rule {id, tab} | practice {mode, items, k, score, wrong, answered, from}
      const go = (hash) => { location.hash = hash; }; // the router re-renders the page for the new screen
      const remind = App.Reminder("grammar", { label: "Напоминать о правиле недели", note: "Если правило недели уже разобрано на этой неделе, бот не напомнит." });
      let onKey = null;
      let bookMsg = "";

      function draw() {
        if (onKey) { document.removeEventListener("keydown", onKey); onKey = null; }
        if (view.name === "rule") return drawRule();
        if (view.name === "practice") return drawPractice();
        if (view.name === "settings") return drawSettings();
        drawHome();
      }

      function status(r) {
        const s = g.rules[r.id];
        if (!s || !s.learned) return "";
        return isDue(g, r) ? '<span class="badge">пора повторить</span>' : '<span class="badge added">✓ пройдено</span>';
      }

      function bookCard() {
        const b = App.book;
        return `<div class="card">
          <h3>📕 Учебник</h3>
          <p class="muted small">${b.loaded
            ? `Загружены материалы учебника: ${b.count} юнитов. У каждого правила есть страница Grammar Bank и упражнения из Grammar Bank и Workbook.`
            : "Можно добавить Grammar Bank и упражнения Workbook из своего учебника: загрузи файл <code>book.json</code>. Он хранится только у тебя — в браузере и в твоём хранилище на сервере, на сайт и в git не попадает."}</p>
          <label class="btn small">📂 ${b.loaded ? "Обновить файл" : "Загрузить book.json"}<input type="file" id="book-file" accept=".json,application/json" hidden></label>
          ${bookMsg ? `<p class="small">${esc(bookMsg)}</p>` : ""}
        </div>`;
      }

      function drawHome() {
        const all = rules();
        const cur = all[g.cur];
        const curState = g.rules[cur.id];
        const learned = all.filter((r) => g.rules[r.id]?.learned);
        const due = learned.filter((r) => isDue(g, r));
        const last = g.cur === all.length - 1;
        const bookN = bookTasks(cur).length;
        root.innerHTML = `
          <div class="toolbar">
            <span class="muted small">Пройдено правил: ${learned.length} из ${all.length}${App.book.loaded ? " · 📕 учебник загружен" : ""}</span>
            <button class="icon-btn" id="g-settings" title="Учебник и напоминание" aria-label="Настройки">⚙️</button>
          </div>
          <div class="card accent">
            <div class="muted small">Правило недели · Unit ${esc(cur.unit)}</div>
            <div class="big">${esc(cur.title)}</div>
            <p>${esc(cur.ru)}</p>
            <div class="row">
              <button class="btn primary" data-rule="${cur.id}">📖 Правило</button>
              <button class="btn" data-practice="${cur.id}">✍️ Упражнения</button>
              ${bookN ? `<button class="btn" data-book="${cur.id}">📕 Из учебника (${bookN})</button>` : ""}
            </div>
            ${curState?.learned ? `<p class="small">✅ Пройдено.${curState.best != null ? ` Упражнения приложения: ${curState.best}/${cur.ex.length}.` : ""}${curState.bookBest != null ? ` Учебник: ${curState.bookBest}/${bookN}.` : ""}
              ${last ? "Это последнее правило курса — дальше только повторение." : `Следующее правило откроется в понедельник. <button class="link" id="next-now">Взять сейчас</button>`}</p>`
              : '<p class="muted small">Прочитай правило и сделай упражнения — после этого в понедельник откроется следующее.</p>'}
          </div>
          <div class="card">
            <h3>🔁 Повторение</h3>
            <p class="muted small">${learned.length ? `Пройдено правил: ${learned.length}. ${due.length ? `Пора повторить: ${due.length}.` : "Все повторены недавно."} В тренировку попадают ${ROUND} упражнений: сначала из правил, которые давно не повторял, и те, где были ошибки.` : "Здесь будут смешанные упражнения по пройденным правилам."}</p>
            <button class="btn" id="review" ${learned.length ? "" : "disabled"}>🔁 Смешанная тренировка</button>
          </div>
          <h3 class="section">Все правила</h3>
          <div>
            ${all.map((r, i) => `<button class="option grammar-item${i === g.cur ? " current" : ""}" data-rule="${r.id}">
              <span class="unit">${esc(r.unit)}</span>
              <span class="gi-text"><b>${esc(r.title)}</b><span class="muted small">${esc(r.ru)}</span></span>
              ${status(r)}</button>`).join("")}
          </div>`;
        bindCommon();
        root.querySelector("#review").onclick = () => go("grammar?review=1");
        root.querySelector("#g-settings").onclick = () => go("grammar?settings=1");
        const next = root.querySelector("#next-now");
        if (next) next.onclick = () => { g.cur += 1; g.weekOf = mondayOf(App.today()); save(g); draw(); };
      }

      function drawSettings() {
        root.innerHTML = `
          <div class="card"><h3>🔔 Напоминание в Telegram</h3>${remind.html()}</div>
          ${bookCard()}`;
        remind.bind(root, () => { if (view.name === "settings") draw(); });
        root.querySelector("#book-file").onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          bookMsg = "⏳ Загружаю…";
          draw();
          try {
            const n = await App.book.upload(file);
            bookMsg = `✅ Загружено юнитов: ${n}.${App.sync && App.sync.connected ? " Файл сохранён и на сервере — на других устройствах он появится сам." : ""}`;
          } catch (err) {
            bookMsg = "⚠️ " + err.message;
          }
          draw();
        };
      }

      function bindCommon() {
        root.querySelectorAll("[data-rule]").forEach((b) => b.onclick = () => go(`grammar?rule=${b.dataset.rule}`));
        root.querySelectorAll("[data-practice]").forEach((b) => b.onclick = () => go(`grammar?practice=${b.dataset.practice}&mode=app`));
        root.querySelectorAll("[data-book]").forEach((b) => b.onclick = () => go(`grammar?practice=${b.dataset.book}&mode=book`));
      }

      function drawRule() {
        const r = byId(view.id);
        const unit = App.book && App.book.unit(r.unit);
        const gb = unit && unit.gb;
        const bookN = bookTasks(r).length;
        const tab = gb ? view.tab : "app";
        root.innerHTML = `
          ${gb ? `<div class="seg grammar-tabs" role="tablist">
            <button data-tab="app" class="${tab === "app" ? "on" : ""}">Объяснение</button>
            <button data-tab="book" class="${tab === "book" ? "on" : ""}">📕 Grammar Bank p. ${esc(gb.page)}</button>
          </div>` : ""}
          <div class="card grammar-rule">
            <div class="muted small">Unit ${esc(r.unit)}</div>
            <h2>${esc(r.title)}</h2>
            ${tab === "book" ? `<div class="book-text">${gb.html}</div>` : `<p class="muted">${esc(r.ru)}</p>${r.explain}`}
          </div>
          <button class="btn primary wide" data-practice="${r.id}">✍️ Упражнения приложения (${r.ex.length})</button>
          ${bookN ? `<button class="btn wide" data-book="${r.id}">📕 Упражнения из учебника (${bookN})</button>` : ""}`;
        root.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => {
          view.tab = b.dataset.tab;
          history.replaceState(null, "", `#grammar?rule=${r.id}${view.tab === "book" ? "&tab=book" : ""}`);
          draw();
        });
        bindCommon();
      }

      // mode: app (the rule's own exercises, shuffled) | book (Grammar Bank + Workbook, in book order) | review
      function start(mode, id) {
        const r = id && byId(id);
        const items = mode === "review" ? reviewSet(g)
          : mode === "book" ? bookTasks(r)
          : App.shuffle(r.ex.map((e, i) => appTask(r, i)));
        view = { name: "practice", mode, items, k: 0, score: 0, wrong: [], answered: null, from: id || null };
        draw();
      }

      function record(t, ok) {
        const s = g.rules[t.r.id] || (g.rules[t.r.id] = { wrong: {} });
        s.wrong = s.wrong || {};
        if (ok) { if (s.wrong[t.key]) { s.wrong[t.key] -= 1; if (!s.wrong[t.key]) delete s.wrong[t.key]; } } else s.wrong[t.key] = (s.wrong[t.key] || 0) + 1;
      }

      function finishPractice() {
        const v = view, today = App.today();
        for (const id of new Set(v.items.map((t) => t.r.id))) {
          const s = g.rules[id] || (g.rules[id] = { wrong: {} });
          s.last = today;
          s.reviews = (s.reviews || 0) + 1;
          if (v.from === id) {
            s.learned = s.learned || today;
            if (v.mode === "book") s.bookBest = Math.max(s.bookBest || 0, v.score);
            else s.best = Math.max(s.best || 0, v.score);
          }
        }
        save(g);
      }

      const rightText = (t) => (t.kind === "choice" ? t.right.map((k) => t.opts[k]).join(" / ") : t.answers.filter((a) => a !== "✓").join(" / ") || "✓ всё верно");

      // The sentence: "___" becomes a gap (or the answer once answered); [[phrase]] is the part to check in "fix" tasks.
      function sentence(t, a) {
        let html = esc(t.q).replace(/\[\[(.+?)\]\]/g, '<span class="fix-phrase">$1</span>');
        if (html.includes("___")) {
          const fill = a ? `<mark class="${a.ok ? "" : "fix"}">${esc(t.kind === "choice" ? rightText(t) : t.answers[0])}</mark>` : '<span class="cloze-gap">______</span>';
          // The first gap is this task's; any others (other items of the same text) stay plain blanks.
          html = html.replace("___", "\u0000").replace(/___/g, '<span class="cloze-gap">___</span>').replace("\u0000", fill);
        }
        return html;
      }

      function drawPractice() {
        const v = view;
        if (v.k >= v.items.length) return drawResult();
        const t = v.items[v.k];
        const a = v.answered; // null | { ok, input, pick, self }
        const prevHeader = v.k > 0 && v.items[v.k - 1].header;
        const choiceBtns = t.kind === "choice" ? `<div class="options">${t.opts.map((o, k) => {
            const cls = a ? (t.right.includes(k) ? " right" : k === a.pick ? " wrong" : "") : "";
            return `<button class="option${cls}" data-k="${k}" ${a ? "disabled" : ""}><kbd>${k + 1}</kbd> ${esc(o)}</button>`;
          }).join("")}${t.both ? `<button class="option${a ? (t.right.length > 1 ? " right" : a.pick === -1 ? " wrong" : "") : ""}" data-k="-1" ${a ? "disabled" : ""}><kbd>${t.opts.length + 1}</kbd> Оба варианта верны</button>` : ""}</div>` : "";
        const input = (placeholder) => `
          <form id="gap-form" class="row">
            ${t.lead ? `<div class="lead">${esc(t.lead)}</div>` : ""}
            <input class="answer${a ? (a.ok ? " good" : " bad") : ""}" id="gap" autocomplete="off" autocapitalize="off" spellcheck="false"
              placeholder="${placeholder}" value="${a ? esc(a.input || "") : ""}" ${a ? "disabled" : ""}>
            ${a ? "" : '<button class="btn primary wide">Проверить</button>'}
          </form>`;
        let body = choiceBtns;
        if (t.kind === "gap") body = input("Впиши ответ");
        if (t.kind === "open") body = input("Напиши свой вариант");
        // "fix": check the highlighted part — it's right (✓) or type the corrected version; "rewrite" exercises have no ✓.
        if (t.kind === "fix") body = a || t.rewrite ? input(t.rewrite ? "Новый вариант" : "") : `<div class="row"><button class="btn good" id="fix-ok">✓ Верно</button><span class="muted small">или впиши исправление:</span></div>${input("Исправленный вариант")}`;
        // Open answers can be phrased differently: if it doesn't match, the learner compares with the model answer.
        const selfCheck = a && a.pending;
        root.innerHTML = `
          <div class="toolbar">
            <span class="muted small">${v.k + 1} из ${v.items.length}</span>
            <span class="score">✅ ${v.score} / ${v.k + (a && !selfCheck ? 1 : 0)}</span>
          </div>
          <div class="progress"><div style="width:${(v.k / v.items.length) * 100}%"></div></div>
          <div class="card">
            ${t.header ? `<div class="task-head${t.header === prevHeader ? " muted" : ""}">${esc(t.header)}</div>` : ""}
            <div class="muted small">${v.mode === "review" ? `Unit ${esc(t.r.unit)} · ${esc(t.r.title)}` : ""}${t.hint ? ` <i>${esc(t.hint)}</i>` : ""}</div>
            <p class="cloze-sentence">${sentence(t, a && !selfCheck ? a : null)}</p>
            ${body}
          </div>
          ${selfCheck ? `<div class="feedback note">Твой ответ не совпал с образцом дословно. Образец: <b>${esc(t.answers.join(" / "))}</b>
              <div class="row"><button class="btn good" id="self-ok">Мой ответ тоже верный</button><button class="btn bad" id="self-bad">Ошибся</button></div></div>`
            : a ? `<div class="feedback ${a.ok ? "good" : "bad"}">${a.ok ? "Верно!" : `Правильно: <b>${esc(rightText(t))}</b>`}
              ${t.why ? `<div class="small">${esc(t.why)}</div>` : ""}</div>
            <button class="btn primary wide" id="next">${v.k + 1 < v.items.length ? "Дальше" : "Результат"} <kbd>Enter</kbd></button>` : ""}`;

        const answer = (ok, extra) => {
          v.answered = { ok, ...extra };
          if (ok) v.score++; else v.wrong.push(t);
          record(t, ok);
          try { App.tg && App.tg.HapticFeedback.notificationOccurred(ok ? "success" : "error"); } catch (err) { /* old clients */ }
          draw();
        };
        const pick = (k) => answer(k === -1 ? t.right.length > 1 : t.right.length === 1 && t.right[0] === k, { pick: k });
        root.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => pick(+b.dataset.k));
        const fixOk = root.querySelector("#fix-ok");
        if (fixOk) fixOk.onclick = () => answer(t.answers.includes("✓"), { input: "✓" });
        const form = root.querySelector("#gap-form");
        if (form && !a) {
          const inp = root.querySelector("#gap");
          if (t.kind !== "fix") inp.focus();
          form.onsubmit = (ev) => {
            ev.preventDefault();
            const val = inp.value.trim();
            if (!val) return;
            const ok = isRight(val, t.answers.filter((x) => x !== "✓"));
            if (!ok && t.kind === "open") { v.answered = { pending: true, input: val }; return draw(); }
            answer(ok, { input: val });
          };
        }
        if (selfCheck) {
          root.querySelector("#self-ok").onclick = () => answer(true, { input: a.input });
          root.querySelector("#self-bad").onclick = () => answer(false, { input: a.input });
        }
        const next = root.querySelector("#next");
        if (next) next.onclick = () => { v.k++; v.answered = null; draw(); };
        onKey = (ev) => {
          if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
          if (a && !selfCheck && ev.key === "Enter" && next && document.activeElement !== next) { ev.preventDefault(); next.click(); }
          else if (!a && t.kind === "choice" && /^[1-9]$/.test(ev.key) && !ev.target.matches("input")) {
            const k = +ev.key - 1;
            if (k < t.opts.length) pick(k); else if (t.both && k === t.opts.length) pick(-1);
          }
        };
        // Enter → next, without autofocus: the Enter that sent the answer must not skip the feedback.
        document.addEventListener("keydown", onKey);
      }

      function drawResult() {
        const v = view;
        if (!v.saved) { finishPractice(); v.saved = true; }
        const total = v.items.length;
        const pct = v.score / total;
        root.innerHTML = `
          <div class="card center">
            <div class="big">${v.score} / ${total}</div>
            <p>${pct === 1 ? "Идеально! 🎉" : pct >= 0.7 ? "Хороший результат 👍" : "Стоит перечитать правило и попробовать ещё раз."}</p>
          </div>
          ${v.wrong.length ? `<h3>Ошибки</h3>${v.wrong.map((t) => `<div class="word-row"><div>
              ${t.header ? `<div class="muted small">${esc(t.header)}</div>` : ""}
              <div>${esc(t.q).replace(/\[\[(.+?)\]\]/g, "<u>$1</u>").replace("___", "<b>___</b>")}</div>
              <div>→ <mark>${esc(rightText(t))}</mark></div>
              ${t.why ? `<div class="muted small">${esc(t.why)}</div>` : ""}</div></div>`).join("")}` : ""}
          <div class="row">
            <button class="btn primary" id="again">🔁 Ещё раз</button>
            ${v.from ? '<button class="btn" id="to-rule">📖 К правилу</button>' : ""}
            <button class="btn" id="to-home">Все правила</button>
          </div>`;
        root.querySelector("#again").onclick = () => start(v.mode, v.from);
        if (v.from) root.querySelector("#to-rule").onclick = () => go(`grammar?rule=${v.from}${v.mode === "book" ? "&tab=book" : ""}`);
        root.querySelector("#to-home").onclick = () => go("grammar");
      }

      // Synced progress or the book arriving from the server: re-read when nothing is in progress.
      const onSync = () => { if (view.name !== "practice") { g = advance(load()); draw(); } };
      document.addEventListener("sync-status", onSync);
      document.addEventListener("book-loaded", onSync);
      // Which screen the hash asks for.
      const ruleId = params.get("rule"), practiceId = params.get("practice");
      if (ruleId && byId(ruleId)) view = { name: "rule", id: ruleId, tab: params.get("tab") === "book" ? "book" : "app" };
      if (practiceId && byId(practiceId)) start(params.get("mode") === "book" && bookTasks(byId(practiceId)).length ? "book" : "app", practiceId);
      else if (params.get("review") && rules().some((r) => g.rules[r.id]?.learned)) start("review");
      else if (params.get("settings")) { view = { name: "settings" }; draw(); remind.load(() => { if (view.name === "settings") draw(); }); }
      else draw();
      return () => {
        if (onKey) document.removeEventListener("keydown", onKey);
        document.removeEventListener("sync-status", onSync);
        document.removeEventListener("book-loaded", onSync);
      };
    },
  };

  App.grammarCheck = isRight; // for tests
})(window.App);
