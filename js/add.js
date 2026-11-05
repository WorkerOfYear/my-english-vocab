// #add: one word with suggestions (translation, transcription, example — js/lookup.js),
// or a whole vocabulary message in the tutor's format pasted at once.
(function (App) {
  const { esc } = App;
  const PLACEHOLDER = `📎Sweet tooth /swiːt tuːθ/ - сладкоежка
✅I'm a real sweet tooth.
📎Heat up - разогреть
📎Pomegranate /ˈpɒm.ɪˌɡræn.ɪt/ - гранат
jangled nerves - взвинченные нервы`;

  App.pages.add = {
    title: "Добавить слова",
    render(root) {
      let rows = [];
      let date = App.today();
      const draft = App.store.get("addDraft", "");

      root.innerHTML = `
        <div class="card" id="one"></div>
        <details class="card bulk"${draft ? " open" : ""}>
          <summary>📋 Вставить сообщение с несколькими словами</summary>
          <p class="muted small">Формат как у репетитора: <code>📎word /ipa/ - перевод</code>, строка с <code>✅</code> — пример к слову выше.
          Можно и просто <code>word - перевод</code> по строке.</p>
          <textarea id="text" rows="8" placeholder="${esc(PLACEHOLDER)}">${esc(draft)}</textarea>
          <div class="row">
            <label>Дата урока <input type="date" id="date" value="${date}"></label>
            <button class="btn primary" id="parse">Разобрать</button>
          </div>
        </details>
        <div id="preview"></div>`;
      oneWord(root.querySelector("#one"));

      const text = root.querySelector("#text");
      text.addEventListener("input", () => App.store.set("addDraft", text.value));
      root.querySelector("#date").onchange = (e) => { date = e.target.value || App.today(); };
      root.querySelector("#parse").onclick = parse;

      function parse() {
        rows = App.parseVocab(text.value).map((w) => {
          const existing = App.byNorm.get(App.norm(w.en));
          return { ...w, exists: existing || null, include: !existing };
        });
        drawPreview();
      }

      const ready = (r) => r.include && r.en.trim() && (r.ru.trim() || r.def.trim());

      function drawPreview() {
        const box = root.querySelector("#preview");
        if (!rows.length) {
          box.innerHTML = text.value.trim() ? `<div class="card"><p>Не нашёл ни одного слова. Строки должны начинаться с 📎
            или выглядеть как <code>word - перевод</code>.</p></div>` : "";
          return;
        }
        const n = rows.filter(ready).length;
        const missing = rows.filter((r) => r.include && !(r.ru.trim() || r.def.trim())).length;
        box.innerHTML = `
          <h3 class="section">Нашёл ${App.words(rows.length)}</h3>
          ${rows.map((r, k) => `
            <div class="card add-row${r.include && !(r.ru.trim() || r.def.trim()) ? " need" : ""}${r.include ? "" : " off"}" data-k="${k}">
              <label class="check"><input type="checkbox" data-f="include" ${r.include ? "checked" : ""}>
                ${r.exists ? `<span class="badge">уже есть: ${esc(App.meaning(r.exists))}</span>` : "добавить"}</label>
              <input class="field" data-f="en" value="${esc(r.en)}" placeholder="English" aria-label="Слово">
              ${r.ipa ? `<span class="ipa small">${esc(r.ipa)}</span>` : ""}
              <input class="field" data-f="ru" value="${esc(r.ru)}" placeholder="${r.def ? esc(r.def) : "перевод — нужно заполнить"}" aria-label="Перевод">
              <input class="field small" data-f="example" value="${esc(r.example)}" placeholder="пример (необязательно)" aria-label="Пример">
            </div>`).join("")}
          ${missing ? `<p class="note">У ${App.words(missing)} нет перевода — впиши его или сними галочку.</p>` : ""}
          <button class="btn primary wide" id="save" ${n && !missing ? "" : "disabled"}>Добавить ${App.words(n)}</button>`;
        box.querySelectorAll(".add-row").forEach((el) => {
          const r = rows[+el.dataset.k];
          el.querySelectorAll("[data-f]").forEach((inp) => {
            const f = inp.dataset.f;
            if (f === "include") inp.onchange = () => { r.include = inp.checked; drawPreview(); };
            else {
              inp.oninput = () => { r[f] = inp.value; };
              inp.onchange = () => { r[f] = inp.value.trim(); drawPreview(); };
            }
          });
        });
        const save = box.querySelector("#save");
        if (save) save.onclick = add;
      }

      function add() {
        const words = rows.filter(ready).map((r) => {
          const example = r.example.trim();
          const en = r.en.trim();
          return {
            en, ru: r.ru.trim(), def: r.def.trim(), ipa: r.ipa, example,
            date, source: "manual", exampleBy: example ? "chat" : "", cloze: App.findCloze(en, example),
          };
        });
        App.addWords(words);
        App.store.set("addDraft", "");
        App.renderFilter();
        root.querySelector("#preview").innerHTML = `
          <div class="card center">
            <div class="big">✅ Добавлено ${App.words(words.length)}</div>
            <p class="muted">Они уже есть во всех играх и попадут в следующую группу трекера.</p>
            <div class="row" style="justify-content:center">
              <a class="btn" href="#words">📖 В словарь</a>
              <a class="btn primary" href="#tracker">🗓️ К трекеру</a>
            </div>
          </div>`;
        text.value = "";
        rows = [];
      }
    },
  };

  // ---------- one word: type it in English or Russian, pick a translation and an example from the suggestions
  function oneWord(box) {
    const blank = () => ({ q: "", en: "", ru: "", ipa: "", example: "", exampleBy: "", options: [], optionsFor: "", examples: [], loading: "", done: "" });
    let st = blank();
    let timer = null, seq = 0;

    function draw() {
      const exists = st.en && App.byNorm.get(App.norm(st.en));
      const fromRu = st.optionsFor === "ru";
      const chips = (list, field) => list.map((t) => {
        const on = field === "en" ? st.en === t : st.ru.split(/\s*[,;]\s*/).includes(t);
        return `<button type="button" class="chip${on ? " on" : ""}" data-pick="${field}" data-v="${esc(t)}">${esc(t)}</button>`;
      }).join("");
      box.innerHTML = `
        <h3>➕ Новое слово</h3>
        <input class="field" id="q" placeholder="Слово или фраза — по-английски или по-русски" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(st.q)}">
        ${st.done ? `<p class="small">${st.done}</p>` : ""}
        ${st.q ? `
          <label class="small muted">По-английски ${st.ipa ? `<span class="ipa">${esc(st.ipa)}</span>` : ""}</label>
          <input class="field" id="en" value="${esc(st.en)}" placeholder="English" autocapitalize="none" spellcheck="false">
          ${fromRu && st.options.length ? `<div class="row chips">${chips(st.options, "en")}</div>` : ""}
          ${exists ? `<p class="note">Уже есть в словаре: ${esc(App.meaning(exists))}</p>` : ""}
          <label class="small muted">Перевод</label>
          <input class="field" id="ru" value="${esc(st.ru)}" placeholder="перевод">
          ${!fromRu && st.options.length ? `<div class="row chips">${chips(st.options, "ru")}</div>` : ""}
          <label class="small muted">Пример</label>
          <input class="field" id="example" value="${esc(st.example)}" placeholder="пример (необязательно)" spellcheck="false">
          ${st.examples.length ? `<div class="examples">${st.examples.map((x, i) => `
            <button type="button" class="example-pick${st.example === x.en ? " on" : ""}" data-ex="${i}">
              ${esc(x.en)}${x.ru ? `<span class="muted small">${esc(x.ru)}</span>` : ""}</button>`).join("")}</div>` : ""}
          ${st.loading ? `<p class="muted small">${st.loading}</p>` : ""}
          <div class="row">
            <label>Дата урока <input type="date" id="one-date" value="${App.today()}"></label>
            <button class="btn primary" id="one-add" ${st.en.trim() && st.ru.trim() && !exists ? "" : "disabled"}>Добавить</button>
          </div>
          <p class="muted tiny">Подсказки: MyMemory (перевод), Free Dictionary и Tatoeba (транскрипция и примеры).</p>` : ""}`;
      bind();
    }

    function bind() {
      const $ = (s) => box.querySelector(s);
      const q = $("#q");
      q.oninput = () => {
        st.q = q.value;
        clearTimeout(timer);
        timer = setTimeout(() => lookup(q.value), 700);
      };
      q.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(timer); lookup(q.value); } };
      for (const f of ["en", "ru", "example"]) {
        const el = $("#" + f);
        if (!el) continue;
        el.oninput = () => {
          st[f] = el.value;
          if (f === "example") st.exampleBy = "chat";
          const add = $("#one-add");
          if (add) add.disabled = !(st.en.trim() && st.ru.trim() && !App.byNorm.get(App.norm(st.en)));
        };
        // A hand-typed English word gets its own transcription and examples.
        if (f === "en") el.onchange = () => { st.en = el.value.trim(); if (st.en) loadDetails(st.en); else draw(); };
      }
      box.querySelectorAll("[data-pick]").forEach((b) => b.onclick = () => {
        const v = b.dataset.v;
        if (b.dataset.pick === "en") { st.en = v; loadDetails(v); return; }
        const parts = st.ru.split(/\s*[,;]\s*/).filter(Boolean);
        st.ru = (parts.includes(v) ? parts.filter((x) => x !== v) : [...parts, v]).join(", ");
        draw();
      });
      box.querySelectorAll("[data-ex]").forEach((b) => b.onclick = () => {
        const x = st.examples[+b.dataset.ex];
        st.example = st.example === x.en ? "" : x.en;
        st.exampleBy = st.example ? "dict" : "";
        draw();
      });
      const add = $("#one-add");
      if (add) add.onclick = () => save($("#one-date").value || App.today());
    }

    async function lookup(text) {
      text = text.trim();
      const my = ++seq;
      if (!text) { st = blank(); return draw(); }
      st = { ...blank(), q: text, loading: "⏳ Ищу перевод и примеры…" };
      if (/[А-Яа-яЁё]/.test(text)) st.ru = text; else st.en = text;
      draw();
      focusQ();
      const t = await App.lookup.translate(text);
      if (my !== seq) return;
      st.options = t.options;
      st.optionsFor = t.from;
      if (t.from === "en") st.ru = st.ru || t.options[0] || "";
      else st.en = st.en || t.options[0] || "";
      if (!t.options.length) st.loading = "Перевод не нашёлся — впиши сам.";
      draw();
      focusQ();
      if (st.en) await loadDetails(st.en, my);
      else { st.loading = st.loading.startsWith("⏳") ? "" : st.loading; draw(); focusQ(); }
    }

    async function loadDetails(en, my = ++seq) {
      st.examples = [];
      st.ipa = "";
      if (st.exampleBy === "dict") { st.example = ""; st.exampleBy = ""; }
      st.loading = "⏳ Ищу транскрипцию и примеры…";
      draw();
      const d = await App.lookup.details(en);
      if (my !== seq) return;
      st.ipa = d.ipa;
      st.examples = d.examples;
      if (!st.example && d.examples.length) { st.example = d.examples[0].en; st.exampleBy = "dict"; }
      st.loading = d.examples.length ? "" : "Примеров не нашлось — можно вписать свой.";
      draw();
    }

    const focusQ = () => {
      const q = box.querySelector("#q");
      if (q && document.activeElement !== box.querySelector("#en") && document.activeElement !== box.querySelector("#ru")) {
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }
    };

    function save(date) {
      const en = st.en.trim(), example = st.example.trim();
      App.addWords([{
        en, ru: st.ru.trim(), def: "", ipa: st.ipa, example, date, source: "manual",
        exampleBy: example ? st.exampleBy || "chat" : "", cloze: App.findCloze(en, example),
      }]);
      App.renderFilter();
      const added = `✅ «${esc(en)}» добавлено — уже есть во всех играх. Вводи следующее слово.`;
      seq++;
      st = { ...blank(), done: added };
      draw();
      box.querySelector("#q").focus();
    }

    draw();
  }
})(window.App);
