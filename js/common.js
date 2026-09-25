// Shared helpers: storage, dates, word filter, answer checking, audio.
window.App = window.App || {};

(function (App) {
  // ---------- storage (localStorage can throw in private mode — never let it break the page)
  const PREFIX = "vocab.";
  const memory = {};
  App.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return key in memory ? memory[key] : fallback;
      }
    },
    set(key, value) {
      memory[key] = value;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* memory only */ }
    },
  };

  // ---------- small utils
  App.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  App.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  App.sample = (arr, n) => App.shuffle(arr).slice(0, n);
  App.meaning = (w) => w.ru || w.def;
  App.plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  App.words = (n) => `${n} ${App.plural(n, "слово", "слова", "слов")}`;

  // ---------- dates (local calendar days as YYYY-MM-DD strings)
  App.iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  App.today = () => App.iso(new Date());
  App.addDays = (isoDate, n) => {
    const [y, m, d] = isoDate.split("-").map(Number);
    return App.iso(new Date(y, m - 1, d + n));
  };
  App.daysBetween = (a, b) => {
    const pa = a.split("-").map(Number), pb = b.split("-").map(Number);
    return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 86400000);
  };
  const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  App.monthName = (ym) => { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };
  App.fmtDate = (isoDate) => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split("-").map(Number);
    return `${d} ${MONTHS_GEN[m - 1]}${y !== new Date().getFullYear() ? " " + y : ""}`;
  };

  // ---------- all words: generated from the chat (js/words.js) + ones added on the site (#add)
  // Dedup key — keep in sync with norm() in scripts/extract_words.py.
  App.norm = (en) => String(en || "").toLowerCase().replace(/’/g, "'")
    .replace(/\([^)]*\)/g, " ").trim().replace(/^(to|a|an|the)\s+/, "").replace(/\s+/g, " ").trim();
  App.custom = App.store.get("custom", []);
  App.loadWords = () => {
    const custom = new Map(App.custom.map((w) => [App.norm(w.en), w]));
    const base = (window.WORDS || []).filter((w) => App.meaning(w) && !custom.has(App.norm(w.en)));
    App.ALL = base.concat(App.custom).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    App.byEn = new Map(App.ALL.map((w) => [w.en, w]));
    App.byNorm = new Map(App.ALL.map((w) => [App.norm(w.en), w]));
  };
  App.saveCustom = (list) => {
    App.custom = list;
    App.store.set("custom", list);
    App.loadWords();
  };
  App.addWords = (words) => App.saveCustom(App.custom.filter((c) => !words.some((w) => App.norm(w.en) === App.norm(c.en))).concat(words));
  App.removeWord = (en) => {
    App.saveCustom(App.custom.filter((w) => w.en !== en));
    if (App.hard[en]) { delete App.hard[en]; App.store.set("hard", App.hard); }
  };
  App.loadWords();

  App.filter = Object.assign({ from: "", to: "", hardOnly: false }, App.store.get("filter", {}));
  App.setFilter = (patch) => {
    Object.assign(App.filter, patch);
    App.store.set("filter", App.filter);
  };
  App.hard = App.store.get("hard", {}); // en -> mistakes count
  App.filtered = () => App.ALL.filter((w) =>
    (!App.filter.from || w.date >= App.filter.from) &&
    (!App.filter.to || w.date <= App.filter.to) &&
    (!App.filter.hardOnly || App.hard[w.en] > 0));

  // Every game reports answers here: keeps the "hard words" list and feeds the tracker.
  App.record = (w, ok) => {
    if (ok) {
      if (App.hard[w.en]) {
        App.hard[w.en] -= 1;
        if (App.hard[w.en] <= 0) delete App.hard[w.en];
      }
    } else {
      App.hard[w.en] = (App.hard[w.en] || 0) + 2; // needs two right answers to leave the list
    }
    App.store.set("hard", App.hard);
    if (App.srs) App.srs.recordFromGame(w.en, ok);
  };

  // Example sentence: ✎ from the chat, 💡 written by Claude.
  App.exampleHtml = (w) => {
    if (!w.example) return "";
    const ai = w.exampleBy === "claude";
    return `<div class="example${ai ? " ai" : ""}"${ai ? ' title="пример от Claude"' : ' title="пример из переписки"'}>${App.esc(w.example)}</div>`;
  };

  // ---------- answer checking
  App.normAnswer = (s) => String(s || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*(to|a|an|the)\s+/, "")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Accept any variant of "a / b" or "a // b" entries.
  App.answerVariants = (en) => [en, ...en.split(/\/+|,/)].map(App.normAnswer).filter(Boolean);
  App.isCorrect = (input, en) => App.answerVariants(en).includes(App.normAnswer(input));

  // ---------- audio: pre-generated mp3 first, browser speech synthesis as fallback
  App.speakText = (en) => en.replace(/\([^)]*\)/g, "").replace(/\/+/g, ", ").replace(/\s+/g, " ").replace(/^[ ,]+|[ ,]+$/g, "");
  App.slug = (en) => App.speakText(en).toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  let voice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = speechSynthesis.getVoices().filter((v) => /^en[-_]US/i.test(v.lang));
    const score = (v) => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (/aria|jenny|guy|samantha/i.test(v.name) ? 1 : 0);
    voices.sort((a, b) => score(b) - score(a));
    return voices[0] || null;
  }
  if ("speechSynthesis" in window) {
    voice = pickVoice();
    speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
  }
  function synth(text, slow) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    if (voice) u.voice = voice;
    u.rate = slow ? 0.6 : 0.95;
    speechSynthesis.speak(u);
  }

  // Any sentence, straight to speech synthesis (no mp3 for those).
  App.say = (text) => { if (current) { current.pause(); current = null; } synth(text, false); };

  const withAudio = new Set(window.AUDIO || []); // slugs that have an mp3 (js/audio.js)
  const missing = new Set(); // mp3s that failed to load this session
  let current = null;
  App.speak = (en, opts = {}) => {
    const text = App.speakText(en);
    const s = App.slug(en);
    const src = `audio/${opts.slow ? "slow/" : ""}${s}.mp3`;
    if (current) { current.pause(); current = null; }
    if (!s || !withAudio.has(s) || missing.has(src)) return synth(text, opts.slow);
    const a = new Audio(src);
    current = a;
    const fallback = () => {
      missing.add(src);
      if (current === a) synth(text, opts.slow);
    };
    a.addEventListener("error", fallback, { once: true });
    a.play().catch((e) => { if (e && e.name !== "AbortError" && e.name !== "NotAllowedError") fallback(); });
  };

  App.speakBtn = (en, slow) =>
    `<button class="icon-btn" data-speak="${App.esc(en)}"${slow ? ' data-slow="1"' : ""} title="${slow ? "Медленно" : "Произнести"}" aria-label="${slow ? "Медленно" : "Произнести"}">${slow ? "🐢" : "🔊"}</button>`;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-speak]");
    if (b) { e.preventDefault(); e.stopPropagation(); App.speak(b.dataset.speak, { slow: !!b.dataset.slow }); }
  });
})(window.App);
