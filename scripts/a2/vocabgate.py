"""Vocabulary gate for Adventure A2.
Every English word a learner must SAY or HEAR in a pool (answers, accepted answers, audio scripts)
must be (a) taught in A1 V7, (b) taught in A2 at or before that node (bold items in node text),
(c) a function word / number, (d) a name, or (e) a Thai loanword.
Usage: python3 vocabgate.py [first_chapter last_chapter]   -> prints violations, exit 1 if any.
"""
import json, re, sys, glob
import os
BASE = os.path.dirname(os.path.abspath(__file__)) + "/"
A1 = set(open(BASE + "a1words.txt").read().split())
FUNC = set("""a an the of to in on at for with from by and or but so if than then as about up down out off over after before into very too also not no yes just only all some any every each other another more most much many few little lot lots this that these those here there it its they them their he him his she her we us our you your i me my mine yours hers ours theirs who what where when why how which whose is am are was were be been being do does did done have has had having can could will would shall should may might must let don't doesn't didn't isn't aren't wasn't weren't won't can't couldn't haven't hasn't hadn't mustn't shouldn't i'm i'll i'd i've you're you've you'll we're we've we'll they're they've it's he's she's that's what's there's let's oh ok okay please thanks hi bye hey wow one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred first second third last next again still already yet ever never really quite bit a.m. p.m. am pm m p s t""".split())
NAMES = set("""coco dj max may mali capy john bee b nina torto minnie bogy leo kai noi bella pim sam rosa dave lim sunny ana kim jess joy chen biscuit daeng pa mae ben ms mr mrs dr aunt teacher thailand thai japan korea england singapore phuket chiang mai bangkok krabi tokyo sydney london grill bk sky""".split())
LOAN = set("café cafe caf hotel ice cream mall pizza sushi video camera football tv latte wi-fi wifi voucher boba".split())
IRR = {"stolen":"steal","went":"go","ate":"eat","bought":"buy","gave":"give","saw":"see","took":"take","lost":"lose","left":"leave","forgot":"forget","found":"find","came":"come","got":"get","had":"have","made":"make","met":"meet","seen":"see","eaten":"eat","been":"be","done":"do","told":"tell","said":"say","felt":"feel","slept":"sleep","sent":"send","broke":"break","flew":"fly","better":"good","best":"good","worse":"bad","worst":"bad","drove":"drive","fell":"fall","wrote":"write","ran":"run","sat":"sit","swam":"swim","drank":"drink","brought":"bring","thought":"think","began":"begin","could":"can","children":"child","people":"person"}
def norm(w):
    w = w.lower().strip("'’")
    out = {w, IRR.get(w, w), w + "ly"}
    for suf, rep in (("ies","y"),("ied","y"),("iest","y"),("ier","y"),("es",""),("s",""),("ed",""),("ed","e"),("d",""),("ing",""),("ing","e"),("er",""),("er","e"),("est",""),("est","e"),("'s",""),("n't","")):
        if w.endswith(suf) and len(w) > len(suf) + 1:
            stem = w[:-len(suf)] + rep; out.add(stem)
            if len(stem) > 2 and stem[-1] == stem[-2]: out.add(stem[:-1])
    return out
def load():
    C = json.load(open(BASE + "adventure-a2-course.json"))
    N = C["nodes"]; P = {n["code"]: n["pool"] for n in N if n.get("pool")}
    return N, P
def taught_words(text):
    s = set()
    for seg in re.findall(r"\*\*(.+?)\*\*", text):
        for w in re.findall(r"[A-Za-z][A-Za-z'’\-]*", seg):
            s |= norm(w)
    return s
def run(lo=1, hi=32):
    N, P = load()
    taught = set(); bad = []
    known = lambda c: bool(c & (A1 | FUNC | NAMES | LOAN | taught))
    for n in N:
        taught |= taught_words(n["teach"])
        if n["type"] in ("new_words", "lesson"):
            for w in re.findall(r"[A-Za-z][A-Za-z'’]*", n["say"]): taught |= norm(w)
        ch = int(n["code"].split(".")[0])
        for i, it in enumerate(P.get(n["code"], [])):
            if n["type"] == "explain_it": continue  # clues are free speech; only target words matter (taught on card)
            txt = " ".join([it.get("en", "")] + it.get("accept", []) + ([it["audio"]] if it.get("audio") and it["audio"] != "(คลิปเดิม)" else []))
            txt = re.sub(r"\b(Driver Uncle Somchai|DJ Coco|Aunt Noi|Sky Grill)\b", " ", txt)
            miss = sorted({w.lower() for w in re.findall(r"[A-Za-z][A-Za-z'’]*", txt) if not known(norm(w))})
            if miss and lo <= ch <= hi: bad.append((n["code"], i, miss))
    return bad
if __name__ == "__main__":
    lo, hi = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1, 32)
    bad = run(lo, hi)
    for c, i, m in bad: print(f"{c} item#{i}: {', '.join(m)}")
    print(f"TOTAL violations: {len(bad)}")
    sys.exit(1 if bad else 0)
