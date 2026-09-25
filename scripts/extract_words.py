"""Extract vocabulary from a Telegram Desktop chat export.

Usage:
    python scripts/extract_words.py [path/to/ChatExport_folder] [--tutor "Name as in Telegram"]

Reads messages*.html (HTML export) or result.json (JSON export) from the given
folder (default: data/raw), finds lines like

    📎Sweet tooth /swiːt tuːθ/ - сладкоежка
    ✅I'm a real sweet tooth.

and writes data/words.json plus js/words.js (so the site works from file://).
Manual fixes live in data/overrides.json: {"word": {"ru": "...", "skip": true}}.
"""
import glob
import json
import os
import re
import sys
from datetime import datetime
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CYR = re.compile(r"[А-Яа-яЁё]")
IPA = re.compile(r"\s*([/|][^/|]{1,40}[/|])\s*")
SEP = re.compile(r"\s*(?:\s[-–—=]\s?|[-–—=]\s|[–—=])\s*")
LEAD = re.compile(r"^[\s📎*•·>]*(?:\d{1,3}[.)]\s*)?[\s📎*•·>-]*")
EN_OK = re.compile(r"^[A-Za-z][A-Za-z0-9 '’/().,!?+-]*$")


class ExportParser(HTMLParser):
    """Collects {date, sender, text} from Telegram's messages*.html."""

    def __init__(self):
        super().__init__()
        self.msgs, self.stack = [], []
        self.cur = None
        self.sender = None
        self.text_depth = self.from_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag == "br":
            if self.text_depth:
                self.cur["text"] += "\n"
            return
        a = dict(attrs)
        cls = a.get("class") or ""
        self.stack.append(tag)
        depth = len(self.stack)
        if tag == "div" and cls.startswith("message default"):
            self.cur = {"date": None, "sender": self.sender, "text": ""}
            self.msgs.append(self.cur)
        if self.cur is None:
            return
        if "date details" in cls and a.get("title") and not self.cur["date"]:
            self.cur["date"] = datetime.strptime(a["title"][:10], "%d.%m.%Y").date().isoformat()
        elif cls == "from_name" and not self.text_depth:
            self.from_depth = depth
        elif cls == "text" and not self.text_depth:
            self.text_depth = depth

    def handle_endtag(self, tag):
        if tag == "br":
            return
        depth = len(self.stack)
        if self.text_depth == depth:
            self.text_depth = 0
        if self.from_depth == depth:
            self.from_depth = 0
        if self.stack:
            self.stack.pop()

    def handle_data(self, data):
        if self.from_depth and data.strip():
            # forwarded messages put a date next to the name — ignore those
            name = data.strip()
            if not re.match(r"^\d", name):
                self.sender = name
                self.cur["sender"] = name
        elif self.text_depth:
            self.cur["text"] += data


def load_messages(folder):
    result = os.path.join(folder, "result.json")
    if os.path.exists(result):
        data = json.load(open(result, encoding="utf-8"))
        msgs = []
        for m in data.get("messages", []):
            if m.get("type") != "message":
                continue
            text = m.get("text", "")
            if isinstance(text, list):
                text = "".join(t if isinstance(t, str) else t.get("text", "") for t in text)
            msgs.append({"date": m["date"][:10], "sender": m.get("from"), "text": text})
        return msgs

    files = glob.glob(os.path.join(folder, "messages*.html"))
    files.sort(key=lambda f: int(re.sub(r"\D", "", os.path.basename(f)) or 1))
    if not files:
        sys.exit(f"No messages*.html or result.json in {folder}")
    msgs = []
    for f in files:
        p = ExportParser()
        p.feed(open(f, encoding="utf-8").read())
        msgs += p.msgs
    return msgs


def clean(s):
    return re.sub(r"\s+", " ", s).strip(" \t.;,")


def parse_word_line(line):
    """Return (en, ipa, ru, definition) or None."""
    marked = "📎" in line
    body = LEAD.sub("", line).strip()
    if not body:
        return None
    ipa = ""
    m = IPA.search(body)
    if m and not CYR.search(m.group(1)):
        ipa = m.group(1).strip()
        body = (body[: m.start()] + " - " + body[m.end():]) if CYR.search(body[m.end():]) else body[: m.start()] + " " + body[m.end():]
    parts = SEP.split(body, maxsplit=1)
    en = clean(parts[0])
    ru = clean(parts[1]) if len(parts) > 1 else ""
    ru = ru.lstrip("-–— ").strip()
    if not en or CYR.search(en) or not EN_OK.match(en):
        return None
    if len(en.split()) > 7:
        return None
    if not marked and not CYR.search(ru):
        return None  # unmarked lines must carry a Russian translation
    definition = ""
    if ru and not CYR.search(ru):
        if "=" in line:
            definition = "= " + ru  # "Feel like = want" style synonyms
        else:
            definition = ru  # later lessons give an English definition instead of a translation
        ru = ""
    return en, ipa, ru, definition


def norm(en):
    """Dedup key: 'To exaggerate', 'exaggerate' and 'an orchestra (formal)' match their bare forms."""
    s = en.lower().replace("’", "'")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"^(to|a|an|the)\s+", "", s.strip())
    return re.sub(r"\s+", " ", s).strip()


def detect_tutor(msgs):
    """The tutor is whoever sent the most 📎 vocabulary lines."""
    counts = {}
    for m in msgs:
        counts[m["sender"]] = counts.get(m["sender"], 0) + m["text"].count("📎")
    return max(counts, key=counts.get) if counts else None


