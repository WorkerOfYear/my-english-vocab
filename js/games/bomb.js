// 💣 Defuse the bomb (#bomb), a co-op mini-game for two players on their own phones (rooms: coop.js).
// The sapper sees the bomb: a timer and three modules with English words. The expert sees the manual, in Russian.
// Neither can win alone: the sapper reads the words out loud, the expert works out which one the manual means.
//   ✂️ Wires — five wires with English words; the manual names the meaning of the one to cut.
//   ⌨️ Code  — the manual gives a Russian word; the expert translates it and spells it, the sapper types it.
//   🔢 Order — four buttons with English words; the manual lists their meanings in the order to press.
// A mistake is a strike: −30 s; the third strike sets the bomb off. Roles swap every round.
// The words come from the expert's dictionary — they are the one who has to recognise them.
//
// Both phones build the same bomb from the room's seed and replay the sapper's moves (events, in the server's
// order) to get the same state; the sapper's own moves show up at once and are confirmed by the server.
(function (App) {
  const { esc } = App;
  const { rng, shuffled, learn, markUsed } = App.coop;
  const TIME = 180000, PENALTY = 30000, STRIKES = 3;
  const COLORS = [["красный", "#e03131"], ["синий", "#1c7ed6"], ["жёлтый", "#f59f00"], ["зелёный", "#2f9e44"], ["белый", "#dee2e6"], ["чёрный", "#343a40"]];

  // ---------- the bomb, from the seed and the expert's words
  function build(room) {
    const rand = rng(room.seed);
    const sapperIdx = (room.round - 1) % room.players.length;
    const expertIdx = (sapperIdx + 1) % room.players.length;
    const pool = shuffled(room.players[expertIdx].words, rand);
    const taken = new Set();
    // Words with different meanings, so the manual always points at exactly one of them.
    const take = (n, ok = () => true) => {
      const out = [];
      for (const w of pool) {
        if (out.length === n) break;
        const key = w.ru.toLowerCase();
        if (!ok(w) || taken.has(w.en.toLowerCase()) || taken.has(key)) continue;
        taken.add(w.en.toLowerCase()); taken.add(key);
        out.push(w);
      }
      return out;
    };
    const wires = take(5);
    const colors = shuffled(COLORS, rand).slice(0, 5);
    const code = take(1, (w) => /^[a-z][a-z' -]{2,13}$/i.test(w.en))[0] || take(1)[0];
    const order = take(4);
    const modules = shuffled([
      { kind: "wires", words: wires, colors, target: Math.floor(rand() * wires.length) },
      { kind: "code", words: [code] },
      { kind: "order", words: order, seq: shuffled([0, 1, 2, 3], rand) },
    ], rand).map((m, id) => ({ ...m, id }));
    return { sapper: room.players[sapperIdx], expert: room.players[expertIdx], modules };
  }

  // ---------- replaying the moves → state at time t (ms since start)
  function replay(bomb, events) {
    const st = { strikes: [], solved: {}, cut: {}, progress: {}, tries: {}, endedAt: Infinity, result: null };
    const left = (t) => TIME - t - PENALTY * st.strikes.filter((s) => s <= t).length;
    const strike = (t) => {
      st.strikes.push(t);
      if (st.strikes.length >= STRIKES) { st.endedAt = t; st.result = "lose"; }
    };
    for (const ev of events) {
      const t = ev.t;
      if (st.result || t < 0 || left(t) <= 0) continue; // nothing counts once the bomb is done
      const m = bomb.modules[ev.id];
      if (!m || st.solved[m.id] !== undefined) continue;
      if (ev.type === "cut" && m.kind === "wires") {
        const cut = (st.cut[m.id] = st.cut[m.id] || []);
        if (cut.includes(ev.part)) continue;
        cut.push(ev.part);
        if (ev.part === m.target) st.solved[m.id] = t; else strike(t);
      } else if (ev.type === "code" && m.kind === "code") {
        (st.tries[m.id] = st.tries[m.id] || []).push(ev.text || "");
        if (App.isCorrect(ev.text || "", m.words[0].en)) st.solved[m.id] = t; else strike(t);
      } else if (ev.type === "press" && m.kind === "order") {
        const p = st.progress[m.id] || 0;
        if (ev.part === m.seq[p]) {
          st.progress[m.id] = p + 1;
          if (p + 1 === m.seq.length) st.solved[m.id] = t;
        } else { st.progress[m.id] = 0; strike(t); }
      }
      if (!st.result && bomb.modules.every((x) => st.solved[x.id] !== undefined)) { st.endedAt = t; st.result = "win"; }
    }
    st.left = left;
    return st;
  }

  // ---------- one round
  function round(ctx) {
    const { root, room, me } = ctx;
    const bomb = build(room);
    const sapper = bomb.sapper.uid === me;
    const confirmed = [];   // server events, in the server's order
    const pending = [];     // my moves the server hasn't confirmed yet (sapper only)
    let st = replay(bomb, []);
    let over = false, timer = 0, codeText = "", lastKey = "";

    // My unconfirmed moves count for a while; one the server never got stops counting after 8 s,
    // so both phones end up with the same bomb.
    const all = () => confirmed.concat(pending.filter((p) => !confirmed.some((c) => c.n === p.n) && ctx.now() - p.t < 8000));
    const update = () => { st = replay(bomb, all()); };

    function move(ev) {
      const t = ctx.now();
      if (over || t < 0 || st.result) return;
      const e = { ...ev, n: ctx.nonce(), t };
      pending.push(e);
      ctx.post({ type: e.type, id: e.id, part: e.part, text: e.text, n: e.n });
      const before = st.strikes.length;
      update();
      if (st.strikes.length > before) buzz();
      draw();
    }

    function buzz() {
      const b = root.querySelector(".bomb-top");
      if (b) { b.classList.remove("hurt"); void b.offsetWidth; b.classList.add("hurt"); }
      try { if (App.tg) App.tg.HapticFeedback.notificationOccurred("error"); else if (navigator.vibrate) navigator.vibrate(200); } catch (e) { /* no vibration */ }
    }

    // ----- views
    const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
    const strikesHtml = () => "❌".repeat(st.strikes.length) + "⬜".repeat(STRIKES - st.strikes.length);
    const title = { wires: "✂️ Провода", code: "⌨️ Код", order: "🔢 Порядок" };
    const doneMark = (m) => (st.solved[m.id] !== undefined ? `<span class="badge ok">обезврежен</span>` : "");

    function sapperModule(m) {
      const solved = st.solved[m.id] !== undefined;
      if (m.kind === "wires") {
        const cut = st.cut[m.id] || [];
        return m.words.map((w, i) => `<button class="wire${cut.includes(i) ? " cut" : ""}" data-cut="${m.id}:${i}" ${solved || cut.includes(i) ? "disabled" : ""}>
            <span class="wire-line" style="--c:${m.colors[i][1]}"></span><span class="wire-word">${esc(w.en)}</span></button>`).join("");
      }
      if (m.kind === "code") {
        const tries = st.tries[m.id] || [];
        return solved ? `<p class="center"><b>${esc(m.words[0].en)}</b> ✅</p>`
          : `<form class="row" data-code="${m.id}"><input class="field code-field" id="code-${m.id}" placeholder="код по-английски" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off">
              <button class="btn primary">Ввести</button></form>
            ${tries.length ? `<p class="muted small">Не подошло: ${tries.map(esc).join(", ")}</p>` : ""}`;
      }
      const p = st.progress[m.id] || 0;
      const pressed = m.seq.slice(0, solved ? 4 : p);
      return `<div class="order-grid">${m.words.map((w, i) => `<button class="btn order-btn${pressed.includes(i) ? " on" : ""}" data-press="${m.id}:${i}" ${solved || pressed.includes(i) ? "disabled" : ""}>${esc(w.en)}</button>`).join("")}</div>`;
    }

    function expertModule(m) {
      if (m.kind === "wires") return `<p>Перережь провод, слово на котором значит <b>«${esc(m.words[m.target].ru)}»</b>.</p>
        <p class="muted small">На бомбе 5 проводов, на каждом английское слово. Попроси сапёра прочитать их.</p>`;
      if (m.kind === "code") return `<p>Код — английский перевод слова <b>«${esc(m.words[0].ru)}»</b>. Продиктуй его сапёру по буквам.</p>`;
      return `<p>На бомбе 4 кнопки со словами. Нажимать по смыслу в таком порядке:</p>
        <ol class="manual-order">${m.seq.map((i) => `<li>${esc(m.words[i].ru)}</li>`).join("")}</ol>
        <p class="muted small">Ошибка — и порядок начинается сначала.</p>`;
    }

    function draw() {
      const t = ctx.now();
      const role = sapper ? `🧑‍🔧 Ты сапёр — читай слова вслух и делай, что скажет ${esc(bomb.expert.login)}`
        : `📖 Ты эксперт — у ${esc(bomb.sapper.login)} бомба, у тебя инструкция`;
      // Keep the code being typed (and the focus) across redraws.
      const focused = document.activeElement && document.activeElement.id;
      root.innerHTML = `<div class="bomb-game">
          <div class="bomb-top">
            <span class="bomb-timer" id="b-timer">${t < 0 ? "…" : mmss(st.left(Math.min(t, st.endedAt)))}</span>
            <span class="bomb-strikes">${strikesHtml()}</span>
          </div>
          <p class="small center">${role}</p>
          ${t < 0 ? `<p class="center big" id="b-count">${Math.ceil(-t / 1000)}</p>` : ""}
          ${bomb.modules.map((m) => `<div class="card bomb-module${st.solved[m.id] !== undefined ? " solved" : ""}">
              <h3>${title[m.kind]} ${doneMark(m)}</h3>
              ${sapper ? sapperModule(m) : expertModule(m)}
            </div>`).join("")}
        </div>`;
      root.querySelectorAll("[data-cut]").forEach((b) => b.onclick = () => { const [id, i] = b.dataset.cut.split(":").map(Number); move({ type: "cut", id, part: i }); });
      root.querySelectorAll("[data-press]").forEach((b) => b.onclick = () => { const [id, i] = b.dataset.press.split(":").map(Number); move({ type: "press", id, part: i }); });
      root.querySelectorAll("[data-code]").forEach((f) => {
        const id = +f.dataset.code;
        const input = f.querySelector("input");
        input.value = codeText;
        input.oninput = () => { codeText = input.value; };
        if (focused === input.id) input.focus();
        f.onsubmit = (e) => { e.preventDefault(); if (!codeText.trim()) return; const text = codeText.trim(); codeText = ""; move({ type: "code", id, text }); };
      });
    }

    // The timer ticks without redrawing the modules; a redraw happens when the state changes.
    function tick() {
      if (over) return;
      const t = ctx.now();
      const key = `${t < 0 ? Math.ceil(-t / 1000) : "go"}|${st.strikes.length}|${Object.keys(st.solved).length}`;
      if (key !== lastKey) { lastKey = key; draw(); }
      const el = root.querySelector("#b-timer");
      if (el && t >= 0) {
        const left = st.left(Math.min(t, st.endedAt));
        el.textContent = mmss(left);
        el.classList.toggle("low", left < 30000);
      }
      if (st.result) return finish(st.result);
      if (t >= 0 && st.left(t) <= 0) return finish("lose");
      timer = setTimeout(tick, 200);
    }

    function onEvents(events) {
      for (const ev of events) {
        if (!["cut", "code", "press"].includes(ev.type)) continue;
        confirmed.push({ ...ev, t: ev.ts - room.startAt });
      }
      const before = st.strikes.length;
      update();
      if (!sapper && st.strikes.length > before) buzz();
      if (!over) { lastKey = ""; tick(); }
    }

    function finish(result) {
      if (over) return;
      over = true;
      clearTimeout(timer);
      draw();
      // The expert's words: solved modules count as known, the rest as hard words.
      if (!sapper) {
        markUsed(bomb.modules.flatMap((m) => m.words.map((w) => w.en)));
        for (const m of bomb.modules) {
          const target = m.kind === "wires" ? [m.words[m.target]] : m.words;
          target.forEach((w) => learn(w.en, st.solved[m.id] !== undefined));
        }
      }
      ctx.end(result, () => {
        const used = bomb.modules.flatMap((m) => (m.kind === "wires" ? [m.words[m.target]].concat(m.words.filter((_, i) => i !== m.target)) : m.words));
        return `<div class="card center">
            <div class="big">${result === "win" ? "🎉 Бомба обезврежена!" : "💥 Бум!"}</div>
            <p class="muted">${result === "win" ? `Осталось ${mmss(st.left(st.endedAt))}, ошибок: ${st.strikes.length}.`
              : st.strikes.length >= STRIKES ? "Три ошибки — бомба взорвалась." : "Время вышло."}</p>
            <p class="small">Сапёр: ${esc(bomb.sapper.login)} · эксперт: ${esc(bomb.expert.login)}. В следующем раунде меняетесь ролями.</p>
          </div>
          <div class="card"><h3>Слова этой бомбы</h3>
            ${used.map((w) => `<div class="word-row">${App.speakBtn(w.en)}<div><b>${esc(w.en)}</b> — ${esc(w.ru)}</div></div>`).join("")}</div>`;
      });
    }

    draw();
    tick();
    return {
      onEvents,
      leave() { if (!sapper) markUsed(bomb.modules.flatMap((m) => m.words.map((w) => w.en))); },
      stop() { clearTimeout(timer); },
    };
  }

  App.pages.bomb = App.coop.page({
    game: "bomb",
    title: "Обезвредь бомбу",
    players: 2,
    solo: false,
    intro: `<div class="big">💣</div>
      <p>Игра для двоих, каждый со своего телефона. <b>Сапёр</b> видит бомбу: таймер и три модуля с английскими словами.
      <b>Эксперт</b> видит инструкцию на русском. Сапёр читает слова вслух, эксперт понимает, какое из них нужно,
      и говорит, что делать. Три минуты, три ошибки — и бум. Роли меняются каждый раунд.</p>`,
    lastLine: (r) => (r === "win" ? "🎉 Прошлая бомба обезврежена!" : "💥 Прошлая бомба взорвалась."),
    lobbyNote: (room) => (room.players.length === 2 ? `Сапёр в следующем раунде: ${esc(room.players[room.round % 2].login)}` : ""),
    round,
  });
})(window.App);
