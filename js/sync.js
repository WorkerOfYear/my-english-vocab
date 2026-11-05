// Sync progress (tracker, hard words, added words) of the signed-in account through /api/state so the phone and
// the computer see the same thing, and so the server can send Telegram reminders. Works only on the deployed site.
(function (App) {
  const SYNCED = ["srs", "hard", "custom", "grammar", "towerUsed"];
  const online = App.online;
  const token = () => (App.session && App.session.token) || "";
  const meta = Object.assign({ syncedAt: 0, dirty: false, lastOk: 0, error: "" }, App.store.get("syncMeta", {}));
  delete meta.key; // the old shared SYNC_KEY — replaced by accounts
  // Just signed in on this device: whatever this browser already had for the account is merged with the server's.
  if (App.session && App.session.fresh) {
    meta.syncedAt = 0;
    meta.dirty = (App.store.get("srs", {}).groups || []).length > 0 || App.custom.length > 0;
    App.saveSession({ ...App.session, fresh: false });
  }
  let applying = false;
  let timer = null;
  let busy = null;

  const saveMeta = () => App.store.set("syncMeta", meta);
  const emit = () => document.dispatchEvent(new CustomEvent("sync-status"));

  // Any local change to synced data → push a moment later.
  const rawSet = App.store.set;
  App.store.set = (key, value) => {
    rawSet(key, value);
    if (!applying && SYNCED.includes(key) && token()) {
      meta.dirty = true;
      saveMeta();
      schedulePush();
    }
  };

  async function api(path, opts = {}) {
    const r = await fetch(path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { "x-session": token() } : {}),
        ...(App.tg && App.tg.initData ? { "x-telegram-init-data": App.tg.initData } : {}),
        ...(opts.headers || {}),
      },
    });
    const data = await r.json().catch(() => ({}));
    // The session ended (signed out on the server or expired) → back to the sign-in screen.
    if (r.status === 401 && token() && !opts.noLogout) { App.saveSession(null); location.reload(); }
    if (!r.ok) throw Object.assign(new Error(data.error || `Ошибка сервера (${r.status})`), { status: r.status });
    return data;
  }

  const local = () => ({ srs: App.store.get("srs", {}), hard: App.hard, custom: App.custom, grammar: App.store.get("grammar", {}),
    towerUsed: App.store.get("towerUsed", null) });
  function mergeUsed(a, b) {
    if (!a || !b) return a || b || null;
    if ((a.lap || 0) !== (b.lap || 0)) return (a.lap || 0) > (b.lap || 0) ? a : b;
    return { lap: a.lap || 0, words: [...new Set([...(a.words || []), ...(b.words || [])])] };
  }

  // Union of two devices' progress: a card keeps the version with more reviews.
  function merge(a, b) {
    const sa = a.srs || {}, sb = b.srs || {};
    const groups = new Map();
    for (const g of [...(sb.groups || []), ...(sa.groups || [])]) {
      const prev = groups.get(g.id);
      if (!prev || (!prev.completedAt && g.completedAt)) groups.set(g.id, g);
    }
    const cards = { ...(sb.cards || {}) };
    for (const [en, c] of Object.entries(sa.cards || {})) {
      const o = cards[en];
      const len = (x) => (x.history || []).length;
      if (!o || len(c) > len(o) || (len(c) === len(o) && (c.reviewed || "") > (o.reviewed || ""))) cards[en] = c;
    }
    const hard = { ...(b.hard || {}) };
    for (const [en, n] of Object.entries(a.hard || {})) hard[en] = Math.max(n, hard[en] || 0);
    const custom = new Map((b.custom || []).map((w) => [App.norm(w.en), w]));
    for (const w of a.custom || []) custom.set(App.norm(w.en), w);
    // Grammar: the further week wins; per rule, the one practised more recently.
    const ga = a.grammar || {}, gb = b.grammar || {};
    const grules = { ...(gb.rules || {}) };
    for (const [id, r] of Object.entries(ga.rules || {})) {
      const o = grules[id];
      if (!o || (r.last || "") > (o.last || "") || ((r.last || "") === (o.last || "") && (r.reviews || 0) > (o.reviews || 0))) grules[id] = r;
    }
    const gnewer = (ga.cur || 0) >= (gb.cur || 0) ? ga : gb;
    return {
      srs: { ...sb, ...sa, groups: [...groups.values()].sort((x, y) => x.id - y.id), cards },
      hard,
      custom: [...custom.values()],
      grammar: { ...gnewer, cur: gnewer.cur || 0, weekOf: gnewer.weekOf || "", rules: grules },
      // Tower defence: the later lap wins; within one lap, words used on either device are used.
      towerUsed: mergeUsed(a.towerUsed, b.towerUsed),
    };
  }

  function apply(data) {
    applying = true;
    try {
      App.store.set("srs", data.srs || {});
      App.store.set("hard", data.hard || {});
      App.store.set("custom", data.custom || []);
      if (data.grammar) App.store.set("grammar", data.grammar);
      if (data.towerUsed) App.store.set("towerUsed", data.towerUsed);
    } finally {
      applying = false;
    }
    App.hard = data.hard || {};
    App.custom = data.custom || [];
    App.loadWords();
    App.srs.reload();
    // Re-draw only pages that just show state; don't reset a game or review in progress.
    const page = (location.hash.slice(1) || "home").split("?")[0];
    if (["home", "tracker", "words"].includes(page)) App.route();
    else App.renderFilter();
  }

  // Bring in the other device's changes if the server has something newer than we've seen.
  async function pullInto() {
    const { doc } = await api("/api/state");
    if (doc && doc.updatedAt > meta.syncedAt) {
      apply(meta.dirty ? merge(local(), doc.data) : doc.data);
      meta.syncedAt = doc.updatedAt;
    }
    return doc;
  }

  function run(task) {
    if (!online || !token()) return Promise.resolve();
    busy = (busy || Promise.resolve()).then(task).then(() => {
      meta.error = "";
      meta.lastOk = Date.now();
    }).catch((e) => {
      meta.error = e.message;
    }).finally(() => {
      saveMeta();
      emit();
    });
    return busy;
  }

  const pull = () => run(async () => {
    const doc = await pullInto();
    if (meta.dirty || !doc) await pushNow();
  });

  async function pushNow(attempt = 0) {
    await pullInto();
    const updatedAt = Math.max(Date.now(), meta.syncedAt + 1);
    try {
      await api("/api/state", { method: "PUT", body: JSON.stringify({ updatedAt, base: meta.syncedAt, data: local() }) });
    } catch (e) {
      // Another device wrote in between: pull its changes, merge, try again.
      if (e.status === 409 && attempt < 4) return pushNow(attempt + 1);
      throw e;
    }
    meta.syncedAt = updatedAt;
    meta.dirty = false;
  }

  function schedulePush() {
    clearTimeout(timer);
    timer = setTimeout(() => run(pushNow), 1500);
  }

  App.sync = {
    online,
    api,
    get connected() { return online && !!token(); },
    status() {
      if (!online) return "Синхронизация работает только на сайте в интернете, не из файла.";
      if (!token()) return "";
      if (meta.error) return "⚠️ " + meta.error;
      if (meta.dirty) return "⏳ Сохраняю…";
      if (!meta.lastOk) return "⏳ Подключаюсь…";
      const t = new Date(meta.lastOk);
      return `☁️ Синхронизировано в ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    },
    // Push what's left before signing out, so nothing is lost.
    async flush() {
      clearTimeout(timer);
      if (meta.dirty) await run(pushNow);
    },
    // Bot: bind it to this learner (returns a one-time t.me link) and check whether it's bound.
    setupBot() { return api("/api/telegram?setup=1", { method: "POST" }); },
    botStatus() { return api("/api/telegram?status=1"); },
    // Telegram reminders (words / grammar / cuff): {enabled, time, days, tz} on the server, plus when the scheduler last called.
    reminders: {
      get: (kind) => api(`/api/reminders?kind=${kind}`),
      save: (kind, settings) => api(`/api/reminders?kind=${kind}`, { method: "PUT", body: JSON.stringify(settings) }),
      test: (kind) => api(`/api/reminders?kind=${kind}&test=1`, { method: "POST" }),
    },
    // Meme Statham quote at the end of every reminder: {enabled, mat}.
    quotes: {
      get: () => api("/api/reminders?quotes=1"),
      save: (q) => api("/api/reminders?quotes=1", { method: "PUT", body: JSON.stringify(q) }),
    },
    // Course book material, private to the learner (api/book.js).
    bookGet: () => api("/api/book"),
    bookPut: (book) => api("/api/book", { method: "PUT", body: JSON.stringify(book) }),
    // "Speak off the cuff": the recording goes to the bot's chat. info: {level, secs, topic, q}
    sendVoice(blob, info) {
      const qs = new URLSearchParams(Object.entries(info).map(([k, v]) => [k, String(v)]));
      return api(`/api/voice?${qs}`, { method: "POST", body: blob, headers: { "Content-Type": blob.type || "application/octet-stream" } });
    },
    pull,
  };

  // Old one-tap links with the shared key (#sync=KEY) no longer work — sign in instead.
  if (/^#sync=/.test(location.hash)) history.replaceState(null, "", location.pathname + "#tracker");
  pull();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
})(window.App);
