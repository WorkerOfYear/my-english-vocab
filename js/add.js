// #add: paste a vocabulary message in the tutor's format and turn it into new words.
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
        <div class="card">
          <p class="muted small">Вставь сообщение с новыми словами в том же формате, что присылала репетитор:
          <code>📎word /ipa/ - перевод</code>, строка с <code>✅</code> — пример к слову выше.
          Можно и просто <code>word - перевод</code> по строке.</p>
          <textarea id="text" rows="8" placeholder="${esc(PLACEHOLDER)}">${esc(draft)}</textarea>
          <div class="row">
            <label>Дата урока <input type="date" id="date" value="${date}"></label>
            <button class="btn primary" id="parse">Разобрать</button>
          </div>
        </div>
        <div id="preview"></div>`;

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
})(window.App);
