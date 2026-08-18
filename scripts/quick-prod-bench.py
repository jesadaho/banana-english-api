#!/usr/bin/env python3
"""Quick production benchmark — no Node required."""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Set, Tuple

API_BASE = os.environ.get(
    "API_BASE", "https://banana-english-api-production.up.railway.app"
).rstrip("/")
TAP = "__TAP_TO_CONTINUE__"
EMOJI_DONE = "__EMOJI_SPEAK_COMPLETE__"

# Happy-path speech per lesson (subset). Fallback uses expectedSpeech from API.
LESSON_SPEECH: dict[str, list[str]] = {
    "greetings": [
        "Hello",
        "Hi",
        "Hi",
        "Good morning",
        "Good afternoon",
        "Good evening",
        "Good morning",
        "Hello",
    ],
}


def req(method: str, path: str, body: Optional[dict], anon: str) -> Tuple[int, dict, float]:
    url = f"{API_BASE}{path}"
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Anonymous-User-Id": anon,
        "X-Chat-Debug": "1",
    }
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(r, timeout=120) as res:
            raw = res.read().decode()
            ms = (time.perf_counter() - t0) * 1000
            return res.status, json.loads(raw) if raw else {}, ms
    except urllib.error.HTTPError as e:
        ms = (time.perf_counter() - t0) * 1000
        raw = e.read().decode()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw[:500]}
        return e.code, payload, ms


def pick_speech(turn: dict, lesson_id: str, step_idx: int) -> Optional[str]:
    if turn.get("isTaskComplete"):
        return None
    if turn.get("expectsUserSpeech") is False:
        if turn.get("emojiSpeakSet"):
            return EMOJI_DONE
        return TAP
    scripted = LESSON_SPEECH.get(lesson_id)
    if scripted and step_idx < len(scripted):
        return scripted[step_idx]
    exp = (turn.get("expectedSpeech") or "").strip()
    if exp:
        return exp
    gs = turn.get("guidedSpeaking") or {}
    if gs.get("speak"):
        return gs["speak"]
    for o in gs.get("options") or []:
        if o.get("speak"):
            return o["speak"]
    ec = turn.get("emojiChoice") or {}
    for o in ec.get("options") or []:
        if o.get("speak"):
            return o["speak"]
        if o.get("label"):
            return o["label"]
    es = turn.get("emojiSpeak") or {}
    if es.get("answer"):
        return es["answer"]
    return "I'm ready"


def parse_turn(payload: dict) -> dict:
    block = payload.get("opening") or payload
    return {
        "currentTurn": block.get("currentTurn", 0),
        "progressTurn": block.get("progressTurn"),
        "progressMax": block.get("progressMax"),
        "expectsUserSpeech": block.get("expectsUserSpeech"),
        "expectedSpeech": block.get("expectedSpeech"),
        "isTaskComplete": block.get("isTaskComplete", False),
        "aiResponse": block.get("aiResponse", ""),
        "guidedSpeaking": block.get("guidedSpeaking"),
        "emojiChoice": block.get("emojiChoice"),
        "emojiSpeakSet": block.get("emojiSpeakSet"),
        "emojiSpeak": block.get("emojiSpeak"),
        "aiDebug": block.get("aiDebug") or payload.get("aiDebug"),
    }


