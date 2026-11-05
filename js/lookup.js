// Suggestions for a new word (#add): translation, transcription and example sentences from free public APIs,
// called straight from the browser (all three allow it), so each user has their own rate limits.
//   MyMemory         api.mymemory.translated.net — translation en↔ru (several variants)
//   Free Dictionary  api.dictionaryapi.dev       — transcription and dictionary examples (English only)
//   Tatoeba          api.tatoeba.org             — real sentences with a Russian translation (CC BY)
// Any of them may be down or slow: every call is best effort and simply gives nothing on failure.
//   App.lookup.translate("cinnamon") → {from: "en", en: "cinnamon", options: ["корица", …]}
//   App.lookup.translate("корица")   → {from: "ru", ru: "корица", options: ["cinnamon", …]}
//   App.lookup.details("cinnamon")   → {ipa: "/ˈsɪn.ə.mən/", examples: [{en, ru}]}
(function (App) {
  const CYR = /[А-Яа-яЁё]/;
  const LAT = /[A-Za-z]/;

  async function getJson(url, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      return r.ok ? await r.json() : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const tidy = (s) => String(s || "").replace(/\s+/g, " ").replace(/^[\s"'«(.,;:!?-]+|[\s"'»).,;:!?-]+$/g, "").trim();
  const bare = (en) => en.replace(/\([^)]*\)/g, " ").replace(/^\s*(to|a|an|the)\s+/i, "").replace(/\s+/g, " ").trim();

  async function translate(q) {
    q = tidy(q);
    const from = CYR.test(q) ? "ru" : "en";
    const to = from === "ru" ? "en" : "ru";
    const ok = to === "ru" ? (s) => CYR.test(s) && !LAT.test(s) : (s) => LAT.test(s) && !CYR.test(s);
    const d = await getJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${from}|${to}`);
    const seen = new Set();
    const options = [];
    // The "main" answer is sometimes the word itself — the useful variants are in matches, best quality first.
    const cands = [
      ...((d && d.matches) || []).slice().sort((a, b) => (+b.quality || 0) - (+a.quality || 0)).map((m) => m.translation),
      d && d.responseData && d.responseData.translatedText,
    ];
    for (const c of cands) {
      let t = tidy(c);
      if (!t || !ok(t) || t.length > 60 || t.toLowerCase() === q.toLowerCase()) continue;
      if (!/^[A-ZА-ЯЁ]{2}/.test(t) && q[0] === q[0].toLowerCase()) t = t[0].toLowerCase() + t.slice(1);
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(t);
      if (options.length >= 5) break;
    }
    return { from, [from]: q, options };
  }

  async function details(en) {
    const word = bare(en);
    if (!word || !LAT.test(word)) return { ipa: "", examples: [] };
    const phrase = word.includes(" ") ? `"${word}"` : word;
    const [dict, tat] = await Promise.all([
      getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
      getJson(`https://api.tatoeba.org/unstable/sentences?lang=eng&q=${encodeURIComponent(phrase)}&trans:lang=rus&sort=relevance&limit=20`),
    ]);
    let ipa = "";
    const examples = [];
    const seen = new Set();
    const push = (text, ru) => {
      text = String(text || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 100 || seen.has(text.toLowerCase()) || !App.findCloze(en, text)) return;
      seen.add(text.toLowerCase());
      examples.push({ en: text, ru: ru || "" });
    };
    // Tatoeba first: real sentences with a Russian translation; short-to-medium ones read best.
    const sentences = ((tat && tat.data) || [])
      .filter((s) => !s.is_unapproved && s.text && s.text.length >= 15)
      .sort((a, b) => Math.abs(a.text.length - 45) - Math.abs(b.text.length - 45));
    for (const s of sentences) {
      const tr = (s.translations || []).flat().find((t) => t && t.lang === "rus");
      push(s.text, tr && tr.text);
    }
    if (Array.isArray(dict)) {
      for (const entry of dict) {
        ipa = ipa || entry.phonetic || ((entry.phonetics || []).find((p) => p.text) || {}).text || "";
        for (const m of entry.meanings || []) for (const def of m.definitions || []) push(def.example, "");
      }
    }
    return { ipa, examples: examples.slice(0, 4) };
  }

  App.lookup = { translate, details };
})(window.App);
