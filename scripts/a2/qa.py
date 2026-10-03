"""Pre-implementation QA for Adventure A2 pools + vocabulary.
python3 qa.py            -> full report, exit 1 if any ERROR
Checks
 E1 structure: required fields per type, non-empty strings, pool size (4–7; story_bites/explain_it = 3)
 E2 node `say` appears in its pool (en or accept)
 E3 duplicates: identical en twice in a node; identical Thai prompt with different answers
 E4 evidence: hear_it/story_bites answer key words appear in the audio script; numbers in see_and_say answers appear in the picture
 E5 grammar timing: structures used in pools before the chapter/node that teaches them
 E6 vocabulary gate (vocabgate.py) for pools  +  E7 the same gate for non-pool speaking text (emoji_speak items, conversation/lesson/scenario `say`)
 E8 cast: banned names, Bee/Capy pronouns, Nina before 8.10, Torto before 16.11
 E9 node rules: same-type adjacency, new_words -> say_it, chapter ≤ 11, new_words ≤ 4 items
 W  warnings: near-duplicate answers (differ by one word) ≥ 3 pairs in a node; accept equals en
"""
import json, re, glob, sys, collections
import vocabgate as V
N, P = V.load()
by = {n["code"]: n for n in N}
order = {n["code"]: i for i, n in enumerate(N)}
E = collections.defaultdict(list); W = []
def err(k, msg): E[k].append(msg)
EVIDENCE_OK = {"16.8#3", "1.8#1", "31.5#2"}  # reviewed by hand: computed change / yes-no answers implied by the script
SHAPE = {"say_it": ("th", "en"), "see_and_say": ("pic", "en"), "hear_it": ("audio", "q", "en"), "story_bites": ("audio", "q", "en"), "explain_it": ("pic", "en")}
for n in N:
    c, t = n["code"], n["type"]
    if t in SHAPE:
        items = P.get(c)
        if not items: err("E1", f"{c} {t}: no pool"); continue
        lo, hi = (3, 3) if t in ("story_bites", "explain_it") else (4, 7)
        if not lo <= len(items) <= hi: err("E1", f"{c}: pool size {len(items)}")
        for i, it in enumerate(items):
            for f in SHAPE[t]:
                if not str(it.get(f, "")).strip(): err("E1", f"{c}#{i}: missing {f}")
            if it.get("en") in it.get("accept", []): W.append(f"{c}#{i}: accept repeats en")
        ens = [it["en"] for it in items]
        for e, k in collections.Counter(ens).items():
            if k > 1 and t not in ("story_bites", "hear_it"): err("E3", f"{c}: duplicate answer '{e}'")
        prompts = collections.defaultdict(set)
        for it in items:
            key = it.get("th") or it.get("pic") or ((it.get("audio") or "") + "|" + (it.get("q") or ""))
            prompts[key].add(it["en"])
        for k, v in prompts.items():
            if len(v) > 1: err("E3", f"{c}: same prompt → {len(v)} different answers ({k[:40]})")
        if t not in ("explain_it",) and n["say"] not in ("—", ""):
            alltxt = " ".join(ens + [a for it in items for a in it.get("accept", [])])
            if not any(p.strip() and p.strip() in alltxt for p in n["say"].split("·")): err("E2", f"{c}: say '{n['say']}' not in pool")
        def near(a, b):
            a, b = a.lower().split(), b.lower().split()
            return len(a) == len(b) and sum(x != y for x, y in zip(a, b)) <= 1
        pairs = sum(near(ens[i], ens[j]) for i in range(len(ens)) for j in range(i + 1, len(ens)))
        if pairs >= 3: W.append(f"{c}: {pairs} near-duplicate answer pairs")
        # E4 evidence
        if t in ("hear_it", "story_bites"):
            script = items[0]["audio"] if t == "story_bites" else None
            for i, it in enumerate(items):
                aud = script if t == "story_bites" else it["audio"]
                cand = [it["en"]] + it.get("accept", [])
                def ok(ans):
                    key = [w.lower() for w in re.findall(r"[A-Za-z0-9:]+", ans) if w.lower() not in V.FUNC and len(w) > 1]
                    return all(re.search(r"\b" + re.escape(k), aud.lower()) for k in key) if key else True
                if f"{c}#{i}" in EVIDENCE_OK: continue
                if not any(ok(a) for a in cand): err("E4", f"{c}#{i}: answer '{it['en']}' not found in audio")
        if t == "see_and_say":
            for i, it in enumerate(items):
                for num in re.findall(r"\d+(?::\d+)?", it["en"]):
                    if num not in it["pic"]: err("E4", f"{c}#{i}: number {num} not shown in picture")
