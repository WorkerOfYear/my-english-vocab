// Shared parts of the co-op mini-games (🎲 #minigames): rooms and the lobby, the server clock, events, results,
// and the words each player brings. A game only describes one round:
//
//   App.pages.mygame = App.coop.page({
//     game: "mygame", title, intro: "<html>", players: 1 | 2 (minimum), solo: true|false,
//     round(ctx) { …draw into ctx.root…; return { onEvents(events) {}, stop() {} }; },
//   });
//
// ctx: root, room, me (uid), meIndex, now() — ms since the round's start on the server clock,
//      post({type, id, part, text, n}) — send an event, end(result, () => "<html of the results>").
// Rooms and events live on the server (api/game.js); both phones simulate the round from room.seed.
(function (App) {
  const { esc } = App;
  const LOBBY_POLL = 1500, GAME_POLL = 800;
  const DECK = 120; // words each player brings to a round

  // ---------- words: what's being learned first, then hard words, then the period filter, then the rest.
  // Words that came up in earlier games wait until all the others have come up too, then a new lap starts.
  // The list is shared by all mini-games and synced with the progress (js/sync.js); its key is historical.
  const USED = "towerUsed";
  function usedWords() {
    const u = App.store.get(USED, null) || { lap: 0, words: [] };
    return { lap: u.lap || 0, words: u.words || [], set: new Set(u.words || []) };
  }
  const saveUsed = (u) => App.store.set(USED, { lap: u.lap, words: u.words });

  function myWords(accept = () => true) {
    const ok = (w) => w && w.ru && w.en.length <= 30 && !/\b(smth|smd|smb|sb|sth|V-ing|V3|V)\b|\+/.test(w.en) && accept(w);
    const short = (ru) => {
      let s = ru.split(";")[0].trim();
      if (s.length > 34) s = s.split(",")[0].trim();
      return s.slice(0, 50);
    };
    const order = [];
    const seen = new Set();
    const add = (w) => { if (ok(w) && !seen.has(w.en)) { seen.add(w.en); order.push(w); } };
    for (const g of App.srs.activeGroups().concat(App.srs.completedGroups())) for (const en of App.srs.groupWords(g)) add(App.byEn.get(en));
    Object.keys(App.hard).forEach((en) => add(App.byEn.get(en)));
    App.shuffle(App.filtered()).forEach(add);
    App.shuffle(App.ALL).forEach(add);
    const used = usedWords();
    let pick = order.filter((w) => !used.set.has(w.en)).slice(0, DECK);
    if (pick.length < DECK) {
      saveUsed({ lap: used.lap + 1, words: [] });
      const taken = new Set(pick.map((w) => w.en));
      pick = pick.concat(order.filter((w) => !taken.has(w.en)).slice(0, DECK - pick.length));
    }
    return App.shuffle(pick).map((w) => ({ en: w.en, ru: short(w.ru) }));
  }

  function markUsed(list) {
    const u = usedWords();
    const fresh = [...new Set(list)].filter((en) => !u.set.has(en));
    if (fresh.length) saveUsed({ lap: u.lap, words: u.words.concat(fresh) });
  }

  // Seeded random numbers, the same on both phones.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(list, rand) {
    const d = list.slice();
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  // Words from my own dictionary count in "hard words" and the tracker like in the other games.
  function learn(en, ok) {
    const word = App.byEn.get(en);
    if (word) App.record(word, ok);
  }

  // ---------- the page: list of rooms → room → rounds → results
  function page(opts) {
    const minPlayers = opts.players || 1;
    return {
      title: opts.title,
      noFilter: true,
      parent: () => "minigames",
      render(root) {
        if (!App.sync || !App.sync.connected) {
          root.innerHTML = `<div class="card center"><p>Эта игра работает только на сайте после входа в аккаунт.</p></div>`;
          return;
        }
        const api = (path, method = "GET", body) => App.sync.api(path, { method, noLogout: method !== "GET", body: body && JSON.stringify(body) });
        const me = App.session.uid;
        const ROOM_KEY = opts.game + "Room";
        let room = null, err = "", rooms = null;
        // One polling loop at a time: the list of rooms, the room's lobby, or the running round. A loop that is no
        // longer the current one (its request was still on the way when the mode changed) just stops.
        let pollTimer = null, alive = true, mode = "";
        const loop = (m, fn, ms) => { if (alive && mode === m) { clearTimeout(pollTimer); pollTimer = setTimeout(fn, ms); } };
        const startLoop = (m, fn) => { mode = m; clearTimeout(pollTimer); fn(); };
        let view = "lobby"; // "lobby" | "game" | "results" — lobby polling redraws only the lobby
        let game = null;    // {round, startAt, offset, bestRtt, since, over, impl}

        const stop = () => { mode = ""; clearTimeout(pollTimer); if (game && game.impl && game.impl.stop) game.impl.stop(); };
        const setRoom = (r) => { room = r; App.store.set(ROOM_KEY, r ? r.code : ""); };

        // ----- lobby
        function drawLobby() {
          view = "lobby";
          if (!room) {
            root.innerHTML = `<div class="card game-intro">${opts.intro}</div>
              <div class="card">
                <h3>Комнаты</h3>
                ${rooms === null ? `<p class="muted small">⏳ Ищу комнаты…</p>`
                  : rooms.length ? rooms.map((r) => `<div class="room-row">
                      <div><b>Комната ${esc(r.host)}</b><div class="muted small">${r.players.map(esc).join(", ")} · ${r.players.length}/2${r.status === "playing" ? " · идёт игра" : ""}</div></div>
                      <button class="btn${r.status === "playing" && !r.mine ? "" : " primary"}" data-join="${esc(r.code)}" ${r.status === "playing" && !r.mine ? "disabled" : ""}>${r.mine ? "Вернуться" : "Войти"}</button>
                    </div>`).join("")
                  : `<p class="muted small">Открытых комнат пока нет — создай свою, и напарник увидит её здесь.</p>`}
                <button class="btn primary wide" id="create">👥 Создать комнату</button>
                ${opts.solo ? `<button class="btn wide" id="solo">🧍 Играть одному</button>` : ""}
                ${err ? `<p class="note">${esc(err)}</p>` : ""}
              </div>`;
            root.querySelector("#create").onclick = () => create(false);
            const solo = root.querySelector("#solo");
            if (solo) solo.onclick = () => create(true);
            root.querySelectorAll("[data-join]").forEach((b) => b.onclick = () => { b.disabled = true; join(b.dataset.join); });
            return;
          }
          const host = room.players.find((p) => p.uid === room.host);
          const isHost = room.host === me;
          const enough = room.players.length >= minPlayers;
          const last = room.last && room.last.round === room.round ? room.last : null;
          root.innerHTML = `<div class="card center">
              <h3>Комната ${esc(host ? host.login : "")}</h3>
              <div class="players">${room.players.map((p, i) => `<span class="player p${i}">${esc(p.login)}${p.uid === room.host ? " · хост" : ""}</span>`).join("")}
                ${room.players.length < 2 ? `<span class="player waiting">⏳ ждём напарника…</span>` : ""}</div>
              ${room.players.length < 2 ? `<p class="muted small">Напарник увидит комнату в списке и сможет войти.</p>` : ""}
              ${last && opts.lastLine ? `<p>${opts.lastLine(last.result)}</p>` : ""}
              ${opts.lobbyNote ? `<p class="muted small">${opts.lobbyNote(room, me)}</p>` : ""}
              ${isHost ? `<button class="btn primary wide" id="start" ${enough ? "" : "disabled"}>▶️ ${room.round ? "Сыграть ещё раз" : "Начать"}${room.players.length < 2 && enough ? " (одному)" : ""}</button>
                ${enough ? "" : `<p class="muted small">Для этой игры нужны двое.</p>`}`
                : `<p class="muted">Ждём, пока ${esc(host ? host.login : "хост")} начнёт…</p>`}
              <button class="btn wide" id="leave">Выйти из комнаты</button>
              ${err ? `<p class="note">${esc(err)}</p>` : ""}
            </div>`;
          const start = root.querySelector("#start");
          if (start) start.onclick = async () => {
            start.disabled = true;
            try { setRoom((await api(`/api/game?start=${room.code}`, "POST", {})).room); beginRound(); }
            catch (e) { err = e.message; drawLobby(); }
          };
          root.querySelector("#leave").onclick = async () => {
            try { await api(`/api/game?leave=${room.code}`, "POST", {}); } catch (e) { /* the room is gone anyway */ }
            setRoom(null); stop(); drawLobby(); pollRooms();
          };
        }

        // The list of open rooms refreshes by itself, so the partner's new room just shows up.
        const pollRooms = () => startLoop("rooms", roomsTick);
        async function roomsTick() {
          if (mode !== "rooms" || room) return;
          try { rooms = (await api("/api/game?list=1")).rooms.filter((r) => r.game === opts.game); } catch (e) { /* try again */ }
          if (mode !== "rooms" || room) return;
          if (view === "lobby") drawLobby();
          loop("rooms", roomsTick, LOBBY_POLL);
        }

        async function create(solo) {
          err = "";
          try {
            setRoom((await api("/api/game?create=1", "POST", { game: opts.game, words: myWords(opts.accept), solo })).room);
            if (solo) setRoom((await api(`/api/game?start=${room.code}`, "POST", {})).room);
          } catch (e) { err = e.message; }
          room && room.status === "playing" ? beginRound() : (drawLobby(), room ? pollLobby() : pollRooms());
        }

        async function join(code) {
          err = "";
          mode = ""; clearTimeout(pollTimer);
          try { setRoom((await api(`/api/game?join=${code}`, "POST", { words: myWords(opts.accept) })).room); }
          catch (e) { err = e.message; }
          if (room && room.status === "playing") return pollLobby(); // back into a running round
          drawLobby();
          room ? pollLobby() : pollRooms();
        }

        const pollLobby = () => startLoop("lobby", lobbyTick);
        async function lobbyTick() {
          if (mode !== "lobby" || !room) return;
          try {
            const r = await api(`/api/game?room=${room.code}`);
            if (mode !== "lobby") return;
            setRoom(r.room);
            if (!room.players.some((p) => p.uid === me)) { setRoom(null); drawLobby(); return pollRooms(); }
            if (room.status === "playing" && Date.now() < room.startAt + 60000 && (!game || game.round !== room.round)) return beginRound();
            if (view === "lobby") drawLobby();
          } catch (e) {
            if (e.status === 404 && mode === "lobby") { setRoom(null); err = "Комната закрылась"; if (view === "lobby") drawLobby(); return pollRooms(); }
          }
          loop("lobby", lobbyTick, LOBBY_POLL);
        }

        // ----- a round
        function beginRound() {
          stop();
          view = "game";
          game = { round: room.round, startAt: room.startAt, offset: 0, bestRtt: Infinity, since: 0, over: null, impl: null, sent: 0 };
          const g = game;
          const ctx = {
            root, room, me, meIndex: room.players.findIndex((p) => p.uid === me),
            now: () => Date.now() + g.offset - g.startAt,
            post: (ev) => api(`/api/game?event=${room.code}`, "POST", ev).catch(() => {}),
            nonce: () => `${me}-${++g.sent}`,
            end: (result, resultsHtml) => finish(g, result, resultsHtml),
          };
          g.impl = opts.round(ctx);
          startLoop("game", () => pollGame(g));
        }

        async function pollGame(g) {
          if (mode !== "game" || game !== g || g.over) return;
          const sent = Date.now();
          try {
            const r = await api(`/api/game?room=${room.code}&since=${g.since}`);
            const got = Date.now();
            // Server clock: keep the estimate from the fastest round trip.
            if (got - sent < g.bestRtt) { g.bestRtt = got - sent; g.offset = r.now - (sent + got) / 2; }
            if (mode !== "game" || game !== g) return;
            if (r.room.round === g.round && r.events.length) {
              g.since += r.events.length;
              g.impl.onEvents(r.events);
            }
            setRoom(r.room);
            if (!r.room.players.some((p) => p.uid === me)) { stop(); game = null; setRoom(null); drawLobby(); return pollRooms(); }
          } catch (e) { /* a missed poll is fine — the next one catches up */ }
          if (game === g && !g.over) loop("game", () => pollGame(g), GAME_POLL);
        }

        function finish(g, result, resultsHtml) {
          if (g.over) return;
          g.over = result;
          mode = ""; clearTimeout(pollTimer);
          if (room.host === me) api(`/api/game?event=${room.code}`, "POST", { type: "end", result }).catch(() => {});
          // One more poll, so late moves from the other phone make it into the results.
          setTimeout(async () => {
            try {
              const r = await api(`/api/game?room=${room.code}&since=${g.since}`);
              if (r.room.round === g.round && r.events.length) g.impl.onEvents(r.events, true);
            } catch (e) { /* show what we have */ }
            if (alive && game === g) results(g, resultsHtml);
          }, 900);
        }

        function results(g, resultsHtml) {
          view = "results";
          if (g.impl.stop) g.impl.stop();
          root.innerHTML = resultsHtml() + `<div class="card"><button class="btn primary wide" id="again">${room.host === me ? "▶️ Ещё раз" : "В комнату"}</button>
            <a class="btn wide" href="#minigames">К мини-играм</a></div>`;
          // The other player: jump into the next round as soon as the host starts it.
          if (room.host !== me) { mode = "lobby"; loop("lobby", lobbyTick, LOBBY_POLL); }
          root.querySelector("#again").onclick = async () => {
            if (room.host === me) {
              try { setRoom((await api(`/api/game?start=${room.code}`, "POST", {})).room); return beginRound(); }
              catch (e) { err = e.message; }
            }
            game = null;
            drawLobby();
            pollLobby();
          };
        }

        // ----- start: back into the saved room, or the list of rooms
        const saved = App.store.get(ROOM_KEY, "");
        if (saved) {
          root.innerHTML = `<p class="muted center">⏳ Загружаю комнату…</p>`;
          api(`/api/game?room=${saved}`).then((r) => {
            setRoom(r.room.players.some((p) => p.uid === me) && r.room.game === opts.game ? r.room : null);
            drawLobby();
            room ? pollLobby() : pollRooms();
          }).catch(() => { setRoom(null); drawLobby(); pollRooms(); });
        } else { drawLobby(); pollRooms(); }

        return () => {
          alive = false;
          if (game && !game.over && game.impl && game.impl.leave) game.impl.leave();
          stop();
        };
      },
    };
  }

  App.coop = { page, myWords, markUsed, learn, rng, shuffled };

  // ---------- 🎲 the list of mini-games
  App.pages.minigames = {
    title: "Мини-игры",
    noFilter: true,
    render(root) {
      const games = [
        ["tower", "🏰", "Оборона башни", "Вдвоём или одному: отбивайтесь от монстров переводами слов"],
        ["bomb", "💣", "Обезвредь бомбу", "Вдвоём: сапёр видит бомбу, эксперт — инструкцию"],
      ];
      root.innerHTML = `<div class="tiles">${games.map(([id, icon, title, sub]) => `
        <a class="tile" href="#${id}"><span class="tile-icon">${icon}</span><span class="tile-title">${title}</span><span class="tile-sub">${sub}</span></a>`).join("")}</div>`;
    },
  };
})(window.App);
