#!/usr/bin/env python3
"""Parse the Linda M Cookbook .docx into one JSON file per recipe.

Usage:  python3 scripts/parse_docx.py [source/linda-m-cookbook-v4.docx]

Writes:
  src/data/recipes/<slug>.json   one per recipe (79)
  src/data/chapters.json         the 12 chapters, intros and recipe order
  src/data/open-questions.json   every "Missing — please fill in" question

Reads the Word tables directly so the Ingredients and Method columns stay
separate. Everything the family wrote is kept word for word: each ingredient,
step and note keeps its original text in `raw`/`text`, and red "missing"
phrases are recorded in `gaps` so the site can highlight them without
changing the words. Review scaffolding ("For reviewers", "Open questions",
the red notes under titles) never lands in recipe text.

Hand-curated fields (lindasTouch, occasions, tips) live in
src/data/overrides.json and are merged in at the end, so re-running the
parser never loses them.
"""
import json
import re
import sys
from pathlib import Path

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "source" / "linda-m-cookbook-v4.docx"
OUT = ROOT / "src" / "data"
RED = "C00000"

CHAPTER_SLUGS = {
    "Starters & Snacks": "starters-snacks",
    "Soups": "soups",
    "Salads": "salads",
    "Sauces & Dressings": "sauces-dressings",
    "Pasta, Dumplings & Grains": "pasta-dumplings-grains",
    "Meat": "meat",
    "Poultry": "poultry",
    "Fish & Shellfish": "fish-shellfish",
    "Vegetables & Sides": "vegetables-sides",
    "Breads & Breakfast": "breads-breakfast",
    "Desserts": "desserts",
    "Preserves, Pickles & Condiments": "preserves-pickles-condiments",
}

# Normalised contributor ids. Keys are the names as written after "From".
PEOPLE = {
    "Linda": "linda-mitchell",
    "Bob Mitchell": "bob-mitchell",
    "Karen Massimino": "karen-massimino",
    "Aunt Karen (Karen Massimino)": "karen-massimino",
    "Aunt Karen": "karen-massimino",
    "Lorraine Massimino": "lorraine-massimino",
    "Cristina": "cristina",
    "Kathy": "kathy",
    "Bill": "bill",
    "Andrew": "andrew",
    "Menaka": "menaka",
    "Angela’s mom": "angelas-mom",
    "Wendy’s mom": "wendys-mom",
    "Grandma": "grandma",
    "Mrs. Blum": "mrs-blum",
    "Alex Audino Ferrari": "alex-audino-ferrari",
}


def slugify(s: str) -> str:
    s = s.lower().replace("’", "").replace("'", "")
    s = s.replace("é", "e").replace("ñ", "n").replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def color(run):
    try:
        c = run.font.color
        if c is not None and c.type is not None and c.rgb is not None:
            return str(c.rgb)
    except Exception:
        pass
    return None


def text_and_gaps(p: Paragraph, skip_bold_lead=False):
    """Return (lead, text, gaps). `gaps` are red substrings of `text`."""
    runs = list(p.runs)
    lead = ""
    if skip_bold_lead:
        while runs and runs[0].bold:
            lead += runs[0].text
            runs = runs[1:]
    text = "".join(r.text for r in runs)
    gaps = []
    cur = ""
    for r in runs:
        if color(r) == RED:
            cur += r.text
        elif cur:
            gaps.append(cur)
            cur = ""
    if cur:
        gaps.append(cur)
    gaps = [g.strip() for g in gaps if g.strip()]
    return lead, text, gaps


def strip_lead(lead: str):
    """'Where to buy — ' -> 'Where to buy'."""
    return re.sub(r"\s*[—–-]\s*$", "", lead.strip())


# ---------- timing / yield ----------

def to_minutes(s: str):
    """'1 hr 30 min' -> 90, '1½ hr' -> 90, '20 min' -> 20, '2–2½ hr' handled by caller."""
    s = s.strip().lower()
    total = 0.0
    found = False
    for num, unit in re.findall(r"([\d½¼¾⅓⅔.]+)\s*(hr|hour|hours|min|minutes|day|days)", s):
        total += frac(num) * {"hr": 60, "hour": 60, "hours": 60, "min": 1, "minutes": 1, "day": 1440, "days": 1440}[unit]
        found = True
    return round(total) if found else None


