// Flashcards: flip, then mark "знаю / не знаю". Unknown cards come back at the end of the round.
(function (App) {
  const { esc } = App;

  App.pages.cards = {
    title: "Карточки",
    render(root) {
      const pool = App.filtered();
      if (pool.length < 1) return App.notEnough(root, 1);
      const opts = Object.assign({ dir: "en", size: 20 }, App.store.get("cardsOpts", {}));
      let queue, total, known, flipped, current, firstTry;

      function start() {
        queue = App.sample(pool, opts.size);
        total = queue.length;
        known = 0;
        firstTry = new Set(queue.map((w) => w.en));
        next();
      }

      function next() {
        current = queue.shift();
        flipped = false;
        draw();
        if (current && opts.dir === "en") App.speak(current.en);
      }

      function face(w, side) {
        if (side === "en") {
          return `<div class="big">${esc(w.en)}</div>
            ${w.ipa ? `<div class="ipa">${esc(w.ipa)}</div>` : ""}
            <div class="speak-row">${App.speakBtn(w.en)}${App.speakBtn(w.en, true)}</div>`;
        }
        return `<div class="big ru">${esc(App.meaning(w))}</div>
          ${w.ru && w.def ? `<div class="muted">${esc(w.def)}</div>` : ""}`;
      }

      function draw() {
        if (!current) {
          root.innerHTML = `<div class="card center">
            <div class="big">Готово! 🎉</div>
            <p>С первого раза: <b>${known}</b> из ${total}</p>
            <button class="btn primary" id="again">Ещё раунд</button></div>`;
          root.querySelector("#again").onclick = start;
          return;
        }
        const w = current;
        const front = opts.dir === "en" ? "en" : "ru";
        const back = front === "en" ? "ru" : "en";
        root.innerHTML = `
          <div class="toolbar">
            <div class="seg">
              <button class="${opts.dir === "en" ? "on" : ""}" data-dir="en">EN → RU</button>
              <button class="${opts.dir === "ru" ? "on" : ""}" data-dir="ru">RU → EN</button>
            </div>
            <select id="size" aria-label="Слов в раунде">${[10, 20, 50].map((n) => `<option value="${n}"${n === opts.size ? " selected" : ""}>${n} слов</option>`).join("")}</select>
          </div>
          <div class="progress"><div style="width:${((total - queue.length - 1) / total) * 100}%"></div></div>
          <p class="muted center small">осталось ${queue.length + 1}</p>
          <div class="flashcard ${flipped ? "flipped" : ""}" id="fc" tabindex="0">
            ${face(w, front)}
            ${flipped ? `<hr>${face(w, back)}${App.exampleHtml(w)}` : `<div class="muted small hint">нажми, чтобы перевернуть (пробел)</div>`}
          </div>
          <div class="answer-row" ${flipped ? "" : "hidden"}>
            <button class="btn bad" id="no">😕 Не знаю <kbd>←</kbd></button>
            <button class="btn good" id="yes">😎 Знаю <kbd>→</kbd></button>
          </div>`;
        root.querySelector("#fc").onclick = (e) => { if (!e.target.closest("button")) flip(); };
        root.querySelector("#no").onclick = () => grade(false);
        root.querySelector("#yes").onclick = () => grade(true);
        root.querySelectorAll("[data-dir]").forEach((b) => b.onclick = () => { opts.dir = b.dataset.dir; App.store.set("cardsOpts", opts); flipped = false; draw(); });
        root.querySelector("#size").onchange = (e) => { opts.size = +e.target.value; App.store.set("cardsOpts", opts); start(); };
      }

      function flip() {
        if (!current || flipped) return;
        flipped = true;
        draw();
        if (opts.dir === "ru") App.speak(current.en);
      }

      function grade(ok) {
        if (!current || !flipped) return;
        if (firstTry.has(current.en)) {
          firstTry.delete(current.en);
          App.record(current, ok);
          if (ok) known++;
        }
        if (!ok) queue.push(current);
        next();
      }

      const onKey = (e) => {
        if (e.target.matches("input, select, textarea")) return;
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); flipped ? grade(true) : flip(); }
        else if (e.key === "ArrowLeft") grade(false);
        else if (e.key === "ArrowRight") grade(true);
      };
      document.addEventListener("keydown", onKey);
      start();
      return () => document.removeEventListener("keydown", onKey);
    },
  };
})(window.App);
