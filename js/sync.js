// Sync progress (tracker, hard words, added words) through /api/state so the phone and the computer
// see the same thing, and so the server can send Telegram reminders. Works only on the deployed site.
(function (App) {
  const SYNCED = ["srs", "hard", "custom"];
  const online = /^https?:$/.test(location.protocol);
  // Inside the Telegram Mini App the signed launch data replaces the sync key.
  const tgInit = (App.tg && App.tg.initData) || "";
  const meta = Object.assign({ key: "", syncedAt: 0, dirty: false, lastOk: 0, error: "" }, App.store.get("syncMeta", {}));
  let applying = false;
  let timer = null;
  let busy = null;

  const saveMeta = () => App.store.set("syncMeta", meta);
  const emit = () => document.dispatchEvent(new CustomEvent("sync-status"));

  // Any local change to synced data → push a moment later.
  const rawSet = App.store.set;
  App.store.set = (key, value) => {
    rawSet(key, value);
    if (!applying && SYNCED.includes(key) && (meta.key || tgInit)) {
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
        ...(meta.key ? { "x-sync-key": meta.key } : { "x-telegram-init-data": tgInit }),
        ...(opts.headers || {}),
      },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || `Ошибка сервера (${r.status})`), { status: r.status });
    return data;
  }

  const local = () => ({ srs: App.store.get("srs", {}), hard: App.hard, custom: App.custom });
  const hasLocalData = () => (App.store.get("srs", {}).groups || []).length > 0 || App.custom.length > 0;

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
    return {
      srs: { ...sb, ...sa, groups: [...groups.values()].sort((x, y) => x.id - y.id), cards },
      hard,
      custom: [...custom.values()],
    };
  }

  function apply(data) {
    applying = true;
    try {
      App.store.set("srs", data.srs || {});
      App.store.set("hard", data.hard || {});
      App.store.set("custom", data.custom || []);
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
    if (!online || !(meta.key || tgInit)) return Promise.resolve();
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
    get connected() { return online && !!(meta.key || tgInit); },
    get viaTelegram() { return online && !meta.key && !!tgInit; },
    get key() { return meta.key; },
    status() {
      if (!online) return "Синхронизация работает только на сайте в интернете, не из файла.";
      if (!meta.key && !tgInit) return "";
      if (meta.error) return "⚠️ " + meta.error;
      if (meta.dirty) return "⏳ Сохраняю…";
      if (!meta.lastOk) return "⏳ Подключаюсь…";
      const t = new Date(meta.lastOk);
      return `☁️ Синхронизировано в ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    },
    async connect(key) {
      meta.key = key.trim();
      meta.syncedAt = 0;
      meta.dirty = hasLocalData(); // keep this device's progress: it gets merged with the server's
      meta.error = "";
      saveMeta();
      emit();
      await pull();
      if (meta.error) {
        const err = meta.error;
        meta.key = "";
        saveMeta();
        emit();
        throw new Error(err);
      }
    },
    disconnect() {
      Object.assign(meta, { key: "", syncedAt: 0, dirty: false, lastOk: 0, error: "" });
      saveMeta();
      emit();
    },
    deviceLink() { return `${location.origin}${location.pathname}#sync=${encodeURIComponent(meta.key)}`; },
    async test() {
      await run(pushNow); // the server should see the latest schedule
      if (meta.error) throw new Error(meta.error);
      return api("/api/remind?test=1", { method: "POST" });
    },
    // Bot: bind it to this learner (returns a one-time t.me link) and check whether it's bound.
    setupBot() { return api("/api/telegram?setup=1", { method: "POST" }); },
    botStatus() { return api("/api/telegram?status=1"); },
    pull,
  };

  // A link like https://site/#sync=KEY connects this device in one tap.
  const m = location.hash.match(/^#sync=(.+)$/);
  if (m && online) {
    history.replaceState(null, "", location.pathname + "#tracker");
    App.sync.connect(decodeURIComponent(m[1])).catch(() => {});
  } else {
    pull();
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); });
})(window.App);
