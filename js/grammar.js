// Grammar: one rule a week in the order of the course book (js/grammar-rules-*.js).
// Read the explanation, then practise with checked exercises; learned rules come back in mixed reviews.
// A new rule opens every Monday once the current one has been practised (or earlier on request).
(function (App) {
  const { esc } = App;
  const ROUND = 10;
  const REVIEW_AFTER = 14; // days: a learned rule not practised for this long is due for review

  const rules = () => window.GRAMMAR || [];
  const byId = (id) => rules().find((r) => r.id === id);
  const defaults = () => ({ cur: 0, weekOf: "", rules: {} }); // rules: id -> {learned, best, last, reviews, wrong: {i: n}}
  const load = () => Object.assign(defaults(), App.store.get("grammar", {}));
  const save = (g) => App.store.set("grammar", g);

  const mondayOf = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const wd = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = Monday
    return App.addDays(iso, -wd);
  };

  // New week + current rule practised → next rule (one step per week, even after a long break).
  function advance(g) {
    const monday = mondayOf(App.today());
    if (!g.weekOf) { g.weekOf = monday; save(g); return g; }
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

  // ---------- answer checking: case, apostrophes, spaces and contractions don't matter
  function forms(s) {
    let t = String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim().replace(/[.!?,]+$/, "").trim();
    t = t.replace(/\bcan't\b/g, "cannot").replace(/\bcan not\b/g, "cannot").replace(/\bwon't\b/g, "will not")
      .replace(/\bshan't\b/g, "shall not").replace(/n't\b/g, " not").replace(/'re\b/g, " are").replace(/'ve\b/g, " have")
      .replace(/'ll\b/g, " will").replace(/\bi'm\b/g, "i am");
    return t.includes("'d") ? [t.replace(/'d\b/g, " would"), t.replace(/'d\b/g, " had")] : [t];
  }
  const isRight = (input, answers) => {
    const got = new Set(forms(input));
    return answers.some((a) => forms(a).some((f) => got.has(f)));
  };

  // Mixed review: rules that are due first, then exercises answered wrong before, then the rest.
  function reviewSet(g) {
    const learned = rules().filter((r) => g.rules[r.id]?.learned);
    const items = [];
    for (const r of learned) {
      const s = g.rules[r.id];
      r.ex.forEach((e, i) => items.push({ r, i, w: (s.wrong?.[i] || 0) * 3 + (isDue(g, r) ? 2 : 0) + Math.random() * 2 }));
    }
    return items.sort((a, b) => b.w - a.w).slice(0, ROUND).map(({ r, i }) => ({ r, i }));
  }

  App.grammarSummary = () => {
    if (!rules().length) return "";
    const g = advance(load());
    const r = rules()[g.cur];
    return `Правило недели: <b>${esc(r.unit)}</b> ${esc(r.title)}`;
  };

  App.pages.grammar = {
    title: "Грамматика",
    noFilter: true,
    render(root) {
      let g = advance(load());
      let view = { name: "home" }; // home | rule {id} | practice {items, k, score, wrong, answered, from}
      let onKey = null;

      function draw() {
        if (onKey) { document.removeEventListener("keydown", onKey); onKey = null; }
        if (view.name === "rule") return drawRule();
        if (view.name === "practice") return drawPractice();
        drawHome();
      }

      function status(r) {
        const s = g.rules[r.id];
        if (!s || !s.learned) return "";
        return isDue(g, r) ? '<span class="badge">пора повторить</span>' : `<span class="badge added">✓ ${s.best}/${r.ex.length}</span>`;
      }

      function drawHome() {
        const all = rules();
        const cur = all[g.cur];
        const curState = g.rules[cur.id];
        const learned = all.filter((r) => g.rules[r.id]?.learned);
        const due = learned.filter((r) => isDue(g, r));
        const last = g.cur === all.length - 1;
        root.innerHTML = `
          <div class="card accent">
            <div class="muted small">Правило недели · Unit ${esc(cur.unit)}</div>
            <div class="big">${esc(cur.title)}</div>
            <p>${esc(cur.ru)}</p>
            <div class="row">
              <button class="btn primary" data-rule="${cur.id}">📖 Правило</button>
              <button class="btn" data-practice="${cur.id}">✍️ Упражнения</button>
            </div>
            ${curState?.learned ? `<p class="small">✅ Пройдено: лучший результат ${curState.best} из ${cur.ex.length}.
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
        root.querySelectorAll("[data-rule]").forEach((b) => b.onclick = () => { view = { name: "rule", id: b.dataset.rule }; draw(); window.scrollTo(0, 0); });
        root.querySelectorAll("[data-practice]").forEach((b) => b.onclick = () => startPractice(b.dataset.practice));
        root.querySelector("#review").onclick = () => startReview();
        const next = root.querySelector("#next-now");
        if (next) next.onclick = () => { g.cur += 1; g.weekOf = mondayOf(App.today()); save(g); draw(); };
      }

      function drawRule() {
        const r = byId(view.id);
        root.innerHTML = `
          <button class="link" id="to-home">← Все правила</button>
          <div class="card grammar-rule">
            <div class="muted small">Unit ${esc(r.unit)}</div>
            <h2>${esc(r.title)}</h2>
            <p class="muted">${esc(r.ru)}</p>
            ${r.explain}
          </div>
          <button class="btn primary wide" data-practice="${r.id}">✍️ Упражнения (${r.ex.length})</button>`;
        root.querySelector("#to-home").onclick = () => { view = { name: "home" }; draw(); };
        root.querySelector("[data-practice]").onclick = () => startPractice(r.id);
      }

      function startPractice(id) {
        const r = byId(id);
        const items = App.shuffle(r.ex.map((e, i) => ({ r, i })));
        view = { name: "practice", items, k: 0, score: 0, wrong: [], answered: null, from: id };
        draw();
        window.scrollTo(0, 0);
      }
      function startReview() {
        view = { name: "practice", items: reviewSet(g), k: 0, score: 0, wrong: [], answered: null, from: null };
        draw();
        window.scrollTo(0, 0);
      }

      function record(r, i, ok) {
        const s = g.rules[r.id] || (g.rules[r.id] = { wrong: {} });
        s.wrong = s.wrong || {};
        if (ok) { if (s.wrong[i]) { s.wrong[i] -= 1; if (!s.wrong[i]) delete s.wrong[i]; } } else s.wrong[i] = (s.wrong[i] || 0) + 1;
      }

      function finishPractice() {
        const v = view, today = App.today();
        const touched = new Set(v.items.map((x) => x.r.id));
        for (const id of touched) {
          const s = g.rules[id] || (g.rules[id] = { wrong: {} });
          s.last = today;
          s.reviews = (s.reviews || 0) + 1;
          if (v.from === id) {
            s.learned = s.learned || today;
            s.best = Math.max(s.best || 0, v.score);
          }
        }
        save(g);
        App.renderFilter();
      }

      function drawPractice() {
        const v = view;
        if (v.k >= v.items.length) return drawResult();
        const { r, i } = v.items[v.k];
        const e = r.ex[i];
        const a = v.answered; // null | { ok, input, pick }
        const parts = esc(e.q).split("___");
        const right = e.opts ? e.opts[e.a] : e.a[0];
        const filled = a ? `<mark class="${a.ok ? "" : "fix"}">${esc(right)}</mark>` : '<span class="cloze-gap">______</span>';
        root.innerHTML = `
          <div class="toolbar">
            <button class="link" id="quit">← Выйти</button>
            <span class="score">✅ ${v.score} / ${v.k + (a ? 1 : 0)}</span>
          </div>
          <div class="progress"><div style="width:${(v.k / v.items.length) * 100}%"></div></div>
          <div class="card">
            <div class="muted small">${v.from ? "" : `Unit ${esc(r.unit)} · `}${esc(r.title)}${!e.opts && e.hint ? ` · <i>${esc(e.hint)}</i>` : ""}</div>
            <p class="cloze-sentence">${parts[0]}${filled}${parts.slice(1).join("___")}</p>
            ${e.opts ? `<div class="options">${e.opts.map((o, k) => {
              const cls = a ? (k === e.a ? " right" : k === a.pick ? " wrong" : "") : "";
              return `<button class="option${cls}" data-k="${k}" ${a ? "disabled" : ""}><kbd>${k + 1}</kbd> ${esc(o)}</button>`;
            }).join("")}</div>` : `
              <form id="gap-form" class="row">
                <input class="answer${a ? (a.ok ? " good" : " bad") : ""}" id="gap" autocomplete="off" autocapitalize="off" spellcheck="false"
                  placeholder="Впиши ответ" value="${a ? esc(a.input) : ""}" ${a ? "disabled" : ""}>
                ${a ? "" : '<button class="btn primary wide">Проверить</button>'}
              </form>`}
          </div>
          ${a ? `<div class="feedback ${a.ok ? "good" : "bad"}">${a.ok ? "Верно!" : `Правильно: <b>${esc(e.opts ? right : e.a.join(" / "))}</b>`}
              <div class="small">${esc(e.why)}</div></div>
            <button class="btn primary wide" id="next">${v.k + 1 < v.items.length ? "Дальше" : "Результат"} <kbd>Enter</kbd></button>` : ""}`;

        root.querySelector("#quit").onclick = () => { view = v.from ? { name: "rule", id: v.from } : { name: "home" }; draw(); };
        const answer = (ok, extra) => {
          v.answered = { ok, ...extra };
          if (ok) v.score++; else v.wrong.push({ r, i });
          record(r, i, ok);
          try { App.tg && App.tg.HapticFeedback.notificationOccurred(ok ? "success" : "error"); } catch (err) { /* old clients */ }
          draw();
        };
        root.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => answer(+b.dataset.k === e.a, { pick: +b.dataset.k }));
        const form = root.querySelector("#gap-form");
        if (form && !a) {
          const input = root.querySelector("#gap");
          input.focus();
          form.onsubmit = (ev) => {
            ev.preventDefault();
            if (!input.value.trim()) return;
            answer(isRight(input.value, e.a), { input: input.value });
          };
        }
        const next = root.querySelector("#next");
        if (next) next.onclick = () => { v.k++; v.answered = null; draw(); };
        onKey = (ev) => {
          if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
          if (a && ev.key === "Enter" && next && document.activeElement !== next) { ev.preventDefault(); next.click(); }
          else if (!a && e.opts && /^[1-9]$/.test(ev.key) && +ev.key <= e.opts.length && !ev.target.matches("input")) answer(+ev.key - 1 === e.a, { pick: +ev.key - 1 });
        };
        document.addEventListener("keydown", onKey); // Enter → next (not autofocus: the Enter that sent the answer must not skip the feedback)
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
          ${v.wrong.length ? `<h3>Ошибки</h3>${v.wrong.map(({ r, i }) => {
            const e = r.ex[i];
            const right = e.opts ? e.opts[e.a] : e.a[0];
            return `<div class="word-row"><div><div>${esc(e.q).replace("___", `<mark>${esc(right)}</mark>`)}</div><div class="muted small">${esc(e.why)}</div></div></div>`;
          }).join("")}` : ""}
          <div class="row">
            <button class="btn primary" id="again">🔁 Ещё раз</button>
            ${v.from ? '<button class="btn" id="to-rule">📖 К правилу</button>' : ""}
            <button class="btn" id="to-home">Все правила</button>
          </div>`;
        root.querySelector("#again").onclick = () => (v.from ? startPractice(v.from) : startReview());
        if (v.from) root.querySelector("#to-rule").onclick = () => { view = { name: "rule", id: v.from }; draw(); };
        root.querySelector("#to-home").onclick = () => { view = { name: "home" }; draw(); };
      }

      // Synced progress from another device arrives in the store; re-read it when we're back on the home view.
      const onSync = () => { if (view.name === "home") { g = advance(load()); draw(); } };
      document.addEventListener("sync-status", onSync);
      draw();
      return () => {
        if (onKey) document.removeEventListener("keydown", onKey);
        document.removeEventListener("sync-status", onSync);
      };
    },
  };

  App.grammarCheck = isRight; // for tests
})(window.App);