def run_lesson(lesson_id: str) -> Dict[str, Any]:
    anon = f"prod-bench-{lesson_id}-{int(time.time())}"
    timings: List[float] = []
    sources: List[str] = []
    gemini_ms: List[int] = []
    handler_ms: List[int] = []
    errors: List[str] = []

    _, _, _ = req("POST", "/users/me/debug/refill-bananas", None, anon)

    code, start_json, ms = req(
        "POST",
        "/sessions",
        {"sessionType": "training", "lessonId": lesson_id, "teachingLanguage": "thai"},
        anon,
    )
    timings.append(ms)
    if code != 201 and code != 200:
        return {"lessonId": lesson_id, "ok": False, "error": f"start {code}: {start_json}"}

    session = start_json.get("session") or {}
    session_id = session.get("id")
    engine = session.get("engineVersion")
    turn = parse_turn(start_json)
    dbg = turn.get("aiDebug") or {}
    sources.append(str(dbg.get("source", "?")))
    if isinstance(dbg.get("geminiMs"), (int, float)):
        gemini_ms.append(int(dbg["geminiMs"]))
    if isinstance(dbg.get("handlerMs"), (int, float)):
        handler_ms.append(int(dbg["handlerMs"]))

    step_idx = 0
    max_steps = 35
    seen: Set[str] = set()

    while not turn.get("isTaskComplete") and step_idx < max_steps:
        speech = pick_speech(turn, lesson_id, step_idx)
        if not speech:
            break
        sig = f"{turn['currentTurn']}|{speech}"
        if sig in seen:
            errors.append(f"stuck at turn {turn['currentTurn']} speech={speech}")
            break
        seen.add(sig)

        code, res_json, ms = req(
            "POST",
            f"/sessions/{session_id}/turn",
            {
                "userSpeechText": speech,
                "currentTurn": turn["currentTurn"],
                "generateAudio": False,
            },
            anon,
        )
        timings.append(ms)
        if code not in (200, 201):
            errors.append(f"turn {code}: {res_json}")
            break

        turn = parse_turn(res_json)
        dbg = turn.get("aiDebug") or {}
        sources.append(str(dbg.get("source", "?")))
        if isinstance(dbg.get("geminiMs"), (int, float)):
            gemini_ms.append(int(dbg["geminiMs"]))
        if isinstance(dbg.get("handlerMs"), (int, float)):
            handler_ms.append(int(dbg["handlerMs"]))
        step_idx += 1

    completed = bool(turn.get("isTaskComplete"))
    avg = sum(timings) / len(timings) if timings else 0
    scripted_n = sum(1 for s in sources if s == "scripted")
    return {
        "lessonId": lesson_id,
        "ok": completed and not errors,
        "completed": completed,
        "engineVersion": engine,
        "turns": step_idx,
        "apiCalls": len(timings),
        "avgMs": round(avg),
        "minMs": round(min(timings)) if timings else 0,
        "maxMs": round(max(timings)) if timings else 0,
        "totalMs": round(sum(timings)),
        "avgGeminiMs": round(sum(gemini_ms) / len(gemini_ms)) if gemini_ms else 0,
        "avgHandlerMs": round(sum(handler_ms) / len(handler_ms)) if handler_ms else 0,
        "scriptedTurns": scripted_n,
        "geminiTurns": sum(1 for s in sources if s == "gemini"),
        "sources": sources,
        "timingsMs": [round(t) for t in timings],
        "errors": errors,
    }


def main() -> None:
    raw = os.environ.get("LESSON_IDS", "greetings")
    lessons = [s.strip() for s in raw.split(",") if s.strip()]
    print(f"API: {API_BASE}")
    print(f"Lessons: {', '.join(lessons)}\n")

    results = []
    for lid in lessons:
        print(f"Running {lid}…", flush=True)
        r = run_lesson(lid)
        results.append(r)
        status = "OK" if r.get("ok") else "FAIL"
        eng = r.get("engineVersion")
        eng_s = f" v{eng}" if eng else ""
        print(
            f"  [{status}] {lid}{eng_s}: "
            f"avg={r.get('avgMs')}ms total={r.get('totalMs')}ms "
            f"calls={r.get('apiCalls')} "
            f"scripted={r.get('scriptedTurns')} gemini={r.get('geminiTurns')} "
            f"completed={r.get('completed')}"
        )
        if r.get("errors"):
            print(f"  errors: {r['errors']}")
        if r.get("sources"):
            print(f"  sources: {r['sources']}")
        print()

    results.sort(key=lambda x: x.get("avgMs", 0), reverse=True)
    print("=== Summary (slowest first) ===")
    for r in results:
        print(
            f"{r['lessonId']:30} avg={r.get('avgMs', '?'):>5}ms "
            f"gemini={r.get('avgGeminiMs', 0):>5}ms "
            f"scripted={r.get('scriptedTurns', 0)}/{r.get('apiCalls', 0)} "
            f"{'OK' if r.get('ok') else 'FAIL'}"
        )


if __name__ == "__main__":
    main()