def extract(msgs, tutor):
    words = {}
    order = []
    for msg in msgs:
        source = "tutor" if msg["sender"] == tutor else "homework"
        last = None
        for raw in msg["text"].split("\n"):
            line = raw.strip()
            if not line:
                continue
            if line.startswith("✅"):
                ex = clean(line.lstrip("✅ "))
                if last is not None and ex and not last["example"]:
                    last["example"] = ex
                continue
            parsed = parse_word_line(line)
            if not parsed:
                last = None
                continue
            en, ipa, ru, definition = parsed
            key = norm(en)
            if key in words:
                w = words[key]
                if not w["ru"] and ru:
                    w["ru"] = ru
                if not w["ipa"] and ipa:
                    w["ipa"] = ipa
                if not w["def"] and definition:
                    w["def"] = definition
                last = w
                continue
            w = {"en": en[0].lower() + en[1:] if not en[:2].isupper() else en,
                 "ru": ru, "def": definition, "ipa": ipa, "example": "", "date": msg["date"], "source": source}
            words[key] = w
            order.append(key)
            last = w
    return [words[k] for k in order]


def apply_overrides(words):
    path = os.path.join(ROOT, "data", "overrides.json")
    if not os.path.exists(path):
        return words
    over = {}
    for k, v in json.load(open(path, encoding="utf-8")).items():
        over.setdefault(norm(k), {}).update(v)
    out = []
    for w in words:
        o = over.get(norm(w["en"]))
        if o:
            if o.get("skip"):
                continue
            w.update({k: v for k, v in o.items() if k != "skip"})
        out.append(w)
    return out


def apply_examples(words):
    """Fill missing examples from data/examples.json (written by Claude) and mark where each came from."""
    path = os.path.join(ROOT, "data", "examples.json")
    extra = {}
    if os.path.exists(path):
        extra = {norm(k): v for k, v in json.load(open(path, encoding="utf-8")).items()}
    for w in words:
        if w["example"]:
            w["exampleBy"] = "chat"
        elif extra.get(norm(w["en"])):
            w["example"] = extra[norm(w["en"])]
            w["exampleBy"] = "claude"
        else:
            w["exampleBy"] = ""
        w["cloze"] = find_cloze(w["en"], w["example"]) if w["example"] else ""
    return words


PLACEHOLDER = {"someone", "somebody", "something", "smb", "smth", "sb", "sth", "one's", "one’s", "someone's", "your", "my", "doing"}


def find_cloze(en, example):
    """The exact piece of `example` that corresponds to the word, so games can blank it out ("" if not found)."""
    base = re.sub(r"\([^)]*\)", " ", en)
    base = re.split(r"\s*/+\s*|,", base)[0]  # "catch one's eye / catch one's attention" -> first variant
    base = re.sub(r"^\s*(to|a|an|the)\s+", "", base.strip(), flags=re.I)
    base = re.sub(r"^(be|get)\s+(?=\w)", "", base, flags=re.I) if len(base.split()) > 1 else base  # "be proud of" ~ "I'm proud of"
    tokens = re.findall(r"[A-Za-z0-9'’-]+", base)
    if not tokens:
        return ""
    parts = []
    for t in tokens:
        if t.lower() in PLACEHOLDER:
            parts.append(r"[\w'’-]+(?:\s+[\w'’-]+)??")
            continue
        t = t.replace("’", "'")
        stem = t if len(t) <= 4 else t[: max(4, len(t) - 2)]
        stem = re.escape(stem).replace("'", "['’]")
        # irregular-ish endings: try→tried, make→making, stop→stopped
        if len(t) > 3 and t[-1] in "ye":
            stem = re.escape(t[:-1]).replace("'", "['’]")
        parts.append(stem + r"[\w'’]*")
    pattern = r"(?<![\w'’])" + r"\s+".join(parts) + r"(?![\w])"
    m = re.search(pattern, example, flags=re.I)
    return m.group(0) if m else ""


def main():
    args = sys.argv[1:]
    tutor = None
    if "--tutor" in args:
        i = args.index("--tutor")
        tutor = args[i + 1]
        del args[i:i + 2]
    folder = args[0] if args else os.path.join(ROOT, "data", "raw")
    msgs = load_messages(folder)
    tutor = tutor or detect_tutor(msgs)
    words = apply_examples(apply_overrides(extract(msgs, tutor)))
    words.sort(key=lambda w: w["date"])

    with open(os.path.join(ROOT, "data", "words.json"), "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "js", "words.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by scripts/extract_words.py — do not edit by hand.\n")
        f.write("window.WORDS = " + json.dumps(words, ensure_ascii=False) + ";\n")

    no_ru = [w["en"] for w in words if not w["ru"]]
    print(f"{len(msgs)} messages -> {len(words)} words "
          f"({sum(w['source'] == 'tutor' for w in words)} from tutor, "
          f"{sum(w['source'] == 'homework' for w in words)} from homework, "
          f"{sum(bool(w['example']) for w in words)} with examples)")
    print(f"Date range: {words[0]['date']} .. {words[-1]['date']}")
    by = lambda src: [w for w in words if w["exampleBy"] == src]
    for src in ("chat", "claude"):
        lst = by(src)
        print(f"Examples from {src}: {len(lst)}, blank found in {sum(bool(w['cloze']) for w in lst)}")
    no_ex = [w["en"] for w in words if not w["example"]]
    if no_ex:
        print(f"{len(no_ex)} words without example (add to data/examples.json)")
    bad = [w["en"] for w in by("claude") if not w["cloze"]]
    if bad:
        print("Claude examples where the word wasn't found: " + ", ".join(bad))
    if no_ru:
        print(f"{len(no_ru)} words without translation (add to data/overrides.json):")
        print("  " + ", ".join(no_ru))


if __name__ == "__main__":
    main()
