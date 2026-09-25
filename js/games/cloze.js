// Fill in the blank: an example sentence with the word cut out.
(function (App) {
  const { esc } = App;
  const ROUND = 10;

  App.pages.cloze = {
    title: "Вставь слово",
    render(root) {
      const pool = App.filtered().filter((w) => w.cloze && w.example.includes(w.cloze));
      if (pool.length < 4) return App.notEnough(root, 4);
      let words, i, score, answered, choice, hinted;

      function start() {
        words = App.sample(pool, ROUND);
        i = 0; score = 0;
        ask();
      }

      const parts = (w) => {
        const at = w.example.indexOf(w.cloze);
        return [w.example.slice(0, at), w.example.slice(at + w.cloze.length)];
      };
      const sentence = (w, middle) => { const [a, b] = parts(w); return `${esc(a)}${middle}${esc(b)}`; };
      const gap = (w) => `<span class="cloze-gap">${esc(w.cloze[0])}${"&nbsp;".repeat(Math.max(4, w.cloze.length))}</span>`;

      function options(w) {
        const seen = new Set([w.cloze.toLowerCase()]);
        const out = [w];
        for (const x of App.shuffle(pool)) {
          if (out.length === 4) break;
          if (seen.has(x.cloze.toLowerCase())) continue;
          seen.add(x.cloze.toLowerCase());
          out.push(x);
        }
        return App.shuffle(out);
      }

      function ask() {
        if (i >= words.length) return finish();
        answered = false;
        choice = null;
        hinted = false;
        draw();
      }

      function draw() {
        const w = words[i];
        root.innerHTML = `
          <div class="toolbar"><span class="muted">${i + 1} из ${words.length}</span><span class="score">✅ ${score}</span></div>
          <div class="progress"><div style="width:${(i / words.length) * 100}%"></div></div>
          <div class="card">
            <p class="cloze-sentence">${answered ? sentence(w, `<mark>${esc(w.cloze)}</mark>`) : sentence(w, gap(w))}</p>
            <p class="muted">${esc(App.meaning(w))}${w.exampleBy === "claude" ? ' <span class="small" title="пример от Claude">💡</span>' : ""}</p>
          </div>
          ${answered ? "" : choice ? `
            <div class="options">${choice.map((o, k) => `<button class="option" data-k="${k}"><kbd>${k + 1}</kbd> ${esc(o.cloze)}</button>`).join("")}</div>` : `
            <form id="f" autocomplete="off">
              <input id="answer" class="answer" placeholder="Впиши слово" autocapitalize="off" spellcheck="false">
              <div class="answer-row">
                <button type="button" class="btn" id="choices">🔢 4 варианта</button>
                <button type="button" class="btn" id="skip">Не знаю</button>
                <button class="btn primary">Проверить</button>
              </div>
            </form>`}
          <div id="after"></div>`;
        if (answered) return;
        if (choice) {
          root.querySelectorAll(".option").forEach((b) => b.onclick = () => check(choice[+b.dataset.k].cloze));
          return;
        }
        const input = root.querySelector("#answer");
        input.focus();
        root.querySelector("#f").onsubmit = (e) => { e.preventDefault(); check(input.value); };
        root.querySelector("#skip").onclick = () => check("");
        root.querySelector("#choices").onclick = () => { hinted = true; choice = options(w); draw(); };
      }

      function check(value) {
        if (answered) return;
        const w = words[i];
        const typed = App.normAnswer(value);
        const ok = !!typed && (typed === App.normAnswer(w.cloze) || App.isCorrect(value, w.en));
        answered = true;
        if (ok) score++;
        App.record(w, ok && !hinted);
        draw();
        root.querySelector("#after").innerHTML = `
          <div class="feedback ${ok ? "good" : "bad"}">
            ${ok ? "Верно! 🎉" : value.trim() ? `Ты написал: <s>${esc(value.trim())}</s>` : "Запомни:"}
            <div><b>${esc(w.en)}</b> ${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ""} — ${esc(App.meaning(w))}</div>
          </div>
          <div class="speak-row">
            <button class="btn" id="say">🔊 Прочитать предложение</button>
          </div>
          <button class="btn primary wide" id="next">Дальше <kbd>Enter</kbd></button>`;
        root.querySelector("#say").onclick = () => App.say(w.example);
        root.querySelector("#next").onclick = () => { i++; ask(); };
        root.querySelector("#next").focus();
        App.say(w.example);
      }

      function finish() {
        root.innerHTML = `<div class="card center">
          <div class="big">${score} / ${words.length}</div>
          <p>${score === words.length ? "Все слова на месте! 🧩" : "Ошибки попали в трудные слова 💪"}</p>
          <button class="btn primary" id="again">Ещё раунд</button></div>`;
        root.querySelector("#again").onclick = start;
      }

      const onKey = (e) => {
        if (e.target.matches("input, textarea, select")) return;
        if (!answered && choice && /^[1-4]$/.test(e.key)) check(choice[+e.key - 1].cloze);
      };
      document.addEventListener("keydown", onKey);
      start();
      return () => document.removeEventListener("keydown", onKey);
    },
  };
})(window.App);
