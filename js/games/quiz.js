// Quiz: pick the right translation out of 4.
(function (App) {
  const { esc } = App;

  // 3 wrong options that don't look like the right answer.
  function distractors(w, pool, dir) {
    const shown = (x) => (dir === "en" ? App.meaning(x) : x.en).toLowerCase();
    const right = shown(w);
    const seen = new Set([right]);
    const out = [];
    for (const x of App.shuffle(pool.length >= 8 ? pool : App.ALL)) {
      const s = shown(x);
      if (x.en === w.en || seen.has(s)) continue;
      seen.add(s);
      out.push(x);
      if (out.length === 3) break;
    }
    return out;
  }

  App.pages.quiz = {
    title: "Квиз",
    render(root) {
      const pool = App.filtered();
      if (pool.length < 4) return App.notEnough(root, 4);
      const opts = Object.assign({ dir: "en" }, App.store.get("quizOpts", {}));
      const ROUND = 10;
      let questions, i, score, mistakes, answered, options;

      function start() {
        questions = App.sample(pool, ROUND);
        i = 0; score = 0; mistakes = [];
        ask();
      }

      function ask() {
        if (i >= questions.length) return finish();
        const w = questions[i];
        answered = false;
        options = App.shuffle([w, ...distractors(w, pool, opts.dir)]);
        const prompt = opts.dir === "en"
          ? `<div class="big">${esc(w.en)}</div><div class="speak-row">${App.speakBtn(w.en)}</div>`
          : `<div class="big ru">${esc(App.meaning(w))}</div>`;
        root.innerHTML = `
          <div class="toolbar">
            <div class="seg">
              <button class="${opts.dir === "en" ? "on" : ""}" data-dir="en">EN → RU</button>
              <button class="${opts.dir === "ru" ? "on" : ""}" data-dir="ru">RU → EN</button>
            </div>
            <span class="score">✅ ${score} / ${i}</span>
          </div>
          <div class="progress"><div style="width:${(i / questions.length) * 100}%"></div></div>
          <div class="card center">${prompt}</div>
          <div class="options">
            ${options.map((o, k) => `<button class="option" data-k="${k}"><kbd>${k + 1}</kbd> ${esc(opts.dir === "en" ? App.meaning(o) : o.en)}</button>`).join("")}
          </div>
          <div id="after"></div>`;
        root.querySelectorAll(".option").forEach((b) => b.onclick = () => choose(+b.dataset.k));
        root.querySelectorAll("[data-dir]").forEach((b) => b.onclick = () => {
          opts.dir = b.dataset.dir; App.store.set("quizOpts", opts); start();
        });
        if (opts.dir === "en") App.speak(w.en);
      }

      function choose(k) {
        if (answered) return;
        answered = true;
        const w = questions[i];
        const ok = options[k].en === w.en;
        if (ok) score++; else mistakes.push(w);
        App.record(w, ok);
        root.querySelectorAll(".option").forEach((b, j) => {
          b.disabled = true;
          if (options[j].en === w.en) b.classList.add("right");
          else if (j === k) b.classList.add("wrong");
        });
        if (opts.dir === "ru") App.speak(w.en);
        root.querySelector("#after").innerHTML = `
          <div class="feedback ${ok ? "good" : "bad"}">
            ${ok ? "Верно!" : `Правильно: <b>${esc(w.en)}</b> — ${esc(App.meaning(w))}`}
            ${App.exampleHtml(w)}
          </div>
          <button class="btn primary wide" id="next">Дальше <kbd>Enter</kbd></button>`;
        root.querySelector("#next").onclick = () => { i++; ask(); };
        root.querySelector("#next").focus();
      }

      function finish() {
        root.innerHTML = `<div class="card center">
            <div class="big">${score} / ${questions.length}</div>
            <p>${score === questions.length ? "Идеально! 🏆" : score >= questions.length * 0.7 ? "Хорошо! 👍" : "Есть что повторить 💪"}</p>
            ${mistakes.length ? `<div class="mistakes"><p class="muted">Ошибки (добавлены в трудные слова):</p>
              ${mistakes.map((w) => `<div class="word-row">${App.speakBtn(w.en)}<div><b>${esc(w.en)}</b> — ${esc(App.meaning(w))}</div></div>`).join("")}</div>` : ""}
            <button class="btn primary" id="again">Ещё раунд</button></div>`;
        root.querySelector("#again").onclick = start;
      }

      const onKey = (e) => {
        if (e.target.matches("input, select, textarea")) return;
        if (!answered && /^[1-4]$/.test(e.key)) choose(+e.key - 1);
        else if (answered && e.key === "Enter" && document.activeElement?.id !== "next") { e.preventDefault(); i++; ask(); }
      };
      document.addEventListener("keydown", onKey);
      start();
      return () => document.removeEventListener("keydown", onKey);
    },
  };
})(window.App);
