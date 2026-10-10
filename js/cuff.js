// Speak off the cuff: spin the wheel for a topic, talk about it (2 minutes is the target, stop whenever you like),
// the recording goes to the Telegram bot. Topics don't repeat until every topic of the chosen level and
// categories has come up. ⚙️ opens the settings: level and topic categories.
(function (App) {
  const { esc } = App;
  const LEVELS = ["B2", "C1", "C2"];
  const TARGET = 120; // seconds
  const SEGMENTS = 12;
  const COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s0)"];
  const MAX_BYTES = 4 * 1024 * 1024; // what /api/voice accepts

  const CATS = new Map((window.CUFF_CATEGORIES || []).map(([id, icon, name]) => [id, { icon, name }]));

  const load = () => {
    const s = App.store.get("cuff", {});
    return {
      level: LEVELS.includes(s.level) ? s.level : "C1",
      cats: (s.cats || []).filter((c) => CATS.has(c)), // empty = all categories
      used: s.used || {},
    };
  };
  const catLabel = (c) => (CATS.has(c) ? `${CATS.get(c).icon} ${CATS.get(c).name}` : "");
  const mmss = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const short = (t) => (t.length > 17 ? t.slice(0, 16) + "…" : t);

  function pickMime() {
    if (!window.MediaRecorder) return null;
    const types = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
    return types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
  }

  function micError(e) {
    if (!navigator.mediaDevices || !window.MediaRecorder) return "Этот браузер не умеет записывать звук.";
    if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) return "Нет доступа к микрофону. Разреши его в настройках браузера (или Telegram) и попробуй ещё раз.";
    if (e && e.name === "NotFoundError") return "Микрофон не найден.";
    return "Не получилось включить микрофон: " + ((e && e.message) || e);
  }

  App.pages.cuff = {
    title: "Speak off the cuff",
    noFilter: true, // topics don't depend on the word period
    render(root) {
      const state = load();
      const save = () => App.store.set("cuff", state);
      let phase = "wheel"; // wheel → spinning → topic → recording → done
      let topic = null;
      let wheel = []; // topics on the wheel now
      let rotation = 0;
      let lapNote = "";
      let rec = null; // { recorder, stream, chunks, started, timer, wake }
      let result = null; // { blob, url, secs, status: "sending" | "sent" | "error" | "local", error }
      let settings = null; // open settings panel: { before } — the level/categories it was opened with

      const levelTopics = () => window.CUFF_TOPICS[state.level];
      const topics = () => levelTopics().filter((t) => !state.cats.length || state.cats.includes(t.c));
      const usedSet = () => new Set(state.used[state.level] || []);
      const unused = () => { const u = usedSet(); return topics().filter((t) => !u.has(t.id)); };

      // Fresh topics first; if fewer than a full wheel are left, pad it with ones already seen.
      function fillWheel() {
        const fresh = App.shuffle(unused());
        const seen = App.shuffle(topics().filter((t) => usedSet().has(t.id)));
        wheel = App.shuffle(fresh.slice(0, SEGMENTS).concat(seen).slice(0, Math.min(SEGMENTS, topics().length)));
      }

      function wheelSvg() {
        const n = wheel.length, r = 150, step = 360 / n;
        const pt = (deg, rad) => {
          const a = (deg - 90) * Math.PI / 180;
          return `${(r + rad * Math.cos(a)).toFixed(2)} ${(r + rad * Math.sin(a)).toFixed(2)}`;
        };
        const u = usedSet();
        const segs = wheel.map((t, i) => {
          const a0 = i * step, a1 = a0 + step, mid = a0 + step / 2;
          const shape = n === 1 ? `<circle cx="${r}" cy="${r}" r="${r}"` : `<path d="M${r} ${r} L${pt(a0, r)} A${r} ${r} 0 0 1 ${pt(a1, r)} Z"`;
          return `${shape} fill="${COLORS[i % COLORS.length]}"${u.has(t.id) && phase === "wheel" ? ' opacity=".45"' : ""}/>
            <text transform="rotate(${mid - 90} ${r} ${r})" x="${2 * r - 12}" y="${r}" text-anchor="end" dominant-baseline="central">${esc(short(t.t))}</text>`;
        }).join("");
        return `<div class="wheel-wrap">
            <div class="wheel-pointer" aria-hidden="true"></div>
            <svg class="wheel" viewBox="0 0 300 300" style="transform: rotate(${rotation}deg)" role="img" aria-label="Рулетка с темами">${segs}</svg>
            <button class="wheel-hub" id="spin" ${phase === "spinning" ? "disabled" : ""}>Spin</button>
          </div>`;
      }

      function topicCard() {
        return `<div class="card cuff-topic">
          <div class="muted small">${state.level} · ${esc(catLabel(topic.c))}</div>
          <div class="big">${esc(topic.t)}</div>
          <p class="cuff-q">${esc(topic.q)}</p>
          ${topic.ideas && topic.ideas.length ? `<div class="row chips">${topic.ideas.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""}
        </div>`;
      }

      function draw() {
        const left = unused().length, total = topics().length;
        const cats = state.cats.length === 1 ? catLabel(state.cats[0]) : state.cats.length ? `${state.cats.length} категории` : "все темы";
        const head = `
          <div class="toolbar">
            <span class="cuff-summary"><b>${state.level}</b> · ${esc(cats)}<br><span class="muted small">новых тем: ${left} из ${total}</span></span>
            <button class="icon-btn" id="settings" title="Настройки" aria-label="Настройки" ${["wheel", "topic"].includes(phase) ? "" : "disabled"}>⚙️</button>
          </div>`;

        if (settings) {
          root.innerHTML = `${head}${settingsPanel()}`;
        } else if (phase === "wheel" || phase === "spinning" || phase === "topic") {
          root.innerHTML = `${head}
            ${wheelSvg()}
            ${lapNote ? `<p class="note center">${esc(lapNote)}</p>` : ""}
            ${phase === "topic" ? `${topicCard()}
              <button class="btn primary wide" id="start">🎙️ Start</button>
              <p class="muted small center">Таймер на 2 минуты, запись уйдёт в Telegram. Можно говорить и дольше — остановишь сам.</p>`
              : `<p class="muted center">${phase === "spinning" ? "Крутится…" : "Нажми <b>Spin</b>, чтобы выбрать тему"}</p>`}`;
        } else if (phase === "recording") {
          root.innerHTML = `${head}
            ${topicCard()}
            <div class="card center cuff-timer">
              <div class="rec-dot"><span></span> REC</div>
              <div class="timer" id="timer">0:00</div>
              <div class="progress"><div id="bar" style="width:0%"></div></div>
              <p class="muted small" id="timer-note">Цель — ${mmss(TARGET)}</p>
              <button class="btn bad wide" id="stop">⏹ Stop</button>
            </div>`;
          tick();
        } else if (phase === "done") {
          const r = result;
          const status = {
            sending: "⏳ Отправляю в Telegram…",
            sent: "✅ Отправлено в Telegram",
            error: `⚠️ ${esc(r.error || "Не удалось отправить")}`,
            local: esc(r.error || "Запись сохранена только здесь."),
          }[r.status];
          root.innerHTML = `${head}
            ${topicCard()}
            <div class="card center">
              <div class="timer small-timer">${mmss(r.secs)}</div>
              <audio controls src="${r.url}" class="cuff-audio"></audio>
              <p class="${r.status === "sent" ? "good-text" : r.status === "error" ? "bad-text" : "muted"}">${status}</p>
              <div class="row" style="justify-content:center">
                ${r.status === "error" ? '<button class="btn" id="retry">🔁 Отправить ещё раз</button>' : ""}
                <a class="btn" href="${r.url}" download="speech-${state.level}-${topic.id}.${r.ext}">💾 Скачать</a>
              </div>
            </div>
            <button class="btn primary wide" id="again" ${r.status === "sending" ? "disabled" : ""}>🎡 Новая тема</button>`;
        }
        bind();
      }

      function settingsPanel() {
        const all = levelTopics();
        const count = (c) => all.filter((t) => t.c === c).length;
        const u = usedSet();
        const fresh = topics().filter((t) => !u.has(t.id)).length;
        return `<div class="card cuff-settings">
          <h3>Уровень</h3>
          <div class="seg" role="group" aria-label="Уровень">${LEVELS.map((l) => `<button data-level="${l}" class="${l === state.level ? "on" : ""}">${l}</button>`).join("")}</div>
          <h3 class="section">Категории тем</h3>
          <div class="row chips">
            <button class="chip${state.cats.length ? "" : " on"}" data-cat="">Все темы · ${all.length}</button>
            ${[...CATS].map(([id, c]) => `<button class="chip${state.cats.includes(id) ? " on" : ""}" data-cat="${id}">${c.icon} ${esc(c.name)} · ${count(id)}</button>`).join("")}
          </div>
          <p class="panel-count">В выборке <b>${topics().length}</b> тем, из них новых <b>${fresh}</b></p>
          <div class="row">
            <button class="btn primary" id="settings-done">Готово</button>
            <button class="btn" id="reset-used" ${u.size ? "" : "disabled"}>↺ Сбросить историю ${state.level}</button>
          </div>
        </div>`;
      }

      function closeSettings() {
        const changed = settings.before !== state.level + "|" + state.cats.join();
        settings = null;
        if (changed || phase !== "topic") { phase = "wheel"; topic = null; lapNote = ""; fillWheel(); }
        draw();
      }

      function bind() {
        const $ = (s) => root.querySelector(s);
        if ($("#settings")) $("#settings").onclick = () => {
          if (settings) return closeSettings();
          settings = { before: state.level + "|" + state.cats.join() };
          draw();
        };
        root.querySelectorAll("[data-level]").forEach((b) => b.onclick = () => {
          state.level = b.dataset.level;
          save();
          draw();
        });
        // "All" on → a tap picks just that category; otherwise taps toggle, and nothing left means all again.
        root.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => {
          const c = b.dataset.cat;
          if (!c) state.cats = [];
          else if (state.cats.includes(c)) state.cats = state.cats.filter((x) => x !== c);
          else state.cats = [...state.cats, c];
          save();
          draw();
        });
        if ($("#settings-done")) $("#settings-done").onclick = closeSettings;
        if ($("#reset-used")) $("#reset-used").onclick = async () => {
          if (!(await App.confirm(`Снова считать новыми все темы уровня ${state.level}?`))) return;
          state.used[state.level] = [];
          save();
          draw();
        };
        if ($("#spin")) $("#spin").onclick = spin;
        if ($("#start")) $("#start").onclick = startRec;
        if ($("#stop")) $("#stop").onclick = stopRec;
        if ($("#retry")) $("#retry").onclick = sendResult;
        if ($("#again")) $("#again").onclick = () => { phase = "wheel"; topic = null; lapNote = ""; dropResult(); fillWheel(); draw(); };
      }

      function spin() {
        if (phase === "spinning") return;
        lapNote = "";
        if (!unused().length) { // everything in this selection has come up — start a new lap
          const pool = new Set(topics().map((t) => t.id));
          state.used[state.level] = (state.used[state.level] || []).filter((id) => !pool.has(id));
          save();
          lapNote = "Все темы из выборки уже были — начинаем круг заново.";
        }
        fillWheel();
        const u = usedSet();
        const choices = wheel.map((t, i) => i).filter((i) => !u.has(wheel[i].id));
        const k = choices[Math.floor(Math.random() * choices.length)];
        const step = 360 / wheel.length;
        // Land segment k under the pointer at the top, a little off-centre so it looks natural.
        const jitter = (Math.random() - 0.5) * step * 0.6;
        const target = 360 - (k * step + step / 2) + jitter;
        const next = rotation - (rotation % 360) + 360 * 5 + ((target % 360) + 360) % 360;
        topic = wheel[k];
        phase = "spinning";
        draw(); // new labels at the old angle…
        const svg = root.querySelector(".wheel");
        rotation = next;
        requestAnimationFrame(() => requestAnimationFrame(() => { // …then spin to the new one
          svg.classList.add("spinning");
          svg.style.transform = `rotate(${rotation}deg)`;
        }));
        const done = () => {
          if (phase !== "spinning") return;
          state.used[state.level] = [...usedSet(), topic.id];
          save();
          phase = "topic";
          draw();
          try { App.tg && App.tg.HapticFeedback.notificationOccurred("success"); } catch (e) { /* old clients */ }
        };
        svg.addEventListener("transitionend", done, { once: true });
        setTimeout(done, 4600); // in case transitionend never comes (tab in background, reduced motion)
      }

      async function startRec() {
        const mime = pickMime();
        if (mime === null || !navigator.mediaDevices) return App.alert(micError());
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (e) {
          return App.alert(micError(e));
        }
        const recorder = new MediaRecorder(stream, Object.assign(mime ? { mimeType: mime } : {}, { audioBitsPerSecond: 32000 }));
        rec = { recorder, stream, chunks: [], started: Date.now(), timer: null, wake: null };
        recorder.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
        recorder.start(1000);
        rec.timer = setInterval(tick, 250);
        try { rec.wake = await navigator.wakeLock.request("screen"); } catch (e) { /* not supported — fine */ }
        phase = "recording";
        draw();
      }

      function tick() {
        if (!rec) return;
        const secs = Math.floor((Date.now() - rec.started) / 1000);
        const t = root.querySelector("#timer");
        if (!t) return;
        t.textContent = mmss(secs);
        t.classList.toggle("over", secs >= TARGET);
        root.querySelector("#bar").style.width = `${Math.min(100, (secs / TARGET) * 100)}%`;
        if (secs >= TARGET) root.querySelector("#timer-note").textContent = "2 минуты прошли — заканчивай мысль и жми Stop";
        if (secs === TARGET && !rec.buzzed) {
          rec.buzzed = true;
          try { App.tg && App.tg.HapticFeedback.notificationOccurred("warning"); } catch (e) { /* old clients */ }
          if (navigator.vibrate) navigator.vibrate(200);
        }
      }

      function release() {
        if (!rec) return;
        clearInterval(rec.timer);
        rec.stream.getTracks().forEach((t) => t.stop());
        if (rec.wake) rec.wake.release().catch(() => {});
      }

      function stopRec() {
        if (!rec) return;
        const r = rec;
        const secs = Math.max(1, Math.round((Date.now() - r.started) / 1000));
        r.recorder.onstop = async () => {
          release();
          rec = null;
          let blob = new Blob(r.chunks, { type: r.recorder.mimeType || r.chunks[0]?.type || "audio/webm" });
          if (/webm/.test(blob.type)) {
            try { blob = App.webmToOgg(await blob.arrayBuffer()); } catch (e) { /* keep WebM, it goes as a file */ }
          }
          const type = blob.type.split(";")[0];
          const ext = { "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/webm": "webm" }[type] || "audio";
          result = { blob, url: URL.createObjectURL(blob), secs, ext, status: "sending" };
          phase = "done";
          sendResult();
        };
        r.recorder.stop();
      }

      async function sendResult() {
        const r = result;
        if (!App.sync || !App.sync.connected) {
          r.status = "local";
          r.error = App.sync && App.sync.online
            ? "Чтобы запись уходила в Telegram, подключи синхронизацию и бота в трекере (☁️ Синхронизация и Telegram)."
            : "Отправка в Telegram работает только на сайте в интернете. Запись можно скачать.";
          return draw();
        }
        if (r.blob.size > MAX_BYTES) {
          r.status = "local";
          r.error = "Запись слишком длинная для отправки в Telegram (больше 4 МБ). Её можно скачать.";
          return draw();
        }
        r.status = "sending";
        draw();
        try {
          await App.sync.sendVoice(r.blob, { level: state.level, cat: catLabel(topic.c), secs: r.secs, topic: topic.t, q: topic.q });
          r.status = "sent";
        } catch (e) {
          r.status = "error";
          r.error = e.message;
        }
        if (result === r && phase === "done") draw();
      }

      function dropResult() {
        if (result) URL.revokeObjectURL(result.url);
        result = null;
      }

      fillWheel();
      draw();
      return () => {
        if (rec) { rec.recorder.onstop = null; try { rec.recorder.stop(); } catch (e) { /* already stopped */ } release(); rec = null; }
        dropResult();
      };
    },
  };
})(window.App);
