// Listening: hear the word, type it. Shows a letter-by-letter diff on mistakes.
(function (App) {
  const { esc } = App;
  const ROUND = 10;

  const playable = (w) => /^[A-Za-z][A-Za-z '’,-]*$/.test(App.speakText(w.en)) && App.speakText(w.en).split(" ").length <= 4;

  // Classic LCS diff: which letters of the answer were typed right.
  function diff(typed, answer) {
    const a = typed, b = answer;
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0, out = "";
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) { out += `<span class="ok">${esc(b[j])}</span>`; i++; j++; }
      else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) { out += `<span class="add">${esc(b[j])}</span>`; j++; }
      else { out += `<span class="del">${esc(a[i])}</span>`; i++; }
    }
    return out;
  }

  App.pages.listen = {
    title: "Аудирование",
    render(root) {
      const pool = App.filtered().filter(playable);
      if (pool.length < 1) return App.notEnough(root, 1);
      let words, i, score, answered, hinted;

      function start() {
        words = App.sample(pool, ROUND);
        i = 0; score = 0;
        ask();
      }

      function ask() {
        if (i >= words.length) return finish();
        const w = words[i];
        answered = false;
        hinted = false;
        root.innerHTML = `
          <div class="toolbar"><span class="muted">${i + 1} из ${words.length}</span><span class="score">✅ ${score}</span></div>
          <div class="progress"><div style="width:${(i / words.length) * 100}%"></div></div>
          <div class="card center">
            <div class="speak-row large">${App.speakBtn(w.en)}${App.speakBtn(w.en, true)}</div>
            <p class="muted small">🔊 ещё раз — <kbd>Ctrl</kbd>+<kbd>Space</kbd></p>
            <div id="hint" class="ru"></div>
          </div>
          <form id="f" autocomplete="off">
            <input id="answer" class="answer" placeholder="Напиши, что услышал" autocapitalize="off" spellcheck="false">
            <div class="answer-row">
              <button type="button" class="btn" id="hint-btn">💡 Перевод</button>
              <button type="button" class="btn" id="skip">Не знаю</button>
              <button class="btn primary">Проверить</button>
            </div>
          </form>
          <div id="after"></div>`;
        const input = root.querySelector("#answer");
        input.focus();
        root.querySelector("#f").onsubmit = (e) => { e.preventDefault(); if (!answered) check(input.value); else next(); };
        root.querySelector("#skip").onclick = () => check("");
        root.querySelector("#hint-btn").onclick = () => {
          hinted = true;
          root.querySelector("#hint").textContent = App.meaning(w);
          input.focus();
        };
        setTimeout(() => App.speak(w.en), 250);
      }

      function check(value) {
        if (answered) return;
        answered = true;
        const w = words[i];
        const ok = App.isCorrect(value, w.en);
        if (ok) score++;
        App.record(w, ok && !hinted);
        const input = root.querySelector("#answer");
        input.readOnly = true;
        input.classList.add(ok ? "good" : "bad");
        root.querySelector(".answer-row").hidden = true;
        const target = App.speakText(w.en).toLowerCase().replace(/’/g, "'");
        root.querySelector("#after").innerHTML = `
          <div class="feedback ${ok ? "good" : "bad"}">
            ${ok ? "Верно! 🎉" : value.trim() ? `<div class="diff">${diff(value.trim().toLowerCase().replace(/’/g, "'"), target)}</div>` : ""}
            <div><b>${esc(w.en)}</b> ${w.ipa ? `<span class="ipa">${esc(w.ipa)}</span>` : ""} — ${esc(App.meaning(w))}</div>
            ${App.exampleHtml(w)}
          </div>
          <button class="btn primary wide" id="next">Дальше <kbd>Enter</kbd></button>`;
        root.querySelector("#next").onclick = next;
        input.focus();
      }

      function next() { i++; ask(); }

      function finish() {
        root.innerHTML = `<div class="card center">
          <div class="big">${score} / ${words.length}</div>
          <p>${score === words.length ? "Отличный слух! 🎧" : "Трудные слова попали в список трудных — повтори их в карточках"}</p>
          <button class="btn primary" id="again">Ещё раунд</button></div>`;
        root.querySelector("#again").onclick = start;
      }

      const onKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.code === "Space" && words[i]) { e.preventDefault(); App.speak(words[i].en); }
      };
      document.addEventListener("keydown", onKey);
      start();
      return () => document.removeEventListener("keydown", onKey);
    },
  };
})(window.App);
