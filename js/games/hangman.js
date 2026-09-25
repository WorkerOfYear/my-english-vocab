// Hangman: guess the English word letter by letter, the translation is the hint.
(function (App) {
  const { esc } = App;
  const MAX_MISSES = 6;
  const LETTERS = "qwertyuiopasdfghjklzxcvbnm".split("");
  const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

  // Only plain words/short phrases: latin letters, spaces, hyphens, apostrophes.
  const playable = (w) => {
    const t = App.speakText(w.en);
    return /^[A-Za-z][A-Za-z '’-]*$/.test(t) && t.replace(/[^A-Za-z]/g, "").length >= 3 && t.split(" ").length <= 3 && t.length <= 22;
  };

  function drawing(misses) {
    const parts = [
      '<line x1="60" y1="20" x2="60" y2="38"/>',
      '<circle cx="60" cy="48" r="10"/>',
      '<line x1="60" y1="58" x2="60" y2="90"/>',
      '<line x1="60" y1="66" x2="44" y2="80"/><line x1="60" y1="66" x2="76" y2="80"/>',
      '<line x1="60" y1="90" x2="46" y2="112"/>',
      '<line x1="60" y1="90" x2="74" y2="112"/>',
    ];
    return `<svg class="gallows" viewBox="0 0 120 130" aria-label="Ошибок: ${misses} из ${MAX_MISSES}">
      <path class="frame" d="M10 125 H70 M25 125 V8 H60 V20"/>
      <g class="man">${parts.slice(0, misses).join("")}</g></svg>`;
  }

  App.pages.hangman = {
    title: "Виселица",
    render(root) {
      const pool = App.filtered().filter(playable);
      if (pool.length < 1) return App.notEnough(root, 1);
      let w, word, guessed, misses, over, streak = 0, bag = [];

      function start() {
        if (!bag.length) bag = App.shuffle(pool);
        w = bag.pop();
        word = App.speakText(w.en).toLowerCase().replace(/’/g, "'").replace(/^(a|an|the) /, "");
        guessed = new Set();
        misses = 0;
        over = false;
        draw();
      }

      const solved = () => [...word].every((c) => !/[a-z]/.test(c) || guessed.has(c));

      function guess(c) {
        if (over || guessed.has(c)) return;
        guessed.add(c);
        if (!word.includes(c)) misses++;
        if (solved() || misses >= MAX_MISSES) {
          over = true;
          const ok = misses < MAX_MISSES;
          streak = ok ? streak + 1 : 0;
          App.record(w, ok);
          App.speak(w.en);
        }
        draw();
      }

      function draw() {
        const won = over && misses < MAX_MISSES;
        const shown = [...word].map((c) => {
          if (c === " ") return '<span class="gap"></span>';
          if (!/[a-z]/.test(c)) return `<span class="letter fixed">${esc(c)}</span>`;
          const open = guessed.has(c) || over;
          return `<span class="letter${open && !guessed.has(c) ? " missed" : ""}">${open ? c : ""}</span>`;
        }).join("");
        root.innerHTML = `
          <div class="toolbar"><span class="muted">Подсказка:</span><span class="score">🔥 серия ${streak}</span></div>
          <div class="card center">
            <div class="big ru">${esc(App.meaning(w))}</div>
            <div class="hangman">
              ${drawing(misses)}
              <div class="word">${shown}</div>
            </div>
            <p class="muted small">ошибок ${misses} из ${MAX_MISSES}</p>
          </div>
          ${over ? `
            <div class="feedback ${won ? "good" : "bad"}">${won ? "Угадал! 🎉" : "Не угадал 😔"} <b>${esc(w.en)}</b> ${App.speakBtn(w.en)}
              ${App.exampleHtml(w)}</div>
            <button class="btn primary wide" id="next">Следующее слово <kbd>Enter</kbd></button>` : `
            <div class="keyboard">${ROWS.map((r) => `<div>${[...r].map((c) => `<button class="key${guessed.has(c) ? (word.includes(c) ? " hit" : " miss") : ""}" data-c="${c}" ${guessed.has(c) ? "disabled" : ""}>${c}</button>`).join("")}</div>`).join("")}</div>`}`;
        root.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => guess(b.dataset.c));
        const next = root.querySelector("#next");
        if (next) { next.onclick = start; next.focus(); }
      }

      const onKey = (e) => {
        if (e.target.matches("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase();
        if (!over && LETTERS.includes(k)) guess(k);
        else if (over && e.key === "Enter" && document.activeElement?.id !== "next") start();
      };
      document.addEventListener("keydown", onKey);
      start();
      return () => document.removeEventListener("keydown", onKey);
    },
  };
})(window.App);
