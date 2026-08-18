#!/usr/bin/env python3
"""
Daily Routine — full unhappy-path smoke (production or local).

Covers:
  1. wrong vocab → explain soft-teach → fix → finish lesson
  2. double wrong vocab → soft-advance
  3. standalone AM rejected
  4. stale turn → 409
  5. near-miss per step (get up, wake time, sleep, AM/PM, activity)

Usage:
  python3 scripts/daily-routine-unhappy-full.py
  API_BASE=http://localhost:8000 python3 scripts/daily-routine-unhappy-full.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Tuple

API_BASE = os.environ.get(
    "API_BASE", "https://banana-english-api-production.up.railway.app"
).rstrip("/")
LESSON_ID = "ee_about_me_daily_routine"
ANON_PREFIX = os.environ.get("ANON_PREFIX", "dr-unhappy-full")


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
        "aiResponse": block.get("aiResponse") or "",
        "source": dbg.get("source"),
        "geminiMs": dbg.get("geminiMs"),
        "handlerMs": dbg.get("handlerMs"),
    }


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


class Client:
    def __init__(self, anon: str):
        self.anon = anon
        self.session_id: Optional[str] = None

    def refill(self) -> None:
        req("POST", "/users/me/debug/refill-bananas", None, self.anon)

    def start(self) -> Tuple[dict, float]:
        code, js, ms = req(
            "POST",
            "/sessions",
            {"sessionType": "training", "lessonId": LESSON_ID, "teachingLanguage": "thai"},
            self.anon,
        )
        if code not in (200, 201):
            raise RuntimeError(f"start {code}: {js}")
        self.session_id = (js.get("session") or {}).get("id")
        return parse_turn(js), ms

    def say(self, current_turn: int, text: str, expect_ok: bool = True) -> Tuple[dict, int, float]:
        assert self.session_id
        code, js, ms = req(
            "POST",
            f"/sessions/{self.session_id}/turn",
            {"userSpeechText": text, "currentTurn": current_turn, "generateAudio": False},
            self.anon,
        )
        if expect_ok and code not in (200, 201):
            raise RuntimeError(f"turn {code}: {js}")
        turn = parse_turn(js) if code in (200, 201) else {}
        return turn, code, ms


def log_step(label: str, user: str, turn: dict, ms: float, code: int = 200) -> None:
    print(f"\n── {label} ({ms:.0f}ms, HTTP {code}, source={turn.get('source')}) ──")
    if user:
        print(f"  USER:     {user!r}")
    print(f"  progress: {turn.get('progressTurn')}/{turn.get('progressMax')}")
    print(f"  expected: {turn.get('expectedSpeech')}")
    print(f"  stem:     {turn.get('guidedStem')}")
    print(f"  geminiMs: {turn.get('geminiMs')}")
    ai = (turn.get("aiResponse") or "")[:240]
    if ai:
        print(f"  ai:       {ai}…")


def expect_explain_soft_teach(turn: dict, label: str) -> None:
    ai = turn.get("aiResponse") or ""
    assert_true(
        "ปกติแล้ว" in ai and ("ใช้คำว่า" in ai or "เราจะพูดว่า" in ai),
        f"{label}: expected explain soft-teach, got: {ai[:120]}",
    )
    assert_true(
        (turn.get("source") or "") == "scripted",
        f"{label}: soft-teach should be scripted, got source={turn.get('source')}",
    )
    assert_true((turn.get("geminiMs") or 0) == 0, f"{label}: should not call Gemini")


def expect_near_miss_or_reboard(turn: dict, label: str, stem: str) -> None:
    """Near-miss may soft-teach OR re-pin the same board (progress unchanged)."""
    ai = turn.get("aiResponse") or ""
    if "ปกติแล้ว" in ai and ("ใช้คำว่า" in ai or "เราจะพูดว่า" in ai):
        expect_explain_soft_teach(turn, label)
        return
    assert_true(
        turn.get("guidedStem") == stem,
        f"{label}: expected soft-teach or re-board stem={stem!r}, got {turn.get('guidedStem')!r}",
    )
    assert_true((turn.get("source") or "") == "scripted", f"{label}: should stay scripted")


def scenario_full_unhappy_to_complete() -> None:
    """One session: near-miss at each step, fix, complete lesson."""
    c = Client(f"{ANON_PREFIX}-full")
    c.refill()
    turn, ms = c.start()
    log_step("opening", "", turn, ms)
    cur = turn["currentTurn"]

    steps: List[Tuple[str, str, Optional[Callable[[dict, str], None]]]] = [
        ("ready", "I'm ready", None),
        ("near-miss vocab", "get up", expect_explain_soft_teach),
        ("fix vocab", "wake up", None),
        (
            "near-miss wake time",
            "I get up at seven",
            lambda t, l: expect_near_miss_or_reboard(t, l, "I wake up at..."),
        ),
        ("fix wake time", "I wake up at 7 o'clock.", None),
        ("near-miss sleep", "I go to bed at 11", None),  # often soft-advances to AM/PM
    ]

    for label, speech, check in steps:
        turn, _, ms = c.say(cur, speech)
        log_step(label, speech, turn, ms)
        if check:
            check(turn, label)
        cur = turn["currentTurn"]
        if turn.get("isTaskComplete"):
            break

    progress = turn.get("progressTurn") or 0
    if progress < 5:
        turn, _, ms = c.say(cur, "I go to sleep at 11 o'clock.")
        log_step("fix sleep", "I go to sleep at 11 o'clock.", turn, ms)
        cur = turn["currentTurn"]
        progress = turn.get("progressTurn") or 0

    tail: List[Tuple[str, str, Optional[Callable[[dict, str], None]]]] = [
        ("near-miss AM/PM", "seven in the morning", expect_explain_soft_teach),
        ("fix AM/PM", "I wake up at 7 AM.", None),
        ("near-miss activity", "coffee every day", expect_explain_soft_teach),
        ("fix activity", "I drink coffee every day.", None),
        ("finish", "I wake up at 7 AM every day.", None),
    ]

    for label, speech, check in tail:
        turn, _, ms = c.say(cur, speech)
        log_step(label, speech, turn, ms)
        if check:
            check(turn, label)
        cur = turn["currentTurn"]
        if turn.get("isTaskComplete"):
            break

    assert_true(turn.get("isTaskComplete") is True, "lesson should complete")
    assert_true((turn.get("progressTurn") or 0) >= 8, f"expected progress 8, got {turn.get('progressTurn')}")


def scenario_wrong_vocab_then_fix() -> None:
    c = Client(f"{ANON_PREFIX}-vocab")
    c.refill()
    turn, ms = c.start()
    cur = turn["currentTurn"]

    turn, _, ms = c.say(cur, "I'm ready")
    log_step("ready", "I'm ready", turn, ms)
    cur = turn["currentTurn"]

    turn, _, ms = c.say(cur, "go to work")
    log_step("wrong vocab", "go to work", turn, ms)
    expect_explain_soft_teach(turn, "wrong vocab")
    assert_true((turn.get("progressTurn") or 0) <= 2, "progress should stay at vocab")
    cur = turn["currentTurn"]

    turn, _, ms = c.say(cur, "wake up")
    log_step("fix vocab", "wake up", turn, ms)
    assert_true((turn.get("progressTurn") or 0) >= 3, "should advance to wake-time")


def scenario_double_wrong_soft_advance() -> None:
    c = Client(f"{ANON_PREFIX}-double")
    c.refill()
    turn, ms = c.start()
    cur = turn["currentTurn"]

    turn, _, ms = c.say(cur, "I'm ready")
    cur = turn["currentTurn"]

    turn, _, ms = c.say(cur, "go to work")
    log_step("wrong #1", "go to work", turn, ms)
    expect_explain_soft_teach(turn, "wrong #1")
    cur = turn["currentTurn"]

    turn, _, ms = c.say(cur, "go to sleep")
    log_step("wrong #2 (soft-advance)", "go to sleep", turn, ms)
    assert_true(
        (turn.get("progressTurn") or 0) >= 3,
        f"double wrong should soft-advance, progress={turn.get('progressTurn')}",
    )
    assert_true(
        turn.get("guidedStem") == "I wake up at..."
        or "wake up" in (turn.get("expectedSpeech") or "").lower(),
        "should land on wake-time board",
    )


def scenario_standalone_am_rejected() -> None:
    c = Client(f"{ANON_PREFIX}-ampm")
    c.refill()
    turn, ms = c.start()
    cur = turn["currentTurn"]

    for speech in (
        "I'm ready",
        "wake up",
        "I wake up at 7 o'clock.",
        "I go to sleep at 11 o'clock.",
    ):
        turn, _, ms = c.say(cur, speech)
        cur = turn["currentTurn"]

    turn, _, ms = c.say(cur, "AM")
    log_step("standalone AM (reject)", "AM", turn, ms)
    assert_true((turn.get("progressTurn") or 0) <= 5, "standalone AM must not finish AM/PM")
    assert_true(turn.get("isTaskComplete") is not True, "must not complete on AM")
    cur = turn["currentTurn"]

    turn, _, ms = c.say(cur, "I wake up at 7 AM.")
    log_step("fix AM/PM", "I wake up at 7 AM.", turn, ms)
    assert_true((turn.get("progressTurn") or 0) >= 6, "should advance after proper sentence")


def scenario_stale_turn_409() -> None:
    c = Client(f"{ANON_PREFIX}-stale")
    c.refill()
    turn, ms = c.start()
    _, code, ms = c.say(turn["currentTurn"] + 99, "I'm ready", expect_ok=False)
    msg = ""
    log_step("stale turn", "I'm ready (wrong turn)", {}, ms, code)
    assert_true(code == 409, f"expected 409, got {code}")


SCENARIOS = [
    ("full unhappy → complete lesson", scenario_full_unhappy_to_complete),
    ("wrong vocab → explain → fix", scenario_wrong_vocab_then_fix),
    ("double wrong → soft-advance", scenario_double_wrong_soft_advance),
    ("standalone AM rejected", scenario_standalone_am_rejected),
    ("stale turn → 409", scenario_stale_turn_409),
]


def main() -> None:
    print(f"API_BASE={API_BASE}")
    print(f"LESSON={LESSON_ID}\n")
    ok = 0
    for name, fn in SCENARIOS:
        print(f"\n{'=' * 60}\nSCENARIO: {name}")
        try:
            fn()
            print(f"\n✅ {name}")
            ok += 1
        except Exception as e:
            print(f"\n❌ {name}: {e}")
    print(f"\n{'=' * 60}\nSUMMARY: {ok}/{len(SCENARIOS)} passed")
    if ok < len(SCENARIOS):
        sys.exit(1)


if __name__ == "__main__":
    main()
