// 🏰 Tower defence (#tower), a co-op mini-game for one or two players, each on their own phone.
// Monsters walk down to the tower carrying a Russian word; typing the English word destroys the monster.
// Each player has a lane with words from their own dictionary; anyone may hit any monster. A boss at the end
// of waves 2–5 carries two words — one from each player's dictionary — and both have to be typed.
//
// Sync: the room (api/game.js) holds the players' words, a seed and the start time. Both phones build the same
// schedule from the seed and simulate it on the server's clock; the only thing sent around is "monster N was hit",
// stamped by the server. A monster that reaches the tower stands at the gate for GRACE ms before it does damage,
// so a hit from the other phone that is still on its way can save the tower.
(function (App) {
  const { esc } = App;
  const WAVES = 5, HP = 10, GRACE = 1500, BREAK = 4000;
  const MONSTERS = ["👾", "👹", "👻", "🧟", "🦇", "🐙", "👺", "🕷️"];
  const LOBBY_POLL = 1500, GAME_POLL = 800;

  // ---------- deterministic schedule from the seed
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

  function schedule(room) {
    const rand = rng(room.seed);
    const lanes = room.players.length;
    // Each player's words in a seeded order; picked round-robin so words don't repeat until the list runs out.
    const decks = room.players.map((p) => {
      const d = p.words.slice();
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      return { words: d, next: 0 };
    });
    const draw = (lane) => {
      const d = decks[lane];
      const w = d.words[d.next++ % d.words.length];
      return { en: w.en, ru: w.ru, owner: room.players[lane].uid };
    };
    const list = [];
    const waves = [];
    let t = 3000; // a moment to read the first banner
    let id = 0, lastLane = 0;
    for (let wave = 1; wave <= WAVES; wave++) {
      const travel = 16000 - 1800 * (wave - 1);
      const count = Math.round((4 + 2 * wave) * (lanes === 2 ? 1.5 : 1));
      const gap = Math.max(1100, 3800 - 550 * (wave - 1)) / (lanes === 2 ? 1.4 : 1);
      waves.push({ wave, at: t });
      for (let i = 0; i < count; i++) {
        // Two players: lanes alternate in pairs, in a random order, so both get the same amount of work.
        const lane = lanes === 2 ? (i % 2 === 0 ? (rand() < 0.5 ? 0 : 1) : lastLane ^ 1) : 0;
        lastLane = lane;
        list.push({ id: id++, wave, lane, x: 0.18 + rand() * 0.64, spawn: t, travel, dmg: 1, words: [draw(lane)], face: MONSTERS[Math.floor(rand() * MONSTERS.length)] });
        t += gap * (0.75 + rand() * 0.5);
      }
      if (wave >= 2) {
        t += 1500;
        list.push({ id: id++, wave, lane: -1, x: 0.5, spawn: t, travel: travel * 1.35, dmg: 3, boss: true, face: "🐉",
          words: lanes === 2 ? [draw(0), draw(1)] : [draw(0), draw(0)] });
      }
      const last = list[list.length - 1];
      t = last.spawn + last.travel * 0.6 + BREAK;
    }
    return { list, waves };
  }

  // ---------- words this player brings: what they're learning first, then hard words, then the rest of the filter
  function myWords() {
    const ok = (w) => w && w.ru && w.en.length <= 30 && !/\b(smth|smd|smb|sb|sth|V-ing|V3|V)\b|\+/.test(w.en);
    const short = (ru) => {
      let s = ru.split(";")[0].trim();
      if (s.length > 34) s = s.split(",")[0].trim();
      return s.slice(0, 50);
    };
    const pick = [];
    const seen = new Set();
    const add = (w) => { if (ok(w) && !seen.has(w.en)) { seen.add(w.en); pick.push({ en: w.en, ru: short(w.ru) }); } };
    for (const g of App.srs.activeGroups().concat(App.srs.completedGroups())) for (const en of App.srs.groupWords(g)) add(App.byEn.get(en));
    Object.keys(App.hard).forEach((en) => add(App.byEn.get(en)));
    App.shuffle(App.filtered()).forEach((w) => { if (pick.length < 120) add(w); });
    if (pick.length < 120) App.shuffle(App.ALL).forEach((w) => { if (pick.length < 120) add(w); });
    return App.shuffle(pick.slice(0, 120));
  }

  // ---------- page
  App.pages.tower = {
    title: "Оборона башни",
    noFilter: true,
    parent: () => "minigames",
    render(root) {
      if (!App.sync || !App.sync.connected) {
        root.innerHTML = `<div class="card center"><p>Эта игра работает только на сайте после входа в аккаунт.</p></div>`;
        return;
      }
      const api = (path, method = "GET", body) => App.sync.api(path, { method, noLogout: method !== "GET", body: body && JSON.stringify(body) });
      const me = App.session.uid;
      let room = null, code = App.store.get("towerRoom", ""), err = "", joinCode = "";
      let pollTimer = null, raf = 0, alive = true;
      let game = null; // running round
      let view = "lobby"; // "lobby" | "game" | "results" — lobby polling redraws only the lobby

      const stop = () => { clearTimeout(pollTimer); cancelAnimationFrame(raf); };
      const setRoom = (r) => { room = r; code = r ? r.code : ""; App.store.set("towerRoom", code); };

      // ----- lobby
      function drawLobby() {
        view = "lobby";
        if (!room) {
          root.innerHTML = `<div class="card tower-intro">
              <div class="big">🏰</div>
              <p>К башне идут монстры, на каждом — русское слово. Напиши перевод, и монстр взорвётся.
              У каждого своя дорожка со словами из своего словаря, но выручать напарника можно и нужно.
              Выстойте вместе 5 волн!</p>
            </div>
            <div class="card">
              <button class="btn primary wide" id="create">👥 Создать комнату</button>
              <form class="row" id="join-form">
                <input class="field code-input" id="code" maxlength="4" placeholder="КОД" autocapitalize="characters" autocomplete="off" value="${esc(joinCode)}">
                <button class="btn">Войти по коду</button>
              </form>
              <button class="btn wide" id="solo">🧍 Играть одному</button>
              ${err ? `<p class="note">${esc(err)}</p>` : ""}
            </div>`;
          root.querySelector("#create").onclick = () => create(false);
          root.querySelector("#solo").onclick = () => create(true);
          root.querySelector("#code").oninput = (e) => { joinCode = e.target.value.toUpperCase().replace(/[^A-Z]/g, ""); e.target.value = joinCode; };
          root.querySelector("#join-form").onsubmit = (e) => { e.preventDefault(); join(joinCode); };
          return;
        }
        const host = room.players.find((p) => p.uid === room.host);
        const isHost = room.host === me;
        const last = room.last && room.last.round === room.round ? room.last : null;
        root.innerHTML = `<div class="card center">
            <p class="muted small">Код комнаты — скажи его напарнику</p>
            <div class="room-code">${esc(room.code)}</div>
            <div class="players">${room.players.map((p, i) => `<span class="player p${i}">${i ? "🛡️" : "⚔️"} ${esc(p.login)}${p.uid === room.host ? " · хост" : ""}</span>`).join("")}
              ${room.players.length < 2 ? `<span class="player waiting">⏳ ждём напарника…</span>` : ""}</div>
            ${last ? `<p>${last.result === "win" ? "🏆 Прошлый раунд — победа!" : "💀 Прошлый раунд башня пала."}</p>` : ""}
            ${isHost ? `<button class="btn primary wide" id="start">▶️ ${room.round ? "Сыграть ещё раз" : "Начать"}${room.players.length < 2 ? " (одному)" : ""}</button>`
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
          setRoom(null); stop(); drawLobby();
        };
      }

      async function create(solo) {
        err = "";
        try {
          setRoom((await api("/api/game?create=1", "POST", { game: "tower", words: myWords() })).room);
          if (solo) setRoom((await api(`/api/game?start=${room.code}`, "POST", {})).room);
        } catch (e) { err = e.message; }
        room && room.status === "playing" ? beginRound() : (drawLobby(), pollLobby());
      }

      async function join(c) {
        err = "";
        if (!/^[A-Z]{4}$/.test(c)) { err = "Код — 4 буквы"; return drawLobby(); }
        try { setRoom((await api(`/api/game?join=${c}`, "POST", { words: myWords() })).room); }
        catch (e) { err = e.message; }
        drawLobby();
        if (room) pollLobby();
      }

      async function pollLobby() {
        clearTimeout(pollTimer);
        if (!alive || !room || game) return;
        try {
          const r = await api(`/api/game?room=${room.code}`);
          setRoom(r.room);
          if (room.status === "playing" && room.players.some((p) => p.uid === me) && Date.now() < room.startAt + 60000) return beginRound();
          if (!room.players.some((p) => p.uid === me)) { setRoom(null); return drawLobby(); }
          if (view === "lobby") drawLobby();
        } catch (e) {
          if (e.status === 404) { setRoom(null); err = "Комната закрылась"; if (view === "lobby") drawLobby(); return; }
        }
        pollTimer = setTimeout(pollLobby, LOBBY_POLL);
      }

      // ----- one round
      function beginRound() {
        stop();
        view = "game";
        const sched = schedule(room);
        game = {
          sched, round: room.round, startAt: room.startAt, offset: 0, bestRtt: Infinity, since: 0,
          hits: {},        // id → {part → ts (ms since start)} — boss has parts 0 and 1, a monster only part 0
          by: {},          // id:part → uid who hit it
          resolved: {},    // id → "killed" | "reached"
          confirmed: new Set(), shownWave: 0, over: null, nodes: {}, msg: "",
          me: room.players.findIndex((p) => p.uid === me),
        };
        drawField();
        pollGame();
        raf = requestAnimationFrame(frame);
      }

      const now = () => Date.now() + game.offset - game.startAt;
      const parts = (m) => m.words.length;
      const hitAt = (m, part) => (game.hits[m.id] || {})[part];
      // When the monster died (ms since start), or Infinity.
      const killTime = (m) => {
        let t = -Infinity;
        for (let p = 0; p < parts(m); p++) { const h = hitAt(m, p); if (h === undefined) return Infinity; t = Math.max(t, h); }
        return t;
      };
      const arrive = (m) => m.spawn + m.travel;

      function hp(t) {
        let lost = 0;
        for (const m of game.sched.list) if (t >= arrive(m) + GRACE && killTime(m) > arrive(m) + GRACE) lost += m.dmg;
        return HP - lost;
      }

      function drawField() {
        const players = room.players;
        root.innerHTML = `<div class="tower-game">
            <div class="tower-top">
              <span id="t-wave">Волна 1/${WAVES}</span>
              <span id="t-hp"></span>
              <span id="t-score"></span>
            </div>
            <div class="field" id="field">
              ${players.length === 2 ? `<div class="lane-mark l0">${esc(players[0].login)}</div><div class="lane-mark l1">${esc(players[1].login)}</div><div class="lane-split"></div>` : ""}
              <div class="banner" id="banner"></div>
              <div class="castle">🏰</div>
            </div>
            <form id="t-form" autocomplete="off">
              <input id="t-input" class="answer" placeholder="Пиши перевод по-английски" autocapitalize="off" autocorrect="off" spellcheck="false">
            </form>
            <p class="small center" id="t-msg"></p>
          </div>`;
        const input = root.querySelector("#t-input");
        input.oninput = () => tryHit(input.value, false);
        root.querySelector("#t-form").onsubmit = (e) => { e.preventDefault(); tryHit(input.value, true); };
        input.focus();
        fitField();
      }

      // The field fills what's left of the screen above the keyboard.
      function fitField() {
        const field = root.querySelector("#field");
        if (!field) return;
        const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const top = field.getBoundingClientRect().top + (window.visualViewport ? window.visualViewport.offsetTop : 0);
        field.style.height = Math.max(240, Math.min(620, vh - top - 90)) + "px";
      }
      const onResize = () => { if (game && !game.over) fitField(); };
      window.addEventListener("resize", onResize);
      if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);

      function tryHit(text, submitted) {
        if (!game || game.over || !text.trim()) return;
        const t = now();
        // Living monsters, the most dangerous (closest to the tower) first.
        const targets = game.sched.list
          .filter((m) => m.spawn <= t && !game.resolved[m.id] && killTime(m) === Infinity)
          .sort((a, b) => (t - a.spawn) / a.travel < (t - b.spawn) / b.travel ? 1 : -1);
        for (const m of targets) {
          for (let p = 0; p < parts(m); p++) {
            if (hitAt(m, p) !== undefined || !App.isCorrect(text, m.words[p].en)) continue;
            (game.hits[m.id] = game.hits[m.id] || {})[p] = t; // optimistic; the server's time replaces it
            game.by[m.id + ":" + p] = me;
            api(`/api/game?event=${room.code}`, "POST", { type: parts(m) > 1 ? "hit" : "kill", id: m.id, part: p }).catch(() => {});
            learn(m.words[p], true);
            const input = root.querySelector("#t-input");
            input.value = "";
            flash(m, p);
            return;
          }
        }
        if (submitted) {
          const input = root.querySelector("#t-input");
          input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake");
        }
      }

      // Words from my own dictionary count in "hard words" and the tracker like in the other games.
      function learn(w, ok) {
        if (w.owner !== me) return;
        const word = App.byEn.get(w.en);
        if (word) App.record(word, ok);
      }

      function flash(m, p) {
        const node = game.nodes[m.id];
        if (!node) return;
        const label = node.querySelectorAll(".mon-word")[p];
        if (label) label.classList.add("done");
      }

      async function pollGame() {
        clearTimeout(pollTimer);
        if (!alive || !game) return;
        const sent = Date.now();
        try {
          const r = await api(`/api/game?room=${room.code}&since=${game.since}`);
          const got = Date.now();
          // Server clock: keep the estimate from the fastest round trip.
          if (got - sent < game.bestRtt) { game.bestRtt = got - sent; game.offset = r.now - (sent + got) / 2; }
          if (r.room.round === game.round) {
            for (const ev of r.events) {
              game.since++;
              if (ev.type !== "kill" && ev.type !== "hit") continue;
              const key = ev.id + ":" + ev.part;
              // The server's order is the truth: the first hit on a target counts, at the server's time.
              if (game.confirmed.has(key)) continue;
              game.confirmed.add(key);
              (game.hits[ev.id] = game.hits[ev.id] || {})[ev.part] = ev.ts - game.startAt;
              const mineBefore = game.by[key] === me;
              game.by[key] = ev.by;
              const m = game.sched.list[ev.id];
              if (ev.by !== me && m) {
                const who = room.players.find((p) => p.uid === ev.by);
                if (who) toast(`${who.login}: 💥 ${m.words[ev.part].en}`);
                if (mineBefore) toast(`${who ? who.login : "Напарник"} успел раньше: ${m.words[ev.part].en}`);
              }
            }
          }
          setRoom(r.room);
          if (!r.room.players.some((p) => p.uid === me)) { game = null; setRoom(null); stop(); return drawLobby(); }
        } catch (e) { /* a missed poll is fine — the next one catches up */ }
        if (game && !game.over) pollTimer = setTimeout(pollGame, GAME_POLL);
      }

      function toast(text) {
        game.msg = text;
        const el = root.querySelector("#t-msg");
        if (el) el.textContent = text;
      }

      // ----- animation frame: positions, damage, waves, the end
      function frame() {
        if (!alive || !game || game.over) return;
        const t = now();
        const field = root.querySelector("#field");
        if (!field) return;
        const H = field.clientHeight, W = field.clientWidth;
        const gate = H - 70;
        const lanes = room.players.length;
        let left = 0;
        for (const m of game.sched.list) {
          const dead = killTime(m), arr = arrive(m);
          let node = game.nodes[m.id];
          if (t < m.spawn) { left++; continue; }
          if (!game.resolved[m.id]) {
            if (dead <= t && dead <= arr + GRACE) {
              game.resolved[m.id] = "killed";
              if (node) { node.classList.add("boom"); setTimeout(() => node.remove(), 450); }
              continue;
            }
            if (t >= arr + GRACE) {
              game.resolved[m.id] = "reached";
              m.words.forEach((w, p) => { if (hitAt(m, p) === undefined) learn(w, false); });
              if (node) { node.classList.add("bite"); setTimeout(() => node.remove(), 450); }
              field.classList.remove("hurt"); void field.offsetWidth; field.classList.add("hurt");
              continue;
            }
          } else continue;
          left++;
          if (!node) {
            node = document.createElement("div");
            node.className = "mon" + (m.boss ? " boss" : "") + (m.lane === game.me || m.lane === -1 ? " mine" : "");
            node.innerHTML = `<span class="mon-face">${m.face}</span>` +
              m.words.map((w, p) => `<span class="mon-word${hitAt(m, p) !== undefined ? " done" : ""}">${esc(w.ru)}</span>`).join("");
            field.appendChild(node);
            game.nodes[m.id] = node;
          }
          if (m.boss) node.querySelectorAll(".mon-word").forEach((el, p) => el.classList.toggle("done", hitAt(m, p) !== undefined));
          const k = Math.min(1, (t - m.spawn) / m.travel);
          const laneW = m.lane < 0 || lanes < 2 ? W : W / 2;
          const x0 = m.lane > 0 ? W / 2 : 0;
          const x = m.lane < 0 ? W / 2 : x0 + laneW * m.x;
          node.style.transform = `translate(${x}px, ${k * gate}px) translate(-50%, 0)`;
          node.classList.toggle("attack", t >= arr);
        }
        // Header: wave, lives, score.
        const wave = game.sched.waves.filter((w) => w.at <= t).length || 1;
        if (wave !== game.shownWave) {
          game.shownWave = wave;
          root.querySelector("#t-wave").textContent = `Волна ${wave}/${WAVES}`;
          const b = root.querySelector("#banner");
          b.textContent = wave === WAVES ? `Волна ${wave} — последняя!` : `Волна ${wave}`;
          b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
        }
        const lives = Math.max(0, hp(t));
        root.querySelector("#t-hp").textContent = "❤️".repeat(Math.min(lives, HP)) + "🖤".repeat(HP - Math.min(lives, HP));
        const mine = Object.values(game.by).filter((u) => u === me).length;
        root.querySelector("#t-score").textContent = `💥 ${mine}`;
        if (lives <= 0) return finish("lose");
        if (!left) return finish("win");
        raf = requestAnimationFrame(frame);
      }

      function finish(result) {
        game.over = result;
        stop();
        if (room.host === me) api(`/api/game?event=${room.code}`, "POST", { type: "end", result }).catch(() => {});
        // Let late hits from the other phone arrive before showing the scores.
        setTimeout(() => { if (alive) results(result); }, 900);
      }

      function results(result) {
        view = "results";
        const g = game;
        const counts = room.players.map((p) => Object.values(g.by).filter((u) => u === p.uid).length);
        const missed = [];
        for (const m of g.sched.list) if (g.resolved[m.id] === "reached") m.words.forEach((w, p) => { if (hitAt(m, p) === undefined) missed.push(w); });
        const reached = g.sched.waves.filter((w) => w.at <= now()).length;
        root.innerHTML = `<div class="card center">
            <div class="big">${result === "win" ? "🏆 Башня выстояла!" : "💀 Башня пала"}</div>
            <p class="muted">${result === "win" ? `Все ${WAVES} волн отбиты.` : `Дошли до волны ${reached} из ${WAVES}.`}</p>
            <div class="players">${room.players.map((p, i) => `<span class="player p${i}">${esc(p.login)}: 💥 ${counts[i]}</span>`).join("")}</div>
          </div>
          ${missed.length ? `<div class="card"><h3>Прорвались к башне</h3>
            ${missed.map((w) => `<div class="word-row">${App.speakBtn(w.en)}<div><b>${esc(w.en)}</b> — ${esc(w.ru)}</div></div>`).join("")}</div>` : ""}
          <div class="card"><button class="btn primary wide" id="again">${room.host === me ? "▶️ Ещё раз" : "В комнату"}</button>
            <a class="btn wide" href="#minigames">К мини-играм</a></div>`;
        game = null;
        // The other player: jump into the next round as soon as the host starts it.
        if (room.host !== me) pollTimer = setTimeout(pollLobby, LOBBY_POLL);
        root.querySelector("#again").onclick = async () => {
          if (room.host === me) {
            try { setRoom((await api(`/api/game?start=${room.code}`, "POST", {})).room); return beginRound(); }
            catch (e) { err = e.message; }
          }
          drawLobby();
          pollLobby();
        };
      }

      // ----- start: back into the saved room, or the lobby
      if (code) {
        api(`/api/game?room=${code}`).then((r) => {
          setRoom(r.room.players.some((p) => p.uid === me) ? r.room : null);
          drawLobby();
          if (room) pollLobby();
        }).catch(() => { setRoom(null); drawLobby(); });
        root.innerHTML = `<p class="muted center">⏳ Загружаю комнату…</p>`;
      } else drawLobby();

      return () => {
        alive = false;
        stop();
        window.removeEventListener("resize", onResize);
        if (window.visualViewport) window.visualViewport.removeEventListener("resize", onResize);
      };
    },
  };

  // ---------- 🎲 the list of mini-games
  App.pages.minigames = {
    title: "Мини-игры",
    noFilter: true,
    render(root) {
      const games = [["tower", "🏰", "Оборона башни", "Вдвоём или одному: отбивайтесь от монстров переводами слов"]];
      root.innerHTML = `<div class="tiles">${games.map(([id, icon, title, sub]) => `
        <a class="tile" href="#${id}"><span class="tile-icon">${icon}</span><span class="tile-title">${title}</span><span class="tile-sub">${sub}</span></a>`).join("")}</div>`;
    },
  };
})(window.App);