FRAC = {"½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125}


def frac(s: str) -> float:
    s = s.strip()
    total = 0.0
    num = ""
    for ch in s:
        if ch in FRAC:
            total += FRAC[ch]
        else:
            num += ch
    if num:
        if "/" in num:
            a, b = num.split("/")
            total += float(a) / float(b)
        else:
            total += float(num)
    return total


def parse_range(s: str):
    """'8–10 min' -> (8, 10); '1 hr 30 min–2 hr 30 min' -> (90, 150); '2–2½ hr' -> (120, 150)."""
    s = s.replace("About ", "").replace("about ", "")
    s = re.split(r",| per | or ", s)[0]
    if "–" in s:
        a, b = s.split("–", 1)
        mb = to_minutes(b)
        ma = to_minutes(a)
        if ma is None and mb is not None:
            # unit only on the right: '2–2½ hr', '1–1¼ hr', '8–10 min'
            unit = re.search(r"(hr|min|days?)", b).group(1)
            ma = to_minutes(a + " " + unit)
        return (ma, mb)
    m = to_minutes(s)
    return (m, m)


def parse_yield_line(line: str):
    parts = [p.strip() for p in re.split(r"\s+·\s+", line.strip()) if p.strip()]
    yld = None
    times = []
    for part in parts:
        m = re.match(r"^(Prep|Cook|Chill|Rest|Marinate|Pickle|Soak|Drain|Rise|Freeze|Cool|Salt|Dry)\b\s*(.*)$", part)
        if m:
            label, val = m.group(1), m.group(2)
            lo, hi = parse_range(val)
            times.append({"label": label, "text": val, "min": lo, "max": hi})
        elif yld is None:
            yld = part
        else:
            times.append({"label": "", "text": part, "min": None, "max": None})
    servings = None
    if yld:
        m = re.search(r"Serves\s+(\d+)", yld)
        if m:
            servings = int(m.group(1))
    return {"text": yld, "servings": servings}, times


# ---------- ingredients ----------

QTY_RE = re.compile(
    r"^(?P<q>(?:\d+\s*)?(?:\d+/\d+|[½¼¾⅓⅔⅛])|\d+(?:\.\d+)?)"
    r"(?:\s*(?:to|–|-)\s*(?P<q2>(?:\d+\s*)?(?:\d+/\d+|[½¼¾⅓⅔⅛])|\d+(?:\.\d+)?))?"
    r"(?=[\s(]|$)"
)
UNITS = [
    "tablespoons", "tablespoon", "teaspoons", "teaspoon", "cups", "cup", "pounds", "pound", "ounces", "ounce",
    "quarts", "quart", "pints", "pint", "cloves", "clove", "sticks", "stick", "cans", "can", "pinch",
    "slices", "slice", "sprigs", "sprig", "heads", "head", "bunches", "bunch", "large", "medium", "small",
    "lb", "lbs", "oz", "g", "kg", "ml", "l", "inch", "inches", "packages", "package", "envelopes", "envelope",
    "jars", "jar", "dozen", "links", "link", "pieces", "piece", "leaves", "stalks", "stalk", "ears", "ear",
]


def parse_ingredient(raw: str):
    item = {"raw": raw}
    prefix = ""
    pm = re.match(r"^(About|about|Scant|scant|Heaping|heaping|Generous|generous) ", raw)
    if pm:
        prefix = pm.group(0)
    m = QTY_RE.match(raw[len(prefix):])
    if not m:
        return item
    q = frac(m.group("q"))
    q2 = frac(m.group("q2")) if m.group("q2") else None
    rest = raw[len(prefix) + m.end():]
    item["qty"] = q if q2 is None else [q, q2]
    item["qtyText"] = m.group(0)
    if prefix:
        item["qtyPrefix"] = prefix
    um = re.match(r"^\s+(" + "|".join(UNITS) + r")\b", rest)
    if um:
        item["unit"] = um.group(1)
    gm = re.match(r"^\s*(?:" + "|".join(UNITS) + r")?\s*\((?:about\s+)?(\d+(?:\.\d+)?)\s*(g|ml|kg)\)", rest)
    if gm:
        item["metric"] = {"qty": float(gm.group(1)), "unit": gm.group(2), "span": gm.group(0)}
    return item


# ---------- quotes ----------

QUOTE_RE = re.compile(r"“([^”]+)”\s*—\s*([A-Z][\w .’]+?)(?:,\s*([^.“]+))?$")


def extract_quotes(headnote: str):
    quotes = []
    for m in re.finditer(r"“([^”]+)”\s*—\s*([A-Z][A-Za-z.’ ]+?)(,[^“]*)?$", headnote):
        who = m.group(2).strip()
        pid = PEOPLE.get(who)
        quotes.append({
            "by": pid or slugify(who),
            "text": m.group(1),
            "context": (m.group(3) or "").lstrip(", ").strip() or None,
            "span": m.group(0),
        })
    return quotes


# ---------- main walk ----------

def main():
    d = docx.Document(str(SRC))
    body = list(d.element.body.iterchildren())

    chapters = []
    recipes = []
    chapter = None
    recipe = None
    state = None  # 'front', 'chapter-intro', 'recipe-head', 'notes', 'open-questions'
    pending_missing = False
    order = 0

    def finish():
        nonlocal recipe
        if recipe:
            recipes.append(recipe)
        recipe = None

    for el in body:
        tag = el.tag.split("}")[1]
        if tag == "p":
            p = Paragraph(el, d)
            style = p.style.name
            txt = p.text.strip()
            if style.startswith("toc") or not txt or re.fullmatch(r"\d\d", txt):
                continue
            if style == "Front Title":
                finish()
                state = "open-questions" if txt.lower().startswith("open questions") else "front"
                continue
            if state in ("front", "open-questions", None) and style != "Heading 1":
                continue
            if style == "Heading 1":
                finish()
                chapter = {"slug": CHAPTER_SLUGS[txt], "title": txt, "number": len(chapters) + 1,
                           "intro": None, "recipes": []}
                chapters.append(chapter)
                state = "chapter-intro"
                continue
            if style == "Heading 2":
                finish()
                order += 1
                recipe = {
                    "slug": slugify(txt), "title": txt, "chapter": chapter["slug"], "order": order,
                    "source": None, "contributors": [], "occasionText": None,
                    "yield": {"text": None, "servings": None}, "times": [],
                    "headnote": None, "quotes": [],
                    "ingredientGroups": [], "steps": [], "notes": [],
                    "openQuestion": None, "isBestGuess": False,
                }
                chapter["recipes"].append(recipe["slug"])
                state = "recipe-head"
                continue
            if state == "chapter-intro":
                if chapter["intro"] is None and p.runs and any(r.italic for r in p.runs):
                    chapter["intro"] = txt
                continue
            if recipe is None:
                continue
            if style == "Normal" and state == "recipe-head":
                if txt == "Notes":
                    state = "notes"
                    continue
                italic = "".join(r.text for r in p.runs if r.italic).strip()
                bold = "".join(r.text for r in p.runs if r.bold).strip()
                if italic:
                    recipe["source"] = italic
                    m = re.match(r"^From\s+(.+?)(?:\s+·\s+(.+))?$", italic)
                    if m:
                        who = m.group(1).strip()
                        recipe["contributors"] = [PEOPLE.get(who, slugify(who))]
                        recipe["contributorName"] = who
                        recipe["occasionText"] = m.group(2)
                    else:
                        recipe["occasionText"] = italic
                if bold:
                    recipe["yield"], recipe["times"] = parse_yield_line(bold)
                continue
            if style == "Normal" and txt == "Notes":
                state = "notes"
                continue
            if style == "Recipe Story":
                recipe["headnote"] = txt
                recipe["quotes"] = extract_quotes(txt)
                continue
            if style == "Missing Info":
                if txt.startswith("Missing") and "please fill in" in txt:
                    pending_missing = True
                    continue
                if pending_missing or recipe["openQuestion"] is None:
                    recipe["openQuestion"] = txt
                    recipe["isBestGuess"] = bool(re.search(r"best guess", txt, re.I))
                    pending_missing = False
                continue
            if style == "Recipe Note":
                add_note(recipe, p)
                continue
            # anything else inside a recipe is unexpected; keep a record
            recipe.setdefault("unparsed", []).append(txt)
        elif tag == "tbl" and recipe is not None:
            parse_table(Table(el, d), recipe)
            state = "after-table"
    finish()

    # merge hand-curated overrides
    overrides_path = OUT / "overrides.json"
    overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
    for r in recipes:
        ov = overrides.get("recipes", {}).get(r["slug"], {})
        r["lindasTouch"] = bool(ov.get("lindasTouch", False))
        r["lindasTouchReason"] = ov.get("lindasTouchReason")
        r["occasions"] = ov.get("occasions", [])
        r["keyIngredients"] = ov.get("keyIngredients", [])
        r["course"] = ov.get("course")
        r["cardScan"] = ov.get("cardScan")
        if ov.get("extraContributors"):
            r["contributors"] = sorted(set(r["contributors"] + ov["extraContributors"]))
        for n in r["notes"]:
            n["byLinda"] = bool(re.search(r"\bLinda", n["label"] + " " + n["text"]))
        total = 0
        for t in r["times"]:
            if t["min"] and t["label"] in ("Prep", "Cook", "Chill", "Rest", "Marinate", "Pickle", "Soak",
                                            "Drain", "Rise", "Freeze", "Cool", "Dry", "Salt"):
                total += t["min"]
        r["totalMinutes"] = total or None

    OUT.mkdir(parents=True, exist_ok=True)
    rdir = OUT / "recipes"
    rdir.mkdir(exist_ok=True)
    for f in rdir.glob("*.json"):
        f.unlink()
    for r in recipes:
        (rdir / f"{r['slug']}.json").write_text(json.dumps(r, ensure_ascii=False, indent=2) + "\n")
    (OUT / "chapters.json").write_text(json.dumps(chapters, ensure_ascii=False, indent=2) + "\n")
    oq = [{"slug": r["slug"], "title": r["title"], "chapter": r["chapter"], "question": r["openQuestion"],
           "isBestGuess": r["isBestGuess"], "gaps": sorted({g for x in all_gaps(r) for g in [x]})}
          for r in recipes if r["openQuestion"] or any(True for _ in all_gaps(r))]
    (OUT / "open-questions.json").write_text(json.dumps(oq, ensure_ascii=False, indent=2) + "\n")

    print(f"chapters: {len(chapters)}  recipes: {len(recipes)}")
    print(f"open questions: {sum(1 for r in recipes if r['openQuestion'])}  "
          f"best guesses: {sum(1 for r in recipes if r['isBestGuess'])}")
    for r in recipes:
        if r.get("unparsed"):
            print("UNPARSED in", r["slug"], r["unparsed"])


def all_gaps(r):
    for g in r["ingredientGroups"]:
        for it in g["items"]:
            yield from it.get("gaps", [])
    for s in r["steps"]:
        yield from s.get("gaps", [])
    for n in r["notes"]:
        yield from n.get("gaps", [])


def add_note(recipe, p):
    lead, text, gaps = text_and_gaps(p, skip_bold_lead=True)
    label = strip_lead(lead)
    note = {"label": label, "text": text.strip()}
    if gaps:
        note["gaps"] = gaps
    recipe["notes"].append(note)


def parse_table(t: Table, recipe):
    cells = t.rows[0].cells
    # column 0: ingredients (and occasionally Notes); column 1: method
    group = None
    in_notes = False
    for p in cells[0].paragraphs:
        style = p.style.name
        txt = p.text.strip()
        if not txt or txt == "Ingredients":
            continue
        if style == "Normal" and txt == "Notes":
            in_notes = True
            continue
        if style == "Recipe Note" or in_notes:
            add_note(recipe, p)
            continue
        if style == "Ingredient Group":
            group = {"name": txt, "items": []}
            recipe["ingredientGroups"].append(group)
            continue
        if style == "Ingredient":
            if group is None:
                group = {"name": None, "items": []}
                recipe["ingredientGroups"].append(group)
            _, text, gaps = text_and_gaps(p)
            item = parse_ingredient(text.strip())
            if gaps:
                item["gaps"] = gaps
            group["items"].append(item)
            continue
        recipe.setdefault("unparsed", []).append(txt)
    if len(cells) > 1:
        for p in cells[1].paragraphs:
            style = p.style.name
            txt = p.text.strip()
            if not txt or txt == "Method":
                continue
            if style == "Method Step":
                lead, text, gaps = text_and_gaps(p, skip_bold_lead=True)
                step = {"lead": lead.strip(), "text": text.strip()}
                if gaps:
                    step["gaps"] = gaps
                recipe["steps"].append(step)
            elif style == "Recipe Note":
                add_note(recipe, p)
            else:
                recipe.setdefault("unparsed", []).append(txt)


if __name__ == "__main__":
    main()
