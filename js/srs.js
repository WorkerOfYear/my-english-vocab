// Spaced-repetition tracker model.
//
// Words are learned in groups ("batches"). Each word walks through steps:
//   step 0 — new, learn today
//   step 1..5 — next review after 1, 3, 7, 14, 30 days
//   step 6 — learned (no more reviews)
// A correct review moves a word one step up, a mistake sends it back to step 1 (review tomorrow).
// A group is "consolidated" when all its words reached step 4 (passed the 7-day review) —
// then the next group can be taken.
(function (App) {
  const INTERVALS = [0, 1, 3, 7, 14, 30]; // days until the next review after reaching step i
  const LEARNED = INTERVALS.length;       // 6
  const CONSOLIDATED = 4;
  const MAX_ACTIVE = 2;

  const defaults = () => ({
    settings: { batchSize: 20, order: "old" },
    groups: [],   // {id, words:[en], createdAt, completedAt}
    cards: {},    // en -> {step, due, reviewed, history:[[date, 0|1]]}
  });
  let state = Object.assign(defaults(), App.store.get("srs", {}));
  const save = () => App.store.set("srs", state);

  const card = (en) => state.cards[en];
  const isLearned = (c) => c && c.step >= LEARNED;
  const groupWords = (g) => g.words.filter((en) => App.byEn.has(en));

  function refreshGroups() {
    const today = App.today();
    for (const g of state.groups) {
      if (!g.completedAt && groupWords(g).every((en) => isLearned(card(en)))) g.completedAt = today;
    }
  }

  const srs = {
    INTERVALS, LEARNED, CONSOLIDATED,
    get settings() { return state.settings; },
    setSettings(patch) { Object.assign(state.settings, patch); save(); },

    groupNumber(g) { return state.groups.indexOf(g) + 1; },
    activeGroups() { return state.groups.filter((g) => !g.completedAt); },
    completedGroups() { return state.groups.filter((g) => g.completedAt); },
    groupWords,
    card,

    groupStats(g) {
      const steps = new Array(LEARNED + 1).fill(0);
      const words = groupWords(g);
      words.forEach((en) => { steps[Math.min(card(en)?.step ?? 0, LEARNED)]++; });
      const consolidated = words.filter((en) => (card(en)?.step ?? 0) >= CONSOLIDATED).length;
      return { total: words.length, steps, consolidated, learned: steps[LEARNED] };
    },
    isConsolidated(g) { const s = this.groupStats(g); return s.total > 0 && s.consolidated === s.total; },

    // Words from the current filter that were never put into a group.
    candidates() {
      const used = new Set(state.groups.flatMap((g) => g.words));
      let list = App.filtered().filter((w) => !used.has(w.en));
      if (state.settings.order === "new") list = list.slice().reverse();
      if (state.settings.order === "random") list = App.shuffle(list);
      return list;
    },
    // Why a new group can't be taken yet ("" if it can).
    blockReason() {
      const active = this.activeGroups();
      if (!this.candidates().length) return "В выбранном периоде не осталось новых слов — поменяй фильтр дат.";
      if (active.length >= MAX_ACTIVE && !active.every((g) => this.isConsolidated(g)))
        return `Уже ${active.length} активные группы — сначала закрепи их.`;
      const last = active[active.length - 1];
      if (last && !this.isConsolidated(last)) {
        const s = this.groupStats(last);
        return `Следующая группа откроется, когда все слова текущей пройдут 7-дневное повторение (${s.consolidated}/${s.total}).`;
      }
      return "";
    },
    takeGroup() {
      const words = this.candidates().slice(0, state.settings.batchSize).map((w) => w.en);
      if (!words.length) return null;
      const today = App.today();
      const g = { id: Date.now(), words, createdAt: today, completedAt: null };
      state.groups.push(g);
      words.forEach((en) => {
        if (!state.cards[en]) state.cards[en] = { step: 0, due: today, reviewed: null, history: [] };
      });
      save();
      return g;
    },
    removeGroup(id) {
      const g = state.groups.find((x) => x.id === id);
      if (!g) return;
      state.groups = state.groups.filter((x) => x.id !== id);
      const still = new Set(state.groups.flatMap((x) => x.words));
      g.words.forEach((en) => { if (!still.has(en)) delete state.cards[en]; });
      save();
    },

    // Due = in an active group, not learned, due date today or earlier.
    dueWords(onDate = App.today()) {
      const out = [];
      for (const g of this.activeGroups()) {
        for (const en of groupWords(g)) {
          const c = card(en);
          if (c && !isLearned(c) && c.due <= onDate && !out.includes(en)) out.push(en);
        }
      }
      return out.map((en) => App.byEn.get(en));
    },
    // How many reviews fall on each of the next `days` days (overdue counted on day 0).
    forecast(days = 30) {
      const today = App.today();
      const counts = new Array(days).fill(0);
      for (const g of this.activeGroups()) {
        for (const en of groupWords(g)) {
          const c = card(en);
          if (!c || isLearned(c)) continue;
          const d = Math.max(0, App.daysBetween(today, c.due));
          if (d < days) counts[d]++;
        }
      }
      return counts;
    },

    answer(en, ok) {
      const c = card(en);
      if (!c || isLearned(c)) return;
      const today = App.today();
      c.history.push([today, ok ? 1 : 0]);
      c.reviewed = today;
      if (ok) {
        c.step += 1;
        c.due = c.step >= LEARNED ? null : App.addDays(today, INTERVALS[c.step]);
      } else {
        c.step = 1;
        c.due = App.addDays(today, INTERVALS[1]);
      }
      refreshGroups();
      save();
    },
    // Games only count for words that are actually due, so playing a lot doesn't skip intervals.
    recordFromGame(en, ok) {
      const c = card(en);
      if (c && !isLearned(c) && c.due && c.due <= App.today() && state.groups.some((g) => !g.completedAt && g.words.includes(en))) {
        this.answer(en, ok);
      }
    },

    exportJSON() { return JSON.stringify({ srs: state, hard: App.hard, filter: App.filter, custom: App.custom }, null, 1); },
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data.srs || !Array.isArray(data.srs.groups)) throw new Error("Это не файл прогресса");
      state = Object.assign(defaults(), data.srs);
      save();
      if (data.hard) { App.hard = data.hard; App.store.set("hard", App.hard); }
      if (data.filter) App.setFilter(data.filter);
      if (Array.isArray(data.custom)) App.saveCustom(data.custom);
    },
    reset() { state = defaults(); save(); },
    // Re-read after another device's progress was pulled into storage (js/sync.js).
    reload() { state = Object.assign(defaults(), App.store.get("srs", {})); refreshGroups(); },
  };

  refreshGroups();
  App.srs = srs;
})(window.App);
