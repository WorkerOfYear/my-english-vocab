"""Extract an account's vocabulary from a Google Doc of lesson notes.

Usage:
    python scripts/extract_doc_words.py <uid> <google-doc-url | path/to/doc.txt>
    python scripts/extract_doc_words.py angel "https://docs.google.com/document/d/<id>/edit"

The doc is a list of lessons, newest first. Each lesson starts with a date line ("4.11.26") followed by
"word - перевод" lines; "домашка" starts the homework part. Only "English - русский" lines are taken —
from lessons and the word lists in homework. Exercises (sentence translations, answers, poems, grammar notes)
don't fit that shape and are skipped.

Writes data/words-<uid>.json and js/words-<uid>.js: that account's own dictionary (see index.html).
Manual fixes: data/overrides-<uid>.json, same format as data/overrides.json.
Example sentences (written by Claude, the doc has none): data/examples-<uid>.json, {"word": "sentence"}.
If the word can't be found in its sentence automatically (irregular forms: shake → shook), the part to blank out
in "Вставь слово" is marked with brackets: "She [shook her head] and said no."
"""
import json
import os
import re
import sys
import unicodedata
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_words import norm, find_cloze  # same dedup key as the site (App.norm)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATE = re.compile(r"^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$")
HOMEWORK = re.compile(r"^(домашка|hw|дз|homework)\b", re.I)
CYR = re.compile(r"[А-Яа-яЁё]")
SEP = re.compile(r"\s+[-–—]\s*|\s*[-–—]\s+")
IPA = re.compile(r"\s*(\[[^\]]{1,40}\]|/[^/]{1,40}/)\s*")
EN_OK = re.compile(r"^[A-Za-z0-9(][A-Za-z0-9 '’()/.,!?&+=-]*$")


def read_doc(src):
    if src.startswith("http"):
        m = re.search(r"/document/d/([\w-]+)", src)
        if not m:
            sys.exit("Не похоже на ссылку на Google Doc")
        url = f"https://docs.google.com/document/d/{m.group(1)}/export?format=txt"
        with urllib.request.urlopen(url) as r:
            return r.read().decode("utf-8-sig")
    return open(src, encoding="utf-8-sig").read()


def strip_accents(s):
    # "percéntage" (stress mark) → "percentage"
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def parse_line(line):
    """'word [ipa] - перевод' → (en, ipa, ru) or None."""
    parts = SEP.split(line, maxsplit=1)
    if len(parts) != 2:
        return None
    en, ru = parts[0].strip(), parts[1].strip().rstrip(" .;,")
    ipa = ""
    m = IPA.search(en)
    if m:
        ipa = m.group(1)
        en = IPA.sub(" ", en).strip()
    en = re.sub(r"\s*=\s*", " / ", strip_accents(en)).strip(" ,")
    en = re.sub(r"\s+", " ", en)
    if not en or CYR.search(en) or not EN_OK.match(en) or not re.search(r"[A-Za-z]{2}", en):
        return None
    if len(en) > 60 or len(en.split()) > 8 or not CYR.search(ru) or len(ru) > 150:
        return None
    return en, ipa, re.sub(r"\s+", " ", ru)


def merge_ru(a, b):
    """'заключение' + 'заключение, вывод' → 'заключение, вывод'; different meanings are joined with '; '."""
    parts = []
    for p in [x.strip() for x in (a + ";" + b).split(";") if x.strip()]:
        if any(p.lower() in q.lower() for q in parts):
            continue
        parts = [q for q in parts if q.lower() not in p.lower()] + [p]
    out = "; ".join(parts)
    return out if len(out) <= 150 else a


