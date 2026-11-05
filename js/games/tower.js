// 🏰 Tower defence (#tower), a co-op mini-game for one or two players, each on their own phone (rooms: coop.js).
// Monsters walk down to the tower carrying a Russian word; typing the English word destroys the monster.
// Each player has a lane with words from their own dictionary; anyone may hit any monster. A boss at the end
// of waves 2–5 carries two words — one from each player's dictionary — and both have to be typed.
//
// Both phones build the same schedule from the room's seed and simulate it on the server's clock; the only thing
// sent around is "monster N was hit", stamped by the server. A monster that reaches the tower stands at the gate
// for GRACE ms before it does damage, so a hit from the other phone that is still on its way can save the tower.
(function (App) {
  const { esc } = App;
  const { rng, shuffled, learn, markUsed } = App.coop;
  const WAVES = 5, HP = 10, GRACE = 1500, BREAK = 4000;
  const MONSTERS = ["👾", "👹", "👻", "🧟", "🦇", "🐙", "👺", "🕷️"];

  // ---------- deterministic schedule from the seed
  function schedule(room) {
    const rand = rng(room.seed);
    const lanes = room.players.length;
    // Each player's words in a seeded order; picked round-robin so words don't repeat until the list runs out.
    const decks = room.players.map((p) => ({ words: shuffled(p.words, rand), next: 0 }));
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

  // ---------- one round
  function round(ctx) {
    const { root, room, me } = ctx;
    const sched = schedule(room);
    const g = {
      hits: {},        // id → {part → ts (ms since start)} — a boss has parts 0 and 1, a monster only part 0
      by: {},          // id:part → uid who hit it
      resolved: {},    // id → "killed" | "reached"
      confirmed: new Set(), shownWave: 0, over: false, nodes: {}, raf: 0, usedSaved: false,
    };
    const parts = (m) => m.words.length;
    const hitAt = (m, part) => (g.hits[m.id] || {})[part];
    // When the monster died (ms since start), or Infinity.
    const killTime = (m) => {
      let t = -Infinity;
      for (let p = 0; p < parts(m); p++) { const h = hitAt(m, p); if (h === undefined) return Infinity; t = Math.max(t, h); }
      return t;
    };
    const arrive = (m) => m.spawn + m.travel;
    const hp = (t) => HP - sched.list.reduce((lost, m) => lost + (t >= arrive(m) + GRACE && killTime(m) > arrive(m) + GRACE ? m.dmg : 0), 0);

    root.innerHTML = `<div class="tower-game">
        <div class="tower-top">
          <span id="t-wave">Волна 1/${WAVES}</span>
          <span id="t-hp"></span>
          <span id="t-score"></span>
        </div>
        <div class="tower-field" id="field">
          ${room.players.length === 2 ? `<div class="lane-mark l0">${esc(room.players[0].login)}</div><div class="lane-mark l1">${esc(room.players[1].login)}</div><div class="lane-split"></div>` : ""}
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

    // The field fills what's left of the screen above the keyboard.
    function fitField() {
      const field = root.querySelector("#field");
      if (!field) return;
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const top = field.getBoundingClientRect().top + (window.visualViewport ? window.visualViewport.offsetTop : 0);
      field.style.height = Math.max(240, Math.min(620, vh - top - 90)) + "px";
    }
    const onResize = () => { if (!g.over) fitField(); };
    window.addEventListener("resize", onResize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);
    fitField();

    function tryHit(text, submitted) {
      if (g.over || !text.trim()) return;
      const t = ctx.now();
      // Living monsters, the most dangerous (closest to the tower) first.
      const targets = sched.list
        .filter((m) => m.spawn <= t && !g.resolved[m.id] && killTime(m) === Infinity)
        .sort((a, b) => (t - a.spawn) / a.travel < (t - b.spawn) / b.travel ? 1 : -1);
      for (const m of targets) {
        for (let p = 0; p < parts(m); p++) {
          if (hitAt(m, p) !== undefined || !App.isCorrect(text, m.words[p].en)) continue;
          (g.hits[m.id] = g.hits[m.id] || {})[p] = t; // optimistic; the server's time replaces it
          g.by[m.id + ":" + p] = me;
          ctx.post({ type: parts(m) > 1 ? "hit" : "kill", id: m.id, part: p });
          if (m.words[p].owner === me) learn(m.words[p].en, true);
          input.value = "";
          const label = g.nodes[m.id] && g.nodes[m.id].querySelectorAll(".mon-word")[p];
          if (label) label.classList.add("done");
          return;
        }
      }
      if (submitted) { input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake"); }
    }

    function toast(text) {
      const el = root.querySelector("#t-msg");
      if (el) el.textContent = text;
    }

    function onEvents(events) {
      for (const ev of events) {
        if (ev.type !== "kill" && ev.type !== "hit") continue;
        const key = ev.id + ":" + ev.part;
        // The server's order is the truth: the first hit on a target counts, at the server's time.
        if (g.confirmed.has(key)) continue;
        g.confirmed.add(key);
        (g.hits[ev.id] = g.hits[ev.id] || {})[ev.part] = ev.ts - room.startAt;
        const mineBefore = g.by[key] === me;
        g.by[key] = ev.by;
        const m = sched.list[ev.id];
        if (ev.by !== me && m && !g.over) {
          const who = room.players.find((p) => p.uid === ev.by);
          toast(mineBefore ? `${who ? who.login : "Напарник"} успел раньше: ${m.words[ev.part].en}` : `${who ? who.login : ""}: 💥 ${m.words[ev.part].en}`);
        }
      }
    }

    // ----- animation frame: positions, damage, waves, the end
    function frame() {
      if (g.over) return;
      const t = ctx.now();
      const field = root.querySelector("#field");
      if (!field) return;
      const H = field.clientHeight, W = field.clientWidth;
      const gate = H - 70;
      const lanes = room.players.length;
      let left = 0;
      for (const m of sched.list) {
        const dead = killTime(m), arr = arrive(m);
        let node = g.nodes[m.id];
        if (t < m.spawn) { left++; continue; }
        if (g.resolved[m.id]) continue;
        if (dead <= t && dead <= arr + GRACE) {
          g.resolved[m.id] = "killed";
          if (node) { node.classList.add("boom"); setTimeout(() => node.remove(), 450); }
          continue;
        }
        if (t >= arr + GRACE) {
          g.resolved[m.id] = "reached";
          m.words.forEach((w, p) => { if (hitAt(m, p) === undefined && w.owner === me) learn(w.en, false); });
          if (node) { node.classList.add("bite"); setTimeout(() => node.remove(), 450); }
          field.classList.remove("hurt"); void field.offsetWidth; field.classList.add("hurt");
          continue;
        }
        left++;
        if (!node) {
          node = document.createElement("div");
          node.className = "mon" + (m.boss ? " boss" : "") + (m.lane === ctx.meIndex || m.lane === -1 ? " mine" : "");
          node.innerHTML = `<span class="mon-face">${m.face}</span>` +
            m.words.map((w, p) => `<span class="mon-word${hitAt(m, p) !== undefined ? " done" : ""}">${esc(w.ru)}</span>`).join("");
          field.appendChild(node);
          g.nodes[m.id] = node;
        }
        if (m.boss) node.querySelectorAll(".mon-word").forEach((el, p) => el.classList.toggle("done", hitAt(m, p) !== undefined));
        const k = Math.min(1, (t - m.spawn) / m.travel);
        const laneW = m.lane < 0 || lanes < 2 ? W : W / 2;
        const x0 = m.lane > 0 ? W / 2 : 0;
        const x = m.lane < 0 ? W / 2 : x0 + laneW * m.x;
        node.style.transform = `translate(${x}px, ${k * gate}px) translate(-50%, 0)`;
        node.classList.toggle("attack", t >= arr);
      }
      const wave = sched.waves.filter((w) => w.at <= t).length || 1;
      if (wave !== g.shownWave) {
        g.shownWave = wave;
        root.querySelector("#t-wave").textContent = `Волна ${wave}/${WAVES}`;
        const b = root.querySelector("#banner");
        b.textContent = wave === WAVES ? `Волна ${wave} — последняя!` : `Волна ${wave}`;
        b.classList.remove("show"); void b.offsetWidth; b.classList.add("show");
      }
      const lives = Math.max(0, hp(t));
      root.querySelector("#t-hp").textContent = "❤️".repeat(lives) + "🖤".repeat(HP - lives);
      root.querySelector("#t-score").textContent = `💥 ${Object.values(g.by).filter((u) => u === me).length}`;
      if (lives <= 0) return over("lose");
      if (!left) return over("win");
      g.raf = requestAnimationFrame(frame);
    }

    // My words that have come up in this round count as used (coop.js: myWords).
    function rememberUsed() {
      if (g.usedSaved) return;
      g.usedSaved = true;
      const t = ctx.now();
      const mine = [];
      for (const m of sched.list) if (m.spawn <= t) m.words.forEach((w) => { if (w.owner === me) mine.push(w.en); });
      markUsed(mine);
    }

    function over(result) {
      g.over = true;
      cancelAnimationFrame(g.raf);
      rememberUsed();
      const reachedWave = g.shownWave;
      ctx.end(result, () => {
        const counts = room.players.map((p) => Object.values(g.by).filter((u) => u === p.uid).length);
        const missed = [];
        for (const m of sched.list) if (g.resolved[m.id] === "reached") m.words.forEach((w, p) => { if (hitAt(m, p) === undefined) missed.push(w); });
        return `<div class="card center">
            <div class="big">${result === "win" ? "🏆 Башня выстояла!" : "💀 Башня пала"}</div>
            <p class="muted">${result === "win" ? `Все ${WAVES} волн отбиты.` : `Дошли до волны ${reachedWave} из ${WAVES}.`}</p>
            <div class="players">${room.players.map((p, i) => `<span class="player p${i}">${esc(p.login)}: 💥 ${counts[i]}</span>`).join("")}</div>
          </div>
          ${missed.length ? `<div class="card"><h3>Прорвались к башне</h3>
            ${missed.map((w) => `<div class="word-row">${App.speakBtn(w.en)}<div><b>${esc(w.en)}</b> — ${esc(w.ru)}</div></div>`).join("")}</div>` : ""}`;
      });
    }

    g.raf = requestAnimationFrame(frame);
    return {
      onEvents,
      leave: rememberUsed,
      stop() {
        cancelAnimationFrame(g.raf);
        window.removeEventListener("resize", onResize);
        if (window.visualViewport) window.visualViewport.removeEventListener("resize", onResize);
      },
    };
  }

  App.pages.tower = App.coop.page({
    game: "tower",
    title: "Оборона башни",
    solo: true,
    intro: `<div class="big">🏰</div>
      <p>К башне идут монстры, на каждом — русское слово. Напиши перевод, и монстр взорвётся.
      У каждого своя дорожка со словами из своего словаря, но выручать напарника можно и нужно.
      Выстойте вместе 5 волн!</p>`,
    lastLine: (r) => (r === "win" ? "🏆 Прошлый раунд — победа!" : "💀 Прошлый раунд башня пала."),
    round,
  });
})(window.App);
