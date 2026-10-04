#!/usr/bin/env python3
"""Build a catalog-driven learn-path course (Adventure A2) from its authoring files.

    python3 scripts/build-learn-course.py            # write all outputs
    python3 scripts/build-learn-course.py --check    # exit 1 if outputs are stale

Inputs (scripts/a2/):
  adventure-a2-course.json   design spec: 333 nodes, pools for say_it / see_and_say /
                             hear_it / story_bites / explain_it
  content/*.json             authored overlays for node types without pools
                             (new_words, emoji_speak, lessons, conversations,
                             checkpoint scenarios) plus chapter English titles

Outputs are regenerated wholesale; edit the inputs, never the outputs.
Node ids are permanent: chapter N node M -> a2_cNNnMM (from the node code "N.M").
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "a2"
APP_REPO = Path(os.environ.get("APP_REPO", ROOT.parent / "banana-english-app"))

PATH_ID = "adventure_a2"
SOURCE_VERSION = "adventure-a2-2026-10"
RELEASED_CHAPTERS = 8
CHAPTERS_PER_ZONE = 8

TYPE_MAP = {"see_and_say": "describe_it"}
FLAG_BY_TYPE = {"explain_it": "adventure_a2_explain_it"}
DEFAULT_FLAG = "adventure_a2_optional"
MINUTES = {
    "lesson": [3, 5], "new_words": [1, 2], "emoji_speak": [1, 2], "say_it": [2, 3],
    "describe_it": [2, 3], "story_bites": [2, 3], "hear_it": [2, 3], "conversation": [3, 4],
    "pronunciation": [2, 3], "interactive_scenario": [8, 10], "explain_it": [2, 3],
}
FUNCTION_WORDS = set(
    "a an the i you he she it we they my your his her our their is am are was were do does "
    "did to in on at of and or but for with not don't doesn't i'm it's what where when who "
    "how why can will be this that these those there here me us them".split()
)

OUTPUTS = {
    "catalog": ROOT / "src/learn-path/adventure-a2-path.catalog.json",
    "say_it": ROOT / "src/say-it/adventure-a2-pools.json",
    "emoji_speak": ROOT / "src/emoji-speak/adventure-a2-pools.json",
    "new_words": ROOT / "src/new-words/adventure-a2-pools.json",
    "describe_it": ROOT / "src/describe-it/adventure-a2-pools.json",
    "hear_it": ROOT / "src/hear-it/hear-it-pools.json",
    "story_bites": ROOT / "src/story-bites/story-bites-pools.json",
    "lessons": ROOT / "src/lessons/adventure-a2-lessons.authoring.json",
    "conversations": ROOT / "src/simulations/adventure-a2-simulations.authoring.json",
    "scenarios": ROOT / "src/interactive-scenario/adventure-a2-scenarios.json",
}


def load_overlays():
    merged = {}
    for path in sorted((SRC / "content").glob("*.json")):
        data = json.loads(path.read_text())
        for key, value in data.items():
            if key.startswith("_"):
                continue
            if isinstance(value, dict):
                merged.setdefault(key, {}).update(value)
            else:
                merged[key] = value
    return merged


def node_id(code):
    chapter, number = code.split(".")
    return f"a2_c{int(chapter):02d}n{int(number):02d}"


def chapter_id(number):
    return f"a2_c{number:02d}"


EMOJI_PREFIX = re.compile(r"^[^\w(]+", re.UNICODE)


def split_title(title):
    en, _, th = title.partition(" / ")
    return EMOJI_PREFIX.sub("", en).strip(), th.strip() or en.strip()


def plain(text):
    return re.sub(r"\*\*(.+?)\*\*", r"\1", text).strip()


def examples(say):
    if say.strip() in ("", "—"):
        return []
    return [s.strip() for s in say.split("·") if s.strip()]


def two_level_hints(answer):
    """Level 1 = first word; level 2 = the sentence with content words gapped."""
    words = answer.split()
    if not words:
        return []
    first = f"{words[0]} …"
    gapped = []
    for i, word in enumerate(words):
        core = re.sub(r"[^\w']", "", word).lower()
        if i == 0 or core in FUNCTION_WORDS or not core:
            gapped.append(word)
        else:
            tail = re.sub(r"[\w']", "", word)
            gapped.append("___" + tail)
    level2 = " ".join(gapped)
    return [first] if level2 == answer else [first, level2]


def letter_hint(answer):
    return " ".join(
        re.sub(r"(?<=\w)\w", "_", word) if word[0].isalnum() else word
        for word in answer.split()
    )


def describe_image_path(pool_id, index):
    return f"describe-it/{pool_id}/{index + 1:02d}.webp"


def missing_describe_images(pool_id, count):
    folder = APP_REPO / "assets/images/describe_it" / pool_id
    return [i + 1 for i in range(count) if not (folder / f"{i + 1:02d}.webp").exists()]


FLOW_STEP_KEYS = (
    "kind", "text", "expectedSpeech", "answerMode", "stem", "options",
    "successText", "incorrectHintTh", "extraAnswers",
)


def lesson_from_flow(node, ntype):
    """Authored V7 legacy-flow lesson; the runtime plays `flow` step by step."""
    flow = node["flow"]
    steps = [{k: step[k] for k in FLOW_STEP_KEYS if k in step} for step in flow["steps"]]
    spoken = [s["expectedSpeech"] for s in steps if s.get("expectedSpeech")]
    return {
        "titleEn": flow["titleEn"],
        "titleTh": flow["titleTh"],
        "goalTh": flow["goalTh"],
        "estimatedMinutes": MINUTES[ntype],
        "scope": plain(node["teach"]),
        "blocks": [],
        "recall": {"promptTh": flow["goalTh"], "answerEn": spoken[-1] if spoken else node["say"]},
        "flow": steps,
    }


def build():
    course = json.loads((SRC / "adventure-a2-course.json").read_text())
    overlays = load_overlays()
    titles_en = overlays.get("chapterTitlesEn", {})
    out = {key: {} for key in OUTPUTS}
    out["lessons"] = {}
    conversations, scenarios = [], []
    chapters = {}
    order_in_chapter = {}
    global_order = 0
    skipped_images = []

    for node in course["nodes"]:
        code = node["code"]
        chapter_number = int(code.split(".")[0])
        nid = node_id(code)
        source_type = node["type"]
        ntype = TYPE_MAP.get(source_type, source_type)
        title_en, title_th = split_title(node["title"])
        global_order += 1
        order_in_chapter[chapter_number] = order_in_chapter.get(chapter_number, 0) + 1

        if chapter_number not in chapters:
            chapter_th = node["chapter"].split(":", 1)[-1].strip()
            meta = course["chapters"].get(str(chapter_number), {})
            chapters[chapter_number] = {
                "id": chapter_id(chapter_number),
                "number": chapter_number,
                "titleEn": titles_en.get(str(chapter_number), f"Chapter {chapter_number}"),
                "titleTh": chapter_th,
                "outcome": meta.get("outcome", ""),
                "zone": (chapter_number - 1) // CHAPTERS_PER_ZONE + 1,
                "items": [],
            }

        content_ref = {}
        pool = node.get("pool") or []

        if ntype == "say_it" and pool:
            out["say_it"][nid] = [
                {
                    "id": f"{nid}_q{i + 1}",
                    "promptTh": item["th"],
                    "answerEn": item["en"],
                    "acceptedAnswers": item.get("accept", []),
                    "hints": two_level_hints(item["en"]),
                }
                for i, item in enumerate(pool)
            ]
            content_ref["topicId"] = nid
        elif ntype == "describe_it" and pool:
            prompt_th = overlays.get("seeAndSayPrompts", {}).get(code, node["goal"])
            if code in overlays.get("seeAndSayImagesReady", []):
                out["describe_it"][nid] = {
                    "id": nid,
                    "titleEn": title_en,
                    "titleTh": title_th,
                    "tagEn": "ADVENTURE",
                    "emoji": "🖼️",
                    "estimatedMinutes": 3,
                    "items": [
                        {
                            "id": f"{nid}_{i + 1:02d}",
                            "promptTh": prompt_th,
                            "answerEn": item["en"],
                            "answerTh": item.get("th", ""),
                            "acceptedAnswers": item.get("accept", []),
                            "imagePath": describe_image_path(nid, i),
                            "hints": two_level_hints(item["en"]),
                        }
                        for i, item in enumerate(pool)
                    ],
                }
            else:
                skipped_images.append(code)
            content_ref["poolId"] = nid
        elif ntype == "hear_it" and pool:
            out["hear_it"][nid] = {
                "id": nid,
                "titleEn": title_en,
                "titleTh": title_th,
                "items": [
                    {
                        "id": f"{nid}_{i + 1:02d}",
                        "audioText": item["audio"],
                        "questionTh": item["q"],
                        "answerEn": item["en"],
                        "acceptedAnswers": item.get("accept", []),
                        "hints": two_level_hints(item["en"]),
                    }
                    for i, item in enumerate(pool)
                ],
            }
            content_ref["poolId"] = nid
        elif ntype == "story_bites" and pool:
            script = pool[0]["audio"]
            speaker_match = re.match(r"^([A-Z][\w .]+?):\s", script)
            extra = overlays.get("storyBites", {}).get(code, {})
            out["story_bites"][nid] = {
                "id": nid,
                "clipId": f"{nid}_clip",
                "titleEn": title_en,
                "titleTh": title_th,
                "speaker": extra.get("speaker", speaker_match.group(1) if speaker_match else "Teacher Bee"),
                "script": script,
                **({"imagePath": extra["imagePath"]} if extra.get("imagePath") else {}),
                "questions": [
                    {
                        "id": f"{nid}_q{i + 1}",
                        "questionEn": item["q"],
                        "answerEn": item["en"],
                        "acceptedAnswers": item.get("accept", []),
                        "hints": two_level_hints(item["en"]),
                    }
                    for i, item in enumerate(pool)
                ],
            }
            content_ref["poolId"] = nid
        elif ntype == "explain_it":
            content_ref["poolId"] = nid
        elif ntype == "new_words":
            items = overlays.get("newWords", {}).get(code)
            if items:
                out["new_words"][nid] = {
                    "title": title_en,
                    "items": [
                        {
                            **{k: v for k, v in it.items() if k != "accept"},
                            **({"acceptedAnswers": it["accept"]} if it.get("accept") else {}),
                        }
                        for it in items
                    ],
                }
            content_ref["poolId"] = nid
        elif ntype == "emoji_speak":
            items = overlays.get("emojiSpeak", {}).get(code)
            if items:
                out["emoji_speak"][nid] = {
                    "title": title_en,
                    "dealCount": min(7, len(items)),
                    "items": [
                        {
                            "emoji": it["emoji"],
                            "answer": it["answer"],
                            "hint": it.get("hint") or letter_hint(it["answer"]),
                            "meaningTh": it["meaningTh"],
                            **({"promptTh": it["promptTh"]} if it.get("promptTh") else {}),
                            **({"acceptedAnswers": it["accept"]} if it.get("accept") else {}),
                            "hints": [
                                f"{it['answer'][0].upper()}… ({len(it['answer'].split())} คำ)",
                                it["answer"],
                            ],
                        }
                        for it in items
                    ],
                }
            content_ref["poolId"] = nid
        elif ntype in ("lesson", "pronunciation"):
            spec = overlays.get("lessons", {}).get(code)
            if node.get("flow"):
                out["lessons"][nid] = lesson_from_flow(node, ntype)
            elif spec:
                out["lessons"][nid] = {
                    "titleEn": spec.get("titleEn", title_en),
                    "titleTh": spec.get("titleTh", title_th),
                    "goalTh": spec.get("goalTh", node["goal"]),
                    "estimatedMinutes": spec.get("estimatedMinutes", MINUTES[ntype]),
                    **{k: v for k, v in spec.items() if k not in ("titleEn", "titleTh", "goalTh", "estimatedMinutes")},
                }
            content_ref["lessonId"] = nid
        elif ntype == "conversation":
            spec = overlays.get("conversations", {}).get(code)
            if spec:
                conversations.append({"simulationId": nid, "nodeId": nid, "titleEn": title_en, **spec})
            content_ref["simulationId"] = nid
        elif ntype == "interactive_scenario":
            spec = overlays.get("scenarios", {}).get(code)
            if spec:
                scenarios.append({"id": nid, "titleEn": title_en, "titleTh": title_th, **spec})
            content_ref["scenarioId"] = nid

        item = {
            "id": nid,
            "code": code,
            "order": order_in_chapter[chapter_number],
            "globalOrder": global_order,
            "titleEn": title_en,
            "titleTh": title_th,
            "type": ntype,
            "beat": node["beat"],
            "learningTarget": node["goal"],
            "activity": plain(node["teach"]),
            "examples": examples(node["say"]),
            "estimatedMinutes": MINUTES[ntype],
            "difficultyAxes": [int(c) for c in node["axes"]],
            "contentRef": content_ref,
        }
        if source_type == "story_bites":
            item["clipId"] = f"{nid}_clip"
        if node.get("flag"):
            item["featureFlag"] = FLAG_BY_TYPE.get(ntype, DEFAULT_FLAG)
        chapters[chapter_number]["items"].append(item)

    catalog = {
        "metadata": {
            "sourceVersion": SOURCE_VERSION,
            "pathId": PATH_ID,
            "version": 1,
            "releaseStatus": "playtest",
            "totalNodeCount": global_order,
            "level": "A2",
            "chapterEmoji": "🧭",
            "finaleEmoji": "🏆",
            "releasedChapterCount": RELEASED_CHAPTERS,
        },
        "chapters": [chapters[k] for k in sorted(chapters)],
    }
    out["catalog"] = catalog
    out["conversations"] = conversations
    out["scenarios"] = scenarios
    return out, skipped_images


def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def main():
    check = "--check" in sys.argv
    out, skipped_images = build()
    stale = []
    for key, path in OUTPUTS.items():
        text = dump(out[key])
        if check:
            if not path.exists() or path.read_text() != text:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
    if check:
        if stale:
            print("Stale outputs (run scripts/build-learn-course.py):\n  " + "\n  ".join(stale))
            sys.exit(1)
        print("Adventure A2 outputs are up to date.")
        return
    catalog = out["catalog"]
    print(
        f"{catalog['metadata']['totalNodeCount']} nodes · {len(catalog['chapters'])} chapters · "
        f"say_it {len(out['say_it'])} · describe_it {len(out['describe_it'])} · hear_it {len(out['hear_it'])} · "
        f"story_bites {len(out['story_bites'])} · new_words {len(out['new_words'])} · "
        f"emoji {len(out['emoji_speak'])} · lessons {len(out['lessons'])} · "
        f"conversations {len(out['conversations'])} · scenarios {len(out['scenarios'])}"
    )
    if skipped_images:
        print("see_and_say pools not in seeAndSayImagesReady: " + ", ".join(skipped_images))
    for pool_id, pool in out["describe_it"].items():
        missing = missing_describe_images(pool_id, len(pool["items"]))
        if missing and APP_REPO.exists():
            print(f"WARNING {pool_id}: app asset images missing for cards {missing}")


if __name__ == "__main__":
    main()
