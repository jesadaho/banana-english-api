"""Pre-implementation QA for Adventure A2 pools + vocabulary.
python3 qa.py            -> full report, exit 1 if any ERROR
Checks
 E1 structure: required fields per type, non-empty strings, pool size (4–7; story_bites/explain_it = 3)
 E2 node `say` appears in its pool (en or accept)
 E3 duplicates: identical en twice in a node; identical Thai prompt with different answers
 E4 evidence: listen_up/story_bites answer key words appear in the audio script; numbers in see_and_say answers appear in the picture
 E5 grammar timing: structures used in pools before the chapter/node that teaches them
 E6 vocabulary gate (vocabgate.py) for pools  +  E7 the same gate for non-pool speaking text (emoji_speak items, conversation/lesson/scenario `say`)
 E8 cast: banned names, Bee/Capy pronouns, Nina before 8.10, Torto before 16.11
 E9 node rules: same-type adjacency, new_words -> say_it, chapter ≤ 12, new_words ≤ 4 items (list view ≤ 5)
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
SHAPE = {"say_it": ("th", "en"), "see_and_say": ("pic", "en"), "listen_up": ("audio", "q", "en"), "story_bites": ("audio", "q", "en"), "explain_it": ("pic", "en")}
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
            if k > 1 and t not in ("story_bites", "listen_up"): err("E3", f"{c}: duplicate answer '{e}'")
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
        if t in ("listen_up", "story_bites"):
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
# E5 grammar timing: structure may be used only from the first node (in its chapter) whose teach bolds the structure
G = [
 ("was/were", r"\b(was|were)\b", 15, r"was|were"),
 ("past -ed", r"\b(watched|played|cooked|visited|stayed|enjoyed)\b", 15, r"-ed|watched"),
 ("irregular past", r"\b(went|ate|bought|gave)\b", 16, r"went|bought|gave"),
 ("did-question", r"\b[Dd]id (you|he|she|they|we|May|Bogy)\b", 17, r"Did you"),
 ("going to", r"\b(am|is|are|'m|'s|'re) going to\b", 7, r"going to"),
 ("will", r"\b(will|I'll|we'll|you'll|won't)\b", 6, r"will|I'll"),
 ("comparative", r"\b(cheaper|bigger|smaller|better|more \w+ than)\b", 13, r"-er|cheaper|than"),
 ("superlative", r"\bthe (cheapest|biggest|best|most \w+)\b", 14, r"-est|cheapest|the most"),
 ("have to", r"\b(have to|has to|don't have to)\b", 17, r"have to"),
 ("should", r"\b(should|shouldn't)\b", 22, r"should"),
 ("if-clause", r"\bIf\b.*\bwill\b|\bif it\b", 21, r"If it"),
 ("present perfect", r"\b(I've|you've|we've|has been|have been|Have you ever|haven't)\b", 26, r"Have you ever|I've"),
 ("past continuous", r"\b(was|were) (?!(?:exciting|interesting|boring|tiring|amazing|relaxing|a bit|really|very)\b)\w+ing\b", 27, r"was / were \+ -ing|was waiting|were \+ -ing"),
 ("must", r"\b(must|mustn't)\b", 28, r"must"),
 ("already/yet", r"\b(already|yet)\b", 30, r"already|yet"),
 ("passive was stolen", r"\b(was|were|Was) (it |they )?stolen\b", 23, r"was stolen"),
]
CH = lambda c: int(c.split(".")[0])
START = {}
for name, rx, ch, key in G:
    cand = [n["code"] for n in N if CH(n["code"]) == ch and n["type"] in ("lesson", "new_words") and re.search(r"\*\*[^*]*(" + key + r")[^*]*\*\*", n["teach"])]
    START[name] = cand[0] if cand else None
    if not cand: err("E5", f"rule '{name}': no teaching lesson found in chapter {ch}")
for c, items in P.items():
    for i, it in enumerate(items):
        txt = " ".join([it.get("en", "")] + it.get("accept", []) + ([it["audio"]] if it.get("audio") and it["audio"] != "(คลิปเดิม)" else []))
        for name, rx, ch, key in G:
            if name == "have to" and CH(c) == 7: continue  # "Sorry, I have to…" taught as a chunk in ch7
            s = START.get(name)
            if s and re.search(rx, txt) and order[c] < order[s]:
                err("E5", f"{c}#{i}: uses {name} before {s}: '{it['en'][:60]}'")
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
        txt = re.sub(r"\b(Driver Uncle Somchai|DJ Coco|Aunt Noi)\b", " ", txt)
        miss = sorted({w.lower() for w in re.findall(r"[A-Za-z][A-Za-z'’]*", txt) if not known(w)} - {"emoji", "lesson", "tense"})
        if miss: err("E7", f"{n['code']} {n['type']}: {', '.join(miss)}")
for c, i, m in V.run(): err("E6", f"{c}#{i}: {', '.join(m)}")
# E8 cast
DEBUT = {
    # Nina debuts on the locked chapter-8 finale scenario, not a story bite.
    "Nina": next(n["code"] for n in N if CH(n["code"]) == 8 and n["type"] == "interactive_scenario" and "Nina" in n["teach"]),
    "Torto": next(n["code"] for n in N if CH(n["code"]) == 16 and n["type"] == "story_bites" and "Torto" in n["teach"]),
}
BAN = ["Coach Ben", "Biscuit", "Pa Daeng", "Leo", "Chef Kai", "Bella", "Mae Pim", "Officer Sam", "Ms. Rosa", "Mr. Lim", "Dr. Ana", "Officer Kim", "Jess", "Mr. Chen", "Ms. Joy", "Minnie", "Bogie", "Sunny:"]
for c, items in P.items():
    s = json.dumps(items, ensure_ascii=False)
    for b in BAN:
        if re.search(r"(?<![A-Za-z])" + re.escape(b) + r"(?![A-Za-z])", s): err("E8", f"{c}: banned name {b}")
    for it in items:
        e = it["en"]
        if re.search(r"\b(Capy|Teacher Bee)\b[^.?!]*\b(he|she|his|her|him)\b", e, re.I): err("E8", f"{c}: pronoun for Bee/Capy: '{e}'")
    if "Nina" in s and order[c] < order[DEBUT["Nina"]]: err("E8", f"{c}: Nina before {DEBUT['Nina']}")
    if "Torto" in s and order[c] < order[DEBUT["Torto"]]: err("E8", f"{c}: Torto before {DEBUT['Torto']}")
# E9 node rules
cc = collections.Counter(n["code"].split(".")[0] for n in N)
for k, v in cc.items():
    if v > 12: err("E9", f"chapter {k}: {v} nodes")
for a, b in zip(N, N[1:]):
    if a["code"].split(".")[0] == b["code"].split(".")[0]:
        # 8.9 is the zone checkpoint; 8.10 is the locked Nina debut right after it.
        if a["type"] == b["type"] and (a["code"], b["code"]) != ("8.9", "8.10"):
            err("E9", f"{a['code']}–{b['code']} same type")
        if (a["type"], b["type"]) == ("new_words", "say_it"):
            # Match E11: More Words can practise a pattern already taught in this chapter.
            prior_lesson = any(m["type"] == "lesson" and CH(m["code"]) == CH(a["code"]) for m in N[:N.index(a)])
            if not (a.get("moreWords") and prior_lesson):
                err("E9", f"{a['code']}→{b['code']} new_words→say_it")
for n in N:
    if n["type"] == "new_words":
        segs = re.findall(r"\*\*(.+?)\*\*", n["teach"])
        items = [x for s in segs[:1] for x in s.split("·") if x.strip()]
        if len(items) > (5 if n.get("listView") else 4): W.append(f"{n['code']}: new_words has {len(items)} items")
PHR = re.compile(r"[!?.…/+]|\b(get|look|pick|come|hold|hang|take|have|do|make|find|give|call|keep|see you|next|last|this|another)\s", re.I)
GRAM = set("went ate bought gave saw took put lost left forgot found came got been seen eaten tried visited done met always usually sometimes never often rarely yesterday ago earlier later".split())
for k, n in enumerate(N):
    if n["type"] != "new_words": continue
    segs = re.findall(r"\*\*(.+?)\*\*", n["teach"])
    items = [x.strip() for x in (segs[0] if segs else "").split("·") if x.strip()]
    # List-view packs teach a closed scale (always … never) as one set, so grammar words are allowed.
    max_items = 5 if n.get("listView") else 4
    if not 3 <= len(items) <= max_items: err("E10", f"{n['code']}: new_words should have 3–{max_items} items, has {len(items)}")
    for it in items:
        if PHR.search(it + " ") or (it.lower() in GRAM and not n.get("listView")) or len(it.split()) > (3 if n.get("listView") else 2):
            err("E10", f"{n['code']}: '{it}' is a phrase / grammar form, not a noun-verb material word")
    ROOT_OK = {"evening", "morning", "meeting", "building", "ceiling", "bed", "red", "shed", "iced", "exciting", "boring", "amazing", "crowded", "missing", "interesting", "tired"}  # adjectives that are words in their own right
    for it in items:
        w = it.lower().split()[-1]
        if w not in ROOT_OK and (w.endswith("ing") or w.endswith("ed") or (w in GRAM and not n.get("listView"))):
            err("E12", f"{n['code']}: '{it}' is not a root form — teach the root (cook, swim) and the -ing/-ed form inside the lesson")
    nxt = N[k + 1] if k + 1 < len(N) else None
    prev_lesson = any(m["type"] == "lesson" for m in N[:k] if CH(m["code"]) == CH(n["code"]))
    is_material = nxt and CH(nxt["code"]) == CH(n["code"]) and nxt["type"] == "lesson"
    is_more = nxt and CH(nxt["code"]) == CH(n["code"]) and prev_lesson and nxt["type"] in ("say_it", "emoji_speak", "see_and_say") and n.get("moreWords")
    if not (is_material or is_more):
        err("E11", f"{n['code']}: new_words must be followed by its lesson, or be a More Words node (`moreWords: true`) placed after the lesson and followed by practice of that pattern")

# E13 lesson flows (V7 legacy-flow format): teach a small chunk, check recognition often, then transfer
LF = {n["code"]: n["flow"] for n in N if n.get("flow")}
taught2 = set()
for n in N:
    taught2 |= V.taught_words(n["teach"])
    if n["type"] in ("new_words", "lesson"):
        for w in re.findall(r"[A-Za-z][A-Za-z'’]*", n["say"]): taught2 |= V.norm(w)
    if n["type"] != "lesson": continue
    c = n["code"]; fl = LF.get(c)
    if not fl: err("E13", f"{c}: lesson has no authored flow"); continue
    st = fl.get("steps", [])
    if n.get("handAuthoredFlow"): continue  # owner-written flow; shape rules E13–E15 don't apply
    if not 8 <= len(st) <= 12: err("E13", f"{c}: flow has {len(st)} steps (8–12)")
    kinds = [s.get("kind") for s in st]
    if not st or not (kinds[0] in ("task", "listen") or (kinds[0] == "choice" and st[0].get("answerMode") == "single")): err("E13", f"{c}: flow must open with a warm-up check, a model/repeat task or a short listen intro")
    if not st or kinds[-1] != "finish": err("E13", f"{c}: flow must end with finish")
    singles = [s for s in st if s.get("kind") == "choice" and s.get("answerMode") == "single"]
    if len(singles) < 2: err("E13", f"{c}: needs ≥ 2 single-answer recognition checks, has {len(singles)}")
    run = 0
    for s in st:
        run = run + 1 if s.get("kind") == "task" else 0
        if run > 2: err("E13", f"{c}: more than 2 model/repeat tasks in a row without a recognition check"); break
    for i, s in enumerate(st):
        k2 = s.get("kind")
        if k2 not in ("task", "choice", "listen", "finish"): err("E13", f"{c}#{i}: unknown kind {k2}")
        if not str(s.get("text", "")).strip(): err("E13", f"{c}#{i}: missing Thai teacher text")
        if k2 in ("task", "choice") and not str(s.get("expectedSpeech", "")).strip(): err("E13", f"{c}#{i}: missing expectedSpeech")
        if k2 == "choice":
            ops = s.get("options", [])
            if not 2 <= len(ops) <= 4: err("E13", f"{c}#{i}: choice needs 2–4 options")
            if s.get("answerMode") == "single":
                if s.get("expectedSpeech") not in [o.get("speak") for o in ops]: err("E13", f"{c}#{i}: expectedSpeech is not one of the options")
                if not s.get("incorrectHintTh") or not s.get("successText"): err("E13", f"{c}#{i}: single choice needs successText and incorrectHintTh")
        eng = " ".join([s.get("expectedSpeech", "")] + [o.get("speak", "") + " " + o.get("label", "") for o in s.get("options", [])])
        eng = re.sub(r"\b(Driver Uncle Somchai|DJ Coco|Aunt Noi|Sky Grill)\b", " ", eng)
        miss = sorted({w.lower() for w in re.findall(r"[A-Za-z][A-Za-z'’]*", eng) if not (V.norm(w) & (V.A1 | V.FUNC | V.NAMES | V.LOAN | taught2))})
        if miss: err("E13", f"{c}#{i}: untaught English in flow: {', '.join(miss)}")
    # E14 old-Adventure strengths: hidden-answer recall, learner asks, character asks the learner
    def _w(x): return " ".join(re.findall(r"[a-z']+", x.lower().replace("’", "'")))
    recalls = []; asks = []
    for i, s in enumerate(st):
        if s.get("kind") != "task": continue
        ex = _w(s.get("expectedSpeech", ""))
        if ex and ex not in _w(s.get("text", "")):
            recalls.append(i)
            nxt = st[i + 1] if i + 1 < len(st) else {}
            if ex not in _w(nxt.get("text", "")): err("E14", f"{c}#{i}: recall task must be revealed at the start of the next step's text (“{s.get('expectedSpeech')}”)")
            if i < 3: err("E14", f"{c}#{i}: recall comes before the pattern is modelled (put it after step 3)")
        if s.get("expectedSpeech", "").strip().endswith("?"):
            asks.append(i)
            nxt = st[i + 1] if i + 1 < len(st) else {}
            if nxt.get("kind") != "listen" or not re.search(r"“[^”]*[A-Za-z][^”]*”", nxt.get("text", "")): err("E14", f"{c}#{i}: after the learner asks, the next step must be a listen where a character answers in English “…”")
    if not [i for i in recalls if not st[i].get("expectedSpeech", "").strip().endswith("?")]: err("E14", f"{c}: needs ≥ 1 recall task (Thai cue only, English answer hidden) for a statement")
    if not [i for i in asks if i in recalls]: err("E14", f"{c}: needs ≥ 1 learner-ask task where the question itself is hidden (Thai cue only)")
    anys = [s for s in st if s.get("kind") == "choice" and s.get("answerMode") == "any"]
    if not any(re.search(r"“[^”]*\?[^”]*”", s.get("text", "")) for s in anys): err("E14", f"{c}: needs a personal 'any' choice where a character asks the learner an English question in “…?”")
    for s in st:
        if s.get("kind") in ("listen", "task", "choice"):
            le = " ".join(q for q in re.findall(r"“([^”]*)”", s.get("text", "")) if re.search(r"[A-Za-z]", q) and not re.search(r"[\u0E00-\u0E7F]", q))
            le = re.sub(r"\b(Driver Uncle Somchai|DJ Coco|Aunt Noi|Sky Grill)\b", " ", le)
            miss = sorted({w.lower() for w in re.findall(r"[A-Za-z][A-Za-z'’]*", le) if not (V.norm(w) & (V.A1 | V.FUNC | V.NAMES | V.LOAN | taught2))})
            if miss: err("E14", f"{c}: untaught English quoted in teacher text: {', '.join(miss)}")
    if sum(1 for s in st if s.get("kind") == "listen") > 3: err("E14", f"{c}: at most 3 listen steps")
    # E15 philosophy: patterns + use, no academic grammar talk, playful not stressful
    JARGON = ["ประโยคปฏิเสธ","ประโยคบอกเล่า","ประโยคคำถาม","กริยา","ช่อง 2","ช่อง 3","tense","Tense","Past Simple","Present Simple","Continuous","Perfect","เอกพจน์","พหูพจน์","นับได้","นับไม่ได้","ประธาน","คำนาม","คุณศัพท์","วิเศษณ์","ไวยากรณ์","อดีต","ผิดรูป","ผันรูป","ขั้นกว่า","ขั้นสุด","ตัด e","ตัว e","ลงท้ายด้วย","สรรพนาม","บุรุษ"]
    for i, s in enumerate(st + [{"text": fl.get("goalTh", "") + " " + fl.get("titleTh", "") + " " + n["title"]}]):
        t = s.get("text", "") + " " + s.get("incorrectHintTh", "") + " " + s.get("successText", "")
        hit = [j for j in JARGON if j in t] + (["เติม -…"] if re.search(r"เติม\s*-?\s*(ing|ed|es|s|ies|er|est)\b", t) else [])
        if hit: err("E15", f"{c}#{i}: grammar jargon in learner text: {', '.join(hit)}")
        if i > 0 and s.get("answerMode") == "single" and re.search(r"คำไหน|รูปไหน|ใช้อะไร|เริ่มด้วย", s.get("text", "")): err("E15", f"{c}#{i}: check is framed as a form question — frame it by situation/meaning (who says what)")
tot = sum(len(v) for v in E.values())
for k in sorted(E):
    print(f"== {k}: {len(E[k])}")
    for m in E[k][:60]: print("  ", m)
print(f"== warnings: {len(W)}")
for m in W[:40]: print("  ", m)
print(f"ERRORS: {tot} · nodes {len(N)} · pool nodes {len(P)} · items {sum(len(v) for v in P.values())}")
sys.exit(1 if tot else 0)
