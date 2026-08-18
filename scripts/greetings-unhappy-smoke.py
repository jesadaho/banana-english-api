#!/usr/bin/env python3
"""Greetings v2 unhappy-path smoke on production."""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

API_BASE = os.environ.get(
    "API_BASE", "https://banana-english-api-production.up.railway.app"
).rstrip("/")
ANON_PREFIX = os.environ.get("ANON_PREFIX", "greetings-unhappy")


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


def parse_turn(payload: dict) -> dict:
    block = payload.get("opening") or payload
    dbg = block.get("aiDebug") or payload.get("aiDebug") or {}
    return {
        "currentTurn": block.get("currentTurn", 0),
        "progressTurn": block.get("progressTurn"),
        "progressMax": block.get("progressMax"),
        "expectsUserSpeech": block.get("expectsUserSpeech"),
        "expectedSpeech": block.get("expectedSpeech"),
        "isTaskComplete": block.get("isTaskComplete", False),
        "aiResponse": block.get("aiResponse", "") or "",
        "textTh": block.get("textTh", "") or "",
        "emojiChoice": block.get("emojiChoice"),
        "source": dbg.get("source"),
        "geminiMs": dbg.get("geminiMs"),
        "handlerMs": dbg.get("handlerMs"),
    }


def log_turn(label: str, turn: dict, ms: float) -> None:
    print(f"\n── {label} ({ms:.0f}ms, source={turn.get('source')}) ──")
    print(f"  turn:     {turn.get('currentTurn')}")
    print(f"  progress: {turn.get('progressTurn')}/{turn.get('progressMax')}")
    print(f"  expected: {turn.get('expectedSpeech')}")
    print(f"  complete: {turn.get('isTaskComplete')}")
    ai = (turn.get("aiResponse") or "")[:160]
    if ai:
        print(f"  ai:       {ai}…")


class Client:
    def __init__(self, anon: str):
        self.anon = anon
        self.session_id: Optional[str] = None

    def refill(self) -> None:
        req("POST", "/users/me/debug/refill-bananas", None, self.anon)

    def start(self) -> dict:
        code, js, ms = req(
            "POST",
            "/sessions",
            {"sessionType": "training", "lessonId": "greetings", "teachingLanguage": "thai"},
            self.anon,
        )
        if code not in (200, 201):
            raise RuntimeError(f"start failed {code}: {js}")
        self.session_id = (js.get("session") or {}).get("id")
        eng = (js.get("session") or {}).get("engineVersion")
        if eng != 2:
            raise RuntimeError(f"expected engineVersion=2, got {eng}")
        turn = parse_turn(js)
        log_turn("opening", turn, ms)
        return turn

    def say(self, current_turn: int, text: str, expect_ok: bool = True) -> Tuple[dict, int, float]:
        assert self.session_id
        code, js, ms = req(
            "POST",
            f"/sessions/{self.session_id}/turn",
            {"userSpeechText": text, "currentTurn": current_turn, "generateAudio": False},
            self.anon,
        )
        if expect_ok and code not in (200, 201):
            raise RuntimeError(f"turn failed {code}: {js}")
        return parse_turn(js), code, ms


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def scenario_wrong_then_fix() -> None:
    c = Client(f"{ANON_PREFIX}-fix")
    c.refill()
    turn = c.start()
    assert_true(turn["source"] == "scripted", "opening should be scripted")

    turn, _, ms = c.say(turn["currentTurn"], "hey there")
    log_turn("wrong #1 on Hello (Gemini soft-teach)", turn, ms)
    assert_true(turn["source"] == "gemini", "1st wrong should use Gemini soft-teach")
    assert_true(turn["expectedSpeech"] == "Hello", "should retry Hello after teach")
    assert_true((turn["progressTurn"] or 0) <= 1, "progress should stay at step 1")

    turn, _, ms = c.say(turn["currentTurn"], "Hello")
    log_turn("fix Hello", turn, ms)
    assert_true(turn["source"] == "scripted", "correct answer should be scripted")
    assert_true((turn["progressTurn"] or 0) >= 2, "should advance to Hi step")
    assert_true(turn["expectedSpeech"] == "Hi", "next should ask Hi")


