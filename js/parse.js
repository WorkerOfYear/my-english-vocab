// Parse vocabulary messages pasted on the site (#add) and find the word inside example sentences.
// Keep in sync with parse_word_line() / extract() / find_cloze() in scripts/extract_words.py.
(function (App) {
  const CYR = /[А-Яа-яЁё]/;
  const IPA = /\s*([/|][^/|]{1,40}[/|])\s*/;
  const SEP = /\s*(?:\s[-–—=]\s?|[-–—=]\s|[–—=])\s*/;
  const LEAD = /^[\s📎*•·>]*(?:\d{1,3}[.)]\s*)?[\s📎*•·>-]*/u;
  const EN_OK = /^[A-Za-z][A-Za-z0-9 '’/().,!?+-]*$/;

  const clean = (s) => s.replace(/\s+/g, " ").replace(/^[ \t.;,]+|[ \t.;,]+$/g, "");

  function parseLine(line) {
    const marked = line.includes("📎");
    let body = line.replace(LEAD, "").trim();
    if (!body) return null;
    let ipa = "";
    const m = IPA.exec(body);
    if (m && !CYR.test(m[1])) {
      ipa = m[1].trim();
      const after = body.slice(m.index + m[0].length);
      body = body.slice(0, m.index) + (CYR.test(after) ? " - " : " ") + after;
    }
    const sep = SEP.exec(body);
    const en = clean(sep ? body.slice(0, sep.index) : body);
    let ru = sep ? clean(body.slice(sep.index + sep[0].length)) : "";
    ru = ru.replace(/^[-–— ]+/, "").trim();
    if (!en || CYR.test(en) || !EN_OK.test(en) || en.split(/\s+/).length > 7) return null;
    if (!marked && !CYR.test(ru)) return null; // unmarked lines must carry a Russian translation
    let def = "";
    if (ru && !CYR.test(ru)) {
      def = line.includes("=") ? "= " + ru : ru;
      ru = "";
    }
    return { en, ipa, ru, def };
  }

  // Text of one or more messages -> [{en, ru, def, ipa, example}], deduped within the paste.
  App.parseVocab = (text) => {
    const out = [];
    const seen = new Map();
    let last = null;
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("✅")) {
        const ex = clean(line.replace(/^✅\s*/, ""));
        if (last && ex && !last.example) last.example = ex;
        continue;
      }
      const p = parseLine(line);
      if (!p) { last = null; continue; }
      const key = App.norm(p.en);
      if (seen.has(key)) {
        last = seen.get(key);
        for (const f of ["ru", "ipa", "def"]) if (!last[f] && p[f]) last[f] = p[f];
        continue;
      }
      const en = /^[A-Z]{2}/.test(p.en) ? p.en : p.en[0].toLowerCase() + p.en.slice(1);
      last = { en, ru: p.ru, def: p.def, ipa: p.ipa, example: "" };
      seen.set(key, last);
      out.push(last);
    }
    return out;
  };

  const PLACEHOLDER = new Set(["someone", "somebody", "something", "smb", "smth", "sb", "sth", "one's", "someone's", "your", "my", "doing"]);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]");

  // The exact piece of `example` that corresponds to the word ("" if not found).
  App.findCloze = (en, example) => {
    if (!example) return "";
    let base = en.replace(/\([^)]*\)/g, " ").split(/\s*\/+\s*|,/)[0].trim().replace(/^(to|a|an|the)\s+/i, "");
    if (base.split(/\s+/).length > 1) base = base.replace(/^(be|get)\s+(?=\w)/i, "");
    const tokens = base.match(/[A-Za-z0-9'’-]+/g);
    if (!tokens) return "";
    const parts = tokens.map((tok) => {
      const t = tok.replace(/’/g, "'");
      if (PLACEHOLDER.has(t.toLowerCase())) return "[\\w'’-]+(?:\\s+[\\w'’-]+)??";
      let stem = reEsc(t.length <= 4 ? t : t.slice(0, Math.max(4, t.length - 2)));
      if (t.length > 3 && /[ye]$/.test(t)) stem = reEsc(t.slice(0, -1));
      return stem + "[\\w'’]*";
    });
    const m = new RegExp("(?<![\\w'’])" + parts.join("\\s+") + "(?![\\w])", "i").exec(example);
    return m ? m[0] : "";
  };
})(window.App);