def extract(text):
    words, order = {}, []
    date, source = None, "tutor"
    for raw in text.split("\n"):
        line = raw.replace(" ", " ").strip()
        if not line:
            continue
        m = DATE.match(line)
        if m:
            d, mo, y = (int(x) for x in m.groups())
            date, source = f"{y + 2000 if y < 100 else y:04d}-{mo:02d}-{d:02d}", "tutor"
            continue
        if HOMEWORK.match(line):
            source = "homework"
            continue
        if not date:
            continue
        parsed = parse_line(line)
        if not parsed:
            continue
        en, ipa, ru = parsed
        key = norm(en)
        if key in words:
            w = words[key]
            w["ru"] = merge_ru(w["ru"], ru)
            w["ipa"] = w["ipa"] or ipa
            if date < w["date"]:  # the doc is newest first: keep the date it first came up
                w["date"], w["source"] = date, source
            continue
        words[key] = {"en": en, "ru": ru, "def": "", "ipa": ipa, "example": "", "date": date, "source": source}
        order.append(key)
    return [words[k] for k in order]


def apply_overrides(words, uid):
    path = os.path.join(ROOT, "data", f"overrides-{uid}.json")
    if not os.path.exists(path):
        return words
    over = {norm(k): v for k, v in json.load(open(path, encoding="utf-8")).items()}
    out = []
    for w in words:
        o = over.get(norm(w["en"]))
        if o and o.get("skip"):
            continue
        if o:
            w.update({k: v for k, v in o.items() if k != "skip"})
        out.append(w)
    # A fixed typo can turn into a word that is already there ("sing" → "sign"): keep one, with both meanings.
    merged = {}
    for w in out:
        key = norm(w["en"])
        if key not in merged:
            merged[key] = w
            continue
        m = merged[key]
        m["ru"] = merge_ru(m["ru"], w["ru"])
        m["date"] = min(m["date"], w["date"])
    return list(merged.values())


def cloze_for(en, example):
    """(sentence, the piece of it to blank out). Brackets in the sentence mark that piece by hand."""
    if "[" in example:
        # one span, or a split phrase: "[called] their son [after]" → blank "called their son after"
        start, end = example.index("["), example.rindex("]")
        piece = example[start:end + 1].replace("[", "").replace("]", "")
        return example.replace("[", "").replace("]", ""), piece
    found = find_cloze(en, example)
    if found:
        return example, found
    # "remember to V", "stop V-ing", "get + V3": the grammar slot is any word; "a / b": try each variant.
    base = re.sub(r"\b(V-ing|V3|V)\b|\s\+\s", " smth ", re.sub(r"\([^)]*\)", " ", en))
    for variant in re.split(r"\s*/\s*", base):
        found = variant.strip() and find_cloze(variant.strip(), example)
        if found:
            return example, found
    return example, ""


def apply_examples(words, uid):
    path = os.path.join(ROOT, "data", f"examples-{uid}.json")
    extra = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    extra = {norm(k): v for k, v in extra.items()}
    for w in words:
        ex = extra.get(norm(w["en"]))
        if ex:
            w["example"], w["cloze"] = cloze_for(w["en"], ex)
            w["exampleBy"] = "claude"
        else:
            w.update(example="", exampleBy="", cloze="")
    return words


def main():
    if len(sys.argv) != 3 or not re.fullmatch(r"[a-z0-9_.-]+", sys.argv[1]):
        sys.exit(__doc__)
    uid, src = sys.argv[1], sys.argv[2]
    words = apply_examples(apply_overrides(extract(read_doc(src)), uid), uid)
    words.sort(key=lambda w: w["date"])
    with open(os.path.join(ROOT, "data", f"words-{uid}.json"), "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "js", f"words-{uid}.js"), "w", encoding="utf-8") as f:
        f.write(f"// Generated by scripts/extract_doc_words.py — the dictionary of account \"{uid}\". Do not edit by hand.\n")
        f.write("window.WORDS = " + json.dumps(words, ensure_ascii=False) + ";\n")
    print(f"{len(words)} words for {uid} "
          f"({sum(w['source'] == 'tutor' for w in words)} from lessons, {sum(w['source'] == 'homework' for w in words)} from homework), "
          f"{words[0]['date']} .. {words[-1]['date']}; "
          f"{sum(bool(w['example']) for w in words)} with examples, {sum(bool(w['cloze']) for w in words)} playable in cloze")
    nocloze = [w["en"] for w in words if w["example"] and not w["cloze"]]
    if nocloze:
        print("Word not found in its example (mark it with [brackets]): " + ", ".join(nocloze))


if __name__ == "__main__":
    main()