def scenario_double_wrong_force_advance() -> None:
    c = Client(f"{ANON_PREFIX}-advance")
    c.refill()
    turn = c.start()

    turn, _, ms = c.say(turn["currentTurn"], "goodbye")
    log_turn("wrong #1 (Gemini teach)", turn, ms)
    assert_true(turn["source"] == "gemini", "1st wrong = Gemini soft-teach")

    turn, _, ms = c.say(turn["currentTurn"], "see you")
    log_turn("wrong #2 (force advance)", turn, ms)
    assert_true(
        turn["source"] == "scripted",
        f"2nd wrong should force-advance scripted, got source={turn['source']}",
    )
    assert_true(
        "ไม่เป็นไร" in turn["aiResponse"] or "move on" in (turn["textTh"] or "").lower(),
        "should gently move on",
    )
    assert_true(turn["expectedSpeech"] == "Hi", "should land on Hi step")
    assert_true((turn.get("geminiMs") or 0) == 0, "2nd wrong should not call Gemini")


def scenario_wrong_recognition_then_fix() -> None:
    c = Client(f"{ANON_PREFIX}-recog")
    c.refill()
    turn = c.start()

    for speech in ("Hello", "Hi"):
        turn, _, ms = c.say(turn["currentTurn"], speech)
        log_turn(f"happy: {speech}", turn, ms)

    # Step 3 recognition — friend scenario expects Hi
    turn, _, ms = c.say(turn["currentTurn"], "Hello")
    log_turn("wrong on recognition (said Hello)", turn, ms)
    assert_true(turn["source"] == "gemini", "1st wrong on recognition = Gemini soft-teach")
    assert_true(turn.get("emojiChoice") is not None, "should keep emojiChoice board")

    turn, _, ms = c.say(turn["currentTurn"], "Hi")
    log_turn("fix recognition", turn, ms)
    assert_true(turn["source"] == "scripted", "fix should be scripted")
    assert_true(
        (turn["expectedSpeech"] or "").lower().find("morning") >= 0
        or "morning" in (turn["aiResponse"] or "").lower(),
        "should advance toward Good morning",
    )


def scenario_stale_turn_409() -> None:
    c = Client(f"{ANON_PREFIX}-stale")
    c.refill()
    turn = c.start()
    assert c.session_id
    code, js, ms = req(
        "POST",
        f"/sessions/{c.session_id}/turn",
        {"userSpeechText": "Hello", "currentTurn": turn["currentTurn"] + 99, "generateAudio": False},
        c.anon,
    )
    assert_true(code == 409, f"expected 409, got {code}")
    msg = str(js.get("message") or js.get("detail") or "").lower()
    assert_true("stale turn" in msg, f"expected stale turn message, got {js}")
    print(f"\n── stale turn (409, {ms:.0f}ms) ── OK")


def run(name: str, fn) -> Dict[str, Any]:
    print(f"\n{'=' * 60}\nSCENARIO: {name}")
    try:
        fn()
        print(f"\n✅ {name}")
        return {"name": name, "ok": True}
    except Exception as e:
        print(f"\n❌ {name}: {e}")
        return {"name": name, "ok": False, "detail": str(e)}


def main() -> None:
    print(f"API_BASE={API_BASE}")
    results = [
        run("wrong once → Gemini teach → fix", scenario_wrong_then_fix),
        run("double wrong → force advance", scenario_double_wrong_force_advance),
        run("recognition wrong → fix", scenario_wrong_recognition_then_fix),
        run("stale turn → 409", scenario_stale_turn_409),
    ]
    print(f"\n{'=' * 60}\nSUMMARY")
    for r in results:
        mark = "✅" if r["ok"] else "❌"
        extra = f" — {r['detail']}" if r.get("detail") else ""
        print(f"  {mark} {r['name']}{extra}")
    if not all(r["ok"] for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
