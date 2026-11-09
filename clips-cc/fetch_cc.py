#!/usr/bin/env python3
"""Resolve ytsearch1 hits and save English captions locally."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from pathlib import Path

OUT = Path(__file__).resolve().parent
YT = "/opt/homebrew/bin/yt-dlp"

CLIPS: list[tuple[str, str]] = [
    # A1
    ("A1", "Do You Like Pizza Little Fox"),
    ("A1", "What day is it today Easy Dialogue"),
    ("A1", "A1 Listening Practice Money"),
    ("A1", "A1 Listening Practice Jobs"),
    ("A1", "Hats Enough Mickey Mouse"),
    # A2
    ("A2", "I Want It That Way Brooklyn Nine Nine"),
    ("A2", "Love mom short film"),
    ("A2", "Weathering With You English Trailer"),
    ("A2", "Weather Describing the Weather English"),
    ("A2", "Princess Mononoke English Trailer"),
    # B1
    ("B1", "Kiki's Delivery Service English Trailer"),
    ("B1", "Talking About Your Job English"),
    ("B1", "9 Ways to Ask for Help in English"),
    ("B1", "Stranger Things 5 Official Trailer"),
    ("B1", "Cardi B appeared in court"),
    # B2
    ("B2", "Toy Story Tribute"),
    ("B2", "Morning Routine Phrasal Verbs with Georgie BBC"),
    ("B2", "Baby Penguin Tries To Make Friends"),
    ("B2", "How to Survive a Lightning Strike"),
    ("B2", "Business English Conversation"),
]


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return s[:60] or "clip"


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, text=True, capture_output=True)


def fetch_one(level: str, query: str, attempt: int = 1) -> dict:
    slug = slugify(query)
    dest = OUT / level / slug
    dest.mkdir(parents=True, exist_ok=True)
    print(f"\n=== [{level}] {query} (try {attempt}) ===", flush=True)

    # 1) Resolve first search hit to a watch URL + metadata (no subs yet).
    probe = run(
        [
            YT,
            "--skip-download",
            "--no-playlist",
            "--print",
            "%(id)s\t%(webpage_url)s\t%(title)s\t%(channel,uploader|)s\t%(duration|)s",
            f"ytsearch1:{query}",
        ]
    )
    if probe.returncode != 0:
        err = (probe.stderr or probe.stdout or "").strip()[-500:]
        print("PROBE FAIL:", err, flush=True)
        if "429" in err and attempt < 4:
            wait = 20 * attempt
            print(f"sleep {wait}s then retry…", flush=True)
            time.sleep(wait)
            return fetch_one(level, query, attempt + 1)
        return {"level": level, "query": query, "ok": False, "error": err}

    line = (probe.stdout or "").strip().splitlines()[-1]
    parts = line.split("\t")
    if len(parts) < 3:
        return {"level": level, "query": query, "ok": False, "error": f"bad probe: {line!r}"}
    vid, url, title = parts[0], parts[1], parts[2]
    channel = parts[3] if len(parts) > 3 else ""
    duration = parts[4] if len(parts) > 4 else ""
    print(f"→ {title}\n  {url}", flush=True)

    meta = {
        "level": level,
        "search_query": query,
        "id": vid,
        "title": title,
        "url": url,
        "channel": channel,
        "duration": int(duration) if str(duration).isdigit() else duration,
    }
    (dest / "clip.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    # 2) Download English subs only (manual first, then auto). Prefer one lang
    #    at a time to reduce 429s.
    for langs in ("en", "en-US", "en.*"):
        existing = list(dest.glob(f"{vid}.*.srt")) + list(dest.glob(f"{vid}.*.vtt"))
        if existing:
            break
        time.sleep(3)
        sub = run(
            [
                YT,
                "--skip-download",
                "--no-playlist",
                "--write-subs",
                "--write-auto-subs",
                "--sub-langs",
                langs,
                "--convert-subs",
                "srt",
                "-o",
                str(dest / "%(id)s"),
                url,
            ]
        )
        out = (sub.stdout or "") + (sub.stderr or "")
        if "429" in out:
            wait = 25 * attempt
            print(f"429 on subs ({langs}); sleep {wait}s", flush=True)
            time.sleep(wait)
            continue
        if sub.returncode != 0 and "Unable to download" in out:
            print(f"no subs for {langs}", flush=True)
            continue
        print(out[-400:], flush=True)

    srts = sorted(dest.glob("*.srt"))
    vtts = sorted(dest.glob("*.vtt"))
    meta["ok"] = bool(srts or vtts)
    meta["subtitle_files"] = [p.name for p in srts + vtts]
    (dest / "clip.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("subs:", meta["subtitle_files"] or "NONE", flush=True)
    return meta


def main() -> int:
    results = []
    for i, (level, query) in enumerate(CLIPS):
        if i:
            time.sleep(8)  # be kind to YouTube between clips
        results.append(fetch_one(level, query))

    summary = OUT / "summary.json"
    summary.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = sum(1 for r in results if r.get("ok"))
    print(f"\n==== DONE {ok}/{len(results)} with captions ====", flush=True)
    print(f"summary: {summary}", flush=True)
    for r in results:
        mark = "OK" if r.get("ok") else "MISS"
        print(f"  [{mark}] {r.get('level')} {r.get('title') or r.get('query')}", flush=True)
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
