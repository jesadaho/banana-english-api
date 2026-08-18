#!/usr/bin/env python3
"""Daily Routine near-miss unhappy tests — answers close but not happy-path pool."""
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
LESSON_ID = "ee_about_me_daily_routine"
ANON_PREFIX = os.environ.get("ANON_PREFIX", "dr-near-miss")


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
            return res.status, json.loads(raw) if raw else {}, (time.perf_counter() - t0) * 1000
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw[:500]}
        return e.code, payload, (time.perf_counter() - t0) * 1000


def parse_turn(payload: dict) -> dict:
    block = payload.get("opening") or payload
    dbg = block.get("aiDebug") or payload.get("aiDebug") or {}
    gs = block.get("guidedSpeaking") or {}
    return {
        "currentTurn": block.get("currentTurn", 0),
        "progressTurn": block.get("progressTurn"),
        "progressMax": block.get("progressMax"),
        "expectedSpeech": block.get("expectedSpeech"),
        "guidedStem": gs.get("stem"),
        "isTaskComplete": block.get("isTaskComplete", False),
        "aiResponse": (block.get("aiResponse") or "")[:220],
        "source": dbg.get("source"),
        "geminiMs": dbg.get("geminiMs"),
        "handlerMs": dbg.get("handlerMs"),
    }


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
            {"sessionType": "training", "lessonId": LESSON_ID, "teachingLanguage": "thai"},
            self.anon,
        )
        if code not in (200, 201):
            raise RuntimeError(f"start {code}: {js}")
        self.session_id = (js.get("session") or {}).get("id")
        turn = parse_turn(js)
        turn["_ms"] = ms
        return turn

    def say(self, current_turn: int, text: str) -> Tuple[dict, float]:
        assert self.session_id
        code, js, ms = req(
            "POST",
            f"/sessions/{self.session_id}/turn",
            {"userSpeechText": text, "currentTurn": current_turn, "generateAudio": False},
            self.anon,
        )
        if code not in (200, 201):
            raise RuntimeError(f"turn {code}: {js}")
        turn = parse_turn(js)
        return turn, ms


def log_step(label: str, user: str, turn: dict, ms: float) -> None:
    print(f"\n── {label} ({ms:.0f}ms, source={turn.get('source')}) ──")
    print(f"  USER:     {user!r}")
    print(f"  progress: {turn.get('progressTurn')}/{turn.get('progressMax')}")
    print(f"  expected: {turn.get('expectedSpeech')}")
    print(f"  stem:     {turn.get('guidedStem')}")
    print(f"  geminiMs: {turn.get('geminiMs')}")
    print(f"  ai:       {turn.get('aiResponse')}…")


def play(client: Client, steps: List[str], labels: Optional[List[str]] = None) -> List[dict]:
    results: List[dict] = []
    turn = client.start()
    print(f"\n  opening ({turn.get('_ms', 0):.0f}ms) expected={turn.get('expectedSpeech')}")
    current = turn["currentTurn"]
    for i, speech in enumerate(steps):
        label = labels[i] if labels and i < len(labels) else f"step {i + 1}"
        res, ms = client.say(current, speech)
        log_step(label, speech, res, ms)
        results.append({"user": speech, **res, "ms": ms})
        current = res["currentTurn"]
        if res.get("isTaskComplete"):
            break
    return results


def run_ready_near_miss() -> None:
    """Close to I'm ready but not exact happy pool."""
    c = Client(f"{ANON_PREFIX}-ready")
    c.refill()
    play(c, ["I am ready"], ["near-miss: I am ready"])


def run_vocab_near_miss_then_fix() -> None:
    """Semantic near-miss for wake up vocab."""
    c = Client(f"{ANON_PREFIX}-vocab")
    c.refill()
    results = play(
        c,
        ["I'm ready", "get up", "wake up"],
        ["happy: I'm ready", "near-miss: get up", "fix: wake up"],
    )
    last = results[-1]
    if (last.get("progressTurn") or 0) < 3:
        raise AssertionError(f"expected progress >=3 after fix, got {last.get('progressTurn')}")


def run_wake_time_near_miss() -> None:
    """Paraphrase wake time — not in happy pool."""
    c = Client(f"{ANON_PREFIX}-wake")
    c.refill()
    play(
        c,
        ["I'm ready", "wake up", "I get up at seven"],
        ["ready", "vocab", "near-miss: I get up at seven"],
    )


def run_sleep_near_miss() -> None:
    c = Client(f"{ANON_PREFIX}-sleep")
    c.refill()
    play(
        c,
        ["I'm ready", "wake up", "I wake up at 7 o'clock.", "I go to bed at 11"],
        ["ready", "vocab", "happy wake", "near-miss: go to bed"],
    )


def run_ampm_near_miss() -> None:
    c = Client(f"{ANON_PREFIX}-ampm")
    c.refill()
    play(
        c,
        [
            "I'm ready",
            "wake up",
            "I wake up at 7 o'clock.",
            "I go to sleep at 11 o'clock.",
            "seven in the morning",
        ],
        ["ready", "vocab", "wake", "sleep", "near-miss: seven in the morning"],
    )


def run_activity_near_miss() -> None:
    c = Client(f"{ANON_PREFIX}-activity")
    c.refill()
    play(
        c,
        [
            "I'm ready",
            "wake up",
            "I wake up at 7 o'clock.",
            "I go to sleep at 11 o'clock.",
            "I wake up at 7 AM.",
            "coffee every day",
        ],
        ["ready", "vocab", "wake", "sleep", "ampm", "near-miss: coffee every day"],
    )


SCENARIOS = [
    ("ready: I am ready", run_ready_near_miss),
    ("vocab: get up → wake up", run_vocab_near_miss_then_fix),
    ("wake: I get up at seven", run_wake_time_near_miss),
    ("sleep: go to bed at 11", run_sleep_near_miss),
    ("AM/PM: seven in the morning", run_ampm_near_miss),
    ("activity: coffee every day", run_activity_near_miss),
]


def main() -> None:
    print(f"API_BASE={API_BASE}\nLESSON={LESSON_ID}")
    print("Near-miss = close answer NOT in happy-path driver pool\n")
    ok = 0
    for name, fn in SCENARIOS:
        print(f"\n{'=' * 60}\nSCENARIO: {name}")
        try:
            fn()
            print(f"\n✅ {name}")
            ok += 1
        except Exception as e:
            print(f"\n❌ {name}: {e}")
    print(f"\n{'=' * 60}\nSUMMARY: {ok}/{len(SCENARIOS)} scenarios completed")
    if ok < len(SCENARIOS):
        sys.exit(1)


if __name__ == "__main__":
    main()
