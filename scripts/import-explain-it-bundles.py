#!/usr/bin/env python3
"""One-time / repeatable import: CSV → explain-it-pools.json.

Usage:
  python3 scripts/import-explain-it-bundles.py [path/to/explain_it_bundles.csv]
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src' / 'explain-it' / 'explain-it-pools.json'

TOPIC_META = {
    'Everyday Objects': {
        'id': 'everyday_objects',
        'titleEn': 'Everyday Objects',
        'titleTh': 'สิ่งของในชีวิตประจำวัน',
        'subtitleEn': 'Explain everyday objects',
        'subtitleTh': 'อธิบายสิ่งของรอบตัว',
        'emoji': '🧳',
        'accentColor': 0xFF26A69A,
        'tagEn': 'EASY',
        'tier': 1,
    },
    'Places': {
        'id': 'places',
        'titleEn': 'Places',
        'titleTh': 'สถานที่',
        'subtitleEn': 'Explain places',
        'subtitleTh': 'อธิบายสถานที่',
        'emoji': '📍',
        'accentColor': 0xFF42A5F5,
        'tagEn': 'EASY',
        'tier': 1,
    },
    'Daily Actions': {
        'id': 'daily_actions',
        'titleEn': 'Daily Actions',
        'titleTh': 'กิจกรรมประจำวัน',
        'subtitleEn': 'Explain daily actions',
        'subtitleTh': 'อธิบายกิจกรรมประจำวัน',
        'emoji': '🗓️',
        'accentColor': 0xFF66BB6A,
        'tagEn': 'EASY',
        'tier': 1,
    },
    'Jobs': {
        'id': 'jobs',
        'titleEn': 'Jobs',
        'titleTh': 'อาชีพ',
        'subtitleEn': 'Explain jobs',
        'subtitleTh': 'อธิบายอาชีพ',
        'emoji': '💼',
        'accentColor': 0xFFFFA726,
        'tagEn': 'MEDIUM',
        'tier': 2,
    },
    'Food & Drink': {
        'id': 'food_drink',
        'titleEn': 'Food & Drink',
        'titleTh': 'อาหารและเครื่องดื่ม',
        'subtitleEn': 'Explain food and drink',
        'subtitleTh': 'อธิบายอาหารและเครื่องดื่ม',
        'emoji': '🍽️',
        'accentColor': 0xFFEF5350,
        'tagEn': 'MEDIUM',
        'tier': 2,
    },
    'Weather': {
        'id': 'weather',
        'titleEn': 'Weather',
        'titleTh': 'อากาศ',
        'subtitleEn': 'Explain weather',
        'subtitleTh': 'อธิบายอากาศ',
        'emoji': '🌤️',
        'accentColor': 0xFF29B6F6,
        'tagEn': 'MEDIUM',
        'tier': 2,
    },
    'Animals': {
        'id': 'animals',
        'titleEn': 'Animals',
        'titleTh': 'สัตว์',
        'subtitleEn': 'Explain animals',
        'subtitleTh': 'อธิบายสัตว์',
        'emoji': '🐾',
        'accentColor': 0xFFAB47BC,
        'tagEn': 'MEDIUM',
        'tier': 2,
    },
    'Feelings': {
        'id': 'feelings',
        'titleEn': 'Feelings',
        'titleTh': 'ความรู้สึก',
        'subtitleEn': 'Explain feelings',
        'subtitleTh': 'อธิบายความรู้สึก',
        'emoji': '💭',
        'accentColor': 0xFFEC407A,
        'tagEn': 'HARD',
        'tier': 3,
    },
}

EMOJI = {
    'TV': '📺', 'Phone': '📱', 'Computer': '💻', 'Camera': '📷', 'Book': '📖',
    'Chair': '🪑', 'Bed': '🛏️', 'Key': '🔑', 'Clock': '⏰', 'Umbrella': '☂️',
    'Bicycle': '🚲', 'Spoon': '🥄', 'Toothbrush': '🪥', 'Refrigerator': '🧊',
    'Backpack': '🎒', 'Shoes': '👟', 'Sunglasses': '🕶️', 'Mirror': '🪞',
    'Pillow': '🛏️', 'Banana': '🍌', 'Sleep': '😴', 'Shower': '🚿', 'Run': '🏃',
    'Read': '📖', 'Write': '✍️', 'Eat': '🍽️', 'Drink': '🥤', 'Walk': '🚶',
    'Swim': '🏊', 'Dance': '💃', 'Sing': '🎤', 'Laugh': '😂', 'Cry': '😢',
    'Brush your teeth': '🪥', 'Wash your hands': '🧼', 'Play': '🎮', 'Work': '💼',
    'Cook': '🍳', 'Wake up': '⏰', 'Watermelon': '🍉', 'Storm': '⛈️',
    'Summer': '☀️', 'Winter': '❄️', 'Dry season': '🏜️', 'Rainy season': '🌧️',
    'Morning': '🌅', 'Night': '🌙', 'Flood': '🌊', 'Breeze': '🍃', 'Sunny': '☀️',
    'Rainy': '🌧️', 'Cold': '🥶', 'Cloudy': '☁️', 'Windy': '💨', 'Snowy': '❄️',
    'Hot': '🥵', 'Foggy': '🌫️', 'Rainbow': '🌈', 'Thunder': '⚡', 'Humid': '💧',
    'Dog': '🐶', 'Cat': '🐱', 'Elephant': '🐘', 'Bird': '🐦', 'Cow': '🐮',
    'Lion': '🦁', 'Snake': '🐍', 'Monkey': '🐵', 'Duck': '🦆', 'Horse': '🐴',
    'Pig': '🐷', 'Rabbit': '🐰', 'Bee': '🐝', 'Spider': '🕷️', 'Frog': '🐸',
    'Tiger': '🐯', 'Turtle': '🐢', 'Sheep': '🐑', 'Relieved': '😌',
    'Confident': '😎', 'Disappointed': '😞',
}


def slug(word: str) -> str:
    s = re.sub(r'[^a-z0-9]+', '_', word.lower()).strip('_')
    return s or 'item'


def main() -> None:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Downloads' / 'explain_it_bundles.csv'
    if not csv_path.exists():
        raise SystemExit(f'CSV not found: {csv_path}')

    pools: dict[str, list] = {m['id']: [] for m in TOPIC_META.values()}
    with csv_path.open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            bundle = (row.get('bundle') or row.get('Bundle') or '').strip()
            meta = TOPIC_META.get(bundle)
            if not meta:
                continue
            word = (row.get('hidden_word') or row.get('word') or '').strip()
            if not word:
                continue
            sample = (row.get('sample_answer') or '').strip()
            structure = (row.get('sentence_structure') or '').strip()
            emoji_csv = (row.get('emoji_suggestion') or '').strip()
            item = {
                'id': f"{meta['id']}_{slug(word)}",
                'targetEn': word,
                'emoji': emoji_csv or EMOJI.get(word) or meta['emoji'] or '🎯',
                'exampleDescriptionEn': sample,
            }
            if structure:
                item['sentenceStructure'] = structure
            pools[meta['id']].append(item)

    topics = []
    for meta in TOPIC_META.values():
        items = pools[meta['id']]
        topics.append({
            **{k: v for k, v in meta.items()},
            'estimatedMinutes': 4,
            'poolSize': len(items),
            'locked': False,
            'isNew': True,
        })

    OUT.write_text(json.dumps({'topics': topics, 'pools': pools}, ensure_ascii=False, indent=2) + '\n')
    total = sum(len(v) for v in pools.values())
    print(f'Wrote {OUT} — {len(topics)} topics, {total} items')


if __name__ == '__main__':
    main()