# E5 grammar timing (first chapter.node where the structure is TAUGHT)
G = [
 ("past -ed / was", r"\b(was|were|watched|played|cooked|visited|stayed|enjoyed)\b", "15.2"),
 ("irregular past", r"\b(went|ate|bought|gave)\b", "16.6"),
 ("did-question", r"\b[Dd]id (you|he|she|they|we|May|Max)\b", "17.9"),
 ("going to", r"\b(am|is|are|'m|'s|'re) going to\b", "7.1"),
 ("will", r"\b(will|I'll|we'll|you'll|won't)\b", "6.9"),
 ("comparative", r"\b(cheaper|bigger|smaller|better|more \w+ than)\b", "13.2"),
 ("superlative", r"\b(the (cheapest|biggest|best|most \w+))\b", "14.3"),
 ("have to", r"\b(have to|has to|don't have to)\b", "17.2"),
 ("should", r"\b(should|shouldn't)\b", "22.2"),
 ("if-clause", r"\bIf\b.*\bwill\b|\bif it\b", "21.7"),
 ("present perfect", r"\b(I've|you've|we've|has been|have been|Have you ever|haven't)\b", "26.5"),
 ("past continuous", r"\b(was|were) (?!(?:exciting|interesting|boring|tiring|amazing|relaxing|a bit|really|very)\b)\w+ing\b", "27.1"),
 ("must", r"\b(must|mustn't)\b", "28.2"),
 ("already/yet", r"\b(already|yet)\b", "30.1"),
]
for c, items in P.items():
    n = by[c]
    for i, it in enumerate(items):
        txt = " ".join([it.get("en", "")] + it.get("accept", []) + ([it["audio"]] if it.get("audio") and it["audio"] != "(คลิปเดิม)" else []))
        for name, rx, first in G:
            if name == "have to" and c.startswith("7."): continue  # "Sorry, I have to…" taught as a chunk in 7.9
            if re.search(rx, txt) and order[c] < order[first]:
                err("E5", f"{c}#{i}: uses {name} before {first}: '{it['en'][:60]}'")
# E7 gate for non-pool speaking text
taught = set()
known = lambda w: bool(V.norm(w) & (V.A1 | V.FUNC | V.NAMES | V.LOAN | taught))
for n in N:
    taught |= V.taught_words(n["teach"])
    if n["type"] in ("new_words", "lesson"):
        for w in re.findall(r"[A-Za-z][A-Za-z'’]*", n["say"]): taught |= V.norm(w)
    texts = []
    if n["type"] in ("conversation", "interactive_scenario"): texts.append(n["say"])
    if n["type"] == "emoji_speak":
        texts += re.findall(r"[^\x00-\x7F\s]+\s*([A-Za-z][A-Za-z' ,.!?’-]+)", n["teach"])
    for txt in texts:
        txt = re.sub(r"\b(Driver Dave|DJ Coco|Aunt Noi)\b", " ", txt)
        miss = sorted({w.lower() for w in re.findall(r"[A-Za-z][A-Za-z'’]*", txt) if not known(w)} - {"emoji", "lesson", "tense"})
        if miss: err("E7", f"{n['code']} {n['type']}: {', '.join(miss)}")
for c, i, m in V.run(): err("E6", f"{c}#{i}: {', '.join(m)}")
# E8 cast
BAN = ["Coach Ben", "Biscuit", "Pa Daeng", "Leo", "Chef Kai", "Bella", "Mae Pim", "Officer Sam", "Ms. Rosa", "Mr. Lim", "Dr. Ana", "Officer Kim", "Jess", "Mr. Chen", "Ms. Joy", "Minnie", "Bogie", "Sunny:"]
for c, items in P.items():
    s = json.dumps(items, ensure_ascii=False)
    for b in BAN:
        if re.search(r"(?<![A-Za-z])" + re.escape(b) + r"(?![A-Za-z])", s): err("E8", f"{c}: banned name {b}")
    for it in items:
        e = it["en"]
        if re.search(r"\b(Capy|Teacher Bee)\b[^.?!]*\b(he|she|his|her|him)\b", e, re.I): err("E8", f"{c}: pronoun for Bee/Capy: '{e}'")
    if "Nina" in s and order[c] < order["8.10"]: err("E8", f"{c}: Nina before 8.10")
    if "Torto" in s and order[c] < order["16.11"]: err("E8", f"{c}: Torto before 16.11")
# E9 node rules
cc = collections.Counter(n["code"].split(".")[0] for n in N)
for k, v in cc.items():
    if v > 11: err("E9", f"chapter {k}: {v} nodes")
for a, b in zip(N, N[1:]):
    if a["code"].split(".")[0] == b["code"].split(".")[0]:
        if a["type"] == b["type"]: err("E9", f"{a['code']}–{b['code']} same type")
        if (a["type"], b["type"]) == ("new_words", "say_it"): err("E9", f"{a['code']}→{b['code']} new_words→say_it")
for n in N:
    if n["type"] == "new_words":
        segs = re.findall(r"\*\*(.+?)\*\*", n["teach"])
        items = [x for s in segs[:1] for x in s.split("·") if x.strip()]
        if len(items) > 4: W.append(f"{n['code']}: new_words has {len(items)} items")
tot = sum(len(v) for v in E.values())
for k in sorted(E):
    print(f"== {k}: {len(E[k])}")
    for m in E[k][:60]: print("  ", m)
print(f"== warnings: {len(W)}")
for m in W[:40]: print("  ", m)
print(f"ERRORS: {tot} · nodes {len(N)} · pool nodes {len(P)} · items {sum(len(v) for v in P.values())}")
sys.exit(1 if tot else 0)
